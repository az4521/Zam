import { describe, it, expect } from "vitest";
import {
    ENCRYPTION_ALGORITHM,
    ROOM_ENCRYPTION_EVENT_TYPE,
    DEFAULT_ENCRYPT_DMS,
    ENABLE_ENCRYPTION_CONFIRM_PHRASE,
    encryptionEventPowerLevel,
    getEnableEncryptionState,
    matchesEnableEncryptionConfirmation,
    encryptionInitialState,
    shouldEncryptNewDm,
    PLAINTEXT_DM_REUSE_WARNING,
    shouldWarnPlaintextDmReuse,
} from "./roomEncryption";

describe("constants", () => {
    it("uses the standard Megolm algorithm", () => {
        expect(ENCRYPTION_ALGORITHM).toBe("m.megolm.v1.aes-sha2");
    });

    it("uses the m.room.encryption state event type", () => {
        expect(ROOM_ENCRYPTION_EVENT_TYPE).toBe("m.room.encryption");
    });

    it("defaults new DMs to encrypted (user decision, 2026-07-30)", () => {
        expect(DEFAULT_ENCRYPT_DMS).toBe(true);
    });
});

describe("encryptionEventPowerLevel", () => {
    it("falls back to state_default when no explicit event PL", () => {
        expect(
            encryptionEventPowerLevel({ events: {}, state_default: 50 }),
        ).toBe(50);
    });

    it("prefers an explicit m.room.encryption event PL over state_default", () => {
        expect(
            encryptionEventPowerLevel({
                events: { "m.room.encryption": 100 },
                state_default: 50,
            }),
        ).toBe(100);
    });

    it("defaults to 50 when both are absent", () => {
        expect(encryptionEventPowerLevel({})).toBe(50);
    });
});

describe("getEnableEncryptionState", () => {
    const pl = { events: {}, state_default: 50 };

    it("allows enabling when PL is sufficient and the room is unencrypted", () => {
        const state = getEnableEncryptionState({
            alreadyEncrypted: false,
            myPowerLevel: 100,
            powerLevels: pl,
        });
        expect(state.canEnable).toBe(true);
        expect(state.reason).toBe("");
    });

    it("blocks when the room is already encrypted", () => {
        const state = getEnableEncryptionState({
            alreadyEncrypted: true,
            myPowerLevel: 100,
            powerLevels: pl,
        });
        expect(state.canEnable).toBe(false);
        expect(state.reason).toMatch(/already encrypted/i);
    });

    it("blocks when power level is insufficient, naming the required level", () => {
        const state = getEnableEncryptionState({
            alreadyEncrypted: false,
            myPowerLevel: 0,
            powerLevels: pl,
        });
        expect(state.canEnable).toBe(false);
        expect(state.reason).toContain("50");
    });

    it("reports already-encrypted even when PL is also too low", () => {
        const state = getEnableEncryptionState({
            alreadyEncrypted: true,
            myPowerLevel: 0,
            powerLevels: pl,
        });
        expect(state.canEnable).toBe(false);
        expect(state.reason).toMatch(/already encrypted/i);
    });

    it("respects an explicit high encryption-event PL", () => {
        const state = getEnableEncryptionState({
            alreadyEncrypted: false,
            myPowerLevel: 50,
            powerLevels: {
                events: { "m.room.encryption": 100 },
                state_default: 50,
            },
        });
        expect(state.canEnable).toBe(false);
        expect(state.reason).toContain("100");
    });
});

describe("matchesEnableEncryptionConfirmation", () => {
    it("matches the exact phrase", () => {
        expect(
            matchesEnableEncryptionConfirmation(
                ENABLE_ENCRYPTION_CONFIRM_PHRASE,
            ),
        ).toBe(true);
    });

    it("ignores surrounding whitespace and case", () => {
        expect(matchesEnableEncryptionConfirmation("  enable ")).toBe(true);
        expect(matchesEnableEncryptionConfirmation("Enable")).toBe(true);
    });

    it("rejects empty or partial input", () => {
        expect(matchesEnableEncryptionConfirmation("")).toBe(false);
        expect(matchesEnableEncryptionConfirmation("enabl")).toBe(false);
        expect(matchesEnableEncryptionConfirmation("enable now")).toBe(false);
    });
});

describe("encryptionInitialState", () => {
    it("returns an m.room.encryption initial_state entry when encrypting", () => {
        expect(encryptionInitialState(true)).toEqual([
            {
                type: "m.room.encryption",
                state_key: "",
                content: { algorithm: "m.megolm.v1.aes-sha2" },
            },
        ]);
    });

    it("returns undefined when not encrypting", () => {
        expect(encryptionInitialState(false)).toBeUndefined();
    });
});

describe("shouldEncryptNewDm", () => {
    it("encrypts when crypto is up and the setting is on", () => {
        expect(shouldEncryptNewDm({ cryptoReady: true, setting: true })).toBe(
            true,
        );
    });

    it("does not encrypt when the user turned the setting off", () => {
        expect(shouldEncryptNewDm({ cryptoReady: true, setting: false })).toBe(
            false,
        );
    });

    // Creating an encrypted room this session's crypto layer cannot encrypt for
    // would produce a DM that renders as secure and refuses every send, and
    // encryption is irreversible — so a dead crypto layer always wins.
    it("does not encrypt when crypto failed to start, even with the setting on", () => {
        expect(shouldEncryptNewDm({ cryptoReady: false, setting: true })).toBe(
            false,
        );
    });

    it("does not encrypt when crypto is down and the setting is off", () => {
        expect(shouldEncryptNewDm({ cryptoReady: false, setting: false })).toBe(
            false,
        );
    });
});

describe("shouldWarnPlaintextDmReuse", () => {
    it("warns when an existing plaintext DM is reused and the user wanted encryption", () => {
        expect(
            shouldWarnPlaintextDmReuse({
                followUpStatus: "none",
                wantEncrypted: true,
                roomEncrypted: false,
            }),
        ).toBe(true);
    });

    it("does not warn when the reused room is already encrypted", () => {
        expect(
            shouldWarnPlaintextDmReuse({
                followUpStatus: "none",
                wantEncrypted: true,
                roomEncrypted: true,
            }),
        ).toBe(false);
    });

    it("does not warn when the user didn't want encryption", () => {
        expect(
            shouldWarnPlaintextDmReuse({
                followUpStatus: "none",
                wantEncrypted: false,
                roomEncrypted: false,
            }),
        ).toBe(false);
    });

    it("does not warn on a fresh creation (a follow-up ran, so status !== none)", () => {
        for (const followUpStatus of ["ok", "failed", "unconfirmed"]) {
            expect(
                shouldWarnPlaintextDmReuse({
                    followUpStatus,
                    wantEncrypted: true,
                    roomEncrypted: false,
                }),
            ).toBe(false);
        }
    });

    it("exposes non-empty shared warning copy", () => {
        expect(PLAINTEXT_DM_REUSE_WARNING.length).toBeGreaterThan(0);
    });
});
