// German (de). Same keys and placeholders as ../en.ts; typed as a full `Record`
// so a new English string that is not yet translated here fails
// type-checking instead of silently showing English.

import { de } from "date-fns/locale/de";
import type { MessageKey } from "../en";
import type { LocaleCatalogue } from "../index";

const messages: Record<MessageKey, string> = {
    // Shared
    "common.turnOffCamera": "Kamera ausschalten",
    "common.turnOnCamera": "Kamera einschalten",
    "common.stopSharing": "Teilen beenden",
    "common.shareYourScreen": "Bildschirm teilen",
    "common.joining": "Beitreten…",
    "common.join": "Beitreten",
    "common.closeDialog": "Dialog schließen",
    "common.settings": "Einstellungen",
    "common.searchResults": "Suchergebnisse",
    "common.default": "Standard",
    "common.mute": "Stummschalten",
    "common.saving": "Speichern…",
    "common.unblock": "Entsperren",
    "common.block": "Blockieren",
    "common.closeMenu": "Menü schließen",
    "common.openRoomList": "Raumliste öffnen",
    "common.uploading": "Hochladen…",
    "common.uploadImage": "Bild hochladen",
    "common.emoji": "Emoji",
    "common.decline": "Ablehnen",
    "common.invitePeople": "Personen einladen",
    "common.close": "Schließen",
    "common.cancel": "Abbrechen",
    "common.loading": "Lädt…",
    "common.loadMore": "Mehr laden",
    "common.notifications": "Benachrichtigungen",
    "common.save": "Speichern",
    "common.topic": "Thema",
    "common.videoRoom": "Videoraum",
    "common.reasonOptional": "Grund (optional)",
    "common.actions": "Aktionen",
    "common.copy": "Kopieren",
    "common.remove": "Entfernen",
    "common.add": "Hinzufügen",
    "common.starting": "Wird gestartet…",
    "common.verify": "Verifizieren",
    "common.removeFromFavourites": "Aus Favoriten entfernen",
    "common.addToFavourites": "Zu Favoriten hinzufügen",
    "common.stickers": "Sticker",
    "common.retry": "Erneut versuchen",
    "common.delete": "Löschen",
    "common.checking": "Wird geprüft…",
    "common.gifs": "GIFs",
    "common.dragOrUseArrowKeysTo":
        "Ziehen oder Pfeiltasten verwenden, um die Größe zu ändern",
    "common.resizePicker": "Größe der Auswahl ändern",
    "common.noResults": "Keine Ergebnisse",
    "common.memberCount":
        "{count, plural, one {# Mitglied} other {# Mitglieder}}",
    "common.replyCount": "{count, plural, one {# Antwort} other {# Antworten}}",

    // src/lib/components/settings/AboutSettings.svelte
    "aboutSettings.automaticUpdates": "Automatische Updates",
    "aboutSettings.version": "Version",
    "aboutSettings.currentVersionV": "Aktuelle Version v{APP_VERSION}",
    "aboutSettings.checkForUpdates": "Nach Updates suchen",
    "aboutSettings.updateAvailable": "Update verfügbar",
    "aboutSettings.reloading": "Wird neu geladen…",
    "aboutSettings.update": "Aktualisieren",
    "aboutSettings.reloadToUpdate": "Zum Aktualisieren neu laden",
    "aboutSettings.youReOnTheLatestVersion":
        "Du verwendest die neueste Version.",
    "aboutSettings.credits": "Credits",
    "aboutSettings.creditsMidiInstruments": "MIDI-Instrumente",
    "aboutSettings.creditsSoundFont":
        "von {author}, basierend auf Phoenix von {original}. Lizenziert unter CC BY; für General MIDI umbelegt und für Zam komprimiert.",
    "aboutSettings.troubleshooting": "Fehlerbehebung",
    "aboutSettings.clearCacheAndResync": "Cache leeren und neu synchronisieren",
    "aboutSettings.reDownloadsYourRoomsFromThe":
        "Lädt deine Räume erneut vom Server. Behebt fehlende oder hängende Räume. Du bleibst angemeldet.",
    "aboutSettings.resyncing": "Wird neu synchronisiert…",
    "aboutSettings.clearCache": "Cache leeren",
    "aboutSettings.updateCheckFailed": "Updateprüfung fehlgeschlagen",
    "aboutSettings.downloadFailed": "Download fehlgeschlagen",
    "aboutSettings.installFailed": "Installation fehlgeschlagen",
    "aboutSettings.failedToCheckForUpdates":
        "Suche nach Updates fehlgeschlagen.",

    // src/lib/components/settings/AccountSettings.svelte
    "accountSettings.profile": "Profil",
    "accountSettings.yourAvatar": "Dein Avatar",
    "accountSettings.changeAvatar": "Avatar ändern",
    "accountSettings.yourDisplayName": "Dein Anzeigename",
    "accountSettings.saved": "Gespeichert",
    "accountSettings.account": "Konto",
    "accountSettings.userId": "Benutzer-ID",
    "accountSettings.homeserver": "Heimserver",
    "accountSettings.connection": "Verbindung",
    "accountSettings.presence": "Anwesenheit",
    "accountSettings.password": "Passwort",
    "accountSettings.currentPassword": "Aktuelles Passwort",
    "accountSettings.newPassword": "Neues Passwort",
    "accountSettings.confirmNewPassword": "Neues Passwort bestätigen",
    "accountSettings.signOutAllOtherSessions":
        "Alle anderen Sitzungen abmelden",
    "accountSettings.changing": "Wird geändert…",
    "accountSettings.changePassword": "Passwort ändern",
    "accountSettings.passwordChanged": "Passwort geändert.",
    "accountSettings.thisServerDoesNotAllowChanging":
        "Dieser Server erlaubt es nicht, dein Passwort in dieser App zu ändern.",
    "accountSettings.managedByProvider":
        "Dein Passwort, deine Sitzungen und dein Konto werden auf der Kontoseite deines Anmeldeanbieters verwaltet.",
    "accountSettings.manageAccount": "Konto verwalten",
    "accountSettings.emailPhoneNumbers": "E-Mail und Telefonnummern",
    "accountSettings.noEmailAddressesOrPhoneNumbers":
        "Mit diesem Konto sind keine E-Mail-Adressen oder Telefonnummern verknüpft.",
    "accountSettings.email": "E-Mail",
    "accountSettings.phone": "Telefon",
    "accountSettings.thisServerDoesNotAllowManaging":
        "Dieser Server erlaubt es nicht, sie in dieser App zu verwalten.",
    "accountSettings.logOut": "Abmelden",
    "accountSettings.dangerZone": "Gefahrenzone",
    "accountSettings.deactivateAccount": "Konto deaktivieren…",
    "accountSettings.deactivationIsPermanentAndCannotBe":
        "Die Deaktivierung ist endgültig und kann nicht rückgängig gemacht werden.",
    "accountSettings.eraseMessagesWherePossible":
        "Nachrichten nach Möglichkeit löschen",
    "accountSettings.deactivating": "Wird deaktiviert…",
    "accountSettings.deactivateAccount2": "Konto deaktivieren",
    "accountSettings.avatarUploadFailed":
        "Hochladen des Avatars fehlgeschlagen",
    "accountSettings.failedToRemoveAvatar":
        "Avatar konnte nicht entfernt werden",
    "accountSettings.failedToSaveName": "Name konnte nicht gespeichert werden",
    "accountSettings.couldNotSetPresence":
        "Anwesenheit konnte nicht gesetzt werden",
    "accountSettings.failedToChangePassword":
        "Passwort konnte nicht geändert werden",
    "accountSettings.failedToDeactivateAccount":
        "Konto konnte nicht deaktiviert werden",

    // src/lib/components/layout/AccountSwitcher.svelte
    "accountSwitcher.signOut": "{userId} abmelden",
    "accountSwitcher.confirm": "Bestätigen",
    "accountSwitcher.signOut2": "Abmelden",
    "accountSwitcher.addAccount": "Konto hinzufügen",
    "accountSwitcher.accountMenu": "Kontomenü",
    "accountSwitcher.closeAccountMenu": "Kontomenü schließen",
    "accountSwitcher.back": "Zurück",
    "accountSwitcher.setYourStatus": "Deinen Status festlegen",
    "accountSwitcher.setAStatus": "Status festlegen",
    "accountSwitcher.editProfile": "Profil bearbeiten",
    "accountSwitcher.switchAccounts": "Konto wechseln",
    "accountSwitcher.couldNotSetPresence":
        "Anwesenheit konnte nicht gesetzt werden",

    // src/lib/components/layout/ActiveCallBanner.svelte
    "activeCallBanner.openCall": "Anruf öffnen",
    "activeCallBanner.ringing": "Klingelt…",
    "activeCallBanner.voiceCallInCall": "Sprachanruf · {length} im Anruf",
    "activeCallBanner.leave": "Verlassen",

    // src/lib/components/settings/AppearanceSettings.svelte
    "appearanceSettings.rightAlignMyMessagesBubbleLayout":
        "Meine Nachrichten rechtsbündig (Blasen-Layout)",
    "appearanceSettings.displayYourOwnMessagesOnThe":
        "Eigene Nachrichten rechts in einer farbigen Blase anzeigen",
    "appearanceSettings.showNameColours": "Namensfarben anzeigen",
    "appearanceSettings.drawPeopleSNamesInThe":
        "Namen in der Farbe anzeigen, die im jeweiligen Profil gewählt wurde. Ausschalten, um für alle die normale Textfarbe zu verwenden.",
    "appearanceSettings.keepRoomListOpen": "Raumliste geöffnet lassen",
    "appearanceSettings.donTAutoCloseTheRoom":
        "Raumliste beim Wechsel zwischen Spaces oder zur Startseite nicht automatisch schließen. Das Öffnen eines Raums oder einer Direktnachricht schließt sie immer.",
    "appearanceSettings.timestamps": "Zeitstempel",
    "appearanceSettings.timeFormat": "Zeitformat",
    "appearanceSettings.dateFormat": "Datumsformat",
    "appearanceSettings.customDatePattern": "Eigenes Datumsformat",
    "appearanceSettings.yyyyMmDd": "yyyy-MM-dd",
    "appearanceSettings.preview": "Vorschau:",
    "appearanceSettings.dateFnsTokensEGYyyy":
        "· date-fns-Platzhalter, z. B. yyyy-MM-dd",
    "appearanceSettings.invalidFormatUseLowercaseDateFns":
        "Ungültiges Format - verwende kleingeschriebene date-fns-Platzhalter wie yyyy-MM-dd.",
    "appearanceSettings.alwaysShowAbsoluteDates":
        "Immer vollständige Daten anzeigen",
    "appearanceSettings.replaceTodayAndYesterdayWithThe":
        "„Heute“ und „Gestern“ überall durch das vollständige Datum ersetzen.",
    "appearanceSettings.reduceMotion": "Bewegung reduzieren",
    "appearanceSettings.minimizeAnimationsAndTransitionsYourDevice":
        "Animationen und Übergänge minimieren. Die Systemeinstellung „Bewegung reduzieren“ deines Geräts wird immer berücksichtigt.",
    "appearanceSettings.custom": "Benutzerdefiniert",
    "appearanceSettings.12Hour": "12 Stunden",
    "appearanceSettings.24Hour": "24 Stunden",
    "appearanceSettings.language": "Sprache",
    "appearanceSettings.displayLanguage": "Anzeigesprache",
    "appearanceSettings.displayLanguageHint":
        "Die Sprache der Menüs und Schaltflächen von Zam. Eine Änderung lädt die App neu.",

    // src/routes/app/+page.svelte
    "appPage.redirecting": "Weiterleitung…",

    // src/lib/components/layout/AppSettings.svelte
    "appSettings.backToSettings": "Zurück zu den Einstellungen",
    "appSettings.closeSettings": "Einstellungen schließen",
    "appSettings.searchSettings": "Einstellungen durchsuchen…",
    "appSettings.searchSettings2": "Einstellungen durchsuchen",
    "appSettings.noSettingsMatch": "Keine passenden Einstellungen",
    "appSettings.noSettingsMatch2":
        "Keine Einstellungen passen zu „{searchQuery}“.",
    "appSettings.resultCount":
        "{count, plural, one {# Ergebnis} other {# Ergebnisse}}",

    // src/lib/components/layout/AppShell.svelte
    "appShell.zam": "({notificationCount}) Zam",
    "appShell.redirecting": "Weiterleitung…",
    "appShell.noRoomsYet": "Noch keine Räume",
    "appShell.createARoomOrStartA":
        "Erstelle einen Raum oder beginne eine Direktnachricht, um loszulegen.",
    "appShell.nothingInHome": "Nichts auf der Startseite",
    "appShell.allOfYourRoomsLiveIn":
        "Alle deine Räume befinden sich in Spaces - öffne einen, um sie zu sehen. Räume und Direktnachrichten außerhalb eines Space erscheinen hier.",
    "appShell.openRoomList": "Raumliste öffnen",
    "appShell.someone": "Jemand",
    "appShell.isCalling": "{name} ruft an",
    "appShell.incomingCall": "Eingehender Anruf",
    "appShell.offlineMessageStorageIsUnavailableThis":
        "Der Offline-Nachrichtenspeicher ist in dieser Sitzung nicht verfügbar, der Verlauf wird also nicht für das nächste Mal gespeichert.",
    "appShell.couldnTSendYourReplyIt":
        "Deine Antwort konnte nicht gesendet werden. Sie wurde als Entwurf gespeichert.",
    "appShell.yourNotificationReplyWasSavedAs":
        "Deine Antwort aus der Benachrichtigung wurde als Entwurf gespeichert",

    // src/lib/components/settings/BlockedUsersSettings.svelte
    "blockedUsersSettings.messagesFromBlockedUsersAreHidden":
        "Nachrichten blockierter Benutzer werden in allen Räumen ausgeblendet. Die Liste wird in deinem Konto gespeichert und gilt für alle deine Sitzungen.",
    "blockedUsersSettings.youHavenTBlockedAnyone":
        "Du hast niemanden blockiert.",
    "blockedUsersSettings.failed": "Fehlgeschlagen",

    // src/lib/components/layout/CallParticipantMenu.svelte
    "callParticipantMenu.profile": "Profil",
    "callParticipantMenu.input": "Eingabe",
    "callParticipantMenu.output": "Ausgabe",
    "callParticipantMenu.opening": "Wird geöffnet…",
    "callParticipantMenu.message": "Nachricht",
    "callParticipantMenu.mention": "Erwähnen",
    "callParticipantMenu.userVolume": "Benutzerlautstärke",
    "callParticipantMenu.hideVideo": "Video ausblenden",
    "callParticipantMenu.kicking": "Wird entfernt…",
    "callParticipantMenu.confirmKick": "{name} wirklich entfernen?",
    "callParticipantMenu.kickFromRoom": "{name} aus dem Raum entfernen",
    "callParticipantMenu.banning": "Wird gebannt…",
    "callParticipantMenu.confirmBan": "{name} wirklich bannen?",
    "callParticipantMenu.ban": "{name} bannen",
    "callParticipantMenu.couldNotOpenADirectMessage":
        "Direktnachricht konnte nicht geöffnet werden",
    "callParticipantMenu.couldNotKick": "{name} konnte nicht entfernt werden",
    "callParticipantMenu.couldNotBan": "{name} konnte nicht gebannt werden",

    // src/lib/components/layout/CallView.svelte
    "callView.ringing": "Klingelt…",
    "callView.showChat": "Chat anzeigen",
    "callView.noOneIsInThisCall": "Niemand ist in diesem Anruf",
    "callView.backToGrid": "Zurück zum Raster",
    "callView.screenShareQuality": "Qualität der Bildschirmfreigabe",
    "callView.optionsFor": "Optionen für {name}",
    "callView.muted": "Stummgeschaltet",
    "callView.deafened": "Ton aus",
    "callView.mutedForYou": "Für dich stummgeschaltet",
    "callView.joinedFromMultipleDevices": "Von mehreren Geräten beigetreten",
    "callView.devices": "{value} Geräte",
    "callView.enableAudio": "Audio aktivieren",
    "callView.unmute": "Stummschaltung aufheben",
    "callView.undeafen": "Ton einschalten",
    "callView.deafen": "Ton ausschalten",
    "callView.disconnect": "Trennen",
    "callView.joinCall": "Anruf beitreten",
    "callView.you": "Du",
    "callView.sScreen": "Bildschirm von {name}",
    "callView.exitSpotlightFor": "Hervorhebung von {label} beenden",
    "callView.spotlight": "{label} hervorheben",

    // src/lib/components/messages/CreatePollDialog.svelte
    "createPollDialog.createPoll": "Umfrage erstellen",
    "createPollDialog.question": "Frage",
    "createPollDialog.askSomething": "Stell eine Frage…",
    "createPollDialog.options": "Optionen",
    "createPollDialog.option": "Option {value}",
    "createPollDialog.removeOption": "Option entfernen",
    "createPollDialog.addOption": "+ Option hinzufügen",
    "createPollDialog.results": "Ergebnisse",
    "createPollDialog.showAsPeopleVote": "Während der Abstimmung anzeigen",
    "createPollDialog.hideUntilClosed": "Bis zum Ende verbergen",
    "createPollDialog.allowSelectingMultipleOptions":
        "Mehrfachauswahl erlauben",
    "createPollDialog.creating": "Wird erstellt…",
    "createPollDialog.failedToCreatePoll":
        "Umfrage konnte nicht erstellt werden",

    // src/lib/components/layout/CryptoUnavailableBanner.svelte
    "cryptoUnavailableBanner.encryptionIsUnavailableThisSessionEncrypted":
        "Verschlüsselung ist in dieser Sitzung nicht verfügbar: Verschlüsselte Nachrichten können weder gelesen noch gesendet werden. Neu laden, um es erneut zu versuchen.",
    "cryptoUnavailableBanner.reload": "Neu laden",
    "cryptoUnavailableBanner.dismissEncryptionWarning":
        "Verschlüsselungswarnung schließen",

    // src/lib/components/settings/CustomPackSettings.svelte
    "customPackSettings.add": "Hinzufügen: {singular}",
    "customPackSettings.shortcode": "Kürzel",
    "customPackSettings.sticker": "Sticker",
    "customPackSettings.remove": "Entfernen: {toLowerCase}",
    "customPackSettings.image": "Bild",
    "customPackSettings.chooseAtLeastOneUsage":
        "Wähle mindestens eine Verwendung.",
    "customPackSettings.uploadFailed": "Hochladen fehlgeschlagen",
    "customPackSettings.failedToRemove": "Entfernen fehlgeschlagen: {singular}",
    "customPackSettings.failedToUpdateUsage":
        "Verwendung konnte nicht aktualisiert werden",
    "customPackSettings.noCustomImages": "Keine eigenen Bilder",
    "customPackSettings.noCustomEmojis": "Keine eigenen Emojis",
    "customPackSettings.noCustomStickers": "Keine eigenen Sticker",

    // src/lib/components/debug/DebugEventItem.svelte
    "debugEventItem.stateKey": "state_key",
    "debugEventItem.empty": "(leer)",
    "debugEventItem.redacted": "ENTFERNT",
    "debugEventItem.id": "ID: {eventId}",

    // src/lib/components/debug/DebugPanel.svelte
    "debugPanel.debugPanel": "DEBUG-PANEL",
    "debugPanel.sync": "Sync:",
    "debugPanel.refresh": "↻ aktualisieren",
    "debugPanel.copied": "✓ kopiert",
    "debugPanel.copy": "⧉ kopieren",
    "debugPanel.unreadState": "UNGELESEN-STATUS",
    "debugPanel.unread": "ungelesen:",
    "debugPanel.highlight": "hervorgehoben:",
    "debugPanel.userid": "userId:",
    "debugPanel.readuptoid": "readUpToId:",
    "debugPanel.readidxInTimeline": "readIdx im Verlauf:",
    "debugPanel.noReceipt": "keine Bestätigung",
    "debugPanel.n1NotInWindow": "-1 (nicht im Fenster!)",
    "debugPanel.events": "/ {totalEvents} Ereignisse",
    "debugPanel.lastEventSender": "Absender des letzten Ereignisses:",
    "debugPanel.me": "(ich:",
    "debugPanel.notificationEventsAfterReadMarker":
        "Benachrichtigende Ereignisse nach der Lesemarkierung:",
    "debugPanel.from": "[{formatTs}] {getType} von {value} - {msgPreview}",
    "debugPanel.pushRules": "PUSH-REGELN",
    "debugPanel.default": "(Standard)",
    "debugPanel.actions": "Aktionen: {stringify}",
    "debugPanel.conditions": "Bedingungen: {stringify}",
    "debugPanel.noPushRulesFound": "keine Push-Regeln gefunden",
    "debugPanel.readReceiptsEventsWithReceipts":
        "LESEBESTÄTIGUNGEN ({length} Ereignisse mit Bestätigungen)",
    "debugPanel.noReceipts": "keine Bestätigungen",
    "debugPanel.urlPreviewInspector": "URL-VORSCHAU-INSPEKTOR",
    "debugPanel.https": "https://...",
    "debugPanel.storeMessagesWhatTheUiRenders":
        "STORE-NACHRICHTEN ({length}) - was die Oberfläche anzeigt",
    "debugPanel.redacted": "ENTFERNT",
    "debugPanel.rel": "rel={relType}",
    "debugPanel.empty": "leer",
    "debugPanel.pendingEvents": "AUSSTEHENDE EREIGNISSE ({length})",
    "debugPanel.rawTimelineEvents": "ROHER VERLAUF ({length} Ereignisse)",

    // src/lib/components/settings/DebugSettings.svelte
    "debugSettings.developer": "Entwickler",
    "debugSettings.showAllEvents": "Alle Ereignisse anzeigen",
    "debugSettings.displayEveryMatrixTimelineEventIn":
        "Jedes Matrix-Ereignis des Verlaufs im Chat anzeigen.",
    "debugSettings.syncStatus": "Sync-Status",
    "debugSettings.useSlidingSync": "Sliding Sync verwenden",
    "debugSettings.experimentalLoadsRoomsInAGrowing":
        "Experimentell. Lädt Räume in einem wachsenden Fenster. Zum Anwenden wird die App neu geladen.",
    "debugSettings.pushStatus": "Push-Status",
    "debugSettings.lastError": "Letzter Fehler: {lastError}",
    "debugSettings.runDiagnostics": "Diagnose starten",
    "debugSettings.homeserverPushers": "Pusher des Heimservers",
    "debugSettings.theHomeserverHasNoPushersRegistered":
        "Der Heimserver hat für dieses Konto keine Pusher registriert.",
    "debugSettings.aPusherMatchesTheConfiguredGateway":
        "Ein Pusher passt zur konfigurierten Gateway-URL.",
    "debugSettings.noPusherMatchesTheConfiguredGateway":
        "Kein Pusher passt zur konfigurierten Gateway-URL.",
    "debugSettings.appId": "app_id: {app_id}",
    "debugSettings.none": "(keine)",
    "debugSettings.url": "URL: {value}",
    "debugSettings.pushkey": "pushkey: {pushkeyPreview}",
    "debugSettings.webPushPwa": "Web-Push (PWA)",
    "debugSettings.missing": "(fehlt)",
    "debugSettings.vapidKey": "VAPID-Schlüssel: {value}",
    "debugSettings.permission": "Berechtigung: {permission}",
    "debugSettings.subscription": "Abonnement: {value}",
    "debugSettings.notFound": "nicht gefunden",
    "debugSettings.homeserverPusher": "Heimserver-Pusher: {value}",
    "debugSettings.error": "Fehler: {error}",
    "debugSettings.gatewaySygnalFirebase": "Gateway (Sygnal / Firebase)",
    "debugSettings.gatewayReachable": "Gateway erreichbar",
    "debugSettings.gatewayNotReachable": "Gateway nicht erreichbar",
    "debugSettings.nativeSessionPushEnrichment":
        "Native Sitzung (Push-Anreicherung)",
    "debugSettings.homeserver": "Heimserver: {value}",
    "debugSettings.user": "Benutzer: {value}",
    "debugSettings.device": "Gerät: {value}",
    "debugSettings.accessToken": "Zugriffstoken: {value}",
    "debugSettings.hideMessageText": "Nachrichtentext ausblenden: {value}",
    "debugSettings.notificationRulesServer": "Benachrichtigungsregeln (Server)",
    "debugSettings.syncMode": "Sync-Modus",
    "debugSettings.slidingSyncMsc4186": "Sliding Sync (MSC4186)",
    "debugSettings.classicSyncV2": "Klassisches /sync (v2)",
    "debugSettings.syncState": "Sync-Zustand",
    "debugSettings.fallback": "Fallback",
    "debugSettings.slidingSyncEndpoint": "Sliding-Sync-Endpunkt",
    "debugSettings.joinedRoomsLoaded": "Geladene beigetretene Räume",
    "debugSettings.roomListWindow": "Raumlisten-Fenster",
    "debugSettings.of": "{requested} von {total}",
    "debugSettings.platform": "Plattform",
    "debugSettings.nativeCapacitor": "Nativ (Capacitor)",
    "debugSettings.pushEnabledInBuild": "Push im Build aktiviert",
    "debugSettings.yes": "Ja",
    "debugSettings.no": "Nein",
    "debugSettings.gatewayUrl": "Gateway-URL",
    "debugSettings.appId2": "App-ID",
    "debugSettings.notificationPermission": "Benachrichtigungsberechtigung",
    "debugSettings.fcmToken": "FCM-Token",
    "debugSettings.pusherRegisteredThisSession":
        "Pusher in dieser Sitzung registriert",
    "debugSettings.failedToFetchPushersFromHomeserver":
        "Pusher konnten nicht vom Heimserver abgerufen werden.",
    "debugSettings.set": "gesetzt",
    "debugSettings.active": "aktiv",

    // src/lib/components/ui/EmojiPicker.svelte
    "emojiPicker.searchEmoji": "Emoji suchen…",
    "emojiPicker.searchEmoji2": "Emoji suchen",
    "emojiPicker.myEmojis": "Meine Emojis",
    "emojiPicker.custom": "Eigene",
    "emojiPicker.standard": "Standard",
    "emojiPicker.myEmojis2": "Meine Emojis",

    // src/lib/components/ui/ErrorToasts.svelte
    "errorToasts.dismiss": "Schließen",

    // src/lib/components/settings/ExtendedProfileDebug.svelte
    "extendedProfileDebug.extendedProfile": "Erweitertes Profil",
    "extendedProfileDebug.fetchFromServer": "Vom Server abrufen",
    "extendedProfileDebug.thisServerDoesNotSupportExtended":
        "Dieser Server unterstützt keine erweiterten Profile.",
    "extendedProfileDebug.noneOrTheServerRefused":
        "keine, oder der Server hat abgelehnt",
    "extendedProfileDebug.presenceGetPresenceStraightFromThe":
        "Anwesenheit (GET /presence, direkt vom Server): {value}",
    "extendedProfileDebug.notAdvertisedNoRestrictions":
        "nicht angekündigt (keine Einschränkungen)",
    "extendedProfileDebug.serverRulesForFieldsMProfile":
        "Serverregeln für Felder (m.profile_fields): {value}",
    "extendedProfileDebug.failedToFetchTheProfile":
        "Profil konnte nicht abgerufen werden",
    "extendedProfileDebug.couldNotCopyToClipboard":
        "Kopieren in die Zwischenablage fehlgeschlagen",

    // src/lib/components/ui/FlashEmbed.svelte
    "flashEmbed.suspend": "Anhalten",

    // src/lib/components/messages/ForwardMessageDialog.svelte
    "forwardMessageDialog.forwardMessage": "Nachricht weiterleiten",
    "forwardMessageDialog.searchRooms": "Räume suchen",
    "forwardMessageDialog.noJoinedRoomsFound":
        "Keine beigetretenen Räume gefunden",
    "forwardMessageDialog.forwarding": "Wird weitergeleitet…",
    "forwardMessageDialog.forward": "Weiterleiten",
    "forwardMessageDialog.failedToForwardMessage":
        "Nachricht konnte nicht weitergeleitet werden",

    // src/lib/components/settings/GeneralSettings.svelte
    "generalSettings.desktop": "Desktop",
    "generalSettings.minimiseToTrayOnClose":
        "Beim Schließen in den Infobereich minimieren",
    "generalSettings.keepZamRunningInTheSystem":
        "Zam beim Schließen des Fensters im Infobereich weiterlaufen lassen, statt es zu beenden. Über das Symbol im Infobereich lässt es sich wieder öffnen oder beenden.",
    "generalSettings.noGeneralSettingsAreAvailableOn":
        "Auf dieser Plattform sind keine allgemeinen Einstellungen verfügbar.",

    // src/lib/components/ui/GifPicker.svelte
    "gifPicker.searchFavourites": "Favoriten durchsuchen…",
    "gifPicker.searchKlipy": "KLIPY durchsuchen…",
    "gifPicker.searchFavourites2": "Favoriten durchsuchen",
    "gifPicker.searchGifs": "GIFs suchen",
    "gifPicker.gifResults": "GIF-Ergebnisse",
    "gifPicker.noFavouriteGifsYetStarA":
        "Noch keine Lieblings-GIFs. Markiere ein GIF mit einem Stern, um es hier zu speichern.",
    "gifPicker.favourites": "Favoriten",
    "gifPicker.gifTagged": "GIF mit Tags {join}",
    "gifPicker.favouriteGif": "Lieblings-GIF {value}",
    "gifPicker.editTags": "Tags bearbeiten",
    "gifPicker.catFunny": "Katze, lustig",
    "gifPicker.commaSeparatedEnterToSave":
        "Kommagetrennt · Enter zum Speichern",
    "gifPicker.trending": "Angesagt",
    "gifPicker.gifResult": "GIF-Ergebnis {value}",
    "gifPicker.favourite": "Favorit",
    "gifPicker.poweredByKlipy": "Bereitgestellt von KLIPY",

    // src/lib/components/layout/ImagePackEditor.svelte
    "imagePackEditor.addImage": "Bild hinzufügen",
    "imagePackEditor.newPack": "Neues Paket",
    "imagePackEditor.packName": "Paketname",
    "imagePackEditor.shortcode": "Kürzel",
    "imagePackEditor.useAsEmoji": "Als Emoji verwenden",
    "imagePackEditor.useAsSticker": "Als Sticker verwenden",
    "imagePackEditor.inheritedFrom": "Geerbt von {sourceName}",
    "imagePackEditor.sticker": "Sticker",
    "imagePackEditor.removeImage": "Bild entfernen",
    "imagePackEditor.noCustomImages": "Keine eigenen Bilder",
    "imagePackEditor.emotes": "Emotes von {value}",
    "imagePackEditor.room": "Raum",
    "imagePackEditor.chooseAtLeastOneUsage":
        "Wähle mindestens eine Verwendung.",
    "imagePackEditor.enterAPackName": "Gib einen Paketnamen ein.",
    "imagePackEditor.uploadFailed": "Hochladen fehlgeschlagen",
    "imagePackEditor.failedToUpdateUsage":
        "Verwendung konnte nicht aktualisiert werden",
    "imagePackEditor.failedToRemoveImage": "Bild konnte nicht entfernt werden",

    // src/lib/components/layout/InboxPanel.svelte
    "inboxPanel.inbox": "Posteingang",
    "inboxPanel.noPendingInvites": "Keine ausstehenden Einladungen",
    "inboxPanel.roomInvitesWillAppearHere": "Raumeinladungen erscheinen hier.",
    "inboxPanel.pendingInvites": "Ausstehende Einladungen: {length}",
    "inboxPanel.invitedBy": "Eingeladen von {sender}",
    "inboxPanel.ignore": "Ignorieren",
    "inboxPanel.accept": "Annehmen",
    "inboxPanel.pendingJoinRequests": "Ausstehende Beitrittsanfragen: {length}",
    "inboxPanel.youAskedToJoinWaitingFor":
        "Du hast den Beitritt angefragt - warte, bis dich jemand hereinlässt.",
    "inboxPanel.cancelRequest": "Anfrage zurückziehen",
    "inboxPanel.failedToAcceptInvite":
        "Einladung konnte nicht angenommen werden",
    "inboxPanel.failedToRejectInvite":
        "Einladung konnte nicht abgelehnt werden",
    "inboxPanel.failedToCancelJoinRequest":
        "Beitrittsanfrage konnte nicht zurückgezogen werden",

    // src/lib/components/layout/IncomingCallCard.svelte
    "incomingCallCard.incomingCall": "Eingehender Anruf",
    "incomingCallCard.declineCallFrom": "Anruf von {name} ablehnen",
    "incomingCallCard.accept": "Annehmen",
    "incomingCallCard.acceptCallFrom": "Anruf von {name} annehmen",
    "incomingCallCard.unknown": "Unbekannt",

    // src/lib/components/layout/InvitePanel.svelte
    "invitePanel.invitePeopleTo": "Personen einladen in",
    "invitePanel.invited": "Eingeladen",
    "invitePanel.failed": "Fehlgeschlagen",
    "invitePanel.inviteByEmail": "Per E-Mail einladen",
    "invitePanel.nameExampleCom": "name@beispiel.de",
    "invitePanel.inviting": "Wird eingeladen…",
    "invitePanel.invite": "Einladen",
    "invitePanel.invite2": "{length} einladen",
    "invitePanel.enterAValidEmailAddress":
        "Gib eine gültige E-Mail-Adresse ein.",
    "invitePanel.couldNotSendTheEmailInvite":
        "E-Mail-Einladung konnte nicht gesendet werden",
    "invitePanel.couldNotSendTheInvite":
        "Einladung konnte nicht gesendet werden",
    "invitePanel.thisRoom": "diesen Raum",
    "invitePanel.thisSpace": "diesen Space",

    // src/lib/components/layout/JoinConsentDialog.svelte
    "joinConsentDialog.joinThisRoom": "Diesem Raum beitreten?",
    "joinConsentDialog.youClickedALinkTo": "Du hast auf einen Link zu",
    "joinConsentDialog.joiningSharesYourMatrixIdWith":
        "geklickt. Beim Beitreten wird deine Matrix-ID mit allen im Raum geteilt und der Raum zu deiner Raumliste hinzugefügt.",
    "joinConsentDialog.thisOpensRoom": "Dies öffnet den Raum",
    "joinConsentDialog.warningThisLinkPointsAtA":
        "Warnung: Dieser Link zeigt auf einen anderen Server als den des Raums, zu dem er führt. Fahre nur fort, wenn du dem Absender vertraust.",
    "joinConsentDialog.joinRoom": "Raum beitreten",

    // src/lib/components/ui/Lightbox.svelte
    "lightbox.closeViewer": "Betrachter schließen ({mediaNoun})",
    "lightbox.viewer": "Betrachter ({MediaNoun}){value}",
    "lightbox.download": "Herunterladen",
    "lightbox.previous": "Zurück",
    "lightbox.previous2": "Vorheriges ({mediaNoun})",
    "lightbox.next": "Weiter",
    "lightbox.next2": "Nächstes ({mediaNoun})",
    "lightbox.couldNotLoadThisVideoUse":
        "Dieses Video konnte nicht geladen werden. Verwende stattdessen „Herunterladen“, um es zu speichern.",
    "lightbox.video": "Video",
    "lightbox.image": "Bild",
    "lightbox.videoNoun": "Video",
    "lightbox.imageNoun": "Bild",

    // src/lib/components/messages/LinkPreview.svelte
    "linkPreview.youtubeVideo": "YouTube-Video",
    "linkPreview.xTwitter": "X / Twitter",
    "linkPreview.loadingItContactsTheSiteHosting":
        "Beim Laden wird die hostende Website kontaktiert, die dadurch deine IP-Adresse erfährt",
    "linkPreview.loadPreviewMedia": "Vorschaumedien laden",
    "linkPreview.playVideo": "Video abspielen",

    // src/lib/components/layout/LiveLocationBanner.svelte
    "liveLocationBanner.openMap": "Karte öffnen",
    "liveLocationBanner.sharingLiveLocation": "Live-Standort wird geteilt",
    "liveLocationBanner.lastUpdatedAt":
        " · zuletzt aktualisiert um {timeOnly} ({updatedAgoLabel})",
    "liveLocationBanner.map": "Karte",
    "liveLocationBanner.isSharingLiveLocation":
        "{getMemberName} teilt den Live-Standort",
    "liveLocationBanner.peopleSharingLiveLocation":
        "{length} Personen teilen ihren Live-Standort",
    "liveLocationBanner.viewMap": "Karte anzeigen",

    // src/lib/components/layout/LiveLocationMapView.svelte
    "liveLocationMapView.back": "Zurück",
    "liveLocationMapView.liveLocation": "Live-Standort",
    "liveLocationMapView.recenter": "Zentrieren",
    "liveLocationMapView.waitingForALocationFix":
        "Warte auf Standortbestimmung…",
    "liveLocationMapView.sharingLiveLocation": "Live-Standort wird geteilt",
    "liveLocationMapView.lastUpdatedAt":
        "zuletzt aktualisiert um {timeOnly} ({updatedAgoLabel})",
    "liveLocationMapView.osm": "OSM",
    "liveLocationMapView.noActiveLiveSharesInThis":
        "Keine aktiven Live-Standorte in diesem Raum.",
    "liveLocationMapView.you": "Du",

    // src/lib/components/messages/LocationBody.svelte
    "locationBody.openstreetmap": "OpenStreetMap",
    "locationBody.googleMaps": "Google Maps",

    // src/lib/components/layout/LoginView.svelte
    "loginView.signIn": "Anmelden",
    "loginView.register": "Registrieren",
    "loginView.zam": "Zam - {value}",
    "loginView.addAnAccount": "Konto hinzufügen",
    "loginView.welcomeBack": "Willkommen zurück!",
    "loginView.signInWithAnotherMatrixAccount":
        "Mit einem anderen Matrix-Konto anmelden",
    "loginView.signInToYourMatrixAccount":
        "Melde dich bei deinem Matrix-Konto an",
    "loginView.createAnAccount": "Konto erstellen",
    "loginView.registerOnAMatrixHomeserver":
        "Auf einem Matrix-Heimserver registrieren",
    "loginView.homeserver": "Heimserver",
    "loginView.username": "Benutzername",
    "loginView.password": "Passwort",
    "loginView.registrationToken": "Registrierungstoken",
    "loginView.ifRequired": "(falls erforderlich)",
    "loginView.leaveBlankIfNotRequired":
        "Leer lassen, falls nicht erforderlich",
    "loginView.useSlidingSync": "Sliding Sync verwenden",
    "loginView.fasterStartupOnServersThatSupport":
        "Schnellerer Start auf Servern, die es unterstützen.",
    "loginView.pleaseWait": "Bitte warten…",
    "loginView.logIn": "Anmelden",
    "loginView.createAccount": "Konto erstellen",
    "loginView.donTHaveAnAccount": "Noch kein Konto?",
    "loginView.alreadyHaveAnAccount": "Schon ein Konto?",
    "loginView.signIn2": "Anmelden",
    "loginView.backTo": "← Zurück zu {activeUserId}",
    "loginView.orContinueAs": "Oder weiter als",
    "loginView.yourCredentialsAreSentDirectlyTo":
        "Deine Zugangsdaten werden direkt an deinen Heimserver gesendet und von dieser App nur auf deinem Gerät gespeichert.",
    "loginView.loggingIn": "Anmeldung läuft…",
    "loginView.loginFailedCheckYourCredentials":
        "Anmeldung fehlgeschlagen. Überprüfe deine Zugangsdaten.",
    "loginView.creatingAccount": "Konto wird erstellt…",
    "loginView.registrationFailed": "Registrierung fehlgeschlagen.",
    "loginView.or": "oder",
    "loginView.continueWithSso": "Weiter mit SSO",
    "loginView.continueWith": "Weiter mit {name}",
    "loginView.redirectingToSso": "Weiterleitung zu deinem Anmeldeanbieter…",
    "loginView.finishSsoInBrowser":
        "Schließe die Anmeldung im Browser ab und kehre dann hierher zurück.",
    "loginView.ssoCouldNotBeVerified":
        "Single Sign-On konnte nicht überprüft werden. Bitte versuche es erneut.",
    "loginView.ssoFailed": "Single Sign-On fehlgeschlagen.",
    "loginView.continue": "Weiter",
    "loginView.signInOnProviderPage":
        "Du meldest dich auf der eigenen Seite deines Homeservers an und kehrst danach hierher zurück.",
    "loginView.oauthCancelled": "Die Anmeldung wurde abgebrochen.",
    "loginView.oauthDenied":
        "Der Anmeldeanbieter hat die Anfrage abgelehnt: {reason}",
    "loginView.oauthCouldNotBeVerified":
        "Die Anmeldung konnte nicht überprüft werden. Bitte versuche es erneut.",
    "loginView.oauthFailed":
        "Anmeldung fehlgeschlagen. Bitte versuche es erneut.",
    "loginView.oauthRegistrationRefused":
        "Dieser Server erlaubt es Zam nicht, sich für die Anmeldung zu registrieren.",
    "loginView.oauthRegistrationRefusedFallback":
        "Dieser Server erlaubt es Zam nicht, sich für die Anmeldung zu registrieren. Nutze eine der anderen Optionen unten.",
    "loginView.checkingServer": "Server wird geprüft…",

    // src/lib/components/layout/MemberList.svelte
    "memberList.members": "Mitglieder: {length}",
    "memberList.admins": "Administratoren: {length}",
    "memberList.admin": "Administrator",
    "memberList.moderators": "Moderatoren: {length}",

    // src/lib/components/messages/MessageActionsSheet.svelte
    "messageActionsSheet.thisMessage": "{label}: diese Nachricht?",
    "messageActionsSheet.messageActions": "Nachrichtenaktionen",

    // src/lib/components/layout/MessageArea.svelte
    "messageArea.dropToAttach": "Zum Anhängen ablegen",
    "messageArea.unreadNotifications": "Ungelesene Benachrichtigungen",
    "messageArea.encryptionEnabled": "Verschlüsselung aktiviert",
    "messageArea.joiningVoiceCall": "Sprachanruf wird beigetreten…",
    "messageArea.startVoiceCall": "Sprachanruf starten",
    "messageArea.showCall": "Anruf anzeigen",
    "messageArea.searchMessages": "Nachrichten durchsuchen",
    "messageArea.threads": "Threads",
    "messageArea.toggleThreadsList": "Threadliste ein-/ausblenden",
    "messageArea.unreadThreadMentions": "Ungelesene Erwähnungen in Threads",
    "messageArea.unreadThreads": "Ungelesene Threads",
    "messageArea.pinnedMessages": "Angeheftete Nachrichten",
    "messageArea.notificationsInbox": "Benachrichtigungseingang",
    "messageArea.mediaAndFiles": "Medien und Dateien",
    "messageArea.toggleMemberList": "Mitgliederliste ein-/ausblenden",
    "messageArea.more": "Mehr",
    "messageArea.moreRoomOptions": "Weitere Raumoptionen",
    "messageArea.messageTimeline": "Nachrichtenverlauf",
    "messageArea.welcomeTo": "Willkommen in #",
    "messageArea.thisIsTheBeginningOfThe": "Dies ist der Anfang des Raums #",
    "messageArea.room": ".",
    "messageArea.newMessages": "Neue Nachrichten",
    "messageArea.messageFromABlockedUser":
        "Nachricht von einem blockierten Benutzer",
    "messageArea.showBlockedMessage": "Blockierte Nachricht anzeigen",
    "messageArea.thisRoomHasBeenUpgraded": "Dieser Raum wurde aktualisiert",
    "messageArea.goToNewRoom": "Zum neuen Raum",
    "messageArea.joinNewRoom": "Neuem Raum beitreten",
    "messageArea.jumpToPresent": "Zur Gegenwart springen",
    "messageArea.searchingForMessage": "Nachricht wird gesucht…",
    "messageArea.viewingMessageContext": "Nachrichtenkontext wird angezeigt",
    "messageArea.returnToLive": "Zurück zu live",
    "messageArea.closePanel": "Bereich schließen",
    "messageArea.someone": "Jemand",
    "messageArea.pinnedMessagesCount": "Angeheftete Nachrichten ({count})",

    // src/lib/components/messages/MessageInput.svelte
    "messageInput.replyingTo": "Antwort an {replyTargetName}",
    "messageInput.cancelReplyEsc": "Antwort abbrechen (Esc)",
    "messageInput.editAttachment": "Anhang bearbeiten",
    "messageInput.editAttachment2": "Anhang {name} bearbeiten",
    "messageInput.custom": "eigene",
    "messageInput.yourNextMessageWillStartA":
        "Deine nächste Nachricht startet einen",
    "messageInput.thread": "Thread",
    "messageInput.cancelThreadCreation": "Thread-Erstellung abbrechen",
    "messageInput.favouriteGifs": "Lieblings-GIFs",
    "messageInput.sendMessage": "Nachricht senden",
    "messageInput.isTyping": "{value} schreibt…",
    "messageInput.andAreTyping": "{value} und {value2} schreiben…",
    "messageInput.andAreTyping2": "{value}, {value2} und {value3} schreiben…",
    "messageInput.severalPeopleAreTyping": "Mehrere Personen schreiben…",
    "messageInput.selectARoomToStartChatting":
        "Wähle einen Raum, um zu chatten",
    "messageInput.replyInThread": "Im Thread antworten...",
    "messageInput.replyTo": "{replyTargetName} antworten...",
    "messageInput.message": "Nachricht an #{roomName}",
    "messageInput.isNotAValidUser": "„{token}“ ist kein gültiger Benutzer",
    "messageInput.noRoomSelected": "Kein Raum ausgewählt",
    "messageInput.isNotInThisRoom": "{userId} ist nicht in diesem Raum",
    "messageInput.youDonTHavePermissionTo":
        "Du hast keine Berechtigung, Berechtigungsstufen in diesem Raum zu ändern",
    "messageInput.unhandledCommand": "Nicht behandelter Befehl: /{name}",
    "messageInput.commandFailed": "Befehl fehlgeschlagen",
    "messageInput.failedToSend": "Senden fehlgeschlagen",
    "messageInput.unknownCommand": "Unbekannter Befehl: /{unknown}",
    "messageInput.sendingAttachments":
        "{count, plural, one {# Anhang wird gesendet…} other {# Anhänge werden gesendet…}}",

    // src/lib/components/messages/MessageItem.svelte
    "messageItem.viewProfile": "Profil anzeigen",
    "messageItem.jumpToTheRepliedToMessage":
        "Zur beantworteten Nachricht springen:",
    "messageItem.originalMessageNotLoaded":
        "Ursprüngliche Nachricht nicht geladen",
    "messageItem.originalMessageDeleted": "Ursprüngliche Nachricht gelöscht",
    "messageItem.originalMessageUnavailable":
        "Ursprüngliche Nachricht nicht verfügbar",
    "messageItem.edited": "(bearbeitet)",
    "messageItem.decryptingImage": "Bild wird entschlüsselt...",
    "messageItem.couldnTDecryptImage": "Bild konnte nicht entschlüsselt werden",
    "messageItem.imageUnavailable": "[Bild nicht verfügbar]",
    "messageItem.decryptingVideo": "Video wird entschlüsselt...",
    "messageItem.couldnTDecryptVideo":
        "Video konnte nicht entschlüsselt werden",
    "messageItem.video": "Video",
    "messageItem.canTBePlayedHere": "Kann hier nicht abgespielt werden",
    "messageItem.playbackFailedClickToRetry":
        "Wiedergabe fehlgeschlagen · Klicken zum Wiederholen",
    "messageItem.clickToPlay": "{videoDuration} · Klicken zum Abspielen",
    "messageItem.clickToPlay2": "Klicken zum Abspielen",
    "messageItem.audio": "Audio",
    "messageItem.kb": "{toFixed} KB",
    "messageItem.mb": "{toFixed} MB",
    "messageItem.fileAttachment": "Dateianhang",
    "messageItem.download": "Herunterladen",
    "messageItem.toSave": "zum Speichern ·",
    "messageItem.toCancel": "zum Abbrechen",
    "messageItem.openThread": "Thread öffnen",
    "messageItem.failedToSend": "Senden fehlgeschlagen.",
    "messageItem.retrying": "Neuer Versuch…",
    "messageItem.showWhoReadThisMessage":
        "Anzeigen, wer diese Nachricht gelesen hat",
    "messageItem.readThis":
        "{count, plural, one {# Person hat dies gelesen} other {# Personen haben dies gelesen}}",
    "messageItem.readBy": "Gelesen von",
    "messageItem.messageActions": "Nachrichtenaktionen",
    "messageItem.editMessage": "Nachricht bearbeiten",
    "messageItem.delete": "Löschen?",
    "messageItem.yesDeleteMessage": "Ja, Nachricht löschen",
    "messageItem.yes": "Ja",
    "messageItem.noKeepMessage": "Nein, Nachricht behalten",
    "messageItem.no": "Nein",
    "messageItem.deleteMessage": "Nachricht löschen",
    "messageItem.unpinMessage": "Nachricht lösen",
    "messageItem.pinMessage": "Nachricht anheften",
    "messageItem.addReaction": "Reaktion hinzufügen",
    "messageItem.reply": "Antworten",
    "messageItem.replyInThread": "Im Thread antworten",
    "messageItem.forwardMessage": "Nachricht weiterleiten",
    "messageItem.moreActions": "Weitere Aktionen",
    "messageItem.linkCopied": "Link kopiert!",
    "messageItem.copyMessageLink": "Nachrichtenlink kopieren",
    "messageItem.linkCopied2": "Link kopiert",
    "messageItem.couldnTDeleteTheMessage":
        "Nachricht konnte nicht gelöscht werden",
    "messageItem.couldnTCopyTheMessageLink":
        "Nachrichtenlink konnte nicht kopiert werden",
    "messageItem.failedToUnpinMessage": "Nachricht konnte nicht gelöst werden",
    "messageItem.failedToPinMessage":
        "Nachricht konnte nicht angeheftet werden",
    "messageItem.couldNotOpenTheMatrixLink":
        "Matrix-Link konnte nicht geöffnet werden",

    // src/lib/components/messages/MessageRedactAction.svelte
    "messageRedactAction.removeMessage": "Nachricht entfernen",
    "messageRedactAction.removeThisMessage": "Diese Nachricht entfernen?",
    "messageRedactAction.removing": "Wird entfernt…",
    "messageRedactAction.failedToRemoveMessage":
        "Nachricht konnte nicht entfernt werden",

    // src/lib/components/messages/MessageReportAction.svelte
    "messageReportAction.reportMessage": "Nachricht melden",
    "messageReportAction.reportSent": "Meldung gesendet",
    "messageReportAction.whyAreYouReportingThisMessage":
        "Warum meldest du diese Nachricht?",
    "messageReportAction.markAsExtremelyOffensive":
        "Als äußerst anstößig markieren",
    "messageReportAction.reporting": "Wird gemeldet…",
    "messageReportAction.report": "Melden",

    // src/lib/components/layout/MessageSearchPanel.svelte
    "messageSearchPanel.searchMessages": "Nachrichten durchsuchen",
    "messageSearchPanel.searchTryFromOrHasImage":
        "Suche - probiere from: oder has:image",
    "messageSearchPanel.searchForMessagesInThisRoom":
        "Nachrichten in diesem Raum suchen.",
    "messageSearchPanel.noMatchesInTheResultsLoaded":
        "Keine Treffer in den bisher geladenen Ergebnissen.",
    "messageSearchPanel.noResultsFor": "Keine Ergebnisse für „{searched}“.",
    "messageSearchPanel.searchFailed": "Suche fehlgeschlagen",
    "messageSearchPanel.resultCount":
        "{count, plural, one {# Ergebnis} other {# Ergebnisse}}",

    // src/lib/components/settings/MessagesMediaSettings.svelte
    "messagesMediaSettings.messages": "Nachrichten",
    "messagesMediaSettings.showMatrixIds": "Matrix-IDs anzeigen",
    "messagesMediaSettings.showFullMatrixIdsLikeUser":
        "In der gesamten App vollständige Matrix-IDs wie @user:server statt Anzeigenamen anzeigen.",
    "messagesMediaSettings.readReceiptAvatars": "Avatare für Lesebestätigungen",
    "messagesMediaSettings.showWhoHasReadEachMessage":
        "Unter jeder Nachricht als kleine Avatare anzeigen, wer sie gelesen hat. Dies ändert nur, was du auf diesem Gerät siehst - damit andere nicht sehen, wie weit du gelesen hast, verwende private Lesebestätigungen unter Privatsphäre und Sicherheit.",
    "messagesMediaSettings.holdToOpenMessageMenu":
        "Gedrückt halten für Nachrichtenmenü",
    "messagesMediaSettings.onTouchDevicesOpenAMessage":
        "Auf Touch-Geräten die Aktionen einer Nachricht durch Gedrückthalten statt Antippen öffnen. Wenn aus, öffnet ein Tippen das Menü.",
    "messagesMediaSettings.linkPreviews": "Linkvorschauen",
    "messagesMediaSettings.whenOffNoLinkPreviewIs":
        "Wenn aus, wird keine Linkvorschau geladen und dein Heimserver ruft die verlinkte Seite nie für dich ab. Woher Vorschaumedien geladen werden, legst du unter Privatsphäre und Sicherheit fest.",
    "messagesMediaSettings.pauseVideosOffScreen":
        "Videos außerhalb des Bildschirms pausieren",
    "messagesMediaSettings.pauseAPlayingVideoWhenIt":
        "Ein laufendes Video pausieren, wenn es aus dem Bild scrollt, um Akku zu sparen. Beim Zurückscrollen startest du es selbst neu.",
    "messagesMediaSettings.defaultTab": "Standard-Tab",
    "messagesMediaSettings.whichTabTheGifPickerOpens":
        "Welcher Tab in der GIF-Auswahl zuerst geöffnet wird.",
    "messagesMediaSettings.defaultGifTab": "Standard-GIF-Tab",
    "messagesMediaSettings.favourites": "Favoriten",

    // src/lib/components/ui/ModalDialog.fixture.svelte
    "modalDialog.fixture.fixtureDialog": "Testdialog",

    // src/lib/components/settings/NotificationSettings.svelte
    "notificationSettings.thisDevice": "Dieses Gerät",
    "notificationSettings.systemPermission": "Systemberechtigung",
    "notificationSettings.pushNotifications": "Push-Benachrichtigungen",
    "notificationSettings.permissionIsBlockedInSystemSettings":
        "Die Berechtigung ist in den Systemeinstellungen blockiert",
    "notificationSettings.notificationsAreNotSupportedHere":
        "Benachrichtigungen werden hier nicht unterstützt",
    "notificationSettings.allowThisAppToSendNotifications":
        "Dieser App erlauben, Benachrichtigungen zu senden",
    "notificationSettings.requesting": "Wird angefragt…",
    "notificationSettings.blocked": "Blockiert",
    "notificationSettings.unavailable": "Nicht verfügbar",
    "notificationSettings.enable": "Aktivieren",
    "notificationSettings.sound": "Ton",
    "notificationSettings.notificationSound": "Benachrichtigungston",
    "notificationSettings.playASoundForLoudNotifications":
        "Bei lauten Benachrichtigungen einen Ton abspielen",
    "notificationSettings.desktopAlerts": "Desktop-Hinweise",
    "notificationSettings.popUpAndTaskbarFlash":
        "Pop-up und Blinken der Taskleiste",
    "notificationSettings.whichNotificationsShowASystemPop":
        "Welche Benachrichtigungen ein System-Pop-up anzeigen und in der Desktop-App das Taskleistensymbol blinken lassen, während das Fenster im Hintergrund ist.",
    "notificationSettings.multipleDevices": "Mehrere Geräte",
    "notificationSettings.quietOnMyOtherDevices":
        "Auf meinen anderen Geräten leise",
    "notificationSettings.whileYouReActivelyUsingOne":
        "Während du ein Gerät aktiv nutzt, verzichten die anderen auf Benachrichtigungston und Pop-up, bis dieses Gerät so lange inaktiv war. Gilt für alle Geräte deines Kontos; Benachrichtigungen erscheinen weiterhin im Posteingang und die Ungelesen-Zähler bleiben gleich.",
    "notificationSettings.custom": "Benutzerdefiniert…",
    "notificationSettings.customQuietDurationInMinutes":
        "Eigene Ruhedauer in Minuten",
    "notificationSettings.minutesMax":
        "Minuten (max. {MAX_CUSTOM_GRACE_MINUTES})",
    "notificationSettings.couldnTSaveToYourAccount":
        "Konnte nicht in deinem Konto gespeichert werden - deine anderen Geräte behalten eventuell die alte Einstellung. Prüfe deine Verbindung und versuche es erneut.",
    "notificationSettings.retrySavingTheOtherDeviceQuiet":
        "Speichern der Ruheeinstellung für andere Geräte erneut versuchen",
    "notificationSettings.retrying": "Neuer Versuch…",
    "notificationSettings.rules": "Regeln",
    "notificationSettings.notificationRules": "Benachrichtigungsregeln",
    "notificationSettings.loudNotifyWithSoundSilentNotify":
        "Laut = mit Ton benachrichtigen · Leise = ohne Ton benachrichtigen · Aus = keine Benachrichtigung",
    "notificationSettings.keywordHighlights": "Schlüsselwort-Hervorhebungen",
    "notificationSettings.getNotifiedWhenAMessageContains":
        "Werde benachrichtigt, wenn eine Nachricht ein Wort oder eine Phrase enthält. Groß-/Kleinschreibung wird ignoriert;",
    "notificationSettings.and": "und",
    "notificationSettings.areWildcards": "sind Platzhalter.",
    "notificationSettings.addAKeyword": "Schlüsselwort hinzufügen…",
    "notificationSettings.newKeyword": "Neues Schlüsselwort",
    "notificationSettings.noKeywordRulesYet": "Noch keine Schlüsselwortregeln.",
    "notificationSettings.behaviorFor": "Verhalten für {pattern}",
    "notificationSettings.enable2": "{pattern} aktivieren",
    "notificationSettings.loudOnly": "Nur laut",
    "notificationSettings.onlyNotificationsThatMakeASound":
        "Nur Benachrichtigungen mit Ton",
    "notificationSettings.silentAndLoud": "Leise und laut",
    "notificationSettings.everyNotificationLoudOrSilent":
        "Jede Benachrichtigung, laut oder leise",
    "notificationSettings.none": "Keine",
    "notificationSettings.neverAlertOnThisDevice":
        "Auf diesem Gerät nie benachrichtigen",
    "notificationSettings.couldNotSaveNotificationSetting":
        "Benachrichtigungseinstellung konnte nicht gespeichert werden",
    "notificationSettings.highlightSound": "Hervorhebung + Ton",
    "notificationSettings.notifyWithAHighlightAndSound":
        "Mit Hervorhebung und Ton benachrichtigen",
    "notificationSettings.highlight": "Hervorhebung",
    "notificationSettings.notifyWithAHighlight":
        "Mit Hervorhebung benachrichtigen",
    "notificationSettings.notify": "Benachrichtigen",
    "notificationSettings.notifyWithoutAHighlight":
        "Ohne Hervorhebung benachrichtigen",
    "notificationSettings.failedToAddKeyword":
        "Schlüsselwort konnte nicht hinzugefügt werden",
    "notificationSettings.failedToUpdateKeyword":
        "Schlüsselwort konnte nicht aktualisiert werden",
    "notificationSettings.failedToDeleteKeyword":
        "Schlüsselwort konnte nicht gelöscht werden",

    // src/lib/components/layout/NotificationsPanel.svelte
    "notificationsPanel.clearAll": "Alle löschen",
    "notificationsPanel.couldNotRefreshServerNotificationsTap":
        "Serverbenachrichtigungen konnten nicht aktualisiert werden. Tippe, um es erneut zu versuchen.",
    "notificationsPanel.noNotifications": "Keine Benachrichtigungen.",
    "notificationsPanel.jumpToMessage": "Zur Nachricht springen:",
    "notificationsPanel.in": "in #{roomName}",
    "notificationsPanel.message": "(Nachricht)",

    // src/lib/components/messages/OutboxStrip.svelte
    "outboxStrip.queued": "In Warteschlange",
    "outboxStrip.sending": "Wird gesendet…",
    "outboxStrip.failed": "Fehlgeschlagen",

    // src/lib/components/layout/OwnStatusEditor.svelte
    "ownStatusEditor.pickAStatusEmoji": "Status-Emoji wählen",
    "ownStatusEditor.whatSHappening": "Was gibt's Neues?",
    "ownStatusEditor.statusText": "Statustext",
    "ownStatusEditor.clearStatus": "Status löschen",
    "ownStatusEditor.couldNotSaveStatus":
        "Status konnte nicht gespeichert werden",

    // src/lib/components/layout/PinnedMessagesPanel.svelte
    "pinnedMessagesPanel.pinnedMessages": "Angeheftete Nachrichten",
    "pinnedMessagesPanel.noPinnedMessages": "Keine angehefteten Nachrichten.",
    "pinnedMessagesPanel.jump": "Springen",
    "pinnedMessagesPanel.unpin": "Lösen",

    // src/lib/components/plugins/PluginPopoverHost.svelte
    "pluginPopoverHost.plugin": "Plugin",

    // src/lib/components/settings/PluginSettingsForm.svelte
    "pluginSettingsForm.backToPlugins": "Zurück zu den Plugins",
    "pluginSettingsForm.settings": "Einstellungen für {pluginName}",
    "pluginSettingsForm.thisPluginHasNoSettings":
        "Dieses Plugin hat keine Einstellungen.",
    "pluginSettingsForm.moveUp": "Nach oben",
    "pluginSettingsForm.moveDown": "Nach unten",
    "pluginSettingsForm.removeRow": "Zeile entfernen",

    // src/lib/components/settings/PluginsSettings.svelte
    "pluginsSettings.back": "← Zurück",
    "pluginsSettings.syncYourEnabledPluginsSettingsTo":
        "Synchronisiere deine aktivierten Plugins und Einstellungen mit deinem Matrix-Konto (sonst pro Gerät). Beim Abrufen wird angezeigt, was sich ändert, bevor etwas ausgeführt wird.",
    "pluginsSettings.pushToAccount": "An Konto senden",
    "pluginsSettings.pullFromAccount": "Vom Konto abrufen",
    "pluginsSettings.thisPullWill": "Dieser Abruf wird:",
    "pluginsSettings.addRepos": "Repos hinzufügen: {join}",
    "pluginsSettings.enable": "Aktivieren: {join}",
    "pluginsSettings.disable": "Deaktivieren: {join}",
    "pluginsSettings.updateSettingsFor":
        "Einstellungen aktualisieren für: {join}",
    "pluginsSettings.setAutoUpdate": "Automatische Updates: {value}",
    "pluginsSettings.setPerPluginAutoUpdate":
        "Automatische Updates pro Plugin: {join}",
    "pluginsSettings.notInstalledOnThisDeviceInstall":
        "Auf diesem Gerät nicht installiert (über „Durchsuchen“ installieren, dann erneut abrufen): {join}",
    "pluginsSettings.nothingToChangeAlreadyInSync":
        "Nichts zu ändern; bereits synchron.",
    "pluginsSettings.apply": "Anwenden",
    "pluginsSettings.installed": "Installiert",
    "pluginsSettings.noPluginsInstalled": "Keine Plugins installiert.",
    "pluginsSettings.needsUpdate": "Update erforderlich",
    "pluginsSettings.updateToV": "Auf v{value} aktualisieren",
    "pluginsSettings.updating": "Wird aktualisiert...",
    "pluginsSettings.update": "Aktualisieren",
    "pluginsSettings.pluginSettings": "Plugin-Einstellungen",
    "pluginsSettings.enable2": "{name} aktivieren",
    "pluginsSettings.working": "In Arbeit...",
    "pluginsSettings.autoUpdateThisPlugin":
        "Dieses Plugin automatisch aktualisieren",
    "pluginsSettings.autoDefault": "Auto: Standard",
    "pluginsSettings.autoOn": "Auto: An",
    "pluginsSettings.autoOff": "Auto: Aus",
    "pluginsSettings.confirmRemove": "Entfernen von {name} bestätigen",
    "pluginsSettings.removePlugin": "Plugin entfernen",
    "pluginsSettings.remove": "{name} entfernen",
    "pluginsSettings.browse": "Durchsuchen",
    "pluginsSettings.loading": "Lädt...",
    "pluginsSettings.noPluginsInThisRepoYet":
        "Noch keine Plugins in diesem Repo.",
    "pluginsSettings.install": "Installieren",
    "pluginsSettings.repos": "Repos",
    "pluginsSettings.official": "Offiziell",
    "pluginsSettings.removeRepo": "Repo entfernen",
    "pluginsSettings.addARepo": "Repo hinzufügen",
    "pluginsSettings.thirdPartyReposRunFullTrust":
        "Repos von Drittanbietern führen Code mit vollem Vertrauen und vollem Zugriff auf dein Konto und deine Nachrichten aus. Füge nur Repos hinzu, denen du vertraust.",
    "pluginsSettings.ownerRepoOrGithubUrl": "besitzer/repo oder GitHub-URL",
    "pluginsSettings.addRepo": "Repo hinzufügen",
    "pluginsSettings.syncPlugins": "Plugins synchronisieren",
    "pluginsSettings.disableAllPlugins": "Alle Plugins deaktivieren",
    "pluginsSettings.autoUpdatePlugins": "Plugins automatisch aktualisieren",
    "pluginsSettings.automaticallyPullNewerVersionsOfRepo":
        "Neuere Versionen von Repo-Plugins automatisch abrufen.",
    "pluginsSettings.pushedYourPluginSetToYour":
        "Deine Plugin-Auswahl wurde an dein Konto gesendet.",
    "pluginsSettings.pushFailed": "Senden fehlgeschlagen.",
    "pluginsSettings.pullFailed": "Abruf fehlgeschlagen.",
    "pluginsSettings.appliedTheSyncedPluginSet":
        "Synchronisierte Plugin-Auswahl angewendet.",
    "pluginsSettings.updateFailed": "Update fehlgeschlagen.",
    "pluginsSettings.couldnTRemovePlugin":
        "Plugin konnte nicht entfernt werden: {message}",
    "pluginsSettings.couldnTRemovePlugin2":
        "Plugin konnte nicht entfernt werden.",
    "pluginsSettings.cannotAddThisRepo":
        "Dieses Repo kann nicht hinzugefügt werden.",
    "pluginsSettings.noIndexJson": "Keine index.json ({status})",
    "pluginsSettings.installFailed": "Installation fehlgeschlagen.",

    // src/lib/components/messages/PollBody.svelte
    "pollBody.finalResults": "Endergebnis",
    "pollBody.livePoll": "Laufende Umfrage",
    "pollBody.resultsAreRevealedWhenThePoll":
        "Die Ergebnisse werden am Ende der Umfrage angezeigt",
    "pollBody.chooseUpTo": "· bis zu {maxSelections} auswählen",
    "pollBody.selected": "✓ ausgewählt",
    "pollBody.submitting": "Wird gesendet…",
    "pollBody.submitVote": "Abstimmen",
    "pollBody.votesAreHidden": "Stimmen sind verborgen",
    "pollBody.savingVote": "· Stimme wird gespeichert…",
    "pollBody.closeThisPoll": "Diese Umfrage beenden?",
    "pollBody.closing": "Wird beendet…",
    "pollBody.closePoll": "Umfrage beenden",
    "pollBody.pollUnsupportedFormat": "[Umfrage - nicht unterstütztes Format]",
    "pollBody.failedToSubmitVote": "Stimme konnte nicht abgegeben werden",
    "pollBody.failedToClosePoll": "Umfrage konnte nicht beendet werden",
    "pollBody.voteCount": "{count, plural, one {# Stimme} other {# Stimmen}}",

    // src/lib/components/ui/Portal.fixture.svelte
    "portal.fixture.hello": "hallo",

    // src/lib/components/settings/PrivacySafetySettings.svelte
    "privacySafetySettings.privacy": "Privatsphäre",
    "privacySafetySettings.privateReadReceipts": "Private Lesebestätigungen",
    "privacySafetySettings.hideYourReadReceiptsFromOther":
        "Deine Lesebestätigungen vor anderen Benutzern verbergen. Deine Ungelesen-Zähler funktionieren weiterhin; andere sehen nur nicht, wie weit du gelesen hast.",
    "privacySafetySettings.hideMessageTextInNotifications":
        "Nachrichtentext in Benachrichtigungen ausblenden",
    "privacySafetySettings.notificationsOnThisDeviceSayWho":
        "Benachrichtigungen auf diesem Gerät zeigen, wer dir geschrieben hat, aber nicht was. Absender- und Raumnamen werden weiterhin angezeigt. Gilt nur für dieses Gerät.",
    "privacySafetySettings.linkPreviewMedia": "Medien in Linkvorschauen",
    "privacySafetySettings.previewImagesAndVideosUsuallyCome":
        "Vorschaubilder und -videos kommen meist direkt von der Website, die sie hostet, die dadurch deine IP-Adresse und den Zeitpunkt des Lesens erfährt. „Nur Heimserver“ lädt nur die Kopien, die dein eigener Server bereitstellt; „Aus“ lädt nichts davon. Beide blenden außerdem eingebettete YouTube-Player und X/Twitter-Karten aus, die immer direkt von diesen Seiten laden. In jedem Fall behält jede betroffene Vorschau eine Schaltfläche zum Laden ihrer Medien. Der Schalter für Linkvorschauen befindet sich unter Nachrichten und Medien.",
    "privacySafetySettings.blockedUsers": "Blockierte Benutzer",
    "privacySafetySettings.all": "Alle",
    "privacySafetySettings.loadPreviewMediaFromWhereverIt":
        "Vorschaumedien von ihrem jeweiligen Host laden",
    "privacySafetySettings.homeserverOnly": "Nur Heimserver",
    "privacySafetySettings.onlyLoadPreviewMediaYourOwn":
        "Nur Vorschaumedien laden, die dein eigener Heimserver bereitstellt",
    "privacySafetySettings.off": "Aus",
    "privacySafetySettings.neverLoadPreviewMediaAutomatically":
        "Vorschaumedien nie automatisch laden",

    // src/lib/components/settings/ProfileFieldsEditor.svelte
    "profileFieldsEditor.moreAboutYou": "Mehr über dich",
    "profileFieldsEditor.banner": "Banner",
    "profileFieldsEditor.yourBanner": "Dein Banner",
    "profileFieldsEditor.changeBanner": "Banner ändern",
    "profileFieldsEditor.showWhenIAmInA":
        "Anzeigen, wenn ich in einem Anruf bin",
    "profileFieldsEditor.addsInACallToYour":
        "Fügt „Im Anruf“ zu deinem Profil hinzu, solange du mit einem Sprachanruf verbunden bist, und entfernt es, wenn du ihn verlässt.",
    "profileFieldsEditor.pronouns": "Pronomen",
    "profileFieldsEditor.sheHerTheyThem": "sie/ihr, they/them",
    "profileFieldsEditor.separateWithCommasMostPreferredFirst":
        "Mit Kommas trennen, bevorzugtes zuerst.",
    "profileFieldsEditor.status": "Status",
    "profileFieldsEditor.statusEmoji": "Status-Emoji",
    "profileFieldsEditor.pickAStatusEmoji": "Status-Emoji wählen",
    "profileFieldsEditor.onHolidayUntilThe23rd": "Im Urlaub bis zum 23.",
    "profileFieldsEditor.statusText": "Statustext",
    "profileFieldsEditor.bio": "Über mich",
    "profileFieldsEditor.tellPeopleAboutYourself": "Erzähl etwas über dich",
    "profileFieldsEditor.timezone": "Zeitzone",
    "profileFieldsEditor.timezoneRegion": "Zeitzonen-Region",
    "profileFieldsEditor.notSet": "Nicht festgelegt",
    "profileFieldsEditor.timezoneCity": "Zeitzonen-Stadt",
    "profileFieldsEditor.chooseACity": "Stadt wählen",
    "profileFieldsEditor.europeLondon": "Europe/Berlin",
    "profileFieldsEditor.useMine": "Meine verwenden",
    "profileFieldsEditor.usernameColour": "Farbe des Benutzernamens",
    "profileFieldsEditor.usernameColourOnDarkThemes":
        "Namensfarbe in dunklen Designs",
    "profileFieldsEditor.darkThemes": "dunkle Designs",
    "profileFieldsEditor.usernameColourOnLightThemes":
        "Namensfarbe in hellen Designs",
    "profileFieldsEditor.lightThemes": "helle Designs",
    "profileFieldsEditor.resetToDefault": "Auf Standard zurücksetzen",
    "profileFieldsEditor.chooseAColour": "Farbe wählen",
    "profileFieldsEditor.oneColourForDarkThemesAnd":
        "Eine Farbe für dunkle und eine für helle Designs, damit dein Name in beiden gut lesbar bleibt.",
    "profileFieldsEditor.links": "Links",
    "profileFieldsEditor.label": "Bezeichnung",
    "profileFieldsEditor.linkLabel": "Linkbezeichnung",
    "profileFieldsEditor.httpsExampleOrg": "https://beispiel.de",
    "profileFieldsEditor.linkAddress": "Linkadresse",
    "profileFieldsEditor.removeLink": "Link entfernen",
    "profileFieldsEditor.addLink": "Link hinzufügen",
    "profileFieldsEditor.saved": "Gespeichert",
    "profileFieldsEditor.useATimezoneNameLikeEurope":
        "Verwende einen Zeitzonennamen wie Europe/Berlin.",
    "profileFieldsEditor.chooseACity2": "Wähle eine Stadt.",
    "profileFieldsEditor.bannerUploadFailed":
        "Hochladen des Banners fehlgeschlagen",
    "profileFieldsEditor.failedToSaveProfileFields":
        "Profilfelder konnten nicht gespeichert werden",

    // src/lib/components/layout/ProfileFooter.svelte
    "profileFooter.dismiss": "Schließen",
    "profileFooter.switchAccounts": "Konto wechseln",
    "profileFooter.unknown": "Unbekannt",

    // src/lib/components/settings/PushDiagnostics.svelte
    "pushDiagnostics.pushGateway": "Push-Gateway",
    "pushDiagnostics.notificationRelay": "Benachrichtigungs-Relay",
    "pushDiagnostics.pushNotificationsAreRelayedThroughThis":
        "Push-Benachrichtigungen laufen über dieses Gateway. Es sieht, welche Räume und Absender dich benachrichtigen, aber nie deinen Nachrichtentext.",
    "pushDiagnostics.warningYourHomeserverIsRoutingThis":
        "Warnung: Dein Heimserver leitet die Push-Benachrichtigungen dieses Geräts an ein anderes Gateway ({join}). Dieses Gateway, nicht das obige, sieht die Metadaten deiner Benachrichtigungen.",
    "pushDiagnostics.verifiedYourHomeserverRoutesNotificationsTo":
        "Verifiziert: Dein Heimserver leitet Benachrichtigungen an dieses Gateway.",
    "pushDiagnostics.noPushNotificationsAreRegisteredOn":
        "Für dieses Konto sind noch keine Push-Benachrichtigungen registriert.",

    // src/lib/components/ui/QrCodeImage.svelte
    "qrCodeImage.couldNotRenderTheVerificationCode":
        "Der Verifizierungscode konnte nicht angezeigt werden.",
    "qrCodeImage.qrCodeForDeviceVerification":
        "QR-Code zur Geräteverifizierung",

    // src/lib/components/layout/QuickActions.svelte
    "quickActions.newDm": "Neue Direktnachricht",
    "quickActions.createRoomInSpace": "Raum im Space erstellen",
    "quickActions.createNewRoom": "Neuen Raum erstellen",
    "quickActions.createNewSpace": "Neuen Space erstellen",
    "quickActions.joinRoomByAddress": "Raum per Adresse beitreten",
    "quickActions.createARoom": "Raum erstellen",
    "quickActions.createASpace": "Space erstellen",
    "quickActions.newDirectMessage": "Neue Direktnachricht",
    "quickActions.joinARoom": "Raum beitreten",
    "quickActions.spaceName": "Name des Space",
    "quickActions.roomName": "Raumname",
    "quickActions.mySpace": "Mein Space",
    "quickActions.optional": "(optional)",
    "quickActions.whatSThisSpaceAbout": "Worum geht es in diesem Space?",
    "quickActions.whatSThisRoomAbout": "Worum geht es in diesem Raum?",
    "quickActions.opensStraightIntoACallMessages":
        "Öffnet direkt einen Anruf. Nachrichten funktionieren weiterhin.",
    "quickActions.enableEncryption": "Verschlüsselung aktivieren",
    "quickActions.canTBeTurnedOffLater":
        "Kann später nicht deaktiviert werden.",
    "quickActions.findSomeoneToMessage": "Jemanden zum Schreiben finden…",
    "quickActions.encryptThisDm": "Diese Direktnachricht verschlüsseln",
    "quickActions.openTheDm": "Direktnachricht öffnen",
    "quickActions.roomAddressOrId": "Raumadresse oder -ID",
    "quickActions.roomServerCom": "#raum:server.de",
    "quickActions.requestSentYouLlBeAble":
        "Anfrage gesendet - du kannst beitreten, sobald dich jemand hereinlässt.",
    "quickActions.youCanTJoinThisRoom":
        "Du kannst diesem Raum nicht direkt beitreten, aber den Beitritt anfragen.",
    "quickActions.requestToJoin": "Beitritt anfragen",
    "quickActions.create": "Erstellen",
    "quickActions.somethingWentWrong": "Etwas ist schiefgelaufen",
    "quickActions.enterARoomAddressRoomServer":
        "Gib eine Raumadresse (#raum:server.de) oder Raum-ID (!id:server.de) ein",
    "quickActions.couldNotSendTheJoinRequest":
        "Beitrittsanfrage konnte nicht gesendet werden",

    // src/lib/components/messages/ReactorPopover.svelte
    "reactorPopover.more": "+{overflow} weitere",
    "reactorPopover.reactedWith": "Reagiert mit {label}",
    "reactorPopover.userList": "Benutzerliste",

    // src/lib/components/messages/RenameAttachmentDialog.svelte
    "renameAttachmentDialog.editAttachment": "Anhang bearbeiten",
    "renameAttachmentDialog.filename": "Dateiname",

    // src/lib/components/layout/RoomDirectory.svelte
    "roomDirectory.exploreRooms": "Räume entdecken",
    "roomDirectory.onYourHomeserver": "auf deinem Heimserver",
    "roomDirectory.publicRooms": "Öffentliche Räume {value}",
    "roomDirectory.rooms": "· ~{totalEstimate} Räume",
    "roomDirectory.searchRooms": "Räume suchen…",
    "roomDirectory.serverOptional": "Server (optional)",
    "roomDirectory.search": "Suchen",
    "roomDirectory.noRoomsFound": "Keine Räume gefunden.",
    "roomDirectory.space": "Space",
    "roomDirectory.open": "Öffnen",
    "roomDirectory.thisRoomRequiresAKnockNot":
        "Dieser Raum erfordert Anklopfen - noch nicht unterstützt",
    "roomDirectory.knockOnly": "Nur auf Anfrage",
    "roomDirectory.somethingWentWrong": "Etwas ist schiefgelaufen",

    // src/lib/components/layout/RoomHeaderOverflowMenu.svelte
    "roomHeaderOverflowMenu.moreRoomOptions": "Weitere Raumoptionen",
    "roomHeaderOverflowMenu.unread": "ungelesen",
    "roomHeaderOverflowMenu.badgeThreads":
        "{count, plural, one {{badge} ungelesene Erwähnung} other {{badge} ungelesene Erwähnungen}}",
    "roomHeaderOverflowMenu.badgePinned":
        "{count, plural, one {{badge} angeheftete Nachricht} other {{badge} angeheftete Nachrichten}}",
    "roomHeaderOverflowMenu.badgeNotifications":
        "{count, plural, one {{badge} ungelesene Benachrichtigung} other {{badge} ungelesene Benachrichtigungen}}",
    "roomHeaderOverflowMenu.badgeMedia":
        "{count, plural, one {{badge} Element} other {{badge} Elemente}}",
    "roomHeaderOverflowMenu.badgeMembers":
        "{count, plural, one {{badge} Mitglied} other {{badge} Mitglieder}}",

    // src/lib/components/layout/RoomList.svelte
    "roomList.doneReordering": "Sortieren beenden",
    "roomList.reorderRooms": "Räume sortieren",
    "roomList.spaceSettings": "Space-Einstellungen",
    "roomList.pendingInvites": "Ausstehende Einladungen",
    "roomList.inVoice": "{name} - im Sprachkanal",
    "roomList.orderValue": "Sortierwert",
    "roomList.roomSettings": "Raumeinstellungen",
    "roomList.favourites": "Favoriten",
    "roomList.channels": "Kanäle",
    "roomList.rooms": "Räume",
    "roomList.lowPriority": "Niedrige Priorität",
    "roomList.browseRooms": "Räume durchsuchen",
    "roomList.members": "{numMembers} Mitglieder",
    "roomList.requested": "Angefragt",
    "roomList.cancelRequest": "Anfrage zurückziehen",
    "roomList.youCanTJoinThisRoom":
        "Du kannst diesem Raum nicht direkt beitreten - stattdessen den Beitritt anfragen?",
    "roomList.notNow": "Nicht jetzt",
    "roomList.requestToJoin": "Beitritt anfragen",
    "roomList.directMessages": "Direktnachrichten",
    "roomList.noRoomsYet": "Noch keine Räume",
    "roomList.copyRoomLink": "Raumlink kopieren",
    "roomList.markAsRead": "Als gelesen markieren",
    "roomList.addToSpace": "Zu Space hinzufügen",
    "roomList.clickAgainToLeave": "Zum Verlassen erneut klicken",
    "roomList.leaveRoom": "Raum verlassen",
    "roomList.couldNotSendTheJoinRequest":
        "Beitrittsanfrage konnte nicht gesendet werden",
    "roomList.orderMustBeBetween0And":
        "Die Reihenfolge muss zwischen 0 und 1 liegen - stattdessen wurde {value} verwendet.",
    "roomList.failedToSetOrder": "Reihenfolge konnte nicht gesetzt werden",

    // src/lib/components/layout/RoomMediaPanel.svelte
    "roomMediaPanel.media": "Medien",
    "roomMediaPanel.closeMediaPanel": "Medienbereich schließen",
    "roomMediaPanel.media2": "Medien ({length}{value})",
    "roomMediaPanel.files": "Dateien ({length}{value})",
    "roomMediaPanel.tryAgain": "Erneut versuchen",
    "roomMediaPanel.play": "{name} - abspielen",
    "roomMediaPanel.video": "Video",
    "roomMediaPanel.audio": "Audio",
    "roomMediaPanel.file": "Datei",
    "roomMediaPanel.decryptingMedia": "Medien werden entschlüsselt",
    "roomMediaPanel.decryptingMedia2": "Medien werden entschlüsselt...",
    "roomMediaPanel.mediaCouldNotBeLoaded":
        "Medien konnten nicht geladen werden",
    "roomMediaPanel.couldNotLoadThisMedia":
        "Dieses Medium konnte nicht geladen werden.",
    "roomMediaPanel.noMediaFoundInTheLast":
        "Keine Medien in den letzten paar hundert Nachrichten gefunden.",
    "roomMediaPanel.noFilesFoundInTheLast":
        "Keine Dateien in den letzten paar hundert Nachrichten gefunden.",
    "roomMediaPanel.noImagesOrVideosInThis":
        "Noch keine Bilder oder Videos in diesem Raum.",
    "roomMediaPanel.noFilesInThisRoomYet": "Noch keine Dateien in diesem Raum.",
    "roomMediaPanel.couldNotLoadMedia": "Medien konnten nicht geladen werden.",
    "roomMediaPanel.couldNotLoadMoreMedia":
        "Weitere Medien konnten nicht geladen werden.",
    "roomMediaPanel.failedToDownloadAttachment":
        "Anhang konnte nicht heruntergeladen werden",

    // src/lib/components/layout/RoomSettings.svelte
    "roomSettings.closeSettings": "Einstellungen schließen",
    "roomSettings.backToSettings": "Zurück zu den Einstellungen",
    "roomSettings.settings": "{name} - Einstellungen",
    "roomSettings.roomAvatar": "Raumavatar",
    "roomSettings.roomName": "Raumname",
    "roomSettings.saved": "Gespeichert!",
    "roomSettings.saveChanges": "Änderungen speichern",
    "roomSettings.advanced": "Erweitert",
    "roomSettings.spaceId": "Space-ID",
    "roomSettings.roomId": "Raum-ID",
    "roomSettings.copied": "Kopiert!",
    "roomSettings.roomVersionV": "Raumversion: v{getVersion}",
    "roomSettings.upgradeRoom": "Raum aktualisieren…",
    "roomSettings.thisCreatesANewRoomOn":
        "Dadurch wird ein neuer Raum mit v{recommendedVersion} erstellt und dieser als ersetzt markiert. Mitglieder werden zum neuen Raum verwiesen.",
    "roomSettings.upgrading": "Wird aktualisiert…",
    "roomSettings.upgradeRoom2": "Raum aktualisieren",
    "roomSettings.whoCanJoin": "Wer darf beitreten?",
    "roomSettings.spaceMembersAnyoneInCanJoin":
        "Space-Mitglieder - alle in {parentSpaceNames} dürfen beitreten",
    "roomSettings.spaceMembersAnyoneInTheParent":
        "Space-Mitglieder - alle im übergeordneten Space dürfen beitreten",
    "roomSettings.messageHistory": "Nachrichtenverlauf",
    "roomSettings.guestAccess": "Gastzugang",
    "roomSettings.allowGuestsToJoinWithoutAn":
        "Gästen den Beitritt ohne Konto erlauben",
    "roomSettings.guestsAreAnonymousAccountsTheHomeserver":
        "Gäste sind anonyme Konten, die der Heimserver bei Bedarf erstellt. Viele Server deaktivieren die Gastregistrierung vollständig; dann hat diese Einstellung keine Wirkung.",
    "roomSettings.discoverability": "Auffindbarkeit",
    "roomSettings.addresses": "Adressen",
    "roomSettings.loadingAddresses": "Adressen werden geladen…",
    "roomSettings.noAddressesYet": "Noch keine Adressen.",
    "roomSettings.main": "Haupt",
    "roomSettings.remove": "{alias} entfernen",
    "roomSettings.mainAddress": "Hauptadresse",
    "roomSettings.noMainAddress": "Keine Hauptadresse",
    "roomSettings.set": "Festlegen",
    "roomSettings.myRoom": "mein-raum",
    "roomSettings.serverAccessControl": "Serverzugriffskontrolle",
    "roomSettings.controlWhichHomeserversMayParticipateIn":
        "Lege fest, welche Heimserver an diesem Raum teilnehmen dürfen. Platzhalter:",
    "roomSettings.matchesAnyCharacters": "steht für beliebige Zeichen,",
    "roomSettings.matchesOneDeniedServersAreRemoved":
        "für genau eines. Abgelehnte Server werden für diesen Raum aus der Föderation entfernt.",
    "roomSettings.noServerAclIsSetAll":
        "Keine Server-ACL festgelegt. Alle Server dürfen teilnehmen.",
    "roomSettings.allowedServersOnePerLine":
        "Erlaubte Server (einer pro Zeile)",
    "roomSettings.deniedServersOnePerLine":
        "Abgelehnte Server (einer pro Zeile)",
    "roomSettings.allowServersIdentifiedByARaw":
        "Server erlauben, die über eine reine IP-Adresse identifiziert werden",
    "roomSettings.saveServerAcl": "Server-ACL speichern",
    "roomSettings.youDoNotHavePermissionTo":
        "Du hast keine Berechtigung, die Server-ACL dieses Raums zu bearbeiten.",
    "roomSettings.appliesToTheSpaceAndAll":
        "Gilt für den Space und alle seine Räume.",
    "roomSettings.notificationLevel": "Benachrichtigungsstufe",
    "roomSettings.encryption": "Verschlüsselung",
    "roomSettings.encrypted": "Verschlüsselt",
    "roomSettings.notEncrypted": "Nicht verschlüsselt",
    "roomSettings.messagesInThisRoomAreEnd":
        "Nachrichten in diesem Raum sind Ende-zu-Ende-verschlüsselt. Das kann nicht deaktiviert werden.",
    "roomSettings.enableEncryption": "Verschlüsselung aktivieren",
    "roomSettings.typeToConfirm":
        "Zum Bestätigen {ENABLE_ENCRYPTION_CONFIRM_PHRASE} eingeben",
    "roomSettings.enabling": "Wird aktiviert…",
    "roomSettings.powerLevelRequiredForEachAction":
        "Erforderliche Berechtigungsstufe für jede Aktion (0–100).",
    "roomSettings.joinCallsVoiceVideo": "Anrufen beitreten (Sprache/Video)",
    "roomSettings.invite": "Einladen",
    "roomSettings.searchMembers": "Mitglieder suchen…",
    "roomSettings.banned": "Gebannt ({length})",
    "roomSettings.pendingJoinRequests":
        "Ausstehende Beitrittsanfragen ({length})",
    "roomSettings.deny": "Ablehnen",
    "roomSettings.approve": "Genehmigen",
    "roomSettings.unban": "Bann aufheben",
    "roomSettings.noBannedMembers": "Keine gebannten Mitglieder",
    "roomSettings.you": " (du)",
    "roomSettings.setRole": "Rolle festlegen…",
    "roomSettings.admin100": "Administrator (100)",
    "roomSettings.moderator50": "Moderator (50)",
    "roomSettings.member0": "Mitglied (0)",
    "roomSettings.muted1": "Stummgeschaltet (-1)",
    "roomSettings.kick": "Entfernen",
    "roomSettings.ban": "Bannen",
    "roomSettings.hideThisUserSMessagesEverywhere":
        "Nachrichten dieses Benutzers überall ausblenden (in deinem Konto gespeichert)",
    "roomSettings.setThe": "Setze das Feld",
    "roomSettings.fieldOnEachChildRoomTo":
        "in jedem untergeordneten Raum, um die Sortierung zu steuern (lexikografisch). Leer lassen, um nach Erstellungszeit zu sortieren.",
    "roomSettings.suggested": "Empfohlen",
    "roomSettings.removeSuggestedHint": "Empfehlung entfernen",
    "roomSettings.markAsSuggested": "Als empfohlen markieren",
    "roomSettings.unsuggest": "Nicht mehr empfehlen",
    "roomSettings.suggest": "Empfehlen",
    "roomSettings.order": "order",
    "roomSettings.removeFromSpace": "Aus Space entfernen",
    "roomSettings.noChildRooms": "Keine untergeordneten Räume",
    "roomSettings.useYourGlobalNotificationSettings":
        "Deine globalen Benachrichtigungseinstellungen verwenden.",
    "roomSettings.allMessages": "Alle Nachrichten",
    "roomSettings.notifyForEveryMessage":
        "Bei jeder Nachricht benachrichtigen.",
    "roomSettings.mentionsOnly": "Nur Erwähnungen",
    "roomSettings.notifyOnlyForMentionsAndKeywords":
        "Nur bei @Erwähnungen und Schlüsselwörtern benachrichtigen.",
    "roomSettings.neverNotify": "Nie benachrichtigen.",
    "roomSettings.failedToUpdateNotifications":
        "Benachrichtigungen konnten nicht aktualisiert werden.",
    "roomSettings.failedToEnableEncryption":
        "Verschlüsselung konnte nicht aktiviert werden",
    "roomSettings.failedToSave": "Speichern fehlgeschlagen",
    "roomSettings.uploadFailed": "Hochladen fehlgeschlagen",
    "roomSettings.failedToUpgradeRoom": "Raum konnte nicht aktualisiert werden",
    "roomSettings.failedToSaveServerAcl":
        "Server-ACL konnte nicht gespeichert werden",
    "roomSettings.couldNotChangeVisibility":
        "Sichtbarkeit konnte nicht geändert werden",
    "roomSettings.couldNotLoadThisRoomS":
        "Adressen dieses Raums konnten nicht geladen werden",
    "roomSettings.couldNotAddThatAddress":
        "Diese Adresse konnte nicht hinzugefügt werden",
    "roomSettings.thisAddressIsPublishedAsOne":
        "Diese Adresse ist als eine der Raumadressen veröffentlicht und du hast keine Berechtigung, die Veröffentlichung zurückzunehmen, daher kann sie nicht entfernt werden. Frage einen Raum-Administrator.",
    "roomSettings.couldNotRemoveThatAddress":
        "Diese Adresse konnte nicht entfernt werden",
    "roomSettings.couldNotSetTheMainAddress":
        "Hauptadresse konnte nicht festgelegt werden",
    "roomSettings.failed": "Fehlgeschlagen",
    "roomSettings.muted": "Stummgeschaltet",
    "roomSettings.admin": "Administrator",
    "roomSettings.moderator": "Moderator",
    "roomSettings.member": "Mitglied",
    "roomSettings.failedToUpdateSuggestion":
        "Empfehlung konnte nicht aktualisiert werden",
    "roomSettings.listThisRoomInTheServerDirectory":
        "Diesen Raum im Serververzeichnis auflisten",
    "roomSettings.listThisSpaceInTheServerDirectory":
        "Diesen Space im Serververzeichnis auflisten",
    "roomSettings.listsTheRoomByIdBeingFound":
        "Listet den Raum mit seiner ID. Um über den Namen gefunden zu werden, braucht es außerdem eine veröffentlichte Adresse - füge unten eine hinzu.",
    "roomSettings.listsTheSpaceByIdBeingFound":
        "Listet den Space mit seiner ID. Um über den Namen gefunden zu werden, braucht es außerdem eine veröffentlichte Adresse - füge unten eine hinzu.",
    "roomSettings.aPublishedAddressLetsPeopleFindRoom":
        "Über eine veröffentlichte Adresse können andere diesen Raum per Name statt per ID finden und ihm beitreten.",
    "roomSettings.aPublishedAddressLetsPeopleFindSpace":
        "Über eine veröffentlichte Adresse können andere diesen Space per Name statt per ID finden und ihm beitreten.",
    "roomSettings.chooseHowThisRoomNotifiesYou":
        "Lege fest, wie dieser Raum dich benachrichtigt.",
    "roomSettings.chooseHowThisSpaceNotifiesYou":
        "Lege fest, wie dieser Space dich benachrichtigt.",

    // src/lib/components/layout/ScreenSharePicker.svelte
    "screenSharePicker.chooseWhatToShare": "Wähle aus, was du teilen möchtest",
    "screenSharePicker.noPreview": "Keine Vorschau",

    // src/lib/components/layout/ScreenShareQualityChips.svelte
    "screenShareQualityChips.resolution": "Auflösung",
    "screenShareQualityChips.frameRate": "Bildrate",
    "screenShareQualityChips.fps": "{f} FPS",
    "screenShareQualityChips.shareSystemAudio": "Systemaudio teilen",
    "screenShareQualityChips.appliesToNextShare":
        "Gilt für die nächste Freigabe",
    "screenShareQualityChips.shareSystemAudioAppliesToNext":
        "Systemaudio teilen (gilt für die nächste Freigabe)",

    // src/lib/components/layout/ScreenShareQualityPopover.svelte
    "screenShareQualityPopover.goLive": "Live gehen",
    "screenShareQualityPopover.screenShareQuality":
        "Qualität der Bildschirmfreigabe",

    // src/lib/components/settings/SecuritySettings.svelte
    "securitySettings.showingTheLastReadingThatLoaded":
        "Zeigt den zuletzt geladenen Stand - er ist möglicherweise veraltet.",
    "securitySettings.securityEncryption": "Sicherheit und Verschlüsselung",
    "securitySettings.setUpRecoverySoYourCross":
        "Richte die Wiederherstellung ein, damit deine Cross-Signing-Identität und dein verschlüsselter Nachrichtenverlauf ein Abmelden auf allen Geräten überstehen.",
    "securitySettings.verification": "Verifizierung",
    "securitySettings.loadingEncryptionStatus":
        "Verschlüsselungsstatus wird geladen…",
    "securitySettings.encryptionStatusUnknownOnThisSession":
        "Verschlüsselungsstatus in dieser Sitzung unbekannt.",
    "securitySettings.recoveryKeyId": "ID des Wiederherstellungsschlüssels:",
    "securitySettings.setUpRecovery": "Wiederherstellung einrichten",
    "securitySettings.weLlCreateA": "Wir erstellen einen",
    "securitySettings.recoveryKey": "Wiederherstellungsschlüssel",
    "securitySettings.aOneTimeCodeThatUnlocks":
        "- einen einmaligen Code, der deinen verschlüsselten Verlauf entsperrt und neue Sitzungen verifiziert. Bewahre ihn sicher auf, etwa in einem Passwortmanager; er wird nur einmal angezeigt und wir können ihn nicht für dich wiederherstellen.",
    "securitySettings.confirmYourAccountPasswordToCreate":
        "Bestätige dein Kontopasswort, um deine Verschlüsselungsschlüssel zu erstellen.",
    "securitySettings.accountPassword": "Kontopasswort",
    "securitySettings.alsoLetMeUnlockWithA":
        "Auch mit einer selbst gewählten Passphrase entsperren (optional - dein Wiederherstellungsschlüssel funktioniert weiterhin und wird trotzdem angezeigt).",
    "securitySettings.recoveryPassphrase": "Wiederherstellungs-Passphrase",
    "securitySettings.atLeastCharactersWeCanT":
        "Mindestens {MIN_PASSPHRASE_LENGTH} Zeichen. Wir können sie nicht für dich zurücksetzen.",
    "securitySettings.settingUp": "Wird eingerichtet…",
    "securitySettings.continue": "Weiter",
    "securitySettings.saveYourRecoveryKey":
        "Speichere deinen Wiederherstellungsschlüssel",
    "securitySettings.thisIsShown": "Er wird",
    "securitySettings.onlyOnce": "nur einmal",
    "securitySettings.storeItNowWithoutItYou":
        " angezeigt. Speichere ihn jetzt - ohne ihn kannst du deinen verschlüsselten Verlauf nicht wiederherstellen, wenn du den Zugriff auf deine Sitzungen verlierst.",
    "securitySettings.copied": "Kopiert ✓",
    "securitySettings.copyKey": "Schlüssel kopieren",
    "securitySettings.youCanAlsoUnlockWithThe":
        "Du kannst auch mit der gewählten Passphrase entsperren. Behalte den Schlüssel trotzdem - er ist der einzige Weg hinein, falls du die Passphrase vergisst.",
    "securitySettings.iVeSavedMyRecoveryKey":
        "Ich habe meinen Wiederherstellungsschlüssel sicher aufbewahrt.",
    "securitySettings.done": "Fertig",
    "securitySettings.recoveryIsSetUp": "Wiederherstellung ist eingerichtet",
    "securitySettings.yourCrossSigningKeysAndA":
        "Deine Cross-Signing-Schlüssel und ein Schlüssel-Backup sind sicher auf dem Server gespeichert, geschützt durch deinen Wiederherstellungsschlüssel.",
    "securitySettings.recoveryIsNotSetUp":
        "Wiederherstellung ist nicht eingerichtet",
    "securitySettings.thisAccountHasNoRecoveryKey":
        "Dieses Konto hat keinen Wiederherstellungsschlüssel und kein Schlüssel-Backup, bis du den Schritt unten abschließt.",
    "securitySettings.lostYourRecoveryKeyResetRecovery":
        "Wiederherstellungsschlüssel verloren? Wiederherstellung zurücksetzen",
    "securitySettings.resettingCreatesA": "Das Zurücksetzen erstellt einen",
    "securitySettings.new": "neuen",
    "securitySettings.recoveryKeyAndReplacesYourCurrent":
        "Wiederherstellungsschlüssel und ersetzt dein aktuelles Backup. Dein alter Schlüssel funktioniert dann nicht mehr und andere Sitzungen müssen eventuell neu verifiziert werden. Tu das nur, wenn du deinen aktuellen Schlüssel verloren hast.",
    "securitySettings.yourOldRecoveryKeyAndBackup":
        "Dein alter Wiederherstellungsschlüssel und dein Backup wurden zurückgesetzt, aber die neue Wiederherstellung wurde nicht erstellt. Schließe die Einrichtung jetzt ab - bis dahin können deine Nachrichten auf einer neuen Sitzung nicht wiederhergestellt werden.",
    "securitySettings.working": "In Arbeit…",
    "securitySettings.finishSettingUpRecovery":
        "Einrichtung der Wiederherstellung abschließen",
    "securitySettings.confirmYourAccountPasswordToReset":
        "Bestätige dein Kontopasswort, um die Wiederherstellung zurückzusetzen.",
    "securitySettings.resetting": "Wird zurückgesetzt…",
    "securitySettings.resetCreateNewKey":
        "Zurücksetzen und neuen Schlüssel erstellen",
    "securitySettings.messageHistoryBackup": "Backup des Nachrichtenverlaufs",
    "securitySettings.verifyThisSessionRestoreHistory":
        "Diese Sitzung verifizieren und Verlauf wiederherstellen",
    "securitySettings.recoveryKey2": "Wiederherstellungsschlüssel",
    "securitySettings.passphrase": "Passphrase",
    "securitySettings.enterYour": "Gib Folgendes ein:",
    "securitySettings.recoveryPassphrase2": "Wiederherstellungs-Passphrase",
    "securitySettings.toVerifyThisSessionAndRestore":
        "- damit wird diese Sitzung verifiziert und dein verschlüsselter Nachrichtenverlauf wiederhergestellt.",
    "securitySettings.thisSessionIsNowVerified":
        "Diese Sitzung ist jetzt verifiziert",
    "securitySettings.encryptedHistoryRestored":
        "Verschlüsselter Verlauf wiederhergestellt",
    "securitySettings.couldNotSetUpRecovery":
        "Wiederherstellung konnte nicht eingerichtet werden",
    "securitySettings.couldNotResetRecovery":
        "Wiederherstellung konnte nicht zurückgesetzt werden",
    "securitySettings.couldNotFinishSettingUpRecovery":
        "Einrichtung der Wiederherstellung konnte nicht abgeschlossen werden",
    "securitySettings.couldNotVerifyThisSession":
        "Diese Sitzung konnte nicht verifiziert werden",

    // src/lib/components/settings/ServerSettings.svelte
    "serverSettings.scanningServer": "Server wird untersucht…",
    "serverSettings.what": "Was",
    "serverSettings.advertisesItemsMarkedUnknownArenT":
        "ankündigt. Mit „Unbekannt“ markierte Einträge kündigt der Server nicht an; sie werden erst bei Verwendung erkannt.",
    "serverSettings.accountMessaging": "Konto und Nachrichten",
    "serverSettings.voiceVideoCallingMatrixrtc":
        "Sprach-/Videoanrufe (MatrixRTC)",
    "serverSettings.server": "Server",
    "serverSettings.latestSpecVersion": "Neueste Spezifikationsversion",
    "serverSettings.defaultRoomVersion": "Standard-Raumversion",
    "serverSettings.advertisedFeatures": "Angekündigte Funktionen ({length})",
    "serverSettings.supported": "Unterstützt",
    "serverSettings.notSupported": "Nicht unterstützt",
    "serverSettings.unknown": "Unbekannt",
    "serverSettings.changePassword": "Passwort ändern",
    "serverSettings.changeDisplayName": "Anzeigenamen ändern",
    "serverSettings.changeAvatar": "Avatar ändern",
    "serverSettings.manageEmailsPhoneNumbers":
        "E-Mails / Telefonnummern verwalten",
    "serverSettings.threads": "Threads",
    "serverSettings.privateReadReceipts": "Private Lesebestätigungen",
    "serverSettings.sfuDiscoveryRtcFoci": "SFU-Erkennung (rtc_foci)",
    "serverSettings.delayedEventsCallCleanup":
        "Verzögerte Ereignisse (Anruf-Bereinigung)",
    "serverSettings.failedToReadServerCapabilities":
        "Serverfähigkeiten konnten nicht gelesen werden",

    // src/lib/components/settings/SessionSettings.svelte
    "sessionSettings.sessionName": "Sitzungsname",
    "sessionSettings.current": "Aktuell",
    "sessionSettings.rename": "Umbenennen",
    "sessionSettings.signOut": "Abmelden?",
    "sessionSettings.signOut2": "Abmelden",
    "sessionSettings.manageAtProvider": "Verwalten",
    "sessionSettings.confirmYourAccountPasswordToSign":
        "Bestätige dein Kontopasswort, um diese Sitzung abzumelden.",
    "sessionSettings.accountPassword": "Kontopasswort",
    "sessionSettings.signingOut": "Wird abgemeldet…",
    "sessionSettings.encryption": "Verschlüsselung",
    "sessionSettings.active": "Aktiv",
    "sessionSettings.unavailable": "Nicht verfügbar",
    "sessionSettings.thisDeviceSKey": "Schlüssel dieses Geräts",
    "sessionSettings.loadingDeviceKey": "Geräteschlüssel wird geladen…",
    "sessionSettings.endToEndEncryptionCouldNot":
        "Die Ende-zu-Ende-Verschlüsselung konnte in dieser Sitzung nicht starten. Verschlüsselte Räume zeigen Platzhalter.",
    "sessionSettings.encryptNewDirectMessages":
        "Neue Direktnachrichten verschlüsseln",
    "sessionSettings.newDmsYouStartAreEncrypted":
        "Neue Direktnachrichten, die du beginnst, sind standardmäßig verschlüsselt. Bestehende bleiben unverändert. Schalte das aus, wenn du Personen schreibst, deren Clients keine Verschlüsselung unterstützen.",
    "identityChange.own":
        "Your cross-signing keys changed. Verify this session again, or reset and re-sign your devices, before trusting encrypted messages.",
    "identityChange.other":
        "{user}'s cross-signing identity changed. Encrypted messages to them are held back until you accept the new identity.",
    "identityChange.accept": "Accept new identity",
    "identityChange.withdraw": "Withdraw verification",
    "identityChange.dismiss": "Dismiss identity warning",
    "sessionSettings.excludeInsecureDevices":
        "Exclude non-cross-signed devices",
    "sessionSettings.excludeInsecureDevicesHelp":
        "Only share message keys with, and only show messages from, devices their owner has cross-signed (MSC4153). Recommended. Turn off only for development or testing.",
    "sessionSettings.onlySendToVerifiedDevices":
        "Nur an verifizierte Geräte senden",
    "sessionSettings.refuseToEncryptMessagesForSessions":
        "Nachrichten nicht für Sitzungen verschlüsseln, die du nicht verifiziert hast. Sie erhalten deine Nachrichten dann gar nicht - auch deine eigenen unverifizierten Sitzungen nicht. Standardmäßig aus.",
    "sessionSettings.devicesCurrentlySignedInToThis":
        "Geräte, die derzeit bei diesem Konto angemeldet sind.",
    "sessionSettings.refreshing": "Wird aktualisiert…",
    "sessionSettings.refresh": "Aktualisieren",
    "sessionSettings.loadingSessions": "Sitzungen werden geladen…",
    "sessionSettings.otherSessions": "Andere Sitzungen {value}",
    "sessionSettings.noOtherSessionsYouReOnly":
        "Keine anderen Sitzungen - du bist nur hier angemeldet.",
    "sessionSettings.failedToLoadSessions":
        "Sitzungen konnten nicht geladen werden",
    "sessionSettings.failedToRenameSession":
        "Sitzung konnte nicht umbenannt werden",
    "sessionSettings.failedToSignOutSession":
        "Sitzung konnte nicht abgemeldet werden",
    "sessionSettings.couldNotStartVerification":
        "Verifizierung konnte nicht gestartet werden",

    // src/lib/components/messages/ShareLocationDialog.svelte
    "shareLocationDialog.shareLocation": "Standort teilen",
    "shareLocationDialog.sendOnce": "Einmal senden",
    "shareLocationDialog.shareLive": "Live teilen",
    "shareLocationDialog.locating": "Standort wird ermittelt…",
    "shareLocationDialog.useMyCurrentLocation":
        "Meinen aktuellen Standort verwenden",
    "shareLocationDialog.descriptionOptional": "Beschreibung (optional)",
    "shareLocationDialog.eGHomeTheCafOn":
        "z. B. Zuhause, das Café an der Ecke…",
    "shareLocationDialog.duration": "Dauer",
    "shareLocationDialog.yourLiveLocationIsSharedWith":
        "Dein Live-Standort wird mit diesem Raum geteilt, bis du ihn beendest oder die Zeit abläuft.",
    "shareLocationDialog.sharing": "Wird geteilt…",
    "shareLocationDialog.share": "Teilen",
    "shareLocationDialog.failedToStartLiveLocation":
        "Live-Standort konnte nicht gestartet werden",
    "shareLocationDialog.failedToShareLocation":
        "Standort konnte nicht geteilt werden",

    // src/lib/components/messages/ShareTargetSheet.svelte
    "shareTargetSheet.fileSWerenTAddedShares":
        "{droppedFiles} Datei(en) wurden nicht hinzugefügt. Freigaben sind auf {SHARE_MAX_FILES} Dateien begrenzt, je {value} MB und insgesamt {value2} MB.",
    "shareTargetSheet.addAMessage": "Nachricht hinzufügen…",
    "shareTargetSheet.searchRooms": "Räume suchen",
    "shareTargetSheet.noJoinedRoomsFound": "Keine beigetretenen Räume gefunden",
    "shareTargetSheet.send": "Senden",
    "shareTargetSheet.shareToARoom": "In einem Raum teilen",

    // src/lib/components/layout/SpaceLandingPanel.svelte
    "spaceLandingPanel.loadingRooms": "Räume werden geladen…",
    "spaceLandingPanel.browseRooms": "Räume durchsuchen",
    "spaceLandingPanel.youHavenTJoinedARoom":
        "Du bist noch keinem Raum in {spaceName} beigetreten. Wähle einen, um loszulegen.",
    "spaceLandingPanel.nothingJoinedHereYet": "Hier noch nichts beigetreten",
    "spaceLandingPanel.onlyOtherSpacesLiveInsideOpen":
        "In {spaceName} befinden sich nur andere Spaces; öffne einen über die Raumliste, um seine Räume zu durchsuchen.",
    "spaceLandingPanel.thereAreNoRoomsInYet":
        "In {spaceName} gibt es noch keine Räume.",
    "spaceLandingPanel.thisSpace": "diesem Space",
    "spaceLandingPanel.couldnTJoinTryItFrom":
        "Beitritt zu {value} fehlgeschlagen. Versuche es über „Räume durchsuchen“ in der Raumliste.",
    "spaceLandingPanel.thatRoom": "diesem Raum",

    // src/lib/components/layout/SpaceSidebar.svelte
    "spaceSidebar.home": "Startseite",
    "spaceSidebar.addASpace": "Space hinzufügen",
    "spaceSidebar.exploreRooms": "Räume entdecken",
    "spaceSidebar.folderColor": "Ordnerfarbe",
    "spaceSidebar.createRoomInSpace": "Raum im Space erstellen",
    "spaceSidebar.roomName": "Raumname",
    "spaceSidebar.myRoom": "mein-raum",
    "spaceSidebar.optional": "(optional)",
    "spaceSidebar.whatSThisRoomAbout": "Worum geht es in diesem Raum?",
    "spaceSidebar.opensStraightIntoACallMessages":
        "Öffnet direkt einen Anruf. Nachrichten funktionieren weiterhin.",
    "spaceSidebar.create": "Erstellen",
    "spaceSidebar.addExistingRoomToSpace":
        "Bestehenden Raum zum Space hinzufügen",
    "spaceSidebar.noRoomsAvailableToAdd":
        "Keine Räume zum Hinzufügen verfügbar.",
    "spaceSidebar.spaceSettings": "Space-Einstellungen",
    "spaceSidebar.copySpaceLink": "Space-Link kopieren",
    "spaceSidebar.markAsRead": "Als gelesen markieren",
    "spaceSidebar.createRoom": "Raum erstellen",
    "spaceSidebar.addExistingRoom": "Bestehenden Raum hinzufügen",
    "spaceSidebar.removeFromFolder": "Aus Ordner entfernen",
    "spaceSidebar.newFolder": "Neuer Ordner",
    "spaceSidebar.clickAgainToLeave": "Zum Verlassen erneut klicken",
    "spaceSidebar.leaveSpace": "Space verlassen",
    "spaceSidebar.setColor": "Farbe festlegen",
    "spaceSidebar.dissolveFolder": "Ordner auflösen",
    "spaceSidebar.somethingWentWrong": "Etwas ist schiefgelaufen",

    // src/lib/components/layout/Splash.svelte
    "splash.restoringSession": "Sitzung wird wiederhergestellt…",

    // src/lib/components/ui/StickerPicker.svelte
    "stickerPicker.searchStickers": "Sticker suchen…",
    "stickerPicker.searchStickers2": "Sticker suchen",
    "stickerPicker.noStickerPacksAvailable": "Keine Stickerpakete verfügbar",
    "stickerPicker.myStickers": "Meine Sticker",
    "stickerPicker.myStickers2": "Meine Sticker",

    // src/lib/components/ui/SwfEmbed.svelte
    "swfEmbed.adobeFlash": "Adobe Flash",

    // src/lib/components/settings/ThemeColorEditor.svelte
    "themeColorEditor.themeColors": "Designfarben",
    "themeColorEditor.presetName": "Name der Vorlage",
    "themeColorEditor.savePreset": "Vorlage speichern",
    "themeColorEditor.import": "Importieren",
    "themeColorEditor.pasteThemeCode": "Designcode einfügen",
    "themeColorEditor.copyCurrentPresetToClipboard":
        "Aktuelle Vorlage in die Zwischenablage kopieren",
    "themeColorEditor.copied": "Kopiert!",
    "themeColorEditor.presets": "Vorlagen",
    "themeColorEditor.delete": "Löschen?",
    "themeColorEditor.confirmDelete": "Löschen von {name} bestätigen",
    "themeColorEditor.rename": "Umbenennen",
    "themeColorEditor.delete2": "{name} löschen",
    "themeColorEditor.builtInPresetsAreReadOnly":
        "Integrierte Vorlagen sind schreibgeschützt. Zum Anpassen duplizieren:",
    "themeColorEditor.duplicateToCustomize": "Zum Anpassen duplizieren",
    "themeColorEditor.colors": "Farben",
    "themeColorEditor.backgrounds": "Hintergründe",
    "themeColorEditor.resetToDefault": "Auf Standard zurücksetzen",
    "themeColorEditor.text": "Text",
    "themeColorEditor.accentsSemantics": "Akzente und Semantik",
    "themeColorEditor.presence": "Anwesenheit",
    "themeColorEditor.details": "Details",
    "themeColorEditor.contrastWarnings": "Kontrastwarnungen",
    "themeColorEditor.messageDisplay": "Nachrichtenanzeige",
    "themeColorEditor.savedOnThisDeviceOnlyNot":
        "Nur auf diesem Gerät gespeichert. Nicht mit deinem Konto synchronisiert.",
    "themeColorEditor.appTextSize": "Textgröße der App: {round} %",
    "themeColorEditor.scalesAllTextAndSpacingAcross":
        "Skaliert sämtlichen Text und alle Abstände in der App.",
    "themeColorEditor.font": "Schriftart",
    "themeColorEditor.custom": "Eigene - {customFontName}",
    "themeColorEditor.replaceCustomFont": "Eigene Schriftart ersetzen…",
    "themeColorEditor.uploadCustomFont": "Eigene Schriftart hochladen…",
    "themeColorEditor.woff2TtfOrOtfUpTo":
        ".woff2, .ttf oder .otf bis 10 MB. Nur auf diesem Gerät gespeichert.",
    "themeColorEditor.theQuickBrownFoxJumpsOver":
        "Victor jagt zwölf Boxkämpfer quer über den großen Sylter Deich.",
    "themeColorEditor.cannotSavePreset":
        "Vorlage kann nicht gespeichert werden",
    "themeColorEditor.notAValidThemeCode": "Kein gültiger Designcode",
    "themeColorEditor.imported": "Importiert",
    "themeColorEditor.cannotImportPreset":
        "Vorlage kann nicht importiert werden",
    "themeColorEditor.copy": "{activePresetName} (Kopie)",

    // src/lib/components/layout/ThreadPanel.svelte
    "threadPanel.thread": "Thread",
    "threadPanel.collapseThread": "Thread einklappen",
    "threadPanel.expandThread": "Thread ausklappen",
    "threadPanel.closeThread": "Thread schließen",
    "threadPanel.noRepliesYetStartTheThread":
        "Noch keine Antworten. Beginne den Thread unten.",
    "threadPanel.loadOlderReplies": "Ältere Antworten laden",

    // src/lib/components/layout/ThreadsListPanel.svelte
    "threadsListPanel.threads": "Threads",
    "threadsListPanel.closeThreadsPanel": "Threadbereich schließen",
    "threadsListPanel.noThreadsInThisRoomYet":
        "Noch keine Threads in diesem Raum.",
    "threadsListPanel.youParticipated": "Du hast teilgenommen",
    "threadsListPanel.unreadMentions": "Ungelesene Erwähnungen",
    "threadsListPanel.unreadReplies": "Ungelesene Antworten",
    "threadsListPanel.couldnTLoadThreadsForThis":
        "Threads für diesen Raum konnten nicht geladen werden.",

    // src/lib/components/layout/UpdateBanner.svelte
    "updateBanner.dismissUpdateNotification": "Update-Hinweis schließen",
    "updateBanner.installFailed": "Installation fehlgeschlagen",

    // src/lib/components/ui/UserPicker.svelte
    "userPicker.remove": "{userId} entfernen",
    "userPicker.searching": "Suche läuft…",
    "userPicker.noMatchingUsers": "Keine passenden Benutzer",
    "userPicker.available":
        "{optionCount, plural, one {# Ergebnis verfügbar} other {# Ergebnisse verfügbar}}",
    "userPicker.invite": "{candidateShown} einladen",
    "userPicker.alreadyAdded": "Bereits hinzugefügt",
    "userPicker.alreadyInThisRoom": "Bereits in diesem Raum",
    "userPicker.sendAnInviteToThisExact":
        "Einladung an genau diese Benutzer-ID senden",
    "userPicker.noMatchesTypeAFullUser":
        "Keine Treffer. Gib eine vollständige Benutzer-ID ein, z. B.",
    "userPicker.userServer": "@user:server",
    "userPicker.toInviteSomeoneTheDirectoryDoesn":
        "um jemanden einzuladen, der nicht im Verzeichnis steht.",
    "userPicker.searchForPeople": "Personen suchen…",
    "userPicker.userSearchFailedYouCanStill":
        "Benutzersuche fehlgeschlagen - du kannst trotzdem eine vollständige Benutzer-ID eingeben.",

    // src/lib/components/ui/UserProfileCard.svelte
    "userProfileCard.copyUserId": "Benutzer-ID kopieren",
    "userProfileCard.copied": "Kopiert",
    "userProfileCard.localTime": "{localTime} Ortszeit ({timezone})",
    "userProfileCard.notAMemberOfThisRoom": "Kein Mitglied dieses Raums",
    "userProfileCard.mutualRooms": "Gemeinsame Räume: {total}",
    "userProfileCard.more": "+{moreCount} weitere",
    "userProfileCard.opening": "Wird geöffnet…",
    "userProfileCard.message": "Nachricht",
    "userProfileCard.verifyUser": "Benutzer verifizieren",
    "userProfileCard.kicking": "Wird entfernt…",
    "userProfileCard.confirmKick": "Entfernen bestätigen?",
    "userProfileCard.kick": "Entfernen",
    "userProfileCard.banning": "Wird gebannt…",
    "userProfileCard.confirmBan": "Bann bestätigen?",
    "userProfileCard.ban": "Bannen",
    "userProfileCard.couldNotStartVerification":
        "Verifizierung konnte nicht gestartet werden",
    "userProfileCard.couldNotCopyToClipboard":
        "Kopieren in die Zwischenablage fehlgeschlagen",
    "userProfileCard.couldNotOpenDm":
        "Direktnachricht konnte nicht geöffnet werden",
    "userProfileCard.couldNotKick": "Entfernen fehlgeschlagen",
    "userProfileCard.couldNotBan": "Bannen fehlgeschlagen",

    // src/lib/components/layout/VerificationModal.svelte
    "verificationModal.thisSessionIsNowTrusted":
        "Diese Sitzung ist jetzt vertrauenswürdig.",
    "verificationModal.theirIdentityIsNowVerified":
        "Die Identität ist jetzt verifiziert.",
    "verificationModal.noTrustWasEstablishedYouCan":
        "Es wurde kein Vertrauen hergestellt. Du kannst jederzeit neu beginnen.",
    "verificationModal.didYourOtherSessionJustScan":
        "Hat deine andere Sitzung gerade diesen Code gescannt?",
    "verificationModal.didJustScanThisCode":
        "Hat {otherUserId} gerade diesen Code gescannt?",
    "verificationModal.onlyConfirmIfYouScannedIt":
        "Bestätige nur, wenn du ihn gerade selbst gescannt hast.",
    "verificationModal.onlyConfirmIfYouWatchedThem":
        "Bestätige nur, wenn du gerade gesehen hast, wie er gescannt wurde.",
    "verificationModal.no": "Nein",
    "verificationModal.yesIScannedIt": "Ja, ich habe ihn gescannt",
    "verificationModal.deviceWithThisUser": "dem Gerät dieses Benutzers",
    "verificationModal.confirmTheSameEmojiAppearIn":
        "Bestätige, dass dieselben Emojis in derselben Reihenfolge auf {value} erscheinen.",
    "verificationModal.theyDonTMatch": "Sie stimmen nicht überein",
    "verificationModal.confirming": "Wird bestätigt…",
    "verificationModal.theyMatch": "Sie stimmen überein",
    "verificationModal.verificationCodeForYourOtherSession":
        "Verifizierungscode für deine andere Sitzung",
    "verificationModal.verificationCodeFor":
        "Verifizierungscode für {otherUserId}",
    "verificationModal.scanThisWithYourOtherSession":
        "Scanne dies mit deiner anderen Sitzung.",
    "verificationModal.askThemToScanThisCode":
        "Bitte die andere Person, diesen Code zu scannen.",
    "verificationModal.noCodeToShowRightNow": "Derzeit kein Code zum Anzeigen.",
    "verificationModal.couldNotLoadTheScanner":
        "Der Scanner konnte nicht geladen werden.",
    "verificationModal.scanAgain": "Erneut scannen",
    "verificationModal.compareAShortListOfEmoji":
        "Vergleiche zur Verifizierung eine kurze Emoji-Liste oder verwende einen QR-Code.",
    "verificationModal.compareEmoji": "Emojis vergleichen",
    "verificationModal.showACodeForTheOther":
        "Code zum Scannen für die Gegenseite anzeigen",
    "verificationModal.scanTheirCodeWithTheCamera":
        "Code der Gegenseite mit der Kamera scannen",
    "verificationModal.chooseADifferentMethod": "Andere Methode wählen",
    "verificationModal.waitingForTheOtherSideTo":
        "Warte auf Bestätigung der Gegenseite…",
    "verificationModal.verifyYourOtherSession":
        "Deine andere Sitzung verifizieren",
    "verificationModal.verify": "{value} verifizieren",
    "verificationModal.couldNotConfirmTheMatch":
        "Übereinstimmung konnte nicht bestätigt werden",
    "verificationModal.couldNotReportTheMismatch":
        "Nichtübereinstimmung konnte nicht gemeldet werden",
    "verificationModal.session": "deiner anderen Sitzung",

    // src/lib/components/layout/VideoTile.svelte
    "videoTile.fullscreen": "Vollbild",

    // src/lib/components/settings/VoiceAudioSettings.svelte
    "voiceAudioSettings.inputDevice": "Eingabegerät",
    "voiceAudioSettings.savedMicrophoneNotFoundUsingThe":
        "Gespeichertes Mikrofon nicht gefunden - das Standardgerät wird verwendet, bis es wieder verfügbar ist.",
    "voiceAudioSettings.microphoneLevel": "Mikrofonpegel",
    "voiceAudioSettings.stopTest": "Test beenden",
    "voiceAudioSettings.testMic": "Mikrofon testen",
    "voiceAudioSettings.outputDevice": "Ausgabegerät",
    "voiceAudioSettings.chooseOutputDevice": "Ausgabegerät wählen…",
    "voiceAudioSettings.audioOutputIsRoutedByThe":
        "Die Audioausgabe wird auf dieser Plattform vom Betriebssystem gesteuert.",
    "voiceAudioSettings.testSpeaker": "Lautsprecher testen",
    "voiceAudioSettings.callVolume": "Anruflautstärke",
    "voiceAudioSettings.incomingCallAudio": "Audio eingehender Anrufe",
    "voiceAudioSettings.incomingCallAudioIfThisMoves":
        "Audio eingehender Anrufe - wenn sich das bewegt, du aber nichts hörst, prüfe das gewählte Ausgabegerät und die Systemlautstärke.",
    "voiceAudioSettings.voiceProcessing": "Sprachverarbeitung",
    "voiceAudioSettings.noiseSuppression": "Rauschunterdrückung",
    "voiceAudioSettings.echoCancellation": "Echounterdrückung",
    "voiceAudioSettings.autoGainControl": "Automatische Pegelanpassung",
    "voiceAudioSettings.camera": "Kamera",
    "voiceAudioSettings.mirrorMyCamera": "Meine Kamera spiegeln",
    "voiceAudioSettings.flipYourOwnPreviewOthersAlways":
        "Spiegelt deine eigene Vorschau. Andere sehen dich immer ungespiegelt.",
    "voiceAudioSettings.stopPreview": "Vorschau beenden",
    "voiceAudioSettings.preview": "Vorschau",
    "voiceAudioSettings.callSounds": "Anruftöne",
    "voiceAudioSettings.playCallSounds": "Anruftöne abspielen",
    "voiceAudioSettings.soundVolume": "Tonlautstärke",
    "voiceAudioSettings.ringing": "Klingeln",
    "voiceAudioSettings.ringForIncomingDmCalls":
        "Bei eingehenden Anrufen in Direktnachrichten klingeln",
    "voiceAudioSettings.directMessagesRingRoomsNeverDo":
        "Direktnachrichten klingeln. Räume nie - denen trittst du im Raum selbst bei.",
    "voiceAudioSettings.ringtoneVolume": "Klingeltonlautstärke",
    "voiceAudioSettings.microphoneUnavailableCheckBrowserPermissions":
        "Mikrofon nicht verfügbar - prüfe die Browserberechtigungen",
    "voiceAudioSettings.cameraUnavailableCheckBrowserPermissions":
        "Kamera nicht verfügbar - prüfe die Browserberechtigungen",

    // src/lib/components/layout/VoiceCallPanel.svelte
    "voiceCallPanel.enableAudio": "Audio aktivieren",
    "voiceCallPanel.openCallView": "Anrufansicht öffnen",
    "voiceCallPanel.unmute": "Stummschaltung aufheben",
    "voiceCallPanel.undeafen": "Ton einschalten",
    "voiceCallPanel.deafen": "Ton ausschalten",
    "voiceCallPanel.disconnect": "Trennen",

    // src/lib/components/messages/VoiceMessagePlayer.svelte
    "voiceMessagePlayer.seek": "Spulen",
    "voiceMessagePlayer.voiceMessage": "Sprachnachricht",

    // src/lib/components/messages/VoiceRecorder.svelte
    "voiceRecorder.cancelRecording": "Aufnahme abbrechen",
    "voiceRecorder.stop": "Stopp",
    "voiceRecorder.discard": "Verwerfen",
    "voiceRecorder.discardRecording": "Aufnahme verwerfen",
    "voiceRecorder.voiceMessage": "Sprachnachricht",
    "voiceRecorder.sending": "Wird gesendet…",
    "voiceRecorder.send": "Senden",
    "voiceRecorder.microphoneAccessWasDenied":
        "Zugriff auf das Mikrofon wurde verweigert.",
    "voiceRecorder.recordingFailed": "Aufnahme fehlgeschlagen.",
    "voiceRecorder.nothingWasRecorded": "Es wurde nichts aufgenommen.",
    "voiceRecorder.failedToSendVoiceMessage":
        "Sprachnachricht konnte nicht gesendet werden",

    // src/lib/components/settings/WhatsNew.svelte
    "whatsNew.whatSNew": "Neuigkeiten",
    "whatsNew.loadingReleaseNotes": "Versionshinweise werden geladen…",
    "whatsNew.releaseNotesUnavailable": "Versionshinweise nicht verfügbar.",
    "whatsNew.viewOnGithub": "Auf GitHub ansehen",

    // src/lib/components/layout/WhatsNewModal.svelte
    "whatsNewModal.whatSNew": "Neuigkeiten",
    "whatsNewModal.whatSNewInV": "Neu in v{APP_VERSION}",
    "whatsNewModal.releaseNotesUnavailable":
        "Versionshinweise nicht verfügbar.",
    "whatsNewModal.viewOnGithub": "Auf GitHub ansehen",
    "whatsNewModal.gotIt": "Verstanden",

    // src/lib/components/layout/VerificationRequestCard.svelte
    "verificationRequestCard.verifyYourOtherSession":
        "Deine andere Sitzung verifizieren",
    "verificationRequestCard.verificationRequest": "Verifizierungsanfrage",
    "verificationRequestCard.anotherOfYourSessions":
        "Eine deiner anderen Sitzungen",

    // src/lib/components/messages/CallEventCard.svelte
    "callEventCard.missedCall": "Verpasster Anruf",
    "callEventCard.ongoingCall": "Laufender Anruf",
    "callEventCard.callEnded": "Anruf beendet",

    // src/lib/components/messages/ComposerActionsMenu.svelte
    "composerActionsMenu.uploadAFile": "Datei hochladen",
    "composerActionsMenu.createPoll": "Umfrage erstellen",
    "composerActionsMenu.recordVoiceMessage": "Sprachnachricht aufnehmen",
    "composerActionsMenu.shareLocation": "Standort teilen",
    "composerActionsMenu.createThread": "Thread erstellen",

    // src/lib/components/messages/Reactions.svelte
    "reactions.couldNotAddReaction": "Reaktion konnte nicht hinzugefügt werden",

    // src/lib/components/ui/QrScanner.svelte
    "qrScanner.startingTheCamera": "Kamera wird gestartet…",
    "qrScanner.cameraAccessWasDenied":
        "Zugriff auf die Kamera wurde verweigert.",
    "qrScanner.noCameraWasFoundOnThis":
        "Auf diesem Gerät wurde keine Kamera gefunden.",
    "qrScanner.theCameraIsAlreadyInUse":
        "Die Kamera wird bereits von einer anderen App verwendet.",
    "qrScanner.couldNotOpenTheCameraA":
        "Die Kamera konnte nicht geöffnet werden. Eine sichere Verbindung (https) ist erforderlich.",
    "qrScanner.codeFoundCheckingIt": "Code gefunden - wird geprüft…",
    "qrScanner.couldNotStartVerificationWithThat":
        "Mit diesem Code konnte keine Verifizierung gestartet werden.",
    "qrScanner.thatIsnTAVerificationCode": "Das ist kein Verifizierungscode.",
    "qrScanner.thisDeviceHasNoCameraAvailable":
        "Auf diesem Gerät ist keine Kamera verfügbar.",
    "qrScanner.couldNotStartTheCameraPreview":
        "Die Kameravorschau konnte nicht gestartet werden.",
    "qrScanner.pointTheCameraAtTheirCode":
        "Richte die Kamera auf den Code der Gegenseite.",

    // src/lib/desktopContextMenu.ts
    "desktopContextMenu.failedToSaveImage":
        "Bild konnte nicht gespeichert werden",

    // src/lib/matrix/client.ts
    "client.serverAutoDiscoveryFailedUsingThe":
        "Automatische Servererkennung fehlgeschlagen - die eingegebene Adresse wird verwendet",
    "client.discoveredHomeserverFailedValidation":
        "Der erkannte Heimserver hat die Prüfung nicht bestanden",
    "client.thisHomeserverDoesnTSupportSliding":
        "Dieser Heimserver unterstützt kein Sliding Sync, daher wird stattdessen die klassische Synchronisierung verwendet.",
    "client.notLoggedIn": "Nicht angemeldet",
    "client.oauthProviderChanged":
        "Der Anmeldeanbieter des Servers hat sich geändert. Bitte versuche es erneut.",
    "client.thisEventTypeCannotBeForwarded":
        "Dieser Ereignistyp kann nicht weitergeleitet werden",
    "client.notConnected": "Nicht verbunden",
    "client.thisServerDoesNotAllowSigning":
        "Dieser Server erlaubt das Abmelden von Sitzungen per Passwort nicht - verwende stattdessen seine Kontoseite.",
    "client.incorrectPassword": "Falsches Passwort",
    "client.thisServerDoesNotAllowConfirming":
        "Dieser Server erlaubt das Bestätigen dieser Aktion per Passwort nicht - verwende stattdessen seine Kontoseite.",
    "client.directMessages": "Direktnachrichten",
    "client.messagesInDirectMessageRooms":
        "Nachrichten in Direktnachrichten-Räumen",
    "client.rooms": "Räume",
    "client.messagesInAllOtherRooms": "Nachrichten in allen anderen Räumen",
    "client.fullMatrixIdMentions": "Erwähnungen der vollständigen Matrix-ID",
    "client.messagesUsingYourFullUserHomeserver":
        "Nachrichten mit deiner vollständigen ID @user:homeserver",
    "client.displayNameMentions": "Erwähnungen des Anzeigenamens",
    "client.messagesContainingYourDisplayName":
        "Nachrichten, die deinen Anzeigenamen enthalten",
    "client.usernameMentions": "Erwähnungen des Benutzernamens",
    "client.messagesContainingYourUsernameWithoutServer":
        "Nachrichten, die deinen Benutzernamen enthalten (ohne Server)",
    "client.roomMentions": "@room-Erwähnungen",
    "client.messagesUsingRoomToNotifyEveryone":
        "Nachrichten, die mit @room alle benachrichtigen",
    "client.invitations": "Einladungen",
    "client.whenYouAreInvitedToA": "Wenn du in einen Raum eingeladen wirst",
    "client.thisRoom": "diesen Raum",
    "client.keywordCannotStartWith":
        "Ein Schlüsselwort darf nicht mit „.“ beginnen",
    "client.emotes": "Emotes von {value}",
    "client.room": "Raum",
    "client.emojis": "Emojis",
    "client.enterAShortcode": "Gib ein Kürzel ein.",
    "client.useOnlyLettersNumbersDotsUnderscores":
        "Verwende nur Buchstaben, Ziffern, Punkte, Unterstriche, Pluszeichen und Bindestriche.",
    "client.chooseAtLeastOneUsage": "Wähle mindestens eine Verwendung.",
    "client.imageNotFound": "Bild nicht gefunden.",
    "client.invalidPowerLevels": "Ungültige Berechtigungsstufen: {shapeError}",
    "client.roomCreatorsPowerLevelCannotBe":
        "Die Berechtigungsstufe der Raumersteller kann in v12-Räumen nicht festgelegt werden",
    "client.restrictedJoinRequiresAtLeastOne":
        "Eingeschränkter Beitritt erfordert mindestens einen übergeordneten Space",
    "client.orderMustBeAtMost50":
        "Die Reihenfolge darf höchstens 50 druckbare ASCII-Zeichen enthalten (Leerzeichen bis ~)",
    "client.cannotSetSuggestedOnASpace":
        "„Empfohlen“ kann für einen Space-Eintrag ohne „via“ nicht gesetzt werden",
    "client.pollHasNoEventId": "Umfrage hat keine Ereignis-ID",
    "client.unsupportedPoll": "Nicht unterstützte Umfrage",
    "client.youCanTCloseThisPoll": "Du kannst diese Umfrage nicht beenden",
    "client.microphoneDisconnectedSwitchedToTheDefault":
        "Mikrofon getrennt - zum Standardgerät gewechselt",
    "client.cameraDisconnected": "Kamera getrennt",
    "client.unknownRoom": "Unbekannter Raum",
    "client.theServerRejectedItYouMay":
        "der Server hat abgelehnt - dir fehlt möglicherweise die Berechtigung, Anrufen in diesem Raum beizutreten",
    "client.callMembershipFailed":
        "Teilnahme am Anruf fehlgeschlagen: {detail}",
    "client.voiceServerRejectedTheJoin":
        "Der Sprachserver hat den Beitritt abgelehnt ({status})",
    "client.voiceCallDisconnected": "Sprachanruf getrennt",
    "client.yourMicrophoneAppearsSilentCheckYour":
        "Dein Mikrofon scheint stumm zu sein - prüfe dein Eingabegerät",
    "client.audioDeviceError": "Fehler des Audiogeräts: {message}",
    "client.couldnTSwitchToThatKept":
        "{what}-Wechsel fehlgeschlagen - das vorherige Gerät wird beibehalten",
    "client.couldnTSwitchToThatUsing":
        "{what}-Wechsel fehlgeschlagen - das Standardgerät wird verwendet",
    "client.couldnTSwitchToThatPick":
        "{what}-Wechsel fehlgeschlagen - wähle ein anderes Gerät",
    "client.couldNotStartScreenShare":
        "Bildschirmfreigabe konnte nicht gestartet werden",
    "client.couldnTChangeScreenShareQuality":
        "Qualität der Bildschirmfreigabe konnte nicht geändert werden",
    "client.couldNotStartTheCameraCheck":
        "Kamera konnte nicht gestartet werden - prüfe die Berechtigungen",
    "client.couldnTApplyAudioProcessingChange":
        "Änderung der Audioverarbeitung konnte nicht angewendet werden",
    "client.deviceNounMicrophone": "Mikrofon",
    "client.deviceNounCamera": "Kamera",

    // src/lib/matrix/crypto.ts
    "crypto.couldNotStartTheEmojiCheck":
        "Emoji-Vergleich konnte nicht gestartet werden",
    "crypto.couldNotCancelTheVerification":
        "Verifizierung konnte nicht abgebrochen werden",
    "crypto.noCodeAvailableTheOtherSide":
        "Kein Code verfügbar - die Gegenseite kann keinen scannen.",
    "crypto.couldNotGenerateAQrCode": "QR-Code konnte nicht erzeugt werden",
    "crypto.thatCodeDoesnTMatchThis":
        "Dieser Code passt nicht zu dieser Verifizierung",
    "crypto.couldNotConfirmTheQrMatch":
        "QR-Übereinstimmung konnte nicht bestätigt werden",
    "crypto.couldNotCancelTheQrMatch":
        "QR-Übereinstimmung konnte nicht abgebrochen werden",
    "crypto.encryptionIsNotReadyOnThis":
        "Die Verschlüsselung ist in dieser Sitzung nicht bereit",
    "crypto.thisServerCanTConfirmEncryption":
        "Dieser Server kann die Einrichtung der Verschlüsselung nicht per Passwort bestätigen - verwende stattdessen seine Kontoseite.",
    "crypto.incorrectPassword": "Falsches Passwort",
    "crypto.failedToGenerateARecoveryKey":
        "Wiederherstellungsschlüssel konnte nicht erzeugt werden",
    "crypto.yourOldRecoveryWasResetBut":
        "Deine alte Wiederherstellung wurde zurückgesetzt, aber die Einrichtung der neuen ist fehlgeschlagen.",
    "crypto.thatKeyDoesnTMatchThis":
        "Dieser Schlüssel passt nicht zum Backup dieses Kontos auf dem Server.",
    "crypto.thatDoesnTLookLikeA":
        "Das sieht nicht nach einem gültigen Wiederherstellungsschlüssel aus. Prüfe auf Tippfehler und versuche es erneut.",
    "crypto.thisAccountHasNoRecoverySet":
        "Für dieses Konto ist noch keine Wiederherstellung eingerichtet. Richte sie zuerst in einer Sitzung ein, die deine Schlüssel hat.",
    "crypto.thatRecoveryKeyDoesnTMatch":
        "Dieser Wiederherstellungsschlüssel passt nicht zu diesem Konto. Prüfe auf Tippfehler und versuche es erneut.",
    "crypto.thisAccountSRecoveryWasnT":
        "Die Wiederherstellung dieses Kontos wurde nicht mit einer Passphrase eingerichtet. Verwende stattdessen deinen Wiederherstellungsschlüssel.",
    "crypto.couldnTUseYourPassphraseOn":
        "Deine Passphrase konnte auf diesem Gerät nicht verwendet werden. Versuche stattdessen deinen Wiederherstellungsschlüssel.",
    "crypto.thatPassphraseDoesnTMatchThis":
        "Diese Passphrase passt nicht zu diesem Konto. Prüfe auf Tippfehler und versuche es erneut.",

    // src/lib/matrix/media.ts
    "media.notLoggedIn": "Nicht angemeldet",
    "media.failedToFetchAttachment":
        "Anhang konnte nicht abgerufen werden: {status}",
    "media.encryptedAttachmentHasAnInvalidUrl":
        "Verschlüsselter Anhang hat eine ungültige URL",
    "media.failedToFetchEncryptedAttachment":
        "Verschlüsselter Anhang konnte nicht abgerufen werden: {status}",

    // src/lib/matrix/pluginHost.ts
    "pluginHost.mediaWasUploadedByADifferent":
        "Das Medium wurde von einem anderen Konto hochgeladen",
    "pluginHost.notLoggedIn": "Nicht angemeldet",
    "pluginHost.notConnected": "Nicht verbunden",

    // src/lib/matrix/runtime.ts
    "runtime.notLoggedIn": "Nicht angemeldet",

    // src/lib/plugins/builtins/double-tap-reply/index.ts
    "doubleTapReply.doubleTapSwipeActions": "Doppeltipp- und Wischaktionen",
    "doubleTapReply.doubleTapAMessageToReply":
        "Tippe doppelt auf eine Nachricht, um zu antworten, zu reagieren oder zu bearbeiten, oder wische sie nach links, um zu antworten / zu bearbeiten.",
    "doubleTapReply.doubleTapYourMessages": "Doppeltipp auf eigene Nachrichten",
    "doubleTapReply.nothing": "Nichts",
    "doubleTapReply.reaction": "Reaktion",
    "doubleTapReply.reply": "Antworten",
    "doubleTapReply.edit": "Bearbeiten",
    "doubleTapReply.doubleTapOtherMessages":
        "Doppeltipp auf andere Nachrichten",
    "doubleTapReply.reactionEmoji": "Reaktions-Emoji",
    "doubleTapReply.sentWhenADoubleTapAction":
        "Wird gesendet, wenn eine Doppeltipp-Aktion auf „Reaktion“ gesetzt ist.",
    "doubleTapReply.swipeToReplyEdit": "Wischen zum Antworten / Bearbeiten",
    "doubleTapReply.swipeAMessageLeftToReply":
        "Wische eine Nachricht nach links, um zu antworten; wische eigene weiter, um sie zu bearbeiten.",
    "doubleTapReply.failedToReact": "Reaktion fehlgeschlagen",

    // src/lib/plugins/builtins/slash-fun/index.ts
    "slashFun.sendAnActionMessage": "Aktionsnachricht senden",
    "slashFun.appendToYourMessage": "¯\\_(ツ)_/¯ an deine Nachricht anhängen",
    "slashFun.appendToYourMessage2":
        "(╯°□°)╯︵ ┻━┻ an deine Nachricht anhängen",
    "slashFun.appendToYourMessage3":
        "┬─┬ ノ( ゜-゜ノ) an deine Nachricht anhängen",
    "slashFun.appendToYourMessage4": "( ͡° ͜ʖ ͡°) an deine Nachricht anhängen",
    "slashFun.sendYourMessageAsASpoiler": "Nachricht als Spoiler senden",
    "slashFun.sendYourMessageWithoutMarkdownFormatting":
        "Nachricht ohne Markdown-Formatierung senden",
    "slashFun.funSlashCommands": "Lustige Slash-Befehle",
    "slashFun.noveltySlashCommandsMeShrugTableflip":
        "Spaß-Slash-Befehle: /me, /shrug, /tableflip, /unflip, /lenny, /spoiler, /plain.",

    // src/lib/plugins/builtins/text-replacer/index.ts
    "textReplacer.textReplacer": "Textersetzung",
    "textReplacer.applyYourOwnStringOrRegex":
        "Eigene Text- oder Regex-Ersetzungen auf den Text ausgehender Nachrichten anwenden.",
    "textReplacer.replacementRules": "Ersetzungsregeln",
    "textReplacer.appliedToYourOutgoingMessageText":
        "Werden der Reihe nach auf den Text deiner ausgehenden Nachrichten angewendet. Empfänger sehen normalen Text.",
    "textReplacer.find": "Suchen",
    "textReplacer.textOrPattern": "Text oder Muster",
    "textReplacer.replaceWith": "Ersetzen durch",
    "textReplacer.regex": "Regex",
    "textReplacer.ignoreCase": "Groß-/Kleinschreibung ignorieren",

    // src/lib/plugins/pluginBoot.ts
    "pluginBoot.noPluginSyncDataOnYour":
        "Noch keine Plugin-Synchronisierungsdaten in deinem Konto.",
    "pluginBoot.theSyncDataOnYourAccount":
        "Die Synchronisierungsdaten in deinem Konto sind fehlerhaft.",
    "pluginBoot.autoUpdateFailed":
        "Automatisches Update fehlgeschlagen: {value}",

    // src/lib/plugins/pluginPin.ts
    "pluginPin.pluginIdMismatchIndexListsManifest":
        "Plugin-ID stimmt nicht überein: Index nennt „{entryId}“, Manifest deklariert „{manifestId}“",
    "pluginPin.cannotInstallPluginWithIdIt":
        "Plugin „{manifestId}“ kann nicht installiert werden: Es ist ein integriertes Plugin",
    "pluginPin.pluginIsAlreadyInstalledFromA":
        "Plugin „{manifestId}“ ist bereits aus einem anderen Repository installiert",

    // src/lib/plugins/repo.ts
    "repo.repoReferenceMustBeAString":
        "Die Repo-Referenz muss eine Zeichenkette sein",
    "repo.repoReferenceCannotBeEmpty": "Die Repo-Referenz darf nicht leer sein",
    "repo.branchCannotBeEmpty": "Der Branch darf nicht leer sein",
    "repo.branchCannotContain": "Der Branch darf „..“ nicht enthalten",
    "repo.invalidRepoReferenceExtraPathSegments":
        "Ungültige Repo-Referenz: zusätzliche Pfadsegmente (nicht /tree/<branch>)",
    "repo.invalidRepoReferenceMustBeOwner":
        "Ungültige Repo-Referenz: muss besitzer/repo sein",
    "repo.ownerCannotBeEmpty": "Der Besitzer darf nicht leer sein",
    "repo.invalidOwnerMustMatchAZa":
        "Ungültiger Besitzer: muss [A-Za-z0-9][A-Za-z0-9._-]* entsprechen",
    "repo.repoCannotBeEmpty": "Das Repo darf nicht leer sein",
    "repo.invalidRepoMustMatchAZa":
        "Ungültiges Repo: muss [A-Za-z0-9][A-Za-z0-9._-]* entsprechen",

    // src/lib/plugins/repoList.ts
    "repoList.enterARepoOwnerRepoOr":
        "Gib ein Repo ein (besitzer/repo oder eine GitHub-URL).",
    "repoList.thatIsTheOfficialRepoAlready":
        "Das ist das offizielle Repo (bereits enthalten).",
    "repoList.thatRepoIsAlreadyAdded": "Dieses Repo ist bereits hinzugefügt.",

    // src/lib/stores/gifSearch.svelte.ts
    "gifSearch.couldnTReachKlipyTryAgain":
        "KLIPY nicht erreichbar - versuche es erneut.",

    // src/lib/stores/liveLocation.svelte.ts
    "liveLocation.youCanTShareLiveLocation":
        "Du kannst in diesem Raum keinen Live-Standort teilen.",
    "liveLocation.couldnTStartLiveLocation":
        "Live-Standort konnte nicht gestartet werden",
    "liveLocation.expired": "Abgelaufen",
    "liveLocation.lessThanAMinuteLeft": "weniger als eine Minute übrig",
    "liveLocation.minLeft": "noch {totalMin} Min.",
    "liveLocation.hLeft": "noch {h} Std.",
    "liveLocation.hMinLeft": "noch {h} Std. {m} Min.",
    "liveLocation.justNow": "gerade eben",
    "liveLocation.sAgo": "vor {floor} Sek.",
    "liveLocation.minAgo": "vor {floor} Min.",
    "liveLocation.hAgo": "vor {floor} Std.",
    "liveLocation.n15Minutes": "15 Minuten",
    "liveLocation.n1Hour": "1 Stunde",
    "liveLocation.n8Hours": "8 Stunden",

    // src/lib/stores/outbox.svelte.ts
    "outbox.failedToSend": "Senden fehlgeschlagen",

    // src/lib/stores/settings.svelte.ts
    "settings.couldNotReadThatFile": "Diese Datei konnte nicht gelesen werden.",
    "settings.thatFileIsnTAValid": "Diese Datei ist keine gültige Schriftart.",
    "settings.fontCouldnTBeSavedOn":
        "Die Schriftart konnte auf diesem Gerät nicht gespeichert werden.",
    "settings.cannotSaveAPresetWithBuilt":
        "Eine Vorlage mit integriertem Namen kann nicht gespeichert werden: {name}",

    // src/lib/stores/shareInbox.svelte.ts
    "shareInbox.youReOfflineTheShareWas":
        "Du bist offline: Die Freigabe wurde zum Eingabefeld hinzugefügt",
    "shareInbox.couldnTSendTheShare": "Freigabe konnte nicht gesendet werden",

    // src/lib/stores/verification.svelte.ts
    "verification.finishingAnotherVerificationFirstTryAgain":
        "Zuerst wird eine andere Verifizierung abgeschlossen. Versuche es erneut.",
    "verification.waitingForTheOtherSideTo":
        "Warte auf Annahme durch die Gegenseite…",
    "verification.acceptedSettingUpTheCheck":
        "Angenommen - Prüfung wird eingerichtet…",
    "verification.verifying": "Wird verifiziert…",
    "verification.sessionVerified": "Sitzung verifiziert",
    "verification.userVerified": "Benutzer verifiziert",
    "verification.verificationCancelled": "Verifizierung abgebrochen",
    "verification.verified": "Verifiziert",
    "verification.unverified": "Nicht verifiziert",
    "verification.identityChanged": "Identität geändert",
    "verification.couldnTAcceptThisRequestTry":
        "Diese Anfrage konnte nicht angenommen werden. Versuche es erneut.",

    // src/lib/stores/voiceCall.svelte.ts
    "voiceCall.couldnTLoadTheCallComponent":
        "Die Anrufkomponente konnte nicht geladen werden. Prüfe deine Verbindung und lade die Seite dann neu.",
    "voiceCall.couldNotJoinTheVoiceCall":
        "Dem Sprachanruf konnte nicht beigetreten werden",
    "voiceCall.couldNotMuteYourMicrophone":
        "Dein Mikrofon konnte nicht stummgeschaltet werden",
    "voiceCall.couldNotUnmuteYourMicrophoneCheck":
        "Die Stummschaltung deines Mikrofons konnte nicht aufgehoben werden - prüfe dein Eingabegerät",
    "voiceCall.connecting": "Verbinde…",
    "voiceCall.voiceConnected": "Sprache verbunden",
    "voiceCall.reconnecting": "Verbindung wird wiederhergestellt…",
    "voiceCall.youWereBannedFromThisRoom":
        "Du wurdest aus diesem Raum gebannt - Anruf beendet",
    "voiceCall.youLeftThisRoomCallEnded":
        "Du hast diesen Raum verlassen - Anruf beendet",
    "voiceCall.youWereRemovedFromThisRoom":
        "Du wurdest aus diesem Raum entfernt - Anruf beendet",

    // src/lib/update.ts
    "update.noReleasesFoundYet": "Noch keine Versionen gefunden.",
    "update.githubApiError": "GitHub-API-Fehler ({status}).",
    "update.couldNotReadTheLatestVersion":
        "Die neueste Version konnte nicht gelesen werden.",

    // src/lib/utils/accountSecurity.ts
    "accountSecurity.enterYourCurrentPassword":
        "Gib dein aktuelles Passwort ein.",
    "accountSecurity.enterANewPassword": "Gib ein neues Passwort ein.",
    "accountSecurity.newPasswordMustBeAtLeast":
        "Das neue Passwort muss mindestens 8 Zeichen lang sein.",
    "accountSecurity.newPasswordMustBeDifferentFrom":
        "Das neue Passwort muss sich vom aktuellen unterscheiden.",
    "accountSecurity.passwordsDoNotMatch":
        "Die Passwörter stimmen nicht überein.",

    // src/lib/utils/activeSession.ts
    "activeSession.offAlwaysNotify": "Aus - immer benachrichtigen",
    "activeSession.n15Seconds": "15 Sekunden",
    "activeSession.n30Seconds": "30 Sekunden",
    "activeSession.n1Minute": "1 Minute",
    "activeSession.n2Minutes": "2 Minuten",
    "activeSession.n5Minutes": "5 Minuten",
    "activeSession.n10Minutes": "10 Minuten",
    "activeSession.n30Minutes": "30 Minuten",
    "activeSession.enterANumberOfMinutes": "Gib eine Anzahl von Minuten ein.",
    "activeSession.chooseAtLeast1MinuteUse":
        "Wähle mindestens 1 Minute - für kürzere Zeiten nutze die Liste oben.",
    "activeSession.chooseMinutes2HoursOrLess":
        "Wähle {MAX_CUSTOM_GRACE_MINUTES} Minuten (2 Stunden) oder weniger.",

    // src/lib/utils/audioDevices.ts
    "audioDevices.microphone": "Mikrofon",
    "audioDevices.speaker": "Lautsprecher",
    "audioDevices.camera": "Kamera",

    // src/lib/utils/audioPlayback.ts
    "audioPlayback.failedToLoadRetry":
        "Laden fehlgeschlagen · Erneut versuchen",
    "audioPlayback.clickToPlay": "Klicken zum Abspielen",

    // src/lib/utils/clientGeneration.ts
    "clientGeneration.sessionChangedBeforeTheOperationFinished":
        "Die Sitzung hat sich geändert, bevor der Vorgang abgeschlossen war",

    // src/lib/utils/customFont.ts
    "customFont.useAWoff2TtfOrOtf":
        "Verwende eine Schriftdatei im Format .woff2, .ttf oder .otf.",
    "customFont.thatFontFileIsEmpty": "Diese Schriftdatei ist leer.",
    "customFont.fontFileIsTooLargeMax":
        "Die Schriftdatei ist zu groß (max. 10 MB).",
    "customFont.customFont": "Eigene Schriftart",

    // src/lib/utils/deviceSessions.ts
    "deviceSessions.unknown": "Unbekannt",
    "deviceSessions.justNow": "Gerade eben",
    "deviceSessions.desktopApp": "Desktop-App",
    "deviceSessions.on": "{client} auf {os}",
    "deviceSessions.minutesAgo":
        "{count, plural, one {vor # Minute} other {vor # Minuten}}",
    "deviceSessions.hoursAgo":
        "{count, plural, one {vor # Stunde} other {vor # Stunden}}",
    "deviceSessions.daysAgo":
        "{count, plural, one {vor # Tag} other {vor # Tagen}}",

    // src/lib/utils/displaySources.ts
    "displaySources.screen": "Bildschirm",
    "displaySources.untitledWindow": "Unbenanntes Fenster",

    // src/lib/utils/encryptionState.ts
    "encryptionState.unableToDecryptYouMayNot":
        "Entschlüsselung nicht möglich - dir fehlen möglicherweise die Schlüssel für diese Nachricht.",
    "encryptionState.theSenderChoseNotToShare":
        "Der Absender hat entschieden, die Schlüssel für diese Nachricht nicht zu teilen.",
    "encryptionState.theSenderDidNotShareThe":
        "Der Absender hat die Schlüssel nicht geteilt, weil dieses Gerät nicht verifiziert ist. Verifiziere dieses Gerät, um solche Nachrichten zu lesen.",
    "encryptionState.encryptedMessage": "🔒 Verschlüsselte Nachricht",

    // src/lib/utils/eventShield.ts
    "eventShield.thisMessageSEncryptionCouldNot":
        "Die Verschlüsselung dieser Nachricht konnte nicht vollständig verifiziert werden.",
    "eventShield.encryptedByAnUnverifiedUser":
        "Von einem nicht verifizierten Benutzer verschlüsselt.",
    "eventShield.encryptedByADeviceNotVerified":
        "Von einem Gerät verschlüsselt, das sein Besitzer nicht verifiziert hat.",
    "eventShield.encryptedByAnUnknownOrDeleted":
        "Von einem unbekannten oder gelöschten Gerät verschlüsselt.",
    "eventShield.theAuthenticityOfThisEncryptedMessage":
        "Die Echtheit dieser verschlüsselten Nachricht kann auf diesem Gerät nicht garantiert werden.",
    "eventShield.theSenderWasPreviouslyVerifiedBut":
        "Der Absender war zuvor verifiziert, hat aber seine Identität geändert.",
    "eventShield.theSenderDoesnTMatchThe":
        "Der Absender stimmt nicht mit dem Besitzer des Geräts überein, das diese Nachricht gesendet hat.",

    // src/lib/utils/extendedProfile.ts
    "extendedProfile.aStatusNeedsBothAnEmoji":
        "Ein Status braucht sowohl ein Emoji als auch Text.",
    "extendedProfile.inACall": "Im Anruf",
    "extendedProfile.inACallForMin": "Seit {minutes} Min. im Anruf",
    "extendedProfile.inACallForH": "Seit {hours} Std. im Anruf",
    "extendedProfile.other": "Sonstige",
    "extendedProfile.atMostLinks": "Höchstens {MAX_CONNECTIONS} Links.",
    "extendedProfile.linksMustBeHttpHttpsMailto":
        "Links müssen http-, https-, mailto- oder matrix-Adressen sein.",
    "extendedProfile.inACallForHMin":
        "Seit {hours} Std. {minutes} Min. im Anruf",

    // src/lib/utils/geoErrors.ts
    "geoErrors.locationNeedsASecureHttpsConnection":
        "Der Standort benötigt eine sichere Verbindung (HTTPS) - öffne die App über https.",
    "geoErrors.locationPermissionWasDeniedCheckSite":
        "Die Standortberechtigung wurde verweigert - prüfe die Website-Berechtigungen.",
    "geoErrors.yourPositionIsUnavailableLocationOff":
        "Deine Position ist nicht verfügbar (Standort aus oder kein GPS-Signal).",
    "geoErrors.timedOutGettingYourLocation":
        "Zeitüberschreitung beim Ermitteln deines Standorts.",
    "geoErrors.couldnTGetYourLocation":
        "Dein Standort konnte nicht ermittelt werden.",
    "geoErrors.locationIsnTAvailableInThis":
        "Der Standort ist in diesem Browser nicht verfügbar.",

    // src/lib/utils/joinRules.ts
    "joinRules.onlyAvailableForRoomsInsideA":
        "Nur für Räume innerhalb eines Space verfügbar",
    "joinRules.thisRoomSVersionDoesnT":
        "Die Version dieses Raums unterstützt keinen auf einen Space beschränkten Beitritt",

    // src/lib/utils/keyBackup.ts
    "keyBackup.preparing": "Wird vorbereitet…",
    "keyBackup.fetchingYourEncryptedHistory":
        "Dein verschlüsselter Verlauf wird abgerufen…",
    "keyBackup.restoringYourEncryptedHistory":
        "Dein verschlüsselter Verlauf wird wiederhergestellt…",
    "keyBackup.restoringOfKeys":
        "{successes} von {total} Schlüsseln werden wiederhergestellt…",
    "keyBackup.noEncryptedHistoryToRestore":
        "Kein verschlüsselter Verlauf zum Wiederherstellen",
    "keyBackup.restored":
        "{count, plural, one {# Schlüssel wiederhergestellt} other {# Schlüssel wiederhergestellt}}",
    "keyBackup.ofKeysRestored":
        "{imported} von {total} Schlüsseln wiederhergestellt",
    "keyBackup.notSetUp": "Nicht eingerichtet",
    "keyBackup.notTrusted": "Nicht vertrauenswürdig",
    "keyBackup.notConnected": "Nicht verbunden",
    "keyBackup.on": "An",
    "keyBackup.encryptedMessageHistoryIsnTBeing":
        "Der verschlüsselte Nachrichtenverlauf wird nicht gesichert. Richte die Wiederherstellung ein, um ihn zu schützen.",
    "keyBackup.aBackupExistsOnTheServer":
        "Auf dem Server existiert ein Backup, dem diese Sitzung noch nicht vertraut.",
    "keyBackup.aBackupExistsButThisSession":
        "Es existiert ein Backup, aber diese Sitzung ist nicht damit verbunden. Gib deinen Wiederherstellungsschlüssel ein, um deinen Verlauf wiederherzustellen.",
    "keyBackup.messageHistoryIsBeingBackedUp":
        "Der Nachrichtenverlauf wird gesichert (v{version}).",
    "keyBackup.messageHistoryIsBeingBackedUp2":
        "Der Nachrichtenverlauf wird gesichert.",
    "keyBackup.noKeysBackedUpYet": "Noch keine Schlüssel gesichert",
    "keyBackup.backedUp":
        "{count, plural, one {# Schlüssel gesichert} other {# Schlüssel gesichert}}",
    "keyBackup.stillToUpload":
        "{count, plural, one {# Schlüssel noch hochzuladen} other {# Schlüssel noch hochzuladen}}",
    "keyBackup.everythingOnThisSessionIsBacked":
        "Alles in dieser Sitzung ist gesichert",
    "keyBackup.notSet": "Nicht festgelegt",

    // src/lib/utils/keywordRules.ts
    "keywordRules.keywordCannotBeEmpty":
        "Das Schlüsselwort darf nicht leer sein",
    "keywordRules.keywordCannotStartWith":
        "Ein Schlüsselwort darf nicht mit „.“ beginnen",
    "keywordRules.youAlreadyHaveARuleFor":
        "Du hast bereits eine Regel für dieses Schlüsselwort",

    // src/lib/utils/liveAnnouncer.ts
    "liveAnnouncer.messageFrom": "Nachricht von {sender}",
    "liveAnnouncer.newMessagesFrom":
        "{count, plural, one {# neue Nachricht von {sender}} other {# neue Nachrichten von {sender}}}",
    "liveAnnouncer.newMessages":
        "{count, plural, one {# neue Nachricht} other {# neue Nachrichten}}",

    // src/lib/utils/liveShareStop.ts
    "liveShareStop.couldnTStopSharingYourLive":
        "Das Teilen deines Live-Standorts konnte nicht beendet werden - er ist für diesen Raum weiterhin sichtbar. Nutze „Beenden wiederholen“, um es erneut zu versuchen.",
    "liveShareStop.stopping": "Wird beendet…",
    "liveShareStop.stillSharingCouldnTStop":
        "Wird weiterhin geteilt - Beenden fehlgeschlagen",
    "liveShareStop.youReAlreadySharingYourLive":
        "Du teilst in diesem Raum bereits deinen Live-Standort.",
    "liveShareStop.yourLastLiveLocationShareHere":
        "Dein letztes Teilen des Live-Standorts hier ist noch nicht beendet - beende es über das Banner des Raums, bevor du ein neues startest.",
    "liveShareStop.stop": "Beenden",
    "liveShareStop.retryStop": "Beenden wiederholen",

    // src/lib/utils/location.ts
    "location.location": "Standort",

    // src/lib/utils/mediaGallery.ts
    "mediaGallery.of": "{value} von {length}{value2}",

    // src/lib/utils/messageActionsMenu.ts
    "messageActionsMenu.edit": "Bearbeiten",
    "messageActionsMenu.unpin": "Lösen",
    "messageActionsMenu.pin": "Anheften",
    "messageActionsMenu.copyLink": "Link kopieren",
    "messageActionsMenu.report": "Melden",

    // src/lib/utils/messageDisplay.ts
    "messageDisplay.systemDefault": "Systemstandard",

    // src/lib/utils/micErrorMessage.ts
    "micErrorMessage.noMicrophoneFoundConnectOneOr":
        "Kein Mikrofon gefunden - schließe eines an oder wähle ein anderes Eingabegerät, um dem Anruf beizutreten",
    "micErrorMessage.couldNotOpenYourMicrophoneAnother":
        "Dein Mikrofon konnte nicht geöffnet werden - möglicherweise verwendet es eine andere App",

    // src/lib/utils/mutePowerLevel.ts
    "mutePowerLevel.enterAPowerLevel": "Gib eine Berechtigungsstufe ein",
    "mutePowerLevel.mustBeAWholeNumber": "Muss eine ganze Zahl sein",
    "mutePowerLevel.useToMute": "Verwende {MUTE_POWER_LEVEL} zum Stummschalten",
    "mutePowerLevel.youCanTSetALevel":
        "Du kannst keine Stufe über deiner eigenen festlegen ({ceiling})",

    // src/lib/utils/notifActions.ts
    "notifActions.reply": "Antworten",
    "notifActions.reply2": "Antworten…",
    "notifActions.markAsRead": "Als gelesen markieren",

    // src/lib/utils/notificationPrivacy.ts
    "notificationPrivacy.sentAMessage": "hat eine Nachricht gesendet",
    "notificationPrivacy.newMessage": "Neue Nachricht",

    // src/lib/utils/notifyPermission.ts
    "notifyPermission.notificationsAreBlockedSoIncomingCalls":
        "Benachrichtigungen sind blockiert, daher wirst du bei eingehenden Anrufen nicht benachrichtigt, wenn dieses Fenster verborgen ist. Hebe die Blockierung in deinen Systemeinstellungen auf.",
    "notifyPermission.thisBrowserCanTShowCall":
        "Dieser Browser kann keine Anrufhinweise anzeigen, während das Fenster verborgen ist.",

    // src/lib/utils/pollContent.ts
    "pollContent.addAQuestion": "Füge eine Frage hinzu.",
    "pollContent.addAtLeastTwoOptions": "Füge mindestens zwei Optionen hinzu.",
    "pollContent.atMostOptions": "Höchstens {MAX_ANSWERS} Optionen.",
    "pollContent.invalidNumberOfSelections": "Ungültige Anzahl an Auswahlen.",
    "pollContent.thePollHasEnded": "Die Umfrage ist beendet.",

    // src/lib/utils/powerLevels.ts
    "powerLevels.enterAPowerLevel": "Gib eine Berechtigungsstufe ein",
    "powerLevels.mustBeAWholeNumber": "Muss eine ganze Zahl sein",
    "powerLevels.mustBe0OrHigher": "Muss 0 oder höher sein",
    "powerLevels.youCanTSetALevel":
        "Du kannst keine Stufe über deiner eigenen festlegen ({ceiling})",

    // src/lib/utils/presence.ts
    "presence.online": "Online",
    "presence.away": "Abwesend",
    "presence.offline": "Offline",
    "presence.seenAsOnlineWhileTheApp":
        "Als online angezeigt, solange die App synchronisiert",
    "presence.shownAsIdleToOtherUsers":
        "Anderen Benutzern als abwesend angezeigt",
    "presence.invisible": "Unsichtbar",
    "presence.appearOfflineToOtherUsers":
        "Für andere Benutzer offline erscheinen",

    // src/lib/utils/pushRuleWrite.ts
    "pushRuleWrite.yourHomeserverHasNoNotificationRule":
        "Dein Heimserver hat keine Benachrichtigungsregel „{label}“, daher konnte sie nicht geändert werden.",
    "pushRuleWrite.yourHomeserverRejectedTheChangeTo":
        "Dein Heimserver hat die Änderung der Benachrichtigungen „{label}“ abgelehnt.",
    "pushRuleWrite.notificationsDidNotChangeOnYour":
        "Die Benachrichtigungen „{label}“ wurden auf deinem Heimserver nicht geändert.",
    "pushRuleWrite.couldNotSaveNotificationsCheckYour":
        "Die Benachrichtigungen „{label}“ konnten nicht gespeichert werden. Prüfe deine Verbindung und versuche es erneut.",

    // src/lib/utils/pusherVerification.ts
    "pusherVerification.noGatewayUrl": "(keine Gateway-URL)",

    // src/lib/utils/recoveryPassphrase.ts
    "recoveryPassphrase.enterAPassphrase": "Gib eine Passphrase ein.",
    "recoveryPassphrase.useAtLeastCharacters":
        "Verwende mindestens {MIN_PASSPHRASE_LENGTH} Zeichen.",

    // src/lib/utils/reportMessage.ts
    "reportMessage.failedToSendReport": "Meldung konnte nicht gesendet werden",

    // src/lib/utils/roomAliases.ts
    "roomAliases.enterAnAddress": "Gib eine Adresse ein.",
    "roomAliases.addressesCannotContainSpaces":
        "Adressen dürfen keine Leerzeichen enthalten.",
    "roomAliases.addressesCannotContain":
        "Adressen dürfen „:“ nicht enthalten.",
    "roomAliases.addressesCannotContain2":
        "Adressen dürfen „#“ nicht enthalten.",
    "roomAliases.addressesCannotContainControlCharacters":
        "Adressen dürfen keine Steuerzeichen enthalten.",
    "roomAliases.addressIsTooLongMaxCharacters":
        "Die Adresse ist zu lang (max. {MAX_ALIAS_LENGTH} Zeichen).",
    "roomAliases.thatAddressAlreadyExists": "Diese Adresse existiert bereits.",

    // src/lib/utils/roomCreationOutcome.ts
    "roomCreationOutcome.theServerRejectedTheChange":
        "der Server hat die Änderung abgelehnt",
    "roomCreationOutcome.theRoomWasCreatedButAdding":
        "Der Raum wurde erstellt, aber das Hinzufügen zum Space ist fehlgeschlagen: {detailSentence}",
    "roomCreationOutcome.theDirectMessageWasCreatedBut":
        "Die Direktnachricht wurde erstellt, aber das Speichern in deiner Direktnachrichtenliste ist fehlgeschlagen: {detailSentence} Sie erscheint möglicherweise als normaler Raum, bis dies erneut versucht wird.",
    "roomCreationOutcome.theRoomWasCreatedButAdding2":
        "Der Raum wurde erstellt, aber das Hinzufügen zum Space ist noch nicht bestätigt - es wird möglicherweise noch gespeichert. Versuche es erneut, falls der Raum nicht im Space erscheint.",
    "roomCreationOutcome.theDirectMessageWasCreatedBut2":
        "Die Direktnachricht wurde erstellt, aber das Speichern in deiner Direktnachrichtenliste ist noch nicht bestätigt - es wird möglicherweise noch gespeichert. Versuche es erneut, falls sie nicht in deiner Liste erscheint.",

    // src/lib/utils/roomEncryption.ts
    "roomEncryption.thisRoomIsAlreadyEncrypted":
        "Dieser Raum ist bereits verschlüsselt.",
    "roomEncryption.youNeedPowerLevelToEnable":
        "Du brauchst Berechtigungsstufe {required}, um die Verschlüsselung zu aktivieren.",
    "roomEncryption.youAlreadyHaveADirectMessage":
        "Du hast bereits eine unverschlüsselte Direktnachricht mit diesem Benutzer. Die Verschlüsselung kann nicht automatisch hinzugefügt werden - öffne sie und aktiviere sie in den Sicherheitseinstellungen des Raums.",
    "roomEncryption.enableEncryptionWarning":
        "Einmal aktiviert, kann die Verschlüsselung nicht mehr deaktiviert werden. Alle brauchen einen Client, der Verschlüsselung unterstützt, um neue Nachrichten zu lesen.",

    // src/lib/utils/roomHeaderMenu.ts
    "roomHeaderMenu.threads": "Threads",
    "roomHeaderMenu.pinnedMessages": "Angeheftete Nachrichten",
    "roomHeaderMenu.notificationsInbox": "Benachrichtigungseingang",
    "roomHeaderMenu.mediaAndFiles": "Medien und Dateien",
    "roomHeaderMenu.memberList": "Mitgliederliste",

    // src/lib/utils/roomMedia.ts
    "roomMedia.image": "Bild",
    "roomMedia.video": "Video",
    "roomMedia.file": "Datei",
    "roomMedia.audio": "Audio",
    "roomMedia.kb": "{toFixed} KB",
    "roomMedia.mb": "{toFixed} MB",

    // src/lib/utils/roomSettingsNav.ts
    "roomSettingsNav.general": "Allgemein",
    "roomSettingsNav.access": "Zugang",
    "roomSettingsNav.security": "Sicherheit",
    "roomSettingsNav.permissions": "Berechtigungen",
    "roomSettingsNav.members": "Mitglieder",
    "roomSettingsNav.emotes": "Emotes",
    "roomSettingsNav.rooms": "Räume",

    // src/lib/utils/roomStateTrust.ts
    "roomStateTrust.unverifiedRoomState": "Unverifizierter Raumzustand",
    "roomStateTrust.unverifiedRoomStateTooltip":
        "Einige Details dieses Raums (Rollen, Mitgliedschaften und Berechtigungen) wurden direkt vom Server abgerufen und noch nicht über die Synchronisierung bestätigt, daher können sie ungenau sein. Aktionen werden unabhängig von der Anzeige hier vom Server durchgesetzt.",

    // src/lib/utils/roomUpgrade.ts
    "roomUpgrade.theServerSRecommendedRoomVersion":
        "Die vom Server empfohlene Raumversion ist nicht verfügbar.",
    "roomUpgrade.thisRoomIsOnTheLatest":
        "Dieser Raum hat bereits die neueste Version (v{recommendedVersion}).",
    "roomUpgrade.youDonTHavePermissionTo":
        "Du hast keine Berechtigung, diesen Raum zu aktualisieren.",

    // src/lib/utils/saveFile.ts
    "saveFile.savedToDownloads": "In Downloads gespeichert",

    // src/lib/utils/securityStatusView.ts
    "securityStatusView.couldnTReadThisAccountS":
        "Der Verschlüsselungsstatus dieses Kontos konnte nicht gelesen werden. Nichts hier ist verlässlich, bis er geladen ist - richte die Wiederherstellung noch nicht ein und setze sie nicht zurück.",
    "securityStatusView.encryptionIsnTReadyOnThis":
        "Die Verschlüsselung ist in dieser Sitzung noch nicht bereit. Lade neu, falls das anhält.",

    // src/lib/utils/serverAcl.ts
    "serverAcl.allowListIsEmptyWhichDenies":
        "Die Erlaubnisliste ist leer, wodurch allen Servern die Föderation verweigert wird.",
    "serverAcl.denyListContainsWhichBansAll":
        "Die Sperrliste enthält *, wodurch alle Server gebannt werden.",
    "serverAcl.thisConfigurationBansYourOwnServer":
        "Diese Konfiguration bannt deinen eigenen Server ({ownServerName}), was die Föderation unterbricht.",

    // src/lib/utils/serverCapabilities.ts
    "serverCapabilities.crossSigningE2ee": "Cross-Signing (E2EE)",
    "serverCapabilities.privateReadReceipts": "Private Lesebestätigungen",
    "serverCapabilities.threadedRelations": "Thread-Beziehungen",
    "serverCapabilities.spaceSummaries": "Space-Zusammenfassungen",
    "serverCapabilities.busyPresence": "Status „beschäftigt“",
    "serverCapabilities.dehydratedDevices": "Dehydrierte Geräte",
    "serverCapabilities.filterPublicRoomsByType":
        "Öffentliche Räume nach Typ filtern",
    "serverCapabilities.authenticatedMedia": "Authentifizierte Medien",
    "serverCapabilities.intentionalMentions": "Beabsichtigte Erwähnungen",
    "serverCapabilities.slidingSyncSimplified": "Sliding Sync (vereinfacht)",
    "serverCapabilities.sharedRoomsWithAUser":
        "Gemeinsame Räume mit einem Benutzer",

    // src/lib/utils/settingsNav.ts
    "settingsNav.account": "Konto",
    "settingsNav.securitySessions": "Sicherheit und Sitzungen",
    "settingsNav.privacySafety": "Privatsphäre und Sicherheit",
    "settingsNav.app": "App",
    "settingsNav.appearance": "Darstellung",
    "settingsNav.messagesMedia": "Nachrichten und Medien",
    "settingsNav.voiceVideo": "Sprache und Video",
    "settingsNav.emotes": "Emotes",
    "settingsNav.advanced": "Erweitert",
    "settingsNav.general": "Allgemein",
    "settingsNav.plugins": "Plugins",
    "settingsNav.server": "Server",
    "settingsNav.about": "Über",
    "settingsNav.debug": "Debug",

    // src/lib/utils/settingsSearch.ts
    "settingsSearch.displayName": "Anzeigename",
    "settingsSearch.avatar": "Avatar",
    "settingsSearch.presence": "Anwesenheit",
    "settingsSearch.changePassword": "Passwort ändern",
    "settingsSearch.logOut": "Abmelden",
    "settingsSearch.deactivateAccount": "Konto deaktivieren",
    "settingsSearch.sessions": "Sitzungen",
    "settingsSearch.encryptNewDirectMessages":
        "Neue Direktnachrichten verschlüsseln",
    "settingsSearch.onlySendToVerifiedDevices":
        "Nur an verifizierte Geräte senden",
    "settingsSearch.setUpRecovery": "Wiederherstellung einrichten",
    "settingsSearch.restoreMessageHistory":
        "Nachrichtenverlauf wiederherstellen",
    "settingsSearch.verifyThisSession": "Diese Sitzung verifizieren",
    "settingsSearch.rightAlignMyMessages": "Meine Nachrichten rechtsbündig",
    "settingsSearch.showWhenIAmInA": "Anzeigen, wenn ich in einem Anruf bin",
    "settingsSearch.showNameColours": "Namensfarben anzeigen",
    "settingsSearch.textSize": "Textgröße",
    "settingsSearch.font": "Schriftart",
    "settingsSearch.themePresets": "Designvorlagen",
    "settingsSearch.importExportTheme": "Design importieren / exportieren",
    "settingsSearch.timeFormat": "Zeitformat",
    "settingsSearch.dateFormat": "Datumsformat",
    "settingsSearch.showMatrixIds": "Matrix-IDs anzeigen",
    "settingsSearch.readReceiptAvatars": "Avatare für Lesebestätigungen",
    "settingsSearch.linkPreviews": "Linkvorschauen",
    "settingsSearch.linkPreviewMedia": "Medien in Linkvorschauen",
    "settingsSearch.pauseVideosOffScreen":
        "Videos außerhalb des Bildschirms pausieren",
    "settingsSearch.holdToOpenMessageMenu":
        "Gedrückt halten für Nachrichtenmenü",
    "settingsSearch.gifDefaultTab": "Standard-GIF-Tab",
    "settingsSearch.minimiseToTrayOnClose":
        "Beim Schließen in den Infobereich minimieren",
    "settingsSearch.reduceMotion": "Bewegung reduzieren",
    "settingsSearch.keepRoomListOpen": "Raumliste geöffnet lassen",
    "settingsSearch.customEmotes": "Eigene Emotes",
    "settingsSearch.pushNotificationsPermission":
        "Berechtigung für Push-Benachrichtigungen",
    "settingsSearch.notificationSound": "Benachrichtigungston",
    "settingsSearch.desktopAlertsPopUpAndTaskbar":
        "Desktop-Hinweise (Pop-up und Blinken der Taskleiste)",
    "settingsSearch.quietOnMyOtherDevices": "Auf meinen anderen Geräten leise",
    "settingsSearch.privateReadReceipts": "Private Lesebestätigungen",
    "settingsSearch.hideMessageTextInNotifications":
        "Nachrichtentext in Benachrichtigungen ausblenden",
    "settingsSearch.notificationRules": "Benachrichtigungsregeln",
    "settingsSearch.keywordHighlights": "Schlüsselwort-Hervorhebungen",
    "settingsSearch.inputDevice": "Eingabegerät",
    "settingsSearch.outputDevice": "Ausgabegerät",
    "settingsSearch.camera": "Kamera",
    "settingsSearch.noiseSuppression": "Rauschunterdrückung",
    "settingsSearch.echoCancellation": "Echounterdrückung",
    "settingsSearch.autoGainControl": "Automatische Pegelanpassung",
    "settingsSearch.mirrorMyCamera": "Meine Kamera spiegeln",
    "settingsSearch.callVolume": "Anruflautstärke",
    "settingsSearch.playCallSounds": "Anruftöne abspielen",
    "settingsSearch.ringForIncomingDmCalls":
        "Bei Anrufen in Direktnachrichten klingeln",
    "settingsSearch.blockedUsers": "Blockierte Benutzer",
    "settingsSearch.serverCapabilities": "Serverfähigkeiten",
    "settingsSearch.plugins": "Plugins",
    "settingsSearch.pluginRepositories": "Plugin-Repositories",
    "settingsSearch.syncPlugins": "Plugins synchronisieren",
    "settingsSearch.checkForUpdates": "Nach Updates suchen",
    "settingsSearch.clearCache": "Cache leeren",
    "settingsSearch.showAllEvents": "Alle Ereignisse anzeigen",
    "settingsSearch.pushDiagnostics": "Push-Diagnose",
    "settingsSearch.language": "Sprache",

    // src/lib/utils/slashCommands.ts
    "slashCommands.createAPoll": "Umfrage erstellen",
    "slashCommands.shareYourLocation": "Deinen Standort teilen",
    "slashCommands.joinARoomByAddress": "Raum per Adresse beitreten",
    "slashCommands.leaveTheCurrentRoom": "Aktuellen Raum verlassen",
    "slashCommands.inviteAUserToThisRoom": "Benutzer in diesen Raum einladen",
    "slashCommands.setTheRoomTopic": "Thema des Raums festlegen",
    "slashCommands.removeAUserFromThisRoom":
        "Benutzer aus diesem Raum entfernen",
    "slashCommands.userServerReason": "<@user:server> [Grund]",
    "slashCommands.banAUserFromThisRoom": "Benutzer aus diesem Raum bannen",
    "slashCommands.setYourDisplayName": "Deinen Anzeigenamen festlegen",
    "slashCommands.displayName": "<Anzeigename>",
    "slashCommands.setAUserSPowerLevel":
        "Berechtigungsstufe eines Benutzers festlegen",
    "slashCommands.userServerLevel": "<@user:server> [Stufe]",
    "slashCommands.resetAUserSPowerLevel":
        "Berechtigungsstufe eines Benutzers auf Standard zurücksetzen",
    "slashCommands.usage": "Verwendung: /{name} {argHint}",
    "slashCommands.usage2": "Verwendung: /{name}",

    // src/lib/utils/syncStatus.ts
    "syncStatus.connected": "Verbunden",
    "syncStatus.reconnecting": "Verbindung wird wiederhergestellt…",
    "syncStatus.connectionError": "Verbindungsfehler",
    "syncStatus.offline": "Offline",
    "syncStatus.connecting": "Verbinde…",

    // src/lib/utils/themePalette.ts
    "themePalette.accent": "Akzent",
    "themePalette.background": "Hintergrund",
    "themePalette.secondaryBackground": "Sekundärer Hintergrund",
    "themePalette.tertiaryBackground": "Tertiärer Hintergrund",
    "themePalette.primaryText": "Primärer Text",
    "themePalette.secondaryText": "Sekundärer Text",
    "themePalette.mutedText": "Gedämpfter Text",
    "themePalette.danger": "Gefahr",
    "themePalette.positive": "Positiv",
    "themePalette.mentionHighlight": "Hervorhebung von Erwähnungen",
    "themePalette.link": "Link",
    "themePalette.warning": "Warnung",
    "themePalette.onlineStatus": "Status online",
    "themePalette.idleStatus": "Status abwesend",
    "themePalette.doNotDisturbStatus": "Status nicht stören",
    "themePalette.offlineStatus": "Status offline",
    "themePalette.divider": "Trennlinie",
    "themePalette.spoilerBackground": "Spoiler-Hintergrund",
    "themePalette.ownMessageBubble": "Blase eigener Nachrichten",
    "themePalette.primaryTextOnBackground": "Primärer Text auf Hintergrund",
    "themePalette.secondaryTextOnBackground": "Sekundärer Text auf Hintergrund",
    "themePalette.mutedTextOnTertiaryBackground":
        "Gedämpfter Text auf tertiärem Hintergrund",
    "themePalette.whiteTextOnAccentButtons":
        "Weißer Text auf Akzent-Schaltflächen",
    "themePalette.whiteTextOnDangerButtons":
        "Weißer Text auf Gefahr-Schaltflächen",
    "themePalette.whiteTextOnOwnBubble": "Weißer Text auf eigener Blase",

    // src/lib/utils/themePreset.ts
    "themePreset.copy": "{newName} (Kopie)",

    // src/lib/utils/threadList.ts
    "threadList.noPreview": "(keine Vorschau)",

    // src/lib/utils/threePidInvite.ts
    "threePidInvite.youDonTHavePermissionTo":
        "Du hast keine Berechtigung, Personen in diesen Raum einzuladen.",
    "threePidInvite.yourHomeserverHasNoIdentityServer":
        "Dein Heimserver hat keinen Identitätsserver, daher sind E-Mail-Einladungen nicht verfügbar.",

    // src/lib/utils/timeFormat.ts
    "timeFormat.yesterdayAt": "Gestern um {time}",
    "timeFormat.today": "Heute",
    "timeFormat.yesterday": "Gestern",
    "timeFormat.separatorDatePattern": "EEEE, d. MMMM yyyy",
    "timeFormat.monthDayPattern": "d. MMM",
    "timeFormat.compactDateTime": "{date}, {time}",

    // src/lib/utils/updateStatus.ts
    "updateStatus.checkingForUpdates": "Suche nach Updates…",
    "updateStatus.youReOnTheLatestVersion":
        "Du verwendest die neueste Version{versionSuffix}",
    "updateStatus.checkForUpdates": "Nach Updates suchen",
    "updateStatus.updateAvailable": "Update verfügbar{versionSuffix}",
    "updateStatus.downloadInstall": "Herunterladen und installieren",
    "updateStatus.downloadingV": "v{version} wird heruntergeladen",
    "updateStatus.downloadingUpdate": "Update wird heruntergeladen",
    "updateStatus.updateReadyInstall":
        "Update bereit{versionSuffix} - Installieren",
    "updateStatus.install": "Installieren",
    "updateStatus.updateReadyRestartToApply":
        "Update bereit{versionSuffix} - zum Anwenden neu starten",
    "updateStatus.restartToApply": "Zum Anwenden neu starten",
    "updateStatus.aNewVersionIsAvailable":
        "Eine neue Version ist verfügbar{versionSuffix}",
    "updateStatus.openReleasePage": "Versionsseite öffnen",
    "updateStatus.updateCheckFailed": "Updateprüfung fehlgeschlagen",
    "updateStatus.checkForUpdatesToInstallThe":
        "Suche nach Updates, um die neueste Version zu installieren.",

    // src/lib/utils/uploadLimits.ts
    "uploadLimits.mb": "{round} MB",
    "uploadLimits.kb": "{round} KB",
    "uploadLimits.exceedsTheServerSUploadLimit":
        "„{fileName}“ überschreitet das Upload-Limit des Servers ({formatByteLimit})",

    // src/lib/utils/verificationMessage.ts
    "verificationMessage.verificationRequestSent":
        "Verifizierungsanfrage gesendet",
    "verificationMessage.waitingForThemToAccept": "Warte auf Annahme…",
    "verificationMessage.noLongerPending": "Nicht mehr ausstehend",
    "verificationMessage.wantsToVerify": "{senderName} möchte verifizieren",
    "verificationMessage.compareEmojiToConfirmThisIs":
        "Vergleiche Emojis, um zu bestätigen, dass es wirklich diese Person ist",
    "verificationMessage.sentAVerificationRequest":
        "{senderName} hat eine Verifizierungsanfrage gesendet",

    // src/lib/utils/verificationStatus.ts
    "verificationStatus.checkingEncryption": "Verschlüsselung wird geprüft…",
    "verificationStatus.encryptionUnavailable":
        "Verschlüsselung nicht verfügbar",
    "verificationStatus.statusUnavailable": "Status nicht verfügbar",
    "verificationStatus.verified": "Verifiziert",
    "verificationStatus.thisSessionIsVerifiedAndEncryption":
        "Diese Sitzung ist verifiziert und die Verschlüsselung ist vollständig eingerichtet.",
    "verificationStatus.notSetUp": "Nicht eingerichtet",
    "verificationStatus.setUpEncryptionToSecureYour":
        "Richte die Verschlüsselung ein, um deine Nachrichten auf allen Geräten zu schützen.",
    "verificationStatus.setUp": "Einrichten",
    "verificationStatus.encryptionSetupIncomplete":
        "Einrichtung der Verschlüsselung unvollständig",
    "verificationStatus.thisSessionIsVerifiedButEncryption":
        "Diese Sitzung ist verifiziert, aber die Einrichtung der Verschlüsselung ist unvollständig.",
    "verificationStatus.finishSetup": "Einrichtung abschließen",
    "verificationStatus.unverified": "Nicht verifiziert",
    "verificationStatus.thisSessionIsnTVerifiedYet":
        "Diese Sitzung ist noch nicht verifiziert.",

    // src/routes/+layout.svelte
    "rootLayout.linkCopied": "Link kopiert",

    // src/routes/+page.svelte
    "rootPage.failedToReconnectPleaseLogIn":
        "Erneute Verbindung fehlgeschlagen. Bitte melde dich erneut an.",
    "rootPage.signedInButSyncingCouldNot":
        "Angemeldet, aber die Synchronisierung konnte nicht starten. Bitte versuche es erneut.",
    "rootPage.yourSessionHasExpiredPleaseSign":
        "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.",

    // ownStatus
    "ownStatus.profileField": "Profilfeld {key}",
    "ownStatus.theServerStillHas": "Der Server hat noch: {leftovers}",
    "ownStatus.statusClearedButPresenceRemains":
        "Status gelöscht, aber der Server zeigt noch die Anwesenheitsnachricht „{presenceLeft}“. Sie wird wahrscheinlich von einer anderen Sitzung dieses Kontos gesetzt (andere App oder anderer Client) - lösche sie dort oder melde diese Sitzung ab.",

    // MSC2545 sharing, typing indicators, layout heading
    "appearanceSettings.layout": "Layout",
    "privacySafetySettings.sendTypingIndicators": "Schreibanzeige senden",
    "privacySafetySettings.letOthersInARoomSee":
        "Andere Personen in einem Raum sehen, wenn du gerade schreibst. Deaktivieren, um zu schreiben, ohne dass es jemand erfährt.",
    "imagePackEditor.failedToUpdatePack":
        "Paket konnte nicht aktualisiert werden",
    "imagePackEditor.addToMine": "Zu meinen hinzufügen",
    "imagePackEditor.addAllToMyPack":
        "Alle Bilder dieses Pakets in dein eigenes Paket kopieren",
    "imagePackEditor.addImageToMyPack":
        "Dieses Bild in dein eigenes Paket kopieren",
    "imagePackEditor.addedToYourPack":
        "{count, plural, one {# Bild zu deinem Paket hinzugefügt.} other {# Bilder zu deinem Paket hinzugefügt.}}",
    "imagePackEditor.alreadyInYourPack": "Bereits in deinem Paket.",
    "imagePackEditor.editDetails": "Details bearbeiten",
    "imagePackEditor.deletePack": "Paket löschen",
    "imagePackEditor.confirmDeletePack":
        "Das Paket „{name}“ und alle seine Bilder löschen?",
    "imagePackEditor.useInAllRooms": "In allen meinen Räumen verwenden",
    "imagePackEditor.useInAllRoomsHint":
        "Die Emojis und Sticker erscheinen überall, wo du chattest.",
    "imagePackEditor.attribution": "Quelle: {value}",
    "imagePackEditor.attributionPlaceholder": "Quelle / Urheber (optional)",
    "imagePackEditor.uploadPackAvatar": "Paketsymbol hochladen",
    "imagePackEditor.removePackAvatar": "Symbol entfernen",
    "imagePackEditor.avatarReady":
        "Symbol hochgeladen, zum Übernehmen speichern.",
    "sharedPackSettings.yourPackDetails": "Details deines Pakets",
    "sharedPackSettings.enabledEverywhere": "In allen Räumen aktivierte Pakete",
    "sharedPackSettings.enabledEverywhereHint":
        "Pakete aus Räumen, in denen du bist, können in jedem Raum verwendet werden, nicht nur im Raum, dem sie gehören.",
    "sharedPackSettings.availableInYourRooms": "Pakete in deinen Räumen",
    "sharedPackSettings.searchPacks": "Pakete suchen",
    "sharedPackSettings.noPacksFound": "Keine Pakete gefunden",
    "sharedPackSettings.noneEnabled": "Keine Pakete in allen Räumen aktiviert",
    "sharedPackSettings.enable": "Überall verwenden",
    "sharedPackSettings.disable": "Nicht mehr überall verwenden",
    "sharedPackSettings.remove": "Entfernen",
    "sharedPackSettings.unavailable":
        "Nicht verfügbar: du bist nicht mehr in {room} oder das Paket wurde entfernt",
    "sharedPackSettings.packSummary":
        "{room}, {count, plural, one {# Bild} other {# Bilder}}",
    "sharedPackSettings.failedToSave": "Speichern fehlgeschlagen",
};

const catalogue: LocaleCatalogue = { messages, dateLocale: de };

export default catalogue;
