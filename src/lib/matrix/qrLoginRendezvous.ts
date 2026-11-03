// QR sign-in over MSC4108's rendezvous channel, both halves.
//
// New device: shows a QR code; a signed-in device scans it, approves the login
// at the provider, and sends the account's end-to-end secrets over an
// encrypted channel, so the new session arrives already verified.
// Existing device: scans the new device's code and drives the approval.
// Either side can also be the one that shows the code: a signed-in device can
// show a code for the new device to scan (`linkDeviceByShowingRendezvous`,
// `signInByScanningRendezvous`).
//
// The protocol itself (secure channel, rendezvous session, device
// authorization grant) is matrix-js-sdk's `MSC4108SignInWithQR`; this file
// sequences it for Zam and adds the checks the SDK leaves to the client.
// Only for homeservers that advertise `org.matrix.msc4108`; qrLogin.ts falls
// back to the plain device-code flow everywhere else.
//
// The SDK module pulls in the crypto WASM, so it is imported on first use.

import type { MSC4108SignInWithQR } from "matrix-js-sdk/lib/rendezvous";
import {
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
import { QrLoginError } from "$lib/matrix/qrLoginError";

const UNSTABLE_FEATURE = "org.matrix.msc4108";
const VERSIONS_TIMEOUT_MS = 8000;

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

export interface RendezvousSignInOptions {
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

export interface RendezvousSignInResult {
    session: LoginResult;
    /** False when the secrets could not be imported: sign in works, verify by hand. */
    secretsImported: boolean;
}

type RendezvousFlow = MSC4108SignInWithQR;

/**
 * The part of a new device's sign-in both directions share, once the secure
 * channel is up and the check code has been settled: get tokens through the
 * device authorization grant, start the session, then import the secrets.
 */
async function finishNewDeviceLogin(
    flow: RendezvousFlow,
    gate: ReturnType<typeof failureGate>,
    opts: Pick<
        RendezvousSignInOptions,
        "baseUrl" | "metadata" | "slidingSync" | "onWaitingForApproval"
    >,
): Promise<RendezvousSignInResult> {
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
}

/** Sign this device in using a code scanned by an already signed-in one. */
export async function signInWithRendezvous(
    opts: RendezvousSignInOptions,
): Promise<RendezvousSignInResult> {
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

        return await finishNewDeviceLogin(flow, gate, opts);
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

export interface RendezvousLinkOptions {
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
export async function linkDeviceByRendezvousScan(
    opts: RendezvousLinkOptions,
): Promise<void> {
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

// ------------------------------------------- scanning direction (reversed)

export interface RendezvousScanSignInOptions extends Pick<
    RendezvousSignInOptions,
    "baseUrl" | "metadata" | "slidingSync" | "signal" | "onWaitingForApproval"
> {
    /** Bytes decoded from the signed-in device's QR code. */
    bytes: Uint8ClampedArray;
    /** Show this number; it is typed on the signed-in device. */
    onCheckCode: (code: string) => void;
}

/**
 * Sign this device in by scanning a code a signed-in device shows. The
 * scanning side displays the check code and the signed-in one asks for it.
 */
export async function signInByScanningRendezvous(
    opts: RendezvousScanSignInOptions,
): Promise<RendezvousSignInResult> {
    const [
        {
            MSC4108FailureReason,
            MSC4108RendezvousSession,
            MSC4108SecureChannel,
            MSC4108SignInWithQR,
        },
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
    // A signed-in device offers a code in Reciprocate mode; a Login code is
    // another new device's, which this one cannot help.
    if (data.mode !== wasm.QrCodeIntent.Reciprocate || !data.rendezvousUrl)
        throw new QrLoginError(t("qrLogin.notAShownCode"));
    // The code names the account's server; it must be the one this sign-in
    // discovered, or the tokens would come from a provider we never checked.
    if (data.serverName) {
        const theirs = await resolveHomeserver(data.serverName, {
            quiet: true,
        });
        if (theirs.replace(/\/$/, "") !== opts.baseUrl.replace(/\/$/, ""))
            throw new QrLoginError(
                t("qrLogin.wrongServer", { server: data.serverName }),
            );
    }

    const session = new MSC4108RendezvousSession({
        onFailure,
        url: data.rendezvousUrl,
    });
    const channel = new MSC4108SecureChannel(
        session,
        data.publicKey,
        onFailure,
    );
    const flow = new MSC4108SignInWithQR(channel, true, undefined, onFailure);
    opts.signal.addEventListener(
        "abort",
        () => {
            flow.onFailure = undefined;
            channel.onFailure = undefined;
            session.onFailure = undefined;
            void flow
                .cancel(MSC4108FailureReason.UserCancelled)
                .catch(() => {});
        },
        { once: true },
    );

    try {
        await gate.guard(flow.negotiateProtocols());
        if (!flow.checkCode) throw new QrLoginError(t("qrLogin.failed"));
        opts.onCheckCode(flow.checkCode);
        return await finishNewDeviceLogin(flow, gate, opts);
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

export interface RendezvousShowLinkOptions {
    client: MatrixClient;
    signal: AbortSignal;
    /** Render this as a QR code for the new device to scan. */
    onCode: (bytes: Uint8ClampedArray) => void;
    /** The new device has scanned; ask the user to type the number it shows. */
    onScanned: () => void;
    /** Resolve true when the user typed `expected`; false aborts the flow. */
    askCheckCode: (expected: string) => Promise<boolean>;
    /** Where to approve the login. Always on the account's provider. */
    onApprovalUrl: (url: string) => void;
}

/** Show a code for a new device to scan and help it sign in. */
export async function linkDeviceByShowingRendezvous(
    opts: RendezvousShowLinkOptions,
): Promise<void> {
    const { linkNewDeviceByGeneratingQR, MSC4108FailureReason } =
        await import("matrix-js-sdk/lib/rendezvous");
    const metadata = await opts.client.getAuthMetadata().catch(() => null);
    if (!metadata) throw new QrLoginError(t("qrLogin.notSupportedHere"));

    const gate = failureGate();
    let flow: MSC4108SignInWithQR | undefined;
    try {
        flow = await gate.guard(
            linkNewDeviceByGeneratingQR(
                opts.client,
                (reason) => gate.trip(failureMessage(reason)),
                opts.signal,
            ),
        );
        if (!flow.code) throw new QrLoginError(t("qrLogin.failed"));
        opts.onCode(new Uint8ClampedArray(flow.code));

        await gate.guard(flow.negotiateProtocols());
        opts.onScanned();

        // The new device shows the number; typing it here proves nobody sits
        // between the two.
        const expected = flow.checkCode;
        if (!expected || !(await gate.guard(opts.askCheckCode(expected)))) {
            await flow.cancel(MSC4108FailureReason.UserCancelled);
            throw new QrLoginError(t("qrLogin.codeMismatch"), "cancelled");
        }

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
        await flow?.close().catch(() => {});
    }
}
