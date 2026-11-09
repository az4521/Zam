// Updating the Flatpak from inside it: the Flatpak portal's update monitor
// (org.freedesktop.portal.Flatpak, flatpak 1.5+) tells us when the remote or
// the installed copy is newer than the one running, installs the update when
// asked, and Spawn with LATEST_VERSION starts the newly installed version
// (a relaunch inside this sandbox would run the old /app again).
//
// What the portal does, read from flatpak's portal/flatpak-portal.c:
//   - It polls the remote every 30 minutes (never on a metered network), the
//     first poll 30 minutes after the monitor is made. UpdateAvailable fires
//     when the installed or the remote commit differs from the running one.
//   - Update asks the user once ("Update Zam?") and remembers the answer
//     (AccessDenied after a no). It refuses an update whose new version needs
//     more sandbox permissions (NotSupported); that one takes
//     `flatpak update` or a software center. An update with nothing to
//     install ends with status 1 (Empty).
//   - Spawn keeps the running runtime version even with LATEST_VERSION, so a
//     release that moves to a new runtime branch also needs a manual update.
//
// One long-lived connection, like portalShortcuts.cjs: the monitor lives as
// long as it does.
//
// Spec: flatpak/data/org.freedesktop.portal.Flatpak.xml

const crypto = require("crypto");
const { connectStream, readVardict } = require("./portalShortcuts.cjs");

const PORTAL = "org.freedesktop.portal.Flatpak";
const PORTAL_PATH = "/org/freedesktop/portal/Flatpak";
const IFACE = "org.freedesktop.portal.Flatpak";
const MONITOR_IFACE = "org.freedesktop.portal.Flatpak.UpdateMonitor";
const SIGNAL = 4; // D-Bus message type
const CALL_TIMEOUT_MS = 10000;
// The first Update may wait on the user answering the portal's dialog, and
// the download itself can take a while.
const UPDATE_TIMEOUT_MS = 60 * 60 * 1000;
const SPAWN_LATEST_VERSION = 2;

const STATUS_RUNNING = 0;
const STATUS_EMPTY = 1;
const STATUS_DONE = 2;

/** NUL-terminated bytes, as the portal reads `ay` paths and arguments. */
const bytestring = (s) => Array.from(Buffer.from(`${s}\0`, "utf8"));

/**
 * @param {object} [opts]
 * @param {string} [opts.busAddress] defaults to DBUS_SESSION_BUS_ADDRESS
 * @param {string[]} [opts.authMethods] tests only
 * @param {(info: { runningCommit?: string, localCommit?: string,
 *   remoteCommit?: string }) => void} [opts.onUpdateAvailable]
 * @param {(...a: unknown[]) => void} [opts.log]
 */
function createFlatpakUpdateMonitor(opts = {}) {
    const log = opts.log ?? (() => {});
    let bus = null;
    let handle = "";
    let closed = false;
    // The Update in flight: its Progress signals settle it.
    let pending = null;

    const replyError = (err) => {
        const e = new Error(err?.message || String(err?.name || err));
        e.dbusName = err?.name || "";
        return e;
    };

    function call(msg, timeoutMs = CALL_TIMEOUT_MS) {
        return new Promise((resolve, reject) => {
            if (!bus || closed) {
                reject(new Error("Flatpak portal connection is closed"));
                return;
            }
            const timer = setTimeout(
                () => reject(new Error(`${msg.member}: timed out`)),
                timeoutMs,
            );
            bus.invoke(msg, (err, ...res) => {
                clearTimeout(timer);
                if (err) reject(replyError(err));
                else resolve(res);
            });
        });
    }

    function onProgress(info) {
        if (!pending) return;
        const status = Number(info.status ?? STATUS_RUNNING);
        if (status === STATUS_RUNNING) {
            const nOps = Number(info.n_ops) || 0;
            if (nOps > 0) {
                const op = Math.min(Number(info.op) || 0, nOps - 1);
                const within = (Number(info.progress) || 0) / 100;
                pending.onProgress(Math.min(1, (op + within) / nOps));
            }
            return;
        }
        const { resolve, reject, timer } = pending;
        pending = null;
        clearTimeout(timer);
        if (status === STATUS_DONE) resolve("done");
        else if (status === STATUS_EMPTY) resolve("empty");
        else {
            const e = new Error(
                info.error_message || info.error || "Flatpak update failed",
            );
            e.dbusName = info.error || "";
            reject(e);
        }
    }

    function onMessage(msg) {
        if (
            msg.type !== SIGNAL ||
            msg.interface !== MONITOR_IFACE ||
            msg.path !== handle
        )
            return;
        const info = readVardict(msg.body?.[0]);
        if (msg.member === "UpdateAvailable") {
            const update = {
                runningCommit: info["running-commit"],
                localCommit: info["local-commit"],
                remoteCommit: info["remote-commit"],
            };
            log("update available", update);
            opts.onUpdateAvailable?.(update);
        } else if (msg.member === "Progress") onProgress(info);
    }

    function fail(err) {
        if (closed) return;
        closed = true;
        log("portal connection lost:", err?.message ?? err);
        if (pending) {
            clearTimeout(pending.timer);
            pending.reject(err instanceof Error ? err : new Error(String(err)));
            pending = null;
        }
    }

    return {
        /**
         * Connect and make the monitor. Rejects when there is no session bus
         * or the portal has no update monitor (flatpak before 1.5).
         */
        async start() {
            const dbus = require("@homebridge/dbus-native");
            bus = dbus.createClient({
                stream: connectStream(
                    opts.busAddress || process.env.DBUS_SESSION_BUS_ADDRESS,
                ),
                direct: true,
                ...(opts.authMethods ? { authMethods: opts.authMethods } : {}),
            });
            bus.connection.on("error", fail);
            bus.connection.on("end", () => fail(new Error("D-Bus closed")));
            bus.connection.on("message", onMessage);

            const busCall = (member, signature, body) =>
                new Promise((done, failed) =>
                    bus.invokeDbus(
                        { member, signature, body },
                        (err, ...res) =>
                            err ? failed(replyError(err)) : done(res),
                    ),
                );
            const [name] = await busCall("Hello");
            await busCall("AddMatch", "s", [
                `type='signal',sender='${PORTAL}',interface='${MONITOR_IFACE}'`,
            ]);
            const handleToken = `zam_${crypto.randomBytes(6).toString("hex")}`;
            const sender = String(name).replace(/^:/, "").replace(/\./g, "_");
            // Known before the call returns, so no early signal is missed.
            handle = `${PORTAL_PATH}/update_monitor/${sender}/${handleToken}`;
            const [returned] = await call({
                destination: PORTAL,
                path: PORTAL_PATH,
                interface: IFACE,
                member: "CreateUpdateMonitor",
                signature: "a{sv}",
                body: [[["handle_token", ["s", handleToken]]]],
            });
            if (returned) handle = returned;
            log("update monitor", handle);
        },

        /**
         * Install the update the remote has. Resolves "done" (restart to use
         * it) or "empty" (nothing newer on the remote). Rejects with
         * `dbusName` set: NotSupported for an update that needs new
         * permissions, AccessDenied when the user refused.
         * @param {(fraction: number) => void} onProgress
         */
        update(onProgress) {
            if (pending) return Promise.reject(new Error("Already installing"));
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    pending = null;
                    reject(new Error("Flatpak update timed out"));
                }, UPDATE_TIMEOUT_MS);
                pending = { resolve, reject, timer, onProgress };
                call(
                    {
                        destination: PORTAL,
                        path: handle,
                        interface: MONITOR_IFACE,
                        member: "Update",
                        signature: "sa{sv}",
                        body: ["", []],
                    },
                    // The reply only says the update started; Progress says
                    // how it ends. The permission dialog comes before it.
                    UPDATE_TIMEOUT_MS,
                ).catch((err) => {
                    if (!pending) return;
                    clearTimeout(pending.timer);
                    pending = null;
                    reject(err);
                });
            });
        },

        /**
         * Start the newest installed version of the app with `argv` (argv[0]
         * is the command in the sandbox). It outlives this process.
         * @param {string[]} argv
         */
        async spawnLatest(argv) {
            const [pid] = await call({
                destination: PORTAL,
                path: PORTAL_PATH,
                interface: IFACE,
                member: "Spawn",
                signature: "ayaaya{uh}a{ss}ua{sv}",
                body: [
                    bytestring(process.cwd()),
                    argv.map(bytestring),
                    [],
                    [],
                    SPAWN_LATEST_VERSION,
                    [],
                ],
            });
            log("spawned latest version, pid", pid);
        },

        close() {
            if (closed) return;
            closed = true;
            bus?.connection.end();
        },
    };
}

module.exports = { createFlatpakUpdateMonitor, bytestring };
