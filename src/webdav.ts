// src/webdav.ts
import { jsonResponse } from '@songloft/plugin-sdk';
import type { HTTPRequest } from '@songloft/plugin-sdk';

// 🔐 扫描会话隔离：所有扫描状态收敛进单个会话对象，模块只持有「当前会话」引用；
// 新扫描创建全新会话并原子替换，旧会话的异步任务通过 `activeScanSession !== session`
// 自检立刻取消，杜绝跨请求污染模块级可变状态（审阅 #8）
interface WebDavScanSession {
    scanId: string;        // 本次扫描唯一标识（前端状态轮询可校验）
    version: number;       // 单调递增版本号
    status: 'idle' | 'scanning' | 'completed' | 'failed' | 'completed_with_warnings';
    foldersCount: number;
    davId: string;
    hadWarnings: boolean;
}
let scanCounter = 0;
let activeScanSession: WebDavScanSession | null = null;

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

// 🔐 同名目录防覆盖：内部键默认用 basename；同名冲突时用「父目录/basename」消歧，
// 仍冲突则退化为完整相对路径，再冲突则追加序号，确保不同目录绝不互相覆盖（纯函数，便于单测）
export function webdavKeyForFolder(pathOwners: Record<string, string>, currentPath: string): string {
    const relativePath = currentPath === '/' ? '' : currentPath.replace(/^\/+/, '');
    const basename = currentPath === '/' ? '根目录' : currentPath.split('/').pop() || '未知文件夹';
    let key = basename;
    const owner = pathOwners[key];
    if (owner !== undefined && owner !== relativePath) {
        const parent = relativePath.split('/').filter(Boolean).slice(-2, -1)[0];
        let altKey = parent ? `${parent}/${basename}` : relativePath;
        let altOwner = pathOwners[altKey];
        if (altOwner !== undefined && altOwner !== relativePath) {
            // 完整相对路径兜底；仍被不同目录占用则追加序号保证唯一
            altKey = relativePath;
            if (pathOwners[altKey] !== undefined && pathOwners[altKey] !== relativePath) {
                let n = 2;
                while (pathOwners[`${altKey} (${n})`] !== undefined && pathOwners[`${altKey} (${n})`] !== relativePath) n++;
                altKey = `${altKey} (${n})`;
            }
        }
        key = altKey;
    }
    return key;
}

// 辅助时间格式化函数
function formatScanTime(): string {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

// 🌐 异步递归扫描核心：数组游标出队（O(1)）+ 有界并发 + 超时/重试/取消
async function runScanTask(session: WebDavScanSession, hostUrl: string, token: string, davId: string, rootPath: string) {
    const CONCURRENCY = 4;
    const queue: string[] = [rootPath];
    let queueIndex = 0; // 🔐 用游标替代 shift()，避免 O(n²)
    const resultLibrary: Record<string, any[]> = {};
    // 🔐 同名目录防覆盖：记录每个已用 key 对应的完整相对路径
    const pathOwners: Record<string, string> = {};
    let lastWriteTime = Date.now();

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
            if (activeScanSession !== session) return null;
            let res: Response | null = null;
            try {
                if (typeof AbortController !== 'undefined') {
                    const controller = new AbortController();
                    const timer = setTimeout(() => controller.abort(), 15000);
                    try {
                        res = await fetch(apiUrl, {
                            headers: { 'Authorization': `Bearer ${token}` },
                            signal: controller.signal
                        });
                    } finally {
                        clearTimeout(timer);
                    }
                } else {
                    // 🔐 QuickJS 精简运行时无 AbortController：Promise.race 超时兜底
                    // （底层请求后台继续），避免 new AbortController() 抛 ReferenceError
                    res = await Promise.race([
                        fetch(apiUrl, { headers: { 'Authorization': `Bearer ${token}` } }),
                        new Promise<null>((resolve) => setTimeout(() => resolve(null), 15000))
                    ]);
                }
                if (!res) continue; // 超时 → 重试一次
                if (!res.ok) {
                    if (res.status >= 400 && res.status < 500 && res.status !== 429) return null; // 永久失败
                    continue; // 5xx/429：重试一次
                }
                const json = await res.json();
                return Array.isArray(json) ? json : [];
            } catch (err) {
                if (activeScanSession !== session) return null;
                // 超时/网络错误：重试一次
            }
        }
        return null; // 重试仍失败
    };

    try {
        // 🔐 有界并发 worker：各自循环从游标队列取目录处理
        const workers = Array.from({ length: CONCURRENCY }, async () => {
            while (true) {
                if (activeScanSession !== session) return; // 取消（新扫描已原子替换会话）
                const currentPath = queue[queueIndex++];
                if (currentPath === undefined) return; // 队列耗尽

                const apiUrl = `${hostUrl}/api/v1/jsplugin/dav/lists/${encodeURIComponent(davId)}/items?path=${encodeURIComponent(currentPath)}`;
                const items = await fetchDirItems(apiUrl);

                if (items === null) {
                    songloft.log.error(`[WebDAV] 扫描出错 ${currentPath}: 多次尝试失败`);
                    session.hadWarnings = true;
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
                    const key = webdavKeyForFolder(pathOwners, currentPath);
                    pathOwners[key] = currentPath === '/' ? '' : currentPath.replace(/^\/+/, '');
                    resultLibrary[key] = audioItems;
                    session.foldersCount++;
                }

                queueHeartbeat(); // 串行化写入，不阻塞 worker
            }
        });

        await Promise.all(workers);

        if (activeScanSession === session) {
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
            session.status = session.hadWarnings ? 'completed_with_warnings' : 'completed';
        }
    } catch (fatalErr) {
        if (activeScanSession === session) session.status = 'failed';
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

        // 🔐 每次扫描创建全新会话对象并原子替换 activeScanSession；
        // 旧会话的异步任务将在下一个检查点（activeScanSession !== session）自行取消
        const session: WebDavScanSession = {
            scanId: `scan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            version: ++scanCounter,
            status: 'scanning',
            foldersCount: 0,
            davId,
            hadWarnings: false
        };
        activeScanSession = session;

        runScanTask(session, hostUrl, token, davId, rootPath).catch(() => {});
        return jsonResponse({ status: "scanning", version: session.version, scanId: session.scanId });
    });

    // 2. 前端 3 秒心跳轮询进度接口
    router.get('/dav/status', async (req: HTTPRequest) => {
        const s = activeScanSession;
        if (!s) return jsonResponse({ status: 'idle', scanned_folders: 0, davId: '', scanId: '' });
        return jsonResponse({ status: s.status, scanned_folders: s.foldersCount, davId: s.davId, scanId: s.scanId });
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