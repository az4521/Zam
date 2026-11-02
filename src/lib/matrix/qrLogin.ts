// QR sign-in (MSC4108), both halves.
//
// New device: shows a QR code; a signed-in device scans it, approves the login
// at the provider, and sends the account's end-to-end secrets over an
// encrypted channel, so the new session arrives already verified.
//
// Existing device: scans the new device's code and drives the approval.
//
// The protocol itself (secure channel, rendezvous session, device
// authorization grant) is matrix-js-sdk's `MSC4108SignInWithQR`; this file
// sequences it for Zam and adds the checks the SDK leaves to the client.
// It needs a homeserver with native OAuth, the device-code grant and the
// `org.matrix.msc4108` rendezvous endpoint (Matrix Authentication Service).
//
// The SDK module pulls in the crypto WASM, so it is imported on first use.

import {
    OAuthGrantType,
    createClient,
    type MatrixClient,
    type ValidatedAuthMetadata,
} from "matrix-js-sdk";
import { t } from "$lib/i18n";
import {
    finishOAuthTokens,
    resolveHomeserver,
    type LoginResult,
} from "$lib/matrix/client";
import { ensureClientId, redirectTarget } from "$lib/matrix/oauth";
import { getClient } from "$lib/matrix/runtime";

const UNSTABLE_FEATURE = "org.matrix.msc4108";
const VERSIONS_TIMEOUT_MS = 8000;

/** A QR sign-in step failed or was refused; `message` is user-facing. */
export class QrLoginError extends Error {
    constructor(
        message: string,
        readonly kind: "cancelled" | "failed" = "failed",
    ) {
        super(message);
        this.name = "QrLoginError";
    }
}

/** Whether `/versions` advertises the rendezvous endpoint. */
export async function serverAdvertisesQrLogin(
    baseUrl: string,
    fetchFn: typeof fetch = (...args) => fetch(...args),
): Promise<boolean> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), VERSIONS_TIMEOUT_MS);
    try {
        const res = await fetchFn(
            `${baseUrl.replace(/\/$/, "")}/_matrix/client/versions`,
            { signal: controller.signal },
        );
        if (!res.ok) return false;
        const doc = (await res.json()) as {
            unstable_features?: Record<string, boolean>;
        };
        return doc.unstable_features?.[UNSTABLE_FEATURE] === true;
    } catch {
        return false;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Whether the typed homeserver can sign a new device in by QR: the provider
 * must grant by device code and the server must advertise the rendezvous.
 */
export async function isQrLoginAvailable(
    baseUrl: string,
    metadata: ValidatedAuthMetadata | null,
): Promise<boolean> {
    if (!metadata?.device_authorization_endpoint) return false;
    if (
        !metadata.grant_types_supported.includes(
            OAuthGrantType.DeviceAuthorization,
        )
    )
        return false;
    return serverAdvertisesQrLogin(baseUrl);
}

/** Two digits, as the secure channel's check code is rendered. */
export function checkCodeMatches(expected: string, typed: string): boolean {
    return expected.length > 0 && typed.trim() === expected;
}

function randomDeviceId(): string {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const bytes = new Uint8Array(10);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => letters[b % letters.length]).join("");
}

/**
 * Something that rejects when the SDK reports a failure (the other side
 * cancelled, the channel was tampered with, the session expired), so every
 * await in a flow can be raced against it.
 */
function failureGate() {
    let fail: (e: QrLoginError) => void = () => {};
    const failed = new Promise<never>((_, reject) => {
        fail = reject;
    });
    failed.catch(() => {});
    return {
        trip: fail,
        guard: <T>(p: Promise<T>): Promise<T> => Promise.race([p, failed]),
    };
}

function failureMessage(reason: unknown): QrLoginError {
    const text = String(reason);
    if (text.includes("user_cancelled") || text.includes("declined"))
        return new QrLoginError(t("qrLogin.cancelledOther"), "cancelled");
    if (text.includes("expired")) return new QrLoginError(t("qrLogin.expired"));
    if (text.includes("insecure"))
        return new QrLoginError(t("qrLogin.insecure"));
    return new QrLoginError(t("qrLogin.failed"));
}

// -------------------------------------------------------------- new device

export interface QrSignInOptions {
    baseUrl: string;
    metadata: ValidatedAuthMetadata;
    slidingSync: boolean;
    signal: AbortSignal;
    /** The bytes to render as a QR code. */
    onCode: (bytes: Uint8ClampedArray) => void;
    /** The other device has scanned; ask the user to type its check code. */
    onScanned: () => void;
    /** Resolve true when the user typed `expected`; false aborts the flow. */
    askCheckCode: (expected: string) => Promise<boolean>;
    /** The other device is approving the login at the provider. */
    onWaitingForApproval: () => void;
}

export interface QrSignInResult {
    session: LoginResult;
    /** False when the secrets could not be imported: sign in works, verify by hand. */
    secretsImported: boolean;
}

/** Sign this device in using a code scanned by an already signed-in one. */
export async function signInWithQr(
    opts: QrSignInOptions,
): Promise<QrSignInResult> {
    const { signInByGeneratingQR, MSC4108FailureReason } =
        await import("matrix-js-sdk/lib/rendezvous");
    const gate = failureGate();
    const tempClient = createClient({ baseUrl: opts.baseUrl });
    let flow: Awaited<ReturnType<typeof signInByGeneratingQR>> | undefined;
    try {
        flow = await gate.guard(
            signInByGeneratingQR(
                tempClient,
                (reason) => gate.trip(failureMessage(reason)),
                opts.signal,
            ),
        );
        if (!flow.code) throw new QrLoginError(t("qrLogin.failed"));
        opts.onCode(new Uint8ClampedArray(flow.code));

        const { serverName } = await gate.guard(flow.negotiateProtocols());
        opts.onScanned();

        // The scanning device decides which account this is. If it is on a
        // different server than the one typed, the tokens would be issued by
        // a provider we did not discover.
        if (serverName) {
            const theirs = await resolveHomeserver(serverName, { quiet: true });
            if (theirs.replace(/\/$/, "") !== opts.baseUrl.replace(/\/$/, ""))
                throw new QrLoginError(
                    t("qrLogin.wrongServer", { server: serverName }),
                );
        }

        // Typing the code the other device shows proves nobody sits between
        // the two: a mismatch means the channel is not the one scanned.
        const expected = flow.checkCode;
        if (!expected || !(await gate.guard(opts.askCheckCode(expected)))) {
            await flow.cancel(MSC4108FailureReason.UserCancelled);
            throw new QrLoginError(t("qrLogin.codeMismatch"), "cancelled");
        }

        const clientId = await ensureClientId(
            opts.baseUrl,
            opts.metadata,
            redirectTarget(),
            { deviceGrant: true },
        );
        const deviceId = randomDeviceId();
        await gate.guard(
            flow.deviceAuthorizationGrant({
                metadata: opts.metadata,
                clientId,
                deviceId,
            }),
        );
        opts.onWaitingForApproval();

        const requestStart = Date.now();
        const tokens = await gate.guard(
            flow.completeLoginOnNewDevice({ clientId }),
        );
        if (!tokens) throw new QrLoginError(t("qrLogin.failed"));
        const session = await finishOAuthTokens({
            baseUrl: opts.baseUrl,
            issuer: opts.metadata.issuer,
            clientId,
            deviceId,
            tokens,
            requestStart,
            slidingSync: opts.slidingSync,
        });

        let secretsImported = false;
        try {
            const { secrets } = await gate.guard(flow.shareSecrets());
            const crypto = getClient()?.getCrypto();
            if (secrets && crypto?.importSecretsBundle) {
                await crypto.importSecretsBundle(secrets);
                secretsImported = true;
            }
        } catch (err) {
            // Signed in but unverified; the usual verification still works.
            console.warn("[qr-login] could not import secrets", err);
        }
        return { session, secretsImported };
    } catch (err) {
        if (opts.signal.aborted)
            throw new QrLoginError(t("qrLogin.cancelled"), "cancelled");
        throw err instanceof QrLoginError
            ? err
            : failureMessage(err instanceof Error ? err.message : err);
    } finally {
        await flow?.close().catch(() => {});
        tempClient.stopClient();
    }
}

// ----------------------------------------------------------- existing device

export interface QrLinkOptions {
    client: MatrixClient;
    /** Bytes decoded from the new device's QR code. */
    bytes: Uint8ClampedArray;
    signal: AbortSignal;
    /** Show this code; the new device's user must type it there. */
    onCheckCode: (code: string) => void;
    /** Where to approve the login. Always on the account's provider. */
    onApprovalUrl: (url: string) => void;
}

/**
 * The approval link comes from the new device, which is not yet trusted, so
 * it is only offered when it points at this account's own provider over https.
 */
export function isTrustedApprovalUrl(url: string, issuer: string): boolean {
    try {
        const target = new URL(url);
        const provider = new URL(issuer);
        return (
            target.protocol === "https:" && target.origin === provider.origin
        );
    } catch {
        return false;
    }
}

/** Scan a new device's code and help it sign in, sharing this account's secrets. */
export async function linkDeviceByScan(opts: QrLinkOptions): Promise<void> {
    const [
        { MSC4108RendezvousSession, MSC4108SecureChannel, MSC4108SignInWithQR },
        wasm,
    ] = await Promise.all([
        import("matrix-js-sdk/lib/rendezvous"),
        import("@matrix-org/matrix-sdk-crypto-wasm"),
    ]);
    const gate = failureGate();
    const onFailure = (reason: unknown) => gate.trip(failureMessage(reason));

    let data: InstanceType<typeof wasm.QrCodeData>;
    try {
        data = wasm.QrCodeData.fromBytes(new Uint8Array(opts.bytes));
    } catch {
        throw new QrLoginError(t("qrLogin.notALoginCode"));
    }
    // The existing device scans; a code from another signed-in device is a
    // different flow.
    if (data.mode !== wasm.QrCodeIntent.Login || !data.rendezvousUrl)
        throw new QrLoginError(t("qrLogin.notALoginCode"));

    const metadata = await opts.client.getAuthMetadata().catch(() => null);
    if (!metadata) throw new QrLoginError(t("qrLogin.notSupportedHere"));

    const session = new MSC4108RendezvousSession({
        onFailure,
        url: data.rendezvousUrl,
    });
    const channel = new MSC4108SecureChannel(
        session,
        data.publicKey,
        onFailure,
    );
    const flow = new MSC4108SignInWithQR(channel, true, opts.client, onFailure);
    opts.signal.addEventListener(
        "abort",
        () => {
            flow.onFailure = undefined;
            channel.onFailure = undefined;
            session.onFailure = undefined;
            void flow
                .declineLoginOnExistingDevice()
                .catch(() => {})
                .finally(() => flow.close().catch(() => {}));
        },
        { once: true },
    );

    try {
        await gate.guard(flow.negotiateProtocols());
        if (flow.checkCode) opts.onCheckCode(flow.checkCode);
        const { verificationUri } = await gate.guard(
            flow.deviceAuthorizationGrant(),
        );
        if (
            !verificationUri ||
            !isTrustedApprovalUrl(verificationUri, metadata.issuer)
        ) {
            await flow.declineLoginOnExistingDevice().catch(() => {});
            throw new QrLoginError(t("qrLogin.untrustedApproval"));
        }
        opts.onApprovalUrl(verificationUri);
        await gate.guard(flow.shareSecrets());
    } catch (err) {
        if (opts.signal.aborted)
            throw new QrLoginError(t("qrLogin.cancelled"), "cancelled");
        throw err instanceof QrLoginError
            ? err
            : failureMessage(err instanceof Error ? err.message : err);
    } finally {
        await flow.close().catch(() => {});
    }
}
