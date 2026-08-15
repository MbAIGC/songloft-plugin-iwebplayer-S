package com.songloft.iwebplayer;

import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private static final String PREFS = "iwebplayer_prefs";
    private static final String KEY_SERVER = "server_url";
    private static final String PLUGIN_PATH = "api/v1/jsplugin/iwebplayer-s/static/index.html";
    private static final long TOKEN_CHECK_INTERVAL_MS = 2000L;

    private WebView webView;
    private SharedPreferences prefs;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean loginPromptShown = false;
    private boolean wasLoggedOut = false;

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
        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
            getWindow().setStatusBarColor(android.graphics.Color.TRANSPARENT);
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        }

        webView = new WebView(this);
        setContentView(webView);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()
                        && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                        && !request.getUrl().toString().contains("settings.html")) {
                    Toast.makeText(MainActivity.this, "无法连接服务器，请检查地址后重试", Toast.LENGTH_LONG).show();
                    view.loadUrl("file:///android_asset/settings.html");
                }
            }
        });

        webView.addJavascriptInterface(new Bridge(), "Android");

        String server = prefs.getString(KEY_SERVER, "").trim();
        if (server.isEmpty()) {
            webView.loadUrl("file:///android_asset/settings.html");
        } else {
            openPlayer(server);
        }
        handler.post(tokenChecker);
    }

    private void openPlayer(String server) {
        String base = server.endsWith("/") ? server : server + "/";
        webView.loadUrl(base + PLUGIN_PATH);
    }

    private String getServerBase() {
        String server = prefs.getString(KEY_SERVER, "").trim();
        return server.endsWith("/") ? server : server + "/";
    }

    /**
     * 轮询检查 SongLoft 登录态（localStorage 里的 songloft-auth accessToken）。
     * 未登录：播放器页会显示"令牌失效"，此时引导用户去服务器根路径登录；
     * 登录成功后：自动跳回播放器页。
     */
    private void checkAuthAndMaybePrompt() {
        String url = webView.getUrl() == null ? "" : webView.getUrl();
        if (url.startsWith("file:")) return;
        if (!url.startsWith(getServerBase()) && !url.contains(PLUGIN_PATH)) return;

        webView.evaluateJavascript(
                "(function(){try{var a=JSON.parse(localStorage.getItem('songloft-auth')||'{}');" +
                        "return (a && a.accessToken) ? 'ok' : 'none';}catch(e){return 'none';}})()",
                value -> {
                    String result = value == null ? "" : value.replace("\"", "");
                    String current = webView.getUrl() == null ? "" : webView.getUrl();

                    if ("ok".equals(result)) {
                        // 登录成功：如果之前在别处（如服务器首页/登录页），自动回到播放器页
                        if (wasLoggedOut && !current.contains(PLUGIN_PATH)) {
                            openPlayer(prefs.getString(KEY_SERVER, ""));
                        }
                        wasLoggedOut = false;
                        loginPromptShown = false;
                    } else {
                        wasLoggedOut = true;
                        if (current.contains(PLUGIN_PATH) && !loginPromptShown) {
                            loginPromptShown = true; // 每个"未登录会话"只弹一次，避免反复打扰
                            new AlertDialog.Builder(MainActivity.this)
                                    .setTitle("需要登录")
                                    .setMessage("打开播放器前需要先登录 SongLoft 服务器，是否前往登录页？")
                                    .setPositiveButton("去登录", (d, w) -> webView.loadUrl(getServerBase()))
                                    .setNegativeButton("取消", (d, w) -> { /* 保留插件页自带的引导 */ })
                                    .show();
                        }
                    }
                });
    }

    private class Bridge {
        @JavascriptInterface
        public String getServer() {
            return prefs.getString(KEY_SERVER, "");
        }

        @JavascriptInterface
        public void saveServer(String url) {
            String cleaned = (url == null ? "" : url.trim());
            if (!cleaned.isEmpty() && !cleaned.startsWith("http://") && !cleaned.startsWith("https://")) {
                cleaned = "http://" + cleaned;
            }
            prefs.edit().putString(KEY_SERVER, cleaned).apply();
        }

        @JavascriptInterface
        public void openPlayer() {
            runOnUiThread(() -> {
                String server = prefs.getString(KEY_SERVER, "").trim();
                if (server.isEmpty()) {
                    Toast.makeText(MainActivity.this, "请先保存服务器地址", Toast.LENGTH_SHORT).show();
                } else {
                    MainActivity.this.openPlayer(server);
                }
            });
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
                    .setPositiveButton("修改服务器", (d, w) -> webView.loadUrl("file:///android_asset/settings.html"))
                    .setNegativeButton("退出", (d, w) -> finish())
                    .show();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacks(tokenChecker);
        super.onDestroy();
    }
}
