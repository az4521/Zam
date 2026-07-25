import { describe, it, expect } from "vitest";
import { shouldNotifyThreadEvent } from "./threadNotify";

const base = {
    isOwnEvent: false,
    notify: true,
    isParticipant: false,
    isMentioned: false,
};

describe("shouldNotifyThreadEvent", () => {
    it("never notifies for the user's own reply", () => {
        expect(
            shouldNotifyThreadEvent({
                ...base,
                isOwnEvent: true,
                isParticipant: true,
                isMentioned: true,
            }),
        ).toBe(false);
    });

    it("does not notify when push rules suppress it (muted room)", () => {
        expect(
            shouldNotifyThreadEvent({
                ...base,
                notify: false,
                isParticipant: true,
            }),
        ).toBe(false);
        expect(
            shouldNotifyThreadEvent({
                ...base,
                notify: false,
                isMentioned: true,
            }),
        ).toBe(false);
    });

    it("notifies a thread participant on a normal reply", () => {
        expect(shouldNotifyThreadEvent({ ...base, isParticipant: true })).toBe(
            true,
        );
    });

    it("notifies a non-participant when mentioned", () => {
        expect(shouldNotifyThreadEvent({ ...base, isMentioned: true })).toBe(
            true,
        );
    });

    it("does not notify a non-participant who is not mentioned", () => {
        expect(shouldNotifyThreadEvent({ ...base })).toBe(false);
    });

    it("notifies when both participant and mentioned", () => {
        expect(
            shouldNotifyThreadEvent({
                ...base,
                isParticipant: true,
                isMentioned: true,
            }),
        ).toBe(true);
    });
});
