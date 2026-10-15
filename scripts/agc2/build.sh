#!/bin/sh
# Builds src/lib/audio/agc2.wasm: WebRTC's AGC2 (zam_agc2.cc) as a standalone
# wasm module with no JS glue. Needs Emscripten (emcc on PATH) and, next to
# this script or in $AGC2_SRC, checkouts of:
#   webrtc-audio-processing v2.1
#     (gitlab.freedesktop.org/pulseaudio/webrtc-audio-processing, 846fe90a)
#   abseil-cpp 20240722.0 (its wrap's pinned release)
# Run: scripts/agc2/build.sh [srcdir]
set -eu
here=$(cd "$(dirname "$0")" && pwd)
src=${1:-${AGC2_SRC:-$here}}
w=$src/webrtc-audio-processing/webrtc
absl=$src/abseil-cpp-20240722.0
out=$here/../../src/lib/audio/agc2.wasm
ap=$w/modules/audio_processing

sources="
$here/zam_agc2.cc
$ap/agc2/adaptive_digital_gain_controller.cc
$ap/agc2/biquad_filter.cc
$ap/agc2/compute_interpolated_gain_curve.cc
$ap/agc2/cpu_features.cc
$ap/agc2/fixed_digital_level_estimator.cc
$ap/agc2/gain_applier.cc
$ap/agc2/interpolated_gain_curve.cc
$ap/agc2/limiter.cc
$ap/agc2/limiter_db_gain_curve.cc
$ap/agc2/noise_level_estimator.cc
$ap/agc2/saturation_protector.cc
$ap/agc2/saturation_protector_buffer.cc
$ap/agc2/speech_level_estimator.cc
$ap/agc2/vad_wrapper.cc
$ap/agc2/rnn_vad/auto_correlation.cc
$ap/agc2/rnn_vad/features_extraction.cc
$ap/agc2/rnn_vad/lp_residual.cc
$ap/agc2/rnn_vad/pitch_search.cc
$ap/agc2/rnn_vad/pitch_search_internal.cc
$ap/agc2/rnn_vad/rnn.cc
$ap/agc2/rnn_vad/rnn_fc.cc
$ap/agc2/rnn_vad/rnn_gru.cc
$ap/agc2/rnn_vad/spectral_features.cc
$ap/agc2/rnn_vad/spectral_features_internal.cc
$ap/logging/apm_data_dumper.cc
$ap/utility/pffft_wrapper.cc
$w/third_party/pffft/src/pffft.c
$w/common_audio/audio_util.cc
$w/common_audio/resampler/push_resampler.cc
$w/common_audio/resampler/push_sinc_resampler.cc
$w/common_audio/resampler/sinc_resampler.cc
$w/common_audio/third_party/ooura/fft_size_128/ooura_fft.cc
$w/common_audio/third_party/ooura/fft_size_256/fft4g.cc
$w/rtc_base/memory/aligned_malloc.cc
$w/third_party/rnnoise/src/rnn_vad_weights.cc
$here/stubs.cc
"

# shellcheck disable=SC2086
em++ -O3 -std=c++17 -msimd128 -flto \
    -DWEBRTC_POSIX -DWEBRTC_LINUX -DRTC_DISABLE_LOGGING -DRTC_DISABLE_METRICS \
    -DWEBRTC_APM_DEBUG_DUMP=0 -DNDEBUG -DRTC_DCHECK_IS_ON=0 \
    -fno-exceptions -fno-rtti \
    -I"$w" -I"$absl" \
    $sources \
    -sSTANDALONE_WASM -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=1MB \
    -sSTACK_SIZE=128KB -sFILESYSTEM=0 -sMALLOC=emmalloc \
    --no-entry -o "$out"
ls -l "$out"
