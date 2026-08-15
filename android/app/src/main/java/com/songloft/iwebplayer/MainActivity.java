package com.songloft.iwebplayer;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.app.Dialog;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;

public class MainActivity extends AppCompatActivity {

    private static final String PREFS = "iwebplayer_prefs";
    private static final String KEY_SERVER = "server_url";
    private static final String PLUGIN_PATH = "api/v1/jsplugin/iwebplayer-s/static/index.html";
    private static final long TOKEN_CHECK_INTERVAL_MS = 2000L;
    private static final int REQ_NOTIFICATION = 1001;

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
        requestNotificationPermissionIfNeeded();
        handler.post(tokenChecker);
    }

    /**
     * Android 13+ 需要运行时授予通知权限，WebView 的媒体通知（锁屏/通知栏播放信息）才会显示。
     */
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
                            showLoginPrompt();
                        }
                    }
                });
    }

    /**
     * 自定义登录引导弹窗（与 App 深色玻璃风格保持一致）。
     */
    private void showLoginPrompt() {
        Dialog dialog = new Dialog(this);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        dialog.setContentView(R.layout.dialog_login_prompt);
        dialog.setCancelable(true);
        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawable(
                    new android.graphics.drawable.ColorDrawable(android.graphics.Color.TRANSPARENT));
        }
        dialog.findViewById(R.id.btn_login_go).setOnClickListener(v -> {
            dialog.dismiss();
            webView.loadUrl(getServerBase());
        });
        dialog.findViewById(R.id.btn_login_later).setOnClickListener(v -> dialog.dismiss());
        dialog.show();
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
