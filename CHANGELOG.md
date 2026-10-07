# Changelog

Human-readable release notes. The `## v<version>` section for the released version is pulled into
the GitHub release body automatically (see `.github/workflows/release.yml`); the auto-generated
commit list is appended below it.

## v1.15.9

🐛 **Fixed**

- **Joined rooms and spaces show up right away:** on servers using sliding sync, a room or space you joined vanished from Browse but didn't appear in your list until a minute later or an app restart. It now appears immediately. The same applies to accepted invites and newly created rooms.

## v1.15.8

🐛 **Fixed**

- **Room and space settings load again:** 1.15.7's Permissions tab could get stuck on "Loading…" forever. Settings now fetch what they need directly, wherever you open them from, and show an error with a Retry button if that fails.
- **Saving access settings no longer changes things you didn't touch:** on servers using sliding sync, history visibility and guest access could show defaults before loading, and saving the tab could write those defaults back. The Access tab now waits for the real values.
- **Space menus only show admin options to admins:** "Space settings" and "Add room" showed for everyone in a space.

## v1.15.7

🐛 **Fixed**

- **Space and room permissions show their real values:** on servers using sliding sync, a space's (or an unopened room's) Permissions tab showed every level as 0. It now loads the real levels first.
- **Saving permissions can no longer wipe everyone's levels:** saving from that screen while the levels hadn't loaded could reset every user's power level, admins included. Changes are now always applied on top of the room's current permissions.

## v1.15.6

🐛 **Fixed**

- **Replies to stickers say what they're replying to:** a reply to a sticker, poll or untitled photo/video/file now shows "Sticker", "Poll", "Image" and so on in its quote, instead of "Original message unavailable".

## v1.15.5

🐛 **Fixed**

- **Thread unread dot clears once you've read it:** on servers using sliding sync, the threads button kept showing unread messages after you'd read them, until you reloaded. Opening the thread (or reading it on another device) now clears it.

## v1.15.4

🐛 **Fixed**

- **New threads show up right away:** after you start a thread, the "replies" chip under its first message now appears immediately instead of only after a refresh.

## v1.15.3

🐛 **Fixed**

- **Stickers as replies:** sending a sticker while you're replying to a message now sends it as a reply to that message, in threads too.

## v1.15.2

🐛 **Fixed**

- **Safer handover of encryption keys in the background (Android):** when Zam hands its keys over to the notification decryptor, it now waits until it has completely finished with them first, instead of a fixed half second. This closes a rare case where the two could both be writing at once.

## v1.15.1

🐛 **Fixed**

- **Encrypted notifications while the app is in the background (Android), properly this time:** 1.15.0's fix didn't work, because Zam's page can't run at all while the app is in the background. Now, about 10 seconds after you leave Zam, it hands its encryption keys over to the part that decrypts notifications, so they show the message. Coming back picks up where you left off, without reloading the app.

## v1.15.0

✨ **New**

- **Thread names:** the person who started a thread, or a moderator, can name it from the pencil button in the thread's header. The name shows in the thread header, the thread list and the "replies" chip under the first message. Other Matrix apps don't show thread names.
- **My threads:** the thread list has an All threads / My threads switch. My threads shows the threads you started or replied in.
- **Reply inside a thread:** Reply now works on messages in a thread, and tapping a quoted message scrolls to it.
- **Export and import room keys:** Settings → Security & Encryption can save your encryption keys to a passphrase-protected file and load one back. It's the same format Element uses, so key files move between the two.
- **Request to join from Explore rooms:** rooms that need an invite request now have a Request to join button instead of a greyed-out "Knock only".
- **Source code link:** Settings → About links to Zam on GitHub.

🐛 **Fixed**

- **Encrypted notifications while the app is in the background (Android):** after Zam had been in the background for more than about half a minute, notifications for encrypted messages only said who sent something. Zam now pauses syncing shortly after leaving the screen so it can answer notifications straight away. On a phone where that still isn't fast enough, Zam steps aside in the background instead, and reloads when you come back to it (your drafts are kept).
- **Thread scrolling:** "Load older replies" no longer jumps you back to the bottom, and new activity elsewhere no longer scrolls a thread you're reading.
- **Missing thread replies:** replies that couldn't be decrypted, and polls started in a thread, were left out of the thread. They now show, with the usual "unable to decrypt" placeholder where needed.
- **The first message of a thread:** the thread panel showed it as three lines of plain text. It now shows in full, with images, formatting and reactions.

## v1.14.2

✨ **New**

- **Notifications for all your accounts in the browser:** with web push on, notifications for the accounts you aren't using now show the sender and message, decrypted, like the active account's, and tapping one switches to that account. Open each account once after updating to turn this on for it.
- **Notifications for all your accounts on desktop:** while the app is open, your other accounts now notify too, within about 30 seconds. Tapping one switches to that account. This also covers browsers without web push.

## v1.14.1

✨ **New**

- **See when an account's notifications are switched off:** another app (such as Element's "Enable notifications for this account") can turn off every notification for an account, and Zam never showed it, so that account just went quiet. Settings → Notifications now warns when this is on, with a button to turn notifications back on, and Debug Info shows it too.

## v1.14.0

✨ **New**

- **Notifications for all your accounts (Android):** with several accounts signed in, notifications for the ones you aren't using now show the sender and message, decrypted, like the active account's. Tapping one switches to that account and opens the room, and Mark as read works from any account. Open each account once after updating to turn this on for it.

🐛 **Fixed**

- **Encrypted notifications on desktop:** with "Show all events" on, notifications for encrypted messages only said "🔒 Encrypted message". They now show the message.
- **Editing the same message twice:** a second `s/old/new/` on a message added a "* " to the start of it, and pressing ↑ to edit your last message did nothing after you had edited it once. Both now edit the message itself.

## v1.13.10

🐛 **Fixed**

- **Encrypted notifications when the app was closed (Android):** with the app swiped away, notifications for encrypted messages still only said who sent something. They now show the message whether or not the app is running.

✨ **New**

- **Gboard stickers and images (Android):** stickers, Emoji Kitchen combos and GIFs from the keyboard can now be sent from the message box. They're added as attachments, like a pasted image.
- **Edit your last message with `s/old/new/`:** sending `s/teh/the/` fixes your last message instead of sending a new one. Add `g` to replace every match or `i` to ignore case, e.g. `s/teh/the/gi`. Works in threads too.
- **Link preview rewriter:** a new built-in plugin that fetches link previews from a different address, e.g. a mirror of a site your homeserver can't reach. The link itself isn't changed. Add rules in its plugin settings.

## v1.13.9

🐛 **Fixed**

- **Invites you couldn't ignore with sliding sync:** clicking Ignore on an invite left it in the inbox forever. It now goes away, and stays gone after a reload.
- **DM invites named "Empty room" with sliding sync:** an invite to a DM showed as "Empty room (was ...)". It's now named after the person who invited you.
- **Left rooms coming back with sliding sync:** a room you left could reappear in the sidebar about 30 seconds later. It now stays gone.
- **Presence with sliding sync:** you showed as offline to others shortly after opening the app, and nobody else's online status showed up. Both now work like they do with sliding sync off.

## v1.13.8

🐛 **Fixed**

- **Encrypted messages unreadable with sliding sync:** with sliding sync on, most messages in encrypted rooms showed "Unable to decrypt" even though the keys were there, and reloading didn't help. They now decrypt like they do with sliding sync off.
- **Pinned messages in encrypted rooms:** pinned messages that weren't already loaded in the timeline showed as encrypted. They're now decrypted.
- **"Show all events" stuck on encrypted:** with the debug option on, messages that decrypted after loading kept showing as `m.room.encrypted` until you left the room.

✨ **New**

- **Why a message couldn't be decrypted:** with "Show all events" on, messages that fail to decrypt now show the reason, to help track down missing keys.

## v1.13.6

🐛 **Fixed**

- **"Set up recovery" could replace your existing recovery:** on accounts that already had a recovery key but weren't fully set up, the button could delete your key backup and show a new key that didn't actually work. It now only appears on accounts with no recovery at all.
- **Restoring history could leave a session unverified:** entering your recovery key restored message history before verifying the session, so a slow or failed restore left it unverified. The session is now verified first.
- **Messages from devices that aren't cross-signed couldn't be read:** "Exclude non-cross-signed devices" is now off by default, and turning it off unlocks messages it had already blocked without a reload.
- **Notifications could damage encryption keys:** decrypting a notification in the background while the app was opening could, rarely, leave both using the key store at once. They now never overlap, and a stuck background decrypt no longer holds the notification back.

## v1.13.5

🐛 **Fixed**

- **Encrypted messages in notifications:** notifications for encrypted messages only said who sent something. They now show the message, on Android and in the browser, even when the app isn't running.

## v1.13.4

✨ **New**

- **Encryption setup on matrix.org:** setting up or resetting recovery on servers that sign you in through an account page, like matrix.org, now works. Instead of asking for a password, Zam sends you to your account page to approve the change, then carries on.
- **Why a message can't be decrypted:** messages you can't read now say why, for example that the sender's device isn't verified, that their identity changed, or that the message was sent before this device signed in, instead of always saying the keys might be missing.

🐛 **Fixed**

- **"Content is not encrypted!" when setting up recovery:** accounts whose encryption had been reset before could never finish setting up recovery. They now can.
- **Names and avatars stuck on placeholders:** with sliding sync on, people who joined a room or changed their name or avatar could keep showing a raw user ID and default avatar. They now update.
- **Verification stalling on "Verifying…":** verifying someone while viewing a different room could lose a step and hang until it timed out. The verification's room now stays fully synced until it finishes.

## v1.13.3

🐛 **Fixed**

- **Images failing to load on Android:** opening the app could make every image load two or three times over, and some stayed broken. Images now load once, with your login, from the start.
- **Freezes on JPEG XL images:** showing a JPEG XL image where it has to be converted could freeze the app for a moment. The conversion now happens in the background.

## v1.13.2

🐛 **Fixed**

- **Messages disappearing after a notification tap:** opening the app from a notification could show the newest messages for a moment, then lose them. They now stay.
- **Stuck on "Reconnecting" on slow connections:** on a slow or weak connection, the app could keep reconnecting forever without catching up. It now gives slow responses more time to arrive, so it gets through and syncs.

## v1.13.1

✨ **New**

- **Notifications without Google (Android):** Zam can now deliver notifications through UnifiedPush, using a distributor app such as ntfy, instead of Firebase. This works on phones without Google Play services. Choose it under Settings → Notifications → Push service. Automatic uses Firebase when it's available, and otherwise the UnifiedPush distributor you have installed.
- **JPEG XL images:** JPEG XL images now display everywhere. The desktop app shows them natively, and elsewhere they're converted on the fly.

🐛 **Fixed**

- **Missing history in busy rooms:** in very active rooms, older messages could disappear after a sync gap, and scrolling up could stop early as if you'd reached the start of the room. History now stays intact and keeps loading.

## v1.13.0

✨ **New**

- **Calls between homeservers:** calls between people on different homeservers (say matrix.org and your own server) now work both ways. Before, whoever joined on the other server's call server could listen but not talk ("failed to publish track, insufficient permissions"). Each person now sends from their own homeserver's call server and listens on everyone else's. Everyone in the call needs this version or newer to hear each other.

🐛 **Fixed**

- **Incoming calls not ringing:** a call to you could stay invisible, with no ring, until you switched rooms and back, even in the room you had open. It now rings straight away.

## v1.12.11

🐛 **Fixed**

- **New messages missing after opening a notification (Android):** tapping a notification could show the room without the message you were notified about, or anything after it. Zam now waits for sync to catch up before jumping to the message.
- **Voice calls failing to start:** starting a call could fail with "fetchClientWellKnown is not a function". Settings also wrongly reported that your server had no call server.
- **Calls showing as "Call ended" right away:** a call you started could show as already ended in the chat and leave you looking like you weren't in it. Calls now show as ongoing until everyone leaves.

🔧 **Changed**

- **Ringing:** calls now ring using the newer call notification format, so calls from Element X and other current clients ring in Zam, including on Android with the app closed. Rings from older Zam versions still ring too, and a ring that arrives after the caller gave up no longer rings.

## v1.12.10

🔧 **Changed**

- **Electron 44:** the desktop app now runs on Electron 44. macOS 12 (Monterey) is no longer supported.
- **Flatpak permissions:** the Flatpak no longer needs read access to your whole home folder. Drag-and-drop now hands files over through the desktop portal instead.

## v1.12.9

🐛 **Fixed**

- **Stuck on "Reconnecting" (sliding sync):** an error while processing an update could stop syncing for good until the app was restarted. Zam now restarts syncing on its own.
- **Messages vanishing after opening a notification:** opening a room from a notification could show the newest messages and then drop them when sync caught up.

🔧 **Debug**

- **Sync log:** Settings → Debug Info now keeps a short sync log you can copy, to help track down connection problems.

## v1.12.8

🐛 **Fixed**

- **Drag-and-drop attachments in the Flatpak:** files dragged in from outside your Downloads folder now upload instead of silently failing.
- **Settings that didn't apply:** the taskbar flash option no longer shows in the browser or on Android, the MIDI "System" sound bank is only offered in the desktop app, and on Android the notification permission row now actually asks for permission instead of saying notifications aren't supported.
- **Classic blurple:** buttons, your own message bubbles and the light theme's accent use classic blurple again instead of Discord's newer, more purple shade.

## v1.12.7

🐛 **Fixed**

- **New messages not showing up:** after a brief network drop, or when coming back to the app (for example from a notification), new messages could take up to two minutes to appear. Zam now reconnects right away.
- **Messages out of order with sliding sync:** when several messages arrived in a room you weren't viewing, the ones in between could end up above older history instead of at the bottom.
- **™ ® ©:** `:tm:`, `:registered:` and `:copyright:` (and picking them from the emoji picker) now insert the plain symbols instead of the emoji versions, and the emoji versions sent from other apps show as plain symbols.

## v1.12.6

🐛 **Fixed**

- **Custom emoji when editing:** custom emoji typed into the edit box now show up as emoji instead of `:text:`, and emoji already in the message are kept.
- **Plugin sync:** pulling your plugin setup now also installs and turns on plugins from repos that you had on your other device, instead of only syncing their settings.
- **`:tm:` and other emoji names:** emoji names work like Discord. Typing `:tm:` turns into ™️ as soon as you type the closing colon, and autocomplete finds emoji by their short name.
- **DM pictures:** direct messages without their own picture now show the other person's avatar.
- **Window size and position:** the desktop app now remembers its size, position and whether it was maximised. On Wayland, the position is still chosen by your desktop.

## v1.12.5

✨ **New**

- **Flatpak:** Zam is now available as a Flatpak from its own repository. Install it from https://az4521.github.io/Zam/ (or with `flatpak install --user https://az4521.github.io/Zam/zam.flatpakref`), and it updates through `flatpak update`. A `.flatpak` file is also attached to each release.

## v1.12.4

🐛 **Fixed**

- **Editing image text on desktop:** the text on a sent image, video, or file could only be edited from the phone menu. The Edit button now shows up on desktop too, and swipe or double-tap to edit works on these messages.

✨ **Changed**

- **Edit in the mobile message bar:** on your own messages, Edit now sits in the quick-actions bar in place of Thread. Thread is still in the ⋯ menu.

## v1.12.3

🐛 **Fixed**

- **Can't edit the text on a sent image:** when you sent an image, video, or file with a message attached, the message text couldn't be edited afterwards. You can now edit it like any other message (and clearing it removes the text while keeping the attachment).

## v1.12.2

🐛 **Fixed**

- **Videos not playing in Tor Browser:** videos in the timeline failed to load in Tor Browser (and briefly after a hard reload) because they depended on a background helper that isn't available there. They now load directly and start playing while they download.

## v1.12.1

🐛 **Fixed**

- **Rooms disappearing when switching spaces:** switching to a space briefly hid its unjoined rooms and the contents of its sub-space categories until they loaded again. The last known list now shows straight away (also right after startup) and refreshes in the background.

## v1.12.0

✨ **New**

- **Calls work like phone calls on Android:** calls keep going with the app in the background or the screen off, and show an ongoing-call notification with Hang up. Calls are registered with Android's calling system, so a Bluetooth headset, your car or a watch can answer, decline and hang up, and the headset's mute button works.
- **Cellular calls put Matrix calls on hold:** answering a phone call mutes the Matrix call both ways instead of fighting over the microphone. Tap Resume in the call view when you're done.
- **Speaker button:** in a call on Android, switch between speaker and earpiece (or your headset). The screen turns off when you hold the phone to your ear, and turning on your camera moves the call to the speaker.
- **Ringing like a phone:** an incoming DM call rings until you answer or decline, wakes the screen and shows over the lock screen. On Android 14 and later, Settings → Voice & Audio offers to allow lock-screen calls if Android hasn't. Pressing a volume key silences the ring without dismissing the call.

🐛 **Fixed**

- **Only DMs ring:** calls in rooms and spaces no longer ring, on Android or with web push. They show a normal notification instead, matching the app.
- **Ringing setting on notifications:** with "Ring for incoming DM calls" turned off, a DM call now shows a quiet notification instead of ringing.
- **Calls answering themselves:** a DM call arriving on a locked phone could join the call without you pressing Accept. It now just rings.
- **Reply and Mark as read on Android 12+:** these notification buttons did nothing. Reply now opens the app and sends your message, and Mark as read works without opening the app, respecting private read receipts.
- **Repeated notification actions:** reopening the app from Recents could re-send a quick reply or re-join a call. Each action now runs only once.

## v1.11.0

✨ **New**

- **Sub-spaces as categories:** inside a space, its sub-spaces now appear as collapsible categories in the room list, nested like a tree, instead of separate spaces you had to switch into. Rooms you haven't joined show up in place with a Join button, and a collapsed category shows an unread dot. Joined sub-spaces no longer take up their own icon on the space bar.
- **Resizable room list:** on desktop, drag the edge of the room list to make it wider or narrower (or use the arrow keys on it; double-click resets). Long room names show in full on hover.
- **Instant room list on startup:** the room list from your last session is shown right away while the app syncs, with both regular and sliding sync, then quietly replaced with the live list. It is deleted when you sign out.
- **MIDI sound bank:** Settings → Messages & media → MIDI lets you choose which sound bank MIDI attachments play with: your system's (desktop), the included one, or your own SF2/SF3/DLS file.

🐛 **Fixed**

- **Reordering spaces:** dragging a space on the space bar sometimes dropped it one slot above where you let go, or sent it to the top, especially near the bottom of the list. It now lands where you drop it.

## v1.10.2

🐛 **Fixed**

- **Messages that looked failed but had sent:** if the app closed right after you sent a message, it could come back marked as failed even though it had been delivered, and when the real message loaded the whole room's chat log could stop showing with a duplicate key error. Delivered messages are now recognised and cleaned up, and a room can no longer be broken by a repeated message.
- **Opening a room from a notification:** tapping a notification could open the room frozen on the notified message, with newer messages never loading. The room now opens in its normal live view when it can, and otherwise keeps loading newer messages until it catches up.
- **Loading older messages:** scrolling to the top of a room sometimes did nothing, with no spinner, even though older messages existed. Failed loads now retry, and reaching the top always asks again.
- **Messages disappearing after switching rooms:** after the app reconnected or resumed while you were in another room, coming back could show only the newest messages with no way to scroll back. Older history loads again as you scroll up.

## v1.10.1

🐛 **Fixed**

- **Space and room emoji with sliding sync:** custom emoji and sticker packs from spaces and other rooms were missing from the picker while sliding sync was on, because only the open room's packs were loaded. Packs now load for every room.

## v1.10.0

✨ **New**

- **Native OAuth 2.0 / OIDC sign-in:** on homeservers that publish an OAuth API (Matrix Authentication Service, e.g. matrix.org), the sign-in form leads with "Continue" and signs you in on the server's own page, using the authorization-code flow with PKCE. Access tokens are short-lived and refresh in the background; the session survives restarts and account switching, and signing out revokes the tokens at the provider. Servers without it keep the password and single sign-on options, and so does a server that refuses to register Zam.
- **Account page link:** on an OAuth account, Settings → Account and Security & Sessions point to your provider's account page for the password, other sessions and deactivation, instead of the in-app forms that can't work there.
- **Single sign-on:** the sign-in form reads the server's login options and offers "Continue with {provider}" or "Continue with SSO" (OIDC, OAuth, SAML, CAS). Password fields are hidden on servers that don't accept passwords. It works on the web, in the desktop app and on Android.
- **Languages:** the whole interface is now translatable. English, French, German and Assyrian Neo-Aramaic (Suret) are included, with a language picker in Appearance settings. Right-to-left languages mirror the layout inside each panel. The translations are machine-drafted and need review by native speakers.
- **Sliding sync:** faster startup and room list on servers that support it, now on by default on the login form. Servers without it fall back to regular sync with a notice. Debug settings show the sync mode and progress.
- **MIDI attachments:** `.mid` files now play. On desktop they use your operating system's sound bank, otherwise a bundled General MIDI bank (Phoenix MT-32 by W.D. Tharinda Perera, credited under Settings → About → Credits), with a simple synth as a last resort.
- **Emote packs:** enable packs for all your rooms and manage them in Settings → Emotes. You can edit a pack's avatar and attribution, delete packs, and copy images into your own pack.
- **Typing indicators:** Settings → Privacy & Safety has a new option to stop sending your typing status.

🔒 **Security**

- Devices that aren't cross-signed are now excluded when encrypting, and you are alerted when someone's cross-signing identity changes, with actions to accept or withdraw. A toggle in Session settings turns the exclusion off for testing.
- Single sign-on: sign-in buttons stay disabled until the typed server address has been checked, and a forged or stale callback link can no longer cancel a real sign-in.

🎨 **Polish**

- Appearance: the layout toggles have their own heading.
- Image uploads now record their dimensions and size.

## v1.9.2

🎨 **Polish**

- Profiles and status: emoji in statuses, bios, pronouns and presence messages now show as the same emoji images as in chat, on the profile card and in the account menu.

## v1.9.1

✨ **New**

- Profile: the timezone picker is now two steps. Choose a region (Europe), then a city (London).

🐛 **Fixes**

- Account menu: setting a status now has a Back button, like the presence and account lists.
- Profile card: a status that this app also writes to your presence message no longer shows twice.

## v1.9.0

✨ **New**

- **Extended profile:** Settings → Account has a new "More about you" section with pronouns, status, bio, timezone, banner, links and username colour. It needs a server that supports extended profiles, and honours the server's rules about which fields you may set.
- **Username colour:** pick one colour for dark themes and one for light. Names in the chat use it, and it falls back to the normal colour when it would be hard to read. Settings → Appearance → Show name colours turns this off.
- **Other people's profiles:** the profile card now shows their banner, pronouns, status, bio, local time and links. A banned user's extra fields are hidden.
- **Call status:** your profile shows "In a call" while you are in a voice call, and other people's cards show how long they have been in one. Settings → Account → Show when I am in a call turns it off. A leftover from a crash is cleaned up on the next start.
- **Account menu redesign:** the menu above your name at the bottom left is now a profile card with your banner, avatar, status and presence. It has Edit Profile, a presence menu and Switch Accounts. Click the bubble beside your avatar to set a status, with an emoji picker.
- **Status in other clients:** your status is also written where Sable and Commet look for it (Commet's status field and your presence message), so it shows up there too.
- Debug: Settings → Debug shows your raw extended profile and presence message as the server returns them.

🐛 **Fixes**

- Presence: a status message you cleared no longer sticks around in the app until you reload.
- Presence: changing your presence (Online, Away, Invisible) no longer wipes your status message on servers that clear it.

## v1.8.5

🐛 **Fixes**

- Chat: ©, ® and ™ now show as normal text instead of black emoji images that were unreadable on the dark background.

## v1.8.4

🐛 **Fixes**

- Windows: the taskbar button shows the Zam icon even when an old or broken Start menu shortcut for the app exists. The app now tells Windows which icon to use instead of relying on that shortcut.

## v1.8.3

✨ **New**

- Desktop: a red dot appears at the top right of the tray icon while you have unread pings, like the browser tab icon.

🐛 **Fixes**

- Desktop: pings now show a system pop-up. Notifications are posted by the desktop app itself, and clicking one brings the window back and opens the room.
- Desktop: the taskbar icon no longer shows as blank in installed builds. The icon files are now unpacked so Windows can read them.

## v1.8.2

✨ **New**

- **Desktop alerts setting:** Settings → Notifications → Desktop alerts chooses which notifications show a pop-up and flash the taskbar: loud only, silent and loud (the default), or none. Silent notifications no longer make the system chime.
- Desktop: the taskbar button flashes (the dock icon bounces on macOS) when a notification or incoming call arrives while the window is in the background.

🎨 **Icons**

- Android: the notification icon is much bigger, filling the status bar slot instead of sitting in a padded box.
- Desktop: the app now has a proper taskbar icon on Windows, with hand-sized icons from 16 to 256 px so small sizes stay crisp everywhere.
- Desktop: the tray icon is the white logo with a black outline, so it shows on light and dark taskbars alike.

## v1.8.1

🔒 **Privacy & security**

- **Attachments you send into an encrypted room are now encrypted:** images, files, videos and voice messages. Encrypted videos, yours and other people's, play in the timeline and the media browser.
- **Plugins with auto-update off stay frozen:** an installed repo plugin is pinned to the exact commit you installed or updated it at, and a cleared cache refetches that same commit. A plugin can't install under the id of a built-in or another repo's plugin.
- Hardened message rendering: an emoji inside a link address can no longer break out of the link.
- Sharing into the web app accepts only same-origin share requests, and caps them at 20 files, 100 MB per file and 200 MB in total. The share sheet says when it dropped files.
- Desktop: the built-in file server handles malformed addresses safely, and links to local or private network addresses no longer open in your browser.

📲 **Sharing & notifications**

- **Share-sheet Send sends only what the sheet shows.** Your unsent draft, staged files and armed reply in that room stay where they were. If the send fails, the share is staged in the composer instead of lost.
- Notification Mark as read respects private read receipts, even with the app closed.
- A quick reply from a notification goes into the thread when the message was in a thread. A reply that fails to send comes back as a draft with an error, and a reply typed with the app closed is kept as a draft for next launch.
- A call ring notification no longer replaces or dismisses a message notification from the same room.

💬 **Messages**

- A failed delete shows an error and the message comes back, instead of vanishing until reload.
- Swiping sideways inside a wide code block scrolls it instead of starting a reply.
- Swiping your own image or file replies instead of trying to edit it.
- Links in your own message bubbles are readable, and the read-receipt button is easier to hit.
- Switching rooms is faster: a message builds its action bar only when you hover, focus or select it.
- Touch scrolling through messages is smoother, because message rows no longer hold up the scroll to check for a swipe.
- Plugins that rewrite your outgoing messages now also apply to thread replies and file captions.

🪟 **Menus & dialogs**

- Escape and the Android back button close only the top overlay: the read-receipt list, What's New, the screen-share quality menu, the who-reacted sheet, plugin popovers and the composer "+" menu now all behave the same way.
- The image and video viewer shows your place in a gallery, such as "2 of 5", and screen readers announce it as you step through.

📞 **Calls**

- Leaving a call while it is still connecting no longer shows an error.
- A call that fails to connect shows one error, not an extra "disconnected" message.
- Changing noise suppression or other mic settings keeps your chosen microphone.
- A failed mic or camera switch goes back to the previous device and tells you.
- Screen-share quality changes apply to the running share, and the lower-quality stream gets its own bitrate. The system-audio toggle says it applies to the next share.
- Kick and Ban from a call tile ask you to confirm first.
- Screen readers announce the status badges on call tiles.
- Joining a call without a usable microphone tells you why: access is blocked, no microphone is connected, or another app is using it.
- Leaving a call is faster, and a camera or screen-share failure that lands after you leave no longer shows an error.
- Voice & Video settings no longer create a new audio context on every call update while you are in a call.

⚙️ **Settings**

- The sidebar and room list no longer clip at large text sizes.
- Deleting a theme preset and removing a plugin ask you to confirm first.
- If a custom font can't be saved on this device, the app tells you.
- The tray settings no longer show on the web, and settings search announces how many results it found.
- In settings search, Escape clears what you typed before it closes settings, and Enter opens the first result.

🧰 **Maintenance**

- Dependency updates within their current versions. Known security advisories went from 22 to 4 low-severity ones.
- Release builds now run type checks, tests and a formatting check first.

## v1.7.4

✨ **New**

- The image viewer shows the file's name in the top-left corner, and hovering an image in chat shows it as a tooltip.

🐛 **Fixes**

- The settings sidebar (app and room settings) scrolls when its tabs don't fit.
- Custom emoji reactions, picker grids, member lists and other homeserver images now load in browsers without service workers, such as Tor Browser.

## v1.7.3

🐛 **Fixes**

- Downloading from the image viewer keeps the original filename instead of saving as "image".
- Downloads with no file extension get the right one added, so they open correctly.

## v1.7.2

🐛 **Fixes**

- Desktop: right-click "Save image as…" now saves the actual image (full size, with its filename) instead of a JSON error file.

## v1.7.1

✨ **New**

- **Rename attachments before sending:** tap a queued file in the composer to edit its filename, like Discord.
- **Right-click menu on desktop:** open or copy links, copy or save images, cut/copy/paste in the composer, and spelling suggestions.

🐛 **Fixes**

- Downloading images and files now works on Android; they save straight to your Downloads folder.
- Ctrl+Z / Ctrl+Y (and Ctrl+Shift+Z) undo and redo in the message box.
- Ctrl+E (emoji), Ctrl+G (GIFs) and Ctrl+S (stickers) open their pickers again, including from a thread's composer.
- The Home button is back to classic blurple.

## v1.7.0

✨ **Animations & UI**

- Subtle fades when you switch rooms and settings tabs, and desktop popovers scale-fade in. Everything respects reduce motion.

📞 **Calls & voice**

- **Device submenus in the call menu:** expandable Input/Output rows let you switch mic and speaker without leaving the menu.
- **Deafen shown on your own tile:** your roster row now carries the deafen icon.
- **Snappier mic meter:** the input level bar uses a fast-attack/slow-release envelope (no more symmetric smear), so it tracks your voice honestly.
- Picking "Default" mid-call now switches to the current system default mic.
- Screen share biases the encoder toward detail and maintaining resolution.
- Leaving a call briefly keeps a solo "Join" affordance (recently-left window) so you can hop back in.
- The screen-share quality popover closes when you stop sharing from the OS.

📲 **Share into Zam**

- Reworked receive flow: a full-screen preview with per-file rows, a caption field, a recent-rooms list, and one-step send. Nothing sends automatically.

⚙️ **Settings & appearance**

- Your **custom font now applies app-wide**, not just to messages.
- Settings tidy-up: link-preview media policy moved to Privacy & Safety, keep-sidebar and hold-to-open moved to Appearance/Messages, and search was reindexed for the new spots.

✨ **Polish & fixes**

- Reverted the in-app top-bar accent tint from 1.6.0.
- Display names drop the disambiguation/Matrix-ID suffix in default mode; per-member ID lines follow the "show Matrix IDs" toggle.
- Rightward row-swipe reliably opens the channel drawer instead of starting a reply.
- Arrow-key roving focus in the room notification options.

## v1.6.0

🖥️ **Screen sharing**

- **Quality picker in the share flow** — choose resolution (720p–4K), FPS (15/30/60) and system audio right where you start a share, and change quality mid-share from your own tile. Your last pick is remembered; the old Settings section is gone.
- **Quality actually applies now** — the chosen resolution/FPS drives the published stream. Previously the stream was always down-encoded to a conservative default no matter what you picked.

⚙️ **Settings overhaul**

- **Grouped settings** — Discord-style sections: **Account** (Account · Security & Sessions · Privacy & Safety), **App** (Appearance · Messages & Media · Notifications · Voice & Video · Emotes), **Advanced** (General · Plugins · Server · About · Debug).
- **Settings search** — type to find any setting; it jumps to and highlights the match.
- **Custom font** — upload your own font (.woff2/.ttf/.otf, one slot, stays on this device) and use it for messages.
- **App-wide text size** — the text-size slider now scales the whole app, not just messages, with a Reset button.
- **Per-room notifications moved home** — set a room's (or a space's, applied to all its rooms) notification level in its own Room Settings. The per-room list in global Settings and the Room Order section are gone (reorder lives in the room list).

📞 **Calls**

- **Call member menu** — switch your mic/speaker mid-call from your own menu, hide someone's video just for you, or mention them in chat. The kick button now says what it does ("Kick … from room").
- **Tile status & animations** — tiles show mute/deafen, local-mute and multi-device badges, and animate in/out on join/leave (respects reduce motion).
- **No more Join flash** — leaving a call alone no longer flashes a bogus "Join Call" button.
- **Device selection honored** — voice/video now uses the exact mic and camera you picked in Settings.
- **"Join calls" permission row** — control who can join calls from room Permissions.

📲 **Share into Zam**

- Zam now appears in the Android share sheet and as a PWA share target. Share text, links or images from any app, pick a room, and review before sending — nothing sends automatically.

✨ **Polish & fixes**

- **What's New** — a one-time popup after updates, plus release notes in Settings → About.
- The image lightbox pages through a burst of image uploads with arrows (and still pages inline images).
- Subtle open animations for dialogs, sheets and the lightbox — all respect reduce motion.
- The top navbar is tinted with your theme's accent color.
- Media device dropdowns are sorted alphabetically.
- Fixes: context menu reopens on a second right-click, participant-menu Profile works (+ volume %), read receipts no longer overlap right-aligned bubbles, reselecting the Plugins tab returns to the plugin list.

## v1.5.1

**Mobile & touch**

- **Swipe to reply / edit** — swipe a message left to reply; swipe your own message further to edit. The button morphs from a reply arrow to a pencil as you go.

**Fixes & platform**

- **Samsung One UI keyboard** — word suggestions work again in the composer.
- **Desktop: minimise-to-tray toggle** — a setting to choose whether the X closes to the tray (default) or quits Zam.

## v1.5.0

🧩 **Plugins (new!)**

- Zam now has a full plugin system. Install plugins from GitHub repos or use the built-ins — all from **Settings → Plugins**. Each plugin has its own settings, and you can optionally sync your enabled plugins + settings across your devices.
- Built-ins: fun slash commands (`/shrug`, `/tableflip`, `/me` …), double-tap-to-reply, a text replacer, and the GIF & sticker pickers.
- Plugins can add slash commands, composer buttons, message actions, custom link embeds, side panels, and keyboard shortcuts — through a documented `zam` API.

🎨 **Appearance**

- **Message text size & font** — set your size and pick a bundled font (Inter, or the high-legibility Atkinson Hyperlegible). Per-device.
- **Right-aligned own messages** — opt into an iMessage/WhatsApp-style layout where your messages sit in a coloured bubble on the right. Off by default; the bubble colour follows your theme.
- A dedicated **Theme** settings tab.

📱 **Mobile & touch**

- **Hold-to-open** the message menu — switch between tap and long-press.
- A **⋯ overflow menu** for the less-used message actions.

🔔 **Notifications**

- Tapping a notification now **jumps to the exact message**, not just the room.
- **Quick-reply and mark-as-read** straight from a notification (web + Android).
- Launching from a notification opens the right room/message even on a **cold start**.
- Unanswered **call rings auto-dismiss** instead of lingering.

🖼️ **Media**

- **Page through a message's images** in the lightbox (arrows / arrow keys).
- **Instagram thumbnails are clickable** now — tap to open the reel.

🧰 **Other**

- **Room / Space ID** field with a copy button in Settings → General.
- A **"+" on the space rail** to create a space; fixed the empty room-header menu.
