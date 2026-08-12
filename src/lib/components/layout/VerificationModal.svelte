<script lang="ts">
    import {
        ShieldCheck,
        ShieldAlert,
        Loader2,
        QrCode,
        Camera,
        ArrowLeft,
    } from "lucide-svelte";
    import {
        verificationState,
        closeActive,
    } from "$lib/stores/verification.svelte";
    import {
        verificationPhaseKind,
        verificationPhaseLabel,
        formatSasEmojis,
        sasEmojiRows,
    } from "$lib/utils/verification";
    import { NO_METHOD_OPTIONS } from "$lib/utils/qrVerification";
    import QrCodeImage from "$lib/components/ui/QrCodeImage.svelte";
    import { focusTrap } from "$lib/actions/focusTrap";

    // The active controller mutates in place, so every read hangs off the tick.
    const view = $derived(
        (void verificationState.verificationTick,
        verificationState.active?.view() ?? null),
    );
    const kind = $derived(view ? verificationPhaseKind(view.phase) : "pending");
    const isSelf = $derived(view?.isSelfVerification ?? false);
    const statusLabel = $derived(
        view ? verificationPhaseLabel(view.phase, { isSelf }) : "",
    );
    const emojiRows = $derived(
        view?.sasEmoji ? sasEmojiRows(formatSasEmojis(view.sasEmoji)) : [],
    );
    // Read through $derived only — `NO_METHOD_OPTIONS` is frozen and returned by
    // identity, so wrapping this in `$state()` would throw on the first write.
    const methods = $derived(view?.methodOptions ?? NO_METHOD_OPTIONS);
    // A lone "compare emoji" button is not a choice: when neither side can do QR
    // the controller starts SAS by itself, so stay on the spinner and let it —
    // an SAS-only peer must still land on the emoji compare with zero extra taps.
    const showChooser = $derived(
        !methods.shouldAutoStartSas &&
            (methods.canShowQr || methods.canScanQr || methods.canSas),
    );
    // Our `.start` is on the wire but no verifier is hooked yet. The phase is
    // still `Ready` so `methodOptions` still offers everything, but a second tap
    // is swallowed by the controller's latch — disable rather than look dead.
    const startPending = $derived(view?.startPending ?? false);
    const title = $derived(
        isSelf
            ? "Verify your other session"
            : `Verify ${view?.otherUserId ?? "user"}`,
    );

    // Local UX state: reset whenever the modal retargets to a new flow.
    let confirmed = $state(false);
    let busy = $state(false);
    let errorMsg = $state<string | null>(null);
    // Which QR pane the user opened. Reset with the rest of the local state
    // whenever the modal retargets to a different flow.
    let pane = $state<"choose" | "show" | "scan">("choose");
    // Bumped to force a fresh QrScanner instance — see the scan pane.
    let attempt = $state(0);
    $effect(() => {
        void verificationState.active?.id;
        confirmed = false;
        busy = false;
        errorMsg = null;
        pane = "choose";
        attempt = 0;
    });

    // One alert line for the whole modal. `qrError` is NOT QR-specific — the
    // controller writes SAS-start failures into it too — so it has to be visible
    // from every pane, not just the QR ones.
    const alertMsg = $derived(errorMsg ?? view?.qrError ?? null);

    // The scanner pulls in the jsQR decoder (~480 KB unminified), so it is only
    // fetched once the user actually opens the camera pane. Kept out of the
    // static import graph on purpose; `QrCodeImage` is small and stays static.
    type QrScannerComponent =
        (typeof import("$lib/components/ui/QrScanner.svelte"))["default"];
    let Scanner = $state.raw<QrScannerComponent | null>(null);
    let scannerLoadFailed = $state(false);

    async function match() {
        if (busy) return;
        busy = true;
        errorMsg = null;
        try {
            await verificationState.active?.confirm();
            confirmed = true;
        } catch (e) {
            errorMsg =
                e instanceof Error ? e.message : "Could not confirm the match";
        } finally {
            busy = false;
        }
    }

    async function noMatch() {
        if (busy) return;
        busy = true;
        errorMsg = null;
        try {
            verificationState.active?.mismatch();
            confirmed = true;
        } catch (e) {
            errorMsg =
                e instanceof Error
                    ? e.message
                    : "Could not report the mismatch";
        } finally {
            busy = false;
        }
    }

    async function openShowQr() {
        errorMsg = null;
        pane = "show";
        await verificationState.active?.showQrCode();
    }

    async function openScanQr() {
        errorMsg = null;
        pane = "scan";
        if (Scanner) return;
        scannerLoadFailed = false;
        try {
            Scanner = (await import("$lib/components/ui/QrScanner.svelte"))
                .default;
        } catch (e) {
            console.warn("[matrix] could not load the QR scanner", e);
            scannerLoadFailed = true;
        }
    }

    async function chooseSas() {
        if (busy) return;
        busy = true;
        errorMsg = null;
        try {
            await verificationState.active?.startSas();
        } finally {
            busy = false;
        }
    }

    async function onScanned(bytes: Uint8ClampedArray) {
        await verificationState.active?.submitScannedQr(bytes);
    }

    function onScanError(message: string) {
        errorMsg = message;
    }

    function confirmScanned() {
        verificationState.active?.confirmReciprocate();
    }

    /**
     * Only ever reachable from the reciprocate prompt's "No": with no prompt up,
     * `denyReciprocate()` falls back to cancelling the ENTIRE verification, so it
     * must never double as a generic dismiss.
     */
    function denyScanned() {
        if (!view?.awaitingReciprocateConfirm) return;
        verificationState.active?.denyReciprocate();
    }
</script>

{#if view}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button
            type="button"
            aria-label="Close dialog"
            class="absolute inset-0 bg-black/50"
            onclick={closeActive}
        ></button>
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="verification-modal-title"
            class="relative z-10 w-full max-w-sm rounded-lg bg-discord-backgroundSecondary border border-discord-divider shadow-xl p-5"
            use:focusTrap={{ onEscape: closeActive }}
        >
            <h2
                id="verification-modal-title"
                class="text-base font-semibold text-discord-textPrimary"
            >
                {title}
            </h2>
            {#if view.otherDeviceId}
                <p class="mt-0.5 text-xs text-discord-textMuted font-mono">
                    {view.otherDeviceId}
                </p>
            {/if}

            {#if kind === "success"}
                <div class="mt-5 flex flex-col items-center text-center gap-2">
                    <ShieldCheck size={40} class="text-discord-online" />
                    <p class="text-sm font-medium text-discord-textPrimary">
                        {statusLabel}
                    </p>
                    <p class="text-xs text-discord-textMuted">
                        {isSelf
                            ? "This session is now trusted."
                            : "Their identity is now verified."}
                    </p>
                </div>
            {:else if kind === "cancelled"}
                <div class="mt-5 flex flex-col items-center text-center gap-2">
                    <ShieldAlert size={40} class="text-discord-danger" />
                    <p class="text-sm font-medium text-discord-textPrimary">
                        {statusLabel}
                    </p>
                    <p class="text-xs text-discord-textMuted">
                        No trust was established. You can start again anytime.
                    </p>
                </div>
            {:else if view.awaitingReciprocateConfirm}
                <!-- Outranks every other pane: the other side is blocked on this
                     answer, and answering it wrongly is the whole attack. The
                     copy must name the party who actually scanned — asking about
                     "your other device" when ANOTHER USER scanned invites the
                     worst possible reasoning ("I don't have one, so… yes?"). -->
                <div class="mt-5 flex flex-col items-center text-center gap-3">
                    <QrCode size={32} class="text-discord-accent" />
                    <!-- The prompt arrives asynchronously and the branch swap
                         drops focus, so announce it rather than leaving a
                         screen-reader user showing a code in silence. Neither
                         button is autofocused: this answer must be deliberate. -->
                    <p
                        class="text-sm text-discord-textPrimary"
                        aria-live="polite"
                    >
                        {isSelf
                            ? "Did your other session just scan this code?"
                            : `Did ${view.otherUserId} just scan this code?`}
                    </p>
                    <p class="text-xs text-discord-textMuted">
                        {isSelf
                            ? "Only confirm if you scanned it yourself, just now."
                            : "Only confirm if you watched them scan it, just now."}
                    </p>
                </div>
                <!-- "No" first in BOTH DOM and visual order. It is the SAFE
                     answer — it cancels a verification you can restart, while a
                     wrong "Yes" completes an attestation with an attacker — so
                     it takes the first tab stop, and matching orders keep focus
                     order and visual order in agreement (WCAG 2.4.3). -->
                <div class="mt-5 flex gap-2">
                    <button
                        onclick={denyScanned}
                        class="flex-1 px-3 py-2 rounded bg-discord-backgroundTertiary hover:bg-discord-danger/20 text-discord-danger text-sm font-semibold transition-colors"
                    >
                        No
                    </button>
                    <button
                        onclick={confirmScanned}
                        class="flex-1 px-3 py-2 rounded bg-discord-accent hover:bg-discord-accentHover text-white text-sm font-semibold transition-colors"
                    >
                        Yes, I scanned it
                    </button>
                </div>
            {:else if emojiRows.length > 0 && !confirmed}
                <p class="mt-4 text-xs text-discord-textMuted">
                    Confirm the same emoji appear, in the same order, on your
                    other {isSelf ? "session" : "device with this user"}.
                </p>
                <div class="mt-4 space-y-2">
                    {#each emojiRows as row, rowIndex (rowIndex)}
                        <div class="flex justify-center gap-2">
                            {#each row as emoji (emoji.symbol + emoji.name)}
                                <div
                                    class="flex w-16 flex-col items-center gap-1 rounded bg-discord-backgroundTertiary px-1 py-2"
                                >
                                    <span class="text-2xl leading-none"
                                        >{emoji.symbol}</span
                                    >
                                    <span
                                        class="text-[10px] capitalize text-discord-textMuted truncate max-w-full"
                                        >{emoji.name}</span
                                    >
                                </div>
                            {/each}
                        </div>
                    {/each}
                </div>
                <div class="mt-5 flex gap-2">
                    <button
                        onclick={noMatch}
                        disabled={busy}
                        class="flex-1 px-3 py-2 rounded bg-discord-backgroundTertiary hover:bg-discord-danger/20 text-discord-danger text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                        They don't match
                    </button>
                    <button
                        onclick={match}
                        disabled={busy}
                        class="flex-1 px-3 py-2 rounded bg-discord-accent hover:bg-discord-accentHover text-white text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                        {busy ? "Confirming…" : "They match"}
                    </button>
                </div>
            {:else if showChooser}
                {#if pane === "show"}
                    <div
                        class="mt-4 flex flex-col items-center text-center gap-3"
                    >
                        {#if view.qrBytes}
                            <QrCodeImage
                                bytes={view.qrBytes}
                                label={isSelf
                                    ? "Verification code for your other session"
                                    : `Verification code for ${view.otherUserId}`}
                            />
                            <p class="text-xs text-discord-textMuted">
                                {isSelf
                                    ? "Scan this with your other session."
                                    : "Ask them to scan this code."}
                            </p>
                        {:else if view.qrError}
                            <!-- The reason itself renders in the shared alert
                                 below; this only fills the empty pane. -->
                            <p class="text-xs text-discord-textMuted">
                                No code to show right now.
                            </p>
                        {:else}
                            <Loader2
                                size={28}
                                class="animate-spin text-discord-accent"
                            />
                        {/if}
                    </div>
                {:else if pane === "scan"}
                    <!-- Inside the {#if} on purpose: QrScanner latches after one
                         scan and cannot be reset in place, so leaving this pane
                         must DESTROY it. Re-entering mounts a fresh instance
                         (all its state is instance-scoped, and the camera grant
                         is remembered per origin, so no second prompt). -->
                    <div class="mt-4 flex flex-col items-center gap-2">
                        {#key attempt}
                            {#if Scanner}
                                <Scanner
                                    onScan={onScanned}
                                    onError={onScanError}
                                />
                            {:else if scannerLoadFailed}
                                <p
                                    class="text-xs text-discord-danger"
                                    role="alert"
                                >
                                    Could not load the scanner.
                                </p>
                            {:else}
                                <Loader2
                                    size={28}
                                    class="animate-spin text-discord-accent"
                                />
                            {/if}
                        {/key}
                        {#if view.qrError}
                            <!-- Bumping the key DESTROYS and recreates the
                                 scanner. It latches after one delivery and
                                 cannot be reset in place, so this is the only
                                 way to offer the same method again — the back
                                 link would send the user the long way round. -->
                            <button
                                onclick={() => attempt++}
                                class="px-3 py-1.5 rounded bg-discord-backgroundTertiary hover:bg-discord-messageHover text-discord-textPrimary text-xs transition-colors"
                            >
                                Scan again
                            </button>
                        {/if}
                    </div>
                {:else}
                    <p class="mt-4 text-xs text-discord-textMuted">
                        {startPending
                            ? "Starting…"
                            : "Pick how you'd like to verify."}
                    </p>
                    <div class="mt-4 flex flex-col gap-2">
                        {#if methods.canShowQr}
                            <button
                                onclick={openShowQr}
                                disabled={busy || startPending}
                                class="flex items-center gap-3 px-3 py-2 rounded bg-discord-backgroundTertiary hover:bg-discord-messageHover text-discord-textPrimary text-sm text-left transition-colors disabled:opacity-50"
                            >
                                <QrCode
                                    size={18}
                                    class="text-discord-textMuted shrink-0"
                                />
                                Show a code for the other side to scan
                            </button>
                        {/if}
                        {#if methods.canScanQr}
                            <button
                                onclick={openScanQr}
                                disabled={busy || startPending}
                                class="flex items-center gap-3 px-3 py-2 rounded bg-discord-backgroundTertiary hover:bg-discord-messageHover text-discord-textPrimary text-sm text-left transition-colors disabled:opacity-50"
                            >
                                <Camera
                                    size={18}
                                    class="text-discord-textMuted shrink-0"
                                />
                                Scan their code with the camera
                            </button>
                        {/if}
                        {#if methods.canSas}
                            <button
                                onclick={chooseSas}
                                disabled={busy || startPending}
                                class="flex items-center gap-3 px-3 py-2 rounded bg-discord-backgroundTertiary hover:bg-discord-messageHover text-discord-textPrimary text-sm text-left transition-colors disabled:opacity-50"
                            >
                                <ShieldCheck
                                    size={18}
                                    class="text-discord-textMuted shrink-0"
                                />
                                Compare emoji instead
                            </button>
                        {/if}
                    </div>
                {/if}
                {#if pane !== "choose"}
                    <button
                        onclick={() => (pane = "choose")}
                        class="mt-4 flex items-center gap-1.5 text-xs text-discord-textMuted hover:text-discord-textPrimary transition-colors"
                    >
                        <ArrowLeft size={14} />
                        Choose a different method
                    </button>
                {/if}
            {:else}
                <div class="mt-6 flex flex-col items-center text-center gap-3">
                    <Loader2
                        size={32}
                        class="animate-spin text-discord-accent"
                    />
                    <p class="text-sm text-discord-textSecondary">
                        {confirmed
                            ? "Waiting for the other side to confirm…"
                            : statusLabel}
                    </p>
                </div>
            {/if}

            {#if alertMsg}
                <p class="mt-3 text-xs text-discord-danger" role="alert">
                    {alertMsg}
                </p>
            {/if}

            <button
                onclick={closeActive}
                class="mt-5 w-full px-3 py-1.5 rounded bg-discord-backgroundTertiary hover:bg-discord-messageHover text-discord-textPrimary text-sm transition-colors"
            >
                {kind === "success" || kind === "cancelled"
                    ? "Close"
                    : "Cancel"}
            </button>
        </div>
    </div>
{/if}
