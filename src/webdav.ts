// src/webdav.ts
import { jsonResponse } from '@songloft/plugin-sdk';
import type { HTTPRequest } from '@songloft/plugin-sdk';

let currentScanVersion = 0;
let scanStatus = 'idle'; // 'idle' | 'scanning' | 'completed' | 'failed'
let scannedFoldersCount = 0;
let activeDavId = '';

const AUDIO_EXTS = ['.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg', '.ape', '.wma', '.alac'];

// 👇 新增：直接在这里定义发给兄弟的广播函数
const TWIN_PLUGIN_ID = 'miot-helper';
async function broadcastWebDavLibrary(davId: string, library: any) {
    try {
        await songloft.comm.send(TWIN_PLUGIN_ID, "sync_webdav_data", {
            type: 'library',
            davId: davId,
            library: library
        });
        songloft.log.info(`📡 已向 [${TWIN_PLUGIN_ID}] 广播扫库结果: ${davId}`);
    } catch (e) {}
}
function isAudioFile(filename: string): boolean {
    const lower = filename.toLowerCase();
    return AUDIO_EXTS.some(ext => lower.endsWith(ext));
}

// 辅助时间格式化函数
function formatScanTime(): string {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

// 🌐 异步递归扫描核心：数组游标出队（O(1)）+ 有界并发 + 超时/重试/取消
async function runScanTask(version: number, hostUrl: string, token: string, davId: string, rootPath: string) {
    const CONCURRENCY = 4;
    const queue: string[] = [rootPath];
    let queueIndex = 0; // 🔐 用游标替代 shift()，避免 O(n²)
    const resultLibrary: Record<string, any[]> = {};
    // 🔐 同名目录防覆盖：记录每个已用 key 对应的完整相对路径
    const pathOwners: Record<string, string> = {};
    let lastWriteTime = Date.now();
    let scanHadWarnings = false;

    // ⏱️ 心跳批处理写入串行化（多 worker 并发写同一 storage key 会互相覆盖）
    let heartbeatChain: Promise<void> = Promise.resolve();
    const queueHeartbeat = () => {
        heartbeatChain = heartbeatChain.then(async () => {
            if (Date.now() - lastWriteTime <= 3000) return;
            let totalSongs = 0;
            for (const list of Object.values(resultLibrary)) totalSongs += list.length;
            const libData = {
                folders: Object.keys(resultLibrary).length,
                songs: totalSongs,
                time: formatScanTime(),
                library: resultLibrary
            };
            await songloft.storage.set(`webdav_lib_${davId}`, JSON.stringify(libData));
            lastWriteTime = Date.now();
        }).catch(() => {});
    };

    // 单目录拉取：超时中止 + 一次重试（仅临时失败：超时/网络/5xx/429）
    const fetchDirItems = async (apiUrl: string): Promise<any[] | null> => {
        for (let attempt = 0; attempt < 2; attempt++) {
            if (currentScanVersion !== version) return null;
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 15000);
            try {
                const res = await fetch(apiUrl, {
                    headers: { 'Authorization': `Bearer ${token}` },
                    signal: controller.signal
                });
                if (!res.ok) {
                    if (res.status >= 400 && res.status < 500 && res.status !== 429) return null; // 永久失败
                    continue; // 5xx/429：重试一次
                }
                const json = await res.json();
                return Array.isArray(json) ? json : [];
            } catch (err) {
                if (currentScanVersion !== version) return null;
                // 超时/网络错误：重试一次
            } finally {
                clearTimeout(timer);
            }
        }
        return null; // 重试仍失败
    };

    try {
        // 🔐 有界并发 worker：各自循环从游标队列取目录处理
        const workers = Array.from({ length: CONCURRENCY }, async () => {
            while (true) {
                if (currentScanVersion !== version) return; // 取消
                const currentPath = queue[queueIndex++];
                if (currentPath === undefined) return; // 队列耗尽

                const apiUrl = `${hostUrl}/api/v1/jsplugin/dav/lists/${encodeURIComponent(davId)}/items?path=${encodeURIComponent(currentPath)}`;
                const items = await fetchDirItems(apiUrl);

                if (items === null) {
                    songloft.log.error(`[WebDAV] 扫描出错 ${currentPath}: 多次尝试失败`);
                    scanHadWarnings = true;
                    continue;
                }

                const audioItems = [];
                for (const item of items) {
                    if (item.type === 'directory') {
                        const nextPath = currentPath === '/' ? '/' + item.name : `${currentPath}/${item.name}`;
                        queue.push(nextPath);
                    } else if (item.type === 'file' && isAudioFile(item.name)) {
                        audioItems.push({
                            id: item.id || `dav_temp_${Date.now()}_${Math.random()}`,
                            title: item.name.replace(/\.[^/.]+$/, ""),
                            artist: "未知歌手",
                            album: "",
                            duration: item.duration || 0,
                            cover_url: "",
                            plugin_entry_path: "dav",
                            source_data: JSON.stringify({ configName: davId, path: item.id }),
                            dedup_key: `dav_${davId}_${item.id}`,
                            streamUrl: item.streamUrl,
                            _isOnlineObj: true
                        });
                    }
                }

                if (audioItems.length > 0) {
                    // 内部键默认用 basename；同名冲突时用「父目录/basename」消歧，
                    // 仍冲突则退化为完整相对路径，确保不同目录绝不互相覆盖
                    const relativePath = currentPath === '/' ? '' : currentPath.replace(/^\/+/, '');
                    const basename = currentPath === '/' ? '根目录' : currentPath.split('/').pop() || '未知文件夹';
                    let key = basename;
                    const owner = pathOwners[key];
                    if (owner !== undefined && owner !== relativePath) {
                        const parent = relativePath.split('/').filter(Boolean).slice(-2, -1)[0];
                        const altKey = parent ? `${parent}/${basename}` : relativePath;
                        const altOwner = pathOwners[altKey];
                        key = (altOwner === undefined || altOwner === relativePath) ? altKey : relativePath;
                    }
                    pathOwners[key] = relativePath;
                    resultLibrary[key] = audioItems;
                    scannedFoldersCount++;
                }

                queueHeartbeat(); // 串行化写入，不阻塞 worker
            }
        });

        await Promise.all(workers);

        if (currentScanVersion === version) {
            let totalSongs = 0;
            for (const list of Object.values(resultLibrary)) totalSongs += list.length;

            const libData = {
                folders: Object.keys(resultLibrary).length,
                songs: totalSongs,
                time: formatScanTime(),
                library: resultLibrary
            };
            await songloft.storage.set(`webdav_lib_${davId}`, JSON.stringify(libData));
            broadcastWebDavLibrary(davId, libData);
            // 部分目录失败仍算完成，但标记 warnings 供前端区分
            scanStatus = scanHadWarnings ? 'completed_with_warnings' : 'completed';
        }
    } catch (fatalErr) {
        if (currentScanVersion === version) scanStatus = 'failed';
    }
}

// 🔌 挂载路由
export function setupWebDAVRoutes(router: any) {
    // 1. 触发手动扫描
    router.post('/dav/scan', async (req: HTTPRequest) => {
        let data: any = {};
        if (req.body) {
            try { data = JSON.parse(typeof req.body === 'string' ? req.body : String.fromCharCode.apply(null, Array.from(req.body as Uint8Array))); } catch(e){}
        }
        const { davId, rootPath } = data;
        if (!davId || !rootPath) return jsonResponse({ error: "Missing parameters" }, 400);

        const hostUrl = await songloft.plugin.getHostUrl();
        const token = await songloft.plugin.getToken();

        currentScanVersion++;
        activeDavId = davId;
        scanStatus = 'scanning';
        scannedFoldersCount = 0;

        runScanTask(currentScanVersion, hostUrl, token, davId, rootPath).catch(() => {});
        return jsonResponse({ status: "scanning", version: currentScanVersion });
    });

    // 2. 前端 3 秒心跳轮询进度接口
    router.get('/dav/status', async (req: HTTPRequest) => {
        return jsonResponse({ status: scanStatus, scanned_folders: scannedFoldersCount, davId: activeDavId });
    });

    // 3. 前端拉取扁平化缓存曲库
    router.get('/dav/library', async (req: HTTPRequest) => {
        let davId = '';
        if (req.query) {
            const match = String(req.query).match(/(?:^|&)davId=([^&]*)/);
            if (match) davId = decodeURIComponent(match[1]);
        }
        if (!davId) return jsonResponse({ error: "Missing davId" }, 400);
        const cache = await songloft.storage.get(`webdav_lib_${davId}`);
        if (cache == null) return jsonResponse({});
        // 🔐 损坏/空缓存不崩溃：字节转字符串 + try/catch 兜底
        try {
            const str = typeof cache === 'string' ? cache : String.fromCharCode.apply(null, Array.from(cache as Uint8Array));
            const parsed = JSON.parse(str);
            return jsonResponse(parsed && typeof parsed === 'object' ? parsed : {});
        } catch (e) {
            return jsonResponse({});
        }
    });

}