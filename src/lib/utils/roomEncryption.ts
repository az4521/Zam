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
 * Default for the "Encrypt new direct messages" setting. OFF for v1: this
 * client is brand-new to E2EE and defaulting ON would silently make new DMs
 * unreadable to contacts whose clients aren't set up. Flip to `true` to change
 * the default. (This is the L4 spec's ⚑ decision lever.)
 */
export const DEFAULT_ENCRYPT_DMS = false;

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
