<script lang="ts">
    import { t } from "$lib/i18n";
    import OptionSelector from "$lib/components/ui/OptionSelector.svelte";
    import ToggleSwitch from "$lib/components/ui/ToggleSwitch.svelte";
    import {
        DEFAULT_PUSH_RULES,
        getClient,
        getDefaultPushRuleLevel,
        publishActiveSession,
        setDefaultPushRuleLevel,
        getKeywordRules,
        addKeywordRule,
        setKeywordRuleBehavior,
        setKeywordRuleEnabled,
        deleteKeywordRule,
        type PushRuleLevel,
        type KeywordBehavior,
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
        setDesktopAlertMode,
        settingsState,
    } from "$lib/stores/settings.svelte";
    import type { DesktopAlertMode } from "$lib/utils/desktopAlert";
    import { initWebPush, requestWebPushPermission } from "$lib/webPush";

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

    const alertModeOptions: ReadonlyArray<{
        value: DesktopAlertMode;
        label: string;
        title: string;
    }> = [
        {
            value: "loud",
            label: t("notificationSettings.loudOnly"),
            title: t("notificationSettings.onlyNotificationsThatMakeASound"),
        },
        {
            value: "all",
            label: t("notificationSettings.silentAndLoud"),
            title: t("notificationSettings.everyNotificationLoudOrSilent"),
        },
        {
            value: "none",
            label: t("notificationSettings.none"),
            title: t("notificationSettings.neverAlertOnThisDevice"),
        },
    ];

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
                toastMessage(
                    e,
                    t("notificationSettings.couldNotSaveNotificationSetting"),
                ),
            );
        } finally {
            defaultRulesTick++;
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
            label: t("notificationSettings.highlightSound"),
            title: t("notificationSettings.notifyWithAHighlightAndSound"),
        },
        {
            value: "highlight",
            label: t("notificationSettings.highlight"),
            title: t("notificationSettings.notifyWithAHighlight"),
        },
        {
            value: "notify",
            label: t("notificationSettings.notify"),
            title: t("notificationSettings.notifyWithoutAHighlight"),
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
            keywordError =
                (e as Error)?.message ??
                t("notificationSettings.failedToAddKeyword");
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
            keywordError =
                (e as Error)?.message ??
                t("notificationSettings.failedToUpdateKeyword");
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
            keywordError =
                (e as Error)?.message ??
                t("notificationSettings.failedToUpdateKeyword");
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
            keywordError =
                (e as Error)?.message ??
                t("notificationSettings.failedToDeleteKeyword");
        } finally {
            rowPending = null;
        }
    }
</script>

<div class="space-y-6">
    <h3
        class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
    >
        {t("notificationSettings.thisDevice")}
    </h3>

    {#if permission !== "granted"}
        <section data-setting-anchor="notif-system">
            <p
                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
            >
                {t("notificationSettings.systemPermission")}
            </p>
            <div
                class="flex items-center gap-3 py-2 border-b border-discord-divider"
            >
                <div class="flex-1 min-w-0">
                    <p class="text-sm text-discord-textPrimary">
                        {t("notificationSettings.pushNotifications")}
                    </p>
                    <p class="text-xs text-discord-textMuted">
                        {#if permission === "denied"}
                            {t(
                                "notificationSettings.permissionIsBlockedInSystemSettings",
                            )}
                        {:else if permission === "unsupported"}
                            {t(
                                "notificationSettings.notificationsAreNotSupportedHere",
                            )}
                        {:else}
                            {t(
                                "notificationSettings.allowThisAppToSendNotifications",
                            )}
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
                        ? t("notificationSettings.requesting")
                        : permission === "denied"
                          ? t("notificationSettings.blocked")
                          : permission === "unsupported"
                            ? t("notificationSettings.unavailable")
                            : t("notificationSettings.enable")}
                </button>
            </div>
        </section>
    {/if}

    <section data-setting-anchor="notif-sound">
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
        >
            {t("notificationSettings.sound")}
        </p>
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    {t("notificationSettings.notificationSound")}
                </p>
                <p class="text-xs text-discord-textMuted">
                    {t("notificationSettings.playASoundForLoudNotifications")}
                </p>
            </div>
            <ToggleSwitch
                checked={soundEnabled}
                onChange={setSoundEnabled}
                label={t("notificationSettings.notificationSound")}
            />
        </div>
    </section>

    <section data-setting-anchor="notif-desktop">
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
        >
            {t("notificationSettings.desktopAlerts")}
        </p>
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    {t("notificationSettings.popUpAndTaskbarFlash")}
                </p>
                <p class="text-xs text-discord-textMuted">
                    {t("notificationSettings.whichNotificationsShowASystemPop")}
                </p>
            </div>
            <OptionSelector
                value={settingsState.desktopAlertMode}
                options={alertModeOptions}
                onChange={setDesktopAlertMode}
                ariaLabel={t("notificationSettings.desktopAlerts")}
            />
        </div>
    </section>

    <section data-setting-anchor="notif-devices">
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
        >
            {t("notificationSettings.multipleDevices")}
        </p>
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    {t("notificationSettings.quietOnMyOtherDevices")}
                </p>
                <p class="text-xs text-discord-textMuted">
                    {t("notificationSettings.whileYouReActivelyUsingOne")}
                </p>
            </div>
            <select
                class={selectClass}
                value={graceIsCustom
                    ? CUSTOM_OPTION
                    : String(settingsState.activeSessionGraceMs)}
                onchange={(e) => onGraceSelect(e.currentTarget.value)}
                aria-label={t("notificationSettings.quietOnMyOtherDevices")}
            >
                {#each GRACE_OPTIONS as opt (opt.value)}
                    <option value={String(opt.value)}>{opt.label}</option>
                {/each}
                <option value={CUSTOM_OPTION}
                    >{t("notificationSettings.custom")}</option
                >
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
                    aria-label={t(
                        "notificationSettings.customQuietDurationInMinutes",
                    )}
                    aria-invalid={customError ? "true" : undefined}
                />
                <span class="text-xs text-discord-textMuted"
                    >{t("notificationSettings.minutesMax", {
                        MAX_CUSTOM_GRACE_MINUTES,
                    })}</span
                >
                <button
                    onclick={saveCustomGrace}
                    disabled={graceSavePending}
                    class="px-2.5 py-1 rounded text-xs font-semibold bg-discord-backgroundSecondary hover:bg-discord-messageHover text-discord-textPrimary transition-colors disabled:opacity-50 flex-shrink-0"
                    >{graceSavePending
                        ? t("common.saving")
                        : t("common.save")}</button
                >
            </div>
            {#if customError}
                <p
                    class="text-xs text-discord-danger mt-1 text-end"
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
                    {t("notificationSettings.couldnTSaveToYourAccount")}
                </p>
                <button
                    onclick={() =>
                        publishGrace(settingsState.activeSessionGraceMs)}
                    disabled={graceSavePending}
                    aria-label={t(
                        "notificationSettings.retrySavingTheOtherDeviceQuiet",
                    )}
                    class="px-2.5 py-1 rounded text-xs font-semibold bg-discord-backgroundSecondary hover:bg-discord-messageHover text-discord-textPrimary transition-colors disabled:opacity-50 flex-shrink-0"
                    >{graceSavePending
                        ? t("notificationSettings.retrying")
                        : t("common.retry")}</button
                >
            </div>
        {/if}
    </section>

    <h3
        class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
    >
        {t("notificationSettings.rules")}
    </h3>

    <section data-setting-anchor="notif-rules">
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1"
        >
            {t("notificationSettings.notificationRules")}
        </p>
        <p class="text-xs text-discord-textMuted mb-3">
            {t("notificationSettings.loudNotifyWithSoundSilentNotify")}
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

    <section data-setting-anchor="notif-keywords">
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1"
        >
            {t("notificationSettings.keywordHighlights")}
        </p>
        <p class="text-xs text-discord-textMuted mb-3">
            {t("notificationSettings.getNotifiedWhenAMessageContains")}
            <span class="font-mono">*</span>
            {t("notificationSettings.and")}
            <span class="font-mono">?</span>
            {t("notificationSettings.areWildcards")}
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
                placeholder={t("notificationSettings.addAKeyword")}
                aria-label={t("notificationSettings.newKeyword")}
                class="flex-1 min-w-0 px-3 py-1.5 rounded text-sm bg-discord-backgroundTertiary text-discord-textPrimary placeholder:text-discord-textMuted focus:outline-none focus:ring-1 focus:ring-discord-accent"
            />
            <button
                type="submit"
                disabled={addPending}
                class="px-3 py-1.5 rounded text-sm font-semibold bg-discord-accent hover:bg-discord-accentHover text-white transition-colors disabled:opacity-50"
                >{t("common.add")}</button
            >
        </form>
        {#if keywordError}
            <p class="text-sm text-discord-danger mb-2">{keywordError}</p>
        {/if}
        {#if keywordRules.length === 0}
            <p class="text-sm text-discord-textMuted italic">
                {t("notificationSettings.noKeywordRulesYet")}
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
                            ariaLabel={t("notificationSettings.behaviorFor", {
                                pattern: rule.pattern,
                            })}
                        />
                        <ToggleSwitch
                            checked={rule.enabled}
                            onChange={(v) => toggleEnabled(rule.ruleId, v)}
                            label={t("notificationSettings.enable2", {
                                pattern: rule.pattern,
                            })}
                        />
                        <button
                            onclick={() => removeKeyword(rule.ruleId)}
                            disabled={rowPending === rule.ruleId}
                            class="px-2.5 py-1 rounded text-xs font-semibold bg-discord-backgroundSecondary hover:bg-discord-messageHover text-discord-textPrimary transition-colors disabled:opacity-50"
                            >{t("common.delete")}</button
                        >
                    </div>
                {/each}
            </div>
        {/if}
    </section>
</div>
