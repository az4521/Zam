// Undo/redo for the rich editors. They rewrite innerHTML on every change,
// which wipes the browser's native undo stack, so Ctrl+Z is driven from the
// model instead. The stack holds successive text values; consecutive
// typing/deleting within a short window coalesces into one step, like a
// native text field.

const UNDO_LIMIT = 200;
const UNDO_COALESCE_MS = 1000;

export class TextUndoHistory {
    private history: string[];
    private index = 0;
    private lastKind: string | null = null;
    private lastAt = 0;

    constructor(
        initial = "",
        private now: () => number = Date.now,
    ) {
        this.history = [initial];
    }

    reset(current: string): void {
        this.history = [current];
        this.index = 0;
        this.lastKind = null;
    }

    /**
     * Record `next`. `kind` groups native edits ("insert", "delete", or an
     * inputType); null is a programmatic change, which never coalesces.
     */
    record(next: string, kind: string | null): void {
        if (next === this.history[this.index]) return;
        // A programmatic clear is a send / command completing: start fresh so
        // Ctrl+Z doesn't resurrect an already-sent message.
        if (next === "" && kind === null) {
            this.reset("");
            return;
        }
        const now = this.now();
        const coalesce =
            kind !== null &&
            kind === this.lastKind &&
            now - this.lastAt < UNDO_COALESCE_MS &&
            this.index > 0;
        this.lastKind = kind;
        this.lastAt = now;
        this.history.length = this.index + 1; // drop the redo branch
        if (coalesce) {
            this.history[this.index] = next;
            return;
        }
        this.history.push(next);
        if (this.history.length > UNDO_LIMIT) this.history.shift();
        this.index = this.history.length - 1;
    }

    /** The text one step back (-1) or forward (1), or null at either end. */
    step(delta: -1 | 1): string | null {
        const target = this.index + delta;
        if (target < 0 || target >= this.history.length) return null;
        this.index = target;
        this.lastKind = null;
        return this.history[target];
    }
}

/** The inputType family an edit coalesces under. */
export function undoKind(inputType: string): string {
    return inputType.startsWith("insertText")
        ? "insert"
        : inputType.startsWith("delete")
          ? "delete"
          : inputType;
}

/** Caret for `to` after a jump from `from`: the end of the changed span. */
export function diffCaret(from: string, to: string): number {
    const max = Math.min(from.length, to.length);
    let prefix = 0;
    while (prefix < max && from[prefix] === to[prefix]) prefix++;
    let suffix = 0;
    while (
        suffix < max - prefix &&
        from[from.length - 1 - suffix] === to[to.length - 1 - suffix]
    )
        suffix++;
    return to.length - suffix;
}
