/**
 * MSC4153: cross-signing identity changes the user must acknowledge.
 *
 * `own` alerts mean OUR account's cross-signing keys changed (our devices must
 * re-sign / re-verify); the rest mean another user's identity changed and
 * encrypted messages to them are held back until the user accepts it. Filled
 * by `crypto.ts`, which owns every SDK read; this store only holds the result.
 */
export interface IdentityAlert {
    userId: string;
    own: boolean;
    /** The user was cross-signing-verified before the change. */
    wasVerified: boolean;
}

class IdentityAlertStore {
    alerts = $state<IdentityAlert[]>([]);
}

export const identityAlertState = new IdentityAlertStore();

export function setIdentityAlert(alert: IdentityAlert | null, userId: string) {
    const rest = identityAlertState.alerts.filter((a) => a.userId !== userId);
    identityAlertState.alerts = alert ? [...rest, alert] : rest;
}

export function clearIdentityAlerts(): void {
    identityAlertState.alerts = [];
}
