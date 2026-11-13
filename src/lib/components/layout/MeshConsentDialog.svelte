<script lang="ts">
    import { t } from "$lib/i18n";
    // Asks before a call opens peer-to-peer connections, which show the
    // user's IP address to the other end (stores/meshConsent). Rendered once
    // in AppShell.
    import { onMount } from "svelte";
    import ModalDialog from "$lib/components/ui/ModalDialog.svelte";
    import {
        meshConsentState,
        resolveMeshConsent,
    } from "$lib/stores/meshConsent.svelte";
    import {
        settingsState,
        setMeshPublicStun,
    } from "$lib/stores/settings.svelte";

    const pending = $derived(meshConsentState.pending);
    /** Through a TURN relay: by default when the homeserver has one, and
     *  always when the user requires it (no relay then means no connection). */
    const relayOnly = $derived(
        !!pending?.relayed || settingsState.meshRelayOnly,
    );
    /** The public STUN choice, saved only when the user connects. */
    let publicStun = $state(false);
    $effect(() => {
        if (pending) publicStun = settingsState.meshPublicStun;
    });
    const allow = () => {
        if (pending?.offerPublicStun && !relayOnly)
            setMeshPublicStun(publicStun);
        resolveMeshConsent("allow");
    };
    /** Closing the dialog takes the choice that opens nothing. */
    const dismiss = () =>
        resolveMeshConsent(pending?.joining ? "cancel" : "deny");

    onMount(() => {
        // A request left over from a session that ended in place.
        resolveMeshConsent("cancel");
    });
</script>

{#if pending}
    <ModalDialog
        onClose={dismiss}
        labelledBy="mesh-consent-title"
        panelClass="relative z-10 w-[min(30rem,calc(100vw-2rem))] rounded-lg bg-discord-backgroundSecondary p-5 shadow-xl"
    >
        <h2
            id="mesh-consent-title"
            class="mb-2 text-lg font-semibold text-discord-textPrimary"
        >
            {pending.fileTransfer
                ? t("meshConsent.titleFileTransfer")
                : pending.joining
                  ? t("meshConsent.titleJoining")
                  : t("meshConsent.titleNewcomer")}
        </h2>
        <p class="mb-3 text-sm text-discord-textMuted">
            {pending.fileTransfer
                ? t("meshConsent.fileTransferDirect")
                : pending.publishing
                  ? t("meshConsent.noCallServer")
                  : t("meshConsent.someoneWithoutCallServer")}
        </p>
        {#if relayOnly}
            <p
                class="mb-3 rounded border border-discord-divider px-3 py-2 text-sm text-discord-textMuted"
            >
                {pending.relayed
                    ? t("meshConsent.relayed")
                    : t("meshConsent.relayRequired")}
            </p>
        {:else}
            <p
                class="mb-3 rounded border border-discord-danger/40 bg-discord-danger/10 px-3 py-2 text-sm text-discord-danger"
                role="alert"
            >
                {t("meshConsent.ipVisible")}
            </p>
        {/if}
        {#if pending.offerPublicStun && !relayOnly}
            <label
                class="mb-3 flex items-start gap-2 text-sm text-discord-textMuted"
            >
                <input
                    type="checkbox"
                    class="mt-0.5"
                    bind:checked={publicStun}
                />
                <span>
                    <span class="font-medium text-discord-textPrimary"
                        >{t("meshConsent.usePublicStun")}</span
                    >
                    {t("meshConsent.usePublicStunHint")}
                </span>
            </label>
        {/if}
        <div class="mt-4 flex flex-wrap justify-end gap-2">
            {#if pending.joining}
                <button
                    type="button"
                    onclick={() => resolveMeshConsent("cancel")}
                    class="rounded px-4 py-2 text-sm font-medium text-discord-textSecondary hover:text-discord-textPrimary hover:underline transition-colors"
                >
                    {t("common.cancel")}
                </button>
            {/if}
            {#if !pending.publishing}
                <button
                    type="button"
                    onclick={() => resolveMeshConsent("deny")}
                    class="rounded px-4 py-2 text-sm font-medium text-discord-textSecondary hover:text-discord-textPrimary hover:underline transition-colors"
                >
                    {pending.joining
                        ? t("meshConsent.joinWithoutThem")
                        : t("meshConsent.notNow")}
                </button>
            {/if}
            <button
                type="button"
                onclick={allow}
                class="rounded bg-discord-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
                {pending.joining && pending.publishing && !pending.fileTransfer
                    ? t("meshConsent.join")
                    : t("meshConsent.connectDirectly")}
            </button>
        </div>
    </ModalDialog>
{/if}
