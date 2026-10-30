package moe.crafty.matrix;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.DataInputStream;
import java.io.EOFException;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.util.HashSet;
import java.util.Set;
import java.util.zip.GZIPInputStream;

/**
 * The web-bundle archive and its signed manifest, the Java reader of what
 * electron/bundleFormat.cjs writes (and the desktop app reads). Same layout:
 * gzip of "ZB1\n" | uint32 BE index length | index JSON | file bytes back to
 * back, the index being [{ p: path, s: size }]. Read as a stream so the
 * unpacked site (100+ MB) is never held in memory.
 */
final class WebBundleFormat {
    private static final byte[] MAGIC = { 'Z', 'B', '1', '\n' };
    private static final int MAX_FILES = 50000;
    private static final long MAX_UNPACKED_BYTES = 1024L * 1024L * 1024L;
    private static final int MAX_INDEX_BYTES = 16 * 1024 * 1024;

    /** Base64 decoding, replaceable so the format can be tested off-device. */
    interface Base64Decoder {
        byte[] decode(String s);
    }

    static Base64Decoder base64 = s -> android.util.Base64.decode(s, android.util.Base64.DEFAULT);

    private WebBundleFormat() {}

    /** A path from an archive is only ever a plain relative POSIX path. */
    static boolean isSafeEntryPath(String p) {
        if (p == null || p.isEmpty() || p.length() > 400) return false;
        if (p.startsWith("/") || p.indexOf('\\') >= 0 || p.indexOf('\0') >= 0) return false;
        String[] parts = p.split("/", -1);
        for (String part : parts) {
            if (part.isEmpty() || part.equals(".") || part.equals("..")) return false;
            // A drive letter segment ("C:").
            if (part.length() >= 2 && part.charAt(1) == ':' && Character.isLetter(part.charAt(0))) return false;
        }
        return true;
    }

    /**
     * Unpack an archive into destDir (which the caller deletes on failure).
     * Throws on anything malformed.
     */
    static void unpack(File archive, File destDir) throws IOException {
        try (InputStream raw = new BufferedInputStream(new FileInputStream(archive), 1 << 16);
             DataInputStream in = new DataInputStream(new GZIPInputStream(raw, 1 << 16))) {
            byte[] magic = new byte[MAGIC.length];
            in.readFully(magic);
            for (int i = 0; i < MAGIC.length; i++) {
                if (magic[i] != MAGIC[i]) throw new IOException("not a web bundle");
            }
            int indexLen = in.readInt();
            if (indexLen < 0 || indexLen > MAX_INDEX_BYTES) throw new IOException("web bundle index is invalid");
            byte[] indexBytes = new byte[indexLen];
            in.readFully(indexBytes);
            JSONArray index;
            try {
                index = new JSONArray(new String(indexBytes, StandardCharsets.UTF_8));
            } catch (JSONException e) {
                throw new IOException("web bundle index is invalid");
            }
            if (index.length() > MAX_FILES) throw new IOException("web bundle index is invalid");

            File root = destDir.getCanonicalFile();
            if (!root.mkdirs() && !root.isDirectory()) throw new IOException("cannot create " + root);
            Set<String> seen = new HashSet<>();
            long total = 0;
            byte[] buf = new byte[1 << 16];
            for (int i = 0; i < index.length(); i++) {
                JSONObject entry = index.optJSONObject(i);
                String p = entry == null ? null : entry.optString("p", null);
                long size = entry == null ? -1 : entry.optLong("s", -1);
                if (!isSafeEntryPath(p) || size < 0 || !seen.add(p)) {
                    throw new IOException("web bundle has an invalid entry");
                }
                total += size;
                if (total > MAX_UNPACKED_BYTES) throw new IOException("web bundle is too large");
                File target = new File(root, p).getCanonicalFile();
                if (!target.getPath().startsWith(root.getPath() + File.separator)) {
                    throw new IOException("web bundle entry escapes its folder");
                }
                File parent = target.getParentFile();
                if (parent != null && !parent.mkdirs() && !parent.isDirectory()) {
                    throw new IOException("cannot create " + parent);
                }
                try (OutputStream out = new FileOutputStream(target)) {
                    long left = size;
                    while (left > 0) {
                        int n = in.read(buf, 0, (int) Math.min(buf.length, left));
                        if (n < 0) throw new EOFException("web bundle is truncated");
                        out.write(buf, 0, n);
                        left -= n;
                    }
                }
            }
            if (!seen.contains("index.html")) throw new IOException("web bundle has no index.html");
        }
    }

    /**
     * The exact bytes that are signed, identical to manifestSigningPayload in
     * electron/bundleFormat.cjs.
     */
    static String signingPayload(JSONObject m) {
        return "zam-web-bundle-v2\n" + m.optString("version") + "\n" + m.optString("shellHash") + "\n"
            + m.optString("androidShellHash") + "\n" + m.optString("file") + "\n" + m.optString("sha512") + "\n"
            + m.optLong("size", -1);
    }

    /** Whether the manifest is complete and signed by `publicKeyBase64`. */
    static boolean verifyManifest(JSONObject m, String publicKeyBase64) {
        try {
            if (m == null) return false;
            String[] required = { "version", "shellHash", "androidShellHash", "file", "sha512", "signature" };
            for (String key : required) {
                if (!(m.opt(key) instanceof String) || m.optString(key).isEmpty()) return false;
            }
            if (m.optLong("size", -1) < 0) return false;
            PublicKey key = KeyFactory.getInstance("EC")
                .generatePublic(new X509EncodedKeySpec(base64.decode(publicKeyBase64)));
            Signature sig = Signature.getInstance("SHA256withECDSA");
            sig.initVerify(key);
            sig.update(signingPayload(m).getBytes(StandardCharsets.UTF_8));
            return sig.verify(base64.decode(m.getString("signature")));
        } catch (Exception e) {
            return false;
        }
    }
}
