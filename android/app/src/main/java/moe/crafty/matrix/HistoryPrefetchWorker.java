package moe.crafty.matrix;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import moe.crafty.matrix.HistoryPrefetchStore.Chain;
import moe.crafty.matrix.HistoryPrefetchStore.Commit;
import moe.crafty.matrix.HistoryPrefetchStore.Plan;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.UnsupportedEncodingException;
import java.net.HttpURLConnection;
import java.net.MalformedURLException;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;

/**
 * Prefetches raw (still encrypted) /messages pages for the search index, so
 * the WebView crawler finds them on disk when the app next opens. Native
 * never decrypts anything.
 *
 * Each run walks the saved plans newest first, round-robin over their rooms,
 * and stops at the first budget it hits: 8 minutes, 300 pages, or 150 MB
 * stored across accounts. Requests are paced 500 ms apart.
 *
 * Every request goes through ZamProxy.open, so it follows the same proxy
 * setting as the WebView. A proxy that native code cannot use fails the
 * run instead of going direct.
 */
public class HistoryPrefetchWorker extends Worker {

    static final String PERIODIC_NAME = "history-prefetch-periodic";
    static final String ONCE_NAME = "history-prefetch-once";

    private static final long BUDGET_MS = 8L * 60L * 1000L;
    private static final int MAX_PAGES = 300;
    private static final long PACE_MS = 500L;
    private static final long RETRY_DEFAULT_MS = 5000L;
    private static final long RETRY_CAP_MS = 30000L;
    private static final int MAX_RATE_LIMIT_RETRIES = 3;
    private static final int CONNECT_TIMEOUT = 15000;
    private static final int READ_TIMEOUT = 60000;
    private static final int MAX_BODY = 16 * 1024 * 1024;

    public HistoryPrefetchWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    /** Every 2 h (flex 30 min), on unmetered networks, battery and storage not low. */
    static void enqueuePeriodic(Context ctx) {
        Constraints constraints = new Constraints.Builder()
            .setRequiredNetworkType(NetworkType.UNMETERED)
            .setRequiresBatteryNotLow(true)
            .setRequiresStorageNotLow(true)
            .build();
        PeriodicWorkRequest request = new PeriodicWorkRequest.Builder(
                HistoryPrefetchWorker.class, 2, TimeUnit.HOURS, 30, TimeUnit.MINUTES)
            .setConstraints(constraints)
            .build();
        WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(
            PERIODIC_NAME, ExistingPeriodicWorkPolicy.KEEP, request);
    }

    /** One run soon, on any network, so a fresh plan does not wait two hours. */
    static void enqueueOnce(Context ctx) {
        Constraints constraints = new Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .setRequiresBatteryNotLow(true)
            .build();
        OneTimeWorkRequest request = new OneTimeWorkRequest.Builder(HistoryPrefetchWorker.class)
            .setConstraints(constraints)
            .build();
        WorkManager.getInstance(ctx).enqueueUniqueWork(
            ONCE_NAME, ExistingWorkPolicy.KEEP, request);
    }

    static void cancelPeriodic(Context ctx) {
        WorkManager.getInstance(ctx).cancelUniqueWork(PERIODIC_NAME);
    }

    @NonNull
    @Override
    public Result doWork() {
        try {
            return runOnce();
        } catch (IOException e) {
            return Result.retry();
        }
    }

    /** One page to fetch for one room. */
    private static final class Job {
        final Plan plan;
        final String roomId;
        final File roomDir;
        final String gen;
        int rateLimited;

        Job(Plan plan, String roomId, File roomDir, String gen) {
            this.plan = plan;
            this.roomId = roomId;
            this.roomDir = roomDir;
            this.gen = gen;
        }
    }

    /** A finished request: status and body (null when the body is over MAX_BODY). */
    private static final class Fetch {
        int code;
        String body;
    }

    private Result runOnce() throws IOException {
        Context ctx = getApplicationContext();
        long started = System.nanoTime();

        List<Plan> plans = new ArrayList<>();
        for (Plan p : HistoryPrefetchStore.loadPlans(ctx)) {
            if (!p.tokenInvalid) plans.add(p);
        }
        if (plans.isEmpty()) return Result.success();

        // Plans whose proxy native code cannot honour are skipped, not sent direct.
        List<Plan> usable = new ArrayList<>();
        for (Plan p : plans) {
            URL base;
            try {
                base = new URL(p.baseUrl);
            } catch (MalformedURLException e) {
                HistoryPrefetchStore.recordRun(p, "bad-plan", null);
                continue;
            }
            try {
                ZamProxy.proxyFor(base);
            } catch (IOException e) {
                HistoryPrefetchStore.recordRun(p, "proxy-unsupported", null);
                continue;
            }
            usable.add(p);
        }

        // Round-robin: the first room of every plan, then the second, and so on.
        List<List<Job>> perPlan = new ArrayList<>();
        for (Plan p : usable) {
            List<Job> jobs = new ArrayList<>();
            for (String roomId : p.roomIds) {
                File rd = HistoryPrefetchStore.roomDir(p.dir, roomId);
                Chain c = HistoryPrefetchStore.loadChain(rd);
                if (c == null || c.done) continue;
                jobs.add(new Job(p, roomId, rd, c.gen));
            }
            perPlan.add(jobs);
        }
        ArrayDeque<Job> queue = new ArrayDeque<>();
        for (int round = 0; ; round++) {
            boolean any = false;
            for (List<Job> jobs : perPlan) {
                if (round < jobs.size()) {
                    queue.addLast(jobs.get(round));
                    any = true;
                }
            }
            if (!any) break;
        }

        long bytes = HistoryPrefetchStore.totalBytes(ctx);
        int pages = 0;
        int requests = 0;
        String result = "done";
        String error = null;
        Set<String> invalid = new HashSet<>();

        while (!queue.isEmpty()) {
            if (isStopped()) {
                result = "stopped";
                break;
            }
            if (elapsedMs(started) >= BUDGET_MS) {
                result = "budget-time";
                break;
            }
            if (pages >= MAX_PAGES) {
                result = "budget-pages";
                break;
            }
            if (bytes >= HistoryPrefetchStore.STORAGE_CAP_BYTES) {
                result = "storage-cap";
                break;
            }
            Job job = queue.pollFirst();
            if (job == null) break;
            String acctName = job.plan.dir.getName();
            if (invalid.contains(acctName)) continue;

            if (requests > 0 && !sleepUnlessStopped(PACE_MS)) {
                result = "stopped";
                break;
            }
            requests++;

            // Re-read under the lock: setPlan may have replaced the token or the chain.
            Plan plan = HistoryPrefetchStore.loadPlan(job.plan.dir);
            Chain chain = HistoryPrefetchStore.loadChain(job.roomDir);
            if (plan == null || plan.tokenInvalid || chain == null
                    || !chain.gen.equals(job.gen) || chain.done) {
                continue;
            }
            String token = chain.tail;

            Fetch f = fetch(plan, job.roomId, token);
            if (f.body == null) {
                result = "page-too-large";
                break;
            }

            if (f.code == 200) {
                JSONObject json;
                try {
                    json = new JSONObject(f.body);
                } catch (JSONException e) {
                    result = "bad-response";
                    error = "HTTP 200 with a body that is not JSON";
                    break;
                }
                JSONArray chunk = json.optJSONArray("chunk");
                if (chunk == null) chunk = new JSONArray();
                String end = HistoryPrefetchStore.str(json, "end");
                Commit cm = HistoryPrefetchStore.commitPage(
                    job.roomDir, job.gen, token, end, chunk, System.currentTimeMillis());
                if (!cm.stored) continue; // the chain was replaced while fetching
                pages++;
                bytes += cm.bytes;
                // Only the token decides: an empty chunk mid-history is not the end.
                if (!cm.done) queue.addLast(job);
            } else if (f.code == 429) {
                job.rateLimited++;
                if (job.rateLimited > MAX_RATE_LIMIT_RETRIES) {
                    result = "rate-limited";
                    break;
                }
                if (!sleepUnlessStopped(retryAfterMs(f.body))) {
                    result = "stopped";
                    break;
                }
                queue.addFirst(job);
            } else if (f.code == 401 || (f.code == 403 && "M_UNKNOWN_TOKEN".equals(errcode(f.body)))) {
                invalid.add(acctName);
                HistoryPrefetchStore.markTokenInvalid(job.plan, "token-invalid");
            } else if (f.code == 403 || f.code == 404) {
                // Not joined, left, or gone: this room has nothing more to give.
                HistoryPrefetchStore.finishRoom(job.roomDir, job.gen);
            } else {
                String code = errcode(f.body);
                result = "http-error";
                error = "HTTP " + f.code + (code == null ? "" : " " + code);
                break;
            }
        }

        for (Plan p : usable) {
            String r = invalid.contains(p.dir.getName()) ? "token-invalid" : result;
            HistoryPrefetchStore.recordRun(p, r, error);
        }
        return Result.success();
    }

    /** GET one page with the access token, through ZamProxy like every native request. */
    private static Fetch fetch(Plan p, String roomId, String from) throws IOException {
        URL url = messagesUrl(p.baseUrl, roomId, from, p.pageSize, p.filter);
        HttpURLConnection conn = ZamProxy.open(url);
        try {
            conn.setConnectTimeout(CONNECT_TIMEOUT);
            conn.setReadTimeout(READ_TIMEOUT);
            // A redirect would carry the token to another host.
            conn.setInstanceFollowRedirects(false);
            conn.setRequestProperty("Accept", "application/json");
            conn.setRequestProperty("Authorization", "Bearer " + p.accessToken);
            Fetch f = new Fetch();
            f.code = conn.getResponseCode();
            InputStream in = f.code >= 200 && f.code < 300
                ? conn.getInputStream()
                : conn.getErrorStream();
            f.body = readBody(in);
            return f;
        } finally {
            conn.disconnect();
        }
    }

    static URL messagesUrl(String baseUrl, String roomId, String from, int limit, String filter)
            throws MalformedURLException {
        String base = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        StringBuilder sb = new StringBuilder(base)
            .append("/_matrix/client/v3/rooms/").append(enc(roomId))
            .append("/messages?dir=b&limit=").append(limit)
            .append("&from=").append(enc(from));
        if (filter != null && !filter.isEmpty()) {
            sb.append("&filter=").append(enc(filter));
        }
        return new URL(sb.toString());
    }

    private static String enc(String s) {
        try {
            // "+" is a space only in query strings; keep it encoded as %20 everywhere.
            return URLEncoder.encode(s, StandardCharsets.UTF_8.name()).replace("+", "%20");
        } catch (UnsupportedEncodingException e) {
            throw new IllegalStateException(e);
        }
    }

    /** The body as text, or null when it is over MAX_BODY. */
    private static String readBody(InputStream in) throws IOException {
        if (in == null) return "";
        try (InputStream is = in) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[1 << 14];
            int n;
            while ((n = is.read(buf)) != -1) {
                out.write(buf, 0, n);
                if (out.size() > MAX_BODY) return null;
            }
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        }
    }

    private static long retryAfterMs(String body) {
        try {
            long ms = new JSONObject(body).optLong("retry_after_ms", RETRY_DEFAULT_MS);
            return Math.max(0L, Math.min(ms, RETRY_CAP_MS));
        } catch (JSONException | NullPointerException e) {
            return RETRY_DEFAULT_MS;
        }
    }

    private static String errcode(String body) {
        if (body == null) return null;
        try {
            return HistoryPrefetchStore.str(new JSONObject(body), "errcode");
        } catch (JSONException e) {
            return null;
        }
    }

    private static long elapsedMs(long startedNanos) {
        return (System.nanoTime() - startedNanos) / 1_000_000L;
    }

    /** Sleep for ms, returning false early if the work was stopped. */
    private boolean sleepUnlessStopped(long ms) {
        long endNanos = System.nanoTime() + ms * 1_000_000L;
        while (true) {
            if (isStopped()) return false;
            long leftMs = (endNanos - System.nanoTime()) / 1_000_000L;
            if (leftMs <= 0) return true;
            try {
                Thread.sleep(Math.min(100L, leftMs));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return false;
            }
        }
    }
}
