<script lang="ts">
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
        Video,
        VideoOff,
        MonitorUp,
    } from "lucide-svelte";
    import { longPress } from "$lib/actions/longPress";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import CallParticipantMenu from "$lib/components/layout/CallParticipantMenu.svelte";
    import VideoTile from "$lib/components/layout/VideoTile.svelte";
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
    } from "$lib/stores/voiceCall.svelte";
    import { dedupeParticipants } from "$lib/utils/voiceCall";
    import { canScreenShare } from "$lib/utils/videoTiles";
    import {
        showChatView,
        openModal,
        clearModal,
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
    const screenShareSupported = canScreenShare({
        getDisplayMedia:
            typeof navigator !== "undefined"
                ? navigator.mediaDevices?.getDisplayMedia
                : undefined,
    });

    // Live SDK objects mutate in place, so every read of call/room state hangs
    // off a tick: voiceTick for the roster, roomsTick for names and avatars.
    const participants = $derived(
        (void voiceCallState.voiceTick,
        dedupeParticipants(getRoomCallMemberships(room))),
    );
    const inThisCall = $derived(voiceCallState.roomId === room.roomId);
    const speaking = $derived(new Set(voiceCallState.speakingMemberIds));
    // Contract: an identity absent from this set is unmuted, never "unknown".
    const muted = $derived(new Set(voiceCallState.mutedIdentities));

    // Video tiles for THIS call (empty unless we are connected here). Split so
    // a camera can replace a participant's avatar while their screenshare gets
    // its own tile. Gated on voiceTick like every other live-object read.
    const cameraByIdentity = $derived(
        (void voiceCallState.voiceTick,
        new Map(
            voiceCallState.videoTiles
                .filter((t) => t.source === "camera")
                .map((t) => [t.identity, t]),
        )),
    );
    const screenTiles = $derived(
        (void voiceCallState.voiceTick,
        voiceCallState.videoTiles.filter((t) => t.source === "screenshare")),
    );
    const focusedTile = $derived(
        (void voiceCallState.voiceTick,
        voiceCallState.videoTiles.find(
            (t) => t.key === voiceCallState.focusedTileKey,
        ) ?? null),
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
    function openParticipantMenu(
        userId: string,
        x: number,
        y: number,
        touch: boolean,
    ) {
        participantMenu = { userId, x, y, touch };
        openModal("call-participant-menu", () => (participantMenu = null));
    }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="flex-1 flex flex-col min-w-0 bg-discord-backgroundTertiary">
    <!-- Header -->
    <div
        class="h-12 px-4 flex items-center gap-2 flex-shrink-0 border-b border-discord-divider bg-discord-background"
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
    <div class="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3">
        {#if focusedTile}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div
                class="flex-1 min-h-0 rounded-lg overflow-hidden cursor-zoom-out"
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
            </div>
        {/if}

        {#if participants.length === 0 && screenTiles.length === 0}
            <div
                class="flex-1 flex flex-col items-center justify-center gap-3 text-discord-textMuted"
            >
                <Volume2 size={40} />
                <p class="text-sm">No one is in this call</p>
            </div>
        {:else}
            <div
                class="grid gap-3 {focusedTile ? 'flex-shrink-0' : ''}"
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
                        class="relative aspect-video rounded-lg overflow-hidden bg-discord-backgroundSecondary flex items-center justify-center border-2 {speaking.has(
                            identity,
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
                            {#if muted.has(identity)}
                                <div
                                    class="absolute top-2 left-2 flex items-center px-1.5 py-0.5 rounded bg-black/60"
                                >
                                    <MicOff
                                        size={12}
                                        class="text-discord-danger flex-shrink-0"
                                    />
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
                                {#if muted.has(identity)}
                                    <MicOff
                                        size={12}
                                        class="text-discord-danger flex-shrink-0"
                                    />
                                {/if}
                                <span class="text-xs text-white truncate"
                                    >{name}</span
                                >
                            </div>
                        {/if}
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
        {#if inThisCall}
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
        {:else}
            <button
                onclick={() => joinCall(room.roomId)}
                disabled={voiceCallState.joinPendingRoomId !== null}
                class="flex items-center gap-2 px-6 py-2.5 rounded-full bg-discord-accent hover:bg-discord-accentHover text-white font-medium transition-colors disabled:opacity-60"
            >
                <Phone size={18} />
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
            clearModal("call-participant-menu");
        }}
    />
{/if}
