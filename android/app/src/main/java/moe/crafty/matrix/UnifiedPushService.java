package moe.crafty.matrix;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.PowerManager;

import androidx.annotation.NonNull;

import com.getcapacitor.JSObject;

import org.json.JSONObject;
import org.unifiedpush.android.connector.FailedReason;
import org.unifiedpush.android.connector.PushService;
import org.unifiedpush.android.connector.data.PushEndpoint;
import org.unifiedpush.android.connector.data.PushMessage;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Receives UnifiedPush events from the user's distributor (ntfy, NextPush,
 * Sunup, ...): the FCM-free alternative to MatrixMessagingService.
 *
 * The homeserver POSTs the standard Matrix push-gateway body
 * ({"notification": {room_id, event_id, counts, ...}}) to a Matrix gateway,
 * which forwards it verbatim to the endpoint; the distributor hands it to us
 * here. From there it goes through the SAME pipeline as an FCM push
 * (MatrixMessagingService.handleMatrixPush), so enrichment, active-session
 * suppression, call ringing and the reply/mark-read actions all behave alike.
 *
 * The endpoint and the Matrix gateway it pairs with are kept in SharedPreferences
 * so the web layer can (re)register the pusher on its next start even when the
 * distributor handed us a new endpoint while the app was not running.
 *
 * The connector may deliver events on the main thread (it replays queued events
 * from onServiceConnected), so all network work is moved onto EXECUTOR.
 */
public class UnifiedPushService extends PushService {

    static final String PREFS = "moe.crafty.matrix.unifiedpush";
    static final String KEY_ENDPOINT = "endpoint";
    static final String KEY_GATEWAY = "gateway";
    static final String INSTANCE = "default";

    // Used when the push server does not run a Matrix gateway of its own (see
    // discoverGateway). The UnifiedPush project's public instance of
    // common-proxies; the same default Element and FluffyChat use.
    static final String FALLBACK_GATEWAY =
        "https://matrix.gateway.unifiedpush.org/_matrix/push/v1/notify";

    private static final int CONNECT_TIMEOUT = 5000;
    private static final int READ_TIMEOUT = 5000;
    // Upper bound on one push's enrichment (several 5s-bounded requests).
    private static final long WAKE_LOCK_TIMEOUT_MS = 60000L;

    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();

    @Override
    public void onNewEndpoint(@NonNull PushEndpoint endpoint, @NonNull String instance) {
        final Context ctx = getApplicationContext();
        final String url = endpoint.getUrl();
        EXECUTOR.execute(() -> {
            String gateway = discoverGateway(url);
            prefs(ctx).edit()
                .putString(KEY_ENDPOINT, url)
                .putString(KEY_GATEWAY, gateway)
                .apply();
            JSObject data = new JSObject();
            data.put("endpoint", url);
            data.put("gateway", gateway);
            UnifiedPushPlugin.emit("endpoint", data);
        });
    }

    @Override
    public void onMessage(@NonNull PushMessage message, @NonNull String instance) {
        final Context ctx = getApplicationContext();
        final byte[] content = message.getContent();
        PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        final PowerManager.WakeLock wakeLock = pm != null
            ? pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "zam:unifiedpush")
            : null;
        if (wakeLock != null) wakeLock.acquire(WAKE_LOCK_TIMEOUT_MS);
        EXECUTOR.execute(() -> {
            try {
                handleMessage(ctx, content);
            } catch (Throwable ignored) {
                // A malformed push must never crash the process.
            } finally {
                if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
            }
        });
    }

    @Override
    public void onRegistrationFailed(@NonNull FailedReason reason, @NonNull String instance) {
        JSObject data = new JSObject();
        data.put("reason", reason.name());
        UnifiedPushPlugin.emit("registrationFailed", data);
    }

    @Override
    public void onUnregistered(@NonNull String instance) {
        clearStored(getApplicationContext());
        UnifiedPushPlugin.emit("unregistered", new JSObject());
    }

    static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static void clearStored(Context ctx) {
        prefs(ctx).edit().remove(KEY_ENDPOINT).remove(KEY_GATEWAY).apply();
    }

    /**
     * Unwrap the Matrix push-gateway body and hand it to the shared pipeline.
     * Fields are read from "notification" when present (the spec shape), else
     * from the top level, so a gateway that flattens the body still works.
     */
    private static void handleMessage(Context ctx, byte[] content) throws Exception {
        JSONObject body = new JSONObject(new String(content, StandardCharsets.UTF_8));
        JSONObject n = body.optJSONObject("notification");
        if (n == null) n = body;

        String roomId = optNonEmpty(n, "room_id");
        String eventId = optNonEmpty(n, "event_id");
        String unread = null;
        JSONObject counts = n.optJSONObject("counts");
        if (counts != null && counts.has("unread")) {
            unread = String.valueOf(counts.optInt("unread"));
        }
        MatrixMessagingService.handleMatrixPush(ctx, roomId, eventId, unread);
    }

    private static String optNonEmpty(JSONObject o, String key) {
        Object v = o.opt(key);
        if (!(v instanceof String)) return null;
        String s = (String) v;
        return s.isEmpty() ? null : s;
    }

    /**
     * The Matrix gateway to pair with a UnifiedPush endpoint, per the
     * UnifiedPush Matrix spec: if the push server itself answers
     * GET <origin>/_matrix/push/v1/notify with {"unifiedpush":{"gateway":"matrix"}}
     * (ntfy does), the homeserver can POST straight to it. Otherwise fall back
     * to the public gateway. Blocking.
     */
    static String discoverGateway(String endpoint) {
        HttpURLConnection conn = null;
        try {
            URL ep = new URL(endpoint);
            String candidate = ep.getProtocol() + "://" + ep.getAuthority()
                + "/_matrix/push/v1/notify";
            conn = (HttpURLConnection) new URL(candidate).openConnection();
            conn.setConnectTimeout(CONNECT_TIMEOUT);
            conn.setReadTimeout(READ_TIMEOUT);
            conn.setInstanceFollowRedirects(false);
            if (conn.getResponseCode() != 200) return FALLBACK_GATEWAY;
            try (InputStream is = conn.getInputStream()) {
                java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
                byte[] buf = new byte[4096];
                int n;
                while ((n = is.read(buf)) != -1 && out.size() < 65536) out.write(buf, 0, n);
                JSONObject up = new JSONObject(out.toString("UTF-8")).optJSONObject("unifiedpush");
                if (up != null && "matrix".equals(up.optString("gateway", ""))) return candidate;
            }
        } catch (Exception ignored) {
            // Unreachable, not JSON, ... → the push server has no gateway.
        } finally {
            if (conn != null) conn.disconnect();
        }
        return FALLBACK_GATEWAY;
    }
}
