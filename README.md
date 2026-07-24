# Zam Matrix Client

this is Zam, a Matrix client for desktop, web, and mobile (APK and PWA)

it's pretty good

feel free to try it out :) a copy is hosted at https://matrix.crafty.moe/ which you can install as a progressive webapp (the recommended way to install this client on iOS)

you can find other packaged versions on the [releases page](https://github.com/az4521/svelte_matrix_client/releases/latest)

things left to do:

Rooms

- Initiating room upgrades
- Server admin tools (Synapse admin API)

User

- SSO / OAuth login
- Identity server / 3PID invites (invite by email)
- Custom notification keyword rules UI

Media

- Image gallery / attachment browser

UI / Polish

- Empty-state illustrations
- First-run / onboarding flow
- Accessibility audit (focus trapping, ARIA)

App

 - Working Auto-update for Electron and APK builds

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

the default homeserver url for the login page when viewed as a webapp. currently set to https://matrix.crafty.moe

### INSTALLED_APP_DEFAULT_HOMESERVER

the default homeserver url for the login page when installed as a pwa, electron app, or apk. currently set to https://matrix.org
