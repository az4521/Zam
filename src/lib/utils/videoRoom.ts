/**
 * Video rooms: rooms whose *purpose* is a call rather than a timeline. They are
 * ordinary Matrix rooms in every other respect (invites, DMs, spaces, search,
 * encryption) — only the landing surface and the sidebar glyph differ.
 *
 * Kept free of any matrix-js-sdk import so it stays unit-testable; callers pass
 * in the type string they read off a live `Room` (`room.getType()`). The one
 * SDK-aware wrapper is `isVideoRoom(room)` in `src/lib/matrix/client.ts`.
 */

/**
 * The room type this client WRITES into `m.room.create`.
 *
 * `m.room.create` content is immutable, so this value is baked permanently into
 * every room we create — changing it later only affects rooms created after the
 * change, and silently orphans the ones before it. Pinned by a unit test.
 */
export const VIDEO_ROOM_TYPE = "m.video_room";

/**
 * Every room type treated as a video room when READING. Deliberately wider than
 * what we write, so video rooms created elsewhere are still recognised:
 * `org.matrix.msc3417.call` is Element Call's unstable type (matrix-js-sdk
 * `RoomType.UnstableCall`) and `io.element.video` is Element's legacy video room
 * (`RoomType.ElementVideo`).
 */
export const VIDEO_ROOM_TYPES: readonly string[] = [
    VIDEO_ROOM_TYPE,
    "org.matrix.msc3417.call",
    "io.element.video",
];

/**
 * Whether a room type string denotes a video room. Exact match only — a room
 * with no type (the overwhelming majority) is an ordinary room.
 */
export function isVideoRoomType(type: string | null | undefined): boolean {
    return typeof type === "string" && VIDEO_ROOM_TYPES.includes(type);
}

/**
 * The `creation_content` contribution for `createRoom`, or `undefined` for an
 * ordinary room — so callers can spread it straight into the options object
 * without an extra empty key. Mirrors `encryptionInitialState`
 * (`utils/roomEncryption.ts`).
 */
export function videoRoomCreationContent(
    videoRoom: boolean,
): { type: string } | undefined {
    return videoRoom ? { type: VIDEO_ROOM_TYPE } : undefined;
}

/** Which surface opening a room should land on. */
export type RoomSurface = "call" | "chat";

/**
 * Where opening a room should land. A video room's whole point IS the call, so
 * it opens on the call surface — peeking, never auto-joining. Everything else,
 * spaces included, opens on its timeline.
 */
export function defaultSurfaceFor(
    type: string | null | undefined,
): RoomSurface {
    return isVideoRoomType(type) ? "call" : "chat";
}
