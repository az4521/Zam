import { describe, it, expect } from "vitest";
import { checkPusherGateway } from "./pusherVerification";

const EXPECTED = "https://sygnal.example.com/_matrix/push/v1/notify";
const OURS = "moe.crafty.matrix";
const OURS_WEB = "moe.crafty.matrix.webpush";

describe("checkPusherGateway — verify the homeserver routes pushes to our gateway", () => {
    it("reports 'none' when the account has no pushers", () => {
        const r = checkPusherGateway(EXPECTED, [OURS, OURS_WEB], []);
        expect(r.status).toBe("none");
        expect(r.ours).toBe(0);
        expect(r.mismatchedUrls).toEqual([]);
        expect(r.expectedUrl).toBe(EXPECTED);
    });

    it("ignores pushers that belong to OTHER apps entirely", () => {
        const r = checkPusherGateway(EXPECTED, [OURS], [
            { app_id: "im.other.app", url: "https://evil.example/notify" },
        ]);
        // Not our pusher, so it neither counts nor trips a mismatch.
        expect(r.status).toBe("none");
        expect(r.ours).toBe(0);
    });

    it("reports 'verified' when our pusher points at the expected gateway", () => {
        const r = checkPusherGateway(EXPECTED, [OURS, OURS_WEB], [
            { app_id: OURS, url: EXPECTED },
        ]);
        expect(r.status).toBe("verified");
        expect(r.ours).toBe(1);
        expect(r.mismatchedUrls).toEqual([]);
    });

    it("verifies across several of our pushers when all match", () => {
        const r = checkPusherGateway(EXPECTED, [OURS, OURS_WEB], [
            { app_id: OURS, url: EXPECTED },
            { app_id: OURS_WEB, url: EXPECTED },
            { app_id: "im.other.app", url: "https://elsewhere/notify" },
        ]);
        expect(r.status).toBe("verified");
        expect(r.ours).toBe(2);
    });

    it("reports 'mismatch' and the actual URL when the homeserver rerouted us", () => {
        const rogue = "https://rogue.example/_matrix/push/v1/notify";
        const r = checkPusherGateway(EXPECTED, [OURS], [
            { app_id: OURS, url: rogue },
        ]);
        expect(r.status).toBe("mismatch");
        expect(r.ours).toBe(1);
        expect(r.mismatchedUrls).toEqual([rogue]);
    });

    it("treats a missing data.url on our pusher as a mismatch", () => {
        const r = checkPusherGateway(EXPECTED, [OURS], [
            { app_id: OURS, url: undefined },
        ]);
        expect(r.status).toBe("mismatch");
        expect(r.mismatchedUrls.length).toBe(1);
        // A placeholder, not an empty string, so the UI can render it.
        expect(r.mismatchedUrls[0]).not.toBe("");
    });

    it("flags a mismatch even if another of our pushers is correct", () => {
        const rogue = "https://rogue.example/notify";
        const r = checkPusherGateway(EXPECTED, [OURS, OURS_WEB], [
            { app_id: OURS, url: EXPECTED },
            { app_id: OURS_WEB, url: rogue },
        ]);
        expect(r.status).toBe("mismatch");
        expect(r.ours).toBe(2);
        expect(r.mismatchedUrls).toEqual([rogue]);
    });

    it("de-duplicates repeated mismatching URLs", () => {
        const rogue = "https://rogue.example/notify";
        const r = checkPusherGateway(EXPECTED, [OURS], [
            { app_id: OURS, url: rogue },
            { app_id: OURS, url: rogue },
        ]);
        expect(r.status).toBe("mismatch");
        expect(r.mismatchedUrls).toEqual([rogue]);
    });

    it("compares byte-exactly — a trailing-slash difference is a mismatch", () => {
        const r = checkPusherGateway(EXPECTED, [OURS], [
            { app_id: OURS, url: EXPECTED + "/" },
        ]);
        expect(r.status).toBe("mismatch");
    });
});
