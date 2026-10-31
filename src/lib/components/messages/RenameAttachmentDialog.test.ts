import { describe, it, expect, afterEach, vi } from "vitest";
import { mount, unmount, flushSync } from "svelte";
import RenameAttachmentDialog from "./RenameAttachmentDialog.svelte";
import { t } from "$lib/i18n";

let instance: Record<string, unknown> | null = null;
let host: HTMLElement | null = null;

function render(
    direct: boolean,
    canSendDirectly = true,
    preview: { previewUrl: string | null; video: boolean } = {
        previewUrl: null,
        video: false,
    },
) {
    const props = {
        onSave: vi.fn(),
        onDirectChange: canSendDirectly ? vi.fn() : undefined,
        onClose: vi.fn(),
    };
    host = document.createElement("div");
    document.body.appendChild(host);
    instance = mount(RenameAttachmentDialog, {
        target: host,
        props: { name: "a.webm", direct, ...preview, ...props },
    });
    flushSync();
    return props;
}

const toggle = () => host!.querySelector<HTMLElement>('[role="switch"]');

function clickButton(label: string) {
    [...host!.querySelectorAll("button")]
        .find((b) => b.textContent?.trim() === label)!
        .click();
    flushSync();
}

afterEach(() => {
    if (instance) unmount(instance);
    host?.remove();
    instance = null;
    host = null;
});

describe("preview", () => {
    it("is a playable video for a video", () => {
        render(false, true, { previewUrl: "blob:v", video: true });
        expect(host!.querySelector("video")?.controls).toBe(true);
        expect(host!.querySelector("img")).toBeNull();
    });

    it("is an image for an image", () => {
        render(false, true, { previewUrl: "blob:i", video: false });
        expect(host!.querySelector("img")?.getAttribute("src")).toBe("blob:i");
        expect(host!.querySelector("video")).toBeNull();
    });

    it("is absent for anything else", () => {
        render(false);
        expect(host!.querySelector("img, video")).toBeNull();
    });
});

describe("direct send toggle", () => {
    it("is hidden where a file can't be sent directly", () => {
        render(false, false);
        expect(toggle()).toBeNull();
    });

    it("starts on for a file already going direct", () => {
        render(true);
        expect(toggle()!.getAttribute("aria-checked")).toBe("true");
    });

    it("applies on save, without touching the name", () => {
        const { onSave, onDirectChange, onClose } = render(false);
        toggle()!.click();
        flushSync();
        expect(onDirectChange).not.toHaveBeenCalled();
        clickButton(t("common.save"));
        expect(onDirectChange).toHaveBeenCalledWith(true);
        expect(onSave).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
    });

    it("can turn a direct file back into an upload", () => {
        const { onDirectChange } = render(true);
        toggle()!.click();
        flushSync();
        clickButton(t("common.save"));
        expect(onDirectChange).toHaveBeenCalledWith(false);
    });

    it("is discarded on cancel", () => {
        const { onDirectChange, onClose } = render(false);
        toggle()!.click();
        flushSync();
        clickButton(t("common.cancel"));
        expect(onDirectChange).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
    });

    it("stays quiet when saved unchanged", () => {
        const { onDirectChange } = render(true);
        clickButton(t("common.save"));
        expect(onDirectChange).not.toHaveBeenCalled();
    });
});
