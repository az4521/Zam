import { describe, it, expect } from "vitest";
import {
    KeyExportFileError,
    decryptKeyExportFile,
    encryptKeyExportFile,
} from "./keyExportFile";

// Few rounds: PBKDF2 at the real default would make each test take seconds.
const ROUNDS = 10;
const KEYS = JSON.stringify([
    {
        algorithm: "m.megolm.v1.aes-sha2",
        room_id: "!room:example.org",
        session_id: "abc",
        session_key: "def",
        sender_key: "ghi",
        sender_claimed_keys: {},
        forwarding_curve25519_key_chain: [],
    },
]);

async function reason(p: Promise<unknown>): Promise<string> {
    try {
        await p;
    } catch (e) {
        if (e instanceof KeyExportFileError) return e.reason;
        throw e;
    }
    return "resolved";
}

/** The file's raw bytes, for tampering. */
function bodyOf(file: string): Uint8Array {
    const b64 = file
        .split("\n")
        .filter((l) => l && !l.startsWith("-----"))
        .join("");
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function fileOf(body: Uint8Array): string {
    const b64 = btoa(String.fromCharCode(...body));
    return `-----BEGIN MEGOLM SESSION DATA-----\n${b64}\n-----END MEGOLM SESSION DATA-----\n`;
}

describe("key export file", () => {
    it("round-trips the key list with the right passphrase", async () => {
        const file = await encryptKeyExportFile(KEYS, "correct horse", ROUNDS);
        expect(await decryptKeyExportFile(file, "correct horse")).toBe(KEYS);
    });

    it("writes the armoured layout other clients read", async () => {
        const file = await encryptKeyExportFile(KEYS, "pw", ROUNDS);
        const lines = file.trimEnd().split("\n");
        expect(lines[0]).toBe("-----BEGIN MEGOLM SESSION DATA-----");
        expect(lines[lines.length - 1]).toBe(
            "-----END MEGOLM SESSION DATA-----",
        );
        for (const l of lines.slice(1, -1)) {
            expect(l.length).toBeLessThanOrEqual(96);
        }
        const body = bodyOf(file);
        expect(body[0]).toBe(1);
        // Rounds, big-endian, after version + salt + IV.
        expect(new DataView(body.buffer).getUint32(33)).toBe(ROUNDS);
        // Bit 63 of the counter block is clear.
        expect(body[17 + 8] & 0x80).toBe(0);
        // version + salt + iv + rounds + ciphertext + mac
        expect(body.length).toBe(
            37 + new TextEncoder().encode(KEYS).length + 32,
        );
    });

    it("reports a wrong passphrase", async () => {
        const file = await encryptKeyExportFile(KEYS, "right", ROUNDS);
        expect(await reason(decryptKeyExportFile(file, "wrong"))).toBe(
            "passphrase",
        );
    });

    it("detects a tampered ciphertext as a passphrase/integrity failure", async () => {
        const body = bodyOf(await encryptKeyExportFile(KEYS, "pw", ROUNDS));
        body[40] ^= 1;
        expect(await reason(decryptKeyExportFile(fileOf(body), "pw"))).toBe(
            "passphrase",
        );
    });

    it("rejects an unknown version", async () => {
        const body = bodyOf(await encryptKeyExportFile(KEYS, "pw", ROUNDS));
        body[0] = 2;
        expect(await reason(decryptKeyExportFile(fileOf(body), "pw"))).toBe(
            "version",
        );
    });

    it("rejects text that isn't a key export file", async () => {
        expect(await reason(decryptKeyExportFile("hello", "pw"))).toBe(
            "format",
        );
        expect(
            await reason(
                decryptKeyExportFile(
                    "-----BEGIN MEGOLM SESSION DATA-----\nAAAA\n-----END MEGOLM SESSION DATA-----",
                    "pw",
                ),
            ),
        ).toBe("format");
        expect(
            await reason(
                decryptKeyExportFile(
                    "-----BEGIN MEGOLM SESSION DATA-----\n!!!\n-----END MEGOLM SESSION DATA-----",
                    "pw",
                ),
            ),
        ).toBe("format");
    });

    it("accepts CRLF line endings and surrounding text", async () => {
        const file = await encryptKeyExportFile(KEYS, "pw", ROUNDS);
        const crlf = "exported from Zam\r\n" + file.replace(/\n/g, "\r\n");
        expect(await decryptKeyExportFile(crlf, "pw")).toBe(KEYS);
    });
});

// Vectors from Element Web's MegolmExportEncryption tests: files another
// client produced must decrypt here, not just our own round trip.
describe("key export file: Element compatibility", () => {
    const VECTORS: [string, string, string][] = [
        [
            "plain",
            "password",
            "-----BEGIN MEGOLM SESSION DATA-----\n" +
                "AXNhbHRzYWx0c2FsdHNhbHSIiIiIiIiIiIiIiIiIiIiIAAAACmIRUW2OjZ3L2l6j9h0lHlV3M2dx\n" +
                "cissyYBxjsfsAndErh065A8=\n" +
                "-----END MEGOLM SESSION DATA-----",
        ],
        [
            "Hello, World",
            "betterpassword",
            "-----BEGIN MEGOLM SESSION DATA-----\n" +
                "AW1vcmVzYWx0bW9yZXNhbHT//////////wAAAAAAAAAAAAAD6KyBpe1Niv5M5NPm4ZATsJo5nghk\n" +
                "KYu63a0YQ5DRhUWEKk7CcMkrKnAUiZny\n" +
                "-----END MEGOLM SESSION DATA-----",
        ],
        [
            "alphanumericallyalphanumericallyalphanumericallyalphanumerically",
            "SWORDFISH",
            "-----BEGIN MEGOLM SESSION DATA-----\n" +
                "AXllc3NhbHR5Z29vZG5lc3P//////////wAAAAAAAAAAAAAD6OIW+Je7gwvjd4kYrb+49gKCfExw\n" +
                "MgJBMD4mrhLkmgAngwR1pHjbWXaoGybtiAYr0moQ93GrBQsCzPbvl82rZhaXO3iH5uHo/RCEpOqp\n" +
                "Pgg29363BGR+/Ripq/VCLKGNbw==\n" +
                "-----END MEGOLM SESSION DATA-----",
        ],
    ];

    it.each(VECTORS)("decrypts %j", async (plain, password, file) => {
        expect(await decryptKeyExportFile(file, password)).toBe(plain);
    });
});
