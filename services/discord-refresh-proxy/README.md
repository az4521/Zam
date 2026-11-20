# Zam Discord refresh proxy

A small, stateless HTTP service that refreshes expired Discord attachment links.

## Why this exists

Discord attachment links on the CDN (`cdn.discordapp.com`, `media.discordapp.net`) carry
signed query parameters: `ex` (expiry), `is` (issued at) and `hm` (signature). Once `ex` passes,
the link stops working. A GIF saved as a Discord favourite therefore goes dead after a while.

Discord has an endpoint that exchanges an expired link for a fresh signed one,
`POST https://discord.com/api/v10/attachments/refresh-urls`. That endpoint needs authentication,
so the Zam desktop app cannot call it directly. This service holds a Discord bot token, calls
the endpoint on the app's behalf, and returns the fresh URLs.

The service keeps no state and stores nothing. Each request is forwarded once to Discord.

**Unverified:** whether Discord accepts a bot token on `refresh-urls` is not confirmed. The
endpoint is documented for bot and user tokens, but this has not been tested against a live
bot. If Discord rejects the token you will get a `502` with `"status": 401` or `403`.

## API

### `GET /health`

Returns `200 {"ok":true}`.

### `POST /refresh`

Request body (JSON, at most 64 KiB):

```json
{ "urls": ["https://cdn.discordapp.com/attachments/...?ex=...&is=...&hm=..."] }
```

- `urls` must be an array of 1 to 50 strings.
- Each URL must be at most 2048 characters, use `https:`, have host `cdn.discordapp.com` or
  `media.discordapp.net`, and have a path starting with `/attachments/` or
  `/ephemeral-attachments/`.

Responses:

| Status | Body                                              | Meaning                                                                                                                     |
| ------ | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 200    | `{"urls":[{"original":"...","refreshed":"..."}]}` | Refreshed links. Entries whose refreshed URL is not an https Discord CDN link are dropped.                                  |
| 400    | `{"error":"bad-json"}`                            | Body is not JSON.                                                                                                           |
| 400    | `{"error":"bad-request"}`                         | `urls` is missing, not an array, empty, or has more than 50 entries.                                                        |
| 400    | `{"error":"bad-url"}`                             | A URL fails validation.                                                                                                     |
| 413    | `{"error":"too-large"}`                           | Body is over 64 KiB.                                                                                                        |
| 429    | `{"error":"rate-limited","retryAfter":<seconds>}` | Discord rate limited the bot. `retryAfter` is taken from Discord's `retry_after` or `Retry-After` header and may be absent. |
| 502    | `{"error":"upstream","status":<code>}`            | Discord returned another error.                                                                                             |
| 502    | `{"error":"unreachable"}`                         | Network failure, or Discord did not answer within 15 seconds.                                                               |

Unknown paths return `404 {"error":"not-found"}`. A wrong method on a known path returns `405`.

## Setup

1. Open the [Discord Developer Portal](https://discord.com/developers/applications) and create an
   application.
2. Under **Bot**, add a bot and copy its token. The bot does not need to join any server, and it
   needs no privileged intents.
3. Keep the token secret. Anyone with it can act as the bot.

## Configuration

| Variable            | Default         | Description                                                                     |
| ------------------- | --------------- | ------------------------------------------------------------------------------- |
| `DISCORD_BOT_TOKEN` | none (required) | Bot token. The process exits at start if it is missing.                         |
| `PORT`              | `8787`          | Port to listen on.                                                              |
| `HOST`              | `0.0.0.0`       | Address to bind.                                                                |
| `ALLOWED_ORIGINS`   | `*`             | Comma-separated origins allowed by CORS, for example `https://app.example.com`. |

## Running

Node 18 or later, no install step needed:

```bash
export DISCORD_BOT_TOKEN="paste-your-token-here"
node server.mjs
```

Tests:

```bash
node --test
```

Docker:

```bash
docker build -t zam-discord-refresh-proxy .
docker run -d --name refresh -p 8787:8787 \
    -e DISCORD_BOT_TOKEN="paste-your-token-here" \
    zam-discord-refresh-proxy
```

systemd unit (adjust the paths and user):

```ini
[Unit]
Description=Zam Discord refresh proxy
After=network-online.target

[Service]
ExecStart=/usr/bin/node /opt/zam-discord-refresh-proxy/server.mjs
EnvironmentFile=/etc/zam-discord-refresh-proxy.env
User=zam-refresh
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

The environment file holds `DISCORD_BOT_TOKEN=...`, readable only by the service user.

## HTTPS

The Zam app should reach the service over HTTPS. A reverse proxy such as Caddy handles
certificates automatically. Example `Caddyfile`:

```
refresh.example.com {
    reverse_proxy 127.0.0.1:8787
}
```

## Security notes

- The token is read only from the `DISCORD_BOT_TOKEN` environment variable. It is never logged,
  and request bodies are not logged.
- The service refreshes links for anyone who can reach it. Restrict access with a firewall, a
  reverse-proxy authentication rule, or by binding `HOST` to a private address, if you want that.
- CORS is not access control. `ALLOWED_ORIGINS` only tells browsers which pages may read
  responses. Anyone can send requests with `curl`.
- All users of the service share the bot's rate limit. Heavy use by one user can slow down
  everyone else, and Discord may return `429`.
- Only Discord CDN links are accepted, so the service cannot be used as a general proxy.

## Connecting the Zam app

In Zam, open **Settings > Messages & Media > GIFs** and paste the base URL of your service into
the **Discord refresh service** field, for example `https://refresh.example.com`. Do not add a
path.
