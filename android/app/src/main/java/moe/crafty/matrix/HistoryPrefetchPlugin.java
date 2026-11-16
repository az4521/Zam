package moe.crafty.matrix;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * Capacitor side of the background history prefetch (see
 * HistoryPrefetchWorker). The page talks to it through
 * src/lib/matrix/historyPrefetch.ts.
 *
 * The access token is written to app-private storage so the worker can run
 * without the app open. It is never logged or echoed back.
 */
@CapacitorPlugin(name = "HistoryPrefetch")
public class HistoryPrefetchPlugin extends Plugin {

    private static final int DEFAULT_PAGE_SIZE = 100;
    private static final int MIN_PAGE_SIZE = 10;
    private static final int MAX_PAGE_SIZE = 500;

    /**
     * Replace the account's plan. Args: accountKey, baseUrl, accessToken,
     * filter (JSON string), pageSize, rooms: [{ roomId, from }]. Rooms with a
     * null `from` are skipped.
     */
    @PluginMethod
    public void setPlan(PluginCall call) {
        String accountKey = call.getString("accountKey", "");
        String baseUrl = call.getString("baseUrl", "");
        String accessToken = call.getString("accessToken", "");
        if (accountKey.isEmpty() || accessToken.isEmpty()
                || !(baseUrl.startsWith("https://") || baseUrl.startsWith("http://"))) {
            call.reject("history prefetch: bad plan");
            return;
        }
        int pageSize = clamp(call.getInt("pageSize", DEFAULT_PAGE_SIZE), MIN_PAGE_SIZE, MAX_PAGE_SIZE);

        List<HistoryPrefetchStore.RoomStart> rooms = new ArrayList<>();
        JSONArray arr = call.getArray("rooms");
        if (arr != null) {
            for (int i = 0; i < arr.length() && rooms.size() < HistoryPrefetchStore.MAX_ROOMS_PER_PLAN; i++) {
                JSONObject r = arr.optJSONObject(i);
                if (r == null) continue;
                String roomId = r.optString("roomId", "");
                Object from = r.opt("from");
                String fromToken = from instanceof String ? (String) from : null;
                rooms.add(new HistoryPrefetchStore.RoomStart(roomId, fromToken));
            }
        }

        HistoryPrefetchStore.Plan plan = new HistoryPrefetchStore.Plan();
        plan.accountKey = accountKey;
        plan.baseUrl = stripTrailingSlash(baseUrl);
        plan.accessToken = accessToken;
        plan.filter = call.getString("filter", "");
        plan.pageSize = pageSize;

        try {
            HistoryPrefetchStore.setPlan(getContext(), plan, rooms);
        } catch (IOException e) {
            call.reject("history prefetch: could not save the plan");
            return;
        }
        HistoryPrefetchWorker.enqueuePeriodic(getContext());
        HistoryPrefetchWorker.enqueueOnce(getContext());
        call.resolve();
    }

    /**
     * Take the prefetched page for a room whose `from` equals the given
     * token. Resolves { found: false } when there is none. A found page
     * resolves { found: true, chunk: <JSON array text>, end, fetchedAt }, and
     * is deleted from storage once read.
     */
    @PluginMethod
    public void takePage(PluginCall call) {
        String accountKey = call.getString("accountKey", "");
        String roomId = call.getString("roomId", "");
        String from = call.getString("from", "");
        if (accountKey.isEmpty() || roomId.isEmpty() || from.isEmpty()) {
            JSObject none = new JSObject();
            none.put("found", false);
            call.resolve(none);
            return;
        }
        JSONObject page;
        try {
            page = HistoryPrefetchStore.takePage(getContext(), accountKey, roomId, from);
        } catch (IOException e) {
            call.reject("history prefetch: could not read the page");
            return;
        }
        JSObject ret = new JSObject();
        if (page == null) {
            ret.put("found", false);
            call.resolve(ret);
            return;
        }
        JSONArray chunk = page.optJSONArray("chunk");
        String end = HistoryPrefetchStore.str(page, "end");
        ret.put("found", true);
        ret.put("chunk", chunk == null ? "[]" : chunk.toString());
        ret.put("end", end == null ? JSObject.NULL : end);
        ret.put("fetchedAt", page.optLong("fetchedAt", 0L));
        call.resolve(ret);
    }

    /**
     * Delete the account's plan and pages. The periodic work is cancelled
     * once no plan is left.
     */
    @PluginMethod
    public void clear(PluginCall call) {
        String accountKey = call.getString("accountKey", "");
        if (accountKey.isEmpty()) {
            call.resolve();
            return;
        }
        try {
            boolean remaining = HistoryPrefetchStore.clear(getContext(), accountKey);
            if (!remaining) HistoryPrefetchWorker.cancelPeriodic(getContext());
        } catch (IOException e) {
            call.reject("history prefetch: could not clear");
            return;
        }
        call.resolve();
    }

    /** { pages, bytes, rooms, lastRunAt, lastError, lastResult } for one account. */
    @PluginMethod
    public void status(PluginCall call) {
        String accountKey = call.getString("accountKey", "");
        try {
            JSONObject s = HistoryPrefetchStore.status(getContext(), accountKey);
            call.resolve(new JSObject(s.toString()));
        } catch (IOException | JSONException e) {
            call.reject("history prefetch: could not read the status");
        }
    }

    private static int clamp(int v, int lo, int hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    private static String stripTrailingSlash(String s) {
        return s.endsWith("/") ? s.substring(0, s.length() - 1) : s;
    }
}
