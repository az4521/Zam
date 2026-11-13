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
 * involves no encryption, so the web layer is not needed. Decline on an
 * invite notification is the same kind of thing: one leave request.
 * (Accept opens the app instead: see ACTION_ACCEPT_INVITE.)
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
    static final String ACTION_DECLINE_INVITE = "moe.crafty.matrix.INVITE_DECLINE";
    // Handled by MainActivity: the web layer's accept does the bookkeeping.
    static final String ACTION_ACCEPT_INVITE = "moe.crafty.matrix.INVITE_ACCEPT";

    // The account's "private read receipts" setting, mirrored by
    // syncNativeReceiptPrivacy() in src/lib/nativeSession.ts as
    // {"userId": ..., "private": bool, "rooms": {roomId: bool}}. "rooms" is
    // optional: a per-room override (true = private) for rooms whose effective
    // value differs from the account default; a room not listed uses "private".
    // Missing, malformed or for another account → private (fail closed: never
    // reveal a read the user may have chosen to hide).
    static final String KEY_RECEIPT_PRIVACY = "matrix_receipt_privacy";

    private static final int TIMEOUT_MS = 8000;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        final boolean decline = ACTION_DECLINE_INVITE.equals(intent.getAction());
        if (!decline && !ACTION_MARK_READ.equals(intent.getAction())) return;
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
                if (decline) declineInvite(app, roomId, userId);
                else markRead(app, roomId, userId, eventId);
            } catch (Throwable ignored) {
                // Best effort: the next sync of the app reconciles.
            } finally {
                pending.finish();
            }
        }, decline ? "matrix-decline-invite" : "matrix-mark-read").start();
    }

    /** The signed-in account the notification was posted under, or null (PRIV-02). */
    private static MatrixMessagingService.SessionRecord sessionFor(Context context,
            String userId) {
        if (userId == null) return null;
        SharedPreferences prefs = context.getSharedPreferences(
            MatrixMessagingService.PREFS, Context.MODE_PRIVATE);
        MatrixMessagingService.SessionRecord session = MatrixMessagingService.resolveSession(
            prefs, MatrixMessagingService.readSessionRecord(prefs), userId);
        return session != null && userId.equals(session.userId) ? session : null;
    }

    private static void declineInvite(Context context, String roomId, String userId)
            throws Exception {
        MatrixMessagingService.SessionRecord session = sessionFor(context, userId);
        if (session == null) return;
        String url = session.homeserverUrl + "/_matrix/client/v3/rooms/"
            + MatrixMessagingService.enc(roomId) + "/leave";
        boolean ok = request("POST", url, session.accessToken, "{}") != null;
        PushLog.log(context, "invite to room " + PushLog.shortId(roomId)
            + (ok ? " declined" : " decline failed"));
        if (ok) recordDecline(context, session.userId, roomId);
    }

    /**
     * Declines the app has not seen yet, as a JSON array of
     * {userId, roomId, ts}: the app holds the invite in its sync store, and
     * sliding sync never tells it the invite is gone, so it would keep
     * offering it. The web layer settles and removes them (see
     * src/lib/declinedInvites.ts, which owns the format).
     */
    static final String KEY_DECLINED_INVITES = "moe.crafty.matrix.declined_invites";

    private static synchronized void recordDecline(Context context, String userId,
            String roomId) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(
                MatrixMessagingService.PREFS, Context.MODE_PRIVATE);
            JSONArray list;
            try {
                list = new JSONArray(prefs.getString(KEY_DECLINED_INVITES, "[]"));
            } catch (Exception e) {
                list = new JSONArray();
            }
            JSONArray next = new JSONArray();
            // Newest last; the 50 most recent are plenty.
            for (int i = Math.max(0, list.length() - 49); i < list.length(); i++) {
                JSONObject o = list.optJSONObject(i);
                if (o != null && !(roomId.equals(o.optString("roomId"))
                        && userId.equals(o.optString("userId")))) {
                    next.put(o);
                }
            }
            next.put(new JSONObject().put("userId", userId).put("roomId", roomId)
                .put("ts", System.currentTimeMillis()));
            prefs.edit().putString(KEY_DECLINED_INVITES, next.toString()).commit();
        } catch (Throwable ignored) {}
    }

    private static void markRead(Context context, String roomId, String userId, String eventId)
            throws Exception {
        SharedPreferences prefs = context.getSharedPreferences(
            MatrixMessagingService.PREFS, Context.MODE_PRIVATE);
        // The account the notification was posted under (PRIV-02), whichever
        // signed-in account that is: never another account's credentials.
        if (userId == null) return;
        MatrixMessagingService.SessionRecord session = MatrixMessagingService.resolveSession(
            prefs, MatrixMessagingService.readSessionRecord(prefs), userId);
        if (session == null || !userId.equals(session.userId)) return;

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
        body.put(receiptsPrivate(prefs, session.userId, roomId) ? "m.read.private" : "m.read", target);
        request("POST", base + "/read_markers", session.accessToken, body.toString());
    }

    private static boolean receiptsPrivate(SharedPreferences prefs, String userId, String roomId) {
        try {
            String raw = prefs.getString(KEY_RECEIPT_PRIVACY, null);
            if (raw == null) return true;
            JSONObject o = new JSONObject(raw);
            if (!userId.equals(o.opt("userId"))) return true;
            // Per-room override first; a non-boolean entry is ignored.
            JSONObject rooms = o.optJSONObject("rooms");
            if (rooms != null && roomId != null) {
                Object roomPriv = rooms.opt(roomId);
                if (roomPriv instanceof Boolean) return (Boolean) roomPriv;
            }
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
