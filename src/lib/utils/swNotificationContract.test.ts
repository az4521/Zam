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
        expect(body.indexOf('dbSet("accessToken", null)')).toBeLessThan(
            body.indexOf("closeAllNotifications()"),
        );
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
        const body = fn.slice(0, fn.indexOf("\n}"));
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
        expect(click.slice(0, 1200)).toMatch(
            /postMessage\(\{[^}]*type:\s*"OPEN_ROOM"[^}]*userId/s,
        );
    });
});
