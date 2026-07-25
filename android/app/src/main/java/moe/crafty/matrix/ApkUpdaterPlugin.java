package moe.crafty.matrix;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Custom Capacitor plugin that downloads a release APK and hands it to the OS
 * package installer. Sideloaded (self-signed, GitHub-distributed) Android apps
 * cannot self-install silently — the realistic ceiling is auto-download, then a
 * single user "Install" tap in the system installer UI. See the design spec:
 * docs/superpowers/specs/2026-07-24-android-apk-updater-design.md.
 *
 * NOT compiled/verified overnight (no Gradle in the CI gate). Written to spec,
 * mirrors the existing native style (MatrixMessagingService.java), and is
 * device-verified in the morning. Registered in MainActivity.onCreate.
 */
@CapacitorPlugin(name = "ApkUpdater")
public class ApkUpdaterPlugin extends Plugin {

    private static final int CONNECT_TIMEOUT = 15000;
    private static final int READ_TIMEOUT = 30000;
    private static final String APK_MIME = "application/vnd.android.package-archive";

    /**
     * Download the APK at `url` to app-private cache storage, emitting
     * `downloadProgress` events ({ percent }). Resolves { path } (the absolute
     * file path) once complete. Network IO runs on a background thread so it
     * never blocks the WebView / main thread.
     */
    @PluginMethod
    public void downloadApk(final PluginCall call) {
        final String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("Missing download url");
            return;
        }
        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setConnectTimeout(CONNECT_TIMEOUT);
                conn.setReadTimeout(READ_TIMEOUT);
                conn.setInstanceFollowRedirects(true);
                conn.connect();
                if (conn.getResponseCode() / 100 != 2) {
                    call.reject("Download failed (HTTP " + conn.getResponseCode() + ")");
                    return;
                }
                final int total = conn.getContentLength();
                // App-private cache; the existing FileProvider
                // (moe.crafty.matrix.fileprovider) exposes cache-path ".".
                File outFile = new File(getContext().getCacheDir(), "update.apk");
                long readBytes = 0;
                int lastPercent = -1;
                try (InputStream in = conn.getInputStream();
                     OutputStream out = new FileOutputStream(outFile)) {
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = in.read(buf)) != -1) {
                        out.write(buf, 0, n);
                        readBytes += n;
                        if (total > 0) {
                            int percent = (int) (readBytes * 100 / total);
                            if (percent != lastPercent) {
                                lastPercent = percent;
                                JSObject ev = new JSObject();
                                ev.put("percent", percent);
                                notifyListeners("downloadProgress", ev);
                            }
                        }
                    }
                }
                JSObject ret = new JSObject();
                ret.put("path", outFile.getAbsolutePath());
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Download failed: " + e.getMessage(), e);
            } finally {
                if (conn != null) conn.disconnect();
            }
        }).start();
    }

    /**
     * Hand the downloaded APK to the OS package installer via a content:// URI
     * from the existing FileProvider. The installer UI opens; the user taps
     * Install. Requires REQUEST_INSTALL_PACKAGES (manifest) + the unknown-apps
     * permission on API 26+ (see canInstall / openUnknownSourcesSettings).
     */
    @PluginMethod
    public void installApk(final PluginCall call) {
        final String path = call.getString("path");
        if (path == null || path.isEmpty()) {
            call.reject("Missing apk path");
            return;
        }
        try {
            File apk = new File(path);
            Context ctx = getContext();
            Uri uri = FileProvider.getUriForFile(
                ctx, ctx.getPackageName() + ".fileprovider", apk);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, APK_MIME);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Install failed: " + e.getMessage(), e);
        }
    }

    /**
     * Whether the app may request package installs. Always true below API 26
     * (no unknown-sources gate); on 26+ reflects the per-app setting.
     */
    @PluginMethod
    public void canInstall(final PluginCall call) {
        boolean granted;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            granted = getContext().getPackageManager().canRequestPackageInstalls();
        } else {
            granted = true;
        }
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    /**
     * Open the system "Install unknown apps" settings screen for this app so
     * the user can grant the permission, then return and retry the install.
     */
    @PluginMethod
    public void openUnknownSourcesSettings(final PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Intent intent = new Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open settings: " + e.getMessage(), e);
        }
    }
}
