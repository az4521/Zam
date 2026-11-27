/**
 * Per-participant key/value state shared over LiveKit data messages, for
 * what LiveKit participant attributes would carry (`zam.watching`,
 * `zam.decode`). Attributes need the token's `canUpdateOwnMetadata` grant,
 * which lk-jwt-service leaves off by default (our own SFU issues
 * `canUpdateOwnMetadata: false`), so `setAttributes` fails there. Data
 * messages only need `canPublishData`, which every caller has.
 *
 * Each client sends its whole record whenever a value changes, and to anyone
 * it hears from for the first time, so late joiners learn it too. No LiveKit
 * import, so it is testable.
 */

export const PEER_ATTRIBUTES_TOPIC = "moe.crafty.attributes";

/** Larger records are dropped: the values are short lists. */
const MAX_RECORD_BYTES = 16 * 1024;

export type AttributeRecord = Record<string, string>;

export function encodePeerAttributes(
    attrs: AttributeRecord,
): Uint8Array<ArrayBuffer> {
    return new TextEncoder().encode(JSON.stringify(attrs));
}

/** A received record, or null when it is not one. Non-string values are
 *  dropped. */
export function decodePeerAttributes(
    payload: Uint8Array,
): AttributeRecord | null {
    if (payload.byteLength > MAX_RECORD_BYTES) return null;
    try {
        const parsed: unknown = JSON.parse(new TextDecoder().decode(payload));
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
            return null;
        const out: AttributeRecord = {};
        for (const [k, v] of Object.entries(parsed))
            if (typeof v === "string") out[k] = v;
        return out;
    } catch {
        return null;
    }
}

/** What each participant of one LiveKit room has told us. */
export class PeerAttributeBook {
    private records = new Map<string, AttributeRecord>();

    /** Take a record from `identity`. Returns whether this is the first one
     *  heard from them (so ours should go back to them) and which keys
     *  changed. */
    receive(
        identity: string,
        attrs: AttributeRecord,
    ): { first: boolean; changed: string[] } {
        const prev = this.records.get(identity);
        const next = { ...prev, ...attrs };
        const changed = Object.keys(attrs).filter(
            (k) => prev?.[k] !== attrs[k],
        );
        this.records.set(identity, next);
        return { first: !prev, changed };
    }

    /** They left the room: forget what they said. */
    forget(identity: string): boolean {
        return this.records.delete(identity);
    }

    get(identity: string, key: string): string | undefined {
        return this.records.get(identity)?.[key];
    }
}

/** A participant's value for `key`: what it sent over data messages, else
 *  its LiveKit attribute (servers that grant attributes, older clients). */
export function peerAttribute(
    book: PeerAttributeBook | undefined,
    participant: { identity: string; attributes: Readonly<AttributeRecord> },
    key: string,
): string | undefined {
    return book?.get(participant.identity, key) ?? participant.attributes[key];
}
