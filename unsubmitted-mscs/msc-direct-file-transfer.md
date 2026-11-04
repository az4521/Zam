# MSCXXXX: Direct file transfer through MatrixRTC SFUs

Sending a file in Matrix means uploading it to the media repository. Large
files run into the server's upload limit, and every file stays on the server
(and on every server that fetches it) long after anyone needs it. Users who
just want to hand a large file to someone in a room have no other option.

The obvious alternative, a WebRTC data channel between the two devices, shows
each device's IP address to the other, and without a TURN server it fails for
many networks. Homeservers that run MatrixRTC already have something better
placed: a LiveKit SFU. This proposal moves a file from one device to another
through the SFUs of the two users' homeservers, end-to-end encrypted, without
storing it anywhere and without either device learning the other's address.

## Proposal

### Overview

1. The sender posts an [offer](#mfile_offer-room-event) in the room. The offer
   names the file but holds none of it.
2. A receiver who accepts opens a LiveKit room on its own homeserver's SFU,
   then sends the sender's device a [request](#request) over an Olm-encrypted
   to-device message, naming that room.
3. The sender checks the request, opens a LiveKit room on its own SFU, joins
   the receiver's room, and [accepts](#accept), handing over its room's name
   and a new symmetric key.
4. The sender publishes the file as [sealed blocks](#blocks) in its own room.
   The receiver publishes [acknowledgements](#acknowledgements) in its own room
   as blocks reach its disk.
5. The sender sends the file's [hash](#file-hash) over to-device, and the
   receiver checks it before keeping the file.

Like the media of a MatrixRTC call, each device publishes only on its own
homeserver's SFU and listens on the other's. Neither LiveKit room has a
MatrixRTC membership, so nothing about the transfer appears in the Matrix room
beyond the offer.

### `m.file_offer` room event

A message-like room event. In an encrypted room it is encrypted like any other
event. The room need not be encrypted: everything secret goes over Olm
to-device messages, which any two devices with end-to-end encryption can
exchange whatever the room's settings.

`content` has the following keys:

- `version`: **Required, Integer**. `1`. A receiver ignores offers with any
  other value.
- `transfer_id`: **Required, String**. A random identifier for this offer. It
  SHOULD hold at least 128 bits of randomness.
- `name`: **Required, String**. The file name. Receivers MUST treat it as
  untrusted (see [Security considerations](#security-considerations)).
- `size`: **Required, Integer**. The size in bytes, from 0 to 2^40 inclusive.
- `mimetype`: **Required, String**. The file's media type.
  `application/octet-stream` when unknown.
- `sender_device`: **Required, String**. The device ID that holds the file.
  Requests go to this device only.
- `expires_ts`: **Required, Integer**. A timestamp in milliseconds after which
  the sender refuses requests. Implementations SHOULD NOT set it more than 24
  hours ahead.

```json
{
  "type": "m.file_offer",
  "content": {
    "version": 1,
    "transfer_id": "nM3a1u2l8FQb0aYp6kD1xg",
    "name": "holiday.mkv",
    "size": 8421376000,
    "mimetype": "video/x-matroska",
    "sender_device": "ABCDEFGHIJ",
    "expires_ts": 1793836800000
  }
}
```

The offer stays open while the sender's device is online and holds the file.
Redacting the offer withdraws it: the sender stops accepting requests for it
and cancels any transfers of it that are running, whoever redacted it.

### To-device messages

Every message in this section is sent as an Olm-encrypted to-device message,
between the receiving device and the offer's `sender_device`. Devices MUST
ignore these types when they arrive unencrypted. A transfer is identified by
`transfer_id` together with the Olm-authenticated user and device that sent the
message, so a third device cannot speak in someone else's transfer by knowing
the `transfer_id`.

Every message has a `transfer_id` key: **Required, String**, the offer's.

#### Request

`m.file_transfer.request`, from the receiver to the sender.

- `room_id`: **Required, String**. The room the offer was posted in.
- `service_url`: **Optional, String**. The `https://` URL of the receiver's
  homeserver's LiveKit authorisation service.
- `alias`: **Optional, String**. The name of the LiveKit room the receiver has
  joined there. Present if and only if `service_url` is.

The receiver joins its own room *before* it sends the request: an SFU may let a
user create rooms only by joining them, and the sender must be able to join it
afterwards. A receiver whose homeserver has no SFU omits both keys.

```json
{
  "transfer_id": "nM3a1u2l8FQb0aYp6kD1xg",
  "room_id": "!abc:example.org",
  "service_url": "https://livekit-jwt.example.org",
  "alias": "!abc:example.org|m.file_transfer-6Hh0b2...Zx"
}
```

The sender refuses a request when any of these hold, and checks them in this
order:

| `reason`             | Condition                                                                 |
| -------------------- | ------------------------------------------------------------------------- |
| `unknown-offer`      | The sender has no open offer with this `transfer_id`.                     |
| `expired`            | The offer's `expires_ts` has passed.                                      |
| `blocked`            | The requesting user is on the sender's ignore list.                       |
| `not-joined`         | The requesting user is not joined to the offer's room.                    |
| `device-not-allowed` | The sender would not share room keys with the requesting device.          |
| `busy`               | The sender is already sending this file to as many devices as it allows.  |

"Would not share room keys" means whatever device policy the sender's client
applies to Megolm sessions, such as refusing unverified devices. A request
starts a transfer of the whole file and hands over a key, so it needs more
behind it than knowing a `transfer_id`.

How many devices a sender serves at once is up to the sender. Each request
gets its own key and its own LiveKit rooms.

#### Refuse

`m.file_transfer.refuse`, from the sender to the receiver.

- `reason`: **Required, String**. One of the reasons above. Receivers treat
  unknown values as a refusal.

#### Accept

`m.file_transfer.accept`, from the sender to the receiver.

- `key`: **Required, String**. A new random 256-bit AES-GCM key, unpadded
  base64url. It is used for this transfer only.
- `service_url`: **Required, String**. The `https://` URL of the sender's
  homeserver's LiveKit authorisation service.
- `alias`: **Required, String**. The LiveKit room the sender has joined there.

The sender sends it only after it has joined its own room, and after it has
joined the receiver's room or failed to. A receiver ignores an accept whose
`service_url` is not `https://`. A receiver that has had no accept or refuse
within 30 seconds of its request gives up.

#### Acknowledgement

`m.file_transfer.ack`, from the receiver to the sender. The same content as an
[acknowledgement packet](#acknowledgements): `contiguous` (Integer) and `have`
(Array of Integer, at most 128 entries). See
[When acknowledgements can't be published](#when-acknowledgements-cant-be-published).

#### Finish

`m.file_transfer.finish`, from the sender to the receiver, once every block has
been acknowledged.

- `root`: **Required, String**. The [file hash](#file-hash).

#### Done

`m.file_transfer.done`, from the receiver to the sender, in answer to finish.

- `ok`: **Required, Boolean**. Whether the receiver's hash matched `root`.

The receiver keeps the file only if it did. A sender that has had no done
within two minutes of finish treats the transfer as failed.

#### Cancel

`m.file_transfer.cancel`, from either end. The transfer stops. The sender also
sends it to every receiver when the offer is withdrawn.

### LiveKit rooms

Each end finds its own homeserver's SFU from the LiveKit transports in its
homeserver's `org.matrix.msc4143.rtc_foci` (per
[MSC4143](https://github.com/matrix-org/matrix-spec-proposals/pull/4143)), and
gets a token for a room from that transport's authorisation service as for a
call ([MSC4195](https://github.com/matrix-org/matrix-spec-proposals/pull/4195)).

A transfer room's name is

```
<room_id>|m.file_transfer-<secret>
```

where `room_id` is the offer's room and `secret` is at least 128 random bits,
unpadded base64url, chosen afresh by each end for each transfer. The room is
known only to the two devices.

Neither end sends an `m.rtc.member` (or legacy `org.matrix.msc3401.call.member`)
state event for these rooms. They are not calls: other members of the Matrix
room cannot see them, and clients that don't implement this proposal don't
show a call.

Each end:

- publishes data only in its own room;
- listens for data in both rooms, from the peer's LiveKit identity only
  (`<user_id>:<device_id>`, as the authorisation service assigns it);
- subscribes to no tracks.

A receiver with no SFU of its own publishes in the sender's room instead. The
sender's SFU may drop what it publishes there; the receiver then falls back to
[to-device acknowledgements](#when-acknowledgements-cant-be-published).

All packets use LiveKit reliable data with the topic `m.file_transfer`, and are
addressed to the peer's identity only (`destinationIdentities`).

If an end loses a room for longer than LiveKit can resume, it rejoins it with a
new token. Neither end discards anything: the next acknowledgement tells the
sender where to carry on.

### Blocks

The file is split into blocks of 1 MiB (1048576 bytes). Block *i* holds bytes
*i*·2^20 to *i*·2^20 + 2^20 − 1, with the last block shorter. An empty file
has one block of zero bytes.

A sealed block is

```
iv (12 random bytes) || AES-256-GCM(key, iv, aad, plaintext)
```

with the 16-byte tag at the end of the ciphertext, as WebCrypto produces it.
The additional authenticated data is the UTF-8 string

```
m.file_transfer.v1|<transfer_id>|<index>|<size>
```

with `index` and `size` in decimal. This binds each block to its place in this
file and to the file's size, so the SFU cannot reorder, replay or truncate the
file.

LiveKit's reliable data packets are limited to about 15 KB, so a sealed block
is split into parts of at most 14000 bytes. Each part travels in a data
packet. All integers are unsigned and big-endian:

| Offset | Size | Field                             |
| ------ | ---- | --------------------------------- |
| 0      | 1    | `1` (data)                        |
| 1      | 4    | block index                       |
| 5      | 2    | part index, from 0                |
| 7      | 2    | number of parts in this block     |
| 9      | rest | this part of the sealed block     |

A receiver drops packets whose part index is not below the part count, whose
block index is past the end of the file, or whose part count differs from an
earlier packet of the same block. Once it has every part it checks that their
total length is exactly the sealed length of that block (plaintext length +
28), and decrypts. A block that fails is dropped and will be resent. After 16
failed blocks, the receiver cancels the transfer.

A receiver need not assemble more than 128 blocks at once and drops parts of
further blocks.

### Acknowledgements

The receiver acknowledges a block once it is written to storage, not when it
arrives. One acknowledgement packet says what it holds:

| Offset | Size      | Field                                       |
| ------ | --------- | ------------------------------------------- |
| 0      | 1         | `2` (acknowledgement)                       |
| 1      | 4         | `contiguous`: every block below this is held |
| 5      | 2         | `count`, at most 128                        |
| 7      | 4·`count` | `have`: further blocks held, above `contiguous` |

A packet whose length is not exactly 7 + 4·`count` is dropped.

The receiver sends one after each block it stores, when it receives data for a
block it already has, and at least once a second while the transfer runs. That
last one is how the sender learns the receiver is ready: the sender sends
nothing before its first acknowledgement.

The acknowledgement is the only feedback the sender gets, and it is all of
flow control, retransmission and resumption. The SFU does not hold data for a
slow subscriber indefinitely, and may drop it, so:

- The sender keeps a window of unacknowledged blocks and does not send past
  it. Implementations SHOULD start small and grow it as acknowledgements
  arrive, and SHOULD shrink it when blocks are lost.
- A block that is still unacknowledged when a later block is acknowledged, or
  that has gone unacknowledged for some seconds, is resent.
- After a disconnection both ends carry on from the next acknowledgement.

The constants are not part of the protocol. The reference implementation
starts at 4 blocks, adds 1/window per acknowledged block, halves it (no lower
than 2, no more than once a second) on loss, caps it at 32, and resends after
3 seconds.

Either end gives up after two minutes with no progress.

#### When acknowledgements can't be published

An SFU may let only its own homeserver's users publish data
([MSC4576](https://github.com/matrix-org/matrix-spec-proposals/pull/4576)).
That does not affect a receiver publishing in its own room. A receiver
publishing in the sender's room, because it has no SFU of its own, may find
its acknowledgements dropped.

So when no data has arrived for 4 seconds, the receiver also sends its current
acknowledgement as an [`m.file_transfer.ack`](#acknowledgement) to-device
message, at most every 4 seconds. A sender that receives one SHOULD lengthen
its resend delay, since to-device messages are much slower than the data
channel.

### File hash

Each end computes the SHA-256 of each block's plaintext as it passes, and the
file hash is the SHA-256 of all of those hashes concatenated in block order,
as unpadded base64url. The receiver compares its own with the sender's
[finish](#finish) and keeps the file only if they match.

AES-GCM already authenticates each block. The hash also covers what GCM
cannot see: that the receiver stored every block it acknowledged, in the right
place.

## Potential issues

- **The sender must stay online.** Nothing is stored anywhere, so an offer is
  only good while the sending device runs and holds the file. Mobile platforms
  may freeze a backgrounded client mid-transfer; implementations need whatever
  the platform offers to keep running (the reference implementation uses an
  Android foreground service).
- **No fallback.** Clients that don't implement this proposal show nothing for
  an offer. A `body` fallback is possible but would invite replies to a
  message those users cannot act on.
- **Remote publishing.** If MSC4576 settles on SFUs refusing all data
  publishing, rather than only other servers' users, this proposal does not
  work at all. If it settles on refusing other servers' users, a receiver
  without an SFU of its own gets the slow to-device acknowledgement path.
- **Token lifetime.** LiveKit tokens from the authorisation service expire.
  Long transfers rely on rejoining with a new token.
- **SFU load.** A transfer uses SFU bandwidth like a call does, but much more
  of it. Server operators may want to limit data rate or room count per user.
  An SFU that drops this traffic does not break correctness, only speed.
- **LiveKit only.** The packet format assumes a reliable, message-oriented
  channel with addressed delivery. Another MatrixRTC transport with those
  properties could carry it, but this proposal defines only LiveKit.

## Alternatives

### Upload to the media repository

This is the status quo. It is limited by the server's upload size, stores the
file on every server that fetches it, and is unavailable to users whose server
sets a small limit.

### A peer-to-peer WebRTC data channel

A data channel between the two devices needs no server bandwidth, but ICE
shows each device's addresses to the other, and it needs a TURN server for
many networks. Many homeservers that run an SFU run no separate TURN server.
LiveKit's embedded TURN could relay it, but it is off by default and its
credentials are not bound to a room.

### A MatrixRTC call

The transfer could be a MatrixRTC session with `m.rtc.member` events. Every
member of the room would see a call they cannot join, and the session would
leak which devices are exchanging files and when.

### One room, on the sender's SFU

Simpler, and the first version of the reference implementation did this. It
needs the sender's SFU to let a remote user publish acknowledgements, which
MSC4576 allows servers to refuse. Two rooms, each end publishing on its own
server, follows how MatrixRTC calls already handle media.

## Security considerations

- **The SFUs see ciphertext only.** The key is generated per transfer and
  travels only over Olm. The SFUs learn the two LiveKit identities, the file's
  approximate size and the timing, but not the name or contents.
- **The offer leaks the file's name, size and type** to everyone in the room,
  as an `m.file` message would. In an encrypted room it is encrypted.
- **Who gets the key.** The sender hands a key, and the file, only to a joined,
  non-ignored member's device that passes the sender's own device policy, and
  only to the device that Olm says sent the request. A to-device message that
  arrived unencrypted carries no proof of its sender and is ignored.
- **Room secrecy.** The authorisation service does not check that a LiveKit
  room belongs to a MatrixRTC session, so anyone who learns a transfer room's
  name can join it. Names carry 128 random bits and are sent only over Olm.
  Joining gains nothing: data is addressed to the peer's identity only and is
  encrypted, and packets from any other identity are ignored.
- **Tampering by the SFU.** Additional authenticated data binds every block to
  its transfer, index and the file's size. The file hash catches a receiver
  that mis-stored a block. A receiver keeps the file under its final name only
  after the hash matches.
- **Resource use by the sender.** The offer's `size` is capped at 2^40, which
  bounds the receiver's table of block hashes (32 MiB). The receiver holds at
  most 128 partial blocks, checks a block's exact sealed length before
  allocating it, and cancels after 16 bad blocks.
- **The file name is attacker-controlled.** Receivers MUST strip path
  separators and characters that are invalid in file names before offering it
  as a name to save under, and MUST NOT open the file automatically.
- **Network exposure.** Each device connects only to the SFUs, never to the
  other device. A device does connect to the *other* user's homeserver's SFU,
  which learns its address, as it would in a call.

## Unstable prefix

Until this proposal is accepted, implementations use:

| Stable                        | Unstable                                      |
| ----------------------------- | --------------------------------------------- |
| `m.file_offer`                | `moe.crafty.matrix.file_offer`                |
| `m.file_transfer.request`     | `moe.crafty.matrix.file_transfer.request`     |
| `m.file_transfer.refuse`      | `moe.crafty.matrix.file_transfer.refuse`      |
| `m.file_transfer.accept`      | `moe.crafty.matrix.file_transfer.accept`      |
| `m.file_transfer.ack`         | `moe.crafty.matrix.file_transfer.ack`         |
| `m.file_transfer.finish`      | `moe.crafty.matrix.file_transfer.finish`      |
| `m.file_transfer.done`        | `moe.crafty.matrix.file_transfer.done`        |
| `m.file_transfer.cancel`      | `moe.crafty.matrix.file_transfer.cancel`      |
| `m.file_transfer` (data topic) | `zam.file.v1`                                |
| `m.file_transfer-` (room name) | `zam-transfer-`                              |
| `m.file_transfer.v1\|` (AAD)   | `zam-file-v1\|`                              |

## Dependencies

- [MSC4143](https://github.com/matrix-org/matrix-spec-proposals/pull/4143)
  (MatrixRTC), for discovering the homeserver's LiveKit transport.
- [MSC4195](https://github.com/matrix-org/matrix-spec-proposals/pull/4195)
  (MatrixRTC using LiveKit), for getting a LiveKit token.
- [MSC4576](https://github.com/matrix-org/matrix-spec-proposals/pull/4576),
  which decides whether, and whose, data publishing an SFU allows.

## Reference implementation

Zam (<https://github.com/az4521/Zam>) implements this proposal. The Matrix and
LiveKit side is in `src/lib/matrix/fileTransfer.ts`, the block sender and
receiver in `src/lib/matrix/fileTransferEngine.ts`, and the wire format and
cryptography in `src/lib/utils/fileTransfer.ts`.
