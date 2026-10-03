package moe.crafty.matrix;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.unifiedpush.android.connector.UnifiedPush;

import java.util.ArrayList;
import java.util.List;

/**
 * Web-layer bridge for UnifiedPush (see src/lib/unifiedPush.ts). Lists the
 * installed distributors, registers with the chosen one and reports the
 * endpoint back; UnifiedPushService does the actual receiving.
 *
 * Endpoint changes are delivered as events ("endpoint", "unregistered",
 * "registrationFailed") retained until a listener consumes them, and the
 * latest endpoint is also persisted, so getStatus() is the source of truth on
 * startup.
 *
 * Registered in MainActivity.onCreate.
 */
@CapacitorPlugin(name = "UnifiedPush")
public class UnifiedPushPlugin extends Plugin {

    private static volatile UnifiedPushPlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    @Override
    protected void handleOnDestroy() {
        if (instance == this) instance = null;
    }

    /** Called by UnifiedPushService; a no-op while the app UI is not running. */
    static void emit(String event, JSObject data) {
        UnifiedPushPlugin p = instance;
        if (p != null) p.notifyListeners(event, data, true);
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        Context ctx = getContext();
        JSArray distributors = new JSArray();
        for (String pkg : externalDistributors(ctx)) {
            JSObject d = new JSObject();
            d.put("packageName", pkg);
            d.put("label", appLabel(ctx, pkg));
            distributors.put(d);
        }
        SharedPreferences prefs = UnifiedPushService.prefs(ctx);
        JSObject ret = new JSObject();
        ret.put("distributors", distributors);
        ret.put("savedDistributor", UnifiedPush.getSavedDistributor(ctx));
        ret.put("ackDistributor", UnifiedPush.getAckDistributor(ctx));
        ret.put("endpoint", prefs.getString(UnifiedPushService.KEY_ENDPOINT, null));
        ret.put("gateway", prefs.getString(UnifiedPushService.KEY_GATEWAY, null));
        ret.put("fcmAvailable", fcmAvailable(ctx));
        call.resolve(ret);
    }

    /**
     * Register with `distributor` (a package name), or with the previously
     * saved one, or with the only one installed. Resolves once the request is
     * sent; the endpoint arrives later as an "endpoint" event.
     */
    @PluginMethod
    public void register(PluginCall call) {
        Context ctx = getContext();
        List<String> available = externalDistributors(ctx);
        String distributor = call.getString("distributor");
        if (distributor == null) distributor = UnifiedPush.getSavedDistributor(ctx);
        if (distributor == null && available.size() == 1) distributor = available.get(0);
        if (distributor == null || !available.contains(distributor)) {
            call.reject("No UnifiedPush distributor available", "NO_DISTRIBUTOR");
            return;
        }
        String previous = UnifiedPush.getSavedDistributor(ctx);
        if (previous != null && !previous.equals(distributor)) {
            // The old distributor's endpoint is about to be replaced; don't
            // let the web layer register a pusher for it in the meantime.
            UnifiedPushService.clearStored(ctx);
        }
        try {
            UnifiedPush.saveDistributor(ctx, distributor);
            UnifiedPush.register(ctx, UnifiedPushService.INSTANCE, null, null);
        } catch (Exception e) {
            call.reject("UnifiedPush registration failed: " + e.getMessage());
            return;
        }
        JSObject ret = new JSObject();
        ret.put("distributor", distributor);
        call.resolve(ret);
    }

    /** Drop the registration with the distributor and forget the endpoint. */
    @PluginMethod
    public void unregister(PluginCall call) {
        Context ctx = getContext();
        try {
            UnifiedPush.unregister(ctx, UnifiedPushService.INSTANCE);
        } catch (Exception ignored) {}
        UnifiedPushService.clearStored(ctx);
        call.resolve();
    }

    /** Installed distributors, excluding this app itself. */
    private static List<String> externalDistributors(Context ctx) {
        List<String> out = new ArrayList<>();
        for (String pkg : UnifiedPush.getDistributors(ctx)) {
            if (!pkg.equals(ctx.getPackageName())) out.add(pkg);
        }
        return out;
    }

    private static String appLabel(Context ctx, String pkg) {
        try {
            PackageManager pm = ctx.getPackageManager();
            ApplicationInfo info = pm.getApplicationInfo(pkg, 0);
            return pm.getApplicationLabel(info).toString();
        } catch (Exception e) {
            return pkg;
        }
    }

    /**
     * Whether FCM can work in this build on this device: the build carries a
     * Firebase config (the google-services plugin generates the google_app_id
     * resource only when google-services.json was present) and Google Play
     * services is installed. Without either, PushNotifications.register()
     * would throw or never deliver a token.
     */
    static boolean fcmAvailable(Context ctx) {
        int id = ctx.getResources().getIdentifier("google_app_id", "string", ctx.getPackageName());
        if (id == 0) return false;
        try {
            ctx.getPackageManager().getPackageInfo("com.google.android.gms", 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }
}
