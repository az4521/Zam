import { describe, it, expect } from "vitest";
import {
    acceptShare,
    keyVerdict,
    secretStorageAction,
    shouldPromote,
} from "./privateKeyPolicy";

describe("keyVerdict", () => {
    it("is missing without a key, whatever the server holds", () => {
        expect(keyVerdict("none", "none")).toBe("missing");
        expect(keyVerdict("none", "readable")).toBe("missing");
        expect(keyVerdict("none", "unreadable")).toBe("missing");
    });

    it("is ready when the key fits the server or there is nothing to check", () => {
        expect(keyVerdict("confirmed", "none")).toBe("ready");
        expect(keyVerdict("confirmed", "readable")).toBe("ready");
        expect(keyVerdict("unconfirmed", "none")).toBe("ready");
        expect(keyVerdict("unconfirmed", "readable")).toBe("ready");
    });

    it("is missing when the server holds events this key cannot read", () => {
        expect(keyVerdict("unconfirmed", "unreadable")).toBe("missing");
        expect(keyVerdict("confirmed", "unreadable")).toBe("missing");
    });
});

describe("shouldPromote", () => {
    it("promotes only an unconfirmed key that decrypts the server", () => {
        expect(shouldPromote("unconfirmed", "readable")).toBe(true);
        expect(shouldPromote("unconfirmed", "none")).toBe(false);
        expect(shouldPromote("unconfirmed", "unreadable")).toBe(false);
        expect(shouldPromote("confirmed", "readable")).toBe(false);
        expect(shouldPromote("none", "readable")).toBe(false);
    });
});

describe("acceptShare", () => {
    it("takes a share that decrypts the server when this device has no good key", () => {
        expect(
            acceptShare({
                local: "none",
                server: "unreadable",
                shareDecrypts: true,
            }),
        ).toBe(true);
        expect(
            acceptShare({
                local: "unconfirmed",
                server: "unreadable",
                shareDecrypts: true,
            }),
        ).toBe(true);
        expect(
            acceptShare({
                local: "confirmed",
                server: "unreadable",
                shareDecrypts: true,
            }),
        ).toBe(true);
    });

    it("refuses a share that does not decrypt the server when the local key is wrong", () => {
        expect(
            acceptShare({
                local: "unconfirmed",
                server: "unreadable",
                shareDecrypts: false,
            }),
        ).toBe(false);
        expect(
            acceptShare({
                local: "none",
                server: "unreadable",
                shareDecrypts: false,
            }),
        ).toBe(false);
    });

    it("keeps a self-generated key while nothing is on the server", () => {
        expect(
            acceptShare({
                local: "unconfirmed",
                server: "none",
                shareDecrypts: true,
            }),
        ).toBe(false);
    });

    it("takes a share when there is no key and nothing to check it against", () => {
        expect(
            acceptShare({
                local: "none",
                server: "none",
                shareDecrypts: false,
            }),
        ).toBe(true);
    });

    it("never replaces a key that already fits the server", () => {
        expect(
            acceptShare({
                local: "confirmed",
                server: "readable",
                shareDecrypts: true,
            }),
        ).toBe(false);
        expect(
            acceptShare({
                local: "confirmed",
                server: "none",
                shareDecrypts: true,
            }),
        ).toBe(false);
        expect(
            acceptShare({
                local: "unconfirmed",
                server: "readable",
                shareDecrypts: true,
            }),
        ).toBe(false);
    });
});

describe("secretStorageAction", () => {
    it("adopts whatever secret storage holds", () => {
        expect(
            secretStorageAction({
                remote: "value",
                local: "none",
                server: "unreadable",
            }),
        ).toBe("adopt");
        expect(
            secretStorageAction({
                remote: "value",
                local: "confirmed",
                server: "readable",
            }),
        ).toBe("adopt");
    });

    it("generates a key only when no key exists anywhere and the server is empty", () => {
        expect(
            secretStorageAction({
                remote: "absent",
                local: "none",
                server: "none",
            }),
        ).toBe("generate-and-store");
        expect(
            secretStorageAction({
                remote: "absent",
                local: "none",
                server: "unreadable",
            }),
        ).toBe("leave");
    });

    it("stores the local key when it fits the server", () => {
        expect(
            secretStorageAction({
                remote: "absent",
                local: "unconfirmed",
                server: "none",
            }),
        ).toBe("store-local");
        expect(
            secretStorageAction({
                remote: "absent",
                local: "confirmed",
                server: "readable",
            }),
        ).toBe("store-local");
    });

    it("does not overwrite 4S unless the local key decrypts the current server events", () => {
        expect(
            secretStorageAction({
                remote: "unreadable",
                local: "confirmed",
                server: "unreadable",
            }),
        ).toBe("leave");
        expect(
            secretStorageAction({
                remote: "unreadable",
                local: "none",
                server: "none",
            }),
        ).toBe("leave");
        expect(
            secretStorageAction({
                remote: "unreadable",
                local: "unconfirmed",
                server: "none",
            }),
        ).toBe("store-local");
        expect(
            secretStorageAction({
                remote: "unreadable",
                local: "confirmed",
                server: "readable",
            }),
        ).toBe("store-local");
    });

    it("leaves 4S alone when the local key does not fit the server", () => {
        expect(
            secretStorageAction({
                remote: "absent",
                local: "unconfirmed",
                server: "unreadable",
            }),
        ).toBe("leave");
    });
});
