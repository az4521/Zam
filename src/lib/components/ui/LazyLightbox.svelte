<script lang="ts">
    // Lightbox on demand. Its module (~74 KB) loads the first time one opens and
    // stays cached after that. Every prop passes straight through to Lightbox.
    // Lightbox exports no functions and takes no bindable props, so nothing
    // needs to reach past this wrapper.
    import type { ComponentProps } from "svelte";
    import type LightboxModule from "./Lightbox.svelte";
    import { lazyOnce } from "$lib/utils/lazyOnce";

    const loadLightbox = lazyOnce(() => import("./Lightbox.svelte"));

    let props: ComponentProps<typeof LightboxModule> = $props();
</script>

{#await loadLightbox() then { default: Lightbox }}
    <Lightbox {...props} />
{/await}
