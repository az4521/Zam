# Svelte Matrix Client

this is my matrix client, it's pretty good and supports desktop, web, and mobile (apk and PWA). no encryption support yet because complicated

Taking suggestions for naming this app, lmk a good one. also open to a new icon/logo

name cant include "chat", "talk" or any simple synonyms of those two, cant contain the names matrix or discord in anyway, not even as a -cord or -trix suffix, and must be unique (no other social media or messaging app with that name)

things left to do:

Messaging

- Message search
- Threads/replies as collapsible threads
- Sending voice messages (m.audio recording)
- Message forwarding
- Polls (m.poll / MSC3381)
- Location sharing (m.location)
- Slash commands (/me, /shrug, /join, /invite, /kick)
- Code block syntax highlighting

Rooms

- Initiating room upgrades
- Room directory / public room search
- Knock to join (requesting access to invite-only rooms)
- Notification badge on browser tab (favicon)
- Moderation (kick/ban/deleting messages)
- matrix.to / matrix: URI link handling
- Server admin tools (Synapse admin API)

User

- User profile editing (display name, avatar)
- User info panel when clicking a member (profile, shared rooms, DM button)
- Presence (online/away/offline status)
- Ignore/block users
- SSO / OAuth login
- Device / session management
- Account settings (password change, deactivation)
- Multi-account / account switcher
- Identity server / 3PID invites (invite by email)
- Custom notification keyword rules UI

Encryption

- E2EE
- Device verification
- Key backup

Media

- Audio / video calling (WebRTC)
- Image gallery / attachment browser
- Better URL previews (Blocked by Tuwunel)

UI / Polish

- Light theme / theme switching
- Empty-state illustrations
- First-run / onboarding flow
- Accessibility audit (focus trapping, ARIA)

feel free to try it out :) i host a copy at https://matrix.crafty.moe/ and you can find installable versions on the [releases page](https://github.com/az4521/svelte_matrix_client/releases/latest)

also installable as a progressive webapp, which is how i recommend iOS users use this app since i don't want to buy a macbook, iphone, and pay $100/yr to develop ios apps

for devs, same install process as every other js app

```
git clone https://github.com/az4521/svelte_matrix_client.git
cd svelte_matrix_client
npm i
npm run dev
```

if you wanna serve this, run `npm run build` and copy the files in build/ into a web directory. it's all static files so there's no backend to run unless you're planning to run your own instance of sygnal for push notifications

---

## Editing src/lib/config.ts

### DEFAULT_HOMESERVER

this is fairly obvious, it's the default homeserver url for the login page

### INLINE_MEDIA_HOSTNAMES

this is an array of "safe" hostnames that the client can fetch media from directly without going through the matrix homeserver url preview endpoint

### IG_PROXY

this is a simple proxy that removes CORS headers from vxinstagram. you can set one up with the following nginx config

```
location /igproxy/ {
    proxy_pass https://vxinstagram.com/;
    proxy_set_header Host vxinstagram.com;
    proxy_set_header Referer https://vxinstagram.com/;
    proxy_ssl_server_name on;

    add_header Access-Control-Allow-Origin "*";
    add_header Access-Control-Allow-Methods "GET";

    # Strip cookies/auth from the proxied response
    proxy_hide_header Set-Cookie;
    proxy_hide_header Authorization;
}
```
