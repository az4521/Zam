# DPDFNet noise filter for Zam

A Zam plugin that adds **DPDFNet** to Settings > Voice & Audio > Noise
suppression: Ceva's [DPDFNet-2](https://huggingface.co/Ceva-IP/DPDFNet)
(48 kHz), DeepFilterNet2 with dual-path RNN blocks. On real speech in nine
kinds of noise it scored clearly above Zam's built-in DeepFilterNet3 (PESQ
2.65 vs 2.31, DNSMOS overall 2.65 vs 2.50) and keeps the voice at its level.
It costs about ten times as much, so:

- it runs off the audio thread, on the first of these that works and keeps
  up: your GPU through WebGPU (the model as hand-written WGSL compute
  shaders, checked against ONNX Runtime's answers before first use); native
  ONNX Runtime in the desktop and Android apps (after you agree to the
  plugin running native code); ONNX Runtime Web in a Worker;
- it times itself before first use and on devices too slow for it Zam uses
  DeepFilterNet3 instead; it also hands over to DeepFilterNet3 mid-call if it
  stops keeping up.

On a Ryzen 5800X with a Radeon RX 6000, in the desktop app, counting every
process: WebGPU costs 8% of a CPU core (0.2 ms of GPU time a frame), native
ONNX Runtime 32%, ONNX Runtime Web 38%.

## Layout

    index.json                    plugin index (schema 1)
    plugins/com.zam.dpdfnet/manifest.json files with sizes and SHA-256
    plugins/com.zam.dpdfnet/main.js       the plugin
    plugins/com.zam.dpdfnet/assets/       worklet, Worker (WebGPU kernels and ONNX Runtime
                                  Web), model, the WebGPU self-test's answers
    plugins/com.zam.dpdfnet/native/       desktop host + native ONNX Runtime per platform;
                                  android-<abi>/: Java host (.dex) + .so files

Built from the Zam repo with `node plugins/dpdfnet/build.mjs` (needs a JDK
and ANDROID_HOME for the Android host, JDK 11 or newer; it fetches ONNX Runtime's Android
package from Maven Central and checks its SHA-1). Zam checks
every file against the manifest's SHA-256 before using it, and fetches
everything from the commit you installed.

## Licences

The model is Apache-2.0 (`LICENSE-DPDFNet`), ONNX Runtime is
MIT (`LICENSE-onnxruntime`).
