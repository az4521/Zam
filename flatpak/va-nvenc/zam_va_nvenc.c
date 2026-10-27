// VA-API driver that adds NVENC H.264 encoding in front of nvidia-vaapi-driver.
//
// nvidia-vaapi-driver only decodes, so Chromium encodes call video in software
// on NVIDIA. This driver loads the real one (ZAM_NVENC_REAL_DRIVER, default
// /app/lib/dri/nvidia_drv_video.so), passes every call through to it, and
// answers the H.264 encode calls itself with NVENC.
//
// It covers only the path Chromium's WebRTC encoder takes on Linux
// (media/gpu/vaapi/vaapi_video_encode_accelerator.cc, Chromium 152):
//   - surfaces created with the ENCODER usage hint, which Chromium fills from
//     shared-memory I420 frames through vaDeriveImage. These live in host
//     memory here and never reach the real driver.
//   - no packed headers, so NVENC writes SPS/PPS/slice headers itself and
//     Chromium's reference choices (one previous frame, IDR on request) are
//     what NVENC does on its own.
//   - constant bitrate only; Chromium on Linux doesn't ask for anything else.
// Encoding happens synchronously in vaEndPicture.
//
// Objects created here get ids in the ZAM_ID_TAG range; the real driver counts
// its ids up from 1 and never gets there. ZAM_NVENC_DEBUG=1 logs to stderr with
// a "[zam-nvenc]" prefix.

#include <dlfcn.h>
#include <limits.h>
#include <pthread.h>
#include <stdarg.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/sysmacros.h>
#include <unistd.h>

#include <va/va.h>
#include <va/va_backend.h>
#include <va/va_drmcommon.h>
#include <va/va_enc_h264.h>

#include <ffnvcodec/dynlink_cuda.h>
#include <ffnvcodec/nvEncodeAPI.h>

#define EXPORT __attribute__((visibility("default")))

#ifndef ZAM_NVENC_REAL_DRIVER_DEFAULT
#define ZAM_NVENC_REAL_DRIVER_DEFAULT "/app/lib/dri/nvidia_drv_video.so"
#endif

#define ZAM_ID_TAG 0x5a000000u
#define ZAM_ID_MASK 0xff000000u
#define IS_OURS(id) (((id) & ZAM_ID_MASK) == ZAM_ID_TAG)

#define VENDOR_SUFFIX " + zam NVENC H.264 encoder"

static bool env_on(const char *name) {
    const char *v = getenv(name);
    return v && *v && strcmp(v, "0") != 0;
}

static void logf_(bool always, const char *fmt, ...) __attribute__((format(printf, 2, 3)));
static void logf_(bool always, const char *fmt, ...) {
    if (!always && !env_on("ZAM_NVENC_DEBUG")) return;
    char line[1024];
    va_list ap;
    va_start(ap, fmt);
    vsnprintf(line, sizeof(line), fmt, ap);
    va_end(ap);
    fprintf(stderr, "[zam-nvenc] %s\n", line);
}
#define LOG(...) logf_(false, __VA_ARGS__)
#define LOG_ALWAYS(...) logf_(true, __VA_ARGS__)

// --- CUDA / NVENC entry points ------------------------------------------------
// Loaded by hand: ffnvcodec's loader insists on dozens of CUDA symbols this
// never calls.

typedef NVENCSTATUS NVENCAPI tNvEncodeAPICreateInstance(NV_ENCODE_API_FUNCTION_LIST *);
typedef NVENCSTATUS NVENCAPI tNvEncodeAPIGetMaxSupportedVersion(uint32_t *);

typedef struct Nv {
    void *cuda_lib, *nvenc_lib;
    tcuInit *cuInit;
    tcuDeviceGet *cuDeviceGet;
    tcuDeviceGetByPCIBusId *cuDeviceGetByPCIBusId;
    tcuDevicePrimaryCtxRetain *cuDevicePrimaryCtxRetain;
    tcuDevicePrimaryCtxRelease *cuDevicePrimaryCtxRelease;
    tcuCtxPushCurrent_v2 *cuCtxPushCurrent;
    tcuCtxPopCurrent_v2 *cuCtxPopCurrent;
    NV_ENCODE_API_FUNCTION_LIST fn;
} Nv;

// --- objects ------------------------------------------------------------------

typedef enum { OBJ_CONFIG, OBJ_SURFACE, OBJ_CONTEXT, OBJ_BUFFER, OBJ_IMAGE } ObjType;

typedef struct Obj {
    uint32_t id;
    ObjType type;
    void *data;
    struct Obj *next;
} Obj;

typedef struct Config {
    VAProfile profile;
} Config;

// NV12 in host memory: Y rows of `pitch` bytes, then interleaved UV rows.
typedef struct Surface {
    int width, height;  // as created (Chromium's coded size)
    int pitch, alloc_height;
    uint8_t *data;
    size_t size;
    int derived;  // live images on it
} Surface;

typedef struct Buffer {
    VABufferType type;
    unsigned int size, num_elements;
    uint8_t *data;
    bool owns_data;
    VACodedBufferSegment segment;  // VAEncCodedBufferType only
    uint32_t used;                 // VAEncCodedBufferType only
} Buffer;

typedef struct Image {
    VAImage image;
    VASurfaceID surface;
} Image;

typedef struct Context {
    VAProfile profile;
    // What the next vaEndPicture encodes.
    VASurfaceID target;
    bool have_seq, have_pic;
    VAEncSequenceParameterBufferH264 seq;
    VAEncPictureParameterBufferH264 pic;
    uint32_t bitrate, hrd_buffer_bits;
    uint32_t fps_num, fps_den;
    // The NVENC session, made on the first frame and remade when the size or
    // profile changes.
    void *enc;
    CUcontext cuctx;
    int enc_width, enc_height;
    uint32_t enc_bitrate, enc_fps_num, enc_fps_den, enc_hrd_bits;
    NV_ENC_INITIALIZE_PARAMS init;
    NV_ENC_CONFIG config;
    NV_ENC_INPUT_PTR input;
    NV_ENC_OUTPUT_PTR output;
    uint64_t frames;
} Context;

typedef struct Shim {
    VADriverContextP ctx;
    struct VADriverVTable real;
    pthread_mutex_t lock;
    Obj *objs;
    uint32_t next_id;
    // 0 not probed, 1 NVENC encodes H.264, -1 it doesn't.
    int encode;
    int max_width, max_height;
    Nv nv;
    CUdevice device;
    int contexts;  // retains of the primary CUDA context
    char vendor[256];
    struct Shim *next;
} Shim;

static pthread_mutex_t shims_lock = PTHREAD_MUTEX_INITIALIZER;
static Shim *shims;

static Shim *shim_of(VADriverContextP ctx) {
    pthread_mutex_lock(&shims_lock);
    Shim *s = shims;
    while (s && s->ctx != ctx) s = s->next;
    pthread_mutex_unlock(&shims_lock);
    return s;
}

static Obj *obj_get(Shim *s, uint32_t id, ObjType type) {
    for (Obj *o = s->objs; o; o = o->next)
        if (o->id == id) return o->type == type ? o : NULL;
    return NULL;
}

static void *obj_data(Shim *s, uint32_t id, ObjType type) {
    Obj *o = obj_get(s, id, type);
    return o ? o->data : NULL;
}

static uint32_t obj_add(Shim *s, ObjType type, void *data) {
    Obj *o = calloc(1, sizeof(*o));
    if (!o) return VA_INVALID_ID;
    o->id = ZAM_ID_TAG | (s->next_id++ & ~ZAM_ID_MASK);
    o->type = type;
    o->data = data;
    o->next = s->objs;
    s->objs = o;
    return o->id;
}

static void obj_remove(Shim *s, uint32_t id) {
    for (Obj **p = &s->objs; *p; p = &(*p)->next) {
        if ((*p)->id == id) {
            Obj *o = *p;
            *p = o->next;
            free(o);
            return;
        }
    }
}

static bool is_h264(VAProfile p) {
    return p == VAProfileH264ConstrainedBaseline || p == VAProfileH264Main || p == VAProfileH264High;
}

// --- NVENC probe --------------------------------------------------------------

static bool load_sym(void *lib, void **out, const char *name) {
    *out = dlsym(lib, name);
    if (!*out) LOG_ALWAYS("missing %s", name);
    return *out != NULL;
}

static bool load_nv(Nv *nv) {
    nv->cuda_lib = dlopen("libcuda.so.1", RTLD_NOW | RTLD_LOCAL);
    nv->nvenc_lib = dlopen("libnvidia-encode.so.1", RTLD_NOW | RTLD_LOCAL);
    if (!nv->cuda_lib || !nv->nvenc_lib) {
        LOG_ALWAYS("H.264 encode unavailable: can't load %s", nv->cuda_lib ? "libnvidia-encode.so.1" : "libcuda.so.1");
        return false;
    }
    tNvEncodeAPIGetMaxSupportedVersion *max_version;
    tNvEncodeAPICreateInstance *create;
    if (!load_sym(nv->cuda_lib, (void **)&nv->cuInit, "cuInit") ||
        !load_sym(nv->cuda_lib, (void **)&nv->cuDeviceGet, "cuDeviceGet") ||
        !load_sym(nv->cuda_lib, (void **)&nv->cuDeviceGetByPCIBusId, "cuDeviceGetByPCIBusId") ||
        !load_sym(nv->cuda_lib, (void **)&nv->cuDevicePrimaryCtxRetain, "cuDevicePrimaryCtxRetain") ||
        !load_sym(nv->cuda_lib, (void **)&nv->cuDevicePrimaryCtxRelease, "cuDevicePrimaryCtxRelease") ||
        !load_sym(nv->cuda_lib, (void **)&nv->cuCtxPushCurrent, "cuCtxPushCurrent_v2") ||
        !load_sym(nv->cuda_lib, (void **)&nv->cuCtxPopCurrent, "cuCtxPopCurrent_v2") ||
        !load_sym(nv->nvenc_lib, (void **)&max_version, "NvEncodeAPIGetMaxSupportedVersion") ||
        !load_sym(nv->nvenc_lib, (void **)&create, "NvEncodeAPICreateInstance"))
        return false;

    uint32_t version = 0;
    const uint32_t wanted = (NVENCAPI_MAJOR_VERSION << 4) | NVENCAPI_MINOR_VERSION;
    if (max_version(&version) != NV_ENC_SUCCESS || version < wanted) {
        LOG_ALWAYS("H.264 encode unavailable: the NVIDIA driver supports NVENC API %u.%u, this needs %u.%u",
                   version >> 4, version & 0xf, NVENCAPI_MAJOR_VERSION, NVENCAPI_MINOR_VERSION);
        return false;
    }
    nv->fn.version = NV_ENCODE_API_FUNCTION_LIST_VER;
    if (create(&nv->fn) != NV_ENC_SUCCESS) {
        LOG_ALWAYS("H.264 encode unavailable: NvEncodeAPICreateInstance failed");
        return false;
    }
    return true;
}

// The CUDA device behind libva's DRM fd, by PCI address; device 0 if that
// can't be worked out.
static CUdevice find_device(Shim *s) {
    CUdevice dev = 0;
    struct drm_state *drm = s->ctx->drm_state;
    struct stat st;
    if (drm && drm->fd >= 0 && fstat(drm->fd, &st) == 0 && S_ISCHR(st.st_mode)) {
        char link[PATH_MAX], target[PATH_MAX];
        snprintf(link, sizeof(link), "/sys/dev/char/%u:%u/device", major(st.st_rdev), minor(st.st_rdev));
        ssize_t n = readlink(link, target, sizeof(target) - 1);
        if (n > 0) {
            target[n] = 0;
            const char *bus = strrchr(target, '/');
            bus = bus ? bus + 1 : target;
            if (s->nv.cuDeviceGetByPCIBusId(&dev, bus) == CUDA_SUCCESS) {
                LOG("using CUDA device at %s", bus);
                return dev;
            }
        }
    }
    if (s->nv.cuDeviceGet(&dev, 0) != CUDA_SUCCESS) return -1;
    LOG("using CUDA device 0");
    return dev;
}

static void *open_session(Shim *s, CUcontext cuctx) {
    NV_ENC_OPEN_ENCODE_SESSION_EX_PARAMS p = {
        .version = NV_ENC_OPEN_ENCODE_SESSION_EX_PARAMS_VER,
        .deviceType = NV_ENC_DEVICE_TYPE_CUDA,
        .device = cuctx,
        .apiVersion = NVENCAPI_VERSION,
    };
    void *enc = NULL;
    NVENCSTATUS st = s->nv.fn.nvEncOpenEncodeSessionEx(&p, &enc);
    if (st != NV_ENC_SUCCESS) {
        LOG_ALWAYS("nvEncOpenEncodeSessionEx failed: %d", st);
        return NULL;
    }
    return enc;
}

// Whether NVENC encodes H.264 here, asked once per display. Holds s->lock.
static bool encode_available(Shim *s) {
    if (s->encode) return s->encode > 0;
    s->encode = -1;
    if (!load_nv(&s->nv)) return false;
    if (s->nv.cuInit(0) != CUDA_SUCCESS) {
        LOG_ALWAYS("H.264 encode unavailable: cuInit failed");
        return false;
    }
    s->device = find_device(s);
    CUcontext cuctx;
    if (s->device < 0 || s->nv.cuDevicePrimaryCtxRetain(&cuctx, s->device) != CUDA_SUCCESS) {
        LOG_ALWAYS("H.264 encode unavailable: no CUDA context");
        return false;
    }
    void *enc = open_session(s, cuctx);
    bool h264 = false;
    if (enc) {
        GUID guids[16];
        uint32_t count = 0;
        if (s->nv.fn.nvEncGetEncodeGUIDs(enc, guids, 16, &count) == NV_ENC_SUCCESS) {
            for (uint32_t i = 0; i < count; i++)
                if (!memcmp(&guids[i], &NV_ENC_CODEC_H264_GUID, sizeof(GUID))) h264 = true;
        }
        s->max_width = s->max_height = 4096;
        NV_ENC_CAPS_PARAM caps = {.version = NV_ENC_CAPS_PARAM_VER};
        int v;
        caps.capsToQuery = NV_ENC_CAPS_WIDTH_MAX;
        if (h264 && s->nv.fn.nvEncGetEncodeCaps(enc, NV_ENC_CODEC_H264_GUID, &caps, &v) == NV_ENC_SUCCESS && v > 0)
            s->max_width = v;
        caps.capsToQuery = NV_ENC_CAPS_HEIGHT_MAX;
        if (h264 && s->nv.fn.nvEncGetEncodeCaps(enc, NV_ENC_CODEC_H264_GUID, &caps, &v) == NV_ENC_SUCCESS && v > 0)
            s->max_height = v;
        s->nv.fn.nvEncDestroyEncoder(enc);
    }
    s->nv.cuDevicePrimaryCtxRelease(s->device);
    if (!h264) {
        LOG_ALWAYS("H.264 encode unavailable: NVENC lists no H.264 encoder");
        return false;
    }
    s->encode = 1;
    LOG_ALWAYS("H.264 encode available, up to %dx%d", s->max_width, s->max_height);
    return true;
}

// --- NVENC session ------------------------------------------------------------

static void close_session(Shim *s, Context *c) {
    if (!c->enc) return;
    s->nv.cuCtxPushCurrent(c->cuctx);
    if (c->input) s->nv.fn.nvEncDestroyInputBuffer(c->enc, c->input);
    if (c->output) s->nv.fn.nvEncDestroyBitstreamBuffer(c->enc, c->output);
    s->nv.fn.nvEncDestroyEncoder(c->enc);
    CUcontext dummy;
    s->nv.cuCtxPopCurrent(&dummy);
    c->enc = NULL;
    c->input = NULL;
    c->output = NULL;
}

static void fill_rate(Context *c) {
    NV_ENC_RC_PARAMS *rc = &c->config.rcParams;
    rc->rateControlMode = NV_ENC_PARAMS_RC_CBR;
    rc->averageBitRate = c->bitrate;
    rc->maxBitRate = c->bitrate;
    // Chromium's HRD buffer when it sends one, else one second.
    rc->vbvBufferSize = c->hrd_buffer_bits ? c->hrd_buffer_bits : c->bitrate;
    rc->vbvInitialDelay = rc->vbvBufferSize;
    c->init.frameRateNum = c->fps_num;
    c->init.frameRateDen = c->fps_den;
    c->enc_bitrate = c->bitrate;
    c->enc_hrd_bits = c->hrd_buffer_bits;
    c->enc_fps_num = c->fps_num;
    c->enc_fps_den = c->fps_den;
}

static bool open_encoder(Shim *s, Context *c, int width, int height) {
    void *enc = open_session(s, c->cuctx);
    if (!enc) return false;
    c->enc = enc;

    const GUID preset = NV_ENC_PRESET_P3_GUID;
    NV_ENC_PRESET_CONFIG pc = {.version = NV_ENC_PRESET_CONFIG_VER, .presetCfg = {.version = NV_ENC_CONFIG_VER}};
    NVENCSTATUS st = s->nv.fn.nvEncGetEncodePresetConfigEx(enc, NV_ENC_CODEC_H264_GUID, preset,
                                                           NV_ENC_TUNING_INFO_ULTRA_LOW_LATENCY, &pc);
    if (st != NV_ENC_SUCCESS) {
        LOG_ALWAYS("nvEncGetEncodePresetConfigEx failed: %d", st);
        return false;
    }
    c->config = pc.presetCfg;
    c->config.version = NV_ENC_CONFIG_VER;
    c->config.profileGUID = c->profile == VAProfileH264High   ? NV_ENC_H264_PROFILE_HIGH_GUID
                            : c->profile == VAProfileH264Main ? NV_ENC_H264_PROFILE_MAIN_GUID
                                                              : NV_ENC_H264_PROFILE_BASELINE_GUID;
    // IPPP with one reference, an IDR only when Chromium asks: what its own
    // reference handling would have produced.
    c->config.gopLength = NVENC_INFINITE_GOPLENGTH;
    c->config.frameIntervalP = 1;
    NV_ENC_CONFIG_H264 *h264 = &c->config.encodeCodecConfig.h264Config;
    h264->idrPeriod = NVENC_INFINITE_GOPLENGTH;
    h264->repeatSPSPPS = 1;
    h264->outputAUD = 0;
    h264->disableSPSPPS = 0;
    h264->sliceMode = 0;
    h264->sliceModeData = 0;
    h264->maxNumRefFrames = 1;
    h264->chromaFormatIDC = 1;
    h264->level = NV_ENC_LEVEL_AUTOSELECT;
    if (c->profile == VAProfileH264ConstrainedBaseline)
        h264->entropyCodingMode = NV_ENC_H264_ENTROPY_CODING_MODE_CAVLC;

    c->init = (NV_ENC_INITIALIZE_PARAMS){
        .version = NV_ENC_INITIALIZE_PARAMS_VER,
        .encodeGUID = NV_ENC_CODEC_H264_GUID,
        .presetGUID = preset,
        .encodeWidth = width,
        .encodeHeight = height,
        .darWidth = width,
        .darHeight = height,
        .maxEncodeWidth = width,
        .maxEncodeHeight = height,
        .enablePTD = 1,
        .encodeConfig = &c->config,
        .tuningInfo = NV_ENC_TUNING_INFO_ULTRA_LOW_LATENCY,
    };
    fill_rate(c);
    st = s->nv.fn.nvEncInitializeEncoder(enc, &c->init);
    if (st != NV_ENC_SUCCESS) {
        LOG_ALWAYS("nvEncInitializeEncoder %dx%d failed: %d", width, height, st);
        return false;
    }

    NV_ENC_CREATE_INPUT_BUFFER in = {
        .version = NV_ENC_CREATE_INPUT_BUFFER_VER,
        .width = width,
        .height = height,
        .bufferFmt = NV_ENC_BUFFER_FORMAT_NV12,
    };
    if ((st = s->nv.fn.nvEncCreateInputBuffer(enc, &in)) != NV_ENC_SUCCESS) {
        LOG_ALWAYS("nvEncCreateInputBuffer failed: %d", st);
        return false;
    }
    c->input = in.inputBuffer;
    NV_ENC_CREATE_BITSTREAM_BUFFER out = {.version = NV_ENC_CREATE_BITSTREAM_BUFFER_VER};
    if ((st = s->nv.fn.nvEncCreateBitstreamBuffer(enc, &out)) != NV_ENC_SUCCESS) {
        LOG_ALWAYS("nvEncCreateBitstreamBuffer failed: %d", st);
        return false;
    }
    c->output = out.bitstreamBuffer;
    c->enc_width = width;
    c->enc_height = height;
    c->frames = 0;
    LOG("opened %dx%d encoder at %u bps, %u/%u fps", width, height, c->bitrate, c->fps_num, c->fps_den);
    return true;
}

static bool reconfigure_rate(Shim *s, Context *c) {
    fill_rate(c);
    NV_ENC_RECONFIGURE_PARAMS rp = {
        .version = NV_ENC_RECONFIGURE_PARAMS_VER,
        .reInitEncodeParams = c->init,
    };
    NVENCSTATUS st = s->nv.fn.nvEncReconfigureEncoder(c->enc, &rp);
    if (st != NV_ENC_SUCCESS) {
        LOG_ALWAYS("nvEncReconfigureEncoder failed: %d", st);
        return false;
    }
    LOG("now %u bps, %u/%u fps", c->bitrate, c->fps_num, c->fps_den);
    return true;
}

// Encodes c->target into the picture's coded buffer. Holds s->lock with the
// CUDA context current.
static VAStatus encode_frame(Shim *s, Context *c) {
    Surface *src = obj_data(s, c->target, OBJ_SURFACE);
    Buffer *coded = obj_data(s, c->pic.coded_buf, OBJ_BUFFER);
    if (!src || !coded || coded->type != VAEncCodedBufferType || !c->have_seq) {
        LOG_ALWAYS("vaEndPicture without a surface, coded buffer or sequence parameters");
        return VA_STATUS_ERROR_INVALID_PARAMETER;
    }

    // The visible size, from the cropping Chromium put in its SPS (4:2:0,
    // frame_mbs_only, so crop units are 2 pixels).
    const VAEncSequenceParameterBufferH264 *seq = &c->seq;
    int width = seq->picture_width_in_mbs * 16;
    int height = seq->picture_height_in_mbs * 16;
    if (seq->frame_cropping_flag) {
        width -= 2 * (seq->frame_crop_left_offset + seq->frame_crop_right_offset);
        height -= 2 * (seq->frame_crop_top_offset + seq->frame_crop_bottom_offset);
    }
    if (width <= 0 || height <= 0 || width > src->width || height > src->height) {
        LOG_ALWAYS("bad picture size %dx%d for a %dx%d surface", width, height, src->width, src->height);
        return VA_STATUS_ERROR_INVALID_PARAMETER;
    }

    if (c->enc && (width != c->enc_width || height != c->enc_height)) close_session(s, c);
    if (!c->enc && !open_encoder(s, c, width, height)) {
        close_session(s, c);
        return VA_STATUS_ERROR_ENCODING_ERROR;
    }
    if ((c->bitrate != c->enc_bitrate || c->fps_num != c->enc_fps_num || c->fps_den != c->enc_fps_den ||
         c->hrd_buffer_bits != c->enc_hrd_bits) &&
        !reconfigure_rate(s, c))
        return VA_STATUS_ERROR_ENCODING_ERROR;

    NV_ENC_LOCK_INPUT_BUFFER lock = {.version = NV_ENC_LOCK_INPUT_BUFFER_VER, .inputBuffer = c->input};
    NVENCSTATUS st = s->nv.fn.nvEncLockInputBuffer(c->enc, &lock);
    if (st != NV_ENC_SUCCESS) {
        LOG_ALWAYS("nvEncLockInputBuffer failed: %d", st);
        return VA_STATUS_ERROR_ENCODING_ERROR;
    }
    uint8_t *dst = lock.bufferDataPtr;
    const uint32_t pitch = lock.pitch;
    for (int y = 0; y < height; y++)
        memcpy(dst + (size_t)y * pitch, src->data + (size_t)y * src->pitch, width);
    uint8_t *dst_uv = dst + (size_t)pitch * height;
    const uint8_t *src_uv = src->data + (size_t)src->pitch * src->alloc_height;
    for (int y = 0; y < (height + 1) / 2; y++)
        memcpy(dst_uv + (size_t)y * pitch, src_uv + (size_t)y * src->pitch, width);
    s->nv.fn.nvEncUnlockInputBuffer(c->enc, c->input);

    const bool idr = c->pic.pic_fields.bits.idr_pic_flag || c->frames == 0;
    NV_ENC_PIC_PARAMS pp = {
        .version = NV_ENC_PIC_PARAMS_VER,
        .inputWidth = width,
        .inputHeight = height,
        .inputPitch = pitch,
        .encodePicFlags = idr ? (NV_ENC_PIC_FLAG_FORCEIDR | NV_ENC_PIC_FLAG_OUTPUT_SPSPPS) : 0,
        .inputTimeStamp = c->frames,
        .inputBuffer = c->input,
        .outputBitstream = c->output,
        .bufferFmt = NV_ENC_BUFFER_FORMAT_NV12,
        .pictureStruct = NV_ENC_PIC_STRUCT_FRAME,
    };
    if ((st = s->nv.fn.nvEncEncodePicture(c->enc, &pp)) != NV_ENC_SUCCESS) {
        LOG_ALWAYS("nvEncEncodePicture failed: %d", st);
        return VA_STATUS_ERROR_ENCODING_ERROR;
    }

    NV_ENC_LOCK_BITSTREAM bs = {.version = NV_ENC_LOCK_BITSTREAM_VER, .outputBitstream = c->output};
    if ((st = s->nv.fn.nvEncLockBitstream(c->enc, &bs)) != NV_ENC_SUCCESS) {
        LOG_ALWAYS("nvEncLockBitstream failed: %d", st);
        return VA_STATUS_ERROR_ENCODING_ERROR;
    }
    VAStatus result = VA_STATUS_SUCCESS;
    if (bs.bitstreamSizeInBytes > coded->size) {
        LOG_ALWAYS("encoded frame of %u bytes doesn't fit the %u-byte coded buffer", bs.bitstreamSizeInBytes,
                   coded->size);
        result = VA_STATUS_ERROR_NOT_ENOUGH_BUFFER;
    } else {
        memcpy(coded->data, bs.bitstreamBufferPtr, bs.bitstreamSizeInBytes);
        coded->used = bs.bitstreamSizeInBytes;
    }
    s->nv.fn.nvEncUnlockBitstream(c->enc, c->output);
    LOG("frame %llu: %s, %u bytes", (unsigned long long)c->frames, idr ? "IDR" : "P", bs.bitstreamSizeInBytes);
    c->frames++;
    return result;
}

// --- config queries -----------------------------------------------------------

static VAStatus zam_QueryConfigProfiles(VADriverContextP ctx, VAProfile *list, int *num) {
    Shim *s = shim_of(ctx);
    VAStatus st = s->real.vaQueryConfigProfiles(ctx, list, num);
    if (st != VA_STATUS_SUCCESS) return st;
    pthread_mutex_lock(&s->lock);
    const bool encode = encode_available(s);
    pthread_mutex_unlock(&s->lock);
    if (!encode) return st;
    // The decoder lists every H.264 profile NVDEC has; add any it left out.
    const VAProfile want[] = {VAProfileH264ConstrainedBaseline, VAProfileH264Main, VAProfileH264High};
    for (size_t w = 0; w < sizeof(want) / sizeof(want[0]); w++) {
        bool found = false;
        for (int i = 0; i < *num; i++) found |= list[i] == want[w];
        if (!found && *num < ctx->max_profiles) list[(*num)++] = want[w];
    }
    return st;
}

static VAStatus zam_QueryConfigEntrypoints(VADriverContextP ctx, VAProfile profile, VAEntrypoint *list, int *num) {
    Shim *s = shim_of(ctx);
    VAStatus st = s->real.vaQueryConfigEntrypoints(ctx, profile, list, num);
    if (!is_h264(profile)) return st;
    pthread_mutex_lock(&s->lock);
    const bool encode = encode_available(s);
    pthread_mutex_unlock(&s->lock);
    if (!encode) return st;
    if (st != VA_STATUS_SUCCESS) *num = 0;
    list[(*num)++] = VAEntrypointEncSlice;
    return VA_STATUS_SUCCESS;
}

// The answer for one config attribute of our encoder.
static uint32_t encoder_attrib(VAConfigAttribType type) {
    switch (type) {
        case VAConfigAttribRTFormat:
            return VA_RT_FORMAT_YUV420;
        case VAConfigAttribRateControl:
            return VA_RC_CBR;
        case VAConfigAttribEncPackedHeaders:
            return VA_ENC_PACKED_HEADER_NONE;
        case VAConfigAttribEncMaxRefFrames:
            return 1;
        case VAConfigAttribEncMaxSlices:
            return 1;
        default:
            return VA_ATTRIB_NOT_SUPPORTED;
    }
}

static bool our_encoder(Shim *s, VAProfile profile, VAEntrypoint entrypoint) {
    if (entrypoint != VAEntrypointEncSlice || !is_h264(profile)) return false;
    pthread_mutex_lock(&s->lock);
    const bool encode = encode_available(s);
    pthread_mutex_unlock(&s->lock);
    return encode;
}

static VAStatus zam_GetConfigAttributes(VADriverContextP ctx, VAProfile profile, VAEntrypoint entrypoint,
                                        VAConfigAttrib *list, int num) {
    Shim *s = shim_of(ctx);
    if (!our_encoder(s, profile, entrypoint)) return s->real.vaGetConfigAttributes(ctx, profile, entrypoint, list, num);
    for (int i = 0; i < num; i++) list[i].value = encoder_attrib(list[i].type);
    return VA_STATUS_SUCCESS;
}

static VAStatus zam_CreateConfig(VADriverContextP ctx, VAProfile profile, VAEntrypoint entrypoint,
                                 VAConfigAttrib *attribs, int num, VAConfigID *out) {
    Shim *s = shim_of(ctx);
    if (!our_encoder(s, profile, entrypoint)) {
        if (entrypoint == VAEntrypointEncSlice || entrypoint == VAEntrypointEncSliceLP)
            LOG("no encoder for profile %d", profile);
        return s->real.vaCreateConfig(ctx, profile, entrypoint, attribs, num, out);
    }
    for (int i = 0; i < num; i++) {
        const uint32_t have = encoder_attrib(attribs[i].type);
        const uint32_t want = attribs[i].value;
        bool ok = true;
        switch (attribs[i].type) {
            case VAConfigAttribRTFormat:
            case VAConfigAttribRateControl:
                ok = (want & have) == want;
                break;
            case VAConfigAttribEncPackedHeaders:
                ok = want == VA_ENC_PACKED_HEADER_NONE;
                break;
            default:
                break;
        }
        if (!ok) {
            LOG("refusing config attribute %d = 0x%x", attribs[i].type, want);
            return attribs[i].type == VAConfigAttribRTFormat ? VA_STATUS_ERROR_UNSUPPORTED_RT_FORMAT
                                                             : VA_STATUS_ERROR_INVALID_VALUE;
        }
    }
    Config *cfg = calloc(1, sizeof(*cfg));
    if (!cfg) return VA_STATUS_ERROR_ALLOCATION_FAILED;
    cfg->profile = profile;
    pthread_mutex_lock(&s->lock);
    *out = obj_add(s, OBJ_CONFIG, cfg);
    pthread_mutex_unlock(&s->lock);
    LOG("config %#x for profile %d", *out, profile);
    return *out == VA_INVALID_ID ? VA_STATUS_ERROR_ALLOCATION_FAILED : VA_STATUS_SUCCESS;
}

static VAStatus zam_DestroyConfig(VADriverContextP ctx, VAConfigID id) {
    Shim *s = shim_of(ctx);
    if (!IS_OURS(id)) return s->real.vaDestroyConfig(ctx, id);
    pthread_mutex_lock(&s->lock);
    Config *cfg = obj_data(s, id, OBJ_CONFIG);
    if (cfg) obj_remove(s, id);
    pthread_mutex_unlock(&s->lock);
    free(cfg);
    return cfg ? VA_STATUS_SUCCESS : VA_STATUS_ERROR_INVALID_CONFIG;
}

static VAStatus zam_QueryConfigAttributes(VADriverContextP ctx, VAConfigID id, VAProfile *profile,
                                          VAEntrypoint *entrypoint, VAConfigAttrib *list, int *num) {
    Shim *s = shim_of(ctx);
    if (!IS_OURS(id)) return s->real.vaQueryConfigAttributes(ctx, id, profile, entrypoint, list, num);
    pthread_mutex_lock(&s->lock);
    Config *cfg = obj_data(s, id, OBJ_CONFIG);
    VAProfile p = cfg ? cfg->profile : VAProfileNone;
    pthread_mutex_unlock(&s->lock);
    if (!cfg) return VA_STATUS_ERROR_INVALID_CONFIG;
    *profile = p;
    *entrypoint = VAEntrypointEncSlice;
    const VAConfigAttribType types[] = {VAConfigAttribRTFormat, VAConfigAttribRateControl,
                                        VAConfigAttribEncPackedHeaders, VAConfigAttribEncMaxRefFrames,
                                        VAConfigAttribEncMaxSlices};
    int n = 0;
    for (size_t i = 0; i < sizeof(types) / sizeof(types[0]) && (int)i < ctx->max_attributes; i++, n++) {
        list[n].type = types[i];
        list[n].value = encoder_attrib(types[i]);
    }
    *num = n;
    return VA_STATUS_SUCCESS;
}

static VAStatus zam_QuerySurfaceAttributes(VADriverContextP ctx, VAConfigID id, VASurfaceAttrib *list,
                                           unsigned int *num) {
    Shim *s = shim_of(ctx);
    if (!IS_OURS(id)) {
        if (!s->real.vaQuerySurfaceAttributes) return VA_STATUS_ERROR_UNIMPLEMENTED;
        return s->real.vaQuerySurfaceAttributes(ctx, id, list, num);
    }
    pthread_mutex_lock(&s->lock);
    const bool known = obj_get(s, id, OBJ_CONFIG) != NULL;
    const int max_w = s->max_width, max_h = s->max_height;
    pthread_mutex_unlock(&s->lock);
    if (!known) return VA_STATUS_ERROR_INVALID_CONFIG;
    const VASurfaceAttrib attrs[] = {
        {VASurfaceAttribPixelFormat, VA_SURFACE_ATTRIB_GETTABLE | VA_SURFACE_ATTRIB_SETTABLE,
         {VAGenericValueTypeInteger, {.i = VA_FOURCC_NV12}}},
        {VASurfaceAttribMinWidth, VA_SURFACE_ATTRIB_GETTABLE, {VAGenericValueTypeInteger, {.i = 16}}},
        {VASurfaceAttribMinHeight, VA_SURFACE_ATTRIB_GETTABLE, {VAGenericValueTypeInteger, {.i = 16}}},
        {VASurfaceAttribMaxWidth, VA_SURFACE_ATTRIB_GETTABLE, {VAGenericValueTypeInteger, {.i = max_w}}},
        {VASurfaceAttribMaxHeight, VA_SURFACE_ATTRIB_GETTABLE, {VAGenericValueTypeInteger, {.i = max_h}}},
        {VASurfaceAttribMemoryType, VA_SURFACE_ATTRIB_GETTABLE | VA_SURFACE_ATTRIB_SETTABLE,
         {VAGenericValueTypeInteger, {.i = VA_SURFACE_ATTRIB_MEM_TYPE_VA}}},
    };
    const unsigned int count = sizeof(attrs) / sizeof(attrs[0]);
    if (!list) {
        *num = count;
        return VA_STATUS_SUCCESS;
    }
    if (*num < count) {
        *num = count;
        return VA_STATUS_ERROR_MAX_NUM_EXCEEDED;
    }
    memcpy(list, attrs, sizeof(attrs));
    *num = count;
    return VA_STATUS_SUCCESS;
}

// --- surfaces -----------------------------------------------------------------

// Chromium's encoder input and reconstructed surfaces carry the ENCODER hint and
// nothing that would make them imports or video-processing targets.
static bool encoder_surfaces(unsigned int format, VASurfaceAttrib *attribs, unsigned int num) {
    if (format != VA_RT_FORMAT_YUV420) return false;
    bool encoder = false;
    for (unsigned int i = 0; i < num; i++) {
        const VASurfaceAttrib *a = &attribs[i];
        if (!(a->flags & VA_SURFACE_ATTRIB_SETTABLE)) continue;
        switch (a->type) {
            case VASurfaceAttribUsageHint:
                if (a->value.value.i & (VA_SURFACE_ATTRIB_USAGE_HINT_VPP_WRITE | VA_SURFACE_ATTRIB_USAGE_HINT_DECODER |
                                        VA_SURFACE_ATTRIB_USAGE_HINT_EXPORT))
                    return false;
                encoder = a->value.value.i & VA_SURFACE_ATTRIB_USAGE_HINT_ENCODER;
                break;
            case VASurfaceAttribPixelFormat:
                if ((uint32_t)a->value.value.i != VA_FOURCC_NV12) return false;
                break;
            case VASurfaceAttribMemoryType:
                if (a->value.value.i != VA_SURFACE_ATTRIB_MEM_TYPE_VA) return false;
                break;
            case VASurfaceAttribExternalBufferDescriptor:
            case VASurfaceAttribDRMFormatModifiers:
                return false;
            default:
                break;
        }
    }
    return encoder;
}

static void free_surface(Surface *sf) {
    if (!sf) return;
    free(sf->data);
    free(sf);
}

static VAStatus zam_CreateSurfaces2(VADriverContextP ctx, unsigned int format, unsigned int width, unsigned int height,
                                    VASurfaceID *surfaces, unsigned int num, VASurfaceAttrib *attribs,
                                    unsigned int num_attribs) {
    Shim *s = shim_of(ctx);
    bool ours = s->encode > 0 && encoder_surfaces(format, attribs, num_attribs);
    if (!ours) {
        if (s->real.vaCreateSurfaces2)
            return s->real.vaCreateSurfaces2(ctx, format, width, height, surfaces, num, attribs, num_attribs);
        return s->real.vaCreateSurfaces(ctx, width, height, format, num, surfaces);
    }
    if (!width || !height || width > 16384 || height > 16384) return VA_STATUS_ERROR_INVALID_PARAMETER;
    pthread_mutex_lock(&s->lock);
    for (unsigned int i = 0; i < num; i++) {
        Surface *sf = calloc(1, sizeof(*sf));
        if (sf) {
            sf->width = width;
            sf->height = height;
            sf->pitch = (width + 63) & ~63u;
            sf->alloc_height = (height + 1) & ~1u;
            sf->size = (size_t)sf->pitch * sf->alloc_height * 3 / 2;
            sf->data = calloc(1, sf->size);
        }
        surfaces[i] = sf && sf->data ? obj_add(s, OBJ_SURFACE, sf) : VA_INVALID_ID;
        if (surfaces[i] == VA_INVALID_ID) {
            free_surface(sf);
            for (unsigned int j = 0; j < i; j++) {
                free_surface(obj_data(s, surfaces[j], OBJ_SURFACE));
                obj_remove(s, surfaces[j]);
            }
            pthread_mutex_unlock(&s->lock);
            return VA_STATUS_ERROR_ALLOCATION_FAILED;
        }
    }
    pthread_mutex_unlock(&s->lock);
    LOG("%u encoder surface(s) %ux%u", num, width, height);
    return VA_STATUS_SUCCESS;
}

static VAStatus zam_CreateSurfaces(VADriverContextP ctx, int width, int height, int format, int num,
                                   VASurfaceID *surfaces) {
    return shim_of(ctx)->real.vaCreateSurfaces(ctx, width, height, format, num, surfaces);
}

static VAStatus zam_DestroySurfaces(VADriverContextP ctx, VASurfaceID *list, int num) {
    Shim *s = shim_of(ctx);
    VASurfaceID *theirs = malloc(sizeof(*theirs) * (num > 0 ? num : 1));
    if (!theirs) return VA_STATUS_ERROR_ALLOCATION_FAILED;
    int n = 0;
    pthread_mutex_lock(&s->lock);
    for (int i = 0; i < num; i++) {
        if (!IS_OURS(list[i])) {
            theirs[n++] = list[i];
            continue;
        }
        Surface *sf = obj_data(s, list[i], OBJ_SURFACE);
        if (!sf) continue;
        obj_remove(s, list[i]);
        free_surface(sf);
    }
    pthread_mutex_unlock(&s->lock);
    VAStatus st = n ? s->real.vaDestroySurfaces(ctx, theirs, n) : VA_STATUS_SUCCESS;
    free(theirs);
    return st;
}

static VAStatus zam_SyncSurface(VADriverContextP ctx, VASurfaceID id) {
    Shim *s = shim_of(ctx);
    if (!IS_OURS(id)) return s->real.vaSyncSurface(ctx, id);
    return VA_STATUS_SUCCESS;  // encoded in vaEndPicture
}

static VAStatus zam_SyncSurface2(VADriverContextP ctx, VASurfaceID id, uint64_t timeout) {
    Shim *s = shim_of(ctx);
    if (!IS_OURS(id)) return s->real.vaSyncSurface2(ctx, id, timeout);
    return VA_STATUS_SUCCESS;
}

static VAStatus zam_QuerySurfaceStatus(VADriverContextP ctx, VASurfaceID id, VASurfaceStatus *status) {
    Shim *s = shim_of(ctx);
    if (!IS_OURS(id)) return s->real.vaQuerySurfaceStatus(ctx, id, status);
    *status = VASurfaceReady;
    return VA_STATUS_SUCCESS;
}

static VAStatus zam_DeriveImage(VADriverContextP ctx, VASurfaceID id, VAImage *out) {
    Shim *s = shim_of(ctx);
    if (!IS_OURS(id)) return s->real.vaDeriveImage(ctx, id, out);
    pthread_mutex_lock(&s->lock);
    Surface *sf = obj_data(s, id, OBJ_SURFACE);
    Image *img = sf ? calloc(1, sizeof(*img)) : NULL;
    Buffer *buf = img ? calloc(1, sizeof(*buf)) : NULL;
    if (!buf) {
        pthread_mutex_unlock(&s->lock);
        free(img);
        return sf ? VA_STATUS_ERROR_ALLOCATION_FAILED : VA_STATUS_ERROR_INVALID_SURFACE;
    }
    buf->type = VAImageBufferType;
    buf->size = sf->size;
    buf->num_elements = 1;
    buf->data = sf->data;
    img->surface = id;
    VAImage *im = &img->image;
    im->format = (VAImageFormat){.fourcc = VA_FOURCC_NV12, .byte_order = VA_LSB_FIRST, .bits_per_pixel = 12};
    im->width = sf->width;
    im->height = sf->height;
    im->data_size = sf->size;
    im->num_planes = 2;
    im->pitches[0] = im->pitches[1] = sf->pitch;
    im->offsets[0] = 0;
    im->offsets[1] = sf->pitch * sf->alloc_height;
    im->buf = obj_add(s, OBJ_BUFFER, buf);
    im->image_id = obj_add(s, OBJ_IMAGE, img);
    sf->derived++;
    *out = *im;
    pthread_mutex_unlock(&s->lock);
    return VA_STATUS_SUCCESS;
}

static VAStatus zam_DestroyImage(VADriverContextP ctx, VAImageID id) {
    Shim *s = shim_of(ctx);
    if (!IS_OURS(id)) return s->real.vaDestroyImage(ctx, id);
    pthread_mutex_lock(&s->lock);
    Image *img = obj_data(s, id, OBJ_IMAGE);
    if (img) {
        Buffer *buf = obj_data(s, img->image.buf, OBJ_BUFFER);
        if (buf) obj_remove(s, img->image.buf);
        free(buf);
        Surface *sf = obj_data(s, img->surface, OBJ_SURFACE);
        if (sf) sf->derived--;
        obj_remove(s, id);
        free(img);
    }
    pthread_mutex_unlock(&s->lock);
    return img ? VA_STATUS_SUCCESS : VA_STATUS_ERROR_INVALID_IMAGE;
}

static VAStatus zam_GetImage(VADriverContextP ctx, VASurfaceID surface, int x, int y, unsigned int w, unsigned int h,
                             VAImageID image) {
    Shim *s = shim_of(ctx);
    if (!IS_OURS(surface) && !IS_OURS(image)) return s->real.vaGetImage(ctx, surface, x, y, w, h, image);
    return VA_STATUS_ERROR_UNIMPLEMENTED;
}

static VAStatus zam_PutImage(VADriverContextP ctx, VASurfaceID surface, VAImageID image, int src_x, int src_y,
                             unsigned int src_w, unsigned int src_h, int dst_x, int dst_y, unsigned int dst_w,
                             unsigned int dst_h) {
    Shim *s = shim_of(ctx);
    if (!IS_OURS(surface) && !IS_OURS(image))
        return s->real.vaPutImage(ctx, surface, image, src_x, src_y, src_w, src_h, dst_x, dst_y, dst_w, dst_h);
    return VA_STATUS_ERROR_UNIMPLEMENTED;  // Chromium derives instead
}

static VAStatus zam_ExportSurfaceHandle(VADriverContextP ctx, VASurfaceID id, uint32_t mem_type, uint32_t flags,
                                        void *descriptor) {
    Shim *s = shim_of(ctx);
    if (!IS_OURS(id)) return s->real.vaExportSurfaceHandle(ctx, id, mem_type, flags, descriptor);
    return VA_STATUS_ERROR_UNSUPPORTED_MEMORY_TYPE;
}

// --- contexts and buffers -----------------------------------------------------

static VAStatus zam_CreateContext(VADriverContextP ctx, VAConfigID config, int width, int height, int flag,
                                  VASurfaceID *targets, int num_targets, VAContextID *out) {
    Shim *s = shim_of(ctx);
    if (!IS_OURS(config))
        return s->real.vaCreateContext(ctx, config, width, height, flag, targets, num_targets, out);
    pthread_mutex_lock(&s->lock);
    Config *cfg = obj_data(s, config, OBJ_CONFIG);
    Context *c = cfg ? calloc(1, sizeof(*c)) : NULL;
    CUcontext cuctx = NULL;
    if (c && s->nv.cuDevicePrimaryCtxRetain(&cuctx, s->device) != CUDA_SUCCESS) {
        LOG_ALWAYS("cuDevicePrimaryCtxRetain failed");
        free(c);
        c = NULL;
    }
    if (!c) {
        pthread_mutex_unlock(&s->lock);
        return cfg ? VA_STATUS_ERROR_OPERATION_FAILED : VA_STATUS_ERROR_INVALID_CONFIG;
    }
    s->contexts++;
    c->profile = cfg->profile;
    c->cuctx = cuctx;
    c->target = VA_INVALID_ID;
    c->bitrate = 1000000;
    c->fps_num = 30;
    c->fps_den = 1;
    *out = obj_add(s, OBJ_CONTEXT, c);
    pthread_mutex_unlock(&s->lock);
    LOG("context %#x %dx%d", *out, width, height);
    return VA_STATUS_SUCCESS;
}

static VAStatus zam_DestroyContext(VADriverContextP ctx, VAContextID id) {
    Shim *s = shim_of(ctx);
    if (!IS_OURS(id)) return s->real.vaDestroyContext(ctx, id);
    pthread_mutex_lock(&s->lock);
    Context *c = obj_data(s, id, OBJ_CONTEXT);
    if (c) {
        close_session(s, c);
        s->nv.cuDevicePrimaryCtxRelease(s->device);
        s->contexts--;
        obj_remove(s, id);
        free(c);
    }
    pthread_mutex_unlock(&s->lock);
    return c ? VA_STATUS_SUCCESS : VA_STATUS_ERROR_INVALID_CONTEXT;
}

static VAStatus zam_CreateBuffer(VADriverContextP ctx, VAContextID context, VABufferType type, unsigned int size,
                                 unsigned int num_elements, void *data, VABufferID *out) {
    Shim *s = shim_of(ctx);
    if (!IS_OURS(context)) return s->real.vaCreateBuffer(ctx, context, type, size, num_elements, data, out);
    if (!size || !num_elements || (uint64_t)size * num_elements > (1u << 30)) return VA_STATUS_ERROR_INVALID_PARAMETER;
    Buffer *buf = calloc(1, sizeof(*buf));
    if (!buf) return VA_STATUS_ERROR_ALLOCATION_FAILED;
    buf->type = type;
    buf->size = size * num_elements;
    buf->num_elements = num_elements;
    buf->data = malloc(buf->size);
    buf->owns_data = true;
    if (!buf->data) {
        free(buf);
        return VA_STATUS_ERROR_ALLOCATION_FAILED;
    }
    if (data) memcpy(buf->data, data, buf->size);
    pthread_mutex_lock(&s->lock);
    *out = obj_add(s, OBJ_BUFFER, buf);
    pthread_mutex_unlock(&s->lock);
    return VA_STATUS_SUCCESS;
}

static VAStatus zam_BufferSetNumElements(VADriverContextP ctx, VABufferID id, unsigned int num) {
    Shim *s = shim_of(ctx);
    if (!IS_OURS(id)) return s->real.vaBufferSetNumElements(ctx, id, num);
    pthread_mutex_lock(&s->lock);
    Buffer *buf = obj_data(s, id, OBJ_BUFFER);
    VAStatus st = VA_STATUS_ERROR_INVALID_BUFFER;
    if (buf) {
        const unsigned int element = buf->size / buf->num_elements;
        st = num && num <= buf->num_elements ? VA_STATUS_SUCCESS : VA_STATUS_ERROR_INVALID_PARAMETER;
        if (st == VA_STATUS_SUCCESS) {
            buf->num_elements = num;
            buf->size = element * num;
        }
    }
    pthread_mutex_unlock(&s->lock);
    return st;
}

static VAStatus map_ours(Shim *s, VABufferID id, void **out) {
    pthread_mutex_lock(&s->lock);
    Buffer *buf = obj_data(s, id, OBJ_BUFFER);
    if (buf) {
        if (buf->type == VAEncCodedBufferType) {
            buf->segment = (VACodedBufferSegment){.size = buf->used, .buf = buf->data};
            *out = &buf->segment;
        } else {
            *out = buf->data;
        }
    }
    pthread_mutex_unlock(&s->lock);
    return buf ? VA_STATUS_SUCCESS : VA_STATUS_ERROR_INVALID_BUFFER;
}

static VAStatus zam_MapBuffer(VADriverContextP ctx, VABufferID id, void **out) {
    Shim *s = shim_of(ctx);
    if (!IS_OURS(id)) return s->real.vaMapBuffer(ctx, id, out);
    return map_ours(s, id, out);
}

static VAStatus zam_MapBuffer2(VADriverContextP ctx, VABufferID id, void **out, uint32_t flags) {
    Shim *s = shim_of(ctx);
    if (!IS_OURS(id)) return s->real.vaMapBuffer2(ctx, id, out, flags);
    return map_ours(s, id, out);
}

static VAStatus zam_UnmapBuffer(VADriverContextP ctx, VABufferID id) {
    Shim *s = shim_of(ctx);
    if (!IS_OURS(id)) return s->real.vaUnmapBuffer(ctx, id);
    return VA_STATUS_SUCCESS;
}

static VAStatus zam_DestroyBuffer(VADriverContextP ctx, VABufferID id) {
    Shim *s = shim_of(ctx);
    if (!IS_OURS(id)) return s->real.vaDestroyBuffer(ctx, id);
    pthread_mutex_lock(&s->lock);
    Buffer *buf = obj_data(s, id, OBJ_BUFFER);
    // An image's buffer goes with the image.
    if (buf && buf->owns_data) {
        obj_remove(s, id);
        free(buf->data);
        free(buf);
    }
    pthread_mutex_unlock(&s->lock);
    return buf ? VA_STATUS_SUCCESS : VA_STATUS_ERROR_INVALID_BUFFER;
}

static VAStatus zam_SyncBuffer(VADriverContextP ctx, VABufferID id, uint64_t timeout) {
    Shim *s = shim_of(ctx);
    if (!IS_OURS(id)) return s->real.vaSyncBuffer(ctx, id, timeout);
    return VA_STATUS_SUCCESS;
}

// --- encoding -----------------------------------------------------------------

static VAStatus zam_BeginPicture(VADriverContextP ctx, VAContextID context, VASurfaceID target) {
    Shim *s = shim_of(ctx);
    if (!IS_OURS(context)) return s->real.vaBeginPicture(ctx, context, target);
    pthread_mutex_lock(&s->lock);
    Context *c = obj_data(s, context, OBJ_CONTEXT);
    if (c) {
        c->target = target;
        c->have_pic = false;
    }
    pthread_mutex_unlock(&s->lock);
    return c ? VA_STATUS_SUCCESS : VA_STATUS_ERROR_INVALID_CONTEXT;
}

static void take_misc(Context *c, const Buffer *buf) {
    if (buf->size < sizeof(VAEncMiscParameterBuffer)) return;
    const VAEncMiscParameterBuffer *misc = (const VAEncMiscParameterBuffer *)buf->data;
    const size_t payload = buf->size - sizeof(VAEncMiscParameterBuffer);
    switch (misc->type) {
        case VAEncMiscParameterTypeRateControl:
            if (payload >= sizeof(VAEncMiscParameterRateControl)) {
                const VAEncMiscParameterRateControl *rc = (const void *)misc->data;
                if (rc->bits_per_second) c->bitrate = rc->bits_per_second;
            }
            break;
        case VAEncMiscParameterTypeFrameRate:
            if (payload >= sizeof(VAEncMiscParameterFrameRate)) {
                const VAEncMiscParameterFrameRate *fr = (const void *)misc->data;
                // Numerator in the low 16 bits, denominator in the high 16 (0 means 1).
                const uint32_t num = fr->framerate & 0xffff, den = fr->framerate >> 16;
                if (num) {
                    c->fps_num = num;
                    c->fps_den = den ? den : 1;
                }
            }
            break;
        case VAEncMiscParameterTypeHRD:
            if (payload >= sizeof(VAEncMiscParameterHRD)) {
                const VAEncMiscParameterHRD *hrd = (const void *)misc->data;
                c->hrd_buffer_bits = hrd->buffer_size;
            }
            break;
        default:
            break;
    }
}

static VAStatus zam_RenderPicture(VADriverContextP ctx, VAContextID context, VABufferID *buffers, int num) {
    Shim *s = shim_of(ctx);
    if (!IS_OURS(context)) return s->real.vaRenderPicture(ctx, context, buffers, num);
    VAStatus st = VA_STATUS_SUCCESS;
    pthread_mutex_lock(&s->lock);
    Context *c = obj_data(s, context, OBJ_CONTEXT);
    if (!c) st = VA_STATUS_ERROR_INVALID_CONTEXT;
    for (int i = 0; c && i < num; i++) {
        const Buffer *buf = obj_data(s, buffers[i], OBJ_BUFFER);
        if (!buf) {
            st = VA_STATUS_ERROR_INVALID_BUFFER;
            break;
        }
        switch (buf->type) {
            case VAEncSequenceParameterBufferType:
                if (buf->size >= sizeof(c->seq)) {
                    memcpy(&c->seq, buf->data, sizeof(c->seq));
                    c->have_seq = true;
                    // The rate Chromium starts with, until a misc buffer says otherwise.
                    if (c->seq.bits_per_second && !c->enc) c->bitrate = c->seq.bits_per_second;
                }
                break;
            case VAEncPictureParameterBufferType:
                if (buf->size >= sizeof(c->pic)) {
                    memcpy(&c->pic, buf->data, sizeof(c->pic));
                    c->have_pic = true;
                }
                break;
            case VAEncMiscParameterBufferType:
                take_misc(c, buf);
                break;
            default:
                // Slice parameters: one slice, NVENC decides the rest.
                break;
        }
    }
    pthread_mutex_unlock(&s->lock);
    return st;
}

static VAStatus zam_EndPicture(VADriverContextP ctx, VAContextID context) {
    Shim *s = shim_of(ctx);
    if (!IS_OURS(context)) return s->real.vaEndPicture(ctx, context);
    pthread_mutex_lock(&s->lock);
    Context *c = obj_data(s, context, OBJ_CONTEXT);
    VAStatus st = VA_STATUS_ERROR_INVALID_CONTEXT;
    if (c && !c->have_pic) {
        st = VA_STATUS_ERROR_INVALID_PARAMETER;
    } else if (c) {
        s->nv.cuCtxPushCurrent(c->cuctx);
        st = encode_frame(s, c);
        CUcontext dummy;
        s->nv.cuCtxPopCurrent(&dummy);
        c->target = VA_INVALID_ID;
    }
    pthread_mutex_unlock(&s->lock);
    return st;
}

// --- lifetime -----------------------------------------------------------------

static VAStatus zam_Terminate(VADriverContextP ctx) {
    Shim *s = shim_of(ctx);
    VAStatus st = s->real.vaTerminate(ctx);
    pthread_mutex_lock(&shims_lock);
    for (Shim **p = &shims; *p; p = &(*p)->next) {
        if (*p == s) {
            *p = s->next;
            break;
        }
    }
    pthread_mutex_unlock(&shims_lock);
    while (s->objs) {
        Obj *o = s->objs;
        switch (o->type) {
            case OBJ_CONTEXT:
                close_session(s, o->data);
                s->nv.cuDevicePrimaryCtxRelease(s->device);
                break;
            case OBJ_SURFACE:
                free_surface(o->data);
                o->data = NULL;
                break;
            case OBJ_BUFFER:
                if (((Buffer *)o->data)->owns_data) free(((Buffer *)o->data)->data);
                break;
            default:
                break;
        }
        free(o->data);
        s->objs = o->next;
        free(o);
    }
    // The NVIDIA libraries stay loaded: unloading CUDA mid-process isn't safe.
    pthread_mutex_destroy(&s->lock);
    free(s);
    return st;
}

typedef VAStatus (*DriverInit)(VADriverContextP);

EXPORT VAStatus __vaDriverInit_1_0(VADriverContextP ctx);
EXPORT VAStatus __vaDriverInit_1_0(VADriverContextP ctx) {
    const char *path = getenv("ZAM_NVENC_REAL_DRIVER");
    if (!path || !*path) path = ZAM_NVENC_REAL_DRIVER_DEFAULT;
    void *lib = dlopen(path, RTLD_NOW | RTLD_LOCAL);
    if (!lib) {
        LOG_ALWAYS("can't load %s: %s", path, dlerror());
        return VA_STATUS_ERROR_UNKNOWN;
    }
    DriverInit init = NULL;
    char name[32];
    for (int minor = VA_MINOR_VERSION; minor >= 0 && !init; minor--) {
        snprintf(name, sizeof(name), "__vaDriverInit_%d_%d", VA_MAJOR_VERSION, minor);
        init = (DriverInit)dlsym(lib, name);
    }
    if (!init) {
        LOG_ALWAYS("%s has no __vaDriverInit", path);
        return VA_STATUS_ERROR_UNKNOWN;
    }
    VAStatus st = init(ctx);
    if (st != VA_STATUS_SUCCESS) return st;

    Shim *s = calloc(1, sizeof(*s));
    if (!s) return VA_STATUS_ERROR_ALLOCATION_FAILED;
    s->ctx = ctx;
    s->real = *ctx->vtable;
    s->next_id = 1;
    pthread_mutex_init(&s->lock, NULL);
    snprintf(s->vendor, sizeof(s->vendor), "%s%s", ctx->str_vendor ? ctx->str_vendor : "", VENDOR_SUFFIX);
    ctx->str_vendor = s->vendor;
    // Room for VLD + EncSlice, and our config attributes.
    if (ctx->max_entrypoints < 2) ctx->max_entrypoints = 2;
    if (ctx->max_attributes < 8) ctx->max_attributes = 8;
    if (ctx->max_profiles < 3) ctx->max_profiles = 3;

    struct VADriverVTable *vt = ctx->vtable;
    vt->vaTerminate = zam_Terminate;
    vt->vaQueryConfigProfiles = zam_QueryConfigProfiles;
    vt->vaQueryConfigEntrypoints = zam_QueryConfigEntrypoints;
    vt->vaGetConfigAttributes = zam_GetConfigAttributes;
    vt->vaCreateConfig = zam_CreateConfig;
    vt->vaDestroyConfig = zam_DestroyConfig;
    vt->vaQueryConfigAttributes = zam_QueryConfigAttributes;
    vt->vaQuerySurfaceAttributes = zam_QuerySurfaceAttributes;
    vt->vaCreateSurfaces = zam_CreateSurfaces;
    vt->vaCreateSurfaces2 = zam_CreateSurfaces2;
    vt->vaDestroySurfaces = zam_DestroySurfaces;
    vt->vaSyncSurface = zam_SyncSurface;
    if (s->real.vaSyncSurface2) vt->vaSyncSurface2 = zam_SyncSurface2;
    vt->vaQuerySurfaceStatus = zam_QuerySurfaceStatus;
    vt->vaDeriveImage = zam_DeriveImage;
    vt->vaDestroyImage = zam_DestroyImage;
    vt->vaGetImage = zam_GetImage;
    vt->vaPutImage = zam_PutImage;
    if (s->real.vaExportSurfaceHandle) vt->vaExportSurfaceHandle = zam_ExportSurfaceHandle;
    vt->vaCreateContext = zam_CreateContext;
    vt->vaDestroyContext = zam_DestroyContext;
    vt->vaCreateBuffer = zam_CreateBuffer;
    vt->vaBufferSetNumElements = zam_BufferSetNumElements;
    vt->vaMapBuffer = zam_MapBuffer;
    if (s->real.vaMapBuffer2) vt->vaMapBuffer2 = zam_MapBuffer2;
    vt->vaUnmapBuffer = zam_UnmapBuffer;
    vt->vaDestroyBuffer = zam_DestroyBuffer;
    if (s->real.vaSyncBuffer) vt->vaSyncBuffer = zam_SyncBuffer;
    vt->vaBeginPicture = zam_BeginPicture;
    vt->vaRenderPicture = zam_RenderPicture;
    vt->vaEndPicture = zam_EndPicture;

    pthread_mutex_lock(&shims_lock);
    s->next = shims;
    shims = s;
    pthread_mutex_unlock(&shims_lock);
    // Always, so a launch from a terminal shows whether the shim is in play at
    // all; the rest of its output needs ZAM_NVENC_DEBUG=1.
    LOG_ALWAYS("wrapping %s", path);
    return VA_STATUS_SUCCESS;
}
