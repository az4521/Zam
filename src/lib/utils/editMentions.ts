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
 * new plain-text body. It is deliberately conservative: an original mention is
 * NEVER dropped. Additions come from full bare mxids literally typed in the new
 * body and from `extra`, the pills the editor resolved (the caller derives
 * them from the new body's autocomplete tokens and the original formatted_body).
 */

export type Mentions = { user_ids?: string[]; room?: boolean };

const MXID_RE = /@[\w.\-=+/]+:[\w.\-]+\.[a-z]{2,}/gi;

export function computeEditMentions(
    original: Mentions | undefined,
    newBody: string,
    extra?: { userIds?: string[]; room?: boolean },
): { topLevel: Mentions; resolved: Mentions } {
    const orig = original?.user_ids ?? [];
    const typed = newBody.match(MXID_RE) ?? [];
    const added = [...new Set([...typed, ...(extra?.userIds ?? [])])].filter(
        (id) => !orig.includes(id),
    );
    const resolvedIds = [...orig, ...added];
    const resolved: Mentions = {};
    if (resolvedIds.length) resolved.user_ids = resolvedIds;
    const newRoom = !!extra?.room && !original?.room;
    if (original?.room || extra?.room) resolved.room = true;
    const topLevel: Mentions = added.length ? { user_ids: added } : {};
    if (newRoom) topLevel.room = true;
    return { topLevel, resolved };
}
