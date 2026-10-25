// Screen-share audio choices: what the picker may offer and what a pick
// turns into. Pure (no Electron), so it is unit-tested
// (src/lib/utils/electronShareAudio.test.ts); the capture itself lives in
// appAudio.cjs.
//
// The picker sends one of:
//   "none"      no audio
//   "system"    everything the computer plays except Zam itself
//   "auto"      a window share: that window's application; a screen share:
//               the same as "system"
//   "app:<id>"  one application from the list this request was offered
// and gets back a plan for main.cjs:
//   { kind: "none" }
//   { kind: "loopback" }          Electron's own full system loopback
//                                 (Windows before 10 2004: it includes Zam)
//   { kind: "capture", target }   per-application capture (appAudio.cjs)

/** The HWND inside a Windows desktopCapturer window id ("window:<hwnd>:0"),
 *  as a decimal string, or null for screens and anything malformed. */
function windowSourceHwnd(sourceId) {
    const m = /^window:(\d{1,20}):\d+$/.exec(String(sourceId || ""));
    if (!m || /^0+$/.test(m[1])) return null;
    return m[1];
}

/**
 * @param {string} choice  the picker's answer (untrusted: from the renderer)
 * @param {string} sourceId  the granted video source
 * @param {{ system: "exclude-self" | "loopback" | null,
 *           systemTarget: object | null,
 *           windowTarget: (sourceId: string) => object | null }} caps
 * @param {Map<string, object>} appTargets  id -> target, as offered
 */
function resolveShareAudio(choice, sourceId, caps, appTargets) {
    const system = () => {
        if (caps.system === "exclude-self" && caps.systemTarget) {
            return { kind: "capture", target: caps.systemTarget };
        }
        if (caps.system === "loopback") return { kind: "loopback" };
        return { kind: "none" };
    };
    if (choice === "system") return system();
    if (choice === "auto") {
        const target = caps.windowTarget?.(sourceId) ?? null;
        return target ? { kind: "capture", target } : system();
    }
    if (typeof choice === "string" && choice.startsWith("app:")) {
        const target = appTargets.get(choice.slice(4));
        return target ? { kind: "capture", target } : { kind: "none" };
    }
    return { kind: "none" };
}

/**
 * The applications the picker lists on Linux, from venmic's PipeWire node
 * list: one entry per application name, Zam's own audio and recording
 * streams left out. `selfPids` are Zam's process ids as strings.
 */
function groupPipewireApps(nodes, selfPids, selfNames) {
    const byName = new Map();
    for (const node of nodes || []) {
        if (!node || typeof node !== "object") continue;
        const name = node["application.name"];
        if (typeof name !== "string" || !name) continue;
        if (selfPids.has(String(node["application.process.id"] ?? "")))
            continue;
        if (selfNames.has(name)) continue;
        if (node["media.class"] === "Stream/Input/Audio") continue;
        if (node["node.name"] === "vencord-screen-share") continue;
        if (!byName.has(name)) {
            byName.set(name, {
                id: `pw:${name}`,
                name,
                active: false,
                target: {
                    mode: "pipewire",
                    include: [{ "application.name": name }],
                },
            });
        }
    }
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** The JSON `zam-app-audio list` prints, as picker entries. Invalid input
 *  gives an empty list rather than a throw. */
function parseWindowsSessions(json) {
    let parsed;
    try {
        parsed = JSON.parse(json);
    } catch {
        return [];
    }
    if (!parsed?.ok || !Array.isArray(parsed.sessions)) return [];
    const out = [];
    for (const s of parsed.sessions) {
        const pid = Number(s?.pid);
        if (!Number.isInteger(pid) || pid <= 0) continue;
        const name =
            typeof s.name === "string" && s.name.trim()
                ? s.name.trim()
                : typeof s.exe === "string"
                  ? s.exe
                  : `PID ${pid}`;
        out.push({
            id: `pid:${pid}`,
            name: name.slice(0, 128),
            active: s.active === true,
            target: { mode: "include", pid },
        });
    }
    // Playing now first, then by name; equal names keep their pid order.
    return out.sort(
        (a, b) =>
            Number(b.active) - Number(a.active) || a.name.localeCompare(b.name),
    );
}

module.exports = {
    windowSourceHwnd,
    resolveShareAudio,
    groupPipewireApps,
    parseWindowsSessions,
};
