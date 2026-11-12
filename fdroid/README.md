# F-Droid repository

Built by the `fdroid` job in `.github/workflows/release.yml` and published
with the Flatpak repo on GitHub Pages: `https://<owner>.github.io/<repo>/fdroid/repo`.
It indexes the signed release APKs of the last five releases.

## Signing

The index is signed with the Android APK signing key, so the job needs no
secrets of its own: it uses `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD`. Without them the job is skipped.
Unsigned release APKs are not indexed.

Clients pin the key's fingerprint when the repo is added, so rotating the APK
key means everyone re-adds the repo (they would have to reinstall the app then
anyway). To give the index its own key later, set `keystore`/`repo_keyalias` in
`config.yml` and the job's secrets accordingly.

The release after this lands publishes the repo; its page shows the address and
fingerprint.
