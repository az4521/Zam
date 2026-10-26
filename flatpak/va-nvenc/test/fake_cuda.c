// Stand-in libcuda.so.1 for test_encode: the few calls zam_va_nvenc makes.

#include <ffnvcodec/dynlink_cuda.h>

static int refs;
static int pushed;
static int fake_ctx;

int fake_cuda_refs(void) { return refs; }
int fake_cuda_pushed(void) { return pushed; }

CUresult cuInit(unsigned int flags) {
    (void)flags;
    return CUDA_SUCCESS;
}

CUresult cuDeviceGet(CUdevice *dev, int ordinal) {
    *dev = ordinal;
    return CUDA_SUCCESS;
}

CUresult cuDeviceGetByPCIBusId(CUdevice *dev, const char *bus) {
    (void)dev;
    (void)bus;
    return CUDA_ERROR_UNKNOWN;
}

CUresult cuDevicePrimaryCtxRetain(CUcontext *ctx, CUdevice dev) {
    (void)dev;
    refs++;
    *ctx = (CUcontext)&fake_ctx;
    return CUDA_SUCCESS;
}

CUresult cuDevicePrimaryCtxRelease(CUdevice dev) {
    (void)dev;
    refs--;
    return CUDA_SUCCESS;
}

CUresult cuCtxPushCurrent_v2(CUcontext ctx) {
    (void)ctx;
    pushed++;
    return CUDA_SUCCESS;
}

CUresult cuCtxPopCurrent_v2(CUcontext *ctx) {
    *ctx = (CUcontext)&fake_ctx;
    pushed--;
    return CUDA_SUCCESS;
}
