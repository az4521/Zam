// Raw TCP and UDP sockets for plugins (zam.network, src/lib/plugins/
// pluginSockets.ts). The page asks for a socket over IPC and gets an id;
// what arrives on it comes back as "plugin-sockets:event" messages to the
// page that opened it. Plugins are full-trust code in the page, so the
// endpoint rules (the manifest's `sockets`) are checked there, not here:
// main only checks the request is well formed and closes a page's sockets
// when that page goes away (reload, crash, window closed).

const net = require("node:net");
const dgram = require("node:dgram");

const PLUGIN_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const HOST = /^[A-Za-z0-9.:-]{1,253}$/;
const MAX_SOCKETS_PER_PLUGIN = 64;
const CONNECT_TIMEOUT_MS = 15_000;

const validPort = (p, allowZero) =>
    Number.isInteger(p) && p >= (allowZero ? 0 : 1) && p <= 65535;

function registerPluginSockets(ipcMain) {
    /** id -> { pluginId, kind, socket, sender } */
    const sockets = new Map();
    let nextId = 1;
    /** webContents ids we already watch for going away. */
    const watched = new Set();

    const emit = (entry, id, msg) => {
        if (!entry.sender.isDestroyed())
            entry.sender.send("plugin-sockets:event", { id, ...msg });
    };

    const destroy = (id) => {
        const entry = sockets.get(id);
        if (!entry) return;
        sockets.delete(id);
        try {
            if (entry.kind === "tcp") entry.socket.destroy();
            else entry.socket.close();
        } catch {
            // Already closed.
        }
    };

    const watch = (sender) => {
        if (watched.has(sender.id)) return;
        watched.add(sender.id);
        const closeAll = () => {
            for (const [id, e] of sockets) if (e.sender === sender) destroy(id);
        };
        // A reload starts a new page whose plugins know nothing of these.
        sender.on("did-start-navigation", (details) => {
            if (details?.isMainFrame !== false && !details?.isSameDocument)
                closeAll();
        });
        sender.on("render-process-gone", closeAll);
        sender.once("destroyed", () => {
            closeAll();
            watched.delete(sender.id);
        });
    };

    const countFor = (pluginId) => {
        let n = 0;
        for (const e of sockets.values()) if (e.pluginId === pluginId) n++;
        return n;
    };

    const check = (req) => {
        if (!req || typeof req !== "object") return "bad request";
        if (typeof req.pluginId !== "string" || !PLUGIN_ID.test(req.pluginId))
            return "bad plugin id";
        if (countFor(req.pluginId) >= MAX_SOCKETS_PER_PLUGIN)
            return "too many sockets";
        return null;
    };

    ipcMain.handle("plugin-sockets:tcp", (event, req) => {
        const bad = check(req);
        if (bad) return { ok: false, error: bad };
        if (typeof req.host !== "string" || !HOST.test(req.host))
            return { ok: false, error: "bad host" };
        if (!validPort(req.port, false))
            return { ok: false, error: "bad port" };
        watch(event.sender);
        return new Promise((resolve) => {
            const id = nextId++;
            const socket = net.connect({ host: req.host, port: req.port });
            socket.setNoDelay(true);
            const entry = {
                pluginId: req.pluginId,
                kind: "tcp",
                socket,
                sender: event.sender,
            };
            let settled = false;
            const timer = setTimeout(() => {
                if (settled) return;
                settled = true;
                socket.destroy();
                resolve({ ok: false, error: "connection timed out" });
            }, CONNECT_TIMEOUT_MS);
            socket.once("connect", () => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                sockets.set(id, entry);
                resolve({ ok: true, id });
            });
            socket.on("data", (data) =>
                emit(entry, id, { type: "data", data: new Uint8Array(data) }),
            );
            let error = null;
            socket.on("error", (err) => {
                error = String(err?.message ?? err);
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve({ ok: false, error });
            });
            socket.on("close", () => {
                if (!sockets.has(id)) return;
                sockets.delete(id);
                emit(entry, id, { type: "close", error });
            });
        });
    });

    ipcMain.handle("plugin-sockets:udp", (event, req) => {
        const bad = check(req);
        if (bad) return { ok: false, error: bad };
        const host = req.localHost ?? "127.0.0.1";
        const port = req.localPort ?? 0;
        if (typeof host !== "string" || !HOST.test(host))
            return { ok: false, error: "bad host" };
        if (!validPort(port, true)) return { ok: false, error: "bad port" };
        watch(event.sender);
        return new Promise((resolve) => {
            const id = nextId++;
            const socket = dgram.createSocket(
                net.isIPv6(host) ? "udp6" : "udp4",
            );
            const entry = {
                pluginId: req.pluginId,
                kind: "udp",
                socket,
                sender: event.sender,
            };
            let bound = false;
            let error = null;
            socket.on("error", (err) => {
                error = String(err?.message ?? err);
                if (!bound) {
                    socket.close();
                    resolve({ ok: false, error });
                }
            });
            socket.on("message", (data, rinfo) =>
                emit(entry, id, {
                    type: "message",
                    host: rinfo.address,
                    port: rinfo.port,
                    data: new Uint8Array(data),
                }),
            );
            socket.on("close", () => {
                if (!sockets.has(id)) return;
                sockets.delete(id);
                emit(entry, id, { type: "close", error });
            });
            socket.bind(port, host, () => {
                bound = true;
                sockets.set(id, entry);
                resolve({ ok: true, id, localPort: socket.address().port });
            });
        });
    });

    const owned = (event, id) => {
        const entry = sockets.get(id);
        return entry && entry.sender === event.sender ? entry : null;
    };

    ipcMain.handle("plugin-sockets:write", (event, id, data) => {
        const entry = owned(event, id);
        if (!entry || entry.kind !== "tcp")
            return { ok: false, error: "socket is closed" };
        if (!(data instanceof Uint8Array))
            return { ok: false, error: "bad data" };
        return new Promise((resolve) =>
            entry.socket.write(Buffer.from(data), (err) =>
                resolve(
                    err
                        ? { ok: false, error: String(err.message) }
                        : { ok: true },
                ),
            ),
        );
    });

    ipcMain.handle("plugin-sockets:send", (event, id, host, port, data) => {
        const entry = owned(event, id);
        if (!entry || entry.kind !== "udp")
            return { ok: false, error: "socket is closed" };
        if (typeof host !== "string" || !HOST.test(host) || !validPort(port))
            return { ok: false, error: "bad address" };
        if (!(data instanceof Uint8Array))
            return { ok: false, error: "bad data" };
        return new Promise((resolve) =>
            entry.socket.send(Buffer.from(data), port, host, (err) =>
                resolve(
                    err
                        ? { ok: false, error: String(err.message) }
                        : { ok: true },
                ),
            ),
        );
    });

    ipcMain.handle("plugin-sockets:close", (event, id) => {
        if (owned(event, id)) destroy(id);
    });

    ipcMain.handle("plugin-sockets:close-plugin", (event, pluginId) => {
        for (const [id, e] of sockets)
            if (e.pluginId === pluginId && e.sender === event.sender)
                destroy(id);
    });
}

module.exports = { registerPluginSockets };
