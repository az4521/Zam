package moe.crafty.matrix;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;

import java.util.Map;

/**
 * Firebase messaging service that DISPLAYS a notification for the data-only
 * messages Sygnal sends.
 *
 * The Capacitor push plugin only posts a system notification when the FCM
 * message carries a `notification` block; Sygnal sends data-only messages, so
 * backgrounded/killed-app pushes would otherwise be silently dropped. This
 * service builds the notification from the data payload itself.
 *
 * It still forwards to the Capacitor plugin so FCM token registration and
 * foreground `pushNotificationReceived` events continue to work.
 *
 * This service is declared with a higher-priority intent-filter than the
 * plugin's MessagingService in AndroidManifest.xml, so Android routes
 * MESSAGING_EVENT here instead.
 */
public class MatrixMessagingService extends FirebaseMessagingService {

    private static final String CHANNEL_ID = "matrix_messages";
    private static final String CHANNEL_NAME = "Messages";

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        // Keep Capacitor's token registration flow working.
        PushNotificationsPlugin.onNewToken(token);
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        // Let Capacitor handle it too (foreground listeners, etc.).
        try {
            PushNotificationsPlugin.sendRemoteMessage(remoteMessage);
        } catch (Throwable ignored) {
            // Plugin may not be initialised when the app is killed — fine.
        }

        Map<String, String> data = remoteMessage.getData();

        // If the message DOES carry a notification block, the system / plugin
        // already shows it — don't duplicate.
        if (remoteMessage.getNotification() != null) {
            return;
        }

        // Sygnal "event_id_only" data payload: event_id, room_id, unread, etc.
        String roomId = data.get("room_id");
        String unreadStr = data.get("unread");
        int unread = 0;
        try {
            if (unreadStr != null) unread = Integer.parseInt(unreadStr);
        } catch (NumberFormatException ignored) {}

        // unread == 0 is a "clear" push (the user read elsewhere) — don't notify.
        if (unreadStr != null && unread == 0) {
            return;
        }

        String title = data.containsKey("title") ? data.get("title") : "New message";
        String body = data.containsKey("body")
            ? data.get("body")
            : (roomId != null ? "You have a new message" : "You have a new message");

        showNotification(title, body, roomId, data.get("event_id"));
    }

    private void showNotification(String title, String body, String roomId, String eventId) {
        createChannel();

        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (roomId != null) intent.putExtra("room_id", roomId);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pending = PendingIntent.getActivity(this, 0, intent, flags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_email)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setContentIntent(pending);

        // Group/replace per-room so a room doesn't stack endless notifications.
        int notificationId = roomId != null ? roomId.hashCode() : (int) System.currentTimeMillis();

        try {
            NotificationManagerCompat.from(this).notify(notificationId, builder.build());
        } catch (SecurityException ignored) {
            // POST_NOTIFICATIONS not granted — nothing to show.
        }
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
