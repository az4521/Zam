/**
 * Soundboard storage: sound packs shaped like the emoji packs but holding
 * audio. A user's own pack lives in account data, a room's (or space's) packs
 * in state events keyed by pack name; a call offers the user's pack plus the
 * packs of its room and the spaces above it. Playback is in livekitCall.
 */
import { t } from "$lib/i18n";
import { EventTimeline, type Room } from "matrix-js-sdk";
import { matrixClient } from "./runtime";
import { getParentSpaceIds } from "./client";
import {
    ROOM_SOUNDBOARD_TYPE,
    USER_SOUNDBOARD_TYPE,
    MAX_SOUND_SECONDS,
    isValidSoundName,
    normalizeSoundName,
    soundFileProblem,
    soundsFromContent,
    uniqueSoundName,
    withSound,
    withoutSound,
    type Sound,
    type SoundInfo,
    type SoundPack,
    type SoundPackContent,
} from "$lib/utils/soundboard";

export const USER_SOUND_PACK_NAME = "My Sounds";

function requireClient() {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    return matrixClient;
}

function userContent(): SoundPackContent {
    return (
        (matrixClient?.getAccountData(USER_SOUNDBOARD_TYPE)?.getContent() as
            SoundPackContent | undefined) ?? {}
    );
}

export function getUserSounds(): Sound[] {
    return soundsFromContent(userContent());
}

function validatedName(name: string): string {
    const normalized = normalizeSoundName(name);
    if (!isValidSoundName(normalized)) throw new Error(t("soundboard.badName"));
    return normalized;
}

export async function addUserSound(
    name: string,
    mxcUrl: string,
    info?: SoundInfo,
): Promise<string> {
    const client = requireClient();
    const normalized = validatedName(name);
    await client.setAccountData(
        USER_SOUNDBOARD_TYPE,
        withSound(
            userContent(),
            { name: normalized, mxcUrl, info },
            USER_SOUND_PACK_NAME,
        ),
    );
    return normalized;
}

export async function removeUserSound(name: string): Promise<void> {
    const client = requireClient();
    await client.setAccountData(
        USER_SOUNDBOARD_TYPE,
        withoutSound(userContent(), name),
    );
}

function roomPackFrom(
    room: Room,
    stateKey: string,
    content: SoundPackContent,
    inherited: boolean,
): SoundPack {
    return {
        id: `${room.roomId}:${stateKey}`,
        name: content.pack?.display_name || stateKey || room.name,
        roomId: room.roomId,
        stateKey,
        sourceName: room.name || room.roomId,
        inherited,
        editable: !inherited && canEditRoomSounds(room),
        sounds: soundsFromContent(content),
    };
}

/** Whether we may send the pack event in this room. Unknown state counts as
 *  yes: the server decides. */
export function canEditRoomSounds(room: Room): boolean {
    const me = matrixClient?.getUserId();
    const state = room.getLiveTimeline().getState(EventTimeline.FORWARDS);
    if (!me || !state) return true;
    return state.maySendStateEvent(ROOM_SOUNDBOARD_TYPE, me);
}

/** Packs stored in this one room (empty packs included, so they can be
 *  filled from the editor). */
export function getRoomSoundPacks(room: Room, inherited = false): SoundPack[] {
    const state = room.getLiveTimeline().getState(EventTimeline.FORWARDS);
    return (state?.getStateEvents(ROOM_SOUNDBOARD_TYPE) ?? []).flatMap(
        (event) => {
            const content = event.getContent() as SoundPackContent;
            // A deleted pack is `{}`.
            if (!content.pack && !content.sounds) return [];
            return [
                roomPackFrom(
                    room,
                    event.getStateKey() ?? "",
                    content,
                    inherited,
                ),
            ];
        },
    );
}

/** Packs usable in a call in `room`: the user's own, the room's, then those
 *  of the spaces above it. Empty packs are left out. */
export function getAvailableSoundPacks(room: Room | null): SoundPack[] {
    const packs: SoundPack[] = [];
    const own = getUserSounds();
    if (own.length > 0)
        packs.push({
            id: "user",
            name: USER_SOUND_PACK_NAME,
            editable: true,
            sounds: own,
        });
    if (room && matrixClient) {
        packs.push(...getRoomSoundPacks(room));
        for (const spaceId of getParentSpaceIds(room.roomId)) {
            const space = matrixClient.getRoom(spaceId);
            if (space) packs.push(...getRoomSoundPacks(space, true));
        }
    }
    return packs.filter((pack) => pack.sounds.length > 0);
}

/** Every pack to manage for a room in its settings: its own and inherited. */
export function getManageableSoundPacks(room: Room): SoundPack[] {
    const packs = getRoomSoundPacks(room);
    for (const spaceId of getParentSpaceIds(room.roomId)) {
        const space = matrixClient?.getRoom(spaceId);
        if (space) packs.push(...getRoomSoundPacks(space, true));
    }
    return packs;
}

async function fetchPackContent(
    roomId: string,
    stateKey: string,
): Promise<SoundPackContent> {
    try {
        return (await requireClient().getStateEvent(
            roomId,
            ROOM_SOUNDBOARD_TYPE,
            stateKey,
        )) as SoundPackContent;
    } catch (err) {
        const e = err as { errcode?: string; httpStatus?: number };
        if (e?.errcode === "M_NOT_FOUND" || e?.httpStatus === 404) return {};
        // Guessing "empty" would let an edit wipe the real pack.
        throw err;
    }
}

async function updateRoomSoundPack(
    room: Room,
    stateKey: string,
    edit: (current: SoundPackContent) => SoundPackContent,
): Promise<void> {
    const client = requireClient();
    if (!canEditRoomSounds(room)) throw new Error(t("soundboard.noPermission"));
    const next = edit(await fetchPackContent(room.roomId, stateKey));
    await client.sendStateEvent(
        room.roomId,
        ROOM_SOUNDBOARD_TYPE as never,
        next as never,
        stateKey,
    );
}

export async function addRoomSound(
    room: Room,
    stateKey: string,
    name: string,
    mxcUrl: string,
    packName: string,
    info?: SoundInfo,
): Promise<string> {
    const normalized = validatedName(name);
    await updateRoomSoundPack(room, stateKey, (current) =>
        withSound(current, { name: normalized, mxcUrl, info }, packName),
    );
    return normalized;
}

export async function removeRoomSound(
    room: Room,
    stateKey: string,
    name: string,
): Promise<void> {
    await updateRoomSoundPack(room, stateKey, (current) =>
        withoutSound(current, name),
    );
}

/** Delete a whole room pack (an empty event removes it). */
export async function deleteRoomSoundPack(
    room: Room,
    stateKey: string,
): Promise<void> {
    await updateRoomSoundPack(room, stateKey, () => ({}));
}

/** Copy sounds into the user's pack by reference (no re-upload). Names that
 *  collide get a numeric suffix, and a sound already present (same mxc) is
 *  skipped. Returns the names added. */
export async function importSoundsToUserPack(
    sounds: Sound[],
): Promise<string[]> {
    const client = requireClient();
    let content = userContent();
    const taken = new Set(Object.keys(content.sounds ?? {}));
    const have = new Set(getUserSounds().map((s) => s.mxcUrl));
    const added: string[] = [];
    for (const sound of sounds) {
        if (have.has(sound.mxcUrl)) continue;
        const name = uniqueSoundName(taken, sound.name);
        taken.add(name);
        have.add(sound.mxcUrl);
        content = withSound(content, { ...sound, name }, USER_SOUND_PACK_NAME);
        added.push(name);
    }
    if (added.length > 0)
        await client.setAccountData(USER_SOUNDBOARD_TYPE, content);
    return added;
}

/** Clip length in seconds, or null when the browser cannot read the file. */
function audioDuration(file: File): Promise<number | null> {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const audio = new Audio();
        const done = (value: number | null) => {
            URL.revokeObjectURL(url);
            audio.src = "";
            resolve(value);
        };
        audio.preload = "metadata";
        audio.onloadedmetadata = () =>
            done(Number.isFinite(audio.duration) ? audio.duration : null);
        audio.onerror = () => done(null);
        audio.src = url;
    });
}

/** Check a file against the sound limits and upload it. Throws a message fit
 *  for the user. */
export async function uploadSoundFile(
    file: File,
): Promise<{ mxcUrl: string; info: SoundInfo }> {
    const client = requireClient();
    const problem = soundFileProblem(file);
    if (problem === "notAudio") throw new Error(t("soundboard.notAudio"));
    if (problem === "tooBig") throw new Error(t("soundboard.tooBig"));
    const duration = await audioDuration(file);
    if (duration === null) throw new Error(t("soundboard.unreadable"));
    if (duration > MAX_SOUND_SECONDS)
        throw new Error(
            t("soundboard.tooLong", { seconds: MAX_SOUND_SECONDS }),
        );
    const { content_uri } = await client.uploadContent(file, {
        name: file.name,
    });
    return {
        mxcUrl: content_uri,
        info: {
            mimetype: file.type,
            size: file.size,
            duration: Math.round(duration * 100) / 100,
        },
    };
}
