// How a screen sharer learns that its viewers can't keep up. A share sent as
// one layer (H.264, and every native Windows share) gives the call server
// nothing lighter to send a viewer whose connection can't carry it, so the
// server pauses and resumes that viewer (a keyframe each time) or forwards
// into loss: the share stutters, freezes and rubber-bands while looking
// sharp in between. The sharer only sees its own uplink, so each viewer tells
// it how the share arrives, and the sharer holds its bitrate under what the
// worst viewer copes with (cut quickly, raised again slowly).

export const SHARE_HEALTH_TOPIC = "moe.crafty.sharehealth";
/** A report counts this long; viewers repeat theirs while they watch. */
export const SHARE_HEALTH_TTL_MS = 10_000;
/** Packet loss on a share, over one sample, that counts as struggling. */
export const SHARE_LOSS_CONGESTED = 0.02;
/** Each cut keeps this much of the bitrate. */
export const SHARE_CAP_DECREASE = 0.7;
/** Cuts are at least this far apart, so one bad sample cuts once. */
export const SHARE_CAP_DECREASE_GAP_MS = 4_000;
/** Raising waits this long after the last struggling report... */
export const SHARE_CAP_RECOVER_AFTER_MS = 15_000;
/** ...then raises by this factor at most this often. */
export const SHARE_CAP_INCREASE = 1.15;
export const SHARE_CAP_INCREASE_GAP_MS = 5_000;
/** The cap never goes below this. */
export const SHARE_CAP_FLOOR = 600_000;
/** Loss alone cuts to no less than this share of the pick: loss on a
 *  viewer's own Wi-Fi does not go away with a lower bitrate, and must not
 *  hold the share at the floor. A pause (the share doesn't fit) can go
 *  lower. */
export const SHARE_CAP_LOSS_FLOOR = 0.5;
/** Loss this heavy means the viewer's link is full, not merely lossy: the
 *  call server forwards a one-layer share into a bottleneck it doesn't fit
 *  (measured on a LiveKit SFU: viewer capped at 2 Mbps, share 3.3 Mbps, ~60%
 *  loss, no pause, 0 frames decoded for as long as it lasted). The cap then
 *  goes straight under what the viewer actually receives. */
export const SHARE_LOSS_HEAVY = 0.1;
/** Share of the viewer's received bitrate the cap is set to on heavy loss. */
export const SHARE_CAP_DELIVERED_SHARE = 0.85;
/** How long a heavy-loss ceiling holds the cap down before recovery may go
 *  above it again (otherwise the cap climbs back into the same freeze). */
export const SHARE_CAP_CEILING_MS = 120_000;

/** One viewer's view of one share, over its last sample. */
export interface ShareHealth {
    /** Share of the share's packets lost on the way in (0..1). */
    loss: number;
    /** The call server paused the share for this viewer (not enough room). */
    paused: boolean;
    /** Freezes the viewer's player counted in the sample. */
    freezes: number;
    /** Bitrate the viewer received for the share over the sample, kbps.
     *  Missing from older clients. */
    kbps?: number;
}

export function encodeShareHealth(h: ShareHealth): Uint8Array<ArrayBuffer> {
    return new TextEncoder().encode(
        JSON.stringify({
            loss: Math.round(Math.min(1, Math.max(0, h.loss)) * 1000) / 1000,
            paused: h.paused,
            freezes: Math.max(0, Math.round(h.freezes)),
            ...(typeof h.kbps === "number" && Number.isFinite(h.kbps)
                ? { kbps: Math.max(0, Math.round(h.kbps)) }
                : {}),
        }),
    );
}

/** The report, or null for anything malformed. */
export function decodeShareHealth(payload: Uint8Array): ShareHealth | null {
    if (payload.byteLength > 256) return null;
    try {
        const raw = JSON.parse(new TextDecoder().decode(payload)) as Record<
            string,
            unknown
        > | null;
        if (!raw || typeof raw !== "object") return null;
        const { loss, paused, freezes, kbps } = raw;
        if (typeof loss !== "number" || !Number.isFinite(loss)) return null;
        if (typeof paused !== "boolean") return null;
        if (typeof freezes !== "number" || !Number.isFinite(freezes))
            return null;
        return {
            loss: Math.min(1, Math.max(0, loss)),
            paused,
            freezes: Math.max(0, Math.round(freezes)),
            ...(typeof kbps === "number" && Number.isFinite(kbps) && kbps >= 0
                ? { kbps: Math.round(kbps) }
                : {}),
        };
    } catch {
        return null;
    }
}

/** Whether a report says the viewer can't keep up: the call server paused
 *  the share for them, or its packets are being lost. Freezes are reported
 *  but don't count: a share of something still (a document, a paused game)
 *  only sends frames when the picture changes, and the player counts those
 *  gaps as freezes. */
export function shareHealthCongested(h: ShareHealth): boolean {
    return h.paused || h.loss >= SHARE_LOSS_CONGESTED;
}

/** Counters of an inbound video stream (RTCInboundRtpStreamStats). */
export interface InboundShareCounters {
    packetsReceived: number;
    packetsLost: number;
    freezeCount: number;
    /** Bytes received so far; optional for callers that don't have it. */
    bytesReceived?: number;
}

/** A viewer's sample of one share from two readings of its inbound stream,
 *  or null before there are two (or when the stream restarted). */
export function shareHealthBetween(
    prev: InboundShareCounters | null,
    cur: InboundShareCounters,
    paused: boolean,
    seconds?: number,
): ShareHealth | null {
    if (paused) return { loss: 0, paused: true, freezes: 0 };
    if (!prev) return null;
    const received = cur.packetsReceived - prev.packetsReceived;
    const lost = cur.packetsLost - prev.packetsLost;
    const freezes = cur.freezeCount - prev.freezeCount;
    if (received < 0 || lost < 0 || freezes < 0) return null;
    const total = received + lost;
    const bytes =
        typeof cur.bytesReceived === "number" &&
        typeof prev.bytesReceived === "number"
            ? cur.bytesReceived - prev.bytesReceived
            : null;
    return {
        loss: total > 0 ? lost / total : 0,
        paused: false,
        freezes,
        ...(bytes !== null && bytes >= 0 && seconds && seconds > 0
            ? { kbps: (bytes * 8) / 1000 / seconds }
            : {}),
    };
}

/** The sharer's side: the latest report from each viewer, and the bitrate
 *  cap they add up to (null when nothing holds the share back). */
export class ShareRateCap {
    private reports = new Map<string, { health: ShareHealth; at: number }>();
    private cap: number | null = null;
    private lastDecrease = -Infinity;
    private lastIncrease = -Infinity;
    private lastCongested = -Infinity;
    /** Delivered bitrate (bps) at the last heavy-loss cut, and when. */
    private ceiling: { bps: number; at: number } | null = null;

    note(identity: string, health: ShareHealth, now: number): void {
        this.reports.set(identity, { health, at: now });
    }

    forget(identity: string): void {
        this.reports.delete(identity);
    }

    /** Start over (a new share). */
    reset(): void {
        this.reports.clear();
        this.cap = null;
        this.lastDecrease = this.lastIncrease = this.lastCongested = -Infinity;
        this.ceiling = null;
    }

    /** Whether any viewer struggled in a report that still counts. */
    congested(now: number): boolean {
        return this.worst(now) !== "none";
    }

    /** The worst of the reports that still count. */
    private worst(now: number): "none" | "loss" | "paused" {
        let worst: "none" | "loss" | "paused" = "none";
        for (const [id, r] of this.reports) {
            if (now - r.at > SHARE_HEALTH_TTL_MS) {
                this.reports.delete(id);
                continue;
            }
            if (r.health.paused) worst = "paused";
            else if (worst === "none" && shareHealthCongested(r.health))
                worst = "loss";
        }
        return worst;
    }

    /** The lowest bitrate (bps) a viewer with heavy loss received, or null
     *  when no fresh report has heavy loss and a received bitrate. */
    private deliveredUnderHeavyLoss(now: number): number | null {
        let low: number | null = null;
        for (const r of this.reports.values()) {
            if (now - r.at > SHARE_HEALTH_TTL_MS) continue;
            const h = r.health;
            if (h.paused || h.loss < SHARE_LOSS_HEAVY) continue;
            if (typeof h.kbps !== "number" || !(h.kbps > 0)) continue;
            const bps = h.kbps * 1000;
            if (low === null || bps < low) low = bps;
        }
        return low;
    }

    /** Move the cap for this moment and return it: cut by a third while a
     *  viewer struggles, raised gently once all have been fine for a while,
     *  and gone again when it reaches what the sharer picked. */
    update(picked: number, now: number): number | null {
        if (this.cap !== null && this.cap >= picked) this.cap = null;
        const worst = this.worst(now);
        const delivered =
            worst === "loss" ? this.deliveredUnderHeavyLoss(now) : null;
        if (delivered !== null) {
            // The link is full: go straight under what actually arrives.
            this.lastCongested = now;
            const target = Math.max(
                Math.min(SHARE_CAP_FLOOR, picked),
                Math.round(delivered * SHARE_CAP_DELIVERED_SHARE),
            );
            const base = Math.min(this.cap ?? picked, picked);
            if (target < base) {
                this.cap = target;
                this.lastDecrease = now;
            }
            this.ceiling = { bps: delivered, at: now };
            return this.cap;
        }
        if (worst !== "none") {
            this.lastCongested = now;
            if (now - this.lastDecrease >= SHARE_CAP_DECREASE_GAP_MS) {
                const base = Math.min(this.cap ?? picked, picked);
                const floor = Math.min(
                    picked,
                    worst === "paused"
                        ? SHARE_CAP_FLOOR
                        : Math.max(
                              SHARE_CAP_FLOOR,
                              Math.round(picked * SHARE_CAP_LOSS_FLOOR),
                          ),
                );
                if (base > floor) {
                    this.cap = Math.max(
                        floor,
                        Math.round(base * SHARE_CAP_DECREASE),
                    );
                    this.lastDecrease = now;
                }
            }
            return this.cap;
        }
        if (
            this.cap !== null &&
            now - this.lastCongested >= SHARE_CAP_RECOVER_AFTER_MS &&
            now - this.lastIncrease >= SHARE_CAP_INCREASE_GAP_MS
        ) {
            let next = Math.round(this.cap * SHARE_CAP_INCREASE);
            // Not back above where the link filled up, for a while.
            if (this.ceiling && now - this.ceiling.at < SHARE_CAP_CEILING_MS)
                next = Math.min(
                    next,
                    Math.round(this.ceiling.bps * SHARE_CAP_DELIVERED_SHARE),
                );
            if (next > this.cap) {
                this.cap = next >= picked ? null : next;
                this.lastIncrease = now;
            }
        }
        return this.cap;
    }

    current(): number | null {
        return this.cap;
    }
}
