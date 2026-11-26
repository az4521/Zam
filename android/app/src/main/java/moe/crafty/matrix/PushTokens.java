package moe.crafty.matrix;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Pure helpers for MatrixMessagingService: when the mirrored OAuth access
 * token needs refreshing, how a refreshed one is written back into the stored
 * records, and how generic placeholder lines collapse. No Android types, so
 * they run in the JVM unit tests (PushTokensTest).
 */
final class PushTokens {
    private PushTokens() {}

    /**
     * Refresh this long before the stated expiry: a token that is about to
     * run out would die halfway through the push's requests.
     */
    static final long EXPIRY_MARGIN_MS = 30000L;

    /**
     * Whether the mirrored token is known to be expired (or about to be). Only
     * OAuth sessions expire; 0 means the expiry is unknown, and then only a
     * request refused with 401 tells.
     */
    static boolean needsRefresh(boolean oauth, long expiresAt, long now) {
        return oauth && expiresAt > 0 && now >= expiresAt - EXPIRY_MARGIN_MS;
    }

    /**
     * Whether a homeserver answer means the access token is not accepted:
     * 401, or a 403 carrying M_UNKNOWN_TOKEN (older servers).
     */
    static boolean isAuthFailure(int status, String errcode) {
        return status == 401 || (status == 403 && "M_UNKNOWN_TOKEN".equals(errcode));
    }

    /**
     * One stored record string with a new access token (and its expiry, or
     * none when expiresAt is 0). Null when the record is not JSON or belongs
     * to another user: then it is left as it is.
     */
    static String withAccessToken(String record, String userId, String token, long expiresAt) {
        if (record == null || userId == null || token == null || token.isEmpty()) return null;
        try {
            JSONObject o = new JSONObject(record);
            if (!userId.equals(o.opt("userId"))) return null;
            o.put("accessToken", token);
            if (expiresAt > 0) o.put("accessTokenExpiresAt", expiresAt);
            else o.remove("accessTokenExpiresAt");
            return o.toString();
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * The all-accounts map with one account's record given a new access
     * token. Null when the map is unreadable or holds no record for the user.
     */
    static String withAccountAccessToken(String map, String userId, String token,
            long expiresAt) {
        if (map == null || userId == null) return null;
        try {
            JSONObject o = new JSONObject(map);
            Object entry = o.opt(userId);
            if (!(entry instanceof String)) return null;
            String updated = withAccessToken((String) entry, userId, token, expiresAt);
            if (updated == null) return null;
            o.put(userId, updated);
            return o.toString();
        } catch (Exception e) {
            return null;
        }
    }

    // ── Placeholder lines ──────────────────────────────────────────────────

    /**
     * The event ids one collapsed placeholder line stands for, after a push
     * for `eventId` that could not be read: the ids already there plus this
     * one (once). Kept as a list so a later push that does read one of them
     * can take it back out (withoutPlaceholderId).
     */
    static List<String> addPlaceholderId(List<String> ids, String eventId) {
        List<String> out = new ArrayList<>();
        if (ids != null) {
            for (String id : ids) if (id != null && !out.contains(id)) out.add(id);
        }
        if (eventId != null && !out.contains(eventId)) out.add(eventId);
        return out;
    }

    /** The ids without `eventId`: that message is now shown for real. */
    static List<String> withoutPlaceholderId(List<String> ids, String eventId) {
        List<String> out = new ArrayList<>();
        if (ids == null) return out;
        for (String id : ids) if (id != null && !id.equals(eventId)) out.add(id);
        return out;
    }

    /** The text of the collapsed placeholder line for `count` unread messages. */
    static String placeholderText(int count) {
        return count <= 1 ? "You have a new message" : count + " new messages";
    }

    /** JSON array string of ids, for a line's extras. */
    static String idsToJson(List<String> ids) {
        JSONArray a = new JSONArray();
        if (ids != null) for (String id : ids) a.put(id);
        return a.toString();
    }

    /** Inverse of idsToJson; an empty list for null or malformed input. */
    static List<String> idsFromJson(String json) {
        List<String> out = new ArrayList<>();
        if (json == null) return out;
        try {
            JSONArray a = new JSONArray(json);
            for (int i = 0; i < a.length(); i++) {
                Object v = a.opt(i);
                if (v instanceof String && !out.contains(v)) out.add((String) v);
            }
        } catch (Exception ignored) {}
        return out;
    }
}
