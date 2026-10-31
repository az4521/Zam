// Run at startup from inside the Flatpak: the xdg-desktop-portal Background
// portal writes (or removes) the autostart entry on the host. Needs no extra
// permission in the manifest, but the desktop may ask the user the first time.
//
// A short-lived connection, unlike portalShortcuts.cjs: the portal's answer is
// all we want from it, and that one is tied to the GlobalShortcuts interface,
// which a desktop can lack while still having this one.
//
// Spec: flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.Background.html

const crypto = require("crypto");
const { connectStream, readVardict } = require("./portalShortcuts.cjs");

const PORTAL = "org.freedesktop.portal.Desktop";
const PORTAL_PATH = "/org/freedesktop/portal/desktop";
const REQUEST_IFACE = "org.freedesktop.portal.Request";
const SIGNAL = 4; // D-Bus message type
// The desktop may wait on a dialog the user has to answer.
const RESPONSE_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Turn autostart on or off.
 * @param {boolean} enabled
 * @param {object} [opts]
 * @param {string} [opts.busAddress] defaults to DBUS_SESSION_BUS_ADDRESS
 * @param {string[]} [opts.authMethods] tests only
 * @returns {Promise<boolean>} whether Zam will now start at login
 */
function requestPortalAutostart(enabled, opts = {}) {
    const dbus = require("@homebridge/dbus-native");
    return new Promise((resolve, reject) => {
        const bus = dbus.createClient({
            stream: connectStream(
                opts.busAddress || process.env.DBUS_SESSION_BUS_ADDRESS,
            ),
            direct: true,
            ...(opts.authMethods ? { authMethods: opts.authMethods } : {}),
        });
        const timer = setTimeout(
            () => finish(reject, new Error("Portal request timed out")),
            RESPONSE_TIMEOUT_MS,
        );
        let settled = false;
        function finish(fn, value) {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            fn(value);
            bus.connection.end();
        }
        const fail = (err) =>
            finish(reject, err instanceof Error ? err : new Error(String(err)));
        const replyError = (err) =>
            new Error(`${err.name || "Error"}: ${err.message || ""}`);
        const dbusCall = (member, signature, body) =>
            new Promise((done, failed) =>
                bus.invokeDbus({ member, signature, body }, (err, ...res) =>
                    err ? failed(replyError(err)) : done(res),
                ),
            );

        let handle = "";
        bus.connection.on("error", fail);
        bus.connection.on("end", () => fail(new Error("D-Bus closed")));
        bus.connection.on("message", (msg) => {
            if (
                msg.type !== SIGNAL ||
                msg.interface !== REQUEST_IFACE ||
                msg.member !== "Response" ||
                msg.path !== handle
            )
                return;
            const [code, results] = msg.body;
            if (code !== 0)
                fail(new Error(`RequestBackground: response ${code}`));
            else finish(resolve, !!readVardict(results).autostart);
        });

        (async () => {
            const [name] = await dbusCall("Hello");
            await dbusCall("AddMatch", "s", [
                `type='signal',sender='${PORTAL}',interface='${REQUEST_IFACE}',member='Response'`,
            ]);
            const handleToken = `zam_${crypto.randomBytes(6).toString("hex")}`;
            const sender = String(name).replace(/^:/, "").replace(/\./g, "_");
            // Listen before calling: the Response can beat the method's reply.
            handle = `${PORTAL_PATH}/request/${sender}/${handleToken}`;
            bus.invoke(
                {
                    destination: PORTAL,
                    path: PORTAL_PATH,
                    interface: "org.freedesktop.portal.Background",
                    member: "RequestBackground",
                    signature: "sa{sv}",
                    body: [
                        "",
                        [
                            ["handle_token", ["s", handleToken]],
                            ["reason", ["s", "Start Zam when you log in"]],
                            ["autostart", ["b", enabled]],
                            // The manifest's command, /app/bin/zam.
                            ["commandline", ["as", ["zam"]]],
                            ["dbus-activatable", ["b", false]],
                        ],
                    ],
                },
                (err, returned) => {
                    if (err) fail(replyError(err));
                    // Older portals pick their own path; follow it.
                    else if (returned) handle = returned;
                },
            );
        })().catch(fail);
    });
}

module.exports = { requestPortalAutostart };
