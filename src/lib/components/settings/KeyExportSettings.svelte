<script lang="ts">
    import { t } from "$lib/i18n";
    // Export / import room keys as a passphrase-encrypted key file (the format
    // Element and other clients use; see utils/keyExportFile). Lives under
    // Security & Encryption, next to key backup, which covers the same ground
    // server-side.
    import {
        exportRoomKeysToFile,
        importRoomKeysFromFile,
    } from "$lib/matrix/crypto";
    import { KeyExportFileError } from "$lib/utils/keyExportFile";
    import {
        restoreProgressView,
        restoreResultLabel,
        type RestoreProgress,
    } from "$lib/utils/keyBackup";
    import { saveObjectUrl, revokeLater } from "$lib/utils/saveFile";

    const inputClass =
        "w-full rounded bg-discord-backgroundSecondary px-3 py-2 text-sm text-discord-textPrimary outline-none focus:ring-2 focus:ring-discord-accent";
    const buttonClass =
        "px-3 py-1.5 rounded text-sm font-medium bg-discord-accent hover:bg-discord-accentHover text-white transition-colors disabled:opacity-50";

    // ── Export ──
    let exportPass = $state("");
    let exportConfirm = $state("");
    let exporting = $state(false);
    let exportError = $state("");
    let exportDone = $state("");
    const mismatch = $derived(
        exportConfirm.length > 0 && exportPass !== exportConfirm,
    );

    async function doExport() {
        if (exporting || !exportPass || exportPass !== exportConfirm) return;
        exporting = true;
        exportError = "";
        exportDone = "";
        try {
            const { file, count } = await exportRoomKeysToFile(exportPass);
            const url = URL.createObjectURL(
                new Blob([file], { type: "text/plain" }),
            );
            const day = new Date().toISOString().slice(0, 10);
            await saveObjectUrl(url, `zam-keys-${day}.txt`);
            revokeLater(url);
            exportDone = t("keyExportSettings.exported", { count });
            exportPass = "";
            exportConfirm = "";
        } catch (err) {
            console.error("Key export failed:", err);
            exportError = t("keyExportSettings.couldNotExportYourKeys");
        } finally {
            exporting = false;
        }
    }

    // ── Import ──
    let importFile = $state<File | null>(null);
    let importPass = $state("");
    let importing = $state(false);
    let importError = $state("");
    let importDone = $state("");
    let progress = $state<RestoreProgress | null>(null);
    const progressView = $derived(restoreProgressView(progress));

    function importErrorMessage(err: unknown): string {
        if (err instanceof KeyExportFileError) {
            if (err.reason === "passphrase")
                return t("keyExportSettings.wrongPassphrase");
            if (err.reason === "version")
                return t("keyExportSettings.newerFormat");
            return t("keyExportSettings.notAKeyFile");
        }
        return t("keyExportSettings.couldNotImportTheKeys");
    }

    async function doImport() {
        if (importing || !importFile || !importPass) return;
        importing = true;
        importError = "";
        importDone = "";
        progress = null;
        let last: RestoreProgress | null = null;
        try {
            const text = await importFile.text();
            await importRoomKeysFromFile(text, importPass, (p) => {
                progress = p;
                last = p;
            });
            const done = last as RestoreProgress | null;
            importDone =
                done && done.stage === "load_keys"
                    ? restoreResultLabel({
                          total: done.total,
                          imported: done.successes,
                      })
                    : restoreResultLabel({ total: 0, imported: 0 });
            importPass = "";
        } catch (err) {
            console.error("Key import failed:", err);
            importError = importErrorMessage(err);
        } finally {
            importing = false;
            progress = null;
        }
    }
</script>

<section class="rounded bg-discord-backgroundTertiary px-4 py-4 space-y-4">
    <div>
        <p class="text-sm font-medium text-discord-textPrimary">
            {t("keyExportSettings.exportOrImportRoomKeys")}
        </p>
        <p class="text-xs text-discord-textMuted mt-1">
            {t("keyExportSettings.aKeyFileLetsAnotherApp")}
        </p>
    </div>

    <form
        class="space-y-2"
        onsubmit={(e) => {
            e.preventDefault();
            doExport();
        }}
    >
        <p
            class="text-xs font-bold uppercase text-discord-textSecondary tracking-wide"
        >
            {t("keyExportSettings.export")}
        </p>
        <input
            type="password"
            bind:value={exportPass}
            autocomplete="new-password"
            placeholder={t("keyExportSettings.passphrase")}
            aria-label={t("keyExportSettings.passphrase")}
            class={inputClass}
        />
        <input
            type="password"
            bind:value={exportConfirm}
            autocomplete="new-password"
            placeholder={t("keyExportSettings.confirmPassphrase")}
            aria-label={t("keyExportSettings.confirmPassphrase")}
            class={inputClass}
        />
        {#if mismatch}
            <p class="text-xs text-discord-danger">
                {t("keyExportSettings.passphrasesDontMatch")}
            </p>
        {/if}
        <button
            type="submit"
            disabled={exporting || !exportPass || exportPass !== exportConfirm}
            class={buttonClass}
        >
            {exporting
                ? t("keyExportSettings.exporting")
                : t("keyExportSettings.exportKeys")}
        </button>
        {#if exportDone}
            <p class="text-sm text-discord-online" role="status">
                {exportDone}
            </p>
        {/if}
        {#if exportError}
            <p class="text-sm text-discord-danger" role="alert">
                {exportError}
            </p>
        {/if}
    </form>

    <form
        class="space-y-2"
        onsubmit={(e) => {
            e.preventDefault();
            doImport();
        }}
    >
        <p
            class="text-xs font-bold uppercase text-discord-textSecondary tracking-wide"
        >
            {t("keyExportSettings.import")}
        </p>
        <input
            type="file"
            accept=".txt,text/plain"
            aria-label={t("keyExportSettings.keyFile")}
            onchange={(e) => {
                importFile = e.currentTarget.files?.[0] ?? null;
                importError = "";
                importDone = "";
            }}
            class="block w-full text-sm text-discord-textMuted file:me-3 file:rounded file:border-0 file:bg-discord-messageHover file:px-3 file:py-1.5 file:text-sm file:text-discord-textPrimary"
        />
        <input
            type="password"
            bind:value={importPass}
            autocomplete="off"
            placeholder={t("keyExportSettings.passphrase")}
            aria-label={t("keyExportSettings.passphrase")}
            class={inputClass}
        />
        <button
            type="submit"
            disabled={importing || !importFile || !importPass}
            class={buttonClass}
        >
            {importing ? progressView.label : t("keyExportSettings.importKeys")}
        </button>
        {#if importing && progressView.percent !== null}
            <div
                class="h-1.5 w-full rounded bg-discord-backgroundSecondary overflow-hidden"
            >
                <div
                    class="h-full bg-discord-accent transition-[width]"
                    style="width: {progressView.percent}%"
                ></div>
            </div>
        {/if}
        {#if importDone}
            <p class="text-sm text-discord-online" role="status">
                {importDone}
            </p>
        {/if}
        {#if importError}
            <p class="text-sm text-discord-danger" role="alert">
                {importError}
            </p>
        {/if}
    </form>
</section>
