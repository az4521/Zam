<script lang="ts">
    import { t } from "$lib/i18n";
    import { onMount } from "svelte";
    import { Loader2 } from "lucide-svelte";
    import type { ValidatedAuthMetadata } from "matrix-js-sdk";
    import ModalDialog from "$lib/components/ui/ModalDialog.svelte";
    import QrCodeImage from "$lib/components/ui/QrCodeImage.svelte";
    import {
        QrLoginError,
        signInWithQr,
        type QrSignInResult,
    } from "$lib/matrix/qrLogin";
    import { checkCodeMatches } from "$lib/matrix/qrLoginRendezvous";

    let {
        baseUrl,
        metadata,
        slidingSync,
        onSignedIn,
        onClose,
    }: {
        baseUrl: string;
        metadata: ValidatedAuthMetadata;
        slidingSync: boolean;
        onSignedIn: (result: QrSignInResult) => void | Promise<void>;
        onClose: () => void;
    } = $props();

    let step = $state<
        "preparing" | "code" | "number" | "approval" | "finishing"
    >("preparing");
    let code = $state<Uint8ClampedArray | null>(null);
    // Device-code sign-in only: the approval page asks about this code.
    let userCode = $state("");
    let error = $state("");
    let typed = $state("");
    let answer: ((ok: boolean) => void) | null = null;
    let expectedCode = "";
    const abort = new AbortController();

    function submitNumber(event: SubmitEvent) {
        event.preventDefault();
        if (!answer) return;
        const ok = checkCodeMatches(expectedCode, typed);
        const resolve = answer;
        answer = null;
        resolve(ok);
    }

    function close() {
        abort.abort();
        onClose();
    }

    onMount(() => {
        void (async () => {
            try {
                const result = await signInWithQr({
                    baseUrl,
                    metadata,
                    slidingSync,
                    signal: abort.signal,
                    onCode: (c) => {
                        code = c.payload;
                        userCode = c.userCode ?? "";
                        step = "code";
                    },
                    onScanned: () => (step = "number"),
                    askCheckCode: (expected) =>
                        new Promise<boolean>((resolve) => {
                            expectedCode = expected;
                            answer = resolve;
                        }),
                    onWaitingForApproval: () => (step = "approval"),
                });
                step = "finishing";
                await onSignedIn(result);
            } catch (err) {
                if (abort.signal.aborted) return;
                console.warn("[qr-login] sign-in failed", err);
                error =
                    err instanceof QrLoginError
                        ? err.message
                        : t("qrLogin.failed");
            }
        })();
        return () => abort.abort();
    });
</script>

<ModalDialog
    onClose={close}
    labelledBy="qr-signin-title"
    panelClass="relative z-10 w-[min(92vw,24rem)] rounded-lg bg-discord-backgroundSecondary border border-discord-divider p-5 shadow-xl"
>
    <h2
        id="qr-signin-title"
        class="text-lg font-semibold text-discord-textPrimary"
    >
        {t("qrLogin.signInTitle")}
    </h2>

    {#if error}
        <p class="mt-4 text-sm text-discord-danger" role="alert">{error}</p>
    {:else if step === "preparing"}
        <div class="mt-5 flex justify-center">
            <Loader2 size={28} class="animate-spin text-discord-accent" />
        </div>
        <p class="mt-2 text-center text-xs text-discord-textMuted">
            {t("qrLogin.preparing")}
        </p>
    {:else if step === "code" && code}
        <p class="mt-3 text-sm text-discord-textSecondary">
            {t("qrLogin.signInSteps")}
        </p>
        <div class="mt-4 flex justify-center">
            <div class="w-52 h-52">
                <QrCodeImage bytes={code} label={t("qrLogin.codeAlt")} />
            </div>
        </div>
        {#if userCode}
            <p class="mt-3 text-center text-xs text-discord-textMuted">
                {t("qrLogin.matchCode")}
            </p>
            <p
                class="text-center text-2xl font-semibold tracking-widest text-discord-textPrimary"
            >
                {userCode}
            </p>
        {/if}
    {:else if step === "number"}
        <form onsubmit={submitNumber} class="mt-3 flex flex-col gap-3">
            <p class="text-sm text-discord-textSecondary">
                {t("qrLogin.enterNumber")}
            </p>
            <label class="text-xs text-discord-textMuted" for="qr-number">
                {t("qrLogin.numberLabel")}
            </label>
            <!-- svelte-ignore a11y_autofocus -->
            <input
                id="qr-number"
                bind:value={typed}
                inputmode="numeric"
                autocomplete="off"
                maxlength="2"
                autofocus
                class="w-24 px-3 py-2 text-lg tracking-widest text-center bg-discord-backgroundTertiary text-discord-textPrimary rounded border border-discord-divider focus:border-discord-accent focus:outline-none"
            />
            <button
                type="submit"
                disabled={typed.trim().length === 0}
                class="py-2 bg-discord-accent hover:bg-discord-accentHover text-white font-semibold rounded text-sm disabled:opacity-60"
            >
                {t("qrLogin.confirm")}
            </button>
        </form>
    {:else if step === "approval"}
        <div class="mt-5 flex justify-center">
            <Loader2 size={28} class="animate-spin text-discord-accent" />
        </div>
        <p class="mt-2 text-center text-sm text-discord-textSecondary">
            {t("qrLogin.waitingApproval")}
        </p>
    {:else}
        <div class="mt-5 flex justify-center">
            <Loader2 size={28} class="animate-spin text-discord-accent" />
        </div>
        <p class="mt-2 text-center text-sm text-discord-textSecondary">
            {t("qrLogin.signingIn")}
        </p>
    {/if}

    <button
        type="button"
        onclick={close}
        class="mt-5 w-full py-2 rounded bg-discord-backgroundTertiary hover:bg-discord-messageHover text-discord-textPrimary text-sm"
    >
        {t("qrLogin.cancel")}
    </button>
</ModalDialog>
