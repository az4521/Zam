// Run with: node --test electron/videoCaptureReaper.test.cjs

const test = require("node:test");
const assert = require("node:assert/strict");
const {
    countLiveVideoTracks,
    VIDEO_TRACK_COUNT_FUNCTION,
    findVideoCaptureService,
} = require("./videoCaptureReaper.cjs");

test("only live video tracks count", () => {
    const tracks = [
        { kind: "video", readyState: "live" },
        { kind: "video", readyState: "ended" },
        { kind: "audio", readyState: "live" },
        { kind: "video", readyState: "live" },
        null,
    ];
    assert.equal(countLiveVideoTracks(tracks), 2);
});

test("no tracks, or a non-list, counts as zero", () => {
    assert.equal(countLiveVideoTracks([]), 0);
    assert.equal(countLiveVideoTracks(undefined), 0);
    assert.equal(countLiveVideoTracks({ length: 3 }), 0);
});

test("the page-side function applies the same predicate", () => {
    const fn = new Function("return (" + VIDEO_TRACK_COUNT_FUNCTION + ")")();
    const tracks = [
        { kind: "video", readyState: "live" },
        { kind: "video", readyState: "muted" },
        { kind: "audio", readyState: "live" },
    ];
    assert.equal(fn.call(tracks), 1);
    assert.equal(fn.call([]), 0);
});

test("finds the video capture utility process pid", () => {
    const metrics = [
        { type: "Browser", pid: 1 },
        { type: "GPU", pid: 2 },
        {
            type: "Utility",
            pid: 3,
            serviceName: "network.mojom.NetworkService",
        },
        {
            type: "Utility",
            pid: 4,
            serviceName: "video_capture.mojom.VideoCaptureService",
        },
    ];
    assert.equal(findVideoCaptureService(metrics), 4);
});

test("a video capture service of another type is not picked", () => {
    const metrics = [
        { type: "Renderer", pid: 5, serviceName: "video_capture" },
        { type: "Utility", pid: 6 },
    ];
    assert.equal(findVideoCaptureService(metrics), undefined);
});

test("no service, or no metrics, gives undefined", () => {
    assert.equal(findVideoCaptureService([{ type: "GPU", pid: 2 }]), undefined);
    assert.equal(findVideoCaptureService([]), undefined);
    assert.equal(findVideoCaptureService(undefined), undefined);
});
