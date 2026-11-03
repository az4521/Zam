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
        linkDeviceByShowingQr,
        linkDeviceByUserCode,
        type NewDeviceInfo,
    } from "$lib/matrix/qrLogin";
    import { checkCodeMatches } from "$lib/matrix/qrLoginRendezvous";
    import QrCodeImage from "$lib/components/ui/QrCodeImage.svelte";

    let {
        onClose,
        mode = "scan",
    }: { onClose: () => void; mode?: "scan" | "code" | "show" } = $props();

    type ScannerComponent =
        (typeof import("$lib/components/ui/QrScanner.svelte"))["default"];

    let step = $state<
        "scan" | "show" | "number" | "approve" | "choose" | "done"
    >("scan");
    let candidates = $state<NewDeviceInfo[]>([]);
    let pickDevice: ((id: string | null) => void) | null = null;
    let shownCode = $state<Uint8ClampedArray | null>(null);
    let typedNumber = $state("");
    let answerNumber: ((ok: boolean) => void) | null = null;
    let expectedNumber = "";
    let typedCode = $state("");
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
        if (mode === "code") return () => abort.abort();
        if (mode === "show") {
            void startShowing();
            return () => abort.abort();
        }
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

    async function startShowing() {
        const client = getClient();
        if (!client) return;
        error = "";
        typedNumber = "";
        shownCode = null;
        abort = new AbortController();
        step = "show";
        try {
            await linkDeviceByShowingQr({
                client,
                signal: abort.signal,
                onCode: (bytes) => (shownCode = bytes),
                onScanned: () => (step = "number"),
                askCheckCode: (expected) =>
                    new Promise<boolean>((resolve) => {
                        expectedNumber = expected;
                        answerNumber = resolve;
                    }),
                onApprovalUrl: (url) => {
                    approvalUrl = url;
                    step = "approve";
                },
            });
            verifying = true;
            step = "done";
        } catch (err) {
            if (abort.signal.aborted) return;
            console.warn("[qr-login] show-code link failed", err);
            error =
                err instanceof QrLoginError ? err.message : t("qrLogin.failed");
            approvalUrl = "";
            // A fresh code is one tap away.
            step = "show";
            shownCode = null;
        }
    }

    function submitNumber(event: SubmitEvent) {
        event.preventDefault();
        if (!answerNumber) return;
        const ok = checkCodeMatches(expectedNumber, typedNumber);
        const resolve = answerNumber;
        answerNumber = null;
        resolve(ok);
    }

    async function onSubmitCode(event: SubmitEvent) {
        event.preventDefault();
        const client = getClient();
        if (!client) return;
        error = "";
        abort = new AbortController();
        step = "approve";
        try {
            verifying = await linkDeviceByUserCode({
                client,
                code: typedCode,
                signal: abort.signal,
                onApprovalUrl: (url) => (approvalUrl = url),
                chooseDevice: (devices) =>
                    new Promise<string | null>((resolve) => {
                        candidates = devices;
                        pickDevice = resolve;
                        step = "choose";
                    }),
            });
            step = "done";
        } catch (err) {
            if (abort.signal.aborted) return;
            console.warn("[qr-login] code link failed", err);
            error =
                err instanceof QrLoginError ? err.message : t("qrLogin.failed");
            approvalUrl = "";
            step = "scan";
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
        {mode === "code"
            ? t("qrLogin.codeTitle")
            : mode === "show"
              ? t("qrLogin.showTitle")
              : t("qrLogin.linkTitle")}
    </h2>

    {#if step === "show"}
        <p class="mt-3 text-sm text-discord-textSecondary">
            {t("qrLogin.showIntro")}
        </p>
        <p class="mt-2 text-xs text-discord-textMuted">
            {t("qrLogin.linkWarning")}
        </p>
        <div class="mt-4 flex justify-center">
            {#if shownCode}
                <div class="w-52 h-52">
                    <QrCodeImage
                        bytes={shownCode}
                        label={t("qrLogin.showCodeAlt")}
                    />
                </div>
            {:else if error}
                <button
                    type="button"
                    onclick={startShowing}
                    class="px-3 py-2 bg-discord-accent hover:bg-discord-accentHover text-white font-semibold rounded text-sm"
                >
                    {t("qrLogin.showRetry")}
                </button>
            {:else}
                <Loader2 size={28} class="animate-spin text-discord-accent" />
            {/if}
        </div>
    {:else if step === "number"}
        <form onsubmit={submitNumber} class="mt-3 flex flex-col gap-3">
            <p class="text-sm text-discord-textSecondary">
                {t("qrLogin.showEnterNumber")}
            </p>
            <label class="text-xs text-discord-textMuted" for="show-number">
                {t("qrLogin.numberLabel")}
            </label>
            <!-- svelte-ignore a11y_autofocus -->
            <input
                id="show-number"
                bind:value={typedNumber}
                inputmode="numeric"
                autocomplete="off"
                maxlength="2"
                autofocus
                class="w-24 px-3 py-2 text-lg tracking-widest text-center bg-discord-backgroundTertiary text-discord-textPrimary rounded border border-discord-divider focus:border-discord-accent focus:outline-none"
            />
            <button
                type="submit"
                disabled={typedNumber.trim().length === 0}
                class="py-2 bg-discord-accent hover:bg-discord-accentHover text-white font-semibold rounded text-sm disabled:opacity-60"
            >
                {t("qrLogin.confirm")}
            </button>
        </form>
    {/if}

    {#if step === "choose"}
        <p class="mt-3 text-sm text-discord-textSecondary">
            {t("qrLogin.chooseIntro")}
        </p>
        <ul class="mt-3 space-y-2">
            {#each candidates as device (device.deviceId)}
                <li>
                    <button
                        type="button"
                        onclick={() => {
                            pickDevice?.(device.deviceId);
                            pickDevice = null;
                            step = "approve";
                        }}
                        class="w-full text-start px-3 py-2 rounded bg-discord-backgroundTertiary hover:bg-discord-messageHover text-sm text-discord-textPrimary"
                    >
                        <span class="block font-medium"
                            >{device.displayName || device.deviceId}</span
                        >
                        <span class="block text-xs text-discord-textMuted"
                            >{device.deviceId}{device.lastSeenIp
                                ? ` · ${device.lastSeenIp}`
                                : ""}</span
                        >
                    </button>
                </li>
            {/each}
        </ul>
    {:else if step === "show" || step === "number"}
        <!-- shown above -->
    {:else if step === "scan" && mode === "code"}
        <form onsubmit={onSubmitCode} class="mt-3 flex flex-col gap-3">
            <p class="text-sm text-discord-textSecondary">
                {t("qrLogin.codeIntro")}
            </p>
            <p class="text-xs text-discord-textMuted">
                {t("qrLogin.linkWarning")}
            </p>
            <label class="text-xs text-discord-textMuted" for="link-user-code">
                {t("qrLogin.codeLabel")}
            </label>
            <!-- svelte-ignore a11y_autofocus -->
            <input
                id="link-user-code"
                bind:value={typedCode}
                autofocus
                autocomplete="off"
                autocapitalize="characters"
                spellcheck="false"
                class="w-full bg-discord-backgroundTertiary text-discord-textPrimary text-center text-xl tracking-widest uppercase rounded px-3 py-2 outline-none border border-transparent focus:border-discord-accent/50"
            />
            <button
                type="submit"
                disabled={!typedCode.trim()}
                class="w-full py-2 bg-discord-accent hover:bg-discord-accentHover text-white font-semibold rounded text-sm disabled:opacity-50"
            >
                {t("qrLogin.codeContinue")}
            </button>
        </form>
    {:else if step === "scan"}
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
                data-in-app
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
