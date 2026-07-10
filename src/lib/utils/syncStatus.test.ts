import { describe, it, expect } from "vitest";
import { syncStateLabel } from "./syncStatus";

describe("syncStateLabel — humanize the raw sync state", () => {
    it("treats PREPARED and SYNCING as Connected", () => {
        expect(syncStateLabel("PREPARED")).toEqual({
            label: "Connected",
            tone: "ok",
        });
        expect(syncStateLabel("SYNCING")).toEqual({
            label: "Connected",
            tone: "ok",
        });
    });

    it("treats RECONNECTING and CATCHUP as Reconnecting", () => {
        expect(syncStateLabel("RECONNECTING").label).toBe("Reconnecting…");
        expect(syncStateLabel("RECONNECTING").tone).toBe("warn");
        expect(syncStateLabel("CATCHUP").tone).toBe("warn");
    });

    it("treats ERROR as a connection error", () => {
        expect(syncStateLabel("ERROR")).toEqual({
            label: "Connection error",
            tone: "error",
        });
    });

    it("treats STOPPED as Offline", () => {
        expect(syncStateLabel("STOPPED")).toEqual({
            label: "Offline",
            tone: "idle",
        });
    });

    it("treats null and unknown states as Connecting", () => {
        expect(syncStateLabel(null)).toEqual({
            label: "Connecting…",
            tone: "idle",
        });
        expect(syncStateLabel("SOMETHING_NEW").label).toBe("Connecting…");
    });
});
