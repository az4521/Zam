import { afterEach, describe, expect, it, vi } from "vitest";
import { encryptAttachment } from "$lib/utils/encryptAttachment";
import { decryptAttachment } from "$lib/utils/decryptAttachment";
import { openAuthedReader, type ChunkReader } from "./mediaStream";

vi.mock("./runtime", () => ({
    matrixClient: {
        getHomeserverUrl: () => "https://hs.example",
        getAccessToken: () => "token",
    },
}));

const URL_ = "https://hs.example/_matrix/media/v3/download/hs.example/abc";

async function readAll(r: ChunkReader): Promise<Uint8Array> {
    const parts: Uint8Array[] = [];
    for (;;) {
        const x = await r.read();
        if (x.done) break;
        parts.push(x.value);
    }
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of parts) {
        out.set(p, at);
        at += p.length;
    }
    return out;
}

function plaintext(n: number): Uint8Array<ArrayBuffer> {
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) out[i] = (i * 17 + 3) & 0xff;
    return out;
}

/** A fetch stub that answers with `respond(init)` and records the request. */
function stubFetch(respond: (headers: Record<string, string>) => Response): {
    headers: () => Record<string, string>;
} {
    let seen: Record<string, string> = {};
    vi.stubGlobal(
        "fetch",
        vi.fn(async (_url: string, init?: RequestInit) => {
            seen = { ...(init?.headers as Record<string, string>) };
            return respond(seen);
        }),
    );
    return { headers: () => seen };
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("openAuthedReader with a prefix", () => {
    it("asks for the rest of the file and yields it whole when the range is honoured", async () => {
        const plain = plaintext(5_000);
        const { data, info } = await encryptAttachment(
            plain.buffer as ArrayBuffer,
        );
        const cipher = new Uint8Array(data);
        const prefix = plain.slice(0, 40); // offset 32
        const seen = stubFetch(
            () =>
                new Response(cipher.slice(32), {
                    status: 206,
                    headers: {
                        "Content-Range": `bytes 32-${cipher.length - 1}/${cipher.length}`,
                    },
                }),
        );

        const reader = await openAuthedReader(URL_, {
            decrypt: info,
            prefix,
            expectedSize: cipher.length,
        });
        expect(seen.headers().Range).toBe("bytes=32-");
        expect(seen.headers().Authorization).toBe("Bearer token");
        expect(await readAll(reader)).toEqual(plain);
    });

    it("reads a plain 200 (range ignored) from byte 0, as an ordinary download", async () => {
        const plain = plaintext(5_000);
        const { data, info } = await encryptAttachment(
            plain.buffer as ArrayBuffer,
        );
        stubFetch(() => new Response(new Uint8Array(data), { status: 200 }));
        const reader = await openAuthedReader(URL_, {
            decrypt: info,
            prefix: plain.slice(0, 40),
        });
        expect(await readAll(reader)).toEqual(plain);
    });

    it("refuses a 206 that does not start at the prefix's block", async () => {
        const plain = plaintext(5_000);
        const { data, info } = await encryptAttachment(
            plain.buffer as ArrayBuffer,
        );
        const cipher = new Uint8Array(data);
        stubFetch(
            () =>
                new Response(cipher.slice(16), {
                    status: 206,
                    headers: {
                        "Content-Range": `bytes 16-${cipher.length - 1}/${cipher.length}`,
                    },
                }),
        );
        await expect(
            openAuthedReader(URL_, {
                decrypt: info,
                prefix: plain.slice(0, 40),
            }),
        ).rejects.toThrow(/does not start at the prefix/);
    });

    it("rejects the final read when the held prefix was tampered with", async () => {
        const plain = plaintext(5_000);
        const { data, info } = await encryptAttachment(
            plain.buffer as ArrayBuffer,
        );
        const cipher = new Uint8Array(data);
        const prefix = plain.slice(0, 40);
        prefix[3] ^= 0x40;
        stubFetch(
            () =>
                new Response(cipher.slice(32), {
                    status: 206,
                    headers: {
                        "Content-Range": `bytes 32-${cipher.length - 1}/${cipher.length}`,
                    },
                }),
        );
        const reader = await openAuthedReader(URL_, { decrypt: info, prefix });
        await expect(readAll(reader)).rejects.toThrow(/integrity/);
    });

    it("works for a plain file too, with the overlap checked", async () => {
        const plain = plaintext(5_000);
        stubFetch(
            () =>
                new Response(plain.slice(32), {
                    status: 206,
                    headers: {
                        "Content-Range": `bytes 32-4999/5000`,
                    },
                }),
        );
        const reader = await openAuthedReader(URL_, {
            prefix: plain.slice(0, 40),
        });
        expect(await readAll(reader)).toEqual(plain);
    });

    it("sends no Range when there is no prefix to skip", async () => {
        const plain = plaintext(300);
        const seen = stubFetch(() => new Response(plain, { status: 200 }));
        const reader = await openAuthedReader(URL_);
        expect(seen.headers().Range).toBeUndefined();
        expect(await readAll(reader)).toEqual(plain);
    });

    it("the whole plaintext still verifies against the event's hash", async () => {
        const plain = plaintext(5_000);
        const { data, info } = await encryptAttachment(
            plain.buffer as ArrayBuffer,
        );
        // Sanity: the ordinary decrypt of the same bytes agrees.
        expect(new Uint8Array(await decryptAttachment(data, info))).toEqual(
            plain,
        );
    });
});
