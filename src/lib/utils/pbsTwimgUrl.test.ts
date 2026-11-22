import { describe, expect, it } from "vitest";
import { isDirectPbsImageUrl } from "./pbsTwimgUrl";

describe("isDirectPbsImageUrl", () => {
    it("accepts photo and card image links on pbs.twimg.com", () => {
        for (const u of [
            "https://pbs.twimg.com/media/abc123.jpg",
            "https://pbs.twimg.com/media/HxYz9?format=jpg&name=large",
            "https://pbs.twimg.com/card_img/2122691233717817344/W04J7qqN?format=jpg&name=800x419",
        ]) {
            expect(isDirectPbsImageUrl(u)).toBe(true);
        }
    });

    it("refuses other hosts, schemes, ports and credentials", () => {
        for (const u of [
            "http://pbs.twimg.com/media/a.jpg",
            "https://pbs.twimg.com.evil.example/media/a.jpg",
            "https://evil.example/pbs.twimg.com/media/a.jpg",
            "https://abs.twimg.com/media/a.jpg",
            "https://user@pbs.twimg.com/media/a.jpg",
            "https://pbs.twimg.com:8443/media/a.jpg",
        ]) {
            expect(isDirectPbsImageUrl(u)).toBe(false);
        }
    });

    it("refuses other paths on the host", () => {
        for (const u of [
            "https://pbs.twimg.com/profile_images/1/a_200x200.jpg",
            "https://pbs.twimg.com/profile_banners/1/2",
            "https://pbs.twimg.com/media",
            "https://pbs.twimg.com/media/",
            "https://pbs.twimg.com/",
        ]) {
            expect(isDirectPbsImageUrl(u)).toBe(false);
        }
    });

    it("refuses missing or malformed values", () => {
        expect(isDirectPbsImageUrl(null)).toBe(false);
        expect(isDirectPbsImageUrl(undefined)).toBe(false);
        expect(isDirectPbsImageUrl("")).toBe(false);
        expect(isDirectPbsImageUrl("not a url")).toBe(false);
        expect(isDirectPbsImageUrl("javascript:alert(1)")).toBe(false);
    });
});
