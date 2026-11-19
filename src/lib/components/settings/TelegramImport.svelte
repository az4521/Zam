<script lang="ts">
    import { t } from "$lib/i18n";
    import {
        createTelegramTransport,
        importTelegramStickerSet,
        TelegramApiError,
    } from "$lib/matrix/telegramImport";
    import { roomsState } from "$lib/stores/rooms.svelte";
    import { showErrorToast } from "$lib/stores/toasts.svelte";
    import { parseStickerSetName } from "$lib/utils/telegramSticker";
    import {
        chooseTelegramSource,
        shouldOfferOwnToken,
        telegramProxyConfig,
        TelegramProxyError,
    } from "$lib/utils/telegramProxy";

    interface Props {
        onImported?: () => void;
    }
    let { onImported }: Props = $props();

    // Build-time proxy settings. Null when the proxy is turned off.
    const proxy = telegramProxyConfig();

    let link = $state("");
    // Kept in component memory only: never stored, logged, or shown back.
    let token = $state("");
    // With no proxy configured the token is the only route, so open it.
    let tokenOpen = $state(proxy === null);
    let running = $state(false);
    let progress = $state<{ done: number; total: number } | null>(null);
    let message = $state("");
    let error = $state("");
    let controller: AbortController | null = null;

    const percent = $derived(
        progress && progress.total > 0
            ? Math.round((progress.done / progress.total) * 100)
            : 0,
    );

    /** Proxy unreachable or key rejected: say so and offer the own-token path. */
    function offerOwnToken() {
        const failure = t("telegramImport.proxyUnavailable");
        error = failure;
        tokenOpen = true;
        showErrorToast(failure);
    }

    async function run() {
        error = "";
        message = "";
        const setName = parseStickerSetName(link);
        if (!setName) {
            error = t("telegramImport.invalidLink");
            return;
        }
        const source = chooseTelegramSource(token, proxy);
        if (!source) {
            error = t("telegramImport.tokenRequired");
            tokenOpen = true;
            return;
        }

        running = true;
        progress = null;
        const abort = new AbortController();
        controller = abort;
        try {
            const result = await importTelegramStickerSet({
                transport: createTelegramTransport(source),
                setName,
                signal: abort.signal,
                onProgress: (next) => {
                    progress = next;
                },
            });
            if (
                shouldOfferOwnToken({
                    mode: source.mode,
                    proxyFailed: result.proxyFailed,
                    imported: result.imported,
                    cancelled: result.cancelled,
                })
            ) {
                offerOwnToken();
                return;
            }
            if (result.total === 0) {
                message = t("telegramImport.empty");
            } else if (result.cancelled) {
                message = t("telegramImport.cancelled", {
                    imported: result.imported,
                    total: result.total,
                });
            } else if (result.failed > 0) {
                message = t("telegramImport.doneWithFailures", {
                    imported: result.imported,
                    total: result.total,
                    failed: result.failed,
                    title: result.title,
                });
            } else {
                message = t("telegramImport.done", {
                    imported: result.imported,
                    total: result.total,
                    title: result.title,
                });
            }
            if (result.imported > 0) {
                roomsState.roomsTick++;
                onImported?.();
            }
        } catch (err) {
            if (
                err instanceof TelegramProxyError &&
                shouldOfferOwnToken({
                    mode: source.mode,
                    proxyFailed: true,
                    imported: 0,
                    cancelled: abort.signal.aborted,
                })
            ) {
                offerOwnToken();
                return;
            }
            const failure =
                err instanceof TelegramApiError
                    ? t("telegramImport.failed", { message: err.description })
                    : t("telegramImport.failedGeneric");
            error = failure;
            showErrorToast(failure);
        } finally {
            running = false;
            progress = null;
            controller = null;
        }
    }

    function cancel() {
        controller?.abort();
    }

    // Stop an in-flight import when the settings panel goes away.
    $effect(() => () => controller?.abort());
</script>

<section class="space-y-2 pt-2 border-t border-zam-backgroundTertiary">
    <h3
        class="text-xs font-semibold text-zam-textMuted uppercase tracking-wide"
    >
        {t("telegramImport.title")}
    </h3>
    <label class="block text-xs text-zam-textMuted" for="telegram-import-link"
        >{t("telegramImport.linkLabel")}</label
    >
    <input
        id="telegram-import-link"
        bind:value={link}
        disabled={running}
        placeholder={t("telegramImport.linkPlaceholder")}
        autocomplete="off"
        spellcheck="false"
        class="w-full bg-zam-backgroundTertiary text-zam-textPrimary text-sm px-3 py-2 rounded outline-none border border-transparent focus:border-zam-accent/50"
    />

    <details
        class="space-y-2"
        open={tokenOpen}
        ontoggle={(event) => {
            tokenOpen = event.currentTarget.open;
        }}
    >
        <summary
            class="cursor-pointer text-xs text-zam-textMuted hover:text-zam-textPrimary"
            >{t("telegramImport.useOwnToken")}</summary
        >
        <div class="space-y-2 pt-2">
            <label
                class="block text-xs text-zam-textMuted"
                for="telegram-import-token"
                >{t("telegramImport.tokenLabel")}</label
            >
            <input
                id="telegram-import-token"
                type="password"
                bind:value={token}
                disabled={running}
                placeholder={t("telegramImport.tokenPlaceholder")}
                autocomplete="off"
                spellcheck="false"
                class="w-full bg-zam-backgroundTertiary text-zam-textPrimary text-sm px-3 py-2 rounded outline-none border border-transparent focus:border-zam-accent/50"
            />
            <p class="text-xs text-zam-textMuted">
                {t("telegramImport.tokenHelp")}
            </p>
        </div>
    </details>

    <div class="flex items-center gap-2">
        <button
            type="button"
            onclick={run}
            disabled={running}
            class="px-3 py-2 rounded bg-zam-accent text-white text-sm font-semibold disabled:opacity-50"
        >
            {running
                ? t("telegramImport.importing")
                : t("telegramImport.import")}
        </button>
        {#if running}
            <button
                type="button"
                onclick={cancel}
                class="px-3 py-2 rounded text-sm text-zam-textMuted hover:text-zam-textPrimary hover:bg-zam-messageHover"
            >
                {t("common.cancel")}
            </button>
        {/if}
    </div>

    {#if progress}
        <div
            class="h-2 rounded bg-zam-backgroundTertiary overflow-hidden"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax={progress.total}
            aria-valuenow={progress.done}
        >
            <div class="h-full bg-zam-accent" style="width: {percent}%"></div>
        </div>
        <p class="text-xs text-zam-textMuted">
            {t("telegramImport.progress", {
                done: progress.done,
                total: progress.total,
            })}
        </p>
    {/if}

    {#if error}<p class="text-sm text-zam-danger">{error}</p>{/if}
    {#if message}<p class="text-sm text-zam-textPrimary">{message}</p>{/if}
</section>
