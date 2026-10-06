// Sending an edit of one of your own messages: the inline editor
// (MessageItem) and the composer's `s/old/new/` (sedEdit.ts) both go through
// here, so the two produce identical replacement events.

import type { MatrixEvent, Room } from "matrix-js-sdk";
import { getCustomEmojis, sendEdit } from "$lib/matrix/client";
import { buildFormattedBody, emoticonsFromHtml } from "$lib/utils/messageBody";
import { replaceEmojiShortcodes } from "$lib/data/emojiShortcodes";
import {
    isEditableContent,
    mediaEditBase,
} from "$lib/utils/editableMessage";
import { stripBodyFallback } from "$lib/utils/replyFallback";
import { applySedCommand, type SedCommand } from "$lib/utils/sedEdit";
import { roomsState } from "$lib/stores/rooms.svelte";
import { bumpReactionTick } from "$lib/stores/messages.svelte";

/** The text an edit of `event` starts from: its current body, minus any reply fallback. */
export function editableBody(event: MatrixEvent): string {
    const raw = (event.getContent()?.body as string | undefined) ?? "";
    const isReply =
        !!event.getOriginalContent()?.["m.relates_to"]?.["m.in_reply_to"];
    return isReply ? stripBodyFallback(raw) : raw;
}

/** Your newest message in `events` that can be edited inline, if any. */
export function lastEditableOwnMessage(
    events: MatrixEvent[],
    userId: string | null,
): MatrixEvent | undefined {
    for (let i = events.length - 1; i >= 0; i--) {
        const e = events[i];
        if (
            e.getId() &&
            e.getSender() === userId &&
            e.getType() === "m.room.message" &&
            isEditableContent(e.getContent())
        )
            return e;
    }
    return undefined;
}

/**
 * Whether `text` is empty once trimmed, for an event that is not captioned
 * media: such an edit would leave nothing, so callers offer to delete instead.
 */
export function isEmptyEdit(event: MatrixEvent, text: string): boolean {
    return !text.trim() && !mediaEditBase(event.getContent());
}

/** Send `text` as the new content of `event`. Throws when the send fails. */
export async function sendMessageEdit(
    room: Room,
    event: MatrixEvent,
    text: string,
): Promise<void> {
    // Custom emotes for this edit: the message's existing ones first so they
    // survive even if their pack is gone, then the current packs (which win on
    // a shortcode clash: later entries overwrite).
    const editEmotes = [
        ...emoticonsFromHtml(
            event.getContent().formatted_body as string | undefined,
        ),
        ...getCustomEmojis(room, roomsState.activeSpaceId),
    ];
    // Unicode `:shortcode:`s become emoji, as in the composer.
    const trimmed = replaceEmojiShortcodes(text.trim(), (code) =>
        editEmotes.some((e) => e.shortcode === code),
    );
    // Captioned media: the edit restates the media content, and an empty
    // caption just strips the caption (body falls back to the file name).
    const mediaBase = mediaEditBase(event.getContent());
    const newBody = trimmed || String(mediaBase?.filename ?? "");
    // Same rich-body pipeline as the composer, so a typed :shortcode: becomes
    // the custom emote.
    const formattedBody = trimmed
        ? buildFormattedBody(trimmed, {
              mentions: new Map(),
              customEmojis: editEmotes,
          }).html
        : null;
    // Latest resolved mentions live on the post-replacement content (the SDK
    // folds m.new_content in), so this carries them forward through the edit
    // per the v1.7 mentions module.
    await sendEdit(
        room.roomId,
        event.getId() ?? "",
        newBody,
        formattedBody ?? undefined,
        event.getContent()["m.mentions"],
        mediaBase,
    );
    bumpReactionTick();
}

export type SedEditResult = "edited" | "no-message" | "no-match" | "empty";

/** Apply `cmd` to your newest editable message in `events`. Throws when the send fails. */
export async function sedEditLastMessage(
    room: Room,
    events: MatrixEvent[],
    userId: string | null,
    cmd: SedCommand,
): Promise<SedEditResult> {
    const event = lastEditableOwnMessage(events, userId);
    if (!event) return "no-message";
    const next = applySedCommand(editableBody(event), cmd);
    if (next === null) return "no-match";
    if (isEmptyEdit(event, next)) return "empty";
    await sendMessageEdit(room, event, next);
    return "edited";
}
