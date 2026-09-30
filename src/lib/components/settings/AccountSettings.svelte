<script lang="ts">
    import { t } from "$lib/i18n";
    import OptionSelector from "$lib/components/ui/OptionSelector.svelte";
    import ProfileFieldsEditor from "$lib/components/settings/ProfileFieldsEditor.svelte";
    import ToggleSwitch from "$lib/components/ui/ToggleSwitch.svelte";
    import {
        changeAccountPassword,
        deactivateOwnAccount,
        fetchOwnProfile,
        getOwnAvatarMxc,
        getOwnDisplayName,
        getAccountManagementUrl,
        getOwnThreePids,
        getServerCapabilities,
        mxcToHttp,
        setOwnAvatarMxc,
        setOwnDisplayName,
        uploadContent,
        type ThreePid,
    } from "$lib/matrix/client";
    import { auth, isOAuthSession } from "$lib/stores/auth.svelte";
    import { changeOwnPresence } from "$lib/stores/presence.svelte";
    import { settingsState } from "$lib/stores/settings.svelte";
    import {
        deactivationConfirmed,
        validatePasswordChange,
    } from "$lib/utils/accountSecurity";
    import {
        OWN_PRESENCE_OPTIONS,
        type PresenceState,
    } from "$lib/utils/presence";
    import {
        serverSupports,
        type Capabilities,
    } from "$lib/utils/serverCapabilities";
    import { syncStateLabel } from "$lib/utils/syncStatus";

    interface Props {
        onLogout: () => void;
    }
    let { onLogout }: Props = $props();

    let displayName = $state(getOwnDisplayName() ?? "");
    let avatarMxc = $state<string | null>(getOwnAvatarMxc());
    let avatarUploading = $state(false);
    let savingName = $state(false);
    let profileError = $state("");
    let profileSaved = $state(false);
    let avatarInput: HTMLInputElement | undefined = $state();
    let presenceError = $state("");
    let capabilities = $state<Capabilities | null>(null);
    // Native OAuth sessions: the provider, not the homeserver, owns the
    // password, sessions and deactivation, so those link to its account page.
    const oauthSession = isOAuthSession();
    let accountUrl = $state<string | null>(null);
    let deactivateUrl = $state<string | null>(null);
    let threePids = $state<ThreePid[]>([]);
    let securityLoaded = $state(false);

    let currentPassword = $state("");
    let newPassword = $state("");
    let confirmPassword = $state("");
    let logoutOthers = $state(true);
    let passwordBusy = $state(false);
    let passwordError = $state("");
    let passwordChanged = $state(false);

    let deactivateOpen = $state(false);
    let deactivateTyped = $state("");
    let deactivatePassword = $state("");
    let deactivateErase = $state(false);
    let deactivateBusy = $state(false);
    let deactivateError = $state("");

    const avatarUrl = $derived(mxcToHttp(avatarMxc));
    const nameChanged = $derived(
        displayName.trim() !== (getOwnDisplayName() ?? ""),
    );
    const syncStatus = $derived(syncStateLabel(auth.syncState));
    const selectedPresence = $derived(
        OWN_PRESENCE_OPTIONS.find(
            (option) => option.value === settingsState.ownPresence,
        ),
    );
    const canChangePassword = $derived(
        serverSupports("changePassword", capabilities),
    );
    const canManageThreePids = $derived(
        serverSupports("change3pid", capabilities),
    );
    const passwordProblem = $derived(
        validatePasswordChange({
            current: currentPassword,
            next: newPassword,
            confirm: confirmPassword,
        }),
    );
    const deactivateArmed = $derived(
        deactivationConfirmed(deactivateTyped, auth.userId) &&
            deactivatePassword.length > 0,
    );

    async function load() {
        if (oauthSession) {
            void getAccountManagementUrl().then((u) => (accountUrl = u));
            void getAccountManagementUrl("org.matrix.account_deactivate").then(
                (u) => (deactivateUrl = u),
            );
        }
        try {
            const profile = await fetchOwnProfile();
            displayName = profile.displayName ?? "";
            avatarMxc = profile.avatarMxc;
        } catch {
            // The local SDK profile remains usable while offline.
        }
        try {
            capabilities = (await getServerCapabilities()) as Capabilities;
            threePids = await getOwnThreePids().catch(() => []);
        } catch {
            capabilities = null;
            threePids = [];
        } finally {
            securityLoaded = true;
        }
    }

    function flashSaved() {
        profileSaved = true;
        setTimeout(() => (profileSaved = false), 2000);
    }

    async function selectAvatar(event: Event) {
        const file = (event.currentTarget as HTMLInputElement).files?.[0];
        if (avatarInput) avatarInput.value = "";
        if (!file) return;
        avatarUploading = true;
        profileError = "";
        try {
            const mxc = await uploadContent(file);
            await setOwnAvatarMxc(mxc);
            avatarMxc = mxc;
            flashSaved();
        } catch (error) {
            profileError =
                (error as Error)?.message ??
                t("accountSettings.avatarUploadFailed");
        } finally {
            avatarUploading = false;
        }
    }

    async function removeAvatar() {
        avatarUploading = true;
        profileError = "";
        try {
            await setOwnAvatarMxc("");
            avatarMxc = null;
            flashSaved();
        } catch (error) {
            profileError =
                (error as Error)?.message ??
                t("accountSettings.failedToRemoveAvatar");
        } finally {
            avatarUploading = false;
        }
    }

    async function saveName() {
        savingName = true;
        profileError = "";
        try {
            await setOwnDisplayName(displayName.trim());
            flashSaved();
        } catch (error) {
            profileError =
                (error as Error)?.message ??
                t("accountSettings.failedToSaveName");
        } finally {
            savingName = false;
        }
    }

    async function setPresence(value: PresenceState) {
        presenceError = "";
        try {
            await changeOwnPresence(value);
        } catch (error) {
            presenceError =
                (error as Error)?.message ??
                t("accountSettings.couldNotSetPresence");
        }
    }

    async function changePassword() {
        if (passwordProblem || passwordBusy) return;
        passwordBusy = true;
        passwordError = "";
        passwordChanged = false;
        try {
            await changeAccountPassword(
                currentPassword,
                newPassword,
                logoutOthers,
            );
            currentPassword = "";
            newPassword = "";
            confirmPassword = "";
            passwordChanged = true;
        } catch (error) {
            passwordError =
                (error as Error)?.message ??
                t("accountSettings.failedToChangePassword");
        } finally {
            passwordBusy = false;
        }
    }

    function cancelDeactivation() {
        deactivateOpen = false;
        deactivateTyped = "";
        deactivatePassword = "";
        deactivateErase = false;
        deactivateError = "";
    }

    async function deactivate() {
        if (!deactivateArmed || deactivateBusy) return;
        deactivateBusy = true;
        deactivateError = "";
        try {
            await deactivateOwnAccount(deactivatePassword, deactivateErase);
            onLogout();
        } catch (error) {
            deactivateError =
                (error as Error)?.message ??
                t("accountSettings.failedToDeactivateAccount");
            deactivateBusy = false;
        }
    }

    $effect(() => {
        load();
    });
</script>

<div class="space-y-6">
    <section>
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
        >
            {t("accountSettings.profile")}
        </p>
        <div class="flex items-center gap-4">
            {#if avatarUrl}
                <img
                    src={avatarUrl}
                    alt={t("accountSettings.yourAvatar")}
                    class="w-20 h-20 rounded-full object-cover flex-shrink-0"
                />
            {:else}
                <div
                    class="w-20 h-20 rounded-full bg-discord-accent/80 text-white flex items-center justify-center text-2xl font-semibold flex-shrink-0"
                >
                    {(displayName || auth.userId || "?")
                        .replace(/^@/, "")
                        .charAt(0)
                        .toUpperCase()}
                </div>
            {/if}
            <div class="flex gap-2">
                <button
                    onclick={() => avatarInput?.click()}
                    disabled={avatarUploading}
                    class="px-3 py-1.5 bg-discord-accent text-white rounded text-sm disabled:opacity-50"
                    >{avatarUploading
                        ? t("common.uploading")
                        : t("accountSettings.changeAvatar")}</button
                >
                {#if avatarMxc}
                    <button
                        onclick={removeAvatar}
                        disabled={avatarUploading}
                        class="px-3 py-1.5 bg-discord-backgroundTertiary text-discord-textPrimary rounded text-sm"
                        >{t("common.remove")}</button
                    >
                {/if}
            </div>
            <input
                bind:this={avatarInput}
                type="file"
                accept="image/*"
                onchange={selectAvatar}
                class="hidden"
            />
        </div>
        <div class="mt-4 flex gap-2">
            <input
                bind:value={displayName}
                maxlength="255"
                placeholder={t("accountSettings.yourDisplayName")}
                class="flex-1 bg-discord-backgroundTertiary text-discord-textPrimary text-sm rounded px-3 py-2 outline-none"
            />
            <button
                onclick={saveName}
                disabled={savingName || !nameChanged}
                class="px-4 py-2 bg-discord-accent text-white rounded text-sm disabled:opacity-50"
                >{savingName ? t("common.saving") : t("common.save")}</button
            >
        </div>
        {#if profileError}<p class="mt-2 text-xs text-discord-danger">
                {profileError}
            </p>{:else if profileSaved}<p
                class="mt-2 text-xs text-discord-textPositive"
            >
                {t("accountSettings.saved")}
            </p>{/if}
    </section>

    <ProfileFieldsEditor {capabilities} {displayName} />

    <section class="space-y-2 text-sm">
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
        >
            {t("accountSettings.account")}
        </p>
        <div class="flex justify-between py-2 border-b border-discord-divider">
            <span class="text-discord-textMuted"
                >{t("accountSettings.userId")}</span
            ><span class="text-discord-textPrimary font-mono text-xs"
                >{auth.userId}</span
            >
        </div>
        <div class="flex justify-between py-2 border-b border-discord-divider">
            <span class="text-discord-textMuted"
                >{t("accountSettings.homeserver")}</span
            ><span class="text-discord-textPrimary text-xs"
                >{auth.homeserverUrl}</span
            >
        </div>
        <div class="flex justify-between py-2 border-b border-discord-divider">
            <span class="text-discord-textMuted"
                >{t("accountSettings.connection")}</span
            ><span class="text-discord-textPrimary text-xs"
                >{syncStatus.label}</span
            >
        </div>
    </section>

    <section>
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
        >
            {t("accountSettings.presence")}
        </p>
        <div class="flex items-center gap-3">
            <OptionSelector
                value={settingsState.ownPresence}
                options={OWN_PRESENCE_OPTIONS}
                onChange={setPresence}
                ariaLabel={t("accountSettings.presence")}
            />
            <p class="text-xs text-discord-textMuted">
                {selectedPresence?.description}
            </p>
        </div>
        {#if presenceError}<p class="mt-2 text-xs text-discord-danger">
                {presenceError}
            </p>{/if}
    </section>

    <section>
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
        >
            {t("accountSettings.password")}
        </p>
        {#if oauthSession}
            <p class="text-sm text-discord-textMuted mb-3">
                {t("accountSettings.managedByProvider")}
            </p>
            {#if accountUrl}
                <a
                    href={accountUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-block px-4 py-2 bg-discord-accent hover:bg-discord-accentHover text-white rounded text-sm"
                    >{t("accountSettings.manageAccount")}</a
                >
            {/if}
        {:else if canChangePassword}
            <div class="space-y-3 max-w-sm">
                <input
                    type="password"
                    bind:value={currentPassword}
                    autocomplete="current-password"
                    placeholder={t("accountSettings.currentPassword")}
                    class="w-full bg-discord-backgroundTertiary text-discord-textPrimary text-sm rounded px-3 py-2 outline-none"
                />
                <input
                    type="password"
                    bind:value={newPassword}
                    autocomplete="new-password"
                    placeholder={t("accountSettings.newPassword")}
                    class="w-full bg-discord-backgroundTertiary text-discord-textPrimary text-sm rounded px-3 py-2 outline-none"
                />
                <input
                    type="password"
                    bind:value={confirmPassword}
                    autocomplete="new-password"
                    placeholder={t("accountSettings.confirmNewPassword")}
                    class="w-full bg-discord-backgroundTertiary text-discord-textPrimary text-sm rounded px-3 py-2 outline-none"
                />
                <div class="flex items-center justify-between gap-3">
                    <span class="text-sm text-discord-textPrimary"
                        >{t("accountSettings.signOutAllOtherSessions")}</span
                    >
                    <ToggleSwitch
                        checked={logoutOthers}
                        onChange={(value) => (logoutOthers = value)}
                        label={t("accountSettings.signOutAllOtherSessions")}
                    />
                </div>
                <button
                    onclick={changePassword}
                    disabled={passwordBusy || passwordProblem !== null}
                    class="px-4 py-2 bg-discord-accent text-white rounded text-sm disabled:opacity-50"
                    >{passwordBusy
                        ? t("accountSettings.changing")
                        : t("accountSettings.changePassword")}</button
                >
                {#if passwordError}<p class="text-xs text-discord-danger">
                        {passwordError}
                    </p>{:else if passwordChanged}<p
                        class="text-xs text-discord-textPositive"
                    >
                        {t("accountSettings.passwordChanged")}
                    </p>{:else if passwordProblem && (currentPassword || newPassword || confirmPassword)}<p
                        class="text-xs text-discord-textMuted"
                    >
                        {passwordProblem}
                    </p>{/if}
            </div>
        {:else}
            <p class="text-sm text-discord-textMuted">
                {t("accountSettings.thisServerDoesNotAllowChanging")}
            </p>
        {/if}
    </section>

    <section>
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
        >
            {t("accountSettings.emailPhoneNumbers")}
        </p>
        {#if !securityLoaded}
            <p class="text-sm text-discord-textMuted">{t("common.loading")}</p>
        {:else if threePids.length === 0}
            <p class="text-sm text-discord-textMuted">
                {t("accountSettings.noEmailAddressesOrPhoneNumbers")}
            </p>
        {:else}
            {#each threePids as identifier (identifier.medium + identifier.address)}
                <div
                    class="flex justify-between py-2 border-b border-discord-divider text-sm"
                >
                    <span class="text-discord-textMuted"
                        >{identifier.medium === "email"
                            ? t("accountSettings.email")
                            : t("accountSettings.phone")}</span
                    ><span class="text-discord-textPrimary font-mono text-xs"
                        >{identifier.address}</span
                    >
                </div>
            {/each}
        {/if}
        {#if securityLoaded && !canManageThreePids}
            <p class="mt-2 text-xs text-discord-textMuted">
                {t("accountSettings.thisServerDoesNotAllowManaging")}
            </p>
        {/if}
    </section>

    <button
        onclick={onLogout}
        class="px-4 py-2 bg-discord-danger text-white rounded font-medium text-sm"
        >{t("accountSettings.logOut")}</button
    >

    {#if !oauthSession || deactivateUrl || accountUrl}
        <section class="pt-4 border-t border-discord-divider space-y-3">
            <p
                class="text-xs font-semibold text-discord-danger uppercase tracking-wide"
            >
                {t("accountSettings.dangerZone")}
            </p>
            {#if oauthSession}
                {#if deactivateUrl ?? accountUrl}
                    <a
                        href={deactivateUrl ?? accountUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="inline-block px-4 py-2 border border-discord-danger text-discord-danger rounded text-sm"
                        >{t("accountSettings.deactivateAccount")}</a
                    >
                {/if}
            {:else if !deactivateOpen}
                <button
                    onclick={() => (deactivateOpen = true)}
                    class="px-4 py-2 border border-discord-danger text-discord-danger rounded text-sm"
                    >{t("accountSettings.deactivateAccount")}</button
                >
            {:else}
                <div class="space-y-3 max-w-sm">
                    <p class="text-sm text-discord-textPrimary">
                        {t(
                            "accountSettings.deactivationIsPermanentAndCannotBe",
                        )}
                    </p>
                    <input
                        bind:value={deactivateTyped}
                        placeholder={auth.userId ?? ""}
                        class="w-full bg-discord-backgroundTertiary text-discord-textPrimary text-sm rounded px-3 py-2"
                    />
                    <input
                        type="password"
                        bind:value={deactivatePassword}
                        autocomplete="current-password"
                        placeholder={t("accountSettings.currentPassword")}
                        class="w-full bg-discord-backgroundTertiary text-discord-textPrimary text-sm rounded px-3 py-2"
                    />
                    <div class="flex items-center justify-between gap-3">
                        <span class="text-sm text-discord-textPrimary"
                            >{t(
                                "accountSettings.eraseMessagesWherePossible",
                            )}</span
                        >
                        <ToggleSwitch
                            checked={deactivateErase}
                            onChange={(value) => (deactivateErase = value)}
                            label={t(
                                "accountSettings.eraseMessagesWherePossible",
                            )}
                        />
                    </div>
                    <div class="flex gap-2">
                        <button
                            onclick={deactivate}
                            disabled={!deactivateArmed || deactivateBusy}
                            class="px-4 py-2 bg-discord-danger text-white rounded text-sm disabled:opacity-50"
                            >{deactivateBusy
                                ? t("accountSettings.deactivating")
                                : t(
                                      "accountSettings.deactivateAccount2",
                                  )}</button
                        >
                        <button
                            onclick={cancelDeactivation}
                            disabled={deactivateBusy}
                            class="px-4 py-2 bg-discord-backgroundTertiary text-discord-textPrimary rounded text-sm"
                            >{t("common.cancel")}</button
                        >
                    </div>
                    {#if deactivateError}<p class="text-xs text-discord-danger">
                            {deactivateError}
                        </p>{/if}
                </div>
            {/if}
        </section>
    {/if}
</div>
