// QR sign-in through the OAuth device authorization grant (RFC 8628).
//
// The new device asks the account's provider for a device code and shows the
// approval link as a QR code. A device that is already signed in scans it,
// opens the link and approves the login there; the new device, which has been
// polling the provider, receives its tokens. Zam then starts the usual
// verification between the two devices, so the new session ends up verified.
//
// This needs nothing from the homeserver beyond native OAuth with the
// device-code grant, which Matrix Authentication Service (matrix.org) offers.
//
// It is the fallback. A homeserver that advertises MSC4108 gets that
// protocol instead (qrLoginRendezvous.ts), which also hands over the
// encryption keys; `signInWithQr` and `linkDevice` pick per server and per
// scanned code.
//
// The QR holds the provider's approval URL plus the new device's id in the
// fragment (`#zam-device=ID`). A phone camera that opens the URL sees a normal
// approval page and ignores the fragment; Zam reads it to know which device to
// verify once the approval goes through.

import {
    OAuthGrantType,
    generateScope,
    startDeviceAuthorization,
    type DeviceAccessTokenResponse,
    type MatrixClient,
    type ValidatedAuthMetadata,
} from "matrix-js-sdk";
import { t } from "$lib/i18n";
import { finishOAuthTokens, type LoginResult } from "$lib/matrix/client";
import { ensureClientId, redirectTarget } from "$lib/matrix/oauth";
import { startDeviceVerification } from "$lib/matrix/crypto";
import { QrLoginError } from "$lib/matrix/qrLoginError";
import {
    linkDeviceByRendezvousScan,
    linkDeviceByShowingRendezvous,
    serverAdvertisesQrLogin,
    signInByScanningRendezvous,
    signInWithRendezvous,
    type RendezvousScanSignInOptions,
    type RendezvousShowLinkOptions,
} from "$lib/matrix/qrLoginRendezvous";

export { serverAdvertisesQrLogin };
import { isMatrixQrPayload } from "$lib/utils/qrCode";

export { QrLoginError };

const DEVICE_FRAGMENT = "zam-device=";
const DEVICE_ID = /^[A-Za-z0-9]{6,32}$/;
const APPROVAL_POLL_MS = 2000;
const APPROVAL_WAIT_MS = 10 * 60 * 1000;
// A device exists as soon as it logs in, but only publishes its encryption
// keys once the app has loaded and started crypto, which can take a while.
const VERIFY_WAIT_MS = 90 * 1000;
const VERIFY_POLL_MS = 3000;

/** Whether the provider can sign a new device in by device code. */
export function isQrLoginAvailable(
    metadata: ValidatedAuthMetadata | null,
): boolean {
    return (
        !!metadata?.device_authorization_endpoint &&
        metadata.grant_types_supported.includes(
            OAuthGrantType.DeviceAuthorization,
        )
    );
}

function randomDeviceId(): string {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const bytes = new Uint8Array(10);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => letters[b % letters.length]).join("");
}

export function encodeQrPayload(approvalUrl: string, deviceId: string): string {
    return `${approvalUrl.split("#")[0]}#${DEVICE_FRAGMENT}${deviceId}`;
}

export interface QrPayload {
    /** Where to approve, without Zam's fragment. */
    approvalUrl: string;
    deviceId: string;
}

/**
 * Read a scanned code. The link is only accepted when it is https on this
 * account's own provider: the new device wrote it, and a device that is not
 * yet trusted must not be able to send the user to some other site.
 */
export function parseQrPayload(text: string, issuer: string): QrPayload | null {
    try {
        const url = new URL(text);
        const provider = new URL(issuer);
        if (url.protocol !== "https:" || url.origin !== provider.origin)
            return null;
        if (!url.hash.startsWith(`#${DEVICE_FRAGMENT}`)) return null;
        const deviceId = url.hash.slice(DEVICE_FRAGMENT.length + 1);
        if (!DEVICE_ID.test(deviceId)) return null;
        url.hash = "";
        return { approvalUrl: url.href, deviceId };
    } catch {
        return null;
    }
}

/** Accepts the scanner payloads that look like one of our codes. */
export function looksLikeQrPayload(bytes: ArrayLike<number>): boolean {
    const text = new TextDecoder().decode(Uint8Array.from(bytes));
    return text.startsWith("https://") && text.includes(`#${DEVICE_FRAGMENT}`);
}

const USER_CODE = /^[A-Z0-9]{4,20}$/;

/** Tidy a code typed from another device's screen; null when it can't be one. */
export function normalizeUserCode(text: string): string | null {
    const code = text.replace(/[\s-]+/g, "").toUpperCase();
    return USER_CODE.test(code) ? code : null;
}

/**
 * Where a signed-in user approves a typed code: the provider's device-link
 * page (`/link` on Matrix Authentication Service), with the code filled in.
 */
export function buildCodeApprovalUrl(issuer: string, userCode: string): string {
    const url = new URL("link", issuer);
    url.searchParams.set("code", userCode);
    return url.href;
}

function abortable(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
        const timer = setTimeout(done, ms);
        function done() {
            clearTimeout(timer);
            signal.removeEventListener("abort", done);
            resolve();
        }
        signal.addEventListener("abort", done);
    });
}

// -------------------------------------------------------------- new device

interface DeviceCodeSignInOptions {
    baseUrl: string;
    metadata: ValidatedAuthMetadata;
    slidingSync: boolean;
    signal: AbortSignal;
    /** Show this QR payload and the code the approval page will ask about. */
    onCode: (code: { payload: string; userCode: string }) => void;
}

/** Sign this device in using a code scanned by a signed-in one. */
async function signInWithDeviceCode(
    opts: DeviceCodeSignInOptions,
): Promise<LoginResult> {
    const { metadata, signal } = opts;
    const clientId = await ensureClientId(
        opts.baseUrl,
        metadata,
        redirectTarget(),
        { deviceGrant: true },
    );
    const deviceId = randomDeviceId();
    const grant = await startDeviceAuthorization({
        clientId,
        scope: generateScope(deviceId),
        metadata,
    });
    opts.onCode({
        payload: encodeQrPayload(
            grant.verification_uri_complete ?? grant.verification_uri,
            deviceId,
        ),
        userCode: grant.user_code,
    });

    const requestStart = Date.now();
    let interval = (grant.interval ?? 5) * 1000;
    const expiresAt = requestStart + grant.expires_in * 1000;
    while (Date.now() < expiresAt) {
        await abortable(interval, signal);
        if (signal.aborted)
            throw new QrLoginError(t("qrLogin.cancelled"), "cancelled");
        const res = await fetch(metadata.token_endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: OAuthGrantType.DeviceAuthorization,
                device_code: grant.device_code,
                client_id: clientId,
            }),
            signal,
        });
        const data = (await res.json()) as
            DeviceAccessTokenResponse | { error?: string };
        if (res.ok && "access_token" in data) {
            return finishOAuthTokens({
                baseUrl: opts.baseUrl,
                issuer: metadata.issuer,
                clientId,
                deviceId,
                tokens: data,
                requestStart,
                slidingSync: opts.slidingSync,
            });
        }
        const error = "error" in data ? data.error : undefined;
        if (error === "slow_down") interval += 5000;
        else if (error === "access_denied")
            throw new QrLoginError(t("qrLogin.denied"), "cancelled");
        else if (error !== "authorization_pending")
            throw new QrLoginError(t("qrLogin.failed"));
    }
    throw new QrLoginError(t("qrLogin.expired"));
}

// ----------------------------------------------------------- existing device

interface DeviceCodeLinkOptions {
    client: MatrixClient;
    /** Decoded text of the scanned code. */
    text: string;
    signal: AbortSignal;
    /** Open this link to approve the login at the provider. */
    onApprovalUrl: (url: string) => void;
    /** The new device is signed in; `verifying` is whether verification started. */
    onVerifying: (verifying: boolean) => void;
}

/** Help a scanned device sign in, then verify it from this one. */
async function linkDeviceByDeviceCode(
    opts: DeviceCodeLinkOptions,
): Promise<void> {
    const { client, signal } = opts;
    const metadata = await client.getAuthMetadata().catch(() => null);
    if (!isQrLoginAvailable(metadata))
        throw new QrLoginError(t("qrLogin.notSupportedHere"));
    const payload = parseQrPayload(opts.text, metadata!.issuer);
    if (!payload) throw new QrLoginError(t("qrLogin.notALoginCode"));
    // A device that already exists is not the one that just made this code.
    if (await deviceExists(client, payload.deviceId))
        throw new QrLoginError(t("qrLogin.notALoginCode"));

    opts.onApprovalUrl(payload.approvalUrl);
    const deadline = Date.now() + APPROVAL_WAIT_MS;
    while (Date.now() < deadline) {
        await abortable(APPROVAL_POLL_MS, signal);
        if (signal.aborted)
            throw new QrLoginError(t("qrLogin.cancelled"), "cancelled");
        if (await deviceExists(client, payload.deviceId)) {
            const verifying = await verifyNewDevice(payload.deviceId, signal);
            opts.onVerifying(verifying);
            return;
        }
    }
    throw new QrLoginError(t("qrLogin.expired"));
}

/**
 * Start verifying a device that has just signed in. Its keys may not be
 * published yet, so keep trying for a while. A device that is already signed
 * in must not be reported as a failed sign-in, so this resolves false rather
 * than throwing when verification cannot start.
 */
async function verifyNewDevice(
    deviceId: string,
    signal: AbortSignal,
): Promise<boolean> {
    const deadline = Date.now() + VERIFY_WAIT_MS;
    for (;;) {
        try {
            await startDeviceVerification(deviceId);
            return true;
        } catch (err) {
            console.warn("[qr-login] could not start verification", err);
        }
        if (Date.now() >= deadline) return false;
        await abortable(VERIFY_POLL_MS, signal);
        if (signal.aborted)
            throw new QrLoginError(t("qrLogin.cancelled"), "cancelled");
    }
}

async function deviceExists(
    client: MatrixClient,
    deviceId: string,
): Promise<boolean> {
    try {
        return !!(await client.getDevice(deviceId));
    } catch {
        return false;
    }
}

export interface NewDeviceInfo {
    deviceId: string;
    displayName?: string;
    lastSeenIp?: string;
    lastSeenTs?: number;
}

export interface CodeLinkOptions {
    client: MatrixClient;
    /** The code as typed from the new device's screen. */
    code: string;
    signal: AbortSignal;
    /** Open this link to approve the login at the provider. */
    onApprovalUrl: (url: string) => void;
    /**
     * Several devices signed in meanwhile and a code does not say which is the
     * new one: pick it (null to stop). Called only when it is ambiguous.
     */
    chooseDevice: (devices: NewDeviceInfo[]) => Promise<string | null>;
}

/**
 * Sign in a new device from the code it shows. The code carries no device
 * id, so the device is whichever new one appears on the account once the
 * approval goes through; the user picks when more than one does.
 */
export async function linkDeviceByUserCode(
    opts: CodeLinkOptions,
): Promise<boolean> {
    const { client, signal } = opts;
    const metadata = await client.getAuthMetadata().catch(() => null);
    if (!isQrLoginAvailable(metadata))
        throw new QrLoginError(t("qrLogin.notSupportedHere"));
    const code = normalizeUserCode(opts.code);
    if (!code) throw new QrLoginError(t("qrLogin.notADeviceCode"));

    // Fail here, not later: with no baseline every device would look new.
    const known = new Set((await listDevices(client)).map((d) => d.deviceId));
    const fresh = async () =>
        (await listDevices(client).catch(() => [])).filter(
            (d) => !known.has(d.deviceId),
        );
    opts.onApprovalUrl(buildCodeApprovalUrl(metadata!.issuer, code));
    const deadline = Date.now() + APPROVAL_WAIT_MS;
    while (Date.now() < deadline) {
        await abortable(APPROVAL_POLL_MS, signal);
        if (signal.aborted)
            throw new QrLoginError(t("qrLogin.cancelled"), "cancelled");
        let found = await fresh();
        if (found.length === 0) continue;
        // Let a second device that signed in at the same moment show up.
        await abortable(APPROVAL_POLL_MS, signal);
        found = await fresh();
        if (found.length === 0) continue;
        const deviceId =
            found.length === 1
                ? found[0].deviceId
                : await opts.chooseDevice(found);
        if (!deviceId)
            throw new QrLoginError(t("qrLogin.cancelled"), "cancelled");
        return verifyNewDevice(deviceId, signal);
    }
    throw new QrLoginError(t("qrLogin.expired"));
}

async function listDevices(client: MatrixClient): Promise<NewDeviceInfo[]> {
    const { devices } = await client.getDevices();
    return devices.map((d) => ({
        deviceId: d.device_id,
        displayName: d.display_name,
        lastSeenIp: d.last_seen_ip,
        lastSeenTs: d.last_seen_ts,
    }));
}

// ---------------------------------------------------------------- dispatch

export interface QrSignInOptions extends Omit<
    DeviceCodeSignInOptions,
    "onCode"
> {
    /** Show this code; device-code sign-in also has a short code to match. */
    onCode: (code: { payload: Uint8ClampedArray; userCode?: string }) => void;
    /** MSC4108 only: the other device has scanned the code. */
    onScanned: () => void;
    /** MSC4108 only: resolve true when the user typed `expected`. */
    askCheckCode: (expected: string) => Promise<boolean>;
    /** MSC4108 only: the other device is approving at the provider. */
    onWaitingForApproval: () => void;
}

export interface QrSignInResult {
    session: LoginResult;
    /** Which protocol ran. */
    method: "rendezvous" | "device-code";
    /** MSC4108 only; false when the keys could not be imported. */
    secretsImported: boolean;
}

/**
 * Sign this device in using a code scanned by a signed-in one: over MSC4108
 * when the homeserver advertises it, otherwise by device code.
 */
export async function signInWithQr(
    opts: QrSignInOptions,
): Promise<QrSignInResult> {
    if (await serverAdvertisesQrLogin(opts.baseUrl)) {
        const { session, secretsImported } = await signInWithRendezvous({
            ...opts,
            onCode: (bytes) => opts.onCode({ payload: bytes }),
        });
        return { session, method: "rendezvous", secretsImported };
    }
    const session = await signInWithDeviceCode({
        ...opts,
        onCode: (code) =>
            opts.onCode({
                payload: Uint8ClampedArray.from(
                    new TextEncoder().encode(code.payload),
                ),
                userCode: code.userCode,
            }),
    });
    return { session, method: "device-code", secretsImported: false };
}

/** Whether the scanner should hand this payload to `linkDevice`. */
export function isQrLoginPayload(bytes: ArrayLike<number>): boolean {
    return isMatrixQrPayload(bytes) || looksLikeQrPayload(bytes);
}

export interface QrLinkOptions {
    client: MatrixClient;
    bytes: Uint8ClampedArray;
    signal: AbortSignal;
    /** MSC4108 only: show this number; it is typed on the new device. */
    onCheckCode: (code: string) => void;
    /** Open this link to approve the login at the provider. */
    onApprovalUrl: (url: string) => void;
    /**
     * Done: keys sent (MSC4108) or the device signed in (device code);
     * `verifying` is false when verification could not be started.
     */
    onDone: (verifying: boolean) => void;
}

/** Help a scanned device sign in, picking the protocol from its code. */
export async function linkDevice(opts: QrLinkOptions): Promise<void> {
    let verifying = true;
    if (isMatrixQrPayload(opts.bytes)) {
        await linkDeviceByRendezvousScan(opts);
    } else {
        await linkDeviceByDeviceCode({
            client: opts.client,
            text: new TextDecoder().decode(opts.bytes),
            signal: opts.signal,
            onApprovalUrl: opts.onApprovalUrl,
            onVerifying: (started) => (verifying = started),
        });
    }
    opts.onDone(verifying);
}

export type QrScanSignInOptions = RendezvousScanSignInOptions;

/** Sign this device in by scanning a code a signed-in device shows. */
export async function signInByScanningQr(
    opts: QrScanSignInOptions,
): Promise<QrSignInResult> {
    const { session, secretsImported } = await signInByScanningRendezvous(opts);
    return { session, method: "rendezvous", secretsImported };
}

export type QrShowLinkOptions = RendezvousShowLinkOptions;

/** Show a code for a new device to scan; it signs in and gets the keys. */
export async function linkDeviceByShowingQr(
    opts: QrShowLinkOptions,
): Promise<void> {
    await linkDeviceByShowingRendezvous(opts);
}
