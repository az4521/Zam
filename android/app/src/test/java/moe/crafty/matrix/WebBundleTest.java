package moe.crafty.matrix;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Base64;
import java.util.zip.GZIPOutputStream;

/**
 * Runs on the development JVM (./gradlew :app:testDebugUnitTest). The fixture
 * in src/test/resources/web-bundle was written by the desktop tooling
 * (electron/bundleFormat.cjs: packBundle and signManifest, with a throwaway
 * ECDSA P-256 key), so these also prove that what Node signs and packs, Java
 * verifies and unpacks.
 */
public class WebBundleTest {
    private static final String SHELL_HASH = "e".repeat(64);

    @Rule
    public TemporaryFolder tmp = new TemporaryFolder();

    private String publicKey;
    private String manifestText;
    private byte[] bundleBytes;

    @BeforeClass
    public static void useJvmBase64() {
        WebBundleFormat.base64 = s -> Base64.getDecoder().decode(s);
    }

    private static byte[] resource(String name) throws IOException {
        try (InputStream in = WebBundleTest.class.getResourceAsStream("/web-bundle/" + name)) {
            assertNotNull(name, in);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[4096];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return out.toByteArray();
        }
    }

    @Before
    public void load() throws Exception {
        publicKey = new String(resource("public-key.txt"), StandardCharsets.UTF_8).trim();
        manifestText = new String(resource("zam-bundle.json"), StandardCharsets.UTF_8);
        bundleBytes = resource("zam-bundle-9.9.9.zbundle");
    }

    // --- format -------------------------------------------------------------

    @Test
    public void verifiesTheManifestTheDesktopToolingSigned() throws Exception {
        assertTrue(WebBundleFormat.verifyManifest(new JSONObject(manifestText), publicKey));
    }

    @Test
    public void rejectsAnyChangeToWhatWasSigned() throws Exception {
        for (String field : new String[] { "version", "shellHash", "androidShellHash", "file", "sha512" }) {
            JSONObject m = new JSONObject(manifestText);
            m.put(field, "x" + m.getString(field));
            assertFalse(field, WebBundleFormat.verifyManifest(m, publicKey));
        }
        JSONObject m = new JSONObject(manifestText);
        m.put("size", m.getLong("size") + 1);
        assertFalse(WebBundleFormat.verifyManifest(m, publicKey));
    }

    @Test
    public void rejectsAnotherKeyAndIncompleteManifests() throws Exception {
        java.security.KeyPairGenerator gen = java.security.KeyPairGenerator.getInstance("EC");
        gen.initialize(256);
        String other = Base64.getEncoder().encodeToString(gen.generateKeyPair().getPublic().getEncoded());
        assertFalse(WebBundleFormat.verifyManifest(new JSONObject(manifestText), other));
        JSONObject noSig = new JSONObject(manifestText);
        noSig.remove("signature");
        assertFalse(WebBundleFormat.verifyManifest(noSig, publicKey));
        assertFalse(WebBundleFormat.verifyManifest(null, publicKey));
    }

    @Test
    public void unpacksTheDesktopArchive() throws Exception {
        File archive = tmp.newFile("a.zbundle");
        Files.write(archive.toPath(), bundleBytes);
        File out = new File(tmp.getRoot(), "out");
        WebBundleFormat.unpack(archive, out);
        assertEquals("<html>fixture 9.9.9</html>", new String(Files.readAllBytes(new File(out, "index.html").toPath()), StandardCharsets.UTF_8));
        assertTrue(new File(out, "_app/immutable/a.js").isFile());
    }

    private File rawArchive(String indexJson, byte[] data) throws IOException {
        ByteArrayOutputStream raw = new ByteArrayOutputStream();
        try (GZIPOutputStream gz = new GZIPOutputStream(raw)) {
            DataOutputStream out = new DataOutputStream(gz);
            out.write(new byte[] { 'Z', 'B', '1', '\n' });
            byte[] idx = indexJson.getBytes(StandardCharsets.UTF_8);
            out.writeInt(idx.length);
            out.write(idx);
            out.write(data);
            out.flush();
        }
        File f = tmp.newFile();
        try (FileOutputStream fo = new FileOutputStream(f)) {
            fo.write(raw.toByteArray());
        }
        return f;
    }

    @Test
    public void refusesPathsThatLeaveTheFolder() throws Exception {
        for (String p : new String[] { "../evil", "/abs", "a/../../b", "a\\\\b", "C:/x", "" }) {
            File archive = rawArchive("[{\"p\":\"" + p + "\",\"s\":1}]", new byte[] { 'x' });
            try {
                WebBundleFormat.unpack(archive, new File(tmp.getRoot(), "o" + Math.abs(p.hashCode())));
                fail("accepted " + p);
            } catch (IOException expected) {
                // refused
            }
            assertFalse(p, WebBundleFormat.isSafeEntryPath(p));
        }
        assertTrue(WebBundleFormat.isSafeEntryPath("_app/immutable/a.js"));
    }

    @Test
    public void refusesTruncatedArchivesAndOnesWithoutIndexHtml() throws Exception {
        try {
            WebBundleFormat.unpack(rawArchive("[{\"p\":\"index.html\",\"s\":50}]", "short".getBytes()), new File(tmp.getRoot(), "t"));
            fail();
        } catch (IOException expected) {
            // refused
        }
        try {
            WebBundleFormat.unpack(rawArchive("[{\"p\":\"other.html\",\"s\":1}]", new byte[] { 'x' }), new File(tmp.getRoot(), "n"));
            fail();
        } catch (IOException expected) {
            // refused
        }
    }

    // --- store --------------------------------------------------------------

    private static final String PREFIX = WebBundleStore.ASSET_URL_PREFIX;

    private WebBundleStore.Net fakeNet(final byte[] archive) {
        return new WebBundleStore.Net() {
            @Override
            public String getText(String url) {
                try {
                    if (url.equals(WebBundleStore.RELEASE_URL)) {
                        JSONArray assets = new JSONArray();
                        assets.put(new JSONObject().put("name", "zam-bundle.json").put("browser_download_url", PREFIX + "zam-bundle.json"));
                        assets.put(new JSONObject().put("name", "zam-bundle-9.9.9.zbundle").put("browser_download_url", PREFIX + "zam-bundle-9.9.9.zbundle"));
                        return new JSONObject().put("assets", assets).toString();
                    }
                    return manifestText;
                } catch (Exception e) {
                    throw new IllegalStateException(e);
                }
            }

            @Override
            public void download(String url, File dest, long maxBytes, WebBundleStore.Progress p) throws IOException {
                Files.write(dest.toPath(), archive);
                p.onProgress(1.0);
            }
        };
    }

    private WebBundleStore storeFor(String shellVersion, String shellHash) {
        return new WebBundleStore(new File(tmp.getRoot(), "web-bundles"), shellVersion, shellHash, publicKey);
    }

    private WebBundleStore.Found stage(WebBundleStore store) throws Exception {
        store.launchRoot(false);
        WebBundleStore.Found found = store.check(fakeNet(bundleBytes));
        assertEquals(WebBundleStore.Found.BUNDLE, found.kind);
        store.download(found, fakeNet(bundleBytes), f -> {});
        return found;
    }

    @Test
    public void findsStagesAndAppliesANewerBundleForThisShell() throws Exception {
        WebBundleStore store = storeFor("1.0.0", SHELL_HASH);
        store.launchRoot(false);
        WebBundleStore.Found found = store.check(fakeNet(bundleBytes));
        assertEquals(WebBundleStore.Found.BUNDLE, found.kind);
        assertFalse(found.staged);
        assertEquals("9.9.9", found.version);
        store.download(found, fakeNet(bundleBytes), f -> {});
        assertEquals("9.9.9", store.stagedVersion());
        // Staged only: still serving the packed UI.
        assertEquals("1.0.0", store.currentVersion());
        String root = store.apply("9.9.9");
        assertTrue(new File(root, "index.html").isFile());
        // The next launch serves it once the page has confirmed it loaded.
        store.markReady();
        assertEquals(root, storeFor("1.0.0", SHELL_HASH).launchRoot(false));
    }

    @Test
    public void takesAStagedBundleAtLaunchOnlyWhenAsked() throws Exception {
        stage(storeFor("1.0.0", SHELL_HASH));
        assertNull(storeFor("1.0.0", SHELL_HASH).launchRoot(false));
        // It survives a launch that did not take it.
        assertTrue(new File(tmp.getRoot(), "web-bundles/9.9.9/index.html").isFile());
        assertEquals(new File(tmp.getRoot(), "web-bundles/9.9.9").getPath(), storeFor("1.0.0", SHELL_HASH).launchRoot(true));
    }

    @Test
    public void sendsAReleaseForADifferentShellToTheApk() throws Exception {
        WebBundleStore store = storeFor("1.0.0", "f".repeat(64));
        WebBundleStore.Found found = store.check(fakeNet(bundleBytes));
        assertEquals(WebBundleStore.Found.SHELL, found.kind);
        assertEquals("9.9.9", found.version);
    }

    @Test
    public void ignoresAReleaseThatIsNotNewer() throws Exception {
        WebBundleStore store = storeFor("9.9.9", SHELL_HASH);
        assertEquals(WebBundleStore.Found.NONE, store.check(fakeNet(bundleBytes)).kind);
    }

    @Test
    public void refusesADownloadThatDoesNotMatchTheSignedHash() throws Exception {
        WebBundleStore store = storeFor("1.0.0", SHELL_HASH);
        store.launchRoot(false);
        WebBundleStore.Found found = store.check(fakeNet(bundleBytes));
        byte[] tampered = bundleBytes.clone();
        tampered[tampered.length - 1] ^= 1;
        try {
            store.download(found, fakeNet(tampered), f -> {});
            fail();
        } catch (IOException expected) {
            // refused
        }
        assertNull(store.stagedVersion());
        String[] left = new File(tmp.getRoot(), "web-bundles").list((d, n) -> n.startsWith("."));
        assertEquals(0, left == null ? 0 : left.length);
    }

    @Test
    public void dropsABundleWhosePageNeverLoadedAndNeverOffersItAgain() throws Exception {
        WebBundleStore store = storeFor("1.0.0", SHELL_HASH);
        stage(store);
        store.apply("9.9.9");
        // No markReady(): the next launch finds the attempt marker.
        WebBundleStore next = storeFor("1.0.0", SHELL_HASH);
        assertNull(next.launchRoot(true));
        assertEquals("1.0.0", next.currentVersion());
        assertEquals(WebBundleStore.Found.NONE, next.check(fakeNet(bundleBytes)).kind);
    }

    @Test
    public void stopsUsingABundleOnceTheInstalledApkIsAsNew() throws Exception {
        WebBundleStore store = storeFor("1.0.0", SHELL_HASH);
        stage(store);
        store.apply("9.9.9");
        store.markReady();
        assertNull(storeFor("9.9.9", SHELL_HASH).launchRoot(true));
    }

    @Test
    public void ignoresStagedBundlesBuiltForAnotherShell() throws Exception {
        stage(storeFor("1.0.0", SHELL_HASH));
        assertNull(storeFor("1.0.0", "c".repeat(64)).launchRoot(true));
    }

    @Test
    public void ordersVersionsNumerically() {
        assertEquals(1, WebBundleStore.compareVersions("1.10.0", "1.9.9"));
        assertEquals(0, WebBundleStore.compareVersions("1.38.0", "1.38.0"));
        assertEquals(-1, WebBundleStore.compareVersions("1.38.0", "1.39.0"));
        assertEquals(-1, WebBundleStore.compareVersions("1.39.0-beta", "1.39.0"));
    }
}
