package moe.crafty.matrix;

import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.URL;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Locale;

/**
 * Fetches a web page (for its HTML) or an image on behalf of the web layer, so
 * link previews can carry a crawler-style User-Agent that a WebView cannot send
 * and that is not subject to CORS. Every failure resolves { kind: "none" }; the
 * method never rejects.
 *
 * Each hop is checked before connecting: http/https only, no userinfo, and every
 * resolved address must be public (no loopback, link-local, private or other
 * reserved ranges). Redirects are followed by hand so every hop gets that check.
 * Cookies are never sent (the WebView CookieManager is not used).
 */
@CapacitorPlugin(name = "LinkPage")
public class LinkPagePlugin extends Plugin {

    static final String USER_AGENT =
        "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots) WhatsApp/2.23.20.0";
    static final int MAX_HTML_BYTES = 1024 * 1024;
    static final int MAX_IMAGE_BYTES = 8 * 1024 * 1024;
    static final int MAX_REDIRECTS = 5;
    static final long DEADLINE_NANOS = 8_000_000_000L;
    static final int CONNECT_TIMEOUT_MS = 5000;
    static final int READ_TIMEOUT_MS = 5000;

    private static final String PAGE_ACCEPT =
        "text/html,application/xhtml+xml;q=0.9,image/*;q=0.8,*/*;q=0.5";
    private static final String IMAGE_ACCEPT = "image/*";

    @PluginMethod
    public void fetch(PluginCall call) {
        final String url;
        final boolean page;
        try {
            url = call.getString("url");
            String mode = call.getString("mode");
            if (url == null || (!"page".equals(mode) && !"image".equals(mode))) {
                call.resolve(none());
                return;
            }
            page = "page".equals(mode);
        } catch (Throwable t) {
            call.resolve(none());
            return;
        }
        getBridge().execute(() -> {
            JSObject ret;
            try {
                ret = doFetch(url, page, System.nanoTime() + DEADLINE_NANOS);
            } catch (Throwable t) {
                ret = null;
            }
            call.resolve(ret != null ? ret : none());
        });
    }

    static JSObject none() {
        JSObject o = new JSObject();
        o.put("kind", "none");
        return o;
    }

    /** Returns the success object, or null for any failure. */
    private static JSObject doFetch(String start, boolean page, long deadline) throws Exception {
        URL current = new URL(start);
        int redirects = 0;
        while (true) {
            if (pastDeadline(deadline)) return null;
            if (!isAllowedTarget(current)) return null;

            // Through the user's proxy setting, like the app's other native requests.
            HttpURLConnection conn = ZamProxy.open(current);
            try {
                conn.setInstanceFollowRedirects(false);
                conn.setUseCaches(false);
                conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
                conn.setReadTimeout(READ_TIMEOUT_MS);
                conn.setRequestProperty("User-Agent", USER_AGENT);
                conn.setRequestProperty("Accept", page ? PAGE_ACCEPT : IMAGE_ACCEPT);

                int code = conn.getResponseCode();
                if (isRedirect(code)) {
                    String location = conn.getHeaderField("Location");
                    if (location == null || location.isEmpty()) return null;
                    if (++redirects > MAX_REDIRECTS) return null;
                    current = new URL(current, location);
                    continue;
                }
                if (code < 200 || code > 299) return null;

                String rawType = conn.getContentType();
                String ctype = mimeOf(rawType);

                if (ctype.startsWith("image/") && !"image/svg+xml".equals(ctype)) {
                    byte[] bytes;
                    try (InputStream in = conn.getInputStream()) {
                        bytes = readBounded(in, MAX_IMAGE_BYTES, false, deadline);
                    }
                    if (bytes == null) return null;
                    JSObject o = new JSObject();
                    o.put("kind", "image");
                    o.put("finalUrl", current.toString());
                    o.put("contentType", ctype);
                    o.put("base64", Base64.encodeToString(bytes, Base64.NO_WRAP));
                    return o;
                }

                if (page && ("text/html".equals(ctype) || "application/xhtml+xml".equals(ctype))) {
                    byte[] bytes;
                    try (InputStream in = conn.getInputStream()) {
                        bytes = readBounded(in, MAX_HTML_BYTES, true, deadline);
                    }
                    if (bytes == null) return null;
                    JSObject o = new JSObject();
                    o.put("kind", "html");
                    o.put("finalUrl", current.toString());
                    o.put("html", new String(bytes, charsetOf(rawType)));
                    return o;
                }

                return null;
            } finally {
                conn.disconnect();
            }
        }
    }

    private static boolean pastDeadline(long deadline) {
        return System.nanoTime() - deadline > 0;
    }

    private static boolean isRedirect(int code) {
        return code == 301 || code == 302 || code == 303 || code == 307 || code == 308;
    }

    /**
     * Reads up to max bytes. Over the limit: truncate (keep the first max bytes)
     * when truncate is set, otherwise fail (null). Null also when the deadline
     * passes mid-read or the stream fails.
     */
    private static byte[] readBounded(InputStream in, int max, boolean truncate, long deadline)
        throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[16 * 1024];
        while (true) {
            if (pastDeadline(deadline)) return null;
            int n = in.read(buf);
            if (n < 0) break;
            if (out.size() + n > max) {
                if (!truncate) return null;
                out.write(buf, 0, max - out.size());
                break;
            }
            out.write(buf, 0, n);
        }
        return out.toByteArray();
    }

    /** Lowercased media type with parameters stripped. */
    static String mimeOf(String header) {
        if (header == null) return "";
        int semi = header.indexOf(';');
        String base = semi >= 0 ? header.substring(0, semi) : header;
        return base.trim().toLowerCase(Locale.ROOT);
    }

    /** Charset from the Content-Type parameters if supported, else UTF-8. */
    static Charset charsetOf(String header) {
        if (header == null) return StandardCharsets.UTF_8;
        String lower = header.toLowerCase(Locale.ROOT);
        int idx = lower.indexOf("charset=");
        if (idx < 0) return StandardCharsets.UTF_8;
        String name = header.substring(idx + "charset=".length());
        int semi = name.indexOf(';');
        if (semi >= 0) name = name.substring(0, semi);
        name = name.trim().replace("\"", "").replace("'", "");
        try {
            if (!name.isEmpty() && Charset.isSupported(name)) return Charset.forName(name);
        } catch (Exception ignored) {
            // Illegal charset name: fall through to UTF-8.
        }
        return StandardCharsets.UTF_8;
    }

    /** Scheme, userinfo and DNS checks for one hop, before connecting. */
    static boolean isAllowedTarget(URL url) {
        String proto = url.getProtocol();
        if (!"http".equals(proto) && !"https".equals(proto)) return false;
        if (url.getUserInfo() != null) return false;
        String host = url.getHost();
        if (host == null || host.isEmpty()) return false;
        try {
            InetAddress[] addrs = InetAddress.getAllByName(host);
            if (addrs == null || addrs.length == 0) return false;
            for (InetAddress a : addrs) {
                if (!isPublicAddress(a)) return false;
            }
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /** True only for globally routable unicast addresses. */
    static boolean isPublicAddress(InetAddress addr) {
        if (addr == null) return false;
        if (
            addr.isAnyLocalAddress() ||
            addr.isLoopbackAddress() ||
            addr.isLinkLocalAddress() ||
            addr.isSiteLocalAddress() ||
            addr.isMulticastAddress()
        ) return false;
        byte[] b = addr.getAddress();
        if (b.length == 16) {
            boolean mapped = b[10] == (byte) 0xff && b[11] == (byte) 0xff;
            for (int i = 0; mapped && i < 10; i++) {
                if (b[i] != 0) mapped = false;
            }
            if (!mapped) return isPublicIpv6(b);
            b = Arrays.copyOfRange(b, 12, 16);
        }
        if (b.length != 4) return false;
        return isPublicIpv4(b);
    }

    private static boolean isPublicIpv4(byte[] b) {
        int a = b[0] & 0xff;
        int c = b[1] & 0xff;
        int d = b[2] & 0xff;
        if (a == 0) return false; // 0.0.0.0/8
        if (a == 100 && (c & 0xC0) == 64) return false; // 100.64.0.0/10
        if (a == 192 && c == 0 && d == 0) return false; // 192.0.0.0/24
        if (a == 192 && c == 0 && d == 2) return false; // 192.0.2.0/24
        if (a == 198 && (c == 18 || c == 19)) return false; // 198.18.0.0/15
        if (a == 198 && c == 51 && d == 100) return false; // 198.51.100.0/24
        if (a == 203 && c == 0 && d == 113) return false; // 203.0.113.0/24
        if (a >= 240) return false; // 240.0.0.0/4, includes 255.255.255.255
        return true;
    }

    private static boolean isPublicIpv6(byte[] b) {
        if ((b[0] & 0xfe) == 0xfc) return false; // fc00::/7 unique local
        if (
            b[0] == 0x20 && b[1] == 0x01 && b[2] == 0x0d && b[3] == (byte) 0xb8
        ) return false; // 2001:db8::/32 documentation
        return true;
    }
}
