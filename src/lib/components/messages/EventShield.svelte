<script lang="ts">
    import { ShieldAlert, ShieldX } from "lucide-svelte";
    import type { ShieldView } from "$lib/utils/eventShield";

    interface Props {
        shield: ShieldView;
    }

    let { shield }: Props = $props();

    // Grey shields are advisory, red ones are a security warning.
    const toneClass = $derived(
        shield.tone === "danger"
            ? "text-discord-danger"
            : "text-discord-textMuted",
    );
</script>

<!-- Icon-only on purpose: a text label on every warning message is noise in a
     room full of unverified devices. The reason travels in the tooltip and the
     accessible name instead. -->
<span
    class="inline-flex flex-shrink-0 self-center {toneClass}"
    title={shield.label}
    aria-label={shield.label}
    role="img"
>
    {#if shield.icon === "shield-x"}
        <ShieldX size={14} />
    {:else}
        <ShieldAlert size={14} />
    {/if}
</span>
