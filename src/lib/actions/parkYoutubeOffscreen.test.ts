import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parkYoutubeOffscreen } from "./parkYoutubeOffscreen";

// The viewport observer.
let fireNear: (isIntersecting: boolean) => void;

class FakeObserver {
    constructor(cb: IntersectionObserverCallback) {
        const fire = (isIntersecting: boolean) =>
            cb(
                [{ isIntersecting } as IntersectionObserverEntry],
                this as unknown as IntersectionObserver,
            );
        fireNear = fire;
    }
    observe() {}
    disconnect() {}
}

function frame() {
    const node = document.createElement("iframe");
    document.body.appendChild(node);
    return node;
}

function report(
    node: HTMLIFrameElement,
    info: object,
    origin = "https://www.youtube.com",
) {
    window.dispatchEvent(
        new MessageEvent("message", {
            data: JSON.stringify({ event: "infoDelivery", info }),
            origin,
            source: node.contentWindow,
        }),
    );
}

describe("parkYoutubeOffscreen", () => {
    beforeEach(() => {
        vi.stubGlobal("IntersectionObserver", FakeObserver);
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        document.body.innerHTML = "";
    });

    it("parks a paused player once it is out of view, with its position", () => {
        const node = frame();
        const onPark = vi.fn();
        parkYoutubeOffscreen(node, { onPark, pause: false });
        report(node, { playerState: 2, currentTime: 13.1 });
        fireNear(true);
        expect(onPark).not.toHaveBeenCalled();
        fireNear(false);
        expect(onPark).toHaveBeenCalledWith(13.1);
    });

    it("leaves a playing player alone until it pauses away", () => {
        const node = frame();
        const onPark = vi.fn();
        parkYoutubeOffscreen(node, { onPark, pause: false });
        report(node, { playerState: 1, currentTime: 4 });
        fireNear(false);
        expect(onPark).not.toHaveBeenCalled();
        report(node, { playerState: 2, currentTime: 5 });
        expect(onPark).toHaveBeenCalledWith(5);
    });

    it("never parks a player that has not reported", () => {
        const node = frame();
        const onPark = vi.fn();
        parkYoutubeOffscreen(node, { onPark, pause: false });
        fireNear(false);
        expect(onPark).not.toHaveBeenCalled();
    });

    it("ignores messages from other origins", () => {
        const node = frame();
        const onPark = vi.fn();
        parkYoutubeOffscreen(node, { onPark, pause: false });
        report(node, { playerState: 2 }, "https://evil.example");
        fireNear(false);
        expect(onPark).not.toHaveBeenCalled();
    });

    it("resumes an ended video from the start", () => {
        const node = frame();
        const onPark = vi.fn();
        parkYoutubeOffscreen(node, { onPark, pause: false });
        report(node, { playerState: 0, currentTime: 19 });
        fireNear(false);
        expect(onPark).toHaveBeenCalledWith(0);
    });

    it("pauses a playing video leaving the viewport only when asked", () => {
        const node = frame();
        const post = vi.spyOn(node.contentWindow!, "postMessage");
        const action = parkYoutubeOffscreen(node, {
            onPark: () => {},
            pause: false,
        });
        report(node, { playerState: 1 });
        fireNear(true);
        fireNear(false);
        expect(post).not.toHaveBeenCalledWith(
            expect.stringContaining("pauseVideo"),
            "*",
        );
        action.update({ onPark: () => {}, pause: true });
        fireNear(true);
        fireNear(false);
        expect(post).toHaveBeenCalledWith(
            expect.stringContaining("pauseVideo"),
            "*",
        );
        action.destroy();
    });

    it("parks a paused player in view once the page is hidden", () => {
        const node = frame();
        const onPark = vi.fn();
        parkYoutubeOffscreen(node, { onPark, pause: false });
        report(node, { playerState: 2, currentTime: 7 });
        fireNear(true);
        expect(onPark).not.toHaveBeenCalled();
        const hidden = vi
            .spyOn(document, "hidden", "get")
            .mockReturnValue(true);
        document.dispatchEvent(new Event("visibilitychange"));
        expect(onPark).toHaveBeenCalledWith(7);
        hidden.mockRestore();
    });
});
