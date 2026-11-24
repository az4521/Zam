<script lang="ts">
    import { t } from "$lib/i18n";
    import {
        cancelScheduled,
        scheduledForRoom,
        sendScheduledNow,
    } from "$lib/stores/scheduledMessages.svelte";
    import { showErrorToast } from "$lib/stores/toasts.svelte";
    import { compactDateTime } from "$lib/utils/timeFormat";

    interface Props {
        roomId: string;
    }
    let { roomId }: Props = $props();

    const CLOCK_ICON =
        "M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z";
    const CHEVRON_ICON = "M7 10l5 5 5-5z";

    const messages = $derived(scheduledForRoom(roomId));
    let expanded = $state(false);
    // The row whose Cancel is waiting for its second click.
    let confirmingId = $state<string | null>(null);
    // Rows with a request in flight; their buttons are disabled.
    let busy = $state<Record<string, boolean>>({});

    async function run(delayId: string, action: () => Promise<void>) {
        busy[delayId] = true;
        try {
            await action();
        } catch (e) {
            showErrorToast(
                e instanceof Error
                    ? e.message
                    : t("scheduledMessages.actionFailed"),
            );
        } finally {
            delete busy[delayId];
            if (confirmingId === delayId) confirmingId = null;
        }
    }

    function onCancel(delayId: string) {
        if (confirmingId !== delayId) {
            confirmingId = delayId;
            return;
        }
        void run(delayId, () => cancelScheduled(delayId));
    }
</script>

<div class="rounded-t-lg bg-zam-backgroundTertiary text-xs text-zam-textMuted">
    <button
        type="button"
        onclick={() => (expanded = !expanded)}
        aria-expanded={expanded}
        class="w-full flex items-center gap-2 px-3 py-1.5 text-start hover:text-zam-textPrimary transition-colors"
    >
        <svg
            class="w-4 h-4 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 24 24"><path d={CLOCK_ICON} /></svg
        >
        <span class="flex-1 min-w-0 truncate"
            >{t("scheduledMessages.count", { count: messages.length })}</span
        >
        <svg
            class="w-4 h-4 flex-shrink-0 transition-transform {expanded
                ? 'rotate-180'
                : ''}"
            fill="currentColor"
            viewBox="0 0 24 24"><path d={CHEVRON_ICON} /></svg
        >
    </button>
    {#if expanded}
        <ul class="flex flex-col gap-1.5 px-3 pb-2 max-h-48 overflow-y-auto">
            {#each messages as message (message.delayId)}
                <li class="flex items-center gap-2">
                    <span class="flex-shrink-0 text-zam-textPrimary"
                        >{compactDateTime(message.sendAt)}</span
                    >
                    <span
                        class="flex-1 min-w-0 truncate"
                        class:italic={message.body === null}
                        >{message.body ??
                            t("scheduledMessages.encryptedPreview")}</span
                    >
                    <button
                        type="button"
                        disabled={!!busy[message.delayId]}
                        onclick={() =>
                            void run(message.delayId, () =>
                                sendScheduledNow(message.delayId),
                            )}
                        class="flex-shrink-0 px-2 py-0.5 rounded text-zam-accent hover:bg-zam-messageHover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {t("scheduledMessages.sendNow")}
                    </button>
                    <button
                        type="button"
                        disabled={!!busy[message.delayId]}
                        onclick={() => onCancel(message.delayId)}
                        class="flex-shrink-0 px-2 py-0.5 rounded hover:bg-zam-messageHover transition-colors disabled:opacity-40 disabled:cursor-not-allowed {confirmingId ===
                        message.delayId
                            ? 'text-zam-danger'
                            : 'text-zam-textMuted hover:text-zam-textPrimary'}"
                    >
                        {confirmingId === message.delayId
                            ? t("scheduledMessages.confirmCancel")
                            : t("scheduledMessages.cancel")}
                    </button>
                </li>
            {/each}
        </ul>
    {/if}
</div>
