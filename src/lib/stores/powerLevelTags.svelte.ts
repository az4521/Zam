/**
 * Reactive access to a room's MSC3949 power level tags for components.
 *
 * SDK state changes for the tags event are not reflected by roomsTick, so
 * components call `acquirePowerLevelTags` (ref-counted) while they show tags,
 * and read `effectiveRoomTags` inside `$derived` so they re-run when the
 * room's tags change.
 *
 * There is deliberately no per-room result cache here: the tags event can
 * arrive without a change event reaching the subscription (the room's state
 * loaded after the first read, or no client yet when a component mounted),
 * and a cache keyed only on the tick then served the defaults forever. The
 * read is cheap instead: client.ts memoises the parsed tags per state event.
 */
import { t } from "$lib/i18n";
import {
    getRoomPowerLevelTags,
    onPowerLevelTagsChanged,
} from "$lib/matrix/client";
import {
    defaultPowerLevelTags,
    type PowerLevelTags,
} from "$lib/utils/powerLevelTags";

export interface EffectiveRoomTags {
    /** The room's own tags, or the localised defaults when it has none. */
    tags: PowerLevelTags;
    /** True when the room defines its own tags event. */
    custom: boolean;
}

/** Bumped per room when its tags event changes. */
let tagTicks = $state<Record<string, number>>({});

interface Subscription {
    refs: number;
    off: () => void;
}
const subscriptions = new Map<string, Subscription>();

/**
 * Keep a room's tags live while the caller is mounted. Returns the release
 * function; call it from the `$effect` cleanup.
 */
export function acquirePowerLevelTags(roomId: string): () => void {
    let sub = subscriptions.get(roomId);
    if (!sub) {
        const off = onPowerLevelTagsChanged(roomId, () => {
            tagTicks[roomId] = (tagTicks[roomId] ?? 0) + 1;
        });
        sub = { refs: 0, off };
        subscriptions.set(roomId, sub);
    }
    sub.refs++;
    let released = false;
    return () => {
        if (released) return;
        released = true;
        const current = subscriptions.get(roomId);
        if (!current) return;
        current.refs--;
        if (current.refs <= 0) {
            current.off();
            subscriptions.delete(roomId);
        }
    };
}

// The localised defaults, rebuilt only when the labels change (locale switch).
let defaultsKey = "";
let defaults: EffectiveRoomTags | null = null;

function defaultTags(): EffectiveRoomTags {
    const admin = t("roomSettings.admin");
    const moderator = t("roomSettings.moderator");
    const member = t("memberList.defaultRoleMember");
    const key = `${admin}\u0000${moderator}\u0000${member}`;
    if (!defaults || key !== defaultsKey) {
        defaultsKey = key;
        defaults = {
            tags: defaultPowerLevelTags({ admin, moderator, member }),
            custom: false,
        };
    }
    return defaults;
}

/**
 * The room's effective tags. Reads the reactive tick, so call it inside
 * `$derived` or a template expression.
 */
export function effectiveRoomTags(roomId: string): EffectiveRoomTags {
    void tagTicks[roomId];
    const raw = getRoomPowerLevelTags(roomId);
    return raw !== null ? { tags: raw, custom: true } : defaultTags();
}
