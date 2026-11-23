/** Most GIF results the picker keeps in memory. Past this, the oldest whole
 *  pages are dropped as new ones load, so a long scroll stays bounded. */
export const GIF_RESULT_CAP = 300;

/**
 * How many of the oldest pages to drop so the kept results, plus `incoming`
 * more, fit in `cap`. The newest page is always kept, even if it alone is over
 * the cap: dropping it would leave nothing to scroll from.
 */
export function pagesToDrop(
    pageLengths: readonly number[],
    cap: number,
    incoming: number,
): number {
    let total = 0;
    for (const n of pageLengths) total += n;
    let drop = 0;
    while (drop < pageLengths.length - 1 && total + incoming > cap) {
        total -= pageLengths[drop];
        drop++;
    }
    return drop;
}
