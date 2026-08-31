<script lang="ts">
    import {
        getUrlPreview,
        getHomeserverBaseUrl,
        type UrlPreview,
    } from "$lib/matrix/client";
    import Lightbox from "$lib/components/ui/Lightbox.svelte";
    import {
        favouritesState,
        isFavouriteGif,
        addFavouriteGif,
        removeFavouriteGif,
    } from "$lib/stores/favourites.svelte";
    import { settingsState } from "$lib/stores/settings.svelte";
    import { pauseOffscreen } from "$lib/actions/pauseOffscreen";
    import {
        allowsMediaAutoLoad,
        allowsThirdPartyEmbed,
    } from "$lib/utils/linkPreviewPolicy";
    import { reservedMediaBox } from "$lib/utils/mediaDimensions";
    import { galleryNav } from "$lib/utils/mediaGallery";
    import { isInstagramUrl } from "$lib/utils/instagramUrl";
    import { pluginRegistry } from "$lib/stores/plugins.svelte";
    import { resolveEmbed, mountEmbed } from "$lib/plugins/embeds";

    interface Props {
        url: string;
    }

    let { url }: Props = $props();

    // The homeserver we would proxy media through. Read once: the app hard-
    // reloads on account switch, so this cannot go stale under us.
    const hsBaseUrl = getHomeserverBaseUrl();

    // "Load media" is remembered against the URL it was pressed for, NOT as a
    // bare boolean reset from an $effect: an effect that both reads the policy
    // and resets the flag would either loop or race the fetching effect, and a
    // lost race means the third-party request we are trying to prevent fires
    // anyway. Deriving it makes a URL change reset the reveal with no effect
    // at all.
    let revealedFor = $state<string | null>(null);
    const revealed = $derived(revealedFor === url);
    const policy = $derived(
        revealed ? ("all" as const) : settingsState.linkPreviewMedia,
    );
    const embedsAllowed = $derived(allowsThirdPartyEmbed(policy));

    // A plugin-registered custom embed for THIS url, if any. ADDITIVE: null → the
    // normal preview chain runs unchanged; the inbound message body/link is
    // rendered in MessageItem and never touched here (interop, spec §2). Reads the
    // registry tick so enabling/disabling an embed plugin re-derives live.
    const matchedEmbed = $derived.by(() => {
        void pluginRegistry.tick;
        return resolveEmbed(pluginRegistry.embeds, url);
    });

    function canLoad(mediaUrl: string | null | undefined): boolean {
        return allowsMediaAutoLoad(policy, mediaUrl, hsBaseUrl);
    }

    let preview = $state<UrlPreview | null>(null);
    let imageError = $state(false);
    let lightboxOpen = $state(false);
    // Video previews load the poster first; the <video> is only mounted once
    // the user clicks play (mirrors uploaded m.video behaviour).
    let videoPlaying = $state(false);
    let videoThumbError = $state(false);

    type DirectEmbed =
        | { type: "youtube"; embedUrl: string }
        | { type: "video"; videoUrl: string };

    let directEmbed = $state<DirectEmbed | null>(null);

    interface TweetMedia {
        url: string;
        width?: number;
        height?: number;
    }
    interface TweetEmbed {
        authorName: string;
        authorHandle: string;
        text: string;
        photos: TweetMedia[];
        videos: TweetMedia[];
    }

    let tweetEmbed = $state<TweetEmbed | null>(null);
    let lightboxTweetIndex = $state<number | null>(null);

    // Reactively track favourite state — isFavouriteGif reads favouritesState.gifs ($state) so this auto-tracks
    const favourited = $derived(isFavouriteGif(url));

    function toggleFavourite(e: MouseEvent) {
        e.stopPropagation();
        if (isFavouriteGif(url)) {
            removeFavouriteGif(url);
        } else {
            const previewUrl = preview?.imageUrl ?? preview?.videoThumbnailUrl;
            if (previewUrl) addFavouriteGif({ url, previewUrl });
        }
    }

    function getYoutubeEmbedUrl(rawUrl: string): string | null {
        try {
            const u = new URL(rawUrl);
            const h = u.hostname.replace(/^www\./, "");
            if (h === "youtube.com" || h === "m.youtube.com") {
                const id = u.searchParams.get("v");
                if (id) return `https://www.youtube.com/embed/${id}`;
            }
            if (h === "youtu.be") {
                const id = u.pathname.slice(1).split("?")[0];
                if (id) return `https://www.youtube.com/embed/${id}`;
            }
        } catch {
            /* */
        }
        return null;
    }

    function getTwitterApiUrl(rawUrl: string): string | null {
        try {
            const u = new URL(rawUrl);
            const h = u.hostname.replace(/^www\./, "");
            if (h !== "x.com" && h !== "twitter.com") return null;
            // Path: /{user}/status/{id}
            const m = u.pathname.match(/^\/([^/]+)\/status\/(\d+)/);
            if (!m) return null;
            return `https://api.fxtwitter.com/${m[1]}/status/${m[2]}`;
        } catch {
            /* */
        }
        return null;
    }

    $effect(() => {
        const currentUrl = url;
        const allowEmbeds = embedsAllowed;
        preview = null;
        imageError = false;
        directEmbed = null;
        tweetEmbed = null;
        lightboxTweetIndex = null;
        videoPlaying = false;
        videoThumbError = false;

        // A response that lands after the URL or the policy moved on must not
        // write itself back into state — otherwise flipping the setting to a
        // stricter value could be undone by the request it just cancelled.
        let cancelled = false;

        const ytUrl = allowEmbeds ? getYoutubeEmbedUrl(currentUrl) : null;
        if (ytUrl) {
            directEmbed = { type: "youtube", embedUrl: ytUrl };
            return;
        }

        // Twitter/X: use fxtwitter JSON API (has CORS headers). This is a
        // request straight to a third party, so it needs the same consent as
        // the media itself.
        const twitterApiUrl = allowEmbeds ? getTwitterApiUrl(currentUrl) : null;
        if (twitterApiUrl) {
            fetch(twitterApiUrl, {
                headers: { Accept: "application/json" },
                referrerPolicy: "no-referrer",
            })
                .then((r) => r.json())
                .then((data: any) => {
                    if (cancelled) return;
                    const tweet = data?.tweet;
                    if (!tweet) return;
                    tweetEmbed = {
                        authorName: tweet.author?.name ?? "",
                        authorHandle: tweet.author?.screen_name ?? "",
                        text: tweet.text ?? "",
                        // fxtwitter media objects carry width/height — keep them
                        // so the grid can reserve layout space before the image
                        // loads (otherwise it pops in and shoves the timeline).
                        photos: (tweet.media?.photos ?? []).map((p: any) => ({
                            url: p.url as string,
                            width: p.width as number | undefined,
                            height: p.height as number | undefined,
                        })),
                        videos: (tweet.media?.videos ?? []).map((v: any) => ({
                            url: v.url as string,
                            width: v.width as number | undefined,
                            height: v.height as number | undefined,
                        })),
                    };
                })
                .catch((err) => {
                    if (cancelled) return;
                    console.error("Twitter preview fetch failed:", err);
                });
            return () => {
                cancelled = true;
            };
        }

        // The homeserver's own preview endpoint — no third party is contacted,
        // so this runs under every policy. Only its MEDIA is gated, below.
        getUrlPreview(currentUrl)
            .then((data) => {
                if (cancelled) return;
                if (data && (data.title || data.imageUrl || data.videoUrl)) {
                    preview = data;
                }
            })
            .catch((err) => {
                if (cancelled) return;
                console.error("URL preview fetch failed:", err);
            });

        return () => {
            cancelled = true;
        };
    });

    // Whether the preview carries page metadata (title/description/site name) as
    // opposed to being a raw image or video with none.
    const hasMeta = $derived(
        !!(preview?.title || preview?.description || preview?.siteName),
    );

    // Reserved display box (px) for preview images, from og:image:width/height
    // when the site supplies them. Rendered as the <img> width/height so the
    // browser holds the space before load and the image can't shove the timeline
    // on scroll. Null when dimensions are absent → markup keeps its CSS bounds.
    // Direct embed matches uploaded-image bounds (512×384); the card thumbnail
    // uses the narrower card column (max-w-full / max-h-72 ≈ 480×288).
    const embedImageBox = $derived(
        reservedMediaBox(preview?.imageWidth, preview?.imageHeight, 512, 384),
    );
    const cardImageBox = $derived(
        reservedMediaBox(preview?.imageWidth, preview?.imageHeight, 480, 288),
    );

    // GIF-sharing sites (Tenor/Giphy/Klipy) have page metadata but should embed
    // inline. Their previews expose the animation as a *video* URL, which we play
    // back gif-style (muted, looped, no controls) so it behaves like a real GIF.
    const isGifSite = $derived.by(() => {
        try {
            // Match on the registrable domain's second-level label so that
            // e.g. `media.tenor.com` counts but `tenor.com.evil.example` does not.
            const labels = new URL(url).hostname.split(".");
            const sld = labels[labels.length - 2];
            return sld === "tenor" || sld === "giphy" || sld === "klipy";
        } catch {
            return false;
        }
    });

    const isInstagram = $derived(isInstagramUrl(url));

    // A direct embed we declined to mount (YouTube/X) — known without fetching
    // anything, so the button can appear immediately.
    const blockedEmbed = $derived(
        !embedsAllowed &&
            (getYoutubeEmbedUrl(url) !== null ||
                getTwitterApiUrl(url) !== null),
    );
    // Preview media the policy suppressed. `preview` is homeserver-sourced, so
    // reading it here costs nothing.
    const blockedMedia = $derived(
        !!preview &&
            ((!!preview.videoUrl && !canLoad(preview.videoUrl)) ||
                (!!preview.imageUrl && !canLoad(preview.imageUrl))),
    );
    const showReveal = $derived(!revealed && (blockedEmbed || blockedMedia));
</script>

{#if directEmbed?.type === "youtube"}
    <iframe
        src={directEmbed.embedUrl}
        class="mt-1 w-full max-w-lg aspect-video rounded-lg"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
        loading="lazy"
        title="YouTube video"
    ></iframe>
{:else if directEmbed?.type === "video"}
    <!-- svelte-ignore a11y_media_has_caption -->
    <video
        src={directEmbed.videoUrl}
        class="max-w-[min(100%,32rem)] max-h-96 rounded-lg mt-1 block"
        controls
        preload="metadata"
    ></video>
{:else if tweetEmbed}
    <!-- Twitter/X card built from fxtwitter API -->
    <div class="mt-2">
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            class="flex max-w-lg rounded overflow-hidden border border-discord-divider bg-discord-backgroundSecondary hover:bg-discord-messageHover transition-colors no-underline"
        >
            <!-- Left accent bar -->
            <div class="w-1 flex-shrink-0 bg-discord-accent"></div>

            <div class="flex flex-1 min-w-0 flex-col p-3 gap-2">
                <!-- Author -->
                <div class="flex flex-col min-w-0">
                    <p class="text-xs text-discord-textMuted mb-0.5">
                        X / Twitter
                    </p>
                    <p
                        class="text-sm font-semibold text-discord-accent leading-snug"
                    >
                        {tweetEmbed.authorName}
                        <span class="font-normal text-discord-textMuted"
                            >@{tweetEmbed.authorHandle}</span
                        >
                    </p>
                    {#if tweetEmbed.text}
                        <p
                            class="text-xs text-discord-textSecondary mt-1 leading-relaxed line-clamp-4 whitespace-pre-wrap"
                        >
                            {tweetEmbed.text}
                        </p>
                    {/if}
                </div>

                <!-- Media grid -->
                {#if tweetEmbed.videos.length > 0 || tweetEmbed.photos.length > 0}
                    {@const allMedia = [
                        ...tweetEmbed.videos.map((v) => ({
                            type: "video" as const,
                            photoIndex: -1,
                            ...v,
                        })),
                        ...tweetEmbed.photos.map((p, pi) => ({
                            type: "photo" as const,
                            photoIndex: pi,
                            ...p,
                        })),
                    ]}
                    <div
                        class="grid gap-1 rounded overflow-hidden"
                        style="grid-template-columns: repeat({Math.min(
                            allMedia.length,
                            2,
                        )}, minmax(0, 1fr))"
                    >
                        {#each allMedia as item}
                            <!-- width/height reserve the box before load (from the
                                 fxtwitter media dims); w-full/h-auto keep it
                                 responsive within the grid cell. -->
                            {@const box = reservedMediaBox(
                                item.width,
                                item.height,
                                512,
                                512,
                            )}
                            {#if item.type === "video"}
                                <!-- svelte-ignore a11y_media_has_caption -->
                                <video
                                    src={item.url}
                                    width={box?.width}
                                    height={box?.height}
                                    class="w-full h-auto max-h-72 min-w-0 max-w-full object-contain rounded"
                                    controls
                                    preload="metadata"
                                    onclick={(e) => e.preventDefault()}
                                ></video>
                            {:else}
                                <!-- svelte-ignore a11y_click_events_have_key_events -->
                                <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                                <img
                                    src={item.url}
                                    alt=""
                                    width={box?.width}
                                    height={box?.height}
                                    class="w-full h-auto max-h-72 min-w-0 max-w-full object-contain rounded cursor-pointer bg-black/10"
                                    loading="lazy"
                                    referrerpolicy="no-referrer"
                                    onclick={(e) => {
                                        e.preventDefault();
                                        lightboxTweetIndex = item.photoIndex;
                                    }}
                                />
                            {/if}
                        {/each}
                    </div>
                {/if}
            </div>
        </a>
        {#if lightboxTweetIndex !== null}
            {@const photo = tweetEmbed.photos[lightboxTweetIndex]}
            {@const nav = galleryNav(
                tweetEmbed.photos.length,
                lightboxTweetIndex,
            )}
            {@const prev = nav.prevIndex}
            {@const next = nav.nextIndex}
            {#if photo}
                <Lightbox
                    src={photo.url}
                    alt=""
                    onClose={() => (lightboxTweetIndex = null)}
                    onPrev={prev !== null
                        ? () => (lightboxTweetIndex = prev)
                        : undefined}
                    onNext={next !== null
                        ? () => (lightboxTweetIndex = next)
                        : undefined}
                />
            {/if}
        {/if}
    </div>
{:else if matchedEmbed}
    <!-- Plugin custom embed: renders a nicer card for a matching URL. ADDITIVE
         and host-sanitized — see src/lib/plugins/embeds.ts. Keyed so a change
         of matched embed (plugin toggled/reordered) or url forces a re-mount. -->
    {#key `${matchedEmbed.entryId}:${url}`}
        <div
            class="mt-1"
            use:mountEmbed={{ embed: matchedEmbed.value, url }}
        ></div>
    {/key}
{:else if preview}
    {#if isGifSite && preview.videoUrl && canLoad(preview.videoUrl)}
        <!-- GIF-sharing sites: bare inline gif-style video -->
        {@render videoMedia()}
    {:else if preview.videoUrl && hasMeta && canLoad(preview.videoUrl)}
        <!-- Rich video card: title/description alongside an embedded player
             (e.g. an fxtwitter/fixvx preview that carries og:video + og:title). -->
        <div class="mt-2">
            <div
                class="flex max-w-lg rounded overflow-hidden border border-discord-divider bg-discord-backgroundSecondary"
            >
                <!-- Left accent bar -->
                <div class="w-1 flex-shrink-0 bg-discord-accent"></div>
                <div class="flex flex-1 min-w-0 flex-col p-3 gap-2">
                    {#if preview.siteName}
                        <p class="text-xs text-discord-textMuted truncate">
                            {preview.siteName}
                        </p>
                    {/if}
                    {#if preview.title}
                        <a
                            href={preview.canonicalUrl || url}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="text-sm font-semibold text-discord-accent leading-snug line-clamp-2 no-underline hover:underline"
                        >
                            {preview.title}
                        </a>
                    {/if}
                    {#if preview.description}
                        <p
                            class="text-xs text-discord-textSecondary leading-relaxed line-clamp-4 whitespace-pre-wrap"
                        >
                            {preview.description}
                        </p>
                    {/if}
                    {@render videoMedia()}
                </div>
            </div>
        </div>
    {:else if preview.videoUrl && canLoad(preview.videoUrl)}
        <!-- Direct video embed (no page metadata) -->
        {@render videoMedia()}
    {:else if preview.imageUrl && !imageError && canLoad(preview.imageUrl) && (!hasMeta || isGifSite)}
        <!-- Direct image embed — same style as uploaded images -->
        <div class="relative inline-block group/media mt-1">
            <a
                href={preview.imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                onclick={(e) => {
                    e.preventDefault();
                    lightboxOpen = true;
                }}
            >
                {#if embedImageBox}
                    <img
                        src={preview.imageUrl}
                        alt=""
                        width={embedImageBox.width}
                        height={embedImageBox.height}
                        class="max-w-full h-auto rounded-lg object-contain cursor-pointer block"
                        loading="lazy"
                        referrerpolicy="no-referrer"
                        onerror={() => (imageError = true)}
                    />
                {:else}
                    <img
                        src={preview.imageUrl}
                        alt=""
                        class="max-w-[min(100%,32rem)] max-h-96 rounded-lg object-contain cursor-pointer block"
                        loading="lazy"
                        referrerpolicy="no-referrer"
                        onerror={() => (imageError = true)}
                    />
                {/if}
            </a>
            <button
                onclick={toggleFavourite}
                title={favourited
                    ? "Remove from favourites"
                    : "Add to favourites"}
                class="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover/media:opacity-100 transition-opacity hover:bg-black/70"
            >
                {#if favourited}
                    <svg
                        class="w-4 h-4 text-discord-warning"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                        />
                    </svg>
                {:else}
                    <svg
                        class="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                        />
                    </svg>
                {/if}
            </button>
        </div>
        {#if lightboxOpen}
            <Lightbox
                src={preview.imageUrl}
                alt=""
                favourite={{ url, previewUrl: preview.imageUrl }}
                onClose={() => (lightboxOpen = false)}
            />
        {/if}
    {:else if hasMeta}
        <!-- Regular link preview card -->
        <div class="mt-2">
            <a
                href={preview.canonicalUrl || url}
                target="_blank"
                rel="noopener noreferrer"
                class="flex max-w-lg rounded overflow-hidden border border-discord-divider bg-discord-backgroundSecondary hover:bg-discord-messageHover transition-colors no-underline"
            >
                <!-- Left accent bar -->
                <div class="w-1 flex-shrink-0 bg-discord-accent"></div>

                <div class="flex flex-1 min-w-0 flex-col p-3 gap-3">
                    <!-- Text content -->
                    <div class="flex-1 min-w-0">
                        {#if preview.siteName}
                            <p
                                class="text-xs text-discord-textMuted mb-0.5 truncate"
                            >
                                {preview.siteName}
                            </p>
                        {/if}
                        {#if preview.title}
                            <p
                                class="text-sm font-semibold text-discord-accent leading-snug line-clamp-2"
                            >
                                {preview.title}
                            </p>
                        {/if}
                        {#if preview.description}
                            <p
                                class="text-xs text-discord-textSecondary mt-1 leading-relaxed line-clamp-3"
                            >
                                {preview.description}
                            </p>
                        {/if}
                    </div>

                    <!-- Preview image -->
                    {#if preview.imageUrl && !imageError && canLoad(preview.imageUrl)}
                        {#if isInstagram}
                            <!-- w-fit + self-start so the wrapper shrink-wraps
                                 the reserved-width thumbnail instead of stretching
                                 to the flex column's full width; otherwise the
                                 absolute play overlay would centre over empty card
                                 space beside a narrow (portrait reel) poster. -->
                            <div class="relative w-fit self-start">
                                <img
                                    src={preview.imageUrl}
                                    alt={preview.title ?? ""}
                                    width={cardImageBox?.width}
                                    height={cardImageBox?.height}
                                    onerror={() => (imageError = true)}
                                    class="max-w-full h-auto max-h-72 rounded mt-1 object-contain cursor-pointer"
                                    loading="lazy"
                                    referrerpolicy="no-referrer"
                                />
                                <div
                                    class="absolute inset-0 flex items-center justify-center pointer-events-none"
                                >
                                    <div
                                        class="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center"
                                    >
                                        <svg
                                            class="w-5 h-5 text-white ml-0.5"
                                            fill="currentColor"
                                            viewBox="0 0 24 24"
                                            ><path d="M8 5v14l11-7z" /></svg
                                        >
                                    </div>
                                </div>
                            </div>
                        {:else}
                            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                            <!-- svelte-ignore a11y_click_events_have_key_events -->
                            <img
                                src={preview.imageUrl}
                                alt={preview.title ?? ""}
                                width={cardImageBox?.width}
                                height={cardImageBox?.height}
                                onerror={() => (imageError = true)}
                                class="max-w-full h-auto max-h-72 rounded mt-1 object-contain cursor-pointer"
                                loading="lazy"
                                referrerpolicy="no-referrer"
                                onclick={(e) => {
                                    e.preventDefault();
                                    lightboxOpen = true;
                                }}
                            />
                        {/if}
                    {/if}
                </div>
            </a>
            {#if lightboxOpen && preview.imageUrl && canLoad(preview.imageUrl)}
                <Lightbox
                    src={preview.imageUrl}
                    alt=""
                    onClose={() => (lightboxOpen = false)}
                />
            {/if}
        </div>
    {/if}
{/if}

{#if showReveal}
    <button
        type="button"
        onclick={() => (revealedFor = url)}
        class="mt-1 inline-flex items-center gap-1.5 rounded border border-discord-divider bg-discord-backgroundSecondary px-2 py-1 text-xs text-discord-textSecondary transition-colors hover:text-discord-textPrimary hover:border-discord-accent/50"
        title="Loading it contacts the site hosting it, which reveals your IP address"
    >
        <svg
            class="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
            aria-hidden="true"
        >
            <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M2.036 12.322a1 1 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178a1 1 0 010 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
            />
            <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
        </svg>
        Load preview media
    </button>
{/if}

{#snippet videoMedia()}
    {#if preview?.videoUrl && canLoad(preview.videoUrl)}
        {@const posterUrl = canLoad(preview.videoThumbnailUrl)
            ? preview.videoThumbnailUrl
            : undefined}
        <div class="relative inline-block group/media mt-1">
            {#if isGifSite}
                <!-- GIF-sharing sites: play the video like a GIF — muted, looped,
                     autoplaying, and with no controls so it can't be paused/seeked.
                     `pointer-events-none` + no controls already make it unpausable
                     by the user, so we do NOT re-play on pause: the only thing that
                     pauses this element is the browser shedding load, and answering
                     that with play() is an unterminating main-thread ping-pong. -->
                <!-- svelte-ignore a11y_media_has_caption -->
                <video
                    src={preview.videoUrl}
                    poster={posterUrl}
                    class="max-w-[min(100%,32rem)] max-h-96 rounded-lg block pointer-events-none"
                    autoplay
                    muted
                    loop
                    playsinline
                    disablepictureinpicture
                    preload="metadata"
                ></video>
            {:else if videoPlaying || !posterUrl || videoThumbError}
                <!-- No usable thumbnail (or the user clicked play): show the video
                     itself rather than a placeholder card. -->
                <!-- svelte-ignore a11y_media_has_caption -->
                <video
                    src={preview.videoUrl}
                    poster={posterUrl}
                    class="max-w-lg w-full max-h-96 rounded-lg block"
                    style={`aspect-ratio: ${preview.videoWidth && preview.videoHeight ? `${preview.videoWidth}/${preview.videoHeight}` : "16/9"}; max-height: 24rem;`}
                    controls
                    autoplay={videoPlaying}
                    preload={videoPlaying ? "auto" : "metadata"}
                    use:pauseOffscreen={{
                        enabled: settingsState.pauseVideoOnScrollOff,
                    }}
                ></video>
            {:else}
                <button
                    type="button"
                    aria-label="Play video"
                    class="relative max-w-lg w-full max-h-96 rounded-lg overflow-hidden cursor-pointer bg-black block p-0 border-0"
                    style={`aspect-ratio: ${preview.videoWidth && preview.videoHeight ? `${preview.videoWidth}/${preview.videoHeight}` : "16/9"}; max-height: 24rem;`}
                    onclick={() => (videoPlaying = true)}
                >
                    <img
                        src={posterUrl}
                        alt=""
                        class="w-full h-full object-cover"
                        loading="lazy"
                        referrerpolicy="no-referrer"
                        onerror={() => (videoThumbError = true)}
                    />
                    <div
                        class="absolute inset-0 flex items-center justify-center bg-black/30 group-hover/media:bg-black/40 transition-colors"
                    >
                        <div
                            class="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center"
                        >
                            <svg
                                class="w-7 h-7 text-white ml-1"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                                ><path d="M8 5v14l11-7z" /></svg
                            >
                        </div>
                    </div>
                </button>
            {/if}
            <button
                onclick={toggleFavourite}
                title={favourited
                    ? "Remove from favourites"
                    : "Add to favourites"}
                class="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover/media:opacity-100 transition-opacity hover:bg-black/70"
            >
                {#if favourited}
                    <svg
                        class="w-4 h-4 text-discord-warning"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                        />
                    </svg>
                {:else}
                    <svg
                        class="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                        />
                    </svg>
                {/if}
            </button>
        </div>
    {/if}
{/snippet}
