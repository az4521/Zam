<script lang="ts">
    import { t } from "$lib/i18n";
    import {
        gameInviteDialogState,
        closeGameInviteDialog,
    } from "$lib/stores/gameInviteDialog.svelte";
    import { invitableGames } from "$lib/stores/richPresence.svelte";
    import { sendGameInvite } from "$lib/matrix/gameInvite";
    import { showErrorToast } from "$lib/stores/toasts.svelte";
    import { focusTrap } from "$lib/actions/focusTrap";
    import { GAME_INVITE_LIMITS } from "$lib/utils/gameInvite";

    let pickedKey = $state<string | null>(null);
    let note = $state("");
    let sending = $state(false);

    const games = $derived(invitableGames());
    // The picked game if it is still running, else the first one.
    const selected = $derived(
        games.find((g) => g.key === pickedKey) ?? games[0] ?? null,
    );

    async function send() {
        const roomId = gameInviteDialogState.roomId;
        const game = selected;
        if (!roomId || !game || sending) return;
        sending = true;
        try {
            await sendGameInvite(roomId, game, note.trim() || undefined);
            closeGameInviteDialog();
        } catch (err) {
            showErrorToast(
                err instanceof Error && err.message
                    ? err.message
                    : t("gameInvite.failedToSend"),
            );
            sending = false;
        }
    }
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <button
        type="button"
        aria-label={t("common.closeDialog")}
        class="absolute inset-0 bg-black/60"
        onclick={closeGameInviteDialog}
    ></button>
    <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-invite-title"
        class="relative z-10 bg-discord-backgroundSecondary rounded-lg shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto flex flex-col gap-4 p-6"
        use:focusTrap={{ onEscape: closeGameInviteDialog }}
    >
        <h2
            id="game-invite-title"
            class="text-lg font-bold text-discord-textPrimary"
        >
            {t("gameInvite.title")}
        </h2>

        {#if games.length === 0}
            <p class="text-sm text-discord-textMuted">
                {t("gameInvite.noGames")}
            </p>
        {:else}
            <div class="flex flex-col gap-1.5">
                <label
                    for="game-invite-game"
                    class="text-xs font-semibold uppercase tracking-wide text-discord-textMuted"
                >
                    {t("gameInvite.game")}
                </label>
                {#if games.length > 1}
                    <select
                        id="game-invite-game"
                        bind:value={pickedKey}
                        class="w-full rounded bg-discord-backgroundTertiary px-3 py-2 text-sm text-discord-textPrimary focus:outline-none focus:ring-2 focus:ring-discord-accent"
                    >
                        {#each games as g (g.key)}
                            <option value={g.key}>{g.name}</option>
                        {/each}
                    </select>
                {:else if selected}
                    <p class="text-sm text-discord-textPrimary">
                        {selected.name}
                    </p>
                {/if}
            </div>
        {/if}

        <div class="flex flex-col gap-1.5">
            <label
                for="game-invite-note"
                class="text-xs font-semibold uppercase tracking-wide text-discord-textMuted"
            >
                {t("gameInvite.note")}
            </label>
            <textarea
                id="game-invite-note"
                bind:value={note}
                rows="2"
                maxlength={GAME_INVITE_LIMITS.note}
                placeholder={t("gameInvite.notePlaceholder")}
                class="w-full resize-none rounded bg-discord-backgroundTertiary px-3 py-2 text-sm text-discord-textPrimary placeholder:text-discord-textMuted focus:outline-none focus:ring-2 focus:ring-discord-accent"
            ></textarea>
        </div>

        <div class="flex justify-end gap-2">
            <button
                type="button"
                onclick={closeGameInviteDialog}
                class="px-4 py-2 rounded text-sm text-discord-textMuted hover:text-discord-textPrimary transition-colors"
            >
                {t("common.cancel")}
            </button>
            <button
                type="button"
                onclick={send}
                disabled={!selected || sending}
                class="px-4 py-2 rounded bg-discord-accent hover:bg-discord-accentHover disabled:opacity-50 text-white text-sm font-semibold transition-colors"
            >
                {sending ? t("common.saving") : t("gameInvite.send")}
            </button>
        </div>
    </div>
</div>
