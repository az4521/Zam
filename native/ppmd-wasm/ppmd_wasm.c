/*
  ppmd_wasm.c -- WebAssembly glue for the 7-Zip Ppmd7 (PPMdH) encoder/decoder
  with the 7z range coder. Freestanding: no libc, no imports.

  Memory model: a bump allocator over the module's linear memory (grown on
  demand). The model struct and its memory arena are reused across calls
  while memSize allows, so repeated calls do not allocate.

  All return values: encode returns the output length (>= 0) or a negative
  error; decode returns 0 on success or a negative error. Decode never reads
  past the input, never writes past outSize, and never traps on garbage input
  (every failure path is checked and reported as an error code).
*/
#include "Ppmd7.h"

#define PPMD_WASM_EXPORT(name) __attribute__((export_name(name)))

enum {
  ERR_PARAMS = -1,
  ERR_OUT_OVERFLOW = -2,
  ERR_ALLOC = -3,
  ERR_RC_INIT = -4,
  ERR_CORRUPT = -5,
  ERR_EARLY_END = -6,
  ERR_TRUNCATED = -7,
  ERR_FINISH = -8,
  ERR_TRAILING = -9
};

/* ---------- memset / memcpy / memmove (no libc) ---------- */

void *memset(void *dst, int c, size_t n)
{
  unsigned char *d = (unsigned char *)dst;
  __builtin_memset(d, (unsigned char)c, n);
  return dst;
}

void *memcpy(void *dst, const void *src, size_t n)
{
  __builtin_memcpy(dst, src, n);
  return dst;
}

void *memmove(void *dst, const void *src, size_t n)
{
  __builtin_memmove(dst, src, n);
  return dst;
}

/* ---------- bump allocator over linear memory ---------- */

extern unsigned char __heap_base[];

static unsigned long g_heap_top;

static void *bump(unsigned long n)
{
  unsigned long start, end, have;
  if (!g_heap_top)
    g_heap_top = (unsigned long)__heap_base;
  start = (g_heap_top + 15UL) & ~15UL;
  end = start + n;
  have = (unsigned long)__builtin_wasm_memory_size(0) * 65536UL;
  if (end > have)
  {
    unsigned long pages = (end - have + 65535UL) / 65536UL;
    if ((unsigned long)__builtin_wasm_memory_grow(0, (unsigned long)pages) == (unsigned long)-1)
      return 0;
  }
  g_heap_top = end;
  return (void *)start;
}

/* ---------- byte streams with bounds checks ---------- */

typedef struct
{
  IByteIn vt;
  const unsigned char *buf;
  unsigned long len;
  unsigned long pos;
  int overrun;
} PpmdInStream;

static Byte InStream_Read(IByteInPtr pp)
{
  PpmdInStream *s = (PpmdInStream *)(void *)pp;
  if (s->pos < s->len)
    return s->buf[s->pos++];
  s->overrun = 1; /* input exhausted: report, return 0 (decoder stops on overrun) */
  return 0;
}

typedef struct
{
  IByteOut vt;
  unsigned char *buf;
  unsigned long cap;
  unsigned long pos;
  int overflow;
} PpmdOutStream;

static void OutStream_Write(IByteOutPtr pp, Byte b)
{
  PpmdOutStream *s = (PpmdOutStream *)(void *)pp;
  if (s->pos < s->cap)
    s->buf[s->pos] = b;
  else
    s->overflow = 1;
  s->pos++;
}

/* ---------- model storage ---------- */

static CPpmd7 *g_model;
static Byte *g_arena;
static unsigned long g_arena_cap;

static unsigned char *g_in;
static unsigned long g_in_cap;
static unsigned char *g_out;
static unsigned long g_out_cap;

static int prepare_model(unsigned long memSize)
{
  if (!g_model)
  {
    g_model = (CPpmd7 *)bump(sizeof(CPpmd7));
    if (!g_model)
      return 0;
    Ppmd7_Construct(g_model);
  }
  /* Ppmd7_Alloc() equivalent: arena of AlignOffset + size bytes. */
  if (!g_arena || g_arena_cap < memSize + 4)
  {
    unsigned long cap = memSize + 4;
    g_arena = (Byte *)bump(cap);
    if (!g_arena)
      return 0;
    g_arena_cap = cap;
  }
  g_model->AlignOffset = (4 - (unsigned)memSize) & 3;
  g_model->Base = g_arena;
  g_model->Size = (UInt32)memSize;
  return 1;
}

static int params_ok(unsigned long order, unsigned long memSize)
{
  return order >= PPMD7_MIN_ORDER && order <= PPMD7_MAX_ORDER &&
         memSize >= PPMD7_MIN_MEM_SIZE && memSize <= PPMD7_MAX_MEM_SIZE;
}

/* ---------- exported API ---------- */

PPMD_WASM_EXPORT("ppmd_in_reserve")
unsigned char *ppmd_in_reserve(unsigned long n)
{
  if (!g_in || n > g_in_cap)
  {
    unsigned long cap = n < 4096UL ? 4096UL : n;
    unsigned char *p = (unsigned char *)bump(cap);
    if (!p)
      return 0;
    g_in = p;
    g_in_cap = cap;
  }
  return g_in;
}

PPMD_WASM_EXPORT("ppmd_out_reserve")
unsigned char *ppmd_out_reserve(unsigned long n)
{
  if (!g_out || n > g_out_cap)
  {
    unsigned long cap = n < 4096UL ? 4096UL : n;
    unsigned char *p = (unsigned char *)bump(cap);
    if (!p)
      return 0;
    g_out = p;
    g_out_cap = cap;
  }
  return g_out;
}

/* Encodes g_in[0..inLen) into g_out[0..outCap). Returns length or ERR_OUT_OVERFLOW. */
PPMD_WASM_EXPORT("ppmd_encode")
int ppmd_encode(unsigned long inLen, unsigned long order, unsigned long memSize, unsigned long outCap)
{
  PpmdOutStream out;
  CPpmd7 *p;
  if (!params_ok(order, memSize) || outCap > g_out_cap || !g_in || !g_out)
    return ERR_PARAMS;
  if (!prepare_model(memSize))
    return ERR_ALLOC;
  p = g_model;
  out.vt.Write = OutStream_Write;
  out.buf = g_out;
  out.cap = outCap;
  out.pos = 0;
  out.overflow = 0;
  p->rc.enc.Stream = &out.vt;
  p->InitEsc = 0;
  p->HiBitsFlag = 0;
  Ppmd7z_Init_RangeEnc(p);
  Ppmd7_Init(p, (unsigned)order);
  Ppmd7z_EncodeSymbols(p, g_in, g_in + inLen);
  Ppmd7z_Flush_RangeEnc(p);
  if (out.overflow)
    return ERR_OUT_OVERFLOW;
  return (int)out.pos;
}

/*
  Decodes g_in[0..inLen) into g_out[0..outSize). The stream must be consumed
  exactly and end with a finished range coder (the 7-Zip FinishStream rules).
*/
PPMD_WASM_EXPORT("ppmd_decode")
int ppmd_decode(unsigned long inLen, unsigned long outSize, unsigned long order, unsigned long memSize)
{
  PpmdInStream in;
  CPpmd7 *p;
  unsigned long i;
  if (!params_ok(order, memSize) || !g_in || !g_out || outSize > g_out_cap)
    return ERR_PARAMS;
  if (!prepare_model(memSize))
    return ERR_ALLOC;
  p = g_model;
  in.vt.Read = InStream_Read;
  in.buf = g_in;
  in.len = inLen;
  in.pos = 0;
  in.overrun = 0;
  p->rc.dec.Stream = &in.vt;
  p->InitEsc = 0;
  p->HiBitsFlag = 0;
  if (!Ppmd7z_RangeDec_Init(&p->rc.dec))
    return in.overrun ? ERR_TRUNCATED : ERR_RC_INIT;
  Ppmd7_Init(p, (unsigned)order);
  for (i = 0; i < outSize; i++)
  {
    int sym = Ppmd7z_DecodeSymbol(p);
    if (in.overrun)
      return ERR_TRUNCATED;
    if (sym < 0)
      return sym == PPMD7_SYM_END ? ERR_EARLY_END : ERR_CORRUPT;
    g_out[i] = (unsigned char)sym;
  }
  if (in.overrun)
    return ERR_TRUNCATED;
  if (!Ppmd7z_RangeDec_IsFinishedOK(&p->rc.dec))
    return ERR_FINISH;
  if (in.pos != in.len)
    return ERR_TRAILING;
  return 0;
}
