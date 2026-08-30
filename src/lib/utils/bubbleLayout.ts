/**
 * Pure layout decision for a single message row under the optional
 * "right-align own message bubbles" feature. No DOM, no stores.
 *
 * Invariant: when `alignOwn` is false, every flag matches the app's
 * default (Discord uniform-left) layout, so a non-own row — or any row
 * with the feature off — renders exactly as before.
 */
export interface BubbleRowLayout {
    alignOwn: boolean;
    showAvatar: boolean;
    showSenderName: boolean;
    showTimeOnlyHeader: boolean;
    bubble: boolean;
    showInlineHoverTime: boolean;
}

export function resolveBubbleLayout(input: {
    isOwn: boolean;
    alignOwnEnabled: boolean;
    showHeader: boolean;
}): BubbleRowLayout {
    const alignOwn = input.isOwn && input.alignOwnEnabled;
    return {
        alignOwn,
        showAvatar: input.showHeader && !alignOwn,
        showSenderName: input.showHeader && !alignOwn,
        showTimeOnlyHeader: input.showHeader && alignOwn,
        bubble: alignOwn,
        showInlineHoverTime: !input.showHeader && !alignOwn,
    };
}
