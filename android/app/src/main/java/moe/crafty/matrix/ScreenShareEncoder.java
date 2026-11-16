package moe.crafty.matrix;

import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.MediaCodec;
import android.media.MediaCodecInfo;
import android.media.MediaCodecList;
import android.media.MediaFormat;
import android.media.projection.MediaProjection;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.HandlerThread;
import android.util.Log;
import android.view.Surface;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * H.264 encoder for the Android screen share (driven by ScreenShareService).
 *
 * A VirtualDisplay mirrors the screen onto the encoder's input Surface. The
 * codec's async callbacks run on this class's own HandlerThread, so nothing
 * here blocks the main thread after {@link #open}. Every access unit is handed
 * to the sink framed for the page: a 13-byte header (flags, pts, w, h) then
 * Annex B, with SPS+PPS prepended to every IDR.
 *
 * Only one VirtualDisplay may exist per MediaProjection on Android 14+, so a
 * size change (rotation) resizes the existing display and rebuilds the codec
 * and its input Surface instead of creating a second display.
 */
final class ScreenShareEncoder {

    interface Sink {
        /** A framed access unit. Called on the encoder thread. */
        void onAccessUnit(byte[] framed);
        /** The encoder was rebuilt at a new size. Encoder thread. */
        void onSize(int width, int height);
        /** The encoder failed for good. Encoder thread. */
        void onFailure(String message);
    }

    static final String TAG = "ZamScreenShare";
    static final int HEADER_BYTES = 13;

    private static final String MIME = MediaFormat.MIMETYPE_VIDEO_AVC;
    private static final int FLAG_KEY = 1;
    private static final int KEY_INTERVAL_S = 3600;
    private static final long REPEAT_PREVIOUS_AFTER_US = 1_000_000L;

    private final Sink sink;
    private final int fps;
    private final int bitrate;
    private final int maxWidth;
    private final int maxHeight;
    private final HandlerThread thread;
    private final Handler handler;
    private final AtomicBoolean released = new AtomicBoolean(false);

    // Chosen once in open(); read-only afterwards.
    private String encoderName;
    private boolean hardware;
    private boolean cbr;
    private int profile;

    // Touched on the main thread only inside open(), then on the encoder thread.
    private MediaProjection projection;
    private VirtualDisplay display;
    private MediaCodec codec;
    private Surface surface;
    private int width;
    private int height;
    private byte[] config;

    ScreenShareEncoder(Sink sink, int fps, int bitrate, int maxWidth, int maxHeight) {
        this.sink = sink;
        this.fps = fps;
        this.bitrate = bitrate;
        this.maxWidth = maxWidth;
        this.maxHeight = maxHeight;
        this.thread = new HandlerThread("ZamScreenShareEnc");
        this.thread.start();
        this.handler = new Handler(thread.getLooper());
    }

    /** Whether the device has an AVC encoder at all. */
    static boolean hasEncoder() {
        return findEncoder() != null;
    }

    private static MediaCodecInfo findEncoder() {
        MediaCodecInfo best = null;
        for (MediaCodecInfo info : new MediaCodecList(MediaCodecList.REGULAR_CODECS).getCodecInfos()) {
            if (!info.isEncoder()) continue;
            boolean supports = false;
            for (String type : info.getSupportedTypes()) {
                if (MIME.equalsIgnoreCase(type)) supports = true;
            }
            if (!supports) continue;
            if (best == null || (isHardware(info) && !isHardware(best))) best = info;
        }
        return best;
    }

    private static boolean isHardware(MediaCodecInfo info) {
        String name = info.getName();
        if (name.startsWith("OMX.google.") || name.startsWith("c2.android.")) return false;
        return Build.VERSION.SDK_INT < 29 || !info.isSoftwareOnly();
    }

    /**
     * Scale (down only) into a box whose long side is max(maxW, maxH) and short
     * side is min(maxW, maxH), oriented like the display (portrait gets the
     * long side vertical). Both sides floored to multiples of 16.
     */
    static int[] fit(int displayW, int displayH, int maxW, int maxH) {
        int longSide = Math.max(maxW, maxH);
        int shortSide = Math.min(maxW, maxH);
        boolean portrait = displayH > displayW;
        int boxW = portrait ? shortSide : longSide;
        int boxH = portrait ? longSide : shortSide;
        double scale = Math.min(1.0, Math.min((double) boxW / displayW, (double) boxH / displayH));
        int w = Math.max(16, ((int) (displayW * scale)) / 16 * 16);
        int h = Math.max(16, ((int) (displayH * scale)) / 16 * 16);
        return new int[] {w, h};
    }

    /**
     * Main thread. Picks the encoder, starts the codec and the VirtualDisplay.
     * The projection's callback must already be registered (Android 14+).
     */
    void open(MediaProjection mp, int displayW, int displayH, int dpi) throws IOException {
        projection = mp;
        pickEncoder();
        int[] size = fit(displayW, displayH, maxWidth, maxHeight);
        width = size[0];
        height = size[1];
        codec = startCodec(width, height);
        display = mp.createVirtualDisplay(
                "ZamScreenShare", width, height, dpi,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR, surface, null, null);
        Log.i(TAG, "encoder " + encoderName + " hw=" + hardware + " " + width + "x" + height
                + " fps=" + fps + " bps=" + bitrate + " profile=" + profile + " cbr=" + cbr);
    }

    private void pickEncoder() throws IOException {
        MediaCodecInfo info = findEncoder();
        if (info == null) throw new IOException("no H.264 encoder on this device");
        encoderName = info.getName();
        hardware = isHardware(info);
        MediaCodecInfo.CodecCapabilities caps = info.getCapabilitiesForType(MIME);
        cbr = caps.getEncoderCapabilities().isBitrateModeSupported(
                MediaCodecInfo.EncoderCapabilities.BITRATE_MODE_CBR);
        profile = 0;
        for (MediaCodecInfo.CodecProfileLevel pl : caps.profileLevels) {
            if (pl.profile == MediaCodecInfo.CodecProfileLevel.AVCProfileConstrainedBaseline) {
                profile = pl.profile;
                break;
            }
            if (pl.profile == MediaCodecInfo.CodecProfileLevel.AVCProfileBaseline) {
                profile = pl.profile;
            }
        }
    }

    /**
     * Configures a codec, retrying with fewer optional keys when an encoder refuses
     * the format (some reject low latency or the profile with a CodecException, which
     * is not an IllegalArgumentException). Each attempt uses a fresh codec.
     */
    private MediaCodec startCodec(int w, int h) throws IOException {
        // {low latency, profile}: the full format first, then fewer optional keys.
        boolean[][] attempts = {{true, true}, {false, true}, {false, false}};
        RuntimeException last = null;
        for (int i = 0; i < attempts.length; i++) {
            MediaCodec c = MediaCodec.createByCodecName(encoderName);
            c.setCallback(callback, handler);
            try {
                c.configure(format(w, h, attempts[i][0], attempts[i][1]), null, null,
                        MediaCodec.CONFIGURE_FLAG_ENCODE);
                surface = c.createInputSurface();
                c.start();
                return c;
            } catch (RuntimeException refused) {
                last = refused;
                Log.w(TAG, "encoder refused format attempt " + i + " (lowLatency=" + attempts[i][0]
                        + " profile=" + attempts[i][1] + "): " + refused.getMessage());
                closeCodec(c);
            }
        }
        throw new IOException("encoder refused every format", last);
    }

    private MediaFormat format(int w, int h, boolean lowLatency, boolean withProfile) {
        MediaFormat f = MediaFormat.createVideoFormat(MIME, w, h);
        f.setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface);
        f.setInteger(MediaFormat.KEY_BIT_RATE, bitrate);
        f.setInteger(MediaFormat.KEY_FRAME_RATE, fps);
        // Frame-rate A/B on the API 35 emulator (moving content, 10 s runs): this hint alone
        // gave ~41 fps for a 30 fps target; no hints ~39; all hints (+ Surface.setFrameRate,
        // KEY_OPERATING_RATE, KEY_PRIORITY) ~41. None of them undershot.
        f.setInteger("max-fps-to-encoder", fps);
        // Keyframes are on demand (requestSync), not on a timer.
        f.setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, KEY_INTERVAL_S);
        f.setInteger(MediaFormat.KEY_BITRATE_MODE, cbr
                ? MediaCodecInfo.EncoderCapabilities.BITRATE_MODE_CBR
                : MediaCodecInfo.EncoderCapabilities.BITRATE_MODE_VBR);
        if (withProfile && profile != 0) f.setInteger(MediaFormat.KEY_PROFILE, profile);
        if (Build.VERSION.SDK_INT >= 28) {
            // Re-send the last frame after a second of a static screen.
            f.setLong(MediaFormat.KEY_REPEAT_PREVIOUS_FRAME_AFTER, REPEAT_PREVIOUS_AFTER_US);
        }
        if (lowLatency && Build.VERSION.SDK_INT >= 30) f.setInteger(MediaFormat.KEY_LOW_LATENCY, 1);
        return f;
    }

    private final MediaCodec.Callback callback = new MediaCodec.Callback() {
        @Override
        public void onInputBufferAvailable(MediaCodec c, int index) {
            // Surface input: never called.
        }

        @Override
        public void onOutputBufferAvailable(MediaCodec c, int index, MediaCodec.BufferInfo info) {
            try {
                drain(c, index, info);
            } catch (Throwable t) {
                Log.w(TAG, "drain failed", t);
            } finally {
                try {
                    c.releaseOutputBuffer(index, false);
                } catch (Throwable ignored) {
                }
            }
        }

        @Override
        public void onOutputFormatChanged(MediaCodec c, MediaFormat f) {
            Log.i(TAG, "output format " + f);
        }

        @Override
        public void onError(MediaCodec c, MediaCodec.CodecException e) {
            Log.w(TAG, "codec error " + e.getDiagnosticInfo(), e);
            if (c == codec && !released.get()) sink.onFailure("encoder error: " + e.getMessage());
        }
    };

    private void drain(MediaCodec c, int index, MediaCodec.BufferInfo info) {
        if (released.get() || c != codec || info.size <= 0) return;
        ByteBuffer out = c.getOutputBuffer(index);
        if (out == null) return;
        out.position(info.offset);
        out.limit(info.offset + info.size);
        byte[] data = new byte[info.size];
        out.get(data);
        if ((info.flags & MediaCodec.BUFFER_FLAG_CODEC_CONFIG) != 0) {
            config = data;
            return;
        }
        boolean key = (info.flags & MediaCodec.BUFFER_FLAG_KEY_FRAME) != 0;
        if (key && config != null && !startsWithSps(data)) data = concat(config, data);
        sink.onAccessUnit(frame(key, info.presentationTimeUs, width, height, data));
    }

    /** Any thread. The next frame is a keyframe. */
    void requestSync() {
        handler.post(() -> {
            MediaCodec c = codec;
            if (c == null || released.get()) return;
            Bundle b = new Bundle();
            b.putInt(MediaCodec.PARAMETER_KEY_REQUEST_SYNC_FRAME, 0);
            try {
                c.setParameters(b);
            } catch (Throwable t) {
                Log.w(TAG, "requestSync failed", t);
            }
        });
    }

    /** Any thread. Changes the target bitrate. */
    void setBitrate(int bps) {
        handler.post(() -> {
            MediaCodec c = codec;
            if (c == null || released.get()) return;
            Bundle b = new Bundle();
            b.putInt(MediaCodec.PARAMETER_KEY_VIDEO_BITRATE, bps);
            try {
                c.setParameters(b);
            } catch (Throwable t) {
                Log.w(TAG, "setBitrate failed", t);
            }
        });
    }

    int width() {
        return width;
    }

    int height() {
        return height;
    }

    String encoderName() {
        return encoderName;
    }

    boolean hardware() {
        return hardware;
    }

    /** Handler on the encoder thread: where port callbacks run. */
    Handler handler() {
        return handler;
    }

    /**
     * Main thread. The display changed size (rotation). Re-fits and, if the
     * size actually changed, rebuilds the codec on the encoder thread.
     */
    void resize(int displayW, int displayH, int dpi) {
        int[] s = fit(displayW, displayH, maxWidth, maxHeight);
        handler.post(() -> rebuild(s[0], s[1], dpi));
    }

    private void rebuild(int w, int h, int dpi) {
        if (released.get() || (w == width && h == height)) return;
        try {
            display.setSurface(null);
            MediaCodec old = codec;
            Surface oldSurface = surface;
            codec = null; // callbacks from the old codec are ignored from here on
            closeCodec(old);
            if (oldSurface != null) oldSurface.release();
            config = null;
            width = w;
            height = h;
            codec = startCodec(w, h);
            display.resize(w, h, dpi);
            display.setSurface(surface);
            Log.i(TAG, "rebuilt encoder at " + w + "x" + h);
            sink.onSize(w, h);
        } catch (Throwable t) {
            Log.w(TAG, "rebuild failed", t);
            sink.onFailure("could not rebuild the encoder: " + t.getMessage());
        }
    }

    /** Any thread. Stops the codec and the display; the encoder thread exits. */
    void release() {
        if (!released.compareAndSet(false, true)) return;
        handler.post(() -> {
            try {
                if (display != null) display.release();
            } catch (Throwable ignored) {
            }
            display = null;
            closeCodec(codec);
            codec = null;
            if (surface != null) surface.release();
            surface = null;
            thread.quitSafely();
            Log.i(TAG, "encoder released");
        });
    }

    private static void closeCodec(MediaCodec c) {
        if (c == null) return;
        try {
            c.stop();
        } catch (Throwable ignored) {
        }
        try {
            c.release();
        } catch (Throwable ignored) {
        }
    }

    static boolean startsWithSps(byte[] d) {
        int i;
        if (d.length >= 4 && d[0] == 0 && d[1] == 0 && d[2] == 0 && d[3] == 1) i = 4;
        else if (d.length >= 3 && d[0] == 0 && d[1] == 0 && d[2] == 1) i = 3;
        else return false;
        return i < d.length && (d[i] & 0x1f) == 7;
    }

    static byte[] concat(byte[] a, byte[] b) {
        byte[] out = new byte[a.length + b.length];
        System.arraycopy(a, 0, out, 0, a.length);
        System.arraycopy(b, 0, out, a.length, b.length);
        return out;
    }

    static byte[] frame(boolean key, long ptsUs, int w, int h, byte[] payload) {
        ByteBuffer b = ByteBuffer.allocate(HEADER_BYTES + payload.length).order(ByteOrder.LITTLE_ENDIAN);
        b.put((byte) (key ? FLAG_KEY : 0));
        b.putLong(ptsUs);
        b.putShort((short) w);
        b.putShort((short) h);
        b.put(payload);
        return b.array();
    }
}
