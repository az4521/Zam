package moe.crafty.matrix;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.Person;
import androidx.core.graphics.drawable.IconCompat;

/**
 * The ringing notification for an incoming DM call: a looping ringtone, a
 * full-screen intent that wakes the screen and shows over the lock screen,
 * and Accept / Decline. On API 31+ it is a CallStyle notification, the same
 * presentation the phone app uses.
 *
 * Posted by {@link MatrixConnection#onShowIncomingCallUi()} when the call is
 * reported to the system call stack (Telecom), or directly by
 * {@link MatrixMessagingService} where Telecom is unavailable.
 *
 * Full-screen intent + Android 14+ (API 34): USE_FULL_SCREEN_INTENT is
 * declared in the manifest, but on API 34+ the OS grants it by default only
 * to apps whose core function is calling/alarms; otherwise the system
 * downgrades the full-screen intent to a heads-up notification (which still
 * rings and shows the actions — the call is not lost, only not full-screen).
 * The user can grant "Full screen intents" in Settings > Apps > Special app
 * access; the app offers the shortcut in Voice & Audio settings
 * (CallServicePlugin.openFullScreenIntentSettings).
 */
final class IncomingCallNotification {

    private static final String CHANNEL_ID = "matrix_calls";
    private static final String CHANNEL_NAME = "Calls";

    // Auto-dismiss an unanswered incoming-call ring after this long (ms), so a
    // missed call does not linger forever. Mirrors CALL_RING_TIMEOUT_MS in
    // src/lib/utils/callRingTimeout.ts and RING_AUTO_DISMISS_MS in static/sw.js.
    static final long CALL_RING_TIMEOUT_MS = 45000L;

    private IncomingCallNotification() {}

    /** The notification id for a room's ring. MainActivity, CallActionReceiver
     *  and CallServicePlugin cancel by this same scheme. */
    static int idFor(String roomId) {
        return roomId != null ? roomId.hashCode() : (int) System.currentTimeMillis();
    }

    static void cancel(Context context, String roomId) {
        if (roomId == null) return;
        try {
            NotificationManagerCompat.from(context).cancel(idFor(roomId));
        } catch (Throwable ignored) {}
    }

    /**
     * @param postedBy the account the ring belongs to, or null when it cannot
     *     be named — then the notification shows but does not deep-link or
     *     join (PRIV-02, mirroring MatrixMessagingService.showNotification()).
     */
    static void show(Context context, String callerName, String roomId, String postedBy, Bitmap largeIcon) {
        show(context, callerName, roomId, postedBy, largeIcon, false);
    }

    /** @param silent re-post without sound (the user silenced the ring with
     *     a volume key) — Accept / Decline stay, the ringtone stops. */
    static void show(Context context, String callerName, String roomId, String postedBy,
                     Bitmap largeIcon, boolean silent) {
        createChannel(context);

        String display = (callerName != null && !callerName.trim().isEmpty())
            ? callerName.trim() : "Someone";

        boolean routable = roomId != null && postedBy != null && !postedBy.isEmpty();
        int notificationId = idFor(roomId);

        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            piFlags |= PendingIntent.FLAG_IMMUTABLE;
        }

        // Accept: open the app to the room AND join the call.
        Intent answerIntent = new Intent(context, MainActivity.class);
        answerIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (routable) {
            answerIntent.putExtra("room_id", roomId);
            answerIntent.putExtra("user_id", postedBy);
            answerIntent.putExtra("join_call", true);
            answerIntent.putExtra("call_notification", true);
        }
        PendingIntent answerPending = PendingIntent.getActivity(
            context, notificationId, answerIntent, piFlags);

        // Body tap (not a button): open the room; the in-app ringer offers Accept.
        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (routable) {
            openIntent.putExtra("room_id", roomId);
            openIntent.putExtra("user_id", postedBy);
            openIntent.putExtra("call_notification", true);
        }
        PendingIntent openPending = PendingIntent.getActivity(
            context, notificationId + 1, openIntent, piFlags);

        // Decline: reject the call without opening the app.
        Intent declineIntent = new Intent(context, CallActionReceiver.class);
        declineIntent.setAction(CallActionReceiver.ACTION_DECLINE);
        declineIntent.putExtra(CallActionReceiver.EXTRA_NOTIFICATION_ID, notificationId);
        if (roomId != null) declineIntent.putExtra(CallActionReceiver.EXTRA_ROOM_ID, roomId);
        PendingIntent declinePending = PendingIntent.getBroadcast(
            context, notificationId + 2, declineIntent, piFlags);

        // Full-screen (screen off / locked): the system launches this WITHOUT
        // any user action, so it must only RING — open the room over the lock
        // screen where the in-app card offers Accept / Decline. (It used to be
        // the Accept intent, which auto-answered every call that arrived on a
        // locked phone.) The notification keeps ringing until the web layer
        // takes over; MainActivity does not cancel it for this intent.
        Intent fullScreenIntent = new Intent(context, MainActivity.class);
        fullScreenIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        fullScreenIntent.putExtra("incoming_call", true);
        if (routable) {
            fullScreenIntent.putExtra("room_id", roomId);
            fullScreenIntent.putExtra("user_id", postedBy);
        }
        PendingIntent fullScreenPending = PendingIntent.getActivity(
            context, notificationId + 3, fullScreenIntent, piFlags);

        Person.Builder caller = new Person.Builder().setName(display).setImportant(true);
        if (largeIcon != null) caller.setIcon(IconCompat.createWithBitmap(largeIcon));

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_notify)
            .setContentTitle(display)
            .setContentText("Incoming call")
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setOngoing(true)
            .setAutoCancel(false)
            .setTimeoutAfter(CALL_RING_TIMEOUT_MS)
            .setContentIntent(openPending)
            .setFullScreenIntent(fullScreenPending, true)
            // Accept / Decline buttons come from the CallStyle (and are added
            // as plain actions by NotificationCompat below API 31).
            .setStyle(NotificationCompat.CallStyle.forIncomingCall(
                caller.build(), declinePending, answerPending));

        // Pre-O has no channels, so the ring sound + vibration ride on the
        // builder. On O+ the channel owns both (these calls are ignored there).
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            builder.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE));
            builder.setVibrate(new long[] {0, 1000, 1000});
        }

        if (largeIcon != null) builder.setLargeIcon(largeIcon);

        if (silent) builder.setSilent(true);

        Notification notification = builder.build();
        // INSISTENT: loop the ringtone like a phone call until answered,
        // declined or timed out, instead of playing it once.
        if (!silent) notification.flags |= Notification.FLAG_INSISTENT;

        try {
            NotificationManagerCompat.from(context).notify(notificationId, notification);
        } catch (SecurityException ignored) {}
    }

    private static void createChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) return;
        // A separate high-importance channel: a ring sound, DND bypass and
        // vibration, so a call is unmistakable and unlike a message.
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            CHANNEL_NAME,
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
