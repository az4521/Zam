<script lang="ts">
    import { getAvatarColor, getAvatarInitials } from "$lib/utils/colors";
    import {
        createMediaRetry,
        isAuthedMediaUrl,
        thumbnailUrl,
    } from "$lib/stores/mediaAuth.svelte";

    interface Props {
        src?: string | null;
        name?: string;
        id?: string | null;
        size?: number;
        rounded?: "full" | "lg" | "md" | "xl" | "2xl" | "none";
        class?: string;
    }

    let {
        src = null,
        name = "?",
        id = null,
        size = 40,
        rounded = "full",
        class: extraClass = "",
    }: Props = $props();

    const resolvedSrc = $derived(src ?? null);
    const initials = $derived(getAvatarInitials(name));
    const bgColor = $derived(getAvatarColor(id ?? name));

    const roundedClass = $derived(() => {
        if (rounded === "none") return "";
        if (rounded === "full") return "rounded-full";
        if (rounded === "2xl") return "rounded-2xl";
        if (rounded === "xl") return "rounded-xl";
        if (rounded === "lg") return "rounded-lg";
        return "rounded-md";
    });

    // Avatars load over authenticated media (/_matrix/client/v1/media), whose
    // token an <img> can't send. Normally the media service worker injects it,
    // but a hard reload leaves the page uncontrolled and the request 401s — the
    // reported "profile pictures are sometimes broken". createMediaRetry re-fetches
    // it with the token and swaps to a blob URL (works with no SW), falling back
    // to initials only if the avatar is genuinely gone. `.src` is the URL to use
    // (original, then blob); `.pending` is true while fetching, so the clean
    // initials show during the wait instead of a broken-image glyph.
    // Avatars are asked of the homeserver at the size this box needs at this
    // screen's density, in power-of-two steps so sizes share copies, with
    // `animated=true` so animated ones keep animating where the server can
    // (MSC2705). If the server can't thumbnail it, the original is used.
    const boxPx = $derived(
        Math.max(
            32,
            2 **
                Math.ceil(Math.log2(size * (globalThis.devicePixelRatio || 1))),
        ),
    );
    const thumbSrc = $derived(
        resolvedSrc && isAuthedMediaUrl(resolvedSrc)
            ? thumbnailUrl(resolvedSrc, boxPx, boxPx, "crop")
            : resolvedSrc,
    );
    let useOriginal = $state(false);
    $effect(() => {
        void resolvedSrc;
        useOriginal = false;
    });
    const imgRetry = createMediaRetry(() =>
        useOriginal ? resolvedSrc : thumbSrc,
    );
    $effect(() => {
        if (imgRetry.failed && !useOriginal && thumbSrc !== resolvedSrc)
            useOriginal = true;
    });
    const showImage = $derived(
        !!imgRetry.src && !imgRetry.failed && !imgRetry.pending,
    );
</script>

<div
    class="flex-shrink-0 flex items-center justify-center overflow-hidden {roundedClass()} {extraClass}"
    style="width: {size}px; height: {size}px; background-color: {showImage
        ? 'transparent'
        : bgColor};"
>
    {#if showImage}
        <img
            src={imgRetry.src}
            alt={name}
            class="w-full h-full object-cover {roundedClass()}"
            data-own-retry
            onerror={imgRetry.onError}
        />
    {:else}
        <span
            class="text-white font-semibold select-none"
            style="font-size: {size * 0.4}px;"
        >
            {initials}
        </span>
    {/if}
</div>
