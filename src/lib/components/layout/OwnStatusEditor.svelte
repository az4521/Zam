<script lang="ts">
    import { Smile } from "lucide-svelte";
    import EmojiPicker from "$lib/components/ui/EmojiPicker.svelte";
    import { fetchOwnExtendedProfile } from "$lib/matrix/client";
    import { saveOwnStatus } from "$lib/matrix/ownStatus";
    import { interfaceState } from "$lib/stores/interface.svelte";
    import { renderPlainTextWithTwemoji } from "$lib/utils/twemojiText";
    import {
        MAX_STATUS_TEXT_LENGTH,
        PROFILE_FIELDS,
        buildStatus,
        parseStatus,
        readField,
        statusProblem,
    } from "$lib/utils/extendedProfile";

    interface Props {
        /** Called after a successful save or clear. */
        onDone?: () => void;
    }
    let { onDone }: Props = $props();

    // Quick status editing, for the account switcher. The full set of profile
    // fields stays in Settings → Account.
    let emoji = $state("");
    let text = $state("");
    let savedEmoji = $state("");
    let savedText = $state("");
    let busy = $state(false);
    let error = $state("");
    let pickerOpen = $state(false);

    const dirty = $derived(
        emoji.trim() !== savedEmoji || text.trim() !== savedText,
    );
    const problem = $derived(statusProblem(text, emoji));
    const hasStatus = $derived(savedEmoji !== "" || savedText !== "");

    $effect(() => {
        fetchOwnExtendedProfile()
            .then((profile) => {
                const status = parseStatus(
                    readField(profile, PROFILE_FIELDS.status),
                );
                savedEmoji = emoji = status?.emoji ?? "";
                savedText = text = status?.text ?? "";
            })
            .catch(() => {});
    });

    async function save(clear = false) {
        if (busy || (!clear && (!dirty || problem))) return;
        busy = true;
        error = "";
        try {
            const status = clear ? null : buildStatus(text, emoji);
            await saveOwnStatus(status);
            savedEmoji = emoji = status?.emoji ?? "";
            savedText = text = status?.text ?? "";
            onDone?.();
        } catch (e) {
            error = (e as Error)?.message ?? "Could not save status";
        } finally {
            busy = false;
        }
    }
</script>

<div class="space-y-2">
    <div class="flex gap-1.5">
        <button
            type="button"
            onclick={() => (pickerOpen = !pickerOpen)}
            aria-label="Pick a status emoji"
            aria-expanded={pickerOpen}
            class="w-9 flex-shrink-0 flex items-center justify-center rounded bg-discord-backgroundTertiary text-discord-textMuted hover:text-discord-textPrimary"
        >
            {#if emoji}<span class="text-base"
                    >{@html renderPlainTextWithTwemoji(emoji)}</span
                >{:else}<Smile size={16} />{/if}
        </button>
        <input
            bind:value={text}
            maxlength={MAX_STATUS_TEXT_LENGTH}
            placeholder="What's happening?"
            aria-label="Status text"
            onkeydown={(e) => {
                if (e.key === "Enter") void save();
            }}
            class="flex-1 min-w-0 bg-discord-backgroundTertiary text-discord-textPrimary text-sm rounded px-2.5 py-1.5 outline-none"
        />
    </div>
    <div class="flex gap-1.5">
        <button
            type="button"
            onclick={() => save()}
            disabled={busy || !dirty || !!problem}
            class="px-3 py-1 bg-discord-accent text-white rounded text-xs font-medium disabled:opacity-50"
            >{busy ? "Saving…" : "Save"}</button
        >
        {#if hasStatus}
            <button
                type="button"
                onclick={() => save(true)}
                disabled={busy}
                class="px-3 py-1 bg-discord-backgroundTertiary text-discord-textPrimary rounded text-xs font-medium disabled:opacity-50"
                >Clear status</button
            >
        {/if}
    </div>
    {#if problem && dirty}<p class="text-xs text-discord-textMuted">
            {problem}
        </p>{/if}
    {#if error}<p class="text-xs text-discord-danger">{error}</p>{/if}

    {#if pickerOpen}
        <!-- Beside the popover on desktop (it is the positioned ancestor); a
             bottom sheet over it on touch. -->
        <div
            class={interfaceState.isTouchscreen
                ? "fixed inset-x-0 bottom-0 z-[60]"
                : "absolute left-full bottom-0 ml-2 z-[60]"}
        >
            <EmojiPicker
                unicodeOnly
                onSelect={(picked) => (emoji = picked)}
                onClose={() => (pickerOpen = false)}
            />
        </div>
    {/if}
</div>
