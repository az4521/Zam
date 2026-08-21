package moe.crafty.matrix;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import androidx.core.app.NotificationManagerCompat;

/**
 * Handles the Decline action on an incoming-call notification posted by
 * {@link MatrixMessagingService}: cancel the notification WITHOUT opening the
 * app. A broadcast (not an activity) so declining never brings the UI forward.
 */
public class CallActionReceiver extends BroadcastReceiver {

    static final String ACTION_DECLINE = "moe.crafty.matrix.CALL_DECLINE";
    static final String EXTRA_NOTIFICATION_ID = "notification_id";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !ACTION_DECLINE.equals(intent.getAction())) return;
        int id = intent.getIntExtra(EXTRA_NOTIFICATION_ID, 0);
        try {
            NotificationManagerCompat.from(context).cancel(id);
        } catch (Throwable ignored) {}
    }
}
