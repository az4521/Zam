import { describe, it, expect, vi, beforeEach } from "vitest";

const dispose = vi.fn();
const attachAuthedVideo = vi.fn((..._args: unknown[]) => ({ dispose }));
vi.mock("$lib/matrix/videoStream", () => ({ attachAuthedVideo }));

const { authedVideoSrc } = await import("./authedVideoSrc");

const URL_A = "https://hs.test/_matrix/client/v1/media/download/hs.test/a";
const URL_B = "https://hs.test/_matrix/client/v1/media/download/hs.test/b";

describe("authedVideoSrc — stream lifecycle follows the url param", () => {
    beforeEach(() => {
        attachAuthedVideo.mockClear();
        dispose.mockClear();
    });

    it("does nothing while url is null (the element's own src is in charge)", () => {
        const video = document.createElement("video");
        const action = authedVideoSrc(video, { url: null });
        action.destroy();
        expect(attachAuthedVideo).not.toHaveBeenCalled();
    });

    it("attaches on mount and disposes on destroy", () => {
        const video = document.createElement("video");
        const action = authedVideoSrc(video, {
            url: URL_A,
            mimetype: "video/mp4",
        });
        expect(attachAuthedVideo).toHaveBeenCalledWith(
            video,
            URL_A,
            expect.objectContaining({ mimetype: "video/mp4" }),
        );
        action.destroy();
        expect(dispose).toHaveBeenCalledTimes(1);
    });

    it("restarts only when the url actually changes", () => {
        const video = document.createElement("video");
        const action = authedVideoSrc(video, { url: URL_A });
        // A re-render with a fresh params object but the same url must not
        // tear down a stream mid-playback.
        action.update({ url: URL_A, onError: () => {} });
        expect(attachAuthedVideo).toHaveBeenCalledTimes(1);
        expect(dispose).not.toHaveBeenCalled();

        action.update({ url: URL_B });
        expect(dispose).toHaveBeenCalledTimes(1);
        expect(attachAuthedVideo).toHaveBeenCalledTimes(2);
        expect(attachAuthedVideo.mock.calls[1][1]).toBe(URL_B);
    });

    it("routes errors to the latest onError callback", () => {
        const video = document.createElement("video");
        const first = vi.fn();
        const latest = vi.fn();
        const action = authedVideoSrc(video, { url: URL_A, onError: first });
        action.update({ url: URL_A, onError: latest });
        const opts = attachAuthedVideo.mock.calls[0][2] as {
            onError: () => void;
        };
        opts.onError();
        expect(latest).toHaveBeenCalledTimes(1);
        expect(first).not.toHaveBeenCalled();
    });
});
