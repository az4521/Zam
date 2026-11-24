// Consent state for room widgets: the one pending permission prompt (rendered
// by WidgetCapabilityDialog through the "widget-capabilities" modal slot), the
// load/capability/OpenID approvals a user granted for this session, and the
// resolvers WidgetFrame hands to mountWidget.
//
// A prompt settles exactly once. Dismissing the dialog (Escape, backdrop, back,
// or the slot being taken by something else) settles it as a denial, so the
// widget's pending request never hangs and never receives more than the user
// approved.

import { openModal, closeModal, interfaceState } from "./interface.svelte";
import {
    getWidgetApproval,
    setWidgetApproval,
    type WidgetApproval,
} from "./widgets.svelte";
import { widgetOrigin, type RoomWidget } from "$lib/utils/widgets";

export interface WidgetPromptDecision {
    /** Approved capability strings ("openid" in OpenID mode). */
    approved: string[];
    /** Persist the decision across sessions, not just this one. */
    remember: boolean;
    /**
     * The prompt went away without an answer (Escape, backdrop, back, the
     * widget unmounting, or a newer prompt superseding it). Nothing is
     * recorded for a dismissal: the user never decided.
     */
    dismissed?: boolean;
}

export interface WidgetPromptRequest {
    mode: "capabilities" | "openid";
    widgetName: string;
    host: string;
    /** Requested capabilities, all default-approved in the dialog. */
    capabilities: string[];
}

export interface WidgetPrompt extends WidgetPromptRequest {
    id: number;
    settle(decision: WidgetPromptDecision): void;
}

const DISMISSED: WidgetPromptDecision = {
    approved: [],
    remember: false,
    dismissed: true,
};

/**
 * `current` is $state, so the dialog re-renders when a prompt appears. The
 * prompt is identified by `id`, not object identity: a $state proxy never
 * compares equal to the raw object it was built from.
 */
export const widgetPrompts = $state<{
    current: WidgetPrompt | null;
    /** Bumped on every approval write, so derived approval reads refresh. */
    approvalsTick: number;
}>({ current: null, approvalsTick: 0 });

let nextPromptId = 1;

/**
 * Ask the user about a widget's request. Opens the "widget-capabilities" modal.
 * Resolves with the user's decision, or a denial if the dialog is dismissed.
 */
export function askWidgetPermission(
    req: WidgetPromptRequest,
): Promise<WidgetPromptDecision> {
    return new Promise((resolve) => {
        const id = nextPromptId++;
        let done = false;
        const prompt: WidgetPrompt = {
            ...req,
            id,
            settle(decision) {
                if (done) return;
                done = true;
                if (widgetPrompts.current?.id === id) {
                    widgetPrompts.current = null;
                }
                resolve(decision);
            },
        };
        // A prompt superseded by a newer one is dismissed, not refused.
        widgetPrompts.current?.settle(DISMISSED);
        widgetPrompts.current = prompt;
        openModal("widget-capabilities", () => prompt.settle(DISMISSED));
    });
}

/** Dismiss any pending prompt and close its dialog. Called when the widget that
 *  asked goes away. */
export function dismissWidgetPrompt(): void {
    widgetPrompts.current?.settle(DISMISSED);
    if (interfaceState.modal === "widget-capabilities") closeModal();
}

// ---- approvals -------------------------------------------------------------

/** Session-only approvals, keyed like the persisted ones plus the URL, so a
 *  changed widget URL asks again. Lost on reload. */
const sessionApprovals = new Map<string, WidgetApproval>();

function approvalKey(
    userId: string | null,
    roomId: string,
    w: RoomWidget,
): string {
    return [userId ?? "", roomId, w.id, w.url].join("\u0000");
}

/**
 * Layer `delta` on top of `base`. The latest decision wins: a capability
 * approved in `delta` leaves `denied`, and one refused in `delta` leaves
 * `capabilities`.
 */
export function mergeApproval(
    base: WidgetApproval | null | undefined,
    delta: Partial<WidgetApproval>,
): WidgetApproval {
    const approve = delta.capabilities ?? [];
    const refuse = delta.denied ?? [];
    const capabilities = new Set([...(base?.capabilities ?? []), ...approve]);
    const denied = new Set([...(base?.denied ?? []), ...refuse]);
    for (const c of refuse) capabilities.delete(c);
    for (const c of approve) denied.delete(c);
    return {
        load: !!(base?.load || delta.load),
        capabilities: [...capabilities],
        denied: [...denied],
        openId: delta.openId ?? base?.openId ?? null,
    };
}

/**
 * The approval in force for this widget: the persisted one merged with the
 * session-only one (the session one is newer). Null when nothing was ever
 * granted or denied.
 */
export function effectiveApproval(
    userId: string | null,
    roomId: string,
    w: RoomWidget,
): WidgetApproval | null {
    void widgetPrompts.approvalsTick;
    const persisted = getWidgetApproval(userId, roomId, w);
    const session = sessionApprovals.get(approvalKey(userId, roomId, w));
    if (!persisted && !session) return null;
    return mergeApproval(persisted, session ?? {});
}

/** How a capability request splits against the approval in force. */
export interface CapabilityPlan {
    /** Requested and already approved: granted without asking. */
    granted: string[];
    /** Requested and neither approved nor refused: the user must be asked. */
    undecided: string[];
}

/**
 * Split `requested` into what is already decided. Refused capabilities are
 * neither granted nor asked again.
 */
export function planCapabilityRequest(
    requested: readonly string[],
    approval: Pick<WidgetApproval, "capabilities" | "denied"> | null,
): CapabilityPlan {
    const approved = new Set(approval?.capabilities ?? []);
    const refused = new Set(approval?.denied ?? []);
    return {
        granted: requested.filter((c) => approved.has(c)),
        undecided: requested.filter((c) => !approved.has(c) && !refused.has(c)),
    };
}

/**
 * The stored change for a prompt over `undecided`: the ticked ones are
 * approved, the rest of the undecided ones refused.
 */
export function capabilityDecisionDelta(
    undecided: readonly string[],
    ticked: readonly string[],
): { capabilities: string[]; denied: string[] } {
    const picked = new Set(ticked);
    return {
        capabilities: undecided.filter((c) => picked.has(c)),
        denied: undecided.filter((c) => !picked.has(c)),
    };
}

/** Record a grant or denial. `remember` persists it; otherwise it lasts only
 *  for this session. */
export function recordWidgetApproval(
    userId: string | null,
    roomId: string,
    w: RoomWidget,
    delta: Partial<WidgetApproval>,
    remember: boolean,
): void {
    const key = approvalKey(userId, roomId, w);
    if (remember) {
        // Fold any session-only grant in too: remembering supersedes it.
        const merged = mergeApproval(
            mergeApproval(getWidgetApproval(userId, roomId, w), {
                ...sessionApprovals.get(key),
            }),
            delta,
        );
        setWidgetApproval(userId, roomId, w, merged);
        sessionApprovals.delete(key);
    } else {
        sessionApprovals.set(
            key,
            mergeApproval(sessionApprovals.get(key), delta),
        );
    }
    widgetPrompts.approvalsTick++;
}

/**
 * Answer a widget's capability request. Capabilities already approved are
 * granted silently and refused ones are dropped without asking. Only the
 * undecided ones prompt the user. Every answer is recorded: session-only
 * unless the user chose to remember it.
 */
export async function resolveCapabilityRequest(
    userId: string | null,
    roomId: string,
    w: RoomWidget,
    requested: Set<string>,
): Promise<Set<string>> {
    const have = effectiveApproval(userId, roomId, w);
    const { granted, undecided } = planCapabilityRequest([...requested], have);
    if (undecided.length === 0) return new Set(granted);
    const decision = await askWidgetPermission({
        mode: "capabilities",
        widgetName: w.name,
        host: widgetOrigin(w.url) ?? w.url,
        capabilities: undecided,
    });
    // A dismissal is not a decision: record nothing, grant only what was
    // already approved.
    if (decision.dismissed) return new Set(granted);
    const undecidedSet = new Set(undecided);
    const ticked = decision.approved.filter((c) => undecidedSet.has(c));
    const delta = capabilityDecisionDelta(undecided, ticked);
    recordWidgetApproval(userId, roomId, w, delta, decision.remember);
    return new Set([...granted, ...ticked]);
}

/**
 * Answer a widget's OpenID request. A stored or session answer (yes or no) is
 * returned without asking. Every answer is recorded, session-only unless the
 * user chose to remember it.
 */
export async function resolveOpenIdRequest(
    userId: string | null,
    roomId: string,
    w: RoomWidget,
): Promise<boolean> {
    const have = effectiveApproval(userId, roomId, w);
    if (have && have.openId !== null) return have.openId;
    const decision = await askWidgetPermission({
        mode: "openid",
        widgetName: w.name,
        host: widgetOrigin(w.url) ?? w.url,
        capabilities: [],
    });
    // A dismissal is not a decision: record nothing and refuse this time.
    if (decision.dismissed) return false;
    const ok = decision.approved.includes("openid");
    recordWidgetApproval(userId, roomId, w, { openId: ok }, decision.remember);
    return ok;
}
