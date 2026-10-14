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
# NVIDIA under X11: Chromium's GL path hands decoded frames to the X server
# without their tiling and they render black, so use its Vulkan path instead.
# NVIDIA's Vulkan driver only imports NV12 frames that are pitch-linear
# (NVD_LINEAR, our driver patch) and that don't ask for COLOR_ATTACHMENT (the
# layer's fixup). main.cjs adds the Chromium flags when it sees
# ZAM_NVIDIA_VULKAN_VIDEO=1; set it to 0 to turn all of this off.
#
# "NVIDIA" here means the card driving the screens: the driver of each card
# with a connected output, so a desktop with the iGPU enabled still counts, and
# an Optimus laptop (screens on the iGPU) doesn't.
display_drivers() {
    for s in /sys/class/drm/card*-*/status; do
        [ "$(cat "$s" 2>/dev/null)" = connected ] || continue
        card=${s#/sys/class/drm/}
        card=${card%%-*}
        basename "$(readlink "/sys/class/drm/$card/device/driver")"
    done | sort -u
}
if [ "${ZAM_NVIDIA_VULKAN_VIDEO:-1}" != 0 ] && [ -z "$WAYLAND_DISPLAY" ] &&
    [ "$XDG_SESSION_TYPE" != wayland ] && [ "$(display_drivers)" = nvidia ]; then
    export ZAM_NVIDIA_VULKAN_VIDEO=1
    export NVD_LINEAR="${NVD_LINEAR:-1}"
    export ZAM_VK_LAYER=1
    export ZAM_VK_FIXUP="${ZAM_VK_FIXUP:-1}"
fi
# ZAM_VK_DEBUG=1 logs the layer's view of every frame import.
if [ "${ZAM_VK_DEBUG:-0}" != 0 ]; then
    export ZAM_VK_LAYER=1
fi
exec zypak-wrapper /app/zam/zam "$@"
