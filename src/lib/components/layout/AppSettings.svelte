<script lang="ts">
    import {
        getSpaces,
        getOrphanRooms,
        getDirectRooms,
        getRoomsInSpace,
        getRoomDisplayName,
        getRoomNotificationSetting,
        setRoomNotificationSetting,
        getDefaultPushRuleLevel,
        setDefaultPushRuleLevel,
        DEFAULT_PUSH_RULES,
        getClient,
        uploadContent,
        mxcToHttp,
        getOwnDisplayName,
        getOwnAvatarMxc,
        fetchOwnProfile,
        setOwnDisplayName,
        setOwnAvatarMxc,
        getOwnDeviceId,
        getOwnDevices,
        renameDevice,
        deleteOwnDevice,
        getUserEmotePack,
        getUserEmojiPack,
        getUserStickerPack,
        addUserEmote,
        addUserEmoji,
        addUserSticker,
        setUserEmoteUsage,
        removeUserEmoteImage,
        removeUserEmoji,
        removeUserSticker,
        validateEmojiShortcode,
        getPushRuleSummary,
        getServerVersions,
        getServerCapabilities,
        probeCallingSupport,
        type CustomPackImage,
        type CustomEmoji,
        type CustomSticker,
        type ImageUsage,
        type RoomNotificationSetting,
        type PushRuleLevel,
        type PushRuleSummary,
    } from "$lib/matrix/client";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import { auth } from "$lib/stores/auth.svelte";
    import { roomsState } from "$lib/stores/rooms.svelte";
    import {
        ignoredUsersState,
        unblockUser,
    } from "$lib/stores/ignoredUsers.svelte";
    import { syncStateLabel } from "$lib/utils/syncStatus";
    import {
        serverSupports,
        specAtLeast,
        labelUnstableFeature,
        type GatedFeature,
    } from "$lib/utils/serverCapabilities";
    import {
        sortDevices,
        formatLastSeen,
        describeUserAgent,
        type DeviceInfo,
    } from "$lib/utils/deviceSessions";
    import {
        settingsState,
        setShowAllEvents,
        setKeepSidebarOpen,
        setPrivateReadReceipts,
    } from "$lib/stores/settings.svelte";
    import { changeOwnPresence } from "$lib/stores/presence.svelte";
    import {
        OWN_PRESENCE_OPTIONS,
        type PresenceState,
    } from "$lib/utils/presence";
    import {
        APP_VERSION,
        CAN_INSTALL_UPDATE,
        checkForUpdate,
        openReleasePage,
        type UpdateInfo,
    } from "$lib/update";
    import {
        pushDebug,
        fetchRegisteredPushers,
        checkGatewayHealth,
        PUSH_GATEWAY_NOTIFY_URL,
        PUSH_APP_ID,
        type RegisteredPusher,
        type GatewayHealth,
    } from "$lib/push";
    import {
        readNativeSession,
        type NativeSessionState,
    } from "$lib/nativeSession";
    import {
        initWebPush,
        readWebPushState,
        requestWebPushPermission,
        WEBPUSH_APP_ID,
        type WebPushDebug,
    } from "$lib/webPush";

    interface Props {
        onClose: () => void;
        onLogout: () => void;
    }

    let { onClose, onLogout }: Props = $props();

    type Tab =
        | "account"
        | "sessions"
        | "behavior"
        | "emotes"
        | "emojis"
        | "stickers"
        | "notifications"
        | "blocked"
        | "server"
        | "about"
        | "debug";
    let activeTab = $state<Tab>("account");

    const tabs: { id: Tab; label: string }[] = [
        { id: "account", label: "Account" },
        { id: "sessions", label: "Sessions" },
        { id: "behavior", label: "Behavior" },
        { id: "emotes", label: "My Emotes" },
        { id: "notifications", label: "Notifications" },
        { id: "blocked", label: "Blocked Users" },
        { id: "server", label: "Server" },
        { id: "about", label: "About" },
        { id: "debug", label: "Debug Info" },
    ];

    // ── Server tab: capability scan ─────────────────────────────────────────────
    type Support = "yes" | "no" | "unknown";
    interface CapRow {
        label: string;
        support: Support;
        detail?: string;
    }
    let serverLoaded = $state(false);
    let serverLoading = $state(false);
    let serverError = $state("");
    let specVersions = $state<string[]>([]);
    let clientFeatureRows = $state<CapRow[]>([]);
    let roomVersion = $state<string>("");
    let unstableLabels = $state<string[]>([]);
    let callingSupport = $state<Support>("unknown");

    async function loadServerInfo() {
        serverLoading = true;
        serverError = "";
        try {
            const [ver, caps, calling] = await Promise.all([
                getServerVersions(),
                getServerCapabilities(),
                probeCallingSupport(),
            ]);
            specVersions = ver.versions;

            const gate = (f: GatedFeature): Support =>
                serverSupports(f, caps) ? "yes" : "no";
            clientFeatureRows = [
                { label: "Change password", support: gate("changePassword") },
                {
                    label: "Change display name",
                    support: gate("setDisplayName"),
                },
                { label: "Change avatar", support: gate("setAvatarUrl") },
                {
                    label: "Manage emails / phone numbers",
                    support: gate("change3pid"),
                },
                {
                    label: "Threads",
                    support: specAtLeast(ver.versions, "v1.4")
                        ? "yes"
                        : "unknown",
                },
                {
                    label: "Private read receipts",
                    support:
                        specAtLeast(ver.versions, "v1.4") ||
                        ver.unstableFeatures["org.matrix.msc2285.stable"]
                            ? "yes"
                            : "unknown",
                },
            ];

            const rv = caps["m.room_versions"] as
                | { default?: string }
                | undefined;
            roomVersion = rv?.default ?? "";

            unstableLabels = Object.entries(ver.unstableFeatures)
                .filter(([, on]) => on)
                .map(([k]) => labelUnstableFeature(k))
                .sort((a, b) => a.localeCompare(b));

            callingSupport =
                calling === "available"
                    ? "yes"
                    : calling === "unavailable"
                      ? "no"
                      : "unknown";
            serverLoaded = true;
        } catch (err) {
            serverError =
                (err as Error)?.message ?? "Failed to read server capabilities";
        } finally {
            serverLoading = false;
        }
    }

    $effect(() => {
        if (activeTab === "server" && !serverLoaded && !serverLoading) {
            loadServerInfo();
        }
    });

    function supportBadge(s: Support): { text: string; cls: string } {
        if (s === "yes") return { text: "Supported", cls: "text-green-400" };
        if (s === "no")
            return { text: "Not supported", cls: "text-discord-danger" };
        return { text: "Unknown", cls: "text-discord-textMuted" };
    }

    // ── Account tab: profile editing ───────────────────────────────────────────
    let profileDisplayName = $state("");
    let profileAvatarMxc = $state<string | null>(null);
    let profileLoaded = $state(false);
    let avatarUploading = $state(false);
    let savingName = $state(false);
    let profileError = $state("");
    let profileSaved = $state(false);
    let avatarInputEl: HTMLInputElement | undefined = $state();

    const avatarPreviewUrl = $derived(mxcToHttp(profileAvatarMxc));
    const syncStatus = $derived(syncStateLabel(auth.syncState));
    const nameChanged = $derived(
        profileDisplayName.trim() !== (getOwnDisplayName() ?? ""),
    );

    // ── Blocked Users tab ────────────────────────────────────────────────────
    let unblockPending = $state<string | null>(null);
    let blockedError = $state("");

    const blockedUserIds = $derived(
        [...ignoredUsersState.userIds].sort((a, b) => a.localeCompare(b)),
    );

    async function doUnblock(userId: string) {
        unblockPending = userId;
        blockedError = "";
        try {
            await unblockUser(userId);
        } catch (e: any) {
            blockedError = e?.message ?? "Failed";
        } finally {
            unblockPending = null;
        }
    }

    async function loadProfile() {
        // Seed from the local cache immediately, then refresh from the server.
        profileDisplayName = getOwnDisplayName() ?? "";
        profileAvatarMxc = getOwnAvatarMxc();
        profileLoaded = true;
        try {
            const p = await fetchOwnProfile();
            profileDisplayName = p.displayName ?? "";
            profileAvatarMxc = p.avatarMxc;
        } catch {
            // Keep the cached values if the fetch fails.
        }
    }

    // Load the profile the first time the Account tab is opened.
    $effect(() => {
        if (activeTab === "account" && !profileLoaded) loadProfile();
    });

    // ── Account tab: presence ──────────────────────────────────────────────────
    let presenceError = $state("");
    const selectedPresenceOption = $derived(
        OWN_PRESENCE_OPTIONS.find((o) => o.value === settingsState.ownPresence),
    );

    async function onPresenceChange(e: Event) {
        const value = (e.currentTarget as HTMLSelectElement)
            .value as PresenceState;
        presenceError = "";
        try {
            await changeOwnPresence(value);
        } catch (err) {
            presenceError =
                err instanceof Error ? err.message : "Could not set presence";
        }
    }

    let savedTimeout: ReturnType<typeof setTimeout> | undefined;
    function flashSaved() {
        profileSaved = true;
        clearTimeout(savedTimeout);
        savedTimeout = setTimeout(() => (profileSaved = false), 2000);
    }

    async function onAvatarSelected(e: Event) {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (avatarInputEl) avatarInputEl.value = "";
        if (!file) return;
        avatarUploading = true;
        profileError = "";
        profileSaved = false;
        try {
            const mxc = await uploadContent(file);
            await setOwnAvatarMxc(mxc);
            profileAvatarMxc = mxc;
            flashSaved();
        } catch (err) {
            profileError = (err as Error)?.message ?? "Avatar upload failed";
        } finally {
            avatarUploading = false;
        }
    }

    async function removeAvatar() {
        avatarUploading = true;
        profileError = "";
        profileSaved = false;
        try {
            await setOwnAvatarMxc("");
            profileAvatarMxc = null;
            flashSaved();
        } catch (err) {
            profileError = (err as Error)?.message ?? "Failed to remove avatar";
        } finally {
            avatarUploading = false;
        }
    }

    async function saveDisplayName() {
        savingName = true;
        profileError = "";
        profileSaved = false;
        try {
            await setOwnDisplayName(profileDisplayName.trim());
            flashSaved();
        } catch (err) {
            profileError = (err as Error)?.message ?? "Failed to save name";
        } finally {
            savingName = false;
        }
    }

    // ── Sessions tab: device management ─────────────────────────────────────────
    let devices = $state<DeviceInfo[]>([]);
    let devicesLoaded = $state(false);
    let devicesLoading = $state(false);
    let devicesError = $state("");
    let devicesFetchedAt = $state(0);
    let currentDeviceId = $state<string | null>(null);
    let renamingId = $state<string | null>(null);
    let renameValue = $state("");
    let renameSaving = $state(false);
    let confirmSignOutId = $state<string | null>(null);
    let passwordPromptId = $state<string | null>(null);
    let signOutPassword = $state("");
    let signOutBusy = $state(false);
    let signOutError = $state("");

    const currentDevice = $derived(
        devices.find((d) => d.deviceId === currentDeviceId) ?? null,
    );
    const otherDevices = $derived(
        devices.filter((d) => d.deviceId !== currentDeviceId),
    );

    async function loadDevices() {
        devicesLoading = true;
        devicesError = "";
        try {
            currentDeviceId = getOwnDeviceId();
            devices = sortDevices(await getOwnDevices(), currentDeviceId);
            devicesFetchedAt = Date.now();
            devicesLoaded = true;
        } catch (err) {
            devicesError = (err as Error)?.message ?? "Failed to load sessions";
        } finally {
            devicesLoading = false;
        }
    }

    // Load the device list the first time the Sessions tab is opened.
    $effect(() => {
        if (activeTab === "sessions" && !devicesLoaded && !devicesLoading)
            loadDevices();
    });

    function startRename(device: DeviceInfo) {
        renamingId = device.deviceId;
        renameValue = device.displayName ?? "";
    }

    async function saveRename() {
        if (renamingId === null || renameSaving) return;
        renameSaving = true;
        devicesError = "";
        try {
            await renameDevice(renamingId, renameValue.trim());
            renamingId = null;
            await loadDevices();
        } catch (err) {
            devicesError =
                (err as Error)?.message ?? "Failed to rename session";
        } finally {
            renameSaving = false;
        }
    }

    // First click arms the button ("Sign out?"), the second actually signs
    // the session out — same two-click confirm as leaving a room.
    function requestSignOut(deviceId: string) {
        signOutError = "";
        if (confirmSignOutId !== deviceId) {
            confirmSignOutId = deviceId;
            passwordPromptId = null;
            return;
        }
        void performSignOut(deviceId);
    }

    async function performSignOut(deviceId: string, password?: string) {
        signOutBusy = true;
        signOutError = "";
        try {
            const result = await deleteOwnDevice(deviceId, password);
            if (result === "password-required") {
                // Server wants re-auth: swap the confirm button for an
                // inline password prompt on this row.
                passwordPromptId = deviceId;
                signOutPassword = "";
            } else {
                passwordPromptId = null;
                confirmSignOutId = null;
                signOutPassword = "";
                await loadDevices();
            }
        } catch (err) {
            signOutError =
                (err as Error)?.message ?? "Failed to sign out session";
        } finally {
            signOutBusy = false;
        }
    }

    function cancelSignOut() {
        confirmSignOutId = null;
        passwordPromptId = null;
        signOutPassword = "";
        signOutError = "";
    }

    // ── Debug Info tab ─────────────────────────────────────────────────────────
    let debugLoading = $state(false);
    let debugPushers = $state<RegisteredPusher[] | null>(null);
    let debugPushersError = $state("");
    let gatewayHealth = $state<GatewayHealth | null>(null);
    let nativeSession = $state<NativeSessionState | null>(null);
    let ruleSummary = $state<PushRuleSummary[] | null>(null);
    let webPush = $state<WebPushDebug | null>(null);

    async function runPushDiagnostics() {
        debugLoading = true;
        debugPushersError = "";
        debugPushers = null;
        gatewayHealth = null;
        nativeSession = null;
        webPush = null;
        // Catch-all push-rule levels — synchronous, from the live client state.
        ruleSummary = getPushRuleSummary();

        // Each probe assigns its own result as soon as it resolves, so a slow
        // or hung network probe can't prevent the others (notably the local
        // native-session readback) from rendering.
        const client = getClient();
        const tasks: Promise<void>[] = [];

        tasks.push(
            readWebPushState()
                .then((r) => {
                    webPush = r;
                })
                .catch((e) => {
                    webPush = {
                        supported: true,
                        configured: true,
                        permission: "default",
                        subscribed: false,
                        endpoint: null,
                        error: e?.message ?? String(e),
                    };
                }),
        );

        tasks.push(
            readNativeSession()
                .then((r) => {
                    nativeSession = r;
                })
                .catch((e) => {
                    nativeSession = {
                        native: true,
                        homeserverUrl: null,
                        userId: null,
                        hasToken: false,
                        error: e?.message ?? String(e),
                    };
                }),
        );

        tasks.push(
            checkGatewayHealth()
                .then((r) => {
                    gatewayHealth = r;
                })
                .catch((e) => {
                    gatewayHealth = {
                        reachable: false,
                        status: null,
                        detail: e?.message ?? String(e),
                    };
                }),
        );

        tasks.push(
            (client
                ? fetchRegisteredPushers(client)
                : Promise.resolve([] as RegisteredPusher[])
            )
                .then((r) => {
                    debugPushers = r;
                })
                .catch((e) => {
                    debugPushersError =
                        e?.message ??
                        "Failed to fetch pushers from homeserver.";
                }),
        );

        await Promise.allSettled(tasks);
        debugLoading = false;
    }

    // Whether the homeserver has a pusher pointing at our configured gateway.
    const matchingPusher = $derived(
        debugPushers?.find(
            (p) =>
                p.app_id === PUSH_APP_ID && p.url === PUSH_GATEWAY_NOTIFY_URL,
        ) ?? null,
    );

    // ── About / updates tab ────────────────────────────────────────────────────
    let updateChecking = $state(false);
    let updateInfo = $state<UpdateInfo | null>(null);
    let updateError = $state("");

    async function checkUpdates() {
        updateChecking = true;
        updateError = "";
        updateInfo = null;
        try {
            updateInfo = await checkForUpdate();
        } catch (e: any) {
            updateError = e?.message ?? "Failed to check for updates.";
        } finally {
            updateChecking = false;
        }
    }

    // ── Notifications tab ──────────────────────────────────────────────────────

    function getNotificationPermission():
        | NotificationPermission
        | "unsupported" {
        if (typeof Notification === "undefined") return "unsupported";
        return Notification.permission;
    }

    let notificationPermission = $state(getNotificationPermission());
    let notificationPermissionLoading = $state(false);

    async function handleRequestNotificationPermission() {
        notificationPermissionLoading = true;
        const permission = await requestWebPushPermission().catch(() =>
            getNotificationPermission(),
        );
        notificationPermission = permission;
        if (permission === "granted") {
            const client = getClient();
            if (client) await initWebPush(client).catch(() => {});
        }
        notificationPermission = getNotificationPermission();
        notificationPermissionLoading = false;
    }

    type NotifRoom = { roomId: string; name: string };
    type NotifGroup = { label: string; rooms: NotifRoom[] };

    const notifGroups = $derived.by((): NotifGroup[] => {
        const groups: NotifGroup[] = [];
        const spaces = getSpaces();
        for (const space of spaces) {
            const rooms = getRoomsInSpace(space.roomId).map((r) => ({
                roomId: r.roomId,
                name: getRoomDisplayName(r),
            }));
            if (rooms.length > 0) {
                groups.push({ label: getRoomDisplayName(space), rooms });
            }
        }
        const orphans = getOrphanRooms().map((r) => ({
            roomId: r.roomId,
            name: getRoomDisplayName(r),
        }));
        if (orphans.length > 0)
            groups.push({ label: "Other Rooms", rooms: orphans });
        const dms = getDirectRooms().map((r) => ({
            roomId: r.roomId,
            name: getRoomDisplayName(r),
        }));
        if (dms.length > 0)
            groups.push({ label: "Direct Messages", rooms: dms });
        return groups;
    });

    const NOTIF_OPTIONS: {
        value: RoomNotificationSetting;
        label: string;
        desc: string;
    }[] = [
        {
            value: "default",
            label: "Default",
            desc: "Use global notification settings",
        },
        {
            value: "all",
            label: "All Messages",
            desc: "Notify for every message",
        },
        {
            value: "mentions",
            label: "Mentions Only",
            desc: "Notify for mentions only",
        },
        { value: "mute", label: "Mute", desc: "No notifications" },
    ];

    async function setNotif(roomId: string, setting: RoomNotificationSetting) {
        await setRoomNotificationSetting(roomId, setting);
    }

    let defaultRulesTick = $state(0);

    const ruleLevels = $derived.by(() => {
        void defaultRulesTick;
        return Object.fromEntries(
            DEFAULT_PUSH_RULES.map((r) => [
                r.ruleId,
                getDefaultPushRuleLevel(r.ruleId),
            ]),
        ) as Record<string, PushRuleLevel>;
    });

    async function setRuleLevel(
        ruleId: string,
        kind: import("matrix-js-sdk").PushRuleKind,
        level: PushRuleLevel,
    ) {
        await setDefaultPushRuleLevel(ruleId, kind, level);
        defaultRulesTick++;
    }

    // Global notification sound setting (stored locally)
    let soundEnabled = $state(
        localStorage.getItem("notifSoundEnabled") !== "false",
    );
    function toggleSound() {
        soundEnabled = !soundEnabled;
        localStorage.setItem("notifSoundEnabled", String(soundEnabled));
    }

    // ── User emoji/sticker packs ──────────────────────────────────────────────
    let userEmotes = $state<CustomPackImage[]>([]);
    let userEmoteShortcode = $state("");
    let userEmoteUploading = $state(false);
    let userEmotePending = $state<string | null>(null);
    let userEmoteError = $state("");
    let newUserEmoteAsEmoji = $state(true);
    let newUserEmoteAsSticker = $state(false);

    let userEmojis = $state<CustomEmoji[]>([]);
    let userEmojiShortcode = $state("");
    let userEmojiUploading = $state(false);
    let userEmojiPending = $state<string | null>(null);
    let userEmojiError = $state("");

    let userStickers = $state<CustomSticker[]>([]);
    let userStickerShortcode = $state("");
    let userStickerUploading = $state(false);
    let userStickerPending = $state<string | null>(null);
    let userStickerError = $state("");

    function sortPackItems<T extends { shortcode: string }>(items: T[]): T[] {
        return [...items].sort((a, b) =>
            a.shortcode.localeCompare(b.shortcode),
        );
    }

    function loadUserPacks() {
        userEmotes = sortPackItems(getUserEmotePack());
        userEmojis = sortPackItems(getUserEmojiPack());
        userStickers = sortPackItems(getUserStickerPack());
    }

    $effect(() => {
        const tab = activeTab;
        if (tab === "emotes" || tab === "emojis" || tab === "stickers")
            loadUserPacks();
    });

    function usageFromFlags(emoji: boolean, sticker: boolean): ImageUsage[] {
        return [
            ...(emoji ? (["emoticon"] as ImageUsage[]) : []),
            ...(sticker ? (["sticker"] as ImageUsage[]) : []),
        ];
    }

    function updateUserEmoteLocal(shortcode: string, usage: ImageUsage[]) {
        userEmotes = sortPackItems(
            userEmotes.map((item) =>
                item.shortcode === shortcode
                    ? {
                          ...item,
                          usage,
                          canEmoji: usage.includes("emoticon"),
                          canSticker: usage.includes("sticker"),
                      }
                    : item,
            ),
        );
    }

    async function handleUserEmoteUpload(e: Event) {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        userEmoteError = validateEmojiShortcode(userEmoteShortcode) ?? "";
        const usage = usageFromFlags(
            newUserEmoteAsEmoji,
            newUserEmoteAsSticker,
        );
        if (!userEmoteError && usage.length === 0) {
            userEmoteError = "Choose at least one usage.";
        }
        if (userEmoteError) {
            input.value = "";
            return;
        }

        userEmoteUploading = true;
        try {
            const mxcUrl = await uploadContent(file);
            const shortcode = await addUserEmote(
                userEmoteShortcode,
                mxcUrl,
                usage,
            );
            const url = mxcToHttp(mxcUrl);
            userEmotes = sortPackItems([
                ...userEmotes.filter((item) => item.shortcode !== shortcode),
                {
                    shortcode,
                    mxcUrl,
                    url: url ?? "",
                    usage,
                    canEmoji: usage.includes("emoticon"),
                    canSticker: usage.includes("sticker"),
                },
            ]).filter((item) => item.url);
            userEmoteShortcode = "";
            roomsState.roomsTick++;
        } catch (err: any) {
            userEmoteError = err?.message ?? "Upload failed";
        } finally {
            userEmoteUploading = false;
            input.value = "";
        }
    }

    async function setUserEmoteFlag(
        item: CustomPackImage,
        kind: ImageUsage,
        enabled: boolean,
    ) {
        const usage = usageFromFlags(
            kind === "emoticon" ? enabled : item.canEmoji,
            kind === "sticker" ? enabled : item.canSticker,
        );
        if (usage.length === 0) {
            userEmoteError = "Choose at least one usage.";
            return;
        }
        userEmotePending = `${item.shortcode}:${kind}`;
        userEmoteError = "";
        try {
            await setUserEmoteUsage(item.shortcode, usage);
            updateUserEmoteLocal(item.shortcode, usage);
            roomsState.roomsTick++;
        } catch (err: any) {
            userEmoteError = err?.message ?? "Failed to update usage";
        } finally {
            userEmotePending = null;
        }
    }

    async function doRemoveUserEmote(shortcode: string) {
        userEmotePending = `${shortcode}:remove`;
        userEmoteError = "";
        try {
            await removeUserEmoteImage(shortcode);
            userEmotes = userEmotes.filter(
                (item) => item.shortcode !== shortcode,
            );
            roomsState.roomsTick++;
        } catch (err: any) {
            userEmoteError = err?.message ?? "Failed to remove image";
        } finally {
            userEmotePending = null;
        }
    }

    async function handleUserEmojiUpload(e: Event) {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        userEmojiError = validateEmojiShortcode(userEmojiShortcode) ?? "";
        if (userEmojiError) {
            input.value = "";
            return;
        }

        userEmojiUploading = true;
        try {
            const mxcUrl = await uploadContent(file);
            const shortcode = await addUserEmoji(userEmojiShortcode, mxcUrl);
            const url = mxcToHttp(mxcUrl);
            userEmojis = sortPackItems([
                ...userEmojis.filter((emoji) => emoji.shortcode !== shortcode),
                { shortcode, mxcUrl, url: url ?? "" },
            ]).filter((emoji) => emoji.url);
            userEmojiShortcode = "";
            roomsState.roomsTick++;
        } catch (err: any) {
            userEmojiError = err?.message ?? "Upload failed";
        } finally {
            userEmojiUploading = false;
            input.value = "";
        }
    }

    async function doRemoveUserEmoji(shortcode: string) {
        userEmojiPending = shortcode;
        userEmojiError = "";
        try {
            await removeUserEmoji(shortcode);
            userEmojis = userEmojis.filter(
                (emoji) => emoji.shortcode !== shortcode,
            );
            roomsState.roomsTick++;
        } catch (err: any) {
            userEmojiError = err?.message ?? "Failed to remove emoji";
        } finally {
            userEmojiPending = null;
        }
    }

    async function handleUserStickerUpload(e: Event) {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        userStickerError = validateEmojiShortcode(userStickerShortcode) ?? "";
        if (userStickerError) {
            input.value = "";
            return;
        }

        userStickerUploading = true;
        try {
            const mxcUrl = await uploadContent(file);
            const shortcode = await addUserSticker(
                userStickerShortcode,
                mxcUrl,
            );
            const url = mxcToHttp(mxcUrl);
            userStickers = sortPackItems([
                ...userStickers.filter(
                    (sticker) => sticker.shortcode !== shortcode,
                ),
                { shortcode, mxcUrl, url: url ?? "" },
            ]).filter((sticker) => sticker.url);
            userStickerShortcode = "";
            roomsState.roomsTick++;
        } catch (err: any) {
            userStickerError = err?.message ?? "Upload failed";
        } finally {
            userStickerUploading = false;
            input.value = "";
        }
    }

    async function doRemoveUserSticker(shortcode: string) {
        userStickerPending = shortcode;
        userStickerError = "";
        try {
            await removeUserSticker(shortcode);
            userStickers = userStickers.filter(
                (sticker) => sticker.shortcode !== shortcode,
            );
            roomsState.roomsTick++;
        } catch (err: any) {
            userStickerError = err?.message ?? "Failed to remove sticker";
        } finally {
            userStickerPending = null;
        }
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-0 md:p-4"
    onclick={(e) => {
        if (e.target === e.currentTarget) onClose();
    }}
>
    <div
        class="bg-discord-backgroundSecondary rounded-none md:rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden h-[100dvh] md:h-[85dvh]"
    >
        <!-- Header -->
        <div
            class="flex items-center justify-between px-6 py-4 border-b border-discord-divider flex-shrink-0"
        >
            <h2 class="text-lg font-bold text-discord-textPrimary">Settings</h2>
            <!-- svelte-ignore a11y_consider_explicit_label -->
            <button
                onclick={onClose}
                class="p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
            >
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path
                        d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                    />
                </svg>
            </button>
        </div>

        <div class="flex flex-col md:flex-row flex-1 min-h-0">
            <!-- Tab bar: horizontal scrollable strip on mobile, sidebar on desktop -->
            <nav
                class="flex flex-row md:flex-col flex-shrink-0 w-full md:w-40 gap-1 md:gap-0.5 overflow-x-auto md:overflow-x-visible border-b md:border-b-0 md:border-r border-discord-divider px-2 py-2 md:py-3"
            >
                {#each tabs as tab (tab.id)}
                    <button
                        onclick={() => (activeTab = tab.id)}
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
                <!-- ── Account ───────────────────────────────────────────── -->
                {#if activeTab === "account"}
                    <div class="space-y-6">
                        <!-- Profile -->
                        <div>
                            <p
                                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
                            >
                                Profile
                            </p>
                            <div class="flex items-center gap-4">
                                {#if avatarPreviewUrl}
                                    <img
                                        src={avatarPreviewUrl}
                                        alt="Your avatar"
                                        class="w-20 h-20 rounded-full object-cover flex-shrink-0"
                                    />
                                {:else}
                                    <div
                                        class="w-20 h-20 rounded-full bg-discord-accent/80 text-white flex items-center justify-center text-2xl font-semibold flex-shrink-0"
                                    >
                                        {(
                                            profileDisplayName ||
                                            auth.userId ||
                                            "?"
                                        )
                                            .replace(/^@/, "")
                                            .charAt(0)
                                            .toUpperCase()}
                                    </div>
                                {/if}
                                <div class="flex flex-col gap-2">
                                    <div class="flex gap-2">
                                        <button
                                            onclick={() =>
                                                avatarInputEl?.click()}
                                            disabled={avatarUploading}
                                            class="px-3 py-1.5 bg-discord-accent hover:bg-discord-accent/80 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
                                        >
                                            {avatarUploading
                                                ? "Uploading…"
                                                : "Change avatar"}
                                        </button>
                                        {#if profileAvatarMxc}
                                            <button
                                                onclick={removeAvatar}
                                                disabled={avatarUploading}
                                                class="px-3 py-1.5 bg-discord-backgroundTertiary hover:bg-discord-messageHover text-discord-textPrimary rounded text-sm font-medium transition-colors disabled:opacity-50"
                                            >
                                                Remove
                                            </button>
                                        {/if}
                                    </div>
                                    <p class="text-xs text-discord-textMuted">
                                        JPG, PNG or GIF.
                                    </p>
                                </div>
                                <input
                                    bind:this={avatarInputEl}
                                    type="file"
                                    accept="image/*"
                                    onchange={onAvatarSelected}
                                    class="hidden"
                                />
                            </div>

                            <div class="mt-4">
                                <label
                                    for="profile-display-name"
                                    class="block text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1.5"
                                >
                                    Display name
                                </label>
                                <div class="flex gap-2">
                                    <input
                                        id="profile-display-name"
                                        bind:value={profileDisplayName}
                                        maxlength="255"
                                        placeholder="Your display name"
                                        class="flex-1 bg-discord-backgroundTertiary text-discord-textPrimary placeholder-discord-textMuted text-sm rounded px-3 py-2 outline-none border border-transparent focus:border-discord-accent/50"
                                    />
                                    <button
                                        onclick={saveDisplayName}
                                        disabled={savingName || !nameChanged}
                                        class="px-4 py-2 bg-discord-accent hover:bg-discord-accent/80 text-white rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {savingName ? "Saving…" : "Save"}
                                    </button>
                                </div>
                            </div>

                            {#if profileError}
                                <p class="mt-2 text-xs text-discord-danger">
                                    {profileError}
                                </p>
                            {:else if profileSaved}
                                <p class="mt-2 text-xs text-green-400">Saved</p>
                            {/if}
                        </div>

                        <!-- Account -->
                        <div>
                            <p
                                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
                            >
                                Account
                            </p>
                            <div class="space-y-3 text-sm">
                                <div
                                    class="flex justify-between items-center py-2 border-b border-discord-divider"
                                >
                                    <span
                                        class="text-discord-textMuted font-medium"
                                        >User ID</span
                                    >
                                    <span
                                        class="text-discord-textPrimary font-mono text-xs"
                                        >{auth.userId}</span
                                    >
                                </div>
                                <div
                                    class="flex justify-between items-center py-2 border-b border-discord-divider"
                                >
                                    <span
                                        class="text-discord-textMuted font-medium"
                                        >Homeserver</span
                                    >
                                    <span
                                        class="text-discord-textPrimary text-xs"
                                        >{auth.homeserverUrl}</span
                                    >
                                </div>
                                <div
                                    class="flex justify-between items-center py-2 border-b border-discord-divider"
                                >
                                    <span
                                        class="text-discord-textMuted font-medium"
                                        >Connection</span
                                    >
                                    <span
                                        class="flex items-center gap-2 text-discord-textPrimary text-xs"
                                    >
                                        <span
                                            class="w-2 h-2 rounded-full {syncStatus.tone ===
                                            'ok'
                                                ? 'bg-green-500'
                                                : syncStatus.tone === 'warn'
                                                  ? 'bg-yellow-500'
                                                  : syncStatus.tone === 'error'
                                                    ? 'bg-red-500'
                                                    : 'bg-discord-textMuted'}"
                                        ></span>
                                        {syncStatus.label}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <!-- Presence -->
                        <div>
                            <p
                                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
                            >
                                Presence
                            </p>
                            <div class="flex items-center gap-3">
                                <select
                                    value={settingsState.ownPresence}
                                    onchange={onPresenceChange}
                                    class="bg-discord-backgroundTertiary text-discord-textPrimary text-sm rounded px-3 py-2 outline-none border border-transparent focus:border-discord-accent/50"
                                >
                                    {#each OWN_PRESENCE_OPTIONS as option (option.value)}
                                        <option value={option.value}
                                            >{option.label}</option
                                        >
                                    {/each}
                                </select>
                                <p class="text-xs text-discord-textMuted">
                                    {selectedPresenceOption?.description}
                                </p>
                            </div>
                            {#if presenceError}
                                <p class="mt-2 text-xs text-discord-danger">
                                    {presenceError}
                                </p>
                            {/if}
                        </div>

                        <div class="pt-2">
                            <button
                                onclick={onLogout}
                                class="px-4 py-2 bg-discord-danger hover:bg-discord-danger/80 text-white rounded font-medium text-sm transition-colors"
                                >Log Out</button
                            >
                        </div>
                    </div>

                    <!-- ── Sessions ────────────────────────────────────────── -->
                {:else if activeTab === "sessions"}
                    <div class="space-y-6">
                        {#snippet deviceRow(
                            device: DeviceInfo,
                            isCurrent: boolean,
                        )}
                            {@const lastSeenLine = [
                                describeUserAgent(device.lastSeenUserAgent),
                                `Last seen ${formatLastSeen(
                                    device.lastSeenTs,
                                    devicesFetchedAt,
                                )}`,
                                device.lastSeenIp,
                            ]
                                .filter(Boolean)
                                .join(" · ")}
                            <div
                                class="rounded bg-discord-backgroundTertiary px-4 py-3"
                            >
                                <div
                                    class="flex items-start justify-between gap-3"
                                >
                                    <div class="min-w-0">
                                        {#if renamingId === device.deviceId}
                                            <div class="flex gap-2">
                                                <input
                                                    bind:value={renameValue}
                                                    maxlength="100"
                                                    placeholder="Session name"
                                                    onkeydown={(e) =>
                                                        e.key === "Enter" &&
                                                        saveRename()}
                                                    class="flex-1 bg-discord-backgroundDark text-discord-textPrimary placeholder-discord-textMuted text-sm rounded px-2 py-1 outline-none border border-transparent focus:border-discord-accent/50"
                                                />
                                                <button
                                                    onclick={saveRename}
                                                    disabled={renameSaving}
                                                    class="px-2.5 py-1 bg-discord-accent hover:bg-discord-accent/80 text-white rounded text-xs font-medium transition-colors disabled:opacity-50"
                                                >
                                                    {renameSaving
                                                        ? "Saving…"
                                                        : "Save"}
                                                </button>
                                                <button
                                                    onclick={() =>
                                                        (renamingId = null)}
                                                    class="px-2.5 py-1 bg-discord-messageHover text-discord-textPrimary rounded text-xs font-medium transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        {:else}
                                            <p
                                                class="text-sm font-medium text-discord-textPrimary truncate"
                                            >
                                                {device.displayName ||
                                                    device.deviceId}
                                                {#if isCurrent}
                                                    <span
                                                        class="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-discord-accent/20 text-discord-accent align-middle"
                                                        >Current</span
                                                    >
                                                {/if}
                                            </p>
                                        {/if}
                                        <p
                                            class="text-xs text-discord-textMuted font-mono mt-0.5"
                                        >
                                            {device.deviceId}
                                        </p>
                                        <p
                                            class="text-xs text-discord-textMuted mt-1"
                                        >
                                            {lastSeenLine}
                                        </p>
                                    </div>
                                    <div class="flex gap-2 flex-shrink-0">
                                        {#if renamingId !== device.deviceId}
                                            <button
                                                onclick={() =>
                                                    startRename(device)}
                                                class="px-2.5 py-1 bg-discord-messageHover hover:bg-discord-messageHover/70 text-discord-textPrimary rounded text-xs font-medium transition-colors"
                                            >
                                                Rename
                                            </button>
                                        {/if}
                                        {#if !isCurrent && passwordPromptId !== device.deviceId}
                                            <button
                                                onclick={() =>
                                                    requestSignOut(
                                                        device.deviceId,
                                                    )}
                                                disabled={signOutBusy}
                                                class="px-2.5 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50 {confirmSignOutId ===
                                                device.deviceId
                                                    ? 'bg-discord-danger hover:bg-discord-danger/80 text-white'
                                                    : 'bg-discord-messageHover hover:bg-discord-danger/20 text-discord-danger'}"
                                            >
                                                {confirmSignOutId ===
                                                device.deviceId
                                                    ? "Sign out?"
                                                    : "Sign out"}
                                            </button>
                                        {/if}
                                    </div>
                                </div>

                                {#if passwordPromptId === device.deviceId}
                                    <div
                                        class="mt-3 pt-3 border-t border-discord-divider"
                                    >
                                        <p
                                            class="text-xs text-discord-textMuted mb-2"
                                        >
                                            Confirm your account password to
                                            sign out this session.
                                        </p>
                                        <div class="flex gap-2">
                                            <input
                                                type="password"
                                                bind:value={signOutPassword}
                                                placeholder="Account password"
                                                onkeydown={(e) =>
                                                    e.key === "Enter" &&
                                                    signOutPassword &&
                                                    performSignOut(
                                                        device.deviceId,
                                                        signOutPassword,
                                                    )}
                                                class="flex-1 bg-discord-backgroundDark text-discord-textPrimary placeholder-discord-textMuted text-sm rounded px-3 py-1.5 outline-none border border-transparent focus:border-discord-accent/50"
                                            />
                                            <button
                                                onclick={() =>
                                                    performSignOut(
                                                        device.deviceId,
                                                        signOutPassword,
                                                    )}
                                                disabled={signOutBusy ||
                                                    !signOutPassword}
                                                class="px-3 py-1.5 bg-discord-danger hover:bg-discord-danger/80 text-white rounded text-xs font-medium transition-colors disabled:opacity-50"
                                            >
                                                {signOutBusy
                                                    ? "Signing out…"
                                                    : "Sign out"}
                                            </button>
                                            <button
                                                onclick={cancelSignOut}
                                                class="px-3 py-1.5 bg-discord-messageHover text-discord-textPrimary rounded text-xs font-medium transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                {/if}

                                {#if signOutError && (confirmSignOutId === device.deviceId || passwordPromptId === device.deviceId)}
                                    <p class="mt-2 text-xs text-discord-danger">
                                        {signOutError}
                                    </p>
                                {/if}
                            </div>
                        {/snippet}

                        <div>
                            <div class="flex items-center justify-between mb-3">
                                <p
                                    class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
                                >
                                    This device
                                </p>
                                <button
                                    onclick={loadDevices}
                                    disabled={devicesLoading}
                                    class="text-xs text-discord-textMuted hover:text-discord-textPrimary transition-colors disabled:opacity-50"
                                >
                                    {devicesLoading ? "Refreshing…" : "Refresh"}
                                </button>
                            </div>
                            {#if devicesError}
                                <p class="text-xs text-discord-danger mb-3">
                                    {devicesError}
                                </p>
                            {/if}
                            {#if currentDevice}
                                {@render deviceRow(currentDevice, true)}
                            {:else if devicesLoading}
                                <p class="text-sm text-discord-textMuted">
                                    Loading sessions…
                                </p>
                            {/if}
                        </div>

                        <div>
                            <p
                                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1"
                            >
                                Other sessions {devicesLoaded
                                    ? `(${otherDevices.length})`
                                    : ""}
                            </p>
                            <p class="text-xs text-discord-textMuted mb-3">
                                Sign out any session you don't recognize — and
                                consider changing your password if you find one.
                            </p>
                            {#if devicesLoaded && otherDevices.length === 0}
                                <p class="text-sm text-discord-textMuted">
                                    No other sessions — you're only signed in
                                    here.
                                </p>
                            {:else}
                                <div class="space-y-2">
                                    {#each otherDevices as device (device.deviceId)}
                                        {@render deviceRow(device, false)}
                                    {/each}
                                </div>
                            {/if}
                        </div>
                    </div>

                    <!-- ── Behavior ────────────────────────────────────────── -->
                {:else if activeTab === "behavior"}
                    <div class="space-y-6">
                        <div>
                            <p
                                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
                            >
                                Navigation
                            </p>
                            <div
                                class="flex items-center gap-3 py-2 border-b border-discord-divider"
                            >
                                <div class="flex-1 min-w-0">
                                    <p class="text-sm text-discord-textPrimary">
                                        Keep room list open
                                    </p>
                                    <p class="text-xs text-discord-textMuted">
                                        Don't auto-close the room list when
                                        switching between spaces or Home.
                                        Opening a room or DM always closes it
                                        (applies to the drawer on small
                                        screens).
                                    </p>
                                </div>
                                <button
                                    onclick={() =>
                                        setKeepSidebarOpen(
                                            !settingsState.keepSidebarOpen,
                                        )}
                                    class="relative flex-shrink-0 w-10 h-5 rounded-full transition-colors"
                                    class:bg-discord-accent={settingsState.keepSidebarOpen}
                                    class:bg-discord-backgroundTertiary={!settingsState.keepSidebarOpen}
                                    title={settingsState.keepSidebarOpen
                                        ? "Auto-close the room list"
                                        : "Keep the room list open"}
                                >
                                    <span
                                        class="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                                        class:-translate-x-4={!settingsState.keepSidebarOpen}
                                    ></span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- ── My Emotes ───────────────────────────────────────── -->
                {:else if activeTab === "emotes"}
                    <div class="space-y-4">
                        <div class="space-y-2">
                            <label
                                class="block text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
                                for="user-emote-shortcode"
                            >
                                Add Image
                            </label>
                            <div
                                class="grid gap-2 sm:grid-cols-[1fr_auto_auto]"
                            >
                                <div
                                    class="flex items-center bg-discord-backgroundTertiary rounded border border-transparent focus-within:border-discord-accent/50"
                                >
                                    <span
                                        class="pl-3 text-sm text-discord-textMuted"
                                        >:</span
                                    >
                                    <input
                                        id="user-emote-shortcode"
                                        bind:value={userEmoteShortcode}
                                        disabled={userEmoteUploading}
                                        placeholder="shortcode"
                                        class="min-w-0 flex-1 bg-transparent text-discord-textPrimary placeholder-discord-textMuted text-sm py-2 outline-none disabled:opacity-50"
                                    />
                                    <span
                                        class="pr-3 text-sm text-discord-textMuted"
                                        >:</span
                                    >
                                </div>
                                <div
                                    class="flex items-center gap-3 px-3 py-2 rounded bg-discord-backgroundTertiary"
                                >
                                    <label
                                        class="flex items-center gap-1.5 text-xs text-discord-textPrimary"
                                    >
                                        <input
                                            type="checkbox"
                                            bind:checked={newUserEmoteAsEmoji}
                                            disabled={userEmoteUploading}
                                            class="accent-discord-accent"
                                        />
                                        Emoji
                                    </label>
                                    <label
                                        class="flex items-center gap-1.5 text-xs text-discord-textPrimary"
                                    >
                                        <input
                                            type="checkbox"
                                            bind:checked={newUserEmoteAsSticker}
                                            disabled={userEmoteUploading}
                                            class="accent-discord-accent"
                                        />
                                        Sticker
                                    </label>
                                </div>
                                <label
                                    class="shrink-0 cursor-pointer px-3 py-2 rounded bg-discord-accent hover:bg-discord-accentHover text-white text-sm font-semibold transition-colors text-center {userEmoteUploading
                                        ? 'opacity-50 pointer-events-none'
                                        : ''}"
                                >
                                    {userEmoteUploading
                                        ? "Uploading…"
                                        : "Upload Image"}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        class="hidden"
                                        onchange={handleUserEmoteUpload}
                                        disabled={userEmoteUploading}
                                    />
                                </label>
                            </div>
                        </div>

                        {#if userEmoteError}<p
                                class="text-sm text-discord-danger"
                            >
                                {userEmoteError}
                            </p>{/if}

                        <div class="space-y-1.5">
                            {#each userEmotes as item (item.shortcode)}
                                <div
                                    class="flex items-center gap-3 p-2 rounded bg-discord-backgroundTertiary"
                                >
                                    <div
                                        class="w-12 h-12 rounded bg-discord-backgroundSecondary flex-shrink-0 overflow-hidden flex items-center justify-center"
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
                                    <div class="flex items-center gap-3">
                                        <label
                                            class="flex items-center gap-1.5 text-xs text-discord-textPrimary"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={item.canEmoji}
                                                onchange={(e) =>
                                                    setUserEmoteFlag(
                                                        item,
                                                        "emoticon",
                                                        (
                                                            e.target as HTMLInputElement
                                                        ).checked,
                                                    )}
                                                disabled={userEmotePending ===
                                                    `${item.shortcode}:emoticon`}
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
                                                    setUserEmoteFlag(
                                                        item,
                                                        "sticker",
                                                        (
                                                            e.target as HTMLInputElement
                                                        ).checked,
                                                    )}
                                                disabled={userEmotePending ===
                                                    `${item.shortcode}:sticker`}
                                                class="accent-discord-accent"
                                            />
                                            Sticker
                                        </label>
                                    </div>
                                    <button
                                        onclick={() =>
                                            doRemoveUserEmote(item.shortcode)}
                                        disabled={userEmotePending ===
                                            `${item.shortcode}:remove`}
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
                                </div>
                            {/each}
                            {#if userEmotes.length === 0}<p
                                    class="text-sm text-discord-textMuted text-center py-4"
                                >
                                    No custom images
                                </p>{/if}
                        </div>
                    </div>

                    <!-- ── My Emojis ───────────────────────────────────────── -->
                {:else if activeTab === "emojis"}
                    <div class="space-y-4">
                        <div class="space-y-2">
                            <label
                                class="block text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
                                for="user-emoji-shortcode"
                            >
                                Add Emoji
                            </label>
                            <div class="grid gap-2 sm:grid-cols-[1fr_auto]">
                                <div
                                    class="flex items-center bg-discord-backgroundTertiary rounded border border-transparent focus-within:border-discord-accent/50"
                                >
                                    <span
                                        class="pl-3 text-sm text-discord-textMuted"
                                        >:</span
                                    >
                                    <input
                                        id="user-emoji-shortcode"
                                        bind:value={userEmojiShortcode}
                                        disabled={userEmojiUploading}
                                        placeholder="shortcode"
                                        class="min-w-0 flex-1 bg-transparent text-discord-textPrimary placeholder-discord-textMuted text-sm py-2 outline-none disabled:opacity-50"
                                    />
                                    <span
                                        class="pr-3 text-sm text-discord-textMuted"
                                        >:</span
                                    >
                                </div>
                                <label
                                    class="shrink-0 cursor-pointer px-3 py-2 rounded bg-discord-accent hover:bg-discord-accentHover text-white text-sm font-semibold transition-colors text-center {userEmojiUploading
                                        ? 'opacity-50 pointer-events-none'
                                        : ''}"
                                >
                                    {userEmojiUploading
                                        ? "Uploading…"
                                        : "Upload Image"}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        class="hidden"
                                        onchange={handleUserEmojiUpload}
                                        disabled={userEmojiUploading}
                                    />
                                </label>
                            </div>
                        </div>

                        {#if userEmojiError}<p
                                class="text-sm text-discord-danger"
                            >
                                {userEmojiError}
                            </p>{/if}

                        <div class="space-y-1.5">
                            {#each userEmojis as emoji (emoji.shortcode)}
                                <div
                                    class="flex items-center gap-3 p-2 rounded bg-discord-backgroundTertiary"
                                >
                                    <div
                                        class="w-9 h-9 rounded bg-discord-backgroundSecondary flex-shrink-0 overflow-hidden flex items-center justify-center"
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
                                    <button
                                        onclick={() =>
                                            doRemoveUserEmoji(emoji.shortcode)}
                                        disabled={userEmojiPending ===
                                            emoji.shortcode}
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
                                </div>
                            {/each}
                            {#if userEmojis.length === 0}<p
                                    class="text-sm text-discord-textMuted text-center py-4"
                                >
                                    No custom emojis
                                </p>{/if}
                        </div>
                    </div>

                    <!-- ── My Stickers ─────────────────────────────────────── -->
                {:else if activeTab === "stickers"}
                    <div class="space-y-4">
                        <div class="space-y-2">
                            <label
                                class="block text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
                                for="user-sticker-shortcode"
                            >
                                Add Sticker
                            </label>
                            <div class="grid gap-2 sm:grid-cols-[1fr_auto]">
                                <div
                                    class="flex items-center bg-discord-backgroundTertiary rounded border border-transparent focus-within:border-discord-accent/50"
                                >
                                    <span
                                        class="pl-3 text-sm text-discord-textMuted"
                                        >:</span
                                    >
                                    <input
                                        id="user-sticker-shortcode"
                                        bind:value={userStickerShortcode}
                                        disabled={userStickerUploading}
                                        placeholder="shortcode"
                                        class="min-w-0 flex-1 bg-transparent text-discord-textPrimary placeholder-discord-textMuted text-sm py-2 outline-none disabled:opacity-50"
                                    />
                                    <span
                                        class="pr-3 text-sm text-discord-textMuted"
                                        >:</span
                                    >
                                </div>
                                <label
                                    class="shrink-0 cursor-pointer px-3 py-2 rounded bg-discord-accent hover:bg-discord-accentHover text-white text-sm font-semibold transition-colors text-center {userStickerUploading
                                        ? 'opacity-50 pointer-events-none'
                                        : ''}"
                                >
                                    {userStickerUploading
                                        ? "Uploading…"
                                        : "Upload Image"}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        class="hidden"
                                        onchange={handleUserStickerUpload}
                                        disabled={userStickerUploading}
                                    />
                                </label>
                            </div>
                        </div>

                        {#if userStickerError}<p
                                class="text-sm text-discord-danger"
                            >
                                {userStickerError}
                            </p>{/if}

                        <div class="space-y-1.5">
                            {#each userStickers as sticker (sticker.shortcode)}
                                <div
                                    class="flex items-center gap-3 p-2 rounded bg-discord-backgroundTertiary"
                                >
                                    <div
                                        class="w-12 h-12 rounded bg-discord-backgroundSecondary flex-shrink-0 overflow-hidden flex items-center justify-center"
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
                                    <button
                                        onclick={() =>
                                            doRemoveUserSticker(
                                                sticker.shortcode,
                                            )}
                                        disabled={userStickerPending ===
                                            sticker.shortcode}
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
                                </div>
                            {/each}
                            {#if userStickers.length === 0}<p
                                    class="text-sm text-discord-textMuted text-center py-4"
                                >
                                    No custom stickers
                                </p>{/if}
                        </div>
                    </div>

                    <!-- ── Notifications ─────────────────────────────────────── -->
                {:else if activeTab === "notifications"}
                    <div class="space-y-6">
                        {#if notificationPermission !== "granted"}
                            <div>
                                <p
                                    class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
                                >
                                    System Permission
                                </p>
                                <div
                                    class="flex items-center gap-3 py-2 border-b border-discord-divider"
                                >
                                    <div class="flex-1 min-w-0">
                                        <p
                                            class="text-sm text-discord-textPrimary"
                                        >
                                            Push notifications
                                        </p>
                                        <p
                                            class="text-xs text-discord-textMuted"
                                        >
                                            {#if notificationPermission === "denied"}
                                                Permission is blocked in system
                                                settings
                                            {:else if notificationPermission === "unsupported"}
                                                Notifications are not supported
                                                here
                                            {:else}
                                                Allow this app to send
                                                notifications
                                            {/if}
                                        </p>
                                    </div>
                                    <button
                                        onclick={handleRequestNotificationPermission}
                                        disabled={notificationPermissionLoading ||
                                            notificationPermission ===
                                                "denied" ||
                                            notificationPermission ===
                                                "unsupported"}
                                        class="px-3 py-1.5 rounded text-sm font-semibold bg-discord-accent hover:bg-discord-accentHover text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-discord-accent flex items-center gap-2 flex-shrink-0"
                                    >
                                        {#if notificationPermissionLoading}
                                            <span
                                                class="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"
                                            ></span>
                                            Requesting…
                                        {:else if notificationPermission === "denied"}
                                            Blocked
                                        {:else if notificationPermission === "unsupported"}
                                            Unavailable
                                        {:else}
                                            Enable
                                        {/if}
                                    </button>
                                </div>
                            </div>
                        {/if}

                        <!-- Global sound toggle -->
                        <div>
                            <p
                                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
                            >
                                Sound
                            </p>
                            <div
                                class="flex items-center gap-3 py-2 border-b border-discord-divider"
                            >
                                <div class="flex-1 min-w-0">
                                    <p class="text-sm text-discord-textPrimary">
                                        Notification sound
                                    </p>
                                    <p class="text-xs text-discord-textMuted">
                                        Play a sound for loud notifications
                                    </p>
                                </div>
                                <button
                                    onclick={toggleSound}
                                    class="relative flex-shrink-0 w-10 h-5 rounded-full transition-colors"
                                    class:bg-discord-accent={soundEnabled}
                                    class:bg-discord-backgroundTertiary={!soundEnabled}
                                    title={soundEnabled
                                        ? "Disable sound"
                                        : "Enable sound"}
                                >
                                    <span
                                        class="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                                        class:-translate-x-4={!soundEnabled}
                                    ></span>
                                </button>
                            </div>
                        </div>

                        <!-- Read-receipt privacy -->
                        <div>
                            <p
                                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
                            >
                                Privacy
                            </p>
                            <div
                                class="flex items-center gap-3 py-2 border-b border-discord-divider"
                            >
                                <div class="flex-1 min-w-0">
                                    <p class="text-sm text-discord-textPrimary">
                                        Private read receipts
                                    </p>
                                    <p class="text-xs text-discord-textMuted">
                                        Hide your read receipts from other
                                        users. Your unread counts still work;
                                        others just can't see how far you've
                                        read.
                                    </p>
                                </div>
                                <button
                                    onclick={() =>
                                        setPrivateReadReceipts(
                                            !settingsState.privateReadReceipts,
                                        )}
                                    class="relative flex-shrink-0 w-10 h-5 rounded-full transition-colors"
                                    class:bg-discord-accent={settingsState.privateReadReceipts}
                                    class:bg-discord-backgroundTertiary={!settingsState.privateReadReceipts}
                                    title={settingsState.privateReadReceipts
                                        ? "Send public read receipts"
                                        : "Send private read receipts"}
                                >
                                    <span
                                        class="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                                        class:-translate-x-4={!settingsState.privateReadReceipts}
                                    ></span>
                                </button>
                            </div>
                        </div>

                        <!-- Default push rules -->
                        <div>
                            <p
                                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1"
                            >
                                Notification Rules
                            </p>
                            <p class="text-xs text-discord-textMuted mb-3">
                                Loud = notify with sound &nbsp;·&nbsp; Silent =
                                notify without sound &nbsp;·&nbsp; Off = no
                                notification
                            </p>
                            <div class="space-y-1">
                                {#each DEFAULT_PUSH_RULES as rule}
                                    <div
                                        class="flex items-center gap-3 py-2 border-b border-discord-divider"
                                    >
                                        <div class="flex-1 min-w-0">
                                            <p
                                                class="text-sm text-discord-textPrimary"
                                            >
                                                {rule.label}
                                            </p>
                                            <p
                                                class="text-xs text-discord-textMuted"
                                            >
                                                {rule.description}
                                            </p>
                                        </div>
                                        <div class="flex gap-1 flex-shrink-0">
                                            {#each ["loud", "silent", "off"] as PushRuleLevel[] as lvl}
                                                <button
                                                    onclick={() =>
                                                        setRuleLevel(
                                                            rule.ruleId,
                                                            rule.kind,
                                                            lvl,
                                                        )}
                                                    class="px-2 py-1 rounded text-xs font-medium transition-colors capitalize"
                                                    class:bg-discord-accent={ruleLevels[
                                                        rule.ruleId
                                                    ] === lvl}
                                                    class:text-white={ruleLevels[
                                                        rule.ruleId
                                                    ] === lvl}
                                                    class:bg-discord-backgroundTertiary={ruleLevels[
                                                        rule.ruleId
                                                    ] !== lvl}
                                                    class:text-discord-textMuted={ruleLevels[
                                                        rule.ruleId
                                                    ] !== lvl}>{lvl}</button
                                                >
                                            {/each}
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        </div>

                        <!-- Per-room overrides -->
                        {#if notifGroups.length > 0}
                            <p
                                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide -mb-2"
                            >
                                Per-room Overrides
                            </p>
                        {/if}
                        {#each notifGroups as group}
                            <div>
                                <p
                                    class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
                                >
                                    {group.label}
                                </p>
                                <div class="space-y-1">
                                    {#each group.rooms as room}
                                        {@const current =
                                            getRoomNotificationSetting(
                                                room.roomId,
                                            )}
                                        <div
                                            class="flex items-center gap-3 py-2 border-b border-discord-divider"
                                        >
                                            <span
                                                class="flex-1 text-sm text-discord-textPrimary truncate"
                                                >{room.name}</span
                                            >
                                            <div
                                                class="flex gap-1 flex-shrink-0"
                                            >
                                                {#each NOTIF_OPTIONS as opt}
                                                    <button
                                                        onclick={() =>
                                                            setNotif(
                                                                room.roomId,
                                                                opt.value,
                                                            )}
                                                        title={opt.desc}
                                                        class="px-2.5 py-1 rounded text-xs font-medium transition-colors"
                                                        class:bg-discord-accent={current ===
                                                            opt.value}
                                                        class:text-white={current ===
                                                            opt.value}
                                                        class:bg-discord-backgroundTertiary={current !==
                                                            opt.value}
                                                        class:text-discord-textMuted={current !==
                                                            opt.value}
                                                        class:hover:bg-discord-messageHover={current !==
                                                            opt.value}
                                                        >{opt.label}</button
                                                    >
                                                {/each}
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {/each}
                        {#if notifGroups.length === 0}
                            <p class="text-sm text-discord-textMuted italic">
                                No rooms found.
                            </p>
                        {/if}
                    </div>

                    <!-- ── Server ─────────────────────────────────────────────── -->
                {:else if activeTab === "server"}
                    <div class="space-y-6">
                        {#if serverLoading && !serverLoaded}
                            <p class="text-sm text-discord-textMuted">
                                Scanning server…
                            </p>
                        {:else if serverError}
                            <p class="text-sm text-discord-danger">
                                {serverError}
                            </p>
                        {:else}
                            <p class="text-xs text-discord-textMuted">
                                What <span class="text-discord-textSecondary"
                                    >{auth.homeserverUrl}</span
                                > advertises. Items marked “Unknown” aren’t advertised
                                by the server and are detected only when used.
                            </p>

                            <!-- Account & messaging (gated by server capabilities) -->
                            <div>
                                <p
                                    class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
                                >
                                    Account &amp; messaging
                                </p>
                                <div class="space-y-0 text-sm">
                                    {#each clientFeatureRows as row}
                                        {@const b = supportBadge(row.support)}
                                        <div
                                            class="flex justify-between items-center py-2 border-b border-discord-divider"
                                        >
                                            <span
                                                class="text-discord-textSecondary"
                                                >{row.label}</span
                                            >
                                            <span class="text-xs {b.cls}"
                                                >{b.text}</span
                                            >
                                        </div>
                                    {/each}
                                </div>
                            </div>

                            <!-- Not implemented in this client yet -->
                            <div>
                                <p
                                    class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1"
                                >
                                    Not in this client yet
                                </p>
                                <p class="text-xs text-discord-textMuted mb-3">
                                    Server-side availability shown; the client
                                    doesn’t implement these.
                                </p>
                                <div class="space-y-0 text-sm">
                                    <div
                                        class="flex justify-between items-center py-2 border-b border-discord-divider"
                                    >
                                        <span class="text-discord-textSecondary"
                                            >Voice / video calling (TURN)</span
                                        >
                                        <span
                                            class="text-xs {supportBadge(
                                                callingSupport,
                                            ).cls}"
                                            >{supportBadge(callingSupport)
                                                .text}</span
                                        >
                                    </div>
                                </div>
                            </div>

                            <!-- Server / spec -->
                            <div>
                                <p
                                    class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
                                >
                                    Server
                                </p>
                                <div class="space-y-0 text-sm">
                                    <div
                                        class="flex justify-between items-center py-2 border-b border-discord-divider"
                                    >
                                        <span class="text-discord-textMuted"
                                            >Latest spec version</span
                                        >
                                        <span
                                            class="text-discord-textPrimary text-xs font-mono"
                                            >{specVersions[
                                                specVersions.length - 1
                                            ] ?? "—"}</span
                                        >
                                    </div>
                                    {#if roomVersion}
                                        <div
                                            class="flex justify-between items-center py-2 border-b border-discord-divider"
                                        >
                                            <span class="text-discord-textMuted"
                                                >Default room version</span
                                            >
                                            <span
                                                class="text-discord-textPrimary text-xs font-mono"
                                                >{roomVersion}</span
                                            >
                                        </div>
                                    {/if}
                                </div>
                            </div>

                            <!-- Advertised (unstable) features -->
                            {#if unstableLabels.length > 0}
                                <div>
                                    <p
                                        class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
                                    >
                                        Advertised features ({unstableLabels.length})
                                    </p>
                                    <div class="flex flex-wrap gap-1.5">
                                        {#each unstableLabels as f}
                                            <span
                                                class="px-2 py-0.5 rounded text-xs bg-discord-backgroundTertiary text-discord-textSecondary border border-discord-divider"
                                                >{f}</span
                                            >
                                        {/each}
                                    </div>
                                </div>
                            {/if}
                        {/if}
                    </div>

                    <!-- ── Blocked Users ──────────────────────────────────────── -->
                {:else if activeTab === "blocked"}
                    <div class="space-y-4">
                        <p class="text-xs text-discord-textMuted">
                            Messages from blocked users are hidden in every
                            room. The list is stored on your account and applies
                            to all your sessions.
                        </p>

                        {#if blockedError}
                            <p class="text-sm text-discord-danger">
                                {blockedError}
                            </p>
                        {/if}

                        {#if blockedUserIds.length === 0}
                            <p
                                class="text-sm text-discord-textMuted text-center py-8"
                            >
                                You haven't blocked anyone.
                            </p>
                        {:else}
                            <div class="space-y-1">
                                {#each blockedUserIds as userId (userId)}
                                    <div
                                        class="flex items-center gap-3 p-2 rounded bg-discord-backgroundTertiary"
                                    >
                                        <Avatar
                                            src={null}
                                            name={userId.replace(/^@/, "")}
                                            id={userId}
                                            size={28}
                                        />
                                        <p
                                            class="flex-1 min-w-0 text-sm text-discord-textPrimary font-mono truncate"
                                        >
                                            {userId}
                                        </p>
                                        <button
                                            onclick={() => doUnblock(userId)}
                                            disabled={unblockPending === userId}
                                            class="px-2.5 py-1 rounded text-xs font-semibold bg-discord-backgroundSecondary hover:bg-discord-messageHover text-discord-textPrimary transition-colors disabled:opacity-50"
                                            >Unblock</button
                                        >
                                    </div>
                                {/each}
                            </div>
                        {/if}
                    </div>

                    <!-- ── About ──────────────────────────────────────────────── -->
                {:else if activeTab === "about"}
                    <div class="space-y-6">
                        <div>
                            <p
                                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
                            >
                                Version
                            </p>
                            <div
                                class="flex items-center gap-3 py-2 border-b border-discord-divider"
                            >
                                <div class="flex-1 min-w-0">
                                    <p class="text-sm text-discord-textPrimary">
                                        Matrix Client
                                    </p>
                                    <p class="text-xs text-discord-textMuted">
                                        Current version v{APP_VERSION}
                                    </p>
                                </div>
                                <button
                                    onclick={checkUpdates}
                                    disabled={updateChecking}
                                    class="px-3 py-1.5 rounded text-sm font-medium bg-discord-backgroundTertiary hover:bg-discord-messageHover text-discord-textPrimary transition-colors disabled:opacity-50 flex items-center gap-2 flex-shrink-0"
                                >
                                    {#if updateChecking}
                                        <span
                                            class="w-3.5 h-3.5 border-2 border-discord-textMuted border-t-transparent rounded-full animate-spin"
                                        ></span>
                                        Checking…
                                    {:else}
                                        Check for updates
                                    {/if}
                                </button>
                            </div>
                        </div>

                        {#if updateError}
                            <p class="text-sm text-discord-textMuted">
                                {updateError}
                            </p>
                        {:else if updateInfo}
                            {@const info = updateInfo}
                            {#if info.updateAvailable}
                                <div
                                    class="rounded-lg border border-discord-accent bg-discord-accent/10 p-4 flex items-center gap-4"
                                >
                                    <div class="flex-1 min-w-0">
                                        <p
                                            class="text-sm font-semibold text-discord-textPrimary"
                                        >
                                            Update available
                                        </p>
                                        <p
                                            class="text-xs text-discord-textMuted"
                                        >
                                            v{info.current} → v{info.latest}
                                        </p>
                                    </div>
                                    <button
                                        onclick={() =>
                                            openReleasePage(info.url)}
                                        disabled={!CAN_INSTALL_UPDATE}
                                        title={CAN_INSTALL_UPDATE
                                            ? ""
                                            : "Reload the page to get the latest web version"}
                                        class="px-4 py-2 rounded text-sm font-semibold bg-discord-accent hover:bg-discord-accentHover text-white transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-discord-accent"
                                        >Update</button
                                    >
                                </div>
                            {:else}
                                <p class="text-sm text-discord-textMuted">
                                    You’re on the latest version.
                                </p>
                            {/if}
                        {/if}
                    </div>

                    <!-- ── Debug Info ─────────────────────────────────────────── -->
                {:else if activeTab === "debug"}
                    {@const rows = [
                        [
                            "Platform",
                            pushDebug.native
                                ? "Native (Capacitor)"
                                : "Web/Desktop",
                        ],
                        [
                            "Push enabled in build",
                            pushDebug.pushEnabled ? "Yes" : "No",
                        ],
                        ["Gateway URL", PUSH_GATEWAY_NOTIFY_URL],
                        ["App ID", PUSH_APP_ID],
                        ["Notification permission", pushDebug.permission],
                        [
                            "FCM token",
                            pushDebug.fcmToken
                                ? pushDebug.fcmToken.slice(0, 12) +
                                  "…" +
                                  pushDebug.fcmToken.slice(-6)
                                : "(none)",
                        ],
                        [
                            "Pusher registered this session",
                            pushDebug.pusherRegistered ? "Yes" : "No",
                        ],
                    ] as [string, string][]}
                    <div class="space-y-6">
                        <!-- Local-only debug toggles (never synced to the homeserver) -->
                        <div>
                            <p
                                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
                            >
                                Developer
                            </p>
                            <div
                                class="flex items-center gap-3 py-2 border-b border-discord-divider"
                            >
                                <div class="flex-1 min-w-0">
                                    <p class="text-sm text-discord-textPrimary">
                                        Show all events
                                    </p>
                                    <p class="text-xs text-discord-textMuted">
                                        Display every Matrix timeline event
                                        (state changes, edits, redactions,
                                        reactions…) in the chat log. Stored
                                        locally only.
                                    </p>
                                </div>
                                <button
                                    onclick={() =>
                                        setShowAllEvents(
                                            !settingsState.showAllEvents,
                                        )}
                                    class="relative flex-shrink-0 w-10 h-5 rounded-full transition-colors"
                                    class:bg-discord-accent={settingsState.showAllEvents}
                                    class:bg-discord-backgroundTertiary={!settingsState.showAllEvents}
                                    title={settingsState.showAllEvents
                                        ? "Show only messages"
                                        : "Show all events"}
                                >
                                    <span
                                        class="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                                        class:-translate-x-4={!settingsState.showAllEvents}
                                    ></span>
                                </button>
                            </div>
                        </div>

                        <div>
                            <p
                                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
                            >
                                Push Status
                            </p>
                            <div class="space-y-1.5">
                                {#each rows as [label, value]}
                                    <div
                                        class="flex items-start gap-3 text-sm py-1 border-b border-discord-divider"
                                    >
                                        <span
                                            class="text-discord-textMuted flex-shrink-0 w-44"
                                            >{label}</span
                                        >
                                        <span
                                            class="text-discord-textPrimary break-all font-mono text-xs"
                                            >{value}</span
                                        >
                                    </div>
                                {/each}
                            </div>
                            {#if pushDebug.lastError}
                                <p
                                    class="mt-3 text-xs text-discord-error break-all font-mono"
                                >
                                    Last error: {pushDebug.lastError}
                                </p>
                            {/if}
                        </div>

                        <div>
                            <button
                                onclick={runPushDiagnostics}
                                disabled={debugLoading}
                                class="px-3 py-1.5 rounded text-sm font-medium bg-discord-accent hover:bg-discord-accentHover text-white transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {#if debugLoading}
                                    <span
                                        class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"
                                    ></span>
                                    Checking…
                                {:else}
                                    Run diagnostics
                                {/if}
                            </button>
                        </div>

                        <!-- Homeserver pushers -->
                        {#if debugPushers !== null || debugPushersError}
                            <div>
                                <p
                                    class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
                                >
                                    Homeserver Pushers
                                </p>
                                {#if debugPushersError}
                                    <p
                                        class="text-xs text-discord-error break-all"
                                    >
                                        {debugPushersError}
                                    </p>
                                {:else if debugPushers && debugPushers.length === 0}
                                    <p class="text-sm text-discord-textMuted">
                                        The homeserver has no pushers registered
                                        for this account — the gateway URL was
                                        never sent.
                                    </p>
                                {:else if debugPushers}
                                    <p
                                        class="text-sm mb-2 {matchingPusher
                                            ? 'text-green-400'
                                            : 'text-discord-warning'}"
                                    >
                                        {matchingPusher
                                            ? "✓ A pusher matches the configured gateway URL."
                                            : "⚠ No pusher matches the configured gateway URL."}
                                    </p>
                                    <div class="space-y-2">
                                        {#each debugPushers as p}
                                            <div
                                                class="text-xs font-mono bg-discord-backgroundTertiary rounded p-2 space-y-0.5 break-all"
                                            >
                                                <div>
                                                    app_id: {p.app_id}
                                                </div>
                                                <div>
                                                    url: {p.url ?? "(none)"}
                                                </div>
                                                <div>
                                                    device: {p.device_display_name ??
                                                        "(none)"}
                                                </div>
                                                <div>
                                                    pushkey: {p.pushkeyPreview}
                                                </div>
                                            </div>
                                        {/each}
                                    </div>
                                {/if}
                            </div>
                        {/if}

                        <!-- Web Push (PWA / browser) -->
                        {#if webPush && webPush.supported}
                            {@const wpOk =
                                webPush.configured &&
                                webPush.permission === "granted" &&
                                webPush.subscribed}
                            {@const wpPusher =
                                debugPushers?.some(
                                    (p) => p.app_id === WEBPUSH_APP_ID,
                                ) ?? false}
                            <div>
                                <p
                                    class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
                                >
                                    Web Push (PWA)
                                </p>
                                <p
                                    class="text-sm {wpOk
                                        ? 'text-green-400'
                                        : 'text-discord-warning'}"
                                >
                                    {wpOk
                                        ? "✓ Subscribed to web push."
                                        : "⚠ Web push not active."}
                                </p>
                                <div
                                    class="text-xs font-mono text-discord-textMuted mt-1 space-y-0.5 break-all"
                                >
                                    <div>
                                        VAPID key: {webPush.configured
                                            ? "set"
                                            : "(missing)"}
                                    </div>
                                    <div>permission: {webPush.permission}</div>
                                    <div>
                                        subscription: {webPush.subscribed
                                            ? "active"
                                            : "(none)"}
                                    </div>
                                    {#if webPush.endpoint}
                                        <div>
                                            endpoint: {webPush.endpoint.slice(
                                                0,
                                                48,
                                            )}…
                                        </div>
                                    {/if}
                                    <div>
                                        homeserver pusher: {wpPusher
                                            ? "registered"
                                            : "(not found — run with pushers loaded)"}
                                    </div>
                                    {#if webPush.error}
                                        <div class="text-discord-error">
                                            error: {webPush.error}
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        {/if}

                        <!-- Gateway / Firebase health -->
                        {#if gatewayHealth}
                            <div>
                                <p
                                    class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
                                >
                                    Gateway (Sygnal / Firebase)
                                </p>
                                <p
                                    class="text-sm {gatewayHealth.reachable
                                        ? 'text-green-400'
                                        : 'text-discord-error'}"
                                >
                                    {gatewayHealth.reachable
                                        ? "✓ Gateway reachable"
                                        : "✗ Gateway not reachable"}
                                </p>
                                <p
                                    class="text-xs text-discord-textMuted break-all font-mono mt-1"
                                >
                                    {gatewayHealth.detail}
                                </p>
                            </div>
                        {/if}

                        <!-- Native session (used by the background push service) -->
                        {#if nativeSession}
                            <div>
                                <p
                                    class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
                                >
                                    Native Session (push enrichment)
                                </p>
                                {#if !nativeSession.native}
                                    <p class="text-sm text-discord-textMuted">
                                        Not running natively — enrichment only
                                        applies to the Android app.
                                    </p>
                                {:else if nativeSession.error}
                                    <p
                                        class="text-xs text-discord-error break-all"
                                    >
                                        {nativeSession.error}
                                    </p>
                                {:else}
                                    {@const ok =
                                        !!nativeSession.homeserverUrl &&
                                        nativeSession.hasToken}
                                    <p
                                        class="text-sm {ok
                                            ? 'text-green-400'
                                            : 'text-discord-warning'}"
                                    >
                                        {ok
                                            ? "✓ Session mirrored to native storage."
                                            : "⚠ Session not in native storage — notifications can't be enriched."}
                                    </p>
                                    <div
                                        class="text-xs font-mono text-discord-textMuted mt-1 space-y-0.5 break-all"
                                    >
                                        <div>
                                            homeserver: {nativeSession.homeserverUrl ??
                                                "(none)"}
                                        </div>
                                        <div>
                                            user: {nativeSession.userId ??
                                                "(none)"}
                                        </div>
                                        <div>
                                            access token: {nativeSession.hasToken
                                                ? "present"
                                                : "(none)"}
                                        </div>
                                    </div>
                                {/if}
                            </div>
                        {/if}

                        <!-- Catch-all push rules (govern background pushes) -->
                        {#if ruleSummary}
                            <div>
                                <p
                                    class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
                                >
                                    Notification Rules (server)
                                </p>
                                {#if ruleSummary.some((r) => r.ruleId === ".m.rule.message" && r.level !== "off")}
                                    <p
                                        class="text-sm text-discord-warning mb-2"
                                    >
                                        ⚠ "Rooms" is on — you'll be pushed for
                                        every message in every room. Set it to
                                        Off in the Notifications tab unless this
                                        is intended.
                                    </p>
                                {/if}
                                <div
                                    class="text-xs font-mono text-discord-textMuted space-y-0.5"
                                >
                                    {#each ruleSummary as r}
                                        <div class="flex justify-between gap-3">
                                            <span class="break-all"
                                                >{r.label}</span
                                            >
                                            <span
                                                class={r.level === "off"
                                                    ? "text-discord-textMuted"
                                                    : "text-discord-textPrimary"}
                                                >{r.level}</span
                                            >
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {/if}
                    </div>
                {/if}
            </div>
        </div>
    </div>
</div>
