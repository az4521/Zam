<script lang="ts">
    // A key combination as key caps: Ctrl + Shift + M.
    import { bindingParts, type Binding } from "$lib/keybinds/keybinds";
    import { IS_MAC } from "$lib/stores/keybinds.svelte";

    interface Props {
        binding: Binding;
    }
    let { binding }: Props = $props();
    const parts = $derived(bindingParts(binding, IS_MAC));
</script>

<span class="inline-flex items-center gap-1 flex-wrap" dir="ltr">
    {#each parts as part, i (i)}
        <kbd
            class="min-w-[1.5rem] px-1.5 py-0.5 rounded border border-discord-divider bg-discord-backgroundTertiary text-xs font-mono text-discord-textPrimary text-center shadow-[0_1px_0_var(--discord-divider)]"
            >{part}</kbd
        >
    {/each}
</span>
