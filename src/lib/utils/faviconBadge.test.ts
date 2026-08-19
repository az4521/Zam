import { describe, it, expect, beforeEach, vi } from "vitest";

// Add Image.decode() globally - jsdom doesn't have this method
if (!HTMLImageElement.prototype.decode) {
    HTMLImageElement.prototype.decode = function () {
        return Promise.resolve();
    };
}

describe("updateFaviconBadge", () => {
    let mockContext: any;
    let toDataURLSpy: any;
    let updateFaviconBadge: typeof import("./faviconBadge").updateFaviconBadge;

    beforeEach(async () => {
        // Reset module to clear the originalIcons cache
        vi.resetModules();
        const module = await import("./faviconBadge");
        updateFaviconBadge = module.updateFaviconBadge;

        // Reset DOM: remove any existing favicon links
        document.head.querySelectorAll("link[rel~='icon']").forEach((el) => el.remove());

        // Add a fresh favicon link
        const link = document.createElement("link");
        link.rel = "icon";
        link.type = "image/png";
        link.href = "/favicon.png";
        document.head.appendChild(link);

        // Mock canvas context - jsdom has limited canvas support
        mockContext = {
            drawImage: vi.fn(),
            fillStyle: "",
            beginPath: vi.fn(),
            arc: vi.fn(),
            fill: vi.fn(),
            font: "",
            textAlign: "",
            textBaseline: "",
            fillText: vi.fn(),
        };

        // @ts-expect-error - mocking for test
        HTMLCanvasElement.prototype.getContext = function (type) {
            if (type === "2d") return mockContext;
            return null;
        };

        // Mock toDataURL to return a fake data URL
        toDataURLSpy = vi.fn().mockReturnValue(
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        );
        // @ts-expect-error - mocking for test
        HTMLCanvasElement.prototype.toDataURL = toDataURLSpy;
    });

    it("restores original favicon when count is 0", async () => {
        const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        const originalHref = link.href;

        // Set a badge first
        await updateFaviconBadge(5);
        expect(link.href).not.toBe(originalHref);
        expect(link.href).toMatch(/^data:image\/png/);

        // Clear it
        await updateFaviconBadge(0);
        expect(link.href).toBe(originalHref);
        expect(link.type).toBe("image/png");
    });

    it("restores original favicon when count is negative", async () => {
        const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        const originalHref = link.href;

        await updateFaviconBadge(-1);
        expect(link.href).toBe(originalHref);
    });

    it("generates a data URL for counts 1-99", async () => {
        const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;

        await updateFaviconBadge(42);

        expect(link.href).toMatch(/^data:image\/png;base64,/);
        expect(link.type).toBe("image/png");
    });

    it("caps display at '99+' for counts >= 100", async () => {
        // We can't verify the actual text on the canvas in jsdom, but we can verify:
        // 1. A data URL is generated
        // 2. The function completes without error
        const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;

        await updateFaviconBadge(100);
        expect(link.href).toMatch(/^data:image\/png/);

        await updateFaviconBadge(999);
        expect(link.href).toMatch(/^data:image\/png/);
    });

    it("does nothing when document is undefined (SSR guard)", async () => {
        // This test verifies the typeof document check doesn't throw
        const originalDoc = global.document;
        // @ts-expect-error - testing SSR case
        delete global.document;

        await expect(updateFaviconBadge(5)).resolves.toBeUndefined();

        global.document = originalDoc;
    });

    it("handles concurrent updates via generation tracking", async () => {
        // Start two updates concurrently
        const promise1 = updateFaviconBadge(5);
        const promise2 = updateFaviconBadge(10);

        // Both complete without error
        await Promise.all([promise1, promise2]);

        // The link is updated (we can't predict which generation won, but it should be one of them)
        const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        expect(link.href).toMatch(/^data:image\/png/);
    });

    it("updates all favicon links when multiple exist", async () => {
        // Add a second favicon link (some sites have multiple sizes)
        const link2 = document.createElement("link");
        link2.rel = "icon";
        link2.type = "image/x-icon";
        link2.href = "/favicon.ico";
        document.head.appendChild(link2);

        await updateFaviconBadge(7);

        const links = Array.from(document.querySelectorAll<HTMLLinkElement>("link[rel~='icon']"));
        expect(links).toHaveLength(2);

        // Both should be updated to the same data URL
        links.forEach((link) => {
            expect(link.href).toMatch(/^data:image\/png/);
            expect(link.type).toBe("image/png");
        });
    });

    it("remembers original hrefs across multiple badge updates", async () => {
        const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        const originalHref = link.href;

        // Badge on
        await updateFaviconBadge(1);
        expect(link.href).not.toBe(originalHref);

        // Badge updated to different count
        await updateFaviconBadge(99);
        expect(link.href).toMatch(/^data:image\/png/);

        // Badge off — should restore the ORIGINAL href, not the first data URL
        await updateFaviconBadge(0);
        expect(link.href).toBe(originalHref);
    });
});
