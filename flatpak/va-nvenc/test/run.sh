#!/bin/sh
# Builds zam_va_nvenc and its fakes and runs test_encode, with and without
# NVENC present. Needs a C compiler and the libva and nv-codec-headers
# headers: pass their include directories as INCLUDES, e.g.
#   INCLUDES="-I/path/libva/include -I/path/nv-codec-headers/include" ./run.sh
set -eu
here=$(cd "$(dirname "$0")" && pwd)
out=${OUT:-$(mktemp -d)}
cflags="-std=c11 -D_GNU_SOURCE -O1 -g -Wall -Wextra -Werror -fPIC ${INCLUDES:-} ${EXTRA_CFLAGS:-}"
mkdir -p "$out/nv"

cc $cflags -shared -fvisibility=hidden -o "$out/nvidia_drv_video.so" "$here/../zam_va_nvenc.c" -ldl -lpthread
cc $cflags -shared -o "$out/fake_drv.so" "$here/fake_drv.c"
cc $cflags -shared -Wno-unused-parameter -o "$out/nv/libcuda.so.1" "$here/fake_cuda.c"
cc $cflags -shared -o "$out/nv/libnvidia-encode.so.1" "$here/fake_nvenc.c"
cc $cflags -o "$out/test_encode" "$here/test_encode.c" -ldl

export ZAM_NVENC_REAL_DRIVER="$out/fake_drv.so"
LD_LIBRARY_PATH="$out/nv" "$out/test_encode" "$out/nvidia_drv_video.so"
LD_LIBRARY_PATH="" "$out/test_encode" "$out/nvidia_drv_video.so" nonvenc
