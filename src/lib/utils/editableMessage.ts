// Which of the user's own messages can be edited inline, and what an edit of a
// captioned media event must carry over.
//
// Per MSC2530 a media event with a caption keeps the file name in `filename`
// and the caption in `body`/`formatted_body`. Editing the caption is an
// m.replace whose m.new_content is the FULL media content (url/file/info/...)
// with the new caption, since m.new_content replaces the whole content.

const CAPTIONABLE_MSGTYPES = new Set([
    "m.image",
    "m.video",
    "m.audio",
    "m.file",
]);

type Content = Record<string, unknown> | undefined | null;

/** True when `content` is a media event carrying a real caption. */
export function hasMediaCaption(content: Content): boolean {
    if (!content || !CAPTIONABLE_MSGTYPES.has(content.msgtype as string)) {
        return false;
    }
    const filename = content.filename;
    const body = content.body;
    return (
        typeof filename === "string" &&
        typeof body === "string" &&
        !!filename &&
        !!body &&
        filename !== body
    );
}

/** Whether an m.room.message with this content supports inline editing. */
export function isEditableContent(content: Content): boolean {
    if (!content) return false;
    return content.msgtype === "m.text" || hasMediaCaption(content);
}

/**
 * The media fields an edit of a captioned media event carries over into
 * m.new_content: everything except the caption text, its formatting, the
 * mentions (recomputed by the edit) and any relation. Returns undefined for
 * non-media content.
 */
export function mediaEditBase(
    content: Content,
): Record<string, unknown> | undefined {
    if (!content || !CAPTIONABLE_MSGTYPES.has(content.msgtype as string)) {
        return undefined;
    }
    const {
        body: _body,
        format: _format,
        formatted_body: _formattedBody,
        "m.mentions": _mentions,
        "m.relates_to": _relatesTo,
        "m.new_content": _newContent,
        ...rest
    } = content;
    return rest;
}
