<script lang="ts">
    import type { Room } from "matrix-js-sdk";
    import { untrack } from "svelte";
    import {
        getAvailableRoomEmotePacks,
        addRoomEmote,
        setRoomEmoteUsage,
        removeRoomEmoteImage,
        validateEmojiShortcode,
        uploadContent,
        mxcToHttp,
        getRoomAvatar,
        type CustomImagePack,
        type CustomPackImage,
        type ImageUsage,
    } from "$lib/matrix/client";
    import { roomsState } from "$lib/stores/rooms.svelte";
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
            return newEmotePackName.trim() || `${room.name || "Room"} Emotes`;
        }
        return (
            currentEmotePacks().find(
                (pack) => packKey(pack) === selectedEmotePackKey,
            )?.name || `${room.name || "Room"} Emotes`
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
            emoteError = "Choose at least one usage.";
        }
        if (
            !emoteError &&
            selectedEmotePackKey === "__new" &&
            currentEmotePacks().length > 0 &&
            !newEmotePackName.trim()
        ) {
            emoteError = "Enter a pack name.";
        }
        if (emoteError) {
            input.value = "";
            return;
        }

        emoteUploading = true;
        try {
            const mxcUrl = await uploadContent(file);
            const stateKey = selectedEmoteStateKey();
            const normalized = await addRoomEmote(
                room.roomId,
                stateKey,
                emoteShortcode,
                mxcUrl,
                selectedEmotePackName(),
                usage,
            );
            const httpUrl = mxcToHttp(mxcUrl);
            const nextImage = {
                shortcode: normalized,
                mxcUrl,
                url: httpUrl ?? "",
                usage,
                canEmoji: usage.includes("emoticon"),
                canSticker: usage.includes("sticker"),
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
            emoteError = err?.message ?? "Upload failed";
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
            emoteError = "Choose at least one usage.";
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
            emoteError = err?.message ?? "Failed to update usage";
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
            emoteError = err?.message ?? "Failed to remove image";
        } finally {
            emoteActionPending = null;
        }
    }
</script>

<div class="space-y-4">
    <div class="space-y-2">
        <label
            class="block text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
            for="room-emote-shortcode"
        >
            Add Image
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
                    <option value="__new">New pack</option>
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
                        placeholder="Pack name"
                        class="min-w-0 bg-discord-backgroundTertiary text-discord-textPrimary placeholder-discord-textMuted text-sm rounded px-3 py-2 outline-none border border-transparent focus:border-discord-accent/50 disabled:opacity-50"
                    />
                {/if}
                <div
                    class="flex items-center bg-discord-backgroundTertiary rounded border border-transparent focus-within:border-discord-accent/50"
                >
                    <span class="pl-3 text-sm text-discord-textMuted">:</span>
                    <input
                        id="room-emote-shortcode"
                        bind:value={emoteShortcode}
                        disabled={!canEdit || emoteUploading}
                        placeholder="shortcode"
                        class="min-w-0 flex-1 bg-transparent text-discord-textPrimary placeholder-discord-textMuted text-sm py-2 outline-none disabled:opacity-50"
                    />
                    <span class="pr-3 text-sm text-discord-textMuted">:</span>
                </div>
            </div>
            {#if canEdit}
                <label
                    class="shrink-0 cursor-pointer px-3 py-2 rounded bg-discord-accent hover:bg-discord-accentHover text-white text-sm font-semibold transition-colors text-center {emoteUploading
                        ? 'opacity-50 pointer-events-none'
                        : ''}"
                >
                    {emoteUploading ? "Uploading…" : "Upload Image"}
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
                Use as emoji
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
                Use as sticker
            </label>
        </div>
    </div>

    {#if emoteError}<p class="text-sm text-discord-danger">
            {emoteError}
        </p>{/if}

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
                                ? `Inherited from ${pack.sourceName}`
                                : pack.sourceName}
                        </p>
                    </div>
                </div>
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
                                    Emoji
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
                                    Sticker
                                </label>
                            </div>
                            {#if canEdit && !pack.inherited}
                                <button
                                    onclick={() =>
                                        doRemoveEmote(pack, item.shortcode)}
                                    disabled={emoteActionPending ===
                                        `${packKey(pack)}:${item.shortcode}:remove`}
                                    class="p-1 rounded text-discord-textMuted hover:text-discord-danger hover:bg-discord-messageHover transition-colors disabled:opacity-50"
                                    title="Remove image"
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
                No custom images
            </p>{/if}
    </div>
</div>
