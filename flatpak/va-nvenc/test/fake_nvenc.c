// Stand-in libnvidia-encode.so.1 for test_encode. "Encodes" a frame into NAL
// units that carry what the test checks: SPS/PPS on IDR, the slice type, the
// frame's size and a checksum of the input planes as NVENC would read them.

#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#include <ffnvcodec/nvEncodeAPI.h>

typedef struct FakeState {
    int sessions;  // open
    int initialized;
    int reconfigured;
    uint32_t width, height;
    uint32_t bitrate, max_bitrate, vbv;
    uint32_t fps_num, fps_den;
    uint32_t gop, frame_interval_p, rc_mode;
    GUID profile;
    uint32_t last_flags;
} FakeState;

static FakeState state;
FakeState *fake_nvenc_state(void) { return &state; }

typedef struct Enc {
    uint32_t width, height, pitch;
    uint8_t *input;
    uint8_t out[4096];
    uint32_t out_size;
    int input_locked;
} Enc;

static NVENCSTATUS NVENCAPI open_session(NV_ENC_OPEN_ENCODE_SESSION_EX_PARAMS *p, void **enc) {
    if (p->apiVersion != NVENCAPI_VERSION || p->deviceType != NV_ENC_DEVICE_TYPE_CUDA || !p->device)
        return NV_ENC_ERR_INVALID_PARAM;
    *enc = calloc(1, sizeof(Enc));
    state.sessions++;
    return NV_ENC_SUCCESS;
}

static NVENCSTATUS NVENCAPI get_guids(void *enc, GUID *guids, uint32_t size, uint32_t *count) {
    (void)enc;
    if (size < 2) return NV_ENC_ERR_INVALID_PARAM;
    guids[0] = NV_ENC_CODEC_HEVC_GUID;
    guids[1] = NV_ENC_CODEC_H264_GUID;
    *count = 2;
    return NV_ENC_SUCCESS;
}

static NVENCSTATUS NVENCAPI get_caps(void *enc, GUID codec, NV_ENC_CAPS_PARAM *caps, int *val) {
    (void)enc;
    (void)codec;
    *val = caps->capsToQuery == NV_ENC_CAPS_WIDTH_MAX ? 4096 : caps->capsToQuery == NV_ENC_CAPS_HEIGHT_MAX ? 2304 : 0;
    return NV_ENC_SUCCESS;
}

static NVENCSTATUS NVENCAPI get_preset(void *enc, GUID codec, GUID preset, NV_ENC_TUNING_INFO tuning,
                                       NV_ENC_PRESET_CONFIG *pc) {
    (void)enc;
    (void)codec;
    (void)preset;
    (void)tuning;
    if (pc->version != NV_ENC_PRESET_CONFIG_VER || pc->presetCfg.version != NV_ENC_CONFIG_VER)
        return NV_ENC_ERR_INVALID_VERSION;
    pc->presetCfg.gopLength = 250;
    pc->presetCfg.frameIntervalP = 3;
    return NV_ENC_SUCCESS;
}

static void take_params(const NV_ENC_INITIALIZE_PARAMS *ip) {
    const NV_ENC_CONFIG *cfg = ip->encodeConfig;
    state.width = ip->encodeWidth;
    state.height = ip->encodeHeight;
    state.fps_num = ip->frameRateNum;
    state.fps_den = ip->frameRateDen;
    state.bitrate = cfg->rcParams.averageBitRate;
    state.max_bitrate = cfg->rcParams.maxBitRate;
    state.vbv = cfg->rcParams.vbvBufferSize;
    state.rc_mode = cfg->rcParams.rateControlMode;
    state.gop = cfg->gopLength;
    state.frame_interval_p = cfg->frameIntervalP;
    state.profile = cfg->profileGUID;
}

static NVENCSTATUS NVENCAPI initialize(void *enc, NV_ENC_INITIALIZE_PARAMS *ip) {
    Enc *e = enc;
    if (ip->version != NV_ENC_INITIALIZE_PARAMS_VER || !ip->encodeConfig ||
        ip->encodeConfig->version != NV_ENC_CONFIG_VER)
        return NV_ENC_ERR_INVALID_VERSION;
    e->width = ip->encodeWidth;
    e->height = ip->encodeHeight;
    take_params(ip);
    state.initialized++;
    return NV_ENC_SUCCESS;
}

static NVENCSTATUS NVENCAPI reconfigure(void *enc, NV_ENC_RECONFIGURE_PARAMS *rp) {
    (void)enc;
    if (rp->version != NV_ENC_RECONFIGURE_PARAMS_VER) return NV_ENC_ERR_INVALID_VERSION;
    take_params(&rp->reInitEncodeParams);
    state.reconfigured++;
    return NV_ENC_SUCCESS;
}

static NVENCSTATUS NVENCAPI create_input(void *enc, NV_ENC_CREATE_INPUT_BUFFER *in) {
    Enc *e = enc;
    if (in->bufferFmt != NV_ENC_BUFFER_FORMAT_NV12 || in->width != e->width || in->height != e->height)
        return NV_ENC_ERR_INVALID_PARAM;
    e->pitch = (e->width + 255) & ~255u;
    e->input = calloc(1, (size_t)e->pitch * e->height * 3 / 2);
    in->inputBuffer = e->input;
    return NV_ENC_SUCCESS;
}

static NVENCSTATUS NVENCAPI lock_input(void *enc, NV_ENC_LOCK_INPUT_BUFFER *lock) {
    Enc *e = enc;
    if (lock->inputBuffer != e->input || e->input_locked) return NV_ENC_ERR_INVALID_PARAM;
    e->input_locked = 1;
    lock->bufferDataPtr = e->input;
    lock->pitch = e->pitch;
    return NV_ENC_SUCCESS;
}

static NVENCSTATUS NVENCAPI unlock_input(void *enc, NV_ENC_INPUT_PTR in) {
    Enc *e = enc;
    if (in != e->input || !e->input_locked) return NV_ENC_ERR_INVALID_PARAM;
    e->input_locked = 0;
    return NV_ENC_SUCCESS;
}

static NVENCSTATUS NVENCAPI create_bitstream(void *enc, NV_ENC_CREATE_BITSTREAM_BUFFER *out) {
    out->bitstreamBuffer = ((Enc *)enc)->out;
    return NV_ENC_SUCCESS;
}

static NVENCSTATUS NVENCAPI destroy_buffer(void *enc, void *buf) {
    (void)enc;
    (void)buf;
    return NV_ENC_SUCCESS;
}

static void put32(uint8_t *p, uint32_t v) {
    p[0] = v >> 24;
    p[1] = v >> 16;
    p[2] = v >> 8;
    p[3] = v;
}

static NVENCSTATUS NVENCAPI encode(void *enc, NV_ENC_PIC_PARAMS *pp) {
    Enc *e = enc;
    if (pp->version != NV_ENC_PIC_PARAMS_VER || pp->inputBuffer != e->input || e->input_locked ||
        pp->inputWidth != e->width || pp->inputHeight != e->height || pp->inputPitch != e->pitch ||
        pp->bufferFmt != NV_ENC_BUFFER_FORMAT_NV12)
        return NV_ENC_ERR_INVALID_PARAM;
    uint32_t y_sum = 0, uv_sum = 0;
    for (uint32_t y = 0; y < e->height; y++)
        for (uint32_t x = 0; x < e->width; x++) y_sum = y_sum * 31 + e->input[(size_t)y * e->pitch + x];
    const uint8_t *uv = e->input + (size_t)e->pitch * e->height;
    for (uint32_t y = 0; y < e->height / 2; y++)
        for (uint32_t x = 0; x < e->width; x++) uv_sum = uv_sum * 31 + uv[(size_t)y * e->pitch + x];
    const int idr = pp->encodePicFlags & NV_ENC_PIC_FLAG_FORCEIDR;
    state.last_flags = pp->encodePicFlags;
    uint8_t *o = e->out;
    if (pp->encodePicFlags & NV_ENC_PIC_FLAG_OUTPUT_SPSPPS) {
        memcpy(o, "\0\0\0\1\x67\x42\0\0\0\1\x68\xce", 12);
        o += 12;
    }
    memcpy(o, idr ? "\0\0\0\1\x65" : "\0\0\0\1\x41", 5);
    o += 5;
    put32(o, (uint32_t)pp->inputTimeStamp);
    put32(o + 4, e->width);
    put32(o + 8, e->height);
    put32(o + 12, y_sum);
    put32(o + 16, uv_sum);
    o += 20;
    e->out_size = o - e->out;
    return NV_ENC_SUCCESS;
}

static NVENCSTATUS NVENCAPI lock_bitstream(void *enc, NV_ENC_LOCK_BITSTREAM *lock) {
    Enc *e = enc;
    if (lock->version != NV_ENC_LOCK_BITSTREAM_VER || lock->outputBitstream != e->out) return NV_ENC_ERR_INVALID_PARAM;
    lock->bitstreamBufferPtr = e->out;
    lock->bitstreamSizeInBytes = e->out_size;
    return NV_ENC_SUCCESS;
}

static NVENCSTATUS NVENCAPI unlock_bitstream(void *enc, NV_ENC_OUTPUT_PTR out) {
    (void)enc;
    (void)out;
    return NV_ENC_SUCCESS;
}

static NVENCSTATUS NVENCAPI destroy(void *enc) {
    Enc *e = enc;
    free(e->input);
    free(e);
    state.sessions--;
    return NV_ENC_SUCCESS;
}

NVENCSTATUS NVENCAPI NvEncodeAPIGetMaxSupportedVersion(uint32_t *version) {
    *version = (NVENCAPI_MAJOR_VERSION << 4) | NVENCAPI_MINOR_VERSION;
    return NV_ENC_SUCCESS;
}

NVENCSTATUS NVENCAPI NvEncodeAPICreateInstance(NV_ENCODE_API_FUNCTION_LIST *fn) {
    if (fn->version != NV_ENCODE_API_FUNCTION_LIST_VER) return NV_ENC_ERR_INVALID_VERSION;
    fn->nvEncOpenEncodeSessionEx = open_session;
    fn->nvEncGetEncodeGUIDs = get_guids;
    fn->nvEncGetEncodeCaps = get_caps;
    fn->nvEncGetEncodePresetConfigEx = get_preset;
    fn->nvEncInitializeEncoder = initialize;
    fn->nvEncReconfigureEncoder = reconfigure;
    fn->nvEncCreateInputBuffer = create_input;
    fn->nvEncLockInputBuffer = lock_input;
    fn->nvEncUnlockInputBuffer = unlock_input;
    fn->nvEncCreateBitstreamBuffer = create_bitstream;
    fn->nvEncDestroyInputBuffer = destroy_buffer;
    fn->nvEncDestroyBitstreamBuffer = destroy_buffer;
    fn->nvEncEncodePicture = encode;
    fn->nvEncLockBitstream = lock_bitstream;
    fn->nvEncUnlockBitstream = unlock_bitstream;
    fn->nvEncDestroyEncoder = destroy;
    return NV_ENC_SUCCESS;
}
