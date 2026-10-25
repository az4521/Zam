import { describe, it, expect } from "vitest";
import { FlacRemuxer, parseFrameHeader } from "./flacRemux";
import { id3Size, isFlac } from "./flacProbe";

// 0.5 s of a 300 Hz sine, 8 kHz mono 16-bit, 1024-sample frames (ffmpeg),
// padding block stripped: 4 frames, the last one short.
const TINY_FLAC = Uint8Array.from(
    atob(
        "ZkxhQ4AAACIEAAQAAAFxAAGQAfQA8AAAD6CPKw/33WIpR+oecVchDAeV//ikCADBTgAA" +
            "A7sHQwpjDPEOxw/ND/PmKizC1ekwf2d7z6SinD1TgBJnIRCWfOEEChQlCSgZk5k0CwmS" +
            "TJQCIULC4RM5M5CISz5wggUKEoSUDMnMmgWEySZKARChYXCJnJnIRCWfOEEChQlCSgZk" +
            "5k0CwmSTJQCIULC4RM5M5CISz5wggUKEoSUDMnMmgWEySZKARChYXCJnJnIRCWfOEECh" +
            "QlCSgZk5k0CwmSTJQCIULC4RM5M5CISz5wggUKEoSUDMnMmgWEySZKARChYXCJnJnIRC" +
            "WfOEEChQlCSgZk5k0CwmSTJQCIULC4RM5M5CISz5wggUKEoSUDMnMmgWEySZKARChYXC" +
            "JnJnIRCWfOEEChQlCSgZk5k0CwmSTJQCIULC4RM5M5CISz5wggUKEoSUDMnMmgWEySZK" +
            "ARChYXCJnJnIRCWfOEEChQlCSgZk5k0CwmSTJQCIULC4RM5M5CISz5wggUKEoSUDMnMm" +
            "gWEySZKARChYXCJnJnIRCWfOEEChQlCSgZk5k0CwmZSM//ikCAHGTglnBh8Cgf6/+w/3" +
            "pfSw8l3mKSDNecTYqy+Pn0AjA70kAAhnCsImcmEkgRCFnzhBCmShCUDMnLxAqEySZKAU" +
            "M4VhEzkwkkCIQs+cIIUyUISgZk5eIFQmSTJQChnCsImcmEkgRCFnzhBCmShCUDMnLxAq" +
            "EySZKAUM4VhEzkwkkCIQs+cIIUyUISgZk5eIFQmSTJQChnCsImcmEkgRCFnzhBCmShCU" +
            "DMnLxAqEySZKAUM4VhEzkwkkCIQs+cIIUyUISgZk5eIFQmSTJQChnCsImcmEkgRCFnzh" +
            "BCmShCUDMnLxAqEySZKAUM4VhEzkwkkCIQs+cIIUyUISgZk5eIFQmSTJQChnCsImcmEk" +
            "gRCFnzhBCmShCUDMnLxAqEySZKAUM4VhEzkwkkCIQs+cIIUyUISgZk5eIFQmSTJQChnC" +
            "sImcmEkgRCFnzhBCmShCUDMnLxAqEySZKAUM4VhEzkwkkCIQs+cIIUyUISgZk5eIFQmS" +
            "TJQChnCsImcmEkgRCFnzhBCmShCUDMhbmP/4pAgCz07wyfJc9LD3pPsO/r4CgAYf5ieR" +
            "2WOpdKiv5f70ItL9ZIAIGIS5MlApnDkKZyZ4RIFhJzhEMyUmhmTmSUDEJcmSgUzhyFM5" +
            "M8IkCwk5wiGZKTQzJzJKBiEuTJQKZw5CmcmeESBYSc4RDMlJoZk5klAxCXJkoFM4chTO" +
            "TPCJAsJOcIhmSk0MycySgYhLkyUCmcOQpnJnhEgWEnOEQzJSaGZOZJQMQlyZKBTOHIUz" +
            "kzwiQLCTnCIZkpNDMnMkoGIS5MlApnDkKZyZ4RIFhJzhEMyUmhmTmSUDEJcmSgUzhyFM" +
            "5M8IkCwk5wiGZKTQzJzJKBiEuTJQKZw5CmcmeESBYSc4RDMlJoZk5klAxCXJkoFM4chT" +
            "OTPCJAsJOcIhmSk0MycySgYhLkyUCmcOQpnJnhEgWEnOEQzJSaGZOZJQMQlyZKBTOHIU" +
            "zkzwiQLCTnCIZkpNDMnMkoGIS5MlApnDkKZyZ4RIFhJzhEBxJv/4dAgDA5/DTg83D/IP" +
            "zQ7HDPEKZAdDA7zmKj3G58/wrZd6X1YC4z1FgBiFMmTJKAVCZy4gRDMhkgUM5zwghCzJ" +
            "hJAiBTNOIUyZMkoBUJnLiBEMyGSBQznPCCELMmEkCIFM04hTJkySgFQmcuIEQzIZIFDO" +
            "c8IIQsyYSQIgUzTiFMmTJKAVCZy4gRDMhkgUM5zwghCzJhJAiBTNOIUyZMkoBUJnLiBE" +
            "MyGSBQznPCCELMmEkCIFM04hTJkySgFQmcuIEQzIZIFDOc8IIQsyYSQIgUzTiFMmTJKA" +
            "VCZy4gRDMhkgUM5zwghCzJhJAiBTNOIUyZMkoBUJnLiBEMyGSBQznPCCELMmEkCIFM04" +
            "hTJkySgFQmcuIEQzIZIFDOc8IIQsyYSQIgUzTiFMmTJKAVCZy4gRDMhkgUM5zwghCzJh" +
            "JAiBTNOIUyZMkoBUJnLiBEMyGSBQznPCCELMmEkCIFM04hTJkySgFQmcuIEQzIb1Dg==",
    ),
    (c) => c.charCodeAt(0),
);

function remux(bytes: Uint8Array, chunk: number) {
    const r = new FlacRemuxer();
    const segs: ArrayBuffer[] = [];
    for (let i = 0; i < bytes.length; i += chunk) {
        r.push(bytes.slice(i, i + chunk));
        segs.push(...r.take().map((s) => s.buffer));
    }
    r.end();
    segs.push(...r.take().map((s) => s.buffer));
    return { r, segs };
}

/** Sample count and total duration from every trun in the fragments. */
function trunTotals(segs: ArrayBuffer[]) {
    let samples = 0;
    let duration = 0;
    for (const buf of segs) {
        const b = new Uint8Array(buf);
        const dv = new DataView(buf);
        for (let i = 4; i + 4 <= b.length; i++) {
            if (
                String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]) !==
                "trun"
            )
                continue;
            const count = dv.getUint32(i + 8);
            samples += count;
            for (let k = 0; k < count; k++)
                duration += dv.getUint32(i + 16 + k * 16);
            break;
        }
    }
    return { samples, duration };
}

describe("FlacRemuxer", () => {
    it("reads STREAMINFO into the header", () => {
        const { r } = remux(TINY_FLAC, TINY_FLAC.length);
        expect(r.unsupported).toBeNull();
        expect(r.header?.tracks[0].mime).toBe('audio/mp4; codecs="flac"');
        expect(r.header?.duration).toBeCloseTo(0.5, 5);
    });

    it("finds every frame whatever the chunking", () => {
        for (const chunk of [1, 7, 100, 1000, TINY_FLAC.length]) {
            const { segs } = remux(TINY_FLAC, chunk);
            expect(trunTotals(segs)).toEqual({ samples: 4, duration: 4000 });
        }
    });

    it("skips a leading ID3 tag", () => {
        const tag = new Uint8Array(10 + 300);
        tag.set([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0x02, 0x2c]);
        expect(id3Size(tag)).toBe(310);
        const bytes = new Uint8Array(tag.length + TINY_FLAC.length);
        bytes.set(tag);
        bytes.set(TINY_FLAC, tag.length);
        const { r, segs } = remux(bytes, 64);
        expect(r.unsupported).toBeNull();
        expect(trunTotals(segs).samples).toBe(4);
    });

    it("drops a truncated last frame", () => {
        const { segs } = remux(TINY_FLAC.slice(0, -5), 512);
        expect(trunTotals(segs)).toEqual({ samples: 3, duration: 3072 });
    });

    it("rejects what isn't FLAC", () => {
        const { r } = remux(new Uint8Array(64).fill(1), 64);
        expect(r.header).toBeNull();
        expect(r.unsupported).not.toBeNull();
        expect(isFlac(new Uint8Array([0x66, 0x4c, 0x61, 0x43]))).toBe(true);
    });
});

describe("parseFrameHeader", () => {
    it("rejects a sync code whose CRC-8 is wrong", () => {
        const first = 4 + 4 + 34;
        const ok = parseFrameHeader(TINY_FLAC, first, false);
        expect(ok).toMatchObject({ blockSize: 1024 });
        const bad = TINY_FLAC.slice();
        const len = (ok as { length: number }).length;
        bad[first + len - 1] ^= 0xff;
        expect(parseFrameHeader(bad, first, false)).toBeNull();
    });
});
