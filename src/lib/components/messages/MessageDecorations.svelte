<script lang="ts">
    // Additive per-message badges from plugins (zam.messages.decorate).
    // INTEROP (spec §2): overlay only — never replaces body rendering. Badge
    // and tooltip are plugin strings rendered as ESCAPED TEXT ({...}), never
    // {@html}.
    import type { MessageDecoration } from "$lib/utils/pluginMessageActions";

    let { decorations }: { decorations: MessageDecoration[] } = $props();
</script>

{#each decorations as d (d.key)}
    {#if d.badge}
        <span
            class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold leading-none bg-discord-backgroundSecondary text-discord-textMuted border border-discord-divider"
            title={d.tooltip}>{d.badge}</span
        >
    {:else if d.tooltip}
        <span
            class="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[9px] font-semibold bg-discord-backgroundSecondary text-discord-textMuted border border-discord-divider"
            title={d.tooltip}
            aria-label={d.tooltip}>i</span
        >
    {/if}
{/each}
