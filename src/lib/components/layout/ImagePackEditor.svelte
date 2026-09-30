<script lang="ts">
    import { t } from "$lib/i18n";
    import type { Room } from "matrix-js-sdk";
    import { untrack } from "svelte";
    import {
        getAvailableRoomEmotePacks,
        addRoomEmote,
        setRoomEmoteUsage,
        removeRoomEmoteImage,
        setPackGlobal,
        updateRoomPackMeta,
        deleteRoomPack,
        importImagesToUserPack,
        validateEmojiShortcode,
        uploadContent,
        mxcToHttp,
        getRoomAvatar,
        type CustomImagePack,
        type CustomPackImage,
        type ImageUsage,
    } from "$lib/matrix/client";
    import { roomsState } from "$lib/stores/rooms.svelte";
    import { readImageInfo } from "$lib/utils/emotePacks";
    import {
        packKey,
        usageFromFlags,
        sortEmotePacks,
    } from "$lib/utils/imagePacks";

    interface Props {
        room: Room;
        canEdit: boolean;
        onUpdate?: () => void;
    }
    let { room, canEdit, onUpdate }: Props = $props();

    let emotePacks = $state<CustomImagePack[]>([]);
    let selectedEmotePackKey = $state("");
    let newEmotePackName = $state("");
    let emoteShortcode = $state("");
    let emoteUploading = $state(false);
    let emoteActionPending = $state<string | null>(null);
    let emoteError = $state("");
    let newEmoteAsEmoji = $state(true);
    let newEmoteAsSticker = $state(false);
    let editingKey = $state<string | null>(null);
    let editName = $state("");
    let editAttribution = $state("");
    let editAvatarMxc = $state<string | null | undefined>(undefined);
    let packBusy = $state<string | null>(null);
    let notice = $state("");

    const currentAvatarUrl = $derived(getRoomAvatar(room));

    function currentEmotePacks(): CustomImagePack[] {
        return emotePacks.filter((pack) => !pack.inherited);
    }

    function loadEmotes() {
        emotePacks = sortEmotePacks(getAvailableRoomEmotePacks(room));
        const editablePacks = currentEmotePacks();
        if (
            selectedEmotePackKey !== "__new" &&
            !editablePacks.some(
                (pack) => packKey(pack) === selectedEmotePackKey,
            )
        ) {
            selectedEmotePackKey = editablePacks[0]
                ? packKey(editablePacks[0])
                : "__new";
        }
    }

    // Mount == tab-activation (component lives inside {:else if activeTab === "emotes"}).
    // untrack the load so reads/writes of emotePacks/selectedEmotePackKey inside
    // loadEmotes do not make this effect self-retrigger (mirrors the original
    // untrack-wrapped effect in RoomSettings).
    $effect(() => {
        void room;
        untrack(() => loadEmotes());
    });

    function selectedEmotePackName(): string {
        if (selectedEmotePackKey === "__new") {
            return (
                newEmotePackName.trim() ||
                t("imagePackEditor.emotes", {
                    value: room.name || t("imagePackEditor.room"),
                })
            );
        }
        return (
            currentEmotePacks().find(
                (pack) => packKey(pack) === selectedEmotePackKey,
            )?.name ||
            t("imagePackEditor.emotes", {
                value: room.name || t("imagePackEditor.room"),
            })
        );
    }

    function selectedEmoteStateKey(): string {
        if (selectedEmotePackKey !== "__new") return selectedEmotePackKey;
        return newEmotePackName.trim() || "";
    }

    function updateEmoteLocal(
        stateKey: string,
        shortcode: string,
        usage: ImageUsage[],
    ) {
        emotePacks = sortEmotePacks(
            emotePacks.map((pack) =>
                !pack.inherited &&
                pack.roomId === room.roomId &&
                packKey(pack) === stateKey
                    ? {
                          ...pack,
                          images: pack.images.map((item) =>
                              item.shortcode === shortcode
                                  ? {
                                        ...item,
                                        usage,
                                        canEmoji: usage.includes("emoticon"),
                                        canSticker: usage.includes("sticker"),
                                    }
                                  : item,
                          ),
                      }
                    : pack,
            ),
        );
    }

    async function handleEmoteUpload(e: Event) {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        emoteError = validateEmojiShortcode(emoteShortcode) ?? "";
        const usage = usageFromFlags(newEmoteAsEmoji, newEmoteAsSticker);
        if (!emoteError && usage.length === 0) {
            emoteError = t("imagePackEditor.chooseAtLeastOneUsage");
        }
        if (
            !emoteError &&
            selectedEmotePackKey === "__new" &&
            currentEmotePacks().length > 0 &&
            !newEmotePackName.trim()
        ) {
            emoteError = t("imagePackEditor.enterAPackName");
        }
        if (emoteError) {
            input.value = "";
            return;
        }

        emoteUploading = true;
        try {
            const [mxcUrl, info] = await Promise.all([
                uploadContent(file),
                readImageInfo(file),
            ]);
            const stateKey = selectedEmoteStateKey();
            const normalized = await addRoomEmote(
                room.roomId,
                stateKey,
                emoteShortcode,
                mxcUrl,
                selectedEmotePackName(),
                usage,
                { info },
            );
            const httpUrl = mxcToHttp(mxcUrl);
            const nextImage = {
                shortcode: normalized,
                mxcUrl,
                url: httpUrl ?? "",
                usage,
                canEmoji: usage.includes("emoticon"),
                canSticker: usage.includes("sticker"),
                info,
            };
            const existingPack = currentEmotePacks().find(
                (pack) => packKey(pack) === stateKey,
            );
            const updatedPack: CustomImagePack = {
                ...(existingPack ?? {
                    id: `${room.roomId}:${stateKey}`,
                    roomId: room.roomId,
                    stateKey,
                    name: selectedEmotePackName(),
                    sourceName: room.name || room.roomId,
                    avatarUrl: currentAvatarUrl ?? undefined,
                    images: [],
                }),
                images: [
                    ...(existingPack?.images ?? []).filter(
                        (item) => item.shortcode !== normalized,
                    ),
                    nextImage,
                ].filter((item) => item.url),
            };
            emotePacks = sortEmotePacks([
                ...emotePacks.filter(
                    (pack) =>
                        pack.inherited ||
                        pack.roomId !== room.roomId ||
                        packKey(pack) !== stateKey,
                ),
                updatedPack,
            ]);
            emoteShortcode = "";
            selectedEmotePackKey = stateKey;
            roomsState.roomsTick++;
            onUpdate?.();
        } catch (err: any) {
            emoteError = err?.message ?? t("imagePackEditor.uploadFailed");
        } finally {
            emoteUploading = false;
            input.value = "";
        }
    }

    async function setRoomEmoteFlag(
        pack: CustomImagePack,
        item: CustomPackImage,
        kind: ImageUsage,
        enabled: boolean,
    ) {
        const stateKey = packKey(pack);
        const usage = usageFromFlags(
            kind === "emoticon" ? enabled : item.canEmoji,
            kind === "sticker" ? enabled : item.canSticker,
        );
        if (usage.length === 0) {
            emoteError = t("imagePackEditor.chooseAtLeastOneUsage");
            return;
        }
        emoteActionPending = `${stateKey}:${item.shortcode}:${kind}`;
        emoteError = "";
        try {
            await setRoomEmoteUsage(
                room.roomId,
                stateKey,
                item.shortcode,
                usage,
            );
            updateEmoteLocal(stateKey, item.shortcode, usage);
            roomsState.roomsTick++;
            onUpdate?.();
        } catch (err: any) {
            emoteError =
                err?.message ?? t("imagePackEditor.failedToUpdateUsage");
        } finally {
            emoteActionPending = null;
        }
    }

    async function doRemoveEmote(pack: CustomImagePack, shortcode: string) {
        const stateKey = packKey(pack);
        emoteActionPending = `${stateKey}:${shortcode}:remove`;
        emoteError = "";
        try {
            await removeRoomEmoteImage(room.roomId, stateKey, shortcode);
            emotePacks = sortEmotePacks(
                emotePacks
                    .map((p) =>
                        !p.inherited &&
                        p.roomId === room.roomId &&
                        packKey(p) === stateKey
                            ? {
                                  ...p,
                                  images: p.images.filter(
                                      (item) => item.shortcode !== shortcode,
                                  ),
                              }
                            : p,
                    )
                    .filter((p) => p.inherited || p.images.length > 0),
            );
            roomsState.roomsTick++;
            onUpdate?.();
        } catch (err: any) {
            emoteError =
                err?.message ?? t("imagePackEditor.failedToRemoveImage");
        } finally {
            emoteActionPending = null;
        }
    }

    function packBusyKey(pack: CustomImagePack, action: string): string {
        return `${pack.id}:${action}`;
    }

    async function toggleGlobal(pack: CustomImagePack, enabled: boolean) {
        if (!pack.roomId) return;
        packBusy = packBusyKey(pack, "global");
        emoteError = "";
        notice = "";
        try {
            await setPackGlobal(pack.roomId, packKey(pack), enabled);
            emotePacks = emotePacks.map((p) =>
                p.id === pack.id ? { ...p, global: enabled } : p,
            );
            roomsState.roomsTick++;
        } catch (err: any) {
            emoteError =
                err?.message ?? t("imagePackEditor.failedToUpdatePack");
        } finally {
            packBusy = null;
        }
    }

    async function addToMine(pack: CustomImagePack, only?: CustomPackImage) {
        packBusy = packBusyKey(pack, only ? `mine:${only.shortcode}` : "mine");
        emoteError = "";
        notice = "";
        try {
            const added = await importImagesToUserPack(
                (only ? [only] : pack.images).map((item) => ({
                    shortcode: item.shortcode,
                    mxcUrl: item.mxcUrl,
                    info: item.info,
                    body: item.body,
                    usage: item.usage,
                })),
            );
            notice =
                added.length > 0
                    ? t("imagePackEditor.addedToYourPack", {
                          count: added.length,
                      })
                    : t("imagePackEditor.alreadyInYourPack");
            roomsState.roomsTick++;
        } catch (err: any) {
            emoteError =
                err?.message ?? t("imagePackEditor.failedToUpdatePack");
        } finally {
            packBusy = null;
        }
    }

    function startEdit(pack: CustomImagePack) {
        editingKey = pack.id;
        editName = pack.name;
        editAttribution = pack.attribution ?? "";
        editAvatarMxc = undefined;
    }

    async function pickPackAvatar(e: Event) {
        const input = e.currentTarget as HTMLInputElement;
        const file = input.files?.[0];
        input.value = "";
        if (!file) return;
        try {
            editAvatarMxc = await uploadContent(file);
        } catch (err: any) {
            emoteError = err?.message ?? t("imagePackEditor.uploadFailed");
        }
    }

    async function saveEdit(pack: CustomImagePack) {
        if (!pack.roomId) return;
        packBusy = packBusyKey(pack, "edit");
        emoteError = "";
        try {
            await updateRoomPackMeta(pack.roomId, packKey(pack), {
                displayName: editName,
                attribution: editAttribution,
                ...(editAvatarMxc !== undefined
                    ? { avatarMxc: editAvatarMxc }
                    : {}),
            });
            editingKey = null;
            // The state event round-trips through sync; re-read shortly after.
            setTimeout(() => {
                loadEmotes();
                roomsState.roomsTick++;
            }, 600);
            onUpdate?.();
        } catch (err: any) {
            emoteError =
                err?.message ?? t("imagePackEditor.failedToUpdatePack");
        } finally {
            packBusy = null;
        }
    }

    async function doDeletePack(pack: CustomImagePack) {
        if (!pack.roomId) return;
        if (
            !confirm(
                t("imagePackEditor.confirmDeletePack", { name: pack.name }),
            )
        )
            return;
        packBusy = packBusyKey(pack, "delete");
        emoteError = "";
        try {
            await deleteRoomPack(pack.roomId, packKey(pack));
            emotePacks = emotePacks.filter((p) => p.id !== pack.id);
            if (selectedEmotePackKey === packKey(pack)) {
                selectedEmotePackKey = "__new";
            }
            roomsState.roomsTick++;
            onUpdate?.();
        } catch (err: any) {
            emoteError =
                err?.message ?? t("imagePackEditor.failedToUpdatePack");
        } finally {
            packBusy = null;
        }
    }
</script>

<div class="space-y-4">
    <div class="space-y-2">
        <label
            class="block text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
            for="room-emote-shortcode"
        >
            {t("imagePackEditor.addImage")}
        </label>
        <div class="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <div class="min-w-0">
                <select
                    bind:value={selectedEmotePackKey}
                    disabled={!canEdit || emoteUploading}
                    class="w-full bg-discord-backgroundTertiary text-discord-textPrimary text-sm rounded px-3 py-2 outline-none border border-transparent focus:border-discord-accent/50 disabled:opacity-50"
                >
                    {#each currentEmotePacks() as pack (pack.id)}
                        <option value={packKey(pack)}>{pack.name}</option>
                    {/each}
                    <option value="__new">{t("imagePackEditor.newPack")}</option
                    >
                </select>
            </div>
            <div
                class={selectedEmotePackKey === "__new"
                    ? "grid gap-2 min-w-0 sm:grid-cols-2"
                    : "grid gap-2 min-w-0"}
            >
                {#if selectedEmotePackKey === "__new"}
                    <input
                        bind:value={newEmotePackName}
                        disabled={!canEdit || emoteUploading}
                        placeholder={t("imagePackEditor.packName")}
                        class="min-w-0 bg-discord-backgroundTertiary text-discord-textPrimary placeholder-discord-textMuted text-sm rounded px-3 py-2 outline-none border border-transparent focus:border-discord-accent/50 disabled:opacity-50"
                    />
                {/if}
                <div
                    class="flex items-center bg-discord-backgroundTertiary rounded border border-transparent focus-within:border-discord-accent/50"
                >
                    <span class="ps-3 text-sm text-discord-textMuted">:</span>
                    <input
                        id="room-emote-shortcode"
                        bind:value={emoteShortcode}
                        disabled={!canEdit || emoteUploading}
                        placeholder={t("imagePackEditor.shortcode")}
                        class="min-w-0 flex-1 bg-transparent text-discord-textPrimary placeholder-discord-textMuted text-sm py-2 outline-none disabled:opacity-50"
                    />
                    <span class="pe-3 text-sm text-discord-textMuted">:</span>
                </div>
            </div>
            {#if canEdit}
                <label
                    class="shrink-0 cursor-pointer px-3 py-2 rounded bg-discord-accent hover:bg-discord-accentHover text-white text-sm font-semibold transition-colors text-center {emoteUploading
                        ? 'opacity-50 pointer-events-none'
                        : ''}"
                >
                    {emoteUploading
                        ? t("common.uploading")
                        : t("common.uploadImage")}
                    <input
                        type="file"
                        accept="image/*"
                        class="hidden"
                        onchange={handleEmoteUpload}
                        disabled={emoteUploading}
                    />
                </label>
            {/if}
        </div>
        <div
            class="flex items-center gap-3 px-3 py-2 rounded bg-discord-backgroundTertiary"
        >
            <label
                class="flex items-center gap-1.5 text-xs text-discord-textPrimary"
            >
                <input
                    type="checkbox"
                    bind:checked={newEmoteAsEmoji}
                    disabled={!canEdit || emoteUploading}
                    class="accent-discord-accent"
                />
                {t("imagePackEditor.useAsEmoji")}
            </label>
            <label
                class="flex items-center gap-1.5 text-xs text-discord-textPrimary"
            >
                <input
                    type="checkbox"
                    bind:checked={newEmoteAsSticker}
                    disabled={!canEdit || emoteUploading}
                    class="accent-discord-accent"
                />
                {t("imagePackEditor.useAsSticker")}
            </label>
        </div>
    </div>

    {#if emoteError}<p class="text-sm text-discord-danger">
            {emoteError}
        </p>{/if}
    {#if notice}<p class="text-sm text-discord-textMuted">{notice}</p>{/if}

    <div class="space-y-3">
        {#each emotePacks as pack (pack.id)}
            <div class="rounded bg-discord-backgroundTertiary overflow-hidden">
                <div
                    class="flex items-center gap-2 px-3 py-2 border-b border-discord-divider"
                >
                    {#if pack.avatarUrl}
                        <img
                            src={pack.avatarUrl}
                            alt=""
                            class="w-5 h-5 rounded object-cover flex-shrink-0"
                        />
                    {/if}
                    <div class="min-w-0 flex-1">
                        <p
                            class="text-sm font-semibold text-discord-textPrimary truncate"
                        >
                            {pack.name}
                        </p>
                        <p class="text-xs text-discord-textMuted truncate">
                            {pack.inherited
                                ? t("imagePackEditor.inheritedFrom", {
                                      sourceName: pack.sourceName,
                                  })
                                : pack.sourceName}
                        </p>
                        {#if pack.attribution}
                            <p
                                class="text-xs text-discord-textMuted truncate"
                                title={pack.attribution}
                            >
                                {t("imagePackEditor.attribution", {
                                    value: pack.attribution,
                                })}
                            </p>
                        {/if}
                    </div>
                    <div class="flex items-center gap-1 flex-shrink-0">
                        <button
                            onclick={() => addToMine(pack)}
                            disabled={packBusy === packBusyKey(pack, "mine")}
                            class="px-2 py-1 rounded text-xs text-discord-textPrimary hover:bg-discord-messageHover disabled:opacity-50"
                            title={t("imagePackEditor.addAllToMyPack")}
                        >
                            {t("imagePackEditor.addToMine")}
                        </button>
                        {#if canEdit && !pack.inherited}
                            <button
                                onclick={() =>
                                    editingKey === pack.id
                                        ? (editingKey = null)
                                        : startEdit(pack)}
                                class="px-2 py-1 rounded text-xs text-discord-textPrimary hover:bg-discord-messageHover"
                            >
                                {t("imagePackEditor.editDetails")}
                            </button>
                            <button
                                onclick={() => doDeletePack(pack)}
                                disabled={packBusy ===
                                    packBusyKey(pack, "delete")}
                                class="px-2 py-1 rounded text-xs text-discord-danger hover:bg-discord-messageHover disabled:opacity-50"
                            >
                                {t("imagePackEditor.deletePack")}
                            </button>
                        {/if}
                    </div>
                </div>
                <label
                    class="flex items-center gap-2 px-3 py-2 border-b border-discord-divider text-xs text-discord-textPrimary"
                >
                    <input
                        type="checkbox"
                        checked={!!pack.global}
                        onchange={(e) =>
                            toggleGlobal(
                                pack,
                                (e.target as HTMLInputElement).checked,
                            )}
                        disabled={packBusy === packBusyKey(pack, "global")}
                        class="accent-discord-accent"
                    />
                    <span class="flex-1 min-w-0">
                        {t("imagePackEditor.useInAllRooms")}
                        <span class="text-discord-textMuted">
                            {t("imagePackEditor.useInAllRoomsHint")}
                        </span>
                    </span>
                </label>
                {#if editingKey === pack.id}
                    <div
                        class="grid gap-2 px-3 py-2 border-b border-discord-divider sm:grid-cols-2"
                    >
                        <input
                            bind:value={editName}
                            placeholder={t("imagePackEditor.packName")}
                            class="min-w-0 bg-discord-backgroundSecondary text-discord-textPrimary placeholder-discord-textMuted text-sm rounded px-3 py-2 outline-none border border-transparent focus:border-discord-accent/50"
                        />
                        <input
                            bind:value={editAttribution}
                            placeholder={t(
                                "imagePackEditor.attributionPlaceholder",
                            )}
                            class="min-w-0 bg-discord-backgroundSecondary text-discord-textPrimary placeholder-discord-textMuted text-sm rounded px-3 py-2 outline-none border border-transparent focus:border-discord-accent/50"
                        />
                        <div class="flex items-center gap-2 sm:col-span-2">
                            <label
                                class="cursor-pointer px-3 py-1.5 rounded bg-discord-backgroundSecondary hover:bg-discord-messageHover text-xs text-discord-textPrimary"
                            >
                                {t("imagePackEditor.uploadPackAvatar")}
                                <input
                                    type="file"
                                    accept="image/*"
                                    class="hidden"
                                    onchange={pickPackAvatar}
                                />
                            </label>
                            {#if editAvatarMxc}
                                <span class="text-xs text-discord-textMuted"
                                    >{t("imagePackEditor.avatarReady")}</span
                                >
                            {/if}
                            {#if pack.avatarUrl || editAvatarMxc}
                                <button
                                    onclick={() => (editAvatarMxc = null)}
                                    class="text-xs text-discord-textMuted hover:text-discord-textPrimary"
                                >
                                    {t("imagePackEditor.removePackAvatar")}
                                </button>
                            {/if}
                            <span class="flex-1"></span>
                            <button
                                onclick={() => saveEdit(pack)}
                                disabled={packBusy ===
                                    packBusyKey(pack, "edit")}
                                class="px-3 py-1.5 rounded bg-discord-accent hover:bg-discord-accentHover text-white text-xs font-semibold disabled:opacity-50"
                            >
                                {t("common.save")}
                            </button>
                        </div>
                    </div>
                {/if}
                <div class="space-y-1 p-2">
                    {#each pack.images as item (pack.id + ":" + item.shortcode)}
                        <div
                            class="flex items-center gap-3 p-2 rounded bg-discord-backgroundSecondary"
                        >
                            <div
                                class="w-12 h-12 rounded bg-discord-backgroundTertiary flex-shrink-0 overflow-hidden flex items-center justify-center"
                            >
                                <img
                                    src={item.url}
                                    alt=""
                                    class="max-w-full max-h-full object-contain"
                                />
                            </div>
                            <div class="flex-1 min-w-0">
                                <p
                                    class="text-sm font-medium text-discord-textPrimary truncate"
                                >
                                    :{item.shortcode}:
                                </p>
                                <p
                                    class="text-xs text-discord-textMuted truncate"
                                >
                                    {item.mxcUrl}
                                </p>
                            </div>
                            <div class="flex items-center gap-3">
                                <label
                                    class="flex items-center gap-1.5 text-xs text-discord-textPrimary"
                                >
                                    <input
                                        type="checkbox"
                                        checked={item.canEmoji}
                                        onchange={(e) =>
                                            setRoomEmoteFlag(
                                                pack,
                                                item,
                                                "emoticon",
                                                (e.target as HTMLInputElement)
                                                    .checked,
                                            )}
                                        disabled={pack.inherited ||
                                            !canEdit ||
                                            emoteActionPending ===
                                                `${packKey(pack)}:${item.shortcode}:emoticon`}
                                        class="accent-discord-accent"
                                    />
                                    {t("common.emoji")}
                                </label>
                                <label
                                    class="flex items-center gap-1.5 text-xs text-discord-textPrimary"
                                >
                                    <input
                                        type="checkbox"
                                        checked={item.canSticker}
                                        onchange={(e) =>
                                            setRoomEmoteFlag(
                                                pack,
                                                item,
                                                "sticker",
                                                (e.target as HTMLInputElement)
                                                    .checked,
                                            )}
                                        disabled={pack.inherited ||
                                            !canEdit ||
                                            emoteActionPending ===
                                                `${packKey(pack)}:${item.shortcode}:sticker`}
                                        class="accent-discord-accent"
                                    />
                                    {t("imagePackEditor.sticker")}
                                </label>
                            </div>
                            <button
                                onclick={() => addToMine(pack, item)}
                                disabled={packBusy ===
                                    packBusyKey(pack, `mine:${item.shortcode}`)}
                                class="px-2 py-1 rounded text-xs text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover disabled:opacity-50"
                                title={t("imagePackEditor.addImageToMyPack")}
                            >
                                {t("imagePackEditor.addToMine")}
                            </button>
                            {#if canEdit && !pack.inherited}
                                <button
                                    onclick={() =>
                                        doRemoveEmote(pack, item.shortcode)}
                                    disabled={emoteActionPending ===
                                        `${packKey(pack)}:${item.shortcode}:remove`}
                                    class="p-1 rounded text-discord-textMuted hover:text-discord-danger hover:bg-discord-messageHover transition-colors disabled:opacity-50"
                                    title={t("imagePackEditor.removeImage")}
                                >
                                    <svg
                                        class="w-4 h-4"
                                        fill="currentColor"
                                        viewBox="0 0 24 24"
                                        ><path
                                            d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59z"
                                        /></svg
                                    >
                                </button>
                            {/if}
                        </div>
                    {/each}
                </div>
            </div>
        {/each}
        {#if emotePacks.length === 0}<p
                class="text-sm text-discord-textMuted text-center py-4"
            >
                {t("imagePackEditor.noCustomImages")}
            </p>{/if}
    </div>
</div>
