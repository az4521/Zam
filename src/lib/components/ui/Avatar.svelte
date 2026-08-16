<script lang="ts">
    import { getAvatarColor, getAvatarInitials } from "$lib/utils/colors";
    import { createMediaRetry } from "$lib/stores/mediaAuth.svelte";

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
    // access token is injected by the media service worker. On a fresh load, a
    // hard reload, or right after an SW update the worker isn't ready to auth the
    // request yet, so it goes out tokenless and 401s — the reported "profile
    // pictures are sometimes broken". createMediaRetry holds that failure and
    // retries the moment media auth becomes ready (see mediaAuth.svelte), then
    // falls back to initials so a genuinely-missing avatar shows the clean
    // placeholder rather than a broken-image glyph.
    const imgRetry = createMediaRetry();
    // Reset load state whenever the source changes (avatar swap, room switch).
    $effect(() => {
        void resolvedSrc;
        imgRetry.reset();
    });

    // Hide the <img> while a failure is held (pending) too, so the clean initials
    // show during the retry wait instead of a broken-image glyph. Avatars are
    // fixed-size, so unmounting the <img> costs no reserved layout space.
    const showImage = $derived(
        !!resolvedSrc && !imgRetry.failed && !imgRetry.pending,
    );
</script>

<div
    class="flex-shrink-0 flex items-center justify-center overflow-hidden {roundedClass()} {extraClass}"
    style="width: {size}px; height: {size}px; background-color: {showImage
        ? 'transparent'
        : bgColor};"
>
    {#if showImage}
        {#key imgRetry.key}
            <img
                src={resolvedSrc}
                alt={name}
                class="w-full h-full object-cover {roundedClass()}"
                onerror={imgRetry.onError}
            />
        {/key}
    {:else}
        <span
            class="text-white font-semibold select-none"
            style="font-size: {size * 0.4}px;"
        >
            {initials}
        </span>
    {/if}
</div>
