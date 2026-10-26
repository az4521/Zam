// Stand-in nvidia_drv_video.so for test_encode: a decode-only driver that
// counts what reaches it, so the test can tell passed-through calls from the
// ones zam_va_nvenc answers.

#include <string.h>

#include <va/va.h>
#include <va/va_backend.h>

typedef struct FakeDrv {
    int surfaces;  // live
    int contexts;  // live
    int pictures;  // vaEndPicture calls
    int terminated;
} FakeDrv;

static FakeDrv drv;
static VAGenericID next_id = 1;
FakeDrv *fake_drv_state(void) { return &drv; }

static VAStatus terminate(VADriverContextP ctx) {
    (void)ctx;
    drv.terminated++;
    return VA_STATUS_SUCCESS;
}

static VAStatus query_profiles(VADriverContextP ctx, VAProfile *list, int *num) {
    (void)ctx;
    const VAProfile p[] = {VAProfileH264Main, VAProfileH264High, VAProfileH264ConstrainedBaseline, VAProfileVP9Profile0};
    memcpy(list, p, sizeof(p));
    *num = 4;
    return VA_STATUS_SUCCESS;
}

static VAStatus query_entrypoints(VADriverContextP ctx, VAProfile profile, VAEntrypoint *list, int *num) {
    (void)ctx;
    (void)profile;
    list[0] = VAEntrypointVLD;
    *num = 1;
    return VA_STATUS_SUCCESS;
}

static VAStatus get_attribs(VADriverContextP ctx, VAProfile profile, VAEntrypoint entrypoint, VAConfigAttrib *list,
                            int num) {
    (void)ctx;
    (void)profile;
    if (entrypoint != VAEntrypointVLD) return VA_STATUS_ERROR_UNSUPPORTED_ENTRYPOINT;
    for (int i = 0; i < num; i++)
        list[i].value = list[i].type == VAConfigAttribRTFormat ? VA_RT_FORMAT_YUV420 : VA_ATTRIB_NOT_SUPPORTED;
    return VA_STATUS_SUCCESS;
}

static VAStatus create_config(VADriverContextP ctx, VAProfile profile, VAEntrypoint entrypoint, VAConfigAttrib *a,
                              int n, VAConfigID *out) {
    (void)ctx;
    (void)profile;
    (void)a;
    (void)n;
    if (entrypoint != VAEntrypointVLD) return VA_STATUS_ERROR_UNSUPPORTED_ENTRYPOINT;
    *out = next_id++;
    return VA_STATUS_SUCCESS;
}

static VAStatus destroy_config(VADriverContextP ctx, VAConfigID id) {
    (void)ctx;
    (void)id;
    return VA_STATUS_SUCCESS;
}

static VAStatus create_surfaces2(VADriverContextP ctx, unsigned int format, unsigned int w, unsigned int h,
                                 VASurfaceID *out, unsigned int num, VASurfaceAttrib *a, unsigned int n) {
    (void)ctx;
    (void)format;
    (void)w;
    (void)h;
    (void)a;
    (void)n;
    for (unsigned int i = 0; i < num; i++) out[i] = next_id++;
    drv.surfaces += num;
    return VA_STATUS_SUCCESS;
}

static VAStatus destroy_surfaces(VADriverContextP ctx, VASurfaceID *list, int num) {
    (void)ctx;
    for (int i = 0; i < num; i++)
        if (list[i] & 0xff000000u) return VA_STATUS_ERROR_INVALID_SURFACE;
    drv.surfaces -= num;
    return VA_STATUS_SUCCESS;
}

static VAStatus create_context(VADriverContextP ctx, VAConfigID config, int w, int h, int flag, VASurfaceID *t, int n,
                               VAContextID *out) {
    (void)ctx;
    (void)config;
    (void)w;
    (void)h;
    (void)flag;
    (void)t;
    (void)n;
    *out = next_id++;
    drv.contexts++;
    return VA_STATUS_SUCCESS;
}

static VAStatus destroy_context(VADriverContextP ctx, VAContextID id) {
    (void)ctx;
    (void)id;
    drv.contexts--;
    return VA_STATUS_SUCCESS;
}

static VAStatus end_picture(VADriverContextP ctx, VAContextID id) {
    (void)ctx;
    (void)id;
    drv.pictures++;
    return VA_STATUS_SUCCESS;
}

static VAStatus derive_image(VADriverContextP ctx, VASurfaceID s, VAImage *img) {
    (void)ctx;
    (void)s;
    (void)img;
    return VA_STATUS_ERROR_OPERATION_FAILED;
}

VAStatus __vaDriverInit_1_0(VADriverContextP ctx);
VAStatus __vaDriverInit_1_0(VADriverContextP ctx) {
    ctx->max_profiles = 4;
    ctx->max_entrypoints = 1;
    ctx->max_attributes = 1;
    ctx->str_vendor = "fake NVDEC driver";
    struct VADriverVTable *vt = ctx->vtable;
    vt->vaTerminate = terminate;
    vt->vaQueryConfigProfiles = query_profiles;
    vt->vaQueryConfigEntrypoints = query_entrypoints;
    vt->vaGetConfigAttributes = get_attribs;
    vt->vaCreateConfig = create_config;
    vt->vaDestroyConfig = destroy_config;
    vt->vaCreateSurfaces2 = create_surfaces2;
    vt->vaDestroySurfaces = destroy_surfaces;
    vt->vaCreateContext = create_context;
    vt->vaDestroyContext = destroy_context;
    vt->vaEndPicture = end_picture;
    vt->vaDeriveImage = derive_image;
    return VA_STATUS_SUCCESS;
}
