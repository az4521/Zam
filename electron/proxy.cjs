// Settings > General > Network: Zam's own proxy setting, and how calls treat
// a proxy.
//
// Proxy modes:
//  - "system": whatever Chromium would use anyway, i.e. the OS settings, or
//    the --proxy-server / --proxy-bypass-list / --proxy-pac-url flags Zam was
//    launched with.
//  - "direct": no proxy.
//  - "manual": proxy rules ("socks5://127.0.0.1:9050") plus a bypass list.
//  - "pac": a proxy auto-config URL.
//
// Call routing (`calls`):
//  - "default": Chromium's own behaviour. WebRTC sends UDP directly (there is
//    no UDP through an HTTP or SOCKS proxy) and TCP through the proxy, so a
//    call that falls back to TCP rides the proxy.
//  - "direct": the whole call skips the proxy: the call token service, the
//    SFU's signalling WebSocket, and media over UDP and TCP alike.
//     - Media: WebRTC connects to ICE candidates and TURN servers, which are
//       always IP addresses, and Chromium matches proxy rules against what a
//       connection names. So every IP literal goes direct ("0.0.0.0/0" and
//       "::/0" in the bypass list, or the PAC equivalent). That covers
//       addresses the SFU advertises that its hostname doesn't resolve to,
//       from the first connect. Ordinary requests name hosts, so they stay
//       on the proxy.
//     - Token service and signalling: the page names their hosts before
//       connecting, and those names go direct too. It never names the
//       homeserver's own host, so a call server sharing it keeps the
//       homeserver on the proxy (that call's signalling stays proxied).
//    Tested in Electron 44 against HTTP and SOCKS5 proxies (2026-10-26):
//    with these rules a passive TCP ICE candidate and hosts named in the
//    list connect direct, other names still go through the proxy.
//  - "proxy": calls only go through the proxy: WebRTC's IP handling policy
//    "disable_non_proxied_udp", so the call servers never see this device's
//    address. Tested: Chromium then gathers no host candidates at all and
//    only reaches a TURN server over TCP/TLS through the proxy, so this needs
//    the SFU to offer TURN.
//
// Prefs live in userData/proxy-prefs.json and apply to the default session
// at startup, before the window loads, and again on every change.
const fs = require("fs");
const path = require("path");
const net = require("net");

/** Bypass entries meaning "every IPv4 / IPv6 literal" (call media). */
const ANY_IPV4 = "0.0.0.0/0";
const ANY_IPV6 = "::/0";

const MODES = new Set(["system", "direct", "manual", "pac"]);
const CALL_MODES = new Set(["default", "direct", "proxy"]);

const DEFAULTS = {
    mode: "system",
    rules: "",
    bypass: "",
    pacUrl: "",
    calls: "default",
};

/** Normalise untrusted prefs (from disk or the renderer). */
function sanitizePrefs(raw) {
    const p = raw && typeof raw === "object" ? raw : {};
    const text = (v, max) =>
        typeof v === "string"
            ? v
                  .replace(/[\r\n]/g, " ")
                  .trim()
                  .slice(0, max)
            : "";
    return {
        mode: MODES.has(p.mode) ? p.mode : DEFAULTS.mode,
        rules: text(p.rules, 1000),
        bypass: text(p.bypass, 4000),
        pacUrl: text(p.pacUrl, 2000),
        calls: CALL_MODES.has(p.calls) ? p.calls : DEFAULTS.calls,
    };
}

/** Bypass-rule form of an address: IPv6 needs a CIDR (a bare literal would
 *  be read as host:port). */
function bypassEntry(addr) {
    return net.isIPv6(addr) ? `${addr}/128` : addr;
}

/** The proxy the launch flags ask for, if any. */
function flagProxy(commandLine) {
    const server = commandLine.getSwitchValue("proxy-server");
    const pac = commandLine.getSwitchValue("proxy-pac-url");
    if (commandLine.hasSwitch("no-proxy-server")) return { mode: "direct" };
    if (server)
        return {
            mode: "manual",
            rules: server,
            bypass: commandLine.getSwitchValue("proxy-bypass-list"),
        };
    if (pac) return { mode: "pac", pacUrl: pac };
    return null;
}

/**
 * A PAC script that answers DIRECT for `direct` hosts (and, when the list
 * holds ANY_IPV4 / ANY_IPV6, for every IP literal of that family) and asks
 * the user's PAC for everything else. The original runs in its own
 * function scope so that our FindProxyForURL (hoisted at top level)
 * doesn't replace the one we call into.
 */
function wrapPac(original, direct) {
    const hosts = direct.filter((d) => d !== ANY_IPV4 && d !== ANY_IPV6);
    return [
        "var __zamDirect = " + JSON.stringify(hosts) + ";",
        "var __zamAnyV4 = " + JSON.stringify(direct.includes(ANY_IPV4)) + ";",
        "var __zamAnyV6 = " + JSON.stringify(direct.includes(ANY_IPV6)) + ";",
        "var __zamOriginal = (function () {",
        original,
        "\nreturn FindProxyForURL;",
        "})();",
        "function FindProxyForURL(url, host) {",
        '    var h = host.replace(/^\\[|\\]$/g, "").toLowerCase();',
        '    if (__zamDirect.indexOf(h) >= 0) return "DIRECT";',
        '    if (__zamAnyV4 && /^\\d+\\.\\d+\\.\\d+\\.\\d+$/.test(h)) return "DIRECT";',
        '    if (__zamAnyV6 && h.indexOf(":") >= 0) return "DIRECT";',
        "    return __zamOriginal(url, host);",
        "}",
    ].join("\n");
}

function dataPacUrl(script) {
    return (
        "data:application/x-ns-proxy-autoconfig;base64," +
        Buffer.from(script, "utf8").toString("base64")
    );
}

/**
 * Electron proxy config for `prefs` plus extra direct addresses. `loadPac`
 * fetches a PAC script's text (only needed to wrap one). Returns null for
 * "leave Chromium alone" (system mode, no flags, nothing to bypass).
 */
async function buildProxyConfig(prefs, extraDirect, commandLine, loadPac) {
    let p = prefs;
    if (p.mode === "system") {
        const flags = flagProxy(commandLine);
        // The OS proxy can't take extra bypass rules (Electron only has
        // them for fixed servers); info() reports that case.
        if (!flags) return null;
        p = { ...p, ...flags };
    }
    if (p.mode === "direct") return { mode: "direct" };
    if (p.mode === "manual") {
        if (!p.rules) return { mode: "direct" };
        const bypass = [
            ...(p.bypass || "")
                .split(/[,;\s]+/)
                .map((s) => s.trim())
                .filter(Boolean),
            ...extraDirect.map(bypassEntry),
        ];
        return {
            mode: "fixed_servers",
            proxyRules: p.rules,
            proxyBypassRules: bypass.join(","),
        };
    }
    // pac
    if (!p.pacUrl) return { mode: "direct" };
    if (!extraDirect.length) return { mode: "pac_script", pacScript: p.pacUrl };
    const original = await loadPac(p.pacUrl);
    return {
        mode: "pac_script",
        pacScript: dataPacUrl(wrapPac(original, extraDirect)),
    };
}

function createProxyManager({ app, session, getWindow, net: electronNet }) {
    const prefsPath = () =>
        path.join(app.getPath("userData"), "proxy-prefs.json");
    let prefs = DEFAULTS;
    try {
        prefs = sanitizePrefs(JSON.parse(fs.readFileSync(prefsPath(), "utf8")));
    } catch {
        /* none saved yet */
    }
    // Call server hosts (token service, SFU) to send direct when calls =
    // "direct"; grows over the app's run.
    const directHosts = new Set();
    let lastApplied = null;
    let lastError = null;

    async function loadPac(url) {
        if (url.startsWith("file:")) {
            return fs.promises.readFile(new URL(url), "utf8");
        }
        const res = await electronNet.fetch(url);
        if (!res.ok) throw new Error(`PAC fetch failed: HTTP ${res.status}`);
        return res.text();
    }

    function applyIpPolicy() {
        const win = getWindow();
        if (!win || win.isDestroyed()) return;
        win.webContents.setWebRTCIPHandlingPolicy(
            prefs.calls === "proxy" ? "disable_non_proxied_udp" : "default",
        );
    }

    async function apply() {
        const extra =
            prefs.calls === "direct"
                ? [ANY_IPV4, ANY_IPV6, ...directHosts]
                : [];
        let config;
        try {
            config = await buildProxyConfig(
                prefs,
                extra,
                app.commandLine,
                loadPac,
            );
        } catch (err) {
            lastError = String(err?.message || err);
            console.error("Proxy config failed:", err);
            return;
        }
        const key = JSON.stringify(config);
        if (key === lastApplied) return;
        // "Leave Chromium alone" after something else was applied: hand back
        // to the OS settings.
        const effective = config ?? (lastApplied ? { mode: "system" } : null);
        lastApplied = key;
        lastError = null;
        if (!effective) return;
        try {
            // Not followed by closeAllConnections: this also runs mid-call,
            // and that would cut the SFU's signalling socket. New
            // connections use the new rules, which is what matters.
            await session.defaultSession.setProxy(effective);
        } catch (err) {
            lastError = String(err?.message || err);
            console.error("setProxy failed:", err);
        }
    }

    /**
     * Host names of call servers (token service, SFU) about to be used, to
     * send direct. IP literals need no entry: they all go direct already.
     * The page leaves out the homeserver's host.
     */
    async function addCallTargets(hosts) {
        if (prefs.calls !== "direct" || !Array.isArray(hosts)) return;
        const before = directHosts.size;
        for (const raw of hosts.slice(0, 64)) {
            if (typeof raw !== "string") continue;
            const host = raw.trim().toLowerCase().slice(0, 255);
            if (!host || net.isIP(host.replace(/^\[|\]$/g, ""))) continue;
            if (!/^[a-z0-9.-]+$/.test(host)) continue;
            directHosts.add(host);
        }
        if (directHosts.size !== before) await apply();
    }

    /** How a request to `url` is routed right now ("DIRECT", "PROXY h:p"…). */
    async function route(url) {
        if (typeof url !== "string" || !/^(https?|wss?):\/\//.test(url))
            return null;
        try {
            return await session.defaultSession.resolveProxy(
                url.replace(/^ws/, "http"),
            );
        } catch {
            return null;
        }
    }

    function info() {
        const flags = flagProxy(app.commandLine);
        return {
            ...prefs,
            launchFlags: flags
                ? [
                      [
                          "proxy-server",
                          app.commandLine.getSwitchValue("proxy-server"),
                      ],
                      [
                          "proxy-bypass-list",
                          app.commandLine.getSwitchValue("proxy-bypass-list"),
                      ],
                      [
                          "proxy-pac-url",
                          app.commandLine.getSwitchValue("proxy-pac-url"),
                      ],
                  ]
                      .filter(([, v]) => v)
                      .map(([k, v]) => `--${k}=${v}`)
                      .concat(
                          app.commandLine.hasSwitch("no-proxy-server")
                              ? ["--no-proxy-server"]
                              : [],
                      )
                : [],
            callBypassAddresses: [...directHosts],
            // Calls can't bypass the OS proxy settings, only Zam's own or
            // the launch flags'.
            callBypassAvailable: !(prefs.mode === "system" && !flags),
            error: lastError,
        };
    }

    async function set(next) {
        prefs = sanitizePrefs(next);
        try {
            fs.writeFileSync(prefsPath(), JSON.stringify(prefs));
        } catch (err) {
            console.error("Couldn't save proxy prefs:", err);
        }
        applyIpPolicy();
        await apply();
        return info();
    }

    return { apply, applyIpPolicy, addCallTargets, route, info, set };
}

module.exports = {
    createProxyManager,
    buildProxyConfig,
    sanitizePrefs,
    wrapPac,
    flagProxy,
};
