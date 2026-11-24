// Scheduled send (MSC4140): the account's messages the server is holding to
// send later. The server is the source of truth; this store mirrors its list
// and keeps a per-device plain-text preview of what this device scheduled
// (encrypted rooms' copies on the server are ciphertext).
//
// Refreshes are imperative (on first use, after every action, and when the
// soonest message falls due), never from a tracked `$effect`.
import { t } from "$lib/i18n";
import {
    cancelScheduledEvent,
    delayedEventsAdvertised,
    listScheduledEvents,
    scheduleRoomMessage,
    sendScheduledEventNow,
} from "$lib/matrix/client";
import { auth } from "$lib/stores/auth.svelte";
import { readScoped, writeScoped } from "$lib/utils/scopedStorage";
import { onSessionTeardown } from "$lib/utils/sessionCleanup";
import {
    delayUntil,
    prunePreviews,
    toScheduledMessages,
    type ScheduledMessage,
    type ScheduledPreviews,
} from "$lib/utils/scheduledMessages";

const PREVIEWS_KEY = "scheduledMessagePreviews";

export const scheduledState = $state<{
    items: ScheduledMessage[];
    /** Null until checked; false hides every schedule affordance. */
    supported: boolean | null;
    tick: number;
}>({ items: [], supported: null, tick: 0 });

let refreshSeq = 0;
let dueTimer: ReturnType<typeof setTimeout> | null = null;
let supportCheck: Promise<boolean> | null = null;

function readPreviews(): ScheduledPreviews {
    try {
        const raw = readScoped(PREVIEWS_KEY, auth.userId);
        const parsed = raw ? (JSON.parse(raw) as unknown) : null;
        return parsed && typeof parsed === "object"
            ? (parsed as ScheduledPreviews)
            : {};
    } catch {
        return {};
    }
}

function writePreviews(previews: ScheduledPreviews): void {
    writeScoped(PREVIEWS_KEY, auth.userId, JSON.stringify(previews));
}

/** Whether the homeserver can hold scheduled messages. Checked once per session. */
export function ensureScheduleSupport(): Promise<boolean> {
    supportCheck ??= delayedEventsAdvertised().then((ok) => {
        scheduledState.supported = ok;
        if (ok) void refreshScheduled();
        return ok;
    });
    return supportCheck;
}

/** Re-read the server's list. Overlapping refreshes: the newest one wins. */
export async function refreshScheduled(): Promise<void> {
    if (scheduledState.supported !== true) return;
    const seq = ++refreshSeq;
    let items: ScheduledMessage[];
    try {
        const previews = readPreviews();
        items = toScheduledMessages(await listScheduledEvents(), previews);
        if (seq !== refreshSeq) return;
        writePreviews(prunePreviews(previews, items));
    } catch (e) {
        console.warn("[scheduled] list failed", e);
        return;
    }
    scheduledState.items = items;
    scheduledState.tick++;
    armDueTimer();
}

/** Refresh shortly after the soonest message is due, so it leaves the list. */
function armDueTimer(): void {
    if (dueTimer) clearTimeout(dueTimer);
    dueTimer = null;
    const next = scheduledState.items[0];
    if (!next) return;
    // setTimeout overflows past ~24.8 days; re-arm daily until then.
    const wait = Math.min(
        Math.max(next.sendAt - Date.now() + 3_000, 1_000),
        24 * 60 * 60 * 1000,
    );
    dueTimer = setTimeout(() => {
        dueTimer = null;
        void refreshScheduled();
    }, wait);
}

export function scheduledForRoom(roomId: string): ScheduledMessage[] {
    void scheduledState.tick;
    return scheduledState.items.filter((m) => m.roomId === roomId);
}

/**
 * Schedule `content` for `roomId` at `sendAt`. `previewBody` is remembered on
 * this device so the list can show encrypted messages. Throws on failure
 * (with a readable message for the server's maximum delay).
 */
export async function scheduleMessage(
    roomId: string,
    content: Record<string, unknown>,
    sendAt: number,
    previewBody: string,
): Promise<void> {
    let delayId: string;
    try {
        delayId = await scheduleRoomMessage(
            roomId,
            content,
            delayUntil(sendAt, Date.now()),
        );
    } catch (e) {
        const err = e as { errcode?: string; data?: { max_delay?: number } };
        if (err.errcode === "M_MAX_DELAY_EXCEEDED") {
            const days = Math.floor((err.data?.max_delay ?? 0) / 86_400_000);
            throw new Error(
                days >= 1
                    ? t("scheduledMessages.tooFarAheadDays", { days })
                    : t("scheduledMessages.tooFarAhead"),
            );
        }
        throw e;
    }
    writePreviews({ ...readPreviews(), [delayId]: { body: previewBody } });
    await refreshScheduled();
}

export async function cancelScheduled(delayId: string): Promise<void> {
    await cancelScheduledEvent(delayId);
    await refreshScheduled();
}

export async function sendScheduledNow(delayId: string): Promise<void> {
    await sendScheduledEventNow(delayId);
    await refreshScheduled();
}

onSessionTeardown(() => {
    refreshSeq++;
    if (dueTimer) clearTimeout(dueTimer);
    dueTimer = null;
    supportCheck = null;
    scheduledState.items = [];
    scheduledState.supported = null;
    scheduledState.tick++;
});
