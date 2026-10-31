package moe.crafty.matrix;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;

/**
 * Foreground service held while a direct file transfer runs, so it carries on
 * with the app in the background or the screen off. The transfer runs in the
 * page, and Android freezes a backgrounded renderer within seconds without this.
 *
 * Typed dataSync, which Android 15+ limits to 6 hours a day: {@link #onTimeout}
 * stops it then, and a transfer still going continues only on screen.
 */
public class FileTransferService extends Service {

    private static final String CHANNEL_ID = "matrix_file_transfer";
    private static final String CHANNEL_NAME = "File transfers";
    private static final int NOTIFICATION_ID = 0x0F11E;
    private static final long WAKE_LOCK_TIMEOUT_MS = 6L * 60L * 60L * 1000L;

    /** Transfers running. Several share the one service. */
    private static int holds = 0;

    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;

    static synchronized void hold(Context context) {
        ContextCompat.startForegroundService(context, new Intent(context, FileTransferService.class));
        holds++;
    }

    static synchronized void release(Context context) {
        if (holds > 0) holds--;
        if (holds == 0) context.stopService(new Intent(context, FileTransferService.class));
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                ? ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                : 0;
        try {
            ServiceCompat.startForeground(this, NOTIFICATION_ID, buildNotification(), type);
        } catch (Throwable t) {
            stopSelf();
            return START_NOT_STICKY;
        }
        acquireLocks();
        // NOT sticky: the transfer dies with the process, so a restart would
        // only show a stale notification.
        return START_NOT_STICKY;
    }

    @Override
    public void onTimeout(int startId, int fgsType) {
        stopSelf();
    }

    @Override
    public void onDestroy() {
        releaseLocks();
        super.onDestroy();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        stopSelf();
        super.onTaskRemoved(rootIntent);
    }

    private void acquireLocks() {
        if (wakeLock == null) {
            PowerManager power = (PowerManager) getSystemService(Context.POWER_SERVICE);
            wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "zam:fileTransfer");
            wakeLock.setReferenceCounted(false);
        }
        wakeLock.acquire(WAKE_LOCK_TIMEOUT_MS);
        if (wifiLock == null) {
            WifiManager wifi = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wifi != null) {
                wifiLock = wifi.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "zam:fileTransfer");
                wifiLock.setReferenceCounted(false);
            }
        }
        if (wifiLock != null) wifiLock.acquire();
    }

    private void releaseLocks() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        if (wifiLock != null && wifiLock.isHeld()) wifiLock.release();
    }

    private Notification buildNotification() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_LOW);
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent content = open == null
                ? null
                : PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_notify)
                .setContentTitle("Transferring a file")
                .setOngoing(true)
                .setContentIntent(content)
                .build();
    }
}
