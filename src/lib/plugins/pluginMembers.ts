/**
 * Folding plugin contributions for one user into what Zam shows: member
 * list decorations (zam.members.decorate) and profile card actions
 * (zam.members.addAction). Each plugin function is try/catch-wrapped so one
 * throwing plugin never blanks the list. Pure — no SDK/DOM imports.
 */
import type {
    MemberDecorator,
    UserActionContext,
    UserActionItem,
} from "./types";

export interface MemberDecorationView {
    badges: string[];
    /** The first plugin's second line. */
    subtitle: string | null;
    tooltip: string | null;
}

const MAX_BADGE = 24;
const MAX_SUBTITLE = 128;

export function collectMemberDecorations(
    decorators: readonly MemberDecorator[],
    ctx: { roomId: string; userId: string },
): MemberDecorationView | null {
    if (decorators.length === 0) return null;
    const badges: string[] = [];
    let subtitle: string | null = null;
    const tooltips: string[] = [];
    for (const fn of decorators) {
        let d;
        try {
            d = fn(ctx);
        } catch (e) {
            console.error("[zam] members.decorate threw", e);
            continue;
        }
        if (!d) continue;
        if (typeof d.badge === "string" && d.badge)
            badges.push(d.badge.slice(0, MAX_BADGE));
        if (subtitle === null && typeof d.subtitle === "string" && d.subtitle)
            subtitle = d.subtitle.slice(0, MAX_SUBTITLE);
        if (typeof d.tooltip === "string" && d.tooltip)
            tooltips.push(d.tooltip);
    }
    if (badges.length === 0 && subtitle === null && tooltips.length === 0)
        return null;
    return {
        badges,
        subtitle,
        tooltip: tooltips.length > 0 ? tooltips.join("\n") : null,
    };
}

/** The profile card actions that apply to `ctx`. */
export function visibleUserActions(
    actions: readonly UserActionItem[],
    ctx: UserActionContext,
): UserActionItem[] {
    return actions.filter((a) => {
        try {
            return a.when?.(ctx) ?? true;
        } catch (e) {
            console.error("[zam] members.addAction when() threw", e);
            return false;
        }
    });
}
