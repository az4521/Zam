<script lang="ts">
    import type { Room, RoomMember } from "matrix-js-sdk";
    import { tick, untrack } from "svelte";
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
        getGuestAccess,
        setGuestAccess,
        getRoomDirectoryVisibility,
        setRoomDirectoryVisibility,
        getLocalRoomAliases,
        createRoomAlias,
        deleteRoomAlias,
        getCanonicalAliasContent,
        setCanonicalAliasContent,
        getOwnServerName,
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
    import {
        buildAlias,
        buildCanonicalAliasContent,
        canonicalAliasContentAfterRemoval,
        sortAliasesForDisplay,
        validateAliasLocalpart,
        type CanonicalAliasContent,
    } from "$lib/utils/roomAliases";
    import { parsePowerLevelInput } from "$lib/utils/powerLevels";
    import { getRoomUpgradeState } from "$lib/utils/roomUpgrade";
    import {
        roomSettingsNavView,
        roomSettingsTabs,
        roomSettingsTabLabel,
        type RoomSettingsTab,
    } from "$lib/utils/roomSettingsNav";
    import { focusTrap } from "$lib/actions/focusTrap";
    import { ChevronRight, ArrowLeft } from "lucide-svelte";

    import { isRoomEncrypted } from "$lib/matrix/crypto";
    import {
        getEnableEncryptionState,
        matchesEnableEncryptionConfirmation,
        ENABLE_ENCRYPTION_CONFIRM_PHRASE,
        ENABLE_ENCRYPTION_WARNING,
    } from "$lib/utils/roomEncryption";
    import { auth } from "$lib/stores/auth.svelte";
    import {
        interfaceState,
        openSubPage,
        clearSubPageIfOwner,
    } from "$lib/stores/interface.svelte";
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

    // Stable identity: it is the ownership token for the sub-page slot, so it
    // must NOT be recreated on every render. It resets local state ONLY — it
    // runs from inside the store's own close/supersede paths, so reaching back
    // into the store here would pop the wrong owner.
    function goBackToList() {
        selectedTab = null;
        showInvite = false;
    }

    // Register the mobile sub-page with the central dismiss stack so Escape and
    // the hardware back button pop it before closing the whole dialog.
    //
    // `openSubPage` READS `interfaceState.subPageClose` (to supersede a previous
    // owner) as well as writing it. Untracked, that read becomes a dependency of
    // this effect while the write invalidates it → the teardown clears the slot,
    // the body re-claims it, forever: `effect_update_depth_exceeded`. `untrack`
    // keeps the slot out of the dependency set, so the tracked dependencies are
    // exactly what `view` reads — isMobile, isSpace and selectedTab — none of
    // which `openSubPage` writes, so there is no loop.
    $effect(() => {
        if (view.mode !== "detail") return;
        untrack(() => openSubPage(goBackToList));
        return () => clearSubPageIfOwner(goBackToList);
    });

    // Plain `let`, not `$state`: these are transition bookkeeping, not view
    // data. Reading them inside the effect below must register no dependency
    // (and `bind:this` writing a `$state` ref would retrigger it). Nothing
    // renders from them, so the non-reactivity the warning describes is the
    // whole point.
    // svelte-ignore non_reactive_update
    let backButtonEl: HTMLButtonElement | null = null;
    // Only index 0 is ever read, and it is always "general" — the tab set has
    // the same length for a room and a space, but not the same members, so an
    // index means different things in the two shapes.
    let categoryEls: HTMLButtonElement[] = [];
    let sidebarEls: Record<string, HTMLButtonElement | null> = {};
    let lastMode: string | null = null;

    // EVERY mode change destroys the element that had focus — drilling in,
    // backing out, and crossing the 768px breakpoint in either direction —
    // dropping focus to <body>, outside the focus trap, where the trap's
    // node-level keydown never fires and Tab escapes to the app shell behind
    // the modal. So re-anchor focus on every change, including into "desktop"
    // (never on first mount: focusTrap's rAF owns that). Writes no reactive
    // state, so it cannot retrigger itself.
    $effect(() => {
        const mode = view.mode;
        // Free: the effect already depends on `view`, so reading a second
        // property off the same object registers nothing new.
        const tab = mode === "list" ? null : view.tab;
        if (lastMode === null || lastMode === mode) {
            lastMode = mode;
            return;
        }
        lastMode = mode;
        // After the DOM is patched — `bind:this` has not necessarily landed yet.
        void tick().then(() => {
            if (mode === "detail") backButtonEl?.focus();
            else if (mode === "list") categoryEls[0]?.focus();
            else if (tab) sidebarEls[tab]?.focus();
        });
    });

    const myPowerLevel = $derived(getMyPowerLevel(room));
    const pl = $derived(getRoomPowerLevels(room));
    const canEditState = $derived(myPowerLevel >= pl.state_default);
    const canEditEmojis = $derived(
        myPowerLevel >=
            (pl.events?.["im.ponies.room_emotes"] ?? pl.state_default),
    );
    // Publishing an address is gated by the power level for the canonical-alias
    // EVENT, not bare state_default — Element's default PL content ships
    // `state_default: 100` with `m.room.canonical_alias: 50`, so a moderator who
    // may publish would otherwise be shown nothing at all.
    const canSetCanonicalAlias = $derived(
        myPowerLevel >=
            (pl.events?.["m.room.canonical_alias"] ?? pl.state_default),
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

    // The room prop can swap under a mounted dialog, so an upgrade confirm or
    // error opened for one room must not carry into the next. Depend only on
    // room.roomId; write inside untrack so the reset cannot retrigger itself
    // (the effect-update-depth landmine).
    $effect(() => {
        void room.roomId;
        untrack(() => {
            upgradeShowConfirm = false;
            upgrading = false;
            upgradeError = "";
        });
    });

    // ── Access tab ─────────────────────────────────────────────────────────────
    let joinRule = $state(untrack(() => getJoinRule(room)));
    let historyVisibility = $state(untrack(() => getHistoryVisibility(room)));
    let guestAccessAllowed = $state(
        untrack(() => getGuestAccess(room) === "can_join"),
    );
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
            const nextGuestAccess = guestAccessAllowed
                ? "can_join"
                : "forbidden";
            if (nextGuestAccess !== getGuestAccess(room))
                promises.push(setGuestAccess(room.roomId, nextGuestAccess));
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

    // ── Access tab: published addresses (separate directory calls) ─────────────
    let localAliases = $state<string[]>([]);
    let aliasesLoaded = $state(false);
    let aliasBusy = $state(false);
    let aliasError = $state("");
    let aliasNotice = $state("");
    let newAliasLocalpart = $state("");
    let canonicalContent = $state<CanonicalAliasContent>({});
    let mainAliasChoice = $state("");
    const ownServer = getOwnServerName();

    const canonicalAlias = $derived(canonicalContent.alias ?? null);
    const sortedAliases = $derived(
        sortAliasesForDisplay(localAliases, canonicalAlias),
    );
    const newAliasCheck = $derived(
        validateAliasLocalpart(
            newAliasLocalpart.trim(),
            ownServer,
            localAliases,
        ),
    );
    /** Is the picked main address different from the one actually published? */
    const mainAliasDirty = $derived(
        mainAliasChoice !== (canonicalContent.alias ?? ""),
    );
    /**
     * Choices for the main-address select. The published alias may not be one
     * of OUR local mappings — it can live on another homeserver, or another
     * admin may have deleted the local mapping out of band. Carry it as an
     * extra option so it is at least visible and clearable. `sortedAliases` is
     * already deduplicated, and it is only prepended when genuinely absent.
     */
    const mainAliasOptions = $derived(
        canonicalAlias && !sortedAliases.includes(canonicalAlias)
            ? [canonicalAlias, ...sortedAliases]
            : sortedAliases,
    );

    $effect(() => {
        if (activeTab !== "access" || aliasesLoaded) return;
        // Read the state event into a local first: assigning `canonicalContent`
        // and then READING it back here would make this effect depend on a
        // value it writes every run, and the `aliasesLoaded` guard only closes
        // once the async load settles — that gap is an effect_update_depth
        // trap. The local keeps `canonicalContent` write-only in here.
        const content = getCanonicalAliasContent(room);
        canonicalContent = content;
        mainAliasChoice = content.alias ?? "";
        getLocalRoomAliases(room.roomId)
            .then((a) => {
                localAliases = a;
                aliasesLoaded = true;
            })
            .catch((e: any) => {
                aliasError =
                    e?.data?.error ??
                    e?.message ??
                    "Could not load this room's addresses";
                aliasesLoaded = true;
            });
    });

    async function addAlias() {
        const localpart = newAliasLocalpart.trim();
        if (aliasBusy || !newAliasCheck.valid) return;
        aliasBusy = true;
        aliasError = "";
        aliasNotice = "";
        const alias = buildAlias(localpart, ownServer);
        try {
            await createRoomAlias(alias, room.roomId);
            localAliases = [...localAliases, alias];
            newAliasLocalpart = "";
        } catch (e: any) {
            aliasError =
                e?.data?.error ?? e?.message ?? "Could not add that address";
        } finally {
            aliasBusy = false;
        }
    }

    async function removeAlias(alias: string) {
        if (aliasBusy) return;
        aliasBusy = true;
        aliasError = "";
        aliasNotice = "";
        try {
            // Unpublish first: a canonical alias pointing at a deleted mapping
            // advertises an address nobody can resolve.
            const next = canonicalAliasContentAfterRemoval(
                canonicalContent,
                alias,
            );
            // Refuse the whole removal when this address is still the canonical/
            // alt address and we lack permission to unpublish it — deleting the
            // mapping alone would strand m.room.canonical_alias on a dead address.
            if (next && !canSetCanonicalAlias) {
                aliasError =
                    "This address is published as the room's main address and you don't have permission to unpublish it, so it can't be removed. Ask a room admin.";
                return;
            }
            if (next) {
                await setCanonicalAliasContent(room.roomId, next);
                canonicalContent = next;
                mainAliasChoice = next.alias ?? "";
                roomsState.roomsTick++;
            }
            await deleteRoomAlias(alias);
            localAliases = localAliases.filter((a) => a !== alias);
            // Drop a pending (unsaved) pick of the address we just deleted:
            // it would vanish from the options, rendering the select blank
            // while Set stayed enabled — one click from publishing a mapping
            // that no longer exists. Snap back to what is actually published.
            if (mainAliasChoice === alias)
                mainAliasChoice = canonicalContent.alias ?? "";
        } catch (e: any) {
            aliasError =
                e?.data?.error ?? e?.message ?? "Could not remove that address";
        } finally {
            aliasBusy = false;
        }
    }

    async function saveMainAlias() {
        const choice = mainAliasChoice || null;
        if (aliasBusy || choice === (canonicalContent.alias ?? null)) return;
        aliasBusy = true;
        aliasError = "";
        aliasNotice = "";
        const prev = canonicalContent;
        try {
            const next = buildCanonicalAliasContent({
                alias: choice,
                altAliases: canonicalContent.alt_aliases ?? [],
            });
            await setCanonicalAliasContent(room.roomId, next);
            canonicalContent = next;
            roomsState.roomsTick++;
        } catch (e: any) {
            canonicalContent = prev;
            mainAliasChoice = prev.alias ?? "";
            aliasError =
                e?.data?.error ??
                e?.message ??
                "Could not set the main address";
        } finally {
            aliasBusy = false;
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
    <!-- No `onEscape` on purpose: focusTrap's node-level keydown fires BEFORE
         <svelte:window onkeydown> reaches AppShell, so an onEscape here would
         close the whole dialog on the first Escape and the mobile sub-page could
         never be popped. Escape is owned by AppShell.dismissTopmost(). -->
    <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-settings-title"
        class="relative z-10 bg-discord-backgroundSecondary rounded-none md:rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden h-[100dvh] md:h-[85dvh]"
        use:focusTrap
    >
        <!-- Header. On a mobile sub-page the close button is replaced by a back
             arrow and the title names the category. -->
        <div
            class="flex items-center gap-2 px-6 py-4 border-b border-discord-divider flex-shrink-0"
        >
            {#if view.mode === "detail"}
                <button
                    bind:this={backButtonEl}
                    onclick={goBackToList}
                    aria-label="Back to settings"
                    class="-ml-2 p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors flex-shrink-0"
                >
                    <ArrowLeft size={20} />
                </button>
            {/if}
            <h2
                id="room-settings-title"
                class="text-lg font-bold text-discord-textPrimary min-w-0 truncate flex-1"
            >
                {#if view.mode === "detail"}
                    <!-- This heading IS the dialog's accessible name
                         (aria-labelledby), and on a sub-page the visible text is
                         only the category — so name the room for screen readers
                         without repeating it on screen. -->
                    <span class="sr-only">{`${room.name} — `}</span
                    >{roomSettingsTabLabel(view.tab)}
                {:else}
                    {room.name} — Settings
                {/if}
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

        {#if view.mode === "list"}
            <!-- Mobile root: drill-down category list. -->
            <nav class="flex-1 overflow-y-auto py-2">
                {#each tabs as tab, i (tab.id)}
                    <button
                        bind:this={categoryEls[i]}
                        onclick={() => {
                            selectedTab = tab.id;
                            showInvite = false;
                        }}
                        class="w-full flex items-center justify-between gap-3 px-6 py-3.5 text-left text-base font-medium text-discord-textPrimary hover:bg-discord-messageHover active:bg-discord-messageHover transition-colors"
                    >
                        <span class="min-w-0 truncate">{tab.label}</span>
                        <ChevronRight
                            size={20}
                            aria-hidden="true"
                            class="flex-shrink-0 text-discord-textMuted"
                        />
                    </button>
                {/each}
            </nav>
        {:else}
            <div class="flex flex-row flex-1 min-h-0">
                {#if view.mode === "desktop"}
                    <!-- Desktop: category sidebar beside the active panel. -->
                    <nav
                        class="flex flex-col flex-shrink-0 w-40 gap-0.5 border-r border-discord-divider px-2 py-3"
                    >
                        {#each tabs as tab (tab.id)}
                            <button
                                bind:this={sidebarEls[tab.id]}
                                onclick={() => {
                                    selectedTab = tab.id;
                                    showInvite = false;
                                }}
                                class="flex-shrink-0 w-full whitespace-nowrap text-left px-3 py-2 rounded text-sm font-medium transition-colors"
                                class:bg-discord-messageHover={activeTab ===
                                    tab.id}
                                class:text-discord-textPrimary={activeTab ===
                                    tab.id}
                                class:text-discord-textMuted={activeTab !==
                                    tab.id}>{tab.label}</button
                            >
                        {/each}
                    </nav>
                {/if}

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
                                        <p
                                            class="text-sm text-discord-textMuted"
                                        >
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
                                    Guest Access
                                </p>
                                <label
                                    class="flex items-center gap-2.5 cursor-pointer {!canEditState
                                        ? 'opacity-50 pointer-events-none'
                                        : ''}"
                                >
                                    <input
                                        type="checkbox"
                                        bind:checked={guestAccessAllowed}
                                        disabled={!canEditState}
                                        class="accent-discord-accent"
                                    />
                                    <span
                                        class="text-sm text-discord-textPrimary"
                                        >Allow guests to join without an account</span
                                    >
                                </label>
                                <p class="text-xs text-discord-textMuted mt-1">
                                    Guests are anonymous accounts the homeserver
                                    creates on demand. Many servers disable
                                    guest registration entirely, in which case
                                    this has no effect.
                                </p>
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
                                    <span
                                        class="text-sm text-discord-textPrimary"
                                        >List this {isSpace ? "space" : "room"} in
                                        the server directory</span
                                    >
                                </label>
                                <p class="text-xs text-discord-textMuted mt-1">
                                    Lists the {isSpace ? "space" : "room"} by ID.
                                    Being found by name also needs a published address
                                    — add one below.
                                </p>
                                {#if dirError}<p
                                        class="text-sm text-discord-danger mt-1"
                                    >
                                        {dirError}
                                    </p>{/if}
                            </div>

                            <div>
                                <p
                                    class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
                                >
                                    Addresses
                                </p>
                                <p class="text-xs text-discord-textMuted mb-2">
                                    A published address lets people find and
                                    join this {isSpace ? "space" : "room"} by name
                                    instead of by ID.
                                </p>
                                {#if !aliasesLoaded}
                                    <p class="text-xs text-discord-textMuted">
                                        Loading addresses…
                                    </p>
                                {:else}
                                    {#if sortedAliases.length === 0}
                                        {#if !aliasError}
                                            <p
                                                class="text-xs text-discord-textMuted"
                                            >
                                                No addresses yet.
                                            </p>
                                        {/if}
                                    {:else}
                                        <ul class="space-y-1">
                                            {#each sortedAliases as alias (alias)}
                                                <li
                                                    class="flex items-center gap-2 min-w-0"
                                                >
                                                    <span
                                                        class="text-sm text-discord-textPrimary font-mono truncate"
                                                        title={alias}
                                                        >{alias}</span
                                                    >
                                                    {#if alias === canonicalAlias}
                                                        <span
                                                            class="shrink-0 text-[10px] uppercase tracking-wide bg-discord-accent text-white rounded px-1.5 py-0.5"
                                                            >Main</span
                                                        >
                                                    {/if}
                                                    <button
                                                        onclick={() =>
                                                            removeAlias(alias)}
                                                        disabled={aliasBusy}
                                                        aria-label={`Remove ${alias}`}
                                                        class="ml-auto shrink-0 text-xs text-discord-danger hover:underline disabled:opacity-50"
                                                        >Remove</button
                                                    >
                                                </li>
                                            {/each}
                                        </ul>
                                    {/if}

                                    {#if canSetCanonicalAlias && mainAliasOptions.length > 0}
                                        <div
                                            class="flex items-end gap-1.5 mt-3 min-w-0"
                                        >
                                            <label class="flex-1 min-w-0">
                                                <span
                                                    class="block text-xs text-discord-textMuted mb-1"
                                                    >Main address</span
                                                >
                                                <select
                                                    bind:value={mainAliasChoice}
                                                    disabled={aliasBusy}
                                                    class="w-full px-2 py-1.5 bg-discord-backgroundTertiary text-discord-textPrimary text-sm rounded border border-discord-divider disabled:opacity-50"
                                                >
                                                    <option value=""
                                                        >No main address</option
                                                    >
                                                    {#each mainAliasOptions as alias (alias)}
                                                        <option value={alias}
                                                            >{alias}</option
                                                        >
                                                    {/each}
                                                </select>
                                            </label>
                                            <button
                                                onclick={saveMainAlias}
                                                disabled={aliasBusy ||
                                                    !mainAliasDirty}
                                                class="shrink-0 px-3 py-1.5 bg-discord-accent hover:bg-discord-accentHover text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
                                                >Set</button
                                            >
                                        </div>
                                    {/if}

                                    <div class="flex items-center gap-1.5 mt-3">
                                        <span
                                            class="text-sm text-discord-textMuted shrink-0"
                                            >#</span
                                        >
                                        <input
                                            type="text"
                                            bind:value={newAliasLocalpart}
                                            placeholder="my-room"
                                            disabled={aliasBusy}
                                            onkeydown={(e) => {
                                                if (
                                                    e.key === "Enter" &&
                                                    !e.shiftKey &&
                                                    !e.ctrlKey &&
                                                    !e.altKey &&
                                                    !e.metaKey
                                                ) {
                                                    e.preventDefault();
                                                    addAlias();
                                                }
                                            }}
                                            class="flex-1 min-w-0 px-2 py-1.5 bg-discord-backgroundTertiary text-discord-textPrimary text-sm rounded border border-discord-divider disabled:opacity-50"
                                        />
                                        <span
                                            class="text-sm text-discord-textMuted shrink-0 max-w-[40%] truncate"
                                            title={ownServer}>:{ownServer}</span
                                        >
                                        <button
                                            onclick={addAlias}
                                            disabled={aliasBusy ||
                                                !ownServer ||
                                                !newAliasCheck.valid}
                                            class="shrink-0 px-3 py-1.5 bg-discord-accent hover:bg-discord-accentHover text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
                                            >Add</button
                                        >
                                    </div>
                                    {#if newAliasLocalpart.trim() && newAliasCheck.reason}
                                        <p
                                            class="text-xs text-discord-danger mt-1"
                                        >
                                            {newAliasCheck.reason}
                                        </p>
                                    {/if}
                                {/if}
                                {#if aliasError}<p
                                        class="text-sm text-discord-danger mt-1"
                                    >
                                        {aliasError}
                                    </p>{/if}
                                {#if aliasNotice}<p
                                        class="text-xs text-discord-textMuted mt-1"
                                    >
                                        {aliasNotice}
                                    </p>{/if}
                            </div>

                            {#if accessError}<p
                                    class="text-sm text-discord-danger"
                                >
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
                                            >Type {ENABLE_ENCRYPTION_CONFIRM_PHRASE}
                                            to confirm</label
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
                                    <span
                                        class="text-sm text-discord-textPrimary"
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

                            {#if permError}<p
                                    class="text-sm text-discord-danger"
                                >
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
                                                            doUnban(
                                                                member.userId,
                                                            )}
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
                                            {@const memberPl =
                                                getUserPowerLevel(
                                                    room,
                                                    member.userId,
                                                )}
                                            {@const canActOnMember =
                                                !isSelf &&
                                                myPowerLevel > memberPl}
                                            {@const plResult =
                                                parsePowerLevelInput(
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
                                                                    onchange={(
                                                                        e,
                                                                    ) =>
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
                                                                    <option
                                                                        value=""
                                                                        >Set
                                                                        role…</option
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
                                                                        >Member
                                                                        (0)</option
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
                                                                    oninput={(
                                                                        e,
                                                                    ) =>
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
                            {#if roomsError}<p
                                    class="text-sm text-discord-danger"
                                >
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
                                                >{roomActionPending ===
                                                child.roomId
                                                    ? "…"
                                                    : "Set"}</button
                                            >
                                            <button
                                                onclick={() =>
                                                    doRemoveChild(child)}
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
        {/if}
    </div>
</div>
