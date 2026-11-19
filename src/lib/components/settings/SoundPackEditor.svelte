<script lang="ts">
    import { t } from "$lib/i18n";
    import type { Room } from "matrix-js-sdk";
    import { onDestroy, untrack } from "svelte";
    import { Play, X } from "lucide-svelte";
    import EmojiPicker from "$lib/components/ui/EmojiPicker.svelte";
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
        setSoundPackGlobal,
        uploadSoundFile,
    } from "$lib/matrix/soundboard";
    import { fetchMediaBytes, mxcToHttp } from "$lib/matrix/media";
    import { roomsState } from "$lib/stores/rooms.svelte";
    import {
        MAX_SOUND_BYTES,
        MAX_SOUND_SECONDS,
        isValidSoundName,
        normalizeSoundEmoji,
        normalizeSoundName,
        soundFileProblem,
        soundNameFromText,
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
    let selectedKey = $state("");
    let newPackName = $state("");
    let uploading = $state(false);
    let pending = $state<string | null>(null);
    let error = $state("");
    let notice = $state("");

    // A picked file waits here until Add or Cancel decides its fate.
    let stagedFile = $state<File | null>(null);
    let stagedUrl = $state("");
    let stagedName = $state("");
    let stagedEmoji = $state("");
    let stagedPicker = $state(false);

    // The sound whose emoji picker is open, as `soundKey(pack, sound)`.
    let emojiEditKey = $state<string | null>(null);

    const canCreate = $derived(room ? canEditRoomSounds(room) : true);
    const editablePacks = $derived(packs.filter((pack) => pack.editable));
    const canAdd = $derived(!room || canCreate || editablePacks.length > 0);

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

    onDestroy(() => {
        if (stagedUrl) URL.revokeObjectURL(stagedUrl);
    });

    function clearStaged() {
        if (stagedUrl) URL.revokeObjectURL(stagedUrl);
        stagedUrl = "";
        stagedFile = null;
        stagedName = "";
        stagedEmoji = "";
        stagedPicker = false;
    }

    /** Pick a file: check it and stage it for review. Nothing is uploaded
     *  until Add. */
    function stageFile(event: Event) {
        const input = event.currentTarget as HTMLInputElement;
        const file = input.files?.[0];
        input.value = "";
        if (!file) return;
        error = "";
        notice = "";
        const problem = soundFileProblem(file);
        if (problem === "notAudio") {
            error = t("soundboard.notAudio");
            return;
        }
        if (problem === "tooBig") {
            error = t("soundboard.tooBig");
            return;
        }
        clearStaged();
        stagedFile = file;
        stagedUrl = URL.createObjectURL(file);
        stagedName = soundNameFromText(file.name.replace(/\.[^.]+$/, ""));
    }

    function cancelStaged() {
        error = "";
        clearStaged();
    }

    /** Upload the staged file and add it. The typed name becomes a shortcode;
     *  when that had to change it, the original is kept as the description. */
    async function addStaged() {
        const file = stagedFile;
        if (!file) return;
        error = "";
        notice = "";
        const typed = normalizeSoundName(
            stagedName || file.name.replace(/\.[^.]+$/, ""),
        );
        const wanted = soundNameFromText(typed);
        if (!isValidSoundName(wanted)) {
            error = t("soundboard.badName");
            return;
        }
        const body = typed !== wanted ? typed : undefined;
        const emoji = normalizeSoundEmoji(stagedEmoji);
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
                    body,
                    emoji,
                );
                selectedKey = stateKey;
            } else {
                await addUserSound(wanted, mxcUrl, info, body, emoji);
            }
            clearStaged();
            newPackName = "";
            roomsState.roomsTick++;
            load();
        } catch (err) {
            error = (err as Error)?.message ?? t("soundboard.uploadFailed");
        } finally {
            uploading = false;
        }
    }

    function soundKey(pack: SoundPack, sound: Sound): string {
        return `${pack.id}:${sound.name}`;
    }

    function toggleEmojiEdit(pack: SoundPack, sound: Sound) {
        const key = soundKey(pack, sound);
        emojiEditKey = emojiEditKey === key ? null : key;
    }

    /** Replace a sound's emoji (undefined clears it). Re-adding under the same
     *  name keeps the rest of the entry. */
    async function setSoundEmoji(
        pack: SoundPack,
        sound: Sound,
        emoji: string | undefined,
    ) {
        pending = soundKey(pack, sound);
        error = "";
        notice = "";
        try {
            if (room && pack.stateKey !== undefined)
                await addRoomSound(
                    room,
                    pack.stateKey,
                    sound.name,
                    sound.mxcUrl,
                    pack.name,
                    sound.info,
                    sound.body,
                    emoji,
                );
            else
                await addUserSound(
                    sound.name,
                    sound.mxcUrl,
                    sound.info,
                    sound.body,
                    emoji,
                );
            emojiEditKey = null;
            roomsState.roomsTick++;
            load();
        } catch (err) {
            error = (err as Error)?.message ?? t("soundboard.emojiFailed");
        } finally {
            pending = null;
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

    async function toggleGlobal(pack: SoundPack) {
        if (!pack.roomId || pack.stateKey === undefined) return;
        pending = `${pack.id}:global`;
        error = "";
        notice = "";
        try {
            await setSoundPackGlobal(pack.roomId, pack.stateKey, !pack.global);
            roomsState.roomsTick++;
            load();
        } catch (err) {
            error = (err as Error)?.message ?? t("soundboard.globalFailed");
        } finally {
            pending = null;
        }
    }

    /** A stored duration (milliseconds) as seconds, e.g. "2.4s". */
    function formatDuration(ms: number): string {
        return `${Math.round(ms / 100) / 10}s`;
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
    {#if canAdd}
        <section class="space-y-2">
            <h3
                class="block text-xs font-semibold text-zam-textMuted uppercase tracking-wide"
            >
                {t("soundboard.add")}
            </h3>
            <p class="text-xs text-zam-textMuted">
                {t("soundboard.limits", {
                    seconds: MAX_SOUND_SECONDS,
                    kb: Math.round(MAX_SOUND_BYTES / 1024),
                })}
            </p>
            {#if room}
                <div class="grid gap-2 min-w-0">
                    <select
                        bind:value={selectedKey}
                        disabled={uploading}
                        aria-label={t("soundboard.pack")}
                        class="w-full bg-zam-backgroundTertiary text-zam-textPrimary text-sm rounded px-3 py-2 outline-none border border-transparent focus:border-zam-accent/50"
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
                            class="min-w-0 bg-zam-backgroundTertiary text-zam-textPrimary placeholder-zam-textMuted text-sm rounded px-3 py-2 outline-none border border-transparent focus:border-zam-accent/50"
                        />
                    {/if}
                </div>
            {/if}
            <label
                class="inline-block cursor-pointer px-3 py-2 rounded bg-zam-accent text-white text-sm font-semibold text-center {uploading ||
                (room && editablePacks.length === 0 && !canCreate)
                    ? 'opacity-50 pointer-events-none'
                    : ''}"
            >
                {uploading ? t("common.uploading") : t("soundboard.upload")}
                <input
                    type="file"
                    accept="audio/*"
                    class="hidden"
                    onchange={stageFile}
                    disabled={uploading}
                />
            </label>

            {#if stagedFile}
                <div class="space-y-2 rounded bg-zam-backgroundTertiary p-3">
                    <p
                        class="text-xs text-zam-textMuted truncate"
                        title={stagedFile.name}
                    >
                        {stagedFile.name}
                    </p>
                    <audio
                        controls
                        src={stagedUrl}
                        aria-label={t("soundboard.preview")}
                        class="w-full"
                    ></audio>
                    <label class="grid gap-1">
                        <span
                            class="text-xs font-semibold text-zam-textMuted uppercase tracking-wide"
                        >
                            {t("soundboard.name")}
                        </span>
                        <input
                            bind:value={stagedName}
                            disabled={uploading}
                            class="min-w-0 bg-zam-backgroundSecondary text-zam-textPrimary placeholder-zam-textMuted text-sm rounded px-3 py-2 outline-none border border-transparent focus:border-zam-accent/50"
                        />
                    </label>
                    <div class="flex items-center gap-2">
                        <span
                            class="text-xs font-semibold text-zam-textMuted uppercase tracking-wide"
                        >
                            {t("soundboard.emoji")}
                        </span>
                        <button
                            type="button"
                            onclick={() => (stagedPicker = !stagedPicker)}
                            disabled={uploading}
                            aria-expanded={stagedPicker}
                            aria-label={t("soundboard.emoji")}
                            class="min-w-[2.5rem] px-2 py-1 rounded bg-zam-backgroundSecondary hover:bg-zam-messageHover disabled:opacity-50"
                        >
                            {#if stagedEmoji}
                                <span class="text-xl leading-none"
                                    >{stagedEmoji}</span
                                >
                            {:else}
                                <span class="text-xs text-zam-textMuted"
                                    >{t("soundboard.noEmoji")}</span
                                >
                            {/if}
                        </button>
                        {#if stagedEmoji}
                            <button
                                type="button"
                                onclick={() => (stagedEmoji = "")}
                                disabled={uploading}
                                class="px-2 py-1 rounded text-xs text-zam-textMuted hover:text-zam-textPrimary hover:bg-zam-messageHover disabled:opacity-50"
                            >
                                {t("soundboard.clearEmoji")}
                            </button>
                        {/if}
                    </div>
                    {#if stagedPicker}
                        <EmojiPicker
                            unicodeOnly
                            onSelect={(picked) => (stagedEmoji = picked)}
                            onClose={() => (stagedPicker = false)}
                        />
                    {/if}
                    <div class="flex justify-end gap-2">
                        <button
                            type="button"
                            onclick={cancelStaged}
                            disabled={uploading}
                            class="px-3 py-1.5 rounded text-sm text-zam-textPrimary hover:bg-zam-messageHover disabled:opacity-50"
                        >
                            {t("common.cancel")}
                        </button>
                        <button
                            type="button"
                            onclick={addStaged}
                            disabled={uploading}
                            class="px-3 py-1.5 rounded bg-zam-accent text-white text-sm font-semibold disabled:opacity-50"
                        >
                            {uploading
                                ? t("common.uploading")
                                : t("soundboard.addStaged")}
                        </button>
                    </div>
                </div>
            {/if}
        </section>
    {/if}

    {#if error}<p class="text-sm text-zam-danger">{error}</p>{/if}
    {#if notice}<p class="text-sm text-zam-textMuted">{notice}</p>{/if}

    <div class="space-y-3">
        {#each packs as pack (pack.id)}
            <div class="rounded bg-zam-backgroundTertiary overflow-hidden">
                <div
                    class="flex items-center gap-2 px-3 py-2 border-b border-zam-divider"
                >
                    <div class="min-w-0 flex-1">
                        <p
                            class="text-sm font-semibold text-zam-textPrimary truncate"
                        >
                            {pack.name}
                        </p>
                        {#if pack.sourceName}
                            <p class="text-xs text-zam-textMuted truncate">
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
                            onclick={() => toggleGlobal(pack)}
                            disabled={pending === `${pack.id}:global`}
                            aria-pressed={!!pack.global}
                            title={t("soundboard.useEverywhereHint")}
                            class="px-2 py-1 rounded text-xs hover:bg-zam-messageHover disabled:opacity-50 {pack.global
                                ? 'text-zam-accent font-semibold'
                                : 'text-zam-textPrimary'}"
                        >
                            {pack.global
                                ? t("soundboard.usedEverywhere")
                                : t("soundboard.useEverywhere")}
                        </button>
                        <button
                            onclick={() => addToMine(pack.sounds)}
                            class="px-2 py-1 rounded text-xs text-zam-textPrimary hover:bg-zam-messageHover"
                        >
                            {t("soundboard.addToMine")}
                        </button>
                        {#if pack.editable}
                            <button
                                onclick={() => deletePack(pack)}
                                disabled={pending === `${pack.id}:pack`}
                                class="px-2 py-1 rounded text-xs text-zam-danger hover:bg-zam-messageHover disabled:opacity-50"
                            >
                                {t("soundboard.deletePack")}
                            </button>
                        {/if}
                    {/if}
                </div>
                <div class="space-y-1 p-2">
                    {#each pack.sounds as sound (sound.name)}
                        <div
                            class="flex items-center gap-3 p-2 rounded bg-zam-backgroundSecondary"
                        >
                            <button
                                onclick={() => previewSound(sound)}
                                class="p-2 rounded-full text-zam-textPrimary hover:bg-zam-messageHover"
                                title={t("soundboard.preview")}
                                aria-label={t("soundboard.preview")}
                            >
                                <Play size={14} aria-hidden="true" />
                            </button>
                            <div class="flex-1 min-w-0">
                                <p
                                    class="text-sm font-medium text-zam-textPrimary truncate"
                                    title={sound.body}
                                >
                                    {#if sound.emoji}<span
                                            class="me-1"
                                            aria-hidden="true"
                                            >{sound.emoji}</span
                                        >{/if}{sound.name}
                                </p>
                                {#if sound.info?.duration !== undefined}
                                    <p class="text-xs text-zam-textMuted">
                                        {formatDuration(sound.info.duration)}
                                    </p>
                                {/if}
                            </div>
                            {#if room}
                                <button
                                    onclick={() => addToMine([sound])}
                                    class="px-2 py-1 rounded text-xs text-zam-textMuted hover:text-zam-textPrimary hover:bg-zam-messageHover"
                                >
                                    {t("soundboard.addToMine")}
                                </button>
                            {/if}
                            {#if pack.editable}
                                <button
                                    onclick={() => toggleEmojiEdit(pack, sound)}
                                    disabled={pending === soundKey(pack, sound)}
                                    aria-expanded={emojiEditKey ===
                                        soundKey(pack, sound)}
                                    class="px-2 py-1 rounded text-xs text-zam-textMuted hover:text-zam-textPrimary hover:bg-zam-messageHover disabled:opacity-50"
                                >
                                    {t("soundboard.editEmoji")}
                                </button>
                                <button
                                    onclick={() => remove(pack, sound)}
                                    disabled={pending ===
                                        `${pack.id}:${sound.name}`}
                                    class="p-1 rounded text-zam-textMuted hover:text-zam-danger hover:bg-zam-messageHover disabled:opacity-50"
                                    title={t("soundboard.remove")}
                                    aria-label={t("soundboard.remove")}
                                >
                                    <X size={14} aria-hidden="true" />
                                </button>
                            {/if}
                        </div>
                        {#if pack.editable && emojiEditKey === soundKey(pack, sound)}
                            <div class="space-y-2 px-2 pb-2">
                                {#if sound.emoji}
                                    <button
                                        type="button"
                                        onclick={() =>
                                            setSoundEmoji(
                                                pack,
                                                sound,
                                                undefined,
                                            )}
                                        disabled={pending ===
                                            soundKey(pack, sound)}
                                        class="px-2 py-1 rounded text-xs text-zam-danger hover:bg-zam-messageHover disabled:opacity-50"
                                    >
                                        {t("soundboard.clearEmoji")}
                                    </button>
                                {/if}
                                <EmojiPicker
                                    unicodeOnly
                                    onSelect={(picked) =>
                                        setSoundEmoji(pack, sound, picked)}
                                    onClose={() => (emojiEditKey = null)}
                                />
                            </div>
                        {/if}
                    {/each}
                    {#if pack.sounds.length === 0}
                        <p class="text-sm text-zam-textMuted text-center py-2">
                            {t("soundboard.noSounds")}
                        </p>
                    {/if}
                </div>
            </div>
        {/each}
    </div>
</div>
