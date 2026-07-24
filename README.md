# Svelte Matrix Client

this is my matrix client, it's pretty good and supports desktop, web, and mobile (apk and PWA). no encryption support yet because complicated

Taking suggestions for naming this app, lmk a good one. also open to a new icon/logo

name cant include "chat", "talk" or any simple synonyms of those two, cant contain the names matrix or discord in anyway, not even as a -cord or -trix suffix, and must be unique (no other social media or messaging app with that name)

things left to do:

Messaging

- Collapsible thread UI (lightweight thread viewing and replies are supported)
- Sending voice messages (m.audio recording)
- Location sharing (m.location)
- Slash commands (/me, /shrug, /join, /invite, /kick)

Rooms

- Initiating room upgrades
- Moderation (kick/ban/deleting messages)
- Server admin tools (Synapse admin API)

User

- SSO / OAuth login
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

the default homeserver url for the login page when the app is opened as a
regular website

### INSTALLED_APP_DEFAULT_HOMESERVER

the default homeserver url for the login page when the app is running as an
APK, installed PWA, or Electron app. it defaults to `DEFAULT_HOMESERVER`, so
set it to a different url only when installed apps should use another server
