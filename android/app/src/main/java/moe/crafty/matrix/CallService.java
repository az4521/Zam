package moe.crafty.matrix;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;

/**
 * Foreground service held for the whole of an active call, so the call keeps
 * working with the app in the background or the screen off — like a phone
 * call, not like a web page.
 *
 * Without it Android treats the backgrounded WebView like any idle app: from
 * API 28 the microphone of an idle UID delivers SILENCE, the camera is cut,
 * Doze stops the CPU and network once the screen is off, and the process is
 * an early kill candidate. A foreground service typed phoneCall|microphone
 * (|camera) is the sanctioned way out of all four:
 *
 *  - phoneCall:  marks this as a calling app's ongoing call. On API 34+ it
 *                needs FOREGROUND_SERVICE_PHONE_CALL plus MANAGE_OWN_CALLS
 *                (a normal, install-time permission) — the "telephony"
 *                permission a VoIP app holds.
 *  - microphone: keeps mic capture live while in the background. Must be
 *                STARTED while the app is visible (a while-in-use type),
 *                which it always is: the user just pressed Join / Accept.
 *  - camera:     same, for video calls. Only claimed when CAMERA is granted,
 *                or startForeground throws.
 *
 * A partial wake lock and a Wi-Fi lock keep the CPU and radio up with the
 * screen off. Driven from the web layer by {@link CallServicePlugin}, next
 * to the call's registration with the system call stack ({@link TelecomCalls}).
 */
public class CallService extends Service {

    static final String ACTION_START = "moe.crafty.matrix.CALL_SERVICE_START";
    static final String ACTION_HANG_UP = "moe.crafty.matrix.CALL_SERVICE_HANG_UP";
    static final String EXTRA_TITLE = "title";

    private static final String CHANNEL_ID = "matrix_ongoing_call";
    private static final String CHANNEL_NAME = "Ongoing call";
    private static final int NOTIFICATION_ID = 0x0CA11;
    // Upper bound on the wake lock so a missed stop can never pin the CPU
    // forever. Long calls re-acquire on every start() (each connect).
    private static final long WAKE_LOCK_TIMEOUT_MS = 6L * 60L * 60L * 1000L;

    private static volatile boolean running = false;

    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;

    static boolean isRunning() {
        return running;
    }

    static void start(Context context, String title) {
        Intent intent = new Intent(context, CallService.class);
        intent.setAction(ACTION_START);
        intent.putExtra(EXTRA_TITLE, title);
        ContextCompat.startForegroundService(context, intent);
    }

    static void stop(Context context) {
        context.stopService(new Intent(context, CallService.class));
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_HANG_UP.equals(action)) {
            // The web layer owns the call: ask it to leave. It stops this
            // service from its own teardown path once the call is gone. With no
            // web layer to ask there is no call left either: just stop.
            if (!CallServicePlugin.emit("hangUp", new JSObject())) stopSelf();
            return START_NOT_STICKY;
        }

        String title = intent != null ? intent.getStringExtra(EXTRA_TITLE) : null;
        Notification notification = buildNotification(title);
        try {
            ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, serviceTypes(true));
        } catch (Throwable t) {
            // A while-in-use type refused (e.g. started from the background on
            // API 34+): fall back to phoneCall alone so the process at least
            // stays alive. If even that fails, give up quietly — the call
            // still works in the foreground, as it did before this service.
            try {
                ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, serviceTypes(false));
            } catch (Throwable t2) {
                stopSelf();
                return START_NOT_STICKY;
            }
        }
        running = true;
        acquireLocks();
        // NOT sticky: a call cannot survive the process dying, so a restart
        // would only show a stale "in call" notification.
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        running = false;
        releaseLocks();
        super.onDestroy();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // Swiping the app away kills the WebView and with it the call: end
        // the system call too, or Telecom would show it as still going.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) TelecomCalls.endCall();
        stopSelf();
        super.onTaskRemoved(rootIntent);
    }

    private int serviceTypes(boolean withCapture) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return 0;
        int types = ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL;
        if (withCapture && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            if (granted(Manifest.permission.RECORD_AUDIO)) {
                types |= ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE;
            }
            if (granted(Manifest.permission.CAMERA)) {
                types |= ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA;
            }
        }
        return types;
    }

    private boolean granted(String permission) {
        return ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED;
    }

    private Notification buildNotification(String title) {
        createChannel();

        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            piFlags |= PendingIntent.FLAG_IMMUTABLE;
        }

        // Tap: bring the app (and its call view) back to the front.
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openPending = PendingIntent.getActivity(this, NOTIFICATION_ID, openIntent, piFlags);

        Intent hangUpIntent = new Intent(this, CallService.class);
        hangUpIntent.setAction(ACTION_HANG_UP);
        PendingIntent hangUpPending = PendingIntent.getService(this, NOTIFICATION_ID + 1, hangUpIntent, piFlags);

        String text = (title != null && !title.trim().isEmpty()) ? title.trim() : "Call in progress";

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_notify)
            .setContentTitle(text)
            .setContentText("Ongoing call")
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setUsesChronometer(true)
            .setShowWhen(true)
            .setWhen(System.currentTimeMillis())
            .setContentIntent(openPending)
            // The phone app's ongoing-call presentation (a status-bar call
            // chip on API 31+); adds the Hang up button itself.
            .setStyle(NotificationCompat.CallStyle.forOngoingCall(
                new Person.Builder().setName(text).build(), hangUpPending))
            // Show immediately rather than after Android 12's 10 s FGS delay.
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) return;
        // LOW: a persistent status entry, never a sound — the call itself is
        // already making noise.
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            CHANNEL_NAME,
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Shown while you are in a call");
        channel.setShowBadge(false);
        manager.createNotificationChannel(channel);
    }

    private void acquireLocks() {
        try {
            if (wakeLock == null) {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "matrix:call");
                    wakeLock.setReferenceCounted(false);
                }
            }
            if (wakeLock != null) wakeLock.acquire(WAKE_LOCK_TIMEOUT_MS);
        } catch (Throwable ignored) {}
        try {
            if (wifiLock == null) {
                WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                if (wm != null) {
                    int mode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                        ? WifiManager.WIFI_MODE_FULL_LOW_LATENCY
                        : WifiManager.WIFI_MODE_FULL_HIGH_PERF;
                    wifiLock = wm.createWifiLock(mode, "matrix:call");
                    wifiLock.setReferenceCounted(false);
                }
            }
            if (wifiLock != null && !wifiLock.isHeld()) wifiLock.acquire();
        } catch (Throwable ignored) {}
    }

    private void releaseLocks() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        } catch (Throwable ignored) {}
        try {
            if (wifiLock != null && wifiLock.isHeld()) wifiLock.release();
        } catch (Throwable ignored) {}
        wakeLock = null;
        wifiLock = null;
    }
}
