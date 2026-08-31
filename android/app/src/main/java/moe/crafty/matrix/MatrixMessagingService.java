package moe.crafty.matrix;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.net.Uri;
import android.media.AudioAttributes;
import android.media.RingtoneManager;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.RemoteInput;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;

import org.json.JSONObject;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.Map;

/**
 * Firebase messaging service that DISPLAYS a notification for the data-only
 * messages Sygnal sends.
 *
 * Sygnal pushes are "event_id_only" — they contain just event_id / room_id, no
 * content. To show a useful notification (sender, message, room icon) we call
 * the homeserver from here using the single session RECORD mirrored into
 * SharedPreferences by the web layer (see src/lib/nativeSession.ts). If the
 * record is missing or invalid, or a request fails, we fall back to a generic
 * notification.
 *
 * Before enriching, we also read the `moe.crafty.matrix.active_session`
 * account-data blob: if a DIFFERENT device of this account was focused within
 * its grace window, this device stays silent (see shouldStayQuiet below).
 *
 * Still forwards to the Capacitor plugin so token registration and foreground
 * events keep working. Declared with a higher-priority intent-filter than the
 * plugin's MessagingService so MESSAGING_EVENT routes here.
 */
public class MatrixMessagingService extends FirebaseMessagingService {

    private static final String CHANNEL_ID = "matrix_messages";
    private static final String CHANNEL_NAME = "Messages";
    // Separate high-importance channel for incoming calls: a ring sound, DND
    // bypass and vibration, so a call is unmistakable and unlike a message.
    private static final String CALL_CHANNEL_ID = "matrix_calls";
    private static final String CALL_CHANNEL_NAME = "Calls";

    // Matches the Capacitor Preferences store + the single session record
    // written by src/lib/utils/nativeSessionRecord.ts (via nativeSession.ts).
    // Both strings are hand-typed: KEY_SESSION must stay equal to
    // NATIVE_SESSION_KEY there (and SESSION_KEY in static/sw.js).
    private static final String PREFS = "CapacitorStorage";
    private static final String KEY_SESSION = "matrix_session_record";
    // Mirrors NATIVE_SESSION_VERSION. A record of any other version may mean
    // something else by the same field names, so it is refused, not guessed at.
    private static final int SESSION_VERSION = 1;

    // Active-session suppression (see shouldStayQuiet below).
    private static final String ACTIVE_SESSION_KEY = "moe.crafty.matrix.active_session";
    // Mirrors MAX_FUTURE_SKEW_MS in activeSession.ts: `ts` comes from another
    // device's clock, so anything further ahead than this is a broken clock.
    private static final long MAX_FUTURE_SKEW_MS = 300000L;
    // Mirrors MAX_GRACE_MS in activeSession.ts: a blob past this is a bug,
    // and honouring it would mute this device indefinitely. Must stay above
    // the longest duration Settings can produce (2h custom ceiling) — this
    // clamp is silent, so a lower value would quietly shorten the setting.
    private static final long MAX_GRACE_MS = 7200000L;
    private static final String KEY_HIDE_BODY = "matrix_hide_notification_body";

    private static final int CONNECT_TIMEOUT = 5000;
    private static final int READ_TIMEOUT = 5000;

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        PushNotificationsPlugin.onNewToken(token);
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        try {
            PushNotificationsPlugin.sendRemoteMessage(remoteMessage);
        } catch (Throwable ignored) {}

        // A message carrying its own notification block is shown elsewhere.
        if (remoteMessage.getNotification() != null) return;

        Map<String, String> data = remoteMessage.getData();
        String roomId = data.get("room_id");
        String eventId = data.get("event_id");
        String unreadStr = data.get("unread");

        // unread == 0 is a "clear" push: the room was read somewhere, so take
        // its notification DOWN rather than merely declining to post a new one.
        if (unreadStr != null) {
            try {
                if (Integer.parseInt(unreadStr) == 0) {
                    // Must match showNotification()'s id scheme exactly, or we
                    // cancel nothing. Scoped to the room the push names: a
                    // clear push without a room_id says nothing about WHICH
                    // notification is stale.
                    if (roomId != null) {
                        try {
                            NotificationManagerCompat.from(this)
                                .cancel(roomId.hashCode());
                        } catch (Throwable ignored) {}
                    }
                    return;
                }
            } catch (NumberFormatException ignored) {}
        }

        // Defaults (used if enrichment fails).
        String title = "New message";
        String text = "You have a new message";
        Bitmap largeIcon = null;
        // MSC4075 m.call.notify → render an incoming CALL, not a message.
        boolean isCall = false;
        String callerName = null;

        try {
            SharedPreferences prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            // ONE read for the whole credential tuple. It used to be four
            // independent reads, which was four chances to pick up a torn set
            // (see the record mirror below). Null → no usable credentials.
            SessionRecord session = readSessionRecord(prefs);
            String hs = session != null ? session.homeserverUrl : null;
            String token = session != null ? session.accessToken : null;
            String selfUserId = session != null ? session.userId : null;
            String selfDeviceId = session != null ? session.deviceId : null;

            // Another device is demonstrably in use → stay quiet. Checked
            // before the enrichment fetches below so a suppressed push costs
            // one request instead of five. Never throws; false on any doubt.
            if (shouldStayQuiet(hs, token, selfUserId, selfDeviceId)) return;
            // Device-global "hide message text in notifications" privacy setting,
            // mirrored by src/lib/nativeSession.ts. Capacitor Preferences stores
            // every value as a String, so compare rather than getBoolean() (which
            // would throw ClassCastException on a String-typed entry, and the
            // catch below would silently swallow ALL enrichment). Absent key →
            // "false" → bodies stay visible, today's behaviour.
            boolean hideBody = "true".equals(prefs.getString(KEY_HIDE_BODY, "false"));

            // Same gate as before, one notch stricter: a non-null record
            // guarantees BOTH hs and token are present and well-formed (and
            // that they came from the same write), so no valid session can
            // lose enrichment here.
            if (session != null && roomId != null && eventId != null) {
                // Room display name.
                String roomName = fetchRoomName(hs, token, roomId);
                if (roomName != null) title = roomName;

                // The event itself → sender + body.
                String sender = "";
                JSONObject event = fetchEvent(hs, token, roomId, eventId);
                if (event != null) {
                    sender = event.optString("sender", "");
                    JSONObject content = event.optJSONObject("content");
                    String body = content != null ? content.optString("body", "") : "";
                    String senderName = fetchSenderName(hs, token, roomId, sender);
                    if (senderName == null || senderName.isEmpty()) senderName = sender;

                    String name = senderName.trim();

                    // Same rule as pushNotificationKind() (src/lib/utils) and
                    // buildNotification() in static/sw.js: an MSC4075 call-notify
                    // with a "ring" (or absent) notify_type is an incoming CALL.
                    // The event TYPE decides (event_id_only pushes carry no
                    // tweak). The unstable type is what is actually stored/pushed;
                    // the stable one is accepted too.
                    String type = event.optString("type", "");
                    String notifyType = content != null
                        ? content.optString("notify_type", "ring") : "ring";
                    boolean isCallType = type.equals("org.matrix.msc4075.call.notify")
                        || type.equals("m.call.notify");
                    if (isCallType && notifyType.equals("ring")) {
                        isCall = true;
                        callerName = name;
                    } else {
                        // Same comparisons as notificationBody() in
                        // src/lib/utils/notificationPrivacy.ts (and
                        // buildNotification() in static/sw.js): trim both sides so
                        // a whitespace-only body counts as absent, and drop the
                        // message text entirely when the privacy setting is on.
                        // The room name still becomes the title — only the
                        // message text is gated.
                        String preview = hideBody ? "" : body.trim();
                        if (!preview.isEmpty()) {
                            text = name.isEmpty() ? preview : name + ": " + preview;
                        } else if (!name.isEmpty()) {
                            text = name + " sent a message";
                        }
                    }
                }

                // Large icon: room avatar, or — for a DM with no room avatar —
                // the other member's (i.e. the sender's) avatar.
                String avatarMxc = fetchRoomAvatar(hs, token, roomId);
                if (avatarMxc == null && isDirectRoom(hs, token, roomId)
                        && !sender.isEmpty()) {
                    avatarMxc = fetchUserAvatar(hs, token, roomId, sender);
                }
                if (avatarMxc != null) {
                    largeIcon = fetchMxcThumbnail(hs, token, avatarMxc, 128);
                }
            }
        } catch (Throwable t) {
            // Any failure → fall back to the generic notification.
        }

        if (isCall) {
            showCallNotification(callerName, roomId, largeIcon);
        } else {
            showNotification(title, text, roomId, eventId, largeIcon);
        }
    }

    // ── Session record ──────────────────────────────────────────────────────

    /**
     * The mirrored web session: homeserver, token and identity as ONE value.
     *
     * Hand-written mirror of parseNativeSession() in
     * src/lib/utils/nativeSessionRecord.ts (static/sw.js carries the third
     * copy, as parseSessionRecord) — Java cannot import TypeScript, so keep all
     * three in step. They were four independent SharedPreferences entries
     * before: a torn write could pair one account's bearer token with another
     * account's homeserver, and this service would then send A's token to B
     * (external audit SEC-01).
     *
     * There is deliberately NO fallback to the old per-key entries. Reading
     * them is the bug being fixed; an install that has not opened the app since
     * updating simply falls back to the generic notification until it does,
     * which is the safe direction.
     */
    private static final class SessionRecord {
        final String homeserverUrl;
        final String accessToken;
        final String userId;
        final String deviceId; // may be null — the reader then never suppresses

        SessionRecord(String hs, String token, String user, String device) {
            this.homeserverUrl = hs;
            this.accessToken = token;
            this.userId = user;
            this.deviceId = device;
        }
    }

    /**
     * Mirrors nonBlankString(): a String with at least one non-whitespace
     * character, returned UNTRIMMED (the token in particular is used verbatim).
     * Anything that is not a String — a number, a nested object, absent,
     * JSONObject.NULL — is "not present".
     */
    private static String nonBlankString(Object value) {
        if (!(value instanceof String)) return null;
        String s = (String) value;
        return s.trim().isEmpty() ? null : s;
    }

    /**
     * Mirrors validHomeserverUrl(): trim BEFORE certifying and keep the TRIMMED
     * value. Every request below is built by concatenation (hs + "/_matrix/…"),
     * so surrounding padding would become a malformed request against a
     * wrong-looking host.
     *
     * http:// is accepted as well as https:// — a LAN homeserver works on
     * native today, and this record only mirrors whatever the account already
     * uses. static/sw.js layers an https-only check on top: that restriction is
     * the WORKER's alone and is deliberately NOT copied here.
     *
     * This is a scheme-prefix test, not a WHATWG URL parse, so as well as being
     * STRICTER in the one place noted inline below it is also LAXER in three
     * known ways. All three are rejected by the new URL() the TS/JS copies use
     * and accepted here:
     *   - a space inside the host   — "https://ho st.com"
     *   - an out-of-range port      — "https://hs.com:99999"
     *   - a percent-encoded host    — "https://%2F"
     * Unreachable today: serializeNativeSession() in
     * src/lib/utils/nativeSessionRecord.ts is the ONLY producer of this record
     * and it runs the same value through new URL() before storing it, so none
     * of those shapes can be at rest for this method to read. Harmless if that
     * ever changed: a bogus host just fails DNS, every fetch below throws, and
     * the service falls back to the generic notification. Deliberately NOT
     * validated here — the extra parsing would be dead code guarding a hole the
     * writer already closes.
     */
    private static String validHomeserverUrl(Object value) {
        String raw = nonBlankString(value);
        if (raw == null) return null;
        String url = raw.trim();
        // new URL() in the TS/JS copies is case-insensitive about the scheme,
        // so "HTTPS://hs" parses there and must parse here too. Locale.ROOT so
        // no device locale can reinterpret these ASCII letters.
        String lower = url.toLowerCase(java.util.Locale.ROOT);
        int hostStart;
        if (lower.startsWith("https://")) hostStart = 8;
        else if (lower.startsWith("http://")) hostStart = 7;
        // Relative ("/_matrix") or bare ("matrix.example.org"): we would have
        // no idea which server the token belongs to. Refuse the whole record.
        else return null;
        // The one place this method is STRICTER than the TS/JS copies, and it
        // does NOT mirror new URL() — it deliberately diverges from it, in the
        // safe direction. Verified empirically: new URL("https://") DOES throw,
        // but new URL("https:///_matrix") SUCCEEDS, with "_matrix" as the host,
        // so the WHATWG parser accepts an empty authority that this test
        // refuses. Every request below is hs + "/_matrix/…", so accepting it
        // would concatenate a bearer token into a hostless URL; refusing it
        // costs at most the enrichment (fall back to the generic notification).
        // A future maintainer "resyncing" the copies must NOT loosen this.
        if (url.length() <= hostStart) return null;
        char first = url.charAt(hostStart);
        if (first == '/' || first == '?' || first == '#') return null;
        return url;
    }

    /** Mirrors validUserId(): a Matrix user id, cheaply. */
    private static String validUserId(Object value) {
        String id = nonBlankString(value);
        if (id == null || !id.startsWith("@") || id.length() < 2) return null;
        return id;
    }

    /**
     * Strict parse of the stored record — anything unexpected yields null, i.e.
     * "this device has no credentials", which the caller must treat as "contact
     * no homeserver", never as "use what's there". Never throws.
     */
    private static SessionRecord readSessionRecord(SharedPreferences prefs) {
        String raw;
        try {
            // getString throws ClassCastException if anything ever stored a
            // non-String under the key; a corrupt store must not kill the
            // notification.
            raw = prefs.getString(KEY_SESSION, null);
        } catch (Exception e) {
            return null;
        }
        if (raw == null || raw.trim().isEmpty()) return null;
        try {
            // Throws unless the whole string is one JSON OBJECT — an array or
            // a bare primitive lands in the catch below, like the TS/JS copies'
            // Array.isArray()/typeof guards.
            JSONObject o = new JSONObject(raw);
            // Strict, like the TS/JS copies: the opt* coercions would happily
            // turn "1" (or 1.5) into a 1, while those copies compare with ===
            // against the number 1 — so test the runtime type AND the exact
            // value. NaN fails the comparison and is refused too.
            Object version = o.opt("v");
            if (!(version instanceof Number)) return null;
            if (((Number) version).doubleValue() != (double) SESSION_VERSION) return null;

            String hs = validHomeserverUrl(o.opt("homeserverUrl"));
            String token = nonBlankString(o.opt("accessToken"));
            String user = validUserId(o.opt("userId"));
            // All or nothing. A half-filled record is exactly the failure the
            // single-key record exists to make unrepresentable.
            if (hs == null || token == null || user == null) return null;

            // deviceId is optional by design (no device id → this service
            // simply never suppresses), but a WRONG type means the record is
            // corrupt, not partial. A JSON null arrives as the JSONObject.NULL
            // singleton, NOT as a Java null, so it needs its own test — and it
            // must resolve to "absent", not to "corrupt".
            Object rawDevice = o.opt("deviceId");
            String deviceId = null;
            if (rawDevice instanceof String) {
                deviceId = nonBlankString(rawDevice);
            } else if (rawDevice != null && rawDevice != JSONObject.NULL) {
                return null;
            }

            // Trailing-slash strip: exactly once, at the one point the URL
            // enters this service, because every request below is
            // hs + "/_matrix/…" and "https://hs/" would double the slash. No
            // TS/JS counterpart — those copies do not build URLs this way.
            // Cannot eat the host: a hostless URL was refused above.
            return new SessionRecord(hs.replaceAll("/+$", ""), token, user, deviceId);
        } catch (Exception e) {
            return null; // not JSON, not an object, or anything unexpected
        }
    }

    // ── Active-session suppression ──────────────────────────────────────────

    /**
     * Hand-written mirror of parseActiveSession() + shouldSuppressForActiveDevice()
     * in src/lib/utils/activeSession.ts (static/sw.js carries the third copy) —
     * Java cannot import TypeScript, so keep all three in step.
     *
     * Returns false (i.e. NOTIFY) on every ambiguity: missing session, failed
     * or non-200 request, malformed JSON, wrong types, our own device, the
     * feature switched off, or a clock too far in the future. A suppression
     * bug must never eat a notification.
     *
     * Blocking, like the enrichment fetches around it — onMessageReceived
     * already runs on a Firebase background thread, and httpGet is bounded by
     * the 5s connect/read timeouts.
     */
    private boolean shouldStayQuiet(String hs, String token, String userId, String deviceId) {
        if (hs == null || token == null || userId == null || deviceId == null) return false;
        if (userId.isEmpty() || deviceId.isEmpty()) return false;
        try {
            String url = hs + "/_matrix/client/v3/user/" + enc(userId)
                + "/account_data/" + enc(ACTIVE_SESSION_KEY);
            String body = httpGet(url, token);
            if (body == null) return false; // no blob, or the request failed
            JSONObject blob = new JSONObject(body);

            // Strict parse: mirrors parseActiveSession()'s typeof checks. The
            // opt*/get* coercions would happily turn a number into a string
            // (or a string into a long), which TypeScript rejects — so test
            // the runtime types instead.
            Object rawDevice = blob.opt("deviceId");
            Object rawTs = blob.opt("ts");
            Object rawGrace = blob.opt("graceMs");
            if (!(rawDevice instanceof String)) return false;
            if (!(rawTs instanceof Number)) return false;
            if (!(rawGrace instanceof Number)) return false;

            String otherDevice = (String) rawDevice;
            if (otherDevice.isEmpty()) return false;
            if (otherDevice.equals(deviceId)) return false; // our own heartbeat

            // Mirrors parseActiveSession()'s Number.isFinite() rejection. A
            // JSON NaN/Infinity reaches us as a Double and longValue() coerces
            // it (NaN → 0, ±Infinity → the saturated Long bounds) instead of
            // failing, so the fail-open outcome would depend on which guard
            // below happens to catch it. Reject up front, like the TS/JS copies.
            // Double.isFinite is API 24+; minSdk is 24 (android/variables.gradle).
            if (!Double.isFinite(((Number) rawTs).doubleValue())) return false;
            if (!Double.isFinite(((Number) rawGrace).doubleValue())) return false;

            long ts = ((Number) rawTs).longValue();
            long graceMs = ((Number) rawGrace).longValue();
            if (graceMs <= 0) return false; // feature off

            long now = System.currentTimeMillis();
            // A negative ts is nonsense everywhere, but only this copy can be
            // hurt by it: a JSON number like -1e300 parses as a Double and
            // longValue() saturates to Long.MIN_VALUE, so `now - ts` OVERFLOWS
            // to a large negative number, slips under the grace comparison and
            // silently drops the notification. The TS and JS copies use IEEE
            // doubles, cannot overflow, and would notify — match them.
            if (ts < 0) return false;
            if (ts > now + MAX_FUTURE_SKEW_MS) return false; // broken clock
            return now - ts < Math.min(graceMs, MAX_GRACE_MS);
        } catch (Exception e) {
            return false; // anything unexpected (network, parse) → notify
        }
    }

    // ── Homeserver queries ──────────────────────────────────────────────────

    private JSONObject fetchEvent(String hs, String token, String roomId, String eventId) {
        String url = hs + "/_matrix/client/v3/rooms/" + enc(roomId) + "/event/" + enc(eventId);
        String json = httpGet(url, token);
        if (json == null) return null;
        try {
            return new JSONObject(json);
        } catch (Exception e) {
            return null;
        }
    }

    private String fetchRoomName(String hs, String token, String roomId) {
        String url = hs + "/_matrix/client/v3/rooms/" + enc(roomId)
            + "/state/m.room.name/";
        String json = httpGet(url, token);
        if (json == null) return null;
        try {
            String name = new JSONObject(json).optString("name", "");
            return name.isEmpty() ? null : name;
        } catch (Exception e) {
            return null;
        }
    }

    private String fetchRoomAvatar(String hs, String token, String roomId) {
        String url = hs + "/_matrix/client/v3/rooms/" + enc(roomId)
            + "/state/m.room.avatar/";
        String json = httpGet(url, token);
        if (json == null) return null;
        try {
            String mxc = new JSONObject(json).optString("url", "");
            return mxc.startsWith("mxc://") ? mxc : null;
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Treat a room as a DM if it has at most two joined members. (Cheaper and
     * more reliable from a background service than reading m.direct account
     * data, which would need extra normalisation.)
     */
    private boolean isDirectRoom(String hs, String token, String roomId) {
        String url = hs + "/_matrix/client/v3/rooms/" + enc(roomId) + "/joined_members";
        String json = httpGet(url, token);
        if (json == null) return false;
        try {
            JSONObject joined = new JSONObject(json).optJSONObject("joined");
            return joined != null && joined.length() <= 2;
        } catch (Exception e) {
            return false;
        }
    }

    /** A user's avatar: per-room member state first, then global profile. */
    private String fetchUserAvatar(String hs, String token, String roomId, String userId) {
        String memberUrl = hs + "/_matrix/client/v3/rooms/" + enc(roomId)
            + "/state/m.room.member/" + enc(userId);
        String json = httpGet(memberUrl, token);
        if (json != null) {
            try {
                String mxc = new JSONObject(json).optString("avatar_url", "");
                if (mxc.startsWith("mxc://")) return mxc;
            } catch (Exception ignored) {}
        }
        String profileUrl = hs + "/_matrix/client/v3/profile/" + enc(userId) + "/avatar_url";
        json = httpGet(profileUrl, token);
        if (json != null) {
            try {
                String mxc = new JSONObject(json).optString("avatar_url", "");
                if (mxc.startsWith("mxc://")) return mxc;
            } catch (Exception ignored) {}
        }
        return null;
    }

    private String fetchSenderName(String hs, String token, String roomId, String userId) {
        if (userId == null || userId.isEmpty()) return null;
        // Per-room display name (member state) first; fall back to global profile.
        String memberUrl = hs + "/_matrix/client/v3/rooms/" + enc(roomId)
            + "/state/m.room.member/" + enc(userId);
        String json = httpGet(memberUrl, token);
        if (json != null) {
            try {
                String n = new JSONObject(json).optString("displayname", "");
                if (!n.isEmpty()) return n;
            } catch (Exception ignored) {}
        }
        String profileUrl = hs + "/_matrix/client/v3/profile/" + enc(userId) + "/displayname";
        json = httpGet(profileUrl, token);
        if (json != null) {
            try {
                String n = new JSONObject(json).optString("displayname", "");
                if (!n.isEmpty()) return n;
            } catch (Exception ignored) {}
        }
        return null;
    }

    /** Download an mxc:// thumbnail as a Bitmap (authenticated media endpoint). */
    private Bitmap fetchMxcThumbnail(String hs, String token, String mxc, int size) {
        // mxc://server/mediaId
        String rest = mxc.substring("mxc://".length());
        int slash = rest.indexOf('/');
        if (slash < 0) return null;
        String server = rest.substring(0, slash);
        String mediaId = rest.substring(slash + 1);
        String url = hs + "/_matrix/client/v1/media/thumbnail/" + enc(server) + "/"
            + enc(mediaId) + "?width=" + size + "&height=" + size + "&method=crop";
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setConnectTimeout(CONNECT_TIMEOUT);
            conn.setReadTimeout(READ_TIMEOUT);
            conn.setRequestProperty("Authorization", "Bearer " + token);
            if (conn.getResponseCode() != 200) return null;
            try (InputStream is = conn.getInputStream()) {
                return BitmapFactory.decodeStream(is);
            }
        } catch (Exception e) {
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private String httpGet(String urlStr, String token) {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(urlStr).openConnection();
            conn.setConnectTimeout(CONNECT_TIMEOUT);
            conn.setReadTimeout(READ_TIMEOUT);
            conn.setRequestProperty("Authorization", "Bearer " + token);
            int code = conn.getResponseCode();
            if (code != 200) return null;
            try (InputStream is = conn.getInputStream()) {
                java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
                byte[] buf = new byte[4096];
                int n;
                while ((n = is.read(buf)) != -1) out.write(buf, 0, n);
                return out.toString("UTF-8");
            }
        } catch (Exception e) {
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static String enc(String s) {
        try {
            return URLEncoder.encode(s, "UTF-8").replace("+", "%20");
        } catch (Exception e) {
            return Uri.encode(s);
        }
    }

    // ── Notification ──────────────────────────────────────────────────────────

    private void showNotification(String title, String body, String roomId, String eventId, Bitmap largeIcon) {
        createChannel();

        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        // Stamp the account this was posted under so the web layer can refuse
        // to open it in a different session (audit PRIV-02). With no stored
        // identity we cannot attribute the notification, so we deliberately do
        // NOT attach a room id: it still shows, but tapping it only opens the
        // app instead of deep-linking whoever is signed in now into a room
        // from a session we cannot name.
        //
        // Read here rather than threaded in from onMessageReceived: the read
        // there lives inside the enrichment try/catch, so a failure before it
        // would drop the stamp for a session we can still name. Reads the single
        // session record (readSessionRecord) — the same source every other read
        // in this file uses — not the deprecated per-field legacy keys; guarded
        // because showNotification() is called OUTSIDE that try and a throw here
        // would cost the whole notification.
        String postedBy = null;
        try {
            SharedPreferences notifPrefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            SessionRecord postedSession = readSessionRecord(notifPrefs);
            postedBy = postedSession != null ? postedSession.userId : null;
        } catch (Throwable ignored) {}
        if (roomId != null && postedBy != null && !postedBy.isEmpty()) {
            intent.putExtra("room_id", roomId);
            intent.putExtra("user_id", postedBy);
            // The event this push named, so a tap jumps to the exact message and
            // not just the room. Only stamped alongside a routable room id.
            if (eventId != null && !eventId.isEmpty()) {
                intent.putExtra("event_id", eventId);
            }
        }

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pending = PendingIntent.getActivity(
            this, roomId != null ? roomId.hashCode() : 0, intent, flags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            // Small (status-bar) icon: Android renders it from the alpha channel
            // only, so it must be a transparent-background silhouette. The
            // adaptive foreground layer is a white-on-transparent logo, unlike
            // ic_launcher (a near-opaque square that would show as a blob).
            .setSmallIcon(R.mipmap.ic_launcher_adaptive_fore)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setContentIntent(pending);

        // Quick-reply (RemoteInput) + mark-as-read actions, only when routable
        // (same guard as the content-intent stamp: an unattributable notification
        // must stay non-actionable too). The reply PendingIntent is FLAG_MUTABLE
        // (RemoteInput fills the intent on Android 12+; FLAG_IMMUTABLE breaks it).
        if (roomId != null && postedBy != null && !postedBy.isEmpty()) {
            RemoteInput remoteInput = new RemoteInput.Builder("key_text_reply")
                .setLabel("Reply")
                .build();

            // FLAG_MUTABLE is required for RemoteInput on Android 12+ (API 31).
            // On older versions, PendingIntents are mutable by default.
            int replyFlags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                replyFlags |= PendingIntent.FLAG_MUTABLE;
            }

            Intent replyIntent = new Intent(this, MessageActionReceiver.class);
            replyIntent.setAction(MessageActionReceiver.ACTION_REPLY);
            replyIntent.putExtra("room_id", roomId);
            replyIntent.putExtra("user_id", postedBy);
            if (eventId != null && !eventId.isEmpty()) {
                replyIntent.putExtra("event_id", eventId);
            }
            PendingIntent replyPending = PendingIntent.getBroadcast(
                this, (roomId + ":reply").hashCode(), replyIntent, replyFlags);

            NotificationCompat.Action replyAction = new NotificationCompat.Action.Builder(
                0, "Reply", replyPending)
                .addRemoteInput(remoteInput)
                .setAllowGeneratedReplies(false)
                .build();

            Intent markReadIntent = new Intent(this, MessageActionReceiver.class);
            markReadIntent.setAction(MessageActionReceiver.ACTION_MARK_READ);
            markReadIntent.putExtra("room_id", roomId);
            markReadIntent.putExtra("user_id", postedBy);
            if (eventId != null && !eventId.isEmpty()) {
                markReadIntent.putExtra("event_id", eventId);
            }
            PendingIntent markReadPending = PendingIntent.getBroadcast(
                this, (roomId + ":markread").hashCode(), markReadIntent, flags);

            builder.addAction(replyAction);
            builder.addAction(0, "Mark as read", markReadPending);
        }

        if (largeIcon != null) builder.setLargeIcon(largeIcon);

        int notificationId = roomId != null ? roomId.hashCode() : (int) System.currentTimeMillis();

        try {
            NotificationManagerCompat.from(this).notify(notificationId, builder.build());
        } catch (SecurityException ignored) {}
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager == null) return;
            if (manager.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("New message notifications");
                manager.createNotificationChannel(channel);
            }
        }
    }

    /**
     * Full-screen ringing notification for an incoming DM call (m.call.notify).
     * Category CALL + ongoing + a ring sound + a full-screen intent so it wakes
     * the screen and shows over the lockscreen, with Accept/Decline actions.
     *
     * Full-screen intent + Android 14+ (API 34): USE_FULL_SCREEN_INTENT is
     * declared in the manifest, but on API 34+ the OS grants it by default only
     * to apps whose core function is calling/alarms; otherwise the system
     * downgrades the full-screen intent to a heads-up notification (which still
     * rings and shows the actions — the call is not lost, only not full-screen).
     * The user can grant "Full screen intents" in Settings > Apps > Special app
     * access. We cannot prompt from a background service, and canUseFullScreenIntent()
     * only reports the state, so we always set it and let the OS decide.
     */
    private void showCallNotification(String callerName, String roomId, Bitmap largeIcon) {
        createCallChannel();

        String display = (callerName != null && !callerName.trim().isEmpty())
            ? callerName.trim() : "Someone";

        // Account stamp: only attribute (deep-link + join) when we can name the
        // poster, mirroring showNotification()'s PRIV-02 guard.
        String postedBy = null;
        try {
            SharedPreferences notifPrefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            SessionRecord postedSession = readSessionRecord(notifPrefs);
            postedBy = postedSession != null ? postedSession.userId : null;
        } catch (Throwable ignored) {}
        boolean routable = roomId != null && postedBy != null && !postedBy.isEmpty();

        int notificationId = roomId != null ? roomId.hashCode() : (int) System.currentTimeMillis();

        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            piFlags |= PendingIntent.FLAG_IMMUTABLE;
        }

        // Accept / full-screen: open the app to the room AND join the call.
        Intent answerIntent = new Intent(this, MainActivity.class);
        answerIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (routable) {
            answerIntent.putExtra("room_id", roomId);
            answerIntent.putExtra("user_id", postedBy);
            answerIntent.putExtra("join_call", true);
        }
        PendingIntent answerPending = PendingIntent.getActivity(
            this, notificationId, answerIntent, piFlags);

        // Body tap (not a button): open the room; the in-app ringer offers Accept.
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (routable) {
            openIntent.putExtra("room_id", roomId);
            openIntent.putExtra("user_id", postedBy);
        }
        PendingIntent openPending = PendingIntent.getActivity(
            this, notificationId + 1, openIntent, piFlags);

        // Decline: cancel the notification without opening the app.
        Intent declineIntent = new Intent(this, CallActionReceiver.class);
        declineIntent.setAction(CallActionReceiver.ACTION_DECLINE);
        declineIntent.putExtra(CallActionReceiver.EXTRA_NOTIFICATION_ID, notificationId);
        PendingIntent declinePending = PendingIntent.getBroadcast(
            this, notificationId + 2, declineIntent, piFlags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CALL_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher_adaptive_fore)
            .setContentTitle("Incoming call")
            .setContentText(display)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setOngoing(true)
            .setAutoCancel(false)
            .setContentIntent(openPending)
            .setFullScreenIntent(answerPending, true)
            .addAction(0, "Accept", answerPending)
            .addAction(0, "Decline", declinePending);

        // Pre-O has no channels, so the ring sound + vibration ride on the
        // builder. On O+ the channel owns both (these calls are ignored there).
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            builder.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE));
            builder.setVibrate(new long[] {0, 1000, 1000});
        }

        if (largeIcon != null) builder.setLargeIcon(largeIcon);

        try {
            NotificationManagerCompat.from(this).notify(notificationId, builder.build());
        } catch (SecurityException ignored) {}
    }

    private void createCallChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager == null) return;
            if (manager.getNotificationChannel(CALL_CHANNEL_ID) == null) {
                NotificationChannel channel = new NotificationChannel(
                    CALL_CHANNEL_ID,
                    CALL_CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Incoming call notifications");
                Uri ringtone = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
                AudioAttributes attrs = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();
                if (ringtone != null) channel.setSound(ringtone, attrs);
                channel.enableVibration(true);
                channel.setVibrationPattern(new long[] {0, 1000, 1000});
                // A call should ring through Do Not Disturb.
                try {
                    channel.setBypassDnd(true);
                } catch (Throwable ignored) {}
                manager.createNotificationChannel(channel);
            }
        }
    }
}
