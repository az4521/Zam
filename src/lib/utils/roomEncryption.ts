/**
 * Pure helpers for E2EE Layer 4 (create / enable encrypted rooms): the fixed
 * Megolm algorithm + event-type constants, the power-level gate for who may
 * turn encryption on, the typed-confirmation check for the irreversible enable
 * action, and the `initial_state` builder for creating an already-encrypted
 * room. SDK-free so it can be unit-tested.
 */

/** The only encryption algorithm this client enables (Matrix standard). */
export const ENCRYPTION_ALGORITHM = "m.megolm.v1.aes-sha2";

/** State event type that switches a room to encrypted. */
export const ROOM_ENCRYPTION_EVENT_TYPE = "m.room.encryption";

/**
 * Default for the "Encrypt new direct messages" setting: ON. New DMs are
 * encrypted unless the account explicitly turned the setting off (user
 * decision, 2026-07-30 — taken deliberately, over a recommendation to wait for
 * the tuwunel federation pass).
 *
 * This is only the fallback for an account that has never touched the toggle:
 * `settings.svelte.ts` persists an explicit choice per account, so flipping
 * this constant never overrides anyone's stored preference.
 */
export const DEFAULT_ENCRYPT_DMS = true;

/** Word the user must type to confirm the irreversible enable-encryption step. */
export const ENABLE_ENCRYPTION_CONFIRM_PHRASE = "ENABLE";

/** Warning shown before enabling encryption; it can never be turned off again. */
export const ENABLE_ENCRYPTION_WARNING =
    "Encryption can't be turned off once it's on. Everyone will need a client " +
    "that supports encryption to read new messages.";

/** Minimal shape of a room's power-levels needed to gate the encryption event. */
export interface EncryptionPowerLevels {
    events?: Record<string, number>;
    state_default?: number;
}

/**
 * The power level required to send the `m.room.encryption` state event: an
 * explicit per-event level if the room sets one, otherwise `state_default`
 * (spec default 50 when unset).
 */
export function encryptionEventPowerLevel(pl: EncryptionPowerLevels): number {
    const explicit = pl.events?.[ROOM_ENCRYPTION_EVENT_TYPE];
    if (typeof explicit === "number") return explicit;
    return pl.state_default ?? 50;
}

export interface EnableEncryptionInput {
    /** Whether the room already has encryption switched on. */
    alreadyEncrypted: boolean;
    /** The current user's power level in the room. */
    myPowerLevel: number;
    /** The room's power-levels content (for the required-level lookup). */
    powerLevels: EncryptionPowerLevels;
}

export interface EnableEncryptionState {
    /** True only when encryption can be enabled right now. */
    canEnable: boolean;
    /** Empty when `canEnable`; otherwise the reason it's disabled. */
    reason: string;
}

/**
 * Whether the current user may enable encryption for a room, and if not, why.
 * Already-encrypted takes precedence over an insufficient power level so the
 * status reads correctly regardless of role.
 */
export function getEnableEncryptionState(
    input: EnableEncryptionInput,
): EnableEncryptionState {
    if (input.alreadyEncrypted) {
        return { canEnable: false, reason: "This room is already encrypted." };
    }
    const required = encryptionEventPowerLevel(input.powerLevels);
    if (input.myPowerLevel < required) {
        return {
            canEnable: false,
            reason: `You need power level ${required} to enable encryption.`,
        };
    }
    return { canEnable: true, reason: "" };
}

/**
 * Whether the user's typed input confirms the irreversible enable step. Trimmed
 * and case-insensitive: the gate is deliberateness (type the whole word), not
 * exact keystrokes.
 */
export function matchesEnableEncryptionConfirmation(input: string): boolean {
    return (
        input.trim().toUpperCase() ===
        ENABLE_ENCRYPTION_CONFIRM_PHRASE.toUpperCase()
    );
}

/** One `m.room.encryption` state event, as `createRoom` `initial_state` expects. */
export interface EncryptionInitialStateEntry {
    type: string;
    state_key: string;
    content: { algorithm: string };
}

/**
 * The `initial_state` array for creating an already-encrypted room, or
 * `undefined` when the room should be created unencrypted (so callers can spread
 * it straight into `createRoom` opts without an extra empty key).
 */
export function encryptionInitialState(
    encrypt: boolean,
): EncryptionInitialStateEntry[] | undefined {
    if (!encrypt) return undefined;
    return [
        {
            type: ROOM_ENCRYPTION_EVENT_TYPE,
            state_key: "",
            content: { algorithm: ENCRYPTION_ALGORITHM },
        },
    ];
}

/** Inputs to the "should this new DM be encrypted?" question. */
export interface NewDmEncryptionInput {
    /** Whether rust-crypto started successfully on this session. */
    cryptoReady: boolean;
    /** The account's "Encrypt new direct messages" setting. */
    setting: boolean;
}

/**
 * Whether a DM about to be created should be created encrypted.
 *
 * Both conditions are required. Encryption is irreversible, so creating an
 * encrypted room while this session's crypto layer is down would leave a DM
 * that reads as secure in the UI and rejects every send — a worse outcome than
 * an unencrypted DM the user can upgrade later.
 */
export function shouldEncryptNewDm(input: NewDmEncryptionInput): boolean {
    return input.cryptoReady && input.setting;
}

/**
 * Warning shown when a "Message" action reuses an EXISTING plaintext DM while
 * the user has "encrypt new DMs" on. Reuse deliberately never upgrades the
 * room (encryption is irreversible), so the only cue is the absence of a lock —
 * easy to miss. Shared by all three DM entry points.
 */
export const PLAINTEXT_DM_REUSE_WARNING =
    "You already have a direct message with this user, and it isn't encrypted. Encryption can't be added automatically - open it and turn it on from the room's Security settings.";

/** Inputs to "should we warn that this DM is an un-upgraded plaintext reuse?". */
export interface PlaintextDmReuseInput {
    /**
     * The DM open's follow-up status. `"none"` is the ONLY value that means an
     * existing joined DM was reused (createDirectMessage's early return is the
     * sole path that skips a follow-up); a fresh create always runs one.
     */
    followUpStatus: string;
    /** Whether the caller asked for an encrypted DM (`shouldEncryptNewDm(...)`). */
    wantEncrypted: boolean;
    /** Whether the resolved room is actually encrypted right now. */
    roomEncrypted: boolean;
}

/**
 * Whether to warn the user that they were dropped into an un-upgraded plaintext
 * DM despite wanting encryption. See {@link PLAINTEXT_DM_REUSE_WARNING}.
 */
export function shouldWarnPlaintextDmReuse(
    input: PlaintextDmReuseInput,
): boolean {
    return (
        input.followUpStatus === "none" &&
        input.wantEncrypted &&
        !input.roomEncrypted
    );
}
