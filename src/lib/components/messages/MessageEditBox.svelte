<script lang="ts">
    // The inline message editor: a small rich contenteditable on the same
    // model as the composer (plain text, decorated so custom emotes show their
    // image), with the composer's `:shortcode` suggestions and conversion.
    import { onMount, tick, untrack } from "svelte";
    import type { Room } from "matrix-js-sdk";
    import { t } from "$lib/i18n";
    import {
        getCustomEmojis,
        getOwnUserId,
        getRoomMembers,
        loadRoomMembersIfNeeded,
        mxcToHttp,
    } from "$lib/matrix/client";
    import { roomsState } from "$lib/stores/rooms.svelte";
    import { settingsState } from "$lib/stores/settings.svelte";
    import type { EmojiSubstitution } from "$lib/utils/messageBody";
    import { insertMention } from "$lib/utils/mentionInsert";
    import { suppressNextClick } from "$lib/utils/suppressNextClick";
    import { convertTrailingShortcode } from "$lib/data/emojiShortcodes";
    import {
        caretOffset,
        editorText,
        pastedPlainText,
        selectedLength,
        setCaretOffset,
    } from "$lib/utils/composerDom";
    import { decorateComposerText } from "$lib/utils/composerDecorate";
    import { TextUndoHistory, diffCaret, undoKind } from "$lib/utils/textUndo";
    import {
        applyEmojiCandidate,
        findEmojiQuery,
        rankEmojiCandidates,
        type EmojiCandidate,
        type EmojiQuery,
    } from "$lib/utils/emojiAutocomplete";
    import EmojiSuggestions from "$lib/components/messages/EmojiSuggestions.svelte";

    let {
        text = $bindable(""),
        editorEl = $bindable(),
        mentions = $bindable(new Map<string, string>()),
        room,
        messageEmotes = [],
        onSave,
        onCancel,
    }: {
        text?: string;
        editorEl?: HTMLDivElement;
        /** Mention tokens in `text` (leading "@" included) → userId. */
        mentions?: Map<string, string>;
        room: Room;
        /** The edited message's own emotes, which survive a removed pack. */
        messageEmotes?: EmojiSubstitution[];
        onSave: () => void;
        onCancel: () => void;
    } = $props();

    const packEmojis = $derived(
        getCustomEmojis(room, roomsState.activeSpaceId),
    );

    // Shortcode → mxc for every emote the edit can use; the packs win on a
    // clash, as in sendMessageEdit.
    const emoteMxc = $derived(
        new Map(
            [...messageEmotes, ...packEmojis].map((e) => [
                e.shortcode,
                e.mxcUrl,
            ]),
        ),
    );

    function render(caret: number) {
        if (!editorEl) return;
        editorEl.innerHTML = decorateComposerText(text, {
            emojiSrc: (shortcode) => {
                const mxc = emoteMxc.get(shortcode);
                return mxc ? mxcToHttp(mxc) : null;
            },
            isMention: isMentionToken,
        });
        setCaretOffset(editorEl, caret);
    }

    function caret(): number {
        return editorEl ? caretOffset(editorEl, text.length) : text.length;
    }

    function setText(next: string, nextCaret: number) {
        text = next;
        render(nextCaret);
        detectSuggestions();
    }

    onMount(() => {
        render(text.length);
        undo.reset(text);
    });

    // Undo/redo from the model, since render() wipes the native stack.
    const undo = new TextUndoHistory();
    let pendingInputKind: string | null = null;
    $effect(() => {
        const current = text;
        untrack(() => {
            const kind = pendingInputKind;
            pendingInputKind = null;
            undo.record(current, kind);
        });
    });

    function stepUndo(delta: -1 | 1) {
        const to = undo.step(delta);
        if (to === null) return;
        setText(to, diffCaret(text, to));
    }

    // `@` mention suggestions, as in the composer. Only one list is open at a
    // time: an active mention query closes the emoji list (detectSuggestions).
    let mentionQuery = $state<string | null>(null); // null = list closed
    let mentionStart = $state(0); // index of the @ in `text`
    let mentionIdx = $state(0);
    // Bumped once the room's full member list is loaded (lazy-loaded members).
    let memberTick = $state(0);
    $effect(() => {
        if (mentionQuery === null || !room) return;
        const r = room;
        loadRoomMembersIfNeeded(r)
            .then(() => untrack(() => memberTick++))
            .catch(() => {});
    });
    const mentionCandidates = $derived.by(() => {
        void memberTick;
        if (mentionQuery === null || !room) return [];
        const q = mentionQuery.toLowerCase();
        const ownId = getOwnUserId();
        return getRoomMembers(room)
            .filter((m) => m.userId !== ownId)
            .filter(
                (m) =>
                    m.userId.toLowerCase().includes(q) ||
                    (m.rawDisplayName ?? "").toLowerCase().includes(q),
            )
            .slice(0, 8);
    });
    $effect(() => {
        if (mentionIdx >= mentionCandidates.length) mentionIdx = 0;
    });

    /** Whether a "@..." run in the text is a mention (styled as a pill). */
    function isMentionToken(token: string): boolean {
        if (!token.startsWith("@") || token.length < 2) return false;
        if (mentions.has(token)) return true;
        const name = token.slice(1).replace(/[.,!?;:]$/, "");
        if (!room) return false;
        return getRoomMembers(room).some(
            (m) =>
                m.userId === token ||
                m.userId.toLowerCase().includes(name.toLowerCase()) ||
                (m.rawDisplayName ?? "").toLowerCase() === name.toLowerCase(),
        );
    }

    function detectMentionQuery() {
        const pos = caret();
        const match = text.slice(0, pos).match(/@(\S*)$/);
        if (match) {
            mentionQuery = match[1];
            mentionStart = pos - match[0].length;
        } else {
            mentionQuery = null;
        }
    }

    // Display name when unambiguous in the room, else the MXID (without "@").
    function mentionLabelFor(member: {
        userId: string;
        rawDisplayName?: string;
    }): string {
        const name = member.rawDisplayName?.trim();
        if (name && room) {
            const sharing = getRoomMembers(room).filter(
                (m) =>
                    (m.rawDisplayName ?? "").trim().toLowerCase() ===
                    name.toLowerCase(),
            );
            if (sharing.length <= 1) return name;
        } else if (name) {
            return name;
        }
        return member.userId.replace(/^@/, "");
    }

    function commitMention(member: {
        userId: string;
        rawDisplayName?: string;
    }) {
        const label = mentionLabelFor(member);
        const inserted = insertMention({
            text,
            mentionStart,
            queryLength: mentionQuery?.length ?? 0,
            label,
        });
        mentions = new Map([...mentions, ["@" + label, member.userId]]);
        mentionQuery = null;
        editorEl?.focus();
        setText(inserted.text, inserted.caret);
    }

    // `:shortcode` suggestions.
    let emojiQuery = $state<EmojiQuery | null>(null);
    let emojiIdx = $state(0);
    const emojiCandidates = $derived.by((): EmojiCandidate[] =>
        emojiQuery ? rankEmojiCandidates(emojiQuery.query, packEmojis) : [],
    );
    $effect(() => {
        if (emojiIdx >= emojiCandidates.length) emojiIdx = 0;
    });

    // The list floats over the timeline rather than pushing it around:
    // above the editor when it fits in the scroller, else below.
    let emojiBelow = $state(false);
    const ROW_PX = 36;

    function scrollParent(el: HTMLElement): HTMLElement | null {
        for (let p = el.parentElement; p; p = p.parentElement) {
            const { overflowY } = getComputedStyle(p);
            if (overflowY === "auto" || overflowY === "scroll") return p;
        }
        return null;
    }

    function placeEmojiList(rows: number) {
        if (!editorEl) return;
        const box = editorEl.getBoundingClientRect();
        const scroller = scrollParent(editorEl)?.getBoundingClientRect();
        const top = scroller?.top ?? 0;
        const bottom = scroller?.bottom ?? window.innerHeight;
        const needed = rows * ROW_PX + 8;
        const above = box.top - top;
        const below = bottom - box.bottom;
        emojiBelow = above < needed && below > above;
    }

    function detectEmojiQuery() {
        const wasOpen = emojiQuery !== null;
        emojiQuery = findEmojiQuery(text, caret());
        if (emojiQuery && !wasOpen) placeEmojiList(8);
    }

    /** Re-derive the open suggestion list from the caret; mentions win over emoji. */
    function detectSuggestions() {
        const wasMentionOpen = mentionQuery !== null;
        detectMentionQuery();
        if (mentionQuery !== null) {
            emojiQuery = null;
            if (!wasMentionOpen) placeEmojiList(8);
            return;
        }
        detectEmojiQuery();
    }

    function commitEmoji(candidate: EmojiCandidate) {
        if (!emojiQuery) return;
        const next = applyEmojiCandidate(text, emojiQuery, candidate);
        emojiQuery = null;
        editorEl?.focus();
        text = next.text;
        render(next.caret);
    }

    function replaceSelection(insert: string) {
        const end = caret();
        const start = end - (editorEl ? selectedLength(editorEl) : 0);
        setText(
            text.slice(0, start) + insert + text.slice(end),
            start + insert.length,
        );
    }

    // True while an IME is composing: the browser owns the contenteditable then,
    // so rendering from the model waits for compositionend.
    let composing = false;

    function onInput() {
        // input events fired inside an IME composition must not trigger a
        // re-render; that replaces the node holding the preedit and the
        // conversion is lost. The model still follows the DOM, so saving
        // mid-composition (Gboard composes every word) keeps the last word.
        syncFromEditor(!composing);
    }

    function onCompositionEnd() {
        composing = false;
        // WebKit fires compositionend before the committed text is in the DOM,
        // Chrome after. The microtask covers both orders.
        queueMicrotask(() => {
            if (!composing) syncFromEditor();
        });
    }

    /** Read the editor into the model; `redraw` false leaves the DOM alone. */
    function syncFromEditor(redraw = true) {
        if (!editorEl) return;
        let pos = caret();
        text = editorText(editorEl);
        if (redraw) {
            // Typing the closing colon of a unicode shortcode converts it, like
            // the composer (":tm:" → ™️). Custom emotes keep their token.
            const converted = convertTrailingShortcode(
                text.slice(0, pos),
                (code) => emoteMxc.has(code),
            );
            if (converted !== null) {
                text = converted + text.slice(pos);
                pos = converted.length;
            }
            render(pos);
        }
        detectSuggestions();
    }

    function onBeforeInput(e: InputEvent) {
        if (e.inputType === "historyUndo" || e.inputType === "historyRedo") {
            e.preventDefault();
            stepUndo(e.inputType === "historyUndo" ? -1 : 1);
            return;
        }
        pendingInputKind = undoKind(e.inputType);
        // Line breaks go through the model: the browser's own <br>/<div>
        // insertions drift out of sync with what render() produces.
        if (
            e.inputType === "insertLineBreak" ||
            e.inputType === "insertParagraph"
        ) {
            e.preventDefault();
            pendingInputKind = null;
            replaceSelection("\n");
        }
    }

    function onPaste(e: ClipboardEvent) {
        // Never let raw clipboard HTML into the contenteditable.
        e.preventDefault();
        const pasted = pastedPlainText(e.clipboardData);
        if (pasted) replaceSelection(pasted);
    }

    function onKeydown(e: KeyboardEvent) {
        if ((e.ctrlKey || e.metaKey) && !e.altKey) {
            const k = e.key.toLowerCase();
            if (k === "z" || (k === "y" && !e.shiftKey)) {
                e.preventDefault();
                stepUndo(k === "z" && !e.shiftKey ? -1 : 1);
                return;
            }
        }
        if (e.isComposing) return;
        // An open mention list takes the keys first, as the emoji list does.
        if (mentionQuery !== null && mentionCandidates.length > 0) {
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault();
                const step = e.key === "ArrowUp" ? -1 : 1;
                mentionIdx =
                    (mentionIdx + step + mentionCandidates.length) %
                    mentionCandidates.length;
                return;
            }
            if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
                e.preventDefault();
                const member = mentionCandidates[mentionIdx];
                if (member) commitMention(member);
                return;
            }
            if (e.key === "Escape") {
                e.preventDefault();
                mentionQuery = null;
                return;
            }
        }
        // An open suggestion list takes the keys first: Enter/Tab pick and
        // Escape closes it before a second Escape cancels the edit.
        if (emojiQuery && emojiCandidates.length > 0) {
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault();
                const step = e.key === "ArrowUp" ? -1 : 1;
                emojiIdx =
                    (emojiIdx + step + emojiCandidates.length) %
                    emojiCandidates.length;
                return;
            }
            if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
                e.preventDefault();
                const candidate = emojiCandidates[emojiIdx];
                if (candidate) commitEmoji(candidate);
                return;
            }
            if (e.key === "Escape") {
                e.preventDefault();
                emojiQuery = null;
                return;
            }
        }
        if (e.key === "Enter") {
            e.preventDefault();
            if (e.shiftKey) {
                pendingInputKind = null;
                replaceSelection("\n");
            } else onSave();
            return;
        }
        if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
        }
    }

    // A plain focus() leaves the caret at the start; editing usually
    // continues at the end, as a textarea's first focus did.
    function onFocus() {
        if (!editorEl) return;
        const selection = window.getSelection();
        const inside =
            selection &&
            selection.rangeCount > 0 &&
            editorEl.contains(selection.getRangeAt(0).endContainer);
        if (!inside) tick().then(() => setCaretOffset(editorEl!, text.length));
    }
</script>

<div class="relative">
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
        bind:this={editorEl}
        role="textbox"
        aria-multiline="true"
        aria-label={t("messageItem.editMessage")}
        tabindex="0"
        contenteditable="true"
        dir="auto"
        autocapitalize="sentences"
        spellcheck={settingsState.spellCheckEnabled}
        {...settingsState.spellCheckEnabled ? {} : { autocorrect: "off" }}
        oninput={onInput}
        oncompositionstart={() => (composing = true)}
        oncompositionend={onCompositionEnd}
        onbeforeinput={onBeforeInput}
        onkeydown={onKeydown}
        onpaste={onPaste}
        onfocus={onFocus}
        onclick={detectSuggestions}
        onblur={() => {
            emojiQuery = null;
            mentionQuery = null;
        }}
        class="composer-editor w-full bg-zam-backgroundTertiary text-zam-textPrimary text-sm rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-zam-accent/50 max-h-[200px] overflow-y-auto"
    ></div>
    {#if emojiQuery && emojiCandidates.length > 0}
        <EmojiSuggestions
            class="absolute inset-x-0 z-20 {emojiBelow
                ? 'top-full mt-1'
                : 'bottom-full mb-1'}"
            candidates={emojiCandidates}
            bind:selectedIdx={emojiIdx}
            onPick={commitEmoji}
        />
    {/if}
    {#if mentionQuery !== null && mentionCandidates.length > 0}
        <div
            class="absolute inset-x-0 z-20 bg-zam-backgroundSecondary border border-zam-divider rounded-lg overflow-hidden shadow-lg {emojiBelow
                ? 'top-full mt-1'
                : 'bottom-full mb-1'}"
        >
            {#each mentionCandidates as member, i (member.userId)}
                <button
                    type="button"
                    onpointerdown={(e) => {
                        e.preventDefault();
                        // Swallow the trailing click so it can't open a link
                        // behind the unmounted list.
                        suppressNextClick();
                        commitMention(member);
                    }}
                    onpointerenter={() => (mentionIdx = i)}
                    class="w-full flex items-center gap-2.5 px-3 py-1.5 text-start transition-colors"
                    class:bg-zam-messageHover={i === mentionIdx}
                >
                    <span
                        class="text-sm text-zam-textPrimary font-medium truncate"
                    >
                        {member.rawDisplayName || member.userId}
                    </span>
                    <span class="text-xs text-zam-textMuted truncate">
                        {member.userId}
                    </span>
                </button>
            {/each}
        </div>
    {/if}
</div>
