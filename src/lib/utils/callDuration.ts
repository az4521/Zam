/** Elapsed call time: mm:ss, rolling to h:mm:ss once past an hour. */
export function formatCallDuration(ms: number): string {
    const total = Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 1000)) : 0;
    const seconds = total % 60;
    const minutes = Math.floor(total / 60) % 60;
    const hours = Math.floor(total / 3600);
    const pad = (n: number) => String(n).padStart(2, "0");
    return hours > 0
        ? `${hours}:${pad(minutes)}:${pad(seconds)}`
        : `${pad(minutes)}:${pad(seconds)}`;
}
