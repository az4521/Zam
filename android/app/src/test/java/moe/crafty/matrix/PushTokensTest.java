package moe.crafty.matrix;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.json.JSONObject;
import org.junit.Test;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/** Runs on the development JVM (./gradlew :app:testDebugUnitTest). */
public class PushTokensTest {

    private static final String RECORD = "{\"v\":1,\"homeserverUrl\":\"https://hs.example\","
        + "\"accessToken\":\"old\",\"userId\":\"@a:hs.example\",\"deviceId\":\"DEV\","
        + "\"oauth\":{\"clientId\":\"c\",\"issuer\":\"https://auth.example/\"},"
        + "\"accessTokenExpiresAt\":1000}";

    @Test
    public void needsRefreshOnlyForKnownExpiredOAuthTokens() {
        long expiry = 1_000_000L;
        assertFalse(PushTokens.needsRefresh(false, expiry, expiry + 1));
        assertFalse(PushTokens.needsRefresh(true, 0L, Long.MAX_VALUE));
        assertFalse(PushTokens.needsRefresh(true, expiry,
            expiry - PushTokens.EXPIRY_MARGIN_MS - 1));
        assertTrue(PushTokens.needsRefresh(true, expiry, expiry - PushTokens.EXPIRY_MARGIN_MS));
        assertTrue(PushTokens.needsRefresh(true, expiry, expiry + 60_000L));
    }

    @Test
    public void authFailureIs401OrUnknownToken403() {
        assertTrue(PushTokens.isAuthFailure(401, null));
        assertTrue(PushTokens.isAuthFailure(401, "M_UNKNOWN_TOKEN"));
        assertTrue(PushTokens.isAuthFailure(403, "M_UNKNOWN_TOKEN"));
        assertFalse(PushTokens.isAuthFailure(403, "M_FORBIDDEN"));
        assertFalse(PushTokens.isAuthFailure(404, null));
        assertFalse(PushTokens.isAuthFailure(-1, null));
    }

    @Test
    public void withAccessTokenReplacesTokenAndExpiryKeepingTheRest() throws Exception {
        JSONObject o = new JSONObject(PushTokens.withAccessToken(RECORD, "@a:hs.example",
            "new", 5000L));
        assertEquals("new", o.getString("accessToken"));
        assertEquals(5000L, o.getLong("accessTokenExpiresAt"));
        assertEquals("DEV", o.getString("deviceId"));
        assertEquals("c", o.getJSONObject("oauth").getString("clientId"));
        assertEquals(1, o.getInt("v"));
    }

    @Test
    public void withAccessTokenDropsAnUnknownExpiry() throws Exception {
        JSONObject o = new JSONObject(PushTokens.withAccessToken(RECORD, "@a:hs.example",
            "new", 0L));
        assertFalse(o.has("accessTokenExpiresAt"));
    }

    @Test
    public void withAccessTokenRefusesAnotherUsersRecordOrJunk() {
        assertNull(PushTokens.withAccessToken(RECORD, "@b:hs.example", "new", 1L));
        assertNull(PushTokens.withAccessToken("not json", "@a:hs.example", "new", 1L));
        assertNull(PushTokens.withAccessToken(null, "@a:hs.example", "new", 1L));
        assertNull(PushTokens.withAccessToken(RECORD, "@a:hs.example", "", 1L));
    }

    @Test
    public void withAccountAccessTokenTouchesOnlyThatAccount() throws Exception {
        JSONObject map = new JSONObject()
            .put("@a:hs.example", RECORD)
            .put("@b:hs.example", RECORD.replace("@a:", "@b:"));
        String updated = PushTokens.withAccountAccessToken(map.toString(), "@a:hs.example",
            "new", 7L);
        JSONObject o = new JSONObject(updated);
        assertEquals("new", new JSONObject(o.getString("@a:hs.example")).getString("accessToken"));
        assertEquals("old", new JSONObject(o.getString("@b:hs.example")).getString("accessToken"));
        assertNull(PushTokens.withAccountAccessToken(map.toString(), "@c:hs.example", "new", 7L));
        assertNull(PushTokens.withAccountAccessToken("[]", "@a:hs.example", "new", 7L));
    }

    @Test
    public void placeholderIdsCollapseWithoutDuplicates() {
        List<String> ids = PushTokens.addPlaceholderId(null, "$1");
        ids = PushTokens.addPlaceholderId(ids, "$2");
        ids = PushTokens.addPlaceholderId(ids, "$1"); // a re-delivered push
        assertEquals(Arrays.asList("$1", "$2"), ids);
        assertEquals(Collections.singletonList("$2"), PushTokens.withoutPlaceholderId(ids, "$1"));
        assertEquals(ids, PushTokens.withoutPlaceholderId(ids, "$9"));
        assertEquals(Collections.emptyList(), PushTokens.withoutPlaceholderId(null, "$1"));
    }

    @Test
    public void placeholderTextCountsMessages() {
        assertEquals("You have a new message", PushTokens.placeholderText(1));
        assertEquals("You have a new message", PushTokens.placeholderText(0));
        assertEquals("3 new messages", PushTokens.placeholderText(3));
    }

    @Test
    public void idsRoundTripThroughJson() {
        List<String> ids = Arrays.asList("$1", "$2");
        assertEquals(ids, PushTokens.idsFromJson(PushTokens.idsToJson(ids)));
        assertEquals(Collections.emptyList(), PushTokens.idsFromJson("nope"));
        assertEquals(Collections.emptyList(), PushTokens.idsFromJson(null));
        assertEquals(Collections.singletonList("$1"),
            PushTokens.idsFromJson("[\"$1\", 5, null, \"$1\"]"));
    }
}
