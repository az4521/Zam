<script lang="ts">
    import { t } from "$lib/i18n";
    import { untrack } from "svelte";
    import {
        Download,
        File as FileIcon,
        Film,
        Image as ImageIcon,
        Music,
        Play,
    } from "lucide-svelte";
    import {
        mxcToHttp,
        fetchAttachmentBlob,
        fetchDecryptedAttachmentBlob,
    } from "$lib/matrix/client";
    import { saveObjectUrl, revokeLater } from "$lib/utils/saveFile";
    import { GALLERY_MSGTYPE_UNSTABLE } from "$lib/utils/gallery";
    import {
        mediaItemKey,
        mediaItemsFromEvent,
        mediaThumbnailMxc,
        mediaTileSource,
        formatMediaDuration,
        formatMediaSize,
        type RoomMediaItem,
    } from "$lib/utils/roomMedia";
    import { galleryNav, galleryPositionLabel } from "$lib/utils/mediaGallery";
    import {
        justifyGallery,
        layoutAspect,
        thumbnailBox,
    } from "$lib/utils/galleryLayout";
    import { showErrorToast } from "$lib/stores/toasts.svelte";
    import Lightbox from "$lib/components/ui/Lightbox.svelte";
    import { fullImage, type FullImageSource } from "$lib/actions/fullImage";
    import MediaProgress from "$lib/components/ui/MediaProgress.svelte";
    import type { DownloadProgress } from "$lib/utils/downloadProgress";

    interface Props {
        /** The gallery's valid items, from galleryItems(content). */
        items: Record<string, unknown>[];
        eventId: string;
        sender: string;
        ts: number;
    }

    let { items, eventId, sender, ts }: Props = $props();

    interface Entry {
        /** Stable per item within this event: the event id plus its position. */
        key: string;
        media: RoomMediaItem;
        /** The item's `info` block, for its intrinsic dimensions. */
        info: Record<string, unknown>;
    }

    // `items` is already galleryItems() output, so passing it back as the
    // gallery's itemtypes keeps every itemIndex aligned with it.
    const entries = $derived.by((): Entry[] =>
        mediaItemsFromEvent({
            eventId,
            sender,
            ts,
            type: "m.room.message",
            content: {
                msgtype: GALLERY_MSGTYPE_UNSTABLE,
                itemtypes: items,
            },
        }).map((media) => {
            const raw = items[media.itemIndex ?? -1];
            const info =
                typeof raw?.info === "object" && raw.info !== null
                    ? (raw.info as Record<string, unknown>)
                    : {};
            return { key: mediaItemKey(media), media, info };
        }),
    );

    // Images and videos form the grid and the lightbox sequence; audio and
    // files are listed below it as rows.
    const visual = $derived(
        entries.filter(
            (e) => e.media.kind === "image" || e.media.kind === "video",
        ),
    );
    const others = $derived(
        entries.filter(
            (e) => e.media.kind === "audio" || e.media.kind === "file",
        ),
    );

    // Measured width of the visual section; 0 until the first measurement,
    // when the first paint lays out at 400px instead.
    let containerWidth = $state(0);
    // Aspect ratios learned from loaded tiles that carried no w/h in info. A
    // video's tile is its thumbnail, which has the video's shape.
    let loadedAspects = $state<Record<string, number>>({});

    // Aspect for each visual entry: declared info.w/h, else the loaded
    // tile's natural size, else 1 (a video is never assumed 16/9).
    const aspects = $derived(
        visual.map((e) => {
            const w = Number(e.info.w);
            const h = Number(e.info.h);
            if (w > 0 && h > 0) return layoutAspect(w, h);
            return loadedAspects[e.key] ?? 1;
        }),
    );
    const rows = $derived(
        justifyGallery(aspects, containerWidth > 0 ? containerWidth : 400, {
            gap: 4,
        }),
    );

    function learnAspect(key: string, img: HTMLImageElement): void {
        if (!img.naturalWidth || !img.naturalHeight) return;
        const a = layoutAspect(img.naturalWidth, img.naturalHeight);
        if (loadedAspects[key] !== a) loadedAspects[key] = a;
    }

    function devicePixelRatioOrOne(): number {
        return typeof window === "undefined" ? 1 : window.devicePixelRatio;
    }

    // Decrypted encrypted thumbnails, keyed by entry key.
    let decryptedThumbs = $state<Record<string, string>>({});
    let thumbFailed = $state<Record<string, boolean>>({});
    // Decrypted full media for the lightbox, keyed by entry key.
    let decryptedFull = $state<Record<string, string>>({});
    let viewerDecrypting = $state(false);
    let viewerProgress = $state<DownloadProgress | null>(null);
    let viewerIndex = $state<number | null>(null);

    // Bumped on teardown (a plain let, never reactive) so a decrypt still in
    // flight revokes its own URL instead of writing into dead state.
    let blobGen = 0;
    const thumbPending = new Set<string>();
    function releaseDecryptedBlobs(): void {
        blobGen++;
        thumbPending.clear();
        for (const url of Object.values(decryptedThumbs))
            URL.revokeObjectURL(url);
        for (const url of Object.values(decryptedFull))
            URL.revokeObjectURL(url);
        decryptedThumbs = {};
        decryptedFull = {};
        viewerDecrypting = false;
    }
    $effect(() => () => releaseDecryptedBlobs());

    // Decrypt each encrypted tile once: an image's own file, a video's
    // thumbnail_file (never the video itself; see mediaTileSource).
    $effect(() => {
        const wanted = visual.flatMap((e) => {
            // An encrypted image's own thumbnail_file when it has one: a
            // gallery of 40 photos must not download 40 full-size files just
            // to draw the grid.
            const source =
                e.media.kind === "image" && e.media.encryptedThumbnailFile
                    ? {
                          kind: "encrypted" as const,
                          file: e.media.encryptedThumbnailFile,
                          mimetype: e.media.thumbnailMimetype ?? null,
                      }
                    : mediaTileSource(e.media);
            return source?.kind === "encrypted" ? [{ key: e.key, source }] : [];
        });
        untrack(() => {
            const gen = blobGen;
            for (const { key, source } of wanted) {
                if (source.kind !== "encrypted") continue;
                if (decryptedThumbs[key] || thumbPending.has(key)) continue;
                thumbPending.add(key);
                fetchDecryptedAttachmentBlob(
                    source.file,
                    source.mimetype ?? undefined,
                )
                    .then((url) => {
                        if (gen !== blobGen) {
                            URL.revokeObjectURL(url);
                            return;
                        }
                        decryptedThumbs[key] = url;
                    })
                    .catch(() => {
                        if (gen === blobGen) thumbFailed[key] = true;
                    })
                    .finally(() => {
                        if (gen === blobGen) thumbPending.delete(key);
                    });
            }
        });
    });

    const viewerEntry = $derived(
        viewerIndex === null ? null : (visual[viewerIndex] ?? null),
    );
    const viewerKey = $derived(viewerEntry?.key ?? null);
    const nav = $derived(
        viewerIndex === null ? null : galleryNav(visual.length, viewerIndex),
    );

    // Decrypt the viewed item when it is an encrypted image. An encrypted
    // video is decrypted by the Lightbox itself. Keyed on the key alone so a
    // re-render with equal content does not cancel and restart the decrypt.
    $effect(() => {
        const key = viewerKey;
        if (key === null) return;
        const entry = untrack(() => viewerEntry);
        if (!entry) return;
        const media = entry.media;
        if (!media.encrypted || !media.encryptedFile) return;
        if (media.kind === "video") return;
        if (untrack(() => decryptedFull[key])) return;
        const gen = blobGen;
        let cancelled = false;
        viewerDecrypting = true;
        viewerProgress = null;
        fetchDecryptedAttachmentBlob(
            media.encryptedFile,
            media.mimetype ?? undefined,
            {
                expectedSize: media.size,
                onProgress: (p) => {
                    if (!cancelled) viewerProgress = p;
                },
            },
        )
            .then((decrypted) => {
                if (gen !== blobGen) {
                    URL.revokeObjectURL(decrypted);
                    return;
                }
                decryptedFull[key] = decrypted;
                if (!cancelled) viewerDecrypting = false;
            })
            .catch(() => {
                if (cancelled || gen !== blobGen) return;
                viewerDecrypting = false;
                viewerIndex = null;
                showErrorToast(t("roomMediaPanel.couldNotLoadThisMedia"));
            });
        return () => {
            cancelled = true;
            viewerDecrypting = false;
        };
    });

    const viewerSrc = $derived.by((): string | null => {
        const entry = viewerEntry;
        if (!entry) return null;
        const media = entry.media;
        if (media.encrypted && media.kind !== "video")
            return decryptedFull[entry.key] ?? null;
        return mxcToHttp(media.url);
    });

    const viewerPoster = $derived.by((): string | null => {
        const entry = viewerEntry;
        if (!entry || entry.media.kind !== "video") return null;
        if (entry.media.encrypted) return decryptedThumbs[entry.key] ?? null;
        // "scale" so the poster matches the video's own aspect ratio.
        return mxcToHttp(mediaThumbnailMxc(entry.media), 800, 600, "scale");
    });

    function step(delta: number): void {
        if (viewerIndex === null) return;
        const next = viewerIndex + delta;
        if (next < 0 || next >= visual.length) return;
        viewerIndex = next;
    }

    /** The original behind an image tile, for the desktop right-click "Copy
     *  image" / "Save image as". None for a video: its tile is a poster. */
    function tileOriginal(entry: Entry): FullImageSource | null {
        const media = entry.media;
        if (media.kind !== "image") return null;
        const name = media.name;
        if (media.encrypted && media.encryptedFile) {
            const done = decryptedFull[entry.key];
            if (done) return { kind: "url", url: done, name };
            return {
                kind: "encrypted",
                file: media.encryptedFile,
                mimetype: media.mimetype ?? undefined,
                name,
            };
        }
        const url = mxcToHttp(media.url);
        return url ? { kind: "url", url, name } : null;
    }

    async function download(media: RoomMediaItem): Promise<void> {
        try {
            const blobUrl =
                media.encrypted && media.encryptedFile
                    ? await fetchDecryptedAttachmentBlob(
                          media.encryptedFile,
                          media.mimetype ?? undefined,
                      )
                    : await fetchAttachmentBlob(mxcToHttp(media.url)!);
            try {
                await saveObjectUrl(blobUrl, media.name);
            } finally {
                revokeLater(blobUrl);
            }
        } catch (e) {
            console.error("Failed to download attachment", e);
            showErrorToast(t("roomMediaPanel.failedToDownloadAttachment"));
        }
    }
</script>

<div
    role="group"
    aria-label={t("messageItem.galleryLabel", { n: items.length })}
    class="mt-1 max-w-full space-y-1"
>
    {#if entries.length === 0}
        <p class="text-sm text-discord-textMuted">
            {t("messageItem.galleryEmpty")}
        </p>
    {/if}

    {#if visual.length > 0}
        <div class="w-full max-w-[480px]" bind:clientWidth={containerWidth}>
            {#each rows as row, r (row.tiles[0]?.index)}
                <div class="flex gap-1 {r > 0 ? 'mt-1' : ''}">
                    {#each row.tiles as tile (visual[tile.index].key)}
                        {@const entry = visual[tile.index]}
                        {@const media = entry.media}
                        {@const box = thumbnailBox(
                            tile.width,
                            tile.height,
                            devicePixelRatioOrOne(),
                        )}
                        {@const thumb = thumbFailed[entry.key]
                            ? null
                            : media.encrypted
                              ? (decryptedThumbs[entry.key] ?? null)
                              : mxcToHttp(
                                    mediaThumbnailMxc(media),
                                    box,
                                    box,
                                    "scale",
                                )}
                        {@const duration = formatMediaDuration(
                            media.durationMs,
                        )}
                        <button
                            type="button"
                            onclick={() => (viewerIndex = tile.index)}
                            aria-label={t("messageItem.galleryOpenItem", {
                                name: media.name,
                            })}
                            title={media.name}
                            class="relative block shrink-0 overflow-hidden rounded-lg bg-discord-background hover:opacity-80 transition-opacity"
                            style:width="{tile.width}px"
                            style:height="{tile.height}px"
                        >
                            {#if thumb}
                                <img
                                    src={thumb}
                                    alt=""
                                    loading="lazy"
                                    use:fullImage={() => tileOriginal(entry)}
                                    class="w-full h-full object-contain bg-discord-backgroundTertiary"
                                    onload={(e) =>
                                        learnAspect(
                                            entry.key,
                                            e.currentTarget as HTMLImageElement,
                                        )}
                                    onerror={() =>
                                        (thumbFailed[entry.key] = true)}
                                />
                            {:else}
                                <span
                                    class="absolute inset-0 flex items-center justify-center bg-discord-backgroundTertiary text-discord-textMuted"
                                >
                                    {#if media.kind === "video"}
                                        <Film class="w-6 h-6" />
                                    {:else}
                                        <ImageIcon class="w-6 h-6" />
                                    {/if}
                                </span>
                            {/if}
                            {#if media.kind === "video"}
                                <span
                                    class="absolute inset-0 flex items-center justify-center"
                                >
                                    <span
                                        class="w-9 h-9 rounded-full bg-black/60 flex items-center justify-center"
                                    >
                                        <Play
                                            class="w-4 h-4 text-white ms-0.5"
                                            fill="currentColor"
                                        />
                                    </span>
                                </span>
                                {#if duration}
                                    <span
                                        class="absolute bottom-1 end-1 px-1 rounded bg-black/60 text-white text-[0.625rem]"
                                        >{duration}</span
                                    >
                                {/if}
                            {/if}
                        </button>
                    {/each}
                </div>
            {/each}
        </div>
    {/if}

    {#if others.length > 0}
        <ul class="space-y-1">
            {#each others as entry (entry.key)}
                {@const media = entry.media}
                {@const sizeLabel = formatMediaSize(media.size)}
                <li
                    class="flex items-center gap-2 p-2 rounded-lg bg-discord-backgroundSecondary max-w-sm min-w-0"
                >
                    {#if media.kind === "audio"}
                        <Music
                            class="w-5 h-5 shrink-0 text-discord-textMuted"
                        />
                    {:else}
                        <FileIcon
                            class="w-5 h-5 shrink-0 text-discord-textMuted"
                        />
                    {/if}
                    <div class="min-w-0 flex-1">
                        <p class="text-sm text-discord-textPrimary truncate">
                            {media.name}
                        </p>
                        {#if sizeLabel}
                            <p class="text-xs text-discord-textMuted">
                                {sizeLabel}
                            </p>
                        {/if}
                    </div>
                    <button
                        type="button"
                        onclick={() => download(media)}
                        aria-label={t("messageItem.galleryDownload", {
                            name: media.name,
                        })}
                        class="shrink-0 p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
                    >
                        <Download class="w-4 h-4" />
                    </button>
                </li>
            {/each}
        </ul>
    {/if}
</div>

{#if viewerEntry}
    {#if viewerDecrypting}
        <div
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            role="dialog"
            aria-modal="true"
            aria-label={t("roomMediaPanel.decryptingMedia")}
        >
            <div class="max-w-sm w-full shadow-lg">
                <MediaProgress
                    label={t("roomMediaPanel.decryptingMedia2")}
                    progress={viewerProgress}
                />
            </div>
        </div>
    {:else if viewerSrc}
        <Lightbox
            src={viewerSrc}
            alt={viewerEntry.media.name}
            kind={viewerEntry.media.kind === "video" ? "video" : "image"}
            poster={viewerPoster}
            filename={viewerEntry.media.name}
            encryptedFile={viewerEntry.media.encrypted &&
            viewerEntry.media.kind === "video"
                ? viewerEntry.media.encryptedFile
                : undefined}
            mimetype={viewerEntry.media.mimetype}
            sizeHint={viewerEntry.media.size}
            onClose={() => (viewerIndex = null)}
            onPrev={nav && nav.prevIndex !== null ? () => step(-1) : undefined}
            onNext={nav && nav.nextIndex !== null ? () => step(1) : undefined}
            position={galleryPositionLabel(visual.length, viewerIndex ?? -1)}
        />
    {/if}
{/if}
