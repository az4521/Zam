/**
 * Just enough of the ONNX protobuf format to pull a model's float
 * initializers (its weights) out by name, so the WebGPU backend can run the
 * same model.onnx the other backends use without shipping a second copy.
 */

export interface OnnxTensor {
    dims: number[];
    data: Float32Array;
}

const FLOAT = 1;

class Reader {
    constructor(
        readonly buf: Uint8Array,
        public pos: number,
        readonly end: number,
    ) {}

    varint(): number {
        let r = 0;
        let mul = 1;
        let b: number;
        do {
            if (this.pos >= this.end) throw new Error("truncated varint");
            b = this.buf[this.pos++];
            r += (b & 0x7f) * mul;
            mul *= 128;
        } while (b & 0x80);
        return r;
    }

    /** Field number and wire type of the next key. */
    key(): [number, number] {
        const k = this.varint();
        return [Math.floor(k / 8), k & 7];
    }

    /** A length-delimited field's bounds. */
    sub(): Reader {
        const len = this.varint();
        const start = this.pos;
        this.pos += len;
        if (this.pos > this.end) throw new Error("truncated field");
        return new Reader(this.buf, start, this.pos);
    }

    skip(wire: number): void {
        if (wire === 0) this.varint();
        else if (wire === 1) this.pos += 8;
        else if (wire === 2) this.sub();
        else if (wire === 5) this.pos += 4;
        else throw new Error(`unsupported wire type ${wire}`);
    }
}

function readTensor(r: Reader): [string, OnnxTensor] | null {
    let name = "";
    let type = 0;
    const dims: number[] = [];
    let raw: Uint8Array | null = null;
    const floats: number[] = [];
    while (r.pos < r.end) {
        const [field, wire] = r.key();
        if (field === 1 && wire === 0) dims.push(r.varint());
        else if (field === 1 && wire === 2) {
            const p = r.sub();
            while (p.pos < p.end) dims.push(p.varint());
        } else if (field === 2 && wire === 0) type = r.varint();
        else if (field === 4 && wire === 2) {
            const p = r.sub();
            const v = new DataView(
                p.buf.buffer,
                p.buf.byteOffset + p.pos,
                p.end - p.pos,
            );
            for (let i = 0; i + 4 <= v.byteLength; i += 4)
                floats.push(v.getFloat32(i, true));
        } else if (field === 4 && wire === 5) {
            floats.push(
                new DataView(
                    r.buf.buffer,
                    r.buf.byteOffset + r.pos,
                    4,
                ).getFloat32(0, true),
            );
            r.pos += 4;
        } else if (field === 8 && wire === 2) {
            const p = r.sub();
            name = new TextDecoder().decode(p.buf.subarray(p.pos, p.end));
        } else if (field === 9 && wire === 2) {
            const p = r.sub();
            raw = p.buf.subarray(p.pos, p.end);
        } else if (field === 14 && wire === 0) {
            if (r.varint() === 1) throw new Error(`${name}: external data`);
        } else r.skip(wire);
    }
    if (type !== FLOAT) return null;
    let data: Float32Array;
    if (raw) {
        const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
        data = new Float32Array(raw.byteLength / 4);
        for (let i = 0; i < data.length; i++)
            data[i] = dv.getFloat32(i * 4, true);
    } else data = Float32Array.from(floats);
    return [name, { dims, data }];
}

/** Every float initializer in an ONNX model, by name. */
export function readInitializers(
    model: ArrayBuffer | Uint8Array,
): Map<string, OnnxTensor> {
    const buf = model instanceof Uint8Array ? model : new Uint8Array(model);
    const out = new Map<string, OnnxTensor>();
    const top = new Reader(buf, 0, buf.length);
    while (top.pos < top.end) {
        const [field, wire] = top.key();
        if (field !== 7 || wire !== 2) {
            top.skip(wire);
            continue;
        }
        const graph = top.sub();
        while (graph.pos < graph.end) {
            const [gf, gw] = graph.key();
            if (gf === 5 && gw === 2) {
                const t = readTensor(graph.sub());
                if (t) out.set(t[0], t[1]);
            } else graph.skip(gw);
        }
    }
    return out;
}
