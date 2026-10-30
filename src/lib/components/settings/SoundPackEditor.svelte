<script lang="ts">
    import { t } from "$lib/i18n";
    import type { Room } from "matrix-js-sdk";
    import { untrack } from "svelte";
    import { Play, X } from "lucide-svelte";
    import {
        USER_SOUND_PACK_NAME,
        addRoomSound,
        addUserSound,
        canEditRoomSounds,
        deleteRoomSoundPack,
        getManageableSoundPacks,
        getUserSounds,
        importSoundsToUserPack,
        removeRoomSound,
        removeUserSound,
        uploadSoundFile,
    } from "$lib/matrix/soundboard";
    import { fetchMediaBytes, mxcToHttp } from "$lib/matrix/media";
    import { roomsState } from "$lib/stores/rooms.svelte";
    import {
        MAX_SOUND_BYTES,
        MAX_SOUND_SECONDS,
        isValidSoundName,
        normalizeSoundName,
        type Sound,
        type SoundPack,
    } from "$lib/utils/soundboard";

    interface Props {
        /** A room or space to edit the packs of; the user's own pack when
         *  absent. */
        room?: Room;
    }
    let { room }: Props = $props();

    let packs = $state<SoundPack[]>([]);
    let name = $state("");
    let selectedKey = $state("");
    let newPackName = $state("");
    let uploading = $state(false);
    let pending = $state<string | null>(null);
    let error = $state("");
    let notice = $state("");

    const canCreate = $derived(room ? canEditRoomSounds(room) : true);
    const editablePacks = $derived(packs.filter((pack) => pack.editable));

    function load() {
        packs = room
            ? getManageableSoundPacks(room)
            : [
                  {
                      id: "user",
                      name: USER_SOUND_PACK_NAME,
                      editable: true,
                      sounds: getUserSounds(),
                  },
              ];
        if (
            room &&
            selectedKey !== "__new" &&
            !editablePacks.some((pack) => pack.stateKey === selectedKey)
        ) {
            selectedKey = editablePacks[0]?.stateKey ?? "__new";
        }
    }

    $effect(() => {
        void room;
        void roomsState.roomsTick;
        // load() reads what it writes; keep that out of the effect's deps.
        untrack(() => load());
    });

    async function upload(event: Event) {
        const input = event.currentTarget as HTMLInputElement;
        const file = input.files?.[0];
        input.value = "";
        if (!file) return;
        error = "";
        notice = "";
        const wanted = normalizeSoundName(
            name || file.name.replace(/\.[^.]+$/, ""),
        );
        if (!isValidSoundName(wanted)) {
            error = t("soundboard.badName");
            return;
        }
        const stateKey =
            selectedKey === "__new" ? newPackName.trim() : selectedKey;
        if (room && !stateKey) {
            error = t("soundboard.enterAPackName");
            return;
        }
        uploading = true;
        try {
            const { mxcUrl, info } = await uploadSoundFile(file);
            if (room) {
                const packName =
                    packs.find((pack) => pack.stateKey === stateKey)?.name ||
                    stateKey;
                await addRoomSound(
                    room,
                    stateKey,
                    wanted,
                    mxcUrl,
                    packName,
                    info,
                );
                selectedKey = stateKey;
            } else {
                await addUserSound(wanted, mxcUrl, info);
            }
            name = "";
            newPackName = "";
            roomsState.roomsTick++;
            load();
        } catch (err) {
            error = (err as Error)?.message ?? t("soundboard.uploadFailed");
        } finally {
            uploading = false;
        }
    }

    async function remove(pack: SoundPack, sound: Sound) {
        pending = `${pack.id}:${sound.name}`;
        error = "";
        notice = "";
        try {
            if (room && pack.stateKey !== undefined)
                await removeRoomSound(room, pack.stateKey, sound.name);
            else await removeUserSound(sound.name);
            roomsState.roomsTick++;
            load();
        } catch (err) {
            error = (err as Error)?.message ?? t("soundboard.removeFailed");
        } finally {
            pending = null;
        }
    }

    async function deletePack(pack: SoundPack) {
        if (!room || pack.stateKey === undefined) return;
        if (!confirm(t("soundboard.confirmDeletePack", { name: pack.name })))
            return;
        pending = `${pack.id}:pack`;
        error = "";
        try {
            await deleteRoomSoundPack(room, pack.stateKey);
            roomsState.roomsTick++;
            load();
        } catch (err) {
            error = (err as Error)?.message ?? t("soundboard.removeFailed");
        } finally {
            pending = null;
        }
    }

    async function addToMine(sounds: Sound[]) {
        error = "";
        notice = "";
        try {
            const added = await importSoundsToUserPack(sounds);
            notice =
                added.length > 0
                    ? t("soundboard.addedToYours", { count: added.length })
                    : t("soundboard.alreadyYours");
            roomsState.roomsTick++;
        } catch (err) {
            error = (err as Error)?.message ?? t("soundboard.uploadFailed");
        }
    }

    let preview: HTMLAudioElement | null = null;
    async function previewSound(sound: Sound) {
        error = "";
        try {
            const url = mxcToHttp(sound.mxcUrl);
            if (!url) return;
            const bytes = await fetchMediaBytes(url, MAX_SOUND_BYTES);
            preview?.pause();
            if (preview) URL.revokeObjectURL(preview.src);
            preview = new Audio(
                URL.createObjectURL(
                    new Blob([bytes], { type: sound.info?.mimetype }),
                ),
            );
            await preview.play();
        } catch {
            error = t("soundboard.previewFailed");
        }
    }
</script>

<div class="space-y-4">
    <section class="space-y-2">
        <h3
            class="block text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
        >
            {t("soundboard.add")}
        </h3>
        <p class="text-xs text-discord-textMuted">
            {t("soundboard.limits", {
                seconds: MAX_SOUND_SECONDS,
                kb: Math.round(MAX_SOUND_BYTES / 1024),
            })}
        </p>
        <div class="grid gap-2 sm:grid-cols-[1fr_auto]">
            <div class="grid gap-2 min-w-0">
                {#if room}
                    <select
                        bind:value={selectedKey}
                        disabled={uploading}
                        aria-label={t("soundboard.pack")}
                        class="w-full bg-discord-backgroundTertiary text-discord-textPrimary text-sm rounded px-3 py-2 outline-none border border-transparent focus:border-discord-accent/50"
                    >
                        {#each editablePacks as pack (pack.id)}
                            <option value={pack.stateKey}>{pack.name}</option>
                        {/each}
                        {#if canCreate}
                            <option value="__new"
                                >{t("soundboard.newPack")}</option
                            >
                        {/if}
                    </select>
                    {#if selectedKey === "__new"}
                        <input
                            bind:value={newPackName}
                            disabled={uploading}
                            placeholder={t("soundboard.packName")}
                            class="min-w-0 bg-discord-backgroundTertiary text-discord-textPrimary placeholder-discord-textMuted text-sm rounded px-3 py-2 outline-none border border-transparent focus:border-discord-accent/50"
                        />
                    {/if}
                {/if}
                <input
                    bind:value={name}
                    disabled={uploading}
                    placeholder={t("soundboard.name")}
                    aria-label={t("soundboard.name")}
                    class="min-w-0 bg-discord-backgroundTertiary text-discord-textPrimary placeholder-discord-textMuted text-sm rounded px-3 py-2 outline-none border border-transparent focus:border-discord-accent/50"
                />
            </div>
            <label
                class="cursor-pointer px-3 py-2 rounded bg-discord-accent text-white text-sm font-semibold text-center self-start {uploading ||
                (room && editablePacks.length === 0 && !canCreate)
                    ? 'opacity-50 pointer-events-none'
                    : ''}"
            >
                {uploading ? t("common.uploading") : t("soundboard.upload")}
                <input
                    type="file"
                    accept="audio/*"
                    class="hidden"
                    onchange={upload}
                    disabled={uploading}
                />
            </label>
        </div>
    </section>

    {#if error}<p class="text-sm text-discord-danger">{error}</p>{/if}
    {#if notice}<p class="text-sm text-discord-textMuted">{notice}</p>{/if}

    <div class="space-y-3">
        {#each packs as pack (pack.id)}
            <div class="rounded bg-discord-backgroundTertiary overflow-hidden">
                <div
                    class="flex items-center gap-2 px-3 py-2 border-b border-discord-divider"
                >
                    <div class="min-w-0 flex-1">
                        <p
                            class="text-sm font-semibold text-discord-textPrimary truncate"
                        >
                            {pack.name}
                        </p>
                        {#if pack.sourceName}
                            <p class="text-xs text-discord-textMuted truncate">
                                {pack.inherited
                                    ? t("soundboard.inheritedFrom", {
                                          sourceName: pack.sourceName,
                                      })
                                    : pack.sourceName}
                            </p>
                        {/if}
                    </div>
                    {#if room}
                        <button
                            onclick={() => addToMine(pack.sounds)}
                            class="px-2 py-1 rounded text-xs text-discord-textPrimary hover:bg-discord-messageHover"
                        >
                            {t("soundboard.addToMine")}
                        </button>
                        {#if pack.editable}
                            <button
                                onclick={() => deletePack(pack)}
                                disabled={pending === `${pack.id}:pack`}
                                class="px-2 py-1 rounded text-xs text-discord-danger hover:bg-discord-messageHover disabled:opacity-50"
                            >
                                {t("soundboard.deletePack")}
                            </button>
                        {/if}
                    {/if}
                </div>
                <div class="space-y-1 p-2">
                    {#each pack.sounds as sound (sound.name)}
                        <div
                            class="flex items-center gap-3 p-2 rounded bg-discord-backgroundSecondary"
                        >
                            <button
                                onclick={() => previewSound(sound)}
                                class="p-2 rounded-full text-discord-textPrimary hover:bg-discord-messageHover"
                                title={t("soundboard.preview")}
                                aria-label={t("soundboard.preview")}
                            >
                                <Play size={14} aria-hidden="true" />
                            </button>
                            <div class="flex-1 min-w-0">
                                <p
                                    class="text-sm font-medium text-discord-textPrimary truncate"
                                >
                                    {sound.name}
                                </p>
                                {#if sound.info?.duration !== undefined}
                                    <p class="text-xs text-discord-textMuted">
                                        {sound.info.duration}s
                                    </p>
                                {/if}
                            </div>
                            {#if room}
                                <button
                                    onclick={() => addToMine([sound])}
                                    class="px-2 py-1 rounded text-xs text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover"
                                >
                                    {t("soundboard.addToMine")}
                                </button>
                            {/if}
                            {#if pack.editable}
                                <button
                                    onclick={() => remove(pack, sound)}
                                    disabled={pending ===
                                        `${pack.id}:${sound.name}`}
                                    class="p-1 rounded text-discord-textMuted hover:text-discord-danger hover:bg-discord-messageHover disabled:opacity-50"
                                    title={t("soundboard.remove")}
                                    aria-label={t("soundboard.remove")}
                                >
                                    <X size={14} aria-hidden="true" />
                                </button>
                            {/if}
                        </div>
                    {/each}
                    {#if pack.sounds.length === 0}
                        <p
                            class="text-sm text-discord-textMuted text-center py-2"
                        >
                            {t("soundboard.noSounds")}
                        </p>
                    {/if}
                </div>
            </div>
        {/each}
    </div>
</div>
