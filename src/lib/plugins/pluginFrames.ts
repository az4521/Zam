/**
 * zam.frames: a plugin's rules for the pages embedded in Zam's window (a
 * YouTube player, say). Main does the work (electron/pluginFrames.cjs): for
 * each iframe whose URL a rule matches, it sends the rule's referrer and
 * runs its script as the frame loads. Desktop only; there is no way in from
 * the page elsewhere.
 */
import type { Manifest } from "./manifest";
import type { Disposable, FrameScript } from "./types";

function bridge() {
    return typeof window === "undefined"
        ? undefined
        : window.desktop?.pluginFrames;
}

export function framesAvailable(manifest: Manifest): boolean {
    return !!bridge() && !!manifest.capabilities?.includes("frames");
}

let seq = 0;

/** Hand `rule` to main until disposed. A no-op where frames aren't available. */
export function injectFrameScript(
    pluginId: string,
    manifest: Manifest,
    rule: FrameScript,
): Disposable {
    const b = bridge();
    if (!b || !framesAvailable(manifest)) return { dispose() {} };
    const id = `${pluginId}:${++seq}`;
    void b
        .add({
            id,
            urlPrefixes: [...rule.urlPrefixes],
            ...(rule.script !== undefined && { script: String(rule.script) }),
            ...(rule.referrer !== undefined && {
                referrer: String(rule.referrer),
            }),
        })
        .then((ok) => {
            if (!ok)
                console.error(
                    `[zam] plugin ${pluginId}: frame rule refused (each URL prefix and the referrer must name a whole origin, e.g. "https://example.com/")`,
                );
        });
    return {
        dispose() {
            void b.remove(id);
        },
    };
}
