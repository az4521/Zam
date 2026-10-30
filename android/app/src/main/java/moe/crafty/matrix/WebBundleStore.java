package moe.crafty.matrix;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Updates the web UI without installing a new APK. The Android counterpart of
 * electron/bundleUpdater.cjs, with the same rules: a release publishes the
 * built site as a signed bundle, this verifies and stages it, and the WebView
 * is pointed at it. The shell (Java, plugins, manifest) cannot change this way,
 * so a bundle only applies to a shell with the fingerprint it was built for
 * (scripts/shell-hash-lib.mjs); any other release takes the APK update.
 *
 * State in `dir` (filesDir/web-bundles):
 *   <version>/        an unpacked bundle, with meta.json { version, shellHash }
 *   active.json       { version } which one the WebView uses; absent = the one
 *                     packed in the APK
 *   bad.json          [version] bundles that never finished loading
 *   boot-attempt.json { version } written when an unproven bundle is applied,
 *                     removed when the page says it loaded; found at the next
 *                     start it means that bundle is broken, so it is dropped
 *
 * Network access comes in through {@link Net}, so none of this touches it.
 */
final class WebBundleStore {
    /** What the store needs from the network. Implemented by WebBundlePlugin. */
    interface Net {
        String getText(String url) throws IOException;

        void download(String url, File dest, long maxBytes, Progress progress) throws IOException;
    }

    interface Progress {
        void onProgress(double fraction);
    }

    /** What check() found. */
    static final class Found {
        static final int NONE = 0;
        static final int SHELL = 1;
        static final int BUNDLE = 2;

        int kind = NONE;
        String version;
        boolean staged;
        JSONObject manifest;
        String assetUrl;
    }

    static final String RELEASE_URL = "https://api.github.com/repos/az4521/Zam/releases/latest";
    static final String ASSET_URL_PREFIX = "https://github.com/az4521/Zam/releases/download/";
    private static final String MANIFEST_ASSET = "zam-bundle.json";
    private static final long MAX_BUNDLE_BYTES = 300L * 1024L * 1024L;
    private static final Pattern SAFE_VERSION = Pattern.compile("^\\d+\\.\\d+\\.\\d+(-[0-9A-Za-z.-]+)?$");

    private final File dir;
    private final String shellVersion;
    private final String shellHash;
    private final String publicKey;
    private final File activeFile;
    private final File badFile;
    private final File bootFile;

    // The version the UI is running now: the applied bundle, else the shell's.
    private String current;

    WebBundleStore(File dir, String shellVersion, String shellHash, String publicKey) {
        this.dir = dir;
        this.shellVersion = shellVersion;
        this.shellHash = shellHash;
        this.publicKey = publicKey;
        this.activeFile = new File(dir, "active.json");
        this.badFile = new File(dir, "bad.json");
        this.bootFile = new File(dir, "boot-attempt.json");
        this.current = shellVersion;
    }

    /** -1, 0 or 1. Numeric x.y.z; a pre-release sorts below its release. */
    static int compareVersions(String a, String b) {
        int[] x = core(a);
        int[] y = core(b);
        for (int i = 0; i < 3; i++) {
            if (x[i] != y[i]) return x[i] < y[i] ? -1 : 1;
        }
        String px = pre(a);
        String py = pre(b);
        if (px == null && py == null) return 0;
        if (px == null) return 1;
        if (py == null) return -1;
        int c = px.compareTo(py);
        return c < 0 ? -1 : c > 0 ? 1 : 0;
    }

    private static int[] core(String v) {
        String c = v.split("-", 2)[0];
        String[] parts = c.split("\\.");
        int[] n = new int[3];
        for (int i = 0; i < 3 && i < parts.length; i++) {
            try {
                n[i] = Integer.parseInt(parts[i]);
            } catch (NumberFormatException e) {
                n[i] = 0;
            }
        }
        return n;
    }

    private static String pre(String v) {
        String[] p = v.split("-", 2);
        return p.length > 1 ? p[1] : null;
    }

    private File bundleDir(String version) {
        return new File(dir, version);
    }

    // --- small file helpers ---------------------------------------------------

    private static String readText(File f) {
        try (InputStream in = new FileInputStream(f)) {
            java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
            byte[] buf = new byte[4096];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            return null;
        }
    }

    private static JSONObject readObject(File f) {
        String text = readText(f);
        if (text == null) return null;
        try {
            return new JSONObject(text);
        } catch (JSONException e) {
            return null;
        }
    }

    // A crash between write and rename leaves the old file, never half a new one.
    private static void writeAtomic(File f, String text) throws IOException {
        File tmp = new File(f.getPath() + ".tmp");
        try (FileOutputStream out = new FileOutputStream(tmp)) {
            out.write(text.getBytes(StandardCharsets.UTF_8));
            out.getFD().sync();
        }
        if (!tmp.renameTo(f)) {
            //noinspection ResultOfMethodCallIgnored
            f.delete();
            if (!tmp.renameTo(f)) throw new IOException("cannot write " + f);
        }
    }

    private static void deleteTree(File f) {
        File[] kids = f.listFiles();
        if (kids != null) {
            for (File k : kids) deleteTree(k);
        }
        //noinspection ResultOfMethodCallIgnored
        f.delete();
    }

    private List<String> bad() {
        List<String> out = new ArrayList<>();
        String text = readText(badFile);
        if (text == null) return out;
        try {
            JSONArray a = new JSONArray(text);
            for (int i = 0; i < a.length(); i++) out.add(a.optString(i));
        } catch (JSONException e) {
            // unreadable: nothing is banned
        }
        return out;
    }

    private void writeBad(List<String> list) throws IOException {
        writeAtomic(badFile, new JSONArray(list).toString());
    }

    private static String versionIn(File f) {
        JSONObject o = readObject(f);
        return o == null ? null : o.optString("version", null);
    }

    private boolean stagedOk(String version) {
        if (version == null || !SAFE_VERSION.matcher(version).matches()) return false;
        JSONObject meta = readObject(new File(bundleDir(version), "meta.json"));
        return meta != null
            && version.equals(meta.optString("version"))
            && shellHash.equals(meta.optString("shellHash"))
            && new File(bundleDir(version), "index.html").isFile();
    }

    private String newestStaged() {
        String[] names = dir.list();
        if (names == null) return null;
        List<String> banned = bad();
        String best = null;
        for (String name : names) {
            if (!stagedOk(name) || banned.contains(name)) continue;
            if (best == null || compareVersions(name, best) > 0) best = name;
        }
        return best;
    }

    private void prune(String... keep) {
        String[] names = dir.list();
        if (names == null) return;
        for (String name : names) {
            boolean kept = false;
            for (String k : keep) {
                if (name.equals(k)) kept = true;
            }
            if (kept) continue;
            if (SAFE_VERSION.matcher(name).matches() || name.startsWith(".dl-") || name.startsWith(".tmp-")) {
                deleteTree(new File(dir, name));
            }
        }
    }

    // --- launch ---------------------------------------------------------------

    /**
     * The folder the WebView should serve, decided once at launch before the
     * WebView exists; null serves the site packed in the APK. With
     * applyStaged, a staged newer bundle is taken now: nothing is on screen
     * yet, so no reload.
     */
    String launchRoot(boolean applyStaged) throws IOException {
        //noinspection ResultOfMethodCallIgnored
        dir.mkdirs();

        // Last time an unproven bundle never said it loaded: drop it.
        String attempt = bootFile.isFile() ? versionIn(bootFile) : null;
        if (bootFile.isFile()) {
            List<String> list = bad();
            if (attempt != null && !list.contains(attempt)) list.add(attempt);
            writeBad(list);
            //noinspection ResultOfMethodCallIgnored
            bootFile.delete();
            //noinspection ResultOfMethodCallIgnored
            activeFile.delete();
        }

        String version = versionIn(activeFile);
        if (applyStaged) {
            String newest = newestStaged();
            if (newest != null && compareVersions(newest, version != null ? version : shellVersion) > 0) {
                version = newest;
                writeAtomic(activeFile, versionJson(version));
                writeAtomic(bootFile, versionJson(version));
            }
        }

        boolean usable = version != null
            && stagedOk(version)
            && !bad().contains(version)
            // A newer shell (installed over us) carries a newer UI.
            && compareVersions(version, shellVersion) > 0;
        if (!usable) {
            if (version != null) {
                //noinspection ResultOfMethodCallIgnored
                activeFile.delete();
            }
            // A bundle staged for later stays; the rest is out of date.
            String staged = newestStaged();
            if (staged != null) prune(staged);
            else prune();
            return null;
        }
        current = version;
        String staged = newestStaged();
        if (staged != null && !staged.equals(version)) prune(version, staged);
        else prune(version);
        return bundleDir(version).getPath();
    }

    private static String versionJson(String version) {
        try {
            return new JSONObject().put("version", version).toString();
        } catch (JSONException e) {
            throw new IllegalStateException(e);
        }
    }

    /** The page loaded: the bundle in use is good. */
    void markReady() {
        //noinspection ResultOfMethodCallIgnored
        bootFile.delete();
    }

    String currentVersion() {
        return current;
    }

    /** A staged bundle newer than the one in use, or null. */
    String stagedVersion() {
        String v = newestStaged();
        return v != null && compareVersions(v, current) > 0 ? v : null;
    }

    // --- check / download / apply --------------------------------------------

    /**
     * Ask the release feed. NONE: nothing newer for this shell. SHELL: newer,
     * but needs the APK. BUNDLE: a bundle this shell can take. Throws when the
     * feed cannot be read or a manifest does not verify.
     */
    Found check(Net net) throws IOException {
        Found out = new Found();
        JSONObject release;
        try {
            release = new JSONObject(net.getText(RELEASE_URL));
        } catch (JSONException e) {
            throw new IOException("release feed is unreadable");
        }
        JSONArray assets = release.optJSONArray("assets");
        if (assets == null) return out;
        String manifestUrl = assetUrl(assets, MANIFEST_ASSET);
        if (manifestUrl == null) return out;
        if (!manifestUrl.startsWith(ASSET_URL_PREFIX)) {
            throw new IOException("web bundle manifest is not on the release host");
        }

        JSONObject manifest;
        try {
            manifest = new JSONObject(net.getText(manifestUrl));
        } catch (JSONException e) {
            throw new IOException("web bundle manifest is unreadable");
        }
        if (!WebBundleFormat.verifyManifest(manifest, publicKey)) {
            throw new IOException("web bundle manifest signature is invalid");
        }
        String version = manifest.optString("version");
        if (!SAFE_VERSION.matcher(version).matches()) throw new IOException("web bundle manifest has a bad version");
        // Never go back, however validly signed (a replayed old release).
        if (compareVersions(version, current) <= 0) return out;
        if (bad().contains(version)) return out;
        if (!shellHash.equals(manifest.optString("androidShellHash"))) {
            out.kind = Found.SHELL;
            out.version = version;
            return out;
        }
        out.kind = Found.BUNDLE;
        out.version = version;
        if (stagedOk(version)) {
            out.staged = true;
            return out;
        }
        String url = assetUrl(assets, manifest.optString("file"));
        if (url == null || !url.startsWith(ASSET_URL_PREFIX)) {
            throw new IOException("web bundle file is missing from the release");
        }
        out.manifest = manifest;
        out.assetUrl = url;
        return out;
    }

    private static String assetUrl(JSONArray assets, String name) {
        for (int i = 0; i < assets.length(); i++) {
            JSONObject a = assets.optJSONObject(i);
            if (a != null && name.equals(a.optString("name"))) return a.optString("browser_download_url", null);
        }
        return null;
    }

    /** Download, verify and unpack a bundle check() found, into staging. */
    void download(Found found, Net net, Progress progress) throws IOException {
        String version = found.version;
        //noinspection ResultOfMethodCallIgnored
        dir.mkdirs();
        File archive = new File(dir, ".dl-" + version);
        File unpacked = new File(dir, ".tmp-" + version);
        deleteTree(unpacked);
        //noinspection ResultOfMethodCallIgnored
        archive.delete();
        try {
            long size = found.manifest.optLong("size", -1);
            net.download(found.assetUrl, archive, Math.min(size, MAX_BUNDLE_BYTES), progress);
            if (archive.length() != size) throw new IOException("web bundle does not match its manifest");
            if (!sha512Matches(archive, found.manifest.optString("sha512"))) {
                throw new IOException("web bundle does not match its manifest");
            }
            WebBundleFormat.unpack(archive, unpacked);
            writeAtomic(
                new File(unpacked, "meta.json"),
                new JSONObject().put("version", version).put("shellHash", shellHash).toString()
            );
            deleteTree(bundleDir(version));
            if (!unpacked.renameTo(bundleDir(version))) throw new IOException("cannot stage the web bundle");
        } catch (JSONException e) {
            throw new IOException(e);
        } finally {
            //noinspection ResultOfMethodCallIgnored
            archive.delete();
            deleteTree(unpacked);
        }
        prune(current, version);
    }

    private static boolean sha512Matches(File f, String expectedBase64) throws IOException {
        try (InputStream in = new FileInputStream(f)) {
            MessageDigest md = MessageDigest.getInstance("SHA-512");
            byte[] buf = new byte[1 << 16];
            int n;
            while ((n = in.read(buf)) > 0) md.update(buf, 0, n);
            return MessageDigest.isEqual(md.digest(), WebBundleFormat.base64.decode(expectedBase64));
        } catch (java.security.NoSuchAlgorithmException | IllegalArgumentException e) {
            return false;
        }
    }

    /**
     * Make the staged bundle the one used. The caller points the WebView at
     * the returned folder and reloads it.
     */
    String apply(String version) throws IOException {
        if (!stagedOk(version)) throw new IOException("no such staged bundle");
        writeAtomic(activeFile, versionJson(version));
        writeAtomic(bootFile, versionJson(version));
        current = version;
        return bundleDir(version).getPath();
    }
}
