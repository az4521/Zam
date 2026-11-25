/**
 * iOS WebKit turns a tap into a hover first and withholds the click when that
 * hover reveals a button or link, so a row whose controls fade in on hover
 * takes two taps. That holds in Safari, the home-screen PWA and the iOS app's
 * WKWebView alike. `markIosTouch` puts `data-ios-touch` on the root element,
 * and the `ios-touch:` Tailwind variant (tailwind.config.js) keeps
 * hover-revealed controls in place there.
 */

interface NavigatorLike {
    userAgent: string;
    platform?: string;
    maxTouchPoints?: number;
}

/** iPhone, iPod or iPad, including iPadOS's desktop-style user agent. */
export function isIosWebKit(nav: NavigatorLike): boolean {
    if (/iPhone|iPod|iPad/.test(nav.userAgent)) return true;
    // iPadOS 13+ reports itself as a Mac; only a touch screen tells them apart.
    return nav.platform === "MacIntel" && (nav.maxTouchPoints ?? 0) > 1;
}

export function markIosTouch(
    doc: Document | undefined = typeof document !== "undefined"
        ? document
        : undefined,
    nav: NavigatorLike | undefined = typeof navigator !== "undefined"
        ? navigator
        : undefined,
): void {
    if (!doc || !nav) return;
    if (isIosWebKit(nav))
        doc.documentElement.setAttribute("data-ios-touch", "");
}
