package moe.crafty.matrix;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.webkit.ProxyConfig;
import androidx.webkit.ProxyController;
import androidx.webkit.WebViewFeature;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Proxy;
import java.net.URL;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Settings > General > Network on Android: the counterpart of
 * electron/proxy.cjs, with the same prefs shape.
 *
 * The WebView (the app, and HeadlessDecryptor's page) follows the setting
 * through androidx.webkit's ProxyController, which overrides the proxy for
 * every WebView in the process. Native requests (push enrichment, quick
 * replies, updaters) open their connections through {@link #open(URL)}.
 *
 * Differences from desktop:
 *  - No PAC: ProxyConfig only takes fixed rules and a bypass list.
 *  - Calls "proxy" (WebRTC IP handling "disable_non_proxied_udp") has no
 *    WebView equivalent, so it isn't offered.
 *  - "system" leaves the WebView and native requests on Android's own proxy
 *    setting (Wi-Fi / global proxy), so calls can't bypass it.
 *
 * Applied from ZamApplication.onCreate, so every process start (the app, a
 * push, a quick reply) has it before its first request. Nothing is touched
 * in "system" mode, so the default costs nothing.
 */
final class ZamProxy {

    private static final String TAG = "ZamProxy";
    private static final String PREFS = "zam_proxy";

    static final String ANY_IPV4 = "0.0.0.0/0";
    static final String ANY_IPV6 = "::/0";

    static final class Prefs {
        final String mode;
        final String rules;
        final String bypass;
        final String calls;

        Prefs(String mode, String rules, String bypass, String calls) {
            this.mode = "direct".equals(mode) || "manual".equals(mode) ? mode : "system";
            this.rules = clean(rules, 1000);
            this.bypass = clean(bypass, 4000);
            this.calls = "direct".equals(calls) ? "direct" : "default";
        }

        private static String clean(String v, int max) {
            if (v == null) return "";
            String s = v.replaceAll("[\\r\\n]", " ").trim();
            return s.length() > max ? s.substring(0, max) : s;
        }
    }

    private static volatile Prefs prefs = new Prefs("system", "", "", "default");
    private static volatile Context app;
    /** Call server hosts sent direct while calls = "direct"; grows over the run. */
    private static final Set<String> directHosts = new LinkedHashSet<>();
    private static volatile boolean overrideActive = false;
    private static volatile String lastError = null;

    private ZamProxy() {}

    static boolean supported() {
        return WebViewFeature.isFeatureSupported(WebViewFeature.PROXY_OVERRIDE);
    }

    /** Load the saved prefs and apply them to this process's WebViews. */
    static void init(Context ctx) {
        app = ctx.getApplicationContext();
        SharedPreferences sp = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        prefs = new Prefs(
                sp.getString("mode", "system"),
                sp.getString("rules", ""),
                sp.getString("bypass", ""),
                sp.getString("calls", "default"));
        if (!"system".equals(prefs.mode)) {
            String err = applyToWebView(prefs);
            if (err != null) Log.w(TAG, "Saved proxy settings don't apply: " + err);
        }
    }

    static Prefs prefs() {
        return prefs;
    }

    static String lastError() {
        return lastError;
    }

    static List<String> directHosts() {
        synchronized (directHosts) {
            return new ArrayList<>(directHosts);
        }
    }

    /**
     * Apply `next`; persist it only if the WebView accepted it, so a typo
     * never leaves a saved setting that silently falls back to no proxy at
     * the next launch. Returns the error, or null.
     */
    static String set(Prefs next) {
        String err = applyToWebView(next);
        if (err != null) {
            // Keep (and re-apply) what was in force before.
            applyToWebView(prefs);
            lastError = err;
            return err;
        }
        prefs = next;
        lastError = null;
        if (app != null) {
            app.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                    .putString("mode", next.mode)
                    .putString("rules", next.rules)
                    .putString("bypass", next.bypass)
                    .putString("calls", next.calls)
                    .apply();
        }
        return null;
    }

    /** Host names of call servers about to be used, to send direct. */
    static void addCallTargets(List<String> hosts) {
        if (!"direct".equals(prefs.calls)) return;
        boolean changed = false;
        synchronized (directHosts) {
            for (String raw : hosts) {
                if (raw == null || directHosts.size() >= 64) continue;
                String host = raw.trim().toLowerCase(Locale.ROOT);
                if (host.length() > 255 || !host.matches("[a-z0-9.-]+")) continue;
                if (isIpLiteral(host)) continue;
                changed |= directHosts.add(host);
            }
        }
        if (changed) {
            String err = applyToWebView(prefs);
            if (err != null) lastError = err;
        }
    }

    // --- WebView ---------------------------------------------------------

    /** Runs on the main thread and waits for the override to be in place. */
    private static String applyToWebView(Prefs p) {
        if (!supported()) {
            return "system".equals(p.mode) ? null : "WebView can't override the proxy";
        }
        final String[] err = {null};
        final CountDownLatch done = new CountDownLatch(1);
        Runnable work = () -> {
            try {
                ProxyController pc = ProxyController.getInstance();
                Runnable listener = done::countDown;
                if ("system".equals(p.mode)) {
                    if (overrideActive) {
                        pc.clearProxyOverride(Runnable::run, listener);
                        overrideActive = false;
                    } else {
                        done.countDown();
                    }
                    return;
                }
                ProxyConfig config = buildConfig(p);
                pc.setProxyOverride(config, Runnable::run, listener);
                overrideActive = true;
            } catch (IllegalArgumentException e) {
                err[0] = e.getMessage() != null ? e.getMessage() : "Invalid proxy rules";
                done.countDown();
            } catch (RuntimeException e) {
                err[0] = String.valueOf(e.getMessage());
                done.countDown();
            }
        };
        if (Looper.myLooper() == Looper.getMainLooper()) {
            // Can't wait on the main thread for a listener it delivers;
            // the override is posted ahead of any request made after this.
            work.run();
            return err[0];
        }
        new Handler(Looper.getMainLooper()).post(work);
        try {
            done.await(5, java.util.concurrent.TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        return err[0];
    }

    private static ProxyConfig buildConfig(Prefs p) {
        ProxyConfig.Builder b = new ProxyConfig.Builder();
        if ("direct".equals(p.mode) || p.rules.isEmpty()) {
            return b.addDirect().build();
        }
        for (Rule r : parseRules(p.rules)) {
            if (r.direct) b.addDirect(r.filter);
            else b.addProxyRule(r.url, r.filter);
        }
        for (String entry : bypassList(p)) b.addBypassRule(entry);
        return b.build();
    }

    // --- Rules -----------------------------------------------------------

    static final class Rule {
        /** ProxyConfig.MATCH_* */
        final String filter;
        final String url;
        final boolean direct;

        Rule(String filter, String url) {
            this.filter = filter;
            this.url = url;
            this.direct = url.toLowerCase(Locale.ROOT).startsWith("direct://");
        }
    }

    /**
     * Chromium rule syntax, as on desktop: "socks5://h:p", "h:p, h2:p"
     * (fallbacks), or "http=h:p;https=h2:p" per URL scheme.
     */
    static List<Rule> parseRules(String rules) {
        List<Rule> out = new ArrayList<>();
        for (String part : rules.split(";")) {
            part = part.trim();
            if (part.isEmpty()) continue;
            String filter = ProxyConfig.MATCH_ALL_SCHEMES;
            Matcher m = Pattern.compile("^([a-zA-Z]+)\\s*=\\s*(.*)$").matcher(part);
            if (m.matches()) {
                String scheme = m.group(1).toLowerCase(Locale.ROOT);
                if ("http".equals(scheme)) filter = ProxyConfig.MATCH_HTTP;
                else if ("https".equals(scheme)) filter = ProxyConfig.MATCH_HTTPS;
                else throw new IllegalArgumentException("Unsupported rule scheme: " + scheme);
                part = m.group(2);
            }
            for (String url : part.split("[,\\s]+")) {
                if (!url.isEmpty()) out.add(new Rule(filter, url));
            }
        }
        if (out.isEmpty()) throw new IllegalArgumentException("No proxy server given");
        return out;
    }

    private static List<String> bypassList(Prefs p) {
        List<String> out = new ArrayList<>();
        for (String s : p.bypass.split("[,;\\s]+")) {
            if (!s.isEmpty()) out.add(s);
        }
        if ("direct".equals(p.calls)) {
            // Every IP literal (ICE candidates, TURN), plus named call hosts.
            out.add(ANY_IPV4);
            out.add(ANY_IPV6);
            out.addAll(directHosts());
        }
        return out;
    }

    // --- Native requests ---------------------------------------------------

    /**
     * Open `url` the way the setting says. "system" is Android's default;
     * "manual" picks the first rule for the URL's scheme. Fails closed when
     * a rule can't be used from Java (an HTTPS or SOCKS4 proxy), so a
     * background request never quietly skips the proxy.
     */
    static HttpURLConnection open(URL url) throws IOException {
        if ("system".equals(prefs.mode)) return (HttpURLConnection) url.openConnection();
        return (HttpURLConnection) url.openConnection(proxyFor(url));
    }

    /** The proxy for `url` in "direct" / "manual" mode. */
    static Proxy proxyFor(URL url) throws IOException {
        Prefs p = prefs;
        if ("direct".equals(p.mode) || p.rules.isEmpty()) return Proxy.NO_PROXY;
        String host = url.getHost().toLowerCase(Locale.ROOT).replaceAll("^\\[|\\]$", "");
        if (bypassed(host, p.bypass)) return Proxy.NO_PROXY;
        String scheme = url.getProtocol().toLowerCase(Locale.ROOT);
        List<Rule> rules;
        try {
            rules = parseRules(p.rules);
        } catch (IllegalArgumentException e) {
            throw new IOException("Proxy rules: " + e.getMessage());
        }
        for (Rule r : rules) {
            boolean applies = ProxyConfig.MATCH_ALL_SCHEMES.equals(r.filter)
                    || (ProxyConfig.MATCH_HTTP.equals(r.filter) && "http".equals(scheme))
                    || (ProxyConfig.MATCH_HTTPS.equals(r.filter) && "https".equals(scheme));
            if (!applies) continue;
            if (r.direct) return Proxy.NO_PROXY;
            return toJavaProxy(r.url);
        }
        // No rule for this scheme: Chromium sends it direct too.
        return Proxy.NO_PROXY;
    }

    private static Proxy toJavaProxy(String rule) throws IOException {
        String scheme = "http";
        String rest = rule;
        int i = rule.indexOf("://");
        if (i >= 0) {
            scheme = rule.substring(0, i).toLowerCase(Locale.ROOT);
            rest = rule.substring(i + 3);
        }
        rest = rest.replaceAll("/.*$", "");
        Proxy.Type type;
        int port;
        if ("http".equals(scheme)) {
            type = Proxy.Type.HTTP;
            port = 80;
        } else if ("socks5".equals(scheme) || "socks".equals(scheme)) {
            type = Proxy.Type.SOCKS;
            port = 1080;
        } else {
            throw new IOException("Background requests can't use a " + scheme + " proxy");
        }
        String h = rest;
        Matcher m6 = Pattern.compile("^\\[([^\\]]+)\\](?::(\\d+))?$").matcher(rest);
        Matcher m = Pattern.compile("^([^:]+)(?::(\\d+))?$").matcher(rest);
        if (m6.matches()) {
            h = m6.group(1);
            if (m6.group(2) != null) port = Integer.parseInt(m6.group(2));
        } else if (m.matches()) {
            h = m.group(1);
            if (m.group(2) != null) port = Integer.parseInt(m.group(2));
        } else {
            throw new IOException("Bad proxy address: " + rule);
        }
        // Unresolved, so a SOCKS proxy resolves the target itself.
        return new Proxy(type, InetSocketAddress.createUnresolved(h, port));
    }

    /** A subset of Chromium's bypass syntax: hosts, "*" globs, ".suffix",
     *  "<local>", IP literals and CIDR ranges. */
    static boolean bypassed(String host, String bypass) {
        for (String raw : bypass.split("[,;\\s]+")) {
            String e = raw.trim().toLowerCase(Locale.ROOT);
            if (e.isEmpty()) continue;
            e = e.replaceFirst("^[a-z]+://", "");
            if ("<local>".equals(e)) {
                if (!host.contains(".") && !host.contains(":")) return true;
                continue;
            }
            if (e.contains("/")) {
                if (isIpLiteral(host) && inCidr(host, e)) return true;
                continue;
            }
            // Drop a port (not from a bare IPv6 literal).
            if (e.startsWith("[")) e = e.replaceAll("^\\[|\\](:\\d+)?$", "");
            else if (e.indexOf(':') == e.lastIndexOf(':')) e = e.replaceAll(":\\d+$", "");
            if (e.startsWith(".")) {
                if (host.endsWith(e)) return true;
            } else if (e.contains("*")) {
                String re = Pattern.quote(e).replace("*", "\\E.*\\Q");
                if (host.matches(re)) return true;
            } else if (host.equals(e)) {
                return true;
            }
        }
        return false;
    }

    static boolean isIpLiteral(String host) {
        return host.matches("\\d+\\.\\d+\\.\\d+\\.\\d+") || host.contains(":");
    }

    private static boolean inCidr(String host, String cidr) {
        try {
            int slash = cidr.indexOf('/');
            String base = cidr.substring(0, slash);
            int bits = Integer.parseInt(cidr.substring(slash + 1));
            if (!isIpLiteral(base)) return false;
            // Literals only, so no DNS lookups happen here.
            byte[] a = InetAddress.getByName(host).getAddress();
            byte[] b = InetAddress.getByName(base).getAddress();
            if (a.length != b.length || bits < 0 || bits > a.length * 8) return false;
            for (int i = 0; i < bits; i++) {
                int mask = 0x80 >> (i % 8);
                if ((a[i / 8] & mask) != (b[i / 8] & mask)) return false;
            }
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
