/** Collapsed height of a message code block, in rem. The CSS cap in
 *  MessageItem (`max-height` on `.message-body pre`) uses the same number,
 *  so the measured threshold and the rendered cap cannot drift apart. */
export const CODE_BLOCK_MAX_REM = 24;

/** Border-box height, in px, at which a code block is clipped, for a root
 *  font size of `rootFontPx`. */
export function codeBlockCapPx(rootFontPx: number): number {
    const root =
        Number.isFinite(rootFontPx) && rootFontPx > 0 ? rootFontPx : 16;
    return CODE_BLOCK_MAX_REM * root;
}

/** Does a block whose content (code text plus vertical padding and border)
 *  is `contentPx` tall get clipped by a cap of `capPx`? The 1px tolerance
 *  absorbs sub-pixel rounding so a block that just fits gets no button. */
export function codeBlockOverflows(contentPx: number, capPx: number): boolean {
    return contentPx > capPx + 1;
}

/** Stable key for one code block: the event it belongs to plus its position
 *  among that message's code blocks. */
export function codeBlockKey(eventKey: string, index: number): string {
    return `${eventKey}#${index}`;
}
