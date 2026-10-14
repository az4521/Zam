package zam.plugins.dpdfnet;

import android.content.Context;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;
import java.util.HashMap;
import java.util.Map;

import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtSession;
import moe.crafty.matrix.PluginNativeHost;
import moe.crafty.matrix.PluginNativePort;

/**
 * DPDFNet plugin's Android host: Zam loads this class into its process (after
 * the user agreed) and connects one port per mic chain. The model runs on
 * native ONNX Runtime (its .so files ship beside this .dex in lib/).
 * Protocol (src/protocol.ts): JSON-string control messages (init, reset,
 * close; an init with modelBytes is followed by the model as one binary
 * message) and binary frames: int32 sequence number + 481 complex bins as
 * little-endian float32 (re, im), answered in order. One session serves
 * every port; each port's recurrent state is double-buffered in direct
 * buffers that ONNX Runtime reads and writes in place (pinned outputs), so a
 * frame copies only its 4 KB of spectrum. Everything runs on the thread Zam
 * gives the plugin.
 */
public final class Host implements PluginNativeHost {
    private static final String TAG = "ZamDpdfnet";
    private static final int BINS = 481;
    private static final int SPEC_FLOATS = BINS * 2;
    private static final int FRAME_BYTES = 4 + SPEC_FLOATS * 4;
    private static final long[] SPEC_SHAPE = {1, 1, BINS, 2};

    private OrtSession session;
    private int sessionThreads;

    public Host() {}

    @Override
    public void onCreate(Context context, File dir) {}

    @Override
    public void onConnect(PluginNativePort port) {
        port.setListener(new Connection(port));
    }

    @Override
    public void onDestroy() {
        if (session != null) {
            try {
                session.close();
            } catch (Exception ignored) {
            }
            session = null;
        }
    }

    private OrtSession session(byte[] model, int threads) throws Exception {
        if (session != null && (model == null || threads == sessionThreads)) return session;
        if (model == null) throw new IllegalStateException("no model sent");
        if (session != null) session.close();
        OrtSession.SessionOptions opts = new OrtSession.SessionOptions();
        opts.setIntraOpNumThreads(threads);
        // The pool's threads spin between calls by default, burning a core
        // or more for a call every 10 ms.
        opts.addConfigEntry("session.intra_op.allow_spinning", "0");
        opts.addConfigEntry("session.inter_op.allow_spinning", "0");
        opts.setInterOpNumThreads(1);
        opts.setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT);
        session = OrtEnvironment.getEnvironment().createSession(model, opts);
        sessionThreads = threads;
        return session;
    }

    private static FloatBuffer direct(int floats) {
        return ByteBuffer.allocateDirect(floats * 4).order(ByteOrder.nativeOrder()).asFloatBuffer();
    }

    private final class Connection implements PluginNativePort.Listener {
        private final PluginNativePort port;
        private int threads = 1;
        private int awaitingModel = 0;
        private float[] stateInit;
        private int stateSize;
        private final FloatBuffer specIn = direct(SPEC_FLOATS);
        private final FloatBuffer specOut = direct(SPEC_FLOATS);
        private FloatBuffer[] state;
        private OnnxTensor specInT;
        private OnnxTensor specOutT;
        private OnnxTensor[] stateT;
        private int cur = 0;
        private boolean ready = false;
        private boolean closed = false;

        Connection(PluginNativePort port) {
            this.port = port;
        }

        private void reply(String type, String message) {
            try {
                JSONObject m = new JSONObject();
                m.put("type", type);
                if (message != null) m.put("message", message);
                if ("ready".equals(type)) m.put("backend", "native");
                port.post(m.toString());
            } catch (Exception e) {
                Log.w(TAG, "reply failed", e);
            }
        }

        private void freshState() {
            for (FloatBuffer b : state) {
                b.clear();
                b.put(stateInit);
                while (b.hasRemaining()) b.put(0f);
                b.rewind();
            }
            cur = 0;
        }

        private void release() {
            if (specInT != null) specInT.close();
            if (specOutT != null) specOutT.close();
            if (stateT != null) for (OnnxTensor t : stateT) t.close();
            specInT = specOutT = null;
            stateT = null;
        }

        private void init(JSONObject msg) throws Exception {
            threads = Math.max(1, Math.min(4, msg.optInt("threads", 1)));
            stateSize = msg.getInt("stateSize");
            JSONArray erb = msg.getJSONArray("erbNormInit");
            JSONArray spec = msg.getJSONArray("specNormInit");
            if (erb.length() + spec.length() > stateSize) throw new IllegalArgumentException("bad init");
            stateInit = new float[erb.length() + spec.length()];
            for (int i = 0; i < erb.length(); i++) stateInit[i] = (float) erb.getDouble(i);
            for (int i = 0; i < spec.length(); i++)
                stateInit[erb.length() + i] = (float) spec.getDouble(i);
            release();
            state = new FloatBuffer[] {direct(stateSize), direct(stateSize)};
            freshState();
            int modelBytes = msg.optInt("modelBytes", 0);
            if (modelBytes > 0 && session == null) awaitingModel = modelBytes;
            else start(null);
        }

        private void start(byte[] model) {
            try {
                session(model, threads);
                OrtEnvironment env = OrtEnvironment.getEnvironment();
                long[] stateShape = {stateSize};
                specInT = OnnxTensor.createTensor(env, specIn, SPEC_SHAPE);
                specOutT = OnnxTensor.createTensor(env, specOut, SPEC_SHAPE);
                stateT = new OnnxTensor[] {
                    OnnxTensor.createTensor(env, state[0], stateShape),
                    OnnxTensor.createTensor(env, state[1], stateShape),
                };
                ready = true;
                reply("ready", null);
            } catch (Throwable e) {
                Log.w(TAG, "init failed", e);
                reply("error", String.valueOf(e.getMessage()));
            }
        }

        @Override
        public void onMessage(String text) {
            if (closed) return;
            try {
                JSONObject msg = new JSONObject(text);
                switch (msg.optString("type")) {
                    case "init":
                        init(msg);
                        break;
                    case "reset":
                        if (state != null) freshState();
                        break;
                    case "close":
                        closed = true;
                        release();
                        port.close();
                        break;
                    default:
                        break;
                }
            } catch (Throwable e) {
                Log.w(TAG, "control message failed", e);
                reply("error", String.valueOf(e.getMessage()));
            }
        }

        @Override
        public void onMessage(byte[] data) {
            if (closed || data == null) return;
            if (awaitingModel > 0) {
                if (data.length != awaitingModel) {
                    reply("error", "the model didn't arrive whole");
                    return;
                }
                awaitingModel = 0;
                start(data);
                return;
            }
            if (!ready || data.length != FRAME_BYTES) return;
            try {
                ByteBuffer in = ByteBuffer.wrap(data).order(ByteOrder.LITTLE_ENDIAN);
                int seq = in.getInt();
                specIn.clear();
                specIn.put(in.asFloatBuffer());
                specIn.rewind();
                Map<String, OnnxTensor> inputs = new HashMap<>(2);
                inputs.put("spec", specInT);
                inputs.put("state_in", stateT[cur]);
                Map<String, OnnxTensor> outputs = new HashMap<>(2);
                outputs.put("spec_e", specOutT);
                outputs.put("state_out", stateT[1 - cur]);
                session.run(inputs, outputs).close();
                cur = 1 - cur;
                ByteBuffer out = ByteBuffer.allocate(FRAME_BYTES).order(ByteOrder.LITTLE_ENDIAN);
                out.putInt(seq);
                specOut.rewind();
                out.asFloatBuffer().put(specOut);
                port.post(out.array());
            } catch (Throwable e) {
                Log.w(TAG, "frame failed", e);
                reply("error", String.valueOf(e.getMessage()));
            }
        }
    }
}
