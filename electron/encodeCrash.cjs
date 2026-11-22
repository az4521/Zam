// A GPU-process crash while the page encodes video on the GPU counts as the
// hardware encoder failing. rgosling80's friend's RX 7900 XTX (driver
// 32.0.32029.2010): Media Foundation's AMDh264Encoder took the GPU process
// down a couple of seconds into every screen share, while OpenH264 was fine.
// One such crash turns hardware video encoding off for that GPU and driver
// (gpu-prefs.json `videoEncodeCrashed`), so later launches start with
// --disable-accelerated-video-encode; a different GPU or driver tries the
// GPU again. Settings > Debug's "Hardware video encoding" switch undoes it.

/** How long after the page stopped encoding on the GPU an exit still counts:
 *  its report runs once a second and the crash may beat the next one. */
const ENCODE_GRACE_MS = 5000;

/** Exit reasons that aren't a crash (Electron's child-process-gone). An
 *  out-of-memory exit is a game holding the video memory, not the encoder. */
const NOT_A_CRASH = new Set(["clean-exit", "killed", "oom"]);

/** Whether a GPU exit with `reason` counts against the hardware encoder.
 *  `encoding` is the page's last report, `stoppedAt` when it last went
 *  from true to false. */
function encodeCrashCounts({ reason, encoding, stoppedAt, now, repaint }) {
    if (repaint || NOT_A_CRASH.has(reason)) return false;
    return encoding || now - stoppedAt < ENCODE_GRACE_MS;
}

/** The GPU and driver from app.getGPUInfo("basic"), as a key that changes
 *  with either. "" when Chromium names none. */
function gpuDriverKey(info) {
    const devices = Array.isArray(info?.gpuDevice) ? info.gpuDevice : [];
    const d = devices.find((x) => x?.active) ?? devices[0];
    if (!d) return "";
    const hex = (n) => (typeof n === "number" ? n.toString(16) : "?");
    return `${hex(d.vendorId)}:${hex(d.deviceId)}:${d.driverVersion ?? ""}`;
}

/** Whether a recorded crash still applies to the GPU this run found: not
 *  once the driver or GPU changed. A record without a key always applies
 *  (it can only be cleared by hand). */
function encodeCrashApplies(record, currentKey) {
    if (!record) return false;
    if (!record.driver || !currentKey) return true;
    return record.driver === currentKey;
}

module.exports = {
    ENCODE_GRACE_MS,
    encodeCrashCounts,
    gpuDriverKey,
    encodeCrashApplies,
};
