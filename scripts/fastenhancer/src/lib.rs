//! FastEnhancer (Sunghwan Ahn et al., github.com/aask1357/fastenhancer, MIT),
//! the streaming "spec2spec" network ported by hand to wasm. The released
//! ONNX models run on the 14 MB ONNX Runtime Web; this is the same network
//! (checked against ONNX Runtime to better than 80 dB) in a ~30 KB module.
//!
//! One hop at a time: `fe_process` takes `hop` new samples, windows the last
//! `n_fft` of them, takes the FFT, runs the network on the compressed
//! spectrum (conv encoder, 3 RNNFormer blocks of a per-frequency GRU and
//! attention across frequency, conv decoder with skips, a complex mask),
//! undoes the compression, inverse-FFTs and overlap-adds. Output lags the
//! input by `n_fft - hop` samples.
//!
//! Weights are the flat float32 file scripts/fastenhancer/pack.py writes.
//! Matrices are transposed on load so that every matrix product is a run of
//! contiguous multiply-adds (`axpy`) the compiler turns into wasm SIMD.

use std::f32::consts::PI;

const COMPRESSION: f32 = 0.3;
const MAG_FLOOR: f32 = 1.0e-5;

/// exp(x) to about 2e-7 relative error, all float ops so loops over slices
/// vectorize.
#[inline(always)]
fn fast_exp(x: f32) -> f32 {
    let x = x.clamp(-87.0, 87.0);
    let n = (x * std::f32::consts::LOG2_E + 0.5).floor();
    // r = x - n ln2, in two steps for accuracy
    let r = (x - n * 0.693_145_75) - n * 1.428_606_8e-6;
    let p = 1.0
        + r * (1.0
            + r * (0.5
                + r * (0.166_666_67
                    + r * (0.041_666_668 + r * (0.008_333_334 + r * 0.001_388_889)))));
    let bits = ((n as i32 + 127) as u32) << 23;
    p * f32::from_bits(bits)
}

#[inline(always)]
fn sigmoid(x: f32) -> f32 {
    1.0 / (1.0 + fast_exp(-x))
}

#[inline(always)]
fn silu(x: f32) -> f32 {
    x * sigmoid(x)
}

#[inline(always)]
fn tanh(x: f32) -> f32 {
    2.0 * sigmoid(2.0 * x) - 1.0
}

/// y += a * x
#[inline(always)]
fn axpy(y: &mut [f32], a: f32, x: &[f32]) {
    for (yi, xi) in y.iter_mut().zip(x) {
        *yi += a * *xi;
    }
}

struct Block {
    wi_t: Vec<f32>,  // [r][3r] (x @ Wi^T)
    wh_t: Vec<f32>,  // [r][3r]
    bias: Vec<f32>,  // [6r]: Wb(z,r,h), Rb(z,r,h)
    fc_t: Vec<f32>,  // [r][r]
    fc_b: Vec<f32>,  // [r]
    pe: Option<Vec<f32>>, // [rf_freq][r]
    qkv: Vec<f32>,   // [r][3r]
    afc_t: Vec<f32>, // [r][r]
    afc_b: Vec<f32>, // [r]
    cache: Vec<f32>, // [rf_freq][r] GRU hidden state
}

struct Conv {
    w: Vec<f32>, // [cout][cin][k]
    b: Vec<f32>,
}

pub struct Engine {
    c: usize,
    f: usize, // bins after the strided encoder conv
    r: usize, // RNNFormer channels
    rf: usize, // RNNFormer frequencies
    heads: usize,
    n_fft: usize,
    hop: usize,
    nbins: usize, // n_fft / 2, the bins the network sees (the last is dropped)
    enc_pre: Conv,
    enc: [Conv; 2],
    rf_pre_m: Vec<f32>, // [f][rf]
    rf_pre_t: Vec<f32>, // [c][r] (conv weight transposed)
    rf_pre_b: Vec<f32>,
    blocks: Vec<Block>,
    rf_post_m: Vec<f32>, // [rf][f]
    rf_post: Conv,       // [c][r][1]
    dec: [(Conv, Conv); 2],
    dec_post: Conv,
    up_w: Vec<f32>, // [c][2][8]
    up_b: Vec<f32>,
    // STFT
    window: Vec<f32>,
    window_i: Vec<f32>,
    twiddle: Vec<(f32, f32)>,
    cache_in: Vec<f32>,
    cache_out: Vec<f32>,
    // io
    input: Vec<f32>,
    output: Vec<f32>,
    // scratch
    re: Vec<f32>,
    im: Vec<f32>,
    sre: Vec<f32>,
    sim: Vec<f32>,
    pad_in: Vec<f32>,
    a0: Vec<f32>,
    a1: Vec<f32>,
    a2: Vec<f32>,
    m1: Vec<f32>,
    x: Vec<f32>,
    x2: Vec<f32>,
    x3: Vec<f32>,
    hn: Vec<f32>,
    gi: Vec<f32>,
    gh: Vec<f32>,
    qkv_buf: Vec<f32>,
    att: Vec<f32>,
    scores: Vec<f32>,
    m2: Vec<f32>,
    d: Vec<f32>,
    cat: Vec<f32>,
    u: Vec<f32>,
    d2: Vec<f32>,
    mre: Vec<f32>,
    mim: Vec<f32>,
    tmp: Vec<f32>,
    ybuf: Vec<f32>,
}

struct Reader<'a> {
    data: &'a [f32],
    pos: usize,
}

impl<'a> Reader<'a> {
    fn take(&mut self, n: usize) -> Vec<f32> {
        let v = self.data[self.pos..self.pos + n].to_vec();
        self.pos += n;
        v
    }
    fn conv(&mut self, cout: usize, cin: usize, k: usize) -> Conv {
        Conv { w: self.take(cout * cin * k), b: Vec::new() }.with_bias(self, cout)
    }
}

impl Conv {
    fn with_bias(mut self, rd: &mut Reader, cout: usize) -> Conv {
        self.b = rd.take(cout);
        self
    }
}

fn transpose(m: &[f32], rows: usize, cols: usize) -> Vec<f32> {
    let mut t = vec![0.0; m.len()];
    for i in 0..rows {
        for j in 0..cols {
            t[j * rows + i] = m[i * cols + j];
        }
    }
    t
}

impl Engine {
    #[allow(clippy::too_many_arguments)]
    fn new(
        data: &[f32],
        c: usize,
        f: usize,
        r: usize,
        rf: usize,
        blocks: usize,
        heads: usize,
        n_fft: usize,
        hop: usize,
    ) -> Option<Engine> {
        let nbins = n_fft / 2;
        if f * 4 != nbins || r % heads != 0 || n_fft % hop != 0 || !n_fft.is_power_of_two() {
            return None;
        }
        let mut rd = Reader { data, pos: 0 };
        let enc_pre = rd.conv(c, 8, 2);
        let enc = [rd.conv(c, c, 3), rd.conv(c, c, 3)];
        let rf_pre_m = rd.take(f * rf);
        let rf_pre_w = rd.take(r * c);
        let rf_pre_b = rd.take(r);
        let rf_pre_t = transpose(&rf_pre_w, r, c);
        let mut bl = Vec::new();
        for k in 0..blocks {
            let wi = rd.take(3 * r * r);
            let wh = rd.take(3 * r * r);
            let bias = rd.take(6 * r);
            let fc = rd.take(r * r);
            let fc_b = rd.take(r);
            let pe = if k == 0 { Some(rd.take(rf * r)) } else { None };
            let qkv = rd.take(r * 3 * r);
            let afc = rd.take(r * r);
            let afc_b = rd.take(r);
            bl.push(Block {
                wi_t: transpose(&wi, 3 * r, r),
                wh_t: transpose(&wh, 3 * r, r),
                bias,
                fc_t: transpose(&fc, r, r),
                fc_b,
                pe,
                qkv,
                afc_t: transpose(&afc, r, r),
                afc_b,
                cache: vec![0.0; rf * r],
            });
        }
        let rf_post_m = rd.take(rf * f);
        let rf_post = rd.conv(c, r, 1);
        let dec = [
            (rd.conv(c, 2 * c, 1), rd.conv(c, c, 3)),
            (rd.conv(c, 2 * c, 1), rd.conv(c, c, 3)),
        ];
        let dec_post = rd.conv(c, 2 * c, 1);
        let up_w = rd.take(c * 2 * 8);
        let up_b = rd.take(2);
        if rd.pos != data.len() {
            return None;
        }
        // periodic Hann; the inverse window folds in the overlap normalisation
        let window: Vec<f32> = (0..n_fft)
            .map(|i| 0.5 - 0.5 * (2.0 * PI * i as f32 / n_fft as f32).cos())
            .collect();
        let mut window_i = vec![0.0; n_fft];
        for j in 0..n_fft {
            let mut s = 0.0;
            for m in 0..n_fft / hop {
                s += window[(j % hop) + m * hop].powi(2);
            }
            window_i[j] = window[j] / s;
        }
        let twiddle = (0..n_fft / 2)
            .map(|i| {
                let a = -2.0 * PI * i as f32 / n_fft as f32;
                (a.cos(), a.sin())
            })
            .collect();
        let z = |n: usize| vec![0.0f32; n];
        Some(Engine {
            c,
            f,
            r,
            rf,
            heads,
            n_fft,
            hop,
            nbins,
            enc_pre,
            enc,
            rf_pre_m,
            rf_pre_t,
            rf_pre_b,
            blocks: bl,
            rf_post_m,
            rf_post,
            dec,
            dec_post,
            up_w,
            up_b,
            window,
            window_i,
            twiddle,
            cache_in: z(n_fft - hop),
            cache_out: z(n_fft - hop),
            input: z(hop),
            output: z(hop),
            re: z(n_fft),
            im: z(n_fft),
            sre: z(nbins),
            sim: z(nbins),
            pad_in: z(8 * (f + 1)),
            a0: z(c * f),
            a1: z(c * f),
            a2: z(c * f),
            m1: z(c * rf),
            x: z(rf * r),
            x2: z(rf * r),
            x3: z(rf * r),
            hn: z(rf * r),
            gi: z(3 * r),
            gh: z(3 * r),
            qkv_buf: z(rf * 3 * r),
            att: z(rf * r),
            scores: z(rf),
            m2: z(r * f),
            d: z(c * f),
            cat: z(2 * c * f),
            u: z(c * f),
            d2: z(c * f),
            mre: z(nbins),
            mim: z(nbins),
            tmp: z(n_fft),
            ybuf: z(n_fft),
        })
    }

    fn reset(&mut self) {
        self.cache_in.fill(0.0);
        self.cache_out.fill(0.0);
        for b in &mut self.blocks {
            b.cache.fill(0.0);
        }
    }

    /// In-place complex FFT (decimation in time), `inverse` unscaled.
    fn fft(&mut self, inverse: bool) {
        let n = self.n_fft;
        let (re, im) = (&mut self.re, &mut self.im);
        let mut j = 0;
        for i in 1..n {
            let mut bit = n >> 1;
            while j & bit != 0 {
                j ^= bit;
                bit >>= 1;
            }
            j ^= bit;
            if i < j {
                re.swap(i, j);
                im.swap(i, j);
            }
        }
        let mut len = 2;
        while len <= n {
            let step = n / len;
            for i in (0..n).step_by(len) {
                for k in 0..len / 2 {
                    let (wr, wi0) = self.twiddle[k * step];
                    let wi = if inverse { -wi0 } else { wi0 };
                    let (a, b) = (i + k, i + k + len / 2);
                    let xr = re[b] * wr - im[b] * wi;
                    let xi = re[b] * wi + im[b] * wr;
                    re[b] = re[a] - xr;
                    im[b] = im[a] - xi;
                    re[a] += xr;
                    im[a] += xi;
                }
            }
            len <<= 1;
        }
    }

    /// conv1d over rows: y[cout][t] = b + sum x[cin][t+k-pad] w; SiLU if `act`.
    #[allow(clippy::too_many_arguments)]
    fn conv(
        cv: &Conv,
        x: &[f32],
        cin: usize,
        y: &mut [f32],
        cout: usize,
        t: usize,
        k: usize,
        pad: usize,
        act: bool,
    ) {
        for o in 0..cout {
            let yo = &mut y[o * t..(o + 1) * t];
            yo.fill(cv.b[o]);
            for c in 0..cin {
                let xc = &x[c * t..(c + 1) * t];
                for kk in 0..k {
                    let w = cv.w[(o * cin + c) * k + kk];
                    // y[i] += w * x[i + kk - pad], inside [0, t)
                    let lo = pad.saturating_sub(kk);
                    let hi = t.min(t + pad - kk);
                    if lo < hi {
                        axpy(&mut yo[lo..hi], w, &xc[lo + kk - pad..hi + kk - pad]);
                    }
                }
            }
            if act {
                for v in yo.iter_mut() {
                    *v = silu(*v);
                }
            }
        }
    }

    fn process(&mut self) {
        let (c, f, r, rf, heads, n, h) =
            (self.c, self.f, self.r, self.rf, self.heads, self.n_fft, self.hop);
        let nb = self.nbins;
        // ---- STFT of [cache_in, input] ----
        let keep = n - h;
        for i in 0..keep {
            self.re[i] = self.cache_in[i] * self.window[i];
        }
        for i in 0..h {
            self.re[keep + i] = self.input[i] * self.window[keep + i];
        }
        self.im.fill(0.0);
        // new cache: the last n - h samples of the frame (unwindowed)
        self.tmp[..keep].copy_from_slice(&self.cache_in);
        self.tmp[keep..].copy_from_slice(&self.input);
        self.cache_in.copy_from_slice(&self.tmp[h..]);
        self.fft(false);
        // ---- compress (drop the last bin) ----
        for k in 0..nb {
            let (re, im) = (self.re[k], self.im[k]);
            let mag = (re * re + im * im).sqrt().max(MAG_FLOOR);
            let g = mag.powf(COMPRESSION - 1.0);
            self.sre[k] = re * g;
            self.sim[k] = im * g;
        }
        // ---- encoder prenet: pad 2, fold stride 4 into channels ----
        let t1 = f + 1;
        for s in 0..4 {
            for ch in 0..2 {
                let dst = &mut self.pad_in[(s * 2 + ch) * t1..(s * 2 + ch + 1) * t1];
                let src = if ch == 0 { &self.sre } else { &self.sim };
                for (t, d) in dst.iter_mut().enumerate() {
                    let idx = (t * 4 + s) as isize - 2;
                    *d = if idx >= 0 && (idx as usize) < nb { src[idx as usize] } else { 0.0 };
                }
            }
        }
        for o in 0..c {
            let yo = &mut self.a0[o * f..(o + 1) * f];
            yo.fill(self.enc_pre.b[o]);
            for ch in 0..8 {
                for k in 0..2 {
                    let w = self.enc_pre.w[(o * 8 + ch) * 2 + k];
                    axpy(yo, w, &self.pad_in[ch * t1 + k..ch * t1 + k + f]);
                }
            }
            for v in yo.iter_mut() {
                *v = silu(*v);
            }
        }
        Self::conv(&self.enc[0], &self.a0, c, &mut self.a1, c, f, 3, 1, true);
        Self::conv(&self.enc[1], &self.a1, c, &mut self.a2, c, f, 3, 1, true);
        // ---- RNNFormer prenet: [c][f] @ [f][rf], conv c -> r, to x[rf][r] ----
        self.m1.fill(0.0);
        for ci in 0..c {
            for fi in 0..f {
                let a = self.a2[ci * f + fi];
                axpy(
                    &mut self.m1[ci * rf..(ci + 1) * rf],
                    a,
                    &self.rf_pre_m[fi * rf..(fi + 1) * rf],
                );
            }
        }
        for j in 0..rf {
            let xj = &mut self.x[j * r..(j + 1) * r];
            xj.copy_from_slice(&self.rf_pre_b);
            for ci in 0..c {
                axpy(xj, self.m1[ci * rf + j], &self.rf_pre_t[ci * r..(ci + 1) * r]);
            }
        }
        // ---- RNNFormer blocks ----
        let hd = r / heads;
        let scale = 1.0 / (hd as f32).sqrt();
        for bi in 0..self.blocks.len() {
            let bl = &mut self.blocks[bi];
            // GRU, one step per frequency row
            for j in 0..rf {
                let xj = &self.x[j * r..(j + 1) * r];
                let hj = &bl.cache[j * r..(j + 1) * r];
                self.gi.copy_from_slice(&bl.bias[..3 * r]);
                self.gh.copy_from_slice(&bl.bias[3 * r..]);
                for ci in 0..r {
                    axpy(&mut self.gi, xj[ci], &bl.wi_t[ci * 3 * r..(ci + 1) * 3 * r]);
                    axpy(&mut self.gh, hj[ci], &bl.wh_t[ci * 3 * r..(ci + 1) * 3 * r]);
                }
                for ci in 0..r {
                    let z = sigmoid(self.gi[ci] + self.gh[ci]);
                    let rr = sigmoid(self.gi[r + ci] + self.gh[r + ci]);
                    let nn = tanh(self.gi[2 * r + ci] + rr * self.gh[2 * r + ci]);
                    self.hn[j * r + ci] = (1.0 - z) * nn + z * hj[ci];
                }
            }
            bl.cache.copy_from_slice(&self.hn);
            // x2 = fc(hn) + x (+ pe)
            for j in 0..rf {
                let x2 = &mut self.x2[j * r..(j + 1) * r];
                x2.copy_from_slice(&bl.fc_b);
                for ci in 0..r {
                    axpy(x2, self.hn[j * r + ci], &bl.fc_t[ci * r..(ci + 1) * r]);
                }
                for o in 0..r {
                    x2[o] += self.x[j * r + o];
                }
                if let Some(pe) = &bl.pe {
                    for o in 0..r {
                        x2[o] += pe[j * r + o];
                    }
                }
            }
            // attention across frequency
            for j in 0..rf {
                let q = &mut self.qkv_buf[j * 3 * r..(j + 1) * 3 * r];
                q.fill(0.0);
                for ci in 0..r {
                    axpy(q, self.x2[j * r + ci], &bl.qkv[ci * 3 * r..(ci + 1) * 3 * r]);
                }
            }
            for hh in 0..heads {
                for i in 0..rf {
                    let qb = i * 3 * r + hh * 3 * hd;
                    let mut mx = f32::NEG_INFINITY;
                    for j in 0..rf {
                        let kb = j * 3 * r + hh * 3 * hd + hd;
                        let mut s = 0.0;
                        for d in 0..hd {
                            s += self.qkv_buf[qb + d] * self.qkv_buf[kb + d];
                        }
                        let s = s * scale;
                        self.scores[j] = s;
                        mx = mx.max(s);
                    }
                    let mut sum = 0.0;
                    for j in 0..rf {
                        self.scores[j] = fast_exp(self.scores[j] - mx);
                        sum += self.scores[j];
                    }
                    let inv = 1.0 / sum;
                    for d in 0..hd {
                        let mut s = 0.0;
                        for j in 0..rf {
                            s += self.scores[j] * self.qkv_buf[j * 3 * r + hh * 3 * hd + 2 * hd + d];
                        }
                        self.att[i * r + hh * hd + d] = s * inv;
                    }
                }
            }
            for j in 0..rf {
                let x3 = &mut self.x3[j * r..(j + 1) * r];
                x3.copy_from_slice(&bl.afc_b);
                for ci in 0..r {
                    axpy(x3, self.att[j * r + ci], &bl.afc_t[ci * r..(ci + 1) * r]);
                }
                for o in 0..r {
                    x3[o] += self.x2[j * r + o];
                }
            }
            self.x.copy_from_slice(&self.x3);
        }
        // ---- RNNFormer postnet: [r][rf] @ [rf][f], conv r -> c ----
        self.m2.fill(0.0);
        for ri in 0..r {
            for j in 0..rf {
                axpy(
                    &mut self.m2[ri * f..(ri + 1) * f],
                    self.x[j * r + ri],
                    &self.rf_post_m[j * f..(j + 1) * f],
                );
            }
        }
        Self::conv(&self.rf_post, &self.m2, r, &mut self.d, c, f, 1, 0, false);
        // ---- decoder with skips ----
        for i in 0..2 {
            self.cat[..c * f].copy_from_slice(&self.d);
            self.cat[c * f..].copy_from_slice(if i == 0 { &self.a2 } else { &self.a1 });
            Self::conv(&self.dec[i].0, &self.cat, 2 * c, &mut self.u, c, f, 1, 0, true);
            Self::conv(&self.dec[i].1, &self.u, c, &mut self.d2, c, f, 3, 1, true);
            self.d.copy_from_slice(&self.d2);
        }
        self.cat[..c * f].copy_from_slice(&self.d);
        self.cat[c * f..].copy_from_slice(&self.a0);
        Self::conv(&self.dec_post, &self.cat, 2 * c, &mut self.u, c, f, 1, 0, true);
        // ---- transposed conv, k = 8, stride 4, pad 2: c -> (mask re, mask im) ----
        for o in 0..2 {
            let out = if o == 0 { &mut self.mre } else { &mut self.mim };
            out.fill(self.up_b[o]);
            for ci in 0..c {
                let wrow = &self.up_w[(ci * 2 + o) * 8..(ci * 2 + o) * 8 + 8];
                let prow = &self.u[ci * f..(ci + 1) * f];
                for (t, &v) in prow.iter().enumerate() {
                    for (k, &w) in wrow.iter().enumerate() {
                        let idx = (t * 4 + k) as isize - 2;
                        if idx >= 0 && (idx as usize) < nb {
                            out[idx as usize] += v * w;
                        }
                    }
                }
            }
        }
        // ---- apply the mask, undo the compression ----
        let up = 1.0 / COMPRESSION - 1.0;
        self.re[nb] = 0.0;
        self.im[nb] = 0.0;
        for k in 0..nb {
            let re = self.sre[k] * self.mre[k] - self.sim[k] * self.mim[k];
            let im = self.sre[k] * self.mim[k] + self.sim[k] * self.mre[k];
            let g = (re * re + im * im).sqrt().powf(up);
            self.re[k] = re * g;
            self.im[k] = im * g;
        }
        // ---- inverse FFT of the Hermitian-extended spectrum ----
        for k in 1..nb {
            self.re[n - k] = self.re[k];
            self.im[n - k] = -self.im[k];
        }
        self.fft(true);
        let inv_n = 1.0 / n as f32;
        // overlap-add
        for i in 0..n {
            self.ybuf[i] = self.re[i] * inv_n * self.window_i[i];
        }
        for i in 0..keep {
            self.ybuf[i] += self.cache_out[i];
        }
        self.output.copy_from_slice(&self.ybuf[..h]);
        self.cache_out.copy_from_slice(&self.ybuf[h..]);
    }
}

// ---- C ABI for the AudioWorklet ----

static mut WEIGHTS: Vec<f32> = Vec::new();

/// A buffer of `n` floats the host fills with the weights file.
#[no_mangle]
pub extern "C" fn fe_weights(n: usize) -> *mut f32 {
    unsafe {
        let w = &mut *std::ptr::addr_of_mut!(WEIGHTS);
        *w = vec![0.0; n];
        w.as_mut_ptr()
    }
}

/// Build an engine from the weights buffer; 0 if the sizes don't fit.
#[no_mangle]
pub extern "C" fn fe_create(
    c: usize,
    f: usize,
    r: usize,
    rf: usize,
    blocks: usize,
    heads: usize,
    n_fft: usize,
    hop: usize,
) -> *mut Engine {
    let w = unsafe { &*std::ptr::addr_of!(WEIGHTS) };
    match Engine::new(w, c, f, r, rf, blocks, heads, n_fft, hop) {
        Some(e) => Box::into_raw(Box::new(e)),
        None => std::ptr::null_mut(),
    }
}

#[no_mangle]
pub extern "C" fn fe_input(e: *mut Engine) -> *mut f32 {
    unsafe { (*e).input.as_mut_ptr() }
}

#[no_mangle]
pub extern "C" fn fe_output(e: *mut Engine) -> *const f32 {
    unsafe { (*e).output.as_ptr() }
}

#[no_mangle]
pub extern "C" fn fe_process(e: *mut Engine) {
    unsafe { (*e).process() }
}

#[no_mangle]
pub extern "C" fn fe_reset(e: *mut Engine) {
    unsafe { (*e).reset() }
}

#[no_mangle]
pub extern "C" fn fe_destroy(e: *mut Engine) {
    unsafe { drop(Box::from_raw(e)) }
}
