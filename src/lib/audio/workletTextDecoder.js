// @ts-nocheck: runs in AudioWorkletGlobalScope and deliberately defines a
// partial TextDecoder (decode only), which the DOM types reject.
// AudioWorklet module, loaded before DeepFilterNet3's worklet in the same
// context (worklet modules share one global scope). Chromium's
// AudioWorkletGlobalScope has no TextDecoder, but wasm-bindgen's glue builds
// one at module top level, so without this the DeepFilterNet3 worklet throws
// before registerProcessor() and the node can never be created. wasm-bindgen
// only decodes error and panic strings with it, so a plain UTF-8 decoder is
// enough.
if (typeof globalThis.TextDecoder === "undefined") {
    globalThis.TextDecoder = class TextDecoder {
        decode(input) {
            if (!input) return "";
            const bytes =
                input instanceof Uint8Array
                    ? input
                    : new Uint8Array(input.buffer ?? input);
            let out = "";
            for (let i = 0; i < bytes.length;) {
                const c = bytes[i++];
                let cp;
                if (c < 0x80) cp = c;
                else if (c < 0xe0) cp = ((c & 0x1f) << 6) | (bytes[i++] & 0x3f);
                else if (c < 0xf0)
                    cp =
                        ((c & 0x0f) << 12) |
                        ((bytes[i++] & 0x3f) << 6) |
                        (bytes[i++] & 0x3f);
                else
                    cp =
                        ((c & 0x07) << 18) |
                        ((bytes[i++] & 0x3f) << 12) |
                        ((bytes[i++] & 0x3f) << 6) |
                        (bytes[i++] & 0x3f);
                out += String.fromCodePoint(cp);
            }
            return out;
        }
    };
}
