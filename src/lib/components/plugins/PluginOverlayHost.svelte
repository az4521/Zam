<script lang="ts">
    // Full-window overlays a plugin adds with zam.ui.addOverlay. Each one is a
    // fixed layer over the app. Click-through unless the plugin asks to be
    // interactive, so a non-interactive overlay never blocks Zam underneath.
    import { pluginMount } from "$lib/plugins/pluginMount";
    import { pluginRegistry } from "$lib/stores/plugins.svelte";
</script>

{#each pluginRegistry.overlays as entry (entry.entryId)}
    <div
        class="fixed inset-0 z-[60]"
        class:pointer-events-none={!entry.value.interactive}
        data-zam-plugin={entry.pluginId}
        data-zam-overlay
        use:pluginMount={(el) => entry.value.render(el)}
    ></div>
{/each}
