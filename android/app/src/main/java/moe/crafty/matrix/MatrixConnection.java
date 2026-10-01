package moe.crafty.matrix;

import android.content.Context;
import android.graphics.Bitmap;
import android.os.Build;
import android.telecom.CallAudioState;
import android.telecom.Connection;

import androidx.annotation.RequiresApi;

/**
 * One Matrix call as the system call stack sees it — a ringing DM call or a
 * call this device is in. Holds no call logic of its own: every callback is
 * handed to {@link TelecomCalls}, which forwards it to the web layer.
 */
@RequiresApi(Build.VERSION_CODES.O)
final class MatrixConnection extends Connection {

    final Context context;
    final String roomId;
    final boolean incoming;
    final boolean isDm;
    final String callerName;
    /** The account an incoming ring belongs to; null for outgoing calls or
     *  when it could not be named (then Accept cannot deep-link). */
    final String postedBy;
    final Bitmap icon;

    /** The default audio route has been applied (once per connection). */
    boolean routeDefaulted = false;
    /** Last mute state Telecom reported, to spot a headset toggling it. */
    Boolean lastMuted = null;

    MatrixConnection(Context context, String roomId, boolean incoming, boolean isDm,
                     String callerName, String postedBy, Bitmap icon) {
        this.context = context;
        this.roomId = roomId;
        this.incoming = incoming;
        this.isDm = isDm;
        this.callerName = callerName;
        this.postedBy = postedBy;
        this.icon = icon;
        setConnectionProperties(PROPERTY_SELF_MANAGED);
        setConnectionCapabilities(CAPABILITY_HOLD | CAPABILITY_SUPPORT_HOLD | CAPABILITY_MUTE);
        // The web layer's WebRTC owns the audio; tell Telecom it is VoIP so it
        // uses MODE_IN_COMMUNICATION rather than the modem's call path.
        setAudioModeIsVoip(true);
    }

    /** Telecom's cue for a self-managed app to show its own ringing UI. */
    @Override
    public void onShowIncomingCallUi() {
        // App in front: the in-app card already rings.
        if (MainActivity.isInForeground()) return;
        IncomingCallNotification.show(context, callerName, roomId, postedBy, icon);
    }

    @Override
    public void onAnswer() {
        TelecomCalls.onAnswer(this);
    }

    @Override
    public void onAnswer(int videoState) {
        TelecomCalls.onAnswer(this);
    }

    @Override
    public void onReject() {
        TelecomCalls.onReject(this);
    }

    @Override
    public void onDisconnect() {
        TelecomCalls.onDisconnect(this);
    }

    @Override
    public void onAbort() {
        TelecomCalls.onDisconnect(this);
    }

    @Override
    public void onHold() {
        TelecomCalls.onHold(this);
    }

    @Override
    public void onUnhold() {
        TelecomCalls.onUnhold(this);
    }

    @Override
    public void onCallAudioStateChanged(CallAudioState state) {
        TelecomCalls.onAudioStateChanged(this, state);
    }

    @Override
    public void onStateChanged(int state) {
        TelecomCalls.onStateChanged(this);
    }

    /** Volume key / power while ringing (API 29+): stop the ringtone but
     *  keep the call and its Accept / Decline. */
    @Override
    public void onSilence() {
        if (getState() != STATE_RINGING || MainActivity.isInForeground()) return;
        IncomingCallNotification.show(context, callerName, roomId, postedBy, icon, true);
    }
}
