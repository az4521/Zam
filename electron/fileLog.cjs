// A small append-only log file for the main process and the updater. The
// packaged app has no console to read, so a failure in the background (an
// installer that did not run, a renderer that died) would otherwise leave no
// trace. Writes are synchronous on purpose: the lines must reach disk even when
// the process is about to die. The file is truncated once at start when it has
// grown past maxBytes, so it never grows without bound.
const fs = require("fs");

const DEFAULT_MAX_BYTES = 1024 * 1024;

function format(arg) {
    if (arg instanceof Error) return arg.stack || arg.message;
    if (typeof arg === "string") return arg;
    try {
        return JSON.stringify(arg);
    } catch {
        return String(arg);
    }
}

function createFileLog(file, { maxBytes = DEFAULT_MAX_BYTES } = {}) {
    try {
        if (fs.statSync(file).size > maxBytes) fs.truncateSync(file, 0);
    } catch {
        // No file yet: nothing to trim.
    }

    const write = (level, args) => {
        const text = args.map(format).join(" ");
        const line = `${new Date().toISOString()} ${level} ${text}\n`;
        try {
            fs.appendFileSync(file, line);
        } catch {
            // Unwritable (disk full, folder gone): there is nowhere else to say so.
        }
    };

    return {
        file,
        info: (...args) => write("info", args),
        warn: (...args) => write("warn", args),
        error: (...args) => write("error", args),
        // electron-updater's logger calls this for chatty detail; keep it out.
        debug: () => {},
    };
}

module.exports = { createFileLog };
