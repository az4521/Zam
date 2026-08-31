package moe.crafty.matrix;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import org.json.JSONObject;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register custom plugins BEFORE the Capacitor bridge is created in
        // super.onCreate — plugins added afterwards are not picked up.
        registerPlugin(ApkUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
        handleRoomIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleRoomIntent(intent);
    }

    /**
     * When the app is opened by tapping a notification posted by
     * MatrixMessagingService, navigate the web layer to the room. The web app
     * exposes window.__matrixOpenRoom(roomId, userId) (see AppShell.svelte).
     *
     * The second argument is the account the notification was posted under, so
     * the web layer can refuse to open the room in a different session (audit
     * PRIV-02). The one-argument call is the backwards-compatibility path for
     * an APK OLDER than the web layer: its PendingIntents carry only room_id,
     * so the tap still routes (unattributed) against a newer web app. This
     * build never attaches room_id without user_id — when the service cannot
     * name the account it omits the room id too, so the notification shows but
     * is not routable. The one-argument branch below is therefore only
     * reachable from a PendingIntent created by a pre-update APK.
     */
    private void handleRoomIntent(Intent intent) {
        if (intent == null) return;
        final String roomId = intent.getStringExtra("room_id");
        if (roomId == null || roomId.isEmpty()) return;
        final String userId = intent.getStringExtra("user_id");
        // Accept on an incoming-call notification: open the room AND join the
        // call. Passed as a third argument so a plain notification tap (no
        // extra) keeps the two-argument open-only behaviour.
        final boolean joinCall = intent.getBooleanExtra("join_call", false);
        // The message this notification named, so the tap jumps to the exact
        // event, not just the room. Absent on a room-level or pre-stamp intent.
        final String eventId = intent.getStringExtra("event_id");
        // Quick-reply action: MessageActionReceiver extracted the RemoteInput
        // text and passed it here. The web bridge routes it through the Matrix
        // SDK (crypto-correct, no cleartext leak).
        final String replyText = intent.getStringExtra("reply_text");
        // Mark-read action: silent receipt send, no window focus.
        final boolean markRead = intent.getBooleanExtra("mark_read", false);
        if (getBridge() == null || getBridge().getWebView() == null) return;
        // Defer so the web app has a chance to define the hook / finish loading.
        getBridge()
            .getWebView()
            .postDelayed(
                () -> {
                    String safeRoom = roomId.replace("\\", "\\\\").replace("'", "\\'");
                    String js;
                    if (userId == null || userId.isEmpty()) {
                        // Backwards-compat: PendingIntent from a pre-update APK
                        // carries only room_id, no user_id. Still route it
                        // (unattributed) for a one-argument __matrixOpenRoom call.
                        js =
                            "window.__matrixOpenRoom && window.__matrixOpenRoom('" +
                            safeRoom +
                            "')";
                    } else {
                        // Same escaping as the room id — the asymmetry would be
                        // the defect, not the (currently impossible) quote.
                        String safeUser = userId.replace("\\", "\\\\").replace("'", "\\'");
                        // Fourth arg: the event to jump to, or JS undefined when
                        // the intent carried none (room-level tap).
                        String eventArg;
                        if (eventId == null || eventId.isEmpty()) {
                            eventArg = "undefined";
                        } else {
                            String safeEvent = eventId.replace("\\", "\\\\").replace("'", "\\'");
                            eventArg = "'" + safeEvent + "'";
                        }
                        // Branch on the action: reply / mark-read / open.
                        if (replyText != null) {
                            // Quick-reply: the web guard decideNotificationRoute
                            // DROPS the action if the poster userId is missing
                            // (fail-closed, audit SEC-M4). Pass safeUser as the
                            // poster arg so the guard correctly validates it.
                            // JSONObject.quote handles quotes/backslashes/newlines
                            // in the free-text reply the simple .replace() idiom
                            // does NOT (returns a fully-quoted JS/JSON string
                            // literal including the surrounding quotes).
                            js =
                                "window.__matrixReplyFromNotification && " +
                                "window.__matrixReplyFromNotification('" +
                                safeRoom +
                                "', " +
                                eventArg +
                                ", " +
                                JSONObject.quote(replyText) +
                                ", '" +
                                safeUser +
                                "')";
                        } else if (markRead) {
                            // Mark-read: silent receipt send (the bridge skips
                            // window focus), same fail-closed guard.
                            js =
                                "window.__matrixMarkAsRead && " +
                                "window.__matrixMarkAsRead('" +
                                safeRoom +
                                "', " +
                                eventArg +
                                ", '" +
                                safeUser +
                                "')";
                        } else {
                            // Plain notification tap or call Accept: open the room.
                            js =
                                "window.__matrixOpenRoom && window.__matrixOpenRoom('" +
                                safeRoom +
                                "', '" +
                                safeUser +
                                "', " +
                                (joinCall ? "true" : "false") +
                                ", " +
                                eventArg +
                                ")";
                        }
                    }
                    getBridge().getWebView().evaluateJavascript(js, null);
                },
                500
            );
    }
}
