package moe.crafty.matrix;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.ParcelFileDescriptor;
import android.os.StatFs;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.webkit.WebView;

import androidx.annotation.RequiresApi;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebMessageCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.RandomAccessFile;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Streams a direct file transfer (src/lib/matrix/fileTransfer.ts) to shared
 * storage, one block at a time and in whatever order blocks land, so a file
 * larger than memory fits. {@link MediaSaverPlugin} needs the whole file at once.
 *
 * API 29+: a pending MediaStore entry, which nothing else can see until the
 * file has passed its hash check. Below 29: a .part file in the app's own
 * external Downloads dir, renamed at the end.
 *
 * Blocks come over a binary WebView message channel where the WebView has one.
 * The Capacitor bridge carries a megabyte of base64 JSON in about 200 ms, which
 * caps a transfer near 4 MB/s, so {@link #write} is only the fallback.
 */
@CapacitorPlugin(name = "FileTransfer")
public class FileTransferPlugin extends Plugin {

    private static final String TAG = "FileTransfer";
    private static final String STORAGE_FULL = "STORAGE_FULL";
    /** The page's name for the channel (see fileTransferSink.ts). */
    private static final String BLOCK_CHANNEL = "zamFileBlocks";
    /** Sequence number, position, then the transfer's UUID. */
    private static final int BLOCK_ID_BYTES = 36;
    private static final int BLOCK_HEADER_BYTES = 4 + 8 + BLOCK_ID_BYTES;
    /** Space left over, so a transfer can't fill the device to the last byte. */
    private static final long SPARE_BYTES = 64L * 1024L * 1024L;

    private static final class Target {
        FileChannel channel;
        AutoCloseable owner;
        Uri uri;
        File part;
        File destination;
    }

    private final Map<String, Target> targets = new ConcurrentHashMap<>();

    @Override
    public void load() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)
                || !WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_ARRAY_BUFFER)) {
            return;
        }
        try {
            WebViewCompat.addWebMessageListener(
                    getBridge().getWebView(),
                    BLOCK_CHANNEL,
                    Collections.singleton(getBridge().getLocalUrl()),
                    this::onBlock);
        } catch (RuntimeException e) {
            Log.w(TAG, "no binary channel", e);
        }
    }

    private void onBlock(
            WebView view,
            WebMessageCompat message,
            Uri origin,
            boolean isMainFrame,
            JavaScriptReplyProxy reply) {
        // The app's own page: a plugin's frame has no business here.
        if (!isMainFrame || message.getType() != WebMessageCompat.TYPE_ARRAY_BUFFER) return;
        byte[] bytes = message.getArrayBuffer();
        if (bytes.length < BLOCK_HEADER_BYTES) return;
        ByteBuffer frame = ByteBuffer.wrap(bytes);
        int sequence = frame.getInt();
        long position = frame.getLong();
        String id = new String(bytes, frame.position(), BLOCK_ID_BYTES, StandardCharsets.US_ASCII);
        frame.position(BLOCK_HEADER_BYTES);
        Target target = targets.get(id);
        getBridge().execute(() -> {
            String outcome = "failed";
            if (target != null) {
                try {
                    writeAt(target, frame, position);
                    outcome = "ok";
                } catch (Exception e) {
                    outcome = isDiskFull(e) ? STORAGE_FULL : "failed";
                }
            }
            String answer = sequence + ":" + outcome;
            view.post(() -> reply.postMessage(answer));
        });
    }

    private static void writeAt(Target target, ByteBuffer data, long position) throws Exception {
        long at = position;
        while (data.hasRemaining()) at += target.channel.write(data, at);
    }

    private static boolean isDiskFull(Exception e) {
        return e.getMessage() != null && e.getMessage().contains("ENOSPC");
    }

    @PluginMethod
    public void open(PluginCall call) {
        String name = MediaSaverPlugin.sanitize(call.getString("filename", "file"));
        String mime = call.getString("mimeType", "application/octet-stream");
        long size = call.getData().optLong("size", 0);
        getBridge().execute(() -> {
            try {
                File volume = Environment.getExternalStorageDirectory();
                if (new StatFs(volume.getPath()).getAvailableBytes() < size + SPARE_BYTES) {
                    call.reject("not enough space", STORAGE_FULL);
                    return;
                }
                Target target = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                        ? openMediaStore(name, mime)
                        : openLegacy(name);
                String id = UUID.randomUUID().toString();
                targets.put(id, target);
                JSObject ret = new JSObject();
                ret.put("id", id);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("open failed: " + e.getMessage(), e);
            }
        });
    }

    @PluginMethod
    public void write(PluginCall call) {
        Target target = targets.get(call.getString("id", ""));
        String data = call.getString("data");
        long position = call.getData().optLong("position", -1);
        if (target == null || data == null || position < 0) {
            call.reject("bad write");
            return;
        }
        getBridge().execute(() -> {
            try {
                writeAt(target, ByteBuffer.wrap(Base64.decode(data, Base64.DEFAULT)), position);
                call.resolve();
            } catch (Exception e) {
                call.reject("write failed: " + e.getMessage(), isDiskFull(e) ? STORAGE_FULL : null, e);
            }
        });
    }

    @PluginMethod
    public void finish(PluginCall call) {
        Target target = targets.remove(call.getString("id", ""));
        if (target == null) {
            call.reject("unknown transfer");
            return;
        }
        getBridge().execute(() -> {
            try {
                target.channel.force(true);
                target.channel.close();
                target.owner.close();
                if (target.uri != null) {
                    ContentValues done = new ContentValues();
                    done.put(MediaStore.MediaColumns.IS_PENDING, 0);
                    resolver().update(target.uri, done, null, null);
                } else if (!target.part.renameTo(target.destination)) {
                    throw new IllegalStateException("rename failed");
                }
                call.resolve();
            } catch (Exception e) {
                discard(target);
                call.reject("finish failed: " + e.getMessage(), e);
            }
        });
    }

    @PluginMethod
    public void abort(PluginCall call) {
        Target target = targets.remove(call.getString("id", ""));
        if (target == null) {
            call.resolve();
            return;
        }
        getBridge().execute(() -> {
            discard(target);
            call.resolve();
        });
    }

    @PluginMethod
    public void keepRunning(PluginCall call) {
        try {
            FileTransferService.hold(getContext());
            call.resolve();
        } catch (Throwable t) {
            // e.g. ForegroundServiceStartNotAllowedException, from the
            // background: the transfer still runs while the app is on screen.
            call.reject("can't start: " + t.getMessage());
        }
    }

    @PluginMethod
    public void letStop(PluginCall call) {
        FileTransferService.release(getContext());
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        for (Target target : targets.values()) discard(target);
        targets.clear();
    }

    private ContentResolver resolver() {
        return getContext().getContentResolver();
    }

    private void discard(Target target) {
        try {
            target.channel.close();
        } catch (Exception ignored) {
            // Being thrown away either way.
        }
        try {
            target.owner.close();
        } catch (Exception ignored) {
            // Being thrown away either way.
        }
        if (target.uri != null) resolver().delete(target.uri, null, null);
        else target.part.delete();
    }

    @RequiresApi(Build.VERSION_CODES.Q)
    private Target openMediaStore(String name, String mime) throws Exception {
        Uri collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
        values.put(MediaStore.MediaColumns.MIME_TYPE, mime);
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);
        Uri uri = resolver().insert(collection, values);
        if (uri == null) throw new IllegalStateException("MediaStore insert returned null");
        ParcelFileDescriptor descriptor = resolver().openFileDescriptor(uri, "rw");
        if (descriptor == null) {
            resolver().delete(uri, null, null);
            throw new IllegalStateException("no file descriptor");
        }
        Target target = new Target();
        target.uri = uri;
        target.owner = descriptor;
        target.channel = new ParcelFileDescriptor.AutoCloseOutputStream(descriptor).getChannel();
        return target;
    }

    private Target openLegacy(String name) throws Exception {
        File dir = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (dir == null) throw new IllegalStateException("external storage unavailable");
        if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("mkdir failed");
        Target target = new Target();
        target.destination = MediaSaverPlugin.uniqueFile(dir, name);
        target.part = new File(dir, target.destination.getName() + ".part");
        RandomAccessFile file = new RandomAccessFile(target.part, "rw");
        target.owner = file;
        target.channel = file.getChannel();
        return target;
    }
}
