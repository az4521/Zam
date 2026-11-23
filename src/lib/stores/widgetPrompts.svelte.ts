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

const DENY: WidgetPromptDecision = { approved: [], remember: false };

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
        // A prompt superseded by a newer one is denied, as if dismissed.
        widgetPrompts.current?.settle(DENY);
        widgetPrompts.current = prompt;
        openModal("widget-capabilities", () => prompt.settle(DENY));
    });
}

/** Deny any pending prompt and close its dialog. Called when the widget that
 *  asked goes away. */
export function dismissWidgetPrompt(): void {
    widgetPrompts.current?.settle(DENY);
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

function mergeApproval(
    base: WidgetApproval | null | undefined,
    delta: Partial<WidgetApproval>,
): WidgetApproval {
    return {
        load: !!(base?.load || delta.load),
        capabilities: [
            ...new Set([
                ...(base?.capabilities ?? []),
                ...(delta.capabilities ?? []),
            ]),
        ],
        openId: delta.openId ?? base?.openId ?? null,
    };
}

/**
 * The approval in force for this widget: the persisted one merged with the
 * session-only one. Null when nothing was ever granted or denied.
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
    return {
        load: !!(persisted?.load || session?.load),
        capabilities: mergeApproval(persisted, session ?? {}).capabilities,
        openId: session?.openId ?? persisted?.openId ?? null,
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
 * Answer a widget's capability request. Silent when the approval in force
 * already covers every requested capability; otherwise asks the user. Resolves
 * with only the requested capabilities the user approved.
 */
export async function resolveCapabilityRequest(
    userId: string | null,
    roomId: string,
    w: RoomWidget,
    requested: Set<string>,
): Promise<Set<string>> {
    const want = [...requested];
    const have = effectiveApproval(userId, roomId, w);
    if (want.every((c) => have?.capabilities.includes(c))) {
        return new Set(want);
    }
    const decision = await askWidgetPermission({
        mode: "capabilities",
        widgetName: w.name,
        host: widgetOrigin(w.url) ?? w.url,
        capabilities: want,
    });
    const approved = decision.approved.filter((c) => requested.has(c));
    if (approved.length > 0 || decision.remember) {
        recordWidgetApproval(
            userId,
            roomId,
            w,
            { capabilities: approved },
            decision.remember,
        );
    }
    return new Set(approved);
}

/**
 * Answer a widget's OpenID request. A stored answer (yes or no) is returned
 * without asking. A refusal is only remembered when the user asked to.
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
    const ok = decision.approved.includes("openid");
    if (ok || decision.remember) {
        recordWidgetApproval(
            userId,
            roomId,
            w,
            { openId: ok },
            decision.remember,
        );
    }
    return ok;
}
