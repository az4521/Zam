// A hint, in our own messages, of where the sender meant them to sit.
//
// The homeserver decides where an event lands in the room, and a client can't
// change that. What it does know is what was at the bottom of its own screen
// when it sent, so each message carries the id of that event: "I wrote this
// after seeing that". A receiving Zam puts the message back below it if the
// server's order put it above, as happens when a message federates in late.
// Other clients ignore the field.
//
// Two messages sent in quick succession both carry the same id, and say nothing
// about each other; those keep whatever order the server gave them.

import type { MatrixClient, Room } from "matrix-js-sdk";

export const ORDER_HINT_KEY = "moe.crafty.zam.after";

// How far below a message its hint may point. A hint that far off is stale or
// wrong, and obeying it would drag the message across the room.
const MAX_MOVE = 50;

/**
 * Wrap the client's message sending so each message carries the id of the event
 * at the bottom of the room when it was sent. Returns the client, so it can wrap
 * createClient().
 */
export function addOrderHints(
    client: MatrixClient,
    bottomEventId: (room: Room) => string | undefined,
    enabled: () => boolean = () => true,
): MatrixClient {
    const internals = client as unknown as {
        sendMessage: (roomId: string, ...args: unknown[]) => Promise<unknown>;
    };
    const send = internals.sendMessage.bind(client);
    internals.sendMessage = (roomId, ...args) => {
        // (roomId, content), (roomId, threadId, content): content is last.
        const at = args.length - 1;
        const content = args[at] as Record<string, unknown> | undefined;
        const room = client.getRoom(roomId);
        const hint = room && enabled() ? bottomEventId(room) : undefined;
        // An edit's place is already set by the message it replaces.
        if (
            hint &&
            content &&
            !content["m.new_content"] &&
            !content[ORDER_HINT_KEY]
        ) {
            args[at] = { ...content, [ORDER_HINT_KEY]: hint };
        }
        return send(roomId, ...args);
    };
    return client;
}

interface HintedEvent {
    getId(): string | undefined;
    getContent(): object;
}

/**
 * Put each message below the event it says it was sent after, when the server's
 * order has it above. Events are otherwise left as they are.
 */
export function placeAfterHints<T extends HintedEvent>(events: T[]): T[] {
    const hintOf = (e: T): unknown =>
        (e.getContent() as Record<string, unknown>)?.[ORDER_HINT_KEY];
    if (!events.some((e) => typeof hintOf(e) === "string")) return events;

    const out = events.slice();
    for (const event of events) {
        const hint = hintOf(event);
        if (typeof hint !== "string") continue;
        const from = out.indexOf(event);
        const target = out.findIndex((e) => e.getId() === hint);
        if (target <= from || target - from > MAX_MOVE) continue;
        // Two messages naming each other can't both be below the other.
        const targetEvent = out[target];
        if (hintOf(targetEvent) === event.getId()) continue;
        out.splice(from, 1);
        out.splice(target, 0, event);
    }
    return out;
}
