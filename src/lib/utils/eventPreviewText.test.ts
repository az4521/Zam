import { describe, expect, it } from "vitest";
import type { MatrixEvent } from "matrix-js-sdk";
import { eventPreviewText } from "./eventPreviewText";

const ev = (content: Record<string, unknown>, type = "m.room.message") =>
    ({
        getContent: () => content,
        getType: () => type,
    }) as unknown as MatrixEvent;

const item = (itemtype: string) => ({ itemtype, url: "mxc://hs/x", body: "x" });

describe("eventPreviewText for galleries", () => {
    it("uses a gallery's body when it has one", () => {
        expect(
            eventPreviewText(
                ev({
                    msgtype: "dm.filament.gallery",
                    body: "our trip",
                    itemtypes: [item("m.image")],
                }),
            ),
        ).toBe("our trip");
    });

    it("counts the valid items when the body is empty", () => {
        const preview = eventPreviewText(
            ev({
                msgtype: "m.gallery",
                body: "",
                itemtypes: [
                    item("m.image"),
                    item("m.video"),
                    { itemtype: "m.text" },
                ],
            }),
        );
        expect(preview).toBe("2 attachments");
    });

    it("uses the singular form for one item", () => {
        expect(
            eventPreviewText(
                ev({
                    msgtype: "dm.filament.gallery",
                    body: "",
                    itemtypes: [item("m.file")],
                }),
            ),
        ).toBe("1 attachment");
    });

    it("keeps the single-media placeholders unchanged", () => {
        expect(eventPreviewText(ev({ msgtype: "m.image", body: "" }))).toBe(
            "Image",
        );
    });
});
