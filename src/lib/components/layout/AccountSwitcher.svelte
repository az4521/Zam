<script lang="ts">
    import { goto } from "$app/navigation";
    import {
        Check,
        ChevronLeft,
        ChevronRight,
        Pencil,
        SmilePlus,
        Users,
    } from "lucide-svelte";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import ModalDialog from "$lib/components/ui/ModalDialog.svelte";
    import OwnStatusEditor from "$lib/components/layout/OwnStatusEditor.svelte";
    import Portal from "$lib/components/ui/Portal.svelte";
    import {
        accountsState,
        switchActive,
        removeAccountById,
    } from "$lib/stores/accounts.svelte";
    import { auth } from "$lib/stores/auth.svelte";
    import {
        interfaceState,
        closeModal,
        openAppSettingsTab,
    } from "$lib/stores/interface.svelte";
    import {
        getOwnAvatarUrl,
        getOwnDisplayName,
        leaveVoiceCall,
        mxcToHttp,
    } from "$lib/matrix/client";
    import { deleteCryptoStore } from "$lib/matrix/crypto";
    import {
        changeOwnPresence,
        presenceFor,
        presenceState,
    } from "$lib/stores/presence.svelte";
    import {
        getCachedProfile,
        nameColourFor,
        requestProfile,
    } from "$lib/stores/profileFields.svelte";
    import { roomsState } from "$lib/stores/rooms.svelte";
    import { settingsState } from "$lib/stores/settings.svelte";
    import {
        PROFILE_FIELDS,
        formatStatusMessage,
        parseBanner,
        parsePronouns,
        parseStatus,
        pronounsToText,
        readFieldWithLegacy,
    } from "$lib/utils/extendedProfile";
    import { clearAllNotificationSurfaces } from "$lib/utils/notificationSurfaces";
    import { renderPlainTextWithTwemoji } from "$lib/utils/twemojiText";
    import {
        OWN_PRESENCE_OPTIONS,
        presenceDot,
        presenceDotClass,
        presenceLabel,
        type PresenceState,
    } from "$lib/utils/presence";

    interface Props {
        onClose: () => void;
        /** Existing app-shell logout flow (used for the active account). */
        onLogout: () => void;
    }
    let { onClose, onLogout }: Props = $props();

    // Which sub-view is showing. Desktop opens "presence" and "accounts" as
    // flyouts beside the card (Discord style); touch drills into them in place.
    // "status" is the inline status editor on both.
    type View = "main" | "status" | "presence" | "accounts";
    let view = $state<View>("main");
    const isTouch = $derived(interfaceState.isTouchscreen);

    // Two-click confirm for the destructive per-row sign-out.
    let confirmSignOutId = $state<string | null>(null);
    let presenceError = $state("");

    const me = $derived(auth.userId ?? "");
    $effect(() => {
        if (me) requestProfile(me);
    });
    const profile = $derived(getCachedProfile(me));
    const field = (key: keyof typeof PROFILE_FIELDS) =>
        readFieldWithLegacy(profile, PROFILE_FIELDS[key]);
    const status = $derived(parseStatus(field("status")));
    const pronouns = $derived(pronounsToText(parsePronouns(field("pronouns"))));
    const bannerSrc = $derived(
        mxcToHttp(parseBanner(field("banner")), 320, 96, "crop"),
    );
    const nameColour = $derived(nameColourFor(me));
    const displayName = $derived(
        (void roomsState.roomsTick, getOwnDisplayName() ?? me),
    );
    const avatarSrc = $derived((void roomsState.roomsTick, getOwnAvatarUrl()));
    const presenceValue = $derived.by((): PresenceState => {
        void presenceState.presenceTick;
        return (
            (me ? presenceFor(me)?.state : undefined) ??
            settingsState.ownPresence
        );
    });

    function serverHost(url: string): string {
        try {
            return new URL(url).hostname;
        } catch {
            return url;
        }
    }

    function open(next: View): void {
        view = next;
    }

    /** Desktop hover opens a flyout; leaving to a plain row closes it. */
    function hoverView(next: View): void {
        if (!isTouch && view !== "status") view = next;
    }

    function editProfile(): void {
        openAppSettingsTab("account");
    }

    async function setPresence(value: PresenceState): Promise<void> {
        presenceError = "";
        try {
            await changeOwnPresence(value);
            view = "main";
        } catch (e) {
            presenceError = (e as Error)?.message ?? "Could not set presence";
        }
    }

    async function switchTo(userId: string): Promise<void> {
        if (userId === auth.userId) {
            onClose();
            return;
        }
        // The account we are leaving must not keep notifications on screen —
        // after the reload they would be sitting above a different account's
        // session with a deep link to a room it may not even be in. Before the
        // bounded leave below, so a hung leave cannot leave them up for three
        // seconds and then across the reload.
        clearAllNotificationSurfaces();
        // A hard reload would strand our MatrixRTC membership as a ghost
        // participant (up to 4h — no MSC4140 on continuwuity). Leave first,
        // bounded so a hung leave can't block the switch.
        await Promise.race([
            // Swallowed deliberately: leaveVoiceCall fans out to component
            // subscriber callbacks and can re-throw a previous leave's
            // rejection. A rejection here would skip switchActive() and the
            // reload, stranding the switch — with the notification latch above
            // already set, so the session continues with popups dead and no
            // error anywhere. A failed leave is worth a ghost participant.
            leaveVoiceCall().catch(() => {}),
            new Promise((resolve) => setTimeout(resolve, 3000)),
        ]);
        switchActive(userId);
        // Full reload: the session-restore path boots the account with
        // clean stores (no cross-account state survives).
        window.location.assign("/");
    }

    function addAccount(): void {
        onClose();
        goto("/?add");
    }

    async function signOut(userId: string): Promise<void> {
        if (confirmSignOutId !== userId) {
            confirmSignOutId = userId;
            return;
        }
        confirmSignOutId = null;
        if (userId === auth.userId) {
            onClose();
            onLogout();
            return;
        }
        const account = accountsState.registry.accounts.find(
            (a) => a.userId === userId,
        );
        if (!account) return;
        // Best-effort server-side token invalidation (spec-compliant
        // servers drop the token's pushers with it). Local removal happens
        // regardless — the account leaves this device either way.
        try {
            await fetch(
                `${account.homeserverUrl.replace(/\/$/, "")}/_matrix/client/v3/logout`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${account.accessToken}`,
                    },
                },
            );
        } catch {
            // ignore — server unreachable; token stays valid server-side
        }
        // Wipe this account's rust-crypto store on its way off the device — it
        // has no live client, so we delete the IndexedDB directly (keyed to
        // this account, so it can't touch the active session's keys).
        await deleteCryptoStore(account.userId, account.deviceId);
        removeAccountById(userId);
    }

    const rowClass =
        "w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm text-discord-textPrimary hover:bg-discord-messageHover transition-colors rounded-[inherit]";
    const groupClass =
        "mx-2 mt-2 rounded-lg bg-discord-backgroundTertiary/60 divide-y divide-discord-divider";
    const flyoutClass =
        "absolute left-full bottom-0 ml-2 w-64 rounded-lg bg-discord-backgroundSecondary border border-discord-divider shadow-xl p-1.5 z-10";
</script>

{#snippet presenceMenu()}
    {#each OWN_PRESENCE_OPTIONS as option (option.value)}
        <button
            type="button"
            onclick={() => setPresence(option.value)}
            class="w-full flex items-center gap-3 p-2 rounded text-left hover:bg-discord-messageHover transition-colors"
        >
            <span
                class="w-3 h-3 rounded-full flex-shrink-0 {presenceDotClass(
                    presenceDot(option.value),
                )}"
            ></span>
            <span class="flex-1 min-w-0">
                <span class="block text-sm text-discord-textPrimary"
                    >{option.label}</span
                >
                <span class="block text-xs text-discord-textMuted"
                    >{option.description}</span
                >
            </span>
            {#if presenceValue === option.value}
                <Check size={16} class="text-discord-accent flex-shrink-0" />
            {/if}
        </button>
    {/each}
    {#if presenceError}<p class="px-2 py-1 text-xs text-discord-danger">
            {presenceError}
        </p>{/if}
{/snippet}

{#snippet accountsMenu()}
    {#each accountsState.registry.accounts as account (account.userId)}
        {@const isActive = account.userId === auth.userId}
        <div
            class="group/account flex items-center gap-2 rounded hover:bg-discord-messageHover transition-colors"
        >
            <button
                onclick={() => switchTo(account.userId)}
                class="flex-1 flex items-center gap-2.5 p-2 min-w-0 text-left"
            >
                <Avatar
                    src={account.avatarUrl ?? null}
                    name={account.displayName ?? account.userId}
                    id={account.userId}
                    size={32}
                />
                <span class="flex-1 min-w-0">
                    <span
                        class="block text-sm text-discord-textPrimary truncate"
                        >{account.displayName ?? account.userId}</span
                    >
                    <span class="block text-xs text-discord-textMuted truncate"
                        >{serverHost(account.homeserverUrl)}</span
                    >
                </span>
                {#if isActive}
                    <Check
                        size={16}
                        class="text-discord-accent flex-shrink-0"
                    />
                {/if}
            </button>
            <!-- `group-focus-within/account:opacity-100` is the keyboard
                 analogue of the row-hover reveal below it. Without it the
                 focus trap makes this destructive control the second tab
                 stop while `opacity-0` hides both it and its focus ring. -->
            <button
                onclick={() => signOut(account.userId)}
                class="flex-shrink-0 px-2 py-1 mr-1 rounded text-xs font-medium transition-colors {confirmSignOutId ===
                account.userId
                    ? 'bg-discord-danger text-white'
                    : 'text-discord-textMuted hover:text-discord-danger opacity-0 group-hover/account:opacity-100 group-focus-within/account:opacity-100'} {isTouch
                    ? '!opacity-100'
                    : ''}"
                title="Sign out {account.userId}"
            >
                {confirmSignOutId === account.userId ? "Confirm" : "Sign out"}
            </button>
        </div>
    {/each}

    <div class="my-1 border-t border-discord-divider"></div>

    <button
        onclick={addAccount}
        class="w-full flex items-center gap-2.5 p-2 rounded hover:bg-discord-messageHover text-left transition-colors"
    >
        <span
            class="w-8 h-8 rounded-full bg-discord-backgroundTertiary flex items-center justify-center text-discord-accent text-lg font-bold flex-shrink-0"
            >+</span
        >
        <span class="text-sm text-discord-textPrimary">Add account</span>
    </button>
{/snippet}

<Portal>
    <!--
      Anchored popover on desktop, bottom sheet on touch — not a centred
      dialog, so the layer gets no flex centring and the panel is positioned
      `absolute` INSIDE the shell's `fixed inset-0` layer. That layer spans the
      viewport, so `bottom-16 left-2` / `inset-x-0 bottom-0` resolve exactly
      where the old `fixed` panel sat. The backdrop stays invisible on desktop
      (it is only a light-dismiss click catcher) and keeps its scrim on touch.
      `cursor-default` on that invisible branch only: the shell's backdrop is a
      real <button>, and preflight's `button{cursor:pointer}` would otherwise
      turn the whole viewport into a pointer region with nothing visible under
      it. The dimmed touch scrim keeps the pointer cursor, which is correct.
      There is no heading element, so the dialog is named directly. Flyouts and
      the emoji picker are absolutely positioned off this panel, so it must not
      clip its overflow.
    -->
    <ModalDialog
        onClose={closeModal}
        label="Account menu"
        layerClass="z-50"
        backdropClass={isTouch ? "bg-black/40" : "cursor-default"}
        panelClass="absolute bg-discord-backgroundSecondary border border-discord-divider shadow-xl {isTouch
            ? 'inset-x-0 bottom-0 rounded-t-lg pb-4 max-h-[85dvh] overflow-y-auto'
            : 'bottom-16 left-2 w-80 rounded-lg pb-2'}"
        closeLabel="Close account menu"
    >
        {#if isTouch && (view === "presence" || view === "accounts" || view === "status")}
            <div class="p-2">
                <button
                    type="button"
                    onclick={() => open("main")}
                    class="flex items-center gap-1 px-2 py-1.5 text-sm text-discord-textMuted hover:text-discord-textPrimary"
                >
                    <ChevronLeft size={16} /> Back
                </button>
                {#if view === "presence"}{@render presenceMenu()}{:else if view === "accounts"}{@render accountsMenu()}{:else}<div
                        class="px-2 pt-1"
                    >
                        <OwnStatusEditor onDone={() => open("main")} />
                    </div>{/if}
            </div>
        {:else}
            <!-- Profile card header -->
            {#if bannerSrc}
                <img
                    src={bannerSrc}
                    alt=""
                    class="h-24 w-full object-cover rounded-t-lg"
                />
            {:else}
                <div class="h-24 rounded-t-lg bg-discord-accent"></div>
            {/if}

            <div class="px-4">
                <div class="flex items-start gap-2">
                    <div
                        class="relative -mt-10 w-fit flex-shrink-0 rounded-full border-[5px] border-discord-backgroundSecondary"
                    >
                        <Avatar
                            src={avatarSrc}
                            name={displayName}
                            id={me}
                            size={80}
                        />
                        <span
                            title={presenceLabel(presenceValue)}
                            class="absolute bottom-0.5 right-0.5 w-5 h-5 rounded-full border-4 border-discord-backgroundSecondary {presenceDotClass(
                                presenceDot(presenceValue),
                            )}"
                        ></span>
                    </div>
                    <button
                        type="button"
                        onclick={() =>
                            open(view === "status" ? "main" : "status")}
                        class="mt-1 max-w-[11rem] flex items-center gap-2 rounded-2xl bg-discord-backgroundTertiary/80 hover:bg-discord-messageHover px-3 py-2 text-left text-sm text-discord-textSecondary transition-colors"
                        title="Set your status"
                    >
                        {#if status}
                            <span class="truncate"
                                >{@html renderPlainTextWithTwemoji(
                                    formatStatusMessage(status),
                                )}</span
                            >
                        {:else}
                            <SmilePlus size={16} class="flex-shrink-0" />
                            <span class="italic truncate">Set a status</span>
                        {/if}
                    </button>
                </div>

                <p
                    class="mt-2 text-xl font-bold text-discord-textPrimary truncate"
                    style:color={nameColour}
                >
                    {displayName}
                </p>
                <p class="text-sm text-discord-textSecondary truncate">
                    {me}{@html pronouns
                        ? ` • ${renderPlainTextWithTwemoji(pronouns)}`
                        : ""}
                </p>
            </div>

            {#if view === "status"}
                <div class="mx-4 mt-3">
                    <button
                        type="button"
                        onclick={() => open("main")}
                        class="-ml-1 mb-2 flex items-center gap-1 px-1 py-1 text-sm text-discord-textMuted hover:text-discord-textPrimary"
                    >
                        <ChevronLeft size={16} /> Back
                    </button>
                    <OwnStatusEditor onDone={() => open("main")} />
                </div>
            {:else}
                <div class={groupClass}>
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="first:rounded-t-lg last:rounded-b-lg"
                        onmouseenter={() => hoverView("main")}
                    >
                        <button
                            type="button"
                            onclick={editProfile}
                            class={rowClass}
                        >
                            <Pencil size={18} class="text-discord-textMuted" />
                            <span class="flex-1">Edit Profile</span>
                        </button>
                    </div>
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="relative first:rounded-t-lg last:rounded-b-lg"
                        onmouseenter={() => hoverView("presence")}
                    >
                        <button
                            type="button"
                            onclick={() =>
                                open(view === "presence" ? "main" : "presence")}
                            aria-expanded={view === "presence"}
                            class={rowClass}
                        >
                            <span
                                class="w-3 h-3 rounded-full ml-0.5 mr-0.5 flex-shrink-0 {presenceDotClass(
                                    presenceDot(presenceValue),
                                )}"
                            ></span>
                            <span class="flex-1"
                                >{presenceLabel(presenceValue)}</span
                            >
                            <ChevronRight
                                size={16}
                                class="text-discord-textMuted"
                            />
                        </button>
                        {#if view === "presence" && !isTouch}
                            <div class={flyoutClass}>
                                {@render presenceMenu()}
                            </div>
                        {/if}
                    </div>
                </div>

                <div class={groupClass}>
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="relative first:rounded-t-lg last:rounded-b-lg"
                        onmouseenter={() => hoverView("accounts")}
                    >
                        <button
                            type="button"
                            onclick={() =>
                                open(view === "accounts" ? "main" : "accounts")}
                            aria-expanded={view === "accounts"}
                            class={rowClass}
                        >
                            <Users size={18} class="text-discord-textMuted" />
                            <span class="flex-1">Switch Accounts</span>
                            <ChevronRight
                                size={16}
                                class="text-discord-textMuted"
                            />
                        </button>
                        {#if view === "accounts" && !isTouch}
                            <div class={flyoutClass}>
                                {@render accountsMenu()}
                            </div>
                        {/if}
                    </div>
                </div>
            {/if}
        {/if}
    </ModalDialog>
</Portal>
