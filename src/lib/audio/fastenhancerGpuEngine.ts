/// <reference types="@webgpu/types" />
/**
 * FastEnhancer's network on WebGPU: the same computation as
 * scripts/fastenhancer/src/lib.rs from the compressed spectrum to the complex
 * mask, as a fixed list of WGSL compute dispatches (28 for Base, 23 for
 * Tiny), one thread per output value. The STFT, the mask's application and
 * the overlap-add stay on the audio thread (FeStft in fastenhancer.worklet.js),
 * so a hop costs one 4 KB write, one command buffer and one 4 KB read back.
 *
 * Weights are the same flat file the wasm engine reads, uploaded as is; the
 * GRU states stay on the GPU between hops. Frames pipeline: `process` writes
 * and submits before it returns, so several can be in flight, run in order.
 */

export interface FeDims {
    c: number;
    f: number;
    r: number;
    rf: number;
    blocks: number;
    heads: number;
}

/** Bins the network sees (n_fft / 2; the last is dropped). */
export const FE_NB = 512;
/** Floats in a frame each way: re then im, FE_NB each. */
export const FE_SPEC = 2 * FE_NB;
const WG = 64;
/** Read-back buffers a session keeps for reuse. */
const STAGING = 8;

interface Kernel {
    name: string;
    code: string;
    groups: number;
}

export interface FePlan {
    kernels: Kernel[];
    memSize: number;
    io: { input: number; output: number };
}

const u = (n: number) => `${n}u`;

const PRELUDE = `
@group(0) @binding(0) var<storage, read> W: array<f32>;
@group(0) @binding(1) var<storage, read_write> M: array<f32>;
fn sigm(x: f32) -> f32 { return 1.0 / (1.0 + exp(-clamp(x, -87.0, 87.0))); }
fn silu(x: f32) -> f32 { return x * sigm(x); }
fn tanh2(x: f32) -> f32 { return 2.0 * sigm(2.0 * x) - 1.0; }
`;

/** The dispatches for a model of size `d` over a weights file of
 *  `weightFloats` floats (throws if they don't match). */
export function fePlan(d: FeDims, weightFloats: number): FePlan {
    const { c: C, f: F, r: R, rf: RF, blocks: B, heads: HEADS } = d;
    if (F * 4 !== FE_NB || R % HEADS !== 0)
        throw new Error("FastEnhancer: unsupported sizes");
    const HD = R / HEADS;

    // Weight offsets, in the order pack.py writes them.
    let pos = 0;
    const take = (n: number) => {
        const o = pos;
        pos += n;
        return o;
    };
    const encPre = { w: take(C * 8 * 2), b: take(C) };
    const enc = [0, 1].map(() => ({ w: take(C * C * 3), b: take(C) }));
    const rfPreM = take(F * RF);
    const rfPre = { w: take(R * C), b: take(R) };
    const blocks = Array.from({ length: B }, (_, k) => ({
        wi: take(3 * R * R),
        wh: take(3 * R * R),
        bias: take(6 * R),
        fc: take(R * R),
        fcB: take(R),
        pe: k === 0 ? take(RF * R) : -1,
        qkv: take(R * 3 * R),
        afc: take(R * R),
        afcB: take(R),
    }));
    const rfPostM = take(RF * F);
    const rfPost = { w: take(C * R), b: take(C) };
    const dec = [0, 1].map(() => ({
        a: { w: take(C * 2 * C), b: take(C) },
        b: { w: take(C * C * 3), b: take(C) },
    }));
    const decPost = { w: take(C * 2 * C), b: take(C) };
    const up = { w: take(C * 2 * 8), b: take(2) };
    if (pos !== weightFloats)
        throw new Error(
            `FastEnhancer: weights have ${weightFloats} floats, sizes need ${pos}`,
        );

    // The mutable buffer.
    let size = 0;
    const alloc = (n: number) => {
        const o = size;
        size += n;
        return o;
    };
    const IN = alloc(FE_SPEC);
    const OUT = alloc(FE_SPEC);
    const A0 = alloc(C * F);
    const A1 = alloc(C * F);
    const A2 = alloc(C * F);
    const M1 = alloc(C * RF);
    const X = alloc(RF * R);
    const X2 = alloc(RF * R);
    const HN = alloc(RF * R);
    const ATT = alloc(RF * R);
    const QKV = alloc(RF * 3 * R);
    const CACHE = blocks.map(() => alloc(RF * R));
    const M2 = alloc(R * F);
    const D = alloc(C * F);
    const U = alloc(C * F);

    const kernels: Kernel[] = [];
    /** A kernel of `count` threads; `body` sees the thread's index `i`. */
    const kern = (name: string, count: number, body: string) =>
        kernels.push({
            name,
            groups: Math.ceil(count / WG),
            code: `${PRELUDE}
@compute @workgroup_size(${WG}) fn main(@builtin(global_invocation_id) g: vec3u) {
  let i = g.x;
  if (i >= ${u(count)}) { return; }
${body}
}`,
        });

    /** conv1d over [cin][T] rows (cin the sources' channels, concatenated)
     *  to [cout][T], with bias, SiLU if `act`. */
    const conv = (
        name: string,
        cout: number,
        K: number,
        pad: number,
        srcs: [number, number][],
        dst: number,
        w: { w: number; b: number },
        act: boolean,
    ) => {
        const cin = srcs.reduce((a, [, ch]) => a + ch, 0);
        let base = 0;
        let loops = "";
        for (const [off, ch] of srcs) {
            loops += `
  for (var c = 0u; c < ${u(ch)}; c++) {
    for (var k = 0u; k < ${u(K)}; k++) {
      let tt = i32(t + k) - ${pad};
      if (tt >= 0 && tt < ${F}) {
        acc += W[${u(w.w)} + (o * ${u(cin)} + ${u(base)} + c) * ${u(K)} + k] * M[${u(off)} + c * ${u(F)} + u32(tt)];
      }
    }
  }`;
            base += ch;
        }
        kern(
            name,
            cout * F,
            `  let o = i / ${u(F)};
  let t = i % ${u(F)};
  var acc = W[${u(w.b)} + o];${loops}
  M[${u(dst)} + i] = ${act ? "silu(acc)" : "acc"};`,
        );
    };

    // ---- encoder prenet: pad 2, stride 4 folded into 8 channels ----
    kern(
        "enc_pre",
        C * F,
        `  let o = i / ${u(F)};
  let t = i % ${u(F)};
  var acc = W[${u(encPre.b)} + o];
  for (var cc = 0u; cc < 8u; cc++) {
    let s = cc / 2u;
    let ch = cc % 2u;
    for (var k = 0u; k < 2u; k++) {
      let idx = i32((t + k) * 4u + s) - 2;
      if (idx >= 0 && idx < ${FE_NB}) {
        acc += W[${u(encPre.w)} + (o * 8u + cc) * 2u + k] * M[${u(IN)} + ch * ${u(FE_NB)} + u32(idx)];
      }
    }
  }
  M[${u(A0)} + i] = silu(acc);`,
    );
    conv("enc0", C, 3, 1, [[A0, C]], A1, enc[0], true);
    conv("enc1", C, 3, 1, [[A1, C]], A2, enc[1], true);

    // ---- RNNFormer prenet: [c][f] @ [f][rf], then c -> r per frequency ----
    kern(
        "rf_pre_m",
        C * RF,
        `  let ci = i / ${u(RF)};
  let j = i % ${u(RF)};
  var acc = 0.0;
  for (var fi = 0u; fi < ${u(F)}; fi++) {
    acc += M[${u(A2)} + ci * ${u(F)} + fi] * W[${u(rfPreM)} + fi * ${u(RF)} + j];
  }
  M[${u(M1)} + i] = acc;`,
    );
    kern(
        "rf_pre",
        RF * R,
        `  let j = i / ${u(R)};
  let o = i % ${u(R)};
  var acc = W[${u(rfPre.b)} + o];
  for (var ci = 0u; ci < ${u(C)}; ci++) {
    acc += M[${u(M1)} + ci * ${u(RF)} + j] * W[${u(rfPre.w)} + o * ${u(C)} + ci];
  }
  M[${u(X)} + i] = acc;`,
    );

    // ---- RNNFormer blocks ----
    const scale = 1 / Math.sqrt(HD);
    blocks.forEach((bl, k) => {
        const H = CACHE[k];
        // GRU: one step per frequency row; thread (j, unit).
        kern(
            `gru${k}`,
            RF * R,
            `  let j = i / ${u(R)};
  let un = i % ${u(R)};
  var gi = array<f32, 3>(0.0, 0.0, 0.0);
  var gh = array<f32, 3>(0.0, 0.0, 0.0);
  for (var gate = 0u; gate < 3u; gate++) {
    let G = gate * ${u(R)} + un;
    var a = W[${u(bl.bias)} + G];
    var b = W[${u(bl.bias + 3 * R)} + G];
    for (var q = 0u; q < ${u(R)}; q++) {
      a += M[${u(X)} + j * ${u(R)} + q] * W[${u(bl.wi)} + G * ${u(R)} + q];
      b += M[${u(H)} + j * ${u(R)} + q] * W[${u(bl.wh)} + G * ${u(R)} + q];
    }
    gi[gate] = a;
    gh[gate] = b;
  }
  let z = sigm(gi[0] + gh[0]);
  let rr = sigm(gi[1] + gh[1]);
  let nn = tanh2(gi[2] + rr * gh[2]);
  M[${u(HN)} + i] = (1.0 - z) * nn + z * M[${u(H)} + i];`,
        );
        // x2 = fc(hn) + x (+ pe); the GRU state moves on.
        kern(
            `fc${k}`,
            RF * R,
            `  let j = i / ${u(R)};
  let o = i % ${u(R)};
  var acc = W[${u(bl.fcB)} + o];
  for (var ci = 0u; ci < ${u(R)}; ci++) {
    acc += M[${u(HN)} + j * ${u(R)} + ci] * W[${u(bl.fc)} + o * ${u(R)} + ci];
  }
  acc += M[${u(X)} + i];${bl.pe >= 0 ? `\n  acc += W[${u(bl.pe)} + i];` : ""}
  M[${u(X2)} + i] = acc;
  M[${u(H)} + i] = M[${u(HN)} + i];`,
        );
        kern(
            `qkv${k}`,
            RF * 3 * R,
            `  let j = i / ${u(3 * R)};
  let m = i % ${u(3 * R)};
  var acc = 0.0;
  for (var ci = 0u; ci < ${u(R)}; ci++) {
    acc += M[${u(X2)} + j * ${u(R)} + ci] * W[${u(bl.qkv)} + ci * ${u(3 * R)} + m];
  }
  M[${u(QKV)} + i] = acc;`,
        );
        // Attention across frequency; thread (head, row, dim).
        kern(
            `attn${k}`,
            HEADS * RF * HD,
            `  let hh = i / ${u(RF * HD)};
  let ii = (i / ${u(HD)}) % ${u(RF)};
  let d = i % ${u(HD)};
  let qb = ${u(QKV)} + ii * ${u(3 * R)} + hh * ${u(3 * HD)};
  var mx = -3.0e38;
  for (var j = 0u; j < ${u(RF)}; j++) {
    let kb = ${u(QKV)} + j * ${u(3 * R)} + hh * ${u(3 * HD)} + ${u(HD)};
    var s = 0.0;
    for (var e = 0u; e < ${u(HD)}; e++) { s += M[qb + e] * M[kb + e]; }
    mx = max(mx, s * ${scale});
  }
  var sum = 0.0;
  var acc = 0.0;
  for (var j = 0u; j < ${u(RF)}; j++) {
    let kb = ${u(QKV)} + j * ${u(3 * R)} + hh * ${u(3 * HD)} + ${u(HD)};
    var s = 0.0;
    for (var e = 0u; e < ${u(HD)}; e++) { s += M[qb + e] * M[kb + e]; }
    let p = exp(s * ${scale} - mx);
    sum += p;
    acc += p * M[kb + ${u(HD)} + d];
  }
  M[${u(ATT)} + ii * ${u(R)} + hh * ${u(HD)} + d] = acc / sum;`,
        );
        kern(
            `afc${k}`,
            RF * R,
            `  let j = i / ${u(R)};
  let o = i % ${u(R)};
  var acc = W[${u(bl.afcB)} + o];
  for (var ci = 0u; ci < ${u(R)}; ci++) {
    acc += M[${u(ATT)} + j * ${u(R)} + ci] * W[${u(bl.afc)} + o * ${u(R)} + ci];
  }
  M[${u(X)} + i] = acc + M[${u(X2)} + i];`,
        );
    });

    // ---- RNNFormer postnet: [r][rf] @ [rf][f], then r -> c ----
    kern(
        "rf_post_m",
        R * F,
        `  let ri = i / ${u(F)};
  let fi = i % ${u(F)};
  var acc = 0.0;
  for (var j = 0u; j < ${u(RF)}; j++) {
    acc += M[${u(X)} + j * ${u(R)} + ri] * W[${u(rfPostM)} + j * ${u(F)} + fi];
  }
  M[${u(M2)} + i] = acc;`,
    );
    conv("rf_post", C, 1, 0, [[M2, R]], D, rfPost, false);

    // ---- decoder with skips ----
    const skips = [A2, A1];
    for (let k = 0; k < 2; k++) {
        conv(
            `dec${k}a`,
            C,
            1,
            0,
            [
                [D, C],
                [skips[k], C],
            ],
            U,
            dec[k].a,
            true,
        );
        conv(`dec${k}b`, C, 3, 1, [[U, C]], D, dec[k].b, true);
    }
    conv(
        "dec_post",
        C,
        1,
        0,
        [
            [D, C],
            [A0, C],
        ],
        U,
        decPost,
        true,
    );

    // ---- transposed conv, k 8, stride 4, pad 2: c -> mask (re, im) ----
    kern(
        "up",
        2 * FE_NB,
        `  let o = i / ${u(FE_NB)};
  let idx = i32(i % ${u(FE_NB)});
  var acc = W[${u(up.b)} + o];
  for (var ci = 0u; ci < ${u(C)}; ci++) {
    for (var k = 0u; k < 8u; k++) {
      let t4 = idx + 2 - i32(k);
      if (t4 >= 0 && t4 % 4 == 0 && t4 / 4 < ${F}) {
        acc += M[${u(U)} + ci * ${u(F)} + u32(t4 / 4)] * W[${u(up.w)} + (ci * 2u + o) * 8u + k];
      }
    }
  }
  M[${u(OUT)} + i] = acc;`,
    );

    return { kernels, memSize: size, io: { input: IN, output: OUT } };
}

/** A plan's pipelines and weights on a device, shared by its sessions. */
export class FeGpuModel {
    private constructor(
        readonly device: GPUDevice,
        readonly plan: FePlan,
        readonly pipelines: GPUComputePipeline[],
        readonly layout: GPUBindGroupLayout,
        readonly weights: GPUBuffer,
    ) {}

    static async create(
        device: GPUDevice,
        dims: FeDims,
        weights: Float32Array<ArrayBuffer>,
    ): Promise<FeGpuModel> {
        const p = fePlan(dims, weights.length);
        const layout = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: "read-only-storage" },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: "storage" },
                },
            ],
        });
        const pipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [layout],
        });
        device.pushErrorScope("validation");
        const pipelines = await Promise.all(
            p.kernels.map((k) =>
                device.createComputePipelineAsync({
                    label: k.name,
                    layout: pipelineLayout,
                    compute: {
                        module: device.createShaderModule({
                            label: k.name,
                            code: k.code,
                        }),
                        entryPoint: "main",
                    },
                }),
            ),
        );
        const buf = device.createBuffer({
            size: weights.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(buf, 0, weights);
        const err = await device.popErrorScope();
        if (err) {
            buf.destroy();
            throw new Error(`WebGPU: ${err.message}`);
        }
        return new FeGpuModel(device, p, pipelines, layout, buf);
    }

    session(): FeGpuSession {
        return new FeGpuSession(this);
    }

    destroy(): void {
        this.weights.destroy();
    }
}

/** One model state on the GPU: `process` takes a compressed spectrum
 *  (FE_SPEC floats) and resolves with the mask for it. */
export class FeGpuSession {
    private readonly free: GPUBuffer[] = [];
    private readonly bindGroup: GPUBindGroup;
    private readonly mem: GPUBuffer;

    constructor(private readonly model: FeGpuModel) {
        const { device, plan } = model;
        // Zero-initialised: the GRU states start at zero, as in lib.rs.
        this.mem = device.createBuffer({
            size: plan.memSize * 4,
            usage:
                GPUBufferUsage.STORAGE |
                GPUBufferUsage.COPY_DST |
                GPUBufferUsage.COPY_SRC,
        });
        this.bindGroup = device.createBindGroup({
            layout: model.layout,
            entries: [
                { binding: 0, resource: { buffer: model.weights } },
                { binding: 1, resource: { buffer: this.mem } },
            ],
        });
    }

    process(spec: Float32Array<ArrayBuffer>): Promise<Float32Array> {
        const { device, plan, pipelines } = this.model;
        const bytes = FE_SPEC * 4;
        const buf =
            this.free.pop() ??
            device.createBuffer({
                size: bytes,
                usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
            });
        device.queue.writeBuffer(this.mem, plan.io.input * 4, spec);
        const enc = device.createCommandEncoder();
        const cp = enc.beginComputePass();
        cp.setBindGroup(0, this.bindGroup);
        for (let i = 0; i < pipelines.length; i++) {
            cp.setPipeline(pipelines[i]);
            cp.dispatchWorkgroups(plan.kernels[i].groups);
        }
        cp.end();
        enc.copyBufferToBuffer(this.mem, plan.io.output * 4, buf, 0, bytes);
        device.queue.submit([enc.finish()]);
        return buf.mapAsync(GPUMapMode.READ).then(
            () => {
                const out = new Float32Array(buf.getMappedRange().slice(0));
                buf.unmap();
                if (this.free.length < STAGING) this.free.push(buf);
                else buf.destroy();
                return out;
            },
            (err) => {
                buf.destroy();
                throw err;
            },
        );
    }

    destroy(): void {
        for (const b of this.free) b.destroy();
        this.free.length = 0;
        this.mem.destroy();
    }
}
