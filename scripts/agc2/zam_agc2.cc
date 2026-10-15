// WebRTC's AGC2 (the adaptive digital gain controller and limiter Chromium's
// WebRTC audio processing runs) as a tiny C API for a standalone wasm module,
// loaded by src/lib/audio/agc2.worklet.js. This is GainController2::Process
// (modules/audio_processing/gain_controller2.cc) without the parts that need
// the rest of the audio processing module: no input volume controller (it
// would move the OS microphone volume) and no AudioBuffer, just mono 10 ms
// frames with AGC2's own RNN voice activity detector.
//
// Built by scripts/agc2/build.sh against webrtc-audio-processing.

#include <algorithm>
#include <cmath>
#include <memory>

#include "api/audio/audio_processing.h"
#include "api/audio/audio_view.h"
#include "common_audio/include/audio_util.h"
#include "modules/audio_processing/agc2/adaptive_digital_gain_controller.h"
#include "modules/audio_processing/agc2/agc2_common.h"
#include "modules/audio_processing/agc2/cpu_features.h"
#include "modules/audio_processing/agc2/limiter.h"
#include "modules/audio_processing/agc2/noise_level_estimator.h"
#include "modules/audio_processing/agc2/saturation_protector.h"
#include "modules/audio_processing/agc2/speech_level_estimator.h"
#include "modules/audio_processing/agc2/vad_wrapper.h"
#include "modules/audio_processing/logging/apm_data_dumper.h"

using namespace webrtc;

namespace {

constexpr int kMaxFrame = 480;  // 10 ms at 48 kHz

struct Agc {
  Agc(int sample_rate_hz,
      const AudioProcessing::Config::GainController2::AdaptiveDigital& config)
      : samples(sample_rate_hz / 100),
        dumper(0),
        speech_level(&dumper, config, kAdjacentSpeechFramesThreshold),
        vad(kVadResetPeriodMs, AvailableCpuFeatures{false, false, false},
            sample_rate_hz),
        noise_level(CreateNoiseFloorEstimator(&dumper)),
        saturation(CreateSaturationProtector(
            kSaturationProtectorInitialHeadroomDb,
            kAdjacentSpeechFramesThreshold, &dumper)),
        controller(&dumper, config, kAdjacentSpeechFramesThreshold),
        limiter(&dumper, samples, "Agc2") {}

  const int samples;
  ApmDataDumper dumper;
  SpeechLevelEstimator speech_level;
  VoiceActivityDetectorWrapper vad;
  std::unique_ptr<NoiseLevelEstimator> noise_level;
  std::unique_ptr<SaturationProtector> saturation;
  AdaptiveDigitalGainController controller;
  Limiter limiter;
  // One frame, in [-1, 1] going in and out; AGC2 works in int16 scale.
  float frame[kMaxFrame] = {};
  float speech_probability = 0;
  float gain_db = 0;
};

}  // namespace

extern "C" {

// Defaults are AGC2's own (AudioProcessing::Config::GainController2).
__attribute__((export_name("agc_create"))) Agc* agc_create(
    int sample_rate_hz,
    float headroom_db,
    float max_gain_db,
    float initial_gain_db,
    float max_gain_change_db_per_second,
    float max_output_noise_level_dbfs) {
  if (sample_rate_hz % 100 != 0 || sample_rate_hz / 100 > kMaxFrame ||
      sample_rate_hz < 8000)
    return nullptr;
  AudioProcessing::Config::GainController2::AdaptiveDigital config;
  config.enabled = true;
  config.headroom_db = headroom_db;
  config.max_gain_db = max_gain_db;
  config.initial_gain_db = initial_gain_db;
  config.max_gain_change_db_per_second = max_gain_change_db_per_second;
  config.max_output_noise_level_dbfs = max_output_noise_level_dbfs;
  return new Agc(sample_rate_hz, config);
}

__attribute__((export_name("agc_destroy"))) void agc_destroy(Agc* agc) {
  delete agc;
}

// The frame to fill before agc_process (sample_rate_hz / 100 samples).
__attribute__((export_name("agc_frame"))) float* agc_frame(Agc* agc) {
  return agc->frame;
}

__attribute__((export_name("agc_speech_probability"))) float
agc_speech_probability(Agc* agc) {
  return agc->speech_probability;
}

// Gain the controller and limiter applied to the last frame, in dB.
__attribute__((export_name("agc_gain_db"))) float agc_gain_db(Agc* agc) {
  return agc->gain_db;
}

__attribute__((export_name("agc_process"))) void agc_process(Agc* agc) {
  const int n = agc->samples;
  float in_sq = 0, peak = 0, rms = 0;
  for (int i = 0; i < n; ++i) {
    float x = agc->frame[i] * 32768.0f;
    agc->frame[i] = x;
    peak = std::max(std::fabs(x), peak);
    rms += x * x;
  }
  in_sq = rms;
  const float peak_dbfs = FloatS16ToDbfs(peak);
  const float rms_dbfs = FloatS16ToDbfs(std::sqrt(rms / n));

  DeinterleavedView<float> view(agc->frame, n, 1);
  const float p = agc->vad.Analyze(view);
  agc->speech_probability = p;
  const float noise_dbfs = agc->noise_level->Analyze(view);
  agc->speech_level.Update(rms_dbfs, peak_dbfs, p);
  agc->saturation->Analyze(p, peak_dbfs, agc->speech_level.level_dbfs());
  agc->controller.Process(
      {.speech_probability = p,
       .speech_level_dbfs = agc->speech_level.level_dbfs(),
       .speech_level_reliable = agc->speech_level.is_confident(),
       .noise_rms_dbfs = noise_dbfs,
       .headroom_db = agc->saturation->HeadroomDb(),
       .limiter_envelope_dbfs = FloatS16ToDbfs(agc->limiter.LastAudioLevel())},
      view);
  agc->limiter.Process(view);

  float out_sq = 0;
  for (int i = 0; i < n; ++i) {
    out_sq += agc->frame[i] * agc->frame[i];
    agc->frame[i] *= 1.0f / 32768.0f;
  }
  if (in_sq > 0 && out_sq > 0)
    agc->gain_db = 10.0f * std::log10(out_sq / in_sq);
}

}  // extern "C"
