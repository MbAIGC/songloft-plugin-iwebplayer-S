package com.songloft.iwebplayer;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.net.Uri;
import android.os.Message;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.ValueCallback;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class MainActivity extends AppCompatActivity {

    private static final String PREFS = "iwebplayer_prefs";
    private static final String KEY_SERVER = "server_url";
    private static final String KEY_USERNAME = "username";
    private static final String KEY_TOKEN = "access_token";
    private static final String KEY_REFRESH = "refresh_token";
    private static final String KEY_EXPIRES = "token_expires_at";
    private static final String PLUGIN_PATH = "api/v1/jsplugin/iwebplayer-s/static/index.html";
    private static final String SETTINGS_URL = "file:///android_asset/settings.html";
    private static final long TOKEN_CHECK_INTERVAL_MS = 3000L;
    private static final int REQ_NOTIFICATION = 1001;
    private static final int NOTIF_MEDIA = 1002;
    private static final int REQ_FILE_CHOOSER = 1003;
    private static final String CHANNEL_PLAYBACK = "playback";

    public static MainActivity instance;

    private WebView webView;
    private SharedPreferences prefs;
    private MediaSessionCompat mediaSession;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean wasLoggedOut = false;
    private boolean authRefreshing = false;
    private String cachedArtworkUrl = "";
    private Bitmap cachedArtwork = null;
    private ValueCallback<String[]> filePathCallback = null;

    private final Runnable tokenChecker = new Runnable() {
        @Override
        public void run() {
            checkAuthAndMaybePrompt();
            handler.postDelayed(this, TOKEN_CHECK_INTERVAL_MS);
        }
    };

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        instance = this;
        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
            getWindow().setStatusBarColor(Color.TRANSPARENT);
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        }

        setupMediaSession();
        createPlaybackChannel();

        webView = new WebView(this);
        setContentView(webView);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        // 🌟 关键：禁用 HTTP 缓存，保证服务器更新插件后 App 立即拿到最新页面
        // （否则 WebView 会一直显示旧的 index.html/CSS）
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);

        // 🌟 显式声明 WebView 明暗策略，避免 ROM/WebView 在系统日间时误判深色：
        // 系统夜间 → 允许暗化（页面跟随系统）；系统日间 → 强制浅色（修正误判）。
        // 插件页面内 data-theme 负责手动深浅切换，此处只保证 WebView 正确报告系统偏好。
        boolean systemDark = (getResources().getConfiguration().uiMode
                & android.content.res.Configuration.UI_MODE_NIGHT_MASK)
                == android.content.res.Configuration.UI_MODE_NIGHT_YES;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            s.setForceDark(systemDark
                    ? WebSettings.FORCE_DARK_AUTO
                    : WebSettings.FORCE_DARK_OFF);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            s.setAlgorithmicDarkeningAllowed(systemDark);
        }

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                String base = getServerBase();
                if (!base.isEmpty() && url.startsWith(base)) {
                    injectAuthIntoPage();
                    injectMediaBridge();
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()
                        && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                        && !request.getUrl().toString().contains("settings.html")) {
                    Toast.makeText(MainActivity.this, "无法连接服务器，请检查地址后重试", Toast.LENGTH_LONG).show();
                    view.loadUrl(SETTINGS_URL);
                }
            }
        });

        // 让 target="_blank" 等外部链接用系统浏览器打开（App 内不新开 WebView 窗口）
        webView.getSettings().setSupportMultipleWindows(true);
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                WebView.HitTestResult result = view.getHitTestResult();
                String url = result != null ? result.getExtra() : null;
                if (url != null && !url.isEmpty()) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    } catch (Exception ignored) {
                    }
                }
                return true;
            }

            // 🌟 支持 <input type="file"> 文件选择（导入音源脚本等）
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<String[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }
                MainActivity.this.filePathCallback = filePathCallback;

                Intent intent = fileChooserParams.createIntent();
                if (fileChooserParams.getAcceptTypes() == null || fileChooserParams.getAcceptTypes().length == 0) {
                    intent.setType("*/*");
                }
                try {
                    startActivityForResult(intent, REQ_FILE_CHOOSER);
                } catch (Exception e) {
                    MainActivity.this.filePathCallback = null;
                    return false;
                }
                return true;
            }
        });

        webView.addJavascriptInterface(new Bridge(), "Android");
        webView.clearCache(true);

        String server = prefs.getString(KEY_SERVER, "").trim();
        if (server.isEmpty()) {
            webView.loadUrl(SETTINGS_URL);
        } else {
            openPlayer(server);
        }
        requestNotificationPermissionIfNeeded();
        handler.post(tokenChecker);
    }

    // ============================================================
    // 设置页直接登录
    // ============================================================

    private String normalizeServer(String server) {
        String s = server == null ? "" : server.trim();
        if (s.isEmpty()) return "";
        if (!s.startsWith("http://") && !s.startsWith("https://")) {
            s = "http://" + s;
        }
        while (s.endsWith("/")) {
            s = s.substring(0, s.length() - 1);
        }
        return s;
    }

    private String getServerBase() {
        String server = prefs.getString(KEY_SERVER, "").trim();
        if (server.isEmpty()) return "";
        return server.endsWith("/") ? server : server + "/";
    }

    private String doLogin(String server, String username, String password) {
        try {
            String base = normalizeServer(server);
            JSONObject body = new JSONObject();
            body.put("username", username);
            body.put("password", password);
            JSONObject res = postJson(base, "/api/v1/auth/login", body.toString());
            if (res == null) {
                return "{\"ok\":false,\"error\":\"无法连接服务器\"}";
            }
            if (res.has("error")) {
                return "{\"ok\":false,\"error\":" + JSONObject.quote(res.optString("error")) + "}";
            }
            String token = res.optString("access_token");
            if (token.isEmpty()) {
                return "{\"ok\":false,\"error\":\"服务器未返回访问令牌\"}";
            }
            prefs.edit()
                    .putString(KEY_SERVER, base)
                    .putString(KEY_USERNAME, username)
                    .putString(KEY_TOKEN, token)
                    .putString(KEY_REFRESH, res.optString("refresh_token"))
                    .putLong(KEY_EXPIRES, System.currentTimeMillis() + res.optLong("expires_in", 604800) * 1000)
                    .apply();
            return "{\"ok\":true}";
        } catch (Exception e) {
            return "{\"ok\":false,\"error\":\"登录请求异常\"}";
        }
    }

    private boolean tryRefreshToken() {
        String server = prefs.getString(KEY_SERVER, "").trim();
        String refresh = prefs.getString(KEY_REFRESH, "").trim();
        if (server.isEmpty() || refresh.isEmpty()) return false;
        try {
            JSONObject body = new JSONObject();
            body.put("refresh_token", refresh);
            JSONObject res = postJson(server, "/api/v1/auth/refresh", body.toString());
            if (res == null || res.has("error")) return false;
            String token = res.optString("access_token");
            if (token.isEmpty()) return false;
            prefs.edit()
                    .putString(KEY_TOKEN, token)
                    .putString(KEY_REFRESH, res.optString("refresh_token", refresh))
                    .putLong(KEY_EXPIRES, System.currentTimeMillis() + res.optLong("expires_in", 604800) * 1000)
                    .apply();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private JSONObject postJson(String base, String path, String jsonBody) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(base + path);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(15000);
            conn.setDoOutput(true);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(jsonBody.getBytes(StandardCharsets.UTF_8));
            }
            int code = conn.getResponseCode();
            InputStream is = code >= 200 && code < 300 ? conn.getInputStream() : conn.getErrorStream();
            String text = "";
            if (is != null) {
                try (BufferedReader br = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = br.readLine()) != null) sb.append(line);
                    text = sb.toString();
                }
            }
            if (!text.isEmpty()) {
                return new JSONObject(text);
            }
            if (code >= 200 && code < 300) {
                return new JSONObject();
            }
        } catch (Exception ignored) {
        } finally {
            if (conn != null) conn.disconnect();
        }
        return null;
    }

    // ============================================================
    // 播放器页与 token 注入
    // ============================================================

    private void openPlayer(String server) {
        String base = server.endsWith("/") ? server : server + "/";
        final long expiresAt = prefs.getLong(KEY_EXPIRES, 0);
        if (expiresAt > 0 && System.currentTimeMillis() > expiresAt - 5 * 60 * 1000) {
            // 令牌临近过期时后台刷新，避免阻塞 UI 线程
            new Thread(() -> {
                tryRefreshToken();
                runOnUiThread(() -> webView.loadUrl(base + PLUGIN_PATH));
            }).start();
        } else {
            webView.loadUrl(base + PLUGIN_PATH);
        }
    }

    private void injectAuthIntoPage() {
        String token = prefs.getString(KEY_TOKEN, "").trim();
        if (token.isEmpty()) return;
        String escaped = token.replace("\\", "\\\\").replace("'", "\\'");
        webView.evaluateJavascript(
                "(function(){var had=!!localStorage.getItem('songloft-auth');" +
                        "localStorage.setItem('songloft-auth',JSON.stringify({accessToken:'" + escaped + "'}));" +
                        "if(!had){setTimeout(function(){location.reload();},80);}})()",
                null);
    }

    private void handleAuthFailed() {
        if (authRefreshing) return;
        authRefreshing = true;
        new Thread(() -> {
            boolean ok = tryRefreshToken();
            runOnUiThread(() -> {
                authRefreshing = false;
                if (ok) {
                    injectAuthIntoPage();
                    webView.reload();
                } else {
                    prefs.edit()
                            .remove(KEY_TOKEN)
                            .remove(KEY_REFRESH)
                            .remove(KEY_EXPIRES)
                            .apply();
                    Toast.makeText(this, "登录已过期，请重新登录", Toast.LENGTH_LONG).show();
                    webView.loadUrl(SETTINGS_URL);
                }
            });
        }).start();
    }

    // ============================================================
    // 媒体桥接：锁屏/通知栏播放信息与控制
    // ============================================================

    private void setupMediaSession() {
        mediaSession = new MediaSessionCompat(this, "iWebPlayer");
        mediaSession.setFlags(MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS
                | MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS);
        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() {
                runJs("(function(){var a=document.getElementById('audio');if(a&&a.paused)a.play().catch(function(){})})()");
            }

            @Override
            public void onPause() {
                runJs("(function(){var a=document.getElementById('audio');if(a&&!a.paused)a.pause()})()");
            }

            @Override
            public void onSkipToNext() {
                runJs("(function(){var b=document.getElementById('btn-next');if(b)b.click()})()");
            }

            @Override
            public void onSkipToPrevious() {
                runJs("(function(){var b=document.getElementById('btn-prev');if(b)b.click()})()");
            }

            @Override
            public void onSeekTo(long posMs) {
                runJs("(function(){var a=document.getElementById('audio');if(a&&a.duration)a.currentTime="
                        + (posMs / 1000.0) + "})()");
            }
        });
    }

    private void createPlaybackChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_PLAYBACK, "播放控制", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("锁屏与通知栏的播放控制");
            channel.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    private void updateMediaNotification(String json) {
        try {
            JSONObject o = new JSONObject(json);
            String title = o.optString("title");
            String artist = o.optString("artist");
            String artwork = o.optString("artwork");
            boolean playing = o.optBoolean("playing");
            long positionMs = (long) (o.optDouble("position", 0) * 1000);
            long durationMs = (long) (o.optDouble("duration", 0) * 1000);
            if (title.isEmpty()) title = "iWebPlayer-S";

            PlaybackStateCompat.Builder psb = new PlaybackStateCompat.Builder()
                    .setActions(PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE
                            | PlaybackStateCompat.ACTION_PLAY_PAUSE | PlaybackStateCompat.ACTION_SKIP_TO_NEXT
                            | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS | PlaybackStateCompat.ACTION_SEEK_TO)
                    .setState(playing ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED,
                            positionMs, 1.0f);
            mediaSession.setPlaybackState(psb.build());
            if (playing) mediaSession.setActive(true);

            MediaMetadataCompat.Builder mb = new MediaMetadataCompat.Builder()
                    .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
                    .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist);
            if (durationMs > 0) {
                // 关键：通知栏/锁屏的时长显示与进度条由系统根据
                // MediaMetadata.DURATION + PlaybackState.position 渲染，必须设置总时长
                mb.putLong(MediaMetadataCompat.METADATA_KEY_DURATION, durationMs);
            }
            NotificationCompat.Builder nb = buildMediaNotification(title, artist, playing, positionMs, durationMs);
            android.util.Log.d("iWebPlayer-S", "media update: title=" + title
                    + " durMs=" + durationMs + " posMs=" + positionMs + " playing=" + playing);

            if (!artwork.isEmpty() && !artwork.equals(cachedArtworkUrl)) {
                cachedArtworkUrl = artwork;
                cachedArtwork = null;
                loadArtwork(artwork, bitmap -> {
                    cachedArtwork = bitmap;
                    if (bitmap != null) {
                        mb.putBitmap(MediaMetadataCompat.METADATA_KEY_ART, bitmap);
                        nb.setLargeIcon(bitmap);
                    }
                    mediaSession.setMetadata(mb.build());
                    postMediaNotification(nb);
                });
            } else {
                if (cachedArtwork != null) {
                    mb.putBitmap(MediaMetadataCompat.METADATA_KEY_ART, cachedArtwork);
                    nb.setLargeIcon(cachedArtwork);
                }
                mediaSession.setMetadata(mb.build());
                postMediaNotification(nb);
            }
        } catch (Exception ignored) {
        }
    }

    private NotificationCompat.Builder buildMediaNotification(String title, String artist,
                                                              boolean playing, long positionMs, long durationMs) {
        Intent contentIntent = new Intent(this, MainActivity.class);
        PendingIntent contentPi = PendingIntent.getActivity(this, 0, contentIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder nb = new NotificationCompat.Builder(this, CHANNEL_PLAYBACK)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title)
                .setContentText(artist.isEmpty() ? "iWebPlayer-S" : artist)
                .setContentIntent(contentPi)
                .setOngoing(playing)
                .setOnlyAlertOnce(true)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setStyle(new androidx.media.app.NotificationCompat.MediaStyle()
                        .setMediaSession(mediaSession.getSessionToken())
                        .setShowActionsInCompactView(0, 1, 2))
                .addAction(mediaAction("prev", "上一首"))
                .addAction(mediaAction(playing ? "pause" : "play", playing ? "暂停" : "播放"))
                .addAction(mediaAction("next", "下一首"));
        if (durationMs > 0) {
            nb.setProgress((int) (durationMs / 1000), (int) (positionMs / 1000), false);
        }
        return nb;
    }

    private NotificationCompat.Action mediaAction(String action, String label) {
        Intent intent = new Intent(this, MediaReceiver.class).setAction(action);
        PendingIntent pi = PendingIntent.getBroadcast(this, action.hashCode(), intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Action.Builder(R.drawable.ic_notification, label, pi).build();
    }

    private void postMediaNotification(NotificationCompat.Builder nb) {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        try {
            NotificationManagerCompat.from(this).notify(NOTIF_MEDIA, nb.build());
        } catch (Exception ignored) {
        }
    }

    private void loadArtwork(final String url, final ArtworkCallback cb) {
        new Thread(() -> {
            Bitmap bmp = null;
            try {
                HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setConnectTimeout(8000);
                conn.setReadTimeout(8000);
                conn.setInstanceFollowRedirects(true);
                try (InputStream is = conn.getInputStream()) {
                    bmp = BitmapFactory.decodeStream(is);
                }
                conn.disconnect();
            } catch (Exception ignored) {
            }
            final Bitmap result = bmp;
            runOnUiThread(() -> cb.onResult(result));
        }).start();
    }

    private interface ArtworkCallback {
        void onResult(Bitmap bitmap);
    }

    private void injectMediaBridge() {
        String js = """
                (function(){
                  if (window.__androidMediaInjected) return;
                  window.__androidMediaInjected = true;
                  function parseTime(t){
                    if (!t) return 0;
                    var m = /(\\d+):(\\d{2})/.exec(String(t));
                    if (!m) return 0;
                    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
                  }
                  function readState(){
                    var a = document.getElementById('audio');
                    if (!a) return null;
                    var t = '', artist = '';
                    var nt = document.querySelector('.np-title-text');
                    if (nt) t = (nt.textContent || '').trim();
                    var idx = t.lastIndexOf(' - ');
                    if (idx > 0) { artist = t.substring(idx + 3).trim(); t = t.substring(0, idx).trim(); }
                    var art = '';
                    var c = document.getElementById('fp-cover');
                    if (c && c.src && c.src.indexOf('data:') !== 0) art = c.src;
                    if (!art) { var m = document.getElementById('mini-cover-img'); if (m && m.src && m.src.indexOf('data:') !== 0) art = m.src; }
                    var pos = a.currentTime;
                    if (!isFinite(pos) || pos < 0) {
                    pos = parseTime(document.getElementById('time-current') ? (document.getElementById('time-current').textContent || '') : '');
                    }
                    var dur = a.duration;
                    if (!isFinite(dur) || dur <= 0) {
                      dur = parseTime(document.getElementById('time-duration') ? (document.getElementById('time-duration').textContent || '') : '');
                    }
                    if (dur < 0) dur = 0;
                    return {title: t, artist: artist, artwork: art, playing: !a.paused, position: pos, duration: dur};
                  }
                  function push(){
                    var st = readState();
                    if (st && window.Android) window.Android.onMedia(JSON.stringify(st));
                  }
                  setInterval(push, 1000);
                  var audio = document.getElementById('audio');
                  if (audio) {
                    ['play','pause','ended','loadedmetadata','durationchange','timeupdate'].forEach(function(ev){ audio.addEventListener(ev, push); });
                  }
                  push();
                  function checkAuth(){
                    var body = document.body ? (document.body.innerText || '') : '';
                    if (body.indexOf('登录状态已失效') >= 0 || body.indexOf('访问令牌已失效') >= 0) {
                      if (window.Android) window.Android.onAuthFailed();
                    }
                  }
                  setInterval(checkAuth, 2500);
                })();
                """;
        webView.evaluateJavascript(js, null);
    }

    // ============================================================
    // 登录态检查与引导
    // ============================================================

    private void checkAuthAndMaybePrompt() {
        String url = webView.getUrl() == null ? "" : webView.getUrl();
        if (url.startsWith("file:")) return;
        String base = getServerBase();
        if (base.isEmpty()) return;
        if (!url.startsWith(base) && !url.contains(PLUGIN_PATH)) return;

        webView.evaluateJavascript(
                "(function(){try{var a=JSON.parse(localStorage.getItem('songloft-auth')||'{}');" +
                        "return (a && a.accessToken) ? 'ok' : 'none';}catch(e){return 'none';}})()",
                value -> {
                    String result = value == null ? "" : value.replace("\"", "");
                    String current = webView.getUrl() == null ? "" : webView.getUrl();

                    if ("ok".equals(result)) {
                        if (wasLoggedOut && !current.contains(PLUGIN_PATH)) {
                            openPlayer(prefs.getString(KEY_SERVER, ""));
                        }
                        wasLoggedOut = false;
                    } else if ("none".equals(result)) {
                        // 仅在页面明确处于未登录态时记录；真正的登录引导由
                        // 页面内检测（onAuthFailed）+ 设置页登录完成，
                        // 不再弹原生"需要登录"弹窗，避免启动竞态误弹
                        wasLoggedOut = true;
                    }
                });
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIFICATION);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_NOTIFICATION) {
            boolean granted = grantResults.length > 0
                    && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            if (!granted) {
                Toast.makeText(this, "未授予通知权限，锁屏/通知栏将无法显示播放信息", Toast.LENGTH_LONG).show();
            }
        }
    }

    public void runJs(String js) {
        runOnUiThread(() -> {
            if (webView != null) webView.evaluateJavascript(js, null);
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_FILE_CHOOSER) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                Uri uri = data.getData();
                if (filePathCallback != null) {
                    // WebView 期望收到 file:// URI（通过回调写回触发 <input type="file"> 的 change 事件）
                    filePathCallback.onReceiveValue(new String[]{ uri.toString() });
                }
            } else if (filePathCallback != null) {
                // 用户取消选择
                filePathCallback.onReceiveValue(null);
            }
            filePathCallback = null;
        }
    }

    private class Bridge {
        @JavascriptInterface
        public String getServer() {
            return prefs.getString(KEY_SERVER, "");
        }

        @JavascriptInterface
        public String getUsername() {
            return prefs.getString(KEY_USERNAME, "");
        }

        @JavascriptInterface
        public void login(String server, String username, String password, int callbackId) {
            new Thread(() -> {
                String result = doLogin(server, username, password);
                runOnUiThread(() -> {
                    if (webView != null) {
                        webView.evaluateJavascript(
                                "window.__loginCb && window.__loginCb(" + callbackId + ", " + result + ")", null);
                    }
                });
            }).start();
        }

        @JavascriptInterface
        public void openPlayer() {
            runOnUiThread(() -> {
                String server = prefs.getString(KEY_SERVER, "").trim();
                if (server.isEmpty()) {
                    Toast.makeText(MainActivity.this, "请先登录服务器", Toast.LENGTH_SHORT).show();
                } else {
                    MainActivity.this.openPlayer(server);
                }
            });
        }

        @JavascriptInterface
        public void onMedia(String json) {
            android.util.Log.d("iWebPlayer-S", "onMedia raw: " + json);
            runOnUiThread(() -> updateMediaNotification(json));
        }

        @JavascriptInterface
        public void onAuthFailed() {
            runOnUiThread(MainActivity.this::handleAuthFailed);
        }
    }

    @Override
    public void onBackPressed() {
        String url = webView.getUrl() == null ? "" : webView.getUrl();
        boolean onPlayer = url.contains(PLUGIN_PATH);

        if (webView.canGoBack()) {
            webView.goBack();
        } else if (onPlayer) {
            new AlertDialog.Builder(this)
                    .setTitle("iWebPlayer-S")
                    .setMessage("要修改服务器地址吗？")
                    .setPositiveButton("修改服务器", (d, w) -> webView.loadUrl(SETTINGS_URL))
                    .setNegativeButton("退出", (d, w) -> finish())
                    .show();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacks(tokenChecker);
        if (mediaSession != null) {
            mediaSession.release();
            mediaSession = null;
        }
        try {
            NotificationManagerCompat.from(this).cancel(NOTIF_MEDIA);
        } catch (Exception ignored) {
        }
        instance = null;
        super.onDestroy();
    }
}
