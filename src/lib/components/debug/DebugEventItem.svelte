<script lang="ts">
    import { t } from "$lib/i18n";
    import type { MatrixEvent } from "matrix-js-sdk";
    import { format } from "date-fns";
    import { messagesState } from "$lib/stores/messages.svelte";

    interface Props {
        event: MatrixEvent;
    }

    let { event }: Props = $props();

    // The event mutates in place on decryption and timelineTick is bumped then,
    // so re-read through it or the row keeps showing the m.room.encrypted
    // envelope.
    const type = $derived((void messagesState.timelineTick, event.getType()));
    const sender = $derived(event.getSender() ?? "-");
    const stateKey = $derived(event.getStateKey());
    const eventId = $derived(event.getId() ?? "-");
    const redacted = $derived(
        (void messagesState.timelineTick, event.isRedacted()),
    );
    // Raw SDK DecryptionFailureCode. The timeline's UTD copy collapses most
    // codes into one generic line, so this is the only place the real reason
    // is visible.
    const failureReason = $derived(
        (void messagesState.timelineTick, event.decryptionFailureReason),
    );
    const time = $derived(
        event.getTs() ? format(new Date(event.getTs()), "HH:mm:ss") : "-",
    );
    const contentJson = $derived(
        (void messagesState.timelineTick,
        JSON.stringify(event.getContent(), null, 2)),
    );
</script>

<details
    class="mx-4 my-0.5 rounded bg-zam-backgroundTertiary/40 border border-zam-divider font-mono text-xs"
>
    <summary
        class="px-2 py-1 cursor-pointer select-none flex flex-wrap items-center gap-2 text-zam-textMuted"
    >
        <span class="text-zam-warning/80">{time}</span>
        <span class="text-zam-accent">{type}</span>
        {#if stateKey !== undefined && stateKey !== null}
            <span class="text-zam-warning" title={t("debugEventItem.stateKey")}
                >⊞ {stateKey || t("debugEventItem.empty")}</span
            >
        {/if}
        <span class="text-zam-textSecondary break-all">{sender}</span>
        {#if redacted}<span class="text-zam-danger"
                >{t("debugEventItem.redacted")}</span
            >{/if}
        {#if failureReason}<span class="text-zam-danger">{failureReason}</span
            >{/if}
    </summary>
    <div class="px-2 pb-2 pt-1 border-t border-zam-divider space-y-1">
        <div class="text-zam-textMuted break-all">
            {t("debugEventItem.id", { eventId })}
        </div>
        <pre
            class="whitespace-pre-wrap break-all text-zam-textPrimary">{contentJson}</pre>
    </div>
</details>
