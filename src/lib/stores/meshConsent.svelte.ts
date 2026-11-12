/**
 * Asking before a call opens peer-to-peer connections (MSC4575 full mesh),
 * which show the user's IP address to the people at the other end.
 *
 * livekitCall.ts asks when joining a call that needs them (our homeserver
 * has no call server, or someone in the call can only be reached directly)
 * and when such a person joins later. MeshConsentDialog shows the request.
 */
import { settingsState } from "./settings.svelte";

/**
 * - allow: connect directly.
 * - deny: join, but leave out whoever can only be reached directly (only
 *   offered when we have a call server of our own).
 * - cancel: don't join.
 */
export type MeshConsentAnswer = "allow" | "deny" | "cancel";

export interface MeshConsentRequest {
    /** Asked while joining (else: someone joined the call we're in). */
    joining: boolean;
    /** We'd send our own media over it: no call server of our own. */
    publishing: boolean;
}

interface Pending extends MeshConsentRequest {
    resolve: (answer: MeshConsentAnswer) => void;
}

class MeshConsentState {
    pending = $state<Pending | null>(null);
}

export const meshConsentState = new MeshConsentState();

/** Ask the user. A newer request answers an open one with its safe choice. */
export function requestMeshConsent(
    request: MeshConsentRequest,
): Promise<MeshConsentAnswer> {
    return new Promise((resolve) => {
        const old = meshConsentState.pending;
        if (old) old.resolve(old.joining ? "cancel" : "deny");
        meshConsentState.pending = {
            joining: request.joining,
            publishing: request.publishing ?? false,
            resolve,
        };
    });
}

export function resolveMeshConsent(answer: MeshConsentAnswer): void {
    const pending = meshConsentState.pending;
    if (!pending) return;
    meshConsentState.pending = null;
    pending.resolve(answer);
}

/** Whether relaying hides the address (for the dialog's wording). */
export function meshRelayOnly(): boolean {
    return settingsState.meshRelayOnly;
}
