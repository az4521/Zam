<script lang="ts">
    import OptionSelector from "$lib/components/ui/OptionSelector.svelte";
    import ToggleSwitch from "$lib/components/ui/ToggleSwitch.svelte";
    import {
        DEFAULT_PUSH_RULES,
        getClient,
        getDefaultPushRuleLevel,
        getDirectRooms,
        getOrphanRooms,
        getRoomDisplayName,
        getRoomNotificationSetting,
        getRoomsInSpace,
        getSpaces,
        publishActiveSession,
        setDefaultPushRuleLevel,
        setRoomNotificationSetting,
        getKeywordRules,
        addKeywordRule,
        setKeywordRuleBehavior,
        setKeywordRuleEnabled,
        deleteKeywordRule,
        type PushRuleLevel,
        type RoomNotificationSetting,
        type KeywordBehavior,
        updateServiceWorkerNotificationPrivacy,
    } from "$lib/matrix/client";
    import {
        GRACE_OPTIONS,
        MAX_CUSTOM_GRACE_MINUTES,
        MIN_CUSTOM_GRACE_MS,
        graceMsToMinutesInput,
        isPresetGraceMs,
        normalizeGraceMs,
        parseCustomGraceMinutes,
    } from "$lib/utils/activeSession";
    import { validateKeyword } from "$lib/utils/keywordRules";
    import { showErrorToast } from "$lib/stores/toasts.svelte";
    import {
        setActiveSessionGraceMs,
        setPrivateReadReceipts,
        setHideNotificationBody,
        settingsState,
    } from "$lib/stores/settings.svelte";
    import { initWebPush, requestWebPushPermission } from "$lib/webPush";
    import { syncNativeNotificationPrivacy } from "$lib/nativeSession";

    function currentPermission(): NotificationPermission | "unsupported" {
        return typeof Notification === "undefined"
            ? "unsupported"
            : Notification.permission;
    }

    let permission = $state(currentPermission());
    let permissionLoading = $state(false);
    let soundEnabled = $state(
        localStorage.getItem("notifSoundEnabled") !== "false",
    );
    let defaultRulesTick = $state(0);

    async function requestPermission() {
        permissionLoading = true;
        permission = await requestWebPushPermission().catch(currentPermission);
        if (permission === "granted") {
            const client = getClient();
            if (client) await initWebPush(client).catch(() => {});
        }
        permission = currentPermission();
        permissionLoading = false;
    }

    function setSoundEnabled(enabled: boolean) {
        soundEnabled = enabled;
        localStorage.setItem("notifSoundEnabled", String(enabled));
    }

    let graceSaveError = $state(false);
    let graceSavePending = $state(false);

    /** Shared by the picker and the retry button: re-picking the option that
     *  is already selected fires no `change`, so a failed save needs its own
     *  way back. That matters most for "Off" (0) — the heartbeat writer stops
     *  republishing once the grace is 0, so nothing else would ever retry it. */
    async function publishGrace(grace: number) {
        graceSaveError = false;
        graceSavePending = true;
        try {
            // The account-data write is what carries the choice to the user's
            // other devices, the service worker and the Android service — it
            // runs for every value, "Off" (0) included. If it fails, a focused
            // peer will republish the old grace and quietly undo the change,
            // so surface the failure instead of swallowing it.
            //
            // `false` means the write was skipped (no client / no device id),
            // which leaves the OLD grace in the blob just as surely as a thrown
            // error does — so treat the two identically rather than reporting a
            // save that never happened.
            if (!(await publishActiveSession(grace))) graceSaveError = true;
        } catch {
            graceSaveError = true;
        } finally {
            graceSavePending = false;
        }
    }

    async function pickActiveSessionGrace(raw: string) {
        const grace = normalizeGraceMs(Number(raw));
        setActiveSessionGraceMs(grace);
        await publishGrace(grace);
    }

    const CUSTOM_OPTION = "custom";

    /* Seeded once, when the panel mounts: a stored grace that matches no
     * preset — typed here or on another device — must come back as "Custom"
     * with its value filled in, not blank and not snapped to a preset. */
    let graceIsCustom = $state(
        !isPresetGraceMs(settingsState.activeSessionGraceMs),
    );
    let customMinutes = $state(
        isPresetGraceMs(settingsState.activeSessionGraceMs)
            ? ""
            : graceMsToMinutesInput(settingsState.activeSessionGraceMs),
    );
    let customError = $state("");

    function onGraceSelect(raw: string) {
        customError = "";
        if (raw !== CUSTOM_OPTION) {
            graceIsCustom = false;
            void pickActiveSessionGrace(raw);
            return;
        }
        graceIsCustom = true;
        // Nothing is saved by picking "Custom" — the value only lands when the
        // user commits one, so a half-typed number can't reach the other
        // devices. Prefill from the current setting where that's meaningful.
        if (customMinutes.trim().length === 0)
            customMinutes = graceMsToMinutesInput(
                Math.max(
                    settingsState.activeSessionGraceMs,
                    MIN_CUSTOM_GRACE_MS,
                ),
            );
    }

    /* Validation lives in activeSession.ts so the ceiling here is the same
     * number every reader clamps to. Out-of-range input is REJECTED with a
     * message rather than quietly curbed: storing a value the readers would
     * shorten is exactly how this control ends up lying about its behaviour. */
    async function saveCustomGrace() {
        const parsed = parseCustomGraceMinutes(customMinutes);
        if (!parsed.ok) {
            customError = parsed.error;
            return;
        }
        customError = "";
        customMinutes = graceMsToMinutesInput(parsed.ms);
        setActiveSessionGraceMs(parsed.ms);
        await publishGrace(parsed.ms);
    }

    const selectClass =
        "flex-shrink-0 bg-discord-backgroundTertiary text-discord-textPrimary text-sm rounded px-3 py-2 outline-none border border-transparent focus:border-discord-accent/50";

    function onToggleHideNotificationBody(value: boolean) {
        setHideNotificationBody(value);
        // The service worker and the Android FCM service each keep their own
        // copy of this flag — they cannot read localStorage.
        updateServiceWorkerNotificationPrivacy(value);
        syncNativeNotificationPrivacy(value).catch(() => {});
    }

    type NotifRoom = { roomId: string; name: string };
    type NotifGroup = { label: string; rooms: NotifRoom[] };
    const groups = $derived.by((): NotifGroup[] => {
        const result: NotifGroup[] = [];
        for (const space of getSpaces()) {
            const rooms = getRoomsInSpace(space.roomId).map((room) => ({
                roomId: room.roomId,
                name: getRoomDisplayName(room),
            }));
            if (rooms.length > 0) {
                result.push({ label: getRoomDisplayName(space), rooms });
            }
        }
        const addGroup = (
            label: string,
            rooms: ReturnType<typeof getSpaces>,
        ) => {
            if (rooms.length === 0) return;
            result.push({
                label,
                rooms: rooms.map((room) => ({
                    roomId: room.roomId,
                    name: getRoomDisplayName(room),
                })),
            });
        };
        addGroup("Other Rooms", getOrphanRooms());
        addGroup("Direct Messages", getDirectRooms());
        return result;
    });

    const roomOptions: Array<{
        value: RoomNotificationSetting;
        label: string;
        title: string;
    }> = [
        {
            value: "default",
            label: "Default",
            title: "Use global notification settings",
        },
        {
            value: "all",
            label: "All Messages",
            title: "Notify for every message",
        },
        {
            value: "mentions",
            label: "Mentions Only",
            title: "Notify for mentions only",
        },
        { value: "mute", label: "Mute", title: "No notifications" },
    ];

    const ruleLevels = $derived.by(() => {
        void defaultRulesTick;
        return Object.fromEntries(
            DEFAULT_PUSH_RULES.map((rule) => [
                rule.ruleId,
                getDefaultPushRuleLevel(rule.ruleId),
            ]),
        ) as Record<string, PushRuleLevel>;
    });

    /* `?? fallback` only fires for a MISSING message. An Error whose message is
     * "" (or whitespace) is common enough — a rethrow that lost its cause, an
     * SDK error built from an empty body — and toasting it renders an empty
     * red box that tells the user nothing. Treat blank as absent. */
    function toastMessage(error: unknown, fallback: string): string {
        const message = (error as Error)?.message;
        return typeof message === "string" && message.trim().length > 0
            ? message
            : fallback;
    }

    async function setRuleLevel(
        rule: (typeof DEFAULT_PUSH_RULES)[number],
        level: PushRuleLevel,
    ) {
        try {
            await setDefaultPushRuleLevel(rule.ruleId, rule.kind, level);
        } catch (e) {
            // The server kept the old rule: say so, and let the row snap back to
            // the canonical value rather than showing the change as applied.
            showErrorToast(
                toastMessage(e, "Could not save notification setting"),
            );
        } finally {
            defaultRulesTick++;
        }
    }

    async function setRoomLevel(
        roomId: string,
        name: string,
        setting: RoomNotificationSetting,
    ) {
        try {
            await setRoomNotificationSetting(roomId, setting);
        } catch (e) {
            showErrorToast(
                toastMessage(e, `Could not save notifications for ${name}`),
            );
        }
    }

    const keywordRules = $derived(getKeywordRules());
    let newKeyword = $state("");
    let keywordError = $state("");
    let addPending = $state(false);
    let rowPending = $state<string | null>(null);

    const behaviorOptions: ReadonlyArray<{
        value: KeywordBehavior;
        label: string;
        title: string;
    }> = [
        {
            value: "highlight_sound",
            label: "Highlight + Sound",
            title: "Notify with a highlight and sound",
        },
        {
            value: "highlight",
            label: "Highlight",
            title: "Notify with a highlight",
        },
        {
            value: "notify",
            label: "Notify",
            title: "Notify without a highlight",
        },
    ];

    async function addKeyword() {
        const result = validateKeyword(
            newKeyword,
            keywordRules.map((r) => r.pattern),
        );
        if (!result.ok) {
            keywordError = result.error;
            return;
        }
        addPending = true;
        keywordError = "";
        try {
            await addKeywordRule(result.pattern, "highlight_sound");
            newKeyword = "";
        } catch (e) {
            keywordError = (e as Error)?.message ?? "Failed to add keyword";
        } finally {
            addPending = false;
        }
    }

    async function changeBehavior(ruleId: string, behavior: KeywordBehavior) {
        rowPending = ruleId;
        keywordError = "";
        try {
            await setKeywordRuleBehavior(ruleId, behavior);
        } catch (e) {
            keywordError = (e as Error)?.message ?? "Failed to update keyword";
        } finally {
            rowPending = null;
        }
    }

    async function toggleEnabled(ruleId: string, enabled: boolean) {
        rowPending = ruleId;
        keywordError = "";
        try {
            await setKeywordRuleEnabled(ruleId, enabled);
        } catch (e) {
            keywordError = (e as Error)?.message ?? "Failed to update keyword";
        } finally {
            rowPending = null;
        }
    }

    async function removeKeyword(ruleId: string) {
        rowPending = ruleId;
        keywordError = "";
        try {
            await deleteKeywordRule(ruleId);
        } catch (e) {
            keywordError = (e as Error)?.message ?? "Failed to delete keyword";
        } finally {
            rowPending = null;
        }
    }
</script>

<div class="space-y-6">
    {#if permission !== "granted"}
        <section>
            <p
                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
            >
                System Permission
            </p>
            <div
                class="flex items-center gap-3 py-2 border-b border-discord-divider"
            >
                <div class="flex-1 min-w-0">
                    <p class="text-sm text-discord-textPrimary">
                        Push notifications
                    </p>
                    <p class="text-xs text-discord-textMuted">
                        {#if permission === "denied"}
                            Permission is blocked in system settings
                        {:else if permission === "unsupported"}
                            Notifications are not supported here
                        {:else}
                            Allow this app to send notifications
                        {/if}
                    </p>
                </div>
                <button
                    onclick={requestPermission}
                    disabled={permissionLoading ||
                        permission === "denied" ||
                        permission === "unsupported"}
                    class="px-3 py-1.5 rounded text-sm font-semibold bg-discord-accent hover:bg-discord-accentHover text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-discord-accent flex items-center gap-2 flex-shrink-0"
                >
                    {permissionLoading
                        ? "Requesting…"
                        : permission === "denied"
                          ? "Blocked"
                          : permission === "unsupported"
                            ? "Unavailable"
                            : "Enable"}
                </button>
            </div>
        </section>
    {/if}

    <section>
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
            <ToggleSwitch
                checked={soundEnabled}
                onChange={setSoundEnabled}
                label="Notification sound"
            />
        </div>
    </section>

    <section>
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
        >
            Multiple Devices
        </p>
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    Quiet on my other devices
                </p>
                <p class="text-xs text-discord-textMuted">
                    While you're actively using one device, the others skip the
                    notification sound and pop-up until that device has been
                    idle this long. Applies to every device on your account;
                    notifications still appear in your inbox and unread counts
                    are unchanged.
                </p>
            </div>
            <select
                class={selectClass}
                value={graceIsCustom
                    ? CUSTOM_OPTION
                    : String(settingsState.activeSessionGraceMs)}
                onchange={(e) => onGraceSelect(e.currentTarget.value)}
                aria-label="Quiet on my other devices"
            >
                {#each GRACE_OPTIONS as opt (opt.value)}
                    <option value={String(opt.value)}>{opt.label}</option>
                {/each}
                <option value={CUSTOM_OPTION}>Custom…</option>
            </select>
        </div>
        {#if graceIsCustom}
            <div class="flex items-center justify-end gap-2 mt-2">
                <input
                    type="number"
                    min="1"
                    max={MAX_CUSTOM_GRACE_MINUTES}
                    step="1"
                    inputmode="decimal"
                    class="w-24 bg-discord-backgroundTertiary text-discord-textPrimary text-sm rounded px-3 py-2 outline-none border border-transparent focus:border-discord-accent/50"
                    value={customMinutes}
                    oninput={(e) => (customMinutes = e.currentTarget.value)}
                    onkeydown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            saveCustomGrace();
                        }
                    }}
                    aria-label="Custom quiet duration, in minutes"
                    aria-invalid={customError ? "true" : undefined}
                />
                <span class="text-xs text-discord-textMuted"
                    >minutes (max {MAX_CUSTOM_GRACE_MINUTES})</span
                >
                <button
                    onclick={saveCustomGrace}
                    disabled={graceSavePending}
                    class="px-2.5 py-1 rounded text-xs font-semibold bg-discord-backgroundSecondary hover:bg-discord-messageHover text-discord-textPrimary transition-colors disabled:opacity-50 flex-shrink-0"
                    >{graceSavePending ? "Saving…" : "Save"}</button
                >
            </div>
            {#if customError}
                <p
                    class="text-xs text-discord-danger mt-1 text-right"
                    aria-live="polite"
                >
                    {customError}
                </p>
            {/if}
        {/if}
        {#if graceSaveError}
            <div class="flex items-start gap-2 mt-2">
                <p
                    class="flex-1 min-w-0 text-sm text-discord-danger"
                    aria-live="polite"
                >
                    Couldn't save to your account - your other devices may keep
                    the old setting. Check your connection and try again.
                </p>
                <button
                    onclick={() =>
                        publishGrace(settingsState.activeSessionGraceMs)}
                    disabled={graceSavePending}
                    aria-label="Retry saving the other-device quiet setting"
                    class="px-2.5 py-1 rounded text-xs font-semibold bg-discord-backgroundSecondary hover:bg-discord-messageHover text-discord-textPrimary transition-colors disabled:opacity-50 flex-shrink-0"
                    >{graceSavePending ? "Retrying…" : "Retry"}</button
                >
            </div>
        {/if}
    </section>

    <section>
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
                    Hide your read receipts from other users. Your unread counts
                    still work; others just can't see how far you've read.
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.privateReadReceipts}
                onChange={setPrivateReadReceipts}
                label="Private read receipts"
            />
        </div>
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    Hide message text in notifications
                </p>
                <p class="text-xs text-discord-textMuted">
                    Notifications on this device say who messaged you, but not
                    what they said. The sender and room names are still shown.
                    Applies to this device only.
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.hideNotificationBody}
                onChange={onToggleHideNotificationBody}
                label="Hide message text in notifications"
            />
        </div>
    </section>

    <section>
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1"
        >
            Notification Rules
        </p>
        <p class="text-xs text-discord-textMuted mb-3">
            Loud = notify with sound · Silent = notify without sound · Off = no
            notification
        </p>
        <div class="space-y-1">
            {#each DEFAULT_PUSH_RULES as rule}
                <div
                    class="flex items-center gap-3 py-2 border-b border-discord-divider"
                >
                    <div class="flex-1 min-w-0">
                        <p class="text-sm text-discord-textPrimary">
                            {rule.label}
                        </p>
                        <p class="text-xs text-discord-textMuted">
                            {rule.description}
                        </p>
                    </div>
                    <OptionSelector
                        value={ruleLevels[rule.ruleId]}
                        options={[
                            { value: "loud", label: "Loud" },
                            { value: "silent", label: "Silent" },
                            { value: "off", label: "Off" },
                        ]}
                        onChange={(level) => setRuleLevel(rule, level)}
                        ariaLabel={rule.label}
                    />
                </div>
            {/each}
        </div>
    </section>

    <section>
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1"
        >
            Keyword Highlights
        </p>
        <p class="text-xs text-discord-textMuted mb-3">
            Get notified when a message contains a word or phrase. Matching is
            case-insensitive; <span class="font-mono">*</span> and
            <span class="font-mono">?</span> are wildcards.
        </p>
        <form
            class="flex items-center gap-2 mb-2"
            onsubmit={(e) => {
                e.preventDefault();
                addKeyword();
            }}
        >
            <input
                bind:value={newKeyword}
                type="text"
                placeholder="Add a keyword…"
                aria-label="New keyword"
                class="flex-1 min-w-0 px-3 py-1.5 rounded text-sm bg-discord-backgroundTertiary text-discord-textPrimary placeholder:text-discord-textMuted focus:outline-none focus:ring-1 focus:ring-discord-accent"
            />
            <button
                type="submit"
                disabled={addPending}
                class="px-3 py-1.5 rounded text-sm font-semibold bg-discord-accent hover:bg-discord-accentHover text-white transition-colors disabled:opacity-50"
                >Add</button
            >
        </form>
        {#if keywordError}
            <p class="text-sm text-discord-danger mb-2">{keywordError}</p>
        {/if}
        {#if keywordRules.length === 0}
            <p class="text-sm text-discord-textMuted italic">
                No keyword rules yet.
            </p>
        {:else}
            <div class="space-y-1">
                {#each keywordRules as rule (rule.ruleId)}
                    <div
                        class="flex items-center gap-3 py-2 border-b border-discord-divider"
                    >
                        <span
                            class="flex-1 min-w-0 text-sm text-discord-textPrimary font-mono truncate"
                            >{rule.pattern}</span
                        >
                        <OptionSelector
                            value={rule.behavior}
                            options={behaviorOptions}
                            onChange={(b) => changeBehavior(rule.ruleId, b)}
                            ariaLabel={`Behavior for ${rule.pattern}`}
                        />
                        <ToggleSwitch
                            checked={rule.enabled}
                            onChange={(v) => toggleEnabled(rule.ruleId, v)}
                            label={`Enable ${rule.pattern}`}
                        />
                        <button
                            onclick={() => removeKeyword(rule.ruleId)}
                            disabled={rowPending === rule.ruleId}
                            class="px-2.5 py-1 rounded text-xs font-semibold bg-discord-backgroundSecondary hover:bg-discord-messageHover text-discord-textPrimary transition-colors disabled:opacity-50"
                            >Delete</button
                        >
                    </div>
                {/each}
            </div>
        {/if}
    </section>

    {#if groups.length > 0}
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide -mb-2"
        >
            Per-room Overrides
        </p>
    {/if}
    {#each groups as group}
        <section>
            <p
                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
            >
                {group.label}
            </p>
            <div class="space-y-1">
                {#each group.rooms as room}
                    <div
                        class="flex items-center gap-3 py-2 border-b border-discord-divider"
                    >
                        <span
                            class="flex-1 text-sm text-discord-textPrimary truncate"
                            >{room.name}</span
                        >
                        <OptionSelector
                            value={getRoomNotificationSetting(room.roomId)}
                            options={roomOptions}
                            onChange={(setting) =>
                                setRoomLevel(room.roomId, room.name, setting)}
                            ariaLabel={`Notifications for ${room.name}`}
                        />
                    </div>
                {/each}
            </div>
        </section>
    {/each}
    {#if groups.length === 0}
        <p class="text-sm text-discord-textMuted italic">No rooms found.</p>
    {/if}
</div>
