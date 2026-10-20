package moe.crafty.matrix;

import android.content.Context;
import android.content.SharedPreferences;
import android.webkit.WebView;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Settings > Debug Info > "WebView debugging": lets a release build be
 * inspected from chrome://inspect on a computer over USB, which Capacitor
 * only allows for debug builds. Persisted, and re-applied by MainActivity on
 * every launch, so it also covers startup (crypto init) after a restart.
 */
@CapacitorPlugin(name = "DebugTools")
public class DebugToolsPlugin extends Plugin {

    private static final String PREFS = "debug_tools";
    private static final String KEY_WEBVIEW_DEBUGGING = "webview_debugging";

    static boolean isWebViewDebuggingEnabled(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getBoolean(KEY_WEBVIEW_DEBUGGING, false);
    }

    /** Called from MainActivity.onCreate: turn it on if the user had. */
    static void applySaved(Context ctx) {
        if (isWebViewDebuggingEnabled(ctx)) WebView.setWebContentsDebuggingEnabled(true);
    }

    @PluginMethod
    public void getWebViewDebugging(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("enabled", isWebViewDebuggingEnabled(getContext()));
        call.resolve(ret);
    }

    @PluginMethod
    public void setWebViewDebugging(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        prefs.edit().putBoolean(KEY_WEBVIEW_DEBUGGING, enabled).apply();
        getActivity().runOnUiThread(() -> {
            // Debug builds are always inspectable; don't switch that off.
            boolean debugBuild = (getContext().getApplicationInfo().flags
                    & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0;
            WebView.setWebContentsDebuggingEnabled(enabled || debugBuild);
            JSObject ret = new JSObject();
            ret.put("enabled", enabled);
            call.resolve(ret);
        });
    }
}
