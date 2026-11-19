# MSCXXXX: Direct file transfer (version 2)

Draft, written together by the Zam and Vommet projects. Not submitted. Discussion:
https://nether.codes/nether/vommet/issues/1482. Version 1 was
[Zam's earlier draft](https://github.com/az4521/Zam/blob/cac332d5/unsubmitted-mscs/msc-direct-file-transfer.md),
which Zam shipped before moving to version 2. Version 2 keeps its names, its event flow and its LiveKit transport, and
adds:

- a keyed block hash tree that checks every block as it arrives and lets a transfer resume across
  connections;
- a direct WebRTC data channel as a second transport;
- authenticated packets on the SFU, and an Olm-encrypted end-of-transfer confirmation;
- stricter rules on who may request a file and on parsing.

Sending a file in Matrix means uploading it to the media repository. Large files run into the
server's upload limit, and every file stays on the server long after anyone needs it. This proposal
moves a file from one device to another, end-to-end encrypted, without storing it anywhere.

The key words MUST, SHOULD and MAY are used as in RFC 2119. Names below are the stable ones; see
[Unstable prefix](#unstable-prefix).

## Proposal

### Overview

1. The sender posts an [offer](#mfile_offer-room-event) in the room. It names the file but holds
   none of it. The sender starts hashing the file in the background.
2. A receiver whose user taps Accept sends the sender's device a [request](#request) over Olm.
3. The sender checks the request. Once hashing is done it [accepts](#accept): a new key for this
   request, the hash key and root, and the transports it offers.
4. The two devices connect over [LiveKit](#transport-livekit) or a [direct data
   channel](#transport-direct-data-channel). The order is up to the client. When either side
   asks for relay-only, the data channel may run only through TURN ([Relay-only](#relay-only)).
5. The receiver sends a first acknowledgement. The sender sends the [leaf list](#the-leaf-list), then the [sealed blocks](#blocks). The receiver
   checks each block against its leaf and [acknowledges](#acknowledgements) it once it is stored.
6. The receiver sends [done](#done) over Olm.

### `m.file_offer` room event

A message-like room event, encrypted like any other in an encrypted room.

| Key | Type | Rule |
|---|---|---|
| `version` | Integer | **Required.** `2`. A receiver that doesn't support a version ignores the offer. |
| `transfer_id` | String | **Required.** At least 128 random bits, unpadded base64url. |
| `name` | String | **Required.** Untrusted; see [Security considerations](#security-considerations). |
| `size` | Integer | **Required.** Bytes, 0 to 2^40 inclusive. Receivers ignore larger offers. |
| `mimetype` | String | **Required.** `application/octet-stream` when unknown. A display hint only. |
| `sender_device` | String | **Required.** The device that holds the file. In an encrypted room it MUST be the device that created the Megolm session the offer was encrypted with; otherwise receivers ignore the offer. |
| `expires_ts` | Integer | **Required.** Milliseconds. Receivers use `min(expires_ts, origin_server_ts + 24 h)`. |
| `relay_only` | Boolean | Optional, default false. The sender wants its address hidden from the other person. |

The offer never changes. **Redacting it withdraws it**, whoever redacts it: the sender stops
accepting requests and cancels running transfers. An edit of the offer is ignored.

Everything below is keyed by the offer's `event_id` as well as `transfer_id`, so an offer that
copies another's `transfer_id` gains nothing.

### To-device messages

Every message is sent Olm-encrypted between the receiving device and `sender_device`. Devices MUST
ignore these types when they arrive unencrypted, and MUST apply the Olm payload checks of the Matrix
spec (`sender`, `recipient`, `recipient_keys`, `keys`).

Every message carries `transfer_id` and `event_id` (the offer). A **transfer** is identified by
those two together with the requesting user and device as Olm authenticates them. A message from any
other device is ignored, so nobody else can cancel or speak in a transfer by knowing its
`transfer_id`.

#### Request

`m.file_transfer.request`, receiver → sender. Sent only when the user taps Accept (or Resume).

| Key | Type | Rule |
|---|---|---|
| `room_id` | String | **Required.** The offer's room. |
| `have` | Array | Optional. Block ranges `[first, end)` the receiver already holds and has verified, for a resume. |
| `relay_only` | Boolean | Optional. True if the receiver wants relay-only (its own setting, or its client's rule for this room). |
| `alias` | String | Optional. The LiveKit room the receiver has joined on its own homeserver's SFU. |
| `service_url` | String | Optional, present if and only if `alias` is. It MUST be one that the receiver's homeserver advertises in `org.matrix.msc4143.rtc_foci`; the sender checks this and otherwise ignores the LiveKit part. |

The sender refuses with [refuse](#refuse), checking in this order:

| `reason` | Condition |
|---|---|
| `unknown-offer` | No open offer with this `transfer_id` and `event_id`. |
| `expired` | The offer has expired or was withdrawn. |
| `blocked` | The requesting user is on the sender's ignore list. |
| `not-joined` | The requesting user is not joined to the offer's room. |
| `device-not-allowed` | The sender would not share room keys with the requesting device under its device policy. |
| `busy` | The sender is serving as many transfers as it allows. |

A sender MAY also ask its user before serving a device: for example, an unverified device, or a
device asking for the same file again. Until the sender accepts, it sends [preparing](#preparing).

On the receiver, a request is answerable for 60 seconds. Each preparing extends that by 60 seconds
from its arrival. A receiver ignores an accept for a request it didn't send or that has lapsed. When
its user closes the transfer, it sends cancel. So nobody can hold a request and connect much later.
A running transfer is not canceled when the network changes: LiveKit reconnects, and resume covers
longer drops.

#### Preparing

`m.file_transfer.preparing`, sender → receiver: the request is waiting for hashing, a free slot or
the sender's user. Sent at most every 45 seconds while it waits.

#### Refuse

`m.file_transfer.refuse`, sender → receiver. `reason`: one of the above. Unknown values are a refusal.

#### Accept

`m.file_transfer.accept`, sender → receiver.

| Key | Type | Rule |
|---|---|---|
| `key` | String | **Required.** A new random 256-bit AES-GCM key, unpadded base64url, for this request only. |
| `hash_key` | String | **Required.** 256 random bits, unpadded base64url, made once per offer and the same in every accept for it. |
| `root` | String | **Required.** The [hash tree](#block-hashes) root, unpadded base64url. The same in every accept for the offer. |
| `relay_only` | Boolean | **Required.** True if either side asked for relay-only. |
| `alias`, `service_url` | String | Optional. The sender's own LiveKit room, with the same `rtc_foci` rule as the request. |
| `sdp` | String | Optional. An SDP offer for a [direct data channel](#transport-direct-data-channel). When `relay_only` is true, only a sender with a TURN server MAY include it, under the rules in [Relay-only](#relay-only). |

The sender sends accept only after hashing is done. Once it has hashed the file, it caches the leaf
list and root for later requests.

A receiver that has had no accept, refuse or preparing within 30 seconds of its request gives up.

#### Answer and candidates

`m.file_transfer.answer` (receiver → sender, `sdp`) and `m.file_transfer.candidates` (both ways,
`candidates`: an array of RTC ICE candidate objects) set up the direct data channel.

#### Acknowledgement

`m.file_transfer.ack`, receiver → sender: an [acknowledgement](#acknowledgements) as JSON
(`contiguous`, `have`). See [When acknowledgements can't be published](#when-acknowledgements-cant-be-published).

#### Done

`m.file_transfer.done`, receiver → sender, once every block is checked and stored, and the file has
its final name or has been handed over in full.

- `root`: **Required.** The root the receiver checked.

The sender shows the transfer as delivered only on done. Packets on the SFU can't fake it.

#### Cancel

`m.file_transfer.cancel`, either end, with `reason`: one of the refuse reasons, or `declined`,
`canceled`, `hash-mismatch`, `storage-full` or `failed`. Unknown values mean `failed`.

#### Accepted (optional)

`m.file_transfer.accepted`, receiver → its own user's other devices (cross-signed ones only), with
`device_id`. They show "accepted on <device>" but keep Accept.

### Block hashes

The file is split into blocks of 1 MiB (1,048,576 bytes). The last block is shorter. An empty file
has one block of zero bytes. With `n` blocks:

- Block `i`'s leaf is `HMAC-SHA-256(hash_key, 0x00 || uint64be(i) || block plaintext)`.
- A parent node is `SHA-256(0x01 || left || right)`. At each level, an odd node at the end moves up
  unchanged. The root of one leaf is that leaf.

Only devices that hold `hash_key` can compute or check hashes, so neither the SFU nor anyone else who
sees the leaf list can tell which file it belongs to.

### Blocks

A sealed block is `iv (12 random bytes) || AES-256-GCM(key, iv, aad, plaintext)`, with the 16-byte
tag at the end, as WebCrypto produces it. The additional authenticated data is the UTF-8 string
`m.file_transfer.v2|<transfer_id>|<index>|<size>`, with `index` and `size` in decimal. This binds each
block to its place in this file and to the file's size, so a relay can't reorder, replay or truncate
it. One key never seals more than 2^24 blocks, far below the random-IV limit.

### Packets

Both transports carry the same binary packets. Integers are unsigned and big-endian.

**Data** (type `1`): one part of a sealed block.

| Offset | Size | Field |
|---|---|---|
| 0 | 1 | `1` |
| 1 | 4 | block index |
| 5 | 2 | part index, from 0 |
| 7 | 2 | number of parts in this block |
| 9 | rest | this part |

A part is at most 14,000 bytes on LiveKit and at most 61,440 bytes on a data channel. The receiver
drops a packet whose part index is not below the part count, whose block index is past the end, or
whose part count differs from an earlier packet of the block. Once it has every part, it checks that
their total is exactly the sealed length (plaintext length + 28). It decrypts and checks the block
against its leaf. A block that fails either check is dropped and will be resent. After 16 failed
blocks, the receiver cancels with `hash-mismatch`. A receiver need not assemble more than 128 blocks
at once.

**Acknowledgement** (type `2`): `contiguous` (4 bytes): every block below this is
held. `count` (2 bytes, at most 128). Then `have`: `count` further block indexes held, 4 bytes each.
A packet whose length isn't exactly 7 + 4 × `count` is dropped.

**Leaves** (type `3`): part of the leaf list. `first` (4 bytes): the index of the first leaf. `count`
(2 bytes, 1 to 437). Then `count` leaves of 32 bytes each.

#### The leaf list

The sender sends the whole leaf list first, in order from leaf 0. The receiver MUST check that:

- there are exactly as many leaves as `size` implies;
- the leaves rebuild the accept's `root`.

It collects the list like this, because the SFU may drop packets:

- A leaves packet with `first` 0 starts the list over.
- A leaves packet whose `first` doesn't follow on from the leaves held so far is ignored.
- A list that would run past the count from `size` is discarded, and collection starts over.

It takes no data packets until it holds a complete list. If a complete list doesn't rebuild `root`,
it cancels with `hash-mismatch`: packets are authenticated, so only the sender can have sent it. The
two-minute no-progress limit ends a transfer whose list never arrives. The count check matters: with
odd-node promotion, a list that is too short can still reproduce the root.

The sender can't see a lost leaves packet: it just gets no acknowledgement for its data. So, until an
acknowledgement covers a block it has sent data for on this connection, a sender that would resend
data first resends the whole leaf list. Once one does, the receiver holds the list, and the sender
never resends it on that connection. On a data channel, nothing is lost, so this never happens.

A receiver that resumes keeps its saved leaf list. It checks the list against `root` again whenever
it loads it, and against the new list. If a later accept's `root` differs from the saved one, the
receiver discards its saved blocks and starts over.

### Acknowledgements

The receiver acknowledges a block once it is written to storage and has matched its leaf. It also
acknowledges:

- when it receives data for a block it already holds;
- at least once a second while the transfer runs.

The first packets go in this order:

1. Once connected, the receiver sends an acknowledgement: `contiguous` 0 and no `have` for a new
   transfer, or what it holds for a resume.
2. The sender, which has sent nothing until now, sends the whole leaf list.
3. The sender sends data, skipping the blocks the receiver holds.

If the request's `have` and this first acknowledgement disagree, the acknowledgement wins.

On LiveKit, the sender keeps a window of unacknowledged blocks. It grows the window as
acknowledgements arrive, shrinks it on loss, and resends a block that stays unacknowledged. The
constants are up to the implementation. On a data channel, delivery is reliable and ordered, so the
sender uses the channel's `bufferedAmount` for flow control and resends only blocks that an
acknowledgement shows missing after a failure.

A resend on the same connection MUST repeat the block's sealed bytes exactly, not seal it again. Parts
of two sealings of one block can't be combined, and a receiver can't tell them apart until the block
fails, which would count against the 16. The sender keeps each sealed block until it is acknowledged;
the window bounds that memory. A receiver still treats a part that differs from the one it holds for
the same block as the start of a new attempt, and drops the old parts. On a new connection everything
is sealed again under the new key.

Either end gives up after two minutes with no progress.

#### When acknowledgements can't be published

An SFU may let only its own homeserver's users publish data
([MSC4576](https://github.com/matrix-org/matrix-spec-proposals/pull/4576)). That doesn't affect a
receiver publishing in its own room, but a receiver with no SFU of its own can't publish anywhere it
won't be dropped.

So when no data has arrived for 4 seconds, the receiver also sends its current acknowledgement as an
`m.file_transfer.ack` to-device message, at most every 4 seconds. A sender that receives one SHOULD
lengthen its resend delay, since to-device messages are much slower than the data channel.

### Transport: LiveKit

The transfer goes through the SFUs of the two users' homeservers, so neither device learns the
other's address. Each end:

- joins a LiveKit room on its own homeserver's SFU and names it in its request or accept
  (`alias`, `service_url`), and joins the peer's room;
- publishes data only in its own room;
- listens for data in both rooms, from the peer's LiveKit identity only (`<user_id>:<device_id>`, as
  the token service assigns it), and subscribes to no tracks;
- sends every packet as LiveKit reliable data with the topic `m.file_transfer`, addressed to the
  peer's identity only (`destinationIdentities`);
- rejoins a room it loses for longer than LiveKit can resume, with a new token. Neither end discards
  anything: the next acknowledgement tells the sender where to carry on.

In addition:

- Each end finds its own SFU and the peer's from the `org.matrix.msc4143.rtc_foci` that each user's
  homeserver advertises, taking the first `livekit` entry. A `service_url` in a message is used only
  if it is one that the peer's homeserver advertises.
- A device joins the peer's SFU only for a transfer its user agreed to: the receiver by tapping
  Accept, the sender by making the offer.
- The room name is `m.file_transfer-<secret>`, with at least 128 random bits. It SHOULD NOT contain
  the Matrix room ID: `rtc_foci` may point at an SFU run by someone other than the homeserver, and
  the random part is enough.
- These rooms have no matching Matrix call, so getting a token relies on the SFU's token service
  accepting any room name, as lk-jwt-service's legacy `/sfu/get` does. A token endpoint that ties
  tokens to a Matrix room would need a separate grant for this.
- A receiver whose homeserver advertises no SFU joins only the sender's room. Its acknowledgements
  then go only as `m.file_transfer.ack` to-device messages, since a publish in the sender's room may
  be dropped.
- **Every packet is authenticated.** Each packet is followed by an 8-byte sequence number and a
  16-byte tag. The tag is HMAC-SHA-256, truncated, over `direction byte || sequence || packet`. Its
  key is `HKDF-SHA-256(IKM = key, salt = empty, info = "m.file_transfer.v2 mac", L = 32)`. The
  direction byte is `0x01` from the sender and `0x02` from the receiver. Each side numbers its packets
  from 0. A receiver accepts gaps, because the SFU may drop packets. It rejects a sequence number that
  isn't above the highest it has accepted, and drops a packet whose tag fails, silently, without
  counting it as a failed block. Acknowledgements only ever grow.

Neither end sends a MatrixRTC membership for these rooms, and neither subscribes to tracks.

### Transport: direct data channel

The sender creates an RTCPeerConnection with one data channel (label `m.file_transfer`, ordered,
reliable), and puts its SDP offer in accept. The receiver replies with answer, and both trickle
candidates. The SDP travels over Olm, so the DTLS fingerprints authenticate the channel to the two
devices, and packets on it carry no extra MAC.

A client MAY ask its user before using a direct connection, because it shows each device's address
to the other.

Every peer connection uses a freshly generated DTLS certificate. The SDP MUST NOT contain
`a=candidate` lines; candidates go only in candidates messages.

### Choosing the transport

An accept may offer both a LiveKit room and an `sdp`. Then the **receiver** picks:

- It sends `answer` only if it chooses the data channel. Otherwise it joins the LiveKit room and sends
  no `answer`.
- The transport that the receiver's first acknowledgement arrives on is the one used. A sender that
  offered both and gets the first acknowledgement over LiveKit closes the data channel at once,
  without waiting for it.
- A receiver whose data channel fails before its first acknowledgement may still join the LiveKit room.

Acknowledgements are authenticated on both transports, so nobody else can steer the choice.

### Relay-only

When either side asks for relay-only, the other person must never learn either device's address.
Two transports meet that:

- **LiveKit.** Each device connects to the other user's SFU, which learns its address as it would in
  a call. The other person doesn't.
- **A data channel through TURN only.** Both peer connections MUST use `iceTransportPolicy: "relay"`.
  Neither side gathers or sends host, srflx or prflx candidates, and each MUST ignore any non-relay
  candidate it receives. Each side then sees only the other's TURN server. A side with no TURN server
  can't do this: it uses LiveKit, or the sender refuses with `failed`.

A receiver that asked for relay-only and gets an accept whose `relay_only` is false cancels with
`failed`.

Which transports a sender offers, which one a receiver picks, and when relay-only applies by default,
is up to each client.

### Storage

A receiver MUST check every block against its leaf before it writes or passes it on. Beyond that,
storage is up to the client. A client that writes its own file SHOULD:

- write into a temporary file with a random name, created exclusively;
- keep a record of verified blocks bound to the offer's `event_id`, `transfer_id`, `size` and `root`,
  and delete it when the offer expires;
- check every block against its leaf again before the final rename;
- rename atomically, never overwriting an existing file.

A client that streams the file to the platform's download manager meets the MUST by checking each
block before handing it over.

### Sender policy

How many transfers a sender serves, whether it queues requests, and whether it serves a device that
asks for the same file again are up to the sender. The sender can always withdraw the offer or cancel
one transfer.

## Potential issues

- **The sender must stay online, and must hash the file before the first accept.** For a large file
  on a phone, the first receiver may wait for hashing. Preparing keeps that request alive.
- **No fallback** for clients that don't implement this proposal: they show nothing for an offer.
- **Remote publishing.** If MSC4576 settles on SFUs refusing all data publishing, rather than only
  other servers' users, the LiveKit transport doesn't work at all. If it settles on refusing other
  servers' users, a receiver without an SFU of its own gets the slow to-device acknowledgement path.
- **Token lifetime.** LiveKit tokens from the token service expire. Long transfers rely on rejoining
  with a new token.
- **SFU load.** A transfer uses SFU bandwidth like a call does, but much more of it. Server operators
  may want to limit data rate or room count per user. An SFU that drops this traffic doesn't break
  correctness, only speed.

## Alternatives

- Version 1, which checks the whole file once at the end and can't resume across connections.
- FLOE ([MSC4571](https://github.com/matrix-org/matrix-spec-proposals/pull/4571)) for the file
  encryption. A key per request makes its key commitment unnecessary, and per-block AES-GCM needs
  only WebCrypto.
- A root in the offer, visible to the whole room. It would make the sender hash before posting. An
  optional one can be added if receivers later fetch blocks from each other.

## Security considerations

- **The SFUs and TURN relays see ciphertext only.** Keys travel only over Olm.
- **Who gets the file:** only a joined, non-ignored member's device that passes the sender's device
  policy, and only the device Olm says sent the request.
- **A forged or delayed accept:** a receiver answers only accepts for its own live requests.
- **Tampering:** the AAD binds every block to its transfer, index and the file's size. Every block
  must match its leaf, and the leaf list must have the right length and rebuild the root. Each block
  is checked before it is written or handed over.
- **The SFU forging acknowledgements:** packets are authenticated, and delivery is confirmed only by
  done over Olm.
- **Network exposure:** with relay-only, each device connects only to SFUs and TURN servers. A device
  may connect to the other user's homeserver's SFU, which learns its address, as in a call.
- **The file name is attacker-controlled.** Receivers MUST remove path separators, control
  characters and bidirectional controls, leading dots, and trailing dots and spaces. They MUST rename
  Windows reserved names, cap the name's length, and never open the file automatically.
- **Resource use:** `size` is at most 2^40. A receiver holds at most 128 partial blocks, checks a
  block's exact sealed length before assembling it, and cancels after 16 failed blocks.

## Unstable prefix

| Stable | Unstable |
|---|---|
| `m.file_offer` | `moe.crafty.matrix.file_offer` |
| `m.file_transfer.*` (to-device) | `moe.crafty.matrix.file_transfer.*` |
| `m.file_transfer` (LiveKit topic, data channel label) | `zam.file.v1` |
| `m.file_transfer-` (LiveKit room name) | `zam-transfer-` |
| `m.file_transfer.v2\|` (AAD) | `zam-file-v2\|` |
| `m.file_transfer.v2 mac` (HKDF info) | `zam-file-v2 mac` |

## Test vectors

In [`msc-direct-file-transfer-vectors/`](msc-direct-file-transfer-vectors/): `vectors.json` and
the `generate.py` that makes it. They use the stable prefix `m.file_transfer.v2`; while the unstable
prefix is in use, regenerate with `PREFIX` changed. They cover:

- leaves and roots for files of 0 bytes, 5 bytes, exactly one block, one block plus one byte, and
  5 blocks plus a partial one;
- sealed first and last blocks (with fixed IVs, which real senders never use);
- a too-short leaf list that rebuilds the root and must be rejected;
- a block that must fail to open under another index or size;
- authenticated SFU packets in both directions.

## Dependencies

- [MSC4143](https://github.com/matrix-org/matrix-spec-proposals/pull/4143) (MatrixRTC), for
  discovering each homeserver's LiveKit transport (`rtc_foci`).
- [MSC4195](https://github.com/matrix-org/matrix-spec-proposals/pull/4195) (MatrixRTC using
  LiveKit), for getting a LiveKit token.
- [MSC4576](https://github.com/matrix-org/matrix-spec-proposals/pull/4576), which decides whether,
  and whose, data publishing an SFU allows.

## Reference implementation

Zam (<https://github.com/az4521/Zam>) implements version 2 with the unstable names. The Matrix side is
in `src/lib/matrix/fileTransfer.ts`, the block sender and receiver in
`src/lib/matrix/fileTransferEngine.ts`, the direct data channel in
`src/lib/matrix/fileTransferDirect.ts`, and the wire format and cryptography in
`src/lib/utils/fileTransfer.ts`, `fileTransferHash.ts` and `fileTransferMacLink.ts`. Its tests check
the shared vectors (`src/lib/utils/fileTransferV2.vectors.test.ts`).
