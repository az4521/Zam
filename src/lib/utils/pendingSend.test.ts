import { describe, expect, it } from "vitest";
import { EventStatus } from "matrix-js-sdk";
import { isPendingSendStatus } from "./pendingSend";

describe("isPendingSendStatus", () => {
    it("is true while the SDK is still sending", () => {
        expect(isPendingSendStatus(EventStatus.QUEUED)).toBe(true);
        expect(isPendingSendStatus(EventStatus.ENCRYPTING)).toBe(true);
        expect(isPendingSendStatus(EventStatus.SENDING)).toBe(true);
    });

    it("is false once sent, on failure, and for remote events", () => {
        expect(isPendingSendStatus(EventStatus.SENT)).toBe(false);
        expect(isPendingSendStatus(EventStatus.NOT_SENT)).toBe(false);
        expect(isPendingSendStatus(EventStatus.CANCELLED)).toBe(false);
        expect(isPendingSendStatus(null)).toBe(false);
        expect(isPendingSendStatus(undefined)).toBe(false);
    });
});
