// Voice keybinds on Wayland, where no app may see another app's input: the
// xdg-desktop-portal GlobalShortcuts portal asks the compositor (KDE, GNOME
// 48+, Hyprland...) to bind shortcuts for us and tells us when each one goes
// down (Activated) and up (Deactivated), which is all push to talk needs.
// The compositor owns the keys: it may show its own dialog and assign other
// triggers than the ones we ask for, so Settings shows what it reports.
//
// Plain Node over a pure-JS D-Bus client (no native module, so nothing to
// rebuild for Electron or the Flatpak). Used by globalHotkeys.cjs.
//
// Spec: flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.GlobalShortcuts.html

const net = require("net");
const crypto = require("crypto");

const PORTAL = "org.freedesktop.portal.Desktop";
const PORTAL_PATH = "/org/freedesktop/portal/desktop";
const IFACE = "org.freedesktop.portal.GlobalShortcuts";
const SIGNAL = 4; // D-Bus message type
const CALL_TIMEOUT_MS = 10000;
// BindShortcuts may wait on a dialog the user has to answer.
const DIALOG_TIMEOUT_MS = 5 * 60 * 1000;

/** A stream to the session bus. dbus-native's own parser can't reach
 *  abstract sockets without a native module; Node can on Linux. */
function connectStream(address) {
    let lastErr = new Error("no session bus address");
    for (const addr of (address || "").split(";")) {
        const colon = addr.indexOf(":");
        if (colon === -1) continue;
        const family = addr.slice(0, colon);
        const params = Object.fromEntries(
            addr
                .slice(colon + 1)
                .split(",")
                .map((kv) => {
                    const eq = kv.indexOf("=");
                    return [
                        kv.slice(0, eq),
                        decodeURIComponent(kv.slice(eq + 1)),
                    ];
                }),
        );
        try {
            if (family === "unix" && params.path)
                return net.createConnection(params.path);
            if (family === "unix" && params.abstract)
                return net.createConnection(`\0${params.abstract}`);
            if (family === "tcp" && params.port)
                return net.createConnection(
                    Number(params.port),
                    params.host || "localhost",
                );
        } catch (err) {
            lastErr = err;
        }
    }
    throw lastErr;
}

/** a{sv} for dbus-native: [[key, [signature, value]], ...]. */
function vardict(obj) {
    return Object.entries(obj).map(([k, [sig, v]]) => [k, [sig, v]]);
}

/** Read an a{sv} dbus-native unmarshalled: variants come back as
 *  [signatureTree, [value]]. */
function readVardict(entries) {
    const out = {};
    for (const [k, v] of entries || []) out[k] = Array.isArray(v) ? v[1][0] : v;
    return out;
}

const token = () => `zam_${crypto.randomBytes(6).toString("hex")}`;

/**
 * @param {object} opts
 * @param {string} [opts.busAddress] defaults to DBUS_SESSION_BUS_ADDRESS
 * @param {string} [opts.appId] host apps register this first (portal 1.19+)
 * @param {string[]} [opts.authMethods] tests only
 * @param {(id: string, down: boolean) => void} opts.onAction
 * @param {(shortcuts: {id: string, trigger: string}[]) => void} [opts.onChanged]
 *        the user changed the triggers in the desktop's settings
 * @param {(err: Error) => void} [opts.onError] the bus went away
 */
function createPortalShortcuts(opts) {
    const dbus = require("@homebridge/dbus-native");
    let bus = null;
    let ready = null;
    let sender = "";
    let session = null;
    let closed = false;
    /** Request path -> resolve(Response). */
    const pending = new Map();
    /** Everything waiting on the bus, failed at once if it goes away (a
     *  connection that dies before Hello would otherwise never answer). */
    const inFlight = new Set();
    let lost = null;

    function track(what, timeoutMs, start) {
        return new Promise((resolve, reject) => {
            if (lost) return reject(lost);
            const finish = (fn) => (value) => {
                clearTimeout(timer);
                inFlight.delete(abort);
                fn(value);
            };
            const abort = finish(reject);
            const timer = setTimeout(
                () => abort(new Error(`${what} timed out`)),
                timeoutMs,
            );
            inFlight.add(abort);
            start(finish(resolve), abort);
        });
    }

    function fail(err) {
        if (lost) return;
        lost = err instanceof Error ? err : new Error(String(err));
        for (const abort of [...inFlight]) abort(lost);
        if (!closed) opts.onError?.(lost);
        closed = true;
    }

    const replyError = (err) =>
        new Error(`${err.name || "Error"}: ${err.message || ""}`);

    function call(member, signature, body, iface = IFACE) {
        return track(member, CALL_TIMEOUT_MS, (resolve, reject) =>
            bus.invoke(
                {
                    destination: PORTAL,
                    path: PORTAL_PATH,
                    interface: iface,
                    member,
                    signature,
                    body,
                },
                (err, ...res) => (err ? reject(replyError(err)) : resolve(res)),
            ),
        );
    }

    function dbusCall(member, signature, body) {
        return track(member, CALL_TIMEOUT_MS, (resolve, reject) =>
            bus.invokeDbus({ member, signature, body }, (err, ...res) =>
                err ? reject(replyError(err)) : resolve(res),
            ),
        );
    }

    function onMessage(msg) {
        if (msg.type !== SIGNAL) return;
        if (
            msg.interface === "org.freedesktop.portal.Request" &&
            msg.member === "Response"
        ) {
            const done = pending.get(msg.path);
            if (!done) return;
            pending.delete(msg.path);
            const [code, results] = msg.body;
            done({ code, results: readVardict(results) });
            return;
        }
        if (msg.interface !== IFACE || msg.path !== PORTAL_PATH) return;
        const [sessionHandle] = msg.body;
        if (!session || sessionHandle !== session) return;
        if (msg.member === "Activated" || msg.member === "Deactivated")
            opts.onAction(msg.body[1], msg.member === "Activated");
        else if (msg.member === "ShortcutsChanged")
            opts.onChanged?.(readShortcuts(msg.body[1]));
    }

    function readShortcuts(list) {
        return (list || []).map(([id, props]) => ({
            id,
            trigger: String(readVardict(props).trigger_description || ""),
        }));
    }

    /** Call a method that answers through a Request object. */
    async function request(member, signature, body, timeoutMs) {
        const handleToken = token();
        // Listen before calling: the Response can beat the method's reply.
        const path = `${PORTAL_PATH}/request/${sender}/${handleToken}`;
        let handle = path;
        const response = track(`${member} response`, timeoutMs, (resolve) =>
            pending.set(path, resolve),
        );
        // The options vardict is always the last argument.
        const last = body[body.length - 1];
        last.push(["handle_token", ["s", handleToken]]);
        let res;
        try {
            [handle] = await call(member, signature, body);
            if (handle !== path) {
                // Older portals pick their own path; follow it.
                pending.set(handle, pending.get(path));
                pending.delete(path);
            }
            res = await response;
        } finally {
            pending.delete(path);
            pending.delete(handle);
        }
        if (res.code !== 0)
            throw new Error(
                res.code === 1 ? `${member}: cancelled` : `${member}: failed`,
            );
        return res.results;
    }

    function connect() {
        if (ready) return ready;
        ready = (async () => {
            const stream = connectStream(
                opts.busAddress || process.env.DBUS_SESSION_BUS_ADDRESS,
            );
            bus = dbus.createClient({
                stream,
                direct: true,
                ...(opts.authMethods ? { authMethods: opts.authMethods } : {}),
            });
            bus.connection.on("message", onMessage);
            bus.connection.on("error", fail);
            bus.connection.on("end", () => fail(new Error("D-Bus closed")));
            const [name] = await dbusCall("Hello");
            sender = String(name).replace(/^:/, "").replace(/\./g, "_");
            await dbusCall("AddMatch", "s", [
                `type='signal',sender='${PORTAL}',interface='${IFACE}'`,
            ]);
            await dbusCall("AddMatch", "s", [
                `type='signal',sender='${PORTAL}',interface='org.freedesktop.portal.Request',member='Response'`,
            ]);
            if (opts.appId) {
                // Host (non-Flatpak) apps have no app id otherwise. Fails
                // harmlessly on portals before 1.19 and inside Flatpak.
                await call(
                    "Register",
                    "sa{sv}",
                    [opts.appId, []],
                    "org.freedesktop.host.portal.Registry",
                ).catch(() => {});
            }
            const [version] = await call(
                "Get",
                "ss",
                [IFACE, "version"],
                "org.freedesktop.DBus.Properties",
            );
            return Number(readVardict([["v", version]]).v);
        })();
        return ready;
    }

    async function closeSession() {
        const s = session;
        session = null;
        if (!s || closed) return;
        await track("Close", CALL_TIMEOUT_MS, (resolve) =>
            bus.invoke(
                {
                    destination: PORTAL,
                    path: s,
                    interface: "org.freedesktop.portal.Session",
                    member: "Close",
                },
                () => resolve(),
            ),
        ).catch(() => {});
    }

    return {
        /** The portal's version, or rejects when there's no portal. */
        connect,

        /**
         * Replace the bound shortcuts. Each binding change starts a new
         * session (a session takes BindShortcuts once).
         * @param {{id: string, description: string, trigger: string}[]} list
         * @returns {Promise<{id: string, trigger: string}[]>} what the
         *          compositor assigned ("" = nothing yet)
         */
        async bind(list) {
            await connect();
            await closeSession();
            if (list.length === 0) return [];
            const created = await request(
                "CreateSession",
                "a{sv}",
                [vardict({ session_handle_token: ["s", token()] })],
                CALL_TIMEOUT_MS,
            );
            session = String(created.session_handle);
            const shortcuts = list.map((s) => [
                s.id,
                vardict({
                    description: ["s", s.description],
                    ...(s.trigger
                        ? { preferred_trigger: ["s", s.trigger] }
                        : {}),
                }),
            ]);
            const bound = await request(
                "BindShortcuts",
                "oa(sa{sv})sa{sv}",
                [session, shortcuts, "", []],
                DIALOG_TIMEOUT_MS,
            );
            return readShortcuts(bound.shortcuts);
        },

        /** Open the desktop's own editor for our shortcuts (portal v2). */
        async configure() {
            if (!session) return;
            await call("ConfigureShortcuts", "osa{sv}", [session, "", []]);
        },

        close() {
            void closeSession().finally(() => {
                closed = true;
                bus?.connection.end();
            });
        },
    };
}

module.exports = { createPortalShortcuts, connectStream };
