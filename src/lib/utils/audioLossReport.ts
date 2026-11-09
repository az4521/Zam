// How a sender learns that someone listening to it loses packets. The SFU
// ends the RTCP feedback of each leg, so a sender only sees loss on its own
// uplink; each client therefore tells the call how much audio it loses on
// the way in, and everyone adds redundancy while anyone does.

export const AUDIO_LOSS_TOPIC = "moe.crafty.audioloss";
/** A report counts this long; senders repeat it while the loss lasts. */
export const LOSS_REPORT_TTL_MS = 10_000;
/** Resend an unchanged report this often while there is loss. */
export const LOSS_REPORT_REPEAT_MS = 6_000;
/** Loss below this is not worth reporting. */
export const LOSS_REPORT_MIN = 0.01;

export function encodeLossReport(loss: number): Uint8Array<ArrayBuffer> {
    const l = Math.round(Math.min(1, Math.max(0, loss)) * 1000) / 1000;
    return new TextEncoder().encode(JSON.stringify({ loss: l }));
}

/** The reported loss (0..1), or null for anything malformed. */
export function decodeLossReport(payload: Uint8Array): number | null {
    if (payload.byteLength > 128) return null;
    try {
        const raw: unknown = JSON.parse(new TextDecoder().decode(payload));
        const loss = (raw as { loss?: unknown } | null)?.loss;
        if (typeof loss !== "number" || !Number.isFinite(loss)) return null;
        return Math.min(1, Math.max(0, loss));
    } catch {
        return null;
    }
}

/** Whether to send a report now, and what it says: the first loss, a clear
 *  once it is gone, a change of a percent or more, or a repeat. */
export function nextLossReport(
    loss: number | null,
    last: { loss: number; at: number },
    now: number,
): number | null {
    if (loss === null) return null;
    const l = loss >= LOSS_REPORT_MIN ? loss : 0;
    if (l === 0) return last.loss > 0 ? 0 : null;
    if (Math.abs(l - last.loss) >= 0.01) return l;
    return now - last.at >= LOSS_REPORT_REPEAT_MS ? l : null;
}

/** The latest report from each other participant. */
export class ReportedLoss {
    private byIdentity = new Map<string, { loss: number; at: number }>();

    note(identity: string, loss: number, now: number): void {
        this.byIdentity.set(identity, { loss, at: now });
    }

    forget(identity: string): void {
        this.byIdentity.delete(identity);
    }

    /** The worst loss anyone reported within the TTL, or 0. */
    worst(now: number): number {
        let worst = 0;
        for (const [id, r] of this.byIdentity) {
            if (now - r.at > LOSS_REPORT_TTL_MS) {
                this.byIdentity.delete(id);
                continue;
            }
            worst = Math.max(worst, r.loss);
        }
        return worst;
    }
}
