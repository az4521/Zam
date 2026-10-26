import { describe, expect, it, vi } from "vitest";
import {
    RegistrationCancelledError,
    describeRegistrationError,
    pickRegistrationFlow,
    readRegistrationProbe,
    runRegistration,
    termsPolicies,
    usernameIssue,
    type RegistrationDriver,
    type RegistrationPrompt,
} from "./registration";

/** A MatrixError-shaped UIA challenge. */
function challenge(
    flows: string[][],
    extra: Record<string, unknown> = {},
    errcode?: string,
) {
    return Object.assign(new Error("401"), {
        httpStatus: 401,
        errcode,
        data: {
            flows: flows.map((stages) => ({ stages })),
            session: "S",
            ...extra,
        },
    });
}

function driver(
    responses: ((auth: Record<string, unknown> | undefined) => unknown)[],
): RegistrationDriver & { calls: (Record<string, unknown> | undefined)[] } {
    const calls: (Record<string, unknown> | undefined)[] = [];
    return {
        calls,
        submit: async (auth) => {
            calls.push(auth);
            const next = responses.shift();
            if (!next) throw new Error("no more responses");
            const out = next(auth);
            if (out instanceof Error) throw out;
            return out;
        },
        requestEmailToken: vi.fn(async () => ({ sid: "SID" })),
    };
}

const ok = { user_id: "@a:x", access_token: "t", device_id: "d" };

describe("pickRegistrationFlow", () => {
    it("prefers the flow that asks the user the least", () => {
        const flow = pickRegistrationFlow([
            { stages: ["m.login.recaptcha", "m.login.terms"] },
            { stages: ["m.login.dummy"] },
        ]);
        expect(flow?.stages).toEqual(["m.login.dummy"]);
    });

    it("avoids flows with stages it can't render when another works", () => {
        const flow = pickRegistrationFlow([
            { stages: ["org.example.weird"] },
            { stages: ["m.login.email.identity"] },
        ]);
        expect(flow?.stages).toEqual(["m.login.email.identity"]);
    });

    it("sticks with the flow already in progress", () => {
        const flow = pickRegistrationFlow(
            [
                { stages: ["m.login.dummy"] },
                { stages: ["m.login.terms", "m.login.recaptcha"] },
            ],
            ["m.login.terms"],
        );
        expect(flow?.stages).toEqual(["m.login.terms", "m.login.recaptcha"]);
    });
});

describe("runRegistration", () => {
    it("completes a dummy stage without asking (Synapse open registration)", async () => {
        const d = driver([() => challenge([["m.login.dummy"]]), () => ok]);
        const prompt = vi.fn();
        await expect(
            runRegistration({ baseUrl: "https://x", driver: d, prompt }),
        ).resolves.toEqual(ok);
        expect(d.calls[1]).toEqual({ type: "m.login.dummy", session: "S" });
        expect(prompt).not.toHaveBeenCalled();
    });

    it("uses the form's token, and asks again when it's refused (tuwunel)", async () => {
        const d = driver([
            () => challenge([["m.login.registration_token"]]),
            () =>
                challenge([["m.login.registration_token"]], {}, "M_FORBIDDEN"),
            () => ok,
        ]);
        const prompts: RegistrationPrompt[] = [];
        const result = await runRegistration({
            baseUrl: "https://x",
            driver: d,
            token: "wrong",
            prompt: async (p) => {
                prompts.push(p);
                return "right";
            },
        });
        expect(result).toEqual(ok);
        expect(d.calls[1]).toMatchObject({ token: "wrong" });
        expect(d.calls[2]).toMatchObject({ token: "right" });
        expect(prompts).toEqual([{ kind: "token", retry: true }]);
    });

    it("asks for terms, then a captcha through the fallback page", async () => {
        const d = driver([
            () =>
                challenge([["m.login.terms", "m.login.recaptcha"]], {
                    params: {
                        "m.login.terms": {
                            policies: {
                                privacy: {
                                    version: "1",
                                    en: { name: "Privacy", url: "https://p" },
                                },
                            },
                        },
                    },
                }),
            () =>
                challenge([["m.login.terms", "m.login.recaptcha"]], {
                    completed: ["m.login.terms"],
                }),
            () => ok,
        ]);
        const kinds: string[] = [];
        await runRegistration({
            baseUrl: "https://x",
            driver: d,
            prompt: async (p) => {
                kinds.push(p.kind);
                if (p.kind === "fallback")
                    expect(p.url).toBe(
                        "https://x/_matrix/client/v3/auth/m.login.recaptcha/fallback/web?session=S",
                    );
                return "ok";
            },
        });
        expect(kinds).toEqual(["terms", "fallback"]);
        expect(d.calls[2]).toEqual({ session: "S" });
    });

    it("sends the email and submits its credentials", async () => {
        const d = driver([
            () => challenge([["m.login.email.identity"]]),
            () => ok,
        ]);
        await runRegistration({
            baseUrl: "https://x",
            driver: d,
            prompt: async (p) => {
                if (p.kind === "email") await p.requestToken("me@x");
                return "ok";
            },
        });
        expect(d.requestEmailToken).toHaveBeenCalledWith(
            "me@x",
            expect.any(String),
            1,
        );
        expect(d.calls[1]).toMatchObject({
            type: "m.login.email.identity",
            threepid_creds: { sid: "SID" },
        });
    });

    it("rejects as cancelled when the user backs out", async () => {
        const d = driver([() => challenge([["m.login.registration_token"]])]);
        await expect(
            runRegistration({
                baseUrl: "https://x",
                driver: d,
                prompt: async () => null,
            }),
        ).rejects.toBeInstanceOf(RegistrationCancelledError);
    });

    it("turns a non-UIA failure into a readable message", async () => {
        const d = driver([
            () =>
                Object.assign(new Error("x"), {
                    httpStatus: 400,
                    errcode: "M_USER_IN_USE",
                }),
        ]);
        await expect(
            runRegistration({
                baseUrl: "https://x",
                driver: d,
                prompt: async () => "",
            }),
        ).rejects.toThrow(
            describeRegistrationError({ errcode: "M_USER_IN_USE" }),
        );
    });
});

describe("readRegistrationProbe", () => {
    it("reads open, token-only and closed servers", () => {
        expect(readRegistrationProbe(challenge([["m.login.dummy"]]))).toEqual({
            kind: "open",
            flow: { stages: ["m.login.dummy"] },
            needsToken: false,
        });
        expect(
            readRegistrationProbe(challenge([["m.login.registration_token"]])),
        ).toMatchObject({ kind: "open", needsToken: true });
        expect(
            readRegistrationProbe({ httpStatus: 403, errcode: "M_FORBIDDEN" }),
        ).toEqual({ kind: "closed" });
        expect(readRegistrationProbe(new TypeError("fetch"))).toEqual({
            kind: "unknown",
        });
    });
});

describe("termsPolicies", () => {
    it("picks the user's language, then English", () => {
        const params = {
            policies: {
                tos: {
                    version: "2",
                    en: { name: "Terms", url: "https://en" },
                    de: { name: "Bedingungen", url: "https://de" },
                },
            },
        };
        expect(termsPolicies(params, "de-DE")).toEqual([
            { id: "tos", name: "Bedingungen", url: "https://de" },
        ]);
        expect(termsPolicies(params, "fr")).toEqual([
            { id: "tos", name: "Terms", url: "https://en" },
        ]);
    });
});

describe("usernameIssue", () => {
    it("accepts the localpart grammar and flags the rest", () => {
        expect(usernameIssue("alice.b_42")).toBeNull();
        expect(usernameIssue("Alice")).not.toBeNull();
        expect(usernameIssue("al ice")).not.toBeNull();
    });
});
