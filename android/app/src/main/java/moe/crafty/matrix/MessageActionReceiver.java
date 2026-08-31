package moe.crafty.matrix;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.RemoteInput;

/**
 * Handles Reply and Mark-read actions on a message notification posted by
 * {@link MatrixMessagingService}: extracts the RemoteInput reply text (if any),
 * launches MainActivity with the action data, and cancels the notification.
 * A broadcast (not an activity) so the action doesn't bring the app to the
 * foreground until MainActivity processes it.
 */
public class MessageActionReceiver extends BroadcastReceiver {

    static final String ACTION_REPLY = "moe.crafty.matrix.MSG_REPLY";
    static final String ACTION_MARK_READ = "moe.crafty.matrix.MSG_MARK_READ";
    static final String KEY_TEXT_REPLY = "key_text_reply";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (action == null) return;

        try {
            String roomId = intent.getStringExtra("room_id");
            String userId = intent.getStringExtra("user_id");
            String eventId = intent.getStringExtra("event_id");

            Intent launch = new Intent(context, MainActivity.class);
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK |
                           Intent.FLAG_ACTIVITY_CLEAR_TOP |
                           Intent.FLAG_ACTIVITY_SINGLE_TOP);
            launch.putExtra("room_id", roomId);
            launch.putExtra("user_id", userId);
            if (eventId != null && !eventId.isEmpty()) {
                launch.putExtra("event_id", eventId);
            }

            if (ACTION_REPLY.equals(action)) {
                // Extract the RemoteInput reply text the user typed into the
                // notification's inline reply field.
                CharSequence replyText = null;
                if (RemoteInput.getResultsFromIntent(intent) != null) {
                    replyText = RemoteInput.getResultsFromIntent(intent)
                        .getCharSequence(KEY_TEXT_REPLY);
                }
                if (replyText != null) {
                    launch.putExtra("reply_text", replyText.toString());
                }
            } else if (ACTION_MARK_READ.equals(action)) {
                launch.putExtra("mark_read", true);
            }

            context.startActivity(launch);

            // Cancel the notification: the user acted on it.
            if (roomId != null) {
                NotificationManagerCompat.from(context).cancel(roomId.hashCode());
            }
        } catch (Throwable ignored) {}
    }
}
