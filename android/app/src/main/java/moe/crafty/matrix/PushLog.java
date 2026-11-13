package moe.crafty.matrix;

import android.content.Context;
import android.util.Log;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;

/**
 * What the push service did with each push, kept on disk so it survives the
 * process being killed between pushes. Every early return in
 * MatrixMessagingService.handleMatrixPush used to be silent, so a report of
 * "I get no notifications" had nothing to go on. Read back into the client
 * log export (Settings > Debug Info) through DebugToolsPlugin.getPushLog.
 *
 * Never holds message text, names or tokens: ids are shortened to their last
 * few characters, enough to match a push against the server's logs.
 * (java.io on purpose: java.nio.file is API 26, minSdk is 24.)
 */
final class PushLog {
    private static final String TAG = "ZamPush";
    private static final String FILE = "push-log.txt";
    /** Lines kept after a trim; trimmed once the file passes MAX_LINES. */
    private static final int KEEP_LINES = 300;
    private static final int MAX_LINES = 400;
    private static final Object LOCK = new Object();

    private PushLog() {}

    static String shortId(String id) {
        if (id == null) return "-";
        return id.length() <= 8 ? id : "…" + id.substring(id.length() - 8);
    }

    static void log(Context ctx, String message) {
        Log.i(TAG, message);
        if (ctx == null) return;
        SimpleDateFormat fmt = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        fmt.setTimeZone(TimeZone.getTimeZone("UTC"));
        String line = fmt.format(new Date()) + " " + message.replace('\n', ' ') + "\n";
        synchronized (LOCK) {
            try {
                File file = new File(ctx.getFilesDir(), FILE);
                try (FileOutputStream out = new FileOutputStream(file, true)) {
                    out.write(line.getBytes(StandardCharsets.UTF_8));
                }
                List<String> lines = readLines(file);
                if (lines.size() > MAX_LINES) {
                    StringBuilder kept = new StringBuilder();
                    for (String l : lines.subList(lines.size() - KEEP_LINES, lines.size())) {
                        kept.append(l).append('\n');
                    }
                    try (FileOutputStream out = new FileOutputStream(file, false)) {
                        out.write(kept.toString().getBytes(StandardCharsets.UTF_8));
                    }
                }
            } catch (Throwable ignored) {
                // Logging must never cost a notification.
            }
        }
    }

    static String read(Context ctx) {
        synchronized (LOCK) {
            try {
                File file = new File(ctx.getFilesDir(), FILE);
                if (!file.exists()) return "";
                StringBuilder sb = new StringBuilder();
                for (String l : readLines(file)) sb.append(l).append('\n');
                return sb.toString();
            } catch (Throwable t) {
                return "(push log unreadable: " + t + ")\n";
            }
        }
    }

    private static List<String> readLines(File file) throws java.io.IOException {
        List<String> lines = new ArrayList<>();
        try (BufferedReader in = new BufferedReader(
                new InputStreamReader(new FileInputStream(file), StandardCharsets.UTF_8))) {
            String l;
            while ((l = in.readLine()) != null) lines.add(l);
        }
        return lines;
    }
}
