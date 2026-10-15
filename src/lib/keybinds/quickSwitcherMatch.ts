/**
 * Ranking for the quick switcher (Ctrl+K): how well a room name matches
 * what was typed. Higher is better; null means no match. Whole-name prefix
 * beats a word start, which beats a substring, which beats the letters
 * appearing in order ("gnrl" finds "general").
 */
export function matchScore(name: string, query: string): number | null {
    const q = query.trim().toLowerCase();
    if (!q) return 0;
    const n = name.toLowerCase();
    if (n === q) return 1000;
    if (n.startsWith(q)) return 900 - n.length;
    const at = n.indexOf(q);
    if (at > 0) {
        const wordStart = /[\s\-_#.:/]/.test(n[at - 1]);
        return (wordStart ? 700 : 500) - at;
    }
    // Letters in order, scored by how tightly they cluster.
    let pos = -1;
    let gaps = 0;
    for (const ch of q) {
        const next = n.indexOf(ch, pos + 1);
        if (next === -1) return null;
        if (pos !== -1) gaps += next - pos - 1;
        pos = next;
    }
    return Math.max(1, 300 - gaps);
}
