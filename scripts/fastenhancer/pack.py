# Packs a FastEnhancer spec2spec ONNX file (aask1357/fastenhancer releases) into
# the flat float32 layout the wasm engine reads. usage: pack.py in.onnx out.bin
import sys, struct, json
import numpy as np
import onnx
from onnx import numpy_helper

m = onnx.load(sys.argv[1])
init = {i.name: numpy_helper.to_array(i) for i in m.graph.initializer}
prod = {o: n for n in m.graph.node for o in n.output}

def w_of(out_name, idx=1):
    return init[prod[out_name].input[idx]]

out = []
def put(a, shape=None):
    a = np.ascontiguousarray(a, dtype=np.float32)
    if shape is not None:
        assert a.shape == tuple(shape), (a.shape, shape)
    out.append(a.reshape(-1))

C, _, K = init['encoder.0.0.weight'].shape
n_blocks = sum(1 for n in m.graph.node if n.op_type == 'GRU')
rf_freq = init['rf_block.0.pe'].shape[0]
rf_ch = init['rf_block.0.pe'].shape[1]
F = init['rf_pre.1.weight'].shape[1] and w_of('/rf_pre/rf_pre.0/MatMul_output_0').shape[0]
heads = 4
hdr = dict(C=int(C), F=int(F), rf_ch=int(rf_ch), rf_freq=int(rf_freq), blocks=int(n_blocks), heads=heads)
# 1 encoder prenet + encoder
put(init['enc_pre.0.weight']); put(init['enc_pre.0.bias'])
for i in range(2):
    put(init[f'encoder.{i}.0.weight']); put(init[f'encoder.{i}.0.bias'])
# 2 rf_pre
put(w_of('/rf_pre/rf_pre.0/MatMul_output_0'))             # [F, rf_freq]
put(init['rf_pre.1.weight']); put(init['rf_pre.1.bias'])   # [rf_ch, C, 1]
# 3 blocks
for b in range(n_blocks):
    g = prod[f'/rf_block.{b}/rnn/GRU_output_0']
    put(init[g.input[1]][0]); put(init[g.input[2]][0]); put(init[g.input[3]][0])  # Wi[3R,R] Wh[3R,R] B[6R]
    put(init[f'/rf_block.{b}/rnn_fc/MatMul_weight']); put(init[f'rf_block.{b}.rnn_fc.bias'])
    if b == 0: put(init['rf_block.0.pe'])
    put(w_of(f'/rf_block.{b}/attn/qkv/MatMul_output_0'))   # [rf_ch, 3*rf_ch] (x @ W)
    put(init[f'/rf_block.{b}/attn_fc/MatMul_weight']); put(init[f'rf_block.{b}.attn_fc.bias'])
# 4 rf_post
put(w_of('/rf_post/rf_post.0/MatMul_output_0'))            # [rf_freq, F]
put(init['rf_post.1.weight']); put(init['rf_post.1.bias'])  # [C, rf_ch, 1]
# 5 decoder
for i in range(2):
    put(init[f'decoder.{i}.0.weight']); put(init[f'decoder.{i}.0.bias'])
    put(init[f'decoder.{i}.2.weight']); put(init[f'decoder.{i}.2.bias'])
put(init['dec_post.0.weight']); put(init['dec_post.0.bias'])
put(init['dec_post.2.weight']); put(init['dec_post.2.bias'])
data = np.concatenate(out)
open(sys.argv[2], 'wb').write(data.tobytes())
print(json.dumps(hdr), data.size, 'floats', data.nbytes, 'bytes')
