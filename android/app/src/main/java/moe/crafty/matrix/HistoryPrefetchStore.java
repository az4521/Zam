package moe.crafty.matrix;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * On-disk state for HistoryPrefetchPlugin and HistoryPrefetchWorker.
 *
 * Layout, all app-private:
 *   history-prefetch/<sha256(accountKey)>/plan.json
 *   history-prefetch/<sha256(accountKey)>/rooms/<sha256(roomId)>/chain.json
 *   history-prefetch/<sha256(accountKey)>/rooms/<sha256(roomId)>/p<seq>.json
 *
 * A room's chain is the run of prefetched pages not yet taken by the page.
 * `tail` is the token the next fetch starts from (the last page's `end`).
 * `pages[0].from` is where the page's crawler resumes, so setPlan keeps a
 * chain only when that token still matches.
 *
 * Every read and write holds LOCK. Network I/O never does: the worker
 * fetches first, then commits the page under LOCK, and drops it if the
 * chain was replaced in the meantime (its `gen` changed).
 *
 * Native never decrypts anything and never sees keys: pages are the raw
 * JSON the homeserver returned.
 */
final class HistoryPrefetchStore {

    /** One lock for every file touched by the plugin and the worker. */
    static final Object LOCK = new Object();

    static final long STORAGE_CAP_BYTES = 150L * 1024L * 1024L;
    static final int MAX_ROOMS_PER_PLAN = 500;

    private static final String ROOT = "history-prefetch";
    private static final String PLAN_FILE = "plan.json";
    private static final String CHAIN_FILE = "chain.json";

    private HistoryPrefetchStore() {}

    // --- Model -----------------------------------------------------------

    /** A plan for one account. The access token lives only in app-private storage. */
    static final class Plan {
        String accountKey;
        String baseUrl;
        String accessToken;
        String filter;
        int pageSize;
        long savedAt;
        boolean tokenInvalid;
        long lastRunAt;
        String lastError;
        String lastResult;
        List<String> roomIds = new ArrayList<>();
        File dir;

        JSONObject toJson() throws JSONException {
            JSONObject o = new JSONObject();
            o.put("accountKey", accountKey);
            o.put("baseUrl", baseUrl);
            o.put("accessToken", accessToken);
            o.put("filter", filter);
            o.put("pageSize", pageSize);
            o.put("savedAt", savedAt);
            o.put("tokenInvalid", tokenInvalid);
            o.put("lastRunAt", lastRunAt);
            o.put("lastError", lastError == null ? JSONObject.NULL : lastError);
            o.put("lastResult", lastResult == null ? JSONObject.NULL : lastResult);
            o.put("rooms", new JSONArray(roomIds));
            return o;
        }

        static Plan fromJson(JSONObject o, File dir) {
            Plan p = new Plan();
            p.dir = dir;
            p.accountKey = str(o, "accountKey");
            p.baseUrl = str(o, "baseUrl");
            p.accessToken = str(o, "accessToken");
            p.filter = str(o, "filter");
            p.pageSize = o.optInt("pageSize", 100);
            p.savedAt = o.optLong("savedAt", 0L);
            p.tokenInvalid = o.optBoolean("tokenInvalid", false);
            p.lastRunAt = o.optLong("lastRunAt", 0L);
            p.lastError = str(o, "lastError");
            p.lastResult = str(o, "lastResult");
            JSONArray rooms = o.optJSONArray("rooms");
            if (rooms != null) {
                for (int i = 0; i < rooms.length(); i++) {
                    String r = rooms.optString(i, null);
                    if (r != null) p.roomIds.add(r);
                }
            }
            return p;
        }
    }

    /** A page held for a room, in fetch order. */
    static final class PageRef {
        long seq;
        String from;
        String end;
        long fetchedAt;
        long bytes;
    }

    /** A room's prefetch chain. */
    static final class Chain {
        String roomId;
        String gen;
        String startFrom;
        String tail;
        boolean done;
        long nextSeq;
        List<PageRef> pages = new ArrayList<>();

        /** The token the page crawler resumes from. */
        String resume() {
            return pages.isEmpty() ? tail : pages.get(0).from;
        }

        static Chain fresh(String roomId, String from) {
            Chain c = new Chain();
            c.roomId = roomId;
            c.gen = UUID.randomUUID().toString();
            c.startFrom = from;
            c.tail = from;
            return c;
        }

        JSONObject toJson() throws JSONException {
            JSONObject o = new JSONObject();
            o.put("roomId", roomId);
            o.put("gen", gen);
            o.put("startFrom", startFrom);
            o.put("tail", tail);
            o.put("done", done);
            o.put("nextSeq", nextSeq);
            JSONArray arr = new JSONArray();
            for (PageRef p : pages) {
                JSONObject po = new JSONObject();
                po.put("seq", p.seq);
                po.put("from", p.from);
                po.put("end", p.end == null ? JSONObject.NULL : p.end);
                po.put("fetchedAt", p.fetchedAt);
                po.put("bytes", p.bytes);
                arr.put(po);
            }
            o.put("pages", arr);
            return o;
        }

        static Chain fromJson(JSONObject o) {
            Chain c = new Chain();
            c.roomId = str(o, "roomId");
            c.gen = str(o, "gen");
            c.startFrom = str(o, "startFrom");
            c.tail = str(o, "tail");
            c.done = o.optBoolean("done", false);
            c.nextSeq = o.optLong("nextSeq", 0L);
            JSONArray arr = o.optJSONArray("pages");
            if (arr != null) {
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject po = arr.optJSONObject(i);
                    if (po == null) continue;
                    PageRef p = new PageRef();
                    p.seq = po.optLong("seq", 0L);
                    p.from = str(po, "from");
                    p.end = str(po, "end");
                    p.fetchedAt = po.optLong("fetchedAt", 0L);
                    p.bytes = po.optLong("bytes", 0L);
                    c.pages.add(p);
                }
            }
            return c;
        }
    }

    /** One room of a plan as the page sends it: `from` null means skip. */
    static final class RoomStart {
        final String roomId;
        final String from;

        RoomStart(String roomId, String from) {
            this.roomId = roomId;
            this.from = from;
        }
    }

    /** Outcome of committing a fetched page. */
    static final class Commit {
        /** False when the chain was replaced or moved while the page was fetched. */
        boolean stored;
        long bytes;
        boolean done;
    }

    // --- Paths -----------------------------------------------------------

    static File root(Context ctx) {
        return new File(ctx.getFilesDir(), ROOT);
    }

    static File accountDir(Context ctx, String accountKey) {
        return new File(root(ctx), sha256Hex(accountKey));
    }

    static File roomDir(File accountDir, String roomId) {
        return new File(new File(accountDir, "rooms"), sha256Hex(roomId));
    }

    static String sha256Hex(String s) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(d.length * 2);
            for (byte b : d) sb.append(String.format("%02x", b & 0xff));
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            // Every Android runtime ships SHA-256.
            throw new IllegalStateException(e);
        }
    }

    // --- Plans -----------------------------------------------------------

    /** Every saved plan, newest setPlan first. Corrupt plans are skipped. */
    static List<Plan> loadPlans(Context ctx) throws IOException {
        synchronized (LOCK) {
            List<Plan> out = new ArrayList<>();
            File[] dirs = root(ctx).listFiles();
            if (dirs == null) return out;
            for (File d : dirs) {
                Plan p = loadPlan(d);
                if (p != null) out.add(p);
            }
            Collections.sort(out, new Comparator<Plan>() {
                @Override
                public int compare(Plan a, Plan b) {
                    return Long.compare(b.savedAt, a.savedAt);
                }
            });
            return out;
        }
    }

    static Plan loadPlan(File accountDir) throws IOException {
        synchronized (LOCK) {
            String text = readText(new File(accountDir, PLAN_FILE));
            if (text == null) return null;
            try {
                return Plan.fromJson(new JSONObject(text), accountDir);
            } catch (JSONException e) {
                return null;
            }
        }
    }

    static void savePlan(Plan p) throws IOException {
        synchronized (LOCK) {
            try {
                writeText(new File(p.dir, PLAN_FILE), p.toJson().toString());
            } catch (JSONException e) {
                throw new IOException("plan encode failed");
            }
        }
    }

    /**
     * Replace the account's plan. Rooms whose chain already resumes at the
     * plan's `from` keep their pages; every other listed room restarts at
     * `from`; rooms no longer listed lose their pages.
     */
    static void setPlan(Context ctx, Plan incoming, List<RoomStart> rooms) throws IOException {
        synchronized (LOCK) {
            File acct = accountDir(ctx, incoming.accountKey);
            File roomsRoot = new File(acct, "rooms");
            Set<String> keep = new HashSet<>();
            List<String> planRooms = new ArrayList<>();
            for (RoomStart r : rooms) {
                if (planRooms.size() >= MAX_ROOMS_PER_PLAN) break;
                if (r.from == null || r.from.isEmpty() || r.roomId == null || r.roomId.isEmpty()) continue;
                if (planRooms.contains(r.roomId)) continue;
                planRooms.add(r.roomId);
                File rd = roomDir(acct, r.roomId);
                Chain c = loadChain(rd);
                if (c == null || !c.resume().equals(r.from)) {
                    deleteRecursively(rd);
                    saveChain(rd, Chain.fresh(r.roomId, r.from));
                }
                keep.add(rd.getName());
            }
            File[] existing = roomsRoot.listFiles();
            if (existing != null) {
                for (File d : existing) {
                    if (!keep.contains(d.getName())) deleteRecursively(d);
                }
            }
            Plan old = loadPlan(acct);
            if (old != null) {
                // A new token starts a fresh run, but the last run's report stays visible.
                incoming.lastRunAt = old.lastRunAt;
                incoming.lastError = old.lastError;
                incoming.lastResult = old.lastResult;
            }
            incoming.dir = acct;
            incoming.roomIds = planRooms;
            incoming.savedAt = System.currentTimeMillis();
            incoming.tokenInvalid = false;
            savePlan(incoming);
        }
    }

    /** Delete the account's plan and pages. Returns true when another plan remains. */
    static boolean clear(Context ctx, String accountKey) throws IOException {
        synchronized (LOCK) {
            deleteRecursively(accountDir(ctx, accountKey));
            return !loadPlans(ctx).isEmpty();
        }
    }

    static void markTokenInvalid(Plan p, String result) throws IOException {
        synchronized (LOCK) {
            Plan cur = loadPlan(p.dir);
            if (cur == null) return;
            cur.tokenInvalid = true;
            cur.lastRunAt = System.currentTimeMillis();
            cur.lastResult = result;
            savePlan(cur);
        }
    }

    static void recordRun(Plan p, String result, String error) throws IOException {
        synchronized (LOCK) {
            Plan cur = loadPlan(p.dir);
            if (cur == null) return;
            cur.lastRunAt = System.currentTimeMillis();
            cur.lastResult = result;
            cur.lastError = error;
            savePlan(cur);
        }
    }

    // --- Chains and pages ------------------------------------------------

    static Chain loadChain(File roomDir) throws IOException {
        synchronized (LOCK) {
            String text = readText(new File(roomDir, CHAIN_FILE));
            if (text == null) return null;
            try {
                return Chain.fromJson(new JSONObject(text));
            } catch (JSONException e) {
                return null;
            }
        }
    }

    static void saveChain(File roomDir, Chain c) throws IOException {
        synchronized (LOCK) {
            try {
                writeText(new File(roomDir, CHAIN_FILE), c.toJson().toString());
            } catch (JSONException e) {
                throw new IOException("chain encode failed");
            }
        }
    }

    /**
     * Store a fetched page if the chain is still the one it was fetched for
     * (same gen, same tail). The page is {from, end, fetchedAt, chunk}.
     */
    static Commit commitPage(
            File roomDir,
            String gen,
            String from,
            String end,
            JSONArray chunk,
            long fetchedAt) throws IOException {
        synchronized (LOCK) {
            Commit out = new Commit();
            Chain c = loadChain(roomDir);
            if (c == null || !c.gen.equals(gen) || !c.tail.equals(from) || c.done) return out;
            JSONObject page = new JSONObject();
            try {
                page.put("from", from);
                page.put("end", end == null ? JSONObject.NULL : end);
                page.put("fetchedAt", fetchedAt);
                page.put("chunk", chunk);
            } catch (JSONException e) {
                throw new IOException("page encode failed");
            }
            byte[] bytes = page.toString().getBytes(StandardCharsets.UTF_8);
            PageRef ref = new PageRef();
            ref.seq = c.nextSeq;
            String name = pageName(ref.seq);
            writeBytes(new File(roomDir, name), bytes);
            ref.from = from;
            ref.end = end;
            ref.fetchedAt = fetchedAt;
            ref.bytes = bytes.length;
            c.nextSeq++;
            c.pages.add(ref);
            c.tail = end != null ? end : from;
            // Stop when there is no end, or the end is the token just used.
            c.done = end == null || end.equals(from);
            saveChain(roomDir, c);
            out.stored = true;
            out.bytes = bytes.length;
            out.done = c.done;
            return out;
        }
    }

    /** Mark a room finished so it is not fetched again (not joined, not found). */
    static void finishRoom(File roomDir, String gen) throws IOException {
        synchronized (LOCK) {
            Chain c = loadChain(roomDir);
            if (c == null || !c.gen.equals(gen)) return;
            c.done = true;
            saveChain(roomDir, c);
        }
    }

    /**
     * Take the page whose `from` equals the token, drop it and any earlier
     * pages of that room (the crawler has passed them). Null when absent.
     */
    static JSONObject takePage(Context ctx, String accountKey, String roomId, String from) throws IOException {
        synchronized (LOCK) {
            File rd = roomDir(accountDir(ctx, accountKey), roomId);
            Chain c = loadChain(rd);
            if (c == null) return null;
            int idx = -1;
            for (int i = 0; i < c.pages.size(); i++) {
                if (from.equals(c.pages.get(i).from)) {
                    idx = i;
                    break;
                }
            }
            if (idx < 0) return null;
            JSONObject page = null;
            try {
                String text = readText(new File(rd, pageName(c.pages.get(idx).seq)));
                if (text != null) page = new JSONObject(text);
            } catch (JSONException e) {
                page = null;
            }
            for (int i = 0; i <= idx; i++) {
                deleteFile(new File(rd, pageName(c.pages.get(i).seq)));
            }
            c.pages.subList(0, idx + 1).clear();
            saveChain(rd, c);
            return page;
        }
    }

    // --- Worker-facing helpers -------------------------------------------

    /** Total bytes across all accounts, for the storage cap. */
    static long totalBytes(Context ctx) {
        synchronized (LOCK) {
            return sizeOf(root(ctx));
        }
    }

    /** Pages and bytes held for one account, and the rooms still active. */
    static JSONObject status(Context ctx, String accountKey) throws IOException {
        synchronized (LOCK) {
            File acct = accountDir(ctx, accountKey);
            JSONObject out = new JSONObject();
            long pages = 0;
            int rooms = 0;
            File[] roomDirs = new File(acct, "rooms").listFiles();
            if (roomDirs != null) {
                for (File rd : roomDirs) {
                    Chain c = loadChain(rd);
                    if (c == null) continue;
                    pages += c.pages.size();
                    if (!c.done || !c.pages.isEmpty()) rooms++;
                }
            }
            Plan p = loadPlan(acct);
            try {
                out.put("pages", pages);
                out.put("bytes", sizeOf(acct));
                out.put("rooms", rooms);
                out.put("lastRunAt", p == null || p.lastRunAt == 0 ? JSONObject.NULL : (Object) p.lastRunAt);
                out.put("lastError", p == null || p.lastError == null ? JSONObject.NULL : p.lastError);
                out.put("lastResult", p == null || p.lastResult == null ? JSONObject.NULL : p.lastResult);
            } catch (JSONException e) {
                throw new IOException("status encode failed");
            }
            return out;
        }
    }

    // --- Files -----------------------------------------------------------

    private static String pageName(long seq) {
        return "p" + seq + ".json";
    }

    static String str(JSONObject o, String key) {
        Object v = o.opt(key);
        return v instanceof String ? (String) v : null;
    }

    private static long sizeOf(File f) {
        if (f.isFile()) return f.length();
        File[] kids = f.listFiles();
        if (kids == null) return 0;
        long total = 0;
        for (File k : kids) total += sizeOf(k);
        return total;
    }

    static void deleteRecursively(File f) {
        if (f.isDirectory()) {
            File[] kids = f.listFiles();
            if (kids != null) {
                for (File k : kids) deleteRecursively(k);
            }
        }
        //noinspection ResultOfMethodCallIgnored
        f.delete();
    }

    private static void deleteFile(File f) {
        //noinspection ResultOfMethodCallIgnored
        f.delete();
    }

    private static void writeText(File f, String text) throws IOException {
        writeBytes(f, text.getBytes(StandardCharsets.UTF_8));
    }

    /** Write to a temp file and rename, so a reader never sees half a file. */
    private static void writeBytes(File f, byte[] data) throws IOException {
        File dir = f.getParentFile();
        if (dir != null && !dir.isDirectory() && !dir.mkdirs()) {
            throw new IOException("could not create " + dir.getName());
        }
        File tmp = new File(dir, f.getName() + ".tmp");
        try (FileOutputStream out = new FileOutputStream(tmp)) {
            out.write(data);
        }
        if (!tmp.renameTo(f)) {
            if (f.exists() && !f.delete()) throw new IOException("could not replace " + f.getName());
            if (!tmp.renameTo(f)) throw new IOException("could not rename " + f.getName());
        }
    }

    private static String readText(File f) throws IOException {
        if (!f.isFile()) return null;
        try (InputStream in = new FileInputStream(f)) {
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] chunk = new byte[1 << 16];
            int n;
            while ((n = in.read(chunk)) > 0) buf.write(chunk, 0, n);
            return new String(buf.toByteArray(), StandardCharsets.UTF_8);
        }
    }
}
