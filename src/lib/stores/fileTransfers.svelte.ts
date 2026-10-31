// What the file offer cards show: every transfer running or finished this
// session, on either end. The transfers themselves live in matrix/fileTransfer.

export type TransferPhase =
    | "connecting"
    | "transferring"
    | "verifying"
    | "done"
    | "failed"
    | "cancelled";

export type TransferFailure =
    | "offline"
    | "refused"
    | "no-sfu"
    | "connection"
    | "stalled"
    | "corrupt"
    | "write-failed"
    | "storage-full"
    | "hash-mismatch"
    | "unsupported";

export interface TransferView {
    /** One per pair of devices: a file can go to several people. */
    id: string;
    transferId: string;
    direction: "send" | "receive";
    peerUserId: string;
    phase: TransferPhase;
    bytes: number;
    total: number;
    /** Bytes per second, recently. */
    rate: number;
    failure: TransferFailure | null;
}

class FileTransfersState {
    views = $state<TransferView[]>([]);
    /** Transfers this session offered and can still serve. */
    offered = $state<string[]>([]);
}

export const fileTransfersState = new FileTransfersState();

export function putTransfer(view: TransferView): void {
    fileTransfersState.views = [
        ...fileTransfersState.views.filter((v) => v.id !== view.id),
        view,
    ];
}

export function updateTransfer(
    id: string,
    change: Partial<TransferView>,
): void {
    fileTransfersState.views = fileTransfersState.views.map((v) =>
        v.id === id ? { ...v, ...change } : v,
    );
}

export function clearTransfer(id: string): void {
    fileTransfersState.views = fileTransfersState.views.filter(
        (v) => v.id !== id,
    );
}

export function transfersFor(transferId: string): TransferView[] {
    return fileTransfersState.views.filter((v) => v.transferId === transferId);
}

export function markOffered(transferId: string): void {
    fileTransfersState.offered = [...fileTransfersState.offered, transferId];
}

export function unmarkOffered(transferId: string): void {
    fileTransfersState.offered = fileTransfersState.offered.filter(
        (id) => id !== transferId,
    );
}

export function isOffered(transferId: string): boolean {
    return fileTransfersState.offered.includes(transferId);
}

export function resetFileTransfers(): void {
    fileTransfersState.views = [];
    fileTransfersState.offered = [];
}
