/**
 * A concurrency cap for playing videos. At most `max` keys hold a slot at
 * once; the rest wait in the order they asked. A slot freed by `cancel` goes
 * to the longest waiting key, which is then told to start via its grant.
 *
 * Pure bookkeeping: nothing here touches the DOM, so it is tested directly.
 */
export class PlaybackSlots<K> {
    private readonly active = new Set<K>();
    private readonly waiting = new Map<K, () => void>();

    constructor(readonly max: number) {}

    /** Ask for a slot. `grant` runs at once if one is free, else later when
     *  one frees. Asking again while already active or waiting is a no-op. */
    request(key: K, grant: () => void): void {
        if (this.active.has(key) || this.waiting.has(key)) return;
        if (this.active.size < this.max) {
            this.active.add(key);
            grant();
        } else {
            this.waiting.set(key, grant);
        }
    }

    /** Give up a slot, or stop waiting for one. Promotes the next waiter. */
    cancel(key: K): void {
        if (this.active.delete(key)) this.promote();
        else this.waiting.delete(key);
    }

    isActive(key: K): boolean {
        return this.active.has(key);
    }

    get activeCount(): number {
        return this.active.size;
    }

    get waitingCount(): number {
        return this.waiting.size;
    }

    private promote(): void {
        // Re-checked each pass: a grant may itself cancel or request.
        while (this.active.size < this.max && this.waiting.size > 0) {
            const [key, grant] = this.waiting.entries().next().value as [
                K,
                () => void,
            ];
            this.waiting.delete(key);
            this.active.add(key);
            grant();
        }
    }
}
