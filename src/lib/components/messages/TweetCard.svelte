<script lang="ts">
    // An X/Twitter post as a card, from FxTwitter's status API
    // (utils/tweetEmbed). Renders itself again, `nested`, for a quoted post.
    import TweetCard from "./TweetCard.svelte";
    import { t, intlLocale } from "$lib/i18n";
    import Lightbox from "$lib/components/ui/Lightbox.svelte";
    import { settingsState } from "$lib/stores/settings.svelte";
    import { pauseOffscreen } from "$lib/actions/pauseOffscreen";
    import { rememberVolume } from "$lib/actions/rememberVolume";
    import { parkOffscreen } from "$lib/actions/parkOffscreen";
    import { gifTileVideo } from "$lib/actions/gifTileVideo";
    import { hlsSource } from "$lib/actions/hlsSource";
    import { reservedMediaBox } from "$lib/utils/mediaDimensions";
    import { galleryNav, galleryPositionLabel } from "$lib/utils/mediaGallery";
    import {
        compactDateTime,
        fullTimestamp,
        messageTimestamp,
    } from "$lib/utils/timeFormat";
    import {
        compactCount,
        isQuoteTombstone,
        tweetPhotoThumb,
        type TweetEmbed,
        type TweetSegment,
    } from "$lib/utils/tweetEmbed";
    import { pickVideoSource } from "$lib/utils/tweetVideo";

    interface Props {
        tweet: TweetEmbed;
        /** A quoted post inside another card: no accent bar or footer. */
        nested?: boolean;
    }

    let { tweet, nested = false }: Props = $props();

    // Long posts (note tweets run to thousands of characters) are clamped
    // with a toggle; the toggle shows only when the clamp actually cuts.
    let expanded = $state(false);
    let clamped = $state(false);
    function measureClamp(node: HTMLElement) {
        const check = () => {
            clamped = node.scrollHeight > node.clientHeight + 1;
        };
        check();
        if (typeof ResizeObserver === "undefined") return;
        const ro = new ResizeObserver(check);
        ro.observe(node);
        return { destroy: () => ro.disconnect() };
    }

    // Videos, by URL, that the user has played. The rest show their
    // thumbnail: a mounted <video>, even unplayed, holds a decoder. A played
    // one that is paused and scrolled well away is unmounted again and
    // resumes from `resumeAt` (actions/parkOffscreen).
    let playing = $state<Set<string>>(new Set());
    const resumeAt = new Map<string, number>();
    let lightboxIndex = $state<number | null>(null);
    // A GIF opened full size. It is a looping mp4 here, so the viewer plays it
    // as a video; one at a time, with no gallery to step through.
    let gifViewer = $state<TweetEmbed["media"][number] | null>(null);

    // A link ending in a language (fxtwitter.com/.../status/<id>/en) asks
    // FxTwitter for a translation; it is shown in place of the original,
    // which stays one click away.
    let showOriginal = $state(false);
    const translated = $derived(
        tweet.translation && !showOriginal ? tweet.translation : null,
    );
    const sourceLanguage = $derived.by(() => {
        const tr = tweet.translation;
        if (!tr) return "";
        try {
            const name = new Intl.DisplayNames(intlLocale(), {
                type: "language",
            }).of(tr.sourceLang);
            if (name && name !== tr.sourceLang) return name;
        } catch {
            // Old engines or an odd code: fall back below.
        }
        return tr.sourceLangName ?? tr.sourceLang;
    });

    const photos = $derived(tweet.media.filter((m) => m.kind === "photo"));

    /** A photo as the viewer wants it: the original, the grid's thumb as its
     *  stand-in, and its size so the box is laid out before either loads. */
    function viewerItem(p: (typeof photos)[number]) {
        return {
            src: p.url,
            placeholders: [tweetPhotoThumb(p.url)],
            dims: p.width && p.height ? { w: p.width, h: p.height } : null,
        };
    }

    const pollEnded = $derived(
        tweet.poll?.endsAt != null && tweet.poll.endsAt <= Date.now(),
    );
    const pollLeader = $derived(
        tweet.poll
            ? Math.max(...tweet.poll.choices.map((c) => c.percentage))
            : 0,
    );

    const stats = $derived(
        [
            {
                icon: "reply",
                n: tweet.replies,
                label: (n: number) => t("common.replyCount", { count: n }),
            },
            {
                icon: "repost",
                n: tweet.reposts,
                label: (n: number) =>
                    t("linkPreview.repostCount", { count: n }),
            },
            {
                icon: "like",
                n: tweet.likes,
                label: (n: number) => t("linkPreview.likeCount", { count: n }),
            },
        ].filter((s): s is typeof s & { n: number } => s.n !== null),
    );
</script>

{#snippet segments(list: TweetSegment[])}
    {#each list as seg}{#if seg.kind === "link"}<a
                href={seg.href}
                target="_blank"
                rel="noopener noreferrer"
                class="text-zam-accent hover:underline">{seg.text}</a
            >{:else}{seg.text}{/if}{/each}
{/snippet}

{#snippet body()}
    <!-- Author -->
    <a
        href={tweet.authorUrl}
        target="_blank"
        rel="noopener noreferrer"
        class="group/author flex items-center gap-2 min-w-0 no-underline"
    >
        {#if tweet.avatarUrl}
            <img
                src={tweet.avatarUrl}
                alt=""
                width={nested ? 20 : 24}
                height={nested ? 20 : 24}
                class="{nested
                    ? 'w-5 h-5'
                    : 'w-6 h-6'} rounded-full flex-shrink-0 bg-black/10"
                loading="lazy"
                referrerpolicy="no-referrer"
            />
        {/if}
        <span class="min-w-0 truncate text-sm leading-snug">
            <span
                class="font-semibold text-zam-textPrimary group-hover/author:underline"
                >{tweet.authorName}</span
            >
            <span class="text-zam-textMuted">@{tweet.authorHandle}</span>
        </span>
    </a>

    {#if tweet.replyingTo}
        <p class="text-xs text-zam-textMuted -mt-1">
            ↩ {t("linkPreview.replyingTo")}
            <a
                href={tweet.replyingTo.url}
                target="_blank"
                rel="noopener noreferrer"
                class="text-zam-accent hover:underline"
                >@{tweet.replyingTo.handle}</a
            >
        </p>
    {/if}

    {#if tweet.text}
        <div>
            {#if tweet.translation}
                <p class="text-xs text-zam-textMuted mb-0.5">
                    {t("linkPreview.translatedFrom", {
                        language: sourceLanguage,
                    })}
                    ·
                    <button
                        type="button"
                        class="text-zam-accent hover:underline"
                        onclick={() => (showOriginal = !showOriginal)}
                    >
                        {showOriginal
                            ? t("linkPreview.showTranslation")
                            : t("linkPreview.showOriginal")}
                    </button>
                </p>
            {/if}
            <p
                use:measureClamp
                class="text-sm text-zam-textPrimary leading-relaxed whitespace-pre-wrap break-words {expanded
                    ? ''
                    : nested
                      ? 'line-clamp-6'
                      : 'line-clamp-[12]'}"
            >
                {@render segments(translated?.segments ?? tweet.segments)}
            </p>
            {#if clamped || expanded}
                <button
                    type="button"
                    class="text-xs text-zam-accent hover:underline mt-0.5"
                    onclick={() => (expanded = !expanded)}
                >
                    {expanded
                        ? t("linkPreview.showLess")
                        : t("linkPreview.showMore")}
                </button>
            {/if}
        </div>
    {/if}

    {#if tweet.poll}
        <div class="flex flex-col gap-1 max-w-sm">
            {#each tweet.poll.choices as choice}
                <div
                    class="relative overflow-hidden rounded bg-zam-backgroundTertiary px-2 py-1 text-sm text-zam-textPrimary"
                >
                    <div
                        class="absolute inset-y-0 start-0 {choice.percentage ===
                            pollLeader && pollEnded
                            ? 'bg-zam-accent/40'
                            : 'bg-zam-accent/20'}"
                        style="width: {choice.percentage}%"
                    ></div>
                    <div class="relative flex justify-between gap-3">
                        <span class="min-w-0 truncate">{choice.label}</span>
                        <span
                            class="flex-shrink-0 tabular-nums {choice.percentage ===
                            pollLeader
                                ? 'font-semibold'
                                : ''}">{choice.percentage}%</span
                        >
                    </div>
                </div>
            {/each}
            <p class="text-xs text-zam-textMuted">
                {t("linkPreview.pollVotes", {
                    count: tweet.poll.totalVotes,
                    votes: tweet.poll.totalVotes.toLocaleString(intlLocale()),
                })}
                {#if pollEnded}
                    · {t("linkPreview.pollFinal")}
                {:else if tweet.poll.endsAt}
                    · {t("linkPreview.pollEnds", {
                        date: compactDateTime(tweet.poll.endsAt),
                    })}
                {/if}
            </p>
        </div>
    {/if}

    {#if tweet.media.length > 0}
        <div
            class="grid gap-1 rounded overflow-hidden"
            style="grid-template-columns: repeat({Math.min(
                tweet.media.length,
                2,
            )}, minmax(0, 1fr))"
        >
            {#each tweet.media as item}
                <!-- width/height reserve the box before load (from the
                     FxTwitter media dims); w-full/h-auto keep it
                     responsive within the grid cell. -->
                {@const box = reservedMediaBox(
                    item.width,
                    item.height,
                    512,
                    512,
                )}
                {@const source = pickVideoSource(item)}
                {#if item.kind === "gif"}
                    <!-- Played like a GIF: muted, looped, no controls. Its
                         src is owned by gifTileVideo, which only gives it one
                         while it is near the viewport: a post can carry four
                         GIFs plus four in its quote, and holding a hardware
                         decoder for each corrupts frames (green/purple bands)
                         once the pool runs out. width/height keep the box. -->
                    <button
                        type="button"
                        class="block w-full min-w-0 p-0 border-0 bg-transparent cursor-pointer"
                        aria-label={item.alt || t("linkPreview.playVideo")}
                        onclick={() => (gifViewer = item)}
                    >
                        <!-- svelte-ignore a11y_media_has_caption -->
                        <video
                            use:gifTileVideo={item.url}
                            poster={item.thumbnail}
                            width={box?.width}
                            height={box?.height}
                            aria-label={item.alt}
                            class="w-full h-auto max-h-72 min-w-0 max-w-full object-contain rounded bg-black/10"
                            autoplay
                            muted
                            loop
                            playsinline
                            disablepictureinpicture
                            preload="metadata"
                        ></video>
                    </button>
                {:else if item.kind === "video" && !playing.has(item.url)}
                    <button
                        type="button"
                        aria-label={t("linkPreview.playVideo")}
                        class="group/media relative w-full max-h-72 min-w-0 rounded overflow-hidden cursor-pointer bg-black block p-0 border-0"
                        style={`aspect-ratio: ${box ? `${box.width}/${box.height}` : "16/9"}`}
                        onclick={() => {
                            playing = new Set(playing).add(item.url);
                        }}
                    >
                        {#if item.thumbnail}
                            <img
                                src={item.thumbnail}
                                alt=""
                                class="w-full h-full object-contain"
                                loading="lazy"
                                referrerpolicy="no-referrer"
                            />
                        {/if}
                        <div
                            class="absolute inset-0 flex items-center justify-center bg-black/30 group-hover/media:bg-black/40 transition-colors"
                        >
                            <div
                                class="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center"
                            >
                                <svg
                                    class="w-7 h-7 text-white ms-1"
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                    ><path d="M8 5v14l11-7z" /></svg
                                >
                            </div>
                        </div>
                    </button>
                {:else if item.kind === "video"}
                    <!-- svelte-ignore a11y_media_has_caption -->
                    <video
                        src={source.kind === "mp4" ? source.url : undefined}
                        use:hlsSource={source.kind === "hls"
                            ? source.url
                            : null}
                        poster={item.thumbnail}
                        width={box?.width}
                        height={box?.height}
                        class="w-full h-auto max-h-72 min-w-0 max-w-full object-contain rounded bg-black"
                        use:rememberVolume
                        controls
                        autoplay
                        playsinline
                        preload="auto"
                        use:pauseOffscreen={{
                            enabled: settingsState.pauseVideoOnScrollOff,
                        }}
                        use:parkOffscreen={(at) => {
                            resumeAt.set(item.url, at);
                            const next = new Set(playing);
                            next.delete(item.url);
                            playing = next;
                        }}
                        onloadedmetadata={(e) => {
                            const at = resumeAt.get(item.url);
                            if (at) {
                                e.currentTarget.currentTime = at;
                                resumeAt.delete(item.url);
                            }
                        }}
                    ></video>
                {:else}
                    <button
                        type="button"
                        class="block w-full min-w-0 p-0 border-0 bg-transparent cursor-pointer"
                        aria-label={item.alt}
                        onclick={() => {
                            lightboxIndex = photos.indexOf(item);
                        }}
                    >
                        <img
                            src={tweetPhotoThumb(item.url)}
                            alt={item.alt ?? ""}
                            title={item.alt}
                            width={box?.width}
                            height={box?.height}
                            class="w-full h-auto max-h-72 min-w-0 max-w-full object-contain rounded bg-black/10"
                            loading="lazy"
                            referrerpolicy="no-referrer"
                        />
                    </button>
                {/if}
            {/each}
        </div>
    {/if}

    {#if tweet.quote && isQuoteTombstone(tweet.quote)}
        <p
            class="rounded border border-zam-divider px-3 py-2 text-xs italic text-zam-textMuted"
        >
            {tweet.quote.tombstone || t("linkPreview.quoteUnavailable")}
        </p>
    {:else if tweet.quote}
        <TweetCard tweet={tweet.quote} nested />
    {/if}

    {#if tweet.communityNote}
        <div
            class="rounded border border-zam-divider bg-zam-backgroundTertiary px-3 py-2"
        >
            <p class="text-xs font-semibold text-zam-textPrimary mb-0.5">
                {t("linkPreview.communityNote")}
            </p>
            <p
                class="text-xs text-zam-textSecondary leading-relaxed whitespace-pre-wrap break-words"
            >
                {@render segments(tweet.communityNote)}
            </p>
        </div>
    {/if}

    <!-- Footer: counts, date, link to the post -->
    <a
        href={tweet.url}
        target="_blank"
        rel="noopener noreferrer"
        class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zam-textMuted no-underline hover:text-zam-textSecondary"
    >
        {#each stats as stat}
            <span
                class="inline-flex items-center gap-1 tabular-nums"
                title={stat.label(stat.n)}
            >
                <svg
                    class="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    {#if stat.icon === "reply"}
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M8 10h8M8 14h5m-9 6l2.5-3H18a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v14z"
                        />
                    {:else if stat.icon === "repost"}
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M7 7h11l-3-3m3 3l-3 3M17 17H6l3 3m-3-3l3-3"
                        />
                    {:else}
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M12 20s-7-4.35-7-10a4 4 0 017-2.65A4 4 0 0119 10c0 5.65-7 10-7 10z"
                        />
                    {/if}
                </svg>
                <span class="sr-only">{stat.label(stat.n)}</span>
                <span aria-hidden="true"
                    >{compactCount(stat.n, intlLocale())}</span
                >
            </span>
        {/each}
        {#if !nested}
            <span class="ms-auto flex items-center gap-1">
                {#if tweet.createdAt}
                    <span title={fullTimestamp(tweet.createdAt)}
                        >{messageTimestamp(tweet.createdAt)}</span
                    >
                    <span aria-hidden="true">·</span>
                {/if}
                <span>{t("linkPreview.xTwitter")}</span>
            </span>
        {:else if tweet.createdAt}
            <span class="ms-auto" title={fullTimestamp(tweet.createdAt)}
                >{messageTimestamp(tweet.createdAt)}</span
            >
        {/if}
    </a>
{/snippet}

{#if nested}
    <div
        class="flex flex-col gap-2 rounded border border-zam-divider p-2.5 min-w-0"
    >
        {@render body()}
    </div>
{:else}
    <div
        class="mt-2 flex max-w-lg rounded overflow-hidden border border-zam-divider bg-zam-backgroundSecondary"
    >
        <!-- Left accent bar -->
        <div class="w-1 flex-shrink-0 bg-zam-accent"></div>
        <div class="flex flex-1 min-w-0 flex-col p-3 gap-2">
            {@render body()}
        </div>
    </div>
{/if}

{#if gifViewer}
    <Lightbox
        src={gifViewer.url}
        kind="video"
        loop
        poster={gifViewer.thumbnail}
        alt={gifViewer.alt ?? ""}
        onClose={() => (gifViewer = null)}
    />
{/if}

{#if lightboxIndex !== null}
    {@const photo = photos[lightboxIndex]}
    {@const nav = galleryNav(photos.length, lightboxIndex)}
    {@const prev = nav.prevIndex}
    {@const next = nav.nextIndex}
    {#if photo}
        <!-- The grid's medium thumb (already loaded) stands in, in a box
             sized from the media dims, until the original arrives; the
             neighbours carry the same so a step or swipe lands on a sized,
             painted image instead of an empty 0x0 one. -->
        <Lightbox
            src={photo.url}
            alt={photo.alt ?? ""}
            placeholders={viewerItem(photo).placeholders}
            dims={viewerItem(photo).dims}
            onClose={() => (lightboxIndex = null)}
            onPrev={prev !== null ? () => (lightboxIndex = prev) : undefined}
            onNext={next !== null ? () => (lightboxIndex = next) : undefined}
            neighbours={{
                prev: prev !== null ? viewerItem(photos[prev]) : null,
                next: next !== null ? viewerItem(photos[next]) : null,
            }}
            position={galleryPositionLabel(photos.length, lightboxIndex)}
        />
    {/if}
{/if}
