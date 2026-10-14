// Vulkan layer for Chromium importing hardware-decoded video frames into Vulkan
// on NVIDIA under X11.
//
// Chromium's Vulkan path imports each VA-API frame (a dma-buf with a DRM
// modifier) as a VkImage, and every failure on the way is a DLOG, compiled out
// of release builds; all the user sees is "CreateSharedImage: could not create
// backing" and a GPU process restart.
//
// Loaded only when ZAM_VK_LAYER=1 (see the layer manifest; zam.sh sets it on
// NVIDIA under X11). ZAM_VK_FIXUP=1 clears image usage bits the driver reports
// as unsupported for the image's DRM modifier: Chromium asks for
// COLOR_ATTACHMENT on every imported image, which NVIDIA's linear NV12 can't
// be, and only samples video. ZAM_VK_DEBUG=1 logs the import calls and their
// results to stderr with a "[zam-vk]" prefix.

#include <errno.h>
#include <pthread.h>
#include <stdarg.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#include <vulkan/vk_layer.h>
#include <vulkan/vulkan.h>

#define EXPORT __attribute__((visibility("default")))

static bool debug_enabled(void) {
    const char *v = getenv("ZAM_VK_DEBUG");
    return v && *v && strcmp(v, "0") != 0;
}

static void logf_(const char *fmt, ...) __attribute__((format(printf, 1, 2)));
static void logf_(const char *fmt, ...) {
    if (!debug_enabled()) return;
    char line[1024];
    va_list ap;
    va_start(ap, fmt);
    vsnprintf(line, sizeof(line), fmt, ap);
    va_end(ap);
    fprintf(stderr, "[zam-vk] %s\n", line);
}

static bool fixup_enabled(void) {
    const char *v = getenv("ZAM_VK_FIXUP");
    return v && *v && strcmp(v, "0") != 0;
}

// --- dispatch bookkeeping ---------------------------------------------------
// Keyed by the loader's dispatch table pointer, the first word of every
// dispatchable handle, so children (physical devices, queues) map to their
// parent's entry.

typedef void *DispatchKey;
static DispatchKey key_of(const void *handle) { return *(DispatchKey *)handle; }

typedef struct InstanceData {
    DispatchKey key;
    VkInstance instance;
    PFN_vkGetInstanceProcAddr gipa;
    PFN_vkDestroyInstance DestroyInstance;
    PFN_vkGetPhysicalDeviceFormatProperties2 GetPhysicalDeviceFormatProperties2;
    PFN_vkGetPhysicalDeviceImageFormatProperties2 GetPhysicalDeviceImageFormatProperties2;
    struct InstanceData *next;
} InstanceData;

typedef struct DeviceData {
    DispatchKey key;
    VkDevice device;
    VkPhysicalDevice physical;
    InstanceData *instance;
    PFN_vkGetDeviceProcAddr gdpa;
    PFN_vkDestroyDevice DestroyDevice;
    PFN_vkCreateImage CreateImage;
    PFN_vkAllocateMemory AllocateMemory;
    PFN_vkBindImageMemory BindImageMemory;
    PFN_vkBindImageMemory2 BindImageMemory2;
    PFN_vkGetImageMemoryRequirements GetImageMemoryRequirements;
    struct DeviceData *next;
} DeviceData;

static pthread_mutex_t lock = PTHREAD_MUTEX_INITIALIZER;
static InstanceData *instances;
static DeviceData *devices;

static InstanceData *find_instance(const void *handle) {
    DispatchKey key = key_of(handle);
    pthread_mutex_lock(&lock);
    InstanceData *it = instances;
    while (it && it->key != key) it = it->next;
    pthread_mutex_unlock(&lock);
    return it;
}

static DeviceData *find_device(const void *handle) {
    DispatchKey key = key_of(handle);
    pthread_mutex_lock(&lock);
    DeviceData *it = devices;
    while (it && it->key != key) it = it->next;
    pthread_mutex_unlock(&lock);
    return it;
}

static const void *find_struct(const void *chain, VkStructureType type) {
    for (const VkBaseInStructure *s = chain; s; s = s->pNext)
        if (s->sType == type) return s;
    return NULL;
}

// --- format helpers -----------------------------------------------------------

// Image usage bits and the modifier tiling feature each one needs.
static const struct {
    VkImageUsageFlags usage;
    VkFormatFeatureFlags feature;
    const char *name;
} kUsageFeatures[] = {
    {VK_IMAGE_USAGE_TRANSFER_SRC_BIT, VK_FORMAT_FEATURE_TRANSFER_SRC_BIT, "TRANSFER_SRC"},
    {VK_IMAGE_USAGE_TRANSFER_DST_BIT, VK_FORMAT_FEATURE_TRANSFER_DST_BIT, "TRANSFER_DST"},
    {VK_IMAGE_USAGE_SAMPLED_BIT, VK_FORMAT_FEATURE_SAMPLED_IMAGE_BIT, "SAMPLED"},
    {VK_IMAGE_USAGE_STORAGE_BIT, VK_FORMAT_FEATURE_STORAGE_IMAGE_BIT, "STORAGE"},
    {VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT, VK_FORMAT_FEATURE_COLOR_ATTACHMENT_BIT, "COLOR_ATTACHMENT"},
};

static void usage_str(VkImageUsageFlags usage, char *out, size_t n) {
    out[0] = 0;
    for (size_t i = 0; i < sizeof(kUsageFeatures) / sizeof(kUsageFeatures[0]); i++) {
        if (usage & kUsageFeatures[i].usage) {
            if (out[0]) strncat(out, "|", n - strlen(out) - 1);
            strncat(out, kUsageFeatures[i].name, n - strlen(out) - 1);
        }
    }
    VkImageUsageFlags known = 0;
    for (size_t i = 0; i < sizeof(kUsageFeatures) / sizeof(kUsageFeatures[0]); i++)
        known |= kUsageFeatures[i].usage;
    if (usage & ~known) {
        char extra[32];
        snprintf(extra, sizeof(extra), "%s0x%x", out[0] ? "|" : "", usage & ~known);
        strncat(out, extra, n - strlen(out) - 1);
    }
}

// The tiling features the driver reports for `modifier` on `format`; logs the
// whole modifier list once per format so the report shows what it accepts.
static bool modifier_features(DeviceData *dev, VkFormat format, uint64_t modifier,
                              VkFormatFeatureFlags *features, uint32_t *plane_count) {
    PFN_vkGetPhysicalDeviceFormatProperties2 get =
        dev->instance->GetPhysicalDeviceFormatProperties2;
    if (!get) return false;
    VkDrmFormatModifierPropertiesListEXT list = {
        .sType = VK_STRUCTURE_TYPE_DRM_FORMAT_MODIFIER_PROPERTIES_LIST_EXT};
    VkFormatProperties2 props = {.sType = VK_STRUCTURE_TYPE_FORMAT_PROPERTIES_2, .pNext = &list};
    get(dev->physical, format, &props);
    if (list.drmFormatModifierCount == 0) {
        logf_("format %d: driver lists no DRM modifiers", format);
        return false;
    }
    VkDrmFormatModifierPropertiesEXT *mods =
        calloc(list.drmFormatModifierCount, sizeof(*mods));
    if (!mods) return false;
    list.pDrmFormatModifierProperties = mods;
    get(dev->physical, format, &props);

    static pthread_mutex_t logged_lock = PTHREAD_MUTEX_INITIALIZER;
    static VkFormat logged[16];
    static int logged_count;
    bool first = true;
    pthread_mutex_lock(&logged_lock);
    for (int i = 0; i < logged_count; i++)
        if (logged[i] == format) first = false;
    if (first && logged_count < 16) logged[logged_count++] = format;
    pthread_mutex_unlock(&logged_lock);

    bool found = false;
    for (uint32_t i = 0; i < list.drmFormatModifierCount; i++) {
        if (first)
            logf_("format %d: modifier 0x%016llx planes=%u features=0x%x", format,
                  (unsigned long long)mods[i].drmFormatModifier,
                  mods[i].drmFormatModifierPlaneCount,
                  mods[i].drmFormatModifierTilingFeatures);
        if (mods[i].drmFormatModifier == modifier) {
            *features = mods[i].drmFormatModifierTilingFeatures;
            *plane_count = mods[i].drmFormatModifierPlaneCount;
            found = true;
        }
    }
    free(mods);
    return found;
}

// Asks the driver whether it would create this image (with dma-buf import),
// the check Chromium skips before vkCreateImage.
static void log_image_format_support(DeviceData *dev, const VkImageCreateInfo *ci,
                                     uint64_t modifier) {
    PFN_vkGetPhysicalDeviceImageFormatProperties2 get =
        dev->instance->GetPhysicalDeviceImageFormatProperties2;
    if (!get || !debug_enabled()) return;
    VkPhysicalDeviceImageDrmFormatModifierInfoEXT mod_info = {
        .sType = VK_STRUCTURE_TYPE_PHYSICAL_DEVICE_IMAGE_DRM_FORMAT_MODIFIER_INFO_EXT,
        .drmFormatModifier = modifier,
        .sharingMode = VK_SHARING_MODE_EXCLUSIVE,
    };
    VkPhysicalDeviceExternalImageFormatInfo ext_info = {
        .sType = VK_STRUCTURE_TYPE_PHYSICAL_DEVICE_EXTERNAL_IMAGE_FORMAT_INFO,
        .pNext = &mod_info,
        .handleType = VK_EXTERNAL_MEMORY_HANDLE_TYPE_DMA_BUF_BIT_EXT,
    };
    VkPhysicalDeviceImageFormatInfo2 info = {
        .sType = VK_STRUCTURE_TYPE_PHYSICAL_DEVICE_IMAGE_FORMAT_INFO_2,
        .pNext = &ext_info,
        .format = ci->format,
        .type = ci->imageType,
        .tiling = ci->tiling,
        .usage = ci->usage,
        .flags = ci->flags,
    };
    VkExternalImageFormatProperties ext_props = {
        .sType = VK_STRUCTURE_TYPE_EXTERNAL_IMAGE_FORMAT_PROPERTIES};
    VkImageFormatProperties2 props = {
        .sType = VK_STRUCTURE_TYPE_IMAGE_FORMAT_PROPERTIES_2, .pNext = &ext_props};
    VkResult r = get(dev->physical, &info, &props);
    logf_("  driver support for these params: %d (max %ux%u, import features 0x%x)", r,
          props.imageFormatProperties.maxExtent.width,
          props.imageFormatProperties.maxExtent.height,
          ext_props.externalMemoryProperties.externalMemoryFeatures);
}

// --- device-level hooks -------------------------------------------------------

static VKAPI_ATTR VkResult VKAPI_CALL zam_CreateImage(VkDevice device,
                                                      const VkImageCreateInfo *ci,
                                                      const VkAllocationCallbacks *alloc,
                                                      VkImage *image) {
    DeviceData *dev = find_device(device);
    const VkImageDrmFormatModifierExplicitCreateInfoEXT *explicit_mod =
        ci->tiling == VK_IMAGE_TILING_DRM_FORMAT_MODIFIER_EXT
            ? find_struct(ci->pNext,
                          VK_STRUCTURE_TYPE_IMAGE_DRM_FORMAT_MODIFIER_EXPLICIT_CREATE_INFO_EXT)
            : NULL;
    if (!explicit_mod) return dev->CreateImage(device, ci, alloc, image);

    // An imported dma-buf: the case Chromium's video path hits.
    char usage[128];
    usage_str(ci->usage, usage, sizeof(usage));
    logf_("vkCreateImage import: format=%d %ux%u usage=%s flags=0x%x modifier=0x%016llx "
          "planes=%u",
          ci->format, ci->extent.width, ci->extent.height, usage, ci->flags,
          (unsigned long long)explicit_mod->drmFormatModifier,
          explicit_mod->drmFormatModifierPlaneCount);
    for (uint32_t i = 0; i < explicit_mod->drmFormatModifierPlaneCount; i++)
        logf_("  plane %u: offset=%llu rowPitch=%llu", i,
              (unsigned long long)explicit_mod->pPlaneLayouts[i].offset,
              (unsigned long long)explicit_mod->pPlaneLayouts[i].rowPitch);

    VkFormatFeatureFlags features = 0;
    uint32_t plane_count = 0;
    bool known = modifier_features(dev, ci->format, explicit_mod->drmFormatModifier,
                                   &features, &plane_count);
    if (!known) {
        logf_("  driver does not list this modifier for this format");
    } else {
        logf_("  modifier features=0x%x planes=%u", features, plane_count);
        if (plane_count != explicit_mod->drmFormatModifierPlaneCount)
            logf_("  plane count mismatch: driver wants %u, got %u", plane_count,
                  explicit_mod->drmFormatModifierPlaneCount);
    }
    log_image_format_support(dev, ci, explicit_mod->drmFormatModifier);

    VkImageCreateInfo fixed = *ci;
    if (fixup_enabled() && known) {
        VkImageUsageFlags dropped = 0;
        for (size_t i = 0; i < sizeof(kUsageFeatures) / sizeof(kUsageFeatures[0]); i++) {
            if ((fixed.usage & kUsageFeatures[i].usage) &&
                !(features & kUsageFeatures[i].feature)) {
                dropped |= kUsageFeatures[i].usage;
            }
        }
        // Sampling is the point of importing a video frame; never drop it.
        dropped &= ~VK_IMAGE_USAGE_SAMPLED_BIT;
        if (dropped) {
            fixed.usage &= ~dropped;
            usage_str(dropped, usage, sizeof(usage));
            logf_("  fixup: dropped unsupported usage %s", usage);
            log_image_format_support(dev, &fixed, explicit_mod->drmFormatModifier);
        }
    }

    VkResult r = dev->CreateImage(device, &fixed, alloc, image);
    logf_("  -> vkCreateImage %d", r);
    return r;
}

static VKAPI_ATTR void VKAPI_CALL zam_GetImageMemoryRequirements(VkDevice device, VkImage image,
                                                                 VkMemoryRequirements *req) {
    DeviceData *dev = find_device(device);
    dev->GetImageMemoryRequirements(device, image, req);
    logf_("vkGetImageMemoryRequirements: size=%llu align=%llu types=0x%x",
          (unsigned long long)req->size, (unsigned long long)req->alignment,
          req->memoryTypeBits);
}

static VKAPI_ATTR VkResult VKAPI_CALL zam_AllocateMemory(VkDevice device,
                                                         const VkMemoryAllocateInfo *info,
                                                         const VkAllocationCallbacks *alloc,
                                                         VkDeviceMemory *memory) {
    DeviceData *dev = find_device(device);
    const VkImportMemoryFdInfoKHR *import =
        find_struct(info->pNext, VK_STRUCTURE_TYPE_IMPORT_MEMORY_FD_INFO_KHR);
    if (!import || import->handleType != VK_EXTERNAL_MEMORY_HANDLE_TYPE_DMA_BUF_BIT_EXT)
        return dev->AllocateMemory(device, info, alloc, memory);

    // The dma-buf's real size: an import asking for more than this fails.
    off_t fd_size = lseek(import->fd, 0, SEEK_END);
    lseek(import->fd, 0, SEEK_SET);
    const VkMemoryDedicatedAllocateInfo *dedicated =
        find_struct(info->pNext, VK_STRUCTURE_TYPE_MEMORY_DEDICATED_ALLOCATE_INFO);
    logf_("vkAllocateMemory dma-buf import: size=%llu dmabuf=%lld type=%u dedicated=%s",
          (unsigned long long)info->allocationSize, (long long)fd_size,
          info->memoryTypeIndex, dedicated && dedicated->image ? "image" : "no");
    VkResult r = dev->AllocateMemory(device, info, alloc, memory);
    logf_("  -> vkAllocateMemory %d", r);
    return r;
}

static VKAPI_ATTR VkResult VKAPI_CALL zam_BindImageMemory(VkDevice device, VkImage image,
                                                          VkDeviceMemory memory,
                                                          VkDeviceSize offset) {
    DeviceData *dev = find_device(device);
    VkResult r = dev->BindImageMemory(device, image, memory, offset);
    if (r != VK_SUCCESS) logf_("vkBindImageMemory failed: %d", r);
    return r;
}

static VKAPI_ATTR VkResult VKAPI_CALL zam_BindImageMemory2(VkDevice device, uint32_t count,
                                                           const VkBindImageMemoryInfo *infos) {
    DeviceData *dev = find_device(device);
    VkResult r = dev->BindImageMemory2(device, count, infos);
    if (r != VK_SUCCESS) logf_("vkBindImageMemory2 failed: %d", r);
    return r;
}

static VKAPI_ATTR void VKAPI_CALL zam_DestroyDevice(VkDevice device,
                                                    const VkAllocationCallbacks *alloc) {
    DispatchKey key = key_of(device);
    pthread_mutex_lock(&lock);
    DeviceData **link = &devices;
    while (*link && (*link)->key != key) link = &(*link)->next;
    DeviceData *dev = *link;
    if (dev) *link = dev->next;
    pthread_mutex_unlock(&lock);
    if (!dev) return;
    dev->DestroyDevice(device, alloc);
    free(dev);
}

static PFN_vkVoidFunction device_hook(const char *name);

static VKAPI_ATTR PFN_vkVoidFunction VKAPI_CALL zam_GetDeviceProcAddr(VkDevice device,
                                                                     const char *name) {
    PFN_vkVoidFunction hook = device_hook(name);
    if (hook) return hook;
    DeviceData *dev = find_device(device);
    return dev ? dev->gdpa(device, name) : NULL;
}

// --- instance-level hooks -----------------------------------------------------

static VKAPI_ATTR VkResult VKAPI_CALL zam_CreateInstance(const VkInstanceCreateInfo *ci,
                                                         const VkAllocationCallbacks *alloc,
                                                         VkInstance *instance) {
    VkLayerInstanceCreateInfo *chain = (VkLayerInstanceCreateInfo *)ci->pNext;
    while (chain && !(chain->sType == VK_STRUCTURE_TYPE_LOADER_INSTANCE_CREATE_INFO &&
                      chain->function == VK_LAYER_LINK_INFO))
        chain = (VkLayerInstanceCreateInfo *)chain->pNext;
    if (!chain) return VK_ERROR_INITIALIZATION_FAILED;

    PFN_vkGetInstanceProcAddr gipa = chain->u.pLayerInfo->pfnNextGetInstanceProcAddr;
    chain->u.pLayerInfo = chain->u.pLayerInfo->pNext;
    PFN_vkCreateInstance create = (PFN_vkCreateInstance)gipa(NULL, "vkCreateInstance");
    VkResult r = create(ci, alloc, instance);
    if (r != VK_SUCCESS) return r;

    InstanceData *data = calloc(1, sizeof(*data));
    if (!data) return VK_ERROR_OUT_OF_HOST_MEMORY;
    data->key = key_of(*instance);
    data->instance = *instance;
    data->gipa = gipa;
    data->DestroyInstance = (PFN_vkDestroyInstance)gipa(*instance, "vkDestroyInstance");
    data->GetPhysicalDeviceFormatProperties2 = (PFN_vkGetPhysicalDeviceFormatProperties2)gipa(
        *instance, "vkGetPhysicalDeviceFormatProperties2");
    data->GetPhysicalDeviceImageFormatProperties2 =
        (PFN_vkGetPhysicalDeviceImageFormatProperties2)gipa(
            *instance, "vkGetPhysicalDeviceImageFormatProperties2");
    pthread_mutex_lock(&lock);
    data->next = instances;
    instances = data;
    pthread_mutex_unlock(&lock);
    logf_("layer active (fixup %s)", fixup_enabled() ? "on" : "off");
    return VK_SUCCESS;
}

static VKAPI_ATTR void VKAPI_CALL zam_DestroyInstance(VkInstance instance,
                                                      const VkAllocationCallbacks *alloc) {
    DispatchKey key = key_of(instance);
    pthread_mutex_lock(&lock);
    InstanceData **link = &instances;
    while (*link && (*link)->key != key) link = &(*link)->next;
    InstanceData *data = *link;
    if (data) *link = data->next;
    pthread_mutex_unlock(&lock);
    if (!data) return;
    data->DestroyInstance(instance, alloc);
    free(data);
}

static VKAPI_ATTR VkResult VKAPI_CALL zam_CreateDevice(VkPhysicalDevice physical,
                                                       const VkDeviceCreateInfo *ci,
                                                       const VkAllocationCallbacks *alloc,
                                                       VkDevice *device) {
    InstanceData *inst = find_instance(physical);
    VkLayerDeviceCreateInfo *chain = (VkLayerDeviceCreateInfo *)ci->pNext;
    while (chain && !(chain->sType == VK_STRUCTURE_TYPE_LOADER_DEVICE_CREATE_INFO &&
                      chain->function == VK_LAYER_LINK_INFO))
        chain = (VkLayerDeviceCreateInfo *)chain->pNext;
    if (!inst || !chain) return VK_ERROR_INITIALIZATION_FAILED;

    PFN_vkGetInstanceProcAddr gipa = chain->u.pLayerInfo->pfnNextGetInstanceProcAddr;
    PFN_vkGetDeviceProcAddr gdpa = chain->u.pLayerInfo->pfnNextGetDeviceProcAddr;
    chain->u.pLayerInfo = chain->u.pLayerInfo->pNext;
    PFN_vkCreateDevice create = (PFN_vkCreateDevice)gipa(inst->instance, "vkCreateDevice");
    VkResult r = create(physical, ci, alloc, device);
    if (r != VK_SUCCESS) return r;

    DeviceData *dev = calloc(1, sizeof(*dev));
    if (!dev) return VK_ERROR_OUT_OF_HOST_MEMORY;
    dev->key = key_of(*device);
    dev->device = *device;
    dev->physical = physical;
    dev->instance = inst;
    dev->gdpa = gdpa;
#define LOAD(fn) dev->fn = (PFN_vk##fn)gdpa(*device, "vk" #fn)
    LOAD(DestroyDevice);
    LOAD(CreateImage);
    LOAD(AllocateMemory);
    LOAD(BindImageMemory);
    LOAD(BindImageMemory2);
    LOAD(GetImageMemoryRequirements);
#undef LOAD
    if (!dev->BindImageMemory2)
        dev->BindImageMemory2 = (PFN_vkBindImageMemory2)gdpa(*device, "vkBindImageMemory2KHR");
    pthread_mutex_lock(&lock);
    dev->next = devices;
    devices = dev;
    pthread_mutex_unlock(&lock);

    for (uint32_t i = 0; i < ci->enabledExtensionCount; i++) {
        const char *ext = ci->ppEnabledExtensionNames[i];
        if (strstr(ext, "modifier") || strstr(ext, "external_memory") ||
            strstr(ext, "ycbcr"))
            logf_("device extension: %s", ext);
    }
    return VK_SUCCESS;
}

static PFN_vkVoidFunction device_hook(const char *name) {
#define HOOK(fn) \
    if (!strcmp(name, "vk" #fn)) return (PFN_vkVoidFunction)zam_##fn
    HOOK(GetDeviceProcAddr);
    HOOK(DestroyDevice);
    HOOK(CreateImage);
    HOOK(AllocateMemory);
    HOOK(BindImageMemory);
    HOOK(BindImageMemory2);
    HOOK(GetImageMemoryRequirements);
    if (!strcmp(name, "vkBindImageMemory2KHR")) return (PFN_vkVoidFunction)zam_BindImageMemory2;
#undef HOOK
    return NULL;
}

EXPORT VKAPI_ATTR PFN_vkVoidFunction VKAPI_CALL zam_GetInstanceProcAddr(VkInstance instance,
                                                                       const char *name) {
    if (!strcmp(name, "vkGetInstanceProcAddr")) return (PFN_vkVoidFunction)zam_GetInstanceProcAddr;
    if (!strcmp(name, "vkCreateInstance")) return (PFN_vkVoidFunction)zam_CreateInstance;
    if (!strcmp(name, "vkDestroyInstance")) return (PFN_vkVoidFunction)zam_DestroyInstance;
    if (!strcmp(name, "vkCreateDevice")) return (PFN_vkVoidFunction)zam_CreateDevice;
    PFN_vkVoidFunction hook = device_hook(name);
    if (hook) return hook;
    if (!instance) return NULL;
    InstanceData *inst = find_instance(instance);
    return inst ? inst->gipa(instance, name) : NULL;
}

EXPORT VKAPI_ATTR VkResult VKAPI_CALL
zam_NegotiateLoaderLayerInterfaceVersion(VkNegotiateLayerInterface *v) {
    if (v->loaderLayerInterfaceVersion > 2) v->loaderLayerInterfaceVersion = 2;
    v->pfnGetInstanceProcAddr = zam_GetInstanceProcAddr;
    v->pfnGetDeviceProcAddr = zam_GetDeviceProcAddr;
    v->pfnGetPhysicalDeviceProcAddr = NULL;
    return VK_SUCCESS;
}
