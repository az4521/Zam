<script lang="ts">
    import { untrack } from "svelte";
    import { t } from "$lib/i18n";
    import {
        getOwnDisplayName,
        getOwnRoomNickname,
        setOwnRoomNickname,
        setOwnSpaceNickname,
    } from "$lib/matrix/client";
    import { showErrorToast } from "$lib/stores/toasts.svelte";

    let { roomId, isSpace = false }: { roomId: string; isSpace?: boolean } =
        $props();

    let input = $state("");
    let globalName = $state(untrack(() => getOwnDisplayName() ?? ""));
    let saving = $state(false);
    let saved = $state(false);
    let savedTimeout: ReturnType<typeof setTimeout> | undefined;

    // Re-seed the input whenever the room changes under a mounted panel.
    $effect(() => {
        const id = roomId;
        untrack(() => {
            input = getOwnRoomNickname(id) ?? "";
            globalName = getOwnDisplayName() ?? "";
        });
    });

    async function save(name: string) {
        if (saving) return;
        saving = true;
        saved = false;
        try {
            if (isSpace) {
                const { total, failed } = await setOwnSpaceNickname(
                    roomId,
                    name,
                );
                if (failed.length > 0) {
                    showErrorToast(
                        t("nicknameSection.partialFailure", {
                            failed: failed.length,
                            total,
                        }),
                    );
                }
            } else {
                await setOwnRoomNickname(roomId, name);
            }
            input = name.trim();
            saved = true;
            clearTimeout(savedTimeout);
            savedTimeout = setTimeout(() => (saved = false), 2000);
        } catch (e: any) {
            showErrorToast(e?.message ?? t("nicknameSection.saveFailed"));
        } finally {
            saving = false;
        }
    }

    function reset() {
        input = "";
        void save("");
    }
</script>

<div>
    <label
        for="room-settings-nickname"
        class="block text-xs font-semibold text-zam-textMuted uppercase tracking-wide mb-1.5"
        >{t("nicknameSection.title")}</label
    >
    <input
        id="room-settings-nickname"
        bind:value={input}
        placeholder={globalName}
        class="w-full bg-zam-backgroundTertiary text-zam-textPrimary text-sm rounded px-3 py-2 outline-none border border-transparent focus:border-zam-accent/50"
    />
    <p class="text-xs text-zam-textMuted mt-1.5">
        {isSpace ? t("nicknameSection.spaceHint") : t("nicknameSection.hint")}
    </p>
</div>

<div class="flex items-center gap-2">
    <button
        onclick={() => save(input)}
        disabled={saving}
        class="px-4 py-2 bg-zam-accent hover:bg-zam-accentHover text-white rounded font-medium text-sm transition-colors disabled:opacity-50"
        >{saving
            ? t("nicknameSection.saving")
            : t("nicknameSection.save")}</button
    >
    <button
        onclick={reset}
        disabled={saving}
        class="px-4 py-2 bg-zam-backgroundTertiary hover:bg-zam-messageHover text-zam-textPrimary rounded font-medium text-sm transition-colors disabled:opacity-50"
        >{t("nicknameSection.reset")}</button
    >
    {#if saved}
        <span class="text-sm text-zam-textMuted"
            >{t("nicknameSection.saved")}</span
        >
    {/if}
</div>
