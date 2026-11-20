# AGENTS.md

This file provides guidance to coding agents working with code in this repository.

**Zam** is a Discord-like Matrix client: SvelteKit (adapter-static, no SSR) + Svelte 5 runes +
TypeScript + Tailwind, built on matrix-js-sdk (rust-crypto) and livekit-client. One static build
ships to the web/PWA, Electron (`electron/`), and Android via Capacitor (`android/`).

**Read [ARCHITECTURE.md](ARCHITECTURE.md) before non-trivial work.** It is the authoritative
design document (data flow, SDK boundary, stores, UI slot system, subsystems such as E2EE, calls,
push, service worker, plugins, updates). This file only summarises what you need most often.

## Commands

```bash
npm run dev            # Vite dev server on :5173
npm run dev:https      # HTTPS on :5443 (needed for service worker / web push work)
npm run check          # svelte-kit sync + svelte-check (types)
npm run test           # Vitest, run once (jsdom)
npx vitest run src/lib/utils/foo.test.ts   # single test file
npx vitest run -t "name of test"           # single test by name
npm run lint           # prettier --check . (no ESLint); CI fails on this
npm run format         # prettier --write .
npm run build          # static output in build/
npm run i18n:missing   # strings each locale lacks (optionally: -- ja)
npm run electron:build # desktop package (electron-builder)
npx cap sync android   # then build in Android Studio
```

CI (`.github/workflows/release.yml`) runs `check`, `test` and `lint` in a `verify` job that gates
the Android and desktop builds. Run `npm run lint` (or `format`) before committing.

`npm run build` also runs guard scripts that fail the build:

- `scripts/check-no-emdash.mjs`: no em dash (U+2014) in any user-facing string under `src/`
  (comments are fine).
- `scripts/check-active-session-sync.mjs`: `MAX_FUTURE_SKEW_MS` / `MAX_GRACE_MS` in
  `src/lib/utils/activeSession.ts` are hand-mirrored in `static/sw.js` and
  `android/.../MatrixMessagingService.java`; change all three together.

The production CSP lives in `svelte.config.js` and is applied only at build time, so the dev server
proves nothing about CSP (test with the built output, e.g. the `static-build` entry in
`.claude/launch.json`).

## Architecture essentials

- **One route.** `src/routes/+page.svelte` switches between Splash / LoginView / AppShell and owns
  session restore. `/app` is only a redirect stub. The app itself is
  `src/lib/components/layout/AppShell.svelte`, which registers all SDK subscribers and owns global
  keyboard and back-button handling (`onWindowKeydown`).
- **SDK boundary.** `src/lib/matrix/client.ts` wraps matrix-js-sdk and re-exports the LiveKit call
  engine. Everything else imports SDK _types_ only. Sanctioned exceptions: `runtime.ts` (client
  slot + generation counter), `crypto.ts` (all E2EE), `media.ts`, `livekitCall.ts`,
  `slidingSync.ts`, `roomHealing.ts`, `pluginHost.ts`, `pushRules.ts`/`notifications.ts`,
  `privateAccountData.svelte.ts` (the encrypted account data key and gossip). Add new
  SDK capabilities as thin wrappers in `client.ts`.
- **Data flow.** SDK events → `client.ts` `on*` helpers (return an unsubscribe; always call it) →
  `$state` stores in `src/lib/stores/*.svelte.ts` → components. No `svelte/store`.
- **Tick pattern.** SDK objects mutate in place, so stores expose monotonic counters
  (`roomsTick`, `timelineTick`, ...). Handlers bump a tick; components read it inside `$derived`
  so it re-runs. Load-bearing; a missing tick read means a stale UI.
- **Async ownership.** Multi-await code must re-check it still owns the client:
  `const owner = captureClient()`, then `ownedClient(owner)` / `ownedClientOrThrow(owner)` after
  each await (`runtime.ts`).
- **UI slots.** Modals, sidebars and sub-pages go through `interfaceState`
  (`interface.svelte.ts`): `openModal`/`openSidebar` return a token, release with
  `clear*IfOwner(token)`, render from the slot. No ad-hoc `showX` booleans. Escape/back walk
  sub-page → modal → sidebar.
- **Sessions.** Accounts live in the registry (`accounts.svelte.ts`); per-account localStorage
  keys go through `src/lib/utils/scopedStorage.ts`. Never persist session data by hand.
- **Sliding sync.** The main homeserver target is tuwunel; it matches `required_state` types
  literally (no `*` wildcard), so every state type the app needs must be listed in
  `SLIDING_ROOM_STATE` / `SLIDING_LIST_STATE`.
- **Plugins** (`src/lib/plugins/`) extend but never gate rendering of any inbound event; they use
  the `zam` host API, and only `hostApi.ts` / `pluginBoot.ts` reach `client.ts`.

## Rules that bite

- Never call an SDK send/receipt function unguarded inside a tracked `$effect` (it causes
  `effect_update_depth_exceeded`); wrap in `untrack()` and make it idempotent.
- Untrusted HTML goes through `sanitizeMatrixHtml()` before `{@html}`; never `{@html}` a raw
  reaction key or interpolate remote content into a style string.
- Failures surface through the toast store (`toasts.svelte.ts`); optimistic updates roll back.
- The timeline is a plain chronological flex column; do not reintroduce `flex-col-reverse`.
- `{@const}` must be an immediate child of a block, not a plain element.
- Some targets are old WebViews / iOS Safari: see `src/lib/polyfills.ts`; avoid regex lookbehind
  and anything needing `unsafe-eval`.

## Testing

Vitest + jsdom with the Svelte plugin, so `.svelte.ts` rune stores are testable. Tests are
colocated as `<name>.test.ts`. There are no component tests: extract logic from components and
`client.ts` into pure modules in `src/lib/utils/` with a test, and verify UI/SDK wiring live in the
browser (a green suite does not prove `.svelte` wiring).

## i18n

User-facing strings live in `src/lib/i18n/en.ts` and are used via `t("area.key", params)`; never
hardcode UI text. When adding a string, add translations to every catalogue in
`src/lib/i18n/locales/` (de, es, fr, ja, pt, ru, uk, zh) in the same change; skip `aii.ts`.

## Commits and releases

Conventional commit subjects (`feat(scope): ...`, `fix: ...`). A release is a separate
`chore(release): X.Y.Z - <summary>` commit that bumps the version
(`npm version X.Y.Z --no-git-tag-version`) and adds a `## vX.Y.Z` section at the top of
`CHANGELOG.md` (emoji headings like `✨ **New**` / `🐛 **Fixed**`, user-facing bullets). Pushing
to `master` publishes when that version has no release yet; no tags needed.

Never commit personal names, emails or home-directory paths; use placeholders.
