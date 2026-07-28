/**
 * Pure method negotiation for device/user verification: given a request's phase
 * and what the other party said it supports, decide which affordances to offer
 * (show a QR, scan a QR, compare emoji) and whether to skip the choice entirely.
 * SDK-free so it unit-tests without the rust-crypto WASM.
 */

import { VerificationPhaseValue } from "./verification";

/**
 * Mirror of matrix-js-sdk's `VerificationMethod` enum (lib/types) as plain
 * strings. Duplicated on purpose, same reason as `VerificationPhaseValue`:
 * importing the enum would pull the SDK into a module we want SDK-free.
 */
export const VerificationMethodValue = {
    Sas: "m.sas.v1",
    ShowQrCode: "m.qr_code.show.v1",
    ScanQrCode: "m.qr_code.scan.v1",
    Reciprocate: "m.reciprocate.v1",
} as const;

export interface QrMethodInput {
    /** Raw `VerificationPhase` number from the request. */
    phase: number;
    /**
     * The other party advertised `m.qr_code.scan.v1` — THEY can scan, so WE can
     * show. (The SDK's own doc calls this asymmetry out at verification.d.ts:58-62.)
     */
    otherCanScan: boolean;
    /** The other party advertised `m.qr_code.show.v1` — they show, we scan. */
    otherCanShow: boolean;
    /** A verifier already exists, i.e. a method has been chosen by either side. */
    hasVerifier: boolean;
    /**
     * This host can open a camera at all (false where
     * `navigator.mediaDevices.getUserMedia` is absent — no camera API, or an
     * insecure context). Gates scanning only; showing our own code needs no camera.
     */
    cameraAvailable: boolean;
}

export interface QrMethodOptions {
    /** Offer "show my code for them to scan". */
    canShowQr: boolean;
    /** Offer "scan their code". */
    canScanQr: boolean;
    /** Offer the emoji fallback. */
    canSas: boolean;
    /**
     * No QR option exists in either direction, so the caller should start the
     * emoji check itself instead of showing a one-button chooser. This preserves
     * the pre-QR behaviour exactly for SAS-only peers: zero extra taps.
     */
    shouldAutoStartSas: boolean;
}

/**
 * Nothing to choose: before Ready, after a method is picked, and when terminal.
 * Frozen because two of the three code paths return it by identity — a consumer
 * writing through the result (directly, or through a Svelte 5 `$state()` proxy
 * wrapping it) would otherwise corrupt it for every later call this session.
 */
export const NO_METHOD_OPTIONS: QrMethodOptions = Object.freeze({
    canShowQr: false,
    canScanQr: false,
    canSas: false,
    shouldAutoStartSas: false,
});

/**
 * Which verification affordances to offer right now. A choice only exists in
 * the `Ready` phase with no verifier yet — once either side sends a `.start`
 * the method is settled and the UI follows the verifier instead.
 */
export function qrMethodOptions(input: QrMethodInput): QrMethodOptions {
    if (input.hasVerifier) return NO_METHOD_OPTIONS;
    if (input.phase !== VerificationPhaseValue.Ready) return NO_METHOD_OPTIONS;
    const canShowQr = input.otherCanScan;
    const canScanQr = input.otherCanShow && input.cameraAvailable;
    return {
        canShowQr,
        canScanQr,
        canSas: true,
        shouldAutoStartSas: !canShowQr && !canScanQr,
    };
}
