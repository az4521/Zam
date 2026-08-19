<script lang="ts">
    import { Clock, Loader2, AlertCircle } from "lucide-svelte";
    import {
        getOutboxItems,
        outboxTick,
        retryOutboxItem,
        removeOutboxItem,
    } from "$lib/stores/outbox.svelte";

    interface Props {
        roomId: string;
    }

    const { roomId }: Props = $props();

    const items = $derived((void outboxTick(), getOutboxItems(roomId)));
</script>

{#if items.length > 0}
    <div class="flex flex-col gap-1 mb-2">
        {#each items as item (item.id)}
            <div
                class="flex items-center gap-2 px-2 py-1.5 rounded bg-discord-backgroundSecondary text-xs text-discord-textMuted"
            >
                <!-- Status icon/label -->
                {#if item.status === "queued"}
                    <Clock class="w-3.5 h-3.5 flex-shrink-0" />
                    <span class="flex-shrink-0">Queued</span>
                {:else if item.status === "sending"}
                    <Loader2 class="w-3.5 h-3.5 flex-shrink-0 animate-spin" />
                    <span class="flex-shrink-0">Sending…</span>
                {:else if item.status === "failed"}
                    <AlertCircle
                        class="w-3.5 h-3.5 flex-shrink-0 text-red-400"
                    />
                    <span class="flex-shrink-0 text-red-400"
                        >{item.error || "Failed"}</span
                    >
                {/if}

                <!-- Body preview -->
                <span class="truncate flex-1 opacity-75"
                    >{String(item.content.body ?? "")}</span
                >

                <!-- Actions for failed items -->
                {#if item.status === "failed"}
                    <button
                        type="button"
                        onclick={() => retryOutboxItem(roomId, item.id)}
                        class="px-2 py-0.5 rounded bg-discord-backgroundTertiary hover:bg-discord-backgroundModifierHover text-discord-text text-xs font-medium transition-colors flex-shrink-0"
                    >
                        Retry
                    </button>
                    <button
                        type="button"
                        onclick={() => removeOutboxItem(roomId, item.id)}
                        class="px-2 py-0.5 rounded bg-discord-backgroundTertiary hover:bg-discord-backgroundModifierHover text-discord-textMuted text-xs font-medium transition-colors flex-shrink-0"
                    >
                        Cancel
                    </button>
                {/if}
            </div>
        {/each}
    </div>
{/if}
