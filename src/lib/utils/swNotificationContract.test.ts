import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SW = readFileSync(resolve(process.cwd(), "static/sw.js"), "utf8");

/**
 * `static/sw.js` is hand-written and lives outside the bundle, so it cannot be
 * imported and unit-tested. These assertions pin the behaviours that audit
 * finding PRIV-02 depends on, so a future edit that drops one fails here
 * instead of silently leaving a signed-out user's notifications on screen.
 */
describe("static/sw.js notification contract", () => {
    it("defines a single close-every-notification helper", () => {
        expect(SW).toMatch(/function\s+closeAllNotifications\s*\(/);
        // Unscoped: a tag filter here would only close one room's popups.
        expect(SW).toMatch(
            /self\.registration\s*\n?\s*\.getNotifications\(\)\s*\n?\s*\.then/,
        );
    });

    it("closes every notification when the page clears auth", () => {
        const clearAuth = SW.slice(SW.indexOf('=== "CLEAR_AUTH"'));
        const nextBranch = clearAuth.indexOf("else if (event.data?.type");
        // Guard the slice: if CLEAR_AUTH ever became the last branch this would
        // be -1, and slice(0, -1) would hand the rest of the FILE to the expects
        // below — which another branch's code could then satisfy.
        expect(nextBranch).toBeGreaterThan(0);
        const body = clearAuth.slice(0, nextBranch);
        expect(body).toContain("closeAllNotifications()");
        // The credentials must be gone before we spend time on notifications:
        // a rejection in the close path must not skip the token wipe.
        // Presence first: the ordering assertion below passes vacuously on a
        // deleted wipe (-1 < N), and this is the only thing pinning it.
        //
        // Targets the RECORD, not `dbSet("accessToken", null)`: SEC-01 replaced
        // the four per-key writes with one versioned record, and the record is
        // what holds the token now, so it is written first and alone. The
        // legacy per-key wipe still runs after it (LEGACY_SESSION_KEYS), but it
        // is a cleanup for upgraded installs — pinning the ordering on it would
        // pin the wrong thing.
        expect(body).toContain("dbSet(SESSION_KEY, null)");
        expect(body.indexOf("dbSet(SESSION_KEY, null)")).toBeLessThan(
            body.indexOf("closeAllNotifications()"),
        );
        // The pre-record copies must still be cleared, or an upgraded install
        // keeps a second copy of the token at rest right through logout.
        expect(body).toContain("LEGACY_SESSION_KEYS");
    });

    it("accepts a notification-only clear, for an account switch that keeps auth", () => {
        expect(SW).toContain('event.data?.type === "CLEAR_NOTIFICATIONS"');
        // The branch existing is not the contract — it has to actually close.
        const branch = SW.slice(SW.indexOf('=== "CLEAR_NOTIFICATIONS"'));
        const nextBranch = branch.indexOf("else if (event.data?.type");
        expect(nextBranch).toBeGreaterThan(0);
        expect(branch.slice(0, nextBranch)).toContain(
            "closeAllNotifications()",
        );
    });

    it("stamps the posting account onto every notification it shows", () => {
        const show = SW.slice(
            SW.indexOf("self.registration.showNotification("),
        );
        expect(show.slice(0, 500)).toMatch(/data:\s*notificationData\(/);
        expect(SW).toMatch(/function\s+notificationData\s*\(/);
    });

    it("omits the room id when it has no identity, so an unattributable notification is not routable", () => {
        const fn = SW.slice(SW.indexOf("function notificationData("));
        const fnEnd = fn.indexOf("\n}");
        // Same guard as the two above: on -1, slice(0, -1) would hand the rest
        // of the file to the expects below and another function could satisfy
        // them.
        expect(fnEnd).toBeGreaterThan(0);
        const body = fn.slice(0, fnEnd);
        expect(body).toMatch(/if\s*\(\s*!userId\s*\)\s*return\s*\{\s*\}/);
        // …and when it DOES have an identity, that identity is what gets
        // stamped. Without this, dropping `userId` from the returned object
        // would unstamp every notification and every tap would fail open.
        expect(body).toMatch(/userId:\s*userId/);
    });

    it("forwards the posting account on the notification click", () => {
        const click = SW.slice(
            SW.indexOf('addEventListener("notificationclick"'),
        );
        const clickEnd = click.indexOf("self.addEventListener(", 1);
        expect(clickEnd).toBeGreaterThan(0);
        const clickBody = click.slice(0, clickEnd);
        expect(clickBody).toMatch(
            /postMessage\(\{[^}]*type:\s*"OPEN_ROOM"[^}]*userId/s,
        );
    });

    describe("notification quick-actions contract", () => {
        it("posts NOTIF_REPLY with text and userId when handling reply action", () => {
            expect(SW).toMatch(/type:\s*"NOTIF_REPLY"/);
            const replyHandler = SW.slice(
                SW.indexOf("function handleQuickReply("),
            );
            const replyEnd = replyHandler.indexOf(
                "async function handleQuickMarkRead(",
            );
            expect(replyEnd).toBeGreaterThan(0);
            const replyBody = replyHandler.slice(0, replyEnd);
            expect(replyBody).toMatch(/type:\s*"NOTIF_REPLY"/);
            expect(replyBody).toMatch(/text:\s*text/);
            expect(replyBody).toMatch(/userId:\s*userId/);
        });

        it("posts NOTIF_MARK_READ with userId when handling mark-read action", () => {
            expect(SW).toMatch(/type:\s*"NOTIF_MARK_READ"/);
            const markReadHandler = SW.slice(
                SW.indexOf("function handleQuickMarkRead("),
            );
            const markReadEnd = markReadHandler.indexOf(
                "\nself.addEventListener(",
                1,
            );
            expect(markReadEnd).toBeGreaterThan(0);
            const markReadBody = markReadHandler.slice(0, markReadEnd);
            expect(markReadBody).toMatch(/type:\s*"NOTIF_MARK_READ"/);
            expect(markReadBody).toMatch(/userId:\s*userId/);
        });

        it("never sends cleartext messages from SW (E2EE invariant)", () => {
            // The SW must NEVER POST/PUT to /send/m.room.message — message
            // sends always route through the page for crypto-correct handling.
            expect(SW).not.toMatch(/\/send\/m\.room\.message/);
        });

        it("uses mxPost only for read receipts", () => {
            expect(SW).toMatch(/function\s+mxPost\s*\(/);
            // The read-receipt endpoint IS allowed (plaintext receipt when no
            // page is open).
            expect(SW).toMatch(/\/receipt\/m\.read\//);
        });
    });
});
