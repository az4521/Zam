<script lang="ts">
    import { t } from "$lib/i18n";
    import { onMount } from "svelte";
    import { CheckCircle2, Loader2 } from "lucide-svelte";
    import ModalDialog from "$lib/components/ui/ModalDialog.svelte";
    import { getClient } from "$lib/matrix/runtime";
    import {
        QrLoginError,
        isQrLoginPayload,
        linkDevice,
    } from "$lib/matrix/qrLogin";

    let { onClose }: { onClose: () => void } = $props();

    type ScannerComponent =
        (typeof import("$lib/components/ui/QrScanner.svelte"))["default"];

    let step = $state<"scan" | "approve" | "done">("scan");
    let verifying = $state(true);
    let Scanner = $state.raw<ScannerComponent | null>(null);
    let approvalUrl = $state("");
    // MSC4108 only: the number the new device asks for.
    let checkCode = $state("");
    let error = $state("");
    let attempt = $state(0);
    let abort = new AbortController();

    const approvalHost = $derived.by(() => {
        try {
            return new URL(approvalUrl).host;
        } catch {
            return "";
        }
    });

    onMount(() => {
        void import("$lib/components/ui/QrScanner.svelte").then(
            (m) => (Scanner = m.default),
            () => (error = t("qrScanner.couldNotOpenTheCameraA")),
        );
        return () => abort.abort();
    });

    async function onScan(bytes: Uint8ClampedArray) {
        const client = getClient();
        if (!client) return;
        error = "";
        abort = new AbortController();
        step = "approve";
        try {
            await linkDevice({
                client,
                bytes,
                signal: abort.signal,
                onCheckCode: (code) => (checkCode = code),
                onApprovalUrl: (url) => (approvalUrl = url),
                onDone: (started) => {
                    verifying = started;
                    step = "done";
                },
            });
        } catch (err) {
            if (abort.signal.aborted) return;
            console.warn("[qr-login] link failed", err);
            error =
                err instanceof QrLoginError ? err.message : t("qrLogin.failed");
            approvalUrl = "";
            checkCode = "";
            step = "scan";
            attempt++;
        }
    }

    function close() {
        abort.abort();
        onClose();
    }
</script>

<ModalDialog
    onClose={close}
    labelledBy="qr-link-title"
    panelClass="relative z-10 w-[min(92vw,26rem)] rounded-lg bg-discord-backgroundSecondary border border-discord-divider p-5 shadow-xl"
>
    <h2
        id="qr-link-title"
        class="text-lg font-semibold text-discord-textPrimary"
    >
        {t("qrLogin.linkTitle")}
    </h2>

    {#if step === "scan"}
        <p class="mt-3 text-sm text-discord-textSecondary">
            {t("qrLogin.linkIntro")}
        </p>
        <p class="mt-2 text-xs text-discord-textMuted">
            {t("qrLogin.linkWarning")}
        </p>
        <div class="mt-4 flex flex-col items-center gap-2">
            {#key attempt}
                {#if Scanner}
                    <Scanner
                        {onScan}
                        accept={isQrLoginPayload}
                        onError={(message) => (error = message)}
                    />
                {:else if !error}
                    <Loader2
                        size={28}
                        class="animate-spin text-discord-accent"
                    />
                {/if}
            {/key}
        </div>
    {:else if step === "approve"}
        {#if checkCode}
            <p class="mt-3 text-sm text-discord-textSecondary">
                {t("qrLogin.linkShowNumber")}
            </p>
            <p
                class="mt-2 text-center text-4xl font-semibold tracking-widest text-discord-textPrimary"
                aria-live="polite"
            >
                {checkCode}
            </p>
        {/if}
        <p class="mt-3 text-sm text-discord-textSecondary">
            {t("qrLogin.linkApprove", { host: approvalHost })}
        </p>
        {#if approvalUrl}
            <a
                href={approvalUrl}
                target="_blank"
                rel="noopener noreferrer"
                class="mt-3 block w-full py-2 text-center bg-discord-accent hover:bg-discord-accentHover text-white font-semibold rounded text-sm"
            >
                {t("qrLogin.linkApproveButton", { host: approvalHost })}
            </a>
            <div
                class="mt-4 flex items-center justify-center gap-2 text-xs text-discord-textMuted"
            >
                <Loader2 size={16} class="animate-spin text-discord-accent" />
                {t("qrLogin.linkWaiting")}
            </div>
        {:else}
            <div class="mt-4 flex justify-center">
                <Loader2 size={24} class="animate-spin text-discord-accent" />
            </div>
        {/if}
    {:else}
        <div class="mt-5 flex flex-col items-center gap-2 text-center">
            <CheckCircle2 size={40} class="text-discord-accent" />
            <p class="text-sm text-discord-textPrimary">
                {checkCode
                    ? t("qrLogin.linkDoneVerified")
                    : verifying
                      ? t("qrLogin.linkDone")
                      : t("qrLogin.linkDoneUnverified")}
            </p>
        </div>
    {/if}

    {#if error}
        <p class="mt-3 text-sm text-discord-danger" role="alert">{error}</p>
    {/if}

    <button
        type="button"
        onclick={close}
        class="mt-5 w-full py-2 rounded bg-discord-backgroundTertiary hover:bg-discord-messageHover text-discord-textPrimary text-sm"
    >
        {step === "done" ? t("qrLogin.linkClose") : t("qrLogin.cancel")}
    </button>
</ModalDialog>
