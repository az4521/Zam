<script lang="ts">
    import { t, getLocale, type MessageKey } from "$lib/i18n";
    import { untrack } from "svelte";
    import { auth } from "$lib/stores/auth.svelte";
    import { showToast } from "$lib/stores/toasts.svelte";
    import { effectiveApproval } from "$lib/stores/widgetPrompts.svelte";
    import {
        closeWidgetModal,
        setWidgetModalButtonEnabled,
        widgetModal,
        type OpenWidgetModal,
    } from "$lib/stores/widgetModal.svelte";
    import {
        currentWidgetTheme,
        navigateWidgetLink,
        templatedWidgetUrl,
    } from "$lib/stores/widgetBridge";
    import { mountWidget, type MountedWidget } from "$lib/matrix/widgetHost";
    import {
        describeCapability,
        isUnsafeWidgetUrl,
        type RoomWidget,
    } from "$lib/utils/widgets";
    import {
        modalCapabilityGrant,
        modalOpenIdGrant,
    } from "$lib/utils/widgetModal";
    import ModalDialog from "$lib/components/ui/ModalDialog.svelte";
    import Portal from "$lib/components/ui/Portal.svelte";

    // A modal widget (MSC2790) its opener WidgetFrame asked for. WidgetFrame
    // renders it while the "widget-modal" slot is ours, so it lives exactly as
    // long as the opener does. Escape, backdrop and back all dismiss it, which
    // settles as m.exited.
    interface Props {
        modal: OpenWidgetModal;
    }

    let { modal }: Props = $props();

    // The request and room are fixed for this modal's life (the parent keys
    // the dialog by token), so they are read once.
    const entry = untrack(() => modal);
    const req = entry.data;
    const roomId = entry.roomId;
    const opener = entry.opener;

    const modalWidget: RoomWidget = {
        id: `modal_${opener.id}`,
        stateType: opener.stateType,
        type: req.type,
        url: req.url,
        name: req.name ?? "",
        data: req.data ?? {},
        creatorUserId: opener.creatorUserId,
        senderId: opener.senderId,
        waitForIframeLoad: req.waitForIframeLoad ?? true,
        avatarUrl: null,
    };

    const url = templatedWidgetUrl(roomId, modalWidget);
    // Judge the request url and the url the frame loads, as WidgetFrame does.
    const unsafe =
        isUnsafeWidgetUrl(req.url, location.origin) ||
        (!!url && isUnsafeWidgetUrl(url, location.origin));

    let iframeEl = $state<HTMLIFrameElement | null>(null);
    let frameSrc = $state<string | null>(null);
    let handle = $state.raw<MountedWidget | null>(null);

    // Mounted only after the iframe exists, and src is set after mountWidget
    // so the widget's first request is answered (see WidgetFrame).
    $effect(() => {
        const el = iframeEl;
        if (!el || unsafe || !url) return;
        const u = url;
        const m = untrack(() =>
            mountWidget({
                iframe: el,
                widget: modalWidget,
                roomId,
                url: u,
                // No prompt: a modal gets at most what its opener holds.
                requestCapabilities: async (requested) =>
                    modalCapabilityGrant(
                        effectiveApproval(auth.userId, roomId, opener),
                        requested,
                    ),
                requestOpenId: async () =>
                    modalOpenIdGrant(
                        effectiveApproval(auth.userId, roomId, opener),
                    ),
                onUnsupportedCapabilities: (caps) =>
                    showToast(
                        t("widgets.unsupportedCapabilities", {
                            widget: req.name,
                            features: caps
                                .map((c) => {
                                    const d = describeCapability(c);
                                    return t(d.key as MessageKey, d.params);
                                })
                                .join(", "),
                        }),
                        { tone: "danger" },
                    ),
                onNavigate: navigateWidgetLink,
                modal: {
                    config: req,
                    onClose: (data) => closeWidgetModal(data),
                    onSetButtonEnabled: (id, enabled) =>
                        setWidgetModalButtonEnabled(id, enabled),
                },
            }),
        );
        handle = m;
        frameSrc = u;
        return () => {
            m.dispose();
            handle = null;
            frameSrc = null;
        };
    });

    // Follow the app theme and language, as WidgetFrame does for its widget.
    $effect(() => {
        const theme = currentWidgetTheme();
        const m = handle;
        if (m) untrack(() => m.setTheme(theme));
    });
    $effect(() => {
        const m = handle;
        if (m) untrack(() => m.setLanguage(getLocale()));
    });

    const buttons = req.buttons ?? [];

    function dismiss() {
        closeWidgetModal({ "m.exited": true });
    }

    function press(id: string) {
        if (id === "m.close") {
            dismiss();
            return;
        }
        handle?.notifyButtonClicked(id);
    }

    function buttonClass(kind: string): string {
        switch (kind) {
            case "m.primary":
                return "bg-zam-accent text-white hover:bg-zam-accentHover";
            case "m.warning":
                return "bg-zam-warning text-black hover:opacity-90";
            case "m.danger":
                return "bg-zam-danger text-white hover:bg-zam-dangerHover";
            case "m.link":
                return "px-2 text-zam-accent hover:underline";
            default:
                return "bg-zam-backgroundTertiary text-zam-textPrimary hover:opacity-90";
        }
    }

    function isDisabled(id: string, initial: boolean | undefined): boolean {
        const map = widgetModal.buttonDisabled;
        return id in map ? map[id] : (initial ?? false);
    }
</script>

<Portal>
    <ModalDialog
        onClose={dismiss}
        labelledBy="widget-modal-title"
        panelClass="relative flex h-[min(720px,90dvh)] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-zam-backgroundSecondary shadow-xl"
    >
        <div class="flex min-h-0 flex-1 flex-col">
            <h2
                id="widget-modal-title"
                class="px-4 pt-4 text-lg font-bold text-zam-textPrimary"
            >
                {req.name || t("widgets.modal.fallbackTitle")}
            </h2>
            {#if unsafe}
                <p class="p-4 text-sm text-zam-danger" role="alert">
                    {t("widgets.unsafeUrl")}
                </p>
            {:else if !url}
                <p class="p-4 text-sm text-zam-textMuted">
                    {t("widgets.unavailable")}
                </p>
            {:else}
                <iframe
                    bind:this={iframeEl}
                    src={frameSrc ?? undefined}
                    title={req.name || t("widgets.modal.fallbackTitle")}
                    sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-presentation allow-downloads allow-modals"
                    allow="camera; microphone; display-capture; encrypted-media; autoplay; clipboard-write; fullscreen"
                    referrerpolicy="no-referrer"
                    class="mt-3 flex-1 w-full min-h-0 border-0 bg-white"
                ></iframe>
            {/if}
        </div>
        {#if buttons.length > 0}
            <div
                class="flex flex-wrap justify-end gap-2 border-t border-zam-divider p-4"
            >
                {#each buttons as b}
                    <button
                        type="button"
                        disabled={isDisabled(b.id, b.disabled)}
                        onclick={() => press(b.id)}
                        class="rounded px-4 py-2 text-sm font-medium disabled:opacity-50 {buttonClass(
                            b.kind,
                        )}"
                    >
                        {b.label}
                    </button>
                {/each}
            </div>
        {/if}
    </ModalDialog>
</Portal>
