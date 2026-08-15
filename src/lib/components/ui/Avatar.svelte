<script lang="ts">
    import { untrack } from "svelte";
    import { getAvatarColor, getAvatarInitials } from "$lib/utils/colors";

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
    // hard reload, or right after an SW update the worker may not yet control
    // the page, so the <img> request goes out tokenless and 401s — the reported
    // "profile pictures are sometimes broken". The SW calls clients.claim() on
    // activate (firing controllerchange), so retry the load once it takes
    // control; after that, fall back to initials so a genuinely-missing avatar
    // shows the clean placeholder rather than a broken-image glyph.
    const MAX_RETRIES = 2;
    let attempt = $state(0);
    let failed = $state(false);

    // Reset load state whenever the source changes (avatar swap, room switch).
    $effect(() => {
        void resolvedSrc;
        untrack(() => {
            attempt = 0;
            failed = false;
        });
    });

    const showImage = $derived(!!resolvedSrc && !failed);

    async function whenSwControls(): Promise<void> {
        const sw =
            typeof navigator !== "undefined" ? navigator.serviceWorker : null;
        if (!sw || sw.controller) return;
        await new Promise<void>((resolve) => {
            const done = () => {
                sw.removeEventListener("controllerchange", done);
                clearTimeout(timer);
                resolve();
            };
            const timer = setTimeout(done, 1500);
            sw.addEventListener("controllerchange", done);
        });
    }

    async function handleImageError() {
        if (attempt >= MAX_RETRIES) {
            failed = true;
            return;
        }
        await whenSwControls();
        // Bumping the key remounts the <img>, re-requesting the same URL — now
        // through the (newly controlling) service worker.
        attempt++;
    }
</script>

<div
    class="flex-shrink-0 flex items-center justify-center overflow-hidden {roundedClass()} {extraClass}"
    style="width: {size}px; height: {size}px; background-color: {showImage
        ? 'transparent'
        : bgColor};"
>
    {#if showImage}
        {#key attempt}
            <img
                src={resolvedSrc}
                alt={name}
                class="w-full h-full object-cover {roundedClass()}"
                onerror={handleImageError}
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
