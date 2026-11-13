// Russian (ru). Same keys and placeholders as ../en.ts; a string missing
// here falls back to English (`npm run i18n:missing` lists them).

import { ru } from "date-fns/locale/ru";
import type { MessageKey } from "../en";
import type { LocaleCatalogue } from "../index";

const messages: Partial<Record<MessageKey, string>> = {
    // Shared
    "common.turnOffCamera": "Выключить камеру",
    "common.turnOnCamera": "Включить камеру",
    "common.stopSharing": "Остановить демонстрацию",
    "common.shareYourScreen": "Показать экран",
    "common.joining": "Подключение…",
    "common.join": "Присоединиться",
    "common.closeDialog": "Закрыть диалог",
    "common.settings": "Настройки",
    "common.searchResults": "Результаты поиска",
    "common.default": "По умолчанию",
    "common.mute": "Заглушить",
    "common.saving": "Сохранение…",
    "common.unblock": "Разблокировать",
    "common.block": "Заблокировать",
    "common.closeMenu": "Закрыть меню",
    "common.openRoomList": "Открыть список комнат",
    "common.uploading": "Загрузка…",
    "common.uploadImage": "Загрузить изображение",
    "common.emoji": "Эмодзи",
    "common.decline": "Отклонить",
    "common.invitePeople": "Пригласить людей",
    "common.close": "Закрыть",
    "common.cancel": "Отмена",
    "common.loading": "Загрузка…",
    "common.loadMore": "Загрузить ещё",
    "common.notifications": "Уведомления",
    "common.save": "Сохранить",
    "common.topic": "Тема",
    "common.videoRoom": "Видеокомната",
    "common.reasonOptional": "Причина (необязательно)",
    "common.actions": "Действия",
    "common.copy": "Копировать",
    "common.remove": "Удалить",
    "common.add": "Добавить",
    "common.starting": "Запуск…",
    "common.verify": "Подтвердить",
    "common.removeFromFavourites": "Убрать из избранного",
    "common.addToFavourites": "Добавить в избранное",
    "common.stickers": "Стикеры",
    "common.retry": "Повторить",
    "common.delete": "Удалить",
    "common.checking": "Проверка…",
    "common.gifs": "GIF",
    "common.dragOrUseArrowKeysTo":
        "Перетащите или используйте клавиши со стрелками, чтобы изменить размер",
    "common.resizePicker": "Изменить размер панели выбора",
    "common.noResults": "Ничего не найдено",
    "common.memberCount":
        "{count, plural, one {# участник} few {# участника} many {# участников} other {# участника}}",
    "common.replyCount":
        "{count, plural, one {# ответ} few {# ответа} many {# ответов} other {# ответа}}",

    // src/lib/components/settings/AboutSettings.svelte
    "aboutSettings.automaticUpdates": "Автоматические обновления",
    "aboutSettings.version": "Версия",
    "aboutSettings.currentVersionV": "Текущая версия v{APP_VERSION}",
    "aboutSettings.checkForUpdates": "Проверить обновления",
    "aboutSettings.updateAvailable": "Доступно обновление",
    "aboutSettings.reloading": "Перезагрузка…",
    "aboutSettings.update": "Обновить",
    "aboutSettings.reloadToUpdate": "Перезагрузить для обновления",
    "aboutSettings.youReOnTheLatestVersion":
        "У вас установлена последняя версия.",
    "aboutSettings.credits": "Благодарности",
    "aboutSettings.creditsMidiInstruments": "MIDI-инструменты",
    "aboutSettings.creditsSoundFont":
        "автор {author}, на основе Phoenix авторства {original}. Лицензия CC BY; переназначено на General MIDI и сжато для Zam.",
    "aboutSettings.creditsSoundFontGaps":
        "Инструменты, которых нет в MT-32: {microgm} автора {microgmAuthor} (WTFPL) и {generalUser} автора {generalUserAuthor}.",
    "aboutSettings.troubleshooting": "Устранение неполадок",
    "aboutSettings.clearCacheAndResync":
        "Очистить кэш и синхронизировать заново",
    "aboutSettings.reDownloadsYourRoomsFromThe":
        "Заново загружает ваши комнаты с сервера. Помогает, если комнаты пропали или зависли. Вы остаётесь в системе.",
    "aboutSettings.resyncing": "Повторная синхронизация…",
    "aboutSettings.clearCache": "Очистить кэш",
    "aboutSettings.updateCheckFailed": "Не удалось проверить обновления",
    "aboutSettings.downloadFailed": "Не удалось загрузить",
    "aboutSettings.installFailed": "Не удалось установить",
    "aboutSettings.failedToCheckForUpdates": "Не удалось проверить обновления.",
    "aboutSettings.sourceCodeOnGitHub": "Исходный код на GitHub",
    "links.website": "Сайт",
    "links.github": "GitHub",
    "links.downloadApps": "Скачать приложения",

    // src/lib/components/settings/AccountSettings.svelte
    "accountSettings.profile": "Профиль",
    "accountSettings.yourAvatar": "Ваш аватар",
    "accountSettings.changeAvatar": "Сменить аватар",
    "accountSettings.yourDisplayName": "Ваше отображаемое имя",
    "accountSettings.saved": "Сохранено",
    "accountSettings.account": "Учётная запись",
    "accountSettings.userId": "ID пользователя",
    "accountSettings.homeserver": "Домашний сервер",
    "accountSettings.connection": "Подключение",
    "accountSettings.presence": "Статус присутствия",
    "accountSettings.password": "Пароль",
    "accountSettings.currentPassword": "Текущий пароль",
    "accountSettings.newPassword": "Новый пароль",
    "accountSettings.confirmNewPassword": "Подтвердите новый пароль",
    "accountSettings.signOutAllOtherSessions":
        "Выйти из всех остальных сеансов",
    "accountSettings.changing": "Смена…",
    "accountSettings.changePassword": "Сменить пароль",
    "accountSettings.passwordChanged": "Пароль изменён.",
    "accountSettings.thisServerDoesNotAllowChanging":
        "Этот сервер не позволяет менять пароль из этого приложения.",
    "accountSettings.managedByProvider":
        "Пароль, сеансы и учётная запись управляются на странице учётной записи вашего провайдера входа.",
    "accountSettings.manageAccount": "Управление учётной записью",
    "accountSettings.emailPhoneNumbers": "Электронная почта и номера телефонов",
    "accountSettings.noEmailAddressesOrPhoneNumbers":
        "К этой учётной записи не привязаны адреса электронной почты или номера телефонов.",
    "accountSettings.email": "Электронная почта",
    "accountSettings.phone": "Телефон",
    "accountSettings.thisServerDoesNotAllowManaging":
        "Этот сервер не позволяет управлять ими из этого приложения.",
    "accountSettings.logOut": "Выйти",
    "accountSettings.lastDeviceTitle":
        "Это ваше единственное устройство, на котором выполнен вход",
    "accountSettings.lastDeviceBackedUp":
        "Ваша зашифрованная история сохранена в резервной копии, но после повторного входа для её прочтения понадобится ключ восстановления.",
    "accountSettings.lastDeviceNoBackup":
        "При выходе ключи шифрования, хранящиеся на этом устройстве, будут безвозвратно утеряны. Без резервной копии ключей или другого подтверждённого устройства восстановить историю зашифрованных сообщений будет невозможно.",
    "accountSettings.logOutAnyway": "Всё равно выйти",
    "accountSettings.dangerZone": "Опасная зона",
    "accountSettings.deactivateAccount": "Деактивировать учётную запись…",
    "accountSettings.deactivationIsPermanentAndCannotBe":
        "Деактивация необратима и не может быть отменена.",
    "accountSettings.eraseMessagesWherePossible":
        "Стереть сообщения, где это возможно",
    "accountSettings.deactivating": "Деактивация…",
    "accountSettings.deactivateAccount2": "Деактивировать учётную запись",
    "accountSettings.avatarUploadFailed": "Не удалось загрузить аватар",
    "accountSettings.failedToRemoveAvatar": "Не удалось удалить аватар",
    "accountSettings.failedToSaveName": "Не удалось сохранить имя",
    "accountSettings.couldNotSetPresence":
        "Не удалось установить статус присутствия",
    "accountSettings.failedToChangePassword": "Не удалось сменить пароль",
    "accountSettings.failedToDeactivateAccount":
        "Не удалось деактивировать учётную запись",

    // src/lib/components/layout/AccountSwitcher.svelte
    "accountSwitcher.signOut": "Выйти из {userId}",
    "accountSwitcher.confirm": "Подтвердить",
    "accountSwitcher.signOut2": "Выйти",
    "accountSwitcher.addAccount": "Добавить учётную запись",
    "accountSwitcher.accountMenu": "Меню учётной записи",
    "accountSwitcher.closeAccountMenu": "Закрыть меню учётной записи",
    "accountSwitcher.back": "Назад",
    "accountSwitcher.setYourStatus": "Установить статус",
    "accountSwitcher.setAStatus": "Установить статус",
    "accountSwitcher.editProfile": "Изменить профиль",
    "accountSwitcher.switchAccounts": "Сменить учётную запись",
    "accountSwitcher.couldNotSetPresence":
        "Не удалось установить статус присутствия",

    // src/lib/components/layout/ActiveCallBanner.svelte
    "activeCallBanner.openCall": "Открыть звонок",
    "activeCallBanner.open": "Открыть",
    "activeCallBanner.ringing": "Вызов…",
    "activeCallBanner.voiceCallInCall": "Голосовой звонок · в звонке: {length}",
    "activeCallBanner.leave": "Выйти",

    // src/lib/components/settings/AppearanceSettings.svelte
    "appearanceSettings.rightAlignMyMessagesBubbleLayout":
        "Выравнивать мои сообщения по правому краю (пузырьки)",
    "appearanceSettings.displayYourOwnMessagesOnThe":
        "Показывать ваши сообщения справа в цветном пузырьке",
    "appearanceSettings.showNameColours": "Показывать цвета имён",
    "appearanceSettings.drawPeopleSNamesInThe":
        "Показывать имена людей цветом, выбранным в их профиле. Выключите, чтобы все имена были обычного цвета текста.",
    "appearanceSettings.keepRoomListOpen": "Не закрывать список комнат",
    "appearanceSettings.donTAutoCloseTheRoom":
        "Не закрывать список комнат автоматически при переключении между пространствами или «Домом». Открытие комнаты или личного чата всегда закрывает его.",
    "appearanceSettings.timestamps": "Метки времени",
    "appearanceSettings.timeFormat": "Формат времени",
    "appearanceSettings.dateFormat": "Формат даты",
    "appearanceSettings.customDatePattern": "Свой шаблон даты",
    "appearanceSettings.yyyyMmDd": "yyyy-MM-dd",
    "appearanceSettings.preview": "Предпросмотр:",
    "appearanceSettings.dateFnsTokensEGYyyy":
        "· токены date-fns, например yyyy-MM-dd",
    "appearanceSettings.invalidFormatUseLowercaseDateFns":
        "Неверный формат - используйте токены date-fns, например yyyy-MM-dd.",
    "appearanceSettings.alwaysShowAbsoluteDates":
        "Всегда показывать полные даты",
    "appearanceSettings.replaceTodayAndYesterdayWithThe":
        "Везде заменять «Сегодня» и «Вчера» полной датой.",
    "appearanceSettings.reduceMotion": "Уменьшить анимацию",
    "appearanceSettings.minimizeAnimationsAndTransitionsYourDevice":
        "Свести к минимуму анимации и переходы. Системная настройка «уменьшить движение» на вашем устройстве тоже всегда учитывается.",
    "appearanceSettings.customCss": "Свой CSS",
    "appearanceSettings.customCssEnable": "Использовать свой CSS",
    "appearanceSettings.customCssHint":
        "Ваши собственные стили, применяемые сразу поверх темы. Цвета темы - это переменные на странице, поэтому переопределяйте их с помощью !important.",
    "appearanceSettings.customCssRecovery":
        "Если какое-то правило делает Zam непригодным для использования, откройте его, добавив к адресу ?nocustomcss (или выключите переключатель), чтобы вернуться.",
    "appearanceSettings.custom": "Свой",
    "appearanceSettings.12Hour": "12-часовой",
    "appearanceSettings.24Hour": "24-часовой",
    "appearanceSettings.language": "Язык",
    "appearanceSettings.layout": "Макет",
    "appearanceSettings.displayLanguage": "Язык интерфейса",
    "appearanceSettings.displayLanguageHint":
        "Язык, на котором показаны меню и кнопки Zam. При смене приложение перезагрузится.",

    // src/routes/app/+page.svelte
    "appPage.redirecting": "Перенаправление…",

    // src/lib/components/layout/AppSettings.svelte
    "appSettings.backToSettings": "Назад к настройкам",
    "appSettings.closeSettings": "Закрыть настройки",
    "appSettings.searchSettings": "Поиск по настройкам…",
    "appSettings.searchSettings2": "Поиск по настройкам",
    "appSettings.noSettingsMatch": "Подходящих настроек нет",
    "appSettings.noSettingsMatch2":
        "Нет настроек, подходящих под «{searchQuery}».",
    "appSettings.resultCount":
        "{count, plural, one {# результат} few {# результата} many {# результатов} other {# результата}}",

    // src/lib/components/layout/AppShell.svelte
    "appShell.zam": "({notificationCount}) Zam",
    "appShell.redirecting": "Перенаправление…",
    "appShell.noRoomsYet": "Комнат пока нет",
    "appShell.resizeRoomList": "Изменить ширину списка комнат",
    "appShell.createARoomOrStartA":
        "Создайте комнату или начните личный чат, чтобы приступить.",
    "appShell.nothingInHome": "В «Доме» пусто",
    "appShell.allOfYourRoomsLiveIn":
        "Все ваши комнаты находятся в пространствах - откройте одно из них, чтобы их увидеть. Комнаты и личные чаты вне пространств показываются здесь.",
    "appShell.openRoomList": "Открыть список комнат",
    "appShell.someone": "Кто-то",
    "appShell.isCalling": "{name} звонит",
    "appShell.incomingCall": "Входящий звонок",
    "appShell.offlineMessageStorageIsUnavailableThis":
        "Автономное хранилище сообщений недоступно в этом сеансе, поэтому история не будет сохранена до следующего раза.",
    "appShell.couldnTSendYourReplyIt":
        "Не удалось отправить ответ. Он сохранён как черновик.",
    "appShell.yourNotificationReplyWasSavedAs":
        "Ваш ответ на уведомление сохранён как черновик",

    // src/lib/components/settings/BlockedUsersSettings.svelte
    "blockedUsersSettings.messagesFromBlockedUsersAreHidden":
        "Сообщения заблокированных пользователей скрыты во всех комнатах. Список хранится в вашей учётной записи и действует во всех ваших сеансах.",
    "blockedUsersSettings.youHavenTBlockedAnyone":
        "Вы никого не заблокировали.",
    "blockedUsersSettings.failed": "Не удалось",

    // src/lib/components/layout/CallParticipantMenu.svelte
    "callParticipantMenu.profile": "Профиль",
    "callParticipantMenu.input": "Ввод",
    "callParticipantMenu.output": "Вывод",
    "callParticipantMenu.opening": "Открытие…",
    "callParticipantMenu.message": "Сообщение",
    "callParticipantMenu.mention": "Упомянуть",
    "callParticipantMenu.userVolume": "Громкость пользователя",
    "callParticipantMenu.soundboardVolume": "Громкость звуковой панели",
    "callParticipantMenu.shareVolume": "Громкость демонстрации",
    "callParticipantMenu.hideVideo": "Скрыть видео",
    "callParticipantMenu.kicking": "Исключение…",
    "callParticipantMenu.confirmKick": "Подтвердите исключение: {name}?",
    "callParticipantMenu.kickFromRoom": "Исключить {name} из комнаты",
    "callParticipantMenu.banning": "Блокировка…",
    "callParticipantMenu.confirmBan": "Подтвердите блокировку: {name}?",
    "callParticipantMenu.ban": "Заблокировать {name}",
    "callParticipantMenu.couldNotOpenADirectMessage":
        "Не удалось открыть личный чат",
    "callParticipantMenu.couldNotKick": "Не удалось исключить {name}",
    "callParticipantMenu.couldNotBan": "Не удалось заблокировать {name}",

    // src/lib/components/layout/CallView.svelte
    "callEncryption.encrypted":
        "Сквозное шифрование: видеть и слышать этот звонок могут только его участники.",
    "callEncryption.encryptedShort": "Зашифровано",
    "callEncryption.partial":
        "Сквозное шифрование, кроме {names}: их приложение отправляет аудио и видео без шифрования. Вы слышите и видите их, но они не слышат и не видят вас, пока их приложение не будет поддерживать зашифрованные звонки.",
    "callEncryption.partialShort": "Частично зашифровано",
    "callEncryption.notEncrypted":
        "Нет сквозного шифрования: сервер звонков может видеть и слышать этот звонок. Звонки в зашифрованных комнатах шифруются.",
    "callView.ringing": "Вызов…",
    "callView.showChat": "Показать чат",
    "callView.noOneIsInThisCall": "В этом звонке никого нет",
    "callView.backToGrid": "Назад к сетке",
    "callView.screenShareQuality": "Качество демонстрации экрана",
    "callView.optionsFor": "Параметры для {name}",
    "callView.muted": "Микрофон выключен",
    "callView.deafened": "Звук отключён",
    "callView.mutedForYou": "Заглушён для вас",
    "callView.joinedFromMultipleDevices": "Подключился с нескольких устройств",
    "callView.devices": "Устройств: {value}",
    "callView.enableAudio": "Включить звук",
    "callView.onHold": "На удержании, пока идёт другой звонок",
    "callView.resume": "Продолжить",
    "callView.speakerOn": "Включить громкую связь",
    "callView.speakerOff": "Выключить громкую связь",
    "callView.unmute": "Включить микрофон",
    "callView.undeafen": "Включить звук",
    "callView.deafen": "Отключить звук",
    "callView.disconnect": "Отключиться",
    "callView.joinCall": "Присоединиться к звонку",
    "callView.you": "Вы",
    "callView.sScreen": "Экран пользователя {name}",
    "callView.exitSpotlightFor": "Выйти из режима «в центре внимания»: {label}",
    "callView.spotlight": "Выделить: {label}",

    // src/lib/components/messages/CreatePollDialog.svelte
    "createPollDialog.createPoll": "Создать опрос",
    "createPollDialog.question": "Вопрос",
    "createPollDialog.askSomething": "Задайте вопрос…",
    "createPollDialog.options": "Варианты",
    "createPollDialog.option": "Вариант {value}",
    "createPollDialog.removeOption": "Удалить вариант",
    "createPollDialog.addOption": "+ Добавить вариант",
    "createPollDialog.results": "Результаты",
    "createPollDialog.showAsPeopleVote": "Показывать по мере голосования",
    "createPollDialog.hideUntilClosed": "Скрыть до завершения",
    "createPollDialog.allowSelectingMultipleOptions":
        "Разрешить выбор нескольких вариантов",
    "createPollDialog.creating": "Создание…",
    "createPollDialog.failedToCreatePoll": "Не удалось создать опрос",

    // src/lib/components/layout/CryptoUnavailableBanner.svelte
    "cryptoUnavailableBanner.offOutOfStorage":
        "Шифрование на этом устройстве отключено из-за нехватки места: зашифрованные сообщения нельзя ни прочитать, ни отправить. Освободите место и повторите попытку.",
    "cryptoUnavailableBanner.offLocked":
        "Шифрование на этом устройстве отключено, потому что его ключи всё ещё использовались уведомлением: зашифрованные сообщения нельзя ни прочитать, ни отправить.",
    "cryptoUnavailableBanner.offOther":
        "Шифрование на этом устройстве отключено: зашифрованные сообщения нельзя ни прочитать, ни отправить, а его ключи шифрования не были опубликованы.",
    "cryptoUnavailableBanner.tryAgain": "Повторить",
    "cryptoUnavailableBanner.freeUpSpaceFirst": "Сначала освободите место",
    "cryptoUnavailableBanner.syncPaused":
        "Не удалось запустить шифрование, поэтому этот сеанс прекратил синхронизацию, чтобы сохранить ключи шифрования, которые вам присылают другие. Перезагрузите, чтобы повторить.",
    "cryptoUnavailableBanner.dismissEncryptionWarning":
        "Скрыть предупреждение о шифровании",

    // src/lib/components/layout/SoundboardPopover.svelte, settings/SoundPackEditor.svelte
    "soundboard.title": "Звуковая панель",
    "soundboard.yourVolume": "Громкость ваших звуков",
    "soundboard.empty":
        "Звуков пока нет. Добавьте их в разделе «Настройки», «Эмодзи» или в настройках комнаты.",
    "soundboard.sendFailed": "Не удалось отправить этот звук в звонок.",
    "soundboard.add": "Добавить звук",
    "soundboard.limits": "Аудиофайлы до {seconds} с и {kb} КБ.",
    "soundboard.pack": "Набор",
    "soundboard.newPack": "Новый набор",
    "soundboard.packName": "Название набора",
    "soundboard.enterAPackName": "Введите название набора.",
    "soundboard.name": "Название звука",
    "soundboard.upload": "Загрузить звук",
    "soundboard.uploadFailed": "Не удалось загрузить звук.",
    "soundboard.removeFailed": "Не удалось удалить.",
    "soundboard.previewFailed": "Не удалось воспроизвести этот звук.",
    "soundboard.preview": "Прослушать",
    "soundboard.remove": "Удалить звук",
    "soundboard.noSounds": "В этом наборе нет звуков",
    "soundboard.deletePack": "Удалить набор",
    "soundboard.confirmDeletePack": "Удалить набор «{name}» и все его звуки?",
    "soundboard.inheritedFrom": "Из: {sourceName}",
    "soundboard.addToMine": "Добавить в мои",
    "soundboard.useEverywhere": "Использовать в каждом звонке",
    "soundboard.usedEverywhere": "В каждом звонке",
    "soundboard.useEverywhereHint":
        "Предлагать этот набор в ваших звонках во всех комнатах, а не только в этой.",
    "soundboard.globalFailed":
        "Не удалось изменить, где предлагается этот набор.",
    "soundboard.addedToYours":
        "{count, plural, one {Добавлен # звук в ваш набор.} few {Добавлено # звука в ваш набор.} many {Добавлено # звуков в ваш набор.} other {Добавлено # звука в ваш набор.}}",
    "soundboard.alreadyYours": "Уже в вашем наборе.",
    // src/lib/matrix/soundboard.ts
    "soundboard.badName":
        "Используйте от 1 до 100 букв, цифр, дефисов или подчёркиваний (A-Z, 0-9). Пробелы заменяются подчёркиваниями.",
    "soundboard.noPermission":
        "Вы не можете редактировать звуки в этой комнате.",
    "soundboard.notAudio": "Это не аудиофайл.",
    "soundboard.tooBig": "Файл слишком большой.",
    "soundboard.tooLong": "Звуки могут быть не длиннее {seconds} с.",
    "soundboard.unreadable": "Не удалось прочитать этот аудиофайл.",

    // src/lib/components/settings/CustomPackSettings.svelte
    "customPackSettings.add": "Добавить: {singular}",
    "customPackSettings.shortcode": "короткий код",
    "customPackSettings.sticker": "Стикер",
    "customPackSettings.remove": "Удалить: {toLowerCase}",
    "customPackSettings.image": "Изображение",
    "customPackSettings.chooseAtLeastOneUsage":
        "Выберите хотя бы одно применение.",
    "customPackSettings.uploadFailed": "Не удалось загрузить",
    "customPackSettings.failedToRemove": "Не удалось удалить: {singular}",
    "customPackSettings.failedToUpdateUsage": "Не удалось обновить применение",
    "customPackSettings.noCustomImages": "Нет своих изображений",
    "customPackSettings.noCustomEmojis": "Нет своих эмодзи",
    "customPackSettings.noCustomStickers": "Нет своих стикеров",

    // src/lib/components/debug/DebugEventItem.svelte
    "debugEventItem.stateKey": "state_key",
    "debugEventItem.empty": "(пусто)",
    "debugEventItem.redacted": "УДАЛЕНО",
    "debugEventItem.id": "id: {eventId}",

    // src/lib/components/debug/DebugPanel.svelte
    "debugPanel.debugPanel": "ПАНЕЛЬ ОТЛАДКИ",
    "debugPanel.sync": "Синхронизация:",
    "debugPanel.refresh": "↻ обновить",
    "debugPanel.copied": "скопировано",
    "debugPanel.copy": "⧉ копировать",
    "debugPanel.unreadState": "СОСТОЯНИЕ НЕПРОЧИТАННОГО",
    "debugPanel.unread": "непрочитано:",
    "debugPanel.highlight": "выделено:",
    "debugPanel.userid": "userId:",
    "debugPanel.readuptoid": "readUpToId:",
    "debugPanel.readidxInTimeline": "readIdx в ленте:",
    "debugPanel.noReceipt": "нет отметки",
    "debugPanel.n1NotInWindow": "-1 (не в окне!)",
    "debugPanel.events": "/ событий: {totalEvents}",
    "debugPanel.lastEventSender": "отправитель последнего события:",
    "debugPanel.me": "(я:",
    "debugPanel.notificationEventsAfterReadMarker":
        "события с уведомлением после маркера прочтения:",
    "debugPanel.from": "[{formatTs}] {getType} от {value} - {msgPreview}",
    "debugPanel.pushRules": "ПРАВИЛА УВЕДОМЛЕНИЙ",
    "debugPanel.default": "(по умолчанию)",
    "debugPanel.actions": "действия: {stringify}",
    "debugPanel.conditions": "условия: {stringify}",
    "debugPanel.noPushRulesFound": "правила уведомлений не найдены",
    "debugPanel.readReceiptsEventsWithReceipts":
        "ОТМЕТКИ О ПРОЧТЕНИИ (событий с отметками: {length})",
    "debugPanel.noReceipts": "нет отметок",
    "debugPanel.urlPreviewInspector": "ИНСПЕКТОР ПРЕДПРОСМОТРА ССЫЛОК",
    "debugPanel.https": "https://...",
    "debugPanel.storeMessagesWhatTheUiRenders":
        "СООБЩЕНИЯ В ХРАНИЛИЩЕ ({length}) - то, что показывает интерфейс",
    "debugPanel.redacted": "УДАЛЕНО",
    "debugPanel.rel": "rel={relType}",
    "debugPanel.empty": "пусто",
    "debugPanel.pendingEvents": "ОЖИДАЮЩИЕ СОБЫТИЯ ({length})",
    "debugPanel.rawTimelineEvents": "НЕОБРАБОТАННАЯ ЛЕНТА (событий: {length})",

    // src/lib/components/settings/GpuDebug.svelte
    "gpuDebug.title": "GPU",
    "gpuDebug.hardwareAcceleration": "Аппаратное ускорение",
    "gpuDebug.hardwareAccelerationHint":
        "Выключите, если видео чёрное или окно отрисовывается неправильно. Применяется после перезапуска.",
    "gpuDebug.gameAuto": "Отключать GPU на время игры",
    "gpuDebug.gameAutoHint":
        "Если GPU постоянно падает, пока идёт игра (игра занимает его память), Zam перезапускается без аппаратного ускорения и снова с ним после закрытия игры. Требуется определение игр в Настройки > Общие. Ждёт окончания звонка.",
    "gpuDebug.gameAutoActive": "Работа без GPU до закрытия игры.",
    "gpuDebug.nvidiaVideo": "Декодирование видео на NVIDIA",
    "gpuDebug.nvidiaVideoHint":
        "Декодирует видео на GPU NVIDIA через рендерер Vulkan в Chromium. «Автоматически» включает его, когда ваши экраны подключены к GPU NVIDIA. В Wayland Vulkan не используется, и «Автоматически» оставляет его выключенным; выбор Vulkan там пробует аппаратное декодирование через OpenGL (экспериментально).",
    "gpuDebug.nvidiaVideoActive": "Сейчас используется.",
    "gpuDebug.nvidiaVideoInactive": "Сейчас не используется.",
    "gpuDebug.nvidiaVideoFailed":
        "Zam вернулся к пути через GL после сбоя процесса GPU. Выберите Vulkan, чтобы попробовать снова.",
    "gpuDebug.nvidiaVideoAuto": "Автоматически",
    "gpuDebug.nvidiaVideoVulkan": "Vulkan",
    "gpuDebug.nvidiaVideoOff": "Выключено",
    "gpuDebug.restartToApply":
        "Перезапустите Zam, чтобы применить это изменение.",
    "gpuDebug.restart": "Перезапустить",
    "gpuDebug.videoDecoding": "Декодирование видео",
    "gpuDebug.decodeHardware": "Аппаратное",
    "gpuDebug.decodeSoftware": "Программное",
    "gpuDebug.decodeUnsupported": "Не поддерживается",
    "gpuDebug.videoEncode": "Аппаратное кодирование видео",
    "gpuDebug.videoEncodeHint":
        "Кодирует видео с камеры и демонстрации экрана на GPU (VA-API) для кодеков, которые поддерживает ваш драйвер. Выключите, если другие видят от вас чёрный, зависший или искажённый поток. Применяется после перезапуска.",
    "gpuDebug.videoEncoding": "Кодирование видео",
    "gpuDebug.videoEncodingHint":
        "В звонках отправляется кодек, выбранный в разделе «Голос и видео» (по умолчанию H.264). Панель статистики звонка показывает, какой кодировщик используется в звонке.",
    "gpuDebug.memoryReport": "Отчёт о памяти",
    "gpuDebug.memoryReportHint":
        "Показывает, сколько памяти используют процессы Zam, включая видеопамять в процессе GPU, и чем она занята. Измеряйте, когда на экране видна проблема, затем скопируйте отчёт в сообщение об ошибке.",
    "gpuDebug.repaint": "Перерисовать",
    "gpuDebug.repaintHint":
        "Перезапускает процесс GPU, и окно отрисовывается заново с нуля. Используйте, если части окна показываются чёрными или белыми прямоугольниками или не на своём месте, что бывает после нехватки видеопамяти. Звонки продолжаются. Также доступно в меню в трее.",
    "gpuDebug.memoryMeasure": "Измерить",
    "gpuDebug.memoryMeasuring": "Измерение…",
    "gpuDebug.memoryRecord": "Записывать память во времени",
    "gpuDebug.memoryRecordHint":
        "Снимает отчёт о памяти с заданным интервалом и продолжает работу при закрытых настройках, так что вы можете спокойно пользоваться Zam и вернуться позже. Показывает первый, наименьший, наибольший и последний размер каждого значения и сохраняет все замеры в CSV для построения графиков.",
    "gpuDebug.memoryRecordInterval": "Интервал",
    "gpuDebug.memoryRecordEvery": "Каждые {seconds} с",
    "gpuDebug.memoryRecordStart": "Записать",
    "gpuDebug.memoryRecordStop": "Остановить",
    "gpuDebug.memoryRecordStatus": "Замеров: {count} за {elapsed}",
    "gpuDebug.memoryRecordCsv": "Сохранить CSV",
    "gpuDebug.encodeTest": "Запустить тест кодирования H.264",
    "gpuDebug.encodeTestHint":
        "Кодирует по 60 кадров каждого размера так же, как это делает звонок. Аппаратное кодирование должно быть заметно быстрее программного на кадр.",
    "gpuDebug.encodeTestRejected": "Отклонено кодировщиком",
    "gpuDebug.encodeTestResult": "Фрагментов: {chunks}, {ms} мс на кадр",
    "gpuDebug.skiaGraphite": "Рендерер Skia Graphite (экспериментально)",
    "gpuDebug.skiaGraphiteHint":
        "Рисует интерфейс новым рендерером Graphite из Chromium вместо Ganesh. Включите, чтобы проверить отрисовку, или выключите, если окно мерцает или отрисовывается неправильно. Требует аппаратного ускорения. Применяется после перезапуска.",
    "gpuDebug.skiaGraphiteFailed":
        "Выключено автоматически, потому что не удалось запуститься или произошёл сбой процесса GPU. Включите снова, чтобы повторить.",
    "gpuDebug.nvidiaEncode": "Кодирование видео на NVIDIA (экспериментально)",
    "gpuDebug.nvidiaEncodeHint":
        "Кодирует звонки и демонстрации экрана в H.264 через NVENC с помощью собственного драйвера VA-API в Zam. Декодирование видео остаётся таким, как задано выше. Применяется после перезапуска.",
    "gpuDebug.featureStatus": "Состояние функций",
    "gpuDebug.details": "Подробности",
    "settingsNav.keybinds": "Горячие клавиши",
    "settingsSearch.keyboardShortcuts": "Сочетания клавиш",
    "keybinds.intro":
        "Нажмите на сочетание, чтобы изменить его, затем нажмите новые клавиши. Сочетания работают, пока Zam в фокусе. Для «рации» и «выключения по нажатию» можно использовать боковую кнопку мыши или одну клавишу-модификатор.",
    "keybinds.resetAll": "Сбросить все",
    "keybinds.removedFrom": "Эти клавиши сняты с: {actions}",
    "keybinds.changeFor": "Изменить сочетание для действия «{action}»",
    "keybinds.pressKey": "Нажмите клавиши… (Esc - отмена)",
    "keybinds.pressKeyOrButton":
        "Нажмите клавишу или кнопку мыши… (Esc - отмена)",
    "keybinds.notSet": "Не задано",
    "keybinds.clear": "Удалить сочетание",
    "keybinds.clearFor": "Удалить сочетание для действия «{action}»",
    "keybinds.reset": "Сбросить по умолчанию",
    "keybinds.resetFor": "Сбросить «{action}» на значение по умолчанию",
    "keybinds.pushToTalkHint":
        "Назначение клавиши включает режим «рации»: в звонках микрофон передаёт звук, только пока клавиша зажата.",
    "keybinds.pushToMuteHint": "Микрофон выключен, пока это сочетание зажато.",
    "keybinds.globalVoice": "Работать, когда Zam не в фокусе",
    "keybinds.globalVoiceHint":
        "«Рация», выключение микрофона по нажатию, переключение микрофона и переключение звука работают и тогда, когда вы в другом приложении. Zam слушает только назначенные им клавиши и не мешает другим приложениям получать их.",
    "keybinds.globalWayland":
        "Здесь недоступно: этот рабочий стол Wayland не предоставляет приложениям глобальные сочетания клавиш (портал GlobalShortcuts), поэтому голосовые сочетания работают, только пока Zam в фокусе.",
    "keybinds.globalPermission":
        "Сначала это нужно разрешить в macOS: включите Zam в разделе «Системные настройки» > «Конфиденциальность и безопасность» > «Универсальный доступ», затем вернитесь в Zam.",
    "keybinds.globalOpenSettings": "Открыть системные настройки",
    "keybinds.globalError":
        "Zam не смог начать отслеживать клавиши в других приложениях ({error}). Голосовые сочетания работают, пока Zam в фокусе.",
    "keybinds.globalPortalHint":
        "«Рация», выключение микрофона по нажатию, переключение микрофона и переключение звука работают и тогда, когда вы в другом приложении. В Wayland эти сочетания обрабатывает ваш рабочий стол: он может попросить вас подтвердить их или выбрать другие клавиши, а другие приложения перестанут получать эти клавиши.",
    "keybinds.globalPortalAssigned":
        "Клавиши, назначенные вашим рабочим столом:",
    "keybinds.globalPortalMouse":
        "Кнопки мыши нельзя сделать сочетаниями рабочего стола: выберите для них клавишу в настройках рабочего стола.",
    "keybinds.globalPortalConfigure": "Изменить в системных настройках",
    "keybinds.globalPortalError":
        "Рабочий стол не настроил сочетания клавиш ({error}). Выключите и снова включите это, чтобы повторить.",
    "keybinds.helpTitle": "Сочетания клавиш",
    "keybinds.customize": "Настроить",
    "keybinds.category.navigation": "Навигация",
    "keybinds.category.chat": "Чат",
    "keybinds.category.voice": "Голос и звонки",
    "keybinds.category.app": "Приложение",
    "keybinds.action.quickSwitcher": "Быстрый переход",
    "keybinds.action.prevChannel": "Предыдущий канал",
    "keybinds.action.nextChannel": "Следующий канал",
    "keybinds.action.prevUnreadChannel": "Предыдущий непрочитанный канал",
    "keybinds.action.nextUnreadChannel": "Следующий непрочитанный канал",
    "keybinds.action.prevMentionChannel": "Предыдущий канал с упоминаниями",
    "keybinds.action.nextMentionChannel": "Следующий канал с упоминаниями",
    "keybinds.action.prevServer": "Предыдущее пространство",
    "keybinds.action.nextServer": "Следующее пространство",
    "keybinds.action.navigateBack": "Назад",
    "keybinds.action.navigateForward": "Вперёд",
    "keybinds.action.previousTextChannel": "Вернуться к предыдущему каналу",
    "keybinds.action.returnToCall": "Вернуться к звонку",
    "keybinds.action.markChannelRead": "Отметить канал прочитанным",
    "keybinds.action.markServerRead": "Отметить пространство прочитанным",
    "keybinds.action.jumpToOldestUnread":
        "Перейти к самому старому непрочитанному сообщению",
    "keybinds.action.emojiPicker": "Выбор эмодзи",
    "keybinds.action.gifPicker": "Выбор GIF",
    "keybinds.action.stickerPicker": "Выбор стикеров",
    "keybinds.action.uploadFile": "Загрузить файл",
    "keybinds.action.search": "Поиск",
    "keybinds.action.togglePins": "Закреплённые сообщения",
    "keybinds.action.toggleInbox": "Входящие уведомления",
    "keybinds.action.toggleMembers": "Список участников",
    "keybinds.action.toggleMute": "Переключить микрофон",
    "keybinds.action.toggleDeafen": "Переключить звук",
    "keybinds.action.pushToTalk": "Рация",
    "keybinds.action.pushToMute": "Выключение микрофона по нажатию",
    "keybinds.action.answerCall": "Ответить на входящий звонок",
    "keybinds.action.declineCall": "Отклонить входящий звонок",
    "keybinds.action.startCall":
        "Начать звонок или присоединиться к нему в этой комнате",
    "keybinds.action.toggleCamera": "Переключить камеру",
    "keybinds.action.toggleScreenShare": "Переключить демонстрацию экрана",
    "keybinds.action.leaveCall": "Выйти из звонка",
    "keybinds.action.openSettings": "Открыть настройки",
    "keybinds.action.createDm": "Новый личный чат",
    "draftDm.intro": "Это начало вашей личной переписки с {name}.",
    "draftDm.lazyNote":
        "Ничего не создаётся, пока вы не отправите первое сообщение. Тогда {name} получит приглашение.",
    "draftDm.placeholder": "Сообщение для {name}",
    "draftDm.send": "Отправить",
    "draftDm.starting": "Начало разговора...",
    "draftDm.encrypted": "Будет использоваться сквозное шифрование",
    "draftDm.discard": "Отбросить черновик",
    "draftDm.couldNotStart": "Не удалось начать разговор",
    "keybinds.action.createOrJoinSpace":
        "Создать пространство или присоединиться к нему",
    "keybinds.action.shortcutsHelp": "Показать сочетания клавиш",
    "keybinds.action.toggleDebug": "Показать или скрыть панель отладки",
    "quickSwitcher.title": "Куда хотите перейти?",
    "quickSwitcher.placeholder":
        "Поиск по комнатам, личным чатам и пространствам",
    "quickSwitcher.recentAndUnread": "Недавние и непрочитанные",
    "quickSwitcher.noResults": "Совпадений нет",
    "quickSwitcher.mentioned": "Упоминание",
    "quickSwitcher.space": "Пространство",
    "quickSwitcher.home": "Дом",
    "quickSwitcher.hint": "↑↓ - перемещение, Enter - открыть, Esc - закрыть",

    // src/lib/components/settings/DebugSettings.svelte
    "debugSettings.developer": "Для разработчиков",
    "debugSettings.showAllEvents": "Показывать все события",
    "debugSettings.orderHints": "Подсказки порядка сообщений",
    "debugSettings.orderHintsHint":
        "Zam добавляет к вашим сообщениям подсказку о том, что было внизу вашей ленты, и размещает сообщения других пользователей Zam под тем, на которое они указывают. Если выключено, сообщения идут в порядке сервера, как в Element.",
    "debugSettings.stickyCallMembership": "Sticky-участие в звонках",
    "debugSettings.stickyCallMembershipHint":
        "Входить в звонки с помощью sticky-события m.rtc.member (MSC4354) вместо события состояния m.call.member. Клиенты, которые читают только события состояния, в том числе Zam до 1.51, не увидят вас в звонке. Применяется со следующего звонка.",
    "debugSettings.indexSync": "Синхронизация индекса сообщений",
    "debugSettings.indexSyncHint":
        "Записи поискового индекса обмениваются с вашими другими подтверждёнными сеансами. На обоих сеансах должна быть эта версия. Сеансы: подходящие / подтверждённые / все. Фрагменты: отправлено / получено.",
    "debugSettings.indexSyncOff":
        "Синхронизация индекса не работает: нужно включить индексацию зашифрованных комнат.",
    "debugSettings.indexSyncNow": "Синхронизировать сейчас",
    "debugSettings.indexSyncNever": "никогда",
    "debugSettings.indexSyncSessions": "Сеансы",
    "debugSettings.indexSyncAsked": "Запрошено",
    "debugSettings.indexSyncRoomsMissing": "Комнаты с пробелами",
    "debugSettings.indexSyncRequestsReceived": "Получено запросов",
    "debugSettings.indexSyncChunks": "Фрагменты",
    "debugSettings.indexSyncMerged": "Объединено записей",
    "debugSettings.displayEveryMatrixTimelineEventIn":
        "Показывать в ленте чата каждое событие временной шкалы Matrix.",
    "debugSettings.ignoreCodecSupport":
        "Игнорировать заявленную поддержку кодеков",
    "debugSettings.ignoreCodecSupportHint":
        "Отправлять выбранный кодек, даже если другие сообщают, что не могут его декодировать, и принимать все кодеки, которые перечисляет это устройство (включая заблокированные как неработающие). Для тестирования, например HEVC в Linux.",
    "debugSettings.h264ProfileFix": "Исправление профиля H.264 на GPU",
    "debugSettings.h264ProfileFixHint":
        "Звонки используют аппаратный кодировщик H.264 на GPU, даже если сервер отвечает профилем Constrained Baseline, который Chromium кодирует программно. Выключите, чтобы увидеть, какой кодировщик получает звонок без этого. В настольной версии для Windows флаг Chromium меняется после перезапуска.",
    "debugSettings.voiceProcessing": "Обработка голоса",
    "debugSettings.pauseGate": "Шумовой гейт для пауз",
    "debugSettings.pauseGateHint":
        "Дополнительно снижает уровень пауз на 20 дБ после шумоподавления. По умолчанию выключено; может обрезать тихое начало слов.",
    "debugSettings.noiseAttenuationLimit": "Предел шумоподавления: {value} дБ",
    "debugSettings.noiseAttenuationLimitHint":
        "Максимум, который шумовой фильтр (DeepFilterNet3 или DPDFNet) может убрать из любой части сигнала (по умолчанию {value}). 100 - без ограничений.",
    "debugSettings.soundboardInterval": "Интервал звуковой панели: {value} мс",
    "debugSettings.soundboardIntervalHint":
        "Наименьший промежуток между звуками звуковой панели одного человека. Звуки других, пришедшие быстрее, игнорируются (по умолчанию 1500).",
    "debugSettings.syncStatus": "Состояние синхронизации",
    "debugSettings.clientLogs": "Журналы клиента",
    "debugSettings.clientLogsHint":
        "Всё, что приложение записало в журнал с момента запуска, без токенов, паролей и ключей. Приложите это, когда сообщаете об ошибке.",
    "debugSettings.copyLogs": "Копировать журналы",
    "debugSettings.saveLogs": "Сохранить журналы",
    "debugSettings.clientLogsCopyFailed": "Не удалось скопировать журналы",
    "debugSettings.clientLogsSaveFailed": "Не удалось сохранить журналы",
    "debugSettings.webViewDebugging": "Отладка WebView",
    "debugSettings.webViewDebuggingHint":
        "Позволяет компьютеру, подключённому по USB, исследовать приложение через chrome://inspect. Остаётся включённым после перезапусков, пока вы не выключите.",
    "debugSettings.syncLog": "Журнал синхронизации",
    "debugSettings.syncLogEmpty":
        "Пока ничего не записано. Здесь появятся перезапуски, неудавшиеся запросы и сбросы временной шкалы.",
    "debugSettings.refresh": "Обновить",
    "debugSettings.copied": "Скопировано",
    "debugSettings.useSlidingSync": "Использовать sliding sync",
    "debugSettings.experimentalLoadsRoomsInAGrowing":
        "Экспериментально. Загружает комнаты растущим окном. Для применения приложение перезагрузится.",
    "debugSettings.pushStatus": "Состояние push-уведомлений",
    "debugSettings.lastError": "Последняя ошибка: {lastError}",
    "debugSettings.runDiagnostics": "Запустить диагностику",
    "debugSettings.homeserverPushers": "Pusher'ы домашнего сервера",
    "debugSettings.theHomeserverHasNoPushersRegistered":
        "На домашнем сервере для этой учётной записи нет зарегистрированных pusher'ов.",
    "debugSettings.aPusherMatchesTheConfiguredGateway":
        "Один из pusher'ов совпадает с настроенным URL шлюза.",
    "debugSettings.noPusherMatchesTheConfiguredGateway":
        "Ни один pusher не совпадает с настроенным URL шлюза.",
    "debugSettings.appId": "app_id: {app_id}",
    "debugSettings.none": "(нет)",
    "debugSettings.url": "url: {value}",
    "debugSettings.pushkey": "pushkey: {pushkeyPreview}",
    "debugSettings.webPushPwa": "Web Push (PWA)",
    "debugSettings.missing": "(отсутствует)",
    "debugSettings.vapidKey": "ключ VAPID: {value}",
    "debugSettings.permission": "разрешение: {permission}",
    "debugSettings.subscription": "подписка: {value}",
    "debugSettings.notFound": "не найдено",
    "debugSettings.homeserverPusher": "pusher домашнего сервера: {value}",
    "debugSettings.error": "ошибка: {error}",
    "debugSettings.gatewaySygnalFirebase": "Шлюз (Sygnal / Firebase)",
    "debugSettings.gatewayReachable": "Шлюз доступен",
    "debugSettings.gatewayNotReachable": "Шлюз недоступен",
    "debugSettings.nativeSessionPushEnrichment":
        "Нативный сеанс (обогащение push-уведомлений)",
    "debugSettings.homeserver": "домашний сервер: {value}",
    "debugSettings.user": "пользователь: {value}",
    "debugSettings.device": "устройство: {value}",
    "debugSettings.accessToken": "токен доступа: {value}",
    "debugSettings.hideMessageText": "скрывать текст сообщений: {value}",
    "debugSettings.notificationRulesServer": "Правила уведомлений (сервер)",
    "debugSettings.syncMode": "Режим синхронизации",
    "debugSettings.slidingSyncMsc4186": "Sliding sync (MSC4186)",
    "debugSettings.classicSyncV2": "Классический /sync (v2)",
    "debugSettings.syncState": "Состояние синхронизации",
    "debugSettings.fallback": "Запасной вариант",
    "debugSettings.slidingSyncEndpoint": "Конечная точка sliding sync",
    "debugSettings.joinedRoomsLoaded":
        "Загружено комнат, в которых вы состоите",
    "debugSettings.roomListWindow": "Окно списка комнат",
    "debugSettings.of": "{requested} из {total}",
    "debugSettings.platform": "Платформа",
    "debugSettings.nativeCapacitor": "Нативная (Capacitor)",
    "debugSettings.pushEnabledInBuild": "Push включены в сборке",
    "debugSettings.yes": "Да",
    "debugSettings.no": "Нет",
    "debugSettings.hideUpdatePrompts": "Скрывать запросы на обновление",
    "debugSettings.hideUpdatePromptsHint":
        "Отключает баннер и всплывающее уведомление об обновлении. Обновления по-прежнему проверяются и устанавливаются сами, если включены автоматические обновления.",
    "debugSettings.gatewayUrl": "URL шлюза",
    "debugSettings.appId2": "ID приложения",
    "debugSettings.notificationPermission": "Разрешение на уведомления",
    "debugSettings.fcmToken": "Токен FCM",
    "debugSettings.pushProvider": "Провайдер push-уведомлений",
    "debugSettings.unifiedPushDistributor": "Дистрибьютор UnifiedPush",
    "debugSettings.unifiedPushEndpoint": "Конечная точка UnifiedPush",
    "debugSettings.unifiedPushGateway": "Шлюз UnifiedPush",
    "debugSettings.pusherRegisteredThisSession":
        "Pusher зарегистрирован в этом сеансе",
    "debugSettings.failedToFetchPushersFromHomeserver":
        "Не удалось получить pusher'ы с домашнего сервера.",
    "debugSettings.set": "задан",
    "debugSettings.active": "активен",
    "debugSettings.allNotificationsMasterRule":
        "Все уведомления (главное правило)",

    // src/lib/components/ui/EmojiPicker.svelte
    "emojiPicker.searchEmoji": "Поиск эмодзи…",
    "emojiPicker.searchEmoji2": "Поиск эмодзи",
    "emojiPicker.myEmojis": "Мои эмодзи",
    "emojiPicker.custom": "Свои",
    "emojiPicker.standard": "Стандартные",
    "emojiPicker.myEmojis2": "Мои эмодзи",

    // src/lib/components/ui/ErrorToasts.svelte
    "errorToasts.dismiss": "Скрыть",

    // src/lib/components/settings/ExtendedProfileDebug.svelte
    "extendedProfileDebug.extendedProfile": "Расширенный профиль",
    "extendedProfileDebug.fetchFromServer": "Получить с сервера",
    "extendedProfileDebug.thisServerDoesNotSupportExtended":
        "Этот сервер не поддерживает расширенные профили.",
    "extendedProfileDebug.noneOrTheServerRefused": "нет, или сервер отказал",
    "extendedProfileDebug.presenceGetPresenceStraightFromThe":
        "Присутствие (GET /presence, прямо с сервера): {value}",
    "extendedProfileDebug.notAdvertisedNoRestrictions":
        "не объявлено (без ограничений)",
    "extendedProfileDebug.serverRulesForFieldsMProfile":
        "Правила сервера для полей (m.profile_fields): {value}",
    "extendedProfileDebug.failedToFetchTheProfile":
        "Не удалось получить профиль",
    "extendedProfileDebug.couldNotCopyToClipboard":
        "Не удалось скопировать в буфер обмена",

    // src/lib/components/ui/FlashEmbed.svelte
    "flashEmbed.suspend": "Приостановить",
    "flashEmbed.resize": "Изменить размер плеера",
    "flashEmbed.resizeHint":
        "Перетащите или используйте клавиши со стрелками, чтобы изменить размер. Дважды щёлкните для сброса.",

    // src/lib/components/messages/ForwardMessageDialog.svelte
    "forwardMessageDialog.forwardMessage": "Переслать сообщение",
    "forwardMessageDialog.searchRooms": "Поиск комнат",
    "forwardMessageDialog.noJoinedRoomsFound":
        "Комнаты, в которых вы состоите, не найдены",
    "forwardMessageDialog.forwarding": "Пересылка…",
    "forwardMessageDialog.forward": "Переслать",
    "forwardMessageDialog.failedToForwardMessage":
        "Не удалось переслать сообщение",

    // src/lib/components/settings/GeneralSettings.svelte
    "generalSettings.desktop": "Рабочий стол",
    "proxySettings.network": "Сеть",
    "proxySettings.proxy": "Прокси",
    "proxySettings.modeSystem": "Использовать системные настройки",
    "proxySettings.modeDirect": "Без прокси",
    "proxySettings.modeManual": "Вручную",
    "proxySettings.modePac": "Автоматическая настройка (PAC)",
    "proxySettings.launchFlagsInUse": "Используются флаги запуска:",
    "proxySettings.server": "Прокси-сервер",
    "proxySettings.serverHint":
        "socks5://, socks4://, http:// или https:// с хостом и портом. Для Tor обычно socks5://127.0.0.1:9050.",
    "proxySettings.bypass": "Не использовать прокси для",
    "proxySettings.pacUrl": "URL файла PAC",
    "proxySettings.calls": "Звонки",
    "proxySettings.callsDefault":
        "По умолчанию (UDP напрямую, TCP через прокси)",
    "proxySettings.callsDirect": "Подключаться к серверам звонков напрямую",
    "proxySettings.callsProxy": "Только через прокси",
    "proxySettings.callsDefaultHint":
        "UDP через прокси не передаётся, поэтому звук звонка обычно идёт напрямую и проходит через прокси, только когда звонку приходится переключиться на TCP.",
    "proxySettings.callsDirectHint":
        "Весь звонок обходит прокси: присоединение, соединение с сервером звонков, а также аудио и видео по UDP или TCP. Всё остальное по-прежнему использует прокси. Серверы звонков видят ваш IP-адрес.",
    "proxySettings.callsProxyHint":
        "Никаких прямых соединений, и серверы звонков никогда не видят ваш IP-адрес: звонки идут через прокси к TURN-ретранслятору сервера звонков по TCP или TLS. Если сервер не предоставляет TURN-ретранслятор, звонки не подключатся. Ожидайте большей задержки.",
    "proxySettings.callsDirectUnavailable":
        "Звонки не могут обходить системные настройки прокси. Чтобы это работало, задайте прокси здесь (вручную или PAC).",
    "proxySettings.callsDirectAddresses": "Отправляется напрямую:",
    "proxySettings.save": "Сохранить",
    "proxySettings.saved": "Сохранено",
    "proxySettings.applyFailed": "Не удалось применить: {error}",
    "generalSettings.minimiseToTrayOnClose": "Сворачивать в трей при закрытии",
    "generalSettings.keepZamRunningInTheSystem":
        "При закрытии окна оставлять Zam работать в системном трее, а не завершать его. Чтобы снова открыть или завершить, используйте значок в трее.",
    "generalSettings.runAtStartup": "Запускать при старте системы",
    "generalSettings.startZamWhenYouLogIn":
        "Запускать Zam при входе в систему на компьютере.",
    "generalSettings.runAtStartupFailed": "Ваша система этого не разрешила.",
    "generalSettings.noGeneralSettingsAreAvailableOn":
        "На этой платформе нет общих настроек.",

    // src/lib/components/settings/RichPresenceSettings.svelte
    "richPresence.heading": "Расширенный статус",
    "richPresence.share": "Делиться тем, что вы делаете",
    "richPresence.shareHint":
        "Позволяет приложениям на этом компьютере показывать в вашем профиле, во что вы играете или что слушаете. По умолчанию разрешены все приложения; ненужные отключите ниже.",
    "richPresence.arrpc": "Приложения, использующие Discord Rich Presence",
    "richPresence.arrpcHint":
        "Также принимать приложения, которые сообщают в Discord. Если Discord запущен, приложения обычно сообщают сначала ему, поэтому лучше всего это работает при закрытом Discord.",
    "richPresence.scan": "Определять игры",
    "richPresence.scanHint":
        "Искать запущенные игры на этом компьютере, чтобы показывались и те, что ничего не сообщают. Для этого раз в несколько секунд считывается список запущенных программ.",
    "richPresence.scanNeedsPermission":
        "Песочница Flatpak не видит другие программы. Чтобы разрешить Zam искать игры, выполните эту команду, затем перезапустите Zam:",
    "richPresence.scanGrantCommand":
        "flatpak override --user --talk-name=org.freedesktop.Flatpak moe.crafty.matrix",
    "richPresence.scanFailed": "Не удалось найти игры: {error}",
    "richPresence.media": "Сообщать о воспроизведении медиа",
    "richPresence.mediaHint":
        "Показывать песню или видео, которые воспроизводит медиаплеер на этом компьютере, по данным системы о текущем воспроизведении. Когда это включено, каждый плеер по умолчанию разрешён; ненужные отключите ниже.",
    "richPresence.mediaFailed":
        "Не удалось считать воспроизведение медиа: {error}",
    "richPresence.socket": "Также прослушивается {path}.",
    "richPresence.arrpcNeedsShare": "Сначала включите передачу.",
    "richPresence.listening": "Ожидание приложений на порту {port}.",
    "richPresence.listenFailed": "Не удалось начать прослушивание: {error}",
    "richPresence.arrpcFailed": "Не удалось запустить arRPC: {error}",
    "richPresence.hostNeedsPermission":
        "Песочница Flatpak не может управлять другими программами. Чтобы разрешить это Zam, выполните эту команду, затем перезапустите Zam:",
    "richPresence.fake": "Притворяться, что Discord запущен",
    "richPresence.fakeHint":
        "Некоторые приложения отказываются отправлять Rich Presence, если не запущен процесс с именем Discord. Это запускает простаивающий процесс, только пока сам Discord не запущен.",
    "richPresence.fakeFailed": "Не удалось запустить: {error}",
    "richPresence.discordFirst":
        "Discord запустился раньше Zam, поэтому приложения сообщают в Discord, а Zam их не видит.",
    "richPresence.restartDiscord": "Перезапустить Discord",
    "richPresence.restartDiscordTitle": "Перезапустить Discord?",
    "richPresence.restartDiscordBody":
        "Discord закроется и откроется снова, что завершит любой звонок или трансляцию, в которых вы участвуете. Zam займёт первое место, чтобы приложения сообщали ему, и передаст то, что они сообщают, в Discord.",
    "richPresence.restartDiscordFailed":
        "Не удалось перезапустить Discord: {error}",
    "richPresence.autoRestart": "Перезапускать Discord автоматически",
    "richPresence.autoRestartHint":
        "Когда Zam запускается, а Discord уже работает, закрывать и снова открывать Discord, чтобы приложения сообщали Zam. Это завершит любой звонок или трансляцию, в которых вы участвуете. Происходит один раз при каждом запуске Zam.",
    "richPresence.publishFailed": "Не удалось обновить ваш профиль.",
    "richPresence.gameList": "Список игр: {count}, обновлён {when}",
    "richPresence.gameListDownloading": "Загрузка списка игр из Discord…",
    "richPresence.gameListFailed": "Не удалось загрузить список игр: {error}",
    "richPresence.addedGames": "Зарегистрированные игры",
    "richPresence.addedGamesHint":
        "Найденные запущенными игры, приложения и медиаплееры, а также программы, которые вы добавили сами. Каждая по умолчанию разрешена в вашем профиле; ненужные отключите. Игры находятся, только пока включено «Определять игры», а медиаплееры - только пока включено «Сообщать о воспроизведении медиа».",
    "richPresence.addGame": "Добавить игру",
    "richPresence.pickProgram": "Выберите запущенную программу",
    "richPresence.searchPrograms": "Поиск запущенных программ",
    "richPresence.noPrograms": "Запущенные программы не найдены.",
    "richPresence.gameName": "Название в вашем профиле",
    "richPresence.refreshPrograms": "Обновить",
    "richPresence.lastPlayed": "Последний раз играли: {when}",
    "richPresence.neverPlayed": "Ещё не играли",
    "richPresence.apps": "Приложения",
    "richPresence.noApps":
        "Ни одно приложение пока ничего не сообщало. Те, что сообщат, появятся здесь и будут разрешены, пока вы их не отключите.",
    "richPresence.allowApp": "Разрешить {name}",
    "richPresence.forgetApp": "Забыть {name}",
    "richPresence.forget": "Забыть",
    "richPresence.viaDiscord": "Игра или Discord Rich Presence",
    "richPresence.viaMatrix": "Приложение Matrix",
    "richPresence.viaScan": "Сканирование процессов",
    "richPresence.viaRpc": "Discord Rich Presence",
    "richPresence.viaMedia": "Медиаплеер",
    "richPresence.viaPlugin": "Плагин",
    "richPresence.blocked": "Заблокировано",
    "richPresence.allowed": "Разрешено",

    // src/lib/components/ui/RichPresenceCard.svelte
    "richPresenceCard.playing": "Играет в {name}",
    "richPresence.sharingTitle": "Показывается в вашем профиле",
    "richPresenceCard.listening": "Слушает {name}",
    "richPresenceCard.elapsed": "Прошло {time}",
    "richPresenceCard.remaining": "Осталось {time}",
    "richPresenceCard.openLinkTitle": "Открыть эту ссылку?",
    "richPresenceCard.openLinkBody":
        "{name} просит открыть этот адрес в вашем браузере:",
    "richPresenceCard.openidWarning":
        "Эта ссылка также содержит токен OpenID вашей учётной записи Matrix. Сайт может использовать его, чтобы узнать ваш Matrix ID и домашний сервер, а также увидит ваш IP-адрес.",
    "richPresenceCard.open": "Открыть",
    "richPresenceCard.openFailed": "Не удалось получить токен OpenID.",

    // src/lib/components/ui/GifPicker.svelte
    "gifPicker.searchFavourites": "Поиск по избранному…",
    "gifPicker.searchKlipy": "Поиск в KLIPY…",
    "gifPicker.searchFavourites2": "Поиск по избранному",
    "gifPicker.searchGifs": "Поиск GIF",
    "gifPicker.gifResults": "Результаты GIF",
    "gifPicker.noFavouriteGifsYetStarA":
        "Избранных GIF пока нет. Отметьте GIF звёздочкой, чтобы сохранить его здесь.",
    "gifPicker.favourites": "Избранное",
    "gifPicker.gifTagged": "GIF с тегами: {join}",
    "gifPicker.favouriteGif": "Избранный GIF {value}",
    "gifPicker.editTags": "Изменить теги",
    "gifPicker.catFunny": "кот, смешное",
    "gifPicker.commaSeparatedEnterToSave": "Через запятую · Enter - сохранить",
    "gifPicker.trending": "Популярное",
    "gifPicker.gifResult": "Результат GIF {value}",
    "gifPicker.favourite": "В избранное",
    "gifPicker.poweredByKlipy": "Работает на KLIPY",

    // src/lib/components/layout/ImagePackEditor.svelte
    "imagePackEditor.addImage": "Добавить изображение",
    "imagePackEditor.newPack": "Новый набор",
    "imagePackEditor.packName": "Название набора",
    "imagePackEditor.shortcode": "короткий код",
    "imagePackEditor.useAsEmoji": "Использовать как эмодзи",
    "imagePackEditor.useAsSticker": "Использовать как стикер",
    "imagePackEditor.inheritedFrom": "Унаследовано от {sourceName}",
    "imagePackEditor.sticker": "Стикер",
    "imagePackEditor.removeImage": "Удалить изображение",
    "imagePackEditor.noCustomImages": "Нет своих изображений",
    "imagePackEditor.emotes": "Эмодзи ({value})",
    "imagePackEditor.room": "Комната",
    "imagePackEditor.chooseAtLeastOneUsage":
        "Выберите хотя бы одно применение.",
    "imagePackEditor.enterAPackName": "Введите название набора.",
    "imagePackEditor.uploadFailed": "Не удалось загрузить",
    "imagePackEditor.failedToUpdateUsage": "Не удалось обновить применение",
    "imagePackEditor.failedToRemoveImage": "Не удалось удалить изображение",
    "imagePackEditor.failedToUpdatePack": "Не удалось обновить набор",
    "imagePackEditor.addToMine": "Добавить в мои",
    "imagePackEditor.addAllToMyPack":
        "Скопировать все изображения этого набора в ваш набор",
    "imagePackEditor.addImageToMyPack":
        "Скопировать это изображение в ваш набор",
    "imagePackEditor.addedToYourPack":
        "{count, plural, one {Добавлено # изображение в ваш набор.} few {Добавлено # изображения в ваш набор.} many {Добавлено # изображений в ваш набор.} other {Добавлено # изображения в ваш набор.}}",
    "imagePackEditor.alreadyInYourPack": "Уже в вашем наборе.",
    "imagePackEditor.editDetails": "Изменить сведения",
    "imagePackEditor.deletePack": "Удалить набор",
    "imagePackEditor.confirmDeletePack":
        "Удалить набор «{name}» и все его изображения?",
    "imagePackEditor.useInAllRooms": "Использовать во всех моих комнатах",
    "imagePackEditor.useInAllRoomsHint":
        "Его эмодзи и стикеры будут доступны везде, где вы общаетесь.",
    "imagePackEditor.attribution": "Автор: {value}",
    "imagePackEditor.attributionPlaceholder":
        "Автор / указание авторства (необязательно)",
    "imagePackEditor.uploadPackAvatar": "Загрузить значок набора",
    "imagePackEditor.removePackAvatar": "Удалить значок",
    "imagePackEditor.avatarReady":
        "Значок загружен, сохраните, чтобы применить.",
    "sharedPackSettings.yourPackDetails": "Сведения о вашем наборе",
    "sharedPackSettings.enabledEverywhere":
        "Наборы, включённые во всех комнатах",
    "sharedPackSettings.enabledEverywhereHint":
        "Наборы из комнат, в которых вы состоите, можно использовать в любой комнате, а не только в той, которой они принадлежат.",
    "sharedPackSettings.availableInYourRooms": "Наборы в ваших комнатах",
    "sharedPackSettings.searchPacks": "Поиск наборов",
    "sharedPackSettings.noPacksFound": "Наборы не найдены",
    "sharedPackSettings.noneEnabled":
        "Нет наборов, включённых во всех комнатах",
    "sharedPackSettings.enable": "Использовать везде",
    "sharedPackSettings.disable": "Не использовать везде",
    "sharedPackSettings.remove": "Удалить",
    "sharedPackSettings.unavailable":
        "Недоступно: вы больше не состоите в комнате {room} или набор был удалён",
    "sharedPackSettings.packSummary":
        "{room}, {count, plural, one {# изображение} few {# изображения} many {# изображений} other {# изображения}}",
    "sharedPackSettings.failedToSave": "Не удалось сохранить",

    // src/lib/components/layout/InboxPanel.svelte
    "inboxPanel.inbox": "Входящие",
    "inboxPanel.noPendingInvites": "Нет ожидающих приглашений",
    "inboxPanel.roomInvitesWillAppearHere":
        "Приглашения в комнаты появятся здесь.",
    "inboxPanel.pendingInvites": "Ожидающих приглашений: {length}",
    "inboxPanel.invitedBy": "Пригласил(а): {sender}",
    "inboxPanel.ignore": "Игнорировать",
    "inboxPanel.accept": "Принять",
    "inboxPanel.pendingJoinRequests":
        "Ожидающих запросов на вступление: {length}",
    "inboxPanel.youAskedToJoinWaitingFor":
        "Вы запросили вступление - ждём, пока кто-нибудь вас впустит.",
    "inboxPanel.cancelRequest": "Отменить запрос",
    "inboxPanel.failedToAcceptInvite": "Не удалось принять приглашение",
    "inboxPanel.failedToRejectInvite": "Не удалось отклонить приглашение",
    "inboxPanel.failedToCancelJoinRequest":
        "Не удалось отменить запрос на вступление",

    // src/lib/components/layout/IncomingCallCard.svelte
    "incomingCallCard.incomingCall": "Входящий звонок",
    "incomingCallCard.declineCallFrom": "Отклонить звонок от {name}",
    "incomingCallCard.accept": "Принять",
    "incomingCallCard.acceptCallFrom": "Принять звонок от {name}",
    "incomingCallCard.unknown": "Неизвестно",

    // src/lib/components/layout/InvitePanel.svelte
    "invitePanel.invitePeopleTo": "Пригласить людей в",
    "invitePanel.invited": "Приглашён",
    "invitePanel.failed": "Не удалось",
    "invitePanel.inviteByEmail": "Пригласить по электронной почте",
    "invitePanel.nameExampleCom": "name@example.com",
    "invitePanel.inviting": "Приглашение…",
    "invitePanel.invite": "Пригласить",
    "invitePanel.invite2": "Пригласить: {length}",
    "invitePanel.enterAValidEmailAddress":
        "Введите действительный адрес электронной почты.",
    "invitePanel.couldNotSendTheEmailInvite":
        "Не удалось отправить приглашение по электронной почте",
    "invitePanel.couldNotSendTheInvite": "Не удалось отправить приглашение",
    "invitePanel.thisRoom": "эту комнату",
    "invitePanel.thisSpace": "это пространство",

    // src/lib/components/layout/JoinConsentDialog.svelte
    "joinConsentDialog.joinThisRoom": "Присоединиться к этой комнате?",
    "joinConsentDialog.youClickedALinkTo": "Вы нажали на ссылку на",
    "joinConsentDialog.joiningSharesYourMatrixIdWith":
        ". При вступлении ваш Matrix ID становится виден всем в комнате, а комната добавляется в ваш список комнат.",
    "joinConsentDialog.thisOpensRoom": "Откроется комната",
    "joinConsentDialog.warningThisLinkPointsAtA":
        "Внимание: эта ссылка указывает на другой сервер, а не на тот, где находится комната. Продолжайте, только если доверяете отправителю.",
    "joinConsentDialog.joinRoom": "Присоединиться к комнате",

    // src/lib/components/ui/Lightbox.svelte
    "lightbox.closeViewer": "Закрыть просмотр: {mediaNoun}",
    "lightbox.viewer": "Просмотр: {MediaNoun}{value}",
    "lightbox.download": "Скачать",
    "lightbox.previous": "Назад",
    "lightbox.previous2": "Предыдущий объект: {mediaNoun}",
    "lightbox.next": "Далее",
    "lightbox.next2": "Следующий объект: {mediaNoun}",
    "lightbox.couldNotLoadThisVideoUse":
        "Не удалось загрузить это видео. Нажмите «Скачать», чтобы сохранить его.",
    "lightbox.video": "Видео",
    "lightbox.image": "Изображение",
    "lightbox.videoNoun": "видео",
    "lightbox.imageNoun": "изображение",
    "lightbox.zoomIn": "Увеличить",
    "lightbox.zoomOut": "Уменьшить",
    "lightbox.zoomReset": "Сбросить масштаб",

    // src/lib/components/messages/LinkPreview.svelte
    "linkPreview.youtubeVideo": "Видео YouTube",
    "linkPreview.xTwitter": "X / Twitter",
    "linkPreview.loadingItContactsTheSiteHosting":
        "Загрузка обращается к сайту, на котором оно размещено, и раскрывает ваш IP-адрес",
    "linkPreview.loadPreviewMedia": "Загрузить медиа предпросмотра",
    "linkPreview.playVideo": "Воспроизвести видео",

    // src/lib/components/layout/LiveLocationBanner.svelte
    "liveLocationBanner.openMap": "Открыть карту",
    "liveLocationBanner.sharingLiveLocation":
        "Вы делитесь местоположением в реальном времени",
    "liveLocationBanner.lastUpdatedAt":
        " · обновлено в {timeOnly} ({updatedAgoLabel})",
    "liveLocationBanner.map": "Карта",
    "liveLocationBanner.isSharingLiveLocation":
        "{getMemberName} делится местоположением в реальном времени",
    "liveLocationBanner.peopleSharingLiveLocation":
        "Делятся местоположением в реальном времени: {length}",
    "liveLocationBanner.viewMap": "Показать карту",

    // src/lib/components/layout/LiveLocationMapView.svelte
    "liveLocationMapView.back": "Назад",
    "liveLocationMapView.liveLocation": "Местоположение в реальном времени",
    "liveLocationMapView.recenter": "Вернуться к себе",
    "liveLocationMapView.waitingForALocationFix":
        "Ожидание определения местоположения…",
    "liveLocationMapView.sharingLiveLocation":
        "Вы делитесь местоположением в реальном времени",
    "liveLocationMapView.lastUpdatedAt":
        "обновлено в {timeOnly} ({updatedAgoLabel})",
    "liveLocationMapView.osm": "OSM",
    "liveLocationMapView.noActiveLiveSharesInThis":
        "В этой комнате нет активных трансляций местоположения.",
    "liveLocationMapView.you": "Вы",

    // src/lib/components/messages/LocationBody.svelte
    "locationBody.openstreetmap": "OpenStreetMap",
    "locationBody.googleMaps": "Google Maps",

    // src/lib/components/layout/LoginView.svelte
    "loginView.signIn": "Вход",
    "loginView.register": "Регистрация",
    "loginView.zam": "Zam - {value}",
    "loginView.addAnAccount": "Добавить учётную запись",
    "loginView.welcomeBack": "С возвращением!",
    "loginView.signInWithAnotherMatrixAccount":
        "Войти с другой учётной записью Matrix",
    "loginView.signInToYourMatrixAccount":
        "Войдите в свою учётную запись Matrix",
    "loginView.createAnAccount": "Создать учётную запись",
    "loginView.registerOnAMatrixHomeserver":
        "Зарегистрироваться на домашнем сервере Matrix",
    "loginView.homeserver": "Домашний сервер",
    "loginView.username": "Имя пользователя",
    "loginView.password": "Пароль",
    "loginView.registrationToken": "Токен регистрации",
    "loginView.ifRequired": "(если требуется)",
    "loginView.leaveBlankIfNotRequired": "Оставьте пустым, если не требуется",
    "loginView.useSlidingSync": "Использовать sliding sync",
    "loginView.fasterStartupOnServersThatSupport":
        "Более быстрый запуск на серверах, которые это поддерживают.",
    "loginView.pleaseWait": "Подождите…",
    "loginView.logIn": "Войти",
    "loginView.createAccount": "Создать учётную запись",
    "loginView.donTHaveAnAccount": "Нет учётной записи?",
    "loginView.alreadyHaveAnAccount": "Уже есть учётная запись?",
    "loginView.signIn2": "Войти",
    "loginView.backTo": "← Назад к {activeUserId}",
    "loginView.orContinueAs": "Или продолжить как",
    "loginView.yourCredentialsAreSentDirectlyTo":
        "Ваши учётные данные отправляются напрямую на ваш домашний сервер и не хранятся этим приложением нигде, кроме вашего устройства.",
    "loginView.loggingIn": "Вход…",
    "loginView.loginFailedCheckYourCredentials":
        "Не удалось войти. Проверьте учётные данные.",
    "loginView.creatingAccount": "Создание учётной записи…",
    "loginView.registrationFailed": "Не удалось зарегистрироваться.",
    "loginView.or": "или",
    "loginView.continueWithSso": "Продолжить через SSO",
    "loginView.continueWith": "Продолжить через {name}",
    "loginView.redirectingToSso": "Перенаправление к вашему провайдеру входа…",
    "loginView.finishSsoInBrowser":
        "Завершите вход в браузере, затем вернитесь сюда.",
    "loginView.ssoCouldNotBeVerified":
        "Не удалось подтвердить единый вход. Попробуйте ещё раз.",
    "loginView.ssoFailed": "Не удалось выполнить единый вход.",
    "loginView.continue": "Продолжить",
    "loginView.signInOnProviderPage":
        "Вы войдёте на странице вашего домашнего сервера, затем вернётесь сюда.",
    "loginView.oauthCancelled": "Вход отменён.",
    "loginView.oauthDenied": "Провайдер входа отклонил запрос: {reason}",
    "loginView.oauthCouldNotBeVerified":
        "Не удалось подтвердить вход. Попробуйте ещё раз.",
    "loginView.oauthFailed": "Не удалось войти. Попробуйте ещё раз.",
    "loginView.oauthRegistrationRefused":
        "Этот сервер не позволил Zam зарегистрироваться для входа.",
    "loginView.oauthRegistrationRefusedFallback":
        "Этот сервер не позволил Zam зарегистрироваться для входа. Воспользуйтесь одним из других вариантов ниже.",
    "loginView.checkingServer": "Проверка сервера…",
    "loginView.homeserverHint":
        "Сервер, на котором находится ваша учётная запись: часть после двоеточия в @you:server.",
    "loginView.homeserverHintRegister":
        "Ваша учётная запись будет на этом сервере. Не уверены? matrix.org бесплатен и открыт для всех.",
    "loginView.oauthLoginExplainer":
        "{server} выполняет вход на странице своей учётной записи. Zam открывает её, и вы сразу возвращаетесь сюда уже со входом.",
    "loginView.oauthRegisterExplainer":
        "{server} создаёт новые учётные записи на странице своей учётной записи. Zam открывает её; выберите там имя пользователя и пароль, и вы сразу вернётесь сюда уже со входом.",
    "loginView.continueTo": "Перейти на {host}",
    "loginView.createAccountOn": "Создать учётную запись на {server}",
    "loginView.advancedOptions": "Дополнительные параметры",

    // src/lib/components/layout/EncryptionSetupDialog.svelte
    "encryptionSetup.setupTitle": "Защитите свои сообщения",
    "encryptionSetup.setupBody":
        "Ваши личные чаты защищены сквозным шифрованием. Настройте восстановление, чтобы читать их на любом устройстве, на которое вы войдёте позже, даже если потеряете это. Это займёт несколько секунд.",
    "encryptionSetup.passwordBody":
        "Введите пароль от учётной записи, чтобы подтвердить, что это вы.",
    "encryptionSetup.setUp": "Настроить восстановление",
    "encryptionSetup.later": "Не сейчас",
    "encryptionSetup.saveKeyTitle": "Сохраните ключ восстановления",
    "encryptionSetup.saveKeyBody":
        "Этот ключ открывает ваши зашифрованные сообщения на новом устройстве. Он показывается только один раз: сохраните его в менеджере паролей или скачайте. Без него потеря устройства может привести к потере сообщений.",
    "encryptionSetup.downloadKey": "Скачать",
    "encryptionSetup.keyFileHeader": "Ключ восстановления Zam для {userId}",
    "encryptionSetup.doneTitle": "Всё готово",
    "encryptionSetup.doneBody":
        "Шифрование на этом устройстве настроено. Здесь доступны ваши сообщения и история с других устройств.",
    "encryptionSetup.confirmTitle": "Подтвердите, что это вы",
    "encryptionSetup.confirmBody":
        "Эта учётная запись уже использует шифрование. Подтвердите это новое устройство, чтобы оно могло читать ваши зашифрованные сообщения и историю.",
    "encryptionSetup.useAnotherDevice": "Использовать другое устройство",
    "encryptionSetup.useRecoveryKey": "Использовать ключ восстановления",
    "encryptionSetup.anotherDeviceHint":
        "Другое устройство - это то, на котором вы уже вошли, например приложение Zam или Element на телефоне. На нём появится запрос, который нужно одобрить.",
    "encryptionSetup.recoveryKeyHint":
        "Ваш ключ восстановления начинается с «EsT». Вы сохранили его при первой настройке шифрования.",
    "encryptionSetup.cantConfirm":
        "Потеряли ключ восстановления и другие устройства?",
    "encryptionSetup.enterKeyTitle": "Введите ключ восстановления",
    "encryptionSetup.enterKeyBody":
        "Вставьте ключ восстановления, который вы сохранили при настройке шифрования. Пробелы не важны.",
    "encryptionSetup.enterPassphraseBody":
        "Введите парольную фразу восстановления, которую вы выбрали при настройке шифрования.",
    "encryptionSetup.back": "Назад",
    "encryptionSetup.connectBackupTitle": "Восстановите историю сообщений",
    "encryptionSetup.connectBackupBody":
        "Это устройство подтверждено, но ещё не подключено к резервной копии зашифрованных сообщений. Введите ключ восстановления, чтобы восстановить историю.",
    "encryptionSetup.checking": "Проверка шифрования…",
    "encryptionSetup.tryAgain": "Повторить",
    "encryptionSetup.openSecuritySettings": "Открыть настройки безопасности",

    // src/lib/matrix/registration.ts
    "registration.cancelled": "Создание учётной записи отменено.",
    "registration.noSupportedFlow":
        "Этот сервер требует шаг регистрации, который Zam не может выполнить. Попробуйте создать учётную запись на сайте самого сервера.",
    "registration.stageKeptFailing":
        "Сервер продолжал отклонять шаг регистрации. Попробуйте ещё раз.",
    "registration.userInUse": "Это имя пользователя занято. Попробуйте другое.",
    "registration.invalidUsername":
        "Это имя пользователя недопустимо. Используйте строчные буквы, цифры и . _ = - /",
    "registration.exclusiveUsername":
        "Это имя пользователя зарезервировано на этом сервере. Попробуйте другое.",
    "registration.weakPassword":
        "Этот пароль слишком слабый. Попробуйте подлиннее.",
    "registration.weakPasswordReason": "Этот пароль слишком слабый: {reason}",
    "registration.emailInUse":
        "Этот адрес электронной почты уже используется другой учётной записью.",
    "registration.emailNotAllowed":
        "Этот сервер не принимает этот адрес электронной почты.",
    "registration.rateLimited":
        "Слишком много попыток. Подождите минуту и повторите.",
    "registration.stepNotAccepted":
        "Сервер не принял этот шаг. Попробуйте ещё раз.",
    "registration.closed": "Этот сервер не принимает новые учётные записи.",
    "registration.invalidToken":
        "Этот токен регистрации недействителен. Проверьте его и повторите.",
    "registration.refused": "Сервер отказался создавать учётную запись.",
    "registration.refusedReason":
        "Сервер отказался создавать учётную запись: {reason}",
    "registration.serverUnreachable":
        "Не удалось связаться с сервером. Проверьте адрес и подключение.",
    "registration.usernameLowercase":
        "Имена пользователей должны быть в нижнем регистре.",
    "registration.usernameCharacters":
        "Используйте только строчные буквы, цифры и . _ = - /",
    "registration.usernameHint":
        "Выберите имя пользователя. По нему вас будут находить.",
    "registration.usernameAvailable": "{userId} свободно",
    "registration.yourAddressWillBe": "Ваш адрес будет {userId}",
    "registration.confirmPassword": "Подтвердите пароль",
    "registration.passwordsDontMatch": "Пароли не совпадают.",
    "registration.closedOnServer":
        "{server} сейчас не принимает новые учётные записи. Выберите другой сервер, чтобы создать её.",
    "registration.useOtherServer":
        "Вместо этого создать учётную запись на {server}",
    "registration.tokenTitle": "Токен регистрации",
    "registration.tokenBody":
        "Регистрация на {server} только по приглашениям. Введите токен регистрации, который вам дал администратор сервера.",
    "registration.termsTitle": "Примите условия сервера",
    "registration.termsBody":
        "{server} просит вас принять следующее перед созданием учётной записи:",
    "registration.termsAccept": "Я прочитал(а) и принимаю эти условия",
    "registration.emailTitle": "Подтвердите электронную почту",
    "registration.emailBody":
        "{server} требует адрес электронной почты для создания учётной записи. Мы отправим вам ссылку для подтверждения.",
    "registration.emailPlaceholder": "you@example.com",
    "registration.sendEmail": "Отправить письмо",
    "registration.emailSent":
        "Мы отправили ссылку на {email}. Откройте её, затем вернитесь и нажмите «Продолжить».",
    "registration.emailNotConfirmed":
        "Почта ещё не подтверждена. Откройте ссылку из письма, затем нажмите «Продолжить».",
    "registration.emailConfirmed": "Продолжить",
    "registration.captchaTitle": "Подтвердите, что вы не робот",
    "registration.captchaBody":
        "{server} просит вас пройти капчу. Она откроется на странице сервера; вернитесь сюда, когда закончите.",
    "registration.fallbackTitle": "Ещё один шаг",
    "registration.fallbackBody":
        "{server} просит вас завершить один шаг на его странице. Вернитесь сюда, когда закончите.",
    "registration.openStepPage": "Открыть страницу",
    "registration.stepDone": "Готово",

    // src/lib/components/layout/MemberList.svelte
    "memberList.members": "Участники: {length}",
    "memberList.creators": "Создатели: {length}",
    "memberList.admins": "Администраторы: {length}",
    "memberList.admin": "Администратор",
    "memberList.moderators": "Модераторы: {length}",

    // src/lib/components/messages/MessageActionsSheet.svelte
    "messageActionsSheet.thisMessage": "{label} это сообщение?",
    "messageActionsSheet.messageActions": "Действия с сообщением",

    // src/lib/components/layout/MessageArea.svelte
    "messageArea.dropToAttach": "Отпустите, чтобы прикрепить",
    "messageArea.cachedRoomHint":
        "Показаны сообщения, сохранённые на этом устройстве. Отправлять можно будет после загрузки комнаты.",
    "messageArea.unreadNotifications": "Непрочитанные уведомления",
    "messageArea.encryptionEnabled": "Шифрование включено",
    "messageArea.joiningVoiceCall": "Подключение к голосовому звонку…",
    "messageArea.startVoiceCall": "Начать голосовой звонок",
    "messageArea.showCall": "Открыть окно звонка",
    "messageArea.searchMessages": "Поиск сообщений",
    "messageArea.threads": "Обсуждения",
    "messageArea.toggleThreadsList": "Показать или скрыть список обсуждений",
    "messageArea.unreadThreadMentions":
        "Непрочитанные упоминания в обсуждениях",
    "messageArea.unreadThreads": "Непрочитанные обсуждения",
    "messageArea.pinnedMessages": "Закреплённые сообщения",
    "messageArea.notificationsInbox": "Входящие уведомления",
    "messageArea.mediaAndFiles": "Медиа и файлы",
    "messageArea.toggleMemberList": "Показать или скрыть список участников",
    "messageArea.more": "Ещё",
    "messageArea.moreRoomOptions": "Другие параметры комнаты",
    "messageArea.messageTimeline": "Лента сообщений",
    "messageArea.welcomeTo": "Добро пожаловать в #",
    "messageArea.thisIsTheBeginningOfThe": "Это начало комнаты #",
    "messageArea.loadingHistory": "Загрузка более старых сообщений",
    "messageArea.room": ".",
    "messageArea.newMessages": "Новые сообщения",
    "messageArea.messageFromABlockedUser":
        "Сообщение заблокированного пользователя",
    "messageArea.showBlockedMessage": "Показать заблокированное сообщение",
    "messageArea.thisRoomHasBeenUpgraded": "Эта комната была обновлена",
    "messageArea.goToNewRoom": "Перейти в новую комнату",
    "messageArea.joinNewRoom": "Присоединиться к новой комнате",
    "messageArea.jumpToPresent": "Перейти к последним сообщениям",
    "messageArea.searchingForMessage": "Поиск сообщения…",
    "messageArea.viewingMessageContext": "Просмотр контекста сообщения",
    "messageArea.returnToLive": "Вернуться к последним",
    "messageArea.closePanel": "Закрыть панель",
    "messageArea.someone": "Кто-то",
    "messageArea.pinnedMessagesCount": "Закреплённые сообщения ({count})",

    // src/lib/components/messages/MessageInput.svelte
    "messageInput.replyingTo": "Ответ для {replyTargetName}",
    "messageInput.cancelReplyEsc": "Отменить ответ (Esc)",
    "messageInput.editAttachment": "Изменить вложение",
    "messageInput.editAttachment2": "Изменить вложение {name}",
    "messageInput.custom": "свои",
    "messageInput.yourEmotes": "Ваши эмодзи",
    "messageInput.yourNextMessageWillStartA": "Ваше следующее сообщение начнёт",
    "messageInput.thread": "обсуждение",
    "messageInput.cancelThreadCreation": "Отменить создание обсуждения",
    "messageInput.favouriteGifs": "Избранные GIF",
    "messageInput.sendMessage": "Отправить сообщение",
    "messageInput.isTyping": "{value} печатает…",
    "messageInput.andAreTyping": "{value} и {value2} печатают…",
    "messageInput.andAreTyping2": "{value}, {value2} и {value3} печатают…",
    "messageInput.severalPeopleAreTyping": "Несколько человек печатают…",
    "messageInput.noPermissionToSend":
        "У вас нет прав отправлять здесь сообщения",
    "messageInput.selectARoomToStartChatting":
        "Выберите комнату, чтобы начать общение",
    "messageInput.replyInThread": "Ответить в обсуждении...",
    "messageInput.replyTo": "Ответить {replyTargetName}...",
    "messageInput.message": "Сообщение в #{roomName}",
    "messageInput.isNotAValidUser":
        "«{token}» не является допустимым пользователем",
    "messageInput.noRoomSelected": "Комната не выбрана",
    "messageInput.isNotInThisRoom": "{userId} нет в этой комнате",
    "messageInput.youDonTHavePermissionTo":
        "У вас нет прав менять уровни доступа в этой комнате",
    "messageInput.unhandledCommand": "Необработанная команда: /{name}",
    "messageInput.commandFailed": "Не удалось выполнить команду",
    "messageInput.failedToSend": "Не удалось отправить",
    "messageInput.unknownCommandEnterAgain":
        "Неизвестная команда: /{unknown}. Нажмите Enter ещё раз, чтобы отправить её как сообщение.",
    "messageInput.unknownCommandTapAgain":
        "Неизвестная команда: /{unknown}. Нажмите «Отправить» ещё раз, чтобы отправить её как сообщение.",
    "messageInput.sedNoMessage": "Здесь у вас нет сообщения для редактирования",
    "messageInput.sedNoMatch": "«{pattern}» нет в вашем последнем сообщении",
    "messageInput.sedEmpty": "Последнее сообщение после этого станет пустым",
    "messageInput.sedFailed": "Не удалось изменить ваше последнее сообщение",
    "messageInput.sendingAttachments":
        "{count, plural, one {Отправка # вложения…} few {Отправка # вложений…} many {Отправка # вложений…} other {Отправка # вложения…}}",

    // src/lib/components/messages/MessageItem.svelte
    "messageItem.viewProfile": "Показать профиль",
    "messageItem.jumpToTheRepliedToMessage":
        "Перейти к сообщению, на которое отвечали:",
    "messageItem.originalMessageNotLoaded": "Исходное сообщение не загружено",
    "messageItem.originalMessageDeleted": "Исходное сообщение удалено",
    "messageItem.originalMessageUnavailable": "Исходное сообщение недоступно",
    "messageItem.replyPreviewSticker": "Стикер",
    "messageItem.requestKeys": "Запросить ключи",
    "messageItem.keysRequested": "Ключи запрошены",
    "messageItem.requestKeysHelp":
        "Повторить попытку, проверить резервную копию ключей и запросить ключ этого сообщения у сеансов отправителя",
    "messageItem.replyPreviewPoll": "Опрос",
    "messageItem.replyPreviewImage": "Изображение",
    "messageItem.replyPreviewVideo": "Видео",
    "messageItem.replyPreviewAudio": "Аудио",
    "messageItem.replyPreviewFile": "Файл",
    "messageItem.edited": "(изменено)",
    "messageItem.decryptingImage": "Расшифровка изображения...",
    "messageItem.couldnTDecryptImage": "Не удалось расшифровать изображение",
    "messageItem.imageUnavailable": "[Изображение недоступно]",
    "messageItem.decryptingVideo": "Расшифровка видео...",
    "messageItem.couldnTDecryptVideo": "Не удалось расшифровать видео",
    "messageItem.video": "Видео",
    "messageItem.canTBePlayedHere": "Здесь воспроизвести нельзя",
    "messageItem.playbackFailedClickToRetry":
        "Не удалось воспроизвести · Нажмите, чтобы повторить",
    "messageItem.clickToPlay": "{videoDuration} · Нажмите для воспроизведения",
    "messageItem.clickToPlay2": "Нажмите для воспроизведения",
    "messageItem.audio": "Аудио",
    "messageItem.kb": "{toFixed} КБ",
    "messageItem.mb": "{toFixed} МБ",
    "mediaProgress.ofTotal": "{loaded} из {total}",
    "messageItem.fileAttachment": "Вложенный файл",
    "messageItem.download": "Скачать",
    "messageItem.toSave": "- сохранить ·",
    "messageItem.toCancel": "- отменить",
    "messageItem.openThread": "Открыть обсуждение",
    "messageItem.failedToSend": "Не удалось отправить.",
    "messageItem.retrying": "Повторная попытка…",
    "messageItem.showWhoReadThisMessage":
        "Показать, кто прочитал это сообщение",
    "messageItem.readThis":
        "{count, plural, one {# человек прочитал это} few {# человека прочитали это} many {# человек прочитали это} other {# человека прочитали это}}",
    "messageItem.readBy": "Прочитали",
    "messageItem.messageActions": "Действия с сообщением",
    "messageItem.editMessage": "Изменить сообщение",
    "messageItem.delete": "Удалить?",
    "messageItem.yesDeleteMessage": "Да, удалить сообщение",
    "messageItem.yes": "Да",
    "messageItem.noKeepMessage": "Нет, оставить сообщение",
    "messageItem.no": "Нет",
    "messageItem.deleteMessage": "Удалить сообщение",
    "messageItem.unpinMessage": "Открепить сообщение",
    "messageItem.pinMessage": "Закрепить сообщение",
    "messageItem.addReaction": "Добавить реакцию",
    "messageItem.reply": "Ответить",
    "messageItem.replyInThread": "Ответить в обсуждении",
    "messageItem.forwardMessage": "Переслать сообщение",
    "messageItem.moreActions": "Другие действия",
    "messageItem.linkCopied": "Ссылка скопирована!",
    "messageItem.copyMessageLink": "Копировать ссылку на сообщение",
    "messageItem.linkCopied2": "Ссылка скопирована",
    "messageItem.couldnTDeleteTheMessage": "Не удалось удалить сообщение",
    "messageItem.couldnTCopyTheMessageLink":
        "Не удалось скопировать ссылку на сообщение",
    "messageItem.failedToUnpinMessage": "Не удалось открепить сообщение",
    "messageItem.failedToPinMessage": "Не удалось закрепить сообщение",
    "messageItem.couldNotOpenTheMatrixLink": "Не удалось открыть ссылку Matrix",
    "messageItem.viewSource": "Исходный код",

    // src/lib/components/messages/ViewSourceDialog.svelte
    "viewSource.title": "Исходный код сообщения",
    "viewSource.decrypted": "Расшифрованное событие",
    "viewSource.encrypted": "Исходное (зашифрованное) событие",
    "viewSource.copied": "Скопировано",

    // src/lib/components/messages/MessageRedactAction.svelte
    "messageRedactAction.removeMessage": "Удалить сообщение",
    "messageRedactAction.removeThisMessage": "Удалить это сообщение?",
    "messageRedactAction.removing": "Удаление…",
    "messageRedactAction.failedToRemoveMessage": "Не удалось удалить сообщение",

    // src/lib/components/messages/MessageReportAction.svelte
    "messageReportAction.reportMessage": "Пожаловаться на сообщение",
    "messageReportAction.reportSent": "Жалоба отправлена",
    "messageReportAction.whyAreYouReportingThisMessage":
        "Почему вы жалуетесь на это сообщение?",
    "messageReportAction.markAsExtremelyOffensive":
        "Отметить как крайне оскорбительное",
    "messageReportAction.reporting": "Отправка жалобы…",
    "messageReportAction.report": "Пожаловаться",

    // src/lib/components/layout/MessageSearchPanel.svelte
    "messageSearchPanel.searchMessages": "Поиск сообщений",
    "messageSearchPanel.searchTryFromOrHasImage":
        "Поиск - попробуйте from: или has:image",
    "messageSearchPanel.searchForMessagesInThisRoom":
        "Поиск сообщений в этой комнате.",
    "messageSearchPanel.noMatchesInTheResultsLoaded":
        "Совпадений среди загруженных пока результатов нет.",
    "messageSearchPanel.noResultsFor":
        "Нет результатов по запросу «{searched}».",
    "messageSearchPanel.searchFailed": "Не удалось выполнить поиск",
    "messageSearchPanel.resultCount":
        "{count, plural, one {# результат} few {# результата} many {# результатов} other {# результата}}",

    // src/lib/components/settings/MessagesMediaSettings.svelte
    "messagesMediaSettings.messages": "Сообщения",
    "messagesMediaSettings.showMatrixIds": "Показывать Matrix ID",
    "messagesMediaSettings.showFullMatrixIdsLikeUser":
        "Везде в приложении показывать полные Matrix ID вроде @user:server вместо отображаемых имён.",
    "messagesMediaSettings.readReceiptAvatars": "Аватары отметок о прочтении",
    "messagesMediaSettings.showWhoHasReadEachMessage":
        "Показывать под каждым сообщением маленькие аватары тех, кто его прочитал. Это меняет только то, что видите вы на этом устройстве - чтобы другие не видели, до какого места вы прочитали, используйте «Приватные отметки о прочтении» в разделе «Конфиденциальность и безопасность».",
    "messagesMediaSettings.holdToOpenMessageMenu":
        "Удерживать для открытия меню сообщения",
    "messagesMediaSettings.onTouchDevicesOpenAMessage":
        "На сенсорных устройствах открывать действия с сообщением удержанием, а не касанием. Когда выключено, меню открывается касанием.",
    "messagesMediaSettings.checkSpelling": "Проверять орфографию",
    "messagesMediaSettings.underlineMisspelledWordsAnd":
        "Подчёркивать слова с ошибками и предлагать исправления при наборе. Выключите, чтобы отключить проверку орфографии и автоисправление клавиатуры в редакторах сообщений на этом устройстве.",
    "messagesMediaSettings.linkPreviews": "Предпросмотр ссылок",
    "messagesMediaSettings.whenOffNoLinkPreviewIs":
        "Когда выключено, предпросмотр ссылок не загружается, а ваш домашний сервер никогда не запрашивает страницу по ссылке от вашего имени. Откуда загружать медиа предпросмотра, настраивается в разделе «Конфиденциальность и безопасность».",
    "messagesMediaSettings.pauseVideosOffScreen":
        "Приостанавливать видео вне экрана",
    "messagesMediaSettings.pauseAPlayingVideoWhenIt":
        "Приостанавливать воспроизводимое видео, когда оно прокручивается за пределы экрана, чтобы экономить заряд. Вы запускаете его заново сами, когда возвращаетесь.",
    "messagesMediaSettings.sendVideosThatStreamFaster":
        "Отправлять видео, которые начинают воспроизводиться быстрее",
    "messagesMediaSettings.rearrangeMp4VideosYouSend":
        "Переупорядочивать отправляемые видео MP4, чтобы они могли начать воспроизводиться во время загрузки. Перекодирования нет, изображение не меняется. Выключите, чтобы отправлять файлы как есть.",
    "messagesMediaSettings.sendPhotosThatAppearSooner":
        "Отправлять фото, которые появляются быстрее",
    "messagesMediaSettings.rewriteJpegPhotosYouSend":
        "Переписывать отправляемые фото JPEG так, чтобы люди сразу видели всё изображение, а оно становилось чётче по мере загрузки. Перекодирования нет, изображение не меняется. Выключите, чтобы отправлять файлы как есть.",
    "messagesMediaSettings.removeLocationAndMetadata":
        "Удалять местоположение и другие метаданные из загружаемых файлов",
    "messagesMediaSettings.stripMetadataDescription":
        "Удалять EXIF, GPS-координаты, сведения о камере и другие скрытые метаданные из отправляемых фото и видео. Изображение не меняется, а поворот сохраняется, чтобы фото отображались прямо.",
    "messagesMediaSettings.stripMetadataWarning":
        "Внимание: если это выключено, отправляемые файлы могут раскрыть ваши личные данные, в том числе место съёмки.",
    "messagesMediaSettings.randomizeFileNames": "Случайные имена файлов",
    "messagesMediaSettings.randomizeFileNamesDescription":
        "Загружать файлы под случайным именем из букв и цифр вместо настоящего. Расширение файла сохраняется, в том числе составные вроде .tar.gz.",
    "messagesMediaSettings.sendGifsAsAnimatedWebp":
        "Отправлять GIF как анимированный WebP",
    "messagesMediaSettings.reencodeGifsYouSend":
        "Перекодировать отправляемые GIF в анимированный WebP без потерь, который обычно меньше и может воспроизводиться во время загрузки. Изображение не меняется. GIF, который не уменьшится, отправляется как есть.",
    "messagesMediaSettings.defaultTab": "Вкладка по умолчанию",
    "messagesMediaSettings.whichTabTheGifPickerOpens":
        "На какой вкладке открывается выбор GIF.",
    "messagesMediaSettings.defaultGifTab": "Вкладка GIF по умолчанию",
    "messagesMediaSettings.favourites": "Избранное",
    "midiSoundBank.midi": "MIDI",
    "midiSoundBank.soundBank": "Банк звуков",
    "midiSoundBank.theInstrumentSoundsUsedTo":
        "Звуки инструментов, используемые для воспроизведения вложений MIDI.",
    "midiSoundBank.system": "Системный",
    "midiSoundBank.included": "Встроенный",
    "midiSoundBank.custom": "Свой",
    "midiSoundBank.noSystemSoundBankFound":
        "На этом устройстве не найден системный банк звуков, поэтому используется встроенный.",
    "midiSoundBank.chooseFile": "Выбрать файл",
    "midiSoundBank.chooseAnotherFile": "Выбрать другой файл",
    "midiSoundBank.saving": "Сохранение…",
    "midiSoundBank.sf2Sf3OrDlsUpTo":
        "Свой: файл SF2, SF3 или DLS до 256 МБ, хранится на этом устройстве.",
    "midiSoundBank.useAnSf2Sf3OrDls": "Используйте файл SF2, SF3 или DLS.",
    "midiSoundBank.thatFileIsEmpty": "Этот файл пуст.",
    "midiSoundBank.fileIsTooLarge":
        "Этот файл слишком большой (максимум 256 МБ).",
    "midiSoundBank.notASoundBank": "Этот файл не является банком звуков.",
    "midiSoundBank.couldNotSave":
        "Не удалось сохранить банк звуков на этом устройстве (возможно, хранилище заполнено).",

    // src/lib/components/ui/ModalDialog.fixture.svelte
    "modalDialog.fixture.fixtureDialog": "Тестовый диалог",

    // src/lib/components/settings/NotificationSettings.svelte
    "notificationSettings.thisDevice": "Это устройство",
    "notificationSettings.systemPermission": "Системное разрешение",
    "notificationSettings.pushNotifications": "Push-уведомления",
    "notificationSettings.permissionIsBlockedInSystemSettings":
        "Разрешение заблокировано в системных настройках",
    "notificationSettings.notificationsAreNotSupportedHere":
        "Уведомления здесь не поддерживаются",
    "notificationSettings.allowThisAppToSendNotifications":
        "Разрешить этому приложению отправлять уведомления",
    "notificationSettings.requesting": "Запрос…",
    "notificationSettings.blocked": "Заблокировано",
    "notificationSettings.unavailable": "Недоступно",
    "notificationSettings.enable": "Включить",
    "notificationSettings.pushService": "Push-служба",
    "notificationSettings.pushServiceLabel": "Доставка через",
    "notificationSettings.pushServiceDescription":
        "Как уведомления доходят до этого устройства, пока приложение закрыто. UnifiedPush работает без сервисов Google, через приложение-дистрибьютор, например ntfy.",
    "notificationSettings.pushServiceAutomatic": "Автоматически",
    "notificationSettings.pushServiceFcm": "Google (Firebase)",
    "notificationSettings.pushServiceFcmUnavailable":
        "Google (Firebase), недоступно здесь",
    "notificationSettings.pushServiceUnifiedPush": "UnifiedPush: {label}",
    "notificationSettings.pushServiceNoDistributor":
        "Дистрибьютор UnifiedPush не установлен. Установите его (например, ntfy), чтобы получать уведомления без сервисов Google.",
    "notificationSettings.pushServiceActiveFcm":
        "Сейчас используется Google (Firebase).",
    "notificationSettings.pushServiceActiveUnifiedPush":
        "Сейчас используется UnifiedPush ({label}).",
    "notificationSettings.pushServiceActiveNone":
        "Push-служба не активна, поэтому уведомления приходят, только пока приложение открыто.",
    "notificationSettings.pushServiceSwitchFailed":
        "Не удалось переключить push-службу",
    "notificationSettings.sound": "Звук",
    "notificationSettings.notificationSound": "Звук уведомления",
    "notificationSettings.playASoundForLoudNotifications":
        "Проигрывать звук для громких уведомлений",
    "notificationSettings.desktopAlerts": "Оповещения на рабочем столе",
    "notificationSettings.popUpAndTaskbarFlash":
        "Всплывающее окно и мигание на панели задач",
    "notificationSettings.whichNotificationsShowASystemPop":
        "Какие уведомления показывают системное всплывающее окно и заставляют мигать значок на панели задач, пока окно в фоне.",
    "notificationSettings.popUps": "Всплывающие окна",
    "notificationSettings.popUpNotifications": "Всплывающие уведомления",
    "notificationSettings.whichNotificationsShowASystemPopUp":
        "Какие уведомления показывают системное всплывающее окно, пока приложение в фоне.",
    "notificationSettings.multipleDevices": "Несколько устройств",
    "notificationSettings.quietOnMyOtherDevices":
        "Тишина на моих других устройствах",
    "notificationSettings.whileYouReActivelyUsingOne":
        "Пока вы активно пользуетесь одним устройством, остальные не воспроизводят звук уведомления и не показывают всплывающие окна, пока это устройство не простоит без дела столько времени. Действует для всех устройств вашей учётной записи; уведомления по-прежнему появляются во входящих, а счётчики непрочитанного не меняются.",
    "notificationSettings.custom": "Своё…",
    "notificationSettings.customQuietDurationInMinutes":
        "Своя длительность тишины в минутах",
    "notificationSettings.minutesMax":
        "минут (максимум {MAX_CUSTOM_GRACE_MINUTES})",
    "notificationSettings.couldnTSaveToYourAccount":
        "Не удалось сохранить в вашей учётной записи - на других устройствах может остаться прежняя настройка. Проверьте подключение и повторите.",
    "notificationSettings.retrySavingTheOtherDeviceQuiet":
        "Повторить сохранение настройки тишины на других устройствах",
    "notificationSettings.retrying": "Повторная попытка…",
    "notificationSettings.rules": "Правила",
    "notificationSettings.notificationRules": "Правила уведомлений",
    "notificationSettings.loudNotifyWithSoundSilentNotify":
        "Громко = уведомление со звуком · Тихо = уведомление без звука · Выкл. = без уведомления",
    "notificationSettings.keywordHighlights": "Выделение ключевых слов",
    "notificationSettings.getNotifiedWhenAMessageContains":
        "Получайте уведомление, когда сообщение содержит слово или фразу. Регистр не учитывается;",
    "notificationSettings.and": "и",
    "notificationSettings.areWildcards": "- подстановочные знаки.",
    "notificationSettings.addAKeyword": "Добавить ключевое слово…",
    "notificationSettings.newKeyword": "Новое ключевое слово",
    "notificationSettings.noKeywordRulesYet":
        "Правил для ключевых слов пока нет.",
    "notificationSettings.behaviorFor": "Поведение для {pattern}",
    "notificationSettings.enable2": "Включить {pattern}",
    "notificationSettings.loudOnly": "Только громкие",
    "notificationSettings.onlyNotificationsThatMakeASound":
        "Только уведомления со звуком",
    "notificationSettings.silentAndLoud": "Тихие и громкие",
    "notificationSettings.everyNotificationLoudOrSilent":
        "Каждое уведомление, громкое или тихое",
    "notificationSettings.none": "Нет",
    "notificationSettings.neverAlertOnThisDevice":
        "Никогда не оповещать на этом устройстве",
    "notificationSettings.couldNotSaveNotificationSetting":
        "Не удалось сохранить настройку уведомлений",
    "notificationSettings.highlightSound": "Выделение + звук",
    "notificationSettings.notifyWithAHighlightAndSound":
        "Уведомлять с выделением и звуком",
    "notificationSettings.highlight": "Выделение",
    "notificationSettings.notifyWithAHighlight": "Уведомлять с выделением",
    "notificationSettings.notify": "Уведомлять",
    "notificationSettings.notifyWithoutAHighlight": "Уведомлять без выделения",
    "notificationSettings.failedToAddKeyword":
        "Не удалось добавить ключевое слово",
    "notificationSettings.failedToUpdateKeyword":
        "Не удалось обновить ключевое слово",
    "notificationSettings.failedToDeleteKeyword":
        "Не удалось удалить ключевое слово",
    "notificationSettings.accountNotificationsOff":
        "Уведомления для этой учётной записи отключены",
    "notificationSettings.accountNotificationsOffDetail":
        "Все уведомления для этой учётной записи отключены на сервере, вероятно из другого приложения, поэтому ни одно устройство не получает уведомлений, что бы ни говорили настройки ниже.",
    "notificationSettings.accountNotifications":
        "Уведомления для этой учётной записи",
    "notificationSettings.accountNotificationsDetail":
        "Включает или отключает уведомления для этой учётной записи на всех ваших устройствах.",
    "notificationSettings.thisDeviceNotifications":
        "Уведомления на этом устройстве",
    "notificationSettings.thisDeviceNotificationsDetail":
        "Отключает всплывающие окна, звуки и push только на этом устройстве. Другие устройства продолжат уведомлять.",
    "notificationSettings.couldNotUpdateNotifications":
        "Не удалось обновить настройки уведомлений",
    "notificationSettings.turnOn": "Включить",
    "notificationSettings.couldNotTurnOnNotifications":
        "Не удалось включить уведомления",

    // src/lib/components/layout/NotificationsPanel.svelte
    "notificationsPanel.clearAll": "Очистить все",
    "notificationsPanel.couldNotRefreshServerNotificationsTap":
        "Не удалось обновить уведомления сервера. Нажмите, чтобы повторить.",
    "notificationsPanel.noNotifications": "Уведомлений нет.",
    "notificationsPanel.jumpToMessage": "Перейти к сообщению:",
    "notificationsPanel.in": "в #{roomName}",
    "notificationsPanel.message": "(сообщение)",

    // src/lib/components/messages/OutboxStrip.svelte
    "outboxStrip.queued": "В очереди",
    "outboxStrip.sending": "Отправка…",
    "outboxStrip.failed": "Не удалось",

    // src/lib/components/layout/OwnStatusEditor.svelte
    "ownStatusEditor.pickAStatusEmoji": "Выберите эмодзи статуса",
    "ownStatusEditor.whatSHappening": "Что происходит?",
    "ownStatusEditor.statusText": "Текст статуса",
    "ownStatusEditor.clearStatus": "Очистить статус",
    "ownStatusEditor.couldNotSaveStatus": "Не удалось сохранить статус",

    // src/lib/components/layout/PinnedMessagesPanel.svelte
    "pinnedMessagesPanel.pinnedMessages": "Закреплённые сообщения",
    "pinnedMessagesPanel.noPinnedMessages": "Закреплённых сообщений нет.",
    "pinnedMessagesPanel.jump": "Перейти",
    "pinnedMessagesPanel.unpin": "Открепить",

    // src/lib/components/plugins/PluginPopoverHost.svelte
    "pluginPopoverHost.plugin": "Плагин",

    // src/lib/components/settings/PluginSettingsForm.svelte
    "pluginSettingsForm.backToPlugins": "Назад к плагинам",
    "pluginSettingsForm.settings": "Настройки плагина {pluginName}",
    "pluginSettingsForm.thisPluginHasNoSettings":
        "У этого плагина нет настроек.",
    "pluginSettingsForm.moveUp": "Переместить вверх",
    "pluginSettingsForm.moveDown": "Переместить вниз",
    "pluginSettingsForm.removeRow": "Удалить строку",

    // src/lib/components/settings/PluginsSettings.svelte
    "pluginsSettings.back": "← Назад",
    "pluginsSettings.syncYourEnabledPluginsSettingsTo":
        "Синхронизируйте включённые плагины и их настройки с вашей учётной записью Matrix (иначе они хранятся отдельно на каждом устройстве). Перед получением показывается, что изменится, прежде чем что-либо запустится.",
    "pluginsSettings.pushToAccount": "Отправить в учётную запись",
    "pluginsSettings.pullFromAccount": "Получить из учётной записи",
    "pluginsSettings.thisPullWill": "При получении будет:",
    "pluginsSettings.addRepos": "Добавлены репозитории: {join}",
    "pluginsSettings.installFromRepos":
        "Установлено из их репозиториев: {join}",
    "pluginsSettings.couldNotInstall":
        "Применено, но эти плагины не удалось установить: {join}",
    "pluginsSettings.enable": "Включено: {join}",
    "pluginsSettings.disable": "Отключено: {join}",
    "pluginsSettings.updateSettingsFor": "Обновлены настройки для: {join}",
    "pluginsSettings.setAutoUpdate": "Задано автообновление: {value}",
    "pluginsSettings.setPerPluginAutoUpdate":
        "Задано автообновление по плагинам: {join}",
    "pluginsSettings.notInstalledOnThisDeviceInstall":
        "Не установлено на этом устройстве (установите из раздела «Обзор», затем получите снова): {join}",
    "pluginsSettings.nothingToChangeAlreadyInSync":
        "Менять нечего; уже синхронизировано.",
    "pluginsSettings.apply": "Применить",
    "pluginsSettings.installed": "Установленные",
    "pluginsSettings.noPluginsInstalled": "Плагины не установлены.",
    "pluginsSettings.needsUpdate": "Требуется обновление",
    "pluginsSettings.updateToV": "Обновить до v{value}",
    "pluginsSettings.updating": "Обновление...",
    "pluginsSettings.update": "Обновить",
    "pluginsSettings.pluginSettings": "Настройки плагина",
    "pluginsSettings.enable2": "Включить {name}",
    "pluginsSettings.working": "Выполняется...",
    "pluginsSettings.autoUpdateThisPlugin":
        "Автоматически обновлять этот плагин",
    "pluginsSettings.autoDefault": "Авто: по умолчанию",
    "pluginsSettings.autoOn": "Авто: вкл.",
    "pluginsSettings.autoOff": "Авто: выкл.",
    "pluginsSettings.confirmRemove": "Подтвердите удаление {name}",
    "pluginsSettings.removePlugin": "Удалить плагин",
    "pluginsSettings.remove": "Удалить {name}",
    "pluginsSettings.browse": "Обзор",
    "pluginsSettings.loading": "Загрузка...",
    "pluginsSettings.noPluginsInThisRepoYet":
        "В этом репозитории пока нет плагинов.",
    "pluginsSettings.install": "Установить",
    "pluginsSettings.repos": "Репозитории",
    "pluginsSettings.official": "Официальный",
    "pluginsSettings.localFolder": "Локальная папка",
    "pluginsSettings.loadFromFolder": "Загрузить плагин из папки",
    "pluginsSettings.loadFromFolderHint":
        "Для разработки плагина: выберите папку с его manifest.json и сборкой или папку репозитория, содержащую несколько таких папок плагинов. Zam хранит копию и запускает её как любой плагин; после пересборки нажмите «Перезагрузить». Плагин выполняет код с полным доверием, поэтому загружайте только папки, которые вы написали сами или которым доверяете.",
    "pluginsSettings.chooseFolder": "Выбрать папку",
    "pluginsSettings.reload": "Перезагрузить",
    "pluginsSettings.reloading": "Перезагрузка…",
    "pluginsSettings.reloadFromFolder": "Перезагрузить из папки",
    "pluginsSettings.removeRepo": "Удалить репозиторий",
    "pluginsSettings.addARepo": "Добавить репозиторий",
    "pluginsSettings.thirdPartyReposRunFullTrust":
        "Сторонние репозитории выполняют код с полным доверием и полным доступом к вашей учётной записи и сообщениям. Добавляйте только те, которым доверяете.",
    "pluginsSettings.ownerRepoOrGithubUrl":
        "владелец/репозиторий или URL GitHub",
    "pluginsSettings.addRepo": "Добавить репозиторий",
    "pluginsSettings.syncPlugins": "Синхронизация плагинов",
    "pluginsSettings.disableAllPlugins": "Отключить все плагины",
    "pluginsSettings.autoUpdatePlugins": "Автообновление плагинов",
    "pluginsSettings.automaticallyPullNewerVersionsOfRepo":
        "Автоматически получать новые версии плагинов из репозиториев.",
    "pluginsSettings.pushedYourPluginSetToYour":
        "Набор ваших плагинов отправлен в учётную запись.",
    "pluginsSettings.pushFailed": "Не удалось отправить.",
    "pluginsSettings.pullFailed": "Не удалось получить.",
    "pluginsSettings.appliedTheSyncedPluginSet":
        "Синхронизированный набор плагинов применён.",
    "pluginsSettings.updateFailed": "Не удалось обновить.",
    "pluginsSettings.couldnTRemovePlugin":
        "Не удалось удалить плагин: {message}",
    "pluginsSettings.couldnTRemovePlugin2": "Не удалось удалить плагин.",
    "pluginsSettings.cannotAddThisRepo":
        "Не удаётся добавить этот репозиторий.",
    "pluginsSettings.noIndexJson": "Нет index.json ({status})",
    "pluginsSettings.installFailed": "Не удалось установить.",

    // src/lib/components/messages/PollBody.svelte
    "pollBody.finalResults": "Итоговые результаты",
    "pollBody.livePoll": "Идущий опрос",
    "pollBody.resultsAreRevealedWhenThePoll":
        "Результаты откроются, когда опрос завершится",
    "pollBody.chooseUpTo": "· выберите до {maxSelections}",
    "pollBody.selected": "выбрано",
    "pollBody.submitting": "Отправка…",
    "pollBody.submitVote": "Отправить голос",
    "pollBody.votesAreHidden": "Голоса скрыты",
    "pollBody.savingVote": "· сохранение голоса…",
    "pollBody.closeThisPoll": "Завершить этот опрос?",
    "pollBody.closing": "Завершение…",
    "pollBody.closePoll": "Завершить опрос",
    "pollBody.pollUnsupportedFormat": "[Опрос - неподдерживаемый формат]",
    "pollBody.failedToSubmitVote": "Не удалось отправить голос",
    "pollBody.failedToClosePoll": "Не удалось завершить опрос",
    "pollBody.voteCount":
        "{count, plural, one {# голос} few {# голоса} many {# голосов} other {# голоса}}",

    // src/lib/components/ui/Portal.fixture.svelte
    "portal.fixture.hello": "привет",

    // src/lib/components/settings/PrivacySafetySettings.svelte
    "privacySafetySettings.privacy": "Конфиденциальность",
    "privacySafetySettings.privateReadReceipts":
        "Приватные отметки о прочтении",
    "privacySafetySettings.sendTypingIndicators":
        "Отправлять индикатор набора текста",
    "privacySafetySettings.indexEncryptedRooms":
        "Индексировать зашифрованные комнаты на этом устройстве",
    "privacySafetySettings.indexEncryptedRoomsHint":
        "Хранит на этом устройстве сжатую копию сообщений ваших зашифрованных комнат, чтобы в них работали поиск и список медиа. История медленно загружается в фоне. При выключении копия удаляется.",
    "privacySafetySettings.letOthersInARoomSee":
        "Позволяет другим людям в комнате видеть, когда вы печатаете. Выключите, чтобы печатать, никого не оповещая.",
    "privacySafetySettings.hideYourReadReceiptsFromOther":
        "Скрывать ваши отметки о прочтении от других пользователей. Счётчики непрочитанного продолжают работать; другие просто не видят, до какого места вы прочитали.",
    "privacySafetySettings.streamerMode": "Режим стримера",
    "privacySafetySettings.streamerModeHint":
        "Размывает ID аккаунта, адреса электронной почты и ключ восстановления и скрывает текст сообщений в уведомлениях, чтобы в трансляции не появлялось ничего личного. Действует только на этом устройстве.",
    "privacySafetySettings.hideMessageTextInNotifications":
        "Скрывать текст сообщений в уведомлениях",
    "privacySafetySettings.notificationsOnThisDeviceSayWho":
        "Уведомления на этом устройстве сообщают, кто вам написал, но не что именно. Имена отправителя и комнаты по-прежнему показываются. Действует только на этом устройстве.",
    "privacySafetySettings.linkPreviewMedia": "Медиа предпросмотра ссылок",
    "privacySafetySettings.previewImagesAndVideosUsuallyCome":
        "Изображения и видео в обычных предпросмотрах ссылок проходят через ваш домашний сервер. «Все» также загружает плееры YouTube, карточки X/Twitter и GIF, которые ваш сервер не может показать в предпросмотре, прямо с этих сайтов, поэтому они узнают ваш IP-адрес и когда вы прочитали сообщение. «Только домашний сервер» удерживает их; «Выкл.» удерживает и то, что отдаёт ваш сервер. В любом случае у каждого затронутого предпросмотра остаётся кнопка загрузки его медиа. Переключатель предпросмотра ссылок находится в разделе «Сообщения и медиа».",
    "privacySafetySettings.blockedUsers": "Заблокированные пользователи",
    "privacySafetySettings.all": "Все",
    "privacySafetySettings.loadPreviewMediaFromWhereverIt":
        "Также загружать вставки YouTube, X/Twitter и GIF прямо с этих сайтов",
    "privacySafetySettings.homeserverOnly": "Только домашний сервер",
    "privacySafetySettings.onlyLoadPreviewMediaYourOwn":
        "Загружать только то медиа предпросмотра, которое отдаёт ваш домашний сервер",
    "privacySafetySettings.off": "Выкл.",
    "privacySafetySettings.neverLoadPreviewMediaAutomatically":
        "Никогда не загружать медиа предпросмотра автоматически",

    // src/lib/components/settings/ProfileFieldsEditor.svelte
    "profileFieldsEditor.moreAboutYou": "Больше о вас",
    "profileFieldsEditor.banner": "Баннер",
    "profileFieldsEditor.yourBanner": "Ваш баннер",
    "profileFieldsEditor.changeBanner": "Сменить баннер",
    "profileFieldsEditor.showWhenIAmInA": "Показывать, когда я в звонке",
    "profileFieldsEditor.addsInACallToYour":
        "Добавляет «В звонке» в ваш профиль, пока вы подключены к голосовому звонку, и убирает, когда вы выходите.",
    "profileFieldsEditor.pronouns": "Местоимения",
    "profileFieldsEditor.sheHerTheyThem": "она/её, они/их",
    "profileFieldsEditor.separateWithCommasMostPreferredFirst":
        "Разделяйте запятыми, самые предпочтительные - первыми.",
    "profileFieldsEditor.status": "Статус",
    "profileFieldsEditor.statusEmoji": "Эмодзи статуса",
    "profileFieldsEditor.pickAStatusEmoji": "Выберите эмодзи статуса",
    "profileFieldsEditor.onHolidayUntilThe23rd": "В отпуске до 23-го",
    "profileFieldsEditor.statusText": "Текст статуса",
    "profileFieldsEditor.bio": "О себе",
    "profileFieldsEditor.tellPeopleAboutYourself": "Расскажите людям о себе",
    "profileFieldsEditor.timezone": "Часовой пояс",
    "profileFieldsEditor.timezoneRegion": "Регион часового пояса",
    "profileFieldsEditor.notSet": "Не задано",
    "profileFieldsEditor.timezoneCity": "Город часового пояса",
    "profileFieldsEditor.chooseACity": "Выберите город",
    "profileFieldsEditor.europeLondon": "Europe/London",
    "profileFieldsEditor.useMine": "Мой",
    "profileFieldsEditor.usernameColour": "Цвет имени пользователя",
    "profileFieldsEditor.usernameColourOnDarkThemes":
        "Цвет имени пользователя в тёмных темах",
    "profileFieldsEditor.darkThemes": "тёмные темы",
    "profileFieldsEditor.usernameColourOnLightThemes":
        "Цвет имени пользователя в светлых темах",
    "profileFieldsEditor.lightThemes": "светлые темы",
    "profileFieldsEditor.resetToDefault": "Сбросить по умолчанию",
    "profileFieldsEditor.chooseAColour": "Выберите цвет",
    "profileFieldsEditor.oneColourForDarkThemesAnd":
        "Один цвет для тёмных тем и один для светлых, чтобы ваше имя оставалось читаемым в любом случае.",
    "profileFieldsEditor.links": "Ссылки",
    "profileFieldsEditor.label": "Подпись",
    "profileFieldsEditor.linkLabel": "Подпись ссылки",
    "profileFieldsEditor.httpsExampleOrg": "https://example.org",
    "profileFieldsEditor.linkAddress": "Адрес ссылки",
    "profileFieldsEditor.removeLink": "Удалить ссылку",
    "profileFieldsEditor.addLink": "Добавить ссылку",
    "profileFieldsEditor.saved": "Сохранено",
    "profileFieldsEditor.useATimezoneNameLikeEurope":
        "Используйте название часового пояса, например Europe/London.",
    "profileFieldsEditor.chooseACity2": "Выберите город.",
    "profileFieldsEditor.bannerUploadFailed": "Не удалось загрузить баннер",
    "profileFieldsEditor.failedToSaveProfileFields":
        "Не удалось сохранить поля профиля",

    // src/lib/components/layout/ProfileFooter.svelte
    "profileFooter.dismiss": "Скрыть",
    "profileFooter.switchAccounts": "Сменить учётную запись",
    "profileFooter.unknown": "Неизвестно",

    // src/lib/components/settings/PushDiagnostics.svelte
    "pushDiagnostics.pushGateway": "Push-шлюз",
    "pushDiagnostics.notificationRelay": "Ретранслятор уведомлений",
    "pushDiagnostics.pushNotificationsAreRelayedThroughThis":
        "Push-уведомления передаются через этот шлюз. Он видит, из каких комнат и от кого вам приходят уведомления, но никогда не видит текст сообщений.",
    "pushDiagnostics.warningYourHomeserverIsRoutingThis":
        "Внимание: ваш домашний сервер направляет push-уведомления этого устройства на другой шлюз ({join}). Метаданные ваших уведомлений видит именно он, а не указанный выше.",
    "pushDiagnostics.verifiedYourHomeserverRoutesNotificationsTo":
        "Проверено: ваш домашний сервер направляет уведомления на этот шлюз.",
    "pushDiagnostics.noPushNotificationsAreRegisteredOn":
        "Push-уведомления для этой учётной записи пока не зарегистрированы.",

    // src/lib/components/ui/QrCodeImage.svelte
    "qrCodeImage.couldNotRenderTheVerificationCode":
        "Не удалось отобразить код подтверждения.",
    "qrCodeImage.qrCodeForDeviceVerification":
        "QR-код для подтверждения устройства",

    // src/lib/components/layout/QuickActions.svelte
    "quickActions.newDm": "Новый личный чат",
    "quickActions.createRoomInSpace": "Создать комнату в пространстве",
    "quickActions.createNewRoom": "Создать новую комнату",
    "quickActions.createNewSpace": "Создать новое пространство",
    "quickActions.joinRoomByAddress": "Присоединиться к комнате по адресу",
    "quickActions.createARoom": "Создать комнату",
    "quickActions.createASpace": "Создать пространство",
    "quickActions.newDirectMessage": "Новый личный чат",
    "quickActions.joinARoom": "Присоединиться к комнате",
    "quickActions.spaceName": "Название пространства",
    "quickActions.roomName": "Название комнаты",
    "quickActions.mySpace": "Моё пространство",
    "quickActions.optional": "(необязательно)",
    "quickActions.additionalCreators": "Дополнительные создатели (комната v12)",
    "quickActions.additionalCreatorsHint":
        "Другие пользователи, которые станут создателями новой комнаты наравне с вами. В комнате v12 права создателя нельзя отнять.",
    "quickActions.starterRooms": "Добавить текстовую и голосовую комнаты",
    "quickActions.starterRoomsHint":
        "Любой, кого вы пригласите в пространство, сможет в них войти.",
    "quickActions.starterTextName": "общее",
    "quickActions.starterVoiceName": "Голосовая",
    "quickActions.whatSThisSpaceAbout": "О чём это пространство?",
    "quickActions.whatSThisRoomAbout": "О чём эта комната?",
    "quickActions.opensStraightIntoACallMessages":
        "Сразу открывается звонок. Сообщения тоже работают.",
    "quickActions.enableEncryption": "Включить шифрование",
    "quickActions.canTBeTurnedOffLater": "Позже отключить нельзя.",
    "quickActions.findSomeoneToMessage": "Найдите, кому написать…",
    "quickActions.encryptThisDm": "Зашифровать этот личный чат",
    "quickActions.openTheDm": "Открыть личный чат",
    "quickActions.roomAddressOrId": "Адрес или ID комнаты",
    "quickActions.roomServerCom": "#room:server.com",
    "quickActions.requestSentYouLlBeAble":
        "Запрос отправлен - вы сможете присоединиться, как только вас впустят.",
    "quickActions.youCanTJoinThisRoom":
        "Вы не можете присоединиться к этой комнате напрямую, но можете запросить вступление.",
    "quickActions.requestToJoin": "Запросить вступление",
    "quickActions.create": "Создать",
    "quickActions.somethingWentWrong": "Что-то пошло не так",
    "quickActions.enterARoomAddressRoomServer":
        "Введите адрес комнаты (#room:server.com) или ID комнаты (!id:server.com)",
    "quickActions.couldNotSendTheJoinRequest":
        "Не удалось отправить запрос на вступление",

    // src/lib/components/messages/ReactorPopover.svelte
    "reactorPopover.more": "ещё +{overflow}",
    "reactorPopover.reactedWith": "Отреагировали: {label}",
    "reactorPopover.userList": "Список пользователей",

    // src/lib/components/messages/RenameAttachmentDialog.svelte
    "renameAttachmentDialog.editAttachment": "Изменить вложение",
    "renameAttachmentDialog.filename": "Имя файла",
    "renameThreadDialog.nameThread": "Назвать обсуждение",
    "renameThreadDialog.renameThread": "Переименовать обсуждение",
    "renameThreadDialog.threadName": "Название обсуждения",
    "renameThreadDialog.everyoneInTheRoomSeesIt":
        "Все в комнате видят это название в Zam. Другие приложения Matrix его не показывают.",
    "renameThreadDialog.removeName": "Удалить название",
    "renameThreadDialog.couldNotSaveTheName": "Не удалось сохранить название",

    // src/lib/components/layout/RoomDirectory.svelte
    "roomDirectory.exploreRooms": "Обзор комнат",
    "roomDirectory.onYourHomeserver": "на вашем домашнем сервере",
    "roomDirectory.publicRooms": "Публичные комнаты {value}",
    "roomDirectory.rooms": "· ~{totalEstimate} комнат",
    "roomDirectory.searchRooms": "Поиск комнат…",
    "roomDirectory.serverOptional": "Сервер (необязательно)",
    "roomDirectory.search": "Поиск",
    "roomDirectory.noRoomsFound": "Комнаты не найдены.",
    "roomDirectory.space": "Пространство",
    "roomDirectory.open": "Открытая",
    "roomDirectory.knockOnly": "Только по запросу",
    "roomDirectory.requestToJoin": "Запросить вступление",
    "roomDirectory.requested": "Запрос отправлен",
    "roomDirectory.somethingWentWrong": "Что-то пошло не так",

    // src/lib/components/layout/RoomTopicSheet.svelte
    "roomTopicSheet.description": "Описание",
    "roomTopicSheet.open": "Показать полное описание комнаты",

    // src/lib/components/layout/RoomHeaderOverflowMenu.svelte
    "roomHeaderOverflowMenu.moreRoomOptions": "Другие параметры комнаты",
    "roomHeaderOverflowMenu.unread": "непрочитано",
    "roomHeaderOverflowMenu.badgeThreads":
        "{count, plural, one {{badge} непрочитанное упоминание} few {{badge} непрочитанных упоминания} many {{badge} непрочитанных упоминаний} other {{badge} непрочитанных упоминания}}",
    "roomHeaderOverflowMenu.badgePinned":
        "{count, plural, one {{badge} закреплённое сообщение} few {{badge} закреплённых сообщения} many {{badge} закреплённых сообщений} other {{badge} закреплённых сообщения}}",
    "roomHeaderOverflowMenu.badgeNotifications":
        "{count, plural, one {{badge} непрочитанное уведомление} few {{badge} непрочитанных уведомления} many {{badge} непрочитанных уведомлений} other {{badge} непрочитанных уведомления}}",
    "roomHeaderOverflowMenu.badgeMedia":
        "{count, plural, one {{badge} элемент} few {{badge} элемента} many {{badge} элементов} other {{badge} элемента}}",
    "roomHeaderOverflowMenu.badgeMembers":
        "{count, plural, one {{badge} участник} few {{badge} участника} many {{badge} участников} other {{badge} участника}}",

    // src/lib/components/layout/RoomList.svelte
    "roomList.doneReordering": "Готово",
    "roomList.reorderRooms": "Изменить порядок комнат",
    "roomList.spaceSettings": "Настройки пространства",
    "roomList.sortDmsBy": "Сортировать ЛС",
    "roomList.dmSortRecent": "По последнему сообщению",
    "roomList.dmSortUnread": "Сначала непрочитанные",
    "roomList.dmSortOnline": "Сначала в сети",
    "roomList.dmSortName": "По имени (А–Я)",
    "roomList.pendingInvites": "Ожидающие приглашения",
    "roomList.inVoice": "{name} - в голосовой",
    "roomList.orderValue": "Значение порядка",
    "roomList.roomSettings": "Настройки комнаты",
    "roomList.favourites": "Избранное",
    "roomList.channels": "Комнаты",
    "roomList.rooms": "Комнаты",
    "roomList.lowPriority": "Низкий приоритет",
    "roomList.browseRooms": "Обзор комнат",
    "roomList.members": "Участников: {numMembers}",
    "roomList.requested": "Запрос отправлен",
    "roomList.cancelRequest": "Отменить запрос",
    "roomList.youCanTJoinThisRoom":
        "Вы не можете присоединиться к этой комнате напрямую - запросить вступление?",
    "roomList.notNow": "Не сейчас",
    "roomList.requestToJoin": "Запросить вступление",
    "roomList.directMessages": "Личные сообщения",
    "roomList.previewYou": "Вы: {text}",
    "roomList.noRoomsYet": "Комнат пока нет",
    "roomList.emptyCategory": "Нет комнат",
    "roomList.copyRoomLink": "Копировать ссылку на комнату",
    "roomList.markAsRead": "Отметить прочитанным",
    "roomList.addToSpace": "Добавить в пространство",
    "roomList.clickAgainToLeave": "Нажмите ещё раз, чтобы выйти",
    "roomList.clickAgainToLeaveLastMember":
        "Вы единственный участник, поэтому после вашего выхода никто не сможет присоединиться. Нажмите ещё раз, чтобы выйти",
    "roomList.leaveRoom": "Покинуть комнату",
    "roomList.couldNotSendTheJoinRequest":
        "Не удалось отправить запрос на вступление",
    "roomList.orderMustBeBetween0And":
        "Порядок должен быть от 0 до 1 - вместо этого использовано {value}.",
    "roomList.failedToSetOrder": "Не удалось задать порядок",

    // src/lib/components/layout/RoomMediaPanel.svelte
    "roomMediaPanel.media": "Медиа",
    "roomMediaPanel.closeMediaPanel": "Закрыть панель медиа",
    "roomMediaPanel.media2": "Медиа ({length}{value})",
    "roomMediaPanel.files": "Файлы ({length}{value})",
    "roomMediaPanel.tryAgain": "Повторить",
    "roomMediaPanel.play": "{name} - воспроизвести",
    "roomMediaPanel.video": "Видео",
    "roomMediaPanel.audio": "Аудио",
    "roomMediaPanel.file": "Файл",
    "roomMediaPanel.decryptingMedia": "Расшифровка медиа",
    "roomMediaPanel.decryptingMedia2": "Расшифровка медиа...",
    "roomMediaPanel.mediaCouldNotBeLoaded": "Не удалось загрузить медиа",
    "roomMediaPanel.couldNotLoadThisMedia": "Не удалось загрузить это медиа.",
    "roomMediaPanel.noMediaFoundInTheLast":
        "В последних нескольких сотнях сообщений медиа не найдено.",
    "roomMediaPanel.noFilesFoundInTheLast":
        "В последних нескольких сотнях сообщений файлов не найдено.",
    "roomMediaPanel.noImagesOrVideosInThis":
        "В этой комнате пока нет изображений и видео.",
    "roomMediaPanel.noFilesInThisRoomYet": "В этой комнате пока нет файлов.",
    "roomMediaPanel.couldNotLoadMedia": "Не удалось загрузить медиа.",
    "roomMediaPanel.couldNotLoadMoreMedia":
        "Не удалось загрузить больше медиа.",
    "roomMediaPanel.failedToDownloadAttachment": "Не удалось скачать вложение",

    // src/lib/components/layout/RoomSettings.svelte
    "roomSettings.closeSettings": "Закрыть настройки",
    "roomSettings.backToSettings": "Назад к настройкам",
    "roomSettings.settings": "{name} - Настройки",
    "roomSettings.roomAvatar": "Аватар комнаты",
    "roomSettings.roomName": "Название комнаты",
    "roomSettings.saved": "Сохранено!",
    "roomSettings.saveChanges": "Сохранить изменения",
    "roomSettings.advanced": "Дополнительно",
    "roomSettings.spaceId": "ID пространства",
    "roomSettings.roomId": "ID комнаты",
    "roomSettings.copied": "Скопировано!",
    "roomSettings.roomVersionV": "Версия комнаты: v{getVersion}",
    "roomSettings.upgradeRoom": "Обновить комнату…",
    "roomSettings.thisCreatesANewRoomOn":
        "Будет создана новая комната версии v{recommendedVersion}, а эта будет помечена как заменённая. Участники будут перенаправлены в новую комнату.",
    "roomSettings.upgrading": "Обновление…",
    "roomSettings.upgradeRoom2": "Обновить комнату",
    "roomSettings.additionalCreators": "Дополнительные создатели (комната v12)",
    "roomSettings.additionalCreatorsHint":
        "Другие пользователи, которые станут создателями обновлённой комнаты наравне с вами. В комнате v12 права создателя нельзя отнять.",
    "roomSettings.whoCanJoin": "Кто может присоединиться?",
    "roomSettings.spaceMembersAnyoneInCanJoin":
        "Участники пространства - присоединиться может любой из {parentSpaceNames}",
    "roomSettings.spaceMembersAnyoneInTheParent":
        "Участники пространства - присоединиться может любой из родительского пространства",
    "roomSettings.messageHistory": "История сообщений",
    "roomSettings.guestAccess": "Гостевой доступ",
    "roomSettings.allowGuestsToJoinWithoutAn":
        "Разрешить гостям присоединяться без учётной записи",
    "roomSettings.guestsAreAnonymousAccountsTheHomeserver":
        "Гости - это анонимные учётные записи, которые домашний сервер создаёт по требованию. Многие серверы полностью отключают гостевую регистрацию, и тогда это не действует.",
    "roomSettings.discoverability": "Обнаруживаемость",
    "roomSettings.addresses": "Адреса",
    "roomSettings.loadingAddresses": "Загрузка адресов…",
    "roomSettings.noAddressesYet": "Адресов пока нет.",
    "roomSettings.main": "Основной",
    "roomSettings.remove": "Удалить {alias}",
    "roomSettings.mainAddress": "Основной адрес",
    "roomSettings.noMainAddress": "Нет основного адреса",
    "roomSettings.set": "Задать",
    "roomSettings.myRoom": "my-room",
    "roomSettings.serverAccessControl": "Управление доступом серверов",
    "roomSettings.controlWhichHomeserversMayParticipateIn":
        "Определите, какие домашние серверы могут участвовать в этой комнате. Подстановочные знаки:",
    "roomSettings.matchesAnyCharacters": "соответствует любым символам,",
    "roomSettings.matchesOneDeniedServersAreRemoved":
        "соответствует одному. Запрещённые серверы исключаются из федерации для этой комнаты.",
    "roomSettings.noServerAclIsSetAll":
        "ACL серверов не задан. Участвовать могут все серверы.",
    "roomSettings.allowedServersOnePerLine":
        "Разрешённые серверы (по одному в строке)",
    "roomSettings.deniedServersOnePerLine":
        "Запрещённые серверы (по одному в строке)",
    "roomSettings.allowServersIdentifiedByARaw":
        "Разрешить серверы, заданные прямым IP-адресом",
    "roomSettings.saveServerAcl": "Сохранить ACL серверов",
    "roomSettings.youDoNotHavePermissionTo":
        "У вас нет прав изменять ACL серверов этой комнаты.",
    "roomSettings.appliesToTheSpaceAndAll":
        "Действует для пространства и всех его комнат.",
    "roomSettings.notificationLevel": "Уровень уведомлений",
    "roomSettings.encryption": "Шифрование",
    "roomSettings.encrypted": "Зашифровано",
    "roomSettings.notEncrypted": "Не зашифровано",
    "roomSettings.messagesInThisRoomAreEnd":
        "Сообщения в этой комнате защищены сквозным шифрованием. Это нельзя отключить.",
    "roomSettings.roomKey": "Ключ комнаты",
    "roomSettings.resetRoomKey": "Сбросить ключ комнаты",
    "roomSettings.resetRoomKeyHint":
        "Если люди не могут прочитать ваши сообщения здесь, ваше следующее сообщение будет использовать новый ключ и снова передаст его каждому сеансу в комнате.",
    "roomSettings.couldNotResetRoomKey": "Не удалось сбросить ключ комнаты",
    "roomSettings.enableEncryption": "Включить шифрование",
    "roomSettings.typeToConfirm":
        "Введите {ENABLE_ENCRYPTION_CONFIRM_PHRASE} для подтверждения",
    "roomSettings.enabling": "Включение…",
    "roomSettings.powerLevelRequiredForEachAction":
        "Уровень доступа, необходимый для каждого действия (0–100).",
    "roomSettings.nameAnyThread": "Называть любое обсуждение",
    "roomSettings.joinCallsVoiceVideo":
        "Присоединяться к звонкам (голос/видео)",
    "roomSettings.invite": "Приглашать",
    "roomSettings.searchMembers": "Поиск участников…",
    "roomSettings.banned": "Заблокированные ({length})",
    "roomSettings.pendingJoinRequests":
        "Ожидающие запросы на вступление ({length})",
    "roomSettings.deny": "Отклонить",
    "roomSettings.approve": "Одобрить",
    "roomSettings.unban": "Разблокировать",
    "roomSettings.noBannedMembers": "Заблокированных участников нет",
    "roomSettings.you": " (вы)",
    "roomSettings.setRole": "Назначить роль…",
    "roomSettings.admin100": "Администратор (100)",
    "roomSettings.moderator50": "Модератор (50)",
    "roomSettings.member0": "Участник (0)",
    "roomSettings.muted1": "Без права писать (-1)",
    "roomSettings.kick": "Исключить",
    "roomSettings.ban": "Заблокировать",
    "roomSettings.hideThisUserSMessagesEverywhere":
        "Скрывать сообщения этого пользователя везде (хранится в вашей учётной записи)",
    "roomSettings.setThe": "Задайте поле",
    "roomSettings.fieldOnEachChildRoomTo":
        "в каждой дочерней комнате, чтобы управлять порядком сортировки (лексикографическим). Оставьте пустым для сортировки по времени создания.",
    "roomSettings.suggested": "Рекомендуемая",
    "roomSettings.removeSuggestedHint": "Убрать пометку «рекомендуемая»",
    "roomSettings.markAsSuggested": "Пометить как рекомендуемую",
    "roomSettings.unsuggest": "Не рекомендовать",
    "roomSettings.suggest": "Рекомендовать",
    "roomSettings.order": "порядок",
    "roomSettings.removeFromSpace": "Убрать из пространства",
    "roomSettings.noChildRooms": "Нет дочерних комнат",
    "roomSettings.useYourGlobalNotificationSettings":
        "Использовать ваши общие настройки уведомлений.",
    "roomSettings.allMessages": "Все сообщения",
    "roomSettings.notifyForEveryMessage": "Уведомлять о каждом сообщении.",
    "roomSettings.mentionsOnly": "Только упоминания",
    "roomSettings.notifyOnlyForMentionsAndKeywords":
        "Уведомлять только об @упоминаниях и ключевых словах.",
    "roomSettings.neverNotify": "Никогда не уведомлять.",
    "roomSettings.failedToUpdateNotifications":
        "Не удалось обновить уведомления.",
    "roomSettings.failedToEnableEncryption": "Не удалось включить шифрование",
    "roomSettings.failedToSave": "Не удалось сохранить",
    "roomSettings.uploadFailed": "Не удалось загрузить",
    "roomSettings.failedToUpgradeRoom": "Не удалось обновить комнату",
    "roomSettings.failedToSaveServerAcl": "Не удалось сохранить ACL серверов",
    "roomSettings.couldNotChangeVisibility": "Не удалось изменить видимость",
    "roomSettings.couldNotLoadThisRoomS":
        "Не удалось загрузить адреса этой комнаты",
    "roomSettings.couldNotAddThatAddress": "Не удалось добавить этот адрес",
    "roomSettings.thisAddressIsPublishedAsOne":
        "Этот адрес опубликован как один из адресов комнаты, а у вас нет прав отменить его публикацию, поэтому удалить его нельзя. Обратитесь к администратору комнаты.",
    "roomSettings.couldNotRemoveThatAddress": "Не удалось удалить этот адрес",
    "roomSettings.couldNotSetTheMainAddress":
        "Не удалось задать основной адрес",
    "roomSettings.failed": "Не удалось",
    "roomSettings.muted": "Без права писать",
    "roomSettings.admin": "Администратор",
    "roomSettings.moderator": "Модератор",
    "roomSettings.member": "Участник",
    "roomSettings.creatorLabel": "Создатель",
    "roomSettings.failedToUpdateSuggestion": "Не удалось обновить рекомендацию",
    "roomSettings.listThisRoomInTheServerDirectory":
        "Показывать эту комнату в каталоге сервера",
    "roomSettings.listThisSpaceInTheServerDirectory":
        "Показывать это пространство в каталоге сервера",
    "roomSettings.listsTheRoomByIdBeingFound":
        "Показывает комнату по ID. Чтобы её находили по названию, нужен также опубликованный адрес - добавьте его ниже.",
    "roomSettings.listsTheSpaceByIdBeingFound":
        "Показывает пространство по ID. Чтобы его находили по названию, нужен также опубликованный адрес - добавьте его ниже.",
    "roomSettings.aPublishedAddressLetsPeopleFindRoom":
        "Опубликованный адрес позволяет людям находить эту комнату и присоединяться к ней по названию, а не по ID.",
    "roomSettings.aPublishedAddressLetsPeopleFindSpace":
        "Опубликованный адрес позволяет людям находить это пространство и присоединяться к нему по названию, а не по ID.",
    "roomSettings.chooseHowThisRoomNotifiesYou":
        "Выберите, как эта комната будет вас уведомлять.",
    "roomSettings.chooseHowThisSpaceNotifiesYou":
        "Выберите, как это пространство будет вас уведомлять.",

    // src/lib/components/layout/ScreenSharePicker.svelte
    "screenSharePicker.chooseWhatToShare": "Выберите, что показать",
    "screenSharePicker.noPreview": "Нет предпросмотра",
    "screenSharePicker.screens": "Экраны",
    "screenSharePicker.windows": "Окна",
    "screenSharePicker.quality": "Качество: {quality}",
    "screenSharePicker.audio": "Звук",
    "screenSharePicker.audioAuto": "Звук приложения окна или весь звук экрана",
    "screenSharePicker.audioSystemExceptZam": "Весь звук, кроме Zam",
    "screenSharePicker.audioSystem": "Весь системный звук",
    "screenSharePicker.audioApps": "Приложения",
    "screenSharePicker.audioNone": "Без звука",

    // src/lib/components/layout/ScreenShareQualityChips.svelte
    "screenShareQualityChips.resolution": "Разрешение",
    "screenShareQualityChips.frameRate": "Частота кадров",
    "screenShareQualityChips.fps": "{f} FPS",
    "screenShareQualityChips.videoCodec": "Видеокодек",
    "screenShareQualityChips.hw": "HW",
    "screenShareQualityChips.codecHardware": "Кодируется на вашей видеокарте",
    "screenShareQualityChips.codecSoftware": "Кодируется на вашем процессоре",
    "screenShareQualityChips.codecHint":
        "Для вашей камеры и демонстрации экрана. Перечислены только кодеки, которые могут воспроизвести все в звонке.",
    "screenShareQualityChips.codecBackupHint":
        "Кто-то в звонке не может воспроизвести {codec}, поэтому ему отправляется копия в H.264, что требует больше исходящего трафика.",
    "screenShareQualityChips.codecEncryptedFallbackHint":
        "Кто-то в этом зашифрованном звонке не может воспроизвести {picked}, поэтому вы отправляете {current}, пока он не выйдет.",
    "screenShareQualityChips.bitrate": "Максимальный битрейт",
    "screenShareQualityChips.bitrateUpTo": "До",
    "screenShareQualityChips.bitrateCapHint":
        "Это предел, а не цель: демонстрация использует только то, что нужно картинке и что способно передать ваше соединение, не выше этого значения.",
    "screenShareQualityChips.bitrateOverridden":
        "Используется введённая вами скорость отдачи, {upload}, поэтому предел поднимается до {max}.",
    "screenShareQualityChips.uploadOverride": "Скорость отдачи (Мбит/с)",
    "screenShareQualityChips.uploadOverrideAuto": "Авто",
    "screenShareQualityChips.uploadOverrideHint":
        "Автоматическое измерение может показывать значение заметно ниже вашей реальной скорости. Введите свою цифру, чтобы поднять предел; оставьте пустым для измерения.",
    "screenShareQualityChips.kbps": "{n} кбит/с",
    "screenShareQualityChips.mbps": "{n} Мбит/с",
    "screenShareQualityChips.bitrateMeasured":
        "Ваша скорость отдачи измерена как {upload}, поэтому предел поднимается до {max}.",
    "screenShareQualityChips.bitrateUnmeasured":
        "Скорость вашей отдачи ещё не измерена. Она измеряется, пока вы отправляете видео, поэтому пока предел поднимается до {max}.",
    "screenShareQualityChips.shareSystemAudio": "Передавать системный звук",
    "screenShareQualityChips.appliesToNextShare":
        "Применится к следующей демонстрации",
    "screenShareQualityChips.shareSystemAudioAppliesToNext":
        "Передавать системный звук (применится к следующей демонстрации)",

    // src/lib/components/layout/ScreenShareQualityPopover.svelte

    "screenShareQualityPopover.screenShareQuality":
        "Качество демонстрации экрана",

    // src/lib/components/settings/SecuritySettings.svelte
    "securitySettings.showingTheLastReadingThatLoaded":
        "Показаны последние загруженные данные - они могут быть устаревшими.",
    "securitySettings.securityEncryption": "Безопасность и шифрование",
    "securitySettings.setUpRecoverySoYourCross":
        "Настройте восстановление, чтобы ваша идентичность перекрёстной подписи и история зашифрованных сообщений сохранялись после выхода на всех устройствах.",
    "securitySettings.verification": "Подтверждение",
    "securitySettings.loadingEncryptionStatus":
        "Загрузка состояния шифрования…",
    "securitySettings.encryptionStatusUnknownOnThisSession":
        "Состояние шифрования в этом сеансе неизвестно.",
    "securitySettings.recoveryKeyId": "ID ключа восстановления:",
    "securitySettings.setUpRecovery": "Настроить восстановление",
    "securitySettings.approveOnAccountPageHint":
        "Ваш сервер может попросить подтвердить это на странице учётной записи.",
    "securitySettings.approveOnAccountPage":
        "Подтвердите на странице учётной записи",
    "securitySettings.approveOnAccountPageBody":
        "Вашему серверу нужно, чтобы вы разрешили это изменение. Откройте страницу учётной записи, подтвердите сброс вашей криптографической идентичности, затем вернитесь и продолжите.",
    "securitySettings.approveOnAccountPageRetry":
        "Сервер ещё не получил подтверждение. Подтвердите на странице учётной записи, затем продолжайте.",
    "securitySettings.openAccountPage": "Открыть страницу учётной записи",
    "securitySettings.iVeApprovedIt": "Я подтвердил(а)",
    "securitySettings.weLlCreateA": "Мы создадим",
    "securitySettings.recoveryKey": "ключ восстановления",
    "securitySettings.aOneTimeCodeThatUnlocks":
        "- одноразовый код, который открывает вашу зашифрованную историю и подтверждает новые сеансы. Храните его в надёжном месте, например в менеджере паролей; он показывается только один раз, и мы не сможем восстановить его за вас.",
    "securitySettings.confirmYourAccountPasswordToCreate":
        "Подтвердите пароль от учётной записи, чтобы создать ключи шифрования.",
    "securitySettings.accountPassword": "Пароль от учётной записи",
    "securitySettings.alsoLetMeUnlockWithA":
        "Также разрешить мне разблокировать с помощью парольной фразы, которую я выберу (необязательно - ключ восстановления всё равно работает и всё равно будет показан).",
    "securitySettings.recoveryPassphrase": "Парольная фраза восстановления",
    "securitySettings.atLeastCharactersWeCanT":
        "Не менее {MIN_PASSPHRASE_LENGTH} символов. Мы не сможем сбросить её за вас.",
    "securitySettings.settingUp": "Настройка…",
    "securitySettings.continue": "Продолжить",
    "securitySettings.saveYourRecoveryKey": "Сохраните ключ восстановления",
    "securitySettings.thisIsShown": "Он показывается",
    "securitySettings.onlyOnce": "только один раз",
    "securitySettings.storeItNowWithoutItYou":
        ". Сохраните его сейчас - без него вы не сможете восстановить зашифрованную историю, если потеряете доступ к своим сеансам.",
    "securitySettings.copied": "Скопировано",
    "securitySettings.copyKey": "Копировать ключ",
    "securitySettings.youCanAlsoUnlockWithThe":
        "Вы также можете разблокировать с помощью выбранной парольной фразы. Всё равно сохраните ключ - это единственный способ войти, если вы забудете парольную фразу.",
    "securitySettings.iVeSavedMyRecoveryKey":
        "Я сохранил(а) ключ восстановления в надёжном месте.",
    "securitySettings.done": "Готово",
    "securitySettings.keysNotOnServer":
        "Ваши ключи перекрёстной подписи не дошли до сервера",
    "securitySettings.keysNotOnServerHint":
        "Этот сеанс создал их при настройке восстановления, но загрузка не завершилась, поэтому ваши сеансы не могут подтверждать друг друга. Загрузите их сейчас, чтобы это исправить.",
    "securitySettings.uploadKeys": "Загрузить ключи",
    "securitySettings.couldNotUploadKeys": "Не удалось загрузить ваши ключи",
    "securitySettings.recoveryIsSetUp": "Восстановление настроено",
    "securitySettings.yourCrossSigningKeysAndA":
        "Ваши ключи перекрёстной подписи и резервная копия ключей надёжно хранятся на сервере и защищены вашим ключом восстановления.",
    "securitySettings.recoveryIsNotSetUp": "Восстановление не настроено",
    "securitySettings.thisAccountHasNoRecoveryKey":
        "У этой учётной записи нет ключа восстановления и резервной копии ключей, пока вы не выполните шаг ниже.",
    "securitySettings.lostYourRecoveryKeyResetRecovery":
        "Потеряли ключ восстановления? Сбросить восстановление",
    "securitySettings.resettingCreatesA": "Сброс создаёт",
    "securitySettings.new": "новый",
    "securitySettings.recoveryKeyAndReplacesYourCurrent":
        "ключ восстановления и заменяет вашу текущую резервную копию. Ваш старый ключ восстановления перестанет работать, а другие сеансы, возможно, придётся подтверждать заново. Делайте это, только если вы потеряли текущий ключ.",
    "securitySettings.yourOldRecoveryKeyAndBackup":
        "Ваш старый ключ восстановления и резервная копия сброшены, но новое восстановление не создано. Завершите его настройку сейчас - пока вы этого не сделаете, ваши сообщения нельзя будет восстановить в новом сеансе.",
    "securitySettings.working": "Выполняется…",
    "securitySettings.finishSettingUpRecovery":
        "Завершить настройку восстановления",
    "securitySettings.confirmYourAccountPasswordToReset":
        "Подтвердите пароль от учётной записи, чтобы сбросить восстановление.",
    "securitySettings.resetting": "Сброс…",
    "securitySettings.resetCreateNewKey": "Сбросить и создать новый ключ",
    "securitySettings.messageHistoryBackup":
        "Резервная копия истории сообщений",
    "securitySettings.verifyThisSessionRestoreHistory":
        "Подтвердить этот сеанс и восстановить историю",
    "securitySettings.recoveryKey2": "Ключ восстановления",
    "securitySettings.passphrase": "Парольная фраза",
    "securitySettings.enterYour": "Введите вашу",
    "securitySettings.recoveryPassphrase2": "парольную фразу восстановления",
    "securitySettings.toVerifyThisSessionAndRestore":
        ", чтобы подтвердить этот сеанс и восстановить историю зашифрованных сообщений.",
    "securitySettings.thisSessionIsNowVerified":
        "Этот сеанс теперь подтверждён",
    "securitySettings.encryptedHistoryRestored":
        "Зашифрованная история восстановлена",
    "securitySettings.couldNotSetUpRecovery":
        "Не удалось настроить восстановление",
    "securitySettings.couldNotResetRecovery":
        "Не удалось сбросить восстановление",
    "securitySettings.couldNotFinishSettingUpRecovery":
        "Не удалось завершить настройку восстановления",
    "securitySettings.couldNotVerifyThisSession":
        "Не удалось подтвердить этот сеанс",

    // src/lib/components/settings/ServerSettings.svelte
    "serverSettings.scanningServer": "Сканирование сервера…",
    "serverSettings.what": "Что",
    "serverSettings.advertisesItemsMarkedUnknownArenT":
        "объявляет. Пункты с пометкой «Неизвестно» сервер не объявляет, и они определяются только при использовании.",
    "serverSettings.accountMessaging": "Учётная запись и сообщения",
    "serverSettings.voiceVideoCallingMatrixrtc":
        "Голосовые / видеозвонки (MatrixRTC)",
    "serverSettings.server": "Сервер",
    "serverSettings.latestSpecVersion": "Последняя версия спецификации",
    "serverSettings.defaultRoomVersion": "Версия комнаты по умолчанию",
    "serverSettings.advertisedFeatures": "Объявленные возможности ({length})",
    "serverSettings.supported": "Поддерживается",
    "serverSettings.notSupported": "Не поддерживается",
    "serverSettings.unknown": "Неизвестно",
    "serverSettings.changePassword": "Смена пароля",
    "serverSettings.changeDisplayName": "Смена отображаемого имени",
    "serverSettings.changeAvatar": "Смена аватара",
    "serverSettings.manageEmailsPhoneNumbers":
        "Управление адресами почты / номерами телефонов",
    "serverSettings.threads": "Обсуждения",
    "serverSettings.privateReadReceipts": "Приватные отметки о прочтении",
    "serverSettings.sfuDiscoveryRtcFoci": "Обнаружение SFU (rtc_foci)",
    "serverSettings.delayedEventsCallCleanup":
        "Отложенные события (очистка звонков)",
    "serverSettings.failedToReadServerCapabilities":
        "Не удалось получить возможности сервера",

    // src/lib/components/settings/SessionSettings.svelte
    "sessionSettings.sessionName": "Название сеанса",
    "sessionSettings.current": "Текущий",
    "sessionSettings.rename": "Переименовать",
    "sessionSettings.signOut": "Выйти?",
    "sessionSettings.signOut2": "Выйти",
    "sessionSettings.manageAtProvider": "Управление",
    "sessionSettings.confirmYourAccountPasswordToSign":
        "Подтвердите пароль от учётной записи, чтобы завершить этот сеанс.",
    "sessionSettings.accountPassword": "Пароль от учётной записи",
    "sessionSettings.signingOut": "Выход…",
    "sessionSettings.encryption": "Шифрование",
    "sessionSettings.active": "Активно",
    "sessionSettings.unavailable": "Недоступно",
    "sessionSettings.thisDeviceSKey": "Ключ этого устройства",
    "sessionSettings.loadingDeviceKey": "Загрузка ключа устройства…",
    "sessionSettings.endToEndEncryptionCouldNot":
        "Не удалось запустить сквозное шифрование в этом сеансе. Вместо зашифрованных комнат будут показаны заглушки.",
    "sessionSettings.encryptNewDirectMessages": "Шифровать новые личные чаты",
    "sessionSettings.newDmsYouStartAreEncrypted":
        "Новые личные чаты, которые вы начинаете, по умолчанию шифруются. Существующие чаты не меняются. Выключите, если вы пишете людям, чьи клиенты не поддерживают шифрование.",
    "identityChange.own":
        "Ваши ключи перекрёстной подписи изменились. Подтвердите этот сеанс заново или сбросьте и заново подпишите свои устройства, прежде чем доверять зашифрованным сообщениям.",
    "identityChange.other":
        "Идентичность перекрёстной подписи пользователя {user} изменилась. Зашифрованные сообщения ему задерживаются, пока вы не примете новую идентичность.",
    "identityChange.accept": "Принять новую идентичность",
    "identityChange.withdraw": "Отозвать подтверждение",
    "identityChange.dismiss": "Скрыть предупреждение об идентичности",
    "sessionSettings.excludeInsecureDevices":
        "Исключить устройства без перекрёстной подписи",
    "sessionSettings.excludeInsecureDevicesHelp":
        "Передавать ключи сообщений и показывать сообщения только с тех устройств, которые их владелец подписал перекрёстной подписью (MSC4153). Сообщения с устройств без перекрёстной подписи будут показаны как не поддающиеся расшифровке.",
    "sessionSettings.onlySendToVerifiedDevices":
        "Отправлять только на подтверждённые устройства",
    "sessionSettings.refuseToEncryptMessagesForSessions":
        "Отказываться шифровать сообщения для сеансов, которые вы не подтвердили. Они не получат ваши сообщения вообще - в том числе ваши собственные неподтверждённые сеансы. По умолчанию выключено.",
    "sessionSettings.devicesCurrentlySignedInToThis":
        "Устройства, на которых сейчас выполнен вход в эту учётную запись.",
    "sessionSettings.refreshing": "Обновление…",
    "sessionSettings.refresh": "Обновить",
    "sessionSettings.loadingSessions": "Загрузка сеансов…",
    "sessionSettings.otherSessions": "Другие сеансы {value}",
    "sessionSettings.noOtherSessionsYouReOnly":
        "Других сеансов нет - вы вошли только здесь.",
    "sessionSettings.failedToLoadSessions": "Не удалось загрузить сеансы",
    "sessionSettings.failedToRenameSession": "Не удалось переименовать сеанс",
    "sessionSettings.failedToSignOutSession": "Не удалось завершить сеанс",
    "sessionSettings.couldNotStartVerification":
        "Не удалось начать подтверждение",

    // src/lib/components/messages/ShareLocationDialog.svelte
    "shareLocationDialog.shareLocation": "Поделиться местоположением",
    "shareLocationDialog.sendOnce": "Отправить один раз",
    "shareLocationDialog.shareLive": "Делиться в реальном времени",
    "shareLocationDialog.locating": "Определение местоположения…",
    "shareLocationDialog.useMyCurrentLocation":
        "Использовать моё текущее местоположение",
    "shareLocationDialog.descriptionOptional": "Описание (необязательно)",
    "shareLocationDialog.eGHomeTheCafOn": "например, Дом, кафе на углу…",
    "shareLocationDialog.duration": "Длительность",
    "shareLocationDialog.yourLiveLocationIsSharedWith":
        "Ваше местоположение в реальном времени доступно этой комнате, пока вы не остановите передачу или не истечёт таймер.",
    "shareLocationDialog.sharing": "Отправка…",
    "shareLocationDialog.share": "Поделиться",
    "shareLocationDialog.failedToStartLiveLocation":
        "Не удалось начать передачу местоположения в реальном времени",
    "shareLocationDialog.failedToShareLocation":
        "Не удалось поделиться местоположением",

    // src/lib/components/messages/ShareTargetSheet.svelte
    "shareTargetSheet.fileSWerenTAddedShares":
        "Файлов не добавлено: {droppedFiles}. Можно отправить не более {SHARE_MAX_FILES} файлов, до {value} МБ каждый и {value2} МБ в сумме.",
    "shareTargetSheet.addAMessage": "Добавьте сообщение…",
    "shareTargetSheet.searchRooms": "Поиск комнат",
    "shareTargetSheet.noJoinedRoomsFound":
        "Комнаты, в которых вы состоите, не найдены",
    "shareTargetSheet.send": "Отправить",
    "shareTargetSheet.shareToARoom": "Отправить в комнату",

    // src/lib/components/layout/SpaceLandingPanel.svelte
    "spaceLandingPanel.yourRooms": "Ваши комнаты",
    "spaceLandingPanel.loadingRooms": "Загрузка комнат…",
    "spaceLandingPanel.browseRooms": "Обзор комнат",
    "spaceLandingPanel.youHavenTJoinedARoom":
        "Вы ещё не присоединились ни к одной комнате в {spaceName}. Выберите любую, чтобы начать.",
    "spaceLandingPanel.nothingJoinedHereYet":
        "Здесь вы пока ни к чему не присоединились",
    "spaceLandingPanel.onlyOtherSpacesLiveInsideOpen":
        "Внутри {spaceName} находятся только другие пространства; откройте одно из них в списке комнат, чтобы просмотреть его комнаты.",
    "spaceLandingPanel.thereAreNoRoomsInYet": "В {spaceName} пока нет комнат.",
    "spaceLandingPanel.thisSpace": "этом пространстве",
    "spaceLandingPanel.couldnTJoinTryItFrom":
        "Не удалось присоединиться к {value}. Попробуйте через «Обзор комнат» в списке комнат.",
    "spaceLandingPanel.thatRoom": "этой комнате",

    // src/lib/components/layout/SpaceSidebar.svelte
    "spaceSidebar.home": "Дом",
    "spaceSidebar.addASpace": "Добавить пространство",
    "spaceSidebar.exploreRooms": "Обзор комнат",
    "spaceSidebar.folderColor": "Цвет папки",
    "spaceSidebar.createRoomInSpace": "Создать комнату в пространстве",
    "spaceSidebar.roomName": "Название комнаты",
    "spaceSidebar.myRoom": "my-room",
    "spaceSidebar.optional": "(необязательно)",
    "spaceSidebar.whatSThisRoomAbout": "О чём эта комната?",
    "spaceSidebar.opensStraightIntoACallMessages":
        "Сразу открывается звонок. Сообщения тоже работают.",
    "spaceSidebar.create": "Создать",
    "spaceSidebar.addExistingRoomToSpace":
        "Добавить существующую комнату в пространство",
    "spaceSidebar.noRoomsAvailableToAdd": "Нет комнат, которые можно добавить.",
    "spaceSidebar.spaceSettings": "Настройки пространства",
    "spaceSidebar.copySpaceLink": "Копировать ссылку на пространство",
    "spaceSidebar.markAsRead": "Отметить прочитанным",
    "spaceSidebar.createRoom": "Создать комнату",
    "spaceSidebar.addExistingRoom": "Добавить существующую комнату",
    "spaceSidebar.removeFromFolder": "Убрать из папки",
    "spaceSidebar.newFolder": "Новая папка",
    "spaceSidebar.clickAgainToLeave": "Нажмите ещё раз, чтобы выйти",
    "spaceSidebar.clickAgainToLeaveLastMember":
        "Вы единственный участник, поэтому после вашего выхода никто не сможет присоединиться к этому пространству. Нажмите ещё раз, чтобы выйти",
    "spaceSidebar.leaveSpace": "Покинуть пространство",
    "spaceSidebar.setColor": "Задать цвет",
    "spaceSidebar.dissolveFolder": "Расформировать папку",
    "spaceSidebar.somethingWentWrong": "Что-то пошло не так",

    // src/lib/components/layout/Splash.svelte
    "splash.restoringSession": "Восстановление сеанса…",

    // src/lib/components/ui/StickerPicker.svelte
    "stickerPicker.searchStickers": "Поиск стикеров…",
    "stickerPicker.searchStickers2": "Поиск стикеров",
    "stickerPicker.noStickerPacksAvailable": "Нет доступных наборов стикеров",
    "stickerPicker.myStickers": "Мои стикеры",
    "stickerPicker.myStickers2": "Мои стикеры",

    // src/lib/components/ui/SwfEmbed.svelte
    "swfEmbed.adobeFlash": "Adobe Flash",

    // src/lib/components/settings/ThemeColorEditor.svelte
    "themeColorEditor.themeColors": "Цвета темы",
    "themeColorEditor.presetName": "Название пресета",
    "themeColorEditor.savePreset": "Сохранить пресет",
    "themeColorEditor.import": "Импорт",
    "themeColorEditor.pasteThemeCode": "Вставьте код темы",
    "themeColorEditor.copyCurrentPresetToClipboard":
        "Скопировать текущий пресет в буфер обмена",
    "themeColorEditor.copied": "Скопировано!",
    "themeColorEditor.presets": "Пресеты",
    "themeColorEditor.delete": "Удалить?",
    "themeColorEditor.confirmDelete": "Подтвердите удаление {name}",
    "themeColorEditor.rename": "Переименовать",
    "themeColorEditor.delete2": "Удалить {name}",
    "themeColorEditor.builtInPresetsAreReadOnly":
        "Встроенные пресеты доступны только для чтения. Создайте копию, чтобы настроить:",
    "themeColorEditor.duplicateToCustomize": "Создать копию для настройки",
    "themeColorEditor.colors": "Цвета",
    "themeColorEditor.backgrounds": "Фоны",
    "themeColorEditor.resetToDefault": "Сбросить по умолчанию",
    "themeColorEditor.text": "Текст",
    "themeColorEditor.accentsSemantics": "Акценты и смысловые цвета",
    "themeColorEditor.presence": "Присутствие",
    "themeColorEditor.details": "Детали",
    "themeColorEditor.contrastWarnings": "Предупреждения о контрасте",
    "themeColorEditor.messageDisplay": "Отображение сообщений",
    "themeColorEditor.savedOnThisDeviceOnlyNot":
        "Сохраняется только на этом устройстве. Не синхронизируется с вашей учётной записью.",
    "themeColorEditor.appTextSize": "Размер текста в приложении: {round}%",
    "themeColorEditor.scalesAllTextAndSpacingAcross":
        "Масштабирует весь текст и отступы в приложении.",
    "themeColorEditor.font": "Шрифт",
    "themeColorEditor.custom": "Свой - {customFontName}",
    "themeColorEditor.replaceCustomFont": "Заменить свой шрифт…",
    "themeColorEditor.uploadCustomFont": "Загрузить свой шрифт…",
    "themeColorEditor.woff2TtfOrOtfUpTo":
        ".woff2, .ttf или .otf до 10 МБ. Хранится только на этом устройстве.",
    "themeColorEditor.theQuickBrownFoxJumpsOver":
        "Съешь ещё этих мягких французских булок, да выпей чаю.",
    "themeColorEditor.cannotSavePreset": "Не удаётся сохранить пресет",
    "themeColorEditor.notAValidThemeCode": "Недействительный код темы",
    "themeColorEditor.imported": "Импортировано",
    "themeColorEditor.cannotImportPreset": "Не удаётся импортировать пресет",
    "themeColorEditor.copy": "{activePresetName} (копия)",

    // src/lib/components/layout/ThreadPanel.svelte
    "threadPanel.thread": "Обсуждение",
    "threadPanel.collapseThread": "Свернуть обсуждение",
    "threadPanel.expandThread": "Развернуть обсуждение",
    "threadPanel.closeThread": "Закрыть обсуждение",
    "threadPanel.noRepliesYetStartTheThread":
        "Ответов пока нет. Начните обсуждение ниже.",
    "threadPanel.loadOlderReplies": "Загрузить более старые ответы",

    // src/lib/components/layout/ThreadsListPanel.svelte
    "threadsListPanel.threads": "Обсуждения",
    "threadsListPanel.closeThreadsPanel": "Закрыть панель обсуждений",
    "threadsListPanel.noThreadsInThisRoomYet":
        "В этой комнате пока нет обсуждений.",
    "threadsListPanel.youParticipated": "Вы участвовали",
    "threadsListPanel.unreadMentions": "Непрочитанные упоминания",
    "threadsListPanel.unreadReplies": "Непрочитанные ответы",
    "threadsListPanel.couldnTLoadThreadsForThis":
        "Не удалось загрузить обсуждения этой комнаты.",
    "threadsListPanel.unknownSender": "Неизвестно",
    "threadsListPanel.allThreads": "Все обсуждения",
    "threadsListPanel.myThreads": "Мои обсуждения",
    "threadsListPanel.filterThreads": "Фильтр обсуждений",
    "threadsListPanel.noThreadsYouParticipatedIn":
        "Вы не начинали обсуждений и не отвечали ни в одном из них здесь.",

    // src/lib/components/layout/StorageBanner.svelte
    "storageBanner.outOfStorage":
        "На вашем устройстве закончилось место. Zam не может сохранять сообщения и ключи шифрования, пока вы не освободите место.",
    "storageBanner.lowStorage":
        "На вашем устройстве почти закончилось место (осталось {free}). Освободите место поскорее, иначе Zam не сможет сохранять сообщения и ключи шифрования.",
    "storageBanner.checkAgain": "Проверить снова",
    "storageBanner.dismissLowStorageWarning":
        "Скрыть предупреждение о нехватке места",

    // src/lib/components/layout/UpdateBanner.svelte
    "updateBanner.dismissUpdateNotification":
        "Скрыть уведомление об обновлении",
    "updateBanner.installFailed": "Не удалось установить",

    // src/lib/components/ui/UserPicker.svelte
    "userPicker.remove": "Удалить {userId}",
    "userPicker.searching": "Поиск…",
    "userPicker.noMatchingUsers": "Подходящих пользователей нет",
    "userPicker.available":
        "{optionCount, plural, one {Доступен # результат} few {Доступно # результата} many {Доступно # результатов} other {Доступно # результата}}",
    "userPicker.invite": "Пригласить {candidateShown}",
    "userPicker.alreadyAdded": "Уже добавлен",
    "userPicker.alreadyInThisRoom": "Уже в этой комнате",
    "userPicker.sendAnInviteToThisExact":
        "Отправить приглашение по этому точному ID пользователя",
    "userPicker.noMatchesTypeAFullUser":
        "Совпадений нет. Введите полный ID пользователя, например",
    "userPicker.userServer": "@user:server",
    "userPicker.toInviteSomeoneTheDirectoryDoesn":
        ", чтобы пригласить того, кого нет в каталоге.",
    "userPicker.searchForPeople": "Поиск людей…",
    "userPicker.userSearchFailedYouCanStill":
        "Не удалось выполнить поиск пользователей - вы по-прежнему можете ввести полный ID пользователя.",

    // src/lib/components/ui/UserProfileCard.svelte
    "userProfileCard.copyUserId": "Копировать ID пользователя",
    "userProfileCard.copied": "Скопировано",
    "userProfileCard.localTime": "Местное время {localTime} ({timezone})",
    "userProfileCard.notAMemberOfThisRoom": "Не участник этой комнаты",
    "userProfileCard.powerLevel": "Уровень доступа: {level}",
    "userProfileCard.powerLevelCreator": "Уровень доступа: Создатель",
    "userProfileCard.mutualRooms": "Общие комнаты: {total}",
    "userProfileCard.more": "ещё +{moreCount}",
    "userProfileCard.sessions": "Сеансы",
    "userProfileCard.sessionsCount": "Сеансы: {total}",
    "userProfileCard.refreshSessions": "Запросить у сервера его текущие сеансы",
    "userProfileCard.noKnownSessions":
        "Этот сеанс не знает ни одного из его сеансов, поэтому он не может читать ваши зашифрованные сообщения.",
    "userProfileCard.couldNotLoadSessions": "Не удалось загрузить его сеансы",
    "userProfileCard.keysChanged": "Ключи изменились",
    "userProfileCard.keysChangedHint":
        "У сеанса с пометкой «Ключи изменились» новые ключи, которые этот сеанс не смог принять. Возможно, ему нужно выйти и войти снова.",
    "userProfileCard.opening": "Открытие…",
    "userProfileCard.message": "Написать",
    "userProfileCard.verifyUser": "Подтвердить пользователя",
    "userProfileCard.editProfile": "Изменить профиль",
    "userProfileCard.kicking": "Исключение…",
    "userProfileCard.confirmKick": "Подтвердить исключение?",
    "userProfileCard.kick": "Исключить",
    "userProfileCard.banning": "Блокировка…",
    "userProfileCard.confirmBan": "Подтвердить блокировку?",
    "userProfileCard.ban": "Заблокировать",
    "userProfileCard.couldNotStartVerification":
        "Не удалось начать подтверждение",
    "userProfileCard.couldNotCopyToClipboard":
        "Не удалось скопировать в буфер обмена",
    "userProfileCard.couldNotOpenDm": "Не удалось открыть личный чат",
    "userProfileCard.couldNotKick": "Не удалось исключить",
    "userProfileCard.couldNotBan": "Не удалось заблокировать",

    // src/lib/components/layout/VerificationModal.svelte
    "verificationModal.thisSessionIsNowTrusted":
        "Этому сеансу теперь доверяют.",
    "verificationModal.theirIdentityIsNowVerified":
        "Идентичность собеседника теперь подтверждена.",
    "verificationModal.noTrustWasEstablishedYouCan":
        "Доверие не установлено. Вы можете начать заново в любое время.",
    "verificationModal.didYourOtherSessionJustScan":
        "Ваш другой сеанс только что отсканировал этот код?",
    "verificationModal.didJustScanThisCode":
        "{otherUserId} только что отсканировал(а) этот код?",
    "verificationModal.onlyConfirmIfYouScannedIt":
        "Подтверждайте, только если вы сами отсканировали его только что.",
    "verificationModal.onlyConfirmIfYouWatchedThem":
        "Подтверждайте, только если вы видели, как собеседник только что отсканировал его.",
    "verificationModal.no": "Нет",
    "verificationModal.yesIScannedIt": "Да, я отсканировал(а)",
    "verificationModal.deviceWithThisUser": "устройстве этого пользователя",
    "verificationModal.confirmTheSameEmojiAppearIn":
        "Убедитесь, что на {value} показаны те же эмодзи в том же порядке.",
    "verificationModal.theyDonTMatch": "Не совпадают",
    "verificationModal.confirming": "Подтверждение…",
    "verificationModal.theyMatch": "Совпадают",
    "verificationModal.verificationCodeForYourOtherSession":
        "Код подтверждения для вашего другого сеанса",
    "verificationModal.verificationCodeFor":
        "Код подтверждения для {otherUserId}",
    "verificationModal.scanThisWithYourOtherSession":
        "Отсканируйте его в другом сеансе.",
    "verificationModal.askThemToScanThisCode":
        "Попросите собеседника отсканировать этот код.",
    "verificationModal.noCodeToShowRightNow": "Сейчас нет кода для показа.",
    "verificationModal.couldNotLoadTheScanner": "Не удалось загрузить сканер.",
    "verificationModal.scanAgain": "Сканировать снова",
    "verificationModal.compareAShortListOfEmoji":
        "Сравните короткий список эмодзи для подтверждения или используйте QR-код.",
    "verificationModal.compareEmoji": "Сравнить эмодзи",
    "verificationModal.showACodeForTheOther":
        "Показать код, чтобы его отсканировала другая сторона",
    "verificationModal.scanTheirCodeWithTheCamera":
        "Отсканировать их код камерой",
    "verificationModal.chooseADifferentMethod": "Выбрать другой способ",
    "verificationModal.waitingForTheOtherSideTo":
        "Ожидание подтверждения от другой стороны…",
    "verificationModal.verifyYourOtherSession": "Подтвердите ваш другой сеанс",
    "verificationModal.verify": "Подтвердить {value}",
    "verificationModal.couldNotConfirmTheMatch":
        "Не удалось подтвердить совпадение",
    "verificationModal.couldNotReportTheMismatch":
        "Не удалось сообщить о несовпадении",
    "verificationModal.session": "сеансе",

    // src/lib/components/layout/VideoTile.svelte
    "videoTile.fullscreen": "На весь экран",
    "videoTile.pictureInPicture": "Картинка в картинке",
    "videoTile.exitPictureInPicture": "Выйти из режима «картинка в картинке»",

    // src/lib/components/settings/VoiceAudioSettings.svelte
    "voiceAudioSettings.inputDevice": "Устройство ввода",
    "voiceAudioSettings.savedMicrophoneNotFoundUsingThe":
        "Сохранённый микрофон не найден - до его возвращения используется микрофон по умолчанию.",
    "voiceAudioSettings.microphoneLevel": "Уровень микрофона",
    "voiceAudioSettings.stopTest": "Остановить тест",
    "voiceAudioSettings.testMic": "Проверить микрофон",
    "voiceAudioSettings.outputDevice": "Устройство вывода",
    "voiceAudioSettings.chooseOutputDevice": "Выберите устройство вывода…",
    "voiceAudioSettings.audioOutputIsRoutedByThe":
        "На этой платформе вывод звука направляется операционной системой.",
    "voiceAudioSettings.testSpeaker": "Проверить динамик",
    "voiceAudioSettings.callVolume": "Громкость звонка",
    "voiceAudioSettings.incomingCallAudio": "Входящий звук звонка",
    "voiceAudioSettings.incomingCallAudioIfThisMoves":
        "Входящий звук звонка - если индикатор движется, но вы ничего не слышите, проверьте выбранное устройство вывода и системную громкость.",
    "voiceAudioSettings.voiceProcessing": "Обработка голоса",
    "voiceAudioSettings.noiseSuppression": "Шумоподавление",
    "voiceAudioSettings.nsFastEnhancer": "FastEnhancer",
    "voiceAudioSettings.nsFastEnhancerHint":
        "Работает на вашем устройстве и поставляется вместе с приложением, поэтому ничего скачивать не нужно. Компактный и стабильный: поддерживает ровную громкость голоса. Вариант по умолчанию.",
    "voiceAudioSettings.nsFastEnhancerUnsupported":
        "Этот браузер не может запустить FastEnhancer, поэтому используется RNNoise.",
    "voiceAudioSettings.nsFastEnhancerTiny": "FastEnhancer Tiny",
    "voiceAudioSettings.nsFastEnhancerTinyHint":
        "Уменьшенный FastEnhancer, использующий примерно треть мощности процессора. Очищает чуть меньше; всё равно стабильнее RNNoise.",
    "voiceAudioSettings.noiseSuppressionGpu": "Ускорение на GPU",
    "voiceAudioSettings.noiseSuppressionGpuHint":
        "Выполняет шумоподавление на видеокарте, разгружая процессор. Добавляет около 11 мс задержки. Переключается обратно на процессор, если GPU не справляется.",
    "voiceAudioSettings.nsRnnoise": "RNNoise",
    "voiceAudioSettings.nsRnnoiseHint":
        "Работает на вашем устройстве и поставляется вместе с приложением, поэтому ничего скачивать не нужно. Компактный и стабильный: поддерживает ровную громкость голоса.",
    "voiceAudioSettings.nsRnnoiseUnsupported":
        "Этот браузер не может запустить RNNoise, поэтому используется собственное шумоподавление браузера.",
    "voiceAudioSettings.nsDeepFilter": "DeepFilterNet3",
    "voiceAudioSettings.nsPluginHint":
        "Удаление шума с помощью плагина, работающего на вашем устройстве. Там, где он не может работать, вместо него используется FastEnhancer.",
    "voiceAudioSettings.nsPluginUnavailable":
        "Плагин для этого фильтра шума не включён, поэтому используется FastEnhancer.",
    "voiceAudioSettings.nsPluginCantRun":
        "Этот фильтр шума не может работать на этом устройстве, поэтому используется FastEnhancer.",
    "voiceAudioSettings.nsPluginUnsupported":
        "Этот браузер не может запускать плагины фильтров шума, поэтому используется собственное шумоподавление браузера.",
    "voiceAudioSettings.nsPluginMissing": "Фильтр из плагина (не включён)",
    "voiceAudioSettings.nsBrowser": "Браузер",
    "voiceAudioSettings.nsOff": "Выкл.",
    "voiceAudioSettings.nsDeepFilterHint":
        "ИИ-шумоподавление, работающее на вашем устройстве. При первом использовании загружает около 11 МБ.",
    "voiceAudioSettings.nsDeepFilterUnsupported":
        "Этот браузер не может запустить DeepFilterNet3, поэтому используется собственное шумоподавление браузера.",
    "voiceAudioSettings.nsBrowserHint":
        "Встроенное шумоподавление вашего браузера. Убирает только ровный фоновый гул.",
    "voiceAudioSettings.nsOffHint":
        "Ваш микрофон передаётся без шумоподавления.",
    "voiceAudioSettings.echoCancellation": "Эхоподавление",
    "voiceAudioSettings.autoGainControl": "Автоматическая регулировка усиления",
    "voiceAudioSettings.agcNormalize": "Нормализация",
    "voiceAudioSettings.agcNormalizeHint":
        "То же выравнивание громкости, что применяется к входящим голосам, но для вашего микрофона после шумоподавления. Не затрагивает системную громкость микрофона.",
    "voiceAudioSettings.agcZam": "AGC2",
    "voiceAudioSettings.agcBrowser": "Браузер",
    "voiceAudioSettings.agcOff": "Выкл.",
    "voiceAudioSettings.agcZamHint":
        "AGC2 из WebRTC, применяется после шумоподавления. Выравнивает ваш голос, не затрагивая системную громкость микрофона.",
    "voiceAudioSettings.agcBrowserHint":
        "Встроенная АРУ вашего браузера. Может менять системную громкость микрофона.",
    "voiceAudioSettings.agcOffHint":
        "Ваш микрофон передаётся с тем уровнем, который задаёт система.",
    "voiceAudioSettings.normalizeVoices": "Выравнивать громкость голосов",
    "voiceAudioSettings.normalizeVoicesHint":
        "Автоматически делает тихих людей громче, а громких - тише, чтобы вам не приходилось настраивать громкость каждого вручную.",
    "voiceAudioSettings.pushToTalk": "Рация",
    "voiceAudioSettings.pushToTalkHint":
        "В звонках микрофон передаёт звук, только пока зажата клавиша «рации».",
    "voiceAudioSettings.pushToTalkNoKey":
        "Для работы «рации» нужно назначить клавишу.",
    "voiceAudioSettings.pushToTalkSetKey": "Назначить клавишу «рации»",
    "voiceAudioSettings.camera": "Камера",
    "voiceAudioSettings.cameraDisabled": "Отключена",
    "voiceAudioSettings.mirrorMyCamera": "Зеркалить мою камеру",
    "voiceAudioSettings.flipYourOwnPreviewOthersAlways":
        "Отражает ваш собственный предпросмотр. Другие всегда видят вас без отражения.",
    "voiceAudioSettings.cannotWatch": "Видео, которое я не могу смотреть",
    "voiceAudioSettings.cannotWatchHint":
        "Выберите кодеки, которые на этом устройстве ничего не показывают (или показывают чёрную картинку). Остальные в звонке будут присылать вам H.264. Zam также заполняет это сам, когда поток приходит, но никогда не декодируется.",
    "voiceAudioSettings.videoCodec": "Видеокодек",
    "voiceAudioSettings.videoCodecHint":
        "В каком виде отправляются ваша камера и демонстрация экрана. «Автоматически» выбирает лучший кодек, который кодирует ваш GPU и который могут воспроизвести все в звонке. Тот, кто не может его воспроизвести, получает копию в H.264, а переключить кодек можно и из звонка. Применяется при следующем включении.",
    "voiceAudioSettings.videoCodecAuto": "Автоматически",
    "voiceAudioSettings.adaptiveStream": "Адаптивное качество видео",
    "voiceAudioSettings.adaptiveStreamHint":
        "Получать каждое видео в том размере, в каком оно показывается, и приостанавливать видео, которого нет на экране или пока Zam свёрнут. Экономит трафик и ресурсы декодирования. Применяется при следующем присоединении к звонку.",
    "voiceAudioSettings.stopPreview": "Остановить предпросмотр",
    "voiceAudioSettings.preview": "Предпросмотр",
    "voiceAudioSettings.callSounds": "Звуки звонков",
    "voiceAudioSettings.playCallSounds": "Проигрывать звуки звонков",
    "voiceAudioSettings.soundVolume": "Громкость звуков",
    "voiceAudioSettings.ringing": "Вызов",
    "voiceAudioSettings.ringForIncomingDmCalls":
        "Звонить при входящих звонках в личных чатах",
    "voiceAudioSettings.directMessagesRingRoomsNeverDo":
        "Личные чаты звонят. Комнаты - никогда, к ним присоединяются из самой комнаты.",
    "voiceAudioSettings.ringtoneVolume": "Громкость рингтона",
    "voiceAudioSettings.fullScreenCalls":
        "Показывать звонки на экране блокировки",
    "voiceAudioSettings.fullScreenCallsHint":
        "Позволяет входящему звонку в личном чате включать экран и звонить на весь экран, как обычный телефонный звонок. Android запрашивает это отдельно.",
    "voiceAudioSettings.fullScreenCallsAllow": "Разрешить",
    "voiceAudioSettings.microphoneUnavailableCheckBrowserPermissions":
        "Микрофон недоступен - проверьте разрешения браузера",
    "voiceAudioSettings.cameraUnavailableCheckBrowserPermissions":
        "Камера недоступна - проверьте разрешения браузера",

    // src/lib/components/layout/VoiceCallPanel.svelte
    "voiceCallPanel.enableAudio": "Включить звук",
    "voiceCallPanel.openCallView": "Открыть окно звонка",
    "voiceCallPanel.connectionStats": "Статистика соединения",
    "voiceCallPanel.openCall": "Открыть звонок",
    "voiceCallPanel.openCallWithVideo":
        "Открыть звонок ({n, plural, one {# видео} few {# видео} many {# видео} other {# видео}})",
    "voiceCallPanel.sharingYourScreen": "Вы показываете экран",
    "voiceCallPanel.shareQuality": "Качество демонстрации экрана",
    "voiceCallPanel.stop": "Остановить",
    "callStats.title": "Соединение звонка",
    "callStats.copyJson": "Копировать как JSON",
    "callStats.copied": "Статистика звонка скопирована",
    "callStats.copyFailed": "Не удалось скопировать",
    "callStats.loading": "Измерение...",
    "callStats.notInCall": "Вы не в звонке",
    "callStats.tcpWarning":
        "Медиа передаётся по TCP. Потерянный пакет задерживает всё, что идёт за ним, пока не будет отправлен повторно, из-за чего звук отстаёт или рассинхронизируется. Обычно это вызвано брандмауэром или сетью, блокирующими UDP.",
    "callStats.serverSwitchedTcp":
        "Сервер звонков переключил вас на TCP: он больше не предлагает этому устройству UDP. Он делает это, если UDP-соединение не удалось или оборвалось, пока сигнализация продолжает работать, и запоминает это для данного звонка, поэтому повторное подключение с этого устройства какое-то время остаётся на TCP. Ваша сеть вполне может нормально пропускать UDP; это не то же самое, что блокировка брандмауэром.",
    "callStats.serverCandidates": "Кандидаты сервера",
    "callStats.serverCandidatesNoUdp": "Только TCP (переключено сервером)",
    "callStats.publishing": "отправка",
    "callStats.listening": "приём",
    "callStats.signalRtt": "Задержка сигнализации",
    "callStats.yourQuality": "Ваше соединение",
    "callStats.sending": "Отправка",
    "callStats.receiving": "Приём",
    "callStats.participant": "Участник",
    "callStats.theirQuality": "Их соединение",
    "callStats.loss": "Потери",
    "callStats.jitter": "Джиттер",
    "callStats.buffer": "Буфер",
    "callStats.legend":
        "«Их соединение» - это оценка сервером канала этого человека, поэтому плохая оценка указывает на их сеть, а не на вашу. Потери и джиттер относятся к их звуку на пути к вам за последнюю секунду.",
    "callStats.noTransport": "Нет соединения",
    "callStats.video": "Видео",
    "callStats.videoChecking": "Проверка…",
    "callStats.videoSending": "Отправляется",
    "callStats.videoNotSending": "Пока не отправляется",
    "callStats.videoCaptureEnded": "Захват остановлен: запустите его снова",
    "callStats.videoCaptureStalled":
        "Нет новых кадров: окно демонстрации может быть свёрнуто или перекрыто, либо камера занята",
    "callStats.videoPlaying": "Воспроизводится",
    "callStats.videoNotSubscribed": "Пока не получено",
    "callStats.videoHiddenByYou": "Скрыто вами",
    "callStats.videoTurnedOff": "Выключено собеседником",
    "callStats.videoPausedByServer":
        "Приостановлено сервером звонков: ваше соединение сейчас не справляется",
    "callStats.videoNoPackets":
        "Ничего не приходит: проверьте отправляющую сторону или своё соединение",
    "callStats.videoCantDecrypt":
        "Приходит, но не расшифровывается: у кого-то из вас может быть старая версия Zam, либо ключ не пришёл",
    "callStats.videoCantDecode":
        "Приходит, но это устройство не может его декодировать: попробуйте другой видеокодек в меню качества демонстрации экрана",
    "callStats.videoNotShown":
        "Получено, но не на экране: откройте окно звонка, чтобы смотреть",
    "callStats.videoNotPainting":
        "Декодировано, но не рисуется: попробуйте закрыть и снова открыть окно звонка",
    "callStats.capture": "Захват",
    "callStats.framesArrivedDecoded": "Кадров получено / декодировано",
    "callStats.framesEncoded": "Кадров закодировано",
    "callStats.onScreen": "На экране",
    "callStats.onScreenNo": "Нет",
    "callStats.onScreenNoPicture": "Изображения пока нет",
    "callStats.decryptErrors": "Ошибки расшифровки",
    "callStats.trackState": "Дорожка",
    "callStats.trackNoFrames": "Сейчас нет кадров",
    "callStats.proxyRoute": "Прокси",
    "callStats.routeSignalling": "Соединение с сервером звонков",
    "callStats.routeSending": "Отправляемые вами медиа",
    "callStats.routeReceiving": "Получаемые вами медиа",
    "callStats.routeDirect": "Напрямую",
    "callStats.routeProxy": "Через {proxy}",
    "callStats.path": "Путь",
    "callStats.iceRtt": "Задержка ICE",
    "callStats.mediaRtt": "Задержка медиа",
    "callStats.upload": "Отдача",
    "callStats.download": "Загрузка",
    "callStats.availableUpload": "Доступная скорость отдачи",
    "callStats.outgoingLoss": "Исходящие потери",
    "callStats.remoteAddress": "Адрес сервера",
    "callStats.candidates": "Кандидаты",
    "callStats.pathUdp": "UDP (напрямую)",
    "callStats.pathTcp": "TCP",
    "callStats.pathRelayUdp": "TURN-ретранслятор (UDP)",
    "callStats.pathRelayTcp": "TURN-ретранслятор (TCP)",
    "callStats.pathRelayTls": "TURN-ретранслятор (TLS)",
    "callStats.pathUnknown": "Неизвестно",
    "callStats.qualityExcellent": "Отлично",
    "callStats.qualityGood": "Хорошо",
    "callStats.qualityPoor": "Плохо",
    "callStats.qualityLost": "Потеряно",
    "callStats.qualityUnknown": "Неизвестно",
    "callStats.streams": "Медиапотоки",
    "callStats.you": "Вы",
    "callStats.sourceMicrophone": "Микрофон",
    "callStats.sourceCamera": "Камера",
    "callStats.sourceScreenShare": "Демонстрация экрана",
    "callStats.sourceScreenShareAudio": "Звук демонстрации экрана",
    "callStats.sourceUnknown": "Другая дорожка",
    "callStats.sent": "отправлено",
    "callStats.received": "получено",
    "callStats.layer": "слой {rid}",
    "callStats.codec": "Кодек",
    "callStats.codecOptions": "Параметры кодека",
    "callStats.bitrate": "Битрейт",
    "callStats.bitrateTarget": "{rate} из максимума {target}",
    "callStats.packetDuration": "Звука в пакете",
    "callStats.resolution": "Разрешение",
    "callStats.encoder": "Кодировщик",
    "callStats.decoder": "Декодер",
    "callStats.hardware": "аппаратный",
    "callStats.software": "программный",
    "callStats.limitedBy": "Ограничивает",
    "callStats.limitCpu": "процессор",
    "callStats.limitBandwidth": "пропускная способность",
    "callStats.limitNone": "ничего",
    "callStats.limitOther": "другое",
    "callStats.frameTime": "Время на кадр",
    "callStats.resent": "Повторно отправлено",
    "callStats.droppedFrames": "Пропущено кадров",
    "callStats.nackPli": "NACK / PLI",
    "callStats.softwareEncodeHint":
        "Ваше видео кодируется программно, что нагружает процессор и может приводить к пропуску кадров под нагрузкой. В разделе «Настройки» > «Отладка» показано, доступно ли аппаратное кодирование видео (video_encode в «Состоянии функций»).",
    "callStats.cpuLimitHint":
        "Видеокодировщик снижает качество, потому что процессор не справляется.",
    "voiceCallPanel.unmute": "Включить микрофон",
    "voiceCallPanel.undeafen": "Включить звук",
    "voiceCallPanel.deafen": "Отключить звук",
    "voiceCallPanel.disconnect": "Отключиться",

    // src/lib/components/messages/VoiceMessagePlayer.svelte
    "voiceMessagePlayer.seek": "Перемотка",
    "voiceMessagePlayer.voiceMessage": "Голосовое сообщение",
    "midiPlayer.play": "Воспроизвести",
    "midiPlayer.pause": "Пауза",
    "midiPlayer.seek": "Позиция",
    "midiPlayer.volume": "Громкость",

    // src/lib/components/messages/VoiceRecorder.svelte
    "voiceRecorder.cancelRecording": "Отменить запись",
    "voiceRecorder.stop": "Остановить",
    "voiceRecorder.discard": "Отбросить",
    "voiceRecorder.discardRecording": "Отбросить запись",
    "voiceRecorder.voiceMessage": "Голосовое сообщение",
    "voiceRecorder.sending": "Отправка…",
    "voiceRecorder.send": "Отправить",
    "voiceRecorder.microphoneAccessWasDenied": "Доступ к микрофону запрещён.",
    "voiceRecorder.recordingFailed": "Не удалось записать.",
    "voiceRecorder.nothingWasRecorded": "Ничего не записано.",
    "voiceRecorder.failedToSendVoiceMessage":
        "Не удалось отправить голосовое сообщение",

    // src/lib/components/settings/WhatsNew.svelte
    "whatsNew.whatSNew": "Что нового",
    "whatsNew.loadingReleaseNotes": "Загрузка примечаний к выпуску…",
    "whatsNew.releaseNotesUnavailable": "Примечания к выпуску недоступны.",
    "whatsNew.viewOnGithub": "Открыть на GitHub",

    // src/lib/components/layout/WhatsNewModal.svelte
    "whatsNewModal.whatSNew": "Что нового",
    "whatsNewModal.whatSNewSince": "Что нового с v{from}",
    "whatsNewModal.whatSNewInV": "Что нового в v{APP_VERSION}",
    "whatsNewModal.releaseNotesUnavailable": "Примечания к выпуску недоступны.",
    "whatsNewModal.viewOnGithub": "Открыть на GitHub",
    "whatsNewModal.gotIt": "Понятно",

    // src/lib/components/layout/VerificationRequestCard.svelte
    "verificationRequestCard.verifyYourOtherSession":
        "Подтвердите ваш другой сеанс",
    "verificationRequestCard.verificationRequest": "Запрос на подтверждение",
    "verificationRequestCard.anotherOfYourSessions": "Другой из ваших сеансов",

    // src/lib/components/messages/CallEventCard.svelte
    "callEventCard.missedCall": "Пропущенный звонок",
    "callEventCard.ongoingCall": "Идущий звонок",
    "callEventCard.callEnded": "Звонок завершён",

    // src/lib/components/messages/ComposerActionsMenu.svelte
    "composerActionsMenu.uploadAFile": "Загрузить файл",
    "composerActionsMenu.camera": "Камера",
    "composerActionsMenu.photosAndVideos": "Фото и видео",
    "composerActionsMenu.files": "Файлы",
    "composerActionsMenu.sendFileDirectly": "Отправить файл напрямую",
    "composerActionsMenu.createPoll": "Создать опрос",
    "composerActionsMenu.recordVoiceMessage": "Записать голосовое сообщение",
    "composerActionsMenu.shareLocation": "Поделиться местоположением",
    "composerActionsMenu.createThread": "Создать обсуждение",
    "composerActionsMenu.inviteToGame": "Пригласить в игру",
    "gameInvite.title": "Пригласить в игру",
    "gameInvite.game": "Игра",
    "gameInvite.note": "Заметка (необязательно)",
    "gameInvite.notePlaceholder": "Напишите что-нибудь…",
    "gameInvite.send": "Отправить приглашение",
    "gameInvite.noGames":
        "Сейчас нельзя пригласить ни одну запущенную игру Steam.",
    "gameInvite.failedToSend": "Не удалось отправить приглашение.",
    "gameInvite.cardTitle": "Приглашение в игру",
    "gameInvite.sourceSteam": "Steam",
    "gameInvite.partySize": "{current} из {max} в группе",
    "gameInvite.confirmSteam": "Запустить {game} с аргументами: {connect}",
    "gameInvite.confirmLobby": "Присоединиться к лобби {game}",
    "gameInvite.joinGame": "Присоединиться к игре",
    "gameInvite.joinSent": "Запрос на присоединение отправлен в игру.",
    "gameInvite.openInDesktop":
        "Откройте в настольном приложении Zam, чтобы присоединиться.",
    "gameInvite.joinUnsupported":
        "Присоединение к этой игре на этом компьютере не поддерживается.",
    "gameInvite.joinInvalid": "Это приглашение недействительно.",
    "gameInvite.joinFailed": "Не удалось присоединиться к игре.",

    // src/lib/components/messages/Reactions.svelte
    "reactions.couldNotAddReaction": "Не удалось добавить реакцию",

    // src/lib/components/ui/QrScanner.svelte
    "qrScanner.startingTheCamera": "Запуск камеры…",
    "qrScanner.cameraAccessWasDenied": "Доступ к камере запрещён.",
    "qrScanner.noCameraWasFoundOnThis": "На этом устройстве не найдена камера.",
    "qrScanner.theCameraIsAlreadyInUse":
        "Камера уже используется другим приложением.",
    "qrScanner.couldNotOpenTheCameraA":
        "Не удалось открыть камеру. Требуется защищённое соединение (https).",
    "qrScanner.codeFoundCheckingIt": "Код найден - проверка…",
    "qrScanner.couldNotStartVerificationWithThat":
        "Не удалось начать подтверждение с этим кодом.",
    "qrScanner.thatIsnTAVerificationCode": "Это не код подтверждения.",
    "qrScanner.thisDeviceHasNoCameraAvailable":
        "На этом устройстве нет доступной камеры.",
    "qrScanner.couldNotStartTheCameraPreview":
        "Не удалось запустить предпросмотр камеры.",
    "qrScanner.pointTheCameraAtTheirCode": "Наведите камеру на их код.",

    // src/lib/desktopContextMenu.ts
    "desktopContextMenu.failedToSaveImage": "Не удалось сохранить изображение",

    // src/lib/matrix/client.ts
    "client.serverAutoDiscoveryFailedUsingThe":
        "Не удалось автоматически обнаружить сервер - используется адрес в том виде, как он введён",
    "client.discoveredHomeserverFailedValidation":
        "Обнаруженный домашний сервер не прошёл проверку",
    "client.thisHomeserverDoesnTSupportSliding":
        "Этот домашний сервер не поддерживает sliding sync, поэтому используется классическая синхронизация.",
    "client.notLoggedIn": "Вход не выполнен",
    "client.creatorsNeedRoomV12":
        "Дополнительным создателям нужна комната версии 12 или новее, а этот сервер её не предоставляет.",
    "client.oauthProviderChanged":
        "Провайдер входа на сервере изменился. Попробуйте ещё раз.",
    "client.thisEventTypeCannotBeForwarded":
        "Этот тип события нельзя переслать",
    "client.notConnected": "Нет подключения",
    "client.thisServerDoesNotAllowSigning":
        "Этот сервер не позволяет завершать сеансы с помощью пароля - используйте страницу его учётной записи.",
    "client.incorrectPassword": "Неверный пароль",
    "client.thisServerDoesNotAllowConfirming":
        "Этот сервер не позволяет подтверждать это действие паролем - используйте страницу его учётной записи.",
    "client.directMessages": "Личные сообщения",
    "client.messagesInDirectMessageRooms":
        "Сообщения в комнатах личных сообщений",
    "client.rooms": "Комнаты",
    "client.messagesInAllOtherRooms": "Сообщения во всех остальных комнатах",
    "client.fullMatrixIdMentions": "Упоминания по полному Matrix ID",
    "client.messagesUsingYourFullUserHomeserver":
        "Сообщения с вашим полным ID вида @user:homeserver",
    "client.displayNameMentions": "Упоминания по отображаемому имени",
    "client.messagesContainingYourDisplayName":
        "Сообщения, содержащие ваше отображаемое имя",
    "client.usernameMentions": "Упоминания по имени пользователя",
    "client.messagesContainingYourUsernameWithoutServer":
        "Сообщения, содержащие ваше имя пользователя (без сервера)",
    "client.roomMentions": "Упоминания @room",
    "client.messagesUsingRoomToNotifyEveryone":
        "Сообщения с @room, уведомляющие всех",
    "client.invitations": "Приглашения",
    "client.whenYouAreInvitedToA": "Когда вас приглашают в комнату",
    "client.thisRoom": "эта комната",
    "client.keywordCannotStartWith": "Ключевое слово не может начинаться с «.»",
    "client.emotes": "Эмодзи ({value})",
    "client.room": "Комната",
    "client.emojis": "Эмодзи",
    "client.enterAShortcode": "Введите короткий код.",
    "client.useOnlyLettersNumbersDotsUnderscores":
        "Используйте только буквы, цифры, точки, подчёркивания, плюсы и дефисы.",
    "client.chooseAtLeastOneUsage": "Выберите хотя бы одно применение.",
    "client.imageNotFound": "Изображение не найдено.",
    "client.noPermissionToEditPack": "У вас нет прав редактировать этот набор.",
    "client.invalidPowerLevels": "Недопустимые уровни доступа: {shapeError}",
    "client.roomCreatorsPowerLevelCannotBe":
        "Уровень доступа создателей комнаты нельзя задать в комнатах v12",
    "client.restrictedJoinRequiresAtLeastOne":
        "Ограниченное вступление требует хотя бы одного родительского пространства",
    "client.orderMustBeAtMost50":
        "Порядок должен содержать не более 50 печатаемых ASCII-символов (от пробела до ~)",
    "client.cannotSetSuggestedOnASpace":
        "Нельзя пометить как рекомендуемую дочернюю комнату пространства без via",
    "client.pollHasNoEventId": "У опроса нет ID события",
    "client.unsupportedPoll": "Неподдерживаемый опрос",
    "client.youCanTCloseThisPoll": "Вы не можете завершить этот опрос",
    "client.microphoneDisconnectedSwitchedToTheDefault":
        "Микрофон отключён - выполнено переключение на устройство по умолчанию",
    "client.cameraDisconnected": "Камера отключена",
    "client.cameraIsDisabledInSettings":
        "Ваша камера отключена в настройках раздела «Голос и видео»",
    "client.unknownRoom": "Неизвестная комната",
    "client.theServerRejectedItYouMay":
        "сервер отклонил запрос - возможно, у вас нет прав присоединяться к звонкам в этой комнате",
    "client.callMembershipFailed":
        "Не удалось присоединиться к звонку: {detail}",
    "client.voiceServerRejectedTheJoin":
        "Голосовой сервер отклонил подключение ({status})",
    "client.voiceCallDisconnected": "Голосовой звонок отключён",
    "client.couldNotReachCallServer":
        "Не удалось подключиться к {server}, поэтому вы можете не слышать некоторых людей в этом звонке.",
    "client.yourMicrophoneAppearsSilentCheckYour":
        "Ваш микрофон, похоже, молчит - проверьте устройство ввода",
    "client.audioDeviceError": "Ошибка аудиоустройства: {message}",
    "client.couldnTSwitchToThatKept":
        "Не удалось переключиться на {what} - оставлено прежнее",
    "client.couldnTSwitchToThatUsing":
        "Не удалось переключиться на {what} - используется устройство по умолчанию",
    "client.couldnTSwitchToThatPick":
        "Не удалось переключиться на {what} - выберите другое устройство",
    "client.encryptedCallsUnsupported":
        "Этот звонок защищён сквозным шифрованием, а этот браузер не может шифровать медиа звонка. Попробуйте свежую версию Chrome, Firefox или Safari либо приложение для компьютера.",
    "client.codecCouldNotBeDecoded":
        "Это устройство не может декодировать видео {codec}. Вместо него запрашивается H.264.",
    "client.couldNotSwitchVideoCodec": "Не удалось переключить видеокодек",
    "client.couldNotStartScreenShare": "Не удалось начать демонстрацию экрана",
    "client.couldNotShareScreenAudio": "Демонстрация экрана начата без звука",
    "client.couldnTChangeScreenShareQuality":
        "Не удалось изменить качество демонстрации экрана",
    "client.couldNotStartTheCameraCheck":
        "Не удалось запустить камеру - проверьте разрешения",
    "client.couldnTApplyAudioProcessingChange":
        "Не удалось применить изменение обработки звука ({error})",
    "client.deviceNounMicrophone": "микрофон",
    "client.deviceNounCamera": "камеру",

    // src/lib/matrix/crypto.ts
    "crypto.couldNotStartTheEmojiCheck": "Не удалось начать сверку эмодзи",
    "crypto.couldNotCancelTheVerification": "Не удалось отменить подтверждение",
    "crypto.noCodeAvailableTheOtherSide":
        "Код недоступен - другая сторона не может его отсканировать.",
    "crypto.couldNotGenerateAQrCode": "Не удалось создать QR-код",
    "crypto.thatCodeDoesnTMatchThis":
        "Этот код не соответствует этому подтверждению",
    "crypto.couldNotConfirmTheQrMatch":
        "Не удалось подтвердить совпадение QR-кода",
    "crypto.couldNotCancelTheQrMatch": "Не удалось отменить совпадение QR-кода",
    "crypto.encryptionIsNotReadyOnThis": "Шифрование в этом сеансе не готово",
    "crypto.roomIsNotEncrypted": "Эта комната не зашифрована.",
    "crypto.roomKeyDiscarded":
        "Ваше следующее сообщение здесь будет использовать новый ключ комнаты, который снова будет передан каждому сеансу в комнате.",
    "crypto.encryptionKeysUnchecked":
        "Не удалось проверить ключи шифрования этого сеанса на сервере. Проверьте подключение и перезагрузите.",
    "crypto.encryptionDataLost":
        "Данные шифрования этого сеанса были потеряны (очищены данные браузера или выполнена переустановка), поэтому сеанс был завершён, чтобы другие не шифровали сообщения для ключей, которых у него больше нет. Войдите снова.",
    "crypto.accountApprovalCancelled":
        "Подтверждение на странице учётной записи отменено.",
    "crypto.accountPasswordRequired":
        "Для подтверждения этому серверу нужен пароль от вашей учётной записи.",
    "crypto.thisServerCanTConfirmEncryption":
        "Этот сервер не может подтвердить настройку шифрования паролем - используйте страницу его учётной записи.",
    "crypto.incorrectPassword": "Неверный пароль",
    "crypto.failedToGenerateARecoveryKey":
        "Не удалось создать ключ восстановления",
    "crypto.yourOldRecoveryWasResetBut":
        "Ваше прежнее восстановление сброшено, но настроить новое не удалось.",
    "crypto.thatKeyDoesnTMatchThis":
        "Этот ключ не соответствует резервной копии этой учётной записи на сервере.",
    "crypto.thatDoesnTLookLikeA":
        "Это не похоже на действительный ключ восстановления. Проверьте опечатки и повторите.",
    "crypto.thisAccountHasNoRecoverySet":
        "Для этой учётной записи восстановление ещё не настроено. Сначала настройте его в сеансе, у которого есть ваши ключи.",
    "crypto.thatRecoveryKeyDoesnTMatch":
        "Этот ключ восстановления не соответствует этой учётной записи. Проверьте опечатки и повторите.",
    "crypto.thisAccountSRecoveryWasnT":
        "Восстановление этой учётной записи настроено без парольной фразы. Используйте ключ восстановления.",
    "crypto.couldnTUseYourPassphraseOn":
        "Не удалось использовать вашу парольную фразу на этом устройстве. Попробуйте ключ восстановления.",
    "crypto.thatPassphraseDoesnTMatchThis":
        "Эта парольная фраза не соответствует этой учётной записи. Проверьте опечатки и повторите.",

    // src/lib/matrix/media.ts
    "media.notLoggedIn": "Вход не выполнен",
    "media.failedToFetchAttachment": "Не удалось получить вложение: {status}",
    "media.encryptedAttachmentHasAnInvalidUrl":
        "У зашифрованного вложения недопустимый URL",
    "media.failedToFetchEncryptedAttachment":
        "Не удалось получить зашифрованное вложение: {status}",

    // src/lib/matrix/pluginHost.ts
    "pluginHost.mediaWasUploadedByADifferent":
        "Медиа загружено другой учётной записью",
    "pluginHost.notLoggedIn": "Вход не выполнен",
    "pluginHost.notConnected": "Нет подключения",

    // src/lib/matrix/runtime.ts
    "runtime.notLoggedIn": "Вход не выполнен",

    // src/lib/plugins/builtins/double-tap-reply/index.ts
    "doubleTapReply.doubleTapSwipeActions":
        "Действия двойного касания и свайпа",
    "doubleTapReply.doubleTapAMessageToReply":
        "Дважды коснитесь сообщения, чтобы ответить, отреагировать или изменить его, либо проведите по нему влево, чтобы ответить / изменить.",
    "doubleTapReply.doubleTapYourMessages": "Двойное касание ваших сообщений",
    "doubleTapReply.nothing": "Ничего",
    "doubleTapReply.reaction": "Реакция",
    "doubleTapReply.reply": "Ответ",
    "doubleTapReply.edit": "Изменение",
    "doubleTapReply.doubleTapOtherMessages": "Двойное касание чужих сообщений",
    "doubleTapReply.reactionEmoji": "Эмодзи реакции",
    "doubleTapReply.sentWhenADoubleTapAction":
        "Отправляется, когда действием двойного касания выбрана «Реакция».",
    "doubleTapReply.swipeToReplyEdit": "Свайп для ответа / изменения",
    "doubleTapReply.swipeAMessageLeftToReply":
        "Проведите по сообщению влево, чтобы ответить; проведите по своему дальше, чтобы изменить.",
    "doubleTapReply.failedToReact": "Не удалось отреагировать",

    // src/lib/plugins/builtins/slash-fun/index.ts
    "slashFun.sendAnActionMessage": "Отправить сообщение о действии",
    "slashFun.appendToYourMessage": "Добавить ¯\\_(ツ)_/¯ к вашему сообщению",
    "slashFun.appendToYourMessage2":
        "Добавить (╯°□°)╯︵ ┻━┻ к вашему сообщению",
    "slashFun.appendToYourMessage3":
        "Добавить ┬─┬ ノ( ゜-゜ノ) к вашему сообщению",
    "slashFun.appendToYourMessage4": "Добавить ( ͡° ͜ʖ ͡°) к вашему сообщению",
    "slashFun.sendYourMessageAsASpoiler":
        "Отправить ваше сообщение как спойлер",
    "slashFun.sendYourMessageWithoutMarkdownFormatting":
        "Отправить ваше сообщение без форматирования markdown",
    "slashFun.funSlashCommands": "Забавные слэш-команды",
    "slashFun.noveltySlashCommandsMeShrugTableflip":
        "Забавные слэш-команды: /me, /shrug, /tableflip, /unflip, /lenny, /spoiler, /plain.",

    // src/lib/plugins/builtins/text-replacer/index.ts
    "textReplacer.textReplacer": "Замена текста",
    "textReplacer.applyYourOwnStringOrRegex":
        "Применяйте собственные замены строк или регулярных выражений к тексту исходящих сообщений.",
    "textReplacer.replacementRules": "Правила замены",
    "textReplacer.appliedToYourOutgoingMessageText":
        "Применяются к тексту ваших исходящих сообщений по порядку. Получатели видят обычный текст.",
    "textReplacer.find": "Найти",
    "textReplacer.textOrPattern": "текст или шаблон",
    "textReplacer.replaceWith": "Заменить на",
    "textReplacer.regex": "Регулярное выражение",
    "textReplacer.ignoreCase": "Без учёта регистра",
    "previewRewriter.name": "Подмена адреса предпросмотра ссылок",
    "previewRewriter.description":
        "Получать предпросмотры ссылок с другого адреса, например с зеркала сайта, недоступного вашему домашнему серверу.",
    "previewRewriter.rules": "Правила подмены",
    "previewRewriter.rulesDescription":
        "Применяются по порядку к адресу, с которого получается предпросмотр. Сама ссылка не меняется.",

    // src/lib/plugins/pluginBoot.ts
    "pluginBoot.noPluginSyncDataOnYour":
        "В вашей учётной записи пока нет данных синхронизации плагинов.",
    "pluginBoot.theSyncDataOnYourAccount":
        "Данные синхронизации в вашей учётной записи повреждены.",
    "pluginBoot.autoUpdateFailed":
        "Не удалось выполнить автообновление: {value}",

    // src/lib/plugins/pluginPin.ts
    "pluginPin.pluginIdMismatchIndexListsManifest":
        "Несовпадение ID плагина: в индексе указан «{entryId}», в манифесте объявлен «{manifestId}»",
    "pluginPin.cannotInstallPluginWithIdIt":
        "Нельзя установить плагин с ID «{manifestId}»: это встроенный плагин",
    "pluginPin.pluginIsAlreadyInstalledFromA":
        "Плагин «{manifestId}» уже установлен из другого репозитория",

    // src/lib/plugins/repo.ts
    "repo.repoReferenceMustBeAString":
        "Ссылка на репозиторий должна быть строкой",
    "repo.repoReferenceCannotBeEmpty":
        "Ссылка на репозиторий не может быть пустой",
    "repo.branchCannotBeEmpty": "Ветка не может быть пустой",
    "repo.branchCannotContain": "Ветка не может содержать «..»",
    "repo.invalidRepoReferenceExtraPathSegments":
        "Недопустимая ссылка на репозиторий: лишние сегменты пути (не /tree/<ветка>)",
    "repo.invalidRepoReferenceMustBeOwner":
        "Недопустимая ссылка на репозиторий: должна быть вида владелец/репозиторий",
    "repo.ownerCannotBeEmpty": "Владелец не может быть пустым",
    "repo.invalidOwnerMustMatchAZa":
        "Недопустимый владелец: должен соответствовать [A-Za-z0-9][A-Za-z0-9._-]*",
    "repo.repoCannotBeEmpty": "Репозиторий не может быть пустым",
    "repo.invalidRepoMustMatchAZa":
        "Недопустимый репозиторий: должен соответствовать [A-Za-z0-9][A-Za-z0-9._-]*",

    // src/lib/plugins/repoList.ts
    "repoList.enterARepoOwnerRepoOr":
        "Введите репозиторий (владелец/репозиторий или URL GitHub).",
    "repoList.thatIsTheOfficialRepoAlready":
        "Это официальный репозиторий (уже включён).",
    "repoList.thatRepoIsAlreadyAdded": "Этот репозиторий уже добавлен.",

    // src/lib/stores/gifSearch.svelte.ts
    "gifSearch.couldNotLoadGifsTryAgain":
        "Не удалось загрузить GIF, попробуйте ещё раз.",
    "gifSearch.couldnTReachKlipyTryAgain":
        "Не удалось связаться с KLIPY - попробуйте ещё раз.",

    // src/lib/stores/liveLocation.svelte.ts
    "liveLocation.youCanTShareLiveLocation":
        "Вы не можете делиться местоположением в реальном времени в этой комнате.",
    "liveLocation.couldnTStartLiveLocation":
        "Не удалось начать передачу местоположения в реальном времени",
    "liveLocation.expired": "Истекло",
    "liveLocation.lessThanAMinuteLeft": "осталось меньше минуты",
    "liveLocation.minLeft": "осталось {totalMin} мин",
    "liveLocation.hLeft": "осталось {h} ч",
    "liveLocation.hMinLeft": "осталось {h} ч {m} мин",
    "liveLocation.justNow": "только что",
    "liveLocation.sAgo": "{floor} с назад",
    "liveLocation.minAgo": "{floor} мин назад",
    "liveLocation.hAgo": "{floor} ч назад",
    "liveLocation.n15Minutes": "15 минут",
    "liveLocation.n1Hour": "1 час",
    "liveLocation.n8Hours": "8 часов",

    // src/lib/stores/outbox.svelte.ts
    "outbox.failedToSend": "Не удалось отправить",

    // src/lib/stores/settings.svelte.ts
    "settings.couldNotReadThatFile": "Не удалось прочитать этот файл.",
    "settings.thatFileIsnTAValid": "Этот файл не является допустимым шрифтом.",
    "settings.fontCouldnTBeSavedOn":
        "Не удалось сохранить шрифт на этом устройстве.",
    "settings.cannotSaveAPresetWithBuilt":
        "Нельзя сохранить пресет со встроенным названием: {name}",

    // src/lib/stores/shareInbox.svelte.ts
    "shareInbox.youReOfflineTheShareWas":
        "Вы не в сети: содержимое добавлено в поле ввода",
    "shareInbox.couldnTSendTheShare": "Не удалось отправить содержимое",

    // src/lib/stores/verification.svelte.ts
    "verification.finishingAnotherVerificationFirstTryAgain":
        "Сначала завершается другое подтверждение. Повторите попытку.",
    "verification.waitingForTheOtherSideTo":
        "Ожидание принятия другой стороной…",
    "verification.acceptedSettingUpTheCheck": "Принято - настройка проверки…",
    "verification.verifying": "Подтверждение…",
    "verification.sessionVerified": "Сеанс подтверждён",
    "verification.userVerified": "Пользователь подтверждён",
    "verification.verificationCancelled": "Подтверждение отменено",
    "verification.verified": "Подтверждён",
    "verification.unverified": "Не подтверждён",
    "verification.signedByYou": "Подписан вами",
    "verification.notSignedByOwner": "Не подписан владельцем",
    "verification.verifyWithAnotherDevice": "Подтвердить с другого устройства",
    "verification.useAnotherDevice": "Использовать другое устройство",
    "verification.couldNotSendVerificationRequest":
        "Не удалось отправить запрос на подтверждение",
    "verification.sessionNotKnownYet":
        "Этот сеанс пока не знает о том. Подождите несколько секунд и повторите попытку или начните подтверждение из нового сеанса.",
    "verification.accountHasNoIdentity":
        "Ключей перекрёстной подписи вашей учётной записи нет на сервере, поэтому ваши другие сеансы не могут подтвердить этот. Откройте «Настройки» > «Безопасность и шифрование» в сеансе, где вы настраивали восстановление: если там предлагается загрузить ваши ключи, сделайте это. Если вы никогда не настраивали восстановление, настройте его в любом сеансе.",
    "verification.sessionHasNoKeys":
        "Этот сеанс не опубликовал свои ключи шифрования, поэтому его нельзя подтвердить, и он не может получать зашифрованные сообщения. Завершите его и войдите снова.",
    "verification.sessionKeysRejected":
        "Ключи шифрования того сеанса были отклонены этим сеансом. Завершите его и войдите снова.",
    "verification.identityChanged": "Идентичность изменилась",
    "verification.couldnTAcceptThisRequestTry":
        "Не удалось принять этот запрос. Повторите попытку.",

    // src/lib/stores/voiceCall.svelte.ts
    "voiceCall.couldnTLoadTheCallComponent":
        "Не удалось загрузить компонент звонка. Проверьте подключение и перезагрузите страницу, чтобы повторить.",
    "voiceCall.couldNotJoinTheVoiceCall":
        "Не удалось присоединиться к голосовому звонку",
    "voiceCall.joinedWithoutAMicrophone":
        "Ваш микрофон недоступен - вы по-прежнему можете слушать и показывать экран",
    "voiceCall.couldNotMuteYourMicrophone": "Не удалось выключить микрофон",
    "voiceCall.couldNotUnmuteYourMicrophoneCheck":
        "Не удалось включить микрофон - проверьте устройство ввода",
    "voiceCall.connecting": "Подключение…",
    "voiceCall.startedSharing": "{name} показывает свой экран",
    "voiceCall.watch": "Смотреть",
    "voiceCall.voiceConnected": "Голос подключён",
    "voiceCall.reconnecting": "Повторное подключение…",
    "voiceCall.gpuGivenUp":
        "Графика продолжала давать сбои, поэтому GPU отключён до перезапуска Zam, а видео кодируется программно.",
    "voiceCall.gpuRecovered":
        "Графика перезапущена, поэтому звонок переподключился, чтобы видео кодировалось на GPU.",
    "voiceCall.restartZam": "Перезапустить Zam",
    "voiceCall.youWereBannedFromThisRoom":
        "Вы заблокированы в этой комнате - звонок завершён",
    "voiceCall.youLeftThisRoomCallEnded":
        "Вы покинули эту комнату - звонок завершён",
    "voiceCall.youWereRemovedFromThisRoom":
        "Вас исключили из этой комнаты - звонок завершён",

    // src/lib/update.ts
    "update.noReleasesFoundYet": "Выпусков пока не найдено.",
    "update.githubApiError": "Ошибка API GitHub ({status}).",
    "update.staleBuild":
        "Эта веб-версия ({current}) старше последнего выпуска ({latest}). Возможно, сервер ещё не обновился; повторите через несколько минут.",
    "update.couldNotReadTheLatestVersion":
        "Не удалось определить последнюю версию.",

    // src/lib/utils/accountSecurity.ts
    "accountSecurity.enterYourCurrentPassword": "Введите текущий пароль.",
    "accountSecurity.enterANewPassword": "Введите новый пароль.",
    "accountSecurity.newPasswordMustBeAtLeast":
        "Новый пароль должен содержать не менее 8 символов.",
    "accountSecurity.newPasswordMustBeDifferentFrom":
        "Новый пароль должен отличаться от текущего.",
    "accountSecurity.passwordsDoNotMatch": "Пароли не совпадают.",

    // src/lib/utils/activeSession.ts
    "activeSession.offAlwaysNotify": "Выкл. - всегда уведомлять",
    "activeSession.n15Seconds": "15 секунд",
    "activeSession.n30Seconds": "30 секунд",
    "activeSession.n1Minute": "1 минута",
    "activeSession.n2Minutes": "2 минуты",
    "activeSession.n5Minutes": "5 минут",
    "activeSession.n10Minutes": "10 минут",
    "activeSession.n30Minutes": "30 минут",
    "activeSession.enterANumberOfMinutes": "Введите число минут.",
    "activeSession.chooseAtLeast1MinuteUse":
        "Выберите не менее 1 минуты - для более коротких значений используйте список выше.",
    "activeSession.chooseMinutes2HoursOrLess":
        "Выберите не более {MAX_CUSTOM_GRACE_MINUTES} минут (2 часов).",

    // src/lib/utils/audioDevices.ts
    "audioDevices.microphone": "Микрофон",
    "audioDevices.speaker": "Динамик",
    "audioDevices.camera": "Камера",

    // src/lib/utils/audioPlayback.ts
    "audioPlayback.failedToLoadRetry": "Не удалось загрузить · Повторить",
    "audioPlayback.clickToPlay": "Нажмите для воспроизведения",

    // src/lib/utils/clientGeneration.ts
    "clientGeneration.sessionChangedBeforeTheOperationFinished":
        "Сеанс изменился до завершения операции",

    // src/lib/utils/customFont.ts
    "customFont.useAWoff2TtfOrOtf":
        "Используйте файл шрифта .woff2, .ttf или .otf.",
    "customFont.thatFontFileIsEmpty": "Этот файл шрифта пуст.",
    "customFont.fontFileIsTooLargeMax":
        "Файл шрифта слишком большой (максимум 10 МБ).",
    "customFont.customFont": "Свой шрифт",

    // src/lib/utils/deviceSessions.ts
    "deviceSessions.unknown": "Неизвестно",
    "deviceSessions.justNow": "Только что",
    "deviceSessions.desktopApp": "Приложение для компьютера",
    "deviceSessions.on": "{client} на {os}",
    "deviceSessions.minutesAgo":
        "{count, plural, one {# минуту назад} few {# минуты назад} many {# минут назад} other {# минуты назад}}",
    "deviceSessions.hoursAgo":
        "{count, plural, one {# час назад} few {# часа назад} many {# часов назад} other {# часа назад}}",
    "deviceSessions.daysAgo":
        "{count, plural, one {# день назад} few {# дня назад} many {# дней назад} other {# дня назад}}",

    // src/lib/utils/displaySources.ts
    "displaySources.screen": "Экран",
    "displaySources.untitledWindow": "Окно без названия",

    // src/lib/utils/encryptionState.ts
    "encryptionState.unableToDecryptYouMayNot":
        "Не удалось расшифровать - возможно, у вас нет ключей для этого сообщения.",
    "encryptionState.theSenderChoseNotToShare":
        "Отправитель решил не передавать ключи для этого сообщения.",
    "encryptionState.theSenderDidNotShareThe":
        "Отправитель не передал ключи, потому что это устройство не подтверждено. Подтвердите это устройство, чтобы читать такие сообщения.",
    "encryptionState.senderDeviceNotCrossSigned":
        "Устройство отправителя не подписано его владельцем перекрёстной подписью, поэтому это сообщение скрыто. Попросите его подтвердить тот сеанс.",
    "encryptionState.senderDeviceUnknown":
        "Это сообщение не удаётся связать ни с одним известным устройством отправителя, поэтому оно скрыто.",
    "encryptionState.senderIdentityChanged":
        "Идентичность отправителя изменилась с тех пор, как вы его подтвердили, поэтому это сообщение скрыто. Подтвердите его заново, чтобы прочитать.",
    "encryptionState.historicalNoBackup":
        "Это сообщение было отправлено до входа на этом устройстве, а резервной копии ключей для его восстановления нет.",
    "encryptionState.historicalBackupUnconfigured":
        "Это сообщение было отправлено до входа на этом устройстве. Введите ключ восстановления, чтобы восстановить его из резервной копии ключей.",
    "encryptionState.historicalWorkingBackup":
        "Это сообщение было отправлено до входа на этом устройстве и не найдено в вашей резервной копии ключей.",
    "encryptionState.historicalNotJoined":
        "Это сообщение было отправлено, когда вас не было в комнате.",
    "encryptionState.encryptedMessage": "🔒 Зашифрованное сообщение",

    // src/lib/utils/eventShield.ts
    "eventShield.thisMessageSEncryptionCouldNot":
        "Шифрование этого сообщения не удалось полностью проверить.",
    "eventShield.encryptedByAnUnverifiedUser":
        "Зашифровано неподтверждённым пользователем.",
    "eventShield.encryptedByADeviceNotVerified":
        "Зашифровано устройством, не подтверждённым его владельцем.",
    "eventShield.encryptedByAnUnknownOrDeleted":
        "Зашифровано неизвестным или удалённым устройством.",
    "eventShield.theAuthenticityOfThisEncryptedMessage":
        "Подлинность этого зашифрованного сообщения нельзя гарантировать на этом устройстве.",
    "eventShield.theSenderWasPreviouslyVerifiedBut":
        "Отправитель ранее был подтверждён, но сменил свою идентичность.",
    "eventShield.theSenderDoesnTMatchThe":
        "Отправитель не совпадает с владельцем устройства, отправившего это сообщение.",

    // src/lib/utils/extendedProfile.ts
    "extendedProfile.aStatusNeedsBothAnEmoji":
        "Для статуса нужны и эмодзи, и текст.",
    "extendedProfile.inACall": "В звонке",
    "extendedProfile.inACallForMin": "В звонке {minutes} мин",
    "extendedProfile.inACallForH": "В звонке {hours} ч",
    "extendedProfile.other": "Другое",
    "extendedProfile.atMostLinks": "Не более {MAX_CONNECTIONS} ссылок.",
    "extendedProfile.linksMustBeHttpHttpsMailto":
        "Ссылки должны быть адресами http, https, mailto или matrix.",
    "extendedProfile.inACallForHMin": "В звонке {hours} ч {minutes} мин",

    // src/lib/utils/geoErrors.ts
    "geoErrors.locationNeedsASecureHttpsConnection":
        "Для определения местоположения нужно защищённое соединение (HTTPS) - откройте приложение по https.",
    "geoErrors.locationPermissionWasDeniedCheckSite":
        "Доступ к местоположению запрещён - проверьте разрешения сайта.",
    "geoErrors.yourPositionIsUnavailableLocationOff":
        "Ваше положение недоступно (местоположение выключено или нет сигнала GPS).",
    "geoErrors.timedOutGettingYourLocation":
        "Время ожидания определения местоположения истекло.",
    "geoErrors.couldnTGetYourLocation":
        "Не удалось определить ваше местоположение.",
    "geoErrors.locationIsnTAvailableInThis":
        "Определение местоположения недоступно в этом браузере.",

    // src/lib/utils/joinRules.ts
    "joinRules.onlyAvailableForRoomsInsideA":
        "Доступно только для комнат внутри пространства",
    "joinRules.thisRoomSVersionDoesnT":
        "Версия этой комнаты не поддерживает вступление, ограниченное пространством",

    // src/lib/utils/keyBackup.ts
    "keyBackup.preparing": "Подготовка…",
    "keyBackup.fetchingYourEncryptedHistory":
        "Получение зашифрованной истории…",
    "keyBackup.restoringYourEncryptedHistory":
        "Восстановление зашифрованной истории…",
    "keyBackup.restoringOfKeys":
        "Восстановлено ключей: {successes} из {total}…",
    "keyBackup.noEncryptedHistoryToRestore":
        "Нет зашифрованной истории для восстановления",
    "keyBackup.restored":
        "{count, plural, one {Восстановлен # ключ} few {Восстановлено # ключа} many {Восстановлено # ключей} other {Восстановлено # ключа}}",
    "keyBackup.ofKeysRestored": "Восстановлено ключей: {imported} из {total}",
    "keyBackup.notSetUp": "Не настроено",
    "keyBackup.notTrusted": "Нет доверия",
    "keyBackup.notConnected": "Не подключено",
    "keyBackup.on": "Включено",
    "keyBackup.encryptedMessageHistoryIsnTBeing":
        "Резервная копия истории зашифрованных сообщений не создаётся. Настройте восстановление, чтобы защитить её.",
    "keyBackup.aBackupExistsOnTheServer":
        "Резервная копия на сервере есть, но этот сеанс ей пока не доверяет.",
    "keyBackup.aBackupExistsButThisSession":
        "Резервная копия есть, но этот сеанс к ней не подключён. Введите ключ восстановления, чтобы восстановить историю.",
    "keyBackup.messageHistoryIsBeingBackedUp":
        "Резервная копия истории сообщений создаётся (v{version}).",
    "keyBackup.messageHistoryIsBeingBackedUp2":
        "Резервная копия истории сообщений создаётся.",
    "keyBackup.noKeysBackedUpYet": "Ключи пока не сохранены в резервной копии",
    "keyBackup.backedUp":
        "{count, plural, one {# ключ сохранён в резервной копии} few {# ключа сохранено в резервной копии} many {# ключей сохранено в резервной копии} other {# ключа сохранено в резервной копии}}",
    "keyBackup.stillToUpload":
        "{count, plural, one {# ключ ещё предстоит загрузить} few {# ключа ещё предстоит загрузить} many {# ключей ещё предстоит загрузить} other {# ключа ещё предстоит загрузить}}",
    "keyBackup.everythingOnThisSessionIsBacked":
        "Всё, что есть в этом сеансе, сохранено в резервной копии",
    "keyBackup.notSet": "Не задано",
    "keyExportSettings.exportOrImportRoomKeys":
        "Экспорт или импорт ключей комнат",
    "keyExportSettings.aKeyFileLetsAnotherApp":
        "Файл ключей позволяет другому приложению Matrix или новому сеансу читать историю ваших зашифрованных сообщений. Храните файл и его парольную фразу в надёжном месте: любой, у кого есть и то и другое, может читать ваши сообщения.",
    "keyExportSettings.export": "Экспорт",
    "keyExportSettings.import": "Импорт",
    "keyExportSettings.passphrase": "Парольная фраза",
    "keyExportSettings.confirmPassphrase": "Подтвердите парольную фразу",
    "keyExportSettings.passphrasesDontMatch": "Парольные фразы не совпадают",
    "keyExportSettings.exportKeys": "Экспортировать ключи",
    "keyExportSettings.exporting": "Экспорт…",
    "keyExportSettings.exported":
        "{count, plural, one {Экспортирован # ключ} few {Экспортировано # ключа} many {Экспортировано # ключей} other {Экспортировано # ключа}}",
    "keyExportSettings.couldNotExportYourKeys":
        "Не удалось экспортировать ваши ключи",
    "keyExportSettings.keyFile": "Файл ключей",
    "keyExportSettings.importKeys": "Импортировать ключи",
    "keyExportSettings.wrongPassphrase":
        "Неверная парольная фраза, либо файл был изменён",
    "keyExportSettings.notAKeyFile": "Это не файл ключей, либо он повреждён",
    "keyExportSettings.newerFormat":
        "Этот файл ключей создан более новым приложением и не может быть прочитан здесь",
    "keyExportSettings.couldNotImportTheKeys": "Не удалось импортировать ключи",

    // src/lib/utils/keywordRules.ts
    "keywordRules.keywordCannotBeEmpty": "Ключевое слово не может быть пустым",
    "keywordRules.keywordCannotStartWith":
        "Ключевое слово не может начинаться с «.»",
    "keywordRules.youAlreadyHaveARuleFor":
        "У вас уже есть правило для этого ключевого слова",

    // src/lib/utils/liveAnnouncer.ts
    "liveAnnouncer.messageFrom": "Сообщение от {sender}",
    "liveAnnouncer.newMessagesFrom":
        "{count, plural, one {# новое сообщение от {sender}} few {# новых сообщения от {sender}} many {# новых сообщений от {sender}} other {# новых сообщения от {sender}}}",
    "liveAnnouncer.newMessages":
        "{count, plural, one {# новое сообщение} few {# новых сообщения} many {# новых сообщений} other {# новых сообщения}}",

    // src/lib/utils/liveShareStop.ts
    "liveShareStop.couldnTStopSharingYourLive":
        "Не удалось остановить передачу вашего местоположения в реальном времени - оно по-прежнему видно этой комнате. Нажмите «Повторить остановку», чтобы попробовать снова.",
    "liveShareStop.stopping": "Остановка…",
    "liveShareStop.stillSharingCouldnTStop":
        "Передача продолжается - не удалось остановить",
    "liveShareStop.youReAlreadySharingYourLive":
        "Вы уже делитесь своим местоположением в реальном времени в этой комнате.",
    "liveShareStop.yourLastLiveLocationShareHere":
        "Ваша последняя передача местоположения в реальном времени здесь ещё не остановлена - остановите её через баннер комнаты, прежде чем начинать новую.",
    "liveShareStop.stop": "Остановить",
    "liveShareStop.retryStop": "Повторить остановку",

    // src/lib/utils/location.ts
    "location.location": "Местоположение",

    // src/lib/utils/mediaGallery.ts
    "mediaGallery.of": "{value} из {length}{value2}",

    // src/lib/utils/messageActionsMenu.ts
    "messageActionsMenu.edit": "Изменить",
    "messageActionsMenu.unpin": "Открепить",
    "messageActionsMenu.pin": "Закрепить",
    "messageActionsMenu.copyLink": "Копировать ссылку",
    "messageActionsMenu.report": "Пожаловаться",

    // src/lib/utils/messageDisplay.ts
    "messageDisplay.systemDefault": "Как в системе",

    // src/lib/utils/micErrorMessage.ts
    "micErrorMessage.microphoneAccessIsBlockedAllowIt":
        "Доступ к микрофону заблокирован - разрешите его в настройках браузера или системы, чтобы говорить",
    "micErrorMessage.noMicrophoneFoundConnectOneOr":
        "Микрофон не найден - подключите его или выберите другое устройство ввода, чтобы говорить",
    "micErrorMessage.couldNotOpenYourMicrophoneAnother":
        "Не удалось открыть микрофон - возможно, его использует другое приложение",

    // src/lib/utils/mutePowerLevel.ts
    "mutePowerLevel.enterAPowerLevel": "Введите уровень доступа",
    "mutePowerLevel.mustBeAWholeNumber": "Должно быть целое число",
    "mutePowerLevel.useToMute":
        "Используйте {MUTE_POWER_LEVEL}, чтобы запретить писать",
    "mutePowerLevel.youCanTSetALevel":
        "Вы не можете задать уровень выше своего ({ceiling})",

    // src/lib/utils/notifActions.ts
    "notifActions.reply": "Ответить",
    "notifActions.reply2": "Ответить…",
    "notifActions.markAsRead": "Отметить прочитанным",

    // src/lib/utils/notificationPrivacy.ts
    "notificationPrivacy.sentAMessage": "отправил(а) сообщение",
    "notificationPrivacy.newMessage": "Новое сообщение",

    // src/lib/utils/notifyPermission.ts
    "notifyPermission.notificationsAreBlockedSoIncomingCalls":
        "Уведомления заблокированы, поэтому входящие звонки не будут оповещать вас, когда это окно скрыто. Разрешите уведомления в системных настройках.",
    "notifyPermission.thisBrowserCanTShowCall":
        "Этот браузер не может показывать оповещения о звонках, когда окно скрыто.",

    // src/lib/utils/pollContent.ts
    "pollContent.addAQuestion": "Добавьте вопрос.",
    "pollContent.addAtLeastTwoOptions": "Добавьте не менее двух вариантов.",
    "pollContent.atMostOptions": "Не более {MAX_ANSWERS} вариантов.",
    "pollContent.invalidNumberOfSelections":
        "Недопустимое число выбранных вариантов.",
    "pollContent.thePollHasEnded": "Опрос завершён.",

    // src/lib/utils/powerLevels.ts
    "powerLevels.enterAPowerLevel": "Введите уровень доступа",
    "powerLevels.mustBeAWholeNumber": "Должно быть целое число",
    "powerLevels.mustBe0OrHigher": "Должно быть 0 или больше",
    "powerLevels.youCanTSetALevel":
        "Вы не можете задать уровень выше своего ({ceiling})",

    // src/lib/utils/presence.ts
    "presence.online": "В сети",
    "presence.away": "Нет на месте",
    "presence.offline": "Не в сети",
    "presence.seenAsOnlineWhileTheApp":
        "Отображается как «в сети», пока приложение синхронизируется",
    "presence.shownAsIdleToOtherUsers":
        "Другим пользователям отображается как «нет на месте»",
    "presence.doNotDisturb": "Не беспокоить",
    "presence.doNotDisturbDescription":
        "Отключает уведомления и звонки на всех ваших устройствах",
    "presence.invisible": "Невидимка",
    "presence.appearOfflineToOtherUsers":
        "Выглядеть «не в сети» для других пользователей",

    // src/lib/utils/pushRuleWrite.ts
    "pushRuleWrite.yourHomeserverHasNoNotificationRule":
        "На вашем домашнем сервере нет правила уведомлений «{label}», поэтому его нельзя изменить.",
    "pushRuleWrite.yourHomeserverRejectedTheChangeTo":
        "Ваш домашний сервер отклонил изменение уведомлений «{label}».",
    "pushRuleWrite.notificationsDidNotChangeOnYour":
        "Уведомления «{label}» не изменились на вашем домашнем сервере.",
    "pushRuleWrite.couldNotSaveNotificationsCheckYour":
        "Не удалось сохранить уведомления «{label}». Проверьте подключение и повторите.",

    // src/lib/utils/pusherVerification.ts
    "pusherVerification.noGatewayUrl": "(нет URL шлюза)",

    // src/lib/utils/recoveryPassphrase.ts
    "recoveryPassphrase.enterAPassphrase": "Введите парольную фразу.",
    "recoveryPassphrase.useAtLeastCharacters":
        "Используйте не менее {MIN_PASSPHRASE_LENGTH} символов.",

    // src/lib/utils/reportMessage.ts
    "reportMessage.failedToSendReport": "Не удалось отправить жалобу",

    // src/lib/utils/roomAliases.ts
    "roomAliases.enterAnAddress": "Введите адрес.",
    "roomAliases.addressesCannotContainSpaces":
        "Адреса не могут содержать пробелы.",
    "roomAliases.addressesCannotContain": "Адреса не могут содержать «:».",
    "roomAliases.addressesCannotContain2": "Адреса не могут содержать «#».",
    "roomAliases.addressesCannotContainControlCharacters":
        "Адреса не могут содержать управляющие символы.",
    "roomAliases.addressIsTooLongMaxCharacters":
        "Адрес слишком длинный (максимум {MAX_ALIAS_LENGTH} символов).",
    "roomAliases.thatAddressAlreadyExists": "Такой адрес уже существует.",

    // src/lib/utils/roomCreationOutcome.ts
    "roomCreationOutcome.theServerRejectedTheChange":
        "сервер отклонил изменение",
    "roomCreationOutcome.theRoomWasCreatedButAdding":
        "Комната создана, но добавить её в пространство не удалось: {detailSentence}",
    "roomCreationOutcome.theDirectMessageWasCreatedBut":
        "Личный чат создан, но сохранить его в списке личных чатов не удалось: {detailSentence} Он может отображаться как обычная комната, пока попытка не будет повторена.",
    "roomCreationOutcome.theRoomWasCreatedButAdding2":
        "Комната создана, но добавление её в пространство ещё не подтверждено - возможно, оно ещё сохраняется. Повторите, если комната не появится в пространстве.",
    "roomCreationOutcome.theDirectMessageWasCreatedBut2":
        "Личный чат создан, но сохранение его в списке личных чатов ещё не подтверждено - возможно, оно ещё сохраняется. Повторите, если он не появится в вашем списке личных чатов.",

    // src/lib/utils/roomEncryption.ts
    "roomEncryption.thisRoomIsAlreadyEncrypted": "Эта комната уже зашифрована.",
    "roomEncryption.youNeedPowerLevelToEnable":
        "Для включения шифрования нужен уровень доступа {required}.",
    "roomEncryption.youAlreadyHaveADirectMessage":
        "У вас уже есть личный чат с этим пользователем, и он не зашифрован. Шифрование нельзя добавить автоматически - откройте его и включите в настройках безопасности комнаты.",
    "roomEncryption.enableEncryptionWarning":
        "Шифрование нельзя отключить после включения. Чтобы читать новые сообщения, всем понадобится клиент с поддержкой шифрования.",

    // src/lib/utils/roomHeaderMenu.ts
    "roomHeaderMenu.threads": "Обсуждения",
    "roomHeaderMenu.pinnedMessages": "Закреплённые сообщения",
    "roomHeaderMenu.notificationsInbox": "Входящие уведомления",
    "roomHeaderMenu.mediaAndFiles": "Медиа и файлы",
    "roomHeaderMenu.memberList": "Список участников",

    // src/lib/utils/roomMedia.ts
    "roomMedia.image": "Изображение",
    "roomMedia.video": "Видео",
    "roomMedia.file": "Файл",
    "roomMedia.audio": "Аудио",
    "roomMedia.kb": "{toFixed} КБ",
    "roomMedia.mb": "{toFixed} МБ",

    // src/lib/utils/roomSettingsNav.ts
    "roomSettingsNav.general": "Общие",
    "roomSettingsNav.access": "Доступ",
    "roomSettingsNav.security": "Безопасность",
    "roomSettingsNav.permissions": "Права",
    "roomSettingsNav.members": "Участники",
    "roomSettingsNav.emotes": "Эмодзи",
    "roomSettingsNav.rooms": "Комнаты",

    // src/lib/utils/roomStateTrust.ts
    "roomStateTrust.unverifiedRoomState": "Непроверенное состояние комнаты",
    "roomStateTrust.unverifiedRoomStateTooltip":
        "Некоторые сведения об этой комнате (роли, участники и права) были получены напрямую с сервера и не подтверждены синхронизацией, поэтому они могут быть неточными. Действия в любом случае проверяются сервером, что бы ни показывалось здесь.",

    // src/lib/utils/roomUpgrade.ts
    "roomUpgrade.theServerSRecommendedRoomVersion":
        "Рекомендуемая сервером версия комнаты недоступна.",
    "roomUpgrade.thisRoomIsOnTheLatest":
        "Эта комната уже на последней версии (v{recommendedVersion}).",
    "roomUpgrade.youDonTHavePermissionTo":
        "У вас нет прав обновлять эту комнату.",

    // src/lib/utils/saveFile.ts
    "saveFile.savedToDownloads": "Сохранено в «Загрузки»",

    // src/lib/utils/securityStatusView.ts
    "securityStatusView.couldnTReadThisAccountS":
        "Не удалось прочитать состояние шифрования этой учётной записи. Ничего здесь нельзя считать достоверным, пока оно не загрузится - пока не настраивайте и не сбрасывайте восстановление.",
    "securityStatusView.encryptionIsnTReadyOnThis":
        "Шифрование в этом сеансе ещё не готово. Перезагрузите, если это не проходит.",

    // src/lib/utils/serverAcl.ts
    "serverAcl.allowListIsEmptyWhichDenies":
        "Список разрешённых пуст, что запрещает федерацию всем серверам.",
    "serverAcl.denyListContainsWhichBansAll":
        "Список запрещённых содержит *, что блокирует все серверы.",
    "serverAcl.thisConfigurationBansYourOwnServer":
        "Эта конфигурация блокирует ваш собственный сервер ({ownServerName}), что нарушит федерацию.",

    // src/lib/utils/serverCapabilities.ts
    "serverCapabilities.crossSigningE2ee": "Перекрёстная подпись (E2EE)",
    "serverCapabilities.privateReadReceipts": "Приватные отметки о прочтении",
    "serverCapabilities.threadedRelations": "Связи обсуждений",
    "serverCapabilities.spaceSummaries": "Сводки пространств",
    "serverCapabilities.busyPresence": "Статус «занят»",
    "serverCapabilities.dehydratedDevices": "Обезвоженные устройства",
    "serverCapabilities.filterPublicRoomsByType":
        "Фильтр публичных комнат по типу",
    "serverCapabilities.authenticatedMedia": "Медиа с аутентификацией",
    "serverCapabilities.intentionalMentions": "Намеренные упоминания",
    "serverCapabilities.slidingSyncSimplified": "Sliding sync (упрощённый)",
    "serverCapabilities.sharedRoomsWithAUser": "Общие комнаты с пользователем",

    // src/lib/utils/settingsNav.ts
    "settingsNav.account": "Учётная запись",
    "settingsNav.securitySessions": "Безопасность и сеансы",
    "settingsNav.privacySafety": "Конфиденциальность и безопасность",
    "settingsNav.app": "Приложение",
    "settingsNav.appearance": "Внешний вид",
    "settingsNav.messagesMedia": "Сообщения и медиа",
    "settingsNav.voiceVideo": "Голос и видео",
    "settingsNav.emotes": "Эмодзи",
    "settingsNav.advanced": "Дополнительно",
    "settingsNav.general": "Общие",
    "settingsNav.plugins": "Плагины",
    "settingsNav.server": "Сервер",
    "settingsNav.about": "О программе",
    "settingsNav.debug": "Отладка",

    // src/lib/utils/settingsSearch.ts
    "settingsSearch.displayName": "Отображаемое имя",
    "settingsSearch.avatar": "Аватар",
    "settingsSearch.presence": "Статус присутствия",
    "settingsSearch.changePassword": "Сменить пароль",
    "settingsSearch.logOut": "Выйти",
    "settingsSearch.deactivateAccount": "Деактивировать учётную запись",
    "settingsSearch.sessions": "Сеансы",
    "settingsSearch.encryptNewDirectMessages": "Шифровать новые личные чаты",
    "settingsSearch.onlySendToVerifiedDevices":
        "Отправлять только на подтверждённые устройства",
    "settingsSearch.setUpRecovery": "Настроить восстановление",
    "settingsSearch.restoreMessageHistory": "Восстановить историю сообщений",
    "settingsSearch.verifyThisSession": "Подтвердить этот сеанс",
    "settingsSearch.rightAlignMyMessages":
        "Выравнивать мои сообщения по правому краю",
    "settingsSearch.showWhenIAmInA": "Показывать, когда я в звонке",
    "settingsSearch.showNameColours": "Показывать цвета имён",
    "settingsSearch.textSize": "Размер текста",
    "settingsSearch.font": "Шрифт",
    "settingsSearch.themePresets": "Пресеты тем",
    "settingsSearch.importExportTheme": "Импорт / экспорт темы",
    "settingsSearch.timeFormat": "Формат времени",
    "settingsSearch.dateFormat": "Формат даты",
    "settingsSearch.showMatrixIds": "Показывать Matrix ID",
    "settingsSearch.readReceiptAvatars": "Аватары отметок о прочтении",
    "settingsSearch.linkPreviews": "Предпросмотр ссылок",
    "settingsSearch.linkPreviewMedia": "Медиа предпросмотра ссылок",
    "settingsSearch.pauseVideosOffScreen": "Приостанавливать видео вне экрана",
    "settingsSearch.sendVideosThatStreamFaster":
        "Отправлять видео, которые начинают воспроизводиться быстрее",
    "settingsSearch.sendPhotosThatAppearSooner":
        "Отправлять фото, которые появляются быстрее",
    "settingsSearch.removeLocationAndMetadata":
        "Удалять местоположение и другие метаданные из загружаемых файлов",
    "settingsSearch.sendGifsAsAnimatedWebp":
        "Отправлять GIF как анимированный WebP",
    "settingsSearch.midiSoundBank": "Банк звуков MIDI",
    "settingsSearch.holdToOpenMessageMenu":
        "Удерживать для открытия меню сообщения",
    "settingsSearch.checkSpelling": "Проверять орфографию",
    "settingsSearch.gifDefaultTab": "Вкладка GIF по умолчанию",
    "settingsSearch.minimiseToTrayOnClose": "Сворачивать в трей при закрытии",
    "settingsSearch.richPresence": "Расширенный статус",
    "settingsSearch.runAtStartup": "Запускать при старте системы",
    "settingsSearch.proxy": "Прокси",
    "settingsSearch.reduceMotion": "Уменьшить анимацию",
    "settingsSearch.keepRoomListOpen": "Не закрывать список комнат",
    "settingsSearch.customEmotes": "Свои эмодзи",
    "settingsSearch.pushNotificationsPermission":
        "Разрешение на push-уведомления",
    "settingsSearch.notificationSound": "Звук уведомления",
    "settingsSearch.desktopAlertsPopUpAndTaskbar":
        "Оповещения на рабочем столе (всплывающее окно и мигание на панели задач)",
    "settingsSearch.popUpNotifications": "Всплывающие уведомления",
    "settingsSearch.quietOnMyOtherDevices": "Тишина на моих других устройствах",
    "settingsSearch.privateReadReceipts": "Приватные отметки о прочтении",
    "settingsSearch.hideMessageTextInNotifications":
        "Скрывать текст сообщений в уведомлениях",
    "settingsSearch.notificationRules": "Правила уведомлений",
    "settingsSearch.keywordHighlights": "Выделение ключевых слов",
    "settingsSearch.inputDevice": "Устройство ввода",
    "settingsSearch.outputDevice": "Устройство вывода",
    "settingsSearch.camera": "Камера",
    "settingsSearch.noiseSuppression": "Шумоподавление",
    "settingsSearch.echoCancellation": "Эхоподавление",
    "settingsSearch.autoGainControl": "Автоматическая регулировка усиления",
    "settingsSearch.normalizeVoices": "Выравнивать громкость голосов",
    "settingsSearch.mirrorMyCamera": "Зеркалить мою камеру",
    "settingsSearch.videoCodec": "Видеокодек",
    "settingsSearch.noiseSuppressionGpu": "Ускорение на GPU",
    "settingsSearch.adaptiveStream": "Адаптивное качество видео",
    "settingsSearch.callVolume": "Громкость звонка",
    "settingsSearch.playCallSounds": "Проигрывать звуки звонков",
    "settingsSearch.ringForIncomingDmCalls":
        "Звонить при входящих звонках в личных чатах",
    "settingsSearch.blockedUsers": "Заблокированные пользователи",
    "settingsSearch.serverCapabilities": "Возможности сервера",
    "settingsSearch.plugins": "Плагины",
    "settingsSearch.pluginRepositories": "Репозитории плагинов",
    "settingsSearch.syncPlugins": "Синхронизация плагинов",
    "settingsSearch.checkForUpdates": "Проверить обновления",
    "settingsSearch.clearCache": "Очистить кэш",
    "settingsSearch.showAllEvents": "Показывать все события",
    "settingsSearch.orderHints": "Подсказки порядка сообщений",
    "settingsSearch.stickyCallMembership": "Sticky-участие в звонках",
    "settingsSearch.pushDiagnostics": "Диагностика push-уведомлений",
    "settingsSearch.pushService": "Push-служба (UnifiedPush / Firebase)",
    "settingsSearch.language": "Язык",

    // src/lib/utils/slashCommands.ts
    "slashCommands.createAPoll": "Создать опрос",
    "slashCommands.shareYourLocation": "Поделиться местоположением",
    "slashCommands.joinARoomByAddress": "Присоединиться к комнате по адресу",
    "slashCommands.leaveTheCurrentRoom": "Покинуть текущую комнату",
    "slashCommands.inviteAUserToThisRoom":
        "Пригласить пользователя в эту комнату",
    "slashCommands.setTheRoomTopic": "Задать тему комнаты",
    "slashCommands.removeAUserFromThisRoom":
        "Исключить пользователя из этой комнаты",
    "slashCommands.userServerReason": "<@user:server> [причина]",
    "slashCommands.banAUserFromThisRoom":
        "Заблокировать пользователя в этой комнате",
    "slashCommands.setYourDisplayName": "Задать своё отображаемое имя",
    "slashCommands.displayName": "<отображаемое имя>",
    "slashCommands.setAUserSPowerLevel": "Задать уровень доступа пользователя",
    "slashCommands.userServerLevel": "<@user:server> [уровень]",
    "slashCommands.resetAUserSPowerLevel":
        "Сбросить уровень доступа пользователя до значения по умолчанию",
    "slashCommands.discardSession":
        "Использовать новый ключ комнаты для следующего сообщения, если люди не могут прочитать ваши",
    "slashCommands.usage": "Использование: /{name} {argHint}",
    "slashCommands.usage2": "Использование: /{name}",

    // src/lib/utils/syncStatus.ts
    "syncStatus.connected": "Подключено",
    "syncStatus.reconnecting": "Повторное подключение…",
    "syncStatus.connectionError": "Ошибка подключения",
    "syncStatus.offline": "Не в сети",
    "syncStatus.connecting": "Подключение…",

    // src/lib/utils/themePalette.ts
    "themePalette.accent": "Акцент",
    "themePalette.background": "Фон",
    "themePalette.secondaryBackground": "Вторичный фон",
    "themePalette.tertiaryBackground": "Третичный фон",
    "themePalette.primaryText": "Основной текст",
    "themePalette.secondaryText": "Вторичный текст",
    "themePalette.mutedText": "Приглушённый текст",
    "themePalette.danger": "Опасность",
    "themePalette.positive": "Успех",
    "themePalette.mentionHighlight": "Выделение упоминания",
    "themePalette.link": "Ссылка",
    "themePalette.warning": "Предупреждение",
    "themePalette.onlineStatus": "Статус «в сети»",
    "themePalette.idleStatus": "Статус «нет на месте»",
    "themePalette.doNotDisturbStatus": "Статус «не беспокоить»",
    "themePalette.offlineStatus": "Статус «не в сети»",
    "themePalette.divider": "Разделитель",
    "themePalette.spoilerBackground": "Фон спойлера",
    "themePalette.ownMessageBubble": "Пузырёк своего сообщения",
    "themePalette.primaryTextOnBackground": "Основной текст на фоне",
    "themePalette.secondaryTextOnBackground": "Вторичный текст на фоне",
    "themePalette.mutedTextOnTertiaryBackground":
        "Приглушённый текст на третичном фоне",
    "themePalette.whiteTextOnAccentButtons": "Белый текст на акцентных кнопках",
    "themePalette.whiteTextOnDangerButtons":
        "Белый текст на кнопках опасных действий",
    "themePalette.whiteTextOnOwnBubble": "Белый текст на своём пузырьке",

    // src/lib/utils/themePreset.ts
    "themePreset.copy": "{newName} (копия)",

    // src/lib/utils/threadList.ts
    "threadList.noPreview": "(нет предпросмотра)",

    // src/lib/utils/threePidInvite.ts
    "threePidInvite.youDonTHavePermissionTo":
        "У вас нет прав приглашать людей в эту комнату.",
    "threePidInvite.yourHomeserverHasNoIdentityServer":
        "У вашего домашнего сервера нет сервера идентификации, поэтому приглашения по электронной почте недоступны.",

    // src/lib/utils/timeFormat.ts
    "timeFormat.yesterdayAt": "Вчера в {time}",
    "timeFormat.today": "Сегодня",
    "timeFormat.yesterday": "Вчера",
    "timeFormat.separatorDatePattern": "EEEE, d MMMM yyyy",
    "timeFormat.monthDayPattern": "d MMM",
    "timeFormat.compactDateTime": "{date}, {time}",

    // src/lib/utils/updateStatus.ts
    "updateStatus.checkingForUpdates": "Проверка обновлений…",
    "updateStatus.youReOnTheLatestVersion":
        "У вас последняя версия{versionSuffix}",
    "updateStatus.checkForUpdates": "Проверить обновления",
    "updateStatus.updateAvailable": "Доступно обновление{versionSuffix}",
    "updateStatus.lastInstallFailed":
        "Обновление{versionSuffix} не удалось установить в прошлый раз",
    "updateStatus.downloadInstall": "Скачать и установить",
    "updateStatus.downloadingV": "Загрузка v{version}",
    "updateStatus.downloadingUpdate": "Загрузка обновления",
    "updateStatus.updateReadyInstall":
        "Обновление готово{versionSuffix} - Установить",
    "updateStatus.install": "Установить",
    "updateStatus.updateReadyRestartToApply":
        "Обновление готово{versionSuffix} - перезапустите для применения",
    "updateStatus.restartToApply": "Перезапустить для применения",
    "updateStatus.updateReadyReloadToApply":
        "Обновление готово{versionSuffix} - перезагрузите для применения",
    "updateStatus.reloadToApply": "Перезагрузить для применения",
    "updateStatus.aNewVersionIsAvailable":
        "Доступна новая версия{versionSuffix}",
    "updateStatus.openReleasePage": "Открыть страницу выпуска",
    "updateStatus.flatpakManualUpdate":
        "Доступно обновление{versionSuffix}. Установите его через центр приложений или командой flatpak update",
    "updateStatus.packageManagerUpdate":
        "Доступно обновление{versionSuffix}. Обновите через {manager}",
    "updateStatus.updateCheckFailed": "Не удалось проверить обновления",
    "updateStatus.checkForUpdatesToInstallThe":
        "Проверьте обновления, чтобы установить последнюю версию.",

    // src/lib/utils/uploadLimits.ts
    "uploadLimits.mb": "{round} МБ",
    "uploadLimits.kb": "{round} КБ",
    "uploadLimits.exceedsTheServerSUploadLimit":
        "«{fileName}» превышает ограничение сервера на загрузку: {formatByteLimit}",

    // src/lib/utils/verificationMessage.ts
    "verificationMessage.verificationRequestSent":
        "Запрос на подтверждение отправлен",
    "verificationMessage.waitingForThemToAccept":
        "Ожидание принятия собеседником…",
    "verificationMessage.noLongerPending": "Больше не ожидает",
    "verificationMessage.wantsToVerify": "{senderName} хочет подтвердить вас",
    "verificationMessage.compareEmojiToConfirmThisIs":
        "Сравните эмодзи, чтобы убедиться, что это действительно он",
    "verificationMessage.sentAVerificationRequest":
        "{senderName} отправил(а) запрос на подтверждение",

    // src/lib/utils/verificationStatus.ts
    "verificationStatus.checkingEncryption": "Проверка шифрования…",
    "verificationStatus.encryptionUnavailable": "Шифрование недоступно",
    "verificationStatus.statusUnavailable": "Состояние недоступно",
    "verificationStatus.verified": "Подтверждён",
    "verificationStatus.thisSessionIsVerifiedAndEncryption":
        "Этот сеанс подтверждён, шифрование полностью настроено.",
    "verificationStatus.notSetUp": "Не настроено",
    "verificationStatus.setUpEncryptionToSecureYour":
        "Настройте шифрование, чтобы защитить сообщения на всех устройствах.",
    "verificationStatus.setUp": "Настроить",
    "verificationStatus.encryptionSetupIncomplete":
        "Настройка шифрования не завершена",
    "verificationStatus.thisSessionIsVerifiedButEncryption":
        "Этот сеанс подтверждён, но настройка шифрования не завершена.",
    "verificationStatus.finishSetup": "Завершить настройку",
    "verificationStatus.unverified": "Не подтверждён",
    "verificationStatus.thisSessionIsnTVerifiedYet":
        "Этот сеанс ещё не подтверждён.",

    // src/routes/+layout.svelte
    "rootLayout.linkCopied": "Ссылка скопирована",

    // src/routes/+page.svelte
    "rootPage.failedToReconnectPleaseLogIn":
        "Не удалось переподключиться. Войдите снова.",
    "rootPage.sessionOpenInAnotherTab":
        "Этот сеанс открыт в другой вкладке. Эта вкладка продолжит работу, когда та закроется.",
    "rootPage.signedInButSyncingCouldNot":
        "Вход выполнен, но не удалось запустить синхронизацию. Попробуйте ещё раз.",
    "rootPage.yourSessionHasExpiredPleaseSign":
        "Ваш сеанс истёк. Войдите снова.",

    // ownStatus
    "ownStatus.profileField": "поле профиля {key}",
    "ownStatus.theServerStillHas": "На сервере всё ещё есть: {leftovers}",
    "messageInput.directFile": "Напрямую",
    "messageInput.directFileHint":
        "Отправляется напрямую при нажатии «Отправить», без загрузки на сервер.",
    "messageInput.sendDirectly": "Отправить напрямую",
    "messageItem.replyPreviewFileOffer": "Предложение файла",
    "fileOffer.unavailable":
        "Эта версия Zam не может прочитать это предложение файла.",
    "fileOffer.details": "{size}, отправлено напрямую",
    "fileOffer.waiting": "Ожидание, пока кто-нибудь примет. Не закрывайте Zam.",
    "fileOffer.fromElsewhere": "Предложено из другого вашего сеанса.",
    "fileOffer.gone": "Больше недоступно из этого сеанса.",
    "fileOffer.expired": "Срок действия этого предложения истёк.",
    "fileOffer.accept": "Принять",
    "fileOffer.retry": "Повторить",
    "fileOffer.cancel": "Отмена",
    "fileOffer.withdraw": "Отозвать",
    "fileOffer.connecting": "Подключение к отправителю...",
    "fileOffer.progress": "{done} из {total}, {rate}/с",
    "fileOffer.verifying": "Проверка файла...",
    "fileOffer.savedDone": "Файл сохранён и проверен.",
    "fileOffer.sentDone": "Доставлено: {peer}.",
    "fileOffer.sendingTo": "Кому: {peer}",
    "fileOffer.cancelled": "Передача отменена.",
    "fileOffer.failedOffline":
        "Отправитель недоступен. У него должен быть открыт Zam.",
    "fileOffer.failedRefused": "Сеанс отправителя отклонил эту передачу.",
    "fileOffer.failedNoRelay":
        "Для одноранговых соединений требуется ретранслятор, но его нет (TURN), поэтому файл нельзя отправить, не показав IP-адрес.",
    "fileOffer.failedConnection": "Соединение потеряно.",
    "fileOffer.failedStalled": "Передача перестала продвигаться.",
    "fileOffer.failedCorrupt":
        "Файл был изменён по пути, поэтому его отбросили.",
    "fileOffer.failedWrite":
        "Не удалось записать файл. Возможно, диск заполнен?",
    "fileOffer.failedStorageFull": "Недостаточно места для этого файла.",
    "fileOffer.failedHash":
        "Готовый файл не совпал с ожидаемым, поэтому его отбросили.",
    "fileOffer.failedUnsupported":
        "Это устройство пока не может сохранять прямые передачи.",
    "ownStatus.statusClearedButPresenceRemains":
        "Статус очищен, но сервер всё ещё показывает сообщение присутствия «{presenceLeft}». Скорее всего, оно задано другим сеансом этой учётной записи (другим приложением или клиентом) - очистите его там или завершите тот сеанс.",
    "qrLogin.failed": "Не удалось войти по QR-коду. Попробуйте ещё раз.",
    "qrLogin.cancelled": "Вход по QR-коду отменён.",
    "qrLogin.cancelledOther": "Другое устройство отменило вход.",
    "qrLogin.insecure":
        "Соединению с другим устройством нельзя доверять, поэтому вход остановлен.",
    "qrLogin.wrongServer":
        "Другое устройство выполнило вход на {server}, а это не тот сервер, который вы выбрали здесь.",
    "qrLogin.codeMismatch":
        "Число не совпало, поэтому вход остановлен. Продолжайте, только если число на другом устройстве - то, которое вы ввели.",
    "qrLogin.untrustedApproval":
        "Новое устройство попросило вас подтвердить вход по адресу, не принадлежащему провайдеру входа вашей учётной записи, поэтому запрос отклонён.",
    "qrLogin.enterNumber":
        "Введите число, показанное на другом вашем устройстве. Это проверяет, что соединены только вы двое.",
    "qrLogin.numberLabel": "Число",
    "qrLogin.confirm": "Продолжить",
    "qrLogin.waitingApproval":
        "Подтвердите вход на другом устройстве, чтобы завершить.",
    "qrLogin.notVerified":
        "Вы вошли, но этот сеанс не смог получить ваши ключи шифрования. Подтвердите его в настройках, чтобы читать старые зашифрованные сообщения.",
    "qrLogin.linkConnecting": "Подключение к новому устройству...",
    "qrLogin.linkShowNumber": "Введите это число на новом устройстве",
    "qrLogin.linkDoneVerified":
        "На новом устройстве выполнен вход, и оно подтверждено.",
    "qrLogin.denied": "Вход был отклонён на другом устройстве.",
    "qrLogin.expired": "Срок действия QR-кода истёк. Попробуйте ещё раз.",
    "qrLogin.notALoginCode":
        "Это не код входа с нового устройства этой учётной записи. Откройте «Войти по QR-коду» на устройстве, на котором хотите войти.",
    "qrLogin.notSupportedHere":
        "Провайдер входа этой учётной записи не поддерживает вход по QR-коду.",
    "qrLogin.signInButton": "Войти по QR-коду",
    "qrLogin.signInTitle": "Войти по QR-коду",
    "qrLogin.signInSteps":
        "На устройстве, где вход в Zam уже выполнен, откройте «Настройки», затем «Учётная запись», затем «Сканировать QR-код для входа на новом устройстве» и отсканируйте этот код.",
    "qrLogin.codeAlt":
        "QR-код для сканирования с устройства, на котором выполнен вход",
    "qrLogin.preparing": "Подготовка кода...",
    "qrLogin.matchCode":
        "На странице подтверждения будет показан этот код. Подтверждайте, только если он совпадает.",
    "qrLogin.signingIn": "Вход...",
    "qrLogin.cancel": "Отмена",
    "qrLogin.linkButton": "Сканировать QR-код для входа на новом устройстве",
    "qrLogin.linkTitle": "Привязать новое устройство",
    "qrLogin.linkIntro":
        "На новом устройстве выберите «Войти по QR-коду», затем отсканируйте показанный им код. Вы подтверждаете вход на странице входа вашей учётной записи, после чего два устройства подтверждают друг друга.",
    "qrLogin.linkWarning":
        "Продолжайте, только если устройство сейчас у вас в руках.",
    "qrLogin.linkApprove":
        "Подтвердите вход на {host}. Убедитесь, что показанный там код совпадает с кодом на новом устройстве, и подтверждайте, только если устройство ваше.",
    "qrLogin.linkApproveButton": "Подтвердить на {host}",
    "qrLogin.linkWaiting": "Ожидание входа на новом устройстве...",
    "qrLogin.linkDone":
        "На новом устройстве выполнен вход. Завершите его подтверждение в окне, которое только что открылось на обоих устройствах.",
    "qrLogin.linkDoneUnverified":
        "На новом устройстве выполнен вход. Не удалось автоматически начать подтверждение; подтвердите его в «Настройки», затем «Сеансы».",
    "qrLogin.notADeviceCode":
        "Это недействительный код. Введите код, показанный на новом устройстве.",
    "qrLogin.loginSectionTitle": "Вход",
    "qrLogin.loginSectionIntro":
        "Войдите на другом устройстве с этого, не вводя имя пользователя и пароль.",
    "qrLogin.codeButton": "Ввести код с нового устройства",
    "qrLogin.codeTitle": "Войти по коду",
    "qrLogin.codeIntro":
        "На новом устройстве выберите «Войти по QR-коду». Под QR-кодом показан короткий код; введите его здесь.",
    "qrLogin.codeLabel": "Код, показанный на новом устройстве",
    "qrLogin.codeContinue": "Продолжить",
    "qrLogin.orEnterCode":
        "Нет камеры? На устройстве, где вход выполнен, откройте «Настройки», затем «Учётная запись», затем «Вход», выберите «Ввести код с нового устройства» и введите код ниже.",
    "qrLogin.notAShownCode":
        "Это не код с устройства, на котором выполнен вход. На таком устройстве откройте «Настройки», затем «Учётная запись», затем «Вход» и выберите «Показать QR-код для сканирования на новом устройстве».",
    "qrLogin.showButton":
        "Показать QR-код для сканирования на новом устройстве",
    "qrLogin.showTitle": "Показать код для нового устройства",
    "qrLogin.showIntro":
        "На новом устройстве выберите «Войти по QR-коду», затем «Отсканировать код с устройства, на котором выполнен вход», и отсканируйте этот код.",
    "qrLogin.showCodeAlt": "QR-код для сканирования с нового устройства",
    "qrLogin.showEnterNumber": "Введите число, показанное на новом устройстве",
    "qrLogin.showRetry": "Показать новый код",
    "qrLogin.scanInstead":
        "Отсканировать код с устройства, на котором выполнен вход",
    "qrLogin.scanTitle":
        "Отсканировать код с устройства, на котором выполнен вход",
    "qrLogin.scanIntro":
        "На устройстве, где вход выполнен, откройте «Настройки», затем «Учётная запись», затем «Вход», выберите «Показать QR-код для сканирования на новом устройстве» и отсканируйте его здесь.",
    "qrLogin.scanShowNumber":
        "Введите это число на устройстве, где вход выполнен, затем подтвердите там вход.",
    "qrLogin.showInstead": "Показать мой собственный код",
    "qrLogin.chooseIntro":
        "Одновременно вошло более одного нового сеанса. Выберите тот, который вы настраиваете.",
    "qrLogin.linkClose": "Закрыть",
    // src/lib/components/messages/MessageEmbed.svelte
    "messageEmbed.deleted": "Сообщение удалено",
    "messageEmbed.inRoom": "в {room}",
    "messageEmbed.jumpToMessage": "Перейти к связанному сообщению:",
    "messageActionsMenu.copyText": "Копировать текст сообщения",
    "messageActionsMenu.textCopied": "Текст сообщения скопирован",
    "messageActionsMenu.couldnTCopyText":
        "Не удалось скопировать текст сообщения",
    "messageActionsMenu.selectHint":
        "Нажмите и удерживайте текст, чтобы выделить его часть",
    "roomSettings.readReceipts": "Отметки о прочтении",
    "roomSettings.readReceiptsRoomHelp":
        "Выберите, могут ли другие участники видеть, какие сообщения вы прочитали в этой комнате.",
    "roomSettings.readReceiptsSpaceHelp":
        "Выберите, могут ли другие участники видеть, какие сообщения вы прочитали в этом пространстве и его комнатах. Собственный выбор комнаты имеет приоритет.",
    "roomSettings.readReceiptsDefaultShare":
        "Зависит от ваших настроек приватности, сейчас показывается другим",
    "roomSettings.readReceiptsDefaultHide":
        "Зависит от ваших настроек приватности, сейчас скрыто от других",
    "roomSettings.readReceiptsShare": "Показывать мои отметки о прочтении",
    "roomSettings.readReceiptsShareDesc":
        "Другие могут видеть, какие сообщения вы прочитали.",
    "roomSettings.readReceiptsHide": "Скрывать мои отметки о прочтении",
    "roomSettings.readReceiptsHideDesc":
        "Состояние непрочитанного по-прежнему синхронизируется, но другие не видят, что вы прочитали.",
    "privacySafetySettings.receiptsOverrideHint":
        "Комнаты и пространства могут переопределить это в своих настройках уведомлений.",
    "richPresence.steam": "Расширенный статус Steam",
    "richPresence.steamHint":
        "Показывает игру Steam, в которую вы играете, вместе с её расширенным статусом, например картой или режимом. Это включает локальный порт отладки Steam, который слушает только этот компьютер. Чтобы изменения вступили в силу, Steam нужно перезапустить один раз.",
    "richPresence.steamConnected": "Подключено к Steam.",
    "richPresence.steamNeedsRestart":
        "Порт отладки Steam ещё не открыт. Перезапустите Steam, чтобы открыть его.",
    "richPresence.steamNotRunning":
        "Steam не запущен. Запустите его, и Zam подключится автоматически.",
    "richPresence.restartSteam": "Перезапустить Steam",
    "richPresence.restartSteamTitle": "Перезапустить Steam?",
    "richPresence.restartSteamBody":
        "Steam закроется и откроется снова. Игры, запущенные из Steam, могут быть закрыты вместе с ним.",
    "richPresence.restartSteamFailed":
        "Не удалось перезапустить Steam: {error}",
    "richPresence.steamEnableFailed":
        "Не удалось включить порт отладки Steam: {error}",
    "richPresence.steamDisableFailed":
        "Не удалось выключить порт отладки Steam: {error}",
    "richPresence.steamUacCancelled":
        "Windows запросила права администратора, но они не были предоставлены, поэтому ничего не изменено.",
    "richPresence.steamFailed": "Ошибка расширенного статуса Steam: {error}",
    "richPresence.viaSteam": "Steam",
    "meshConsent.titleJoining":
        "Этот звонок соединяет вас напрямую с другими участниками",
    "meshConsent.titleNewcomer":
        "С одним из участников этого звонка можно связаться только напрямую",
    "meshConsent.noCallServer":
        "На вашем домашнем сервере нет сервера звонков, поэтому аудио, видео и демонстрация экрана идут напрямую с вашего устройства к каждому участнику звонка.",
    "meshConsent.someoneWithoutCallServer":
        "Один из участников звонка находится на домашнем сервере без сервера звонков. Чтобы слышать и видеть его, ваше устройство подключается к его устройству напрямую.",
    "meshConsent.ipVisible":
        "У вашего домашнего сервера нет ретранслятора (TURN), поэтому все, с кем вы соединяетесь напрямую, видят ваш IP-адрес, который может примерно выдать ваше местоположение.",
    "meshConsent.relayed":
        "Соединение идёт через ретранслятор вашего домашнего сервера: другие видят его адрес, а не ваш IP-адрес. Если через ретранслятор до кого-то не достучаться, вы соединяетесь с ним напрямую, и он видит ваш IP-адрес. Чтобы этого не было, включите «Требовать ретранслятор для одноранговых звонков» в настройках голоса и видео.",
    "meshConsent.relayRequired":
        "«Требовать ретранслятор для одноранговых звонков» включено, но у вашего домашнего сервера нет ретранслятора (TURN), поэтому соединиться не получится. Выключите это в настройках голоса и видео, чтобы соединиться напрямую.",
    "meshConsent.titleFileTransfer":
        "Эта передача файла соединяет вас напрямую с другим человеком",
    "meshConsent.fileTransferDirect":
        "У вашего сервера или у сервера собеседника нет сервера звонков, поэтому файл передаётся напрямую с одного устройства на другое.",
    "meshConsent.join": "Присоединиться",
    "meshConsent.connectDirectly": "Подключиться напрямую",
    "meshConsent.joinWithoutThem": "Присоединиться без них",
    "meshConsent.notNow": "Не сейчас",
    "voiceCall.meshNeedsTurn":
        "«Требовать ретранслятор для одноранговых звонков» включено, но у вашего домашнего сервера нет ретранслятора (TURN). Выключите это в настройках голоса и видео, чтобы присоединиться.",
    "voiceAudioSettings.meshRelayOnly":
        "Требовать ретранслятор для одноранговых звонков",
    "voiceAudioSettings.meshRelayOnlyHint":
        "Одноранговые звонки и передача файлов идут через сервер-ретранслятор (TURN) вашего домашнего сервера, если он есть, поэтому никто не видит ваш IP-адрес. Без него, или если через ретранслятор до кого-то не достучаться, соединение прямое, и адрес виден. Если включено, прямых соединений не будет никогда: без работающего ретранслятора соединение не устанавливается.",
    "voiceCall.meshPeerUnreachable":
        "Кто-то в этом звонке доступен только напрямую, но ретранслятор обязателен, а у вашего домашнего сервера его нет (TURN), поэтому вы его не услышите.",
    "meshConsent.usePublicStun": "Использовать публичный STUN-сервер.",
    "meshConsent.usePublicStunHint":
        "На вашем домашнем сервере нет сервера, который помогает соединениям проходить через домашние роутеры, поэтому без него большинство прямых соединений не работает. STUN-сервер Cloudflare узнает ваш IP-адрес, но ничего о звонке.",
    "voiceAudioSettings.meshPublicStun": "Использовать публичный STUN-сервер",
    "voiceAudioSettings.meshPublicStunHint":
        "Только если домашний сервер не предлагает ни ретранслятора, ни STUN-сервера: одноранговые звонки запрашивают у STUN-сервера Cloudflare ваш публичный адрес, который нужен большинству домашних роутеров. Он видит ваш IP-адрес, но не сам звонок.",
    "settingsSearch.meshPublicStun": "Использовать публичный STUN-сервер",
    "voiceCall.meshFailed":
        "Не удалось соединиться напрямую с {name}. Сеть собеседника может это блокировать, или домашний сервер собеседника не предлагает способа пройти через домашние роутеры.",
    "voiceCall.meshFailedNoServers":
        "Не удалось соединиться напрямую с {name}. Ваш домашний сервер не предлагает ни ретранслятора, ни STUN-сервера, поэтому соединения через домашние роутеры обычно не работают. Помочь может включение опции «Использовать публичный STUN-сервер» в настройках раздела «Голос и видео».",
    "settingsSearch.meshRelayOnly":
        "Требовать ретранслятор для одноранговых звонков",
};

const catalogue: LocaleCatalogue = { messages, dateLocale: ru };

export default catalogue;
