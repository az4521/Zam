<script lang="ts">
    import {
        createRoom,
        createSpace,
        createDirectMessage,
        joinRoomByAlias,
        knockRoom,
        canAddRoomToSpace,
        getRoom,
        retryRoomFollowUp,
    } from "$lib/matrix/client";
    import { showErrorToast } from "$lib/stores/toasts.svelte";
    import type { RoomFollowUp } from "$lib/utils/roomCreationOutcome";
    import { isCryptoAvailable, isRoomEncrypted } from "$lib/matrix/crypto";
    import { shouldOfferKnock, matrixErrorMessage } from "$lib/utils/knock";
    import { settingsState } from "$lib/stores/settings.svelte";
    import { setActiveRoom } from "$lib/stores/rooms.svelte";
    import {
        interfaceState,
        openModal,
        closeModal,
    } from "$lib/stores/interface.svelte";
    import Portal from "$lib/components/ui/Portal.svelte";
    import UserPicker from "$lib/components/ui/UserPicker.svelte";

    type Mode = "create-room" | "create-space" | "create-dm" | "join-room";

    interface Props {
        /** If set, new rooms are created inside this space */
        spaceId?: string;
        /** Called after an action button is clicked (e.g. to close a dropdown) */
        onaction?: () => void;
    }
    let { spaceId, onaction }: Props = $props();

    let mode = $state<Mode | null>(null);
    let input1 = $state(""); // room name / space name / user id / room address
    let input2 = $state(""); // room topic / space topic
    let loading = $state(false);
    let error = $state("");
    // Encryption toggle for create-room / create-dm. Only offered when crypto
    // started this session (encrypting a room we can't decrypt is a foot-gun).
    let encrypt = $state(false);
    // Video-room toggle for create-room. Orthogonal to encryption, so it is
    // offered whether or not crypto started this session.
    let videoRoom = $state(false);
    const cryptoReady = isCryptoAvailable();

    // When encryption is requested but an *existing* (plaintext) DM is reused,
    // createDirectMessage deliberately won't retroactively encrypt it. Surface
    // that here instead of silently opening a DM the user asked to encrypt.
    let notice = $state("");
    let noticeRoomId = $state<string | null>(null);

    // A created room whose follow-up write failed: the room is real, so we open
    // it and offer a retry of ONLY the failed step. Reporting a failure here
    // would send the user back to the form to create a duplicate (TX-01).
    function surfaceFollowUp(followUp: RoomFollowUp) {
        if (followUp.status !== "failed") return;
        const task = followUp.task;
        showErrorToast(followUp.message, {
            label: "Retry",
            run: () => {
                void retryRoomFollowUp(task).then((out) => {
                    if (out.status === "failed") surfaceFollowUp(out);
                });
            },
        });
    }

    async function startDm(userId: string) {
        error = "";
        notice = "";
        noticeRoomId = null;
        loading = true;
        try {
            const wantEncrypted = cryptoReady && encrypt;
            const { roomId, followUp } = await createDirectMessage(
                userId,
                wantEncrypted,
            );
            if (wantEncrypted && !isRoomEncrypted(getRoom(roomId))) {
                notice =
                    "You already have a direct message with this user, and it isn't encrypted. Encryption can't be added automatically — open it and turn it on from the room's Security settings.";
                noticeRoomId = roomId;
                surfaceFollowUp(followUp);
                loading = false;
                return;
            }
            surfaceFollowUp(followUp);
            setActiveRoom(roomId);
            close();
        } catch (e: any) {
            error = e?.data?.error ?? e?.message ?? "Something went wrong";
        } finally {
            loading = false;
        }
    }

    function openNoticeRoom() {
        if (noticeRoomId) {
            setActiveRoom(noticeRoomId);
            close();
        }
    }

    // Knock-to-join flow (join-room mode only)
    let knockOffered = $state(false);
    let knockReason = $state("");
    let knockSent = $state(false);

    function resetKnock() {
        knockOffered = false;
        knockReason = "";
        knockSent = false;
    }

    function open(m: Mode) {
        onaction?.();
        // Claim first — a same-id handover runs the outgoing close, which nulls mode.
        openModal("quick-actions", () => (mode = null));
        mode = m;
        input1 = "";
        input2 = "";
        error = "";
        notice = "";
        noticeRoomId = null;
        // New DMs pre-check the account default; new rooms default off.
        encrypt = m === "create-dm" ? settingsState.encryptNewDms : false;
        videoRoom = false;
        resetKnock();
    }

    function close() {
        closeModal();
    }

    async function submit() {
        error = "";
        loading = true;
        try {
            let roomId: string;
            let followUp: RoomFollowUp = { status: "none" };
            if (mode === "create-room") {
                const created = await createRoom(
                    input1.trim(),
                    input2.trim(),
                    spaceId,
                    cryptoReady && encrypt,
                    videoRoom,
                );
                roomId = created.roomId;
                followUp = created.followUp;
            } else if (mode === "create-space") {
                roomId = await createSpace(input1.trim(), input2.trim());
            } else {
                const alias = input1.trim();
                if (!alias.startsWith("#") && !alias.startsWith("!")) {
                    error =
                        "Enter a room address (#room:server.com) or room ID (!id:server.com)";
                    return;
                }
                roomId = await joinRoomByAlias(alias);
            }
            surfaceFollowUp(followUp);
            setActiveRoom(roomId);
            close();
        } catch (e: any) {
            error = e?.data?.error ?? e?.message ?? "Something went wrong";
            if (mode === "join-room" && shouldOfferKnock(e, undefined)) {
                knockOffered = true;
            }
        } finally {
            loading = false;
        }
    }

    async function submitKnock() {
        error = "";
        loading = true;
        try {
            await knockRoom(input1.trim(), knockReason);
            knockSent = true;
        } catch (e) {
            error = matrixErrorMessage(e, "Could not send the join request");
        } finally {
            loading = false;
        }
    }

    function onKeydown(e: KeyboardEvent) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (mode === "join-room" && knockSent) close();
            else if (mode === "join-room" && knockOffered) submitKnock();
            else if (mode !== "create-dm") submit();
        }
    }
</script>

<!-- Action buttons -->
<div class="flex flex-col">
    {#if !spaceId}
        <button
            onclick={() => open("create-dm")}
            class="w-full flex items-center gap-2 pr-2 py-1.5 text-left text-sm text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
            style="padding-left: 0.5rem;"
        >
            <svg
                class="w-4 h-4 flex-shrink-0 opacity-70"
                fill="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"
                />
            </svg>
            <span class="flex-1 truncate">New DM</span>
        </button>
    {/if}
    {#if !spaceId || canAddRoomToSpace(spaceId)}
        <button
            onclick={() => open("create-room")}
            class="w-full flex items-center gap-2 pr-2 py-1.5 text-left text-sm text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
            style="padding-left: 0.5rem;"
        >
            <svg
                class="w-4 h-4 flex-shrink-0 opacity-70"
                fill="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"
                />
            </svg>
            <span class="flex-1 truncate"
                >{spaceId ? "Create room in space" : "Create new room"}</span
            >
        </button>
    {/if}
    {#if !spaceId}
        <button
            onclick={() => open("create-space")}
            class="w-full flex items-center gap-2 pr-2 py-1.5 text-left text-sm text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
            style="padding-left: 0.5rem;"
        >
            <svg
                class="w-4 h-4 flex-shrink-0 opacity-70"
                fill="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"
                />
            </svg>
            <span class="flex-1 truncate">Create new space</span>
        </button>
        <button
            onclick={() => open("join-room")}
            class="w-full flex items-center gap-2 pr-2 py-1.5 text-left text-sm text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
            style="padding-left: 0.5rem;"
        >
            <svg
                class="w-4 h-4 flex-shrink-0 opacity-70"
                fill="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    d="M11 7 9.6 8.4l2.6 2.6H2v2h10.2l-2.6 2.6L11 17l5-5-5-5zm9 12h-8v2h8c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-8v2h8v14z"
                />
            </svg>
            <span class="flex-1 truncate">Join room by address</span>
        </button>
    {/if}
</div>

<!-- Modal -->
<Portal>
    {#if interfaceState.modal === "quick-actions" && mode !== null}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onclick={close}
        >
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
                class="bg-discord-background rounded-lg shadow-xl w-full max-w-md mx-4 p-6 flex flex-col gap-4"
                onclick={(e) => e.stopPropagation()}
                onkeydown={onKeydown}
            >
                <h2 class="text-lg font-bold text-discord-textPrimary">
                    {#if mode === "create-room"}{spaceId
                            ? "Create room in space"
                            : "Create a room"}
                    {:else if mode === "create-space"}Create a space
                    {:else if mode === "create-dm"}New direct message
                    {:else}Join a room
                    {/if}
                </h2>

                {#if mode === "create-room" || mode === "create-space"}
                    <div class="flex flex-col gap-3">
                        <div>
                            <!-- svelte-ignore a11y_label_has_associated_control -->
                            <label
                                class="block text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1.5"
                            >
                                {mode === "create-space"
                                    ? "Space name"
                                    : "Room name"}
                            </label>
                            <input
                                bind:value={input1}
                                placeholder={mode === "create-space"
                                    ? "My Space"
                                    : "my-room"}
                                class="w-full px-3 py-2 bg-discord-backgroundSecondary text-discord-textPrimary placeholder-discord-textMuted rounded border border-discord-divider focus:border-discord-accent focus:outline-none text-sm"
                            />
                        </div>
                        <div>
                            <!-- svelte-ignore a11y_label_has_associated_control -->
                            <label
                                class="block text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1.5"
                            >
                                Topic <span class="normal-case font-normal"
                                    >(optional)</span
                                >
                            </label>
                            <input
                                bind:value={input2}
                                placeholder={mode === "create-space"
                                    ? "What's this space about?"
                                    : "What's this room about?"}
                                class="w-full px-3 py-2 bg-discord-backgroundSecondary text-discord-textPrimary placeholder-discord-textMuted rounded border border-discord-divider focus:border-discord-accent focus:outline-none text-sm"
                            />
                        </div>
                        {#if mode === "create-room"}
                            <label
                                class="flex items-start gap-2.5 cursor-pointer"
                            >
                                <input
                                    type="checkbox"
                                    bind:checked={videoRoom}
                                    class="mt-0.5 accent-discord-accent"
                                />
                                <span class="text-sm text-discord-textPrimary"
                                    >Video room
                                    <span
                                        class="block text-xs text-discord-textMuted"
                                        >Opens straight into a call. Messages
                                        still work.</span
                                    ></span
                                >
                            </label>
                        {/if}
                        {#if mode === "create-room" && cryptoReady}
                            <label
                                class="flex items-start gap-2.5 cursor-pointer"
                            >
                                <input
                                    type="checkbox"
                                    bind:checked={encrypt}
                                    class="mt-0.5 accent-discord-accent"
                                />
                                <span class="text-sm text-discord-textPrimary"
                                    >Enable encryption
                                    <span
                                        class="block text-xs text-discord-textMuted"
                                        >Can't be turned off later.</span
                                    ></span
                                >
                            </label>
                        {/if}
                    </div>
                {:else if mode === "create-dm"}
                    <div class="flex flex-col gap-3">
                        <UserPicker
                            mode="single"
                            autofocus
                            disabled={loading}
                            onpick={startDm}
                            placeholder="Find someone to message…"
                        />
                        {#if cryptoReady}
                            <label
                                class="flex items-start gap-2.5 cursor-pointer"
                            >
                                <input
                                    type="checkbox"
                                    bind:checked={encrypt}
                                    class="mt-0.5 accent-discord-accent"
                                />
                                <span class="text-sm text-discord-textPrimary"
                                    >Encrypt this DM
                                    <span
                                        class="block text-xs text-discord-textMuted"
                                        >Can't be turned off later.</span
                                    ></span
                                >
                            </label>
                        {/if}
                        {#if notice}
                            <div
                                class="rounded bg-discord-warning/10 border border-discord-warning/30 px-3 py-2 space-y-2"
                            >
                                <p class="text-xs text-discord-warning">
                                    {notice}
                                </p>
                                <button
                                    onclick={openNoticeRoom}
                                    class="px-3 py-1.5 bg-discord-messageHover text-discord-textPrimary rounded text-xs"
                                    >Open the DM</button
                                >
                            </div>
                        {/if}
                    </div>
                {:else}
                    <div class="flex flex-col gap-3">
                        <div>
                            <!-- svelte-ignore a11y_label_has_associated_control -->
                            <label
                                class="block text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1.5"
                                >Room address or ID</label
                            >
                            <input
                                bind:value={input1}
                                oninput={() => {
                                    resetKnock();
                                    error = "";
                                }}
                                placeholder="#room:server.com"
                                class="w-full px-3 py-2 bg-discord-backgroundSecondary text-discord-textPrimary placeholder-discord-textMuted rounded border border-discord-divider focus:border-discord-accent focus:outline-none text-sm"
                            />
                        </div>
                        {#if knockSent}
                            <p class="text-sm text-discord-textSecondary">
                                Request sent — you'll be able to join once
                                someone lets you in.
                            </p>
                        {:else if knockOffered}
                            <div>
                                <p
                                    class="text-sm text-discord-textMuted mb-1.5"
                                >
                                    You can't join this room directly, but you
                                    can request to join it.
                                </p>
                                <input
                                    bind:value={knockReason}
                                    placeholder="Reason (optional)"
                                    class="w-full px-3 py-2 bg-discord-backgroundSecondary text-discord-textPrimary placeholder-discord-textMuted rounded border border-discord-divider focus:border-discord-accent focus:outline-none text-sm"
                                />
                            </div>
                        {/if}
                    </div>
                {/if}

                {#if error}
                    <p class="text-sm text-discord-danger">{error}</p>
                {/if}

                <div class="flex justify-end gap-2 mt-1">
                    <button
                        onclick={close}
                        disabled={loading}
                        class="px-4 py-2 rounded text-sm font-medium text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors disabled:opacity-50"
                        >{mode === "join-room" && knockSent
                            ? "Close"
                            : "Cancel"}</button
                    >
                    {#if mode === "join-room" && knockSent}
                        <!-- Request already sent; nothing left to submit -->
                    {:else if mode === "join-room" && knockOffered}
                        <button
                            onclick={submitKnock}
                            disabled={loading || !input1.trim()}
                            class="px-4 py-2 rounded text-sm font-semibold bg-discord-accent hover:bg-discord-accentHover text-white transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {#if loading}
                                <div
                                    class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                                ></div>
                            {/if}
                            Request to join
                        </button>
                    {:else if mode !== "create-dm"}
                        <button
                            onclick={submit}
                            disabled={loading || !input1.trim()}
                            class="px-4 py-2 rounded text-sm font-semibold bg-discord-accent hover:bg-discord-accentHover text-white transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {#if loading}
                                <div
                                    class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                                ></div>
                            {/if}
                            {#if mode === "create-room"}Create
                            {:else if mode === "create-space"}Create
                            {:else}Join
                            {/if}
                        </button>
                    {/if}
                </div>
            </div>
        </div>
    {/if}
</Portal>
