// The UI string catalogue: every user-facing string in the app, in English.
// Keys are `<area>.<slug>`; `common.*` holds strings shared by several areas.
// Placeholders are `{name}`; counts use `{n, plural, one {...} other {...}}`.
// Other languages (see ./aii.ts) must use the same keys and placeholders.

export const en = {
    // Shared
    "common.turnOffCamera": "Turn off camera",
    "common.turnOnCamera": "Turn on camera",
    "common.stopSharing": "Stop sharing",
    "common.shareYourScreen": "Share your screen",
    "common.joining": "Joining…",
    "common.join": "Join",
    "common.closeDialog": "Close dialog",
    "common.settings": "Settings",
    "common.searchResults": "Search results",
    "common.default": "Default",
    "common.mute": "Mute",
    "common.saving": "Saving…",
    "common.unblock": "Unblock",
    "common.block": "Block",
    "common.closeMenu": "Close menu",
    "common.openRoomList": "Open room list",
    "common.uploading": "Uploading…",
    "common.uploadImage": "Upload Image",
    "common.emoji": "Emoji",
    "common.decline": "Decline",
    "common.invitePeople": "Invite People",
    "common.close": "Close",
    "common.cancel": "Cancel",
    "common.loading": "Loading…",
    "common.loadMore": "Load more",
    "common.notifications": "Notifications",
    "common.save": "Save",
    "common.topic": "Topic",
    "common.videoRoom": "Video room",
    "common.reasonOptional": "Reason (optional)",
    "common.actions": "Actions",
    "common.copy": "Copy",
    "common.remove": "Remove",
    "common.add": "Add",
    "common.starting": "Starting…",
    "common.verify": "Verify",
    "common.removeFromFavourites": "Remove from favourites",
    "common.addToFavourites": "Add to favourites",
    "common.stickers": "Stickers",
    "common.retry": "Retry",
    "common.delete": "Delete",
    "common.checking": "Checking…",
    "common.gifs": "GIFs",
    "common.dragOrUseArrowKeysTo": "Drag or use arrow keys to resize",
    "common.resizePicker": "Resize picker",
    "common.noResults": "No results",
    "common.memberCount": "{count, plural, one {# member} other {# members}}",
    "common.replyCount": "{count, plural, one {# reply} other {# replies}}",

    // src/lib/components/settings/AboutSettings.svelte
    "aboutSettings.automaticUpdates": "Automatic updates",
    "aboutSettings.version": "Version",
    "aboutSettings.currentVersionV": "Current version v{APP_VERSION}",
    "aboutSettings.checkForUpdates": "Check for updates",
    "aboutSettings.updateAvailable": "Update available",
    "aboutSettings.reloading": "Reloading…",
    "aboutSettings.update": "Update",
    "aboutSettings.reloadToUpdate": "Reload to update",
    "aboutSettings.youReOnTheLatestVersion": "You’re on the latest version.",
    "aboutSettings.troubleshooting": "Troubleshooting",
    "aboutSettings.clearCacheAndResync": "Clear cache and resync",
    "aboutSettings.reDownloadsYourRoomsFromThe":
        "Re-downloads your rooms from the server. Fixes rooms that are missing or stuck. You stay signed in.",
    "aboutSettings.resyncing": "Resyncing…",
    "aboutSettings.clearCache": "Clear cache",
    "aboutSettings.updateCheckFailed": "Update check failed",
    "aboutSettings.downloadFailed": "Download failed",
    "aboutSettings.installFailed": "Install failed",
    "aboutSettings.failedToCheckForUpdates": "Failed to check for updates.",

    // src/lib/components/settings/AccountSettings.svelte
    "accountSettings.profile": "Profile",
    "accountSettings.yourAvatar": "Your avatar",
    "accountSettings.changeAvatar": "Change avatar",
    "accountSettings.yourDisplayName": "Your display name",
    "accountSettings.saved": "Saved",
    "accountSettings.account": "Account",
    "accountSettings.userId": "User ID",
    "accountSettings.homeserver": "Homeserver",
    "accountSettings.connection": "Connection",
    "accountSettings.presence": "Presence",
    "accountSettings.password": "Password",
    "accountSettings.currentPassword": "Current password",
    "accountSettings.newPassword": "New password",
    "accountSettings.confirmNewPassword": "Confirm new password",
    "accountSettings.signOutAllOtherSessions": "Sign out all other sessions",
    "accountSettings.changing": "Changing…",
    "accountSettings.changePassword": "Change password",
    "accountSettings.passwordChanged": "Password changed.",
    "accountSettings.thisServerDoesNotAllowChanging":
        "This server does not allow changing your password from this app.",
    "accountSettings.emailPhoneNumbers": "Email & phone numbers",
    "accountSettings.noEmailAddressesOrPhoneNumbers":
        "No email addresses or phone numbers are linked to this account.",
    "accountSettings.email": "Email",
    "accountSettings.phone": "Phone",
    "accountSettings.thisServerDoesNotAllowManaging":
        "This server does not allow managing them from this app.",
    "accountSettings.logOut": "Log Out",
    "accountSettings.dangerZone": "Danger zone",
    "accountSettings.deactivateAccount": "Deactivate account…",
    "accountSettings.deactivationIsPermanentAndCannotBe":
        "Deactivation is permanent and cannot be undone.",
    "accountSettings.eraseMessagesWherePossible":
        "Erase messages where possible",
    "accountSettings.deactivating": "Deactivating…",
    "accountSettings.deactivateAccount2": "Deactivate account",
    "accountSettings.avatarUploadFailed": "Avatar upload failed",
    "accountSettings.failedToRemoveAvatar": "Failed to remove avatar",
    "accountSettings.failedToSaveName": "Failed to save name",
    "accountSettings.couldNotSetPresence": "Could not set presence",
    "accountSettings.failedToChangePassword": "Failed to change password",
    "accountSettings.failedToDeactivateAccount": "Failed to deactivate account",

    // src/lib/components/layout/AccountSwitcher.svelte
    "accountSwitcher.signOut": "Sign out {userId}",
    "accountSwitcher.confirm": "Confirm",
    "accountSwitcher.signOut2": "Sign out",
    "accountSwitcher.addAccount": "Add account",
    "accountSwitcher.accountMenu": "Account menu",
    "accountSwitcher.closeAccountMenu": "Close account menu",
    "accountSwitcher.back": "Back",
    "accountSwitcher.setYourStatus": "Set your status",
    "accountSwitcher.setAStatus": "Set a status",
    "accountSwitcher.editProfile": "Edit Profile",
    "accountSwitcher.switchAccounts": "Switch Accounts",
    "accountSwitcher.couldNotSetPresence": "Could not set presence",

    // src/lib/components/layout/ActiveCallBanner.svelte
    "activeCallBanner.openCall": "Open call",
    "activeCallBanner.ringing": "Ringing…",
    "activeCallBanner.voiceCallInCall": "Voice call · {length} in call",
    "activeCallBanner.leave": "Leave",

    // src/lib/components/settings/AppearanceSettings.svelte
    "appearanceSettings.rightAlignMyMessagesBubbleLayout":
        "Right-align my messages (bubble layout)",
    "appearanceSettings.displayYourOwnMessagesOnThe":
        "Display your own messages on the right in a colored bubble",
    "appearanceSettings.showNameColours": "Show name colours",
    "appearanceSettings.drawPeopleSNamesInThe":
        "Draw people's names in the colour they picked in their profile. Turn off to use the normal text colour for everyone.",
    "appearanceSettings.keepRoomListOpen": "Keep room list open",
    "appearanceSettings.donTAutoCloseTheRoom":
        "Don't auto-close the room list when switching between spaces or Home. Opening a room or DM always closes it.",
    "appearanceSettings.timestamps": "Timestamps",
    "appearanceSettings.timeFormat": "Time format",
    "appearanceSettings.dateFormat": "Date format",
    "appearanceSettings.customDatePattern": "Custom date pattern",
    "appearanceSettings.yyyyMmDd": "yyyy-MM-dd",
    "appearanceSettings.preview": "Preview:",
    "appearanceSettings.dateFnsTokensEGYyyy":
        "· date-fns tokens, e.g. yyyy-MM-dd",
    "appearanceSettings.invalidFormatUseLowercaseDateFns":
        "Invalid format - use lowercase date-fns tokens like yyyy-MM-dd.",
    "appearanceSettings.alwaysShowAbsoluteDates": "Always show absolute dates",
    "appearanceSettings.replaceTodayAndYesterdayWithThe":
        'Replace "Today" and "Yesterday" with the full date everywhere.',
    "appearanceSettings.reduceMotion": "Reduce motion",
    "appearanceSettings.minimizeAnimationsAndTransitionsYourDevice":
        'Minimize animations and transitions. Your device\'s system "reduce motion" setting is always respected as well.',
    "appearanceSettings.custom": "Custom",
    "appearanceSettings.12Hour": "12-hour",
    "appearanceSettings.24Hour": "24-hour",
    "appearanceSettings.language": "Language",
    "appearanceSettings.displayLanguage": "Display language",
    "appearanceSettings.displayLanguageHint":
        "The language Zam's menus and buttons are shown in. Changing it reloads the app.",

    // src/routes/app/+page.svelte
    "appPage.redirecting": "Redirecting…",

    // src/lib/components/layout/AppSettings.svelte
    "appSettings.backToSettings": "Back to settings",
    "appSettings.closeSettings": "Close settings",
    "appSettings.searchSettings": "Search settings…",
    "appSettings.searchSettings2": "Search settings",
    "appSettings.noSettingsMatch": "No settings match",
    "appSettings.noSettingsMatch2": 'No settings match "{searchQuery}".',
    "appSettings.resultCount":
        "{count, plural, one {# result} other {# results}}",

    // src/lib/components/layout/AppShell.svelte
    "appShell.zam": "({notificationCount}) Zam",
    "appShell.redirecting": "Redirecting…",
    "appShell.noRoomsYet": "No rooms yet",
    "appShell.createARoomOrStartA":
        "Create a room or start a direct message to get going.",
    "appShell.nothingInHome": "Nothing in Home",
    "appShell.allOfYourRoomsLiveIn":
        "All of your rooms live in spaces - open one to see them. Rooms and direct messages outside a space show up here.",
    "appShell.openRoomList": "Open Room List",
    "appShell.someone": "Someone",
    "appShell.isCalling": "{name} is calling",
    "appShell.incomingCall": "Incoming call",
    "appShell.offlineMessageStorageIsUnavailableThis":
        "Offline message storage is unavailable this session, so history won't be saved for next time.",
    "appShell.couldnTSendYourReplyIt":
        "Couldn't send your reply. It's saved as a draft.",
    "appShell.yourNotificationReplyWasSavedAs":
        "Your notification reply was saved as a draft",

    // src/lib/components/settings/BlockedUsersSettings.svelte
    "blockedUsersSettings.messagesFromBlockedUsersAreHidden":
        "Messages from blocked users are hidden in every room. The list is stored on your account and applies to all your sessions.",
    "blockedUsersSettings.youHavenTBlockedAnyone":
        "You haven't blocked anyone.",
    "blockedUsersSettings.failed": "Failed",

    // src/lib/components/layout/CallParticipantMenu.svelte
    "callParticipantMenu.profile": "Profile",
    "callParticipantMenu.input": "Input",
    "callParticipantMenu.output": "Output",
    "callParticipantMenu.opening": "Opening…",
    "callParticipantMenu.message": "Message",
    "callParticipantMenu.mention": "Mention",
    "callParticipantMenu.userVolume": "User Volume",
    "callParticipantMenu.hideVideo": "Hide video",
    "callParticipantMenu.kicking": "Kicking…",
    "callParticipantMenu.confirmKick": "Confirm kick {name}?",
    "callParticipantMenu.kickFromRoom": "Kick {name} from room",
    "callParticipantMenu.banning": "Banning…",
    "callParticipantMenu.confirmBan": "Confirm ban {name}?",
    "callParticipantMenu.ban": "Ban {name}",
    "callParticipantMenu.couldNotOpenADirectMessage":
        "Could not open a direct message",
    "callParticipantMenu.couldNotKick": "Could not kick {name}",
    "callParticipantMenu.couldNotBan": "Could not ban {name}",

    // src/lib/components/layout/CallView.svelte
    "callView.ringing": "Ringing…",
    "callView.showChat": "Show chat",
    "callView.noOneIsInThisCall": "No one is in this call",
    "callView.backToGrid": "Back to grid",
    "callView.screenShareQuality": "Screen share quality",
    "callView.optionsFor": "Options for {name}",
    "callView.muted": "Muted",
    "callView.deafened": "Deafened",
    "callView.mutedForYou": "Muted for you",
    "callView.joinedFromMultipleDevices": "Joined from multiple devices",
    "callView.devices": "{value} devices",
    "callView.enableAudio": "Enable audio",
    "callView.unmute": "Unmute",
    "callView.undeafen": "Undeafen",
    "callView.deafen": "Deafen",
    "callView.disconnect": "Disconnect",
    "callView.joinCall": "Join Call",
    "callView.you": "You",
    "callView.sScreen": "{name}'s screen",
    "callView.exitSpotlightFor": "Exit spotlight for {label}",
    "callView.spotlight": "Spotlight {label}",

    // src/lib/components/messages/CreatePollDialog.svelte
    "createPollDialog.createPoll": "Create poll",
    "createPollDialog.question": "Question",
    "createPollDialog.askSomething": "Ask something…",
    "createPollDialog.options": "Options",
    "createPollDialog.option": "Option {value}",
    "createPollDialog.removeOption": "Remove option",
    "createPollDialog.addOption": "+ Add option",
    "createPollDialog.results": "Results",
    "createPollDialog.showAsPeopleVote": "Show as people vote",
    "createPollDialog.hideUntilClosed": "Hide until closed",
    "createPollDialog.allowSelectingMultipleOptions":
        "Allow selecting multiple options",
    "createPollDialog.creating": "Creating…",
    "createPollDialog.failedToCreatePoll": "Failed to create poll",

    // src/lib/components/layout/CryptoUnavailableBanner.svelte
    "cryptoUnavailableBanner.encryptionIsUnavailableThisSessionEncrypted":
        "Encryption is unavailable this session: encrypted messages can't be read or sent. Reload to try again.",
    "cryptoUnavailableBanner.reload": "Reload",
    "cryptoUnavailableBanner.dismissEncryptionWarning":
        "Dismiss encryption warning",

    // src/lib/components/settings/CustomPackSettings.svelte
    "customPackSettings.add": "Add {singular}",
    "customPackSettings.shortcode": "shortcode",
    "customPackSettings.sticker": "Sticker",
    "customPackSettings.remove": "Remove {toLowerCase}",
    "customPackSettings.image": "Image",
    "customPackSettings.chooseAtLeastOneUsage": "Choose at least one usage.",
    "customPackSettings.uploadFailed": "Upload failed",
    "customPackSettings.failedToRemove": "Failed to remove {singular}",
    "customPackSettings.failedToUpdateUsage": "Failed to update usage",
    "customPackSettings.noCustomImages": "No custom images",
    "customPackSettings.noCustomEmojis": "No custom emojis",
    "customPackSettings.noCustomStickers": "No custom stickers",

    // src/lib/components/debug/DebugEventItem.svelte
    "debugEventItem.stateKey": "state_key",
    "debugEventItem.empty": "(empty)",
    "debugEventItem.redacted": "REDACTED",
    "debugEventItem.id": "id: {eventId}",

    // src/lib/components/debug/DebugPanel.svelte
    "debugPanel.debugPanel": "DEBUG PANEL",
    "debugPanel.sync": "Sync:",
    "debugPanel.refresh": "↻ refresh",
    "debugPanel.copied": "✓ copied",
    "debugPanel.copy": "⧉ copy",
    "debugPanel.unreadState": "UNREAD STATE",
    "debugPanel.unread": "unread:",
    "debugPanel.highlight": "highlight:",
    "debugPanel.userid": "userId:",
    "debugPanel.readuptoid": "readUpToId:",
    "debugPanel.readidxInTimeline": "readIdx in timeline:",
    "debugPanel.noReceipt": "no receipt",
    "debugPanel.n1NotInWindow": "-1 (not in window!)",
    "debugPanel.events": "/ {totalEvents} events",
    "debugPanel.lastEventSender": "last event sender:",
    "debugPanel.me": "(me:",
    "debugPanel.notificationEventsAfterReadMarker":
        "notification events after read marker:",
    "debugPanel.from": "[{formatTs}] {getType} from {value} - {msgPreview}",
    "debugPanel.pushRules": "PUSH RULES",
    "debugPanel.default": "(default)",
    "debugPanel.actions": "actions: {stringify}",
    "debugPanel.conditions": "conditions: {stringify}",
    "debugPanel.noPushRulesFound": "no push rules found",
    "debugPanel.readReceiptsEventsWithReceipts":
        "READ RECEIPTS ({length} events with receipts)",
    "debugPanel.noReceipts": "no receipts",
    "debugPanel.urlPreviewInspector": "URL PREVIEW INSPECTOR",
    "debugPanel.https": "https://...",
    "debugPanel.storeMessagesWhatTheUiRenders":
        "STORE MESSAGES ({length}) - what the UI renders",
    "debugPanel.redacted": "REDACTED",
    "debugPanel.rel": "rel={relType}",
    "debugPanel.empty": "empty",
    "debugPanel.pendingEvents": "PENDING EVENTS ({length})",
    "debugPanel.rawTimelineEvents": "RAW TIMELINE ({length} events)",

    // src/lib/components/settings/DebugSettings.svelte
    "debugSettings.developer": "Developer",
    "debugSettings.showAllEvents": "Show all events",
    "debugSettings.displayEveryMatrixTimelineEventIn":
        "Display every Matrix timeline event in the chat log.",
    "debugSettings.syncStatus": "Sync Status",
    "debugSettings.useSlidingSync": "Use sliding sync",
    "debugSettings.experimentalLoadsRoomsInAGrowing":
        "Experimental. Loads rooms in a growing window. Reloads the app to apply.",
    "debugSettings.pushStatus": "Push Status",
    "debugSettings.lastError": "Last error: {lastError}",
    "debugSettings.runDiagnostics": "Run diagnostics",
    "debugSettings.homeserverPushers": "Homeserver Pushers",
    "debugSettings.theHomeserverHasNoPushersRegistered":
        "The homeserver has no pushers registered for this account.",
    "debugSettings.aPusherMatchesTheConfiguredGateway":
        "A pusher matches the configured gateway URL.",
    "debugSettings.noPusherMatchesTheConfiguredGateway":
        "No pusher matches the configured gateway URL.",
    "debugSettings.appId": "app_id: {app_id}",
    "debugSettings.none": "(none)",
    "debugSettings.url": "url: {value}",
    "debugSettings.pushkey": "pushkey: {pushkeyPreview}",
    "debugSettings.webPushPwa": "Web Push (PWA)",
    "debugSettings.missing": "(missing)",
    "debugSettings.vapidKey": "VAPID key: {value}",
    "debugSettings.permission": "permission: {permission}",
    "debugSettings.subscription": "subscription: {value}",
    "debugSettings.notFound": "not found",
    "debugSettings.homeserverPusher": "homeserver pusher: {value}",
    "debugSettings.error": "error: {error}",
    "debugSettings.gatewaySygnalFirebase": "Gateway (Sygnal / Firebase)",
    "debugSettings.gatewayReachable": "Gateway reachable",
    "debugSettings.gatewayNotReachable": "Gateway not reachable",
    "debugSettings.nativeSessionPushEnrichment":
        "Native Session (push enrichment)",
    "debugSettings.homeserver": "homeserver: {value}",
    "debugSettings.user": "user: {value}",
    "debugSettings.device": "device: {value}",
    "debugSettings.accessToken": "access token: {value}",
    "debugSettings.hideMessageText": "hide message text: {value}",
    "debugSettings.notificationRulesServer": "Notification Rules (server)",
    "debugSettings.syncMode": "Sync mode",
    "debugSettings.slidingSyncMsc4186": "Sliding sync (MSC4186)",
    "debugSettings.classicSyncV2": "Classic /sync (v2)",
    "debugSettings.syncState": "Sync state",
    "debugSettings.fallback": "Fallback",
    "debugSettings.slidingSyncEndpoint": "Sliding sync endpoint",
    "debugSettings.joinedRoomsLoaded": "Joined rooms loaded",
    "debugSettings.roomListWindow": "Room list window",
    "debugSettings.of": "{requested} of {total}",
    "debugSettings.platform": "Platform",
    "debugSettings.nativeCapacitor": "Native (Capacitor)",
    "debugSettings.pushEnabledInBuild": "Push enabled in build",
    "debugSettings.yes": "Yes",
    "debugSettings.no": "No",
    "debugSettings.gatewayUrl": "Gateway URL",
    "debugSettings.appId2": "App ID",
    "debugSettings.notificationPermission": "Notification permission",
    "debugSettings.fcmToken": "FCM token",
    "debugSettings.pusherRegisteredThisSession":
        "Pusher registered this session",
    "debugSettings.failedToFetchPushersFromHomeserver":
        "Failed to fetch pushers from homeserver.",
    "debugSettings.set": "set",
    "debugSettings.active": "active",

    // src/lib/components/ui/EmojiPicker.svelte
    "emojiPicker.searchEmoji": "Search emoji…",
    "emojiPicker.searchEmoji2": "Search emoji",
    "emojiPicker.myEmojis": "My emojis",
    "emojiPicker.custom": "Custom",
    "emojiPicker.standard": "Standard",
    "emojiPicker.myEmojis2": "My Emojis",

    // src/lib/components/ui/ErrorToasts.svelte
    "errorToasts.dismiss": "Dismiss",

    // src/lib/components/settings/ExtendedProfileDebug.svelte
    "extendedProfileDebug.extendedProfile": "Extended profile",
    "extendedProfileDebug.fetchFromServer": "Fetch from server",
    "extendedProfileDebug.thisServerDoesNotSupportExtended":
        "This server does not support extended profiles.",
    "extendedProfileDebug.noneOrTheServerRefused":
        "none, or the server refused",
    "extendedProfileDebug.presenceGetPresenceStraightFromThe":
        "Presence (GET /presence, straight from the server): {value}",
    "extendedProfileDebug.notAdvertisedNoRestrictions":
        "not advertised (no restrictions)",
    "extendedProfileDebug.serverRulesForFieldsMProfile":
        "Server rules for fields (m.profile_fields): {value}",
    "extendedProfileDebug.failedToFetchTheProfile":
        "Failed to fetch the profile",
    "extendedProfileDebug.couldNotCopyToClipboard":
        "Could not copy to clipboard",

    // src/lib/components/ui/FlashEmbed.svelte
    "flashEmbed.suspend": "Suspend",

    // src/lib/components/messages/ForwardMessageDialog.svelte
    "forwardMessageDialog.forwardMessage": "Forward message",
    "forwardMessageDialog.searchRooms": "Search rooms",
    "forwardMessageDialog.noJoinedRoomsFound": "No joined rooms found",
    "forwardMessageDialog.forwarding": "Forwarding…",
    "forwardMessageDialog.forward": "Forward",
    "forwardMessageDialog.failedToForwardMessage": "Failed to forward message",

    // src/lib/components/settings/GeneralSettings.svelte
    "generalSettings.desktop": "Desktop",
    "generalSettings.minimiseToTrayOnClose": "Minimise to tray on close",
    "generalSettings.keepZamRunningInTheSystem":
        "Keep Zam running in the system tray when you close the window instead of quitting. Use the tray icon to reopen or quit.",
    "generalSettings.noGeneralSettingsAreAvailableOn":
        "No general settings are available on this platform.",

    // src/lib/components/ui/GifPicker.svelte
    "gifPicker.searchFavourites": "Search favourites…",
    "gifPicker.searchKlipy": "Search KLIPY…",
    "gifPicker.searchFavourites2": "Search favourites",
    "gifPicker.searchGifs": "Search GIFs",
    "gifPicker.gifResults": "GIF results",
    "gifPicker.noFavouriteGifsYetStarA":
        "No favourite GIFs yet. Star a GIF to save it here.",
    "gifPicker.favourites": "Favourites",
    "gifPicker.gifTagged": "GIF tagged {join}",
    "gifPicker.favouriteGif": "Favourite GIF {value}",
    "gifPicker.editTags": "Edit tags",
    "gifPicker.catFunny": "cat, funny",
    "gifPicker.commaSeparatedEnterToSave": "Comma-separated · Enter to save",
    "gifPicker.trending": "Trending",
    "gifPicker.gifResult": "GIF result {value}",
    "gifPicker.favourite": "Favourite",
    "gifPicker.poweredByKlipy": "Powered by KLIPY",

    // src/lib/components/layout/ImagePackEditor.svelte
    "imagePackEditor.addImage": "Add Image",
    "imagePackEditor.newPack": "New pack",
    "imagePackEditor.packName": "Pack name",
    "imagePackEditor.shortcode": "shortcode",
    "imagePackEditor.useAsEmoji": "Use as emoji",
    "imagePackEditor.useAsSticker": "Use as sticker",
    "imagePackEditor.inheritedFrom": "Inherited from {sourceName}",
    "imagePackEditor.sticker": "Sticker",
    "imagePackEditor.removeImage": "Remove image",
    "imagePackEditor.noCustomImages": "No custom images",
    "imagePackEditor.emotes": "{value} Emotes",
    "imagePackEditor.room": "Room",
    "imagePackEditor.chooseAtLeastOneUsage": "Choose at least one usage.",
    "imagePackEditor.enterAPackName": "Enter a pack name.",
    "imagePackEditor.uploadFailed": "Upload failed",
    "imagePackEditor.failedToUpdateUsage": "Failed to update usage",
    "imagePackEditor.failedToRemoveImage": "Failed to remove image",

    // src/lib/components/layout/InboxPanel.svelte
    "inboxPanel.inbox": "Inbox",
    "inboxPanel.noPendingInvites": "No pending invites",
    "inboxPanel.roomInvitesWillAppearHere": "Room invites will appear here.",
    "inboxPanel.pendingInvites": "Pending invites: {length}",
    "inboxPanel.invitedBy": "Invited by {sender}",
    "inboxPanel.ignore": "Ignore",
    "inboxPanel.accept": "Accept",
    "inboxPanel.pendingJoinRequests": "Pending join requests: {length}",
    "inboxPanel.youAskedToJoinWaitingFor":
        "You asked to join - waiting for someone to let you in.",
    "inboxPanel.cancelRequest": "Cancel request",
    "inboxPanel.failedToAcceptInvite": "Failed to accept invite",
    "inboxPanel.failedToRejectInvite": "Failed to reject invite",
    "inboxPanel.failedToCancelJoinRequest": "Failed to cancel join request",

    // src/lib/components/layout/IncomingCallCard.svelte
    "incomingCallCard.incomingCall": "Incoming call",
    "incomingCallCard.declineCallFrom": "Decline call from {name}",
    "incomingCallCard.accept": "Accept",
    "incomingCallCard.acceptCallFrom": "Accept call from {name}",
    "incomingCallCard.unknown": "Unknown",

    // src/lib/components/layout/InvitePanel.svelte
    "invitePanel.invitePeopleTo": "Invite people to",
    "invitePanel.invited": "Invited",
    "invitePanel.failed": "Failed",
    "invitePanel.inviteByEmail": "Invite by email",
    "invitePanel.nameExampleCom": "name@example.com",
    "invitePanel.inviting": "Inviting…",
    "invitePanel.invite": "Invite",
    "invitePanel.invite2": "Invite {length}",
    "invitePanel.enterAValidEmailAddress": "Enter a valid email address.",
    "invitePanel.couldNotSendTheEmailInvite": "Could not send the email invite",
    "invitePanel.couldNotSendTheInvite": "Could not send the invite",
    "invitePanel.thisRoom": "this room",
    "invitePanel.thisSpace": "this space",

    // src/lib/components/layout/JoinConsentDialog.svelte
    "joinConsentDialog.joinThisRoom": "Join this room?",
    "joinConsentDialog.youClickedALinkTo": "You clicked a link to",
    "joinConsentDialog.joiningSharesYourMatrixIdWith":
        ". Joining shares your Matrix ID with everyone in the room and adds it to your room list.",
    "joinConsentDialog.thisOpensRoom": "This opens room",
    "joinConsentDialog.warningThisLinkPointsAtA":
        "Warning: this link points at a different server than the room it resolves to. Only continue if you trust the sender.",
    "joinConsentDialog.joinRoom": "Join room",

    // src/lib/components/ui/Lightbox.svelte
    "lightbox.closeViewer": "Close {mediaNoun} viewer",
    "lightbox.viewer": "{MediaNoun} viewer{value}",
    "lightbox.download": "Download",
    "lightbox.previous": "Previous",
    "lightbox.previous2": "Previous {mediaNoun}",
    "lightbox.next": "Next",
    "lightbox.next2": "Next {mediaNoun}",
    "lightbox.couldNotLoadThisVideoUse":
        "Could not load this video. Use Download to save it instead.",
    "lightbox.video": "Video",
    "lightbox.image": "Image",
    "lightbox.videoNoun": "video",
    "lightbox.imageNoun": "image",

    // src/lib/components/messages/LinkPreview.svelte
    "linkPreview.youtubeVideo": "YouTube video",
    "linkPreview.xTwitter": "X / Twitter",
    "linkPreview.loadingItContactsTheSiteHosting":
        "Loading it contacts the site hosting it, which reveals your IP address",
    "linkPreview.loadPreviewMedia": "Load preview media",
    "linkPreview.playVideo": "Play video",

    // src/lib/components/layout/LiveLocationBanner.svelte
    "liveLocationBanner.openMap": "Open map",
    "liveLocationBanner.sharingLiveLocation": "Sharing live location",
    "liveLocationBanner.lastUpdatedAt":
        " · last updated at {timeOnly} ({updatedAgoLabel})",
    "liveLocationBanner.map": "Map",
    "liveLocationBanner.isSharingLiveLocation":
        "{getMemberName} is sharing live location",
    "liveLocationBanner.peopleSharingLiveLocation":
        "{length} people sharing live location",
    "liveLocationBanner.viewMap": "View map",

    // src/lib/components/layout/LiveLocationMapView.svelte
    "liveLocationMapView.back": "Back",
    "liveLocationMapView.liveLocation": "Live location",
    "liveLocationMapView.recenter": "Recenter",
    "liveLocationMapView.waitingForALocationFix": "Waiting for a location fix…",
    "liveLocationMapView.sharingLiveLocation": "Sharing live location",
    "liveLocationMapView.lastUpdatedAt":
        "last updated at {timeOnly} ({updatedAgoLabel})",
    "liveLocationMapView.osm": "OSM",
    "liveLocationMapView.noActiveLiveSharesInThis":
        "No active live shares in this room.",
    "liveLocationMapView.you": "You",

    // src/lib/components/messages/LocationBody.svelte
    "locationBody.openstreetmap": "OpenStreetMap",
    "locationBody.googleMaps": "Google Maps",

    // src/lib/components/layout/LoginView.svelte
    "loginView.signIn": "Sign In",
    "loginView.register": "Register",
    "loginView.zam": "Zam - {value}",
    "loginView.addAnAccount": "Add an account",
    "loginView.welcomeBack": "Welcome back!",
    "loginView.signInWithAnotherMatrixAccount":
        "Sign in with another Matrix account",
    "loginView.signInToYourMatrixAccount": "Sign in to your Matrix account",
    "loginView.createAnAccount": "Create an account",
    "loginView.registerOnAMatrixHomeserver": "Register on a Matrix homeserver",
    "loginView.homeserver": "Homeserver",
    "loginView.username": "Username",
    "loginView.password": "Password",
    "loginView.registrationToken": "Registration Token",
    "loginView.ifRequired": "(if required)",
    "loginView.leaveBlankIfNotRequired": "Leave blank if not required",
    "loginView.useSlidingSync": "Use sliding sync",
    "loginView.fasterStartupOnServersThatSupport":
        "Faster startup on servers that support it (experimental).",
    "loginView.pleaseWait": "Please wait…",
    "loginView.logIn": "Log In",
    "loginView.createAccount": "Create Account",
    "loginView.donTHaveAnAccount": "Don't have an account?",
    "loginView.alreadyHaveAnAccount": "Already have an account?",
    "loginView.signIn2": "Sign in",
    "loginView.backTo": "← Back to {activeUserId}",
    "loginView.orContinueAs": "Or continue as",
    "loginView.yourCredentialsAreSentDirectlyTo":
        "Your credentials are sent directly to your homeserver and never stored by this app beyond your device.",
    "loginView.loggingIn": "Logging in…",
    "loginView.loginFailedCheckYourCredentials":
        "Login failed. Check your credentials.",
    "loginView.creatingAccount": "Creating account…",
    "loginView.registrationFailed": "Registration failed.",

    // src/lib/components/layout/MemberList.svelte
    "memberList.members": "Members: {length}",
    "memberList.admins": "Admins: {length}",
    "memberList.admin": "Admin",
    "memberList.moderators": "Moderators: {length}",

    // src/lib/components/messages/MessageActionsSheet.svelte
    "messageActionsSheet.thisMessage": "{label} this message?",
    "messageActionsSheet.messageActions": "Message actions",

    // src/lib/components/layout/MessageArea.svelte
    "messageArea.dropToAttach": "Drop to attach",
    "messageArea.unreadNotifications": "Unread notifications",
    "messageArea.encryptionEnabled": "Encryption enabled",
    "messageArea.joiningVoiceCall": "Joining voice call…",
    "messageArea.startVoiceCall": "Start voice call",
    "messageArea.showCall": "Show call",
    "messageArea.searchMessages": "Search messages",
    "messageArea.threads": "Threads",
    "messageArea.toggleThreadsList": "Toggle threads list",
    "messageArea.unreadThreadMentions": "Unread thread mentions",
    "messageArea.unreadThreads": "Unread threads",
    "messageArea.pinnedMessages": "Pinned messages",
    "messageArea.notificationsInbox": "Notifications inbox",
    "messageArea.mediaAndFiles": "Media and files",
    "messageArea.toggleMemberList": "Toggle member list",
    "messageArea.more": "More",
    "messageArea.moreRoomOptions": "More room options",
    "messageArea.messageTimeline": "Message timeline",
    "messageArea.welcomeTo": "Welcome to #",
    "messageArea.thisIsTheBeginningOfThe": "This is the beginning of the #",
    "messageArea.room": "room.",
    "messageArea.newMessages": "New Messages",
    "messageArea.messageFromABlockedUser": "Message from a blocked user",
    "messageArea.showBlockedMessage": "Show blocked message",
    "messageArea.thisRoomHasBeenUpgraded": "This room has been upgraded",
    "messageArea.goToNewRoom": "Go to new room",
    "messageArea.joinNewRoom": "Join new room",
    "messageArea.jumpToPresent": "Jump to present",
    "messageArea.searchingForMessage": "Searching for message…",
    "messageArea.viewingMessageContext": "Viewing message context",
    "messageArea.returnToLive": "Return to live",
    "messageArea.closePanel": "Close panel",
    "messageArea.someone": "Someone",
    "messageArea.pinnedMessagesCount": "Pinned messages ({count})",

    // src/lib/components/messages/MessageInput.svelte
    "messageInput.replyingTo": "Replying to {replyTargetName}",
    "messageInput.cancelReplyEsc": "Cancel reply (Esc)",
    "messageInput.editAttachment": "Edit attachment",
    "messageInput.editAttachment2": "Edit attachment {name}",
    "messageInput.custom": "custom",
    "messageInput.yourNextMessageWillStartA": "Your next message will start a",
    "messageInput.thread": "thread",
    "messageInput.cancelThreadCreation": "Cancel thread creation",
    "messageInput.favouriteGifs": "Favourite GIFs",
    "messageInput.sendMessage": "Send message",
    "messageInput.isTyping": "{value} is typing…",
    "messageInput.andAreTyping": "{value} and {value2} are typing…",
    "messageInput.andAreTyping2": "{value}, {value2}, and {value3} are typing…",
    "messageInput.severalPeopleAreTyping": "Several people are typing…",
    "messageInput.selectARoomToStartChatting":
        "Select a room to start chatting",
    "messageInput.replyInThread": "Reply in thread...",
    "messageInput.replyTo": "Reply to {replyTargetName}...",
    "messageInput.message": "Message #{roomName}",
    "messageInput.isNotAValidUser": '"{token}" is not a valid user',
    "messageInput.noRoomSelected": "No room selected",
    "messageInput.isNotInThisRoom": "{userId} is not in this room",
    "messageInput.youDonTHavePermissionTo":
        "You don't have permission to change power levels in this room",
    "messageInput.unhandledCommand": "Unhandled command: /{name}",
    "messageInput.commandFailed": "Command failed",
    "messageInput.failedToSend": "Failed to send",
    "messageInput.unknownCommand": "Unknown command: /{unknown}",
    "messageInput.sendingAttachments":
        "{count, plural, one {Sending # attachment…} other {Sending # attachments…}}",

    // src/lib/components/messages/MessageItem.svelte
    "messageItem.viewProfile": "View profile",
    "messageItem.jumpToTheRepliedToMessage": "Jump to the replied-to message:",
    "messageItem.originalMessageNotLoaded": "Original message not loaded",
    "messageItem.originalMessageDeleted": "Original message deleted",
    "messageItem.originalMessageUnavailable": "Original message unavailable",
    "messageItem.edited": "(edited)",
    "messageItem.decryptingImage": "Decrypting image...",
    "messageItem.couldnTDecryptImage": "Couldn't decrypt image",
    "messageItem.imageUnavailable": "[Image unavailable]",
    "messageItem.decryptingVideo": "Decrypting video...",
    "messageItem.couldnTDecryptVideo": "Couldn't decrypt video",
    "messageItem.video": "Video",
    "messageItem.canTBePlayedHere": "Can't be played here",
    "messageItem.playbackFailedClickToRetry":
        "Playback failed · Click to retry",
    "messageItem.clickToPlay": "{videoDuration} · Click to play",
    "messageItem.clickToPlay2": "Click to play",
    "messageItem.audio": "Audio",
    "messageItem.kb": "{toFixed} KB",
    "messageItem.mb": "{toFixed} MB",
    "messageItem.fileAttachment": "File attachment",
    "messageItem.download": "Download",
    "messageItem.toSave": "to save ·",
    "messageItem.toCancel": "to cancel",
    "messageItem.openThread": "Open thread",
    "messageItem.failedToSend": "Failed to send.",
    "messageItem.retrying": "Retrying…",
    "messageItem.showWhoReadThisMessage": "Show who read this message",
    "messageItem.readThis":
        "{count, plural, one {# person has read this} other {# people have read this}}",
    "messageItem.readBy": "Read by",
    "messageItem.messageActions": "Message actions",
    "messageItem.editMessage": "Edit message",
    "messageItem.delete": "Delete?",
    "messageItem.yesDeleteMessage": "Yes, delete message",
    "messageItem.yes": "Yes",
    "messageItem.noKeepMessage": "No, keep message",
    "messageItem.no": "No",
    "messageItem.deleteMessage": "Delete message",
    "messageItem.unpinMessage": "Unpin message",
    "messageItem.pinMessage": "Pin message",
    "messageItem.addReaction": "Add reaction",
    "messageItem.reply": "Reply",
    "messageItem.replyInThread": "Reply in thread",
    "messageItem.forwardMessage": "Forward message",
    "messageItem.moreActions": "More actions",
    "messageItem.linkCopied": "Link copied!",
    "messageItem.copyMessageLink": "Copy message link",
    "messageItem.linkCopied2": "Link copied",
    "messageItem.couldnTDeleteTheMessage": "Couldn't delete the message",
    "messageItem.couldnTCopyTheMessageLink": "Couldn't copy the message link",
    "messageItem.failedToUnpinMessage": "Failed to unpin message",
    "messageItem.failedToPinMessage": "Failed to pin message",
    "messageItem.couldNotOpenTheMatrixLink": "Could not open the Matrix link",

    // src/lib/components/messages/MessageRedactAction.svelte
    "messageRedactAction.removeMessage": "Remove message",
    "messageRedactAction.removeThisMessage": "Remove this message?",
    "messageRedactAction.removing": "Removing…",
    "messageRedactAction.failedToRemoveMessage": "Failed to remove message",

    // src/lib/components/messages/MessageReportAction.svelte
    "messageReportAction.reportMessage": "Report message",
    "messageReportAction.reportSent": "Report sent",
    "messageReportAction.whyAreYouReportingThisMessage":
        "Why are you reporting this message?",
    "messageReportAction.markAsExtremelyOffensive":
        "Mark as extremely offensive",
    "messageReportAction.reporting": "Reporting…",
    "messageReportAction.report": "Report",

    // src/lib/components/layout/MessageSearchPanel.svelte
    "messageSearchPanel.searchMessages": "Search Messages",
    "messageSearchPanel.searchTryFromOrHasImage":
        "Search - try from: or has:image",
    "messageSearchPanel.searchForMessagesInThisRoom":
        "Search for messages in this room.",
    "messageSearchPanel.noMatchesInTheResultsLoaded":
        "No matches in the results loaded so far.",
    "messageSearchPanel.noResultsFor": 'No results for "{searched}".',
    "messageSearchPanel.searchFailed": "Search failed",
    "messageSearchPanel.resultCount":
        "{count, plural, one {# result} other {# results}}",

    // src/lib/components/settings/MessagesMediaSettings.svelte
    "messagesMediaSettings.messages": "Messages",
    "messagesMediaSettings.showMatrixIds": "Show Matrix IDs",
    "messagesMediaSettings.showFullMatrixIdsLikeUser":
        "Show full Matrix ids like @user:server instead of display names throughout the app.",
    "messagesMediaSettings.readReceiptAvatars": "Read receipt avatars",
    "messagesMediaSettings.showWhoHasReadEachMessage":
        "Show who has read each message as small avatars underneath it. This only changes what you see on this device - to stop others seeing how far you've read, use Private read receipts in Privacy & Safety.",
    "messagesMediaSettings.holdToOpenMessageMenu": "Hold to open message menu",
    "messagesMediaSettings.onTouchDevicesOpenAMessage":
        "On touch devices, open a message's actions by holding it instead of tapping. When off, a tap opens the menu.",
    "messagesMediaSettings.linkPreviews": "Link previews",
    "messagesMediaSettings.whenOffNoLinkPreviewIs":
        "When off, no link preview is loaded and your homeserver never fetches the linked page on your behalf. Control where preview media loads from in Privacy & Safety.",
    "messagesMediaSettings.pauseVideosOffScreen": "Pause videos off-screen",
    "messagesMediaSettings.pauseAPlayingVideoWhenIt":
        "Pause a playing video when it scrolls out of view to save battery. You restart it yourself when you scroll back.",
    "messagesMediaSettings.defaultTab": "Default tab",
    "messagesMediaSettings.whichTabTheGifPickerOpens":
        "Which tab the GIF picker opens on.",
    "messagesMediaSettings.defaultGifTab": "Default GIF tab",
    "messagesMediaSettings.favourites": "Favourites",

    // src/lib/components/ui/ModalDialog.fixture.svelte
    "modalDialog.fixture.fixtureDialog": "Fixture dialog",

    // src/lib/components/settings/NotificationSettings.svelte
    "notificationSettings.thisDevice": "This device",
    "notificationSettings.systemPermission": "System Permission",
    "notificationSettings.pushNotifications": "Push notifications",
    "notificationSettings.permissionIsBlockedInSystemSettings":
        "Permission is blocked in system settings",
    "notificationSettings.notificationsAreNotSupportedHere":
        "Notifications are not supported here",
    "notificationSettings.allowThisAppToSendNotifications":
        "Allow this app to send notifications",
    "notificationSettings.requesting": "Requesting…",
    "notificationSettings.blocked": "Blocked",
    "notificationSettings.unavailable": "Unavailable",
    "notificationSettings.enable": "Enable",
    "notificationSettings.sound": "Sound",
    "notificationSettings.notificationSound": "Notification sound",
    "notificationSettings.playASoundForLoudNotifications":
        "Play a sound for loud notifications",
    "notificationSettings.desktopAlerts": "Desktop alerts",
    "notificationSettings.popUpAndTaskbarFlash": "Pop-up and taskbar flash",
    "notificationSettings.whichNotificationsShowASystemPop":
        "Which notifications show a system pop-up and, in the desktop app, flash the taskbar icon while the window is in the background.",
    "notificationSettings.multipleDevices": "Multiple Devices",
    "notificationSettings.quietOnMyOtherDevices": "Quiet on my other devices",
    "notificationSettings.whileYouReActivelyUsingOne":
        "While you're actively using one device, the others skip the notification sound and pop-up until that device has been idle this long. Applies to every device on your account; notifications still appear in your inbox and unread counts are unchanged.",
    "notificationSettings.custom": "Custom…",
    "notificationSettings.customQuietDurationInMinutes":
        "Custom quiet duration, in minutes",
    "notificationSettings.minutesMax":
        "minutes (max {MAX_CUSTOM_GRACE_MINUTES})",
    "notificationSettings.couldnTSaveToYourAccount":
        "Couldn't save to your account - your other devices may keep the old setting. Check your connection and try again.",
    "notificationSettings.retrySavingTheOtherDeviceQuiet":
        "Retry saving the other-device quiet setting",
    "notificationSettings.retrying": "Retrying…",
    "notificationSettings.rules": "Rules",
    "notificationSettings.notificationRules": "Notification Rules",
    "notificationSettings.loudNotifyWithSoundSilentNotify":
        "Loud = notify with sound · Silent = notify without sound · Off = no notification",
    "notificationSettings.keywordHighlights": "Keyword Highlights",
    "notificationSettings.getNotifiedWhenAMessageContains":
        "Get notified when a message contains a word or phrase. Matching is case-insensitive;",
    "notificationSettings.and": "and",
    "notificationSettings.areWildcards": "are wildcards.",
    "notificationSettings.addAKeyword": "Add a keyword…",
    "notificationSettings.newKeyword": "New keyword",
    "notificationSettings.noKeywordRulesYet": "No keyword rules yet.",
    "notificationSettings.behaviorFor": "Behavior for {pattern}",
    "notificationSettings.enable2": "Enable {pattern}",
    "notificationSettings.loudOnly": "Loud only",
    "notificationSettings.onlyNotificationsThatMakeASound":
        "Only notifications that make a sound",
    "notificationSettings.silentAndLoud": "Silent and loud",
    "notificationSettings.everyNotificationLoudOrSilent":
        "Every notification, loud or silent",
    "notificationSettings.none": "None",
    "notificationSettings.neverAlertOnThisDevice": "Never alert on this device",
    "notificationSettings.couldNotSaveNotificationSetting":
        "Could not save notification setting",
    "notificationSettings.highlightSound": "Highlight + Sound",
    "notificationSettings.notifyWithAHighlightAndSound":
        "Notify with a highlight and sound",
    "notificationSettings.highlight": "Highlight",
    "notificationSettings.notifyWithAHighlight": "Notify with a highlight",
    "notificationSettings.notify": "Notify",
    "notificationSettings.notifyWithoutAHighlight":
        "Notify without a highlight",
    "notificationSettings.failedToAddKeyword": "Failed to add keyword",
    "notificationSettings.failedToUpdateKeyword": "Failed to update keyword",
    "notificationSettings.failedToDeleteKeyword": "Failed to delete keyword",

    // src/lib/components/layout/NotificationsPanel.svelte
    "notificationsPanel.clearAll": "Clear all",
    "notificationsPanel.couldNotRefreshServerNotificationsTap":
        "Could not refresh server notifications. Tap to retry.",
    "notificationsPanel.noNotifications": "No notifications.",
    "notificationsPanel.jumpToMessage": "Jump to message:",
    "notificationsPanel.in": "in #{roomName}",
    "notificationsPanel.message": "(message)",

    // src/lib/components/messages/OutboxStrip.svelte
    "outboxStrip.queued": "Queued",
    "outboxStrip.sending": "Sending…",
    "outboxStrip.failed": "Failed",

    // src/lib/components/layout/OwnStatusEditor.svelte
    "ownStatusEditor.pickAStatusEmoji": "Pick a status emoji",
    "ownStatusEditor.whatSHappening": "What's happening?",
    "ownStatusEditor.statusText": "Status text",
    "ownStatusEditor.clearStatus": "Clear status",
    "ownStatusEditor.couldNotSaveStatus": "Could not save status",

    // src/lib/components/layout/PinnedMessagesPanel.svelte
    "pinnedMessagesPanel.pinnedMessages": "Pinned Messages",
    "pinnedMessagesPanel.noPinnedMessages": "No pinned messages.",
    "pinnedMessagesPanel.jump": "Jump",
    "pinnedMessagesPanel.unpin": "Unpin",

    // src/lib/components/plugins/PluginPopoverHost.svelte
    "pluginPopoverHost.plugin": "Plugin",

    // src/lib/components/settings/PluginSettingsForm.svelte
    "pluginSettingsForm.backToPlugins": "Back to plugins",
    "pluginSettingsForm.settings": "{pluginName} settings",
    "pluginSettingsForm.thisPluginHasNoSettings":
        "This plugin has no settings.",
    "pluginSettingsForm.moveUp": "Move up",
    "pluginSettingsForm.moveDown": "Move down",
    "pluginSettingsForm.removeRow": "Remove row",

    // src/lib/components/settings/PluginsSettings.svelte
    "pluginsSettings.back": "← Back",
    "pluginsSettings.syncYourEnabledPluginsSettingsTo":
        "Sync your enabled plugins + settings to your Matrix account (per-device otherwise). Pulling shows what will change before anything runs.",
    "pluginsSettings.pushToAccount": "Push to account",
    "pluginsSettings.pullFromAccount": "Pull from account",
    "pluginsSettings.thisPullWill": "This pull will:",
    "pluginsSettings.addRepos": "Add repos: {join}",
    "pluginsSettings.enable": "Enable: {join}",
    "pluginsSettings.disable": "Disable: {join}",
    "pluginsSettings.updateSettingsFor": "Update settings for: {join}",
    "pluginsSettings.setAutoUpdate": "Set auto-update: {value}",
    "pluginsSettings.setPerPluginAutoUpdate":
        "Set per-plugin auto-update: {join}",
    "pluginsSettings.notInstalledOnThisDeviceInstall":
        "Not installed on this device (install from Browse, then pull again): {join}",
    "pluginsSettings.nothingToChangeAlreadyInSync":
        "Nothing to change; already in sync.",
    "pluginsSettings.apply": "Apply",
    "pluginsSettings.installed": "Installed",
    "pluginsSettings.noPluginsInstalled": "No plugins installed.",
    "pluginsSettings.needsUpdate": "Needs update",
    "pluginsSettings.updateToV": "Update to v{value}",
    "pluginsSettings.updating": "Updating...",
    "pluginsSettings.update": "Update",
    "pluginsSettings.pluginSettings": "Plugin settings",
    "pluginsSettings.enable2": "Enable {name}",
    "pluginsSettings.working": "Working...",
    "pluginsSettings.autoUpdateThisPlugin": "Auto-update this plugin",
    "pluginsSettings.autoDefault": "Auto: Default",
    "pluginsSettings.autoOn": "Auto: On",
    "pluginsSettings.autoOff": "Auto: Off",
    "pluginsSettings.confirmRemove": "Confirm remove {name}",
    "pluginsSettings.removePlugin": "Remove plugin",
    "pluginsSettings.remove": "Remove {name}",
    "pluginsSettings.browse": "Browse",
    "pluginsSettings.loading": "Loading...",
    "pluginsSettings.noPluginsInThisRepoYet": "No plugins in this repo yet.",
    "pluginsSettings.install": "Install",
    "pluginsSettings.repos": "Repos",
    "pluginsSettings.official": "Official",
    "pluginsSettings.removeRepo": "Remove repo",
    "pluginsSettings.addARepo": "Add a repo",
    "pluginsSettings.thirdPartyReposRunFullTrust":
        "Third-party repos run full-trust code with full access to your account and messages. Only add repos you trust.",
    "pluginsSettings.ownerRepoOrGithubUrl": "owner/repo or GitHub URL",
    "pluginsSettings.addRepo": "Add repo",
    "pluginsSettings.syncPlugins": "Sync plugins",
    "pluginsSettings.disableAllPlugins": "Disable all plugins",
    "pluginsSettings.autoUpdatePlugins": "Auto-update plugins",
    "pluginsSettings.automaticallyPullNewerVersionsOfRepo":
        "Automatically pull newer versions of repo plugins.",
    "pluginsSettings.pushedYourPluginSetToYour":
        "Pushed your plugin set to your account.",
    "pluginsSettings.pushFailed": "Push failed.",
    "pluginsSettings.pullFailed": "Pull failed.",
    "pluginsSettings.appliedTheSyncedPluginSet":
        "Applied the synced plugin set.",
    "pluginsSettings.updateFailed": "Update failed.",
    "pluginsSettings.couldnTRemovePlugin": "Couldn't remove plugin: {message}",
    "pluginsSettings.couldnTRemovePlugin2": "Couldn't remove plugin.",
    "pluginsSettings.cannotAddThisRepo": "Cannot add this repo.",
    "pluginsSettings.noIndexJson": "No index.json ({status})",
    "pluginsSettings.installFailed": "Install failed.",

    // src/lib/components/messages/PollBody.svelte
    "pollBody.finalResults": "Final results",
    "pollBody.livePoll": "Live poll",
    "pollBody.resultsAreRevealedWhenThePoll":
        "Results are revealed when the poll ends",
    "pollBody.chooseUpTo": "· choose up to {maxSelections}",
    "pollBody.selected": "✓ selected",
    "pollBody.submitting": "Submitting…",
    "pollBody.submitVote": "Submit vote",
    "pollBody.votesAreHidden": "Votes are hidden",
    "pollBody.savingVote": "· saving vote…",
    "pollBody.closeThisPoll": "Close this poll?",
    "pollBody.closing": "Closing…",
    "pollBody.closePoll": "Close poll",
    "pollBody.pollUnsupportedFormat": "[Poll - unsupported format]",
    "pollBody.failedToSubmitVote": "Failed to submit vote",
    "pollBody.failedToClosePoll": "Failed to close poll",
    "pollBody.voteCount": "{count, plural, one {# vote} other {# votes}}",

    // src/lib/components/ui/Portal.fixture.svelte
    "portal.fixture.hello": "hello",

    // src/lib/components/settings/PrivacySafetySettings.svelte
    "privacySafetySettings.privacy": "Privacy",
    "privacySafetySettings.privateReadReceipts": "Private read receipts",
    "privacySafetySettings.hideYourReadReceiptsFromOther":
        "Hide your read receipts from other users. Your unread counts still work; others just can't see how far you've read.",
    "privacySafetySettings.hideMessageTextInNotifications":
        "Hide message text in notifications",
    "privacySafetySettings.notificationsOnThisDeviceSayWho":
        "Notifications on this device say who messaged you, but not what they said. The sender and room names are still shown. Applies to this device only.",
    "privacySafetySettings.linkPreviewMedia": "Link preview media",
    "privacySafetySettings.previewImagesAndVideosUsuallyCome":
        'Preview images and videos usually come straight from the site that hosts them, so that site learns your IP address and when you read the message. "Homeserver only" loads just the copies your own server serves; "Off" loads none of it. Both also hide embedded YouTube players and X/Twitter cards, which always load straight from those sites. Either way, each affected preview keeps a button to load its media. The link-preview on/off switch lives in Messages & Media.',
    "privacySafetySettings.blockedUsers": "Blocked users",
    "privacySafetySettings.all": "All",
    "privacySafetySettings.loadPreviewMediaFromWhereverIt":
        "Load preview media from wherever it is hosted",
    "privacySafetySettings.homeserverOnly": "Homeserver only",
    "privacySafetySettings.onlyLoadPreviewMediaYourOwn":
        "Only load preview media your own homeserver serves",
    "privacySafetySettings.off": "Off",
    "privacySafetySettings.neverLoadPreviewMediaAutomatically":
        "Never load preview media automatically",

    // src/lib/components/settings/ProfileFieldsEditor.svelte
    "profileFieldsEditor.moreAboutYou": "More about you",
    "profileFieldsEditor.banner": "Banner",
    "profileFieldsEditor.yourBanner": "Your banner",
    "profileFieldsEditor.changeBanner": "Change banner",
    "profileFieldsEditor.showWhenIAmInA": "Show when I am in a call",
    "profileFieldsEditor.addsInACallToYour":
        'Adds "In a call" to your profile while you are connected to a voice call, and removes it when you leave.',
    "profileFieldsEditor.pronouns": "Pronouns",
    "profileFieldsEditor.sheHerTheyThem": "she/her, they/them",
    "profileFieldsEditor.separateWithCommasMostPreferredFirst":
        "Separate with commas, most preferred first.",
    "profileFieldsEditor.status": "Status",
    "profileFieldsEditor.statusEmoji": "Status emoji",
    "profileFieldsEditor.pickAStatusEmoji": "Pick a status emoji",
    "profileFieldsEditor.onHolidayUntilThe23rd": "On holiday until the 23rd",
    "profileFieldsEditor.statusText": "Status text",
    "profileFieldsEditor.bio": "Bio",
    "profileFieldsEditor.tellPeopleAboutYourself": "Tell people about yourself",
    "profileFieldsEditor.timezone": "Timezone",
    "profileFieldsEditor.timezoneRegion": "Timezone region",
    "profileFieldsEditor.notSet": "Not set",
    "profileFieldsEditor.timezoneCity": "Timezone city",
    "profileFieldsEditor.chooseACity": "Choose a city",
    "profileFieldsEditor.europeLondon": "Europe/London",
    "profileFieldsEditor.useMine": "Use mine",
    "profileFieldsEditor.usernameColour": "Username colour",
    "profileFieldsEditor.usernameColourOnDarkThemes":
        "Username colour on dark themes",
    "profileFieldsEditor.darkThemes": "dark themes",
    "profileFieldsEditor.usernameColourOnLightThemes":
        "Username colour on light themes",
    "profileFieldsEditor.lightThemes": "light themes",
    "profileFieldsEditor.resetToDefault": "Reset to default",
    "profileFieldsEditor.chooseAColour": "Choose a colour",
    "profileFieldsEditor.oneColourForDarkThemesAnd":
        "One colour for dark themes and one for light, so your name stays readable either way.",
    "profileFieldsEditor.links": "Links",
    "profileFieldsEditor.label": "Label",
    "profileFieldsEditor.linkLabel": "Link label",
    "profileFieldsEditor.httpsExampleOrg": "https://example.org",
    "profileFieldsEditor.linkAddress": "Link address",
    "profileFieldsEditor.removeLink": "Remove link",
    "profileFieldsEditor.addLink": "Add link",
    "profileFieldsEditor.saved": "Saved",
    "profileFieldsEditor.useATimezoneNameLikeEurope":
        "Use a timezone name like Europe/London.",
    "profileFieldsEditor.chooseACity2": "Choose a city.",
    "profileFieldsEditor.bannerUploadFailed": "Banner upload failed",
    "profileFieldsEditor.failedToSaveProfileFields":
        "Failed to save profile fields",

    // src/lib/components/layout/ProfileFooter.svelte
    "profileFooter.dismiss": "Dismiss",
    "profileFooter.switchAccounts": "Switch accounts",
    "profileFooter.unknown": "Unknown",

    // src/lib/components/settings/PushDiagnostics.svelte
    "pushDiagnostics.pushGateway": "Push Gateway",
    "pushDiagnostics.notificationRelay": "Notification relay",
    "pushDiagnostics.pushNotificationsAreRelayedThroughThis":
        "Push notifications are relayed through this gateway. It can see which rooms and senders notify you, but never your message text.",
    "pushDiagnostics.warningYourHomeserverIsRoutingThis":
        "Warning: your homeserver is routing this device's push notifications to a different gateway ({join}). That gateway, not the one above, sees your notification metadata.",
    "pushDiagnostics.verifiedYourHomeserverRoutesNotificationsTo":
        "Verified: your homeserver routes notifications to this gateway.",
    "pushDiagnostics.noPushNotificationsAreRegisteredOn":
        "No push notifications are registered on this account yet.",

    // src/lib/components/ui/QrCodeImage.svelte
    "qrCodeImage.couldNotRenderTheVerificationCode":
        "Could not render the verification code.",
    "qrCodeImage.qrCodeForDeviceVerification":
        "QR code for device verification",

    // src/lib/components/layout/QuickActions.svelte
    "quickActions.newDm": "New DM",
    "quickActions.createRoomInSpace": "Create room in space",
    "quickActions.createNewRoom": "Create new room",
    "quickActions.createNewSpace": "Create new space",
    "quickActions.joinRoomByAddress": "Join room by address",
    "quickActions.createARoom": "Create a room",
    "quickActions.createASpace": "Create a space",
    "quickActions.newDirectMessage": "New direct message",
    "quickActions.joinARoom": "Join a room",
    "quickActions.spaceName": "Space name",
    "quickActions.roomName": "Room name",
    "quickActions.mySpace": "My Space",
    "quickActions.optional": "(optional)",
    "quickActions.whatSThisSpaceAbout": "What's this space about?",
    "quickActions.whatSThisRoomAbout": "What's this room about?",
    "quickActions.opensStraightIntoACallMessages":
        "Opens straight into a call. Messages still work.",
    "quickActions.enableEncryption": "Enable encryption",
    "quickActions.canTBeTurnedOffLater": "Can't be turned off later.",
    "quickActions.findSomeoneToMessage": "Find someone to message…",
    "quickActions.encryptThisDm": "Encrypt this DM",
    "quickActions.openTheDm": "Open the DM",
    "quickActions.roomAddressOrId": "Room address or ID",
    "quickActions.roomServerCom": "#room:server.com",
    "quickActions.requestSentYouLlBeAble":
        "Request sent - you'll be able to join once someone lets you in.",
    "quickActions.youCanTJoinThisRoom":
        "You can't join this room directly, but you can request to join it.",
    "quickActions.requestToJoin": "Request to join",
    "quickActions.create": "Create",
    "quickActions.somethingWentWrong": "Something went wrong",
    "quickActions.enterARoomAddressRoomServer":
        "Enter a room address (#room:server.com) or room ID (!id:server.com)",
    "quickActions.couldNotSendTheJoinRequest":
        "Could not send the join request",

    // src/lib/components/messages/ReactorPopover.svelte
    "reactorPopover.more": "+{overflow} more",
    "reactorPopover.reactedWith": "Reacted with {label}",
    "reactorPopover.userList": "User list",

    // src/lib/components/messages/RenameAttachmentDialog.svelte
    "renameAttachmentDialog.editAttachment": "Edit attachment",
    "renameAttachmentDialog.filename": "Filename",

    // src/lib/components/layout/RoomDirectory.svelte
    "roomDirectory.exploreRooms": "Explore rooms",
    "roomDirectory.onYourHomeserver": "on your homeserver",
    "roomDirectory.publicRooms": "Public rooms {value}",
    "roomDirectory.rooms": "· ~{totalEstimate} rooms",
    "roomDirectory.searchRooms": "Search rooms…",
    "roomDirectory.serverOptional": "Server (optional)",
    "roomDirectory.search": "Search",
    "roomDirectory.noRoomsFound": "No rooms found.",
    "roomDirectory.space": "Space",
    "roomDirectory.open": "Open",
    "roomDirectory.thisRoomRequiresAKnockNot":
        "This room requires a knock - not supported yet",
    "roomDirectory.knockOnly": "Knock only",
    "roomDirectory.somethingWentWrong": "Something went wrong",

    // src/lib/components/layout/RoomHeaderOverflowMenu.svelte
    "roomHeaderOverflowMenu.moreRoomOptions": "More room options",
    "roomHeaderOverflowMenu.unread": "unread",
    "roomHeaderOverflowMenu.badgeThreads":
        "{count, plural, one {{badge} unread mention} other {{badge} unread mentions}}",
    "roomHeaderOverflowMenu.badgePinned":
        "{count, plural, one {{badge} pinned message} other {{badge} pinned messages}}",
    "roomHeaderOverflowMenu.badgeNotifications":
        "{count, plural, one {{badge} unread notification} other {{badge} unread notifications}}",
    "roomHeaderOverflowMenu.badgeMedia":
        "{count, plural, one {{badge} item} other {{badge} items}}",
    "roomHeaderOverflowMenu.badgeMembers":
        "{count, plural, one {{badge} member} other {{badge} members}}",

    // src/lib/components/layout/RoomList.svelte
    "roomList.doneReordering": "Done reordering",
    "roomList.reorderRooms": "Reorder rooms",
    "roomList.spaceSettings": "Space Settings",
    "roomList.pendingInvites": "Pending Invites",
    "roomList.inVoice": "{name} - in voice",
    "roomList.orderValue": "Order value",
    "roomList.roomSettings": "Room settings",
    "roomList.favourites": "Favourites",
    "roomList.channels": "Channels",
    "roomList.rooms": "Rooms",
    "roomList.lowPriority": "Low Priority",
    "roomList.browseRooms": "Browse Rooms",
    "roomList.members": "{numMembers} members",
    "roomList.requested": "Requested",
    "roomList.cancelRequest": "Cancel request",
    "roomList.youCanTJoinThisRoom":
        "You can't join this room directly - request to join instead?",
    "roomList.notNow": "Not now",
    "roomList.requestToJoin": "Request to join",
    "roomList.directMessages": "Direct Messages",
    "roomList.noRoomsYet": "No rooms yet",
    "roomList.copyRoomLink": "Copy Room Link",
    "roomList.markAsRead": "Mark as Read",
    "roomList.addToSpace": "Add to Space",
    "roomList.clickAgainToLeave": "Click again to leave",
    "roomList.leaveRoom": "Leave Room",
    "roomList.couldNotSendTheJoinRequest": "Could not send the join request",
    "roomList.orderMustBeBetween0And":
        "Order must be between 0 and 1 - used {value} instead.",
    "roomList.failedToSetOrder": "Failed to set order",

    // src/lib/components/layout/RoomMediaPanel.svelte
    "roomMediaPanel.media": "Media",
    "roomMediaPanel.closeMediaPanel": "Close media panel",
    "roomMediaPanel.media2": "Media ({length}{value})",
    "roomMediaPanel.files": "Files ({length}{value})",
    "roomMediaPanel.tryAgain": "Try again",
    "roomMediaPanel.play": "{name} - play",
    "roomMediaPanel.video": "Video",
    "roomMediaPanel.audio": "Audio",
    "roomMediaPanel.file": "File",
    "roomMediaPanel.decryptingMedia": "Decrypting media",
    "roomMediaPanel.decryptingMedia2": "Decrypting media...",
    "roomMediaPanel.mediaCouldNotBeLoaded": "Media could not be loaded",
    "roomMediaPanel.couldNotLoadThisMedia": "Could not load this media.",
    "roomMediaPanel.noMediaFoundInTheLast":
        "No media found in the last few hundred messages.",
    "roomMediaPanel.noFilesFoundInTheLast":
        "No files found in the last few hundred messages.",
    "roomMediaPanel.noImagesOrVideosInThis":
        "No images or videos in this room yet.",
    "roomMediaPanel.noFilesInThisRoomYet": "No files in this room yet.",
    "roomMediaPanel.couldNotLoadMedia": "Could not load media.",
    "roomMediaPanel.couldNotLoadMoreMedia": "Could not load more media.",
    "roomMediaPanel.failedToDownloadAttachment":
        "Failed to download attachment",

    // src/lib/components/layout/RoomSettings.svelte
    "roomSettings.closeSettings": "Close settings",
    "roomSettings.backToSettings": "Back to settings",
    "roomSettings.settings": "{name} - Settings",
    "roomSettings.roomAvatar": "Room Avatar",
    "roomSettings.roomName": "Room Name",
    "roomSettings.saved": "Saved!",
    "roomSettings.saveChanges": "Save Changes",
    "roomSettings.advanced": "Advanced",
    "roomSettings.spaceId": "Space ID",
    "roomSettings.roomId": "Room ID",
    "roomSettings.copied": "Copied!",
    "roomSettings.roomVersionV": "Room version: v{getVersion}",
    "roomSettings.upgradeRoom": "Upgrade room…",
    "roomSettings.thisCreatesANewRoomOn":
        "This creates a new room on v{recommendedVersion} and marks this one as replaced. Members will be pointed to the new room.",
    "roomSettings.upgrading": "Upgrading…",
    "roomSettings.upgradeRoom2": "Upgrade room",
    "roomSettings.whoCanJoin": "Who can join?",
    "roomSettings.spaceMembersAnyoneInCanJoin":
        "Space members - anyone in {parentSpaceNames} can join",
    "roomSettings.spaceMembersAnyoneInTheParent":
        "Space members - anyone in the parent space can join",
    "roomSettings.messageHistory": "Message History",
    "roomSettings.guestAccess": "Guest Access",
    "roomSettings.allowGuestsToJoinWithoutAn":
        "Allow guests to join without an account",
    "roomSettings.guestsAreAnonymousAccountsTheHomeserver":
        "Guests are anonymous accounts the homeserver creates on demand. Many servers disable guest registration entirely, in which case this has no effect.",
    "roomSettings.discoverability": "Discoverability",
    "roomSettings.addresses": "Addresses",
    "roomSettings.loadingAddresses": "Loading addresses…",
    "roomSettings.noAddressesYet": "No addresses yet.",
    "roomSettings.main": "Main",
    "roomSettings.remove": "Remove {alias}",
    "roomSettings.mainAddress": "Main address",
    "roomSettings.noMainAddress": "No main address",
    "roomSettings.set": "Set",
    "roomSettings.myRoom": "my-room",
    "roomSettings.serverAccessControl": "Server access control",
    "roomSettings.controlWhichHomeserversMayParticipateIn":
        "Control which homeservers may participate in this room. Wildcards:",
    "roomSettings.matchesAnyCharacters": "matches any characters,",
    "roomSettings.matchesOneDeniedServersAreRemoved":
        "matches one. Denied servers are removed from federation for this room.",
    "roomSettings.noServerAclIsSetAll":
        "No server ACL is set. All servers may participate.",
    "roomSettings.allowedServersOnePerLine": "Allowed servers (one per line)",
    "roomSettings.deniedServersOnePerLine": "Denied servers (one per line)",
    "roomSettings.allowServersIdentifiedByARaw":
        "Allow servers identified by a raw IP address",
    "roomSettings.saveServerAcl": "Save server ACL",
    "roomSettings.youDoNotHavePermissionTo":
        "You do not have permission to edit the server ACL for this room.",
    "roomSettings.appliesToTheSpaceAndAll":
        "Applies to the space and all its rooms.",
    "roomSettings.notificationLevel": "Notification level",
    "roomSettings.encryption": "Encryption",
    "roomSettings.encrypted": "Encrypted",
    "roomSettings.notEncrypted": "Not encrypted",
    "roomSettings.messagesInThisRoomAreEnd":
        "Messages in this room are end-to-end encrypted. This can't be turned off.",
    "roomSettings.enableEncryption": "Enable encryption",
    "roomSettings.typeToConfirm":
        "Type {ENABLE_ENCRYPTION_CONFIRM_PHRASE} to confirm",
    "roomSettings.enabling": "Enabling…",
    "roomSettings.powerLevelRequiredForEachAction":
        "Power level required for each action (0–100).",
    "roomSettings.joinCallsVoiceVideo": "Join calls (voice/video)",
    "roomSettings.invite": "Invite",
    "roomSettings.searchMembers": "Search members…",
    "roomSettings.banned": "Banned ({length})",
    "roomSettings.pendingJoinRequests": "Pending join requests ({length})",
    "roomSettings.deny": "Deny",
    "roomSettings.approve": "Approve",
    "roomSettings.unban": "Unban",
    "roomSettings.noBannedMembers": "No banned members",
    "roomSettings.you": " (you)",
    "roomSettings.setRole": "Set role…",
    "roomSettings.admin100": "Admin (100)",
    "roomSettings.moderator50": "Moderator (50)",
    "roomSettings.member0": "Member (0)",
    "roomSettings.muted1": "Muted (-1)",
    "roomSettings.kick": "Kick",
    "roomSettings.ban": "Ban",
    "roomSettings.hideThisUserSMessagesEverywhere":
        "Hide this user's messages everywhere (stored on your account)",
    "roomSettings.setThe": "Set the",
    "roomSettings.fieldOnEachChildRoomTo":
        "field on each child room to control sort order (lexicographic). Leave blank to sort by creation time.",
    "roomSettings.suggested": "Suggested",
    "roomSettings.removeSuggestedHint": "Remove suggested hint",
    "roomSettings.markAsSuggested": "Mark as suggested",
    "roomSettings.unsuggest": "Unsuggest",
    "roomSettings.suggest": "Suggest",
    "roomSettings.order": "order",
    "roomSettings.removeFromSpace": "Remove from space",
    "roomSettings.noChildRooms": "No child rooms",
    "roomSettings.useYourGlobalNotificationSettings":
        "Use your global notification settings.",
    "roomSettings.allMessages": "All Messages",
    "roomSettings.notifyForEveryMessage": "Notify for every message.",
    "roomSettings.mentionsOnly": "Mentions Only",
    "roomSettings.notifyOnlyForMentionsAndKeywords":
        "Notify only for @mentions and keywords.",
    "roomSettings.neverNotify": "Never notify.",
    "roomSettings.failedToUpdateNotifications":
        "Failed to update notifications.",
    "roomSettings.failedToEnableEncryption": "Failed to enable encryption",
    "roomSettings.failedToSave": "Failed to save",
    "roomSettings.uploadFailed": "Upload failed",
    "roomSettings.failedToUpgradeRoom": "Failed to upgrade room",
    "roomSettings.failedToSaveServerAcl": "Failed to save server ACL",
    "roomSettings.couldNotChangeVisibility": "Could not change visibility",
    "roomSettings.couldNotLoadThisRoomS":
        "Could not load this room's addresses",
    "roomSettings.couldNotAddThatAddress": "Could not add that address",
    "roomSettings.thisAddressIsPublishedAsOne":
        "This address is published as one of the room's addresses and you don't have permission to unpublish it, so it can't be removed. Ask a room admin.",
    "roomSettings.couldNotRemoveThatAddress": "Could not remove that address",
    "roomSettings.couldNotSetTheMainAddress": "Could not set the main address",
    "roomSettings.failed": "Failed",
    "roomSettings.muted": "Muted",
    "roomSettings.admin": "Admin",
    "roomSettings.moderator": "Moderator",
    "roomSettings.member": "Member",
    "roomSettings.failedToUpdateSuggestion": "Failed to update suggestion",
    "roomSettings.listThisRoomInTheServerDirectory":
        "List this room in the server directory",
    "roomSettings.listThisSpaceInTheServerDirectory":
        "List this space in the server directory",
    "roomSettings.listsTheRoomByIdBeingFound":
        "Lists the room by ID. Being found by name also needs a published address - add one below.",
    "roomSettings.listsTheSpaceByIdBeingFound":
        "Lists the space by ID. Being found by name also needs a published address - add one below.",
    "roomSettings.aPublishedAddressLetsPeopleFindRoom":
        "A published address lets people find and join this room by name instead of by ID.",
    "roomSettings.aPublishedAddressLetsPeopleFindSpace":
        "A published address lets people find and join this space by name instead of by ID.",
    "roomSettings.chooseHowThisRoomNotifiesYou":
        "Choose how this room notifies you.",
    "roomSettings.chooseHowThisSpaceNotifiesYou":
        "Choose how this space notifies you.",

    // src/lib/components/layout/ScreenSharePicker.svelte
    "screenSharePicker.chooseWhatToShare": "Choose what to share",
    "screenSharePicker.noPreview": "No preview",

    // src/lib/components/layout/ScreenShareQualityChips.svelte
    "screenShareQualityChips.resolution": "Resolution",
    "screenShareQualityChips.frameRate": "Frame rate",
    "screenShareQualityChips.fps": "{f} FPS",
    "screenShareQualityChips.shareSystemAudio": "Share system audio",
    "screenShareQualityChips.appliesToNextShare": "Applies to next share",
    "screenShareQualityChips.shareSystemAudioAppliesToNext":
        "Share system audio (applies to next share)",

    // src/lib/components/layout/ScreenShareQualityPopover.svelte
    "screenShareQualityPopover.goLive": "Go Live",
    "screenShareQualityPopover.screenShareQuality": "Screen share quality",

    // src/lib/components/settings/SecuritySettings.svelte
    "securitySettings.showingTheLastReadingThatLoaded":
        "Showing the last reading that loaded - it may be out of date.",
    "securitySettings.securityEncryption": "Security & Encryption",
    "securitySettings.setUpRecoverySoYourCross":
        "Set up recovery so your cross-signing identity and encrypted message history survive signing out on every device.",
    "securitySettings.verification": "Verification",
    "securitySettings.loadingEncryptionStatus": "Loading encryption status…",
    "securitySettings.encryptionStatusUnknownOnThisSession":
        "Encryption status unknown on this session.",
    "securitySettings.recoveryKeyId": "Recovery key ID:",
    "securitySettings.setUpRecovery": "Set up recovery",
    "securitySettings.weLlCreateA": "We'll create a",
    "securitySettings.recoveryKey": "recovery key",
    "securitySettings.aOneTimeCodeThatUnlocks":
        "- a one-time code that unlocks your encrypted history and verifies new sessions. Store it somewhere safe like a password manager; it's shown only once and we can't recover it for you.",
    "securitySettings.confirmYourAccountPasswordToCreate":
        "Confirm your account password to create your encryption keys.",
    "securitySettings.accountPassword": "Account password",
    "securitySettings.alsoLetMeUnlockWithA":
        "Also let me unlock with a passphrase I choose (optional - your recovery key still works and is still shown).",
    "securitySettings.recoveryPassphrase": "Recovery passphrase",
    "securitySettings.atLeastCharactersWeCanT":
        "At least {MIN_PASSPHRASE_LENGTH} characters. We can't reset it for you.",
    "securitySettings.settingUp": "Setting up…",
    "securitySettings.continue": "Continue",
    "securitySettings.saveYourRecoveryKey": "Save your recovery key",
    "securitySettings.thisIsShown": "This is shown",
    "securitySettings.onlyOnce": "only once",
    "securitySettings.storeItNowWithoutItYou":
        ". Store it now - without it you can't recover your encrypted history if you lose access to your sessions.",
    "securitySettings.copied": "Copied ✓",
    "securitySettings.copyKey": "Copy key",
    "securitySettings.youCanAlsoUnlockWithThe":
        "You can also unlock with the passphrase you chose. Keep the key anyway - it's the only way in if you forget the passphrase.",
    "securitySettings.iVeSavedMyRecoveryKey":
        "I've saved my recovery key somewhere safe.",
    "securitySettings.done": "Done",
    "securitySettings.recoveryIsSetUp": "Recovery is set up",
    "securitySettings.yourCrossSigningKeysAndA":
        "Your cross-signing keys and a key backup are stored securely on the server, protected by your recovery key.",
    "securitySettings.recoveryIsNotSetUp": "Recovery is not set up",
    "securitySettings.thisAccountHasNoRecoveryKey":
        "This account has no recovery key and no key backup until you finish the step below.",
    "securitySettings.lostYourRecoveryKeyResetRecovery":
        "Lost your recovery key? Reset recovery",
    "securitySettings.resettingCreatesA": "Resetting creates a",
    "securitySettings.new": "new",
    "securitySettings.recoveryKeyAndReplacesYourCurrent":
        "recovery key and replaces your current backup. Your old recovery key stops working and other sessions may need re-verifying. Only do this if you've lost your current key.",
    "securitySettings.yourOldRecoveryKeyAndBackup":
        "Your old recovery key and backup were reset, but the new recovery wasn't created. Finish setting it up now - your messages can't be recovered on a new session until you do.",
    "securitySettings.working": "Working…",
    "securitySettings.finishSettingUpRecovery": "Finish setting up recovery",
    "securitySettings.confirmYourAccountPasswordToReset":
        "Confirm your account password to reset recovery.",
    "securitySettings.resetting": "Resetting…",
    "securitySettings.resetCreateNewKey": "Reset & create new key",
    "securitySettings.messageHistoryBackup": "Message history backup",
    "securitySettings.verifyThisSessionRestoreHistory":
        "Verify this session & restore history",
    "securitySettings.recoveryKey2": "Recovery key",
    "securitySettings.passphrase": "Passphrase",
    "securitySettings.enterYour": "Enter your",
    "securitySettings.recoveryPassphrase2": "recovery passphrase",
    "securitySettings.toVerifyThisSessionAndRestore":
        "to verify this session and restore your encrypted message history.",
    "securitySettings.thisSessionIsNowVerified": "This session is now verified",
    "securitySettings.encryptedHistoryRestored": "Encrypted history restored",
    "securitySettings.couldNotSetUpRecovery": "Could not set up recovery",
    "securitySettings.couldNotResetRecovery": "Could not reset recovery",
    "securitySettings.couldNotFinishSettingUpRecovery":
        "Could not finish setting up recovery",
    "securitySettings.couldNotVerifyThisSession":
        "Could not verify this session",

    // src/lib/components/settings/ServerSettings.svelte
    "serverSettings.scanningServer": "Scanning server…",
    "serverSettings.what": "What",
    "serverSettings.advertisesItemsMarkedUnknownArenT":
        "advertises. Items marked “Unknown” aren’t advertised by the server and are detected only when used.",
    "serverSettings.accountMessaging": "Account & messaging",
    "serverSettings.voiceVideoCallingMatrixrtc":
        "Voice / video calling (MatrixRTC)",
    "serverSettings.server": "Server",
    "serverSettings.latestSpecVersion": "Latest spec version",
    "serverSettings.defaultRoomVersion": "Default room version",
    "serverSettings.advertisedFeatures": "Advertised features ({length})",
    "serverSettings.supported": "Supported",
    "serverSettings.notSupported": "Not supported",
    "serverSettings.unknown": "Unknown",
    "serverSettings.changePassword": "Change password",
    "serverSettings.changeDisplayName": "Change display name",
    "serverSettings.changeAvatar": "Change avatar",
    "serverSettings.manageEmailsPhoneNumbers": "Manage emails / phone numbers",
    "serverSettings.threads": "Threads",
    "serverSettings.privateReadReceipts": "Private read receipts",
    "serverSettings.sfuDiscoveryRtcFoci": "SFU discovery (rtc_foci)",
    "serverSettings.delayedEventsCallCleanup": "Delayed events (call cleanup)",
    "serverSettings.failedToReadServerCapabilities":
        "Failed to read server capabilities",

    // src/lib/components/settings/SessionSettings.svelte
    "sessionSettings.sessionName": "Session name",
    "sessionSettings.current": "Current",
    "sessionSettings.rename": "Rename",
    "sessionSettings.signOut": "Sign out?",
    "sessionSettings.signOut2": "Sign out",
    "sessionSettings.confirmYourAccountPasswordToSign":
        "Confirm your account password to sign out this session.",
    "sessionSettings.accountPassword": "Account password",
    "sessionSettings.signingOut": "Signing out…",
    "sessionSettings.encryption": "Encryption",
    "sessionSettings.active": "Active",
    "sessionSettings.unavailable": "Unavailable",
    "sessionSettings.thisDeviceSKey": "This device's key",
    "sessionSettings.loadingDeviceKey": "Loading device key…",
    "sessionSettings.endToEndEncryptionCouldNot":
        "End-to-end encryption could not start on this session. Encrypted rooms will show placeholders.",
    "sessionSettings.encryptNewDirectMessages": "Encrypt new direct messages",
    "sessionSettings.newDmsYouStartAreEncrypted":
        "New DMs you start are encrypted by default. Existing DMs are left unchanged. Turn this off if you message people whose clients don't support encryption.",
    "sessionSettings.onlySendToVerifiedDevices":
        "Only send to verified devices",
    "sessionSettings.refuseToEncryptMessagesForSessions":
        "Refuse to encrypt messages for sessions you haven't verified. They will not receive your messages at all - including your own unverified sessions. Off by default.",
    "sessionSettings.devicesCurrentlySignedInToThis":
        "Devices currently signed in to this account.",
    "sessionSettings.refreshing": "Refreshing…",
    "sessionSettings.refresh": "Refresh",
    "sessionSettings.loadingSessions": "Loading sessions…",
    "sessionSettings.otherSessions": "Other sessions {value}",
    "sessionSettings.noOtherSessionsYouReOnly":
        "No other sessions - you're only signed in here.",
    "sessionSettings.failedToLoadSessions": "Failed to load sessions",
    "sessionSettings.failedToRenameSession": "Failed to rename session",
    "sessionSettings.failedToSignOutSession": "Failed to sign out session",
    "sessionSettings.couldNotStartVerification": "Could not start verification",

    // src/lib/components/messages/ShareLocationDialog.svelte
    "shareLocationDialog.shareLocation": "Share location",
    "shareLocationDialog.sendOnce": "Send once",
    "shareLocationDialog.shareLive": "Share live",
    "shareLocationDialog.locating": "Locating…",
    "shareLocationDialog.useMyCurrentLocation": "Use my current location",
    "shareLocationDialog.descriptionOptional": "Description (optional)",
    "shareLocationDialog.eGHomeTheCafOn": "e.g. Home, the café on 5th…",
    "shareLocationDialog.duration": "Duration",
    "shareLocationDialog.yourLiveLocationIsSharedWith":
        "Your live location is shared with this room until you stop or the timer ends.",
    "shareLocationDialog.sharing": "Sharing…",
    "shareLocationDialog.share": "Share",
    "shareLocationDialog.failedToStartLiveLocation":
        "Failed to start live location",
    "shareLocationDialog.failedToShareLocation": "Failed to share location",

    // src/lib/components/messages/ShareTargetSheet.svelte
    "shareTargetSheet.fileSWerenTAddedShares":
        "{droppedFiles} file(s) weren't added. Shares are limited to {SHARE_MAX_FILES} files, {value} MB each and {value2} MB in total.",
    "shareTargetSheet.addAMessage": "Add a message…",
    "shareTargetSheet.searchRooms": "Search rooms",
    "shareTargetSheet.noJoinedRoomsFound": "No joined rooms found",
    "shareTargetSheet.send": "Send",
    "shareTargetSheet.shareToARoom": "Share to a room",

    // src/lib/components/layout/SpaceLandingPanel.svelte
    "spaceLandingPanel.loadingRooms": "Loading rooms…",
    "spaceLandingPanel.browseRooms": "Browse rooms",
    "spaceLandingPanel.youHavenTJoinedARoom":
        "You haven't joined a room in {spaceName} yet. Pick one to get started.",
    "spaceLandingPanel.nothingJoinedHereYet": "Nothing joined here yet",
    "spaceLandingPanel.onlyOtherSpacesLiveInsideOpen":
        "Only other spaces live inside {spaceName}, open one from the room list to browse its rooms.",
    "spaceLandingPanel.thereAreNoRoomsInYet":
        "There are no rooms in {spaceName} yet.",
    "spaceLandingPanel.thisSpace": "this space",
    "spaceLandingPanel.couldnTJoinTryItFrom":
        "Couldn't join {value}. Try it from Browse Rooms in the room list.",
    "spaceLandingPanel.thatRoom": "that room",

    // src/lib/components/layout/SpaceSidebar.svelte
    "spaceSidebar.home": "Home",
    "spaceSidebar.addASpace": "Add a space",
    "spaceSidebar.exploreRooms": "Explore rooms",
    "spaceSidebar.folderColor": "Folder Color",
    "spaceSidebar.createRoomInSpace": "Create room in space",
    "spaceSidebar.roomName": "Room name",
    "spaceSidebar.myRoom": "my-room",
    "spaceSidebar.optional": "(optional)",
    "spaceSidebar.whatSThisRoomAbout": "What's this room about?",
    "spaceSidebar.opensStraightIntoACallMessages":
        "Opens straight into a call. Messages still work.",
    "spaceSidebar.create": "Create",
    "spaceSidebar.addExistingRoomToSpace": "Add existing room to space",
    "spaceSidebar.noRoomsAvailableToAdd": "No rooms available to add.",
    "spaceSidebar.spaceSettings": "Space Settings",
    "spaceSidebar.copySpaceLink": "Copy Space Link",
    "spaceSidebar.markAsRead": "Mark as Read",
    "spaceSidebar.createRoom": "Create Room",
    "spaceSidebar.addExistingRoom": "Add Existing Room",
    "spaceSidebar.removeFromFolder": "Remove from folder",
    "spaceSidebar.newFolder": "New Folder",
    "spaceSidebar.clickAgainToLeave": "Click again to leave",
    "spaceSidebar.leaveSpace": "Leave Space",
    "spaceSidebar.setColor": "Set Color",
    "spaceSidebar.dissolveFolder": "Dissolve Folder",
    "spaceSidebar.somethingWentWrong": "Something went wrong",

    // src/lib/components/layout/Splash.svelte
    "splash.restoringSession": "Restoring session…",

    // src/lib/components/ui/StickerPicker.svelte
    "stickerPicker.searchStickers": "Search stickers…",
    "stickerPicker.searchStickers2": "Search stickers",
    "stickerPicker.noStickerPacksAvailable": "No sticker packs available",
    "stickerPicker.myStickers": "My stickers",
    "stickerPicker.myStickers2": "My Stickers",

    // src/lib/components/ui/SwfEmbed.svelte
    "swfEmbed.adobeFlash": "Adobe Flash",

    // src/lib/components/settings/ThemeColorEditor.svelte
    "themeColorEditor.themeColors": "Theme colors",
    "themeColorEditor.presetName": "Preset name",
    "themeColorEditor.savePreset": "Save preset",
    "themeColorEditor.import": "Import",
    "themeColorEditor.pasteThemeCode": "Paste theme code",
    "themeColorEditor.copyCurrentPresetToClipboard":
        "Copy current preset to clipboard",
    "themeColorEditor.copied": "Copied!",
    "themeColorEditor.presets": "Presets",
    "themeColorEditor.delete": "Delete?",
    "themeColorEditor.confirmDelete": "Confirm delete {name}",
    "themeColorEditor.rename": "Rename",
    "themeColorEditor.delete2": "Delete {name}",
    "themeColorEditor.builtInPresetsAreReadOnly":
        "Built-in presets are read-only. Duplicate to customize:",
    "themeColorEditor.duplicateToCustomize": "Duplicate to customize",
    "themeColorEditor.colors": "Colors",
    "themeColorEditor.backgrounds": "Backgrounds",
    "themeColorEditor.resetToDefault": "Reset to default",
    "themeColorEditor.text": "Text",
    "themeColorEditor.accentsSemantics": "Accents & semantics",
    "themeColorEditor.presence": "Presence",
    "themeColorEditor.details": "Details",
    "themeColorEditor.contrastWarnings": "Contrast warnings",
    "themeColorEditor.messageDisplay": "Message display",
    "themeColorEditor.savedOnThisDeviceOnlyNot":
        "Saved on this device only. Not synced across your account.",
    "themeColorEditor.appTextSize": "App text size: {round}%",
    "themeColorEditor.scalesAllTextAndSpacingAcross":
        "Scales all text and spacing across the app.",
    "themeColorEditor.font": "Font",
    "themeColorEditor.custom": "Custom - {customFontName}",
    "themeColorEditor.replaceCustomFont": "Replace custom font…",
    "themeColorEditor.uploadCustomFont": "Upload custom font…",
    "themeColorEditor.woff2TtfOrOtfUpTo":
        ".woff2, .ttf, or .otf up to 10 MB. Stored on this device only.",
    "themeColorEditor.theQuickBrownFoxJumpsOver":
        "The quick brown fox jumps over the lazy dog.",
    "themeColorEditor.cannotSavePreset": "Cannot save preset",
    "themeColorEditor.notAValidThemeCode": "Not a valid theme code",
    "themeColorEditor.imported": "Imported",
    "themeColorEditor.cannotImportPreset": "Cannot import preset",
    "themeColorEditor.copy": "{activePresetName} (Copy)",

    // src/lib/components/layout/ThreadPanel.svelte
    "threadPanel.thread": "Thread",
    "threadPanel.collapseThread": "Collapse thread",
    "threadPanel.expandThread": "Expand thread",
    "threadPanel.closeThread": "Close thread",
    "threadPanel.noRepliesYetStartTheThread":
        "No replies yet. Start the thread below.",
    "threadPanel.loadOlderReplies": "Load older replies",

    // src/lib/components/layout/ThreadsListPanel.svelte
    "threadsListPanel.threads": "Threads",
    "threadsListPanel.closeThreadsPanel": "Close threads panel",
    "threadsListPanel.noThreadsInThisRoomYet": "No threads in this room yet.",
    "threadsListPanel.youParticipated": "You participated",
    "threadsListPanel.unreadMentions": "Unread mentions",
    "threadsListPanel.unreadReplies": "Unread replies",
    "threadsListPanel.couldnTLoadThreadsForThis":
        "Couldn't load threads for this room.",

    // src/lib/components/layout/UpdateBanner.svelte
    "updateBanner.dismissUpdateNotification": "Dismiss update notification",
    "updateBanner.installFailed": "Install failed",

    // src/lib/components/ui/UserPicker.svelte
    "userPicker.remove": "Remove {userId}",
    "userPicker.searching": "Searching…",
    "userPicker.noMatchingUsers": "No matching users",
    "userPicker.available":
        "{optionCount, plural, one {# result available} other {# results available}}",
    "userPicker.invite": "Invite {candidateShown}",
    "userPicker.alreadyAdded": "Already added",
    "userPicker.alreadyInThisRoom": "Already in this room",
    "userPicker.sendAnInviteToThisExact":
        "Send an invite to this exact user ID",
    "userPicker.noMatchesTypeAFullUser": "No matches. Type a full user ID like",
    "userPicker.userServer": "@user:server",
    "userPicker.toInviteSomeoneTheDirectoryDoesn":
        "to invite someone the directory doesn't list.",
    "userPicker.searchForPeople": "Search for people…",
    "userPicker.userSearchFailedYouCanStill":
        "User search failed - you can still enter a full user ID.",

    // src/lib/components/ui/UserProfileCard.svelte
    "userProfileCard.copyUserId": "Copy user ID",
    "userProfileCard.copied": "Copied",
    "userProfileCard.localTime": "{localTime} local time ({timezone})",
    "userProfileCard.notAMemberOfThisRoom": "Not a member of this room",
    "userProfileCard.mutualRooms": "Mutual rooms: {total}",
    "userProfileCard.more": "+{moreCount} more",
    "userProfileCard.opening": "Opening…",
    "userProfileCard.message": "Message",
    "userProfileCard.verifyUser": "Verify user",
    "userProfileCard.kicking": "Kicking…",
    "userProfileCard.confirmKick": "Confirm kick?",
    "userProfileCard.kick": "Kick",
    "userProfileCard.banning": "Banning…",
    "userProfileCard.confirmBan": "Confirm ban?",
    "userProfileCard.ban": "Ban",
    "userProfileCard.couldNotStartVerification": "Could not start verification",
    "userProfileCard.couldNotCopyToClipboard": "Could not copy to clipboard",
    "userProfileCard.couldNotOpenDm": "Could not open DM",
    "userProfileCard.couldNotKick": "Could not kick",
    "userProfileCard.couldNotBan": "Could not ban",

    // src/lib/components/layout/VerificationModal.svelte
    "verificationModal.thisSessionIsNowTrusted": "This session is now trusted.",
    "verificationModal.theirIdentityIsNowVerified":
        "Their identity is now verified.",
    "verificationModal.noTrustWasEstablishedYouCan":
        "No trust was established. You can start again anytime.",
    "verificationModal.didYourOtherSessionJustScan":
        "Did your other session just scan this code?",
    "verificationModal.didJustScanThisCode":
        "Did {otherUserId} just scan this code?",
    "verificationModal.onlyConfirmIfYouScannedIt":
        "Only confirm if you scanned it yourself, just now.",
    "verificationModal.onlyConfirmIfYouWatchedThem":
        "Only confirm if you watched them scan it, just now.",
    "verificationModal.no": "No",
    "verificationModal.yesIScannedIt": "Yes, I scanned it",
    "verificationModal.deviceWithThisUser": "device with this user",
    "verificationModal.confirmTheSameEmojiAppearIn":
        "Confirm the same emoji appear, in the same order, on your other {value}.",
    "verificationModal.theyDonTMatch": "They don't match",
    "verificationModal.confirming": "Confirming…",
    "verificationModal.theyMatch": "They match",
    "verificationModal.verificationCodeForYourOtherSession":
        "Verification code for your other session",
    "verificationModal.verificationCodeFor":
        "Verification code for {otherUserId}",
    "verificationModal.scanThisWithYourOtherSession":
        "Scan this with your other session.",
    "verificationModal.askThemToScanThisCode": "Ask them to scan this code.",
    "verificationModal.noCodeToShowRightNow": "No code to show right now.",
    "verificationModal.couldNotLoadTheScanner": "Could not load the scanner.",
    "verificationModal.scanAgain": "Scan again",
    "verificationModal.compareAShortListOfEmoji":
        "Compare a short list of emoji to verify, or use a QR code.",
    "verificationModal.compareEmoji": "Compare emoji",
    "verificationModal.showACodeForTheOther":
        "Show a code for the other side to scan",
    "verificationModal.scanTheirCodeWithTheCamera":
        "Scan their code with the camera",
    "verificationModal.chooseADifferentMethod": "Choose a different method",
    "verificationModal.waitingForTheOtherSideTo":
        "Waiting for the other side to confirm…",
    "verificationModal.verifyYourOtherSession": "Verify your other session",
    "verificationModal.verify": "Verify {value}",
    "verificationModal.couldNotConfirmTheMatch": "Could not confirm the match",
    "verificationModal.couldNotReportTheMismatch":
        "Could not report the mismatch",
    "verificationModal.session": "session",

    // src/lib/components/layout/VideoTile.svelte
    "videoTile.fullscreen": "Fullscreen",

    // src/lib/components/settings/VoiceAudioSettings.svelte
    "voiceAudioSettings.inputDevice": "Input device",
    "voiceAudioSettings.savedMicrophoneNotFoundUsingThe":
        "Saved microphone not found - using the default until it returns.",
    "voiceAudioSettings.microphoneLevel": "Microphone level",
    "voiceAudioSettings.stopTest": "Stop test",
    "voiceAudioSettings.testMic": "Test mic",
    "voiceAudioSettings.outputDevice": "Output device",
    "voiceAudioSettings.chooseOutputDevice": "Choose output device…",
    "voiceAudioSettings.audioOutputIsRoutedByThe":
        "Audio output is routed by the operating system on this platform.",
    "voiceAudioSettings.testSpeaker": "Test speaker",
    "voiceAudioSettings.callVolume": "Call volume",
    "voiceAudioSettings.incomingCallAudio": "Incoming call audio",
    "voiceAudioSettings.incomingCallAudioIfThisMoves":
        "Incoming call audio - if this moves but you hear nothing, check the selected output device and system volume.",
    "voiceAudioSettings.voiceProcessing": "Voice processing",
    "voiceAudioSettings.noiseSuppression": "Noise suppression",
    "voiceAudioSettings.echoCancellation": "Echo cancellation",
    "voiceAudioSettings.autoGainControl": "Auto gain control",
    "voiceAudioSettings.camera": "Camera",
    "voiceAudioSettings.mirrorMyCamera": "Mirror my camera",
    "voiceAudioSettings.flipYourOwnPreviewOthersAlways":
        "Flip your own preview. Others always see you un-mirrored.",
    "voiceAudioSettings.stopPreview": "Stop preview",
    "voiceAudioSettings.preview": "Preview",
    "voiceAudioSettings.callSounds": "Call sounds",
    "voiceAudioSettings.playCallSounds": "Play call sounds",
    "voiceAudioSettings.soundVolume": "Sound volume",
    "voiceAudioSettings.ringing": "Ringing",
    "voiceAudioSettings.ringForIncomingDmCalls": "Ring for incoming DM calls",
    "voiceAudioSettings.directMessagesRingRoomsNeverDo":
        "Direct messages ring. Rooms never do - you join those from the room itself.",
    "voiceAudioSettings.ringtoneVolume": "Ringtone volume",
    "voiceAudioSettings.microphoneUnavailableCheckBrowserPermissions":
        "Microphone unavailable - check browser permissions",
    "voiceAudioSettings.cameraUnavailableCheckBrowserPermissions":
        "Camera unavailable - check browser permissions",

    // src/lib/components/layout/VoiceCallPanel.svelte
    "voiceCallPanel.enableAudio": "Enable audio",
    "voiceCallPanel.openCallView": "Open call view",
    "voiceCallPanel.unmute": "Unmute",
    "voiceCallPanel.undeafen": "Undeafen",
    "voiceCallPanel.deafen": "Deafen",
    "voiceCallPanel.disconnect": "Disconnect",

    // src/lib/components/messages/VoiceMessagePlayer.svelte
    "voiceMessagePlayer.seek": "Seek",
    "voiceMessagePlayer.voiceMessage": "Voice message",

    // src/lib/components/messages/VoiceRecorder.svelte
    "voiceRecorder.cancelRecording": "Cancel recording",
    "voiceRecorder.stop": "Stop",
    "voiceRecorder.discard": "Discard",
    "voiceRecorder.discardRecording": "Discard recording",
    "voiceRecorder.voiceMessage": "Voice message",
    "voiceRecorder.sending": "Sending…",
    "voiceRecorder.send": "Send",
    "voiceRecorder.microphoneAccessWasDenied": "Microphone access was denied.",
    "voiceRecorder.recordingFailed": "Recording failed.",
    "voiceRecorder.nothingWasRecorded": "Nothing was recorded.",
    "voiceRecorder.failedToSendVoiceMessage": "Failed to send voice message",

    // src/lib/components/settings/WhatsNew.svelte
    "whatsNew.whatSNew": "What's New",
    "whatsNew.loadingReleaseNotes": "Loading release notes…",
    "whatsNew.releaseNotesUnavailable": "Release notes unavailable.",
    "whatsNew.viewOnGithub": "View on GitHub",

    // src/lib/components/layout/WhatsNewModal.svelte
    "whatsNewModal.whatSNew": "What's New",
    "whatsNewModal.whatSNewInV": "What's New in v{APP_VERSION}",
    "whatsNewModal.releaseNotesUnavailable": "Release notes unavailable.",
    "whatsNewModal.viewOnGithub": "View on GitHub",
    "whatsNewModal.gotIt": "Got it",

    // src/lib/components/layout/VerificationRequestCard.svelte
    "verificationRequestCard.verifyYourOtherSession":
        "Verify your other session",
    "verificationRequestCard.verificationRequest": "Verification request",
    "verificationRequestCard.anotherOfYourSessions": "Another of your sessions",

    // src/lib/components/messages/CallEventCard.svelte
    "callEventCard.missedCall": "Missed call",
    "callEventCard.ongoingCall": "Ongoing call",
    "callEventCard.callEnded": "Call ended",

    // src/lib/components/messages/ComposerActionsMenu.svelte
    "composerActionsMenu.uploadAFile": "Upload a file",
    "composerActionsMenu.createPoll": "Create poll",
    "composerActionsMenu.recordVoiceMessage": "Record voice message",
    "composerActionsMenu.shareLocation": "Share location",
    "composerActionsMenu.createThread": "Create thread",

    // src/lib/components/messages/Reactions.svelte
    "reactions.couldNotAddReaction": "Could not add reaction",

    // src/lib/components/ui/QrScanner.svelte
    "qrScanner.startingTheCamera": "Starting the camera…",
    "qrScanner.cameraAccessWasDenied": "Camera access was denied.",
    "qrScanner.noCameraWasFoundOnThis": "No camera was found on this device.",
    "qrScanner.theCameraIsAlreadyInUse":
        "The camera is already in use by another app.",
    "qrScanner.couldNotOpenTheCameraA":
        "Could not open the camera. A secure (https) connection is required.",
    "qrScanner.codeFoundCheckingIt": "Code found - checking it…",
    "qrScanner.couldNotStartVerificationWithThat":
        "Could not start verification with that code.",
    "qrScanner.thatIsnTAVerificationCode": "That isn't a verification code.",
    "qrScanner.thisDeviceHasNoCameraAvailable":
        "This device has no camera available.",
    "qrScanner.couldNotStartTheCameraPreview":
        "Could not start the camera preview.",
    "qrScanner.pointTheCameraAtTheirCode": "Point the camera at their code.",

    // src/lib/desktopContextMenu.ts
    "desktopContextMenu.failedToSaveImage": "Failed to save image",

    // src/lib/matrix/client.ts
    "client.serverAutoDiscoveryFailedUsingThe":
        "Server auto-discovery failed - using the address as typed",
    "client.discoveredHomeserverFailedValidation":
        "Discovered homeserver failed validation",
    "client.thisHomeserverDoesnTSupportSliding":
        "This homeserver doesn't support sliding sync, so classic sync is being used instead.",
    "client.notLoggedIn": "Not logged in",
    "client.thisEventTypeCannotBeForwarded":
        "This event type cannot be forwarded",
    "client.notConnected": "Not connected",
    "client.thisServerDoesNotAllowSigning":
        "This server does not allow signing out sessions with a password - use its account page instead.",
    "client.incorrectPassword": "Incorrect password",
    "client.thisServerDoesNotAllowConfirming":
        "This server does not allow confirming this action with a password - use its account page instead.",
    "client.directMessages": "Direct messages",
    "client.messagesInDirectMessageRooms": "Messages in direct message rooms",
    "client.rooms": "Rooms",
    "client.messagesInAllOtherRooms": "Messages in all other rooms",
    "client.fullMatrixIdMentions": "Full Matrix ID mentions",
    "client.messagesUsingYourFullUserHomeserver":
        "Messages using your full @user:homeserver ID",
    "client.displayNameMentions": "Display name mentions",
    "client.messagesContainingYourDisplayName":
        "Messages containing your display name",
    "client.usernameMentions": "Username mentions",
    "client.messagesContainingYourUsernameWithoutServer":
        "Messages containing your username (without server)",
    "client.roomMentions": "@room mentions",
    "client.messagesUsingRoomToNotifyEveryone":
        "Messages using @room to notify everyone",
    "client.invitations": "Invitations",
    "client.whenYouAreInvitedToA": "When you are invited to a room",
    "client.thisRoom": "this room",
    "client.keywordCannotStartWith": "Keyword cannot start with '.'",
    "client.emotes": "{value} Emotes",
    "client.room": "Room",
    "client.emojis": "Emojis",
    "client.enterAShortcode": "Enter a shortcode.",
    "client.useOnlyLettersNumbersDotsUnderscores":
        "Use only letters, numbers, dots, underscores, pluses, and hyphens.",
    "client.chooseAtLeastOneUsage": "Choose at least one usage.",
    "client.imageNotFound": "Image not found.",
    "client.invalidPowerLevels": "Invalid power levels: {shapeError}",
    "client.roomCreatorsPowerLevelCannotBe":
        "Room creators' power level cannot be set in v12 rooms",
    "client.restrictedJoinRequiresAtLeastOne":
        "Restricted join requires at least one parent space",
    "client.orderMustBeAtMost50":
        "Order must be at most 50 printable-ASCII characters (space to ~)",
    "client.cannotSetSuggestedOnASpace":
        "Cannot set suggested on a space child with no via",
    "client.pollHasNoEventId": "Poll has no event id",
    "client.unsupportedPoll": "Unsupported poll",
    "client.youCanTCloseThisPoll": "You can't close this poll",
    "client.microphoneDisconnectedSwitchedToTheDefault":
        "Microphone disconnected - switched to the default device",
    "client.cameraDisconnected": "Camera disconnected",
    "client.unknownRoom": "Unknown room",
    "client.theServerRejectedItYouMay":
        "the server rejected it - you may lack permission to join calls in this room",
    "client.callMembershipFailed": "Call membership failed: {detail}",
    "client.voiceServerRejectedTheJoin":
        "Voice server rejected the join ({status})",
    "client.voiceCallDisconnected": "Voice call disconnected",
    "client.yourMicrophoneAppearsSilentCheckYour":
        "Your microphone appears silent - check your input device",
    "client.audioDeviceError": "Audio device error: {message}",
    "client.couldnTSwitchToThatKept":
        "Couldn't switch to that {what} - kept your previous one",
    "client.couldnTSwitchToThatUsing":
        "Couldn't switch to that {what} - using the default device",
    "client.couldnTSwitchToThatPick":
        "Couldn't switch to that {what} - pick another device",
    "client.couldNotStartScreenShare": "Could not start screen share",
    "client.couldnTChangeScreenShareQuality":
        "Couldn't change screen share quality",
    "client.couldNotStartTheCameraCheck":
        "Could not start the camera - check permissions",
    "client.couldnTApplyAudioProcessingChange":
        "Couldn't apply audio processing change",
    "client.deviceNounMicrophone": "microphone",
    "client.deviceNounCamera": "camera",

    // src/lib/matrix/crypto.ts
    "crypto.couldNotStartTheEmojiCheck": "Could not start the emoji check",
    "crypto.couldNotCancelTheVerification": "Could not cancel the verification",
    "crypto.noCodeAvailableTheOtherSide":
        "No code available - the other side can't scan one.",
    "crypto.couldNotGenerateAQrCode": "Could not generate a QR code",
    "crypto.thatCodeDoesnTMatchThis":
        "That code doesn't match this verification",
    "crypto.couldNotConfirmTheQrMatch": "Could not confirm the QR match",
    "crypto.couldNotCancelTheQrMatch": "Could not cancel the QR match",
    "crypto.encryptionIsNotReadyOnThis":
        "Encryption is not ready on this session",
    "crypto.thisServerCanTConfirmEncryption":
        "This server can't confirm encryption setup with a password - use its account page instead.",
    "crypto.incorrectPassword": "Incorrect password",
    "crypto.failedToGenerateARecoveryKey": "Failed to generate a recovery key",
    "crypto.yourOldRecoveryWasResetBut":
        "Your old recovery was reset, but setting up the new one failed.",
    "crypto.thatKeyDoesnTMatchThis":
        "That key doesn't match this account's backup on the server.",
    "crypto.thatDoesnTLookLikeA":
        "That doesn't look like a valid recovery key. Check for typos and try again.",
    "crypto.thisAccountHasNoRecoverySet":
        "This account has no recovery set up yet. Set up recovery first on a session that has your keys.",
    "crypto.thatRecoveryKeyDoesnTMatch":
        "That recovery key doesn't match this account. Check for typos and try again.",
    "crypto.thisAccountSRecoveryWasnT":
        "This account's recovery wasn't set up with a passphrase. Use your recovery key instead.",
    "crypto.couldnTUseYourPassphraseOn":
        "Couldn't use your passphrase on this device. Try your recovery key instead.",
    "crypto.thatPassphraseDoesnTMatchThis":
        "That passphrase doesn't match this account. Check for typos and try again.",

    // src/lib/matrix/media.ts
    "media.notLoggedIn": "Not logged in",
    "media.failedToFetchAttachment": "Failed to fetch attachment: {status}",
    "media.encryptedAttachmentHasAnInvalidUrl":
        "Encrypted attachment has an invalid URL",
    "media.failedToFetchEncryptedAttachment":
        "Failed to fetch encrypted attachment: {status}",

    // src/lib/matrix/pluginHost.ts
    "pluginHost.mediaWasUploadedByADifferent":
        "Media was uploaded by a different account",
    "pluginHost.notLoggedIn": "Not logged in",
    "pluginHost.notConnected": "Not connected",

    // src/lib/matrix/runtime.ts
    "runtime.notLoggedIn": "Not logged in",

    // src/lib/plugins/builtins/double-tap-reply/index.ts
    "doubleTapReply.doubleTapSwipeActions": "Double-tap & swipe actions",
    "doubleTapReply.doubleTapAMessageToReply":
        "Double-tap a message to reply, react, or edit, or swipe it left to reply / edit.",
    "doubleTapReply.doubleTapYourMessages": "Double-tap your messages",
    "doubleTapReply.nothing": "Nothing",
    "doubleTapReply.reaction": "Reaction",
    "doubleTapReply.reply": "Reply",
    "doubleTapReply.edit": "Edit",
    "doubleTapReply.doubleTapOtherMessages": "Double-tap other messages",
    "doubleTapReply.reactionEmoji": "Reaction emoji",
    "doubleTapReply.sentWhenADoubleTapAction":
        "Sent when a double-tap action is set to Reaction.",
    "doubleTapReply.swipeToReplyEdit": "Swipe to reply / edit",
    "doubleTapReply.swipeAMessageLeftToReply":
        "Swipe a message left to reply; swipe your own further to edit.",
    "doubleTapReply.failedToReact": "Failed to react",

    // src/lib/plugins/builtins/slash-fun/index.ts
    "slashFun.sendAnActionMessage": "Send an action message",
    "slashFun.appendToYourMessage": "Append ¯\\_(ツ)_/¯ to your message",
    "slashFun.appendToYourMessage2": "Append (╯°□°)╯︵ ┻━┻ to your message",
    "slashFun.appendToYourMessage3": "Append ┬─┬ ノ( ゜-゜ノ) to your message",
    "slashFun.appendToYourMessage4": "Append ( ͡° ͜ʖ ͡°) to your message",
    "slashFun.sendYourMessageAsASpoiler": "Send your message as a spoiler",
    "slashFun.sendYourMessageWithoutMarkdownFormatting":
        "Send your message without markdown formatting",
    "slashFun.funSlashCommands": "Fun slash commands",
    "slashFun.noveltySlashCommandsMeShrugTableflip":
        "Novelty slash commands: /me, /shrug, /tableflip, /unflip, /lenny, /spoiler, /plain.",

    // src/lib/plugins/builtins/text-replacer/index.ts
    "textReplacer.textReplacer": "Text replacer",
    "textReplacer.applyYourOwnStringOrRegex":
        "Apply your own string or regex substitutions to outgoing message text.",
    "textReplacer.replacementRules": "Replacement rules",
    "textReplacer.appliedToYourOutgoingMessageText":
        "Applied to your outgoing message text in order. Recipients see standard text.",
    "textReplacer.find": "Find",
    "textReplacer.textOrPattern": "text or pattern",
    "textReplacer.replaceWith": "Replace with",
    "textReplacer.regex": "Regex",
    "textReplacer.ignoreCase": "Ignore case",

    // src/lib/plugins/pluginBoot.ts
    "pluginBoot.noPluginSyncDataOnYour":
        "No plugin sync data on your account yet.",
    "pluginBoot.theSyncDataOnYourAccount":
        "The sync data on your account is malformed.",
    "pluginBoot.autoUpdateFailed": "Auto-update failed: {value}",

    // src/lib/plugins/pluginPin.ts
    "pluginPin.pluginIdMismatchIndexListsManifest":
        'Plugin id mismatch: index lists "{entryId}", manifest declares "{manifestId}"',
    "pluginPin.cannotInstallPluginWithIdIt":
        'Cannot install plugin with id "{manifestId}": it is a built-in plugin',
    "pluginPin.pluginIsAlreadyInstalledFromA":
        'Plugin "{manifestId}" is already installed from a different repository',

    // src/lib/plugins/repo.ts
    "repo.repoReferenceMustBeAString": "Repo reference must be a string",
    "repo.repoReferenceCannotBeEmpty": "Repo reference cannot be empty",
    "repo.branchCannotBeEmpty": "Branch cannot be empty",
    "repo.branchCannotContain": "Branch cannot contain '..'",
    "repo.invalidRepoReferenceExtraPathSegments":
        "Invalid repo reference: extra path segments (not /tree/<branch>)",
    "repo.invalidRepoReferenceMustBeOwner":
        "Invalid repo reference: must be owner/repo",
    "repo.ownerCannotBeEmpty": "Owner cannot be empty",
    "repo.invalidOwnerMustMatchAZa":
        "Invalid owner: must match [A-Za-z0-9][A-Za-z0-9._-]*",
    "repo.repoCannotBeEmpty": "Repo cannot be empty",
    "repo.invalidRepoMustMatchAZa":
        "Invalid repo: must match [A-Za-z0-9][A-Za-z0-9._-]*",

    // src/lib/plugins/repoList.ts
    "repoList.enterARepoOwnerRepoOr":
        "Enter a repo (owner/repo or a GitHub URL).",
    "repoList.thatIsTheOfficialRepoAlready":
        "That is the official repo (already included).",
    "repoList.thatRepoIsAlreadyAdded": "That repo is already added.",

    // src/lib/stores/gifSearch.svelte.ts
    "gifSearch.couldnTReachKlipyTryAgain": "Couldn't reach KLIPY - try again.",

    // src/lib/stores/liveLocation.svelte.ts
    "liveLocation.youCanTShareLiveLocation":
        "You can't share live location in this room.",
    "liveLocation.couldnTStartLiveLocation": "Couldn't start live location",
    "liveLocation.expired": "Expired",
    "liveLocation.lessThanAMinuteLeft": "less than a minute left",
    "liveLocation.minLeft": "{totalMin} min left",
    "liveLocation.hLeft": "{h} h left",
    "liveLocation.hMinLeft": "{h} h {m} min left",
    "liveLocation.justNow": "just now",
    "liveLocation.sAgo": "{floor} s ago",
    "liveLocation.minAgo": "{floor} min ago",
    "liveLocation.hAgo": "{floor} h ago",
    "liveLocation.n15Minutes": "15 minutes",
    "liveLocation.n1Hour": "1 hour",
    "liveLocation.n8Hours": "8 hours",

    // src/lib/stores/outbox.svelte.ts
    "outbox.failedToSend": "Failed to send",

    // src/lib/stores/settings.svelte.ts
    "settings.couldNotReadThatFile": "Could not read that file.",
    "settings.thatFileIsnTAValid": "That file isn't a valid font.",
    "settings.fontCouldnTBeSavedOn": "Font couldn't be saved on this device.",
    "settings.cannotSaveAPresetWithBuilt":
        "Cannot save a preset with built-in name: {name}",

    // src/lib/stores/shareInbox.svelte.ts
    "shareInbox.youReOfflineTheShareWas":
        "You're offline: the share was added to the composer",
    "shareInbox.couldnTSendTheShare": "Couldn't send the share",

    // src/lib/stores/verification.svelte.ts
    "verification.finishingAnotherVerificationFirstTryAgain":
        "Finishing another verification first. Try again.",
    "verification.waitingForTheOtherSideTo":
        "Waiting for the other side to accept…",
    "verification.acceptedSettingUpTheCheck":
        "Accepted - setting up the check…",
    "verification.verifying": "Verifying…",
    "verification.sessionVerified": "Session verified",
    "verification.userVerified": "User verified",
    "verification.verificationCancelled": "Verification cancelled",
    "verification.verified": "Verified",
    "verification.unverified": "Unverified",
    "verification.identityChanged": "Identity changed",
    "verification.couldnTAcceptThisRequestTry":
        "Couldn't accept this request. Try again.",

    // src/lib/stores/voiceCall.svelte.ts
    "voiceCall.couldnTLoadTheCallComponent":
        "Couldn't load the call component. Check your connection, then reload the page to try again.",
    "voiceCall.couldNotJoinTheVoiceCall": "Could not join the voice call",
    "voiceCall.couldNotMuteYourMicrophone": "Could not mute your microphone",
    "voiceCall.couldNotUnmuteYourMicrophoneCheck":
        "Could not unmute your microphone - check your input device",
    "voiceCall.connecting": "Connecting…",
    "voiceCall.voiceConnected": "Voice connected",
    "voiceCall.reconnecting": "Reconnecting…",
    "voiceCall.youWereBannedFromThisRoom":
        "You were banned from this room - call ended",
    "voiceCall.youLeftThisRoomCallEnded": "You left this room - call ended",
    "voiceCall.youWereRemovedFromThisRoom":
        "You were removed from this room - call ended",

    // src/lib/update.ts
    "update.noReleasesFoundYet": "No releases found yet.",
    "update.githubApiError": "GitHub API error ({status}).",
    "update.couldNotReadTheLatestVersion": "Could not read the latest version.",

    // src/lib/utils/accountSecurity.ts
    "accountSecurity.enterYourCurrentPassword": "Enter your current password.",
    "accountSecurity.enterANewPassword": "Enter a new password.",
    "accountSecurity.newPasswordMustBeAtLeast":
        "New password must be at least 8 characters.",
    "accountSecurity.newPasswordMustBeDifferentFrom":
        "New password must be different from your current password.",
    "accountSecurity.passwordsDoNotMatch": "Passwords do not match.",

    // src/lib/utils/activeSession.ts
    "activeSession.offAlwaysNotify": "Off - always notify",
    "activeSession.n15Seconds": "15 seconds",
    "activeSession.n30Seconds": "30 seconds",
    "activeSession.n1Minute": "1 minute",
    "activeSession.n2Minutes": "2 minutes",
    "activeSession.n5Minutes": "5 minutes",
    "activeSession.n10Minutes": "10 minutes",
    "activeSession.n30Minutes": "30 minutes",
    "activeSession.enterANumberOfMinutes": "Enter a number of minutes.",
    "activeSession.chooseAtLeast1MinuteUse":
        "Choose at least 1 minute - use the list above for shorter times.",
    "activeSession.chooseMinutes2HoursOrLess":
        "Choose {MAX_CUSTOM_GRACE_MINUTES} minutes (2 hours) or less.",

    // src/lib/utils/audioDevices.ts
    "audioDevices.microphone": "Microphone",
    "audioDevices.speaker": "Speaker",
    "audioDevices.camera": "Camera",

    // src/lib/utils/audioPlayback.ts
    "audioPlayback.failedToLoadRetry": "Failed to load · Retry",
    "audioPlayback.clickToPlay": "Click to play",

    // src/lib/utils/clientGeneration.ts
    "clientGeneration.sessionChangedBeforeTheOperationFinished":
        "Session changed before the operation finished",

    // src/lib/utils/customFont.ts
    "customFont.useAWoff2TtfOrOtf": "Use a .woff2, .ttf, or .otf font file.",
    "customFont.thatFontFileIsEmpty": "That font file is empty.",
    "customFont.fontFileIsTooLargeMax": "Font file is too large (max 10 MB).",
    "customFont.customFont": "Custom font",

    // src/lib/utils/deviceSessions.ts
    "deviceSessions.unknown": "Unknown",
    "deviceSessions.justNow": "Just now",
    "deviceSessions.desktopApp": "Desktop app",
    "deviceSessions.on": "{client} on {os}",
    "deviceSessions.minutesAgo":
        "{count, plural, one {# minute ago} other {# minutes ago}}",
    "deviceSessions.hoursAgo":
        "{count, plural, one {# hour ago} other {# hours ago}}",
    "deviceSessions.daysAgo":
        "{count, plural, one {# day ago} other {# days ago}}",

    // src/lib/utils/displaySources.ts
    "displaySources.screen": "Screen",
    "displaySources.untitledWindow": "Untitled window",

    // src/lib/utils/encryptionState.ts
    "encryptionState.unableToDecryptYouMayNot":
        "Unable to decrypt - you may not have the keys for this message.",
    "encryptionState.theSenderChoseNotToShare":
        "The sender chose not to share the keys for this message.",
    "encryptionState.theSenderDidNotShareThe":
        "The sender did not share the keys because this device is unverified. Verify this device to read messages like this.",
    "encryptionState.encryptedMessage": "🔒 Encrypted message",

    // src/lib/utils/eventShield.ts
    "eventShield.thisMessageSEncryptionCouldNot":
        "This message's encryption could not be fully verified.",
    "eventShield.encryptedByAnUnverifiedUser":
        "Encrypted by an unverified user.",
    "eventShield.encryptedByADeviceNotVerified":
        "Encrypted by a device not verified by its owner.",
    "eventShield.encryptedByAnUnknownOrDeleted":
        "Encrypted by an unknown or deleted device.",
    "eventShield.theAuthenticityOfThisEncryptedMessage":
        "The authenticity of this encrypted message can't be guaranteed on this device.",
    "eventShield.theSenderWasPreviouslyVerifiedBut":
        "The sender was previously verified but changed their identity.",
    "eventShield.theSenderDoesnTMatchThe":
        "The sender doesn't match the owner of the device that sent this message.",

    // src/lib/utils/extendedProfile.ts
    "extendedProfile.aStatusNeedsBothAnEmoji":
        "A status needs both an emoji and some text.",
    "extendedProfile.inACall": "In a call",
    "extendedProfile.inACallForMin": "In a call for {minutes} min",
    "extendedProfile.inACallForH": "In a call for {hours} h",
    "extendedProfile.other": "Other",
    "extendedProfile.atMostLinks": "At most {MAX_CONNECTIONS} links.",
    "extendedProfile.linksMustBeHttpHttpsMailto":
        "Links must be http, https, mailto or matrix addresses.",
    "extendedProfile.inACallForHMin": "In a call for {hours} h {minutes} min",

    // src/lib/utils/geoErrors.ts
    "geoErrors.locationNeedsASecureHttpsConnection":
        "Location needs a secure (HTTPS) connection - open the app over https.",
    "geoErrors.locationPermissionWasDeniedCheckSite":
        "Location permission was denied - check site permissions.",
    "geoErrors.yourPositionIsUnavailableLocationOff":
        "Your position is unavailable (location off or no GPS fix).",
    "geoErrors.timedOutGettingYourLocation": "Timed out getting your location.",
    "geoErrors.couldnTGetYourLocation": "Couldn't get your location.",
    "geoErrors.locationIsnTAvailableInThis":
        "Location isn't available in this browser.",

    // src/lib/utils/joinRules.ts
    "joinRules.onlyAvailableForRoomsInsideA":
        "Only available for rooms inside a space",
    "joinRules.thisRoomSVersionDoesnT":
        "This room's version doesn't support space-restricted joining",

    // src/lib/utils/keyBackup.ts
    "keyBackup.preparing": "Preparing…",
    "keyBackup.fetchingYourEncryptedHistory":
        "Fetching your encrypted history…",
    "keyBackup.restoringYourEncryptedHistory":
        "Restoring your encrypted history…",
    "keyBackup.restoringOfKeys": "Restoring {successes} of {total} keys…",
    "keyBackup.noEncryptedHistoryToRestore": "No encrypted history to restore",
    "keyBackup.restored":
        "{count, plural, one {# key restored} other {# keys restored}}",
    "keyBackup.ofKeysRestored": "{imported} of {total} keys restored",
    "keyBackup.notSetUp": "Not set up",
    "keyBackup.notTrusted": "Not trusted",
    "keyBackup.notConnected": "Not connected",
    "keyBackup.on": "On",
    "keyBackup.encryptedMessageHistoryIsnTBeing":
        "Encrypted message history isn't being backed up. Set up recovery to protect it.",
    "keyBackup.aBackupExistsOnTheServer":
        "A backup exists on the server but isn't trusted by this session yet.",
    "keyBackup.aBackupExistsButThisSession":
        "A backup exists but this session isn't connected to it. Enter your recovery key to restore your history.",
    "keyBackup.messageHistoryIsBeingBackedUp":
        "Message history is being backed up (v{version}).",
    "keyBackup.messageHistoryIsBeingBackedUp2":
        "Message history is being backed up.",
    "keyBackup.noKeysBackedUpYet": "No keys backed up yet",
    "keyBackup.backedUp":
        "{count, plural, one {# key backed up} other {# keys backed up}}",
    "keyBackup.stillToUpload":
        "{count, plural, one {# key still to upload} other {# keys still to upload}}",
    "keyBackup.everythingOnThisSessionIsBacked":
        "Everything on this session is backed up",
    "keyBackup.notSet": "Not set",

    // src/lib/utils/keywordRules.ts
    "keywordRules.keywordCannotBeEmpty": "Keyword cannot be empty",
    "keywordRules.keywordCannotStartWith": "Keyword cannot start with '.'",
    "keywordRules.youAlreadyHaveARuleFor":
        "You already have a rule for this keyword",

    // src/lib/utils/liveAnnouncer.ts
    "liveAnnouncer.messageFrom": "Message from {sender}",
    "liveAnnouncer.newMessagesFrom":
        "{count, plural, one {# new message from {sender}} other {# new messages from {sender}}}",
    "liveAnnouncer.newMessages":
        "{count, plural, one {# new message} other {# new messages}}",

    // src/lib/utils/liveShareStop.ts
    "liveShareStop.couldnTStopSharingYourLive":
        "Couldn't stop sharing your live location - it's still visible to this room. Use Retry stop to try again.",
    "liveShareStop.stopping": "Stopping…",
    "liveShareStop.stillSharingCouldnTStop": "Still sharing - couldn't stop",
    "liveShareStop.youReAlreadySharingYourLive":
        "You're already sharing your live location in this room.",
    "liveShareStop.yourLastLiveLocationShareHere":
        "Your last live location share here hasn't stopped yet - stop it from the room's banner before starting a new one.",
    "liveShareStop.stop": "Stop",
    "liveShareStop.retryStop": "Retry stop",

    // src/lib/utils/location.ts
    "location.location": "Location",

    // src/lib/utils/mediaGallery.ts
    "mediaGallery.of": "{value} of {length}{value2}",

    // src/lib/utils/messageActionsMenu.ts
    "messageActionsMenu.edit": "Edit",
    "messageActionsMenu.unpin": "Unpin",
    "messageActionsMenu.pin": "Pin",
    "messageActionsMenu.copyLink": "Copy link",
    "messageActionsMenu.report": "Report",

    // src/lib/utils/messageDisplay.ts
    "messageDisplay.systemDefault": "System default",

    // src/lib/utils/micErrorMessage.ts
    "micErrorMessage.noMicrophoneFoundConnectOneOr":
        "No microphone found - connect one or pick another input device to join the call",
    "micErrorMessage.couldNotOpenYourMicrophoneAnother":
        "Could not open your microphone - another app may be using it",

    // src/lib/utils/mutePowerLevel.ts
    "mutePowerLevel.enterAPowerLevel": "Enter a power level",
    "mutePowerLevel.mustBeAWholeNumber": "Must be a whole number",
    "mutePowerLevel.useToMute": "Use {MUTE_POWER_LEVEL} to mute",
    "mutePowerLevel.youCanTSetALevel":
        "You can't set a level above your own ({ceiling})",

    // src/lib/utils/notifActions.ts
    "notifActions.reply": "Reply",
    "notifActions.reply2": "Reply…",
    "notifActions.markAsRead": "Mark as read",

    // src/lib/utils/notificationPrivacy.ts
    "notificationPrivacy.sentAMessage": "sent a message",
    "notificationPrivacy.newMessage": "New message",

    // src/lib/utils/notifyPermission.ts
    "notifyPermission.notificationsAreBlockedSoIncomingCalls":
        "Notifications are blocked, so incoming calls won't alert you when this window is hidden. Unblock notifications in your system settings.",
    "notifyPermission.thisBrowserCanTShowCall":
        "This browser can't show call alerts when the window is hidden.",

    // src/lib/utils/pollContent.ts
    "pollContent.addAQuestion": "Add a question.",
    "pollContent.addAtLeastTwoOptions": "Add at least two options.",
    "pollContent.atMostOptions": "At most {MAX_ANSWERS} options.",
    "pollContent.invalidNumberOfSelections": "Invalid number of selections.",
    "pollContent.thePollHasEnded": "The poll has ended.",

    // src/lib/utils/powerLevels.ts
    "powerLevels.enterAPowerLevel": "Enter a power level",
    "powerLevels.mustBeAWholeNumber": "Must be a whole number",
    "powerLevels.mustBe0OrHigher": "Must be 0 or higher",
    "powerLevels.youCanTSetALevel":
        "You can't set a level above your own ({ceiling})",

    // src/lib/utils/presence.ts
    "presence.online": "Online",
    "presence.away": "Away",
    "presence.offline": "Offline",
    "presence.seenAsOnlineWhileTheApp":
        "Seen as online while the app is syncing",
    "presence.shownAsIdleToOtherUsers": "Shown as idle to other users",
    "presence.invisible": "Invisible",
    "presence.appearOfflineToOtherUsers": "Appear offline to other users",

    // src/lib/utils/pushRuleWrite.ts
    "pushRuleWrite.yourHomeserverHasNoNotificationRule":
        'Your homeserver has no "{label}" notification rule, so it could not be changed.',
    "pushRuleWrite.yourHomeserverRejectedTheChangeTo":
        'Your homeserver rejected the change to "{label}" notifications.',
    "pushRuleWrite.notificationsDidNotChangeOnYour":
        '"{label}" notifications did not change on your homeserver.',
    "pushRuleWrite.couldNotSaveNotificationsCheckYour":
        'Could not save "{label}" notifications. Check your connection and try again.',

    // src/lib/utils/pusherVerification.ts
    "pusherVerification.noGatewayUrl": "(no gateway URL)",

    // src/lib/utils/recoveryPassphrase.ts
    "recoveryPassphrase.enterAPassphrase": "Enter a passphrase.",
    "recoveryPassphrase.useAtLeastCharacters":
        "Use at least {MIN_PASSPHRASE_LENGTH} characters.",

    // src/lib/utils/reportMessage.ts
    "reportMessage.failedToSendReport": "Failed to send report",

    // src/lib/utils/roomAliases.ts
    "roomAliases.enterAnAddress": "Enter an address.",
    "roomAliases.addressesCannotContainSpaces":
        "Addresses cannot contain spaces.",
    "roomAliases.addressesCannotContain": "Addresses cannot contain ':'.",
    "roomAliases.addressesCannotContain2": "Addresses cannot contain '#'.",
    "roomAliases.addressesCannotContainControlCharacters":
        "Addresses cannot contain control characters.",
    "roomAliases.addressIsTooLongMaxCharacters":
        "Address is too long (max {MAX_ALIAS_LENGTH} characters).",
    "roomAliases.thatAddressAlreadyExists": "That address already exists.",

    // src/lib/utils/roomCreationOutcome.ts
    "roomCreationOutcome.theServerRejectedTheChange":
        "the server rejected the change",
    "roomCreationOutcome.theRoomWasCreatedButAdding":
        "The room was created, but adding it to the space failed: {detailSentence}",
    "roomCreationOutcome.theDirectMessageWasCreatedBut":
        "The direct message was created, but saving it to your DM list failed: {detailSentence} It may appear as a normal room until this is retried.",
    "roomCreationOutcome.theRoomWasCreatedButAdding2":
        "The room was created, but adding it to the space hasn't been confirmed yet - it may still be saving. Retry if the room doesn't show up in the space.",
    "roomCreationOutcome.theDirectMessageWasCreatedBut2":
        "The direct message was created, but saving it to your DM list hasn't been confirmed yet - it may still be saving. Retry if it doesn't show up in your DM list.",

    // src/lib/utils/roomEncryption.ts
    "roomEncryption.thisRoomIsAlreadyEncrypted":
        "This room is already encrypted.",
    "roomEncryption.youNeedPowerLevelToEnable":
        "You need power level {required} to enable encryption.",
    "roomEncryption.youAlreadyHaveADirectMessage":
        "You already have a direct message with this user, and it isn't encrypted. Encryption can't be added automatically - open it and turn it on from the room's Security settings.",
    "roomEncryption.enableEncryptionWarning":
        "Encryption can't be turned off once it's on. Everyone will need a client that supports encryption to read new messages.",

    // src/lib/utils/roomHeaderMenu.ts
    "roomHeaderMenu.threads": "Threads",
    "roomHeaderMenu.pinnedMessages": "Pinned messages",
    "roomHeaderMenu.notificationsInbox": "Notifications inbox",
    "roomHeaderMenu.mediaAndFiles": "Media and files",
    "roomHeaderMenu.memberList": "Member list",

    // src/lib/utils/roomMedia.ts
    "roomMedia.image": "Image",
    "roomMedia.video": "Video",
    "roomMedia.file": "File",
    "roomMedia.audio": "Audio",
    "roomMedia.kb": "{toFixed} KB",
    "roomMedia.mb": "{toFixed} MB",

    // src/lib/utils/roomSettingsNav.ts
    "roomSettingsNav.general": "General",
    "roomSettingsNav.access": "Access",
    "roomSettingsNav.security": "Security",
    "roomSettingsNav.permissions": "Permissions",
    "roomSettingsNav.members": "Members",
    "roomSettingsNav.emotes": "Emotes",
    "roomSettingsNav.rooms": "Rooms",

    // src/lib/utils/roomStateTrust.ts
    "roomStateTrust.unverifiedRoomState": "Unverified room state",
    "roomStateTrust.unverifiedRoomStateTooltip":
        "Some of this room's details (roles, membership, and permissions) were fetched directly from the server and haven't been confirmed through sync, so they may be inaccurate. Actions are still enforced by the server regardless of what is shown here.",

    // src/lib/utils/roomUpgrade.ts
    "roomUpgrade.theServerSRecommendedRoomVersion":
        "The server's recommended room version isn't available.",
    "roomUpgrade.thisRoomIsOnTheLatest":
        "This room is on the latest version (v{recommendedVersion}).",
    "roomUpgrade.youDonTHavePermissionTo":
        "You don't have permission to upgrade this room.",

    // src/lib/utils/saveFile.ts
    "saveFile.savedToDownloads": "Saved to Downloads",

    // src/lib/utils/securityStatusView.ts
    "securityStatusView.couldnTReadThisAccountS":
        "Couldn't read this account's encryption status. Nothing here is reliable until it loads - don't set up or reset recovery yet.",
    "securityStatusView.encryptionIsnTReadyOnThis":
        "Encryption isn't ready on this session yet. Reload if this persists.",

    // src/lib/utils/serverAcl.ts
    "serverAcl.allowListIsEmptyWhichDenies":
        "Allow list is empty, which denies all servers from federating.",
    "serverAcl.denyListContainsWhichBansAll":
        "Deny list contains *, which bans all servers.",
    "serverAcl.thisConfigurationBansYourOwnServer":
        "This configuration bans your own server ({ownServerName}), which will break federation.",

    // src/lib/utils/serverCapabilities.ts
    "serverCapabilities.crossSigningE2ee": "Cross-signing (E2EE)",
    "serverCapabilities.privateReadReceipts": "Private read receipts",
    "serverCapabilities.threadedRelations": "Threaded relations",
    "serverCapabilities.spaceSummaries": "Space summaries",
    "serverCapabilities.busyPresence": "Busy presence",
    "serverCapabilities.dehydratedDevices": "Dehydrated devices",
    "serverCapabilities.filterPublicRoomsByType": "Filter public rooms by type",
    "serverCapabilities.authenticatedMedia": "Authenticated media",
    "serverCapabilities.intentionalMentions": "Intentional mentions",
    "serverCapabilities.slidingSyncSimplified": "Sliding sync (simplified)",
    "serverCapabilities.sharedRoomsWithAUser": "Shared rooms with a user",

    // src/lib/utils/settingsNav.ts
    "settingsNav.account": "Account",
    "settingsNav.securitySessions": "Security & Sessions",
    "settingsNav.privacySafety": "Privacy & Safety",
    "settingsNav.app": "App",
    "settingsNav.appearance": "Appearance",
    "settingsNav.messagesMedia": "Messages & Media",
    "settingsNav.voiceVideo": "Voice & Video",
    "settingsNav.emotes": "Emotes",
    "settingsNav.advanced": "Advanced",
    "settingsNav.general": "General",
    "settingsNav.plugins": "Plugins",
    "settingsNav.server": "Server",
    "settingsNav.about": "About",
    "settingsNav.debug": "Debug",

    // src/lib/utils/settingsSearch.ts
    "settingsSearch.displayName": "Display name",
    "settingsSearch.avatar": "Avatar",
    "settingsSearch.presence": "Presence",
    "settingsSearch.changePassword": "Change password",
    "settingsSearch.logOut": "Log out",
    "settingsSearch.deactivateAccount": "Deactivate account",
    "settingsSearch.sessions": "Sessions",
    "settingsSearch.encryptNewDirectMessages": "Encrypt new direct messages",
    "settingsSearch.onlySendToVerifiedDevices": "Only send to verified devices",
    "settingsSearch.setUpRecovery": "Set up recovery",
    "settingsSearch.restoreMessageHistory": "Restore message history",
    "settingsSearch.verifyThisSession": "Verify this session",
    "settingsSearch.rightAlignMyMessages": "Right-align my messages",
    "settingsSearch.showWhenIAmInA": "Show when I am in a call",
    "settingsSearch.showNameColours": "Show name colours",
    "settingsSearch.textSize": "Text size",
    "settingsSearch.font": "Font",
    "settingsSearch.themePresets": "Theme presets",
    "settingsSearch.importExportTheme": "Import / export theme",
    "settingsSearch.timeFormat": "Time format",
    "settingsSearch.dateFormat": "Date format",
    "settingsSearch.showMatrixIds": "Show Matrix IDs",
    "settingsSearch.readReceiptAvatars": "Read receipt avatars",
    "settingsSearch.linkPreviews": "Link previews",
    "settingsSearch.linkPreviewMedia": "Link preview media",
    "settingsSearch.pauseVideosOffScreen": "Pause videos off-screen",
    "settingsSearch.holdToOpenMessageMenu": "Hold to open message menu",
    "settingsSearch.gifDefaultTab": "GIF default tab",
    "settingsSearch.minimiseToTrayOnClose": "Minimise to tray on close",
    "settingsSearch.reduceMotion": "Reduce motion",
    "settingsSearch.keepRoomListOpen": "Keep room list open",
    "settingsSearch.customEmotes": "Custom emotes",
    "settingsSearch.pushNotificationsPermission":
        "Push notifications permission",
    "settingsSearch.notificationSound": "Notification sound",
    "settingsSearch.desktopAlertsPopUpAndTaskbar":
        "Desktop alerts (pop-up and taskbar flash)",
    "settingsSearch.quietOnMyOtherDevices": "Quiet on my other devices",
    "settingsSearch.privateReadReceipts": "Private read receipts",
    "settingsSearch.hideMessageTextInNotifications":
        "Hide message text in notifications",
    "settingsSearch.notificationRules": "Notification rules",
    "settingsSearch.keywordHighlights": "Keyword highlights",
    "settingsSearch.inputDevice": "Input device",
    "settingsSearch.outputDevice": "Output device",
    "settingsSearch.camera": "Camera",
    "settingsSearch.noiseSuppression": "Noise suppression",
    "settingsSearch.echoCancellation": "Echo cancellation",
    "settingsSearch.autoGainControl": "Auto gain control",
    "settingsSearch.mirrorMyCamera": "Mirror my camera",
    "settingsSearch.callVolume": "Call volume",
    "settingsSearch.playCallSounds": "Play call sounds",
    "settingsSearch.ringForIncomingDmCalls": "Ring for incoming DM calls",
    "settingsSearch.blockedUsers": "Blocked users",
    "settingsSearch.serverCapabilities": "Server capabilities",
    "settingsSearch.plugins": "Plugins",
    "settingsSearch.pluginRepositories": "Plugin repositories",
    "settingsSearch.syncPlugins": "Sync plugins",
    "settingsSearch.checkForUpdates": "Check for updates",
    "settingsSearch.clearCache": "Clear cache",
    "settingsSearch.showAllEvents": "Show all events",
    "settingsSearch.pushDiagnostics": "Push diagnostics",
    "settingsSearch.language": "Language",

    // src/lib/utils/slashCommands.ts
    "slashCommands.createAPoll": "Create a poll",
    "slashCommands.shareYourLocation": "Share your location",
    "slashCommands.joinARoomByAddress": "Join a room by address",
    "slashCommands.leaveTheCurrentRoom": "Leave the current room",
    "slashCommands.inviteAUserToThisRoom": "Invite a user to this room",
    "slashCommands.setTheRoomTopic": "Set the room topic",
    "slashCommands.removeAUserFromThisRoom": "Remove a user from this room",
    "slashCommands.userServerReason": "<@user:server> [reason]",
    "slashCommands.banAUserFromThisRoom": "Ban a user from this room",
    "slashCommands.setYourDisplayName": "Set your display name",
    "slashCommands.displayName": "<display name>",
    "slashCommands.setAUserSPowerLevel": "Set a user's power level",
    "slashCommands.userServerLevel": "<@user:server> [level]",
    "slashCommands.resetAUserSPowerLevel":
        "Reset a user's power level to default",
    "slashCommands.usage": "Usage: /{name} {argHint}",
    "slashCommands.usage2": "Usage: /{name}",

    // src/lib/utils/syncStatus.ts
    "syncStatus.connected": "Connected",
    "syncStatus.reconnecting": "Reconnecting…",
    "syncStatus.connectionError": "Connection error",
    "syncStatus.offline": "Offline",
    "syncStatus.connecting": "Connecting…",

    // src/lib/utils/themePalette.ts
    "themePalette.accent": "Accent",
    "themePalette.background": "Background",
    "themePalette.secondaryBackground": "Secondary background",
    "themePalette.tertiaryBackground": "Tertiary background",
    "themePalette.primaryText": "Primary text",
    "themePalette.secondaryText": "Secondary text",
    "themePalette.mutedText": "Muted text",
    "themePalette.danger": "Danger",
    "themePalette.positive": "Positive",
    "themePalette.mentionHighlight": "Mention highlight",
    "themePalette.link": "Link",
    "themePalette.warning": "Warning",
    "themePalette.onlineStatus": "Online status",
    "themePalette.idleStatus": "Idle status",
    "themePalette.doNotDisturbStatus": "Do not disturb status",
    "themePalette.offlineStatus": "Offline status",
    "themePalette.divider": "Divider",
    "themePalette.spoilerBackground": "Spoiler background",
    "themePalette.ownMessageBubble": "Own message bubble",
    "themePalette.primaryTextOnBackground": "Primary text on background",
    "themePalette.secondaryTextOnBackground": "Secondary text on background",
    "themePalette.mutedTextOnTertiaryBackground":
        "Muted text on tertiary background",
    "themePalette.whiteTextOnAccentButtons": "White text on accent buttons",
    "themePalette.whiteTextOnDangerButtons": "White text on danger buttons",
    "themePalette.whiteTextOnOwnBubble": "White text on own bubble",

    // src/lib/utils/themePreset.ts
    "themePreset.copy": "{newName} (Copy)",

    // src/lib/utils/threadList.ts
    "threadList.noPreview": "(no preview)",

    // src/lib/utils/threePidInvite.ts
    "threePidInvite.youDonTHavePermissionTo":
        "You don't have permission to invite people to this room.",
    "threePidInvite.yourHomeserverHasNoIdentityServer":
        "Your homeserver has no identity server, so email invites aren't available.",

    // src/lib/utils/timeFormat.ts
    "timeFormat.yesterdayAt": "Yesterday at {time}",
    "timeFormat.today": "Today",
    "timeFormat.yesterday": "Yesterday",
    "timeFormat.separatorDatePattern": "EEEE, MMMM d, yyyy",
    "timeFormat.monthDayPattern": "MMM d",
    "timeFormat.compactDateTime": "{date}, {time}",

    // src/lib/utils/updateStatus.ts
    "updateStatus.checkingForUpdates": "Checking for updates…",
    "updateStatus.youReOnTheLatestVersion":
        "You're on the latest version{versionSuffix}",
    "updateStatus.checkForUpdates": "Check for updates",
    "updateStatus.updateAvailable": "Update available{versionSuffix}",
    "updateStatus.downloadInstall": "Download & install",
    "updateStatus.downloadingV": "Downloading v{version}",
    "updateStatus.downloadingUpdate": "Downloading update",
    "updateStatus.updateReadyInstall": "Update ready{versionSuffix} - Install",
    "updateStatus.install": "Install",
    "updateStatus.updateReadyRestartToApply":
        "Update ready{versionSuffix} - restart to apply",
    "updateStatus.restartToApply": "Restart to apply",
    "updateStatus.aNewVersionIsAvailable":
        "A new version is available{versionSuffix}",
    "updateStatus.openReleasePage": "Open release page",
    "updateStatus.updateCheckFailed": "Update check failed",
    "updateStatus.checkForUpdatesToInstallThe":
        "Check for updates to install the latest version.",

    // src/lib/utils/uploadLimits.ts
    "uploadLimits.mb": "{round} MB",
    "uploadLimits.kb": "{round} KB",
    "uploadLimits.exceedsTheServerSUploadLimit":
        '"{fileName}" exceeds the server\'s {formatByteLimit} upload limit',

    // src/lib/utils/verificationMessage.ts
    "verificationMessage.verificationRequestSent": "Verification request sent",
    "verificationMessage.waitingForThemToAccept": "Waiting for them to accept…",
    "verificationMessage.noLongerPending": "No longer pending",
    "verificationMessage.wantsToVerify": "{senderName} wants to verify",
    "verificationMessage.compareEmojiToConfirmThisIs":
        "Compare emoji to confirm this is really them",
    "verificationMessage.sentAVerificationRequest":
        "{senderName} sent a verification request",

    // src/lib/utils/verificationStatus.ts
    "verificationStatus.checkingEncryption": "Checking encryption…",
    "verificationStatus.encryptionUnavailable": "Encryption unavailable",
    "verificationStatus.statusUnavailable": "Status unavailable",
    "verificationStatus.verified": "Verified",
    "verificationStatus.thisSessionIsVerifiedAndEncryption":
        "This session is verified and encryption is fully set up.",
    "verificationStatus.notSetUp": "Not set up",
    "verificationStatus.setUpEncryptionToSecureYour":
        "Set up encryption to secure your messages across devices.",
    "verificationStatus.setUp": "Set up",
    "verificationStatus.encryptionSetupIncomplete":
        "Encryption setup incomplete",
    "verificationStatus.thisSessionIsVerifiedButEncryption":
        "This session is verified, but encryption setup is incomplete.",
    "verificationStatus.finishSetup": "Finish setup",
    "verificationStatus.unverified": "Unverified",
    "verificationStatus.thisSessionIsnTVerifiedYet":
        "This session isn't verified yet.",

    // src/routes/+layout.svelte
    "rootLayout.linkCopied": "Link copied",

    // src/routes/+page.svelte
    "rootPage.failedToReconnectPleaseLogIn":
        "Failed to reconnect. Please log in again.",
    "rootPage.signedInButSyncingCouldNot":
        "Signed in, but syncing could not start. Please try again.",
    "rootPage.yourSessionHasExpiredPleaseSign":
        "Your session has expired. Please sign in again.",

    // ownStatus
    "ownStatus.profileField": "profile field {key}",
    "ownStatus.theServerStillHas": "The server still has: {leftovers}",
    "ownStatus.statusClearedButPresenceRemains":
        'Status cleared, but the server still shows the presence message "{presenceLeft}". It is probably set by another session of this account (another app or client) - clear it there, or sign that session out.',
};

export type MessageKey = keyof typeof en;
