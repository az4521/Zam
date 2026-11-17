import { describe, expect, it, vi } from "vitest";
import { requestPersistentStorage } from "./persistentStorage";

describe("requestPersistentStorage", () => {
    it("reports unsupported without a StorageManager", async () => {
        expect(await requestPersistentStorage({})).toBe("unsupported");
    });

    it("does not ask again when already persisted", async () => {
        const persist = vi.fn(async () => true);
        const outcome = await requestPersistentStorage({
            persisted: async () => true,
            persist,
        });
        expect(outcome).toBe("already");
        expect(persist).not.toHaveBeenCalled();
    });

    it("asks and reports the answer", async () => {
        expect(
            await requestPersistentStorage({
                persisted: async () => false,
                persist: async () => true,
            }),
        ).toBe("granted");
        expect(
            await requestPersistentStorage({
                persisted: async () => false,
                persist: async () => false,
            }),
        ).toBe("denied");
    });

    it("never throws", async () => {
        expect(
            await requestPersistentStorage({
                persist: async () => {
                    throw new Error("nope");
                },
            }),
        ).toBe("unsupported");
    });
});
