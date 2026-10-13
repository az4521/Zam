<script lang="ts">
    import { t } from "$lib/i18n";
    import { untrack } from "svelte";
    import {
        mxcToHttp,
        fetchDecryptedAttachmentBlob,
    } from "$lib/matrix/client";
    import { settingsState } from "$lib/stores/settings.svelte";
    import {
        videoSource,
        videoPoster,
        formatMediaDuration,
    } from "$lib/utils/roomMedia";
    import { safeAspectRatio, safeDimension } from "$lib/utils/mediaDimensions";
    import { pauseOffscreen } from "$lib/actions/pauseOffscreen";
    import { authedVideoSrc } from "$lib/actions/authedVideoSrc";
    import {
        videoNeedsAuthedStream,
        STREAM_ENCRYPTED_MIN_BYTES,
    } from "$lib/matrix/videoStream";
    import MediaProgress from "$lib/components/ui/MediaProgress.svelte";
    import type { DownloadProgress } from "$lib/utils/downloadProgress";

    interface Props {
        /** An m.video event's content. */
        content: Record<string, unknown>;
        /** The original file name (MSC2530), shown on the play card. */
        filename: string;
    }
    let { content, filename }: Props = $props();

    // Video: nothing is requested until the user clicks play, and then the
    // <video> element streams the media URL itself rather than us buffering the
    // whole file into a blob first. The service worker (static/sw.js) injects
    // the access token into every element-initiated request under
    // /_matrix/client/v1/media/, which is the same path every <img> in this
    // timeline already depends on, so a bare `src` is authenticated.
    //
    // Buffering first was actively harmful: continuwuity/tuwunel send no
    // Content-Length and ignore Range on a media download (verified: a ranged
    // request gets a plain 200 of the whole file), so a blob fetch has
    // no progress to report AND cannot start playback early — a 20 MB clip sat
    // on a bare spinner until every byte had landed, by which point the click's
    // user-activation window had expired, `autoplay` was refused, and the video
    // mounted paused on a black first frame. That reads as "it does not play".
    let videoAttempt = $state(0);
    let videoFailed = $state(false);
    let videoThumbFailed = $state(false);
    // Video source and state
    const videoSrc = $derived(videoSource(content));
    let encryptedVideoUrl = $state<string | null>(null);
    let videoDecrypting = $state(false);
    let videoDecryptFailed = $state(false);
    let videoDecryptAttempt = $state(0);
    let videoPlayRequested = $state(false);
    // Encrypted video big enough to be worth playing while it downloads: the
    // bytes are decrypted on the fly instead of waiting for the whole file
    // (see videoStream.ts for what that does to integrity checking).
    let videoStreamEncrypted = $state(false);
    // True once the element has enough data to start; until then a streamed
    // video shows download progress over its black box.
    let videoStreamReady = $state(false);
    // A plain (unencrypted) stream that broke retries once as a full download.
    let videoForceBlob = $state(false);
    let videoProgress = $state<DownloadProgress | null>(null);
    const videoSize = $derived.by(() => {
        const size = (content?.info as Record<string, unknown> | undefined)
            ?.size;
        return typeof size === "number" && Number.isFinite(size) && size > 0
            ? size
            : null;
    });
    const encryptedStreamUrl = $derived(
        videoStreamEncrypted && videoSrc?.kind === "encrypted"
            ? mxcToHttp(videoSrc.file.url)
            : null,
    );

    // Without a controlling service worker (Tor Browser has none; a hard
    // reload starts uncontrolled) that bare `src` 401s, so the plain video is
    // instead streamed with the token through MediaSource (videoStream.ts).
    // Chosen up front when there's no worker, and as a one-shot retry when the
    // bare `src` fails anyway (a worker that hasn't received the token yet).
    let videoUseStream = $state(false);
    const videoStreamUrl = $derived(
        videoUseStream && videoSrc?.kind === "plain"
            ? mxcToHttp(videoSrc.mxc)
            : null,
    );
    const videoMimetype = $derived(
        typeof (content?.info as Record<string, unknown> | undefined)
            ?.mimetype === "string"
            ? ((content?.info as Record<string, unknown>).mimetype as string)
            : null,
    );
    function onVideoError() {
        if (videoSrc?.kind === "plain" && !videoUseStream) {
            videoUseStream = true;
            videoAttempt += 1;
            return;
        }
        if (videoStreamEncrypted) return fallBackToVerifiedDownload();
        onPlainStreamBroke();
    }

    // The MediaSource route can fail on a file the browser would still play
    // whole (e.g. an audio+video WebM whose blocks are not strictly ordered).
    // Try once more as a plain download before giving up.
    function onPlainStreamBroke() {
        if (videoUseStream && !videoForceBlob) {
            videoForceBlob = true;
            videoAttempt += 1;
            return;
        }
        videoFailed = true;
    }

    // A streamed encrypted video that could not be played (hash mismatch at the
    // end, a network error, a codec MediaSource refuses) drops back to the
    // download-verify-play path, which either plays it or says it is corrupt.
    function fallBackToVerifiedDownload() {
        if (!videoStreamEncrypted) return;
        videoStreamEncrypted = false;
        videoStreamReady = false;
        videoPlayRequested = true;
        videoDecrypting = true;
    }

    function playVideo() {
        videoFailed = false;
        if (videoNeedsAuthedStream()) videoUseStream = true;
        videoAttempt += 1;
        if (
            videoSrc?.kind === "encrypted" &&
            !encryptedVideoUrl &&
            videoSize !== null &&
            videoSize >= STREAM_ENCRYPTED_MIN_BYTES &&
            typeof MediaSource !== "undefined"
        ) {
            videoStreamEncrypted = true;
            videoStreamReady = false;
            videoProgress = null;
            return;
        }
        if (videoSrc?.kind === "encrypted") {
            videoPlayRequested = true;
            // Show the spinner from this frame on, not an empty <video> until
            // the decrypt effect runs. Only when there is no blob yet: a retry
            // after a playback error reuses the blob and the effect won't re-run.
            if (!encryptedVideoUrl) videoDecrypting = true;
        }
    }

    // Decrypt video when play is requested. Keyed on the ciphertext mxc, not
    // the `videoSrc` object: `content` re-derives on every timeline tick, and
    // a fresh object here would revoke the blob URL under a playing <video>.
    const encryptedVideoKey = $derived(
        videoSrc?.kind === "encrypted" ? videoSrc.file.url : null,
    );
    $effect(() => {
        if (encryptedVideoKey === null || !videoPlayRequested) return;
        // Depend on attempt counter for retry
        void videoDecryptAttempt;
        const src = untrack(() => videoSrc);
        if (src?.kind !== "encrypted") return;

        videoDecrypting = true;
        videoDecryptFailed = false;
        videoProgress = null;
        let capturedUrl: string | null = null;
        // A decrypt that resolves after cleanup (unmount, retry, new source)
        // must revoke its own URL instead of publishing it.
        let cancelled = false;
        const abort = new AbortController();

        fetchDecryptedAttachmentBlob(src.file, src.mimetype ?? undefined, {
            expectedSize: untrack(() => videoSize),
            signal: abort.signal,
            onProgress: (p) => {
                if (!cancelled) videoProgress = p;
            },
        })
            .then((url) => {
                if (cancelled) {
                    URL.revokeObjectURL(url);
                    return;
                }
                capturedUrl = url;
                encryptedVideoUrl = url;
                videoDecrypting = false;
            })
            .catch(() => {
                if (cancelled) return;
                videoDecrypting = false;
                videoDecryptFailed = true;
            });

        return () => {
            cancelled = true;
            abort.abort();
            if (capturedUrl) URL.revokeObjectURL(capturedUrl);
            encryptedVideoUrl = null;
        };
    });

    function retryVideoDecrypt() {
        videoDecryptAttempt += 1;
    }

    // Poster for the unplayed video body: decrypt encrypted thumbnail on mount,
    // or use plain mxcToHttp for unencrypted. Never the video's own url — see
    // comment in roomMedia.ts videoPoster.
    const posterSrc = $derived(videoPoster(content));
    let encryptedPosterUrl = $state<string | null>(null);
    const videoThumbnailUrl = $derived(
        !posterSrc
            ? null
            : posterSrc.kind === "plain"
              ? mxcToHttp(posterSrc.mxc)
              : encryptedPosterUrl,
    );

    // Decrypt the encrypted poster on mount (a small thumbnail). Keyed on the
    // thumbnail's mxc for the same reason as the video decrypt above.
    const encryptedPosterKey = $derived(
        posterSrc?.kind === "encrypted" ? posterSrc.file.url : null,
    );
    $effect(() => {
        if (encryptedPosterKey === null) return;
        const src = untrack(() => posterSrc);
        if (src?.kind !== "encrypted") return;

        let capturedUrl: string | null = null;
        let cancelled = false;

        fetchDecryptedAttachmentBlob(src.file, src.mimetype ?? undefined)
            .then((url) => {
                if (cancelled) {
                    URL.revokeObjectURL(url);
                    return;
                }
                capturedUrl = url;
                encryptedPosterUrl = url;
            })
            .catch(() => {
                // No poster: the placeholder card below carries the play
                // affordance instead.
                if (!cancelled) encryptedPosterUrl = null;
            });

        return () => {
            cancelled = true;
            if (capturedUrl) URL.revokeObjectURL(capturedUrl);
            encryptedPosterUrl = null;
        };
    });
    const videoDuration = $derived(
        formatMediaDuration((content?.info as any)?.duration),
    );
    // `info.w`/`info.h` come off the wire, so they are whatever the sender put
    // there — never interpolate them into style text raw (a crafted value
    // closes the declaration and adds its own). safeAspectRatio only ever
    // yields `<int> / <int>`.
    const videoAspectRatio = $derived(
        safeAspectRatio((content?.info as any)?.w, (content?.info as any)?.h),
    );
    // True only when the sender gave usable dimensions. When false,
    // `videoAspectRatio` is just the 16/9 fallback guess, so we prefer a
    // self-measured ratio (below) once the element reports one. Bridged
    // Discord/Twitter media (OOYE) routinely omits info.w/info.h.
    const videoHasDims = $derived(
        safeDimension((content?.info as any)?.w) !== null &&
            safeDimension((content?.info as any)?.h) !== null,
    );
    // Aspect ratio recovered from the played <video>'s own intrinsic size when
    // the sender omitted dims. `safeAspectRatio` keeps this to `<int> / <int>`,
    // and its inputs are the element's videoWidth/videoHeight — trusted browser
    // integers, never event content — so it is safe to put in `style`.
    let measuredVideoAspect = $state<string | null>(null);
    // The aspect ratio the played/poster box is actually drawn at: the sender's
    // when they gave one, else the self-measured value once we have it, else the
    // 16/9 fallback.
    const effectiveVideoAspect = $derived(
        videoHasDims
            ? videoAspectRatio
            : (measuredVideoAspect ?? videoAspectRatio),
    );
    // Recover the true aspect of a dimension-less video from its metadata, so a
    // bridged clip settles to its real shape once (gently, inside the bounded
    // box) instead of the browser's unbounded intrinsic-size jump. Ignored when
    // the sender's dims are present — those stay authoritative.
    function onVideoMetadata(e: Event) {
        if (videoHasDims) return;
        const el = e.currentTarget as HTMLVideoElement;
        if (el.videoWidth > 0 && el.videoHeight > 0) {
            measuredVideoAspect = safeAspectRatio(
                el.videoWidth,
                el.videoHeight,
            );
        }
    }
</script>

{#snippet player(extraClass: string)}
    <!-- svelte-ignore a11y_media_has_caption -->
    <!-- The played box is drawn identically to the poster: same
     `aspect-ratio` and `max-height`, plus object-contain and
     a black backdrop. Without an explicit box the <video>
     sizes to its intrinsic dimensions, which (a) jumps the
     box vs the poster on play and (b) lets a wide clip's
     min-content width push past the column and overflow. -->
    <video
        src={videoSrc?.kind === "plain"
            ? videoStreamUrl
                ? undefined
                : mxcToHttp(videoSrc.mxc)
            : encryptedStreamUrl
              ? undefined
              : encryptedVideoUrl}
        use:authedVideoSrc={{
            url: videoStreamUrl ?? encryptedStreamUrl,
            mimetype: videoMimetype,
            decrypt:
                encryptedStreamUrl && videoSrc?.kind === "encrypted"
                    ? videoSrc.file
                    : undefined,
            expectedSize: videoSize,
            forceBlob: videoForceBlob,
            onProgress: (p) => (videoProgress = p),
            onError: () =>
                encryptedStreamUrl
                    ? fallBackToVerifiedDownload()
                    : onPlainStreamBroke(),
        }}
        controls
        autoplay
        playsinline
        preload="auto"
        class="max-w-lg w-full rounded-lg block object-contain bg-black {extraClass}"
        style={`aspect-ratio: ${effectiveVideoAspect}; max-height: 24rem;`}
        onloadedmetadata={onVideoMetadata}
        oncanplay={() => (videoStreamReady = true)}
        onerror={onVideoError}
        use:pauseOffscreen={{
            enabled: settingsState.pauseVideoOnScrollOff,
        }}
    ></video>
{/snippet}

{#if videoDecrypting}
    <MediaProgress
        label={t("messageItem.decryptingVideo")}
        progress={videoProgress}
    />
{:else if videoDecryptFailed}
    <div
        class="flex items-center gap-3 px-4 py-3 mt-1 max-w-sm w-full bg-discord-backgroundTertiary rounded-lg"
    >
        <svg
            class="w-4 h-4 text-discord-danger"
            fill="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
            />
        </svg>
        <div class="flex-1 min-w-0">
            <span class="text-xs text-discord-danger"
                >{t("messageItem.couldnTDecryptVideo")}</span
            >
        </div>
        <button
            class="px-2 py-1 text-xs font-medium text-discord-textPrimary bg-discord-backgroundSecondary hover:bg-discord-messageHover rounded transition-colors"
            onclick={retryVideoDecrypt}
        >
            {t("common.retry")}
        </button>
    </div>
{:else if videoSrc === null}
    <!-- Nothing this client can play: a malformed url. Deliberately NOT
     clickable — a play affordance that can never resolve a
     source is a dead click, which is exactly how this gets
     reported as "videos cannot be played at all". -->
    <div
        class="flex items-center gap-3 px-4 py-3 mt-1 max-w-sm w-full bg-discord-backgroundTertiary rounded-lg"
    >
        <div
            class="w-10 h-10 rounded-full bg-discord-backgroundSecondary flex items-center justify-center flex-shrink-0"
        >
            <svg
                class="w-5 h-5 text-discord-textMuted"
                fill="currentColor"
                viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg
            >
        </div>
        <div class="min-w-0">
            <p class="text-sm font-medium text-discord-textPrimary truncate">
                {filename || t("messageItem.video")}
            </p>
            <p class="text-xs text-discord-textMuted">
                {t("messageItem.canTBePlayedHere")}
            </p>
        </div>
    </div>
{:else if videoAttempt > 0 && !videoFailed}
    <!-- Keyed so a retry after a failure remounts the element: the
     src is unchanged, so without this Svelte would patch
     nothing and the browser would never re-attempt the load. -->
    {#key videoAttempt}
        {#if encryptedStreamUrl}
            <div class="relative max-w-lg w-full mt-1">
                {@render player("")}
                {#if !videoStreamReady}
                    <!-- Streaming: the box stays black until the first
                     seconds are in, so say how far the download is. -->
                    <div
                        class="absolute inset-x-2 bottom-2 flex justify-start pointer-events-none"
                    >
                        <MediaProgress
                            label={t("messageItem.decryptingVideo")}
                            progress={videoProgress}
                        />
                    </div>
                {/if}
            </div>
        {:else}
            {@render player("mt-1")}
        {/if}
    {/key}
{:else}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div
        class="relative max-w-lg w-full mt-1 rounded-lg overflow-hidden cursor-pointer group bg-black"
        style={videoThumbnailUrl && !videoThumbFailed
            ? `aspect-ratio: ${effectiveVideoAspect}; max-height: 24rem;`
            : ""}
        onclick={playVideo}
    >
        {#if videoThumbnailUrl && !videoThumbFailed}
            <img
                src={videoThumbnailUrl}
                alt=""
                class="w-full h-full object-cover"
                onerror={() => (videoThumbFailed = true)}
            />
            <div
                class="absolute inset-0 flex flex-col items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors"
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
                <p
                    class="mt-2 text-xs text-white font-medium drop-shadow px-2 py-1 text-center line-clamp-1 rounded-full bg-black/60"
                >
                    {filename}
                </p>
            </div>
        {:else}
            <!-- No sender-uploaded thumbnail: a deliberate neutral
             card carrying the play affordance, the filename and
             the duration when the sender gave one. Nothing is
             requested from the server until it is clicked —
             asking /media/thumbnail for the video itself would
             download the whole file (see videoThumbnailUrl). -->
            <div
                class="flex items-center gap-3 px-4 py-3 bg-discord-backgroundTertiary group-hover:bg-discord-messageHover transition-colors rounded-lg"
            >
                <div
                    class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 {videoFailed
                        ? 'bg-discord-danger'
                        : 'bg-discord-accent'}"
                >
                    <svg
                        class="w-5 h-5 text-white ms-0.5"
                        fill="currentColor"
                        viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg
                    >
                </div>
                <div class="min-w-0">
                    <p
                        class="text-sm font-medium text-discord-textPrimary truncate"
                    >
                        {filename || t("messageItem.video")}
                    </p>
                    <!-- A failed load has to SAY so. Silently
                     dropping back to "Click to play" is
                     indistinguishable from the click having
                     done nothing at all. -->
                    <p
                        class="text-xs {videoFailed
                            ? 'text-discord-danger'
                            : 'text-discord-textMuted'}"
                    >
                        {videoFailed
                            ? t("messageItem.playbackFailedClickToRetry")
                            : videoDuration
                              ? t("messageItem.clickToPlay", {
                                    videoDuration,
                                })
                              : t("messageItem.clickToPlay2")}
                    </p>
                </div>
            </div>
        {/if}
    </div>
{/if}
