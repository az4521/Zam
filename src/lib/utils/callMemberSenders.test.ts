import { describe, it, expect } from "vitest";
import { callMemberSendersMissingMembership } from "./callMemberSenders";

const joined = new Set(["@known:x"]);
const isJoined = (u: string) => joined.has(u);

describe("callMemberSendersMissingMembership", () => {
    it("names active call members with no known membership", () => {
        expect(
            callMemberSendersMissingMembership(
                [
                    { sender: "@known:x", active: true },
                    { sender: "@stranger:x", active: true },
                ],
                isJoined,
            ),
        ).toEqual(["@stranger:x"]);
    });

    it("ignores memberships that were emptied (left the call)", () => {
        expect(
            callMemberSendersMissingMembership(
                [{ sender: "@stranger:x", active: false }],
                isJoined,
            ),
        ).toEqual([]);
    });

    it("lists a sender once across several devices", () => {
        expect(
            callMemberSendersMissingMembership(
                [
                    { sender: "@stranger:x", active: true },
                    { sender: "@stranger:x", active: true },
                ],
                isJoined,
            ),
        ).toEqual(["@stranger:x"]);
    });

    it("skips events without a sender", () => {
        expect(
            callMemberSendersMissingMembership(
                [{ sender: undefined, active: true }],
                isJoined,
            ),
        ).toEqual([]);
    });
});
