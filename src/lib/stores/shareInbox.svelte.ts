import { tick } from "svelte";
import {
    normalizeSharePayload,
    type ShareInput,
    type NormalizedShare,
} from "$lib/utils/sharePayload";
import { openModal, clearModalIfOwner } from "$lib/stores/interface.svelte";
import { navigateToRoom, roomsState } from "$lib/stores/rooms.svelte";
import { getDraft, setDraft } from "$lib/stores/composerDrafts.svelte";
import { composerInsertText } from "$lib/utils/composerInsert";
import { addQueuedFile } from "$lib/stores/composerFileQueue.svelte";
import { hostBridge } from "$lib/plugins/hostBridge";

/** The single pending share payload, or null. */
export const shareInboxState = $state<{ payload: NormalizedShare | null }>({
    payload: null,
});

/** Module-level slot token tracking which open modal owns the share. */
let token = 0;

/**
 * Receive a share from a host platform (Web Share Target, Android share
 * intent, iOS share extension). Opens the room picker modal if valid, rejects
 * if empty. Returns whether the share was accepted.
 */
export function receiveShare(input: ShareInput): boolean {
    const n = normalizeSharePayload(input);
    if (!n) return false;

    // ORDERING CONTRACT: claim the slot FIRST, then assign the payload.
    // Opening supersedes any prior owner and runs its close synchronously —
    // reversing this order would let a superseded modal's close null the
    // payload we just set.
    token = openModal("share-target", () => {
        shareInboxState.payload = null;
    });
    shareInboxState.payload = n;
    return true;
}

/**
 * Deliver the pending share into the given room's composer, navigate to that
 * room, and dismiss the picker. No-op if no share is pending.
 */
export function deliverShareToRoom(
    roomId: string,
    opts?: { caption?: string; send?: boolean },
): void {
    const p = shareInboxState.payload;
    if (!p) return;

    const text = opts?.caption ?? p.text;
    const wasActive = roomsState.activeRoomId === roomId;

    // Deliver text: via hostBridge if the room is already mounted and active,
    // otherwise merge into the draft.
    if (text) {
        if (wasActive && hostBridge.insertText) {
            hostBridge.insertText({ roomId, text });
        } else {
            const d = getDraft(roomId);
            setDraft(
                roomId,
                composerInsertText(d?.text ?? "", text),
                new Map(d?.mentions ?? []),
            );
        }
    }

    // Deliver files: stage each into the composer queue with a preview URL for
    // images. The queue owns object-URL revocation.
    if (p.kind === "files") {
        for (const f of p.files as File[]) {
            addQueuedFile(
                roomId,
                f,
                f.name || "file",
                f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
            );
        }
    }

    // One-step send (explicit user Send tap only). Queue the send; the composer
    // drains hostBridge.pendingSend one tick after its draft-restore effect sets
    // `text` (mirrors pendingMention). An already-active room's composer won't
    // re-run that effect, so fire the imperative send after a tick, once staging
    // is in and the file-queue derived has updated.
    if (opts?.send) {
        hostBridge.pendingSend = { roomId };
        if (wasActive) {
            void tick().then(() => {
                if (hostBridge.pendingSend?.roomId === roomId) {
                    hostBridge.pendingSend = null;
                    hostBridge.sendNow?.({ roomId });
                }
            });
        }
    }

    navigateToRoom(roomId);
    clearShare();
}

/**
 * Dismiss the pending share without delivering it. Idempotent — safe to call
 * twice, safe when nothing is open.
 */
export function clearShare(): void {
    shareInboxState.payload = null;
    clearModalIfOwner(token);
    token = 0;
}
