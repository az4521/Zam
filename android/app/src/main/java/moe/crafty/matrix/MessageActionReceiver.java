package moe.crafty.matrix;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import androidx.core.app.NotificationManagerCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Handles Mark-as-read on a message notification posted by
 * {@link MatrixMessagingService}: cancels the notification and sends the read
 * marker straight to the homeserver, WITHOUT opening the app. A read marker
 * involves no encryption, so the web layer is not needed.
 *
 * (Reply is not handled here any more: it needs the web layer's SDK for E2EE,
 * and Android 12+ refuses to start an activity from a notification via a
 * receiver, so the Reply action targets MainActivity directly. The action
 * name lives here so both ends share it.)
 */
public class MessageActionReceiver extends BroadcastReceiver {

    static final String ACTION_REPLY = "moe.crafty.matrix.MSG_REPLY";
    static final String ACTION_MARK_READ = "moe.crafty.matrix.MSG_MARK_READ";
    static final String KEY_TEXT_REPLY = "key_text_reply";

    // The account's "private read receipts" setting, mirrored by
    // syncNativeReceiptPrivacy() in src/lib/nativeSession.ts as
    // {"userId": ..., "private": bool}. Missing, malformed or for another
    // account → private (fail closed: never reveal a read the user may
    // have chosen to hide).
    static final String KEY_RECEIPT_PRIVACY = "matrix_receipt_privacy";

    private static final int TIMEOUT_MS = 8000;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !ACTION_MARK_READ.equals(intent.getAction())) return;
        final String roomId = intent.getStringExtra("room_id");
        final String userId = intent.getStringExtra("user_id");
        final String eventId = intent.getStringExtra("event_id");
        if (roomId == null) return;

        // The user acted on it: take it down right away.
        try {
            NotificationManagerCompat.from(context).cancel(roomId.hashCode());
        } catch (Throwable ignored) {}

        final Context app = context.getApplicationContext();
        final PendingResult pending = goAsync();
        new Thread(() -> {
            try {
                markRead(app, roomId, userId, eventId);
            } catch (Throwable ignored) {
                // Best effort: the next sync of the app reconciles.
            } finally {
                pending.finish();
            }
        }, "matrix-mark-read").start();
    }

    private static void markRead(Context context, String roomId, String userId, String eventId)
            throws Exception {
        SharedPreferences prefs = context.getSharedPreferences(
            MatrixMessagingService.PREFS, Context.MODE_PRIVATE);
        MatrixMessagingService.SessionRecord session = MatrixMessagingService.readSessionRecord(prefs);
        // Only for the account the notification was posted under (PRIV-02):
        // never send one account's receipt with another's credentials.
        if (session == null || userId == null || !userId.equals(session.userId)) return;

        String base = session.homeserverUrl + "/_matrix/client/v3/rooms/"
            + MatrixMessagingService.enc(roomId);

        String target = eventId;
        if (target == null || target.isEmpty()) {
            // No event on the notification: the newest event in the room.
            String json = request("GET", base + "/messages?dir=b&limit=1", session.accessToken, null);
            if (json == null) return;
            JSONArray chunk = new JSONObject(json).optJSONArray("chunk");
            if (chunk == null || chunk.length() == 0) return;
            target = chunk.getJSONObject(0).optString("event_id", "");
            if (target.isEmpty()) return;
        }

        JSONObject body = new JSONObject();
        body.put("m.fully_read", target);
        body.put(receiptsPrivate(prefs, session.userId) ? "m.read.private" : "m.read", target);
        request("POST", base + "/read_markers", session.accessToken, body.toString());
    }

    private static boolean receiptsPrivate(SharedPreferences prefs, String userId) {
        try {
            String raw = prefs.getString(KEY_RECEIPT_PRIVACY, null);
            if (raw == null) return true;
            JSONObject o = new JSONObject(raw);
            if (!userId.equals(o.opt("userId"))) return true;
            Object priv = o.opt("private");
            return !(priv instanceof Boolean) || (Boolean) priv;
        } catch (Throwable t) {
            return true;
        }
    }

    /** Minimal authenticated request; the body on 2xx, else null. */
    private static String request(String method, String url, String token, String jsonBody)
            throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        try {
            conn.setRequestMethod(method);
            conn.setConnectTimeout(TIMEOUT_MS);
            conn.setReadTimeout(TIMEOUT_MS);
            conn.setRequestProperty("Authorization", "Bearer " + token);
            if (jsonBody != null) {
                conn.setDoOutput(true);
                conn.setRequestProperty("Content-Type", "application/json");
                try (OutputStream out = conn.getOutputStream()) {
                    out.write(jsonBody.getBytes(StandardCharsets.UTF_8));
                }
            }
            int code = conn.getResponseCode();
            if (code < 200 || code >= 300) return null;
            try (InputStream is = conn.getInputStream()) {
                java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
                byte[] buf = new byte[4096];
                int n;
                while ((n = is.read(buf)) != -1) out.write(buf, 0, n);
                return out.toString("UTF-8");
            }
        } finally {
            conn.disconnect();
        }
    }
}
