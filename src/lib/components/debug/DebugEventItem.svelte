<script lang="ts">
    import type { MatrixEvent } from "matrix-js-sdk";
    import { format } from "date-fns";

    interface Props {
        event: MatrixEvent;
    }

    let { event }: Props = $props();

    const type = $derived(event.getType());
    const sender = $derived(event.getSender() ?? "-");
    const stateKey = $derived(event.getStateKey());
    const eventId = $derived(event.getId() ?? "-");
    const redacted = $derived(event.isRedacted());
    const time = $derived(
        event.getTs() ? format(new Date(event.getTs()), "HH:mm:ss") : "-",
    );
    const contentJson = $derived(JSON.stringify(event.getContent(), null, 2));
</script>

<details
    class="mx-4 my-0.5 rounded bg-discord-backgroundTertiary/40 border border-discord-divider font-mono text-xs"
>
    <summary
        class="px-2 py-1 cursor-pointer select-none flex flex-wrap items-center gap-2 text-discord-textMuted"
    >
        <span class="text-discord-warning/80">{time}</span>
        <span class="text-discord-accent">{type}</span>
        {#if stateKey !== undefined && stateKey !== null}
            <span class="text-discord-warning" title="state_key"
                >⊞ {stateKey || "(empty)"}</span
            >
        {/if}
        <span class="text-discord-textSecondary break-all">{sender}</span>
        {#if redacted}<span class="text-discord-danger">REDACTED</span>{/if}
    </summary>
    <div class="px-2 pb-2 pt-1 border-t border-discord-divider space-y-1">
        <div class="text-discord-textMuted break-all">id: {eventId}</div>
        <pre
            class="whitespace-pre-wrap break-all text-discord-textPrimary">{contentJson}</pre>
    </div>
</details>
