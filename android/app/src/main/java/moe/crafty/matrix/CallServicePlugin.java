package moe.crafty.matrix;

import android.app.Activity;
import android.app.NotificationManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.lang.ref.WeakReference;

/**
 * Web-layer control of native call behaviour (see src/lib/nativeCall.ts):
 *
 *  - start / stop a call: the {@link CallService} foreground service (keeps
 *    it alive in the background / screen off) plus its registration with the
 *    system call stack ({@link TelecomCalls});
 *  - end or just silence a ringing incoming call once the web layer has
 *    taken it over;
 *  - audio route (earpiece / speaker / Bluetooth / wired) and resuming a
 *    call the system put on hold;
 *  - the API 34+ "full screen intents" special access, which is what lets
 *    an incoming DM call take over the lock screen.
 *
 * Events to the web layer: "hangUp", "answer", "decline", "hold",
 * "systemMute", "audioRoute" — system or notification actions the web
 * layer, which owns the call, has to carry out.
 */
@CapacitorPlugin(name = "CallService")
public class CallServicePlugin extends Plugin {

    private static WeakReference<CallServicePlugin> instance = new WeakReference<>(null);

    @Override
    public void load() {
        instance = new WeakReference<>(this);
    }

    /** Forward an event to the web layer. False when nobody is listening
     *  (no WebView, so no call either). */
    static boolean emit(String event, JSObject data) {
        CallServicePlugin plugin = instance.get();
        if (plugin == null || !plugin.hasListeners(event)) return false;
        plugin.notifyListeners(event, data);
        return true;
    }

    private static boolean telecom() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.O;
    }

    @PluginMethod
    public void start(PluginCall call) {
        String roomId = call.getString("roomId");
        String title = call.getString("title", "");
        boolean isDm = Boolean.TRUE.equals(call.getBoolean("isDm", false));
        if (telecom() && roomId != null && !roomId.isEmpty()) {
            TelecomCalls.startCall(getContext(), roomId, title, isDm);
        }
        try {
            CallService.start(getContext(), title);
            call.resolve();
        } catch (Throwable t) {
            // e.g. ForegroundServiceStartNotAllowedException: the call still
            // works in the foreground, so report rather than crash.
            call.reject("Could not start the call service: " + t.getMessage());
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (telecom()) TelecomCalls.endCall();
        try {
            CallService.stop(getContext());
        } catch (Throwable ignored) {}
        setOverLockScreen(false);
        call.resolve();
    }

    /** The ring for a room is over (declined, caller gone, answered
     *  elsewhere): end the system call and take the notification down. */
    @PluginMethod
    public void dismissIncomingCall(PluginCall call) {
        String roomId = call.getString("roomId");
        boolean declined = Boolean.TRUE.equals(call.getBoolean("declined", false));
        if (roomId != null && !roomId.isEmpty()) {
            if (telecom()) TelecomCalls.dismissRing(getContext(), roomId, declined);
            else IncomingCallNotification.cancel(getContext(), roomId);
        }
        call.resolve();
    }

    /** The web layer saw a DM call arrive while the app is not in front
     *  (no push needed: it watches call memberships). Ring the system way,
     *  like a pushed call — its own ringer is inaudible and its card unseen. */
    @PluginMethod
    public void reportIncomingCall(PluginCall call) {
        String roomId = call.getString("roomId");
        String callerName = call.getString("callerName");
        String userId = call.getString("userId");
        if (roomId == null || roomId.isEmpty() || MainActivity.isInForeground()) {
            call.resolve();
            return;
        }
        boolean viaTelecom = telecom()
            && TelecomCalls.reportIncoming(getContext(), roomId, callerName, userId, null);
        if (!viaTelecom) IncomingCallNotification.show(getContext(), callerName, roomId, userId, null);
        call.resolve();
    }

    /** The in-app card has the ring now: drop the notification but keep the
     *  system call ringing, so a headset can still answer it. */
    @PluginMethod
    public void silenceIncomingCall(PluginCall call) {
        IncomingCallNotification.cancel(getContext(), call.getString("roomId"));
        call.resolve();
    }

    /** Stop showing over the lock screen once nothing call-shaped needs it
     *  (the ring ended unanswered or was declined). No-op during a call. */
    @PluginMethod
    public void releaseLockScreen(PluginCall call) {
        if (!CallService.isRunning()) setOverLockScreen(false);
        call.resolve();
    }

    @PluginMethod
    public void setAudioRoute(PluginCall call) {
        if (telecom()) TelecomCalls.setAudioRoute(call.getString("route"));
        call.resolve();
    }

    @PluginMethod
    public void getAudioRoute(PluginCall call) {
        if (!telecom()) {
            call.resolve(new JSObject());
            return;
        }
        call.resolve(TelecomCalls.audioRouteInfo());
    }

    @PluginMethod
    public void resume(PluginCall call) {
        if (telecom()) TelecomCalls.resume();
        call.resolve();
    }

    @PluginMethod
    public void canUseFullScreenIntent(PluginCall call) {
        boolean granted = true;
        if (Build.VERSION.SDK_INT >= 34) {
            try {
                NotificationManager nm = getContext().getSystemService(NotificationManager.class);
                granted = nm == null || nm.canUseFullScreenIntent();
            } catch (Throwable ignored) {}
        }
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void openFullScreenIntentSettings(PluginCall call) {
        try {
            Intent intent;
            if (Build.VERSION.SDK_INT >= 34) {
                intent = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT);
            } else {
                intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            }
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Throwable t) {
            call.reject("Could not open settings: " + t.getMessage());
        }
    }

    private void setOverLockScreen(boolean show) {
        Activity activity = getActivity();
        if (activity == null) return;
        activity.runOnUiThread(() -> MainActivity.setOverLockScreen(activity, show));
    }
}
