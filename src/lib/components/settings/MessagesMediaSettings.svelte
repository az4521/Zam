<script lang="ts">
    import OptionSelector from "$lib/components/ui/OptionSelector.svelte";
    import ToggleSwitch from "$lib/components/ui/ToggleSwitch.svelte";
    import {
        setShowMatrixIds,
        setShowReadReceiptAvatars,
        setLinkPreviewsEnabled,
        setPauseVideoOnScrollOff,
        setGifDefaultTab,
        settingsState,
    } from "$lib/stores/settings.svelte";
    import { type GifTab } from "$lib/utils/klipy";

    const gifTabOptions: Array<{ value: GifTab; label: string }> = [
        { value: "gifs", label: "GIFs" },
        { value: "favourites", label: "Favourites" },
    ];
</script>

<div class="space-y-6">
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
                    in Privacy & Safety.
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
                    never fetches the linked page on your behalf. Control where
                    preview media loads from in Privacy & Safety.
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.linkPreviewsEnabled}
                onChange={setLinkPreviewsEnabled}
                label="Link previews"
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
</div>
