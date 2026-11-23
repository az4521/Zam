<script lang="ts">
    // Live view of the background key-backup restore (keyRestoreState).
    // Renders nothing when no restore is running or has just finished.
    import { t } from "$lib/i18n";
    import { keyRestoreState } from "$lib/stores/keyRestore.svelte";
    import {
        restoreProgressView,
        restoreResultLabel,
    } from "$lib/utils/keyBackup";

    const view = $derived(restoreProgressView(keyRestoreState.progress));
</script>

{#if keyRestoreState.running}
    <div class="space-y-1.5" role="status">
        <p class="text-xs text-zam-textMuted">{view.label}</p>
        <div
            class="h-1.5 w-full rounded bg-zam-backgroundTertiary overflow-hidden"
        >
            <div
                class="h-full bg-zam-accent transition-all"
                style="width: {view.percent ?? 15}%"
            ></div>
        </div>
        <p class="text-xs text-zam-textMuted">
            {t("keyBackup.restoringInBackground")}
        </p>
    </div>
{:else if keyRestoreState.result}
    <p class="text-xs text-zam-textMuted">
        {restoreResultLabel(keyRestoreState.result)}.
    </p>
{/if}
