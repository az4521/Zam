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
import { sendShare } from "$lib/matrix/client";
import { planShareSend, shareRemainder } from "$lib/utils/shareSend";
import { auth } from "$lib/stores/auth.svelte";
import { shouldQueueSend } from "$lib/utils/sendGating";
import { showErrorToast } from "$lib/stores/toasts.svelte";
import { matrixErrorMessage } from "$lib/utils/knock";

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
 * Stage text and files into the room's composer without sending. Merges text
 * via hostBridge.insertText when the room is active and mounted, else into the
 * draft store. Stages files into the composer queue with preview URLs for images.
 */
function stageShare(roomId: string, text: string, files: File[]): void {
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
    for (const f of files) {
        addQueuedFile(
            roomId,
            f,
            f.name || "file",
            f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
        );
    }
}

/**
 * Deliver the pending share into the given room's composer, navigate to that
 * room, and dismiss the picker. When opts.send is true, sends immediately via
 * sendShare (bypassing the composer) if online; otherwise stages everything
 * into the composer. No-op if no share is pending.
 */
export async function deliverShareToRoom(
    roomId: string,
    opts?: { caption?: string; send?: boolean },
): Promise<void> {
    const p = shareInboxState.payload;
    if (!p) return;

    const text = opts?.caption ?? p.text;
    const files = p.kind === "files" ? (p.files as File[]) : [];

    // Send path: snapshot the payload, navigate + clear immediately, then send
    // directly without touching the composer state. On failure, stage what
    // remains unsent.
    if (opts?.send) {
        const captionSnapshot = text;
        const filesSnapshot = [...files];
        navigateToRoom(roomId);
        clearShare();

        // Offline: skip sending, stage everything, and toast
        if (
            shouldQueueSend({
                syncState: auth.syncState,
                online: navigator.onLine,
            })
        ) {
            stageShare(roomId, captionSnapshot, filesSnapshot);
            showErrorToast(
                "You're offline: the share was added to the composer",
            );
            return;
        }

        // Online: send via sendShare, track progress
        const steps = planShareSend({
            caption: captionSnapshot,
            files: filesSnapshot,
        });
        let sentCount = 0;

        try {
            await sendShare(
                roomId,
                { caption: captionSnapshot, files: filesSnapshot },
                (i) => {
                    sentCount = i + 1;
                },
            );
        } catch (err) {
            // Partial or total failure: stage what remains unsent
            const remainder = shareRemainder(steps, sentCount);
            stageShare(roomId, remainder.text, remainder.files);
            showErrorToast(matrixErrorMessage(err, "Couldn't send the share"));
        }

        return;
    }

    // Non-send path: stage into the composer and navigate
    stageShare(roomId, text, files);
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
