<script lang="ts">
    import { getUrlPreview, type UrlPreview } from "$lib/matrix/client";
    import Lightbox from "$lib/components/ui/Lightbox.svelte";
    import {
        favouritesState,
        isFavouriteGif,
        addFavouriteGif,
        removeFavouriteGif,
    } from "$lib/stores/favourites.svelte";

    interface Props {
        url: string;
    }

    let { url }: Props = $props();

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

    interface TweetEmbed {
        authorName: string;
        authorHandle: string;
        text: string;
        photos: string[];
        videos: string[];
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
        preview = null;
        imageError = false;
        directEmbed = null;
        tweetEmbed = null;
        videoPlaying = false;
        videoThumbError = false;

        const ytUrl = getYoutubeEmbedUrl(currentUrl);
        if (ytUrl) {
            directEmbed = { type: "youtube", embedUrl: ytUrl };
            return;
        }

        // Twitter/X: use fxtwitter JSON API (has CORS headers)
        const twitterApiUrl = getTwitterApiUrl(currentUrl);
        if (twitterApiUrl) {
            fetch(twitterApiUrl, { headers: { Accept: "application/json" } })
                .then((r) => r.json())
                .then((data: any) => {
                    const tweet = data?.tweet;
                    if (!tweet) return;
                    tweetEmbed = {
                        authorName: tweet.author?.name ?? "",
                        authorHandle: tweet.author?.screen_name ?? "",
                        text: tweet.text ?? "",
                        photos: (tweet.media?.photos ?? []).map(
                            (p: any) => p.url as string,
                        ),
                        videos: (tweet.media?.videos ?? []).map(
                            (v: any) => v.url as string,
                        ),
                    };
                });
            return;
        }

        getUrlPreview(currentUrl).then((data) => {
            if (data && (data.title || data.imageUrl || data.videoUrl)) {
                preview = data;
            }
        });
    });

    // Whether the preview carries page metadata (title/description/site name) as
    // opposed to being a raw image or video with none.
    const hasMeta = $derived(
        !!(preview?.title || preview?.description || preview?.siteName),
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
</script>

{#if directEmbed?.type === "youtube"}
    <iframe
        src={directEmbed.embedUrl}
        class="mt-1 w-full max-w-sm aspect-video rounded-lg"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
        loading="lazy"
        title="YouTube video"
    ></iframe>
{:else if directEmbed?.type === "video"}
    <!-- svelte-ignore a11y_media_has_caption -->
    <video
        src={directEmbed.videoUrl}
        class="max-w-sm max-h-72 rounded-lg mt-1 block"
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
                            url: v,
                        })),
                        ...tweetEmbed.photos.map((p) => ({
                            type: "photo" as const,
                            url: p,
                        })),
                    ]}
                    <div
                        class="grid gap-1 rounded overflow-hidden"
                        style="grid-template-columns: repeat({Math.min(
                            allMedia.length,
                            2,
                        )}, 1fr)"
                    >
                        {#each allMedia as item, i}
                            {#if item.type === "video"}
                                <!-- svelte-ignore a11y_media_has_caption -->
                                <video
                                    src={item.url}
                                    class="w-full max-h-72 object-contain rounded"
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
                                    class="w-full max-h-72 object-contain rounded cursor-pointer bg-black/10"
                                    loading="lazy"
                                    onclick={(e) => {
                                        e.preventDefault();
                                        lightboxTweetIndex = i;
                                    }}
                                />
                            {/if}
                        {/each}
                    </div>
                {/if}
            </div>
        </a>
        {#if lightboxTweetIndex !== null}
            {@const allMedia = [
                ...tweetEmbed.videos.map((v) => ({
                    type: "video" as const,
                    url: v,
                })),
                ...tweetEmbed.photos.map((p) => ({
                    type: "photo" as const,
                    url: p,
                })),
            ]}
            {@const item = allMedia[lightboxTweetIndex]}
            {#if item?.type === "photo"}
                <Lightbox
                    src={item.url}
                    alt=""
                    onClose={() => (lightboxTweetIndex = null)}
                />
            {/if}
        {/if}
    </div>
{:else if preview}
    {#if isGifSite && preview.videoUrl}
        <!-- GIF-sharing sites: bare inline gif-style video -->
        {@render videoMedia()}
    {:else if preview.videoUrl && hasMeta}
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
    {:else if preview.videoUrl}
        <!-- Direct video embed (no page metadata) -->
        {@render videoMedia()}
    {:else if preview.imageUrl && !imageError && (!hasMeta || isGifSite)}
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
                <img
                    src={preview.imageUrl}
                    alt=""
                    class="max-w-sm max-h-72 rounded-lg object-contain cursor-pointer block"
                    loading="lazy"
                    onerror={() => (imageError = true)}
                />
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
                    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                    {#if preview.imageUrl && !imageError}
                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                        <img
                            src={preview.imageUrl}
                            alt={preview.title ?? ""}
                            onerror={() => (imageError = true)}
                            class="max-w-full max-h-72 rounded mt-1 object-contain cursor-pointer"
                            loading="lazy"
                            onclick={(e) => {
                                e.preventDefault();
                                lightboxOpen = true;
                            }}
                        />
                    {/if}
                </div>
            </a>
            {#if lightboxOpen && preview.imageUrl}
                <Lightbox
                    src={preview.imageUrl}
                    alt=""
                    onClose={() => (lightboxOpen = false)}
                />
            {/if}
        </div>
    {/if}
{/if}

{#snippet videoMedia()}
    {#if preview?.videoUrl}
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
                    poster={preview.videoThumbnailUrl}
                    class="max-w-sm max-h-72 rounded-lg block pointer-events-none"
                    autoplay
                    muted
                    loop
                    playsinline
                    disablepictureinpicture
                    preload="metadata"
                ></video>
            {:else if videoPlaying || !preview.videoThumbnailUrl || videoThumbError}
                <!-- No usable thumbnail (or the user clicked play): show the video
                     itself rather than a placeholder card. -->
                <!-- svelte-ignore a11y_media_has_caption -->
                <video
                    src={preview.videoUrl}
                    poster={preview.videoThumbnailUrl}
                    class="max-w-sm max-h-72 rounded-lg block"
                    controls
                    autoplay={videoPlaying}
                    preload={videoPlaying ? "auto" : "metadata"}
                ></video>
            {:else}
                <button
                    type="button"
                    aria-label="Play video"
                    class="relative max-w-sm w-full max-h-72 rounded-lg overflow-hidden cursor-pointer bg-black block p-0 border-0"
                    style={`aspect-ratio: ${preview.videoWidth && preview.videoHeight ? `${preview.videoWidth}/${preview.videoHeight}` : "16/9"}; max-height: 18rem;`}
                    onclick={() => (videoPlaying = true)}
                >
                    <img
                        src={preview.videoThumbnailUrl}
                        alt=""
                        class="w-full h-full object-cover"
                        loading="lazy"
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
