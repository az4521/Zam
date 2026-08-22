import { describe, it, expect } from "vitest";
import {
    isUndecryptedEvent,
    isEncryptionEnabled,
    previewForEvent,
    utdPlaceholderText,
    ENCRYPTED_MESSAGE_PLACEHOLDER,
    UTD_PLACEHOLDER_TEXT,
    UTD_WITHHELD_TEXT,
    UTD_WITHHELD_UNVERIFIED_TEXT,
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

describe("utdPlaceholderText — distinguish deliberate withhold from key-lag", () => {
    it("returns the generic key-lag copy when no failure reason is known", () => {
        expect(utdPlaceholderText(null)).toBe(UTD_PLACEHOLDER_TEXT);
        expect(utdPlaceholderText(undefined)).toBe(UTD_PLACEHOLDER_TEXT);
        expect(utdPlaceholderText("")).toBe(UTD_PLACEHOLDER_TEXT);
    });

    it("returns the generic copy for a transient / unknown failure reason", () => {
        // The common case: keys have not arrived yet.
        expect(utdPlaceholderText("MEGOLM_UNKNOWN_INBOUND_SESSION_ID")).toBe(
            UTD_PLACEHOLDER_TEXT,
        );
        // Anything unmapped falls through to the generic line, never a throw.
        expect(utdPlaceholderText("SOME_FUTURE_CODE")).toBe(
            UTD_PLACEHOLDER_TEXT,
        );
    });

    it("returns distinct copy when the sender deliberately withheld the key", () => {
        const text = utdPlaceholderText("MEGOLM_KEY_WITHHELD");
        expect(text).toBe(UTD_WITHHELD_TEXT);
        expect(text).not.toBe(UTD_PLACEHOLDER_TEXT);
    });

    it("returns unverified-device-specific copy for that withhold reason", () => {
        const text = utdPlaceholderText(
            "MEGOLM_KEY_WITHHELD_FOR_UNVERIFIED_DEVICE",
        );
        expect(text).toBe(UTD_WITHHELD_UNVERIFIED_TEXT);
        expect(text).not.toBe(UTD_WITHHELD_TEXT);
        expect(text.toLowerCase()).toContain("verif");
    });

    it("never emits an em dash in the user-facing withhold copy", () => {
        // The build has a guard against em dashes in UI strings; keep these
        // clean at the source too.
        expect(UTD_WITHHELD_TEXT).not.toContain("—");
        expect(UTD_WITHHELD_UNVERIFIED_TEXT).not.toContain("—");
    });
});
