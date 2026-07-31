/**
 * Pure view-model for the per-message E2EE "shield": the small badge that warns
 * when a decrypted message's encryption provenance is untrustworthy. SDK-free
 * (takes plain numbers, never a live `matrix-js-sdk` object) so it unit-tests
 * without the rust-crypto WASM.
 */

/**
 * Mirror of matrix-js-sdk's `EventShieldColour` enum (crypto-api) as plain
 * numbers. Duplicated here on purpose: importing the enum would pull the crypto
 * subpath into a module we want SDK-free and testable. `crypto.ts` passes the
 * real numeric values straight into these helpers.
 *
 * NOTE: `NONE` is 0 and therefore FALSY — always compare explicitly, never test
 * a colour for truthiness.
 */
export const EventShieldColourValue = {
    NONE: 0,
    GREY: 1,
    RED: 2,
} as const;

/**
 * Mirror of matrix-js-sdk's `EventShieldReason` enum. The SDK's `5`
 * (MISMATCHED_SENDER_KEY) and `6` (SENT_IN_CLEAR) are deliberately absent: both
 * are `@deprecated` and unreachable since the rust-crypto migration in v37, so
 * they fall through to the generic label.
 */
export const EventShieldReasonValue = {
    UNKNOWN: 0,
    UNVERIFIED_IDENTITY: 1,
    UNSIGNED_DEVICE: 2,
    UNKNOWN_DEVICE: 3,
    AUTHENTICITY_NOT_GUARANTEED: 4,
    VERIFICATION_VIOLATION: 7,
    MISMATCHED_SENDER: 8,
} as const;

/** Styling bucket: grey shields warn, red shields alarm. */
export type ShieldTone = "warning" | "danger";

/** Which lucide icon the component renders. */
export type ShieldIcon = "shield-alert" | "shield-x";

export interface ShieldView {
    icon: ShieldIcon;
    tone: ShieldTone;
    /** Human-readable explanation, used as both tooltip and accessible name. */
    label: string;
}

const GENERIC_LABEL = "This message's encryption could not be fully verified.";

/**
 * Wording per reason code. Kept close to the SDK's own doc comments so the
 * copy stays truthful to what the crypto layer actually checked.
 */
const REASON_LABELS: Record<number, string> = {
    [EventShieldReasonValue.UNKNOWN]: GENERIC_LABEL,
    [EventShieldReasonValue.UNVERIFIED_IDENTITY]:
        "Encrypted by an unverified user.",
    [EventShieldReasonValue.UNSIGNED_DEVICE]:
        "Encrypted by a device not verified by its owner.",
    [EventShieldReasonValue.UNKNOWN_DEVICE]:
        "Encrypted by an unknown or deleted device.",
    [EventShieldReasonValue.AUTHENTICITY_NOT_GUARANTEED]:
        "The authenticity of this encrypted message can't be guaranteed on this device.",
    [EventShieldReasonValue.VERIFICATION_VIOLATION]:
        "The sender was previously verified but changed their identity.",
    [EventShieldReasonValue.MISMATCHED_SENDER]:
        "The sender doesn't match the owner of the device that sent this message.",
};

/**
 * Badge for one event from the SDK's shield colour + reason. Returns `null`
 * when there is nothing to warn about — `NONE` means the message checked out,
 * and an unrecognised colour is treated the same way rather than guessing at a
 * severity we don't understand.
 */
export function shieldView(
    colour: number,
    reason: number | null,
): ShieldView | null {
    if (colour === EventShieldColourValue.NONE) return null;

    const label =
        reason === null
            ? GENERIC_LABEL
            : (REASON_LABELS[reason] ?? GENERIC_LABEL);

    if (colour === EventShieldColourValue.RED) {
        return { icon: "shield-x", tone: "danger", label };
    }
    if (colour === EventShieldColourValue.GREY) {
        return { icon: "shield-alert", tone: "warning", label };
    }
    return null;
}

/**
 * Whole-row decision for a timeline message. Shields only ever appear in
 * encrypted rooms; `info` is `null` both for unencrypted events and for events
 * that have not decrypted yet, and neither deserves a badge (the UTD row
 * already carries its own lock placeholder).
 */
export function shieldViewForEvent(input: {
    roomEncrypted: boolean;
    info: { colour: number; reason: number | null } | null;
}): ShieldView | null {
    if (!input.roomEncrypted) return null;
    if (!input.info) return null;
    return shieldView(input.info.colour, input.info.reason);
}

/**
 * Value equality for two shield views. `shieldView` mints a FRESH object every
 * call, so a component that re-derives the shield on every tick would assign a
 * new reference — and re-render the row — even when nothing about the shield
 * changed. Callers hold the previous value and skip the write when this says
 * the two are the same. `ShieldView` is three flat strings, so a shallow
 * comparison is exact, not an approximation.
 */
export function sameShield(
    a: ShieldView | null,
    b: ShieldView | null,
): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    return a.icon === b.icon && a.tone === b.tone && a.label === b.label;
}

/** Everything that can move one event's shield. See shieldRefreshKey. */
export interface ShieldRefreshInput {
    /** The row's event id — a reused row must refetch. */
    eventId: string;
    /** Flips "m.room.encrypted" -> the cleartext type when the event decrypts. */
    eventType: string;
    /** MatrixEvent.status: a local echo's shield is never memoized upstream. */
    status: string | null;
    /** Bumped on the same events that clear the crypto layer's shield memo. */
    securityTick: number;
}

/**
 * The identity of a row's shield inputs.
 *
 * The per-row shield effect depends on `timelineTick`, which is bumped for every
 * timeline event and every decryption anywhere in the app — so one incoming
 * message made every rendered row in an encrypted room fire an async crypto
 * call. Callers keep the last key and skip the fetch when it has not changed;
 * the tick dependency itself stays exactly where it was.
 *
 * The separator is a character that cannot appear in a Matrix event id, an event
 * type or an EventStatus, so distinct inputs cannot collide into one key.
 */
export function shieldRefreshKey(input: ShieldRefreshInput): string {
    return [
        input.eventId,
        input.eventType,
        input.status ?? "",
        String(input.securityTick),
    ].join("\u0000");
}
