/**
 * Scheduled send (MSC4140 delayed events), SDK-free parts: turning the
 * server's delayed-event list into the composer's view, and the preset times
 * the schedule picker offers.
 *
 * The server holds each scheduled message as a delayed event and sends it at
 * `running_since + delay`. An encrypted room's message is encrypted when it is
 * scheduled, so the server copy is ciphertext; the readable preview comes from
 * this device's local record (`previews`) and is missing on other devices.
 */

/** One entry of the server's `GET /delayed_events` list, as client.ts maps it. */
export interface DelayedEventItem {
    delayId: string;
    roomId: string;
    type: string;
    content: Record<string, unknown>;
    stateKey?: string;
    delay: number;
    runningSince: number;
}

export interface ScheduledMessage {
    delayId: string;
    roomId: string;
    /** When the server will send it (ms since epoch). */
    sendAt: number;
    encrypted: boolean;
    /** Plain text preview, or null when this device has none (encrypted). */
    body: string | null;
}

export type ScheduledPreviews = Record<string, { body: string }>;

/**
 * Keep the account's scheduled timeline messages, soonest first. State events
 * (call membership uses delayed state events) and other event types (widgets
 * may schedule their own) are not the user's scheduled messages.
 */
export function toScheduledMessages(
    items: DelayedEventItem[],
    previews: ScheduledPreviews,
): ScheduledMessage[] {
    return items
        .filter(
            (item) =>
                item.stateKey === undefined &&
                (item.type === "m.room.message" ||
                    item.type === "m.room.encrypted"),
        )
        .map((item) => {
            const encrypted = item.type === "m.room.encrypted";
            const plain = item.content.body;
            return {
                delayId: item.delayId,
                roomId: item.roomId,
                sendAt: item.runningSince + item.delay,
                encrypted,
                body:
                    !encrypted && typeof plain === "string"
                        ? plain
                        : (previews[item.delayId]?.body ?? null),
            };
        })
        .sort((a, b) => a.sendAt - b.sendAt);
}

/** Drop previews whose scheduled message no longer exists on the server. */
export function prunePreviews(
    previews: ScheduledPreviews,
    live: ScheduledMessage[],
): ScheduledPreviews {
    const keep = new Set(live.map((m) => m.delayId));
    const out: ScheduledPreviews = {};
    for (const [id, preview] of Object.entries(previews)) {
        if (keep.has(id)) out[id] = preview;
    }
    return out;
}

/** Shortest delay we ask for: a time already past sends almost at once. */
export const MIN_SCHEDULE_DELAY_MS = 5_000;

export function delayUntil(sendAt: number, now: number): number {
    return Math.max(MIN_SCHEDULE_DELAY_MS, Math.round(sendAt - now));
}

export type SchedulePresetKey =
    "inOneHour" | "thisEvening" | "tomorrowMorning" | "mondayMorning";

export interface SchedulePreset {
    key: SchedulePresetKey;
    at: number;
}

/**
 * Quick picks for the schedule picker, in local time: in one hour; this
 * evening at 18:00 (only before 17:00); tomorrow at 09:00; next Monday at
 * 09:00 (skipped when tomorrow is Monday, which "tomorrow" already covers).
 */
export function schedulePresets(now: Date): SchedulePreset[] {
    const at = (days: number, hour: number) => {
        const d = new Date(now);
        d.setDate(d.getDate() + days);
        d.setHours(hour, 0, 0, 0);
        return d.getTime();
    };
    const presets: SchedulePreset[] = [
        { key: "inOneHour", at: now.getTime() + 60 * 60 * 1000 },
    ];
    if (now.getHours() < 17) {
        presets.push({ key: "thisEvening", at: at(0, 18) });
    }
    presets.push({ key: "tomorrowMorning", at: at(1, 9) });
    // Days until next Monday (1..7); Sunday -> 1, Monday -> 7.
    const toMonday = (8 - now.getDay()) % 7 || 7;
    if (toMonday !== 1) {
        presets.push({ key: "mondayMorning", at: at(toMonday, 9) });
    }
    return presets;
}

/** `YYYY-MM-DDTHH:mm` in local time, for an `<input type="datetime-local">`. */
export function toDateTimeLocal(ms: number): string {
    const d = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, "0");
    return (
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
        `T${pad(d.getHours())}:${pad(d.getMinutes())}`
    );
}

/** Parse a `datetime-local` value as local time; null when empty or invalid. */
export function fromDateTimeLocal(value: string): number | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
    if (!m) return null;
    const d = new Date(
        Number(m[1]),
        Number(m[2]) - 1,
        Number(m[3]),
        Number(m[4]),
        Number(m[5]),
    );
    return Number.isNaN(d.getTime()) ? null : d.getTime();
}
