/* Minimal freestanding shim: memset/memcpy/memmove are defined in ppmd_wasm.c. */
#ifndef PPMD_WASM_SHIM_STRING_H
#define PPMD_WASM_SHIM_STRING_H
#include <stddef.h>
void *memset(void *dst, int c, size_t n);
void *memcpy(void *dst, const void *src, size_t n);
void *memmove(void *dst, const void *src, size_t n);
#endif
