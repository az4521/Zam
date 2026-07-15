/**
 * Pure power-level gating for the call participant menu's moderation entries.
 * Mirrors the derivation UserProfileCard.svelte already uses: you may only act
 * on someone strictly below you, and only if you meet the action's own bar.
 */

export interface MenuGateInput {
    isSelf: boolean;
    myLevel: number;
    targetLevel: number;
    kickLevel: number;
    banLevel: number;
    /** Disconnect works by redacting their RTC membership event. */
    redactLevel: number;
}

export interface MenuGates {
    canKick: boolean;
    canBan: boolean;
    canDisconnect: boolean;
}

export function menuGates(input: MenuGateInput): MenuGates {
    const canActOnTarget = !input.isSelf && input.myLevel > input.targetLevel;
    return {
        canKick: canActOnTarget && input.myLevel >= input.kickLevel,
        canBan: canActOnTarget && input.myLevel >= input.banLevel,
        canDisconnect: canActOnTarget && input.myLevel >= input.redactLevel,
    };
}
