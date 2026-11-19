<script lang="ts">
    import { t } from "$lib/i18n";
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
    import { shortcodeFromFileName } from "$lib/utils/emoteShortcode";
    import TelegramImport from "./TelegramImport.svelte";

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
    // A picked file waits here until the user confirms with Add.
    let staged = $state<{ file: File; previewUrl: string } | null>(null);
    // The shortcode last filled in from a file name; replaced on the next pick
    // only while the user has not typed their own.
    let autoShortcode = "";

    const singular = $derived(
        kind === "emotes"
            ? t("customPackSettings.image")
            : kind === "emojis"
              ? t("common.emoji")
              : t("customPackSettings.sticker"),
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

    function releaseStaged(entry: { previewUrl: string }) {
        URL.revokeObjectURL(entry.previewUrl);
        if (staged === entry) staged = null;
    }

    // Picking a file only stages it; nothing is uploaded until Add.
    function stageFile(event: Event) {
        const input = event.currentTarget as HTMLInputElement;
        const file = input.files?.[0];
        input.value = "";
        if (!file) return;
        error = "";
        const suggested = shortcodeFromFileName(file.name);
        if (shortcode === "" || shortcode === autoShortcode) {
            shortcode = suggested;
        }
        autoShortcode = suggested;
        if (staged) URL.revokeObjectURL(staged.previewUrl);
        staged = { file, previewUrl: URL.createObjectURL(file) };
    }

    function cancelStaged() {
        if (!staged) return;
        if (shortcode === autoShortcode) shortcode = "";
        autoShortcode = "";
        error = "";
        releaseStaged(staged);
    }

    async function addStaged() {
        const entry = staged;
        if (!entry) return;
        error = validateEmojiShortcode(shortcode) ?? "";
        const selectedUsage = usage(asEmoji, asSticker);
        if (kind === "emotes" && selectedUsage.length === 0) {
            error = t("customPackSettings.chooseAtLeastOneUsage");
        }
        if (error) return;
        uploading = true;
        try {
            const mxcUrl = await uploadContent(entry.file);
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
            autoShortcode = "";
            releaseStaged(entry);
            roomsState.roomsTick++;
        } catch (uploadError) {
            error =
                (uploadError as Error)?.message ??
                t("customPackSettings.uploadFailed");
        } finally {
            uploading = false;
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
                t("customPackSettings.failedToRemove", { singular });
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
            error = t("customPackSettings.chooseAtLeastOneUsage");
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
            error =
                (usageError as Error)?.message ??
                t("customPackSettings.failedToUpdateUsage");
        } finally {
            pending = null;
        }
    }

    $effect(() => {
        void kind;
        load();
    });

    // Free the preview URL when the component goes away with a file staged.
    $effect(() => () => {
        if (staged) URL.revokeObjectURL(staged.previewUrl);
    });
</script>

<div class="space-y-4">
    <section class="space-y-2">
        <label
            class="block text-xs font-semibold text-zam-textMuted uppercase tracking-wide"
            for={`user-${kind}-shortcode`}
        >
            {t("customPackSettings.add", { singular })}
        </label>
        <div
            class="grid gap-2 {kind === 'emotes'
                ? 'sm:grid-cols-[1fr_auto_auto]'
                : 'sm:grid-cols-[1fr_auto]'}"
        >
            <div
                class="flex items-center bg-zam-backgroundTertiary rounded border border-transparent focus-within:border-zam-accent/50"
            >
                <span class="ps-3 text-sm text-zam-textMuted">:</span>
                <input
                    id={`user-${kind}-shortcode`}
                    bind:value={shortcode}
                    disabled={uploading}
                    placeholder={t("customPackSettings.shortcode")}
                    class="min-w-0 flex-1 bg-transparent text-zam-textPrimary text-sm py-2 outline-none"
                />
                <span class="pe-3 text-sm text-zam-textMuted">:</span>
            </div>
            {#if kind === "emotes"}
                <div
                    class="flex items-center gap-3 px-3 py-2 rounded bg-zam-backgroundTertiary"
                >
                    <label
                        class="flex items-center gap-1.5 text-xs text-zam-textPrimary"
                        ><input
                            type="checkbox"
                            bind:checked={asEmoji}
                            disabled={uploading}
                        />
                        {t("common.emoji")}</label
                    >
                    <label
                        class="flex items-center gap-1.5 text-xs text-zam-textPrimary"
                        ><input
                            type="checkbox"
                            bind:checked={asSticker}
                            disabled={uploading}
                        />
                        {t("customPackSettings.sticker")}</label
                    >
                </div>
            {/if}
            <label
                class="cursor-pointer px-3 py-2 rounded bg-zam-accent text-white text-sm font-semibold text-center {uploading
                    ? 'opacity-50 pointer-events-none'
                    : ''}"
            >
                {uploading
                    ? t("common.uploading")
                    : staged
                      ? t("customPackSettings.chooseAnother")
                      : t("common.uploadImage")}
                <input
                    type="file"
                    accept="image/*"
                    class="hidden"
                    onchange={stageFile}
                    disabled={uploading}
                />
            </label>
        </div>
        {#if staged}
            <div
                class="flex items-center gap-3 p-2 rounded bg-zam-backgroundTertiary"
            >
                <div
                    class="w-12 h-12 rounded bg-zam-backgroundSecondary flex-shrink-0 overflow-hidden flex items-center justify-center"
                >
                    <img
                        src={staged.previewUrl}
                        alt={t("customPackSettings.stagedPreview")}
                        class="max-w-full max-h-full object-contain"
                    />
                </div>
                <p class="flex-1 min-w-0 text-sm text-zam-textPrimary truncate">
                    {staged.file.name}
                </p>
                <button
                    type="button"
                    onclick={cancelStaged}
                    disabled={uploading}
                    class="px-3 py-1.5 rounded text-sm text-zam-textMuted hover:text-zam-textPrimary hover:bg-zam-messageHover disabled:opacity-50"
                >
                    {t("common.cancel")}
                </button>
                <button
                    type="button"
                    onclick={addStaged}
                    disabled={uploading}
                    class="px-3 py-1.5 rounded bg-zam-accent text-white text-sm font-semibold disabled:opacity-50"
                >
                    {t("common.add")}
                </button>
            </div>
        {/if}
    </section>

    {#if kind === "stickers"}
        <TelegramImport onImported={load} />
    {/if}

    {#if error}<p class="text-sm text-zam-danger">{error}</p>{/if}
    <div class="space-y-1.5">
        {#each items as item (item.shortcode)}
            <div
                class="flex items-center gap-3 p-2 rounded bg-zam-backgroundTertiary"
            >
                <div
                    class="w-12 h-12 rounded bg-zam-backgroundSecondary flex-shrink-0 overflow-hidden flex items-center justify-center"
                >
                    <img
                        src={item.url}
                        alt=""
                        class="max-w-full max-h-full object-contain"
                    />
                </div>
                <div class="flex-1 min-w-0">
                    <p
                        class="text-sm font-medium text-zam-textPrimary truncate"
                    >
                        :{item.shortcode}:
                    </p>
                    <p class="text-xs text-zam-textMuted truncate">
                        {item.mxcUrl}
                    </p>
                </div>
                {#if kind === "emotes"}
                    <label
                        class="flex items-center gap-1.5 text-xs text-zam-textPrimary"
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
                        />
                        {t("common.emoji")}</label
                    >
                    <label
                        class="flex items-center gap-1.5 text-xs text-zam-textPrimary"
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
                        />
                        {t("customPackSettings.sticker")}</label
                    >
                {/if}
                <button
                    onclick={() => remove(item)}
                    disabled={pending === `${item.shortcode}:remove`}
                    class="p-1 rounded text-zam-textMuted hover:text-zam-danger hover:bg-zam-messageHover disabled:opacity-50"
                    title={t("customPackSettings.remove", {
                        toLowerCase: singular.toLowerCase(),
                    })}
                >
                    <X size={14} aria-hidden="true" />
                </button>
            </div>
        {/each}
        {#if items.length === 0}
            <p class="text-sm text-zam-textMuted text-center py-4">
                {kind === "emotes"
                    ? t("customPackSettings.noCustomImages")
                    : kind === "emojis"
                      ? t("customPackSettings.noCustomEmojis")
                      : t("customPackSettings.noCustomStickers")}
            </p>
        {/if}
    </div>
</div>
