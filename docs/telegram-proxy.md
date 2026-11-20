# Telegram sticker proxy

Zam can import a Telegram sticker pack without the user having a Telegram bot.
By default the client asks a small proxy on the Zam server, which holds the bot
token and forwards the two Bot API calls the importer needs. A user who wants
to avoid the proxy can still type their own bot token, and that token is used
directly against `api.telegram.org`.

## Why

The importer needs two Bot API methods, `getStickerSet` and `getFile`, plus the
file download. Those calls need a bot token. Asking every user to create a
BotFather bot just to copy a sticker pack is a poor experience, so the token
lives on the server and the client only needs the proxy URL.

## How the client chooses a route

- A bot token typed into the "Use my own bot token" section always wins. The
  client calls `api.telegram.org` with that token.
- Otherwise, when a proxy URL is configured, the client calls the proxy.
- If the proxy answers 403 (key rejected), 502, 503 or 504, or the request
  fails at the network level, and no sticker has been imported yet, the
  importer stops. It shows "The built-in sticker service is unavailable right
  now" and opens the own-token section as the fallback.
- A failure after some stickers were imported keeps those stickers and counts
  the rest as failed. It does not switch routes.
- Telegram's own errors (an unknown pack name, for example) are shown as before
  and never trigger the fallback.

## Server: nginx

The proxy is two nginx locations on the existing Zam host. The bot token and the
key live in a secret file that is not in the repository:

`/etc/nginx/secrets/zam-telegram.conf` (mode 0640, owned by root, readable by nginx):

```nginx
set $tg_token "<BOT_TOKEN_FROM_BOTFATHER>";
set $tg_key "<PROXY_KEY>";
```

`limit_req_zone` and `proxy_cache_path` are only valid in the `http` context,
not inside a `server` block. Put them in their own file that nginx includes
under `http`, for example `/etc/nginx/conf.d/zam-telegram.conf`:

```nginx
limit_req_zone $binary_remote_addr zone=tg:10m rate=5r/s;
proxy_cache_path /var/cache/nginx/tg levels=1:2 keys_zone=tgcache:10m max_size=2g inactive=7d;
```

Create the cache directory too (`sudo mkdir -p /var/cache/nginx/tg` and give it
to the nginx user). The two locations go inside the Zam `server` block
(placeholders only):

```nginx
location ~ ^/tg/api/(getStickerSet|getFile|getCustomEmojiStickers)$ {
    limit_req zone=tg burst=20 nodelay;
    include /etc/nginx/secrets/zam-telegram.conf;
    if ($arg_k != $tg_key) { return 403; }
    if ($request_method !~ ^(GET|OPTIONS)$) { return 405; }
    rewrite ^/tg/api/(.*)$ /bot$tg_token/$1 break;
    proxy_pass https://api.telegram.org;
    proxy_ssl_server_name on;
    proxy_set_header Host api.telegram.org;
    proxy_hide_header Access-Control-Allow-Origin;
    add_header Access-Control-Allow-Origin * always;
}
location ~ ^/tg/file/(?<fp>[A-Za-z0-9_-]+/[A-Za-z0-9_.-]+)$ {
    limit_req zone=tg burst=20 nodelay;
    include /etc/nginx/secrets/zam-telegram.conf;
    if ($arg_k != $tg_key) { return 403; }
    rewrite ^ /file/bot$tg_token/$fp break;
    proxy_pass https://api.telegram.org;
    proxy_ssl_server_name on;
    proxy_set_header Host api.telegram.org;
    proxy_cache tgcache;
    proxy_cache_valid 200 7d;
    proxy_hide_header Access-Control-Allow-Origin;
    add_header Access-Control-Allow-Origin * always;
}
```

Notes on the config:

- The `api` location passes the `name` and `k` query parameters through to
  Telegram. Telegram ignores `k`, so this is harmless.
- The `file` location's `rewrite` drops the query string, so `k` never reaches
  Telegram. The key is checked before the rewrite.
- The file location caches successful downloads for seven days. Sticker files
  do not change under a given `file_path`.
- Reload with `nginx -t && systemctl reload nginx` after changing the secret.
- nginx access logs record the `k` query parameter. If that matters, add a
  `map` that blanks `$arg_k` for the log format, or turn off access logging for
  the `/tg/` locations.

## Build: environment variables

The client reads two Vite variables at build time:

| Variable | Default | Meaning |
| --- | --- | --- |
| `VITE_TG_PROXY_URL` | `https://zam.crafty.moe/tg` | Proxy base URL, no trailing slash needed. An empty value also uses the default. Set it to `off` to turn the proxy off, so only the own-token flow remains. |
| `VITE_TG_PROXY_KEY` | empty | Value sent as `k`. When empty, no `k` parameter is sent, which only works if the server has no key check. |

For local builds, put them in `.env.local` (not committed):

```sh
VITE_TG_PROXY_URL=https://zam.example.org/tg
VITE_TG_PROXY_KEY=<PROXY_KEY>
```

For released builds, store them as repository secrets `TG_PROXY_URL` and
`TG_PROXY_KEY`; the release workflow passes `secrets.TG_PROXY_*` to each build
step's `env:`. They are compiled into the bundle, so the key is not truly
secret, but keeping it out of the public repository settings still helps.

## Risks

- The key is deterrence only. It is compiled into every client bundle, so anyone
  who downloads the app can read it. It stops casual use of the proxy, not a
  determined one. Rotate it by changing the secret file and the repository
  variable together, then release.
- The proxy is an open sticker fetcher. Anyone with the key can fetch any sticker
  set and any file the bot can reach. The rate limit (5 requests per second per
  IP, burst 20) bounds abuse but does not stop a distributed one.
- The bot token grants full control of the bot. If it leaks (from the secret file,
  a server backup, or a log), rotate it in BotFather with `/revoke`, update
  `$tg_token` in the secret file, and reload nginx.
- Telegram's terms apply to the bot. Keep traffic within the rate limit and do
  not turn the proxy into a general-purpose Telegram gateway.
