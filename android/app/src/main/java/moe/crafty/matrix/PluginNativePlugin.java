package moe.crafty.matrix;

import android.app.AlertDialog;
import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.Looper;
import android.os.Process;
import android.util.Log;
import android.webkit.WebView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.webkit.WebMessageCompat;
import androidx.webkit.WebMessagePortCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Pattern;

import dalvik.system.DexClassLoader;

/**
 * Plugins' native code on Android (zam.native; src/lib/plugins/pluginNative.ts).
 *
 * A repo plugin may ship an Android host: a .dex with a class implementing
 * PluginNativeHost, plus the .so files it loads, per ABI, listed with their
 * SHA-256 in its manifest. The same rules as the desktop app
 * (electron/pluginNative.cjs) keep it honest:
 *  - the manifest is fetched from the plugin's pinned commit here, not taken
 *    from the page, so a compromised page can't substitute files or hashes;
 *  - the user agrees in a system dialog before anything is downloaded or
 *    run. Consent is per commit: an update asks again. Unlike on desktop the
 *    host runs inside Zam's own process, with everything Zam can reach, and
 *    the dialog says so;
 *  - every file is checked against the manifest's size and SHA-256, written
 *    to a temporary directory and moved into place only when all are good;
 *    the .dex is made read-only (Android 14 refuses writable code).
 * Each plugin's host gets its own thread (urgent-audio priority). open()
 * connects a new WebMessagePort pair: one end goes to the host as a
 * PluginNativePort, the other to the page as the window message
 * "zam:plugin-native-port:<id>".
 */
@CapacitorPlugin(name = "PluginNative")
public class PluginNativePlugin extends Plugin {
    private static final String TAG = "ZamPluginNative";
    private static final String RAW_BASE = "https://raw.githubusercontent.com/";
    /** Debug builds only: a plugin repo served on the development machine. */
    private static final Pattern DEV_RAW_BASE =
            Pattern.compile("^http://(10\\.0\\.2\\.2|localhost|127\\.0\\.0\\.1):\\d{2,5}/raw/$");
    private static final Pattern NAME = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9._-]*$");
    private static final Pattern PORT_ID = Pattern.compile("^[A-Za-z0-9]{1,64}$");
    private static final Pattern SHA = Pattern.compile("^[0-9a-f]{40}$");
    private static final Pattern HASH = Pattern.compile("^[0-9a-f]{64}$");
    private static final Pattern SEGMENT = Pattern.compile("^[A-Za-z0-9._-]+$");
    private static final Pattern JAVA_CLASS =
            Pattern.compile("^[A-Za-z_$][\\w$]*(\\.[A-Za-z_$][\\w$]*)+$");
    private static final long MAX_FILE = 100L * 1024 * 1024;
    private static final String PREFS = "zam_plugin_native";

    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final Map<String, Running> hosts = new HashMap<>();

    private static final class Running {
        final String sha;
        final HandlerThread thread;
        final Handler handler;
        final PluginNativeHost host;

        Running(String sha, HandlerThread thread, Handler handler, PluginNativeHost host) {
            this.sha = sha;
            this.thread = thread;
            this.handler = handler;
            this.host = host;
        }
    }

    /** "android-" + the device's main ABI, in Node's arch names. */
    static String platformKey() {
        String abi = Build.SUPPORTED_ABIS.length > 0 ? Build.SUPPORTED_ABIS[0] : "";
        switch (abi) {
            case "arm64-v8a":
                return "android-arm64";
            case "armeabi-v7a":
                return "android-arm";
            case "x86_64":
                return "android-x64";
            case "x86":
                return "android-ia32";
            default:
                return "android-" + abi;
        }
    }

    /** Same rule as isSafeRelPath (src/lib/plugins/repo.ts). */
    static boolean safeRel(String p) {
        if (p == null || p.isEmpty() || p.contains("\\") || p.contains(":")) return false;
        for (String s : p.split("/", -1)) {
            if (s.isEmpty() || s.equals(".") || s.equals("..") || !SEGMENT.matcher(s).matches())
                return false;
        }
        return true;
    }

    private static boolean webViewSupported() {
        return WebViewFeature.isFeatureSupported(WebViewFeature.CREATE_WEB_MESSAGE_CHANNEL)
                && WebViewFeature.isFeatureSupported(WebViewFeature.POST_WEB_MESSAGE)
                && WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_PORT_POST_MESSAGE)
                && WebViewFeature.isFeatureSupported(
                        WebViewFeature.WEB_MESSAGE_PORT_SET_MESSAGE_CALLBACK)
                && WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_ARRAY_BUFFER);
    }

    @PluginMethod
    public void platform(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("platform", platformKey());
        call.resolve(ret);
    }

    @PluginMethod
    public void open(PluginCall call) {
        final String id = call.getString("id");
        final String pluginId = call.getString("pluginId");
        final String owner = call.getString("owner");
        final String repo = call.getString("repo");
        final String sha = call.getString("sha");
        final String path = call.getString("path");
        String devBase = call.getString("devRawBase");
        if (id == null || !PORT_ID.matcher(id).matches()
                || pluginId == null || !NAME.matcher(pluginId).matches()
                || owner == null || !NAME.matcher(owner).matches()
                || repo == null || !NAME.matcher(repo).matches()
                || sha == null || !SHA.matcher(sha).matches()
                || !safeRel(path)) {
            call.reject("bad request");
            return;
        }
        if (!webViewSupported()) {
            call.reject("this WebView lacks binary message ports");
            return;
        }
        boolean debuggable = (getContext().getApplicationInfo().flags
                & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        final String rawBase = debuggable && devBase != null
                && DEV_RAW_BASE.matcher(devBase).matches() ? devBase : RAW_BASE;
        io.execute(() -> {
            try {
                Running r = ensureHost(pluginId, owner, repo, sha, path, rawBase);
                getBridge().executeOnMainThread(() -> {
                    try {
                        connect(r, id);
                        call.resolve();
                    } catch (Exception e) {
                        call.reject("connect failed: " + e.getMessage(), e);
                    }
                });
            } catch (Throwable e) {
                Log.w(TAG, "open failed", e);
                call.reject(String.valueOf(e.getMessage()));
            }
        });
    }

    @PluginMethod
    public void remove(PluginCall call) {
        final String pluginId = call.getString("pluginId");
        if (pluginId == null || !NAME.matcher(pluginId).matches()) {
            call.reject("bad plugin id");
            return;
        }
        io.execute(() -> {
            stopHost(pluginId);
            deleteRecursive(new File(root(), pluginId));
            prefs().edit().remove(pluginId).apply();
            call.resolve();
        });
    }

    private File root() {
        return new File(getContext().getFilesDir(), "plugin-native");
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static byte[] fetch(String url) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(60000);
        try {
            int code = c.getResponseCode();
            if (code != 200) throw new Exception("HTTP " + code + " for " + url);
            try (InputStream in = c.getInputStream()) {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buf = new byte[1 << 16];
                int n;
                long total = 0;
                while ((n = in.read(buf)) > 0) {
                    total += n;
                    if (total > MAX_FILE) throw new Exception("file too large: " + url);
                    out.write(buf, 0, n);
                }
                return out.toByteArray();
            }
        } finally {
            c.disconnect();
        }
    }

    private static String sha256(byte[] data) throws Exception {
        byte[] d = MessageDigest.getInstance("SHA-256").digest(data);
        StringBuilder sb = new StringBuilder();
        for (byte b : d) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    /** The platform's host, entry class and files from an untrusted manifest. */
    private static final class Native {
        String name;
        String host;
        String entry;
        JSONArray files;
        long bytes;
    }

    private static Native parse(JSONObject manifest, String pluginId) throws Exception {
        if (!pluginId.equals(manifest.optString("id")))
            throw new Exception("the manifest is for a different plugin");
        JSONArray caps = manifest.optJSONArray("capabilities");
        boolean declared = false;
        for (int i = 0; caps != null && i < caps.length(); i++)
            if ("native".equals(caps.optString(i))) declared = true;
        if (!declared) throw new Exception("the plugin doesn't declare the native capability");
        JSONObject n = manifest.optJSONObject("native");
        JSONObject platforms = n == null ? null : n.optJSONObject("platforms");
        JSONObject p = platforms == null ? null : platforms.optJSONObject(platformKey());
        if (p == null) throw new Exception("the plugin has no native code for " + platformKey());
        Native out = new Native();
        out.name = manifest.optString("name", pluginId);
        if (out.name.length() > 80) out.name = out.name.substring(0, 80);
        out.host = p.optString("host");
        out.entry = p.optString("entry");
        if (!safeRel(out.host) || !(out.host.endsWith(".dex") || out.host.endsWith(".jar")))
            throw new Exception("the manifest's native host is malformed");
        if (!JAVA_CLASS.matcher(out.entry).matches())
            throw new Exception("the manifest's native entry class is malformed");
        out.files = p.optJSONArray("files");
        if (out.files == null || out.files.length() == 0)
            throw new Exception("the manifest's native file list is malformed");
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < out.files.length(); i++) {
            JSONObject f = out.files.optJSONObject(i);
            if (f == null) throw new Exception("the manifest's native file list is malformed");
            String fp = f.optString("path");
            long size = f.optLong("size", -1);
            if (!safeRel(fp) || seen.contains(fp) || !HASH.matcher(f.optString("sha256")).matches()
                    || size < 0 || size > MAX_FILE)
                throw new Exception("the manifest's native file list is malformed");
            seen.add(fp);
            out.bytes += size;
        }
        if (!seen.contains(out.host)) throw new Exception("the native host isn't in the file list");
        return out;
    }

    /** Ask the user, on the UI thread; block this (background) thread. */
    private boolean askConsent(String pluginId, String owner, String repo, String sha, Native n)
            throws InterruptedException {
        CountDownLatch done = new CountDownLatch(1);
        AtomicBoolean allowed = new AtomicBoolean(false);
        new Handler(Looper.getMainLooper()).post(() -> {
            if (getActivity() == null || getActivity().isFinishing()) {
                done.countDown();
                return;
            }
            String detail = "Plugin " + pluginId + " from github.com/" + owner + "/" + repo
                    + " (commit " + sha.substring(0, 8) + ") ships native code for this phone ("
                    + String.format("%.1f", n.bytes / 1e6) + " MB). It runs inside Zam with "
                    + "access to everything Zam can reach, including your Matrix account and "
                    + "encryption keys. Only allow it if you trust the plugin's author.";
            new AlertDialog.Builder(getActivity())
                    .setTitle("Let “" + n.name + "” run its own code?")
                    .setMessage(detail)
                    .setPositiveButton("Allow", (d, w) -> allowed.set(true))
                    .setNegativeButton("Don't allow", null)
                    .setOnDismissListener(d -> done.countDown())
                    .show();
        });
        done.await();
        return allowed.get();
    }

    private Running ensureHost(String pluginId, String owner, String repo, String sha,
                               String path, String rawBase) throws Exception {
        synchronized (hosts) {
            Running r = hosts.get(pluginId);
            if (r != null && r.sha.equals(sha)) return r;
        }
        stopHost(pluginId);
        String base = rawBase + owner + "/" + repo + "/" + sha + "/" + path + "/";
        Native n = parse(new JSONObject(new String(fetch(base + "manifest.json"), "UTF-8")), pluginId);

        if (!sha.equals(prefs().getString(pluginId, null))) {
            if (!askConsent(pluginId, owner, repo, sha, n))
                throw new Exception("you didn't allow the plugin's native code");
            prefs().edit().putString(pluginId, sha).apply();
        }

        File pluginDir = new File(root(), pluginId);
        File dir = new File(pluginDir, sha);
        if (!new File(dir, ".complete").exists()) {
            File tmp = new File(pluginDir, sha + ".partial-" + System.nanoTime());
            try {
                for (int i = 0; i < n.files.length(); i++) {
                    JSONObject f = n.files.getJSONObject(i);
                    String fp = f.getString("path");
                    byte[] bytes = fetch(base + fp);
                    if (bytes.length != f.getLong("size"))
                        throw new Exception(fp + ": size doesn't match the manifest");
                    if (!sha256(bytes).equals(f.getString("sha256")))
                        throw new Exception(fp + ": SHA-256 doesn't match the manifest");
                    File out = new File(tmp, fp);
                    //noinspection ResultOfMethodCallIgnored
                    out.getParentFile().mkdirs();
                    try (FileOutputStream o = new FileOutputStream(out)) {
                        o.write(bytes);
                    }
                }
                try (FileOutputStream o = new FileOutputStream(new File(tmp, ".complete"))) {
                    o.write(sha.getBytes("UTF-8"));
                }
                deleteRecursive(dir);
                if (!tmp.renameTo(dir)) throw new Exception("couldn't move the plugin's files into place");
            } catch (Exception e) {
                deleteRecursive(tmp);
                throw e;
            }
        }
        // Older commits of this plugin are no longer needed.
        File[] others = pluginDir.listFiles();
        if (others != null)
            for (File o : others) if (!o.getName().equals(sha)) deleteRecursive(o);

        File hostFile = new File(dir, n.host);
        // Android 14+ refuses to load code from a writable file.
        //noinspection ResultOfMethodCallIgnored
        hostFile.setReadOnly();
        File libDir = new File(hostFile.getParentFile(), "lib");
        HandlerThread thread = new HandlerThread("ZamPlugin-" + pluginId,
                Process.THREAD_PRIORITY_URGENT_AUDIO);
        thread.start();
        Handler handler = new Handler(thread.getLooper());
        final String entry = n.entry;
        final File hostDir = dir;
        final PluginNativeHost[] made = new PluginNativeHost[1];
        final Throwable[] failed = new Throwable[1];
        CountDownLatch loaded = new CountDownLatch(1);
        handler.post(() -> {
            try {
                DexClassLoader loader = new DexClassLoader(
                        hostFile.getAbsolutePath(),
                        getContext().getCodeCacheDir().getAbsolutePath(),
                        libDir.getAbsolutePath(),
                        PluginNativePlugin.class.getClassLoader());
                Object o = loader.loadClass(entry).getDeclaredConstructor().newInstance();
                if (!(o instanceof PluginNativeHost))
                    throw new Exception(entry + " doesn't implement PluginNativeHost");
                made[0] = (PluginNativeHost) o;
                made[0].onCreate(getContext().getApplicationContext(), hostDir);
            } catch (Throwable e) {
                failed[0] = e;
            }
            loaded.countDown();
        });
        loaded.await();
        if (failed[0] != null) {
            thread.quitSafely();
            throw new Exception("the plugin's host didn't load: " + failed[0], failed[0]);
        }
        Running r = new Running(sha, thread, handler, made[0]);
        synchronized (hosts) {
            hosts.put(pluginId, r);
        }
        return r;
    }

    private void stopHost(String pluginId) {
        Running r;
        synchronized (hosts) {
            r = hosts.remove(pluginId);
        }
        if (r == null) return;
        r.handler.post(() -> {
            try {
                r.host.onDestroy();
            } catch (Throwable e) {
                Log.w(TAG, "host onDestroy failed", e);
            }
            r.thread.quitSafely();
        });
    }

    /** On the UI thread: a new channel, one end to the host, one to the page. */
    private void connect(Running r, String id) {
        WebView webView = getBridge().getWebView();
        WebMessagePortCompat[] ports = WebViewCompat.createWebMessageChannel(webView);
        PortImpl port = new PortImpl(ports[0]);
        ports[0].setWebMessageCallback(r.handler, port);
        r.handler.post(() -> {
            try {
                r.host.onConnect(port);
            } catch (Throwable e) {
                Log.w(TAG, "host onConnect failed", e);
            }
        });
        Uri origin = Uri.parse(getBridge().getLocalUrl());
        Uri target = new Uri.Builder()
                .scheme(origin.getScheme())
                .encodedAuthority(origin.getEncodedAuthority())
                .build();
        WebViewCompat.postWebMessage(
                webView,
                new WebMessageCompat("zam:plugin-native-port:" + id,
                        new WebMessagePortCompat[] {ports[1]}),
                target);
    }

    /** A host's end of one connection. */
    private static final class PortImpl extends WebMessagePortCompat.WebMessageCallbackCompat
            implements PluginNativePort {
        private final WebMessagePortCompat port;
        private volatile Listener listener;
        private volatile boolean closed;

        PortImpl(WebMessagePortCompat port) {
            this.port = port;
        }

        @Override
        public void setListener(Listener l) {
            listener = l;
        }

        @Override
        public void post(String text) {
            if (!closed) port.postMessage(new WebMessageCompat(text));
        }

        @Override
        public void post(byte[] data) {
            if (!closed) port.postMessage(new WebMessageCompat(data));
        }

        @Override
        public void close() {
            if (closed) return;
            closed = true;
            port.close();
        }

        @Override
        public void onMessage(@NonNull WebMessagePortCompat p, @Nullable WebMessageCompat m) {
            Listener l = listener;
            if (closed || m == null || l == null) return;
            try {
                if (m.getType() == WebMessageCompat.TYPE_ARRAY_BUFFER) l.onMessage(m.getArrayBuffer());
                else if (m.getData() != null) l.onMessage(m.getData());
            } catch (Throwable e) {
                Log.w(TAG, "plugin port listener failed", e);
            }
        }
    }

    private static void deleteRecursive(File f) {
        if (f == null || !f.exists()) return;
        File[] kids = f.listFiles();
        if (kids != null) for (File k : kids) deleteRecursive(k);
        //noinspection ResultOfMethodCallIgnored
        f.setWritable(true);
        //noinspection ResultOfMethodCallIgnored
        f.delete();
    }

    @Override
    protected void handleOnDestroy() {
        synchronized (hosts) {
            for (String id : new HashSet<>(hosts.keySet())) stopHost(id);
        }
        io.shutdown();
        super.handleOnDestroy();
    }
}
