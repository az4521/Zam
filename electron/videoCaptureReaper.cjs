// Helpers for putting Chromium's video capture service back to sleep.
//
// Any enumerateDevices() call (voice settings, the self menu, the sessions
// panel) starts the "video_capture" utility process, and it stays resident
// until the app quits, holding tens of MB even with nothing capturing. Killing
// it while idle is safe: the next enumerateDevices spawns a fresh one. Killing
// it while a camera track is live would break that camera, so the caller only
// kills after counting zero live video tracks in every renderer and no call.

// The track predicate is written as a plain function so the page-side code
// (see VIDEO_TRACK_COUNT_EXPRESSION) and the tests share one definition.
function isLiveVideoTrack(track) {
    return !!track && track.kind === "video" && track.readyState === "live";
}

// Counts live video tracks in a list of { kind, readyState } descriptions.
function countLiveVideoTracks(tracks) {
    if (!Array.isArray(tracks)) return 0;
    return tracks.filter(isLiveVideoTrack).length;
}

// Page-side function body for Runtime.callFunctionOn, run with `this` bound to
// an array of MediaStreamTracks. Returns the live video count by value.
const VIDEO_TRACK_COUNT_FUNCTION =
    "function() { const isLiveVideoTrack = " +
    isLiveVideoTrack.toString() +
    "; return this.filter(isLiveVideoTrack).length; }";

// The pid of Chromium's video capture utility process, or undefined when it
// is not running. `metrics` is the result of app.getAppMetrics().
function findVideoCaptureService(metrics) {
    if (!Array.isArray(metrics)) return undefined;
    const found = metrics.find(
        (m) =>
            m &&
            m.type === "Utility" &&
            typeof m.serviceName === "string" &&
            m.serviceName.includes("video_capture"),
    );
    return found ? found.pid : undefined;
}

module.exports = {
    isLiveVideoTrack,
    countLiveVideoTracks,
    VIDEO_TRACK_COUNT_FUNCTION,
    findVideoCaptureService,
};
