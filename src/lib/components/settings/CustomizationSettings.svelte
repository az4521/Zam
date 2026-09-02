<script lang="ts">
    import OptionSelector from "$lib/components/ui/OptionSelector.svelte";
    import ToggleSwitch from "$lib/components/ui/ToggleSwitch.svelte";
    import {
        setKeepSidebarOpen,
        setTimeClock,
        setDateStyle,
        setCustomDatePattern,
        setAlwaysAbsolute,
        setGifDefaultTab,
        setLinkPreviewMedia,
        setLinkPreviewsEnabled,
        setShowReadReceiptAvatars,
        setPauseVideoOnScrollOff,
        setShowMatrixIds,
        setReduceMotion,
        setHoldToOpenMessageMenu,
        setMinimizeToTrayOnClose,
        settingsState,
    } from "$lib/stores/settings.svelte";
    import { isDesktopTray, setMinimizeToTray } from "$lib/desktopTray";
    import { type GifTab } from "$lib/utils/klipy";
    import type { LinkPreviewMedia } from "$lib/utils/linkPreviewPolicy";
    import {
        previewDatePattern,
        type TimeClock,
        type DateStyle,
    } from "$lib/utils/timeFormat";

    const timeOptions: Array<{ value: TimeClock; label: string }> = [
        { value: "12h", label: "12-hour" },
        { value: "24h", label: "24-hour" },
    ];
    const dateOptions: Array<{ value: DateStyle; label: string }> = [
        { value: "default", label: "Default" },
        { value: "iso", label: "ISO" },
        { value: "dmy", label: "D/M/Y" },
        { value: "mdy", label: "M/D/Y" },
        { value: "custom", label: "Custom" },
    ];
    const linkPreviewOptions: Array<{
        value: LinkPreviewMedia;
        label: string;
        title: string;
    }> = [
        {
            value: "all",
            label: "All",
            title: "Load preview media from wherever it is hosted",
        },
        {
            value: "proxied",
            label: "Homeserver only",
            title: "Only load preview media your own homeserver serves",
        },
        {
            value: "none",
            label: "Off",
            title: "Never load preview media automatically",
        },
    ];
    const gifTabOptions: Array<{ value: GifTab; label: string }> = [
        { value: "gifs", label: "GIFs" },
        { value: "favourites", label: "Favourites" },
    ];

    let customDraft = $state(settingsState.customDatePattern);
    const customPreview = $derived(previewDatePattern(customDraft));
    function onCustomInput(
        e: Event & { currentTarget: HTMLInputElement },
    ): void {
        customDraft = e.currentTarget.value;
        // Only persist patterns date-fns accepts, so a mid-typing invalid
        // pattern never blanks every timestamp in the app.
        if (previewDatePattern(customDraft) !== null)
            setCustomDatePattern(customDraft);
    }

    function onToggleMinimizeToTray(next: boolean): void {
        setMinimizeToTrayOnClose(next);
        setMinimizeToTray(next);
    }
</script>

<div class="space-y-6">
    <section data-setting-anchor="cust-timestamps">
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
        >
            Timestamps
        </p>

        <div
            class="flex flex-col gap-2 py-2 border-b border-discord-divider sm:flex-row sm:items-center sm:justify-between"
        >
            <span class="text-sm text-discord-textPrimary">Time format</span>
            <OptionSelector
                value={settingsState.timeClock}
                options={timeOptions}
                onChange={setTimeClock}
                ariaLabel="Time format"
            />
        </div>

        <div
            class="flex flex-col gap-2 py-2 border-b border-discord-divider sm:flex-row sm:items-center sm:justify-between"
        >
            <span class="text-sm text-discord-textPrimary">Date format</span>
            <OptionSelector
                value={settingsState.dateStyle}
                options={dateOptions}
                onChange={setDateStyle}
                ariaLabel="Date format"
            />
        </div>

        {#if settingsState.dateStyle === "custom"}
            <div class="py-3 border-b border-discord-divider">
                <label
                    class="text-sm text-discord-textPrimary"
                    for="custom-date-pattern">Custom date pattern</label
                >
                <input
                    id="custom-date-pattern"
                    type="text"
                    value={customDraft}
                    oninput={onCustomInput}
                    spellcheck="false"
                    autocomplete="off"
                    autocapitalize="off"
                    placeholder="yyyy-MM-dd"
                    class="mt-2 w-full px-2.5 py-1.5 rounded bg-discord-backgroundTertiary text-sm text-discord-textPrimary border {customPreview ===
                    null
                        ? 'border-discord-danger'
                        : 'border-discord-divider focus:border-discord-accent'} outline-none"
                />
                {#if customPreview !== null}
                    <p class="mt-1.5 text-xs text-discord-textMuted">
                        Preview: <span class="text-discord-textPrimary"
                            >{customPreview}</span
                        > · date-fns tokens, e.g. yyyy-MM-dd
                    </p>
                {:else}
                    <p class="mt-1.5 text-xs text-discord-danger">
                        Invalid format - use lowercase date-fns tokens like
                        yyyy-MM-dd.
                    </p>
                {/if}
            </div>
        {/if}

        <div class="flex items-center gap-3 py-2">
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    Always show absolute dates
                </p>
                <p class="text-xs text-discord-textMuted">
                    Replace “Today” and “Yesterday” with the full date
                    everywhere.
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.alwaysAbsolute}
                onChange={setAlwaysAbsolute}
                label="Always show absolute dates"
            />
        </div>
    </section>

    <section data-setting-anchor="cust-messages">
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
        >
            Messages
        </p>
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">Show Matrix IDs</p>
                <p class="text-xs text-discord-textMuted">
                    Show full Matrix ids like @user:server instead of display
                    names throughout the app.
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.showMatrixIds}
                onChange={setShowMatrixIds}
                label="Show Matrix IDs"
            />
        </div>
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    Read receipt avatars
                </p>
                <p class="text-xs text-discord-textMuted">
                    Show who has read each message as small avatars underneath
                    it. This only changes what you see on this device - to stop
                    others seeing how far you've read, use Private read receipts
                    in Notifications.
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.showReadReceiptAvatars}
                onChange={setShowReadReceiptAvatars}
                label="Read receipt avatars"
            />
        </div>
        <div
            class="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between"
        >
            <div class="flex-1 min-w-0">
                <span class="text-sm text-discord-textPrimary"
                    >Link previews</span
                >
                <p class="text-xs text-discord-textMuted">
                    When off, no link preview is loaded and your homeserver
                    never fetches the linked page on your behalf.
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.linkPreviewsEnabled}
                onChange={setLinkPreviewsEnabled}
                label="Link previews"
            />
        </div>
        <div
            class="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between"
        >
            <div class="flex-1 min-w-0">
                <span class="text-sm text-discord-textPrimary"
                    >Link preview media</span
                >
                <p class="text-xs text-discord-textMuted">
                    Preview images and videos usually come straight from the
                    site that hosts them, so that site learns your IP address
                    and when you read the message. "Homeserver only" loads just
                    the copies your own server serves; "Off" loads none of it.
                    Both also hide embedded YouTube players and X/Twitter cards,
                    which always load straight from those sites. Either way,
                    each affected preview keeps a button to load its media.
                </p>
            </div>
            <OptionSelector
                value={settingsState.linkPreviewMedia}
                options={linkPreviewOptions}
                onChange={setLinkPreviewMedia}
                ariaLabel="Link preview media"
            />
        </div>
        <div class="flex items-center gap-3 py-2">
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    Pause videos off-screen
                </p>
                <p class="text-xs text-discord-textMuted">
                    Pause a playing video when it scrolls out of view to save
                    battery. You restart it yourself when you scroll back.
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.pauseVideoOnScrollOff}
                onChange={setPauseVideoOnScrollOff}
                label="Pause videos off-screen"
            />
        </div>
    </section>

    <section data-setting-anchor="cust-gifs">
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
        >
            GIFs
        </p>
        <div
            class="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between"
        >
            <div class="flex-1 min-w-0">
                <span class="text-sm text-discord-textPrimary">Default tab</span
                >
                <p class="text-xs text-discord-textMuted">
                    Which tab the GIF picker opens on.
                </p>
            </div>
            <OptionSelector
                value={settingsState.gifDefaultTab}
                options={gifTabOptions}
                onChange={setGifDefaultTab}
                ariaLabel="Default GIF tab"
            />
        </div>
    </section>

    <section data-setting-anchor="cust-behavior">
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
        >
            Behavior
        </p>
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    Keep room list open
                </p>
                <p class="text-xs text-discord-textMuted">
                    Don't auto-close the room list when switching between spaces
                    or Home. Opening a room or DM always closes it.
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.keepSidebarOpen}
                onChange={setKeepSidebarOpen}
                label="Keep room list open"
            />
        </div>

        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">Reduce motion</p>
                <p class="text-xs text-discord-textMuted">
                    Minimize animations and transitions. Your device's system
                    "reduce motion" setting is always respected as well.
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.reduceMotion}
                onChange={setReduceMotion}
                label="Reduce motion"
            />
        </div>

        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    Hold to open message menu
                </p>
                <p class="text-xs text-discord-textMuted">
                    On touch devices, open a message's actions by holding it
                    instead of tapping. When off, a tap opens the menu.
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.holdToOpenMessageMenu}
                onChange={setHoldToOpenMessageMenu}
                label="Hold to open message menu"
            />
        </div>
        {#if isDesktopTray()}
            <div
                class="flex items-center gap-3 py-2 border-b border-discord-divider"
            >
                <div class="flex-1 min-w-0">
                    <p class="text-sm text-discord-textPrimary">
                        Minimise to tray on close
                    </p>
                    <p class="text-xs text-discord-textMuted">
                        Keep Zam running in the system tray when you close the
                        window instead of quitting. Use the tray icon to reopen
                        or quit.
                    </p>
                </div>
                <ToggleSwitch
                    checked={settingsState.minimizeToTrayOnClose}
                    onChange={onToggleMinimizeToTray}
                    label="Minimise to tray on close"
                />
            </div>
        {/if}
    </section>
</div>
