<script lang="ts">
    import type { Room } from "matrix-js-sdk";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import { auth } from "$lib/stores/auth.svelte";
    import { interfaceState } from "$lib/stores/interface.svelte";
    import {
        profileCardState,
        closeProfileCard,
    } from "$lib/stores/profileCard.svelte";
    import { roomsState, setActiveRoom } from "$lib/stores/rooms.svelte";
    import { presenceState, presenceFor } from "$lib/stores/presence.svelte";
    import {
        isUserBlocked,
        blockUser,
        unblockUser,
    } from "$lib/stores/ignoredUsers.svelte";
    import {
        getMemberAvatar,
        getMutualRoomsWith,
        getMyPowerLevel,
        getUserPowerLevel,
        getRoomPowerLevels,
        createDirectMessage,
        kickUser,
        banUser,
    } from "$lib/matrix/client";
    import {
        presenceDot,
        presenceDotClass,
        presenceLabel,
    } from "$lib/utils/presence";
    import {
        popoutPosition,
        summarizeMutualRooms,
    } from "$lib/utils/profileCard";
    import { isCryptoAvailable, getUserTrust } from "$lib/matrix/crypto";
    import { userTrustBadge } from "$lib/utils/verification";
    import {
        verificationState,
        verifyUser,
    } from "$lib/stores/verification.svelte";

    interface Props {
        room: Room;
    }

    let { room }: Props = $props();

    const open = $derived(
        interfaceState.modal === "profile-card" &&
            profileCardState.userId !== null,
    );
    const userId = $derived(profileCardState.userId ?? "");
    const isSelf = $derived(userId === auth.userId);

    // Live SDK objects mutate in place — depend on the ticks so kicks/bans,
    // membership and presence changes re-render the open card.
    const member = $derived(
        (void roomsState.roomsTick, userId ? room.getMember(userId) : null),
    );
    const displayName = $derived(member?.name || userId);
    const avatarSrc = $derived(
        (void roomsState.roomsTick,
        userId ? getMemberAvatar(room, userId) : null),
    );
    const presence = $derived(
        (void presenceState.presenceTick, userId ? presenceFor(userId) : null),
    );
    const dotState = $derived(presence?.state ?? "offline");

    const mutual = $derived.by(() => {
        void roomsState.roomsTick;
        if (!userId || isSelf) return { shown: [], moreCount: 0, total: 0 };
        const rooms = getMutualRoomsWith(userId);
        return {
            ...summarizeMutualRooms(rooms.map((r) => r.name)),
            total: rooms.length,
        };
    });

    const myPowerLevel = $derived(
        (void roomsState.roomsTick, getMyPowerLevel(room)),
    );
    const pl = $derived((void roomsState.roomsTick, getRoomPowerLevels(room)));
    const canActOnTarget = $derived(
        !isSelf &&
            !!member &&
            myPowerLevel > getUserPowerLevel(room, member.userId),
    );
    const canKickTarget = $derived(canActOnTarget && myPowerLevel >= pl.kick);
    const canBanTarget = $derived(canActOnTarget && myPowerLevel >= pl.ban);
    const blocked = $derived(isUserBlocked(userId));

    let pending = $state<
        null | "message" | "block" | "kick" | "ban" | "verify"
    >(null);
    let confirming = $state<null | "kick" | "ban">(null);
    let errorMsg = $state<string | null>(null);
    let copied = $state(false);
    let copyTimeout: ReturnType<typeof setTimeout> | undefined;

    // Verification trust (Layer 1). Reloaded on retarget and whenever a
    // verification completes (verificationTick).
    let userTrust = $state<{
        isVerified: boolean;
        needsApproval?: boolean;
        known?: boolean;
    } | null>(null);
    const trustBadge = $derived(
        !isSelf && userId && isCryptoAvailable()
            ? userTrustBadge(userTrust)
            : null,
    );

    async function loadTrust() {
        userTrust = null;
        if (isSelf || !userId || !isCryptoAvailable()) return;
        userTrust = await getUserTrust(userId);
    }

    // Reset transient state whenever the card retargets or closes.
    $effect(() => {
        void profileCardState.userId;
        pending = null;
        confirming = null;
        errorMsg = null;
        copied = false;
        loadTrust();
    });

    // Refresh trust when a verification finishes (tick bumps on Done).
    $effect(() => {
        void verificationState.verificationTick;
        loadTrust();
    });

    async function startVerifyUser() {
        pending = "verify";
        errorMsg = null;
        try {
            await verifyUser(userId);
        } catch (e) {
            errorMsg =
                e instanceof Error ? e.message : "Could not start verification";
        } finally {
            pending = null;
        }
    }

    // Position: measured card size against the stored anchor, viewport-clamped.
    let innerWidth = $state(0);
    let innerHeight = $state(0);
    let cardW = $state(0);
    let cardH = $state(0);
    const position = $derived.by(() => {
        const anchor = profileCardState.anchor;
        if (!anchor) return { left: 0, top: 0 };
        return popoutPosition(
            anchor,
            { width: cardW || 288, height: cardH || 380 },
            { width: innerWidth, height: innerHeight },
        );
    });
    const asSheet = $derived(interfaceState.isTouchscreen);

    async function copyUserId() {
        try {
            await navigator.clipboard.writeText(userId);
            copied = true;
            clearTimeout(copyTimeout);
            copyTimeout = setTimeout(() => (copied = false), 1500);
        } catch {
            errorMsg = "Could not copy to clipboard";
        }
    }

    async function openDM() {
        pending = "message";
        errorMsg = null;
        try {
            const roomId = await createDirectMessage(userId);
            closeProfileCard();
            setActiveRoom(roomId);
        } catch (e) {
            errorMsg = e instanceof Error ? e.message : "Could not open DM";
        } finally {
            pending = null;
        }
    }

    async function toggleBlock() {
        pending = "block";
        errorMsg = null;
        try {
            if (blocked) await unblockUser(userId);
            else await blockUser(userId);
        } catch (e) {
            errorMsg =
                e instanceof Error ? e.message : "Could not update block list";
        } finally {
            pending = null;
        }
    }

    async function doModeration(action: "kick" | "ban") {
        if (confirming !== action) {
            confirming = action;
            return;
        }
        pending = action;
        errorMsg = null;
        try {
            if (action === "kick") await kickUser(room.roomId, userId);
            else await banUser(room.roomId, userId);
            closeProfileCard();
        } catch (e) {
            errorMsg = e instanceof Error ? e.message : `Could not ${action}`;
            confirming = null;
        } finally {
            pending = null;
        }
    }
</script>

<svelte:window bind:innerWidth bind:innerHeight />

{#if open}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div
        class="fixed inset-0 z-40 {asSheet ? 'bg-black/50' : ''}"
        onclick={closeProfileCard}
    ></div>
    <div
        bind:clientWidth={cardW}
        bind:clientHeight={cardH}
        class="z-50 bg-discord-backgroundSecondary border border-discord-divider shadow-xl overflow-hidden {asSheet
            ? 'fixed inset-x-0 bottom-0 rounded-t-xl pb-[env(safe-area-inset-bottom)]'
            : 'fixed w-72 rounded-lg'}"
        style={asSheet
            ? ""
            : `left: ${position.left}px; top: ${position.top}px;`}
    >
        <!-- Banner -->
        <div class="h-16 bg-discord-accent"></div>

        <div class="px-4 pb-4">
            <!-- Avatar overlapping the banner -->
            <div class="relative -mt-8 mb-2 w-fit">
                <div
                    class="rounded-full border-4 border-discord-backgroundSecondary"
                >
                    <Avatar
                        src={avatarSrc}
                        name={displayName}
                        id={userId}
                        size={64}
                    />
                </div>
                <div
                    title={presenceLabel(dotState)}
                    class="absolute bottom-1 right-1 w-4 h-4 {presenceDotClass(
                        presenceDot(dotState),
                    )} rounded-full border-2 border-discord-backgroundSecondary"
                ></div>
            </div>

            <div class="flex items-center gap-1.5 min-w-0">
                <p class="font-bold text-discord-textPrimary truncate">
                    {displayName}
                </p>
                {#if trustBadge}
                    <span
                        class="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase {trustBadge.tone ===
                        'verified'
                            ? 'bg-discord-online/20 text-discord-online'
                            : trustBadge.tone === 'warning'
                              ? 'bg-discord-warning/20 text-discord-warning'
                              : 'bg-discord-messageHover text-discord-textMuted'}"
                        >{trustBadge.label}</span
                    >
                {/if}
            </div>
            <div class="flex items-center gap-1 min-w-0">
                <p class="text-xs text-discord-textMuted truncate">{userId}</p>
                <button
                    onclick={copyUserId}
                    class="flex-shrink-0 p-1 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
                    title="Copy user ID"
                >
                    {#if copied}
                        <span class="text-xs text-discord-online">Copied</span>
                    {:else}
                        <svg
                            class="w-3.5 h-3.5"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                            ><path
                                d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"
                            /></svg
                        >
                    {/if}
                </button>
            </div>
            {#if presence?.statusMsg}
                <p class="mt-1 text-xs text-discord-textSecondary truncate">
                    {presence.statusMsg}
                </p>
            {/if}
            {#if !member && !isSelf}
                <p class="mt-1 text-xs text-discord-textMuted">
                    Not a member of this room
                </p>
            {/if}

            {#if !isSelf && mutual.total > 0}
                <div class="mt-3 pt-3 border-t border-discord-divider">
                    <p
                        class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1"
                    >
                        Mutual rooms — {mutual.total}
                    </p>
                    {#each mutual.shown as name (name)}
                        <p class="text-xs text-discord-textSecondary truncate">
                            #{name}
                        </p>
                    {/each}
                    {#if mutual.moreCount > 0}
                        <p class="text-xs text-discord-textMuted">
                            +{mutual.moreCount} more
                        </p>
                    {/if}
                </div>
            {/if}

            {#if !isSelf}
                <div
                    class="mt-3 pt-3 border-t border-discord-divider space-y-1.5"
                >
                    <button
                        onclick={openDM}
                        disabled={pending !== null}
                        class="w-full px-3 py-1.5 rounded bg-discord-accent hover:bg-discord-accentHover text-white text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                        {pending === "message" ? "Opening…" : "Message"}
                    </button>
                    {#if trustBadge && trustBadge.tone !== "verified"}
                        <button
                            onclick={startVerifyUser}
                            disabled={pending !== null}
                            class="w-full px-3 py-1.5 rounded bg-discord-backgroundTertiary hover:bg-discord-messageHover text-discord-textPrimary text-sm font-semibold transition-colors disabled:opacity-50"
                        >
                            {pending === "verify" ? "Starting…" : "Verify user"}
                        </button>
                    {/if}
                    <button
                        onclick={toggleBlock}
                        disabled={pending !== null}
                        class="w-full px-3 py-1.5 rounded bg-discord-backgroundTertiary hover:bg-discord-messageHover text-sm font-semibold transition-colors disabled:opacity-50 {blocked
                            ? 'text-discord-textPrimary'
                            : 'text-discord-danger'}"
                    >
                        {pending === "block"
                            ? "Saving…"
                            : blocked
                              ? "Unblock"
                              : "Block"}
                    </button>
                    {#if canKickTarget || canBanTarget}
                        <div class="flex gap-1.5">
                            {#if canKickTarget}
                                <button
                                    onclick={() => doModeration("kick")}
                                    disabled={pending !== null}
                                    class="flex-1 px-3 py-1.5 rounded bg-discord-backgroundTertiary hover:bg-discord-warning/20 text-discord-warning text-sm font-semibold transition-colors disabled:opacity-50"
                                >
                                    {pending === "kick"
                                        ? "Kicking…"
                                        : confirming === "kick"
                                          ? "Confirm kick?"
                                          : "Kick"}
                                </button>
                            {/if}
                            {#if canBanTarget}
                                <button
                                    onclick={() => doModeration("ban")}
                                    disabled={pending !== null}
                                    class="flex-1 px-3 py-1.5 rounded bg-discord-backgroundTertiary hover:bg-discord-danger/20 text-discord-danger text-sm font-semibold transition-colors disabled:opacity-50"
                                >
                                    {pending === "ban"
                                        ? "Banning…"
                                        : confirming === "ban"
                                          ? "Confirm ban?"
                                          : "Ban"}
                                </button>
                            {/if}
                        </div>
                    {/if}
                </div>
            {/if}

            {#if errorMsg}
                <p class="mt-2 text-xs text-discord-danger">{errorMsg}</p>
            {/if}
        </div>
    </div>
{/if}
