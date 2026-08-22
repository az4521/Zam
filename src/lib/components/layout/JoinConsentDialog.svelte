<script lang="ts">
    // Consent gate before a click-to-join (audit SEC-M3). Rendered once in
    // AppShell; shows when the join-consent store has a pending request. Text
    // only — the identifiers are plain strings, never {@html}.
    import { onMount } from "svelte";
    import ModalDialog from "$lib/components/ui/ModalDialog.svelte";
    import {
        joinConsentState,
        resolveJoinConsent,
    } from "$lib/stores/joinConsent.svelte";

    const pending = $derived(joinConsentState.pending);
    // The resolved room id is only worth showing separately when it differs
    // from what the user clicked (i.e. an alias link).
    const showResolved = $derived(
        !!pending && pending.display !== pending.resolvedRoomId,
    );

    // Clear any stale pending consent from an in-place-expired prior session.
    // requestJoinConsent is only called from timeline link clicks, which happen
    // AFTER AppShell mounts, so pending is always null in a healthy flow.
    onMount(() => {
        resolveJoinConsent(false);
    });
</script>

{#if pending}
    <ModalDialog
        onClose={() => resolveJoinConsent(false)}
        labelledBy="join-consent-title"
        panelClass="relative z-10 w-[min(28rem,calc(100vw-2rem))] rounded-lg bg-discord-backgroundSecondary p-5 shadow-xl"
    >
        <h2
            id="join-consent-title"
            class="mb-2 text-lg font-semibold text-discord-textPrimary"
        >
            Join this room?
        </h2>
        <p class="mb-3 text-sm text-discord-textMuted">
            You clicked a link to
            <span class="break-all font-medium text-discord-textPrimary"
                >{pending.display}</span
            >. Joining shares your Matrix ID with everyone in the room and adds
            it to your room list.
        </p>
        {#if showResolved}
            <p class="mb-3 text-sm text-discord-textMuted">
                This opens room
                <span class="break-all font-medium text-discord-textPrimary"
                    >{pending.resolvedRoomId}</span
                >.
            </p>
        {/if}
        {#if pending.serverMismatch}
            <p
                class="mb-3 rounded border border-discord-danger/40 bg-discord-danger/10 px-3 py-2 text-sm text-discord-danger"
                role="alert"
            >
                Warning: this link points at a different server than the room it
                resolves to. Only continue if you trust the sender.
            </p>
        {/if}
        <div class="mt-4 flex justify-end gap-2">
            <button
                type="button"
                onclick={() => resolveJoinConsent(false)}
                class="rounded px-4 py-2 text-sm font-medium text-discord-textSecondary hover:text-discord-textPrimary hover:underline transition-colors"
            >
                Cancel
            </button>
            <button
                type="button"
                onclick={() => resolveJoinConsent(true)}
                class="rounded bg-discord-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
                Join room
            </button>
        </div>
    </ModalDialog>
{/if}
