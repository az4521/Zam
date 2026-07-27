import { describe, it, expect } from "vitest";
import {
    qrMethodOptions,
    NO_METHOD_OPTIONS,
    VerificationMethodValue,
} from "./qrVerification";
import { VerificationPhaseValue } from "./verification";

const ready = {
    phase: VerificationPhaseValue.Ready,
    otherCanScan: false,
    otherCanShow: false,
    hasVerifier: false,
    cameraAvailable: true,
};

describe("VerificationMethodValue", () => {
    it("mirrors the SDK's method ids", () => {
        expect(VerificationMethodValue).toEqual({
            Sas: "m.sas.v1",
            ShowQrCode: "m.qr_code.show.v1",
            ScanQrCode: "m.qr_code.scan.v1",
            Reciprocate: "m.reciprocate.v1",
        });
    });
});

describe("qrMethodOptions", () => {
    it("offers both QR directions plus emoji when the other side does everything", () => {
        expect(
            qrMethodOptions({
                ...ready,
                otherCanScan: true,
                otherCanShow: true,
            }),
        ).toEqual({
            canShowQr: true,
            canScanQr: true,
            canSas: true,
            shouldAutoStartSas: false,
        });
    });

    it("shows our code only when the other side can scan", () => {
        const out = qrMethodOptions({ ...ready, otherCanScan: true });
        expect(out.canShowQr).toBe(true);
        expect(out.canScanQr).toBe(false);
        expect(out.shouldAutoStartSas).toBe(false);
    });

    it("offers scanning only when the other side can show AND we have a camera", () => {
        const out = qrMethodOptions({ ...ready, otherCanShow: true });
        expect(out.canScanQr).toBe(true);
        expect(out.canShowQr).toBe(false);
    });

    it("auto-starts emoji when the other side can show but we have no camera", () => {
        const out = qrMethodOptions({
            ...ready,
            otherCanShow: true,
            cameraAvailable: false,
        });
        expect(out.canScanQr).toBe(false);
        expect(out.canSas).toBe(true);
        expect(out.shouldAutoStartSas).toBe(true);
    });

    it("auto-starts emoji for a SAS-only peer, preserving the pre-QR zero-tap flow", () => {
        expect(qrMethodOptions(ready)).toEqual({
            canShowQr: false,
            canScanQr: false,
            canSas: true,
            shouldAutoStartSas: true,
        });
    });

    it("offers nothing before the request is ready", () => {
        for (const phase of [
            VerificationPhaseValue.Unsent,
            VerificationPhaseValue.Requested,
        ]) {
            expect(
                qrMethodOptions({
                    ...ready,
                    phase,
                    otherCanScan: true,
                    otherCanShow: true,
                }),
            ).toEqual(NO_METHOD_OPTIONS);
        }
    });

    it("offers nothing once a method has been chosen", () => {
        expect(
            qrMethodOptions({
                ...ready,
                otherCanScan: true,
                otherCanShow: true,
                hasVerifier: true,
            }),
        ).toEqual(NO_METHOD_OPTIONS);
    });

    it("offers nothing in a terminal phase", () => {
        for (const phase of [
            VerificationPhaseValue.Started,
            VerificationPhaseValue.Done,
            VerificationPhaseValue.Cancelled,
        ]) {
            expect(qrMethodOptions({ ...ready, phase })).toEqual(
                NO_METHOD_OPTIONS,
            );
        }
    });

    it("never auto-starts emoji when there is nothing to choose", () => {
        expect(NO_METHOD_OPTIONS.shouldAutoStartSas).toBe(false);
    });
});
