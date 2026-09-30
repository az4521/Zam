// Assyrian Neo-Aramaic (Suret, ISO 639-3 `aii`), written in the Syriac
// script (unvocalised, Eastern conventions). Same keys and placeholders
// as ../en.ts; typed as a full `Record` so a new English string that is
// not yet translated here fails type-checking instead of silently
// showing English.

import type { MessageKey } from "../en";
import type { LocaleCatalogue } from "../index";

const messages: Record<MessageKey, string> = {
    // Shared
    "common.turnOffCamera": "ܛܦܝ ܟܡܪܐ",
    "common.turnOnCamera": "ܕܠܩ ܟܡܪܐ",
    "common.stopSharing": "ܦܣܘܩ ܫܘܬܦܘܬܐ",
    "common.shareYourScreen": "ܫܘܬܦ ܡܚܙܝܬܐ ܕܝܘܟ",
    "common.joining": "ܒܥܠܠܐ…",
    "common.join": "ܥܘܠ",
    "common.closeDialog": "ܣܟܘܪ ܟܘܬܐ",
    "common.settings": "ܛܘܝܒ̈ܐ",
    "common.searchResults": "ܦܠܛ̈ܐ ܕܒܘܨܝܐ",
    "common.default": "ܥܕܝܠܐ",
    "common.mute": "ܫܬܩ",
    "common.saving": "ܒܢܛܪܐ…",
    "common.unblock": "ܫܪܝ ܟܠܝܐ",
    "common.block": "ܟܠܝ",
    "common.closeMenu": "ܣܟܘܪ ܪܫܝܡܬܐ",
    "common.openRoomList": "ܦܬܘܚ ܪܫܝܡܬܐ ܕܓܘܡ̈ܐ",
    "common.uploading": "ܒܐܣܩܐ…",
    "common.uploadImage": "ܐܣܩ ܨܘܪܬܐ",
    "common.emoji": "ܐܝܡܘܓܝ",
    "common.decline": "ܠܐ ܩܒܠ",
    "common.invitePeople": "ܙܡܢ ܢܫ̈ܐ",
    "common.close": "ܣܟܘܪ",
    "common.cancel": "ܒܛܠ",
    "common.loading": "ܒܛܥܢܐ…",
    "common.loadMore": "ܛܥܘܢ ܝܬܝܪ",
    "common.notifications": "ܡܘܕܥܢܘ̈ܬܐ",
    "common.save": "ܢܛܘܪ",
    "common.topic": "ܢܝܫܐ",
    "common.videoRoom": "ܓܘܡܐ ܕܒܝܕܝܘ",
    "common.reasonOptional": "ܥܠܬܐ (ܠܐ ܡܚܝܒܬܐ)",
    "common.actions": "ܣܘܥܪ̈ܢܐ",
    "common.copy": "ܢܣܘܚ",
    "common.remove": "ܫܩܘܠ",
    "common.add": "ܐܘܣܦ",
    "common.starting": "ܒܫܘܪܝܐ…",
    "common.verify": "ܫܪܪ",
    "common.removeFromFavourites": "ܫܩܘܠ ܡܢ ܚܒܝ̈ܒܐ",
    "common.addToFavourites": "ܐܘܣܦ ܠܚܒܝ̈ܒܐ",
    "common.stickers": "ܢܩܦ̈ܬܐ",
    "common.retry": "ܢܣܝ ܡܢ ܕܪܝܫ",
    "common.delete": "ܫܘܦ",
    "common.checking": "ܒܒܨܝܐ…",
    "common.gifs": "GIF",
    "common.dragOrUseArrowKeysTo": "ܓܪܘܫ ܝܢ ܦܠܚ ܒܩܠܝ̈ܕܐ ܕܓܐܪ̈ܐ ܠܫܚܠܦܬܐ ܕܡܫܘܚܬܐ",
    "common.resizePicker": "ܫܚܠܦ ܡܫܘܚܬܐ ܕܓܒܝܬܐ",
    "common.noResults": "ܠܝܬ ܦܠܛ̈ܐ",
    "common.memberCount": "{count, plural, one {# ܗܕܡܐ} other {# ܗܕܡ̈ܐ}}",
    "common.replyCount": "{count, plural, one {# ܦܢܝܬܐ} other {# ܦܢܝ̈ܬܐ}}",

    // src/lib/components/settings/AboutSettings.svelte
    "aboutSettings.automaticUpdates": "ܚܘܕ̈ܬܐ ܐܘܛܘܡܛܝܩܝ̈ܐ",
    "aboutSettings.version": "ܢܘܣܚܐ",
    "aboutSettings.currentVersionV": "ܢܘܣܚܐ ܗܫܝܐ v{APP_VERSION}",
    "aboutSettings.checkForUpdates": "ܒܨܝ ܚܘܕ̈ܬܐ",
    "aboutSettings.updateAvailable": "ܐܝܬ ܚܘܕܬܐ",
    "aboutSettings.reloading": "ܒܛܥܢܐ ܡܢ ܕܪܝܫ…",
    "aboutSettings.update": "ܚܕܬ",
    "aboutSettings.reloadToUpdate": "ܛܥܘܢ ܡܢ ܕܪܝܫ ܠܚܘܕܬܐ",
    "aboutSettings.youReOnTheLatestVersion": "ܗܢܐ ܝܠܗ ܢܘܣܚܐ ܐܚܪܝܐ.",
    "aboutSettings.credits": "ܬܘܕܝ̈ܬܐ",
    "aboutSettings.creditsMidiInstruments": "ܡܐܢ̈ܐ ܕ MIDI",
    "aboutSettings.creditsSoundFont":
        "ܡܢ {author}، ܥܠ ܫܬܐܣܐ ܕ Phoenix ܡܢ {original}. ܬܚܝܬ ܦܣܩܐ CC BY؛ ܫܘܚܠܦܐ ܠ General MIDI ܘܟܒܝܫܐ ܠ Zam.",
    "aboutSettings.troubleshooting": "ܬܘܪܨܐ ܕܦܘܕ̈ܐ",
    "aboutSettings.clearCacheAndResync": "ܫܘܦ ܓܙܐ ܘܛܥܘܢ ܡܢ ܕܪܝܫ",
    "aboutSettings.reDownloadsYourRoomsFromThe":
        "ܡܐܚܬ ܓܘܡ̈ܐ ܕܝܘܟ ܡܢ ܕܪܝܫ ܡܢ ܣܝܪܒܪ. ܡܬܪܨ ܓܘܡ̈ܐ ܕܚܣܝܪ̈ܐ ܝܢ ܕܩܝܥ̈ܐ. ܦܝܫܬ ܥܠܝܠܐ.",
    "aboutSettings.resyncing": "ܒܛܥܢܐ ܡܢ ܕܪܝܫ…",
    "aboutSettings.clearCache": "ܫܘܦ ܓܙܐ",
    "aboutSettings.updateCheckFailed": "ܒܘܨܝܐ ܕܚܘܕ̈ܬܐ ܠܐ ܦܠܚܠܗ",
    "aboutSettings.downloadFailed": "ܐܚܬܬܐ ܠܐ ܦܠܚܠܗ̇",
    "aboutSettings.installFailed": "ܢܨܒܬܐ ܠܐ ܦܠܚܠܗ̇",
    "aboutSettings.failedToCheckForUpdates": "ܒܘܨܝܐ ܕܚܘܕ̈ܬܐ ܠܐ ܦܠܚܠܗ.",

    // src/lib/components/settings/AccountSettings.svelte
    "accountSettings.profile": "ܦܪܨܘܦܐ",
    "accountSettings.yourAvatar": "ܨܘܪܬܐ ܕܝܘܟ",
    "accountSettings.changeAvatar": "ܫܚܠܦ ܨܘܪܬܐ",
    "accountSettings.yourDisplayName": "ܫܡܐ ܕܝܘܟ ܕܚܙܝܐ",
    "accountSettings.saved": "ܢܛܝܪܐ",
    "accountSettings.account": "ܚܘܫܒܢܐ",
    "accountSettings.userId": "ܗܝܝܘܬܐ ܕܡܦܠܚܢܐ",
    "accountSettings.homeserver": "ܣܝܪܒܪ ܕܒܝܬܐ",
    "accountSettings.connection": "ܐܚܝܕܘܬܐ",
    "accountSettings.presence": "ܐܝܬܝܘܬܐ",
    "accountSettings.password": "ܡܠܬܐ ܕܥܒܪܐ",
    "accountSettings.currentPassword": "ܡܠܬܐ ܕܥܒܪܐ ܗܫܝܬܐ",
    "accountSettings.newPassword": "ܡܠܬܐ ܕܥܒܪܐ ܚܕܬܐ",
    "accountSettings.confirmNewPassword": "ܫܪܪ ܡܠܬܐ ܕܥܒܪܐ ܚܕܬܐ",
    "accountSettings.signOutAllOtherSessions": "ܦܘܩ ܡܢ ܟܠ ܓܠܣ̈ܐ ܐܚܪ̈ܢܐ",
    "accountSettings.changing": "ܒܫܚܠܦܐ…",
    "accountSettings.changePassword": "ܫܚܠܦ ܡܠܬܐ ܕܥܒܪܐ",
    "accountSettings.passwordChanged": "ܡܠܬܐ ܕܥܒܪܐ ܝܠܗ̇ ܡܫܘܚܠܦܬܐ.",
    "accountSettings.thisServerDoesNotAllowChanging":
        "ܗܢܐ ܣܝܪܒܪ ܠܐ ܝܗܒ ܦܣܐ ܠܫܚܠܦܬܐ ܕܡܠܬܐ ܕܥܒܪܐ ܡܢ ܗܕܐ ܬܘܟܢܝܬܐ.",
    "accountSettings.emailPhoneNumbers": "ܐܝܡܝܠ ܘܡܢܝܢ̈ܐ ܕܬܠܝܦܘܢ",
    "accountSettings.noEmailAddressesOrPhoneNumbers":
        "ܠܝܬ ܐܝܡܝܠ ܝܢ ܡܢܝܢ̈ܐ ܕܬܠܝܦܘܢ ܐܣܝܪ̈ܐ ܥܡ ܗܢܐ ܚܘܫܒܢܐ.",
    "accountSettings.email": "ܐܝܡܝܠ",
    "accountSettings.phone": "ܬܠܝܦܘܢ",
    "accountSettings.thisServerDoesNotAllowManaging":
        "ܗܢܐ ܣܝܪܒܪ ܠܐ ܝܗܒ ܦܣܐ ܠܡܕܒܪܢܘܬܐ ܕܐܢܝ̈ ܡܢ ܗܕܐ ܬܘܟܢܝܬܐ.",
    "accountSettings.logOut": "ܦܘܩ",
    "accountSettings.dangerZone": "ܦܢܝܬܐ ܕܣܘܟܢܐ",
    "accountSettings.deactivateAccount": "ܒܛܠ ܚܘܫܒܢܐ…",
    "accountSettings.deactivationIsPermanentAndCannotBe":
        "ܒܘܛܠܐ ܕܚܘܫܒܢܐ ܠܥܠܡ ܝܠܗ ܘܠܐ ܦܝܫ ܗܦܟܐ.",
    "accountSettings.eraseMessagesWherePossible": "ܫܘܦ ܐܓܪ̈ܬܐ ܐܝܟܐ ܕܡܨܐ",
    "accountSettings.deactivating": "ܒܒܘܛܠܐ…",
    "accountSettings.deactivateAccount2": "ܒܛܠ ܚܘܫܒܢܐ",
    "accountSettings.avatarUploadFailed": "ܐܣܩܬܐ ܕܨܘܪܬܐ ܠܐ ܦܠܚܠܗ̇",
    "accountSettings.failedToRemoveAvatar": "ܫܩܠܐ ܕܨܘܪܬܐ ܠܐ ܦܠܚܠܗ",
    "accountSettings.failedToSaveName": "ܢܛܪܐ ܕܫܡܐ ܠܐ ܦܠܚܠܗ",
    "accountSettings.couldNotSetPresence": "ܛܘܝܒܐ ܕܐܝܬܝܘܬܐ ܠܐ ܦܠܚܠܗ",
    "accountSettings.failedToChangePassword": "ܫܘܚܠܦܐ ܕܡܠܬܐ ܕܥܒܪܐ ܠܐ ܦܠܚܠܗ",
    "accountSettings.failedToDeactivateAccount": "ܒܘܛܠܐ ܕܚܘܫܒܢܐ ܠܐ ܦܠܚܠܗ",

    // src/lib/components/layout/AccountSwitcher.svelte
    "accountSwitcher.signOut": "ܦܘܩ ܡܢ {userId}",
    "accountSwitcher.confirm": "ܫܪܪ",
    "accountSwitcher.signOut2": "ܦܘܩ",
    "accountSwitcher.addAccount": "ܐܘܣܦ ܚܘܫܒܢܐ",
    "accountSwitcher.accountMenu": "ܪܫܝܡܬܐ ܕܚܘܫܒܢܐ",
    "accountSwitcher.closeAccountMenu": "ܣܟܘܪ ܪܫܝܡܬܐ ܕܚܘܫܒܢܐ",
    "accountSwitcher.back": "ܠܒܣܬܪܐ",
    "accountSwitcher.setYourStatus": "ܛܝܒ ܐܝܟܢܝܘܬܐ ܕܝܘܟ",
    "accountSwitcher.setAStatus": "ܛܝܒ ܐܝܟܢܝܘܬܐ",
    "accountSwitcher.editProfile": "ܬܩܢ ܦܪܨܘܦܐ",
    "accountSwitcher.switchAccounts": "ܫܚܠܦ ܚܘܫܒܢܐ",
    "accountSwitcher.couldNotSetPresence": "ܛܘܝܒܐ ܕܐܝܬܝܘܬܐ ܠܐ ܦܠܚܠܗ",

    // src/lib/components/layout/ActiveCallBanner.svelte
    "activeCallBanner.openCall": "ܦܬܘܚ ܩܪܝܬܐ",
    "activeCallBanner.ringing": "ܒܩܪܝܐ…",
    "activeCallBanner.voiceCallInCall": "ܩܪܝܬܐ ܕܩܠܐ · {length} ܓܘ ܩܪܝܬܐ",
    "activeCallBanner.leave": "ܫܒܘܩ",

    // src/lib/components/settings/AppearanceSettings.svelte
    "appearanceSettings.rightAlignMyMessagesBubbleLayout":
        "ܣܕܪ ܐܓܪ̈ܬܝ ܠܓܢܒܐ ܐܚܪܢܐ (ܛܘܦܣܐ ܕܒܥܒܘ̈ܥܐ)",
    "appearanceSettings.displayYourOwnMessagesOnThe":
        "ܚܘܝ ܐܓܪ̈ܬܐ ܕܝܘܟ ܒܓܢܒܐ ܐܚܪܢܐ ܓܘ ܒܥܒܘܥܐ ܓܘܢܝܐ",
    "appearanceSettings.showNameColours": "ܚܘܝ ܓܘܢ̈ܐ ܕܫܡ̈ܗܐ",
    "appearanceSettings.drawPeopleSNamesInThe":
        "ܚܘܝ ܫܡ̈ܗܐ ܕܢܫ̈ܐ ܒܓܘܢܐ ܕܓܒܝܠܗܘܢ ܓܘ ܦܪܨܘܦܐ ܕܝܗܘܢ. ܛܦܝ ܩܐ ܦܠܚܬܐ ܕܓܘܢܐ ܥܕܝܠܐ ܕܟܬܒܐ ܩܐ ܟܠ ܢܫܐ.",
    "appearanceSettings.keepRoomListOpen": "ܦܘܫ ܪܫܝܡܬܐ ܕܓܘܡ̈ܐ ܦܬܝܚܬܐ",
    "appearanceSettings.donTAutoCloseTheRoom":
        "ܠܐ ܣܟܘܪ ܪܫܝܡܬܐ ܕܓܘܡ̈ܐ ܡܢ ܓܢܗ̇ ܒܫܘܚܠܦܐ ܒܝܢ ܚܘܕܪ̈ܐ ܝܢ ܒܝܬܐ. ܦܬܚܬܐ ܕܓܘܡܐ ܝܢ ܕܐܓܪܬܐ ܫܪܝܪܬܐ ܟܠ ܙܒܢܐ ܣܟܪܐ ܠܗ̇.",
    "appearanceSettings.timestamps": "ܛܒ̈ܥܐ ܕܙܒܢܐ",
    "appearanceSettings.timeFormat": "ܛܘܦܣܐ ܕܫܥܬܐ",
    "appearanceSettings.dateFormat": "ܛܘܦܣܐ ܕܬܐܪܝܟܐ",
    "appearanceSettings.customDatePattern": "ܛܘܦܣܐ ܦܪܨܘܦܝܐ ܕܬܐܪܝܟܐ",
    "appearanceSettings.yyyyMmDd": "yyyy-MM-dd",
    "appearanceSettings.preview": "ܚܙܝܬܐ ܩܕܡܝܬܐ:",
    "appearanceSettings.dateFnsTokensEGYyyy":
        "· ܐܬ̈ܘܬܐ ܕ date-fns، ܡܬܠܐ: yyyy-MM-dd",
    "appearanceSettings.invalidFormatUseLowercaseDateFns":
        "ܛܘܦܣܐ ܠܐ ܬܪܝܨܐ - ܦܠܚ ܒܐܬ̈ܘܬܐ ܙܥܘܪ̈ܐ ܕ date-fns ܐܝܟ yyyy-MM-dd.",
    "appearanceSettings.alwaysShowAbsoluteDates": "ܟܠ ܙܒܢܐ ܚܘܝ ܬܐܪܝܟܐ ܫܠܡܐ",
    "appearanceSettings.replaceTodayAndYesterdayWithThe":
        'ܫܚܠܦ "ܐܕܝܘܡ" ܘ"ܬܡܠ" ܒܬܐܪܝܟܐ ܫܠܡܐ ܒܟܠ ܕܘܟܐ.',
    "appearanceSettings.reduceMotion": "ܒܨܪ ܙܘܥܐ",
    "appearanceSettings.minimizeAnimationsAndTransitionsYourDevice":
        'ܒܨܪ ܙܘܥ̈ܐ ܘܫܘܚܠܦ̈ܐ. ܛܘܝܒܐ ܕ"ܒܨܪ ܙܘܥܐ" ܕܡܐܢܐ ܕܝܘܟ ܟܠ ܙܒܢܐ ܝܠܗ ܡܝܩܪܐ ܒܕ.',
    "appearanceSettings.custom": "ܦܪܨܘܦܝܐ",
    "appearanceSettings.12Hour": "12 ܫܥ̈ܐ",
    "appearanceSettings.24Hour": "24 ܫܥ̈ܐ",
    "appearanceSettings.language": "ܠܫܢܐ",
    "appearanceSettings.displayLanguage": "ܠܫܢܐ ܕܚܙܝܬܐ",
    "appearanceSettings.displayLanguageHint":
        "ܠܫܢܐ ܕܒܗ ܪܫܝܡ̈ܬܐ ܘܙܪ̈ܐ ܕ Zam ܚܙܝܐ ܝܢ. ܫܚܠܦܬܐ ܕܝܗ̇ ܛܥܢܐ ܠܬܘܟܢܝܬܐ ܡܢ ܕܪܝܫ.",

    // src/routes/app/+page.svelte
    "appPage.redirecting": "ܒܡܫܢܝܐ…",

    // src/lib/components/layout/AppSettings.svelte
    "appSettings.backToSettings": "ܠܒܣܬܪܐ ܠܛܘܝܒ̈ܐ",
    "appSettings.closeSettings": "ܣܟܘܪ ܛܘܝܒ̈ܐ",
    "appSettings.searchSettings": "ܒܨܝ ܛܘܝܒ̈ܐ…",
    "appSettings.searchSettings2": "ܒܨܝ ܛܘܝܒ̈ܐ",
    "appSettings.noSettingsMatch": "ܠܐ ܦܝܫܝ ܡܫܟܚܐ ܛܘܝܒ̈ܐ",
    "appSettings.noSettingsMatch2": 'ܠܐ ܦܝܫܝ ܡܫܟܚܐ ܛܘܝܒ̈ܐ ܩܐ "{searchQuery}".',
    "appSettings.resultCount": "{count, plural, one {# ܦܠܛܐ} other {# ܦܠܛ̈ܐ}}",

    // src/lib/components/layout/AppShell.svelte
    "appShell.zam": "({notificationCount}) Zam",
    "appShell.redirecting": "ܒܡܫܢܝܐ…",
    "appShell.noRoomsYet": "ܠܝܬ ܓܘܡ̈ܐ ܗܠ ܗܫܐ",
    "appShell.createARoomOrStartA": "ܒܪܝ ܓܘܡܐ ܝܢ ܫܪܝ ܐܓܪܬܐ ܫܪܝܪܬܐ ܩܐ ܫܘܪܝܐ.",
    "appShell.nothingInHome": "ܠܝܬ ܡܕܡ ܓܘ ܒܝܬܐ",
    "appShell.allOfYourRoomsLiveIn":
        "ܟܠ ܓܘܡ̈ܐ ܕܝܘܟ ܝܢ ܓܘ ܚܘܕܪ̈ܐ - ܦܬܘܚ ܚܕ ܩܐ ܚܙܝܬܐ ܕܝܗܝ. ܓܘܡ̈ܐ ܘܐܓܪ̈ܬܐ ܫܪܝܪ̈ܬܐ ܠܒܪ ܡܢ ܚܘܕܪܐ ܚܙܝܐ ܝܢ ܗܪܟܐ.",
    "appShell.openRoomList": "ܦܬܘܚ ܪܫܝܡܬܐ ܕܓܘܡ̈ܐ",
    "appShell.someone": "ܚܕ ܢܫܐ",
    "appShell.isCalling": "ܩܪܝܬܐ ܡܢ {name}",
    "appShell.incomingCall": "ܩܪܝܬܐ ܕܐܬܝܐ",
    "appShell.offlineMessageStorageIsUnavailableThis":
        "ܓܙܐ ܕܐܓܪ̈ܬܐ ܕܠܐ ܐܚܝܕܘܬܐ ܠܐ ܝܠܗ ܡܫܟܚܐ ܒܗܢܐ ܓܠܣܐ، ܗܕܟܐ ܬܫܥܝܬܐ ܠܐ ܒܕ ܢܛܪܐ ܩܐ ܙܒܢܐ ܐܚܪܢܐ.",
    "appShell.couldnTSendYourReplyIt":
        "ܦܢܝܬܐ ܕܝܘܟ ܠܐ ܫܕܪܬܠܗ̇. ܢܛܝܪܬܐ ܝܠܗ̇ ܐܝܟ ܪܘܫܡܐ.",
    "appShell.yourNotificationReplyWasSavedAs":
        "ܦܢܝܬܐ ܕܝܘܟ ܡܢ ܡܘܕܥܢܘܬܐ ܢܛܝܪܬܐ ܝܠܗ̇ ܐܝܟ ܪܘܫܡܐ",

    // src/lib/components/settings/BlockedUsersSettings.svelte
    "blockedUsersSettings.messagesFromBlockedUsersAreHidden":
        "ܐܓܪ̈ܬܐ ܡܢ ܡܦܠܚܢ̈ܐ ܟܠܝ̈ܐ ܛܫܝ̈ܐ ܝܢ ܓܘ ܟܠ ܓܘܡܐ. ܪܫܝܡܬܐ ܢܛܝܪܬܐ ܝܠܗ̇ ܓܘ ܚܘܫܒܢܐ ܕܝܘܟ ܘܦܠܚܐ ܥܠ ܟܠ ܓܠܣ̈ܐ ܕܝܘܟ.",
    "blockedUsersSettings.youHavenTBlockedAnyone": "ܠܐ ܟܠܝܠܘܟ ܚܕ ܢܫܐ.",
    "blockedUsersSettings.failed": "ܠܐ ܦܠܚܠܗ",

    // src/lib/components/layout/CallParticipantMenu.svelte
    "callParticipantMenu.profile": "ܦܪܨܘܦܐ",
    "callParticipantMenu.input": "ܡܥܠܢܐ",
    "callParticipantMenu.output": "ܡܦܩܢܐ",
    "callParticipantMenu.opening": "ܒܦܬܚܐ…",
    "callParticipantMenu.message": "ܐܓܪܬܐ",
    "callParticipantMenu.mention": "ܕܟܘܪ",
    "callParticipantMenu.userVolume": "ܪܡܘܬܐ ܕܩܠܐ ܕܡܦܠܚܢܐ",
    "callParticipantMenu.hideVideo": "ܛܫܝ ܒܝܕܝܘ",
    "callParticipantMenu.kicking": "ܒܛܪܕܐ…",
    "callParticipantMenu.confirmKick": "ܫܪܪ ܛܪܕܐ ܕ{name}؟",
    "callParticipantMenu.kickFromRoom": "ܛܪܘܕ {name} ܡܢ ܓܘܡܐ",
    "callParticipantMenu.banning": "ܒܐܣܪܐ…",
    "callParticipantMenu.confirmBan": "ܫܪܪ ܐܣܪܐ ܕ{name}؟",
    "callParticipantMenu.ban": "ܐܣܘܪ {name}",
    "callParticipantMenu.couldNotOpenADirectMessage":
        "ܦܬܚܐ ܕܐܓܪܬܐ ܫܪܝܪܬܐ ܠܐ ܦܠܚܠܗ",
    "callParticipantMenu.couldNotKick": "ܛܪܕܐ ܕ{name} ܠܐ ܦܠܚܠܗ",
    "callParticipantMenu.couldNotBan": "ܐܣܪܐ ܕ{name} ܠܐ ܦܠܚܠܗ",

    // src/lib/components/layout/CallView.svelte
    "callView.ringing": "ܒܩܪܝܐ…",
    "callView.showChat": "ܚܘܝ ܡܡܠܠܐ",
    "callView.noOneIsInThisCall": "ܠܝܬ ܚܕ ܢܫܐ ܓܘ ܗܕܐ ܩܪܝܬܐ",
    "callView.backToGrid": "ܠܒܣܬܪܐ ܠܡܨܝܕܬܐ",
    "callView.screenShareQuality": "ܐܝܢܝܘܬܐ ܕܫܘܬܦܘܬܐ ܕܡܚܙܝܬܐ",
    "callView.optionsFor": "ܓܒܝ̈ܬܐ ܩܐ {name}",
    "callView.muted": "ܫܬܝܩܐ",
    "callView.deafened": "ܫܡܥܐ ܣܟܝܪܐ",
    "callView.mutedForYou": "ܫܬܝܩܐ ܩܬܘܟ",
    "callView.joinedFromMultipleDevices": "ܥܠܠܗ ܡܢ ܒܝܫ ܡܢ ܚܕ ܡܐܢܐ",
    "callView.devices": "{value} ܡܐܢ̈ܐ",
    "callView.enableAudio": "ܕܠܩ ܩܠܐ",
    "callView.unmute": "ܫܪܝ ܫܬܩܐ",
    "callView.undeafen": "ܦܬܘܚ ܫܡܥܐ",
    "callView.deafen": "ܣܟܘܪ ܫܡܥܐ",
    "callView.disconnect": "ܦܣܘܩ ܐܚܝܕܘܬܐ",
    "callView.joinCall": "ܥܘܠ ܠܩܪܝܬܐ",
    "callView.you": "ܐܢܬ",
    "callView.sScreen": "ܡܚܙܝܬܐ ܕ{name}",
    "callView.exitSpotlightFor": "ܦܘܩ ܡܢ ܢܘܗܪܐ ܕ{label}",
    "callView.spotlight": "ܢܘܗܪܐ ܥܠ {label}",

    // src/lib/components/messages/CreatePollDialog.svelte
    "createPollDialog.createPoll": "ܒܪܝ ܫܘܐܠܬܐ",
    "createPollDialog.question": "ܫܘܐܠܐ",
    "createPollDialog.askSomething": "ܫܐܘܠ ܡܕܡ…",
    "createPollDialog.options": "ܓܒܝ̈ܬܐ",
    "createPollDialog.option": "ܓܒܝܬܐ {value}",
    "createPollDialog.removeOption": "ܫܩܘܠ ܓܒܝܬܐ",
    "createPollDialog.addOption": "+ ܐܘܣܦ ܓܒܝܬܐ",
    "createPollDialog.results": "ܦܠܛ̈ܐ",
    "createPollDialog.showAsPeopleVote": "ܚܘܝ ܐܝܟ ܕܢܫ̈ܐ ܝܗܒܝ ܩܠ̈ܐ",
    "createPollDialog.hideUntilClosed": "ܛܫܝ ܗܕܝܡܐ ܕܣܟܪܐ",
    "createPollDialog.allowSelectingMultipleOptions":
        "ܗܒ ܦܣܐ ܠܓܒܝܬܐ ܕܓܒܝ̈ܬܐ ܣܓܝ̈ܐܐ",
    "createPollDialog.creating": "ܒܒܪܝܐ…",
    "createPollDialog.failedToCreatePoll": "ܒܪܝܐ ܕܫܘܐܠܬܐ ܠܐ ܦܠܚܠܗ",

    // src/lib/components/layout/CryptoUnavailableBanner.svelte
    "cryptoUnavailableBanner.encryptionIsUnavailableThisSessionEncrypted":
        "ܛܘܫܝܐ ܠܐ ܝܠܗ ܡܫܟܚܐ ܒܗܢܐ ܓܠܣܐ: ܐܓܪ̈ܬܐ ܡܛܫܝ̈ܬܐ ܠܐ ܡܨܝܐ ܕܩܪܝ ܝܢ ܕܫܕܪ. ܛܥܘܢ ܡܢ ܕܪܝܫ ܩܐ ܢܣܝܢܐ ܐܚܪܢܐ.",
    "cryptoUnavailableBanner.reload": "ܛܥܘܢ ܡܢ ܕܪܝܫ",
    "cryptoUnavailableBanner.dismissEncryptionWarning": "ܫܩܘܠ ܙܘܗܪܐ ܕܛܘܫܝܐ",

    // src/lib/components/settings/CustomPackSettings.svelte
    "customPackSettings.add": "ܐܘܣܦ {singular}",
    "customPackSettings.shortcode": "ܪܡܙܐ ܟܪܝܐ",
    "customPackSettings.sticker": "ܢܩܦܬܐ",
    "customPackSettings.remove": "ܫܩܘܠ {toLowerCase}",
    "customPackSettings.image": "ܨܘܪܬܐ",
    "customPackSettings.chooseAtLeastOneUsage": "ܓܒܝ ܚܕ ܦܘܠܚܢܐ ܠܦܚܘܬ ܡܢ ܟܠ.",
    "customPackSettings.uploadFailed": "ܐܣܩܬܐ ܠܐ ܦܠܚܠܗ̇",
    "customPackSettings.failedToRemove": "ܫܩܠܐ ܕ{singular} ܠܐ ܦܠܚܠܗ",
    "customPackSettings.failedToUpdateUsage": "ܚܘܕܬܐ ܕܦܘܠܚܢܐ ܠܐ ܦܠܚܠܗ̇",
    "customPackSettings.noCustomImages": "ܠܝܬ ܨܘܪ̈ܝܬܐ ܦܪܨܘܦܝ̈ܐ",
    "customPackSettings.noCustomEmojis": "ܠܝܬ ܐܝܡܘܓܝ ܦܪܨܘܦܝܐ",
    "customPackSettings.noCustomStickers": "ܠܝܬ ܢܩܦ̈ܬܐ ܦܪܨܘܦܝ̈ܬܐ",

    // src/lib/components/debug/DebugEventItem.svelte
    "debugEventItem.stateKey": "state_key",
    "debugEventItem.empty": "(ܣܦܝܩܐ)",
    "debugEventItem.redacted": "ܫܝܦܐ",
    "debugEventItem.id": "id: {eventId}",

    // src/lib/components/debug/DebugPanel.svelte
    "debugPanel.debugPanel": "ܦܢܝܬܐ ܕܬܘܪܨܐ",
    "debugPanel.sync": "ܐܚܕܝܘܬܐ:",
    "debugPanel.refresh": "↻ ܚܕܬ",
    "debugPanel.copied": "✓ ܢܣܝܚܐ",
    "debugPanel.copy": "⧉ ܢܣܘܚ",
    "debugPanel.unreadState": "ܐܝܟܢܝܘܬܐ ܕܠܐ ܩܪܝܐ",
    "debugPanel.unread": "ܠܐ ܩܪܝܐ:",
    "debugPanel.highlight": "ܢܘܗܪܐ:",
    "debugPanel.userid": "userId:",
    "debugPanel.readuptoid": "readUpToId:",
    "debugPanel.readidxInTimeline": "readIdx ܓܘ ܣܕܪܐ ܕܙܒܢܐ:",
    "debugPanel.noReceipt": "ܠܝܬ ܩܘܒܠܐ",
    "debugPanel.n1NotInWindow": "-1 (ܠܐ ܝܠܗ ܓܘ ܟܘܬܐ!)",
    "debugPanel.events": "/ {totalEvents} ܓܕܫ̈ܐ",
    "debugPanel.lastEventSender": "ܫܕܪܢܐ ܕܓܕܫܐ ܐܚܪܝܐ:",
    "debugPanel.me": "(ܐܢܐ:",
    "debugPanel.notificationEventsAfterReadMarker":
        "ܓܕܫ̈ܐ ܕܡܘܕܥܢܘܬܐ ܒܬܪ ܢܝܫܢܐ ܕܩܪܝܬܐ:",
    "debugPanel.from": "[{formatTs}] {getType} ܡܢ {value} - {msgPreview}",
    "debugPanel.pushRules": "ܢܡܘܣ̈ܐ ܕܡܘܕܥܢܘܬܐ",
    "debugPanel.default": "(ܥܕܝܠܐ)",
    "debugPanel.actions": "ܣܘܥܪ̈ܢܐ: {stringify}",
    "debugPanel.conditions": "ܫܪ̈ܛܐ: {stringify}",
    "debugPanel.noPushRulesFound": "ܠܐ ܦܝܫܝ ܡܫܟܚܐ ܢܡܘܣ̈ܐ ܕܡܘܕܥܢܘܬܐ",
    "debugPanel.readReceiptsEventsWithReceipts":
        "ܩܘܒܠ̈ܐ ܕܩܪܝܬܐ ({length} ܓܕܫ̈ܐ ܥܡ ܩܘܒܠ̈ܐ)",
    "debugPanel.noReceipts": "ܠܝܬ ܩܘܒܠ̈ܐ",
    "debugPanel.urlPreviewInspector": "ܒܨܝܢܐ ܕܚܙܝܬܐ ܩܕܡܝܬܐ ܕ URL",
    "debugPanel.https": "https://...",
    "debugPanel.storeMessagesWhatTheUiRenders":
        "ܐܓܪ̈ܬܐ ܕܓܙܐ ({length}) - ܡܐ ܕܚܙܝܐ ܝܠܗ ܓܘ ܦܐܬܐ",
    "debugPanel.redacted": "ܫܝܦܐ",
    "debugPanel.rel": "rel={relType}",
    "debugPanel.empty": "ܣܦܝܩܐ",
    "debugPanel.pendingEvents": "ܓܕܫ̈ܐ ܕܡܢܛܪܝܢ ({length})",
    "debugPanel.rawTimelineEvents": "ܣܕܪܐ ܕܙܒܢܐ ܚܠܝܐ ({length} ܓܕܫ̈ܐ)",

    // src/lib/components/settings/DebugSettings.svelte
    "debugSettings.developer": "ܒܢܝܢܐ",
    "debugSettings.showAllEvents": "ܚܘܝ ܟܠ ܓܕܫ̈ܐ",
    "debugSettings.displayEveryMatrixTimelineEventIn":
        "ܚܘܝ ܟܠ ܓܕܫܐ ܕ Matrix ܓܘ ܣܕܪܐ ܕܡܡܠܠܐ.",
    "debugSettings.syncStatus": "ܐܝܟܢܝܘܬܐ ܕܐܚܕܝܘܬܐ",
    "debugSettings.useSlidingSync": "ܦܠܚ ܒܐܚܕܝܘܬܐ ܓܠܝܫܬܐ",
    "debugSettings.experimentalLoadsRoomsInAGrowing":
        "ܢܣܝܢܝܐ. ܛܥܢܐ ܠܓܘܡ̈ܐ ܓܘ ܟܘܬܐ ܕܪܒܝܐ. ܛܥܢܐ ܠܬܘܟܢܝܬܐ ܡܢ ܕܪܝܫ ܩܐ ܦܠܚܬܐ.",
    "debugSettings.pushStatus": "ܐܝܟܢܝܘܬܐ ܕܡܘܕܥܢܘ̈ܬܐ",
    "debugSettings.lastError": "ܦܘܕܐ ܐܚܪܝܐ: {lastError}",
    "debugSettings.runDiagnostics": "ܫܪܝ ܒܘܚܢܐ",
    "debugSettings.homeserverPushers": "ܕܚܘܦ̈ܐ ܕܣܝܪܒܪ ܕܒܝܬܐ",
    "debugSettings.theHomeserverHasNoPushersRegistered":
        "ܣܝܪܒܪ ܕܒܝܬܐ ܠܝܬ ܠܗ ܕܚܘܦ̈ܐ ܪܫܝܡ̈ܐ ܩܐ ܗܢܐ ܚܘܫܒܢܐ.",
    "debugSettings.aPusherMatchesTheConfiguredGateway":
        "ܚܕ ܕܚܘܦܐ ܡܙܕܘܓ ܝܠܗ ܥܡ URL ܕܬܪܥܐ ܡܛܘܝܒܐ.",
    "debugSettings.noPusherMatchesTheConfiguredGateway":
        "ܠܝܬ ܕܚܘܦܐ ܕܡܙܕܘܓ ܥܡ URL ܕܬܪܥܐ ܡܛܘܝܒܐ.",
    "debugSettings.appId": "app_id: {app_id}",
    "debugSettings.none": "(ܠܝܬ)",
    "debugSettings.url": "url: {value}",
    "debugSettings.pushkey": "pushkey: {pushkeyPreview}",
    "debugSettings.webPushPwa": "ܡܘܕܥܢܘ̈ܬܐ ܕܘܝܒ (PWA)",
    "debugSettings.missing": "(ܚܣܝܪܐ)",
    "debugSettings.vapidKey": "ܩܠܝܕܐ ܕ VAPID: {value}",
    "debugSettings.permission": "ܦܣܐ: {permission}",
    "debugSettings.subscription": "ܡܫܬܬܦܢܘܬܐ: {value}",
    "debugSettings.notFound": "ܠܐ ܦܝܫܐ ܡܫܟܚܐ",
    "debugSettings.homeserverPusher": "ܕܚܘܦܐ ܕܣܝܪܒܪ ܕܒܝܬܐ: {value}",
    "debugSettings.error": "ܦܘܕܐ: {error}",
    "debugSettings.gatewaySygnalFirebase": "ܬܪܥܐ (Sygnal / Firebase)",
    "debugSettings.gatewayReachable": "ܬܪܥܐ ܡܛܝܐ ܝܠܗ",
    "debugSettings.gatewayNotReachable": "ܬܪܥܐ ܠܐ ܡܛܝܐ ܝܠܗ",
    "debugSettings.nativeSessionPushEnrichment":
        "ܓܠܣܐ ܡܬܘܡܝܐ (ܥܘܬܪܐ ܕܡܘܕܥܢܘ̈ܬܐ)",
    "debugSettings.homeserver": "ܣܝܪܒܪ ܕܒܝܬܐ: {value}",
    "debugSettings.user": "ܡܦܠܚܢܐ: {value}",
    "debugSettings.device": "ܡܐܢܐ: {value}",
    "debugSettings.accessToken": "ܛܒܥܐ ܕܡܥܠܬܐ: {value}",
    "debugSettings.hideMessageText": "ܛܫܝ ܟܬܒܐ ܕܐܓܪܬܐ: {value}",
    "debugSettings.notificationRulesServer": "ܢܡܘܣ̈ܐ ܕܡܘܕܥܢܘ̈ܬܐ (ܣܝܪܒܪ)",
    "debugSettings.syncMode": "ܛܘܦܣܐ ܕܐܚܕܝܘܬܐ",
    "debugSettings.slidingSyncMsc4186": "ܐܚܕܝܘܬܐ ܓܠܝܫܬܐ (MSC4186)",
    "debugSettings.classicSyncV2": "‎/sync ܥܬܝܩܐ (v2)",
    "debugSettings.syncState": "ܐܝܟܢܝܘܬܐ ܕܐܚܕܝܘܬܐ",
    "debugSettings.fallback": "ܓܒܝܬܐ ܕܒܣܬܪ",
    "debugSettings.slidingSyncEndpoint": "ܢܘܩܙܐ ܕܐܚܕܝܘܬܐ ܓܠܝܫܬܐ",
    "debugSettings.joinedRoomsLoaded": "ܓܘܡ̈ܐ ܕܥܠܝܠܐ ܛܥܝܢ̈ܐ",
    "debugSettings.roomListWindow": "ܟܘܬܐ ܕܪܫܝܡܬܐ ܕܓܘܡ̈ܐ",
    "debugSettings.of": "{requested} ܡܢ {total}",
    "debugSettings.platform": "ܐܣܬܐ",
    "debugSettings.nativeCapacitor": "ܡܬܘܡܝܐ (Capacitor)",
    "debugSettings.pushEnabledInBuild": "ܡܘܕܥܢܘ̈ܬܐ ܕܠܝܩ̈ܐ ܓܘ ܒܢܝܢܐ",
    "debugSettings.yes": "ܐܝܢ",
    "debugSettings.no": "ܠܐ",
    "debugSettings.gatewayUrl": "URL ܕܬܪܥܐ",
    "debugSettings.appId2": "ܗܝܝܘܬܐ ܕܬܘܟܢܝܬܐ",
    "debugSettings.notificationPermission": "ܦܣܐ ܕܡܘܕܥܢܘ̈ܬܐ",
    "debugSettings.fcmToken": "ܛܒܥܐ ܕ FCM",
    "debugSettings.pusherRegisteredThisSession": "ܕܚܘܦܐ ܪܫܝܡܐ ܒܗܢܐ ܓܠܣܐ",
    "debugSettings.failedToFetchPushersFromHomeserver":
        "ܡܝܬܝܬܐ ܕܕܚܘܦ̈ܐ ܡܢ ܣܝܪܒܪ ܕܒܝܬܐ ܠܐ ܦܠܚܠܗ̇.",
    "debugSettings.set": "ܡܛܘܝܒܐ",
    "debugSettings.active": "ܦܥܝܠܐ",

    // src/lib/components/ui/EmojiPicker.svelte
    "emojiPicker.searchEmoji": "ܒܨܝ ܐܝܡܘܓܝ…",
    "emojiPicker.searchEmoji2": "ܒܨܝ ܐܝܡܘܓܝ",
    "emojiPicker.myEmojis": "ܐܝܡܘܓܝ ܕܝܝ",
    "emojiPicker.custom": "ܦܪܨܘܦܝܐ",
    "emojiPicker.standard": "ܥܕܝܠܐ",
    "emojiPicker.myEmojis2": "ܐܝܡܘܓܝ ܕܝܝ",

    // src/lib/components/ui/ErrorToasts.svelte
    "errorToasts.dismiss": "ܫܩܘܠ",

    // src/lib/components/settings/ExtendedProfileDebug.svelte
    "extendedProfileDebug.extendedProfile": "ܦܪܨܘܦܐ ܪܘܝܚܐ",
    "extendedProfileDebug.fetchFromServer": "ܡܐܬܝ ܡܢ ܣܝܪܒܪ",
    "extendedProfileDebug.thisServerDoesNotSupportExtended":
        "ܗܢܐ ܣܝܪܒܪ ܠܐ ܡܣܝܥ ܦܪܨܘܦ̈ܐ ܪܘܝܚ̈ܐ.",
    "extendedProfileDebug.noneOrTheServerRefused": "ܠܝܬ، ܝܢ ܣܝܪܒܪ ܠܐ ܩܒܠܠܗ",
    "extendedProfileDebug.presenceGetPresenceStraightFromThe":
        "ܐܝܬܝܘܬܐ (GET /presence، ܫܪܝܪܐܝܬ ܡܢ ܣܝܪܒܪ): {value}",
    "extendedProfileDebug.notAdvertisedNoRestrictions": "ܠܐ ܡܘܕܥܐ (ܠܝܬ ܚܘܕܕ̈ܐ)",
    "extendedProfileDebug.serverRulesForFieldsMProfile":
        "ܢܡܘܣ̈ܐ ܕܣܝܪܒܪ ܩܐ ܚܩܠ̈ܐ (m.profile_fields): {value}",
    "extendedProfileDebug.failedToFetchTheProfile": "ܡܝܬܝܬܐ ܕܦܪܨܘܦܐ ܠܐ ܦܠܚܠܗ̇",
    "extendedProfileDebug.couldNotCopyToClipboard": "ܢܣܚܐ ܠܦܢܩܝܬܐ ܠܐ ܦܠܚܠܗ",

    // src/lib/components/ui/FlashEmbed.svelte
    "flashEmbed.suspend": "ܦܣܘܩ ܙܒܢܢܐܝܬ",

    // src/lib/components/messages/ForwardMessageDialog.svelte
    "forwardMessageDialog.forwardMessage": "ܫܕܪ ܐܓܪܬܐ ܠܩܕܡ",
    "forwardMessageDialog.searchRooms": "ܒܨܝ ܓܘܡ̈ܐ",
    "forwardMessageDialog.noJoinedRoomsFound":
        "ܠܐ ܦܝܫܝ ܡܫܟܚܐ ܓܘܡ̈ܐ ܕܥܠܝܠܘܟ ܓܘܝܗܝ",
    "forwardMessageDialog.forwarding": "ܒܫܕܪܐ ܠܩܕܡ…",
    "forwardMessageDialog.forward": "ܫܕܪ ܠܩܕܡ",
    "forwardMessageDialog.failedToForwardMessage": "ܫܕܪܐ ܕܐܓܪܬܐ ܠܩܕܡ ܠܐ ܦܠܚܠܗ",

    // src/lib/components/settings/GeneralSettings.svelte
    "generalSettings.desktop": "ܡܚܫܒܐ",
    "generalSettings.minimiseToTrayOnClose": "ܙܥܘܪ ܠܣܠܐ ܒܣܟܪܐ",
    "generalSettings.keepZamRunningInTheSystem":
        "ܦܘܫ Zam ܦܠܚܐ ܓܘ ܣܠܐ ܕܣܝܣܛܡ ܐܡܬܝ ܕܣܟܪܬ ܟܘܬܐ، ܒܕܘܟ ܕܡܦܩܬܐ. ܦܠܚ ܒܨܘܪܬܐ ܕܣܠܐ ܩܐ ܦܬܚܐ ܡܢ ܕܪܝܫ ܝܢ ܡܦܩܬܐ.",
    "generalSettings.noGeneralSettingsAreAvailableOn":
        "ܠܝܬ ܛܘܝܒ̈ܐ ܓܢܣܝ̈ܐ ܓܘ ܗܕܐ ܐܣܬܐ.",

    // src/lib/components/ui/GifPicker.svelte
    "gifPicker.searchFavourites": "ܒܨܝ ܚܒܝ̈ܒܐ…",
    "gifPicker.searchKlipy": "ܒܨܝ KLIPY…",
    "gifPicker.searchFavourites2": "ܒܨܝ ܚܒܝ̈ܒܐ",
    "gifPicker.searchGifs": "ܒܨܝ GIF",
    "gifPicker.gifResults": "ܦܠܛ̈ܐ ܕ GIF",
    "gifPicker.noFavouriteGifsYetStarA":
        "ܠܝܬ GIF ܚܒܝ̈ܒܐ ܗܠ ܗܫܐ. ܢܝܫ GIF ܒܟܘܟܒܐ ܩܐ ܢܛܪܐ ܕܝܗ̇ ܗܪܟܐ.",
    "gifPicker.favourites": "ܚܒܝ̈ܒܐ",
    "gifPicker.gifTagged": "GIF ܥܡ ܢܝܫ̈ܢܐ {join}",
    "gifPicker.favouriteGif": "GIF ܚܒܝܒܐ {value}",
    "gifPicker.editTags": "ܬܩܢ ܢܝܫ̈ܢܐ",
    "gifPicker.catFunny": "ܩܛܘܬܐ، ܡܓܚܟܢܐ",
    "gifPicker.commaSeparatedEnterToSave": "ܦܪܝܫ̈ܐ ܒܦܘܣܩܐ · Enter ܩܐ ܢܛܪܐ",
    "gifPicker.trending": "ܡܫܡܥ̈ܐ",
    "gifPicker.gifResult": "ܦܠܛܐ ܕ GIF {value}",
    "gifPicker.favourite": "ܚܒܝܒܐ",
    "gifPicker.poweredByKlipy": "ܒܚܝܠܐ ܕ KLIPY",

    // src/lib/components/layout/ImagePackEditor.svelte
    "imagePackEditor.addImage": "ܐܘܣܦ ܨܘܪܬܐ",
    "imagePackEditor.newPack": "ܟܢܘܫܝܐ ܚܕܬܐ",
    "imagePackEditor.packName": "ܫܡܐ ܕܟܢܘܫܝܐ",
    "imagePackEditor.shortcode": "ܪܡܙܐ ܟܪܝܐ",
    "imagePackEditor.useAsEmoji": "ܦܠܚ ܐܝܟ ܐܝܡܘܓܝ",
    "imagePackEditor.useAsSticker": "ܦܠܚ ܐܝܟ ܢܩܦܬܐ",
    "imagePackEditor.inheritedFrom": "ܝܪܝܬܐ ܡܢ {sourceName}",
    "imagePackEditor.sticker": "ܢܩܦܬܐ",
    "imagePackEditor.removeImage": "ܫܩܘܠ ܨܘܪܬܐ",
    "imagePackEditor.noCustomImages": "ܠܝܬ ܨܘܪ̈ܝܬܐ ܦܪܨܘܦܝ̈ܐ",
    "imagePackEditor.emotes": "ܐܝܡܘܓܝ ܕ{value}",
    "imagePackEditor.room": "ܓܘܡܐ",
    "imagePackEditor.chooseAtLeastOneUsage": "ܓܒܝ ܚܕ ܦܘܠܚܢܐ ܠܦܚܘܬ ܡܢ ܟܠ.",
    "imagePackEditor.enterAPackName": "ܡܥܠ ܫܡܐ ܕܟܢܘܫܝܐ.",
    "imagePackEditor.uploadFailed": "ܐܣܩܬܐ ܠܐ ܦܠܚܠܗ̇",
    "imagePackEditor.failedToUpdateUsage": "ܚܘܕܬܐ ܕܦܘܠܚܢܐ ܠܐ ܦܠܚܠܗ̇",
    "imagePackEditor.failedToRemoveImage": "ܫܩܠܐ ܕܨܘܪܬܐ ܠܐ ܦܠܚܠܗ",

    // src/lib/components/layout/InboxPanel.svelte
    "inboxPanel.inbox": "ܨܢܕܘܩܐ ܕܡܛܝܬܐ",
    "inboxPanel.noPendingInvites": "ܠܝܬ ܙܘܡܢ̈ܐ ܕܡܢܛܪܝܢ",
    "inboxPanel.roomInvitesWillAppearHere": "ܙܘܡܢ̈ܐ ܕܓܘܡ̈ܐ ܒܕ ܚܙܝܐ ܗܘܝ ܗܪܟܐ.",
    "inboxPanel.pendingInvites": "ܙܘܡܢ̈ܐ ܕܡܢܛܪܝܢ: {length}",
    "inboxPanel.invitedBy": "ܙܘܡܢܐ ܡܢ {sender}",
    "inboxPanel.ignore": "ܫܒܘܩ",
    "inboxPanel.accept": "ܩܒܘܠ",
    "inboxPanel.pendingJoinRequests": "ܒܥܝ̈ܬܐ ܕܥܠܠܐ ܕܡܢܛܪܝܢ: {length}",
    "inboxPanel.youAskedToJoinWaitingFor":
        "ܒܥܠܘܟ ܕܥܐܠܬ - ܒܢܛܪܐ ܩܐ ܚܕ ܢܫܐ ܕܡܥܠܠܘܟ.",
    "inboxPanel.cancelRequest": "ܒܛܠ ܒܥܝܬܐ",
    "inboxPanel.failedToAcceptInvite": "ܩܘܒܠܐ ܕܙܘܡܢܐ ܠܐ ܦܠܚܠܗ",
    "inboxPanel.failedToRejectInvite": "ܠܐ ܩܒܠܬܐ ܕܙܘܡܢܐ ܠܐ ܦܠܚܠܗ̇",
    "inboxPanel.failedToCancelJoinRequest": "ܒܘܛܠܐ ܕܒܥܝܬܐ ܕܥܠܠܐ ܠܐ ܦܠܚܠܗ",

    // src/lib/components/layout/IncomingCallCard.svelte
    "incomingCallCard.incomingCall": "ܩܪܝܬܐ ܕܐܬܝܐ",
    "incomingCallCard.declineCallFrom": "ܠܐ ܩܒܠ ܩܪܝܬܐ ܡܢ {name}",
    "incomingCallCard.accept": "ܩܒܘܠ",
    "incomingCallCard.acceptCallFrom": "ܩܒܘܠ ܩܪܝܬܐ ܡܢ {name}",
    "incomingCallCard.unknown": "ܠܐ ܝܕܝܥܐ",

    // src/lib/components/layout/InvitePanel.svelte
    "invitePanel.invitePeopleTo": "ܙܡܢ ܢܫ̈ܐ ܠ",
    "invitePanel.invited": "ܙܡܝܢܐ",
    "invitePanel.failed": "ܠܐ ܦܠܚܠܗ",
    "invitePanel.inviteByEmail": "ܙܡܢ ܒܐܝܡܝܠ",
    "invitePanel.nameExampleCom": "name@example.com",
    "invitePanel.inviting": "ܒܙܡܢܐ…",
    "invitePanel.invite": "ܙܡܢ",
    "invitePanel.invite2": "ܙܡܢ {length}",
    "invitePanel.enterAValidEmailAddress": "ܡܥܠ ܐܝܡܝܠ ܬܪܝܨܐ.",
    "invitePanel.couldNotSendTheEmailInvite": "ܫܕܪܐ ܕܙܘܡܢܐ ܒܐܝܡܝܠ ܠܐ ܦܠܚܠܗ",
    "invitePanel.couldNotSendTheInvite": "ܫܕܪܐ ܕܙܘܡܢܐ ܠܐ ܦܠܚܠܗ",
    "invitePanel.thisRoom": "ܗܢܐ ܓܘܡܐ",
    "invitePanel.thisSpace": "ܗܢܐ ܚܘܕܪܐ",

    // src/lib/components/layout/JoinConsentDialog.svelte
    "joinConsentDialog.joinThisRoom": "ܥܐܠܬ ܠܗܢܐ ܓܘܡܐ؟",
    "joinConsentDialog.youClickedALinkTo": "ܕܥܨܠܘܟ ܥܠ ܐܣܘܪܐ ܠ",
    "joinConsentDialog.joiningSharesYourMatrixIdWith":
        ". ܥܠܠܐ ܡܫܘܬܦ ܗܝܝܘܬܐ ܕ Matrix ܕܝܘܟ ܥܡ ܟܠ ܢܫܐ ܓܘ ܓܘܡܐ ܘܡܘܣܦ ܠܗ̇ ܠܪܫܝܡܬܐ ܕܓܘܡ̈ܐ ܕܝܘܟ.",
    "joinConsentDialog.thisOpensRoom": "ܗܢܐ ܦܬܚ ܓܘܡܐ",
    "joinConsentDialog.warningThisLinkPointsAtA":
        "ܙܘܗܪܐ: ܗܢܐ ܐܣܘܪܐ ܡܚܘܝ ܥܠ ܣܝܪܒܪ ܐܚܪܢܐ ܡܢ ܓܘܡܐ ܕܡܛܐ ܠܗ. ܦܘܫ ܠܩܕܡ ܐܠܐ ܐܢ ܬܟܝܠܬ ܥܠ ܫܕܪܢܐ.",
    "joinConsentDialog.joinRoom": "ܥܘܠ ܠܓܘܡܐ",

    // src/lib/components/ui/Lightbox.svelte
    "lightbox.closeViewer": "ܣܟܘܪ ܚܙܝܢܐ ܕ{mediaNoun}",
    "lightbox.viewer": "ܚܙܝܢܐ ܕ{MediaNoun}{value}",
    "lightbox.download": "ܐܚܬ",
    "lightbox.previous": "ܩܕܡܝܐ",
    "lightbox.previous2": "{mediaNoun} ܩܕܡܝܐ",
    "lightbox.next": "ܒܬܪܝܐ",
    "lightbox.next2": "{mediaNoun} ܒܬܪܝܐ",
    "lightbox.couldNotLoadThisVideoUse":
        'ܛܥܢܐ ܕܗܢܐ ܒܝܕܝܘ ܠܐ ܦܠܚܠܗ. ܦܠܚ ܒ"ܐܚܬ" ܩܐ ܢܛܪܐ ܕܝܗܝ.',
    "lightbox.video": "ܒܝܕܝܘ",
    "lightbox.image": "ܨܘܪܬܐ",
    "lightbox.videoNoun": "ܒܝܕܝܘ",
    "lightbox.imageNoun": "ܨܘܪܬܐ",

    // src/lib/components/messages/LinkPreview.svelte
    "linkPreview.youtubeVideo": "ܒܝܕܝܘ ܕ YouTube",
    "linkPreview.xTwitter": "X / Twitter",
    "linkPreview.loadingItContactsTheSiteHosting":
        "ܛܥܢܐ ܕܝܗܝ ܡܬܚܒܪ ܥܡ ܕܘܟܬܐ ܕܡܐܚܕ ܠܗ، ܘܗܕܐ ܡܓܠܐ ܡܘܢܥܐ ܕ IP ܕܝܘܟ",
    "linkPreview.loadPreviewMedia": "ܛܥܘܢ ܡܝܕܝܐ ܕܚܙܝܬܐ ܩܕܡܝܬܐ",
    "linkPreview.playVideo": "ܦܠܚ ܒܝܕܝܘ",

    // src/lib/components/layout/LiveLocationBanner.svelte
    "liveLocationBanner.openMap": "ܦܬܘܚ ܦܪܣܐ",
    "liveLocationBanner.sharingLiveLocation": "ܒܫܘܬܦܐ ܕܘܟܬܐ ܚܝܬܐ",
    "liveLocationBanner.lastUpdatedAt":
        " · ܚܘܕܬܐ ܐܚܪܝܐ ܒ {timeOnly} ({updatedAgoLabel})",
    "liveLocationBanner.map": "ܦܪܣܐ",
    "liveLocationBanner.isSharingLiveLocation":
        "{getMemberName} ܒܫܘܬܦܐ ܝܠܗ ܕܘܟܬܐ ܚܝܬܐ",
    "liveLocationBanner.peopleSharingLiveLocation":
        "{length} ܢܫ̈ܐ ܒܫܘܬܦܐ ܝܢ ܕܘܟܬܐ ܚܝܬܐ",
    "liveLocationBanner.viewMap": "ܚܙܝ ܦܪܣܐ",

    // src/lib/components/layout/LiveLocationMapView.svelte
    "liveLocationMapView.back": "ܠܒܣܬܪܐ",
    "liveLocationMapView.liveLocation": "ܕܘܟܬܐ ܚܝܬܐ",
    "liveLocationMapView.recenter": "ܡܨܥܐ ܡܢ ܕܪܝܫ",
    "liveLocationMapView.waitingForALocationFix": "ܒܢܛܪܐ ܩܐ ܕܘܟܬܐ ܫܪܝܪܬܐ…",
    "liveLocationMapView.sharingLiveLocation": "ܒܫܘܬܦܐ ܕܘܟܬܐ ܚܝܬܐ",
    "liveLocationMapView.lastUpdatedAt":
        "ܚܘܕܬܐ ܐܚܪܝܐ ܒ {timeOnly} ({updatedAgoLabel})",
    "liveLocationMapView.osm": "OSM",
    "liveLocationMapView.noActiveLiveSharesInThis":
        "ܠܝܬ ܫܘܬܦܘ̈ܬܐ ܚܝ̈ܬܐ ܓܘ ܗܢܐ ܓܘܡܐ.",
    "liveLocationMapView.you": "ܐܢܬ",

    // src/lib/components/messages/LocationBody.svelte
    "locationBody.openstreetmap": "OpenStreetMap",
    "locationBody.googleMaps": "Google Maps",

    // src/lib/components/layout/LoginView.svelte
    "loginView.signIn": "ܥܘܠ",
    "loginView.register": "ܪܫܘܡ",
    "loginView.zam": "Zam - {value}",
    "loginView.addAnAccount": "ܐܘܣܦ ܚܘܫܒܢܐ",
    "loginView.welcomeBack": "ܒܫܝܢܐ ܕܐܬܝܠܘܟ ܡܢ ܕܪܝܫ!",
    "loginView.signInWithAnotherMatrixAccount": "ܥܘܠ ܒܚܘܫܒܢܐ ܐܚܪܢܐ ܕ Matrix",
    "loginView.signInToYourMatrixAccount": "ܥܘܠ ܠܚܘܫܒܢܐ ܕ Matrix ܕܝܘܟ",
    "loginView.createAnAccount": "ܒܪܝ ܚܘܫܒܢܐ",
    "loginView.registerOnAMatrixHomeserver": "ܪܫܘܡ ܥܠ ܣܝܪܒܪ ܕ Matrix",
    "loginView.homeserver": "ܣܝܪܒܪ ܕܒܝܬܐ",
    "loginView.username": "ܫܡܐ ܕܡܦܠܚܢܐ",
    "loginView.password": "ܡܠܬܐ ܕܥܒܪܐ",
    "loginView.registrationToken": "ܛܒܥܐ ܕܪܘܫܡܐ",
    "loginView.ifRequired": "(ܐܢ ܡܚܝܒܐ ܝܠܗ)",
    "loginView.leaveBlankIfNotRequired": "ܫܒܘܩ ܣܦܝܩܐ ܐܢ ܠܐ ܝܠܗ ܡܚܝܒܐ",
    "loginView.useSlidingSync": "ܦܠܚ ܒܐܚܕܝܘܬܐ ܓܠܝܫܬܐ",
    "loginView.fasterStartupOnServersThatSupport":
        "ܫܘܪܝܐ ܦܪܝܚܐ ܥܠ ܣܝܪܒܪ̈ܐ ܕܡܣܝܥܝ ܠܗ̇.",
    "loginView.pleaseWait": "ܒܒܥܘܬܐ ܢܛܘܪ…",
    "loginView.logIn": "ܥܘܠ",
    "loginView.createAccount": "ܒܪܝ ܚܘܫܒܢܐ",
    "loginView.donTHaveAnAccount": "ܠܝܬ ܠܘܟ ܚܘܫܒܢܐ؟",
    "loginView.alreadyHaveAnAccount": "ܐܝܬ ܠܘܟ ܚܘܫܒܢܐ؟",
    "loginView.signIn2": "ܥܘܠ",
    "loginView.backTo": "→ ܠܒܣܬܪܐ ܠ {activeUserId}",
    "loginView.orContinueAs": "ܝܢ ܦܘܫ ܠܩܕܡ ܐܝܟ",
    "loginView.yourCredentialsAreSentDirectlyTo":
        "ܡܠ̈ܐ ܕܥܒܪܐ ܕܝܘܟ ܫܪܝܪܐܝܬ ܡܫܘܕܪ̈ܐ ܝܢ ܠܣܝܪܒܪ ܕܒܝܬܐ ܕܝܘܟ، ܘܗܕܐ ܬܘܟܢܝܬܐ ܠܐ ܢܛܪܐ ܠܗܘܢ ܠܒܪ ܡܢ ܡܐܢܐ ܕܝܘܟ.",
    "loginView.loggingIn": "ܒܥܠܠܐ…",
    "loginView.loginFailedCheckYourCredentials":
        "ܥܠܠܐ ܠܐ ܦܠܚܠܗ. ܒܨܝ ܡܠ̈ܐ ܕܥܒܪܐ ܕܝܘܟ.",
    "loginView.creatingAccount": "ܒܒܪܝܐ ܚܘܫܒܢܐ…",
    "loginView.registrationFailed": "ܪܘܫܡܐ ܠܐ ܦܠܚܠܗ.",
    "loginView.or": "ܝܢ",
    "loginView.continueWithSso": "ܦܘܫ ܠܩܕܡ ܒ SSO",
    "loginView.continueWith": "ܦܘܫ ܠܩܕܡ ܒ {name}",
    "loginView.redirectingToSso": "ܒܫܕܪܐ ܠܡܛܝܒܢܐ ܕܥܠܠܐ…",
    "loginView.finishSsoInBrowser": "ܫܠܡ ܥܠܠܐ ܓܘ ܡܦܬܫܢܐ، ܘܒܬܪ ܗܕܐ ܕܥܘܪ ܠܟܐ.",
    "loginView.ssoCouldNotBeVerified":
        "SSO ܠܐ ܡܨܐ ܗܘܐ ܡܫܪܪܐ. ܒܒܥܘܬܐ ܢܣܝ ܡܢ ܕܪܝܫ.",
    "loginView.ssoFailed": "SSO ܠܐ ܦܠܚܠܗ.",
    "loginView.checkingServer": "ܒܒܨܝܐ ܣܝܪܒܪ…",

    // src/lib/components/layout/MemberList.svelte
    "memberList.members": "ܗܕܡ̈ܐ: {length}",
    "memberList.admins": "ܡܕܒܪ̈ܢܐ: {length}",
    "memberList.admin": "ܡܕܒܪܢܐ",
    "memberList.moderators": "ܡܫܚܠܦ̈ܢܐ: {length}",

    // src/lib/components/messages/MessageActionsSheet.svelte
    "messageActionsSheet.thisMessage": "{label} ܗܕܐ ܐܓܪܬܐ؟",
    "messageActionsSheet.messageActions": "ܣܘܥܪ̈ܢܐ ܕܐܓܪܬܐ",

    // src/lib/components/layout/MessageArea.svelte
    "messageArea.dropToAttach": "ܫܒܘܩ ܩܐ ܐܣܝܪܬܐ",
    "messageArea.unreadNotifications": "ܡܘܕܥܢܘ̈ܬܐ ܕܠܐ ܩܪܝ̈ܐ",
    "messageArea.encryptionEnabled": "ܛܘܫܝܐ ܕܠܝܩܐ ܝܠܗ",
    "messageArea.joiningVoiceCall": "ܒܥܠܠܐ ܠܩܪܝܬܐ ܕܩܠܐ…",
    "messageArea.startVoiceCall": "ܫܪܝ ܩܪܝܬܐ ܕܩܠܐ",
    "messageArea.showCall": "ܚܘܝ ܩܪܝܬܐ",
    "messageArea.searchMessages": "ܒܨܝ ܐܓܪ̈ܬܐ",
    "messageArea.threads": "ܚܘ̈ܛܐ",
    "messageArea.toggleThreadsList": "ܦܬܘܚ/ܣܟܘܪ ܪܫܝܡܬܐ ܕܚܘ̈ܛܐ",
    "messageArea.unreadThreadMentions": "ܕܘܟܪܢ̈ܐ ܕܠܐ ܩܪܝ̈ܐ ܓܘ ܚܘ̈ܛܐ",
    "messageArea.unreadThreads": "ܚܘ̈ܛܐ ܕܠܐ ܩܪܝ̈ܐ",
    "messageArea.pinnedMessages": "ܐܓܪ̈ܬܐ ܩܒܝܥ̈ܬܐ",
    "messageArea.notificationsInbox": "ܨܢܕܘܩܐ ܕܡܘܕܥܢܘ̈ܬܐ",
    "messageArea.mediaAndFiles": "ܡܝܕܝܐ ܘܦܐܝܠ̈ܐ",
    "messageArea.toggleMemberList": "ܦܬܘܚ/ܣܟܘܪ ܪܫܝܡܬܐ ܕܗܕܡ̈ܐ",
    "messageArea.more": "ܝܬܝܪ",
    "messageArea.moreRoomOptions": "ܓܒܝ̈ܬܐ ܝܬܝܪ̈ܐ ܕܓܘܡܐ",
    "messageArea.messageTimeline": "ܣܕܪܐ ܕܐܓܪ̈ܬܐ",
    "messageArea.welcomeTo": "ܒܫܝܢܐ ܠ #",
    "messageArea.thisIsTheBeginningOfThe": "ܗܢܐ ܝܠܗ ܫܘܪܝܐ ܕܓܘܡܐ #",
    "messageArea.room": ".",
    "messageArea.newMessages": "ܐܓܪ̈ܬܐ ܚܕ̈ܬܐ",
    "messageArea.messageFromABlockedUser": "ܐܓܪܬܐ ܡܢ ܡܦܠܚܢܐ ܟܠܝܐ",
    "messageArea.showBlockedMessage": "ܚܘܝ ܐܓܪܬܐ ܟܠܝܬܐ",
    "messageArea.thisRoomHasBeenUpgraded": "ܗܢܐ ܓܘܡܐ ܝܠܗ ܡܥܠܝܐ",
    "messageArea.goToNewRoom": "ܙܠ ܠܓܘܡܐ ܚܕܬܐ",
    "messageArea.joinNewRoom": "ܥܘܠ ܠܓܘܡܐ ܚܕܬܐ",
    "messageArea.jumpToPresent": "ܫܘܪ ܠܗܫܐ",
    "messageArea.searchingForMessage": "ܒܒܨܝܐ ܐܓܪܬܐ…",
    "messageArea.viewingMessageContext": "ܒܚܙܝܐ ܐܓܪ̈ܬܐ ܕܚܕܪܝܗ̇",
    "messageArea.returnToLive": "ܕܥܘܪ ܠܚܝܐ",
    "messageArea.closePanel": "ܣܟܘܪ ܦܢܝܬܐ",
    "messageArea.someone": "ܚܕ ܢܫܐ",
    "messageArea.pinnedMessagesCount": "ܐܓܪ̈ܬܐ ܩܒܝܥ̈ܬܐ ({count})",

    // src/lib/components/messages/MessageInput.svelte
    "messageInput.replyingTo": "ܒܦܢܝܐ ܠ {replyTargetName}",
    "messageInput.cancelReplyEsc": "ܒܛܠ ܦܢܝܬܐ (Esc)",
    "messageInput.editAttachment": "ܬܩܢ ܐܣܝܪܬܐ",
    "messageInput.editAttachment2": "ܬܩܢ ܐܣܝܪܬܐ {name}",
    "messageInput.custom": "ܦܪܨܘܦܝܐ",
    "messageInput.yourNextMessageWillStartA": "ܐܓܪܬܐ ܒܬܪܝܬܐ ܕܝܘܟ ܒܕ ܫܪܝܐ",
    "messageInput.thread": "ܚܘܛܐ",
    "messageInput.cancelThreadCreation": "ܒܛܠ ܒܪܝܐ ܕܚܘܛܐ",
    "messageInput.favouriteGifs": "GIF ܚܒܝ̈ܒܐ",
    "messageInput.sendMessage": "ܫܕܪ ܐܓܪܬܐ",
    "messageInput.isTyping": "{value} ܒܟܬܒܐ ܝܠܗ…",
    "messageInput.andAreTyping": "{value} ܘ{value2} ܒܟܬܒܐ ܝܢ…",
    "messageInput.andAreTyping2": "{value}، {value2} ܘ{value3} ܒܟܬܒܐ ܝܢ…",
    "messageInput.severalPeopleAreTyping": "ܟܡܐ ܢܫ̈ܐ ܒܟܬܒܐ ܝܢ…",
    "messageInput.selectARoomToStartChatting": "ܓܒܝ ܓܘܡܐ ܩܐ ܫܘܪܝܐ ܕܡܡܠܠܐ",
    "messageInput.replyInThread": "ܦܢܝ ܓܘ ܚܘܛܐ...",
    "messageInput.replyTo": "ܦܢܝ ܠ {replyTargetName}...",
    "messageInput.message": "ܐܓܪܬܐ ܠ #{roomName}",
    "messageInput.isNotAValidUser": '"{token}" ܠܐ ܝܠܗ ܡܦܠܚܢܐ ܬܪܝܨܐ',
    "messageInput.noRoomSelected": "ܠܝܬ ܓܘܡܐ ܓܒܝܐ",
    "messageInput.isNotInThisRoom": "{userId} ܠܐ ܝܠܗ ܓܘ ܗܢܐ ܓܘܡܐ",
    "messageInput.youDonTHavePermissionTo":
        "ܠܝܬ ܠܘܟ ܦܣܐ ܠܫܚܠܦܬܐ ܕܕܪ̈ܓܐ ܕܚܝܠܐ ܓܘ ܗܢܐ ܓܘܡܐ",
    "messageInput.unhandledCommand": "ܦܘܩܕܢܐ ܠܐ ܡܕܒܪܐ: /{name}",
    "messageInput.commandFailed": "ܦܘܩܕܢܐ ܠܐ ܦܠܚܠܗ",
    "messageInput.failedToSend": "ܫܕܪܐ ܠܐ ܦܠܚܠܗ",
    "messageInput.unknownCommand": "ܦܘܩܕܢܐ ܠܐ ܝܕܝܥܐ: /{unknown}",
    "messageInput.sendingAttachments":
        "{count, plural, one {ܒܫܕܪܐ # ܐܣܝܪܬܐ…} other {ܒܫܕܪܐ # ܐܣܝܪ̈ܬܐ…}}",

    // src/lib/components/messages/MessageItem.svelte
    "messageItem.viewProfile": "ܚܙܝ ܦܪܨܘܦܐ",
    "messageItem.jumpToTheRepliedToMessage": "ܫܘܪ ܠܐܓܪܬܐ ܕܦܢܝܬܐ ܝܠܗ̇ ܥܠܝܗ̇:",
    "messageItem.originalMessageNotLoaded": "ܐܓܪܬܐ ܫܪܫܝܬܐ ܠܐ ܝܠܗ̇ ܛܥܝܢܬܐ",
    "messageItem.originalMessageDeleted": "ܐܓܪܬܐ ܫܪܫܝܬܐ ܫܝܦܬܐ ܝܠܗ̇",
    "messageItem.originalMessageUnavailable": "ܐܓܪܬܐ ܫܪܫܝܬܐ ܠܐ ܝܠܗ̇ ܡܫܟܚܬܐ",
    "messageItem.edited": "(ܡܬܘܩܢܬܐ)",
    "messageItem.decryptingImage": "ܒܦܬܚܐ ܛܘܫܝܐ ܕܨܘܪܬܐ...",
    "messageItem.couldnTDecryptImage": "ܦܬܚܐ ܕܛܘܫܝܐ ܕܨܘܪܬܐ ܠܐ ܦܠܚܠܗ",
    "messageItem.imageUnavailable": "[ܨܘܪܬܐ ܠܐ ܡܫܟܚܬܐ]",
    "messageItem.decryptingVideo": "ܒܦܬܚܐ ܛܘܫܝܐ ܕܒܝܕܝܘ...",
    "messageItem.couldnTDecryptVideo": "ܦܬܚܐ ܕܛܘܫܝܐ ܕܒܝܕܝܘ ܠܐ ܦܠܚܠܗ",
    "messageItem.video": "ܒܝܕܝܘ",
    "messageItem.canTBePlayedHere": "ܠܐ ܦܝܫ ܦܠܚܐ ܗܪܟܐ",
    "messageItem.playbackFailedClickToRetry":
        "ܦܠܚܬܐ ܠܐ ܦܠܚܠܗ̇ · ܕܥܘܨ ܩܐ ܢܣܝܢܐ ܡܢ ܕܪܝܫ",
    "messageItem.clickToPlay": "{videoDuration} · ܕܥܘܨ ܩܐ ܦܠܚܬܐ",
    "messageItem.clickToPlay2": "ܕܥܘܨ ܩܐ ܦܠܚܬܐ",
    "messageItem.audio": "ܩܠܐ",
    "messageItem.kb": "{toFixed} KB",
    "messageItem.mb": "{toFixed} MB",
    "messageItem.fileAttachment": "ܐܣܝܪܬܐ ܕܦܐܝܠ",
    "messageItem.download": "ܐܚܬ",
    "messageItem.toSave": "ܩܐ ܢܛܪܐ ·",
    "messageItem.toCancel": "ܩܐ ܒܘܛܠܐ",
    "messageItem.openThread": "ܦܬܘܚ ܚܘܛܐ",
    "messageItem.failedToSend": "ܫܕܪܐ ܠܐ ܦܠܚܠܗ.",
    "messageItem.retrying": "ܒܢܣܝܐ ܡܢ ܕܪܝܫ…",
    "messageItem.showWhoReadThisMessage": "ܚܘܝ ܡܢܝܠܗ ܩܪܐ ܗܕܐ ܐܓܪܬܐ",
    "messageItem.readThis":
        "{count, plural, one {# ܢܫܐ ܩܪܐ ܠܗ̇} other {# ܢܫ̈ܐ ܩܪܘ ܠܗ̇}}",
    "messageItem.readBy": "ܩܪܝܬܐ ܡܢ",
    "messageItem.messageActions": "ܣܘܥܪ̈ܢܐ ܕܐܓܪܬܐ",
    "messageItem.editMessage": "ܬܩܢ ܐܓܪܬܐ",
    "messageItem.delete": "ܫܘܦ؟",
    "messageItem.yesDeleteMessage": "ܐܝܢ، ܫܘܦ ܐܓܪܬܐ",
    "messageItem.yes": "ܐܝܢ",
    "messageItem.noKeepMessage": "ܠܐ، ܢܛܘܪ ܐܓܪܬܐ",
    "messageItem.no": "ܠܐ",
    "messageItem.deleteMessage": "ܫܘܦ ܐܓܪܬܐ",
    "messageItem.unpinMessage": "ܫܪܝ ܩܒܥܐ ܕܐܓܪܬܐ",
    "messageItem.pinMessage": "ܩܒܘܥ ܐܓܪܬܐ",
    "messageItem.addReaction": "ܐܘܣܦ ܬܓܘܒܬܐ",
    "messageItem.reply": "ܦܢܝ",
    "messageItem.replyInThread": "ܦܢܝ ܓܘ ܚܘܛܐ",
    "messageItem.forwardMessage": "ܫܕܪ ܐܓܪܬܐ ܠܩܕܡ",
    "messageItem.moreActions": "ܣܘܥܪ̈ܢܐ ܝܬܝܪ̈ܐ",
    "messageItem.linkCopied": "ܐܣܘܪܐ ܢܣܝܚܐ ܝܠܗ!",
    "messageItem.copyMessageLink": "ܢܣܘܚ ܐܣܘܪܐ ܕܐܓܪܬܐ",
    "messageItem.linkCopied2": "ܐܣܘܪܐ ܢܣܝܚܐ ܝܠܗ",
    "messageItem.couldnTDeleteTheMessage": "ܫܝܦܬܐ ܕܐܓܪܬܐ ܠܐ ܦܠܚܠܗ̇",
    "messageItem.couldnTCopyTheMessageLink": "ܢܣܚܐ ܕܐܣܘܪܐ ܕܐܓܪܬܐ ܠܐ ܦܠܚܠܗ",
    "messageItem.failedToUnpinMessage": "ܫܪܝܐ ܕܩܒܥܐ ܕܐܓܪܬܐ ܠܐ ܦܠܚܠܗ",
    "messageItem.failedToPinMessage": "ܩܒܥܐ ܕܐܓܪܬܐ ܠܐ ܦܠܚܠܗ",
    "messageItem.couldNotOpenTheMatrixLink": "ܦܬܚܐ ܕܐܣܘܪܐ ܕ Matrix ܠܐ ܦܠܚܠܗ",

    // src/lib/components/messages/MessageRedactAction.svelte
    "messageRedactAction.removeMessage": "ܫܩܘܠ ܐܓܪܬܐ",
    "messageRedactAction.removeThisMessage": "ܫܩܘܠ ܗܕܐ ܐܓܪܬܐ؟",
    "messageRedactAction.removing": "ܒܫܩܠܐ…",
    "messageRedactAction.failedToRemoveMessage": "ܫܩܠܐ ܕܐܓܪܬܐ ܠܐ ܦܠܚܠܗ",

    // src/lib/components/messages/MessageReportAction.svelte
    "messageReportAction.reportMessage": "ܡܘܕܥ ܥܠ ܐܓܪܬܐ",
    "messageReportAction.reportSent": "ܡܘܕܥܢܘܬܐ ܫܕܝܪܬܐ ܝܠܗ̇",
    "messageReportAction.whyAreYouReportingThisMessage":
        "ܩܐ ܡܘܢܐ ܒܡܘܕܥܐ ܝܘܬ ܥܠ ܗܕܐ ܐܓܪܬܐ؟",
    "messageReportAction.markAsExtremelyOffensive": "ܢܝܫ ܐܝܟ ܨܥܪܢܝܬܐ ܣܓܝ",
    "messageReportAction.reporting": "ܒܡܘܕܥܐ…",
    "messageReportAction.report": "ܡܘܕܥ",

    // src/lib/components/layout/MessageSearchPanel.svelte
    "messageSearchPanel.searchMessages": "ܒܨܝ ܐܓܪ̈ܬܐ",
    "messageSearchPanel.searchTryFromOrHasImage":
        "ܒܨܝ - ܢܣܝ from: ܝܢ has:image",
    "messageSearchPanel.searchForMessagesInThisRoom": "ܒܨܝ ܐܓܪ̈ܬܐ ܓܘ ܗܢܐ ܓܘܡܐ.",
    "messageSearchPanel.noMatchesInTheResultsLoaded":
        "ܠܝܬ ܡܙܕܘܓܘ̈ܬܐ ܓܘ ܦܠܛ̈ܐ ܕܛܥܝܢ̈ܐ ܗܠ ܗܫܐ.",
    "messageSearchPanel.noResultsFor": 'ܠܝܬ ܦܠܛ̈ܐ ܩܐ "{searched}".',
    "messageSearchPanel.searchFailed": "ܒܘܨܝܐ ܠܐ ܦܠܚܠܗ",
    "messageSearchPanel.resultCount":
        "{count, plural, one {# ܦܠܛܐ} other {# ܦܠܛ̈ܐ}}",

    // src/lib/components/settings/MessagesMediaSettings.svelte
    "messagesMediaSettings.messages": "ܐܓܪ̈ܬܐ",
    "messagesMediaSettings.showMatrixIds": "ܚܘܝ ܗܝܝܘ̈ܬܐ ܕ Matrix",
    "messagesMediaSettings.showFullMatrixIdsLikeUser":
        "ܚܘܝ ܗܝܝܘ̈ܬܐ ܫܠܡ̈ܬܐ ܕ Matrix ܐܝܟ ‎@user:server ܒܕܘܟ ܫܡ̈ܗܐ ܕܚܙܝܐ ܒܟܠܗ̇ ܬܘܟܢܝܬܐ.",
    "messagesMediaSettings.readReceiptAvatars": "ܨܘܪ̈ܝܬܐ ܕܩܘܒܠ̈ܐ ܕܩܪܝܬܐ",
    "messagesMediaSettings.showWhoHasReadEachMessage":
        "ܚܘܝ ܡܢܝܠܗ ܩܪܐ ܟܠ ܐܓܪܬܐ ܒܨܘܪ̈ܝܬܐ ܙܥܘܪ̈ܝܬܐ ܬܚܘܬܗ̇. ܗܕܐ ܫܚܠܦܐ ܒܣ ܡܐ ܕܚܙܝܐ ܝܘܬ ܥܠ ܗܢܐ ܡܐܢܐ - ܩܐ ܕܠܐ ܚܙܝ ܐܚܪ̈ܢܐ ܗܕܟܡܐ ܩܪܝܠܘܟ، ܦܠܚ ܒܩܘܒܠ̈ܐ ܕܩܪܝܬܐ ܟܣܝ̈ܐ ܓܘ ܦܪܝܫܘܬܐ ܘܫܠܡܘܬܐ.",
    "messagesMediaSettings.holdToOpenMessageMenu": "ܐܚܘܕ ܩܐ ܦܬܚܐ ܪܫܝܡܬܐ ܕܐܓܪܬܐ",
    "messagesMediaSettings.onTouchDevicesOpenAMessage":
        "ܥܠ ܡܐܢ̈ܐ ܕܡܩܪܒܘܬܐ، ܦܬܘܚ ܣܘܥܪ̈ܢܐ ܕܐܓܪܬܐ ܒܐܚܕܐ ܕܝܗ̇ ܒܕܘܟ ܕܕܥܨܐ. ܐܢ ܛܦܝܐ ܝܠܗ، ܕܥܨܐ ܦܬܚܐ ܠܪܫܝܡܬܐ.",
    "messagesMediaSettings.linkPreviews": "ܚܙܝ̈ܬܐ ܩܕܡܝ̈ܬܐ ܕܐܣܘܪ̈ܐ",
    "messagesMediaSettings.whenOffNoLinkPreviewIs":
        "ܐܢ ܛܦܝܐ ܝܠܗ، ܠܝܬ ܚܙܝܬܐ ܩܕܡܝܬܐ ܕܛܥܢܐ ܘܣܝܪܒܪ ܕܒܝܬܐ ܕܝܘܟ ܠܐ ܡܐܬܐ ܠܦܐܬܐ ܕܐܣܘܪܐ ܒܕܘܟܬܘܟ. ܡܢ ܐܝܟܐ ܛܥܢܐ ܡܝܕܝܐ ܕܚܙܝܬܐ ܩܕܡܝܬܐ ܓܘ ܦܪܝܫܘܬܐ ܘܫܠܡܘܬܐ.",
    "messagesMediaSettings.pauseVideosOffScreen": "ܦܣܘܩ ܒܝܕܝܘ̈ܐ ܠܒܪ ܡܢ ܡܚܙܝܬܐ",
    "messagesMediaSettings.pauseAPlayingVideoWhenIt":
        "ܦܣܘܩ ܒܝܕܝܘ ܕܦܠܚܐ ܐܡܬܝ ܕܢܦܠ ܠܒܪ ܡܢ ܚܙܝܬܐ ܩܐ ܢܛܪܐ ܕܒܛܪܝܐ. ܐܢܬ ܫܪܐ ܝܘܬ ܠܗ ܡܢ ܕܪܝܫ ܐܡܬܝ ܕܕܥܪܬ.",
    "messagesMediaSettings.defaultTab": "ܠܘܚܐ ܥܕܝܠܐ",
    "messagesMediaSettings.whichTabTheGifPickerOpens":
        "ܐܝܢܐ ܠܘܚܐ ܦܬܚ ܓܒܝܬܐ ܕ GIF.",
    "messagesMediaSettings.defaultGifTab": "ܠܘܚܐ ܥܕܝܠܐ ܕ GIF",
    "messagesMediaSettings.favourites": "ܚܒܝ̈ܒܐ",

    // src/lib/components/ui/ModalDialog.fixture.svelte
    "modalDialog.fixture.fixtureDialog": "ܟܘܬܐ ܕܢܣܝܢܐ",

    // src/lib/components/settings/NotificationSettings.svelte
    "notificationSettings.thisDevice": "ܗܢܐ ܡܐܢܐ",
    "notificationSettings.systemPermission": "ܦܣܐ ܕܣܝܣܛܡ",
    "notificationSettings.pushNotifications": "ܡܘܕܥܢܘ̈ܬܐ ܕܕܚܘܦܐ",
    "notificationSettings.permissionIsBlockedInSystemSettings":
        "ܦܣܐ ܟܠܝܐ ܝܠܗ ܓܘ ܛܘܝܒ̈ܐ ܕܣܝܣܛܡ",
    "notificationSettings.notificationsAreNotSupportedHere":
        "ܡܘܕܥܢܘ̈ܬܐ ܠܐ ܝܢ ܡܣܘܥܝ̈ܐ ܗܪܟܐ",
    "notificationSettings.allowThisAppToSendNotifications":
        "ܗܒ ܦܣܐ ܠܗܕܐ ܬܘܟܢܝܬܐ ܕܫܕܪܐ ܡܘܕܥܢܘ̈ܬܐ",
    "notificationSettings.requesting": "ܒܒܥܝܐ…",
    "notificationSettings.blocked": "ܟܠܝܐ",
    "notificationSettings.unavailable": "ܠܐ ܡܫܟܚܐ",
    "notificationSettings.enable": "ܕܠܩ",
    "notificationSettings.sound": "ܩܠܐ",
    "notificationSettings.notificationSound": "ܩܠܐ ܕܡܘܕܥܢܘܬܐ",
    "notificationSettings.playASoundForLoudNotifications":
        "ܦܠܚ ܩܠܐ ܩܐ ܡܘܕܥܢܘ̈ܬܐ ܕܩܠܐ",
    "notificationSettings.desktopAlerts": "ܙܘܗܪ̈ܐ ܕܡܚܫܒܐ",
    "notificationSettings.popUpAndTaskbarFlash": "ܟܘܬܐ ܕܫܘܪ ܘܒܪܩܐ ܕܣܪܓܐ ܕܥܒܕ̈ܐ",
    "notificationSettings.whichNotificationsShowASystemPop":
        "ܐܝܢܝ ܡܘܕܥܢܘ̈ܬܐ ܡܚܘܝܢ ܟܘܬܐ ܕܣܝܣܛܡ ܘ، ܓܘ ܬܘܟܢܝܬܐ ܕܡܚܫܒܐ، ܡܒܪܩܝ ܨܘܪܬܐ ܕܣܪܓܐ ܕܥܒܕ̈ܐ ܐܡܬܝ ܕܟܘܬܐ ܝܠܗ̇ ܒܒܣܬܪ.",
    "notificationSettings.multipleDevices": "ܡܐܢ̈ܐ ܣܓܝ̈ܐܐ",
    "notificationSettings.quietOnMyOtherDevices": "ܫܬܝܩܐ ܥܠ ܡܐܢ̈ܐ ܐܚܪ̈ܢܐ ܕܝܝ",
    "notificationSettings.whileYouReActivelyUsingOne":
        "ܐܡܬܝ ܕܒܦܠܚܐ ܝܘܬ ܒܚܕ ܡܐܢܐ، ܐܚܪ̈ܢܐ ܫܒܩܝ ܩܠܐ ܘܟܘܬܐ ܕܡܘܕܥܢܘܬܐ ܗܕܝܡܐ ܕܗܘ ܡܐܢܐ ܗܘܐ ܒܛܝܠܐ ܗܕܟܡܐ ܙܒܢܐ. ܦܠܚܐ ܥܠ ܟܠ ܡܐܢܐ ܕܚܘܫܒܢܐ ܕܝܘܟ؛ ܡܘܕܥܢܘ̈ܬܐ ܗܠ ܗܫܐ ܚܙܝܐ ܝܢ ܓܘ ܨܢܕܘܩܐ ܕܝܘܟ ܘܡܢܝܢ̈ܐ ܕܠܐ ܩܪܝ̈ܐ ܠܐ ܫܚܠܦܝ.",
    "notificationSettings.custom": "ܦܪܨܘܦܝܐ…",
    "notificationSettings.customQuietDurationInMinutes":
        "ܡܢܝܢܐ ܦܪܨܘܦܝܐ ܕܫܬܩܐ، ܒܕܩܝ̈ܩܐ",
    "notificationSettings.minutesMax":
        "ܕܩܝ̈ܩܐ (ܝܬܝܪ ܡܢ ܟܠ {MAX_CUSTOM_GRACE_MINUTES})",
    "notificationSettings.couldnTSaveToYourAccount":
        "ܢܛܪܐ ܓܘ ܚܘܫܒܢܐ ܕܝܘܟ ܠܐ ܦܠܚܠܗ - ܡܐܢ̈ܐ ܐܚܪ̈ܢܐ ܕܝܘܟ ܡܨܝܐ ܕܢܛܪܝ ܛܘܝܒܐ ܥܬܝܩܐ. ܒܨܝ ܐܚܝܕܘܬܐ ܕܝܘܟ ܘܢܣܝ ܡܢ ܕܪܝܫ.",
    "notificationSettings.retrySavingTheOtherDeviceQuiet":
        "ܢܣܝ ܡܢ ܕܪܝܫ ܢܛܪܐ ܕܛܘܝܒܐ ܕܫܬܩܐ ܕܡܐܢ̈ܐ ܐܚܪ̈ܢܐ",
    "notificationSettings.retrying": "ܒܢܣܝܐ ܡܢ ܕܪܝܫ…",
    "notificationSettings.rules": "ܢܡܘܣ̈ܐ",
    "notificationSettings.notificationRules": "ܢܡܘܣ̈ܐ ܕܡܘܕܥܢܘ̈ܬܐ",
    "notificationSettings.loudNotifyWithSoundSilentNotify":
        "ܥܡ ܩܠܐ = ܡܘܕܥ ܥܡ ܩܠܐ · ܫܬܝܩܐ = ܡܘܕܥ ܕܠܐ ܩܠܐ · ܛܦܝܐ = ܠܝܬ ܡܘܕܥܢܘܬܐ",
    "notificationSettings.keywordHighlights": "ܢܘܗܪ̈ܐ ܕܡܠ̈ܐ ܪܫܝ̈ܬܐ",
    "notificationSettings.getNotifiedWhenAMessageContains":
        "ܦܘܫ ܡܘܕܥܐ ܐܡܬܝ ܕܐܓܪܬܐ ܐܝܬ ܓܘܗ̇ ܡܠܬܐ ܝܢ ܦܬܓܡܐ. ܙܘܘܓܐ ܠܐ ܦܪܫ ܒܝܢ ܐܬ̈ܘܬܐ ܪܒ̈ܬܐ ܘܙܥܘܪ̈ܬܐ؛",
    "notificationSettings.and": "ܘ",
    "notificationSettings.areWildcards": "ܐܬ̈ܘܬܐ ܕܟܠ ܡܕܡ ܝܢ.",
    "notificationSettings.addAKeyword": "ܐܘܣܦ ܡܠܬܐ ܪܫܝܬܐ…",
    "notificationSettings.newKeyword": "ܡܠܬܐ ܪܫܝܬܐ ܚܕܬܐ",
    "notificationSettings.noKeywordRulesYet": "ܠܝܬ ܢܡܘܣ̈ܐ ܕܡܠ̈ܐ ܪܫܝ̈ܬܐ ܗܠ ܗܫܐ.",
    "notificationSettings.behaviorFor": "ܕܘܒܪܐ ܩܐ {pattern}",
    "notificationSettings.enable2": "ܕܠܩ {pattern}",
    "notificationSettings.loudOnly": "ܒܣ ܥܡ ܩܠܐ",
    "notificationSettings.onlyNotificationsThatMakeASound":
        "ܒܣ ܡܘܕܥܢܘ̈ܬܐ ܕܥܒܕܝ ܩܠܐ",
    "notificationSettings.silentAndLoud": "ܫܬܝܩܐ ܘܥܡ ܩܠܐ",
    "notificationSettings.everyNotificationLoudOrSilent":
        "ܟܠ ܡܘܕܥܢܘܬܐ، ܥܡ ܩܠܐ ܝܢ ܫܬܝܩܬܐ",
    "notificationSettings.none": "ܠܝܬ",
    "notificationSettings.neverAlertOnThisDevice": "ܠܐ ܙܗܪ ܡܕܡ ܥܠ ܗܢܐ ܡܐܢܐ",
    "notificationSettings.couldNotSaveNotificationSetting":
        "ܢܛܪܐ ܕܛܘܝܒܐ ܕܡܘܕܥܢܘܬܐ ܠܐ ܦܠܚܠܗ",
    "notificationSettings.highlightSound": "ܢܘܗܪܐ + ܩܠܐ",
    "notificationSettings.notifyWithAHighlightAndSound": "ܡܘܕܥ ܥܡ ܢܘܗܪܐ ܘܩܠܐ",
    "notificationSettings.highlight": "ܢܘܗܪܐ",
    "notificationSettings.notifyWithAHighlight": "ܡܘܕܥ ܥܡ ܢܘܗܪܐ",
    "notificationSettings.notify": "ܡܘܕܥ",
    "notificationSettings.notifyWithoutAHighlight": "ܡܘܕܥ ܕܠܐ ܢܘܗܪܐ",
    "notificationSettings.failedToAddKeyword": "ܐܘܣܦܬܐ ܕܡܠܬܐ ܪܫܝܬܐ ܠܐ ܦܠܚܠܗ̇",
    "notificationSettings.failedToUpdateKeyword": "ܚܘܕܬܐ ܕܡܠܬܐ ܪܫܝܬܐ ܠܐ ܦܠܚܠܗ̇",
    "notificationSettings.failedToDeleteKeyword": "ܫܝܦܬܐ ܕܡܠܬܐ ܪܫܝܬܐ ܠܐ ܦܠܚܠܗ̇",

    // src/lib/components/layout/NotificationsPanel.svelte
    "notificationsPanel.clearAll": "ܫܘܦ ܟܠ",
    "notificationsPanel.couldNotRefreshServerNotificationsTap":
        "ܚܘܕܬܐ ܕܡܘܕܥܢܘ̈ܬܐ ܕܣܝܪܒܪ ܠܐ ܦܠܚܠܗ̇. ܕܥܘܨ ܩܐ ܢܣܝܢܐ ܡܢ ܕܪܝܫ.",
    "notificationsPanel.noNotifications": "ܠܝܬ ܡܘܕܥܢܘ̈ܬܐ.",
    "notificationsPanel.jumpToMessage": "ܫܘܪ ܠܐܓܪܬܐ:",
    "notificationsPanel.in": "ܓܘ #{roomName}",
    "notificationsPanel.message": "(ܐܓܪܬܐ)",

    // src/lib/components/messages/OutboxStrip.svelte
    "outboxStrip.queued": "ܓܘ ܣܪܓܐ",
    "outboxStrip.sending": "ܒܫܕܪܐ…",
    "outboxStrip.failed": "ܠܐ ܦܠܚܠܗ",

    // src/lib/components/layout/OwnStatusEditor.svelte
    "ownStatusEditor.pickAStatusEmoji": "ܓܒܝ ܐܝܡܘܓܝ ܕܐܝܟܢܝܘܬܐ",
    "ownStatusEditor.whatSHappening": "ܡܘܕܝ ܒܗܘܝܐ ܝܠܗ؟",
    "ownStatusEditor.statusText": "ܟܬܒܐ ܕܐܝܟܢܝܘܬܐ",
    "ownStatusEditor.clearStatus": "ܫܘܦ ܐܝܟܢܝܘܬܐ",
    "ownStatusEditor.couldNotSaveStatus": "ܢܛܪܐ ܕܐܝܟܢܝܘܬܐ ܠܐ ܦܠܚܠܗ",

    // src/lib/components/layout/PinnedMessagesPanel.svelte
    "pinnedMessagesPanel.pinnedMessages": "ܐܓܪ̈ܬܐ ܩܒܝܥ̈ܬܐ",
    "pinnedMessagesPanel.noPinnedMessages": "ܠܝܬ ܐܓܪ̈ܬܐ ܩܒܝܥ̈ܬܐ.",
    "pinnedMessagesPanel.jump": "ܫܘܪ",
    "pinnedMessagesPanel.unpin": "ܫܪܝ ܩܒܥܐ",

    // src/lib/components/plugins/PluginPopoverHost.svelte
    "pluginPopoverHost.plugin": "ܬܘܣܦܬܐ",

    // src/lib/components/settings/PluginSettingsForm.svelte
    "pluginSettingsForm.backToPlugins": "ܠܒܣܬܪܐ ܠܬܘܣܦ̈ܬܐ",
    "pluginSettingsForm.settings": "ܛܘܝܒ̈ܐ ܕ{pluginName}",
    "pluginSettingsForm.thisPluginHasNoSettings": "ܠܝܬ ܛܘܝܒ̈ܐ ܠܗܕܐ ܬܘܣܦܬܐ.",
    "pluginSettingsForm.moveUp": "ܫܢܝ ܠܥܠ",
    "pluginSettingsForm.moveDown": "ܫܢܝ ܠܬܚܬ",
    "pluginSettingsForm.removeRow": "ܫܩܘܠ ܣܪܓܐ",

    // src/lib/components/settings/PluginsSettings.svelte
    "pluginsSettings.back": "→ ܠܒܣܬܪܐ",
    "pluginsSettings.syncYourEnabledPluginsSettingsTo":
        "ܐܚܕ ܬܘܣܦ̈ܬܐ ܕܠܝܩ̈ܬܐ ܘܛܘܝܒ̈ܐ ܕܝܘܟ ܥܡ ܚܘܫܒܢܐ ܕ Matrix ܕܝܘܟ (ܐܢ ܠܐ، ܩܐ ܟܠ ܡܐܢܐ ܦܪܝܫܐܝܬ). ܡܐܬܝܬܐ ܡܚܘܝܐ ܡܐ ܕܒܕ ܫܚܠܦ ܩܕܡ ܕܦܠܚ ܡܕܡ.",
    "pluginsSettings.pushToAccount": "ܕܚܘܦ ܠܚܘܫܒܢܐ",
    "pluginsSettings.pullFromAccount": "ܡܐܬܝ ܡܢ ܚܘܫܒܢܐ",
    "pluginsSettings.thisPullWill": "ܗܕܐ ܡܐܬܝܬܐ ܒܕ:",
    "pluginsSettings.addRepos": "ܐܘܣܦ ܓܙ̈ܐ: {join}",
    "pluginsSettings.enable": "ܕܠܩ: {join}",
    "pluginsSettings.disable": "ܛܦܝ: {join}",
    "pluginsSettings.updateSettingsFor": "ܚܕܬ ܛܘܝܒ̈ܐ ܩܐ: {join}",
    "pluginsSettings.setAutoUpdate": "ܛܝܒ ܚܘܕܬܐ ܐܘܛܘܡܛܝܩܝܐ: {value}",
    "pluginsSettings.setPerPluginAutoUpdate":
        "ܛܝܒ ܚܘܕܬܐ ܐܘܛܘܡܛܝܩܝܐ ܩܐ ܟܠ ܬܘܣܦܬܐ: {join}",
    "pluginsSettings.notInstalledOnThisDeviceInstall":
        "ܠܐ ܢܨܝܒܐ ܥܠ ܗܢܐ ܡܐܢܐ (ܢܨܘܒ ܡܢ ܒܨܝܐ، ܘܒܬܪ ܡܐܬܝ ܡܢ ܕܪܝܫ): {join}",
    "pluginsSettings.nothingToChangeAlreadyInSync":
        "ܠܝܬ ܡܕܡ ܩܐ ܫܘܚܠܦܐ؛ ܟܠ ܡܕܡ ܐܚܝܕܐ ܝܠܗ.",
    "pluginsSettings.apply": "ܦܠܚ",
    "pluginsSettings.installed": "ܢܨܝܒ̈ܐ",
    "pluginsSettings.noPluginsInstalled": "ܠܝܬ ܬܘܣܦ̈ܬܐ ܢܨܝܒ̈ܬܐ.",
    "pluginsSettings.needsUpdate": "ܣܢܝܩܐ ܝܠܗ̇ ܠܚܘܕܬܐ",
    "pluginsSettings.updateToV": "ܚܕܬ ܠ v{value}",
    "pluginsSettings.updating": "ܒܚܘܕܬܐ...",
    "pluginsSettings.update": "ܚܕܬ",
    "pluginsSettings.pluginSettings": "ܛܘܝܒ̈ܐ ܕܬܘܣܦܬܐ",
    "pluginsSettings.enable2": "ܕܠܩ {name}",
    "pluginsSettings.working": "ܒܦܠܚܐ...",
    "pluginsSettings.autoUpdateThisPlugin": "ܚܕܬ ܗܕܐ ܬܘܣܦܬܐ ܐܘܛܘܡܛܝܩܐܝܬ",
    "pluginsSettings.autoDefault": "ܐܘܛܘܡܛܝܩܝܐ: ܥܕܝܠܐ",
    "pluginsSettings.autoOn": "ܐܘܛܘܡܛܝܩܝܐ: ܕܠܝܩܐ",
    "pluginsSettings.autoOff": "ܐܘܛܘܡܛܝܩܝܐ: ܛܦܝܐ",
    "pluginsSettings.confirmRemove": "ܫܪܪ ܫܩܠܐ ܕ{name}",
    "pluginsSettings.removePlugin": "ܫܩܘܠ ܬܘܣܦܬܐ",
    "pluginsSettings.remove": "ܫܩܘܠ {name}",
    "pluginsSettings.browse": "ܒܨܝ",
    "pluginsSettings.loading": "ܒܛܥܢܐ...",
    "pluginsSettings.noPluginsInThisRepoYet": "ܠܝܬ ܬܘܣܦ̈ܬܐ ܓܘ ܗܢܐ ܓܙܐ ܗܠ ܗܫܐ.",
    "pluginsSettings.install": "ܢܨܘܒ",
    "pluginsSettings.repos": "ܓܙ̈ܐ",
    "pluginsSettings.official": "ܪܫܡܝܐ",
    "pluginsSettings.removeRepo": "ܫܩܘܠ ܓܙܐ",
    "pluginsSettings.addARepo": "ܐܘܣܦ ܓܙܐ",
    "pluginsSettings.thirdPartyReposRunFullTrust":
        "ܓܙ̈ܐ ܕܓܢܒ̈ܐ ܐܚܪ̈ܢܐ ܦܠܚܝ ܪܡܙ̈ܐ ܥܡ ܬܘܟܠܢܐ ܫܠܡܐ ܘܡܥܠܬܐ ܫܠܡܬܐ ܠܚܘܫܒܢܐ ܘܐܓܪ̈ܬܐ ܕܝܘܟ. ܐܘܣܦ ܒܣ ܓܙ̈ܐ ܕܬܟܝܠܬ ܥܠܝܗܘܢ.",
    "pluginsSettings.ownerRepoOrGithubUrl": "owner/repo ܝܢ URL ܕ GitHub",
    "pluginsSettings.addRepo": "ܐܘܣܦ ܓܙܐ",
    "pluginsSettings.syncPlugins": "ܐܚܕ ܬܘܣܦ̈ܬܐ",
    "pluginsSettings.disableAllPlugins": "ܛܦܝ ܟܠ ܬܘܣܦ̈ܬܐ",
    "pluginsSettings.autoUpdatePlugins": "ܚܘܕܬܐ ܐܘܛܘܡܛܝܩܝܐ ܕܬܘܣܦ̈ܬܐ",
    "pluginsSettings.automaticallyPullNewerVersionsOfRepo":
        "ܡܐܬܝ ܐܘܛܘܡܛܝܩܐܝܬ ܢܘܣܚ̈ܐ ܚܕ̈ܬܐ ܕܬܘܣܦ̈ܬܐ ܕܓܙ̈ܐ.",
    "pluginsSettings.pushedYourPluginSetToYour":
        "ܟܢܘܫܝܐ ܕܬܘܣܦ̈ܬܐ ܕܝܘܟ ܕܚܝܦܐ ܝܠܗ ܠܚܘܫܒܢܐ ܕܝܘܟ.",
    "pluginsSettings.pushFailed": "ܕܚܦܐ ܠܐ ܦܠܚܠܗ.",
    "pluginsSettings.pullFailed": "ܡܐܬܝܬܐ ܠܐ ܦܠܚܠܗ̇.",
    "pluginsSettings.appliedTheSyncedPluginSet":
        "ܟܢܘܫܝܐ ܐܚܝܕܐ ܕܬܘܣܦ̈ܬܐ ܦܠܝܚܐ ܝܠܗ.",
    "pluginsSettings.updateFailed": "ܚܘܕܬܐ ܠܐ ܦܠܚܠܗ̇.",
    "pluginsSettings.couldnTRemovePlugin": "ܫܩܠܐ ܕܬܘܣܦܬܐ ܠܐ ܦܠܚܠܗ: {message}",
    "pluginsSettings.couldnTRemovePlugin2": "ܫܩܠܐ ܕܬܘܣܦܬܐ ܠܐ ܦܠܚܠܗ.",
    "pluginsSettings.cannotAddThisRepo": "ܠܐ ܦܝܫ ܐܘܣܦܐ ܗܢܐ ܓܙܐ.",
    "pluginsSettings.noIndexJson": "ܠܝܬ index.json ({status})",
    "pluginsSettings.installFailed": "ܢܨܒܬܐ ܠܐ ܦܠܚܠܗ̇.",

    // src/lib/components/messages/PollBody.svelte
    "pollBody.finalResults": "ܦܠܛ̈ܐ ܐܚܪܝ̈ܐ",
    "pollBody.livePoll": "ܫܘܐܠܬܐ ܚܝܬܐ",
    "pollBody.resultsAreRevealedWhenThePoll":
        "ܦܠܛ̈ܐ ܒܕ ܓܠܝܐ ܗܘܝ ܐܡܬܝ ܕܫܘܐܠܬܐ ܡܛܝܐ ܠܫܘܠܡܐ",
    "pollBody.chooseUpTo": "· ܓܒܝ ܗܕܝܡܐ {maxSelections}",
    "pollBody.selected": "✓ ܓܒܝܐ",
    "pollBody.submitting": "ܒܫܕܪܐ…",
    "pollBody.submitVote": "ܫܕܪ ܩܠܐ",
    "pollBody.votesAreHidden": "ܩܠ̈ܐ ܛܫܝ̈ܐ ܝܢ",
    "pollBody.savingVote": "· ܒܢܛܪܐ ܩܠܐ…",
    "pollBody.closeThisPoll": "ܣܟܘܪ ܗܕܐ ܫܘܐܠܬܐ؟",
    "pollBody.closing": "ܒܣܟܪܐ…",
    "pollBody.closePoll": "ܣܟܘܪ ܫܘܐܠܬܐ",
    "pollBody.pollUnsupportedFormat": "[ܫܘܐܠܬܐ - ܛܘܦܣܐ ܠܐ ܡܣܘܥܝܐ]",
    "pollBody.failedToSubmitVote": "ܫܕܪܐ ܕܩܠܐ ܠܐ ܦܠܚܠܗ",
    "pollBody.failedToClosePoll": "ܣܟܪܐ ܕܫܘܐܠܬܐ ܠܐ ܦܠܚܠܗ",
    "pollBody.voteCount": "{count, plural, one {# ܩܠܐ} other {# ܩܠ̈ܐ}}",

    // src/lib/components/ui/Portal.fixture.svelte
    "portal.fixture.hello": "ܫܠܡܐ",

    // src/lib/components/settings/PrivacySafetySettings.svelte
    "privacySafetySettings.privacy": "ܦܪܝܫܘܬܐ",
    "privacySafetySettings.privateReadReceipts": "ܩܘܒܠ̈ܐ ܕܩܪܝܬܐ ܟܣܝ̈ܐ",
    "privacySafetySettings.hideYourReadReceiptsFromOther":
        "ܛܫܝ ܩܘܒܠ̈ܐ ܕܩܪܝܬܐ ܕܝܘܟ ܡܢ ܡܦܠܚܢ̈ܐ ܐܚܪ̈ܢܐ. ܡܢܝܢ̈ܐ ܕܠܐ ܩܪܝ̈ܐ ܕܝܘܟ ܗܠ ܗܫܐ ܦܠܚܝ؛ ܐܚܪ̈ܢܐ ܒܣ ܠܐ ܡܨܝ ܕܚܙܝ ܗܕܟܡܐ ܩܪܝܠܘܟ.",
    "privacySafetySettings.hideMessageTextInNotifications":
        "ܛܫܝ ܟܬܒܐ ܕܐܓܪ̈ܬܐ ܓܘ ܡܘܕܥܢܘ̈ܬܐ",
    "privacySafetySettings.notificationsOnThisDeviceSayWho":
        "ܡܘܕܥܢܘ̈ܬܐ ܥܠ ܗܢܐ ܡܐܢܐ ܡܚܘܝܢ ܡܢܝܠܗ ܫܕܪܠܘܟ، ܐܝܢܐ ܠܐ ܡܘܕܝ ܐܡܪܠܗ. ܫܡ̈ܗܐ ܕܫܕܪܢܐ ܘܕܓܘܡܐ ܗܠ ܗܫܐ ܚܙܝܐ ܝܢ. ܦܠܚܐ ܒܣ ܥܠ ܗܢܐ ܡܐܢܐ.",
    "privacySafetySettings.linkPreviewMedia": "ܡܝܕܝܐ ܕܚܙܝܬܐ ܩܕܡܝܬܐ ܕܐܣܘܪ̈ܐ",
    "privacySafetySettings.previewImagesAndVideosUsuallyCome":
        'ܨܘܪ̈ܝܬܐ ܘܒܝܕܝܘ̈ܐ ܕܚܙܝܬܐ ܩܕܡܝܬܐ ܥܕܝܠܐܝܬ ܐܬܝܐ ܝܢ ܫܪܝܪܐܝܬ ܡܢ ܕܘܟܬܐ ܕܡܐܚܕܐ ܠܗܘܢ، ܗܕܟܐ ܗܝ ܕܘܟܬܐ ܝܕܥܐ ܡܘܢܥܐ ܕ IP ܕܝܘܟ ܘܐܡܬܝ ܕܩܪܝܠܘܟ ܐܓܪܬܐ. "ܒܣ ܣܝܪܒܪ ܕܒܝܬܐ" ܛܥܢܐ ܒܣ ܢܘܣܚ̈ܐ ܕܣܝܪܒܪ ܕܝܘܟ ܝܗܒ؛ "ܛܦܝܐ" ܠܐ ܛܥܢܐ ܡܕܡ. ܬܪܘܝܗܝ ܛܫܝܢ ܒܕ ܦܠܚ̈ܐ ܕ YouTube ܘܟܪ̈ܛܐ ܕ X/Twitter، ܕܟܠ ܙܒܢܐ ܛܥܢܝ ܫܪܝܪܐܝܬ ܡܢ ܗܢܝ ܕܘܟ̈ܝܬܐ. ܒܟܠ ܐܘܪܚܐ، ܟܠ ܚܙܝܬܐ ܩܕܡܝܬܐ ܢܛܪܐ ܙܪܐ ܩܐ ܛܥܢܐ ܕܡܝܕܝܐ ܕܝܗ̇. ܙܪܐ ܕܕܠܩܐ/ܛܦܝܐ ܕܚܙܝܬܐ ܩܕܡܝܬܐ ܕܐܣܘܪ̈ܐ ܝܠܗ ܓܘ ܐܓܪ̈ܬܐ ܘܡܝܕܝܐ.',
    "privacySafetySettings.blockedUsers": "ܡܦܠܚܢ̈ܐ ܟܠܝ̈ܐ",
    "privacySafetySettings.all": "ܟܠ",
    "privacySafetySettings.loadPreviewMediaFromWhereverIt":
        "ܛܥܘܢ ܡܝܕܝܐ ܕܚܙܝܬܐ ܩܕܡܝܬܐ ܡܢ ܟܠ ܕܘܟܐ ܕܐܝܬܠܗ̇",
    "privacySafetySettings.homeserverOnly": "ܒܣ ܣܝܪܒܪ ܕܒܝܬܐ",
    "privacySafetySettings.onlyLoadPreviewMediaYourOwn":
        "ܛܥܘܢ ܒܣ ܡܝܕܝܐ ܕܚܙܝܬܐ ܩܕܡܝܬܐ ܕܣܝܪܒܪ ܕܒܝܬܐ ܕܝܘܟ ܝܗܒ",
    "privacySafetySettings.off": "ܛܦܝܐ",
    "privacySafetySettings.neverLoadPreviewMediaAutomatically":
        "ܠܐ ܛܥܘܢ ܡܝܕܝܐ ܕܚܙܝܬܐ ܩܕܡܝܬܐ ܐܘܛܘܡܛܝܩܐܝܬ ܒܟܠ",

    // src/lib/components/settings/ProfileFieldsEditor.svelte
    "profileFieldsEditor.moreAboutYou": "ܝܬܝܪ ܥܠ ܕܝܘܟ",
    "profileFieldsEditor.banner": "ܕܓܠܐ",
    "profileFieldsEditor.yourBanner": "ܕܓܠܐ ܕܝܘܟ",
    "profileFieldsEditor.changeBanner": "ܫܚܠܦ ܕܓܠܐ",
    "profileFieldsEditor.showWhenIAmInA": "ܚܘܝ ܐܡܬܝ ܕܐܝܬܝ ܓܘ ܩܪܝܬܐ",
    "profileFieldsEditor.addsInACallToYour":
        'ܡܘܣܦ "ܓܘ ܩܪܝܬܐ" ܠܦܪܨܘܦܐ ܕܝܘܟ ܐܡܬܝ ܕܐܚܝܕܐ ܝܘܬ ܠܩܪܝܬܐ ܕܩܠܐ، ܘܫܩܠܐ ܠܗ ܐܡܬܝ ܕܫܒܩܬ.',
    "profileFieldsEditor.pronouns": "ܦܢܝ̈ܬܐ ܕܫܡܐ",
    "profileFieldsEditor.sheHerTheyThem": "ܗܝ/ܕܝܗ̇، ܐܢܝ/ܕܝܗܘܢ",
    "profileFieldsEditor.separateWithCommasMostPreferredFirst":
        "ܦܪܘܫ ܒܦܘܣܩ̈ܐ، ܚܒܝܒܐ ܝܬܝܪ ܩܕܡܝܐ.",
    "profileFieldsEditor.status": "ܐܝܟܢܝܘܬܐ",
    "profileFieldsEditor.statusEmoji": "ܐܝܡܘܓܝ ܕܐܝܟܢܝܘܬܐ",
    "profileFieldsEditor.pickAStatusEmoji": "ܓܒܝ ܐܝܡܘܓܝ ܕܐܝܟܢܝܘܬܐ",
    "profileFieldsEditor.onHolidayUntilThe23rd": "ܓܘ ܥܐܕܐ ܗܕܝܡܐ 23",
    "profileFieldsEditor.statusText": "ܟܬܒܐ ܕܐܝܟܢܝܘܬܐ",
    "profileFieldsEditor.bio": "ܬܫܥܝܬܐ ܕܚܝܐ",
    "profileFieldsEditor.tellPeopleAboutYourself": "ܐܡܘܪ ܠܢܫ̈ܐ ܥܠ ܕܝܘܟ",
    "profileFieldsEditor.timezone": "ܦܢܝܬܐ ܕܙܒܢܐ",
    "profileFieldsEditor.timezoneRegion": "ܐܬܪܐ ܕܦܢܝܬܐ ܕܙܒܢܐ",
    "profileFieldsEditor.notSet": "ܠܐ ܡܛܘܝܒܐ",
    "profileFieldsEditor.timezoneCity": "ܡܕܝܢܬܐ ܕܦܢܝܬܐ ܕܙܒܢܐ",
    "profileFieldsEditor.chooseACity": "ܓܒܝ ܡܕܝܢܬܐ",
    "profileFieldsEditor.europeLondon": "Europe/London",
    "profileFieldsEditor.useMine": "ܦܠܚ ܒܕܝܝ",
    "profileFieldsEditor.usernameColour": "ܓܘܢܐ ܕܫܡܐ ܕܡܦܠܚܢܐ",
    "profileFieldsEditor.usernameColourOnDarkThemes":
        "ܓܘܢܐ ܕܫܡܐ ܕܡܦܠܚܢܐ ܥܠ ܓܘܢ̈ܐ ܟܡ̈ܐ",
    "profileFieldsEditor.darkThemes": "ܓܘܢ̈ܐ ܟܡ̈ܐ",
    "profileFieldsEditor.usernameColourOnLightThemes":
        "ܓܘܢܐ ܕܫܡܐ ܕܡܦܠܚܢܐ ܥܠ ܓܘܢ̈ܐ ܒܗܝܪ̈ܐ",
    "profileFieldsEditor.lightThemes": "ܓܘܢ̈ܐ ܒܗܝܪ̈ܐ",
    "profileFieldsEditor.resetToDefault": "ܕܥܘܪ ܠܥܕܝܠܐ",
    "profileFieldsEditor.chooseAColour": "ܓܒܝ ܓܘܢܐ",
    "profileFieldsEditor.oneColourForDarkThemesAnd":
        "ܚܕ ܓܘܢܐ ܩܐ ܓܘܢ̈ܐ ܟܡ̈ܐ ܘܚܕ ܩܐ ܒܗܝܪ̈ܐ، ܩܐ ܕܫܡܐ ܕܝܘܟ ܦܝܫ ܦܫܝܩܐ ܠܩܪܝܬܐ ܒܬܪܘܝܗܝ.",
    "profileFieldsEditor.links": "ܐܣܘܪ̈ܐ",
    "profileFieldsEditor.label": "ܢܝܫܢܐ",
    "profileFieldsEditor.linkLabel": "ܢܝܫܢܐ ܕܐܣܘܪܐ",
    "profileFieldsEditor.httpsExampleOrg": "https://example.org",
    "profileFieldsEditor.linkAddress": "ܡܘܢܥܐ ܕܐܣܘܪܐ",
    "profileFieldsEditor.removeLink": "ܫܩܘܠ ܐܣܘܪܐ",
    "profileFieldsEditor.addLink": "ܐܘܣܦ ܐܣܘܪܐ",
    "profileFieldsEditor.saved": "ܢܛܝܪܐ",
    "profileFieldsEditor.useATimezoneNameLikeEurope":
        "ܦܠܚ ܒܫܡܐ ܕܦܢܝܬܐ ܕܙܒܢܐ ܐܝܟ Europe/London.",
    "profileFieldsEditor.chooseACity2": "ܓܒܝ ܡܕܝܢܬܐ.",
    "profileFieldsEditor.bannerUploadFailed": "ܐܣܩܬܐ ܕܕܓܠܐ ܠܐ ܦܠܚܠܗ̇",
    "profileFieldsEditor.failedToSaveProfileFields":
        "ܢܛܪܐ ܕܚܩܠ̈ܐ ܕܦܪܨܘܦܐ ܠܐ ܦܠܚܠܗ",

    // src/lib/components/layout/ProfileFooter.svelte
    "profileFooter.dismiss": "ܫܩܘܠ",
    "profileFooter.switchAccounts": "ܫܚܠܦ ܚܘܫܒܢܐ",
    "profileFooter.unknown": "ܠܐ ܝܕܝܥܐ",

    // src/lib/components/settings/PushDiagnostics.svelte
    "pushDiagnostics.pushGateway": "ܬܪܥܐ ܕܡܘܕܥܢܘ̈ܬܐ",
    "pushDiagnostics.notificationRelay": "ܡܥܒܪܢܐ ܕܡܘܕܥܢܘ̈ܬܐ",
    "pushDiagnostics.pushNotificationsAreRelayedThroughThis":
        "ܡܘܕܥܢܘ̈ܬܐ ܡܥܒܪ̈ܢܐ ܝܢ ܒܝܕ ܗܢܐ ܬܪܥܐ. ܡܨܐ ܕܚܙܐ ܐܝܢܝ ܓܘܡ̈ܐ ܘܫܕܪ̈ܢܐ ܡܘܕܥܝ ܠܘܟ، ܐܝܢܐ ܠܐ ܟܬܒܐ ܕܐܓܪ̈ܬܐ ܕܝܘܟ ܒܟܠ.",
    "pushDiagnostics.warningYourHomeserverIsRoutingThis":
        "ܙܘܗܪܐ: ܣܝܪܒܪ ܕܒܝܬܐ ܕܝܘܟ ܒܫܕܪܐ ܝܠܗ ܡܘܕܥܢܘ̈ܬܐ ܕܗܢܐ ܡܐܢܐ ܠܬܪܥܐ ܐܚܪܢܐ ({join}). ܗܘ ܬܪܥܐ، ܘܠܐ ܕܠܥܠ، ܚܙܐ ܝܕ̈ܥܬܐ ܕܡܘܕܥܢܘ̈ܬܐ ܕܝܘܟ.",
    "pushDiagnostics.verifiedYourHomeserverRoutesNotificationsTo":
        "ܡܫܪܪܐ: ܣܝܪܒܪ ܕܒܝܬܐ ܕܝܘܟ ܫܕܪܐ ܡܘܕܥܢܘ̈ܬܐ ܠܗܢܐ ܬܪܥܐ.",
    "pushDiagnostics.noPushNotificationsAreRegisteredOn":
        "ܠܝܬ ܡܘܕܥܢܘ̈ܬܐ ܪܫܝܡ̈ܬܐ ܥܠ ܗܢܐ ܚܘܫܒܢܐ ܗܠ ܗܫܐ.",

    // src/lib/components/ui/QrCodeImage.svelte
    "qrCodeImage.couldNotRenderTheVerificationCode":
        "ܚܘܝܐ ܕܪܡܙܐ ܕܫܘܪܪܐ ܠܐ ܦܠܚܠܗ.",
    "qrCodeImage.qrCodeForDeviceVerification": "ܪܡܙܐ ܕ QR ܩܐ ܫܘܪܪܐ ܕܡܐܢܐ",

    // src/lib/components/layout/QuickActions.svelte
    "quickActions.newDm": "ܐܓܪܬܐ ܫܪܝܪܬܐ ܚܕܬܐ",
    "quickActions.createRoomInSpace": "ܒܪܝ ܓܘܡܐ ܓܘ ܚܘܕܪܐ",
    "quickActions.createNewRoom": "ܒܪܝ ܓܘܡܐ ܚܕܬܐ",
    "quickActions.createNewSpace": "ܒܪܝ ܚܘܕܪܐ ܚܕܬܐ",
    "quickActions.joinRoomByAddress": "ܥܘܠ ܠܓܘܡܐ ܒܡܘܢܥܐ",
    "quickActions.createARoom": "ܒܪܝ ܓܘܡܐ",
    "quickActions.createASpace": "ܒܪܝ ܚܘܕܪܐ",
    "quickActions.newDirectMessage": "ܐܓܪܬܐ ܫܪܝܪܬܐ ܚܕܬܐ",
    "quickActions.joinARoom": "ܥܘܠ ܠܓܘܡܐ",
    "quickActions.spaceName": "ܫܡܐ ܕܚܘܕܪܐ",
    "quickActions.roomName": "ܫܡܐ ܕܓܘܡܐ",
    "quickActions.mySpace": "ܚܘܕܪܐ ܕܝܝ",
    "quickActions.optional": "(ܠܐ ܡܚܝܒܐ)",
    "quickActions.whatSThisSpaceAbout": "ܥܠ ܡܘܕܝ ܝܠܗ ܗܢܐ ܚܘܕܪܐ؟",
    "quickActions.whatSThisRoomAbout": "ܥܠ ܡܘܕܝ ܝܠܗ ܗܢܐ ܓܘܡܐ؟",
    "quickActions.opensStraightIntoACallMessages":
        "ܦܬܚ ܫܪܝܪܐܝܬ ܓܘ ܩܪܝܬܐ. ܐܓܪ̈ܬܐ ܗܠ ܗܫܐ ܦܠܚܝ.",
    "quickActions.enableEncryption": "ܕܠܩ ܛܘܫܝܐ",
    "quickActions.canTBeTurnedOffLater": "ܠܐ ܦܝܫ ܛܦܝܐ ܒܬܪ ܗܕܐ.",
    "quickActions.findSomeoneToMessage": "ܒܨܝ ܚܕ ܢܫܐ ܩܐ ܫܕܪܐ ܐܓܪܬܐ…",
    "quickActions.encryptThisDm": "ܛܫܝ ܗܕܐ ܐܓܪܬܐ ܫܪܝܪܬܐ",
    "quickActions.openTheDm": "ܦܬܘܚ ܐܓܪܬܐ ܫܪܝܪܬܐ",
    "quickActions.roomAddressOrId": "ܡܘܢܥܐ ܝܢ ܗܝܝܘܬܐ ܕܓܘܡܐ",
    "quickActions.roomServerCom": "#room:server.com",
    "quickActions.requestSentYouLlBeAble":
        "ܒܥܝܬܐ ܫܕܝܪܬܐ ܝܠܗ̇ - ܒܕ ܡܨܝܬ ܥܠܠܐ ܐܡܬܝ ܕܚܕ ܢܫܐ ܡܥܠܠܘܟ.",
    "quickActions.youCanTJoinThisRoom":
        "ܠܐ ܡܨܝܬ ܥܠܠܐ ܠܗܢܐ ܓܘܡܐ ܫܪܝܪܐܝܬ، ܐܝܢܐ ܡܨܝܬ ܒܥܝܐ ܥܠܠܐ.",
    "quickActions.requestToJoin": "ܒܥܝ ܥܠܠܐ",
    "quickActions.create": "ܒܪܝ",
    "quickActions.somethingWentWrong": "ܡܕܡ ܠܐ ܦܠܚܠܗ",
    "quickActions.enterARoomAddressRoomServer":
        "ܡܥܠ ܡܘܢܥܐ ܕܓܘܡܐ (#room:server.com) ܝܢ ܗܝܝܘܬܐ ܕܓܘܡܐ (!id:server.com)",
    "quickActions.couldNotSendTheJoinRequest": "ܫܕܪܐ ܕܒܥܝܬܐ ܕܥܠܠܐ ܠܐ ܦܠܚܠܗ",

    // src/lib/components/messages/ReactorPopover.svelte
    "reactorPopover.more": "+{overflow} ܝܬܝܪ",
    "reactorPopover.reactedWith": "ܬܓܘܒܬܐ ܒ {label}",
    "reactorPopover.userList": "ܪܫܝܡܬܐ ܕܡܦܠܚܢ̈ܐ",

    // src/lib/components/messages/RenameAttachmentDialog.svelte
    "renameAttachmentDialog.editAttachment": "ܬܩܢ ܐܣܝܪܬܐ",
    "renameAttachmentDialog.filename": "ܫܡܐ ܕܦܐܝܠ",

    // src/lib/components/layout/RoomDirectory.svelte
    "roomDirectory.exploreRooms": "ܒܨܝ ܓܘܡ̈ܐ",
    "roomDirectory.onYourHomeserver": "ܥܠ ܣܝܪܒܪ ܕܒܝܬܐ ܕܝܘܟ",
    "roomDirectory.publicRooms": "ܓܘܡ̈ܐ ܓܠܝ̈ܐ {value}",
    "roomDirectory.rooms": "· ~{totalEstimate} ܓܘܡ̈ܐ",
    "roomDirectory.searchRooms": "ܒܨܝ ܓܘܡ̈ܐ…",
    "roomDirectory.serverOptional": "ܣܝܪܒܪ (ܠܐ ܡܚܝܒܐ)",
    "roomDirectory.search": "ܒܨܝ",
    "roomDirectory.noRoomsFound": "ܠܐ ܦܝܫܝ ܡܫܟܚܐ ܓܘܡ̈ܐ.",
    "roomDirectory.space": "ܚܘܕܪܐ",
    "roomDirectory.open": "ܦܬܘܚ",
    "roomDirectory.thisRoomRequiresAKnockNot":
        "ܗܢܐ ܓܘܡܐ ܣܢܝܩܐ ܝܠܗ ܠܢܩܫܐ ܥܠ ܬܪܥܐ - ܗܠ ܗܫܐ ܠܐ ܝܠܗ ܡܣܘܥܝܐ",
    "roomDirectory.knockOnly": "ܒܣ ܒܢܩܫܐ",
    "roomDirectory.somethingWentWrong": "ܡܕܡ ܠܐ ܦܠܚܠܗ",

    // src/lib/components/layout/RoomHeaderOverflowMenu.svelte
    "roomHeaderOverflowMenu.moreRoomOptions": "ܓܒܝ̈ܬܐ ܝܬܝܪ̈ܐ ܕܓܘܡܐ",
    "roomHeaderOverflowMenu.unread": "ܠܐ ܩܪܝܐ",
    "roomHeaderOverflowMenu.badgeThreads":
        "{count, plural, one {{badge} ܕܘܟܪܢܐ ܕܠܐ ܩܪܝܐ} other {{badge} ܕܘܟܪܢ̈ܐ ܕܠܐ ܩܪܝ̈ܐ}}",
    "roomHeaderOverflowMenu.badgePinned":
        "{count, plural, one {{badge} ܐܓܪܬܐ ܩܒܝܥܬܐ} other {{badge} ܐܓܪ̈ܬܐ ܩܒܝܥ̈ܬܐ}}",
    "roomHeaderOverflowMenu.badgeNotifications":
        "{count, plural, one {{badge} ܡܘܕܥܢܘܬܐ ܕܠܐ ܩܪܝܬܐ} other {{badge} ܡܘܕܥܢܘ̈ܬܐ ܕܠܐ ܩܪܝ̈ܐ}}",
    "roomHeaderOverflowMenu.badgeMedia":
        "{count, plural, one {{badge} ܡܕܡ} other {{badge} ܡܕܡ̈ܐ}}",
    "roomHeaderOverflowMenu.badgeMembers":
        "{count, plural, one {{badge} ܗܕܡܐ} other {{badge} ܗܕܡ̈ܐ}}",

    // src/lib/components/layout/RoomList.svelte
    "roomList.doneReordering": "ܣܘܕܪܐ ܫܠܡܠܗ",
    "roomList.reorderRooms": "ܣܕܪ ܓܘܡ̈ܐ ܡܢ ܕܪܝܫ",
    "roomList.spaceSettings": "ܛܘܝܒ̈ܐ ܕܚܘܕܪܐ",
    "roomList.pendingInvites": "ܙܘܡܢ̈ܐ ܕܡܢܛܪܝܢ",
    "roomList.inVoice": "{name} - ܓܘ ܩܠܐ",
    "roomList.orderValue": "ܡܢܝܢܐ ܕܣܘܕܪܐ",
    "roomList.roomSettings": "ܛܘܝܒ̈ܐ ܕܓܘܡܐ",
    "roomList.favourites": "ܚܒܝ̈ܒܐ",
    "roomList.channels": "ܩܢ̈ܝܐ",
    "roomList.rooms": "ܓܘܡ̈ܐ",
    "roomList.lowPriority": "ܩܕܡܝܘܬܐ ܢܚܝܬܬܐ",
    "roomList.browseRooms": "ܒܨܝ ܓܘܡ̈ܐ",
    "roomList.members": "{numMembers} ܗܕܡ̈ܐ",
    "roomList.requested": "ܒܥܝܐ",
    "roomList.cancelRequest": "ܒܛܠ ܒܥܝܬܐ",
    "roomList.youCanTJoinThisRoom":
        "ܠܐ ܡܨܝܬ ܥܠܠܐ ܠܗܢܐ ܓܘܡܐ ܫܪܝܪܐܝܬ - ܒܥܝܬ ܥܠܠܐ ܒܕܘܟܬܗ̇؟",
    "roomList.notNow": "ܠܐ ܗܫܐ",
    "roomList.requestToJoin": "ܒܥܝ ܥܠܠܐ",
    "roomList.directMessages": "ܐܓܪ̈ܬܐ ܫܪܝܪ̈ܬܐ",
    "roomList.noRoomsYet": "ܠܝܬ ܓܘܡ̈ܐ ܗܠ ܗܫܐ",
    "roomList.copyRoomLink": "ܢܣܘܚ ܐܣܘܪܐ ܕܓܘܡܐ",
    "roomList.markAsRead": "ܢܝܫ ܐܝܟ ܩܪܝܐ",
    "roomList.addToSpace": "ܐܘܣܦ ܠܚܘܕܪܐ",
    "roomList.clickAgainToLeave": "ܕܥܘܨ ܡܢ ܕܪܝܫ ܩܐ ܫܒܩܐ",
    "roomList.leaveRoom": "ܫܒܘܩ ܓܘܡܐ",
    "roomList.couldNotSendTheJoinRequest": "ܫܕܪܐ ܕܒܥܝܬܐ ܕܥܠܠܐ ܠܐ ܦܠܚܠܗ",
    "roomList.orderMustBeBetween0And":
        "ܣܘܕܪܐ ܣܢܝܩܐ ܝܠܗ ܕܗܘܐ ܒܝܢ 0 ܘ 1 - {value} ܦܠܝܚܐ ܝܠܗ ܒܕܘܟܬܗ.",
    "roomList.failedToSetOrder": "ܛܘܝܒܐ ܕܣܘܕܪܐ ܠܐ ܦܠܚܠܗ",

    // src/lib/components/layout/RoomMediaPanel.svelte
    "roomMediaPanel.media": "ܡܝܕܝܐ",
    "roomMediaPanel.closeMediaPanel": "ܣܟܘܪ ܦܢܝܬܐ ܕܡܝܕܝܐ",
    "roomMediaPanel.media2": "ܡܝܕܝܐ ({length}{value})",
    "roomMediaPanel.files": "ܦܐܝܠ̈ܐ ({length}{value})",
    "roomMediaPanel.tryAgain": "ܢܣܝ ܡܢ ܕܪܝܫ",
    "roomMediaPanel.play": "{name} - ܦܠܚ",
    "roomMediaPanel.video": "ܒܝܕܝܘ",
    "roomMediaPanel.audio": "ܩܠܐ",
    "roomMediaPanel.file": "ܦܐܝܠ",
    "roomMediaPanel.decryptingMedia": "ܒܦܬܚܐ ܛܘܫܝܐ ܕܡܝܕܝܐ",
    "roomMediaPanel.decryptingMedia2": "ܒܦܬܚܐ ܛܘܫܝܐ ܕܡܝܕܝܐ...",
    "roomMediaPanel.mediaCouldNotBeLoaded": "ܡܝܕܝܐ ܠܐ ܛܥܝܢܬܐ",
    "roomMediaPanel.couldNotLoadThisMedia": "ܛܥܢܐ ܕܗܕܐ ܡܝܕܝܐ ܠܐ ܦܠܚܠܗ.",
    "roomMediaPanel.noMediaFoundInTheLast":
        "ܠܐ ܦܝܫܐ ܡܫܟܚܬܐ ܡܝܕܝܐ ܓܘ ܟܡܐ ܡܐܐ̈ ܐܓܪ̈ܬܐ ܐܚܪܝ̈ܐ.",
    "roomMediaPanel.noFilesFoundInTheLast":
        "ܠܐ ܦܝܫܝ ܡܫܟܚܐ ܦܐܝܠ̈ܐ ܓܘ ܟܡܐ ܡܐܐ̈ ܐܓܪ̈ܬܐ ܐܚܪܝ̈ܐ.",
    "roomMediaPanel.noImagesOrVideosInThis":
        "ܠܝܬ ܨܘܪ̈ܝܬܐ ܝܢ ܒܝܕܝܘ̈ܐ ܓܘ ܗܢܐ ܓܘܡܐ ܗܠ ܗܫܐ.",
    "roomMediaPanel.noFilesInThisRoomYet": "ܠܝܬ ܦܐܝܠ̈ܐ ܓܘ ܗܢܐ ܓܘܡܐ ܗܠ ܗܫܐ.",
    "roomMediaPanel.couldNotLoadMedia": "ܛܥܢܐ ܕܡܝܕܝܐ ܠܐ ܦܠܚܠܗ.",
    "roomMediaPanel.couldNotLoadMoreMedia": "ܛܥܢܐ ܕܡܝܕܝܐ ܝܬܝܪܬܐ ܠܐ ܦܠܚܠܗ.",
    "roomMediaPanel.failedToDownloadAttachment": "ܐܚܬܬܐ ܕܐܣܝܪܬܐ ܠܐ ܦܠܚܠܗ̇",

    // src/lib/components/layout/RoomSettings.svelte
    "roomSettings.closeSettings": "ܣܟܘܪ ܛܘܝܒ̈ܐ",
    "roomSettings.backToSettings": "ܠܒܣܬܪܐ ܠܛܘܝܒ̈ܐ",
    "roomSettings.settings": "{name} - ܛܘܝܒ̈ܐ",
    "roomSettings.roomAvatar": "ܨܘܪܬܐ ܕܓܘܡܐ",
    "roomSettings.roomName": "ܫܡܐ ܕܓܘܡܐ",
    "roomSettings.saved": "ܢܛܝܪܐ!",
    "roomSettings.saveChanges": "ܢܛܘܪ ܫܘܚܠܦ̈ܐ",
    "roomSettings.advanced": "ܡܬܩܕܡܐ",
    "roomSettings.spaceId": "ܗܝܝܘܬܐ ܕܚܘܕܪܐ",
    "roomSettings.roomId": "ܗܝܝܘܬܐ ܕܓܘܡܐ",
    "roomSettings.copied": "ܢܣܝܚܐ!",
    "roomSettings.roomVersionV": "ܢܘܣܚܐ ܕܓܘܡܐ: v{getVersion}",
    "roomSettings.upgradeRoom": "ܡܥܠܝ ܓܘܡܐ…",
    "roomSettings.thisCreatesANewRoomOn":
        "ܗܕܐ ܒܪܝܐ ܓܘܡܐ ܚܕܬܐ ܥܠ v{recommendedVersion} ܘܢܝܫܐ ܠܗܢܐ ܐܝܟ ܡܫܘܚܠܦܐ. ܗܕܡ̈ܐ ܒܕ ܡܚܘܝܐ ܗܘܝ ܠܓܘܡܐ ܚܕܬܐ.",
    "roomSettings.upgrading": "ܒܡܥܠܝܐ…",
    "roomSettings.upgradeRoom2": "ܡܥܠܝ ܓܘܡܐ",
    "roomSettings.whoCanJoin": "ܡܢܝܠܗ ܡܨܐ ܥܠܠܐ؟",
    "roomSettings.spaceMembersAnyoneInCanJoin":
        "ܗܕܡ̈ܐ ܕܚܘܕܪܐ - ܟܠ ܢܫܐ ܓܘ {parentSpaceNames} ܡܨܐ ܥܠܠܐ",
    "roomSettings.spaceMembersAnyoneInTheParent":
        "ܗܕܡ̈ܐ ܕܚܘܕܪܐ - ܟܠ ܢܫܐ ܓܘ ܚܘܕܪܐ ܪܫܝܐ ܡܨܐ ܥܠܠܐ",
    "roomSettings.messageHistory": "ܬܫܥܝܬܐ ܕܐܓܪ̈ܬܐ",
    "roomSettings.guestAccess": "ܡܥܠܬܐ ܕܐܟܣܢܝ̈ܐ",
    "roomSettings.allowGuestsToJoinWithoutAn":
        "ܗܒ ܦܣܐ ܠܐܟܣܢܝ̈ܐ ܕܥܐܠܝ ܕܠܐ ܚܘܫܒܢܐ",
    "roomSettings.guestsAreAnonymousAccountsTheHomeserver":
        "ܐܟܣܢܝ̈ܐ ܝܢ ܚܘܫܒܢ̈ܐ ܕܠܐ ܫܡܐ ܕܣܝܪܒܪ ܕܒܝܬܐ ܒܪܝܐ ܐܡܬܝ ܕܣܢܝܩܐ ܝܠܗ. ܣܝܪܒܪ̈ܐ ܣܓܝ̈ܐܐ ܛܦܝܢ ܪܘܫܡܐ ܕܐܟܣܢܝ̈ܐ ܒܟܠ، ܘܗܝܕܝܟ ܗܕܐ ܠܝܬ ܠܗ̇ ܦܠܛܐ.",
    "roomSettings.discoverability": "ܡܫܟܚܢܘܬܐ",
    "roomSettings.addresses": "ܡܘܢܥ̈ܐ",
    "roomSettings.loadingAddresses": "ܒܛܥܢܐ ܡܘܢܥ̈ܐ…",
    "roomSettings.noAddressesYet": "ܠܝܬ ܡܘܢܥ̈ܐ ܗܠ ܗܫܐ.",
    "roomSettings.main": "ܪܫܝܐ",
    "roomSettings.remove": "ܫܩܘܠ {alias}",
    "roomSettings.mainAddress": "ܡܘܢܥܐ ܪܫܝܐ",
    "roomSettings.noMainAddress": "ܠܝܬ ܡܘܢܥܐ ܪܫܝܐ",
    "roomSettings.set": "ܛܝܒ",
    "roomSettings.myRoom": "my-room",
    "roomSettings.serverAccessControl": "ܡܕܒܪܢܘܬܐ ܕܡܥܠܬܐ ܕܣܝܪܒܪ̈ܐ",
    "roomSettings.controlWhichHomeserversMayParticipateIn":
        "ܕܒܪ ܐܝܢܝ ܣܝܪܒܪ̈ܐ ܡܨܝ ܕܫܘܬܦܝ ܓܘ ܗܢܐ ܓܘܡܐ. ܐܬ̈ܘܬܐ ܕܟܠ ܡܕܡ:",
    "roomSettings.matchesAnyCharacters": "ܡܙܕܘܓ ܥܡ ܟܠ ܐܬ̈ܘܬܐ،",
    "roomSettings.matchesOneDeniedServersAreRemoved":
        "ܡܙܕܘܓ ܥܡ ܚܕܐ. ܣܝܪܒܪ̈ܐ ܕܠܐ ܩܒܝܠ̈ܐ ܫܩܝܠ̈ܐ ܝܢ ܡܢ ܚܘܝܕܐ ܕܗܢܐ ܓܘܡܐ.",
    "roomSettings.noServerAclIsSetAll":
        "ܠܝܬ ACL ܕܣܝܪܒܪ̈ܐ ܡܛܘܝܒܐ. ܟܠ ܣܝܪܒܪ̈ܐ ܡܨܝ ܕܫܘܬܦܝ.",
    "roomSettings.allowedServersOnePerLine": "ܣܝܪܒܪ̈ܐ ܩܒܝܠ̈ܐ (ܚܕ ܒܟܠ ܣܪܓܐ)",
    "roomSettings.deniedServersOnePerLine": "ܣܝܪܒܪ̈ܐ ܠܐ ܩܒܝܠ̈ܐ (ܚܕ ܒܟܠ ܣܪܓܐ)",
    "roomSettings.allowServersIdentifiedByARaw":
        "ܗܒ ܦܣܐ ܠܣܝܪܒܪ̈ܐ ܕܝܕܝܥ̈ܐ ܒܡܘܢܥܐ ܕ IP ܚܠܝܐ",
    "roomSettings.saveServerAcl": "ܢܛܘܪ ACL ܕܣܝܪܒܪ̈ܐ",
    "roomSettings.youDoNotHavePermissionTo":
        "ܠܝܬ ܠܘܟ ܦܣܐ ܠܬܘܩܢܐ ܕ ACL ܕܣܝܪܒܪ̈ܐ ܩܐ ܗܢܐ ܓܘܡܐ.",
    "roomSettings.appliesToTheSpaceAndAll": "ܦܠܚܐ ܥܠ ܚܘܕܪܐ ܘܟܠ ܓܘܡ̈ܐ ܕܝܗܝ.",
    "roomSettings.notificationLevel": "ܕܪܓܐ ܕܡܘܕܥܢܘ̈ܬܐ",
    "roomSettings.encryption": "ܛܘܫܝܐ",
    "roomSettings.encrypted": "ܡܛܫܝܐ",
    "roomSettings.notEncrypted": "ܠܐ ܡܛܫܝܐ",
    "roomSettings.messagesInThisRoomAreEnd":
        "ܐܓܪ̈ܬܐ ܓܘ ܗܢܐ ܓܘܡܐ ܡܛܫܝ̈ܬܐ ܝܢ ܡܢ ܪܫܐ ܠܪܫܐ. ܗܕܐ ܠܐ ܦܝܫܐ ܛܦܝܬܐ.",
    "roomSettings.enableEncryption": "ܕܠܩ ܛܘܫܝܐ",
    "roomSettings.typeToConfirm":
        "ܟܬܘܒ {ENABLE_ENCRYPTION_CONFIRM_PHRASE} ܩܐ ܫܘܪܪܐ",
    "roomSettings.enabling": "ܒܕܠܩܐ…",
    "roomSettings.powerLevelRequiredForEachAction":
        "ܕܪܓܐ ܕܚܝܠܐ ܕܣܢܝܩܐ ܝܠܗ ܩܐ ܟܠ ܣܘܥܪܢܐ (0–100).",
    "roomSettings.joinCallsVoiceVideo": "ܥܠܠܐ ܠܩܪ̈ܝܬܐ (ܩܠܐ/ܒܝܕܝܘ)",
    "roomSettings.invite": "ܙܡܢ",
    "roomSettings.searchMembers": "ܒܨܝ ܗܕܡ̈ܐ…",
    "roomSettings.banned": "ܐܣܝܪ̈ܐ ({length})",
    "roomSettings.pendingJoinRequests": "ܒܥܝ̈ܬܐ ܕܥܠܠܐ ܕܡܢܛܪܝܢ ({length})",
    "roomSettings.deny": "ܠܐ ܩܒܠ",
    "roomSettings.approve": "ܩܒܘܠ",
    "roomSettings.unban": "ܫܪܝ ܐܣܪܐ",
    "roomSettings.noBannedMembers": "ܠܝܬ ܗܕܡ̈ܐ ܐܣܝܪ̈ܐ",
    "roomSettings.you": " (ܐܢܬ)",
    "roomSettings.setRole": "ܛܝܒ ܬܦܩܝܕܐ…",
    "roomSettings.admin100": "ܡܕܒܪܢܐ (100)",
    "roomSettings.moderator50": "ܡܫܚܠܦܢܐ (50)",
    "roomSettings.member0": "ܗܕܡܐ (0)",
    "roomSettings.muted1": "ܫܬܝܩܐ (-1)",
    "roomSettings.kick": "ܛܪܘܕ",
    "roomSettings.ban": "ܐܣܘܪ",
    "roomSettings.hideThisUserSMessagesEverywhere":
        "ܛܫܝ ܐܓܪ̈ܬܐ ܕܗܢܐ ܡܦܠܚܢܐ ܒܟܠ ܕܘܟܐ (ܢܛܝܪܐ ܓܘ ܚܘܫܒܢܐ ܕܝܘܟ)",
    "roomSettings.setThe": "ܛܝܒ ܚܩܠܐ",
    "roomSettings.fieldOnEachChildRoomTo":
        "ܥܠ ܟܠ ܓܘܡܐ ܒܪܐ ܩܐ ܡܕܒܪܢܘܬܐ ܕܣܘܕܪܐ (ܒܐܬ̈ܘܬܐ). ܫܒܘܩ ܣܦܝܩܐ ܩܐ ܣܘܕܪܐ ܒܙܒܢܐ ܕܒܪܝܐ.",
    "roomSettings.suggested": "ܡܦܝܣܐ",
    "roomSettings.removeSuggestedHint": "ܫܩܘܠ ܢܝܫܢܐ ܕܡܦܝܣܐ",
    "roomSettings.markAsSuggested": "ܢܝܫ ܐܝܟ ܡܦܝܣܐ",
    "roomSettings.unsuggest": "ܫܩܘܠ ܡܦܝܣܢܘܬܐ",
    "roomSettings.suggest": "ܦܝܣ",
    "roomSettings.order": "ܣܘܕܪܐ",
    "roomSettings.removeFromSpace": "ܫܩܘܠ ܡܢ ܚܘܕܪܐ",
    "roomSettings.noChildRooms": "ܠܝܬ ܓܘܡ̈ܐ ܒܢ̈ܝܐ",
    "roomSettings.useYourGlobalNotificationSettings":
        "ܦܠܚ ܒܛܘܝܒ̈ܐ ܓܢܣܝ̈ܐ ܕܡܘܕܥܢܘ̈ܬܐ ܕܝܘܟ.",
    "roomSettings.allMessages": "ܟܠ ܐܓܪ̈ܬܐ",
    "roomSettings.notifyForEveryMessage": "ܡܘܕܥ ܩܐ ܟܠ ܐܓܪܬܐ.",
    "roomSettings.mentionsOnly": "ܒܣ ܕܘܟܪܢ̈ܐ",
    "roomSettings.notifyOnlyForMentionsAndKeywords":
        "ܡܘܕܥ ܒܣ ܩܐ @ܕܘܟܪܢ̈ܐ ܘܡܠ̈ܐ ܪܫܝ̈ܬܐ.",
    "roomSettings.neverNotify": "ܠܐ ܡܘܕܥ ܒܟܠ.",
    "roomSettings.failedToUpdateNotifications": "ܚܘܕܬܐ ܕܡܘܕܥܢܘ̈ܬܐ ܠܐ ܦܠܚܠܗ̇.",
    "roomSettings.failedToEnableEncryption": "ܕܠܩܐ ܕܛܘܫܝܐ ܠܐ ܦܠܚܠܗ",
    "roomSettings.failedToSave": "ܢܛܪܐ ܠܐ ܦܠܚܠܗ",
    "roomSettings.uploadFailed": "ܐܣܩܬܐ ܠܐ ܦܠܚܠܗ̇",
    "roomSettings.failedToUpgradeRoom": "ܡܥܠܝܢܘܬܐ ܕܓܘܡܐ ܠܐ ܦܠܚܠܗ̇",
    "roomSettings.failedToSaveServerAcl": "ܢܛܪܐ ܕ ACL ܕܣܝܪܒܪ̈ܐ ܠܐ ܦܠܚܠܗ",
    "roomSettings.couldNotChangeVisibility": "ܫܘܚܠܦܐ ܕܚܙܝܝܘܬܐ ܠܐ ܦܠܚܠܗ",
    "roomSettings.couldNotLoadThisRoomS": "ܛܥܢܐ ܕܡܘܢܥ̈ܐ ܕܗܢܐ ܓܘܡܐ ܠܐ ܦܠܚܠܗ",
    "roomSettings.couldNotAddThatAddress": "ܐܘܣܦܬܐ ܕܗܘ ܡܘܢܥܐ ܠܐ ܦܠܚܠܗ̇",
    "roomSettings.thisAddressIsPublishedAsOne":
        "ܗܢܐ ܡܘܢܥܐ ܦܪܝܣܐ ܝܠܗ ܐܝܟ ܚܕ ܡܢ ܡܘܢܥ̈ܐ ܕܓܘܡܐ ܘܠܝܬ ܠܘܟ ܦܣܐ ܠܫܩܠܐ ܕܦܪܣܐ ܕܝܗܝ، ܗܕܟܐ ܠܐ ܦܝܫ ܫܩܠܐ. ܫܐܘܠ ܡܢ ܡܕܒܪܢܐ ܕܓܘܡܐ.",
    "roomSettings.couldNotRemoveThatAddress": "ܫܩܠܐ ܕܗܘ ܡܘܢܥܐ ܠܐ ܦܠܚܠܗ",
    "roomSettings.couldNotSetTheMainAddress": "ܛܘܝܒܐ ܕܡܘܢܥܐ ܪܫܝܐ ܠܐ ܦܠܚܠܗ",
    "roomSettings.failed": "ܠܐ ܦܠܚܠܗ",
    "roomSettings.muted": "ܫܬܝܩܐ",
    "roomSettings.admin": "ܡܕܒܪܢܐ",
    "roomSettings.moderator": "ܡܫܚܠܦܢܐ",
    "roomSettings.member": "ܗܕܡܐ",
    "roomSettings.failedToUpdateSuggestion": "ܚܘܕܬܐ ܕܡܦܝܣܢܘܬܐ ܠܐ ܦܠܚܠܗ̇",
    "roomSettings.listThisRoomInTheServerDirectory":
        "ܪܫܘܡ ܗܢܐ ܓܘܡܐ ܓܘ ܕܪܓܐ ܕܣܝܪܒܪ",
    "roomSettings.listThisSpaceInTheServerDirectory":
        "ܪܫܘܡ ܗܢܐ ܚܘܕܪܐ ܓܘ ܕܪܓܐ ܕܣܝܪܒܪ",
    "roomSettings.listsTheRoomByIdBeingFound":
        "ܪܫܡܐ ܠܓܘܡܐ ܒܗܝܝܘܬܐ. ܩܐ ܡܫܟܚܬܐ ܒܫܡܐ ܣܢܝܩܐ ܝܠܗ ܡܘܢܥܐ ܦܪܝܣܐ ܒܕ - ܐܘܣܦ ܚܕ ܠܬܚܬ.",
    "roomSettings.listsTheSpaceByIdBeingFound":
        "ܪܫܡܐ ܠܚܘܕܪܐ ܒܗܝܝܘܬܐ. ܩܐ ܡܫܟܚܬܐ ܒܫܡܐ ܣܢܝܩܐ ܝܠܗ ܡܘܢܥܐ ܦܪܝܣܐ ܒܕ - ܐܘܣܦ ܚܕ ܠܬܚܬ.",
    "roomSettings.aPublishedAddressLetsPeopleFindRoom":
        "ܡܘܢܥܐ ܦܪܝܣܐ ܝܗܒ ܦܣܐ ܠܢܫ̈ܐ ܕܡܫܟܚܝ ܘܥܐܠܝ ܠܗܢܐ ܓܘܡܐ ܒܫܡܐ ܒܕܘܟ ܗܝܝܘܬܐ.",
    "roomSettings.aPublishedAddressLetsPeopleFindSpace":
        "ܡܘܢܥܐ ܦܪܝܣܐ ܝܗܒ ܦܣܐ ܠܢܫ̈ܐ ܕܡܫܟܚܝ ܘܥܐܠܝ ܠܗܢܐ ܚܘܕܪܐ ܒܫܡܐ ܒܕܘܟ ܗܝܝܘܬܐ.",
    "roomSettings.chooseHowThisRoomNotifiesYou": "ܓܒܝ ܐܝܟܢܐ ܗܢܐ ܓܘܡܐ ܡܘܕܥ ܠܘܟ.",
    "roomSettings.chooseHowThisSpaceNotifiesYou":
        "ܓܒܝ ܐܝܟܢܐ ܗܢܐ ܚܘܕܪܐ ܡܘܕܥ ܠܘܟ.",

    // src/lib/components/layout/ScreenSharePicker.svelte
    "screenSharePicker.chooseWhatToShare": "ܓܒܝ ܡܘܕܝ ܒܕ ܫܘܬܦܬ",
    "screenSharePicker.noPreview": "ܠܝܬ ܚܙܝܬܐ ܩܕܡܝܬܐ",

    // src/lib/components/layout/ScreenShareQualityChips.svelte
    "screenShareQualityChips.resolution": "ܦܫܝܩܘܬܐ",
    "screenShareQualityChips.frameRate": "ܡܢܝܢܐ ܕܨܘܪ̈ܝܬܐ",
    "screenShareQualityChips.fps": "{f} FPS",
    "screenShareQualityChips.shareSystemAudio": "ܫܘܬܦ ܩܠܐ ܕܣܝܣܛܡ",
    "screenShareQualityChips.appliesToNextShare": "ܦܠܚܐ ܥܠ ܫܘܬܦܘܬܐ ܒܬܪܝܬܐ",
    "screenShareQualityChips.shareSystemAudioAppliesToNext":
        "ܫܘܬܦ ܩܠܐ ܕܣܝܣܛܡ (ܦܠܚܐ ܥܠ ܫܘܬܦܘܬܐ ܒܬܪܝܬܐ)",

    // src/lib/components/layout/ScreenShareQualityPopover.svelte
    "screenShareQualityPopover.goLive": "ܫܪܝ ܚܝܐ",
    "screenShareQualityPopover.screenShareQuality": "ܐܝܢܝܘܬܐ ܕܫܘܬܦܘܬܐ ܕܡܚܙܝܬܐ",

    // src/lib/components/settings/SecuritySettings.svelte
    "securitySettings.showingTheLastReadingThatLoaded":
        "ܒܚܘܝܐ ܩܪܝܬܐ ܐܚܪܝܬܐ ܕܛܥܢܬܠܗ̇ - ܡܨܐ ܕܗܘܝܐ ܥܬܝܩܬܐ.",
    "securitySettings.securityEncryption": "ܫܠܡܘܬܐ ܘܛܘܫܝܐ",
    "securitySettings.setUpRecoverySoYourCross":
        "ܛܝܒ ܦܘܪܩܢܐ ܩܐ ܕܗܝܝܘܬܐ ܕܚܬܡܐ ܕܝܘܟ ܘܬܫܥܝܬܐ ܕܐܓܪ̈ܬܐ ܡܛܫܝ̈ܬܐ ܦܝܫܝ ܐܦܢ ܐܢ ܦܩܠܘܟ ܡܢ ܟܠ ܡܐܢ̈ܐ.",
    "securitySettings.verification": "ܫܘܪܪܐ",
    "securitySettings.loadingEncryptionStatus": "ܒܛܥܢܐ ܐܝܟܢܝܘܬܐ ܕܛܘܫܝܐ…",
    "securitySettings.encryptionStatusUnknownOnThisSession":
        "ܐܝܟܢܝܘܬܐ ܕܛܘܫܝܐ ܠܐ ܝܕܝܥܬܐ ܝܠܗ̇ ܒܗܢܐ ܓܠܣܐ.",
    "securitySettings.recoveryKeyId": "ܗܝܝܘܬܐ ܕܩܠܝܕܐ ܕܦܘܪܩܢܐ:",
    "securitySettings.setUpRecovery": "ܛܝܒ ܦܘܪܩܢܐ",
    "securitySettings.weLlCreateA": "ܒܕ ܒܪܝܚ",
    "securitySettings.recoveryKey": "ܩܠܝܕܐ ܕܦܘܪܩܢܐ",
    "securitySettings.aOneTimeCodeThatUnlocks":
        "- ܪܡܙܐ ܕܚܕ ܙܒܢܐ ܕܦܬܚ ܬܫܥܝܬܐ ܡܛܫܝܬܐ ܕܝܘܟ ܘܡܫܪܪ ܓܠܣ̈ܐ ܚܕ̈ܬܐ. ܢܛܘܪ ܠܗ ܒܕܘܟܐ ܫܠܝܡܬܐ ܐܝܟ ܡܕܒܪܢܐ ܕܡܠ̈ܐ ܕܥܒܪܐ؛ ܒܣ ܚܕ ܙܒܢܐ ܡܚܘܝܐ ܝܠܗ ܘܠܐ ܡܨܝܚ ܕܦܪܩܚ ܠܗ ܩܬܘܟ.",
    "securitySettings.confirmYourAccountPasswordToCreate":
        "ܫܪܪ ܡܠܬܐ ܕܥܒܪܐ ܕܚܘܫܒܢܐ ܕܝܘܟ ܩܐ ܒܪܝܐ ܕܩܠܝܕ̈ܐ ܕܛܘܫܝܐ.",
    "securitySettings.accountPassword": "ܡܠܬܐ ܕܥܒܪܐ ܕܚܘܫܒܢܐ",
    "securitySettings.alsoLetMeUnlockWithA":
        "ܗܒ ܠܝ ܦܣܐ ܕܦܬܚܢ ܒܦܬܓܡܐ ܕܓܒܢ ܒܕ (ܠܐ ܡܚܝܒܐ - ܩܠܝܕܐ ܕܦܘܪܩܢܐ ܗܠ ܗܫܐ ܦܠܚܐ ܘܡܚܘܝܐ ܝܠܗ).",
    "securitySettings.recoveryPassphrase": "ܦܬܓܡܐ ܕܦܘܪܩܢܐ",
    "securitySettings.atLeastCharactersWeCanT":
        "ܠܦܚܘܬ ܡܢ ܟܠ {MIN_PASSPHRASE_LENGTH} ܐܬ̈ܘܬܐ. ܠܐ ܡܨܝܚ ܕܚܕܬܚ ܠܗ ܩܬܘܟ.",
    "securitySettings.settingUp": "ܒܛܘܝܒܐ…",
    "securitySettings.continue": "ܦܘܫ ܠܩܕܡ",
    "securitySettings.saveYourRecoveryKey": "ܢܛܘܪ ܩܠܝܕܐ ܕܦܘܪܩܢܐ ܕܝܘܟ",
    "securitySettings.thisIsShown": "ܗܕܐ ܡܚܘܝܐ ܝܠܗ̇",
    "securitySettings.onlyOnce": "ܒܣ ܚܕ ܙܒܢܐ",
    "securitySettings.storeItNowWithoutItYou":
        ". ܢܛܘܪ ܠܗ̇ ܗܫܐ - ܕܠܐ ܕܝܗ̇ ܠܐ ܡܨܝܬ ܕܦܪܩܬ ܬܫܥܝܬܐ ܡܛܫܝܬܐ ܕܝܘܟ ܐܢ ܚܣܪܠܘܟ ܡܥܠܬܐ ܠܓܠܣ̈ܐ ܕܝܘܟ.",
    "securitySettings.copied": "ܢܣܝܚܐ ✓",
    "securitySettings.copyKey": "ܢܣܘܚ ܩܠܝܕܐ",
    "securitySettings.youCanAlsoUnlockWithThe":
        "ܡܨܝܬ ܐܦ ܕܦܬܚܬ ܒܦܬܓܡܐ ܕܓܒܝܠܘܟ. ܢܛܘܪ ܩܠܝܕܐ ܐܦܢ ܗܕܟܐ - ܗܘ ܝܠܗ ܐܘܪܚܐ ܝܚܝܕܝܬܐ ܐܢ ܛܥܝܠܘܟ ܦܬܓܡܐ.",
    "securitySettings.iVeSavedMyRecoveryKey":
        "ܢܛܝܪܠܝ ܩܠܝܕܐ ܕܦܘܪܩܢܐ ܕܝܝ ܒܕܘܟܐ ܫܠܝܡܬܐ.",
    "securitySettings.done": "ܫܠܡܠܗ",
    "securitySettings.recoveryIsSetUp": "ܦܘܪܩܢܐ ܡܛܘܝܒܐ ܝܠܗ",
    "securitySettings.yourCrossSigningKeysAndA":
        "ܩܠܝܕ̈ܐ ܕܚܬܡܐ ܕܝܘܟ ܘܢܘܣܚܐ ܕܒܣܬܪ ܕܩܠܝܕ̈ܐ ܢܛܝܪ̈ܐ ܝܢ ܒܫܠܡܘܬܐ ܥܠ ܣܝܪܒܪ، ܢܛܝܪ̈ܐ ܒܩܠܝܕܐ ܕܦܘܪܩܢܐ ܕܝܘܟ.",
    "securitySettings.recoveryIsNotSetUp": "ܦܘܪܩܢܐ ܠܐ ܝܠܗ ܡܛܘܝܒܐ",
    "securitySettings.thisAccountHasNoRecoveryKey":
        "ܗܢܐ ܚܘܫܒܢܐ ܠܝܬ ܠܗ ܩܠܝܕܐ ܕܦܘܪܩܢܐ ܘܠܐ ܢܘܣܚܐ ܕܒܣܬܪ ܕܩܠܝܕ̈ܐ ܗܕܝܡܐ ܕܡܫܠܡܬ ܕܪܓܐ ܕܠܬܚܬ.",
    "securitySettings.lostYourRecoveryKeyResetRecovery":
        "ܛܥܝܠܘܟ ܩܠܝܕܐ ܕܦܘܪܩܢܐ؟ ܚܕܬ ܦܘܪܩܢܐ",
    "securitySettings.resettingCreatesA": "ܚܘܕܬܐ ܒܪܝܐ",
    "securitySettings.new": "ܚܕܬܐ",
    "securitySettings.recoveryKeyAndReplacesYourCurrent":
        "ܩܠܝܕܐ ܕܦܘܪܩܢܐ ܘܫܚܠܦ ܢܘܣܚܐ ܕܒܣܬܪ ܗܫܝܐ ܕܝܘܟ. ܩܠܝܕܐ ܥܬܝܩܐ ܕܝܘܟ ܠܐ ܦܠܚ ܒܬܪ ܗܕܐ ܘܓܠܣ̈ܐ ܐܚܪ̈ܢܐ ܡܨܝܐ ܕܣܢܝܩܝ ܠܫܘܪܪܐ ܡܢ ܕܪܝܫ. ܥܒܘܕ ܗܕܐ ܒܣ ܐܢ ܛܥܝܠܘܟ ܩܠܝܕܐ ܗܫܝܐ.",
    "securitySettings.yourOldRecoveryKeyAndBackup":
        "ܩܠܝܕܐ ܥܬܝܩܐ ܕܦܘܪܩܢܐ ܘܢܘܣܚܐ ܕܒܣܬܪ ܡܚܘܕܬ̈ܐ ܝܢ، ܐܝܢܐ ܦܘܪܩܢܐ ܚܕܬܐ ܠܐ ܒܪܝܠܗ. ܫܠܡ ܛܘܝܒܐ ܕܝܗܝ ܗܫܐ - ܐܓܪ̈ܬܐ ܕܝܘܟ ܠܐ ܡܨܝܐ ܕܦܪܩܝ ܥܠ ܓܠܣܐ ܚܕܬܐ ܗܕܝܡܐ ܕܥܒܕܬ ܗܕܐ.",
    "securitySettings.working": "ܒܦܠܚܐ…",
    "securitySettings.finishSettingUpRecovery": "ܫܠܡ ܛܘܝܒܐ ܕܦܘܪܩܢܐ",
    "securitySettings.confirmYourAccountPasswordToReset":
        "ܫܪܪ ܡܠܬܐ ܕܥܒܪܐ ܕܚܘܫܒܢܐ ܕܝܘܟ ܩܐ ܚܘܕܬܐ ܕܦܘܪܩܢܐ.",
    "securitySettings.resetting": "ܒܚܘܕܬܐ…",
    "securitySettings.resetCreateNewKey": "ܚܕܬ ܘܒܪܝ ܩܠܝܕܐ ܚܕܬܐ",
    "securitySettings.messageHistoryBackup": "ܢܘܣܚܐ ܕܒܣܬܪ ܕܬܫܥܝܬܐ ܕܐܓܪ̈ܬܐ",
    "securitySettings.verifyThisSessionRestoreHistory":
        "ܫܪܪ ܗܢܐ ܓܠܣܐ ܘܕܥܘܪ ܬܫܥܝܬܐ",
    "securitySettings.recoveryKey2": "ܩܠܝܕܐ ܕܦܘܪܩܢܐ",
    "securitySettings.passphrase": "ܦܬܓܡܐ ܕܥܒܪܐ",
    "securitySettings.enterYour": "ܡܥܠ",
    "securitySettings.recoveryPassphrase2": "ܦܬܓܡܐ ܕܦܘܪܩܢܐ ܕܝܘܟ",
    "securitySettings.toVerifyThisSessionAndRestore":
        "ܩܐ ܫܘܪܪܐ ܕܗܢܐ ܓܠܣܐ ܘܕܥܪܬܐ ܕܬܫܥܝܬܐ ܕܐܓܪ̈ܬܐ ܡܛܫܝ̈ܬܐ ܕܝܘܟ.",
    "securitySettings.thisSessionIsNowVerified": "ܗܢܐ ܓܠܣܐ ܗܫܐ ܡܫܪܪܐ ܝܠܗ",
    "securitySettings.encryptedHistoryRestored": "ܬܫܥܝܬܐ ܡܛܫܝܬܐ ܕܥܝܪܬܐ ܝܠܗ̇",
    "securitySettings.couldNotSetUpRecovery": "ܛܘܝܒܐ ܕܦܘܪܩܢܐ ܠܐ ܦܠܚܠܗ",
    "securitySettings.couldNotResetRecovery": "ܚܘܕܬܐ ܕܦܘܪܩܢܐ ܠܐ ܦܠܚܠܗ̇",
    "securitySettings.couldNotFinishSettingUpRecovery":
        "ܫܘܠܡܐ ܕܛܘܝܒܐ ܕܦܘܪܩܢܐ ܠܐ ܦܠܚܠܗ",
    "securitySettings.couldNotVerifyThisSession": "ܫܘܪܪܐ ܕܗܢܐ ܓܠܣܐ ܠܐ ܦܠܚܠܗ",

    // src/lib/components/settings/ServerSettings.svelte
    "serverSettings.scanningServer": "ܒܒܨܝܐ ܣܝܪܒܪ…",
    "serverSettings.what": "ܡܐ ܕ",
    "serverSettings.advertisesItemsMarkedUnknownArenT":
        'ܡܘܕܥ. ܡܕܡ̈ܐ ܕܢܝܫ̈ܐ ܝܢ "ܠܐ ܝܕܝܥܐ" ܣܝܪܒܪ ܠܐ ܡܘܕܥ ܠܗܘܢ ܘܒܣ ܡܫܟܚܝ ܐܡܬܝ ܕܦܠܝܚ̈ܐ ܝܢ.',
    "serverSettings.accountMessaging": "ܚܘܫܒܢܐ ܘܐܓܪ̈ܬܐ",
    "serverSettings.voiceVideoCallingMatrixrtc":
        "ܩܪ̈ܝܬܐ ܕܩܠܐ / ܒܝܕܝܘ (MatrixRTC)",
    "serverSettings.server": "ܣܝܪܒܪ",
    "serverSettings.latestSpecVersion": "ܢܘܣܚܐ ܐܚܪܝܐ ܕܡܦܫܩܢܘܬܐ",
    "serverSettings.defaultRoomVersion": "ܢܘܣܚܐ ܥܕܝܠܐ ܕܓܘܡܐ",
    "serverSettings.advertisedFeatures": "ܡܢ̈ܘܬܐ ܡܘܕܥ̈ܬܐ ({length})",
    "serverSettings.supported": "ܡܣܘܥܝܐ",
    "serverSettings.notSupported": "ܠܐ ܡܣܘܥܝܐ",
    "serverSettings.unknown": "ܠܐ ܝܕܝܥܐ",
    "serverSettings.changePassword": "ܫܚܠܦ ܡܠܬܐ ܕܥܒܪܐ",
    "serverSettings.changeDisplayName": "ܫܚܠܦ ܫܡܐ ܕܚܙܝܐ",
    "serverSettings.changeAvatar": "ܫܚܠܦ ܨܘܪܬܐ",
    "serverSettings.manageEmailsPhoneNumbers": "ܕܒܪ ܐܝܡܝܠ / ܡܢܝܢ̈ܐ ܕܬܠܝܦܘܢ",
    "serverSettings.threads": "ܚܘ̈ܛܐ",
    "serverSettings.privateReadReceipts": "ܩܘܒܠ̈ܐ ܕܩܪܝܬܐ ܟܣܝ̈ܐ",
    "serverSettings.sfuDiscoveryRtcFoci": "ܡܫܟܚܢܘܬܐ ܕ SFU (rtc_foci)",
    "serverSettings.delayedEventsCallCleanup": "ܓܕܫ̈ܐ ܡܘܚܪ̈ܐ (ܕܘܟܝܐ ܕܩܪ̈ܝܬܐ)",
    "serverSettings.failedToReadServerCapabilities":
        "ܩܪܝܬܐ ܕܡܨܝܘ̈ܬܐ ܕܣܝܪܒܪ ܠܐ ܦܠܚܠܗ̇",

    // src/lib/components/settings/SessionSettings.svelte
    "sessionSettings.sessionName": "ܫܡܐ ܕܓܠܣܐ",
    "sessionSettings.current": "ܗܫܝܐ",
    "sessionSettings.rename": "ܫܚܠܦ ܫܡܐ",
    "sessionSettings.signOut": "ܦܘܩ؟",
    "sessionSettings.signOut2": "ܦܘܩ",
    "sessionSettings.confirmYourAccountPasswordToSign":
        "ܫܪܪ ܡܠܬܐ ܕܥܒܪܐ ܕܚܘܫܒܢܐ ܕܝܘܟ ܩܐ ܡܦܩܬܐ ܡܢ ܗܢܐ ܓܠܣܐ.",
    "sessionSettings.accountPassword": "ܡܠܬܐ ܕܥܒܪܐ ܕܚܘܫܒܢܐ",
    "sessionSettings.signingOut": "ܒܡܦܩܐ…",
    "sessionSettings.encryption": "ܛܘܫܝܐ",
    "sessionSettings.active": "ܦܥܝܠܐ",
    "sessionSettings.unavailable": "ܠܐ ܡܫܟܚܐ",
    "sessionSettings.thisDeviceSKey": "ܩܠܝܕܐ ܕܗܢܐ ܡܐܢܐ",
    "sessionSettings.loadingDeviceKey": "ܒܛܥܢܐ ܩܠܝܕܐ ܕܡܐܢܐ…",
    "sessionSettings.endToEndEncryptionCouldNot":
        "ܛܘܫܝܐ ܡܢ ܪܫܐ ܠܪܫܐ ܠܐ ܡܨܐ ܕܫܪܐ ܒܗܢܐ ܓܠܣܐ. ܓܘܡ̈ܐ ܡܛܫܝ̈ܐ ܒܕ ܡܚܘܝܐ ܕܘܟ̈ܝܬܐ ܣܦܝ̈ܩܬܐ.",
    "sessionSettings.encryptNewDirectMessages": "ܛܫܝ ܐܓܪ̈ܬܐ ܫܪܝܪ̈ܬܐ ܚܕ̈ܬܐ",
    "sessionSettings.newDmsYouStartAreEncrypted":
        "ܐܓܪ̈ܬܐ ܫܪܝܪ̈ܬܐ ܚܕ̈ܬܐ ܕܫܪܐ ܝܘܬ ܥܕܝܠܐܝܬ ܡܛܫܝ̈ܬܐ ܝܢ. ܐܓܪ̈ܬܐ ܕܐܝܬ ܠܐ ܫܚܠܦܝ. ܛܦܝ ܗܕܐ ܐܢ ܫܕܪܐ ܝܘܬ ܠܢܫ̈ܐ ܕܬܘܟܢܝܬܐ ܕܝܗܘܢ ܠܐ ܡܣܝܥܐ ܛܘܫܝܐ.",
    "sessionSettings.onlySendToVerifiedDevices": "ܫܕܪ ܒܣ ܠܡܐܢ̈ܐ ܡܫܪܪ̈ܐ",
    "sessionSettings.refuseToEncryptMessagesForSessions":
        "ܠܐ ܛܫܝ ܐܓܪ̈ܬܐ ܩܐ ܓܠܣ̈ܐ ܕܠܐ ܫܪܪܠܘܟ. ܐܢܝ̈ ܠܐ ܒܕ ܩܒܠܝ ܐܓܪ̈ܬܐ ܕܝܘܟ ܒܟܠ - ܐܦ ܓܠܣ̈ܐ ܕܝܘܟ ܕܠܐ ܡܫܪܪ̈ܐ. ܥܕܝܠܐܝܬ ܛܦܝܐ ܝܠܗ.",
    "sessionSettings.devicesCurrentlySignedInToThis":
        "ܡܐܢ̈ܐ ܕܥܠܝܠ̈ܐ ܝܢ ܗܫܐ ܠܗܢܐ ܚܘܫܒܢܐ.",
    "sessionSettings.refreshing": "ܒܚܘܕܬܐ…",
    "sessionSettings.refresh": "ܚܕܬ",
    "sessionSettings.loadingSessions": "ܒܛܥܢܐ ܓܠܣ̈ܐ…",
    "sessionSettings.otherSessions": "ܓܠܣ̈ܐ ܐܚܪ̈ܢܐ {value}",
    "sessionSettings.noOtherSessionsYouReOnly":
        "ܠܝܬ ܓܠܣ̈ܐ ܐܚܪ̈ܢܐ - ܒܣ ܗܪܟܐ ܥܠܝܠܐ ܝܘܬ.",
    "sessionSettings.failedToLoadSessions": "ܛܥܢܐ ܕܓܠܣ̈ܐ ܠܐ ܦܠܚܠܗ",
    "sessionSettings.failedToRenameSession": "ܫܘܚܠܦܐ ܕܫܡܐ ܕܓܠܣܐ ܠܐ ܦܠܚܠܗ",
    "sessionSettings.failedToSignOutSession": "ܡܦܩܬܐ ܡܢ ܓܠܣܐ ܠܐ ܦܠܚܠܗ̇",
    "sessionSettings.couldNotStartVerification": "ܫܘܪܝܐ ܕܫܘܪܪܐ ܠܐ ܦܠܚܠܗ",

    // src/lib/components/messages/ShareLocationDialog.svelte
    "shareLocationDialog.shareLocation": "ܫܘܬܦ ܕܘܟܬܐ",
    "shareLocationDialog.sendOnce": "ܫܕܪ ܚܕ ܙܒܢܐ",
    "shareLocationDialog.shareLive": "ܫܘܬܦ ܚܝܐ",
    "shareLocationDialog.locating": "ܒܡܫܟܚܐ ܕܘܟܬܐ…",
    "shareLocationDialog.useMyCurrentLocation": "ܦܠܚ ܒܕܘܟܬܐ ܗܫܝܬܐ ܕܝܝ",
    "shareLocationDialog.descriptionOptional": "ܬܘܪܓܡܐ (ܠܐ ܡܚܝܒܐ)",
    "shareLocationDialog.eGHomeTheCafOn": "ܡܬܠܐ: ܒܝܬܐ، ܩܗܘܐ ܕܫܘܩܐ 5…",
    "shareLocationDialog.duration": "ܡܘܬܚܐ",
    "shareLocationDialog.yourLiveLocationIsSharedWith":
        "ܕܘܟܬܐ ܚܝܬܐ ܕܝܘܟ ܡܫܘܬܦܬܐ ܝܠܗ̇ ܥܡ ܗܢܐ ܓܘܡܐ ܗܕܝܡܐ ܕܦܣܩܬ ܝܢ ܙܒܢܐ ܡܛܐ ܠܫܘܠܡܐ.",
    "shareLocationDialog.sharing": "ܒܫܘܬܦܐ…",
    "shareLocationDialog.share": "ܫܘܬܦ",
    "shareLocationDialog.failedToStartLiveLocation":
        "ܫܘܪܝܐ ܕܕܘܟܬܐ ܚܝܬܐ ܠܐ ܦܠܚܠܗ",
    "shareLocationDialog.failedToShareLocation": "ܫܘܬܦܘܬܐ ܕܕܘܟܬܐ ܠܐ ܦܠܚܠܗ̇",

    // src/lib/components/messages/ShareTargetSheet.svelte
    "shareTargetSheet.fileSWerenTAddedShares":
        "{droppedFiles} ܦܐܝܠ̈ܐ ܠܐ ܡܘܣܦ̈ܐ ܝܢ. ܫܘܬܦܘ̈ܬܐ ܡܚܘܕܕ̈ܐ ܝܢ ܠ {SHARE_MAX_FILES} ܦܐܝܠ̈ܐ، {value} MB ܟܠ ܚܕ ܘ {value2} MB ܒܟܠܗ.",
    "shareTargetSheet.addAMessage": "ܐܘܣܦ ܐܓܪܬܐ…",
    "shareTargetSheet.searchRooms": "ܒܨܝ ܓܘܡ̈ܐ",
    "shareTargetSheet.noJoinedRoomsFound": "ܠܐ ܦܝܫܝ ܡܫܟܚܐ ܓܘܡ̈ܐ ܕܥܠܝܠܘܟ ܓܘܝܗܝ",
    "shareTargetSheet.send": "ܫܕܪ",
    "shareTargetSheet.shareToARoom": "ܫܘܬܦ ܠܓܘܡܐ",

    // src/lib/components/layout/SpaceLandingPanel.svelte
    "spaceLandingPanel.loadingRooms": "ܒܛܥܢܐ ܓܘܡ̈ܐ…",
    "spaceLandingPanel.browseRooms": "ܒܨܝ ܓܘܡ̈ܐ",
    "spaceLandingPanel.youHavenTJoinedARoom":
        "ܗܠ ܗܫܐ ܠܐ ܥܠܝܠܘܟ ܠܓܘܡܐ ܓܘ {spaceName}. ܓܒܝ ܚܕ ܩܐ ܫܘܪܝܐ.",
    "spaceLandingPanel.nothingJoinedHereYet": "ܗܠ ܗܫܐ ܠܐ ܥܠܝܠܘܟ ܠܡܕܡ ܗܪܟܐ",
    "spaceLandingPanel.onlyOtherSpacesLiveInsideOpen":
        "ܒܣ ܚܘܕܪ̈ܐ ܐܚܪ̈ܢܐ ܐܝܬ ܓܘ {spaceName}، ܦܬܘܚ ܚܕ ܡܢ ܪܫܝܡܬܐ ܕܓܘܡ̈ܐ ܩܐ ܒܨܝܐ ܕܓܘܡ̈ܐ ܕܝܗܝ.",
    "spaceLandingPanel.thereAreNoRoomsInYet": "ܠܝܬ ܓܘܡ̈ܐ ܓܘ {spaceName} ܗܠ ܗܫܐ.",
    "spaceLandingPanel.thisSpace": "ܗܢܐ ܚܘܕܪܐ",
    "spaceLandingPanel.couldnTJoinTryItFrom":
        'ܥܠܠܐ ܠ{value} ܠܐ ܦܠܚܠܗ. ܢܣܝ ܡܢ "ܒܨܝ ܓܘܡ̈ܐ" ܓܘ ܪܫܝܡܬܐ ܕܓܘܡ̈ܐ.',
    "spaceLandingPanel.thatRoom": "ܗܘ ܓܘܡܐ",

    // src/lib/components/layout/SpaceSidebar.svelte
    "spaceSidebar.home": "ܒܝܬܐ",
    "spaceSidebar.addASpace": "ܐܘܣܦ ܚܘܕܪܐ",
    "spaceSidebar.exploreRooms": "ܒܨܝ ܓܘܡ̈ܐ",
    "spaceSidebar.folderColor": "ܓܘܢܐ ܕܟܝܣܬܐ",
    "spaceSidebar.createRoomInSpace": "ܒܪܝ ܓܘܡܐ ܓܘ ܚܘܕܪܐ",
    "spaceSidebar.roomName": "ܫܡܐ ܕܓܘܡܐ",
    "spaceSidebar.myRoom": "my-room",
    "spaceSidebar.optional": "(ܠܐ ܡܚܝܒܐ)",
    "spaceSidebar.whatSThisRoomAbout": "ܥܠ ܡܘܕܝ ܝܠܗ ܗܢܐ ܓܘܡܐ؟",
    "spaceSidebar.opensStraightIntoACallMessages":
        "ܦܬܚ ܫܪܝܪܐܝܬ ܓܘ ܩܪܝܬܐ. ܐܓܪ̈ܬܐ ܗܠ ܗܫܐ ܦܠܚܝ.",
    "spaceSidebar.create": "ܒܪܝ",
    "spaceSidebar.addExistingRoomToSpace": "ܐܘܣܦ ܓܘܡܐ ܕܐܝܬ ܠܚܘܕܪܐ",
    "spaceSidebar.noRoomsAvailableToAdd": "ܠܝܬ ܓܘܡ̈ܐ ܩܐ ܐܘܣܦܬܐ.",
    "spaceSidebar.spaceSettings": "ܛܘܝܒ̈ܐ ܕܚܘܕܪܐ",
    "spaceSidebar.copySpaceLink": "ܢܣܘܚ ܐܣܘܪܐ ܕܚܘܕܪܐ",
    "spaceSidebar.markAsRead": "ܢܝܫ ܐܝܟ ܩܪܝܐ",
    "spaceSidebar.createRoom": "ܒܪܝ ܓܘܡܐ",
    "spaceSidebar.addExistingRoom": "ܐܘܣܦ ܓܘܡܐ ܕܐܝܬ",
    "spaceSidebar.removeFromFolder": "ܫܩܘܠ ܡܢ ܟܝܣܬܐ",
    "spaceSidebar.newFolder": "ܟܝܣܬܐ ܚܕܬܐ",
    "spaceSidebar.clickAgainToLeave": "ܕܥܘܨ ܡܢ ܕܪܝܫ ܩܐ ܫܒܩܐ",
    "spaceSidebar.leaveSpace": "ܫܒܘܩ ܚܘܕܪܐ",
    "spaceSidebar.setColor": "ܛܝܒ ܓܘܢܐ",
    "spaceSidebar.dissolveFolder": "ܦܪܘܩ ܟܝܣܬܐ",
    "spaceSidebar.somethingWentWrong": "ܡܕܡ ܠܐ ܦܠܚܠܗ",

    // src/lib/components/layout/Splash.svelte
    "splash.restoringSession": "ܒܕܥܪܐ ܓܠܣܐ…",

    // src/lib/components/ui/StickerPicker.svelte
    "stickerPicker.searchStickers": "ܒܨܝ ܢܩܦ̈ܬܐ…",
    "stickerPicker.searchStickers2": "ܒܨܝ ܢܩܦ̈ܬܐ",
    "stickerPicker.noStickerPacksAvailable": "ܠܝܬ ܟܢܘܫܝ̈ܐ ܕܢܩܦ̈ܬܐ",
    "stickerPicker.myStickers": "ܢܩܦ̈ܬܐ ܕܝܝ",
    "stickerPicker.myStickers2": "ܢܩܦ̈ܬܐ ܕܝܝ",

    // src/lib/components/ui/SwfEmbed.svelte
    "swfEmbed.adobeFlash": "Adobe Flash",

    // src/lib/components/settings/ThemeColorEditor.svelte
    "themeColorEditor.themeColors": "ܓܘܢ̈ܐ ܕܬܚܙܝܬܐ",
    "themeColorEditor.presetName": "ܫܡܐ ܕܬܚܙܝܬܐ",
    "themeColorEditor.savePreset": "ܢܛܘܪ ܬܚܙܝܬܐ",
    "themeColorEditor.import": "ܡܥܠ",
    "themeColorEditor.pasteThemeCode": "ܕܒܘܩ ܪܡܙܐ ܕܬܚܙܝܬܐ",
    "themeColorEditor.copyCurrentPresetToClipboard":
        "ܢܣܘܚ ܬܚܙܝܬܐ ܗܫܝܬܐ ܠܦܢܩܝܬܐ",
    "themeColorEditor.copied": "ܢܣܝܚܐ!",
    "themeColorEditor.presets": "ܬܚܙܝ̈ܬܐ",
    "themeColorEditor.delete": "ܫܘܦ؟",
    "themeColorEditor.confirmDelete": "ܫܪܪ ܫܝܦܬܐ ܕ{name}",
    "themeColorEditor.rename": "ܫܚܠܦ ܫܡܐ",
    "themeColorEditor.delete2": "ܫܘܦ {name}",
    "themeColorEditor.builtInPresetsAreReadOnly":
        "ܬܚܙܝ̈ܬܐ ܕܓܘ ܬܘܟܢܝܬܐ ܒܣ ܩܐ ܩܪܝܬܐ ܝܢ. ܥܒܘܕ ܢܘܣܚܐ ܩܐ ܫܘܚܠܦܐ:",
    "themeColorEditor.duplicateToCustomize": "ܥܒܘܕ ܢܘܣܚܐ ܩܐ ܫܘܚܠܦܐ",
    "themeColorEditor.colors": "ܓܘܢ̈ܐ",
    "themeColorEditor.backgrounds": "ܒܣܬܪ̈ܐ",
    "themeColorEditor.resetToDefault": "ܕܥܘܪ ܠܥܕܝܠܐ",
    "themeColorEditor.text": "ܟܬܒܐ",
    "themeColorEditor.accentsSemantics": "ܓܘܢ̈ܐ ܪܫܝ̈ܐ ܘܣܘܟܠ̈ܐ",
    "themeColorEditor.presence": "ܐܝܬܝܘܬܐ",
    "themeColorEditor.details": "ܦܪ̈ܝܛܐ",
    "themeColorEditor.contrastWarnings": "ܙܘܗܪ̈ܐ ܕܦܘܪܫܐ",
    "themeColorEditor.messageDisplay": "ܚܘܝܐ ܕܐܓܪ̈ܬܐ",
    "themeColorEditor.savedOnThisDeviceOnlyNot":
        "ܢܛܝܪܐ ܒܣ ܥܠ ܗܢܐ ܡܐܢܐ. ܠܐ ܐܚܝܕܐ ܝܠܗ ܥܡ ܚܘܫܒܢܐ ܕܝܘܟ.",
    "themeColorEditor.appTextSize": "ܡܫܘܚܬܐ ܕܟܬܒܐ ܕܬܘܟܢܝܬܐ: {round}%",
    "themeColorEditor.scalesAllTextAndSpacingAcross":
        "ܡܫܚܠܦ ܡܫܘܚܬܐ ܕܟܠ ܟܬܒܐ ܘܦܘܪܫܐ ܒܟܠܗ̇ ܬܘܟܢܝܬܐ.",
    "themeColorEditor.font": "ܛܘܦܣܐ ܕܐܬ̈ܘܬܐ",
    "themeColorEditor.custom": "ܦܪܨܘܦܝܐ - {customFontName}",
    "themeColorEditor.replaceCustomFont": "ܫܚܠܦ ܛܘܦܣܐ ܦܪܨܘܦܝܐ ܕܐܬ̈ܘܬܐ…",
    "themeColorEditor.uploadCustomFont": "ܐܣܩ ܛܘܦܣܐ ܦܪܨܘܦܝܐ ܕܐܬ̈ܘܬܐ…",
    "themeColorEditor.woff2TtfOrOtfUpTo":
        "‎.woff2، .ttf ܝܢ .otf ܗܕܝܡܐ 10 MB. ܢܛܝܪܐ ܒܣ ܥܠ ܗܢܐ ܡܐܢܐ.",
    "themeColorEditor.theQuickBrownFoxJumpsOver":
        "ܬܥܠܐ ܣܡܘܩܐ ܙܪܝܙܐ ܫܘܪܐ ܥܠ ܟܠܒܐ ܚܒܝܢܐ.",
    "themeColorEditor.cannotSavePreset": "ܠܐ ܦܝܫ ܢܛܪܐ ܬܚܙܝܬܐ",
    "themeColorEditor.notAValidThemeCode": "ܠܐ ܝܠܗ ܪܡܙܐ ܬܪܝܨܐ ܕܬܚܙܝܬܐ",
    "themeColorEditor.imported": "ܡܥܠܝܐ",
    "themeColorEditor.cannotImportPreset": "ܠܐ ܦܝܫ ܡܥܠܐ ܬܚܙܝܬܐ",
    "themeColorEditor.copy": "{activePresetName} (ܢܘܣܚܐ)",

    // src/lib/components/layout/ThreadPanel.svelte
    "threadPanel.thread": "ܚܘܛܐ",
    "threadPanel.collapseThread": "ܟܢܘܫ ܚܘܛܐ",
    "threadPanel.expandThread": "ܦܪܘܣ ܚܘܛܐ",
    "threadPanel.closeThread": "ܣܟܘܪ ܚܘܛܐ",
    "threadPanel.noRepliesYetStartTheThread":
        "ܠܝܬ ܦܢܝ̈ܬܐ ܗܠ ܗܫܐ. ܫܪܝ ܚܘܛܐ ܠܬܚܬ.",
    "threadPanel.loadOlderReplies": "ܛܥܘܢ ܦܢܝ̈ܬܐ ܥܬܝܩ̈ܬܐ",

    // src/lib/components/layout/ThreadsListPanel.svelte
    "threadsListPanel.threads": "ܚܘ̈ܛܐ",
    "threadsListPanel.closeThreadsPanel": "ܣܟܘܪ ܦܢܝܬܐ ܕܚܘ̈ܛܐ",
    "threadsListPanel.noThreadsInThisRoomYet": "ܠܝܬ ܚܘ̈ܛܐ ܓܘ ܗܢܐ ܓܘܡܐ ܗܠ ܗܫܐ.",
    "threadsListPanel.youParticipated": "ܫܘܬܦܠܘܟ",
    "threadsListPanel.unreadMentions": "ܕܘܟܪܢ̈ܐ ܕܠܐ ܩܪܝ̈ܐ",
    "threadsListPanel.unreadReplies": "ܦܢܝ̈ܬܐ ܕܠܐ ܩܪܝ̈ܐ",
    "threadsListPanel.couldnTLoadThreadsForThis":
        "ܛܥܢܐ ܕܚܘ̈ܛܐ ܕܗܢܐ ܓܘܡܐ ܠܐ ܦܠܚܠܗ.",

    // src/lib/components/layout/UpdateBanner.svelte
    "updateBanner.dismissUpdateNotification": "ܫܩܘܠ ܡܘܕܥܢܘܬܐ ܕܚܘܕܬܐ",
    "updateBanner.installFailed": "ܢܨܒܬܐ ܠܐ ܦܠܚܠܗ̇",

    // src/lib/components/ui/UserPicker.svelte
    "userPicker.remove": "ܫܩܘܠ {userId}",
    "userPicker.searching": "ܒܒܨܝܐ…",
    "userPicker.noMatchingUsers": "ܠܝܬ ܡܦܠܚܢ̈ܐ ܕܡܙܕܘܓܝ",
    "userPicker.available":
        "{optionCount, plural, one {# ܦܠܛܐ ܐܝܬ} other {# ܦܠܛ̈ܐ ܐܝܬ}}",
    "userPicker.invite": "ܙܡܢ {candidateShown}",
    "userPicker.alreadyAdded": "ܡܘܣܦܐ ܝܠܗ",
    "userPicker.alreadyInThisRoom": "ܐܝܬܠܗ ܓܘ ܗܢܐ ܓܘܡܐ",
    "userPicker.sendAnInviteToThisExact": "ܫܕܪ ܙܘܡܢܐ ܠܗܕܐ ܗܝܝܘܬܐ ܕܡܦܠܚܢܐ ܚܬܝܬܐ",
    "userPicker.noMatchesTypeAFullUser":
        "ܠܝܬ ܡܙܕܘܓܘ̈ܬܐ. ܟܬܘܒ ܗܝܝܘܬܐ ܫܠܡܬܐ ܕܡܦܠܚܢܐ ܐܝܟ",
    "userPicker.userServer": "@user:server",
    "userPicker.toInviteSomeoneTheDirectoryDoesn":
        "ܩܐ ܙܘܡܢܐ ܕܚܕ ܢܫܐ ܕܕܪܓܐ ܠܐ ܡܚܘܐ.",
    "userPicker.searchForPeople": "ܒܨܝ ܢܫ̈ܐ…",
    "userPicker.userSearchFailedYouCanStill":
        "ܒܘܨܝܐ ܕܡܦܠܚܢ̈ܐ ܠܐ ܦܠܚܠܗ - ܗܠ ܗܫܐ ܡܨܝܬ ܡܥܠܬ ܗܝܝܘܬܐ ܫܠܡܬܐ ܕܡܦܠܚܢܐ.",

    // src/lib/components/ui/UserProfileCard.svelte
    "userProfileCard.copyUserId": "ܢܣܘܚ ܗܝܝܘܬܐ ܕܡܦܠܚܢܐ",
    "userProfileCard.copied": "ܢܣܝܚܐ",
    "userProfileCard.localTime": "{localTime} ܙܒܢܐ ܕܐܬܪܐ ({timezone})",
    "userProfileCard.notAMemberOfThisRoom": "ܠܐ ܝܠܗ ܗܕܡܐ ܕܗܢܐ ܓܘܡܐ",
    "userProfileCard.mutualRooms": "ܓܘܡ̈ܐ ܓܘܢܝ̈ܐ: {total}",
    "userProfileCard.more": "+{moreCount} ܝܬܝܪ",
    "userProfileCard.opening": "ܒܦܬܚܐ…",
    "userProfileCard.message": "ܐܓܪܬܐ",
    "userProfileCard.verifyUser": "ܫܪܪ ܡܦܠܚܢܐ",
    "userProfileCard.kicking": "ܒܛܪܕܐ…",
    "userProfileCard.confirmKick": "ܫܪܪ ܛܪܕܐ؟",
    "userProfileCard.kick": "ܛܪܘܕ",
    "userProfileCard.banning": "ܒܐܣܪܐ…",
    "userProfileCard.confirmBan": "ܫܪܪ ܐܣܪܐ؟",
    "userProfileCard.ban": "ܐܣܘܪ",
    "userProfileCard.couldNotStartVerification": "ܫܘܪܝܐ ܕܫܘܪܪܐ ܠܐ ܦܠܚܠܗ",
    "userProfileCard.couldNotCopyToClipboard": "ܢܣܚܐ ܠܦܢܩܝܬܐ ܠܐ ܦܠܚܠܗ",
    "userProfileCard.couldNotOpenDm": "ܦܬܚܐ ܕܐܓܪܬܐ ܫܪܝܪܬܐ ܠܐ ܦܠܚܠܗ",
    "userProfileCard.couldNotKick": "ܛܪܕܐ ܠܐ ܦܠܚܠܗ",
    "userProfileCard.couldNotBan": "ܐܣܪܐ ܠܐ ܦܠܚܠܗ",

    // src/lib/components/layout/VerificationModal.svelte
    "verificationModal.thisSessionIsNowTrusted": "ܗܢܐ ܓܠܣܐ ܗܫܐ ܬܟܝܠܐ ܝܠܗ.",
    "verificationModal.theirIdentityIsNowVerified":
        "ܗܝܝܘܬܐ ܕܝܗܘܢ ܗܫܐ ܡܫܪܪܬܐ ܝܠܗ̇.",
    "verificationModal.noTrustWasEstablishedYouCan":
        "ܬܘܟܠܢܐ ܠܐ ܩܝܡܠܗ. ܡܨܝܬ ܕܫܪܝܬ ܡܢ ܕܪܝܫ ܒܟܠ ܙܒܢܐ.",
    "verificationModal.didYourOtherSessionJustScan":
        "ܓܠܣܐ ܐܚܪܢܐ ܕܝܘܟ ܗܫܐ ܒܨܝܠܗ ܠܗܢܐ ܪܡܙܐ؟",
    "verificationModal.didJustScanThisCode":
        "{otherUserId} ܗܫܐ ܒܨܝܠܗ ܠܗܢܐ ܪܡܙܐ؟",
    "verificationModal.onlyConfirmIfYouScannedIt":
        "ܫܪܪ ܒܣ ܐܢ ܐܢܬ ܒܨܝܠܘܟ ܠܗ، ܗܫܐ.",
    "verificationModal.onlyConfirmIfYouWatchedThem":
        "ܫܪܪ ܒܣ ܐܢ ܚܙܝܠܘܟ ܠܗܘܢ ܕܒܨܝܠܗܘܢ ܠܗ، ܗܫܐ.",
    "verificationModal.no": "ܠܐ",
    "verificationModal.yesIScannedIt": "ܐܝܢ، ܒܨܝܠܝ ܠܗ",
    "verificationModal.deviceWithThisUser": "ܡܐܢܐ ܥܡ ܗܢܐ ܡܦܠܚܢܐ",
    "verificationModal.confirmTheSameEmojiAppearIn":
        "ܫܪܪ ܕܐܝܡܘܓܝ ܗܕܟܐ ܚܙܝܐ ܝܢ، ܒܣܘܕܪܐ ܗܕܟܐ، ܥܠ {value} ܐܚܪܢܐ ܕܝܘܟ.",
    "verificationModal.theyDonTMatch": "ܠܐ ܡܙܕܘܓܝ",
    "verificationModal.confirming": "ܒܫܘܪܪܐ…",
    "verificationModal.theyMatch": "ܡܙܕܘܓܝ",
    "verificationModal.verificationCodeForYourOtherSession":
        "ܪܡܙܐ ܕܫܘܪܪܐ ܩܐ ܓܠܣܐ ܐܚܪܢܐ ܕܝܘܟ",
    "verificationModal.verificationCodeFor": "ܪܡܙܐ ܕܫܘܪܪܐ ܩܐ {otherUserId}",
    "verificationModal.scanThisWithYourOtherSession":
        "ܒܨܝ ܗܕܐ ܒܓܠܣܐ ܐܚܪܢܐ ܕܝܘܟ.",
    "verificationModal.askThemToScanThisCode": "ܫܐܘܠ ܡܢܝܗܝ ܕܒܨܝ ܗܢܐ ܪܡܙܐ.",
    "verificationModal.noCodeToShowRightNow": "ܠܝܬ ܪܡܙܐ ܩܐ ܚܘܝܐ ܗܫܐ.",
    "verificationModal.couldNotLoadTheScanner": "ܛܥܢܐ ܕܒܨܝܢܐ ܠܐ ܦܠܚܠܗ.",
    "verificationModal.scanAgain": "ܒܨܝ ܡܢ ܕܪܝܫ",
    "verificationModal.compareAShortListOfEmoji":
        "ܦܚܘܡ ܪܫܝܡܬܐ ܟܪܝܬܐ ܕܐܝܡܘܓܝ ܩܐ ܫܘܪܪܐ، ܝܢ ܦܠܚ ܒܪܡܙܐ ܕ QR.",
    "verificationModal.compareEmoji": "ܦܚܘܡ ܐܝܡܘܓܝ",
    "verificationModal.showACodeForTheOther": "ܚܘܝ ܪܡܙܐ ܩܐ ܓܢܒܐ ܐܚܪܢܐ ܕܒܨܝ",
    "verificationModal.scanTheirCodeWithTheCamera": "ܒܨܝ ܪܡܙܐ ܕܝܗܘܢ ܒܟܡܪܐ",
    "verificationModal.chooseADifferentMethod": "ܓܒܝ ܐܘܪܚܐ ܐܚܪܬܐ",
    "verificationModal.waitingForTheOtherSideTo": "ܒܢܛܪܐ ܩܐ ܓܢܒܐ ܐܚܪܢܐ ܕܫܪܪ…",
    "verificationModal.verifyYourOtherSession": "ܫܪܪ ܓܠܣܐ ܐܚܪܢܐ ܕܝܘܟ",
    "verificationModal.verify": "ܫܪܪ {value}",
    "verificationModal.couldNotConfirmTheMatch": "ܫܘܪܪܐ ܕܙܘܘܓܐ ܠܐ ܦܠܚܠܗ",
    "verificationModal.couldNotReportTheMismatch":
        "ܡܘܕܥܢܘܬܐ ܕܠܐ ܙܘܘܓܐ ܠܐ ܦܠܚܠܗ̇",
    "verificationModal.session": "ܓܠܣܐ",

    // src/lib/components/layout/VideoTile.svelte
    "videoTile.fullscreen": "ܡܚܙܝܬܐ ܫܠܡܬܐ",

    // src/lib/components/settings/VoiceAudioSettings.svelte
    "voiceAudioSettings.inputDevice": "ܡܐܢܐ ܕܡܥܠܢܐ",
    "voiceAudioSettings.savedMicrophoneNotFoundUsingThe":
        "ܡܝܩܪܘܦܘܢ ܢܛܝܪܐ ܠܐ ܦܝܫܐ ܡܫܟܚܐ - ܒܦܠܚܐ ܒܥܕܝܠܐ ܗܕܝܡܐ ܕܕܥܪ.",
    "voiceAudioSettings.microphoneLevel": "ܕܪܓܐ ܕܡܝܩܪܘܦܘܢ",
    "voiceAudioSettings.stopTest": "ܦܣܘܩ ܒܘܚܢܐ",
    "voiceAudioSettings.testMic": "ܒܚܘܢ ܡܝܩܪܘܦܘܢ",
    "voiceAudioSettings.outputDevice": "ܡܐܢܐ ܕܡܦܩܢܐ",
    "voiceAudioSettings.chooseOutputDevice": "ܓܒܝ ܡܐܢܐ ܕܡܦܩܢܐ…",
    "voiceAudioSettings.audioOutputIsRoutedByThe":
        "ܡܦܩܢܐ ܕܩܠܐ ܡܕܒܪܐ ܝܠܗ ܒܝܕ ܣܝܣܛܡ ܥܠ ܗܕܐ ܐܣܬܐ.",
    "voiceAudioSettings.testSpeaker": "ܒܚܘܢ ܡܫܡܥܢܐ",
    "voiceAudioSettings.callVolume": "ܪܡܘܬܐ ܕܩܠܐ ܕܩܪܝܬܐ",
    "voiceAudioSettings.incomingCallAudio": "ܩܠܐ ܕܩܪܝܬܐ ܕܐܬܝܐ",
    "voiceAudioSettings.incomingCallAudioIfThisMoves":
        "ܩܠܐ ܕܩܪܝܬܐ ܕܐܬܝܐ - ܐܢ ܗܕܐ ܙܝܥܐ ܐܝܢܐ ܠܐ ܫܡܥܐ ܝܘܬ ܡܕܡ، ܒܨܝ ܡܐܢܐ ܕܡܦܩܢܐ ܓܒܝܐ ܘܪܡܘܬܐ ܕܩܠܐ ܕܣܝܣܛܡ.",
    "voiceAudioSettings.voiceProcessing": "ܣܘܥܪܢܐ ܕܩܠܐ",
    "voiceAudioSettings.noiseSuppression": "ܒܨܘܪܐ ܕܩܠ̈ܐ ܕܒܣܬܪ",
    "voiceAudioSettings.echoCancellation": "ܒܘܛܠܐ ܕܩܠܐ ܕܗܦܟ",
    "voiceAudioSettings.autoGainControl": "ܡܕܒܪܢܘܬܐ ܐܘܛܘܡܛܝܩܝܬܐ ܕܪܡܘܬܐ",
    "voiceAudioSettings.camera": "ܟܡܪܐ",
    "voiceAudioSettings.mirrorMyCamera": "ܚܘܝ ܟܡܪܐ ܕܝܝ ܐܝܟ ܡܚܙܝܬܐ",
    "voiceAudioSettings.flipYourOwnPreviewOthersAlways":
        "ܗܦܘܟ ܚܙܝܬܐ ܩܕܡܝܬܐ ܕܝܘܟ. ܐܚܪ̈ܢܐ ܟܠ ܙܒܢܐ ܚܙܝ ܠܘܟ ܕܠܐ ܗܦܟܐ.",
    "voiceAudioSettings.stopPreview": "ܦܣܘܩ ܚܙܝܬܐ ܩܕܡܝܬܐ",
    "voiceAudioSettings.preview": "ܚܙܝܬܐ ܩܕܡܝܬܐ",
    "voiceAudioSettings.callSounds": "ܩܠ̈ܐ ܕܩܪ̈ܝܬܐ",
    "voiceAudioSettings.playCallSounds": "ܦܠܚ ܩܠ̈ܐ ܕܩܪ̈ܝܬܐ",
    "voiceAudioSettings.soundVolume": "ܪܡܘܬܐ ܕܩܠܐ",
    "voiceAudioSettings.ringing": "ܩܪܝܬܐ",
    "voiceAudioSettings.ringForIncomingDmCalls":
        "ܩܪܝ ܩܐ ܩܪ̈ܝܬܐ ܕܐܬܝܢ ܡܢ ܐܓܪ̈ܬܐ ܫܪܝܪ̈ܬܐ",
    "voiceAudioSettings.directMessagesRingRoomsNeverDo":
        "ܐܓܪ̈ܬܐ ܫܪܝܪ̈ܬܐ ܩܪܝܐ ܝܢ. ܓܘܡ̈ܐ ܠܐ ܩܪܝ ܒܟܠ - ܥܐܠܬ ܠܐܢܝ̈ ܡܢ ܓܘܡܐ ܓܢܗ.",
    "voiceAudioSettings.ringtoneVolume": "ܪܡܘܬܐ ܕܩܠܐ ܕܩܪܝܬܐ",
    "voiceAudioSettings.microphoneUnavailableCheckBrowserPermissions":
        "ܡܝܩܪܘܦܘܢ ܠܐ ܡܫܟܚܐ - ܒܨܝ ܦܣ̈ܐ ܕܡܦܐܬܢܐ",
    "voiceAudioSettings.cameraUnavailableCheckBrowserPermissions":
        "ܟܡܪܐ ܠܐ ܡܫܟܚܬܐ - ܒܨܝ ܦܣ̈ܐ ܕܡܦܐܬܢܐ",

    // src/lib/components/layout/VoiceCallPanel.svelte
    "voiceCallPanel.enableAudio": "ܕܠܩ ܩܠܐ",
    "voiceCallPanel.openCallView": "ܦܬܘܚ ܚܙܝܬܐ ܕܩܪܝܬܐ",
    "voiceCallPanel.unmute": "ܫܪܝ ܫܬܩܐ",
    "voiceCallPanel.undeafen": "ܦܬܘܚ ܫܡܥܐ",
    "voiceCallPanel.deafen": "ܣܟܘܪ ܫܡܥܐ",
    "voiceCallPanel.disconnect": "ܦܣܘܩ ܐܚܝܕܘܬܐ",

    // src/lib/components/messages/VoiceMessagePlayer.svelte
    "voiceMessagePlayer.seek": "ܫܘܪ",
    "voiceMessagePlayer.voiceMessage": "ܐܓܪܬܐ ܕܩܠܐ",

    // src/lib/components/messages/VoiceRecorder.svelte
    "voiceRecorder.cancelRecording": "ܒܛܠ ܪܘܫܡܐ ܕܩܠܐ",
    "voiceRecorder.stop": "ܦܣܘܩ",
    "voiceRecorder.discard": "ܫܕܝ",
    "voiceRecorder.discardRecording": "ܫܕܝ ܪܘܫܡܐ ܕܩܠܐ",
    "voiceRecorder.voiceMessage": "ܐܓܪܬܐ ܕܩܠܐ",
    "voiceRecorder.sending": "ܒܫܕܪܐ…",
    "voiceRecorder.send": "ܫܕܪ",
    "voiceRecorder.microphoneAccessWasDenied": "ܡܥܠܬܐ ܠܡܝܩܪܘܦܘܢ ܠܐ ܩܒܝܠܬܐ ܝܠܗ̇.",
    "voiceRecorder.recordingFailed": "ܪܘܫܡܐ ܕܩܠܐ ܠܐ ܦܠܚܠܗ.",
    "voiceRecorder.nothingWasRecorded": "ܠܐ ܪܫܝܡܠܗ ܡܕܡ.",
    "voiceRecorder.failedToSendVoiceMessage": "ܫܕܪܐ ܕܐܓܪܬܐ ܕܩܠܐ ܠܐ ܦܠܚܠܗ",

    // src/lib/components/settings/WhatsNew.svelte
    "whatsNew.whatSNew": "ܡܘܕܝ ܐܝܬ ܚܕܬܐ",
    "whatsNew.loadingReleaseNotes": "ܒܛܥܢܐ ܬܘܟܣ̈ܐ ܕܢܘܣܚܐ…",
    "whatsNew.releaseNotesUnavailable": "ܬܘܟܣ̈ܐ ܕܢܘܣܚܐ ܠܐ ܝܢ ܡܫܟܚ̈ܐ.",
    "whatsNew.viewOnGithub": "ܚܙܝ ܥܠ GitHub",

    // src/lib/components/layout/WhatsNewModal.svelte
    "whatsNewModal.whatSNew": "ܡܘܕܝ ܐܝܬ ܚܕܬܐ",
    "whatsNewModal.whatSNewInV": "ܡܘܕܝ ܐܝܬ ܚܕܬܐ ܓܘ v{APP_VERSION}",
    "whatsNewModal.releaseNotesUnavailable": "ܬܘܟܣ̈ܐ ܕܢܘܣܚܐ ܠܐ ܝܢ ܡܫܟܚ̈ܐ.",
    "whatsNewModal.viewOnGithub": "ܚܙܝ ܥܠ GitHub",
    "whatsNewModal.gotIt": "ܦܗܡܠܝ",

    // src/lib/components/layout/VerificationRequestCard.svelte
    "verificationRequestCard.verifyYourOtherSession": "ܫܪܪ ܓܠܣܐ ܐܚܪܢܐ ܕܝܘܟ",
    "verificationRequestCard.verificationRequest": "ܒܥܝܬܐ ܕܫܘܪܪܐ",
    "verificationRequestCard.anotherOfYourSessions": "ܚܕ ܓܠܣܐ ܐܚܪܢܐ ܕܝܘܟ",

    // src/lib/components/messages/CallEventCard.svelte
    "callEventCard.missedCall": "ܩܪܝܬܐ ܕܠܐ ܦܢܝܬܐ",
    "callEventCard.ongoingCall": "ܩܪܝܬܐ ܕܒܗܘܝܐ",
    "callEventCard.callEnded": "ܩܪܝܬܐ ܫܠܡܠܗ̇",

    // src/lib/components/messages/ComposerActionsMenu.svelte
    "composerActionsMenu.uploadAFile": "ܐܣܩ ܦܐܝܠ",
    "composerActionsMenu.createPoll": "ܒܪܝ ܫܘܐܠܬܐ",
    "composerActionsMenu.recordVoiceMessage": "ܪܫܘܡ ܐܓܪܬܐ ܕܩܠܐ",
    "composerActionsMenu.shareLocation": "ܫܘܬܦ ܕܘܟܬܐ",
    "composerActionsMenu.createThread": "ܒܪܝ ܚܘܛܐ",

    // src/lib/components/messages/Reactions.svelte
    "reactions.couldNotAddReaction": "ܐܘܣܦܬܐ ܕܬܓܘܒܬܐ ܠܐ ܦܠܚܠܗ̇",

    // src/lib/components/ui/QrScanner.svelte
    "qrScanner.startingTheCamera": "ܒܫܘܪܝܐ ܕܟܡܪܐ…",
    "qrScanner.cameraAccessWasDenied": "ܡܥܠܬܐ ܠܟܡܪܐ ܠܐ ܩܒܝܠܬܐ ܝܠܗ̇.",
    "qrScanner.noCameraWasFoundOnThis": "ܠܐ ܦܝܫܐ ܡܫܟܚܬܐ ܟܡܪܐ ܥܠ ܗܢܐ ܡܐܢܐ.",
    "qrScanner.theCameraIsAlreadyInUse": "ܟܡܪܐ ܦܠܝܚܬܐ ܝܠܗ̇ ܒܝܕ ܬܘܟܢܝܬܐ ܐܚܪܬܐ.",
    "qrScanner.couldNotOpenTheCameraA":
        "ܦܬܚܐ ܕܟܡܪܐ ܠܐ ܦܠܚܠܗ. ܣܢܝܩܐ ܝܠܗ ܐܚܝܕܘܬܐ ܫܠܝܡܬܐ (https).",
    "qrScanner.codeFoundCheckingIt": "ܪܡܙܐ ܡܫܟܚܐ ܝܠܗ - ܒܒܨܝܐ ܠܗ…",
    "qrScanner.couldNotStartVerificationWithThat":
        "ܫܘܪܝܐ ܕܫܘܪܪܐ ܥܡ ܗܘ ܪܡܙܐ ܠܐ ܦܠܚܠܗ.",
    "qrScanner.thatIsnTAVerificationCode": "ܗܢܐ ܠܐ ܝܠܗ ܪܡܙܐ ܕܫܘܪܪܐ.",
    "qrScanner.thisDeviceHasNoCameraAvailable": "ܗܢܐ ܡܐܢܐ ܠܝܬ ܠܗ ܟܡܪܐ.",
    "qrScanner.couldNotStartTheCameraPreview":
        "ܫܘܪܝܐ ܕܚܙܝܬܐ ܩܕܡܝܬܐ ܕܟܡܪܐ ܠܐ ܦܠܚܠܗ.",
    "qrScanner.pointTheCameraAtTheirCode": "ܚܘܝ ܟܡܪܐ ܥܠ ܪܡܙܐ ܕܝܗܘܢ.",

    // src/lib/desktopContextMenu.ts
    "desktopContextMenu.failedToSaveImage": "ܢܛܪܐ ܕܨܘܪܬܐ ܠܐ ܦܠܚܠܗ",

    // src/lib/matrix/client.ts
    "client.serverAutoDiscoveryFailedUsingThe":
        "ܡܫܟܚܢܘܬܐ ܐܘܛܘܡܛܝܩܝܬܐ ܕܣܝܪܒܪ ܠܐ ܦܠܚܠܗ̇ - ܒܦܠܚܐ ܒܡܘܢܥܐ ܐܝܟ ܕܟܬܝܒܐ ܝܠܗ",
    "client.discoveredHomeserverFailedValidation":
        "ܣܝܪܒܪ ܕܒܝܬܐ ܕܡܫܟܚܐ ܠܐ ܦܠܚܠܗ ܒܒܘܚܢܐ",
    "client.thisHomeserverDoesnTSupportSliding":
        "ܗܢܐ ܣܝܪܒܪ ܕܒܝܬܐ ܠܐ ܡܣܝܥ ܐܚܕܝܘܬܐ ܓܠܝܫܬܐ، ܗܕܟܐ ܐܚܕܝܘܬܐ ܥܬܝܩܬܐ ܦܠܝܚܬܐ ܝܠܗ̇ ܒܕܘܟܬܗ̇.",
    "client.notLoggedIn": "ܠܐ ܥܠܝܠܐ ܝܘܬ",
    "client.thisEventTypeCannotBeForwarded": "ܗܢܐ ܙܢܐ ܕܓܕܫܐ ܠܐ ܦܝܫ ܫܕܪܐ ܠܩܕܡ",
    "client.notConnected": "ܠܐ ܐܚܝܕܐ",
    "client.thisServerDoesNotAllowSigning":
        "ܗܢܐ ܣܝܪܒܪ ܠܐ ܝܗܒ ܦܣܐ ܠܡܦܩܬܐ ܡܢ ܓܠܣ̈ܐ ܒܡܠܬܐ ܕܥܒܪܐ - ܦܠܚ ܒܦܐܬܐ ܕܚܘܫܒܢܐ ܕܝܗܝ ܒܕܘܟܬܗ̇.",
    "client.incorrectPassword": "ܡܠܬܐ ܕܥܒܪܐ ܠܐ ܬܪܝܨܬܐ",
    "client.thisServerDoesNotAllowConfirming":
        "ܗܢܐ ܣܝܪܒܪ ܠܐ ܝܗܒ ܦܣܐ ܠܫܘܪܪܐ ܕܗܢܐ ܣܘܥܪܢܐ ܒܡܠܬܐ ܕܥܒܪܐ - ܦܠܚ ܒܦܐܬܐ ܕܚܘܫܒܢܐ ܕܝܗܝ ܒܕܘܟܬܗ̇.",
    "client.directMessages": "ܐܓܪ̈ܬܐ ܫܪܝܪ̈ܬܐ",
    "client.messagesInDirectMessageRooms": "ܐܓܪ̈ܬܐ ܓܘ ܓܘܡ̈ܐ ܕܐܓܪ̈ܬܐ ܫܪܝܪ̈ܬܐ",
    "client.rooms": "ܓܘܡ̈ܐ",
    "client.messagesInAllOtherRooms": "ܐܓܪ̈ܬܐ ܓܘ ܟܠ ܓܘܡ̈ܐ ܐܚܪ̈ܢܐ",
    "client.fullMatrixIdMentions": "ܕܘܟܪܢ̈ܐ ܕܗܝܝܘܬܐ ܫܠܡܬܐ ܕ Matrix",
    "client.messagesUsingYourFullUserHomeserver":
        "ܐܓܪ̈ܬܐ ܕܦܠܚܝ ܒܗܝܝܘܬܐ ܫܠܡܬܐ ܕܝܘܟ ‎@user:homeserver",
    "client.displayNameMentions": "ܕܘܟܪܢ̈ܐ ܕܫܡܐ ܕܚܙܝܐ",
    "client.messagesContainingYourDisplayName":
        "ܐܓܪ̈ܬܐ ܕܐܝܬ ܓܘܝܗܝ ܫܡܐ ܕܝܘܟ ܕܚܙܝܐ",
    "client.usernameMentions": "ܕܘܟܪܢ̈ܐ ܕܫܡܐ ܕܡܦܠܚܢܐ",
    "client.messagesContainingYourUsernameWithoutServer":
        "ܐܓܪ̈ܬܐ ܕܐܝܬ ܓܘܝܗܝ ܫܡܐ ܕܡܦܠܚܢܐ ܕܝܘܟ (ܕܠܐ ܣܝܪܒܪ)",
    "client.roomMentions": "ܕܘܟܪܢ̈ܐ ܕ ‎@room",
    "client.messagesUsingRoomToNotifyEveryone":
        "ܐܓܪ̈ܬܐ ܕܦܠܚܝ ܒ ‎@room ܩܐ ܡܘܕܥܢܘܬܐ ܕܟܠ ܢܫܐ",
    "client.invitations": "ܙܘܡܢ̈ܐ",
    "client.whenYouAreInvitedToA": "ܐܡܬܝ ܕܙܡܝܢܐ ܝܘܬ ܠܓܘܡܐ",
    "client.thisRoom": "ܗܢܐ ܓܘܡܐ",
    "client.keywordCannotStartWith": "ܡܠܬܐ ܪܫܝܬܐ ܠܐ ܡܨܝܐ ܕܫܪܝܐ ܒ '.'",
    "client.emotes": "ܐܝܡܘܓܝ ܕ{value}",
    "client.room": "ܓܘܡܐ",
    "client.emojis": "ܐܝܡܘܓܝ",
    "client.enterAShortcode": "ܡܥܠ ܪܡܙܐ ܟܪܝܐ.",
    "client.useOnlyLettersNumbersDotsUnderscores":
        "ܦܠܚ ܒܣ ܒܐܬ̈ܘܬܐ، ܡܢܝܢ̈ܐ، ܢܘܩܙ̈ܐ، ܣܪ̈ܛܐ ܬܚܬܝ̈ܐ، ܢܝܫ̈ܢܐ ܕ + ܘܣܪ̈ܛܐ.",
    "client.chooseAtLeastOneUsage": "ܓܒܝ ܚܕ ܦܘܠܚܢܐ ܠܦܚܘܬ ܡܢ ܟܠ.",
    "client.imageNotFound": "ܨܘܪܬܐ ܠܐ ܦܝܫܐ ܡܫܟܚܬܐ.",
    "client.invalidPowerLevels": "ܕܪ̈ܓܐ ܕܚܝܠܐ ܠܐ ܬܪܝܨ̈ܐ: {shapeError}",
    "client.roomCreatorsPowerLevelCannotBe":
        "ܕܪܓܐ ܕܚܝܠܐ ܕܒܪܘܝ̈ܐ ܕܓܘܡܐ ܠܐ ܦܝܫ ܛܘܝܒܐ ܓܘ ܓܘܡ̈ܐ ܕ v12",
    "client.restrictedJoinRequiresAtLeastOne":
        "ܥܠܠܐ ܡܚܘܕܕܐ ܣܢܝܩܐ ܝܠܗ ܠܚܕ ܚܘܕܪܐ ܪܫܝܐ ܠܦܚܘܬ ܡܢ ܟܠ",
    "client.orderMustBeAtMost50":
        "ܣܘܕܪܐ ܣܢܝܩܐ ܝܠܗ ܕܗܘܐ ܝܬܝܪ ܡܢ ܟܠ 50 ܐܬ̈ܘܬܐ ASCII (ܡܢ ܦܘܪܫܐ ܗܕܝܡܐ ~)",
    "client.cannotSetSuggestedOnASpace":
        'ܠܐ ܦܝܫ ܛܘܝܒܐ "ܡܦܝܣܐ" ܥܠ ܒܪܐ ܕܚܘܕܪܐ ܕܠܐ via',
    "client.pollHasNoEventId": "ܫܘܐܠܬܐ ܠܝܬ ܠܗ̇ ܗܝܝܘܬܐ ܕܓܕܫܐ",
    "client.unsupportedPoll": "ܫܘܐܠܬܐ ܠܐ ܡܣܘܥܝܬܐ",
    "client.youCanTCloseThisPoll": "ܠܐ ܡܨܝܬ ܕܣܟܪܬ ܗܕܐ ܫܘܐܠܬܐ",
    "client.microphoneDisconnectedSwitchedToTheDefault":
        "ܡܝܩܪܘܦܘܢ ܦܣܝܩܐ ܝܠܗ - ܫܚܠܦܠܗ ܠܡܐܢܐ ܥܕܝܠܐ",
    "client.cameraDisconnected": "ܟܡܪܐ ܦܣܝܩܬܐ ܝܠܗ̇",
    "client.unknownRoom": "ܓܘܡܐ ܠܐ ܝܕܝܥܐ",
    "client.theServerRejectedItYouMay":
        "ܣܝܪܒܪ ܠܐ ܩܒܠܠܗ - ܡܨܐ ܕܠܝܬ ܠܘܟ ܦܣܐ ܠܥܠܠܐ ܠܩܪ̈ܝܬܐ ܓܘ ܗܢܐ ܓܘܡܐ",
    "client.callMembershipFailed": "ܗܕܡܘܬܐ ܓܘ ܩܪܝܬܐ ܠܐ ܦܠܚܠܗ̇: {detail}",
    "client.voiceServerRejectedTheJoin": "ܣܝܪܒܪ ܕܩܠܐ ܠܐ ܩܒܠܠܗ ܥܠܠܐ ({status})",
    "client.voiceCallDisconnected": "ܩܪܝܬܐ ܕܩܠܐ ܦܣܝܩܬܐ ܝܠܗ̇",
    "client.yourMicrophoneAppearsSilentCheckYour":
        "ܡܝܩܪܘܦܘܢ ܕܝܘܟ ܚܙܝܐ ܝܠܗ ܫܬܝܩܐ - ܒܨܝ ܡܐܢܐ ܕܡܥܠܢܐ ܕܝܘܟ",
    "client.audioDeviceError": "ܦܘܕܐ ܕܡܐܢܐ ܕܩܠܐ: {message}",
    "client.couldnTSwitchToThatKept":
        "ܫܘܚܠܦܐ ܠܗܘ {what} ܠܐ ܦܠܚܠܗ - ܩܕܡܝܐ ܕܝܘܟ ܢܛܝܪܐ ܝܠܗ",
    "client.couldnTSwitchToThatUsing":
        "ܫܘܚܠܦܐ ܠܗܘ {what} ܠܐ ܦܠܚܠܗ - ܒܦܠܚܐ ܒܡܐܢܐ ܥܕܝܠܐ",
    "client.couldnTSwitchToThatPick":
        "ܫܘܚܠܦܐ ܠܗܘ {what} ܠܐ ܦܠܚܠܗ - ܓܒܝ ܡܐܢܐ ܐܚܪܢܐ",
    "client.couldNotStartScreenShare": "ܫܘܪܝܐ ܕܫܘܬܦܘܬܐ ܕܡܚܙܝܬܐ ܠܐ ܦܠܚܠܗ",
    "client.couldnTChangeScreenShareQuality":
        "ܫܘܚܠܦܐ ܕܐܝܢܝܘܬܐ ܕܫܘܬܦܘܬܐ ܕܡܚܙܝܬܐ ܠܐ ܦܠܚܠܗ",
    "client.couldNotStartTheCameraCheck": "ܫܘܪܝܐ ܕܟܡܪܐ ܠܐ ܦܠܚܠܗ - ܒܨܝ ܦܣ̈ܐ",
    "client.couldnTApplyAudioProcessingChange":
        "ܦܠܚܬܐ ܕܫܘܚܠܦܐ ܕܣܘܥܪܢܐ ܕܩܠܐ ܠܐ ܦܠܚܠܗ̇",
    "client.deviceNounMicrophone": "ܡܝܩܪܘܦܘܢ",
    "client.deviceNounCamera": "ܟܡܪܐ",

    // src/lib/matrix/crypto.ts
    "crypto.couldNotStartTheEmojiCheck": "ܫܘܪܝܐ ܕܒܘܚܢܐ ܕܐܝܡܘܓܝ ܠܐ ܦܠܚܠܗ",
    "crypto.couldNotCancelTheVerification": "ܒܘܛܠܐ ܕܫܘܪܪܐ ܠܐ ܦܠܚܠܗ",
    "crypto.noCodeAvailableTheOtherSide":
        "ܠܝܬ ܪܡܙܐ - ܓܢܒܐ ܐܚܪܢܐ ܠܐ ܡܨܐ ܕܒܨܐ ܚܕ.",
    "crypto.couldNotGenerateAQrCode": "ܒܪܝܐ ܕܪܡܙܐ ܕ QR ܠܐ ܦܠܚܠܗ",
    "crypto.thatCodeDoesnTMatchThis": "ܗܘ ܪܡܙܐ ܠܐ ܡܙܕܘܓ ܥܡ ܗܢܐ ܫܘܪܪܐ",
    "crypto.couldNotConfirmTheQrMatch": "ܫܘܪܪܐ ܕܙܘܘܓܐ ܕ QR ܠܐ ܦܠܚܠܗ",
    "crypto.couldNotCancelTheQrMatch": "ܒܘܛܠܐ ܕܙܘܘܓܐ ܕ QR ܠܐ ܦܠܚܠܗ",
    "crypto.encryptionIsNotReadyOnThis": "ܛܘܫܝܐ ܠܐ ܝܠܗ ܡܛܝܒܐ ܒܗܢܐ ܓܠܣܐ",
    "crypto.thisServerCanTConfirmEncryption":
        "ܗܢܐ ܣܝܪܒܪ ܠܐ ܡܨܐ ܕܫܪܪ ܛܘܝܒܐ ܕܛܘܫܝܐ ܒܡܠܬܐ ܕܥܒܪܐ - ܦܠܚ ܒܦܐܬܐ ܕܚܘܫܒܢܐ ܕܝܗܝ ܒܕܘܟܬܗ̇.",
    "crypto.incorrectPassword": "ܡܠܬܐ ܕܥܒܪܐ ܠܐ ܬܪܝܨܬܐ",
    "crypto.failedToGenerateARecoveryKey": "ܒܪܝܐ ܕܩܠܝܕܐ ܕܦܘܪܩܢܐ ܠܐ ܦܠܚܠܗ",
    "crypto.yourOldRecoveryWasResetBut":
        "ܦܘܪܩܢܐ ܥܬܝܩܐ ܕܝܘܟ ܡܚܘܕܬܐ ܝܠܗ، ܐܝܢܐ ܛܘܝܒܐ ܕܚܕܬܐ ܠܐ ܦܠܚܠܗ.",
    "crypto.thatKeyDoesnTMatchThis":
        "ܗܘ ܩܠܝܕܐ ܠܐ ܡܙܕܘܓ ܥܡ ܢܘܣܚܐ ܕܒܣܬܪ ܕܗܢܐ ܚܘܫܒܢܐ ܥܠ ܣܝܪܒܪ.",
    "crypto.thatDoesnTLookLikeA":
        "ܗܕܐ ܠܐ ܚܙܝܐ ܝܠܗ̇ ܐܝܟ ܩܠܝܕܐ ܬܪܝܨܐ ܕܦܘܪܩܢܐ. ܒܨܝ ܦܘܕ̈ܐ ܕܟܬܒܐ ܘܢܣܝ ܡܢ ܕܪܝܫ.",
    "crypto.thisAccountHasNoRecoverySet":
        "ܗܢܐ ܚܘܫܒܢܐ ܠܝܬ ܠܗ ܦܘܪܩܢܐ ܡܛܘܝܒܐ ܗܠ ܗܫܐ. ܛܝܒ ܦܘܪܩܢܐ ܩܕܡ ܟܠ ܥܠ ܓܠܣܐ ܕܐܝܬ ܠܗ ܩܠܝܕ̈ܐ ܕܝܘܟ.",
    "crypto.thatRecoveryKeyDoesnTMatch":
        "ܗܘ ܩܠܝܕܐ ܕܦܘܪܩܢܐ ܠܐ ܡܙܕܘܓ ܥܡ ܗܢܐ ܚܘܫܒܢܐ. ܒܨܝ ܦܘܕ̈ܐ ܕܟܬܒܐ ܘܢܣܝ ܡܢ ܕܪܝܫ.",
    "crypto.thisAccountSRecoveryWasnT":
        "ܦܘܪܩܢܐ ܕܗܢܐ ܚܘܫܒܢܐ ܠܐ ܛܘܝܒܠܗ ܥܡ ܦܬܓܡܐ. ܦܠܚ ܒܩܠܝܕܐ ܕܦܘܪܩܢܐ ܒܕܘܟܬܗ.",
    "crypto.couldnTUseYourPassphraseOn":
        "ܦܠܚܬܐ ܕܦܬܓܡܐ ܕܝܘܟ ܥܠ ܗܢܐ ܡܐܢܐ ܠܐ ܦܠܚܠܗ̇. ܢܣܝ ܩܠܝܕܐ ܕܦܘܪܩܢܐ ܒܕܘܟܬܗ.",
    "crypto.thatPassphraseDoesnTMatchThis":
        "ܗܘ ܦܬܓܡܐ ܠܐ ܡܙܕܘܓ ܥܡ ܗܢܐ ܚܘܫܒܢܐ. ܒܨܝ ܦܘܕ̈ܐ ܕܟܬܒܐ ܘܢܣܝ ܡܢ ܕܪܝܫ.",

    // src/lib/matrix/media.ts
    "media.notLoggedIn": "ܠܐ ܥܠܝܠܐ ܝܘܬ",
    "media.failedToFetchAttachment": "ܡܐܬܝܬܐ ܕܐܣܝܪܬܐ ܠܐ ܦܠܚܠܗ̇: {status}",
    "media.encryptedAttachmentHasAnInvalidUrl":
        "ܐܣܝܪܬܐ ܡܛܫܝܬܐ ܐܝܬ ܠܗ̇ URL ܠܐ ܬܪܝܨܐ",
    "media.failedToFetchEncryptedAttachment":
        "ܡܐܬܝܬܐ ܕܐܣܝܪܬܐ ܡܛܫܝܬܐ ܠܐ ܦܠܚܠܗ̇: {status}",

    // src/lib/matrix/pluginHost.ts
    "pluginHost.mediaWasUploadedByADifferent":
        "ܡܝܕܝܐ ܡܣܩܬܐ ܝܠܗ̇ ܒܝܕ ܚܘܫܒܢܐ ܐܚܪܢܐ",
    "pluginHost.notLoggedIn": "ܠܐ ܥܠܝܠܐ ܝܘܬ",
    "pluginHost.notConnected": "ܠܐ ܐܚܝܕܐ",

    // src/lib/matrix/runtime.ts
    "runtime.notLoggedIn": "ܠܐ ܥܠܝܠܐ ܝܘܬ",

    // src/lib/plugins/builtins/double-tap-reply/index.ts
    "doubleTapReply.doubleTapSwipeActions": "ܣܘܥܪ̈ܢܐ ܕܬܪܝܢ ܕܥܨ̈ܐ ܘܓܠܫܐ",
    "doubleTapReply.doubleTapAMessageToReply":
        "ܕܥܘܨ ܬܪܝܢ ܙܒܢ̈ܐ ܥܠ ܐܓܪܬܐ ܩܐ ܦܢܝܬܐ، ܬܓܘܒܬܐ ܝܢ ܬܘܩܢܐ، ܝܢ ܓܠܘܫ ܠܗ̇ ܠܣܡܠܐ ܩܐ ܦܢܝܬܐ / ܬܘܩܢܐ.",
    "doubleTapReply.doubleTapYourMessages": "ܬܪܝܢ ܕܥܨ̈ܐ ܥܠ ܐܓܪ̈ܬܐ ܕܝܘܟ",
    "doubleTapReply.nothing": "ܠܐ ܡܕܡ",
    "doubleTapReply.reaction": "ܬܓܘܒܬܐ",
    "doubleTapReply.reply": "ܦܢܝܬܐ",
    "doubleTapReply.edit": "ܬܘܩܢܐ",
    "doubleTapReply.doubleTapOtherMessages": "ܬܪܝܢ ܕܥܨ̈ܐ ܥܠ ܐܓܪ̈ܬܐ ܐܚܪ̈ܢܐ",
    "doubleTapReply.reactionEmoji": "ܐܝܡܘܓܝ ܕܬܓܘܒܬܐ",
    "doubleTapReply.sentWhenADoubleTapAction":
        "ܡܫܘܕܪܐ ܝܠܗ ܐܡܬܝ ܕܣܘܥܪܢܐ ܕܬܪܝܢ ܕܥܨ̈ܐ ܡܛܘܝܒܐ ܝܠܗ ܠܬܓܘܒܬܐ.",
    "doubleTapReply.swipeToReplyEdit": "ܓܠܘܫ ܩܐ ܦܢܝܬܐ / ܬܘܩܢܐ",
    "doubleTapReply.swipeAMessageLeftToReply":
        "ܓܠܘܫ ܐܓܪܬܐ ܠܣܡܠܐ ܩܐ ܦܢܝܬܐ؛ ܓܠܘܫ ܕܝܘܟ ܝܬܝܪ ܩܐ ܬܘܩܢܐ.",
    "doubleTapReply.failedToReact": "ܬܓܘܒܬܐ ܠܐ ܦܠܚܠܗ̇",

    // src/lib/plugins/builtins/slash-fun/index.ts
    "slashFun.sendAnActionMessage": "ܫܕܪ ܐܓܪܬܐ ܕܣܘܥܪܢܐ",
    "slashFun.appendToYourMessage": "ܐܘܣܦ ¯\\_(ツ)_/¯ ܠܐܓܪܬܐ ܕܝܘܟ",
    "slashFun.appendToYourMessage2": "ܐܘܣܦ (╯°□°)╯︵ ┻━┻ ܠܐܓܪܬܐ ܕܝܘܟ",
    "slashFun.appendToYourMessage3": "ܐܘܣܦ ┬─┬ ノ( ゜-゜ノ) ܠܐܓܪܬܐ ܕܝܘܟ",
    "slashFun.appendToYourMessage4": "ܐܘܣܦ ( ͡° ͜ʖ ͡°) ܠܐܓܪܬܐ ܕܝܘܟ",
    "slashFun.sendYourMessageAsASpoiler": "ܫܕܪ ܐܓܪܬܐ ܕܝܘܟ ܐܝܟ ܛܘܫܝܐ",
    "slashFun.sendYourMessageWithoutMarkdownFormatting":
        "ܫܕܪ ܐܓܪܬܐ ܕܝܘܟ ܕܠܐ ܛܘܦܣܐ ܕ markdown",
    "slashFun.funSlashCommands": "ܦܘܩܕܢ̈ܐ ܡܓܚܟܢ̈ܐ ܕ /",
    "slashFun.noveltySlashCommandsMeShrugTableflip":
        "ܦܘܩܕܢ̈ܐ ܕ / ܕܚܕܘܬܐ: /me، /shrug، /tableflip، /unflip، /lenny، /spoiler، /plain.",

    // src/lib/plugins/builtins/text-replacer/index.ts
    "textReplacer.textReplacer": "ܫܚܠܦܢܐ ܕܟܬܒܐ",
    "textReplacer.applyYourOwnStringOrRegex":
        "ܦܠܚ ܒܫܘܚܠܦ̈ܐ ܕܝܘܟ ܕܟܬܒܐ ܝܢ regex ܥܠ ܟܬܒܐ ܕܐܓܪ̈ܬܐ ܕܫܕܪܐ ܝܘܬ.",
    "textReplacer.replacementRules": "ܢܡܘܣ̈ܐ ܕܫܘܚܠܦܐ",
    "textReplacer.appliedToYourOutgoingMessageText":
        "ܦܠܝܚ̈ܐ ܝܢ ܒܣܘܕܪܐ ܥܠ ܟܬܒܐ ܕܐܓܪ̈ܬܐ ܕܫܕܪܐ ܝܘܬ. ܡܩܒܠ̈ܢܐ ܚܙܝ ܟܬܒܐ ܥܕܝܠܐ.",
    "textReplacer.find": "ܒܨܝ",
    "textReplacer.textOrPattern": "ܟܬܒܐ ܝܢ ܛܘܦܣܐ",
    "textReplacer.replaceWith": "ܫܚܠܦ ܒ",
    "textReplacer.regex": "Regex",
    "textReplacer.ignoreCase": "ܠܐ ܦܪܘܫ ܐܬ̈ܘܬܐ ܪܒ̈ܬܐ ܘܙܥܘܪ̈ܬܐ",

    // src/lib/plugins/pluginBoot.ts
    "pluginBoot.noPluginSyncDataOnYour":
        "ܠܝܬ ܝܕ̈ܥܬܐ ܕܐܚܕܝܘܬܐ ܕܬܘܣܦ̈ܬܐ ܓܘ ܚܘܫܒܢܐ ܕܝܘܟ ܗܠ ܗܫܐ.",
    "pluginBoot.theSyncDataOnYourAccount":
        "ܝܕ̈ܥܬܐ ܕܐܚܕܝܘܬܐ ܓܘ ܚܘܫܒܢܐ ܕܝܘܟ ܚܒܝܠ̈ܬܐ ܝܢ.",
    "pluginBoot.autoUpdateFailed": "ܚܘܕܬܐ ܐܘܛܘܡܛܝܩܝܐ ܠܐ ܦܠܚܠܗ̇: {value}",

    // src/lib/plugins/pluginPin.ts
    "pluginPin.pluginIdMismatchIndexListsManifest":
        'ܗܝܝܘܬܐ ܕܬܘܣܦܬܐ ܠܐ ܡܙܕܘܓܐ: ܪܫܝܡܬܐ ܟܬܒܐ "{entryId}"، manifest ܐܡܪܐ "{manifestId}"',
    "pluginPin.cannotInstallPluginWithIdIt":
        'ܠܐ ܦܝܫ ܢܨܒܐ ܬܘܣܦܬܐ ܥܡ ܗܝܝܘܬܐ "{manifestId}": ܬܘܣܦܬܐ ܕܓܘ ܬܘܟܢܝܬܐ ܝܠܗ̇',
    "pluginPin.pluginIsAlreadyInstalledFromA":
        'ܬܘܣܦܬܐ "{manifestId}" ܢܨܝܒܬܐ ܝܠܗ̇ ܡܢ ܓܙܐ ܐܚܪܢܐ',

    // src/lib/plugins/repo.ts
    "repo.repoReferenceMustBeAString": "ܡܚܘܝܢܐ ܕܓܙܐ ܣܢܝܩܐ ܝܠܗ ܕܗܘܐ ܟܬܒܐ",
    "repo.repoReferenceCannotBeEmpty": "ܡܚܘܝܢܐ ܕܓܙܐ ܠܐ ܡܨܐ ܕܗܘܐ ܣܦܝܩܐ",
    "repo.branchCannotBeEmpty": "ܣܘܟܐ ܠܐ ܡܨܐ ܕܗܘܐ ܣܦܝܩܐ",
    "repo.branchCannotContain": "ܣܘܟܐ ܠܐ ܡܨܐ ܕܐܝܬ ܓܘܗ '..'",
    "repo.invalidRepoReferenceExtraPathSegments":
        "ܡܚܘܝܢܐ ܕܓܙܐ ܠܐ ܬܪܝܨܐ: ܦܠܓ̈ܐ ܝܬܝܪ̈ܐ ܕܫܒܝܠܐ (ܠܐ /tree/<branch>)",
    "repo.invalidRepoReferenceMustBeOwner":
        "ܡܚܘܝܢܐ ܕܓܙܐ ܠܐ ܬܪܝܨܐ: ܣܢܝܩܐ ܝܠܗ ܕܗܘܐ owner/repo",
    "repo.ownerCannotBeEmpty": "ܡܪܐ ܠܐ ܡܨܐ ܕܗܘܐ ܣܦܝܩܐ",
    "repo.invalidOwnerMustMatchAZa":
        "ܡܪܐ ܠܐ ܬܪܝܨܐ: ܣܢܝܩܐ ܝܠܗ ܕܡܙܕܘܓ ܥܡ [A-Za-z0-9][A-Za-z0-9._-]*",
    "repo.repoCannotBeEmpty": "ܓܙܐ ܠܐ ܡܨܐ ܕܗܘܐ ܣܦܝܩܐ",
    "repo.invalidRepoMustMatchAZa":
        "ܓܙܐ ܠܐ ܬܪܝܨܐ: ܣܢܝܩܐ ܝܠܗ ܕܡܙܕܘܓ ܥܡ [A-Za-z0-9][A-Za-z0-9._-]*",

    // src/lib/plugins/repoList.ts
    "repoList.enterARepoOwnerRepoOr": "ܡܥܠ ܓܙܐ (owner/repo ܝܢ URL ܕ GitHub).",
    "repoList.thatIsTheOfficialRepoAlready": "ܗܢܐ ܝܠܗ ܓܙܐ ܪܫܡܝܐ (ܡܘܣܦܐ ܝܠܗ).",
    "repoList.thatRepoIsAlreadyAdded": "ܗܢܐ ܓܙܐ ܡܘܣܦܐ ܝܠܗ.",

    // src/lib/stores/gifSearch.svelte.ts
    "gifSearch.couldnTReachKlipyTryAgain": "ܠܐ ܡܛܠܗ ܠ KLIPY - ܢܣܝ ܡܢ ܕܪܝܫ.",

    // src/lib/stores/liveLocation.svelte.ts
    "liveLocation.youCanTShareLiveLocation":
        "ܠܐ ܡܨܝܬ ܕܫܘܬܦܬ ܕܘܟܬܐ ܚܝܬܐ ܓܘ ܗܢܐ ܓܘܡܐ.",
    "liveLocation.couldnTStartLiveLocation": "ܫܘܪܝܐ ܕܕܘܟܬܐ ܚܝܬܐ ܠܐ ܦܠܚܠܗ",
    "liveLocation.expired": "ܡܛܠܗ ܠܫܘܠܡܐ",
    "liveLocation.lessThanAMinuteLeft": "ܒܨܝܪ ܡܢ ܕܩܝܩܐ ܦܝܫܬܐ",
    "liveLocation.minLeft": "{totalMin} ܕܩܝ̈ܩܐ ܦܝܫ̈ܐ",
    "liveLocation.hLeft": "{h} ܫܥ̈ܐ ܦܝܫ̈ܐ",
    "liveLocation.hMinLeft": "{h} ܫܥ̈ܐ {m} ܕܩܝ̈ܩܐ ܦܝܫ̈ܐ",
    "liveLocation.justNow": "ܗܫܐ",
    "liveLocation.sAgo": "ܩܡ {floor} ܪ̈ܦܦܐ",
    "liveLocation.minAgo": "ܩܡ {floor} ܕܩܝ̈ܩܐ",
    "liveLocation.hAgo": "ܩܡ {floor} ܫܥ̈ܐ",
    "liveLocation.n15Minutes": "15 ܕܩܝ̈ܩܐ",
    "liveLocation.n1Hour": "1 ܫܥܬܐ",
    "liveLocation.n8Hours": "8 ܫܥ̈ܐ",

    // src/lib/stores/outbox.svelte.ts
    "outbox.failedToSend": "ܫܕܪܐ ܠܐ ܦܠܚܠܗ",

    // src/lib/stores/settings.svelte.ts
    "settings.couldNotReadThatFile": "ܩܪܝܬܐ ܕܗܘ ܦܐܝܠ ܠܐ ܦܠܚܠܗ̇.",
    "settings.thatFileIsnTAValid": "ܗܘ ܦܐܝܠ ܠܐ ܝܠܗ ܛܘܦܣܐ ܬܪܝܨܐ ܕܐܬ̈ܘܬܐ.",
    "settings.fontCouldnTBeSavedOn": "ܛܘܦܣܐ ܕܐܬ̈ܘܬܐ ܠܐ ܡܨܐ ܕܢܛܪ ܥܠ ܗܢܐ ܡܐܢܐ.",
    "settings.cannotSaveAPresetWithBuilt":
        "ܠܐ ܦܝܫ ܢܛܪܐ ܬܚܙܝܬܐ ܥܡ ܫܡܐ ܕܓܘ ܬܘܟܢܝܬܐ: {name}",

    // src/lib/stores/shareInbox.svelte.ts
    "shareInbox.youReOfflineTheShareWas":
        "ܠܐ ܐܚܝܕܐ ܝܘܬ: ܫܘܬܦܘܬܐ ܡܘܣܦܬܐ ܝܠܗ̇ ܠܟܬܒܢܐ",
    "shareInbox.couldnTSendTheShare": "ܫܕܪܐ ܕܫܘܬܦܘܬܐ ܠܐ ܦܠܚܠܗ",

    // src/lib/stores/verification.svelte.ts
    "verification.finishingAnotherVerificationFirstTryAgain":
        "ܩܕܡ ܟܠ ܒܫܘܠܡܐ ܫܘܪܪܐ ܐܚܪܢܐ. ܢܣܝ ܡܢ ܕܪܝܫ.",
    "verification.waitingForTheOtherSideTo": "ܒܢܛܪܐ ܩܐ ܓܢܒܐ ܐܚܪܢܐ ܕܩܒܠ…",
    "verification.acceptedSettingUpTheCheck": "ܩܒܝܠܐ - ܒܛܘܝܒܐ ܒܘܚܢܐ…",
    "verification.verifying": "ܒܫܘܪܪܐ…",
    "verification.sessionVerified": "ܓܠܣܐ ܡܫܪܪܐ ܝܠܗ",
    "verification.userVerified": "ܡܦܠܚܢܐ ܡܫܪܪܐ ܝܠܗ",
    "verification.verificationCancelled": "ܫܘܪܪܐ ܒܛܝܠܐ ܝܠܗ",
    "verification.verified": "ܡܫܪܪܐ",
    "verification.unverified": "ܠܐ ܡܫܪܪܐ",
    "verification.identityChanged": "ܗܝܝܘܬܐ ܫܚܠܦܬܠܗ̇",
    "verification.couldnTAcceptThisRequestTry":
        "ܩܘܒܠܐ ܕܗܕܐ ܒܥܝܬܐ ܠܐ ܦܠܚܠܗ. ܢܣܝ ܡܢ ܕܪܝܫ.",

    // src/lib/stores/voiceCall.svelte.ts
    "voiceCall.couldnTLoadTheCallComponent":
        "ܛܥܢܐ ܕܡܢܬܐ ܕܩܪܝܬܐ ܠܐ ܦܠܚܠܗ. ܒܨܝ ܐܚܝܕܘܬܐ ܕܝܘܟ، ܘܒܬܪ ܛܥܘܢ ܦܐܬܐ ܡܢ ܕܪܝܫ ܩܐ ܢܣܝܢܐ ܐܚܪܢܐ.",
    "voiceCall.couldNotJoinTheVoiceCall": "ܥܠܠܐ ܠܩܪܝܬܐ ܕܩܠܐ ܠܐ ܦܠܚܠܗ",
    "voiceCall.couldNotMuteYourMicrophone": "ܫܬܩܐ ܕܡܝܩܪܘܦܘܢ ܕܝܘܟ ܠܐ ܦܠܚܠܗ",
    "voiceCall.couldNotUnmuteYourMicrophoneCheck":
        "ܫܪܝܐ ܕܫܬܩܐ ܕܡܝܩܪܘܦܘܢ ܕܝܘܟ ܠܐ ܦܠܚܠܗ - ܒܨܝ ܡܐܢܐ ܕܡܥܠܢܐ ܕܝܘܟ",
    "voiceCall.connecting": "ܒܐܚܕܐ…",
    "voiceCall.voiceConnected": "ܩܠܐ ܐܚܝܕܐ ܝܠܗ",
    "voiceCall.reconnecting": "ܒܐܚܕܐ ܡܢ ܕܪܝܫ…",
    "voiceCall.youWereBannedFromThisRoom":
        "ܐܣܝܪܐ ܝܘܬ ܡܢ ܗܢܐ ܓܘܡܐ - ܩܪܝܬܐ ܫܠܡܠܗ̇",
    "voiceCall.youLeftThisRoomCallEnded": "ܫܒܩܠܘܟ ܗܢܐ ܓܘܡܐ - ܩܪܝܬܐ ܫܠܡܠܗ̇",
    "voiceCall.youWereRemovedFromThisRoom":
        "ܫܩܝܠܐ ܝܘܬ ܡܢ ܗܢܐ ܓܘܡܐ - ܩܪܝܬܐ ܫܠܡܠܗ̇",

    // src/lib/update.ts
    "update.noReleasesFoundYet": "ܠܐ ܦܝܫܝ ܡܫܟܚܐ ܢܘܣܚ̈ܐ ܗܠ ܗܫܐ.",
    "update.githubApiError": "ܦܘܕܐ ܕ GitHub API ({status}).",
    "update.couldNotReadTheLatestVersion": "ܩܪܝܬܐ ܕܢܘܣܚܐ ܐܚܪܝܐ ܠܐ ܦܠܚܠܗ̇.",

    // src/lib/utils/accountSecurity.ts
    "accountSecurity.enterYourCurrentPassword": "ܡܥܠ ܡܠܬܐ ܕܥܒܪܐ ܗܫܝܬܐ ܕܝܘܟ.",
    "accountSecurity.enterANewPassword": "ܡܥܠ ܡܠܬܐ ܕܥܒܪܐ ܚܕܬܐ.",
    "accountSecurity.newPasswordMustBeAtLeast":
        "ܡܠܬܐ ܕܥܒܪܐ ܚܕܬܐ ܣܢܝܩܬܐ ܝܠܗ̇ ܠ 8 ܐܬ̈ܘܬܐ ܠܦܚܘܬ ܡܢ ܟܠ.",
    "accountSecurity.newPasswordMustBeDifferentFrom":
        "ܡܠܬܐ ܕܥܒܪܐ ܚܕܬܐ ܣܢܝܩܬܐ ܝܠܗ̇ ܕܗܘܝܐ ܦܪܝܫܬܐ ܡܢ ܗܫܝܬܐ.",
    "accountSecurity.passwordsDoNotMatch": "ܡܠ̈ܐ ܕܥܒܪܐ ܠܐ ܡܙܕܘܓܝ.",

    // src/lib/utils/activeSession.ts
    "activeSession.offAlwaysNotify": "ܛܦܝܐ - ܟܠ ܙܒܢܐ ܡܘܕܥ",
    "activeSession.n15Seconds": "15 ܪ̈ܦܦܐ",
    "activeSession.n30Seconds": "30 ܪ̈ܦܦܐ",
    "activeSession.n1Minute": "1 ܕܩܝܩܐ",
    "activeSession.n2Minutes": "2 ܕܩܝ̈ܩܐ",
    "activeSession.n5Minutes": "5 ܕܩܝ̈ܩܐ",
    "activeSession.n10Minutes": "10 ܕܩܝ̈ܩܐ",
    "activeSession.n30Minutes": "30 ܕܩܝ̈ܩܐ",
    "activeSession.enterANumberOfMinutes": "ܡܥܠ ܡܢܝܢܐ ܕܕܩܝ̈ܩܐ.",
    "activeSession.chooseAtLeast1MinuteUse":
        "ܓܒܝ 1 ܕܩܝܩܐ ܠܦܚܘܬ ܡܢ ܟܠ - ܦܠܚ ܒܪܫܝܡܬܐ ܕܠܥܠ ܩܐ ܙܒܢ̈ܐ ܟܪ̈ܝܐ.",
    "activeSession.chooseMinutes2HoursOrLess":
        "ܓܒܝ {MAX_CUSTOM_GRACE_MINUTES} ܕܩܝ̈ܩܐ (2 ܫܥ̈ܐ) ܝܢ ܒܨܝܪ.",

    // src/lib/utils/audioDevices.ts
    "audioDevices.microphone": "ܡܝܩܪܘܦܘܢ",
    "audioDevices.speaker": "ܡܫܡܥܢܐ",
    "audioDevices.camera": "ܟܡܪܐ",

    // src/lib/utils/audioPlayback.ts
    "audioPlayback.failedToLoadRetry": "ܛܥܢܐ ܠܐ ܦܠܚܠܗ · ܢܣܝ ܡܢ ܕܪܝܫ",
    "audioPlayback.clickToPlay": "ܕܥܘܨ ܩܐ ܦܠܚܬܐ",

    // src/lib/utils/clientGeneration.ts
    "clientGeneration.sessionChangedBeforeTheOperationFinished":
        "ܓܠܣܐ ܫܚܠܦܠܗ ܩܕܡ ܕܫܠܡ ܣܘܥܪܢܐ",

    // src/lib/utils/customFont.ts
    "customFont.useAWoff2TtfOrOtf":
        "ܦܠܚ ܒܦܐܝܠ ܕܛܘܦܣܐ ܕܐܬ̈ܘܬܐ ‎.woff2، .ttf ܝܢ .otf.",
    "customFont.thatFontFileIsEmpty": "ܗܘ ܦܐܝܠ ܕܛܘܦܣܐ ܕܐܬ̈ܘܬܐ ܣܦܝܩܐ ܝܠܗ.",
    "customFont.fontFileIsTooLargeMax":
        "ܦܐܝܠ ܕܛܘܦܣܐ ܕܐܬ̈ܘܬܐ ܪܒܐ ܝܠܗ ܝܬܝܪ (ܝܬܝܪ ܡܢ ܟܠ 10 MB).",
    "customFont.customFont": "ܛܘܦܣܐ ܦܪܨܘܦܝܐ ܕܐܬ̈ܘܬܐ",

    // src/lib/utils/deviceSessions.ts
    "deviceSessions.unknown": "ܠܐ ܝܕܝܥܐ",
    "deviceSessions.justNow": "ܗܫܐ",
    "deviceSessions.desktopApp": "ܬܘܟܢܝܬܐ ܕܡܚܫܒܐ",
    "deviceSessions.on": "{client} ܥܠ {os}",
    "deviceSessions.minutesAgo":
        "{count, plural, one {ܩܡ # ܕܩܝܩܐ} other {ܩܡ # ܕܩܝ̈ܩܐ}}",
    "deviceSessions.hoursAgo":
        "{count, plural, one {ܩܡ # ܫܥܬܐ} other {ܩܡ # ܫܥ̈ܐ}}",
    "deviceSessions.daysAgo":
        "{count, plural, one {ܩܡ # ܝܘܡܐ} other {ܩܡ # ܝܘܡ̈ܢܐ}}",

    // src/lib/utils/displaySources.ts
    "displaySources.screen": "ܡܚܙܝܬܐ",
    "displaySources.untitledWindow": "ܟܘܬܐ ܕܠܐ ܫܡܐ",

    // src/lib/utils/encryptionState.ts
    "encryptionState.unableToDecryptYouMayNot":
        "ܦܬܚܐ ܕܛܘܫܝܐ ܠܐ ܦܠܚܠܗ - ܡܨܐ ܕܠܝܬ ܠܘܟ ܩܠܝܕ̈ܐ ܕܗܕܐ ܐܓܪܬܐ.",
    "encryptionState.theSenderChoseNotToShare":
        "ܫܕܪܢܐ ܓܒܝܠܗ ܕܠܐ ܫܘܬܦ ܩܠܝܕ̈ܐ ܕܗܕܐ ܐܓܪܬܐ.",
    "encryptionState.theSenderDidNotShareThe":
        "ܫܕܪܢܐ ܠܐ ܫܘܬܦܠܗ ܩܠܝܕ̈ܐ ܡܛܠ ܕܗܢܐ ܡܐܢܐ ܠܐ ܝܠܗ ܡܫܪܪܐ. ܫܪܪ ܗܢܐ ܡܐܢܐ ܩܐ ܩܪܝܬܐ ܕܐܓܪ̈ܬܐ ܐܝܟ ܗܕܐ.",
    "encryptionState.encryptedMessage": "🔒 ܐܓܪܬܐ ܡܛܫܝܬܐ",

    // src/lib/utils/eventShield.ts
    "eventShield.thisMessageSEncryptionCouldNot":
        "ܛܘܫܝܐ ܕܗܕܐ ܐܓܪܬܐ ܠܐ ܡܨܐ ܕܡܫܪܪ ܫܠܡܐܝܬ.",
    "eventShield.encryptedByAnUnverifiedUser": "ܡܛܫܝܬܐ ܒܝܕ ܡܦܠܚܢܐ ܠܐ ܡܫܪܪܐ.",
    "eventShield.encryptedByADeviceNotVerified":
        "ܡܛܫܝܬܐ ܒܝܕ ܡܐܢܐ ܕܡܪܗ ܠܐ ܫܪܪܠܗ.",
    "eventShield.encryptedByAnUnknownOrDeleted":
        "ܡܛܫܝܬܐ ܒܝܕ ܡܐܢܐ ܠܐ ܝܕܝܥܐ ܝܢ ܫܝܦܐ.",
    "eventShield.theAuthenticityOfThisEncryptedMessage":
        "ܫܪܝܪܘܬܐ ܕܗܕܐ ܐܓܪܬܐ ܡܛܫܝܬܐ ܠܐ ܡܨܝܐ ܕܡܫܪܪܐ ܥܠ ܗܢܐ ܡܐܢܐ.",
    "eventShield.theSenderWasPreviouslyVerifiedBut":
        "ܫܕܪܢܐ ܡܢ ܩܕܡ ܡܫܪܪܐ ܝܠܗ ܘܐܝܢܐ ܫܚܠܦܠܗ ܗܝܝܘܬܐ ܕܝܗܝ.",
    "eventShield.theSenderDoesnTMatchThe":
        "ܫܕܪܢܐ ܠܐ ܡܙܕܘܓ ܥܡ ܡܪܐ ܕܡܐܢܐ ܕܫܕܪܠܗ ܗܕܐ ܐܓܪܬܐ.",

    // src/lib/utils/extendedProfile.ts
    "extendedProfile.aStatusNeedsBothAnEmoji":
        "ܐܝܟܢܝܘܬܐ ܣܢܝܩܬܐ ܝܠܗ̇ ܠܐܝܡܘܓܝ ܘܟܬܒܐ ܬܪܘܝܗܝ.",
    "extendedProfile.inACall": "ܓܘ ܩܪܝܬܐ",
    "extendedProfile.inACallForMin": "ܓܘ ܩܪܝܬܐ ܩܐ {minutes} ܕܩܝ̈ܩܐ",
    "extendedProfile.inACallForH": "ܓܘ ܩܪܝܬܐ ܩܐ {hours} ܫܥ̈ܐ",
    "extendedProfile.other": "ܐܚܪܢܐ",
    "extendedProfile.atMostLinks": "ܝܬܝܪ ܡܢ ܟܠ {MAX_CONNECTIONS} ܐܣܘܪ̈ܐ.",
    "extendedProfile.linksMustBeHttpHttpsMailto":
        "ܐܣܘܪ̈ܐ ܣܢܝܩ̈ܐ ܝܢ ܕܗܘܝ ܡܘܢܥ̈ܐ ܕ http، https، mailto ܝܢ matrix.",
    "extendedProfile.inACallForHMin": "ܓܘ ܩܪܝܬܐ ܩܐ {hours} ܫܥ̈ܐ {minutes} ܕܩܝ̈ܩܐ",

    // src/lib/utils/geoErrors.ts
    "geoErrors.locationNeedsASecureHttpsConnection":
        "ܕܘܟܬܐ ܣܢܝܩܬܐ ܝܠܗ̇ ܠܐܚܝܕܘܬܐ ܫܠܝܡܬܐ (HTTPS) - ܦܬܘܚ ܬܘܟܢܝܬܐ ܒ https.",
    "geoErrors.locationPermissionWasDeniedCheckSite":
        "ܦܣܐ ܕܕܘܟܬܐ ܠܐ ܩܒܝܠܐ ܝܠܗ - ܒܨܝ ܦܣ̈ܐ ܕܕܘܟܬܐ ܕܘܝܒ.",
    "geoErrors.yourPositionIsUnavailableLocationOff":
        "ܕܘܟܬܐ ܕܝܘܟ ܠܐ ܝܠܗ̇ ܡܫܟܚܬܐ (ܕܘܟܬܐ ܛܦܝܬܐ ܝܢ ܠܝܬ GPS).",
    "geoErrors.timedOutGettingYourLocation": "ܙܒܢܐ ܫܠܡܠܗ ܒܡܫܟܚܐ ܕܘܟܬܐ ܕܝܘܟ.",
    "geoErrors.couldnTGetYourLocation": "ܡܫܟܚܬܐ ܕܕܘܟܬܐ ܕܝܘܟ ܠܐ ܦܠܚܠܗ̇.",
    "geoErrors.locationIsnTAvailableInThis":
        "ܕܘܟܬܐ ܠܐ ܝܠܗ̇ ܡܫܟܚܬܐ ܓܘ ܗܢܐ ܡܦܐܬܢܐ.",

    // src/lib/utils/joinRules.ts
    "joinRules.onlyAvailableForRoomsInsideA": "ܒܣ ܩܐ ܓܘܡ̈ܐ ܕܓܘ ܚܘܕܪܐ",
    "joinRules.thisRoomSVersionDoesnT":
        "ܢܘܣܚܐ ܕܗܢܐ ܓܘܡܐ ܠܐ ܡܣܝܥ ܥܠܠܐ ܡܚܘܕܕܐ ܒܚܘܕܪܐ",

    // src/lib/utils/keyBackup.ts
    "keyBackup.preparing": "ܒܛܘܝܒܐ…",
    "keyBackup.fetchingYourEncryptedHistory": "ܒܡܐܬܝܐ ܬܫܥܝܬܐ ܡܛܫܝܬܐ ܕܝܘܟ…",
    "keyBackup.restoringYourEncryptedHistory": "ܒܕܥܪܐ ܬܫܥܝܬܐ ܡܛܫܝܬܐ ܕܝܘܟ…",
    "keyBackup.restoringOfKeys": "ܒܕܥܪܐ {successes} ܡܢ {total} ܩܠܝܕ̈ܐ…",
    "keyBackup.noEncryptedHistoryToRestore": "ܠܝܬ ܬܫܥܝܬܐ ܡܛܫܝܬܐ ܩܐ ܕܥܪܬܐ",
    "keyBackup.restored":
        "{count, plural, one {# ܩܠܝܕܐ ܕܥܝܪܐ} other {# ܩܠܝܕ̈ܐ ܕܥܝܪ̈ܐ}}",
    "keyBackup.ofKeysRestored": "{imported} ܡܢ {total} ܩܠܝܕ̈ܐ ܕܥܝܪ̈ܐ",
    "keyBackup.notSetUp": "ܠܐ ܡܛܘܝܒܐ",
    "keyBackup.notTrusted": "ܠܐ ܬܟܝܠܐ",
    "keyBackup.notConnected": "ܠܐ ܐܚܝܕܐ",
    "keyBackup.on": "ܕܠܝܩܐ",
    "keyBackup.encryptedMessageHistoryIsnTBeing":
        "ܬܫܥܝܬܐ ܕܐܓܪ̈ܬܐ ܡܛܫܝ̈ܬܐ ܠܐ ܝܠܗ̇ ܢܛܝܪܬܐ. ܛܝܒ ܦܘܪܩܢܐ ܩܐ ܢܛܪܐ ܕܝܗ̇.",
    "keyBackup.aBackupExistsOnTheServer":
        "ܐܝܬ ܢܘܣܚܐ ܕܒܣܬܪ ܥܠ ܣܝܪܒܪ ܐܝܢܐ ܗܢܐ ܓܠܣܐ ܗܠ ܗܫܐ ܠܐ ܬܟܝܠܐ ܥܠܝܗܝ.",
    "keyBackup.aBackupExistsButThisSession":
        "ܐܝܬ ܢܘܣܚܐ ܕܒܣܬܪ ܐܝܢܐ ܗܢܐ ܓܠܣܐ ܠܐ ܝܠܗ ܐܚܝܕܐ ܥܡܗ. ܡܥܠ ܩܠܝܕܐ ܕܦܘܪܩܢܐ ܕܝܘܟ ܩܐ ܕܥܪܬܐ ܕܬܫܥܝܬܐ ܕܝܘܟ.",
    "keyBackup.messageHistoryIsBeingBackedUp":
        "ܬܫܥܝܬܐ ܕܐܓܪ̈ܬܐ ܒܢܛܪܐ ܝܠܗ̇ (v{version}).",
    "keyBackup.messageHistoryIsBeingBackedUp2": "ܬܫܥܝܬܐ ܕܐܓܪ̈ܬܐ ܒܢܛܪܐ ܝܠܗ̇.",
    "keyBackup.noKeysBackedUpYet": "ܠܝܬ ܩܠܝܕ̈ܐ ܢܛܝܪ̈ܐ ܗܠ ܗܫܐ",
    "keyBackup.backedUp":
        "{count, plural, one {# ܩܠܝܕܐ ܢܛܝܪܐ} other {# ܩܠܝܕ̈ܐ ܢܛܝܪ̈ܐ}}",
    "keyBackup.stillToUpload":
        "{count, plural, one {# ܩܠܝܕܐ ܦܝܫܐ ܩܐ ܐܣܩܬܐ} other {# ܩܠܝܕ̈ܐ ܦܝܫ̈ܐ ܩܐ ܐܣܩܬܐ}}",
    "keyBackup.everythingOnThisSessionIsBacked": "ܟܠ ܡܕܡ ܥܠ ܗܢܐ ܓܠܣܐ ܢܛܝܪܐ ܝܠܗ",
    "keyBackup.notSet": "ܠܐ ܡܛܘܝܒܐ",

    // src/lib/utils/keywordRules.ts
    "keywordRules.keywordCannotBeEmpty": "ܡܠܬܐ ܪܫܝܬܐ ܠܐ ܡܨܝܐ ܕܗܘܝܐ ܣܦܝܩܬܐ",
    "keywordRules.keywordCannotStartWith": "ܡܠܬܐ ܪܫܝܬܐ ܠܐ ܡܨܝܐ ܕܫܪܝܐ ܒ '.'",
    "keywordRules.youAlreadyHaveARuleFor": "ܐܝܬ ܠܘܟ ܢܡܘܣܐ ܩܐ ܗܕܐ ܡܠܬܐ ܪܫܝܬܐ",

    // src/lib/utils/liveAnnouncer.ts
    "liveAnnouncer.messageFrom": "ܐܓܪܬܐ ܡܢ {sender}",
    "liveAnnouncer.newMessagesFrom":
        "{count, plural, one {# ܐܓܪܬܐ ܚܕܬܐ ܡܢ {sender}} other {# ܐܓܪ̈ܬܐ ܚܕ̈ܬܐ ܡܢ {sender}}}",
    "liveAnnouncer.newMessages":
        "{count, plural, one {# ܐܓܪܬܐ ܚܕܬܐ} other {# ܐܓܪ̈ܬܐ ܚܕ̈ܬܐ}}",

    // src/lib/utils/liveShareStop.ts
    "liveShareStop.couldnTStopSharingYourLive":
        'ܦܣܩܐ ܕܫܘܬܦܘܬܐ ܕܕܘܟܬܐ ܚܝܬܐ ܕܝܘܟ ܠܐ ܦܠܚܠܗ - ܗܠ ܗܫܐ ܚܙܝܬܐ ܝܠܗ̇ ܠܗܢܐ ܓܘܡܐ. ܦܠܚ ܒ"ܢܣܝ ܦܣܩܐ" ܩܐ ܢܣܝܢܐ ܐܚܪܢܐ.',
    "liveShareStop.stopping": "ܒܦܣܩܐ…",
    "liveShareStop.stillSharingCouldnTStop": "ܗܠ ܗܫܐ ܒܫܘܬܦܐ - ܦܣܩܐ ܠܐ ܦܠܚܠܗ",
    "liveShareStop.youReAlreadySharingYourLive":
        "ܐܢܬ ܡܢ ܩܕܡ ܒܫܘܬܦܐ ܝܘܬ ܕܘܟܬܐ ܚܝܬܐ ܕܝܘܟ ܓܘ ܗܢܐ ܓܘܡܐ.",
    "liveShareStop.yourLastLiveLocationShareHere":
        "ܫܘܬܦܘܬܐ ܐܚܪܝܬܐ ܕܕܘܟܬܐ ܚܝܬܐ ܕܝܘܟ ܗܪܟܐ ܗܠ ܗܫܐ ܠܐ ܦܣܩܠܗ̇ - ܦܣܘܩ ܠܗ̇ ܡܢ ܕܓܠܐ ܕܓܘܡܐ ܩܕܡ ܕܫܪܝܬ ܚܕܬܐ.",
    "liveShareStop.stop": "ܦܣܘܩ",
    "liveShareStop.retryStop": "ܢܣܝ ܦܣܩܐ",

    // src/lib/utils/location.ts
    "location.location": "ܕܘܟܬܐ",

    // src/lib/utils/mediaGallery.ts
    "mediaGallery.of": "{value} ܡܢ {length}{value2}",

    // src/lib/utils/messageActionsMenu.ts
    "messageActionsMenu.edit": "ܬܩܢ",
    "messageActionsMenu.unpin": "ܫܪܝ ܩܒܥܐ",
    "messageActionsMenu.pin": "ܩܒܘܥ",
    "messageActionsMenu.copyLink": "ܢܣܘܚ ܐܣܘܪܐ",
    "messageActionsMenu.report": "ܡܘܕܥ",

    // src/lib/utils/messageDisplay.ts
    "messageDisplay.systemDefault": "ܥܕܝܠܐ ܕܣܝܣܛܡ",

    // src/lib/utils/micErrorMessage.ts
    "micErrorMessage.noMicrophoneFoundConnectOneOr":
        "ܠܐ ܦܝܫܐ ܡܫܟܚܐ ܡܝܩܪܘܦܘܢ - ܐܚܘܕ ܚܕ ܝܢ ܓܒܝ ܡܐܢܐ ܐܚܪܢܐ ܕܡܥܠܢܐ ܩܐ ܥܠܠܐ ܠܩܪܝܬܐ",
    "micErrorMessage.couldNotOpenYourMicrophoneAnother":
        "ܦܬܚܐ ܕܡܝܩܪܘܦܘܢ ܕܝܘܟ ܠܐ ܦܠܚܠܗ - ܡܨܐ ܕܬܘܟܢܝܬܐ ܐܚܪܬܐ ܒܦܠܚܐ ܝܠܗ̇ ܒܗ",

    // src/lib/utils/mutePowerLevel.ts
    "mutePowerLevel.enterAPowerLevel": "ܡܥܠ ܕܪܓܐ ܕܚܝܠܐ",
    "mutePowerLevel.mustBeAWholeNumber": "ܣܢܝܩܐ ܝܠܗ ܕܗܘܐ ܡܢܝܢܐ ܫܠܡܐ",
    "mutePowerLevel.useToMute": "ܦܠܚ ܒ {MUTE_POWER_LEVEL} ܩܐ ܫܬܩܐ",
    "mutePowerLevel.youCanTSetALevel":
        "ܠܐ ܡܨܝܬ ܕܛܝܒܬ ܕܪܓܐ ܥܠܝܐ ܡܢ ܕܝܘܟ ({ceiling})",

    // src/lib/utils/notifActions.ts
    "notifActions.reply": "ܦܢܝ",
    "notifActions.reply2": "ܦܢܝ…",
    "notifActions.markAsRead": "ܢܝܫ ܐܝܟ ܩܪܝܐ",

    // src/lib/utils/notificationPrivacy.ts
    "notificationPrivacy.sentAMessage": "ܫܕܪܠܗ ܐܓܪܬܐ",
    "notificationPrivacy.newMessage": "ܐܓܪܬܐ ܚܕܬܐ",

    // src/lib/utils/notifyPermission.ts
    "notifyPermission.notificationsAreBlockedSoIncomingCalls":
        "ܡܘܕܥܢܘ̈ܬܐ ܟܠܝ̈ܐ ܝܢ، ܗܕܟܐ ܩܪ̈ܝܬܐ ܕܐܬܝܢ ܠܐ ܒܕ ܙܗܪܝ ܠܘܟ ܐܡܬܝ ܕܗܕܐ ܟܘܬܐ ܛܫܝܬܐ ܝܠܗ̇. ܫܪܝ ܟܠܝܐ ܕܡܘܕܥܢܘ̈ܬܐ ܓܘ ܛܘܝܒ̈ܐ ܕܣܝܣܛܡ ܕܝܘܟ.",
    "notifyPermission.thisBrowserCanTShowCall":
        "ܗܢܐ ܡܦܐܬܢܐ ܠܐ ܡܨܐ ܕܚܘܐ ܙܘܗܪ̈ܐ ܕܩܪ̈ܝܬܐ ܐܡܬܝ ܕܟܘܬܐ ܛܫܝܬܐ ܝܠܗ̇.",

    // src/lib/utils/pollContent.ts
    "pollContent.addAQuestion": "ܐܘܣܦ ܫܘܐܠܐ.",
    "pollContent.addAtLeastTwoOptions": "ܐܘܣܦ ܬܪܬܝܢ ܓܒܝ̈ܬܐ ܠܦܚܘܬ ܡܢ ܟܠ.",
    "pollContent.atMostOptions": "ܝܬܝܪ ܡܢ ܟܠ {MAX_ANSWERS} ܓܒܝ̈ܬܐ.",
    "pollContent.invalidNumberOfSelections": "ܡܢܝܢܐ ܠܐ ܬܪܝܨܐ ܕܓܒܝ̈ܬܐ.",
    "pollContent.thePollHasEnded": "ܫܘܐܠܬܐ ܫܠܡܠܗ̇.",

    // src/lib/utils/powerLevels.ts
    "powerLevels.enterAPowerLevel": "ܡܥܠ ܕܪܓܐ ܕܚܝܠܐ",
    "powerLevels.mustBeAWholeNumber": "ܣܢܝܩܐ ܝܠܗ ܕܗܘܐ ܡܢܝܢܐ ܫܠܡܐ",
    "powerLevels.mustBe0OrHigher": "ܣܢܝܩܐ ܝܠܗ ܕܗܘܐ 0 ܝܢ ܥܠܝܐ",
    "powerLevels.youCanTSetALevel":
        "ܠܐ ܡܨܝܬ ܕܛܝܒܬ ܕܪܓܐ ܥܠܝܐ ܡܢ ܕܝܘܟ ({ceiling})",

    // src/lib/utils/presence.ts
    "presence.online": "ܐܘܢܠܐܝܢ",
    "presence.away": "ܠܐ ܦܥܝܠܐ",
    "presence.offline": "ܐܘܦܠܐܝܢ",
    "presence.seenAsOnlineWhileTheApp":
        "ܚܙܝܐ ܐܝܟ ܐܘܢܠܐܝܢ ܐܡܬܝ ܕܬܘܟܢܝܬܐ ܐܚܝܕܬܐ ܝܠܗ̇",
    "presence.shownAsIdleToOtherUsers": "ܡܚܘܝܐ ܐܝܟ ܠܐ ܦܥܝܠܐ ܠܡܦܠܚܢ̈ܐ ܐܚܪ̈ܢܐ",
    "presence.invisible": "ܠܐ ܚܙܝܐ",
    "presence.appearOfflineToOtherUsers": "ܚܙܝܐ ܐܝܟ ܐܘܦܠܐܝܢ ܠܡܦܠܚܢ̈ܐ ܐܚܪ̈ܢܐ",

    // src/lib/utils/pushRuleWrite.ts
    "pushRuleWrite.yourHomeserverHasNoNotificationRule":
        'ܣܝܪܒܪ ܕܒܝܬܐ ܕܝܘܟ ܠܝܬ ܠܗ ܢܡܘܣܐ ܕܡܘܕܥܢܘܬܐ "{label}"، ܗܕܟܐ ܠܐ ܡܨܐ ܕܫܚܠܦ.',
    "pushRuleWrite.yourHomeserverRejectedTheChangeTo":
        'ܣܝܪܒܪ ܕܒܝܬܐ ܕܝܘܟ ܠܐ ܩܒܠܠܗ ܫܘܚܠܦܐ ܕܡܘܕܥܢܘ̈ܬܐ "{label}".',
    "pushRuleWrite.notificationsDidNotChangeOnYour":
        'ܡܘܕܥܢܘ̈ܬܐ "{label}" ܠܐ ܫܚܠܦܠܗܘܢ ܥܠ ܣܝܪܒܪ ܕܒܝܬܐ ܕܝܘܟ.',
    "pushRuleWrite.couldNotSaveNotificationsCheckYour":
        'ܢܛܪܐ ܕܡܘܕܥܢܘ̈ܬܐ "{label}" ܠܐ ܦܠܚܠܗ. ܒܨܝ ܐܚܝܕܘܬܐ ܕܝܘܟ ܘܢܣܝ ܡܢ ܕܪܝܫ.',

    // src/lib/utils/pusherVerification.ts
    "pusherVerification.noGatewayUrl": "(ܠܝܬ URL ܕܬܪܥܐ)",

    // src/lib/utils/recoveryPassphrase.ts
    "recoveryPassphrase.enterAPassphrase": "ܡܥܠ ܦܬܓܡܐ.",
    "recoveryPassphrase.useAtLeastCharacters":
        "ܦܠܚ ܒ {MIN_PASSPHRASE_LENGTH} ܐܬ̈ܘܬܐ ܠܦܚܘܬ ܡܢ ܟܠ.",

    // src/lib/utils/reportMessage.ts
    "reportMessage.failedToSendReport": "ܫܕܪܐ ܕܡܘܕܥܢܘܬܐ ܠܐ ܦܠܚܠܗ",

    // src/lib/utils/roomAliases.ts
    "roomAliases.enterAnAddress": "ܡܥܠ ܡܘܢܥܐ.",
    "roomAliases.addressesCannotContainSpaces":
        "ܡܘܢܥ̈ܐ ܠܐ ܡܨܝ ܕܐܝܬ ܓܘܝܗܝ ܦܘܪ̈ܫܐ.",
    "roomAliases.addressesCannotContain": "ܡܘܢܥ̈ܐ ܠܐ ܡܨܝ ܕܐܝܬ ܓܘܝܗܝ ':'.",
    "roomAliases.addressesCannotContain2": "ܡܘܢܥ̈ܐ ܠܐ ܡܨܝ ܕܐܝܬ ܓܘܝܗܝ '#'.",
    "roomAliases.addressesCannotContainControlCharacters":
        "ܡܘܢܥ̈ܐ ܠܐ ܡܨܝ ܕܐܝܬ ܓܘܝܗܝ ܐܬ̈ܘܬܐ ܕܡܕܒܪܢܘܬܐ.",
    "roomAliases.addressIsTooLongMaxCharacters":
        "ܡܘܢܥܐ ܝܪܝܟܐ ܝܠܗ ܝܬܝܪ (ܝܬܝܪ ܡܢ ܟܠ {MAX_ALIAS_LENGTH} ܐܬ̈ܘܬܐ).",
    "roomAliases.thatAddressAlreadyExists": "ܗܘ ܡܘܢܥܐ ܡܢ ܩܕܡ ܐܝܬܠܗ.",

    // src/lib/utils/roomCreationOutcome.ts
    "roomCreationOutcome.theServerRejectedTheChange": "ܣܝܪܒܪ ܠܐ ܩܒܠܠܗ ܫܘܚܠܦܐ",
    "roomCreationOutcome.theRoomWasCreatedButAdding":
        "ܓܘܡܐ ܒܪܝܐ ܝܠܗ، ܐܝܢܐ ܐܘܣܦܬܐ ܕܝܗܝ ܠܚܘܕܪܐ ܠܐ ܦܠܚܠܗ̇: {detailSentence}",
    "roomCreationOutcome.theDirectMessageWasCreatedBut":
        "ܐܓܪܬܐ ܫܪܝܪܬܐ ܒܪܝܬܐ ܝܠܗ̇، ܐܝܢܐ ܢܛܪܐ ܕܝܗ̇ ܓܘ ܪܫܝܡܬܐ ܕܐܓܪ̈ܬܐ ܫܪܝܪ̈ܬܐ ܕܝܘܟ ܠܐ ܦܠܚܠܗ: {detailSentence} ܡܨܝܐ ܕܚܙܝܐ ܐܝܟ ܓܘܡܐ ܥܕܝܠܐ ܗܕܝܡܐ ܕܗܕܐ ܡܢ ܕܪܝܫ ܡܢܣܝܐ.",
    "roomCreationOutcome.theRoomWasCreatedButAdding2":
        "ܓܘܡܐ ܒܪܝܐ ܝܠܗ، ܐܝܢܐ ܐܘܣܦܬܐ ܕܝܗܝ ܠܚܘܕܪܐ ܗܠ ܗܫܐ ܠܐ ܝܠܗ̇ ܡܫܪܪܬܐ - ܡܨܝܐ ܕܗܠ ܗܫܐ ܒܢܛܪܐ ܝܠܗ̇. ܢܣܝ ܡܢ ܕܪܝܫ ܐܢ ܓܘܡܐ ܠܐ ܚܙܐ ܓܘ ܚܘܕܪܐ.",
    "roomCreationOutcome.theDirectMessageWasCreatedBut2":
        "ܐܓܪܬܐ ܫܪܝܪܬܐ ܒܪܝܬܐ ܝܠܗ̇، ܐܝܢܐ ܢܛܪܐ ܕܝܗ̇ ܓܘ ܪܫܝܡܬܐ ܕܐܓܪ̈ܬܐ ܫܪܝܪ̈ܬܐ ܕܝܘܟ ܗܠ ܗܫܐ ܠܐ ܝܠܗ ܡܫܪܪܐ - ܡܨܐ ܕܗܠ ܗܫܐ ܒܢܛܪܐ ܝܠܗ. ܢܣܝ ܡܢ ܕܪܝܫ ܐܢ ܠܐ ܚܙܝܐ ܓܘ ܪܫܝܡܬܐ ܕܝܘܟ.",

    // src/lib/utils/roomEncryption.ts
    "roomEncryption.thisRoomIsAlreadyEncrypted": "ܗܢܐ ܓܘܡܐ ܡܢ ܩܕܡ ܡܛܫܝܐ ܝܠܗ.",
    "roomEncryption.youNeedPowerLevelToEnable":
        "ܣܢܝܩܐ ܝܘܬ ܠܕܪܓܐ ܕܚܝܠܐ {required} ܩܐ ܕܠܩܐ ܕܛܘܫܝܐ.",
    "roomEncryption.youAlreadyHaveADirectMessage":
        "ܐܝܬ ܠܘܟ ܡܢ ܩܕܡ ܐܓܪܬܐ ܫܪܝܪܬܐ ܥܡ ܗܢܐ ܡܦܠܚܢܐ، ܘܠܐ ܝܠܗ̇ ܡܛܫܝܬܐ. ܛܘܫܝܐ ܠܐ ܡܨܐ ܕܡܘܣܦ ܐܘܛܘܡܛܝܩܐܝܬ - ܦܬܘܚ ܠܗ̇ ܘܕܠܩ ܠܗ ܡܢ ܛܘܝܒ̈ܐ ܕܫܠܡܘܬܐ ܕܓܘܡܐ.",
    "roomEncryption.enableEncryptionWarning":
        "ܛܘܫܝܐ ܠܐ ܦܝܫ ܛܦܝܐ ܒܬܪ ܕܕܠܩܐ. ܟܠ ܢܫܐ ܒܕ ܣܢܝܩܐ ܗܘܐ ܠܬܘܟܢܝܬܐ ܕܡܣܝܥܐ ܛܘܫܝܐ ܩܐ ܩܪܝܬܐ ܕܐܓܪ̈ܬܐ ܚܕ̈ܬܐ.",

    // src/lib/utils/roomHeaderMenu.ts
    "roomHeaderMenu.threads": "ܚܘ̈ܛܐ",
    "roomHeaderMenu.pinnedMessages": "ܐܓܪ̈ܬܐ ܩܒܝܥ̈ܬܐ",
    "roomHeaderMenu.notificationsInbox": "ܨܢܕܘܩܐ ܕܡܘܕܥܢܘ̈ܬܐ",
    "roomHeaderMenu.mediaAndFiles": "ܡܝܕܝܐ ܘܦܐܝܠ̈ܐ",
    "roomHeaderMenu.memberList": "ܪܫܝܡܬܐ ܕܗܕܡ̈ܐ",

    // src/lib/utils/roomMedia.ts
    "roomMedia.image": "ܨܘܪܬܐ",
    "roomMedia.video": "ܒܝܕܝܘ",
    "roomMedia.file": "ܦܐܝܠ",
    "roomMedia.audio": "ܩܠܐ",
    "roomMedia.kb": "{toFixed} KB",
    "roomMedia.mb": "{toFixed} MB",

    // src/lib/utils/roomSettingsNav.ts
    "roomSettingsNav.general": "ܓܢܣܝܐ",
    "roomSettingsNav.access": "ܡܥܠܬܐ",
    "roomSettingsNav.security": "ܫܠܡܘܬܐ",
    "roomSettingsNav.permissions": "ܦܣ̈ܐ",
    "roomSettingsNav.members": "ܗܕܡ̈ܐ",
    "roomSettingsNav.emotes": "ܐܝܡܘܓܝ",
    "roomSettingsNav.rooms": "ܓܘܡ̈ܐ",

    // src/lib/utils/roomStateTrust.ts
    "roomStateTrust.unverifiedRoomState": "ܐܝܟܢܝܘܬܐ ܕܓܘܡܐ ܠܐ ܡܫܪܪܬܐ",
    "roomStateTrust.unverifiedRoomStateTooltip":
        "ܦܪ̈ܝܛܐ ܕܗܢܐ ܓܘܡܐ (ܬܦܩܝ̈ܕܐ، ܗܕܡܘܬܐ ܘܦܣ̈ܐ) ܫܪܝܪܐܝܬ ܡܐܬܝ̈ܐ ܝܢ ܡܢ ܣܝܪܒܪ ܘܗܠ ܗܫܐ ܠܐ ܝܢ ܡܫܪܪ̈ܐ ܒܐܚܕܝܘܬܐ، ܗܕܟܐ ܡܨܝ ܕܗܘܝ ܠܐ ܬܪܝܨ̈ܐ. ܣܝܪܒܪ ܗܠ ܗܫܐ ܡܕܒܪ ܣܘܥܪ̈ܢܐ ܠܐ ܗܘܐ ܡܐ ܕܚܙܝܐ ܝܠܗ ܗܪܟܐ.",

    // src/lib/utils/roomUpgrade.ts
    "roomUpgrade.theServerSRecommendedRoomVersion":
        "ܢܘܣܚܐ ܕܓܘܡܐ ܕܣܝܪܒܪ ܡܦܝܣ ܠܐ ܝܠܗ ܡܫܟܚܐ.",
    "roomUpgrade.thisRoomIsOnTheLatest":
        "ܗܢܐ ܓܘܡܐ ܥܠ ܢܘܣܚܐ ܐܚܪܝܐ ܝܠܗ (v{recommendedVersion}).",
    "roomUpgrade.youDonTHavePermissionTo": "ܠܝܬ ܠܘܟ ܦܣܐ ܠܡܥܠܝܢܘܬܐ ܕܗܢܐ ܓܘܡܐ.",

    // src/lib/utils/saveFile.ts
    "saveFile.savedToDownloads": "ܢܛܝܪܐ ܓܘ Downloads",

    // src/lib/utils/securityStatusView.ts
    "securityStatusView.couldnTReadThisAccountS":
        "ܩܪܝܬܐ ܕܐܝܟܢܝܘܬܐ ܕܛܘܫܝܐ ܕܗܢܐ ܚܘܫܒܢܐ ܠܐ ܦܠܚܠܗ̇. ܠܝܬ ܡܕܡ ܬܟܝܠܐ ܗܪܟܐ ܗܕܝܡܐ ܕܛܥܢܐ - ܠܐ ܛܝܒ ܝܢ ܚܕܬ ܦܘܪܩܢܐ ܗܠ ܗܫܐ.",
    "securityStatusView.encryptionIsnTReadyOnThis":
        "ܛܘܫܝܐ ܗܠ ܗܫܐ ܠܐ ܝܠܗ ܡܛܝܒܐ ܒܗܢܐ ܓܠܣܐ. ܛܥܘܢ ܡܢ ܕܪܝܫ ܐܢ ܗܕܐ ܦܝܫܐ.",

    // src/lib/utils/serverAcl.ts
    "serverAcl.allowListIsEmptyWhichDenies":
        "ܪܫܝܡܬܐ ܕܩܒܝܠ̈ܐ ܣܦܝܩܬܐ ܝܠܗ̇، ܘܗܕܐ ܟܠܝܐ ܟܠ ܣܝܪܒܪ̈ܐ ܡܢ ܚܘܝܕܐ.",
    "serverAcl.denyListContainsWhichBansAll":
        "ܪܫܝܡܬܐ ܕܠܐ ܩܒܝܠ̈ܐ ܐܝܬ ܓܘܗ̇ *، ܘܗܕܐ ܐܣܪܐ ܟܠ ܣܝܪܒܪ̈ܐ.",
    "serverAcl.thisConfigurationBansYourOwnServer":
        "ܗܢܐ ܛܘܝܒܐ ܐܣܪܐ ܣܝܪܒܪ ܕܝܘܟ ({ownServerName})، ܘܗܕܐ ܒܕ ܬܒܪܐ ܚܘܝܕܐ.",

    // src/lib/utils/serverCapabilities.ts
    "serverCapabilities.crossSigningE2ee": "ܚܬܡܐ ܚܠܦܢܝܐ (E2EE)",
    "serverCapabilities.privateReadReceipts": "ܩܘܒܠ̈ܐ ܕܩܪܝܬܐ ܟܣܝ̈ܐ",
    "serverCapabilities.threadedRelations": "ܐܣܘܪ̈ܐ ܕܚܘ̈ܛܐ",
    "serverCapabilities.spaceSummaries": "ܟܪ̈ܝܘܬܐ ܕܚܘܕܪ̈ܐ",
    "serverCapabilities.busyPresence": "ܐܝܬܝܘܬܐ ܕܥܢܝܢܘܬܐ",
    "serverCapabilities.dehydratedDevices": "ܡܐܢ̈ܐ ܝܒܝܫ̈ܐ",
    "serverCapabilities.filterPublicRoomsByType": "ܦܪܘܫ ܓܘܡ̈ܐ ܓܠܝ̈ܐ ܒܙܢܐ",
    "serverCapabilities.authenticatedMedia": "ܡܝܕܝܐ ܡܫܪܪܬܐ",
    "serverCapabilities.intentionalMentions": "ܕܘܟܪܢ̈ܐ ܒܨܒܝܢܐ",
    "serverCapabilities.slidingSyncSimplified": "ܐܚܕܝܘܬܐ ܓܠܝܫܬܐ (ܦܫܝܛܬܐ)",
    "serverCapabilities.sharedRoomsWithAUser": "ܓܘܡ̈ܐ ܓܘܢܝ̈ܐ ܥܡ ܡܦܠܚܢܐ",

    // src/lib/utils/settingsNav.ts
    "settingsNav.account": "ܚܘܫܒܢܐ",
    "settingsNav.securitySessions": "ܫܠܡܘܬܐ ܘܓܠܣ̈ܐ",
    "settingsNav.privacySafety": "ܦܪܝܫܘܬܐ ܘܫܠܡܘܬܐ",
    "settingsNav.app": "ܬܘܟܢܝܬܐ",
    "settingsNav.appearance": "ܚܙܘܐ",
    "settingsNav.messagesMedia": "ܐܓܪ̈ܬܐ ܘܡܝܕܝܐ",
    "settingsNav.voiceVideo": "ܩܠܐ ܘܒܝܕܝܘ",
    "settingsNav.emotes": "ܐܝܡܘܓܝ",
    "settingsNav.advanced": "ܡܬܩܕܡܐ",
    "settingsNav.general": "ܓܢܣܝܐ",
    "settingsNav.plugins": "ܬܘܣܦ̈ܬܐ",
    "settingsNav.server": "ܣܝܪܒܪ",
    "settingsNav.about": "ܥܠ ܬܘܟܢܝܬܐ",
    "settingsNav.debug": "ܬܘܪܨܐ ܕܦܘܕ̈ܐ",

    // src/lib/utils/settingsSearch.ts
    "settingsSearch.displayName": "ܫܡܐ ܕܚܙܝܐ",
    "settingsSearch.avatar": "ܨܘܪܬܐ",
    "settingsSearch.presence": "ܐܝܬܝܘܬܐ",
    "settingsSearch.changePassword": "ܫܚܠܦ ܡܠܬܐ ܕܥܒܪܐ",
    "settingsSearch.logOut": "ܦܘܩ",
    "settingsSearch.deactivateAccount": "ܒܛܠ ܚܘܫܒܢܐ",
    "settingsSearch.sessions": "ܓܠܣ̈ܐ",
    "settingsSearch.encryptNewDirectMessages": "ܛܫܝ ܐܓܪ̈ܬܐ ܫܪܝܪ̈ܬܐ ܚܕ̈ܬܐ",
    "settingsSearch.onlySendToVerifiedDevices": "ܫܕܪ ܒܣ ܠܡܐܢ̈ܐ ܡܫܪܪ̈ܐ",
    "settingsSearch.setUpRecovery": "ܛܝܒ ܦܘܪܩܢܐ",
    "settingsSearch.restoreMessageHistory": "ܕܥܘܪ ܬܫܥܝܬܐ ܕܐܓܪ̈ܬܐ",
    "settingsSearch.verifyThisSession": "ܫܪܪ ܗܢܐ ܓܠܣܐ",
    "settingsSearch.rightAlignMyMessages": "ܣܕܪ ܐܓܪ̈ܬܝ ܠܓܢܒܐ ܐܚܪܢܐ",
    "settingsSearch.showWhenIAmInA": "ܚܘܝ ܐܡܬܝ ܕܐܝܬܝ ܓܘ ܩܪܝܬܐ",
    "settingsSearch.showNameColours": "ܚܘܝ ܓܘܢ̈ܐ ܕܫܡ̈ܗܐ",
    "settingsSearch.textSize": "ܡܫܘܚܬܐ ܕܟܬܒܐ",
    "settingsSearch.font": "ܛܘܦܣܐ ܕܐܬ̈ܘܬܐ",
    "settingsSearch.themePresets": "ܬܚܙܝ̈ܬܐ ܕܓܘܢ̈ܐ",
    "settingsSearch.importExportTheme": "ܡܥܠ / ܡܦܩ ܬܚܙܝܬܐ",
    "settingsSearch.timeFormat": "ܛܘܦܣܐ ܕܫܥܬܐ",
    "settingsSearch.dateFormat": "ܛܘܦܣܐ ܕܬܐܪܝܟܐ",
    "settingsSearch.showMatrixIds": "ܚܘܝ ܗܝܝܘ̈ܬܐ ܕ Matrix",
    "settingsSearch.readReceiptAvatars": "ܨܘܪ̈ܝܬܐ ܕܩܘܒܠ̈ܐ ܕܩܪܝܬܐ",
    "settingsSearch.linkPreviews": "ܚܙܝ̈ܬܐ ܩܕܡܝ̈ܬܐ ܕܐܣܘܪ̈ܐ",
    "settingsSearch.linkPreviewMedia": "ܡܝܕܝܐ ܕܚܙܝܬܐ ܩܕܡܝܬܐ ܕܐܣܘܪ̈ܐ",
    "settingsSearch.pauseVideosOffScreen": "ܦܣܘܩ ܒܝܕܝܘ̈ܐ ܠܒܪ ܡܢ ܡܚܙܝܬܐ",
    "settingsSearch.holdToOpenMessageMenu": "ܐܚܘܕ ܩܐ ܦܬܚܐ ܪܫܝܡܬܐ ܕܐܓܪܬܐ",
    "settingsSearch.gifDefaultTab": "ܠܘܚܐ ܥܕܝܠܐ ܕ GIF",
    "settingsSearch.minimiseToTrayOnClose": "ܙܥܘܪ ܠܣܠܐ ܒܣܟܪܐ",
    "settingsSearch.reduceMotion": "ܒܨܪ ܙܘܥܐ",
    "settingsSearch.keepRoomListOpen": "ܦܘܫ ܪܫܝܡܬܐ ܕܓܘܡ̈ܐ ܦܬܝܚܬܐ",
    "settingsSearch.customEmotes": "ܐܝܡܘܓܝ ܦܪܨܘܦܝܐ",
    "settingsSearch.pushNotificationsPermission": "ܦܣܐ ܕܡܘܕܥܢܘ̈ܬܐ",
    "settingsSearch.notificationSound": "ܩܠܐ ܕܡܘܕܥܢܘܬܐ",
    "settingsSearch.desktopAlertsPopUpAndTaskbar":
        "ܙܘܗܪ̈ܐ ܕܡܚܫܒܐ (ܟܘܬܐ ܕܫܘܪ ܘܒܪܩܐ ܕܣܪܓܐ ܕܥܒܕ̈ܐ)",
    "settingsSearch.quietOnMyOtherDevices": "ܫܬܝܩܐ ܥܠ ܡܐܢ̈ܐ ܐܚܪ̈ܢܐ ܕܝܝ",
    "settingsSearch.privateReadReceipts": "ܩܘܒܠ̈ܐ ܕܩܪܝܬܐ ܟܣܝ̈ܐ",
    "settingsSearch.hideMessageTextInNotifications":
        "ܛܫܝ ܟܬܒܐ ܕܐܓܪ̈ܬܐ ܓܘ ܡܘܕܥܢܘ̈ܬܐ",
    "settingsSearch.notificationRules": "ܢܡܘܣ̈ܐ ܕܡܘܕܥܢܘ̈ܬܐ",
    "settingsSearch.keywordHighlights": "ܢܘܗܪ̈ܐ ܕܡܠ̈ܐ ܪܫܝ̈ܬܐ",
    "settingsSearch.inputDevice": "ܡܐܢܐ ܕܡܥܠܢܐ",
    "settingsSearch.outputDevice": "ܡܐܢܐ ܕܡܦܩܢܐ",
    "settingsSearch.camera": "ܟܡܪܐ",
    "settingsSearch.noiseSuppression": "ܒܨܘܪܐ ܕܩܠ̈ܐ ܕܒܣܬܪ",
    "settingsSearch.echoCancellation": "ܒܘܛܠܐ ܕܩܠܐ ܕܗܦܟ",
    "settingsSearch.autoGainControl": "ܡܕܒܪܢܘܬܐ ܐܘܛܘܡܛܝܩܝܬܐ ܕܪܡܘܬܐ",
    "settingsSearch.mirrorMyCamera": "ܚܘܝ ܟܡܪܐ ܕܝܝ ܐܝܟ ܡܚܙܝܬܐ",
    "settingsSearch.callVolume": "ܪܡܘܬܐ ܕܩܠܐ ܕܩܪܝܬܐ",
    "settingsSearch.playCallSounds": "ܦܠܚ ܩܠ̈ܐ ܕܩܪ̈ܝܬܐ",
    "settingsSearch.ringForIncomingDmCalls":
        "ܩܪܝ ܩܐ ܩܪ̈ܝܬܐ ܕܐܬܝܢ ܡܢ ܐܓܪ̈ܬܐ ܫܪܝܪ̈ܬܐ",
    "settingsSearch.blockedUsers": "ܡܦܠܚܢ̈ܐ ܟܠܝ̈ܐ",
    "settingsSearch.serverCapabilities": "ܡܨܝܘ̈ܬܐ ܕܣܝܪܒܪ",
    "settingsSearch.plugins": "ܬܘܣܦ̈ܬܐ",
    "settingsSearch.pluginRepositories": "ܓܙ̈ܐ ܕܬܘܣܦ̈ܬܐ",
    "settingsSearch.syncPlugins": "ܐܚܕ ܬܘܣܦ̈ܬܐ",
    "settingsSearch.checkForUpdates": "ܒܨܝ ܚܘܕ̈ܬܐ",
    "settingsSearch.clearCache": "ܫܘܦ ܓܙܐ",
    "settingsSearch.showAllEvents": "ܚܘܝ ܟܠ ܓܕܫ̈ܐ",
    "settingsSearch.pushDiagnostics": "ܒܘܚܢܐ ܕܡܘܕܥܢܘ̈ܬܐ",
    "settingsSearch.language": "ܠܫܢܐ",

    // src/lib/utils/slashCommands.ts
    "slashCommands.createAPoll": "ܒܪܝ ܫܘܐܠܬܐ",
    "slashCommands.shareYourLocation": "ܫܘܬܦ ܕܘܟܬܐ ܕܝܘܟ",
    "slashCommands.joinARoomByAddress": "ܥܘܠ ܠܓܘܡܐ ܒܡܘܢܥܐ",
    "slashCommands.leaveTheCurrentRoom": "ܫܒܘܩ ܓܘܡܐ ܗܫܝܐ",
    "slashCommands.inviteAUserToThisRoom": "ܙܡܢ ܡܦܠܚܢܐ ܠܗܢܐ ܓܘܡܐ",
    "slashCommands.setTheRoomTopic": "ܛܝܒ ܢܝܫܐ ܕܓܘܡܐ",
    "slashCommands.removeAUserFromThisRoom": "ܫܩܘܠ ܡܦܠܚܢܐ ܡܢ ܗܢܐ ܓܘܡܐ",
    "slashCommands.userServerReason": "<@user:server> [ܥܠܬܐ]",
    "slashCommands.banAUserFromThisRoom": "ܐܣܘܪ ܡܦܠܚܢܐ ܡܢ ܗܢܐ ܓܘܡܐ",
    "slashCommands.setYourDisplayName": "ܛܝܒ ܫܡܐ ܕܝܘܟ ܕܚܙܝܐ",
    "slashCommands.displayName": "<ܫܡܐ ܕܚܙܝܐ>",
    "slashCommands.setAUserSPowerLevel": "ܛܝܒ ܕܪܓܐ ܕܚܝܠܐ ܕܡܦܠܚܢܐ",
    "slashCommands.userServerLevel": "<@user:server> [ܕܪܓܐ]",
    "slashCommands.resetAUserSPowerLevel": "ܕܥܘܪ ܕܪܓܐ ܕܚܝܠܐ ܕܡܦܠܚܢܐ ܠܥܕܝܠܐ",
    "slashCommands.usage": "ܦܘܠܚܢܐ: /{name} {argHint}",
    "slashCommands.usage2": "ܦܘܠܚܢܐ: /{name}",

    // src/lib/utils/syncStatus.ts
    "syncStatus.connected": "ܐܚܝܕܐ",
    "syncStatus.reconnecting": "ܒܐܚܕܐ ܡܢ ܕܪܝܫ…",
    "syncStatus.connectionError": "ܦܘܕܐ ܕܐܚܝܕܘܬܐ",
    "syncStatus.offline": "ܠܐ ܐܚܝܕܐ",
    "syncStatus.connecting": "ܒܐܚܕܐ…",

    // src/lib/utils/themePalette.ts
    "themePalette.accent": "ܓܘܢܐ ܪܫܝܐ",
    "themePalette.background": "ܒܣܬܪܐ",
    "themePalette.secondaryBackground": "ܒܣܬܪܐ ܬܪܝܢܝܐ",
    "themePalette.tertiaryBackground": "ܒܣܬܪܐ ܬܠܝܬܝܐ",
    "themePalette.primaryText": "ܟܬܒܐ ܪܫܝܐ",
    "themePalette.secondaryText": "ܟܬܒܐ ܬܪܝܢܝܐ",
    "themePalette.mutedText": "ܟܬܒܐ ܕܥܝܟܐ",
    "themePalette.danger": "ܣܘܟܢܐ",
    "themePalette.positive": "ܛܒܐ",
    "themePalette.mentionHighlight": "ܢܘܗܪܐ ܕܕܘܟܪܢܐ",
    "themePalette.link": "ܐܣܘܪܐ",
    "themePalette.warning": "ܙܘܗܪܐ",
    "themePalette.onlineStatus": "ܐܝܟܢܝܘܬܐ ܐܘܢܠܐܝܢ",
    "themePalette.idleStatus": "ܐܝܟܢܝܘܬܐ ܠܐ ܦܥܝܠܬܐ",
    "themePalette.doNotDisturbStatus": "ܐܝܟܢܝܘܬܐ ܠܐ ܡܫܓܫ",
    "themePalette.offlineStatus": "ܐܝܟܢܝܘܬܐ ܐܘܦܠܐܝܢ",
    "themePalette.divider": "ܦܪܘܫܐ",
    "themePalette.spoilerBackground": "ܒܣܬܪܐ ܕܛܘܫܝܐ",
    "themePalette.ownMessageBubble": "ܒܥܒܘܥܐ ܕܐܓܪ̈ܬܐ ܕܝܝ",
    "themePalette.primaryTextOnBackground": "ܟܬܒܐ ܪܫܝܐ ܥܠ ܒܣܬܪܐ",
    "themePalette.secondaryTextOnBackground": "ܟܬܒܐ ܬܪܝܢܝܐ ܥܠ ܒܣܬܪܐ",
    "themePalette.mutedTextOnTertiaryBackground": "ܟܬܒܐ ܕܥܝܟܐ ܥܠ ܒܣܬܪܐ ܬܠܝܬܝܐ",
    "themePalette.whiteTextOnAccentButtons": "ܟܬܒܐ ܚܘܪܐ ܥܠ ܙܪ̈ܐ ܕܓܘܢܐ ܪܫܝܐ",
    "themePalette.whiteTextOnDangerButtons": "ܟܬܒܐ ܚܘܪܐ ܥܠ ܙܪ̈ܐ ܕܣܘܟܢܐ",
    "themePalette.whiteTextOnOwnBubble": "ܟܬܒܐ ܚܘܪܐ ܥܠ ܒܥܒܘܥܐ ܕܝܝ",

    // src/lib/utils/themePreset.ts
    "themePreset.copy": "{newName} (ܢܘܣܚܐ)",

    // src/lib/utils/threadList.ts
    "threadList.noPreview": "(ܠܝܬ ܚܙܝܬܐ ܩܕܡܝܬܐ)",

    // src/lib/utils/threePidInvite.ts
    "threePidInvite.youDonTHavePermissionTo":
        "ܠܝܬ ܠܘܟ ܦܣܐ ܠܙܘܡܢܐ ܕܢܫ̈ܐ ܠܗܢܐ ܓܘܡܐ.",
    "threePidInvite.yourHomeserverHasNoIdentityServer":
        "ܣܝܪܒܪ ܕܒܝܬܐ ܕܝܘܟ ܠܝܬ ܠܗ ܣܝܪܒܪ ܕܗܝܝܘܬܐ، ܗܕܟܐ ܙܘܡܢ̈ܐ ܒܐܝܡܝܠ ܠܐ ܝܢ ܡܫܟܚ̈ܐ.",

    // src/lib/utils/timeFormat.ts
    "timeFormat.yesterdayAt": "ܬܡܠ ܒ {time}",
    "timeFormat.today": "ܐܕܝܘܡ",
    "timeFormat.yesterday": "ܬܡܠ",
    "timeFormat.separatorDatePattern": "EEEE، d MMMM yyyy",
    "timeFormat.monthDayPattern": "d MMMM",
    "timeFormat.compactDateTime": "{date}، {time}",

    // src/lib/utils/updateStatus.ts
    "updateStatus.checkingForUpdates": "ܒܒܨܝܐ ܚܘܕ̈ܬܐ…",
    "updateStatus.youReOnTheLatestVersion":
        "ܗܢܐ ܝܠܗ ܢܘܣܚܐ ܐܚܪܝܐ{versionSuffix}",
    "updateStatus.checkForUpdates": "ܒܨܝ ܚܘܕ̈ܬܐ",
    "updateStatus.updateAvailable": "ܐܝܬ ܚܘܕܬܐ{versionSuffix}",
    "updateStatus.downloadInstall": "ܐܚܬ ܘܢܨܘܒ",
    "updateStatus.downloadingV": "ܒܐܚܬܐ v{version}",
    "updateStatus.downloadingUpdate": "ܒܐܚܬܐ ܚܘܕܬܐ",
    "updateStatus.updateReadyInstall": "ܚܘܕܬܐ ܡܛܝܒܬܐ ܝܠܗ̇{versionSuffix} - ܢܨܘܒ",
    "updateStatus.install": "ܢܨܘܒ",
    "updateStatus.updateReadyRestartToApply":
        "ܚܘܕܬܐ ܡܛܝܒܬܐ ܝܠܗ̇{versionSuffix} - ܫܪܝ ܡܢ ܕܪܝܫ ܩܐ ܦܠܚܬܐ",
    "updateStatus.restartToApply": "ܫܪܝ ܡܢ ܕܪܝܫ ܩܐ ܦܠܚܬܐ",
    "updateStatus.aNewVersionIsAvailable": "ܐܝܬ ܢܘܣܚܐ ܚܕܬܐ{versionSuffix}",
    "updateStatus.openReleasePage": "ܦܬܘܚ ܦܐܬܐ ܕܢܘܣܚܐ",
    "updateStatus.updateCheckFailed": "ܒܘܨܝܐ ܕܚܘܕ̈ܬܐ ܠܐ ܦܠܚܠܗ",
    "updateStatus.checkForUpdatesToInstallThe":
        "ܒܨܝ ܚܘܕ̈ܬܐ ܩܐ ܢܨܒܬܐ ܕܢܘܣܚܐ ܐܚܪܝܐ.",

    // src/lib/utils/uploadLimits.ts
    "uploadLimits.mb": "{round} MB",
    "uploadLimits.kb": "{round} KB",
    "uploadLimits.exceedsTheServerSUploadLimit":
        '"{fileName}" ܝܬܝܪ ܝܠܗ ܡܢ ܚܘܕܕܐ ܕܐܣܩܬܐ ܕܣܝܪܒܪ ({formatByteLimit})',

    // src/lib/utils/verificationMessage.ts
    "verificationMessage.verificationRequestSent": "ܒܥܝܬܐ ܕܫܘܪܪܐ ܫܕܝܪܬܐ ܝܠܗ̇",
    "verificationMessage.waitingForThemToAccept": "ܒܢܛܪܐ ܩܐ ܕܩܒܠܝ…",
    "verificationMessage.noLongerPending": "ܠܐ ܝܠܗ̇ ܕܡܢܛܪܐ ܒܬܪ ܗܕܐ",
    "verificationMessage.wantsToVerify": "{senderName} ܒܥܐ ܕܫܪܪ",
    "verificationMessage.compareEmojiToConfirmThisIs":
        "ܦܚܘܡ ܐܝܡܘܓܝ ܩܐ ܫܘܪܪܐ ܕܗܢܐ ܫܪܝܪܐܝܬ ܐܢܝ̈ ܝܢ",
    "verificationMessage.sentAVerificationRequest":
        "{senderName} ܫܕܪܠܗ ܒܥܝܬܐ ܕܫܘܪܪܐ",

    // src/lib/utils/verificationStatus.ts
    "verificationStatus.checkingEncryption": "ܒܒܨܝܐ ܛܘܫܝܐ…",
    "verificationStatus.encryptionUnavailable": "ܛܘܫܝܐ ܠܐ ܡܫܟܚܐ",
    "verificationStatus.statusUnavailable": "ܐܝܟܢܝܘܬܐ ܠܐ ܡܫܟܚܬܐ",
    "verificationStatus.verified": "ܡܫܪܪܐ",
    "verificationStatus.thisSessionIsVerifiedAndEncryption":
        "ܗܢܐ ܓܠܣܐ ܡܫܪܪܐ ܝܠܗ ܘܛܘܫܝܐ ܫܠܡܐܝܬ ܡܛܘܝܒܐ ܝܠܗ.",
    "verificationStatus.notSetUp": "ܠܐ ܡܛܘܝܒܐ",
    "verificationStatus.setUpEncryptionToSecureYour":
        "ܛܝܒ ܛܘܫܝܐ ܩܐ ܢܛܪܐ ܕܐܓܪ̈ܬܐ ܕܝܘܟ ܒܟܠ ܡܐܢ̈ܐ.",
    "verificationStatus.setUp": "ܛܝܒ",
    "verificationStatus.encryptionSetupIncomplete": "ܛܘܝܒܐ ܕܛܘܫܝܐ ܠܐ ܝܠܗ ܫܠܡܐ",
    "verificationStatus.thisSessionIsVerifiedButEncryption":
        "ܗܢܐ ܓܠܣܐ ܡܫܪܪܐ ܝܠܗ، ܐܝܢܐ ܛܘܝܒܐ ܕܛܘܫܝܐ ܠܐ ܝܠܗ ܫܠܡܐ.",
    "verificationStatus.finishSetup": "ܫܠܡ ܛܘܝܒܐ",
    "verificationStatus.unverified": "ܠܐ ܡܫܪܪܐ",
    "verificationStatus.thisSessionIsnTVerifiedYet":
        "ܗܢܐ ܓܠܣܐ ܗܠ ܗܫܐ ܠܐ ܝܠܗ ܡܫܪܪܐ.",

    // src/routes/+layout.svelte
    "rootLayout.linkCopied": "ܐܣܘܪܐ ܢܣܝܚܐ ܝܠܗ",

    // src/routes/+page.svelte
    "rootPage.failedToReconnectPleaseLogIn":
        "ܐܚܕܐ ܡܢ ܕܪܝܫ ܠܐ ܦܠܚܠܗ. ܒܒܥܘܬܐ ܥܘܠ ܡܢ ܕܪܝܫ.",
    "rootPage.signedInButSyncingCouldNot":
        "ܥܠܝܠܐ ܝܘܬ، ܐܝܢܐ ܐܚܕܝܘܬܐ ܠܐ ܡܨܝܐ ܕܫܪܝܐ. ܒܒܥܘܬܐ ܢܣܝ ܡܢ ܕܪܝܫ.",
    "rootPage.yourSessionHasExpiredPleaseSign":
        "ܓܠܣܐ ܕܝܘܟ ܡܛܠܗ ܠܫܘܠܡܐ. ܒܒܥܘܬܐ ܥܘܠ ܡܢ ܕܪܝܫ.",

    // ownStatus
    "ownStatus.profileField": "ܚܩܠܐ ܕܦܪܨܘܦܐ {key}",
    "ownStatus.theServerStillHas": "ܣܝܪܒܪ ܗܠ ܗܫܐ ܐܝܬ ܠܗ: {leftovers}",
    "ownStatus.statusClearedButPresenceRemains":
        'ܐܝܟܢܝܘܬܐ ܫܝܦܬܐ ܝܠܗ̇، ܐܝܢܐ ܣܝܪܒܪ ܗܠ ܗܫܐ ܡܚܘܐ ܐܓܪܬܐ ܕܐܝܬܝܘܬܐ "{presenceLeft}". ܡܨܐ ܕܓܠܣܐ ܐܚܪܢܐ ܕܗܢܐ ܚܘܫܒܢܐ (ܬܘܟܢܝܬܐ ܐܚܪܬܐ) ܛܝܒܠܗ̇ - ܫܘܦ ܠܗ̇ ܬܡܢ، ܝܢ ܦܘܩ ܡܢ ܗܘ ܓܠܣܐ.',
};

// The Assyrian calendar: Kanun, Shvat, Adar ...; khad-b-shabba ... shabta.
const catalogue: LocaleCatalogue = {
    messages,
    dates: {
        months: [
            "ܟܢܘܢ ܐܚܪܝܐ",
            "ܫܒܛ",
            "ܐܕܪ",
            "ܢܝܣܢ",
            "ܐܝܪ",
            "ܚܙܝܪܢ",
            "ܬܡܘܙ",
            "ܐܒ",
            "ܐܝܠܘܠ",
            "ܬܫܪܝܢ ܩܕܡܝܐ",
            "ܬܫܪܝܢ ܐܚܪܝܐ",
            "ܟܢܘܢ ܩܕܡܝܐ",
        ],
        days: [
            "ܚܕܒܫܒܐ",
            "ܬܪܝܢܒܫܒܐ",
            "ܬܠܬܒܫܒܐ",
            "ܐܪܒܥܒܫܒܐ",
            "ܚܡܫܒܫܒܐ",
            "ܥܪܘܒܬܐ",
            "ܫܒܬܐ",
        ],
        // Before noon / after noon.
        am: "ܩ.ܛ",
        pm: "ܒ.ܛ",
    },
};

export default catalogue;
