import { describe, expect, it, vi } from "vitest";
import {
    adminContactHref,
    classifyLimitError,
    classifyLimitResponse,
    isMediaDownloadUrl,
    isMediaUploadUrl,
    limitWatchingFetch,
    parseRetryAfter,
    usageLimitMessageKey,
    usageLimitNotice,
} from "./usageLimits";

const HS = "https://matrix.example.org";
const UPLOAD = `${HS}/_matrix/media/v3/upload?filename=a.png`;
const SEND = `${HS}/_matrix/client/v3/rooms/!r:x/send/m.room.message/1`;

describe("url kinds", () => {
    it("recognises uploads", () => {
        expect(isMediaUploadUrl(UPLOAD)).toBe(true);
        expect(isMediaUploadUrl(`${HS}/_matrix/media/r0/upload`)).toBe(true);
        expect(isMediaUploadUrl(SEND)).toBe(false);
    });
    it("recognises downloads and thumbnails", () => {
        expect(
            isMediaDownloadUrl(`${HS}/_matrix/client/v1/media/download/s/id`),
        ).toBe(true);
        expect(
            isMediaDownloadUrl(`${HS}/_matrix/media/v3/thumbnail/s/id?w=1`),
        ).toBe(true);
        expect(isMediaDownloadUrl(UPLOAD)).toBe(false);
    });
});

describe("classifyLimitResponse", () => {
    it("server-wide block carries limit_type and admin_contact", () => {
        expect(
            classifyLimitResponse(
                403,
                {
                    errcode: "M_RESOURCE_LIMIT_EXCEEDED",
                    error: "MAU limit",
                    limit_type: "monthly_active_user",
                    admin_contact: "mailto:admin@example.org",
                },
                SEND,
            ),
        ).toEqual({
            kind: "resource",
            limitType: "monthly_active_user",
            adminContact: "mailto:admin@example.org",
            message: "MAU limit",
        });
    });

    it("M_RESOURCE_LIMIT_EXCEEDED on upload is still a server block", () => {
        expect(
            classifyLimitResponse(
                403,
                { errcode: "M_RESOURCE_LIMIT_EXCEEDED" },
                UPLOAD,
            )?.kind,
        ).toBe("resource");
    });

    it("M_USER_LIMIT_EXCEEDED on upload is the upload quota (MSC4326)", () => {
        expect(
            classifyLimitResponse(
                403,
                {
                    errcode: "M_USER_LIMIT_EXCEEDED",
                    error: "Media upload limit exceeded",
                    info_uri: "https://example.org/limits",
                    can_upgrade: true,
                },
                UPLOAD,
            ),
        ).toEqual({
            kind: "mediaQuota",
            infoUri: "https://example.org/limits",
            canUpgrade: true,
            message: "Media upload limit exceeded",
        });
    });

    it("M_USER_LIMIT_EXCEEDED without can_upgrade leaves it unset", () => {
        const s = classifyLimitResponse(
            403,
            { errcode: "M_USER_LIMIT_EXCEEDED", info_uri: "https://x.org" },
            UPLOAD,
        );
        expect(s?.canUpgrade).toBeUndefined();
    });

    it("M_USER_LIMIT_EXCEEDED elsewhere is a resource limit", () => {
        expect(
            classifyLimitResponse(
                403,
                { errcode: "M_USER_LIMIT_EXCEEDED" },
                SEND,
            )?.kind,
        ).toBe("resource");
    });

    it("rate limit prefers Retry-After over retry_after_ms", () => {
        expect(
            classifyLimitResponse(
                429,
                { errcode: "M_LIMIT_EXCEEDED", retry_after_ms: 5000 },
                SEND,
                "2",
            ),
        ).toEqual({ kind: "rateLimited", retryAfterMs: 2000 });
        expect(
            classifyLimitResponse(
                429,
                { errcode: "M_LIMIT_EXCEEDED", retry_after_ms: 5000 },
                SEND,
            )?.retryAfterMs,
        ).toBe(5000);
    });

    it("too large only counts on uploads", () => {
        expect(
            classifyLimitResponse(413, { errcode: "M_TOO_LARGE" }, UPLOAD)
                ?.kind,
        ).toBe("tooLarge");
        expect(
            classifyLimitResponse(413, { errcode: "M_TOO_LARGE" }, SEND),
        ).toBeNull();
    });

    it("ignores other errors and non-object bodies", () => {
        expect(
            classifyLimitResponse(403, { errcode: "M_FORBIDDEN" }, SEND),
        ).toBeNull();
        expect(classifyLimitResponse(403, "nope", SEND)).toBeNull();
        expect(classifyLimitResponse(403, null, SEND)).toBeNull();
    });
});

describe("classifyLimitError", () => {
    it("reads a MatrixError's data", () => {
        const err = Object.assign(new Error("x"), {
            errcode: "M_USER_LIMIT_EXCEEDED",
            httpStatus: 403,
            data: {
                errcode: "M_USER_LIMIT_EXCEEDED",
                info_uri: "https://x.org",
            },
        });
        expect(classifyLimitError(err, UPLOAD)).toMatchObject({
            kind: "mediaQuota",
            infoUri: "https://x.org",
        });
    });
    it("falls back to the top-level errcode", () => {
        expect(
            classifyLimitError(
                { errcode: "M_RESOURCE_LIMIT_EXCEEDED", httpStatus: 403 },
                SEND,
            )?.kind,
        ).toBe("resource");
    });
    it("is null for non-errors", () => {
        expect(classifyLimitError(undefined)).toBeNull();
        expect(classifyLimitError(new Error("network"))).toBeNull();
    });
});

describe("usageLimitNotice", () => {
    it("parses a usage-limit server notice", () => {
        expect(
            usageLimitNotice({
                msgtype: "m.server_notice",
                server_notice_type: "m.server_notice.usage_limit_reached",
                limit_type: "monthly_active_user",
                admin_contact: "mailto:a@b.org",
                body: "This server has exceeded its monthly user limit.",
            }),
        ).toEqual({
            kind: "resource",
            limitType: "monthly_active_user",
            adminContact: "mailto:a@b.org",
            message: "This server has exceeded its monthly user limit.",
        });
    });
    it("ignores other notices and messages", () => {
        expect(
            usageLimitNotice({
                msgtype: "m.server_notice",
                server_notice_type: "m.server_notice.other",
            }),
        ).toBeNull();
        expect(
            usageLimitNotice({
                msgtype: "m.text",
                server_notice_type: "m.server_notice.usage_limit_reached",
            }),
        ).toBeNull();
        expect(usageLimitNotice(undefined)).toBeNull();
    });
});

describe("adminContactHref", () => {
    it("allows mailto:, https: and bare addresses", () => {
        expect(adminContactHref("mailto:a@b.org")).toBe("mailto:a@b.org");
        expect(adminContactHref("https://b.org/help")).toBe(
            "https://b.org/help",
        );
        expect(adminContactHref("a@b.org")).toBe("mailto:a@b.org");
    });
    it("drops anything else", () => {
        expect(adminContactHref("javascript:alert(1)")).toBeUndefined();
        expect(adminContactHref("http://b.org")).toBeUndefined();
        expect(adminContactHref("data:text/html,x")).toBeUndefined();
        expect(adminContactHref(undefined)).toBeUndefined();
    });
});

describe("parseRetryAfter", () => {
    it("parses seconds and HTTP dates", () => {
        expect(parseRetryAfter("3")).toBe(3000);
        const now = Date.parse("2026-01-01T00:00:00Z");
        expect(parseRetryAfter("Thu, 01 Jan 2026 00:00:10 GMT", now)).toBe(
            10_000,
        );
        expect(parseRetryAfter("soon")).toBeUndefined();
        expect(parseRetryAfter(null)).toBeUndefined();
    });
});

describe("usageLimitMessageKey", () => {
    it("picks the text by kind and limit_type", () => {
        expect(usageLimitMessageKey({ kind: "mediaQuota" })).toBe(
            "usageLimits.bannerMediaQuota",
        );
        expect(
            usageLimitMessageKey({
                kind: "resource",
                limitType: "monthly_active_user",
            }),
        ).toBe("usageLimits.bannerMau");
        expect(
            usageLimitMessageKey({
                kind: "resource",
                limitType: "hs_disabled",
            }),
        ).toBe("usageLimits.bannerDisabled");
        expect(usageLimitMessageKey({ kind: "resource" })).toBe(
            "usageLimits.bannerResource",
        );
    });
});

describe("limitWatchingFetch", () => {
    const json = (status: number, body: unknown, headers = {}) =>
        new Response(JSON.stringify(body), {
            status,
            headers: { "content-type": "application/json", ...headers },
        });

    it("reports a limit error and returns the response untouched", async () => {
        const report = vi.fn();
        const f = limitWatchingFetch(
            async () =>
                json(403, {
                    errcode: "M_RESOURCE_LIMIT_EXCEEDED",
                    limit_type: "hs_disabled",
                }),
            report,
        );
        const res = await f(SEND, { method: "PUT" });
        expect(report).toHaveBeenCalledWith(
            expect.objectContaining({
                kind: "resource",
                limitType: "hs_disabled",
            }),
            SEND,
        );
        // The caller can still read the body.
        expect((await res.json()).errcode).toBe("M_RESOURCE_LIMIT_EXCEEDED");
    });

    it("passes Retry-After through", async () => {
        const report = vi.fn();
        const f = limitWatchingFetch(
            async () =>
                json(
                    429,
                    { errcode: "M_LIMIT_EXCEEDED" },
                    { "retry-after": "4" },
                ),
            report,
        );
        await f(SEND);
        expect(report.mock.calls[0][0]).toMatchObject({
            kind: "rateLimited",
            retryAfterMs: 4000,
        });
    });

    it("tells onOk about successes with the method", async () => {
        const onOk = vi.fn();
        const f = limitWatchingFetch(async () => json(200, {}), vi.fn(), onOk);
        await f(SEND, { method: "put" });
        expect(onOk).toHaveBeenCalledWith(SEND, "PUT");
    });

    it("leaves other errors and non-JSON bodies alone", async () => {
        const report = vi.fn();
        const f = limitWatchingFetch(
            async () => new Response("<html>", { status: 403 }),
            report,
        );
        await f(SEND);
        const g = limitWatchingFetch(
            async () => json(404, { errcode: "M_NOT_FOUND" }),
            report,
        );
        await g(SEND);
        expect(report).not.toHaveBeenCalled();
    });

    it("never breaks the request when the body is bad JSON", async () => {
        const report = vi.fn();
        const f = limitWatchingFetch(
            async () =>
                new Response("{bad", {
                    status: 403,
                    headers: { "content-type": "application/json" },
                }),
            report,
        );
        const res = await f(SEND);
        expect(res.status).toBe(403);
        expect(report).not.toHaveBeenCalled();
    });
});
