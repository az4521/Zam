// zam.frames (src/lib/plugins/pluginFrames.ts): plugins' rules for the pages
// embedded in Zam's window, e.g. a YouTube player. The page hands main a rule
// (URL prefixes, plus a script and/or a referrer). When an iframe in the
// window loads a URL a rule matches, main sends the rule's referrer as that
// request's Referer, and once the frame's DOM is ready runs the rule's script
// in it, in that frame's own page, which the renderer can't reach across
// origins. Rules live only as long as the page that made them: a reload
// clears them and the plugins register theirs again as they load.

const ID = /^[A-Za-z0-9._:-]{1,200}$/;
// At least a whole origin ("https://host/"), so a rule can't match every
// page, or one host by a shorter look-alike.
const ORIGIN_URL = /^https?:\/\/[^/?#\s]+\/\S*$/;
const MAX_RULES = 256;
const MAX_PREFIXES = 32;
const MAX_SCRIPT_BYTES = 1024 * 1024;

/** A rule from the page, or null if it is malformed. */
function parseRule(raw) {
    if (!raw || typeof raw !== "object") return null;
    const { id, urlPrefixes, script, referrer } = raw;
    if (typeof id !== "string" || !ID.test(id)) return null;
    if (script === undefined && referrer === undefined) return null;
    if (
        script !== undefined &&
        (typeof script !== "string" || script.length > MAX_SCRIPT_BYTES)
    )
        return null;
    if (
        referrer !== undefined &&
        (typeof referrer !== "string" ||
            referrer.length > 2048 ||
            !ORIGIN_URL.test(referrer))
    )
        return null;
    if (
        !Array.isArray(urlPrefixes) ||
        urlPrefixes.length === 0 ||
        urlPrefixes.length > MAX_PREFIXES
    )
        return null;
    for (const p of urlPrefixes) {
        if (typeof p !== "string" || !ORIGIN_URL.test(p)) return null;
    }
    const rule = { id, urlPrefixes: [...urlPrefixes] };
    if (script !== undefined) rule.script = script;
    if (referrer !== undefined) rule.referrer = referrer;
    return rule;
}

function matches(rule, url) {
    return (
        typeof url === "string" &&
        rule.urlPrefixes.some((p) => url.startsWith(p))
    );
}

/** The scripts of the rules matching `url`, in the order they were added. */
function scriptsFor(rules, url) {
    const out = [];
    for (const r of rules.values()) {
        if (r.script !== undefined && matches(r, url)) out.push(r.script);
    }
    return out;
}

/** The Referer to send for a frame loading `url`: the first matching rule's
 *  (rules added earlier win), or null to leave the request alone. */
function referrerFor(rules, url) {
    for (const r of rules.values()) {
        if (r.referrer !== undefined && matches(r, url)) return r.referrer;
    }
    return null;
}

function registerPluginFrames(app, ipcMain, getWindow) {
    const rules = new Map(); // id -> { id, urlPrefixes, script?, referrer? }
    const fromWindow = (event) => {
        const win = getWindow();
        return !!win && event.sender === win.webContents;
    };

    ipcMain.handle("plugin-frames:add", (event, raw) => {
        if (!fromWindow(event)) return false;
        const rule = parseRule(raw);
        if (!rule) return false;
        if (!rules.has(rule.id) && rules.size >= MAX_RULES) return false;
        rules.set(rule.id, rule);
        return true;
    });
    ipcMain.handle("plugin-frames:remove", (event, id) => {
        if (!fromWindow(event) || typeof id !== "string") return;
        rules.delete(id);
    });

    // A session takes one onBeforeSendHeaders listener; nothing else in Zam
    // sets one. Only the window's own iframes' page loads are touched, never
    // anything else the session fetches.
    app.whenReady().then(() => {
        const { session } = require("electron");
        session.defaultSession.webRequest.onBeforeSendHeaders(
            { urls: ["http://*/*", "https://*/*"] },
            (details, callback) => {
                const win = getWindow();
                const referrer =
                    details.resourceType === "subFrame" &&
                    !!win &&
                    details.webContentsId === win.webContents.id
                        ? referrerFor(rules, details.url)
                        : null;
                if (referrer === null) return callback({});
                const requestHeaders = {};
                for (const [k, v] of Object.entries(details.requestHeaders)) {
                    if (k.toLowerCase() !== "referer") requestHeaders[k] = v;
                }
                requestHeaders.Referer = referrer;
                callback({ requestHeaders });
            },
        );
    });

    app.on("browser-window-created", (_e, win) => {
        const wc = win.webContents;
        // A fresh page is a fresh set of plugins.
        wc.on("did-start-navigation", (details) => {
            if (details.isMainFrame && !details.isSameDocument) rules.clear();
        });
        wc.on("frame-created", (_e2, { frame }) => {
            if (!frame || !frame.parent) return; // the app's own page
            // Every load of the frame, so a reload or a navigation inside it
            // gets the scripts its new URL matches.
            frame.on("dom-ready", () => {
                if (frame.isDestroyed()) return;
                for (const script of scriptsFor(rules, frame.url)) {
                    frame.executeJavaScript(script).catch((err) => {
                        console.error("[plugin-frames] script failed:", err);
                    });
                }
            });
        });
    });
}

module.exports = { registerPluginFrames, parseRule, scriptsFor, referrerFor };
