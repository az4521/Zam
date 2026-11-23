package moe.crafty.matrix;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Base64;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;

/**
 * Tells intents Zam built itself (notification taps, quick replies, call
 * actions) apart from intents another app sent. MainActivity is exported, so
 * any app can start it with arbitrary extras; the only way to prove an intent
 * is ours is a secret that only this install holds.
 *
 * The secret is 32 random bytes, base64-encoded, generated once per install
 * and kept in a MODE_PRIVATE preferences file (no other app can read it, and
 * backup is off). Every PendingIntent or Intent Zam builds for a notification
 * or call action carries it as {@link #EXTRA}. A receiver acts on the
 * privileged extras (room join/open, send, mark-read, accept, call join,
 * lock-screen wake) only when {@link #isTrusted} says so.
 */
final class TrustedIntent {

    /** Extra name carrying the install secret. */
    static final String EXTRA = "moe.crafty.matrix.trust";

    private static final String PREFS = "zam_intent_trust";
    private static final String KEY_SECRET = "secret";

    private static final Object LOCK = new Object();
    private static volatile String cachedSecret;

    private TrustedIntent() {}

    /** The per-install secret, created on first use. Never null. */
    static String secret(Context context) {
        String s = cachedSecret;
        if (s != null) return s;
        synchronized (LOCK) {
            if (cachedSecret != null) return cachedSecret;
            SharedPreferences prefs = context.getApplicationContext()
                .getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String stored = prefs.getString(KEY_SECRET, null);
            if (stored == null || stored.isEmpty()) {
                byte[] raw = new byte[32];
                new SecureRandom().nextBytes(raw);
                stored = Base64.encodeToString(raw, Base64.NO_WRAP);
                // commit(), not apply(): the stamped PendingIntents must agree
                // with what a later process reads back.
                prefs.edit().putString(KEY_SECRET, stored).commit();
            }
            cachedSecret = stored;
            return stored;
        }
    }

    /** Adds the install secret to an intent Zam is about to hand to the system. */
    static Intent stamp(Context context, Intent intent) {
        if (intent != null) intent.putExtra(EXTRA, secret(context));
        return intent;
    }

    /**
     * True only when the intent carries the install secret. Constant-time
     * compare. A missing extra, or one from an older build, is untrusted.
     */
    static boolean isTrusted(Context context, Intent intent) {
        if (intent == null) return false;
        String got = intent.getStringExtra(EXTRA);
        if (got == null || got.isEmpty()) return false;
        byte[] a = got.getBytes(StandardCharsets.UTF_8);
        byte[] b = secret(context).getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(a, b);
    }
}
