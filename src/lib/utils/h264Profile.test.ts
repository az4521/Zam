import { describe, it, expect } from "vitest";
import { baselineH264Answer } from "./h264Profile";

const sdp = (lines: string[]) => lines.join("\r\n") + "\r\n";

describe("baselineH264Answer", () => {
    it("declares Baseline on the video H.264 formats", () => {
        const answer = sdp([
            "v=0",
            "m=audio 9 UDP/TLS/RTP/SAVPF 111",
            "a=fmtp:111 minptime=10;useinbandfec=1",
            "m=video 9 UDP/TLS/RTP/SAVPF 102",
            "a=rtpmap:102 H264/90000",
            "a=fmtp:102 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f",
        ]);
        expect(baselineH264Answer(answer)).toBe(
            answer.replace(
                "profile-level-id=42e01f",
                "profile-level-id=42001f",
            ),
        );
    });

    it("leaves other profiles and sections alone", () => {
        const answer = sdp([
            "m=audio 9 UDP/TLS/RTP/SAVPF 111",
            "a=fmtp:111 profile-level-id=42e01f",
            "m=video 9 UDP/TLS/RTP/SAVPF 102",
            "a=fmtp:102 profile-level-id=640c1f",
        ]);
        expect(baselineH264Answer(answer)).toBe(answer);
    });
});
