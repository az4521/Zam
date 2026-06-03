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
 * the homeserver from here using the session mirrored into SharedPreferences by
 * the web layer (see src/lib/nativeSession.ts). If the session is missing or a
 * request fails, we fall back to a generic notification.
 *
 * Still forwards to the Capacitor plugin so token registration and foreground
 * events keep working. Declared with a higher-priority intent-filter than the
 * plugin's MessagingService so MESSAGING_EVENT routes here.
 */
public class MatrixMessagingService extends FirebaseMessagingService {

    private static final String CHANNEL_ID = "matrix_messages";
    private static final String CHANNEL_NAME = "Messages";

    // Matches the Capacitor Preferences store + keys (nativeSession.ts).
    private static final String PREFS = "CapacitorStorage";
    private static final String KEY_HS = "matrix_hs_url";
    private static final String KEY_TOKEN = "matrix_access_token";

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

        // unread == 0 is a "clear" push (read elsewhere) — don't notify.
        if (unreadStr != null) {
            try {
                if (Integer.parseInt(unreadStr) == 0) return;
            } catch (NumberFormatException ignored) {}
        }

        // Defaults (used if enrichment fails).
        String title = "New message";
        String text = "You have a new message";
        Bitmap largeIcon = null;

        try {
            SharedPreferences prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String hs = prefs.getString(KEY_HS, null);
            String token = prefs.getString(KEY_TOKEN, null);

            if (hs != null && token != null && roomId != null && eventId != null) {
                hs = hs.replaceAll("/+$", "");

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

                    if (!body.isEmpty()) {
                        text = senderName.isEmpty() ? body : senderName + ": " + body;
                    } else if (!senderName.isEmpty()) {
                        text = senderName + " sent a message";
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

        showNotification(title, text, roomId, largeIcon);
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

    private void showNotification(String title, String body, String roomId, Bitmap largeIcon) {
        createChannel();

        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (roomId != null) intent.putExtra("room_id", roomId);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pending = PendingIntent.getActivity(
            this, roomId != null ? roomId.hashCode() : 0, intent, flags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setContentIntent(pending);

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
}
