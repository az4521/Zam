// Settings > General > Desktop: run Zam when the user logs in. Each packaging
// needs its own mechanism:
//
//   Windows, macOS    Electron's login items.
//   Linux (AppImage)  an XDG autostart entry, which Electron doesn't manage.
//   Flatpak           the Background portal, since the sandbox can't reach the
//                     host's autostart folder (portalBackground.cjs). A portal
//                     can only be told, not asked, so the answer is kept in
//                     userData.
//
// Only packaged builds offer it: an unpackaged run would register a bare
// Electron binary that has no app to open.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { requestPortalAutostart } = require("./portalBackground.cjs");

const APP_ID = "moe.crafty.matrix";
const LOGIN_ITEM_NAME = "Zam";

/** A desktop entry's Exec argument: quoted for the Exec field, then escaped
 *  again as a desktop entry string, as the spec has it. */
function quoteExecArg(arg) {
    const quoted = arg.replace(/["`$\\]/g, "\\$&");
    return `"${quoted.replace(/\\/g, "\\\\").replace(/%/g, "%%")}"`;
}

function desktopEntry(exe) {
    return [
        "[Desktop Entry]",
        "Type=Application",
        "Name=Zam",
        "Comment=Chat on Matrix",
        `Exec=${quoteExecArg(exe)}`,
        "Terminal=false",
        "X-GNOME-Autostart-enabled=true",
        "",
    ].join("\n");
}

function xdgBackend({ app, env }) {
    const file = path.join(
        env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"),
        "autostart",
        `${APP_ID}.desktop`,
    );
    // An AppImage runs from a temporary mount; APPIMAGE is the file itself.
    const entry = () => desktopEntry(env.APPIMAGE || app.getPath("exe"));
    const read = () => {
        try {
            return fs.readFileSync(file, "utf8");
        } catch {
            return null;
        }
    };
    const write = () => {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, entry());
    };
    return {
        isEnabled() {
            const text = read();
            // Desktop settings apps turn an entry off with Hidden=true.
            return text !== null && !/^Hidden=true$/m.test(text);
        },
        set(enabled) {
            if (enabled) write();
            else fs.rmSync(file, { force: true });
        },
        // AppImages move and get renamed by updates; follow the running one.
        refresh() {
            if (this.isEnabled() && read() !== entry()) write();
        },
    };
}

function loginItemBackend({ app, env, platform }) {
    const target = {
        // A portable build runs from a temporary folder; this is its .exe.
        path: env.PORTABLE_EXECUTABLE_FILE || app.getPath("exe"),
        name: LOGIN_ITEM_NAME,
    };
    return {
        isEnabled() {
            const item = app.getLoginItemSettings(target);
            // Task Manager can switch off an entry that is still registered.
            return platform === "win32"
                ? item.executableWillLaunchAtLogin
                : item.openAtLogin;
        },
        set(enabled) {
            app.setLoginItemSettings({ ...target, openAtLogin: enabled });
        },
        refresh() {},
    };
}

function flatpakBackend({ app, requestPortal }) {
    const prefsPath = () =>
        path.join(app.getPath("userData"), "autostart.json");
    return {
        isEnabled() {
            try {
                return JSON.parse(fs.readFileSync(prefsPath(), "utf8")).enabled;
            } catch {
                return false;
            }
        },
        async set(enabled) {
            const granted = await requestPortal(enabled);
            fs.writeFileSync(prefsPath(), JSON.stringify({ enabled: granted }));
        },
        refresh() {},
    };
}

/**
 * @param {object} deps
 * @param {import("electron").App} deps.app
 * @param {boolean} deps.inFlatpak
 * @param {NodeJS.ProcessEnv} [deps.env]
 * @param {NodeJS.Platform} [deps.platform]
 * @param {(enabled: boolean) => Promise<boolean>} [deps.requestPortal]
 */
function createAutostart({
    app,
    inFlatpak,
    env = process.env,
    platform = process.platform,
    requestPortal = requestPortalAutostart,
}) {
    let backend = null;
    if (app.isPackaged) {
        if (inFlatpak) backend = flatpakBackend({ app, requestPortal });
        else if (platform === "linux") backend = xdgBackend({ app, env });
        else backend = loginItemBackend({ app, env, platform });
    }
    const info = () => ({
        available: !!backend,
        enabled: !!backend?.isEnabled(),
    });
    return {
        info,
        async set(enabled) {
            await backend?.set(!!enabled);
            return info();
        },
        refresh() {
            try {
                backend?.refresh();
            } catch (err) {
                console.error("autostart refresh failed:", err);
            }
        },
    };
}

module.exports = { createAutostart, quoteExecArg };
