<script lang="ts">
    import {
        fetchOwnExtendedProfile,
        mxcToHttp,
        setOwnProfileField,
        uploadContent,
    } from "$lib/matrix/client";
    import { Smile } from "lucide-svelte";
    import EmojiPicker from "$lib/components/ui/EmojiPicker.svelte";
    import ToggleSwitch from "$lib/components/ui/ToggleSwitch.svelte";
    import { auth } from "$lib/stores/auth.svelte";
    import { changeOwnStatusMessage } from "$lib/stores/presence.svelte";
    import {
        setShareCallStatus,
        settingsState,
    } from "$lib/stores/settings.svelte";
    import { setCachedProfile } from "$lib/stores/profileFields.svelte";
    import {
        DEFAULT_COLOUR_ON_DARK,
        DEFAULT_COLOUR_ON_LIGHT,
        MAX_BIOGRAPHY_LENGTH,
        MAX_CONNECTIONS,
        MAX_CONNECTION_DESCRIPTION,
        MAX_STATUS_EMOJI_LENGTH,
        MAX_STATUS_TEXT_LENGTH,
        PROFILE_FIELDS,
        buildBiography,
        buildConnections,
        buildStatus,
        connectionsProblem,
        knownTimezones,
        parseBanner,
        parseBiography,
        parseColourPreference,
        parseConnections,
        parsePronouns,
        parseStatus,
        parseTimezone,
        planFieldWrite,
        formatStatusMessage,
        planLegacyStatusMirror,
        pronounsToText,
        readField,
        statusProblem,
        textToPronouns,
        type ExtendedProfile,
        type FieldKeys,
        type FieldOp,
        type ProfileConnection,
    } from "$lib/utils/extendedProfile";
    import {
        profileFieldAllowed,
        type Capabilities,
    } from "$lib/utils/serverCapabilities";

    interface Props {
        capabilities: Capabilities | null;
        displayName: string;
    }
    let { capabilities, displayName }: Props = $props();

    // `extProfile` is the last server copy; the draft values are what the
    // inputs edit. Each field is dirty when its draft differs from the copy.
    let extProfile = $state<ExtendedProfile | null>(null);
    let pronounsText = $state("");
    let statusText = $state("");
    let statusEmoji = $state("");
    let bioText = $state("");
    let timezoneText = $state("");
    let bannerMxc = $state<string | null>(null);
    let colourDark = $state<string | null>(null);
    let colourLight = $state<string | null>(null);
    let connectionRows = $state<ProfileConnection[]>([]);

    let emojiPickerOpen = $state(false);
    let bannerInput: HTMLInputElement | undefined = $state();
    let bannerUploading = $state(false);
    let busy = $state(false);
    let error = $state("");
    let saved = $state(false);

    const timezones = knownTimezones();

    const savedPronouns = $derived(
        parsePronouns(readField(extProfile, PROFILE_FIELDS.pronouns)),
    );
    const savedStatus = $derived(
        parseStatus(readField(extProfile, PROFILE_FIELDS.status)),
    );
    const savedBio = $derived(
        parseBiography(readField(extProfile, PROFILE_FIELDS.biography)),
    );
    const savedTimezone = $derived(
        parseTimezone(readField(extProfile, PROFILE_FIELDS.timezone)) ?? "",
    );
    const savedBanner = $derived(
        parseBanner(readField(extProfile, PROFILE_FIELDS.banner)),
    );
    const savedColour = $derived(
        parseColourPreference(
            readField(extProfile, PROFILE_FIELDS.usernameColour),
        ),
    );
    const savedConnections = $derived(
        parseConnections(readField(extProfile, PROFILE_FIELDS.connections)),
    );

    const allowed = (field: FieldKeys) =>
        profileFieldAllowed(field.unstable ?? field.stable, capabilities);

    const pronounsDirty = $derived(
        pronounsText.trim() !== pronounsToText(savedPronouns),
    );
    const statusDirty = $derived(
        statusText.trim() !== (savedStatus?.text ?? "") ||
            statusEmoji.trim() !== (savedStatus?.emoji ?? ""),
    );
    const bioDirty = $derived(bioText.trim() !== savedBio.trim());
    const timezoneDirty = $derived(timezoneText.trim() !== savedTimezone);
    const bannerDirty = $derived(bannerMxc !== savedBanner);
    const colourDirty = $derived(
        colourDark !== (savedColour?.on_dark ?? null) ||
            colourLight !== (savedColour?.on_light ?? null),
    );
    const connectionsDirty = $derived(
        JSON.stringify(buildConnections(connectionRows) ?? []) !==
            JSON.stringify(savedConnections),
    );

    const statusIssue = $derived(statusProblem(statusText, statusEmoji));
    const timezoneIssue = $derived(
        timezoneText.trim() && !parseTimezone(timezoneText)
            ? "Use a timezone name like Europe/London."
            : null,
    );
    const connectionsIssue = $derived(connectionsProblem(connectionRows));
    const problem = $derived(statusIssue ?? timezoneIssue ?? connectionsIssue);

    const dirty = $derived(
        (pronounsDirty && allowed(PROFILE_FIELDS.pronouns)) ||
            (statusDirty && allowed(PROFILE_FIELDS.status)) ||
            (bioDirty && allowed(PROFILE_FIELDS.biography)) ||
            (timezoneDirty && allowed(PROFILE_FIELDS.timezone)) ||
            (bannerDirty && allowed(PROFILE_FIELDS.banner)) ||
            (colourDirty && allowed(PROFILE_FIELDS.usernameColour)) ||
            (connectionsDirty && allowed(PROFILE_FIELDS.connections)),
    );

    const bannerSrc = $derived(mxcToHttp(bannerMxc, 480, 160, "crop"));

    function resetDrafts() {
        pronounsText = pronounsToText(savedPronouns);
        statusText = savedStatus?.text ?? "";
        statusEmoji = savedStatus?.emoji ?? "";
        bioText = savedBio;
        timezoneText = savedTimezone;
        bannerMxc = savedBanner;
        colourDark = savedColour?.on_dark ?? null;
        colourLight = savedColour?.on_light ?? null;
        connectionRows = savedConnections.map((c) => ({ ...c }));
    }

    function useBrowserTimezone() {
        timezoneText = Intl.DateTimeFormat().resolvedOptions().timeZone;
    }

    function chooseColour() {
        colourDark = DEFAULT_COLOUR_ON_DARK;
        colourLight = DEFAULT_COLOUR_ON_LIGHT;
    }

    function clearColour() {
        colourDark = null;
        colourLight = null;
    }

    async function selectBanner(event: Event) {
        const file = (event.currentTarget as HTMLInputElement).files?.[0];
        if (bannerInput) bannerInput.value = "";
        if (!file) return;
        bannerUploading = true;
        error = "";
        try {
            bannerMxc = await uploadContent(file);
        } catch (e) {
            error = (e as Error)?.message ?? "Banner upload failed";
        } finally {
            bannerUploading = false;
        }
    }

    function addConnection() {
        if (connectionRows.length >= MAX_CONNECTIONS) return;
        connectionRows = [...connectionRows, { description: "", uri: "" }];
    }

    function removeConnection(index: number) {
        connectionRows = connectionRows.filter((_, i) => i !== index);
    }

    async function save() {
        if (busy || !dirty || problem) return;
        busy = true;
        error = "";
        const ops: FieldOp[] = [];
        const plan = (
            field: FieldKeys,
            isDirty: boolean,
            value: unknown | null,
        ) => {
            if (isDirty && allowed(field)) {
                ops.push(...planFieldWrite(extProfile, field, value));
            }
        };
        const pronouns = textToPronouns(
            pronounsText,
            savedPronouns,
            navigator.language.split("-")[0] || "en",
        );
        plan(
            PROFILE_FIELDS.pronouns,
            pronounsDirty,
            pronouns.length ? pronouns : null,
        );
        const status = buildStatus(statusText, statusEmoji);
        plan(PROFILE_FIELDS.status, statusDirty, status);
        if (statusDirty && allowed(PROFILE_FIELDS.status)) {
            ops.push(...planLegacyStatusMirror(extProfile, status));
        }
        plan(PROFILE_FIELDS.biography, bioDirty, buildBiography(bioText));
        plan(
            PROFILE_FIELDS.timezone,
            timezoneDirty,
            parseTimezone(timezoneText),
        );
        plan(PROFILE_FIELDS.banner, bannerDirty, bannerMxc);
        plan(
            PROFILE_FIELDS.usernameColour,
            colourDirty,
            colourDark && colourLight
                ? { on_dark: colourDark, on_light: colourLight }
                : null,
        );
        plan(
            PROFILE_FIELDS.connections,
            connectionsDirty,
            buildConnections(connectionRows),
        );
        try {
            for (const op of ops) await setOwnProfileField(op.key, op.value);
            if (statusDirty && allowed(PROFILE_FIELDS.status)) {
                // Sable shows only the presence message. A server with
                // presence off must not fail the profile save.
                await changeOwnStatusMessage(formatStatusMessage(status)).catch(
                    () => {},
                );
            }
            extProfile = await fetchOwnExtendedProfile();
            if (auth.userId) setCachedProfile(auth.userId, extProfile);
            resetDrafts();
            saved = true;
            setTimeout(() => (saved = false), 2000);
        } catch (e) {
            error = (e as Error)?.message ?? "Failed to save profile fields";
        } finally {
            busy = false;
        }
    }

    $effect(() => {
        fetchOwnExtendedProfile()
            .then((profile) => {
                extProfile = profile;
                resetDrafts();
            })
            .catch(() => {
                extProfile = null;
            });
    });

    const inputClass =
        "w-full bg-discord-backgroundTertiary text-discord-textPrimary text-sm rounded px-3 py-2 outline-none";
    const smallButtonClass =
        "px-2 py-1 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover disabled:opacity-30 transition-colors";
</script>

{#if extProfile}
    <section class="space-y-4">
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
        >
            More about you
        </p>

        {#if allowed(PROFILE_FIELDS.banner)}
            <div>
                <span class="text-sm text-discord-textPrimary">Banner</span>
                {#if bannerSrc}
                    <img
                        src={bannerSrc}
                        alt="Your banner"
                        class="mt-1 h-20 w-full max-w-sm rounded object-cover"
                    />
                {/if}
                <div class="mt-1 flex gap-2">
                    <button
                        type="button"
                        onclick={() => bannerInput?.click()}
                        disabled={bannerUploading}
                        class="px-3 py-1.5 bg-discord-accent text-white rounded text-sm disabled:opacity-50"
                        >{bannerUploading
                            ? "Uploading…"
                            : "Change banner"}</button
                    >
                    {#if bannerMxc}
                        <button
                            type="button"
                            onclick={() => (bannerMxc = null)}
                            class="px-3 py-1.5 bg-discord-backgroundTertiary text-discord-textPrimary rounded text-sm"
                            >Remove</button
                        >
                    {/if}
                </div>
                <input
                    bind:this={bannerInput}
                    type="file"
                    accept="image/*"
                    onchange={selectBanner}
                    class="hidden"
                />
            </div>
        {/if}

        {#if allowed(PROFILE_FIELDS.call)}
            <div class="flex items-center gap-3">
                <div class="flex-1 min-w-0">
                    <p class="text-sm text-discord-textPrimary">
                        Show when I am in a call
                    </p>
                    <p class="text-xs text-discord-textMuted">
                        Adds "In a call" to your profile while you are connected
                        to a voice call, and removes it when you leave.
                    </p>
                </div>
                <ToggleSwitch
                    checked={settingsState.shareCallStatus}
                    onChange={setShareCallStatus}
                    label="Show when I am in a call"
                />
            </div>
        {/if}

        {#if allowed(PROFILE_FIELDS.pronouns)}
            <label class="block">
                <span class="text-sm text-discord-textPrimary">Pronouns</span>
                <input
                    bind:value={pronounsText}
                    placeholder="she/her, they/them"
                    class="mt-1 {inputClass}"
                />
                <span class="text-xs text-discord-textMuted"
                    >Separate with commas, most preferred first.</span
                >
            </label>
        {/if}

        {#if allowed(PROFILE_FIELDS.status)}
            <div>
                <span class="text-sm text-discord-textPrimary">Status</span>
                <div class="mt-1 flex gap-2">
                    <input
                        bind:value={statusEmoji}
                        maxlength={MAX_STATUS_EMOJI_LENGTH}
                        placeholder="🌴"
                        aria-label="Status emoji"
                        class="w-16 bg-discord-backgroundTertiary text-discord-textPrimary text-sm text-center rounded px-2 py-2 outline-none"
                    />
                    <button
                        type="button"
                        onclick={() => (emojiPickerOpen = !emojiPickerOpen)}
                        aria-label="Pick a status emoji"
                        aria-expanded={emojiPickerOpen}
                        class="px-2 rounded bg-discord-backgroundTertiary text-discord-textMuted hover:text-discord-textPrimary"
                    >
                        <Smile size={18} />
                    </button>
                    <input
                        bind:value={statusText}
                        maxlength={MAX_STATUS_TEXT_LENGTH}
                        placeholder="On holiday until the 23rd"
                        aria-label="Status text"
                        class="flex-1 bg-discord-backgroundTertiary text-discord-textPrimary text-sm rounded px-3 py-2 outline-none"
                    />
                </div>
                {#if emojiPickerOpen}
                    <div class="mt-2">
                        <EmojiPicker
                            unicodeOnly
                            onSelect={(emoji) => (statusEmoji = emoji)}
                            onClose={() => (emojiPickerOpen = false)}
                        />
                    </div>
                {/if}
                {#if statusIssue}<p class="mt-1 text-xs text-discord-danger">
                        {statusIssue}
                    </p>{/if}
            </div>
        {/if}

        {#if allowed(PROFILE_FIELDS.biography)}
            <label class="block">
                <span class="text-sm text-discord-textPrimary">Bio</span>
                <textarea
                    bind:value={bioText}
                    maxlength={MAX_BIOGRAPHY_LENGTH}
                    rows="4"
                    placeholder="Tell people about yourself"
                    class="mt-1 resize-y {inputClass}"
                ></textarea>
            </label>
        {/if}

        {#if allowed(PROFILE_FIELDS.timezone)}
            <div>
                <span class="text-sm text-discord-textPrimary">Timezone</span>
                <div class="mt-1 flex gap-2">
                    <input
                        bind:value={timezoneText}
                        list="profile-timezones"
                        placeholder="Europe/London"
                        aria-label="Timezone"
                        class="flex-1 bg-discord-backgroundTertiary text-discord-textPrimary text-sm rounded px-3 py-2 outline-none"
                    />
                    <button
                        type="button"
                        onclick={useBrowserTimezone}
                        class="px-3 py-1.5 bg-discord-backgroundTertiary text-discord-textPrimary rounded text-sm"
                        >Use mine</button
                    >
                </div>
                <datalist id="profile-timezones">
                    {#each timezones as zone (zone)}<option value={zone}
                        ></option>{/each}
                </datalist>
                {#if timezoneIssue}<p class="mt-1 text-xs text-discord-danger">
                        {timezoneIssue}
                    </p>{/if}
            </div>
        {/if}

        {#if allowed(PROFILE_FIELDS.usernameColour)}
            <div>
                <span class="text-sm text-discord-textPrimary"
                    >Username colour</span
                >
                {#if colourDark && colourLight}
                    <div class="mt-1 flex flex-wrap items-center gap-3">
                        <div class="flex items-center gap-2">
                            <input
                                type="color"
                                bind:value={colourDark}
                                aria-label="Username colour on dark themes"
                                class="w-10 h-8 rounded cursor-pointer"
                            />
                            <span
                                class="px-2 py-1 rounded text-sm font-medium"
                                style="background: #1e1f22; color: {colourDark}"
                                >{displayName || auth.userId}</span
                            >
                            <span class="text-xs text-discord-textMuted"
                                >dark themes</span
                            >
                        </div>
                        <div class="flex items-center gap-2">
                            <input
                                type="color"
                                bind:value={colourLight}
                                aria-label="Username colour on light themes"
                                class="w-10 h-8 rounded cursor-pointer"
                            />
                            <span
                                class="px-2 py-1 rounded text-sm font-medium"
                                style="background: #ffffff; color: {colourLight}"
                                >{displayName || auth.userId}</span
                            >
                            <span class="text-xs text-discord-textMuted"
                                >light themes</span
                            >
                        </div>
                        <button
                            type="button"
                            class={smallButtonClass}
                            onclick={clearColour}
                            title="Reset to default">✕</button
                        >
                    </div>
                {:else}
                    <div class="mt-1">
                        <button
                            type="button"
                            onclick={chooseColour}
                            class="px-3 py-1.5 bg-discord-backgroundTertiary text-discord-textPrimary rounded text-sm"
                            >Choose a colour</button
                        >
                    </div>
                {/if}
                <span class="text-xs text-discord-textMuted"
                    >One colour for dark themes and one for light, so your name
                    stays readable either way.</span
                >
            </div>
        {/if}

        {#if allowed(PROFILE_FIELDS.connections)}
            <div>
                <span class="text-sm text-discord-textPrimary">Links</span>
                <div class="mt-1 space-y-2">
                    {#each connectionRows as row, index (index)}
                        <div class="flex gap-2">
                            <input
                                bind:value={row.description}
                                maxlength={MAX_CONNECTION_DESCRIPTION}
                                placeholder="Label"
                                aria-label="Link label"
                                class="w-1/3 bg-discord-backgroundTertiary text-discord-textPrimary text-sm rounded px-3 py-2 outline-none"
                            />
                            <input
                                bind:value={row.uri}
                                placeholder="https://example.org"
                                aria-label="Link address"
                                class="flex-1 bg-discord-backgroundTertiary text-discord-textPrimary text-sm rounded px-3 py-2 outline-none"
                            />
                            <button
                                type="button"
                                class={smallButtonClass}
                                onclick={() => removeConnection(index)}
                                title="Remove link">✕</button
                            >
                        </div>
                    {/each}
                    <button
                        type="button"
                        onclick={addConnection}
                        disabled={connectionRows.length >= MAX_CONNECTIONS}
                        class="px-3 py-1.5 bg-discord-backgroundTertiary text-discord-textPrimary rounded text-sm disabled:opacity-50"
                        >Add link</button
                    >
                </div>
                {#if connectionsIssue}<p
                        class="mt-1 text-xs text-discord-danger"
                    >
                        {connectionsIssue}
                    </p>{/if}
            </div>
        {/if}

        <div class="flex items-center gap-3">
            <button
                onclick={save}
                disabled={busy || !dirty || !!problem || bannerUploading}
                class="px-4 py-2 bg-discord-accent text-white rounded text-sm disabled:opacity-50"
                >{busy ? "Saving…" : "Save"}</button
            >
            {#if error}<span class="text-xs text-discord-danger">{error}</span
                >{:else if saved}<span class="text-xs text-discord-textPositive"
                    >Saved</span
                >{/if}
        </div>
    </section>
{/if}
