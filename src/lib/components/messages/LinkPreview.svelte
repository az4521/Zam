<script lang="ts" module>
    // What each link resolved to this session. The timeline unmounts rows
    // away from the viewport (utils/timelineWindow); a row mounted again
    // shows its preview at once from here instead of growing from nothing
    // when a fresh request comes back, which shoved the timeline on scroll.
    type Resolved = {
        preview: import("$lib/matrix/client").UrlPreview | null;
        tweet: unknown;
        gifHostHeld: boolean;
    };
    const RESOLVED_MAX = 2000;
    const resolvedPreviews = new Map<string, Resolved>();
    function rememberPreview(key: string, r: Resolved) {
        resolvedPreviews.delete(key);
        if (resolvedPreviews.size >= RESOLVED_MAX) {
            resolvedPreviews.delete(resolvedPreviews.keys().next().value!);
        }
        resolvedPreviews.set(key, r);
    }
</script>

<script lang="ts">
    import { t } from "$lib/i18n";
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
    import {
        isAuthedMediaUrl,
        thumbnailUrl,
        videoFrameUrl,
        holdMediaUrl,
    } from "$lib/stores/mediaAuth.svelte";
    import { pauseOffscreen } from "$lib/actions/pauseOffscreen";
    import { rememberVolume } from "$lib/actions/rememberVolume";
    import { unloadOffscreen } from "$lib/actions/unloadOffscreen";
    import { parkOffscreen } from "$lib/actions/parkOffscreen";
    import { parkYoutubeOffscreen } from "$lib/actions/parkYoutubeOffscreen";
    import {
        allowsMediaAutoLoad,
        allowsThirdPartyEmbed,
    } from "$lib/utils/linkPreviewPolicy";
    import {
        fetchGifEmbed,
        isGifHostLink,
        isGifHostMediaUrl,
    } from "$lib/utils/gifEmbed";
    import { reservedMediaBox } from "$lib/utils/mediaDimensions";
    import {
        learnImageSize,
        learnedMediaSize,
        learnMediaSize,
    } from "$lib/utils/learnedMediaSize";
    import { galleryNav, galleryPositionLabel } from "$lib/utils/mediaGallery";
    import { isInstagramUrl } from "$lib/utils/instagramUrl";
    import { linkPreviewFavourite } from "$lib/utils/linkPreviewFavourite";
    import { pluginRegistry } from "$lib/stores/plugins.svelte";
    import { resolveEmbed, mountEmbed } from "$lib/plugins/embeds";
    import { applyPreviewUrlTransforms } from "$lib/plugins/outgoingTransforms";

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
        return (
            allowsMediaAutoLoad(policy, mediaUrl, hsBaseUrl) ||
            (embedsAllowed && isGifHostMediaUrl(mediaUrl))
        );
    }

    let preview = $state<UrlPreview | null>(null);
    // A request for this link is in flight: a placeholder the shape the
    // preview most likely takes holds its space meanwhile.
    let pending = $state(true);
    // A GIF-site link the homeserver couldn't preview, held back by the policy.
    let gifHostHeld = $state(false);
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

    // A YouTube embed shows its thumbnail until played: each player is a
    // whole YouTube page in its own frame (tens of MB before it plays, plus a
    // decoder after), and the timeline never unmounts rows. Once played and
    // then paused and scrolled well away it goes back to the thumbnail
    // (actions/parkYoutubeOffscreen) and resumes from where it was.
    let youtubePlaying = $state(false);
    let youtubeResumeAt = 0;
    function youtubePlayerUrl(embedUrl: string): string {
        const u = new URL(embedUrl);
        u.searchParams.set("autoplay", "1");
        u.searchParams.set("enablejsapi", "1");
        if (/^https?:$/.test(location.protocol))
            u.searchParams.set("origin", location.origin);
        if (youtubeResumeAt > 0)
            u.searchParams.set("start", String(Math.floor(youtubeResumeAt)));
        return u.toString();
    }
    function youtubeThumbnail(embedUrl: string): string {
        const id = new URL(embedUrl).pathname.split("/").pop() ?? "";
        return `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
    }

    interface TweetMedia {
        url: string;
        width?: number;
        height?: number;
        thumbnail?: string;
    }

    // Tweet videos, by URL, that the user has played. The rest show their
    // thumbnail: a mounted <video>, even unplayed, holds a decoder. A played
    // one that is paused and scrolled well away is unmounted again and
    // resumes from `tweetResumeAt` (actions/parkOffscreen).
    let tweetPlaying = $state<Set<string>>(new Set());
    const tweetResumeAt = new Map<string, number>();
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
            const entry = linkPreviewFavourite(url, preview, {
                gifSite: isGifSite,
            });
            if (entry) addFavouriteGif(entry);
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
        pending = true;
        gifHostHeld = false;
        imageError = false;
        directEmbed = null;
        tweetEmbed = null;
        lightboxTweetIndex = null;
        videoPlaying = false;
        videoParked = false;
        videoThumbError = false;
        youtubePlaying = false;
        youtubeResumeAt = 0;
        tweetPlaying = new Set();
        tweetResumeAt.clear();

        // A response that lands after the URL or the policy moved on must not
        // write itself back into state — otherwise flipping the setting to a
        // stricter value could be undone by the request it just cancelled.
        let cancelled = false;

        const ytUrl = allowEmbeds ? getYoutubeEmbedUrl(currentUrl) : null;
        if (ytUrl) {
            directEmbed = { type: "youtube", embedUrl: ytUrl };
            pending = false;
            return;
        }

        // Twitter/X: use fxtwitter JSON API (has CORS headers). This is a
        // request straight to a third party, so it needs the same consent as
        // the media itself.
        const twitterApiUrl = allowEmbeds ? getTwitterApiUrl(currentUrl) : null;
        if (twitterApiUrl) {
            const known = resolvedPreviews.get(twitterApiUrl);
            if (known) {
                tweetEmbed = known.tweet as TweetEmbed | null;
                pending = false;
                return;
            }
            fetch(twitterApiUrl, {
                headers: { Accept: "application/json" },
                referrerPolicy: "no-referrer",
            })
                .then((r) => r.json())
                .then((data: any) => {
                    if (cancelled) return;
                    const tweet = data?.tweet;
                    if (!tweet) return;
                    const embed: TweetEmbed = {
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
                            thumbnail: v.thumbnail_url as string | undefined,
                        })),
                    };
                    tweetEmbed = embed;
                    rememberPreview(twitterApiUrl, {
                        preview: null,
                        tweet: embed,
                        gifHostHeld: false,
                    });
                })
                .catch((err) => {
                    if (cancelled) return;
                    console.error("Twitter preview fetch failed:", err);
                })
                .finally(() => {
                    if (!cancelled) pending = false;
                });
            return () => {
                cancelled = true;
            };
        }

        // The homeserver's own preview endpoint — no third party is contacted,
        // so this runs under every policy. Only its MEDIA is gated, below.
        // Plugins may point the request elsewhere (a mirror the homeserver can
        // reach); the link shown and opened stays the original.
        const previewUrl = applyPreviewUrlTransforms(
            currentUrl,
            pluginRegistry.previewUrlTransforms.map((e) => e.value),
        );
        const cacheKey = `${allowEmbeds ? 1 : 0} ${currentUrl} ${previewUrl}`;
        const known = resolvedPreviews.get(cacheKey);
        if (known) {
            preview = known.preview;
            gifHostHeld = known.gifHostHeld;
            pending = false;
            return;
        }
        getUrlPreview(previewUrl)
            .then(async (data) => {
                if (cancelled) return;
                // GIF sites turn away most homeservers' previewers, so go to
                // the site when the homeserver came back without media. A
                // server that can preview these keeps serving its own copy.
                if (
                    isGifHostLink(currentUrl) &&
                    !data?.imageUrl &&
                    !data?.videoUrl
                ) {
                    if (allowEmbeds) {
                        const embed = await fetchGifEmbed(currentUrl).catch(
                            () => null,
                        );
                        if (cancelled) return;
                        if (embed) {
                            preview = embed;
                            rememberPreview(cacheKey, {
                                preview: embed,
                                tweet: null,
                                gifHostHeld: false,
                            });
                            return;
                        }
                    } else {
                        gifHostHeld = true;
                    }
                }
                if (data && (data.title || data.imageUrl || data.videoUrl)) {
                    preview = data;
                }
                // getUrlPreview answers null for a failed request too, which
                // is worth asking again.
                if (preview || gifHostHeld) {
                    rememberPreview(cacheKey, {
                        preview,
                        tweet: null,
                        gifHostHeld,
                    });
                }
            })
            .catch((err) => {
                if (cancelled) return;
                console.error("URL preview fetch failed:", err);
            })
            .finally(() => {
                if (!cancelled) pending = false;
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
    // Without og dims, the size the image loaded at earlier this session.
    const learnedImage = $derived(learnedMediaSize(preview?.imageUrl));
    const embedImageBox = $derived(
        reservedMediaBox(
            preview?.imageWidth ?? learnedImage?.width,
            preview?.imageHeight ?? learnedImage?.height,
            512,
            384,
        ),
    );
    // The homeserver's preview image is the site's full-size og:image, drawn
    // at most 512×384 here, so the server is asked for a thumbnail that size
    // (2× for high-DPI), animated where it can.
    const previewImageSrc = $derived.by(() => {
        const src = preview?.imageUrl ?? null;
        return src && isAuthedMediaUrl(src)
            ? thumbnailUrl(src, 1024, 768, "scale")
            : src;
    });

    // A video preview with no poster used to mount its <video> unplayed to
    // show the first frame, which holds a decoder and buffered frames in
    // video memory for as long as the row exists. Its first frame is grabbed
    // once instead and shown on the play button; the <video> only mounts on
    // play (or if no frame could be had).
    // A played preview video that is paused and scrolled well away goes back
    // to its play button, freeing its decoder (actions/parkOffscreen), and
    // resumes from where it was.
    let videoParked = $state(false);
    let videoResumeAt = 0;

    let videoFrame = $state<string | null>(null);
    let videoFrameDone = $state(false);
    // Size of the grabbed frame, for a video whose preview gave no dimensions
    // (the poster would otherwise be cropped into a guessed 16/9 box).
    let frameSize = $state<{ width: number; height: number } | null>(null);
    const videoAspect = $derived.by(() => {
        const w = preview?.videoWidth ?? frameSize?.width;
        const h = preview?.videoHeight ?? frameSize?.height;
        return w && h ? `${w}/${h}` : "16/9";
    });
    $effect(() => {
        const src = preview?.videoUrl;
        const needsFrame =
            !!src &&
            !isGifSite &&
            !canLoad(preview?.videoThumbnailUrl) &&
            canLoad(src);
        videoFrame = null;
        frameSize = learnedMediaSize(src) ?? null;
        videoFrameDone = !needsFrame;
        if (!needsFrame || !src) return;
        let live = true;
        let release = () => {};
        void videoFrameUrl(src, 1024, 768).then((url) => {
            if (!live) return;
            release = holdMediaUrl(url);
            videoFrame = url;
            videoFrameDone = true;
        });
        return () => {
            live = false;
            release();
        };
    });

    // In a card, an image the site gives no size for is drawn in a fixed
    // box the shape of the usual og:image (1200×630), so every such card is
    // the same size before and after it loads, and matches the placeholder.
    const cardImageBox = $derived(
        reservedMediaBox(preview?.imageWidth, preview?.imageHeight, 480, 288),
    );
    const cardImageClass = $derived(
        cardImageBox
            ? "max-w-full h-auto max-h-72"
            : "w-full max-w-[480px] aspect-[1200/630] bg-black/10",
    );

    // What the preview most likely is, for the placeholder: media on its own
    // for a link to a media file or a GIF site, otherwise a card.
    const likelyMedia = $derived.by(() => {
        if (isGifSite) return true;
        try {
            return /\.(png|jpe?g|gif|webp|avif|mp4|webm|mov)$/i.test(
                new URL(url).pathname,
            );
        } catch {
            return false;
        }
    });

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
    const showReveal = $derived(
        !revealed && (blockedEmbed || blockedMedia || gifHostHeld),
    );
</script>

{#if directEmbed?.type === "youtube" && youtubePlaying}
    <iframe
        src={youtubePlayerUrl(directEmbed.embedUrl)}
        class="mt-1 w-full max-w-lg aspect-video rounded-lg block"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
        title={t("linkPreview.youtubeVideo")}
        use:parkYoutubeOffscreen={{
            pause: settingsState.pauseVideoOnScrollOff,
            onPark: (at) => {
                youtubeResumeAt = at;
                youtubePlaying = false;
            },
        }}
    ></iframe>
{:else if directEmbed?.type === "youtube"}
    <button
        type="button"
        aria-label={t("linkPreview.playVideo")}
        title={t("linkPreview.youtubeVideo")}
        class="group/media mt-1 relative w-full max-w-lg aspect-video rounded-lg overflow-hidden cursor-pointer bg-black block p-0 border-0"
        onclick={() => (youtubePlaying = true)}
    >
        <img
            src={youtubeThumbnail(directEmbed.embedUrl)}
            alt=""
            class="w-full h-full object-cover"
            loading="lazy"
            referrerpolicy="no-referrer"
        />
        <div
            class="absolute inset-0 flex items-center justify-center bg-black/30 group-hover/media:bg-black/40 transition-colors"
        >
            <div
                class="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center"
            >
                <svg
                    class="w-7 h-7 text-white ms-1"
                    fill="currentColor"
                    viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg
                >
            </div>
        </div>
    </button>
{:else if directEmbed?.type === "video"}
    <!-- svelte-ignore a11y_media_has_caption -->
    <video
        src={directEmbed.videoUrl}
        class="max-w-[min(100%,32rem)] max-h-96 rounded-lg mt-1 block"
        use:rememberVolume
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
                        {t("linkPreview.xTwitter")}
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
                            {#if item.type === "video" && !tweetPlaying.has(item.url)}
                                <button
                                    type="button"
                                    aria-label={t("linkPreview.playVideo")}
                                    class="group/media relative w-full max-h-72 min-w-0 rounded overflow-hidden cursor-pointer bg-black block p-0 border-0"
                                    style={`aspect-ratio: ${box ? `${box.width}/${box.height}` : "16/9"}`}
                                    onclick={(e) => {
                                        // Don't follow the enclosing link.
                                        e.preventDefault();
                                        tweetPlaying = new Set(
                                            tweetPlaying,
                                        ).add(item.url);
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
                            {:else if item.type === "video"}
                                <!-- svelte-ignore a11y_media_has_caption -->
                                <video
                                    src={item.url}
                                    width={box?.width}
                                    height={box?.height}
                                    class="w-full h-auto max-h-72 min-w-0 max-w-full object-contain rounded"
                                    use:rememberVolume
                                    controls
                                    autoplay
                                    preload="auto"
                                    use:pauseOffscreen={{
                                        enabled:
                                            settingsState.pauseVideoOnScrollOff,
                                    }}
                                    use:parkOffscreen={(at) => {
                                        tweetResumeAt.set(item.url, at);
                                        const next = new Set(tweetPlaying);
                                        next.delete(item.url);
                                        tweetPlaying = next;
                                    }}
                                    onloadedmetadata={(e) => {
                                        const at = tweetResumeAt.get(item.url);
                                        if (at) {
                                            e.currentTarget.currentTime = at;
                                            tweetResumeAt.delete(item.url);
                                        }
                                    }}
                                    onclick={(e) => {
                                        // Stop an enclosing link from navigating, but
                                        // keep click-to-pause: preventDefault alone
                                        // would also suppress the video's own toggle.
                                        e.preventDefault();
                                        const v = e.currentTarget;
                                        // Clicks on the control bar are handled by the
                                        // controls themselves; toggling here too would
                                        // undo them.
                                        const r = v.getBoundingClientRect();
                                        if (e.clientY > r.bottom - 48) return;
                                        if (v.paused)
                                            void v.play().catch(() => {});
                                        else v.pause();
                                    }}
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
                    position={galleryPositionLabel(
                        tweetEmbed.photos.length,
                        lightboxTweetIndex,
                    )}
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
{:else if pending && !preview}
    {#if likelyMedia}
        <div
            class="skeleton-delay mt-1 w-full max-w-[min(100%,32rem)] aspect-video rounded-lg bg-discord-backgroundSecondary"
            aria-hidden="true"
        ></div>
    {:else}
        <!-- The card below with one line of title, two of description and
             the fixed image box. -->
        <div class="skeleton-delay mt-2" aria-hidden="true">
            <div
                class="flex max-w-lg rounded overflow-hidden border border-discord-divider bg-discord-backgroundSecondary"
            >
                <div class="w-1 flex-shrink-0 bg-discord-divider"></div>
                <div class="flex flex-1 min-w-0 flex-col p-3 gap-3">
                    <div class="flex-1 min-w-0 animate-pulse">
                        <p class="text-xs mb-0.5">
                            <span
                                class="inline-block w-24 h-2.5 rounded bg-discord-divider"
                            ></span>
                        </p>
                        <p class="text-sm leading-snug">
                            <span
                                class="inline-block w-3/5 h-3 rounded bg-discord-divider"
                            ></span>
                        </p>
                        <p class="text-xs mt-1 leading-relaxed">
                            <span
                                class="inline-block w-full h-2.5 rounded bg-discord-divider"
                            ></span><br /><span
                                class="inline-block w-4/5 h-2.5 rounded bg-discord-divider"
                            ></span>
                        </p>
                    </div>
                    <div
                        class="w-full max-w-[480px] aspect-[1200/630] rounded mt-1 bg-black/10"
                    ></div>
                </div>
            </div>
        </div>
    {/if}
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
                        src={previewImageSrc}
                        alt=""
                        width={embedImageBox.width}
                        height={embedImageBox.height}
                        class="max-w-full h-auto rounded-lg object-contain cursor-pointer block"
                        loading="lazy"
                        referrerpolicy="no-referrer"
                        onerror={() => (imageError = true)}
                        onload={learnImageSize(preview.imageUrl)}
                    />
                {:else}
                    <img
                        src={previewImageSrc}
                        alt=""
                        class="max-w-[min(100%,32rem)] max-h-96 rounded-lg object-contain cursor-pointer block"
                        loading="lazy"
                        referrerpolicy="no-referrer"
                        onerror={() => (imageError = true)}
                        onload={learnImageSize(preview.imageUrl)}
                    />
                {/if}
            </a>
            <button
                onclick={toggleFavourite}
                title={favourited
                    ? t("common.removeFromFavourites")
                    : t("common.addToFavourites")}
                class="absolute top-1.5 end-1.5 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover/media:opacity-100 transition-opacity hover:bg-black/70"
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
                            <div
                                class="relative {cardImageBox
                                    ? 'w-fit self-start'
                                    : 'w-full max-w-[480px]'}"
                            >
                                <img
                                    src={previewImageSrc}
                                    alt={preview.title ?? ""}
                                    width={cardImageBox?.width}
                                    height={cardImageBox?.height}
                                    onerror={() => (imageError = true)}
                                    onload={learnImageSize(preview.imageUrl)}
                                    class="{cardImageClass} rounded mt-1 object-contain cursor-pointer"
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
                                            class="w-5 h-5 text-white ms-0.5"
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
                                src={previewImageSrc}
                                alt={preview.title ?? ""}
                                width={cardImageBox?.width}
                                height={cardImageBox?.height}
                                onerror={() => (imageError = true)}
                                onload={learnImageSize(preview.imageUrl)}
                                class="{cardImageClass} rounded mt-1 object-contain cursor-pointer"
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
        title={t("linkPreview.loadingItContactsTheSiteHosting")}
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
        {t("linkPreview.loadPreviewMedia")}
    </button>
{/if}

{#snippet videoMedia()}
    {#if preview?.videoUrl && canLoad(preview.videoUrl)}
        {@const posterUrl = canLoad(preview.videoThumbnailUrl)
            ? preview.videoThumbnailUrl
            : (videoFrame ?? undefined)}
        <div class="relative inline-block group/media mt-1">
            {#if isGifSite}
                <!-- GIF-sharing sites: play the video like a GIF — muted, looped,
                     autoplaying, and with no controls so it can't be paused/seeked.
                     `pointer-events-none` + no controls already make it unpausable
                     by the user, so we do NOT re-play on pause: the only thing that
                     pauses this element is the browser shedding load, and answering
                     that with play() is an unterminating main-thread ping-pong.
                     Its src is owned by unloadOffscreen, which drops it once the
                     row is well out of view: the timeline keeps every row
                     mounted, so a looping embed otherwise holds its media and
                     decoder for the life of the room. -->
                <!-- svelte-ignore a11y_media_has_caption -->
                <video
                    use:unloadOffscreen={preview.videoUrl}
                    poster={posterUrl}
                    class="max-w-[min(100%,32rem)] max-h-96 rounded-lg block pointer-events-none"
                    autoplay
                    muted
                    loop
                    playsinline
                    disablepictureinpicture
                    preload="metadata"
                ></video>
            {:else if videoPlaying || (!posterUrl && videoFrameDone && !videoParked) || videoThumbError}
                <!-- No usable thumbnail (or the user clicked play): show the video
                     itself rather than a placeholder card. -->
                <!-- svelte-ignore a11y_media_has_caption -->
                <video
                    src={preview.videoUrl}
                    poster={posterUrl}
                    class="max-w-lg w-full max-h-96 rounded-lg block"
                    style={`aspect-ratio: ${videoAspect}; max-height: 24rem;`}
                    use:rememberVolume
                    controls
                    autoplay={videoPlaying}
                    preload={videoPlaying ? "auto" : "metadata"}
                    use:pauseOffscreen={{
                        enabled: settingsState.pauseVideoOnScrollOff,
                    }}
                    use:parkOffscreen={(at) => {
                        if (!videoPlaying) return;
                        videoResumeAt = at;
                        videoParked = true;
                        videoPlaying = false;
                    }}
                    onloadedmetadata={(e) => {
                        if (videoResumeAt > 0) {
                            e.currentTarget.currentTime = videoResumeAt;
                            videoResumeAt = 0;
                        }
                    }}
                ></video>
            {:else}
                <button
                    type="button"
                    aria-label={t("linkPreview.playVideo")}
                    class="relative max-w-lg w-full max-h-96 rounded-lg overflow-hidden cursor-pointer bg-black block p-0 border-0"
                    style={`aspect-ratio: ${videoAspect}; max-height: 24rem;`}
                    onclick={() => (videoPlaying = true)}
                >
                    <img
                        src={posterUrl ?? null}
                        alt=""
                        class="w-full h-full object-cover"
                        loading="lazy"
                        referrerpolicy="no-referrer"
                        onload={(e) => {
                            const img = e.currentTarget as HTMLImageElement;
                            if (!img.naturalWidth || !img.naturalHeight) return;
                            if (preview?.videoThumbnailUrl === posterUrl)
                                return;
                            frameSize = {
                                width: img.naturalWidth,
                                height: img.naturalHeight,
                            };
                            learnMediaSize(
                                preview?.videoUrl,
                                img.naturalWidth,
                                img.naturalHeight,
                            );
                        }}
                        onerror={() => (videoThumbError = true)}
                    />
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
            {/if}
            <button
                onclick={toggleFavourite}
                title={favourited
                    ? t("common.removeFromFavourites")
                    : t("common.addToFavourites")}
                class="absolute top-1.5 end-1.5 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover/media:opacity-100 transition-opacity hover:bg-black/70"
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

<style>
    /* Space is reserved at once, but the placeholder stays invisible for the
       first 500ms so a preview that resolves quickly never flashes it. */
    .skeleton-delay {
        animation: skeleton-delay-in 150ms ease-out 500ms backwards;
    }
    @keyframes skeleton-delay-in {
        from {
            opacity: 0;
        }
    }
</style>
