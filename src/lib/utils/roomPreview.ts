import type { MatrixEvent } from "matrix-js-sdk";
import { t } from "$lib/i18n";
import { eventPreviewText } from "$lib/utils/eventPreviewText";
import { belongsToMainTimeline } from "$lib/utils/threadModel";
import {
    ENCRYPTED_MESSAGE_PLACEHOLDER,
    isUndecryptedEvent,
} from "$lib/utils/encryptionState";

// How far back to look for something showable before giving up — a run of
// state events or reactions longer than this leaves the row without a line.
const SCAN_LIMIT = 50;

/**
 * The newest message in a timeline and its one-line text: edits, reactions,
 * state events, redactions and thread replies are passed over. Null when
 * nothing in reach is showable. Shared by the row preview and the DM list's
 * recency sort, so a row sorts by the message it shows.
 */
export function latestMessage(
    events: readonly MatrixEvent[],
): { event: MatrixEvent; text: string } | null {
    const stop = Math.max(0, events.length - SCAN_LIMIT);
    for (let i = events.length - 1; i >= stop; i--) {
        const ev = events[i];
        if (ev.isState() || ev.isRedacted()) continue;
        const relatesTo = ev.getOriginalContent()?.["m.relates_to"];
        if (relatesTo?.rel_type === "m.replace") continue;
        if (!belongsToMainTimeline({ relatesTo, eventId: ev.getId() ?? "" }))
            continue;
        let text: string | null;
        // A failed decryption reads as m.room.message with the SDK's raw
        // "** Unable to decrypt **" body.
        if (isUndecryptedEvent(ev.getType()) || ev.isDecryptionFailure())
            text = ENCRYPTED_MESSAGE_PLACEHOLDER;
        else {
            text = eventPreviewText(ev);
            if (!text) continue;
            if (ev.getContent()?.msgtype === "m.emote") text = `* ${text}`;
        }
        // Collapse a multi-line body onto the row's single line.
        text = text.replace(/\s+/g, " ").trim();
        if (!text) continue;
        return { event: ev, text };
    }
    return null;
}

/**
 * One-line preview of the newest message in a timeline, for a room-list row.
 * Own messages get a "You: " prefix. Null when nothing in reach is showable.
 */
export function latestMessagePreview(
    events: readonly MatrixEvent[],
    ownUserId: string | null,
): string | null {
    const found = latestMessage(events);
    if (!found) return null;
    return found.event.getSender() === ownUserId
        ? t("roomList.previewYou", { text: found.text })
        : found.text;
}
