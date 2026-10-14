// DPDFNet plugin's native host: Zam's desktop app starts this in a utility
// process (zam.native, after the user agreed) and connects one MessagePort
// per mic chain. It runs the model on native ONNX Runtime (shipped beside it
// in node_modules/), about 1.6x as fast as the WASM build. Protocol
// (src/protocol.ts):
//  - binary frames: int32 sequence number + 481 complex bins as float32
//    (re, im), answered in order with the enhanced bins;
//  - JSON-string control messages: init (fresh state) -> ready / error,
//    reset, close. An init with modelBytes is followed by the model as the
//    next binary message (loaded once per process).
// One session serves every port; each port has its own recurrent state.

const ort = require("./node_modules/onnxruntime-node");

const BINS = 481;
const FRAME_BYTES = 4 + BINS * 2 * 4;
const SPEC_SHAPE = [1, 1, BINS, 2];

let session = null;
let sessionThreads = 0;

function loadSession(model, threads) {
    const n = Math.max(1, Math.min(4, Number(threads) || 1));
    if (session && sessionThreads === n) return session;
    if (!model) return Promise.reject(new Error("no model sent"));
    sessionThreads = n;
    session = ort.InferenceSession.create(new Uint8Array(model), {
        executionProviders: ["cpu"],
        graphOptimizationLevel: "all",
        intraOpNumThreads: n,
        interOpNumThreads: 1,
    });
    session.catch(() => (session = null));
    return session;
}

/** A byte view of a binary message, or null. */
function bytesOf(data) {
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (ArrayBuffer.isView(data))
        return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    return null;
}

function serve(port) {
    let init = null;
    let state = null;
    let sess = null;
    let queue = Promise.resolve();
    let closed = false;
    let awaitingModel = 0;
    const reply = (m) => {
        if (!closed) port.postMessage(JSON.stringify(m));
    };
    const start = (model) => {
        sess = loadSession(model, init.threads);
        sess.then(
            () => reply({ type: "ready", backend: "native" }),
            (err) =>
                reply({ type: "error", message: String(err?.message ?? err) }),
        );
    };
    const freshState = () => {
        const s = new Float32Array(init.stateSize);
        s.set(init.erbNormInit, 0);
        s.set(init.specNormInit, init.erbNormInit.length);
        return s;
    };

    port.on("message", ({ data }) => {
        if (closed) return;
        if (typeof data === "string") {
            let msg = null;
            try {
                msg = JSON.parse(data);
            } catch {
                return;
            }
            if (msg?.type === "init") {
                if (
                    !Number.isInteger(msg.stateSize) ||
                    !Array.isArray(msg.erbNormInit) ||
                    !Array.isArray(msg.specNormInit) ||
                    msg.erbNormInit.length + msg.specNormInit.length >
                        msg.stateSize
                ) {
                    reply({ type: "error", message: "bad init" });
                    return;
                }
                init = msg;
                state = freshState();
                // The model follows, unless the process already has one.
                if (
                    Number.isInteger(msg.modelBytes) &&
                    msg.modelBytes > 0 &&
                    !session
                )
                    awaitingModel = msg.modelBytes;
                else start(null);
            } else if (msg?.type === "reset" && init) {
                queue = queue.then(() => {
                    state = freshState();
                });
            } else if (msg?.type === "close") {
                closed = true;
                port.close();
            }
            return;
        }
        const u8 = bytesOf(data);
        if (!u8) return;
        if (awaitingModel) {
            if (u8.byteLength !== awaitingModel) {
                reply({
                    type: "error",
                    message: "the model didn't arrive whole",
                });
                return;
            }
            awaitingModel = 0;
            start(u8.slice().buffer);
            return;
        }
        if (u8.byteLength !== FRAME_BYTES) return;
        if (!sess) return;
        // Copy out: the view's offset need not be 4-aligned.
        const buf = u8.slice().buffer;
        const seq = new DataView(buf).getInt32(0, true);
        const spec = new Float32Array(buf, 4, BINS * 2);
        const s = sess;
        queue = queue
            .then(async () => {
                const session = await s;
                const out = await session.run({
                    spec: new ort.Tensor("float32", spec, SPEC_SHAPE),
                    state_in: new ort.Tensor("float32", state, [state.length]),
                });
                state = out.state_out.data;
                if (closed) return;
                const ans = new ArrayBuffer(FRAME_BYTES);
                new DataView(ans).setInt32(0, seq, true);
                new Float32Array(ans, 4, BINS * 2).set(out.spec_e.data);
                port.postMessage(ans);
            })
            .catch((err) =>
                reply({ type: "error", message: String(err?.message ?? err) }),
            );
    });
    port.on("close", () => {
        closed = true;
    });
    port.start();
}

process.parentPort.on("message", (e) => {
    if (e.data?.type === "connect" && e.ports?.[0]) serve(e.ports[0]);
});
