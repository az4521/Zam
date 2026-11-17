"""Test vectors for the direct file transfer v2 draft (Vommet issue 1474, with Zam).

Deterministic inputs; run with Python 3 and the `cryptography` package:
    python3 generate.py > vectors.json
Byte strings are lowercase hex. Blocks are 1 MiB, so files are described by a
generator rule, not inlined: byte j of the file is (j * 7 + 3) % 251.
"""
import hashlib, hmac, json, struct
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes

BLOCK = 1 << 20
PREFIX = "m.file_transfer.v2"
KEY = bytes(range(32))
HASH_KEY = bytes(range(32, 64))
TRANSFER_ID = "dGVzdC10cmFuc2Zlci1pZA"

def file_bytes(n):
    return bytes((j * 7 + 3) % 251 for j in range(n))

def blocks(data):
    if not data:
        return [b""]
    return [data[i:i + BLOCK] for i in range(0, len(data), BLOCK)]

def leaf(hk, i, blk):
    return hmac.new(hk, b"\x00" + struct.pack(">Q", i) + blk, hashlib.sha256).digest()

def root(leaves):
    level = list(leaves)
    while len(level) > 1:
        nxt = [hashlib.sha256(b"\x01" + level[k] + level[k + 1]).digest()
               for k in range(0, len(level) - 1, 2)]
        if len(level) % 2:
            nxt.append(level[-1])
        level = nxt
    return level[0]

def aad(index, size):
    return f"{PREFIX}|{TRANSFER_ID}|{index}|{size}".encode()

def seal(index, size, blk, iv):
    return iv + AESGCM(KEY).encrypt(iv, blk, aad(index, size))

def sha(b):
    return hashlib.sha256(b).hexdigest()

out = {"note": __doc__.strip(), "key": KEY.hex(), "hash_key": HASH_KEY.hex(),
       "transfer_id": TRANSFER_ID, "aad_prefix": PREFIX, "files": []}

for size in [0, 5, BLOCK, BLOCK + 1, 5 * BLOCK + 12345]:
    data = file_bytes(size)
    bl = blocks(data)
    leaves = [leaf(HASH_KEY, i, b) for i, b in enumerate(bl)]
    f = {"size": size, "block_count": len(bl), "file_sha256": sha(data),
         "leaves": [l.hex() for l in leaves], "root": root(leaves).hex(), "sealed": []}
    # Seal the first and last block with a fixed IV (real senders use random IVs).
    for i in sorted({0, len(bl) - 1}):
        iv = bytes([i % 256]) * 12
        s = seal(i, size, bl[i], iv)
        f["sealed"].append({"index": i, "iv": iv.hex(), "aad": aad(i, size).decode(),
                            "plaintext_len": len(bl[i]), "sealed_len": len(s),
                            "sealed_sha256": sha(s),
                            "sealed_head": s[:48].hex(), "sealed_tail": s[-32:].hex()})
    out["files"].append(f)

# Tamper: a file of 2 MiB + 10 bytes has 3 blocks. Leaf list [hash(l0,l1), l2]
# has 2 entries and rebuilds the same root; receivers MUST reject it on count.
tsize = 2 * BLOCK + 10
l3 = [leaf(HASH_KEY, i, b) for i, b in enumerate(blocks(file_bytes(tsize)))]
assert len(l3) == 3
short = [hashlib.sha256(b"\x01" + l3[0] + l3[1]).digest(), l3[2]]
assert root(short) == root(l3)
out["tamper_short_leaf_list"] = {
    "size": tsize, "file": "the same generator rule as the files above",
    "leaves": [l.hex() for l in l3], "root": root(l3).hex(),
    "bad_leaf_list": [l.hex() for l in short],
    "expect": "reject: 2 leaves where size requires 3, although they rebuild the root"}

# Tamper: a block sealed for index 1 fails to open as index 0, and with another size.
d = file_bytes(2 * BLOCK)
iv = b"\x07" * 12
s1 = seal(1, len(d), blocks(d)[1], iv)
out["tamper_aad"] = {"size": len(d), "sealed_for_index": 1, "iv": iv.hex(),
                     "sealed_sha256": sha(s1),
                     "expect": "opening it as index 0, or with size 2097153, fails authentication"}
for bad in [aad(0, len(d)), aad(1, len(d) + 1)]:
    try:
        AESGCM(KEY).decrypt(iv, s1[12:], bad); raise SystemExit("tamper opened")
    except Exception as e:
        if isinstance(e, SystemExit): raise

# SFU packet MAC.
mac_key = HKDF(hashes.SHA256(), 32, b"", f"{PREFIX} mac".encode()).derive(KEY)
ack = bytes([2]) + struct.pack(">IH", 3, 2) + struct.pack(">II", 5, 9)
data_pkt = bytes([1]) + struct.pack(">IHH", 0, 0, 1) + b"part"
macs = []
for direction, seq, pkt in [(1, 0, data_pkt), (2, 0, ack), (2, 7, ack)]:
    seqb = struct.pack(">Q", seq)
    tag = hmac.new(mac_key, bytes([direction]) + seqb + pkt, hashlib.sha256).digest()[:16]
    macs.append({"direction": direction, "sequence": seq, "packet": pkt.hex(),
                 "on_wire": (pkt + seqb + tag).hex()})
out["packet_mac"] = {"hkdf_info": f"{PREFIX} mac", "mac_key": mac_key.hex(), "packets": macs}

print(json.dumps(out, indent=2))
