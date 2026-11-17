/**
 * Authenticates every packet of a LiveKit transfer link. Each packet gets an
 * 8-byte sequence number and a 16-byte tag (see sealPacket). The receiver
 * accepts gaps, since the SFU may drop packets, and rejects anything not above
 * the highest sequence number it has accepted.
 */
import { openPacket, sealPacket } from "$lib/utils/fileTransfer";
import type { TransferLink } from "$lib/matrix/fileTransferEngine";

/** Wraps a LiveKit link so every packet is authenticated. `own` is the
 *  direction byte of this end (1 = sender, 2 = receiver). */
export function macLink(
    inner: TransferLink,
    macKey: CryptoKey,
    own: 1 | 2,
): TransferLink {
    const peer: 1 | 2 = own === 1 ? 2 : 1;
    let nextSeq = 0;
    // -1: nothing accepted yet, so sequence 0 is fine.
    let highest = -1;
    let handler: ((packet: Uint8Array) => void) | null = null;
    // Verifications run one at a time, so handler calls keep arrival order and
    // the highest-sequence check can't race.
    let queue: Promise<void> = Promise.resolve();
    // Sealing is async, so sends run one at a time too: each reaches the inner
    // link in the order send() was called, or the peer drops the lower numbers.
    let sendQueue: Promise<void> = Promise.resolve();

    inner.onPacket((wire) => {
        queue = queue
            .then(async () => {
                const opened = await openPacket(macKey, peer, wire);
                if (!opened) return;
                if (opened.seq <= highest) return;
                highest = opened.seq;
                handler?.(opened.packet);
            })
            .catch(() => {
                /* a throwing handler must not stall the packets behind it */
            });
    });

    return {
        send(packet) {
            // Taken before any await, and never given back: a rejected send
            // still uses its number, so a number is never reused.
            const seq = nextSeq++;
            const next = sendQueue.then(async () => {
                const wire = await sealPacket(macKey, own, seq, packet);
                await inner.send(wire);
            });
            // A failed send settles only its own caller; the queue moves on.
            sendQueue = next.catch(() => {});
            return next;
        },
        onPacket(h) {
            handler = h;
        },
    };
}
