/**
 * m.mentions handling for m.replace edits (Matrix v1.7 mentions module).
 *
 * The spec splits mentions across the two content halves of a replacement:
 *   - top-level `m.mentions` = the mentions NEWLY introduced by THIS revision
 *     (drives the push/notification pass for the edit event itself), and
 *   - `m.new_content.m.mentions` = the RESOLVED final mention set for the
 *     message after the edit.
 *
 * This helper computes both from the original resolved mention set plus the
 * new plain-text body. It is deliberately conservative: a plain-text edit box
 * cannot prove a mention was intentionally removed (the pill anchors in
 * formatted_body are lost — see the ⚑ deferred note in sendEdit), so an
 * original mention is NEVER dropped. Only full bare mxids literally typed in
 * the new body count as additions.
 */

export type Mentions = { user_ids?: string[]; room?: boolean };

const MXID_RE = /@[\w.\-=+/]+:[\w.\-]+\.[a-z]{2,}/gi;

export function computeEditMentions(
    original: Mentions | undefined,
    newBody: string,
): { topLevel: Mentions; resolved: Mentions } {
    const orig = original?.user_ids ?? [];
    const typed = [...new Set(newBody.match(MXID_RE) ?? [])];
    const added = typed.filter((id) => !orig.includes(id));
    const resolvedIds = [...orig, ...added];
    const resolved: Mentions = {};
    if (resolvedIds.length) resolved.user_ids = resolvedIds;
    if (original?.room) resolved.room = true;
    const topLevel: Mentions = added.length ? { user_ids: added } : {};
    return { topLevel, resolved };
}
