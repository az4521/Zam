// Raise the nice level of single threads from inside the Flatpak: the
// xdg-desktop-portal Realtime portal asks RealtimeKit on the host to do it,
// which a sandbox can't do for itself (setpriority below 0 needs CAP_SYS_NICE
// in the host's user namespace, and a sandbox has none). Needs no permission
// in the manifest.
//
// A short-lived connection per batch, like portalBackground.cjs.
//
// Spec: flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.Realtime.html

const { connectStream, readVardict } = require("./portalShortcuts.cjs");

const PORTAL = "org.freedesktop.portal.Desktop";
const PORTAL_PATH = "/org/freedesktop/portal/desktop";
const IFACE = "org.freedesktop.portal.Realtime";
const CALL_TIMEOUT_MS = 10000;
/** RealtimeKit's usual floor; what we ask for when the portal doesn't say. */
const DEFAULT_MIN_NICE = -15;

/**
 * Give each thread the most favourable nice level the portal allows.
 * @param {{pid: number, tid: number}[]} threads ids as seen from this
 *        process's own pid namespace (the portal translates them)
 * @param {object} [opts]
 * @param {string} [opts.busAddress] defaults to DBUS_SESSION_BUS_ADDRESS
 * @param {string[]} [opts.authMethods] tests only
 * @returns {Promise<{niceLevel: number, ok: number[], failed: {tid: number, error: string}[]}>}
 *          rejects when there's no portal to ask
 */
function makeThreadsHighPriority(threads, opts = {}) {
    const dbus = require("@homebridge/dbus-native");
    return new Promise((resolve, reject) => {
        let settled = false;
        let bus = null;
        const timer = setTimeout(
            () => finish(reject, new Error("Realtime portal timed out")),
            CALL_TIMEOUT_MS + 2000 * threads.length,
        );
        function finish(fn, value) {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            fn(value);
            bus?.connection.end();
        }
        const fail = (err) =>
            finish(reject, err instanceof Error ? err : new Error(String(err)));
        const replyError = (err) =>
            new Error(`${err.name || "Error"}: ${err.message || ""}`);

        try {
            bus = dbus.createClient({
                stream: connectStream(
                    opts.busAddress || process.env.DBUS_SESSION_BUS_ADDRESS,
                ),
                direct: true,
                ...(opts.authMethods ? { authMethods: opts.authMethods } : {}),
            });
        } catch (err) {
            return fail(err);
        }
        bus.connection.on("error", fail);
        bus.connection.on("end", () => fail(new Error("D-Bus closed")));

        const call = (member, signature, body, iface = IFACE) =>
            new Promise((done, failed) =>
                bus.invoke(
                    {
                        destination: PORTAL,
                        path: PORTAL_PATH,
                        interface: iface,
                        member,
                        signature,
                        body,
                    },
                    (err, ...res) =>
                        err ? failed(replyError(err)) : done(res),
                ),
            );

        (async () => {
            await new Promise((done, failed) =>
                bus.invokeDbus({ member: "Hello" }, (err) =>
                    err ? failed(replyError(err)) : done(),
                ),
            );
            let niceLevel = DEFAULT_MIN_NICE;
            try {
                const [v] = await call(
                    "Get",
                    "ss",
                    [IFACE, "MinNiceLevel"],
                    "org.freedesktop.DBus.Properties",
                );
                const min = Number(readVardict([["v", v]]).v);
                if (Number.isInteger(min)) niceLevel = min;
            } catch {
                /* an older portal: ask for the usual floor */
            }
            const ok = [];
            const failed = [];
            for (const { pid, tid } of threads) {
                try {
                    await call("MakeThreadHighPriorityWithPID", "tti", [
                        pid,
                        tid,
                        niceLevel,
                    ]);
                    ok.push(tid);
                } catch (err) {
                    failed.push({ tid, error: err.message });
                }
            }
            finish(resolve, { niceLevel, ok, failed });
        })().catch(fail);
    });
}

module.exports = { makeThreadsHighPriority };
