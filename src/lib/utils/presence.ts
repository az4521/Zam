// Presence mapping helpers (Matrix spec §14.6 Presence). Kept SDK-free —
// client.ts and the presence store feed in raw strings from matrix-js-sdk
// User objects / m.presence events; components consume the mapped values.
import { t } from "$lib/i18n";

/** The three presence states the spec allows a user to have. */
export type PresenceState = "online" | "unavailable" | "offline";

/** Discord-style status-dot categories the theme has colors for. */
export type PresenceDot = "online" | "idle" | "offline";

const PRESENCE_STATES: readonly PresenceState[] = [
    "online",
    "unavailable",
    "offline",
];

export function isPresenceState(value: unknown): value is PresenceState {
    return PRESENCE_STATES.includes(value as PresenceState);
}

/**
 * Normalize a raw presence string (from a User object, m.presence event or
 * persisted setting) to a spec state. Unknown values — including unstable
 * extensions like MSC3026 "busy" — degrade to "offline" rather than leaking
 * unstyled states into the UI.
 */
export function normalizePresence(value: unknown): PresenceState {
    return isPresenceState(value) ? value : "offline";
}

/** Matrix "unavailable" renders as Discord-style idle (orange). */
export function presenceDot(state: PresenceState): PresenceDot {
    return state === "unavailable" ? "idle" : state;
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
        case "offline":
            return "bg-discord-offline";
    }
}

export function presenceLabel(state: PresenceState): string {
    switch (state) {
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
