import type { MatrixEvent } from "matrix-js-sdk";
import { t } from "$lib/i18n";
import { isPollStartEventType } from "$lib/utils/pollContent";
import { isFileOfferEventType } from "$lib/utils/fileTransfer";

/**
 * One-line text standing in for a message elsewhere (a reply quote, an
 * embedded message link). Events with no text of their own get a type
 * placeholder; null means the event has nothing to show (still encrypted, a
 * state event, …).
 */
export function eventPreviewText(ev: MatrixEvent): string | null {
    const c = ev.getContent();
    const type = ev.getType();
    if (type === "m.sticker") return t("messageItem.replyPreviewSticker");
    if (isPollStartEventType(type)) return t("messageItem.replyPreviewPoll");
    if (isFileOfferEventType(type))
        return t("messageItem.replyPreviewFileOffer");
    if (type === "m.room.message") {
        const b: string = c?.body ?? "";
        // Strip nested reply prefix from the quoted message's own body
        const parts = b.split("\n\n");
        if (parts.length >= 2 && parts[0].startsWith(">"))
            return parts.slice(1).join("\n\n");
        if (b) return b;
        switch (c?.msgtype) {
            case "m.image":
                return t("messageItem.replyPreviewImage");
            case "m.video":
                return t("messageItem.replyPreviewVideo");
            case "m.audio":
                return t("messageItem.replyPreviewAudio");
            case "m.file":
                return t("messageItem.replyPreviewFile");
        }
        return b;
    }
    return null;
}
