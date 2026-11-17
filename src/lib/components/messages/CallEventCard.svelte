<script lang="ts">
    import { t } from "$lib/i18n";
    import type { Room } from "matrix-js-sdk";
    import { Phone, PhoneMissed, PhoneCall } from "lucide-svelte";
    import {
        formatCallDuration,
        type CallSummary,
    } from "$lib/utils/callSummary";
    import { getMemberName } from "$lib/matrix/client";

    let { summary, room }: { summary: CallSummary; room: Room } = $props();

    const names = $derived(
        summary.participants.map((id) => getMemberName(room, id) || id),
    );
    const label = $derived(
        summary.outcome === "missed"
            ? t("callEventCard.missedCall")
            : summary.outcome === "ongoing"
              ? t("callEventCard.ongoingCall")
              : t("callEventCard.callEnded"),
    );
    const duration = $derived(formatCallDuration(summary.durationMs));
</script>

<div
    class="mt-1 inline-flex items-center gap-2 rounded-lg border border-zam-backgroundTertiary bg-zam-backgroundSecondary px-3 py-2 text-sm"
    class:text-zam-danger={summary.outcome === "missed"}
>
    {#if summary.outcome === "missed"}
        <PhoneMissed size={16} class="flex-shrink-0" />
    {:else if summary.outcome === "ongoing"}
        <PhoneCall size={16} class="flex-shrink-0 text-zam-online" />
    {:else}
        <Phone size={16} class="flex-shrink-0 text-zam-textMuted" />
    {/if}
    <span class="font-medium">{label}</span>
    {#if names.length > 0}
        <span class="text-zam-textMuted">· {names.join(", ")}</span>
    {/if}
    {#if duration}
        <span class="text-zam-textMuted">· {duration}</span>
    {/if}
</div>
