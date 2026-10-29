# Third-party notices

Software and models that ship inside Zam's own noise suppression. Zam itself
is GPL-3.0-only (see LICENSE).

## FastEnhancer (default noise suppression)

`src/lib/audio/fastenhancer_b.bin` holds the weights of FastEnhancer-Base
(48 kHz), repacked by `scripts/fastenhancer/pack.py` from the project's
released ONNX file
(github.com/aask1357/fastenhancer, release `onnx-48khz-v1`, SHA-256
`8df7941f5c9c81fdb79ccfeeb427ef7277d68821c1077eb940cc9893c0bbcac7`).
`scripts/fastenhancer/src/lib.rs` is Zam's own port of the network to
WebAssembly. The project's repository is MIT-licensed, and Zam treats the
released weights as covered by that license:

    MIT License

    Copyright (c) 2025 AHN Sung Hwan

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.

## RNNoise (fallback noise suppression)

`src/lib/audio/rnnoise.wasm` is RNNoise 0.2 (gitlab.xiph.org/xiph/rnnoise)
compiled to WebAssembly by Jitsi (@jitsi/rnnoise-wasm 0.2.1, Apache-2.0,
github.com/jitsi/rnnoise-wasm).

    Copyright (c) 2017, Mozilla
    Copyright (c) 2007-2017, Jean-Marc Valin
    Copyright (c) 2005-2017, Xiph.Org Foundation
    Copyright (c) 2003-2004, Mark Borgerding

    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions
    are met:

    - Redistributions of source code must retain the above copyright
    notice, this list of conditions and the following disclaimer.

    - Redistributions in binary form must reproduce the above copyright
    notice, this list of conditions and the following disclaimer in the
    documentation and/or other materials provided with the distribution.

    - Neither the name of the Xiph.Org Foundation nor the names of its
    contributors may be used to endorse or promote products derived from
    this software without specific prior written permission.

    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
    ``AS IS'' AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
    LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
    A PARTICULAR PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL THE FOUNDATION
    OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
    SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
    LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
    DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
    THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
    (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
    OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
