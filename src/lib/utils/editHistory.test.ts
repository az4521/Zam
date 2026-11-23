import { describe, it, expect } from "vitest";
import {
    buildEditHistory,
    normaliseVersionContent,
    type EditHistoryOriginal,
} from "./editHistory";

const ORIGINAL: EditHistoryOriginal = {
    eventId: "$orig",
    sender: "@alice:example.org",
    ts: 1000,
    content: { msgtype: "m.text", body: "first" },
};

const edit = (
    eventId: string,
    ts: number,
    body: string,
    sender = "@alice:example.org",
) => ({
    eventId,
    sender,
    ts,
    content: {
        body: `* ${body}`,
        msgtype: "m.text",
        "m.new_content": { msgtype: "m.text", body },
        "m.relates_to": { rel_type: "m.replace", event_id: "$orig" },
    },
});

describe("buildEditHistory", () => {
    it("returns just the original when there are no edits", () => {
        expect(buildEditHistory(ORIGINAL, [])).toEqual([
            {
                eventId: "$orig",
                ts: 1000,
                content: { msgtype: "m.text", body: "first" },
            },
        ]);
    });

    it("takes m.new_content from each edit and sorts by timestamp", () => {
        const versions = buildEditHistory(ORIGINAL, [
            edit("$e2", 3000, "third"),
            edit("$e1", 2000, "second"),
        ]);
        expect(versions.map((v) => v.eventId)).toEqual(["$orig", "$e1", "$e2"]);
        expect(versions.map((v) => v.content?.body)).toEqual([
            "first",
            "second",
            "third",
        ]);
    });

    it("drops an edit whose sender differs from the original sender", () => {
        const versions = buildEditHistory(ORIGINAL, [
            edit("$forged", 2000, "hacked", "@mallory:example.org"),
            edit("$ok", 3000, "real"),
        ]);
        expect(versions.map((v) => v.eventId)).toEqual(["$orig", "$ok"]);
    });

    it("drops an edit with no m.new_content object", () => {
        const versions = buildEditHistory(ORIGINAL, [
            {
                eventId: "$bare",
                sender: "@alice:example.org",
                ts: 2000,
                content: { body: "* oops", msgtype: "m.text" },
            },
            { eventId: "$nothing", sender: "@alice:example.org", ts: 2500 },
        ]);
        expect(versions.map((v) => v.eventId)).toEqual(["$orig"]);
    });

    it("keeps an undecryptable edit as a flagged entry with no content", () => {
        const versions = buildEditHistory(ORIGINAL, [
            {
                eventId: "$enc",
                sender: "@alice:example.org",
                ts: 2000,
                undecryptable: true,
            },
        ]);
        expect(versions).toEqual([
            {
                eventId: "$orig",
                ts: 1000,
                content: { msgtype: "m.text", body: "first" },
            },
            {
                eventId: "$enc",
                ts: 2000,
                content: null,
                undecryptable: true,
            },
        ]);
    });

    it("still sender-checks an undecryptable edit", () => {
        const versions = buildEditHistory(ORIGINAL, [
            {
                eventId: "$encForged",
                sender: "@mallory:example.org",
                ts: 2000,
                undecryptable: true,
            },
        ]);
        expect(versions.map((v) => v.eventId)).toEqual(["$orig"]);
    });

    it("breaks timestamp ties with the original first, then by event id", () => {
        const versions = buildEditHistory(ORIGINAL, [
            edit("$b", 1000, "b"),
            edit("$a", 1000, "a"),
            edit("$c", 1000, "c"),
        ]);
        expect(versions.map((v) => v.eventId)).toEqual([
            "$orig",
            "$a",
            "$b",
            "$c",
        ]);
    });

    it("places the original first even when an edit shares its timestamp and sorts lower by id", () => {
        const versions = buildEditHistory({ ...ORIGINAL, eventId: "$zzz" }, [
            edit("$aaa", 1000, "same instant"),
        ]);
        expect(versions.map((v) => v.eventId)).toEqual(["$zzz", "$aaa"]);
    });
});

describe("normaliseVersionContent", () => {
    it("returns null for non-object content", () => {
        expect(normaliseVersionContent(undefined)).toBeNull();
        expect(normaliseVersionContent("text")).toBeNull();
        expect(normaliseVersionContent(["x"])).toBeNull();
    });

    it("defaults msgtype and body when absent", () => {
        expect(normaliseVersionContent({})).toEqual({
            msgtype: "m.text",
            body: "",
        });
    });

    it("keeps formatted HTML only when format and formatted_body are both strings", () => {
        expect(
            normaliseVersionContent({
                body: "hi",
                format: "org.matrix.custom.html",
                formatted_body: "<b>hi</b>",
            }),
        ).toEqual({
            msgtype: "m.text",
            body: "hi",
            format: "org.matrix.custom.html",
            formatted_body: "<b>hi</b>",
        });
        expect(
            normaliseVersionContent({
                body: "hi",
                format: "org.matrix.custom.html",
            }),
        ).toEqual({ msgtype: "m.text", body: "hi" });
    });
});
