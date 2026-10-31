// Spanish (es). Same keys and placeholders as ../en.ts; typed as a full `Record`
// so a new English string that is not yet translated here fails
// type-checking instead of silently showing English.

import { es } from "date-fns/locale/es";
import type { MessageKey } from "../en";
import type { LocaleCatalogue } from "../index";

const messages: Record<MessageKey, string> = {
    // Shared
    "common.turnOffCamera": "Apagar la cámara",
    "common.turnOnCamera": "Encender la cámara",
    "common.stopSharing": "Dejar de compartir",
    "common.shareYourScreen": "Compartir tu pantalla",
    "common.joining": "Uniéndose…",
    "common.join": "Unirse",
    "common.closeDialog": "Cerrar el cuadro de diálogo",
    "common.settings": "Ajustes",
    "common.searchResults": "Resultados de búsqueda",
    "common.default": "Predeterminado",
    "common.mute": "Silenciar",
    "common.saving": "Guardando…",
    "common.unblock": "Desbloquear",
    "common.block": "Bloquear",
    "common.closeMenu": "Cerrar el menú",
    "common.openRoomList": "Abrir la lista de salas",
    "common.uploading": "Subiendo…",
    "common.uploadImage": "Subir imagen",
    "common.emoji": "Emoji",
    "common.decline": "Rechazar",
    "common.invitePeople": "Invitar a personas",
    "common.close": "Cerrar",
    "common.cancel": "Cancelar",
    "common.loading": "Cargando…",
    "common.loadMore": "Cargar más",
    "common.notifications": "Notificaciones",
    "common.save": "Guardar",
    "common.topic": "Tema",
    "common.videoRoom": "Sala de vídeo",
    "common.reasonOptional": "Motivo (opcional)",
    "common.actions": "Acciones",
    "common.copy": "Copiar",
    "common.remove": "Quitar",
    "common.add": "Añadir",
    "common.starting": "Iniciando…",
    "common.verify": "Verificar",
    "common.removeFromFavourites": "Quitar de favoritos",
    "common.addToFavourites": "Añadir a favoritos",
    "common.stickers": "Stickers",
    "common.retry": "Reintentar",
    "common.delete": "Eliminar",
    "common.checking": "Comprobando…",
    "common.gifs": "GIF",
    "common.dragOrUseArrowKeysTo":
        "Arrastra o usa las flechas para cambiar el tamaño",
    "common.resizePicker": "Cambiar el tamaño del selector",
    "common.noResults": "Sin resultados",
    "common.memberCount": "{count, plural, one {# miembro} other {# miembros}}",
    "common.replyCount":
        "{count, plural, one {# respuesta} other {# respuestas}}",

    // src/lib/components/settings/AboutSettings.svelte
    "aboutSettings.automaticUpdates": "Actualizaciones automáticas",
    "aboutSettings.version": "Versión",
    "aboutSettings.currentVersionV": "Versión actual v{APP_VERSION}",
    "aboutSettings.checkForUpdates": "Buscar actualizaciones",
    "aboutSettings.updateAvailable": "Actualización disponible",
    "aboutSettings.reloading": "Recargando…",
    "aboutSettings.update": "Actualizar",
    "aboutSettings.reloadToUpdate": "Recargar para actualizar",
    "aboutSettings.youReOnTheLatestVersion": "Tienes la última versión.",
    "aboutSettings.credits": "Créditos",
    "aboutSettings.creditsMidiInstruments": "Instrumentos MIDI",
    "aboutSettings.creditsSoundFont":
        "por {author}, basado en Phoenix de {original}. Con licencia CC BY; reasignado a General MIDI y comprimido para Zam.",
    "aboutSettings.creditsSoundFontGaps":
        "Instrumentos que le faltan al MT-32: {microgm} de {microgmAuthor} (WTFPL) y {generalUser} de {generalUserAuthor}.",
    "aboutSettings.troubleshooting": "Solución de problemas",
    "aboutSettings.clearCacheAndResync": "Borrar la caché y resincronizar",
    "aboutSettings.reDownloadsYourRoomsFromThe":
        "Vuelve a descargar tus salas del servidor. Arregla salas que faltan o que se han quedado atascadas. No se cerrará tu sesión.",
    "aboutSettings.resyncing": "Resincronizando…",
    "aboutSettings.clearCache": "Borrar la caché",
    "aboutSettings.updateCheckFailed": "No se pudieron buscar actualizaciones",
    "aboutSettings.downloadFailed": "Error en la descarga",
    "aboutSettings.installFailed": "Error en la instalación",
    "aboutSettings.failedToCheckForUpdates":
        "No se pudieron buscar actualizaciones.",
    "aboutSettings.sourceCodeOnGitHub": "Código fuente en GitHub",

    // src/lib/components/settings/AccountSettings.svelte
    "accountSettings.profile": "Perfil",
    "accountSettings.yourAvatar": "Tu avatar",
    "accountSettings.changeAvatar": "Cambiar avatar",
    "accountSettings.yourDisplayName": "Tu nombre visible",
    "accountSettings.saved": "Guardado",
    "accountSettings.account": "Cuenta",
    "accountSettings.userId": "ID de usuario",
    "accountSettings.homeserver": "Servidor base",
    "accountSettings.connection": "Conexión",
    "accountSettings.presence": "Presencia",
    "accountSettings.password": "Contraseña",
    "accountSettings.currentPassword": "Contraseña actual",
    "accountSettings.newPassword": "Nueva contraseña",
    "accountSettings.confirmNewPassword": "Confirmar la nueva contraseña",
    "accountSettings.signOutAllOtherSessions":
        "Cerrar todas las demás sesiones",
    "accountSettings.changing": "Cambiando…",
    "accountSettings.changePassword": "Cambiar contraseña",
    "accountSettings.passwordChanged": "Contraseña cambiada.",
    "accountSettings.thisServerDoesNotAllowChanging":
        "Este servidor no permite cambiar tu contraseña desde esta aplicación.",
    "accountSettings.managedByProvider":
        "Tu contraseña, tus sesiones y tu cuenta se gestionan en la página de cuenta de tu proveedor de inicio de sesión.",
    "accountSettings.manageAccount": "Gestionar cuenta",
    "accountSettings.emailPhoneNumbers": "Correo y números de teléfono",
    "accountSettings.noEmailAddressesOrPhoneNumbers":
        "No hay direcciones de correo ni números de teléfono vinculados a esta cuenta.",
    "accountSettings.email": "Correo electrónico",
    "accountSettings.phone": "Teléfono",
    "accountSettings.thisServerDoesNotAllowManaging":
        "Este servidor no permite gestionarlos desde esta aplicación.",
    "accountSettings.logOut": "Cerrar sesión",
    "accountSettings.dangerZone": "Zona de peligro",
    "accountSettings.deactivateAccount": "Desactivar la cuenta…",
    "accountSettings.deactivationIsPermanentAndCannotBe":
        "La desactivación es permanente y no se puede deshacer.",
    "accountSettings.eraseMessagesWherePossible":
        "Borrar los mensajes cuando sea posible",
    "accountSettings.deactivating": "Desactivando…",
    "accountSettings.deactivateAccount2": "Desactivar la cuenta",
    "accountSettings.avatarUploadFailed": "No se pudo subir el avatar",
    "accountSettings.failedToRemoveAvatar": "No se pudo quitar el avatar",
    "accountSettings.failedToSaveName": "No se pudo guardar el nombre",
    "accountSettings.couldNotSetPresence": "No se pudo establecer la presencia",
    "accountSettings.failedToChangePassword":
        "No se pudo cambiar la contraseña",
    "accountSettings.failedToDeactivateAccount":
        "No se pudo desactivar la cuenta",

    // src/lib/components/layout/AccountSwitcher.svelte
    "accountSwitcher.signOut": "Cerrar la sesión de {userId}",
    "accountSwitcher.confirm": "Confirmar",
    "accountSwitcher.signOut2": "Cerrar sesión",
    "accountSwitcher.addAccount": "Añadir cuenta",
    "accountSwitcher.accountMenu": "Menú de la cuenta",
    "accountSwitcher.closeAccountMenu": "Cerrar el menú de la cuenta",
    "accountSwitcher.back": "Atrás",
    "accountSwitcher.setYourStatus": "Establecer tu estado",
    "accountSwitcher.setAStatus": "Establecer un estado",
    "accountSwitcher.editProfile": "Editar perfil",
    "accountSwitcher.switchAccounts": "Cambiar de cuenta",
    "accountSwitcher.couldNotSetPresence": "No se pudo establecer la presencia",

    // src/lib/components/layout/ActiveCallBanner.svelte
    "activeCallBanner.openCall": "Abrir la llamada",
    "activeCallBanner.open": "Abrir",
    "activeCallBanner.ringing": "Llamando…",
    "activeCallBanner.voiceCallInCall":
        "Llamada de voz · {length} en la llamada",
    "activeCallBanner.leave": "Salir",

    // src/lib/components/settings/AppearanceSettings.svelte
    "appearanceSettings.rightAlignMyMessagesBubbleLayout":
        "Alinear mis mensajes a la derecha (diseño de burbujas)",
    "appearanceSettings.displayYourOwnMessagesOnThe":
        "Muestra tus propios mensajes a la derecha en una burbuja de color",
    "appearanceSettings.showNameColours": "Mostrar los colores de los nombres",
    "appearanceSettings.drawPeopleSNamesInThe":
        "Muestra los nombres de las personas en el color que eligieron en su perfil. Desactívalo para usar el color de texto normal para todos.",
    "appearanceSettings.keepRoomListOpen": "Mantener abierta la lista de salas",
    "appearanceSettings.donTAutoCloseTheRoom":
        "No cerrar automáticamente la lista de salas al cambiar entre espacios o Inicio. Abrir una sala o un mensaje directo siempre la cierra.",
    "appearanceSettings.timestamps": "Marcas de tiempo",
    "appearanceSettings.timeFormat": "Formato de hora",
    "appearanceSettings.dateFormat": "Formato de fecha",
    "appearanceSettings.customDatePattern": "Patrón de fecha personalizado",
    "appearanceSettings.yyyyMmDd": "yyyy-MM-dd",
    "appearanceSettings.preview": "Vista previa:",
    "appearanceSettings.dateFnsTokensEGYyyy":
        "· tokens de date-fns, p. ej. yyyy-MM-dd",
    "appearanceSettings.invalidFormatUseLowercaseDateFns":
        "Formato no válido: usa tokens de date-fns en minúscula como yyyy-MM-dd.",
    "appearanceSettings.alwaysShowAbsoluteDates":
        "Mostrar siempre fechas absolutas",
    "appearanceSettings.replaceTodayAndYesterdayWithThe":
        'Sustituye "Hoy" y "Ayer" por la fecha completa en todas partes.',
    "appearanceSettings.reduceMotion": "Reducir el movimiento",
    "appearanceSettings.minimizeAnimationsAndTransitionsYourDevice":
        'Minimiza las animaciones y transiciones. El ajuste "reducir movimiento" del sistema de tu dispositivo también se respeta siempre.',
    "appearanceSettings.custom": "Personalizado",
    "appearanceSettings.12Hour": "12 horas",
    "appearanceSettings.24Hour": "24 horas",
    "appearanceSettings.language": "Idioma",
    "appearanceSettings.layout": "Diseño",
    "appearanceSettings.displayLanguage": "Idioma de la interfaz",
    "appearanceSettings.displayLanguageHint":
        "El idioma en el que se muestran los menús y botones de Zam. Al cambiarlo se recarga la aplicación.",

    // src/routes/app/+page.svelte
    "appPage.redirecting": "Redirigiendo…",

    // src/lib/components/layout/AppSettings.svelte
    "appSettings.backToSettings": "Volver a los ajustes",
    "appSettings.closeSettings": "Cerrar los ajustes",
    "appSettings.searchSettings": "Buscar en los ajustes…",
    "appSettings.searchSettings2": "Buscar en los ajustes",
    "appSettings.noSettingsMatch": "Ningún ajuste coincide",
    "appSettings.noSettingsMatch2":
        'Ningún ajuste coincide con "{searchQuery}".',
    "appSettings.resultCount":
        "{count, plural, one {# resultado} other {# resultados}}",

    // src/lib/components/layout/AppShell.svelte
    "appShell.zam": "({notificationCount}) Zam",
    "appShell.redirecting": "Redirigiendo…",
    "appShell.noRoomsYet": "Todavía no hay salas",
    "appShell.resizeRoomList": "Cambiar el tamaño de la lista de salas",
    "appShell.createARoomOrStartA":
        "Crea una sala o inicia un mensaje directo para empezar.",
    "appShell.nothingInHome": "No hay nada en Inicio",
    "appShell.allOfYourRoomsLiveIn":
        "Todas tus salas están en espacios: abre uno para verlas. Aquí aparecen las salas y los mensajes directos que no pertenecen a ningún espacio.",
    "appShell.openRoomList": "Abrir la lista de salas",
    "appShell.someone": "Alguien",
    "appShell.isCalling": "{name} te está llamando",
    "appShell.incomingCall": "Llamada entrante",
    "appShell.offlineMessageStorageIsUnavailableThis":
        "El almacenamiento de mensajes sin conexión no está disponible en esta sesión, así que el historial no se guardará para la próxima vez.",
    "appShell.couldnTSendYourReplyIt":
        "No se pudo enviar tu respuesta. Se ha guardado como borrador.",
    "appShell.yourNotificationReplyWasSavedAs":
        "Tu respuesta desde la notificación se guardó como borrador",

    // src/lib/components/settings/BlockedUsersSettings.svelte
    "blockedUsersSettings.messagesFromBlockedUsersAreHidden":
        "Los mensajes de los usuarios bloqueados se ocultan en todas las salas. La lista se guarda en tu cuenta y se aplica a todas tus sesiones.",
    "blockedUsersSettings.youHavenTBlockedAnyone": "No has bloqueado a nadie.",
    "blockedUsersSettings.failed": "Error",

    // src/lib/components/layout/CallParticipantMenu.svelte
    "callParticipantMenu.profile": "Perfil",
    "callParticipantMenu.input": "Entrada",
    "callParticipantMenu.output": "Salida",
    "callParticipantMenu.opening": "Abriendo…",
    "callParticipantMenu.message": "Mensaje",
    "callParticipantMenu.mention": "Mencionar",
    "callParticipantMenu.userVolume": "Volumen del usuario",
    "callParticipantMenu.soundboardVolume": "Soundboard Volume",
    "callParticipantMenu.hideVideo": "Ocultar vídeo",
    "callParticipantMenu.kicking": "Expulsando…",
    "callParticipantMenu.confirmKick": "¿Confirmar la expulsión de {name}?",
    "callParticipantMenu.kickFromRoom": "Expulsar a {name} de la sala",
    "callParticipantMenu.banning": "Vetando…",
    "callParticipantMenu.confirmBan": "¿Confirmar el veto a {name}?",
    "callParticipantMenu.ban": "Vetar a {name}",
    "callParticipantMenu.couldNotOpenADirectMessage":
        "No se pudo abrir un mensaje directo",
    "callParticipantMenu.couldNotKick": "No se pudo expulsar a {name}",
    "callParticipantMenu.couldNotBan": "No se pudo vetar a {name}",

    // src/lib/components/layout/CallView.svelte
    "callEncryption.encrypted":
        "Cifrada de extremo a extremo: solo las personas de esta llamada pueden verla y oírla.",
    "callEncryption.encryptedShort": "Cifrada",
    "callEncryption.partial":
        "Cifrada de extremo a extremo, salvo {names}: su aplicación envía audio y vídeo sin cifrar. Tú puedes oírles y verles, pero ellos no a ti hasta que su aplicación admita llamadas cifradas.",
    "callEncryption.partialShort": "Cifrada en parte",
    "callEncryption.notEncrypted":
        "No está cifrada de extremo a extremo: el servidor de llamadas puede ver y oír esta llamada. Las llamadas en salas cifradas sí lo están.",
    "callView.ringing": "Llamando…",
    "callView.showChat": "Mostrar el chat",
    "callView.noOneIsInThisCall": "No hay nadie en esta llamada",
    "callView.backToGrid": "Volver a la cuadrícula",
    "callView.screenShareQuality": "Calidad de la pantalla compartida",
    "callView.optionsFor": "Opciones para {name}",
    "callView.muted": "Silenciado",
    "callView.deafened": "Ensordecido",
    "callView.mutedForYou": "Silenciado para ti",
    "callView.joinedFromMultipleDevices": "Conectado desde varios dispositivos",
    "callView.devices": "{value} dispositivos",
    "callView.enableAudio": "Activar el audio",
    "callView.onHold": "En espera mientras hay otra llamada activa",
    "callView.resume": "Reanudar",
    "callView.speakerOn": "Usar el altavoz",
    "callView.speakerOff": "Dejar de usar el altavoz",
    "callView.unmute": "Activar el micrófono",
    "callView.undeafen": "Activar el sonido",
    "callView.deafen": "Ensordecer",
    "callView.disconnect": "Desconectar",
    "callView.joinCall": "Unirse a la llamada",
    "callView.you": "Tú",
    "callView.sScreen": "Pantalla de {name}",
    "callView.exitSpotlightFor": "Quitar el foco de {label}",
    "callView.spotlight": "Poner el foco en {label}",

    // src/lib/components/messages/CreatePollDialog.svelte
    "createPollDialog.createPoll": "Crear encuesta",
    "createPollDialog.question": "Pregunta",
    "createPollDialog.askSomething": "Pregunta algo…",
    "createPollDialog.options": "Opciones",
    "createPollDialog.option": "Opción {value}",
    "createPollDialog.removeOption": "Quitar opción",
    "createPollDialog.addOption": "+ Añadir opción",
    "createPollDialog.results": "Resultados",
    "createPollDialog.showAsPeopleVote": "Mostrar a medida que se vota",
    "createPollDialog.hideUntilClosed": "Ocultar hasta que se cierre",
    "createPollDialog.allowSelectingMultipleOptions":
        "Permitir seleccionar varias opciones",
    "createPollDialog.creating": "Creando…",
    "createPollDialog.failedToCreatePoll": "No se pudo crear la encuesta",

    // src/lib/components/layout/CryptoUnavailableBanner.svelte
    "cryptoUnavailableBanner.offOutOfStorage":
        "El cifrado está desactivado en este dispositivo porque se quedó sin almacenamiento: no se pueden leer ni enviar mensajes cifrados. Libera espacio y vuelve a intentarlo.",
    "cryptoUnavailableBanner.offLocked":
        "El cifrado está desactivado en este dispositivo porque una notificación aún estaba usando sus claves: no se pueden leer ni enviar mensajes cifrados.",
    "cryptoUnavailableBanner.offOther":
        "El cifrado está desactivado en este dispositivo: no se pueden leer ni enviar mensajes cifrados y sus claves de cifrado no se publicaron.",
    "cryptoUnavailableBanner.tryAgain": "Reintentar",
    "cryptoUnavailableBanner.freeUpSpaceFirst": "Libera espacio primero",
    "cryptoUnavailableBanner.syncPaused":
        "El cifrado no pudo iniciarse, así que esta sesión dejó de sincronizar para conservar las claves que otros te envían. Recarga para intentarlo de nuevo.",
    "cryptoUnavailableBanner.dismissEncryptionWarning":
        "Descartar el aviso de cifrado",

    // src/lib/components/layout/SoundboardPopover.svelte, settings/SoundPackEditor.svelte
    "soundboard.title": "Soundboard",
    "soundboard.yourVolume": "Your sounds volume",
    "soundboard.empty":
        "No sounds yet. Add some under Settings, Emotes, or in a room's settings.",
    "soundboard.sendFailed": "Couldn't send that sound to the call.",
    "soundboard.add": "Add a sound",
    "soundboard.limits": "Audio files up to {seconds} seconds and {kb} KB.",
    "soundboard.pack": "Pack",
    "soundboard.newPack": "New pack",
    "soundboard.packName": "Pack name",
    "soundboard.enterAPackName": "Enter a pack name.",
    "soundboard.name": "Sound name",
    "soundboard.upload": "Upload sound",
    "soundboard.uploadFailed": "Couldn't upload the sound.",
    "soundboard.removeFailed": "Couldn't remove that.",
    "soundboard.previewFailed": "Couldn't play that sound.",
    "soundboard.preview": "Preview",
    "soundboard.remove": "Remove sound",
    "soundboard.noSounds": "No sounds in this pack",
    "soundboard.deletePack": "Delete pack",
    "soundboard.confirmDeletePack":
        'Delete the pack "{name}" and all its sounds?',
    "soundboard.inheritedFrom": "From {sourceName}",
    "soundboard.addToMine": "Add to mine",
    "soundboard.addedToYours":
        "{count, plural, one {Added # sound to your pack.} other {Added # sounds to your pack.}}",
    "soundboard.alreadyYours": "Already in your pack.",
    // src/lib/matrix/soundboard.ts
    "soundboard.badName":
        "Use 1 to 48 letters, numbers, spaces, dots, dashes or underscores.",
    "soundboard.noPermission": "You can't edit sounds in this room.",
    "soundboard.notAudio": "That isn't an audio file.",
    "soundboard.tooBig": "That file is too big.",
    "soundboard.tooLong": "Sounds can be at most {seconds} seconds long.",
    "soundboard.unreadable": "Couldn't read that audio file.",

    // src/lib/components/settings/CustomPackSettings.svelte
    "customPackSettings.add": "Añadir {singular}",
    "customPackSettings.shortcode": "código corto",
    "customPackSettings.sticker": "Sticker",
    "customPackSettings.remove": "Quitar {toLowerCase}",
    "customPackSettings.image": "Imagen",
    "customPackSettings.chooseAtLeastOneUsage": "Elige al menos un uso.",
    "customPackSettings.uploadFailed": "Error al subir",
    "customPackSettings.failedToRemove": "No se pudo quitar {singular}",
    "customPackSettings.failedToUpdateUsage": "No se pudo actualizar el uso",
    "customPackSettings.noCustomImages": "No hay imágenes personalizadas",
    "customPackSettings.noCustomEmojis": "No hay emojis personalizados",
    "customPackSettings.noCustomStickers": "No hay stickers personalizados",

    // src/lib/components/debug/DebugEventItem.svelte
    "debugEventItem.stateKey": "state_key",
    "debugEventItem.empty": "(vacío)",
    "debugEventItem.redacted": "CENSURADO",
    "debugEventItem.id": "id: {eventId}",

    // src/lib/components/debug/DebugPanel.svelte
    "debugPanel.debugPanel": "PANEL DE DEPURACIÓN",
    "debugPanel.sync": "Sincronización:",
    "debugPanel.refresh": "↻ actualizar",
    "debugPanel.copied": "✓ copiado",
    "debugPanel.copy": "⧉ copiar",
    "debugPanel.unreadState": "ESTADO DE NO LEÍDOS",
    "debugPanel.unread": "no leídos:",
    "debugPanel.highlight": "destacados:",
    "debugPanel.userid": "userId:",
    "debugPanel.readuptoid": "readUpToId:",
    "debugPanel.readidxInTimeline": "readIdx en la cronología:",
    "debugPanel.noReceipt": "sin confirmación",
    "debugPanel.n1NotInWindow": "-1 (¡fuera de la ventana!)",
    "debugPanel.events": "/ {totalEvents} eventos",
    "debugPanel.lastEventSender": "remitente del último evento:",
    "debugPanel.me": "(yo:",
    "debugPanel.notificationEventsAfterReadMarker":
        "eventos de notificación tras el marcador de lectura:",
    "debugPanel.from": "[{formatTs}] {getType} de {value} - {msgPreview}",
    "debugPanel.pushRules": "REGLAS DE NOTIFICACIÓN",
    "debugPanel.default": "(predeterminada)",
    "debugPanel.actions": "acciones: {stringify}",
    "debugPanel.conditions": "condiciones: {stringify}",
    "debugPanel.noPushRulesFound": "no se encontraron reglas de notificación",
    "debugPanel.readReceiptsEventsWithReceipts":
        "CONFIRMACIONES DE LECTURA ({length} eventos con confirmaciones)",
    "debugPanel.noReceipts": "sin confirmaciones",
    "debugPanel.urlPreviewInspector": "INSPECTOR DE VISTAS PREVIAS DE URL",
    "debugPanel.https": "https://...",
    "debugPanel.storeMessagesWhatTheUiRenders":
        "MENSAJES DEL ALMACÉN ({length}) - lo que muestra la interfaz",
    "debugPanel.redacted": "CENSURADO",
    "debugPanel.rel": "rel={relType}",
    "debugPanel.empty": "vacío",
    "debugPanel.pendingEvents": "EVENTOS PENDIENTES ({length})",
    "debugPanel.rawTimelineEvents": "CRONOLOGÍA EN BRUTO ({length} eventos)",

    // src/lib/components/settings/GpuDebug.svelte
    "gpuDebug.title": "GPU",
    "gpuDebug.hardwareAcceleration": "Aceleración por hardware",
    "gpuDebug.hardwareAccelerationHint":
        "Desactívala si los vídeos se ven en negro o la ventana se dibuja mal. Se aplica tras reiniciar.",
    "gpuDebug.restartToApply": "Reinicia Zam para aplicar este cambio.",
    "gpuDebug.restart": "Reiniciar",
    "gpuDebug.videoDecoding": "Decodificación de vídeo",
    "gpuDebug.decodeHardware": "Hardware",
    "gpuDebug.decodeSoftware": "Software",
    "gpuDebug.decodeUnsupported": "No compatible",
    "gpuDebug.videoEncode": "Codificación de vídeo por hardware",
    "gpuDebug.videoEncodeHint":
        "Codifica tu cámara y tu pantalla compartida en la GPU (VA-API) para los códecs que admite tu controlador. Desactívalo si los demás ven tu imagen en negro, congelada o dañada. Se aplica tras reiniciar.",
    "gpuDebug.videoEncoding": "Codificación de vídeo",
    "gpuDebug.videoEncodingHint":
        "Las llamadas envían el códec elegido en Voz y vídeo (H.264 por defecto). El panel de estadísticas de la llamada muestra qué codificador usa.",
    "gpuDebug.encodeTest": "Ejecutar prueba de codificación H.264",
    "gpuDebug.encodeTestHint":
        "Codifica 60 fotogramas por tamaño como lo hace una llamada. El hardware debería ser mucho más rápido por fotograma que el software.",
    "gpuDebug.encodeTestRejected": "Rechazado por el codificador",
    "gpuDebug.encodeTestResult": "{chunks} fragmentos, {ms} ms por fotograma",
    "gpuDebug.skiaGraphite": "Renderizador Skia Graphite (experimental)",
    "gpuDebug.skiaGraphiteHint":
        "Dibuja la interfaz con el renderizador Graphite de Chromium en lugar de Ganesh. Actívalo para probar el renderizado, o desactívalo si la ventana parpadea o se dibuja mal. Requiere aceleración por hardware. Se aplica tras reiniciar.",
    "gpuDebug.skiaGraphiteFailed":
        "Desactivado automáticamente porque falló al iniciar o bloqueó el proceso de GPU. Actívalo de nuevo para reintentar.",
    "gpuDebug.nvidiaEncode": "Codificación de vídeo NVIDIA (experimental)",
    "gpuDebug.nvidiaEncodeHint":
        "Codifica las llamadas y pantallas compartidas en H.264 con NVENC, mediante el controlador VA-API propio de Zam. La decodificación de vídeo sigue como está configurada arriba. Se aplica tras reiniciar.",
    "gpuDebug.featureStatus": "Estado de las funciones",
    "gpuDebug.details": "Detalles",
    "gpuDebug.nvidiaVideo": "Decodificación de vídeo NVIDIA",
    "gpuDebug.nvidiaVideoHint":
        "Decodifica el vídeo en GPU NVIDIA con el renderizador Vulkan de Chromium. En automático se activa cuando una GPU NVIDIA controla tus pantallas.",
    "gpuDebug.nvidiaVideoActive": "En uso ahora.",
    "gpuDebug.nvidiaVideoInactive": "Sin usar ahora.",
    "gpuDebug.nvidiaVideoFailed":
        "Zam volvió a la ruta GL después de que fallara el proceso de la GPU. Elige Vulkan para intentarlo de nuevo.",
    "gpuDebug.nvidiaVideoAuto": "Automático",
    "gpuDebug.nvidiaVideoVulkan": "Vulkan",
    "gpuDebug.nvidiaVideoOff": "Desactivado",
    "settingsNav.keybinds": "Atajos de teclado",
    "settingsSearch.keyboardShortcuts": "Atajos de teclado",
    "keybinds.intro":
        "Haz clic en un atajo para cambiarlo y pulsa las teclas nuevas. Los atajos funcionan mientras Zam está en primer plano. Pulsar para hablar y pulsar para silenciar también pueden usar un botón lateral del ratón o una sola tecla modificadora.",
    "keybinds.resetAll": "Restablecer todo",
    "keybinds.removedFrom": "Esas teclas se quitaron de: {actions}",
    "keybinds.changeFor": "Cambiar el atajo de {action}",
    "keybinds.pressKey": "Pulsa las teclas… (Esc cancela)",
    "keybinds.pressKeyOrButton":
        "Pulsa una tecla o un botón del ratón… (Esc cancela)",
    "keybinds.notSet": "Sin asignar",
    "keybinds.clear": "Quitar atajo",
    "keybinds.clearFor": "Quitar el atajo de {action}",
    "keybinds.reset": "Restablecer valor predeterminado",
    "keybinds.resetFor": "Restablecer {action} a su valor predeterminado",
    "keybinds.pushToTalkHint":
        "Asignar una tecla activa pulsar para hablar: en las llamadas tu micrófono solo transmite mientras la mantienes pulsada.",
    "keybinds.pushToMuteHint":
        "Tu micrófono se silencia mientras la mantienes pulsada.",
    "keybinds.globalVoice": "Funcionar cuando Zam no está en primer plano",
    "keybinds.globalVoiceHint":
        "Pulsar para hablar, pulsar para silenciar, silenciar el micrófono y ensordecer también funcionan mientras estás en otra aplicación. Zam solo escucha las teclas asignadas a ellos y no se las quita a otras aplicaciones.",
    "keybinds.globalWayland":
        "No disponible aquí: este escritorio Wayland no ofrece atajos globales a las aplicaciones (el portal GlobalShortcuts), así que los atajos de voz solo funcionan mientras Zam está en primer plano.",
    "keybinds.globalPermission":
        "macOS tiene que permitirlo primero: activa Zam en Ajustes del Sistema > Privacidad y seguridad > Accesibilidad y vuelve a Zam.",
    "keybinds.globalOpenSettings": "Abrir Ajustes del Sistema",
    "keybinds.globalError":
        "Zam no pudo empezar a escuchar teclas en otras aplicaciones ({error}). Los atajos de voz funcionan mientras Zam está en primer plano.",
    "keybinds.globalPortalHint":
        "Pulsar para hablar, pulsar para silenciar, silenciar el micrófono y ensordecer también funcionan mientras estás en otra aplicación. En Wayland tu escritorio gestiona estos atajos para Zam: puede pedirte que los confirmes o elegir otras teclas, y las demás aplicaciones dejan de recibir esas teclas.",
    "keybinds.globalPortalAssigned": "Teclas que asignó tu escritorio:",
    "keybinds.globalPortalMouse":
        "Los botones del ratón no pueden ser atajos del escritorio: elige una tecla para ellos en los ajustes de tu escritorio.",
    "keybinds.globalPortalConfigure": "Cambiar en los ajustes del sistema",
    "keybinds.globalPortalError":
        "Tu escritorio no configuró los atajos ({error}). Desactiva y vuelve a activar esta opción para reintentarlo.",
    "keybinds.helpTitle": "Atajos de teclado",
    "keybinds.customize": "Personalizar",
    "keybinds.category.navigation": "Navegación",
    "keybinds.category.chat": "Chat",
    "keybinds.category.voice": "Voz y llamadas",
    "keybinds.category.app": "Aplicación",
    "keybinds.action.quickSwitcher": "Selector rápido",
    "keybinds.action.prevChannel": "Canal anterior",
    "keybinds.action.nextChannel": "Canal siguiente",
    "keybinds.action.prevUnreadChannel": "Canal sin leer anterior",
    "keybinds.action.nextUnreadChannel": "Canal sin leer siguiente",
    "keybinds.action.prevMentionChannel": "Canal anterior con menciones",
    "keybinds.action.nextMentionChannel": "Canal siguiente con menciones",
    "keybinds.action.prevServer": "Espacio anterior",
    "keybinds.action.nextServer": "Espacio siguiente",
    "keybinds.action.navigateBack": "Atrás",
    "keybinds.action.navigateForward": "Adelante",
    "keybinds.action.previousTextChannel": "Volver al canal anterior",
    "keybinds.action.returnToCall": "Volver a la llamada",
    "keybinds.action.markChannelRead": "Marcar canal como leído",
    "keybinds.action.markServerRead": "Marcar espacio como leído",
    "keybinds.action.jumpToOldestUnread": "Ir al mensaje sin leer más antiguo",
    "keybinds.action.emojiPicker": "Selector de emojis",
    "keybinds.action.gifPicker": "Selector de GIF",
    "keybinds.action.stickerPicker": "Selector de stickers",
    "keybinds.action.uploadFile": "Subir un archivo",
    "keybinds.action.search": "Buscar",
    "keybinds.action.togglePins": "Mensajes fijados",
    "keybinds.action.toggleInbox": "Bandeja de notificaciones",
    "keybinds.action.toggleMembers": "Lista de miembros",
    "keybinds.action.toggleMute": "Silenciar/activar micrófono",
    "keybinds.action.toggleDeafen": "Ensordecer/activar audio",
    "keybinds.action.pushToTalk": "Pulsar para hablar",
    "keybinds.action.pushToMute": "Pulsar para silenciar",
    "keybinds.action.answerCall": "Responder llamada entrante",
    "keybinds.action.declineCall": "Rechazar llamada entrante",
    "keybinds.action.startCall": "Iniciar o unirse a una llamada en esta sala",
    "keybinds.action.toggleCamera": "Activar/desactivar cámara",
    "keybinds.action.toggleScreenShare": "Iniciar/detener pantalla compartida",
    "keybinds.action.leaveCall": "Salir de la llamada",
    "keybinds.action.openSettings": "Abrir ajustes",
    "keybinds.action.createDm": "Nuevo mensaje directo",
    "draftDm.intro": "Este es el comienzo de tus mensajes directos con {name}.",
    "draftDm.lazyNote":
        "No se crea nada hasta que envíes tu primer mensaje. Entonces se invitará a {name}.",
    "draftDm.placeholder": "Mensaje para {name}",
    "draftDm.send": "Enviar",
    "draftDm.starting": "Iniciando conversación...",
    "draftDm.encrypted": "Tendrá cifrado de extremo a extremo",
    "draftDm.discard": "Descartar borrador",
    "draftDm.couldNotStart": "No se pudo iniciar la conversación",
    "keybinds.action.createOrJoinSpace": "Crear o unirse a un espacio",
    "keybinds.action.shortcutsHelp": "Mostrar atajos de teclado",
    "keybinds.action.toggleDebug": "Mostrar/ocultar panel de depuración",
    "quickSwitcher.title": "¿Adónde quieres ir?",
    "quickSwitcher.placeholder": "Buscar salas, mensajes directos y espacios",
    "quickSwitcher.recentAndUnread": "Recientes y sin leer",
    "quickSwitcher.noResults": "Sin coincidencias",
    "quickSwitcher.mentioned": "Mencionado",
    "quickSwitcher.space": "Espacio",
    "quickSwitcher.home": "Inicio",
    "quickSwitcher.hint": "↑↓ para moverte, Intro para abrir, Esc para cerrar",

    // src/lib/components/settings/DebugSettings.svelte
    "debugSettings.developer": "Desarrollador",
    "debugSettings.showAllEvents": "Mostrar todos los eventos",
    "debugSettings.displayEveryMatrixTimelineEventIn":
        "Muestra cada evento de la cronología de Matrix en el historial del chat.",
    "debugSettings.ignoreCodecSupport": "Ignore reported codec support",
    "debugSettings.ignoreCodecSupportHint":
        "Send the picked codec even if others say they can't decode it, and accept every codec this device lists (including ones blocked as broken). For testing, e.g. HEVC on Linux.",
    "debugSettings.h264ProfileFix": "GPU H.264 profile fix",
    "debugSettings.h264ProfileFixHint":
        "Calls use the GPU H.264 encoder even when the server answers with Constrained Baseline, which Chromium encodes in software. Turn off to see the encoder a call gets without it. On Windows desktop the Chromium flag changes after a restart.",
    "debugSettings.voiceProcessing": "Voice processing",
    "debugSettings.pauseGate": "Pause gate",
    "debugSettings.pauseGateHint":
        "Takes an extra 20 dB off pauses after noise removal. Off by default; may clip quiet word starts.",
    "debugSettings.noiseAttenuationLimit": "Noise removal limit: {value} dB",
    "debugSettings.noiseAttenuationLimitHint":
        "The most the noise filter (DeepFilterNet3 or DPDFNet) may take off any part of the signal (default {value}). 100 is unlimited.",
    "debugSettings.syncStatus": "Estado de la sincronización",
    "debugSettings.clientLogs": "Registros del cliente",
    "debugSettings.clientLogsHint":
        "Todo lo que la aplicación ha registrado desde que se inició, sin tokens, contraseñas ni claves. Envíalo al informar de un error.",
    "debugSettings.copyLogs": "Copiar registros",
    "debugSettings.saveLogs": "Guardar registros",
    "debugSettings.clientLogsCopyFailed": "No se pudieron copiar los registros",
    "debugSettings.clientLogsSaveFailed":
        "No se pudieron guardar los registros",
    "debugSettings.webViewDebugging": "Depuración de WebView",
    "debugSettings.webViewDebuggingHint":
        "Permite que un ordenador conectado por USB inspeccione la aplicación en chrome://inspect. Sigue activada tras reiniciar hasta que la desactives.",
    "debugSettings.syncLog": "Registro de sincronización",
    "debugSettings.syncLogEmpty":
        "Todavía no hay nada registrado. Aquí aparecen los reinicios, las solicitudes fallidas y los reinicios de la cronología.",
    "debugSettings.refresh": "Actualizar",
    "debugSettings.copied": "Copiado",
    "debugSettings.useSlidingSync": "Usar sincronización deslizante",
    "debugSettings.experimentalLoadsRoomsInAGrowing":
        "Experimental. Carga las salas en una ventana que va creciendo. Recarga la aplicación para aplicarlo.",
    "debugSettings.pushStatus": "Estado de las notificaciones push",
    "debugSettings.lastError": "Último error: {lastError}",
    "debugSettings.runDiagnostics": "Ejecutar diagnóstico",
    "debugSettings.homeserverPushers": "Pushers del servidor base",
    "debugSettings.theHomeserverHasNoPushersRegistered":
        "El servidor base no tiene pushers registrados para esta cuenta.",
    "debugSettings.aPusherMatchesTheConfiguredGateway":
        "Un pusher coincide con la URL de la pasarela configurada.",
    "debugSettings.noPusherMatchesTheConfiguredGateway":
        "Ningún pusher coincide con la URL de la pasarela configurada.",
    "debugSettings.appId": "app_id: {app_id}",
    "debugSettings.none": "(ninguno)",
    "debugSettings.url": "url: {value}",
    "debugSettings.pushkey": "pushkey: {pushkeyPreview}",
    "debugSettings.webPushPwa": "Web Push (PWA)",
    "debugSettings.missing": "(falta)",
    "debugSettings.vapidKey": "Clave VAPID: {value}",
    "debugSettings.permission": "permiso: {permission}",
    "debugSettings.subscription": "suscripción: {value}",
    "debugSettings.notFound": "no encontrado",
    "debugSettings.homeserverPusher": "pusher del servidor base: {value}",
    "debugSettings.error": "error: {error}",
    "debugSettings.gatewaySygnalFirebase": "Pasarela (Sygnal / Firebase)",
    "debugSettings.gatewayReachable": "Pasarela accesible",
    "debugSettings.gatewayNotReachable": "Pasarela no accesible",
    "debugSettings.nativeSessionPushEnrichment":
        "Sesión nativa (enriquecimiento de notificaciones push)",
    "debugSettings.homeserver": "servidor base: {value}",
    "debugSettings.user": "usuario: {value}",
    "debugSettings.device": "dispositivo: {value}",
    "debugSettings.accessToken": "token de acceso: {value}",
    "debugSettings.hideMessageText": "ocultar el texto del mensaje: {value}",
    "debugSettings.notificationRulesServer":
        "Reglas de notificación (servidor)",
    "debugSettings.syncMode": "Modo de sincronización",
    "debugSettings.slidingSyncMsc4186": "Sincronización deslizante (MSC4186)",
    "debugSettings.classicSyncV2": "/sync clásico (v2)",
    "debugSettings.syncState": "Estado de la sincronización",
    "debugSettings.fallback": "Alternativa",
    "debugSettings.slidingSyncEndpoint":
        "Endpoint de sincronización deslizante",
    "debugSettings.joinedRoomsLoaded": "Salas unidas cargadas",
    "debugSettings.roomListWindow": "Ventana de la lista de salas",
    "debugSettings.of": "{requested} de {total}",
    "debugSettings.platform": "Plataforma",
    "debugSettings.nativeCapacitor": "Nativa (Capacitor)",
    "debugSettings.pushEnabledInBuild":
        "Notificaciones push activadas en la compilación",
    "debugSettings.yes": "Sí",
    "debugSettings.no": "No",
    "debugSettings.hideUpdatePrompts": "Ocultar avisos de actualización",
    "debugSettings.hideUpdatePromptsHint":
        "Oculta el banner y el aviso de actualización. Se siguen buscando actualizaciones y se instalan solas si las actualizaciones automáticas están activadas.",
    "debugSettings.gatewayUrl": "URL de la pasarela",
    "debugSettings.appId2": "ID de la aplicación",
    "debugSettings.notificationPermission": "Permiso de notificaciones",
    "debugSettings.fcmToken": "Token de FCM",
    "debugSettings.pushProvider": "Proveedor de notificaciones push",
    "debugSettings.unifiedPushDistributor": "Distribuidor de UnifiedPush",
    "debugSettings.unifiedPushEndpoint": "Endpoint de UnifiedPush",
    "debugSettings.unifiedPushGateway": "Pasarela de UnifiedPush",
    "debugSettings.pusherRegisteredThisSession":
        "Pusher registrado en esta sesión",
    "debugSettings.failedToFetchPushersFromHomeserver":
        "No se pudieron obtener los pushers del servidor base.",
    "debugSettings.set": "establecido",
    "debugSettings.active": "activo",
    "debugSettings.allNotificationsMasterRule":
        "Todas las notificaciones (regla maestra)",

    // src/lib/components/ui/EmojiPicker.svelte
    "emojiPicker.searchEmoji": "Buscar emoji…",
    "emojiPicker.searchEmoji2": "Buscar emoji",
    "emojiPicker.myEmojis": "Mis emojis",
    "emojiPicker.custom": "Personalizados",
    "emojiPicker.standard": "Estándar",
    "emojiPicker.myEmojis2": "Mis emojis",

    // src/lib/components/ui/ErrorToasts.svelte
    "errorToasts.dismiss": "Descartar",

    // src/lib/components/settings/ExtendedProfileDebug.svelte
    "extendedProfileDebug.extendedProfile": "Perfil ampliado",
    "extendedProfileDebug.fetchFromServer": "Obtener del servidor",
    "extendedProfileDebug.thisServerDoesNotSupportExtended":
        "Este servidor no admite perfiles ampliados.",
    "extendedProfileDebug.noneOrTheServerRefused":
        "ninguno, o el servidor lo rechazó",
    "extendedProfileDebug.presenceGetPresenceStraightFromThe":
        "Presencia (GET /presence, directamente del servidor): {value}",
    "extendedProfileDebug.notAdvertisedNoRestrictions":
        "no anunciado (sin restricciones)",
    "extendedProfileDebug.serverRulesForFieldsMProfile":
        "Reglas del servidor para los campos (m.profile_fields): {value}",
    "extendedProfileDebug.failedToFetchTheProfile":
        "No se pudo obtener el perfil",
    "extendedProfileDebug.couldNotCopyToClipboard":
        "No se pudo copiar al portapapeles",

    // src/lib/components/ui/FlashEmbed.svelte
    "flashEmbed.suspend": "Suspender",

    // src/lib/components/messages/ForwardMessageDialog.svelte
    "forwardMessageDialog.forwardMessage": "Reenviar mensaje",
    "forwardMessageDialog.searchRooms": "Buscar salas",
    "forwardMessageDialog.noJoinedRoomsFound":
        "No se encontraron salas a las que te hayas unido",
    "forwardMessageDialog.forwarding": "Reenviando…",
    "forwardMessageDialog.forward": "Reenviar",
    "forwardMessageDialog.failedToForwardMessage":
        "No se pudo reenviar el mensaje",

    // src/lib/components/settings/GeneralSettings.svelte
    "generalSettings.desktop": "Escritorio",
    "proxySettings.network": "Red",
    "proxySettings.proxy": "Proxy",
    "proxySettings.modeSystem": "Usar la configuración del sistema",
    "proxySettings.modeDirect": "Sin proxy",
    "proxySettings.modeManual": "Manual",
    "proxySettings.modePac": "Configuración automática (PAC)",
    "proxySettings.launchFlagsInUse": "Parámetros de inicio en uso:",
    "proxySettings.server": "Servidor proxy",
    "proxySettings.serverHint":
        "socks5://, socks4://, http:// o https:// con host y puerto. Tor suele ser socks5://127.0.0.1:9050.",
    "proxySettings.bypass": "No usar el proxy para",
    "proxySettings.pacUrl": "URL del archivo PAC",
    "proxySettings.calls": "Llamadas",
    "proxySettings.callsDefault":
        "Predeterminado (UDP directo, TCP por el proxy)",
    "proxySettings.callsDirect":
        "Conectar directamente a los servidores de llamadas",
    "proxySettings.callsProxy": "Solo a través del proxy",
    "proxySettings.callsDefaultHint":
        "UDP no pasa por un proxy, así que el audio de las llamadas normalmente va directo y solo pasa por el proxy cuando una llamada tiene que usar TCP.",
    "proxySettings.callsDirectHint":
        "Toda la llamada evita el proxy: la conexión a la llamada, al servidor de llamadas, y el audio y el vídeo por UDP o TCP. Todo lo demás sigue usando el proxy. Los servidores de llamadas ven tu dirección IP.",
    "proxySettings.callsProxyHint":
        "Sin conexiones directas, y los servidores de llamadas nunca ven tu dirección IP: las llamadas van por el proxy al relé TURN del servidor de llamadas por TCP o TLS. Si el servidor no ofrece relé TURN, las llamadas no se conectarán. Habrá más retraso.",
    "proxySettings.callsDirectUnavailable":
        "Las llamadas no pueden evitar la configuración de proxy del sistema. Configura el proxy aquí (Manual o PAC) para que funcione.",
    "proxySettings.callsDirectAddresses": "Enviado directo:",
    "proxySettings.save": "Guardar",
    "proxySettings.saved": "Guardado",
    "proxySettings.applyFailed": "No se pudo aplicar: {error}",
    "generalSettings.minimiseToTrayOnClose": "Minimizar a la bandeja al cerrar",
    "generalSettings.keepZamRunningInTheSystem":
        "Mantiene Zam en ejecución en la bandeja del sistema al cerrar la ventana en lugar de salir. Usa el icono de la bandeja para volver a abrirlo o salir.",
    "generalSettings.noGeneralSettingsAreAvailableOn":
        "No hay ajustes generales disponibles en esta plataforma.",

    // src/lib/components/ui/GifPicker.svelte
    "gifPicker.searchFavourites": "Buscar en favoritos…",
    "gifPicker.searchKlipy": "Buscar en KLIPY…",
    "gifPicker.searchFavourites2": "Buscar en favoritos",
    "gifPicker.searchGifs": "Buscar GIF",
    "gifPicker.gifResults": "Resultados de GIF",
    "gifPicker.noFavouriteGifsYetStarA":
        "Todavía no tienes GIF favoritos. Marca un GIF con una estrella para guardarlo aquí.",
    "gifPicker.favourites": "Favoritos",
    "gifPicker.gifTagged": "GIF etiquetado {join}",
    "gifPicker.favouriteGif": "GIF favorito {value}",
    "gifPicker.editTags": "Editar etiquetas",
    "gifPicker.catFunny": "gato, gracioso",
    "gifPicker.commaSeparatedEnterToSave":
        "Separadas por comas · Intro para guardar",
    "gifPicker.trending": "Tendencias",
    "gifPicker.gifResult": "Resultado de GIF {value}",
    "gifPicker.favourite": "Favorito",
    "gifPicker.poweredByKlipy": "Con la tecnología de KLIPY",

    // src/lib/components/layout/ImagePackEditor.svelte
    "imagePackEditor.addImage": "Añadir imagen",
    "imagePackEditor.newPack": "Nuevo paquete",
    "imagePackEditor.packName": "Nombre del paquete",
    "imagePackEditor.shortcode": "código corto",
    "imagePackEditor.useAsEmoji": "Usar como emoji",
    "imagePackEditor.useAsSticker": "Usar como sticker",
    "imagePackEditor.inheritedFrom": "Heredado de {sourceName}",
    "imagePackEditor.sticker": "Sticker",
    "imagePackEditor.removeImage": "Quitar imagen",
    "imagePackEditor.noCustomImages": "No hay imágenes personalizadas",
    "imagePackEditor.emotes": "Emotes de {value}",
    "imagePackEditor.room": "Sala",
    "imagePackEditor.chooseAtLeastOneUsage": "Elige al menos un uso.",
    "imagePackEditor.enterAPackName": "Escribe un nombre para el paquete.",
    "imagePackEditor.uploadFailed": "Error al subir",
    "imagePackEditor.failedToUpdateUsage": "No se pudo actualizar el uso",
    "imagePackEditor.failedToRemoveImage": "No se pudo quitar la imagen",
    "imagePackEditor.failedToUpdatePack": "No se pudo actualizar el paquete",
    "imagePackEditor.addToMine": "Añadir a los míos",
    "imagePackEditor.addAllToMyPack":
        "Copia todas las imágenes de este paquete a tu propio paquete",
    "imagePackEditor.addImageToMyPack": "Copia esta imagen a tu propio paquete",
    "imagePackEditor.addedToYourPack":
        "{count, plural, one {Se añadió # imagen a tu paquete.} other {Se añadieron # imágenes a tu paquete.}}",
    "imagePackEditor.alreadyInYourPack": "Ya está en tu paquete.",
    "imagePackEditor.editDetails": "Editar detalles",
    "imagePackEditor.deletePack": "Eliminar paquete",
    "imagePackEditor.confirmDeletePack":
        '¿Eliminar el paquete "{name}" y todas sus imágenes?',
    "imagePackEditor.useInAllRooms": "Usar en todas mis salas",
    "imagePackEditor.useInAllRoomsHint":
        "Sus emojis y stickers aparecerán en todos los sitios donde chatees.",
    "imagePackEditor.attribution": "Créditos: {value}",
    "imagePackEditor.attributionPlaceholder":
        "Créditos / atribución (opcional)",
    "imagePackEditor.uploadPackAvatar": "Subir el icono del paquete",
    "imagePackEditor.removePackAvatar": "Quitar el icono",
    "imagePackEditor.avatarReady": "Icono subido; guarda para aplicarlo.",
    "sharedPackSettings.yourPackDetails": "Detalles de tu paquete",
    "sharedPackSettings.enabledEverywhere":
        "Paquetes activados en todas las salas",
    "sharedPackSettings.enabledEverywhereHint":
        "Los paquetes de las salas en las que estás se pueden usar en todas las salas, no solo en la sala a la que pertenecen.",
    "sharedPackSettings.availableInYourRooms": "Paquetes en tus salas",
    "sharedPackSettings.searchPacks": "Buscar paquetes",
    "sharedPackSettings.noPacksFound": "No se encontraron paquetes",
    "sharedPackSettings.noneEnabled":
        "No hay paquetes activados en todas las salas",
    "sharedPackSettings.enable": "Usar en todas partes",
    "sharedPackSettings.disable": "Dejar de usar en todas partes",
    "sharedPackSettings.remove": "Quitar",
    "sharedPackSettings.unavailable":
        "No disponible: ya no estás en {room} o el paquete se ha eliminado",
    "sharedPackSettings.packSummary":
        "{room}, {count, plural, one {# imagen} other {# imágenes}}",
    "sharedPackSettings.failedToSave": "No se pudo guardar",

    // src/lib/components/layout/InboxPanel.svelte
    "inboxPanel.inbox": "Bandeja de entrada",
    "inboxPanel.noPendingInvites": "No hay invitaciones pendientes",
    "inboxPanel.roomInvitesWillAppearHere":
        "Las invitaciones a salas aparecerán aquí.",
    "inboxPanel.pendingInvites": "Invitaciones pendientes: {length}",
    "inboxPanel.invitedBy": "Invitación de {sender}",
    "inboxPanel.ignore": "Ignorar",
    "inboxPanel.accept": "Aceptar",
    "inboxPanel.pendingJoinRequests":
        "Solicitudes de acceso pendientes: {length}",
    "inboxPanel.youAskedToJoinWaitingFor":
        "Has pedido unirte; esperando a que alguien te deje entrar.",
    "inboxPanel.cancelRequest": "Cancelar la solicitud",
    "inboxPanel.failedToAcceptInvite": "No se pudo aceptar la invitación",
    "inboxPanel.failedToRejectInvite": "No se pudo rechazar la invitación",
    "inboxPanel.failedToCancelJoinRequest":
        "No se pudo cancelar la solicitud de acceso",

    // src/lib/components/layout/IncomingCallCard.svelte
    "incomingCallCard.incomingCall": "Llamada entrante",
    "incomingCallCard.declineCallFrom": "Rechazar la llamada de {name}",
    "incomingCallCard.accept": "Aceptar",
    "incomingCallCard.acceptCallFrom": "Aceptar la llamada de {name}",
    "incomingCallCard.unknown": "Desconocido",

    // src/lib/components/layout/InvitePanel.svelte
    "invitePanel.invitePeopleTo": "Invitar a personas a",
    "invitePanel.invited": "Invitado",
    "invitePanel.failed": "Error",
    "invitePanel.inviteByEmail": "Invitar por correo electrónico",
    "invitePanel.nameExampleCom": "nombre@ejemplo.com",
    "invitePanel.inviting": "Invitando…",
    "invitePanel.invite": "Invitar",
    "invitePanel.invite2": "Invitar a {length}",
    "invitePanel.enterAValidEmailAddress":
        "Escribe una dirección de correo válida.",
    "invitePanel.couldNotSendTheEmailInvite":
        "No se pudo enviar la invitación por correo",
    "invitePanel.couldNotSendTheInvite": "No se pudo enviar la invitación",
    "invitePanel.thisRoom": "esta sala",
    "invitePanel.thisSpace": "este espacio",

    // src/lib/components/layout/JoinConsentDialog.svelte
    "joinConsentDialog.joinThisRoom": "¿Unirte a esta sala?",
    "joinConsentDialog.youClickedALinkTo": "Has hecho clic en un enlace a",
    "joinConsentDialog.joiningSharesYourMatrixIdWith":
        ". Al unirte, tu ID de Matrix se comparte con todos los de la sala y la sala se añade a tu lista.",
    "joinConsentDialog.thisOpensRoom": "Esto abre la sala",
    "joinConsentDialog.warningThisLinkPointsAtA":
        "Aviso: este enlace apunta a un servidor distinto del de la sala a la que lleva. Continúa solo si confías en quien lo envió.",
    "joinConsentDialog.joinRoom": "Unirse a la sala",

    // src/lib/components/ui/Lightbox.svelte
    "lightbox.closeViewer": "Cerrar el visor de {mediaNoun}",
    "lightbox.viewer": "Visor de {MediaNoun}{value}",
    "lightbox.download": "Descargar",
    "lightbox.previous": "Anterior",
    "lightbox.previous2": "{mediaNoun} anterior",
    "lightbox.next": "Siguiente",
    "lightbox.next2": "{mediaNoun} siguiente",
    "lightbox.couldNotLoadThisVideoUse":
        "No se pudo cargar este vídeo. Usa Descargar para guardarlo.",
    "lightbox.video": "Vídeo",
    "lightbox.image": "Imagen",
    "lightbox.videoNoun": "vídeo",
    "lightbox.imageNoun": "imagen",

    // src/lib/components/messages/LinkPreview.svelte
    "linkPreview.youtubeVideo": "Vídeo de YouTube",
    "linkPreview.xTwitter": "X / Twitter",
    "linkPreview.loadingItContactsTheSiteHosting":
        "Al cargarlo se contacta con el sitio que lo aloja, lo que revela tu dirección IP",
    "linkPreview.loadPreviewMedia": "Cargar el contenido de la vista previa",
    "linkPreview.playVideo": "Reproducir vídeo",

    // src/lib/components/layout/LiveLocationBanner.svelte
    "liveLocationBanner.openMap": "Abrir el mapa",
    "liveLocationBanner.sharingLiveLocation":
        "Compartiendo ubicación en tiempo real",
    "liveLocationBanner.lastUpdatedAt":
        " · última actualización a las {timeOnly} ({updatedAgoLabel})",
    "liveLocationBanner.map": "Mapa",
    "liveLocationBanner.isSharingLiveLocation":
        "{getMemberName} está compartiendo su ubicación en tiempo real",
    "liveLocationBanner.peopleSharingLiveLocation":
        "{length} personas comparten su ubicación en tiempo real",
    "liveLocationBanner.viewMap": "Ver el mapa",

    // src/lib/components/layout/LiveLocationMapView.svelte
    "liveLocationMapView.back": "Atrás",
    "liveLocationMapView.liveLocation": "Ubicación en tiempo real",
    "liveLocationMapView.recenter": "Volver a centrar",
    "liveLocationMapView.waitingForALocationFix":
        "Esperando a obtener la ubicación…",
    "liveLocationMapView.sharingLiveLocation":
        "Compartiendo ubicación en tiempo real",
    "liveLocationMapView.lastUpdatedAt":
        "última actualización a las {timeOnly} ({updatedAgoLabel})",
    "liveLocationMapView.osm": "OSM",
    "liveLocationMapView.noActiveLiveSharesInThis":
        "No hay ubicaciones en tiempo real activas en esta sala.",
    "liveLocationMapView.you": "Tú",

    // src/lib/components/messages/LocationBody.svelte
    "locationBody.openstreetmap": "OpenStreetMap",
    "locationBody.googleMaps": "Google Maps",

    // src/lib/components/layout/LoginView.svelte
    "loginView.signIn": "Iniciar sesión",
    "loginView.register": "Registrarse",
    "loginView.zam": "Zam - {value}",
    "loginView.addAnAccount": "Añadir una cuenta",
    "loginView.welcomeBack": "¡Hola de nuevo!",
    "loginView.signInWithAnotherMatrixAccount":
        "Inicia sesión con otra cuenta de Matrix",
    "loginView.signInToYourMatrixAccount":
        "Inicia sesión en tu cuenta de Matrix",
    "loginView.createAnAccount": "Crear una cuenta",
    "loginView.registerOnAMatrixHomeserver":
        "Regístrate en un servidor base de Matrix",
    "loginView.homeserver": "Servidor base",
    "loginView.username": "Nombre de usuario",
    "loginView.password": "Contraseña",
    "loginView.registrationToken": "Token de registro",
    "loginView.ifRequired": "(si se requiere)",
    "loginView.leaveBlankIfNotRequired": "Déjalo en blanco si no se requiere",
    "loginView.useSlidingSync": "Usar sincronización deslizante",
    "loginView.fasterStartupOnServersThatSupport":
        "Inicio más rápido en los servidores que lo admiten.",
    "loginView.pleaseWait": "Espera, por favor…",
    "loginView.logIn": "Iniciar sesión",
    "loginView.createAccount": "Crear cuenta",
    "loginView.donTHaveAnAccount": "¿No tienes una cuenta?",
    "loginView.alreadyHaveAnAccount": "¿Ya tienes una cuenta?",
    "loginView.signIn2": "Inicia sesión",
    "loginView.backTo": "← Volver a {activeUserId}",
    "loginView.orContinueAs": "O continuar como",
    "loginView.yourCredentialsAreSentDirectlyTo":
        "Tus credenciales se envían directamente a tu servidor base y esta aplicación nunca las guarda fuera de tu dispositivo.",
    "loginView.loggingIn": "Iniciando sesión…",
    "loginView.loginFailedCheckYourCredentials":
        "No se pudo iniciar sesión. Comprueba tus credenciales.",
    "loginView.creatingAccount": "Creando la cuenta…",
    "loginView.registrationFailed": "No se pudo completar el registro.",
    "loginView.or": "o",
    "loginView.continueWithSso": "Continuar con SSO",
    "loginView.continueWith": "Continuar con {name}",
    "loginView.redirectingToSso":
        "Redirigiendo a tu proveedor de inicio de sesión…",
    "loginView.finishSsoInBrowser":
        "Termina de iniciar sesión en tu navegador y luego vuelve aquí.",
    "loginView.ssoCouldNotBeVerified":
        "No se pudo verificar el inicio de sesión único. Inténtalo de nuevo.",
    "loginView.ssoFailed": "Error en el inicio de sesión único.",
    "loginView.continue": "Continuar",
    "loginView.signInOnProviderPage":
        "Iniciarás sesión en la propia página de tu servidor base y luego volverás aquí.",
    "loginView.oauthCancelled": "Se canceló el inicio de sesión.",
    "loginView.oauthDenied":
        "El proveedor de inicio de sesión rechazó la solicitud: {reason}",
    "loginView.oauthCouldNotBeVerified":
        "No se pudo verificar el inicio de sesión. Inténtalo de nuevo.",
    "loginView.oauthFailed": "No se pudo iniciar sesión. Inténtalo de nuevo.",
    "loginView.oauthRegistrationRefused":
        "Este servidor no permitió que Zam se registrara para iniciar sesión.",
    "loginView.oauthRegistrationRefusedFallback":
        "Este servidor no permitió que Zam se registrara para iniciar sesión. Usa una de las otras opciones de abajo.",
    "loginView.checkingServer": "Comprobando el servidor…",
    "loginView.homeserverHint":
        "El servidor donde está tu cuenta: la parte después de los dos puntos en @tú:servidor.",
    "loginView.homeserverHintRegister":
        "Tu cuenta vivirá en este servidor. ¿No sabes cuál? matrix.org es gratuito y abierto a todos.",
    "loginView.oauthLoginExplainer":
        "{server} inicia sesión en su propia página de cuenta. Zam la abre y vuelves aquí con la sesión iniciada.",
    "loginView.oauthRegisterExplainer":
        "{server} crea cuentas nuevas en su propia página de cuenta. Zam la abre; elige allí tu nombre de usuario y contraseña, y vuelves aquí con la sesión iniciada.",
    "loginView.continueTo": "Continuar a {host}",
    "loginView.createAccountOn": "Crear cuenta en {server}",
    "loginView.advancedOptions": "Opciones avanzadas",
    "encryptionSetup.setupTitle": "Protege tus mensajes",
    "encryptionSetup.setupBody":
        "Tus chats privados están cifrados de extremo a extremo. Configura la recuperación para poder leerlos en cualquier dispositivo en el que inicies sesión más adelante, incluso si pierdes este. Solo tarda unos segundos.",
    "encryptionSetup.passwordBody":
        "Introduce la contraseña de tu cuenta para confirmar que eres tú.",
    "encryptionSetup.setUp": "Configurar recuperación",
    "encryptionSetup.later": "Ahora no",
    "encryptionSetup.saveKeyTitle": "Guarda tu clave de recuperación",
    "encryptionSetup.saveKeyBody":
        "Esta clave desbloquea tus mensajes cifrados en un dispositivo nuevo. Solo se muestra una vez: guárdala en un gestor de contraseñas o descárgala. Sin ella, perder un dispositivo puede significar perder mensajes.",
    "encryptionSetup.downloadKey": "Descargar",
    "encryptionSetup.keyFileHeader":
        "Clave de recuperación de Zam para {userId}",
    "encryptionSetup.doneTitle": "Todo listo",
    "encryptionSetup.doneBody":
        "El cifrado está configurado en este dispositivo. Tus mensajes, y tu historial de otros dispositivos, están disponibles aquí.",
    "encryptionSetup.confirmTitle": "Confirma que eres tú",
    "encryptionSetup.confirmBody":
        "Esta cuenta ya usa cifrado. Confirma este dispositivo nuevo para que pueda leer tus mensajes cifrados y tu historial.",
    "encryptionSetup.useAnotherDevice": "Usar otro dispositivo",
    "encryptionSetup.useRecoveryKey": "Usar clave de recuperación",
    "encryptionSetup.anotherDeviceHint":
        "Otro dispositivo es uno en el que ya has iniciado sesión, como la app de Zam o Element en tu móvil. Mostrará una solicitud para aprobar.",
    "encryptionSetup.recoveryKeyHint":
        'Tu clave de recuperación empieza por "EsT". La guardaste al configurar el cifrado por primera vez.',
    "encryptionSetup.cantConfirm":
        "¿Has perdido tu clave de recuperación y tus otros dispositivos?",
    "encryptionSetup.enterKeyTitle": "Introduce tu clave de recuperación",
    "encryptionSetup.enterKeyBody":
        "Pega la clave de recuperación que guardaste al configurar el cifrado. Los espacios no importan.",
    "encryptionSetup.enterPassphraseBody":
        "Introduce la frase de recuperación que elegiste al configurar el cifrado.",
    "encryptionSetup.back": "Atrás",
    "encryptionSetup.connectBackupTitle": "Restaura tu historial de mensajes",
    "encryptionSetup.connectBackupBody":
        "Este dispositivo está verificado, pero aún no está conectado a tu copia de seguridad cifrada de mensajes. Introduce tu clave de recuperación para restaurar tu historial.",
    "encryptionSetup.checking": "Comprobando tu cifrado…",
    "encryptionSetup.tryAgain": "Reintentar",
    "encryptionSetup.openSecuritySettings": "Abrir ajustes de seguridad",
    "registration.cancelled": "Se canceló la creación de la cuenta.",
    "registration.noSupportedFlow":
        "Este servidor pide un paso de registro que Zam no puede completar. Prueba a crear la cuenta en la web del servidor.",
    "registration.stageKeptFailing":
        "El servidor rechazó un paso de registro varias veces. Inténtalo de nuevo.",
    "registration.userInUse":
        "Ese nombre de usuario está ocupado. Prueba otro.",
    "registration.invalidUsername":
        "Ese nombre de usuario no está permitido. Usa minúsculas, números y . _ = - /",
    "registration.exclusiveUsername":
        "Ese nombre de usuario está reservado en este servidor. Prueba otro.",
    "registration.weakPassword":
        "Esa contraseña es demasiado débil. Prueba una más larga.",
    "registration.weakPasswordReason":
        "Esa contraseña es demasiado débil: {reason}",
    "registration.emailInUse": "Ese correo ya lo usa otra cuenta.",
    "registration.emailNotAllowed": "Este servidor no acepta ese correo.",
    "registration.rateLimited":
        "Demasiados intentos. Espera un minuto y vuelve a intentarlo.",
    "registration.stepNotAccepted":
        "El servidor no aceptó ese paso. Inténtalo de nuevo.",
    "registration.closed": "Este servidor no acepta cuentas nuevas.",
    "registration.invalidToken":
        "Ese token de registro no es válido. Revísalo e inténtalo de nuevo.",
    "registration.refused": "El servidor se negó a crear la cuenta.",
    "registration.refusedReason":
        "El servidor se negó a crear la cuenta: {reason}",
    "registration.serverUnreachable":
        "No se pudo contactar con el servidor. Revisa la dirección y tu conexión.",
    "registration.usernameLowercase":
        "Los nombres de usuario deben ir en minúsculas.",
    "registration.usernameCharacters":
        "Usa solo minúsculas, números y . _ = - /",
    "registration.usernameHint":
        "Elige un nombre de usuario. La gente te encontrará por él.",
    "registration.usernameAvailable": "{userId} está disponible",
    "registration.yourAddressWillBe": "Tu dirección será {userId}",
    "registration.confirmPassword": "Confirmar contraseña",
    "registration.passwordsDontMatch": "Las contraseñas no coinciden.",
    "registration.closedOnServer":
        "{server} no acepta cuentas nuevas ahora mismo. Elige otro servidor para crear una.",
    "registration.useOtherServer": "Crear una cuenta en {server}",

    "registration.tokenTitle": "Token de registro",
    "registration.tokenBody":
        "{server} es solo por invitación. Introduce el token de registro que te dio la administración del servidor.",
    "registration.termsTitle": "Acepta las condiciones del servidor",
    "registration.termsBody":
        "{server} te pide aceptar esto antes de crear tu cuenta:",
    "registration.termsAccept": "He leído y acepto estas condiciones",
    "registration.emailTitle": "Confirma tu correo",
    "registration.emailBody":
        "{server} necesita un correo para crear tu cuenta. Te enviaremos un enlace para confirmarlo.",
    "registration.emailPlaceholder": "tu@example.com",
    "registration.sendEmail": "Enviar correo",
    "registration.emailSent":
        "Enviamos un enlace a {email}. Ábrelo, vuelve aquí y pulsa Continuar.",
    "registration.emailNotConfirmed":
        "El correo aún no está confirmado. Abre el enlace que contiene y pulsa Continuar.",
    "registration.emailConfirmed": "Continuar",
    "registration.captchaTitle": "Demuestra que no eres un robot",
    "registration.captchaBody":
        "{server} quiere que resuelvas un captcha. Se abre en la página del servidor; vuelve aquí cuando termines.",
    "registration.fallbackTitle": "Un paso más",
    "registration.fallbackBody":
        "{server} necesita que completes un paso en su propia página. Vuelve aquí cuando termines.",
    "registration.openStepPage": "Abrir página",
    "registration.stepDone": "Ya está",

    // src/lib/components/layout/MemberList.svelte
    "memberList.members": "Miembros: {length}",
    "memberList.admins": "Administradores: {length}",
    "memberList.admin": "Administrador",
    "memberList.moderators": "Moderadores: {length}",

    // src/lib/components/messages/MessageActionsSheet.svelte
    "messageActionsSheet.thisMessage": "¿{label} este mensaje?",
    "messageActionsSheet.messageActions": "Acciones del mensaje",

    // src/lib/components/layout/MessageArea.svelte
    "messageArea.dropToAttach": "Suelta para adjuntar",
    "messageArea.unreadNotifications": "Notificaciones sin leer",
    "messageArea.encryptionEnabled": "Cifrado activado",
    "messageArea.joiningVoiceCall": "Uniéndose a la llamada de voz…",
    "messageArea.startVoiceCall": "Iniciar llamada de voz",
    "messageArea.showCall": "Abrir vista de la llamada",
    "messageArea.searchMessages": "Buscar mensajes",
    "messageArea.threads": "Hilos",
    "messageArea.toggleThreadsList": "Mostrar u ocultar la lista de hilos",
    "messageArea.unreadThreadMentions": "Menciones sin leer en hilos",
    "messageArea.unreadThreads": "Hilos sin leer",
    "messageArea.pinnedMessages": "Mensajes fijados",
    "messageArea.notificationsInbox": "Bandeja de notificaciones",
    "messageArea.mediaAndFiles": "Multimedia y archivos",
    "messageArea.toggleMemberList": "Mostrar u ocultar la lista de miembros",
    "messageArea.more": "Más",
    "messageArea.moreRoomOptions": "Más opciones de la sala",
    "messageArea.messageTimeline": "Cronología de mensajes",
    "messageArea.welcomeTo": "Te damos la bienvenida a #",
    "messageArea.thisIsTheBeginningOfThe": "Este es el comienzo de la sala #",
    "messageArea.room": ".",
    "messageArea.newMessages": "Mensajes nuevos",
    "messageArea.messageFromABlockedUser": "Mensaje de un usuario bloqueado",
    "messageArea.showBlockedMessage": "Mostrar el mensaje bloqueado",
    "messageArea.thisRoomHasBeenUpgraded": "Esta sala se ha actualizado",
    "messageArea.goToNewRoom": "Ir a la nueva sala",
    "messageArea.joinNewRoom": "Unirse a la nueva sala",
    "messageArea.jumpToPresent": "Saltar al presente",
    "messageArea.searchingForMessage": "Buscando el mensaje…",
    "messageArea.viewingMessageContext": "Viendo el contexto del mensaje",
    "messageArea.returnToLive": "Volver al presente",
    "messageArea.closePanel": "Cerrar el panel",
    "messageArea.someone": "Alguien",
    "messageArea.pinnedMessagesCount": "Mensajes fijados ({count})",

    // src/lib/components/messages/MessageInput.svelte
    "messageInput.replyingTo": "Respondiendo a {replyTargetName}",
    "messageInput.cancelReplyEsc": "Cancelar la respuesta (Esc)",
    "messageInput.editAttachment": "Editar el adjunto",
    "messageInput.editAttachment2": "Editar el adjunto {name}",
    "messageInput.custom": "personalizado",
    "messageInput.yourEmotes": "Tus emotes",
    "messageInput.yourNextMessageWillStartA": "Tu próximo mensaje iniciará un",
    "messageInput.thread": "hilo",
    "messageInput.cancelThreadCreation": "Cancelar la creación del hilo",
    "messageInput.favouriteGifs": "GIF favoritos",
    "messageInput.sendMessage": "Enviar mensaje",
    "messageInput.isTyping": "{value} está escribiendo…",
    "messageInput.andAreTyping": "{value} y {value2} están escribiendo…",
    "messageInput.andAreTyping2":
        "{value}, {value2} y {value3} están escribiendo…",
    "messageInput.severalPeopleAreTyping": "Varias personas están escribiendo…",
    "messageInput.noPermissionToSend":
        "No tienes permiso para enviar mensajes aquí",
    "messageInput.selectARoomToStartChatting":
        "Selecciona una sala para empezar a chatear",
    "messageInput.replyInThread": "Responder en el hilo...",
    "messageInput.replyTo": "Responder a {replyTargetName}...",
    "messageInput.message": "Mensaje para #{roomName}",
    "messageInput.isNotAValidUser": '"{token}" no es un usuario válido',
    "messageInput.noRoomSelected": "No hay ninguna sala seleccionada",
    "messageInput.isNotInThisRoom": "{userId} no está en esta sala",
    "messageInput.youDonTHavePermissionTo":
        "No tienes permiso para cambiar los niveles de poder en esta sala",
    "messageInput.unhandledCommand": "Comando no gestionado: /{name}",
    "messageInput.commandFailed": "Error en el comando",
    "messageInput.failedToSend": "No se pudo enviar",
    "messageInput.unknownCommand": "Comando desconocido: /{unknown}",
    "messageInput.sedNoMessage": "No tienes ningún mensaje aquí para editar",
    "messageInput.sedNoMatch": '"{pattern}" no está en tu último mensaje',
    "messageInput.sedEmpty": "Eso dejaría vacío tu último mensaje",
    "messageInput.sedFailed": "No se pudo editar tu último mensaje",
    "messageInput.sendingAttachments":
        "{count, plural, one {Enviando # adjunto…} other {Enviando # adjuntos…}}",

    // src/lib/components/messages/MessageItem.svelte
    "messageItem.viewProfile": "Ver perfil",
    "messageItem.jumpToTheRepliedToMessage": "Saltar al mensaje respondido:",
    "messageItem.originalMessageNotLoaded": "Mensaje original no cargado",
    "messageItem.originalMessageDeleted": "Mensaje original eliminado",
    "messageItem.originalMessageUnavailable": "Mensaje original no disponible",
    "messageItem.replyPreviewSticker": "Sticker",
    "messageItem.replyPreviewPoll": "Encuesta",
    "messageItem.replyPreviewImage": "Imagen",
    "messageItem.replyPreviewVideo": "Vídeo",
    "messageItem.replyPreviewAudio": "Audio",
    "messageItem.replyPreviewFile": "Archivo",
    "messageItem.edited": "(editado)",
    "messageItem.decryptingImage": "Descifrando la imagen...",
    "messageItem.couldnTDecryptImage": "No se pudo descifrar la imagen",
    "messageItem.imageUnavailable": "[Imagen no disponible]",
    "messageItem.decryptingVideo": "Descifrando el vídeo...",
    "messageItem.couldnTDecryptVideo": "No se pudo descifrar el vídeo",
    "messageItem.video": "Vídeo",
    "messageItem.canTBePlayedHere": "No se puede reproducir aquí",
    "messageItem.playbackFailedClickToRetry":
        "Error de reproducción · Haz clic para reintentar",
    "messageItem.clickToPlay": "{videoDuration} · Haz clic para reproducir",
    "messageItem.clickToPlay2": "Haz clic para reproducir",
    "messageItem.audio": "Audio",
    "messageItem.kb": "{toFixed} KB",
    "messageItem.mb": "{toFixed} MB",
    "mediaProgress.ofTotal": "{loaded} de {total}",
    "messageItem.fileAttachment": "Archivo adjunto",
    "messageItem.download": "Descargar",
    "messageItem.toSave": "para guardar ·",
    "messageItem.toCancel": "para cancelar",
    "messageItem.openThread": "Abrir el hilo",
    "messageItem.failedToSend": "No se pudo enviar.",
    "messageItem.retrying": "Reintentando…",
    "messageItem.showWhoReadThisMessage": "Mostrar quién ha leído este mensaje",
    "messageItem.readThis":
        "{count, plural, one {# persona ha leído esto} other {# personas han leído esto}}",
    "messageItem.readBy": "Leído por",
    "messageItem.messageActions": "Acciones del mensaje",
    "messageItem.editMessage": "Editar mensaje",
    "messageItem.delete": "¿Eliminar?",
    "messageItem.yesDeleteMessage": "Sí, eliminar el mensaje",
    "messageItem.yes": "Sí",
    "messageItem.noKeepMessage": "No, conservar el mensaje",
    "messageItem.no": "No",
    "messageItem.deleteMessage": "Eliminar mensaje",
    "messageItem.unpinMessage": "Desfijar mensaje",
    "messageItem.pinMessage": "Fijar mensaje",
    "messageItem.addReaction": "Añadir reacción",
    "messageItem.reply": "Responder",
    "messageItem.replyInThread": "Responder en un hilo",
    "messageItem.forwardMessage": "Reenviar mensaje",
    "messageItem.moreActions": "Más acciones",
    "messageItem.linkCopied": "¡Enlace copiado!",
    "messageItem.copyMessageLink": "Copiar el enlace del mensaje",
    "messageItem.linkCopied2": "Enlace copiado",
    "messageItem.couldnTDeleteTheMessage": "No se pudo eliminar el mensaje",
    "messageItem.couldnTCopyTheMessageLink":
        "No se pudo copiar el enlace del mensaje",
    "messageItem.failedToUnpinMessage": "No se pudo desfijar el mensaje",
    "messageItem.failedToPinMessage": "No se pudo fijar el mensaje",
    "messageItem.couldNotOpenTheMatrixLink":
        "No se pudo abrir el enlace de Matrix",

    // src/lib/components/messages/MessageRedactAction.svelte
    "messageRedactAction.removeMessage": "Quitar mensaje",
    "messageRedactAction.removeThisMessage": "¿Quitar este mensaje?",
    "messageRedactAction.removing": "Quitando…",
    "messageRedactAction.failedToRemoveMessage": "No se pudo quitar el mensaje",

    // src/lib/components/messages/MessageReportAction.svelte
    "messageReportAction.reportMessage": "Denunciar mensaje",
    "messageReportAction.reportSent": "Denuncia enviada",
    "messageReportAction.whyAreYouReportingThisMessage":
        "¿Por qué denuncias este mensaje?",
    "messageReportAction.markAsExtremelyOffensive":
        "Marcar como extremadamente ofensivo",
    "messageReportAction.reporting": "Denunciando…",
    "messageReportAction.report": "Denunciar",

    // src/lib/components/layout/MessageSearchPanel.svelte
    "messageSearchPanel.searchMessages": "Buscar mensajes",
    "messageSearchPanel.searchTryFromOrHasImage":
        "Buscar - prueba from: o has:image",
    "messageSearchPanel.searchForMessagesInThisRoom":
        "Busca mensajes en esta sala.",
    "messageSearchPanel.noMatchesInTheResultsLoaded":
        "No hay coincidencias en los resultados cargados hasta ahora.",
    "messageSearchPanel.noResultsFor": 'No hay resultados para "{searched}".',
    "messageSearchPanel.searchFailed": "Error en la búsqueda",
    "messageSearchPanel.resultCount":
        "{count, plural, one {# resultado} other {# resultados}}",

    // src/lib/components/settings/MessagesMediaSettings.svelte
    "messagesMediaSettings.messages": "Mensajes",
    "messagesMediaSettings.showMatrixIds": "Mostrar los ID de Matrix",
    "messagesMediaSettings.showFullMatrixIdsLikeUser":
        "Muestra los ID completos de Matrix como @usuario:servidor en lugar de los nombres visibles en toda la aplicación.",
    "messagesMediaSettings.readReceiptAvatars":
        "Avatares de confirmación de lectura",
    "messagesMediaSettings.showWhoHasReadEachMessage":
        "Muestra quién ha leído cada mensaje con pequeños avatares debajo. Solo cambia lo que ves en este dispositivo; para que los demás no vean hasta dónde has leído, usa Confirmaciones de lectura privadas en Privacidad y seguridad.",
    "messagesMediaSettings.holdToOpenMessageMenu":
        "Mantener pulsado para abrir el menú del mensaje",
    "messagesMediaSettings.onTouchDevicesOpenAMessage":
        "En dispositivos táctiles, abre las acciones de un mensaje manteniéndolo pulsado en lugar de tocarlo. Si está desactivado, un toque abre el menú.",
    "messagesMediaSettings.linkPreviews": "Vistas previas de enlaces",
    "messagesMediaSettings.whenOffNoLinkPreviewIs":
        "Si está desactivado, no se carga ninguna vista previa de enlaces y tu servidor base nunca obtiene la página enlazada en tu nombre. Controla desde dónde se carga el contenido de las vistas previas en Privacidad y seguridad.",
    "messagesMediaSettings.pauseVideosOffScreen":
        "Pausar los vídeos fuera de la pantalla",
    "messagesMediaSettings.pauseAPlayingVideoWhenIt":
        "Pausa un vídeo en reproducción cuando sale de la vista para ahorrar batería. Al volver, lo reanudas tú.",
    "messagesMediaSettings.sendVideosThatStreamFaster":
        "Enviar vídeos que se reproducen antes",
    "messagesMediaSettings.rearrangeMp4VideosYouSend":
        "Reorganiza los vídeos MP4 que envías para que empiecen a reproducirse mientras se descargan. No se vuelve a codificar nada y la imagen no cambia. Desactívalo para enviar los archivos tal cual.",
    "messagesMediaSettings.sendPhotosThatAppearSooner":
        "Enviar fotos que aparecen antes",
    "messagesMediaSettings.rewriteJpegPhotosYouSend":
        "Reorganiza las fotos JPEG que envías para que se vea la imagen completa enseguida y se vaya definiendo mientras se descarga. No se vuelve a codificar nada y la imagen no cambia. Desactívalo para enviar los archivos tal cual.",
    "messagesMediaSettings.removeLocationAndMetadata":
        "Quitar la ubicación y otros metadatos de los archivos subidos",
    "messagesMediaSettings.stripMetadataDescription":
        "Elimina EXIF, ubicación GPS, datos de la cámara y otros metadatos ocultos de las fotos y vídeos que envías. La imagen no cambia y se conserva la rotación para que las fotos se vean derechas.",
    "messagesMediaSettings.stripMetadataWarning":
        "Advertencia: si esto está desactivado, los archivos que envíes pueden revelar tu información personal, incluida la ubicación donde se tomaron.",
    "messagesMediaSettings.randomizeFileNames": "Randomize file names",
    "messagesMediaSettings.randomizeFileNamesDescription":
        "Upload files under a random name made of letters and numbers instead of their real name. The file extension is kept, including ones like .tar.gz.",
    "messagesMediaSettings.sendGifsAsAnimatedWebp":
        "Enviar GIF como WebP animado",
    "messagesMediaSettings.reencodeGifsYouSend":
        "Recodifica los GIF que envías como WebP animado sin pérdida, que suele ser más pequeño y puede reproducirse mientras se descarga. La imagen no cambia. Un GIF que no se reduciría se envía tal cual.",
    "messagesMediaSettings.defaultTab": "Pestaña predeterminada",
    "messagesMediaSettings.whichTabTheGifPickerOpens":
        "La pestaña en la que se abre el selector de GIF.",
    "messagesMediaSettings.defaultGifTab": "Pestaña de GIF predeterminada",
    "messagesMediaSettings.favourites": "Favoritos",
    "midiSoundBank.midi": "MIDI",
    "midiSoundBank.soundBank": "Banco de sonidos",
    "midiSoundBank.theInstrumentSoundsUsedTo":
        "Los sonidos de instrumentos que se usan para reproducir adjuntos MIDI.",
    "midiSoundBank.system": "Sistema",
    "midiSoundBank.included": "Incluido",
    "midiSoundBank.custom": "Personalizado",
    "midiSoundBank.noSystemSoundBankFound":
        "No se encontró ningún banco de sonidos del sistema en este dispositivo, así que se usa el incluido.",
    "midiSoundBank.chooseFile": "Elegir archivo",
    "midiSoundBank.chooseAnotherFile": "Elegir otro archivo",
    "midiSoundBank.saving": "Guardando…",
    "midiSoundBank.sf2Sf3OrDlsUpTo":
        "Personalizado: un archivo SF2, SF3 o DLS de hasta 256 MB, guardado en este dispositivo.",
    "midiSoundBank.useAnSf2Sf3OrDls": "Usa un archivo SF2, SF3 o DLS.",
    "midiSoundBank.thatFileIsEmpty": "Ese archivo está vacío.",
    "midiSoundBank.fileIsTooLarge":
        "Ese archivo es demasiado grande (máx. 256 MB).",
    "midiSoundBank.notASoundBank": "Ese archivo no es un banco de sonidos.",
    "midiSoundBank.couldNotSave":
        "No se pudo guardar el banco de sonidos en este dispositivo (puede que el almacenamiento esté lleno).",

    // src/lib/components/ui/ModalDialog.fixture.svelte
    "modalDialog.fixture.fixtureDialog": "Diálogo de prueba",

    // src/lib/components/settings/NotificationSettings.svelte
    "notificationSettings.thisDevice": "Este dispositivo",
    "notificationSettings.systemPermission": "Permiso del sistema",
    "notificationSettings.pushNotifications": "Notificaciones push",
    "notificationSettings.permissionIsBlockedInSystemSettings":
        "El permiso está bloqueado en los ajustes del sistema",
    "notificationSettings.notificationsAreNotSupportedHere":
        "Las notificaciones no son compatibles aquí",
    "notificationSettings.allowThisAppToSendNotifications":
        "Permitir que esta aplicación envíe notificaciones",
    "notificationSettings.requesting": "Solicitando…",
    "notificationSettings.blocked": "Bloqueado",
    "notificationSettings.unavailable": "No disponible",
    "notificationSettings.enable": "Activar",
    "notificationSettings.pushService": "Servicio push",
    "notificationSettings.pushServiceLabel": "Entregadas a través de",
    "notificationSettings.pushServiceDescription":
        "Cómo llegan las notificaciones a este dispositivo mientras la aplicación está cerrada. UnifiedPush funciona sin los servicios de Google, mediante una aplicación distribuidora como ntfy.",
    "notificationSettings.pushServiceAutomatic": "Automático",
    "notificationSettings.pushServiceFcm": "Google (Firebase)",
    "notificationSettings.pushServiceFcmUnavailable":
        "Google (Firebase), no disponible aquí",
    "notificationSettings.pushServiceUnifiedPush": "UnifiedPush: {label}",
    "notificationSettings.pushServiceNoDistributor":
        "No hay ningún distribuidor de UnifiedPush instalado. Instala uno (por ejemplo ntfy) para recibir notificaciones sin los servicios de Google.",
    "notificationSettings.pushServiceActiveFcm":
        "Ahora se usa Google (Firebase).",
    "notificationSettings.pushServiceActiveUnifiedPush":
        "Ahora se usa UnifiedPush ({label}).",
    "notificationSettings.pushServiceActiveNone":
        "No hay ningún servicio push activo, así que las notificaciones solo llegan mientras la aplicación está abierta.",
    "notificationSettings.pushServiceSwitchFailed":
        "No se pudo cambiar el servicio push",
    "notificationSettings.sound": "Sonido",
    "notificationSettings.notificationSound": "Sonido de notificación",
    "notificationSettings.playASoundForLoudNotifications":
        "Reproducir un sonido para las notificaciones sonoras",
    "notificationSettings.desktopAlerts": "Alertas de escritorio",
    "notificationSettings.popUpAndTaskbarFlash":
        "Ventana emergente y parpadeo de la barra de tareas",
    "notificationSettings.whichNotificationsShowASystemPop":
        "Qué notificaciones muestran una ventana emergente del sistema y hacen parpadear el icono de la barra de tareas mientras la ventana está en segundo plano.",
    "notificationSettings.popUps": "Ventanas emergentes",
    "notificationSettings.popUpNotifications": "Notificaciones emergentes",
    "notificationSettings.whichNotificationsShowASystemPopUp":
        "Qué notificaciones muestran una ventana emergente del sistema mientras la aplicación está en segundo plano.",
    "notificationSettings.multipleDevices": "Varios dispositivos",
    "notificationSettings.quietOnMyOtherDevices":
        "Silencio en mis otros dispositivos",
    "notificationSettings.whileYouReActivelyUsingOne":
        "Mientras usas activamente un dispositivo, los demás omiten el sonido y la ventana emergente de las notificaciones hasta que ese dispositivo lleve este tiempo inactivo. Se aplica a todos los dispositivos de tu cuenta; las notificaciones siguen apareciendo en tu bandeja y los contadores de no leídos no cambian.",
    "notificationSettings.custom": "Personalizado…",
    "notificationSettings.customQuietDurationInMinutes":
        "Duración del silencio personalizada, en minutos",
    "notificationSettings.minutesMax":
        "minutos (máx. {MAX_CUSTOM_GRACE_MINUTES})",
    "notificationSettings.couldnTSaveToYourAccount":
        "No se pudo guardar en tu cuenta; puede que tus otros dispositivos mantengan el ajuste anterior. Comprueba tu conexión y vuelve a intentarlo.",
    "notificationSettings.retrySavingTheOtherDeviceQuiet":
        "Reintentar guardar el ajuste de silencio en otros dispositivos",
    "notificationSettings.retrying": "Reintentando…",
    "notificationSettings.rules": "Reglas",
    "notificationSettings.notificationRules": "Reglas de notificación",
    "notificationSettings.loudNotifyWithSoundSilentNotify":
        "Sonora = notificar con sonido · Silenciosa = notificar sin sonido · Desactivada = sin notificación",
    "notificationSettings.keywordHighlights": "Palabras clave destacadas",
    "notificationSettings.getNotifiedWhenAMessageContains":
        "Recibe una notificación cuando un mensaje contenga una palabra o frase. No distingue mayúsculas de minúsculas;",
    "notificationSettings.and": "y",
    "notificationSettings.areWildcards": "son comodines.",
    "notificationSettings.addAKeyword": "Añadir una palabra clave…",
    "notificationSettings.newKeyword": "Nueva palabra clave",
    "notificationSettings.noKeywordRulesYet":
        "Todavía no hay reglas de palabras clave.",
    "notificationSettings.behaviorFor": "Comportamiento para {pattern}",
    "notificationSettings.enable2": "Activar {pattern}",
    "notificationSettings.loudOnly": "Solo sonoras",
    "notificationSettings.onlyNotificationsThatMakeASound":
        "Solo las notificaciones que suenan",
    "notificationSettings.silentAndLoud": "Silenciosas y sonoras",
    "notificationSettings.everyNotificationLoudOrSilent":
        "Todas las notificaciones, sonoras o silenciosas",
    "notificationSettings.none": "Ninguna",
    "notificationSettings.neverAlertOnThisDevice":
        "No avisar nunca en este dispositivo",
    "notificationSettings.couldNotSaveNotificationSetting":
        "No se pudo guardar el ajuste de notificación",
    "notificationSettings.highlightSound": "Destacar + sonido",
    "notificationSettings.notifyWithAHighlightAndSound":
        "Notificar con un resaltado y un sonido",
    "notificationSettings.highlight": "Destacar",
    "notificationSettings.notifyWithAHighlight": "Notificar con un resaltado",
    "notificationSettings.notify": "Notificar",
    "notificationSettings.notifyWithoutAHighlight": "Notificar sin resaltado",
    "notificationSettings.failedToAddKeyword":
        "No se pudo añadir la palabra clave",
    "notificationSettings.failedToUpdateKeyword":
        "No se pudo actualizar la palabra clave",
    "notificationSettings.failedToDeleteKeyword":
        "No se pudo eliminar la palabra clave",
    "notificationSettings.accountNotificationsOff":
        "Las notificaciones están desactivadas para esta cuenta",
    "notificationSettings.accountNotificationsOffDetail":
        "Todas las notificaciones de esta cuenta están desactivadas en el servidor, probablemente desde otra aplicación, así que nada notifica en ningún dispositivo, digan lo que digan los ajustes de abajo.",
    "notificationSettings.turnOn": "Activar",
    "notificationSettings.couldNotTurnOnNotifications":
        "No se pudieron activar las notificaciones",

    // src/lib/components/layout/NotificationsPanel.svelte
    "notificationsPanel.clearAll": "Borrar todo",
    "notificationsPanel.couldNotRefreshServerNotificationsTap":
        "No se pudieron actualizar las notificaciones del servidor. Toca para reintentar.",
    "notificationsPanel.noNotifications": "No hay notificaciones.",
    "notificationsPanel.jumpToMessage": "Saltar al mensaje:",
    "notificationsPanel.in": "en #{roomName}",
    "notificationsPanel.message": "(mensaje)",

    // src/lib/components/messages/OutboxStrip.svelte
    "outboxStrip.queued": "En cola",
    "outboxStrip.sending": "Enviando…",
    "outboxStrip.failed": "Error",

    // src/lib/components/layout/OwnStatusEditor.svelte
    "ownStatusEditor.pickAStatusEmoji": "Elige un emoji de estado",
    "ownStatusEditor.whatSHappening": "¿Qué está pasando?",
    "ownStatusEditor.statusText": "Texto del estado",
    "ownStatusEditor.clearStatus": "Borrar el estado",
    "ownStatusEditor.couldNotSaveStatus": "No se pudo guardar el estado",

    // src/lib/components/layout/PinnedMessagesPanel.svelte
    "pinnedMessagesPanel.pinnedMessages": "Mensajes fijados",
    "pinnedMessagesPanel.noPinnedMessages": "No hay mensajes fijados.",
    "pinnedMessagesPanel.jump": "Ir",
    "pinnedMessagesPanel.unpin": "Desfijar",

    // src/lib/components/plugins/PluginPopoverHost.svelte
    "pluginPopoverHost.plugin": "Plugin",

    // src/lib/components/settings/PluginSettingsForm.svelte
    "pluginSettingsForm.backToPlugins": "Volver a los plugins",
    "pluginSettingsForm.settings": "Ajustes de {pluginName}",
    "pluginSettingsForm.thisPluginHasNoSettings":
        "Este plugin no tiene ajustes.",
    "pluginSettingsForm.moveUp": "Subir",
    "pluginSettingsForm.moveDown": "Bajar",
    "pluginSettingsForm.removeRow": "Quitar la fila",

    // src/lib/components/settings/PluginsSettings.svelte
    "pluginsSettings.back": "← Atrás",
    "pluginsSettings.syncYourEnabledPluginsSettingsTo":
        "Sincroniza tus plugins activados y sus ajustes con tu cuenta de Matrix (si no, son por dispositivo). Al traerlos se muestra qué cambiará antes de ejecutar nada.",
    "pluginsSettings.pushToAccount": "Enviar a la cuenta",
    "pluginsSettings.pullFromAccount": "Traer de la cuenta",
    "pluginsSettings.thisPullWill": "Esto hará lo siguiente:",
    "pluginsSettings.addRepos": "Añadir repositorios: {join}",
    "pluginsSettings.installFromRepos":
        "Instalar desde sus repositorios: {join}",
    "pluginsSettings.couldNotInstall":
        "Aplicado, pero no se pudieron instalar estos plugins: {join}",
    "pluginsSettings.enable": "Activar: {join}",
    "pluginsSettings.disable": "Desactivar: {join}",
    "pluginsSettings.updateSettingsFor": "Actualizar los ajustes de: {join}",
    "pluginsSettings.setAutoUpdate":
        "Establecer la actualización automática: {value}",
    "pluginsSettings.setPerPluginAutoUpdate":
        "Establecer la actualización automática por plugin: {join}",
    "pluginsSettings.notInstalledOnThisDeviceInstall":
        "No instalados en este dispositivo (instálalos desde Explorar y vuelve a traerlos): {join}",
    "pluginsSettings.nothingToChangeAlreadyInSync":
        "No hay nada que cambiar; ya está sincronizado.",
    "pluginsSettings.apply": "Aplicar",
    "pluginsSettings.installed": "Instalados",
    "pluginsSettings.noPluginsInstalled": "No hay plugins instalados.",
    "pluginsSettings.needsUpdate": "Necesita actualizarse",
    "pluginsSettings.updateToV": "Actualizar a v{value}",
    "pluginsSettings.updating": "Actualizando...",
    "pluginsSettings.update": "Actualizar",
    "pluginsSettings.pluginSettings": "Ajustes del plugin",
    "pluginsSettings.enable2": "Activar {name}",
    "pluginsSettings.working": "Trabajando...",
    "pluginsSettings.autoUpdateThisPlugin":
        "Actualizar este plugin automáticamente",
    "pluginsSettings.autoDefault": "Auto: predeterminado",
    "pluginsSettings.autoOn": "Auto: sí",
    "pluginsSettings.autoOff": "Auto: no",
    "pluginsSettings.confirmRemove": "Confirmar quitar {name}",
    "pluginsSettings.removePlugin": "Quitar plugin",
    "pluginsSettings.remove": "Quitar {name}",
    "pluginsSettings.browse": "Explorar",
    "pluginsSettings.loading": "Cargando...",
    "pluginsSettings.noPluginsInThisRepoYet":
        "Todavía no hay plugins en este repositorio.",
    "pluginsSettings.install": "Instalar",
    "pluginsSettings.repos": "Repositorios",
    "pluginsSettings.official": "Oficial",
    "pluginsSettings.removeRepo": "Quitar repositorio",
    "pluginsSettings.addARepo": "Añadir un repositorio",
    "pluginsSettings.thirdPartyReposRunFullTrust":
        "Los repositorios de terceros ejecutan código de plena confianza con acceso total a tu cuenta y tus mensajes. Añade solo repositorios en los que confíes.",
    "pluginsSettings.ownerRepoOrGithubUrl":
        "propietario/repositorio o URL de GitHub",
    "pluginsSettings.addRepo": "Añadir repositorio",
    "pluginsSettings.syncPlugins": "Sincronizar plugins",
    "pluginsSettings.disableAllPlugins": "Desactivar todos los plugins",
    "pluginsSettings.autoUpdatePlugins": "Actualizar plugins automáticamente",
    "pluginsSettings.automaticallyPullNewerVersionsOfRepo":
        "Descarga automáticamente las versiones más recientes de los plugins de repositorios.",
    "pluginsSettings.pushedYourPluginSetToYour":
        "Se ha enviado tu conjunto de plugins a tu cuenta.",
    "pluginsSettings.pushFailed": "No se pudo enviar.",
    "pluginsSettings.pullFailed": "No se pudo traer.",
    "pluginsSettings.appliedTheSyncedPluginSet":
        "Se ha aplicado el conjunto de plugins sincronizado.",
    "pluginsSettings.updateFailed": "No se pudo actualizar.",
    "pluginsSettings.couldnTRemovePlugin":
        "No se pudo quitar el plugin: {message}",
    "pluginsSettings.couldnTRemovePlugin2": "No se pudo quitar el plugin.",
    "pluginsSettings.cannotAddThisRepo": "No se puede añadir este repositorio.",
    "pluginsSettings.noIndexJson": "No hay index.json ({status})",
    "pluginsSettings.installFailed": "No se pudo instalar.",

    // src/lib/components/messages/PollBody.svelte
    "pollBody.finalResults": "Resultados finales",
    "pollBody.livePoll": "Encuesta en curso",
    "pollBody.resultsAreRevealedWhenThePoll":
        "Los resultados se muestran cuando termina la encuesta",
    "pollBody.chooseUpTo": "· elige hasta {maxSelections}",
    "pollBody.selected": "✓ seleccionada",
    "pollBody.submitting": "Enviando…",
    "pollBody.submitVote": "Enviar voto",
    "pollBody.votesAreHidden": "Los votos están ocultos",
    "pollBody.savingVote": "· guardando el voto…",
    "pollBody.closeThisPoll": "¿Cerrar esta encuesta?",
    "pollBody.closing": "Cerrando…",
    "pollBody.closePoll": "Cerrar la encuesta",
    "pollBody.pollUnsupportedFormat": "[Encuesta - formato no compatible]",
    "pollBody.failedToSubmitVote": "No se pudo enviar el voto",
    "pollBody.failedToClosePoll": "No se pudo cerrar la encuesta",
    "pollBody.voteCount": "{count, plural, one {# voto} other {# votos}}",

    // src/lib/components/ui/Portal.fixture.svelte
    "portal.fixture.hello": "hola",

    // src/lib/components/settings/PrivacySafetySettings.svelte
    "privacySafetySettings.privacy": "Privacidad",
    "privacySafetySettings.privateReadReceipts":
        "Confirmaciones de lectura privadas",
    "privacySafetySettings.sendTypingIndicators":
        "Enviar indicadores de escritura",
    "privacySafetySettings.indexEncryptedRooms":
        "Indexar las salas cifradas en este dispositivo",
    "privacySafetySettings.indexEncryptedRoomsHint":
        "Guarda una copia comprimida de los mensajes de tus salas cifradas en este dispositivo para que la búsqueda y la lista de multimedia funcionen en ellas. El historial se descarga poco a poco en segundo plano. Al desactivarlo se borra la copia.",
    "privacySafetySettings.letOthersInARoomSee":
        "Permite que las demás personas de una sala vean cuándo estás escribiendo. Desactívalo para escribir sin que se avise a nadie.",
    "privacySafetySettings.hideYourReadReceiptsFromOther":
        "Oculta tus confirmaciones de lectura a otros usuarios. Tus contadores de no leídos siguen funcionando; los demás simplemente no pueden ver hasta dónde has leído.",
    "privacySafetySettings.hideMessageTextInNotifications":
        "Ocultar el texto de los mensajes en las notificaciones",
    "privacySafetySettings.notificationsOnThisDeviceSayWho":
        "Las notificaciones de este dispositivo dicen quién te ha escrito, pero no qué ha dicho. Se siguen mostrando el remitente y el nombre de la sala. Solo se aplica a este dispositivo.",
    "privacySafetySettings.linkPreviewMedia":
        "Contenido de las vistas previas de enlaces",
    "privacySafetySettings.previewImagesAndVideosUsuallyCome":
        'Las imágenes y los vídeos de las vistas previas suelen venir directamente del sitio que los aloja, así que ese sitio conoce tu dirección IP y cuándo lees el mensaje. "Solo el servidor base" carga únicamente las copias que sirve tu propio servidor; "Desactivado" no carga nada. Ambas opciones ocultan también los reproductores de YouTube incrustados y las tarjetas de X/Twitter, que siempre se cargan directamente desde esos sitios. En cualquier caso, cada vista previa afectada conserva un botón para cargar su contenido. El interruptor para activar o desactivar las vistas previas de enlaces está en Mensajes y multimedia.',
    "privacySafetySettings.blockedUsers": "Usuarios bloqueados",
    "privacySafetySettings.all": "Todo",
    "privacySafetySettings.loadPreviewMediaFromWhereverIt":
        "Cargar el contenido de las vistas previas desde donde esté alojado",
    "privacySafetySettings.homeserverOnly": "Solo el servidor base",
    "privacySafetySettings.onlyLoadPreviewMediaYourOwn":
        "Cargar solo el contenido de las vistas previas que sirve tu propio servidor base",
    "privacySafetySettings.off": "Desactivado",
    "privacySafetySettings.neverLoadPreviewMediaAutomatically":
        "No cargar nunca automáticamente el contenido de las vistas previas",

    // src/lib/components/settings/ProfileFieldsEditor.svelte
    "profileFieldsEditor.moreAboutYou": "Más sobre ti",
    "profileFieldsEditor.banner": "Banner",
    "profileFieldsEditor.yourBanner": "Tu banner",
    "profileFieldsEditor.changeBanner": "Cambiar el banner",
    "profileFieldsEditor.showWhenIAmInA": "Mostrar cuando estoy en una llamada",
    "profileFieldsEditor.addsInACallToYour":
        'Añade "En una llamada" a tu perfil mientras estás conectado a una llamada de voz y lo quita cuando sales.',
    "profileFieldsEditor.pronouns": "Pronombres",
    "profileFieldsEditor.sheHerTheyThem": "ella, elle",
    "profileFieldsEditor.separateWithCommasMostPreferredFirst":
        "Sepáralos con comas, empezando por el que prefieras.",
    "profileFieldsEditor.status": "Estado",
    "profileFieldsEditor.statusEmoji": "Emoji de estado",
    "profileFieldsEditor.pickAStatusEmoji": "Elige un emoji de estado",
    "profileFieldsEditor.onHolidayUntilThe23rd":
        "De vacaciones hasta el día 23",
    "profileFieldsEditor.statusText": "Texto del estado",
    "profileFieldsEditor.bio": "Biografía",
    "profileFieldsEditor.tellPeopleAboutYourself":
        "Cuéntales a los demás algo sobre ti",
    "profileFieldsEditor.timezone": "Zona horaria",
    "profileFieldsEditor.timezoneRegion": "Región de la zona horaria",
    "profileFieldsEditor.notSet": "Sin establecer",
    "profileFieldsEditor.timezoneCity": "Ciudad de la zona horaria",
    "profileFieldsEditor.chooseACity": "Elige una ciudad",
    "profileFieldsEditor.europeLondon": "Europe/Madrid",
    "profileFieldsEditor.useMine": "Usar la mía",
    "profileFieldsEditor.usernameColour": "Color del nombre de usuario",
    "profileFieldsEditor.usernameColourOnDarkThemes":
        "Color del nombre de usuario en temas oscuros",
    "profileFieldsEditor.darkThemes": "temas oscuros",
    "profileFieldsEditor.usernameColourOnLightThemes":
        "Color del nombre de usuario en temas claros",
    "profileFieldsEditor.lightThemes": "temas claros",
    "profileFieldsEditor.resetToDefault": "Restablecer el predeterminado",
    "profileFieldsEditor.chooseAColour": "Elige un color",
    "profileFieldsEditor.oneColourForDarkThemesAnd":
        "Un color para los temas oscuros y otro para los claros, para que tu nombre se lea bien en ambos.",
    "profileFieldsEditor.links": "Enlaces",
    "profileFieldsEditor.label": "Etiqueta",
    "profileFieldsEditor.linkLabel": "Etiqueta del enlace",
    "profileFieldsEditor.httpsExampleOrg": "https://ejemplo.org",
    "profileFieldsEditor.linkAddress": "Dirección del enlace",
    "profileFieldsEditor.removeLink": "Quitar el enlace",
    "profileFieldsEditor.addLink": "Añadir enlace",
    "profileFieldsEditor.saved": "Guardado",
    "profileFieldsEditor.useATimezoneNameLikeEurope":
        "Usa un nombre de zona horaria como Europe/Madrid.",
    "profileFieldsEditor.chooseACity2": "Elige una ciudad.",
    "profileFieldsEditor.bannerUploadFailed": "No se pudo subir el banner",
    "profileFieldsEditor.failedToSaveProfileFields":
        "No se pudieron guardar los campos del perfil",

    // src/lib/components/layout/ProfileFooter.svelte
    "profileFooter.dismiss": "Descartar",
    "profileFooter.switchAccounts": "Cambiar de cuenta",
    "profileFooter.unknown": "Desconocido",

    // src/lib/components/settings/PushDiagnostics.svelte
    "pushDiagnostics.pushGateway": "Pasarela push",
    "pushDiagnostics.notificationRelay": "Retransmisión de notificaciones",
    "pushDiagnostics.pushNotificationsAreRelayedThroughThis":
        "Las notificaciones push se retransmiten a través de esta pasarela. Puede ver qué salas y remitentes te notifican, pero nunca el texto de tus mensajes.",
    "pushDiagnostics.warningYourHomeserverIsRoutingThis":
        "Aviso: tu servidor base está enviando las notificaciones push de este dispositivo a otra pasarela ({join}). Es esa pasarela, y no la de arriba, la que ve los metadatos de tus notificaciones.",
    "pushDiagnostics.verifiedYourHomeserverRoutesNotificationsTo":
        "Verificado: tu servidor base envía las notificaciones a esta pasarela.",
    "pushDiagnostics.noPushNotificationsAreRegisteredOn":
        "Todavía no hay notificaciones push registradas en esta cuenta.",

    // src/lib/components/ui/QrCodeImage.svelte
    "qrCodeImage.couldNotRenderTheVerificationCode":
        "No se pudo mostrar el código de verificación.",
    "qrCodeImage.qrCodeForDeviceVerification":
        "Código QR para verificar el dispositivo",

    // src/lib/components/layout/QuickActions.svelte
    "quickActions.newDm": "Nuevo MD",
    "quickActions.createRoomInSpace": "Crear una sala en el espacio",
    "quickActions.createNewRoom": "Crear una sala nueva",
    "quickActions.createNewSpace": "Crear un espacio nuevo",
    "quickActions.joinRoomByAddress": "Unirse a una sala por dirección",
    "quickActions.createARoom": "Crear una sala",
    "quickActions.createASpace": "Crear un espacio",
    "quickActions.newDirectMessage": "Nuevo mensaje directo",
    "quickActions.joinARoom": "Unirse a una sala",
    "quickActions.spaceName": "Nombre del espacio",
    "quickActions.roomName": "Nombre de la sala",
    "quickActions.mySpace": "Mi espacio",
    "quickActions.optional": "(opcional)",
    "quickActions.whatSThisSpaceAbout": "¿De qué trata este espacio?",
    "quickActions.whatSThisRoomAbout": "¿De qué trata esta sala?",
    "quickActions.opensStraightIntoACallMessages":
        "Se abre directamente en una llamada. Los mensajes siguen funcionando.",
    "quickActions.enableEncryption": "Activar el cifrado",
    "quickActions.canTBeTurnedOffLater": "No se puede desactivar más tarde.",
    "quickActions.findSomeoneToMessage": "Busca a alguien a quien escribir…",
    "quickActions.encryptThisDm": "Cifrar este MD",
    "quickActions.openTheDm": "Abrir el MD",
    "quickActions.roomAddressOrId": "Dirección o ID de la sala",
    "quickActions.roomServerCom": "#sala:servidor.com",
    "quickActions.requestSentYouLlBeAble":
        "Solicitud enviada: podrás unirte en cuanto alguien te deje entrar.",
    "quickActions.youCanTJoinThisRoom":
        "No puedes unirte directamente a esta sala, pero puedes solicitar acceso.",
    "quickActions.requestToJoin": "Solicitar acceso",
    "quickActions.create": "Crear",
    "quickActions.somethingWentWrong": "Algo ha salido mal",
    "quickActions.enterARoomAddressRoomServer":
        "Escribe una dirección de sala (#sala:servidor.com) o un ID de sala (!id:servidor.com)",
    "quickActions.couldNotSendTheJoinRequest":
        "No se pudo enviar la solicitud de acceso",

    // src/lib/components/messages/ReactorPopover.svelte
    "reactorPopover.more": "+{overflow} más",
    "reactorPopover.reactedWith": "Reaccionaron con {label}",
    "reactorPopover.userList": "Lista de usuarios",

    // src/lib/components/messages/RenameAttachmentDialog.svelte
    "renameAttachmentDialog.editAttachment": "Editar el adjunto",
    "renameAttachmentDialog.filename": "Nombre del archivo",
    "renameThreadDialog.nameThread": "Poner nombre al hilo",
    "renameThreadDialog.renameThread": "Cambiar el nombre del hilo",
    "renameThreadDialog.threadName": "Nombre del hilo",
    "renameThreadDialog.everyoneInTheRoomSeesIt":
        "Todos los de la sala ven este nombre en Zam. Otras aplicaciones de Matrix no lo muestran.",
    "renameThreadDialog.removeName": "Quitar el nombre",
    "renameThreadDialog.couldNotSaveTheName": "No se pudo guardar el nombre",

    // src/lib/components/layout/RoomDirectory.svelte
    "roomDirectory.exploreRooms": "Explorar salas",
    "roomDirectory.onYourHomeserver": "en tu servidor base",
    "roomDirectory.publicRooms": "Salas públicas {value}",
    "roomDirectory.rooms": "· ~{totalEstimate} salas",
    "roomDirectory.searchRooms": "Buscar salas…",
    "roomDirectory.serverOptional": "Servidor (opcional)",
    "roomDirectory.search": "Buscar",
    "roomDirectory.noRoomsFound": "No se encontraron salas.",
    "roomDirectory.space": "Espacio",
    "roomDirectory.open": "Abrir",
    "roomDirectory.knockOnly": "Solo con solicitud",
    "roomDirectory.requestToJoin": "Solicitar acceso",
    "roomDirectory.requested": "Solicitado",
    "roomDirectory.somethingWentWrong": "Algo ha salido mal",

    // src/lib/components/layout/RoomHeaderOverflowMenu.svelte
    "roomHeaderOverflowMenu.moreRoomOptions": "Más opciones de la sala",
    "roomHeaderOverflowMenu.unread": "sin leer",
    "roomHeaderOverflowMenu.badgeThreads":
        "{count, plural, one {{badge} mención sin leer} other {{badge} menciones sin leer}}",
    "roomHeaderOverflowMenu.badgePinned":
        "{count, plural, one {{badge} mensaje fijado} other {{badge} mensajes fijados}}",
    "roomHeaderOverflowMenu.badgeNotifications":
        "{count, plural, one {{badge} notificación sin leer} other {{badge} notificaciones sin leer}}",
    "roomHeaderOverflowMenu.badgeMedia":
        "{count, plural, one {{badge} elemento} other {{badge} elementos}}",
    "roomHeaderOverflowMenu.badgeMembers":
        "{count, plural, one {{badge} miembro} other {{badge} miembros}}",

    // src/lib/components/layout/RoomList.svelte
    "roomList.doneReordering": "Terminar de reordenar",
    "roomList.reorderRooms": "Reordenar salas",
    "roomList.spaceSettings": "Ajustes del espacio",
    "roomList.pendingInvites": "Invitaciones pendientes",
    "roomList.inVoice": "{name} - en voz",
    "roomList.orderValue": "Valor de orden",
    "roomList.roomSettings": "Ajustes de la sala",
    "roomList.favourites": "Favoritos",
    "roomList.channels": "Canales",
    "roomList.rooms": "Salas",
    "roomList.lowPriority": "Prioridad baja",
    "roomList.browseRooms": "Explorar salas",
    "roomList.members": "{numMembers} miembros",
    "roomList.requested": "Solicitado",
    "roomList.cancelRequest": "Cancelar la solicitud",
    "roomList.youCanTJoinThisRoom":
        "No puedes unirte directamente a esta sala. ¿Quieres solicitar acceso?",
    "roomList.notNow": "Ahora no",
    "roomList.requestToJoin": "Solicitar acceso",
    "roomList.directMessages": "Mensajes directos",
    "roomList.noRoomsYet": "Todavía no hay salas",
    "roomList.emptyCategory": "No hay salas",
    "roomList.copyRoomLink": "Copiar el enlace de la sala",
    "roomList.markAsRead": "Marcar como leído",
    "roomList.addToSpace": "Añadir a un espacio",
    "roomList.clickAgainToLeave": "Haz clic otra vez para salir",
    "roomList.leaveRoom": "Salir de la sala",
    "roomList.couldNotSendTheJoinRequest":
        "No se pudo enviar la solicitud de acceso",
    "roomList.orderMustBeBetween0And":
        "El orden debe estar entre 0 y 1; se ha usado {value} en su lugar.",
    "roomList.failedToSetOrder": "No se pudo establecer el orden",

    // src/lib/components/layout/RoomMediaPanel.svelte
    "roomMediaPanel.media": "Multimedia",
    "roomMediaPanel.closeMediaPanel": "Cerrar el panel de multimedia",
    "roomMediaPanel.media2": "Multimedia ({length}{value})",
    "roomMediaPanel.files": "Archivos ({length}{value})",
    "roomMediaPanel.tryAgain": "Volver a intentarlo",
    "roomMediaPanel.play": "{name} - reproducir",
    "roomMediaPanel.video": "Vídeo",
    "roomMediaPanel.audio": "Audio",
    "roomMediaPanel.file": "Archivo",
    "roomMediaPanel.decryptingMedia": "Descifrando el contenido",
    "roomMediaPanel.decryptingMedia2": "Descifrando el contenido...",
    "roomMediaPanel.mediaCouldNotBeLoaded": "No se pudo cargar el contenido",
    "roomMediaPanel.couldNotLoadThisMedia": "No se pudo cargar este contenido.",
    "roomMediaPanel.noMediaFoundInTheLast":
        "No se encontró contenido multimedia en los últimos cientos de mensajes.",
    "roomMediaPanel.noFilesFoundInTheLast":
        "No se encontraron archivos en los últimos cientos de mensajes.",
    "roomMediaPanel.noImagesOrVideosInThis":
        "Todavía no hay imágenes ni vídeos en esta sala.",
    "roomMediaPanel.noFilesInThisRoomYet":
        "Todavía no hay archivos en esta sala.",
    "roomMediaPanel.couldNotLoadMedia": "No se pudo cargar el contenido.",
    "roomMediaPanel.couldNotLoadMoreMedia": "No se pudo cargar más contenido.",
    "roomMediaPanel.failedToDownloadAttachment":
        "No se pudo descargar el adjunto",

    // src/lib/components/layout/RoomSettings.svelte
    "roomSettings.closeSettings": "Cerrar los ajustes",
    "roomSettings.backToSettings": "Volver a los ajustes",
    "roomSettings.settings": "{name} - Ajustes",
    "roomSettings.roomAvatar": "Avatar de la sala",
    "roomSettings.roomName": "Nombre de la sala",
    "roomSettings.saved": "¡Guardado!",
    "roomSettings.saveChanges": "Guardar cambios",
    "roomSettings.advanced": "Avanzado",
    "roomSettings.spaceId": "ID del espacio",
    "roomSettings.roomId": "ID de la sala",
    "roomSettings.copied": "¡Copiado!",
    "roomSettings.roomVersionV": "Versión de la sala: v{getVersion}",
    "roomSettings.upgradeRoom": "Actualizar la sala…",
    "roomSettings.thisCreatesANewRoomOn":
        "Esto crea una sala nueva en la v{recommendedVersion} y marca esta como sustituida. Se dirigirá a los miembros a la nueva sala.",
    "roomSettings.upgrading": "Actualizando…",
    "roomSettings.upgradeRoom2": "Actualizar la sala",
    "roomSettings.whoCanJoin": "¿Quién puede unirse?",
    "roomSettings.spaceMembersAnyoneInCanJoin":
        "Miembros del espacio: cualquiera en {parentSpaceNames} puede unirse",
    "roomSettings.spaceMembersAnyoneInTheParent":
        "Miembros del espacio: cualquiera en el espacio superior puede unirse",
    "roomSettings.messageHistory": "Historial de mensajes",
    "roomSettings.guestAccess": "Acceso de invitados",
    "roomSettings.allowGuestsToJoinWithoutAn":
        "Permitir que los invitados se unan sin una cuenta",
    "roomSettings.guestsAreAnonymousAccountsTheHomeserver":
        "Los invitados son cuentas anónimas que el servidor base crea bajo demanda. Muchos servidores desactivan por completo el registro de invitados, en cuyo caso esto no tiene efecto.",
    "roomSettings.discoverability": "Visibilidad",
    "roomSettings.addresses": "Direcciones",
    "roomSettings.loadingAddresses": "Cargando direcciones…",
    "roomSettings.noAddressesYet": "Todavía no hay direcciones.",
    "roomSettings.main": "Principal",
    "roomSettings.remove": "Quitar {alias}",
    "roomSettings.mainAddress": "Dirección principal",
    "roomSettings.noMainAddress": "Sin dirección principal",
    "roomSettings.set": "Establecer",
    "roomSettings.myRoom": "mi-sala",
    "roomSettings.serverAccessControl": "Control de acceso de servidores",
    "roomSettings.controlWhichHomeserversMayParticipateIn":
        "Controla qué servidores base pueden participar en esta sala. Comodines:",
    "roomSettings.matchesAnyCharacters":
        "coincide con cualquier secuencia de caracteres,",
    "roomSettings.matchesOneDeniedServersAreRemoved":
        "coincide con uno. Los servidores denegados se eliminan de la federación de esta sala.",
    "roomSettings.noServerAclIsSetAll":
        "No hay ninguna ACL de servidores. Todos los servidores pueden participar.",
    "roomSettings.allowedServersOnePerLine":
        "Servidores permitidos (uno por línea)",
    "roomSettings.deniedServersOnePerLine":
        "Servidores denegados (uno por línea)",
    "roomSettings.allowServersIdentifiedByARaw":
        "Permitir servidores identificados por una dirección IP sin más",
    "roomSettings.saveServerAcl": "Guardar la ACL de servidores",
    "roomSettings.youDoNotHavePermissionTo":
        "No tienes permiso para editar la ACL de servidores de esta sala.",
    "roomSettings.appliesToTheSpaceAndAll":
        "Se aplica al espacio y a todas sus salas.",
    "roomSettings.notificationLevel": "Nivel de notificación",
    "roomSettings.encryption": "Cifrado",
    "roomSettings.encrypted": "Cifrada",
    "roomSettings.notEncrypted": "Sin cifrar",
    "roomSettings.messagesInThisRoomAreEnd":
        "Los mensajes de esta sala están cifrados de extremo a extremo. Esto no se puede desactivar.",
    "roomSettings.roomKey": "Clave de la sala",
    "roomSettings.resetRoomKey": "Restablecer la clave de la sala",
    "roomSettings.resetRoomKeyHint":
        "Si no pueden leer tus mensajes aquí, esto hace que tu próximo mensaje use una clave nueva y la comparta otra vez con todas las sesiones de la sala.",
    "roomSettings.couldNotResetRoomKey":
        "No se pudo restablecer la clave de la sala",
    "roomSettings.enableEncryption": "Activar el cifrado",
    "roomSettings.typeToConfirm":
        "Escribe {ENABLE_ENCRYPTION_CONFIRM_PHRASE} para confirmar",
    "roomSettings.enabling": "Activando…",
    "roomSettings.powerLevelRequiredForEachAction":
        "Nivel de poder necesario para cada acción (0–100).",
    "roomSettings.joinCallsVoiceVideo": "Unirse a llamadas (voz/vídeo)",
    "roomSettings.invite": "Invitar",
    "roomSettings.searchMembers": "Buscar miembros…",
    "roomSettings.banned": "Vetados ({length})",
    "roomSettings.pendingJoinRequests":
        "Solicitudes de acceso pendientes ({length})",
    "roomSettings.deny": "Denegar",
    "roomSettings.approve": "Aprobar",
    "roomSettings.unban": "Levantar el veto",
    "roomSettings.noBannedMembers": "No hay miembros vetados",
    "roomSettings.you": " (tú)",
    "roomSettings.setRole": "Establecer rol…",
    "roomSettings.admin100": "Administrador (100)",
    "roomSettings.moderator50": "Moderador (50)",
    "roomSettings.member0": "Miembro (0)",
    "roomSettings.muted1": "Silenciado (-1)",
    "roomSettings.kick": "Expulsar",
    "roomSettings.ban": "Vetar",
    "roomSettings.hideThisUserSMessagesEverywhere":
        "Ocultar los mensajes de este usuario en todas partes (se guarda en tu cuenta)",
    "roomSettings.setThe": "Establece el campo",
    "roomSettings.fieldOnEachChildRoomTo":
        "de cada sala hija para controlar el orden (lexicográfico). Déjalo en blanco para ordenar por fecha de creación.",
    "roomSettings.suggested": "Sugerida",
    "roomSettings.removeSuggestedHint": "Quitar la sugerencia",
    "roomSettings.markAsSuggested": "Marcar como sugerida",
    "roomSettings.unsuggest": "Dejar de sugerir",
    "roomSettings.suggest": "Sugerir",
    "roomSettings.order": "order",
    "roomSettings.removeFromSpace": "Quitar del espacio",
    "roomSettings.noChildRooms": "No hay salas hijas",
    "roomSettings.useYourGlobalNotificationSettings":
        "Usa tus ajustes de notificación globales.",
    "roomSettings.allMessages": "Todos los mensajes",
    "roomSettings.notifyForEveryMessage": "Notificar cada mensaje.",
    "roomSettings.mentionsOnly": "Solo menciones",
    "roomSettings.notifyOnlyForMentionsAndKeywords":
        "Notificar solo las @menciones y las palabras clave.",
    "roomSettings.neverNotify": "No notificar nunca.",
    "roomSettings.failedToUpdateNotifications":
        "No se pudieron actualizar las notificaciones.",
    "roomSettings.failedToEnableEncryption": "No se pudo activar el cifrado",
    "roomSettings.failedToSave": "No se pudo guardar",
    "roomSettings.uploadFailed": "Error al subir",
    "roomSettings.failedToUpgradeRoom": "No se pudo actualizar la sala",
    "roomSettings.failedToSaveServerAcl":
        "No se pudo guardar la ACL de servidores",
    "roomSettings.couldNotChangeVisibility":
        "No se pudo cambiar la visibilidad",
    "roomSettings.couldNotLoadThisRoomS":
        "No se pudieron cargar las direcciones de esta sala",
    "roomSettings.couldNotAddThatAddress": "No se pudo añadir esa dirección",
    "roomSettings.thisAddressIsPublishedAsOne":
        "Esta dirección está publicada como una de las direcciones de la sala y no tienes permiso para retirarla, así que no se puede quitar. Pídeselo a un administrador de la sala.",
    "roomSettings.couldNotRemoveThatAddress": "No se pudo quitar esa dirección",
    "roomSettings.couldNotSetTheMainAddress":
        "No se pudo establecer la dirección principal",
    "roomSettings.failed": "Error",
    "roomSettings.muted": "Silenciado",
    "roomSettings.admin": "Administrador",
    "roomSettings.moderator": "Moderador",
    "roomSettings.member": "Miembro",
    "roomSettings.failedToUpdateSuggestion":
        "No se pudo actualizar la sugerencia",
    "roomSettings.listThisRoomInTheServerDirectory":
        "Mostrar esta sala en el directorio del servidor",
    "roomSettings.listThisSpaceInTheServerDirectory":
        "Mostrar este espacio en el directorio del servidor",
    "roomSettings.listsTheRoomByIdBeingFound":
        "Muestra la sala por su ID. Para que se encuentre por nombre también hace falta una dirección publicada; añade una abajo.",
    "roomSettings.listsTheSpaceByIdBeingFound":
        "Muestra el espacio por su ID. Para que se encuentre por nombre también hace falta una dirección publicada; añade una abajo.",
    "roomSettings.aPublishedAddressLetsPeopleFindRoom":
        "Una dirección publicada permite que la gente encuentre esta sala y se una a ella por su nombre en lugar de por su ID.",
    "roomSettings.aPublishedAddressLetsPeopleFindSpace":
        "Una dirección publicada permite que la gente encuentre este espacio y se una a él por su nombre en lugar de por su ID.",
    "roomSettings.chooseHowThisRoomNotifiesYou":
        "Elige cómo te notifica esta sala.",
    "roomSettings.chooseHowThisSpaceNotifiesYou":
        "Elige cómo te notifica este espacio.",

    // src/lib/components/layout/ScreenSharePicker.svelte
    "screenSharePicker.chooseWhatToShare": "Elige qué compartir",
    "screenSharePicker.noPreview": "Sin vista previa",
    "screenSharePicker.screens": "Pantallas",
    "screenSharePicker.windows": "Ventanas",
    "screenSharePicker.quality": "Calidad: {quality}",
    "screenSharePicker.audio": "Audio",
    "screenSharePicker.audioAuto":
        "La app de la ventana, o todo el audio para una pantalla",
    "screenSharePicker.audioSystemExceptZam": "Todo el audio excepto Zam",
    "screenSharePicker.audioSystem": "Todo el audio del sistema",
    "screenSharePicker.audioApps": "Aplicaciones",
    "screenSharePicker.audioNone": "Sin audio",

    // src/lib/components/layout/ScreenShareQualityChips.svelte
    "screenShareQualityChips.resolution": "Resolución",
    "screenShareQualityChips.frameRate": "Fotogramas por segundo",
    "screenShareQualityChips.fps": "{f} FPS",
    "screenShareQualityChips.videoCodec": "Códec de vídeo",
    "screenShareQualityChips.hw": "HW",
    "screenShareQualityChips.codecHardware": "Lo codifica tu tarjeta gráfica",
    "screenShareQualityChips.codecSoftware": "Lo codifica tu procesador",
    "screenShareQualityChips.codecHint":
        "Para tu cámara y pantalla compartida. Solo aparecen los códecs que todos en la llamada pueden reproducir.",
    "screenShareQualityChips.codecBackupHint":
        "Alguien en la llamada no puede reproducir {codec}, así que recibe una copia en H.264, que usa más subida.",
    "screenShareQualityChips.codecEncryptedFallbackHint":
        "Alguien en esta llamada cifrada no puede reproducir {picked}, así que envías {current} hasta que se vaya.",
    "screenShareQualityChips.bitrate": "Tasa de bits",
    "screenShareQualityChips.kbps": "{n} kbps",
    "screenShareQualityChips.mbps": "{n} Mbps",
    "screenShareQualityChips.bitrateMeasured":
        "Tu subida mide {upload}, así que esto llega hasta {max}.",
    "screenShareQualityChips.bitrateUnmeasured":
        "Tu subida aún no se ha medido. Se mide mientras envías vídeo, así que por ahora esto llega hasta {max}.",
    "screenShareQualityChips.shareSystemAudio":
        "Compartir el audio del sistema",
    "screenShareQualityChips.appliesToNextShare":
        "Se aplica la próxima vez que compartas",
    "screenShareQualityChips.shareSystemAudioAppliesToNext":
        "Compartir el audio del sistema (se aplica la próxima vez que compartas)",

    // src/lib/components/layout/ScreenShareQualityPopover.svelte

    "screenShareQualityPopover.screenShareQuality":
        "Calidad de la pantalla compartida",

    // src/lib/components/settings/SecuritySettings.svelte
    "securitySettings.showingTheLastReadingThatLoaded":
        "Se muestra la última lectura que se cargó; puede estar desactualizada.",
    "securitySettings.securityEncryption": "Seguridad y cifrado",
    "securitySettings.setUpRecoverySoYourCross":
        "Configura la recuperación para que tu identidad de firma cruzada y tu historial de mensajes cifrados sobrevivan aunque cierres sesión en todos los dispositivos.",
    "securitySettings.verification": "Verificación",
    "securitySettings.loadingEncryptionStatus":
        "Cargando el estado del cifrado…",
    "securitySettings.encryptionStatusUnknownOnThisSession":
        "Se desconoce el estado del cifrado en esta sesión.",
    "securitySettings.recoveryKeyId": "ID de la clave de recuperación:",
    "securitySettings.setUpRecovery": "Configurar la recuperación",
    "securitySettings.approveOnAccountPageHint":
        "Puede que tu servidor te pida que lo apruebes en su página de cuenta.",
    "securitySettings.approveOnAccountPage": "Aprobar en tu página de cuenta",
    "securitySettings.approveOnAccountPageBody":
        "Tu servidor necesita que permitas este cambio. Abre tu página de cuenta, aprueba el restablecimiento de tu identidad criptográfica y luego vuelve y continúa.",
    "securitySettings.approveOnAccountPageRetry":
        "El servidor todavía no ha recibido la aprobación. Apruébalo en tu página de cuenta y luego continúa.",
    "securitySettings.openAccountPage": "Abrir la página de cuenta",
    "securitySettings.iVeApprovedIt": "Ya lo he aprobado",
    "securitySettings.weLlCreateA": "Crearemos una",
    "securitySettings.recoveryKey": "clave de recuperación",
    "securitySettings.aOneTimeCodeThatUnlocks":
        "- un código único que desbloquea tu historial cifrado y verifica las sesiones nuevas. Guárdalo en un lugar seguro, como un gestor de contraseñas; solo se muestra una vez y no podemos recuperarlo por ti.",
    "securitySettings.confirmYourAccountPasswordToCreate":
        "Confirma la contraseña de tu cuenta para crear tus claves de cifrado.",
    "securitySettings.accountPassword": "Contraseña de la cuenta",
    "securitySettings.alsoLetMeUnlockWithA":
        "Permitirme también desbloquear con una frase de contraseña que yo elija (opcional; tu clave de recuperación sigue funcionando y se sigue mostrando).",
    "securitySettings.recoveryPassphrase": "Frase de recuperación",
    "securitySettings.atLeastCharactersWeCanT":
        "Al menos {MIN_PASSPHRASE_LENGTH} caracteres. No podemos restablecerla por ti.",
    "securitySettings.settingUp": "Configurando…",
    "securitySettings.continue": "Continuar",
    "securitySettings.saveYourRecoveryKey": "Guarda tu clave de recuperación",
    "securitySettings.thisIsShown": "Esto se muestra",
    "securitySettings.onlyOnce": "solo una vez",
    "securitySettings.storeItNowWithoutItYou":
        ". Guárdala ahora: sin ella no podrás recuperar tu historial cifrado si pierdes el acceso a tus sesiones.",
    "securitySettings.copied": "Copiada ✓",
    "securitySettings.copyKey": "Copiar la clave",
    "securitySettings.youCanAlsoUnlockWithThe":
        "También puedes desbloquear con la frase de contraseña que elegiste. Conserva la clave de todos modos: es la única forma de entrar si olvidas la frase.",
    "securitySettings.iVeSavedMyRecoveryKey":
        "He guardado mi clave de recuperación en un lugar seguro.",
    "securitySettings.done": "Hecho",
    "securitySettings.keysNotOnServer":
        "Tus claves de firma cruzada nunca llegaron al servidor",
    "securitySettings.keysNotOnServerHint":
        "Esta sesión las creó al configurar la recuperación, pero la subida no terminó, así que tus sesiones no pueden verificarse entre sí. Súbelas ahora para arreglarlo.",
    "securitySettings.uploadKeys": "Subir claves",
    "securitySettings.couldNotUploadKeys": "No se pudieron subir tus claves",
    "securitySettings.recoveryIsSetUp": "La recuperación está configurada",
    "securitySettings.yourCrossSigningKeysAndA":
        "Tus claves de firma cruzada y una copia de seguridad de claves están guardadas de forma segura en el servidor, protegidas por tu clave de recuperación.",
    "securitySettings.recoveryIsNotSetUp":
        "La recuperación no está configurada",
    "securitySettings.thisAccountHasNoRecoveryKey":
        "Esta cuenta no tiene clave de recuperación ni copia de seguridad de claves hasta que completes el paso de abajo.",
    "securitySettings.lostYourRecoveryKeyResetRecovery":
        "¿Has perdido tu clave de recuperación? Restablecer la recuperación",
    "securitySettings.resettingCreatesA": "Al restablecer se crea una",
    "securitySettings.new": "nueva",
    "securitySettings.recoveryKeyAndReplacesYourCurrent":
        "clave de recuperación y se sustituye tu copia de seguridad actual. Tu clave de recuperación anterior deja de funcionar y puede que haya que volver a verificar otras sesiones. Hazlo solo si has perdido tu clave actual.",
    "securitySettings.yourOldRecoveryKeyAndBackup":
        "Tu clave de recuperación y tu copia de seguridad anteriores se restablecieron, pero no se creó la nueva recuperación. Termina de configurarla ahora: tus mensajes no se podrán recuperar en una sesión nueva hasta que lo hagas.",
    "securitySettings.working": "Trabajando…",
    "securitySettings.finishSettingUpRecovery":
        "Terminar de configurar la recuperación",
    "securitySettings.confirmYourAccountPasswordToReset":
        "Confirma la contraseña de tu cuenta para restablecer la recuperación.",
    "securitySettings.resetting": "Restableciendo…",
    "securitySettings.resetCreateNewKey": "Restablecer y crear una clave nueva",
    "securitySettings.messageHistoryBackup":
        "Copia de seguridad del historial de mensajes",
    "securitySettings.verifyThisSessionRestoreHistory":
        "Verificar esta sesión y restaurar el historial",
    "securitySettings.recoveryKey2": "Clave de recuperación",
    "securitySettings.passphrase": "Frase de contraseña",
    "securitySettings.enterYour": "Introduce tu",
    "securitySettings.recoveryPassphrase2": "frase de recuperación",
    "securitySettings.toVerifyThisSessionAndRestore":
        "para verificar esta sesión y restaurar tu historial de mensajes cifrados.",
    "securitySettings.thisSessionIsNowVerified":
        "Esta sesión ya está verificada",
    "securitySettings.encryptedHistoryRestored": "Historial cifrado restaurado",
    "securitySettings.couldNotSetUpRecovery":
        "No se pudo configurar la recuperación",
    "securitySettings.couldNotResetRecovery":
        "No se pudo restablecer la recuperación",
    "securitySettings.couldNotFinishSettingUpRecovery":
        "No se pudo terminar de configurar la recuperación",
    "securitySettings.couldNotVerifyThisSession":
        "No se pudo verificar esta sesión",

    // src/lib/components/settings/ServerSettings.svelte
    "serverSettings.scanningServer": "Analizando el servidor…",
    "serverSettings.what": "Lo que",
    "serverSettings.advertisesItemsMarkedUnknownArenT":
        "anuncia. Los elementos marcados como “Desconocido” no los anuncia el servidor y solo se detectan al usarlos.",
    "serverSettings.accountMessaging": "Cuenta y mensajería",
    "serverSettings.voiceVideoCallingMatrixrtc":
        "Llamadas de voz / vídeo (MatrixRTC)",
    "serverSettings.server": "Servidor",
    "serverSettings.latestSpecVersion":
        "Versión más reciente de la especificación",
    "serverSettings.defaultRoomVersion": "Versión de sala predeterminada",
    "serverSettings.advertisedFeatures": "Funciones anunciadas ({length})",
    "serverSettings.supported": "Compatible",
    "serverSettings.notSupported": "No compatible",
    "serverSettings.unknown": "Desconocido",
    "serverSettings.changePassword": "Cambiar la contraseña",
    "serverSettings.changeDisplayName": "Cambiar el nombre visible",
    "serverSettings.changeAvatar": "Cambiar el avatar",
    "serverSettings.manageEmailsPhoneNumbers":
        "Gestionar correos / números de teléfono",
    "serverSettings.threads": "Hilos",
    "serverSettings.privateReadReceipts": "Confirmaciones de lectura privadas",
    "serverSettings.sfuDiscoveryRtcFoci": "Descubrimiento de SFU (rtc_foci)",
    "serverSettings.delayedEventsCallCleanup":
        "Eventos diferidos (limpieza de llamadas)",
    "serverSettings.failedToReadServerCapabilities":
        "No se pudieron leer las capacidades del servidor",

    // src/lib/components/settings/SessionSettings.svelte
    "sessionSettings.sessionName": "Nombre de la sesión",
    "sessionSettings.current": "Actual",
    "sessionSettings.rename": "Cambiar el nombre",
    "sessionSettings.signOut": "¿Cerrar sesión?",
    "sessionSettings.signOut2": "Cerrar sesión",
    "sessionSettings.manageAtProvider": "Gestionar",
    "sessionSettings.confirmYourAccountPasswordToSign":
        "Confirma la contraseña de tu cuenta para cerrar esta sesión.",
    "sessionSettings.accountPassword": "Contraseña de la cuenta",
    "sessionSettings.signingOut": "Cerrando sesión…",
    "sessionSettings.encryption": "Cifrado",
    "sessionSettings.active": "Activo",
    "sessionSettings.unavailable": "No disponible",
    "sessionSettings.thisDeviceSKey": "Clave de este dispositivo",
    "sessionSettings.loadingDeviceKey": "Cargando la clave del dispositivo…",
    "sessionSettings.endToEndEncryptionCouldNot":
        "El cifrado de extremo a extremo no pudo iniciarse en esta sesión. Las salas cifradas mostrarán marcadores de posición.",
    "sessionSettings.encryptNewDirectMessages":
        "Cifrar los nuevos mensajes directos",
    "sessionSettings.newDmsYouStartAreEncrypted":
        "Los nuevos MD que inicies se cifran de forma predeterminada. Los MD existentes no cambian. Desactívalo si escribes a personas cuyos clientes no admiten cifrado.",
    "identityChange.own":
        "Tus claves de firma cruzada han cambiado. Vuelve a verificar esta sesión, o restablece y vuelve a firmar tus dispositivos, antes de confiar en los mensajes cifrados.",
    "identityChange.other":
        "La identidad de firma cruzada de {user} ha cambiado. Los mensajes cifrados para esa persona se retienen hasta que aceptes la nueva identidad.",
    "identityChange.accept": "Aceptar la nueva identidad",
    "identityChange.withdraw": "Retirar la verificación",
    "identityChange.dismiss": "Descartar el aviso de identidad",
    "sessionSettings.excludeInsecureDevices":
        "Excluir los dispositivos sin firma cruzada",
    "sessionSettings.excludeInsecureDevicesHelp":
        "Comparte claves de mensajes solo con los dispositivos que su propietario ha firmado de forma cruzada, y muestra solo sus mensajes (MSC4153). Los mensajes de dispositivos sin firma cruzada aparecerán como imposibles de descifrar.",
    "sessionSettings.onlySendToVerifiedDevices":
        "Enviar solo a dispositivos verificados",
    "sessionSettings.refuseToEncryptMessagesForSessions":
        "No cifrar mensajes para las sesiones que no has verificado. No recibirán tus mensajes en absoluto, incluidas tus propias sesiones sin verificar. Desactivado de forma predeterminada.",
    "sessionSettings.devicesCurrentlySignedInToThis":
        "Dispositivos con la sesión iniciada en esta cuenta.",
    "sessionSettings.refreshing": "Actualizando…",
    "sessionSettings.refresh": "Actualizar",
    "sessionSettings.loadingSessions": "Cargando las sesiones…",
    "sessionSettings.otherSessions": "Otras sesiones {value}",
    "sessionSettings.noOtherSessionsYouReOnly":
        "No hay otras sesiones: solo tienes la sesión iniciada aquí.",
    "sessionSettings.failedToLoadSessions":
        "No se pudieron cargar las sesiones",
    "sessionSettings.failedToRenameSession":
        "No se pudo cambiar el nombre de la sesión",
    "sessionSettings.failedToSignOutSession": "No se pudo cerrar la sesión",
    "sessionSettings.couldNotStartVerification":
        "No se pudo iniciar la verificación",

    // src/lib/components/messages/ShareLocationDialog.svelte
    "shareLocationDialog.shareLocation": "Compartir ubicación",
    "shareLocationDialog.sendOnce": "Enviar una vez",
    "shareLocationDialog.shareLive": "Compartir en tiempo real",
    "shareLocationDialog.locating": "Localizando…",
    "shareLocationDialog.useMyCurrentLocation": "Usar mi ubicación actual",
    "shareLocationDialog.descriptionOptional": "Descripción (opcional)",
    "shareLocationDialog.eGHomeTheCafOn":
        "p. ej. Casa, la cafetería de la esquina…",
    "shareLocationDialog.duration": "Duración",
    "shareLocationDialog.yourLiveLocationIsSharedWith":
        "Tu ubicación en tiempo real se comparte con esta sala hasta que la detengas o se acabe el tiempo.",
    "shareLocationDialog.sharing": "Compartiendo…",
    "shareLocationDialog.share": "Compartir",
    "shareLocationDialog.failedToStartLiveLocation":
        "No se pudo iniciar la ubicación en tiempo real",
    "shareLocationDialog.failedToShareLocation":
        "No se pudo compartir la ubicación",

    // src/lib/components/messages/ShareTargetSheet.svelte
    "shareTargetSheet.fileSWerenTAddedShares":
        "No se añadieron {droppedFiles} archivo(s). Se pueden compartir como máximo {SHARE_MAX_FILES} archivos, de {value} MB cada uno y {value2} MB en total.",
    "shareTargetSheet.addAMessage": "Añade un mensaje…",
    "shareTargetSheet.searchRooms": "Buscar salas",
    "shareTargetSheet.noJoinedRoomsFound":
        "No se encontraron salas a las que te hayas unido",
    "shareTargetSheet.send": "Enviar",
    "shareTargetSheet.shareToARoom": "Compartir en una sala",

    // src/lib/components/layout/SpaceLandingPanel.svelte
    "spaceLandingPanel.loadingRooms": "Cargando salas…",
    "spaceLandingPanel.browseRooms": "Explorar salas",
    "spaceLandingPanel.youHavenTJoinedARoom":
        "Todavía no te has unido a ninguna sala de {spaceName}. Elige una para empezar.",
    "spaceLandingPanel.nothingJoinedHereYet":
        "Todavía no te has unido a nada aquí",
    "spaceLandingPanel.onlyOtherSpacesLiveInsideOpen":
        "Dentro de {spaceName} solo hay otros espacios; abre uno desde la lista de salas para explorar sus salas.",
    "spaceLandingPanel.thereAreNoRoomsInYet":
        "Todavía no hay salas en {spaceName}.",
    "spaceLandingPanel.thisSpace": "este espacio",
    "spaceLandingPanel.couldnTJoinTryItFrom":
        "No se pudo unir a {value}. Prueba desde Explorar salas en la lista de salas.",
    "spaceLandingPanel.thatRoom": "esa sala",

    // src/lib/components/layout/SpaceSidebar.svelte
    "spaceSidebar.home": "Inicio",
    "spaceSidebar.addASpace": "Añadir un espacio",
    "spaceSidebar.exploreRooms": "Explorar salas",
    "spaceSidebar.folderColor": "Color de la carpeta",
    "spaceSidebar.createRoomInSpace": "Crear una sala en el espacio",
    "spaceSidebar.roomName": "Nombre de la sala",
    "spaceSidebar.myRoom": "mi-sala",
    "spaceSidebar.optional": "(opcional)",
    "spaceSidebar.whatSThisRoomAbout": "¿De qué trata esta sala?",
    "spaceSidebar.opensStraightIntoACallMessages":
        "Se abre directamente en una llamada. Los mensajes siguen funcionando.",
    "spaceSidebar.create": "Crear",
    "spaceSidebar.addExistingRoomToSpace":
        "Añadir una sala existente al espacio",
    "spaceSidebar.noRoomsAvailableToAdd":
        "No hay salas disponibles para añadir.",
    "spaceSidebar.spaceSettings": "Ajustes del espacio",
    "spaceSidebar.copySpaceLink": "Copiar el enlace del espacio",
    "spaceSidebar.markAsRead": "Marcar como leído",
    "spaceSidebar.createRoom": "Crear sala",
    "spaceSidebar.addExistingRoom": "Añadir una sala existente",
    "spaceSidebar.removeFromFolder": "Quitar de la carpeta",
    "spaceSidebar.newFolder": "Nueva carpeta",
    "spaceSidebar.clickAgainToLeave": "Haz clic otra vez para salir",
    "spaceSidebar.leaveSpace": "Salir del espacio",
    "spaceSidebar.setColor": "Establecer color",
    "spaceSidebar.dissolveFolder": "Deshacer la carpeta",
    "spaceSidebar.somethingWentWrong": "Algo ha salido mal",

    // src/lib/components/layout/Splash.svelte
    "splash.restoringSession": "Restaurando la sesión…",

    // src/lib/components/ui/StickerPicker.svelte
    "stickerPicker.searchStickers": "Buscar stickers…",
    "stickerPicker.searchStickers2": "Buscar stickers",
    "stickerPicker.noStickerPacksAvailable":
        "No hay paquetes de stickers disponibles",
    "stickerPicker.myStickers": "Mis stickers",
    "stickerPicker.myStickers2": "Mis stickers",

    // src/lib/components/ui/SwfEmbed.svelte
    "swfEmbed.adobeFlash": "Adobe Flash",

    // src/lib/components/settings/ThemeColorEditor.svelte
    "themeColorEditor.themeColors": "Colores del tema",
    "themeColorEditor.presetName": "Nombre del preajuste",
    "themeColorEditor.savePreset": "Guardar preajuste",
    "themeColorEditor.import": "Importar",
    "themeColorEditor.pasteThemeCode": "Pega el código del tema",
    "themeColorEditor.copyCurrentPresetToClipboard":
        "Copiar el preajuste actual al portapapeles",
    "themeColorEditor.copied": "¡Copiado!",
    "themeColorEditor.presets": "Preajustes",
    "themeColorEditor.delete": "¿Eliminar?",
    "themeColorEditor.confirmDelete": "Confirmar eliminar {name}",
    "themeColorEditor.rename": "Cambiar el nombre",
    "themeColorEditor.delete2": "Eliminar {name}",
    "themeColorEditor.builtInPresetsAreReadOnly":
        "Los preajustes integrados son de solo lectura. Duplícalo para personalizarlo:",
    "themeColorEditor.duplicateToCustomize": "Duplicar para personalizar",
    "themeColorEditor.colors": "Colores",
    "themeColorEditor.backgrounds": "Fondos",
    "themeColorEditor.resetToDefault": "Restablecer el predeterminado",
    "themeColorEditor.text": "Texto",
    "themeColorEditor.accentsSemantics": "Acentos y semántica",
    "themeColorEditor.presence": "Presencia",
    "themeColorEditor.details": "Detalles",
    "themeColorEditor.contrastWarnings": "Avisos de contraste",
    "themeColorEditor.messageDisplay": "Visualización de mensajes",
    "themeColorEditor.savedOnThisDeviceOnlyNot":
        "Guardado solo en este dispositivo. No se sincroniza con tu cuenta.",
    "themeColorEditor.appTextSize":
        "Tamaño del texto de la aplicación: {round}%",
    "themeColorEditor.scalesAllTextAndSpacingAcross":
        "Escala todo el texto y los espacios de la aplicación.",
    "themeColorEditor.font": "Fuente",
    "themeColorEditor.custom": "Personalizada - {customFontName}",
    "themeColorEditor.replaceCustomFont": "Sustituir la fuente personalizada…",
    "themeColorEditor.uploadCustomFont": "Subir una fuente personalizada…",
    "themeColorEditor.woff2TtfOrOtfUpTo":
        ".woff2, .ttf u .otf de hasta 10 MB. Se guarda solo en este dispositivo.",
    "themeColorEditor.theQuickBrownFoxJumpsOver":
        "El veloz murciélago hindú comía feliz cardillo y kiwi.",
    "themeColorEditor.cannotSavePreset": "No se puede guardar el preajuste",
    "themeColorEditor.notAValidThemeCode": "No es un código de tema válido",
    "themeColorEditor.imported": "Importado",
    "themeColorEditor.cannotImportPreset": "No se puede importar el preajuste",
    "themeColorEditor.copy": "{activePresetName} (copia)",

    // src/lib/components/layout/ThreadPanel.svelte
    "threadPanel.thread": "Hilo",
    "threadPanel.collapseThread": "Contraer el hilo",
    "threadPanel.expandThread": "Expandir el hilo",
    "threadPanel.closeThread": "Cerrar el hilo",
    "threadPanel.noRepliesYetStartTheThread":
        "Todavía no hay respuestas. Empieza el hilo abajo.",
    "threadPanel.loadOlderReplies": "Cargar respuestas anteriores",

    // src/lib/components/layout/ThreadsListPanel.svelte
    "threadsListPanel.threads": "Hilos",
    "threadsListPanel.closeThreadsPanel": "Cerrar el panel de hilos",
    "threadsListPanel.noThreadsInThisRoomYet":
        "Todavía no hay hilos en esta sala.",
    "threadsListPanel.youParticipated": "Has participado",
    "threadsListPanel.unreadMentions": "Menciones sin leer",
    "threadsListPanel.unreadReplies": "Respuestas sin leer",
    "threadsListPanel.couldnTLoadThreadsForThis":
        "No se pudieron cargar los hilos de esta sala.",
    "threadsListPanel.unknownSender": "Desconocido",
    "threadsListPanel.allThreads": "Todos los hilos",
    "threadsListPanel.myThreads": "Mis hilos",
    "threadsListPanel.filterThreads": "Filtrar hilos",
    "threadsListPanel.noThreadsYouParticipatedIn":
        "No has iniciado ni respondido a ningún hilo aquí.",

    // src/lib/components/layout/StorageBanner.svelte
    "storageBanner.outOfStorage":
        "Tu dispositivo se quedó sin almacenamiento. Zam no puede guardar mensajes ni claves de cifrado hasta que liberes espacio.",
    "storageBanner.lowStorage":
        "A tu dispositivo casi no le queda almacenamiento (quedan {free}). Libera espacio pronto o Zam no podrá guardar mensajes ni claves de cifrado.",
    "storageBanner.checkAgain": "Comprobar de nuevo",
    "storageBanner.dismissLowStorageWarning": "Cerrar aviso de almacenamiento",

    // src/lib/components/layout/UpdateBanner.svelte
    "updateBanner.dismissUpdateNotification":
        "Descartar el aviso de actualización",
    "updateBanner.installFailed": "Error en la instalación",

    // src/lib/components/ui/UserPicker.svelte
    "userPicker.remove": "Quitar a {userId}",
    "userPicker.searching": "Buscando…",
    "userPicker.noMatchingUsers": "No hay usuarios que coincidan",
    "userPicker.available":
        "{optionCount, plural, one {# resultado disponible} other {# resultados disponibles}}",
    "userPicker.invite": "Invitar a {candidateShown}",
    "userPicker.alreadyAdded": "Ya añadido",
    "userPicker.alreadyInThisRoom": "Ya está en esta sala",
    "userPicker.sendAnInviteToThisExact":
        "Enviar una invitación a este ID de usuario exacto",
    "userPicker.noMatchesTypeAFullUser":
        "No hay coincidencias. Escribe un ID de usuario completo como",
    "userPicker.userServer": "@usuario:servidor",
    "userPicker.toInviteSomeoneTheDirectoryDoesn":
        "para invitar a alguien que no aparece en el directorio.",
    "userPicker.searchForPeople": "Buscar personas…",
    "userPicker.userSearchFailedYouCanStill":
        "Error en la búsqueda de usuarios; aun así puedes escribir un ID de usuario completo.",

    // src/lib/components/ui/UserProfileCard.svelte
    "userProfileCard.copyUserId": "Copiar el ID de usuario",
    "userProfileCard.copied": "Copiado",
    "userProfileCard.localTime": "{localTime} hora local ({timezone})",
    "userProfileCard.notAMemberOfThisRoom": "No es miembro de esta sala",
    "userProfileCard.powerLevel": "Nivel de poder: {level}",
    "userProfileCard.mutualRooms": "Salas en común: {total}",
    "userProfileCard.more": "+{moreCount} más",
    "userProfileCard.sessions": "Sesiones",
    "userProfileCard.sessionsCount": "Sesiones: {total}",
    "userProfileCard.refreshSessions":
        "Pedir al servidor sus sesiones actuales",
    "userProfileCard.noKnownSessions":
        "Esta sesión no conoce ninguna de sus sesiones, así que no pueden leer tus mensajes cifrados.",
    "userProfileCard.couldNotLoadSessions":
        "No se pudieron cargar sus sesiones",
    "userProfileCard.keysChanged": "Claves cambiadas",
    "userProfileCard.keysChangedHint":
        "Una sesión marcada como Claves cambiadas tiene claves nuevas que esta sesión no pudo adoptar. Puede que tenga que cerrar sesión y volver a iniciarla.",
    "userProfileCard.opening": "Abriendo…",
    "userProfileCard.message": "Mensaje",
    "userProfileCard.verifyUser": "Verificar usuario",
    "userProfileCard.kicking": "Expulsando…",
    "userProfileCard.confirmKick": "¿Confirmar la expulsión?",
    "userProfileCard.kick": "Expulsar",
    "userProfileCard.banning": "Vetando…",
    "userProfileCard.confirmBan": "¿Confirmar el veto?",
    "userProfileCard.ban": "Vetar",
    "userProfileCard.couldNotStartVerification":
        "No se pudo iniciar la verificación",
    "userProfileCard.couldNotCopyToClipboard":
        "No se pudo copiar al portapapeles",
    "userProfileCard.couldNotOpenDm": "No se pudo abrir el MD",
    "userProfileCard.couldNotKick": "No se pudo expulsar",
    "userProfileCard.couldNotBan": "No se pudo vetar",

    // src/lib/components/layout/VerificationModal.svelte
    "verificationModal.thisSessionIsNowTrusted":
        "Esta sesión ahora es de confianza.",
    "verificationModal.theirIdentityIsNowVerified":
        "Su identidad ya está verificada.",
    "verificationModal.noTrustWasEstablishedYouCan":
        "No se estableció ninguna confianza. Puedes volver a empezar cuando quieras.",
    "verificationModal.didYourOtherSessionJustScan":
        "¿Tu otra sesión acaba de escanear este código?",
    "verificationModal.didJustScanThisCode":
        "¿{otherUserId} acaba de escanear este código?",
    "verificationModal.onlyConfirmIfYouScannedIt":
        "Confirma solo si lo acabas de escanear tú mismo.",
    "verificationModal.onlyConfirmIfYouWatchedThem":
        "Confirma solo si acabas de ver cómo lo escaneaba.",
    "verificationModal.no": "No",
    "verificationModal.yesIScannedIt": "Sí, lo he escaneado",
    "verificationModal.deviceWithThisUser": "el dispositivo de este usuario",
    "verificationModal.confirmTheSameEmojiAppearIn":
        "Confirma que aparecen los mismos emojis, en el mismo orden, en {value}.",
    "verificationModal.theyDonTMatch": "No coinciden",
    "verificationModal.confirming": "Confirmando…",
    "verificationModal.theyMatch": "Coinciden",
    "verificationModal.verificationCodeForYourOtherSession":
        "Código de verificación para tu otra sesión",
    "verificationModal.verificationCodeFor":
        "Código de verificación para {otherUserId}",
    "verificationModal.scanThisWithYourOtherSession":
        "Escanéalo con tu otra sesión.",
    "verificationModal.askThemToScanThisCode":
        "Pídele que escanee este código.",
    "verificationModal.noCodeToShowRightNow":
        "No hay ningún código que mostrar ahora mismo.",
    "verificationModal.couldNotLoadTheScanner": "No se pudo cargar el escáner.",
    "verificationModal.scanAgain": "Volver a escanear",
    "verificationModal.compareAShortListOfEmoji":
        "Compara una lista corta de emojis para verificar, o usa un código QR.",
    "verificationModal.compareEmoji": "Comparar emojis",
    "verificationModal.showACodeForTheOther":
        "Mostrar un código para que lo escanee la otra parte",
    "verificationModal.scanTheirCodeWithTheCamera":
        "Escanear su código con la cámara",
    "verificationModal.chooseADifferentMethod": "Elegir otro método",
    "verificationModal.waitingForTheOtherSideTo":
        "Esperando a que la otra parte confirme…",
    "verificationModal.verifyYourOtherSession": "Verifica tu otra sesión",
    "verificationModal.verify": "Verificar a {value}",
    "verificationModal.couldNotConfirmTheMatch":
        "No se pudo confirmar la coincidencia",
    "verificationModal.couldNotReportTheMismatch":
        "No se pudo informar de que no coinciden",
    "verificationModal.session": "tu otra sesión",

    // src/lib/components/layout/VideoTile.svelte
    "videoTile.fullscreen": "Pantalla completa",
    "videoTile.pictureInPicture": "Imagen en imagen",
    "videoTile.exitPictureInPicture": "Salir de imagen en imagen",

    // src/lib/components/settings/VoiceAudioSettings.svelte
    "voiceAudioSettings.inputDevice": "Dispositivo de entrada",
    "voiceAudioSettings.savedMicrophoneNotFoundUsingThe":
        "No se encuentra el micrófono guardado; se usa el predeterminado hasta que vuelva.",
    "voiceAudioSettings.microphoneLevel": "Nivel del micrófono",
    "voiceAudioSettings.stopTest": "Detener la prueba",
    "voiceAudioSettings.testMic": "Probar el micrófono",
    "voiceAudioSettings.outputDevice": "Dispositivo de salida",
    "voiceAudioSettings.chooseOutputDevice": "Elegir el dispositivo de salida…",
    "voiceAudioSettings.audioOutputIsRoutedByThe":
        "En esta plataforma, el sistema operativo decide por dónde sale el audio.",
    "voiceAudioSettings.testSpeaker": "Probar el altavoz",
    "voiceAudioSettings.callVolume": "Volumen de las llamadas",
    "voiceAudioSettings.incomingCallAudio": "Audio entrante de la llamada",
    "voiceAudioSettings.incomingCallAudioIfThisMoves":
        "Audio entrante de la llamada: si esto se mueve pero no oyes nada, comprueba el dispositivo de salida seleccionado y el volumen del sistema.",
    "voiceAudioSettings.voiceProcessing": "Procesamiento de voz",
    "voiceAudioSettings.noiseSuppression": "Supresión de ruido",
    "voiceAudioSettings.nsFastEnhancer": "FastEnhancer",
    "voiceAudioSettings.nsFastEnhancerHint":
        "Se ejecuta en tu dispositivo y viene incluido en la app, así que no hay nada que descargar. Pequeño y estable: mantiene tu voz a un volumen uniforme. Es el predeterminado.",
    "voiceAudioSettings.nsFastEnhancerUnsupported":
        "Este navegador no puede ejecutar FastEnhancer, así que se usa RNNoise.",
    "voiceAudioSettings.nsRnnoise": "RNNoise",
    "voiceAudioSettings.nsRnnoiseHint":
        "Se ejecuta en tu dispositivo y viene incluido en la app, así que no hay nada que descargar. Pequeño y estable: mantiene tu voz a un volumen uniforme. Es el predeterminado.",
    "voiceAudioSettings.nsRnnoiseUnsupported":
        "Este navegador no puede ejecutar RNNoise, así que se usa la supresión de ruido del propio navegador.",
    "voiceAudioSettings.nsDeepFilter": "DeepFilterNet3",
    "voiceAudioSettings.nsPluginHint":
        "Eliminación de ruido de un plugin, ejecutada en tu dispositivo. Donde no pueda ejecutarse se usa FastEnhancer.",
    "voiceAudioSettings.nsPluginUnavailable":
        "El plugin de este filtro de ruido no está activado, así que se usa FastEnhancer.",
    "voiceAudioSettings.nsPluginCantRun":
        "Este filtro de ruido no puede ejecutarse en este dispositivo, así que se usa FastEnhancer.",
    "voiceAudioSettings.nsPluginUnsupported":
        "Este navegador no puede ejecutar plugins de filtro de ruido, así que se usa la supresión de ruido del propio navegador.",
    "voiceAudioSettings.nsPluginMissing": "Filtro de plugin (no activado)",
    "voiceAudioSettings.nsBrowser": "Navegador",
    "voiceAudioSettings.nsOff": "Desactivada",
    "voiceAudioSettings.nsDeepFilterHint":
        "Eliminación de ruido con IA que se ejecuta en tu dispositivo. Descarga unos 11 MB la primera vez que la usas.",
    "voiceAudioSettings.nsDeepFilterUnsupported":
        "Este navegador no puede ejecutar DeepFilterNet3, así que se usa la supresión de ruido del propio navegador.",
    "voiceAudioSettings.nsBrowserHint":
        "La supresión de ruido integrada en tu navegador. Solo elimina el zumbido de fondo constante.",
    "voiceAudioSettings.nsOffHint":
        "Tu micrófono se envía sin eliminación de ruido.",
    "voiceAudioSettings.echoCancellation": "Cancelación de eco",
    "voiceAudioSettings.autoGainControl": "Control automático de ganancia",
    "voiceAudioSettings.agcNormalize": "Normalizar",
    "voiceAudioSettings.agcNormalizeHint":
        "La misma igualación de volumen que reciben las voces entrantes, aplicada a tu micrófono tras la supresión de ruido. No toca el volumen del micrófono del sistema.",
    "voiceAudioSettings.agcZam": "AGC2",
    "voiceAudioSettings.agcBrowser": "Navegador",
    "voiceAudioSettings.agcOff": "Desactivado",
    "voiceAudioSettings.agcZamHint":
        "El AGC2 de WebRTC, tras la supresión de ruido. Iguala tu voz sin tocar el volumen del micrófono del sistema.",
    "voiceAudioSettings.agcBrowserHint":
        "El control automático de ganancia integrado en tu navegador. Puede cambiar el volumen del micrófono del sistema.",
    "voiceAudioSettings.agcOffHint":
        "Tu micrófono se envía al nivel que le da el sistema.",
    "voiceAudioSettings.normalizeVoices": "Igualar el volumen de las voces",
    "voiceAudioSettings.normalizeVoicesHint":
        "Sube automáticamente a quien habla bajo y baja a quien habla alto, para que no tengas que ajustar el volumen de cada persona a mano.",
    "voiceAudioSettings.pushToTalk": "Pulsar para hablar",
    "voiceAudioSettings.pushToTalkHint":
        "En las llamadas tu micrófono solo transmite mientras mantienes pulsada la tecla de pulsar para hablar.",
    "voiceAudioSettings.pushToTalkNoKey":
        "Pulsar para hablar necesita una tecla para funcionar.",
    "voiceAudioSettings.pushToTalkSetKey":
        "Definir una tecla de pulsar para hablar",
    "voiceAudioSettings.camera": "Cámara",
    "voiceAudioSettings.mirrorMyCamera": "Reflejar mi cámara",
    "voiceAudioSettings.flipYourOwnPreviewOthersAlways":
        "Voltea tu propia vista previa. Los demás siempre te ven sin reflejar.",
    "voiceAudioSettings.videoCodecAuto": "Automático",
    "voiceAudioSettings.videoCodec": "Códec de vídeo",
    "voiceAudioSettings.videoCodecHint":
        "El formato en que se envían tu cámara y tu pantalla compartida. Quien en la llamada no pueda reproducirlo recibe una copia en H.264, y también puedes cambiarlo desde la llamada. Se aplica la próxima vez que las actives.",
    "voiceAudioSettings.stopPreview": "Detener la vista previa",
    "voiceAudioSettings.preview": "Vista previa",
    "voiceAudioSettings.callSounds": "Sonidos de llamada",
    "voiceAudioSettings.playCallSounds": "Reproducir sonidos de llamada",
    "voiceAudioSettings.soundVolume": "Volumen de los sonidos",
    "voiceAudioSettings.ringing": "Timbre",
    "voiceAudioSettings.ringForIncomingDmCalls":
        "Sonar con las llamadas entrantes de MD",
    "voiceAudioSettings.directMessagesRingRoomsNeverDo":
        "Los mensajes directos suenan. Las salas nunca: a esas te unes desde la propia sala.",
    "voiceAudioSettings.ringtoneVolume": "Volumen del tono de llamada",
    "voiceAudioSettings.fullScreenCalls":
        "Mostrar las llamadas en la pantalla de bloqueo",
    "voiceAudioSettings.fullScreenCallsHint":
        "Permite que una llamada entrante de MD encienda la pantalla y suene a pantalla completa, como una llamada telefónica. Android pide este permiso por separado.",
    "voiceAudioSettings.fullScreenCallsAllow": "Permitir",
    "voiceAudioSettings.microphoneUnavailableCheckBrowserPermissions":
        "Micrófono no disponible: revisa los permisos del navegador",
    "voiceAudioSettings.cameraUnavailableCheckBrowserPermissions":
        "Cámara no disponible: revisa los permisos del navegador",

    // src/lib/components/layout/VoiceCallPanel.svelte
    "voiceCallPanel.enableAudio": "Activar el audio",
    "voiceCallPanel.openCallView": "Abrir la vista de llamada",
    "voiceCallPanel.connectionStats": "Estadísticas de conexión",
    "voiceCallPanel.openCall": "Abrir llamada",
    "voiceCallPanel.openCallWithVideo":
        "Abrir llamada ({n, plural, one {# vídeo} other {# vídeos}})",
    "voiceCallPanel.sharingYourScreen": "Compartiendo tu pantalla",
    "voiceCallPanel.shareQuality": "Calidad de la pantalla compartida",
    "voiceCallPanel.stop": "Detener",
    "callStats.title": "Conexión de la llamada",
    "callStats.copyJson": "Copiar como JSON",
    "callStats.copied": "Estadísticas de la llamada copiadas",
    "callStats.copyFailed": "No se pudo copiar",
    "callStats.loading": "Midiendo...",
    "callStats.notInCall": "No estás en una llamada",
    "callStats.tcpWarning":
        "El audio va por TCP. Un paquete perdido retiene todo lo que viene detrás hasta que se reenvía, y eso se nota como audio que se retrasa o se desincroniza. Suele deberse a un cortafuegos o una red que bloquea UDP.",
    "callStats.serverSwitchedTcp":
        "El servidor de llamadas te ha pasado a TCP: ya no ofrece UDP a este dispositivo. Lo hace cuando una conexión UDP falla o se corta mientras la señalización sigue funcionando, y lo recuerda para esta llamada, así que al volver a unirte desde este dispositivo seguirás en TCP un tiempo. Puede que tu red transmita UDP sin problemas; no es lo mismo que un cortafuegos que lo bloquea.",
    "callStats.serverCandidates": "Candidatos del servidor",
    "callStats.serverCandidatesNoUdp": "Solo TCP (cambiado por el servidor)",
    "callStats.publishing": "publicando",
    "callStats.listening": "escuchando",
    "callStats.signalRtt": "Ping de señalización",
    "callStats.yourQuality": "Tu conexión",
    "callStats.sending": "Enviando",
    "callStats.receiving": "Recibiendo",
    "callStats.participant": "Participante",
    "callStats.theirQuality": "Su conexión",
    "callStats.loss": "Pérdida",
    "callStats.jitter": "Jitter",
    "callStats.buffer": "Búfer",
    "callStats.legend":
        "Su conexión es la nota que el servidor da al enlace de esa persona: una nota mala apunta a su red, no a la tuya. La pérdida y el jitter son de su audio al llegarte, en el último segundo.",
    "callStats.noTransport": "Sin conexión",
    "callStats.video": "Vídeo",
    "callStats.videoChecking": "Comprobando…",
    "callStats.videoSending": "Enviando",
    "callStats.videoNotSending": "Aún no se envía",
    "callStats.videoCaptureEnded": "La captura se detuvo: vuelve a iniciarla",
    "callStats.videoCaptureStalled":
        "No hay fotogramas nuevos: la ventana compartida puede estar minimizada o tapada, o la cámara está ocupada",
    "callStats.videoPlaying": "Reproduciendo",
    "callStats.videoNotSubscribed": "Aún no se recibe",
    "callStats.videoHiddenByYou": "Ocultado por ti",
    "callStats.videoTurnedOff": "Lo apagó la otra persona",
    "callStats.videoPausedByServer":
        "En pausa por el servidor de llamadas: tu conexión no da abasto ahora mismo",
    "callStats.videoNoPackets":
        "No llega nada: revisa el lado de quien envía, o tu conexión",
    "callStats.videoCantDecrypt":
        "Llega pero no se puede descifrar: uno de los dos puede tener un Zam antiguo, o la clave no ha llegado",
    "callStats.videoCantDecode":
        "Llega pero este dispositivo no puede decodificarlo: prueba otro códec de vídeo en el menú de calidad de pantalla compartida",
    "callStats.videoNotShown":
        "Recibido, no en pantalla: abre la vista de la llamada para verlo",
    "callStats.videoNotPainting":
        "Decodificado pero no se dibuja: cierra y vuelve a abrir la vista de la llamada",
    "callStats.capture": "Captura",
    "callStats.framesArrivedDecoded": "Fotogramas recibidos / decodificados",
    "callStats.framesEncoded": "Fotogramas codificados",
    "callStats.onScreen": "En pantalla",
    "callStats.onScreenNo": "No",
    "callStats.onScreenNoPicture": "Aún sin imagen",
    "callStats.decryptErrors": "Errores de descifrado",
    "callStats.trackState": "Pista",
    "callStats.trackNoFrames": "Sin fotogramas ahora mismo",
    "callStats.proxyRoute": "Proxy",
    "callStats.routeSignalling": "Conexión al servidor de llamadas",
    "callStats.routeSending": "Medios que envías",
    "callStats.routeReceiving": "Medios que recibes",
    "callStats.routeDirect": "Directo",
    "callStats.routeProxy": "A través de {proxy}",
    "callStats.path": "Ruta",
    "callStats.iceRtt": "Ping ICE",
    "callStats.mediaRtt": "Ping de medios",
    "callStats.upload": "Subida",
    "callStats.download": "Bajada",
    "callStats.availableUpload": "Subida disponible",
    "callStats.outgoingLoss": "Pérdida saliente",
    "callStats.remoteAddress": "Dirección del servidor",
    "callStats.candidates": "Candidatos",
    "callStats.pathUdp": "UDP (directo)",
    "callStats.pathTcp": "TCP",
    "callStats.pathRelayUdp": "Relé TURN (UDP)",
    "callStats.pathRelayTcp": "Relé TURN (TCP)",
    "callStats.pathRelayTls": "Relé TURN (TLS)",
    "callStats.pathUnknown": "Desconocida",
    "callStats.qualityExcellent": "Excelente",
    "callStats.qualityGood": "Buena",
    "callStats.qualityPoor": "Mala",
    "callStats.qualityLost": "Perdida",
    "callStats.qualityUnknown": "Desconocida",
    "callStats.streams": "Flujos de medios",
    "callStats.you": "Tú",
    "callStats.sourceMicrophone": "Micrófono",
    "callStats.sourceCamera": "Cámara",
    "callStats.sourceScreenShare": "Pantalla compartida",
    "callStats.sourceScreenShareAudio": "Audio de pantalla compartida",
    "callStats.sourceUnknown": "Otra pista",
    "callStats.sent": "enviado",
    "callStats.received": "recibido",
    "callStats.layer": "capa {rid}",
    "callStats.codec": "Códec",
    "callStats.codecOptions": "Opciones del códec",
    "callStats.bitrate": "Tasa de bits",
    "callStats.bitrateTarget": "{rate} de {target}",
    "callStats.packetDuration": "Audio por paquete",
    "callStats.resolution": "Resolución",
    "callStats.encoder": "Codificador",
    "callStats.decoder": "Decodificador",
    "callStats.hardware": "hardware",
    "callStats.software": "software",
    "callStats.limitedBy": "Limitado por",
    "callStats.limitCpu": "CPU",
    "callStats.limitBandwidth": "ancho de banda",
    "callStats.limitNone": "nada",
    "callStats.limitOther": "otro",
    "callStats.frameTime": "Tiempo por fotograma",
    "callStats.resent": "Reenviado",
    "callStats.droppedFrames": "Fotogramas perdidos",
    "callStats.nackPli": "NACK / PLI",
    "callStats.softwareEncodeHint":
        "Tu vídeo se codifica por software, lo que consume CPU y puede perder fotogramas con carga. Ajustes > Depuración muestra si la codificación de vídeo por hardware está disponible (video_encode en Estado de las funciones).",
    "callStats.cpuLimitHint":
        "El codificador de vídeo está bajando la calidad porque la CPU no da abasto.",
    "voiceCallPanel.unmute": "Activar el micrófono",
    "voiceCallPanel.undeafen": "Activar el sonido",
    "voiceCallPanel.deafen": "Ensordecer",
    "voiceCallPanel.disconnect": "Desconectar",

    // src/lib/components/messages/VoiceMessagePlayer.svelte
    "voiceMessagePlayer.seek": "Buscar posición",
    "voiceMessagePlayer.voiceMessage": "Mensaje de voz",

    // src/lib/components/messages/VoiceRecorder.svelte
    "voiceRecorder.cancelRecording": "Cancelar la grabación",
    "voiceRecorder.stop": "Detener",
    "voiceRecorder.discard": "Descartar",
    "voiceRecorder.discardRecording": "Descartar la grabación",
    "voiceRecorder.voiceMessage": "Mensaje de voz",
    "voiceRecorder.sending": "Enviando…",
    "voiceRecorder.send": "Enviar",
    "voiceRecorder.microphoneAccessWasDenied":
        "Se denegó el acceso al micrófono.",
    "voiceRecorder.recordingFailed": "Error en la grabación.",
    "voiceRecorder.nothingWasRecorded": "No se grabó nada.",
    "voiceRecorder.failedToSendVoiceMessage":
        "No se pudo enviar el mensaje de voz",

    // src/lib/components/settings/WhatsNew.svelte
    "whatsNew.whatSNew": "Novedades",
    "whatsNew.loadingReleaseNotes": "Cargando las notas de la versión…",
    "whatsNew.releaseNotesUnavailable":
        "Las notas de la versión no están disponibles.",
    "whatsNew.viewOnGithub": "Ver en GitHub",

    // src/lib/components/layout/WhatsNewModal.svelte
    "whatsNewModal.whatSNew": "Novedades",
    "whatsNewModal.whatSNewSince": "Novedades desde la v{from}",
    "whatsNewModal.whatSNewInV": "Novedades de la v{APP_VERSION}",
    "whatsNewModal.releaseNotesUnavailable":
        "Las notas de la versión no están disponibles.",
    "whatsNewModal.viewOnGithub": "Ver en GitHub",
    "whatsNewModal.gotIt": "Entendido",

    // src/lib/components/layout/VerificationRequestCard.svelte
    "verificationRequestCard.verifyYourOtherSession": "Verifica tu otra sesión",
    "verificationRequestCard.verificationRequest": "Solicitud de verificación",
    "verificationRequestCard.anotherOfYourSessions": "Otra de tus sesiones",

    // src/lib/components/messages/CallEventCard.svelte
    "callEventCard.missedCall": "Llamada perdida",
    "callEventCard.ongoingCall": "Llamada en curso",
    "callEventCard.callEnded": "Llamada finalizada",

    // src/lib/components/messages/ComposerActionsMenu.svelte
    "composerActionsMenu.uploadAFile": "Subir un archivo",
    "composerActionsMenu.createPoll": "Crear encuesta",
    "composerActionsMenu.recordVoiceMessage": "Grabar un mensaje de voz",
    "composerActionsMenu.shareLocation": "Compartir ubicación",
    "composerActionsMenu.createThread": "Crear hilo",

    // src/lib/components/messages/Reactions.svelte
    "reactions.couldNotAddReaction": "No se pudo añadir la reacción",

    // src/lib/components/ui/QrScanner.svelte
    "qrScanner.startingTheCamera": "Iniciando la cámara…",
    "qrScanner.cameraAccessWasDenied": "Se denegó el acceso a la cámara.",
    "qrScanner.noCameraWasFoundOnThis":
        "No se encontró ninguna cámara en este dispositivo.",
    "qrScanner.theCameraIsAlreadyInUse":
        "Otra aplicación ya está usando la cámara.",
    "qrScanner.couldNotOpenTheCameraA":
        "No se pudo abrir la cámara. Se necesita una conexión segura (https).",
    "qrScanner.codeFoundCheckingIt": "Código encontrado; comprobándolo…",
    "qrScanner.couldNotStartVerificationWithThat":
        "No se pudo iniciar la verificación con ese código.",
    "qrScanner.thatIsnTAVerificationCode":
        "Eso no es un código de verificación.",
    "qrScanner.thisDeviceHasNoCameraAvailable":
        "Este dispositivo no tiene ninguna cámara disponible.",
    "qrScanner.couldNotStartTheCameraPreview":
        "No se pudo iniciar la vista previa de la cámara.",
    "qrScanner.pointTheCameraAtTheirCode": "Apunta la cámara a su código.",

    // src/lib/desktopContextMenu.ts
    "desktopContextMenu.failedToSaveImage": "No se pudo guardar la imagen",

    // src/lib/matrix/client.ts
    "client.serverAutoDiscoveryFailedUsingThe":
        "Falló la detección automática del servidor; se usa la dirección tal como se escribió",
    "client.discoveredHomeserverFailedValidation":
        "El servidor base detectado no superó la validación",
    "client.thisHomeserverDoesnTSupportSliding":
        "Este servidor base no admite la sincronización deslizante, así que se usa la sincronización clásica.",
    "client.notLoggedIn": "No has iniciado sesión",
    "client.oauthProviderChanged":
        "El proveedor de inicio de sesión del servidor ha cambiado. Inténtalo de nuevo.",
    "client.thisEventTypeCannotBeForwarded":
        "Este tipo de evento no se puede reenviar",
    "client.notConnected": "Sin conexión",
    "client.thisServerDoesNotAllowSigning":
        "Este servidor no permite cerrar sesiones con una contraseña; usa su página de cuenta.",
    "client.incorrectPassword": "Contraseña incorrecta",
    "client.thisServerDoesNotAllowConfirming":
        "Este servidor no permite confirmar esta acción con una contraseña; usa su página de cuenta.",
    "client.directMessages": "Mensajes directos",
    "client.messagesInDirectMessageRooms":
        "Mensajes en salas de mensajes directos",
    "client.rooms": "Salas",
    "client.messagesInAllOtherRooms": "Mensajes en todas las demás salas",
    "client.fullMatrixIdMentions": "Menciones del ID de Matrix completo",
    "client.messagesUsingYourFullUserHomeserver":
        "Mensajes que usan tu ID completo @usuario:servidor",
    "client.displayNameMentions": "Menciones del nombre visible",
    "client.messagesContainingYourDisplayName":
        "Mensajes que contienen tu nombre visible",
    "client.usernameMentions": "Menciones del nombre de usuario",
    "client.messagesContainingYourUsernameWithoutServer":
        "Mensajes que contienen tu nombre de usuario (sin servidor)",
    "client.roomMentions": "Menciones de @room",
    "client.messagesUsingRoomToNotifyEveryone":
        "Mensajes que usan @room para avisar a todos",
    "client.invitations": "Invitaciones",
    "client.whenYouAreInvitedToA": "Cuando te invitan a una sala",
    "client.thisRoom": "esta sala",
    "client.keywordCannotStartWith":
        "La palabra clave no puede empezar por '.'",
    "client.emotes": "Emotes de {value}",
    "client.room": "Sala",
    "client.emojis": "Emojis",
    "client.enterAShortcode": "Escribe un código corto.",
    "client.useOnlyLettersNumbersDotsUnderscores":
        "Usa solo letras, números, puntos, guiones bajos, signos más y guiones.",
    "client.chooseAtLeastOneUsage": "Elige al menos un uso.",
    "client.imageNotFound": "No se encontró la imagen.",
    "client.noPermissionToEditPack":
        "No tienes permiso para editar este paquete.",
    "client.invalidPowerLevels": "Niveles de poder no válidos: {shapeError}",
    "client.roomCreatorsPowerLevelCannotBe":
        "En las salas v12 no se puede establecer el nivel de poder de los creadores de la sala",
    "client.restrictedJoinRequiresAtLeastOne":
        "El acceso restringido requiere al menos un espacio superior",
    "client.orderMustBeAtMost50":
        "El orden debe tener como máximo 50 caracteres ASCII imprimibles (del espacio a ~)",
    "client.cannotSetSuggestedOnASpace":
        "No se puede marcar como sugerido un elemento del espacio sin via",
    "client.pollHasNoEventId": "La encuesta no tiene ID de evento",
    "client.unsupportedPoll": "Encuesta no compatible",
    "client.youCanTCloseThisPoll": "No puedes cerrar esta encuesta",
    "client.microphoneDisconnectedSwitchedToTheDefault":
        "Micrófono desconectado; se ha cambiado al dispositivo predeterminado",
    "client.cameraDisconnected": "Cámara desconectada",
    "client.unknownRoom": "Sala desconocida",
    "client.theServerRejectedItYouMay":
        "el servidor lo rechazó; puede que no tengas permiso para unirte a llamadas en esta sala",
    "client.callMembershipFailed": "Error al unirse a la llamada: {detail}",
    "client.voiceServerRejectedTheJoin":
        "El servidor de voz rechazó la conexión ({status})",
    "client.voiceCallDisconnected": "Llamada de voz desconectada",
    "client.couldNotReachCallServer":
        "No se pudo conectar con {server}, así que puede que no oigas a algunas personas en esta llamada.",
    "client.yourMicrophoneAppearsSilentCheckYour":
        "Tu micrófono parece estar en silencio; revisa tu dispositivo de entrada",
    "client.audioDeviceError": "Error del dispositivo de audio: {message}",
    "client.couldnTSwitchToThatKept":
        "No se pudo cambiar de {what}; se mantiene el anterior",
    "client.couldnTSwitchToThatUsing":
        "No se pudo cambiar de {what}; se usa el dispositivo predeterminado",
    "client.couldnTSwitchToThatPick":
        "No se pudo cambiar de {what}; elige otro dispositivo",
    "client.encryptedCallsUnsupported":
        "Esta llamada está cifrada de extremo a extremo y este navegador no puede cifrar el audio y el vídeo. Prueba con un Chrome, Firefox o Safari reciente, o con la aplicación de escritorio.",
    "client.couldNotSwitchVideoCodec": "No se pudo cambiar el códec de vídeo",
    "client.couldNotStartScreenShare":
        "No se pudo empezar a compartir la pantalla",
    "client.couldNotShareScreenAudio": "La pantalla se comparte sin audio",
    "client.couldnTChangeScreenShareQuality":
        "No se pudo cambiar la calidad de la pantalla compartida",
    "client.couldNotStartTheCameraCheck":
        "No se pudo iniciar la cámara; revisa los permisos",
    "client.couldnTApplyAudioProcessingChange":
        "No se pudo aplicar el cambio en el procesamiento de audio ({error})",
    "client.deviceNounMicrophone": "micrófono",
    "client.deviceNounCamera": "cámara",

    // src/lib/matrix/crypto.ts
    "crypto.couldNotStartTheEmojiCheck":
        "No se pudo iniciar la comprobación de emojis",
    "crypto.couldNotCancelTheVerification":
        "No se pudo cancelar la verificación",
    "crypto.noCodeAvailableTheOtherSide":
        "No hay ningún código disponible: la otra parte no puede escanearlo.",
    "crypto.couldNotGenerateAQrCode": "No se pudo generar un código QR",
    "crypto.thatCodeDoesnTMatchThis":
        "Ese código no corresponde a esta verificación",
    "crypto.couldNotConfirmTheQrMatch":
        "No se pudo confirmar la coincidencia del QR",
    "crypto.couldNotCancelTheQrMatch":
        "No se pudo cancelar la coincidencia del QR",
    "crypto.encryptionIsNotReadyOnThis":
        "El cifrado no está listo en esta sesión",
    "crypto.roomIsNotEncrypted": "Esta sala no está cifrada.",
    "crypto.roomKeyDiscarded":
        "Tu próximo mensaje aquí usará una nueva clave de sala, compartida de nuevo con todas las sesiones de la sala.",
    "crypto.encryptionDataLost":
        "Se perdieron los datos de cifrado de esta sesión (datos del navegador borrados o reinstalación), así que se cerró para que nadie siga cifrando para claves que ya no tiene. Vuelve a iniciar sesión.",
    "crypto.accountApprovalCancelled":
        "Se canceló la aprobación en tu página de cuenta.",
    "crypto.accountPasswordRequired":
        "Este servidor necesita la contraseña de tu cuenta para confirmarlo.",
    "crypto.thisServerCanTConfirmEncryption":
        "Este servidor no puede confirmar la configuración del cifrado con una contraseña; usa su página de cuenta.",
    "crypto.incorrectPassword": "Contraseña incorrecta",
    "crypto.failedToGenerateARecoveryKey":
        "No se pudo generar una clave de recuperación",
    "crypto.yourOldRecoveryWasResetBut":
        "Tu recuperación anterior se restableció, pero no se pudo configurar la nueva.",
    "crypto.thatKeyDoesnTMatchThis":
        "Esa clave no coincide con la copia de seguridad de esta cuenta en el servidor.",
    "crypto.thatDoesnTLookLikeA":
        "Eso no parece una clave de recuperación válida. Revisa si hay errores y vuelve a intentarlo.",
    "crypto.thisAccountHasNoRecoverySet":
        "Esta cuenta todavía no tiene la recuperación configurada. Configúrala primero en una sesión que tenga tus claves.",
    "crypto.thatRecoveryKeyDoesnTMatch":
        "Esa clave de recuperación no corresponde a esta cuenta. Revisa si hay errores y vuelve a intentarlo.",
    "crypto.thisAccountSRecoveryWasnT":
        "La recuperación de esta cuenta no se configuró con una frase de contraseña. Usa tu clave de recuperación.",
    "crypto.couldnTUseYourPassphraseOn":
        "No se pudo usar tu frase de contraseña en este dispositivo. Prueba con tu clave de recuperación.",
    "crypto.thatPassphraseDoesnTMatchThis":
        "Esa frase de contraseña no corresponde a esta cuenta. Revisa si hay errores y vuelve a intentarlo.",

    // src/lib/matrix/media.ts
    "media.notLoggedIn": "No has iniciado sesión",
    "media.failedToFetchAttachment": "No se pudo obtener el adjunto: {status}",
    "media.encryptedAttachmentHasAnInvalidUrl":
        "El adjunto cifrado tiene una URL no válida",
    "media.failedToFetchEncryptedAttachment":
        "No se pudo obtener el adjunto cifrado: {status}",

    // src/lib/matrix/pluginHost.ts
    "pluginHost.mediaWasUploadedByADifferent":
        "El contenido lo subió otra cuenta",
    "pluginHost.notLoggedIn": "No has iniciado sesión",
    "pluginHost.notConnected": "Sin conexión",

    // src/lib/matrix/runtime.ts
    "runtime.notLoggedIn": "No has iniciado sesión",

    // src/lib/plugins/builtins/double-tap-reply/index.ts
    "doubleTapReply.doubleTapSwipeActions":
        "Acciones con doble toque y deslizamiento",
    "doubleTapReply.doubleTapAMessageToReply":
        "Toca dos veces un mensaje para responder, reaccionar o editar, o deslízalo a la izquierda para responder / editar.",
    "doubleTapReply.doubleTapYourMessages": "Doble toque en tus mensajes",
    "doubleTapReply.nothing": "Nada",
    "doubleTapReply.reaction": "Reacción",
    "doubleTapReply.reply": "Responder",
    "doubleTapReply.edit": "Editar",
    "doubleTapReply.doubleTapOtherMessages": "Doble toque en otros mensajes",
    "doubleTapReply.reactionEmoji": "Emoji de reacción",
    "doubleTapReply.sentWhenADoubleTapAction":
        "Se envía cuando una acción de doble toque está configurada como Reacción.",
    "doubleTapReply.swipeToReplyEdit": "Deslizar para responder / editar",
    "doubleTapReply.swipeAMessageLeftToReply":
        "Desliza un mensaje a la izquierda para responder; desliza más los tuyos para editarlos.",
    "doubleTapReply.failedToReact": "No se pudo reaccionar",

    // src/lib/plugins/builtins/slash-fun/index.ts
    "slashFun.sendAnActionMessage": "Enviar un mensaje de acción",
    "slashFun.appendToYourMessage": "Añadir ¯\\_(ツ)_/¯ a tu mensaje",
    "slashFun.appendToYourMessage2": "Añadir (╯°□°)╯︵ ┻━┻ a tu mensaje",
    "slashFun.appendToYourMessage3": "Añadir ┬─┬ ノ( ゜-゜ノ) a tu mensaje",
    "slashFun.appendToYourMessage4": "Añadir ( ͡° ͜ʖ ͡°) a tu mensaje",
    "slashFun.sendYourMessageAsASpoiler": "Enviar tu mensaje como spoiler",
    "slashFun.sendYourMessageWithoutMarkdownFormatting":
        "Enviar tu mensaje sin formato markdown",
    "slashFun.funSlashCommands": "Comandos de barra divertidos",
    "slashFun.noveltySlashCommandsMeShrugTableflip":
        "Comandos de barra curiosos: /me, /shrug, /tableflip, /unflip, /lenny, /spoiler, /plain.",

    // src/lib/plugins/builtins/text-replacer/index.ts
    "textReplacer.textReplacer": "Sustitución de texto",
    "textReplacer.applyYourOwnStringOrRegex":
        "Aplica tus propias sustituciones de texto o de expresiones regulares al texto de los mensajes que envías.",
    "textReplacer.replacementRules": "Reglas de sustitución",
    "textReplacer.appliedToYourOutgoingMessageText":
        "Se aplican en orden al texto de los mensajes que envías. Los destinatarios ven texto normal.",
    "textReplacer.find": "Buscar",
    "textReplacer.textOrPattern": "texto o patrón",
    "textReplacer.replaceWith": "Sustituir por",
    "textReplacer.regex": "Expresión regular",
    "textReplacer.ignoreCase": "Ignorar mayúsculas y minúsculas",
    "previewRewriter.name": "Reescritura de vistas previas de enlaces",
    "previewRewriter.description":
        "Obtiene las vistas previas de enlaces desde otra dirección, p. ej. un espejo de un sitio al que tu servidor base no llega.",
    "previewRewriter.rules": "Reglas de reescritura",
    "previewRewriter.rulesDescription":
        "Se aplican en orden a la dirección desde la que se obtiene una vista previa. El enlace en sí no cambia.",

    // src/lib/plugins/pluginBoot.ts
    "pluginBoot.noPluginSyncDataOnYour":
        "Todavía no hay datos de sincronización de plugins en tu cuenta.",
    "pluginBoot.theSyncDataOnYourAccount":
        "Los datos de sincronización de tu cuenta están mal formados.",
    "pluginBoot.autoUpdateFailed":
        "Error en la actualización automática: {value}",

    // src/lib/plugins/pluginPin.ts
    "pluginPin.pluginIdMismatchIndexListsManifest":
        'El ID del plugin no coincide: el índice indica "{entryId}" y el manifiesto declara "{manifestId}"',
    "pluginPin.cannotInstallPluginWithIdIt":
        'No se puede instalar el plugin con ID "{manifestId}": es un plugin integrado',
    "pluginPin.pluginIsAlreadyInstalledFromA":
        'El plugin "{manifestId}" ya está instalado desde otro repositorio',

    // src/lib/plugins/repo.ts
    "repo.repoReferenceMustBeAString":
        "La referencia del repositorio debe ser una cadena",
    "repo.repoReferenceCannotBeEmpty":
        "La referencia del repositorio no puede estar vacía",
    "repo.branchCannotBeEmpty": "La rama no puede estar vacía",
    "repo.branchCannotContain": "La rama no puede contener '..'",
    "repo.invalidRepoReferenceExtraPathSegments":
        "Referencia de repositorio no válida: segmentos de ruta adicionales (no /tree/<rama>)",
    "repo.invalidRepoReferenceMustBeOwner":
        "Referencia de repositorio no válida: debe ser propietario/repositorio",
    "repo.ownerCannotBeEmpty": "El propietario no puede estar vacío",
    "repo.invalidOwnerMustMatchAZa":
        "Propietario no válido: debe coincidir con [A-Za-z0-9][A-Za-z0-9._-]*",
    "repo.repoCannotBeEmpty": "El repositorio no puede estar vacío",
    "repo.invalidRepoMustMatchAZa":
        "Repositorio no válido: debe coincidir con [A-Za-z0-9][A-Za-z0-9._-]*",

    // src/lib/plugins/repoList.ts
    "repoList.enterARepoOwnerRepoOr":
        "Escribe un repositorio (propietario/repositorio o una URL de GitHub).",
    "repoList.thatIsTheOfficialRepoAlready":
        "Ese es el repositorio oficial (ya está incluido).",
    "repoList.thatRepoIsAlreadyAdded": "Ese repositorio ya está añadido.",

    // src/lib/stores/gifSearch.svelte.ts
    "gifSearch.couldnTReachKlipyTryAgain":
        "No se pudo conectar con KLIPY; inténtalo de nuevo.",

    // src/lib/stores/liveLocation.svelte.ts
    "liveLocation.youCanTShareLiveLocation":
        "No puedes compartir tu ubicación en tiempo real en esta sala.",
    "liveLocation.couldnTStartLiveLocation":
        "No se pudo iniciar la ubicación en tiempo real",
    "liveLocation.expired": "Caducada",
    "liveLocation.lessThanAMinuteLeft": "queda menos de un minuto",
    "liveLocation.minLeft": "quedan {totalMin} min",
    "liveLocation.hLeft": "quedan {h} h",
    "liveLocation.hMinLeft": "quedan {h} h {m} min",
    "liveLocation.justNow": "ahora mismo",
    "liveLocation.sAgo": "hace {floor} s",
    "liveLocation.minAgo": "hace {floor} min",
    "liveLocation.hAgo": "hace {floor} h",
    "liveLocation.n15Minutes": "15 minutos",
    "liveLocation.n1Hour": "1 hora",
    "liveLocation.n8Hours": "8 horas",

    // src/lib/stores/outbox.svelte.ts
    "outbox.failedToSend": "No se pudo enviar",

    // src/lib/stores/settings.svelte.ts
    "settings.couldNotReadThatFile": "No se pudo leer ese archivo.",
    "settings.thatFileIsnTAValid": "Ese archivo no es una fuente válida.",
    "settings.fontCouldnTBeSavedOn":
        "No se pudo guardar la fuente en este dispositivo.",
    "settings.cannotSaveAPresetWithBuilt":
        "No se puede guardar un preajuste con un nombre integrado: {name}",

    // src/lib/stores/shareInbox.svelte.ts
    "shareInbox.youReOfflineTheShareWas":
        "No tienes conexión: el contenido compartido se ha añadido al editor",
    "shareInbox.couldnTSendTheShare":
        "No se pudo enviar el contenido compartido",

    // src/lib/stores/verification.svelte.ts
    "verification.finishingAnotherVerificationFirstTryAgain":
        "Primero se está terminando otra verificación. Inténtalo de nuevo.",
    "verification.waitingForTheOtherSideTo":
        "Esperando a que la otra parte acepte…",
    "verification.acceptedSettingUpTheCheck":
        "Aceptada; preparando la comprobación…",
    "verification.verifying": "Verificando…",
    "verification.sessionVerified": "Sesión verificada",
    "verification.userVerified": "Usuario verificado",
    "verification.verificationCancelled": "Verificación cancelada",
    "verification.verified": "Verificado",
    "verification.unverified": "Sin verificar",
    "verification.signedByYou": "Firmado por ti",
    "verification.notSignedByOwner": "No firmado por su dueño",
    "verification.verifyWithAnotherDevice": "Verificar con otro dispositivo",
    "verification.useAnotherDevice": "Usar otro dispositivo",
    "verification.couldNotSendVerificationRequest":
        "No se pudo enviar la solicitud de verificación",
    "verification.sessionNotKnownYet":
        "Esta sesión aún no conoce esa sesión. Espera unos segundos y vuelve a intentarlo, o inicia la verificación desde la sesión nueva.",
    "verification.accountHasNoIdentity":
        "Las claves de firma cruzada de tu cuenta no están en el servidor, así que tus otras sesiones no pueden verificar esta. Abre Ajustes > Seguridad y cifrado en la sesión donde configuraste la recuperación: si ofrece subir tus claves, hazlo. Si nunca configuraste la recuperación, configúrala en cualquier sesión.",
    "verification.sessionHasNoKeys":
        "Esa sesión no ha publicado sus claves de cifrado, así que no se puede verificar ni recibir mensajes cifrados. Cierra la sesión y vuelve a iniciarla.",
    "verification.sessionKeysRejected":
        "Esta sesión rechazó las claves de cifrado de esa sesión. Cierra la sesión y vuelve a iniciarla.",
    "verification.identityChanged": "La identidad ha cambiado",
    "verification.couldnTAcceptThisRequestTry":
        "No se pudo aceptar esta solicitud. Inténtalo de nuevo.",

    // src/lib/stores/voiceCall.svelte.ts
    "voiceCall.couldnTLoadTheCallComponent":
        "No se pudo cargar el componente de llamada. Comprueba tu conexión y recarga la página para volver a intentarlo.",
    "voiceCall.couldNotJoinTheVoiceCall": "No se pudo unir a la llamada de voz",
    "voiceCall.couldNotMuteYourMicrophone": "No se pudo silenciar tu micrófono",
    "voiceCall.couldNotUnmuteYourMicrophoneCheck":
        "No se pudo activar tu micrófono; revisa tu dispositivo de entrada",
    "voiceCall.connecting": "Conectando…",
    "voiceCall.startedSharing": "{name} está compartiendo su pantalla",
    "voiceCall.watch": "Ver",
    "voiceCall.voiceConnected": "Voz conectada",
    "voiceCall.reconnecting": "Reconectando…",
    "voiceCall.gpuGivenUp":
        "Los gráficos siguieron fallando, así que la GPU está desactivada hasta que reinicies Zam y el vídeo se codifica por software.",
    "voiceCall.gpuRecovered":
        "Los gráficos se reiniciaron, así que la llamada se volvió a conectar para seguir codificando el vídeo en la GPU.",
    "voiceCall.gpuRecoveryFailed":
        "Los gráficos fallaron otra vez justo después de recuperarse, así que el vídeo se codifica por software. Recarga para volver a usar la GPU.",
    "voiceCall.restartZam": "Reiniciar Zam",
    "voiceCall.reload": "Recargar",
    "voiceCall.youWereBannedFromThisRoom":
        "Te han vetado en esta sala; la llamada ha terminado",
    "voiceCall.youLeftThisRoomCallEnded":
        "Has salido de esta sala; la llamada ha terminado",
    "voiceCall.youWereRemovedFromThisRoom":
        "Te han quitado de esta sala; la llamada ha terminado",

    // src/lib/update.ts
    "update.noReleasesFoundYet": "Todavía no se han encontrado versiones.",
    "update.githubApiError": "Error de la API de GitHub ({status}).",
    "update.couldNotReadTheLatestVersion": "No se pudo leer la última versión.",

    // src/lib/utils/accountSecurity.ts
    "accountSecurity.enterYourCurrentPassword": "Escribe tu contraseña actual.",
    "accountSecurity.enterANewPassword": "Escribe una contraseña nueva.",
    "accountSecurity.newPasswordMustBeAtLeast":
        "La nueva contraseña debe tener al menos 8 caracteres.",
    "accountSecurity.newPasswordMustBeDifferentFrom":
        "La nueva contraseña debe ser distinta de la actual.",
    "accountSecurity.passwordsDoNotMatch": "Las contraseñas no coinciden.",

    // src/lib/utils/activeSession.ts
    "activeSession.offAlwaysNotify": "Desactivado: notificar siempre",
    "activeSession.n15Seconds": "15 segundos",
    "activeSession.n30Seconds": "30 segundos",
    "activeSession.n1Minute": "1 minuto",
    "activeSession.n2Minutes": "2 minutos",
    "activeSession.n5Minutes": "5 minutos",
    "activeSession.n10Minutes": "10 minutos",
    "activeSession.n30Minutes": "30 minutos",
    "activeSession.enterANumberOfMinutes": "Escribe un número de minutos.",
    "activeSession.chooseAtLeast1MinuteUse":
        "Elige al menos 1 minuto; usa la lista de arriba para tiempos más cortos.",
    "activeSession.chooseMinutes2HoursOrLess":
        "Elige {MAX_CUSTOM_GRACE_MINUTES} minutos (2 horas) o menos.",

    // src/lib/utils/audioDevices.ts
    "audioDevices.microphone": "Micrófono",
    "audioDevices.speaker": "Altavoz",
    "audioDevices.camera": "Cámara",

    // src/lib/utils/audioPlayback.ts
    "audioPlayback.failedToLoadRetry": "No se pudo cargar · Reintentar",
    "audioPlayback.clickToPlay": "Haz clic para reproducir",

    // src/lib/utils/clientGeneration.ts
    "clientGeneration.sessionChangedBeforeTheOperationFinished":
        "La sesión cambió antes de que terminara la operación",

    // src/lib/utils/customFont.ts
    "customFont.useAWoff2TtfOrOtf":
        "Usa un archivo de fuente .woff2, .ttf u .otf.",
    "customFont.thatFontFileIsEmpty": "Ese archivo de fuente está vacío.",
    "customFont.fontFileIsTooLargeMax":
        "El archivo de fuente es demasiado grande (máx. 10 MB).",
    "customFont.customFont": "Fuente personalizada",

    // src/lib/utils/deviceSessions.ts
    "deviceSessions.unknown": "Desconocido",
    "deviceSessions.justNow": "Ahora mismo",
    "deviceSessions.desktopApp": "Aplicación de escritorio",
    "deviceSessions.on": "{client} en {os}",
    "deviceSessions.minutesAgo":
        "{count, plural, one {hace # minuto} other {hace # minutos}}",
    "deviceSessions.hoursAgo":
        "{count, plural, one {hace # hora} other {hace # horas}}",
    "deviceSessions.daysAgo":
        "{count, plural, one {hace # día} other {hace # días}}",

    // src/lib/utils/displaySources.ts
    "displaySources.screen": "Pantalla",
    "displaySources.untitledWindow": "Ventana sin título",

    // src/lib/utils/encryptionState.ts
    "encryptionState.unableToDecryptYouMayNot":
        "No se puede descifrar; puede que no tengas las claves de este mensaje.",
    "encryptionState.theSenderChoseNotToShare":
        "El remitente decidió no compartir las claves de este mensaje.",
    "encryptionState.theSenderDidNotShareThe":
        "El remitente no compartió las claves porque este dispositivo no está verificado. Verifica este dispositivo para leer mensajes como este.",
    "encryptionState.senderDeviceNotCrossSigned":
        "El dispositivo del remitente no tiene la firma cruzada de su propietario, así que este mensaje está oculto. Pídele que verifique esa sesión.",
    "encryptionState.senderDeviceUnknown":
        "Este mensaje no se puede vincular a ningún dispositivo conocido del remitente, así que está oculto.",
    "encryptionState.senderIdentityChanged":
        "La identidad del remitente ha cambiado desde que lo verificaste, así que este mensaje está oculto. Vuelve a verificarlo para leerlo.",
    "encryptionState.historicalNoBackup":
        "Este mensaje se envió antes de que este dispositivo iniciara sesión y no hay ninguna copia de seguridad de claves desde la que restaurarlo.",
    "encryptionState.historicalBackupUnconfigured":
        "Este mensaje se envió antes de que este dispositivo iniciara sesión. Introduce tu clave de recuperación para restaurarlo desde la copia de seguridad de claves.",
    "encryptionState.historicalWorkingBackup":
        "Este mensaje se envió antes de que este dispositivo iniciara sesión y no se ha encontrado en tu copia de seguridad de claves.",
    "encryptionState.historicalNotJoined":
        "Este mensaje se envió mientras no estabas en la sala.",
    "encryptionState.encryptedMessage": "🔒 Mensaje cifrado",

    // src/lib/utils/eventShield.ts
    "eventShield.thisMessageSEncryptionCouldNot":
        "No se pudo verificar por completo el cifrado de este mensaje.",
    "eventShield.encryptedByAnUnverifiedUser":
        "Cifrado por un usuario sin verificar.",
    "eventShield.encryptedByADeviceNotVerified":
        "Cifrado por un dispositivo que su propietario no ha verificado.",
    "eventShield.encryptedByAnUnknownOrDeleted":
        "Cifrado por un dispositivo desconocido o eliminado.",
    "eventShield.theAuthenticityOfThisEncryptedMessage":
        "No se puede garantizar la autenticidad de este mensaje cifrado en este dispositivo.",
    "eventShield.theSenderWasPreviouslyVerifiedBut":
        "El remitente estaba verificado, pero ha cambiado su identidad.",
    "eventShield.theSenderDoesnTMatchThe":
        "El remitente no coincide con el propietario del dispositivo que envió este mensaje.",

    // src/lib/utils/extendedProfile.ts
    "extendedProfile.aStatusNeedsBothAnEmoji":
        "Un estado necesita tanto un emoji como algo de texto.",
    "extendedProfile.inACall": "En una llamada",
    "extendedProfile.inACallForMin": "En una llamada desde hace {minutes} min",
    "extendedProfile.inACallForH": "En una llamada desde hace {hours} h",
    "extendedProfile.other": "Otro",
    "extendedProfile.atMostLinks": "Como máximo {MAX_CONNECTIONS} enlaces.",
    "extendedProfile.linksMustBeHttpHttpsMailto":
        "Los enlaces deben ser direcciones http, https, mailto o matrix.",
    "extendedProfile.inACallForHMin":
        "En una llamada desde hace {hours} h {minutes} min",

    // src/lib/utils/geoErrors.ts
    "geoErrors.locationNeedsASecureHttpsConnection":
        "La ubicación necesita una conexión segura (HTTPS): abre la aplicación por https.",
    "geoErrors.locationPermissionWasDeniedCheckSite":
        "Se denegó el permiso de ubicación: revisa los permisos del sitio.",
    "geoErrors.yourPositionIsUnavailableLocationOff":
        "Tu posición no está disponible (ubicación desactivada o sin señal GPS).",
    "geoErrors.timedOutGettingYourLocation":
        "Se agotó el tiempo al obtener tu ubicación.",
    "geoErrors.couldnTGetYourLocation": "No se pudo obtener tu ubicación.",
    "geoErrors.locationIsnTAvailableInThis":
        "La ubicación no está disponible en este navegador.",

    // src/lib/utils/joinRules.ts
    "joinRules.onlyAvailableForRoomsInsideA":
        "Solo disponible para salas dentro de un espacio",
    "joinRules.thisRoomSVersionDoesnT":
        "La versión de esta sala no admite el acceso restringido a un espacio",

    // src/lib/utils/keyBackup.ts
    "keyBackup.preparing": "Preparando…",
    "keyBackup.fetchingYourEncryptedHistory":
        "Obteniendo tu historial cifrado…",
    "keyBackup.restoringYourEncryptedHistory":
        "Restaurando tu historial cifrado…",
    "keyBackup.restoringOfKeys": "Restaurando {successes} de {total} claves…",
    "keyBackup.noEncryptedHistoryToRestore":
        "No hay historial cifrado que restaurar",
    "keyBackup.restored":
        "{count, plural, one {# clave restaurada} other {# claves restauradas}}",
    "keyBackup.ofKeysRestored": "{imported} de {total} claves restauradas",
    "keyBackup.notSetUp": "Sin configurar",
    "keyBackup.notTrusted": "No es de confianza",
    "keyBackup.notConnected": "Sin conexión",
    "keyBackup.on": "Activada",
    "keyBackup.encryptedMessageHistoryIsnTBeing":
        "No se está haciendo copia de seguridad del historial de mensajes cifrados. Configura la recuperación para protegerlo.",
    "keyBackup.aBackupExistsOnTheServer":
        "Hay una copia de seguridad en el servidor, pero esta sesión todavía no confía en ella.",
    "keyBackup.aBackupExistsButThisSession":
        "Hay una copia de seguridad, pero esta sesión no está conectada a ella. Introduce tu clave de recuperación para restaurar tu historial.",
    "keyBackup.messageHistoryIsBeingBackedUp":
        "Se está haciendo copia de seguridad del historial de mensajes (v{version}).",
    "keyBackup.messageHistoryIsBeingBackedUp2":
        "Se está haciendo copia de seguridad del historial de mensajes.",
    "keyBackup.noKeysBackedUpYet":
        "Todavía no hay claves en la copia de seguridad",
    "keyBackup.backedUp":
        "{count, plural, one {# clave en la copia de seguridad} other {# claves en la copia de seguridad}}",
    "keyBackup.stillToUpload":
        "{count, plural, one {Falta subir # clave} other {Faltan subir # claves}}",
    "keyBackup.everythingOnThisSessionIsBacked":
        "Todo lo de esta sesión tiene copia de seguridad",
    "keyBackup.notSet": "Sin establecer",
    "keyExportSettings.exportOrImportRoomKeys":
        "Exportar o importar las claves de las salas",
    "keyExportSettings.aKeyFileLetsAnotherApp":
        "Un archivo de claves permite que otra aplicación de Matrix, o una sesión nueva, lea tu historial de mensajes cifrados. Guarda el archivo y su frase de contraseña en un lugar seguro: quien tenga ambos puede leer tus mensajes.",
    "keyExportSettings.export": "Exportar",
    "keyExportSettings.import": "Importar",
    "keyExportSettings.passphrase": "Frase de contraseña",
    "keyExportSettings.confirmPassphrase": "Confirmar la frase de contraseña",
    "keyExportSettings.passphrasesDontMatch":
        "Las frases de contraseña no coinciden",
    "keyExportSettings.exportKeys": "Exportar claves",
    "keyExportSettings.exporting": "Exportando…",
    "keyExportSettings.exported":
        "{count, plural, one {Se exportó # clave} other {Se exportaron # claves}}",
    "keyExportSettings.couldNotExportYourKeys":
        "No se pudieron exportar tus claves",
    "keyExportSettings.keyFile": "Archivo de claves",
    "keyExportSettings.importKeys": "Importar claves",
    "keyExportSettings.wrongPassphrase":
        "Frase de contraseña incorrecta, o el archivo se ha modificado",
    "keyExportSettings.notAKeyFile":
        "Eso no es un archivo de claves, o está dañado",
    "keyExportSettings.newerFormat":
        "Este archivo de claves lo creó una aplicación más reciente y no se puede leer aquí",
    "keyExportSettings.couldNotImportTheKeys":
        "No se pudieron importar las claves",

    // src/lib/utils/keywordRules.ts
    "keywordRules.keywordCannotBeEmpty":
        "La palabra clave no puede estar vacía",
    "keywordRules.keywordCannotStartWith":
        "La palabra clave no puede empezar por '.'",
    "keywordRules.youAlreadyHaveARuleFor":
        "Ya tienes una regla para esta palabra clave",

    // src/lib/utils/liveAnnouncer.ts
    "liveAnnouncer.messageFrom": "Mensaje de {sender}",
    "liveAnnouncer.newMessagesFrom":
        "{count, plural, one {# mensaje nuevo de {sender}} other {# mensajes nuevos de {sender}}}",
    "liveAnnouncer.newMessages":
        "{count, plural, one {# mensaje nuevo} other {# mensajes nuevos}}",

    // src/lib/utils/liveShareStop.ts
    "liveShareStop.couldnTStopSharingYourLive":
        "No se pudo dejar de compartir tu ubicación en tiempo real; sigue visible para esta sala. Usa Reintentar detener para volver a intentarlo.",
    "liveShareStop.stopping": "Deteniendo…",
    "liveShareStop.stillSharingCouldnTStop":
        "Se sigue compartiendo; no se pudo detener",
    "liveShareStop.youReAlreadySharingYourLive":
        "Ya estás compartiendo tu ubicación en tiempo real en esta sala.",
    "liveShareStop.yourLastLiveLocationShareHere":
        "La última vez que compartiste tu ubicación en tiempo real aquí todavía no se ha detenido; detenla desde el banner de la sala antes de empezar otra.",
    "liveShareStop.stop": "Detener",
    "liveShareStop.retryStop": "Reintentar detener",

    // src/lib/utils/location.ts
    "location.location": "Ubicación",

    // src/lib/utils/mediaGallery.ts
    "mediaGallery.of": "{value} de {length}{value2}",

    // src/lib/utils/messageActionsMenu.ts
    "messageActionsMenu.edit": "Editar",
    "messageActionsMenu.unpin": "Desfijar",
    "messageActionsMenu.pin": "Fijar",
    "messageActionsMenu.copyLink": "Copiar el enlace",
    "messageActionsMenu.report": "Denunciar",

    // src/lib/utils/messageDisplay.ts
    "messageDisplay.systemDefault": "Predeterminada del sistema",

    // src/lib/utils/micErrorMessage.ts
    "micErrorMessage.noMicrophoneFoundConnectOneOr":
        "No se encontró ningún micrófono: conecta uno o elige otro dispositivo de entrada para unirte a la llamada",
    "micErrorMessage.couldNotOpenYourMicrophoneAnother":
        "No se pudo abrir tu micrófono; puede que otra aplicación lo esté usando",

    // src/lib/utils/mutePowerLevel.ts
    "mutePowerLevel.enterAPowerLevel": "Escribe un nivel de poder",
    "mutePowerLevel.mustBeAWholeNumber": "Debe ser un número entero",
    "mutePowerLevel.useToMute": "Usa {MUTE_POWER_LEVEL} para silenciar",
    "mutePowerLevel.youCanTSetALevel":
        "No puedes establecer un nivel superior al tuyo ({ceiling})",

    // src/lib/utils/notifActions.ts
    "notifActions.reply": "Responder",
    "notifActions.reply2": "Responder…",
    "notifActions.markAsRead": "Marcar como leído",

    // src/lib/utils/notificationPrivacy.ts
    "notificationPrivacy.sentAMessage": "ha enviado un mensaje",
    "notificationPrivacy.newMessage": "Mensaje nuevo",

    // src/lib/utils/notifyPermission.ts
    "notifyPermission.notificationsAreBlockedSoIncomingCalls":
        "Las notificaciones están bloqueadas, así que las llamadas entrantes no te avisarán cuando esta ventana esté oculta. Desbloquea las notificaciones en los ajustes del sistema.",
    "notifyPermission.thisBrowserCanTShowCall":
        "Este navegador no puede mostrar avisos de llamada cuando la ventana está oculta.",

    // src/lib/utils/pollContent.ts
    "pollContent.addAQuestion": "Añade una pregunta.",
    "pollContent.addAtLeastTwoOptions": "Añade al menos dos opciones.",
    "pollContent.atMostOptions": "Como máximo {MAX_ANSWERS} opciones.",
    "pollContent.invalidNumberOfSelections": "Número de selecciones no válido.",
    "pollContent.thePollHasEnded": "La encuesta ha terminado.",

    // src/lib/utils/powerLevels.ts
    "powerLevels.enterAPowerLevel": "Escribe un nivel de poder",
    "powerLevels.mustBeAWholeNumber": "Debe ser un número entero",
    "powerLevels.mustBe0OrHigher": "Debe ser 0 o más",
    "powerLevels.youCanTSetALevel":
        "No puedes establecer un nivel superior al tuyo ({ceiling})",

    // src/lib/utils/presence.ts
    "presence.online": "En línea",
    "presence.away": "Ausente",
    "presence.offline": "Desconectado",
    "presence.seenAsOnlineWhileTheApp":
        "Apareces en línea mientras la aplicación se sincroniza",
    "presence.shownAsIdleToOtherUsers":
        "Apareces como ausente para otros usuarios",
    "presence.invisible": "Invisible",
    "presence.appearOfflineToOtherUsers":
        "Aparecer desconectado para otros usuarios",

    // src/lib/utils/pushRuleWrite.ts
    "pushRuleWrite.yourHomeserverHasNoNotificationRule":
        'Tu servidor base no tiene ninguna regla de notificación "{label}", así que no se pudo cambiar.',
    "pushRuleWrite.yourHomeserverRejectedTheChangeTo":
        'Tu servidor base rechazó el cambio en las notificaciones "{label}".',
    "pushRuleWrite.notificationsDidNotChangeOnYour":
        'Las notificaciones "{label}" no cambiaron en tu servidor base.',
    "pushRuleWrite.couldNotSaveNotificationsCheckYour":
        'No se pudieron guardar las notificaciones "{label}". Comprueba tu conexión y vuelve a intentarlo.',

    // src/lib/utils/pusherVerification.ts
    "pusherVerification.noGatewayUrl": "(sin URL de pasarela)",

    // src/lib/utils/recoveryPassphrase.ts
    "recoveryPassphrase.enterAPassphrase": "Escribe una frase de contraseña.",
    "recoveryPassphrase.useAtLeastCharacters":
        "Usa al menos {MIN_PASSPHRASE_LENGTH} caracteres.",

    // src/lib/utils/reportMessage.ts
    "reportMessage.failedToSendReport": "No se pudo enviar la denuncia",

    // src/lib/utils/roomAliases.ts
    "roomAliases.enterAnAddress": "Escribe una dirección.",
    "roomAliases.addressesCannotContainSpaces":
        "Las direcciones no pueden contener espacios.",
    "roomAliases.addressesCannotContain":
        "Las direcciones no pueden contener ':'.",
    "roomAliases.addressesCannotContain2":
        "Las direcciones no pueden contener '#'.",
    "roomAliases.addressesCannotContainControlCharacters":
        "Las direcciones no pueden contener caracteres de control.",
    "roomAliases.addressIsTooLongMaxCharacters":
        "La dirección es demasiado larga (máx. {MAX_ALIAS_LENGTH} caracteres).",
    "roomAliases.thatAddressAlreadyExists": "Esa dirección ya existe.",

    // src/lib/utils/roomCreationOutcome.ts
    "roomCreationOutcome.theServerRejectedTheChange":
        "el servidor rechazó el cambio",
    "roomCreationOutcome.theRoomWasCreatedButAdding":
        "La sala se creó, pero no se pudo añadir al espacio: {detailSentence}",
    "roomCreationOutcome.theDirectMessageWasCreatedBut":
        "El mensaje directo se creó, pero no se pudo guardar en tu lista de MD: {detailSentence} Puede que aparezca como una sala normal hasta que se vuelva a intentar.",
    "roomCreationOutcome.theRoomWasCreatedButAdding2":
        "La sala se creó, pero todavía no se ha confirmado que se haya añadido al espacio; puede que aún se esté guardando. Vuelve a intentarlo si la sala no aparece en el espacio.",
    "roomCreationOutcome.theDirectMessageWasCreatedBut2":
        "El mensaje directo se creó, pero todavía no se ha confirmado que se haya guardado en tu lista de MD; puede que aún se esté guardando. Vuelve a intentarlo si no aparece en tu lista de MD.",

    // src/lib/utils/roomEncryption.ts
    "roomEncryption.thisRoomIsAlreadyEncrypted": "Esta sala ya está cifrada.",
    "roomEncryption.youNeedPowerLevelToEnable":
        "Necesitas un nivel de poder de {required} para activar el cifrado.",
    "roomEncryption.youAlreadyHaveADirectMessage":
        "Ya tienes un mensaje directo con este usuario y no está cifrado. El cifrado no se puede añadir automáticamente: ábrelo y actívalo desde los ajustes de Seguridad de la sala.",
    "roomEncryption.enableEncryptionWarning":
        "El cifrado no se puede desactivar una vez activado. Todos necesitarán un cliente compatible con el cifrado para leer los mensajes nuevos.",

    // src/lib/utils/roomHeaderMenu.ts
    "roomHeaderMenu.threads": "Hilos",
    "roomHeaderMenu.pinnedMessages": "Mensajes fijados",
    "roomHeaderMenu.notificationsInbox": "Bandeja de notificaciones",
    "roomHeaderMenu.mediaAndFiles": "Multimedia y archivos",
    "roomHeaderMenu.memberList": "Lista de miembros",

    // src/lib/utils/roomMedia.ts
    "roomMedia.image": "Imagen",
    "roomMedia.video": "Vídeo",
    "roomMedia.file": "Archivo",
    "roomMedia.audio": "Audio",
    "roomMedia.kb": "{toFixed} KB",
    "roomMedia.mb": "{toFixed} MB",

    // src/lib/utils/roomSettingsNav.ts
    "roomSettingsNav.general": "General",
    "roomSettingsNav.access": "Acceso",
    "roomSettingsNav.security": "Seguridad",
    "roomSettingsNav.permissions": "Permisos",
    "roomSettingsNav.members": "Miembros",
    "roomSettingsNav.emotes": "Emotes",
    "roomSettingsNav.rooms": "Salas",

    // src/lib/utils/roomStateTrust.ts
    "roomStateTrust.unverifiedRoomState": "Estado de la sala sin verificar",
    "roomStateTrust.unverifiedRoomStateTooltip":
        "Algunos datos de esta sala (roles, membresía y permisos) se obtuvieron directamente del servidor y no se han confirmado mediante la sincronización, así que pueden ser inexactos. El servidor sigue aplicando las acciones independientemente de lo que se muestre aquí.",

    // src/lib/utils/roomUpgrade.ts
    "roomUpgrade.theServerSRecommendedRoomVersion":
        "La versión de sala recomendada por el servidor no está disponible.",
    "roomUpgrade.thisRoomIsOnTheLatest":
        "Esta sala está en la última versión (v{recommendedVersion}).",
    "roomUpgrade.youDonTHavePermissionTo":
        "No tienes permiso para actualizar esta sala.",

    // src/lib/utils/saveFile.ts
    "saveFile.savedToDownloads": "Guardado en Descargas",

    // src/lib/utils/securityStatusView.ts
    "securityStatusView.couldnTReadThisAccountS":
        "No se pudo leer el estado del cifrado de esta cuenta. Nada de lo que aparece aquí es fiable hasta que se cargue; no configures ni restablezcas la recuperación todavía.",
    "securityStatusView.encryptionIsnTReadyOnThis":
        "El cifrado todavía no está listo en esta sesión. Recarga si el problema continúa.",

    // src/lib/utils/serverAcl.ts
    "serverAcl.allowListIsEmptyWhichDenies":
        "La lista de permitidos está vacía, lo que impide la federación a todos los servidores.",
    "serverAcl.denyListContainsWhichBansAll":
        "La lista de denegados contiene *, lo que veta a todos los servidores.",
    "serverAcl.thisConfigurationBansYourOwnServer":
        "Esta configuración veta tu propio servidor ({ownServerName}), lo que romperá la federación.",

    // src/lib/utils/serverCapabilities.ts
    "serverCapabilities.crossSigningE2ee": "Firma cruzada (E2EE)",
    "serverCapabilities.privateReadReceipts":
        "Confirmaciones de lectura privadas",
    "serverCapabilities.threadedRelations": "Relaciones en hilos",
    "serverCapabilities.spaceSummaries": "Resúmenes de espacios",
    "serverCapabilities.busyPresence": "Presencia ocupada",
    "serverCapabilities.dehydratedDevices": "Dispositivos deshidratados",
    "serverCapabilities.filterPublicRoomsByType":
        "Filtrar salas públicas por tipo",
    "serverCapabilities.authenticatedMedia": "Multimedia autenticado",
    "serverCapabilities.intentionalMentions": "Menciones intencionales",
    "serverCapabilities.slidingSyncSimplified":
        "Sincronización deslizante (simplificada)",
    "serverCapabilities.sharedRoomsWithAUser": "Salas en común con un usuario",

    // src/lib/utils/settingsNav.ts
    "settingsNav.account": "Cuenta",
    "settingsNav.securitySessions": "Seguridad y sesiones",
    "settingsNav.privacySafety": "Privacidad y seguridad",
    "settingsNav.app": "Aplicación",
    "settingsNav.appearance": "Apariencia",
    "settingsNav.messagesMedia": "Mensajes y multimedia",
    "settingsNav.voiceVideo": "Voz y vídeo",
    "settingsNav.emotes": "Emotes",
    "settingsNav.advanced": "Avanzado",
    "settingsNav.general": "General",
    "settingsNav.plugins": "Plugins",
    "settingsNav.server": "Servidor",
    "settingsNav.about": "Acerca de",
    "settingsNav.debug": "Depuración",

    // src/lib/utils/settingsSearch.ts
    "settingsSearch.displayName": "Nombre visible",
    "settingsSearch.avatar": "Avatar",
    "settingsSearch.presence": "Presencia",
    "settingsSearch.changePassword": "Cambiar la contraseña",
    "settingsSearch.logOut": "Cerrar sesión",
    "settingsSearch.deactivateAccount": "Desactivar la cuenta",
    "settingsSearch.sessions": "Sesiones",
    "settingsSearch.encryptNewDirectMessages":
        "Cifrar los nuevos mensajes directos",
    "settingsSearch.onlySendToVerifiedDevices":
        "Enviar solo a dispositivos verificados",
    "settingsSearch.setUpRecovery": "Configurar la recuperación",
    "settingsSearch.restoreMessageHistory":
        "Restaurar el historial de mensajes",
    "settingsSearch.verifyThisSession": "Verificar esta sesión",
    "settingsSearch.rightAlignMyMessages": "Alinear mis mensajes a la derecha",
    "settingsSearch.showWhenIAmInA": "Mostrar cuando estoy en una llamada",
    "settingsSearch.showNameColours": "Mostrar los colores de los nombres",
    "settingsSearch.textSize": "Tamaño del texto",
    "settingsSearch.font": "Fuente",
    "settingsSearch.themePresets": "Preajustes de tema",
    "settingsSearch.importExportTheme": "Importar / exportar tema",
    "settingsSearch.timeFormat": "Formato de hora",
    "settingsSearch.dateFormat": "Formato de fecha",
    "settingsSearch.showMatrixIds": "Mostrar los ID de Matrix",
    "settingsSearch.readReceiptAvatars": "Avatares de confirmación de lectura",
    "settingsSearch.linkPreviews": "Vistas previas de enlaces",
    "settingsSearch.linkPreviewMedia":
        "Contenido de las vistas previas de enlaces",
    "settingsSearch.pauseVideosOffScreen":
        "Pausar los vídeos fuera de la pantalla",
    "settingsSearch.sendVideosThatStreamFaster":
        "Enviar vídeos que se reproducen antes",
    "settingsSearch.sendPhotosThatAppearSooner":
        "Enviar fotos que aparecen antes",
    "settingsSearch.removeLocationAndMetadata":
        "Quitar la ubicación y otros metadatos de los archivos subidos",
    "settingsSearch.sendGifsAsAnimatedWebp": "Enviar GIF como WebP animado",
    "settingsSearch.midiSoundBank": "Banco de sonidos MIDI",
    "settingsSearch.holdToOpenMessageMenu":
        "Mantener pulsado para abrir el menú del mensaje",
    "settingsSearch.gifDefaultTab": "Pestaña de GIF predeterminada",
    "settingsSearch.minimiseToTrayOnClose": "Minimizar a la bandeja al cerrar",
    "settingsSearch.proxy": "Proxy",
    "settingsSearch.reduceMotion": "Reducir el movimiento",
    "settingsSearch.keepRoomListOpen": "Mantener abierta la lista de salas",
    "settingsSearch.customEmotes": "Emotes personalizados",
    "settingsSearch.pushNotificationsPermission":
        "Permiso de notificaciones push",
    "settingsSearch.notificationSound": "Sonido de notificación",
    "settingsSearch.desktopAlertsPopUpAndTaskbar":
        "Alertas de escritorio (ventana emergente y parpadeo de la barra de tareas)",
    "settingsSearch.popUpNotifications": "Notificaciones emergentes",
    "settingsSearch.quietOnMyOtherDevices":
        "Silencio en mis otros dispositivos",
    "settingsSearch.privateReadReceipts": "Confirmaciones de lectura privadas",
    "settingsSearch.hideMessageTextInNotifications":
        "Ocultar el texto de los mensajes en las notificaciones",
    "settingsSearch.notificationRules": "Reglas de notificación",
    "settingsSearch.keywordHighlights": "Palabras clave destacadas",
    "settingsSearch.inputDevice": "Dispositivo de entrada",
    "settingsSearch.outputDevice": "Dispositivo de salida",
    "settingsSearch.camera": "Cámara",
    "settingsSearch.noiseSuppression": "Supresión de ruido",
    "settingsSearch.echoCancellation": "Cancelación de eco",
    "settingsSearch.autoGainControl": "Control automático de ganancia",
    "settingsSearch.normalizeVoices": "Igualar el volumen de las voces",
    "settingsSearch.mirrorMyCamera": "Reflejar mi cámara",
    "settingsSearch.videoCodec": "Códec de vídeo",
    "settingsSearch.callVolume": "Volumen de las llamadas",
    "settingsSearch.playCallSounds": "Reproducir sonidos de llamada",
    "settingsSearch.ringForIncomingDmCalls":
        "Sonar con las llamadas entrantes de MD",
    "settingsSearch.blockedUsers": "Usuarios bloqueados",
    "settingsSearch.serverCapabilities": "Capacidades del servidor",
    "settingsSearch.plugins": "Plugins",
    "settingsSearch.pluginRepositories": "Repositorios de plugins",
    "settingsSearch.syncPlugins": "Sincronizar plugins",
    "settingsSearch.checkForUpdates": "Buscar actualizaciones",
    "settingsSearch.clearCache": "Borrar la caché",
    "settingsSearch.showAllEvents": "Mostrar todos los eventos",
    "settingsSearch.pushDiagnostics": "Diagnóstico de notificaciones push",
    "settingsSearch.pushService": "Servicio push (UnifiedPush / Firebase)",
    "settingsSearch.language": "Idioma",

    // src/lib/utils/slashCommands.ts
    "slashCommands.createAPoll": "Crear una encuesta",
    "slashCommands.shareYourLocation": "Compartir tu ubicación",
    "slashCommands.joinARoomByAddress": "Unirse a una sala por dirección",
    "slashCommands.leaveTheCurrentRoom": "Salir de la sala actual",
    "slashCommands.inviteAUserToThisRoom": "Invitar a un usuario a esta sala",
    "slashCommands.setTheRoomTopic": "Establecer el tema de la sala",
    "slashCommands.removeAUserFromThisRoom": "Quitar a un usuario de esta sala",
    "slashCommands.userServerReason": "<@usuario:servidor> [motivo]",
    "slashCommands.banAUserFromThisRoom": "Vetar a un usuario en esta sala",
    "slashCommands.setYourDisplayName": "Establecer tu nombre visible",
    "slashCommands.displayName": "<nombre visible>",
    "slashCommands.setAUserSPowerLevel":
        "Establecer el nivel de poder de un usuario",
    "slashCommands.userServerLevel": "<@usuario:servidor> [nivel]",
    "slashCommands.resetAUserSPowerLevel":
        "Restablecer el nivel de poder de un usuario al predeterminado",
    "slashCommands.discardSession":
        "Usar una nueva clave de sala en tu próximo mensaje, si no pueden leer los tuyos",
    "slashCommands.usage": "Uso: /{name} {argHint}",
    "slashCommands.usage2": "Uso: /{name}",

    // src/lib/utils/syncStatus.ts
    "syncStatus.connected": "Conectado",
    "syncStatus.reconnecting": "Reconectando…",
    "syncStatus.connectionError": "Error de conexión",
    "syncStatus.offline": "Sin conexión",
    "syncStatus.connecting": "Conectando…",

    // src/lib/utils/themePalette.ts
    "themePalette.accent": "Acento",
    "themePalette.background": "Fondo",
    "themePalette.secondaryBackground": "Fondo secundario",
    "themePalette.tertiaryBackground": "Fondo terciario",
    "themePalette.primaryText": "Texto principal",
    "themePalette.secondaryText": "Texto secundario",
    "themePalette.mutedText": "Texto atenuado",
    "themePalette.danger": "Peligro",
    "themePalette.positive": "Positivo",
    "themePalette.mentionHighlight": "Resaltado de menciones",
    "themePalette.link": "Enlace",
    "themePalette.warning": "Aviso",
    "themePalette.onlineStatus": "Estado en línea",
    "themePalette.idleStatus": "Estado ausente",
    "themePalette.doNotDisturbStatus": "Estado No molestar",
    "themePalette.offlineStatus": "Estado desconectado",
    "themePalette.divider": "Separador",
    "themePalette.spoilerBackground": "Fondo de spoiler",
    "themePalette.ownMessageBubble": "Burbuja de mis mensajes",
    "themePalette.primaryTextOnBackground": "Texto principal sobre el fondo",
    "themePalette.secondaryTextOnBackground": "Texto secundario sobre el fondo",
    "themePalette.mutedTextOnTertiaryBackground":
        "Texto atenuado sobre el fondo terciario",
    "themePalette.whiteTextOnAccentButtons":
        "Texto blanco sobre botones de acento",
    "themePalette.whiteTextOnDangerButtons":
        "Texto blanco sobre botones de peligro",
    "themePalette.whiteTextOnOwnBubble":
        "Texto blanco sobre la burbuja de mis mensajes",

    // src/lib/utils/themePreset.ts
    "themePreset.copy": "{newName} (copia)",

    // src/lib/utils/threadList.ts
    "threadList.noPreview": "(sin vista previa)",

    // src/lib/utils/threePidInvite.ts
    "threePidInvite.youDonTHavePermissionTo":
        "No tienes permiso para invitar a personas a esta sala.",
    "threePidInvite.yourHomeserverHasNoIdentityServer":
        "Tu servidor base no tiene servidor de identidad, así que las invitaciones por correo no están disponibles.",

    // src/lib/utils/timeFormat.ts
    "timeFormat.yesterdayAt": "Ayer a las {time}",
    "timeFormat.today": "Hoy",
    "timeFormat.yesterday": "Ayer",
    "timeFormat.separatorDatePattern": "EEEE, d 'de' MMMM 'de' yyyy",
    "timeFormat.monthDayPattern": "d MMM",
    "timeFormat.compactDateTime": "{date}, {time}",

    // src/lib/utils/updateStatus.ts
    "updateStatus.checkingForUpdates": "Buscando actualizaciones…",
    "updateStatus.youReOnTheLatestVersion":
        "Tienes la última versión{versionSuffix}",
    "updateStatus.checkForUpdates": "Buscar actualizaciones",
    "updateStatus.updateAvailable": "Actualización disponible{versionSuffix}",
    "updateStatus.downloadInstall": "Descargar e instalar",
    "updateStatus.downloadingV": "Descargando v{version}",
    "updateStatus.downloadingUpdate": "Descargando la actualización",
    "updateStatus.updateReadyInstall":
        "Actualización lista{versionSuffix} - Instalar",
    "updateStatus.install": "Instalar",
    "updateStatus.updateReadyRestartToApply":
        "Actualización lista{versionSuffix} - reinicia para aplicarla",
    "updateStatus.restartToApply": "Reiniciar para aplicar",
    "updateStatus.updateReadyReloadToApply":
        "Actualización lista{versionSuffix} - recarga para aplicar",
    "updateStatus.reloadToApply": "Recargar para aplicar",
    "updateStatus.aNewVersionIsAvailable":
        "Hay una nueva versión disponible{versionSuffix}",
    "updateStatus.openReleasePage": "Abrir la página de la versión",
    "updateStatus.updateCheckFailed": "No se pudieron buscar actualizaciones",
    "updateStatus.checkForUpdatesToInstallThe":
        "Busca actualizaciones para instalar la última versión.",

    // src/lib/utils/uploadLimits.ts
    "uploadLimits.mb": "{round} MB",
    "uploadLimits.kb": "{round} KB",
    "uploadLimits.exceedsTheServerSUploadLimit":
        '"{fileName}" supera el límite de subida del servidor de {formatByteLimit}',

    // src/lib/utils/verificationMessage.ts
    "verificationMessage.verificationRequestSent":
        "Solicitud de verificación enviada",
    "verificationMessage.waitingForThemToAccept": "Esperando a que acepte…",
    "verificationMessage.noLongerPending": "Ya no está pendiente",
    "verificationMessage.wantsToVerify": "{senderName} quiere verificar",
    "verificationMessage.compareEmojiToConfirmThisIs":
        "Compara los emojis para confirmar que de verdad es esa persona",
    "verificationMessage.sentAVerificationRequest":
        "{senderName} ha enviado una solicitud de verificación",

    // src/lib/utils/verificationStatus.ts
    "verificationStatus.checkingEncryption": "Comprobando el cifrado…",
    "verificationStatus.encryptionUnavailable": "Cifrado no disponible",
    "verificationStatus.statusUnavailable": "Estado no disponible",
    "verificationStatus.verified": "Verificada",
    "verificationStatus.thisSessionIsVerifiedAndEncryption":
        "Esta sesión está verificada y el cifrado está completamente configurado.",
    "verificationStatus.notSetUp": "Sin configurar",
    "verificationStatus.setUpEncryptionToSecureYour":
        "Configura el cifrado para proteger tus mensajes en todos tus dispositivos.",
    "verificationStatus.setUp": "Configurar",
    "verificationStatus.encryptionSetupIncomplete":
        "Configuración del cifrado incompleta",
    "verificationStatus.thisSessionIsVerifiedButEncryption":
        "Esta sesión está verificada, pero la configuración del cifrado está incompleta.",
    "verificationStatus.finishSetup": "Terminar la configuración",
    "verificationStatus.unverified": "Sin verificar",
    "verificationStatus.thisSessionIsnTVerifiedYet":
        "Esta sesión todavía no está verificada.",

    // src/routes/+layout.svelte
    "rootLayout.linkCopied": "Enlace copiado",

    // src/routes/+page.svelte
    "rootPage.failedToReconnectPleaseLogIn":
        "No se pudo volver a conectar. Inicia sesión de nuevo.",
    "rootPage.signedInButSyncingCouldNot":
        "Has iniciado sesión, pero no se pudo iniciar la sincronización. Inténtalo de nuevo.",
    "rootPage.yourSessionHasExpiredPleaseSign":
        "Tu sesión ha caducado. Inicia sesión de nuevo.",

    // ownStatus
    "ownStatus.profileField": "campo del perfil {key}",
    "ownStatus.theServerStillHas": "El servidor todavía tiene: {leftovers}",
    "ownStatus.statusClearedButPresenceRemains":
        'Estado borrado, pero el servidor sigue mostrando el mensaje de presencia "{presenceLeft}". Probablemente lo ha establecido otra sesión de esta cuenta (otra aplicación o cliente): bórralo allí o cierra esa sesión.',
    // Not translated yet; shown in English.
    "callParticipantMenu.shareVolume": "Share Volume",
    "screenShareQualityChips.bitrateUpTo": "Up to",
    "screenShareQualityChips.bitrateCapHint":
        "A limit, not a target: the share uses only what the picture needs and your connection can carry, up to this.",
    "screenShareQualityChips.bitrateOverridden":
        "Using the upload speed you entered, {upload}, so this goes up to {max}.",
    "screenShareQualityChips.uploadOverride": "Upload speed (Mbps)",
    "screenShareQualityChips.uploadOverrideAuto": "Auto",
    "screenShareQualityChips.uploadOverrideHint":
        "The automatic measurement can read well under your real speed. Enter your own figure to raise the limit; leave it empty to measure.",
    "voiceAudioSettings.cannotWatch": "Video I can't watch",
    "voiceAudioSettings.cannotWatchHint":
        "Pick the codecs that show nothing (or a black picture) on this device. Others in the call then send you H.264 instead. Zam also fills this in when a stream arrives and never decodes.",
    "client.codecCouldNotBeDecoded":
        "This device can't decode {codec} video. Asking for H.264 instead.",
};

const catalogue: LocaleCatalogue = { messages, dateLocale: es };

export default catalogue;
