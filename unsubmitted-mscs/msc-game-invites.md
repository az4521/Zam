# MSCXXXX: Game invites

Players tell their friends "join me" all the time, and chat clients have no
shared way to carry it. Steam, Discord and others each have their own invite
flow, but they run inside that service. In a Matrix room the invite is a
pasted address that most clients show as plain text, with no hint of what it
launches or whether it is safe to click.

This proposal defines a game invite as an ordinary text message. Its body is a
link that starts the game, so every client shows something useful. The message
also carries a structured description of the invite, so a client that knows
about invites can show a card with the game's name and icon and a Join button,
and can ask before it launches anything.

## Proposal

### Overview

A game invite is an `m.room.message` event with `msgtype` `m.text`:

- `body` is a human-readable sentence that ends with a launch link. A client
  that knows nothing about invites shows this, and may make the link
  clickable.
- A new content key, `m.game_invite`, holds the structured invite. A client
  that understands it MAY show the invite in place of `body`.

Nothing else about the message changes. It is sent, edited, replied to,
redacted and notified about like any other text message, and it is encrypted
whenever the room is.

This proposal defines one kind of invite, for games on Steam. Other kinds can
be added later as further keys beside `steam` inside `m.game_invite`.

### `m.game_invite` content key

An object with the following keys:

- `app`: **Required, Object**. The game.
  - `name`: **Required, String**. The game's name, 1 to 100 characters.
  - `source`: **Required, String**. `steam`. A client that does not know the
    value MUST NOT show a Join button.
- `steam`: **Required, Object**. How to join, for `source` `steam`.
  - `app_id`: **Required, String**. The game's Steam app ID, digits only, 1 to
    20 characters.
  - `connect`: **Required, String**. The command-line arguments Steam passes to
    the game on launch (for example a server address or a lobby), 1 to 512
    characters, with no control characters (U+0000 to U+001F and U+007F).
  - `icon`: **Optional, String**. The hash of the game's Steam icon: exactly 40
    lowercase hexadecimal characters.
- `details`: **Optional, String**. What the sender is doing in the game, up to
  200 characters.
- `state`: **Optional, String**. The game's own status line, up to 200
  characters.
- `party_size`: **Optional, [Integer, Integer]**. Players now in the party and
  the most it holds, each from 0 to 1,000,000.
- `note`: **Optional, String**. A message from the sender, up to 500
  characters.

A receiver MUST treat the whole key as untrusted, because the sender chooses
what the Join button runs. If any field is missing, has the wrong type, or is
outside its limits, the receiver MUST ignore the key and show the message as
ordinary text. It MUST NOT show part of an invite.

The key is read from the original event. A receiver MUST ignore it in the
`m.new_content` of an edit, so an edit cannot change an invite that others
have already seen.

An example:

```json
{
  "msgtype": "m.text",
  "body": "Alice invited you to join Team Fortress 2: steam://run/440//%2Bconnect%2010.0.0.1%3A27015/",
  "m.game_invite": {
    "app": { "name": "Team Fortress 2", "source": "steam" },
    "steam": {
      "app_id": "440",
      "connect": "+connect 10.0.0.1:27015",
      "icon": "e3f595a92552da3d664ad00277fad2107345f743"
    },
    "details": "Payload",
    "state": "Map: pl_upward",
    "party_size": [3, 24],
    "note": "we need a medic"
  }
}
```

### The `body`

The body is `<sender> invited you to join <game>: <link>`, where `<link>` is

```
steam://run/<app_id>//<connect>/
```

with `connect` percent-encoded as one URI component. This is Steam's "run with
arguments" link, the same one Steam itself uses to start a game from a friend's
invite. The body is text in the sender's language; receivers MUST NOT parse it.
A receiver that understands `m.game_invite` uses the structured key, never the
body, to decide what to launch.

### Showing an invite

A client that understands `m.game_invite` SHOULD show the game's name, the
`details`, `state`, `party_size` and `note`, and the game's icon when `icon` is
present and loads. The icon is at

```
https://shared.fastly.steamstatic.com/community_assets/images/apps/<app_id>/<icon>.jpg
```

and a client that cannot load it SHOULD fall back to a generic game icon. The
hash is part of an address, which is why `icon` is limited to 40 hexadecimal
characters.

### Joining

A client MUST NOT launch anything without the user's say-so on that invite.
Before launching, it MUST show the game and the exact arguments it will pass
(`connect`), as plain text, and ask the user to confirm. It then opens
`steam://run/<app_id>//<connect>/`, built only from the validated parts and
never from `body`.

A client that cannot launch games, such as a web client, SHOULD say so instead
of showing a Join button.

### Sending an invite

A client can offer an invite for a game the user is running, when it knows both
the game's Steam app ID and the arguments another player needs to join. Steam
publishes these as the game's `connect` rich presence key, which is what Steam's
own "Join Game" uses. A client MUST NOT send an invite without an action from
the user for that invite.

The `connect` string usually holds a server address or a lobby ID, and the body
repeats it in the link, so everyone who can read the message can read it. A
client SHOULD make this clear to the sender.

## Potential issues

- Non-supporting clients show the link as text. Many will not make a
  `steam://` link clickable, and some that do will open it without any
  confirmation. The invite works for a player of a supporting client, and
  degrades to a link the receiver can copy.
- A `connect` string has no single meaning. For each game it is whatever the
  game expects on its command line. The receiver cannot check it, which is why
  confirmation is mandatory.
- A Steam invite names a running game, not a game's state. An address or lobby
  can be stale by the time a receiver acts on it.
- The icon address depends on Steam's CDN. A receiver that loads it tells
  Steam's CDN that someone viewed that game's invite.

## Alternatives

### A custom event type

An event type of its own would not show up at all in clients that do not know
it, and would need the same changes to notifications, previews and search that
text messages already have. A text message with an extra key costs those
clients nothing, and the invite still reads as a sentence.

### Only a link

A message that is only `steam://run/...` is simple, and works with no new
specification. But a client can then show only what the link holds: the app ID
and the arguments. It cannot show the game's name, the party, or a note
without looking them up, and it has no way to tell an invite from any other
pasted link, so a client cannot safely confirm "launch this game with these
arguments" for arbitrary links in the chat.

### Discord invites

Discord's rich presence can carry a join secret, but that secret is delivered
by Discord's own client to a game that is already running and subscribed, over
a connection the game opens to the local Discord. There is no link that carries
it, so an invite cannot be made readable to every client. Games that support
Discord's invites also report to Steam, so this proposal leaves them out.

### Extensible events

Describing the invite as content blocks of an extensible event
([MSC1767](https://github.com/matrix-org/matrix-spec-proposals/pull/1767)) would
follow where the spec is heading. This proposal stays as a text message so it
works today, and can be moved to blocks without changing what an invite means.

## Security considerations

The sender decides what a Join button does, so the whole key is untrusted.

- **Arguments.** `connect` becomes command-line arguments to a game. A game
  may treat some arguments as commands. The receiver therefore shows the
  arguments and asks before every launch, and does not launch from `body`.
- **Control characters.** `connect` is shown to the user and passed to the
  launcher, so control characters, which can hide or split text, are rejected.
- **Launcher link.** The `steam://run/...` link is built only from an app ID
  of digits and a percent-encoded `connect`, so nothing else a sender writes
  can reach the operating system's link handler.
- **Icon address.** `icon` is a 40-character hash and is used only to form the
  fixed Steam address above, so a sender cannot point the image at another
  host.
- **Notes and names.** Names, details, state and notes are shown as plain
  text, never as markup.
- **Edits.** The key is read from the original event only, so a later edit
  cannot swap in different arguments.
- **Privacy of the address.** A `connect` string may reveal a server address
  or a lobby, and the link repeats it in `body`. Everyone in the room, and
  every server that stores the event, can read it. A sender should invite only
  into rooms they would share that address with.

## Unstable prefix

Until this proposal is accepted, implementations use the unstable key
`moe.crafty.matrix.game_invite` in place of `m.game_invite`.

## Dependencies

None. An invite is a text message ([`m.room.message`](https://spec.matrix.org/latest/client-server-api/#mroommessage))
with one extra content key.

## Reference implementation

Zam (<https://github.com/az4521/Zam>) implements this proposal. The content
format and its checks are in `src/lib/utils/gameInvite.ts`, sending in
`src/lib/matrix/gameInvite.ts`, the invite card in
`src/lib/components/messages/GameInviteCard.svelte`, and the launcher link in
`electron/steamUrl.cjs`.
