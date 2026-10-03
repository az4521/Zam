import { describe, it, expect } from "vitest";
import { resolvePushProvider } from "./unifiedPush";

const NTFY = { packageName: "io.heckel.ntfy", label: "ntfy" };
const NEXTPUSH = {
    packageName: "org.unifiedpush.distributor.nextpush",
    label: "NextPush",
};

function status(
    distributors: { packageName: string; label: string }[],
    opts: { saved?: string | null; fcm?: boolean } = {},
) {
    return {
        distributors,
        savedDistributor: opts.saved ?? null,
        fcmAvailable: opts.fcm ?? true,
    };
}

describe("resolvePushProvider", () => {
    it("defaults to FCM when it works and nothing was chosen", () => {
        expect(resolvePushProvider("auto", status([NTFY]), true)).toEqual({
            kind: "fcm",
        });
    });

    it("auto keeps a distributor registered earlier", () => {
        expect(
            resolvePushProvider(
                "auto",
                status([NTFY], { saved: NTFY.packageName }),
                true,
            ),
        ).toEqual({ kind: "unifiedpush", distributor: NTFY.packageName });
    });

    it("auto falls back to the only distributor when FCM can't run", () => {
        expect(
            resolvePushProvider("auto", status([NTFY], { fcm: false }), true),
        ).toEqual({ kind: "unifiedpush", distributor: NTFY.packageName });
        // A build without a configured Sygnal gateway counts as no FCM too.
        expect(resolvePushProvider("auto", status([NTFY]), false)).toEqual({
            kind: "unifiedpush",
            distributor: NTFY.packageName,
        });
    });

    it("auto won't guess between several distributors", () => {
        expect(
            resolvePushProvider(
                "auto",
                status([NTFY, NEXTPUSH], { fcm: false }),
                true,
            ),
        ).toEqual({ kind: "none" });
    });

    it("honours an explicit distributor over FCM", () => {
        expect(
            resolvePushProvider(
                `up:${NEXTPUSH.packageName}`,
                status([NTFY, NEXTPUSH]),
                true,
            ),
        ).toEqual({ kind: "unifiedpush", distributor: NEXTPUSH.packageName });
    });

    it("treats an uninstalled chosen distributor like auto", () => {
        expect(
            resolvePushProvider(
                `up:${NEXTPUSH.packageName}`,
                status([NTFY]),
                true,
            ),
        ).toEqual({ kind: "fcm" });
    });

    it("explicit FCM ignores distributors, and is none when FCM can't run", () => {
        expect(
            resolvePushProvider(
                "fcm",
                status([NTFY], { saved: NTFY.packageName }),
                true,
            ),
        ).toEqual({ kind: "fcm" });
        expect(
            resolvePushProvider("fcm", status([NTFY], { fcm: false }), true),
        ).toEqual({
            kind: "none",
        });
    });
});
