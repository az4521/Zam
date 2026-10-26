// Account registration over the legacy `/register` API, driven through its
// User-Interactive Auth (UIA) stages. Native-OAuth servers (matrix.org via
// MAS) never come here: they create accounts on their provider's page.
//
// The server answers a registration attempt with 401 + the flows it accepts
// (each a list of stages) and a `session`. We pick the first flow whose stages
// we can all complete, then complete them one by one, resubmitting the same
// body with `auth` until the server returns the new account. The stages that
// need the user (a token, accepting terms, a captcha, an email link) are
// answered by the sign-in form through `RegistrationPrompter`.

import { t } from "$lib/i18n";
import type { MatrixError } from "matrix-js-sdk";

export interface RegistrationFlow {
    stages: string[];
}

/** A server's UIA challenge for `/register`. */
export interface RegistrationChallenge {
    flows: RegistrationFlow[];
    session?: string;
    completed?: string[];
    params?: Record<string, unknown>;
}

export interface TermsPolicy {
    id: string;
    name: string;
    url: string;
}

/** What a stage needs from the user before it can be submitted. */
export type RegistrationPrompt =
    /** `retry`: the last token sent was refused. */
    | { kind: "token"; retry: boolean }
    | { kind: "terms"; policies: TermsPolicy[] }
    /** `sent`: the email went out but the link hasn't been opened yet. */
    | {
          kind: "email";
          sent: boolean;
          requestToken: (email: string) => Promise<void>;
      }
    /** The server's own web page completes the stage (captcha, anything we don't render). */
    | { kind: "fallback"; stage: string; url: string };

/**
 * Asks the user to complete one stage. Resolves with the value the stage
 * needs (the token text; for the rest, anything: their completion is the
 * answer), or rejects / resolves `null` when the user backs out.
 */
export type RegistrationPrompter = (
    prompt: RegistrationPrompt,
) => Promise<string | null>;

/** The user backed out of a registration step. */
export class RegistrationCancelledError extends Error {
    constructor() {
        super(t("registration.cancelled"));
        this.name = "RegistrationCancelledError";
    }
}

/** Stages answered without asking the user anything. */
const AUTOMATIC_STAGES = new Set(["m.login.dummy"]);
/** Stages the form renders itself. */
const PROMPTED_STAGES = new Set([
    "m.login.registration_token",
    "org.matrix.msc3231.login.registration_token",
    "m.login.terms",
    "m.login.email.identity",
]);
/** Stages only the server's fallback page can complete. */
const FALLBACK_STAGES = new Set(["m.login.recaptcha"]);

function stageCost(stage: string): number {
    if (AUTOMATIC_STAGES.has(stage)) return 0;
    if (stage.endsWith("registration_token") || stage === "m.login.terms")
        return 1;
    if (stage === "m.login.email.identity") return 3;
    if (FALLBACK_STAGES.has(stage)) return 4;
    return 10; // unknown: fallback page, as a last resort
}

function canComplete(stage: string): boolean {
    return (
        AUTOMATIC_STAGES.has(stage) ||
        PROMPTED_STAGES.has(stage) ||
        FALLBACK_STAGES.has(stage)
    );
}

/**
 * The flow to follow: the cheapest one (fewest things to ask the user) we
 * can complete without a fallback page for an unknown stage, else the
 * cheapest one at all (unknown stages go to the server's fallback page).
 * Null when the server offers no flow.
 */
export function pickRegistrationFlow(
    flows: RegistrationFlow[],
    completed: string[] = [],
): RegistrationFlow | null {
    const valid = flows.filter(
        (f) => Array.isArray(f.stages) && f.stages.length > 0,
    );
    if (valid.length === 0) return null;
    // A flow that contradicts what's already done can't be the one in use.
    const consistent = valid.filter((f) =>
        completed.every((s) => f.stages.includes(s)),
    );
    const pool = consistent.length > 0 ? consistent : valid;
    const cost = (f: RegistrationFlow) =>
        f.stages
            .filter((s) => !completed.includes(s))
            .reduce((n, s) => n + stageCost(s), 0);
    const known = pool.filter((f) => f.stages.every(canComplete));
    const ranked = (known.length > 0 ? known : pool)
        .slice()
        .sort((a, b) => cost(a) - cost(b));
    return ranked[0];
}

/** Whether completing this flow needs a registration token. */
export function flowNeedsToken(flow: RegistrationFlow | null): boolean {
    return !!flow?.stages.some((s) => s.endsWith("registration_token"));
}

/** Read `m.login.terms` params into the policies to show. */
export function termsPolicies(
    params: unknown,
    language = typeof navigator !== "undefined" ? navigator.language : "en",
): TermsPolicy[] {
    const policies = (params as { policies?: unknown } | null)?.policies;
    if (!policies || typeof policies !== "object") return [];
    const lang = language.toLowerCase();
    const out: TermsPolicy[] = [];
    for (const [id, raw] of Object.entries(policies)) {
        if (!raw || typeof raw !== "object") continue;
        const entries = Object.entries(raw as Record<string, unknown>).filter(
            ([k, v]) =>
                k !== "version" &&
                v &&
                typeof v === "object" &&
                typeof (v as { url?: unknown }).url === "string",
        ) as [string, { name?: unknown; url: string }][];
        const pick =
            entries.find(([k]) => k.toLowerCase() === lang) ??
            entries.find(([k]) => lang.startsWith(k.toLowerCase())) ??
            entries.find(([k]) => k === "en") ??
            entries[0];
        if (!pick) continue;
        out.push({
            id,
            name: typeof pick[1].name === "string" ? pick[1].name : id,
            url: pick[1].url,
        });
    }
    return out;
}

/** The server's fallback page for one stage of this UIA session. */
export function fallbackUrl(
    baseUrl: string,
    stage: string,
    session: string,
): string {
    return `${baseUrl.replace(/\/$/, "")}/_matrix/client/v3/auth/${encodeURIComponent(stage)}/fallback/web?session=${encodeURIComponent(session)}`;
}

function randomSecret(): string {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function asChallenge(err: unknown): RegistrationChallenge | null {
    const e = err as MatrixError | undefined;
    const data = e?.data as RegistrationChallenge | undefined;
    if (e?.httpStatus !== 401 || !data || !Array.isArray(data.flows))
        return null;
    return data;
}

export interface RegistrationDriver {
    /** POST /register with this auth (undefined on the first attempt). */
    submit: (auth: Record<string, unknown> | undefined) => Promise<unknown>;
    /** POST /register/email/requestToken; returns the session id. */
    requestEmailToken: (
        email: string,
        clientSecret: string,
        attempt: number,
    ) => Promise<{ sid: string }>;
}

/**
 * Run the registration UIA loop to completion. `token` pre-answers a
 * registration-token stage; `prompt` answers the rest. Resolves with the
 * server's final /register response; rejects with a readable error.
 */
export async function runRegistration<T>(opts: {
    baseUrl: string;
    driver: RegistrationDriver;
    token?: string;
    prompt: RegistrationPrompter;
}): Promise<T> {
    const { baseUrl, driver, prompt } = opts;
    let token = opts.token?.trim() || undefined;
    let auth: Record<string, unknown> | undefined;
    let lastStage: string | null = null;
    let emailCreds: { sid: string; client_secret: string } | null = null;
    // Guards a server that keeps asking for a stage we keep answering.
    let repeats = 0;

    for (let round = 0; round < 20; round++) {
        let challenge: RegistrationChallenge;
        try {
            return (await driver.submit(auth)) as T;
        } catch (err) {
            const c = asChallenge(err);
            if (!c) throw new Error(describeRegistrationError(err));
            challenge = c;
            // A 401 that carries an errcode is the stage we just sent being
            // refused (wrong token, unconfirmed email), not a fresh challenge.
            const errcode = (err as MatrixError).errcode;
            if (auth && lastStage && errcode) {
                if (lastStage.endsWith("registration_token")) {
                    token = (await askToken(prompt, true)) ?? undefined;
                    if (!token) break;
                } else if (lastStage === "m.login.email.identity") {
                    // Not confirmed yet: fall through and ask again.
                } else {
                    throw new Error(describeRegistrationError(err));
                }
            }
        }

        const session = challenge.session ?? "";
        const completed = challenge.completed ?? [];
        const flow = pickRegistrationFlow(challenge.flows, completed);
        if (!flow) throw new Error(t("registration.noSupportedFlow"));
        const stage = flow.stages.find((s) => !completed.includes(s));
        // Every stage of the flow is done but the server still says 401:
        // resubmitting with just the session finishes it.
        if (!stage) {
            auth = { session };
            lastStage = null;
            continue;
        }
        repeats = stage === lastStage ? repeats + 1 : 0;
        if (repeats > 4) throw new Error(t("registration.stageKeptFailing"));
        lastStage = stage;
        const params = challenge.params?.[stage];

        if (AUTOMATIC_STAGES.has(stage)) {
            auth = { type: stage, session };
        } else if (stage.endsWith("registration_token")) {
            if (!token) {
                token = (await askToken(prompt, false)) ?? undefined;
                if (!token) break;
            }
            auth = { type: stage, token, session };
            // A wrong token must be asked for again, never resent.
            token = undefined;
        } else if (stage === "m.login.terms") {
            const policies = termsPolicies(params);
            if (policies.length > 0) {
                const ok = await prompt({ kind: "terms", policies });
                if (ok === null) break;
            }
            auth = { type: stage, session };
        } else if (stage === "m.login.email.identity") {
            if (!emailCreds) {
                const clientSecret = randomSecret();
                let sid = "";
                const answered = await prompt({
                    kind: "email",
                    sent: false,
                    requestToken: async (email) => {
                        const res = await driver
                            .requestEmailToken(email, clientSecret, 1)
                            .catch((e) => {
                                throw new Error(describeRegistrationError(e));
                            });
                        sid = res.sid;
                    },
                });
                if (answered === null || !sid) break;
                emailCreds = { sid, client_secret: clientSecret };
            } else if (repeats > 0) {
                // Sent but not confirmed: wait for the user again.
                const answered = await prompt({
                    kind: "email",
                    sent: true,
                    requestToken: async () => {},
                });
                if (answered === null) break;
            }
            auth = {
                type: stage,
                threepid_creds: emailCreds,
                threepidCreds: emailCreds,
                session,
            };
        } else {
            const answered = await prompt({
                kind: "fallback",
                stage,
                url: fallbackUrl(baseUrl, stage, session),
            });
            if (answered === null) break;
            // After a fallback page the client resubmits with only the session.
            auth = { session };
        }
    }
    throw new RegistrationCancelledError();
}

async function askToken(
    prompt: RegistrationPrompter,
    retry: boolean,
): Promise<string | null> {
    const answer = await prompt({ kind: "token", retry });
    return answer?.trim() || null;
}

/** A human message for a failed registration (or availability) request. */
export function describeRegistrationError(err: unknown): string {
    const e = err as Partial<MatrixError> & { data?: { error?: string } };
    const serverText = e?.data?.error;
    switch (e?.errcode) {
        case "M_USER_IN_USE":
            return t("registration.userInUse");
        case "M_INVALID_USERNAME":
            return t("registration.invalidUsername");
        case "M_EXCLUSIVE":
            return t("registration.exclusiveUsername");
        case "M_WEAK_PASSWORD":
            return serverText
                ? t("registration.weakPasswordReason", { reason: serverText })
                : t("registration.weakPassword");
        case "M_PASSWORD_TOO_SHORT":
        case "M_PASSWORD_NO_DIGIT":
        case "M_PASSWORD_NO_UPPERCASE":
        case "M_PASSWORD_NO_LOWERCASE":
        case "M_PASSWORD_NO_SYMBOL":
        case "M_PASSWORD_IN_DICTIONARY":
            return serverText
                ? t("registration.weakPasswordReason", { reason: serverText })
                : t("registration.weakPassword");
        case "M_THREEPID_IN_USE":
            return t("registration.emailInUse");
        case "M_THREEPID_DENIED":
        case "M_SERVER_NOT_TRUSTED":
            return t("registration.emailNotAllowed");
        case "M_LIMIT_EXCEEDED":
            return t("registration.rateLimited");
        case "M_UNAUTHORIZED":
            return t("registration.stepNotAccepted");
        case "M_FORBIDDEN":
            if (/registration/i.test(serverText ?? ""))
                return t("registration.closed");
            if (/token/i.test(serverText ?? ""))
                return t("registration.invalidToken");
            return serverText
                ? t("registration.refusedReason", { reason: serverText })
                : t("registration.refused");
        case "M_UNRECOGNIZED":
            return t("registration.closed");
    }
    if (e?.httpStatus === 403) return t("registration.closed");
    if (serverText) return serverText;
    if (err instanceof Error && err.message) {
        // fetch() network failures say "Failed to fetch"; say what it means.
        if (err.name === "TypeError" || /fetch|network/i.test(err.message))
            return t("registration.serverUnreachable");
        return err.message;
    }
    return t("loginView.registrationFailed");
}

/** What a homeserver allows for sign-up, from a probe of `POST /register`. */
export type RegistrationSupport =
    | { kind: "open"; flow: RegistrationFlow | null; needsToken: boolean }
    | { kind: "closed" }
    | { kind: "unknown" };

/**
 * Read a `/register` probe result: a 401 challenge means sign-up is open
 * (and says which stages it takes), a 403 / M_FORBIDDEN means it is closed.
 * Anything else is unknown, and the form simply lets the user try.
 */
export function readRegistrationProbe(err: unknown): RegistrationSupport {
    const challenge = asChallenge(err);
    if (challenge) {
        const flow = pickRegistrationFlow(challenge.flows);
        return { kind: "open", flow, needsToken: isTokenOnly(challenge) };
    }
    const e = err as Partial<MatrixError> | undefined;
    if (
        e?.httpStatus === 403 ||
        e?.errcode === "M_FORBIDDEN" ||
        e?.errcode === "M_UNRECOGNIZED"
    )
        return { kind: "closed" };
    return { kind: "unknown" };
}

/** Every flow the server offers needs a registration token. */
function isTokenOnly(challenge: RegistrationChallenge): boolean {
    const flows = challenge.flows.filter((f) => f.stages?.length);
    return (
        flows.length > 0 &&
        flows.every((f) =>
            f.stages.some((s) => s.endsWith("registration_token")),
        )
    );
}

/** Usernames the spec allows (the localpart grammar, lowercased). */
export function usernameIssue(name: string): string | null {
    if (!name) return null;
    if (name !== name.toLowerCase()) return t("registration.usernameLowercase");
    if (!/^[a-z0-9._=\-/+]+$/.test(name))
        return t("registration.usernameCharacters");
    return null;
}
