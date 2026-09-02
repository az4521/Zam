package moe.crafty.matrix;

import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.util.Base64;

import com.getcapacitor.BridgeActivity;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {

    // A shared file is base64'd and passed through evaluateJavascript, so keep
    // it bounded. Larger files are skipped (device residual — the reliable
    // path is text/URL; large-file share is verified on-device).
    private static final long MAX_SHARE_FILE_BYTES = 25L * 1024L * 1024L;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register custom plugins BEFORE the Capacitor bridge is created in
        // super.onCreate — plugins added afterwards are not picked up.
        registerPlugin(ApkUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
        handleRoomIntent(getIntent());
        handleShareIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleRoomIntent(intent);
        handleShareIntent(intent);
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

    /**
     * Forward an Android share-sheet intent (ACTION_SEND / ACTION_SEND_MULTIPLE)
     * into the web layer via window.__matrixShare(json). The web side only
     * STAGES the payload into the room picker — a forged intent cannot send
     * anything (audit SEC-M4). Mirrors handleRoomIntent's bridge pattern.
     */
    private void handleShareIntent(Intent intent) {
        if (intent == null) return;
        final String action = intent.getAction();
        if (
            !Intent.ACTION_SEND.equals(action) &&
            !Intent.ACTION_SEND_MULTIPLE.equals(action)
        ) return;

        final String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        final String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);

        final List<Uri> uris = new ArrayList<>();
        if (Intent.ACTION_SEND.equals(action)) {
            Uri u = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (u != null) uris.add(u);
        } else {
            ArrayList<Uri> list = intent.getParcelableArrayListExtra(
                Intent.EXTRA_STREAM
            );
            if (list != null) uris.addAll(list);
        }

        // Nothing usable → do not disturb the app.
        if ((text == null || text.isEmpty()) && uris.isEmpty()) return;

        final JSONArray files = new JSONArray();
        for (Uri uri : uris) {
            String b64 = readUriBase64(uri);
            if (b64 == null) continue; // unreadable or over the size cap — skip
            try {
                JSONObject f = new JSONObject();
                f.put("name", queryDisplayName(uri));
                String type = getContentResolver().getType(uri);
                f.put("mimeType", type != null ? type : "application/octet-stream");
                f.put("dataBase64", b64);
                files.put(f);
            } catch (JSONException e) {
                /* skip a file we can't encode; text still forwards */
            }
        }

        final JSONObject payload = new JSONObject();
        try {
            payload.put("source", "android");
            if (text != null && !text.isEmpty()) payload.put("text", text);
            if (subject != null && !subject.isEmpty())
                payload.put("subject", subject);
            if (files.length() > 0) payload.put("files", files);
        } catch (JSONException e) {
            return;
        }

        // If a file read failed AND there was no text, there's nothing to send.
        if (payload.length() <= 1) return;

        if (getBridge() == null || getBridge().getWebView() == null) return;
        final String json = payload.toString();
        // Defer so the web app has defined window.__matrixShare (same 500ms the
        // notification bridge uses).
        getBridge()
            .getWebView()
            .postDelayed(
                () -> {
                    String js =
                        "window.__matrixShare && window.__matrixShare(" +
                        JSONObject.quote(json) +
                        ")";
                    getBridge().getWebView().evaluateJavascript(js, null);
                },
                500
            );
    }

    /** Read a content:// URI to base64, or null if unreadable or over the cap. */
    private String readUriBase64(Uri uri) {
        try (InputStream in = getContentResolver().openInputStream(uri)) {
            if (in == null) return null;
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            long total = 0;
            while ((n = in.read(buf)) != -1) {
                total += n;
                if (total > MAX_SHARE_FILE_BYTES) return null;
                out.write(buf, 0, n);
            }
            return Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
        } catch (Exception e) {
            return null;
        }
    }

    /** Best-effort display name for a shared content:// URI. */
    private String queryDisplayName(Uri uri) {
        try (
            Cursor c = getContentResolver()
                .query(
                    uri,
                    new String[] { OpenableColumns.DISPLAY_NAME },
                    null,
                    null,
                    null
                )
        ) {
            if (c != null && c.moveToFirst()) {
                int idx = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (idx >= 0) {
                    String name = c.getString(idx);
                    if (name != null && !name.isEmpty()) return name;
                }
            }
        } catch (Exception ignored) {
            /* fall through to default */
        }
        return "file";
    }
}
