// Plugins' native code (zam.native, src/lib/plugins/pluginNative.ts).
//
// A repo plugin may ship a native host for the desktop app: a script plus
// whatever native files it loads (e.g. ONNX Runtime), per platform, listed
// with their SHA-256 in its manifest. Everything that has to be trusted
// happens here, in the main process, not in the page:
//  - the manifest is fetched from the plugin's pinned commit by this code
//    (the page only names the plugin, repo, commit and directory), so a
//    compromised page can't substitute files or hashes;
//  - the user agrees in a system dialog before anything is downloaded or
//    run. Consent is per commit: an update asks again;
//  - every file is checked against the manifest's size and SHA-256, written
//    to a temporary directory and moved into place only when all are good;
//  - the host runs in its own utility process (it has full Node access:
//    that is what the dialog says). Each open() connects a new MessagePort
//    pair: one end goes to the host as a {type: "connect"} message on
//    process.parentPort, the other back to the page.

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { app, dialog, utilityProcess, MessageChannelMain } = require("electron");

// Dev only: a plugin repo served locally stands in for GitHub.
const RAW_BASE =
    (!app.isPackaged && process.env.ZAM_DEV_PLUGIN_RAW_BASE) ||
    "https://raw.githubusercontent.com/";
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const PORT_ID = /^[A-Za-z0-9]{1,64}$/;
const SHA = /^[0-9a-f]{40}$/;
const HASH = /^[0-9a-f]{64}$/;
const MAX_FILE = 100 * 1024 * 1024;
const PLATFORM = `${process.platform}-${process.arch}`;

/** Same rule as isSafeRelPath (src/lib/plugins/repo.ts). */
function safeRel(p) {
    if (typeof p !== "string" || p === "") return false;
    if (p.includes("\\") || p.includes(":")) return false;
    return p
        .split("/")
        .every(
            (s) =>
                s !== "" &&
                s !== "." &&
                s !== ".." &&
                /^[A-Za-z0-9._-]+$/.test(s),
        );
}

function validRequest(r) {
    return (
        r &&
        typeof r === "object" &&
        typeof r.id === "string" &&
        PORT_ID.test(r.id) &&
        typeof r.pluginId === "string" &&
        NAME.test(r.pluginId) &&
        typeof r.owner === "string" &&
        NAME.test(r.owner) &&
        typeof r.repo === "string" &&
        NAME.test(r.repo) &&
        typeof r.sha === "string" &&
        SHA.test(r.sha) &&
        safeRel(r.path)
    );
}

/** The platform's host and files from an untrusted manifest, or an error. */
function nativeFiles(manifest, pluginId) {
    if (!manifest || manifest.id !== pluginId)
        throw new Error("the manifest is for a different plugin");
    if (
        !Array.isArray(manifest.capabilities) ||
        !manifest.capabilities.includes("native")
    )
        throw new Error("the plugin doesn't declare the native capability");
    const p =
        manifest.native &&
        manifest.native.platforms &&
        manifest.native.platforms[PLATFORM];
    if (!p || typeof p !== "object")
        throw new Error(`the plugin has no native code for ${PLATFORM}`);
    if (!safeRel(p.host) || !/\.c?js$/.test(p.host))
        throw new Error("the manifest's native host is malformed");
    const files = p.files;
    if (!Array.isArray(files) || files.length === 0)
        throw new Error("the manifest's native file list is malformed");
    const seen = new Set();
    for (const f of files) {
        if (
            !f ||
            !safeRel(f.path) ||
            seen.has(f.path) ||
            typeof f.sha256 !== "string" ||
            !HASH.test(f.sha256) ||
            !Number.isInteger(f.size) ||
            f.size < 0 ||
            f.size > MAX_FILE
        )
            throw new Error("the manifest's native file list is malformed");
        seen.add(f.path);
    }
    if (!seen.has(p.host))
        throw new Error("the native host isn't in the file list");
    return { host: p.host, files };
}

async function fetchBuffer(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return Buffer.from(await res.arrayBuffer());
}

function registerPluginNative(ipcMain, getWindow) {
    const root = path.join(app.getPath("userData"), "plugin-native");
    const consentPath = path.join(root, "consent.json");
    const hosts = new Map(); // pluginId -> { sha, proc }
    const pending = new Map(); // `${pluginId}@${sha}` -> Promise<{dir, host}>

    const readConsent = () => {
        try {
            const c = JSON.parse(fs.readFileSync(consentPath, "utf8"));
            return c && typeof c === "object" ? c : {};
        } catch {
            return {};
        }
    };
    const writeConsent = (c) => {
        fs.mkdirSync(root, { recursive: true });
        fs.writeFileSync(consentPath, JSON.stringify(c));
    };

    async function install(req) {
        const base = `${RAW_BASE}${req.owner}/${req.repo}/${req.sha}/${req.path}/`;
        const manifest = JSON.parse(
            (await fetchBuffer(base + "manifest.json")).toString("utf8"),
        );
        const { host, files } = nativeFiles(manifest, req.pluginId);
        const dir = path.join(root, req.pluginId, req.sha);

        const consent = readConsent();
        if (consent[req.pluginId] !== req.sha) {
            const mb = files.reduce((s, f) => s + f.size, 0) / 1e6;
            const name =
                typeof manifest.name === "string"
                    ? manifest.name.slice(0, 80)
                    : req.pluginId;
            const win = getWindow();
            const opts = {
                type: "warning",
                buttons: ["Allow", "Don't allow"],
                defaultId: 1,
                cancelId: 1,
                noLink: true,
                title: "Plugin wants to run native code",
                message: `Let the plugin “${name}” run its own program on this computer?`,
                detail:
                    `Plugin ${req.pluginId} from github.com/${req.owner}/${req.repo} ` +
                    `(commit ${req.sha.slice(0, 8)}) ships native code for this computer ` +
                    `(${mb.toFixed(1)} MB). Native code runs outside Zam's sandbox with ` +
                    `full access to your computer and files. Only allow it if you trust ` +
                    `the plugin's author.`,
            };
            const { response } = win
                ? await dialog.showMessageBox(win, opts)
                : await dialog.showMessageBox(opts);
            if (response !== 0)
                throw new Error("you didn't allow the plugin's native code");
            consent[req.pluginId] = req.sha;
            writeConsent(consent);
        }

        if (!fs.existsSync(path.join(dir, ".complete"))) {
            const tmp = `${dir}.partial-${crypto.randomBytes(4).toString("hex")}`;
            try {
                for (const f of files) {
                    const bytes = await fetchBuffer(base + f.path);
                    if (bytes.length !== f.size)
                        throw new Error(
                            `${f.path}: size doesn't match the manifest`,
                        );
                    const sum = crypto
                        .createHash("sha256")
                        .update(bytes)
                        .digest("hex");
                    if (sum !== f.sha256)
                        throw new Error(
                            `${f.path}: SHA-256 doesn't match the manifest`,
                        );
                    const out = path.join(tmp, ...f.path.split("/"));
                    fs.mkdirSync(path.dirname(out), { recursive: true });
                    fs.writeFileSync(out, bytes);
                }
                fs.writeFileSync(path.join(tmp, ".complete"), req.sha);
                fs.rmSync(dir, { recursive: true, force: true });
                fs.renameSync(tmp, dir);
            } catch (err) {
                fs.rmSync(tmp, { recursive: true, force: true });
                throw err;
            }
        }
        // Older commits of this plugin are no longer needed.
        for (const other of fs.readdirSync(path.join(root, req.pluginId))) {
            if (other !== req.sha)
                fs.rmSync(path.join(root, req.pluginId, other), {
                    recursive: true,
                    force: true,
                });
        }
        return { dir, host };
    }

    async function ensureHost(req) {
        const running = hosts.get(req.pluginId);
        if (running && running.sha === req.sha) return running.proc;
        if (running) {
            running.proc.kill();
            hosts.delete(req.pluginId);
        }
        const key = `${req.pluginId}@${req.sha}`;
        let p = pending.get(key);
        if (!p) {
            p = install(req).finally(() => pending.delete(key));
            pending.set(key, p);
        }
        const { dir, host } = await p;
        const again = hosts.get(req.pluginId);
        if (again && again.sha === req.sha) return again.proc;
        const proc = utilityProcess.fork(
            path.join(dir, ...host.split("/")),
            [],
            {
                serviceName: `Zam plugin ${req.pluginId}`,
                cwd: dir,
            },
        );
        const entry = { sha: req.sha, proc };
        hosts.set(req.pluginId, entry);
        // A crash drops every port; the plugin falls back on its own, and
        // the next open() starts a new host.
        proc.on("exit", (code) => {
            if (code !== 0)
                console.error(
                    `Plugin ${req.pluginId} native host exited (${code})`,
                );
            if (hosts.get(req.pluginId) === entry) hosts.delete(req.pluginId);
        });
        return proc;
    }

    ipcMain.handle("plugin-native:open", async (event, req) => {
        if (!validRequest(req)) return { ok: false, error: "bad request" };
        try {
            const proc = await ensureHost(req);
            const { port1, port2 } = new MessageChannelMain();
            proc.postMessage({ type: "connect" }, [port1]);
            event.sender.postMessage("plugin-native:port", req.id, [port2]);
            return { ok: true };
        } catch (err) {
            return { ok: false, error: String((err && err.message) || err) };
        }
    });

    ipcMain.handle("plugin-native:remove", (_e, pluginId) => {
        if (typeof pluginId !== "string" || !NAME.test(pluginId)) return;
        const running = hosts.get(pluginId);
        if (running) running.proc.kill();
        hosts.delete(pluginId);
        fs.rmSync(path.join(root, pluginId), { recursive: true, force: true });
        const consent = readConsent();
        if (pluginId in consent) {
            delete consent[pluginId];
            writeConsent(consent);
        }
    });
}

module.exports = { registerPluginNative, safeRel, nativeFiles };
