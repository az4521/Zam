package moe.crafty.matrix;

import android.content.Context;
import android.net.Uri;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.UUID;

/**
 * Stages a content:// file the user shared or pasted into the app cache, so
 * the web layer can read it from a path instead of a base64 string. A base64
 * copy of a 25 MB file is roughly 160 MB of live Java heap, which OOMs on
 * low-RAM phones; streaming to disk keeps the heap at one 64 KiB buffer.
 *
 * The web side reads a staged file through Capacitor's local file server
 * (Capacitor.convertFileSrc on the path), then calls SharedFilePlugin.release
 * to delete it. Anything it never releases is swept by sweep() on the next
 * app start once it is older than an hour.
 */
final class SharedIncomingFiles {

    private static final String DIR_NAME = "shared-incoming";
    private static final long MAX_AGE_MS = 60L * 60L * 1000L;
    private static final int BUFFER_BYTES = 64 * 1024;

    private SharedIncomingFiles() {}

    /** A file written to the staging folder. */
    static final class Staged {
        final String path;
        final long size;

        Staged(String path, long size) {
            this.path = path;
            this.size = size;
        }
    }

    static File dir(Context context) {
        return new File(context.getCacheDir(), DIR_NAME);
    }

    /**
     * Stream uri into a new file in the staging folder with a fixed buffer.
     * Returns null, leaving no file behind, when the URI is unreadable or the
     * content is over maxBytes. Blocking: call off the UI thread.
     */
    static Staged stage(Context context, Uri uri, long maxBytes) {
        File folder = dir(context);
        if (!folder.isDirectory() && !folder.mkdirs()) return null;
        File file = new File(folder, UUID.randomUUID().toString());
        boolean complete = false;
        try (InputStream in = context.getContentResolver().openInputStream(uri)) {
            if (in == null) return null;
            try (OutputStream out = new FileOutputStream(file)) {
                byte[] buf = new byte[BUFFER_BYTES];
                long total = 0;
                int n;
                while ((n = in.read(buf)) != -1) {
                    total += n;
                    if (total > maxBytes) return null;
                    out.write(buf, 0, n);
                }
            }
            complete = true;
            return new Staged(file.getAbsolutePath(), file.length());
        } catch (Exception e) {
            return null;
        } finally {
            if (!complete) file.delete();
        }
    }

    /**
     * Delete a staged file the web layer has finished with. Only files directly
     * inside the staging folder are removed, so a bad path cannot delete
     * anything else. Returns true when a file was removed.
     */
    static boolean release(Context context, String path) {
        if (path == null || path.isEmpty()) return false;
        try {
            File file = new File(path).getCanonicalFile();
            File folder = dir(context).getCanonicalFile();
            if (!folder.equals(file.getParentFile())) return false;
            return file.delete();
        } catch (IOException e) {
            return false;
        }
    }

    /** Delete staged files older than an hour. Run once per app start. */
    static void sweep(Context context) {
        File[] files = dir(context).listFiles();
        if (files == null) return;
        long cutoff = System.currentTimeMillis() - MAX_AGE_MS;
        for (File file : files) {
            if (file.isFile() && file.lastModified() < cutoff) file.delete();
        }
    }
}
