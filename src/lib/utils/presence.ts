// Presence mapping helpers (Matrix spec §14.6 Presence). Kept SDK-free —
// client.ts and the presence store feed in raw strings from matrix-js-sdk
// User objects / m.presence events; components consume the mapped values.
import { t } from "$lib/i18n";

/** The three presence states the spec allows a user to have. */
export type PresenceState = "online" | "unavailable" | "offline";

/**
 * A presence as shown or sent: the spec states plus MSC3026 "busy", which is
 * what Do Not Disturb advertises on servers that support it. Not a choice of
 * its own in the presence picker, so settings keep PresenceState.
 */
export type SeenPresence = PresenceState | "busy";

/**
 * Wire spellings of MSC3026 busy. tuwunel (ruma, snake_case) uses plain
 * "busy"; Synapse uses the unstable "org.matrix.msc3026.busy". Both
 * advertise `org.matrix.msc3026.busy_presence` in /versions.
 */
export const BUSY_PRESENCE_VALUES = [
    "busy",
    "org.matrix.msc3026.busy",
] as const;
export const BUSY_PRESENCE_FEATURE = "org.matrix.msc3026.busy_presence";

/** Discord-style status-dot categories the theme has colors for. */
export type PresenceDot = "online" | "idle" | "dnd" | "offline";

const PRESENCE_STATES: readonly PresenceState[] = [
    "online",
    "unavailable",
    "offline",
];

export function isPresenceState(value: unknown): value is PresenceState {
    return PRESENCE_STATES.includes(value as PresenceState);
}

/**
 * Normalize a raw presence string (from a User object or m.presence event)
 * for rendering. MSC3026 busy, in either spelling, becomes "busy"; other
 * unknown values degrade to "offline" rather than leaking unstyled states
 * into the UI.
 */
export function normalizePresence(value: unknown): SeenPresence {
    if ((BUSY_PRESENCE_VALUES as readonly unknown[]).includes(value))
        return "busy";
    return isPresenceState(value) ? value : "offline";
}

/**
 * How long a device may sit without input before it advertises "unavailable"
 * instead of "online". Matches tuwunel's default presence_idle_timeout_s.
 */
export const AUTO_AWAY_MS = 300_000;

/**
 * What this device should advertise. Only a chosen "online" is automatic;
 * a chosen away or invisible is the user's call and stays as it is. The
 * server combines devices and shows the highest state, so an idle desktop
 * going away never hides a phone that is in use.
 */
export function advertisedPresence(
    chosen: SeenPresence,
    idleMs: number,
): SeenPresence {
    if (chosen !== "online") return chosen;
    return idleMs >= AUTO_AWAY_MS ? "unavailable" : "online";
}

/** Matrix "unavailable" renders as Discord-style idle (orange), busy as
 *  Do Not Disturb (red). */
export function presenceDot(state: SeenPresence): PresenceDot {
    if (state === "unavailable") return "idle";
    if (state === "busy") return "dnd";
    return state;
}

/**
 * Tailwind class per dot. Spelled out literally (not interpolated) so the
 * class scanner sees each one and emits it into the build.
 */
export function presenceDotClass(dot: PresenceDot): string {
    switch (dot) {
        case "online":
            return "bg-discord-online";
        case "idle":
            return "bg-discord-idle";
        case "dnd":
            return "bg-discord-dnd";
        case "offline":
            return "bg-discord-offline";
    }
}

export function presenceLabel(state: SeenPresence): string {
    switch (state) {
        case "busy":
            return t("presence.doNotDisturb");
        case "online":
            return t("presence.online");
        case "unavailable":
            return t("presence.away");
        case "offline":
            return t("presence.offline");
    }
}

/** Choices for the own-presence dropdown in Settings → Account. */
export const OWN_PRESENCE_OPTIONS: ReadonlyArray<{
    value: PresenceState;
    label: string;
    description: string;
}> = [
    {
        value: "online",
        label: t("presence.online"),
        description: t("presence.seenAsOnlineWhileTheApp"),
    },
    {
        value: "unavailable",
        label: t("presence.away"),
        description: t("presence.shownAsIdleToOtherUsers"),
    },
    {
        value: "offline",
        label: t("presence.invisible"),
        description: t("presence.appearOfflineToOtherUsers"),
    },
];
