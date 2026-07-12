const RELATION_KEYS = new Set(["m.relates_to", "m.new_content", "m.mentions"]);

/**
 * Clone message content for a new room without carrying conversation-local
 * reply, thread, edit, or mention metadata into the destination.
 */
export function buildForwardContent(
    content: Record<string, unknown>,
): Record<string, unknown> {
    const clone = structuredClone(content);
    for (const key of RELATION_KEYS) delete clone[key];
    return clone;
}
