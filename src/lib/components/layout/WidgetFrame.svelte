<script module lang="ts">
    import { getLocale } from "$lib/i18n";
    import { settingsState } from "$lib/stores/settings.svelte";
    import { buildWidgetUrl, type RoomWidget } from "$lib/utils/widgets";
    import { widgetUrlContext } from "$lib/matrix/widgetHost";

    /** The app's base theme as a widget theme. Amoled is a dark theme. */
    export function currentWidgetTheme(): "light" | "dark" {
        return settingsState.theme === "light" ? "light" : "dark";
    }

    /**
     * The widget's URL with its `$placeholders` filled in for the current user
     * and room, or null when there is no signed-in client to fill them from.
     * Used both for the iframe and for the "open in browser" link.
     */
    export function templatedWidgetUrl(
        roomId: string,
        w: RoomWidget,
    ): string | null {
        const ctx = widgetUrlContext(roomId, currentWidgetTheme(), getLocale());
        if (!ctx) return null;
        return buildWidgetUrl(w, ctx, location.origin + location.pathname);
    }
</script>

<script lang="ts">
    // Imports shared with the module script above (getLocale, settingsState,
    // buildWidgetUrl, widgetUrlContext, RoomWidget) are not repeated here:
    // both scripts share one module scope.
    import { t, type MessageKey } from "$lib/i18n";
    import { untrack } from "svelte";
    import { showToast } from "$lib/stores/toasts.svelte";
    import type { Room } from "matrix-js-sdk";
    import { auth } from "$lib/stores/auth.svelte";
    import { getMemberName } from "$lib/matrix/client";
    import { mountWidget, type MountedWidget } from "$lib/matrix/widgetHost";
    import {
        widgetOrigin,
        isUnsafeWidgetUrl,
        describeCapability,
    } from "$lib/utils/widgets";
    import {
        widgetPrompts,
        effectiveApproval,
        recordWidgetApproval,
        resolveCapabilityRequest,
        resolveOpenIdRequest,
        dismissWidgetPrompt,
    } from "$lib/stores/widgetPrompts.svelte";
    import { interfaceState } from "$lib/stores/interface.svelte";
    import WidgetCapabilityDialog from "$lib/components/layout/WidgetCapabilityDialog.svelte";

    // One widget, sandboxed in an iframe. Owns the load consent card, the
    // capability/OpenID prompts it raises, and the postMessage bridge (via
    // mountWidget). Mounted by WidgetsPanel while a widget is active.
    interface Props {
        room: Room;
        widget: RoomWidget;
    }

    let { room, widget }: Props = $props();

    const roomId = $derived(room.roomId);
    // The theme is read once: a theme change must not change the URL and
    // reload the widget. It reaches the widget through setTheme instead.
    const url = $derived.by(() => {
        void widget.id;
        void widget.url;
        void roomId;
        return untrack(() => templatedWidgetUrl(roomId, widget));
    });
    // Judge the URL the frame actually loads: a `$key` from the widget's data
    // can rewrite the host, so the raw template alone proves nothing.
    const host = $derived(widgetOrigin(url || widget.url) ?? widget.url);
    const unsafe = $derived(
        isUnsafeWidgetUrl(widget.url, location.origin) ||
            (!!url && isUnsafeWidgetUrl(url, location.origin)),
    );

    // Widgets the user created load straight away; anyone else's need consent.
    const isOwnWidget = $derived(widget.creatorUserId === auth.userId);
    const loadAllowed = $derived.by(() => {
        if (isOwnWidget) return true;
        return effectiveApproval(auth.userId, roomId, widget)?.load === true;
    });
    const creatorName = $derived(getMemberName(room, widget.creatorUserId));

    // Set only after mountWidget has run, so the widget's first request is
    // answered. Setting src before the bridge exists would lose it.
    let iframeEl = $state<HTMLIFrameElement | null>(null);
    let frameSrc = $state<string | null>(null);
    let mounted = $state.raw<MountedWidget | null>(null);

    const canMount = $derived(!unsafe && !!url && loadAllowed);

    $effect(() => {
        const el = iframeEl;
        if (!el || !canMount || !url) return;
        const w = widget;
        const rid = roomId;
        const u = url;
        const m = untrack(() =>
            mountWidget({
                iframe: el,
                widget: w,
                roomId: rid,
                url: u,
                requestCapabilities: (requested) =>
                    resolveCapabilityRequest(auth.userId, rid, w, requested),
                requestOpenId: () => resolveOpenIdRequest(auth.userId, rid, w),
                onUnsupportedCapabilities: (caps) =>
                    showToast(
                        t("widgets.unsupportedCapabilities", {
                            widget: w.name,
                            features: caps
                                .map((c) => {
                                    const d = describeCapability(c);
                                    return t(d.key as MessageKey, d.params);
                                })
                                .join(", "),
                        }),
                        { tone: "danger" },
                    ),
            }),
        );
        mounted = m;
        frameSrc = u;
        return () => {
            m.dispose();
            mounted = null;
            frameSrc = null;
        };
    });

    // Follow the app theme without reloading the widget.
    $effect(() => {
        const theme = settingsState.theme === "light" ? "light" : "dark";
        const m = mounted;
        if (m) untrack(() => m.setTheme(theme));
    });

    // A prompt belongs to this frame. If the frame goes away while the user is
    // being asked, deny it so the widget's pending request settles.
    $effect(() => {
        return () => dismissWidgetPrompt();
    });

    function allowLoad(remember: boolean) {
        recordWidgetApproval(
            auth.userId,
            roomId,
            widget,
            { load: true },
            remember,
        );
    }

    const showPrompt = $derived(
        widgetPrompts.current !== null &&
            interfaceState.modal === "widget-capabilities",
    );
</script>

<div class="h-full w-full min-h-0 flex flex-col">
    {#if unsafe}
        <p class="p-4 text-sm text-zam-danger" role="alert">
            {t("widgets.unsafeUrl")}
        </p>
    {:else if !url}
        <p class="p-4 text-sm text-zam-textMuted">
            {t("widgets.unavailable")}
        </p>
    {:else if !loadAllowed}
        <div class="p-4 flex flex-col gap-4">
            <p class="text-sm text-zam-textPrimary">
                {t("widgets.consent.body", {
                    user: creatorName,
                    host,
                })}
            </p>
            <div class="flex flex-col gap-2">
                <button
                    type="button"
                    onclick={() => allowLoad(false)}
                    class="rounded bg-zam-accent px-4 py-2 text-sm font-medium text-white hover:bg-zam-accentHover"
                >
                    {t("widgets.consent.allow")}
                </button>
                <button
                    type="button"
                    onclick={() => allowLoad(true)}
                    class="rounded px-4 py-2 text-sm font-medium text-zam-accent hover:underline"
                >
                    {t("widgets.consent.allowAndRemember")}
                </button>
            </div>
        </div>
    {:else}
        <iframe
            bind:this={iframeEl}
            src={frameSrc ?? undefined}
            title={widget.name}
            sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-presentation allow-downloads allow-modals"
            allow="camera; microphone; display-capture; encrypted-media; autoplay; clipboard-write; fullscreen"
            referrerpolicy="no-referrer"
            class="flex-1 w-full min-h-0 border-0 bg-white"
        ></iframe>
    {/if}
</div>

{#if showPrompt && widgetPrompts.current}
    {#key widgetPrompts.current.id}
        <WidgetCapabilityDialog prompt={widgetPrompts.current} />
    {/key}
{/if}
