package moe.crafty.matrix;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.util.Log;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;

/**
 * Process-wide pieces of the web-bundle updater: the one WebBundleStore, the
 * "automatic updates" flag, and the hand-off to Capacitor, which restores the
 * WebView's served folder from its own preference at every launch.
 */
final class WebBundleHost {
    private static final String TAG = "WebBundle";
    private static final String PREFS = "WebBundleSettings";
    private static final String KEY_AUTO = "auto";

    private static WebBundleStore store;
    private static boolean storeResolved = false;

    private WebBundleHost() {}

    /**
     * The store, or null when this APK has no shell fingerprint (a build that
     * did not run gen-android-shell-hash.mjs): it then never takes a bundle
     * and updates through the APK as before.
     */
    static synchronized WebBundleStore store(Context context) {
        if (storeResolved) return store;
        storeResolved = true;
        try {
            Context app = context.getApplicationContext();
            String hash;
            try (InputStream in = app.getAssets().open("shell-hash.json")) {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buf = new byte[1024];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                hash = new JSONObject(out.toString("UTF-8")).optString("hash", "");
            }
            if (hash.isEmpty()) return null;
            PackageInfo info = app.getPackageManager().getPackageInfo(app.getPackageName(), 0);
            String version = info.versionName == null ? "0.0.0" : info.versionName;
            store = new WebBundleStore(
                new File(app.getFilesDir(), "web-bundles"),
                version,
                hash,
                WebBundleKey.PUBLIC_KEY
            );
        } catch (Exception e) {
            Log.w(TAG, "web bundles disabled: " + e);
            store = null;
        }
        return store;
    }

    /** The user's "Automatic updates" choice, on unless turned off. */
    static boolean autoEnabled(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_AUTO, true);
    }

    static void setAuto(Context context, boolean enabled) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(KEY_AUTO, enabled).apply();
    }

    /** Tell Capacitor which folder to serve at launch (null: the APK's own). */
    static void persistServerPath(Context context, String root) {
        SharedPreferences.Editor editor = context
            .getSharedPreferences(com.getcapacitor.plugin.WebView.WEBVIEW_PREFS_NAME, Activity.MODE_PRIVATE)
            .edit();
        if (root == null) editor.remove(com.getcapacitor.plugin.WebView.CAP_SERVER_PATH);
        else editor.putString(com.getcapacitor.plugin.WebView.CAP_SERVER_PATH, root);
        editor.apply();
    }

    /**
     * Before the bridge exists: pick the web UI to serve and leave it where
     * Capacitor reads it. Never throws; any trouble serves the packed UI.
     */
    static void prepareLaunch(Context context) {
        String root = null;
        try {
            WebBundleStore s = store(context);
            if (s != null) root = s.launchRoot(autoEnabled(context));
        } catch (Exception e) {
            Log.w(TAG, "web bundle launch check failed: " + e);
        }
        persistServerPath(context, root);
    }
}
