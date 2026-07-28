import { describe, it, expect } from "vitest";
import {
    qrMethodOptions,
    NO_METHOD_OPTIONS,
    VerificationMethodValue,
    type QrMethodInput,
    type QrMethodOptions,
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
        expect(qrMethodOptions({ ...ready, otherCanShow: true })).toEqual({
            canShowQr: false,
            canScanQr: true,
            canSas: true,
            shouldAutoStartSas: false,
        });
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
});

/**
 * The cases above document the interesting points; this table pins the whole
 * input space so no single-flag mutation of the implementation can slip through
 * green. The expectation below is written independently from the rules in prose
 * — nested branches rather than the implementation's boolean expressions — so a
 * flipped `&&` or dropped `!` in the module cannot be mirrored here.
 */
function expectedOptions(input: QrMethodInput): QrMethodOptions {
    // There is nothing to choose unless the request is Ready and no method has
    // been settled yet (no verifier).
    let choiceExists = false;
    if (input.phase === VerificationPhaseValue.Ready) {
        if (!input.hasVerifier) choiceExists = true;
    }
    if (!choiceExists) {
        return {
            canShowQr: false,
            canScanQr: false,
            canSas: false,
            shouldAutoStartSas: false,
        };
    }
    // We can SHOW a code exactly when the other party said it can SCAN one.
    // A camera is irrelevant here: displaying our own code needs no camera.
    let canShowQr = false;
    if (input.otherCanScan) canShowQr = true;
    // We can SCAN their code only when they said they can SHOW one and this
    // host actually has a camera.
    let canScanQr = false;
    if (input.otherCanShow) {
        if (input.cameraAvailable) canScanQr = true;
    }
    // Emoji is always on the table as the fallback.
    const canSas = true;
    // Auto-start emoji only when neither QR direction is available — otherwise
    // the user gets a chooser and we must not settle the method behind them.
    let shouldAutoStartSas = true;
    if (canShowQr) shouldAutoStartSas = false;
    if (canScanQr) shouldAutoStartSas = false;
    return { canShowQr, canScanQr, canSas, shouldAutoStartSas };
}

const PHASE_ROWS: ReadonlyArray<readonly [string, number]> = [
    ["Requested", VerificationPhaseValue.Requested],
    ["Ready", VerificationPhaseValue.Ready],
    ["Started", VerificationPhaseValue.Started],
];
const BOOLS = [false, true] as const;

const TABLE: QrMethodInput[] = [];
for (const [, phase] of PHASE_ROWS) {
    for (const otherCanScan of BOOLS) {
        for (const otherCanShow of BOOLS) {
            for (const hasVerifier of BOOLS) {
                for (const cameraAvailable of BOOLS) {
                    TABLE.push({
                        phase,
                        otherCanScan,
                        otherCanShow,
                        hasVerifier,
                        cameraAvailable,
                    });
                }
            }
        }
    }
}

const phaseName = (phase: number) =>
    PHASE_ROWS.find(([, value]) => value === phase)?.[0] ?? String(phase);

describe("qrMethodOptions (exhaustive table)", () => {
    it("covers every combination of the input space", () => {
        expect(TABLE).toHaveLength(48);
    });

    it.each(
        TABLE.map(
            (input) =>
                [
                    `${phaseName(input.phase)} scan=${input.otherCanScan} show=${input.otherCanShow} verifier=${input.hasVerifier} camera=${input.cameraAvailable}`,
                    input,
                ] as const,
        ),
    )("%s", (_name, input) => {
        const out = qrMethodOptions(input);
        expect(out).toEqual(expectedOptions(input));
        // A chooser and an auto-start are mutually exclusive: auto-starting SAS
        // while a QR option is on screen would settle the method behind the user.
        expect(out.shouldAutoStartSas && (out.canShowQr || out.canScanQr)).toBe(
            false,
        );
        // Auto-starting emoji is only coherent if emoji is actually offered.
        if (out.shouldAutoStartSas) expect(out.canSas).toBe(true);
    });
});

describe("NO_METHOD_OPTIONS", () => {
    it("is frozen, so a consumer cannot corrupt the shared constant", () => {
        expect(() => {
            (NO_METHOD_OPTIONS as { canSas: boolean }).canSas = true;
        }).toThrow();
        expect(NO_METHOD_OPTIONS.canSas).toBe(false);
        expect(Object.isFrozen(NO_METHOD_OPTIONS)).toBe(true);
    });
});
