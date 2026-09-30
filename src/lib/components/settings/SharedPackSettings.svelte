<script lang="ts">
    import { t } from "$lib/i18n";
    import {
        getJoinedRoomPacks,
        getStaleEmoteSubscriptions,
        getUserPackInfo,
        setPackGlobal,
        updateUserPackMeta,
        uploadContent,
        type CustomImagePack,
    } from "$lib/matrix/client";
    import { roomsState } from "$lib/stores/rooms.svelte";
    import { packKey } from "$lib/utils/imagePacks";

    // MSC2545 sharing: packs from rooms you are in can be enabled for every
    // room (im.ponies.emote_rooms); your own pack can carry a name, avatar and
    // attribution so people who copy from it can credit you.
    const view = $derived.by(() => {
        void roomsState.roomsTick;
        const packs = getJoinedRoomPacks();
        return {
            enabled: packs.filter((p) => p.global),
            available: packs.filter((p) => !p.global),
            stale: getStaleEmoteSubscriptions(),
            mine: getUserPackInfo(),
        };
    });

    let busy = $state<string | null>(null);
    let error = $state("");
    let query = $state("");
    let nameDraft = $state<string | null>(null);
    let attributionDraft = $state<string | null>(null);
    let avatarUploading = $state(false);

    const filtered = $derived(
        view.available.filter((pack) => {
            const q = query.trim().toLowerCase();
            return (
                !q ||
                pack.name.toLowerCase().includes(q) ||
                (pack.sourceName ?? "").toLowerCase().includes(q)
            );
        }),
    );

    async function toggle(roomId: string, stateKey: string, enabled: boolean) {
        busy = `${roomId}:${stateKey}`;
        error = "";
        try {
            await setPackGlobal(roomId, stateKey, enabled);
            roomsState.roomsTick++;
        } catch (err) {
            error =
                (err as Error)?.message ?? t("sharedPackSettings.failedToSave");
        } finally {
            busy = null;
        }
    }

    async function saveMine(update: Parameters<typeof updateUserPackMeta>[0]) {
        busy = "mine";
        error = "";
        try {
            await updateUserPackMeta(update);
            nameDraft = null;
            attributionDraft = null;
            roomsState.roomsTick++;
        } catch (err) {
            error =
                (err as Error)?.message ?? t("sharedPackSettings.failedToSave");
        } finally {
            busy = null;
        }
    }

    async function pickAvatar(e: Event) {
        const input = e.currentTarget as HTMLInputElement;
        const file = input.files?.[0];
        input.value = "";
        if (!file) return;
        avatarUploading = true;
        try {
            await saveMine({ avatarMxc: await uploadContent(file) });
        } catch (err) {
            error =
                (err as Error)?.message ?? t("sharedPackSettings.failedToSave");
        } finally {
            avatarUploading = false;
        }
    }
</script>

{#snippet packRow(pack: CustomImagePack, enabled: boolean)}
    <div
        class="flex items-center gap-3 p-2 rounded bg-discord-backgroundTertiary"
    >
        {#if pack.avatarUrl}
            <img
                src={pack.avatarUrl}
                alt=""
                class="w-8 h-8 rounded object-cover flex-shrink-0"
            />
        {/if}
        <div class="flex-1 min-w-0">
            <p class="text-sm text-discord-textPrimary truncate">
                {pack.name}
            </p>
            <p class="text-xs text-discord-textMuted truncate">
                {t("sharedPackSettings.packSummary", {
                    room: pack.sourceName ?? "",
                    count: pack.images.length,
                })}
            </p>
            {#if pack.attribution}
                <p class="text-xs text-discord-textMuted truncate">
                    {t("imagePackEditor.attribution", {
                        value: pack.attribution,
                    })}
                </p>
            {/if}
        </div>
        <button
            onclick={() => toggle(pack.roomId ?? "", packKey(pack), !enabled)}
            disabled={busy === `${pack.roomId}:${packKey(pack)}`}
            class="px-3 py-1.5 rounded text-xs font-semibold disabled:opacity-50 {enabled
                ? 'bg-discord-backgroundSecondary text-discord-textPrimary hover:bg-discord-messageHover'
                : 'bg-discord-accent hover:bg-discord-accentHover text-white'}"
        >
            {enabled
                ? t("sharedPackSettings.disable")
                : t("sharedPackSettings.enable")}
        </button>
    </div>
{/snippet}

<div class="space-y-6 mt-6">
    <section class="space-y-2">
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
        >
            {t("sharedPackSettings.yourPackDetails")}
        </p>
        <div class="grid gap-2 sm:grid-cols-2">
            <input
                value={nameDraft ?? view.mine.name}
                oninput={(e) => (nameDraft = e.currentTarget.value)}
                placeholder={t("imagePackEditor.packName")}
                class="min-w-0 bg-discord-backgroundTertiary text-discord-textPrimary placeholder-discord-textMuted text-sm rounded px-3 py-2 outline-none border border-transparent focus:border-discord-accent/50"
            />
            <input
                value={attributionDraft ?? view.mine.attribution ?? ""}
                oninput={(e) => (attributionDraft = e.currentTarget.value)}
                placeholder={t("imagePackEditor.attributionPlaceholder")}
                class="min-w-0 bg-discord-backgroundTertiary text-discord-textPrimary placeholder-discord-textMuted text-sm rounded px-3 py-2 outline-none border border-transparent focus:border-discord-accent/50"
            />
        </div>
        <div class="flex items-center gap-2">
            {#if view.mine.avatarUrl}
                <img
                    src={view.mine.avatarUrl}
                    alt=""
                    class="w-8 h-8 rounded object-cover"
                />
            {/if}
            <label
                class="cursor-pointer px-3 py-1.5 rounded bg-discord-backgroundTertiary hover:bg-discord-messageHover text-xs text-discord-textPrimary {avatarUploading
                    ? 'opacity-50 pointer-events-none'
                    : ''}"
            >
                {t("imagePackEditor.uploadPackAvatar")}
                <input
                    type="file"
                    accept="image/*"
                    class="hidden"
                    onchange={pickAvatar}
                />
            </label>
            {#if view.mine.avatarUrl}
                <button
                    onclick={() => saveMine({ avatarMxc: null })}
                    class="text-xs text-discord-textMuted hover:text-discord-textPrimary"
                >
                    {t("imagePackEditor.removePackAvatar")}
                </button>
            {/if}
            <span class="flex-1"></span>
            <button
                onclick={() =>
                    saveMine({
                        displayName: nameDraft ?? view.mine.name,
                        attribution:
                            attributionDraft ?? view.mine.attribution ?? "",
                    })}
                disabled={busy === "mine" ||
                    (nameDraft === null && attributionDraft === null)}
                class="px-3 py-1.5 rounded bg-discord-accent hover:bg-discord-accentHover text-white text-xs font-semibold disabled:opacity-50"
            >
                {t("common.save")}
            </button>
        </div>
    </section>

    {#if error}<p class="text-sm text-discord-danger">{error}</p>{/if}

    <section class="space-y-2">
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
        >
            {t("sharedPackSettings.enabledEverywhere")}
        </p>
        <p class="text-xs text-discord-textMuted">
            {t("sharedPackSettings.enabledEverywhereHint")}
        </p>
        {#each view.enabled as pack (pack.id)}
            {@render packRow(pack, true)}
        {/each}
        {#each view.stale as ref (ref.roomId + ref.stateKey)}
            <div
                class="flex items-center gap-3 p-2 rounded bg-discord-backgroundTertiary"
            >
                <div class="flex-1 min-w-0">
                    <p class="text-sm text-discord-textPrimary truncate">
                        {ref.stateKey || ref.roomId}
                    </p>
                    <p class="text-xs text-discord-textMuted truncate">
                        {t("sharedPackSettings.unavailable", {
                            room: ref.roomId,
                        })}
                    </p>
                </div>
                <button
                    onclick={() => toggle(ref.roomId, ref.stateKey, false)}
                    disabled={busy === `${ref.roomId}:${ref.stateKey}`}
                    class="px-3 py-1.5 rounded text-xs font-semibold bg-discord-backgroundSecondary text-discord-textPrimary hover:bg-discord-messageHover disabled:opacity-50"
                >
                    {t("sharedPackSettings.remove")}
                </button>
            </div>
        {/each}
        {#if view.enabled.length === 0 && view.stale.length === 0}
            <p class="text-sm text-discord-textMuted text-center py-2">
                {t("sharedPackSettings.noneEnabled")}
            </p>
        {/if}
    </section>

    <section class="space-y-2">
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
        >
            {t("sharedPackSettings.availableInYourRooms")}
        </p>
        <input
            bind:value={query}
            placeholder={t("sharedPackSettings.searchPacks")}
            class="w-full bg-discord-backgroundTertiary text-discord-textPrimary placeholder-discord-textMuted text-sm rounded px-3 py-2 outline-none border border-transparent focus:border-discord-accent/50"
        />
        {#each filtered as pack (pack.id)}
            {@render packRow(pack, false)}
        {/each}
        {#if filtered.length === 0}
            <p class="text-sm text-discord-textMuted text-center py-2">
                {t("sharedPackSettings.noPacksFound")}
            </p>
        {/if}
    </section>
</div>
