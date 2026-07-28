<script lang="ts">
    import {
        addUserEmoji,
        addUserEmote,
        addUserSticker,
        getUserEmojiPack,
        getUserEmotePack,
        getUserStickerPack,
        mxcToHttp,
        removeUserEmoji,
        removeUserEmoteImage,
        removeUserSticker,
        setUserEmoteUsage,
        uploadContent,
        validateEmojiShortcode,
        type ImageUsage,
    } from "$lib/matrix/client";
    import { X } from "lucide-svelte";
    import { roomsState } from "$lib/stores/rooms.svelte";

    type PackKind = "emotes" | "emojis" | "stickers";
    interface Props {
        kind: PackKind;
    }
    interface PackItem {
        shortcode: string;
        mxcUrl: string;
        url: string;
        canEmoji?: boolean;
        canSticker?: boolean;
    }

    let { kind }: Props = $props();
    let items = $state<PackItem[]>([]);
    let shortcode = $state("");
    let uploading = $state(false);
    let pending = $state<string | null>(null);
    let error = $state("");
    let asEmoji = $state(true);
    let asSticker = $state(false);

    const singular = $derived(
        kind === "emotes" ? "Image" : kind === "emojis" ? "Emoji" : "Sticker",
    );

    function sort(values: PackItem[]): PackItem[] {
        return [...values].sort((a, b) =>
            a.shortcode.localeCompare(b.shortcode),
        );
    }

    function load() {
        items = sort(
            kind === "emotes"
                ? getUserEmotePack()
                : kind === "emojis"
                  ? getUserEmojiPack()
                  : getUserStickerPack(),
        );
    }

    function usage(emoji: boolean, sticker: boolean): ImageUsage[] {
        return [
            ...(emoji ? (["emoticon"] as ImageUsage[]) : []),
            ...(sticker ? (["sticker"] as ImageUsage[]) : []),
        ];
    }

    async function upload(event: Event) {
        const input = event.currentTarget as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        error = validateEmojiShortcode(shortcode) ?? "";
        const selectedUsage = usage(asEmoji, asSticker);
        if (kind === "emotes" && selectedUsage.length === 0) {
            error = "Choose at least one usage.";
        }
        if (error) {
            input.value = "";
            return;
        }
        uploading = true;
        try {
            const mxcUrl = await uploadContent(file);
            const normalized =
                kind === "emotes"
                    ? await addUserEmote(shortcode, mxcUrl, selectedUsage)
                    : kind === "emojis"
                      ? await addUserEmoji(shortcode, mxcUrl)
                      : await addUserSticker(shortcode, mxcUrl);
            const url = mxcToHttp(mxcUrl);
            if (url) {
                items = sort([
                    ...items.filter((item) => item.shortcode !== normalized),
                    {
                        shortcode: normalized,
                        mxcUrl,
                        url,
                        canEmoji: selectedUsage.includes("emoticon"),
                        canSticker: selectedUsage.includes("sticker"),
                    },
                ]);
            }
            shortcode = "";
            roomsState.roomsTick++;
        } catch (uploadError) {
            error = (uploadError as Error)?.message ?? "Upload failed";
        } finally {
            uploading = false;
            input.value = "";
        }
    }

    async function remove(item: PackItem) {
        pending = `${item.shortcode}:remove`;
        error = "";
        try {
            if (kind === "emotes") await removeUserEmoteImage(item.shortcode);
            else if (kind === "emojis") await removeUserEmoji(item.shortcode);
            else await removeUserSticker(item.shortcode);
            items = items.filter(
                (existing) => existing.shortcode !== item.shortcode,
            );
            roomsState.roomsTick++;
        } catch (removeError) {
            error =
                (removeError as Error)?.message ??
                `Failed to remove ${singular}`;
        } finally {
            pending = null;
        }
    }

    async function setUsage(
        item: PackItem,
        changed: ImageUsage,
        enabled: boolean,
    ) {
        const next = usage(
            changed === "emoticon" ? enabled : !!item.canEmoji,
            changed === "sticker" ? enabled : !!item.canSticker,
        );
        if (next.length === 0) {
            error = "Choose at least one usage.";
            return;
        }
        pending = `${item.shortcode}:${changed}`;
        error = "";
        try {
            await setUserEmoteUsage(item.shortcode, next);
            items = items.map((existing) =>
                existing.shortcode === item.shortcode
                    ? {
                          ...existing,
                          canEmoji: next.includes("emoticon"),
                          canSticker: next.includes("sticker"),
                      }
                    : existing,
            );
            roomsState.roomsTick++;
        } catch (usageError) {
            error = (usageError as Error)?.message ?? "Failed to update usage";
        } finally {
            pending = null;
        }
    }

    $effect(() => {
        void kind;
        load();
    });
</script>

<div class="space-y-4">
    <section class="space-y-2">
        <label
            class="block text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
            for={`user-${kind}-shortcode`}
        >
            Add {singular}
        </label>
        <div
            class="grid gap-2 {kind === 'emotes'
                ? 'sm:grid-cols-[1fr_auto_auto]'
                : 'sm:grid-cols-[1fr_auto]'}"
        >
            <div
                class="flex items-center bg-discord-backgroundTertiary rounded border border-transparent focus-within:border-discord-accent/50"
            >
                <span class="pl-3 text-sm text-discord-textMuted">:</span>
                <input
                    id={`user-${kind}-shortcode`}
                    bind:value={shortcode}
                    disabled={uploading}
                    placeholder="shortcode"
                    class="min-w-0 flex-1 bg-transparent text-discord-textPrimary text-sm py-2 outline-none"
                />
                <span class="pr-3 text-sm text-discord-textMuted">:</span>
            </div>
            {#if kind === "emotes"}
                <div
                    class="flex items-center gap-3 px-3 py-2 rounded bg-discord-backgroundTertiary"
                >
                    <label
                        class="flex items-center gap-1.5 text-xs text-discord-textPrimary"
                        ><input
                            type="checkbox"
                            bind:checked={asEmoji}
                            disabled={uploading}
                        /> Emoji</label
                    >
                    <label
                        class="flex items-center gap-1.5 text-xs text-discord-textPrimary"
                        ><input
                            type="checkbox"
                            bind:checked={asSticker}
                            disabled={uploading}
                        /> Sticker</label
                    >
                </div>
            {/if}
            <label
                class="cursor-pointer px-3 py-2 rounded bg-discord-accent text-white text-sm font-semibold text-center {uploading
                    ? 'opacity-50 pointer-events-none'
                    : ''}"
            >
                {uploading ? "Uploading…" : "Upload Image"}
                <input
                    type="file"
                    accept="image/*"
                    class="hidden"
                    onchange={upload}
                    disabled={uploading}
                />
            </label>
        </div>
    </section>

    {#if error}<p class="text-sm text-discord-danger">{error}</p>{/if}
    <div class="space-y-1.5">
        {#each items as item (item.shortcode)}
            <div
                class="flex items-center gap-3 p-2 rounded bg-discord-backgroundTertiary"
            >
                <div
                    class="w-12 h-12 rounded bg-discord-backgroundSecondary flex-shrink-0 overflow-hidden flex items-center justify-center"
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
                    <p class="text-xs text-discord-textMuted truncate">
                        {item.mxcUrl}
                    </p>
                </div>
                {#if kind === "emotes"}
                    <label
                        class="flex items-center gap-1.5 text-xs text-discord-textPrimary"
                        ><input
                            type="checkbox"
                            checked={item.canEmoji}
                            onchange={(event) =>
                                setUsage(
                                    item,
                                    "emoticon",
                                    (event.currentTarget as HTMLInputElement)
                                        .checked,
                                )}
                            disabled={pending === `${item.shortcode}:emoticon`}
                        /> Emoji</label
                    >
                    <label
                        class="flex items-center gap-1.5 text-xs text-discord-textPrimary"
                        ><input
                            type="checkbox"
                            checked={item.canSticker}
                            onchange={(event) =>
                                setUsage(
                                    item,
                                    "sticker",
                                    (event.currentTarget as HTMLInputElement)
                                        .checked,
                                )}
                            disabled={pending === `${item.shortcode}:sticker`}
                        /> Sticker</label
                    >
                {/if}
                <button
                    onclick={() => remove(item)}
                    disabled={pending === `${item.shortcode}:remove`}
                    class="p-1 rounded text-discord-textMuted hover:text-discord-danger hover:bg-discord-messageHover disabled:opacity-50"
                    title={`Remove ${singular.toLowerCase()}`}
                >
                    <X size={14} aria-hidden="true" />
                </button>
            </div>
        {/each}
        {#if items.length === 0}
            <p class="text-sm text-discord-textMuted text-center py-4">
                No custom {kind === "emotes" ? "images" : kind}
            </p>
        {/if}
    </div>
</div>
