/// <reference types="@songloft/plugin-sdk" />
import { jsonResponse, createRouter } from '@songloft/plugin-sdk';
import type { HTTPRequest, HTTPResponse } from '@songloft/plugin-sdk';
import { setupWebDAVRoutes } from './webdav';
import { scrapeCover, scrapeLyric, getLastScrapeLog } from './scraper';

// 🔐 字节/未知值 → 字符串（QuickJS 无 TextDecoder，沿用 String.fromCharCode 模式）
function bytesToStr(v: unknown): string {
    if (typeof v === 'string') return v;
    if (v === null || v === undefined) return '';
    if (v instanceof Uint8Array) return String.fromCharCode.apply(null, Array.from(v));
    if (v instanceof ArrayBuffer) return String.fromCharCode.apply(null, Array.from(new Uint8Array(v)));
    if (Array.isArray(v) && v.every((b: any) => typeof b === 'number')) return String.fromCharCode.apply(null, v as number[]);
    return String(v);
}

// 🔐 存储读取字符串（兼容 get/getItem 两种 API，字节自动转字符串）
async function storageGetString(key: string): Promise<string | null> {
    const s: any = songloft.storage;
    if (typeof s.get === 'function') {
        const v = await s.get(key);
        return v == null ? null : bytesToStr(v);
    }
    if (typeof s.getItem === 'function') {
        const v = await s.getItem(key);
        return v == null ? null : bytesToStr(v);
    }
    return null;
}

// 🔐 存储写入字符串（兼容 set/setItem 两种 API）
async function storageSetString(key: string, value: string): Promise<void> {
    const s: any = songloft.storage;
    if (typeof s.set === 'function') return s.set(key, value);
    if (typeof s.setItem === 'function') return s.setItem(key, value);
    throw new Error("存储引擎不支持写入");
}

// 👇 新增：定义兄弟插件的入口名
const TWIN_PLUGIN_ID = 'miot-helper';

// 👇 新增：广播偏好配置的函数
export async function broadcastWebDavConfig(key: string, value: any) {
    // 🌟 海关安检与别名映射
    let exportKey = key;

    if (key === 'iwebplayer-s.webdav') {
        exportKey = 'webdav_config'; // 转换对外别名
    } else if (!key.startsWith('webdav_lib_')) {
        return; // 拦截 iwebplayer-s.config, iwebplayer-s.lxmusic 等私密数据
    }

    try {
        await songloft.comm.send(TWIN_PLUGIN_ID, "sync_webdav_data", {
            type: 'config',
            key: exportKey,
            value: value
        });
        songloft.log.info(`📡 已向 [${TWIN_PLUGIN_ID}] 广播配置更新: ${exportKey}`);
    } catch (e) {
        // 静默失败，说明对方没装或没激活
    }
}

const router = createRouter();
setupWebDAVRoutes(router);

router.get('/sw.js', () => ({
    statusCode: 200,
    headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-cache'
    },
    // Keep all SongLoft and media requests live; this worker only enables the
    // browser's PWA lifecycle and controls the plugin's root start URL.
    body: `self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => event.respondWith(fetch(event.request)));`
}));

// 🌟 全局临时沙盒：只在前端拉歌的短短几秒内存在，超时必死，绝不长驻内存！
let flashSongsCache: any[] | null = null;
let flashTimeout: any = null;

// 🌟 新增：搞一个全局变量，用来专门记录最新一次探测失败的底层原始错误
let lastSystemError: any = null;

// 🔐 分页拉取歌单全部歌曲：避免 limit 静默截断；宿主忽略 offset 导致死循环时标记 truncated
async function fetchAllPlaylistSongs(id: number): Promise<{ songs: any[]; truncated: boolean; warnings: string[] }> {
    const PAGE = 10000;
    const songs: any[] = [];
    const warnings: string[] = [];
    let offset = 0;
    let truncated = false;
    let prevIds: any[] | null = null;
    while (true) {
        const batch = (await songloft.playlists.getSongs(id, { limit: PAGE, offset })) ?? [];
        if (batch.length === 0) break;
        const batchIds = batch.map((s: any) => s.id);
        const prev: any[] | null = prevIds;
        // 宿主忽略 offset（返回与上一页完全相同的批次）→ 防死循环
        if (prev && batchIds.length === prev.length && batchIds.every((v, i) => v === prev[i])) {
            truncated = true;
            warnings.push(`playlist#${id} 宿主未按 offset 分页，仅取回 ${songs.length} 首`);
            break;
        }
        songs.push(...batch);
        prevIds = batchIds;
        if (batch.length < PAGE) break;
        offset += PAGE;
    }
    return { songs, truncated, warnings };
}

// 🔐 探测音频直链：AbortController 真中止 + Range GET 兜底（兼容不支持 HEAD 的服务器），
// 区分永久失效（404/403）与临时网络问题（超时/连接失败），临时问题不误杀歌曲
async function probeAudioUrl(fullUrl: string): Promise<'ok' | 'dead' | 'transient'> {
    const attempt = async (init: RequestInit): Promise<'ok' | 'dead' | 'transient' | 'unsupported'> => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3000);
        try {
            const res = await fetch(fullUrl, { ...init, signal: controller.signal });
            if (res.status === 404 || res.status === 403) return 'dead';
            if (res.ok || res.status === 206) return 'ok';
            return res.status === 405 ? 'unsupported' : 'transient'; // 405=不支持 HEAD
        } catch (e) {
            return 'transient'; // 超时/网络错误均视为临时
        } finally {
            clearTimeout(timer);
        }
    };
    let r = await attempt({ method: 'HEAD' });
    if (r === 'unsupported') r = await attempt({ method: 'GET', headers: { Range: 'bytes=0-0' } });
    if (r === 'unsupported') return 'transient'; // HEAD/GET 均不支持，按临时处理
    return r;
}

// 🔐 有界并发映射：同一时刻最多 limit 个任务在跑，避免无界 Promise.all 压垮宿主
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let idx = 0;
    const workerCount = Math.max(1, Math.min(limit, items.length));
    const workers = Array.from({ length: workerCount }, async () => {
        while (true) {
            const i = idx++;
            if (i >= items.length) return;
            results[i] = await fn(items[i]);
        }
    });
    await Promise.all(workers);
    return results;
}

router.get('/musiclist', async (req) => {
  try {
    const urlParams = new URLSearchParams(String(req.query));
    const action = urlParams.get('action') || 'legacy';

    // ==========================================
    // 🐜 引擎 A：低配兼容模式 (Light - 蚂蚁搬家)
    // ==========================================
    if (action === 'meta_light') {
      const customNames: string[] = [];
      const playlists = (await songloft.playlists.list()) ?? [];

      playlists.forEach(pl => {
          const isAutoCreated = pl.labels && pl.labels.includes("auto_created");
          if (!isAutoCreated) customNames.push(pl.name);
      });

      return jsonResponse({
          _custom_playlists: customNames,
          _playlist_meta: playlists
      });
    }

    if (action === 'playlist_songs') {
      const idStr = urlParams.get('id');
      if (!idStr) return jsonResponse({ error: "Missing playlist id" }, 400);

      const id = parseInt(idStr, 10);
      if (isNaN(id)) return jsonResponse({ error: "Invalid playlist id format" }, 400);

      const { songs: plSongs, truncated, warnings } = await fetchAllPlaylistSongs(id);

      const cleanedSongs = plSongs.map((s: any) => ({
          id: s.id, title: s.title || "", artist: s.artist || "", album: s.album || "",
          file_path: s.file_path || "", cover_url: s.cover_url || "", duration: s.duration || 0, type: s.type || "local",
          plugin_entry_path: s.plugin_entry_path || "", dedup_key: s.dedup_key || ""
      }));

      // 响应体保持数组以兼容前端；截断/警告信息经响应头回传
      const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8' };
      if (truncated) headers['X-SongLoft-Truncated'] = '1';
      if (warnings.length) headers['X-SongLoft-Warnings'] = warnings.join(';');
      return { statusCode: 200, headers, body: JSON.stringify(cleanedSongs) };
    }

    // ==========================================
    // 🚀 引擎 B：高性能模式 (Bulk - 并发抽水)
    // ==========================================
    if (action === 'meta_bulk') {
      if (flashTimeout) { clearTimeout(flashTimeout); flashTimeout = null; }
      flashSongsCache = null;

      const structure: any = {};
      const customNames: string[] = [];
      const songMap = new Map();
      const bulkWarnings: string[] = [];
      let anyTruncated = false;

      const playlists = (await songloft.playlists.list()) ?? [];

      // 🔐 有界并发（4 worker），避免全量歌单同时拉取压垮宿主
      await mapWithConcurrency(playlists, 4, async (pl) => {
        try {
          const { songs: plSongs, truncated, warnings } = await fetchAllPlaylistSongs(pl.id);
          if (truncated) anyTruncated = true;
          if (warnings.length) bulkWarnings.push(...warnings);
          const cleanedSongs = plSongs.map((s: any) => ({
              id: s.id, title: s.title || "", artist: s.artist || "", album: s.album || "",
              file_path: s.file_path || "", cover_url: s.cover_url || "", duration: s.duration || 0, type: s.type || "local",
              plugin_entry_path: s.plugin_entry_path || "", dedup_key: s.dedup_key || ""
          }));

          if (pl.name !== 'music') {
              structure[`${pl.name}`] = cleanedSongs.map((s: any) => s.id);
          }

          const isAutoCreated = pl.labels && pl.labels.includes("auto_created");
          if (!isAutoCreated) customNames.push(pl.name);

          const isBuiltIn = pl.labels && pl.labels.includes("built_in");
          if (!isBuiltIn) {
              for (const s of cleanedSongs) {
                  if (s && s.id) songMap.set(s.id, s);
              }
          }
        } catch (e) {
          // 单歌单失败不再静默吞掉，记录 warning 供前端提示
          bulkWarnings.push(`歌单「${pl.name}」拉取失败，已跳过: ${String(e)}`);
        }
      });

      const allSongsArray = Array.from(songMap.values());
      structure["所有歌曲"] = allSongsArray.map((s: any) => s.id);
      structure["曲库搜索"] = [];

      flashSongsCache = allSongsArray;
      flashTimeout = setTimeout(() => {
          flashSongsCache = null;
          flashTimeout = null;
      }, 60000);

      return jsonResponse({
          structure: structure,
          _custom_playlists: customNames,
          _playlist_meta: playlists,
          _truncated: anyTruncated,
          _warnings: bulkWarnings
      });
    }

    if (action === 'chunk') {
      if (!flashSongsCache) return jsonResponse([]);
      const page = parseInt(urlParams.get('page') || '1');
      const pageSize = 1000;
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      return jsonResponse(flashSongsCache.slice(start, end));
    }

    if (action === 'destroy') {
      if (flashTimeout) { clearTimeout(flashTimeout); flashTimeout = null; }
      flashSongsCache = null;
      return jsonResponse({ ret: "OK" });
    }

    return jsonResponse({ error: "非法访问，请使用标准 action 抽屉" });
  } catch (error) {
    return jsonResponse({ error: "后端核心引擎崩溃" });
  }
});

// 播放歌曲（极限瘦身 + 智能探测 + 统一极简报错）
router.get('/musicinfo', async (req) => {
  try {
    const id = new URLSearchParams(String(req.query)).get('id') || "";
    if (!id) throw new Error("缺少歌曲ID");

    const token = await songloft.plugin.getToken();
    const audioUrl = `/api/v1/songs/${id}/play?access_token=${token}`;
    const fullUrl = `${await songloft.plugin.getHostUrl()}${audioUrl}`;

    // 🔐 探测直链可用性：AbortController 真中止；仅 404/403 判死，
    // 超时/网络等临时问题不误杀，直接下发直链由播放器自行重试
    const probeResult = await probeAudioUrl(fullUrl);
    if (probeResult === 'dead') throw new Error(`资源拒绝访问`);
    if (probeResult === 'transient') songloft.log.error(`[探测] ${fullUrl} 临时网络问题，按可用下发`);

    // 探测通过，清空上一次的错误记录，下发直链
    lastSystemError = null;
    return jsonResponse({ url: audioUrl });

  } catch (error) {
    // 🌟 统一兜底：所有报错都汇聚于此
    lastSystemError = String(error); // 塞给全局变量，留给 /debug 后门排查
    return jsonResponse({ error: "音频链接已失效" }); // 给前端极简回复（不带url字段触发前端切歌）
  }
});

// ==========================================
// ☁️ 云端接力：读取/保存云端账本 (防弹升级版)
// ==========================================
router.get('/sync', async (req) => {
    try {
        const urlParams = new URLSearchParams(String(req.query));
        const playlist = urlParams.get('playlist');
        if (!playlist) return jsonResponse({ error: "Missing playlist" }, 400);

        let dataStr = "";
        const key = `sync_${playlist}`;

        dataStr = (await storageGetString(key)) || "";

        if (!dataStr) return jsonResponse({ data: null });
        return jsonResponse({ data: JSON.parse(dataStr) });
    } catch (error) {
        return jsonResponse({ error: "云端读取崩溃: " + String(error) });
    }
});

router.post('/sync', async (req) => {
    try {
        // 🌟 修复 1：规避 req.json() 不是函数的问题，直接手撕 req.body（字节→字符串）
        const body = JSON.parse(bytesToStr(req.body));

        const playlist = body.playlist;
        if (!playlist) return jsonResponse({ error: "Missing playlist" }, 400);

        const dataToSave = {
            songName: body.songName,
            time: body.time,
            updateAt: Date.now()
        };

        const key = `sync_${playlist}`;
        const val = JSON.stringify(dataToSave);

        await storageSetString(key, val);

        return jsonResponse({ ret: "OK" });
    } catch (error) {
        return jsonResponse({ error: "云端写入崩溃: " + String(error) });
    }
});

// ==========================================
// 🗄️ 通用配置存储接口 (用于保存平台排序等配置)
// ==========================================
router.get('/store', async (req) => {
    try {
        const urlParams = new URLSearchParams(String(req.query));
        const key = urlParams.get('key');
        if (!key) return jsonResponse({ error: "Missing key" }, 400);

        let dataStr = "";
        dataStr = (await storageGetString(key)) || "";

        return jsonResponse({ data: dataStr });
    } catch (error) {
        return jsonResponse({ error: "读取配置失败: " + String(error) });
    }
});

router.post('/store', async (req) => {
    try {
        const body = JSON.parse(bytesToStr(req.body));

        const key = body.key;
        const value = body.value;
        if (!key) return jsonResponse({ error: "Missing key" }, 400);

        await storageSetString(key, String(value));

        // 🌟 核心升级：无论是老版的 webdav_ 还是新版的 iwp_webdav，统统广播给小爱音箱插件！
        if (key.startsWith('webdav_') || key === 'iwebplayer-s.webdav' || key.startsWith('iwebplayer-s.')) {
            broadcastWebDavConfig(key, value);
        }

        return jsonResponse({ ret: "OK" });
    } catch (error) {
        return jsonResponse({ error: "保存配置失败: " + String(error) });
    }
});

// ==========================================
// 🕷️ 刮削网关：统一处理封面与歌词请求
// ==========================================
router.get('/scrape', async (req) => {
    try {
        const urlParams = new URLSearchParams(String(req.query));
        const type = urlParams.get('type'); // 允许: 'cover' | 'lyric' | 'all'
        const title = urlParams.get('title') || '';
        const artist = urlParams.get('artist') || '';
        const filename = urlParams.get('filename') || '';

        let result: any = {};

        // 1. 刮封面
        if (type === 'cover' || type === 'all') {
            let searchTerm = filename;
            if (filename.includes('-')) {
                searchTerm = `${filename.split('-')[1].trim()} ${filename.split('-')[0].trim()}`;
            }
            if (!searchTerm && title) searchTerm = `${title} ${artist}`.trim();

            result.cover = await scrapeCover(searchTerm);
        }

        // 2. 刮歌词
        if (type === 'lyric' || type === 'all') {
            result.lyric = await scrapeLyric(title, artist, filename);
        }

        return jsonResponse(result);
    } catch (error) {
        return jsonResponse({ error: "刮削引擎发生错误: " + String(error) });
    }
});

// 🌟 专供 debug 页面调用的后门接口
// http://10.0.91.11:10333/api/v1/jsplugin/iwebplayer-s/static/debug.html

router.get('/debug', async (req) => {
    try {
        // 准备一个空托盘，用来装你想要输出的数据
        const debugResult: any = {};

        // ==========================================
        // 🟢 模块 1：查看所有歌曲（不需要时直接注释掉整块）
        // ==========================================
        const rawSongs = (await songloft.songs.list({ limit: 10000 })) ?? {};
        debugResult.songs = rawSongs;


        // ==========================================
        // 🟢 模块 2：查看所有歌单（不需要时直接注释掉整块）
        // ==========================================
        // const playlists = (await songloft.playlists.list()) ?? [];
        // debugResult.playlists = playlists;


        // ==========================================
        // 🟢 模块 3：查看系统配置（不需要时直接注释掉整块）
        // ==========================================
        // const hostUrl = await songloft.plugin.getHostUrl();
        // const token = await songloft.plugin.getToken();
        // const targetUrl = `${hostUrl}/api/v1/configs?limit=100`; // 想查单个配置就把这里改成具体 Key
        // const res = await fetch(targetUrl, {
        //         method: 'GET',
        //         headers: {
        //             'Authorization': `Bearer ${token}`,
        //             'Content-Type': 'application/json'
        //         }
        //     });
        // debugResult.configs = await res.json();

        // =============================================

        // const res = await fetch(`${hostUrl}/api/v1/configs/scan_auto_create_include_subdirs`, {
        //   method: 'GET',
        //   headers: {
        //     'Authorization': `Bearer ${token}`,
        //     'Content-Type': 'application/json'
        //   }
        // });
        // const configDetail = res.ok ? await res.json() : { value: "false" };
        // debugResult.ttt = configDetail.value

        // ==========================================
        // 🌟 把最新捕获的探子死因放进托盘输出
        // ==========================================
        //debugResult.lastProbeError = lastSystemError;

        // ==========================================
        // 🌟 新增：把最新一次的【歌词刮削打分全过程】放进托盘！
        // ==========================================
        //debugResult.lastScrapeLog = getLastScrapeLog() || "暂无刮削记录，请先在前端播放一首没有本地歌词的歌";

        // ==========================================
        // 📤 最终输出：把托盘里收集到的所有数据一把推给浏览器
        // ==========================================
        return jsonResponse(debugResult);

    } catch (error) {
        // 兜底：如果上面某行代码写残了，也不会白屏，而是告诉你哪里崩了
        return jsonResponse({ error: "Debug接口发生崩溃: " + String(error) });
    }
});



// ==== 核心生命周期函数 ====
function onInit(): void {
    songloft.log.info('iWebPlayer-S 原生架构已就绪！');

    // 👇 新增：注册 P2P 双子星监听器，接收 miot-helper 的数据
    songloft.comm.onMessage("sync_webdav_data", async (payload: any, from) => {
        // 只认自家兄弟，防伪造
        if (from !== TWIN_PLUGIN_ID) return;

        try {
            if (payload.type === 'config') {
                // 同步配置 (如默认节点、根目录)
                await storageSetString(payload.key, typeof payload.value === 'string' ? payload.value : JSON.stringify(payload.value ?? ''));
                songloft.log.info(`📥 镜像同步配置成功: ${payload.key}`);
            }
            else if (payload.type === 'library' && payload.davId) {
                // 同步扫库结果 (将对象转成字符串存入)
                const cacheKey = `webdav_lib_${payload.davId}`;
                const cacheVal = JSON.stringify(payload.library);
                await storageSetString(cacheKey, cacheVal);
                songloft.log.info(`📥 镜像同步曲库成功: ${payload.davId}`);
            }
        } catch (e) {
            songloft.log.error(`❌ 同步数据写入失败: ${e}`);
        }
    });
}
function onDeinit(): void {}
function onHTTPRequest(req: HTTPRequest): HTTPResponse | Promise<HTTPResponse> { return router.handle(req); }

globalThis.onInit = onInit;
globalThis.onDeinit = onDeinit;
globalThis.onHTTPRequest = onHTTPRequest;
