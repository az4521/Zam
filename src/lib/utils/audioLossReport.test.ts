import { describe, expect, it } from "vitest";
import {
    LOSS_REPORT_REPEAT_MS,
    LOSS_REPORT_TTL_MS,
    ReportedLoss,
    decodeLossReport,
    encodeLossReport,
    nextLossReport,
} from "./audioLossReport";

describe("loss report encoding", () => {
    it("round-trips", () => {
        expect(decodeLossReport(encodeLossReport(0.0734))).toBe(0.073);
    });
    it("clamps and rejects junk", () => {
        expect(decodeLossReport(encodeLossReport(3))).toBe(1);
        expect(decodeLossReport(new TextEncoder().encode("nope"))).toBeNull();
        expect(
            decodeLossReport(new TextEncoder().encode('{"loss":"x"}')),
        ).toBeNull();
        expect(decodeLossReport(new Uint8Array(500))).toBeNull();
    });
});

describe("nextLossReport", () => {
    const none = { loss: 0, at: 0 };
    it("stays quiet on a clean link", () => {
        expect(nextLossReport(0.002, none, 1000)).toBeNull();
        expect(nextLossReport(null, none, 1000)).toBeNull();
    });
    it("reports the first loss, changes, repeats and the clear", () => {
        expect(nextLossReport(0.05, none, 1000)).toBe(0.05);
        const last = { loss: 0.05, at: 1000 };
        expect(nextLossReport(0.052, last, 2000)).toBeNull();
        expect(nextLossReport(0.08, last, 2000)).toBe(0.08);
        expect(nextLossReport(0.05, last, 1000 + LOSS_REPORT_REPEAT_MS)).toBe(
            0.05,
        );
        expect(nextLossReport(0, last, 2000)).toBe(0);
    });
});

describe("ReportedLoss", () => {
    it("takes the worst fresh report and drops old ones", () => {
        const r = new ReportedLoss();
        r.note("@a", 0.03, 0);
        r.note("@b", 0.09, 1000);
        expect(r.worst(2000)).toBe(0.09);
        expect(r.worst(LOSS_REPORT_TTL_MS + 500)).toBe(0.09);
        expect(r.worst(LOSS_REPORT_TTL_MS + 1500)).toBe(0);
    });
    it("lets a clear report replace the loss", () => {
        const r = new ReportedLoss();
        r.note("@a", 0.09, 0);
        r.note("@a", 0, 1000);
        expect(r.worst(2000)).toBe(0);
    });
    it("forgets a participant who left", () => {
        const r = new ReportedLoss();
        r.note("@a", 0.09, 0);
        r.forget("@a");
        expect(r.worst(1)).toBe(0);
    });
});
