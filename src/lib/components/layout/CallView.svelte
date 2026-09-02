<script lang="ts">
    import { tick } from "svelte";
    import type { Room } from "matrix-js-sdk";
    import {
        MessageSquare,
        Mic,
        MicOff,
        Headphones,
        HeadphoneOff,
        PhoneOff,
        Phone,
        Volume2,
        VolumeX,
        Video,
        VideoOff,
        MonitorUp,
        EllipsisVertical,
        Smartphone,
    } from "lucide-svelte";
    import { longPress } from "$lib/actions/longPress";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import CallParticipantMenu from "$lib/components/layout/CallParticipantMenu.svelte";
    import UserProfileCard from "$lib/components/ui/UserProfileCard.svelte";
    import VideoTile from "$lib/components/layout/VideoTile.svelte";
    import {
        deviceCountByUser,
        callTileStatus,
    } from "$lib/utils/callTileStatus";
    import {
        getRoomCallMemberships,
        getRoomDisplayName,
        getMemberName,
        getMemberAvatar,
        resumeVoicePlayback,
        getDirectRoomIds,
    } from "$lib/matrix/client";
    import {
        voiceCallState,
        joinCall,
        leaveCall,
        toggleCallMute,
        toggleCallDeafen,
        toggleCamera,
        toggleScreenShare,
        focusTile,
        clearFocus,
        participantAudioFor,
    } from "$lib/stores/voiceCall.svelte";
    import { dedupeParticipants, callControlMode } from "$lib/utils/voiceCall";
    import { screenShareSupportedHere } from "$lib/utils/videoTiles";
    import {
        showChatView,
        openModal,
        clearModalIfOwner,
        interfaceState,
    } from "$lib/stores/interface.svelte";
    import { roomsState } from "$lib/stores/rooms.svelte";
    import { auth } from "$lib/stores/auth.svelte";
    import { settingsState } from "$lib/stores/settings.svelte";

    interface Props {
        room: Room;
        isMobile?: boolean;
        onMenuOpen?: () => void;
    }
    let { room, isMobile = false, onMenuOpen }: Props = $props();

    // Capture support is fixed for the session (no runtime change), so a plain
    // const is enough — used to hide the share-screen button where unsupported.
    const screenShareSupported = screenShareSupportedHere();

    // Live SDK objects mutate in place, so every read of call/room state hangs
    // off a tick: voiceTick for the roster, roomsTick for names and avatars.
    // Pre-dedupe roster: dedupeParticipants collapses a user's devices to one
    // tile; deviceCountByUser reads the raw list so we can badge multi-device.
    const rawCallMemberships = $derived(
        (void voiceCallState.voiceTick, getRoomCallMemberships(room)),
    );
    const participants = $derived(dedupeParticipants(rawCallMemberships));
    const deviceCounts = $derived(deviceCountByUser(rawCallMemberships));
    const inThisCall = $derived(voiceCallState.roomId === room.roomId);
    const controlMode = $derived(
        callControlMode({
            inThisCall,
            participantUserIds: participants.map((p) => p.userId),
            selfUserId: auth.userId,
        }),
    );
    const speaking = $derived(voiceCallState.speakingUserIds);
    // Contract: a user absent from this set is unmuted, never "unknown".
    const muted = $derived(voiceCallState.mutedUserIds);

    // Video tiles for THIS call. `voiceCallState.videoTiles` is global — it
    // holds the tiles of whichever call we are connected to, whatever room that
    // is — so every read is gated on `inThisCall`. Without that, viewing another
    // room's call surface mid-call renders the connected room's cameras and
    // screenshares under this room's header (and the screenTiles term below
    // suppresses this room's "No one is in this call"). Reachable before by
    // peeking at a call mid-call; routine now that clicking a video room lands
    // here. Split so a camera can replace a participant's avatar while their
    // screenshare gets its own tile. Gated on voiceTick like every other
    // live-object read.
    const cameraByIdentity = $derived(
        (void voiceCallState.voiceTick,
        new Map(
            inThisCall
                ? voiceCallState.videoTiles
                      .filter((t) => t.source === "camera")
                      .map((t) => [t.identity, t])
                : [],
        )),
    );
    const screenTiles = $derived(
        (void voiceCallState.voiceTick,
        inThisCall
            ? voiceCallState.videoTiles.filter(
                  (t) => t.source === "screenshare",
              )
            : []),
    );
    const focusedTile = $derived(
        (void voiceCallState.voiceTick,
        (inThisCall
            ? voiceCallState.videoTiles.find(
                  (t) => t.key === voiceCallState.focusedTileKey,
              )
            : undefined) ?? null),
    );

    function tileLabel(
        identity: string,
        source: "camera" | "screenshare",
    ): string {
        const userId = identity.slice(0, identity.lastIndexOf(":"));
        const name =
            userId === auth.userId ? "You" : getMemberName(room, userId);
        return source === "screenshare" ? `${name}'s screen` : name;
    }
    function isLocalIdentity(identity: string): boolean {
        return identity.slice(0, identity.lastIndexOf(":")) === auth.userId;
    }

    // A tile's primary action lives on its wrapper <div> (click, contextmenu,
    // long-press). The keyboard/AT affordance is a real, empty <button>
    // stretched over the tile — a real button so Enter *and* Space activate it
    // natively (Space on a focused button never scrolls the page) and so we add
    // no keydown handler that could shadow the window-level Escape that clears
    // the spotlight.
    //
    // `pointer-events-none` is load-bearing, not decoration: VideoTile renders
    // its own Fullscreen <button> at bottom-right (and a <video>), so an overlay
    // that took part in hit-testing would sit on top of it and silently swallow
    // fullscreen, click-to-spotlight, right-click and long-press. Keeping it out
    // of hit-testing leaves every pointer gesture byte-identical to before;
    // keyboard and assistive-tech activation dispatch the click straight at the
    // button, which needs no hit-test. The ring is white (never the accent —
    // that colour already means "speaking/spotlighted" on these tiles) over a
    // 40% scrim so it still reads 3:1 against an all-white shared screen.
    const TILE_OVERLAY_BTN =
        "absolute inset-0 z-10 pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white focus-visible:bg-black/40";
    // The per-participant menu trigger: always visible (never hover-gated, or a
    // keyboard user could never reach it) and never gated on pointer type — a
    // visible affordance beats a long-press gesture nobody can discover. It
    // passes `interfaceState.isTouchscreen` as the menu's `touch` flag, not a
    // hardcoded false: the same device must not get a positioned popover (with
    // an <input type="range"> in it) from a tap on this button and a BottomSheet
    // from a long-press on the tile behind it. No
    // aria-haspopup: CallParticipantMenu renders a focus-trapped <div> of
    // buttons (a BottomSheet on touch) with neither role="menu" nor
    // role="dialog", and a popup role we cannot honour is worse than none.
    const TILE_MENU_BTN =
        "absolute z-20 rounded bg-black/60 text-white opacity-70 hover:opacity-100 focus-visible:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";

    // focusTile() is a toggle, so the label has to say which way it goes.
    function spotlightLabel(key: string, label: string): string {
        return voiceCallState.focusedTileKey === key
            ? `Exit spotlight for ${label}`
            : `Spotlight ${label}`;
    }

    // Spotlighting and un-spotlighting both flip `{#if focusedTile}`, which
    // tears down the entire tile subtree — including whichever overlay button
    // was just activated. Focus would fall back to <body>, dumping a keyboard
    // user at the top of the document and making them Tab through the whole
    // sidebar to get back into the call. Land them on the tiles container
    // instead: `tabindex="-1"` keeps it out of the tab order (it is a landing
    // spot, not a stop) while still accepting focus, and Tab from there
    // continues into the freshly rendered tiles.
    //
    // Both paths funnel through here so the five call sites cannot drift.
    // Only the overlay buttons call these: the wrapper <div>s own the pointer
    // (the overlays are `pointer-events-none`), so a mouse click never takes
    // this path and never moves focus.
    let tilesEl = $state<HTMLDivElement | undefined>();
    async function keepFocusInTiles(): Promise<void> {
        await tick();
        tilesEl?.focus();
    }
    function spotlightTile(key: string): void {
        focusTile(key);
        void keepFocusInTiles();
    }
    function backToGrid(): void {
        clearFocus();
        void keepFocusInTiles();
    }

    function onKeydown(e: KeyboardEvent): void {
        if (e.key === "Escape" && voiceCallState.focusedTileKey) {
            e.stopPropagation();
            clearFocus();
        }
    }
    const roomName = $derived(
        (void roomsState.roomsTick, getRoomDisplayName(room)),
    );
    const joining = $derived(voiceCallState.joinPendingRoomId === room.roomId);
    // roomsTick, not voiceTick: m.direct is account data that lands on a sync,
    // and the roster is frozen for the whole ring — see the tick split above
    // and ActiveCallBanner.svelte.
    const isDm = $derived(
        (void roomsState.roomsTick, getDirectRoomIds().has(room.roomId)),
    );
    // A DM call with nobody else in it yet: we are ringing them. Derived, not
    // stored — it stays until they join or we hang up, because a decline is
    // invisible to the caller without MSC4310. The `=== auth.userId` check
    // keeps "Ringing…" off the screen of a peer whose own membership has not
    // propagated yet.
    const ringingOut = $derived(
        inThisCall &&
            participants.length === 1 &&
            participants[0].userId === auth.userId &&
            isDm,
    );

    let participantMenu = $state<{
        userId: string;
        x: number;
        y: number;
        touch: boolean;
    } | null>(null);
    // Plain let: read only from event handlers, never from markup or an effect.
    let participantMenuToken = 0;

    // Release the shared modal slot if this row is destroyed while still
    // owning it (e.g. the room changes under an open picker) — otherwise the
    // slot strands and swallows the next Escape.
    $effect(() => () => clearModalIfOwner(participantMenuToken));

    function openParticipantMenu(
        userId: string,
        x: number,
        y: number,
        touch: boolean,
    ) {
        participantMenuToken = openModal(
            "call-participant-menu",
            () => (participantMenu = null),
        );
        participantMenu = { userId, x, y, touch };
    }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="flex-1 flex flex-col min-w-0 bg-discord-backgroundTertiary">
    <!-- Header -->
    <div
        class="themed-topbar h-12 px-4 flex items-center gap-2 flex-shrink-0 border-b border-discord-divider"
    >
        {#if isMobile}
            <button
                onclick={onMenuOpen}
                class="p-1.5 -ml-1 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors flex-shrink-0"
                title="Open room list"
                aria-label="Open room list"
            >
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
                </svg>
            </button>
        {/if}
        <Volume2 size={20} class="text-discord-textMuted flex-shrink-0" />
        <h2 class="font-semibold text-discord-textPrimary truncate">
            {roomName}
        </h2>
        {#if ringingOut}
            <span class="text-sm text-discord-textMuted flex-shrink-0">
                Ringing…
            </span>
        {/if}
        <div class="flex-1"></div>
        <button
            onclick={showChatView}
            class="p-1.5 rounded transition-colors text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover"
            title="Show chat"
            aria-label="Show chat"
        >
            <MessageSquare size={20} />
        </button>
    </div>

    <!-- Tiles -->
    <!-- `tabindex="-1"`, not "0": this is the focus landing spot for a
         spotlight toggle that unmounts the button doing the toggling (see
         keepFocusInTiles above), NOT a new tab stop — it adds nothing to the
         tab order and traps nothing. -->
    <div
        bind:this={tilesEl}
        tabindex="-1"
        class="flex-1 min-h-0 p-4 flex flex-col gap-3"
    >
        {#if participants.length === 0 && screenTiles.length === 0}
            <div
                class="flex-1 flex flex-col items-center justify-center gap-3 text-discord-textMuted"
            >
                <Volume2 size={40} />
                <p class="text-sm">No one is in this call</p>
            </div>
        {:else if focusedTile}
            <!-- Spotlight: the focused stream fills the view -->
            <!-- The wrapper keeps click-anywhere-to-go-back for the pointer, so
                 both ignores below stay live; the keyboard path is the overlay
                 button (and Escape, handled on <svelte:window> above). -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div
                class="relative flex-1 min-h-0 rounded-lg overflow-hidden cursor-zoom-out"
                onclick={clearFocus}
                title="Back to grid"
            >
                <VideoTile
                    tile={focusedTile}
                    label={tileLabel(focusedTile.identity, focusedTile.source)}
                    mirror={focusedTile.source === "camera" &&
                        isLocalIdentity(focusedTile.identity) &&
                        settingsState.mirrorCamera}
                />
                <button
                    type="button"
                    class={TILE_OVERLAY_BTN}
                    aria-label="Back to grid"
                    onclick={(e) => {
                        e.stopPropagation();
                        backToGrid();
                    }}
                ></button>
            </div>
            <!-- Filmstrip: everyone else, small, along the bottom -->
            <div
                class="flex-shrink-0 flex gap-2 justify-center overflow-x-auto py-1"
            >
                {#each screenTiles as t (t.key)}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <div
                        class="relative h-20 aspect-video flex-shrink-0 rounded-md overflow-hidden bg-black cursor-pointer border-2 {t.key ===
                        voiceCallState.focusedTileKey
                            ? 'border-discord-accent'
                            : 'border-transparent'}"
                        onclick={() => focusTile(t.key)}
                        title={tileLabel(t.identity, t.source)}
                    >
                        <VideoTile
                            tile={t}
                            label={tileLabel(t.identity, t.source)}
                            compact
                        />
                        <button
                            type="button"
                            class={TILE_OVERLAY_BTN}
                            aria-label={spotlightLabel(
                                t.key,
                                tileLabel(t.identity, t.source),
                            )}
                            onclick={(e) => {
                                e.stopPropagation();
                                spotlightTile(t.key);
                            }}
                        ></button>
                    </div>
                {/each}
                {#each participants as p (p.userId)}
                    {@const identity = `${p.userId}:${p.deviceId}`}
                    {@const cam = cameraByIdentity.get(identity)}
                    {@const name =
                        (void roomsState.roomsTick,
                        getMemberName(room, p.userId))}
                    {@const avatar =
                        (void roomsState.roomsTick,
                        getMemberAvatar(room, p.userId))}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <div
                        class="relative h-20 aspect-video flex-shrink-0 rounded-md overflow-hidden bg-discord-backgroundSecondary flex items-center justify-center cursor-pointer border-2 {speaking.has(
                            p.userId,
                        ) ||
                        (cam && cam.key === voiceCallState.focusedTileKey)
                            ? 'border-discord-accent'
                            : 'border-transparent'}"
                        onclick={cam ? () => focusTile(cam.key) : undefined}
                        oncontextmenu={(e) => {
                            e.preventDefault();
                            openParticipantMenu(
                                p.userId,
                                e.clientX,
                                e.clientY,
                                false,
                            );
                        }}
                        use:longPress={{
                            onTrigger: (x, y) =>
                                openParticipantMenu(p.userId, x, y, true),
                        }}
                        title={name}
                    >
                        {#if cam}
                            <VideoTile
                                tile={cam}
                                label={name}
                                compact
                                mirror={isLocalIdentity(identity) &&
                                    settingsState.mirrorCamera}
                            />
                            <button
                                type="button"
                                class={TILE_OVERLAY_BTN}
                                aria-label={spotlightLabel(cam.key, name)}
                                onclick={(e) => {
                                    e.stopPropagation();
                                    spotlightTile(cam.key);
                                }}
                            ></button>
                        {:else}
                            <Avatar
                                src={avatar}
                                {name}
                                id={p.userId}
                                size={36}
                            />
                        {/if}
                        <button
                            type="button"
                            class="{TILE_MENU_BTN} top-0.5 right-0.5 p-1"
                            title={`Options for ${name}`}
                            aria-label={`Options for ${name}`}
                            onclick={(e) => {
                                e.stopPropagation();
                                const r =
                                    e.currentTarget.getBoundingClientRect();
                                openParticipantMenu(
                                    p.userId,
                                    r.right,
                                    r.bottom,
                                    interfaceState.isTouchscreen,
                                );
                            }}
                        >
                            <EllipsisVertical size={14} />
                        </button>
                    </div>
                {/each}
            </div>
        {:else}
            <div
                class="grid gap-3 overflow-y-auto"
                style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));"
            >
                {#each screenTiles as t (t.key)}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <div
                        class="relative aspect-video rounded-lg overflow-hidden bg-black cursor-zoom-in border-2 {t.key ===
                        voiceCallState.focusedTileKey
                            ? 'border-discord-accent'
                            : 'border-transparent'}"
                        onclick={() => focusTile(t.key)}
                    >
                        <VideoTile
                            tile={t}
                            label={tileLabel(t.identity, t.source)}
                        />
                        <button
                            type="button"
                            class={TILE_OVERLAY_BTN}
                            aria-label={spotlightLabel(
                                t.key,
                                tileLabel(t.identity, t.source),
                            )}
                            onclick={(e) => {
                                e.stopPropagation();
                                spotlightTile(t.key);
                            }}
                        ></button>
                    </div>
                {/each}

                {#each participants as p (p.userId)}
                    {@const identity = `${p.userId}:${p.deviceId}`}
                    {@const cam = cameraByIdentity.get(identity)}
                    {@const name =
                        (void roomsState.roomsTick,
                        getMemberName(room, p.userId))}
                    {@const avatar =
                        (void roomsState.roomsTick,
                        getMemberAvatar(room, p.userId))}
                    {@const status = callTileStatus({
                        isOwn: isLocalIdentity(identity),
                        remoteMuted: muted.has(p.userId),
                        speaking: speaking.has(p.userId),
                        locallyMuted: participantAudioFor(p.userId).muted,
                        selfMicMuted: voiceCallState.micMuted,
                        selfDeafened: voiceCallState.deafened,
                        deviceCount: deviceCounts.get(p.userId) ?? 1,
                    })}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <div
                        class="relative aspect-video rounded-lg overflow-hidden bg-discord-backgroundSecondary flex items-center justify-center border-2 {speaking.has(
                            p.userId,
                        ) ||
                        (cam && cam.key === voiceCallState.focusedTileKey)
                            ? 'border-discord-accent'
                            : 'border-transparent'} {cam
                            ? 'cursor-zoom-in'
                            : ''}"
                        onclick={cam ? () => focusTile(cam.key) : undefined}
                        oncontextmenu={(e) => {
                            e.preventDefault();
                            openParticipantMenu(
                                p.userId,
                                e.clientX,
                                e.clientY,
                                false,
                            );
                        }}
                        use:longPress={{
                            onTrigger: (x, y) =>
                                openParticipantMenu(p.userId, x, y, true),
                        }}
                    >
                        {#if cam}
                            <VideoTile
                                tile={cam}
                                label={name}
                                mirror={isLocalIdentity(identity) &&
                                    settingsState.mirrorCamera}
                            />
                            <button
                                type="button"
                                class={TILE_OVERLAY_BTN}
                                aria-label={spotlightLabel(cam.key, name)}
                                onclick={(e) => {
                                    e.stopPropagation();
                                    spotlightTile(cam.key);
                                }}
                            ></button>
                            {#if status.micOff || status.deafened || status.locallyMuted || status.multiDevice}
                                <div
                                    class="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60"
                                >
                                    {#if status.micOff}
                                        <MicOff
                                            size={14}
                                            class="text-discord-danger flex-shrink-0"
                                        />
                                    {/if}
                                    {#if status.deafened}
                                        <HeadphoneOff
                                            size={14}
                                            class="text-discord-danger flex-shrink-0"
                                        />
                                    {/if}
                                    {#if status.locallyMuted}
                                        <VolumeX
                                            size={14}
                                            class="text-discord-textMuted flex-shrink-0"
                                        />
                                    {/if}
                                    {#if status.multiDevice}
                                        <span
                                            class="flex items-center gap-0.5 text-[10px] leading-none text-white flex-shrink-0"
                                            title="Joined from multiple devices"
                                        >
                                            <Smartphone
                                                size={12}
                                            />{deviceCounts.get(p.userId) ?? 1}
                                        </span>
                                    {/if}
                                </div>
                            {/if}
                        {:else}
                            <Avatar
                                src={avatar}
                                {name}
                                id={p.userId}
                                size={80}
                            />
                            <div
                                class="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/60 max-w-[calc(100%-1rem)]"
                            >
                                {#if status.micOff}
                                    <MicOff
                                        size={14}
                                        class="text-discord-danger flex-shrink-0"
                                    />
                                {/if}
                                {#if status.deafened}
                                    <HeadphoneOff
                                        size={14}
                                        class="text-discord-danger flex-shrink-0"
                                    />
                                {/if}
                                {#if status.locallyMuted}
                                    <VolumeX
                                        size={14}
                                        class="text-discord-textMuted flex-shrink-0"
                                    />
                                {/if}
                                {#if status.multiDevice}
                                    <span
                                        class="flex items-center gap-0.5 text-[10px] leading-none text-white flex-shrink-0"
                                        title="Joined from multiple devices"
                                    >
                                        <Smartphone
                                            size={12}
                                        />{deviceCounts.get(p.userId) ?? 1}
                                    </span>
                                {/if}
                                <span class="text-xs text-white truncate"
                                    >{name}</span
                                >
                            </div>
                        {/if}
                        <button
                            type="button"
                            class="{TILE_MENU_BTN} top-2 right-2 p-1.5"
                            title={`Options for ${name}`}
                            aria-label={`Options for ${name}`}
                            onclick={(e) => {
                                e.stopPropagation();
                                const r =
                                    e.currentTarget.getBoundingClientRect();
                                openParticipantMenu(
                                    p.userId,
                                    r.right,
                                    r.bottom,
                                    interfaceState.isTouchscreen,
                                );
                            }}
                        >
                            <EllipsisVertical size={16} />
                        </button>
                    </div>
                {/each}
            </div>
        {/if}
    </div>

    <!-- Controls -->
    <div class="flex-shrink-0 p-4 flex flex-col items-center gap-2">
        {#if voiceCallState.playbackBlocked && inThisCall}
            <button
                onclick={() => void resumeVoicePlayback()}
                class="px-3 py-1.5 rounded bg-discord-warning text-black text-xs font-semibold"
            >
                Enable audio
            </button>
        {/if}
        {#if controlMode === "controls"}
            <div
                class="flex items-center gap-2 px-2 py-2 rounded-full bg-discord-backgroundSecondary"
            >
                <button
                    onclick={toggleCallMute}
                    class="p-3 rounded-full hover:bg-discord-messageHover {voiceCallState.micMuted
                        ? 'text-discord-danger'
                        : 'text-discord-textPrimary'}"
                    title={voiceCallState.micMuted ? "Unmute" : "Mute"}
                    aria-label={voiceCallState.micMuted ? "Unmute" : "Mute"}
                >
                    {#if voiceCallState.micMuted}<MicOff size={20} />{:else}<Mic
                            size={20}
                        />{/if}
                </button>
                <button
                    onclick={toggleCallDeafen}
                    class="p-3 rounded-full hover:bg-discord-messageHover {voiceCallState.deafened
                        ? 'text-discord-danger'
                        : 'text-discord-textPrimary'}"
                    title={voiceCallState.deafened ? "Undeafen" : "Deafen"}
                    aria-label={voiceCallState.deafened ? "Undeafen" : "Deafen"}
                >
                    {#if voiceCallState.deafened}<HeadphoneOff
                            size={20}
                        />{:else}<Headphones size={20} />{/if}
                </button>
                <button
                    onclick={() => void toggleCamera()}
                    class="p-3 rounded-full hover:bg-discord-messageHover {voiceCallState.cameraOn
                        ? 'text-discord-accent'
                        : 'text-discord-textPrimary'}"
                    title={voiceCallState.cameraOn
                        ? "Turn off camera"
                        : "Turn on camera"}
                    aria-label={voiceCallState.cameraOn
                        ? "Turn off camera"
                        : "Turn on camera"}
                >
                    {#if voiceCallState.cameraOn}<Video
                            size={20}
                        />{:else}<VideoOff size={20} />{/if}
                </button>
                {#if screenShareSupported}
                    <button
                        onclick={() => void toggleScreenShare()}
                        class="p-3 rounded-full hover:bg-discord-messageHover {voiceCallState.screenSharing
                            ? 'text-discord-accent'
                            : 'text-discord-textPrimary'}"
                        title={voiceCallState.screenSharing
                            ? "Stop sharing"
                            : "Share your screen"}
                        aria-label={voiceCallState.screenSharing
                            ? "Stop sharing"
                            : "Share your screen"}
                    >
                        <MonitorUp size={20} />
                    </button>
                {/if}
                <button
                    onclick={leaveCall}
                    class="p-3 rounded-full bg-discord-danger hover:bg-discord-dangerHover text-white transition-colors"
                    title="Disconnect"
                    aria-label="Disconnect"
                >
                    <PhoneOff size={20} />
                </button>
            </div>
        {:else if controlMode === "join"}
            <button
                onclick={() => joinCall(room.roomId)}
                disabled={voiceCallState.joinPendingRoomId !== null}
                class="flex items-center gap-2 px-6 py-2.5 rounded-full bg-discord-accent hover:bg-discord-accentHover text-white font-medium transition-colors disabled:opacity-60"
            >
                <Phone size={20} />
                {joining ? "Joining…" : "Join Call"}
            </button>
        {/if}
    </div>
</div>

<!-- CallParticipantMenu brings its own Portal + backdrop — don't wrap it. -->
{#if participantMenu}
    <CallParticipantMenu
        {room}
        userId={participantMenu.userId}
        x={participantMenu.x}
        y={participantMenu.y}
        touch={participantMenu.touch}
        onClose={() => {
            participantMenu = null;
            clearModalIfOwner(participantMenuToken);
        }}
    />
{/if}

<!-- The profile card lives in MessageArea too, but AppShell renders CallView
     INSTEAD of MessageArea during a call (mutually exclusive), so without this
     mount the "Profile" entry in a call-tile menu opens a card nothing renders.
     Only one of the two is ever mounted, so there is never a double instance. -->
<UserProfileCard {room} />
