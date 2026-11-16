// The content to draw for a message that may have been edited.
//
// matrix-js-sdk's getContent() returns the applied replacement's m.new_content,
// or {} when that replacement cannot be read: the SDK's event mapper applies a
// bundled edit (MSC3925, unsigned["m.relations"]["m.replace"]) before the edit
// has decrypted, and a failed decryption never gains m.new_content at all. The
// pre-edit content is still on the event (getOriginalContent()), so draw that
// rather than an empty row with only the "(edited)" marker.

//
// An MSC4553 forward draws the original message it carries, never its text
// fallback, and edits targeting a forward are ignored.

import type { IContent } from "matrix-js-sdk";
import { forwardDisplayContent, readForward } from "./forwarded";

type Content = IContent;

/** The parts of a MatrixEvent this needs (structural, so tests can fake it). */
export interface ReplaceableEvent {
    getContent(): Content;
    getOriginalContent(): Content;
    replacingEvent(): unknown;
    isRedacted(): boolean;
    localRedactionEvent?(): unknown;
    getType?(): string;
}

/**
 * The event's effective content, or its original content when an applied
 * edit left the effective content empty (unreadable replacement). Redactions
 * keep their empty content. A forward yields the content it forwards.
 */
export function displayContent<T extends Content = Content>(
    event: ReplaceableEvent,
): T {
    const type = event.getType?.();
    if (type && !event.isRedacted()) {
        const original = event.getOriginalContent();
        if (readForward(original, type))
            return forwardDisplayContent(original, type) as T;
    }
    const content = event.getContent();
    if (content && Object.keys(content).length > 0) return content as T;
    if (!event.replacingEvent()) return content as T;
    if (event.isRedacted() || event.localRedactionEvent?.())
        return content as T;
    return (event.getOriginalContent() ?? content) as T;
}
