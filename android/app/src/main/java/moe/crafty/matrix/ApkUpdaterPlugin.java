package moe.crafty.matrix;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.content.pm.SigningInfo;
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
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.Set;
import java.util.TreeSet;

/**
 * Custom Capacitor plugin that downloads a release APK and hands it to the OS
 * package installer. Sideloaded (self-signed, GitHub-distributed) Android apps
 * cannot self-install silently — the realistic ceiling is auto-download, then a
 * single user "Install" tap in the system installer UI. See the design spec:
 * docs/superpowers/specs/2026-07-24-android-apk-updater-design.md.
 *
 * Authenticity (audit SEC-02) is established HERE, not in the renderer: the
 * renderer only ever proposes a URL and a version floor. Before the installer
 * is shown the archive must be (a) fetched over https from an allowlisted
 * GitHub host, redirects included, (b) this exact package, (c) a strictly
 * higher versionCode than the installed build, and (d) signed by the same
 * certificate as the installed build. Rotating the signing key therefore
 * breaks in-app updates for existing installs — that is a deliberate,
 * accepted trade (owner decision, 2026-07-30).
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

    /** Subdirectory of the app-private cache the FileProvider exposes
     *  (res/xml/file_paths.xml). Nothing else may be written here. */
    private static final String UPDATE_DIR = "apk-update";
    /** Where downloadApk writes. The renderer can cause bytes to land here at
     *  any moment, so this file is never the one handed to the installer. */
    private static final String UPDATE_FILE = "update.apk";
    /** Where installApk moves the archive before verifying it. downloadApk
     *  NEVER writes to this name — it may only delete it — so nothing can
     *  substitute the bytes between verifyApk and the installer's open(). */
    private static final String STAGED_FILE = "staged.apk";

    /** Redirect hops we will follow. GitHub uses one hop to its asset CDN. */
    private static final int MAX_REDIRECTS = 5;
    /** Hard ceiling on a downloaded archive; the real APK is ~30 MB. */
    private static final long MAX_APK_BYTES = 300L * 1024L * 1024L;
    /** Exact host the initial URL must use. Matched with equals(), never
     *  contains()/indexOf() — "github.com.evil.tld" must not pass. */
    private static final String PRIMARY_HOST = "github.com";
    /** Suffix of the CDN hosts GitHub redirects release downloads to. The
     *  LEADING DOT is load-bearing: it anchors the match to a label boundary,
     *  so "evilgithubusercontent.com" cannot satisfy it. Never drop it. */
    private static final String CDN_HOST_SUFFIX = ".githubusercontent.com";

    /**
     * Download the APK at `url` to app-private storage, emitting
     * `downloadProgress` events ({ percent }), verify it, and resolve
     * { path }. Network IO runs on a background thread so it never blocks the
     * WebView / main thread. Any verification failure rejects AND deletes the
     * file.
     */
    @PluginMethod
    public void downloadApk(final PluginCall call) {
        final String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            // Clear the slate here too, not just on the worker thread: leaving
            // an earlier verified APK behind lets a later installApk() install
            // a version the UI never named.
            //noinspection ResultOfMethodCallIgnored
            updateFile().delete();
            //noinspection ResultOfMethodCallIgnored
            stagedFile().delete();
            call.reject("Missing download url");
            return;
        }
        final int minVersionCode = call.getInt("minVersionCode", 0);
        new Thread(() -> {
            File outFile = updateFile();
            HttpURLConnection conn = null;
            try {
                // Never reuse a previous attempt's bytes, downloaded or
                // staged: a fresh download supersedes whatever is on disk.
                // Note this only ever DELETES staged.apk — deleting is safe
                // even mid-install (an unlink cannot change bytes behind an
                // already-open fd), whereas writing to it could not be.
                //noinspection ResultOfMethodCallIgnored
                outFile.delete();
                //noinspection ResultOfMethodCallIgnored
                stagedFile().delete();
                File dir = outFile.getParentFile();
                if (dir != null && !dir.exists() && !dir.mkdirs()) {
                    call.reject("Could not prepare the download folder");
                    return;
                }

                conn = openAllowlisted(url);
                if (conn == null) {
                    call.reject("Refused: the update came from an unexpected location");
                    return;
                }
                if (conn.getResponseCode() / 100 != 2) {
                    call.reject("Download failed (HTTP " + conn.getResponseCode() + ")");
                    return;
                }
                // getContentLengthLong() is API 24 = our minSdk. The int form
                // truncates to -1 above 2 GB, which would silently disable
                // BOTH the pre-flight ceiling and the cut-short check below.
                final long total = conn.getContentLengthLong();
                if (total > MAX_APK_BYTES) {
                    call.reject("Refused: the update is implausibly large");
                    return;
                }
                long readBytes = 0;
                int lastPercent = -1;
                try (InputStream in = conn.getInputStream();
                     OutputStream out = new FileOutputStream(outFile)) {
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = in.read(buf)) != -1) {
                        readBytes += n;
                        if (readBytes > MAX_APK_BYTES) {
                            throw new IllegalStateException(
                                "the update is implausibly large");
                        }
                        out.write(buf, 0, n);
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
                if (total > 0 && readBytes != total) {
                    // Delete BEFORE rejecting: reject() resolves the JS
                    // promise, and a renderer that retries synchronously must
                    // not be able to observe the truncated file.
                    //noinspection ResultOfMethodCallIgnored
                    outFile.delete();
                    call.reject("Download was cut short — try again");
                    return;
                }

                String problem = verifyApk(outFile, minVersionCode);
                if (problem != null) {
                    //noinspection ResultOfMethodCallIgnored
                    outFile.delete();
                    call.reject("Refused: " + problem);
                    return;
                }

                JSObject ret = new JSObject();
                ret.put("path", outFile.getAbsolutePath());
                call.resolve(ret);
            } catch (Exception e) {
                //noinspection ResultOfMethodCallIgnored
                outFile.delete();
                call.reject("Download failed: " + e.getMessage(), e);
            } finally {
                if (conn != null) conn.disconnect();
            }
        }).start();
    }

    /**
     * Hand the verified downloaded APK to the OS package installer via a
     * content:// URI from the FileProvider. The installer UI opens; the user
     * taps Install. Requires REQUEST_INSTALL_PACKAGES (manifest) + the
     * unknown-apps permission on API 26+ (see canInstall /
     * openUnknownSourcesSettings).
     *
     * Takes NO caller-supplied path: the file is re-derived here and
     * re-verified, so a compromised renderer cannot pick what is installed.
     * The re-verification is NOT redundant with downloadApk's — this is the
     * only method that reaches startActivity, so it must not trust that any
     * earlier call checked anything.
     *
     * The archive is MOVED to staged.apk before it is verified, never after.
     * downloadApk writes only to update.apk, so once the rename has happened
     * a concurrent download cannot change the bytes that verifyApk read and
     * the installer will later open — closing the time-of-check /
     * time-of-use window between the two bridge calls.
     */
    @PluginMethod
    public void installApk(final PluginCall call) {
        try {
            File downloaded = updateFile();
            File staged = stagedFile();
            // Step 1: take the file out of downloadApk's reach, atomically,
            // BEFORE looking at it. Conditional on purpose — if the user
            // cancelled the system installer dialog and taps Install again,
            // update.apk is already gone and staged.apk is ready to reuse.
            if (downloaded.isFile() && !downloaded.renameTo(staged)) {
                call.reject("Could not stage the update");
                return;
            }
            if (!staged.isFile()) {
                call.reject("No downloaded update to install");
                return;
            }
            // Step 2: only now verify, and only ever the staged copy.
            String problem = verifyApk(staged, 0);
            if (problem != null) {
                //noinspection ResultOfMethodCallIgnored
                staged.delete();
                call.reject("Refused: " + problem);
                return;
            }
            Context ctx = getContext();
            Uri uri = FileProvider.getUriForFile(
                ctx, ctx.getPackageName() + ".fileprovider", staged);
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

    /** The one path this plugin ever downloads to. */
    private File updateFile() {
        return new File(updateDir(), UPDATE_FILE);
    }

    /**
     * The one path this plugin ever installs from. Same directory as
     * updateFile(), so Task 4's narrowed FileProvider scope still covers it
     * and the rename between them stays within one filesystem (i.e. atomic).
     */
    private File stagedFile() {
        return new File(updateDir(), STAGED_FILE);
    }

    private File updateDir() {
        return new File(getContext().getCacheDir(), UPDATE_DIR);
    }

    /**
     * Open `url`, following redirects by hand so every hop is re-checked
     * against the https + host allowlist. Returns a connected connection, or
     * null when a hop is not allowed / too many hops.
     */
    private HttpURLConnection openAllowlisted(String url) throws Exception {
        String current = url;
        for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
            URL parsed = new URL(current);
            if (!isAllowedUrl(parsed)) return null;
            HttpURLConnection conn = (HttpURLConnection) parsed.openConnection();
            // Anything that leaves this block without handing `conn` to the
            // caller must disconnect it — including a throwing connect() /
            // getResponseCode(), whose connection the caller cannot see and
            // so could never clean up itself.
            boolean handedOff = false;
            try {
                conn.setConnectTimeout(CONNECT_TIMEOUT);
                conn.setReadTimeout(READ_TIMEOUT);
                conn.setInstanceFollowRedirects(false);
                conn.connect();
                int code = conn.getResponseCode();
                if (code == HttpURLConnection.HTTP_MOVED_PERM
                    || code == HttpURLConnection.HTTP_MOVED_TEMP
                    || code == HttpURLConnection.HTTP_SEE_OTHER
                    || code == 307
                    || code == 308) {
                    String location = conn.getHeaderField("Location");
                    if (location == null || location.isEmpty()) return null;
                    current = new URL(parsed, location).toString();
                    continue;
                }
                handedOff = true;
                return conn;
            } finally {
                if (!handedOff) conn.disconnect();
            }
        }
        return null;
    }

    /**
     * https, no credentials, default port, github.com or its asset CDN.
     *
     * Host matching is dot-boundary anchored on purpose (equals for the
     * primary host, a dot-prefixed suffix for the CDN) — a substring test
     * would accept attacker-controlled lookalikes.
     *
     * Deliberately looser on the PATH than the renderer-side predicate in
     * src/lib/utils/androidUpdate.ts, which also rejects percent-encoded
     * traversal (%2e/%2f/%5c). GitHub's asset CDN hands back opaque, heavily
     * encoded paths, so mirroring those TS rules here would break real
     * downloads. The desync is safe: the path never reaches the filesystem
     * (we always write to our own updateFile()), and authenticity comes from
     * the signer/package/version check, not from the URL.
     */
    private boolean isAllowedUrl(URL u) {
        if (!"https".equalsIgnoreCase(u.getProtocol())) return false;
        if (u.getUserInfo() != null) return false;
        int port = u.getPort();
        if (port != -1 && port != 443) return false;
        String host = u.getHost();
        if (host == null) return false;
        host = host.toLowerCase(Locale.ROOT);
        return host.equals(PRIMARY_HOST) || host.endsWith(CDN_HOST_SUFFIX);
    }

    /**
     * Verify the downloaded archive really is a newer build of THIS app signed
     * by the same key. Returns null when it passes, otherwise a short reason
     * suitable for the UI.
     *
     * `minVersionCode` (0 = none) is the versionCode of the release the user
     * was offered; it blocks a signed-but-older asset being substituted.
     */
    @SuppressWarnings("deprecation")
    private String verifyApk(File apk, int minVersionCode) {
        if (!hasZipMagic(apk)) return "the download is not an app package";

        Context ctx = getContext();
        PackageManager pm = ctx.getPackageManager();
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
            ? PackageManager.GET_SIGNING_CERTIFICATES
            : PackageManager.GET_SIGNATURES;

        PackageInfo downloaded = pm.getPackageArchiveInfo(apk.getAbsolutePath(), flags);
        if (downloaded == null) return "the download is not an app package";
        if (!ctx.getPackageName().equals(downloaded.packageName)) {
            return "the download is a different app";
        }

        PackageInfo installed;
        try {
            installed = pm.getPackageInfo(ctx.getPackageName(), flags);
        } catch (PackageManager.NameNotFoundException e) {
            return "could not read the installed app";
        }

        long newCode = versionCodeOf(downloaded);
        long ownCode = versionCodeOf(installed);
        // The effective floor is max(ownCode, minVersionCode). This first
        // check is UNCONDITIONAL and strict (>, never >=): the renderer's
        // number can only ever make the requirement stricter, never looser,
        // so a compromised webview passing 0 or a low value cannot license a
        // rollback or a same-version reinstall.
        if (newCode <= ownCode) return "the download is not a newer version";
        // minVersionCode == 0 legitimately means "no floor supplied" — a
        // non-semver release tag, or a genuine 0.0.0 build. It means neither
        // "reject everything" nor "skip version checking": the unconditional
        // newCode > ownCode test above still stands on its own.
        if (minVersionCode > 0 && newCode < minVersionCode) {
            return "the download is older than the offered release";
        }

        Set<String> newSigners = signerDigests(downloaded);
        Set<String> ownSigners = signerDigests(installed);
        // Empty means unsigned or unreadable on either side. Checked BEFORE
        // equals() so two empty sets can never compare equal into a pass.
        if (newSigners.isEmpty() || ownSigners.isEmpty()) {
            return "the download is not signed";
        }
        if (!newSigners.equals(ownSigners)) {
            return "the download is signed by a different key";
        }
        return null;
    }

    /** Cheap sanity check that the file starts with a zip local-file header. */
    private boolean hasZipMagic(File f) {
        try (InputStream in = new FileInputStream(f)) {
            byte[] magic = new byte[4];
            int read = 0;
            while (read < 4) {
                int n = in.read(magic, read, 4 - read);
                if (n == -1) return false;
                read += n;
            }
            return magic[0] == 0x50 && magic[1] == 0x4B
                && magic[2] == 0x03 && magic[3] == 0x04;
        } catch (Exception e) {
            return false;
        }
    }

    @SuppressWarnings("deprecation")
    private long versionCodeOf(PackageInfo info) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            return info.getLongVersionCode();
        }
        return info.versionCode;
    }

    /**
     * SHA-256 of every signing certificate, as lowercase hex. An empty set
     * means "unsigned or unreadable", which callers treat as a failure.
     */
    @SuppressWarnings("deprecation")
    private Set<String> signerDigests(PackageInfo info) {
        Set<String> out = new TreeSet<>();
        Signature[] signatures = null;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            SigningInfo signingInfo = info.signingInfo;
            if (signingInfo != null) {
                signatures = signingInfo.getApkContentsSigners();
            }
        } else {
            signatures = info.signatures;
        }
        if (signatures == null) return out;
        for (Signature s : signatures) {
            if (s == null) continue;
            String hex = sha256Hex(s.toByteArray());
            if (hex != null) out.add(hex);
        }
        return out;
    }

    private String sha256Hex(byte[] data) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(data);
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                sb.append(Character.forDigit((b >> 4) & 0xF, 16));
                sb.append(Character.forDigit(b & 0xF, 16));
            }
            return sb.toString();
        } catch (Exception e) {
            return null;
        }
    }
}
