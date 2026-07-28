<script lang="ts">
    import type { Room, RoomMember } from "matrix-js-sdk";
    import { untrack } from "svelte";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import InvitePanel from "./InvitePanel.svelte";
    import ImagePackEditor from "./ImagePackEditor.svelte";
    import {
        canInviteToRoom,
        getMyPowerLevel,
        getUserPowerLevel,
        getRoomPowerLevels,
        setRoomPowerLevels,
        setUserPowerLevel,
        kickUser,
        banUser,
        unbanUser,
        getBannedMembers,
        setRoomName,
        setRoomTopic,
        setRoomAvatar,
        uploadContent,
        getJoinRule,
        setJoinRule,
        getDirectParentSpaceIds,
        setRestrictedJoinRule,
        getRoom,
        getHistoryVisibility,
        setHistoryVisibility,
        getRoomDirectoryVisibility,
        setRoomDirectoryVisibility,
        getSpaceChildren,
        setSpaceChildOrder,
        removeSpaceChild,
        getRoomMembers,
        getRoomAvatar,
        getRoomTopic,
        enableRoomEncryption,
        mxcToHttp,
        upgradeRoomToVersion,
        getRoomVersionCapability,
        type SpaceChildEntry,
    } from "$lib/matrix/client";
    import {
        getRestrictedJoinState,
        RESTRICTED_JOIN_RULE,
    } from "$lib/utils/joinRules";
    import { parsePowerLevelInput } from "$lib/utils/powerLevels";
    import { getRoomUpgradeState } from "$lib/utils/roomUpgrade";
    import {
        roomSettingsNavView,
        roomSettingsTabs,
        type RoomSettingsTab,
    } from "$lib/utils/roomSettingsNav";
    import { focusTrap } from "$lib/actions/focusTrap";

    import { isRoomEncrypted } from "$lib/matrix/crypto";
    import {
        getEnableEncryptionState,
        matchesEnableEncryptionConfirmation,
        ENABLE_ENCRYPTION_CONFIRM_PHRASE,
        ENABLE_ENCRYPTION_WARNING,
    } from "$lib/utils/roomEncryption";
    import { auth } from "$lib/stores/auth.svelte";
    import { interfaceState } from "$lib/stores/interface.svelte";
    import { roomsState, setActiveRoom } from "$lib/stores/rooms.svelte";
    import {
        blockUser,
        unblockUser,
        isUserBlocked,
    } from "$lib/stores/ignoredUsers.svelte";

    interface Props {
        room: Room;
        onClose: () => void;
        onUpdate?: () => void;
    }

    let { room, onClose, onUpdate }: Props = $props();

    // null = "nothing drilled into yet": the mobile category list, or the
    // desktop default panel. Kept across a viewport change in both directions
    // so resizing/rotating never loses the user's place.
    let selectedTab = $state<RoomSettingsTab | null>(null);

    const isSpace = $derived(room.isSpaceRoom());

    const view = $derived(
        roomSettingsNavView({
            isMobile: interfaceState.isMobile,
            isSpace,
            selectedTab,
        }),
    );

    // The tab whose panel is on screen, or null on the mobile category list
    // where no panel is mounted. The lazy-load effects below gate on this, so
    // sitting on the list must not kick off a fetch.
    const activeTab = $derived<RoomSettingsTab | null>(
        view.mode === "list" ? null : view.tab,
    );
    const myPowerLevel = $derived(getMyPowerLevel(room));
    const pl = $derived(getRoomPowerLevels(room));
    const canEditState = $derived(myPowerLevel >= pl.state_default);
    const canEditEmojis = $derived(
        myPowerLevel >=
            (pl.events?.["im.ponies.room_emotes"] ?? pl.state_default),
    );
    const canKick = $derived(myPowerLevel >= pl.kick);
    const canBan = $derived(myPowerLevel >= pl.ban);

    // ── Members tab: inline invite ─────────────────────────────────────────────
    let showInvite = $state(false);
    const canInvite = $derived(
        (void roomsState.roomsTick, canInviteToRoom(room.roomId)),
    );

    // ── Security tab: encryption ───────────────────────────────────────────────
    // Depend on roomsTick: the Room mutates in place when the m.room.encryption
    // state event lands, so the status flips without reopening the modal.
    const encrypted = $derived(
        (void roomsState.roomsTick, isRoomEncrypted(room)),
    );
    const encState = $derived(
        getEnableEncryptionState({
            alreadyEncrypted: encrypted,
            myPowerLevel,
            powerLevels: pl,
        }),
    );
    let encShowConfirm = $state(false);
    let encConfirmInput = $state("");
    let encEnabling = $state(false);
    let encError = $state("");

    async function doEnableEncryption() {
        if (!matchesEnableEncryptionConfirmation(encConfirmInput)) return;
        encEnabling = true;
        encError = "";
        try {
            await enableRoomEncryption(room.roomId);
            roomsState.roomsTick++;
            encShowConfirm = false;
            encConfirmInput = "";
        } catch (e: any) {
            encError =
                e?.data?.error ?? e?.message ?? "Failed to enable encryption";
        } finally {
            encEnabling = false;
        }
    }

    // ── General tab ────────────────────────────────────────────────────────────
    let nameInput = $state(untrack(() => room.name ?? ""));
    let topicInput = $state(untrack(() => getRoomTopic(room) ?? ""));
    let avatarUploading = $state(false);
    let generalSaving = $state(false);
    let generalError = $state("");
    let generalSuccess = $state(false);

    const currentAvatarUrl = $derived(getRoomAvatar(room));

    async function saveGeneral() {
        generalError = "";
        generalSaving = true;
        try {
            const promises: Promise<void>[] = [];
            if (nameInput.trim() && nameInput.trim() !== room.name) {
                promises.push(setRoomName(room.roomId, nameInput.trim()));
            }
            const currentTopic = getRoomTopic(room) ?? "";
            if (topicInput !== currentTopic) {
                promises.push(setRoomTopic(room.roomId, topicInput));
            }
            await Promise.all(promises);
            generalSuccess = true;
            setTimeout(() => (generalSuccess = false), 2000);
        } catch (e: any) {
            generalError = e?.message ?? "Failed to save";
        } finally {
            generalSaving = false;
        }
    }

    async function handleAvatarUpload(e: Event) {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        avatarUploading = true;
        generalError = "";
        try {
            const mxcUrl = await uploadContent(file);
            await setRoomAvatar(room.roomId, mxcUrl);
        } catch (err: any) {
            generalError = err?.message ?? "Upload failed";
        } finally {
            avatarUploading = false;
        }
    }

    // ── General tab: Advanced → room upgrade ───────────────────────────────────
    // The room-version capability is server-global; load it once when General
    // opens (mirrors the Access-tab dirLoaded pattern). Skipped for spaces
    // (upgrade is gated to non-space rooms in v1).
    let roomVersionCap = $state<{
        default: string;
        available: string[];
    } | null>(null);

    $effect(() => {
        if (activeTab !== "general" || roomVersionCap || isSpace) return;
        untrack(() => {
            getRoomVersionCapability()
                .then((cap) => (roomVersionCap = cap))
                .catch(() => (roomVersionCap = { default: "", available: [] }));
        });
    });

    // Tick-dependent so power/version refresh on sync (the reactivity landmine).
    const tombstoneLevel = $derived(
        pl.events?.["m.room.tombstone"] ?? pl.state_default,
    );
    const upgradeState = $derived(
        (void roomsState.roomsTick,
        getRoomUpgradeState({
            currentVersion: room.getVersion(),
            defaultVersion: roomVersionCap?.default ?? "",
            availableVersions: roomVersionCap?.available ?? [],
            myPowerLevel,
            tombstonePowerLevel: tombstoneLevel,
        })),
    );

    let upgradeShowConfirm = $state(false);
    let upgrading = $state(false);
    let upgradeError = $state("");

    async function doUpgradeRoom() {
        upgrading = true;
        upgradeError = "";
        try {
            const newRoomId = await upgradeRoomToVersion(
                room.roomId,
                upgradeState.recommendedVersion,
            );
            upgradeShowConfirm = false;
            onClose();
            setActiveRoom(newRoomId);
        } catch (e: any) {
            upgradeError =
                e?.data?.error ?? e?.message ?? "Failed to upgrade room";
        } finally {
            upgrading = false;
        }
    }

    // ── Access tab ─────────────────────────────────────────────────────────────
    let joinRule = $state(untrack(() => getJoinRule(room)));
    let historyVisibility = $state(untrack(() => getHistoryVisibility(room)));
    let accessSaving = $state(false);
    let accessError = $state("");
    let accessSuccess = $state(false);

    const parentSpaceIds = $derived(
        (void roomsState.roomsTick, getDirectParentSpaceIds(room.roomId)),
    );
    const restrictedJoin = $derived(
        getRestrictedJoinState({
            roomVersion: room.getVersion(),
            parentSpaceIds,
            canEditState,
        }),
    );
    const parentSpaceNames = $derived(
        parentSpaceIds
            .map((id) => getRoom(id)?.name)
            .filter((n): n is string => !!n)
            .join(", "),
    );

    async function saveAccess() {
        accessError = "";
        accessSaving = true;
        try {
            const promises: Promise<void>[] = [];
            if (joinRule === RESTRICTED_JOIN_RULE) {
                promises.push(
                    setRestrictedJoinRule(room.roomId, parentSpaceIds),
                );
            } else if (joinRule !== getJoinRule(room)) {
                promises.push(setJoinRule(room.roomId, joinRule));
            }
            if (historyVisibility !== getHistoryVisibility(room))
                promises.push(
                    setHistoryVisibility(room.roomId, historyVisibility),
                );
            await Promise.all(promises);
            accessSuccess = true;
            setTimeout(() => (accessSuccess = false), 2000);
        } catch (e: any) {
            accessError = e?.message ?? "Failed to save";
        } finally {
            accessSaving = false;
        }
    }

    // ── Access tab: directory visibility (separate server call) ─────────────────
    let dirVisibility = $state<"public" | "private">("private");
    let dirLoaded = $state(false);
    let dirSaving = $state(false);
    let dirError = $state("");

    $effect(() => {
        if (activeTab !== "access" || dirLoaded) return;
        getRoomDirectoryVisibility(room.roomId)
            .then((v) => {
                dirVisibility = v;
                dirLoaded = true;
            })
            .catch(() => (dirLoaded = true));
    });

    async function toggleDirVisibility(next: "public" | "private") {
        if (dirSaving || next === dirVisibility) return;
        dirSaving = true;
        dirError = "";
        const prev = dirVisibility;
        dirVisibility = next;
        try {
            await setRoomDirectoryVisibility(room.roomId, next);
        } catch (e: any) {
            dirVisibility = prev;
            dirError =
                e?.data?.error ?? e?.message ?? "Could not change visibility";
        } finally {
            dirSaving = false;
        }
    }

    // ── Permissions tab ────────────────────────────────────────────────────────
    let plBan = $state(untrack(() => pl.ban));
    let plKick = $state(untrack(() => pl.kick));
    let plRedact = $state(untrack(() => pl.redact));
    let plInvite = $state(untrack(() => pl.invite));
    let plEventsDefault = $state(untrack(() => pl.events_default));
    let plStateDefault = $state(untrack(() => pl.state_default));
    let plUsersDefault = $state(untrack(() => pl.users_default));
    // Frozen snapshot of the levels the editor was seeded with, so a Save can
    // tell whether the user actually changed anything. Without this guard,
    // saving in a room that has NO m.room.power_levels event would materialize a
    // full PL event out of the defaults even on a no-op save.
    const permInitial = untrack(() => ({
        ban: pl.ban,
        kick: pl.kick,
        redact: pl.redact,
        invite: pl.invite,
        events_default: pl.events_default,
        state_default: pl.state_default,
        users_default: pl.users_default,
    }));
    let permSaving = $state(false);
    let permError = $state("");
    let permSuccess = $state(false);

    async function savePermissions() {
        permError = "";
        // No-op save guard: if nothing changed, don't write a PL event (which,
        // in a room with none, would create one from the defaults).
        const changed =
            plBan !== permInitial.ban ||
            plKick !== permInitial.kick ||
            plRedact !== permInitial.redact ||
            plInvite !== permInitial.invite ||
            plEventsDefault !== permInitial.events_default ||
            plStateDefault !== permInitial.state_default ||
            plUsersDefault !== permInitial.users_default;
        if (!changed) {
            permSuccess = true;
            setTimeout(() => (permSuccess = false), 2000);
            return;
        }
        permSaving = true;
        try {
            await setRoomPowerLevels(room, {
                ban: plBan,
                kick: plKick,
                redact: plRedact,
                invite: plInvite,
                events_default: plEventsDefault,
                state_default: plStateDefault,
                users_default: plUsersDefault,
            });
            permSuccess = true;
            setTimeout(() => (permSuccess = false), 2000);
        } catch (e: any) {
            permError = e?.message ?? "Failed to save";
        } finally {
            permSaving = false;
        }
    }

    // ── Members tab ────────────────────────────────────────────────────────────
    let memberSearch = $state("");
    let showBanned = $state(false);
    let memberActionPending = $state<string | null>(null);
    let memberError = $state("");
    let plDrafts = $state<Record<string, string>>({});
    let reasonInputs = $state<Record<string, string>>({});
    let showReasonFor = $state<string | null>(null);

    // Depend on roomsTick (bumped every sync + on membership changes) so the
    // list and power-level badges refresh after a kick/ban/role change echoes
    // back from the server, rather than only when the modal is reopened.
    const allMembers = $derived(
        (void roomsState.roomsTick, getRoomMembers(room)),
    );
    const bannedMembers = $derived(
        (void roomsState.roomsTick, getBannedMembers(room)),
    );

    const filteredMembers = $derived(
        allMembers
            .filter(
                (m) =>
                    !memberSearch ||
                    m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
                    m.userId.toLowerCase().includes(memberSearch.toLowerCase()),
            )
            .sort(
                (a, b) =>
                    getUserPowerLevel(room, b.userId) -
                        getUserPowerLevel(room, a.userId) ||
                    a.name.localeCompare(b.name),
            ),
    );

    async function doKick(userId: string) {
        memberActionPending = userId;
        memberError = "";
        try {
            await kickUser(room.roomId, userId, reasonInputs[userId]);
            showReasonFor = null;
        } catch (e: any) {
            memberError = e?.message ?? "Failed";
        } finally {
            memberActionPending = null;
        }
    }

    async function doBan(userId: string) {
        memberActionPending = userId;
        memberError = "";
        try {
            await banUser(room.roomId, userId, reasonInputs[userId]);
            showReasonFor = null;
        } catch (e: any) {
            memberError = e?.message ?? "Failed";
        } finally {
            memberActionPending = null;
        }
    }

    async function doToggleBlock(userId: string) {
        memberActionPending = userId;
        memberError = "";
        try {
            if (isUserBlocked(userId)) await unblockUser(userId);
            else await blockUser(userId);
        } catch (e: any) {
            memberError = e?.message ?? "Failed";
        } finally {
            memberActionPending = null;
        }
    }

    async function doUnban(userId: string) {
        memberActionPending = userId;
        memberError = "";
        try {
            await unbanUser(room.roomId, userId);
        } catch (e: any) {
            memberError = e?.message ?? "Failed";
        } finally {
            memberActionPending = null;
        }
    }

    async function doSetPowerLevel(member: RoomMember, level: number) {
        memberActionPending = member.userId;
        memberError = "";
        try {
            await setUserPowerLevel(room, member.userId, level);
        } catch (e: any) {
            memberError = e?.message ?? "Failed";
        } finally {
            memberActionPending = null;
        }
    }

    function plLabel(level: number): string {
        if (level >= 100) return "Admin";
        if (level >= 50) return "Moderator";
        return "Member";
    }

    // ── Rooms tab (spaces only) ────────────────────────────────────────────────
    let spaceChildren = $state<SpaceChildEntry[]>([]);
    let roomsError = $state("");
    let roomActionPending = $state<string | null>(null);
    let orderEdits = $state<Record<string, string>>({});

    function sortChildren(children: SpaceChildEntry[]) {
        return [...children].sort((a, b) => {
            if (a.order && b.order) return a.order.localeCompare(b.order);
            if (a.order) return -1;
            if (b.order) return 1;
            return a.name.localeCompare(b.name);
        });
    }

    function loadChildren() {
        const hierarchyMap = new Map(
            roomsState.spaceHierarchy.map((r) => [r.roomId, r]),
        );
        const children = getSpaceChildren(room).map((c) => {
            const h = hierarchyMap.get(c.roomId);
            return {
                ...c,
                name: c.isJoined ? c.name : (h?.name ?? c.name),
                avatarUrl: c.isJoined
                    ? c.avatarUrl
                    : (h?.avatarUrl ?? c.avatarUrl),
            };
        });
        spaceChildren = sortChildren(children);
        // Reset input values to match current server state
        orderEdits = Object.fromEntries(
            spaceChildren.map((c) => [c.roomId, c.order]),
        );
    }

    $effect(() => {
        const tab = activeTab;
        const space = isSpace;
        untrack(() => {
            if (tab === "rooms" && space) {
                orderEdits = {}; // reset so loadChildren sets fresh values
                loadChildren();
            }
        });
    });

    async function saveOrder(child: SpaceChildEntry) {
        roomActionPending = child.roomId;
        roomsError = "";
        try {
            const newOrder = orderEdits[child.roomId] ?? "";
            await setSpaceChildOrder(
                room.roomId,
                child.roomId,
                newOrder,
                child.via,
            );
            // Update child's order directly and re-sort (server state may not have synced yet)
            spaceChildren = sortChildren(
                spaceChildren.map((c) =>
                    c.roomId === child.roomId ? { ...c, order: newOrder } : c,
                ),
            );
            onUpdate?.();
        } catch (e: any) {
            roomsError = e?.message ?? "Failed";
        } finally {
            roomActionPending = null;
        }
    }

    async function doRemoveChild(child: SpaceChildEntry) {
        roomActionPending = child.roomId;
        roomsError = "";
        try {
            await removeSpaceChild(room.roomId, child.roomId);
            spaceChildren = spaceChildren.filter(
                (c) => c.roomId !== child.roomId,
            );
            onUpdate?.();
        } catch (e: any) {
            roomsError = e?.message ?? "Failed";
        } finally {
            roomActionPending = null;
        }
    }

    const tabs = $derived(roomSettingsTabs({ isSpace }));
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4">
    <button
        type="button"
        aria-label="Close settings"
        class="absolute inset-0 bg-black/60"
        onclick={onClose}
    ></button>
    <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-settings-title"
        class="relative z-10 bg-discord-backgroundSecondary rounded-none md:rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden h-[100dvh] md:h-[85dvh]"
        use:focusTrap={{ onEscape: onClose }}
    >
        <!-- Header -->
        <div
            class="flex items-center justify-between px-6 py-4 border-b border-discord-divider flex-shrink-0"
        >
            <h2
                id="room-settings-title"
                class="text-lg font-bold text-discord-textPrimary truncate"
            >
                {room.name} — Settings
            </h2>
            <button
                onclick={onClose}
                aria-label="Close settings"
                class="p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors flex-shrink-0"
            >
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"
                    ><path
                        d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                    /></svg
                >
            </button>
        </div>

        <div class="flex flex-col md:flex-row flex-1 min-h-0">
            <!-- Tab bar: horizontal scrollable strip on mobile, sidebar on desktop -->
            <nav
                class="flex flex-row md:flex-col flex-shrink-0 w-full md:w-40 gap-1 md:gap-0.5 overflow-x-auto md:overflow-x-visible border-b md:border-b-0 md:border-r border-discord-divider px-2 py-2 md:py-3"
            >
                {#each tabs as tab (tab.id)}
                    <button
                        onclick={() => {
                            selectedTab = tab.id;
                            showInvite = false;
                        }}
                        class="flex-shrink-0 w-auto md:w-full whitespace-nowrap text-left px-3 py-2 rounded text-sm font-medium transition-colors"
                        class:bg-discord-messageHover={activeTab === tab.id}
                        class:text-discord-textPrimary={activeTab === tab.id}
                        class:text-discord-textMuted={activeTab !== tab.id}
                        >{tab.label}</button
                    >
                {/each}
            </nav>

            <!-- Tab content -->
            <div class="flex-1 overflow-y-auto p-4 md:p-6 min-w-0">
                <!-- ── General ─────────────────────────────────────────── -->
                {#if activeTab === "general"}
                    <div class="space-y-5">
                        <!-- Avatar -->
                        <div>
                            <p
                                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
                            >
                                Room Avatar
                            </p>
                            <div class="flex items-center gap-4">
                                <div
                                    class="w-16 h-16 rounded-full bg-discord-backgroundTertiary overflow-hidden flex-shrink-0 flex items-center justify-center"
                                >
                                    {#if currentAvatarUrl}
                                        <img
                                            src={currentAvatarUrl}
                                            alt=""
                                            class="w-full h-full object-cover"
                                        />
                                    {:else}
                                        <span
                                            class="text-2xl font-bold text-discord-textMuted"
                                            >{room.name?.[0]?.toUpperCase() ??
                                                "#"}</span
                                        >
                                    {/if}
                                </div>
                                {#if canEditState}
                                    <label
                                        class="cursor-pointer px-3 py-1.5 rounded bg-discord-backgroundTertiary hover:bg-discord-messageHover text-discord-textPrimary text-sm font-medium transition-colors {avatarUploading
                                            ? 'opacity-50 pointer-events-none'
                                            : ''}"
                                    >
                                        {avatarUploading
                                            ? "Uploading…"
                                            : "Upload Image"}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            class="hidden"
                                            onchange={handleAvatarUpload}
                                            disabled={avatarUploading}
                                        />
                                    </label>
                                {/if}
                            </div>
                        </div>

                        <!-- Name -->
                        <div>
                            <label
                                for="room-settings-name"
                                class="block text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1.5"
                                >Room Name</label
                            >
                            <input
                                id="room-settings-name"
                                bind:value={nameInput}
                                disabled={!canEditState}
                                class="w-full bg-discord-backgroundTertiary text-discord-textPrimary text-sm rounded px-3 py-2 outline-none border border-transparent focus:border-discord-accent/50 disabled:opacity-50"
                            />
                        </div>

                        <!-- Topic -->
                        <div>
                            <label
                                for="room-settings-topic"
                                class="block text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1.5"
                                >Topic</label
                            >
                            <textarea
                                id="room-settings-topic"
                                bind:value={topicInput}
                                disabled={!canEditState}
                                rows="3"
                                class="w-full bg-discord-backgroundTertiary text-discord-textPrimary text-sm rounded px-3 py-2 outline-none border border-transparent focus:border-discord-accent/50 resize-none disabled:opacity-50"
                            ></textarea>
                        </div>

                        {#if generalError}<p
                                class="text-sm text-discord-danger"
                            >
                                {generalError}
                            </p>{/if}
                        {#if canEditState}
                            <button
                                onclick={saveGeneral}
                                disabled={generalSaving}
                                class="px-4 py-2 bg-discord-accent hover:bg-discord-accentHover text-white rounded font-medium text-sm transition-colors disabled:opacity-50"
                                >{generalSaving
                                    ? "Saving…"
                                    : generalSuccess
                                      ? "Saved!"
                                      : "Save Changes"}</button
                            >
                        {/if}

                        {#if !isSpace && roomVersionCap}
                            <div
                                class="pt-4 mt-2 border-t border-discord-backgroundTertiary space-y-2"
                            >
                                <p
                                    class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
                                >
                                    Advanced
                                </p>
                                <p class="text-xs text-discord-textMuted">
                                    Room version: v{room.getVersion()}
                                </p>
                                {#if upgradeState.isCurrentLatest || !upgradeState.available}
                                    <p class="text-sm text-discord-textMuted">
                                        {upgradeState.reason}
                                    </p>
                                {:else if !upgradeShowConfirm}
                                    <button
                                        onclick={() => {
                                            upgradeShowConfirm = true;
                                            upgradeError = "";
                                        }}
                                        class="px-4 py-2 bg-discord-danger hover:opacity-90 text-white rounded font-medium text-sm transition-colors"
                                        >Upgrade room…</button
                                    >
                                {:else}
                                    <div class="space-y-2">
                                        <p
                                            class="text-sm text-discord-textPrimary"
                                        >
                                            This creates a new room on v{upgradeState.recommendedVersion}
                                            and marks this one as replaced. Members
                                            will be pointed to the new room.
                                        </p>
                                        {#if upgradeError}<p
                                                class="text-sm text-discord-danger"
                                            >
                                                {upgradeError}
                                            </p>{/if}
                                        <div class="flex gap-2">
                                            <button
                                                onclick={doUpgradeRoom}
                                                disabled={upgrading}
                                                class="px-4 py-2 bg-discord-danger hover:opacity-90 text-white rounded font-medium text-sm transition-colors disabled:opacity-50"
                                                >{upgrading
                                                    ? "Upgrading…"
                                                    : "Upgrade room"}</button
                                            >
                                            <button
                                                onclick={() => {
                                                    upgradeShowConfirm = false;
                                                    upgradeError = "";
                                                }}
                                                disabled={upgrading}
                                                class="px-4 py-2 rounded text-sm font-medium text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors disabled:opacity-50"
                                                >Cancel</button
                                            >
                                        </div>
                                    </div>
                                {/if}
                            </div>
                        {/if}
                    </div>

                    <!-- ── Access ──────────────────────────────────────────── -->
                {:else if activeTab === "access"}
                    <div class="space-y-5">
                        <div>
                            <p
                                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
                            >
                                Who can join?
                            </p>
                            <div class="space-y-1.5">
                                {#each [["invite", "Invite only — members must be invited"], ["knock", "Knock — users can request to join"], ["public", "Public — anyone can join"]] as [value, label]}
                                    <label
                                        class="flex items-center gap-2.5 cursor-pointer {!canEditState
                                            ? 'opacity-50 pointer-events-none'
                                            : ''}"
                                    >
                                        <input
                                            type="radio"
                                            bind:group={joinRule}
                                            {value}
                                            class="accent-discord-accent"
                                        />
                                        <span
                                            class="text-sm text-discord-textPrimary"
                                            >{label}</span
                                        >
                                    </label>
                                {/each}
                                <label
                                    class="flex items-center gap-2.5 cursor-pointer {!restrictedJoin.available
                                        ? 'opacity-50 pointer-events-none'
                                        : ''}"
                                >
                                    <input
                                        type="radio"
                                        bind:group={joinRule}
                                        value={RESTRICTED_JOIN_RULE}
                                        disabled={!restrictedJoin.available}
                                        class="accent-discord-accent"
                                    />
                                    <span
                                        class="text-sm text-discord-textPrimary"
                                        >{parentSpaceNames
                                            ? `Space members — anyone in ${parentSpaceNames} can join`
                                            : "Space members — anyone in the parent space can join"}</span
                                    >
                                </label>
                                {#if restrictedJoin.reason}
                                    <p
                                        class="text-xs text-discord-textMuted ml-6"
                                    >
                                        {restrictedJoin.reason}
                                    </p>
                                {/if}
                            </div>
                        </div>

                        <div>
                            <p
                                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
                            >
                                Message History
                            </p>
                            <div class="space-y-1.5">
                                {#each [["world_readable", "Anyone (including guests)"], ["shared", "Anyone once joined"], ["invited", "Members since invited"], ["joined", "Members since joining"]] as [value, label]}
                                    <label
                                        class="flex items-center gap-2.5 cursor-pointer {!canEditState
                                            ? 'opacity-50 pointer-events-none'
                                            : ''}"
                                    >
                                        <input
                                            type="radio"
                                            bind:group={historyVisibility}
                                            {value}
                                            class="accent-discord-accent"
                                        />
                                        <span
                                            class="text-sm text-discord-textPrimary"
                                            >{label}</span
                                        >
                                    </label>
                                {/each}
                            </div>
                        </div>

                        <div>
                            <p
                                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
                            >
                                Discoverability
                            </p>
                            <label
                                class="flex items-center gap-2.5 cursor-pointer {!canEditState ||
                                dirSaving
                                    ? 'opacity-50 pointer-events-none'
                                    : ''}"
                            >
                                <input
                                    type="checkbox"
                                    checked={dirVisibility === "public"}
                                    onchange={(e) =>
                                        toggleDirVisibility(
                                            e.currentTarget.checked
                                                ? "public"
                                                : "private",
                                        )}
                                    disabled={!canEditState ||
                                        dirSaving ||
                                        !dirLoaded}
                                    class="accent-discord-accent"
                                />
                                <span class="text-sm text-discord-textPrimary"
                                    >List this {isSpace ? "space" : "room"} in the
                                    server directory</span
                                >
                            </label>
                            <p class="text-xs text-discord-textMuted mt-1">
                                Lists the {isSpace ? "space" : "room"} by ID. Being
                                found by name also needs a published address (coming
                                later).
                            </p>
                            {#if dirError}<p
                                    class="text-sm text-discord-danger mt-1"
                                >
                                    {dirError}
                                </p>{/if}
                        </div>

                        {#if accessError}<p class="text-sm text-discord-danger">
                                {accessError}
                            </p>{/if}
                        {#if canEditState}
                            <button
                                onclick={saveAccess}
                                disabled={accessSaving}
                                class="px-4 py-2 bg-discord-accent hover:bg-discord-accentHover text-white rounded font-medium text-sm transition-colors disabled:opacity-50"
                                >{accessSaving
                                    ? "Saving…"
                                    : accessSuccess
                                      ? "Saved!"
                                      : "Save Changes"}</button
                            >
                        {/if}
                    </div>

                    <!-- ── Security ────────────────────────────────────────── -->
                {:else if activeTab === "security"}
                    <div class="space-y-5">
                        <div>
                            <p
                                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
                            >
                                Encryption
                            </p>
                            <span
                                class="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase {encrypted
                                    ? 'bg-discord-accent/20 text-discord-accent'
                                    : 'bg-discord-messageHover text-discord-textMuted'}"
                                >{encrypted
                                    ? "Encrypted"
                                    : "Not encrypted"}</span
                            >
                            <p class="text-xs text-discord-textMuted mt-2">
                                {#if encrypted}
                                    Messages in this room are end-to-end
                                    encrypted. This can't be turned off.
                                {:else}
                                    {ENABLE_ENCRYPTION_WARNING}
                                {/if}
                            </p>
                        </div>

                        {#if !encrypted}
                            {#if !encState.canEnable}
                                <p class="text-sm text-discord-textMuted">
                                    {encState.reason}
                                </p>
                            {:else if !encShowConfirm}
                                <button
                                    onclick={() => {
                                        encShowConfirm = true;
                                        encConfirmInput = "";
                                        encError = "";
                                    }}
                                    class="px-4 py-2 bg-discord-accent hover:bg-discord-accentHover text-white rounded font-medium text-sm transition-colors"
                                    >Enable encryption</button
                                >
                            {:else}
                                <div class="space-y-2">
                                    <label
                                        for="room-settings-enc-confirm"
                                        class="block text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
                                        >Type {ENABLE_ENCRYPTION_CONFIRM_PHRASE} to
                                        confirm</label
                                    >
                                    <input
                                        id="room-settings-enc-confirm"
                                        bind:value={encConfirmInput}
                                        placeholder={ENABLE_ENCRYPTION_CONFIRM_PHRASE}
                                        class="w-full bg-discord-backgroundTertiary text-discord-textPrimary text-sm rounded px-3 py-2 outline-none border border-transparent focus:border-discord-accent/50"
                                    />
                                    {#if encError}<p
                                            class="text-sm text-discord-danger"
                                        >
                                            {encError}
                                        </p>{/if}
                                    <div class="flex gap-2">
                                        <button
                                            onclick={doEnableEncryption}
                                            disabled={encEnabling ||
                                                !matchesEnableEncryptionConfirmation(
                                                    encConfirmInput,
                                                )}
                                            class="px-4 py-2 bg-discord-danger hover:opacity-90 text-white rounded font-medium text-sm transition-colors disabled:opacity-50"
                                            >{encEnabling
                                                ? "Enabling…"
                                                : "Enable encryption"}</button
                                        >
                                        <button
                                            onclick={() => {
                                                encShowConfirm = false;
                                                encConfirmInput = "";
                                                encError = "";
                                            }}
                                            disabled={encEnabling}
                                            class="px-4 py-2 rounded text-sm font-medium text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors disabled:opacity-50"
                                            >Cancel</button
                                        >
                                    </div>
                                </div>
                            {/if}
                        {/if}
                    </div>

                    <!-- ── Permissions ─────────────────────────────────────── -->
                {:else if activeTab === "permissions"}
                    <div class="space-y-4">
                        <p class="text-xs text-discord-textMuted">
                            Power level required for each action (0–100).
                        </p>
                        {#each [["Send messages", "plEventsDefault"], ["Change room settings", "plStateDefault"], ["Default member level", "plUsersDefault"], ["Invite members", "plInvite"], ["Kick members", "plKick"], ["Ban members", "plBan"], ["Redact messages", "plRedact"]] as [label, key]}
                            {@const bindings: Record<string, any> = { plEventsDefault, plStateDefault, plUsersDefault, plInvite, plKick, plBan, plRedact }}
                            {@const setters: Record<string, (v: number) => void> = {
								plEventsDefault: (v) => plEventsDefault = v,
								plStateDefault: (v) => plStateDefault = v,
								plUsersDefault: (v) => plUsersDefault = v,
								plInvite: (v) => plInvite = v,
								plKick: (v) => plKick = v,
								plBan: (v) => plBan = v,
								plRedact: (v) => plRedact = v,
							}}
                            <div
                                class="flex items-center justify-between gap-4"
                            >
                                <span class="text-sm text-discord-textPrimary"
                                    >{label}</span
                                >
                                <div class="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={bindings[key]}
                                        oninput={(e) =>
                                            setters[key](
                                                Number(
                                                    (
                                                        e.target as HTMLInputElement
                                                    ).value,
                                                ),
                                            )}
                                        disabled={!canEditState}
                                        class="w-16 bg-discord-backgroundTertiary text-discord-textPrimary text-sm rounded px-2 py-1 outline-none border border-transparent focus:border-discord-accent/50 text-center disabled:opacity-50"
                                    />
                                    <span
                                        class="text-xs text-discord-textMuted w-16"
                                        >{plLabel(bindings[key])}</span
                                    >
                                </div>
                            </div>
                        {/each}

                        {#if permError}<p class="text-sm text-discord-danger">
                                {permError}
                            </p>{/if}
                        {#if canEditState}
                            <button
                                onclick={savePermissions}
                                disabled={permSaving}
                                class="px-4 py-2 bg-discord-accent hover:bg-discord-accentHover text-white rounded font-medium text-sm transition-colors disabled:opacity-50"
                                >{permSaving
                                    ? "Saving…"
                                    : permSuccess
                                      ? "Saved!"
                                      : "Save Changes"}</button
                            >
                        {/if}
                    </div>

                    <!-- ── Members ─────────────────────────────────────────── -->
                {:else if activeTab === "members"}
                    {#if showInvite}
                        <div class="space-y-3">
                            <InvitePanel
                                roomId={room.roomId}
                                onClose={() => (showInvite = false)}
                            />
                        </div>
                    {:else}
                        <div class="space-y-3">
                            <div class="flex items-center gap-3">
                                {#if canInvite}
                                    <button
                                        onclick={() => (showInvite = true)}
                                        class="px-3 py-1.5 rounded text-sm font-medium bg-discord-accent hover:bg-discord-accentHover text-white transition-colors"
                                        >Invite</button
                                    >
                                {/if}
                                <input
                                    bind:value={memberSearch}
                                    placeholder="Search members…"
                                    class="flex-1 bg-discord-backgroundTertiary text-discord-textPrimary placeholder-discord-textMuted text-sm rounded px-3 py-1.5 outline-none border border-transparent focus:border-discord-accent/50"
                                />
                                {#if canBan}
                                    <button
                                        onclick={() =>
                                            (showBanned = !showBanned)}
                                        class="px-3 py-1.5 rounded text-sm font-medium transition-colors {showBanned
                                            ? 'bg-discord-danger text-white'
                                            : 'bg-discord-backgroundTertiary text-discord-textMuted hover:text-discord-textPrimary'}"
                                        >Banned ({bannedMembers.length})</button
                                    >
                                {/if}
                            </div>

                            {#if memberError}<p
                                    class="text-sm text-discord-danger"
                                >
                                    {memberError}
                                </p>{/if}

                            {#if showBanned}
                                <!-- Banned members -->
                                <div class="space-y-1">
                                    {#each bannedMembers as member (member.userId)}
                                        <div
                                            class="flex items-center gap-3 p-2 rounded bg-discord-backgroundTertiary"
                                        >
                                            <Avatar
                                                src={mxcToHttp(
                                                    member.getMxcAvatarUrl(),
                                                )}
                                                name={member.name}
                                                id={member.userId}
                                                size={28}
                                            />
                                            <div class="flex-1 min-w-0">
                                                <p
                                                    class="text-sm font-medium text-discord-textPrimary truncate"
                                                >
                                                    {member.name}
                                                </p>
                                                <p
                                                    class="text-xs text-discord-textMuted truncate"
                                                >
                                                    {member.userId}
                                                </p>
                                            </div>
                                            {#if canBan}
                                                <button
                                                    onclick={() =>
                                                        doUnban(member.userId)}
                                                    disabled={memberActionPending ===
                                                        member.userId}
                                                    class="px-2.5 py-1 rounded text-xs font-semibold bg-discord-backgroundSecondary hover:bg-discord-messageHover text-discord-textPrimary transition-colors disabled:opacity-50"
                                                    >Unban</button
                                                >
                                            {/if}
                                        </div>
                                    {/each}
                                    {#if bannedMembers.length === 0}<p
                                            class="text-sm text-discord-textMuted text-center py-4"
                                        >
                                            No banned members
                                        </p>{/if}
                                </div>
                            {:else}
                                <!-- Active members -->
                                <div class="space-y-1">
                                    {#each filteredMembers as member (member.userId)}
                                        {@const isSelf =
                                            member.userId === auth.userId}
                                        {@const memberPl = getUserPowerLevel(
                                            room,
                                            member.userId,
                                        )}
                                        {@const canActOnMember =
                                            !isSelf && myPowerLevel > memberPl}
                                        {@const plResult = parsePowerLevelInput(
                                            plDrafts[member.userId] ??
                                                String(memberPl),
                                            myPowerLevel,
                                        )}
                                        <div
                                            class="rounded bg-discord-backgroundTertiary overflow-hidden"
                                        >
                                            <div
                                                class="flex items-center gap-3 p-2"
                                            >
                                                <Avatar
                                                    src={mxcToHttp(
                                                        member.getMxcAvatarUrl(),
                                                    )}
                                                    name={member.name}
                                                    id={member.userId}
                                                    size={28}
                                                />
                                                <div class="flex-1 min-w-0">
                                                    <p
                                                        class="text-sm font-medium text-discord-textPrimary truncate"
                                                    >
                                                        {member.name}{isSelf
                                                            ? " (you)"
                                                            : ""}
                                                    </p>
                                                    <p
                                                        class="text-xs text-discord-textMuted truncate"
                                                    >
                                                        {member.userId}
                                                    </p>
                                                </div>
                                                <span
                                                    class="text-xs text-discord-textMuted flex-shrink-0"
                                                    >{plLabel(memberPl)} ({memberPl})</span
                                                >
                                                {#if !isSelf}
                                                    <button
                                                        onclick={() =>
                                                            (showReasonFor =
                                                                showReasonFor ===
                                                                member.userId
                                                                    ? null
                                                                    : member.userId)}
                                                        class="p-1 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
                                                        title="Actions"
                                                    >
                                                        <svg
                                                            class="w-4 h-4"
                                                            fill="currentColor"
                                                            viewBox="0 0 24 24"
                                                            ><path
                                                                d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"
                                                            /></svg
                                                        >
                                                    </button>
                                                {/if}
                                            </div>
                                            {#if showReasonFor === member.userId && !isSelf}
                                                <div
                                                    class="px-3 pb-3 pt-1 border-t border-discord-divider space-y-2"
                                                >
                                                    {#if canActOnMember && (canKick || canBan)}
                                                        <input
                                                            bind:value={
                                                                reasonInputs[
                                                                    member
                                                                        .userId
                                                                ]
                                                            }
                                                            placeholder="Reason (optional)"
                                                            class="w-full bg-discord-backgroundSecondary text-discord-textPrimary placeholder-discord-textMuted text-xs rounded px-2 py-1.5 outline-none border border-transparent focus:border-discord-accent/50"
                                                        />
                                                    {/if}
                                                    <div
                                                        class="flex flex-wrap gap-2"
                                                    >
                                                        {#if myPowerLevel >= 100 || myPowerLevel > memberPl}
                                                            <select
                                                                onchange={(e) =>
                                                                    doSetPowerLevel(
                                                                        member,
                                                                        Number(
                                                                            (
                                                                                e.target as HTMLSelectElement
                                                                            )
                                                                                .value,
                                                                        ),
                                                                    )}
                                                                disabled={memberActionPending ===
                                                                    member.userId}
                                                                class="px-2 py-1 rounded text-xs bg-discord-backgroundSecondary text-discord-textPrimary border border-discord-divider disabled:opacity-50"
                                                            >
                                                                <option value=""
                                                                    >Set role…</option
                                                                >
                                                                {#if myPowerLevel >= 100}<option
                                                                        value="100"
                                                                        >Admin
                                                                        (100)</option
                                                                    >{/if}
                                                                {#if myPowerLevel >= 50}<option
                                                                        value="50"
                                                                        >Moderator
                                                                        (50)</option
                                                                    >{/if}
                                                                <option
                                                                    value="0"
                                                                    >Member (0)</option
                                                                >
                                                            </select>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max={myPowerLevel}
                                                                value={plDrafts[
                                                                    member
                                                                        .userId
                                                                ] ??
                                                                    String(
                                                                        memberPl,
                                                                    )}
                                                                oninput={(e) =>
                                                                    (plDrafts[
                                                                        member.userId
                                                                    ] =
                                                                        e.currentTarget.value)}
                                                                disabled={memberActionPending ===
                                                                    member.userId}
                                                                class="w-16 px-2 py-1 rounded text-xs bg-discord-backgroundSecondary text-discord-textPrimary border border-discord-divider disabled:opacity-50"
                                                            />
                                                            <button
                                                                onclick={() =>
                                                                    doSetPowerLevel(
                                                                        member,
                                                                        plResult.value!,
                                                                    )}
                                                                disabled={!plResult.ok ||
                                                                    memberActionPending ===
                                                                        member.userId}
                                                                class="px-2.5 py-1 rounded text-xs font-semibold bg-discord-backgroundSecondary hover:bg-discord-messageHover text-discord-textPrimary transition-colors disabled:opacity-50"
                                                                >Set</button
                                                            >
                                                            {#if !plResult.ok}
                                                                <p
                                                                    class="text-xs text-discord-danger w-full"
                                                                >
                                                                    {plResult.error}
                                                                </p>
                                                            {/if}
                                                        {/if}
                                                        {#if canActOnMember && canKick}
                                                            <button
                                                                onclick={() =>
                                                                    doKick(
                                                                        member.userId,
                                                                    )}
                                                                disabled={memberActionPending ===
                                                                    member.userId}
                                                                class="px-2.5 py-1 rounded text-xs font-semibold bg-discord-backgroundSecondary hover:bg-discord-warning/20 text-discord-warning transition-colors disabled:opacity-50"
                                                                >Kick</button
                                                            >
                                                        {/if}
                                                        {#if canActOnMember && canBan}
                                                            <button
                                                                onclick={() =>
                                                                    doBan(
                                                                        member.userId,
                                                                    )}
                                                                disabled={memberActionPending ===
                                                                    member.userId}
                                                                class="px-2.5 py-1 rounded text-xs font-semibold bg-discord-backgroundSecondary hover:bg-discord-danger/20 text-discord-danger transition-colors disabled:opacity-50"
                                                                >Ban</button
                                                            >
                                                        {/if}
                                                        {#if isUserBlocked(member.userId)}
                                                            <button
                                                                onclick={() =>
                                                                    doToggleBlock(
                                                                        member.userId,
                                                                    )}
                                                                disabled={memberActionPending ===
                                                                    member.userId}
                                                                class="px-2.5 py-1 rounded text-xs font-semibold bg-discord-backgroundSecondary hover:bg-discord-messageHover text-discord-textPrimary transition-colors disabled:opacity-50"
                                                                >Unblock</button
                                                            >
                                                        {:else}
                                                            <button
                                                                onclick={() =>
                                                                    doToggleBlock(
                                                                        member.userId,
                                                                    )}
                                                                disabled={memberActionPending ===
                                                                    member.userId}
                                                                title="Hide this user's messages everywhere (stored on your account)"
                                                                class="px-2.5 py-1 rounded text-xs font-semibold bg-discord-backgroundSecondary hover:bg-discord-danger/20 text-discord-danger transition-colors disabled:opacity-50"
                                                                >Block</button
                                                            >
                                                        {/if}
                                                    </div>
                                                </div>
                                            {/if}
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                        </div>
                    {/if}

                    <!-- ── Rooms (space only) ──────────────────────────────── -->
                {:else if activeTab === "rooms"}
                    <div class="space-y-3">
                        <p class="text-xs text-discord-textMuted">
                            Set the <code
                                class="font-mono bg-discord-backgroundTertiary px-1 rounded"
                                >order</code
                            > field on each child room to control sort order (lexicographic).
                            Leave blank to sort by creation time.
                        </p>
                        {#if roomsError}<p class="text-sm text-discord-danger">
                                {roomsError}
                            </p>{/if}
                        <div class="space-y-1.5">
                            {#each spaceChildren as child (child.roomId)}
                                <div
                                    class="flex items-center gap-3 p-2 rounded bg-discord-backgroundTertiary"
                                >
                                    <div
                                        class="w-7 h-7 rounded-full bg-discord-backgroundSecondary flex-shrink-0 overflow-hidden flex items-center justify-center text-xs font-bold text-discord-textMuted"
                                    >
                                        {#if child.avatarUrl}
                                            <img
                                                src={child.avatarUrl}
                                                alt=""
                                                class="w-full h-full object-cover"
                                            />
                                        {:else}
                                            {child.name[0]?.toUpperCase() ??
                                                "#"}
                                        {/if}
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <p
                                            class="text-sm font-medium text-discord-textPrimary truncate"
                                        >
                                            {child.name}
                                        </p>
                                        <p
                                            class="text-xs text-discord-textMuted truncate"
                                        >
                                            {child.roomId}
                                        </p>
                                    </div>
                                    {#if canEditState}
                                        <input
                                            bind:value={
                                                orderEdits[child.roomId]
                                            }
                                            placeholder="order"
                                            class="w-24 bg-discord-backgroundSecondary text-discord-textPrimary placeholder-discord-textMuted text-xs rounded px-2 py-1 outline-none border border-transparent focus:border-discord-accent/50 font-mono"
                                        />
                                        <button
                                            onclick={() => saveOrder(child)}
                                            disabled={roomActionPending ===
                                                child.roomId ||
                                                (orderEdits[child.roomId] ??
                                                    "") === child.order}
                                            class="px-2.5 py-1 rounded text-xs font-semibold bg-discord-accent hover:bg-discord-accentHover text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >{roomActionPending === child.roomId
                                                ? "…"
                                                : "Set"}</button
                                        >
                                        <button
                                            onclick={() => doRemoveChild(child)}
                                            disabled={roomActionPending ===
                                                child.roomId}
                                            class="p-1 rounded text-discord-textMuted hover:text-discord-danger hover:bg-discord-messageHover transition-colors disabled:opacity-50"
                                            title="Remove from space"
                                        >
                                            <svg
                                                class="w-4 h-4"
                                                fill="currentColor"
                                                viewBox="0 0 24 24"
                                                ><path
                                                    d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                                                /></svg
                                            >
                                        </button>
                                    {/if}
                                </div>
                            {/each}
                            {#if spaceChildren.length === 0}<p
                                    class="text-sm text-discord-textMuted text-center py-4"
                                >
                                    No child rooms
                                </p>{/if}
                        </div>
                    </div>

                    <!-- ── Emotes ──────────────────────────────────────────── -->
                {:else if activeTab === "emotes"}
                    <ImagePackEditor
                        {room}
                        canEdit={canEditEmojis}
                        {onUpdate}
                    />
                {/if}
            </div>
        </div>
    </div>
</div>
