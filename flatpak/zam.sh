#!/bin/sh
# Flatpak launcher: run Electron through zypak so Chromium's sandbox works
# inside the Flatpak sandbox. CHROME_DESKTOP makes the Wayland app_id match
# the desktop file, so the compositor shows the right icon and name.
export TMPDIR="${XDG_RUNTIME_DIR}/app/${FLATPAK_ID}"
export CHROME_DESKTOP=moe.crafty.matrix.desktop
# NVIDIA hardware video decode goes through nvidia-vaapi-driver, which libva
# won't choose on its own. Only force it when every render node is NVIDIA, so
# hybrid laptops keep the integrated GPU's driver for the node Chromium
# actually opens.
if [ -z "$LIBVA_DRIVER_NAME" ]; then
    nv= other=
    for d in /sys/class/drm/renderD*/device/driver; do
        [ -e "$d" ] || continue
        case "$(basename "$(readlink "$d")")" in
            nvidia) nv=1 ;;
            *) other=1 ;;
        esac
    done
    if [ -n "$nv" ] && [ -z "$other" ]; then
        export LIBVA_DRIVER_NAME=nvidia
    fi
fi
# Our nvidia-vaapi-driver build (/app/lib/dri, with NVD_LINEAR) ahead of the
# runtime's, however libva ends up choosing nvidia: the directory holds only
# nvidia_drv_video.so, so every other driver still comes from libva's own
# search path in the runtime, which follows.
if [ -z "$LIBVA_DRIVERS_PATH" ]; then
    lib="/usr/lib/$(uname -m)-linux-gnu"
    export LIBVA_DRIVERS_PATH="/app/lib/dri:$lib/dri:$lib/dri/intel-vaapi-driver:$lib/dri/nvidia-vaapi-driver:$lib/GL/lib/dri"
fi
# NVIDIA: Chromium's GL path can't show NVIDIA's hardware-decoded frames. Under
# X11 it hands them to the X server without their tiling and they render
# black; under Wayland it needs VA-API post-processing, which
# nvidia-vaapi-driver doesn't have, so it decodes in software. Its Vulkan path
# imports the frames itself. NVIDIA's Vulkan driver only imports NV12 frames
# that are pitch-linear (NVD_LINEAR, our driver patch) and that don't ask for
# COLOR_ATTACHMENT (the layer's fixup). main.cjs adds the Chromium flags when
# it sees ZAM_NVIDIA_VULKAN_VIDEO=1.
#
# Settings > Debug writes "nvidiaVideo" ("vulkan", "off", or unset for
# automatic) to gpu-prefs.json; ZAM_NVIDIA_VULKAN_VIDEO=0/1 overrides both.
# Automatic means NVIDIA drives the screens: the driver of each card with a
# connected output, so a desktop with the iGPU enabled still counts and an
# Optimus laptop (screens on the iGPU) doesn't. nvidia-drm without modesetting
# lists no outputs, so with none listed anywhere an NVIDIA card is enough. When
# all of that misses, main.cjs asks Chromium which GPU it renders on and
# records "nvidiaDetected" for the next launch.
display_drivers() {
    for s in /sys/class/drm/card*-*/status; do
        [ "$(cat "$s" 2>/dev/null)" = connected ] || continue
        card=${s#/sys/class/drm/}
        card=${card%%-*}
        basename "$(readlink "/sys/class/drm/$card/device/driver")"
    done | sort -u
}
has_nvidia_card() {
    for d in /sys/class/drm/card*/device/driver; do
        [ "$(basename "$(readlink "$d")")" = nvidia ] && return 0
    done
    [ -e /sys/module/nvidia_drm ]
}
# Electron's userData directory is named after package.json "name" ("zam"), not
# the product name; try both.
for d in zam Zam; do
    gpu_prefs=$(cat "${XDG_CONFIG_HOME:-$HOME/.config}/$d/gpu-prefs.json" 2>/dev/null)
    [ -n "$gpu_prefs" ] && break
done
if [ -z "$ZAM_NVIDIA_VULKAN_VIDEO" ]; then
    case "$gpu_prefs" in
    *'"nvidiaVideo":"vulkan"'*) ZAM_NVIDIA_VULKAN_VIDEO=1 ;;
    *'"nvidiaVideo":"off"'*) ZAM_NVIDIA_VULKAN_VIDEO=0 ;;
    *'"nvidiaVulkanFailed":'[0-9]*) ZAM_NVIDIA_VULKAN_VIDEO=0 ;;
    *)
        drivers=$(display_drivers)
        if [ "$drivers" = nvidia ] ||
            { [ -z "$drivers" ] && has_nvidia_card; }; then
            ZAM_NVIDIA_VULKAN_VIDEO=1
        else
            case "$gpu_prefs" in
            *'"nvidiaDetected":true'*) ZAM_NVIDIA_VULKAN_VIDEO=1 ;;
            esac
        fi
        ;;
    esac
fi
if [ "$ZAM_NVIDIA_VULKAN_VIDEO" = 1 ]; then
    export ZAM_NVIDIA_VULKAN_VIDEO
    export NVD_LINEAR="${NVD_LINEAR:-1}"
    export ZAM_VK_LAYER=1
    export ZAM_VK_FIXUP="${ZAM_VK_FIXUP:-1}"
fi
# NVIDIA hardware video encoding: nvidia-vaapi-driver only decodes, so
# /app/lib/dri-nvenc holds a driver of the same name (va-nvenc/zam_va_nvenc.c)
# that encodes H.264 with NVENC and passes everything else to the one in
# /app/lib/dri. Experimental, so only when Settings > Debug turns it on
# ("nvidiaEncode":true) or ZAM_NVENC=1; main.cjs adds the Chromium flags.
if [ -z "$ZAM_NVENC" ]; then
    case "$gpu_prefs" in
    *'"nvidiaEncode":true'*) ZAM_NVENC=1 ;;
    esac
fi
if [ "$ZAM_NVENC" = 1 ] && has_nvidia_card; then
    export ZAM_NVENC
    export LIBVA_DRIVERS_PATH="/app/lib/dri-nvenc:$LIBVA_DRIVERS_PATH"
fi
# ZAM_VK_DEBUG=1 logs the layer's view of every frame import.
if [ "${ZAM_VK_DEBUG:-0}" != 0 ]; then
    export ZAM_VK_LAYER=1
fi
exec zypak-wrapper /app/zam/zam "$@"
