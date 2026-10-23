// Caret and text plumbing for the rich contenteditable editors (the composer
// and the inline message editor). Their model is a plain string where line
// breaks are "\n"; the DOM is that string decorated by decorateComposerText.

/**
 * Length of a node's content in model characters: text length plus one per
 * <br>. Range.toString() and text-node walks don't see <br> elements at all,
 * so using them uncorrected desyncs every caret offset by one per line break
 * above it, scrambling edits and pastes in multiline messages.
 */
export function modelLength(root: Node): number {
    let length = 0;
    const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    );
    let node = walker.nextNode();
    while (node) {
        if (node.nodeType === Node.TEXT_NODE) {
            length += node.textContent?.length ?? 0;
        } else if ((node as Element).tagName === "BR") {
            length += 1;
        }
        node = walker.nextNode();
    }
    return length;
}

/** The editor's model text. */
export function editorText(root: HTMLElement): string {
    const raw = root.innerText.replace(/ /g, " ");
    // The canonical DOM keeps a placeholder <br> after a trailing line break
    // (and browsers keep one in an emptied contenteditable), which innerText
    // reports as one extra newline: drop exactly one.
    return raw.replace(/\n$/, "");
}

/** The caret's model offset in `root`, or `fallback` when it isn't inside. */
export function caretOffset(root: HTMLElement, fallback: number): number {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return fallback;
    const range = selection.getRangeAt(0);
    if (!root.contains(range.endContainer)) return fallback;
    const preCaret = range.cloneRange();
    preCaret.selectNodeContents(root);
    preCaret.setEnd(range.endContainer, range.endOffset);
    return modelLength(preCaret.cloneContents());
}

/** Model length of the selection inside `root` (0 when collapsed or outside). */
export function selectedLength(root: HTMLElement): number {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return 0;
    const range = selection.getRangeAt(0);
    if (!root.contains(range.endContainer)) return 0;
    return modelLength(range.cloneContents());
}

/** Put a collapsed caret at model `offset` in `root` (clamped to its text). */
export function setCaretOffset(root: HTMLElement, offset: number): void {
    const target = Math.max(0, Math.min(offset, editorText(root).length));
    const place = (setup: (range: Range) => void) => {
        const range = document.createRange();
        const selection = window.getSelection();
        setup(range);
        range.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(range);
    };
    const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    );
    let remaining = target;
    let node = walker.nextNode();
    while (node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const len = node.textContent?.length ?? 0;
            if (remaining <= len) {
                const textNode = node;
                place((r) => r.setStart(textNode, remaining));
                return;
            }
            remaining -= len;
        } else if ((node as Element).tagName === "BR") {
            if (remaining === 0) {
                const br = node;
                place((r) => r.setStartBefore(br));
                return;
            }
            remaining -= 1;
        }
        node = walker.nextNode();
    }
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(root);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
}

/** Plain text from a paste: text/plain, else text/html projected to text. */
export function pastedPlainText(data: DataTransfer | null): string {
    let pasted = data?.getData("text/plain") ?? "";
    if (!pasted) {
        const html = data?.getData("text/html");
        // Parsing does not execute scripts; textContent drops all markup.
        if (html)
            pasted =
                new DOMParser().parseFromString(html, "text/html").body
                    .textContent ?? "";
    }
    return pasted;
}
