package moe.crafty.matrix;

import android.content.Context;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Updates the web UI without a new APK (see WebBundleStore). The renderer asks
 * this plugin to check, download and apply; everything that decides or
 * verifies happens here, so a compromised page cannot choose what is served.
 *
 * An Android app in the background is frozen after about 30 seconds, JS timers
 * and network threads included, so nothing here waits for a quiet moment. The
 * check and download run while the app is open. A staged bundle is applied at
 * launch (WebBundleHost.prepareLaunch, before any page exists) or the instant
 * the app goes to the background (handleOnStop), when it is still running and
 * nobody is looking.
 */
@CapacitorPlugin(name = "WebBundle")
public class WebBundlePlugin extends Plugin {
    private static final String TAG = "WebBundle";
    private static final int CONNECT_TIMEOUT = 15000;
    private static final int READ_TIMEOUT = 30000;
    private static final int MAX_REDIRECTS = 5;
    private static final long MAX_TEXT_BYTES = 2L * 1024L * 1024L;

    private static final AtomicBoolean BUSY = new AtomicBoolean(false);
    // What the last check found, for download(). Static: the plugin instance
    // is recreated by a WebView reload.
    private static volatile WebBundleStore.Found found;

    // --- hosts ----------------------------------------------------------------

    /** Release feed and downloads: GitHub, and the CDN it redirects to. Matched
     *  with equals() / a dot-anchored suffix, never contains(). */
    private static boolean allowedHost(URL url) {
        if (!"https".equals(url.getProtocol())) return false;
        String host = url.getHost().toLowerCase(java.util.Locale.ROOT);
        return host.equals("api.github.com") || host.equals("github.com") || host.endsWith(".githubusercontent.com");
    }

    private static HttpURLConnection open(String start) throws IOException {
        String current = start;
        for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
            URL url = new URL(current);
            if (!allowedHost(url)) throw new IOException("host not allowed: " + url.getHost());
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setConnectTimeout(CONNECT_TIMEOUT);
            conn.setReadTimeout(READ_TIMEOUT);
            conn.setRequestProperty("Accept", "application/json, application/octet-stream");
            conn.setRequestProperty("User-Agent", "Zam-Android");
            int code = conn.getResponseCode();
            if (code >= 300 && code < 400) {
                String location = conn.getHeaderField("Location");
                conn.disconnect();
                if (location == null) throw new IOException("redirect without a location");
                current = new URL(url, location).toString();
                continue;
            }
            if (code != 200) {
                conn.disconnect();
                throw new IOException(url.getHost() + " answered " + code);
            }
            return conn;
        }
        throw new IOException("too many redirects");
    }

    private static final WebBundleStore.Net NET = new WebBundleStore.Net() {
        @Override
        public String getText(String url) throws IOException {
            HttpURLConnection conn = open(url);
            try (InputStream in = conn.getInputStream()) {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buf = new byte[8192];
                int n;
                while ((n = in.read(buf)) > 0) {
                    out.write(buf, 0, n);
                    if (out.size() > MAX_TEXT_BYTES) throw new IOException("response is too large");
                }
                return new String(out.toByteArray(), StandardCharsets.UTF_8);
            } finally {
                conn.disconnect();
            }
        }

        @Override
        public void download(String url, File dest, long maxBytes, WebBundleStore.Progress progress)
            throws IOException {
            HttpURLConnection conn = open(url);
            try (InputStream in = conn.getInputStream(); FileOutputStream out = new FileOutputStream(dest)) {
                long total = conn.getContentLengthLong() > 0 ? conn.getContentLengthLong() : maxBytes;
                byte[] buf = new byte[1 << 16];
                long size = 0;
                int n;
                while ((n = in.read(buf)) > 0) {
                    size += n;
                    if (size > maxBytes) throw new IOException("web bundle is larger than expected");
                    out.write(buf, 0, n);
                    progress.onProgress(Math.min(1.0, (double) size / (double) total));
                }
            } finally {
                conn.disconnect();
            }
        }
    };

    // --- plugin methods ---------------------------------------------------------

    private WebBundleStore store() {
        return WebBundleHost.store(getContext());
    }

    /**
     * Ask the release feed. Resolves { kind: "none" | "shell" | "bundle",
     * version?, staged? }. "shell" means a newer release that needs the APK.
     */
    @PluginMethod
    public void check(final PluginCall call) {
        final WebBundleStore store = store();
        if (store == null) {
            JSObject none = new JSObject();
            none.put("kind", "none");
            call.resolve(none);
            return;
        }
        new Thread(() -> {
            try {
                WebBundleStore.Found f = store.check(NET);
                found = f;
                JSObject out = new JSObject();
                out.put("kind", f.kind == WebBundleStore.Found.BUNDLE ? "bundle" : f.kind == WebBundleStore.Found.SHELL ? "shell" : "none");
                if (f.version != null) out.put("version", f.version);
                out.put("staged", f.staged);
                call.resolve(out);
            } catch (Exception e) {
                call.reject(String.valueOf(e.getMessage()));
            }
        }, "web-bundle-check").start();
    }

    /** Download and stage what check() found, emitting `progress` { percent }. */
    @PluginMethod
    public void download(final PluginCall call) {
        final WebBundleStore store = store();
        final WebBundleStore.Found f = found;
        if (store == null || f == null || f.kind != WebBundleStore.Found.BUNDLE) {
            call.reject("No web bundle to download");
            return;
        }
        if (f.staged) {
            JSObject out = new JSObject();
            out.put("version", f.version);
            call.resolve(out);
            return;
        }
        if (!BUSY.compareAndSet(false, true)) {
            call.reject("A web bundle is already downloading");
            return;
        }
        new Thread(() -> {
            final int[] last = { -1 };
            try {
                store.download(f, NET, fraction -> {
                    int percent = (int) Math.round(fraction * 100);
                    if (percent == last[0]) return;
                    last[0] = percent;
                    JSObject p = new JSObject();
                    p.put("percent", percent);
                    notifyListeners("progress", p);
                });
                f.staged = true;
                JSObject out = new JSObject();
                out.put("version", f.version);
                call.resolve(out);
            } catch (Exception e) {
                Log.w(TAG, "download failed: " + e);
                call.reject(String.valueOf(e.getMessage()));
            } finally {
                BUSY.set(false);
            }
        }, "web-bundle-download").start();
    }

    /** Switch to the staged bundle and reload the page onto it. */
    @PluginMethod
    public void apply(PluginCall call) {
        try {
            if (!applyStaged()) {
                call.reject("No staged web bundle");
                return;
            }
            call.resolve();
        } catch (IOException e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    /** The page loaded: a bundle just applied is good. */
    @PluginMethod
    public void ready(PluginCall call) {
        WebBundleStore store = store();
        if (store != null) store.markReady();
        call.resolve();
    }

    /** The user's "Automatic updates" choice, for the apply-at-background rule. */
    @PluginMethod
    public void setAuto(PluginCall call) {
        WebBundleHost.setAuto(getContext(), Boolean.TRUE.equals(call.getBoolean("enabled", true)));
        call.resolve();
    }

    private boolean applyStaged() throws IOException {
        WebBundleStore store = store();
        if (store == null) return false;
        String version = store.stagedVersion();
        if (version == null) return false;
        String root = store.apply(version);
        WebBundleHost.persistServerPath(getContext(), root);
        found = null;
        // Capacitor points its local server at the folder and reloads the page.
        getBridge().setServerBasePath(root);
        return true;
    }

    // --- apply when the app goes to the background -------------------------------

    /**
     * The app is no longer on screen. If a bundle is staged and automatic
     * updates are on, switch to it now: the app keeps running for about 30
     * seconds, long enough to reload, and nobody sees it. Skipped in or near a
     * call, and when the stop is only this app opening another screen (a file
     * picker, the camera, the browser for SSO) that it will return from.
     */
    @Override
    protected void handleOnStop() {
        try {
            Context context = getContext();
            if (!WebBundleHost.autoEnabled(context)) return;
            if (CallService.isRunning() || TelecomCalls.hasCall()) return;
            if (MainActivity.leftForAnotherScreen()) return;
            if (getActivity() != null && getActivity().isChangingConfigurations()) return;
            if (applyStaged()) Log.i(TAG, "applied a staged web bundle on the way to the background");
        } catch (Exception e) {
            Log.w(TAG, "apply on stop failed: " + e);
        }
    }
}
