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
//  - "direct": call servers bypass the proxy for TCP too. Before each SFU
//    connect the page names the SFU's host; it is resolved here and its
//    addresses (not the name) added to the bypass rules, along with the ICE
//    candidate and TURN addresses the page reports once connected. Only
//    media is exempt: the signalling WebSocket and every other request name
//    hosts, so they stay on the proxy. They have to be IPs:
//    WebRTC connects to the SFU's ICE candidates, which are addresses, and
//    Chromium matches proxy rules against what it connects to (tested: an IP
//    or CIDR in the bypass list, or a PAC returning DIRECT for it, sends
//    WebRTC's TCP direct). Resolving the host means a DNS lookup outside the
//    proxy, which is fine for a mode whose point is to go direct.
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
const dns = require("dns").promises;
const net = require("net");

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
 * A PAC script that answers DIRECT for `direct` hosts and asks the user's
 * PAC for everything else. The original runs in its own function scope so
 * that our FindProxyForURL (hoisted at top level) doesn't replace the one
 * we call into.
 */
function wrapPac(original, direct) {
    return [
        "var __zamDirect = " + JSON.stringify(direct) + ";",
        "var __zamOriginal = (function () {",
        original,
        "\nreturn FindProxyForURL;",
        "})();",
        "function FindProxyForURL(url, host) {",
        '    var h = host.replace(/^\\[|\\]$/g, "");',
        '    if (__zamDirect.indexOf(h) >= 0) return "DIRECT";',
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
    // Call server addresses to send direct (calls = "direct"); grows over
    // the app's run, since an SFU's addresses don't stop being its own.
    const direct = new Set();
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
        const extra = prefs.calls === "direct" ? [...direct] : [];
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

    /** Hosts (names or addresses) of call servers about to be used. */
    async function addCallTargets(hosts) {
        if (prefs.calls !== "direct" || !Array.isArray(hosts)) return;
        const before = direct.size;
        for (const raw of hosts.slice(0, 64)) {
            if (typeof raw !== "string") continue;
            const host = raw
                .replace(/^\[|\]$/g, "")
                .trim()
                .slice(0, 255);
            if (!host) continue;
            if (net.isIP(host)) {
                direct.add(host);
                continue;
            }
            if (!/^[a-z0-9.-]+$/i.test(host)) continue;
            // Addresses only, never the name: Chromium matches bypass rules
            // against the host a connection names, and WebRTC names IPs
            // while everything else names hosts. So this exempts call media
            // and nothing else, even when the SFU shares a hostname with the
            // homeserver (whose traffic must stay on the proxy). Signalling
            // stays on the proxy too.
            try {
                for (const { address } of await dns.lookup(host, { all: true }))
                    direct.add(address);
            } catch (err) {
                console.warn("Couldn't resolve call server", host, err.code);
            }
        }
        if (direct.size !== before) await apply();
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
            callBypassAddresses: [...direct],
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

    return { apply, applyIpPolicy, addCallTargets, info, set };
}

module.exports = {
    createProxyManager,
    buildProxyConfig,
    sanitizePrefs,
    wrapPac,
    flagProxy,
};
