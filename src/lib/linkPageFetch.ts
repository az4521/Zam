/**
 * Fetching a linked page from this device, for the link previews bundled into
 * sent messages (utils/previewBundler.ts). The page is requested with the
 * Slackbot link-expander User-Agent, which sites answer with full OpenGraph
 * tags. Only the desktop shell (electron/linkPage.cjs) and the Android shell
 * (LinkPagePlugin.java) can do this; a browser can neither read another
 * site's page nor set the User-Agent. Both refuse non-public addresses.
 *
 * An older shell without the native side answers null, and the bundler falls
 * back to the homeserver's preview.
 */
import { Capacitor, registerPlugin } from "@capacitor/core";

export type LinkPageResult =
    | { kind: "html"; finalUrl: string; html: string }
    | { kind: "image"; finalUrl: string; contentType: string; base64: string };

type NativeResult =
    LinkPageResult | { kind: "none"; finalUrl?: undefined } | null | undefined;

interface LinkPagePlugin {
    fetch(opts: { url: string; mode: "page" | "image" }): Promise<NativeResult>;
}

let androidPlugin: LinkPagePlugin | null = null;

function isAndroid(): boolean {
    try {
        return (
            Capacitor.isNativePlatform() &&
            Capacitor.getPlatform() === "android"
        );
    } catch {
        return false;
    }
}

/** True when this device can fetch pages itself. */
export function canFetchLinkPages(): boolean {
    if (typeof window !== "undefined" && window.desktop?.linkPage) return true;
    return isAndroid();
}

function valid(r: NativeResult): LinkPageResult | null {
    if (!r || typeof r !== "object") return null;
    if (r.kind === "html" && typeof r.html === "string") return r;
    if (
        r.kind === "image" &&
        typeof r.base64 === "string" &&
        typeof r.contentType === "string"
    )
        return r;
    return null;
}

/** Fetch `url` from this device, or null when it can't or the fetch failed. */
export async function fetchLinkPage(
    url: string,
    mode: "page" | "image",
): Promise<LinkPageResult | null> {
    try {
        const desktop =
            typeof window !== "undefined"
                ? window.desktop?.linkPage
                : undefined;
        if (desktop) return valid(await desktop.fetch(url, mode));
        if (isAndroid()) {
            if (!androidPlugin)
                androidPlugin = registerPlugin<LinkPagePlugin>("LinkPage");
            return valid(await androidPlugin.fetch({ url, mode }));
        }
    } catch {
        // An older shell without the plugin, or a native failure.
    }
    return null;
}
