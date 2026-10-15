// Stand-ins for the WebRTC runtime pieces AGC2 links against: UMA metrics
// (nothing to report to) and the fatal-check logger (just trap).

#include "rtc_base/checks.h"
#include "system_wrappers/include/metrics.h"

namespace rtc {
namespace webrtc_checks_impl {
RTC_NORETURN void FatalLog(const char*, int, const char*, const CheckArgType*,
                           ...) {
  __builtin_trap();
}
}  // namespace webrtc_checks_impl
}  // namespace rtc

namespace webrtc {
namespace metrics {
Histogram* HistogramFactoryGetCounts(absl::string_view, int, int, int) {
  return nullptr;
}
Histogram* HistogramFactoryGetCountsLinear(absl::string_view, int, int, int) {
  return nullptr;
}
Histogram* HistogramFactoryGetEnumeration(absl::string_view, int) {
  return nullptr;
}
Histogram* SparseHistogramFactoryGetEnumeration(absl::string_view, int) {
  return nullptr;
}
const char* GetHistogramName(Histogram*) { return ""; }
void HistogramAdd(Histogram*, int) {}
}  // namespace metrics
}  // namespace webrtc
