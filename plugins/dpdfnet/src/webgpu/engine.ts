/**
 * DPDFNet-2 (48 kHz) on WebGPU with hand-written WGSL: the ONNX model's
 * graph rewritten as a fixed list of compute dispatches over one buffer of
 * weights (read from model.onnx at load) and one of everything that
 * changes: the model's state, which never leaves the GPU, the frame in and
 * out, and scratch activations. A frame costs one small write, one command
 * buffer and one small read back; frames pipeline, so several can be in
 * flight while the GPU works through them in order.
 *
 * The graph, from the streaming export (Ceva's onnx_model/dpdfnet_48khz_hr):
 * features and their normalisation; an ERB-path encoder (conv on 480 bins,
 * then 160, 80, 40) and a DF-path encoder (96 bins, then 48), each followed
 * by two dual-path RNN blocks (a bidirectional GRU across frequency, then a
 * GRU cell per band across time); an embedding GRU; a mask decoder back up
 * to 481 bins and a deep-filter decoder for the lowest 96; then the mask
 * and a 5-frame deep filter. Ring buffers hold the frames the convolutions
 * and filters look back on; GRU states are double-buffered on frame parity.
 *
 * Independent work (the ERB and DF paths, the two decoders) shares a
 * dispatch: each kernel is a list of parts, each part a range of
 * workgroups. The GRUs across frequency are inherently serial, one
 * workgroup per path and direction stepping through the bands.
 */
import type { OnnxTensor } from "./onnx";

export const DPDF_BINS = 481;
const C = 64;
const SPEC = DPDF_BINS * 2;
/** Frame counter wraps here: divisible by every ring's capacity (2, 3, 5). */
const FRAME_WRAP = 60;
/** Read-back buffers a session keeps for reuse. */
const STAGING = 8;

interface Kernel {
    name: string;
    code: string;
    groups: number;
}

/** A piece of a dispatch: WGSL defining `fn <id>(wid: u32, lid: u32)`,
 *  run by `groups` workgroups (wid counts from 0 within the part). */
interface Part {
    id: string;
    groups: number;
    code: string;
}

/** Weights, packed into one array (each tensor 16-byte aligned for vec4
 *  reads), some transposed so neighbouring threads read neighbouring
 *  floats. */
class Weights {
    private parts: Float32Array[] = [];
    size = 0;
    constructor(private readonly src: Map<string, OnnxTensor>) {}

    tensor(name: string, shape: number[]): Float32Array {
        const t = this.src.get(name);
        if (!t) throw new Error(`model has no ${name}`);
        const n = shape.reduce((a, b) => a * b, 1);
        if (t.data.length !== n) {
            throw new Error(
                `${name}: expected ${shape.join("x")}, got ${t.dims.join("x")}`,
            );
        }
        return t.data;
    }

    add(data: Float32Array): number {
        const off = this.size;
        this.parts.push(data);
        this.size += data.length;
        const pad = (4 - (this.size % 4)) % 4;
        if (pad) {
            this.parts.push(new Float32Array(pad));
            this.size += pad;
        }
        return off;
    }

    /** A tensor as stored. */
    w(name: string, shape: number[]): number {
        return this.add(this.tensor(name, shape));
    }

    /** [batch][rows][cols] stored as [batch][cols][rows]. */
    t(name: string, shape: number[], batch = 1): number {
        const a = this.tensor(name, shape);
        const per = a.length / batch;
        const cols = shape[shape.length - 1];
        const rows = per / cols;
        const out = new Float32Array(a.length);
        for (let b = 0; b < batch; b++) {
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    out[b * per + c * rows + r] = a[b * per + r * cols + c];
                }
            }
        }
        return this.add(out);
    }

    build(): Float32Array<ArrayBuffer> {
        const out = new Float32Array(this.size);
        let o = 0;
        for (const p of this.parts) {
            out.set(p, o);
            o += p.length;
        }
        return out;
    }
}

/** The mutable buffer's layout, in floats. */
class Layout {
    size = 0;
    readonly regions: Record<string, [number, number]> = {};
    alloc(name: string, n: number): number {
        const off = this.size;
        this.regions[name] = [off, n];
        this.size += n + ((4 - (n % 4)) % 4);
        return off;
    }
}

const u = (n: number) => `${n}u`;

function prelude(frame: number): string {
    return `
@group(0) @binding(0) var<storage, read> W: array<f32>;
@group(0) @binding(1) var<storage, read_write> M: array<f32>;
@group(0) @binding(2) var<storage, read> W4: array<vec4f>;
fn frameNo() -> u32 { return u32(M[${u(frame)}]); }
fn slot(back: u32, cap: u32) -> u32 { return (frameNo() + ${u(FRAME_WRAP)} - back) % cap; }
fn sigm(x: f32) -> f32 { return 1.0 / (1.0 + exp(-x)); }
fn tanhf(x: f32) -> f32 { let e = exp(-2.0 * abs(x)); return sign(x) * (1.0 - e) / (1.0 + e); }
`;
}

export interface EngineInit {
    erbNormInit: number[];
    specNormInit: number[];
}

/** Everything about the model that doesn't depend on a GPU: kernels, the
 *  packed weights and the mutable buffer's layout and initial contents. */
export interface EnginePlan {
    kernels: Kernel[];
    weights: Float32Array<ArrayBuffer>;
    memSize: number;
    memInit: Float32Array<ArrayBuffer>;
    regions: Record<string, [number, number]>;
    io: { input: number; frame: number; output: number };
}

export function plan(
    src: Map<string, OnnxTensor>,
    init: EngineInit,
): EnginePlan {
    const wt = new Weights(src);
    const L = new Layout();
    const kernels: Kernel[] = [];
    let nextId = 0;
    const id = () => `p${nextId++}`;

    const IN = L.alloc("in", SPEC);
    const FRAME = IN + SPEC;
    L.regions.frame = [FRAME, 1];
    const OUT = L.alloc("out", SPEC);
    const pre = prelude(FRAME);

    /** One dispatch running its parts side by side. */
    const dispatch = (name: string, size: number, ...parts: Part[]) => {
        let code = pre;
        let main = "";
        let base = 0;
        for (const p of parts) {
            code += p.code;
            main += `  if (wg.x < ${u(base + p.groups)}) { ${p.id}(wg.x - ${u(base)}, l.x); return; }\n`;
            base += p.groups;
        }
        code += `
@compute @workgroup_size(${size}) fn main(@builtin(local_invocation_id) l: vec3u, @builtin(workgroup_id) wg: vec3u) {
${main}}`;
        kernels.push({ name, code, groups: base });
    };

    const ERBMU = L.alloc("erbmu", DPDF_BINS);
    const SPECS = L.alloc("specs", 96);
    const ERBBUF = L.alloc("erbbuf", 3 * DPDF_BINS);
    const SPECBUF = L.alloc("specbuf", 3 * SPEC);
    const DFBUF = L.alloc("dfbuf", 3 * 192);
    const CPBUF = L.alloc("cpbuf", 5 * C * 96);
    const COEFBUF = L.alloc("coefbuf", 3 * 960);
    const DFS = L.alloc("dfs", 5 * SPEC);
    const E0 = L.alloc("e0", C * 480);
    const E1 = L.alloc("e1", C * 160);
    const E2 = L.alloc("e2", C * 80);
    const E3 = L.alloc("e3", C * 40);
    const C1 = L.alloc("c1", C * 48);
    const CP = L.alloc("cp", 10 * 96);
    /** This frame's c0, which lives in the DF pathway conv's ring. */
    const C0 = `(${u(CPBUF)} + slot(0u, 5u) * ${u(C * 96)})`;

    // --- features, normalisation, ring buffers ------------------------------
    {
        const p = id();
        const c8 = wt.w("/model/erb_norm/Constant_8_output_0", [DPDF_BINS]);
        dispatch("feat", 64, {
            id: p,
            groups: Math.ceil(DPDF_BINS / 64),
            code: `
fn ${p}(wid: u32, lid: u32) {
  let b = wid * 64u + lid;
  if (b >= ${u(DPDF_BINS)}) { return; }
  let xr = M[${u(IN)} + 2u * b] * 0.0010416667;
  let xi = M[${u(IN)} + 2u * b + 1u] * 0.0010416667;
  let mag = sqrt(xr * xr + xi * xi);
  let db = log(mag + 1e-10) / 2.3025851 * 10.0;
  let mu = M[${u(ERBMU)} + b] * 0.98 + db * 0.02;
  M[${u(ERBMU)} + b] = mu;
  let s3 = slot(0u, 3u);
  M[${u(ERBBUF)} + s3 * ${u(DPDF_BINS)} + b] = (db - mu) / W[${u(c8)} + b];
  M[${u(SPECBUF)} + (s3 * ${u(DPDF_BINS)} + b) * 2u] = xr;
  M[${u(SPECBUF)} + (s3 * ${u(DPDF_BINS)} + b) * 2u + 1u] = xi;
  if (b < 96u) {
    let s = M[${u(SPECS)} + b] * 0.98 + mag * 0.02;
    M[${u(SPECS)} + b] = s;
    let d = sqrt(s + 1e-12);
    M[${u(DFBUF)} + s3 * 192u + b] = xr / d;
    M[${u(DFBUF)} + s3 * 192u + 96u + b] = xi / d;
  }
}`,
        });
    }

    /** Depthwise (any form, given as the body of fn dw(ci, fo) -> f32) then
     *  a 64x64 pointwise conv with bias and ReLU, 8 output bins per
     *  workgroup; `post` is added after the ReLU. */
    const dwpw = (
        fout: number,
        dw: string,
        pw: string,
        bias: string,
        out: (co: string, fo: string) => string,
        post = "0.0",
    ): Part => {
        const p = id();
        const pt = wt.t(pw, [C, C]);
        const b = wt.w(bias, [C]);
        return {
            id: p,
            groups: fout / 8,
            code: `
fn ${p}_dw(ci: u32, fo: u32) -> f32 {${dw}}
fn ${p}_post(co: u32, fo: u32) -> f32 { return ${post}; }
var<workgroup> ${p}_sh: array<f32, 512>;
fn ${p}(wid: u32, t: u32) {
  let f0 = wid * 8u;
  for (var j = 0u; j < 8u; j++) { ${p}_sh[t * 8u + j] = ${p}_dw(t, f0 + j); }
  workgroupBarrier();
  var acc: array<f32, 8>;
  let bias = W[${u(b)} + t];
  for (var j = 0u; j < 8u; j++) { acc[j] = bias; }
  for (var ci = 0u; ci < 64u; ci++) {
    let p = W[${u(pt)} + ci * 64u + t];
    for (var j = 0u; j < 8u; j++) { acc[j] += p * ${p}_sh[ci * 8u + j]; }
  }
  for (var j = 0u; j < 8u; j++) { M[${out("t", "(f0 + j)")}] = max(acc[j], 0.0) + ${p}_post(t, f0 + j); }
}`,
        };
    };

    /** Body of a strided depthwise conv, kernel 3, padding 1, over [64][fin]. */
    const strided = (
        weight: string,
        src: string,
        fin: number,
        stride: number,
    ) => {
        const w = wt.w(weight, [C, 1, 1, 3]);
        return `
  var acc = 0.0;
  for (var k = 0u; k < 3u; k++) {
    let fi = i32(fo * ${u(stride)} + k) - 1;
    if (fi >= 0 && fi < ${fin}) { acc += W[${u(w)} + ci * 3u + k] * M[${src} + ci * ${u(fin)} + u32(fi)]; }
  }
  return acc;`;
    };

    // --- first convolutions: ERB path (3x3 over the last 3 frames) and DF path
    // (grouped 3x3, then pointwise), side by side -------------------------------
    {
        const p = id();
        const w = wt.w("onnx::Conv_2114", [C, 1, 3, 3]);
        const b = wt.w("onnx::Conv_2115", [C]);
        const erb: Part = {
            id: p,
            groups: (C * 480) / 64,
            code: `
fn ${p}(wid: u32, lid: u32) {
  let i = wid * 64u + lid;
  let c = i / 480u;
  let f = i % 480u;
  var acc = W[${u(b)} + c];
  for (var kt = 0u; kt < 3u; kt++) {
    let row = ${u(ERBBUF)} + slot(2u - kt, 3u) * ${u(DPDF_BINS)};
    for (var kf = 0u; kf < 3u; kf++) {
      let ff = i32(f) + i32(kf) - 1;
      if (ff >= 0 && ff < 480) { acc += W[${u(w)} + c * 9u + kt * 3u + kf] * M[row + u32(ff)]; }
    }
  }
  M[${u(E0)} + c * 480u + f] = max(acc, 0.0);
}`,
        };
        const w0 = wt.w("model.enc.df_conv0.1.convs.0.weight", [32, 1, 3, 3]);
        const w1 = wt.w("model.enc.df_conv0.1.convs.1.weight", [32, 1, 3, 3]);
        const df = dwpw(
            96,
            `
  let grp = ci / 32u;
  let wb = select(${u(w0)}, ${u(w1)}, grp == 1u) + (ci % 32u) * 9u;
  var acc = 0.0;
  for (var kt = 0u; kt < 3u; kt++) {
    let row = ${u(DFBUF)} + slot(2u - kt, 3u) * 192u + grp * 96u;
    for (var kf = 0u; kf < 3u; kf++) {
      let fi = i32(fo + kf) - 1;
      if (fi >= 0 && fi < 96) { acc += W[wb + kt * 3u + kf] * M[row + u32(fi)]; }
    }
  }
  return acc;`,
            "onnx::Conv_2126",
            "onnx::Conv_2127",
            (co, fo) => `${C0} + ${co} * 96u + ${fo}`,
        );
        dispatch("conv0", 64, erb, df);
    }
    dispatch(
        "conv1",
        64,
        dwpw(
            160,
            strided("model.enc.erb_conv1.0.weight", u(E0), 480, 3),
            "onnx::Conv_2117",
            "onnx::Conv_2118",
            (co, fo) => `${u(E1)} + ${co} * 160u + ${fo}`,
        ),
        dwpw(
            48,
            strided("model.enc.df_conv1.0.weight", C0, 96, 2),
            "onnx::Conv_2129",
            "onnx::Conv_2130",
            (co, fo) => `${u(C1)} + ${co} * 48u + ${fo}`,
        ),
    );

    // --- DF pathway conv: 5 frames of c0, two groups of 32 -> 5, pointwise ----
    // A workgroup per 8 bins: 80 threads, one per (pre-channel, bin).
    {
        const p = id();
        const w0 = wt.w(
            "model.df_dec.df_convp.1.convs.0.weight",
            [5, 32, 5, 1],
        );
        const w1 = wt.w(
            "model.df_dec.df_convp.1.convs.1.weight",
            [5, 32, 5, 1],
        );
        const pw = wt.w("onnx::Conv_2156", [10, 10]);
        const b = wt.w("onnx::Conv_2157", [10]);
        dispatch("df_convp", 80, {
            id: p,
            groups: 12,
            code: `
var<workgroup> ${p}_pre: array<f32, 80>;
fn ${p}(wid: u32, lid: u32) {
  let fl = lid % 8u;
  let ch = lid / 8u;
  let f = wid * 8u + fl;
  let grp = ch / 5u;
  let wb = select(${u(w0)}, ${u(w1)}, grp == 1u) + (ch % 5u) * 160u;
  var acc = 0.0;
  for (var kt = 0u; kt < 5u; kt++) {
    let row = ${u(CPBUF)} + slot(4u - kt, 5u) * ${u(C * 96)} + grp * ${u(32 * 96)} + f;
    for (var ci = 0u; ci < 32u; ci++) { acc += W[wb + ci * 5u + kt] * M[row + ci * 96u]; }
  }
  ${p}_pre[ch * 8u + fl] = acc;
  workgroupBarrier();
  var o = W[${u(b)} + ch];
  for (var k = 0u; k < 10u; k++) { o += W[${u(pw)} + ch * 10u + k] * ${p}_pre[k * 8u + fl]; }
  M[${u(CP)} + ch * 96u + f] = max(o, 0.0);
}`,
        });
    }

    dispatch(
        "erb_conv2",
        64,
        dwpw(
            80,
            strided("model.enc.erb_conv2.0.weight", u(E1), 160, 2),
            "onnx::Conv_2120",
            "onnx::Conv_2121",
            (co, fo) => `${u(E2)} + ${co} * 80u + ${fo}`,
        ),
    );
    dispatch(
        "erb_conv3",
        64,
        dwpw(
            40,
            strided("model.enc.erb_conv3.0.weight", u(E2), 80, 2),
            "onnx::Conv_2123",
            "onnx::Conv_2124",
            (co, fo) => `${u(E3)} + ${co} * 40u + ${fo}`,
        ),
    );

    // --- dual-path RNN blocks, ERB and DF paths side by side -------------------
    /** LayerNorm(W x + b) added to a residual, one workgroup per band. */
    const fcLn = (
        F: number,
        K: number,
        wT: number,
        bias: number,
        gamma: number,
        beta: number,
        src: number,
        res: number,
        dst: number,
    ): Part => {
        const p = id();
        return {
            id: p,
            groups: F,
            code: `
var<workgroup> ${p}_red: array<f32, 64>;
fn ${p}_total(c: u32, v: f32) -> f32 {
  ${p}_red[c] = v;
  workgroupBarrier();
  for (var s = 32u; s > 0u; s = s >> 1u) {
    if (c < s) { ${p}_red[c] += ${p}_red[c + s]; }
    workgroupBarrier();
  }
  let r = ${p}_red[0];
  workgroupBarrier();
  return r;
}
fn ${p}(f: u32, c: u32) {
  let srcBase = ${u(src)} + f * ${u(K)};
  var y = W[${u(bias)} + c];
  for (var k = 0u; k < ${u(K)}; k++) { y += W[${u(wT)} + k * 64u + c] * M[srcBase + k]; }
  let mean = ${p}_total(c, y) / 64.0;
  let d = y - mean;
  let v = ${p}_total(c, d * d) / 64.0;
  let n = d / sqrt(v + 1e-5) * W[${u(gamma)} + c] + W[${u(beta)} + c];
  M[${u(dst)} + c * ${u(F)} + f] = M[${u(res)} + c * ${u(F)} + f] + n;
}`,
        };
    };

    interface Block {
        ih: Part;
        rec: Part;
        fcIntra: Part;
        inter: Part;
        fcInter: Part;
        out: number;
    }
    const H0 = wt.w(
        "/model/enc/dprnn_erb/blocks.0/intra_gru/Expand_output_0",
        [2, 64],
    );
    const block = (
        path: "erb" | "df",
        blk: number,
        F: number,
        x: number,
        ids: [string, string, string, string],
    ): Block => {
        const pfx = `model.enc.dprnn_${path}.blocks.${blk}`;
        const [Wn, Rn, Bn, fcn] = ids;
        const GI = L.alloc(`${path}${blk}_gi`, F * 384);
        const OI = L.alloc(`${path}${blk}_oi`, F * 128);
        const MID = L.alloc(`${path}${blk}_mid`, C * F);
        const HST = L.alloc(`${path}${blk}_h`, 2 * F * C);
        const HN = L.alloc(`${path}${blk}_hn`, F * C);
        const OUTB = L.alloc(`${path}${blk}_out`, C * F);
        const Wt = wt.t(Wn, [2, 192, 64], 2);
        const R = wt.w(Rn, [2, 192, 64]);
        const B = wt.w(Bn, [2, 384]);
        const pih = id();
        const prec = id();
        const pint = id();
        // Input projections of the bidirectional GRU, all bands at once.
        const ih: Part = {
            id: pih,
            groups: (F * 384) / 64,
            code: `
fn ${pih}(wid: u32, lid: u32) {
  let i = wid * 64u + lid;
  let f = i / 384u;
  let r = i % 384u;
  let d = r / 192u;
  let g = r % 192u;
  var acc = W[${u(B)} + d * 384u + g];
  let wb = ${u(Wt)} + d * 12288u + g;
  for (var c = 0u; c < 64u; c++) { acc += W[wb + c * 192u] * M[${u(x)} + c * ${u(F)} + f]; }
  M[${u(GI)} + f * 384u + r] = acc;
}`,
        };
        // The recurrence across bands (ONNX gate order z, r, h, with the
        // reset applied after the hidden projection): a workgroup per
        // direction, a thread per row of the hidden projection, which it
        // keeps in registers for the whole sweep. A step is latency, not
        // work, so the dot product is unrolled into independent sums.
        const k16 = Array.from({ length: 16 }, (_, k) => k);
        const rec: Part = {
            id: prec,
            groups: 2,
            code: `
var<workgroup> ${prec}_h: array<vec4f, 16>;
var<workgroup> ${prec}_g: array<f32, 192>;
fn ${prec}(d: u32, row: u32) {
  if (row < 64u) { ${prec}_h[row / 4u][row % 4u] = W[${u(H0)} + d * 64u + row]; }
  let rb = ${u(R / 4)} + (d * 192u + row) * 16u;
  ${k16.map((k) => `let w${k} = W4[rb + ${u(k)}];`).join("\n  ")}
  let bias = W[${u(B)} + d * 384u + 192u + row];
  workgroupBarrier();
  for (var s = 0u; s < ${u(F)}; s++) {
    let f = select(${u(F - 1)} - s, s, d == 0u);
    let gi = ${u(GI)} + f * 384u + d * 192u + row;
    var xz = 0.0;
    var xr = 0.0;
    var xh = 0.0;
    if (row < 64u) {
      xz = M[gi];
      xr = M[gi + 64u];
      xh = M[gi + 128u];
    }
    ${[0, 1, 2, 3].map((q) => `let a${q} = ${[0, 1, 2, 3].map((j) => `dot(w${q * 4 + j}, ${prec}_h[${u(q * 4 + j)}])`).join(" + ")};`).join("\n    ")}
    ${prec}_g[row] = bias + (a0 + a1) + (a2 + a3);
    workgroupBarrier();
    if (row < 64u) {
      let z = sigm(xz + ${prec}_g[row]);
      let r = sigm(xr + ${prec}_g[row + 64u]);
      let n = tanhf(xh + r * ${prec}_g[row + 128u]);
      let h = (1.0 - z) * n + z * ${prec}_h[row / 4u][row % 4u];
      ${prec}_h[row / 4u][row % 4u] = h;
      M[${u(OI)} + f * 128u + d * 64u + row] = h;
    }
    workgroupBarrier();
  }
}`,
        };
        const fcIntra = fcLn(
            F,
            128,
            wt.w(fcn, [128, 64]),
            wt.w(`${pfx}.fc_intra.bias`, [C]),
            wt.w(`${pfx}.ln_intra.weight`, [C]),
            wt.w(`${pfx}.ln_intra.bias`, [C]),
            OI,
            x,
            MID,
        );
        // The per-band GRU cell across time (PyTorch gate order r, z, n).
        const Wih = wt.t(`${pfx}.inter_gru.grucell.weight_ih`, [192, 64]);
        const Whh = wt.t(`${pfx}.inter_gru.grucell.weight_hh`, [192, 64]);
        const bih = wt.w(`${pfx}.inter_gru.grucell.bias_ih`, [192]);
        const bhh = wt.w(`${pfx}.inter_gru.grucell.bias_hh`, [192]);
        const inter: Part = {
            id: pint,
            groups: F,
            code: `
fn ${pint}(f: u32, un: u32) {
  let par = frameNo() % 2u;
  let hsrc = ${u(HST)} + par * ${u(F * C)} + f * 64u;
  var ir = W[${u(bih)} + un];
  var iz = W[${u(bih)} + 64u + un];
  var inn = W[${u(bih)} + 128u + un];
  var hr = W[${u(bhh)} + un];
  var hz = W[${u(bhh)} + 64u + un];
  var hh = W[${u(bhh)} + 128u + un];
  for (var k = 0u; k < 64u; k++) {
    let xk = M[${u(MID)} + k * ${u(F)} + f];
    let hk = M[hsrc + k];
    let wi = ${u(Wih)} + k * 192u + un;
    let wh = ${u(Whh)} + k * 192u + un;
    ir += W[wi] * xk;
    iz += W[wi + 64u] * xk;
    inn += W[wi + 128u] * xk;
    hr += W[wh] * hk;
    hz += W[wh + 64u] * hk;
    hh += W[wh + 128u] * hk;
  }
  let r = sigm(ir + hr);
  let z = sigm(iz + hz);
  let n = tanhf(inn + r * hh);
  let h = (1.0 - z) * n + z * M[hsrc + un];
  M[${u(HST)} + (1u - par) * ${u(F * C)} + f * 64u + un] = h;
  M[${u(HN)} + f * 64u + un] = h;
}`,
        };
        const fcInter = fcLn(
            F,
            64,
            wt.t(`${pfx}.fc_inter.weight`, [64, 64]),
            wt.w(`${pfx}.fc_inter.bias`, [C]),
            wt.w(`${pfx}.ln_inter.weight`, [C]),
            wt.w(`${pfx}.ln_inter.bias`, [C]),
            HN,
            MID,
            OUTB,
        );
        return { ih, rec, fcIntra, inter, fcInter, out: OUTB };
    };
    const GRU_IDS: Record<"erb" | "df", [string, string, string, string][]> = {
        erb: [
            [
                "onnx::GRU_2231",
                "onnx::GRU_2232",
                "onnx::GRU_2230",
                "onnx::MatMul_2234",
            ],
            [
                "onnx::GRU_2297",
                "onnx::GRU_2298",
                "onnx::GRU_2296",
                "onnx::MatMul_2300",
            ],
        ],
        df: [
            [
                "onnx::GRU_2375",
                "onnx::GRU_2376",
                "onnx::GRU_2374",
                "onnx::MatMul_2378",
            ],
            [
                "onnx::GRU_2441",
                "onnx::GRU_2442",
                "onnx::GRU_2440",
                "onnx::MatMul_2444",
            ],
        ],
    };
    let XE = E3;
    let XD = C1;
    for (let blk = 0; blk < 2; blk++) {
        const e = block("erb", blk, 40, XE, GRU_IDS.erb[blk]);
        const d = block("df", blk, 48, XD, GRU_IDS.df[blk]);
        dispatch(`dprnn${blk}_ih`, 64, e.ih, d.ih);
        dispatch(`dprnn${blk}_rec`, 192, e.rec, d.rec);
        dispatch(`dprnn${blk}_fc_intra`, 64, e.fcIntra, d.fcIntra);
        dispatch(`dprnn${blk}_inter`, 64, e.inter, d.inter);
        dispatch(`dprnn${blk}_fc_inter`, 64, e.fcInter, d.fcInter);
        XE = e.out;
        XD = d.out;
    }

    // --- grouped linear layers and the 256-unit GRUs ---------------------------
    const glin = (
        weight: string,
        bias: string,
        G: number,
        Ig: number,
        Hg: number,
        inp: (i: string) => string,
        act: "relu" | "none" | "tanh",
        out: (o: string) => string,
        add: (o: string) => string = () => "0.0",
    ): Part => {
        const p = id();
        const w = wt.w(weight, [G, Ig, Hg]);
        const b = wt.w(bias, [G * Hg]);
        const N = G * Hg;
        const a =
            act === "relu"
                ? "max(acc, 0.0)"
                : act === "tanh"
                  ? "tanhf(acc)"
                  : "acc";
        return {
            id: p,
            groups: Math.ceil(N / 64),
            code: `
fn ${p}(wid: u32, lid: u32) {
  let o = wid * 64u + lid;
  if (o >= ${u(N)}) { return; }
  let grp = o / ${u(Hg)};
  let j = o % ${u(Hg)};
  var acc = W[${u(b)} + o];
  let wb = ${u(w)} + grp * ${u(Ig * Hg)} + j;
  let ib = grp * ${u(Ig)};
  for (var k = 0u; k < ${u(Ig)}; k++) { acc += W[wb + k * ${u(Hg)}] * ${inp("(ib + k)")}; }
  M[${out("o")}] = ${a} + ${add("o")};
}`,
        };
    };

    /** A 256-unit GRU cell (PyTorch gate order r, z, n): a workgroup per 4
     *  units, each unit's six 256-long dot products split 16 ways across
     *  lanes reading the rows as stored, then summed. */
    const gru256 = (
        name: string,
        pfx: string,
        xin: number,
        xout: number,
    ): Part => {
        const p = id();
        const H = L.alloc(`${name}_h`, 2 * 256);
        const Wi = wt.w(`${pfx}.weight_ih`, [768, 256]);
        const Wh = wt.w(`${pfx}.weight_hh`, [768, 256]);
        const bi = wt.w(`${pfx}.bias_ih`, [768]);
        const bh = wt.w(`${pfx}.bias_hh`, [768]);
        return {
            id: p,
            groups: 64,
            code: `
var<workgroup> ${p}_part: array<f32, 384>;
fn ${p}(wid: u32, lane: u32) {
  let uu = lane / 16u;
  let sp = lane % 16u;
  let un = wid * 4u + uu;
  let par = frameNo() % 2u;
  let hsrc = ${u(H)} + par * 256u;
  let xb = ${u(xin)} + sp * 16u;
  let hb = hsrc + sp * 16u;
  ${[0, 1, 2, 3]
      .map(
          (
              i,
          ) => `let x${i} = vec4f(M[xb + ${u(4 * i)}], M[xb + ${u(4 * i + 1)}], M[xb + ${u(4 * i + 2)}], M[xb + ${u(4 * i + 3)}]);
  let h${i} = vec4f(M[hb + ${u(4 * i)}], M[hb + ${u(4 * i + 1)}], M[hb + ${u(4 * i + 2)}], M[hb + ${u(4 * i + 3)}]);`,
      )
      .join("\n  ")}
  let wi = ${u(Wi / 4)} + un * 64u + sp * 4u;
  let wh = ${u(Wh / 4)} + un * 64u + sp * 4u;
  ${[0, 1, 2]
      .map(
          (
              q,
          ) => `${p}_part[lane * 6u + ${u(q)}] = ${[0, 1, 2, 3].map((i) => `dot(W4[wi + ${u(q * 256 * 64 + i)}], x${i})`).join(" + ")};
  ${p}_part[lane * 6u + ${u(q + 3)}] = ${[0, 1, 2, 3].map((i) => `dot(W4[wh + ${u(q * 256 * 64 + i)}], h${i})`).join(" + ")};`,
      )
      .join("\n  ")}
  workgroupBarrier();
  if (sp == 0u) {
    var s: array<f32, 6>;
    for (var j = 0u; j < 16u; j++) {
      for (var q = 0u; q < 6u; q++) { s[q] += ${p}_part[(uu * 16u + j) * 6u + q]; }
    }
    let r = sigm(s[0] + W[${u(bi)} + un] + s[3] + W[${u(bh)} + un]);
    let z = sigm(s[1] + W[${u(bi)} + 256u + un] + s[4] + W[${u(bh)} + 256u + un]);
    let n = tanhf(s[2] + W[${u(bi)} + 512u + un] + r * (s[5] + W[${u(bh)} + 512u + un]));
    let h = (1.0 - z) * n + z * M[hsrc + un];
    M[${u(H)} + (1u - par) * 256u + un] = h;
    M[${u(xout)} + un] = h;
  }
}`,
        };
    };

    const EMBIN = L.alloc("emb_in", 1024);
    const LIN = L.alloc("enc_lin", 256);
    const GENC = L.alloc("enc_gru", 256);
    const EMB = L.alloc("emb", 512);
    const at = (base: number) => (i: string) => `M[${u(base)} + ${i}]`;
    const to = (base: number) => (o: string) => `${u(base)} + ${o}`;
    dispatch(
        "fc_emb",
        64,
        glin(
            "model.enc.erb_fc_emb.0.weight",
            "model.enc.erb_fc_emb.0.bias",
            32,
            80,
            16,
            (i) => `M[${u(XE)} + (${i} % 64u) * 40u + ${i} / 64u]`,
            "relu",
            to(EMBIN),
        ),
        glin(
            "model.enc.df_fc_emb.0.weight",
            "model.enc.df_fc_emb.0.bias",
            32,
            96,
            16,
            (i) => `M[${u(XD)} + (${i} % 64u) * 48u + ${i} / 64u]`,
            "relu",
            to(EMBIN + 512),
        ),
    );
    dispatch(
        "enc_lin_in",
        64,
        glin(
            "model.enc.emb_gru.linear_in.0.weight",
            "model.enc.emb_gru.linear_in.0.bias",
            16,
            64,
            16,
            at(EMBIN),
            "relu",
            to(LIN),
        ),
    );
    dispatch(
        "enc_gru",
        64,
        gru256("enc_gru", "model.enc.emb_gru.gru.0.grucell", LIN, GENC),
    );
    dispatch(
        "enc_lin_out",
        64,
        glin(
            "model.enc.emb_gru.linear_out.0.weight",
            "model.enc.emb_gru.linear_out.0.bias",
            16,
            16,
            32,
            at(GENC),
            "relu",
            to(EMB),
        ),
    );

    // --- the two decoders' embedding GRUs, side by side ------------------------
    const EDIN = L.alloc("ed_lin", 256);
    const EDG0 = L.alloc("ed_gru0", 256);
    const EDG1 = L.alloc("ed_gru1", 256);
    const EDOUT = L.alloc("ed_out", 512);
    const EDFC = L.alloc("ed_fc", 2560);
    const DDIN = L.alloc("dd_lin", 256);
    const DDG0 = L.alloc("dd_gru0", 256);
    const DDG1 = L.alloc("dd_gru1", 256);
    const DDC = L.alloc("dd_c", 256);
    dispatch(
        "dec_lin_in",
        64,
        glin(
            "model.erb_dec.emb_gru.linear_in.0.weight",
            "model.erb_dec.emb_gru.linear_in.0.bias",
            16,
            32,
            16,
            at(EMB),
            "relu",
            to(EDIN),
        ),
        glin(
            "model.df_dec.df_gru.linear_in.0.weight",
            "model.df_dec.df_gru.linear_in.0.bias",
            8,
            64,
            32,
            at(EMB),
            "relu",
            to(DDIN),
        ),
    );
    dispatch(
        "dec_gru0",
        64,
        gru256("ed_gru0", "model.erb_dec.emb_gru.gru.0.grucell", EDIN, EDG0),
        gru256("dd_gru0", "model.df_dec.df_gru.gru.0.grucell", DDIN, DDG0),
    );
    dispatch(
        "dec_gru1",
        64,
        gru256("ed_gru1", "model.erb_dec.emb_gru.gru.1.grucell", EDG0, EDG1),
        gru256("dd_gru1", "model.df_dec.df_gru.gru.1.grucell", DDG0, DDG1),
    );
    dispatch(
        "dec_lin_out",
        64,
        glin(
            "model.erb_dec.emb_gru.linear_out.0.weight",
            "model.erb_dec.emb_gru.linear_out.0.bias",
            16,
            16,
            32,
            at(EDG1),
            "relu",
            to(EDOUT),
        ),
        // The DF decoder's skip from the embedding, added to its GRU output.
        glin(
            "model.df_dec.df_skip.weight",
            "model.df_dec.df_skip.bias",
            16,
            32,
            16,
            at(EMB),
            "none",
            to(DDC),
            (o) => `M[${u(DDG1)} + ${o}]`,
        ),
    );
    dispatch(
        "dec_fc",
        64,
        glin(
            "model.erb_dec.erb_fc_emb.0.weight",
            "model.erb_dec.erb_fc_emb.0.bias",
            32,
            16,
            80,
            at(EDOUT),
            "relu",
            to(EDFC),
        ),
        // Deep-filter coefficients for this frame (bin-major, 5 frames x
        // re/im), plus the pathway conv, into the coefficient ring.
        glin(
            "model.df_dec.df_out.0.weight",
            "model.df_dec.df_out.0.bias",
            16,
            16,
            60,
            at(DDC),
            "tanh",
            (o) => `${u(COEFBUF)} + slot(0u, 3u) * 960u + ${o}`,
            (o) => `M[${u(CP)} + (${o} % 10u) * 96u + ${o} / 10u]`,
        ),
    );

    // --- mask decoder convs back up to 480 bins --------------------------------
    /** Sub-pixel upsampling: x = ReLU(a skip + b) + previous stage, then `s`
     *  depthwise kernels (output bin f*s+j uses kernel j), then pointwise. */
    const subpix = (
        name: string,
        fin: number,
        s: number,
        skip: number,
        pa: string,
        pb: string,
        prev: (ci: string, f: string) => string,
        convs: string,
        pw: string,
        bias: string,
        out: number,
        post?: string,
    ) => {
        const a = wt.w(pa, [C]);
        const b = wt.w(pb, [C]);
        const ws = Array.from({ length: s }, (_, j) =>
            wt.w(`${convs}.${j}.weight`, [C, 1, 1, 3]),
        );
        const xin = (ci: string, f: string) =>
            `(max(W[${u(a)} + ${ci}] * M[${u(skip)} + ${ci} * ${u(fin)} + ${f}] + W[${u(b)} + ${ci}], 0.0) + ${prev(ci, f)})`;
        dispatch(
            name,
            64,
            dwpw(
                fin * s,
                `
  let f = fo / ${u(s)};
  let j = fo % ${u(s)};
  var wb = ${u(ws[0])};
  ${ws
      .slice(1)
      .map((o, j) => `if (j == ${u(j + 1)}) { wb = ${u(o)}; }`)
      .join("\n  ")}
  var acc = 0.0;
  for (var k = 0u; k < 3u; k++) {
    let fi = i32(f + k) - 1;
    if (fi >= 0 && fi < ${fin}) { acc += W[wb + ci * 3u + k] * ${xin("ci", "u32(fi)")}; }
  }
  return acc;`,
                pw,
                bias,
                (co, fo) => `${u(out)} + ${co} * ${u(fin * s)} + ${fo}`,
                post,
            ),
        );
    };
    const D3 = L.alloc("d3", C * 80);
    const D2 = L.alloc("d2", C * 160);
    /** The mask conv's input: the last upsampling stage plus its skip path. */
    const A0 = L.alloc("a0", C * 480);
    subpix(
        "convt3",
        40,
        2,
        E3,
        "onnx::Conv_2132",
        "onnx::Conv_2133",
        (ci, f) => `M[${u(EDFC)} + ${f} * 64u + ${ci}]`,
        "model.erb_dec.convt3.0.convs",
        "onnx::Conv_2135",
        "onnx::Conv_2136",
        D3,
    );
    subpix(
        "convt2",
        80,
        2,
        E2,
        "onnx::Conv_2138",
        "onnx::Conv_2139",
        (ci, f) => `M[${u(D3)} + ${ci} * 80u + ${f}]`,
        "model.erb_dec.convt2.0.convs",
        "onnx::Conv_2141",
        "onnx::Conv_2142",
        D2,
    );
    {
        const pa = wt.w("onnx::Conv_2150", [C]);
        const pb = wt.w("onnx::Conv_2151", [C]);
        subpix(
            "convt1",
            160,
            3,
            E1,
            "onnx::Conv_2144",
            "onnx::Conv_2145",
            (ci, f) => `M[${u(D2)} + ${ci} * 160u + ${f}]`,
            "model.erb_dec.convt1.0.convs",
            "onnx::Conv_2147",
            "onnx::Conv_2148",
            A0,
            `max(W[${u(pa)} + co] * M[${u(E0)} + co * 480u + fo] + W[${u(pb)} + co], 0.0)`,
        );
    }

    // --- mask, deep filter, output: a workgroup per 8 bins, a lane per channel
    // of the mask conv, summed across lanes -------------------------------------
    {
        const p = id();
        const wm = wt.w("onnx::Conv_2153", [C, 3]);
        const bm = wt.w("onnx::Conv_2154", [1]);
        dispatch("mask_df", 64, {
            id: p,
            groups: Math.ceil(DPDF_BINS / 8),
            code: `
var<workgroup> ${p}_red: array<f32, 512>;
fn ${p}(wid: u32, c: u32) {
  let b0 = wid * 8u;
  for (var j = 0u; j < 8u; j++) {
    let b = min(b0 + j, 480u);
    let fm = select(b, 478u, b == 480u);
    var acc = 0.0;
    for (var k = 0u; k < 3u; k++) {
      let ff = i32(fm + k) - 1;
      if (ff >= 0 && ff < 480) { acc += W[${u(wm)} + c * 3u + k] * M[${u(A0)} + c * 480u + u32(ff)]; }
    }
    ${p}_red[j * 64u + c] = acc;
  }
  workgroupBarrier();
  for (var s = 32u; s > 0u; s = s >> 1u) {
    if (c < s) {
      for (var j = 0u; j < 8u; j++) { ${p}_red[j * 64u + c] += ${p}_red[j * 64u + c + s]; }
    }
    workgroupBarrier();
  }
  let b = b0 + c;
  if (c >= 8u || b >= ${u(DPDF_BINS)}) { return; }
  let m = sigm(${p}_red[c * 64u] + W[${u(bm)}]);
  let sp = ${u(SPECBUF)} + (slot(2u, 3u) * ${u(DPDF_BINS)} + b) * 2u;
  let d0 = ${u(DFS)} + (slot(0u, 5u) * ${u(DPDF_BINS)} + b) * 2u;
  M[d0] = M[sp] * m;
  M[d0 + 1u] = M[sp + 1u] * m;
  var re = 0.0;
  var im = 0.0;
  if (b < 96u) {
    let cb = ${u(COEFBUF)} + slot(2u, 3u) * 960u + b * 10u;
    for (var o = 0u; o < 5u; o++) {
      let so = ${u(DFS)} + (slot(4u - o, 5u) * ${u(DPDF_BINS)} + b) * 2u;
      let xr = M[so];
      let xi = M[so + 1u];
      let cr = M[cb + o * 2u];
      let ci = M[cb + o * 2u + 1u];
      re += xr * cr - xi * ci;
      im += xr * ci + xi * cr;
    }
  } else {
    let so = ${u(DFS)} + (slot(2u, 5u) * ${u(DPDF_BINS)} + b) * 2u;
    re = M[so];
    im = M[so + 1u];
  }
  M[${u(OUT)} + 2u * b] = re * 960.0;
  M[${u(OUT)} + 2u * b + 1u] = im * 960.0;
}`,
        });
    }

    const memInit = new Float32Array(L.size);
    memInit.set(init.erbNormInit, ERBMU);
    memInit.set(init.specNormInit, SPECS);
    return {
        kernels,
        weights: wt.build(),
        memSize: L.size,
        memInit,
        regions: L.regions,
        io: { input: IN, frame: FRAME, output: OUT },
    };
}

/** A plan loaded onto a GPUDevice: its pipelines and weights, shared by
 *  every session (each mic chain has its own, with its own state). */
export class GpuModel {
    private constructor(
        readonly device: GPUDevice,
        readonly plan: EnginePlan,
        readonly pipelines: GPUComputePipeline[],
        readonly layout: GPUBindGroupLayout,
        readonly weights: GPUBuffer,
    ) {}

    static async create(device: GPUDevice, p: EnginePlan): Promise<GpuModel> {
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
                {
                    binding: 2,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: "read-only-storage" },
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
        const weights = device.createBuffer({
            size: p.weights.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(weights, 0, p.weights);
        const err = await device.popErrorScope();
        if (err) {
            weights.destroy();
            throw new Error(`WebGPU: ${err.message}`);
        }
        return new GpuModel(device, p, pipelines, layout, weights);
    }

    session(): DpdfnetSession {
        return new DpdfnetSession(this);
    }

    destroy(): void {
        this.weights.destroy();
    }
}

/** One model state on the GPU. `process` takes a frame (481 complex bins,
 *  interleaved) and resolves with the enhanced frame. The frame is written
 *  and its work submitted before it returns, so frames run in call order;
 *  call it again without waiting to keep several in flight. */
export class DpdfnetSession {
    private frame = 0;
    private readonly free: GPUBuffer[] = [];
    private readonly upload = new Float32Array(SPEC + 1);
    private readonly bindGroup: GPUBindGroup;
    readonly mem: GPUBuffer;

    constructor(private readonly model: GpuModel) {
        const { device, plan } = model;
        this.mem = device.createBuffer({
            size: plan.memSize * 4,
            usage:
                GPUBufferUsage.STORAGE |
                GPUBufferUsage.COPY_DST |
                GPUBufferUsage.COPY_SRC,
        });
        device.queue.writeBuffer(this.mem, 0, plan.memInit);
        this.bindGroup = device.createBindGroup({
            layout: model.layout,
            entries: [
                { binding: 0, resource: { buffer: model.weights } },
                { binding: 1, resource: { buffer: this.mem } },
                { binding: 2, resource: { buffer: model.weights } },
            ],
        });
    }

    /** Back to the model's initial state (in line with frames already sent). */
    reset(): void {
        this.model.device.queue.writeBuffer(
            this.mem,
            0,
            this.model.plan.memInit,
        );
        this.frame = 0;
    }

    /** Records one frame's work; `pass` lets a caller time it. */
    encode(enc: GPUCommandEncoder, pass?: GPUComputePassDescriptor): void {
        const cp = enc.beginComputePass(pass);
        cp.setBindGroup(0, this.bindGroup);
        const k = this.model.plan.kernels;
        for (let i = 0; i < k.length; i++) {
            cp.setPipeline(this.model.pipelines[i]);
            cp.dispatchWorkgroups(k[i].groups);
        }
        cp.end();
    }

    /** Writes a frame and returns an encoder holding its work, not yet
     *  submitted; a caller can add to it. */
    submit(spec: Float32Array): GPUCommandEncoder {
        this.upload.set(spec);
        this.upload[SPEC] = this.frame;
        this.frame = (this.frame + 1) % FRAME_WRAP;
        const { device, plan } = this.model;
        device.queue.writeBuffer(this.mem, plan.io.input * 4, this.upload);
        const enc = device.createCommandEncoder();
        this.encode(enc);
        return enc;
    }

    process(spec: Float32Array): Promise<Float32Array> {
        const { device, plan } = this.model;
        const buf =
            this.free.pop() ??
            device.createBuffer({
                size: SPEC * 4,
                usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
            });
        const enc = this.submit(spec);
        enc.copyBufferToBuffer(this.mem, plan.io.output * 4, buf, 0, SPEC * 4);
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

    /** The whole mutable buffer (debugging). */
    async readMem(): Promise<Float32Array> {
        const { device, plan } = this.model;
        const buf = device.createBuffer({
            size: plan.memSize * 4,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });
        const enc = device.createCommandEncoder();
        enc.copyBufferToBuffer(this.mem, 0, buf, 0, plan.memSize * 4);
        device.queue.submit([enc.finish()]);
        await buf.mapAsync(GPUMapMode.READ);
        const out = new Float32Array(buf.getMappedRange().slice(0));
        buf.destroy();
        return out;
    }

    destroy(): void {
        for (const b of this.free) b.destroy();
        this.free.length = 0;
        this.mem.destroy();
    }
}
