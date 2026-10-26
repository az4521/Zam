// Drives zam_va_nvenc the way libva and Chromium's VA-API H.264 encoder do
// (media/gpu/vaapi, Chromium 152), against fake_drv / fake_cuda / fake_nvenc.
//
//   test_encode <zam_va_nvenc.so>           NVENC present: encodes frames
//   test_encode <zam_va_nvenc.so> nonvenc   no NVENC: decode passes through only
//
// ZAM_NVENC_REAL_DRIVER must point at fake_drv.so, and LD_LIBRARY_PATH at the
// fake libcuda.so.1 / libnvidia-encode.so.1 (except in nonvenc mode).

#include <dlfcn.h>
#include <fcntl.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#include <va/va.h>
#include <va/va_backend.h>
#include <va/va_drmcommon.h>
#include <va/va_enc_h264.h>

#include <ffnvcodec/nvEncodeAPI.h>

typedef struct FakeDrv {
    int surfaces, contexts, pictures, terminated;
} FakeDrv;
typedef struct FakeState {
    int sessions, initialized, reconfigured;
    uint32_t width, height, bitrate, max_bitrate, vbv, fps_num, fps_den, gop, frame_interval_p, rc_mode;
    GUID profile;
    uint32_t last_flags;
} FakeState;

static int failures;
#define CHECK(cond)                                                    \
    do {                                                               \
        if (!(cond)) {                                                 \
            fprintf(stderr, "FAIL %s:%d: %s\n", __FILE__, __LINE__, #cond); \
            failures++;                                                \
        }                                                              \
    } while (0)
#define OK(call) CHECK((call) == VA_STATUS_SUCCESS)

#define OURS(id) (((id) & 0xff000000u) == 0x5a000000u)

static void *sym(const char *lib, const char *name) {
    void *h = dlopen(lib, RTLD_NOW | RTLD_NOLOAD);
    return h ? dlsym(h, name) : NULL;
}

static VADriverContextP ctx;
static struct VADriverVTable *vt;

static VASurfaceAttrib hint(int usage) {
    VASurfaceAttrib a = {.type = VASurfaceAttribUsageHint, .flags = VA_SURFACE_ATTRIB_SETTABLE};
    a.value.type = VAGenericValueTypeInteger;
    a.value.value.i = usage;
    return a;
}

static VABufferID make_buffer(VAContextID c, VABufferType type, const void *data, unsigned int size) {
    VABufferID id = VA_INVALID_ID;
    OK(vt->vaCreateBuffer(ctx, c, type, size, 1, (void *)data, &id));
    return id;
}

static VABufferID make_misc(VAContextID c, VAEncMiscParameterType type, const void *data, size_t size) {
    uint8_t buf[sizeof(VAEncMiscParameterBuffer) + 64] = {0};
    ((VAEncMiscParameterBuffer *)buf)->type = type;
    memcpy(((VAEncMiscParameterBuffer *)buf)->data, data, size);
    return make_buffer(c, VAEncMiscParameterBufferType, buf, sizeof(VAEncMiscParameterBuffer) + size);
}

static uint8_t luma(int x, int y, int frame) { return (uint8_t)(x * 3 + y * 7 + frame * 11); }
static uint8_t chroma(int x, int y, int frame) { return (uint8_t)(x * 5 + y * 13 + frame); }

// What fake_nvenc reads back for the visible part of a frame.
static void expected_sums(int w, int h, int frame, uint32_t *y_sum, uint32_t *uv_sum) {
    *y_sum = *uv_sum = 0;
    for (int y = 0; y < h; y++)
        for (int x = 0; x < w; x++) *y_sum = *y_sum * 31 + luma(x, y, frame);
    for (int y = 0; y < h / 2; y++)
        for (int x = 0; x < w; x++) *uv_sum = *uv_sum * 31 + chroma(x, y, frame);
}

static uint32_t get32(const uint8_t *p) { return (uint32_t)p[0] << 24 | p[1] << 16 | p[2] << 8 | p[3]; }

// Fills `surface` like VaapiWrapper::UploadVideoFrameToSurface: derive, map,
// write NV12, unmap, destroy the image.
static void upload(VASurfaceID surface, int w, int h, int frame) {
    VAImage img;
    OK(vt->vaDeriveImage(ctx, surface, &img));
    CHECK(img.format.fourcc == VA_FOURCC_NV12 && img.num_planes == 2);
    uint8_t *p = NULL;
    OK(vt->vaMapBuffer(ctx, img.buf, (void **)&p));
    for (int y = 0; y < h; y++)
        for (int x = 0; x < w; x++) p[img.offsets[0] + y * img.pitches[0] + x] = luma(x, y, frame);
    for (int y = 0; y < h / 2; y++)
        for (int x = 0; x < w; x++) p[img.offsets[1] + y * img.pitches[1] + x] = chroma(x, y, frame);
    OK(vt->vaUnmapBuffer(ctx, img.buf));
    OK(vt->vaDestroyImage(ctx, img.image_id));
}

// One frame through H264VaapiVideoEncoderDelegate's buffers; returns the
// coded bytes' length and copies them to `out`.
static uint32_t encode(VAContextID c, VASurfaceID input, VASurfaceID recon, int coded_w, int coded_h, int w, int h,
                       int frame, bool idr, uint32_t bitrate, uint8_t *out) {
    upload(input, w, h, frame);
    VABufferID coded = make_buffer(c, VAEncCodedBufferType, NULL, 1 << 20);

    VAEncSequenceParameterBufferH264 seq = {0};
    seq.picture_width_in_mbs = coded_w / 16;
    seq.picture_height_in_mbs = coded_h / 16;
    seq.bits_per_second = 2000000;
    seq.seq_fields.bits.frame_mbs_only_flag = 1;
    seq.frame_cropping_flag = coded_w != w || coded_h != h;
    seq.frame_crop_right_offset = (coded_w - w) / 2;
    seq.frame_crop_bottom_offset = (coded_h - h) / 2;
    VAEncPictureParameterBufferH264 pic = {0};
    pic.CurrPic.picture_id = recon;
    pic.coded_buf = coded;
    pic.pic_fields.bits.idr_pic_flag = idr;
    pic.pic_fields.bits.reference_pic_flag = 1;
    VAEncSliceParameterBufferH264 slice = {0};
    VAEncMiscParameterRateControl rc = {.bits_per_second = bitrate, .target_percentage = 100};
    VAEncMiscParameterFrameRate fr = {.framerate = 30};
    VAEncMiscParameterHRD hrd = {.buffer_size = bitrate / 2, .initial_buffer_fullness = bitrate / 4};

    VABufferID bufs[] = {
        make_buffer(c, VAEncSequenceParameterBufferType, &seq, sizeof(seq)),
        make_buffer(c, VAEncPictureParameterBufferType, &pic, sizeof(pic)),
        make_buffer(c, VAEncSliceParameterBufferType, &slice, sizeof(slice)),
        make_misc(c, VAEncMiscParameterTypeRateControl, &rc, sizeof(rc)),
        make_misc(c, VAEncMiscParameterTypeFrameRate, &fr, sizeof(fr)),
        make_misc(c, VAEncMiscParameterTypeHRD, &hrd, sizeof(hrd)),
    };
    const int n = sizeof(bufs) / sizeof(bufs[0]);
    OK(vt->vaBeginPicture(ctx, c, input));
    OK(vt->vaRenderPicture(ctx, c, bufs, n));
    OK(vt->vaEndPicture(ctx, c));
    for (int i = 0; i < n; i++) OK(vt->vaDestroyBuffer(ctx, bufs[i]));

    // VaapiWrapper::GetEncodedChunkSize / DownloadFromVABuffer.
    OK(vt->vaSyncSurface(ctx, input));
    VACodedBufferSegment *seg = NULL;
    OK(vt->vaMapBuffer(ctx, coded, (void **)&seg));
    uint32_t size = 0;
    for (; seg; seg = seg->next) {
        memcpy(out + size, seg->buf, seg->size);
        size += seg->size;
    }
    OK(vt->vaUnmapBuffer(ctx, coded));
    OK(vt->vaDestroyBuffer(ctx, coded));
    return size;
}

static void check_frame(const uint8_t *data, uint32_t size, int w, int h, int frame, int index, bool idr) {
    const uint8_t *p = data;
    if (idr) {
        CHECK(size > 12 && !memcmp(p, "\0\0\0\1\x67", 5) && !memcmp(p + 6, "\0\0\0\1\x68", 5));
        p += 12;
    }
    CHECK(p[4] == (idr ? 0x65 : 0x41));
    CHECK(get32(p + 5) == (uint32_t)index);
    CHECK(get32(p + 9) == (uint32_t)w);
    CHECK(get32(p + 13) == (uint32_t)h);
    uint32_t y_sum, uv_sum;
    expected_sums(w, h, frame, &y_sum, &uv_sum);
    CHECK(get32(p + 17) == y_sum);
    CHECK(get32(p + 21) == uv_sum);
    CHECK((uint32_t)(p + 25 - data) == size);
}

int main(int argc, char **argv) {
    if (argc < 2) return 2;
    const bool nonvenc = argc > 2 && !strcmp(argv[2], "nonvenc");
    void *lib = dlopen(argv[1], RTLD_NOW | RTLD_LOCAL);
    if (!lib) {
        fprintf(stderr, "%s\n", dlerror());
        return 2;
    }
    VAStatus (*init)(VADriverContextP) = (VAStatus(*)(VADriverContextP))dlsym(lib, "__vaDriverInit_1_0");
    CHECK(init != NULL);

    // What libva sets up before calling a driver's init.
    ctx = calloc(1, sizeof(*ctx));
    ctx->vtable = vt = calloc(1, sizeof(*vt));
    struct drm_state drm = {.fd = open("/dev/null", O_RDWR)};
    ctx->drm_state = &drm;
    ctx->version_major = VA_MAJOR_VERSION;
    ctx->version_minor = VA_MINOR_VERSION;
    OK(init(ctx));
    CHECK(strstr(ctx->str_vendor, "fake NVDEC driver") == ctx->str_vendor);
    CHECK(strstr(ctx->str_vendor, "zam NVENC") != NULL);
    CHECK(ctx->max_entrypoints >= 2);
    FakeDrv *drv = ((FakeDrv * (*)(void)) sym(getenv("ZAM_NVENC_REAL_DRIVER"), "fake_drv_state"))();

    VAProfile profiles[16];
    int nprof = 0;
    OK(vt->vaQueryConfigProfiles(ctx, profiles, &nprof));
    CHECK(nprof == 4);

    VAEntrypoint eps[8];
    int nep = 0;
    OK(vt->vaQueryConfigEntrypoints(ctx, VAProfileH264ConstrainedBaseline, eps, &nep));
    CHECK(nep <= ctx->max_entrypoints);
    CHECK(nep >= 1 && eps[0] == VAEntrypointVLD);
    OK(vt->vaQueryConfigEntrypoints(ctx, VAProfileVP9Profile0, eps, &nep));
    CHECK(nep == 1 && eps[0] == VAEntrypointVLD);

    if (nonvenc) {
        OK(vt->vaQueryConfigEntrypoints(ctx, VAProfileH264High, eps, &nep));
        CHECK(nep == 1);
        VAConfigID cfg;
        CHECK(vt->vaCreateConfig(ctx, VAProfileH264High, VAEntrypointEncSlice, NULL, 0, &cfg) ==
              VA_STATUS_ERROR_UNSUPPORTED_ENTRYPOINT);
        VASurfaceAttrib enc_hint = hint(VA_SURFACE_ATTRIB_USAGE_HINT_ENCODER);
        VASurfaceID sf;
        OK(vt->vaCreateSurfaces2(ctx, VA_RT_FORMAT_YUV420, 64, 64, &sf, 1, &enc_hint, 1));
        CHECK(!OURS(sf));
        OK(vt->vaDestroySurfaces(ctx, &sf, 1));
        OK(vt->vaTerminate(ctx));
        CHECK(drv->terminated == 1);
        printf(failures ? "nonvenc: %d failure(s)\n" : "nonvenc: ok\n", failures);
        return failures != 0;
    }

    const char *cuda = "libcuda.so.1", *nvenc = "libnvidia-encode.so.1";
    int (*cuda_refs)(void) = (int (*)(void))sym(cuda, "fake_cuda_refs");
    int (*cuda_pushed)(void) = (int (*)(void))sym(cuda, "fake_cuda_pushed");
    FakeState *nv = ((FakeState * (*)(void)) sym(nvenc, "fake_nvenc_state"))();
    CHECK(cuda_refs && cuda_pushed && nv);
    OK(vt->vaQueryConfigEntrypoints(ctx, VAProfileH264ConstrainedBaseline, eps, &nep));
    CHECK(nep == 2 && eps[1] == VAEntrypointEncSlice);
    CHECK(cuda_refs() == 0 && nv->sessions == 0);  // the probe cleaned up

    // GetRequiredAttribs / AreAttribsSupported.
    VAConfigAttrib attrs[] = {{VAConfigAttribRTFormat, 0},
                              {VAConfigAttribRateControl, 0},
                              {VAConfigAttribEncPackedHeaders, 0},
                              {VAConfigAttribEncMaxRefFrames, 0},
                              {VAConfigAttribEncQualityRange, 0}};
    OK(vt->vaGetConfigAttributes(ctx, VAProfileH264ConstrainedBaseline, VAEntrypointEncSlice, attrs, 5));
    CHECK(attrs[0].value == VA_RT_FORMAT_YUV420);
    CHECK(attrs[1].value == VA_RC_CBR);
    CHECK(attrs[2].value == VA_ENC_PACKED_HEADER_NONE);
    CHECK(attrs[3].value == 1);
    CHECK(attrs[4].value == VA_ATTRIB_NOT_SUPPORTED);

    VAConfigAttrib required[] = {{VAConfigAttribRTFormat, VA_RT_FORMAT_YUV420},
                                 {VAConfigAttribRateControl, VA_RC_CBR},
                                 {VAConfigAttribEncPackedHeaders, VA_ENC_PACKED_HEADER_NONE}};
    VAConfigID cfg = VA_INVALID_ID;
    OK(vt->vaCreateConfig(ctx, VAProfileH264ConstrainedBaseline, VAEntrypointEncSlice, required, 3, &cfg));
    CHECK(OURS(cfg));
    VAConfigAttrib cqp[] = {{VAConfigAttribRateControl, VA_RC_CQP}};
    VAConfigID bad;
    CHECK(vt->vaCreateConfig(ctx, VAProfileH264Main, VAEntrypointEncSlice, cqp, 1, &bad) != VA_STATUS_SUCCESS);
    VAConfigAttrib packed[] = {{VAConfigAttribEncPackedHeaders, VA_ENC_PACKED_HEADER_SEQUENCE}};
    CHECK(vt->vaCreateConfig(ctx, VAProfileH264Main, VAEntrypointEncSlice, packed, 1, &bad) != VA_STATUS_SUCCESS);
    VAConfigID decode_cfg;
    OK(vt->vaCreateConfig(ctx, VAProfileH264Main, VAEntrypointVLD, NULL, 0, &decode_cfg));
    CHECK(!OURS(decode_cfg));

    // FillProfileInfo_Locked.
    unsigned int nsa = 0;
    OK(vt->vaQuerySurfaceAttributes(ctx, cfg, NULL, &nsa));
    VASurfaceAttrib sa[16];
    CHECK(nsa > 0 && nsa <= 16);
    OK(vt->vaQuerySurfaceAttributes(ctx, cfg, sa, &nsa));
    int max_w = 0, max_h = 0, nv12 = 0;
    for (unsigned int i = 0; i < nsa; i++) {
        if (sa[i].type == VASurfaceAttribMaxWidth) max_w = sa[i].value.value.i;
        if (sa[i].type == VASurfaceAttribMaxHeight) max_h = sa[i].value.value.i;
        if (sa[i].type == VASurfaceAttribPixelFormat) nv12 = sa[i].value.value.i == (int)VA_FOURCC_NV12;
    }
    CHECK(max_w == 4096 && max_h == 2304 && nv12);
    VAConfigAttrib qattrs[16];
    int nqa = 0;
    VAProfile qp;
    VAEntrypoint qe;
    OK(vt->vaQueryConfigAttributes(ctx, cfg, &qp, &qe, qattrs, &nqa));
    CHECK(qp == VAProfileH264ConstrainedBaseline && qe == VAEntrypointEncSlice);
    CHECK(nqa > 0 && nqa <= ctx->max_attributes);

    // A decode surface passes through; the encoder's own don't.
    VASurfaceAttrib dec_hint = hint(VA_SURFACE_ATTRIB_USAGE_HINT_DECODER);
    VASurfaceID dec_surface;
    OK(vt->vaCreateSurfaces2(ctx, VA_RT_FORMAT_YUV420, 1280, 720, &dec_surface, 1, &dec_hint, 1));
    CHECK(!OURS(dec_surface) && drv->surfaces == 1);
    VASurfaceAttrib vpp_hint = hint(VA_SURFACE_ATTRIB_USAGE_HINT_VPP_WRITE | VA_SURFACE_ATTRIB_USAGE_HINT_ENCODER);
    VASurfaceID vpp_surface;
    OK(vt->vaCreateSurfaces2(ctx, VA_RT_FORMAT_YUV420, 1280, 720, &vpp_surface, 1, &vpp_hint, 1));
    CHECK(!OURS(vpp_surface) && drv->surfaces == 2);

    VASurfaceAttrib enc_hint = hint(VA_SURFACE_ATTRIB_USAGE_HINT_ENCODER);
    VASurfaceID surfaces[2];  // input, reconstructed
    OK(vt->vaCreateSurfaces2(ctx, VA_RT_FORMAT_YUV420, 1280, 720, surfaces, 2, &enc_hint, 1));
    CHECK(OURS(surfaces[0]) && OURS(surfaces[1]) && drv->surfaces == 2);

    VAContextID c;
    OK(vt->vaCreateContext(ctx, cfg, 1280, 720, VA_PROGRESSIVE, &surfaces[1], 1, &c));
    CHECK(OURS(c) && drv->contexts == 0 && cuda_refs() == 1);

    // 1276x716 visible in 1280x720 macroblocks; IDR on 0 and 3; the rate drops
    // from frame 2.
    static uint8_t out[1 << 20];
    for (int i = 0; i < 5; i++) {
        const bool idr = i == 0 || i == 3;
        const uint32_t bitrate = i < 2 ? 2000000 : 1500000;
        uint32_t size = encode(c, surfaces[0], surfaces[1], 1280, 720, 1276, 716, i, idr, bitrate, out);
        check_frame(out, size, 1276, 716, i, i, idr);
        CHECK(nv->bitrate == bitrate && nv->max_bitrate == bitrate && nv->vbv == bitrate / 2);
    }
    CHECK(nv->sessions == 1 && nv->initialized == 1 && nv->reconfigured == 1);
    CHECK(nv->width == 1276 && nv->height == 716);
    CHECK(nv->fps_num == 30 && nv->fps_den == 1);
    CHECK(nv->rc_mode == NV_ENC_PARAMS_RC_CBR);
    CHECK(nv->gop == NVENC_INFINITE_GOPLENGTH && nv->frame_interval_p == 1);
    CHECK(!memcmp(&nv->profile, &NV_ENC_H264_PROFILE_BASELINE_GUID, sizeof(GUID)));

    // A new size reopens the encoder, starting with an IDR.
    VASurfaceID small[2];
    OK(vt->vaCreateSurfaces2(ctx, VA_RT_FORMAT_YUV420, 640, 368, small, 2, &enc_hint, 1));
    uint32_t size = encode(c, small[0], small[1], 640, 368, 640, 360, 9, false, 1500000, out);
    check_frame(out, size, 640, 360, 9, 0, true);
    CHECK(nv->sessions == 1 && nv->initialized == 2);

    // A coded buffer too small for the frame is an error, not an overrun.
    upload(small[0], 640, 360, 1);
    VABufferID tiny = make_buffer(c, VAEncCodedBufferType, NULL, 8);
    VAEncPictureParameterBufferH264 pic = {.coded_buf = tiny};
    VABufferID pic_buf = make_buffer(c, VAEncPictureParameterBufferType, &pic, sizeof(pic));
    OK(vt->vaBeginPicture(ctx, c, small[0]));
    OK(vt->vaRenderPicture(ctx, c, &pic_buf, 1));
    CHECK(vt->vaEndPicture(ctx, c) == VA_STATUS_ERROR_NOT_ENOUGH_BUFFER);
    OK(vt->vaDestroyBuffer(ctx, pic_buf));
    OK(vt->vaDestroyBuffer(ctx, tiny));

    CHECK(drv->pictures == 0);
    CHECK(cuda_pushed() == 0);

    OK(vt->vaDestroyContext(ctx, c));
    CHECK(cuda_refs() == 0 && nv->sessions == 0);
    VASurfaceID all[] = {surfaces[0], dec_surface, surfaces[1], small[0], small[1], vpp_surface};
    OK(vt->vaDestroySurfaces(ctx, all, 6));
    CHECK(drv->surfaces == 0);
    OK(vt->vaDestroyConfig(ctx, cfg));
    OK(vt->vaDestroyConfig(ctx, decode_cfg));
    CHECK(vt->vaDestroyConfig(ctx, cfg) == VA_STATUS_ERROR_INVALID_CONFIG);
    OK(vt->vaTerminate(ctx));
    CHECK(drv->terminated == 1);

    printf(failures ? "nvenc: %d failure(s)\n" : "nvenc: ok\n", failures);
    return failures != 0;
}
