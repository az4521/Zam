package moe.crafty.matrix;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.drawable.Icon;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.telecom.CallAudioState;
import android.telecom.Connection;
import android.telecom.ConnectionRequest;
import android.telecom.DisconnectCause;
import android.telecom.PhoneAccount;
import android.telecom.PhoneAccountHandle;
import android.telecom.TelecomManager;

import androidx.annotation.RequiresApi;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Integration with the system call stack (Telecom) as a SELF-MANAGED calling
 * app — what makes a Matrix call behave like a phone call:
 *
 *  - an incoming DM call is reported to Telecom, so Bluetooth headsets, cars
 *    and watches can answer / decline it, and the system knows a call is
 *    ringing (a cellular call arriving, Do Not Disturb, other VoIP apps);
 *  - every call this device is in is registered with Telecom, so a cellular
 *    call can HOLD it (we mute both ways) instead of the two fighting over
 *    the microphone, and hardware hang-up buttons end it;
 *  - audio routing (earpiece / speaker / Bluetooth / wired) goes through
 *    Telecom, and the screen turns off at the ear on the earpiece.
 *
 * The web layer owns the actual call (LiveKit in the WebView); this class
 * only mirrors it, and forwards system actions to the web layer through
 * {@link CallServicePlugin}. Everything degrades: without Telecom (API < 26,
 * a device without the feature, or a refused registration) incoming calls
 * use the plain ringing notification and calls run as before.
 *
 * Threading: Telecom calls Connection / ConnectionService callbacks on the
 * main thread; every public entry point here hops to it as well, so the
 * connection map is only mutated there.
 */
@RequiresApi(Build.VERSION_CODES.O)
final class TelecomCalls {

    static final String URI_SCHEME = "matrix";
    static final String EXTRA_ROOM_ID = "moe.crafty.matrix.extra.ROOM_ID";
    static final String EXTRA_CALLER_NAME = "moe.crafty.matrix.extra.CALLER_NAME";
    static final String EXTRA_POSTED_BY = "moe.crafty.matrix.extra.POSTED_BY";
    static final String EXTRA_TITLE = "moe.crafty.matrix.extra.TITLE";
    static final String EXTRA_IS_DM = "moe.crafty.matrix.extra.IS_DM";

    private static final String ACCOUNT_ID = "matrix";

    private static final Handler main = new Handler(Looper.getMainLooper());
    /** Account and room key (key()) → its connection, ringing or in progress. */
    private static final Map<String, MatrixConnection> connections = new ConcurrentHashMap<>();
    /** Caller avatars waiting for onCreateIncomingConnection: a Bitmap is too
     *  big to ride Telecom's extras, and the service runs in this process. */
    private static final Map<String, Bitmap> pendingIcons = new ConcurrentHashMap<>();
    /** Calls (account and room keys) with a placeCall in flight, so a repeated start() never places
     *  a second one before Telecom answers the first. */
    private static final Set<String> pendingOutgoing = ConcurrentHashMap.newKeySet();
    /** The call (account and room key) the web layer is in, or null. */
    private static volatile String activeKey = null;
    private static volatile boolean accountRegistered = false;
    private static PowerManager.WakeLock proximityLock;

    private TelecomCalls() {}

    /** Whether a call is ringing or in progress here (the web UI must not be
     *  reloaded under it). */
    static boolean hasCall() {
        return activeKey != null || !connections.isEmpty() || !pendingOutgoing.isEmpty();
    }

    // ── Availability / account ──────────────────────────────────────────────

    static boolean isSupported(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false;
        PackageManager pm = context.getPackageManager();
        // FEATURE_CONNECTION_SERVICE was renamed FEATURE_TELECOM in API 33.
        return pm.hasSystemFeature("android.software.connectionservice")
            || pm.hasSystemFeature("android.software.telecom");
    }

    private static PhoneAccountHandle handle(Context context) {
        return new PhoneAccountHandle(
            new ComponentName(context, MatrixConnectionService.class), ACCOUNT_ID);
    }

    private static TelecomManager telecom(Context context) {
        return context.getSystemService(TelecomManager.class);
    }

    /** Register our self-managed PhoneAccount (idempotent; once per process). */
    private static boolean ensureAccount(Context context) {
        if (!isSupported(context)) return false;
        if (accountRegistered) return true;
        try {
            TelecomManager tm = telecom(context);
            if (tm == null) return false;
            PhoneAccount account = PhoneAccount.builder(handle(context), context.getString(R.string.app_name))
                .setCapabilities(PhoneAccount.CAPABILITY_SELF_MANAGED)
                .addSupportedUriScheme(URI_SCHEME)
                .setIcon(Icon.createWithResource(context, R.mipmap.ic_launcher))
                .build();
            tm.registerPhoneAccount(account);
            accountRegistered = true;
            return true;
        } catch (Throwable t) {
            return false;
        }
    }

    /** Calls are tracked per account and room, like their notifications:
     *  two accounts in one room ring and connect separately. */
    private static String key(String userId, String roomId) {
        return MatrixMessagingService.notificationKey(userId, roomId);
    }

    private static String keyOf(MatrixConnection conn) {
        return key(conn.postedBy, conn.roomId);
    }

    private static Uri address(String roomId) {
        return Uri.fromParts(URI_SCHEME, roomId, null);
    }

    // ── Incoming ────────────────────────────────────────────────────────────

    /**
     * Report a ringing DM call. True when Telecom accepted it — it will then
     * create the connection and ask it to post the ringing notification.
     * False means the caller must ring by itself (plain notification).
     */
    static boolean reportIncoming(Context context, String roomId, String callerName,
                                  String postedBy, Bitmap icon) {
        Context app = context.getApplicationContext();
        if (!ensureAccount(app)) return false;
        final String k = key(postedBy, roomId);
        // Already ringing (a duplicate push) or already in this call.
        if (connections.containsKey(k)) return true;
        try {
            TelecomManager tm = telecom(app);
            PhoneAccountHandle h = handle(app);
            // False during an emergency call, or while a call that cannot be
            // held is up: ring the plain way instead of losing the call.
            if (!tm.isIncomingCallPermitted(h)) return false;

            Bundle ours = new Bundle();
            ours.putString(EXTRA_ROOM_ID, roomId);
            ours.putString(EXTRA_CALLER_NAME, callerName);
            ours.putString(EXTRA_POSTED_BY, postedBy);
            ours.putBoolean(EXTRA_IS_DM, true);

            Bundle extras = new Bundle(ours);
            extras.putParcelable(TelecomManager.EXTRA_INCOMING_CALL_ADDRESS, address(roomId));
            extras.putBundle(TelecomManager.EXTRA_INCOMING_CALL_EXTRAS, ours);

            if (icon != null) pendingIcons.put(k, icon);
            tm.addNewIncomingCall(h, extras);
            return true;
        } catch (Throwable t) {
            pendingIcons.remove(k);
            return false;
        }
    }

    static Connection createIncoming(Context context, ConnectionRequest request) {
        Context app = context.getApplicationContext();
        String roomId = extra(request, EXTRA_ROOM_ID);
        if (roomId == null) return Connection.createFailedConnection(new DisconnectCause(DisconnectCause.ERROR));
        String caller = extra(request, EXTRA_CALLER_NAME);
        String postedBy = extra(request, EXTRA_POSTED_BY);
        final String k = key(postedBy, roomId);
        MatrixConnection conn = new MatrixConnection(
            app, roomId, true, true, caller, postedBy, pendingIcons.remove(k));
        conn.setAddress(address(roomId), TelecomManager.PRESENTATION_ALLOWED);
        conn.setCallerDisplayName(
            caller != null && !caller.trim().isEmpty() ? caller.trim() : "Someone",
            TelecomManager.PRESENTATION_ALLOWED);
        conn.setRinging();
        connections.put(k, conn);
        // Same lifetime as the notification's own timeout: a ring nobody
        // answers becomes a missed call rather than ringing in Telecom forever.
        main.postDelayed(() -> {
            if (conn.getState() == Connection.STATE_RINGING && connections.get(k) == conn) {
                end(conn, DisconnectCause.MISSED);
            }
        }, IncomingCallNotification.CALL_RING_TIMEOUT_MS);
        return conn;
    }

    /** Telecom refused the call after all: ring the plain way. */
    static void incomingFailed(Context context, ConnectionRequest request) {
        String roomId = extra(request, EXTRA_ROOM_ID);
        Bitmap icon = roomId != null
            ? pendingIcons.remove(key(extra(request, EXTRA_POSTED_BY), roomId)) : null;
        if (MainActivity.isInForeground()) return;
        IncomingCallNotification.show(context.getApplicationContext(),
            extra(request, EXTRA_CALLER_NAME), roomId, extra(request, EXTRA_POSTED_BY), icon);
    }

    /** Accept pressed on our own notification: MainActivity is already
     *  routing the join, so only Telecom needs telling. */
    static void answeredFromUi(Context context, String userId, String roomId) {
        Context app = context.getApplicationContext();
        main.post(() -> {
            MatrixConnection conn = connections.get(key(userId, roomId));
            if (conn != null && conn.getState() == Connection.STATE_RINGING) {
                conn.setActive();
                applyDefaultRoute(conn);
            }
            IncomingCallNotification.cancel(app, userId, roomId);
        });
    }

    /** The ring is over without being answered here (declined in-app, the
     *  caller gave up, answered on another device). */
    static void dismissRing(Context context, String userId, String roomId, boolean declined) {
        Context app = context.getApplicationContext();
        main.post(() -> {
            MatrixConnection conn = connections.get(key(userId, roomId));
            if (conn != null && conn.getState() == Connection.STATE_RINGING) {
                end(conn, declined ? DisconnectCause.REJECTED : DisconnectCause.MISSED);
            }
            IncomingCallNotification.cancel(app, userId, roomId);
        });
    }

    // ── Calls in progress ───────────────────────────────────────────────────

    /**
     * The web layer is (now) in a call in this room: answer the ringing
     * connection if there is one (accepted in-app), else register an
     * outgoing self-managed call. Idempotent — called on every state change.
     */
    static void startCall(Context context, String userId, String roomId, String title, boolean isDm) {
        Context app = context.getApplicationContext();
        final String k = key(userId, roomId);
        main.post(() -> {
            activeKey = k;
            MatrixConnection conn = connections.get(k);
            if (conn != null) {
                if (conn.getState() == Connection.STATE_RINGING) {
                    conn.setActive();
                    applyDefaultRoute(conn);
                    IncomingCallNotification.cancel(app, userId, roomId);
                }
                return;
            }
            if (pendingOutgoing.contains(k) || !ensureAccount(app)) return;
            try {
                TelecomManager tm = telecom(app);
                PhoneAccountHandle h = handle(app);
                // E.g. during an emergency call: the call runs without Telecom.
                if (!tm.isOutgoingCallPermitted(h)) return;
                Bundle ours = new Bundle();
                ours.putString(EXTRA_ROOM_ID, roomId);
                ours.putString(EXTRA_TITLE, title);
                ours.putString(EXTRA_POSTED_BY, userId);
                ours.putBoolean(EXTRA_IS_DM, isDm);
                Bundle extras = new Bundle();
                extras.putParcelable(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE, h);
                extras.putBundle(TelecomManager.EXTRA_OUTGOING_CALL_EXTRAS, ours);
                pendingOutgoing.add(k);
                tm.placeCall(address(roomId), extras);
            } catch (SecurityException e) {
                // MANAGE_OWN_CALLS missing (should not happen: it is a normal,
                // install-time permission): the call runs without Telecom.
                pendingOutgoing.remove(k);
            } catch (Throwable t) {
                pendingOutgoing.remove(k);
            }
        });
    }

    static Connection createOutgoing(Context context, ConnectionRequest request) {
        Context app = context.getApplicationContext();
        String roomId = extra(request, EXTRA_ROOM_ID);
        String userId = extra(request, EXTRA_POSTED_BY);
        String k = roomId != null ? key(userId, roomId) : null;
        if (k != null) pendingOutgoing.remove(k);
        // The web layer left (or switched rooms) before Telecom got here.
        if (k == null || !k.equals(activeKey) || connections.containsKey(k)) {
            return Connection.createFailedConnection(new DisconnectCause(DisconnectCause.LOCAL));
        }
        String title = extra(request, EXTRA_TITLE);
        boolean isDm = extraBool(request, EXTRA_IS_DM);
        MatrixConnection conn = new MatrixConnection(app, roomId, false, isDm, title, userId, null);
        conn.setAddress(address(roomId), TelecomManager.PRESENTATION_ALLOWED);
        conn.setCallerDisplayName(
            title != null && !title.trim().isEmpty() ? title.trim() : "Call",
            TelecomManager.PRESENTATION_ALLOWED);
        // The web layer is already connecting to the room: there is no
        // "dialing" phase worth showing.
        conn.setActive();
        connections.put(k, conn);
        return conn;
    }

    static void outgoingFailed(ConnectionRequest request) {
        String roomId = extra(request, EXTRA_ROOM_ID);
        if (roomId != null) pendingOutgoing.remove(key(extra(request, EXTRA_POSTED_BY), roomId));
    }

    /** The web layer left its call: end every non-ringing connection. */
    static void endCall() {
        main.post(() -> {
            activeKey = null;
            for (MatrixConnection conn : connections.values()) {
                if (conn.getState() != Connection.STATE_RINGING) end(conn, DisconnectCause.LOCAL);
            }
            updateProximity();
        });
    }

    /** Resume after a hold the system did not lift by itself (the other call
     *  ended). Telecom holds whatever else is active if it can. */
    static void resume() {
        main.post(() -> {
            MatrixConnection conn = activeConnection();
            if (conn != null && conn.getState() == Connection.STATE_HOLDING) {
                conn.setActive();
                emitHold(false);
            }
        });
    }

    /** route: "earpiece" | "speaker" | "bluetooth" | "wired". */
    static void setAudioRoute(String route) {
        main.post(() -> {
            MatrixConnection conn = activeConnection();
            int r = routeFromName(route);
            if (conn != null && r != 0) conn.setAudioRoute(r);
        });
    }

    static JSObject audioRouteInfo() {
        MatrixConnection conn = activeConnection();
        return describeRoute(conn != null ? conn.getCallAudioState() : null);
    }

    private static MatrixConnection activeConnection() {
        String k = activeKey;
        return k != null ? connections.get(k) : null;
    }

    // ── Connection callbacks (main thread) ──────────────────────────────────

    static void onAnswer(MatrixConnection conn) {
        if (conn.getState() != Connection.STATE_RINGING) return;
        conn.setActive();
        applyDefaultRoute(conn);
        IncomingCallNotification.cancel(conn.context, conn.postedBy, conn.roomId);

        // Answered from a headset / car / watch: the web layer has to join.
        JSObject data = new JSObject();
        data.put("roomId", conn.roomId);
        data.put("userId", conn.postedBy);
        boolean delivered = CallServicePlugin.emit("answer", data);

        // Bring the UI up too (over the lock screen). With a live web layer
        // it only needs showing; without one the intent carries the join.
        // Best effort: Android may refuse a background activity start, and
        // then the user opens the app from the call notification.
        Intent intent = new Intent(conn.context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
            | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        TrustedIntent.stamp(conn.context, intent);
        intent.putExtra("incoming_call", true);
        if (!delivered && conn.postedBy != null) {
            intent.putExtra("room_id", conn.roomId);
            intent.putExtra("user_id", conn.postedBy);
            intent.putExtra("join_call", true);
        }
        try {
            conn.context.startActivity(intent);
        } catch (Throwable ignored) {}
        // And put the ongoing-call notification up straight away: if the
        // activity start above was refused, it is the user's way back into the
        // call (tap to open). May itself be refused from the background; the
        // web layer starts it again once it joins.
        try {
            CallService.start(conn.context, conn.callerName);
        } catch (Throwable ignored) {}
    }

    static void onReject(MatrixConnection conn) {
        end(conn, DisconnectCause.REJECTED);
        emitDecline(conn.roomId, conn.postedBy);
    }

    /** Hung up from outside the app (headset, car, system UI). */
    static void onDisconnect(MatrixConnection conn) {
        boolean wasRinging = conn.getState() == Connection.STATE_RINGING;
        end(conn, DisconnectCause.LOCAL);
        if (wasRinging) {
            emitDecline(conn.roomId, conn.postedBy);
            return;
        }
        JSObject data = new JSObject();
        data.put("roomId", conn.roomId);
        data.put("userId", conn.postedBy);
        if (!CallServicePlugin.emit("hangUp", data)) {
            // No web layer, so no call left to leave: just drop the service.
            CallService.stop(conn.context);
        }
    }

    static void onHold(MatrixConnection conn) {
        conn.setOnHold();
        updateProximity();
        emitHold(true);
    }

    static void onUnhold(MatrixConnection conn) {
        conn.setActive();
        updateProximity();
        emitHold(false);
    }

    static void onAudioStateChanged(MatrixConnection conn, CallAudioState state) {
        if (state == null) return;
        applyDefaultRoute(conn);
        updateProximity();
        if (conn.lastMuted != null && conn.lastMuted != state.isMuted()) {
            // Mute toggled from a headset / car: mirror it in the app.
            JSObject data = new JSObject();
            data.put("muted", state.isMuted());
            CallServicePlugin.emit("systemMute", data);
        }
        conn.lastMuted = state.isMuted();
        if (conn.getState() != Connection.STATE_RINGING) {
            CallServicePlugin.emit("audioRoute", describeRoute(state));
        }
    }

    static void onStateChanged(MatrixConnection conn) {
        updateProximity();
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private static void end(MatrixConnection conn, int cause) {
        boolean wasRinging = conn.getState() == Connection.STATE_RINGING;
        try {
            conn.setDisconnected(new DisconnectCause(cause));
            conn.destroy();
        } catch (Throwable ignored) {}
        connections.remove(keyOf(conn), conn);
        if (wasRinging) IncomingCallNotification.cancel(conn.context, conn.postedBy, conn.roomId);
        updateProximity();
    }

    /**
     * A room call is a conference: open it on the speaker, the way a group
     * call app does, rather than at the ear. A DM keeps Telecom's choice
     * (earpiece unless a headset is connected), like a phone call. Applied
     * once per connection; after that the route is the user's.
     */
    private static void applyDefaultRoute(MatrixConnection conn) {
        if (conn.routeDefaulted || conn.getState() != Connection.STATE_ACTIVE) return;
        CallAudioState state = conn.getCallAudioState();
        if (state == null) return;
        conn.routeDefaulted = true;
        if (!conn.isDm && state.getRoute() == CallAudioState.ROUTE_EARPIECE
                && (state.getSupportedRouteMask() & CallAudioState.ROUTE_SPEAKER) != 0) {
            conn.setAudioRoute(CallAudioState.ROUTE_SPEAKER);
        }
    }

    /** Screen off at the ear: hold the proximity lock while the active call
     *  plays through the earpiece. */
    private static void updateProximity() {
        MatrixConnection conn = activeConnection();
        CallAudioState state = conn != null ? conn.getCallAudioState() : null;
        boolean want = conn != null
            && conn.getState() == Connection.STATE_ACTIVE
            && state != null
            && state.getRoute() == CallAudioState.ROUTE_EARPIECE;
        try {
            if (want) {
                if (proximityLock == null) {
                    PowerManager pm = conn.context.getSystemService(PowerManager.class);
                    if (pm == null || !pm.isWakeLockLevelSupported(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK)) return;
                    proximityLock = pm.newWakeLock(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK, "matrix:proximity");
                    proximityLock.setReferenceCounted(false);
                }
                // Bounded like CallService's wake lock; re-taken on every
                // route / state change of a long call.
                if (!proximityLock.isHeld()) proximityLock.acquire(6L * 60L * 60L * 1000L);
            } else if (proximityLock != null && proximityLock.isHeld()) {
                proximityLock.release(PowerManager.RELEASE_FLAG_WAIT_FOR_NO_PROXIMITY);
            }
        } catch (Throwable ignored) {}
    }

    private static void emitHold(boolean held) {
        JSObject data = new JSObject();
        data.put("held", held);
        CallServicePlugin.emit("hold", data);
    }

    private static void emitDecline(String roomId, String userId) {
        JSObject data = new JSObject();
        data.put("roomId", roomId);
        // The account the ring was for: another account's web layer ignores it.
        data.put("userId", userId);
        CallServicePlugin.emit("decline", data);
    }

    private static JSObject describeRoute(CallAudioState state) {
        JSObject out = new JSObject();
        JSArray available = new JSArray();
        if (state == null) {
            out.put("route", null);
            out.put("available", available);
            return out;
        }
        int mask = state.getSupportedRouteMask();
        for (int r : new int[] {
                CallAudioState.ROUTE_EARPIECE, CallAudioState.ROUTE_SPEAKER,
                CallAudioState.ROUTE_BLUETOOTH, CallAudioState.ROUTE_WIRED_HEADSET }) {
            if ((mask & r) != 0) available.put(routeName(r));
        }
        out.put("route", routeName(state.getRoute()));
        out.put("available", available);
        return out;
    }

    private static String routeName(int route) {
        switch (route) {
            case CallAudioState.ROUTE_SPEAKER: return "speaker";
            case CallAudioState.ROUTE_BLUETOOTH: return "bluetooth";
            case CallAudioState.ROUTE_WIRED_HEADSET: return "wired";
            case CallAudioState.ROUTE_EARPIECE: return "earpiece";
            default: return null;
        }
    }

    private static int routeFromName(String name) {
        if (name == null) return 0;
        switch (name) {
            case "speaker": return CallAudioState.ROUTE_SPEAKER;
            case "bluetooth": return CallAudioState.ROUTE_BLUETOOTH;
            case "wired": return CallAudioState.ROUTE_WIRED_HEADSET;
            case "earpiece": return CallAudioState.ROUTE_EARPIECE;
            default: return 0;
        }
    }

    /** Our extras live at the top level of an incoming request and inside
     *  the nested incoming / outgoing extras bundle; read either. */
    private static String extra(ConnectionRequest request, String key) {
        Bundle b = request.getExtras();
        if (b == null) return null;
        String v = b.getString(key);
        if (v != null) return v;
        for (String nested : new String[] {
                TelecomManager.EXTRA_INCOMING_CALL_EXTRAS, TelecomManager.EXTRA_OUTGOING_CALL_EXTRAS }) {
            Bundle n = b.getBundle(nested);
            if (n != null && n.getString(key) != null) return n.getString(key);
        }
        return null;
    }

    private static boolean extraBool(ConnectionRequest request, String key) {
        Bundle b = request.getExtras();
        if (b == null) return false;
        if (b.containsKey(key)) return b.getBoolean(key);
        for (String nested : new String[] {
                TelecomManager.EXTRA_INCOMING_CALL_EXTRAS, TelecomManager.EXTRA_OUTGOING_CALL_EXTRAS }) {
            Bundle n = b.getBundle(nested);
            if (n != null && n.containsKey(key)) return n.getBoolean(key);
        }
        return false;
    }
}
