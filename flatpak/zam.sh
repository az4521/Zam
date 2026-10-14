#!/bin/sh
# Flatpak launcher: run Electron through zypak so Chromium's sandbox works
# inside the Flatpak sandbox. CHROME_DESKTOP makes the Wayland app_id match
# the desktop file, so the compositor shows the right icon and name.
export TMPDIR="${XDG_RUNTIME_DIR}/app/${FLATPAK_ID}"
export CHROME_DESKTOP=moe.crafty.matrix.desktop
# NVIDIA hardware video decode goes through nvidia-vaapi-driver, which libva
# won't choose on its own. Only force it when every render node is NVIDIA, so
# hybrid laptops keep the integrated GPU's driver for the node Chromium
# actually opens. Our build (/app/lib/dri, with NVD_LINEAR) comes first; the
# rest is libva's own search path in the runtime.
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
# Also when the user set LIBVA_DRIVER_NAME=nvidia themselves (nvidia-vaapi-driver's
# README tells them to, and Flatpak passes it through).
if [ "$LIBVA_DRIVER_NAME" = nvidia ] && [ -z "$LIBVA_DRIVERS_PATH" ]; then
    lib="/usr/lib/$(uname -m)-linux-gnu"
    export LIBVA_DRIVERS_PATH="/app/lib/dri:$lib/dri:$lib/dri/intel-vaapi-driver:$lib/dri/nvidia-vaapi-driver:$lib/GL/lib/dri"
fi
exec zypak-wrapper /app/zam/zam "$@"
