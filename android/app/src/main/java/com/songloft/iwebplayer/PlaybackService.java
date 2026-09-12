package com.songloft.iwebplayer;

import android.app.Notification;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.IBinder;
import android.util.Log;

import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.ServiceCompat;

/**
 * 播放前台服务。
 *
 * <p>目的：播放期间让本进程停留在「前台服务」状态，不进入 cached 进程队列，
 * 从而避免 Android 12+ 的 Cached Apps Freezer 冻结进程（冻结会让 WebView 里的
 * JavaScript 停止执行）。网页端的「播完自动接下一首」完全由 JS 驱动，
 * 一旦 JS 被冻结，就会出现「后台播完一首就停、重新打开 App 又继续」的现象。</p>
 *
 * <p>通知本身仍由 {@link MainActivity} 构建（含 MediaStyle / MediaSession / 封面），
 * 这里只负责把它提升为前台服务通知并维护前台状态。</p>
 */
public class PlaybackService extends Service {

    private static final String TAG = "iWebPlayer-S";

    /** 与 MainActivity 共用同一个通知 id，避免出现两条媒体通知 */
    public static final int NOTIFICATION_ID = 1002;

    private static final String ACTION_START = "com.songloft.iwebplayer.PLAYBACK_START";
    private static final String ACTION_STOP = "com.songloft.iwebplayer.PLAYBACK_STOP";

    /** MainActivity 构建好的通知，通过静态引用交给服务（不跨进程，仅同进程内传递） */
    private static Notification pendingNotification;
    private static boolean running = false;

    /**
     * 播放中调用：首次把服务提升为前台，之后只刷新通知。
     *
     * <p>已在运行时刻意不再调用 {@code startForegroundService}——后台（例如后台自动切歌）
     * 再次启动前台服务会被 Android 12+ 的 FGS 后台启动限制拒绝，而服务本来就还在前台，
     * 直接更新通知即可。</p>
     */
    public static void startOrUpdate(Context context, Notification notification) {
        pendingNotification = notification;
        if (running) {
            NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification);
            return;
        }
        Intent intent = new Intent(context, PlaybackService.class).setAction(ACTION_START);
        try {
            context.startForegroundService(intent);
        } catch (Exception e) {
            Log.w(TAG, "启动播放前台服务失败（可能被后台启动限制拒绝）: " + e);
        }
    }

    /** 暂停/停止播放后调用：退出前台并结束服务（普通通知由 MainActivity 继续维护） */
    public static void stop(Context context) {
        if (!running) return;
        Intent intent = new Intent(context, PlaybackService.class).setAction(ACTION_STOP);
        try {
            // 服务已在前台运行，startService 不受后台启动限制
            context.startService(intent);
        } catch (Exception e) {
            Log.w(TAG, "停止播放前台服务失败: " + e);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();

        if (ACTION_STOP.equals(action)) {
            running = false;
            ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
            stopSelf();
            return START_NOT_STICKY;
        }

        Notification notification = pendingNotification;
        if (notification == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        try {
            startForeground(NOTIFICATION_ID, notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            running = true;
        } catch (Exception e) {
            // 权限缺失或系统拒绝时不要让服务悬挂，也不要崩溃
            Log.w(TAG, "进入前台服务失败: " + e);
            running = false;
            stopSelf();
        }
        return START_NOT_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        running = false;
        super.onDestroy();
    }
}
