// French (fr). Same keys and placeholders as ../en.ts; typed as a full `Record`
// so a new English string that is not yet translated here fails
// type-checking instead of silently showing English.

import { fr } from "date-fns/locale/fr";
import type { MessageKey } from "../en";
import type { LocaleCatalogue } from "../index";

const messages: Record<MessageKey, string> = {
    // Shared
    "common.turnOffCamera": "Désactiver la caméra",
    "common.turnOnCamera": "Activer la caméra",
    "common.stopSharing": "Arrêter le partage",
    "common.shareYourScreen": "Partager votre écran",
    "common.joining": "Connexion…",
    "common.join": "Rejoindre",
    "common.closeDialog": "Fermer la boîte de dialogue",
    "common.settings": "Paramètres",
    "common.searchResults": "Résultats de recherche",
    "common.default": "Par défaut",
    "common.mute": "Mettre en sourdine",
    "common.saving": "Enregistrement…",
    "common.unblock": "Débloquer",
    "common.block": "Bloquer",
    "common.closeMenu": "Fermer le menu",
    "common.openRoomList": "Ouvrir la liste des salons",
    "common.uploading": "Envoi en cours…",
    "common.uploadImage": "Envoyer une image",
    "common.emoji": "Émoji",
    "common.decline": "Refuser",
    "common.invitePeople": "Inviter des personnes",
    "common.close": "Fermer",
    "common.cancel": "Annuler",
    "common.loading": "Chargement…",
    "common.loadMore": "Charger plus",
    "common.notifications": "Notifications",
    "common.save": "Enregistrer",
    "common.topic": "Sujet",
    "common.videoRoom": "Salon vidéo",
    "common.reasonOptional": "Motif (facultatif)",
    "common.actions": "Actions",
    "common.copy": "Copier",
    "common.remove": "Retirer",
    "common.add": "Ajouter",
    "common.starting": "Démarrage…",
    "common.verify": "Vérifier",
    "common.removeFromFavourites": "Retirer des favoris",
    "common.addToFavourites": "Ajouter aux favoris",
    "common.stickers": "Stickers",
    "common.retry": "Réessayer",
    "common.delete": "Supprimer",
    "common.checking": "Vérification…",
    "common.gifs": "GIF",
    "common.dragOrUseArrowKeysTo":
        "Faites glisser ou utilisez les flèches pour redimensionner",
    "common.resizePicker": "Redimensionner le sélecteur",
    "common.noResults": "Aucun résultat",
    "common.memberCount": "{count, plural, one {# membre} other {# membres}}",
    "common.replyCount": "{count, plural, one {# réponse} other {# réponses}}",

    // src/lib/components/settings/AboutSettings.svelte
    "aboutSettings.automaticUpdates": "Mises à jour automatiques",
    "aboutSettings.version": "Version",
    "aboutSettings.currentVersionV": "Version actuelle v{APP_VERSION}",
    "aboutSettings.checkForUpdates": "Rechercher des mises à jour",
    "aboutSettings.updateAvailable": "Mise à jour disponible",
    "aboutSettings.reloading": "Rechargement…",
    "aboutSettings.update": "Mettre à jour",
    "aboutSettings.reloadToUpdate": "Recharger pour mettre à jour",
    "aboutSettings.youReOnTheLatestVersion":
        "Vous utilisez la dernière version.",
    "aboutSettings.credits": "Crédits",
    "aboutSettings.creditsMidiInstruments": "Instruments MIDI",
    "aboutSettings.creditsSoundFont":
        "par {author}, d'après Phoenix de {original}. Sous licence CC BY ; adapté au General MIDI et compressé pour Zam.",
    "aboutSettings.troubleshooting": "Dépannage",
    "aboutSettings.clearCacheAndResync": "Vider le cache et resynchroniser",
    "aboutSettings.reDownloadsYourRoomsFromThe":
        "Retélécharge vos salons depuis le serveur. Corrige les salons manquants ou bloqués. Vous restez connecté.",
    "aboutSettings.resyncing": "Resynchronisation…",
    "aboutSettings.clearCache": "Vider le cache",
    "aboutSettings.updateCheckFailed": "Échec de la recherche de mises à jour",
    "aboutSettings.downloadFailed": "Échec du téléchargement",
    "aboutSettings.installFailed": "Échec de l'installation",
    "aboutSettings.failedToCheckForUpdates":
        "Impossible de rechercher des mises à jour.",
    "aboutSettings.sourceCodeOnGitHub": "Code source sur GitHub",

    // src/lib/components/settings/AccountSettings.svelte
    "accountSettings.profile": "Profil",
    "accountSettings.yourAvatar": "Votre avatar",
    "accountSettings.changeAvatar": "Changer d'avatar",
    "accountSettings.yourDisplayName": "Votre nom d'affichage",
    "accountSettings.saved": "Enregistré",
    "accountSettings.account": "Compte",
    "accountSettings.userId": "Identifiant utilisateur",
    "accountSettings.homeserver": "Serveur d'accueil",
    "accountSettings.connection": "Connexion",
    "accountSettings.presence": "Présence",
    "accountSettings.password": "Mot de passe",
    "accountSettings.currentPassword": "Mot de passe actuel",
    "accountSettings.newPassword": "Nouveau mot de passe",
    "accountSettings.confirmNewPassword": "Confirmer le nouveau mot de passe",
    "accountSettings.signOutAllOtherSessions":
        "Déconnecter toutes les autres sessions",
    "accountSettings.changing": "Modification…",
    "accountSettings.changePassword": "Changer le mot de passe",
    "accountSettings.passwordChanged": "Mot de passe modifié.",
    "accountSettings.thisServerDoesNotAllowChanging":
        "Ce serveur ne permet pas de changer votre mot de passe depuis cette application.",
    "accountSettings.managedByProvider":
        "Votre mot de passe, vos sessions et votre compte sont gérés sur la page de compte de votre fournisseur de connexion.",
    "accountSettings.manageAccount": "Gérer le compte",
    "accountSettings.emailPhoneNumbers": "E-mail et numéros de téléphone",
    "accountSettings.noEmailAddressesOrPhoneNumbers":
        "Aucune adresse e-mail ni aucun numéro de téléphone n'est associé à ce compte.",
    "accountSettings.email": "E-mail",
    "accountSettings.phone": "Téléphone",
    "accountSettings.thisServerDoesNotAllowManaging":
        "Ce serveur ne permet pas de les gérer depuis cette application.",
    "accountSettings.logOut": "Se déconnecter",
    "accountSettings.dangerZone": "Zone de danger",
    "accountSettings.deactivateAccount": "Désactiver le compte…",
    "accountSettings.deactivationIsPermanentAndCannotBe":
        "La désactivation est définitive et ne peut pas être annulée.",
    "accountSettings.eraseMessagesWherePossible":
        "Effacer les messages si possible",
    "accountSettings.deactivating": "Désactivation…",
    "accountSettings.deactivateAccount2": "Désactiver le compte",
    "accountSettings.avatarUploadFailed": "Échec de l'envoi de l'avatar",
    "accountSettings.failedToRemoveAvatar": "Impossible de retirer l'avatar",
    "accountSettings.failedToSaveName": "Impossible d'enregistrer le nom",
    "accountSettings.couldNotSetPresence": "Impossible de définir la présence",
    "accountSettings.failedToChangePassword":
        "Impossible de changer le mot de passe",
    "accountSettings.failedToDeactivateAccount":
        "Impossible de désactiver le compte",

    // src/lib/components/layout/AccountSwitcher.svelte
    "accountSwitcher.signOut": "Déconnecter {userId}",
    "accountSwitcher.confirm": "Confirmer",
    "accountSwitcher.signOut2": "Se déconnecter",
    "accountSwitcher.addAccount": "Ajouter un compte",
    "accountSwitcher.accountMenu": "Menu du compte",
    "accountSwitcher.closeAccountMenu": "Fermer le menu du compte",
    "accountSwitcher.back": "Retour",
    "accountSwitcher.setYourStatus": "Définir votre statut",
    "accountSwitcher.setAStatus": "Définir un statut",
    "accountSwitcher.editProfile": "Modifier le profil",
    "accountSwitcher.switchAccounts": "Changer de compte",
    "accountSwitcher.couldNotSetPresence": "Impossible de définir la présence",

    // src/lib/components/layout/ActiveCallBanner.svelte
    "activeCallBanner.openCall": "Ouvrir l'appel",
    "activeCallBanner.ringing": "Sonnerie…",
    "activeCallBanner.voiceCallInCall": "Appel vocal · {length} dans l'appel",
    "activeCallBanner.leave": "Quitter",

    // src/lib/components/settings/AppearanceSettings.svelte
    "appearanceSettings.rightAlignMyMessagesBubbleLayout":
        "Aligner mes messages à droite (bulles)",
    "appearanceSettings.displayYourOwnMessagesOnThe":
        "Afficher vos propres messages à droite dans une bulle colorée",
    "appearanceSettings.showNameColours": "Afficher les couleurs des noms",
    "appearanceSettings.drawPeopleSNamesInThe":
        "Afficher les noms dans la couleur choisie dans chaque profil. Désactivez pour utiliser la couleur de texte normale pour tout le monde.",
    "appearanceSettings.keepRoomListOpen": "Garder la liste des salons ouverte",
    "appearanceSettings.donTAutoCloseTheRoom":
        "Ne pas fermer automatiquement la liste des salons en passant d'un espace à l'autre ou à l'Accueil. Ouvrir un salon ou un message direct la ferme toujours.",
    "appearanceSettings.timestamps": "Horodatage",
    "appearanceSettings.timeFormat": "Format de l'heure",
    "appearanceSettings.dateFormat": "Format de la date",
    "appearanceSettings.customDatePattern": "Format de date personnalisé",
    "appearanceSettings.yyyyMmDd": "yyyy-MM-dd",
    "appearanceSettings.preview": "Aperçu :",
    "appearanceSettings.dateFnsTokensEGYyyy":
        "· jetons date-fns, par ex. yyyy-MM-dd",
    "appearanceSettings.invalidFormatUseLowercaseDateFns":
        "Format invalide - utilisez des jetons date-fns en minuscules comme yyyy-MM-dd.",
    "appearanceSettings.alwaysShowAbsoluteDates":
        "Toujours afficher les dates complètes",
    "appearanceSettings.replaceTodayAndYesterdayWithThe":
        "Remplacer « Aujourd'hui » et « Hier » par la date complète partout.",
    "appearanceSettings.reduceMotion": "Réduire les animations",
    "appearanceSettings.minimizeAnimationsAndTransitionsYourDevice":
        "Réduire les animations et les transitions. Le réglage « réduire les animations » de votre appareil est toujours respecté.",
    "appearanceSettings.custom": "Personnalisé",
    "appearanceSettings.12Hour": "12 heures",
    "appearanceSettings.24Hour": "24 heures",
    "appearanceSettings.language": "Langue",
    "appearanceSettings.displayLanguage": "Langue d'affichage",
    "appearanceSettings.displayLanguageHint":
        "La langue des menus et boutons de Zam. La modifier recharge l'application.",

    // src/routes/app/+page.svelte
    "appPage.redirecting": "Redirection…",

    // src/lib/components/layout/AppSettings.svelte
    "appSettings.backToSettings": "Retour aux paramètres",
    "appSettings.closeSettings": "Fermer les paramètres",
    "appSettings.searchSettings": "Rechercher dans les paramètres…",
    "appSettings.searchSettings2": "Rechercher dans les paramètres",
    "appSettings.noSettingsMatch": "Aucun paramètre ne correspond",
    "appSettings.noSettingsMatch2":
        "Aucun paramètre ne correspond à « {searchQuery} ».",
    "appSettings.resultCount":
        "{count, plural, one {# résultat} other {# résultats}}",

    // src/lib/components/layout/AppShell.svelte
    "appShell.zam": "({notificationCount}) Zam",
    "appShell.redirecting": "Redirection…",
    "appShell.noRoomsYet": "Aucun salon pour l'instant",
    "appShell.resizeRoomList": "Redimensionner la liste des salons",
    "appShell.createARoomOrStartA":
        "Créez un salon ou démarrez une conversation privée pour commencer.",
    "appShell.nothingInHome": "Rien dans l'Accueil",
    "appShell.allOfYourRoomsLiveIn":
        "Tous vos salons se trouvent dans des espaces - ouvrez-en un pour les voir. Les salons et messages directs hors espace apparaissent ici.",
    "appShell.openRoomList": "Ouvrir la liste des salons",
    "appShell.someone": "Quelqu'un",
    "appShell.isCalling": "{name} vous appelle",
    "appShell.incomingCall": "Appel entrant",
    "appShell.offlineMessageStorageIsUnavailableThis":
        "Le stockage hors ligne des messages est indisponible pour cette session : l'historique ne sera pas conservé pour la prochaine fois.",
    "appShell.couldnTSendYourReplyIt":
        "Impossible d'envoyer votre réponse. Elle a été enregistrée comme brouillon.",
    "appShell.yourNotificationReplyWasSavedAs":
        "Votre réponse depuis la notification a été enregistrée comme brouillon",

    // src/lib/components/settings/BlockedUsersSettings.svelte
    "blockedUsersSettings.messagesFromBlockedUsersAreHidden":
        "Les messages des utilisateurs bloqués sont masqués dans tous les salons. La liste est stockée sur votre compte et s'applique à toutes vos sessions.",
    "blockedUsersSettings.youHavenTBlockedAnyone":
        "Vous n'avez bloqué personne.",
    "blockedUsersSettings.failed": "Échec",

    // src/lib/components/layout/CallParticipantMenu.svelte
    "callParticipantMenu.profile": "Profil",
    "callParticipantMenu.input": "Entrée",
    "callParticipantMenu.output": "Sortie",
    "callParticipantMenu.opening": "Ouverture…",
    "callParticipantMenu.message": "Message",
    "callParticipantMenu.mention": "Mentionner",
    "callParticipantMenu.userVolume": "Volume de l'utilisateur",
    "callParticipantMenu.hideVideo": "Masquer la vidéo",
    "callParticipantMenu.kicking": "Expulsion…",
    "callParticipantMenu.confirmKick": "Confirmer l'expulsion de {name} ?",
    "callParticipantMenu.kickFromRoom": "Expulser {name} du salon",
    "callParticipantMenu.banning": "Bannissement…",
    "callParticipantMenu.confirmBan": "Confirmer le bannissement de {name} ?",
    "callParticipantMenu.ban": "Bannir {name}",
    "callParticipantMenu.couldNotOpenADirectMessage":
        "Impossible d'ouvrir un message direct",
    "callParticipantMenu.couldNotKick": "Impossible d'expulser {name}",
    "callParticipantMenu.couldNotBan": "Impossible de bannir {name}",

    // src/lib/components/layout/CallView.svelte
    "callView.ringing": "Sonnerie…",
    "callView.showChat": "Afficher la discussion",
    "callView.noOneIsInThisCall": "Personne n'est dans cet appel",
    "callView.backToGrid": "Retour à la grille",
    "callView.screenShareQuality": "Qualité du partage d'écran",
    "callView.optionsFor": "Options pour {name}",
    "callView.muted": "Micro coupé",
    "callView.deafened": "Son coupé",
    "callView.mutedForYou": "Rendu muet pour vous",
    "callView.joinedFromMultipleDevices": "Connecté depuis plusieurs appareils",
    "callView.devices": "{value} appareils",
    "callView.enableAudio": "Activer l'audio",
    "callView.onHold": "En attente pendant un autre appel",
    "callView.resume": "Reprendre",
    "callView.speakerOn": "Utiliser le haut-parleur",
    "callView.speakerOff": "Désactiver le haut-parleur",
    "callView.unmute": "Réactiver le micro",
    "callView.undeafen": "Réactiver le son",
    "callView.deafen": "Couper le son",
    "callView.disconnect": "Se déconnecter",
    "callView.joinCall": "Rejoindre l'appel",
    "callView.you": "Vous",
    "callView.sScreen": "Écran de {name}",
    "callView.exitSpotlightFor": "Quitter la mise en avant de {label}",
    "callView.spotlight": "Mettre en avant {label}",

    // src/lib/components/messages/CreatePollDialog.svelte
    "createPollDialog.createPoll": "Créer un sondage",
    "createPollDialog.question": "Question",
    "createPollDialog.askSomething": "Posez une question…",
    "createPollDialog.options": "Options",
    "createPollDialog.option": "Option {value}",
    "createPollDialog.removeOption": "Retirer l'option",
    "createPollDialog.addOption": "+ Ajouter une option",
    "createPollDialog.results": "Résultats",
    "createPollDialog.showAsPeopleVote": "Afficher au fil des votes",
    "createPollDialog.hideUntilClosed": "Masquer jusqu'à la clôture",
    "createPollDialog.allowSelectingMultipleOptions":
        "Autoriser plusieurs choix",
    "createPollDialog.creating": "Création…",
    "createPollDialog.failedToCreatePoll": "Impossible de créer le sondage",

    // src/lib/components/layout/CryptoUnavailableBanner.svelte
    "cryptoUnavailableBanner.encryptionIsUnavailableThisSessionEncrypted":
        "Le chiffrement est indisponible pour cette session : les messages chiffrés ne peuvent être ni lus ni envoyés. Rechargez pour réessayer.",
    "cryptoUnavailableBanner.reload": "Recharger",
    "cryptoUnavailableBanner.dismissEncryptionWarning":
        "Ignorer l'avertissement de chiffrement",

    // src/lib/components/settings/CustomPackSettings.svelte
    "customPackSettings.add": "Ajouter : {singular}",
    "customPackSettings.shortcode": "code court",
    "customPackSettings.sticker": "Sticker",
    "customPackSettings.remove": "Retirer : {toLowerCase}",
    "customPackSettings.image": "Image",
    "customPackSettings.chooseAtLeastOneUsage": "Choisissez au moins un usage.",
    "customPackSettings.uploadFailed": "Échec de l'envoi",
    "customPackSettings.failedToRemove": "Impossible de retirer : {singular}",
    "customPackSettings.failedToUpdateUsage":
        "Impossible de mettre à jour l'usage",
    "customPackSettings.noCustomImages": "Aucune image personnalisée",
    "customPackSettings.noCustomEmojis": "Aucun émoji personnalisé",
    "customPackSettings.noCustomStickers": "Aucun sticker personnalisé",

    // src/lib/components/debug/DebugEventItem.svelte
    "debugEventItem.stateKey": "state_key",
    "debugEventItem.empty": "(vide)",
    "debugEventItem.redacted": "SUPPRIMÉ",
    "debugEventItem.id": "id : {eventId}",

    // src/lib/components/debug/DebugPanel.svelte
    "debugPanel.debugPanel": "PANNEAU DE DÉBOGAGE",
    "debugPanel.sync": "Synchro :",
    "debugPanel.refresh": "↻ actualiser",
    "debugPanel.copied": "✓ copié",
    "debugPanel.copy": "⧉ copier",
    "debugPanel.unreadState": "ÉTAT NON LU",
    "debugPanel.unread": "non lus :",
    "debugPanel.highlight": "surlignés :",
    "debugPanel.userid": "userId :",
    "debugPanel.readuptoid": "readUpToId :",
    "debugPanel.readidxInTimeline": "readIdx dans le fil :",
    "debugPanel.noReceipt": "aucun accusé",
    "debugPanel.n1NotInWindow": "-1 (hors de la fenêtre !)",
    "debugPanel.events": "/ {totalEvents} événements",
    "debugPanel.lastEventSender": "expéditeur du dernier événement :",
    "debugPanel.me": "(moi :",
    "debugPanel.notificationEventsAfterReadMarker":
        "événements notifiants après le marqueur de lecture :",
    "debugPanel.from": "[{formatTs}] {getType} de {value} - {msgPreview}",
    "debugPanel.pushRules": "RÈGLES PUSH",
    "debugPanel.default": "(par défaut)",
    "debugPanel.actions": "actions : {stringify}",
    "debugPanel.conditions": "conditions : {stringify}",
    "debugPanel.noPushRulesFound": "aucune règle push trouvée",
    "debugPanel.readReceiptsEventsWithReceipts":
        "ACCUSÉS DE LECTURE ({length} événements avec accusés)",
    "debugPanel.noReceipts": "aucun accusé",
    "debugPanel.urlPreviewInspector": "INSPECTEUR D'APERÇU D'URL",
    "debugPanel.https": "https://...",
    "debugPanel.storeMessagesWhatTheUiRenders":
        "MESSAGES DU STORE ({length}) - ce qu'affiche l'interface",
    "debugPanel.redacted": "SUPPRIMÉ",
    "debugPanel.rel": "rel={relType}",
    "debugPanel.empty": "vide",
    "debugPanel.pendingEvents": "ÉVÉNEMENTS EN ATTENTE ({length})",
    "debugPanel.rawTimelineEvents": "FIL BRUT ({length} événements)",

    // src/lib/components/settings/DebugSettings.svelte
    "debugSettings.developer": "Développeur",
    "debugSettings.showAllEvents": "Afficher tous les événements",
    "debugSettings.displayEveryMatrixTimelineEventIn":
        "Afficher chaque événement Matrix du fil dans la discussion.",
    "debugSettings.syncStatus": "État de la synchronisation",
    "debugSettings.syncLog": "Journal de synchronisation",
    "debugSettings.syncLogEmpty":
        "Rien n'est encore journalisé. Les redémarrages, les requêtes échouées et les réinitialisations de fil apparaissent ici.",
    "debugSettings.refresh": "Actualiser",
    "debugSettings.copied": "Copié",
    "debugSettings.useSlidingSync": "Utiliser la synchronisation glissante",
    "debugSettings.experimentalLoadsRoomsInAGrowing":
        "Expérimental. Charge les salons dans une fenêtre croissante. Recharge l'application pour s'appliquer.",
    "debugSettings.pushStatus": "État des notifications push",
    "debugSettings.lastError": "Dernière erreur : {lastError}",
    "debugSettings.runDiagnostics": "Lancer le diagnostic",
    "debugSettings.homeserverPushers": "Pushers du serveur d'accueil",
    "debugSettings.theHomeserverHasNoPushersRegistered":
        "Le serveur d'accueil n'a aucun pusher enregistré pour ce compte.",
    "debugSettings.aPusherMatchesTheConfiguredGateway":
        "Un pusher correspond à l'URL de passerelle configurée.",
    "debugSettings.noPusherMatchesTheConfiguredGateway":
        "Aucun pusher ne correspond à l'URL de passerelle configurée.",
    "debugSettings.appId": "app_id : {app_id}",
    "debugSettings.none": "(aucun)",
    "debugSettings.url": "url : {value}",
    "debugSettings.pushkey": "pushkey : {pushkeyPreview}",
    "debugSettings.webPushPwa": "Web Push (PWA)",
    "debugSettings.missing": "(manquant)",
    "debugSettings.vapidKey": "Clé VAPID : {value}",
    "debugSettings.permission": "autorisation : {permission}",
    "debugSettings.subscription": "abonnement : {value}",
    "debugSettings.notFound": "introuvable",
    "debugSettings.homeserverPusher": "pusher du serveur d'accueil : {value}",
    "debugSettings.error": "erreur : {error}",
    "debugSettings.gatewaySygnalFirebase": "Passerelle (Sygnal / Firebase)",
    "debugSettings.gatewayReachable": "Passerelle joignable",
    "debugSettings.gatewayNotReachable": "Passerelle injoignable",
    "debugSettings.nativeSessionPushEnrichment":
        "Session native (enrichissement des notifications)",
    "debugSettings.homeserver": "serveur d'accueil : {value}",
    "debugSettings.user": "utilisateur : {value}",
    "debugSettings.device": "appareil : {value}",
    "debugSettings.accessToken": "jeton d'accès : {value}",
    "debugSettings.hideMessageText": "masquer le texte des messages : {value}",
    "debugSettings.notificationRulesServer": "Règles de notification (serveur)",
    "debugSettings.syncMode": "Mode de synchronisation",
    "debugSettings.slidingSyncMsc4186": "Synchronisation glissante (MSC4186)",
    "debugSettings.classicSyncV2": "/sync classique (v2)",
    "debugSettings.syncState": "État de la synchronisation",
    "debugSettings.fallback": "Repli",
    "debugSettings.slidingSyncEndpoint":
        "Point d'accès de la synchronisation glissante",
    "debugSettings.joinedRoomsLoaded": "Salons rejoints chargés",
    "debugSettings.roomListWindow": "Fenêtre de la liste des salons",
    "debugSettings.of": "{requested} sur {total}",
    "debugSettings.platform": "Plateforme",
    "debugSettings.nativeCapacitor": "Native (Capacitor)",
    "debugSettings.pushEnabledInBuild": "Push activé dans la version",
    "debugSettings.yes": "Oui",
    "debugSettings.no": "Non",
    "debugSettings.gatewayUrl": "URL de la passerelle",
    "debugSettings.appId2": "ID de l'application",
    "debugSettings.notificationPermission": "Autorisation des notifications",
    "debugSettings.fcmToken": "Jeton FCM",
    "debugSettings.pushProvider": "Fournisseur push",
    "debugSettings.unifiedPushDistributor": "Distributeur UnifiedPush",
    "debugSettings.unifiedPushEndpoint": "Point de terminaison UnifiedPush",
    "debugSettings.unifiedPushGateway": "Passerelle UnifiedPush",
    "debugSettings.pusherRegisteredThisSession":
        "Pusher enregistré dans cette session",
    "debugSettings.failedToFetchPushersFromHomeserver":
        "Impossible de récupérer les pushers du serveur d'accueil.",
    "debugSettings.set": "défini",
    "debugSettings.active": "actif",
    "debugSettings.allNotificationsMasterRule":
        "Toutes les notifications (règle principale)",

    // src/lib/components/ui/EmojiPicker.svelte
    "emojiPicker.searchEmoji": "Rechercher un émoji…",
    "emojiPicker.searchEmoji2": "Rechercher un émoji",
    "emojiPicker.myEmojis": "Mes émojis",
    "emojiPicker.custom": "Personnalisés",
    "emojiPicker.standard": "Standard",
    "emojiPicker.myEmojis2": "Mes émojis",

    // src/lib/components/ui/ErrorToasts.svelte
    "errorToasts.dismiss": "Ignorer",

    // src/lib/components/settings/ExtendedProfileDebug.svelte
    "extendedProfileDebug.extendedProfile": "Profil étendu",
    "extendedProfileDebug.fetchFromServer": "Récupérer depuis le serveur",
    "extendedProfileDebug.thisServerDoesNotSupportExtended":
        "Ce serveur ne prend pas en charge les profils étendus.",
    "extendedProfileDebug.noneOrTheServerRefused":
        "aucun, ou le serveur a refusé",
    "extendedProfileDebug.presenceGetPresenceStraightFromThe":
        "Présence (GET /presence, directement depuis le serveur) : {value}",
    "extendedProfileDebug.notAdvertisedNoRestrictions":
        "non annoncé (aucune restriction)",
    "extendedProfileDebug.serverRulesForFieldsMProfile":
        "Règles du serveur pour les champs (m.profile_fields) : {value}",
    "extendedProfileDebug.failedToFetchTheProfile":
        "Impossible de récupérer le profil",
    "extendedProfileDebug.couldNotCopyToClipboard":
        "Impossible de copier dans le presse-papiers",

    // src/lib/components/ui/FlashEmbed.svelte
    "flashEmbed.suspend": "Suspendre",

    // src/lib/components/messages/ForwardMessageDialog.svelte
    "forwardMessageDialog.forwardMessage": "Transférer le message",
    "forwardMessageDialog.searchRooms": "Rechercher des salons",
    "forwardMessageDialog.noJoinedRoomsFound": "Aucun salon rejoint trouvé",
    "forwardMessageDialog.forwarding": "Transfert…",
    "forwardMessageDialog.forward": "Transférer",
    "forwardMessageDialog.failedToForwardMessage":
        "Impossible de transférer le message",

    // src/lib/components/settings/GeneralSettings.svelte
    "generalSettings.desktop": "Bureau",
    "generalSettings.minimiseToTrayOnClose":
        "Réduire dans la zone de notification à la fermeture",
    "generalSettings.keepZamRunningInTheSystem":
        "Garder Zam actif dans la zone de notification quand vous fermez la fenêtre, au lieu de quitter. Utilisez l'icône pour rouvrir ou quitter.",
    "generalSettings.noGeneralSettingsAreAvailableOn":
        "Aucun paramètre général n'est disponible sur cette plateforme.",

    // src/lib/components/ui/GifPicker.svelte
    "gifPicker.searchFavourites": "Rechercher dans les favoris…",
    "gifPicker.searchKlipy": "Rechercher sur KLIPY…",
    "gifPicker.searchFavourites2": "Rechercher dans les favoris",
    "gifPicker.searchGifs": "Rechercher des GIF",
    "gifPicker.gifResults": "Résultats GIF",
    "gifPicker.noFavouriteGifsYetStarA":
        "Aucun GIF favori pour l'instant. Ajoutez une étoile à un GIF pour l'enregistrer ici.",
    "gifPicker.favourites": "Favoris",
    "gifPicker.gifTagged": "GIF avec les tags {join}",
    "gifPicker.favouriteGif": "GIF favori {value}",
    "gifPicker.editTags": "Modifier les tags",
    "gifPicker.catFunny": "chat, drôle",
    "gifPicker.commaSeparatedEnterToSave":
        "Séparés par des virgules · Entrée pour enregistrer",
    "gifPicker.trending": "Tendances",
    "gifPicker.gifResult": "Résultat GIF {value}",
    "gifPicker.favourite": "Favori",
    "gifPicker.poweredByKlipy": "Propulsé par KLIPY",

    // src/lib/components/layout/ImagePackEditor.svelte
    "imagePackEditor.addImage": "Ajouter une image",
    "imagePackEditor.newPack": "Nouveau pack",
    "imagePackEditor.packName": "Nom du pack",
    "imagePackEditor.shortcode": "code court",
    "imagePackEditor.useAsEmoji": "Utiliser comme émoji",
    "imagePackEditor.useAsSticker": "Utiliser comme sticker",
    "imagePackEditor.inheritedFrom": "Hérité de {sourceName}",
    "imagePackEditor.sticker": "Sticker",
    "imagePackEditor.removeImage": "Retirer l'image",
    "imagePackEditor.noCustomImages": "Aucune image personnalisée",
    "imagePackEditor.emotes": "Émotes de {value}",
    "imagePackEditor.room": "Salon",
    "imagePackEditor.chooseAtLeastOneUsage": "Choisissez au moins un usage.",
    "imagePackEditor.enterAPackName": "Saisissez un nom de pack.",
    "imagePackEditor.uploadFailed": "Échec de l'envoi",
    "imagePackEditor.failedToUpdateUsage":
        "Impossible de mettre à jour l'usage",
    "imagePackEditor.failedToRemoveImage": "Impossible de retirer l'image",

    // src/lib/components/layout/InboxPanel.svelte
    "inboxPanel.inbox": "Boîte de réception",
    "inboxPanel.noPendingInvites": "Aucune invitation en attente",
    "inboxPanel.roomInvitesWillAppearHere":
        "Les invitations aux salons apparaîtront ici.",
    "inboxPanel.pendingInvites": "Invitations en attente : {length}",
    "inboxPanel.invitedBy": "Invité par {sender}",
    "inboxPanel.ignore": "Ignorer",
    "inboxPanel.accept": "Accepter",
    "inboxPanel.pendingJoinRequests": "Demandes d'accès en attente : {length}",
    "inboxPanel.youAskedToJoinWaitingFor":
        "Vous avez demandé à rejoindre - en attente que quelqu'un vous accepte.",
    "inboxPanel.cancelRequest": "Annuler la demande",
    "inboxPanel.failedToAcceptInvite": "Impossible d'accepter l'invitation",
    "inboxPanel.failedToRejectInvite": "Impossible de refuser l'invitation",
    "inboxPanel.failedToCancelJoinRequest":
        "Impossible d'annuler la demande d'accès",

    // src/lib/components/layout/IncomingCallCard.svelte
    "incomingCallCard.incomingCall": "Appel entrant",
    "incomingCallCard.declineCallFrom": "Refuser l'appel de {name}",
    "incomingCallCard.accept": "Accepter",
    "incomingCallCard.acceptCallFrom": "Accepter l'appel de {name}",
    "incomingCallCard.unknown": "Inconnu",

    // src/lib/components/layout/InvitePanel.svelte
    "invitePanel.invitePeopleTo": "Inviter des personnes dans",
    "invitePanel.invited": "Invité",
    "invitePanel.failed": "Échec",
    "invitePanel.inviteByEmail": "Inviter par e-mail",
    "invitePanel.nameExampleCom": "nom@exemple.fr",
    "invitePanel.inviting": "Invitation…",
    "invitePanel.invite": "Inviter",
    "invitePanel.invite2": "Inviter {length}",
    "invitePanel.enterAValidEmailAddress":
        "Saisissez une adresse e-mail valide.",
    "invitePanel.couldNotSendTheEmailInvite":
        "Impossible d'envoyer l'invitation par e-mail",
    "invitePanel.couldNotSendTheInvite": "Impossible d'envoyer l'invitation",
    "invitePanel.thisRoom": "ce salon",
    "invitePanel.thisSpace": "cet espace",

    // src/lib/components/layout/JoinConsentDialog.svelte
    "joinConsentDialog.joinThisRoom": "Rejoindre ce salon ?",
    "joinConsentDialog.youClickedALinkTo": "Vous avez cliqué sur un lien vers",
    "joinConsentDialog.joiningSharesYourMatrixIdWith":
        ". Le rejoindre partage votre identifiant Matrix avec tous les membres du salon et l'ajoute à votre liste de salons.",
    "joinConsentDialog.thisOpensRoom": "Ceci ouvre le salon",
    "joinConsentDialog.warningThisLinkPointsAtA":
        "Attention : ce lien pointe vers un autre serveur que celui du salon visé. Ne continuez que si vous faites confiance à l'expéditeur.",
    "joinConsentDialog.joinRoom": "Rejoindre le salon",

    // src/lib/components/ui/Lightbox.svelte
    "lightbox.closeViewer": "Fermer la visionneuse ({mediaNoun})",
    "lightbox.viewer": "Visionneuse ({MediaNoun}){value}",
    "lightbox.download": "Télécharger",
    "lightbox.previous": "Précédent",
    "lightbox.previous2": "Précédent ({mediaNoun})",
    "lightbox.next": "Suivant",
    "lightbox.next2": "Suivant ({mediaNoun})",
    "lightbox.couldNotLoadThisVideoUse":
        "Impossible de charger cette vidéo. Utilisez Télécharger pour l'enregistrer.",
    "lightbox.video": "Vidéo",
    "lightbox.image": "Image",
    "lightbox.videoNoun": "vidéo",
    "lightbox.imageNoun": "image",

    // src/lib/components/messages/LinkPreview.svelte
    "linkPreview.youtubeVideo": "Vidéo YouTube",
    "linkPreview.xTwitter": "X / Twitter",
    "linkPreview.loadingItContactsTheSiteHosting":
        "Le charger contacte le site qui l'héberge, ce qui révèle votre adresse IP",
    "linkPreview.loadPreviewMedia": "Charger le média de l'aperçu",
    "linkPreview.playVideo": "Lire la vidéo",

    // src/lib/components/layout/LiveLocationBanner.svelte
    "liveLocationBanner.openMap": "Ouvrir la carte",
    "liveLocationBanner.sharingLiveLocation":
        "Partage de la position en direct",
    "liveLocationBanner.lastUpdatedAt":
        " · mise à jour à {timeOnly} ({updatedAgoLabel})",
    "liveLocationBanner.map": "Carte",
    "liveLocationBanner.isSharingLiveLocation":
        "{getMemberName} partage sa position en direct",
    "liveLocationBanner.peopleSharingLiveLocation":
        "{length} personnes partagent leur position en direct",
    "liveLocationBanner.viewMap": "Voir la carte",

    // src/lib/components/layout/LiveLocationMapView.svelte
    "liveLocationMapView.back": "Retour",
    "liveLocationMapView.liveLocation": "Position en direct",
    "liveLocationMapView.recenter": "Recentrer",
    "liveLocationMapView.waitingForALocationFix": "En attente d'une position…",
    "liveLocationMapView.sharingLiveLocation":
        "Partage de la position en direct",
    "liveLocationMapView.lastUpdatedAt":
        "mise à jour à {timeOnly} ({updatedAgoLabel})",
    "liveLocationMapView.osm": "OSM",
    "liveLocationMapView.noActiveLiveSharesInThis":
        "Aucun partage de position actif dans ce salon.",
    "liveLocationMapView.you": "Vous",

    // src/lib/components/messages/LocationBody.svelte
    "locationBody.openstreetmap": "OpenStreetMap",
    "locationBody.googleMaps": "Google Maps",

    // src/lib/components/layout/LoginView.svelte
    "loginView.signIn": "Connexion",
    "loginView.register": "Inscription",
    "loginView.zam": "Zam - {value}",
    "loginView.addAnAccount": "Ajouter un compte",
    "loginView.welcomeBack": "Bon retour !",
    "loginView.signInWithAnotherMatrixAccount":
        "Se connecter avec un autre compte Matrix",
    "loginView.signInToYourMatrixAccount":
        "Connectez-vous à votre compte Matrix",
    "loginView.createAnAccount": "Créer un compte",
    "loginView.registerOnAMatrixHomeserver":
        "S'inscrire sur un serveur d'accueil Matrix",
    "loginView.homeserver": "Serveur d'accueil",
    "loginView.username": "Nom d'utilisateur",
    "loginView.password": "Mot de passe",
    "loginView.registrationToken": "Jeton d'inscription",
    "loginView.ifRequired": "(si nécessaire)",
    "loginView.leaveBlankIfNotRequired": "Laisser vide si non nécessaire",
    "loginView.useSlidingSync": "Utiliser la synchronisation glissante",
    "loginView.fasterStartupOnServersThatSupport":
        "Démarrage plus rapide sur les serveurs compatibles.",
    "loginView.pleaseWait": "Veuillez patienter…",
    "loginView.logIn": "Se connecter",
    "loginView.createAccount": "Créer le compte",
    "loginView.donTHaveAnAccount": "Pas encore de compte ?",
    "loginView.alreadyHaveAnAccount": "Vous avez déjà un compte ?",
    "loginView.signIn2": "Se connecter",
    "loginView.backTo": "← Retour à {activeUserId}",
    "loginView.orContinueAs": "Ou continuer en tant que",
    "loginView.yourCredentialsAreSentDirectlyTo":
        "Vos identifiants sont envoyés directement à votre serveur d'accueil et ne sont jamais stockés par cette application ailleurs que sur votre appareil.",
    "loginView.loggingIn": "Connexion…",
    "loginView.loginFailedCheckYourCredentials":
        "Échec de la connexion. Vérifiez vos identifiants.",
    "loginView.creatingAccount": "Création du compte…",
    "loginView.registrationFailed": "Échec de l'inscription.",
    "loginView.or": "ou",
    "loginView.continueWithSso": "Continuer avec le SSO",
    "loginView.continueWith": "Continuer avec {name}",
    "loginView.redirectingToSso":
        "Redirection vers votre fournisseur de connexion…",
    "loginView.finishSsoInBrowser":
        "Terminez la connexion dans votre navigateur, puis revenez ici.",
    "loginView.ssoCouldNotBeVerified":
        "L'authentification unique n'a pas pu être vérifiée. Veuillez réessayer.",
    "loginView.ssoFailed": "Échec de l'authentification unique.",
    "loginView.continue": "Continuer",
    "loginView.signInOnProviderPage":
        "Vous vous connecterez sur la page de votre serveur d'accueil, puis vous reviendrez ici.",
    "loginView.oauthCancelled": "La connexion a été annulée.",
    "loginView.oauthDenied":
        "Le fournisseur de connexion a refusé la demande : {reason}",
    "loginView.oauthCouldNotBeVerified":
        "La connexion n'a pas pu être vérifiée. Veuillez réessayer.",
    "loginView.oauthFailed": "Échec de la connexion. Veuillez réessayer.",
    "loginView.oauthRegistrationRefused":
        "Ce serveur n'a pas autorisé Zam à s'enregistrer pour la connexion.",
    "loginView.oauthRegistrationRefusedFallback":
        "Ce serveur n'a pas autorisé Zam à s'enregistrer pour la connexion. Utilisez l'une des autres options ci-dessous.",
    "loginView.checkingServer": "Vérification du serveur…",

    // src/lib/components/layout/MemberList.svelte
    "memberList.members": "Membres : {length}",
    "memberList.admins": "Administrateurs : {length}",
    "memberList.admin": "Administrateur",
    "memberList.moderators": "Modérateurs : {length}",

    // src/lib/components/messages/MessageActionsSheet.svelte
    "messageActionsSheet.thisMessage": "{label} ce message ?",
    "messageActionsSheet.messageActions": "Actions du message",

    // src/lib/components/layout/MessageArea.svelte
    "messageArea.dropToAttach": "Déposer pour joindre",
    "messageArea.unreadNotifications": "Notifications non lues",
    "messageArea.encryptionEnabled": "Chiffrement activé",
    "messageArea.joiningVoiceCall": "Connexion à l'appel vocal…",
    "messageArea.startVoiceCall": "Démarrer un appel vocal",
    "messageArea.showCall": "Afficher l'appel",
    "messageArea.searchMessages": "Rechercher des messages",
    "messageArea.threads": "Fils",
    "messageArea.toggleThreadsList": "Afficher/masquer la liste des fils",
    "messageArea.unreadThreadMentions": "Mentions non lues dans les fils",
    "messageArea.unreadThreads": "Fils non lus",
    "messageArea.pinnedMessages": "Messages épinglés",
    "messageArea.notificationsInbox": "Boîte des notifications",
    "messageArea.mediaAndFiles": "Médias et fichiers",
    "messageArea.toggleMemberList": "Afficher/masquer la liste des membres",
    "messageArea.more": "Plus",
    "messageArea.moreRoomOptions": "Plus d'options du salon",
    "messageArea.messageTimeline": "Fil des messages",
    "messageArea.welcomeTo": "Bienvenue dans #",
    "messageArea.thisIsTheBeginningOfThe": "Ceci est le début du salon #",
    "messageArea.room": ".",
    "messageArea.newMessages": "Nouveaux messages",
    "messageArea.messageFromABlockedUser": "Message d'un utilisateur bloqué",
    "messageArea.showBlockedMessage": "Afficher le message bloqué",
    "messageArea.thisRoomHasBeenUpgraded": "Ce salon a été mis à niveau",
    "messageArea.goToNewRoom": "Aller au nouveau salon",
    "messageArea.joinNewRoom": "Rejoindre le nouveau salon",
    "messageArea.jumpToPresent": "Revenir au présent",
    "messageArea.searchingForMessage": "Recherche du message…",
    "messageArea.viewingMessageContext": "Affichage du contexte du message",
    "messageArea.returnToLive": "Revenir au direct",
    "messageArea.closePanel": "Fermer le panneau",
    "messageArea.someone": "Quelqu'un",
    "messageArea.pinnedMessagesCount": "Messages épinglés ({count})",

    // src/lib/components/messages/MessageInput.svelte
    "messageInput.replyingTo": "En réponse à {replyTargetName}",
    "messageInput.cancelReplyEsc": "Annuler la réponse (Échap)",
    "messageInput.editAttachment": "Modifier la pièce jointe",
    "messageInput.editAttachment2": "Modifier la pièce jointe {name}",
    "messageInput.custom": "personnalisé",
    "messageInput.yourNextMessageWillStartA":
        "Votre prochain message démarrera un",
    "messageInput.thread": "fil",
    "messageInput.cancelThreadCreation": "Annuler la création du fil",
    "messageInput.favouriteGifs": "GIF favoris",
    "messageInput.sendMessage": "Envoyer le message",
    "messageInput.isTyping": "{value} est en train d'écrire…",
    "messageInput.andAreTyping": "{value} et {value2} sont en train d'écrire…",
    "messageInput.andAreTyping2":
        "{value}, {value2} et {value3} sont en train d'écrire…",
    "messageInput.severalPeopleAreTyping":
        "Plusieurs personnes sont en train d'écrire…",
    "messageInput.selectARoomToStartChatting":
        "Choisissez un salon pour commencer à discuter",
    "messageInput.replyInThread": "Répondre dans le fil...",
    "messageInput.replyTo": "Répondre à {replyTargetName}...",
    "messageInput.message": "Message dans #{roomName}",
    "messageInput.isNotAValidUser":
        "« {token} » n'est pas un utilisateur valide",
    "messageInput.noRoomSelected": "Aucun salon sélectionné",
    "messageInput.isNotInThisRoom": "{userId} n'est pas dans ce salon",
    "messageInput.youDonTHavePermissionTo":
        "Vous n'avez pas l'autorisation de modifier les niveaux de pouvoir dans ce salon",
    "messageInput.unhandledCommand": "Commande non gérée : /{name}",
    "messageInput.commandFailed": "Échec de la commande",
    "messageInput.failedToSend": "Échec de l'envoi",
    "messageInput.unknownCommand": "Commande inconnue : /{unknown}",
    "messageInput.sedNoMessage": "Vous n’avez aucun message à modifier ici",
    "messageInput.sedNoMatch":
        "« {pattern} » ne figure pas dans votre dernier message",
    "messageInput.sedEmpty": "Votre dernier message serait vide",
    "messageInput.sedFailed": "Impossible de modifier votre dernier message",
    "messageInput.sendingAttachments":
        "{count, plural, one {Envoi de # pièce jointe…} other {Envoi de # pièces jointes…}}",

    // src/lib/components/messages/MessageItem.svelte
    "messageItem.viewProfile": "Voir le profil",
    "messageItem.jumpToTheRepliedToMessage": "Aller au message d'origine :",
    "messageItem.originalMessageNotLoaded": "Message d'origine non chargé",
    "messageItem.originalMessageDeleted": "Message d'origine supprimé",
    "messageItem.originalMessageUnavailable": "Message d'origine indisponible",
    "messageItem.edited": "(modifié)",
    "messageItem.decryptingImage": "Déchiffrement de l'image...",
    "messageItem.couldnTDecryptImage": "Impossible de déchiffrer l'image",
    "messageItem.imageUnavailable": "[Image indisponible]",
    "messageItem.decryptingVideo": "Déchiffrement de la vidéo...",
    "messageItem.couldnTDecryptVideo": "Impossible de déchiffrer la vidéo",
    "messageItem.video": "Vidéo",
    "messageItem.canTBePlayedHere": "Lecture impossible ici",
    "messageItem.playbackFailedClickToRetry":
        "Échec de la lecture · Cliquez pour réessayer",
    "messageItem.clickToPlay": "{videoDuration} · Cliquez pour lire",
    "messageItem.clickToPlay2": "Cliquez pour lire",
    "messageItem.audio": "Audio",
    "messageItem.kb": "{toFixed} Ko",
    "messageItem.mb": "{toFixed} Mo",
    "messageItem.fileAttachment": "Fichier joint",
    "messageItem.download": "Télécharger",
    "messageItem.toSave": "pour enregistrer ·",
    "messageItem.toCancel": "pour annuler",
    "messageItem.openThread": "Ouvrir le fil",
    "messageItem.failedToSend": "Échec de l'envoi.",
    "messageItem.retrying": "Nouvelle tentative…",
    "messageItem.showWhoReadThisMessage": "Voir qui a lu ce message",
    "messageItem.readThis":
        "{count, plural, one {# personne a lu ceci} other {# personnes ont lu ceci}}",
    "messageItem.readBy": "Lu par",
    "messageItem.messageActions": "Actions du message",
    "messageItem.editMessage": "Modifier le message",
    "messageItem.delete": "Supprimer ?",
    "messageItem.yesDeleteMessage": "Oui, supprimer le message",
    "messageItem.yes": "Oui",
    "messageItem.noKeepMessage": "Non, garder le message",
    "messageItem.no": "Non",
    "messageItem.deleteMessage": "Supprimer le message",
    "messageItem.unpinMessage": "Désépingler le message",
    "messageItem.pinMessage": "Épingler le message",
    "messageItem.addReaction": "Ajouter une réaction",
    "messageItem.reply": "Répondre",
    "messageItem.replyInThread": "Répondre dans un fil",
    "messageItem.forwardMessage": "Transférer le message",
    "messageItem.moreActions": "Plus d'actions",
    "messageItem.linkCopied": "Lien copié !",
    "messageItem.copyMessageLink": "Copier le lien du message",
    "messageItem.linkCopied2": "Lien copié",
    "messageItem.couldnTDeleteTheMessage": "Impossible de supprimer le message",
    "messageItem.couldnTCopyTheMessageLink":
        "Impossible de copier le lien du message",
    "messageItem.failedToUnpinMessage": "Impossible de désépingler le message",
    "messageItem.failedToPinMessage": "Impossible d'épingler le message",
    "messageItem.couldNotOpenTheMatrixLink":
        "Impossible d'ouvrir le lien Matrix",

    // src/lib/components/messages/MessageRedactAction.svelte
    "messageRedactAction.removeMessage": "Retirer le message",
    "messageRedactAction.removeThisMessage": "Retirer ce message ?",
    "messageRedactAction.removing": "Suppression…",
    "messageRedactAction.failedToRemoveMessage":
        "Impossible de retirer le message",

    // src/lib/components/messages/MessageReportAction.svelte
    "messageReportAction.reportMessage": "Signaler le message",
    "messageReportAction.reportSent": "Signalement envoyé",
    "messageReportAction.whyAreYouReportingThisMessage":
        "Pourquoi signalez-vous ce message ?",
    "messageReportAction.markAsExtremelyOffensive":
        "Marquer comme extrêmement offensant",
    "messageReportAction.reporting": "Signalement…",
    "messageReportAction.report": "Signaler",

    // src/lib/components/layout/MessageSearchPanel.svelte
    "messageSearchPanel.searchMessages": "Rechercher des messages",
    "messageSearchPanel.searchTryFromOrHasImage":
        "Rechercher - essayez from: ou has:image",
    "messageSearchPanel.searchForMessagesInThisRoom":
        "Rechercher des messages dans ce salon.",
    "messageSearchPanel.noMatchesInTheResultsLoaded":
        "Aucune correspondance dans les résultats chargés jusqu'ici.",
    "messageSearchPanel.noResultsFor": "Aucun résultat pour « {searched} ».",
    "messageSearchPanel.searchFailed": "Échec de la recherche",
    "messageSearchPanel.resultCount":
        "{count, plural, one {# résultat} other {# résultats}}",

    // src/lib/components/settings/MessagesMediaSettings.svelte
    "messagesMediaSettings.messages": "Messages",
    "messagesMediaSettings.showMatrixIds": "Afficher les identifiants Matrix",
    "messagesMediaSettings.showFullMatrixIdsLikeUser":
        "Afficher les identifiants Matrix complets comme @user:server au lieu des noms d'affichage dans toute l'application.",
    "messagesMediaSettings.readReceiptAvatars":
        "Avatars des accusés de lecture",
    "messagesMediaSettings.showWhoHasReadEachMessage":
        "Afficher sous chaque message les petits avatars des personnes qui l'ont lu. Cela ne change que ce que vous voyez sur cet appareil - pour empêcher les autres de voir jusqu'où vous avez lu, utilisez les accusés de lecture privés dans Confidentialité et sécurité.",
    "messagesMediaSettings.holdToOpenMessageMenu":
        "Maintenir pour ouvrir le menu du message",
    "messagesMediaSettings.onTouchDevicesOpenAMessage":
        "Sur les appareils tactiles, ouvrir les actions d'un message en le maintenant au lieu de le toucher. Désactivé, un simple toucher ouvre le menu.",
    "messagesMediaSettings.linkPreviews": "Aperçus des liens",
    "messagesMediaSettings.whenOffNoLinkPreviewIs":
        "Désactivé, aucun aperçu de lien n'est chargé et votre serveur d'accueil ne récupère jamais la page liée pour vous. Choisissez d'où proviennent les médias des aperçus dans Confidentialité et sécurité.",
    "messagesMediaSettings.pauseVideosOffScreen":
        "Mettre en pause les vidéos hors écran",
    "messagesMediaSettings.pauseAPlayingVideoWhenIt":
        "Mettre en pause une vidéo en cours de lecture lorsqu'elle sort de l'écran pour économiser la batterie. Vous la relancez vous-même en revenant.",
    "messagesMediaSettings.defaultTab": "Onglet par défaut",
    "messagesMediaSettings.whichTabTheGifPickerOpens":
        "L'onglet sur lequel s'ouvre le sélecteur de GIF.",
    "messagesMediaSettings.defaultGifTab": "Onglet GIF par défaut",
    "messagesMediaSettings.favourites": "Favoris",
    "midiSoundBank.midi": "MIDI",
    "midiSoundBank.soundBank": "Banque de sons",
    "midiSoundBank.theInstrumentSoundsUsedTo":
        "Les sons d'instruments utilisés pour lire les pièces jointes MIDI.",
    "midiSoundBank.system": "Système",
    "midiSoundBank.included": "Incluse",
    "midiSoundBank.custom": "Personnalisée",
    "midiSoundBank.noSystemSoundBankFound":
        "Aucune banque de sons système trouvée sur cet appareil : la banque incluse est utilisée.",
    "midiSoundBank.chooseFile": "Choisir un fichier",
    "midiSoundBank.chooseAnotherFile": "Choisir un autre fichier",
    "midiSoundBank.saving": "Enregistrement…",
    "midiSoundBank.sf2Sf3OrDlsUpTo":
        "Personnalisée : un fichier SF2, SF3 ou DLS de 256 Mo max., conservé sur cet appareil.",
    "midiSoundBank.useAnSf2Sf3OrDls": "Utilisez un fichier SF2, SF3 ou DLS.",
    "midiSoundBank.thatFileIsEmpty": "Ce fichier est vide.",
    "midiSoundBank.fileIsTooLarge":
        "Ce fichier est trop volumineux (256 Mo max.).",
    "midiSoundBank.notASoundBank": "Ce fichier n'est pas une banque de sons.",
    "midiSoundBank.couldNotSave":
        "Impossible d'enregistrer la banque de sons sur cet appareil (le stockage est peut-être plein).",

    // src/lib/components/ui/ModalDialog.fixture.svelte
    "modalDialog.fixture.fixtureDialog": "Boîte de dialogue de test",

    // src/lib/components/settings/NotificationSettings.svelte
    "notificationSettings.thisDevice": "Cet appareil",
    "notificationSettings.systemPermission": "Autorisation système",
    "notificationSettings.pushNotifications": "Notifications push",
    "notificationSettings.permissionIsBlockedInSystemSettings":
        "L'autorisation est bloquée dans les paramètres système",
    "notificationSettings.notificationsAreNotSupportedHere":
        "Les notifications ne sont pas prises en charge ici",
    "notificationSettings.allowThisAppToSendNotifications":
        "Autoriser cette application à envoyer des notifications",
    "notificationSettings.requesting": "Demande en cours…",
    "notificationSettings.blocked": "Bloqué",
    "notificationSettings.unavailable": "Indisponible",
    "notificationSettings.enable": "Activer",
    "notificationSettings.pushService": "Service push",
    "notificationSettings.pushServiceLabel": "Distribuées via",
    "notificationSettings.pushServiceDescription":
        "Comment les notifications parviennent à cet appareil quand l'app est fermée. UnifiedPush fonctionne sans les services Google, via une app distributrice comme ntfy.",
    "notificationSettings.pushServiceAutomatic": "Automatique",
    "notificationSettings.pushServiceFcm": "Google (Firebase)",
    "notificationSettings.pushServiceFcmUnavailable":
        "Google (Firebase), indisponible ici",
    "notificationSettings.pushServiceUnifiedPush": "UnifiedPush : {label}",
    "notificationSettings.pushServiceNoDistributor":
        "Aucun distributeur UnifiedPush n'est installé. Installez-en un (par exemple ntfy) pour recevoir des notifications sans les services Google.",
    "notificationSettings.pushServiceActiveFcm":
        "Utilise actuellement Google (Firebase).",
    "notificationSettings.pushServiceActiveUnifiedPush":
        "Utilise actuellement UnifiedPush ({label}).",
    "notificationSettings.pushServiceActiveNone":
        "Aucun service push actif : les notifications n'arrivent que lorsque l'app est ouverte.",
    "notificationSettings.pushServiceSwitchFailed":
        "Impossible de changer de service push",
    "notificationSettings.sound": "Son",
    "notificationSettings.notificationSound": "Son des notifications",
    "notificationSettings.playASoundForLoudNotifications":
        "Jouer un son pour les notifications sonores",
    "notificationSettings.desktopAlerts": "Alertes du bureau",
    "notificationSettings.popUpAndTaskbarFlash":
        "Fenêtre contextuelle et clignotement de la barre des tâches",
    "notificationSettings.whichNotificationsShowASystemPop":
        "Les notifications qui affichent une fenêtre système et font clignoter l'icône de la barre des tâches quand la fenêtre est en arrière-plan.",
    "notificationSettings.popUps": "Fenêtres contextuelles",
    "notificationSettings.popUpNotifications": "Notifications contextuelles",
    "notificationSettings.whichNotificationsShowASystemPopUp":
        "Les notifications qui affichent une fenêtre système quand l'application est en arrière-plan.",
    "notificationSettings.multipleDevices": "Plusieurs appareils",
    "notificationSettings.quietOnMyOtherDevices":
        "Silence sur mes autres appareils",
    "notificationSettings.whileYouReActivelyUsingOne":
        "Pendant que vous utilisez activement un appareil, les autres n'émettent ni son ni fenêtre de notification tant que cet appareil n'est pas inactif depuis cette durée. S'applique à tous les appareils de votre compte ; les notifications apparaissent toujours dans votre boîte et les compteurs de non-lus ne changent pas.",
    "notificationSettings.custom": "Personnalisé…",
    "notificationSettings.customQuietDurationInMinutes":
        "Durée de silence personnalisée, en minutes",
    "notificationSettings.minutesMax":
        "minutes (max. {MAX_CUSTOM_GRACE_MINUTES})",
    "notificationSettings.couldnTSaveToYourAccount":
        "Impossible d'enregistrer sur votre compte - vos autres appareils peuvent garder l'ancien réglage. Vérifiez votre connexion et réessayez.",
    "notificationSettings.retrySavingTheOtherDeviceQuiet":
        "Réessayer d'enregistrer le réglage de silence des autres appareils",
    "notificationSettings.retrying": "Nouvelle tentative…",
    "notificationSettings.rules": "Règles",
    "notificationSettings.notificationRules": "Règles de notification",
    "notificationSettings.loudNotifyWithSoundSilentNotify":
        "Sonore = notifier avec un son · Silencieux = notifier sans son · Désactivé = aucune notification",
    "notificationSettings.keywordHighlights": "Mots-clés surlignés",
    "notificationSettings.getNotifiedWhenAMessageContains":
        "Soyez notifié quand un message contient un mot ou une expression. La correspondance ignore la casse ;",
    "notificationSettings.and": "et",
    "notificationSettings.areWildcards": "sont des jokers.",
    "notificationSettings.addAKeyword": "Ajouter un mot-clé…",
    "notificationSettings.newKeyword": "Nouveau mot-clé",
    "notificationSettings.noKeywordRulesYet":
        "Aucune règle de mot-clé pour l'instant.",
    "notificationSettings.behaviorFor": "Comportement pour {pattern}",
    "notificationSettings.enable2": "Activer {pattern}",
    "notificationSettings.loudOnly": "Sonores uniquement",
    "notificationSettings.onlyNotificationsThatMakeASound":
        "Uniquement les notifications qui émettent un son",
    "notificationSettings.silentAndLoud": "Silencieuses et sonores",
    "notificationSettings.everyNotificationLoudOrSilent":
        "Toutes les notifications, sonores ou silencieuses",
    "notificationSettings.none": "Aucune",
    "notificationSettings.neverAlertOnThisDevice":
        "Ne jamais alerter sur cet appareil",
    "notificationSettings.couldNotSaveNotificationSetting":
        "Impossible d'enregistrer le réglage de notification",
    "notificationSettings.highlightSound": "Surlignage + son",
    "notificationSettings.notifyWithAHighlightAndSound":
        "Notifier avec surlignage et son",
    "notificationSettings.highlight": "Surlignage",
    "notificationSettings.notifyWithAHighlight": "Notifier avec surlignage",
    "notificationSettings.notify": "Notifier",
    "notificationSettings.notifyWithoutAHighlight": "Notifier sans surlignage",
    "notificationSettings.failedToAddKeyword":
        "Impossible d'ajouter le mot-clé",
    "notificationSettings.failedToUpdateKeyword":
        "Impossible de mettre à jour le mot-clé",
    "notificationSettings.failedToDeleteKeyword":
        "Impossible de supprimer le mot-clé",
    "notificationSettings.accountNotificationsOff":
        "Les notifications sont désactivées pour ce compte",
    "notificationSettings.accountNotificationsOffDetail":
        "Toutes les notifications de ce compte sont désactivées sur le serveur, sans doute depuis une autre application : aucun appareil n’est notifié, quels que soient les réglages ci-dessous.",
    "notificationSettings.turnOn": "Activer",
    "notificationSettings.couldNotTurnOnNotifications":
        "Impossible d’activer les notifications",

    // src/lib/components/layout/NotificationsPanel.svelte
    "notificationsPanel.clearAll": "Tout effacer",
    "notificationsPanel.couldNotRefreshServerNotificationsTap":
        "Impossible d'actualiser les notifications du serveur. Touchez pour réessayer.",
    "notificationsPanel.noNotifications": "Aucune notification.",
    "notificationsPanel.jumpToMessage": "Aller au message :",
    "notificationsPanel.in": "dans #{roomName}",
    "notificationsPanel.message": "(message)",

    // src/lib/components/messages/OutboxStrip.svelte
    "outboxStrip.queued": "En file d'attente",
    "outboxStrip.sending": "Envoi…",
    "outboxStrip.failed": "Échec",

    // src/lib/components/layout/OwnStatusEditor.svelte
    "ownStatusEditor.pickAStatusEmoji": "Choisir un émoji de statut",
    "ownStatusEditor.whatSHappening": "Quoi de neuf ?",
    "ownStatusEditor.statusText": "Texte du statut",
    "ownStatusEditor.clearStatus": "Effacer le statut",
    "ownStatusEditor.couldNotSaveStatus": "Impossible d'enregistrer le statut",

    // src/lib/components/layout/PinnedMessagesPanel.svelte
    "pinnedMessagesPanel.pinnedMessages": "Messages épinglés",
    "pinnedMessagesPanel.noPinnedMessages": "Aucun message épinglé.",
    "pinnedMessagesPanel.jump": "Aller",
    "pinnedMessagesPanel.unpin": "Désépingler",

    // src/lib/components/plugins/PluginPopoverHost.svelte
    "pluginPopoverHost.plugin": "Plugin",

    // src/lib/components/settings/PluginSettingsForm.svelte
    "pluginSettingsForm.backToPlugins": "Retour aux plugins",
    "pluginSettingsForm.settings": "Paramètres de {pluginName}",
    "pluginSettingsForm.thisPluginHasNoSettings":
        "Ce plugin n'a aucun paramètre.",
    "pluginSettingsForm.moveUp": "Monter",
    "pluginSettingsForm.moveDown": "Descendre",
    "pluginSettingsForm.removeRow": "Retirer la ligne",

    // src/lib/components/settings/PluginsSettings.svelte
    "pluginsSettings.back": "← Retour",
    "pluginsSettings.syncYourEnabledPluginsSettingsTo":
        "Synchronisez vos plugins activés et leurs paramètres avec votre compte Matrix (sinon, par appareil). La récupération montre ce qui va changer avant toute exécution.",
    "pluginsSettings.pushToAccount": "Envoyer vers le compte",
    "pluginsSettings.pullFromAccount": "Récupérer depuis le compte",
    "pluginsSettings.thisPullWill": "Cette récupération va :",
    "pluginsSettings.addRepos": "Ajouter les dépôts : {join}",
    "pluginsSettings.installFromRepos":
        "Installer depuis leurs dépôts : {join}",
    "pluginsSettings.couldNotInstall":
        "Appliqué, mais ces plugins n'ont pas pu être installés : {join}",
    "pluginsSettings.enable": "Activer : {join}",
    "pluginsSettings.disable": "Désactiver : {join}",
    "pluginsSettings.updateSettingsFor":
        "Mettre à jour les paramètres de : {join}",
    "pluginsSettings.setAutoUpdate": "Mise à jour automatique : {value}",
    "pluginsSettings.setPerPluginAutoUpdate":
        "Mise à jour automatique par plugin : {join}",
    "pluginsSettings.notInstalledOnThisDeviceInstall":
        "Non installés sur cet appareil (installez-les depuis Parcourir, puis récupérez à nouveau) : {join}",
    "pluginsSettings.nothingToChangeAlreadyInSync":
        "Rien à changer ; déjà synchronisé.",
    "pluginsSettings.apply": "Appliquer",
    "pluginsSettings.installed": "Installés",
    "pluginsSettings.noPluginsInstalled": "Aucun plugin installé.",
    "pluginsSettings.needsUpdate": "Mise à jour nécessaire",
    "pluginsSettings.updateToV": "Mettre à jour vers v{value}",
    "pluginsSettings.updating": "Mise à jour...",
    "pluginsSettings.update": "Mettre à jour",
    "pluginsSettings.pluginSettings": "Paramètres du plugin",
    "pluginsSettings.enable2": "Activer {name}",
    "pluginsSettings.working": "En cours...",
    "pluginsSettings.autoUpdateThisPlugin":
        "Mettre à jour ce plugin automatiquement",
    "pluginsSettings.autoDefault": "Auto : par défaut",
    "pluginsSettings.autoOn": "Auto : activé",
    "pluginsSettings.autoOff": "Auto : désactivé",
    "pluginsSettings.confirmRemove": "Confirmer la suppression de {name}",
    "pluginsSettings.removePlugin": "Supprimer le plugin",
    "pluginsSettings.remove": "Supprimer {name}",
    "pluginsSettings.browse": "Parcourir",
    "pluginsSettings.loading": "Chargement...",
    "pluginsSettings.noPluginsInThisRepoYet":
        "Aucun plugin dans ce dépôt pour l'instant.",
    "pluginsSettings.install": "Installer",
    "pluginsSettings.repos": "Dépôts",
    "pluginsSettings.official": "Officiel",
    "pluginsSettings.removeRepo": "Retirer le dépôt",
    "pluginsSettings.addARepo": "Ajouter un dépôt",
    "pluginsSettings.thirdPartyReposRunFullTrust":
        "Les dépôts tiers exécutent du code en toute confiance, avec un accès complet à votre compte et à vos messages. N'ajoutez que des dépôts de confiance.",
    "pluginsSettings.ownerRepoOrGithubUrl": "propriétaire/dépôt ou URL GitHub",
    "pluginsSettings.addRepo": "Ajouter le dépôt",
    "pluginsSettings.syncPlugins": "Synchroniser les plugins",
    "pluginsSettings.disableAllPlugins": "Désactiver tous les plugins",
    "pluginsSettings.autoUpdatePlugins": "Mise à jour automatique des plugins",
    "pluginsSettings.automaticallyPullNewerVersionsOfRepo":
        "Récupérer automatiquement les nouvelles versions des plugins des dépôts.",
    "pluginsSettings.pushedYourPluginSetToYour":
        "Votre ensemble de plugins a été envoyé vers votre compte.",
    "pluginsSettings.pushFailed": "Échec de l'envoi.",
    "pluginsSettings.pullFailed": "Échec de la récupération.",
    "pluginsSettings.appliedTheSyncedPluginSet":
        "Ensemble de plugins synchronisé appliqué.",
    "pluginsSettings.updateFailed": "Échec de la mise à jour.",
    "pluginsSettings.couldnTRemovePlugin":
        "Impossible de supprimer le plugin : {message}",
    "pluginsSettings.couldnTRemovePlugin2":
        "Impossible de supprimer le plugin.",
    "pluginsSettings.cannotAddThisRepo": "Impossible d'ajouter ce dépôt.",
    "pluginsSettings.noIndexJson": "Pas de index.json ({status})",
    "pluginsSettings.installFailed": "Échec de l'installation.",

    // src/lib/components/messages/PollBody.svelte
    "pollBody.finalResults": "Résultats finaux",
    "pollBody.livePoll": "Sondage en cours",
    "pollBody.resultsAreRevealedWhenThePoll":
        "Les résultats seront révélés à la fin du sondage",
    "pollBody.chooseUpTo": "· choisissez jusqu'à {maxSelections}",
    "pollBody.selected": "✓ sélectionné",
    "pollBody.submitting": "Envoi…",
    "pollBody.submitVote": "Voter",
    "pollBody.votesAreHidden": "Les votes sont masqués",
    "pollBody.savingVote": "· enregistrement du vote…",
    "pollBody.closeThisPoll": "Clôturer ce sondage ?",
    "pollBody.closing": "Clôture…",
    "pollBody.closePoll": "Clôturer le sondage",
    "pollBody.pollUnsupportedFormat": "[Sondage - format non pris en charge]",
    "pollBody.failedToSubmitVote": "Impossible d'envoyer le vote",
    "pollBody.failedToClosePoll": "Impossible de clôturer le sondage",
    "pollBody.voteCount": "{count, plural, one {# vote} other {# votes}}",

    // src/lib/components/ui/Portal.fixture.svelte
    "portal.fixture.hello": "bonjour",

    // src/lib/components/settings/PrivacySafetySettings.svelte
    "privacySafetySettings.privacy": "Confidentialité",
    "privacySafetySettings.privateReadReceipts": "Accusés de lecture privés",
    "privacySafetySettings.hideYourReadReceiptsFromOther":
        "Masquer vos accusés de lecture aux autres utilisateurs. Vos compteurs de non-lus fonctionnent toujours ; les autres ne voient simplement pas jusqu'où vous avez lu.",
    "privacySafetySettings.hideMessageTextInNotifications":
        "Masquer le texte des messages dans les notifications",
    "privacySafetySettings.notificationsOnThisDeviceSayWho":
        "Les notifications sur cet appareil indiquent qui vous a écrit, mais pas ce qui a été dit. Les noms de l'expéditeur et du salon restent visibles. S'applique uniquement à cet appareil.",
    "privacySafetySettings.linkPreviewMedia": "Médias des aperçus de liens",
    "privacySafetySettings.previewImagesAndVideosUsuallyCome":
        "Les images et vidéos des aperçus proviennent généralement directement du site qui les héberge, qui apprend donc votre adresse IP et le moment où vous lisez le message. « Serveur d'accueil uniquement » ne charge que les copies servies par votre propre serveur ; « Désactivé » ne charge rien. Les deux masquent aussi les lecteurs YouTube intégrés et les cartes X/Twitter, qui se chargent toujours directement depuis ces sites. Dans tous les cas, chaque aperçu concerné garde un bouton pour charger ses médias. L'interrupteur des aperçus de liens se trouve dans Messages et médias.",
    "privacySafetySettings.blockedUsers": "Utilisateurs bloqués",
    "privacySafetySettings.all": "Tous",
    "privacySafetySettings.loadPreviewMediaFromWhereverIt":
        "Charger les médias des aperçus depuis leur hébergement d'origine",
    "privacySafetySettings.homeserverOnly": "Serveur d'accueil uniquement",
    "privacySafetySettings.onlyLoadPreviewMediaYourOwn":
        "Ne charger que les médias servis par votre propre serveur d'accueil",
    "privacySafetySettings.off": "Désactivé",
    "privacySafetySettings.neverLoadPreviewMediaAutomatically":
        "Ne jamais charger automatiquement les médias des aperçus",

    // src/lib/components/settings/ProfileFieldsEditor.svelte
    "profileFieldsEditor.moreAboutYou": "En savoir plus sur vous",
    "profileFieldsEditor.banner": "Bannière",
    "profileFieldsEditor.yourBanner": "Votre bannière",
    "profileFieldsEditor.changeBanner": "Changer la bannière",
    "profileFieldsEditor.showWhenIAmInA": "Indiquer quand je suis en appel",
    "profileFieldsEditor.addsInACallToYour":
        "Ajoute « En appel » à votre profil quand vous êtes connecté à un appel vocal, et le retire quand vous partez.",
    "profileFieldsEditor.pronouns": "Pronoms",
    "profileFieldsEditor.sheHerTheyThem": "elle, iel",
    "profileFieldsEditor.separateWithCommasMostPreferredFirst":
        "Séparez par des virgules, le préféré en premier.",
    "profileFieldsEditor.status": "Statut",
    "profileFieldsEditor.statusEmoji": "Émoji de statut",
    "profileFieldsEditor.pickAStatusEmoji": "Choisir un émoji de statut",
    "profileFieldsEditor.onHolidayUntilThe23rd": "En vacances jusqu'au 23",
    "profileFieldsEditor.statusText": "Texte du statut",
    "profileFieldsEditor.bio": "Bio",
    "profileFieldsEditor.tellPeopleAboutYourself": "Parlez un peu de vous",
    "profileFieldsEditor.timezone": "Fuseau horaire",
    "profileFieldsEditor.timezoneRegion": "Région du fuseau horaire",
    "profileFieldsEditor.notSet": "Non défini",
    "profileFieldsEditor.timezoneCity": "Ville du fuseau horaire",
    "profileFieldsEditor.chooseACity": "Choisir une ville",
    "profileFieldsEditor.europeLondon": "Europe/Paris",
    "profileFieldsEditor.useMine": "Utiliser le mien",
    "profileFieldsEditor.usernameColour": "Couleur du nom d'utilisateur",
    "profileFieldsEditor.usernameColourOnDarkThemes":
        "Couleur du nom sur les thèmes sombres",
    "profileFieldsEditor.darkThemes": "thèmes sombres",
    "profileFieldsEditor.usernameColourOnLightThemes":
        "Couleur du nom sur les thèmes clairs",
    "profileFieldsEditor.lightThemes": "thèmes clairs",
    "profileFieldsEditor.resetToDefault": "Rétablir par défaut",
    "profileFieldsEditor.chooseAColour": "Choisir une couleur",
    "profileFieldsEditor.oneColourForDarkThemesAnd":
        "Une couleur pour les thèmes sombres et une pour les clairs, pour que votre nom reste lisible dans les deux cas.",
    "profileFieldsEditor.links": "Liens",
    "profileFieldsEditor.label": "Libellé",
    "profileFieldsEditor.linkLabel": "Libellé du lien",
    "profileFieldsEditor.httpsExampleOrg": "https://exemple.org",
    "profileFieldsEditor.linkAddress": "Adresse du lien",
    "profileFieldsEditor.removeLink": "Retirer le lien",
    "profileFieldsEditor.addLink": "Ajouter un lien",
    "profileFieldsEditor.saved": "Enregistré",
    "profileFieldsEditor.useATimezoneNameLikeEurope":
        "Utilisez un nom de fuseau horaire comme Europe/Paris.",
    "profileFieldsEditor.chooseACity2": "Choisissez une ville.",
    "profileFieldsEditor.bannerUploadFailed": "Échec de l'envoi de la bannière",
    "profileFieldsEditor.failedToSaveProfileFields":
        "Impossible d'enregistrer les champs du profil",

    // src/lib/components/layout/ProfileFooter.svelte
    "profileFooter.dismiss": "Ignorer",
    "profileFooter.switchAccounts": "Changer de compte",
    "profileFooter.unknown": "Inconnu",

    // src/lib/components/settings/PushDiagnostics.svelte
    "pushDiagnostics.pushGateway": "Passerelle push",
    "pushDiagnostics.notificationRelay": "Relais des notifications",
    "pushDiagnostics.pushNotificationsAreRelayedThroughThis":
        "Les notifications push passent par cette passerelle. Elle peut voir quels salons et expéditeurs vous notifient, mais jamais le texte de vos messages.",
    "pushDiagnostics.warningYourHomeserverIsRoutingThis":
        "Attention : votre serveur d'accueil envoie les notifications push de cet appareil vers une autre passerelle ({join}). C'est cette passerelle, et non celle ci-dessus, qui voit les métadonnées de vos notifications.",
    "pushDiagnostics.verifiedYourHomeserverRoutesNotificationsTo":
        "Vérifié : votre serveur d'accueil envoie les notifications à cette passerelle.",
    "pushDiagnostics.noPushNotificationsAreRegisteredOn":
        "Aucune notification push n'est encore enregistrée sur ce compte.",

    // src/lib/components/ui/QrCodeImage.svelte
    "qrCodeImage.couldNotRenderTheVerificationCode":
        "Impossible d'afficher le code de vérification.",
    "qrCodeImage.qrCodeForDeviceVerification":
        "Code QR pour la vérification de l'appareil",

    // src/lib/components/layout/QuickActions.svelte
    "quickActions.newDm": "Nouveau message direct",
    "quickActions.createRoomInSpace": "Créer un salon dans l'espace",
    "quickActions.createNewRoom": "Créer un salon",
    "quickActions.createNewSpace": "Créer un espace",
    "quickActions.joinRoomByAddress": "Rejoindre un salon par adresse",
    "quickActions.createARoom": "Créer un salon",
    "quickActions.createASpace": "Créer un espace",
    "quickActions.newDirectMessage": "Nouveau message direct",
    "quickActions.joinARoom": "Rejoindre un salon",
    "quickActions.spaceName": "Nom de l'espace",
    "quickActions.roomName": "Nom du salon",
    "quickActions.mySpace": "Mon espace",
    "quickActions.optional": "(facultatif)",
    "quickActions.whatSThisSpaceAbout": "De quoi parle cet espace ?",
    "quickActions.whatSThisRoomAbout": "De quoi parle ce salon ?",
    "quickActions.opensStraightIntoACallMessages":
        "S'ouvre directement sur un appel. Les messages fonctionnent toujours.",
    "quickActions.enableEncryption": "Activer le chiffrement",
    "quickActions.canTBeTurnedOffLater":
        "Ne pourra pas être désactivé ensuite.",
    "quickActions.findSomeoneToMessage": "Trouver quelqu'un à qui écrire…",
    "quickActions.encryptThisDm": "Chiffrer ce message direct",
    "quickActions.openTheDm": "Ouvrir le message direct",
    "quickActions.roomAddressOrId": "Adresse ou identifiant du salon",
    "quickActions.roomServerCom": "#salon:serveur.fr",
    "quickActions.requestSentYouLlBeAble":
        "Demande envoyée - vous pourrez rejoindre dès que quelqu'un vous acceptera.",
    "quickActions.youCanTJoinThisRoom":
        "Vous ne pouvez pas rejoindre ce salon directement, mais vous pouvez demander à le rejoindre.",
    "quickActions.requestToJoin": "Demander à rejoindre",
    "quickActions.create": "Créer",
    "quickActions.somethingWentWrong": "Une erreur s'est produite",
    "quickActions.enterARoomAddressRoomServer":
        "Saisissez une adresse de salon (#salon:serveur.fr) ou un identifiant (!id:serveur.fr)",
    "quickActions.couldNotSendTheJoinRequest":
        "Impossible d'envoyer la demande d'accès",

    // src/lib/components/messages/ReactorPopover.svelte
    "reactorPopover.more": "+{overflow} autres",
    "reactorPopover.reactedWith": "A réagi avec {label}",
    "reactorPopover.userList": "Liste des utilisateurs",

    // src/lib/components/messages/RenameAttachmentDialog.svelte
    "renameAttachmentDialog.editAttachment": "Modifier la pièce jointe",
    "renameAttachmentDialog.filename": "Nom du fichier",
    "renameThreadDialog.nameThread": "Nommer le fil",
    "renameThreadDialog.renameThread": "Renommer le fil",
    "renameThreadDialog.threadName": "Nom du fil",
    "renameThreadDialog.everyoneInTheRoomSeesIt":
        "Tous les membres du salon voient ce nom dans Zam. Les autres applis Matrix ne l'affichent pas.",
    "renameThreadDialog.removeName": "Supprimer le nom",
    "renameThreadDialog.couldNotSaveTheName": "Impossible d'enregistrer le nom",

    // src/lib/components/layout/RoomDirectory.svelte
    "roomDirectory.exploreRooms": "Explorer les salons",
    "roomDirectory.onYourHomeserver": "sur votre serveur d'accueil",
    "roomDirectory.publicRooms": "Salons publics {value}",
    "roomDirectory.rooms": "· ~{totalEstimate} salons",
    "roomDirectory.searchRooms": "Rechercher des salons…",
    "roomDirectory.serverOptional": "Serveur (facultatif)",
    "roomDirectory.search": "Rechercher",
    "roomDirectory.noRoomsFound": "Aucun salon trouvé.",
    "roomDirectory.space": "Espace",
    "roomDirectory.open": "Ouvrir",
    "roomDirectory.knockOnly": "Sur demande uniquement",
    "roomDirectory.requestToJoin": "Demander à rejoindre",
    "roomDirectory.requested": "Demandé",
    "roomDirectory.somethingWentWrong": "Une erreur s'est produite",

    // src/lib/components/layout/RoomHeaderOverflowMenu.svelte
    "roomHeaderOverflowMenu.moreRoomOptions": "Plus d'options du salon",
    "roomHeaderOverflowMenu.unread": "non lu",
    "roomHeaderOverflowMenu.badgeThreads":
        "{count, plural, one {{badge} mention non lue} other {{badge} mentions non lues}}",
    "roomHeaderOverflowMenu.badgePinned":
        "{count, plural, one {{badge} message épinglé} other {{badge} messages épinglés}}",
    "roomHeaderOverflowMenu.badgeNotifications":
        "{count, plural, one {{badge} notification non lue} other {{badge} notifications non lues}}",
    "roomHeaderOverflowMenu.badgeMedia":
        "{count, plural, one {{badge} élément} other {{badge} éléments}}",
    "roomHeaderOverflowMenu.badgeMembers":
        "{count, plural, one {{badge} membre} other {{badge} membres}}",

    // src/lib/components/layout/RoomList.svelte
    "roomList.doneReordering": "Réorganisation terminée",
    "roomList.reorderRooms": "Réorganiser les salons",
    "roomList.spaceSettings": "Paramètres de l'espace",
    "roomList.pendingInvites": "Invitations en attente",
    "roomList.inVoice": "{name} - en vocal",
    "roomList.orderValue": "Valeur d'ordre",
    "roomList.roomSettings": "Paramètres du salon",
    "roomList.favourites": "Favoris",
    "roomList.channels": "Canaux",
    "roomList.rooms": "Salons",
    "roomList.lowPriority": "Priorité basse",
    "roomList.browseRooms": "Parcourir les salons",
    "roomList.members": "{numMembers} membres",
    "roomList.requested": "Demandé",
    "roomList.cancelRequest": "Annuler la demande",
    "roomList.youCanTJoinThisRoom":
        "Vous ne pouvez pas rejoindre ce salon directement - demander à le rejoindre ?",
    "roomList.notNow": "Pas maintenant",
    "roomList.requestToJoin": "Demander à rejoindre",
    "roomList.directMessages": "Messages directs",
    "roomList.noRoomsYet": "Aucun salon pour l'instant",
    "roomList.emptyCategory": "Aucun salon",
    "roomList.copyRoomLink": "Copier le lien du salon",
    "roomList.markAsRead": "Marquer comme lu",
    "roomList.addToSpace": "Ajouter à un espace",
    "roomList.clickAgainToLeave": "Cliquez à nouveau pour quitter",
    "roomList.leaveRoom": "Quitter le salon",
    "roomList.couldNotSendTheJoinRequest":
        "Impossible d'envoyer la demande d'accès",
    "roomList.orderMustBeBetween0And":
        "L'ordre doit être compris entre 0 et 1 - {value} utilisé à la place.",
    "roomList.failedToSetOrder": "Impossible de définir l'ordre",

    // src/lib/components/layout/RoomMediaPanel.svelte
    "roomMediaPanel.media": "Médias",
    "roomMediaPanel.closeMediaPanel": "Fermer le panneau des médias",
    "roomMediaPanel.media2": "Médias ({length}{value})",
    "roomMediaPanel.files": "Fichiers ({length}{value})",
    "roomMediaPanel.tryAgain": "Réessayer",
    "roomMediaPanel.play": "{name} - lire",
    "roomMediaPanel.video": "Vidéo",
    "roomMediaPanel.audio": "Audio",
    "roomMediaPanel.file": "Fichier",
    "roomMediaPanel.decryptingMedia": "Déchiffrement du média",
    "roomMediaPanel.decryptingMedia2": "Déchiffrement du média...",
    "roomMediaPanel.mediaCouldNotBeLoaded": "Le média n'a pas pu être chargé",
    "roomMediaPanel.couldNotLoadThisMedia": "Impossible de charger ce média.",
    "roomMediaPanel.noMediaFoundInTheLast":
        "Aucun média dans les quelques centaines de derniers messages.",
    "roomMediaPanel.noFilesFoundInTheLast":
        "Aucun fichier dans les quelques centaines de derniers messages.",
    "roomMediaPanel.noImagesOrVideosInThis":
        "Aucune image ni vidéo dans ce salon pour l'instant.",
    "roomMediaPanel.noFilesInThisRoomYet":
        "Aucun fichier dans ce salon pour l'instant.",
    "roomMediaPanel.couldNotLoadMedia": "Impossible de charger les médias.",
    "roomMediaPanel.couldNotLoadMoreMedia":
        "Impossible de charger plus de médias.",
    "roomMediaPanel.failedToDownloadAttachment":
        "Impossible de télécharger la pièce jointe",

    // src/lib/components/layout/RoomSettings.svelte
    "roomSettings.closeSettings": "Fermer les paramètres",
    "roomSettings.backToSettings": "Retour aux paramètres",
    "roomSettings.settings": "{name} - Paramètres",
    "roomSettings.roomAvatar": "Avatar du salon",
    "roomSettings.roomName": "Nom du salon",
    "roomSettings.saved": "Enregistré !",
    "roomSettings.saveChanges": "Enregistrer les modifications",
    "roomSettings.advanced": "Avancé",
    "roomSettings.spaceId": "Identifiant de l'espace",
    "roomSettings.roomId": "Identifiant du salon",
    "roomSettings.copied": "Copié !",
    "roomSettings.roomVersionV": "Version du salon : v{getVersion}",
    "roomSettings.upgradeRoom": "Mettre à niveau le salon…",
    "roomSettings.thisCreatesANewRoomOn":
        "Cela crée un nouveau salon en v{recommendedVersion} et marque celui-ci comme remplacé. Les membres seront redirigés vers le nouveau salon.",
    "roomSettings.upgrading": "Mise à niveau…",
    "roomSettings.upgradeRoom2": "Mettre à niveau le salon",
    "roomSettings.whoCanJoin": "Qui peut rejoindre ?",
    "roomSettings.spaceMembersAnyoneInCanJoin":
        "Membres de l'espace - toute personne dans {parentSpaceNames} peut rejoindre",
    "roomSettings.spaceMembersAnyoneInTheParent":
        "Membres de l'espace - toute personne dans l'espace parent peut rejoindre",
    "roomSettings.messageHistory": "Historique des messages",
    "roomSettings.guestAccess": "Accès invité",
    "roomSettings.allowGuestsToJoinWithoutAn":
        "Autoriser les invités à rejoindre sans compte",
    "roomSettings.guestsAreAnonymousAccountsTheHomeserver":
        "Les invités sont des comptes anonymes que le serveur d'accueil crée à la demande. Beaucoup de serveurs désactivent entièrement l'inscription des invités, auquel cas ce réglage n'a aucun effet.",
    "roomSettings.discoverability": "Visibilité",
    "roomSettings.addresses": "Adresses",
    "roomSettings.loadingAddresses": "Chargement des adresses…",
    "roomSettings.noAddressesYet": "Aucune adresse pour l'instant.",
    "roomSettings.main": "Principale",
    "roomSettings.remove": "Retirer {alias}",
    "roomSettings.mainAddress": "Adresse principale",
    "roomSettings.noMainAddress": "Aucune adresse principale",
    "roomSettings.set": "Définir",
    "roomSettings.myRoom": "mon-salon",
    "roomSettings.serverAccessControl": "Contrôle d'accès des serveurs",
    "roomSettings.controlWhichHomeserversMayParticipateIn":
        "Choisissez quels serveurs d'accueil peuvent participer à ce salon. Jokers :",
    "roomSettings.matchesAnyCharacters":
        "correspond à n'importe quels caractères,",
    "roomSettings.matchesOneDeniedServersAreRemoved":
        "correspond à un seul. Les serveurs refusés sont retirés de la fédération pour ce salon.",
    "roomSettings.noServerAclIsSetAll":
        "Aucune ACL de serveurs n'est définie. Tous les serveurs peuvent participer.",
    "roomSettings.allowedServersOnePerLine":
        "Serveurs autorisés (un par ligne)",
    "roomSettings.deniedServersOnePerLine": "Serveurs refusés (un par ligne)",
    "roomSettings.allowServersIdentifiedByARaw":
        "Autoriser les serveurs identifiés par une adresse IP brute",
    "roomSettings.saveServerAcl": "Enregistrer l'ACL des serveurs",
    "roomSettings.youDoNotHavePermissionTo":
        "Vous n'avez pas l'autorisation de modifier l'ACL des serveurs de ce salon.",
    "roomSettings.appliesToTheSpaceAndAll":
        "S'applique à l'espace et à tous ses salons.",
    "roomSettings.notificationLevel": "Niveau de notification",
    "roomSettings.encryption": "Chiffrement",
    "roomSettings.encrypted": "Chiffré",
    "roomSettings.notEncrypted": "Non chiffré",
    "roomSettings.messagesInThisRoomAreEnd":
        "Les messages de ce salon sont chiffrés de bout en bout. Cela ne peut pas être désactivé.",
    "roomSettings.enableEncryption": "Activer le chiffrement",
    "roomSettings.typeToConfirm":
        "Tapez {ENABLE_ENCRYPTION_CONFIRM_PHRASE} pour confirmer",
    "roomSettings.enabling": "Activation…",
    "roomSettings.powerLevelRequiredForEachAction":
        "Niveau de pouvoir requis pour chaque action (0–100).",
    "roomSettings.joinCallsVoiceVideo": "Rejoindre les appels (voix/vidéo)",
    "roomSettings.invite": "Inviter",
    "roomSettings.searchMembers": "Rechercher des membres…",
    "roomSettings.banned": "Bannis ({length})",
    "roomSettings.pendingJoinRequests":
        "Demandes d'accès en attente ({length})",
    "roomSettings.deny": "Refuser",
    "roomSettings.approve": "Approuver",
    "roomSettings.unban": "Débannir",
    "roomSettings.noBannedMembers": "Aucun membre banni",
    "roomSettings.you": " (vous)",
    "roomSettings.setRole": "Définir le rôle…",
    "roomSettings.admin100": "Administrateur (100)",
    "roomSettings.moderator50": "Modérateur (50)",
    "roomSettings.member0": "Membre (0)",
    "roomSettings.muted1": "Muet (-1)",
    "roomSettings.kick": "Expulser",
    "roomSettings.ban": "Bannir",
    "roomSettings.hideThisUserSMessagesEverywhere":
        "Masquer les messages de cet utilisateur partout (stocké sur votre compte)",
    "roomSettings.setThe": "Définissez le champ",
    "roomSettings.fieldOnEachChildRoomTo":
        "de chaque salon enfant pour contrôler l'ordre de tri (lexicographique). Laissez vide pour trier par date de création.",
    "roomSettings.suggested": "Suggéré",
    "roomSettings.removeSuggestedHint": "Retirer la suggestion",
    "roomSettings.markAsSuggested": "Marquer comme suggéré",
    "roomSettings.unsuggest": "Ne plus suggérer",
    "roomSettings.suggest": "Suggérer",
    "roomSettings.order": "order",
    "roomSettings.removeFromSpace": "Retirer de l'espace",
    "roomSettings.noChildRooms": "Aucun salon enfant",
    "roomSettings.useYourGlobalNotificationSettings":
        "Utiliser vos paramètres de notification globaux.",
    "roomSettings.allMessages": "Tous les messages",
    "roomSettings.notifyForEveryMessage": "Notifier pour chaque message.",
    "roomSettings.mentionsOnly": "Mentions uniquement",
    "roomSettings.notifyOnlyForMentionsAndKeywords":
        "Notifier uniquement pour les @mentions et mots-clés.",
    "roomSettings.neverNotify": "Ne jamais notifier.",
    "roomSettings.failedToUpdateNotifications":
        "Impossible de mettre à jour les notifications.",
    "roomSettings.failedToEnableEncryption":
        "Impossible d'activer le chiffrement",
    "roomSettings.failedToSave": "Échec de l'enregistrement",
    "roomSettings.uploadFailed": "Échec de l'envoi",
    "roomSettings.failedToUpgradeRoom":
        "Impossible de mettre à niveau le salon",
    "roomSettings.failedToSaveServerAcl":
        "Impossible d'enregistrer l'ACL des serveurs",
    "roomSettings.couldNotChangeVisibility":
        "Impossible de modifier la visibilité",
    "roomSettings.couldNotLoadThisRoomS":
        "Impossible de charger les adresses de ce salon",
    "roomSettings.couldNotAddThatAddress": "Impossible d'ajouter cette adresse",
    "roomSettings.thisAddressIsPublishedAsOne":
        "Cette adresse est publiée comme adresse du salon et vous n'avez pas l'autorisation de la dépublier, elle ne peut donc pas être retirée. Demandez à un administrateur du salon.",
    "roomSettings.couldNotRemoveThatAddress":
        "Impossible de retirer cette adresse",
    "roomSettings.couldNotSetTheMainAddress":
        "Impossible de définir l'adresse principale",
    "roomSettings.failed": "Échec",
    "roomSettings.muted": "Muet",
    "roomSettings.admin": "Administrateur",
    "roomSettings.moderator": "Modérateur",
    "roomSettings.member": "Membre",
    "roomSettings.failedToUpdateSuggestion":
        "Impossible de mettre à jour la suggestion",
    "roomSettings.listThisRoomInTheServerDirectory":
        "Référencer ce salon dans l'annuaire du serveur",
    "roomSettings.listThisSpaceInTheServerDirectory":
        "Référencer cet espace dans l'annuaire du serveur",
    "roomSettings.listsTheRoomByIdBeingFound":
        "Référence le salon par son identifiant. Pour être trouvé par son nom, il faut aussi une adresse publiée - ajoutez-en une ci-dessous.",
    "roomSettings.listsTheSpaceByIdBeingFound":
        "Référence l'espace par son identifiant. Pour être trouvé par son nom, il faut aussi une adresse publiée - ajoutez-en une ci-dessous.",
    "roomSettings.aPublishedAddressLetsPeopleFindRoom":
        "Une adresse publiée permet de trouver et rejoindre ce salon par son nom plutôt que par son identifiant.",
    "roomSettings.aPublishedAddressLetsPeopleFindSpace":
        "Une adresse publiée permet de trouver et rejoindre cet espace par son nom plutôt que par son identifiant.",
    "roomSettings.chooseHowThisRoomNotifiesYou":
        "Choisissez comment ce salon vous notifie.",
    "roomSettings.chooseHowThisSpaceNotifiesYou":
        "Choisissez comment cet espace vous notifie.",

    // src/lib/components/layout/ScreenSharePicker.svelte
    "screenSharePicker.chooseWhatToShare":
        "Choisissez ce que vous voulez partager",
    "screenSharePicker.noPreview": "Aucun aperçu",

    // src/lib/components/layout/ScreenShareQualityChips.svelte
    "screenShareQualityChips.resolution": "Résolution",
    "screenShareQualityChips.frameRate": "Fréquence d'images",
    "screenShareQualityChips.fps": "{f} i/s",
    "screenShareQualityChips.shareSystemAudio": "Partager le son du système",
    "screenShareQualityChips.appliesToNextShare":
        "S'applique au prochain partage",
    "screenShareQualityChips.shareSystemAudioAppliesToNext":
        "Partager le son du système (s'applique au prochain partage)",

    // src/lib/components/layout/ScreenShareQualityPopover.svelte
    "screenShareQualityPopover.goLive": "Passer en direct",
    "screenShareQualityPopover.screenShareQuality":
        "Qualité du partage d'écran",

    // src/lib/components/settings/SecuritySettings.svelte
    "securitySettings.showingTheLastReadingThatLoaded":
        "Affichage de la dernière lecture chargée - elle peut être obsolète.",
    "securitySettings.securityEncryption": "Sécurité et chiffrement",
    "securitySettings.setUpRecoverySoYourCross":
        "Configurez la récupération pour que votre identité de signature croisée et l'historique de vos messages chiffrés survivent à une déconnexion sur tous vos appareils.",
    "securitySettings.verification": "Vérification",
    "securitySettings.loadingEncryptionStatus":
        "Chargement de l'état du chiffrement…",
    "securitySettings.encryptionStatusUnknownOnThisSession":
        "État du chiffrement inconnu dans cette session.",
    "securitySettings.recoveryKeyId": "ID de la clé de récupération :",
    "securitySettings.setUpRecovery": "Configurer la récupération",
    "securitySettings.approveOnAccountPageHint":
        "Votre serveur peut vous demander d'approuver cette action sur la page de votre compte.",
    "securitySettings.approveOnAccountPage":
        "Approuver sur la page de votre compte",
    "securitySettings.approveOnAccountPageBody":
        "Votre serveur doit autoriser ce changement. Ouvrez la page de votre compte, approuvez la réinitialisation de votre identité cryptographique, puis revenez continuer.",
    "securitySettings.approveOnAccountPageRetry":
        "Le serveur n'a pas encore reçu l'approbation. Approuvez-la sur la page de votre compte, puis continuez.",
    "securitySettings.openAccountPage": "Ouvrir la page du compte",
    "securitySettings.iVeApprovedIt": "J'ai approuvé",
    "securitySettings.weLlCreateA": "Nous allons créer une",
    "securitySettings.recoveryKey": "clé de récupération",
    "securitySettings.aOneTimeCodeThatUnlocks":
        "- un code unique qui déverrouille votre historique chiffré et vérifie les nouvelles sessions. Conservez-le en lieu sûr, par exemple dans un gestionnaire de mots de passe ; il n'est affiché qu'une fois et nous ne pouvons pas le récupérer pour vous.",
    "securitySettings.confirmYourAccountPasswordToCreate":
        "Confirmez le mot de passe de votre compte pour créer vos clés de chiffrement.",
    "securitySettings.accountPassword": "Mot de passe du compte",
    "securitySettings.alsoLetMeUnlockWithA":
        "Me permettre aussi de déverrouiller avec une phrase secrète de mon choix (facultatif - votre clé de récupération fonctionne toujours et reste affichée).",
    "securitySettings.recoveryPassphrase": "Phrase secrète de récupération",
    "securitySettings.atLeastCharactersWeCanT":
        "Au moins {MIN_PASSPHRASE_LENGTH} caractères. Nous ne pouvons pas la réinitialiser pour vous.",
    "securitySettings.settingUp": "Configuration…",
    "securitySettings.continue": "Continuer",
    "securitySettings.saveYourRecoveryKey":
        "Enregistrez votre clé de récupération",
    "securitySettings.thisIsShown": "Elle est affichée",
    "securitySettings.onlyOnce": "une seule fois",
    "securitySettings.storeItNowWithoutItYou":
        ". Conservez-la maintenant - sans elle, vous ne pourrez pas récupérer votre historique chiffré si vous perdez l'accès à vos sessions.",
    "securitySettings.copied": "Copié ✓",
    "securitySettings.copyKey": "Copier la clé",
    "securitySettings.youCanAlsoUnlockWithThe":
        "Vous pouvez aussi déverrouiller avec la phrase secrète choisie. Gardez quand même la clé - c'est le seul moyen d'accès si vous oubliez la phrase secrète.",
    "securitySettings.iVeSavedMyRecoveryKey":
        "J'ai conservé ma clé de récupération en lieu sûr.",
    "securitySettings.done": "Terminé",
    "securitySettings.recoveryIsSetUp": "La récupération est configurée",
    "securitySettings.yourCrossSigningKeysAndA":
        "Vos clés de signature croisée et une sauvegarde des clés sont stockées en sécurité sur le serveur, protégées par votre clé de récupération.",
    "securitySettings.recoveryIsNotSetUp":
        "La récupération n'est pas configurée",
    "securitySettings.thisAccountHasNoRecoveryKey":
        "Ce compte n'a ni clé de récupération ni sauvegarde des clés tant que vous n'avez pas terminé l'étape ci-dessous.",
    "securitySettings.lostYourRecoveryKeyResetRecovery":
        "Clé de récupération perdue ? Réinitialiser la récupération",
    "securitySettings.resettingCreatesA": "La réinitialisation crée une",
    "securitySettings.new": "nouvelle",
    "securitySettings.recoveryKeyAndReplacesYourCurrent":
        "clé de récupération et remplace votre sauvegarde actuelle. Votre ancienne clé cesse de fonctionner et les autres sessions devront peut-être être revérifiées. Ne le faites que si vous avez perdu votre clé actuelle.",
    "securitySettings.yourOldRecoveryKeyAndBackup":
        "Votre ancienne clé de récupération et votre sauvegarde ont été réinitialisées, mais la nouvelle récupération n'a pas été créée. Terminez la configuration maintenant - vos messages ne pourront pas être récupérés sur une nouvelle session tant que ce ne sera pas fait.",
    "securitySettings.working": "En cours…",
    "securitySettings.finishSettingUpRecovery":
        "Terminer la configuration de la récupération",
    "securitySettings.confirmYourAccountPasswordToReset":
        "Confirmez le mot de passe de votre compte pour réinitialiser la récupération.",
    "securitySettings.resetting": "Réinitialisation…",
    "securitySettings.resetCreateNewKey":
        "Réinitialiser et créer une nouvelle clé",
    "securitySettings.messageHistoryBackup":
        "Sauvegarde de l'historique des messages",
    "securitySettings.verifyThisSessionRestoreHistory":
        "Vérifier cette session et restaurer l'historique",
    "securitySettings.recoveryKey2": "Clé de récupération",
    "securitySettings.passphrase": "Phrase secrète",
    "securitySettings.enterYour": "Saisissez votre",
    "securitySettings.recoveryPassphrase2": "phrase secrète de récupération",
    "securitySettings.toVerifyThisSessionAndRestore":
        "pour vérifier cette session et restaurer l'historique de vos messages chiffrés.",
    "securitySettings.thisSessionIsNowVerified":
        "Cette session est maintenant vérifiée",
    "securitySettings.encryptedHistoryRestored": "Historique chiffré restauré",
    "securitySettings.couldNotSetUpRecovery":
        "Impossible de configurer la récupération",
    "securitySettings.couldNotResetRecovery":
        "Impossible de réinitialiser la récupération",
    "securitySettings.couldNotFinishSettingUpRecovery":
        "Impossible de terminer la configuration de la récupération",
    "securitySettings.couldNotVerifyThisSession":
        "Impossible de vérifier cette session",

    // src/lib/components/settings/ServerSettings.svelte
    "serverSettings.scanningServer": "Analyse du serveur…",
    "serverSettings.what": "Ce que",
    "serverSettings.advertisesItemsMarkedUnknownArenT":
        "annonce. Les éléments marqués « Inconnu » ne sont pas annoncés par le serveur et ne sont détectés qu'à l'usage.",
    "serverSettings.accountMessaging": "Compte et messagerie",
    "serverSettings.voiceVideoCallingMatrixrtc":
        "Appels vocaux / vidéo (MatrixRTC)",
    "serverSettings.server": "Serveur",
    "serverSettings.latestSpecVersion": "Dernière version de la spécification",
    "serverSettings.defaultRoomVersion": "Version de salon par défaut",
    "serverSettings.advertisedFeatures": "Fonctionnalités annoncées ({length})",
    "serverSettings.supported": "Pris en charge",
    "serverSettings.notSupported": "Non pris en charge",
    "serverSettings.unknown": "Inconnu",
    "serverSettings.changePassword": "Changer le mot de passe",
    "serverSettings.changeDisplayName": "Changer le nom d'affichage",
    "serverSettings.changeAvatar": "Changer d'avatar",
    "serverSettings.manageEmailsPhoneNumbers":
        "Gérer e-mails / numéros de téléphone",
    "serverSettings.threads": "Fils de discussion",
    "serverSettings.privateReadReceipts": "Accusés de lecture privés",
    "serverSettings.sfuDiscoveryRtcFoci": "Découverte SFU (rtc_foci)",
    "serverSettings.delayedEventsCallCleanup":
        "Événements différés (nettoyage des appels)",
    "serverSettings.failedToReadServerCapabilities":
        "Impossible de lire les capacités du serveur",

    // src/lib/components/settings/SessionSettings.svelte
    "sessionSettings.sessionName": "Nom de la session",
    "sessionSettings.current": "Actuelle",
    "sessionSettings.rename": "Renommer",
    "sessionSettings.signOut": "Déconnecter ?",
    "sessionSettings.signOut2": "Déconnecter",
    "sessionSettings.manageAtProvider": "Gérer",
    "sessionSettings.confirmYourAccountPasswordToSign":
        "Confirmez le mot de passe de votre compte pour déconnecter cette session.",
    "sessionSettings.accountPassword": "Mot de passe du compte",
    "sessionSettings.signingOut": "Déconnexion…",
    "sessionSettings.encryption": "Chiffrement",
    "sessionSettings.active": "Active",
    "sessionSettings.unavailable": "Indisponible",
    "sessionSettings.thisDeviceSKey": "Clé de cet appareil",
    "sessionSettings.loadingDeviceKey": "Chargement de la clé de l'appareil…",
    "sessionSettings.endToEndEncryptionCouldNot":
        "Le chiffrement de bout en bout n'a pas pu démarrer dans cette session. Les salons chiffrés afficheront des espaces réservés.",
    "sessionSettings.encryptNewDirectMessages":
        "Chiffrer les nouveaux messages directs",
    "sessionSettings.newDmsYouStartAreEncrypted":
        "Les nouveaux messages directs que vous démarrez sont chiffrés par défaut. Les messages directs existants ne changent pas. Désactivez ceci si vous écrivez à des personnes dont le client ne prend pas en charge le chiffrement.",
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
        "Only share message keys with, and only show messages from, devices their owner has cross-signed (MSC4153). Messages from devices that are not cross-signed will show as unable to decrypt.",
    "sessionSettings.onlySendToVerifiedDevices":
        "N'envoyer qu'aux appareils vérifiés",
    "sessionSettings.refuseToEncryptMessagesForSessions":
        "Refuser de chiffrer les messages pour les sessions que vous n'avez pas vérifiées. Elles ne recevront pas du tout vos messages - y compris vos propres sessions non vérifiées. Désactivé par défaut.",
    "sessionSettings.devicesCurrentlySignedInToThis":
        "Appareils actuellement connectés à ce compte.",
    "sessionSettings.refreshing": "Actualisation…",
    "sessionSettings.refresh": "Actualiser",
    "sessionSettings.loadingSessions": "Chargement des sessions…",
    "sessionSettings.otherSessions": "Autres sessions {value}",
    "sessionSettings.noOtherSessionsYouReOnly":
        "Aucune autre session - vous n'êtes connecté qu'ici.",
    "sessionSettings.failedToLoadSessions":
        "Impossible de charger les sessions",
    "sessionSettings.failedToRenameSession":
        "Impossible de renommer la session",
    "sessionSettings.failedToSignOutSession":
        "Impossible de déconnecter la session",
    "sessionSettings.couldNotStartVerification":
        "Impossible de démarrer la vérification",

    // src/lib/components/messages/ShareLocationDialog.svelte
    "shareLocationDialog.shareLocation": "Partager la position",
    "shareLocationDialog.sendOnce": "Envoyer une fois",
    "shareLocationDialog.shareLive": "Partager en direct",
    "shareLocationDialog.locating": "Localisation…",
    "shareLocationDialog.useMyCurrentLocation": "Utiliser ma position actuelle",
    "shareLocationDialog.descriptionOptional": "Description (facultatif)",
    "shareLocationDialog.eGHomeTheCafOn": "ex. Maison, le café de la rue…",
    "shareLocationDialog.duration": "Durée",
    "shareLocationDialog.yourLiveLocationIsSharedWith":
        "Votre position en direct est partagée avec ce salon jusqu'à ce que vous arrêtiez ou que le minuteur expire.",
    "shareLocationDialog.sharing": "Partage…",
    "shareLocationDialog.share": "Partager",
    "shareLocationDialog.failedToStartLiveLocation":
        "Impossible de démarrer la position en direct",
    "shareLocationDialog.failedToShareLocation":
        "Impossible de partager la position",

    // src/lib/components/messages/ShareTargetSheet.svelte
    "shareTargetSheet.fileSWerenTAddedShares":
        "{droppedFiles} fichier(s) n'ont pas été ajoutés. Les partages sont limités à {SHARE_MAX_FILES} fichiers, {value} Mo chacun et {value2} Mo au total.",
    "shareTargetSheet.addAMessage": "Ajouter un message…",
    "shareTargetSheet.searchRooms": "Rechercher des salons",
    "shareTargetSheet.noJoinedRoomsFound": "Aucun salon rejoint trouvé",
    "shareTargetSheet.send": "Envoyer",
    "shareTargetSheet.shareToARoom": "Partager dans un salon",

    // src/lib/components/layout/SpaceLandingPanel.svelte
    "spaceLandingPanel.loadingRooms": "Chargement des salons…",
    "spaceLandingPanel.browseRooms": "Parcourir les salons",
    "spaceLandingPanel.youHavenTJoinedARoom":
        "Vous n'avez encore rejoint aucun salon dans {spaceName}. Choisissez-en un pour commencer.",
    "spaceLandingPanel.nothingJoinedHereYet":
        "Rien de rejoint ici pour l'instant",
    "spaceLandingPanel.onlyOtherSpacesLiveInsideOpen":
        "{spaceName} ne contient que d'autres espaces ; ouvrez-en un depuis la liste des salons pour parcourir ses salons.",
    "spaceLandingPanel.thereAreNoRoomsInYet":
        "Il n'y a encore aucun salon dans {spaceName}.",
    "spaceLandingPanel.thisSpace": "cet espace",
    "spaceLandingPanel.couldnTJoinTryItFrom":
        "Impossible de rejoindre {value}. Essayez depuis Parcourir les salons dans la liste des salons.",
    "spaceLandingPanel.thatRoom": "ce salon",

    // src/lib/components/layout/SpaceSidebar.svelte
    "spaceSidebar.home": "Accueil",
    "spaceSidebar.addASpace": "Ajouter un espace",
    "spaceSidebar.exploreRooms": "Explorer les salons",
    "spaceSidebar.folderColor": "Couleur du dossier",
    "spaceSidebar.createRoomInSpace": "Créer un salon dans l'espace",
    "spaceSidebar.roomName": "Nom du salon",
    "spaceSidebar.myRoom": "mon-salon",
    "spaceSidebar.optional": "(facultatif)",
    "spaceSidebar.whatSThisRoomAbout": "De quoi parle ce salon ?",
    "spaceSidebar.opensStraightIntoACallMessages":
        "S'ouvre directement sur un appel. Les messages fonctionnent toujours.",
    "spaceSidebar.create": "Créer",
    "spaceSidebar.addExistingRoomToSpace":
        "Ajouter un salon existant à l'espace",
    "spaceSidebar.noRoomsAvailableToAdd": "Aucun salon disponible à ajouter.",
    "spaceSidebar.spaceSettings": "Paramètres de l'espace",
    "spaceSidebar.copySpaceLink": "Copier le lien de l'espace",
    "spaceSidebar.markAsRead": "Marquer comme lu",
    "spaceSidebar.createRoom": "Créer un salon",
    "spaceSidebar.addExistingRoom": "Ajouter un salon existant",
    "spaceSidebar.removeFromFolder": "Retirer du dossier",
    "spaceSidebar.newFolder": "Nouveau dossier",
    "spaceSidebar.clickAgainToLeave": "Cliquez à nouveau pour quitter",
    "spaceSidebar.leaveSpace": "Quitter l'espace",
    "spaceSidebar.setColor": "Définir la couleur",
    "spaceSidebar.dissolveFolder": "Dissoudre le dossier",
    "spaceSidebar.somethingWentWrong": "Une erreur s'est produite",

    // src/lib/components/layout/Splash.svelte
    "splash.restoringSession": "Restauration de la session…",

    // src/lib/components/ui/StickerPicker.svelte
    "stickerPicker.searchStickers": "Rechercher des stickers…",
    "stickerPicker.searchStickers2": "Rechercher des stickers",
    "stickerPicker.noStickerPacksAvailable":
        "Aucun pack de stickers disponible",
    "stickerPicker.myStickers": "Mes stickers",
    "stickerPicker.myStickers2": "Mes stickers",

    // src/lib/components/ui/SwfEmbed.svelte
    "swfEmbed.adobeFlash": "Adobe Flash",

    // src/lib/components/settings/ThemeColorEditor.svelte
    "themeColorEditor.themeColors": "Couleurs du thème",
    "themeColorEditor.presetName": "Nom du préréglage",
    "themeColorEditor.savePreset": "Enregistrer le préréglage",
    "themeColorEditor.import": "Importer",
    "themeColorEditor.pasteThemeCode": "Coller le code du thème",
    "themeColorEditor.copyCurrentPresetToClipboard":
        "Copier le préréglage actuel dans le presse-papiers",
    "themeColorEditor.copied": "Copié !",
    "themeColorEditor.presets": "Préréglages",
    "themeColorEditor.delete": "Supprimer ?",
    "themeColorEditor.confirmDelete": "Confirmer la suppression de {name}",
    "themeColorEditor.rename": "Renommer",
    "themeColorEditor.delete2": "Supprimer {name}",
    "themeColorEditor.builtInPresetsAreReadOnly":
        "Les préréglages intégrés sont en lecture seule. Dupliquez-les pour les personnaliser :",
    "themeColorEditor.duplicateToCustomize": "Dupliquer pour personnaliser",
    "themeColorEditor.colors": "Couleurs",
    "themeColorEditor.backgrounds": "Arrière-plans",
    "themeColorEditor.resetToDefault": "Rétablir par défaut",
    "themeColorEditor.text": "Texte",
    "themeColorEditor.accentsSemantics": "Accents et sémantique",
    "themeColorEditor.presence": "Présence",
    "themeColorEditor.details": "Détails",
    "themeColorEditor.contrastWarnings": "Avertissements de contraste",
    "themeColorEditor.messageDisplay": "Affichage des messages",
    "themeColorEditor.savedOnThisDeviceOnlyNot":
        "Enregistré sur cet appareil uniquement. Non synchronisé avec votre compte.",
    "themeColorEditor.appTextSize": "Taille du texte : {round} %",
    "themeColorEditor.scalesAllTextAndSpacingAcross":
        "Ajuste la taille de tout le texte et des espacements de l'application.",
    "themeColorEditor.font": "Police",
    "themeColorEditor.custom": "Personnalisée - {customFontName}",
    "themeColorEditor.replaceCustomFont": "Remplacer la police personnalisée…",
    "themeColorEditor.uploadCustomFont": "Importer une police personnalisée…",
    "themeColorEditor.woff2TtfOrOtfUpTo":
        ".woff2, .ttf ou .otf jusqu'à 10 Mo. Stockée sur cet appareil uniquement.",
    "themeColorEditor.theQuickBrownFoxJumpsOver":
        "Portez ce vieux whisky au juge blond qui fume.",
    "themeColorEditor.cannotSavePreset":
        "Impossible d'enregistrer le préréglage",
    "themeColorEditor.notAValidThemeCode": "Code de thème invalide",
    "themeColorEditor.imported": "Importé",
    "themeColorEditor.cannotImportPreset":
        "Impossible d'importer le préréglage",
    "themeColorEditor.copy": "{activePresetName} (copie)",

    // src/lib/components/layout/ThreadPanel.svelte
    "threadPanel.thread": "Fil",
    "threadPanel.collapseThread": "Réduire le fil",
    "threadPanel.expandThread": "Développer le fil",
    "threadPanel.closeThread": "Fermer le fil",
    "threadPanel.noRepliesYetStartTheThread":
        "Aucune réponse pour l'instant. Lancez le fil ci-dessous.",
    "threadPanel.loadOlderReplies": "Charger les réponses plus anciennes",

    // src/lib/components/layout/ThreadsListPanel.svelte
    "threadsListPanel.threads": "Fils",
    "threadsListPanel.closeThreadsPanel": "Fermer le panneau des fils",
    "threadsListPanel.noThreadsInThisRoomYet":
        "Aucun fil dans ce salon pour l'instant.",
    "threadsListPanel.youParticipated": "Vous avez participé",
    "threadsListPanel.unreadMentions": "Mentions non lues",
    "threadsListPanel.unreadReplies": "Réponses non lues",
    "threadsListPanel.couldnTLoadThreadsForThis":
        "Impossible de charger les fils de ce salon.",
    "threadsListPanel.unknownSender": "Inconnu",
    "threadsListPanel.allThreads": "Tous les fils",
    "threadsListPanel.myThreads": "Mes fils",
    "threadsListPanel.filterThreads": "Filtrer les fils",
    "threadsListPanel.noThreadsYouParticipatedIn":
        "Vous n'avez lancé ni répondu à aucun fil ici.",

    // src/lib/components/layout/UpdateBanner.svelte
    "updateBanner.dismissUpdateNotification":
        "Ignorer la notification de mise à jour",
    "updateBanner.installFailed": "Échec de l'installation",

    // src/lib/components/ui/UserPicker.svelte
    "userPicker.remove": "Retirer {userId}",
    "userPicker.searching": "Recherche…",
    "userPicker.noMatchingUsers": "Aucun utilisateur correspondant",
    "userPicker.available":
        "{optionCount, plural, one {# résultat disponible} other {# résultats disponibles}}",
    "userPicker.invite": "Inviter {candidateShown}",
    "userPicker.alreadyAdded": "Déjà ajouté",
    "userPicker.alreadyInThisRoom": "Déjà dans ce salon",
    "userPicker.sendAnInviteToThisExact":
        "Envoyer une invitation à cet identifiant exact",
    "userPicker.noMatchesTypeAFullUser":
        "Aucune correspondance. Saisissez un identifiant complet comme",
    "userPicker.userServer": "@user:server",
    "userPicker.toInviteSomeoneTheDirectoryDoesn":
        "pour inviter quelqu'un que l'annuaire ne liste pas.",
    "userPicker.searchForPeople": "Rechercher des personnes…",
    "userPicker.userSearchFailedYouCanStill":
        "Échec de la recherche d'utilisateurs - vous pouvez quand même saisir un identifiant complet.",

    // src/lib/components/ui/UserProfileCard.svelte
    "userProfileCard.copyUserId": "Copier l'identifiant",
    "userProfileCard.copied": "Copié",
    "userProfileCard.localTime": "{localTime} heure locale ({timezone})",
    "userProfileCard.notAMemberOfThisRoom": "N'est pas membre de ce salon",
    "userProfileCard.mutualRooms": "Salons en commun : {total}",
    "userProfileCard.more": "+{moreCount} autres",
    "userProfileCard.opening": "Ouverture…",
    "userProfileCard.message": "Message",
    "userProfileCard.verifyUser": "Vérifier l'utilisateur",
    "userProfileCard.kicking": "Expulsion…",
    "userProfileCard.confirmKick": "Confirmer l'expulsion ?",
    "userProfileCard.kick": "Expulser",
    "userProfileCard.banning": "Bannissement…",
    "userProfileCard.confirmBan": "Confirmer le bannissement ?",
    "userProfileCard.ban": "Bannir",
    "userProfileCard.couldNotStartVerification":
        "Impossible de démarrer la vérification",
    "userProfileCard.couldNotCopyToClipboard":
        "Impossible de copier dans le presse-papiers",
    "userProfileCard.couldNotOpenDm": "Impossible d'ouvrir le message direct",
    "userProfileCard.couldNotKick": "Impossible d'expulser",
    "userProfileCard.couldNotBan": "Impossible de bannir",

    // src/lib/components/layout/VerificationModal.svelte
    "verificationModal.thisSessionIsNowTrusted":
        "Cette session est maintenant de confiance.",
    "verificationModal.theirIdentityIsNowVerified":
        "Son identité est maintenant vérifiée.",
    "verificationModal.noTrustWasEstablishedYouCan":
        "Aucune confiance n'a été établie. Vous pouvez recommencer à tout moment.",
    "verificationModal.didYourOtherSessionJustScan":
        "Votre autre session vient-elle de scanner ce code ?",
    "verificationModal.didJustScanThisCode":
        "{otherUserId} vient-il de scanner ce code ?",
    "verificationModal.onlyConfirmIfYouScannedIt":
        "Ne confirmez que si vous l'avez scanné vous-même, à l'instant.",
    "verificationModal.onlyConfirmIfYouWatchedThem":
        "Ne confirmez que si vous l'avez vu le scanner, à l'instant.",
    "verificationModal.no": "Non",
    "verificationModal.yesIScannedIt": "Oui, je l'ai scanné",
    "verificationModal.deviceWithThisUser": "l'appareil de cet utilisateur",
    "verificationModal.confirmTheSameEmojiAppearIn":
        "Confirmez que les mêmes émojis apparaissent, dans le même ordre, sur {value}.",
    "verificationModal.theyDonTMatch": "Ils ne correspondent pas",
    "verificationModal.confirming": "Confirmation…",
    "verificationModal.theyMatch": "Ils correspondent",
    "verificationModal.verificationCodeForYourOtherSession":
        "Code de vérification pour votre autre session",
    "verificationModal.verificationCodeFor":
        "Code de vérification pour {otherUserId}",
    "verificationModal.scanThisWithYourOtherSession":
        "Scannez-le avec votre autre session.",
    "verificationModal.askThemToScanThisCode":
        "Demandez-lui de scanner ce code.",
    "verificationModal.noCodeToShowRightNow":
        "Aucun code à afficher pour l'instant.",
    "verificationModal.couldNotLoadTheScanner":
        "Impossible de charger le scanner.",
    "verificationModal.scanAgain": "Scanner à nouveau",
    "verificationModal.compareAShortListOfEmoji":
        "Comparez une courte liste d'émojis pour vérifier, ou utilisez un code QR.",
    "verificationModal.compareEmoji": "Comparer les émojis",
    "verificationModal.showACodeForTheOther":
        "Afficher un code à scanner par l'autre partie",
    "verificationModal.scanTheirCodeWithTheCamera":
        "Scanner son code avec la caméra",
    "verificationModal.chooseADifferentMethod": "Choisir une autre méthode",
    "verificationModal.waitingForTheOtherSideTo":
        "En attente de la confirmation de l'autre partie…",
    "verificationModal.verifyYourOtherSession": "Vérifier votre autre session",
    "verificationModal.verify": "Vérifier {value}",
    "verificationModal.couldNotConfirmTheMatch":
        "Impossible de confirmer la correspondance",
    "verificationModal.couldNotReportTheMismatch":
        "Impossible de signaler la non-correspondance",
    "verificationModal.session": "votre autre session",

    // src/lib/components/layout/VideoTile.svelte
    "videoTile.fullscreen": "Plein écran",

    // src/lib/components/settings/VoiceAudioSettings.svelte
    "voiceAudioSettings.inputDevice": "Périphérique d'entrée",
    "voiceAudioSettings.savedMicrophoneNotFoundUsingThe":
        "Micro enregistré introuvable - utilisation du micro par défaut jusqu'à son retour.",
    "voiceAudioSettings.microphoneLevel": "Niveau du micro",
    "voiceAudioSettings.stopTest": "Arrêter le test",
    "voiceAudioSettings.testMic": "Tester le micro",
    "voiceAudioSettings.outputDevice": "Périphérique de sortie",
    "voiceAudioSettings.chooseOutputDevice":
        "Choisir le périphérique de sortie…",
    "voiceAudioSettings.audioOutputIsRoutedByThe":
        "Sur cette plateforme, la sortie audio est gérée par le système d'exploitation.",
    "voiceAudioSettings.testSpeaker": "Tester le haut-parleur",
    "voiceAudioSettings.callVolume": "Volume des appels",
    "voiceAudioSettings.incomingCallAudio": "Audio des appels entrants",
    "voiceAudioSettings.incomingCallAudioIfThisMoves":
        "Audio des appels entrants - si cela bouge mais que vous n'entendez rien, vérifiez le périphérique de sortie choisi et le volume du système.",
    "voiceAudioSettings.voiceProcessing": "Traitement de la voix",
    "voiceAudioSettings.noiseSuppression": "Suppression du bruit",
    "voiceAudioSettings.echoCancellation": "Annulation de l'écho",
    "voiceAudioSettings.autoGainControl": "Contrôle automatique du gain",
    "voiceAudioSettings.camera": "Caméra",
    "voiceAudioSettings.mirrorMyCamera": "Afficher ma caméra en miroir",
    "voiceAudioSettings.flipYourOwnPreviewOthersAlways":
        "Retourne votre propre aperçu. Les autres vous voient toujours sans effet miroir.",
    "voiceAudioSettings.stopPreview": "Arrêter l'aperçu",
    "voiceAudioSettings.preview": "Aperçu",
    "voiceAudioSettings.callSounds": "Sons des appels",
    "voiceAudioSettings.playCallSounds": "Jouer les sons des appels",
    "voiceAudioSettings.soundVolume": "Volume des sons",
    "voiceAudioSettings.ringing": "Sonnerie",
    "voiceAudioSettings.ringForIncomingDmCalls":
        "Sonner pour les appels entrants en message direct",
    "voiceAudioSettings.directMessagesRingRoomsNeverDo":
        "Les messages directs sonnent. Les salons jamais - vous les rejoignez depuis le salon lui-même.",
    "voiceAudioSettings.ringtoneVolume": "Volume de la sonnerie",
    "voiceAudioSettings.fullScreenCalls":
        "Afficher les appels sur l'écran de verrouillage",
    "voiceAudioSettings.fullScreenCallsHint":
        "Permet à un appel privé entrant d'allumer l'écran et de sonner en plein écran, comme un appel téléphonique. Android le demande séparément.",
    "voiceAudioSettings.fullScreenCallsAllow": "Autoriser",
    "voiceAudioSettings.microphoneUnavailableCheckBrowserPermissions":
        "Micro indisponible - vérifiez les autorisations du navigateur",
    "voiceAudioSettings.cameraUnavailableCheckBrowserPermissions":
        "Caméra indisponible - vérifiez les autorisations du navigateur",

    // src/lib/components/layout/VoiceCallPanel.svelte
    "voiceCallPanel.enableAudio": "Activer l'audio",
    "voiceCallPanel.openCallView": "Ouvrir la vue de l'appel",
    "voiceCallPanel.unmute": "Réactiver le micro",
    "voiceCallPanel.undeafen": "Réactiver le son",
    "voiceCallPanel.deafen": "Couper le son",
    "voiceCallPanel.disconnect": "Se déconnecter",

    // src/lib/components/messages/VoiceMessagePlayer.svelte
    "voiceMessagePlayer.seek": "Avancer",
    "voiceMessagePlayer.voiceMessage": "Message vocal",

    // src/lib/components/messages/VoiceRecorder.svelte
    "voiceRecorder.cancelRecording": "Annuler l'enregistrement",
    "voiceRecorder.stop": "Arrêter",
    "voiceRecorder.discard": "Supprimer",
    "voiceRecorder.discardRecording": "Supprimer l'enregistrement",
    "voiceRecorder.voiceMessage": "Message vocal",
    "voiceRecorder.sending": "Envoi…",
    "voiceRecorder.send": "Envoyer",
    "voiceRecorder.microphoneAccessWasDenied": "L'accès au micro a été refusé.",
    "voiceRecorder.recordingFailed": "Échec de l'enregistrement.",
    "voiceRecorder.nothingWasRecorded": "Rien n'a été enregistré.",
    "voiceRecorder.failedToSendVoiceMessage":
        "Impossible d'envoyer le message vocal",

    // src/lib/components/settings/WhatsNew.svelte
    "whatsNew.whatSNew": "Nouveautés",
    "whatsNew.loadingReleaseNotes": "Chargement des notes de version…",
    "whatsNew.releaseNotesUnavailable": "Notes de version indisponibles.",
    "whatsNew.viewOnGithub": "Voir sur GitHub",

    // src/lib/components/layout/WhatsNewModal.svelte
    "whatsNewModal.whatSNew": "Nouveautés",
    "whatsNewModal.whatSNewInV": "Nouveautés de la v{APP_VERSION}",
    "whatsNewModal.releaseNotesUnavailable": "Notes de version indisponibles.",
    "whatsNewModal.viewOnGithub": "Voir sur GitHub",
    "whatsNewModal.gotIt": "Compris",

    // src/lib/components/layout/VerificationRequestCard.svelte
    "verificationRequestCard.verifyYourOtherSession":
        "Vérifier votre autre session",
    "verificationRequestCard.verificationRequest": "Demande de vérification",
    "verificationRequestCard.anotherOfYourSessions":
        "Une autre de vos sessions",

    // src/lib/components/messages/CallEventCard.svelte
    "callEventCard.missedCall": "Appel manqué",
    "callEventCard.ongoingCall": "Appel en cours",
    "callEventCard.callEnded": "Appel terminé",

    // src/lib/components/messages/ComposerActionsMenu.svelte
    "composerActionsMenu.uploadAFile": "Envoyer un fichier",
    "composerActionsMenu.createPoll": "Créer un sondage",
    "composerActionsMenu.recordVoiceMessage": "Enregistrer un message vocal",
    "composerActionsMenu.shareLocation": "Partager la position",
    "composerActionsMenu.createThread": "Créer un fil",

    // src/lib/components/messages/Reactions.svelte
    "reactions.couldNotAddReaction": "Impossible d'ajouter la réaction",

    // src/lib/components/ui/QrScanner.svelte
    "qrScanner.startingTheCamera": "Démarrage de la caméra…",
    "qrScanner.cameraAccessWasDenied": "L'accès à la caméra a été refusé.",
    "qrScanner.noCameraWasFoundOnThis":
        "Aucune caméra n'a été trouvée sur cet appareil.",
    "qrScanner.theCameraIsAlreadyInUse":
        "La caméra est déjà utilisée par une autre application.",
    "qrScanner.couldNotOpenTheCameraA":
        "Impossible d'ouvrir la caméra. Une connexion sécurisée (https) est nécessaire.",
    "qrScanner.codeFoundCheckingIt": "Code trouvé - vérification…",
    "qrScanner.couldNotStartVerificationWithThat":
        "Impossible de démarrer la vérification avec ce code.",
    "qrScanner.thatIsnTAVerificationCode":
        "Ce n'est pas un code de vérification.",
    "qrScanner.thisDeviceHasNoCameraAvailable":
        "Cet appareil n'a pas de caméra disponible.",
    "qrScanner.couldNotStartTheCameraPreview":
        "Impossible de démarrer l'aperçu de la caméra.",
    "qrScanner.pointTheCameraAtTheirCode": "Pointez la caméra vers son code.",

    // src/lib/desktopContextMenu.ts
    "desktopContextMenu.failedToSaveImage": "Impossible d'enregistrer l'image",

    // src/lib/matrix/client.ts
    "client.serverAutoDiscoveryFailedUsingThe":
        "Échec de la découverte automatique du serveur - utilisation de l'adresse saisie",
    "client.discoveredHomeserverFailedValidation":
        "Le serveur d'accueil découvert n'a pas passé la validation",
    "client.thisHomeserverDoesnTSupportSliding":
        "Ce serveur d'accueil ne prend pas en charge la synchronisation glissante ; la synchronisation classique est utilisée.",
    "client.notLoggedIn": "Non connecté",
    "client.oauthProviderChanged":
        "Le fournisseur de connexion du serveur a changé. Veuillez réessayer.",
    "client.thisEventTypeCannotBeForwarded":
        "Ce type d'événement ne peut pas être transféré",
    "client.notConnected": "Non connecté",
    "client.thisServerDoesNotAllowSigning":
        "Ce serveur ne permet pas de déconnecter des sessions avec un mot de passe - utilisez plutôt sa page de compte.",
    "client.incorrectPassword": "Mot de passe incorrect",
    "client.thisServerDoesNotAllowConfirming":
        "Ce serveur ne permet pas de confirmer cette action avec un mot de passe - utilisez plutôt sa page de compte.",
    "client.directMessages": "Messages directs",
    "client.messagesInDirectMessageRooms":
        "Messages dans les conversations privées",
    "client.rooms": "Salons",
    "client.messagesInAllOtherRooms": "Messages dans tous les autres salons",
    "client.fullMatrixIdMentions": "Mentions de l'identifiant Matrix complet",
    "client.messagesUsingYourFullUserHomeserver":
        "Messages utilisant votre identifiant complet @user:homeserver",
    "client.displayNameMentions": "Mentions du nom d'affichage",
    "client.messagesContainingYourDisplayName":
        "Messages contenant votre nom d'affichage",
    "client.usernameMentions": "Mentions du nom d'utilisateur",
    "client.messagesContainingYourUsernameWithoutServer":
        "Messages contenant votre nom d'utilisateur (sans le serveur)",
    "client.roomMentions": "Mentions @room",
    "client.messagesUsingRoomToNotifyEveryone":
        "Messages utilisant @room pour notifier tout le monde",
    "client.invitations": "Invitations",
    "client.whenYouAreInvitedToA": "Quand vous êtes invité dans un salon",
    "client.thisRoom": "ce salon",
    "client.keywordCannotStartWith":
        "Un mot-clé ne peut pas commencer par « . »",
    "client.emotes": "Émotes de {value}",
    "client.room": "Salon",
    "client.emojis": "Émojis",
    "client.enterAShortcode": "Saisissez un code court.",
    "client.useOnlyLettersNumbersDotsUnderscores":
        "Utilisez uniquement des lettres, chiffres, points, tirets bas, signes plus et tirets.",
    "client.chooseAtLeastOneUsage": "Choisissez au moins un usage.",
    "client.imageNotFound": "Image introuvable.",
    "client.invalidPowerLevels": "Niveaux de pouvoir invalides : {shapeError}",
    "client.roomCreatorsPowerLevelCannotBe":
        "Le niveau de pouvoir des créateurs du salon ne peut pas être défini dans les salons v12",
    "client.restrictedJoinRequiresAtLeastOne":
        "L'accès restreint nécessite au moins un espace parent",
    "client.orderMustBeAtMost50":
        "L'ordre doit comporter au plus 50 caractères ASCII imprimables (de l'espace à ~)",
    "client.cannotSetSuggestedOnASpace":
        "Impossible de suggérer un enfant d'espace sans « via »",
    "client.pollHasNoEventId": "Le sondage n'a pas d'identifiant d'événement",
    "client.unsupportedPoll": "Sondage non pris en charge",
    "client.youCanTCloseThisPoll": "Vous ne pouvez pas clôturer ce sondage",
    "client.microphoneDisconnectedSwitchedToTheDefault":
        "Micro déconnecté - passage au périphérique par défaut",
    "client.cameraDisconnected": "Caméra déconnectée",
    "client.unknownRoom": "Salon inconnu",
    "client.theServerRejectedItYouMay":
        "le serveur a refusé - vous n'avez peut-être pas l'autorisation de rejoindre les appels de ce salon",
    "client.callMembershipFailed":
        "Échec de la participation à l'appel : {detail}",
    "client.voiceServerRejectedTheJoin":
        "Le serveur vocal a refusé la connexion ({status})",
    "client.voiceCallDisconnected": "Appel vocal déconnecté",
    "client.couldNotReachCallServer":
        "Impossible de se connecter à {server}, certaines personnes de cet appel risquent de ne pas être entendues.",
    "client.yourMicrophoneAppearsSilentCheckYour":
        "Votre micro semble muet - vérifiez votre périphérique d'entrée",
    "client.audioDeviceError": "Erreur du périphérique audio : {message}",
    "client.couldnTSwitchToThatKept":
        "Impossible de changer de {what} - le précédent est conservé",
    "client.couldnTSwitchToThatUsing":
        "Impossible de changer de {what} - utilisation du périphérique par défaut",
    "client.couldnTSwitchToThatPick":
        "Impossible de changer de {what} - choisissez un autre périphérique",
    "client.couldNotStartScreenShare":
        "Impossible de démarrer le partage d'écran",
    "client.couldnTChangeScreenShareQuality":
        "Impossible de changer la qualité du partage d'écran",
    "client.couldNotStartTheCameraCheck":
        "Impossible de démarrer la caméra - vérifiez les autorisations",
    "client.couldnTApplyAudioProcessingChange":
        "Impossible d'appliquer la modification du traitement audio",
    "client.deviceNounMicrophone": "micro",
    "client.deviceNounCamera": "caméra",

    // src/lib/matrix/crypto.ts
    "crypto.couldNotStartTheEmojiCheck":
        "Impossible de démarrer la vérification par émojis",
    "crypto.couldNotCancelTheVerification":
        "Impossible d'annuler la vérification",
    "crypto.noCodeAvailableTheOtherSide":
        "Aucun code disponible - l'autre partie ne peut pas en scanner.",
    "crypto.couldNotGenerateAQrCode": "Impossible de générer un code QR",
    "crypto.thatCodeDoesnTMatchThis":
        "Ce code ne correspond pas à cette vérification",
    "crypto.couldNotConfirmTheQrMatch":
        "Impossible de confirmer la correspondance QR",
    "crypto.couldNotCancelTheQrMatch":
        "Impossible d'annuler la correspondance QR",
    "crypto.encryptionIsNotReadyOnThis":
        "Le chiffrement n'est pas prêt dans cette session",
    "crypto.accountApprovalCancelled":
        "L'approbation sur la page de votre compte a été annulée.",
    "crypto.accountPasswordRequired":
        "Ce serveur a besoin du mot de passe de votre compte pour confirmer cette action.",
    "crypto.thisServerCanTConfirmEncryption":
        "Ce serveur ne peut pas confirmer la configuration du chiffrement avec un mot de passe - utilisez plutôt sa page de compte.",
    "crypto.incorrectPassword": "Mot de passe incorrect",
    "crypto.failedToGenerateARecoveryKey":
        "Impossible de générer une clé de récupération",
    "crypto.yourOldRecoveryWasResetBut":
        "Votre ancienne récupération a été réinitialisée, mais la configuration de la nouvelle a échoué.",
    "crypto.thatKeyDoesnTMatchThis":
        "Cette clé ne correspond pas à la sauvegarde de ce compte sur le serveur.",
    "crypto.thatDoesnTLookLikeA":
        "Cela ne ressemble pas à une clé de récupération valide. Vérifiez les fautes de frappe et réessayez.",
    "crypto.thisAccountHasNoRecoverySet":
        "Ce compte n'a pas encore de récupération configurée. Configurez-la d'abord sur une session qui possède vos clés.",
    "crypto.thatRecoveryKeyDoesnTMatch":
        "Cette clé de récupération ne correspond pas à ce compte. Vérifiez les fautes de frappe et réessayez.",
    "crypto.thisAccountSRecoveryWasnT":
        "La récupération de ce compte n'a pas été configurée avec une phrase secrète. Utilisez plutôt votre clé de récupération.",
    "crypto.couldnTUseYourPassphraseOn":
        "Impossible d'utiliser votre phrase secrète sur cet appareil. Essayez plutôt votre clé de récupération.",
    "crypto.thatPassphraseDoesnTMatchThis":
        "Cette phrase secrète ne correspond pas à ce compte. Vérifiez les fautes de frappe et réessayez.",

    // src/lib/matrix/media.ts
    "media.notLoggedIn": "Non connecté",
    "media.failedToFetchAttachment":
        "Impossible de récupérer la pièce jointe : {status}",
    "media.encryptedAttachmentHasAnInvalidUrl":
        "La pièce jointe chiffrée a une URL invalide",
    "media.failedToFetchEncryptedAttachment":
        "Impossible de récupérer la pièce jointe chiffrée : {status}",

    // src/lib/matrix/pluginHost.ts
    "pluginHost.mediaWasUploadedByADifferent":
        "Le média a été envoyé par un autre compte",
    "pluginHost.notLoggedIn": "Non connecté",
    "pluginHost.notConnected": "Non connecté",

    // src/lib/matrix/runtime.ts
    "runtime.notLoggedIn": "Non connecté",

    // src/lib/plugins/builtins/double-tap-reply/index.ts
    "doubleTapReply.doubleTapSwipeActions":
        "Actions par double touche et balayage",
    "doubleTapReply.doubleTapAMessageToReply":
        "Touchez deux fois un message pour répondre, réagir ou le modifier, ou balayez-le vers la gauche pour répondre / modifier.",
    "doubleTapReply.doubleTapYourMessages": "Double touche sur vos messages",
    "doubleTapReply.nothing": "Rien",
    "doubleTapReply.reaction": "Réaction",
    "doubleTapReply.reply": "Répondre",
    "doubleTapReply.edit": "Modifier",
    "doubleTapReply.doubleTapOtherMessages":
        "Double touche sur les autres messages",
    "doubleTapReply.reactionEmoji": "Émoji de réaction",
    "doubleTapReply.sentWhenADoubleTapAction":
        "Envoyé quand une action de double touche est réglée sur Réaction.",
    "doubleTapReply.swipeToReplyEdit": "Balayer pour répondre / modifier",
    "doubleTapReply.swipeAMessageLeftToReply":
        "Balayez un message vers la gauche pour répondre ; balayez plus loin les vôtres pour les modifier.",
    "doubleTapReply.failedToReact": "Impossible de réagir",

    // src/lib/plugins/builtins/slash-fun/index.ts
    "slashFun.sendAnActionMessage": "Envoyer un message d'action",
    "slashFun.appendToYourMessage": "Ajouter ¯\\_(ツ)_/¯ à votre message",
    "slashFun.appendToYourMessage2": "Ajouter (╯°□°)╯︵ ┻━┻ à votre message",
    "slashFun.appendToYourMessage3": "Ajouter ┬─┬ ノ( ゜-゜ノ) à votre message",
    "slashFun.appendToYourMessage4": "Ajouter ( ͡° ͜ʖ ͡°) à votre message",
    "slashFun.sendYourMessageAsASpoiler": "Envoyer votre message comme spoiler",
    "slashFun.sendYourMessageWithoutMarkdownFormatting":
        "Envoyer votre message sans mise en forme Markdown",
    "slashFun.funSlashCommands": "Commandes slash amusantes",
    "slashFun.noveltySlashCommandsMeShrugTableflip":
        "Commandes slash fantaisie : /me, /shrug, /tableflip, /unflip, /lenny, /spoiler, /plain.",

    // src/lib/plugins/builtins/text-replacer/index.ts
    "textReplacer.textReplacer": "Remplacement de texte",
    "textReplacer.applyYourOwnStringOrRegex":
        "Appliquez vos propres substitutions de texte ou d'expressions régulières au texte des messages envoyés.",
    "textReplacer.replacementRules": "Règles de remplacement",
    "textReplacer.appliedToYourOutgoingMessageText":
        "Appliquées dans l'ordre au texte de vos messages envoyés. Les destinataires voient du texte standard.",
    "textReplacer.find": "Rechercher",
    "textReplacer.textOrPattern": "texte ou motif",
    "textReplacer.replaceWith": "Remplacer par",
    "textReplacer.regex": "Regex",
    "textReplacer.ignoreCase": "Ignorer la casse",
    "previewRewriter.name": "Réécriture des aperçus de liens",
    "previewRewriter.description":
        "Charger les aperçus de liens depuis une autre adresse, par ex. un miroir d’un site que votre serveur d’accueil ne peut pas joindre.",
    "previewRewriter.rules": "Règles de réécriture",
    "previewRewriter.rulesDescription":
        "Appliquées dans l’ordre à l’adresse depuis laquelle un aperçu est chargé. Le lien lui-même n’est pas modifié.",

    // src/lib/plugins/pluginBoot.ts
    "pluginBoot.noPluginSyncDataOnYour":
        "Aucune donnée de synchronisation des plugins sur votre compte pour l'instant.",
    "pluginBoot.theSyncDataOnYourAccount":
        "Les données de synchronisation de votre compte sont mal formées.",
    "pluginBoot.autoUpdateFailed":
        "Échec de la mise à jour automatique : {value}",

    // src/lib/plugins/pluginPin.ts
    "pluginPin.pluginIdMismatchIndexListsManifest":
        "Identifiant de plugin incohérent : l'index indique « {entryId} », le manifeste déclare « {manifestId} »",
    "pluginPin.cannotInstallPluginWithIdIt":
        "Impossible d'installer le plugin « {manifestId} » : c'est un plugin intégré",
    "pluginPin.pluginIsAlreadyInstalledFromA":
        "Le plugin « {manifestId} » est déjà installé depuis un autre dépôt",

    // src/lib/plugins/repo.ts
    "repo.repoReferenceMustBeAString":
        "La référence du dépôt doit être une chaîne",
    "repo.repoReferenceCannotBeEmpty":
        "La référence du dépôt ne peut pas être vide",
    "repo.branchCannotBeEmpty": "La branche ne peut pas être vide",
    "repo.branchCannotContain": "La branche ne peut pas contenir « .. »",
    "repo.invalidRepoReferenceExtraPathSegments":
        "Référence de dépôt invalide : segments de chemin en trop (pas /tree/<branche>)",
    "repo.invalidRepoReferenceMustBeOwner":
        "Référence de dépôt invalide : doit être propriétaire/dépôt",
    "repo.ownerCannotBeEmpty": "Le propriétaire ne peut pas être vide",
    "repo.invalidOwnerMustMatchAZa":
        "Propriétaire invalide : doit correspondre à [A-Za-z0-9][A-Za-z0-9._-]*",
    "repo.repoCannotBeEmpty": "Le dépôt ne peut pas être vide",
    "repo.invalidRepoMustMatchAZa":
        "Dépôt invalide : doit correspondre à [A-Za-z0-9][A-Za-z0-9._-]*",

    // src/lib/plugins/repoList.ts
    "repoList.enterARepoOwnerRepoOr":
        "Saisissez un dépôt (propriétaire/dépôt ou URL GitHub).",
    "repoList.thatIsTheOfficialRepoAlready":
        "C'est le dépôt officiel (déjà inclus).",
    "repoList.thatRepoIsAlreadyAdded": "Ce dépôt est déjà ajouté.",

    // src/lib/stores/gifSearch.svelte.ts
    "gifSearch.couldnTReachKlipyTryAgain":
        "Impossible de joindre KLIPY - réessayez.",

    // src/lib/stores/liveLocation.svelte.ts
    "liveLocation.youCanTShareLiveLocation":
        "Vous ne pouvez pas partager votre position en direct dans ce salon.",
    "liveLocation.couldnTStartLiveLocation":
        "Impossible de démarrer la position en direct",
    "liveLocation.expired": "Expiré",
    "liveLocation.lessThanAMinuteLeft": "moins d'une minute restante",
    "liveLocation.minLeft": "{totalMin} min restantes",
    "liveLocation.hLeft": "{h} h restantes",
    "liveLocation.hMinLeft": "{h} h {m} min restantes",
    "liveLocation.justNow": "à l'instant",
    "liveLocation.sAgo": "il y a {floor} s",
    "liveLocation.minAgo": "il y a {floor} min",
    "liveLocation.hAgo": "il y a {floor} h",
    "liveLocation.n15Minutes": "15 minutes",
    "liveLocation.n1Hour": "1 heure",
    "liveLocation.n8Hours": "8 heures",

    // src/lib/stores/outbox.svelte.ts
    "outbox.failedToSend": "Échec de l'envoi",

    // src/lib/stores/settings.svelte.ts
    "settings.couldNotReadThatFile": "Impossible de lire ce fichier.",
    "settings.thatFileIsnTAValid": "Ce fichier n'est pas une police valide.",
    "settings.fontCouldnTBeSavedOn":
        "La police n'a pas pu être enregistrée sur cet appareil.",
    "settings.cannotSaveAPresetWithBuilt":
        "Impossible d'enregistrer un préréglage avec un nom intégré : {name}",

    // src/lib/stores/shareInbox.svelte.ts
    "shareInbox.youReOfflineTheShareWas":
        "Vous êtes hors ligne : le partage a été ajouté à la zone de saisie",
    "shareInbox.couldnTSendTheShare": "Impossible d'envoyer le partage",

    // src/lib/stores/verification.svelte.ts
    "verification.finishingAnotherVerificationFirstTryAgain":
        "Une autre vérification doit d'abord se terminer. Réessayez.",
    "verification.waitingForTheOtherSideTo":
        "En attente de l'acceptation de l'autre partie…",
    "verification.acceptedSettingUpTheCheck":
        "Accepté - préparation de la vérification…",
    "verification.verifying": "Vérification…",
    "verification.sessionVerified": "Session vérifiée",
    "verification.userVerified": "Utilisateur vérifié",
    "verification.verificationCancelled": "Vérification annulée",
    "verification.verified": "Vérifié",
    "verification.unverified": "Non vérifié",
    "verification.identityChanged": "Identité modifiée",
    "verification.couldnTAcceptThisRequestTry":
        "Impossible d'accepter cette demande. Réessayez.",

    // src/lib/stores/voiceCall.svelte.ts
    "voiceCall.couldnTLoadTheCallComponent":
        "Impossible de charger le composant d'appel. Vérifiez votre connexion, puis rechargez la page pour réessayer.",
    "voiceCall.couldNotJoinTheVoiceCall":
        "Impossible de rejoindre l'appel vocal",
    "voiceCall.couldNotMuteYourMicrophone": "Impossible de couper votre micro",
    "voiceCall.couldNotUnmuteYourMicrophoneCheck":
        "Impossible de réactiver votre micro - vérifiez votre périphérique d'entrée",
    "voiceCall.connecting": "Connexion…",
    "voiceCall.voiceConnected": "Vocal connecté",
    "voiceCall.reconnecting": "Reconnexion…",
    "voiceCall.youWereBannedFromThisRoom":
        "Vous avez été banni de ce salon - appel terminé",
    "voiceCall.youLeftThisRoomCallEnded":
        "Vous avez quitté ce salon - appel terminé",
    "voiceCall.youWereRemovedFromThisRoom":
        "Vous avez été retiré de ce salon - appel terminé",

    // src/lib/update.ts
    "update.noReleasesFoundYet": "Aucune version trouvée pour l'instant.",
    "update.githubApiError": "Erreur de l'API GitHub ({status}).",
    "update.couldNotReadTheLatestVersion":
        "Impossible de lire la dernière version.",

    // src/lib/utils/accountSecurity.ts
    "accountSecurity.enterYourCurrentPassword":
        "Saisissez votre mot de passe actuel.",
    "accountSecurity.enterANewPassword": "Saisissez un nouveau mot de passe.",
    "accountSecurity.newPasswordMustBeAtLeast":
        "Le nouveau mot de passe doit comporter au moins 8 caractères.",
    "accountSecurity.newPasswordMustBeDifferentFrom":
        "Le nouveau mot de passe doit être différent de l'actuel.",
    "accountSecurity.passwordsDoNotMatch":
        "Les mots de passe ne correspondent pas.",

    // src/lib/utils/activeSession.ts
    "activeSession.offAlwaysNotify": "Désactivé - toujours notifier",
    "activeSession.n15Seconds": "15 secondes",
    "activeSession.n30Seconds": "30 secondes",
    "activeSession.n1Minute": "1 minute",
    "activeSession.n2Minutes": "2 minutes",
    "activeSession.n5Minutes": "5 minutes",
    "activeSession.n10Minutes": "10 minutes",
    "activeSession.n30Minutes": "30 minutes",
    "activeSession.enterANumberOfMinutes": "Saisissez un nombre de minutes.",
    "activeSession.chooseAtLeast1MinuteUse":
        "Choisissez au moins 1 minute - utilisez la liste ci-dessus pour des durées plus courtes.",
    "activeSession.chooseMinutes2HoursOrLess":
        "Choisissez {MAX_CUSTOM_GRACE_MINUTES} minutes (2 heures) ou moins.",

    // src/lib/utils/audioDevices.ts
    "audioDevices.microphone": "Micro",
    "audioDevices.speaker": "Haut-parleur",
    "audioDevices.camera": "Caméra",

    // src/lib/utils/audioPlayback.ts
    "audioPlayback.failedToLoadRetry": "Échec du chargement · Réessayer",
    "audioPlayback.clickToPlay": "Cliquez pour lire",

    // src/lib/utils/clientGeneration.ts
    "clientGeneration.sessionChangedBeforeTheOperationFinished":
        "La session a changé avant la fin de l'opération",

    // src/lib/utils/customFont.ts
    "customFont.useAWoff2TtfOrOtf":
        "Utilisez un fichier de police .woff2, .ttf ou .otf.",
    "customFont.thatFontFileIsEmpty": "Ce fichier de police est vide.",
    "customFont.fontFileIsTooLargeMax":
        "Le fichier de police est trop volumineux (10 Mo max.).",
    "customFont.customFont": "Police personnalisée",

    // src/lib/utils/deviceSessions.ts
    "deviceSessions.unknown": "Inconnu",
    "deviceSessions.justNow": "À l'instant",
    "deviceSessions.desktopApp": "Application de bureau",
    "deviceSessions.on": "{client} sur {os}",
    "deviceSessions.minutesAgo":
        "{count, plural, one {il y a # minute} other {il y a # minutes}}",
    "deviceSessions.hoursAgo":
        "{count, plural, one {il y a # heure} other {il y a # heures}}",
    "deviceSessions.daysAgo":
        "{count, plural, one {il y a # jour} other {il y a # jours}}",

    // src/lib/utils/displaySources.ts
    "displaySources.screen": "Écran",
    "displaySources.untitledWindow": "Fenêtre sans titre",

    // src/lib/utils/encryptionState.ts
    "encryptionState.unableToDecryptYouMayNot":
        "Impossible de déchiffrer - vous n'avez peut-être pas les clés de ce message.",
    "encryptionState.theSenderChoseNotToShare":
        "L'expéditeur a choisi de ne pas partager les clés de ce message.",
    "encryptionState.theSenderDidNotShareThe":
        "L'expéditeur n'a pas partagé les clés car cet appareil n'est pas vérifié. Vérifiez cet appareil pour lire ce type de messages.",
    "encryptionState.senderDeviceNotCrossSigned":
        "L'appareil de l'expéditeur n'est pas signé de manière croisée par son propriétaire, ce message est donc masqué. Demandez-lui de vérifier cette session.",
    "encryptionState.senderDeviceUnknown":
        "Ce message ne peut être associé à aucun appareil connu de l'expéditeur, il est donc masqué.",
    "encryptionState.senderIdentityChanged":
        "L'identité de l'expéditeur a changé depuis que vous l'avez vérifié, ce message est donc masqué. Vérifiez-le à nouveau pour le lire.",
    "encryptionState.historicalNoBackup":
        "Ce message a été envoyé avant la connexion de cet appareil, et il n'existe aucune sauvegarde des clés pour le restaurer.",
    "encryptionState.historicalBackupUnconfigured":
        "Ce message a été envoyé avant la connexion de cet appareil. Saisissez votre clé de récupération pour le restaurer depuis la sauvegarde des clés.",
    "encryptionState.historicalWorkingBackup":
        "Ce message a été envoyé avant la connexion de cet appareil et n'a pas été trouvé dans votre sauvegarde des clés.",
    "encryptionState.historicalNotJoined":
        "Ce message a été envoyé alors que vous n'étiez pas dans le salon.",
    "encryptionState.encryptedMessage": "🔒 Message chiffré",

    // src/lib/utils/eventShield.ts
    "eventShield.thisMessageSEncryptionCouldNot":
        "Le chiffrement de ce message n'a pas pu être entièrement vérifié.",
    "eventShield.encryptedByAnUnverifiedUser":
        "Chiffré par un utilisateur non vérifié.",
    "eventShield.encryptedByADeviceNotVerified":
        "Chiffré par un appareil non vérifié par son propriétaire.",
    "eventShield.encryptedByAnUnknownOrDeleted":
        "Chiffré par un appareil inconnu ou supprimé.",
    "eventShield.theAuthenticityOfThisEncryptedMessage":
        "L'authenticité de ce message chiffré ne peut pas être garantie sur cet appareil.",
    "eventShield.theSenderWasPreviouslyVerifiedBut":
        "L'expéditeur était vérifié, mais a changé d'identité.",
    "eventShield.theSenderDoesnTMatchThe":
        "L'expéditeur ne correspond pas au propriétaire de l'appareil qui a envoyé ce message.",

    // src/lib/utils/extendedProfile.ts
    "extendedProfile.aStatusNeedsBothAnEmoji":
        "Un statut nécessite à la fois un émoji et du texte.",
    "extendedProfile.inACall": "En appel",
    "extendedProfile.inACallForMin": "En appel depuis {minutes} min",
    "extendedProfile.inACallForH": "En appel depuis {hours} h",
    "extendedProfile.other": "Autre",
    "extendedProfile.atMostLinks": "{MAX_CONNECTIONS} liens au maximum.",
    "extendedProfile.linksMustBeHttpHttpsMailto":
        "Les liens doivent être des adresses http, https, mailto ou matrix.",
    "extendedProfile.inACallForHMin": "En appel depuis {hours} h {minutes} min",

    // src/lib/utils/geoErrors.ts
    "geoErrors.locationNeedsASecureHttpsConnection":
        "La localisation nécessite une connexion sécurisée (HTTPS) - ouvrez l'application en https.",
    "geoErrors.locationPermissionWasDeniedCheckSite":
        "L'autorisation de localisation a été refusée - vérifiez les autorisations du site.",
    "geoErrors.yourPositionIsUnavailableLocationOff":
        "Votre position est indisponible (localisation désactivée ou pas de signal GPS).",
    "geoErrors.timedOutGettingYourLocation":
        "Délai dépassé pour obtenir votre position.",
    "geoErrors.couldnTGetYourLocation": "Impossible d'obtenir votre position.",
    "geoErrors.locationIsnTAvailableInThis":
        "La localisation n'est pas disponible dans ce navigateur.",

    // src/lib/utils/joinRules.ts
    "joinRules.onlyAvailableForRoomsInsideA":
        "Disponible uniquement pour les salons d'un espace",
    "joinRules.thisRoomSVersionDoesnT":
        "La version de ce salon ne prend pas en charge l'accès restreint à un espace",

    // src/lib/utils/keyBackup.ts
    "keyBackup.preparing": "Préparation…",
    "keyBackup.fetchingYourEncryptedHistory":
        "Récupération de votre historique chiffré…",
    "keyBackup.restoringYourEncryptedHistory":
        "Restauration de votre historique chiffré…",
    "keyBackup.restoringOfKeys":
        "Restauration de {successes} clés sur {total}…",
    "keyBackup.noEncryptedHistoryToRestore":
        "Aucun historique chiffré à restaurer",
    "keyBackup.restored":
        "{count, plural, one {# clé restaurée} other {# clés restaurées}}",
    "keyBackup.ofKeysRestored": "{imported} clés sur {total} restaurées",
    "keyBackup.notSetUp": "Non configurée",
    "keyBackup.notTrusted": "Non approuvée",
    "keyBackup.notConnected": "Non connectée",
    "keyBackup.on": "Activée",
    "keyBackup.encryptedMessageHistoryIsnTBeing":
        "L'historique des messages chiffrés n'est pas sauvegardé. Configurez la récupération pour le protéger.",
    "keyBackup.aBackupExistsOnTheServer":
        "Une sauvegarde existe sur le serveur, mais cette session ne lui fait pas encore confiance.",
    "keyBackup.aBackupExistsButThisSession":
        "Une sauvegarde existe, mais cette session n'y est pas connectée. Saisissez votre clé de récupération pour restaurer votre historique.",
    "keyBackup.messageHistoryIsBeingBackedUp":
        "L'historique des messages est sauvegardé (v{version}).",
    "keyBackup.messageHistoryIsBeingBackedUp2":
        "L'historique des messages est sauvegardé.",
    "keyBackup.noKeysBackedUpYet": "Aucune clé sauvegardée pour l'instant",
    "keyBackup.backedUp":
        "{count, plural, one {# clé sauvegardée} other {# clés sauvegardées}}",
    "keyBackup.stillToUpload":
        "{count, plural, one {# clé restant à envoyer} other {# clés restant à envoyer}}",
    "keyBackup.everythingOnThisSessionIsBacked":
        "Tout ce qui se trouve dans cette session est sauvegardé",
    "keyBackup.notSet": "Non défini",
    "keyExportSettings.exportOrImportRoomKeys":
        "Exporter ou importer les clés de salon",
    "keyExportSettings.aKeyFileLetsAnotherApp":
        "Un fichier de clés permet à une autre appli Matrix, ou à une nouvelle session, de lire votre historique de messages chiffré. Conservez le fichier et sa phrase secrète en lieu sûr : quiconque possède les deux peut lire vos messages.",
    "keyExportSettings.export": "Exporter",
    "keyExportSettings.import": "Importer",
    "keyExportSettings.passphrase": "Phrase secrète",
    "keyExportSettings.confirmPassphrase": "Confirmer la phrase secrète",
    "keyExportSettings.passphrasesDontMatch":
        "Les phrases secrètes ne correspondent pas",
    "keyExportSettings.exportKeys": "Exporter les clés",
    "keyExportSettings.exporting": "Exportation…",
    "keyExportSettings.exported":
        "{count, plural, one {# clé exportée} other {# clés exportées}}",
    "keyExportSettings.couldNotExportYourKeys":
        "Impossible d'exporter vos clés",
    "keyExportSettings.keyFile": "Fichier de clés",
    "keyExportSettings.importKeys": "Importer les clés",
    "keyExportSettings.wrongPassphrase":
        "Phrase secrète incorrecte, ou le fichier a été modifié",
    "keyExportSettings.notAKeyFile":
        "Ce n'est pas un fichier de clés, ou il est endommagé",
    "keyExportSettings.newerFormat":
        "Ce fichier de clés a été créé par une appli plus récente et ne peut pas être lu ici",
    "keyExportSettings.couldNotImportTheKeys": "Impossible d'importer les clés",

    // src/lib/utils/keywordRules.ts
    "keywordRules.keywordCannotBeEmpty": "Le mot-clé ne peut pas être vide",
    "keywordRules.keywordCannotStartWith":
        "Un mot-clé ne peut pas commencer par « . »",
    "keywordRules.youAlreadyHaveARuleFor":
        "Vous avez déjà une règle pour ce mot-clé",

    // src/lib/utils/liveAnnouncer.ts
    "liveAnnouncer.messageFrom": "Message de {sender}",
    "liveAnnouncer.newMessagesFrom":
        "{count, plural, one {# nouveau message de {sender}} other {# nouveaux messages de {sender}}}",
    "liveAnnouncer.newMessages":
        "{count, plural, one {# nouveau message} other {# nouveaux messages}}",

    // src/lib/utils/liveShareStop.ts
    "liveShareStop.couldnTStopSharingYourLive":
        "Impossible d'arrêter le partage de votre position en direct - elle reste visible dans ce salon. Utilisez « Réessayer l'arrêt » pour réessayer.",
    "liveShareStop.stopping": "Arrêt…",
    "liveShareStop.stillSharingCouldnTStop":
        "Toujours en partage - arrêt impossible",
    "liveShareStop.youReAlreadySharingYourLive":
        "Vous partagez déjà votre position en direct dans ce salon.",
    "liveShareStop.yourLastLiveLocationShareHere":
        "Votre dernier partage de position en direct ici n'est pas encore arrêté - arrêtez-le depuis la bannière du salon avant d'en commencer un nouveau.",
    "liveShareStop.stop": "Arrêter",
    "liveShareStop.retryStop": "Réessayer l'arrêt",

    // src/lib/utils/location.ts
    "location.location": "Position",

    // src/lib/utils/mediaGallery.ts
    "mediaGallery.of": "{value} sur {length}{value2}",

    // src/lib/utils/messageActionsMenu.ts
    "messageActionsMenu.edit": "Modifier",
    "messageActionsMenu.unpin": "Désépingler",
    "messageActionsMenu.pin": "Épingler",
    "messageActionsMenu.copyLink": "Copier le lien",
    "messageActionsMenu.report": "Signaler",

    // src/lib/utils/messageDisplay.ts
    "messageDisplay.systemDefault": "Police du système",

    // src/lib/utils/micErrorMessage.ts
    "micErrorMessage.noMicrophoneFoundConnectOneOr":
        "Aucun micro trouvé - branchez-en un ou choisissez un autre périphérique d'entrée pour rejoindre l'appel",
    "micErrorMessage.couldNotOpenYourMicrophoneAnother":
        "Impossible d'ouvrir votre micro - une autre application l'utilise peut-être",

    // src/lib/utils/mutePowerLevel.ts
    "mutePowerLevel.enterAPowerLevel": "Saisissez un niveau de pouvoir",
    "mutePowerLevel.mustBeAWholeNumber": "Doit être un nombre entier",
    "mutePowerLevel.useToMute": "Utilisez {MUTE_POWER_LEVEL} pour rendre muet",
    "mutePowerLevel.youCanTSetALevel":
        "Vous ne pouvez pas définir un niveau supérieur au vôtre ({ceiling})",

    // src/lib/utils/notifActions.ts
    "notifActions.reply": "Répondre",
    "notifActions.reply2": "Répondre…",
    "notifActions.markAsRead": "Marquer comme lu",

    // src/lib/utils/notificationPrivacy.ts
    "notificationPrivacy.sentAMessage": "a envoyé un message",
    "notificationPrivacy.newMessage": "Nouveau message",

    // src/lib/utils/notifyPermission.ts
    "notifyPermission.notificationsAreBlockedSoIncomingCalls":
        "Les notifications sont bloquées : les appels entrants ne vous alerteront pas quand cette fenêtre est masquée. Débloquez les notifications dans les paramètres système.",
    "notifyPermission.thisBrowserCanTShowCall":
        "Ce navigateur ne peut pas afficher d'alertes d'appel quand la fenêtre est masquée.",

    // src/lib/utils/pollContent.ts
    "pollContent.addAQuestion": "Ajoutez une question.",
    "pollContent.addAtLeastTwoOptions": "Ajoutez au moins deux options.",
    "pollContent.atMostOptions": "{MAX_ANSWERS} options au maximum.",
    "pollContent.invalidNumberOfSelections": "Nombre de choix invalide.",
    "pollContent.thePollHasEnded": "Le sondage est terminé.",

    // src/lib/utils/powerLevels.ts
    "powerLevels.enterAPowerLevel": "Saisissez un niveau de pouvoir",
    "powerLevels.mustBeAWholeNumber": "Doit être un nombre entier",
    "powerLevels.mustBe0OrHigher": "Doit être supérieur ou égal à 0",
    "powerLevels.youCanTSetALevel":
        "Vous ne pouvez pas définir un niveau supérieur au vôtre ({ceiling})",

    // src/lib/utils/presence.ts
    "presence.online": "En ligne",
    "presence.away": "Absent",
    "presence.offline": "Hors ligne",
    "presence.seenAsOnlineWhileTheApp":
        "Affiché en ligne pendant que l'application se synchronise",
    "presence.shownAsIdleToOtherUsers":
        "Affiché comme absent aux autres utilisateurs",
    "presence.invisible": "Invisible",
    "presence.appearOfflineToOtherUsers":
        "Apparaître hors ligne aux autres utilisateurs",

    // src/lib/utils/pushRuleWrite.ts
    "pushRuleWrite.yourHomeserverHasNoNotificationRule":
        "Votre serveur d'accueil n'a pas de règle de notification « {label} » ; elle n'a donc pas pu être modifiée.",
    "pushRuleWrite.yourHomeserverRejectedTheChangeTo":
        "Votre serveur d'accueil a refusé la modification des notifications « {label} ».",
    "pushRuleWrite.notificationsDidNotChangeOnYour":
        "Les notifications « {label} » n'ont pas changé sur votre serveur d'accueil.",
    "pushRuleWrite.couldNotSaveNotificationsCheckYour":
        "Impossible d'enregistrer les notifications « {label} ». Vérifiez votre connexion et réessayez.",

    // src/lib/utils/pusherVerification.ts
    "pusherVerification.noGatewayUrl": "(aucune URL de passerelle)",

    // src/lib/utils/recoveryPassphrase.ts
    "recoveryPassphrase.enterAPassphrase": "Saisissez une phrase secrète.",
    "recoveryPassphrase.useAtLeastCharacters":
        "Utilisez au moins {MIN_PASSPHRASE_LENGTH} caractères.",

    // src/lib/utils/reportMessage.ts
    "reportMessage.failedToSendReport": "Impossible d'envoyer le signalement",

    // src/lib/utils/roomAliases.ts
    "roomAliases.enterAnAddress": "Saisissez une adresse.",
    "roomAliases.addressesCannotContainSpaces":
        "Les adresses ne peuvent pas contenir d'espaces.",
    "roomAliases.addressesCannotContain":
        "Les adresses ne peuvent pas contenir « : ».",
    "roomAliases.addressesCannotContain2":
        "Les adresses ne peuvent pas contenir « # ».",
    "roomAliases.addressesCannotContainControlCharacters":
        "Les adresses ne peuvent pas contenir de caractères de contrôle.",
    "roomAliases.addressIsTooLongMaxCharacters":
        "L'adresse est trop longue ({MAX_ALIAS_LENGTH} caractères max.).",
    "roomAliases.thatAddressAlreadyExists": "Cette adresse existe déjà.",

    // src/lib/utils/roomCreationOutcome.ts
    "roomCreationOutcome.theServerRejectedTheChange":
        "le serveur a refusé la modification",
    "roomCreationOutcome.theRoomWasCreatedButAdding":
        "Le salon a été créé, mais son ajout à l'espace a échoué : {detailSentence}",
    "roomCreationOutcome.theDirectMessageWasCreatedBut":
        "Le message direct a été créé, mais son enregistrement dans votre liste de messages directs a échoué : {detailSentence} Il peut apparaître comme un salon normal jusqu'à une nouvelle tentative.",
    "roomCreationOutcome.theRoomWasCreatedButAdding2":
        "Le salon a été créé, mais son ajout à l'espace n'est pas encore confirmé - il est peut-être encore en cours d'enregistrement. Réessayez si le salon n'apparaît pas dans l'espace.",
    "roomCreationOutcome.theDirectMessageWasCreatedBut2":
        "Le message direct a été créé, mais son enregistrement dans votre liste de messages directs n'est pas encore confirmé - il est peut-être encore en cours. Réessayez s'il n'apparaît pas dans votre liste.",

    // src/lib/utils/roomEncryption.ts
    "roomEncryption.thisRoomIsAlreadyEncrypted": "Ce salon est déjà chiffré.",
    "roomEncryption.youNeedPowerLevelToEnable":
        "Il faut le niveau de pouvoir {required} pour activer le chiffrement.",
    "roomEncryption.youAlreadyHaveADirectMessage":
        "Vous avez déjà un message direct non chiffré avec cet utilisateur. Le chiffrement ne peut pas être ajouté automatiquement - ouvrez-le et activez-le depuis les paramètres de sécurité du salon.",
    "roomEncryption.enableEncryptionWarning":
        "Une fois activé, le chiffrement ne peut plus être désactivé. Tout le monde aura besoin d'un client compatible pour lire les nouveaux messages.",

    // src/lib/utils/roomHeaderMenu.ts
    "roomHeaderMenu.threads": "Fils",
    "roomHeaderMenu.pinnedMessages": "Messages épinglés",
    "roomHeaderMenu.notificationsInbox": "Boîte des notifications",
    "roomHeaderMenu.mediaAndFiles": "Médias et fichiers",
    "roomHeaderMenu.memberList": "Liste des membres",

    // src/lib/utils/roomMedia.ts
    "roomMedia.image": "Image",
    "roomMedia.video": "Vidéo",
    "roomMedia.file": "Fichier",
    "roomMedia.audio": "Audio",
    "roomMedia.kb": "{toFixed} Ko",
    "roomMedia.mb": "{toFixed} Mo",

    // src/lib/utils/roomSettingsNav.ts
    "roomSettingsNav.general": "Général",
    "roomSettingsNav.access": "Accès",
    "roomSettingsNav.security": "Sécurité",
    "roomSettingsNav.permissions": "Autorisations",
    "roomSettingsNav.members": "Membres",
    "roomSettingsNav.emotes": "Émotes",
    "roomSettingsNav.rooms": "Salons",

    // src/lib/utils/roomStateTrust.ts
    "roomStateTrust.unverifiedRoomState": "État du salon non vérifié",
    "roomStateTrust.unverifiedRoomStateTooltip":
        "Certaines informations de ce salon (rôles, membres et autorisations) ont été récupérées directement depuis le serveur et n'ont pas été confirmées par la synchronisation ; elles peuvent donc être inexactes. Les actions restent appliquées par le serveur, quoi qu'il soit affiché ici.",

    // src/lib/utils/roomUpgrade.ts
    "roomUpgrade.theServerSRecommendedRoomVersion":
        "La version de salon recommandée par le serveur n'est pas disponible.",
    "roomUpgrade.thisRoomIsOnTheLatest":
        "Ce salon est déjà à la dernière version (v{recommendedVersion}).",
    "roomUpgrade.youDonTHavePermissionTo":
        "Vous n'avez pas l'autorisation de mettre à niveau ce salon.",

    // src/lib/utils/saveFile.ts
    "saveFile.savedToDownloads": "Enregistré dans Téléchargements",

    // src/lib/utils/securityStatusView.ts
    "securityStatusView.couldnTReadThisAccountS":
        "Impossible de lire l'état du chiffrement de ce compte. Rien ici n'est fiable tant qu'il n'est pas chargé - ne configurez ni ne réinitialisez la récupération pour l'instant.",
    "securityStatusView.encryptionIsnTReadyOnThis":
        "Le chiffrement n'est pas encore prêt dans cette session. Rechargez si cela persiste.",

    // src/lib/utils/serverAcl.ts
    "serverAcl.allowListIsEmptyWhichDenies":
        "La liste d'autorisation est vide, ce qui empêche tous les serveurs de fédérer.",
    "serverAcl.denyListContainsWhichBansAll":
        "La liste de refus contient *, ce qui bannit tous les serveurs.",
    "serverAcl.thisConfigurationBansYourOwnServer":
        "Cette configuration bannit votre propre serveur ({ownServerName}), ce qui cassera la fédération.",

    // src/lib/utils/serverCapabilities.ts
    "serverCapabilities.crossSigningE2ee": "Signature croisée (E2EE)",
    "serverCapabilities.privateReadReceipts": "Accusés de lecture privés",
    "serverCapabilities.threadedRelations": "Relations en fils",
    "serverCapabilities.spaceSummaries": "Résumés d'espaces",
    "serverCapabilities.busyPresence": "Présence « occupé »",
    "serverCapabilities.dehydratedDevices": "Appareils déshydratés",
    "serverCapabilities.filterPublicRoomsByType":
        "Filtrer les salons publics par type",
    "serverCapabilities.authenticatedMedia": "Médias authentifiés",
    "serverCapabilities.intentionalMentions": "Mentions intentionnelles",
    "serverCapabilities.slidingSyncSimplified":
        "Synchronisation glissante (simplifiée)",
    "serverCapabilities.sharedRoomsWithAUser":
        "Salons partagés avec un utilisateur",

    // src/lib/utils/settingsNav.ts
    "settingsNav.account": "Compte",
    "settingsNav.securitySessions": "Sécurité et sessions",
    "settingsNav.privacySafety": "Confidentialité et sécurité",
    "settingsNav.app": "Application",
    "settingsNav.appearance": "Apparence",
    "settingsNav.messagesMedia": "Messages et médias",
    "settingsNav.voiceVideo": "Voix et vidéo",
    "settingsNav.emotes": "Émotes",
    "settingsNav.advanced": "Avancé",
    "settingsNav.general": "Général",
    "settingsNav.plugins": "Plugins",
    "settingsNav.server": "Serveur",
    "settingsNav.about": "À propos",
    "settingsNav.debug": "Débogage",

    // src/lib/utils/settingsSearch.ts
    "settingsSearch.displayName": "Nom d'affichage",
    "settingsSearch.avatar": "Avatar",
    "settingsSearch.presence": "Présence",
    "settingsSearch.changePassword": "Changer le mot de passe",
    "settingsSearch.logOut": "Se déconnecter",
    "settingsSearch.deactivateAccount": "Désactiver le compte",
    "settingsSearch.sessions": "Sessions",
    "settingsSearch.encryptNewDirectMessages":
        "Chiffrer les nouveaux messages directs",
    "settingsSearch.onlySendToVerifiedDevices":
        "N'envoyer qu'aux appareils vérifiés",
    "settingsSearch.setUpRecovery": "Configurer la récupération",
    "settingsSearch.restoreMessageHistory":
        "Restaurer l'historique des messages",
    "settingsSearch.verifyThisSession": "Vérifier cette session",
    "settingsSearch.rightAlignMyMessages": "Aligner mes messages à droite",
    "settingsSearch.showWhenIAmInA": "Indiquer quand je suis en appel",
    "settingsSearch.showNameColours": "Afficher les couleurs des noms",
    "settingsSearch.textSize": "Taille du texte",
    "settingsSearch.font": "Police",
    "settingsSearch.themePresets": "Préréglages de thème",
    "settingsSearch.importExportTheme": "Importer / exporter un thème",
    "settingsSearch.timeFormat": "Format de l'heure",
    "settingsSearch.dateFormat": "Format de la date",
    "settingsSearch.showMatrixIds": "Afficher les identifiants Matrix",
    "settingsSearch.readReceiptAvatars": "Avatars des accusés de lecture",
    "settingsSearch.linkPreviews": "Aperçus des liens",
    "settingsSearch.linkPreviewMedia": "Médias des aperçus de liens",
    "settingsSearch.pauseVideosOffScreen":
        "Mettre en pause les vidéos hors écran",
    "settingsSearch.midiSoundBank": "Banque de sons MIDI",
    "settingsSearch.holdToOpenMessageMenu":
        "Maintenir pour ouvrir le menu du message",
    "settingsSearch.gifDefaultTab": "Onglet GIF par défaut",
    "settingsSearch.minimiseToTrayOnClose":
        "Réduire dans la zone de notification à la fermeture",
    "settingsSearch.reduceMotion": "Réduire les animations",
    "settingsSearch.keepRoomListOpen": "Garder la liste des salons ouverte",
    "settingsSearch.customEmotes": "Émotes personnalisées",
    "settingsSearch.pushNotificationsPermission":
        "Autorisation des notifications push",
    "settingsSearch.notificationSound": "Son des notifications",
    "settingsSearch.desktopAlertsPopUpAndTaskbar":
        "Alertes du bureau (fenêtre et clignotement de la barre des tâches)",
    "settingsSearch.popUpNotifications": "Notifications contextuelles",
    "settingsSearch.quietOnMyOtherDevices": "Silence sur mes autres appareils",
    "settingsSearch.privateReadReceipts": "Accusés de lecture privés",
    "settingsSearch.hideMessageTextInNotifications":
        "Masquer le texte des messages dans les notifications",
    "settingsSearch.notificationRules": "Règles de notification",
    "settingsSearch.keywordHighlights": "Mots-clés surlignés",
    "settingsSearch.inputDevice": "Périphérique d'entrée",
    "settingsSearch.outputDevice": "Périphérique de sortie",
    "settingsSearch.camera": "Caméra",
    "settingsSearch.noiseSuppression": "Suppression du bruit",
    "settingsSearch.echoCancellation": "Annulation de l'écho",
    "settingsSearch.autoGainControl": "Contrôle automatique du gain",
    "settingsSearch.mirrorMyCamera": "Afficher ma caméra en miroir",
    "settingsSearch.callVolume": "Volume des appels",
    "settingsSearch.playCallSounds": "Jouer les sons des appels",
    "settingsSearch.ringForIncomingDmCalls":
        "Sonner pour les appels en message direct",
    "settingsSearch.blockedUsers": "Utilisateurs bloqués",
    "settingsSearch.serverCapabilities": "Capacités du serveur",
    "settingsSearch.plugins": "Plugins",
    "settingsSearch.pluginRepositories": "Dépôts de plugins",
    "settingsSearch.syncPlugins": "Synchroniser les plugins",
    "settingsSearch.checkForUpdates": "Rechercher des mises à jour",
    "settingsSearch.clearCache": "Vider le cache",
    "settingsSearch.showAllEvents": "Afficher tous les événements",
    "settingsSearch.pushDiagnostics": "Diagnostic des notifications push",
    "settingsSearch.pushService": "Service push (UnifiedPush / Firebase)",
    "settingsSearch.language": "Langue",

    // src/lib/utils/slashCommands.ts
    "slashCommands.createAPoll": "Créer un sondage",
    "slashCommands.shareYourLocation": "Partager votre position",
    "slashCommands.joinARoomByAddress": "Rejoindre un salon par adresse",
    "slashCommands.leaveTheCurrentRoom": "Quitter le salon actuel",
    "slashCommands.inviteAUserToThisRoom":
        "Inviter un utilisateur dans ce salon",
    "slashCommands.setTheRoomTopic": "Définir le sujet du salon",
    "slashCommands.removeAUserFromThisRoom":
        "Retirer un utilisateur de ce salon",
    "slashCommands.userServerReason": "<@user:server> [motif]",
    "slashCommands.banAUserFromThisRoom": "Bannir un utilisateur de ce salon",
    "slashCommands.setYourDisplayName": "Définir votre nom d'affichage",
    "slashCommands.displayName": "<nom d'affichage>",
    "slashCommands.setAUserSPowerLevel":
        "Définir le niveau de pouvoir d'un utilisateur",
    "slashCommands.userServerLevel": "<@user:server> [niveau]",
    "slashCommands.resetAUserSPowerLevel":
        "Rétablir le niveau de pouvoir par défaut d'un utilisateur",
    "slashCommands.usage": "Utilisation : /{name} {argHint}",
    "slashCommands.usage2": "Utilisation : /{name}",

    // src/lib/utils/syncStatus.ts
    "syncStatus.connected": "Connecté",
    "syncStatus.reconnecting": "Reconnexion…",
    "syncStatus.connectionError": "Erreur de connexion",
    "syncStatus.offline": "Hors ligne",
    "syncStatus.connecting": "Connexion…",

    // src/lib/utils/themePalette.ts
    "themePalette.accent": "Accent",
    "themePalette.background": "Arrière-plan",
    "themePalette.secondaryBackground": "Arrière-plan secondaire",
    "themePalette.tertiaryBackground": "Arrière-plan tertiaire",
    "themePalette.primaryText": "Texte principal",
    "themePalette.secondaryText": "Texte secondaire",
    "themePalette.mutedText": "Texte atténué",
    "themePalette.danger": "Danger",
    "themePalette.positive": "Positif",
    "themePalette.mentionHighlight": "Surlignage des mentions",
    "themePalette.link": "Lien",
    "themePalette.warning": "Avertissement",
    "themePalette.onlineStatus": "Statut en ligne",
    "themePalette.idleStatus": "Statut absent",
    "themePalette.doNotDisturbStatus": "Statut ne pas déranger",
    "themePalette.offlineStatus": "Statut hors ligne",
    "themePalette.divider": "Séparateur",
    "themePalette.spoilerBackground": "Arrière-plan des spoilers",
    "themePalette.ownMessageBubble": "Bulle de mes messages",
    "themePalette.primaryTextOnBackground":
        "Texte principal sur l'arrière-plan",
    "themePalette.secondaryTextOnBackground":
        "Texte secondaire sur l'arrière-plan",
    "themePalette.mutedTextOnTertiaryBackground":
        "Texte atténué sur l'arrière-plan tertiaire",
    "themePalette.whiteTextOnAccentButtons":
        "Texte blanc sur les boutons d'accent",
    "themePalette.whiteTextOnDangerButtons":
        "Texte blanc sur les boutons de danger",
    "themePalette.whiteTextOnOwnBubble": "Texte blanc sur ma bulle",

    // src/lib/utils/themePreset.ts
    "themePreset.copy": "{newName} (copie)",

    // src/lib/utils/threadList.ts
    "threadList.noPreview": "(aucun aperçu)",

    // src/lib/utils/threePidInvite.ts
    "threePidInvite.youDonTHavePermissionTo":
        "Vous n'avez pas l'autorisation d'inviter des personnes dans ce salon.",
    "threePidInvite.yourHomeserverHasNoIdentityServer":
        "Votre serveur d'accueil n'a pas de serveur d'identité : les invitations par e-mail sont indisponibles.",

    // src/lib/utils/timeFormat.ts
    "timeFormat.yesterdayAt": "Hier à {time}",
    "timeFormat.today": "Aujourd'hui",
    "timeFormat.yesterday": "Hier",
    "timeFormat.separatorDatePattern": "EEEE d MMMM yyyy",
    "timeFormat.monthDayPattern": "d MMM",
    "timeFormat.compactDateTime": "{date}, {time}",

    // src/lib/utils/updateStatus.ts
    "updateStatus.checkingForUpdates": "Recherche de mises à jour…",
    "updateStatus.youReOnTheLatestVersion":
        "Vous utilisez la dernière version{versionSuffix}",
    "updateStatus.checkForUpdates": "Rechercher des mises à jour",
    "updateStatus.updateAvailable": "Mise à jour disponible{versionSuffix}",
    "updateStatus.downloadInstall": "Télécharger et installer",
    "updateStatus.downloadingV": "Téléchargement de la v{version}",
    "updateStatus.downloadingUpdate": "Téléchargement de la mise à jour",
    "updateStatus.updateReadyInstall":
        "Mise à jour prête{versionSuffix} - Installer",
    "updateStatus.install": "Installer",
    "updateStatus.updateReadyRestartToApply":
        "Mise à jour prête{versionSuffix} - redémarrez pour l'appliquer",
    "updateStatus.restartToApply": "Redémarrer pour appliquer",
    "updateStatus.aNewVersionIsAvailable":
        "Une nouvelle version est disponible{versionSuffix}",
    "updateStatus.openReleasePage": "Ouvrir la page de la version",
    "updateStatus.updateCheckFailed": "Échec de la recherche de mises à jour",
    "updateStatus.checkForUpdatesToInstallThe":
        "Recherchez des mises à jour pour installer la dernière version.",

    // src/lib/utils/uploadLimits.ts
    "uploadLimits.mb": "{round} Mo",
    "uploadLimits.kb": "{round} Ko",
    "uploadLimits.exceedsTheServerSUploadLimit":
        "« {fileName} » dépasse la limite d'envoi du serveur ({formatByteLimit})",

    // src/lib/utils/verificationMessage.ts
    "verificationMessage.verificationRequestSent":
        "Demande de vérification envoyée",
    "verificationMessage.waitingForThemToAccept":
        "En attente de son acceptation…",
    "verificationMessage.noLongerPending": "N'est plus en attente",
    "verificationMessage.wantsToVerify":
        "{senderName} souhaite effectuer une vérification",
    "verificationMessage.compareEmojiToConfirmThisIs":
        "Comparez les émojis pour confirmer qu'il s'agit bien de cette personne",
    "verificationMessage.sentAVerificationRequest":
        "{senderName} a envoyé une demande de vérification",

    // src/lib/utils/verificationStatus.ts
    "verificationStatus.checkingEncryption": "Vérification du chiffrement…",
    "verificationStatus.encryptionUnavailable": "Chiffrement indisponible",
    "verificationStatus.statusUnavailable": "État indisponible",
    "verificationStatus.verified": "Vérifiée",
    "verificationStatus.thisSessionIsVerifiedAndEncryption":
        "Cette session est vérifiée et le chiffrement est entièrement configuré.",
    "verificationStatus.notSetUp": "Non configuré",
    "verificationStatus.setUpEncryptionToSecureYour":
        "Configurez le chiffrement pour sécuriser vos messages sur tous vos appareils.",
    "verificationStatus.setUp": "Configurer",
    "verificationStatus.encryptionSetupIncomplete":
        "Configuration du chiffrement incomplète",
    "verificationStatus.thisSessionIsVerifiedButEncryption":
        "Cette session est vérifiée, mais la configuration du chiffrement est incomplète.",
    "verificationStatus.finishSetup": "Terminer la configuration",
    "verificationStatus.unverified": "Non vérifiée",
    "verificationStatus.thisSessionIsnTVerifiedYet":
        "Cette session n'est pas encore vérifiée.",

    // src/routes/+layout.svelte
    "rootLayout.linkCopied": "Lien copié",

    // src/routes/+page.svelte
    "rootPage.failedToReconnectPleaseLogIn":
        "Échec de la reconnexion. Veuillez vous reconnecter.",
    "rootPage.signedInButSyncingCouldNot":
        "Connecté, mais la synchronisation n'a pas pu démarrer. Veuillez réessayer.",
    "rootPage.yourSessionHasExpiredPleaseSign":
        "Votre session a expiré. Veuillez vous reconnecter.",

    // ownStatus
    "ownStatus.profileField": "champ de profil {key}",
    "ownStatus.theServerStillHas": "Le serveur contient encore : {leftovers}",
    "ownStatus.statusClearedButPresenceRemains":
        "Statut effacé, mais le serveur affiche encore le message de présence « {presenceLeft} ». Il est probablement défini par une autre session de ce compte (autre application ou client) - effacez-le là-bas, ou déconnectez cette session.",

    // MSC2545 sharing, typing indicators, layout heading
    "appearanceSettings.layout": "Mise en page",
    "privacySafetySettings.sendTypingIndicators":
        "Envoyer les indicateurs de saisie",
    "privacySafetySettings.letOthersInARoomSee":
        "Permet aux autres membres d'un salon de voir quand vous écrivez. Désactivez pour écrire sans que personne ne soit prévenu.",
    "imagePackEditor.failedToUpdatePack": "Impossible de mettre à jour le pack",
    "imagePackEditor.addToMine": "Ajouter aux miens",
    "imagePackEditor.addAllToMyPack":
        "Copier toutes les images de ce pack dans votre propre pack",
    "imagePackEditor.addImageToMyPack":
        "Copier cette image dans votre propre pack",
    "imagePackEditor.addedToYourPack":
        "{count, plural, one {# image ajoutée à votre pack.} other {# images ajoutées à votre pack.}}",
    "imagePackEditor.alreadyInYourPack": "Déjà dans votre pack.",
    "imagePackEditor.editDetails": "Modifier les détails",
    "imagePackEditor.deletePack": "Supprimer le pack",
    "imagePackEditor.confirmDeletePack":
        "Supprimer le pack « {name} » et toutes ses images ?",
    "imagePackEditor.useInAllRooms": "Utiliser dans tous mes salons",
    "imagePackEditor.useInAllRoomsHint":
        "Ses émojis et autocollants apparaissent partout où vous discutez.",
    "imagePackEditor.attribution": "Crédit : {value}",
    "imagePackEditor.attributionPlaceholder":
        "Crédit / attribution (facultatif)",
    "imagePackEditor.uploadPackAvatar": "Téléverser l'icône du pack",
    "imagePackEditor.removePackAvatar": "Retirer l'icône",
    "imagePackEditor.avatarReady":
        "Icône téléversée, enregistrez pour l'appliquer.",
    "sharedPackSettings.yourPackDetails": "Détails de votre pack",
    "sharedPackSettings.enabledEverywhere":
        "Packs activés dans tous les salons",
    "sharedPackSettings.enabledEverywhereHint":
        "Les packs des salons où vous êtes peuvent être utilisés dans tous les salons, pas seulement dans celui qui les possède.",
    "sharedPackSettings.availableInYourRooms": "Packs de vos salons",
    "sharedPackSettings.searchPacks": "Rechercher des packs",
    "sharedPackSettings.noPacksFound": "Aucun pack trouvé",
    "sharedPackSettings.noneEnabled": "Aucun pack activé dans tous les salons",
    "sharedPackSettings.enable": "Utiliser partout",
    "sharedPackSettings.disable": "Ne plus utiliser partout",
    "sharedPackSettings.remove": "Retirer",
    "sharedPackSettings.unavailable":
        "Indisponible : vous n'êtes plus dans {room} ou le pack a été supprimé",
    "sharedPackSettings.packSummary":
        "{room}, {count, plural, one {# image} other {# images}}",
    "sharedPackSettings.failedToSave": "Échec de l'enregistrement",
};

const catalogue: LocaleCatalogue = { messages, dateLocale: fr };

export default catalogue;
