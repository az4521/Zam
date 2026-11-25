import { describe, expect, it } from "vitest";
import { toMirroredKeys } from "./iosPushKeys";

describe("toMirroredKeys", () => {
    it("keeps the fields the extension needs from megolm keys", () => {
        const json = JSON.stringify([
            {
                algorithm: "m.megolm.v1.aes-sha2",
                room_id: "!r:x",
                session_id: "s1",
                session_key: "AQAAAA",
                sender_key: "curve",
                sender_claimed_keys: { ed25519: "ed" },
                forwarding_curve25519_key_chain: [],
            },
        ]);
        expect(toMirroredKeys(json)).toEqual([
            {
                room_id: "!r:x",
                session_id: "s1",
                session_key: "AQAAAA",
                sender_key: "curve",
            },
        ]);
    });

    it("drops other algorithms and malformed entries", () => {
        const json = JSON.stringify([
            {
                algorithm: "m.olm.v1",
                room_id: "!r",
                session_id: "s",
                session_key: "k",
            },
            {
                algorithm: "m.megolm.v1.aes-sha2",
                room_id: "!r",
                session_id: 5,
                session_key: "k",
            },
            null,
            "x",
        ]);
        expect(toMirroredKeys(json)).toEqual([]);
    });

    it("survives invalid JSON", () => {
        expect(toMirroredKeys("not json")).toEqual([]);
        expect(toMirroredKeys("{}")).toEqual([]);
    });
});
