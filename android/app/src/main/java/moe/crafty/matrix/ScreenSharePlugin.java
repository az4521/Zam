package moe.crafty.matrix;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.media.projection.MediaProjectionManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.activity.result.ActivityResult;
import androidx.webkit.WebViewFeature;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Capacitor plugin "ScreenShare": the Android screen share source. The page
 * gets the encoded H.264 access units over a WebMessage port (see
 * ScreenShareService for the wire format and lifecycle).
 *
 * start() always shows the system capture consent: Android 14+ grants a
 * projection for a single use, so every share asks again. On Android 13+ the
 * notification permission is requested first; a denial does not stop the share.
 */
@CapacitorPlugin(
        name = "ScreenShare",
        permissions = {
            @Permission(alias = ScreenSharePlugin.NOTIFICATIONS, strings = {Manifest.permission.POST_NOTIFICATIONS})
        })
public class ScreenSharePlugin extends Plugin {

    static final String NOTIFICATIONS = "notifications";
    private static final String TAG = ScreenShareEncoder.TAG;
    private static final String CONSENT_CALLBACK = "screenShareConsent";
    private static final String NOTIFICATION_CALLBACK = "screenShareNotifications";

    static final int MIN_FPS = 1;
    static final int MAX_FPS = 60;
    static final int MIN_BITRATE = 200_000;
    static final int MAX_BITRATE = 20_000_000;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        String reason = unavailableReason();
        JSObject r = new JSObject();
        r.put("available", reason == null);
        if (reason != null) r.put("reason", reason);
        call.resolve(r);
    }

    @PluginMethod
    public void start(PluginCall call) {
        String reason = unavailableReason();
        if (reason != null) {
            call.reject(reason);
            return;
        }
        if (ScreenShareService.isSharing()) {
            call.reject("a screen share is already running");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && getPermissionState(NOTIFICATIONS) != PermissionState.GRANTED) {
            requestPermissionForAlias(NOTIFICATIONS, call, NOTIFICATION_CALLBACK);
            return;
        }
        askConsent(call);
    }

    @PermissionCallback
    private void screenShareNotifications(PluginCall call) {
        if (call == null) return;
        if (getPermissionState(NOTIFICATIONS) != PermissionState.GRANTED) {
            Log.i(TAG, "notification permission denied; sharing without the notification");
        }
        askConsent(call);
    }

    private void askConsent(PluginCall call) {
        Intent consent = getContext().getSystemService(MediaProjectionManager.class)
                .createScreenCaptureIntent();
        startActivityForResult(call, consent, CONSENT_CALLBACK);
    }

    @ActivityCallback
    private void screenShareConsent(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result == null || result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            // Cancelled, not an error: the page just does not start.
            call.resolve(new JSObject().put("started", false));
            return;
        }
        String localUrl = getBridge().getLocalUrl();
        Uri local = Uri.parse(localUrl != null ? localUrl : "");
        Uri origin = new Uri.Builder()
                .scheme(local.getScheme())
                .encodedAuthority(local.getEncodedAuthority())
                .build();

        int fps = clamp(call.getInt("fps", 30), MIN_FPS, MAX_FPS);
        int bitrate = clamp(call.getInt("bitrate", 4_000_000), MIN_BITRATE, MAX_BITRATE);
        int maxWidth = clamp(call.getInt("maxWidth", 1280), 96, 4096);
        int maxHeight = clamp(call.getInt("maxHeight", 720), 96, 4096);

        ScreenShareService.Request request = new ScreenShareService.Request(
                result.getResultCode(), result.getData(),
                fps, bitrate, maxWidth, maxHeight,
                getBridge().getWebView(), origin,
                new ScreenShareService.Listener() {
                    @Override
                    public void onStarted(JSObject r) {
                        call.resolve(r);
                    }

                    @Override
                    public void onFailed(String message) {
                        call.reject(message);
                    }
                });
        try {
            ScreenShareService.begin(getContext(), request);
        } catch (Throwable t) {
            call.reject("could not start the screen share: " + t.getMessage());
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        ScreenShareService.endActive("stop");
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        ScreenShareService.endActive("stop");
        super.handleOnDestroy();
    }

    /** Why sharing cannot work here, or null when it can. */
    static String unavailableReason() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_ARRAY_BUFFER))
            return "this WebView cannot send ArrayBuffer messages";
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.CREATE_WEB_MESSAGE_CHANNEL))
            return "this WebView cannot create message channels";
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.POST_WEB_MESSAGE))
            return "this WebView cannot post messages to the page";
        if (!ScreenShareEncoder.hasEncoder()) return "no H.264 encoder on this device";
        return null;
    }

    private static int clamp(Integer value, int min, int max) {
        int v = value != null ? value : min;
        return Math.max(min, Math.min(max, v));
    }
}
