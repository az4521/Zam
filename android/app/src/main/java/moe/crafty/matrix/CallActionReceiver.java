package moe.crafty.matrix;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSObject;

/**
 * Handles the Decline action on an incoming-call notification posted by
 * {@link IncomingCallNotification}: reject the call WITHOUT opening the app.
 * A broadcast (not an activity) so declining never brings the UI forward.
 */
public class CallActionReceiver extends BroadcastReceiver {

    static final String ACTION_DECLINE = "moe.crafty.matrix.CALL_DECLINE";
    static final String EXTRA_NOTIFICATION_ID = "notification_id";
    static final String EXTRA_ROOM_ID = "room_id";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !ACTION_DECLINE.equals(intent.getAction())) return;
        int id = intent.getIntExtra(EXTRA_NOTIFICATION_ID, 0);
        try {
            NotificationManagerCompat.from(context).cancel(id);
        } catch (Throwable ignored) {}

        String roomId = intent.getStringExtra(EXTRA_ROOM_ID);
        if (roomId == null || roomId.isEmpty()) return;
        // End the ringing system call, if it was reported to Telecom.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            TelecomCalls.dismissRing(context, roomId, true);
        }
        // A running web layer hides its own card and stops its ringer too.
        JSObject data = new JSObject();
        data.put("roomId", roomId);
        CallServicePlugin.emit("decline", data);
    }
}
