<script lang="ts">
    interface Props {
        src: string;
        alt?: string;
        onClose: () => void;
    }

    import {
        interfaceState,
        openModal,
        clearModal,
    } from "$lib/stores/interface.svelte";
    import { onMount } from "svelte";

    let { src, alt = "", onClose }: Props = $props();

    onMount(() => {
        interfaceState.lightboxOpen = true;
        // Register in the shared modal slot so Escape/back close it centrally.
        openModal("lightbox", onClose);
        return () => {
            interfaceState.lightboxOpen = false;
            clearModal("lightbox");
        };
    });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
    class="fixed inset-0 z-[9998] flex items-center justify-center bg-black/80"
    onclick={(e) => {
        e.stopPropagation();
        onClose();
    }}
>
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <img
        {src}
        {alt}
        onclick={(e) => e.stopPropagation()}
        style="max-width: calc(100dvw - {interfaceState.isMobile
            ? '6em'
            : '2em'}); max-height: calc(100dvh - {interfaceState.isMobile
            ? '6em'
            : '2em'}); object-fit: contain; border-radius: 0.5em;"
    />
</div>
