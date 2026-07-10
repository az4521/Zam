<script lang="ts">
    import type { Room, RoomMember } from "matrix-js-sdk";
    import { untrack } from "svelte";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import {
        getMyPowerLevel,
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
        getHistoryVisibility,
        setHistoryVisibility,
        getSpaceChildren,
        setSpaceChildOrder,
        removeSpaceChild,
        getRoomMembers,
        getRoomAvatar,
        getRoomTopic,
        getAvailableRoomEmotePacks,
        getAvailableRoomEmojiPacks,
        getAvailableRoomStickerPacks,
        addRoomEmote,
        addRoomEmoji,
        addRoomSticker,
        setRoomEmoteUsage,
        removeRoomEmoteImage,
        removeRoomEmoji,
        removeRoomSticker,
        validateEmojiShortcode,
        mxcToHttp,
        type CustomImagePack,
        type CustomPackImage,
        type CustomEmoji,
        type CustomEmojiPack,
        type CustomSticker,
        type CustomStickerPack,
        type ImageUsage,
        type SpaceChildEntry,
    } from "$lib/matrix/client";

    import { auth } from "$lib/stores/auth.svelte";
    import { roomsState } from "$lib/stores/rooms.svelte";
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

    type Tab =
        | "general"
        | "access"
        | "permissions"
        | "members"
        | "rooms"
        | "emotes"
        | "emojis"
        | "stickers";
    let activeTab = $state<Tab>("general");

    const isSpace = $derived(room.isSpaceRoom());
    const myPowerLevel = $derived(getMyPowerLevel(room));
    const pl = $derived(getRoomPowerLevels(room));
    const canEditState = $derived(myPowerLevel >= pl.state_default);
    const canEditEmojis = $derived(
        myPowerLevel >=
            (pl.events?.["im.ponies.room_emotes"] ?? pl.state_default),
    );
    const canEditStickers = $derived(canEditEmojis);
    const canKick = $derived(myPowerLevel >= pl.kick);
    const canBan = $derived(myPowerLevel >= pl.ban);

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

    // ── Access tab ─────────────────────────────────────────────────────────────
    let joinRule = $state(untrack(() => getJoinRule(room)));
    let historyVisibility = $state(untrack(() => getHistoryVisibility(room)));
    let accessSaving = $state(false);
    let accessError = $state("");
    let accessSuccess = $state(false);

    async function saveAccess() {
        accessError = "";
        accessSaving = true;
        try {
            const promises: Promise<void>[] = [];
            if (joinRule !== getJoinRule(room))
                promises.push(setJoinRule(room.roomId, joinRule));
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

    // ── Permissions tab ────────────────────────────────────────────────────────
    let plBan = $state(untrack(() => pl.ban));
    let plKick = $state(untrack(() => pl.kick));
    let plRedact = $state(untrack(() => pl.redact));
    let plInvite = $state(untrack(() => pl.invite));
    let plEventsDefault = $state(untrack(() => pl.events_default));
    let plStateDefault = $state(untrack(() => pl.state_default));
    let plUsersDefault = $state(untrack(() => pl.users_default));
    let permSaving = $state(false);
    let permError = $state("");
    let permSuccess = $state(false);

    async function savePermissions() {
        permError = "";
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
                    b.powerLevel - a.powerLevel || a.name.localeCompare(b.name),
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

    // ── Emotes tab ────────────────────────────────────────────────────────────
    let emotePacks = $state<CustomImagePack[]>([]);
    let selectedEmotePackKey = $state("");
    let newEmotePackName = $state("");
    let emoteShortcode = $state("");
    let emoteUploading = $state(false);
    let emoteActionPending = $state<string | null>(null);
    let emoteError = $state("");
    let newEmoteAsEmoji = $state(true);
    let newEmoteAsSticker = $state(false);

    function packKey(pack: { stateKey?: string }): string {
        return pack.stateKey ?? "";
    }

    function usageFromFlags(emoji: boolean, sticker: boolean): ImageUsage[] {
        return [
            ...(emoji ? (["emoticon"] as ImageUsage[]) : []),
            ...(sticker ? (["sticker"] as ImageUsage[]) : []),
        ];
    }

    function sortPackImages(images: CustomPackImage[]): CustomPackImage[] {
        return [...images].sort((a, b) =>
            a.shortcode.localeCompare(b.shortcode),
        );
    }

    function sortEmotePacks(packs: CustomImagePack[]): CustomImagePack[] {
        return [...packs]
            .map((pack) => ({ ...pack, images: sortPackImages(pack.images) }))
            .sort(
                (a, b) =>
                    Number(a.inherited) - Number(b.inherited) ||
                    (a.sourceName ?? "").localeCompare(b.sourceName ?? "") ||
                    a.name.localeCompare(b.name),
            );
    }

    function currentEmotePacks(): CustomImagePack[] {
        return emotePacks.filter((pack) => !pack.inherited);
    }

    function loadEmotes() {
        emotePacks = sortEmotePacks(getAvailableRoomEmotePacks(room));
        const editablePacks = currentEmotePacks();
        if (
            selectedEmotePackKey !== "__new" &&
            !editablePacks.some(
                (pack) => packKey(pack) === selectedEmotePackKey,
            )
        ) {
            selectedEmotePackKey = editablePacks[0]
                ? packKey(editablePacks[0])
                : "__new";
        }
    }

    $effect(() => {
        const tab = activeTab;
        untrack(() => {
            if (tab === "emotes") loadEmotes();
        });
    });

    function selectedEmotePackName(): string {
        if (selectedEmotePackKey === "__new") {
            return newEmotePackName.trim() || `${room.name || "Room"} Emotes`;
        }
        return (
            currentEmotePacks().find(
                (pack) => packKey(pack) === selectedEmotePackKey,
            )?.name || `${room.name || "Room"} Emotes`
        );
    }

    function selectedEmoteStateKey(): string {
        if (selectedEmotePackKey !== "__new") return selectedEmotePackKey;
        return newEmotePackName.trim() || "";
    }

    function updateEmoteLocal(
        stateKey: string,
        shortcode: string,
        usage: ImageUsage[],
    ) {
        emotePacks = sortEmotePacks(
            emotePacks.map((pack) =>
                !pack.inherited &&
                pack.roomId === room.roomId &&
                packKey(pack) === stateKey
                    ? {
                          ...pack,
                          images: pack.images.map((item) =>
                              item.shortcode === shortcode
                                  ? {
                                        ...item,
                                        usage,
                                        canEmoji: usage.includes("emoticon"),
                                        canSticker: usage.includes("sticker"),
                                    }
                                  : item,
                          ),
                      }
                    : pack,
            ),
        );
    }

    async function handleEmoteUpload(e: Event) {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        emoteError = validateEmojiShortcode(emoteShortcode) ?? "";
        const usage = usageFromFlags(newEmoteAsEmoji, newEmoteAsSticker);
        if (!emoteError && usage.length === 0) {
            emoteError = "Choose at least one usage.";
        }
        if (
            !emoteError &&
            selectedEmotePackKey === "__new" &&
            currentEmotePacks().length > 0 &&
            !newEmotePackName.trim()
        ) {
            emoteError = "Enter a pack name.";
        }
        if (emoteError) {
            input.value = "";
            return;
        }

        emoteUploading = true;
        try {
            const mxcUrl = await uploadContent(file);
            const stateKey = selectedEmoteStateKey();
            const normalized = await addRoomEmote(
                room.roomId,
                stateKey,
                emoteShortcode,
                mxcUrl,
                selectedEmotePackName(),
                usage,
            );
            const httpUrl = mxcToHttp(mxcUrl);
            const nextImage = {
                shortcode: normalized,
                mxcUrl,
                url: httpUrl ?? "",
                usage,
                canEmoji: usage.includes("emoticon"),
                canSticker: usage.includes("sticker"),
            };
            const existingPack = currentEmotePacks().find(
                (pack) => packKey(pack) === stateKey,
            );
            const updatedPack: CustomImagePack = {
                ...(existingPack ?? {
                    id: `${room.roomId}:${stateKey}`,
                    roomId: room.roomId,
                    stateKey,
                    name: selectedEmotePackName(),
                    sourceName: room.name || room.roomId,
                    avatarUrl: currentAvatarUrl ?? undefined,
                    images: [],
                }),
                images: [
                    ...(existingPack?.images ?? []).filter(
                        (item) => item.shortcode !== normalized,
                    ),
                    nextImage,
                ].filter((item) => item.url),
            };
            emotePacks = sortEmotePacks([
                ...emotePacks.filter(
                    (pack) =>
                        pack.inherited ||
                        pack.roomId !== room.roomId ||
                        packKey(pack) !== stateKey,
                ),
                updatedPack,
            ]);
            emoteShortcode = "";
            selectedEmotePackKey = stateKey;
            roomsState.roomsTick++;
            onUpdate?.();
        } catch (err: any) {
            emoteError = err?.message ?? "Upload failed";
        } finally {
            emoteUploading = false;
            input.value = "";
        }
    }

    async function setRoomEmoteFlag(
        pack: CustomImagePack,
        item: CustomPackImage,
        kind: ImageUsage,
        enabled: boolean,
    ) {
        const stateKey = packKey(pack);
        const usage = usageFromFlags(
            kind === "emoticon" ? enabled : item.canEmoji,
            kind === "sticker" ? enabled : item.canSticker,
        );
        if (usage.length === 0) {
            emoteError = "Choose at least one usage.";
            return;
        }
        emoteActionPending = `${stateKey}:${item.shortcode}:${kind}`;
        emoteError = "";
        try {
            await setRoomEmoteUsage(
                room.roomId,
                stateKey,
                item.shortcode,
                usage,
            );
            updateEmoteLocal(stateKey, item.shortcode, usage);
            roomsState.roomsTick++;
            onUpdate?.();
        } catch (err: any) {
            emoteError = err?.message ?? "Failed to update usage";
        } finally {
            emoteActionPending = null;
        }
    }

    async function doRemoveEmote(pack: CustomImagePack, shortcode: string) {
        const stateKey = packKey(pack);
        emoteActionPending = `${stateKey}:${shortcode}:remove`;
        emoteError = "";
        try {
            await removeRoomEmoteImage(room.roomId, stateKey, shortcode);
            emotePacks = sortEmotePacks(
                emotePacks
                    .map((p) =>
                        !p.inherited &&
                        p.roomId === room.roomId &&
                        packKey(p) === stateKey
                            ? {
                                  ...p,
                                  images: p.images.filter(
                                      (item) => item.shortcode !== shortcode,
                                  ),
                              }
                            : p,
                    )
                    .filter((p) => p.inherited || p.images.length > 0),
            );
            roomsState.roomsTick++;
            onUpdate?.();
        } catch (err: any) {
            emoteError = err?.message ?? "Failed to remove image";
        } finally {
            emoteActionPending = null;
        }
    }

    // ── Emojis tab ────────────────────────────────────────────────────────────
    let emojiPacks = $state<CustomEmojiPack[]>([]);
    let selectedEmojiPackKey = $state("");
    let newEmojiPackName = $state("");
    let emojiShortcode = $state("");
    let emojiUploading = $state(false);
    let emojiActionPending = $state<string | null>(null);
    let emojiError = $state("");

    function sortEmojis(emojis: CustomEmoji[]): CustomEmoji[] {
        return [...emojis].sort((a, b) =>
            a.shortcode.localeCompare(b.shortcode),
        );
    }

    function sortEmojiPacks(packs: CustomEmojiPack[]): CustomEmojiPack[] {
        return [...packs]
            .map((pack) => ({ ...pack, emojis: sortEmojis(pack.emojis) }))
            .sort(
                (a, b) =>
                    Number(a.inherited) - Number(b.inherited) ||
                    (a.sourceName ?? "").localeCompare(b.sourceName ?? "") ||
                    a.name.localeCompare(b.name),
            );
    }

    function currentEmojiPacks(): CustomEmojiPack[] {
        return emojiPacks.filter((pack) => !pack.inherited);
    }

    function loadEmojis() {
        emojiPacks = sortEmojiPacks(getAvailableRoomEmojiPacks(room));
        const editablePacks = currentEmojiPacks();
        if (
            selectedEmojiPackKey !== "__new" &&
            !editablePacks.some(
                (pack) => packKey(pack) === selectedEmojiPackKey,
            )
        ) {
            selectedEmojiPackKey = editablePacks[0]
                ? packKey(editablePacks[0])
                : "__new";
        }
    }

    $effect(() => {
        const tab = activeTab;
        untrack(() => {
            if (tab === "emojis") loadEmojis();
        });
    });

    function selectedEmojiPackName(): string {
        if (selectedEmojiPackKey === "__new") {
            return newEmojiPackName.trim() || `${room.name || "Room"} Emojis`;
        }
        return (
            currentEmojiPacks().find(
                (pack) => packKey(pack) === selectedEmojiPackKey,
            )?.name || `${room.name || "Room"} Emojis`
        );
    }

    function selectedEmojiStateKey(): string {
        if (selectedEmojiPackKey !== "__new") return selectedEmojiPackKey;
        return newEmojiPackName.trim() || "";
    }

    async function handleEmojiUpload(e: Event) {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        emojiError = validateEmojiShortcode(emojiShortcode) ?? "";
        if (emojiError) {
            input.value = "";
            return;
        }
        if (
            selectedEmojiPackKey === "__new" &&
            currentEmojiPacks().length > 0 &&
            !newEmojiPackName.trim()
        ) {
            emojiError = "Enter a pack name.";
            input.value = "";
            return;
        }

        emojiUploading = true;
        try {
            const mxcUrl = await uploadContent(file);
            const stateKey = selectedEmojiStateKey();
            const normalized = await addRoomEmoji(
                room.roomId,
                stateKey,
                emojiShortcode,
                mxcUrl,
                selectedEmojiPackName(),
            );
            const httpUrl = mxcToHttp(mxcUrl);
            const nextEmoji = {
                shortcode: normalized,
                mxcUrl,
                url: httpUrl ?? "",
            };
            const existingPack = currentEmojiPacks().find(
                (pack) => packKey(pack) === stateKey,
            );
            const updatedPack: CustomEmojiPack = {
                ...(existingPack ?? {
                    id: `${room.roomId}:${stateKey}`,
                    roomId: room.roomId,
                    stateKey,
                    name: selectedEmojiPackName(),
                    sourceName: room.name || room.roomId,
                    avatarUrl: currentAvatarUrl ?? undefined,
                    emojis: [],
                }),
                emojis: [
                    ...(existingPack?.emojis ?? []).filter(
                        (e) => e.shortcode !== normalized,
                    ),
                    nextEmoji,
                ].filter((e) => e.url),
            };
            emojiPacks = sortEmojiPacks([
                ...emojiPacks.filter(
                    (pack) =>
                        pack.inherited ||
                        pack.roomId !== room.roomId ||
                        packKey(pack) !== stateKey,
                ),
                updatedPack,
            ]);
            emojiShortcode = "";
            selectedEmojiPackKey = stateKey;
            roomsState.roomsTick++;
            onUpdate?.();
        } catch (err: any) {
            emojiError = err?.message ?? "Upload failed";
        } finally {
            emojiUploading = false;
            input.value = "";
        }
    }

    async function doRemoveEmoji(pack: CustomEmojiPack, shortcode: string) {
        const stateKey = packKey(pack);
        emojiActionPending = `${stateKey}:${shortcode}`;
        emojiError = "";
        try {
            await removeRoomEmoji(room.roomId, stateKey, shortcode);
            emojiPacks = sortEmojiPacks(
                emojiPacks
                    .map((p) =>
                        !p.inherited &&
                        p.roomId === room.roomId &&
                        packKey(p) === stateKey
                            ? {
                                  ...p,
                                  emojis: p.emojis.filter(
                                      (e) => e.shortcode !== shortcode,
                                  ),
                              }
                            : p,
                    )
                    .filter((p) => p.inherited || p.emojis.length > 0),
            );
            roomsState.roomsTick++;
            onUpdate?.();
        } catch (err: any) {
            emojiError = err?.message ?? "Failed to remove emoji";
        } finally {
            emojiActionPending = null;
        }
    }

    // ── Stickers tab ──────────────────────────────────────────────────────────
    let stickerPacks = $state<CustomStickerPack[]>([]);
    let selectedStickerPackKey = $state("");
    let newStickerPackName = $state("");
    let stickerShortcode = $state("");
    let stickerUploading = $state(false);
    let stickerActionPending = $state<string | null>(null);
    let stickerError = $state("");

    function sortStickers(stickers: CustomSticker[]): CustomSticker[] {
        return [...stickers].sort((a, b) =>
            a.shortcode.localeCompare(b.shortcode),
        );
    }

    function sortStickerPacks(packs: CustomStickerPack[]): CustomStickerPack[] {
        return [...packs]
            .map((pack) => ({
                ...pack,
                stickers: sortStickers(pack.stickers),
            }))
            .sort(
                (a, b) =>
                    Number(a.inherited) - Number(b.inherited) ||
                    (a.sourceName ?? "").localeCompare(b.sourceName ?? "") ||
                    a.name.localeCompare(b.name),
            );
    }

    function currentStickerPacks(): CustomStickerPack[] {
        return stickerPacks.filter((pack) => !pack.inherited);
    }

    function loadStickers() {
        stickerPacks = sortStickerPacks(getAvailableRoomStickerPacks(room));
        const editablePacks = currentStickerPacks();
        if (
            selectedStickerPackKey !== "__new" &&
            !editablePacks.some(
                (pack) => packKey(pack) === selectedStickerPackKey,
            )
        ) {
            selectedStickerPackKey = editablePacks[0]
                ? packKey(editablePacks[0])
                : "__new";
        }
    }

    $effect(() => {
        const tab = activeTab;
        untrack(() => {
            if (tab === "stickers") loadStickers();
        });
    });

    function selectedStickerPackName(): string {
        if (selectedStickerPackKey === "__new") {
            return (
                newStickerPackName.trim() || `${room.name || "Room"} Stickers`
            );
        }
        return (
            currentStickerPacks().find(
                (pack) => packKey(pack) === selectedStickerPackKey,
            )?.name || `${room.name || "Room"} Stickers`
        );
    }

    function selectedStickerStateKey(): string {
        if (selectedStickerPackKey !== "__new") return selectedStickerPackKey;
        return newStickerPackName.trim() || "";
    }

    async function handleStickerUpload(e: Event) {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        stickerError = validateEmojiShortcode(stickerShortcode) ?? "";
        if (stickerError) {
            input.value = "";
            return;
        }
        if (
            selectedStickerPackKey === "__new" &&
            currentStickerPacks().length > 0 &&
            !newStickerPackName.trim()
        ) {
            stickerError = "Enter a pack name.";
            input.value = "";
            return;
        }

        stickerUploading = true;
        try {
            const mxcUrl = await uploadContent(file);
            const stateKey = selectedStickerStateKey();
            const normalized = await addRoomSticker(
                room.roomId,
                stateKey,
                stickerShortcode,
                mxcUrl,
                selectedStickerPackName(),
            );
            const httpUrl = mxcToHttp(mxcUrl);
            const nextSticker = {
                shortcode: normalized,
                mxcUrl,
                url: httpUrl ?? "",
            };
            const existingPack = currentStickerPacks().find(
                (pack) => packKey(pack) === stateKey,
            );
            const updatedPack: CustomStickerPack = {
                ...(existingPack ?? {
                    id: `${room.roomId}:${stateKey}`,
                    roomId: room.roomId,
                    stateKey,
                    name: selectedStickerPackName(),
                    sourceName: room.name || room.roomId,
                    avatarUrl: currentAvatarUrl ?? undefined,
                    stickers: [],
                }),
                stickers: [
                    ...(existingPack?.stickers ?? []).filter(
                        (s) => s.shortcode !== normalized,
                    ),
                    nextSticker,
                ].filter((s) => s.url),
            };
            stickerPacks = sortStickerPacks([
                ...stickerPacks.filter(
                    (pack) =>
                        pack.inherited ||
                        pack.roomId !== room.roomId ||
                        packKey(pack) !== stateKey,
                ),
                updatedPack,
            ]);
            stickerShortcode = "";
            selectedStickerPackKey = stateKey;
            roomsState.roomsTick++;
            onUpdate?.();
        } catch (err: any) {
            stickerError = err?.message ?? "Upload failed";
        } finally {
            stickerUploading = false;
            input.value = "";
        }
    }

    async function doRemoveSticker(pack: CustomStickerPack, shortcode: string) {
        const stateKey = packKey(pack);
        stickerActionPending = `${stateKey}:${shortcode}`;
        stickerError = "";
        try {
            await removeRoomSticker(room.roomId, stateKey, shortcode);
            stickerPacks = sortStickerPacks(
                stickerPacks
                    .map((p) =>
                        !p.inherited &&
                        p.roomId === room.roomId &&
                        packKey(p) === stateKey
                            ? {
                                  ...p,
                                  stickers: p.stickers.filter(
                                      (s) => s.shortcode !== shortcode,
                                  ),
                              }
                            : p,
                    )
                    .filter((p) => p.inherited || p.stickers.length > 0),
            );
            roomsState.roomsTick++;
            onUpdate?.();
        } catch (err: any) {
            stickerError = err?.message ?? "Failed to remove sticker";
        } finally {
            stickerActionPending = null;
        }
    }

    const tabs: { id: Tab; label: string }[] = [
        { id: "general", label: "General" },
        { id: "access", label: "Access" },
        { id: "permissions", label: "Permissions" },
        { id: "members", label: "Members" },
        { id: "emotes", label: "Emotes" },
        ...(untrack(() => isSpace)
            ? [{ id: "rooms" as Tab, label: "Rooms" }]
            : []),
    ];
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-1 sm:p-4"
    onclick={(e) => {
        if (e.target === e.currentTarget) onClose();
    }}
>
    <div
        class="bg-discord-backgroundSecondary rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden"
        style="max-height: 85dvh;"
    >
        <!-- Header -->
        <div
            class="flex items-center justify-between px-6 py-4 border-b border-discord-divider flex-shrink-0"
        >
            <h2 class="text-lg font-bold text-discord-textPrimary truncate">
                {room.name} — Settings
            </h2>
            <!-- svelte-ignore a11y_consider_explicit_label -->
            <button
                onclick={onClose}
                class="p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors flex-shrink-0"
            >
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"
                    ><path
                        d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                    /></svg
                >
            </button>
        </div>

        <div class="flex flex-1 min-h-0">
            <!-- Tab sidebar -->
            <nav
                class="w-40 flex-shrink-0 border-r border-discord-divider py-3 flex flex-col gap-0.5 px-2"
            >
                {#each tabs as tab (tab.id)}
                    <button
                        onclick={() => (activeTab = tab.id)}
                        class="w-full text-left px-3 py-2 rounded text-sm font-medium transition-colors"
                        class:bg-discord-messageHover={activeTab === tab.id}
                        class:text-discord-textPrimary={activeTab === tab.id}
                        class:text-discord-textMuted={activeTab !== tab.id}
                        >{tab.label}</button
                    >
                {/each}
            </nav>

            <!-- Tab content -->
            <div class="flex-1 overflow-y-auto p-6 min-w-0">
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
                            <!-- svelte-ignore a11y_label_has_associated_control -->
                            <label
                                class="block text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1.5"
                                >Room Name</label
                            >
                            <input
                                bind:value={nameInput}
                                disabled={!canEditState}
                                class="w-full bg-discord-backgroundTertiary text-discord-textPrimary text-sm rounded px-3 py-2 outline-none border border-transparent focus:border-discord-accent/50 disabled:opacity-50"
                            />
                        </div>

                        <!-- Topic -->
                        <!-- svelte-ignore a11y_label_has_associated_control -->
                        <div>
                            <label
                                class="block text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1.5"
                                >Topic</label
                            >
                            <textarea
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
                    <div class="space-y-3">
                        <div class="flex items-center gap-3">
                            <input
                                bind:value={memberSearch}
                                placeholder="Search members…"
                                class="flex-1 bg-discord-backgroundTertiary text-discord-textPrimary placeholder-discord-textMuted text-sm rounded px-3 py-1.5 outline-none border border-transparent focus:border-discord-accent/50"
                            />
                            {#if canBan}
                                <button
                                    onclick={() => (showBanned = !showBanned)}
                                    class="px-3 py-1.5 rounded text-sm font-medium transition-colors {showBanned
                                        ? 'bg-discord-danger text-white'
                                        : 'bg-discord-backgroundTertiary text-discord-textMuted hover:text-discord-textPrimary'}"
                                    >Banned ({bannedMembers.length})</button
                                >
                            {/if}
                        </div>

                        {#if memberError}<p class="text-sm text-discord-danger">
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
                                    {@const canActOnMember =
                                        !isSelf &&
                                        myPowerLevel > member.powerLevel}
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
                                                >{plLabel(member.powerLevel)} ({member.powerLevel})</span
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
                                                                member.userId
                                                            ]
                                                        }
                                                        placeholder="Reason (optional)"
                                                        class="w-full bg-discord-backgroundSecondary text-discord-textPrimary placeholder-discord-textMuted text-xs rounded px-2 py-1.5 outline-none border border-transparent focus:border-discord-accent/50"
                                                    />
                                                {/if}
                                                <div
                                                    class="flex flex-wrap gap-2"
                                                >
                                                    {#if myPowerLevel >= 100 || myPowerLevel > member.powerLevel}
                                                        <select
                                                            onchange={(e) =>
                                                                doSetPowerLevel(
                                                                    member,
                                                                    Number(
                                                                        (
                                                                            e.target as HTMLSelectElement
                                                                        ).value,
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
                                                                    >Admin (100)</option
                                                                >{/if}
                                                            {#if myPowerLevel >= 50}<option
                                                                    value="50"
                                                                    >Moderator
                                                                    (50)</option
                                                                >{/if}
                                                            <option value="0"
                                                                >Member (0)</option
                                                            >
                                                        </select>
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
                    <div class="space-y-4">
                        <div class="space-y-2">
                            <label
                                class="block text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
                                for="room-emote-shortcode"
                            >
                                Add Image
                            </label>
                            <div class="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                                <div class="min-w-0">
                                    <select
                                        bind:value={selectedEmotePackKey}
                                        disabled={!canEditEmojis ||
                                            emoteUploading}
                                        class="w-full bg-discord-backgroundTertiary text-discord-textPrimary text-sm rounded px-3 py-2 outline-none border border-transparent focus:border-discord-accent/50 disabled:opacity-50"
                                    >
                                        {#each currentEmotePacks() as pack (pack.id)}
                                            <option value={packKey(pack)}
                                                >{pack.name}</option
                                            >
                                        {/each}
                                        <option value="__new">New pack</option>
                                    </select>
                                </div>
                                <div
                                    class={selectedEmotePackKey === "__new"
                                        ? "grid gap-2 min-w-0 sm:grid-cols-2"
                                        : "grid gap-2 min-w-0"}
                                >
                                    {#if selectedEmotePackKey === "__new"}
                                        <input
                                            bind:value={newEmotePackName}
                                            disabled={!canEditEmojis ||
                                                emoteUploading}
                                            placeholder="Pack name"
                                            class="min-w-0 bg-discord-backgroundTertiary text-discord-textPrimary placeholder-discord-textMuted text-sm rounded px-3 py-2 outline-none border border-transparent focus:border-discord-accent/50 disabled:opacity-50"
                                        />
                                    {/if}
                                    <div
                                        class="flex items-center bg-discord-backgroundTertiary rounded border border-transparent focus-within:border-discord-accent/50"
                                    >
                                        <span
                                            class="pl-3 text-sm text-discord-textMuted"
                                            >:</span
                                        >
                                        <input
                                            id="room-emote-shortcode"
                                            bind:value={emoteShortcode}
                                            disabled={!canEditEmojis ||
                                                emoteUploading}
                                            placeholder="shortcode"
                                            class="min-w-0 flex-1 bg-transparent text-discord-textPrimary placeholder-discord-textMuted text-sm py-2 outline-none disabled:opacity-50"
                                        />
                                        <span
                                            class="pr-3 text-sm text-discord-textMuted"
                                            >:</span
                                        >
                                    </div>
                                </div>
                                {#if canEditEmojis}
                                    <label
                                        class="shrink-0 cursor-pointer px-3 py-2 rounded bg-discord-accent hover:bg-discord-accentHover text-white text-sm font-semibold transition-colors text-center {emoteUploading
                                            ? 'opacity-50 pointer-events-none'
                                            : ''}"
                                    >
                                        {emoteUploading
                                            ? "Uploading…"
                                            : "Upload Image"}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            class="hidden"
                                            onchange={handleEmoteUpload}
                                            disabled={emoteUploading}
                                        />
                                    </label>
                                {/if}
                            </div>
                            <div
                                class="flex items-center gap-3 px-3 py-2 rounded bg-discord-backgroundTertiary"
                            >
                                <label
                                    class="flex items-center gap-1.5 text-xs text-discord-textPrimary"
                                >
                                    <input
                                        type="checkbox"
                                        bind:checked={newEmoteAsEmoji}
                                        disabled={!canEditEmojis ||
                                            emoteUploading}
                                        class="accent-discord-accent"
                                    />
                                    Use as emoji
                                </label>
                                <label
                                    class="flex items-center gap-1.5 text-xs text-discord-textPrimary"
                                >
                                    <input
                                        type="checkbox"
                                        bind:checked={newEmoteAsSticker}
                                        disabled={!canEditEmojis ||
                                            emoteUploading}
                                        class="accent-discord-accent"
                                    />
                                    Use as sticker
                                </label>
                            </div>
                        </div>

                        {#if emoteError}<p class="text-sm text-discord-danger">
                                {emoteError}
                            </p>{/if}

                        <div class="space-y-3">
                            {#each emotePacks as pack (pack.id)}
                                <div
                                    class="rounded bg-discord-backgroundTertiary overflow-hidden"
                                >
                                    <div
                                        class="flex items-center gap-2 px-3 py-2 border-b border-discord-divider"
                                    >
                                        {#if pack.avatarUrl}
                                            <img
                                                src={pack.avatarUrl}
                                                alt=""
                                                class="w-5 h-5 rounded object-cover flex-shrink-0"
                                            />
                                        {/if}
                                        <div class="min-w-0 flex-1">
                                            <p
                                                class="text-sm font-semibold text-discord-textPrimary truncate"
                                            >
                                                {pack.name}
                                            </p>
                                            <p
                                                class="text-xs text-discord-textMuted truncate"
                                            >
                                                {pack.inherited
                                                    ? `Inherited from ${pack.sourceName}`
                                                    : pack.sourceName}
                                            </p>
                                        </div>
                                    </div>
                                    <div class="space-y-1 p-2">
                                        {#each pack.images as item (pack.id + ":" + item.shortcode)}
                                            <div
                                                class="flex items-center gap-3 p-2 rounded bg-discord-backgroundSecondary"
                                            >
                                                <div
                                                    class="w-12 h-12 rounded bg-discord-backgroundTertiary flex-shrink-0 overflow-hidden flex items-center justify-center"
                                                >
                                                    <img
                                                        src={item.url}
                                                        alt=""
                                                        class="max-w-full max-h-full object-contain"
                                                    />
                                                </div>
                                                <div class="flex-1 min-w-0">
                                                    <p
                                                        class="text-sm font-medium text-discord-textPrimary truncate"
                                                    >
                                                        :{item.shortcode}:
                                                    </p>
                                                    <p
                                                        class="text-xs text-discord-textMuted truncate"
                                                    >
                                                        {item.mxcUrl}
                                                    </p>
                                                </div>
                                                <div
                                                    class="flex items-center gap-3"
                                                >
                                                    <label
                                                        class="flex items-center gap-1.5 text-xs text-discord-textPrimary"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={item.canEmoji}
                                                            onchange={(e) =>
                                                                setRoomEmoteFlag(
                                                                    pack,
                                                                    item,
                                                                    "emoticon",
                                                                    (
                                                                        e.target as HTMLInputElement
                                                                    ).checked,
                                                                )}
                                                            disabled={pack.inherited ||
                                                                !canEditEmojis ||
                                                                emoteActionPending ===
                                                                    `${packKey(pack)}:${item.shortcode}:emoticon`}
                                                            class="accent-discord-accent"
                                                        />
                                                        Emoji
                                                    </label>
                                                    <label
                                                        class="flex items-center gap-1.5 text-xs text-discord-textPrimary"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={item.canSticker}
                                                            onchange={(e) =>
                                                                setRoomEmoteFlag(
                                                                    pack,
                                                                    item,
                                                                    "sticker",
                                                                    (
                                                                        e.target as HTMLInputElement
                                                                    ).checked,
                                                                )}
                                                            disabled={pack.inherited ||
                                                                !canEditEmojis ||
                                                                emoteActionPending ===
                                                                    `${packKey(pack)}:${item.shortcode}:sticker`}
                                                            class="accent-discord-accent"
                                                        />
                                                        Sticker
                                                    </label>
                                                </div>
                                                {#if canEditEmojis && !pack.inherited}
                                                    <button
                                                        onclick={() =>
                                                            doRemoveEmote(
                                                                pack,
                                                                item.shortcode,
                                                            )}
                                                        disabled={emoteActionPending ===
                                                            `${packKey(pack)}:${item.shortcode}:remove`}
                                                        class="p-1 rounded text-discord-textMuted hover:text-discord-danger hover:bg-discord-messageHover transition-colors disabled:opacity-50"
                                                        title="Remove image"
                                                    >
                                                        <svg
                                                            class="w-4 h-4"
                                                            fill="currentColor"
                                                            viewBox="0 0 24 24"
                                                            ><path
                                                                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59z"
                                                            /></svg
                                                        >
                                                    </button>
                                                {/if}
                                            </div>
                                        {/each}
                                    </div>
                                </div>
                            {/each}
                            {#if emotePacks.length === 0}<p
                                    class="text-sm text-discord-textMuted text-center py-4"
                                >
                                    No custom images
                                </p>{/if}
                        </div>
                    </div>

                    <!-- ── Emojis ──────────────────────────────────────────── -->
                {:else if activeTab === "emojis"}
                    <div class="space-y-4">
                        <div class="space-y-2">
                            <label
                                class="block text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
                                for="room-emoji-shortcode"
                            >
                                Add Emoji
                            </label>
                            <div class="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                                <div class="min-w-0">
                                    <select
                                        bind:value={selectedEmojiPackKey}
                                        disabled={!canEditEmojis ||
                                            emojiUploading}
                                        class="w-full bg-discord-backgroundTertiary text-discord-textPrimary text-sm rounded px-3 py-2 outline-none border border-transparent focus:border-discord-accent/50 disabled:opacity-50"
                                    >
                                        {#each currentEmojiPacks() as pack (pack.id)}
                                            <option value={packKey(pack)}
                                                >{pack.name}</option
                                            >
                                        {/each}
                                        <option value="__new">New pack</option>
                                    </select>
                                </div>
                                {#if selectedEmojiPackKey === "__new"}
                                    <input
                                        bind:value={newEmojiPackName}
                                        disabled={!canEditEmojis ||
                                            emojiUploading}
                                        placeholder="Pack name"
                                        class="min-w-0 bg-discord-backgroundTertiary text-discord-textPrimary placeholder-discord-textMuted text-sm rounded px-3 py-2 outline-none border border-transparent focus:border-discord-accent/50 disabled:opacity-50"
                                    />
                                {:else}
                                    <div
                                        class="flex items-center bg-discord-backgroundTertiary rounded border border-transparent focus-within:border-discord-accent/50"
                                    >
                                        <span
                                            class="pl-3 text-sm text-discord-textMuted"
                                            >:</span
                                        >
                                        <input
                                            id="room-emoji-shortcode"
                                            bind:value={emojiShortcode}
                                            disabled={!canEditEmojis ||
                                                emojiUploading}
                                            placeholder="shortcode"
                                            class="min-w-0 flex-1 bg-transparent text-discord-textPrimary placeholder-discord-textMuted text-sm py-2 outline-none disabled:opacity-50"
                                        />
                                        <span
                                            class="pr-3 text-sm text-discord-textMuted"
                                            >:</span
                                        >
                                    </div>
                                {/if}
                                {#if selectedEmojiPackKey === "__new"}
                                    <div
                                        class="flex items-center bg-discord-backgroundTertiary rounded border border-transparent focus-within:border-discord-accent/50"
                                    >
                                        <span
                                            class="pl-3 text-sm text-discord-textMuted"
                                            >:</span
                                        >
                                        <input
                                            id="room-emoji-shortcode"
                                            bind:value={emojiShortcode}
                                            disabled={!canEditEmojis ||
                                                emojiUploading}
                                            placeholder="shortcode"
                                            class="min-w-0 flex-1 bg-transparent text-discord-textPrimary placeholder-discord-textMuted text-sm py-2 outline-none disabled:opacity-50"
                                        />
                                        <span
                                            class="pr-3 text-sm text-discord-textMuted"
                                            >:</span
                                        >
                                    </div>
                                {/if}
                                {#if canEditEmojis}
                                    <label
                                        class="shrink-0 cursor-pointer px-3 py-2 rounded bg-discord-accent hover:bg-discord-accentHover text-white text-sm font-semibold transition-colors text-center {emojiUploading
                                            ? 'opacity-50 pointer-events-none'
                                            : ''}"
                                    >
                                        {emojiUploading
                                            ? "Uploading…"
                                            : "Upload Image"}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            class="hidden"
                                            onchange={handleEmojiUpload}
                                            disabled={emojiUploading}
                                        />
                                    </label>
                                {/if}
                            </div>
                        </div>

                        {#if emojiError}<p class="text-sm text-discord-danger">
                                {emojiError}
                            </p>{/if}

                        <div class="space-y-3">
                            {#each emojiPacks as pack (pack.id)}
                                <div
                                    class="rounded bg-discord-backgroundTertiary overflow-hidden"
                                >
                                    <div
                                        class="flex items-center gap-2 px-3 py-2 border-b border-discord-divider"
                                    >
                                        {#if pack.avatarUrl}
                                            <img
                                                src={pack.avatarUrl}
                                                alt=""
                                                class="w-5 h-5 rounded object-cover flex-shrink-0"
                                            />
                                        {/if}
                                        <div class="min-w-0 flex-1">
                                            <p
                                                class="text-sm font-semibold text-discord-textPrimary truncate"
                                            >
                                                {pack.name}
                                            </p>
                                            <p
                                                class="text-xs text-discord-textMuted truncate"
                                            >
                                                {pack.inherited
                                                    ? `Inherited from ${pack.sourceName}`
                                                    : pack.sourceName}
                                            </p>
                                        </div>
                                    </div>
                                    <div class="space-y-1 p-2">
                                        {#each pack.emojis as emoji (pack.id + ":" + emoji.shortcode)}
                                            <div
                                                class="flex items-center gap-3 p-2 rounded bg-discord-backgroundSecondary"
                                            >
                                                <div
                                                    class="w-9 h-9 rounded bg-discord-backgroundTertiary flex-shrink-0 overflow-hidden flex items-center justify-center"
                                                >
                                                    <img
                                                        src={emoji.url}
                                                        alt=""
                                                        class="max-w-full max-h-full object-contain"
                                                    />
                                                </div>
                                                <div class="flex-1 min-w-0">
                                                    <p
                                                        class="text-sm font-medium text-discord-textPrimary truncate"
                                                    >
                                                        :{emoji.shortcode}:
                                                    </p>
                                                    <p
                                                        class="text-xs text-discord-textMuted truncate"
                                                    >
                                                        {emoji.mxcUrl}
                                                    </p>
                                                </div>
                                                {#if canEditEmojis && !pack.inherited}
                                                    <button
                                                        onclick={() =>
                                                            doRemoveEmoji(
                                                                pack,
                                                                emoji.shortcode,
                                                            )}
                                                        disabled={emojiActionPending ===
                                                            `${packKey(pack)}:${emoji.shortcode}`}
                                                        class="p-1 rounded text-discord-textMuted hover:text-discord-danger hover:bg-discord-messageHover transition-colors disabled:opacity-50"
                                                        title="Remove emoji"
                                                    >
                                                        <svg
                                                            class="w-4 h-4"
                                                            fill="currentColor"
                                                            viewBox="0 0 24 24"
                                                            ><path
                                                                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59z"
                                                            /></svg
                                                        >
                                                    </button>
                                                {/if}
                                            </div>
                                        {/each}
                                    </div>
                                </div>
                            {/each}
                            {#if emojiPacks.length === 0}<p
                                    class="text-sm text-discord-textMuted text-center py-4"
                                >
                                    No custom emojis
                                </p>{/if}
                        </div>
                    </div>

                    <!-- ── Stickers ────────────────────────────────────────── -->
                {:else if activeTab === "stickers"}
                    <div class="space-y-4">
                        <div class="space-y-2">
                            <label
                                class="block text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
                                for="room-sticker-shortcode"
                            >
                                Add Sticker
                            </label>
                            <div class="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                                <div class="min-w-0">
                                    <select
                                        bind:value={selectedStickerPackKey}
                                        disabled={!canEditStickers ||
                                            stickerUploading}
                                        class="w-full bg-discord-backgroundTertiary text-discord-textPrimary text-sm rounded px-3 py-2 outline-none border border-transparent focus:border-discord-accent/50 disabled:opacity-50"
                                    >
                                        {#each currentStickerPacks() as pack (pack.id)}
                                            <option value={packKey(pack)}
                                                >{pack.name}</option
                                            >
                                        {/each}
                                        <option value="__new">New pack</option>
                                    </select>
                                </div>
                                {#if selectedStickerPackKey === "__new"}
                                    <input
                                        bind:value={newStickerPackName}
                                        disabled={!canEditStickers ||
                                            stickerUploading}
                                        placeholder="Pack name"
                                        class="min-w-0 bg-discord-backgroundTertiary text-discord-textPrimary placeholder-discord-textMuted text-sm rounded px-3 py-2 outline-none border border-transparent focus:border-discord-accent/50 disabled:opacity-50"
                                    />
                                {:else}
                                    <div
                                        class="flex items-center bg-discord-backgroundTertiary rounded border border-transparent focus-within:border-discord-accent/50"
                                    >
                                        <span
                                            class="pl-3 text-sm text-discord-textMuted"
                                            >:</span
                                        >
                                        <input
                                            id="room-sticker-shortcode"
                                            bind:value={stickerShortcode}
                                            disabled={!canEditStickers ||
                                                stickerUploading}
                                            placeholder="shortcode"
                                            class="min-w-0 flex-1 bg-transparent text-discord-textPrimary placeholder-discord-textMuted text-sm py-2 outline-none disabled:opacity-50"
                                        />
                                        <span
                                            class="pr-3 text-sm text-discord-textMuted"
                                            >:</span
                                        >
                                    </div>
                                {/if}
                                {#if selectedStickerPackKey === "__new"}
                                    <div
                                        class="flex items-center bg-discord-backgroundTertiary rounded border border-transparent focus-within:border-discord-accent/50"
                                    >
                                        <span
                                            class="pl-3 text-sm text-discord-textMuted"
                                            >:</span
                                        >
                                        <input
                                            id="room-sticker-shortcode"
                                            bind:value={stickerShortcode}
                                            disabled={!canEditStickers ||
                                                stickerUploading}
                                            placeholder="shortcode"
                                            class="min-w-0 flex-1 bg-transparent text-discord-textPrimary placeholder-discord-textMuted text-sm py-2 outline-none disabled:opacity-50"
                                        />
                                        <span
                                            class="pr-3 text-sm text-discord-textMuted"
                                            >:</span
                                        >
                                    </div>
                                {/if}
                                {#if canEditStickers}
                                    <label
                                        class="shrink-0 cursor-pointer px-3 py-2 rounded bg-discord-accent hover:bg-discord-accentHover text-white text-sm font-semibold transition-colors text-center {stickerUploading
                                            ? 'opacity-50 pointer-events-none'
                                            : ''}"
                                    >
                                        {stickerUploading
                                            ? "Uploading…"
                                            : "Upload Image"}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            class="hidden"
                                            onchange={handleStickerUpload}
                                            disabled={stickerUploading}
                                        />
                                    </label>
                                {/if}
                            </div>
                        </div>

                        {#if stickerError}<p
                                class="text-sm text-discord-danger"
                            >
                                {stickerError}
                            </p>{/if}

                        <div class="space-y-3">
                            {#each stickerPacks as pack (pack.id)}
                                <div
                                    class="rounded bg-discord-backgroundTertiary overflow-hidden"
                                >
                                    <div
                                        class="flex items-center gap-2 px-3 py-2 border-b border-discord-divider"
                                    >
                                        {#if pack.avatarUrl}
                                            <img
                                                src={pack.avatarUrl}
                                                alt=""
                                                class="w-5 h-5 rounded object-cover flex-shrink-0"
                                            />
                                        {/if}
                                        <div class="min-w-0 flex-1">
                                            <p
                                                class="text-sm font-semibold text-discord-textPrimary truncate"
                                            >
                                                {pack.name}
                                            </p>
                                            <p
                                                class="text-xs text-discord-textMuted truncate"
                                            >
                                                {pack.inherited
                                                    ? `Inherited from ${pack.sourceName}`
                                                    : pack.sourceName}
                                            </p>
                                        </div>
                                    </div>
                                    <div class="space-y-1 p-2">
                                        {#each pack.stickers as sticker (pack.id + ":" + sticker.shortcode)}
                                            <div
                                                class="flex items-center gap-3 p-2 rounded bg-discord-backgroundSecondary"
                                            >
                                                <div
                                                    class="w-12 h-12 rounded bg-discord-backgroundTertiary flex-shrink-0 overflow-hidden flex items-center justify-center"
                                                >
                                                    <img
                                                        src={sticker.url}
                                                        alt=""
                                                        class="max-w-full max-h-full object-contain"
                                                    />
                                                </div>
                                                <div class="flex-1 min-w-0">
                                                    <p
                                                        class="text-sm font-medium text-discord-textPrimary truncate"
                                                    >
                                                        :{sticker.shortcode}:
                                                    </p>
                                                    <p
                                                        class="text-xs text-discord-textMuted truncate"
                                                    >
                                                        {sticker.mxcUrl}
                                                    </p>
                                                </div>
                                                {#if canEditStickers && !pack.inherited}
                                                    <button
                                                        onclick={() =>
                                                            doRemoveSticker(
                                                                pack,
                                                                sticker.shortcode,
                                                            )}
                                                        disabled={stickerActionPending ===
                                                            `${packKey(pack)}:${sticker.shortcode}`}
                                                        class="p-1 rounded text-discord-textMuted hover:text-discord-danger hover:bg-discord-messageHover transition-colors disabled:opacity-50"
                                                        title="Remove sticker"
                                                    >
                                                        <svg
                                                            class="w-4 h-4"
                                                            fill="currentColor"
                                                            viewBox="0 0 24 24"
                                                            ><path
                                                                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59z"
                                                            /></svg
                                                        >
                                                    </button>
                                                {/if}
                                            </div>
                                        {/each}
                                    </div>
                                </div>
                            {/each}
                            {#if stickerPacks.length === 0}<p
                                    class="text-sm text-discord-textMuted text-center py-4"
                                >
                                    No custom stickers
                                </p>{/if}
                        </div>
                    </div>
                {/if}
            </div>
        </div>
    </div>
</div>
