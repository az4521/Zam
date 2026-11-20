import { beforeEach, describe, expect, it, vi } from "vitest";

const showToast = vi.fn();
vi.mock("$lib/stores/toasts.svelte", () => ({ showToast }));

const {
    activeUsageLimit,
    dismissUsageLimitBanner,
    noteUsageOk,
    reportUsageLimit,
    resetUsageLimits,
    setUsageLimitNotice,
    usageLimitKey,
    usageLimitsState,
} = await import("./usageLimits.svelte");

const HS = "https://matrix.example.org";
const UPLOAD = `${HS}/_matrix/media/v3/upload`;
const DOWNLOAD = `${HS}/_matrix/client/v1/media/download/s/id`;
const SEND = `${HS}/_matrix/client/v3/rooms/!r:x/send/m.room.message/1`;
const SYNC = `${HS}/_matrix/client/v3/sync?timeout=30000`;

beforeEach(() => {
    resetUsageLimits();
    showToast.mockClear();
});

describe("usage limit store", () => {
    it("a resource limit toasts once and shows in the banner", () => {
        reportUsageLimit({ kind: "resource", limitType: "hs_disabled" }, SEND);
        reportUsageLimit({ kind: "resource", limitType: "hs_disabled" }, SYNC);
        expect(showToast).toHaveBeenCalledTimes(1);
        expect(activeUsageLimit()?.limitType).toBe("hs_disabled");
    });

    it("a successful send or sync lifts an error-derived resource limit", () => {
        reportUsageLimit({ kind: "resource" }, SEND);
        noteUsageOk(`${HS}/_matrix/client/v3/profile/@a:x`, "GET");
        expect(usageLimitsState.resource).not.toBeNull();
        noteUsageOk(SEND, "PUT");
        expect(usageLimitsState.resource).toBeNull();
        reportUsageLimit({ kind: "resource" }, SEND);
        noteUsageOk(SYNC, "GET");
        expect(usageLimitsState.resource).toBeNull();
    });

    it("the upload quota lifts after a successful upload only", () => {
        reportUsageLimit({ kind: "mediaQuota" }, UPLOAD);
        noteUsageOk(SEND, "PUT");
        expect(usageLimitsState.mediaQuota).not.toBeNull();
        noteUsageOk(UPLOAD, "POST");
        expect(usageLimitsState.mediaQuota).toBeNull();
    });

    it("a server block outranks a notice, which outranks the quota", () => {
        reportUsageLimit({ kind: "mediaQuota" }, UPLOAD);
        expect(activeUsageLimit()?.kind).toBe("mediaQuota");
        setUsageLimitNotice({
            kind: "resource",
            limitType: "monthly_active_user",
        });
        expect(activeUsageLimit()?.limitType).toBe("monthly_active_user");
        reportUsageLimit({ kind: "resource", limitType: "hs_disabled" }, SEND);
        expect(activeUsageLimit()?.limitType).toBe("hs_disabled");
    });

    it("rate limits toast only for media transfers, throttled", () => {
        reportUsageLimit({ kind: "rateLimited", retryAfterMs: 2500 }, SEND);
        expect(showToast).not.toHaveBeenCalled();
        reportUsageLimit({ kind: "rateLimited", retryAfterMs: 2500 }, DOWNLOAD);
        reportUsageLimit({ kind: "rateLimited" }, UPLOAD);
        expect(showToast).toHaveBeenCalledTimes(1);
        expect(activeUsageLimit()).toBeNull();
    });

    it("dismissal sticks until the limit changes", () => {
        setUsageLimitNotice({
            kind: "resource",
            limitType: "monthly_active_user",
        });
        dismissUsageLimitBanner();
        expect(usageLimitsState.dismissedKey).toBe(
            usageLimitKey(activeUsageLimit()),
        );
        reportUsageLimit({ kind: "resource", limitType: "hs_disabled" }, SEND);
        expect(usageLimitsState.dismissedKey).not.toBe(
            usageLimitKey(activeUsageLimit()),
        );
    });

    it("clearing the notice removes it", () => {
        setUsageLimitNotice({ kind: "resource" });
        setUsageLimitNotice(null);
        expect(activeUsageLimit()).toBeNull();
    });
});
