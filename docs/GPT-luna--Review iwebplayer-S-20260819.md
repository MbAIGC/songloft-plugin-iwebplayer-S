# iWebPlayer-S Review

审查日期：2026-08-19

## Review Findings

### 1. P1：`/debug` 默认公开并返回全库歌曲数据

位置：[src/main.ts](src/main.ts:355)

`/debug` 路由没有鉴权或环境开关，并且当前直接执行：

```ts
const rawSongs = await songloft.songs.list({ limit: 10000 });
debugResult.songs = rawSongs;
```

任何能访问插件接口的用户都可以读取最多 10000 首歌曲的元数据，可能包括 `file_path`、远程地址等信息。应在生产构建中移除该路由，或至少增加显式 debug 开关和权限校验。

### 2. P1：PWA manifest 路径错误，安装能力会失效

位置：[static/index.html](static/index.html:10)

页面本身位于 `.../iwebplayer-s/static/index.html`，但 manifest 使用：

```html
<link rel="manifest" href="./static/manifest.json">
```

浏览器会请求 `.../iwebplayer-s/static/static/manifest.json`，而实际文件是 `.../iwebplayer-s/static/manifest.json`。因此 manifest 大概率返回 404，`beforeinstallprompt` 不会触发。

此外，manifest 中的 `start_url` 和 `scope` 是 `"../"`，而页面注册的 Service Worker 是 `./sw.js`，scope 仅覆盖 `static/`，三者仍然不一致。应统一 manifest、页面路径和 Service Worker scope。

### 3. P1：多处 `innerHTML` 直接插入外部或用户可控文本，存在 XSS

代表位置：

- [static/playlist.js](static/playlist.js:1187)：歌曲名
- [static/playlist.js](static/playlist.js:936)：歌单名
- [static/online.js](static/online.js:548)：在线歌单名、作者名、封面 URL
- [static/lyrics.js](static/lyrics.js:50)：歌词文本
- [static/utils.js](static/utils.js:163)：Toast 内容

本地文件名、在线 API 返回值和用户创建的歌单名都可能进入这些路径。恶意歌曲名例如：

```text
</div><img src=x onerror=alert(1)>
```

可能在播放器页面执行脚本。应对文本统一使用 `textContent`，HTML 模板中的动态值至少进行 HTML 转义；URL 属性也应校验协议并通过 DOM 属性赋值。

### 4. P1：WebDAV 扫描错误处理本身可能再次抛错，导致扫描失败

位置：[src/webdav.ts](src/webdav.ts:102)

其他源码统一使用 `songloft.log`，但这里使用了：

```ts
songloft.logger.error(...)
```

如果 SDK 运行时没有 `logger` 别名，目录请求失败时，catch 块会因为 `songloft.logger` 未定义再次抛错，最终扫描状态可能直接进入 `failed`，并掩盖真正的网络错误。应改为 `songloft.log.error(...)`。

同文件还直接使用 `songloft.storage.get/set`，而 [src/main.ts](src/main.ts:214) 已经表明运行环境可能只提供 `getItem/setItem`。WebDAV 路由应复用统一的兼容封装，否则不同宿主版本下会出现扫描成功但无法读写缓存的问题。

### 5. P1：播放链接先用 HEAD 探测，会误判支持 GET 但不支持 HEAD 的资源

位置：[src/main.ts](src/main.ts:182)

`/musicinfo` 使用 `HEAD` 请求判断音频是否可用：

```js
fetch(fullUrl, { method: 'HEAD' })
```

部分 CDN、代理或媒体服务只实现 GET，HEAD 可能返回 405、403 或不带正确响应头。此时实际可播放的歌曲会被返回为“音频链接已失效”，前端随后可能将歌曲标记为 dead。建议优先使用带极小读取范围的 GET，或只对明确的 404/403 进行失效判定。

### 6. P2：音量设置仍未写入 `iwebplayer-s.player_volume`

位置：[static/index.html](static/index.html:3126)

初始化从 localStorage 读取：

```js
localStorage.getItem('iwebplayer-s.player_volume')
```

但拖动时只写入：

```js
window.ConfigManager.set('config', 'player_state.volume', parseInt(vol));
```

`miot.js` 切回本机时又只读取 `iwebplayer-s.player_volume`，因此两套存储不会同步。刷新页面或切换设备后，音量可能恢复到旧值/默认值。应统一使用一个存储来源，或在 input/change 时同步写入 localStorage。

### 7. P2：删除歌曲采用乐观更新，失败后不会恢复 UI

位置：[static/playlist.js](static/playlist.js:53)

当前流程先从 `window.songList` 删除并重新渲染，再调用后端 DELETE：

```js
window.songList.splice(index, 1);
window.renderPlaylist();
await fetch(..., { method: 'DELETE' });
```

没有检查 `fetch` 的 HTTP 状态，也没有失败回滚。网络错误或权限拒绝后，界面会显示歌曲已移除，但后端仍保留该歌曲，直到下一次全量刷新才恢复。应等待删除成功后再更新，或保存原数组并在失败时恢复。

### 8. P2：在线分页条件与请求大小不一致，可能多发空请求

位置：[static/online.js](src/online.js:149)

搜索请求 `page_size` 为 30，但 `hasMore` 使用：

```js
resJson.data.list.length >= 20
```

当最后一页返回 20 到 29 条时，会错误地认为还有下一页，触发额外请求。歌单搜索也存在同样问题。应使用实际请求大小 30，或者优先使用后端返回的明确分页字段。

## 验证情况

检查范围包括当前源码、未提交改动、相关前端调用和已有 `ds-review.md`。没有修改实现文件。

当前工作树存在未提交的 `MainActivity.java`、`static/index.html` 以及两个未跟踪文档；上面的 manifest、debug、XSS、WebDAV 和音量问题在当前内容中仍然成立。

未执行完整构建或端到端浏览器测试。
