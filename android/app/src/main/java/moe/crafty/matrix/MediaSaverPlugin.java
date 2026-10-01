package moe.crafty.matrix;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import androidx.annotation.RequiresApi;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * Saves a file the renderer already holds (a fetched / decrypted blob) to
 * shared storage. The WebView has no download manager, so `<a download>` on a
 * blob: URL is a silent no-op on Android; the renderer base64s the bytes and
 * hands them here instead.
 *
 * API 29+: MediaStore, no permission needed. Everything (images included)
 * lands directly in the public Downloads folder. (Its on-disk name is
 * "Download", Environment.DIRECTORY_DOWNLOADS; file managers label it
 * "Downloads".) Below 29 writing shared storage needs a runtime permission,
 * so the file goes to the app's own external Downloads dir instead.
 */
@CapacitorPlugin(name = "MediaSaver")
public class MediaSaverPlugin extends Plugin {

    @PluginMethod
    public void save(PluginCall call) {
        String data = call.getString("data");
        String name = sanitize(call.getString("filename", "file"));
        String mime = call.getString("mimeType", "application/octet-stream");
        if (data == null) {
            call.reject("missing data");
            return;
        }
        final String mimeType = mime == null || mime.isEmpty()
                ? "application/octet-stream"
                : mime;
        getBridge().execute(() -> {
            try {
                byte[] bytes = Base64.decode(data, Base64.DEFAULT);
                String where;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    where = saveMediaStore(bytes, name, mimeType);
                } else {
                    where = saveLegacy(bytes, name);
                }
                JSObject ret = new JSObject();
                ret.put("location", where);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("save failed: " + e.getMessage(), e);
            }
        });
    }

    @RequiresApi(Build.VERSION_CODES.Q)
    private String saveMediaStore(byte[] bytes, String name, String mime) throws Exception {
        ContentResolver resolver = getContext().getContentResolver();
        Uri collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
        String relPath = Environment.DIRECTORY_DOWNLOADS;

        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
        values.put(MediaStore.MediaColumns.MIME_TYPE, mime);
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, relPath);
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);

        Uri uri = resolver.insert(collection, values);
        if (uri == null) throw new IllegalStateException("MediaStore insert returned null");
        try (OutputStream out = resolver.openOutputStream(uri)) {
            if (out == null) throw new IllegalStateException("no output stream");
            out.write(bytes);
        } catch (Exception e) {
            resolver.delete(uri, null, null);
            throw e;
        }
        ContentValues done = new ContentValues();
        done.put(MediaStore.MediaColumns.IS_PENDING, 0);
        resolver.update(uri, done, null, null);
        return relPath;
    }

    private String saveLegacy(byte[] bytes, String name) throws Exception {
        File dir = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (dir == null) throw new IllegalStateException("external storage unavailable");
        if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("mkdir failed");
        File target = uniqueFile(dir, name);
        try (FileOutputStream out = new FileOutputStream(target)) {
            out.write(bytes);
        }
        return target.getAbsolutePath();
    }

    private static File uniqueFile(File dir, String name) {
        File f = new File(dir, name);
        if (!f.exists()) return f;
        int dot = name.lastIndexOf('.');
        String base = dot > 0 ? name.substring(0, dot) : name;
        String ext = dot > 0 ? name.substring(dot) : "";
        for (int i = 1; ; i++) {
            f = new File(dir, base + " (" + i + ")" + ext);
            if (!f.exists()) return f;
        }
    }

    /** Filename only: no path separators or control characters. */
    private static String sanitize(String raw) {
        if (raw == null) return "file";
        String s = raw.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_").trim();
        if (s.isEmpty() || s.equals(".") || s.equals("..")) return "file";
        return s.length() > 200 ? s.substring(s.length() - 200) : s;
    }
}
