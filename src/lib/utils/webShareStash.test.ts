import { describe, it, expect } from "vitest";
import { base64ToFile } from "./webShareStash";

describe("base64ToFile", () => {
    it("decodes a base64 payload into a File with name and type", async () => {
        const b64 = btoa("hello");
        const file = base64ToFile({
            name: "greet.txt",
            mimeType: "text/plain",
            dataBase64: b64,
        });
        expect(file).toBeInstanceOf(File);
        expect(file?.name).toBe("greet.txt");
        expect(file?.type).toBe("text/plain");
        expect(await file?.text()).toBe("hello");
    });

    it("returns null when dataBase64 is missing", () => {
        expect(base64ToFile({ name: "x" })).toBeNull();
    });

    it("falls back to defaults for name and type", () => {
        const file = base64ToFile({ dataBase64: btoa("x") });
        expect(file?.name).toBe("file");
        expect(file?.type).toBe("application/octet-stream");
    });
});
