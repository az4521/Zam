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

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.Person;
import androidx.core.app.RemoteInput;
import androidx.core.content.pm.ShortcutInfoCompat;
import androidx.core.content.pm.ShortcutManagerCompat;
import androidx.core.graphics.drawable.IconCompat;
import android.service.notification.StatusBarNotification;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;

import org.json.JSONArray;
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

    // Matches the Capacitor Preferences store + the single session record
    // written by src/lib/utils/nativeSessionRecord.ts (via nativeSession.ts).
    // Both strings are hand-typed: KEY_SESSION must stay equal to
    // NATIVE_SESSION_KEY there (and SESSION_KEY in static/sw.js).
    static final String PREFS = "CapacitorStorage";
    private static final String KEY_SESSION = "matrix_session_record";
    // Every signed-in account's record, keyed by user id: NATIVE_ACCOUNTS_KEY
    // in nativeSessionRecord.ts. Each value is a record string as above.
    private static final String KEY_SESSION_ACCOUNTS = "matrix_session_accounts";
    // The push data field naming the account a push is for: the pusher's
    // default_payload, set in src/lib/push.ts.
    static final String ACCOUNT_KEY = "zam_account";
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
    // The account's "Ring for incoming DM calls" setting, mirrored by
    // syncNativeRingEnabled() in src/lib/nativeSession.ts. Absent → ring
    // (the setting's default).
    private static final String KEY_RING_ENABLED = "matrix_ring_enabled";

    private static final int CONNECT_TIMEOUT = 5000;
    private static final int READ_TIMEOUT = 5000;
    // How long to wait for the web layer to decrypt an encrypted message.
    private static final long DECRYPT_TIMEOUT = 4000L;
    // ...and for the hidden WebView to start, load the crypto WASM and decrypt
    // it when the app is not running.
    private static final long HEADLESS_DECRYPT_TIMEOUT = 8000L;

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

        // Priority as sent vs as delivered: FCM downgrades high-priority
        // messages that keep ending without a visible notification, and a
        // downgraded one waits for the phone to wake. The delay shows it.
        try {
            long sent = remoteMessage.getSentTime();
            PushLog.log(this, "fcm received: priority " + priorityName(remoteMessage.getPriority())
                + " (sent as " + priorityName(remoteMessage.getOriginalPriority()) + ")"
                + (sent > 0 ? ", " + (System.currentTimeMillis() - sent) + "ms after sending" : "")
                + (remoteMessage.getNotification() != null ? ", has notification block" : ""));
        } catch (Throwable ignored) {}

        // A message carrying its own notification block is shown elsewhere.
        if (remoteMessage.getNotification() != null) return;

        Map<String, String> data = remoteMessage.getData();
        handleMatrixPush(this, data.get("room_id"), data.get("event_id"), data.get("unread"),
            data.get(ACCOUNT_KEY));
    }

    /**
     * Turn one Matrix push (event_id_only: just ids and the unread count) into
     * a notification, a cleared notification, or an incoming call. Shared by
     * both transports: FCM (onMessageReceived above) and UnifiedPush
     * (UnifiedPushService). Blocking: it makes several homeserver requests,
     * so it must run off the main thread.
     *
     * `accountId` is the account the push names (null from a pusher that has
     * not re-registered since pushes were tagged: the active account then).
     */
    private static String priorityName(int p) {
        switch (p) {
            case RemoteMessage.PRIORITY_HIGH: return "high";
            case RemoteMessage.PRIORITY_NORMAL: return "normal";
            default: return "unknown";
        }
    }

    static void handleMatrixPush(Context ctx, String roomId, String eventId, String unreadStr,
            String accountId) {
        final long startedAt = System.currentTimeMillis();
        final String tag = "push room " + PushLog.shortId(roomId) + " event "
            + PushLog.shortId(eventId) + ": ";
        PushLog.log(ctx, tag + "start, unread " + unreadStr
            + (accountId != null ? ", names an account" : ", no account named"));
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
                            NotificationManagerCompat.from(ctx)
                                .cancel(roomId.hashCode());
                        } catch (Throwable ignored) {}
                    }
                    PushLog.log(ctx, tag + "clear push (room read), notification removed");
                    return;
                }
            } catch (NumberFormatException ignored) {}
        }

        // The account this push is for, resolved ONCE: every request, the
        // decryption and the notification's account stamp use this record.
        // Null for an account no longer on this device: the generic text,
        // unattributed.
        SessionRecord session = null;
        boolean sessionIsActive = false;
        try {
            SharedPreferences sessionPrefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            SessionRecord active = readSessionRecord(sessionPrefs);
            session = resolveSession(sessionPrefs, active, accountId);
            sessionIsActive = session != null && session == active;
        } catch (Throwable ignored) {}
        if (session == null) {
            PushLog.log(ctx, tag + "no signed-in session matches; generic notification");
        }
        // The app is open on this account: the user sees the message in the
        // app itself, so a notification would only duplicate it. Checked
        // here to skip the enrichment requests, and again before posting in
        // case the app came forward meanwhile. Another account's push still
        // notifies — the open app only syncs the active one.
        if (sessionIsActive && MainActivity.isInForeground()) {
            PushLog.log(ctx, tag + "skipped: app is open (resumed) on this account");
            return;
        }
        final String postedBy = session != null ? session.userId : null;

        // Defaults (used if enrichment fails).
        String title = "New message";
        String text = "You have a new message";
        Bitmap largeIcon = null;
        // MSC4075 m.call.notify → render an incoming CALL, not a message.
        boolean isCall = false;
        String callerName = null;
        // The message's author and the room kind, for the conversation
        // notification (a per-person channel, shortcut and message history).
        String msgSenderId = null;
        String msgSenderName = null;
        Bitmap senderIcon = null;
        boolean msgDm = false;
        long msgTs = System.currentTimeMillis();
        String msgBody = null;
        Bitmap msgImage = null;

        try {
            SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            // The whole credential tuple comes from the ONE record resolved
            // above. It used to be four independent reads, which was four
            // chances to pick up a torn set (see the record mirror below).
            // Null → no usable credentials.
            String hs = session != null ? session.homeserverUrl : null;
            String token = session != null ? session.accessToken : null;
            String selfUserId = session != null ? session.userId : null;
            String selfDeviceId = session != null ? session.deviceId : null;

            // Another device is demonstrably in use → stay quiet. Checked
            // before the enrichment fetches below so a suppressed push costs
            // one request instead of five. Never throws; false on any doubt.
            if (shouldStayQuiet(ctx, tag, hs, token, selfUserId, selfDeviceId)) return;
            // Device-global "hide message text in notifications" privacy setting,
            // mirrored by src/lib/nativeSession.ts. Capacitor Preferences stores
            // every value as a String, so compare rather than getBoolean() (which
            // would throw ClassCastException on a String-typed entry, and the
            // catch below would silently swallow ALL enrichment). Absent key →
            // "false" → bodies stay visible, today's behaviour.
            boolean hideBody = "true".equals(prefs.getString(KEY_HIDE_BODY, "false"));
            boolean ringEnabled = !"false".equals(prefs.getString(KEY_RING_ENABLED, "true"));

            // Same gate as before, one notch stricter: a non-null record
            // guarantees BOTH hs and token are present and well-formed (and
            // that they came from the same write), so no valid session can
            // lose enrichment here.
            if (session != null && roomId != null && eventId != null) {
                // Room display name.
                // (A DM overrides this with the other person's name below.)
                String roomName = fetchRoomName(hs, token, roomId);
                if (roomName != null) title = roomName;

                // The event itself → sender + body.
                String sender = "";
                // DM-ness, fetched at most once (the call gate and the avatar
                // fallback below both need it). Null until asked.
                Boolean direct = null;
                JSONObject event = fetchEvent(hs, token, roomId, eventId);
                // An invite: the push names our own invite event, which an
                // invitee usually cannot fetch (only joined members see a
                // room under "shared" history). Either way the room's
                // stripped state says who invited us and to what.
                if (event == null || isOwnInvite(event, selfUserId)) {
                    InviteInfo invite = fetchInvite(hs, token, selfUserId, roomId);
                    if (invite != null) {
                        PushLog.log(ctx, tag + "invite"
                            + (invite.isSpace ? " to a space" : invite.isDirect ? " to a DM" : ""));
                        String[] inviteText = inviteNotification(invite);
                        Bitmap inviteIcon = inviteText[2] != null
                            ? fetchMxcThumbnail(hs, token, inviteText[2], 128) : null;
                        if (sessionIsActive && MainActivity.isInForeground()) {
                            PushLog.log(ctx, tag + "skipped: app came to the front during enrichment");
                            return;
                        }
                        showInviteNotification(ctx, inviteText[0], inviteText[1], roomId,
                            inviteIcon, postedBy);
                        return;
                    }
                }
                if (event != null) {
                    sender = event.optString("sender", "");
                    long originTs = event.optLong("origin_server_ts", 0L);
                    if (originTs > 0) msgTs = originTs;
                    // This service holds no E2EE keys, so an encrypted
                    // message is still m.room.encrypted here. Ask the web
                    // layer to decrypt it when the app is running (see
                    // PushDecryptPlugin), otherwise decrypt it in a hidden
                    // WebView (HeadlessDecryptor). Failing both, keep the
                    // generic text.
                    if ("m.room.encrypted".equals(event.optString("type", ""))) {
                        // The running app only holds the ACTIVE account's
                        // keys; another account's store is free for the
                        // hidden decryptor even while the app is open.
                        PushDecryptPlugin.Result clear = sessionIsActive
                            ? PushDecryptPlugin.request(roomId, eventId, DECRYPT_TIMEOUT)
                            : null;
                        if (clear == null) {
                            clear = HeadlessDecryptor.decrypt(ctx, hs, token,
                                selfUserId, selfDeviceId, roomId, event,
                                HEADLESS_DECRYPT_TIMEOUT);
                        }
                        if (clear != null) {
                            event.put("type", clear.type);
                            event.put("content", clear.content);
                        }
                    }
                    JSONObject content = event.optJSONObject("content");
                    String body = content != null ? content.optString("body", "") : "";
                    String senderName = fetchSenderName(hs, token, roomId, sender);
                    if (senderName == null || senderName.isEmpty()) senderName = sender;

                    String name = senderName.trim();

                    // A DM is titled by the other person, and the sender is
                    // not repeated in the text: it would only say the same
                    // name twice. (A DM usually has no m.room.name, which is
                    // why the title used to stay "New message".)
                    if (direct == null) direct = isDirectRoom(hs, token, selfUserId, roomId);
                    final boolean dm = direct;
                    if (dm && !name.isEmpty()) title = name;
                    msgSenderId = sender;
                    msgSenderName = name.isEmpty() ? sender : name;
                    msgDm = dm;

                    // Same rule as pushNotificationKind() (src/lib/utils) and
                    // buildNotification() in static/sw.js: an MSC4075 ring (the
                    // SDK's rtc.notification with notification_type "ring", or an
                    // older call-notify with a "ring"/absent notify_type) is an
                    // incoming CALL.
                    // The event TYPE decides (event_id_only pushes carry no
                    // tweak). The unstable type is what is actually stored/pushed;
                    // the stable one is accepted too.
                    String type = event.optString("type", "");
                    boolean isRtcNotification =
                        type.equals("org.matrix.msc4075.rtc.notification");
                    boolean isCallType = isRtcNotification
                        || type.equals("org.matrix.msc4075.call.notify")
                        || type.equals("m.call.notify");
                    boolean wantsRing;
                    if (isRtcNotification) {
                        // matrix-js-sdk 43's ring: notification_type, and it
                        // stops ringing at sender_ts + lifetime (capped at 2
                        // minutes), so a late push doesn't ring for a call
                        // that already gave up.
                        wantsRing = content != null
                            && "ring".equals(content.optString("notification_type", ""));
                        if (wantsRing && content.has("sender_ts") && content.has("lifetime")) {
                            long ends = content.optLong("sender_ts")
                                + Math.min(content.optLong("lifetime"), 120000L);
                            if (System.currentTimeMillis() > ends) wantsRing = false;
                        }
                    } else {
                        // Older call-notify: an absent notify_type means ring.
                        wantsRing = "ring".equals(content != null
                            ? content.optString("notify_type", "ring") : "ring");
                    }
                    //
                    // Only a DM rings like a phone call. A room or space call
                    // is join-on-demand (same rule as the in-app ringer in
                    // src/lib/stores/incomingCalls.svelte.ts), so it gets a
                    // plain message-style notification even if the sender's
                    // client asked for a ring.
                    if (isCallType && wantsRing && dm) {
                        if (ringEnabled) {
                            isCall = true;
                            callerName = name;
                        } else {
                            // Ringing turned off in settings: still say so,
                            // as a plain notification.
                            text = name.isEmpty() ? "Incoming call" : name + " is calling";
                        }
                    } else if (isCallType) {
                        text = name.isEmpty() || dm ? "A call started" : name + " started a call";
                    } else {
                        // Same comparisons as notificationBody() in
                        // src/lib/utils/notificationPrivacy.ts (and
                        // buildNotification() in static/sw.js): trim both sides so
                        // a whitespace-only body counts as absent, and drop the
                        // message text entirely when the privacy setting is on.
                        // The room name still becomes the title — only the
                        // message text is gated.
                        String preview = hideBody ? "" : body.trim();
                        // A picture (m.image, or a sticker) is shown in the
                        // notification itself; never when message text is hidden.
                        String msgtype = content != null ? content.optString("msgtype", "") : "";
                        boolean isImage = type.equals("m.sticker")
                            || (type.equals("m.room.message") && msgtype.equals("m.image"));
                        if (isImage && !hideBody && content != null) {
                            msgImage = fetchNotificationImage(ctx, hs, token, content);
                            // The body of an image is its file name unless a
                            // caption was given (then filename differs).
                            String fileName = content.optString("filename", "");
                            boolean caption = !fileName.isEmpty() && !fileName.equals(preview);
                            if (!caption) preview = "";
                            if (preview.isEmpty()) {
                                msgBody = "Sent an image";
                                text = dm || name.isEmpty() ? "Sent an image"
                                    : name + " sent an image";
                            }
                        }
                        if (!preview.isEmpty()) {
                            msgBody = preview;
                            text = name.isEmpty() || dm ? preview : name + ": " + preview;
                        } else if (!name.isEmpty()) {
                            text = dm ? "Sent a message" : name + " sent a message";
                        }
                    }
                }

                // Large icon: room avatar, or — for a DM with no room avatar —
                // the other member's (i.e. the sender's) avatar.
                String avatarMxc = fetchRoomAvatar(hs, token, roomId);
                if (avatarMxc == null && !sender.isEmpty()
                        && (direct != null ? direct : isDirectRoom(hs, token, selfUserId, roomId))) {
                    avatarMxc = fetchUserAvatar(hs, token, roomId, sender);
                }
                if (avatarMxc != null) {
                    largeIcon = fetchMxcThumbnail(hs, token, avatarMxc, 128);
                }
                // The sender's own avatar, for their line in the conversation.
                if (!sender.isEmpty()) {
                    String senderMxc = fetchUserAvatar(hs, token, roomId, sender);
                    if (senderMxc != null) {
                        senderIcon = fetchMxcThumbnail(hs, token, senderMxc, 128);
                    }
                }
            }
        } catch (Throwable t) {
            // Any failure → fall back to the generic notification.
            PushLog.log(ctx, tag + "enrichment failed: " + t.getClass().getSimpleName());
        }
        PushLog.log(ctx, tag + "enriched in " + (System.currentTimeMillis() - startedAt) + "ms"
            + (msgSenderId != null ? "" : " (event not fetched)")
            + (msgBody != null || msgImage != null ? "" : ", no message text"));

        if (isCall) {
            // App already in front: the in-app ringer shows the call (and
            // rings) itself — a second, notification ringtone would double up.
            if (MainActivity.isInForeground()) {
                PushLog.log(ctx, tag + "call skipped: app is open, in-app ringer has it");
                return;
            }
            PushLog.log(ctx, tag + "ringing call");
            // Account stamp: only attribute (deep-link + join) when we can
            // name the poster, mirroring showNotification()'s PRIV-02 guard.
            // Report it to the system call stack so it rings like a phone
            // call (Bluetooth / car / watch can answer, a cellular call can
            // interrupt it properly). Telecom then asks MatrixConnection to
            // post the ringing notification. Without Telecom, post it here.
            boolean viaTelecom = roomId != null
                && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && TelecomCalls.reportIncoming(ctx, roomId, callerName, postedBy, largeIcon);
            if (!viaTelecom) {
                IncomingCallNotification.show(ctx, callerName, roomId, postedBy, largeIcon);
            }
        } else {
            if (sessionIsActive && MainActivity.isInForeground()) {
                PushLog.log(ctx, tag + "skipped: app came to the front during enrichment");
                return;
            }
            showNotification(ctx, title, text, roomId, eventId, largeIcon, postedBy,
                msgSenderId, msgSenderName, senderIcon, msgDm, msgTs, msgBody, msgImage);
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
    static final class SessionRecord {
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
    static SessionRecord readSessionRecord(SharedPreferences prefs) {
        String raw;
        try {
            // getString throws ClassCastException if anything ever stored a
            // non-String under the key; a corrupt store must not kill the
            // notification.
            raw = prefs.getString(KEY_SESSION, null);
        } catch (Exception e) {
            return null;
        }
        return parseSessionRecord(raw);
    }

    /**
     * The session for the account a push names: the active record when the
     * push names it (or names nothing), else that account's entry in the
     * all-accounts map. Null when the account is not on this device.
     * Mirror of parseNativeAccount() in nativeSessionRecord.ts. Never throws.
     */
    static SessionRecord resolveSession(SharedPreferences prefs, SessionRecord active,
            String accountId) {
        if (accountId == null || accountId.isEmpty()) return active;
        if (active != null && accountId.equals(active.userId)) return active;
        try {
            String raw = prefs.getString(KEY_SESSION_ACCOUNTS, null);
            if (raw == null) return null;
            Object entry = new JSONObject(raw).opt(accountId);
            if (!(entry instanceof String)) return null;
            SessionRecord record = parseSessionRecord((String) entry);
            // Filed under the wrong user id means a corrupt map, not a match.
            return record != null && accountId.equals(record.userId) ? record : null;
        } catch (Exception e) {
            return null;
        }
    }

    /** Strict parse of one stored record string; see readSessionRecord. */
    static SessionRecord parseSessionRecord(String raw) {
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
    private static boolean shouldStayQuiet(Context ctx, String tag, String hs, String token,
            String userId, String deviceId) {
        boolean quiet = shouldStayQuiet(hs, token, userId, deviceId);
        if (quiet) {
            PushLog.log(ctx, tag + "skipped: another device is active ("
                + lastQuietDetail + ")");
        }
        return quiet;
    }

    // Why the last shouldStayQuiet() said yes, for the push log only. Pushes
    // are handled one at a time on Firebase's thread; a stale value from a
    // UnifiedPush push racing it would only mislabel one log line.
    private static volatile String lastQuietDetail = "";

    private static boolean shouldStayQuiet(String hs, String token, String userId, String deviceId) {
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
            lastQuietDetail = "device " + otherDevice + " heartbeat " + (now - ts)
                + "ms ago, grace " + Math.min(graceMs, MAX_GRACE_MS) + "ms";
            return now - ts < Math.min(graceMs, MAX_GRACE_MS);
        } catch (Exception e) {
            return false; // anything unexpected (network, parse) → notify
        }
    }

    // ── Homeserver queries ──────────────────────────────────────────────────

    private static JSONObject fetchEvent(String hs, String token, String roomId, String eventId) {
        String url = hs + "/_matrix/client/v3/rooms/" + enc(roomId) + "/event/" + enc(eventId);
        String json = httpGet(url, token);
        if (json == null) return null;
        try {
            return new JSONObject(json);
        } catch (Exception e) {
            return null;
        }
    }

    private static String fetchRoomName(String hs, String token, String roomId) {
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

    private static String fetchRoomAvatar(String hs, String token, String roomId) {
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
     * Whether a room is a DM — the same source the in-app ringer uses
     * (getDirectRoomIds(): the account's m.direct data), so a call rings on
     * this device exactly when it would ring in the app. Only when m.direct
     * cannot be read at all does it fall back to "at most two joined
     * members", so a lookup failure still lets a real DM ring.
     */
    private static boolean isDirectRoom(String hs, String token, String userId, String roomId) {
        if (userId != null) {
            String direct = httpGet(hs + "/_matrix/client/v3/user/" + enc(userId)
                + "/account_data/m.direct", token);
            if (direct != null) {
                try {
                    JSONObject byUser = new JSONObject(direct);
                    java.util.Iterator<String> keys = byUser.keys();
                    while (keys.hasNext()) {
                        org.json.JSONArray rooms = byUser.optJSONArray(keys.next());
                        if (rooms == null) continue;
                        for (int n = 0; n < rooms.length(); n++) {
                            if (roomId.equals(rooms.optString(n))) return true;
                        }
                    }
                    return false;
                } catch (Exception ignored) {
                    // Malformed: fall through to the member count.
                }
            }
        }
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

    // ── Invites ─────────────────────────────────────────────────────────────

    /** What an invite's stripped state says. Mirror of parseInviteState() in static/sw.js. */
    static final class InviteInfo {
        String inviterId = "";
        String inviterName = "";
        String inviterAvatar = "";
        String roomName = "";
        String roomAvatar = "";
        boolean isSpace;
        boolean isDirect;
    }

    private static boolean isOwnInvite(JSONObject event, String selfUserId) {
        if (selfUserId == null || !"m.room.member".equals(event.optString("type", ""))) {
            return false;
        }
        JSONObject c = event.optJSONObject("content");
        return selfUserId.equals(event.optString("state_key", ""))
            && c != null && "invite".equals(c.optString("membership", ""));
    }

    /**
     * The room's pending invite for this account, from a one-room /sync: an
     * invitee cannot read the room's events or state, but sync hands out the
     * invite's stripped state. timeout=0 and set_presence=offline so this
     * neither waits nor marks the account online; next_batch is discarded, so
     * the app's own sync (and its to-device queue) is untouched. Null when
     * the room holds no pending invite for us.
     */
    private static InviteInfo fetchInvite(String hs, String token, String selfUserId,
            String roomId) {
        if (selfUserId == null) return null;
        try {
            JSONObject none = new JSONObject().put("not_types", new JSONArray().put("*"));
            JSONObject room = new JSONObject()
                .put("rooms", new JSONArray().put(roomId))
                .put("timeline", new JSONObject().put("limit", 0)
                    .put("not_types", new JSONArray().put("*")))
                .put("state", none)
                .put("ephemeral", none)
                .put("account_data", none)
                .put("include_leave", false);
            JSONObject filter = new JSONObject()
                .put("room", room)
                .put("presence", none)
                .put("account_data", none);
            String json = httpGet(hs + "/_matrix/client/v3/sync?timeout=0&set_presence=offline"
                + "&filter=" + enc(filter.toString()), token);
            if (json == null) return null;
            JSONObject rooms = new JSONObject(json).optJSONObject("rooms");
            JSONObject invites = rooms != null ? rooms.optJSONObject("invite") : null;
            JSONObject invited = invites != null ? invites.optJSONObject(roomId) : null;
            JSONObject state = invited != null ? invited.optJSONObject("invite_state") : null;
            JSONArray events = state != null ? state.optJSONArray("events") : null;
            InviteInfo info = parseInviteState(events, selfUserId);
            // Stripped state may lack the inviter's member event: their profile.
            if (info != null && !info.inviterId.isEmpty()
                    && (info.inviterName.isEmpty() || info.inviterAvatar.isEmpty())) {
                String profile = httpGet(hs + "/_matrix/client/v3/profile/"
                    + enc(info.inviterId), token);
                if (profile != null) {
                    JSONObject p = new JSONObject(profile);
                    if (info.inviterName.isEmpty()) {
                        info.inviterName = p.optString("displayname", "").trim();
                    }
                    if (info.inviterAvatar.isEmpty()) {
                        info.inviterAvatar = p.optString("avatar_url", "").trim();
                    }
                }
            }
            return info;
        } catch (Exception e) {
            return null;
        }
    }

    private static InviteInfo parseInviteState(JSONArray events, String selfUserId) {
        if (events == null) return null;
        JSONObject invite = null;
        String alias = "";
        InviteInfo info = new InviteInfo();
        java.util.Map<String, JSONObject> members = new java.util.HashMap<>();
        for (int i = 0; i < events.length(); i++) {
            JSONObject e = events.optJSONObject(i);
            if (e == null) continue;
            JSONObject c = e.optJSONObject("content");
            if (c == null) c = new JSONObject();
            String type = e.optString("type", "");
            if ("m.room.member".equals(type) && e.has("state_key")) {
                String key = e.optString("state_key", "");
                members.put(key, c);
                if (key.equals(selfUserId) && "invite".equals(c.optString("membership", ""))) {
                    invite = e;
                }
            } else if ("m.room.create".equals(type)) {
                info.isSpace = "m.space".equals(c.optString("type", ""));
            } else if ("m.room.name".equals(type)) {
                info.roomName = c.optString("name", "").trim();
            } else if ("m.room.canonical_alias".equals(type)) {
                alias = c.optString("alias", "").trim();
            } else if ("m.room.avatar".equals(type)) {
                info.roomAvatar = c.optString("url", "").trim();
            }
        }
        if (invite == null) return null;
        if (info.roomName.isEmpty()) info.roomName = alias;
        info.inviterId = invite.optString("sender", "").trim();
        JSONObject inviter = members.get(info.inviterId);
        if (inviter != null) {
            info.inviterName = inviter.optString("displayname", "").trim();
            info.inviterAvatar = inviter.optString("avatar_url", "").trim();
        }
        JSONObject own = invite.optJSONObject("content");
        info.isDirect = own != null && own.optBoolean("is_direct", false);
        return info;
    }

    /**
     * { title, text, avatar mxc or null } for an invite. A DM is the
     * inviter's; a space or a named room is the room's, with the inviter in
     * the text. Mirror of inviteNotificationText() in static/sw.js.
     */
    private static String[] inviteNotification(InviteInfo info) {
        String who = !info.inviterName.isEmpty() ? info.inviterName
            : !info.inviterId.isEmpty() ? info.inviterId : "Someone";
        String title;
        String text;
        String avatar;
        if (info.isSpace) {
            title = !info.roomName.isEmpty() ? info.roomName : "Space invite";
            text = who + " invited you to join this space";
            avatar = !info.roomAvatar.isEmpty() ? info.roomAvatar : info.inviterAvatar;
        } else if (info.isDirect || info.roomName.isEmpty()) {
            title = who;
            text = info.isDirect ? "Invited you to a direct chat" : "Invited you to a room";
            avatar = !info.inviterAvatar.isEmpty() ? info.inviterAvatar : info.roomAvatar;
        } else {
            title = info.roomName;
            text = who + " invited you to join this room";
            avatar = !info.roomAvatar.isEmpty() ? info.roomAvatar : info.inviterAvatar;
        }
        return new String[] { title, text, avatar.startsWith("mxc://") ? avatar : null };
    }

    /**
     * An invite: a plain notification on the shared channel, with Accept and
     * Decline instead of Reply and Mark-as-read (neither works in a room not
     * yet joined). Same id as the
     * room's message notification, so joining (a clear push) takes it down.
     */
    private static void showInviteNotification(Context ctx, String title, String text,
            String roomId, Bitmap icon, String postedBy) {
        createChannel(ctx);
        Intent intent = new Intent(ctx, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        // Same attribution guard as showNotification() (audit PRIV-02).
        if (postedBy != null && !postedBy.isEmpty()) {
            intent.putExtra("room_id", roomId);
            intent.putExtra("user_id", postedBy);
        }
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pending = PendingIntent.getActivity(ctx, roomId.hashCode(), intent, flags);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_notify)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
            .setCategory(NotificationCompat.CATEGORY_SOCIAL)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setContentIntent(pending);
        if (icon != null) builder.setLargeIcon(icon);
        // Accept / Decline, only when attributable (same guard as the tap).
        if (postedBy != null && !postedBy.isEmpty()) {
            Intent accept = new Intent(ctx, MainActivity.class);
            accept.setAction(MessageActionReceiver.ACTION_ACCEPT_INVITE);
            accept.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            accept.putExtra("room_id", roomId);
            accept.putExtra("user_id", postedBy);
            builder.addAction(0, "Accept", PendingIntent.getActivity(
                ctx, (roomId + ":accept").hashCode(), accept, flags));

            Intent decline = new Intent(ctx, MessageActionReceiver.class);
            decline.setAction(MessageActionReceiver.ACTION_DECLINE_INVITE);
            decline.putExtra("room_id", roomId);
            decline.putExtra("user_id", postedBy);
            builder.addAction(0, "Decline", PendingIntent.getBroadcast(
                ctx, (roomId + ":decline").hashCode(), decline, flags));
        }
        try {
            NotificationManagerCompat.from(ctx).notify(roomId.hashCode(), builder.build());
            PushLog.log(ctx, "posted invite for room " + PushLog.shortId(roomId)
                + describeDelivery(ctx, CHANNEL_ID));
        } catch (SecurityException e) {
            PushLog.log(ctx, "post refused (no notification permission) for room "
                + PushLog.shortId(roomId));
        }
    }

    /** A user's avatar: per-room member state first, then global profile. */
    private static String fetchUserAvatar(String hs, String token, String roomId, String userId) {
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

    private static String fetchSenderName(String hs, String token, String roomId, String userId) {
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

    private static final int IMAGE_MAX_PX = 800;
    private static final int IMAGE_MAX_BYTES = 10 * 1024 * 1024;

    /**
     * The picture of an m.image / m.sticker, for the notification. A GIF comes
     * back as its first frame (a notification cannot animate). Null on any
     * failure, so the notification just says an image was sent.
     */
    private static Bitmap fetchNotificationImage(Context ctx, String hs, String token,
            JSONObject content) {
        try {
            JSONObject file = content.optJSONObject("file");
            if (file != null) {
                // Encrypted: download the ciphertext, check it, decrypt it here.
                String mxc = file.optString("url", "");
                JSONObject key = file.optJSONObject("key");
                String iv = file.optString("iv", "");
                JSONObject hashes = file.optJSONObject("hashes");
                if (!mxc.startsWith("mxc://") || key == null || iv.isEmpty()) return null;
                byte[] cipher = downloadMxc(hs, token, mxc);
                if (cipher == null) return null;
                String want = hashes != null ? hashes.optString("sha256", "") : "";
                if (want.isEmpty()) return null;
                byte[] digest = java.security.MessageDigest.getInstance("SHA-256").digest(cipher);
                String got = android.util.Base64.encodeToString(digest,
                    android.util.Base64.NO_PADDING | android.util.Base64.NO_WRAP);
                if (!got.equals(want.replace("=", ""))) return null;
                byte[] k = android.util.Base64.decode(key.optString("k", ""),
                    android.util.Base64.URL_SAFE | android.util.Base64.NO_PADDING);
                byte[] ivBytes = android.util.Base64.decode(iv, android.util.Base64.DEFAULT);
                javax.crypto.Cipher aes = javax.crypto.Cipher.getInstance("AES/CTR/NoPadding");
                aes.init(javax.crypto.Cipher.DECRYPT_MODE,
                    new javax.crypto.spec.SecretKeySpec(k, "AES"),
                    new javax.crypto.spec.IvParameterSpec(ivBytes));
                return decodeScaled(aes.doFinal(cipher));
            }
            String mxc = content.optString("url", "");
            if (!mxc.startsWith("mxc://")) return null;
            // Plain: ask the server for a small still (animated=false).
            String rest = mxc.substring("mxc://".length());
            int slash = rest.indexOf('/');
            if (slash < 0) return null;
            String url = hs + "/_matrix/client/v1/media/thumbnail/"
                + enc(rest.substring(0, slash)) + "/" + enc(rest.substring(slash + 1))
                + "?width=" + IMAGE_MAX_PX + "&height=" + IMAGE_MAX_PX
                + "&method=scale&animated=false";
            byte[] data = httpGetBytes(url, token);
            Bitmap bmp = data != null ? decodeScaled(data) : null;
            if (bmp != null) return bmp;
            // No thumbnail (some servers): fall back to the file itself.
            byte[] full = downloadMxc(hs, token, mxc);
            return full != null ? decodeScaled(full) : null;
        } catch (Throwable t) {
            return null;
        }
    }

    private static byte[] downloadMxc(String hs, String token, String mxc) {
        String rest = mxc.substring("mxc://".length());
        int slash = rest.indexOf('/');
        if (slash < 0) return null;
        return httpGetBytes(hs + "/_matrix/client/v1/media/download/"
            + enc(rest.substring(0, slash)) + "/" + enc(rest.substring(slash + 1)), token);
    }

    /** GET returning at most IMAGE_MAX_BYTES; null on error or when larger. */
    private static byte[] httpGetBytes(String urlStr, String token) {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(urlStr).openConnection();
            conn.setConnectTimeout(CONNECT_TIMEOUT);
            conn.setReadTimeout(READ_TIMEOUT);
            conn.setRequestProperty("Authorization", "Bearer " + token);
            if (conn.getResponseCode() != 200) return null;
            if (conn.getContentLengthLong() > IMAGE_MAX_BYTES) return null;
            try (InputStream is = conn.getInputStream()) {
                java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
                byte[] buf = new byte[8192];
                int n;
                while ((n = is.read(buf)) != -1) {
                    out.write(buf, 0, n);
                    if (out.size() > IMAGE_MAX_BYTES) return null;
                }
                return out.toByteArray();
            }
        } catch (Exception e) {
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    /** Decode no larger than IMAGE_MAX_PX on a side (first frame of a GIF). */
    private static Bitmap decodeScaled(byte[] data) {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeByteArray(data, 0, data.length, bounds);
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null;
        int sample = 1;
        while (Math.max(bounds.outWidth, bounds.outHeight) / (sample * 2) >= IMAGE_MAX_PX) {
            sample *= 2;
        }
        BitmapFactory.Options opts = new BitmapFactory.Options();
        opts.inSampleSize = sample;
        return BitmapFactory.decodeByteArray(data, 0, data.length, opts);
    }

    /**
     * Write the picture where the system UI can read it: an app-private cache
     * file behind the FileProvider, granted to System UI for this URI only.
     * Files older than a day are removed on the way.
     */
    private static Uri saveNotificationImage(Context ctx, Bitmap bmp) {
        try {
            java.io.File dir = new java.io.File(ctx.getCacheDir(), "notif-images");
            if (!dir.isDirectory() && !dir.mkdirs()) return null;
            long cutoff = System.currentTimeMillis() - 24L * 60 * 60 * 1000;
            java.io.File[] old = dir.listFiles();
            if (old != null) for (java.io.File f : old) if (f.lastModified() < cutoff) f.delete();
            java.io.File out = java.io.File.createTempFile("img", ".jpg", dir);
            try (java.io.FileOutputStream fos = new java.io.FileOutputStream(out)) {
                bmp.compress(Bitmap.CompressFormat.JPEG, 85, fos);
            }
            Uri uri = androidx.core.content.FileProvider.getUriForFile(
                ctx, ctx.getPackageName() + ".fileprovider", out);
            ctx.grantUriPermission("com.android.systemui", uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION);
            return uri;
        } catch (Throwable t) {
            return null;
        }
    }

    /** Download an mxc:// thumbnail as a Bitmap (authenticated media endpoint). */
    private static Bitmap fetchMxcThumbnail(String hs, String token, String mxc, int size) {
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
                return circleCrop(BitmapFactory.decodeStream(is), size);
            }
        } catch (Exception e) {
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    /**
     * Centre-crop to a square (never stretch, whatever the server returned) and
     * mask to a circle, the shape Android avatars use.
     */
    private static Bitmap circleCrop(Bitmap src, int size) {
        if (src == null) return null;
        int side = Math.min(src.getWidth(), src.getHeight());
        if (side <= 0) return null;
        int x = (src.getWidth() - side) / 2;
        int y = (src.getHeight() - side) / 2;
        Bitmap out = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        android.graphics.Canvas canvas = new android.graphics.Canvas(out);
        android.graphics.Paint paint = new android.graphics.Paint(
            android.graphics.Paint.ANTI_ALIAS_FLAG | android.graphics.Paint.FILTER_BITMAP_FLAG);
        canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint);
        paint.setXfermode(new android.graphics.PorterDuffXfermode(
            android.graphics.PorterDuff.Mode.SRC_IN));
        canvas.drawBitmap(src, new android.graphics.Rect(x, y, x + side, y + side),
            new android.graphics.Rect(0, 0, size, size), paint);
        return out;
    }

    private static String httpGet(String urlStr, String token) {
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

    static String enc(String s) {
        try {
            return URLEncoder.encode(s, "UTF-8").replace("+", "%20");
        } catch (Exception e) {
            return Uri.encode(s);
        }
    }

    // ── Notification ──────────────────────────────────────────────────────────

    private static void showNotification(Context ctx, String title, String body, String roomId,
            String eventId, Bitmap largeIcon, String postedBy, String senderId,
            String senderName, Bitmap senderIcon, boolean dm, long ts, String msgBody,
            Bitmap msgImage) {
        createChannel(ctx);
        // One channel per conversation (Android 11+): the system lists it under
        // Conversations, where the user sets sound, priority and bubbles for
        // that person or room alone. Older Androids use the shared channel.
        String channelId = conversationChannel(ctx, roomId, title);

        Intent intent = new Intent(ctx, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        // Stamp the account this was posted under so the web layer can refuse
        // to open it in a different session (audit PRIV-02), or switch to it.
        // With no identity (an account no longer on this device) we cannot
        // attribute the notification, so we deliberately do NOT attach a room
        // id: it still shows, but tapping it only opens the app instead of
        // deep-linking whoever is signed in now into a room from a session we
        // cannot name. `postedBy` is the account handleMatrixPush resolved
        // before enrichment, so an enrichment failure cannot drop the stamp.
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
            ctx, roomId != null ? roomId.hashCode() : 0, intent, flags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, channelId)
            // Small (status-bar) icon: Android renders it from the alpha channel
            // only, so it must be a transparent-background silhouette. The
            // adaptive foreground layer is a white-on-transparent logo, unlike
            // ic_launcher (a near-opaque square that would show as a blob).
            .setSmallIcon(R.drawable.ic_stat_notify)
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

            // Reply goes STRAIGHT to MainActivity: the send needs the web
            // layer's Matrix SDK (E2EE), and Android 12+ blocks an activity
            // launched from a notification via a broadcast receiver (the
            // "trampoline" this used to be — Reply silently did nothing).
            // MainActivity reads the RemoteInput text itself.
            Intent replyIntent = new Intent(ctx, MainActivity.class);
            replyIntent.setAction(MessageActionReceiver.ACTION_REPLY);
            replyIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            replyIntent.putExtra("room_id", roomId);
            replyIntent.putExtra("user_id", postedBy);
            // One reply per posted notification: MainActivity remembers the
            // nonces it has sent, so the same intent handed back on a later
            // reopen cannot send the reply again.
            replyIntent.putExtra("reply_nonce",
                java.util.UUID.randomUUID().toString());
            if (eventId != null && !eventId.isEmpty()) {
                replyIntent.putExtra("event_id", eventId);
            }
            PendingIntent replyPending = PendingIntent.getActivity(
                ctx, (roomId + ":reply").hashCode(), replyIntent, replyFlags);

            NotificationCompat.Action replyAction = new NotificationCompat.Action.Builder(
                0, "Reply", replyPending)
                .addRemoteInput(remoteInput)
                .setAllowGeneratedReplies(false)
                .build();

            // Mark-as-read needs no UI and no crypto: MessageActionReceiver
            // sends the read marker itself, without opening the app.
            Intent markReadIntent = new Intent(ctx, MessageActionReceiver.class);
            markReadIntent.setAction(MessageActionReceiver.ACTION_MARK_READ);
            markReadIntent.putExtra("room_id", roomId);
            markReadIntent.putExtra("user_id", postedBy);
            if (eventId != null && !eventId.isEmpty()) {
                markReadIntent.putExtra("event_id", eventId);
            }
            PendingIntent markReadPending = PendingIntent.getBroadcast(
                ctx, (roomId + ":markread").hashCode(), markReadIntent, flags);

            builder.addAction(replyAction);
            builder.addAction(0, "Mark as read", markReadPending);
        }

        if (largeIcon != null) builder.setLargeIcon(largeIcon);

        int notificationId = roomId != null ? roomId.hashCode() : (int) System.currentTimeMillis();

        // Conversation style: every unread message from this room stays in the
        // one notification, each with its author. The messages already showing
        // are read back from the notification being replaced, so the history
        // survives this service being restarted between pushes.
        if (roomId != null && postedBy != null && !postedBy.isEmpty()) {
            try {
                Person me = new Person.Builder().setName("You").setKey(postedBy).build();
                Person.Builder author = new Person.Builder()
                    .setName(senderName != null && !senderName.isEmpty() ? senderName : title)
                    .setKey(senderId != null && !senderId.isEmpty() ? senderId : roomId);
                if (senderIcon != null) author.setIcon(IconCompat.createWithBitmap(senderIcon));
                else if (largeIcon != null && dm) author.setIcon(IconCompat.createWithBitmap(largeIcon));
                Person authorPerson = author.build();

                NotificationCompat.MessagingStyle style = null;
                try {
                    NotificationManager nm = ctx.getSystemService(NotificationManager.class);
                    if (nm != null) {
                        for (StatusBarNotification sbn : nm.getActiveNotifications()) {
                            if (sbn.getId() == notificationId && sbn.getTag() == null) {
                                style = NotificationCompat.MessagingStyle
                                    .extractMessagingStyleFromNotification(sbn.getNotification());
                                break;
                            }
                        }
                    }
                } catch (Throwable ignored) {}
                if (style == null) style = new NotificationCompat.MessagingStyle(me);
                if (!dm) {
                    style.setConversationTitle(title);
                    style.setGroupConversation(true);
                } else {
                    style.setGroupConversation(false);
                }
                // The message itself when there is one (the "sent a message"
                // placeholder when its text is hidden).
                NotificationCompat.MessagingStyle.Message line =
                    new NotificationCompat.MessagingStyle.Message(
                        msgBody != null ? msgBody : body, ts, authorPerson);
                if (msgImage != null) {
                    Uri imageUri = saveNotificationImage(ctx, msgImage);
                    if (imageUri != null) line.setData("image/jpeg", imageUri);
                }
                style.addMessage(line);
                // Keep the tray notification short: the newest 12.
                java.util.List<NotificationCompat.MessagingStyle.Message> all = style.getMessages();
                if (all.size() > 12) {
                    NotificationCompat.MessagingStyle trimmed =
                        new NotificationCompat.MessagingStyle(me);
                    trimmed.setConversationTitle(style.getConversationTitle());
                    trimmed.setGroupConversation(style.isGroupConversation());
                    for (NotificationCompat.MessagingStyle.Message m
                            : all.subList(all.size() - 12, all.size())) {
                        trimmed.addMessage(m);
                    }
                    style = trimmed;
                }
                builder.setStyle(style);
                builder.setCategory(NotificationCompat.CATEGORY_MESSAGE);
                // Lets the system treat it as a conversation: a per-person
                // entry in the share sheet and in notification settings.
                builder.setShortcutId(publishShortcut(ctx, roomId, title,
                    dm ? (senderIcon != null ? senderIcon : largeIcon) : largeIcon,
                    dm ? authorPerson : null, postedBy));
            } catch (Throwable ignored) {
                // Plain BigText notification already set above.
            }
        }

        try {
            NotificationManagerCompat.from(ctx).notify(notificationId, builder.build());
            PushLog.log(ctx, "posted room " + PushLog.shortId(roomId) + " event "
                + PushLog.shortId(eventId) + describeDelivery(ctx, channelId));
        } catch (SecurityException e) {
            PushLog.log(ctx, "post refused (no notification permission) for room "
                + PushLog.shortId(roomId));
        }
    }

    /**
     * What could still stop a posted notification from being seen: the app's
     * notifications switched off, the channel blocked or quietened, Do Not
     * Disturb. Empty when nothing is in the way.
     */
    private static String describeDelivery(Context ctx, String channelId) {
        StringBuilder sb = new StringBuilder();
        try {
            if (!NotificationManagerCompat.from(ctx).areNotificationsEnabled()) {
                sb.append(", BUT app notifications are off");
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationManager nm = ctx.getSystemService(NotificationManager.class);
                if (nm != null) {
                    NotificationChannel ch = nm.getNotificationChannel(channelId);
                    if (ch == null) sb.append(", channel missing");
                    else if (ch.getImportance() == NotificationManager.IMPORTANCE_NONE) {
                        sb.append(", BUT channel ").append(channelId.equals(CHANNEL_ID)
                            ? "(shared)" : "(conversation)").append(" is blocked");
                    } else if (ch.getImportance() < NotificationManager.IMPORTANCE_DEFAULT) {
                        sb.append(", channel importance ").append(ch.getImportance())
                            .append(" (silent)");
                    }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        int filter = nm.getCurrentInterruptionFilter();
                        if (filter > NotificationManager.INTERRUPTION_FILTER_ALL) {
                            sb.append(", system Do Not Disturb on (filter ")
                                .append(filter).append(")");
                        }
                    }
                }
            }
        } catch (Throwable ignored) {}
        return sb.toString();
    }

    /**
     * The per-conversation channel for a room, created on first use (API 30+,
     * where a channel can be tied to a conversation). Falls back to the shared
     * channel on older Androids or on any failure.
     */
    private static String conversationChannel(Context ctx, String roomId, String title) {
        if (roomId == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return CHANNEL_ID;
        try {
            NotificationManager manager = ctx.getSystemService(NotificationManager.class);
            if (manager == null) return CHANNEL_ID;
            String id = CHANNEL_ID + ":" + roomId;
            NotificationChannel existing = manager.getNotificationChannel(id);
            if (existing == null) {
                NotificationChannel channel = new NotificationChannel(
                    id, title, NotificationManager.IMPORTANCE_HIGH);
                channel.setConversationId(CHANNEL_ID, roomId);
                manager.createNotificationChannel(channel);
            } else if (!title.contentEquals(existing.getName())) {
                // Renamed room / person: keep the label current. The user's own
                // settings on the channel are not touched by a rename.
                existing.setName(title);
                manager.createNotificationChannel(existing);
            }
            return id;
        } catch (Throwable t) {
            return CHANNEL_ID;
        }
    }

    /**
     * Publish a long-lived sharing shortcut for the conversation (one per room),
     * which the system needs to show it as a conversation and offers as a
     * direct-share target. Returns the shortcut id.
     */
    private static String publishShortcut(Context ctx, String roomId, String title,
            Bitmap icon, Person person, String postedBy) {
        try {
            Intent open = new Intent(ctx, MainActivity.class);
            open.setAction(Intent.ACTION_VIEW);
            open.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            open.putExtra("room_id", roomId);
            open.putExtra("user_id", postedBy);
            ShortcutInfoCompat.Builder sc = new ShortcutInfoCompat.Builder(ctx, roomId)
                .setShortLabel(title)
                .setLongLived(true)
                .setIntent(open)
                .setCategories(java.util.Collections.singleton(
                    "moe.crafty.matrix.category.CONVERSATION"));
            if (person != null) sc.setPerson(person);
            if (icon != null) sc.setIcon(IconCompat.createWithBitmap(icon));
            ShortcutManagerCompat.pushDynamicShortcut(ctx, sc.build());
        } catch (Throwable ignored) {}
        return roomId;
    }

    private static void createChannel(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = ctx.getSystemService(NotificationManager.class);
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
}
