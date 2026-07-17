import type { MatrixEvent } from "matrix-js-sdk";

interface RoomMessages {
    events: MatrixEvent[];
    isLoading: boolean;
    canLoadMore: boolean;
}

// Use an array of tuples instead of a Map so Svelte's deep reactivity works cleanly
export const messagesState = $state({
    byRoom: {} as Record<string, RoomMessages>,
    reactionTick: 0, // incremented whenever a reaction event arrives, to trigger re-renders
    timelineTick: 0, // incremented whenever messages are set/appended, to trigger reply lookups
});

export function bumpReactionTick(): void {
    messagesState.reactionTick++;
}

// Bumped when an encrypted event decrypts late (keys arrived after render), so
// derived timelines re-run and swap the UTD placeholder for real content.
export function bumpTimelineTick(): void {
    messagesState.timelineTick++;
}

export function getMessages(roomId: string): MatrixEvent[] {
    return messagesState.byRoom[roomId]?.events ?? [];
}

export function setMessages(roomId: string, events: MatrixEvent[]): void {
    const existing = messagesState.byRoom[roomId];
    messagesState.byRoom[roomId] = {
        events,
        isLoading: false,
        canLoadMore: existing?.canLoadMore ?? true,
    };
    messagesState.timelineTick++;
}

export function appendMessage(roomId: string, event: MatrixEvent): void {
    const existing = messagesState.byRoom[roomId];
    if (existing) {
        // Check for duplicate (can happen if the event was already in the timeline)
        const alreadyExists = existing.events.some(
            (e) => e.getId() === event.getId(),
        );
        if (alreadyExists) return;
        messagesState.byRoom[roomId] = {
            ...existing,
            events: [...existing.events, event],
        };
        messagesState.timelineTick++;
    } else {
        messagesState.byRoom[roomId] = {
            events: [event],
            isLoading: false,
            canLoadMore: true,
        };
    }
}

export function prependMessages(roomId: string, events: MatrixEvent[]): void {
    const existing = messagesState.byRoom[roomId];
    const existingIds = new Set(existing?.events.map((e) => e.getId()) ?? []);
    const newEvents = events.filter((e) => !existingIds.has(e.getId()));
    messagesState.byRoom[roomId] = {
        events: [...newEvents, ...(existing?.events ?? [])],
        isLoading: false,
        canLoadMore: events.length >= 30,
    };
}

export function setLoading(roomId: string, isLoading: boolean): void {
    const existing = messagesState.byRoom[roomId] ?? {
        events: [],
        canLoadMore: true,
    };
    messagesState.byRoom[roomId] = { ...existing, isLoading };
}

export function canLoadMore(roomId: string): boolean {
    return messagesState.byRoom[roomId]?.canLoadMore ?? true;
}

export function setCanLoadMore(roomId: string, value: boolean): void {
    const existing = messagesState.byRoom[roomId] ?? {
        events: [],
        canLoadMore: true,
    };
    messagesState.byRoom[roomId] = { ...existing, canLoadMore: value };
}
