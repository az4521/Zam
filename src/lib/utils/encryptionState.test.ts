import { describe, it, expect } from "vitest";
import {
    isUndecryptedEvent,
    isEncryptionEnabled,
    previewForEvent,
    ENCRYPTED_MESSAGE_PLACEHOLDER,
    UTD_PLACEHOLDER_TEXT,
} from "./encryptionState";

describe("isUndecryptedEvent", () => {
    it("is true only for a still-encrypted envelope type", () => {
        expect(isUndecryptedEvent("m.room.encrypted")).toBe(true);
    });

    it("is false for decrypted / cleartext event types", () => {
        // A successfully decrypted event reports its cleartext type.
        expect(isUndecryptedEvent("m.room.message")).toBe(false);
        expect(isUndecryptedEvent("m.sticker")).toBe(false);
        expect(isUndecryptedEvent("m.reaction")).toBe(false);
    });
});

describe("isEncryptionEnabled — read m.room.encryption state content", () => {
    it("is true when a megolm algorithm is present", () => {
        expect(isEncryptionEnabled({ algorithm: "m.megolm.v1.aes-sha2" })).toBe(
            true,
        );
    });

    it("is false when the encryption state event is absent", () => {
        expect(isEncryptionEnabled(undefined)).toBe(false);
        expect(isEncryptionEnabled(null)).toBe(false);
    });

    it("is false when the content carries no usable algorithm", () => {
        expect(isEncryptionEnabled({})).toBe(false);
        expect(isEncryptionEnabled({ algorithm: "" })).toBe(false);
        expect(isEncryptionEnabled({ algorithm: 42 as unknown })).toBe(false);
    });
});

describe("previewForEvent — room-list / notification fallback", () => {
    it("returns the decrypted preview for a cleartext event", () => {
        expect(previewForEvent("m.room.message", "hello")).toBe("hello");
    });

    it("returns the lock placeholder for an undecryptable event", () => {
        expect(previewForEvent("m.room.encrypted", null)).toBe(
            ENCRYPTED_MESSAGE_PLACEHOLDER,
        );
        expect(ENCRYPTED_MESSAGE_PLACEHOLDER).toContain("Encrypted");
    });

    it("ignores any stray preview text on an undecryptable event", () => {
        expect(previewForEvent("m.room.encrypted", "leaked?")).toBe(
            ENCRYPTED_MESSAGE_PLACEHOLDER,
        );
    });

    it("exposes a friendly UTD body constant for the timeline", () => {
        expect(UTD_PLACEHOLDER_TEXT.toLowerCase()).toContain("decrypt");
    });
});
