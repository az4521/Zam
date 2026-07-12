<script lang="ts">
    import EmojiPicker from "$lib/components/ui/EmojiPicker.svelte";
    import OptionSelector from "$lib/components/ui/OptionSelector.svelte";
    import ToggleSwitch from "$lib/components/ui/ToggleSwitch.svelte";
    import { getRoomDisplayName, mxcToHttp } from "$lib/matrix/client";
    import { roomsState } from "$lib/stores/rooms.svelte";
    import {
        getDoubleTapReaction,
        setDoubleTapReaction,
        setKeepSidebarOpen,
        setOtherDoubleTapAction,
        setOwnDoubleTapAction,
        setSpaceDoubleTapReaction,
        setTheme,
        settingsState,
    } from "$lib/stores/settings.svelte";
    import type { DoubleTapAction } from "$lib/utils/doubleTap";

    const ownActions: Array<{ value: DoubleTapAction; label: string }> = [
        { value: "none", label: "Nothing" },
        { value: "reaction", label: "Reaction" },
        { value: "reply", label: "Reply" },
        { value: "edit", label: "Edit" },
    ];
    const otherActions = ownActions.filter((option) => option.value !== "edit");
    let pickerTarget = $state<"default" | string | null>(null);
    const pickerRoom = $derived(
        pickerTarget && pickerTarget !== "default"
            ? (roomsState.spaces.find(
                  (space) => space.roomId === pickerTarget,
              ) ?? null)
            : null,
    );

    function chooseReaction(value: string) {
        if (!pickerTarget) return;
        if (pickerTarget === "default") setDoubleTapReaction(value);
        else setSpaceDoubleTapReaction(pickerTarget, value);
        pickerTarget = null;
    }
</script>

<div class="space-y-6">
    <section>
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
        >
            Theme
        </p>
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <p class="flex-1 text-sm text-discord-textPrimary">Light theme</p>
            <ToggleSwitch
                checked={settingsState.theme === "light"}
                onChange={(light) => setTheme(light ? "light" : "dark")}
                label="Light theme"
                title={settingsState.theme === "light"
                    ? "Use dark theme"
                    : "Use light theme"}
            />
        </div>
    </section>

    <section>
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

        <div class="py-4 border-b border-discord-divider">
            <p class="text-sm font-medium text-discord-textPrimary mb-3">
                Double-tap messages
            </p>
            <div class="space-y-3">
                <div
                    class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                >
                    <span class="text-sm text-discord-textSecondary"
                        >Your messages</span
                    >
                    <OptionSelector
                        value={settingsState.ownDoubleTapAction}
                        options={ownActions}
                        onChange={setOwnDoubleTapAction}
                        ariaLabel="Double-tap your messages"
                    />
                </div>
                <div
                    class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                >
                    <span class="text-sm text-discord-textSecondary"
                        >Other messages</span
                    >
                    <OptionSelector
                        value={settingsState.otherDoubleTapAction}
                        options={otherActions}
                        onChange={setOtherDoubleTapAction}
                        ariaLabel="Double-tap other messages"
                    />
                </div>
            </div>
        </div>

        <div class="py-4">
            <p class="text-sm font-medium text-discord-textPrimary mb-3">
                Reaction emoji
            </p>
            <div
                class="flex items-center justify-between gap-3 pb-3 border-b border-discord-divider"
            >
                <span class="text-sm text-discord-textSecondary">Default</span>
                <button
                    type="button"
                    onclick={() => (pickerTarget = "default")}
                    class="w-10 h-10 flex items-center justify-center rounded border border-discord-divider bg-discord-backgroundTertiary hover:border-discord-accent transition-colors"
                    title="Choose default reaction"
                >
                    {#if settingsState.doubleTapReaction.startsWith("mxc://")}
                        <img
                            src={mxcToHttp(settingsState.doubleTapReaction)}
                            alt="Default reaction"
                            class="w-6 h-6 object-contain"
                        />
                    {:else}
                        <span class="text-xl"
                            >{settingsState.doubleTapReaction}</span
                        >
                    {/if}
                </button>
            </div>

            {#if roomsState.spaces.length > 0}
                <p
                    class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mt-4 mb-2"
                >
                    Space overrides
                </p>
                <div class="space-y-1">
                    {#each roomsState.spaces as space (space.roomId)}
                        {@const override =
                            settingsState.doubleTapReactionBySpace[
                                space.roomId
                            ]}
                        {@const reaction = getDoubleTapReaction(space.roomId)}
                        <div
                            class="flex items-center gap-2 py-2 border-b border-discord-divider last:border-b-0"
                        >
                            <span
                                class="min-w-0 flex-1 truncate text-sm text-discord-textPrimary"
                                >{getRoomDisplayName(space)}</span
                            >
                            {#if override}
                                <button
                                    type="button"
                                    onclick={() =>
                                        setSpaceDoubleTapReaction(
                                            space.roomId,
                                            null,
                                        )}
                                    class="px-2 py-1 text-xs text-discord-textMuted hover:text-discord-textPrimary"
                                >
                                    Use default
                                </button>
                            {/if}
                            <button
                                type="button"
                                onclick={() => (pickerTarget = space.roomId)}
                                class="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded border border-discord-divider bg-discord-backgroundTertiary hover:border-discord-accent transition-colors"
                                title="Choose reaction for {getRoomDisplayName(
                                    space,
                                )}"
                            >
                                {#if reaction.startsWith("mxc://")}
                                    <img
                                        src={mxcToHttp(reaction)}
                                        alt="Space reaction"
                                        class="w-6 h-6 object-contain"
                                    />
                                {:else}
                                    <span class="text-xl">{reaction}</span>
                                {/if}
                            </button>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    </section>
</div>

{#if pickerTarget}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
        class="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-3"
        onclick={(event) => {
            if (event.target === event.currentTarget) pickerTarget = null;
        }}
    >
        <div class="w-full max-w-72">
            <EmojiPicker
                room={pickerRoom}
                onSelect={chooseReaction}
                onSelectCustom={(emoji) => chooseReaction(emoji.mxcUrl)}
                onClose={() => (pickerTarget = null)}
            />
        </div>
    </div>
{/if}
