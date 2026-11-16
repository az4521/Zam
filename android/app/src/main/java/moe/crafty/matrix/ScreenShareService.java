package moe.crafty.matrix;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.ComponentCallbacks;
import android.content.Context;
import android.content.Intent;
import android.content.res.Configuration;
import android.hardware.display.DisplayManager;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.Display;
import android.webkit.WebView;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;
import androidx.webkit.WebMessageCompat;
import androidx.webkit.WebMessagePortCompat;
import androidx.webkit.WebViewCompat;

import com.getcapacitor.JSObject;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Foreground service for one screen share (see ScreenSharePlugin).
 *
 * It is started foreground with the mediaProjection type BEFORE the
 * MediaProjection is obtained (Android 14 rule), holds the projection, the
 * encoder ({@link ScreenShareEncoder}) and the WebMessage port to the page.
 * The port is posted to the page as a window message, tagged
 * "zam:native-share-port", its info carried in the JSON string (WebView
 * messages are strings or ArrayBuffers, so the page parses e.data).
 *
 * Ends on: stop() or the notification's Stop action (reason "stop"), the
 * projection being revoked or stopped by the system ("revoked"), an encoder
 * failure ("error"), the page closing the port or a post failing ("stop"),
 * and the activity being destroyed ("stop").
 */
public class ScreenShareService extends Service {

    static final String ACTION_START = "moe.crafty.matrix.SCREEN_SHARE_START";
    static final String ACTION_STOP = "moe.crafty.matrix.SCREEN_SHARE_STOP";
    static final String PORT_TAG = "zam:native-share-port";

    private static final String CHANNEL_ID = "matrix_screen_share";
    private static final int NOTIFICATION_ID = 0x5C4E;
    private static final String TAG = ScreenShareEncoder.TAG;
    private static final Handler MAIN = new Handler(Looper.getMainLooper());

    /** Completion for the plugin's call. Called on the main thread. */
    interface Listener {
        void onStarted(JSObject result);
        void onFailed(String message);
    }

    /** One share's inputs, handed over by ScreenSharePlugin. */
    static final class Request {
        final int resultCode;
        final Intent data;
        final int fps;
        final int bitrate;
        final int maxWidth;
        final int maxHeight;
        final WebView webView;
        final Uri origin;
        final Listener listener;

        Request(int resultCode, Intent data, int fps, int bitrate, int maxWidth, int maxHeight,
                WebView webView, Uri origin, Listener listener) {
            this.resultCode = resultCode;
            this.data = data;
            this.fps = fps;
            this.bitrate = bitrate;
            this.maxWidth = maxWidth;
            this.maxHeight = maxHeight;
            this.webView = webView;
            this.origin = origin;
            this.listener = listener;
        }
    }

    // Main thread only.
    private static Request pending;
    private static Share active;

    private ComponentCallbacks configCallbacks;

    /** Main thread. Starts a share; the result comes back through the request's listener. */
    static void begin(Context context, Request request) {
        pending = request;
        ContextCompat.startForegroundService(context,
                new Intent(context, ScreenShareService.class).setAction(ACTION_START));
    }

    static boolean isSharing() {
        return active != null;
    }

    /** Main thread. Ends the running share, if any, with the given reason. */
    static void endActive(String reason) {
        Share s = active;
        if (s != null) s.end(reason);
    }

    /** Display size and density, in the current orientation. */
    static int[] displaySize(Context context) {
        DisplayManager dm = (DisplayManager) context.getSystemService(Context.DISPLAY_SERVICE);
        Display display = dm.getDisplay(Display.DEFAULT_DISPLAY);
        DisplayMetrics metrics = new DisplayMetrics();
        display.getRealMetrics(metrics);
        return new int[] {metrics.widthPixels, metrics.heightPixels, metrics.densityDpi};
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
        configCallbacks = new ComponentCallbacks() {
            @Override
            public void onConfigurationChanged(Configuration newConfig) {
                Share s = active;
                if (s == null) return;
                int[] d = displaySize(ScreenShareService.this);
                s.encoder.resize(d[0], d[1], d[2]);
            }

            @Override
            public void onLowMemory() {
            }
        };
        registerComponentCallbacks(configCallbacks);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_STOP.equals(action)) {
            endActive("stop");
            finishService();
            return START_NOT_STICKY;
        }

        // Must be foreground before anything else for a start (API 26+ rule).
        Request req = pending;
        pending = null;
        try {
            ServiceCompat.startForeground(this, NOTIFICATION_ID, buildNotification(),
                    android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
        } catch (Throwable t) {
            fail(req, "could not start the screen share service: " + t.getMessage());
            return START_NOT_STICKY;
        }
        if (req == null) {
            finishService();
            return START_NOT_STICKY;
        }
        if (active != null) {
            fail(req, "a screen share is already running");
            return START_NOT_STICKY;
        }

        Share share = null;
        try {
            MediaProjectionManager mpm = getSystemService(MediaProjectionManager.class);
            MediaProjection projection = mpm.getMediaProjection(req.resultCode, req.data);
            if (projection == null) throw new IllegalStateException("no media projection");
            share = new Share(this, req, projection);
            active = share;
            share.open();
            share.connect();
        } catch (Throwable t) {
            Log.w(TAG, "screen share failed to start", t);
            if (share != null) {
                active = null;
                share.end("error");
            }
            fail(req, "could not start the screen share: " + t.getMessage());
            return START_NOT_STICKY;
        }
        Log.i(TAG, "screen share started");
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        if (active != null) active.end("stop");
        try {
            unregisterComponentCallbacks(configCallbacks);
        } catch (Throwable ignored) {
        }
        super.onDestroy();
    }

    /** Main thread. Clears the foreground notification and stops the service. */
    private void finishService() {
        try {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } catch (Throwable ignored) {
        }
        stopSelf();
    }

    private void fail(Request req, String message) {
        Log.w(TAG, message);
        if (req != null) req.listener.onFailed(message);
        finishService();
    }

    private Notification buildNotification() {
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent open = PendingIntent.getActivity(this, 0,
                launch != null ? launch : new Intent(this, MainActivity.class),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent stop = PendingIntent.getService(this, 1,
                new Intent(this, ScreenShareService.class).setAction(ACTION_STOP),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_notify)
                .setContentTitle("Sharing your screen")
                .setContentText("Zam is capturing this screen")
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
                .setContentIntent(open)
                .addAction(0, "Stop sharing", stop)
                .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
                .build();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Screen sharing", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Shown while you share your screen");
        channel.setShowBadge(false);
        manager.createNotificationChannel(channel);
    }

    /** One running share: projection, encoder, and the port to the page. */
    private static final class Share {
        private final ScreenShareService service;
        private final Request req;
        private final MediaProjection projection;
        final ScreenShareEncoder encoder;
        private final AtomicBoolean ended = new AtomicBoolean(false);
        private volatile WebMessagePortCompat port;

        private final MediaProjection.Callback projectionCallback = new MediaProjection.Callback() {
            @Override
            public void onStop() {
                // Revoked by the user, the system, or the app that owns the projection.
                end("revoked");
            }
        };

        private final WebMessagePortCompat.WebMessageCallbackCompat portCallback =
                new WebMessagePortCompat.WebMessageCallbackCompat() {
                    @Override
                    public void onMessage(WebMessagePortCompat p, WebMessageCompat m) {
                        if (ended.get() || m == null || m.getType() != WebMessageCompat.TYPE_STRING) return;
                        try {
                            JSONObject j = new JSONObject(m.getData());
                            switch (j.optString("cmd")) {
                                case "key":
                                    encoder.requestSync();
                                    break;
                                case "bitrate":
                                    encoder.setBitrate(j.optInt("bps"));
                                    break;
                                case "fps":
                                    Log.i(TAG, "fps change requested (not applied on this encoder)");
                                    break;
                                case "stop":
                                    MAIN.post(() -> endActive("stop"));
                                    break;
                                default:
                                    break;
                            }
                        } catch (JSONException e) {
                            Log.w(TAG, "bad command from the page", e);
                        }
                    }
                };

        private final ScreenShareEncoder.Sink sink = new ScreenShareEncoder.Sink() {
            @Override
            public void onAccessUnit(byte[] framed) {
                WebMessagePortCompat p = port;
                if (ended.get() || p == null) return;
                try {
                    p.postMessage(new WebMessageCompat(framed));
                } catch (IllegalStateException closed) {
                    // The page closed its end: that is the user leaving the share.
                    MAIN.post(() -> endActive("stop"));
                }
            }

            @Override
            public void onSize(int width, int height) {
                postJson(infoJson(kv("width", width, "height", height)));
            }

            @Override
            public void onFailure(String message) {
                MAIN.post(() -> {
                    postJson(infoJson(kv("error", message)));
                    endActive("error");
                });
            }
        };

        Share(ScreenShareService service, Request req, MediaProjection projection) {
            this.service = service;
            this.req = req;
            this.projection = projection;
            this.encoder = new ScreenShareEncoder(sink, req.fps, req.bitrate, req.maxWidth, req.maxHeight);
        }

        /** Main thread. Callback first (Android 14), then the encoder and its display. */
        void open() throws java.io.IOException {
            // Android 14+ only (the stop callback). Older projections end when
            // the user stops them from the status bar, which the display observes.
            if (Build.VERSION.SDK_INT >= 34) projection.registerCallback(projectionCallback, MAIN);
            int[] d = displaySize(service);
            encoder.open(projection, d[0], d[1], d[2]);
        }

        /** Main thread. Creates the port and posts it to the page, then resolves the call. */
        void connect() throws JSONException {
            WebMessagePortCompat[] ports = WebViewCompat.createWebMessageChannel(req.webView);
            port = ports[0];
            ports[0].setWebMessageCallback(encoder.handler(), portCallback);
            JSONObject info = new JSONObject()
                    .put("width", encoder.width())
                    .put("height", encoder.height())
                    .put("encoder", encoder.encoderName())
                    .put("hardware", encoder.hardware())
                    .put("platform", "android");
            JSONObject message = new JSONObject().put("tag", PORT_TAG).put("info", info);
            WebViewCompat.postWebMessage(req.webView,
                    new WebMessageCompat(message.toString(), new WebMessagePortCompat[] {ports[1]}),
                    req.origin);
            encoder.requestSync();
            req.listener.onStarted(new JSObject()
                    .put("started", true)
                    .put("width", encoder.width())
                    .put("height", encoder.height())
                    .put("encoder", encoder.encoderName()));
        }

        /** Main thread (or encoder thread via MAIN). Idempotent. */
        void end(String reason) {
            if (!ended.compareAndSet(false, true)) return;
            if (active == this) active = null;
            WebMessagePortCompat p = port;
            port = null;
            if (p != null) {
                try {
                    p.postMessage(new WebMessageCompat(new JSONObject()
                            .put("type", "ended")
                            .put("reason", reason)
                            .toString()));
                } catch (Throwable ignored) {
                }
                try {
                    p.close();
                } catch (Throwable ignored) {
                }
            }
            encoder.release();
            if (Build.VERSION.SDK_INT >= 34) {
                try {
                    projection.unregisterCallback(projectionCallback);
                } catch (Throwable ignored) {
                }
            }
            try {
                projection.stop();
            } catch (Throwable ignored) {
            }
            Log.i(TAG, "screen share ended: " + reason);
            service.finishService();
        }

        private void postJson(JSONObject json) {
            WebMessagePortCompat p = port;
            if (ended.get() || p == null) return;
            try {
                p.postMessage(new WebMessageCompat(json.toString()));
            } catch (IllegalStateException closed) {
                MAIN.post(() -> endActive("stop"));
            }
        }

        private static JSONObject infoJson(JSONObject info) {
            return kv("type", "info", "info", info);
        }

        /** Builds a JSON object from key, value pairs. Values are primitives or JSONObjects. */
        private static JSONObject kv(Object... pairs) {
            JSONObject o = new JSONObject();
            try {
                for (int i = 0; i + 1 < pairs.length; i += 2) o.put((String) pairs[i], pairs[i + 1]);
            } catch (JSONException ignored) {
            }
            return o;
        }
    }
}
