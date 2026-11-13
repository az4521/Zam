// Ukrainian (uk). Same keys and placeholders as ../en.ts; a string missing
// here falls back to English (`npm run i18n:missing` lists them).

import { uk } from "date-fns/locale/uk";
import type { MessageKey } from "../en";
import type { LocaleCatalogue } from "../index";

const messages: Partial<Record<MessageKey, string>> = {
    // Shared
    "common.turnOffCamera": "Вимкнути камеру",
    "common.turnOnCamera": "Увімкнути камеру",
    "common.stopSharing": "Припинити показ",
    "common.shareYourScreen": "Показати екран",
    "common.joining": "Приєднання…",
    "common.join": "Приєднатися",
    "common.closeDialog": "Закрити діалог",
    "common.settings": "Налаштування",
    "common.searchResults": "Результати пошуку",
    "common.default": "Типово",
    "common.mute": "Заглушити",
    "common.saving": "Збереження…",
    "common.unblock": "Розблокувати",
    "common.block": "Заблокувати",
    "common.closeMenu": "Закрити меню",
    "common.openRoomList": "Відкрити список кімнат",
    "common.uploading": "Вивантаження…",
    "common.uploadImage": "Вивантажити зображення",
    "common.emoji": "Емодзі",
    "common.decline": "Відхилити",
    "common.invitePeople": "Запросити людей",
    "common.close": "Закрити",
    "common.cancel": "Скасувати",
    "common.loading": "Завантаження…",
    "common.loadMore": "Завантажити ще",
    "common.notifications": "Сповіщення",
    "common.save": "Зберегти",
    "common.topic": "Тема",
    "common.videoRoom": "Відеокімната",
    "common.reasonOptional": "Причина (необов’язково)",
    "common.actions": "Дії",
    "common.copy": "Копіювати",
    "common.remove": "Вилучити",
    "common.add": "Додати",
    "common.starting": "Запуск…",
    "common.verify": "Верифікувати",
    "common.removeFromFavourites": "Вилучити з вибраного",
    "common.addToFavourites": "Додати до вибраного",
    "common.stickers": "Стікери",
    "common.retry": "Повторити",
    "common.delete": "Видалити",
    "common.checking": "Перевірка…",
    "common.gifs": "GIF-анімації",
    "common.dragOrUseArrowKeysTo":
        "Перетягніть або скористайтеся стрілками, щоб змінити розмір",
    "common.resizePicker": "Змінити розмір вибору",
    "common.noResults": "Нічого не знайдено",
    "common.memberCount":
        "{count, plural, one {# учасник} few {# учасники} many {# учасників} other {# учасника}}",
    "common.replyCount":
        "{count, plural, one {# відповідь} few {# відповіді} many {# відповідей} other {# відповіді}}",

    // src/lib/components/settings/AboutSettings.svelte
    "aboutSettings.automaticUpdates": "Автоматичні оновлення",
    "aboutSettings.version": "Версія",
    "aboutSettings.currentVersionV": "Поточна версія v{APP_VERSION}",
    "aboutSettings.checkForUpdates": "Перевірити наявність оновлень",
    "aboutSettings.updateAvailable": "Доступне оновлення",
    "aboutSettings.reloading": "Перезавантаження…",
    "aboutSettings.update": "Оновити",
    "aboutSettings.reloadToUpdate": "Перезавантажити для оновлення",
    "aboutSettings.youReOnTheLatestVersion": "У вас остання версія.",
    "aboutSettings.credits": "Подяки",
    "aboutSettings.creditsMidiInstruments": "MIDI-інструменти",
    "aboutSettings.creditsSoundFont":
        "від {author}, на основі Phoenix від {original}. Ліцензія CC BY; перенесено на General MIDI та стиснуто для Zam.",
    "aboutSettings.creditsSoundFontGaps":
        "Інструменти, яких бракує в MT-32: {microgm} від {microgmAuthor} (WTFPL) та {generalUser} від {generalUserAuthor}.",
    "aboutSettings.troubleshooting": "Усунення несправностей",
    "aboutSettings.clearCacheAndResync": "Очистити кеш і синхронізувати знову",
    "aboutSettings.reDownloadsYourRoomsFromThe":
        "Повторно завантажує ваші кімнати із сервера. Виправляє кімнати, які зникли або зависли. Ви залишаєтеся в обліковому записі.",
    "aboutSettings.resyncing": "Повторна синхронізація…",
    "aboutSettings.clearCache": "Очистити кеш",
    "aboutSettings.updateCheckFailed": "Не вдалося перевірити оновлення",
    "aboutSettings.downloadFailed": "Не вдалося завантажити",
    "aboutSettings.installFailed": "Не вдалося встановити",
    "aboutSettings.failedToCheckForUpdates":
        "Не вдалося перевірити наявність оновлень.",
    "aboutSettings.sourceCodeOnGitHub": "Вихідний код на GitHub",
    "links.website": "Вебсайт",
    "links.github": "GitHub",
    "links.downloadApps": "Завантажити застосунки",

    // src/lib/components/settings/AccountSettings.svelte
    "accountSettings.profile": "Профіль",
    "accountSettings.yourAvatar": "Ваш аватар",
    "accountSettings.changeAvatar": "Змінити аватар",
    "accountSettings.yourDisplayName": "Ваше показуване ім’я",
    "accountSettings.saved": "Збережено",
    "accountSettings.account": "Обліковий запис",
    "accountSettings.userId": "ID користувача",
    "accountSettings.homeserver": "Домашній сервер",
    "accountSettings.connection": "З’єднання",
    "accountSettings.presence": "Присутність",
    "accountSettings.password": "Пароль",
    "accountSettings.currentPassword": "Поточний пароль",
    "accountSettings.newPassword": "Новий пароль",
    "accountSettings.confirmNewPassword": "Підтвердьте новий пароль",
    "accountSettings.signOutAllOtherSessions": "Вийти з усіх інших сеансів",
    "accountSettings.changing": "Зміна…",
    "accountSettings.changePassword": "Змінити пароль",
    "accountSettings.passwordChanged": "Пароль змінено.",
    "accountSettings.thisServerDoesNotAllowChanging":
        "Цей сервер не дозволяє змінювати пароль із цього застосунку.",
    "accountSettings.managedByProvider":
        "Ваш пароль, сеанси та обліковий запис керуються на сторінці облікового запису вашого постачальника входу.",
    "accountSettings.manageAccount": "Керувати обліковим записом",
    "accountSettings.emailPhoneNumbers": "Електронна пошта та номери телефонів",
    "accountSettings.noEmailAddressesOrPhoneNumbers":
        "До цього облікового запису не прив’язано жодної адреси електронної пошти чи номера телефону.",
    "accountSettings.email": "Електронна пошта",
    "accountSettings.phone": "Телефон",
    "accountSettings.thisServerDoesNotAllowManaging":
        "Цей сервер не дозволяє керувати ними з цього застосунку.",
    "accountSettings.logOut": "Вийти",
    "accountSettings.lastDeviceTitle":
        "Це ваш єдиний пристрій із виконаним входом",
    "accountSettings.lastDeviceBackedUp":
        "Вашу зашифровану історію збережено в резервній копії, але після повторного входу знадобиться ключ відновлення, щоб її прочитати.",
    "accountSettings.lastDeviceNoBackup":
        "Після виходу ключі шифрування, що зберігаються на цьому пристрої, буде безповоротно втрачено. Без резервної копії ключів або іншого верифікованого пристрою відновити історію зашифрованих повідомлень буде неможливо.",
    "accountSettings.logOutAnyway": "Усе одно вийти",
    "accountSettings.dangerZone": "Небезпечна зона",
    "accountSettings.deactivateAccount": "Деактивувати обліковий запис…",
    "accountSettings.deactivationIsPermanentAndCannotBe":
        "Деактивація є остаточною, і її неможливо скасувати.",
    "accountSettings.eraseMessagesWherePossible":
        "Стерти повідомлення, де це можливо",
    "accountSettings.deactivating": "Деактивація…",
    "accountSettings.deactivateAccount2": "Деактивувати обліковий запис",
    "accountSettings.avatarUploadFailed": "Не вдалося вивантажити аватар",
    "accountSettings.failedToRemoveAvatar": "Не вдалося вилучити аватар",
    "accountSettings.failedToSaveName": "Не вдалося зберегти ім’я",
    "accountSettings.couldNotSetPresence": "Не вдалося встановити присутність",
    "accountSettings.failedToChangePassword": "Не вдалося змінити пароль",
    "accountSettings.failedToDeactivateAccount":
        "Не вдалося деактивувати обліковий запис",

    // src/lib/components/layout/AccountSwitcher.svelte
    "accountSwitcher.signOut": "Вийти з {userId}",
    "accountSwitcher.confirm": "Підтвердити",
    "accountSwitcher.signOut2": "Вийти",
    "accountSwitcher.addAccount": "Додати обліковий запис",
    "accountSwitcher.accountMenu": "Меню облікового запису",
    "accountSwitcher.closeAccountMenu": "Закрити меню облікового запису",
    "accountSwitcher.back": "Назад",
    "accountSwitcher.setYourStatus": "Встановити свій статус",
    "accountSwitcher.setAStatus": "Встановити статус",
    "accountSwitcher.editProfile": "Редагувати профіль",
    "accountSwitcher.switchAccounts": "Перемкнути обліковий запис",
    "accountSwitcher.couldNotSetPresence": "Не вдалося встановити присутність",

    // src/lib/components/layout/ActiveCallBanner.svelte
    "activeCallBanner.openCall": "Відкрити виклик",
    "activeCallBanner.open": "Відкрити",
    "activeCallBanner.ringing": "Дзвінок…",
    "activeCallBanner.voiceCallInCall": "Голосовий виклик · {length} у виклику",
    "activeCallBanner.leave": "Вийти",

    // src/lib/components/settings/AppearanceSettings.svelte
    "appearanceSettings.rightAlignMyMessagesBubbleLayout":
        "Вирівнювати мої повідомлення праворуч (компонування «бульбашки»)",
    "appearanceSettings.displayYourOwnMessagesOnThe":
        "Показувати ваші повідомлення праворуч у кольоровій бульбашці",
    "appearanceSettings.showNameColours": "Показувати кольори імен",
    "appearanceSettings.drawPeopleSNamesInThe":
        "Малювати імена людей кольором, який вони вибрали у своєму профілі. Вимкніть, щоб для всіх використовувався звичайний колір тексту.",
    "appearanceSettings.keepRoomListOpen": "Тримати список кімнат відкритим",
    "appearanceSettings.donTAutoCloseTheRoom":
        "Не закривати список кімнат автоматично під час перемикання між просторами чи Домівкою. Відкриття кімнати або особистого чату завжди закриває його.",
    "appearanceSettings.timestamps": "Позначки часу",
    "appearanceSettings.timeFormat": "Формат часу",
    "appearanceSettings.dateFormat": "Формат дати",
    "appearanceSettings.customDatePattern": "Власний шаблон дати",
    "appearanceSettings.yyyyMmDd": "yyyy-MM-dd",
    "appearanceSettings.preview": "Попередній перегляд:",
    "appearanceSettings.dateFnsTokensEGYyyy":
        "· токени date-fns, наприклад yyyy-MM-dd",
    "appearanceSettings.invalidFormatUseLowercaseDateFns":
        "Недійсний формат - використовуйте токени date-fns у нижньому регістрі, як-от yyyy-MM-dd.",
    "appearanceSettings.alwaysShowAbsoluteDates":
        "Завжди показувати точні дати",
    "appearanceSettings.replaceTodayAndYesterdayWithThe":
        "Скрізь замінювати «Сьогодні» та «Вчора» повною датою.",
    "appearanceSettings.reduceMotion": "Зменшити анімацію",
    "appearanceSettings.minimizeAnimationsAndTransitionsYourDevice":
        "Мінімізувати анімації та переходи. Системне налаштування «зменшити рух» на вашому пристрої також завжди враховується.",
    "appearanceSettings.customCss": "Власний CSS",
    "appearanceSettings.customCssEnable": "Використовувати власний CSS",
    "appearanceSettings.customCssHint":
        "Ваші власні стилі, що застосовуються наживо поверх теми. Кольори теми - це змінні, встановлені на сторінці, тому перевизначайте їх через !important.",
    "appearanceSettings.customCssRecovery":
        "Якщо якесь правило робить Zam непридатним до використання, відкрийте його, додавши до адреси ?nocustomcss (або вимкніть перемикач), щоб повернутися.",
    "appearanceSettings.custom": "Власний",
    "appearanceSettings.12Hour": "12-годинний",
    "appearanceSettings.24Hour": "24-годинний",
    "appearanceSettings.language": "Мова",
    "appearanceSettings.layout": "Компонування",
    "appearanceSettings.displayLanguage": "Мова інтерфейсу",
    "appearanceSettings.displayLanguageHint":
        "Мова, якою показуються меню та кнопки Zam. Зміна перезавантажує застосунок.",

    // src/routes/app/+page.svelte
    "appPage.redirecting": "Перенаправлення…",

    // src/lib/components/layout/AppSettings.svelte
    "appSettings.backToSettings": "Назад до налаштувань",
    "appSettings.closeSettings": "Закрити налаштування",
    "appSettings.searchSettings": "Пошук налаштувань…",
    "appSettings.searchSettings2": "Пошук налаштувань",
    "appSettings.noSettingsMatch": "Немає відповідних налаштувань",
    "appSettings.noSettingsMatch2":
        "Немає налаштувань за запитом «{searchQuery}».",
    "appSettings.resultCount":
        "{count, plural, one {# результат} few {# результати} many {# результатів} other {# результату}}",

    // src/lib/components/layout/AppShell.svelte
    "appShell.zam": "({notificationCount}) Zam",
    "appShell.redirecting": "Перенаправлення…",
    "appShell.noRoomsYet": "Кімнат ще немає",
    "appShell.resizeRoomList": "Змінити розмір списку кімнат",
    "appShell.createARoomOrStartA":
        "Створіть кімнату або розпочніть особисте повідомлення, щоб почати.",
    "appShell.nothingInHome": "У Домівці порожньо",
    "appShell.allOfYourRoomsLiveIn":
        "Усі ваші кімнати містяться в просторах - відкрийте один із них, щоб їх побачити. Кімнати та особисті повідомлення поза просторами показуються тут.",
    "appShell.openRoomList": "Відкрити список кімнат",
    "appShell.someone": "Хтось",
    "appShell.isCalling": "{name} телефонує",
    "appShell.incomingCall": "Вхідний виклик",
    "appShell.offlineMessageStorageIsUnavailableThis":
        "Автономне сховище повідомлень недоступне в цьому сеансі, тож історію не буде збережено на наступний раз.",
    "appShell.couldnTSendYourReplyIt":
        "Не вдалося надіслати вашу відповідь. Її збережено як чернетку.",
    "appShell.yourNotificationReplyWasSavedAs":
        "Вашу відповідь зі сповіщення збережено як чернетку",

    // src/lib/components/settings/BlockedUsersSettings.svelte
    "blockedUsersSettings.messagesFromBlockedUsersAreHidden":
        "Повідомлення від заблокованих користувачів приховано в усіх кімнатах. Список зберігається у вашому обліковому записі та застосовується до всіх ваших сеансів.",
    "blockedUsersSettings.youHavenTBlockedAnyone": "Ви нікого не заблокували.",
    "blockedUsersSettings.failed": "Не вдалося",

    // src/lib/components/layout/CallParticipantMenu.svelte
    "callParticipantMenu.profile": "Профіль",
    "callParticipantMenu.input": "Вхід",
    "callParticipantMenu.output": "Вихід",
    "callParticipantMenu.opening": "Відкриття…",
    "callParticipantMenu.message": "Повідомлення",
    "callParticipantMenu.mention": "Згадати",
    "callParticipantMenu.userVolume": "Гучність користувача",
    "callParticipantMenu.soundboardVolume": "Гучність саундборду",
    "callParticipantMenu.shareVolume": "Гучність показу",
    "callParticipantMenu.hideVideo": "Сховати відео",
    "callParticipantMenu.kicking": "Виключення…",
    "callParticipantMenu.confirmKick": "Підтвердити виключення {name}?",
    "callParticipantMenu.kickFromRoom": "Виключити {name} з кімнати",
    "callParticipantMenu.banning": "Блокування…",
    "callParticipantMenu.confirmBan": "Підтвердити блокування {name}?",
    "callParticipantMenu.ban": "Заблокувати {name}",
    "callParticipantMenu.couldNotOpenADirectMessage":
        "Не вдалося відкрити особисте повідомлення",
    "callParticipantMenu.couldNotKick": "Не вдалося виключити {name}",
    "callParticipantMenu.couldNotBan": "Не вдалося заблокувати {name}",

    // src/lib/components/layout/CallView.svelte
    "callEncryption.encrypted":
        "Наскрізне шифрування: лише учасники цього виклику можуть його бачити й чути.",
    "callEncryption.encryptedShort": "Зашифровано",
    "callEncryption.partial":
        "Наскрізне шифрування, окрім {names}: їхній застосунок надсилає звук і відео без шифрування. Ви можете їх чути й бачити, але вони не чутимуть і не бачитимуть вас, доки їхній застосунок не підтримуватиме зашифровані виклики.",
    "callEncryption.partialShort": "Частково зашифровано",
    "callEncryption.notEncrypted":
        "Без наскрізного шифрування: сервер викликів може бачити й чути цей виклик. Виклики в зашифрованих кімнатах зашифровані.",
    "callView.ringing": "Дзвінок…",
    "callView.showChat": "Показати чат",
    "callView.noOneIsInThisCall": "У цьому виклику нікого немає",
    "callView.backToGrid": "Назад до сітки",
    "callView.screenShareQuality": "Якість показу екрана",
    "callView.optionsFor": "Параметри для {name}",
    "callView.muted": "Мікрофон вимкнено",
    "callView.deafened": "Звук вимкнено",
    "callView.mutedForYou": "Заглушено для вас",
    "callView.joinedFromMultipleDevices": "Приєднано з кількох пристроїв",
    "callView.devices": "Пристроїв: {value}",
    "callView.enableAudio": "Увімкнути звук",
    "callView.onHold": "Утримується, поки триває інший виклик",
    "callView.resume": "Відновити",
    "callView.speakerOn": "Використовувати гучномовець",
    "callView.speakerOff": "Не використовувати гучномовець",
    "callView.unmute": "Увімкнути мікрофон",
    "callView.undeafen": "Увімкнути звук",
    "callView.deafen": "Вимкнути звук",
    "callView.disconnect": "Відключитися",
    "callView.joinCall": "Приєднатися до виклику",
    "callView.you": "Ви",
    "callView.sScreen": "Екран {name}",
    "callView.exitSpotlightFor": "Вийти з фокусу для {label}",
    "callView.spotlight": "Фокус на {label}",

    // src/lib/components/messages/CreatePollDialog.svelte
    "createPollDialog.createPoll": "Створити опитування",
    "createPollDialog.question": "Питання",
    "createPollDialog.askSomething": "Запитайте щось…",
    "createPollDialog.options": "Варіанти",
    "createPollDialog.option": "Варіант {value}",
    "createPollDialog.removeOption": "Вилучити варіант",
    "createPollDialog.addOption": "+ Додати варіант",
    "createPollDialog.results": "Результати",
    "createPollDialog.showAsPeopleVote": "Показувати під час голосування",
    "createPollDialog.hideUntilClosed": "Приховати до завершення",
    "createPollDialog.allowSelectingMultipleOptions":
        "Дозволити вибір кількох варіантів",
    "createPollDialog.creating": "Створення…",
    "createPollDialog.failedToCreatePoll": "Не вдалося створити опитування",

    // src/lib/components/layout/CryptoUnavailableBanner.svelte
    "cryptoUnavailableBanner.offOutOfStorage":
        "Шифрування на цьому пристрої вимкнено, бо закінчилося місце: зашифровані повідомлення не можна ні прочитати, ні надіслати. Звільніть місце й спробуйте знову.",
    "cryptoUnavailableBanner.offLocked":
        "Шифрування на цьому пристрої вимкнено, бо сповіщення досі використовувало його ключі: зашифровані повідомлення не можна ні прочитати, ні надіслати.",
    "cryptoUnavailableBanner.offOther":
        "Шифрування на цьому пристрої вимкнено: зашифровані повідомлення не можна ні прочитати, ні надіслати, а його ключі шифрування не було опубліковано.",
    "cryptoUnavailableBanner.tryAgain": "Спробувати знову",
    "cryptoUnavailableBanner.freeUpSpaceFirst": "Спершу звільніть місце",
    "cryptoUnavailableBanner.syncPaused":
        "Шифрування не вдалося запустити, тому цей сеанс припинив синхронізацію, щоб зберегти ключі шифрування, які вам надсилають інші. Перезавантажте, щоб спробувати знову.",
    "cryptoUnavailableBanner.dismissEncryptionWarning":
        "Закрити попередження про шифрування",

    // src/lib/components/layout/SoundboardPopover.svelte, settings/SoundPackEditor.svelte
    "soundboard.title": "Саундборд",
    "soundboard.yourVolume": "Гучність ваших звуків",
    "soundboard.empty":
        "Звуків ще немає. Додайте їх у розділі «Налаштування», «Емодзі» або в налаштуваннях кімнати.",
    "soundboard.sendFailed": "Не вдалося надіслати цей звук до виклику.",
    "soundboard.add": "Додати звук",
    "soundboard.limits": "Аудіофайли до {seconds} с і {kb} КБ.",
    "soundboard.pack": "Набір",
    "soundboard.newPack": "Новий набір",
    "soundboard.packName": "Назва набору",
    "soundboard.enterAPackName": "Введіть назву набору.",
    "soundboard.name": "Назва звуку",
    "soundboard.upload": "Вивантажити звук",
    "soundboard.uploadFailed": "Не вдалося вивантажити звук.",
    "soundboard.removeFailed": "Не вдалося вилучити це.",
    "soundboard.previewFailed": "Не вдалося відтворити цей звук.",
    "soundboard.preview": "Прослухати",
    "soundboard.remove": "Вилучити звук",
    "soundboard.noSounds": "У цьому наборі немає звуків",
    "soundboard.deletePack": "Видалити набір",
    "soundboard.confirmDeletePack": "Видалити набір «{name}» і всі його звуки?",
    "soundboard.inheritedFrom": "Із {sourceName}",
    "soundboard.addToMine": "Додати до моїх",
    "soundboard.useEverywhere": "Використовувати в кожному виклику",
    "soundboard.usedEverywhere": "У кожному виклику",
    "soundboard.useEverywhereHint":
        "Пропонувати цей набір у ваших викликах у кожній кімнаті, а не лише в цій.",
    "soundboard.globalFailed": "Не вдалося змінити, де пропонується цей набір.",
    "soundboard.addedToYours":
        "{count, plural, one {Додано # звук до вашого набору.} few {Додано # звуки до вашого набору.} many {Додано # звуків до вашого набору.} other {Додано # звуку до вашого набору.}}",
    "soundboard.alreadyYours": "Уже у вашому наборі.",
    // src/lib/matrix/soundboard.ts
    "soundboard.badName":
        "Використовуйте від 1 до 100 літер, цифр, дефісів або підкреслень (A-Z, 0-9). Пробіли стають підкресленнями.",
    "soundboard.noPermission": "Ви не можете редагувати звуки в цій кімнаті.",
    "soundboard.notAudio": "Це не аудіофайл.",
    "soundboard.tooBig": "Цей файл завеликий.",
    "soundboard.tooLong": "Звуки можуть тривати щонайбільше {seconds} с.",
    "soundboard.unreadable": "Не вдалося прочитати цей аудіофайл.",

    // src/lib/components/settings/CustomPackSettings.svelte
    "customPackSettings.add": "Додати {singular}",
    "customPackSettings.shortcode": "короткий код",
    "customPackSettings.sticker": "Стікер",
    "customPackSettings.remove": "Вилучити {toLowerCase}",
    "customPackSettings.image": "Зображення",
    "customPackSettings.chooseAtLeastOneUsage":
        "Виберіть принаймні одне призначення.",
    "customPackSettings.uploadFailed": "Не вдалося вивантажити",
    "customPackSettings.failedToRemove": "Не вдалося вилучити {singular}",
    "customPackSettings.failedToUpdateUsage": "Не вдалося оновити призначення",
    "customPackSettings.noCustomImages": "Власних зображень немає",
    "customPackSettings.noCustomEmojis": "Власних емодзі немає",
    "customPackSettings.noCustomStickers": "Власних стікерів немає",

    // src/lib/components/debug/DebugEventItem.svelte
    "debugEventItem.stateKey": "state_key",
    "debugEventItem.empty": "(порожньо)",
    "debugEventItem.redacted": "РЕДАГОВАНО",
    "debugEventItem.id": "id: {eventId}",

    // src/lib/components/debug/DebugPanel.svelte
    "debugPanel.debugPanel": "ПАНЕЛЬ НАЛАГОДЖЕННЯ",
    "debugPanel.sync": "Синхронізація:",
    "debugPanel.refresh": "↻ оновити",
    "debugPanel.copied": "скопійовано",
    "debugPanel.copy": "⧉ копіювати",
    "debugPanel.unreadState": "СТАН НЕПРОЧИТАНОГО",
    "debugPanel.unread": "непрочитане:",
    "debugPanel.highlight": "виділення:",
    "debugPanel.userid": "userId:",
    "debugPanel.readuptoid": "readUpToId:",
    "debugPanel.readidxInTimeline": "readIdx у стрічці:",
    "debugPanel.noReceipt": "немає підтвердження",
    "debugPanel.n1NotInWindow": "-1 (поза вікном!)",
    "debugPanel.events": "/ подій: {totalEvents}",
    "debugPanel.lastEventSender": "відправник останньої події:",
    "debugPanel.me": "(я:",
    "debugPanel.notificationEventsAfterReadMarker":
        "події сповіщень після позначки прочитаного:",
    "debugPanel.from": "[{formatTs}] {getType} від {value} - {msgPreview}",
    "debugPanel.pushRules": "ПРАВИЛА PUSH",
    "debugPanel.default": "(типове)",
    "debugPanel.actions": "дії: {stringify}",
    "debugPanel.conditions": "умови: {stringify}",
    "debugPanel.noPushRulesFound": "правил push не знайдено",
    "debugPanel.readReceiptsEventsWithReceipts":
        "ПІДТВЕРДЖЕННЯ ПРОЧИТАННЯ (подій із підтвердженнями: {length})",
    "debugPanel.noReceipts": "немає підтверджень",
    "debugPanel.urlPreviewInspector": "ІНСПЕКТОР ПЕРЕДПЕРЕГЛЯДУ URL",
    "debugPanel.https": "https://...",
    "debugPanel.storeMessagesWhatTheUiRenders":
        "ПОВІДОМЛЕННЯ В СХОВИЩІ ({length}) - що показує інтерфейс",
    "debugPanel.redacted": "РЕДАГОВАНО",
    "debugPanel.rel": "rel={relType}",
    "debugPanel.empty": "порожньо",
    "debugPanel.pendingEvents": "ПОДІЇ В ОЧІКУВАННІ ({length})",
    "debugPanel.rawTimelineEvents": "НЕОБРОБЛЕНА СТРІЧКА (подій: {length})",

    // src/lib/components/settings/GpuDebug.svelte
    "gpuDebug.title": "GPU",
    "gpuDebug.hardwareAcceleration": "Апаратне прискорення",
    "gpuDebug.hardwareAccelerationHint":
        "Вимкніть, якщо відео чорне або вікно малюється неправильно. Застосовується після перезапуску.",
    "gpuDebug.gameAuto": "Вимикати GPU на час гри",
    "gpuDebug.gameAutoHint":
        "Якщо GPU постійно падає, поки йде гра (гра займає його пам'ять), Zam перезапускається без апаратного прискорення і знову з ним після закриття гри. Потрібне визначення ігор у Налаштування > Загальні. Чекає завершення дзвінка.",
    "gpuDebug.gameAutoActive": "Робота без GPU до закриття гри.",
    "gpuDebug.nvidiaVideo": "Декодування відео NVIDIA",
    "gpuDebug.nvidiaVideoHint":
        "Декодує відео на GPU NVIDIA через рендерер Vulkan у Chromium. Режим «Автоматично» вмикає його, коли ваші екрани керуються GPU NVIDIA. У Wayland Vulkan не використовується, і «Автоматично» залишає його вимкненим; вибір Vulkan там спробує натомість апаратне декодування через OpenGL (експериментально).",
    "gpuDebug.nvidiaVideoActive": "Зараз використовується.",
    "gpuDebug.nvidiaVideoInactive": "Зараз не використовується.",
    "gpuDebug.nvidiaVideoFailed":
        "Zam повернувся до шляху GL після збою процесу GPU. Виберіть Vulkan, щоб спробувати знову.",
    "gpuDebug.nvidiaVideoAuto": "Автоматично",
    "gpuDebug.nvidiaVideoVulkan": "Vulkan",
    "gpuDebug.nvidiaVideoOff": "Вимкнено",
    "gpuDebug.restartToApply": "Перезапустіть Zam, щоб застосувати цю зміну.",
    "gpuDebug.restart": "Перезапустити",
    "gpuDebug.videoDecoding": "Декодування відео",
    "gpuDebug.decodeHardware": "Апаратне",
    "gpuDebug.decodeSoftware": "Програмне",
    "gpuDebug.decodeUnsupported": "Не підтримується",
    "gpuDebug.videoEncode": "Апаратне кодування відео",
    "gpuDebug.videoEncodeHint":
        "Кодує відео з вашої камери та показ екрана на GPU (VA-API) для кодеків, які підтримує ваш драйвер. Вимкніть, якщо інші бачать від вас чорний, завмерлий або спотворений потік. Застосовується після перезапуску.",
    "gpuDebug.videoEncoding": "Кодування відео",
    "gpuDebug.videoEncodingHint":
        "Виклики надсилають кодек, вибраний у розділі «Голос і відео» (типово H.264). Панель статистики виклику показує, який кодувальник використовує виклик.",
    "gpuDebug.memoryReport": "Звіт про пам’ять",
    "gpuDebug.memoryReportHint":
        "Розбиває пам’ять, яку використовують процеси Zam, зокрема відеопам’ять у процесі GPU, за тим, що її займає. Вимірюйте, коли на екрані видно проблему, а потім скопіюйте звіт у повідомлення про помилку.",
    "gpuDebug.repaint": "Перемалювати",
    "gpuDebug.repaintHint":
        "Перезапускає процес GPU, щоб вікно було намальовано заново. Скористайтеся, якщо частини вікна показуються чорними чи білими блоками або не на своєму місці, що може статися після вичерпання відеопам’яті. Виклики тривають. Також є в меню в треї.",
    "gpuDebug.memoryMeasure": "Виміряти",
    "gpuDebug.memoryMeasuring": "Вимірювання…",
    "gpuDebug.memoryRecord": "Записувати пам’ять у часі",
    "gpuDebug.memoryRecordHint":
        "Знімає звіт про пам’ять через певний інтервал і продовжує, поки налаштування закриті, тож ви можете звичайно користуватися Zam і повернутися. Показує перший, найменший, найбільший і останній розмір кожного, а кожен зразок зберігає як CSV для побудови графіка.",
    "gpuDebug.memoryRecordInterval": "Інтервал",
    "gpuDebug.memoryRecordEvery": "Кожні {seconds} с",
    "gpuDebug.memoryRecordStart": "Записувати",
    "gpuDebug.memoryRecordStop": "Зупинити",
    "gpuDebug.memoryRecordStatus": "Зразків: {count} за {elapsed}",
    "gpuDebug.memoryRecordCsv": "Зберегти CSV",
    "gpuDebug.encodeTest": "Запустити тест кодування H.264",
    "gpuDebug.encodeTestHint":
        "Кодує 60 кадрів кожного розміру так, як це робить виклик. Апаратне кодування має бути значно швидшим на кадр, ніж програмне.",
    "gpuDebug.encodeTestRejected": "Відхилено кодувальником",
    "gpuDebug.encodeTestResult": "Фрагментів: {chunks}, {ms} мс на кадр",
    "gpuDebug.skiaGraphite": "Рендерер Skia Graphite (експериментально)",
    "gpuDebug.skiaGraphiteHint":
        "Малює інтерфейс новішим рендерером Graphite з Chromium замість Ganesh. Увімкніть, щоб протестувати відтворення, або вимкніть, якщо вікно мерехтить чи малюється неправильно. Потребує апаратного прискорення. Застосовується після перезапуску.",
    "gpuDebug.skiaGraphiteFailed":
        "Автоматично вимкнено, бо не вдалося запуститися або стався збій процесу GPU. Увімкніть знову, щоб повторити спробу.",
    "gpuDebug.nvidiaEncode": "Кодування відео NVIDIA (експериментально)",
    "gpuDebug.nvidiaEncodeHint":
        "Кодує виклики H.264 і показ екрана за допомогою NVENC через власний драйвер VA-API від Zam. Декодування відео залишається таким, як налаштовано вище. Застосовується після перезапуску.",
    "gpuDebug.featureStatus": "Стан функцій",
    "gpuDebug.details": "Подробиці",
    "settingsNav.keybinds": "Гарячі клавіші",
    "settingsSearch.keyboardShortcuts": "Комбінації клавіш",
    "keybinds.intro":
        "Клацніть комбінацію, щоб змінити її, а потім натисніть нові клавіші. Комбінації працюють, коли Zam у фокусі. «Натисни й говори» та «Натисни, щоб вимкнути мікрофон» також можуть використовувати бічну кнопку миші або одну клавішу-модифікатор.",
    "keybinds.resetAll": "Скинути все",
    "keybinds.removedFrom": "Ці клавіші було знято з: {actions}",
    "keybinds.changeFor": "Змінити комбінацію для «{action}»",
    "keybinds.pressKey": "Натисніть клавіші… (Esc скасовує)",
    "keybinds.pressKeyOrButton":
        "Натисніть клавішу або кнопку миші… (Esc скасовує)",
    "keybinds.notSet": "Не задано",
    "keybinds.clear": "Вилучити комбінацію",
    "keybinds.clearFor": "Вилучити комбінацію для «{action}»",
    "keybinds.reset": "Скинути до типової",
    "keybinds.resetFor": "Скинути «{action}» до типової",
    "keybinds.pushToTalkHint":
        "Призначення клавіші вмикає режим «натисни й говори»: у викликах ваш мікрофон передає звук, лише поки клавішу утримують.",
    "keybinds.pushToMuteHint": "Ваш мікрофон вимкнено, поки це утримується.",
    "keybinds.globalVoice": "Працювати, коли Zam не у фокусі",
    "keybinds.globalVoiceHint":
        "«Натисни й говори», «Натисни, щоб вимкнути мікрофон», перемикання мікрофона та перемикання звуку також працюють, коли ви в іншому застосунку. Zam слухає лише призначені їм клавіші й не заважає іншим застосункам їх отримувати.",
    "keybinds.globalWayland":
        "Тут недоступно: цей робочий стіл Wayland не надає застосункам глобальних комбінацій (портал GlobalShortcuts), тому голосові комбінації працюють, лише коли Zam у фокусі.",
    "keybinds.globalPermission":
        "Спершу macOS має це дозволити: увімкніть Zam у Системні налаштування > Приватність і безпека > Універсальний доступ, а потім поверніться до Zam.",
    "keybinds.globalOpenSettings": "Відкрити системні налаштування",
    "keybinds.globalError":
        "Zam не зміг почати слухати клавіші в інших застосунках ({error}). Голосові комбінації працюють, коли Zam у фокусі.",
    "keybinds.globalPortalHint":
        "«Натисни й говори», «Натисни, щоб вимкнути мікрофон», перемикання мікрофона та перемикання звуку також працюють, коли ви в іншому застосунку. У Wayland ці комбінації виконує ваш робочий стіл замість Zam: він може попросити підтвердити їх або вибрати інші клавіші, а інші застосунки перестануть отримувати ці клавіші.",
    "keybinds.globalPortalAssigned":
        "Клавіші, призначені вашим робочим столом:",
    "keybinds.globalPortalMouse":
        "Кнопки миші не можуть бути комбінаціями робочого столу: виберіть для них клавішу в налаштуваннях вашого робочого столу.",
    "keybinds.globalPortalConfigure": "Змінити в системних налаштуваннях",
    "keybinds.globalPortalError":
        "Ваш робочий стіл не налаштував комбінації ({error}). Вимкніть і знову ввімкніть це, щоб повторити спробу.",
    "keybinds.helpTitle": "Комбінації клавіш",
    "keybinds.customize": "Налаштувати",
    "keybinds.category.navigation": "Навігація",
    "keybinds.category.chat": "Чат",
    "keybinds.category.voice": "Голос і виклики",
    "keybinds.category.app": "Застосунок",
    "keybinds.action.quickSwitcher": "Швидке перемикання",
    "keybinds.action.prevChannel": "Попередній канал",
    "keybinds.action.nextChannel": "Наступний канал",
    "keybinds.action.prevUnreadChannel": "Попередній непрочитаний канал",
    "keybinds.action.nextUnreadChannel": "Наступний непрочитаний канал",
    "keybinds.action.prevMentionChannel": "Попередній канал зі згадками",
    "keybinds.action.nextMentionChannel": "Наступний канал зі згадками",
    "keybinds.action.prevServer": "Попередній простір",
    "keybinds.action.nextServer": "Наступний простір",
    "keybinds.action.navigateBack": "Назад",
    "keybinds.action.navigateForward": "Уперед",
    "keybinds.action.previousTextChannel": "Повернутися до попереднього каналу",
    "keybinds.action.returnToCall": "Повернутися до виклику",
    "keybinds.action.markChannelRead": "Позначити канал прочитаним",
    "keybinds.action.markServerRead": "Позначити простір прочитаним",
    "keybinds.action.jumpToOldestUnread":
        "Перейти до найстарішого непрочитаного повідомлення",
    "keybinds.action.emojiPicker": "Вибір емодзі",
    "keybinds.action.gifPicker": "Вибір GIF",
    "keybinds.action.stickerPicker": "Вибір стікерів",
    "keybinds.action.uploadFile": "Вивантажити файл",
    "keybinds.action.search": "Пошук",
    "keybinds.action.togglePins": "Закріплені повідомлення",
    "keybinds.action.toggleInbox": "Скринька сповіщень",
    "keybinds.action.toggleMembers": "Список учасників",
    "keybinds.action.toggleMute": "Перемкнути мікрофон",
    "keybinds.action.toggleDeafen": "Перемкнути звук",
    "keybinds.action.pushToTalk": "Натисни й говори",
    "keybinds.action.pushToMute": "Натисни, щоб вимкнути мікрофон",
    "keybinds.action.answerCall": "Відповісти на вхідний виклик",
    "keybinds.action.declineCall": "Відхилити вхідний виклик",
    "keybinds.action.startCall":
        "Розпочати виклик у цій кімнаті або приєднатися до нього",
    "keybinds.action.toggleCamera": "Перемкнути камеру",
    "keybinds.action.toggleScreenShare": "Перемкнути показ екрана",
    "keybinds.action.leaveCall": "Вийти з виклику",
    "keybinds.action.openSettings": "Відкрити налаштування",
    "keybinds.action.createDm": "Нове особисте повідомлення",
    "draftDm.intro": "Це початок вашого особистого листування з {name}.",
    "draftDm.lazyNote":
        "Нічого не створюється, доки ви не надішлете перше повідомлення. Тоді {name} отримає запрошення.",
    "draftDm.placeholder": "Написати {name}",
    "draftDm.send": "Надіслати",
    "draftDm.starting": "Початок розмови...",
    "draftDm.encrypted": "Буде зашифровано наскрізно",
    "draftDm.discard": "Відкинути чернетку",
    "draftDm.couldNotStart": "Не вдалося розпочати розмову",
    "keybinds.action.createOrJoinSpace":
        "Створити простір або приєднатися до нього",
    "keybinds.action.shortcutsHelp": "Показати комбінації клавіш",
    "keybinds.action.toggleDebug": "Перемкнути панель налагодження",
    "quickSwitcher.title": "Куди бажаєте перейти?",
    "quickSwitcher.placeholder": "Пошук кімнат, особистих чатів і просторів",
    "quickSwitcher.recentAndUnread": "Нещодавні та непрочитані",
    "quickSwitcher.noResults": "Збігів немає",
    "quickSwitcher.mentioned": "Згадано",
    "quickSwitcher.space": "Простір",
    "quickSwitcher.home": "Домівка",
    "quickSwitcher.hint": "↑↓ - переміщення, Enter - відкрити, Esc - закрити",

    // src/lib/components/settings/DebugSettings.svelte
    "debugSettings.developer": "Розробник",
    "debugSettings.showAllEvents": "Показувати всі події",
    "debugSettings.orderHints": "Підказки порядку повідомлень",
    "debugSettings.orderHintsHint":
        "Zam додає до ваших повідомлень підказку про те, що було внизу вашого журналу чату, і розміщує повідомлення інших користувачів Zam під тим, яке вони вказують. Коли вимкнено, повідомлення показуються в порядку сервера, як в Element.",
    "debugSettings.stickyCallMembership": "Sticky-участь у дзвінках",
    "debugSettings.stickyCallMembershipHint":
        "Приєднуватися до дзвінків за допомогою sticky-події m.rtc.member (MSC4354) замість події стану m.call.member. Клієнти, які читають лише події стану, зокрема Zam до 1.51, не побачать вас у дзвінку. Діє з наступного дзвінка.",
    "debugSettings.indexSync": "Синхронізація індексу повідомлень",
    "debugSettings.indexSyncHint":
        "Записи пошукового індексу обмінюються з вашими іншими підтвердженими сеансами. На обох сеансах має бути ця версія. Сеанси: придатні / підтверджені / усі. Фрагменти: надіслано / отримано.",
    "debugSettings.indexSyncOff":
        "Синхронізація індексу не працює: потрібно ввімкнути індексацію зашифрованих кімнат.",
    "debugSettings.indexSyncNow": "Синхронізувати зараз",
    "debugSettings.indexSyncNever": "ніколи",
    "debugSettings.indexSyncSessions": "Сеанси",
    "debugSettings.indexSyncAsked": "Запитано",
    "debugSettings.indexSyncRoomsMissing": "Кімнати з прогалинами",
    "debugSettings.indexSyncRequestsReceived": "Отримано запитів",
    "debugSettings.indexSyncChunks": "Фрагменти",
    "debugSettings.indexSyncMerged": "Об'єднано записів",
    "debugSettings.displayEveryMatrixTimelineEventIn":
        "Показувати в журналі чату кожну подію стрічки Matrix.",
    "debugSettings.ignoreCodecSupport":
        "Ігнорувати повідомлену підтримку кодеків",
    "debugSettings.ignoreCodecSupportHint":
        "Надсилати вибраний кодек, навіть якщо інші кажуть, що не можуть його декодувати, і приймати кожен кодек, який перелічує цей пристрій (зокрема заблоковані як несправні). Для тестування, наприклад HEVC на Linux.",
    "debugSettings.h264ProfileFix": "Виправлення профілю H.264 на GPU",
    "debugSettings.h264ProfileFixHint":
        "Виклики використовують кодувальник H.264 на GPU, навіть коли сервер відповідає Constrained Baseline, який Chromium кодує програмно. Вимкніть, щоб побачити, який кодувальник отримує виклик без цього. У настільній версії для Windows прапорець Chromium змінюється після перезапуску.",
    "debugSettings.voiceProcessing": "Обробка голосу",
    "debugSettings.pauseGate": "Шумова брама для пауз",
    "debugSettings.pauseGateHint":
        "Знижує паузи ще на 20 дБ після видалення шуму. Типово вимкнено; може обрізати тихий початок слів.",
    "debugSettings.noiseAttenuationLimit": "Межа видалення шуму: {value} дБ",
    "debugSettings.noiseAttenuationLimitHint":
        "Найбільше, що фільтр шуму (DeepFilterNet3 або DPDFNet) може зняти з будь-якої частини сигналу (типово {value}). 100 - без обмежень.",
    "debugSettings.soundboardInterval": "Інтервал саундборду: {value} мс",
    "debugSettings.soundboardIntervalHint":
        "Найкоротша пауза між звуками саундборду однієї людини. Звуки інших, що надходять швидше, ігноруються (типово 1500).",
    "debugSettings.syncStatus": "Стан синхронізації",
    "debugSettings.clientLogs": "Журнали клієнта",
    "debugSettings.clientLogsHint":
        "Усе, що застосунок записав з моменту запуску, без токенів, паролів і ключів. Надішліть це, коли повідомляєте про помилку.",
    "debugSettings.copyLogs": "Копіювати журнали",
    "debugSettings.saveLogs": "Зберегти журнали",
    "debugSettings.clientLogsCopyFailed": "Не вдалося скопіювати журнали",
    "debugSettings.clientLogsSaveFailed": "Не вдалося зберегти журнали",
    "debugSettings.webViewDebugging": "Налагодження WebView",
    "debugSettings.webViewDebuggingHint":
        "Дозволяє комп’ютеру, підключеному через USB, інспектувати застосунок на chrome://inspect. Залишається ввімкненим після перезапусків, доки ви його не вимкнете.",
    "debugSettings.syncLog": "Журнал синхронізації",
    "debugSettings.syncLogEmpty":
        "Поки що нічого не записано. Тут з’являтимуться перезапуски, невдалі запити та скидання стрічки.",
    "debugSettings.refresh": "Оновити",
    "debugSettings.copied": "Скопійовано",
    "debugSettings.useSlidingSync": "Використовувати sliding sync",
    "debugSettings.experimentalLoadsRoomsInAGrowing":
        "Експериментально. Завантажує кімнати у вікні, що росте. Для застосування перезавантажує застосунок.",
    "debugSettings.pushStatus": "Стан Push",
    "debugSettings.lastError": "Остання помилка: {lastError}",
    "debugSettings.runDiagnostics": "Запустити діагностику",
    "debugSettings.homeserverPushers": "Pusher-и домашнього сервера",
    "debugSettings.theHomeserverHasNoPushersRegistered":
        "Домашній сервер не має зареєстрованих pusher-ів для цього облікового запису.",
    "debugSettings.aPusherMatchesTheConfiguredGateway":
        "Один із pusher-ів відповідає налаштованому URL шлюзу.",
    "debugSettings.noPusherMatchesTheConfiguredGateway":
        "Жоден pusher не відповідає налаштованому URL шлюзу.",
    "debugSettings.appId": "app_id: {app_id}",
    "debugSettings.none": "(немає)",
    "debugSettings.url": "url: {value}",
    "debugSettings.pushkey": "pushkey: {pushkeyPreview}",
    "debugSettings.webPushPwa": "Web Push (PWA)",
    "debugSettings.missing": "(відсутнє)",
    "debugSettings.vapidKey": "Ключ VAPID: {value}",
    "debugSettings.permission": "дозвіл: {permission}",
    "debugSettings.subscription": "підписка: {value}",
    "debugSettings.notFound": "не знайдено",
    "debugSettings.homeserverPusher": "pusher домашнього сервера: {value}",
    "debugSettings.error": "помилка: {error}",
    "debugSettings.gatewaySygnalFirebase": "Шлюз (Sygnal / Firebase)",
    "debugSettings.gatewayReachable": "Шлюз доступний",
    "debugSettings.gatewayNotReachable": "Шлюз недоступний",
    "debugSettings.nativeSessionPushEnrichment":
        "Нативний сеанс (збагачення push)",
    "debugSettings.homeserver": "домашній сервер: {value}",
    "debugSettings.user": "користувач: {value}",
    "debugSettings.device": "пристрій: {value}",
    "debugSettings.accessToken": "токен доступу: {value}",
    "debugSettings.hideMessageText": "приховувати текст повідомлень: {value}",
    "debugSettings.notificationRulesServer": "Правила сповіщень (сервер)",
    "debugSettings.syncMode": "Режим синхронізації",
    "debugSettings.slidingSyncMsc4186": "Sliding sync (MSC4186)",
    "debugSettings.classicSyncV2": "Класичний /sync (v2)",
    "debugSettings.syncState": "Стан синхронізації",
    "debugSettings.fallback": "Резервний режим",
    "debugSettings.slidingSyncEndpoint": "Кінцева точка sliding sync",
    "debugSettings.joinedRoomsLoaded":
        "Завантажено кімнат, до яких ви приєдналися",
    "debugSettings.roomListWindow": "Вікно списку кімнат",
    "debugSettings.of": "{requested} з {total}",
    "debugSettings.platform": "Платформа",
    "debugSettings.nativeCapacitor": "Нативна (Capacitor)",
    "debugSettings.pushEnabledInBuild": "Push увімкнено в збірці",
    "debugSettings.yes": "Так",
    "debugSettings.no": "Ні",
    "debugSettings.hideUpdatePrompts": "Приховувати сповіщення про оновлення",
    "debugSettings.hideUpdatePromptsHint":
        "Вимикає банер і сповіщення про оновлення. Оновлення все одно перевіряються і, коли автоматичні оновлення ввімкнено, усе одно встановлюються самі.",
    "debugSettings.gatewayUrl": "URL шлюзу",
    "debugSettings.appId2": "ID застосунку",
    "debugSettings.notificationPermission": "Дозвіл на сповіщення",
    "debugSettings.fcmToken": "Токен FCM",
    "debugSettings.pushProvider": "Постачальник push",
    "debugSettings.unifiedPushDistributor": "Дистриб’ютор UnifiedPush",
    "debugSettings.unifiedPushEndpoint": "Кінцева точка UnifiedPush",
    "debugSettings.unifiedPushGateway": "Шлюз UnifiedPush",
    "debugSettings.pusherRegisteredThisSession":
        "Pusher зареєстровано в цьому сеансі",
    "debugSettings.failedToFetchPushersFromHomeserver":
        "Не вдалося отримати pusher-и з домашнього сервера.",
    "debugSettings.set": "задано",
    "debugSettings.active": "активне",
    "debugSettings.allNotificationsMasterRule":
        "Усі сповіщення (головне правило)",

    // src/lib/components/ui/EmojiPicker.svelte
    "emojiPicker.searchEmoji": "Пошук емодзі…",
    "emojiPicker.searchEmoji2": "Пошук емодзі",
    "emojiPicker.myEmojis": "Мої емодзі",
    "emojiPicker.custom": "Власні",
    "emojiPicker.standard": "Стандартні",
    "emojiPicker.myEmojis2": "Мої емодзі",

    // src/lib/components/ui/ErrorToasts.svelte
    "errorToasts.dismiss": "Закрити",

    // src/lib/components/settings/ExtendedProfileDebug.svelte
    "extendedProfileDebug.extendedProfile": "Розширений профіль",
    "extendedProfileDebug.fetchFromServer": "Отримати із сервера",
    "extendedProfileDebug.thisServerDoesNotSupportExtended":
        "Цей сервер не підтримує розширених профілів.",
    "extendedProfileDebug.noneOrTheServerRefused": "немає, або сервер відмовив",
    "extendedProfileDebug.presenceGetPresenceStraightFromThe":
        "Присутність (GET /presence, прямо із сервера): {value}",
    "extendedProfileDebug.notAdvertisedNoRestrictions":
        "не оголошено (без обмежень)",
    "extendedProfileDebug.serverRulesForFieldsMProfile":
        "Правила сервера для полів (m.profile_fields): {value}",
    "extendedProfileDebug.failedToFetchTheProfile":
        "Не вдалося отримати профіль",
    "extendedProfileDebug.couldNotCopyToClipboard":
        "Не вдалося скопіювати до буфера обміну",

    // src/lib/components/ui/FlashEmbed.svelte
    "flashEmbed.suspend": "Призупинити",
    "flashEmbed.resize": "Змінити розмір програвача",
    "flashEmbed.resizeHint":
        "Перетягніть або скористайтеся стрілками, щоб змінити розмір. Двічі клацніть, щоб скинути.",

    // src/lib/components/messages/ForwardMessageDialog.svelte
    "forwardMessageDialog.forwardMessage": "Переслати повідомлення",
    "forwardMessageDialog.searchRooms": "Пошук кімнат",
    "forwardMessageDialog.noJoinedRoomsFound":
        "Кімнат, до яких ви приєдналися, не знайдено",
    "forwardMessageDialog.forwarding": "Пересилання…",
    "forwardMessageDialog.forward": "Переслати",
    "forwardMessageDialog.failedToForwardMessage":
        "Не вдалося переслати повідомлення",

    // src/lib/components/settings/GeneralSettings.svelte
    "generalSettings.desktop": "Комп’ютер",
    "proxySettings.network": "Мережа",
    "proxySettings.proxy": "Проксі",
    "proxySettings.modeSystem": "Використовувати системні налаштування",
    "proxySettings.modeDirect": "Без проксі",
    "proxySettings.modeManual": "Вручну",
    "proxySettings.modePac": "Автоматичне налаштування (PAC)",
    "proxySettings.launchFlagsInUse": "Використані прапорці запуску:",
    "proxySettings.server": "Проксі-сервер",
    "proxySettings.serverHint":
        "socks5://, socks4://, http:// або https:// з хостом і портом. Tor зазвичай має адресу socks5://127.0.0.1:9050.",
    "proxySettings.bypass": "Не використовувати проксі для",
    "proxySettings.pacUrl": "URL файлу PAC",
    "proxySettings.calls": "Виклики",
    "proxySettings.callsDefault": "Типово (UDP напряму, TCP через проксі)",
    "proxySettings.callsDirect": "Підключатися до серверів викликів напряму",
    "proxySettings.callsProxy": "Лише через проксі",
    "proxySettings.callsDefaultHint":
        "Через проксі UDP немає, тож звук виклику зазвичай іде напряму й проходить через проксі, лише коли виклик має перейти на TCP.",
    "proxySettings.callsDirectHint":
        "Увесь виклик оминає проксі: приєднання, з’єднання із сервером викликів, а також звук і відео через UDP чи TCP. Усе інше все одно використовує проксі. Сервери викликів бачать вашу IP-адресу.",
    "proxySettings.callsProxyHint":
        "Жодних прямих з’єднань, і сервери викликів ніколи не бачать вашої IP-адреси: виклики йдуть через проксі до TURN-ретранслятора сервера викликів через TCP або TLS. Якщо сервер не пропонує TURN-ретранслятора, виклики не з’єднуватимуться. Очікуйте більшої затримки.",
    "proxySettings.callsDirectUnavailable":
        "Виклики не можуть оминати системні налаштування проксі. Щоб це працювало, задайте проксі тут (Вручну або PAC).",
    "proxySettings.callsDirectAddresses": "Надсилається напряму:",
    "proxySettings.save": "Зберегти",
    "proxySettings.saved": "Збережено",
    "proxySettings.applyFailed": "Не вдалося застосувати: {error}",
    "generalSettings.minimiseToTrayOnClose": "Згортати в трей під час закриття",
    "generalSettings.keepZamRunningInTheSystem":
        "Залишати Zam запущеним у системному треї після закриття вікна замість виходу. Скористайтеся піктограмою в треї, щоб знову відкрити застосунок або вийти.",
    "generalSettings.runAtStartup": "Запускати разом із системою",
    "generalSettings.startZamWhenYouLogIn":
        "Запускати Zam, коли ви входите на комп’ютер.",
    "generalSettings.runAtStartupFailed": "Ваша система цього не дозволила.",
    "generalSettings.noGeneralSettingsAreAvailableOn":
        "На цій платформі немає загальних налаштувань.",

    // src/lib/components/settings/RichPresenceSettings.svelte
    "richPresence.heading": "Розширена присутність",
    "richPresence.share": "Ділитися тим, що ви робите",
    "richPresence.shareHint":
        "Дозволити застосункам на цьому комп’ютері показувати у вашому профілі, у що ви граєте чи що слухаєте. Типово дозволено всі застосунки; вимкніть ті, яких не хочете, нижче.",
    "richPresence.arrpc": "Застосунки, що використовують Discord Rich Presence",
    "richPresence.arrpcHint":
        "Також приймати застосунки, які звітують до Discord. Якщо Discord запущено, застосунки зазвичай звітують спершу йому, тож найкраще це працює, коли Discord закрито.",
    "richPresence.scan": "Виявляти ігри",
    "richPresence.scanHint":
        "Шукати запущені на цьому комп’ютері ігри, щоб з’являлися й ті, що нічого не повідомляють. Для цього кожні кілька секунд зчитується список запущених програм.",
    "richPresence.scanNeedsPermission":
        "Пісочниця Flatpak не бачить інших програм. Щоб дозволити Zam шукати ігри, виконайте цю команду, а потім перезапустіть Zam:",
    "richPresence.scanGrantCommand":
        "flatpak override --user --talk-name=org.freedesktop.Flatpak moe.crafty.matrix",
    "richPresence.scanFailed": "Не вдалося шукати ігри: {error}",
    "richPresence.media": "Повідомляти про відтворення медіа",
    "richPresence.mediaHint":
        "Показувати пісню чи відео, які відтворює медіапрогравач на цьому комп’ютері, за системною інформацією «зараз відтворюється». Щойно це ввімкнено, типово дозволено кожен програвач; вимкніть тих, яких не хочете, нижче.",
    "richPresence.mediaFailed":
        "Не вдалося прочитати відтворення медіа: {error}",
    "richPresence.socket": "Також слухає на {path}.",
    "richPresence.arrpcNeedsShare": "Спершу ввімкніть поширення.",
    "richPresence.listening": "Очікування застосунків на порту {port}.",
    "richPresence.listenFailed": "Не вдалося почати слухати: {error}",
    "richPresence.arrpcFailed": "Не вдалося запустити arRPC: {error}",
    "richPresence.hostNeedsPermission":
        "Пісочниця Flatpak не може керувати іншими програмами. Щоб дозволити Zam це робити, виконайте цю команду, а потім перезапустіть Zam:",
    "richPresence.fake": "Прикидатися, що Discord запущено",
    "richPresence.fakeHint":
        "Деякі застосунки відмовляються надсилати Rich Presence, якщо не запущено процес із назвою Discord. Це запускає неактивний процес, лише коли сам Discord не запущено.",
    "richPresence.fakeFailed": "Не вдалося запустити: {error}",
    "richPresence.discordFirst":
        "Discord запустився раніше за Zam, тому застосунки звітують до Discord, а Zam їх не бачить.",
    "richPresence.restartDiscord": "Перезапустити Discord",
    "richPresence.restartDiscordTitle": "Перезапустити Discord?",
    "richPresence.restartDiscordBody":
        "Discord закриється й відкриється знову, що перерве будь-який виклик чи трансляцію, в яких ви перебуваєте. Zam посяде перше місце, щоб застосунки звітували йому, і передасть те, що вони повідомляють, до Discord.",
    "richPresence.restartDiscordFailed":
        "Не вдалося перезапустити Discord: {error}",
    "richPresence.autoRestart": "Перезапускати Discord автоматично",
    "richPresence.autoRestartHint":
        "Коли Zam запускається, а Discord уже працює раніше, закрити й знову відкрити Discord, щоб застосунки звітували до Zam. Це перериває будь-який виклик чи трансляцію, в яких ви перебуваєте. Відбувається один раз при кожному запуску Zam.",
    "richPresence.publishFailed": "Не вдалося оновити ваш профіль.",
    "richPresence.gameList": "Список ігор: {count}, оновлено {when}",
    "richPresence.gameListDownloading": "Завантаження списку ігор із Discord…",
    "richPresence.gameListFailed":
        "Не вдалося завантажити список ігор: {error}",
    "richPresence.addedGames": "Зареєстровані ігри",
    "richPresence.addedGamesHint":
        "Ігри, застосунки та медіапрогравачі, виявлені запущеними, а також програми, які ви додаєте самі. Кожне типово дозволено у вашому профілі; вимкніть те, чого не хочете. Ігри виявляються, лише коли ввімкнено «Виявляти ігри», а медіапрогравачі - лише коли ввімкнено «Повідомляти про відтворення медіа».",
    "richPresence.addGame": "Додати гру",
    "richPresence.pickProgram": "Виберіть запущену програму",
    "richPresence.searchPrograms": "Пошук запущених програм",
    "richPresence.noPrograms": "Запущених програм не знайдено.",
    "richPresence.gameName": "Назва, що показується у вашому профілі",
    "richPresence.refreshPrograms": "Оновити",
    "richPresence.lastPlayed": "Востаннє грали {when}",
    "richPresence.neverPlayed": "Ще не грали",
    "richPresence.apps": "Застосунки",
    "richPresence.noApps":
        "Жоден застосунок ще нічого не повідомив. Ті, що повідомлятимуть, з’являться тут і будуть дозволені, доки ви їх не вимкнете.",
    "richPresence.allowApp": "Дозволити {name}",
    "richPresence.forgetApp": "Забути {name}",
    "richPresence.forget": "Забути",
    "richPresence.viaDiscord": "Гра або Discord Rich Presence",
    "richPresence.viaMatrix": "Застосунок Matrix",
    "richPresence.viaScan": "Сканування процесів",
    "richPresence.viaRpc": "Discord Rich Presence",
    "richPresence.viaMedia": "Медіапрогравач",
    "richPresence.viaPlugin": "Плагін",
    "richPresence.blocked": "Заблоковано",
    "richPresence.allowed": "Дозволено",

    // src/lib/components/ui/RichPresenceCard.svelte
    "richPresenceCard.playing": "Грає в {name}",
    "richPresence.sharingTitle": "Показується у вашому профілі",
    "richPresenceCard.listening": "Слухає {name}",
    "richPresenceCard.elapsed": "минуло {time}",
    "richPresenceCard.remaining": "залишилося {time}",
    "richPresenceCard.openLinkTitle": "Відкрити це посилання?",
    "richPresenceCard.openLinkBody":
        "{name} просить відкрити цю адресу у вашому браузері:",
    "richPresenceCard.openidWarning":
        "Це посилання також містить токен OpenID для вашого облікового запису Matrix. Сайт може використати його, щоб дізнатися ваш ID Matrix і домашній сервер, а також побачить вашу IP-адресу.",
    "richPresenceCard.open": "Відкрити",
    "richPresenceCard.openFailed": "Не вдалося отримати токен OpenID.",

    // src/lib/components/ui/GifPicker.svelte
    "gifPicker.searchFavourites": "Пошук у вибраному…",
    "gifPicker.searchKlipy": "Пошук у KLIPY…",
    "gifPicker.searchFavourites2": "Пошук у вибраному",
    "gifPicker.searchGifs": "Пошук GIF",
    "gifPicker.gifResults": "Результати GIF",
    "gifPicker.noFavouriteGifsYetStarA":
        "Улюблених GIF ще немає. Позначте GIF зірочкою, щоб зберегти його тут.",
    "gifPicker.favourites": "Вибране",
    "gifPicker.gifTagged": "GIF з тегами {join}",
    "gifPicker.favouriteGif": "Улюблений GIF {value}",
    "gifPicker.editTags": "Редагувати теги",
    "gifPicker.catFunny": "кіт, смішне",
    "gifPicker.commaSeparatedEnterToSave": "Через кому · Enter, щоб зберегти",
    "gifPicker.trending": "Популярне",
    "gifPicker.gifResult": "Результат GIF {value}",
    "gifPicker.favourite": "Додати до вибраного",
    "gifPicker.poweredByKlipy": "Працює на KLIPY",

    // src/lib/components/layout/ImagePackEditor.svelte
    "imagePackEditor.addImage": "Додати зображення",
    "imagePackEditor.newPack": "Новий набір",
    "imagePackEditor.packName": "Назва набору",
    "imagePackEditor.shortcode": "короткий код",
    "imagePackEditor.useAsEmoji": "Використовувати як емодзі",
    "imagePackEditor.useAsSticker": "Використовувати як стікер",
    "imagePackEditor.inheritedFrom": "Успадковано від {sourceName}",
    "imagePackEditor.sticker": "Стікер",
    "imagePackEditor.removeImage": "Вилучити зображення",
    "imagePackEditor.noCustomImages": "Власних зображень немає",
    "imagePackEditor.emotes": "{value}: емодзі",
    "imagePackEditor.room": "Кімната",
    "imagePackEditor.chooseAtLeastOneUsage":
        "Виберіть принаймні одне призначення.",
    "imagePackEditor.enterAPackName": "Введіть назву набору.",
    "imagePackEditor.uploadFailed": "Не вдалося вивантажити",
    "imagePackEditor.failedToUpdateUsage": "Не вдалося оновити призначення",
    "imagePackEditor.failedToRemoveImage": "Не вдалося вилучити зображення",
    "imagePackEditor.failedToUpdatePack": "Не вдалося оновити набір",
    "imagePackEditor.addToMine": "Додати до моїх",
    "imagePackEditor.addAllToMyPack":
        "Скопіювати всі зображення цього набору у власний набір",
    "imagePackEditor.addImageToMyPack":
        "Скопіювати це зображення у власний набір",
    "imagePackEditor.addedToYourPack":
        "{count, plural, one {Додано # зображення до вашого набору.} few {Додано # зображення до вашого набору.} many {Додано # зображень до вашого набору.} other {Додано # зображення до вашого набору.}}",
    "imagePackEditor.alreadyInYourPack": "Уже у вашому наборі.",
    "imagePackEditor.editDetails": "Редагувати подробиці",
    "imagePackEditor.deletePack": "Видалити набір",
    "imagePackEditor.confirmDeletePack":
        "Видалити набір «{name}» і всі його зображення?",
    "imagePackEditor.useInAllRooms": "Використовувати в усіх моїх кімнатах",
    "imagePackEditor.useInAllRoomsHint":
        "Його емодзі та стікери з’являються скрізь, де ви спілкуєтеся.",
    "imagePackEditor.attribution": "Авторство: {value}",
    "imagePackEditor.attributionPlaceholder":
        "Авторство / подяка (необов’язково)",
    "imagePackEditor.uploadPackAvatar": "Вивантажити піктограму набору",
    "imagePackEditor.removePackAvatar": "Вилучити піктограму",
    "imagePackEditor.avatarReady":
        "Піктограму вивантажено, збережіть, щоб застосувати.",
    "sharedPackSettings.yourPackDetails": "Подробиці вашого набору",
    "sharedPackSettings.enabledEverywhere": "Набори, ввімкнені в усіх кімнатах",
    "sharedPackSettings.enabledEverywhereHint":
        "Набори з кімнат, у яких ви перебуваєте, можна використовувати в кожній кімнаті, а не лише в тій, якій вони належать.",
    "sharedPackSettings.availableInYourRooms": "Набори у ваших кімнатах",
    "sharedPackSettings.searchPacks": "Пошук наборів",
    "sharedPackSettings.noPacksFound": "Наборів не знайдено",
    "sharedPackSettings.noneEnabled":
        "Немає наборів, ввімкнених в усіх кімнатах",
    "sharedPackSettings.enable": "Використовувати скрізь",
    "sharedPackSettings.disable": "Не використовувати скрізь",
    "sharedPackSettings.remove": "Вилучити",
    "sharedPackSettings.unavailable":
        "Недоступно: ви більше не перебуваєте в {room} або набір було вилучено",
    "sharedPackSettings.packSummary":
        "{room}, {count, plural, one {# зображення} few {# зображення} many {# зображень} other {# зображення}}",
    "sharedPackSettings.failedToSave": "Не вдалося зберегти",

    // src/lib/components/layout/InboxPanel.svelte
    "inboxPanel.inbox": "Скринька",
    "inboxPanel.noPendingInvites": "Немає запрошень в очікуванні",
    "inboxPanel.roomInvitesWillAppearHere":
        "Запрошення до кімнат з’являтимуться тут.",
    "inboxPanel.pendingInvites": "Запрошень в очікуванні: {length}",
    "inboxPanel.invitedBy": "Запросив(-ла) {sender}",
    "inboxPanel.ignore": "Ігнорувати",
    "inboxPanel.accept": "Прийняти",
    "inboxPanel.pendingJoinRequests":
        "Запитів на приєднання в очікуванні: {length}",
    "inboxPanel.youAskedToJoinWaitingFor":
        "Ви попросили приєднатися - очікування, поки хтось вас впустить.",
    "inboxPanel.cancelRequest": "Скасувати запит",
    "inboxPanel.failedToAcceptInvite": "Не вдалося прийняти запрошення",
    "inboxPanel.failedToRejectInvite": "Не вдалося відхилити запрошення",
    "inboxPanel.failedToCancelJoinRequest":
        "Не вдалося скасувати запит на приєднання",

    // src/lib/components/layout/IncomingCallCard.svelte
    "incomingCallCard.incomingCall": "Вхідний виклик",
    "incomingCallCard.declineCallFrom": "Відхилити виклик від {name}",
    "incomingCallCard.accept": "Прийняти",
    "incomingCallCard.acceptCallFrom": "Прийняти виклик від {name}",
    "incomingCallCard.unknown": "Невідомо",

    // src/lib/components/layout/InvitePanel.svelte
    "invitePanel.invitePeopleTo": "Запросити людей до",
    "invitePanel.invited": "Запрошено",
    "invitePanel.failed": "Не вдалося",
    "invitePanel.inviteByEmail": "Запросити електронною поштою",
    "invitePanel.nameExampleCom": "name@example.com",
    "invitePanel.inviting": "Запрошення…",
    "invitePanel.invite": "Запросити",
    "invitePanel.invite2": "Запросити: {length}",
    "invitePanel.enterAValidEmailAddress":
        "Введіть дійсну адресу електронної пошти.",
    "invitePanel.couldNotSendTheEmailInvite":
        "Не вдалося надіслати запрошення електронною поштою",
    "invitePanel.couldNotSendTheInvite": "Не вдалося надіслати запрошення",
    "invitePanel.thisRoom": "цієї кімнати",
    "invitePanel.thisSpace": "цього простору",

    // src/lib/components/layout/JoinConsentDialog.svelte
    "joinConsentDialog.joinThisRoom": "Приєднатися до цієї кімнати?",
    "joinConsentDialog.youClickedALinkTo": "Ви клацнули посилання на",
    "joinConsentDialog.joiningSharesYourMatrixIdWith":
        ". Приєднання відкриває ваш ID Matrix усім у кімнаті й додає її до вашого списку кімнат.",
    "joinConsentDialog.thisOpensRoom": "Це відкриває кімнату",
    "joinConsentDialog.warningThisLinkPointsAtA":
        "Попередження: це посилання вказує на інший сервер, ніж кімната, на яку воно веде. Продовжуйте, лише якщо довіряєте відправникові.",
    "joinConsentDialog.joinRoom": "Приєднатися до кімнати",

    // src/lib/components/ui/Lightbox.svelte
    "lightbox.closeViewer": "Закрити перегляд ({mediaNoun})",
    "lightbox.viewer": "Перегляд: {MediaNoun}{value}",
    "lightbox.download": "Завантажити",
    "lightbox.previous": "Попереднє",
    "lightbox.previous2": "Попереднє ({mediaNoun})",
    "lightbox.next": "Наступне",
    "lightbox.next2": "Наступне ({mediaNoun})",
    "lightbox.couldNotLoadThisVideoUse":
        "Не вдалося завантажити це відео. Скористайтеся кнопкою «Завантажити», щоб зберегти його.",
    "lightbox.video": "Відео",
    "lightbox.image": "Зображення",
    "lightbox.videoNoun": "відео",
    "lightbox.imageNoun": "зображення",
    "lightbox.zoomIn": "Збільшити",
    "lightbox.zoomOut": "Зменшити",
    "lightbox.zoomReset": "Скинути масштаб",

    // src/lib/components/messages/LinkPreview.svelte
    "linkPreview.youtubeVideo": "Відео YouTube",
    "linkPreview.xTwitter": "X / Twitter",
    "linkPreview.loadingItContactsTheSiteHosting":
        "Завантаження звертається до сайту, на якому це розміщено, і розкриває вашу IP-адресу",
    "linkPreview.loadPreviewMedia": "Завантажити медіа для перегляду",
    "linkPreview.playVideo": "Відтворити відео",

    // src/lib/components/layout/LiveLocationBanner.svelte
    "liveLocationBanner.openMap": "Відкрити карту",
    "liveLocationBanner.sharingLiveLocation":
        "Ви ділитеся місцеперебуванням наживо",
    "liveLocationBanner.lastUpdatedAt":
        " · останнє оновлення о {timeOnly} ({updatedAgoLabel})",
    "liveLocationBanner.map": "Карта",
    "liveLocationBanner.isSharingLiveLocation":
        "{getMemberName} ділиться місцеперебуванням наживо",
    "liveLocationBanner.peopleSharingLiveLocation":
        "Людей, що діляться місцеперебуванням наживо: {length}",
    "liveLocationBanner.viewMap": "Переглянути карту",

    // src/lib/components/layout/LiveLocationMapView.svelte
    "liveLocationMapView.back": "Назад",
    "liveLocationMapView.liveLocation": "Місцеперебування наживо",
    "liveLocationMapView.recenter": "Центрувати",
    "liveLocationMapView.waitingForALocationFix":
        "Очікування визначення місцеперебування…",
    "liveLocationMapView.sharingLiveLocation":
        "Ви ділитеся місцеперебуванням наживо",
    "liveLocationMapView.lastUpdatedAt":
        "останнє оновлення о {timeOnly} ({updatedAgoLabel})",
    "liveLocationMapView.osm": "OSM",
    "liveLocationMapView.noActiveLiveSharesInThis":
        "У цій кімнаті немає активних трансляцій місцеперебування.",
    "liveLocationMapView.you": "Ви",

    // src/lib/components/messages/LocationBody.svelte
    "locationBody.openstreetmap": "OpenStreetMap",
    "locationBody.googleMaps": "Google Maps",

    // src/lib/components/layout/LoginView.svelte
    "loginView.signIn": "Вхід",
    "loginView.register": "Реєстрація",
    "loginView.zam": "Zam - {value}",
    "loginView.addAnAccount": "Додати обліковий запис",
    "loginView.welcomeBack": "З поверненням!",
    "loginView.signInWithAnotherMatrixAccount":
        "Увійти з іншим обліковим записом Matrix",
    "loginView.signInToYourMatrixAccount":
        "Увійдіть у свій обліковий запис Matrix",
    "loginView.createAnAccount": "Створити обліковий запис",
    "loginView.registerOnAMatrixHomeserver":
        "Зареєструватися на домашньому сервері Matrix",
    "loginView.homeserver": "Домашній сервер",
    "loginView.username": "Ім’я користувача",
    "loginView.password": "Пароль",
    "loginView.registrationToken": "Токен реєстрації",
    "loginView.ifRequired": "(якщо потрібен)",
    "loginView.leaveBlankIfNotRequired": "Залиште порожнім, якщо не потрібен",
    "loginView.useSlidingSync": "Використовувати sliding sync",
    "loginView.fasterStartupOnServersThatSupport":
        "Швидший запуск на серверах, що це підтримують.",
    "loginView.pleaseWait": "Зачекайте…",
    "loginView.logIn": "Увійти",
    "loginView.createAccount": "Створити обліковий запис",
    "loginView.donTHaveAnAccount": "Немає облікового запису?",
    "loginView.alreadyHaveAnAccount": "Уже маєте обліковий запис?",
    "loginView.signIn2": "Увійти",
    "loginView.backTo": "← Назад до {activeUserId}",
    "loginView.orContinueAs": "Або продовжити як",
    "loginView.yourCredentialsAreSentDirectlyTo":
        "Ваші облікові дані надсилаються безпосередньо вашому домашньому серверу й не зберігаються цим застосунком за межами вашого пристрою.",
    "loginView.loggingIn": "Вхід…",
    "loginView.loginFailedCheckYourCredentials":
        "Не вдалося увійти. Перевірте свої облікові дані.",
    "loginView.creatingAccount": "Створення облікового запису…",
    "loginView.registrationFailed": "Не вдалося зареєструватися.",
    "loginView.or": "або",
    "loginView.continueWithSso": "Продовжити через SSO",
    "loginView.continueWith": "Продовжити через {name}",
    "loginView.redirectingToSso":
        "Перенаправлення до вашого постачальника входу…",
    "loginView.finishSsoInBrowser":
        "Завершіть вхід у браузері, а потім поверніться сюди.",
    "loginView.ssoCouldNotBeVerified":
        "Не вдалося перевірити єдиний вхід. Спробуйте ще раз.",
    "loginView.ssoFailed": "Єдиний вхід не вдався.",
    "loginView.continue": "Продовжити",
    "loginView.signInOnProviderPage":
        "Ви увійдете на власній сторінці вашого домашнього сервера, а потім повернетеся сюди.",
    "loginView.oauthCancelled": "Вхід скасовано.",
    "loginView.oauthDenied": "Постачальник входу відхилив запит: {reason}",
    "loginView.oauthCouldNotBeVerified":
        "Не вдалося перевірити вхід. Спробуйте ще раз.",
    "loginView.oauthFailed": "Не вдалося увійти. Спробуйте ще раз.",
    "loginView.oauthRegistrationRefused":
        "Цей сервер не дозволив Zam зареєструватися для входу.",
    "loginView.oauthRegistrationRefusedFallback":
        "Цей сервер не дозволив Zam зареєструватися для входу. Скористайтеся одним з інших варіантів нижче.",
    "loginView.checkingServer": "Перевірка сервера…",
    "loginView.homeserverHint":
        "Сервер, на якому розміщено ваш обліковий запис: частина після двокрапки в @you:server.",
    "loginView.homeserverHintRegister":
        "Ваш обліковий запис розміщуватиметься на цьому сервері. Не знаєте, який вибрати? matrix.org безкоштовний і відкритий для всіх.",
    "loginView.oauthLoginExplainer":
        "{server} виконує вхід на власній сторінці облікового запису. Zam відкриває її, і ви одразу повертаєтеся сюди вже з виконаним входом.",
    "loginView.oauthRegisterExplainer":
        "{server} створює нові облікові записи на власній сторінці облікового запису. Zam відкриває її; виберіть там ім’я користувача й пароль, і ви одразу повернетеся сюди вже з виконаним входом.",
    "loginView.continueTo": "Продовжити на {host}",
    "loginView.createAccountOn": "Створити обліковий запис на {server}",
    "loginView.advancedOptions": "Додаткові параметри",

    // src/lib/components/layout/EncryptionSetupDialog.svelte
    "encryptionSetup.setupTitle": "Захистіть свої повідомлення",
    "encryptionSetup.setupBody":
        "Ваші приватні чати захищено наскрізним шифруванням. Налаштуйте відновлення, щоб читати їх на будь-якому пристрої, на якому ви входитимете пізніше, навіть якщо втратите цей. Це займе кілька секунд.",
    "encryptionSetup.passwordBody":
        "Введіть пароль свого облікового запису, щоб підтвердити, що це ви.",
    "encryptionSetup.setUp": "Налаштувати відновлення",
    "encryptionSetup.later": "Не зараз",
    "encryptionSetup.saveKeyTitle": "Збережіть свій ключ відновлення",
    "encryptionSetup.saveKeyBody":
        "Цей ключ розблоковує ваші зашифровані повідомлення на новому пристрої. Він показується лише один раз: збережіть його в менеджері паролів або завантажте. Без нього втрата пристрою може означати втрату повідомлень.",
    "encryptionSetup.downloadKey": "Завантажити",
    "encryptionSetup.keyFileHeader": "Ключ відновлення Zam для {userId}",
    "encryptionSetup.doneTitle": "Усе готово",
    "encryptionSetup.doneBody":
        "Шифрування на цьому пристрої налаштовано. Ваші повідомлення та історія з інших пристроїв доступні тут.",
    "encryptionSetup.confirmTitle": "Підтвердьте, що це ви",
    "encryptionSetup.confirmBody":
        "Цей обліковий запис уже використовує шифрування. Підтвердьте цей новий пристрій, щоб він міг читати ваші зашифровані повідомлення та історію.",
    "encryptionSetup.useAnotherDevice": "Використати інший пристрій",
    "encryptionSetup.useRecoveryKey": "Використати ключ відновлення",
    "encryptionSetup.anotherDeviceHint":
        "Інший пристрій - це той, на якому ви вже ввійшли, наприклад застосунок Zam або Element на телефоні. Він покаже запит, який потрібно схвалити.",
    "encryptionSetup.recoveryKeyHint":
        "Ваш ключ відновлення починається з «EsT». Ви зберегли його під час першого налаштування шифрування.",
    "encryptionSetup.cantConfirm":
        "Втратили ключ відновлення та інші пристрої?",
    "encryptionSetup.enterKeyTitle": "Введіть свій ключ відновлення",
    "encryptionSetup.enterKeyBody":
        "Вставте ключ відновлення, який ви зберегли під час налаштування шифрування. Пробіли не мають значення.",
    "encryptionSetup.enterPassphraseBody":
        "Введіть парольну фразу відновлення, яку ви вибрали під час налаштування шифрування.",
    "encryptionSetup.back": "Назад",
    "encryptionSetup.connectBackupTitle": "Відновіть свою історію повідомлень",
    "encryptionSetup.connectBackupBody":
        "Цей пристрій верифіковано, але його ще не підключено до вашої резервної копії зашифрованих повідомлень. Введіть ключ відновлення, щоб відновити історію.",
    "encryptionSetup.checking": "Перевірка вашого шифрування…",
    "encryptionSetup.tryAgain": "Спробувати знову",
    "encryptionSetup.openSecuritySettings": "Відкрити налаштування безпеки",

    // src/lib/matrix/registration.ts
    "registration.cancelled": "Створення облікового запису скасовано.",
    "registration.noSupportedFlow":
        "Цей сервер вимагає крок реєстрації, який Zam не може виконати. Спробуйте створити обліковий запис на власному вебсайті сервера.",
    "registration.stageKeptFailing":
        "Сервер постійно відхиляв крок реєстрації. Спробуйте ще раз.",
    "registration.userInUse": "Це ім’я користувача зайнято. Спробуйте інше.",
    "registration.invalidUsername":
        "Це ім’я користувача не дозволено. Використовуйте малі літери, цифри та . _ = - /",
    "registration.exclusiveUsername":
        "Це ім’я користувача зарезервовано на цьому сервері. Спробуйте інше.",
    "registration.weakPassword":
        "Цей пароль занадто слабкий. Спробуйте довший.",
    "registration.weakPasswordReason": "Цей пароль занадто слабкий: {reason}",
    "registration.emailInUse":
        "Цю адресу електронної пошти вже використовує інший обліковий запис.",
    "registration.emailNotAllowed":
        "Цей сервер не приймає цю адресу електронної пошти.",
    "registration.rateLimited":
        "Забагато спроб. Зачекайте хвилину й спробуйте знову.",
    "registration.stepNotAccepted":
        "Сервер не прийняв цей крок. Спробуйте ще раз.",
    "registration.closed": "Цей сервер не приймає нових облікових записів.",
    "registration.invalidToken":
        "Цей токен реєстрації недійсний. Перевірте його й спробуйте знову.",
    "registration.refused": "Сервер відмовився створити обліковий запис.",
    "registration.refusedReason":
        "Сервер відмовився створити обліковий запис: {reason}",
    "registration.serverUnreachable":
        "Не вдалося зв’язатися із сервером. Перевірте адресу та з’єднання.",
    "registration.usernameLowercase":
        "Імена користувачів мають бути в нижньому регістрі.",
    "registration.usernameCharacters":
        "Використовуйте лише малі літери, цифри та . _ = - /",
    "registration.usernameHint":
        "Виберіть ім’я користувача. За ним вас знаходитимуть.",
    "registration.usernameAvailable": "{userId} вільне",
    "registration.yourAddressWillBe": "Ваша адреса буде {userId}",
    "registration.confirmPassword": "Підтвердьте пароль",
    "registration.passwordsDontMatch": "Паролі не збігаються.",
    "registration.closedOnServer":
        "{server} зараз не приймає нових облікових записів. Виберіть інший сервер, щоб створити обліковий запис.",
    "registration.useOtherServer":
        "Натомість створити обліковий запис на {server}",
    "registration.tokenTitle": "Токен реєстрації",
    "registration.tokenBody":
        "{server} працює лише за запрошеннями. Введіть токен реєстрації, який вам дав адміністратор сервера.",
    "registration.termsTitle": "Прийміть умови сервера",
    "registration.termsBody":
        "{server} просить вас прийняти їх перед створенням облікового запису:",
    "registration.termsAccept": "Я прочитав(-ла) ці умови й приймаю їх",
    "registration.emailTitle": "Підтвердьте свою електронну пошту",
    "registration.emailBody":
        "{server} потребує адреси електронної пошти, щоб створити ваш обліковий запис. Ми надішлемо вам посилання для підтвердження.",
    "registration.emailPlaceholder": "you@example.com",
    "registration.sendEmail": "Надіслати лист",
    "registration.emailSent":
        "Ми надіслали посилання на {email}. Відкрийте його, а потім поверніться й натисніть «Продовжити».",
    "registration.emailNotConfirmed":
        "Електронну пошту ще не підтверджено. Відкрийте посилання з листа, а потім натисніть «Продовжити».",
    "registration.emailConfirmed": "Продовжити",
    "registration.captchaTitle": "Доведіть, що ви не робот",
    "registration.captchaBody":
        "{server} просить вас пройти капчу. Вона відкривається на сторінці сервера; повертайтеся сюди, коли закінчите.",
    "registration.fallbackTitle": "Ще один крок",
    "registration.fallbackBody":
        "{server} просить вас завершити крок на власній сторінці. Повертайтеся сюди, коли закінчите.",
    "registration.openStepPage": "Відкрити сторінку",
    "registration.stepDone": "Готово",

    // src/lib/components/layout/MemberList.svelte
    "memberList.members": "Учасників: {length}",
    "memberList.creators": "Творців: {length}",
    "memberList.admins": "Адміністраторів: {length}",
    "memberList.admin": "Адміністратор",
    "memberList.moderators": "Модераторів: {length}",

    // src/lib/components/messages/MessageActionsSheet.svelte
    "messageActionsSheet.thisMessage": "{label} це повідомлення?",
    "messageActionsSheet.messageActions": "Дії з повідомленням",

    // src/lib/components/layout/MessageArea.svelte
    "messageArea.dropToAttach": "Відпустіть, щоб прикріпити",
    "messageArea.cachedRoomHint":
        "Показано повідомлення, збережені на цьому пристрої. Ви зможете надсилати, щойно кімнату буде завантажено.",
    "messageArea.unreadNotifications": "Непрочитані сповіщення",
    "messageArea.encryptionEnabled": "Шифрування ввімкнено",
    "messageArea.joiningVoiceCall": "Приєднання до голосового виклику…",
    "messageArea.startVoiceCall": "Розпочати голосовий виклик",
    "messageArea.showCall": "Відкрити перегляд виклику",
    "messageArea.searchMessages": "Пошук повідомлень",
    "messageArea.threads": "Гілки",
    "messageArea.toggleThreadsList": "Показати чи сховати список гілок",
    "messageArea.unreadThreadMentions": "Непрочитані згадки в гілках",
    "messageArea.unreadThreads": "Непрочитані гілки",
    "messageArea.pinnedMessages": "Закріплені повідомлення",
    "messageArea.notificationsInbox": "Скринька сповіщень",
    "messageArea.mediaAndFiles": "Медіа та файли",
    "messageArea.toggleMemberList": "Показати чи сховати список учасників",
    "messageArea.more": "Ще",
    "messageArea.moreRoomOptions": "Більше параметрів кімнати",
    "messageArea.messageTimeline": "Стрічка повідомлень",
    "messageArea.welcomeTo": "Ласкаво просимо до #",
    "messageArea.thisIsTheBeginningOfThe": "Це початок історії кімнати #",
    "messageArea.loadingHistory": "Завантаження старіших повідомлень",
    "messageArea.room": ".",
    "messageArea.newMessages": "Нові повідомлення",
    "messageArea.messageFromABlockedUser":
        "Повідомлення від заблокованого користувача",
    "messageArea.showBlockedMessage": "Показати заблоковане повідомлення",
    "messageArea.thisRoomHasBeenUpgraded": "Цю кімнату оновлено",
    "messageArea.goToNewRoom": "Перейти до нової кімнати",
    "messageArea.joinNewRoom": "Приєднатися до нової кімнати",
    "messageArea.jumpToPresent": "Перейти до теперішнього",
    "messageArea.searchingForMessage": "Пошук повідомлення…",
    "messageArea.viewingMessageContext": "Перегляд контексту повідомлення",
    "messageArea.returnToLive": "Повернутися до поточних",
    "messageArea.closePanel": "Закрити панель",
    "messageArea.someone": "Хтось",
    "messageArea.pinnedMessagesCount": "Закріплені повідомлення ({count})",

    // src/lib/components/messages/MessageInput.svelte
    "messageInput.replyingTo": "Відповідь для {replyTargetName}",
    "messageInput.cancelReplyEsc": "Скасувати відповідь (Esc)",
    "messageInput.editAttachment": "Редагувати вкладення",
    "messageInput.editAttachment2": "Редагувати вкладення {name}",
    "messageInput.custom": "власні",
    "messageInput.yourEmotes": "Ваші емодзі",
    "messageInput.yourNextMessageWillStartA":
        "Ваше наступне повідомлення розпочне",
    "messageInput.thread": "гілку",
    "messageInput.cancelThreadCreation": "Скасувати створення гілки",
    "messageInput.favouriteGifs": "Улюблені GIF",
    "messageInput.sendMessage": "Надіслати повідомлення",
    "messageInput.isTyping": "{value} друкує…",
    "messageInput.andAreTyping": "{value} і {value2} друкують…",
    "messageInput.andAreTyping2": "{value}, {value2} і {value3} друкують…",
    "messageInput.severalPeopleAreTyping": "Кілька людей друкують…",
    "messageInput.noPermissionToSend":
        "Ви не маєте дозволу надсилати тут повідомлення",
    "messageInput.selectARoomToStartChatting":
        "Виберіть кімнату, щоб почати спілкування",
    "messageInput.replyInThread": "Відповісти в гілці...",
    "messageInput.replyTo": "Відповісти {replyTargetName}...",
    "messageInput.message": "Повідомлення в #{roomName}",
    "messageInput.isNotAValidUser": "«{token}» не є дійсним користувачем",
    "messageInput.noRoomSelected": "Кімнату не вибрано",
    "messageInput.isNotInThisRoom": "{userId} немає в цій кімнаті",
    "messageInput.youDonTHavePermissionTo":
        "Ви не маєте дозволу змінювати рівні прав у цій кімнаті",
    "messageInput.unhandledCommand": "Невідома команда: /{name}",
    "messageInput.commandFailed": "Не вдалося виконати команду",
    "messageInput.failedToSend": "Не вдалося надіслати",
    "messageInput.unknownCommandEnterAgain":
        "Невідома команда: /{unknown}. Натисніть Enter ще раз, щоб надіслати її як повідомлення.",
    "messageInput.unknownCommandTapAgain":
        "Невідома команда: /{unknown}. Натисніть «Надіслати» ще раз, щоб надіслати її як повідомлення.",
    "messageInput.sedNoMessage":
        "Тут немає вашого повідомлення для редагування",
    "messageInput.sedNoMatch":
        "«{pattern}» немає у вашому останньому повідомленні",
    "messageInput.sedEmpty":
        "Після цього ваше останнє повідомлення стане порожнім",
    "messageInput.sedFailed":
        "Не вдалося відредагувати ваше останнє повідомлення",
    "messageInput.sendingAttachments":
        "{count, plural, one {Надсилання # вкладення…} few {Надсилання # вкладень…} many {Надсилання # вкладень…} other {Надсилання # вкладення…}}",

    // src/lib/components/messages/MessageItem.svelte
    "messageItem.viewProfile": "Переглянути профіль",
    "messageItem.jumpToTheRepliedToMessage":
        "Перейти до повідомлення, на яке відповідають:",
    "messageItem.originalMessageNotLoaded":
        "Початкове повідомлення не завантажено",
    "messageItem.originalMessageDeleted": "Початкове повідомлення видалено",
    "messageItem.originalMessageUnavailable":
        "Початкове повідомлення недоступне",
    "messageItem.replyPreviewSticker": "Стікер",
    "messageItem.requestKeys": "Запитати ключі",
    "messageItem.keysRequested": "Ключі запитано",
    "messageItem.requestKeysHelp":
        "Спробувати знову, перевірити резервну копію ключів і запитати у сеансів відправника ключ до цього повідомлення",
    "messageItem.replyPreviewPoll": "Опитування",
    "messageItem.replyPreviewImage": "Зображення",
    "messageItem.replyPreviewVideo": "Відео",
    "messageItem.replyPreviewAudio": "Аудіо",
    "messageItem.replyPreviewFile": "Файл",
    "messageItem.edited": "(відредаговано)",
    "messageItem.decryptingImage": "Розшифрування зображення...",
    "messageItem.couldnTDecryptImage": "Не вдалося розшифрувати зображення",
    "messageItem.imageUnavailable": "[Зображення недоступне]",
    "messageItem.decryptingVideo": "Розшифрування відео...",
    "messageItem.couldnTDecryptVideo": "Не вдалося розшифрувати відео",
    "messageItem.video": "Відео",
    "messageItem.canTBePlayedHere": "Тут відтворити не вдається",
    "messageItem.playbackFailedClickToRetry":
        "Не вдалося відтворити · Клацніть, щоб повторити",
    "messageItem.clickToPlay": "{videoDuration} · Клацніть, щоб відтворити",
    "messageItem.clickToPlay2": "Клацніть, щоб відтворити",
    "messageItem.audio": "Аудіо",
    "messageItem.kb": "{toFixed} КБ",
    "messageItem.mb": "{toFixed} МБ",
    "mediaProgress.ofTotal": "{loaded} з {total}",
    "messageItem.fileAttachment": "Вкладений файл",
    "messageItem.download": "Завантажити",
    "messageItem.toSave": "щоб зберегти ·",
    "messageItem.toCancel": "щоб скасувати",
    "messageItem.openThread": "Відкрити гілку",
    "messageItem.failedToSend": "Не вдалося надіслати.",
    "messageItem.retrying": "Повторна спроба…",
    "messageItem.showWhoReadThisMessage":
        "Показати, хто прочитав це повідомлення",
    "messageItem.readThis":
        "{count, plural, one {# людина прочитала це} few {# людини прочитали це} many {# людей прочитали це} other {# людини прочитали це}}",
    "messageItem.readBy": "Прочитали",
    "messageItem.messageActions": "Дії з повідомленням",
    "messageItem.editMessage": "Редагувати повідомлення",
    "messageItem.delete": "Видалити?",
    "messageItem.yesDeleteMessage": "Так, видалити повідомлення",
    "messageItem.yes": "Так",
    "messageItem.noKeepMessage": "Ні, залишити повідомлення",
    "messageItem.no": "Ні",
    "messageItem.deleteMessage": "Видалити повідомлення",
    "messageItem.unpinMessage": "Відкріпити повідомлення",
    "messageItem.pinMessage": "Закріпити повідомлення",
    "messageItem.addReaction": "Додати реакцію",
    "messageItem.reply": "Відповісти",
    "messageItem.replyInThread": "Відповісти в гілці",
    "messageItem.forwardMessage": "Переслати повідомлення",
    "messageItem.moreActions": "Більше дій",
    "messageItem.linkCopied": "Посилання скопійовано!",
    "messageItem.copyMessageLink": "Копіювати посилання на повідомлення",
    "messageItem.linkCopied2": "Посилання скопійовано",
    "messageItem.couldnTDeleteTheMessage": "Не вдалося видалити повідомлення",
    "messageItem.couldnTCopyTheMessageLink":
        "Не вдалося скопіювати посилання на повідомлення",
    "messageItem.failedToUnpinMessage": "Не вдалося відкріпити повідомлення",
    "messageItem.failedToPinMessage": "Не вдалося закріпити повідомлення",
    "messageItem.couldNotOpenTheMatrixLink":
        "Не вдалося відкрити посилання Matrix",
    "messageItem.viewSource": "Переглянути джерело",

    // src/lib/components/messages/ViewSourceDialog.svelte
    "viewSource.title": "Джерело повідомлення",
    "viewSource.decrypted": "Розшифрована подія",
    "viewSource.encrypted": "Початкова (зашифрована) подія",
    "viewSource.copied": "Скопійовано",

    // src/lib/components/messages/MessageRedactAction.svelte
    "messageRedactAction.removeMessage": "Вилучити повідомлення",
    "messageRedactAction.removeThisMessage": "Вилучити це повідомлення?",
    "messageRedactAction.removing": "Вилучення…",
    "messageRedactAction.failedToRemoveMessage":
        "Не вдалося вилучити повідомлення",

    // src/lib/components/messages/MessageReportAction.svelte
    "messageReportAction.reportMessage": "Поскаржитися на повідомлення",
    "messageReportAction.reportSent": "Скаргу надіслано",
    "messageReportAction.whyAreYouReportingThisMessage":
        "Чому ви скаржитеся на це повідомлення?",
    "messageReportAction.markAsExtremelyOffensive":
        "Позначити як украй образливе",
    "messageReportAction.reporting": "Надсилання скарги…",
    "messageReportAction.report": "Поскаржитися",

    // src/lib/components/layout/MessageSearchPanel.svelte
    "messageSearchPanel.searchMessages": "Пошук повідомлень",
    "messageSearchPanel.searchTryFromOrHasImage":
        "Пошук - спробуйте from: або has:image",
    "messageSearchPanel.searchForMessagesInThisRoom":
        "Шукайте повідомлення в цій кімнаті.",
    "messageSearchPanel.noMatchesInTheResultsLoaded":
        "Серед завантажених досі результатів збігів немає.",
    "messageSearchPanel.noResultsFor":
        "Немає результатів за запитом «{searched}».",
    "messageSearchPanel.searchFailed": "Не вдалося виконати пошук",
    "messageSearchPanel.resultCount":
        "{count, plural, one {# результат} few {# результати} many {# результатів} other {# результату}}",

    // src/lib/components/settings/MessagesMediaSettings.svelte
    "messagesMediaSettings.messages": "Повідомлення",
    "messagesMediaSettings.showMatrixIds": "Показувати ID Matrix",
    "messagesMediaSettings.showFullMatrixIdsLikeUser":
        "Показувати в усьому застосунку повні ID Matrix на кшталт @user:server замість показуваних імен.",
    "messagesMediaSettings.readReceiptAvatars":
        "Аватари підтверджень прочитання",
    "messagesMediaSettings.showWhoHasReadEachMessage":
        "Показувати, хто прочитав кожне повідомлення, у вигляді маленьких аватарів під ним. Це змінює лише те, що ви бачите на цьому пристрої - щоб інші не бачили, до якого місця ви прочитали, скористайтеся «Приватні підтвердження прочитання» в розділі «Приватність і безпека».",
    "messagesMediaSettings.holdToOpenMessageMenu":
        "Утримувати для відкриття меню повідомлення",
    "messagesMediaSettings.onTouchDevicesOpenAMessage":
        "На сенсорних пристроях відкривати дії з повідомленням утриманням замість дотику. Коли вимкнено, меню відкривається дотиком.",
    "messagesMediaSettings.checkSpelling": "Перевіряти правопис",
    "messagesMediaSettings.underlineMisspelledWordsAnd":
        "Підкреслювати слова з помилками й пропонувати виправлення під час друку. Вимкніть, щоб зупинити перевірку правопису й автовиправлення клавіатури в редакторах повідомлень на цьому пристрої.",
    "messagesMediaSettings.linkPreviews": "Попередній перегляд посилань",
    "messagesMediaSettings.whenOffNoLinkPreviewIs":
        "Коли вимкнено, попередній перегляд посилань не завантажується, а ваш домашній сервер ніколи не отримує сторінку за посиланням від вашого імені. Де завантажувати медіа попереднього перегляду, керується в розділі «Приватність і безпека».",
    "messagesMediaSettings.pauseVideosOffScreen":
        "Призупиняти відео поза екраном",
    "messagesMediaSettings.pauseAPlayingVideoWhenIt":
        "Призупиняти відео, що відтворюється, коли воно прокручується з поля зору, щоб заощадити заряд. Коли ви прокрутите назад, його потрібно запустити самостійно.",
    "messagesMediaSettings.sendVideosThatStreamFaster":
        "Надсилати відео, що завантажуються швидше",
    "messagesMediaSettings.rearrangeMp4VideosYouSend":
        "Переупорядковувати відео MP4, які ви надсилаєте, щоб вони могли починати відтворюватися під час завантаження. Нічого не перекодовується, а зображення не змінюється. Вимкніть, щоб надсилати файли точно такими, якими вони є.",
    "messagesMediaSettings.sendPhotosThatAppearSooner":
        "Надсилати фото, що з’являються швидше",
    "messagesMediaSettings.rewriteJpegPhotosYouSend":
        "Переписувати фото JPEG, які ви надсилаєте, щоб люди одразу бачили все зображення, а воно ставало чіткішим під час завантаження. Нічого не перекодовується, а зображення не змінюється. Вимкніть, щоб надсилати файли точно такими, якими вони є.",
    "messagesMediaSettings.removeLocationAndMetadata":
        "Вилучати місцезнаходження та інші метадані із вивантажень",
    "messagesMediaSettings.stripMetadataDescription":
        "Вилучати EXIF, GPS-координати, відомості про камеру й інші приховані метадані з фото та відео, які ви надсилаєте. Зображення не змінюється, а поворот зберігається, щоб фото й далі виглядали рівно.",
    "messagesMediaSettings.stripMetadataWarning":
        "Попередження: коли це вимкнено, файли, які ви надсилаєте, можуть розкрити вашу особисту інформацію, зокрема місце, де їх було зроблено.",
    "messagesMediaSettings.randomizeFileNames": "Випадкові імена файлів",
    "messagesMediaSettings.randomizeFileNamesDescription":
        "Вивантажувати файли під випадковою назвою з літер і цифр замість справжньої. Розширення файлу зберігається, зокрема такі, як .tar.gz.",
    "messagesMediaSettings.sendGifsAsAnimatedWebp":
        "Надсилати GIF як анімований WebP",
    "messagesMediaSettings.reencodeGifsYouSend":
        "Перекодовувати GIF, які ви надсилаєте, в анімований WebP без втрат, що зазвичай менший і може відтворюватися під час завантаження. Зображення не змінюється. GIF, який не зменшиться, надсилається як є.",
    "messagesMediaSettings.defaultTab": "Типова вкладка",
    "messagesMediaSettings.whichTabTheGifPickerOpens":
        "Яка вкладка відкривається у виборі GIF.",
    "messagesMediaSettings.defaultGifTab": "Типова вкладка GIF",
    "messagesMediaSettings.favourites": "Вибране",
    "midiSoundBank.midi": "MIDI",
    "midiSoundBank.soundBank": "Банк звуків",
    "midiSoundBank.theInstrumentSoundsUsedTo":
        "Звуки інструментів, що використовуються для відтворення вкладень MIDI.",
    "midiSoundBank.system": "Системний",
    "midiSoundBank.included": "Вбудований",
    "midiSoundBank.custom": "Власний",
    "midiSoundBank.noSystemSoundBankFound":
        "На цьому пристрої не знайдено системного банку звуків, тож використовується вбудований.",
    "midiSoundBank.chooseFile": "Вибрати файл",
    "midiSoundBank.chooseAnotherFile": "Вибрати інший файл",
    "midiSoundBank.saving": "Збереження…",
    "midiSoundBank.sf2Sf3OrDlsUpTo":
        "Власний: файл SF2, SF3 або DLS до 256 МБ, що зберігається на цьому пристрої.",
    "midiSoundBank.useAnSf2Sf3OrDls": "Використайте файл SF2, SF3 або DLS.",
    "midiSoundBank.thatFileIsEmpty": "Цей файл порожній.",
    "midiSoundBank.fileIsTooLarge": "Цей файл завеликий (макс. 256 МБ).",
    "midiSoundBank.notASoundBank": "Цей файл не є банком звуків.",
    "midiSoundBank.couldNotSave":
        "Не вдалося зберегти банк звуків на цьому пристрої (можливо, сховище заповнене).",

    // src/lib/components/ui/ModalDialog.fixture.svelte
    "modalDialog.fixture.fixtureDialog": "Тестовий діалог",

    // src/lib/components/settings/NotificationSettings.svelte
    "notificationSettings.thisDevice": "Цей пристрій",
    "notificationSettings.systemPermission": "Системний дозвіл",
    "notificationSettings.pushNotifications": "Push-сповіщення",
    "notificationSettings.permissionIsBlockedInSystemSettings":
        "Дозвіл заблоковано в системних налаштуваннях",
    "notificationSettings.notificationsAreNotSupportedHere":
        "Сповіщення тут не підтримуються",
    "notificationSettings.allowThisAppToSendNotifications":
        "Дозволити цьому застосунку надсилати сповіщення",
    "notificationSettings.requesting": "Запит…",
    "notificationSettings.blocked": "Заблоковано",
    "notificationSettings.unavailable": "Недоступно",
    "notificationSettings.enable": "Увімкнути",
    "notificationSettings.pushService": "Служба push",
    "notificationSettings.pushServiceLabel": "Доставка через",
    "notificationSettings.pushServiceDescription":
        "Як сповіщення надходять на цей пристрій, поки застосунок закрито. UnifiedPush працює без служб Google через застосунок-дистриб’ютор, наприклад ntfy.",
    "notificationSettings.pushServiceAutomatic": "Автоматично",
    "notificationSettings.pushServiceFcm": "Google (Firebase)",
    "notificationSettings.pushServiceFcmUnavailable":
        "Google (Firebase), тут недоступно",
    "notificationSettings.pushServiceUnifiedPush": "UnifiedPush: {label}",
    "notificationSettings.pushServiceNoDistributor":
        "Не встановлено дистриб’ютора UnifiedPush. Встановіть його (наприклад, ntfy), щоб отримувати сповіщення без служб Google.",
    "notificationSettings.pushServiceActiveFcm":
        "Зараз використовується Google (Firebase).",
    "notificationSettings.pushServiceActiveUnifiedPush":
        "Зараз використовується UnifiedPush ({label}).",
    "notificationSettings.pushServiceActiveNone":
        "Жодна служба push не активна, тож сповіщення надходять, лише поки застосунок відкрито.",
    "notificationSettings.pushServiceSwitchFailed":
        "Не вдалося перемкнути службу push",
    "notificationSettings.sound": "Звук",
    "notificationSettings.notificationSound": "Звук сповіщення",
    "notificationSettings.playASoundForLoudNotifications":
        "Відтворювати звук для гучних сповіщень",
    "notificationSettings.desktopAlerts": "Сповіщення на комп’ютері",
    "notificationSettings.popUpAndTaskbarFlash":
        "Спливаюче вікно та мигання на панелі завдань",
    "notificationSettings.whichNotificationsShowASystemPop":
        "Які сповіщення показують системне спливаюче вікно й змушують мигати піктограму на панелі завдань, коли вікно у фоні.",
    "notificationSettings.popUps": "Спливаючі вікна",
    "notificationSettings.popUpNotifications": "Спливаючі сповіщення",
    "notificationSettings.whichNotificationsShowASystemPopUp":
        "Які сповіщення показують системне спливаюче вікно, коли застосунок у фоні.",
    "notificationSettings.multipleDevices": "Кілька пристроїв",
    "notificationSettings.quietOnMyOtherDevices":
        "Тиша на моїх інших пристроях",
    "notificationSettings.whileYouReActivelyUsingOne":
        "Поки ви активно користуєтеся одним пристроєм, інші пропускають звук сповіщення й спливаюче вікно, доки цей пристрій не простоюватиме вказаний час. Застосовується до кожного пристрою у вашому обліковому записі; сповіщення все одно з’являються у вашій скриньці, а лічильники непрочитаного не змінюються.",
    "notificationSettings.custom": "Власне…",
    "notificationSettings.customQuietDurationInMinutes":
        "Власна тривалість тиші, у хвилинах",
    "notificationSettings.minutesMax":
        "хвилин (макс. {MAX_CUSTOM_GRACE_MINUTES})",
    "notificationSettings.couldnTSaveToYourAccount":
        "Не вдалося зберегти у вашому обліковому записі - інші ваші пристрої можуть зберегти старе налаштування. Перевірте з’єднання та спробуйте знову.",
    "notificationSettings.retrySavingTheOtherDeviceQuiet":
        "Повторити збереження налаштування тиші для інших пристроїв",
    "notificationSettings.retrying": "Повторна спроба…",
    "notificationSettings.rules": "Правила",
    "notificationSettings.notificationRules": "Правила сповіщень",
    "notificationSettings.loudNotifyWithSoundSilentNotify":
        "Гучно = сповіщати зі звуком · Тихо = сповіщати без звуку · Вимк. = без сповіщення",
    "notificationSettings.keywordHighlights": "Виділення за ключовими словами",
    "notificationSettings.getNotifiedWhenAMessageContains":
        "Отримуйте сповіщення, коли повідомлення містить слово чи фразу. Регістр не враховується;",
    "notificationSettings.and": "та",
    "notificationSettings.areWildcards": "є символами підстановки.",
    "notificationSettings.addAKeyword": "Додайте ключове слово…",
    "notificationSettings.newKeyword": "Нове ключове слово",
    "notificationSettings.noKeywordRulesYet":
        "Правил для ключових слів ще немає.",
    "notificationSettings.behaviorFor": "Поведінка для {pattern}",
    "notificationSettings.enable2": "Увімкнути {pattern}",
    "notificationSettings.loudOnly": "Лише гучно",
    "notificationSettings.onlyNotificationsThatMakeASound":
        "Лише сповіщення зі звуком",
    "notificationSettings.silentAndLoud": "Тихо та гучно",
    "notificationSettings.everyNotificationLoudOrSilent":
        "Кожне сповіщення, гучне чи тихе",
    "notificationSettings.none": "Жодних",
    "notificationSettings.neverAlertOnThisDevice":
        "Ніколи не сповіщати на цьому пристрої",
    "notificationSettings.couldNotSaveNotificationSetting":
        "Не вдалося зберегти налаштування сповіщень",
    "notificationSettings.highlightSound": "Виділення + звук",
    "notificationSettings.notifyWithAHighlightAndSound":
        "Сповіщати з виділенням і звуком",
    "notificationSettings.highlight": "Виділення",
    "notificationSettings.notifyWithAHighlight": "Сповіщати з виділенням",
    "notificationSettings.notify": "Сповіщати",
    "notificationSettings.notifyWithoutAHighlight": "Сповіщати без виділення",
    "notificationSettings.failedToAddKeyword":
        "Не вдалося додати ключове слово",
    "notificationSettings.failedToUpdateKeyword":
        "Не вдалося оновити ключове слово",
    "notificationSettings.failedToDeleteKeyword":
        "Не вдалося видалити ключове слово",
    "notificationSettings.accountNotificationsOff":
        "Сповіщення для цього облікового запису вимкнено",
    "notificationSettings.accountNotificationsOffDetail":
        "Усі сповіщення для цього облікового запису вимкнено на сервері, імовірно з іншого застосунку, тож жодне сповіщення не надходить на жодному пристрої, що б не казали налаштування нижче.",
    "notificationSettings.accountNotifications":
        "Сповіщення для цього облікового запису",
    "notificationSettings.accountNotificationsDetail":
        "Вмикає або вимикає сповіщення для цього облікового запису на всіх ваших пристроях.",
    "notificationSettings.thisDeviceNotifications":
        "Сповіщення на цьому пристрої",
    "notificationSettings.thisDeviceNotificationsDetail":
        "Вимикає спливні вікна, звуки та push лише на цьому пристрої. Інші пристрої й надалі сповіщатимуть.",
    "notificationSettings.couldNotUpdateNotifications":
        "Не вдалося оновити налаштування сповіщень",
    "notificationSettings.turnOn": "Увімкнути",
    "notificationSettings.couldNotTurnOnNotifications":
        "Не вдалося ввімкнути сповіщення",

    // src/lib/components/layout/NotificationsPanel.svelte
    "notificationsPanel.clearAll": "Очистити все",
    "notificationsPanel.couldNotRefreshServerNotificationsTap":
        "Не вдалося оновити сповіщення із сервера. Торкніться, щоб повторити.",
    "notificationsPanel.noNotifications": "Сповіщень немає.",
    "notificationsPanel.jumpToMessage": "Перейти до повідомлення:",
    "notificationsPanel.in": "у #{roomName}",
    "notificationsPanel.message": "(повідомлення)",

    // src/lib/components/messages/OutboxStrip.svelte
    "outboxStrip.queued": "У черзі",
    "outboxStrip.sending": "Надсилання…",
    "outboxStrip.failed": "Не вдалося",

    // src/lib/components/layout/OwnStatusEditor.svelte
    "ownStatusEditor.pickAStatusEmoji": "Виберіть емодзі статусу",
    "ownStatusEditor.whatSHappening": "Що відбувається?",
    "ownStatusEditor.statusText": "Текст статусу",
    "ownStatusEditor.clearStatus": "Очистити статус",
    "ownStatusEditor.couldNotSaveStatus": "Не вдалося зберегти статус",

    // src/lib/components/layout/PinnedMessagesPanel.svelte
    "pinnedMessagesPanel.pinnedMessages": "Закріплені повідомлення",
    "pinnedMessagesPanel.noPinnedMessages": "Закріплених повідомлень немає.",
    "pinnedMessagesPanel.jump": "Перейти",
    "pinnedMessagesPanel.unpin": "Відкріпити",

    // src/lib/components/plugins/PluginPopoverHost.svelte
    "pluginPopoverHost.plugin": "Плагін",

    // src/lib/components/settings/PluginSettingsForm.svelte
    "pluginSettingsForm.backToPlugins": "Назад до плагінів",
    "pluginSettingsForm.settings": "Налаштування {pluginName}",
    "pluginSettingsForm.thisPluginHasNoSettings":
        "Цей плагін не має налаштувань.",
    "pluginSettingsForm.moveUp": "Перемістити вгору",
    "pluginSettingsForm.moveDown": "Перемістити вниз",
    "pluginSettingsForm.removeRow": "Вилучити рядок",

    // src/lib/components/settings/PluginsSettings.svelte
    "pluginsSettings.back": "← Назад",
    "pluginsSettings.syncYourEnabledPluginsSettingsTo":
        "Синхронізуйте ввімкнені плагіни та їхні налаштування з вашим обліковим записом Matrix (інакше вони окремі для кожного пристрою). Отримання показує, що зміниться, ще до того, як щось запуститься.",
    "pluginsSettings.pushToAccount": "Надіслати в обліковий запис",
    "pluginsSettings.pullFromAccount": "Отримати з облікового запису",
    "pluginsSettings.thisPullWill": "Це отримання:",
    "pluginsSettings.addRepos": "Додасть репозиторії: {join}",
    "pluginsSettings.installFromRepos":
        "Встановить із їхніх репозиторіїв: {join}",
    "pluginsSettings.couldNotInstall":
        "Застосовано, але ці плагіни не вдалося встановити: {join}",
    "pluginsSettings.enable": "Увімкне: {join}",
    "pluginsSettings.disable": "Вимкне: {join}",
    "pluginsSettings.updateSettingsFor": "Оновить налаштування для: {join}",
    "pluginsSettings.setAutoUpdate": "Встановить автооновлення: {value}",
    "pluginsSettings.setPerPluginAutoUpdate":
        "Встановить автооновлення для окремих плагінів: {join}",
    "pluginsSettings.notInstalledOnThisDeviceInstall":
        "Не встановлено на цьому пристрої (встановіть із «Огляду», потім отримайте знову): {join}",
    "pluginsSettings.nothingToChangeAlreadyInSync":
        "Нічого змінювати; уже синхронізовано.",
    "pluginsSettings.apply": "Застосувати",
    "pluginsSettings.installed": "Встановлені",
    "pluginsSettings.noPluginsInstalled": "Плагінів не встановлено.",
    "pluginsSettings.needsUpdate": "Потрібне оновлення",
    "pluginsSettings.updateToV": "Оновити до v{value}",
    "pluginsSettings.updating": "Оновлення...",
    "pluginsSettings.update": "Оновити",
    "pluginsSettings.pluginSettings": "Налаштування плагіна",
    "pluginsSettings.enable2": "Увімкнути {name}",
    "pluginsSettings.working": "Виконується...",
    "pluginsSettings.autoUpdateThisPlugin": "Автоматично оновлювати цей плагін",
    "pluginsSettings.autoDefault": "Авто: типово",
    "pluginsSettings.autoOn": "Авто: увімк.",
    "pluginsSettings.autoOff": "Авто: вимк.",
    "pluginsSettings.confirmRemove": "Підтвердити вилучення {name}",
    "pluginsSettings.removePlugin": "Вилучити плагін",
    "pluginsSettings.remove": "Вилучити {name}",
    "pluginsSettings.browse": "Огляд",
    "pluginsSettings.loading": "Завантаження...",
    "pluginsSettings.noPluginsInThisRepoYet":
        "У цьому репозиторії ще немає плагінів.",
    "pluginsSettings.install": "Встановити",
    "pluginsSettings.repos": "Репозиторії",
    "pluginsSettings.official": "Офіційний",
    "pluginsSettings.localFolder": "Локальна тека",
    "pluginsSettings.loadFromFolder": "Завантажити плагін із теки",
    "pluginsSettings.loadFromFolderHint":
        "Для розробки плагіна: виберіть теку з його manifest.json і збіркою або теку репозиторію з кількома такими теками плагінів. Zam зберігає копію й запускає її як будь-який плагін; скористайтеся «Перезавантажити» після перебудови. Він виконує код з повною довірою, тож завантажуйте лише теки, які ви написали або яким довіряєте.",
    "pluginsSettings.chooseFolder": "Вибрати теку",
    "pluginsSettings.reload": "Перезавантажити",
    "pluginsSettings.reloading": "Перезавантаження…",
    "pluginsSettings.reloadFromFolder": "Перезавантажити з теки",
    "pluginsSettings.removeRepo": "Вилучити репозиторій",
    "pluginsSettings.addARepo": "Додати репозиторій",
    "pluginsSettings.thirdPartyReposRunFullTrust":
        "Репозиторії третіх сторін виконують код з повною довірою та повним доступом до вашого облікового запису й повідомлень. Додавайте лише ті репозиторії, яким довіряєте.",
    "pluginsSettings.ownerRepoOrGithubUrl": "owner/repo або URL GitHub",
    "pluginsSettings.addRepo": "Додати репозиторій",
    "pluginsSettings.syncPlugins": "Синхронізація плагінів",
    "pluginsSettings.disableAllPlugins": "Вимкнути всі плагіни",
    "pluginsSettings.autoUpdatePlugins": "Автооновлення плагінів",
    "pluginsSettings.automaticallyPullNewerVersionsOfRepo":
        "Автоматично отримувати новіші версії плагінів із репозиторіїв.",
    "pluginsSettings.pushedYourPluginSetToYour":
        "Набір ваших плагінів надіслано у ваш обліковий запис.",
    "pluginsSettings.pushFailed": "Не вдалося надіслати.",
    "pluginsSettings.pullFailed": "Не вдалося отримати.",
    "pluginsSettings.appliedTheSyncedPluginSet":
        "Синхронізований набір плагінів застосовано.",
    "pluginsSettings.updateFailed": "Не вдалося оновити.",
    "pluginsSettings.couldnTRemovePlugin":
        "Не вдалося вилучити плагін: {message}",
    "pluginsSettings.couldnTRemovePlugin2": "Не вдалося вилучити плагін.",
    "pluginsSettings.cannotAddThisRepo": "Не можна додати цей репозиторій.",
    "pluginsSettings.noIndexJson": "Немає index.json ({status})",
    "pluginsSettings.installFailed": "Не вдалося встановити.",

    // src/lib/components/messages/PollBody.svelte
    "pollBody.finalResults": "Остаточні результати",
    "pollBody.livePoll": "Опитування триває",
    "pollBody.resultsAreRevealedWhenThePoll":
        "Результати буде показано після завершення опитування",
    "pollBody.chooseUpTo": "· виберіть до {maxSelections}",
    "pollBody.selected": "вибрано",
    "pollBody.submitting": "Надсилання…",
    "pollBody.submitVote": "Проголосувати",
    "pollBody.votesAreHidden": "Голоси приховано",
    "pollBody.savingVote": "· збереження голосу…",
    "pollBody.closeThisPoll": "Завершити це опитування?",
    "pollBody.closing": "Завершення…",
    "pollBody.closePoll": "Завершити опитування",
    "pollBody.pollUnsupportedFormat": "[Опитування - непідтримуваний формат]",
    "pollBody.failedToSubmitVote": "Не вдалося проголосувати",
    "pollBody.failedToClosePoll": "Не вдалося завершити опитування",
    "pollBody.voteCount":
        "{count, plural, one {# голос} few {# голоси} many {# голосів} other {# голосу}}",

    // src/lib/components/ui/Portal.fixture.svelte
    "portal.fixture.hello": "привіт",

    // src/lib/components/settings/PrivacySafetySettings.svelte
    "privacySafetySettings.privacy": "Приватність",
    "privacySafetySettings.privateReadReceipts":
        "Приватні підтвердження прочитання",
    "privacySafetySettings.sendTypingIndicators": "Надсилати індикатори набору",
    "privacySafetySettings.indexEncryptedRooms":
        "Індексувати зашифровані кімнати на цьому пристрої",
    "privacySafetySettings.indexEncryptedRoomsHint":
        "Зберігає на цьому пристрої стиснуту копію повідомлень ваших зашифрованих кімнат, щоб у них працювали пошук і список медіа. Історія повільно підвантажується у фоні. Вимкнення видаляє цю копію.",
    "privacySafetySettings.letOthersInARoomSee":
        "Дозволити іншим людям у кімнаті бачити, коли ви друкуєте. Вимкніть, щоб друкувати, нікого про це не сповіщаючи.",
    "privacySafetySettings.hideYourReadReceiptsFromOther":
        "Приховувати ваші підтвердження прочитання від інших користувачів. Лічильники непрочитаного й далі працюють; інші просто не бачать, до якого місця ви прочитали.",
    "privacySafetySettings.streamerMode": "Режим стрімера",
    "privacySafetySettings.streamerModeHint":
        "Розмиває ID облікового запису, адреси електронної пошти та ключ відновлення і приховує текст повідомлень у сповіщеннях, щоб у трансляції не з'являлося нічого приватного. Діє лише на цьому пристрої.",
    "privacySafetySettings.hideMessageTextInNotifications":
        "Приховувати текст повідомлень у сповіщеннях",
    "privacySafetySettings.notificationsOnThisDeviceSayWho":
        "Сповіщення на цьому пристрої вказують, хто вам написав, але не що саме. Імена відправника й кімнати все одно показуються. Застосовується лише до цього пристрою.",
    "privacySafetySettings.linkPreviewMedia":
        "Медіа попереднього перегляду посилань",
    "privacySafetySettings.previewImagesAndVideosUsuallyCome":
        "Зображення й відео у звичайних попередніх переглядах посилань надходять через ваш домашній сервер. «Усі» також завантажує програвачі YouTube, картки X/Twitter і GIF, які ваш сервер не може переглянути, безпосередньо з тих сайтів, тож вони дізнаються вашу IP-адресу й коли ви прочитали повідомлення. «Лише домашній сервер» стримує їх; «Вимкнено» стримує також те, що віддає ваш сервер. В обох випадках кожен зачеплений попередній перегляд зберігає кнопку для завантаження свого медіа. Перемикач попереднього перегляду посилань міститься в розділі «Повідомлення та медіа».",
    "privacySafetySettings.blockedUsers": "Заблоковані користувачі",
    "privacySafetySettings.all": "Усі",
    "privacySafetySettings.loadPreviewMediaFromWhereverIt":
        "Також завантажувати вбудовування YouTube, X/Twitter і GIF безпосередньо з тих сайтів",
    "privacySafetySettings.homeserverOnly": "Лише домашній сервер",
    "privacySafetySettings.onlyLoadPreviewMediaYourOwn":
        "Завантажувати лише медіа попереднього перегляду, які віддає ваш власний домашній сервер",
    "privacySafetySettings.off": "Вимкнено",
    "privacySafetySettings.neverLoadPreviewMediaAutomatically":
        "Ніколи не завантажувати медіа попереднього перегляду автоматично",

    // src/lib/components/settings/ProfileFieldsEditor.svelte
    "profileFieldsEditor.moreAboutYou": "Більше про вас",
    "profileFieldsEditor.banner": "Банер",
    "profileFieldsEditor.yourBanner": "Ваш банер",
    "profileFieldsEditor.changeBanner": "Змінити банер",
    "profileFieldsEditor.showWhenIAmInA": "Показувати, коли я у виклику",
    "profileFieldsEditor.addsInACallToYour":
        "Додає «У виклику» до вашого профілю, поки ви підключені до голосового виклику, і прибирає, коли ви виходите.",
    "profileFieldsEditor.pronouns": "Займенники",
    "profileFieldsEditor.sheHerTheyThem": "вона/її, вони/їх",
    "profileFieldsEditor.separateWithCommasMostPreferredFirst":
        "Розділяйте комами, найбажаніші спершу.",
    "profileFieldsEditor.status": "Статус",
    "profileFieldsEditor.statusEmoji": "Емодзі статусу",
    "profileFieldsEditor.pickAStatusEmoji": "Виберіть емодзі статусу",
    "profileFieldsEditor.onHolidayUntilThe23rd": "У відпустці до 23-го",
    "profileFieldsEditor.statusText": "Текст статусу",
    "profileFieldsEditor.bio": "Про себе",
    "profileFieldsEditor.tellPeopleAboutYourself": "Розкажіть людям про себе",
    "profileFieldsEditor.timezone": "Часовий пояс",
    "profileFieldsEditor.timezoneRegion": "Регіон часового поясу",
    "profileFieldsEditor.notSet": "Не задано",
    "profileFieldsEditor.timezoneCity": "Місто часового поясу",
    "profileFieldsEditor.chooseACity": "Виберіть місто",
    "profileFieldsEditor.europeLondon": "Europe/London",
    "profileFieldsEditor.useMine": "Використати мій",
    "profileFieldsEditor.usernameColour": "Колір імені користувача",
    "profileFieldsEditor.usernameColourOnDarkThemes":
        "Колір імені користувача на темних темах",
    "profileFieldsEditor.darkThemes": "темні теми",
    "profileFieldsEditor.usernameColourOnLightThemes":
        "Колір імені користувача на світлих темах",
    "profileFieldsEditor.lightThemes": "світлі теми",
    "profileFieldsEditor.resetToDefault": "Скинути до типового",
    "profileFieldsEditor.chooseAColour": "Виберіть колір",
    "profileFieldsEditor.oneColourForDarkThemesAnd":
        "Один колір для темних тем і один для світлих, щоб ваше ім’я було читабельним в обох випадках.",
    "profileFieldsEditor.links": "Посилання",
    "profileFieldsEditor.label": "Підпис",
    "profileFieldsEditor.linkLabel": "Підпис посилання",
    "profileFieldsEditor.httpsExampleOrg": "https://example.org",
    "profileFieldsEditor.linkAddress": "Адреса посилання",
    "profileFieldsEditor.removeLink": "Вилучити посилання",
    "profileFieldsEditor.addLink": "Додати посилання",
    "profileFieldsEditor.saved": "Збережено",
    "profileFieldsEditor.useATimezoneNameLikeEurope":
        "Використайте назву часового поясу, як-от Europe/London.",
    "profileFieldsEditor.chooseACity2": "Виберіть місто.",
    "profileFieldsEditor.bannerUploadFailed": "Не вдалося вивантажити банер",
    "profileFieldsEditor.failedToSaveProfileFields":
        "Не вдалося зберегти поля профілю",

    // src/lib/components/layout/ProfileFooter.svelte
    "profileFooter.dismiss": "Закрити",
    "profileFooter.switchAccounts": "Перемкнути обліковий запис",
    "profileFooter.unknown": "Невідомо",

    // src/lib/components/settings/PushDiagnostics.svelte
    "pushDiagnostics.pushGateway": "Шлюз push",
    "pushDiagnostics.notificationRelay": "Ретранслятор сповіщень",
    "pushDiagnostics.pushNotificationsAreRelayedThroughThis":
        "Push-сповіщення ретранслюються через цей шлюз. Він бачить, які кімнати й відправники вам сповіщають, але ніколи не бачить тексту ваших повідомлень.",
    "pushDiagnostics.warningYourHomeserverIsRoutingThis":
        "Попередження: ваш домашній сервер спрямовує push-сповіщення цього пристрою на інший шлюз ({join}). Саме той шлюз, а не наведений вище, бачить метадані ваших сповіщень.",
    "pushDiagnostics.verifiedYourHomeserverRoutesNotificationsTo":
        "Перевірено: ваш домашній сервер спрямовує сповіщення на цей шлюз.",
    "pushDiagnostics.noPushNotificationsAreRegisteredOn":
        "Для цього облікового запису ще не зареєстровано push-сповіщень.",

    // src/lib/components/ui/QrCodeImage.svelte
    "qrCodeImage.couldNotRenderTheVerificationCode":
        "Не вдалося показати код верифікації.",
    "qrCodeImage.qrCodeForDeviceVerification":
        "QR-код для верифікації пристрою",

    // src/lib/components/layout/QuickActions.svelte
    "quickActions.newDm": "Новий особистий чат",
    "quickActions.createRoomInSpace": "Створити кімнату в просторі",
    "quickActions.createNewRoom": "Створити нову кімнату",
    "quickActions.createNewSpace": "Створити новий простір",
    "quickActions.joinRoomByAddress": "Приєднатися до кімнати за адресою",
    "quickActions.createARoom": "Створити кімнату",
    "quickActions.createASpace": "Створити простір",
    "quickActions.newDirectMessage": "Нове особисте повідомлення",
    "quickActions.joinARoom": "Приєднатися до кімнати",
    "quickActions.spaceName": "Назва простору",
    "quickActions.roomName": "Назва кімнати",
    "quickActions.mySpace": "Мій простір",
    "quickActions.optional": "(необов’язково)",
    "quickActions.additionalCreators": "Додаткові творці (кімната v12)",
    "quickActions.additionalCreatorsHint":
        "Інші користувачі, які разом із вами стануть творцями нової кімнати. У кімнаті v12 владу творця неможливо забрати.",
    "quickActions.starterRooms": "Додати текстову та голосову кімнати",
    "quickActions.starterRoomsHint":
        "Будь-хто, кого ви запросите до простору, зможе до них приєднатися.",
    "quickActions.starterTextName": "загальна",
    "quickActions.starterVoiceName": "Голосова",
    "quickActions.whatSThisSpaceAbout": "Про що цей простір?",
    "quickActions.whatSThisRoomAbout": "Про що ця кімната?",
    "quickActions.opensStraightIntoACallMessages":
        "Відкривається одразу у виклику. Повідомлення також працюють.",
    "quickActions.enableEncryption": "Увімкнути шифрування",
    "quickActions.canTBeTurnedOffLater": "Пізніше вимкнути його не можна.",
    "quickActions.findSomeoneToMessage": "Знайдіть, кому написати…",
    "quickActions.encryptThisDm": "Зашифрувати цей особистий чат",
    "quickActions.openTheDm": "Відкрити особистий чат",
    "quickActions.roomAddressOrId": "Адреса або ID кімнати",
    "quickActions.roomServerCom": "#room:server.com",
    "quickActions.requestSentYouLlBeAble":
        "Запит надіслано - ви зможете приєднатися, щойно хтось вас впустить.",
    "quickActions.youCanTJoinThisRoom":
        "Ви не можете приєднатися до цієї кімнати напряму, але можете попросити дозволу приєднатися.",
    "quickActions.requestToJoin": "Попросити приєднатися",
    "quickActions.create": "Створити",
    "quickActions.somethingWentWrong": "Щось пішло не так",
    "quickActions.enterARoomAddressRoomServer":
        "Введіть адресу кімнати (#room:server.com) або ID кімнати (!id:server.com)",
    "quickActions.couldNotSendTheJoinRequest":
        "Не вдалося надіслати запит на приєднання",

    // src/lib/components/messages/ReactorPopover.svelte
    "reactorPopover.more": "ще +{overflow}",
    "reactorPopover.reactedWith": "Відреагували з {label}",
    "reactorPopover.userList": "Список користувачів",

    // src/lib/components/messages/RenameAttachmentDialog.svelte
    "renameAttachmentDialog.editAttachment": "Редагувати вкладення",
    "renameAttachmentDialog.filename": "Назва файлу",
    "renameThreadDialog.nameThread": "Назвати гілку",
    "renameThreadDialog.renameThread": "Перейменувати гілку",
    "renameThreadDialog.threadName": "Назва гілки",
    "renameThreadDialog.everyoneInTheRoomSeesIt":
        "Усі в кімнаті бачать цю назву в Zam. Інші застосунки Matrix її не показують.",
    "renameThreadDialog.removeName": "Вилучити назву",
    "renameThreadDialog.couldNotSaveTheName": "Не вдалося зберегти назву",

    // src/lib/components/layout/RoomDirectory.svelte
    "roomDirectory.exploreRooms": "Огляд кімнат",
    "roomDirectory.onYourHomeserver": "на вашому домашньому сервері",
    "roomDirectory.publicRooms": "Публічні кімнати {value}",
    "roomDirectory.rooms": "· ~{totalEstimate} кімнат",
    "roomDirectory.searchRooms": "Пошук кімнат…",
    "roomDirectory.serverOptional": "Сервер (необов’язково)",
    "roomDirectory.search": "Пошук",
    "roomDirectory.noRoomsFound": "Кімнат не знайдено.",
    "roomDirectory.space": "Простір",
    "roomDirectory.open": "Відкрита",
    "roomDirectory.knockOnly": "Лише за запитом",
    "roomDirectory.requestToJoin": "Попросити приєднатися",
    "roomDirectory.requested": "Запит надіслано",
    "roomDirectory.somethingWentWrong": "Щось пішло не так",

    // src/lib/components/layout/RoomTopicSheet.svelte
    "roomTopicSheet.description": "Опис",
    "roomTopicSheet.open": "Показати повний опис кімнати",

    // src/lib/components/layout/RoomHeaderOverflowMenu.svelte
    "roomHeaderOverflowMenu.moreRoomOptions": "Більше параметрів кімнати",
    "roomHeaderOverflowMenu.unread": "непрочитано",
    "roomHeaderOverflowMenu.badgeThreads":
        "{count, plural, one {{badge} непрочитана згадка} few {{badge} непрочитані згадки} many {{badge} непрочитаних згадок} other {{badge} непрочитаної згадки}}",
    "roomHeaderOverflowMenu.badgePinned":
        "{count, plural, one {{badge} закріплене повідомлення} few {{badge} закріплені повідомлення} many {{badge} закріплених повідомлень} other {{badge} закріпленого повідомлення}}",
    "roomHeaderOverflowMenu.badgeNotifications":
        "{count, plural, one {{badge} непрочитане сповіщення} few {{badge} непрочитані сповіщення} many {{badge} непрочитаних сповіщень} other {{badge} непрочитаного сповіщення}}",
    "roomHeaderOverflowMenu.badgeMedia":
        "{count, plural, one {{badge} елемент} few {{badge} елементи} many {{badge} елементів} other {{badge} елемента}}",
    "roomHeaderOverflowMenu.badgeMembers":
        "{count, plural, one {{badge} учасник} few {{badge} учасники} many {{badge} учасників} other {{badge} учасника}}",

    // src/lib/components/layout/RoomList.svelte
    "roomList.doneReordering": "Завершити впорядкування",
    "roomList.reorderRooms": "Впорядкувати кімнати",
    "roomList.spaceSettings": "Налаштування простору",
    "roomList.sortDmsBy": "Сортувати ОП",
    "roomList.dmSortRecent": "За останнім повідомленням",
    "roomList.dmSortUnread": "Спершу непрочитані",
    "roomList.dmSortOnline": "Спершу в мережі",
    "roomList.dmSortName": "За ім'ям (А–Я)",
    "roomList.pendingInvites": "Запрошення в очікуванні",
    "roomList.inVoice": "{name} - у голосовому",
    "roomList.orderValue": "Значення порядку",
    "roomList.roomSettings": "Налаштування кімнати",
    "roomList.favourites": "Вибране",
    "roomList.channels": "Кімнати",
    "roomList.rooms": "Кімнати",
    "roomList.lowPriority": "Низький пріоритет",
    "roomList.browseRooms": "Огляд кімнат",
    "roomList.members": "Учасників: {numMembers}",
    "roomList.requested": "Запит надіслано",
    "roomList.cancelRequest": "Скасувати запит",
    "roomList.youCanTJoinThisRoom":
        "Ви не можете приєднатися до цієї кімнати напряму - попросити дозволу приєднатися?",
    "roomList.notNow": "Не зараз",
    "roomList.requestToJoin": "Попросити приєднатися",
    "roomList.directMessages": "Особисті повідомлення",
    "roomList.previewYou": "Ви: {text}",
    "roomList.noRoomsYet": "Кімнат ще немає",
    "roomList.emptyCategory": "Немає кімнат",
    "roomList.copyRoomLink": "Копіювати посилання на кімнату",
    "roomList.markAsRead": "Позначити прочитаним",
    "roomList.addToSpace": "Додати до простору",
    "roomList.clickAgainToLeave": "Клацніть ще раз, щоб вийти",
    "roomList.clickAgainToLeaveLastMember":
        "Ви єдиний учасник, тож після вашого виходу ніхто не зможе приєднатися. Клацніть ще раз, щоб вийти",
    "roomList.leaveRoom": "Вийти з кімнати",
    "roomList.couldNotSendTheJoinRequest":
        "Не вдалося надіслати запит на приєднання",
    "roomList.orderMustBeBetween0And":
        "Порядок має бути між 0 і 1 - натомість використано {value}.",
    "roomList.failedToSetOrder": "Не вдалося задати порядок",

    // src/lib/components/layout/RoomMediaPanel.svelte
    "roomMediaPanel.media": "Медіа",
    "roomMediaPanel.closeMediaPanel": "Закрити панель медіа",
    "roomMediaPanel.media2": "Медіа ({length}{value})",
    "roomMediaPanel.files": "Файли ({length}{value})",
    "roomMediaPanel.tryAgain": "Спробувати знову",
    "roomMediaPanel.play": "{name} - відтворити",
    "roomMediaPanel.video": "Відео",
    "roomMediaPanel.audio": "Аудіо",
    "roomMediaPanel.file": "Файл",
    "roomMediaPanel.decryptingMedia": "Розшифрування медіа",
    "roomMediaPanel.decryptingMedia2": "Розшифрування медіа...",
    "roomMediaPanel.mediaCouldNotBeLoaded": "Не вдалося завантажити медіа",
    "roomMediaPanel.couldNotLoadThisMedia": "Не вдалося завантажити це медіа.",
    "roomMediaPanel.noMediaFoundInTheLast":
        "Медіа в останніх кількох сотнях повідомлень не знайдено.",
    "roomMediaPanel.noFilesFoundInTheLast":
        "Файлів в останніх кількох сотнях повідомлень не знайдено.",
    "roomMediaPanel.noImagesOrVideosInThis":
        "У цій кімнаті ще немає зображень чи відео.",
    "roomMediaPanel.noFilesInThisRoomYet": "У цій кімнаті ще немає файлів.",
    "roomMediaPanel.couldNotLoadMedia": "Не вдалося завантажити медіа.",
    "roomMediaPanel.couldNotLoadMoreMedia":
        "Не вдалося завантажити більше медіа.",
    "roomMediaPanel.failedToDownloadAttachment":
        "Не вдалося завантажити вкладення",

    // src/lib/components/layout/RoomSettings.svelte
    "roomSettings.closeSettings": "Закрити налаштування",
    "roomSettings.backToSettings": "Назад до налаштувань",
    "roomSettings.settings": "{name} - Налаштування",
    "roomSettings.roomAvatar": "Аватар кімнати",
    "roomSettings.roomName": "Назва кімнати",
    "roomSettings.saved": "Збережено!",
    "roomSettings.saveChanges": "Зберегти зміни",
    "roomSettings.advanced": "Додатково",
    "roomSettings.spaceId": "ID простору",
    "roomSettings.roomId": "ID кімнати",
    "roomSettings.copied": "Скопійовано!",
    "roomSettings.roomVersionV": "Версія кімнати: v{getVersion}",
    "roomSettings.upgradeRoom": "Оновити кімнату…",
    "roomSettings.thisCreatesANewRoomOn":
        "Це створює нову кімнату версії v{recommendedVersion} і позначає цю як замінену. Учасників буде спрямовано до нової кімнати.",
    "roomSettings.upgrading": "Оновлення…",
    "roomSettings.upgradeRoom2": "Оновити кімнату",
    "roomSettings.additionalCreators": "Додаткові творці (кімната v12)",
    "roomSettings.additionalCreatorsHint":
        "Інші користувачі, які разом із вами стануть творцями оновленої кімнати. У кімнаті v12 владу творця неможливо забрати.",
    "roomSettings.whoCanJoin": "Хто може приєднатися?",
    "roomSettings.spaceMembersAnyoneInCanJoin":
        "Учасники простору - приєднатися може будь-хто з {parentSpaceNames}",
    "roomSettings.spaceMembersAnyoneInTheParent":
        "Учасники простору - приєднатися може будь-хто з батьківського простору",
    "roomSettings.messageHistory": "Історія повідомлень",
    "roomSettings.guestAccess": "Гостьовий доступ",
    "roomSettings.allowGuestsToJoinWithoutAn":
        "Дозволити гостям приєднуватися без облікового запису",
    "roomSettings.guestsAreAnonymousAccountsTheHomeserver":
        "Гості - це анонімні облікові записи, які домашній сервер створює на вимогу. Багато серверів повністю вимикають реєстрацію гостей, і тоді це не діє.",
    "roomSettings.discoverability": "Можливість знайти",
    "roomSettings.addresses": "Адреси",
    "roomSettings.loadingAddresses": "Завантаження адрес…",
    "roomSettings.noAddressesYet": "Адрес ще немає.",
    "roomSettings.main": "Основна",
    "roomSettings.remove": "Вилучити {alias}",
    "roomSettings.mainAddress": "Основна адреса",
    "roomSettings.noMainAddress": "Немає основної адреси",
    "roomSettings.set": "Задати",
    "roomSettings.myRoom": "my-room",
    "roomSettings.serverAccessControl": "Керування доступом серверів",
    "roomSettings.controlWhichHomeserversMayParticipateIn":
        "Керуйте тим, які домашні сервери можуть брати участь у цій кімнаті. Символи підстановки:",
    "roomSettings.matchesAnyCharacters": "відповідає будь-яким символам,",
    "roomSettings.matchesOneDeniedServersAreRemoved":
        "відповідає одному. Заборонені сервери виключаються з федерації для цієї кімнати.",
    "roomSettings.noServerAclIsSetAll":
        "ACL сервера не задано. Брати участь можуть усі сервери.",
    "roomSettings.allowedServersOnePerLine":
        "Дозволені сервери (по одному в рядку)",
    "roomSettings.deniedServersOnePerLine":
        "Заборонені сервери (по одному в рядку)",
    "roomSettings.allowServersIdentifiedByARaw":
        "Дозволити сервери, ідентифіковані за прямою IP-адресою",
    "roomSettings.saveServerAcl": "Зберегти ACL сервера",
    "roomSettings.youDoNotHavePermissionTo":
        "Ви не маєте дозволу редагувати ACL серверів для цієї кімнати.",
    "roomSettings.appliesToTheSpaceAndAll":
        "Застосовується до простору та всіх його кімнат.",
    "roomSettings.notificationLevel": "Рівень сповіщень",
    "roomSettings.encryption": "Шифрування",
    "roomSettings.encrypted": "Зашифровано",
    "roomSettings.notEncrypted": "Не зашифровано",
    "roomSettings.messagesInThisRoomAreEnd":
        "Повідомлення в цій кімнаті мають наскрізне шифрування. Це неможливо вимкнути.",
    "roomSettings.roomKey": "Ключ кімнати",
    "roomSettings.resetRoomKey": "Скинути ключ кімнати",
    "roomSettings.resetRoomKeyHint":
        "Якщо люди не можуть прочитати ваші повідомлення тут, ваше наступне повідомлення використає новий ключ і знову поділиться ним з кожним сеансом у кімнаті.",
    "roomSettings.couldNotResetRoomKey": "Не вдалося скинути ключ кімнати",
    "roomSettings.enableEncryption": "Увімкнути шифрування",
    "roomSettings.typeToConfirm":
        "Введіть {ENABLE_ENCRYPTION_CONFIRM_PHRASE}, щоб підтвердити",
    "roomSettings.enabling": "Увімкнення…",
    "roomSettings.powerLevelRequiredForEachAction":
        "Рівень прав, потрібний для кожної дії (0–100).",
    "roomSettings.nameAnyThread": "Називати будь-яку гілку",
    "roomSettings.joinCallsVoiceVideo":
        "Приєднуватися до викликів (голос/відео)",
    "roomSettings.invite": "Запрошувати",
    "roomSettings.searchMembers": "Пошук учасників…",
    "roomSettings.banned": "Заблоковані ({length})",
    "roomSettings.pendingJoinRequests":
        "Запити на приєднання в очікуванні ({length})",
    "roomSettings.deny": "Відхилити",
    "roomSettings.approve": "Схвалити",
    "roomSettings.unban": "Розблокувати",
    "roomSettings.noBannedMembers": "Заблокованих учасників немає",
    "roomSettings.you": " (ви)",
    "roomSettings.setRole": "Призначити роль…",
    "roomSettings.admin100": "Адміністратор (100)",
    "roomSettings.moderator50": "Модератор (50)",
    "roomSettings.member0": "Учасник (0)",
    "roomSettings.muted1": "Заглушений (-1)",
    "roomSettings.kick": "Виключити",
    "roomSettings.ban": "Заблокувати",
    "roomSettings.hideThisUserSMessagesEverywhere":
        "Приховувати повідомлення цього користувача всюди (зберігається у вашому обліковому записі)",
    "roomSettings.setThe": "Задайте поле",
    "roomSettings.fieldOnEachChildRoomTo":
        "у кожній дочірній кімнаті, щоб керувати порядком сортування (лексикографічним). Залиште порожнім, щоб сортувати за часом створення.",
    "roomSettings.suggested": "Рекомендована",
    "roomSettings.removeSuggestedHint": "Прибрати позначку рекомендації",
    "roomSettings.markAsSuggested": "Позначити як рекомендовану",
    "roomSettings.unsuggest": "Не рекомендувати",
    "roomSettings.suggest": "Рекомендувати",
    "roomSettings.order": "порядок",
    "roomSettings.removeFromSpace": "Вилучити з простору",
    "roomSettings.noChildRooms": "Немає дочірніх кімнат",
    "roomSettings.useYourGlobalNotificationSettings":
        "Використовувати ваші загальні налаштування сповіщень.",
    "roomSettings.allMessages": "Усі повідомлення",
    "roomSettings.notifyForEveryMessage": "Сповіщати про кожне повідомлення.",
    "roomSettings.mentionsOnly": "Лише згадки",
    "roomSettings.notifyOnlyForMentionsAndKeywords":
        "Сповіщати лише про @згадки та ключові слова.",
    "roomSettings.neverNotify": "Ніколи не сповіщати.",
    "roomSettings.failedToUpdateNotifications":
        "Не вдалося оновити сповіщення.",
    "roomSettings.failedToEnableEncryption": "Не вдалося ввімкнути шифрування",
    "roomSettings.failedToSave": "Не вдалося зберегти",
    "roomSettings.uploadFailed": "Не вдалося вивантажити",
    "roomSettings.failedToUpgradeRoom": "Не вдалося оновити кімнату",
    "roomSettings.failedToSaveServerAcl": "Не вдалося зберегти ACL сервера",
    "roomSettings.couldNotChangeVisibility": "Не вдалося змінити видимість",
    "roomSettings.couldNotLoadThisRoomS":
        "Не вдалося завантажити адреси цієї кімнати",
    "roomSettings.couldNotAddThatAddress": "Не вдалося додати цю адресу",
    "roomSettings.thisAddressIsPublishedAsOne":
        "Ця адреса опублікована як одна з адрес кімнати, а ви не маєте дозволу скасовувати її публікацію, тож її не можна вилучити. Зверніться до адміністратора кімнати.",
    "roomSettings.couldNotRemoveThatAddress": "Не вдалося вилучити цю адресу",
    "roomSettings.couldNotSetTheMainAddress":
        "Не вдалося задати основну адресу",
    "roomSettings.failed": "Не вдалося",
    "roomSettings.muted": "Заглушений",
    "roomSettings.admin": "Адміністратор",
    "roomSettings.moderator": "Модератор",
    "roomSettings.member": "Учасник",
    "roomSettings.creatorLabel": "Творець",
    "roomSettings.failedToUpdateSuggestion": "Не вдалося оновити рекомендацію",
    "roomSettings.listThisRoomInTheServerDirectory":
        "Включити цю кімнату до каталогу сервера",
    "roomSettings.listThisSpaceInTheServerDirectory":
        "Включити цей простір до каталогу сервера",
    "roomSettings.listsTheRoomByIdBeingFound":
        "Включає кімнату за ID. Щоб її можна було знайти за назвою, потрібна ще й опублікована адреса - додайте її нижче.",
    "roomSettings.listsTheSpaceByIdBeingFound":
        "Включає простір за ID. Щоб його можна було знайти за назвою, потрібна ще й опублікована адреса - додайте її нижче.",
    "roomSettings.aPublishedAddressLetsPeopleFindRoom":
        "Опублікована адреса дозволяє людям знаходити цю кімнату й приєднуватися до неї за назвою, а не за ID.",
    "roomSettings.aPublishedAddressLetsPeopleFindSpace":
        "Опублікована адреса дозволяє людям знаходити цей простір і приєднуватися до нього за назвою, а не за ID.",
    "roomSettings.chooseHowThisRoomNotifiesYou":
        "Виберіть, як ця кімната сповіщає вас.",
    "roomSettings.chooseHowThisSpaceNotifiesYou":
        "Виберіть, як цей простір сповіщає вас.",

    // src/lib/components/layout/ScreenSharePicker.svelte
    "screenSharePicker.chooseWhatToShare": "Виберіть, що показати",
    "screenSharePicker.noPreview": "Без попереднього перегляду",
    "screenSharePicker.screens": "Екрани",
    "screenSharePicker.windows": "Вікна",
    "screenSharePicker.quality": "Якість: {quality}",
    "screenSharePicker.audio": "Звук",
    "screenSharePicker.audioAuto": "Застосунок вікна або весь звук для екрана",
    "screenSharePicker.audioSystemExceptZam": "Увесь звук, окрім Zam",
    "screenSharePicker.audioSystem": "Увесь системний звук",
    "screenSharePicker.audioApps": "Застосунки",
    "screenSharePicker.audioNone": "Без звуку",

    // src/lib/components/layout/ScreenShareQualityChips.svelte
    "screenShareQualityChips.resolution": "Роздільна здатність",
    "screenShareQualityChips.frameRate": "Частота кадрів",
    "screenShareQualityChips.fps": "{f} кадр/с",
    "screenShareQualityChips.videoCodec": "Відеокодек",
    "screenShareQualityChips.hw": "HW",
    "screenShareQualityChips.codecHardware": "Кодується на вашій відеокарті",
    "screenShareQualityChips.codecSoftware": "Кодується на вашому процесорі",
    "screenShareQualityChips.codecHint":
        "Для вашої камери та показу екрана. Перелічено лише кодеки, які можуть відтворити всі учасники виклику.",
    "screenShareQualityChips.codecBackupHint":
        "Хтось у виклику не може відтворити {codec}, тому він отримує копію H.264, яка потребує більше вихідного трафіку.",
    "screenShareQualityChips.codecEncryptedFallbackHint":
        "Хтось у цьому зашифрованому виклику не може відтворити {picked}, тож ви надсилаєте {current}, доки цей учасник не вийде.",
    "screenShareQualityChips.bitrate": "Макс. бітрейт",
    "screenShareQualityChips.bitrateUpTo": "До",
    "screenShareQualityChips.bitrateCapHint":
        "Це межа, а не ціль: показ екрана використовує лише те, що потрібно зображенню й що може передати ваше з’єднання, аж до цього значення.",
    "screenShareQualityChips.bitrateOverridden":
        "Використовується введена вами швидкість вивантаження, {upload}, тож це досягає {max}.",
    "screenShareQualityChips.uploadOverride": "Швидкість вивантаження (Мбіт/с)",
    "screenShareQualityChips.uploadOverrideAuto": "Авто",
    "screenShareQualityChips.uploadOverrideHint":
        "Автоматичне вимірювання може показувати значно менше за вашу справжню швидкість. Введіть власне значення, щоб підняти межу; залиште порожнім, щоб вимірювати.",
    "screenShareQualityChips.kbps": "{n} кбіт/с",
    "screenShareQualityChips.mbps": "{n} Мбіт/с",
    "screenShareQualityChips.bitrateMeasured":
        "Ваше вивантаження вимірюється як {upload}, тож це досягає {max}.",
    "screenShareQualityChips.bitrateUnmeasured":
        "Ваше вивантаження ще не виміряно. Його вимірюють, поки ви надсилаєте відео, тож наразі це досягає {max}.",
    "screenShareQualityChips.shareSystemAudio": "Ділитися системним звуком",
    "screenShareQualityChips.appliesToNextShare":
        "Застосовується до наступного показу",
    "screenShareQualityChips.shareSystemAudioAppliesToNext":
        "Ділитися системним звуком (застосовується до наступного показу)",

    // src/lib/components/layout/ScreenShareQualityPopover.svelte

    "screenShareQualityPopover.screenShareQuality": "Якість показу екрана",

    // src/lib/components/settings/SecuritySettings.svelte
    "securitySettings.showingTheLastReadingThatLoaded":
        "Показано останнє завантажене значення - воно може бути застарілим.",
    "securitySettings.securityEncryption": "Безпека та шифрування",
    "securitySettings.setUpRecoverySoYourCross":
        "Налаштуйте відновлення, щоб ваша ідентичність перехресного підписування й історія зашифрованих повідомлень зберігалися після виходу на кожному пристрої.",
    "securitySettings.verification": "Верифікація",
    "securitySettings.loadingEncryptionStatus":
        "Завантаження стану шифрування…",
    "securitySettings.encryptionStatusUnknownOnThisSession":
        "Стан шифрування в цьому сеансі невідомий.",
    "securitySettings.recoveryKeyId": "ID ключа відновлення:",
    "securitySettings.setUpRecovery": "Налаштувати відновлення",
    "securitySettings.approveOnAccountPageHint":
        "Ваш сервер може попросити схвалити це на сторінці облікового запису.",
    "securitySettings.approveOnAccountPage":
        "Схвалити на сторінці облікового запису",
    "securitySettings.approveOnAccountPageBody":
        "Ваш сервер потребує, щоб ви дозволили цю зміну. Відкрийте сторінку облікового запису, схваліть скидання вашої криптографічної ідентичності, а потім поверніться й продовжуйте.",
    "securitySettings.approveOnAccountPageRetry":
        "Сервер ще не побачив схвалення. Схваліть його на сторінці облікового запису, а потім продовжуйте.",
    "securitySettings.openAccountPage": "Відкрити сторінку облікового запису",
    "securitySettings.iVeApprovedIt": "Я схвалив(-ла)",
    "securitySettings.weLlCreateA": "Ми створимо",
    "securitySettings.recoveryKey": "ключ відновлення",
    "securitySettings.aOneTimeCodeThatUnlocks":
        "- одноразовий код, що розблоковує вашу зашифровану історію та верифікує нові сеанси. Зберігайте його в надійному місці, наприклад у менеджері паролів; він показується лише один раз, і ми не можемо відновити його для вас.",
    "securitySettings.confirmYourAccountPasswordToCreate":
        "Підтвердьте пароль облікового запису, щоб створити ваші ключі шифрування.",
    "securitySettings.accountPassword": "Пароль облікового запису",
    "securitySettings.alsoLetMeUnlockWithA":
        "Також дозволити розблокування парольною фразою, яку я виберу (необов’язково - ваш ключ відновлення все одно працює й усе одно показується).",
    "securitySettings.recoveryPassphrase": "Парольна фраза відновлення",
    "securitySettings.atLeastCharactersWeCanT":
        "Щонайменше {MIN_PASSPHRASE_LENGTH} символів. Ми не можемо скинути її для вас.",
    "securitySettings.settingUp": "Налаштування…",
    "securitySettings.continue": "Продовжити",
    "securitySettings.saveYourRecoveryKey": "Збережіть свій ключ відновлення",
    "securitySettings.thisIsShown": "Це показується",
    "securitySettings.onlyOnce": "лише один раз",
    "securitySettings.storeItNowWithoutItYou":
        ". Збережіть його зараз - без нього ви не зможете відновити зашифровану історію, якщо втратите доступ до своїх сеансів.",
    "securitySettings.copied": "Скопійовано",
    "securitySettings.copyKey": "Копіювати ключ",
    "securitySettings.youCanAlsoUnlockWithThe":
        "Ви також можете розблокувати парольною фразою, яку вибрали. Усе одно збережіть ключ - це єдиний шлях, якщо ви забудете парольну фразу.",
    "securitySettings.iVeSavedMyRecoveryKey":
        "Я зберіг(-ла) свій ключ відновлення в надійному місці.",
    "securitySettings.done": "Готово",
    "securitySettings.keysNotOnServer":
        "Ваші ключі перехресного підписування так і не дійшли до сервера",
    "securitySettings.keysNotOnServerHint":
        "Цей сеанс створив їх під час налаштування відновлення, але вивантаження не завершилося, тож жоден із ваших сеансів не може верифікувати інший. Вивантажте їх зараз, щоб це виправити.",
    "securitySettings.uploadKeys": "Вивантажити ключі",
    "securitySettings.couldNotUploadKeys": "Не вдалося вивантажити ваші ключі",
    "securitySettings.recoveryIsSetUp": "Відновлення налаштовано",
    "securitySettings.yourCrossSigningKeysAndA":
        "Ваші ключі перехресного підписування та резервна копія ключів надійно зберігаються на сервері під захистом вашого ключа відновлення.",
    "securitySettings.recoveryIsNotSetUp": "Відновлення не налаштовано",
    "securitySettings.thisAccountHasNoRecoveryKey":
        "Цей обліковий запис не має ключа відновлення й резервної копії ключів, доки ви не завершите крок нижче.",
    "securitySettings.lostYourRecoveryKeyResetRecovery":
        "Втратили ключ відновлення? Скиньте відновлення",
    "securitySettings.resettingCreatesA": "Скидання створює",
    "securitySettings.new": "новий",
    "securitySettings.recoveryKeyAndReplacesYourCurrent":
        "ключ відновлення й замінює вашу поточну резервну копію. Ваш старий ключ відновлення перестане працювати, а інші сеанси може знадобитися верифікувати знову. Робіть це, лише якщо ви втратили поточний ключ.",
    "securitySettings.yourOldRecoveryKeyAndBackup":
        "Ваш старий ключ відновлення й резервну копію було скинуто, але нове відновлення не створено. Завершіть його налаштування зараз - ваші повідомлення не можна буде відновити в новому сеансі, доки ви цього не зробите.",
    "securitySettings.working": "Виконується…",
    "securitySettings.finishSettingUpRecovery":
        "Завершити налаштування відновлення",
    "securitySettings.confirmYourAccountPasswordToReset":
        "Підтвердьте пароль облікового запису, щоб скинути відновлення.",
    "securitySettings.resetting": "Скидання…",
    "securitySettings.resetCreateNewKey": "Скинути й створити новий ключ",
    "securitySettings.messageHistoryBackup":
        "Резервна копія історії повідомлень",
    "securitySettings.verifyThisSessionRestoreHistory":
        "Верифікувати цей сеанс і відновити історію",
    "securitySettings.recoveryKey2": "Ключ відновлення",
    "securitySettings.passphrase": "Парольна фраза",
    "securitySettings.enterYour": "Введіть",
    "securitySettings.recoveryPassphrase2": "парольну фразу відновлення",
    "securitySettings.toVerifyThisSessionAndRestore":
        "щоб верифікувати цей сеанс і відновити вашу історію зашифрованих повідомлень.",
    "securitySettings.thisSessionIsNowVerified": "Цей сеанс верифіковано",
    "securitySettings.encryptedHistoryRestored":
        "Зашифровану історію відновлено",
    "securitySettings.couldNotSetUpRecovery":
        "Не вдалося налаштувати відновлення",
    "securitySettings.couldNotResetRecovery": "Не вдалося скинути відновлення",
    "securitySettings.couldNotFinishSettingUpRecovery":
        "Не вдалося завершити налаштування відновлення",
    "securitySettings.couldNotVerifyThisSession":
        "Не вдалося верифікувати цей сеанс",

    // src/lib/components/settings/ServerSettings.svelte
    "serverSettings.scanningServer": "Сканування сервера…",
    "serverSettings.what": "Можливості сервера",
    "serverSettings.advertisesItemsMarkedUnknownArenT":
        "- це те, що він оголошує. Елементи, позначені «Невідомо», сервер не оголошує, і їх виявляють лише під час використання.",
    "serverSettings.accountMessaging": "Обліковий запис і обмін повідомленнями",
    "serverSettings.voiceVideoCallingMatrixrtc":
        "Голосові / відеовиклики (MatrixRTC)",
    "serverSettings.server": "Сервер",
    "serverSettings.latestSpecVersion": "Остання версія специфікації",
    "serverSettings.defaultRoomVersion": "Типова версія кімнати",
    "serverSettings.advertisedFeatures": "Оголошені можливості ({length})",
    "serverSettings.supported": "Підтримується",
    "serverSettings.notSupported": "Не підтримується",
    "serverSettings.unknown": "Невідомо",
    "serverSettings.changePassword": "Зміна пароля",
    "serverSettings.changeDisplayName": "Зміна показуваного імені",
    "serverSettings.changeAvatar": "Зміна аватара",
    "serverSettings.manageEmailsPhoneNumbers":
        "Керування адресами електронної пошти / номерами телефонів",
    "serverSettings.threads": "Гілки",
    "serverSettings.privateReadReceipts": "Приватні підтвердження прочитання",
    "serverSettings.sfuDiscoveryRtcFoci": "Виявлення SFU (rtc_foci)",
    "serverSettings.delayedEventsCallCleanup":
        "Відкладені події (очищення викликів)",
    "serverSettings.failedToReadServerCapabilities":
        "Не вдалося прочитати можливості сервера",

    // src/lib/components/settings/SessionSettings.svelte
    "sessionSettings.sessionName": "Назва сеансу",
    "sessionSettings.current": "Поточний",
    "sessionSettings.rename": "Перейменувати",
    "sessionSettings.signOut": "Вийти?",
    "sessionSettings.signOut2": "Вийти",
    "sessionSettings.manageAtProvider": "Керувати",
    "sessionSettings.confirmYourAccountPasswordToSign":
        "Підтвердьте пароль облікового запису, щоб вийти з цього сеансу.",
    "sessionSettings.accountPassword": "Пароль облікового запису",
    "sessionSettings.signingOut": "Вихід…",
    "sessionSettings.encryption": "Шифрування",
    "sessionSettings.active": "Активне",
    "sessionSettings.unavailable": "Недоступне",
    "sessionSettings.thisDeviceSKey": "Ключ цього пристрою",
    "sessionSettings.loadingDeviceKey": "Завантаження ключа пристрою…",
    "sessionSettings.endToEndEncryptionCouldNot":
        "Наскрізне шифрування не вдалося запустити в цьому сеансі. Зашифровані кімнати показуватимуть заглушки.",
    "sessionSettings.encryptNewDirectMessages":
        "Шифрувати нові особисті повідомлення",
    "sessionSettings.newDmsYouStartAreEncrypted":
        "Нові особисті чати, які ви розпочинаєте, типово шифруються. Наявні чати залишаються без змін. Вимкніть це, якщо ви пишете людям, чиї клієнти не підтримують шифрування.",
    "identityChange.own":
        "Ваші ключі перехресного підписування змінилися. Верифікуйте цей сеанс знову або скиньте й повторно підпишіть свої пристрої, перш ніж довіряти зашифрованим повідомленням.",
    "identityChange.other":
        "Ідентичність перехресного підписування користувача {user} змінилася. Зашифровані повідомлення йому утримуються, доки ви не приймете нову ідентичність.",
    "identityChange.accept": "Прийняти нову ідентичність",
    "identityChange.withdraw": "Скасувати верифікацію",
    "identityChange.dismiss": "Закрити попередження про ідентичність",
    "sessionSettings.excludeInsecureDevices":
        "Виключати пристрої без перехресного підписування",
    "sessionSettings.excludeInsecureDevicesHelp":
        "Передавати ключі повідомлень і показувати повідомлення лише з пристроїв, які їхній власник підписав перехресно (MSC4153). Повідомлення з пристроїв без перехресного підписування показуватимуться як нерозшифровувані.",
    "sessionSettings.onlySendToVerifiedDevices":
        "Надсилати лише на верифіковані пристрої",
    "sessionSettings.refuseToEncryptMessagesForSessions":
        "Відмовлятися шифрувати повідомлення для сеансів, які ви не верифікували. Вони взагалі не отримуватимуть ваших повідомлень - зокрема й ваші власні неверифіковані сеанси. Типово вимкнено.",
    "sessionSettings.devicesCurrentlySignedInToThis":
        "Пристрої, на яких зараз виконано вхід у цей обліковий запис.",
    "sessionSettings.refreshing": "Оновлення…",
    "sessionSettings.refresh": "Оновити",
    "sessionSettings.loadingSessions": "Завантаження сеансів…",
    "sessionSettings.otherSessions": "Інші сеанси {value}",
    "sessionSettings.noOtherSessionsYouReOnly":
        "Інших сеансів немає - ви ввійшли лише тут.",
    "sessionSettings.failedToLoadSessions": "Не вдалося завантажити сеанси",
    "sessionSettings.failedToRenameSession": "Не вдалося перейменувати сеанс",
    "sessionSettings.failedToSignOutSession": "Не вдалося вийти із сеансу",
    "sessionSettings.couldNotStartVerification":
        "Не вдалося розпочати верифікацію",

    // src/lib/components/messages/ShareLocationDialog.svelte
    "shareLocationDialog.shareLocation": "Поділитися місцезнаходженням",
    "shareLocationDialog.sendOnce": "Надіслати один раз",
    "shareLocationDialog.shareLive": "Ділитися наживо",
    "shareLocationDialog.locating": "Визначення місцезнаходження…",
    "shareLocationDialog.useMyCurrentLocation":
        "Використати моє поточне місцезнаходження",
    "shareLocationDialog.descriptionOptional": "Опис (необов’язково)",
    "shareLocationDialog.eGHomeTheCafOn": "напр. Дім, кав’ярня на розі…",
    "shareLocationDialog.duration": "Тривалість",
    "shareLocationDialog.yourLiveLocationIsSharedWith":
        "Ваше місцезнаходження наживо доступне цій кімнаті, доки ви не зупините або не спливе таймер.",
    "shareLocationDialog.sharing": "Надсилання…",
    "shareLocationDialog.share": "Поділитися",
    "shareLocationDialog.failedToStartLiveLocation":
        "Не вдалося розпочати показ місцезнаходження наживо",
    "shareLocationDialog.failedToShareLocation":
        "Не вдалося поділитися місцезнаходженням",

    // src/lib/components/messages/ShareTargetSheet.svelte
    "shareTargetSheet.fileSWerenTAddedShares":
        "Файлів, які не додано: {droppedFiles}. Ділитися можна щонайбільше {SHARE_MAX_FILES} файлами, по {value} МБ кожен і {value2} МБ загалом.",
    "shareTargetSheet.addAMessage": "Додайте повідомлення…",
    "shareTargetSheet.searchRooms": "Пошук кімнат",
    "shareTargetSheet.noJoinedRoomsFound":
        "Кімнат, до яких ви приєдналися, не знайдено",
    "shareTargetSheet.send": "Надіслати",
    "shareTargetSheet.shareToARoom": "Поділитися в кімнаті",

    // src/lib/components/layout/SpaceLandingPanel.svelte
    "spaceLandingPanel.yourRooms": "Ваші кімнати",
    "spaceLandingPanel.loadingRooms": "Завантаження кімнат…",
    "spaceLandingPanel.browseRooms": "Огляд кімнат",
    "spaceLandingPanel.youHavenTJoinedARoom":
        "Ви ще не приєдналися до жодної кімнати в {spaceName}. Виберіть одну, щоб почати.",
    "spaceLandingPanel.nothingJoinedHereYet": "Тут ще нічого не приєднано",
    "spaceLandingPanel.onlyOtherSpacesLiveInsideOpen":
        "У {spaceName} містяться лише інші простори; відкрийте один зі списку кімнат, щоб переглянути його кімнати.",
    "spaceLandingPanel.thereAreNoRoomsInYet": "У {spaceName} ще немає кімнат.",
    "spaceLandingPanel.thisSpace": "цей простір",
    "spaceLandingPanel.couldnTJoinTryItFrom":
        "Не вдалося приєднатися до {value}. Спробуйте через «Огляд кімнат» у списку кімнат.",
    "spaceLandingPanel.thatRoom": "ту кімнату",

    // src/lib/components/layout/SpaceSidebar.svelte
    "spaceSidebar.home": "Домівка",
    "spaceSidebar.addASpace": "Додати простір",
    "spaceSidebar.exploreRooms": "Огляд кімнат",
    "spaceSidebar.folderColor": "Колір теки",
    "spaceSidebar.createRoomInSpace": "Створити кімнату в просторі",
    "spaceSidebar.roomName": "Назва кімнати",
    "spaceSidebar.myRoom": "my-room",
    "spaceSidebar.optional": "(необов’язково)",
    "spaceSidebar.whatSThisRoomAbout": "Про що ця кімната?",
    "spaceSidebar.opensStraightIntoACallMessages":
        "Відкривається одразу у виклику. Повідомлення також працюють.",
    "spaceSidebar.create": "Створити",
    "spaceSidebar.addExistingRoomToSpace": "Додати наявну кімнату до простору",
    "spaceSidebar.noRoomsAvailableToAdd":
        "Немає кімнат, доступних для додавання.",
    "spaceSidebar.spaceSettings": "Налаштування простору",
    "spaceSidebar.copySpaceLink": "Копіювати посилання на простір",
    "spaceSidebar.markAsRead": "Позначити прочитаним",
    "spaceSidebar.createRoom": "Створити кімнату",
    "spaceSidebar.addExistingRoom": "Додати наявну кімнату",
    "spaceSidebar.removeFromFolder": "Вилучити з теки",
    "spaceSidebar.newFolder": "Нова тека",
    "spaceSidebar.clickAgainToLeave": "Клацніть ще раз, щоб вийти",
    "spaceSidebar.clickAgainToLeaveLastMember":
        "Ви єдиний учасник, тож після вашого виходу ніхто не зможе приєднатися до цього простору. Клацніть ще раз, щоб вийти",
    "spaceSidebar.leaveSpace": "Вийти з простору",
    "spaceSidebar.setColor": "Задати колір",
    "spaceSidebar.dissolveFolder": "Розформувати теку",
    "spaceSidebar.somethingWentWrong": "Щось пішло не так",

    // src/lib/components/layout/Splash.svelte
    "splash.restoringSession": "Відновлення сеансу…",

    // src/lib/components/ui/StickerPicker.svelte
    "stickerPicker.searchStickers": "Пошук стікерів…",
    "stickerPicker.searchStickers2": "Пошук стікерів",
    "stickerPicker.noStickerPacksAvailable": "Немає доступних наборів стікерів",
    "stickerPicker.myStickers": "Мої стікери",
    "stickerPicker.myStickers2": "Мої стікери",

    // src/lib/components/ui/SwfEmbed.svelte
    "swfEmbed.adobeFlash": "Adobe Flash",

    // src/lib/components/settings/ThemeColorEditor.svelte
    "themeColorEditor.themeColors": "Кольори теми",
    "themeColorEditor.presetName": "Назва шаблону",
    "themeColorEditor.savePreset": "Зберегти шаблон",
    "themeColorEditor.import": "Імпортувати",
    "themeColorEditor.pasteThemeCode": "Вставте код теми",
    "themeColorEditor.copyCurrentPresetToClipboard":
        "Копіювати поточний шаблон до буфера обміну",
    "themeColorEditor.copied": "Скопійовано!",
    "themeColorEditor.presets": "Шаблони",
    "themeColorEditor.delete": "Видалити?",
    "themeColorEditor.confirmDelete": "Підтвердити видалення {name}",
    "themeColorEditor.rename": "Перейменувати",
    "themeColorEditor.delete2": "Видалити {name}",
    "themeColorEditor.builtInPresetsAreReadOnly":
        "Вбудовані шаблони лише для читання. Дублюйте, щоб налаштувати:",
    "themeColorEditor.duplicateToCustomize": "Дублювати для налаштування",
    "themeColorEditor.colors": "Кольори",
    "themeColorEditor.backgrounds": "Фони",
    "themeColorEditor.resetToDefault": "Скинути до типового",
    "themeColorEditor.text": "Текст",
    "themeColorEditor.accentsSemantics": "Акценти та семантика",
    "themeColorEditor.presence": "Присутність",
    "themeColorEditor.details": "Деталі",
    "themeColorEditor.contrastWarnings": "Попередження про контраст",
    "themeColorEditor.messageDisplay": "Показ повідомлень",
    "themeColorEditor.savedOnThisDeviceOnlyNot":
        "Зберігається лише на цьому пристрої. Не синхронізується між вашими пристроями.",
    "themeColorEditor.appTextSize": "Розмір тексту застосунку: {round}%",
    "themeColorEditor.scalesAllTextAndSpacingAcross":
        "Масштабує весь текст і відступи в застосунку.",
    "themeColorEditor.font": "Шрифт",
    "themeColorEditor.custom": "Власний - {customFontName}",
    "themeColorEditor.replaceCustomFont": "Замінити власний шрифт…",
    "themeColorEditor.uploadCustomFont": "Вивантажити власний шрифт…",
    "themeColorEditor.woff2TtfOrOtfUpTo":
        ".woff2, .ttf або .otf до 10 МБ. Зберігається лише на цьому пристрої.",
    "themeColorEditor.theQuickBrownFoxJumpsOver":
        "Щодо жовтих бджіл, що ґулю з’їли, чи ж ви цього не знаєте? Фах - це все.",
    "themeColorEditor.cannotSavePreset": "Не вдалося зберегти шаблон",
    "themeColorEditor.notAValidThemeCode": "Недійсний код теми",
    "themeColorEditor.imported": "Імпортовано",
    "themeColorEditor.cannotImportPreset": "Не вдалося імпортувати шаблон",
    "themeColorEditor.copy": "{activePresetName} (копія)",

    // src/lib/components/layout/ThreadPanel.svelte
    "threadPanel.thread": "Гілка",
    "threadPanel.collapseThread": "Згорнути гілку",
    "threadPanel.expandThread": "Розгорнути гілку",
    "threadPanel.closeThread": "Закрити гілку",
    "threadPanel.noRepliesYetStartTheThread":
        "Відповідей ще немає. Розпочніть гілку нижче.",
    "threadPanel.loadOlderReplies": "Завантажити старіші відповіді",

    // src/lib/components/layout/ThreadsListPanel.svelte
    "threadsListPanel.threads": "Гілки",
    "threadsListPanel.closeThreadsPanel": "Закрити панель гілок",
    "threadsListPanel.noThreadsInThisRoomYet": "У цій кімнаті ще немає гілок.",
    "threadsListPanel.youParticipated": "Ви брали участь",
    "threadsListPanel.unreadMentions": "Непрочитані згадки",
    "threadsListPanel.unreadReplies": "Непрочитані відповіді",
    "threadsListPanel.couldnTLoadThreadsForThis":
        "Не вдалося завантажити гілки для цієї кімнати.",
    "threadsListPanel.unknownSender": "Невідомо",
    "threadsListPanel.allThreads": "Усі гілки",
    "threadsListPanel.myThreads": "Мої гілки",
    "threadsListPanel.filterThreads": "Фільтр гілок",
    "threadsListPanel.noThreadsYouParticipatedIn":
        "Ви тут не розпочинали гілок і не відповідали в жодній.",

    // src/lib/components/layout/StorageBanner.svelte
    "storageBanner.outOfStorage":
        "На вашому пристрої закінчилося місце. Zam не може зберігати повідомлення чи ключі шифрування, доки ви не звільните місце.",
    "storageBanner.lowStorage":
        "На вашому пристрої майже закінчилося місце (залишилося {free}). Звільніть місце найближчим часом, інакше Zam не зможе зберігати повідомлення чи ключі шифрування.",
    "storageBanner.checkAgain": "Перевірити знову",
    "storageBanner.dismissLowStorageWarning":
        "Закрити попередження про сховище",

    // src/lib/components/layout/UpdateBanner.svelte
    "updateBanner.dismissUpdateNotification":
        "Закрити сповіщення про оновлення",
    "updateBanner.installFailed": "Не вдалося встановити",

    // src/lib/components/ui/UserPicker.svelte
    "userPicker.remove": "Вилучити {userId}",
    "userPicker.searching": "Пошук…",
    "userPicker.noMatchingUsers": "Відповідних користувачів немає",
    "userPicker.available":
        "{optionCount, plural, one {Доступний # результат} few {Доступні # результати} many {Доступно # результатів} other {Доступно # результату}}",
    "userPicker.invite": "Запросити {candidateShown}",
    "userPicker.alreadyAdded": "Уже додано",
    "userPicker.alreadyInThisRoom": "Уже в цій кімнаті",
    "userPicker.sendAnInviteToThisExact":
        "Надіслати запрошення на цей точний ID користувача",
    "userPicker.noMatchesTypeAFullUser":
        "Збігів немає. Введіть повний ID користувача, наприклад",
    "userPicker.userServer": "@user:server",
    "userPicker.toInviteSomeoneTheDirectoryDoesn":
        "щоб запросити того, кого немає в каталозі.",
    "userPicker.searchForPeople": "Пошук людей…",
    "userPicker.userSearchFailedYouCanStill":
        "Не вдалося виконати пошук користувачів - ви все одно можете ввести повний ID користувача.",

    // src/lib/components/ui/UserProfileCard.svelte
    "userProfileCard.copyUserId": "Копіювати ID користувача",
    "userProfileCard.copied": "Скопійовано",
    "userProfileCard.localTime": "місцевий час {localTime} ({timezone})",
    "userProfileCard.notAMemberOfThisRoom": "Не є учасником цієї кімнати",
    "userProfileCard.powerLevel": "Рівень прав: {level}",
    "userProfileCard.powerLevelCreator": "Рівень прав: творець",
    "userProfileCard.mutualRooms": "Спільних кімнат: {total}",
    "userProfileCard.more": "ще +{moreCount}",
    "userProfileCard.sessions": "Сеанси",
    "userProfileCard.sessionsCount": "Сеансів: {total}",
    "userProfileCard.refreshSessions": "Запитати в сервера їхні поточні сеанси",
    "userProfileCard.noKnownSessions":
        "Цей сеанс не знає жодного з їхніх сеансів, тож вони не можуть прочитати ваші зашифровані повідомлення.",
    "userProfileCard.couldNotLoadSessions":
        "Не вдалося завантажити їхні сеанси",
    "userProfileCard.keysChanged": "Ключі змінено",
    "userProfileCard.keysChangedHint":
        "Сеанс із позначкою «Ключі змінено» має нові ключі, які цей сеанс не зміг прийняти. Йому може знадобитися вийти й увійти знову.",
    "userProfileCard.opening": "Відкриття…",
    "userProfileCard.message": "Повідомлення",
    "userProfileCard.verifyUser": "Верифікувати користувача",
    "userProfileCard.editProfile": "Редагувати профіль",
    "userProfileCard.kicking": "Виключення…",
    "userProfileCard.confirmKick": "Підтвердити виключення?",
    "userProfileCard.kick": "Виключити",
    "userProfileCard.banning": "Блокування…",
    "userProfileCard.confirmBan": "Підтвердити блокування?",
    "userProfileCard.ban": "Заблокувати",
    "userProfileCard.couldNotStartVerification":
        "Не вдалося розпочати верифікацію",
    "userProfileCard.couldNotCopyToClipboard":
        "Не вдалося скопіювати до буфера обміну",
    "userProfileCard.couldNotOpenDm": "Не вдалося відкрити особистий чат",
    "userProfileCard.couldNotKick": "Не вдалося виключити",
    "userProfileCard.couldNotBan": "Не вдалося заблокувати",

    // src/lib/components/layout/VerificationModal.svelte
    "verificationModal.thisSessionIsNowTrusted": "Цей сеанс тепер надійний.",
    "verificationModal.theirIdentityIsNowVerified":
        "Їхню ідентичність тепер верифіковано.",
    "verificationModal.noTrustWasEstablishedYouCan":
        "Довіру не встановлено. Ви можете розпочати знову будь-коли.",
    "verificationModal.didYourOtherSessionJustScan":
        "Ваш інший сеанс щойно просканував цей код?",
    "verificationModal.didJustScanThisCode":
        "{otherUserId} щойно просканував(-ла) цей код?",
    "verificationModal.onlyConfirmIfYouScannedIt":
        "Підтверджуйте, лише якщо ви самі просканували його щойно.",
    "verificationModal.onlyConfirmIfYouWatchedThem":
        "Підтверджуйте, лише якщо ви бачили, як вони сканували його щойно.",
    "verificationModal.no": "Ні",
    "verificationModal.yesIScannedIt": "Так, я просканував(-ла)",
    "verificationModal.deviceWithThisUser": "на пристрої цього користувача",
    "verificationModal.confirmTheSameEmojiAppearIn":
        "Підтвердьте, що такі самі емодзі в такому самому порядку з’являються {value}.",
    "verificationModal.theyDonTMatch": "Вони не збігаються",
    "verificationModal.confirming": "Підтвердження…",
    "verificationModal.theyMatch": "Вони збігаються",
    "verificationModal.verificationCodeForYourOtherSession":
        "Код верифікації для вашого іншого сеансу",
    "verificationModal.verificationCodeFor":
        "Код верифікації для {otherUserId}",
    "verificationModal.scanThisWithYourOtherSession":
        "Проскануйте це вашим іншим сеансом.",
    "verificationModal.askThemToScanThisCode":
        "Попросіть їх просканувати цей код.",
    "verificationModal.noCodeToShowRightNow": "Зараз немає коду для показу.",
    "verificationModal.couldNotLoadTheScanner":
        "Не вдалося завантажити сканер.",
    "verificationModal.scanAgain": "Сканувати знову",
    "verificationModal.compareAShortListOfEmoji":
        "Порівняйте короткий список емодзі для верифікації або скористайтеся QR-кодом.",
    "verificationModal.compareEmoji": "Порівняти емодзі",
    "verificationModal.showACodeForTheOther":
        "Показати код для сканування іншою стороною",
    "verificationModal.scanTheirCodeWithTheCamera":
        "Просканувати їхній код камерою",
    "verificationModal.chooseADifferentMethod": "Вибрати інший спосіб",
    "verificationModal.waitingForTheOtherSideTo":
        "Очікування підтвердження від іншої сторони…",
    "verificationModal.verifyYourOtherSession": "Верифікувати ваш інший сеанс",
    "verificationModal.verify": "Верифікувати {value}",
    "verificationModal.couldNotConfirmTheMatch": "Не вдалося підтвердити збіг",
    "verificationModal.couldNotReportTheMismatch":
        "Не вдалося повідомити про розбіжність",
    "verificationModal.session": "у вашому іншому сеансі",

    // src/lib/components/layout/VideoTile.svelte
    "videoTile.fullscreen": "На весь екран",
    "videoTile.pictureInPicture": "Картинка в картинці",
    "videoTile.exitPictureInPicture": "Вийти з режиму «картинка в картинці»",

    // src/lib/components/settings/VoiceAudioSettings.svelte
    "voiceAudioSettings.inputDevice": "Пристрій введення",
    "voiceAudioSettings.savedMicrophoneNotFoundUsingThe":
        "Збережений мікрофон не знайдено - використовується типовий, доки він не повернеться.",
    "voiceAudioSettings.microphoneLevel": "Рівень мікрофона",
    "voiceAudioSettings.stopTest": "Зупинити тест",
    "voiceAudioSettings.testMic": "Перевірити мікрофон",
    "voiceAudioSettings.outputDevice": "Пристрій виведення",
    "voiceAudioSettings.chooseOutputDevice": "Виберіть пристрій виведення…",
    "voiceAudioSettings.audioOutputIsRoutedByThe":
        "Виведенням звуку на цій платформі керує операційна система.",
    "voiceAudioSettings.testSpeaker": "Перевірити динамік",
    "voiceAudioSettings.callVolume": "Гучність виклику",
    "voiceAudioSettings.incomingCallAudio": "Звук вхідного виклику",
    "voiceAudioSettings.incomingCallAudioIfThisMoves":
        "Звук вхідного виклику - якщо це рухається, а ви нічого не чуєте, перевірте вибраний пристрій виведення й системну гучність.",
    "voiceAudioSettings.voiceProcessing": "Обробка голосу",
    "voiceAudioSettings.noiseSuppression": "Шумозаглушення",
    "voiceAudioSettings.nsFastEnhancer": "FastEnhancer",
    "voiceAudioSettings.nsFastEnhancerHint":
        "Працює на вашому пристрої та постачається із застосунком, тож нічого завантажувати не потрібно. Невеликий і стабільний: тримає ваш голос на рівному рівні. Типовий.",
    "voiceAudioSettings.nsFastEnhancerUnsupported":
        "Цей браузер не може запустити FastEnhancer, тому натомість використовується RNNoise.",
    "voiceAudioSettings.nsFastEnhancerTiny": "FastEnhancer Tiny",
    "voiceAudioSettings.nsFastEnhancerTinyHint":
        "Менший FastEnhancer, що використовує приблизно третину процесора. Очищує трохи гірше; усе одно стабільніший за RNNoise.",
    "voiceAudioSettings.noiseSuppressionGpu": "Прискорення GPU",
    "voiceAudioSettings.noiseSuppressionGpuHint":
        "Виконує шумозаглушення на вашій відеокарті, щоб розвантажити процесор. Додає приблизно 11 мс затримки. Повертається до процесора, якщо ваш GPU не справляється.",
    "voiceAudioSettings.nsRnnoise": "RNNoise",
    "voiceAudioSettings.nsRnnoiseHint":
        "Працює на вашому пристрої та постачається із застосунком, тож нічого завантажувати не потрібно. Невеликий і стабільний: тримає ваш голос на рівному рівні.",
    "voiceAudioSettings.nsRnnoiseUnsupported":
        "Цей браузер не може запустити RNNoise, тому натомість використовується власне шумозаглушення браузера.",
    "voiceAudioSettings.nsDeepFilter": "DeepFilterNet3",
    "voiceAudioSettings.nsPluginHint":
        "Видалення шуму від плагіна, що працює на вашому пристрої. Там, де він не може працювати, натомість використовується FastEnhancer.",
    "voiceAudioSettings.nsPluginUnavailable":
        "Плагін для цього фільтра шуму не ввімкнено, тому натомість використовується FastEnhancer.",
    "voiceAudioSettings.nsPluginCantRun":
        "Цей фільтр шуму не може працювати на цьому пристрої, тому натомість використовується FastEnhancer.",
    "voiceAudioSettings.nsPluginUnsupported":
        "Цей браузер не може запускати плагіни фільтрів шуму, тому натомість використовується власне шумозаглушення браузера.",
    "voiceAudioSettings.nsPluginMissing": "Фільтр плагіна (не ввімкнено)",
    "voiceAudioSettings.nsBrowser": "Браузер",
    "voiceAudioSettings.nsOff": "Вимкнено",
    "voiceAudioSettings.nsDeepFilterHint":
        "Видалення шуму зі штучним інтелектом, що працює на вашому пристрої. Під час першого використання завантажує близько 11 МБ.",
    "voiceAudioSettings.nsDeepFilterUnsupported":
        "Цей браузер не може запустити DeepFilterNet3, тому натомість використовується власне шумозаглушення браузера.",
    "voiceAudioSettings.nsBrowserHint":
        "Вбудоване шумозаглушення вашого браузера. Воно прибирає лише рівномірний фоновий гул.",
    "voiceAudioSettings.nsOffHint":
        "Ваш мікрофон надсилається без видалення шуму.",
    "voiceAudioSettings.echoCancellation": "Усунення відлуння",
    "voiceAudioSettings.autoGainControl": "Автоматичне регулювання підсилення",
    "voiceAudioSettings.agcNormalize": "Нормалізація",
    "voiceAudioSettings.agcNormalizeHint":
        "Те саме вирівнювання гучності, яке отримують вхідні голоси, застосоване до вашого мікрофона після видалення шуму. Не змінює системну гучність мікрофона.",
    "voiceAudioSettings.agcZam": "AGC2",
    "voiceAudioSettings.agcBrowser": "Браузер",
    "voiceAudioSettings.agcOff": "Вимкнено",
    "voiceAudioSettings.agcZamHint":
        "AGC2 з WebRTC, що працює після видалення шуму. Вирівнює ваш голос, не змінюючи системну гучність мікрофона.",
    "voiceAudioSettings.agcBrowserHint":
        "Вбудований AGC вашого браузера. Він може змінювати системну гучність вашого мікрофона.",
    "voiceAudioSettings.agcOffHint":
        "Ваш мікрофон надсилається на рівні, який надає система.",
    "voiceAudioSettings.normalizeVoices": "Вирівнювати гучність голосів",
    "voiceAudioSettings.normalizeVoicesHint":
        "Автоматично підсилює тихих людей і приглушує гучних, щоб вам не доводилося налаштовувати гучність кожного вручну.",
    "voiceAudioSettings.pushToTalk": "Натисни й говори",
    "voiceAudioSettings.pushToTalkHint":
        "У викликах ваш мікрофон передає звук, лише поки утримується клавіша «натисни й говори».",
    "voiceAudioSettings.pushToTalkNoKey":
        "Щоб «натисни й говори» запрацювало, потрібна клавіша.",
    "voiceAudioSettings.pushToTalkSetKey": "Задати клавішу «натисни й говори»",
    "voiceAudioSettings.camera": "Камера",
    "voiceAudioSettings.cameraDisabled": "Вимкнено",
    "voiceAudioSettings.mirrorMyCamera": "Віддзеркалювати мою камеру",
    "voiceAudioSettings.flipYourOwnPreviewOthersAlways":
        "Віддзеркалює ваш власний попередній перегляд. Інші завжди бачать вас без віддзеркалення.",
    "voiceAudioSettings.cannotWatch": "Відео, яке я не можу переглянути",
    "voiceAudioSettings.cannotWatchHint":
        "Виберіть кодеки, що нічого не показують (або показують чорну картинку) на цьому пристрої. Тоді інші учасники виклику надсилатимуть вам H.264. Zam також заповнює це, коли потік надходить, але ніколи не декодується.",
    "voiceAudioSettings.videoCodec": "Відеокодек",
    "voiceAudioSettings.videoCodecHint":
        "У якому вигляді надсилаються ваша камера та показ екрана. «Автоматично» вибирає найкращий кодек, який кодує ваш GPU і який можуть відтворити всі учасники виклику. Той, хто не може його відтворити, отримує копію H.264, і її також можна перемкнути з виклику. Застосовується під час наступного їх увімкнення.",
    "voiceAudioSettings.videoCodecAuto": "Автоматично",
    "voiceAudioSettings.adaptiveStream": "Адаптивна якість відео",
    "voiceAudioSettings.adaptiveStreamHint":
        "Отримувати кожне відео в тому розмірі, в якому його показано, і призупиняти відео, якого немає на екрані або коли Zam згорнуто. Заощаджує пропускну здатність і декодування. Застосовується під час наступного приєднання до виклику.",
    "voiceAudioSettings.stopPreview": "Зупинити перегляд",
    "voiceAudioSettings.preview": "Попередній перегляд",
    "voiceAudioSettings.callSounds": "Звуки викликів",
    "voiceAudioSettings.playCallSounds": "Відтворювати звуки викликів",
    "voiceAudioSettings.soundVolume": "Гучність звуків",
    "voiceAudioSettings.ringing": "Дзвінок",
    "voiceAudioSettings.ringForIncomingDmCalls":
        "Дзвонити під час вхідних викликів в особистих чатах",
    "voiceAudioSettings.directMessagesRingRoomsNeverDo":
        "Особисті повідомлення дзвонять. Кімнати - ніколи: до них ви приєднуєтеся з самої кімнати.",
    "voiceAudioSettings.ringtoneVolume": "Гучність мелодії дзвінка",
    "voiceAudioSettings.fullScreenCalls":
        "Показувати виклики на екрані блокування",
    "voiceAudioSettings.fullScreenCallsHint":
        "Дозволяє вхідному виклику в особистому чаті розбудити екран і дзвонити на весь екран, як телефонний дзвінок. Android запитує це окремо.",
    "voiceAudioSettings.fullScreenCallsAllow": "Дозволити",
    "voiceAudioSettings.microphoneUnavailableCheckBrowserPermissions":
        "Мікрофон недоступний - перевірте дозволи браузера",
    "voiceAudioSettings.cameraUnavailableCheckBrowserPermissions":
        "Камера недоступна - перевірте дозволи браузера",

    // src/lib/components/layout/VoiceCallPanel.svelte
    "voiceCallPanel.enableAudio": "Увімкнути звук",
    "voiceCallPanel.openCallView": "Відкрити перегляд виклику",
    "voiceCallPanel.connectionStats": "Статистика з’єднання",
    "voiceCallPanel.openCall": "Відкрити виклик",
    "voiceCallPanel.openCallWithVideo":
        "Відкрити виклик ({n, plural, one {# відео} few {# відео} many {# відео} other {# відео}})",
    "voiceCallPanel.sharingYourScreen": "Ви показуєте свій екран",
    "voiceCallPanel.shareQuality": "Якість показу екрана",
    "voiceCallPanel.stop": "Зупинити",
    "callStats.title": "З’єднання виклику",
    "callStats.copyJson": "Копіювати як JSON",
    "callStats.copied": "Статистику виклику скопійовано",
    "callStats.copyFailed": "Не вдалося скопіювати",
    "callStats.loading": "Вимірювання...",
    "callStats.notInCall": "Не у виклику",
    "callStats.tcpWarning":
        "Медіа йде через TCP. Загублений пакет затримує все, що за ним, доки його не буде надіслано повторно, що проявляється як відставання звуку або розсинхронізація. Зазвичай це спричиняє брандмауер або мережа, що блокує UDP.",
    "callStats.serverSwitchedTcp":
        "Сервер викликів перемкнув вас на TCP: він більше не пропонує UDP цьому пристрою. Він робить так, коли UDP-з’єднання не вдається або обривається, поки сигналізація продовжує працювати, і запам’ятовує це для цього виклику, тож повторне приєднання з цього пристрою певний час залишається на TCP. Ваша мережа цілком може передавати UDP без проблем; це не те саме, що блокування брандмауером.",
    "callStats.serverCandidates": "Кандидати сервера",
    "callStats.serverCandidatesNoUdp": "Лише TCP (перемкнуто сервером)",
    "callStats.publishing": "публікація",
    "callStats.listening": "прослуховування",
    "callStats.signalRtt": "Пінг сигналізації",
    "callStats.yourQuality": "Ваше з’єднання",
    "callStats.sending": "Надсилання",
    "callStats.receiving": "Отримання",
    "callStats.participant": "Учасник",
    "callStats.theirQuality": "Їхнє з’єднання",
    "callStats.loss": "Втрати",
    "callStats.jitter": "Джитер",
    "callStats.buffer": "Буфер",
    "callStats.legend":
        "«Їхнє з’єднання» - це оцінка сервером каналу цієї людини, тож низька оцінка там вказує на їхню мережу, а не вашу. Втрати та джитер стосуються їхнього звуку, що доходить до вас, за останню секунду.",
    "callStats.noTransport": "Не підключено",
    "callStats.video": "Відео",
    "callStats.videoChecking": "Перевірка…",
    "callStats.videoSending": "Надсилається",
    "callStats.videoNotSending": "Ще не надсилається",
    "callStats.videoCaptureEnded": "Захоплення зупинено: запустіть його знову",
    "callStats.videoCaptureStalled":
        "Немає нових кадрів: показуване вікно може бути згорнуте чи перекрите, або камеру зайнято",
    "callStats.videoPlaying": "Відтворюється",
    "callStats.videoNotSubscribed": "Ще не отримується",
    "callStats.videoHiddenByYou": "Приховано вами",
    "callStats.videoTurnedOff": "Вимкнено ними",
    "callStats.videoPausedByServer":
        "Призупинено сервером викликів: ваше з’єднання зараз цього не витримує",
    "callStats.videoNoPackets":
        "Нічого не надходить: перевірте їхню сторону надсилання або ваше з’єднання",
    "callStats.videoCantDecrypt":
        "Надходить, але не розшифровується: хтось із вас може мати старішу версію Zam, або ключ не надійшов",
    "callStats.videoCantDecode":
        "Надходить, але цей пристрій не може його декодувати: спробуйте інший відеокодек у меню якості показу екрана",
    "callStats.videoNotShown":
        "Отримується, але не на екрані: відкрийте перегляд виклику, щоб дивитися",
    "callStats.videoNotPainting":
        "Декодується, але не малюється: спробуйте закрити й знову відкрити перегляд виклику",
    "callStats.capture": "Захоплення",
    "callStats.framesArrivedDecoded": "Кадри: надійшло / декодовано",
    "callStats.framesEncoded": "Закодовано кадрів",
    "callStats.onScreen": "На екрані",
    "callStats.onScreenNo": "Ні",
    "callStats.onScreenNoPicture": "Картинки ще немає",
    "callStats.decryptErrors": "Помилки розшифрування",
    "callStats.trackState": "Доріжка",
    "callStats.trackNoFrames": "Зараз немає кадрів",
    "callStats.proxyRoute": "Проксі",
    "callStats.routeSignalling": "З’єднання із сервером викликів",
    "callStats.routeSending": "Медіа, яке ви надсилаєте",
    "callStats.routeReceiving": "Медіа, яке ви отримуєте",
    "callStats.routeDirect": "Напряму",
    "callStats.routeProxy": "Через {proxy}",
    "callStats.path": "Шлях",
    "callStats.iceRtt": "Пінг ICE",
    "callStats.mediaRtt": "Пінг медіа",
    "callStats.upload": "Вивантаження",
    "callStats.download": "Завантаження",
    "callStats.availableUpload": "Доступне вивантаження",
    "callStats.outgoingLoss": "Втрати вихідних",
    "callStats.remoteAddress": "Адреса сервера",
    "callStats.candidates": "Кандидати",
    "callStats.pathUdp": "UDP (напряму)",
    "callStats.pathTcp": "TCP",
    "callStats.pathRelayUdp": "TURN-ретранслятор (UDP)",
    "callStats.pathRelayTcp": "TURN-ретранслятор (TCP)",
    "callStats.pathRelayTls": "TURN-ретранслятор (TLS)",
    "callStats.pathUnknown": "Невідомо",
    "callStats.qualityExcellent": "Відмінно",
    "callStats.qualityGood": "Добре",
    "callStats.qualityPoor": "Погано",
    "callStats.qualityLost": "Втрачено",
    "callStats.qualityUnknown": "Невідомо",
    "callStats.streams": "Медіапотоки",
    "callStats.you": "Ви",
    "callStats.sourceMicrophone": "Мікрофон",
    "callStats.sourceCamera": "Камера",
    "callStats.sourceScreenShare": "Показ екрана",
    "callStats.sourceScreenShareAudio": "Звук показу екрана",
    "callStats.sourceUnknown": "Інша доріжка",
    "callStats.sent": "надіслано",
    "callStats.received": "отримано",
    "callStats.layer": "шар {rid}",
    "callStats.codec": "Кодек",
    "callStats.codecOptions": "Параметри кодека",
    "callStats.bitrate": "Бітрейт",
    "callStats.bitrateTarget": "{rate} із макс. {target}",
    "callStats.packetDuration": "Звук у пакеті",
    "callStats.resolution": "Роздільна здатність",
    "callStats.encoder": "Кодувальник",
    "callStats.decoder": "Декодер",
    "callStats.hardware": "апаратний",
    "callStats.software": "програмний",
    "callStats.limitedBy": "Стримується через",
    "callStats.limitCpu": "процесор",
    "callStats.limitBandwidth": "пропускну здатність",
    "callStats.limitNone": "нічого",
    "callStats.limitOther": "інше",
    "callStats.frameTime": "Час на кадр",
    "callStats.resent": "Надіслано повторно",
    "callStats.droppedFrames": "Пропущені кадри",
    "callStats.nackPli": "NACK / PLI",
    "callStats.softwareEncodeHint":
        "Ваше відео кодується програмно, що навантажує процесор і може призводити до пропуску кадрів під навантаженням. «Налаштування» > «Налагодження» показує, чи доступне апаратне кодування відео (video_encode у розділі «Стан функцій»).",
    "callStats.cpuLimitHint":
        "Відеокодувальник знижує якість, бо процесор не справляється.",
    "voiceCallPanel.unmute": "Увімкнути мікрофон",
    "voiceCallPanel.undeafen": "Увімкнути звук",
    "voiceCallPanel.deafen": "Вимкнути звук",
    "voiceCallPanel.disconnect": "Відключитися",

    // src/lib/components/messages/VoiceMessagePlayer.svelte
    "voiceMessagePlayer.seek": "Перемотати",
    "voiceMessagePlayer.voiceMessage": "Голосове повідомлення",
    "midiPlayer.play": "Відтворити",
    "midiPlayer.pause": "Пауза",
    "midiPlayer.seek": "Позиція",
    "midiPlayer.volume": "Гучність",

    // src/lib/components/messages/VoiceRecorder.svelte
    "voiceRecorder.cancelRecording": "Скасувати запис",
    "voiceRecorder.stop": "Зупинити",
    "voiceRecorder.discard": "Відкинути",
    "voiceRecorder.discardRecording": "Відкинути запис",
    "voiceRecorder.voiceMessage": "Голосове повідомлення",
    "voiceRecorder.sending": "Надсилання…",
    "voiceRecorder.send": "Надіслати",
    "voiceRecorder.microphoneAccessWasDenied": "Доступ до мікрофона відхилено.",
    "voiceRecorder.recordingFailed": "Не вдалося записати.",
    "voiceRecorder.nothingWasRecorded": "Нічого не було записано.",
    "voiceRecorder.failedToSendVoiceMessage":
        "Не вдалося надіслати голосове повідомлення",

    // src/lib/components/settings/WhatsNew.svelte
    "whatsNew.whatSNew": "Що нового",
    "whatsNew.loadingReleaseNotes": "Завантаження приміток до випуску…",
    "whatsNew.releaseNotesUnavailable": "Примітки до випуску недоступні.",
    "whatsNew.viewOnGithub": "Переглянути на GitHub",

    // src/lib/components/layout/WhatsNewModal.svelte
    "whatsNewModal.whatSNew": "Що нового",
    "whatsNewModal.whatSNewSince": "Що нового від v{from}",
    "whatsNewModal.whatSNewInV": "Що нового у v{APP_VERSION}",
    "whatsNewModal.releaseNotesUnavailable": "Примітки до випуску недоступні.",
    "whatsNewModal.viewOnGithub": "Переглянути на GitHub",
    "whatsNewModal.gotIt": "Зрозуміло",

    // src/lib/components/layout/VerificationRequestCard.svelte
    "verificationRequestCard.verifyYourOtherSession":
        "Верифікувати ваш інший сеанс",
    "verificationRequestCard.verificationRequest": "Запит на верифікацію",
    "verificationRequestCard.anotherOfYourSessions": "Інший із ваших сеансів",

    // src/lib/components/messages/CallEventCard.svelte
    "callEventCard.missedCall": "Пропущений виклик",
    "callEventCard.ongoingCall": "Триваючий виклик",
    "callEventCard.callEnded": "Виклик завершено",

    // src/lib/components/messages/ComposerActionsMenu.svelte
    "composerActionsMenu.uploadAFile": "Вивантажити файл",
    "composerActionsMenu.camera": "Камера",
    "composerActionsMenu.photosAndVideos": "Фото та відео",
    "composerActionsMenu.files": "Файли",
    "composerActionsMenu.sendFileDirectly": "Надіслати файл напряму",
    "composerActionsMenu.createPoll": "Створити опитування",
    "composerActionsMenu.recordVoiceMessage": "Записати голосове повідомлення",
    "composerActionsMenu.shareLocation": "Поділитися місцезнаходженням",
    "composerActionsMenu.createThread": "Створити гілку",
    "composerActionsMenu.inviteToGame": "Запросити до гри",
    "gameInvite.title": "Запросити до гри",
    "gameInvite.game": "Гра",
    "gameInvite.note": "Примітка (необов'язково)",
    "gameInvite.notePlaceholder": "Напишіть щось…",
    "gameInvite.send": "Надіслати запрошення",
    "gameInvite.noGames":
        "Зараз немає запущеної гри Steam, до якої можна запросити.",
    "gameInvite.failedToSend": "Не вдалося надіслати запрошення.",
    "gameInvite.cardTitle": "Запрошення до гри",
    "gameInvite.sourceSteam": "Steam",
    "gameInvite.partySize": "{current} з {max} у групі",
    "gameInvite.confirmSteam": "Запустити {game} з аргументами: {connect}",
    "gameInvite.confirmLobby": "Приєднатися до лобі {game}",
    "gameInvite.joinGame": "Приєднатися до гри",
    "gameInvite.joinSent": "Запит на приєднання надіслано в гру.",
    "gameInvite.openInDesktop":
        "Відкрийте в настільному застосунку Zam, щоб приєднатися.",
    "gameInvite.joinUnsupported":
        "Приєднання до цієї гри на цьому комп'ютері не підтримується.",
    "gameInvite.joinInvalid": "Це запрошення недійсне.",
    "gameInvite.joinFailed": "Не вдалося приєднатися до гри.",

    // src/lib/components/messages/Reactions.svelte
    "reactions.couldNotAddReaction": "Не вдалося додати реакцію",

    // src/lib/components/ui/QrScanner.svelte
    "qrScanner.startingTheCamera": "Запуск камери…",
    "qrScanner.cameraAccessWasDenied": "Доступ до камери відхилено.",
    "qrScanner.noCameraWasFoundOnThis": "На цьому пристрої не знайдено камери.",
    "qrScanner.theCameraIsAlreadyInUse":
        "Камеру вже використовує інший застосунок.",
    "qrScanner.couldNotOpenTheCameraA":
        "Не вдалося відкрити камеру. Потрібне безпечне з’єднання (https).",
    "qrScanner.codeFoundCheckingIt": "Код знайдено - перевірка…",
    "qrScanner.couldNotStartVerificationWithThat":
        "Не вдалося розпочати верифікацію за цим кодом.",
    "qrScanner.thatIsnTAVerificationCode": "Це не код верифікації.",
    "qrScanner.thisDeviceHasNoCameraAvailable":
        "На цьому пристрої немає доступної камери.",
    "qrScanner.couldNotStartTheCameraPreview":
        "Не вдалося запустити попередній перегляд камери.",
    "qrScanner.pointTheCameraAtTheirCode": "Наведіть камеру на їхній код.",

    // src/lib/desktopContextMenu.ts
    "desktopContextMenu.failedToSaveImage": "Не вдалося зберегти зображення",

    // src/lib/matrix/client.ts
    "client.serverAutoDiscoveryFailedUsingThe":
        "Не вдалося автоматично виявити сервер - використовується адреса як введено",
    "client.discoveredHomeserverFailedValidation":
        "Виявлений домашній сервер не пройшов перевірку",
    "client.thisHomeserverDoesnTSupportSliding":
        "Цей домашній сервер не підтримує sliding sync, тому натомість використовується класична синхронізація.",
    "client.notLoggedIn": "Вхід не виконано",
    "client.creatorsNeedRoomV12":
        "Додаткові творці потребують кімнати версії 12 або новішої, а цей сервер її не пропонує.",
    "client.oauthProviderChanged":
        "Постачальник входу сервера змінився. Спробуйте ще раз.",
    "client.thisEventTypeCannotBeForwarded": "Цей тип події не можна переслати",
    "client.notConnected": "Не підключено",
    "client.thisServerDoesNotAllowSigning":
        "Цей сервер не дозволяє виходити із сеансів за допомогою пароля - скористайтеся його сторінкою облікового запису.",
    "client.incorrectPassword": "Неправильний пароль",
    "client.thisServerDoesNotAllowConfirming":
        "Цей сервер не дозволяє підтверджувати цю дію паролем - скористайтеся його сторінкою облікового запису.",
    "client.directMessages": "Особисті повідомлення",
    "client.messagesInDirectMessageRooms":
        "Повідомлення в кімнатах особистих повідомлень",
    "client.rooms": "Кімнати",
    "client.messagesInAllOtherRooms": "Повідомлення в усіх інших кімнатах",
    "client.fullMatrixIdMentions": "Згадки повним ID Matrix",
    "client.messagesUsingYourFullUserHomeserver":
        "Повідомлення з вашим повним ID @user:homeserver",
    "client.displayNameMentions": "Згадки показуваного імені",
    "client.messagesContainingYourDisplayName":
        "Повідомлення, що містять ваше показуване ім’я",
    "client.usernameMentions": "Згадки імені користувача",
    "client.messagesContainingYourUsernameWithoutServer":
        "Повідомлення, що містять ваше ім’я користувача (без сервера)",
    "client.roomMentions": "Згадки @room",
    "client.messagesUsingRoomToNotifyEveryone":
        "Повідомлення з @room, що сповіщають усіх",
    "client.invitations": "Запрошення",
    "client.whenYouAreInvitedToA": "Коли вас запрошують до кімнати",
    "client.thisRoom": "ця кімната",
    "client.keywordCannotStartWith": "Ключове слово не може починатися з «.»",
    "client.emotes": "{value}: емодзі",
    "client.room": "Кімната",
    "client.emojis": "Емодзі",
    "client.enterAShortcode": "Введіть короткий код.",
    "client.useOnlyLettersNumbersDotsUnderscores":
        "Використовуйте лише літери, цифри, крапки, підкреслення, плюси та дефіси.",
    "client.chooseAtLeastOneUsage": "Виберіть принаймні одне призначення.",
    "client.imageNotFound": "Зображення не знайдено.",
    "client.noPermissionToEditPack":
        "Ви не маєте дозволу редагувати цей набір.",
    "client.invalidPowerLevels": "Недійсні рівні прав: {shapeError}",
    "client.roomCreatorsPowerLevelCannotBe":
        "Рівень прав творців кімнати не можна задати в кімнатах v12",
    "client.restrictedJoinRequiresAtLeastOne":
        "Обмежене приєднання потребує принаймні одного батьківського простору",
    "client.orderMustBeAtMost50":
        "Порядок має містити щонайбільше 50 друкованих символів ASCII (від пробілу до ~)",
    "client.cannotSetSuggestedOnASpace":
        "Не можна задати рекомендацію для дочірнього елемента простору без via",
    "client.pollHasNoEventId": "Опитування не має ID події",
    "client.unsupportedPoll": "Непідтримуване опитування",
    "client.youCanTCloseThisPoll": "Ви не можете завершити це опитування",
    "client.microphoneDisconnectedSwitchedToTheDefault":
        "Мікрофон відключено - перемкнено на типовий пристрій",
    "client.cameraDisconnected": "Камеру відключено",
    "client.cameraIsDisabledInSettings":
        "Вашу камеру вимкнено в налаштуваннях «Голос і відео»",
    "client.unknownRoom": "Невідома кімната",
    "client.theServerRejectedItYouMay":
        "сервер відхилив це - можливо, ви не маєте дозволу приєднуватися до викликів у цій кімнаті",
    "client.callMembershipFailed":
        "Не вдалося стати учасником виклику: {detail}",
    "client.voiceServerRejectedTheJoin":
        "Голосовий сервер відхилив приєднання ({status})",
    "client.voiceCallDisconnected": "Голосовий виклик відключено",
    "client.couldNotReachCallServer":
        "Не вдалося підключитися до {server}, тож ви можете не чути деяких людей у цьому виклику.",
    "client.yourMicrophoneAppearsSilentCheckYour":
        "Ваш мікрофон, схоже, мовчить - перевірте пристрій введення",
    "client.audioDeviceError": "Помилка аудіопристрою: {message}",
    "client.couldnTSwitchToThatKept":
        "Не вдалося перемкнутися на цей пристрій ({what}) - залишено попередній",
    "client.couldnTSwitchToThatUsing":
        "Не вдалося перемкнутися на цей пристрій ({what}) - використовується типовий",
    "client.couldnTSwitchToThatPick":
        "Не вдалося перемкнутися на цей пристрій ({what}) - виберіть інший",
    "client.encryptedCallsUnsupported":
        "Цей виклик має наскрізне шифрування, а цей браузер не може шифрувати медіа виклику. Спробуйте свіжу версію Chrome, Firefox чи Safari або настільний застосунок.",
    "client.codecCouldNotBeDecoded":
        "Цей пристрій не може декодувати відео {codec}. Натомість запитується H.264.",
    "client.couldNotSwitchVideoCodec": "Не вдалося перемкнути відеокодек",
    "client.couldNotStartScreenShare": "Не вдалося розпочати показ екрана",
    "client.couldNotShareScreenAudio": "Показ екрана розпочато без його звуку",
    "client.couldnTChangeScreenShareQuality":
        "Не вдалося змінити якість показу екрана",
    "client.couldNotStartTheCameraCheck":
        "Не вдалося запустити камеру - перевірте дозволи",
    "client.couldnTApplyAudioProcessingChange":
        "Не вдалося застосувати зміну обробки звуку ({error})",
    "client.deviceNounMicrophone": "мікрофон",
    "client.deviceNounCamera": "камера",

    // src/lib/matrix/crypto.ts
    "crypto.couldNotStartTheEmojiCheck":
        "Не вдалося розпочати перевірку емодзі",
    "crypto.couldNotCancelTheVerification": "Не вдалося скасувати верифікацію",
    "crypto.noCodeAvailableTheOtherSide":
        "Код недоступний - інша сторона не може його просканувати.",
    "crypto.couldNotGenerateAQrCode": "Не вдалося згенерувати QR-код",
    "crypto.thatCodeDoesnTMatchThis": "Цей код не відповідає цій верифікації",
    "crypto.couldNotConfirmTheQrMatch": "Не вдалося підтвердити збіг QR-коду",
    "crypto.couldNotCancelTheQrMatch": "Не вдалося скасувати збіг QR-коду",
    "crypto.encryptionIsNotReadyOnThis": "Шифрування в цьому сеансі не готове",
    "crypto.roomIsNotEncrypted": "Ця кімната не зашифрована.",
    "crypto.roomKeyDiscarded":
        "Ваше наступне повідомлення тут використає новий ключ кімнати, яким знову поділяться з кожним сеансом у кімнаті.",
    "crypto.encryptionKeysUnchecked":
        "Не вдалося звірити ключі шифрування цього сеансу із сервером. Перевірте з’єднання й перезавантажте.",
    "crypto.encryptionDataLost":
        "Дані шифрування цього сеансу втрачено (очищено дані браузера або виконано перевстановлення), тому з нього вийшли, щоб інші не шифрували для ключів, яких він більше не має. Увійдіть знову.",
    "crypto.accountApprovalCancelled":
        "Схвалення на сторінці облікового запису скасовано.",
    "crypto.accountPasswordRequired":
        "Для підтвердження цього сервер потребує пароль вашого облікового запису.",
    "crypto.thisServerCanTConfirmEncryption":
        "Цей сервер не може підтвердити налаштування шифрування паролем - скористайтеся його сторінкою облікового запису.",
    "crypto.incorrectPassword": "Неправильний пароль",
    "crypto.failedToGenerateARecoveryKey":
        "Не вдалося згенерувати ключ відновлення",
    "crypto.yourOldRecoveryWasResetBut":
        "Ваше старе відновлення скинуто, але налаштувати нове не вдалося.",
    "crypto.thatKeyDoesnTMatchThis":
        "Цей ключ не відповідає резервній копії цього облікового запису на сервері.",
    "crypto.thatDoesnTLookLikeA":
        "Це не схоже на дійсний ключ відновлення. Перевірте на помилки й спробуйте знову.",
    "crypto.thisAccountHasNoRecoverySet":
        "Для цього облікового запису ще не налаштовано відновлення. Спершу налаштуйте відновлення в сеансі, який має ваші ключі.",
    "crypto.thatRecoveryKeyDoesnTMatch":
        "Цей ключ відновлення не відповідає цьому обліковому запису. Перевірте на помилки й спробуйте знову.",
    "crypto.thisAccountSRecoveryWasnT":
        "Відновлення цього облікового запису не було налаштовано з парольною фразою. Скористайтеся натомість ключем відновлення.",
    "crypto.couldnTUseYourPassphraseOn":
        "Не вдалося використати вашу парольну фразу на цьому пристрої. Спробуйте натомість ключ відновлення.",
    "crypto.thatPassphraseDoesnTMatchThis":
        "Ця парольна фраза не відповідає цьому обліковому запису. Перевірте на помилки й спробуйте знову.",

    // src/lib/matrix/media.ts
    "media.notLoggedIn": "Вхід не виконано",
    "media.failedToFetchAttachment": "Не вдалося отримати вкладення: {status}",
    "media.encryptedAttachmentHasAnInvalidUrl":
        "Зашифроване вкладення має недійсний URL",
    "media.failedToFetchEncryptedAttachment":
        "Не вдалося отримати зашифроване вкладення: {status}",

    // src/lib/matrix/pluginHost.ts
    "pluginHost.mediaWasUploadedByADifferent":
        "Медіа було вивантажено іншим обліковим записом",
    "pluginHost.notLoggedIn": "Вхід не виконано",
    "pluginHost.notConnected": "Не підключено",

    // src/lib/matrix/runtime.ts
    "runtime.notLoggedIn": "Вхід не виконано",

    // src/lib/plugins/builtins/double-tap-reply/index.ts
    "doubleTapReply.doubleTapSwipeActions": "Дії подвійного дотику та свайпу",
    "doubleTapReply.doubleTapAMessageToReply":
        "Двічі торкніться повідомлення, щоб відповісти, відреагувати чи відредагувати, або проведіть ним ліворуч, щоб відповісти / відредагувати.",
    "doubleTapReply.doubleTapYourMessages":
        "Подвійний дотик до ваших повідомлень",
    "doubleTapReply.nothing": "Нічого",
    "doubleTapReply.reaction": "Реакція",
    "doubleTapReply.reply": "Відповісти",
    "doubleTapReply.edit": "Редагувати",
    "doubleTapReply.doubleTapOtherMessages":
        "Подвійний дотик до чужих повідомлень",
    "doubleTapReply.reactionEmoji": "Емодзі реакції",
    "doubleTapReply.sentWhenADoubleTapAction":
        "Надсилається, коли дію подвійного дотику встановлено на «Реакція».",
    "doubleTapReply.swipeToReplyEdit": "Свайп для відповіді / редагування",
    "doubleTapReply.swipeAMessageLeftToReply":
        "Проведіть повідомлення ліворуч, щоб відповісти; проведіть своє далі, щоб відредагувати.",
    "doubleTapReply.failedToReact": "Не вдалося відреагувати",

    // src/lib/plugins/builtins/slash-fun/index.ts
    "slashFun.sendAnActionMessage": "Надіслати повідомлення про дію",
    "slashFun.appendToYourMessage":
        "Дописати ¯\\_(ツ)_/¯ до вашого повідомлення",
    "slashFun.appendToYourMessage2":
        "Дописати (╯°□°)╯︵ ┻━┻ до вашого повідомлення",
    "slashFun.appendToYourMessage3":
        "Дописати ┬─┬ ノ( ゜-゜ノ) до вашого повідомлення",
    "slashFun.appendToYourMessage4": "Дописати ( ͡° ͜ʖ ͡°) до вашого повідомлення",
    "slashFun.sendYourMessageAsASpoiler":
        "Надіслати ваше повідомлення як спойлер",
    "slashFun.sendYourMessageWithoutMarkdownFormatting":
        "Надіслати ваше повідомлення без форматування markdown",
    "slashFun.funSlashCommands": "Веселі слеш-команди",
    "slashFun.noveltySlashCommandsMeShrugTableflip":
        "Кумедні слеш-команди: /me, /shrug, /tableflip, /unflip, /lenny, /spoiler, /plain.",

    // src/lib/plugins/builtins/text-replacer/index.ts
    "textReplacer.textReplacer": "Заміна тексту",
    "textReplacer.applyYourOwnStringOrRegex":
        "Застосовувати ваші власні заміни рядків чи регулярних виразів до тексту вихідних повідомлень.",
    "textReplacer.replacementRules": "Правила заміни",
    "textReplacer.appliedToYourOutgoingMessageText":
        "Застосовуються до тексту ваших вихідних повідомлень по порядку. Отримувачі бачать звичайний текст.",
    "textReplacer.find": "Знайти",
    "textReplacer.textOrPattern": "текст або шаблон",
    "textReplacer.replaceWith": "Замінити на",
    "textReplacer.regex": "Регулярний вираз",
    "textReplacer.ignoreCase": "Ігнорувати регістр",
    "previewRewriter.name": "Перезапис попереднього перегляду посилань",
    "previewRewriter.description":
        "Отримувати попередній перегляд посилань з іншої адреси, наприклад із дзеркала сайту, до якого ваш домашній сервер не може достукатися.",
    "previewRewriter.rules": "Правила перезапису",
    "previewRewriter.rulesDescription":
        "Застосовуються по порядку до адреси, з якої отримується попередній перегляд. Саме посилання не змінюється.",

    // src/lib/plugins/pluginBoot.ts
    "pluginBoot.noPluginSyncDataOnYour":
        "У вашому обліковому записі ще немає даних синхронізації плагінів.",
    "pluginBoot.theSyncDataOnYourAccount":
        "Дані синхронізації у вашому обліковому записі пошкоджені.",
    "pluginBoot.autoUpdateFailed": "Не вдалося автоматично оновити: {value}",

    // src/lib/plugins/pluginPin.ts
    "pluginPin.pluginIdMismatchIndexListsManifest":
        "Невідповідність ID плагіна: індекс перелічує «{entryId}», маніфест оголошує «{manifestId}»",
    "pluginPin.cannotInstallPluginWithIdIt":
        "Не можна встановити плагін з ID «{manifestId}»: це вбудований плагін",
    "pluginPin.pluginIsAlreadyInstalledFromA":
        "Плагін «{manifestId}» уже встановлено з іншого репозиторію",

    // src/lib/plugins/repo.ts
    "repo.repoReferenceMustBeAString":
        "Посилання на репозиторій має бути рядком",
    "repo.repoReferenceCannotBeEmpty":
        "Посилання на репозиторій не може бути порожнім",
    "repo.branchCannotBeEmpty": "Гілка не може бути порожньою",
    "repo.branchCannotContain": "Гілка не може містити '..'",
    "repo.invalidRepoReferenceExtraPathSegments":
        "Недійсне посилання на репозиторій: зайві сегменти шляху (не /tree/<гілка>)",
    "repo.invalidRepoReferenceMustBeOwner":
        "Недійсне посилання на репозиторій: має бути owner/repo",
    "repo.ownerCannotBeEmpty": "Власник не може бути порожнім",
    "repo.invalidOwnerMustMatchAZa":
        "Недійсний власник: має відповідати [A-Za-z0-9][A-Za-z0-9._-]*",
    "repo.repoCannotBeEmpty": "Репозиторій не може бути порожнім",
    "repo.invalidRepoMustMatchAZa":
        "Недійсний репозиторій: має відповідати [A-Za-z0-9][A-Za-z0-9._-]*",

    // src/lib/plugins/repoList.ts
    "repoList.enterARepoOwnerRepoOr":
        "Введіть репозиторій (owner/repo або URL GitHub).",
    "repoList.thatIsTheOfficialRepoAlready":
        "Це офіційний репозиторій (уже включений).",
    "repoList.thatRepoIsAlreadyAdded": "Цей репозиторій уже додано.",

    // src/lib/stores/gifSearch.svelte.ts
    "gifSearch.couldNotLoadGifsTryAgain":
        "Не вдалося завантажити GIF, спробуйте ще раз.",
    "gifSearch.couldnTReachKlipyTryAgain":
        "Не вдалося зв’язатися з KLIPY - спробуйте ще раз.",

    // src/lib/stores/liveLocation.svelte.ts
    "liveLocation.youCanTShareLiveLocation":
        "Ви не можете ділитися місцезнаходженням наживо в цій кімнаті.",
    "liveLocation.couldnTStartLiveLocation":
        "Не вдалося розпочати показ місцезнаходження наживо",
    "liveLocation.expired": "Закінчилося",
    "liveLocation.lessThanAMinuteLeft": "залишилося менше хвилини",
    "liveLocation.minLeft": "залишилося {totalMin} хв",
    "liveLocation.hLeft": "залишилося {h} год",
    "liveLocation.hMinLeft": "залишилося {h} год {m} хв",
    "liveLocation.justNow": "щойно",
    "liveLocation.sAgo": "{floor} с тому",
    "liveLocation.minAgo": "{floor} хв тому",
    "liveLocation.hAgo": "{floor} год тому",
    "liveLocation.n15Minutes": "15 хвилин",
    "liveLocation.n1Hour": "1 година",
    "liveLocation.n8Hours": "8 годин",

    // src/lib/stores/outbox.svelte.ts
    "outbox.failedToSend": "Не вдалося надіслати",

    // src/lib/stores/settings.svelte.ts
    "settings.couldNotReadThatFile": "Не вдалося прочитати цей файл.",
    "settings.thatFileIsnTAValid": "Цей файл не є дійсним шрифтом.",
    "settings.fontCouldnTBeSavedOn":
        "Не вдалося зберегти шрифт на цьому пристрої.",
    "settings.cannotSaveAPresetWithBuilt":
        "Не можна зберегти шаблон із вбудованою назвою: {name}",

    // src/lib/stores/shareInbox.svelte.ts
    "shareInbox.youReOfflineTheShareWas":
        "Ви поза мережею: надсилання додано до поля введення",
    "shareInbox.couldnTSendTheShare": "Не вдалося надіслати",

    // src/lib/stores/verification.svelte.ts
    "verification.finishingAnotherVerificationFirstTryAgain":
        "Спершу завершується інша верифікація. Спробуйте ще раз.",
    "verification.waitingForTheOtherSideTo":
        "Очікування, поки інша сторона прийме…",
    "verification.acceptedSettingUpTheCheck":
        "Прийнято - підготовка перевірки…",
    "verification.verifying": "Верифікація…",
    "verification.sessionVerified": "Сеанс верифіковано",
    "verification.userVerified": "Користувача верифіковано",
    "verification.verificationCancelled": "Верифікацію скасовано",
    "verification.verified": "Верифіковано",
    "verification.unverified": "Не верифіковано",
    "verification.signedByYou": "Підписано вами",
    "verification.notSignedByOwner": "Не підписано власником",
    "verification.verifyWithAnotherDevice": "Верифікувати іншим пристроєм",
    "verification.useAnotherDevice": "Використати інший пристрій",
    "verification.couldNotSendVerificationRequest":
        "Не вдалося надіслати запит на верифікацію",
    "verification.sessionNotKnownYet":
        "Цей сеанс ще не знає про той. Зачекайте кілька секунд і спробуйте знову або розпочніть верифікацію з нового сеансу.",
    "verification.accountHasNoIdentity":
        "Ключів перехресного підписування вашого облікового запису немає на сервері, тож інші ваші сеанси не можуть верифікувати цей. Відкрийте «Налаштування» > «Безпека та шифрування» в сеансі, де ви налаштовували відновлення: якщо там пропонується вивантажити ваші ключі, зробіть це. Якщо ви ніколи не налаштовували відновлення, налаштуйте його в будь-якому сеансі.",
    "verification.sessionHasNoKeys":
        "Цей сеанс не опублікував своїх ключів шифрування, тож його неможливо верифікувати, і він не може отримувати зашифровані повідомлення. Вийдіть із нього й увійдіть знову.",
    "verification.sessionKeysRejected":
        "Ключі шифрування того сеансу було відхилено цим сеансом. Вийдіть із нього й увійдіть знову.",
    "verification.identityChanged": "Ідентичність змінилася",
    "verification.couldnTAcceptThisRequestTry":
        "Не вдалося прийняти цей запит. Спробуйте ще раз.",

    // src/lib/stores/voiceCall.svelte.ts
    "voiceCall.couldnTLoadTheCallComponent":
        "Не вдалося завантажити компонент виклику. Перевірте з’єднання, а потім перезавантажте сторінку, щоб спробувати знову.",
    "voiceCall.couldNotJoinTheVoiceCall":
        "Не вдалося приєднатися до голосового виклику",
    "voiceCall.joinedWithoutAMicrophone":
        "Ваш мікрофон недоступний - ви все одно можете слухати й показувати свій екран",
    "voiceCall.couldNotMuteYourMicrophone": "Не вдалося вимкнути ваш мікрофон",
    "voiceCall.couldNotUnmuteYourMicrophoneCheck":
        "Не вдалося увімкнути ваш мікрофон - перевірте пристрій введення",
    "voiceCall.connecting": "З’єднання…",
    "voiceCall.startedSharing": "{name} показує свій екран",
    "voiceCall.watch": "Дивитися",
    "voiceCall.voiceConnected": "Голос підключено",
    "voiceCall.reconnecting": "Повторне з’єднання…",
    "voiceCall.gpuGivenUp":
        "Графіка постійно збоїла, тож GPU вимкнено до перезапуску Zam, а відео кодується програмно.",
    "voiceCall.gpuRecovered":
        "Графіку перезапущено, тож виклик перепідключився, щоб відео й далі кодувалося на GPU.",
    "voiceCall.restartZam": "Перезапустити Zam",
    "voiceCall.youWereBannedFromThisRoom":
        "Вас заблоковано в цій кімнаті - виклик завершено",
    "voiceCall.youLeftThisRoomCallEnded":
        "Ви вийшли з цієї кімнати - виклик завершено",
    "voiceCall.youWereRemovedFromThisRoom":
        "Вас вилучено з цієї кімнати - виклик завершено",

    // src/lib/update.ts
    "update.noReleasesFoundYet": "Випусків ще не знайдено.",
    "update.githubApiError": "Помилка API GitHub ({status}).",
    "update.staleBuild":
        "Ця вебверсія ({current}) старіша за останній випуск ({latest}). Можливо, сервер ще не встиг оновитися; спробуйте знову за кілька хвилин.",
    "update.couldNotReadTheLatestVersion":
        "Не вдалося прочитати останню версію.",

    // src/lib/utils/accountSecurity.ts
    "accountSecurity.enterYourCurrentPassword": "Введіть поточний пароль.",
    "accountSecurity.enterANewPassword": "Введіть новий пароль.",
    "accountSecurity.newPasswordMustBeAtLeast":
        "Новий пароль має містити щонайменше 8 символів.",
    "accountSecurity.newPasswordMustBeDifferentFrom":
        "Новий пароль має відрізнятися від поточного.",
    "accountSecurity.passwordsDoNotMatch": "Паролі не збігаються.",

    // src/lib/utils/activeSession.ts
    "activeSession.offAlwaysNotify": "Вимкнено - завжди сповіщати",
    "activeSession.n15Seconds": "15 секунд",
    "activeSession.n30Seconds": "30 секунд",
    "activeSession.n1Minute": "1 хвилина",
    "activeSession.n2Minutes": "2 хвилини",
    "activeSession.n5Minutes": "5 хвилин",
    "activeSession.n10Minutes": "10 хвилин",
    "activeSession.n30Minutes": "30 хвилин",
    "activeSession.enterANumberOfMinutes": "Введіть кількість хвилин.",
    "activeSession.chooseAtLeast1MinuteUse":
        "Виберіть щонайменше 1 хвилину - для коротших проміжків скористайтеся списком вище.",
    "activeSession.chooseMinutes2HoursOrLess":
        "Виберіть {MAX_CUSTOM_GRACE_MINUTES} хвилин (2 години) або менше.",

    // src/lib/utils/audioDevices.ts
    "audioDevices.microphone": "Мікрофон",
    "audioDevices.speaker": "Динамік",
    "audioDevices.camera": "Камера",

    // src/lib/utils/audioPlayback.ts
    "audioPlayback.failedToLoadRetry": "Не вдалося завантажити · Повторити",
    "audioPlayback.clickToPlay": "Клацніть, щоб відтворити",

    // src/lib/utils/clientGeneration.ts
    "clientGeneration.sessionChangedBeforeTheOperationFinished":
        "Сеанс змінився до завершення операції",

    // src/lib/utils/customFont.ts
    "customFont.useAWoff2TtfOrOtf":
        "Використайте файл шрифту .woff2, .ttf або .otf.",
    "customFont.thatFontFileIsEmpty": "Цей файл шрифту порожній.",
    "customFont.fontFileIsTooLargeMax": "Файл шрифту завеликий (макс. 10 МБ).",
    "customFont.customFont": "Власний шрифт",

    // src/lib/utils/deviceSessions.ts
    "deviceSessions.unknown": "Невідомо",
    "deviceSessions.justNow": "Щойно",
    "deviceSessions.desktopApp": "Настільний застосунок",
    "deviceSessions.on": "{client} на {os}",
    "deviceSessions.minutesAgo":
        "{count, plural, one {# хвилину тому} few {# хвилини тому} many {# хвилин тому} other {# хвилини тому}}",
    "deviceSessions.hoursAgo":
        "{count, plural, one {# годину тому} few {# години тому} many {# годин тому} other {# години тому}}",
    "deviceSessions.daysAgo":
        "{count, plural, one {# день тому} few {# дні тому} many {# днів тому} other {# дня тому}}",

    // src/lib/utils/displaySources.ts
    "displaySources.screen": "Екран",
    "displaySources.untitledWindow": "Вікно без назви",

    // src/lib/utils/encryptionState.ts
    "encryptionState.unableToDecryptYouMayNot":
        "Не вдалося розшифрувати - можливо, у вас немає ключів до цього повідомлення.",
    "encryptionState.theSenderChoseNotToShare":
        "Відправник вирішив не ділитися ключами до цього повідомлення.",
    "encryptionState.theSenderDidNotShareThe":
        "Відправник не поділився ключами, бо цей пристрій не верифіковано. Верифікуйте цей пристрій, щоб читати такі повідомлення.",
    "encryptionState.senderDeviceNotCrossSigned":
        "Пристрій відправника не підписано перехресно його власником, тому це повідомлення приховано. Попросіть його верифікувати той сеанс.",
    "encryptionState.senderDeviceUnknown":
        "Це повідомлення не вдається зв’язати з жодним відомим пристроєм відправника, тому його приховано.",
    "encryptionState.senderIdentityChanged":
        "Ідентичність відправника змінилася після того, як ви його верифікували, тому це повідомлення приховано. Верифікуйте його знову, щоб прочитати.",
    "encryptionState.historicalNoBackup":
        "Це повідомлення було надіслано до того, як цей пристрій ввійшов, і резервної копії ключів, з якої його можна відновити, немає.",
    "encryptionState.historicalBackupUnconfigured":
        "Це повідомлення було надіслано до того, як цей пристрій ввійшов. Введіть ключ відновлення, щоб відновити його з резервної копії ключів.",
    "encryptionState.historicalWorkingBackup":
        "Це повідомлення було надіслано до того, як цей пристрій ввійшов, і його не знайдено у вашій резервній копії ключів.",
    "encryptionState.historicalNotJoined":
        "Це повідомлення було надіслано, коли вас не було в кімнаті.",
    "encryptionState.encryptedMessage": "🔒 Зашифроване повідомлення",

    // src/lib/utils/eventShield.ts
    "eventShield.thisMessageSEncryptionCouldNot":
        "Шифрування цього повідомлення не вдалося повністю перевірити.",
    "eventShield.encryptedByAnUnverifiedUser":
        "Зашифровано неверифікованим користувачем.",
    "eventShield.encryptedByADeviceNotVerified":
        "Зашифровано пристроєм, не верифікованим його власником.",
    "eventShield.encryptedByAnUnknownOrDeleted":
        "Зашифровано невідомим або видаленим пристроєм.",
    "eventShield.theAuthenticityOfThisEncryptedMessage":
        "Автентичність цього зашифрованого повідомлення не можна гарантувати на цьому пристрої.",
    "eventShield.theSenderWasPreviouslyVerifiedBut":
        "Відправника було верифіковано раніше, але він змінив свою ідентичність.",
    "eventShield.theSenderDoesnTMatchThe":
        "Відправник не збігається з власником пристрою, що надіслав це повідомлення.",

    // src/lib/utils/extendedProfile.ts
    "extendedProfile.aStatusNeedsBothAnEmoji":
        "Статус потребує і емодзі, і тексту.",
    "extendedProfile.inACall": "У виклику",
    "extendedProfile.inACallForMin": "У виклику {minutes} хв",
    "extendedProfile.inACallForH": "У виклику {hours} год",
    "extendedProfile.other": "Інше",
    "extendedProfile.atMostLinks": "Щонайбільше посилань: {MAX_CONNECTIONS}.",
    "extendedProfile.linksMustBeHttpHttpsMailto":
        "Посилання мають бути адресами http, https, mailto або matrix.",
    "extendedProfile.inACallForHMin": "У виклику {hours} год {minutes} хв",

    // src/lib/utils/geoErrors.ts
    "geoErrors.locationNeedsASecureHttpsConnection":
        "Для місцезнаходження потрібне безпечне з’єднання (HTTPS) - відкрийте застосунок через https.",
    "geoErrors.locationPermissionWasDeniedCheckSite":
        "Дозвіл на місцезнаходження відхилено - перевірте дозволи сайту.",
    "geoErrors.yourPositionIsUnavailableLocationOff":
        "Ваше розташування недоступне (визначення місцезнаходження вимкнено або немає сигналу GPS).",
    "geoErrors.timedOutGettingYourLocation":
        "Час очікування визначення місцезнаходження вичерпано.",
    "geoErrors.couldnTGetYourLocation":
        "Не вдалося визначити ваше місцезнаходження.",
    "geoErrors.locationIsnTAvailableInThis":
        "Визначення місцезнаходження недоступне в цьому браузері.",

    // src/lib/utils/joinRules.ts
    "joinRules.onlyAvailableForRoomsInsideA":
        "Доступно лише для кімнат усередині простору",
    "joinRules.thisRoomSVersionDoesnT":
        "Версія цієї кімнати не підтримує приєднання, обмежене простором",

    // src/lib/utils/keyBackup.ts
    "keyBackup.preparing": "Підготовка…",
    "keyBackup.fetchingYourEncryptedHistory":
        "Отримання вашої зашифрованої історії…",
    "keyBackup.restoringYourEncryptedHistory":
        "Відновлення вашої зашифрованої історії…",
    "keyBackup.restoringOfKeys": "Відновлення ключів: {successes} з {total}…",
    "keyBackup.noEncryptedHistoryToRestore":
        "Немає зашифрованої історії для відновлення",
    "keyBackup.restored":
        "{count, plural, one {Відновлено # ключ} few {Відновлено # ключі} many {Відновлено # ключів} other {Відновлено # ключа}}",
    "keyBackup.ofKeysRestored": "Відновлено ключів: {imported} з {total}",
    "keyBackup.notSetUp": "Не налаштовано",
    "keyBackup.notTrusted": "Не довірено",
    "keyBackup.notConnected": "Не підключено",
    "keyBackup.on": "Увімкнено",
    "keyBackup.encryptedMessageHistoryIsnTBeing":
        "Історія зашифрованих повідомлень не зберігається в резервній копії. Налаштуйте відновлення, щоб її захистити.",
    "keyBackup.aBackupExistsOnTheServer":
        "Резервна копія є на сервері, але цей сеанс їй ще не довіряє.",
    "keyBackup.aBackupExistsButThisSession":
        "Резервна копія є, але цей сеанс до неї не підключено. Введіть ключ відновлення, щоб відновити вашу історію.",
    "keyBackup.messageHistoryIsBeingBackedUp":
        "Історія повідомлень зберігається в резервній копії (v{version}).",
    "keyBackup.messageHistoryIsBeingBackedUp2":
        "Історія повідомлень зберігається в резервній копії.",
    "keyBackup.noKeysBackedUpYet": "Ключів у резервній копії ще немає",
    "keyBackup.backedUp":
        "{count, plural, one {# ключ у резервній копії} few {# ключі в резервній копії} many {# ключів у резервній копії} other {# ключа в резервній копії}}",
    "keyBackup.stillToUpload":
        "{count, plural, one {# ключ ще потрібно вивантажити} few {# ключі ще потрібно вивантажити} many {# ключів ще потрібно вивантажити} other {# ключа ще потрібно вивантажити}}",
    "keyBackup.everythingOnThisSessionIsBacked":
        "Усе в цьому сеансі збережено в резервній копії",
    "keyBackup.notSet": "Не задано",
    "keyExportSettings.exportOrImportRoomKeys":
        "Експорт або імпорт ключів кімнат",
    "keyExportSettings.aKeyFileLetsAnotherApp":
        "Файл ключів дозволяє іншому застосунку Matrix або новому сеансу читати вашу історію зашифрованих повідомлень. Зберігайте файл і його парольну фразу в надійному місці: будь-хто, хто має і те, і те, може читати ваші повідомлення.",
    "keyExportSettings.export": "Експорт",
    "keyExportSettings.import": "Імпорт",
    "keyExportSettings.passphrase": "Парольна фраза",
    "keyExportSettings.confirmPassphrase": "Підтвердьте парольну фразу",
    "keyExportSettings.passphrasesDontMatch": "Парольні фрази не збігаються",
    "keyExportSettings.exportKeys": "Експортувати ключі",
    "keyExportSettings.exporting": "Експорт…",
    "keyExportSettings.exported":
        "{count, plural, one {Експортовано # ключ} few {Експортовано # ключі} many {Експортовано # ключів} other {Експортовано # ключа}}",
    "keyExportSettings.couldNotExportYourKeys":
        "Не вдалося експортувати ваші ключі",
    "keyExportSettings.keyFile": "Файл ключів",
    "keyExportSettings.importKeys": "Імпортувати ключі",
    "keyExportSettings.wrongPassphrase":
        "Неправильна парольна фраза, або файл було змінено",
    "keyExportSettings.notAKeyFile": "Це не файл ключів, або він пошкоджений",
    "keyExportSettings.newerFormat":
        "Цей файл ключів створено новішим застосунком, і його не можна прочитати тут",
    "keyExportSettings.couldNotImportTheKeys": "Не вдалося імпортувати ключі",

    // src/lib/utils/keywordRules.ts
    "keywordRules.keywordCannotBeEmpty": "Ключове слово не може бути порожнім",
    "keywordRules.keywordCannotStartWith":
        "Ключове слово не може починатися з «.»",
    "keywordRules.youAlreadyHaveARuleFor":
        "У вас уже є правило для цього ключового слова",

    // src/lib/utils/liveAnnouncer.ts
    "liveAnnouncer.messageFrom": "Повідомлення від {sender}",
    "liveAnnouncer.newMessagesFrom":
        "{count, plural, one {# нове повідомлення від {sender}} few {# нові повідомлення від {sender}} many {# нових повідомлень від {sender}} other {# нового повідомлення від {sender}}}",
    "liveAnnouncer.newMessages":
        "{count, plural, one {# нове повідомлення} few {# нові повідомлення} many {# нових повідомлень} other {# нового повідомлення}}",

    // src/lib/utils/liveShareStop.ts
    "liveShareStop.couldnTStopSharingYourLive":
        "Не вдалося зупинити показ вашого місцезнаходження наживо - воно й досі видиме цій кімнаті. Скористайтеся «Повторити зупинку», щоб спробувати знову.",
    "liveShareStop.stopping": "Зупинка…",
    "liveShareStop.stillSharingCouldnTStop":
        "Показ триває - не вдалося зупинити",
    "liveShareStop.youReAlreadySharingYourLive":
        "Ви вже ділитеся своїм місцезнаходженням наживо в цій кімнаті.",
    "liveShareStop.yourLastLiveLocationShareHere":
        "Ваш попередній показ місцезнаходження наживо тут ще не зупинено - зупиніть його через банер кімнати, перш ніж розпочинати новий.",
    "liveShareStop.stop": "Зупинити",
    "liveShareStop.retryStop": "Повторити зупинку",

    // src/lib/utils/location.ts
    "location.location": "Місцезнаходження",

    // src/lib/utils/mediaGallery.ts
    "mediaGallery.of": "{value} з {length}{value2}",

    // src/lib/utils/messageActionsMenu.ts
    "messageActionsMenu.edit": "Редагувати",
    "messageActionsMenu.unpin": "Відкріпити",
    "messageActionsMenu.pin": "Закріпити",
    "messageActionsMenu.copyLink": "Копіювати посилання",
    "messageActionsMenu.report": "Поскаржитися",

    // src/lib/utils/messageDisplay.ts
    "messageDisplay.systemDefault": "Системний типовий",

    // src/lib/utils/micErrorMessage.ts
    "micErrorMessage.microphoneAccessIsBlockedAllowIt":
        "Доступ до мікрофона заблоковано - дозвольте його в налаштуваннях браузера чи системи, щоб говорити",
    "micErrorMessage.noMicrophoneFoundConnectOneOr":
        "Мікрофон не знайдено - підключіть його або виберіть інший пристрій введення, щоб говорити",
    "micErrorMessage.couldNotOpenYourMicrophoneAnother":
        "Не вдалося відкрити ваш мікрофон - можливо, його використовує інший застосунок",

    // src/lib/utils/mutePowerLevel.ts
    "mutePowerLevel.enterAPowerLevel": "Введіть рівень прав",
    "mutePowerLevel.mustBeAWholeNumber": "Має бути цілим числом",
    "mutePowerLevel.useToMute":
        "Використовуйте {MUTE_POWER_LEVEL}, щоб заглушити",
    "mutePowerLevel.youCanTSetALevel":
        "Ви не можете задати рівень, вищий за власний ({ceiling})",

    // src/lib/utils/notifActions.ts
    "notifActions.reply": "Відповісти",
    "notifActions.reply2": "Відповісти…",
    "notifActions.markAsRead": "Позначити прочитаним",

    // src/lib/utils/notificationPrivacy.ts
    "notificationPrivacy.sentAMessage": "надіслав(-ла) повідомлення",
    "notificationPrivacy.newMessage": "Нове повідомлення",

    // src/lib/utils/notifyPermission.ts
    "notifyPermission.notificationsAreBlockedSoIncomingCalls":
        "Сповіщення заблоковано, тож вхідні виклики не сповіщатимуть вас, коли це вікно приховано. Розблокуйте сповіщення в системних налаштуваннях.",
    "notifyPermission.thisBrowserCanTShowCall":
        "Цей браузер не може показувати сповіщення про виклики, коли вікно приховано.",

    // src/lib/utils/pollContent.ts
    "pollContent.addAQuestion": "Додайте питання.",
    "pollContent.addAtLeastTwoOptions": "Додайте щонайменше два варіанти.",
    "pollContent.atMostOptions": "Щонайбільше варіантів: {MAX_ANSWERS}.",
    "pollContent.invalidNumberOfSelections": "Недійсна кількість виборів.",
    "pollContent.thePollHasEnded": "Опитування завершилося.",

    // src/lib/utils/powerLevels.ts
    "powerLevels.enterAPowerLevel": "Введіть рівень прав",
    "powerLevels.mustBeAWholeNumber": "Має бути цілим числом",
    "powerLevels.mustBe0OrHigher": "Має бути 0 або більше",
    "powerLevels.youCanTSetALevel":
        "Ви не можете задати рівень, вищий за власний ({ceiling})",

    // src/lib/utils/presence.ts
    "presence.online": "У мережі",
    "presence.away": "Відійшов(-ла)",
    "presence.offline": "Поза мережею",
    "presence.seenAsOnlineWhileTheApp":
        "Показується як «у мережі», поки застосунок синхронізується",
    "presence.shownAsIdleToOtherUsers":
        "Показується іншим користувачам як неактивний",
    "presence.doNotDisturb": "Не турбувати",
    "presence.doNotDisturbDescription":
        "Вимикає сповіщення та дзвінки на всіх ваших пристроях",
    "presence.invisible": "Невидимий",
    "presence.appearOfflineToOtherUsers":
        "Показуватися іншим користувачам поза мережею",

    // src/lib/utils/pushRuleWrite.ts
    "pushRuleWrite.yourHomeserverHasNoNotificationRule":
        "Ваш домашній сервер не має правила сповіщень «{label}», тож його неможливо змінити.",
    "pushRuleWrite.yourHomeserverRejectedTheChangeTo":
        "Ваш домашній сервер відхилив зміну сповіщень «{label}».",
    "pushRuleWrite.notificationsDidNotChangeOnYour":
        "Сповіщення «{label}» не змінилися на вашому домашньому сервері.",
    "pushRuleWrite.couldNotSaveNotificationsCheckYour":
        "Не вдалося зберегти сповіщення «{label}». Перевірте з’єднання та спробуйте знову.",

    // src/lib/utils/pusherVerification.ts
    "pusherVerification.noGatewayUrl": "(немає URL шлюзу)",

    // src/lib/utils/recoveryPassphrase.ts
    "recoveryPassphrase.enterAPassphrase": "Введіть парольну фразу.",
    "recoveryPassphrase.useAtLeastCharacters":
        "Використайте щонайменше {MIN_PASSPHRASE_LENGTH} символів.",

    // src/lib/utils/reportMessage.ts
    "reportMessage.failedToSendReport": "Не вдалося надіслати скаргу",

    // src/lib/utils/roomAliases.ts
    "roomAliases.enterAnAddress": "Введіть адресу.",
    "roomAliases.addressesCannotContainSpaces":
        "Адреси не можуть містити пробілів.",
    "roomAliases.addressesCannotContain": "Адреси не можуть містити «:».",
    "roomAliases.addressesCannotContain2": "Адреси не можуть містити «#».",
    "roomAliases.addressesCannotContainControlCharacters":
        "Адреси не можуть містити керівних символів.",
    "roomAliases.addressIsTooLongMaxCharacters":
        "Адреса задовга (макс. {MAX_ALIAS_LENGTH} символів).",
    "roomAliases.thatAddressAlreadyExists": "Ця адреса вже існує.",

    // src/lib/utils/roomCreationOutcome.ts
    "roomCreationOutcome.theServerRejectedTheChange": "сервер відхилив зміну",
    "roomCreationOutcome.theRoomWasCreatedButAdding":
        "Кімнату створено, але додати її до простору не вдалося: {detailSentence}",
    "roomCreationOutcome.theDirectMessageWasCreatedBut":
        "Особисте повідомлення створено, але зберегти його у вашому списку особистих чатів не вдалося: {detailSentence} Воно може відображатися як звичайна кімната, доки спробу не буде повторено.",
    "roomCreationOutcome.theRoomWasCreatedButAdding2":
        "Кімнату створено, але додавання її до простору ще не підтверджено - можливо, воно ще зберігається. Повторіть, якщо кімната не з’явиться в просторі.",
    "roomCreationOutcome.theDirectMessageWasCreatedBut2":
        "Особисте повідомлення створено, але збереження його у вашому списку особистих чатів ще не підтверджено - можливо, воно ще зберігається. Повторіть, якщо воно не з’явиться у вашому списку.",

    // src/lib/utils/roomEncryption.ts
    "roomEncryption.thisRoomIsAlreadyEncrypted": "Ця кімната вже зашифрована.",
    "roomEncryption.youNeedPowerLevelToEnable":
        "Щоб увімкнути шифрування, потрібен рівень прав {required}.",
    "roomEncryption.youAlreadyHaveADirectMessage":
        "Ви вже маєте особисте повідомлення з цим користувачем, і воно не зашифроване. Шифрування не можна додати автоматично - відкрийте його й увімкніть у налаштуваннях безпеки кімнати.",
    "roomEncryption.enableEncryptionWarning":
        "Шифрування не можна вимкнути після того, як його ввімкнено. Усім знадобиться клієнт, що підтримує шифрування, щоб читати нові повідомлення.",

    // src/lib/utils/roomHeaderMenu.ts
    "roomHeaderMenu.threads": "Гілки",
    "roomHeaderMenu.pinnedMessages": "Закріплені повідомлення",
    "roomHeaderMenu.notificationsInbox": "Скринька сповіщень",
    "roomHeaderMenu.mediaAndFiles": "Медіа та файли",
    "roomHeaderMenu.memberList": "Список учасників",

    // src/lib/utils/roomMedia.ts
    "roomMedia.image": "Зображення",
    "roomMedia.video": "Відео",
    "roomMedia.file": "Файл",
    "roomMedia.audio": "Аудіо",
    "roomMedia.kb": "{toFixed} КБ",
    "roomMedia.mb": "{toFixed} МБ",

    // src/lib/utils/roomSettingsNav.ts
    "roomSettingsNav.general": "Загальні",
    "roomSettingsNav.access": "Доступ",
    "roomSettingsNav.security": "Безпека",
    "roomSettingsNav.permissions": "Дозволи",
    "roomSettingsNav.members": "Учасники",
    "roomSettingsNav.emotes": "Емодзі",
    "roomSettingsNav.rooms": "Кімнати",

    // src/lib/utils/roomStateTrust.ts
    "roomStateTrust.unverifiedRoomState": "Неперевірений стан кімнати",
    "roomStateTrust.unverifiedRoomStateTooltip":
        "Деякі відомості про цю кімнату (ролі, членство та дозволи) отримано безпосередньо із сервера й не підтверджено синхронізацією, тому вони можуть бути неточними. Дії все одно перевіряються сервером незалежно від того, що показано тут.",

    // src/lib/utils/roomUpgrade.ts
    "roomUpgrade.theServerSRecommendedRoomVersion":
        "Рекомендована сервером версія кімнати недоступна.",
    "roomUpgrade.thisRoomIsOnTheLatest":
        "Ця кімната має останню версію (v{recommendedVersion}).",
    "roomUpgrade.youDonTHavePermissionTo":
        "Ви не маєте дозволу оновлювати цю кімнату.",

    // src/lib/utils/saveFile.ts
    "saveFile.savedToDownloads": "Збережено в Завантаження",

    // src/lib/utils/securityStatusView.ts
    "securityStatusView.couldnTReadThisAccountS":
        "Не вдалося прочитати стан шифрування цього облікового запису. Тут нічого не є достовірним, доки він не завантажиться - поки що не налаштовуйте й не скидайте відновлення.",
    "securityStatusView.encryptionIsnTReadyOnThis":
        "Шифрування в цьому сеансі ще не готове. Перезавантажте, якщо це триває.",

    // src/lib/utils/serverAcl.ts
    "serverAcl.allowListIsEmptyWhichDenies":
        "Список дозволених порожній, що забороняє федерацію всім серверам.",
    "serverAcl.denyListContainsWhichBansAll":
        "Список заборонених містить *, що блокує всі сервери.",
    "serverAcl.thisConfigurationBansYourOwnServer":
        "Ця конфігурація блокує ваш власний сервер ({ownServerName}), що порушить федерацію.",

    // src/lib/utils/serverCapabilities.ts
    "serverCapabilities.crossSigningE2ee": "Перехресне підписування (E2EE)",
    "serverCapabilities.privateReadReceipts":
        "Приватні підтвердження прочитання",
    "serverCapabilities.threadedRelations": "Зв’язки гілок",
    "serverCapabilities.spaceSummaries": "Зведення просторів",
    "serverCapabilities.busyPresence": "Присутність «зайнятий»",
    "serverCapabilities.dehydratedDevices": "Дегідратовані пристрої",
    "serverCapabilities.filterPublicRoomsByType":
        "Фільтр публічних кімнат за типом",
    "serverCapabilities.authenticatedMedia": "Автентифіковані медіа",
    "serverCapabilities.intentionalMentions": "Навмисні згадки",
    "serverCapabilities.slidingSyncSimplified": "Sliding sync (спрощений)",
    "serverCapabilities.sharedRoomsWithAUser": "Спільні кімнати з користувачем",

    // src/lib/utils/settingsNav.ts
    "settingsNav.account": "Обліковий запис",
    "settingsNav.securitySessions": "Безпека та сеанси",
    "settingsNav.privacySafety": "Приватність і безпека",
    "settingsNav.app": "Застосунок",
    "settingsNav.appearance": "Вигляд",
    "settingsNav.messagesMedia": "Повідомлення та медіа",
    "settingsNav.voiceVideo": "Голос і відео",
    "settingsNav.emotes": "Емодзі",
    "settingsNav.advanced": "Додатково",
    "settingsNav.general": "Загальні",
    "settingsNav.plugins": "Плагіни",
    "settingsNav.server": "Сервер",
    "settingsNav.about": "Про застосунок",
    "settingsNav.debug": "Налагодження",

    // src/lib/utils/settingsSearch.ts
    "settingsSearch.displayName": "Показуване ім’я",
    "settingsSearch.avatar": "Аватар",
    "settingsSearch.presence": "Присутність",
    "settingsSearch.changePassword": "Змінити пароль",
    "settingsSearch.logOut": "Вийти",
    "settingsSearch.deactivateAccount": "Деактивувати обліковий запис",
    "settingsSearch.sessions": "Сеанси",
    "settingsSearch.encryptNewDirectMessages":
        "Шифрувати нові особисті повідомлення",
    "settingsSearch.onlySendToVerifiedDevices":
        "Надсилати лише на верифіковані пристрої",
    "settingsSearch.setUpRecovery": "Налаштувати відновлення",
    "settingsSearch.restoreMessageHistory": "Відновити історію повідомлень",
    "settingsSearch.verifyThisSession": "Верифікувати цей сеанс",
    "settingsSearch.rightAlignMyMessages":
        "Вирівнювати мої повідомлення праворуч",
    "settingsSearch.showWhenIAmInA": "Показувати, коли я у виклику",
    "settingsSearch.showNameColours": "Показувати кольори імен",
    "settingsSearch.textSize": "Розмір тексту",
    "settingsSearch.font": "Шрифт",
    "settingsSearch.themePresets": "Шаблони тем",
    "settingsSearch.importExportTheme": "Імпорт / експорт теми",
    "settingsSearch.timeFormat": "Формат часу",
    "settingsSearch.dateFormat": "Формат дати",
    "settingsSearch.showMatrixIds": "Показувати ID Matrix",
    "settingsSearch.readReceiptAvatars": "Аватари підтверджень прочитання",
    "settingsSearch.linkPreviews": "Попередній перегляд посилань",
    "settingsSearch.linkPreviewMedia": "Медіа попереднього перегляду посилань",
    "settingsSearch.pauseVideosOffScreen": "Призупиняти відео поза екраном",
    "settingsSearch.sendVideosThatStreamFaster":
        "Надсилати відео, що завантажуються швидше",
    "settingsSearch.sendPhotosThatAppearSooner":
        "Надсилати фото, що з’являються швидше",
    "settingsSearch.removeLocationAndMetadata":
        "Вилучати місцезнаходження та інші метадані із вивантажень",
    "settingsSearch.sendGifsAsAnimatedWebp": "Надсилати GIF як анімований WebP",
    "settingsSearch.midiSoundBank": "Банк звуків MIDI",
    "settingsSearch.holdToOpenMessageMenu":
        "Утримувати для відкриття меню повідомлення",
    "settingsSearch.checkSpelling": "Перевіряти правопис",
    "settingsSearch.gifDefaultTab": "Типова вкладка GIF",
    "settingsSearch.minimiseToTrayOnClose": "Згортати в трей під час закриття",
    "settingsSearch.richPresence": "Розширена присутність",
    "settingsSearch.runAtStartup": "Запускати разом із системою",
    "settingsSearch.proxy": "Проксі",
    "settingsSearch.reduceMotion": "Зменшити анімацію",
    "settingsSearch.keepRoomListOpen": "Тримати список кімнат відкритим",
    "settingsSearch.customEmotes": "Власні емодзі",
    "settingsSearch.pushNotificationsPermission": "Дозвіл на push-сповіщення",
    "settingsSearch.notificationSound": "Звук сповіщення",
    "settingsSearch.desktopAlertsPopUpAndTaskbar":
        "Сповіщення на комп’ютері (спливаюче вікно та мигання на панелі завдань)",
    "settingsSearch.popUpNotifications": "Спливаючі сповіщення",
    "settingsSearch.quietOnMyOtherDevices": "Тиша на моїх інших пристроях",
    "settingsSearch.privateReadReceipts": "Приватні підтвердження прочитання",
    "settingsSearch.hideMessageTextInNotifications":
        "Приховувати текст повідомлень у сповіщеннях",
    "settingsSearch.notificationRules": "Правила сповіщень",
    "settingsSearch.keywordHighlights": "Виділення за ключовими словами",
    "settingsSearch.inputDevice": "Пристрій введення",
    "settingsSearch.outputDevice": "Пристрій виведення",
    "settingsSearch.camera": "Камера",
    "settingsSearch.noiseSuppression": "Шумозаглушення",
    "settingsSearch.echoCancellation": "Усунення відлуння",
    "settingsSearch.autoGainControl": "Автоматичне регулювання підсилення",
    "settingsSearch.normalizeVoices": "Вирівнювати гучність голосів",
    "settingsSearch.mirrorMyCamera": "Віддзеркалювати мою камеру",
    "settingsSearch.videoCodec": "Відеокодек",
    "settingsSearch.noiseSuppressionGpu": "Прискорення GPU",
    "settingsSearch.adaptiveStream": "Адаптивна якість відео",
    "settingsSearch.callVolume": "Гучність виклику",
    "settingsSearch.playCallSounds": "Відтворювати звуки викликів",
    "settingsSearch.ringForIncomingDmCalls":
        "Дзвонити під час вхідних викликів в особистих чатах",
    "settingsSearch.blockedUsers": "Заблоковані користувачі",
    "settingsSearch.serverCapabilities": "Можливості сервера",
    "settingsSearch.plugins": "Плагіни",
    "settingsSearch.pluginRepositories": "Репозиторії плагінів",
    "settingsSearch.syncPlugins": "Синхронізація плагінів",
    "settingsSearch.checkForUpdates": "Перевірити наявність оновлень",
    "settingsSearch.clearCache": "Очистити кеш",
    "settingsSearch.showAllEvents": "Показувати всі події",
    "settingsSearch.orderHints": "Підказки порядку повідомлень",
    "settingsSearch.stickyCallMembership": "Sticky-участь у дзвінках",
    "settingsSearch.pushDiagnostics": "Діагностика push",
    "settingsSearch.pushService": "Служба push (UnifiedPush / Firebase)",
    "settingsSearch.language": "Мова",

    // src/lib/utils/slashCommands.ts
    "slashCommands.createAPoll": "Створити опитування",
    "slashCommands.shareYourLocation": "Поділитися місцезнаходженням",
    "slashCommands.joinARoomByAddress": "Приєднатися до кімнати за адресою",
    "slashCommands.leaveTheCurrentRoom": "Вийти з поточної кімнати",
    "slashCommands.inviteAUserToThisRoom":
        "Запросити користувача до цієї кімнати",
    "slashCommands.setTheRoomTopic": "Задати тему кімнати",
    "slashCommands.removeAUserFromThisRoom":
        "Виключити користувача з цієї кімнати",
    "slashCommands.userServerReason": "<@user:server> [причина]",
    "slashCommands.banAUserFromThisRoom":
        "Заблокувати користувача в цій кімнаті",
    "slashCommands.setYourDisplayName": "Задати ваше показуване ім’я",
    "slashCommands.displayName": "<показуване ім’я>",
    "slashCommands.setAUserSPowerLevel": "Задати рівень прав користувача",
    "slashCommands.userServerLevel": "<@user:server> [рівень]",
    "slashCommands.resetAUserSPowerLevel":
        "Скинути рівень прав користувача до типового",
    "slashCommands.discardSession":
        "Використати новий ключ кімнати для вашого наступного повідомлення, якщо люди не можуть прочитати ваші",
    "slashCommands.usage": "Використання: /{name} {argHint}",
    "slashCommands.usage2": "Використання: /{name}",

    // src/lib/utils/syncStatus.ts
    "syncStatus.connected": "Підключено",
    "syncStatus.reconnecting": "Повторне з’єднання…",
    "syncStatus.connectionError": "Помилка з’єднання",
    "syncStatus.offline": "Поза мережею",
    "syncStatus.connecting": "З’єднання…",

    // src/lib/utils/themePalette.ts
    "themePalette.accent": "Акцент",
    "themePalette.background": "Фон",
    "themePalette.secondaryBackground": "Другорядний фон",
    "themePalette.tertiaryBackground": "Третинний фон",
    "themePalette.primaryText": "Основний текст",
    "themePalette.secondaryText": "Другорядний текст",
    "themePalette.mutedText": "Приглушений текст",
    "themePalette.danger": "Небезпека",
    "themePalette.positive": "Позитивний",
    "themePalette.mentionHighlight": "Виділення згадки",
    "themePalette.link": "Посилання",
    "themePalette.warning": "Попередження",
    "themePalette.onlineStatus": "Статус «у мережі»",
    "themePalette.idleStatus": "Статус «неактивний»",
    "themePalette.doNotDisturbStatus": "Статус «не турбувати»",
    "themePalette.offlineStatus": "Статус «поза мережею»",
    "themePalette.divider": "Роздільник",
    "themePalette.spoilerBackground": "Фон спойлера",
    "themePalette.ownMessageBubble": "Бульбашка власного повідомлення",
    "themePalette.primaryTextOnBackground": "Основний текст на фоні",
    "themePalette.secondaryTextOnBackground": "Другорядний текст на фоні",
    "themePalette.mutedTextOnTertiaryBackground":
        "Приглушений текст на третинному фоні",
    "themePalette.whiteTextOnAccentButtons": "Білий текст на акцентних кнопках",
    "themePalette.whiteTextOnDangerButtons": "Білий текст на кнопках небезпеки",
    "themePalette.whiteTextOnOwnBubble": "Білий текст на власній бульбашці",

    // src/lib/utils/themePreset.ts
    "themePreset.copy": "{newName} (копія)",

    // src/lib/utils/threadList.ts
    "threadList.noPreview": "(без попереднього перегляду)",

    // src/lib/utils/threePidInvite.ts
    "threePidInvite.youDonTHavePermissionTo":
        "Ви не маєте дозволу запрошувати людей до цієї кімнати.",
    "threePidInvite.yourHomeserverHasNoIdentityServer":
        "Ваш домашній сервер не має сервера ідентифікації, тож запрошення електронною поштою недоступні.",

    // src/lib/utils/timeFormat.ts
    "timeFormat.yesterdayAt": "Вчора о {time}",
    "timeFormat.today": "Сьогодні",
    "timeFormat.yesterday": "Вчора",
    "timeFormat.separatorDatePattern": "EEEE, d MMMM yyyy",
    "timeFormat.monthDayPattern": "d MMM",
    "timeFormat.compactDateTime": "{date}, {time}",

    // src/lib/utils/updateStatus.ts
    "updateStatus.checkingForUpdates": "Перевірка оновлень…",
    "updateStatus.youReOnTheLatestVersion":
        "У вас остання версія{versionSuffix}",
    "updateStatus.checkForUpdates": "Перевірити наявність оновлень",
    "updateStatus.updateAvailable": "Доступне оновлення{versionSuffix}",
    "updateStatus.lastInstallFailed":
        "Минулого разу оновлення{versionSuffix} не встановилося",
    "updateStatus.downloadInstall": "Завантажити й встановити",
    "updateStatus.downloadingV": "Завантаження v{version}",
    "updateStatus.downloadingUpdate": "Завантаження оновлення",
    "updateStatus.updateReadyInstall":
        "Оновлення{versionSuffix} готове - встановити",
    "updateStatus.install": "Встановити",
    "updateStatus.updateReadyRestartToApply":
        "Оновлення{versionSuffix} готове - перезапустіть, щоб застосувати",
    "updateStatus.restartToApply": "Перезапустити для застосування",
    "updateStatus.updateReadyReloadToApply":
        "Оновлення{versionSuffix} готове - перезавантажте, щоб застосувати",
    "updateStatus.reloadToApply": "Перезавантажити для застосування",
    "updateStatus.aNewVersionIsAvailable":
        "Доступна нова версія{versionSuffix}",
    "updateStatus.openReleasePage": "Відкрити сторінку випуску",
    "updateStatus.flatpakManualUpdate":
        "Доступне оновлення{versionSuffix}. Встановіть його з центру програм або командою flatpak update",
    "updateStatus.packageManagerUpdate":
        "Доступне оновлення{versionSuffix}. Оновіть через {manager}",
    "updateStatus.updateCheckFailed": "Не вдалося перевірити оновлення",
    "updateStatus.checkForUpdatesToInstallThe":
        "Перевірте оновлення, щоб встановити останню версію.",

    // src/lib/utils/uploadLimits.ts
    "uploadLimits.mb": "{round} МБ",
    "uploadLimits.kb": "{round} КБ",
    "uploadLimits.exceedsTheServerSUploadLimit":
        "«{fileName}» перевищує ліміт вивантаження сервера ({formatByteLimit})",

    // src/lib/utils/verificationMessage.ts
    "verificationMessage.verificationRequestSent":
        "Запит на верифікацію надіслано",
    "verificationMessage.waitingForThemToAccept":
        "Очікування, поки вони приймуть…",
    "verificationMessage.noLongerPending": "Більше не очікує",
    "verificationMessage.wantsToVerify": "{senderName} хоче верифікуватися",
    "verificationMessage.compareEmojiToConfirmThisIs":
        "Порівняйте емодзі, щоб підтвердити, що це справді вони",
    "verificationMessage.sentAVerificationRequest":
        "{senderName} надіслав(-ла) запит на верифікацію",

    // src/lib/utils/verificationStatus.ts
    "verificationStatus.checkingEncryption": "Перевірка шифрування…",
    "verificationStatus.encryptionUnavailable": "Шифрування недоступне",
    "verificationStatus.statusUnavailable": "Стан недоступний",
    "verificationStatus.verified": "Верифіковано",
    "verificationStatus.thisSessionIsVerifiedAndEncryption":
        "Цей сеанс верифіковано, а шифрування повністю налаштовано.",
    "verificationStatus.notSetUp": "Не налаштовано",
    "verificationStatus.setUpEncryptionToSecureYour":
        "Налаштуйте шифрування, щоб захистити свої повідомлення на всіх пристроях.",
    "verificationStatus.setUp": "Налаштувати",
    "verificationStatus.encryptionSetupIncomplete":
        "Налаштування шифрування не завершено",
    "verificationStatus.thisSessionIsVerifiedButEncryption":
        "Цей сеанс верифіковано, але налаштування шифрування не завершено.",
    "verificationStatus.finishSetup": "Завершити налаштування",
    "verificationStatus.unverified": "Не верифіковано",
    "verificationStatus.thisSessionIsnTVerifiedYet":
        "Цей сеанс ще не верифіковано.",

    // src/routes/+layout.svelte
    "rootLayout.linkCopied": "Посилання скопійовано",

    // src/routes/+page.svelte
    "rootPage.failedToReconnectPleaseLogIn":
        "Не вдалося перепідключитися. Увійдіть знову.",
    "rootPage.sessionOpenInAnotherTab":
        "Цей сеанс відкрито в іншій вкладці. Ця вкладка продовжить роботу, щойно та закриється.",
    "rootPage.signedInButSyncingCouldNot":
        "Вхід виконано, але синхронізацію не вдалося запустити. Спробуйте ще раз.",
    "rootPage.yourSessionHasExpiredPleaseSign":
        "Ваш сеанс закінчився. Увійдіть знову.",

    // ownStatus
    "ownStatus.profileField": "поле профілю {key}",
    "ownStatus.theServerStillHas": "На сервері все ще є: {leftovers}",
    "messageInput.directFile": "Напряму",
    "messageInput.directFileHint":
        "Надсилається напряму, коли ви натискаєте «надіслати», а не вивантажується.",
    "messageInput.sendDirectly": "Надіслати напряму",
    "messageItem.replyPreviewFileOffer": "Пропозиція файлу",
    "fileOffer.unavailable":
        "Цю пропозицію файлу не може прочитати ця версія Zam.",
    "fileOffer.details": "{size}, надіслано напряму",
    "fileOffer.waiting":
        "Очікування, поки хтось прийме. Тримайте Zam відкритим.",
    "fileOffer.fromElsewhere": "Запропоновано з іншого з ваших сеансів.",
    "fileOffer.gone": "Більше недоступно з цього сеансу.",
    "fileOffer.expired": "Ця пропозиція закінчилася.",
    "fileOffer.accept": "Прийняти",
    "fileOffer.retry": "Спробувати знову",
    "fileOffer.cancel": "Скасувати",
    "fileOffer.withdraw": "Відкликати",
    "fileOffer.connecting": "З’єднання з відправником...",
    "fileOffer.progress": "{done} з {total}, {rate}/с",
    "fileOffer.verifying": "Перевірка файлу...",
    "fileOffer.savedDone": "Файл збережено й перевірено.",
    "fileOffer.sentDone": "Доставлено {peer}.",
    "fileOffer.sendingTo": "Для {peer}",
    "fileOffer.cancelled": "Передачу скасовано.",
    "fileOffer.failedOffline":
        "Відправник недоступний. Йому потрібно відкрити Zam.",
    "fileOffer.failedRefused": "Сеанс відправника відхилив цю передачу.",
    "fileOffer.failedNoRelay":
        "Для однорангових з'єднань потрібен ретранслятор, але його немає (TURN), тож файл не можна надіслати, не показавши IP-адресу.",
    "fileOffer.failedConnection": "З’єднання втрачено.",
    "fileOffer.failedStalled": "Передача перестала просуватися.",
    "fileOffer.failedCorrupt":
        "Файл було змінено дорогою, тому його відкинуто.",
    "fileOffer.failedWrite": "Не вдалося записати файл. Чи не заповнений диск?",
    "fileOffer.failedStorageFull": "Недостатньо місця для цього файлу.",
    "fileOffer.failedHash": "Завершений файл не збігся, тому його відкинуто.",
    "fileOffer.failedUnsupported":
        "Цей пристрій поки що не може зберігати прямі передачі.",
    "ownStatus.statusClearedButPresenceRemains":
        "Статус очищено, але сервер усе ще показує повідомлення присутності «{presenceLeft}». Його, імовірно, задано в іншому сеансі цього облікового запису (інший застосунок чи клієнт) - очистіть його там або вийдіть із того сеансу.",
    "qrLogin.failed": "Не вдалося увійти за QR-кодом. Спробуйте ще раз.",
    "qrLogin.cancelled": "Вхід за QR-кодом скасовано.",
    "qrLogin.cancelledOther": "Інший пристрій скасував вхід.",
    "qrLogin.insecure":
        "Не вдалося довіряти з’єднанню з іншим пристроєм, тому вхід зупинено.",
    "qrLogin.wrongServer":
        "На іншому пристрої виконано вхід на {server}, а це не той сервер, який ви вибрали тут.",
    "qrLogin.codeMismatch":
        "Число не збіглося, тому вхід зупинено. Продовжуйте, лише якщо число, показане на іншому пристрої, - це те, яке ви ввели.",
    "qrLogin.untrustedApproval":
        "Новий пристрій попросив вас схвалити на адресі, що не належить постачальнику входу вашого облікового запису, тому це було відхилено.",
    "qrLogin.enterNumber":
        "Введіть число, показане на вашому іншому пристрої. Це перевіряє, що з’єднано лише вас двох.",
    "qrLogin.numberLabel": "Число",
    "qrLogin.confirm": "Продовжити",
    "qrLogin.waitingApproval":
        "Схваліть вхід на вашому іншому пристрої, щоб завершити.",
    "qrLogin.notVerified":
        "Ви ввійшли, але цей сеанс не зміг отримати ваші ключі шифрування. Верифікуйте його в налаштуваннях, щоб читати старіші зашифровані повідомлення.",
    "qrLogin.linkConnecting": "З’єднання з новим пристроєм...",
    "qrLogin.linkShowNumber": "Введіть це число на новому пристрої",
    "qrLogin.linkDoneVerified":
        "На новому пристрої виконано вхід, і його верифіковано.",
    "qrLogin.denied": "Вхід відхилено на іншому пристрої.",
    "qrLogin.expired": "QR-код закінчився. Спробуйте ще раз.",
    "qrLogin.notALoginCode":
        "Це не код входу з нового пристрою цього облікового запису. Відкрийте «Увійти за QR-кодом» на пристрої, на якому ви хочете ввійти.",
    "qrLogin.notSupportedHere":
        "Постачальник входу цього облікового запису не підтримує вхід за QR-кодом.",
    "qrLogin.signInButton": "Увійти за QR-кодом",
    "qrLogin.signInTitle": "Вхід за QR-кодом",
    "qrLogin.signInSteps":
        "На пристрої, де в Zam уже виконано вхід, відкрийте «Налаштування», потім «Обліковий запис», потім «Сканувати QR-код, щоб увійти на новому пристрої» і проскануйте цей код.",
    "qrLogin.codeAlt": "QR-код для сканування з пристрою, де виконано вхід",
    "qrLogin.preparing": "Підготовка коду...",
    "qrLogin.matchCode":
        "Сторінка схвалення покаже цей код. Схвалюйте, лише якщо він збігається.",
    "qrLogin.signingIn": "Вхід...",
    "qrLogin.cancel": "Скасувати",
    "qrLogin.linkButton": "Сканувати QR-код, щоб увійти на новому пристрої",
    "qrLogin.linkTitle": "Підключити новий пристрій",
    "qrLogin.linkIntro":
        "На новому пристрої виберіть «Увійти за QR-кодом», а потім проскануйте код, який він покаже. Ви схвалюєте вхід на сторінці входу вашого облікового запису, після чого обидва пристрої верифікуються один щодо одного.",
    "qrLogin.linkWarning":
        "Продовжуйте лише для пристрою, який зараз у ваших руках.",
    "qrLogin.linkApprove":
        "Схваліть вхід на {host}. Перевірте, що код там збігається з кодом на новому пристрої, і схвалюйте, лише якщо пристрій ваш.",
    "qrLogin.linkApproveButton": "Схвалити на {host}",
    "qrLogin.linkWaiting": "Очікування входу на новому пристрої...",
    "qrLogin.linkDone":
        "На новому пристрої виконано вхід. Завершіть його верифікацію у вікні, що щойно відкрилося на обох пристроях.",
    "qrLogin.linkDoneUnverified":
        "На новому пристрої виконано вхід. Верифікацію не вдалося запустити автоматично; верифікуйте його в розділі «Налаштування», потім «Сеанси».",
    "qrLogin.notADeviceCode":
        "Це недійсний код. Введіть код, показаний на новому пристрої.",
    "qrLogin.loginSectionTitle": "Вхід",
    "qrLogin.loginSectionIntro":
        "Увійдіть на іншому пристрої з цього, не вводячи ім’я користувача й пароль.",
    "qrLogin.codeButton": "Ввести код з нового пристрою",
    "qrLogin.codeTitle": "Вхід за кодом",
    "qrLogin.codeIntro":
        "На новому пристрої виберіть «Увійти за QR-кодом». Під QR-кодом він показує короткий код; введіть цей код тут.",
    "qrLogin.codeLabel": "Код, показаний на новому пристрої",
    "qrLogin.codeContinue": "Продовжити",
    "qrLogin.orEnterCode":
        "Немає камери? На пристрої, де виконано вхід, відкрийте «Налаштування», потім «Обліковий запис», потім «Вхід», виберіть «Ввести код з нового пристрою» і введіть код нижче.",
    "qrLogin.notAShownCode":
        "Це не код з пристрою, де виконано вхід. На пристрої, де виконано вхід, відкрийте «Налаштування», потім «Обліковий запис», потім «Вхід» і виберіть «Показати QR-код для сканування новим пристроєм».",
    "qrLogin.showButton": "Показати QR-код для сканування новим пристроєм",
    "qrLogin.showTitle": "Показати код для нового пристрою",
    "qrLogin.showIntro":
        "На новому пристрої виберіть «Увійти за QR-кодом», потім «Сканувати код з пристрою, де виконано вхід», і проскануйте цей код.",
    "qrLogin.showCodeAlt": "QR-код для сканування з нового пристрою",
    "qrLogin.showEnterNumber": "Введіть число, яке показує новий пристрій",
    "qrLogin.showRetry": "Показати новий код",
    "qrLogin.scanInstead":
        "Натомість сканувати код з пристрою, де виконано вхід",
    "qrLogin.scanTitle": "Сканувати код з пристрою, де виконано вхід",
    "qrLogin.scanIntro":
        "На пристрої, де виконано вхід, відкрийте «Налаштування», потім «Обліковий запис», потім «Вхід», виберіть «Показати QR-код для сканування новим пристроєм» і проскануйте його тут.",
    "qrLogin.scanShowNumber":
        "Введіть це число на пристрої, де виконано вхід, а потім схваліть вхід там.",
    "qrLogin.showInstead": "Натомість показати мій власний код",
    "qrLogin.chooseIntro":
        "У той самий момент увійшло більше ніж один новий сеанс. Виберіть той, який ви налаштовуєте.",
    "qrLogin.linkClose": "Закрити",
    // src/lib/components/messages/MessageEmbed.svelte
    "messageEmbed.deleted": "Повідомлення видалено",
    "messageEmbed.inRoom": "у {room}",
    "messageEmbed.jumpToMessage":
        "Перейти до повідомлення, на яке є посилання:",
    "messageActionsMenu.copyText": "Копіювати текст повідомлення",
    "messageActionsMenu.textCopied": "Текст повідомлення скопійовано",
    "messageActionsMenu.couldnTCopyText":
        "Не вдалося скопіювати текст повідомлення",
    "messageActionsMenu.selectHint":
        "Натисніть і утримуйте текст, щоб виділити його частину",
    "roomSettings.readReceipts": "Позначки про прочитання",
    "roomSettings.readReceiptsRoomHelp":
        "Виберіть, чи можуть інші учасники бачити, які повідомлення ви прочитали в цій кімнаті.",
    "roomSettings.readReceiptsSpaceHelp":
        "Виберіть, чи можуть інші учасники бачити, які повідомлення ви прочитали в цьому просторі та його кімнатах. Власний вибір кімнати має пріоритет.",
    "roomSettings.readReceiptsDefaultShare":
        "Залежить від ваших налаштувань приватності, зараз показується іншим",
    "roomSettings.readReceiptsDefaultHide":
        "Залежить від ваших налаштувань приватності, зараз приховано від інших",
    "roomSettings.readReceiptsShare": "Показувати мої позначки про прочитання",
    "roomSettings.readReceiptsShareDesc":
        "Інші можуть бачити, які повідомлення ви прочитали.",
    "roomSettings.readReceiptsHide": "Приховувати мої позначки про прочитання",
    "roomSettings.readReceiptsHideDesc":
        "Стан непрочитаного і далі синхронізується, але інші не бачать, що ви прочитали.",
    "privacySafetySettings.receiptsOverrideHint":
        "Кімнати та простори можуть перевизначити це в своїх налаштуваннях сповіщень.",
    "richPresence.steam": "Розширена присутність Steam",
    "richPresence.steamHint":
        "Показувати гру Steam, у яку ви граєте, разом із її станом розширеної присутності, наприклад картою чи режимом. Це вмикає локальний порт налагодження Steam, який слухає лише цей комп’ютер. Щоб зміни набули чинності, Steam потрібно перезапустити один раз.",
    "richPresence.steamConnected": "Підключено до Steam.",
    "richPresence.steamNeedsRestart":
        "Порт налагодження Steam ще не відкрито. Перезапустіть Steam, щоб відкрити його.",
    "richPresence.steamNotRunning":
        "Steam не запущено. Запустіть його, і Zam підключиться автоматично.",
    "richPresence.restartSteam": "Перезапустити Steam",
    "richPresence.restartSteamTitle": "Перезапустити Steam?",
    "richPresence.restartSteamBody":
        "Steam закриється і відкриється знову. Ігри, запущені зі Steam, можуть закритися разом із ним.",
    "richPresence.restartSteamFailed":
        "Не вдалося перезапустити Steam: {error}",
    "richPresence.steamEnableFailed":
        "Не вдалося увімкнути порт налагодження Steam: {error}",
    "richPresence.steamDisableFailed":
        "Не вдалося вимкнути порт налагодження Steam: {error}",
    "richPresence.steamUacCancelled":
        "Windows запросила права адміністратора, але їх не надали, тому нічого не змінено.",
    "richPresence.steamFailed":
        "Розширена присутність Steam не працює: {error}",
    "richPresence.viaSteam": "Steam",
    "meshConsent.titleJoining": "Цей дзвінок з’єднує вас напряму з іншими",
    "meshConsent.titleNewcomer":
        "Із кимось у цьому дзвінку можна зв’язатися лише напряму",
    "meshConsent.noCallServer":
        "На вашому домашньому сервері немає сервера дзвінків, тому аудіо, відео та показ екрана передаються напряму з вашого пристрою кожному учаснику дзвінка.",
    "meshConsent.someoneWithoutCallServer":
        "Хтось у цьому дзвінку перебуває на домашньому сервері без сервера дзвінків. Щоб чути й бачити цю людину, ваш пристрій підключається до її пристрою напряму.",
    "meshConsent.ipVisible":
        "Ваш домашній сервер не має ретранслятора (TURN), тож усі, з ким ви з'єднуєтеся напряму, бачать вашу IP-адресу, яка може приблизно видати ваше місцеперебування.",
    "meshConsent.relayed":
        "З'єднання йде через ретранслятор вашого домашнього сервера: інші бачать його адресу, а не вашу IP-адресу. Якщо через ретранслятор когось не вдається досягти, ви з'єднуєтеся з ним напряму, і він бачить вашу IP-адресу. Щоб цього не було, увімкніть «Вимагати ретранслятор для однорангових дзвінків» у налаштуваннях голосу й відео.",
    "meshConsent.relayRequired":
        "«Вимагати ретранслятор для однорангових дзвінків» увімкнено, але ваш домашній сервер не має ретранслятора (TURN), тож з'єднатися не вийде. Вимкніть це в налаштуваннях голосу й відео, щоб з'єднатися напряму.",
    "meshConsent.titleFileTransfer":
        "Ця передача файлу з'єднує вас напряму з іншою людиною",
    "meshConsent.fileTransferDirect":
        "У вашого сервера або в сервера співрозмовника немає сервера дзвінків, тому файл передається напряму з одного пристрою на інший.",
    "meshConsent.join": "Приєднатися",
    "meshConsent.connectDirectly": "Підключитися напряму",
    "meshConsent.joinWithoutThem": "Приєднатися без них",
    "meshConsent.notNow": "Не зараз",
    "voiceCall.meshNeedsTurn":
        "«Вимагати ретранслятор для однорангових дзвінків» увімкнено, але ваш домашній сервер не має ретранслятора (TURN). Вимкніть це в налаштуваннях голосу й відео, щоб приєднатися.",
    "voiceAudioSettings.meshRelayOnly":
        "Вимагати ретранслятор для однорангових дзвінків",
    "voiceAudioSettings.meshRelayOnlyHint":
        "Однорангові дзвінки й передавання файлів ідуть через сервер-ретранслятор (TURN) вашого домашнього сервера, якщо він є, тож ніхто не бачить вашу IP-адресу. Без нього, або якщо через ретранслятор когось не вдається досягти, з'єднання пряме, і адресу видно. Якщо увімкнено, прямих з'єднань не буде ніколи: без робочого ретранслятора з'єднання не встановлюється.",
    "voiceCall.meshPeerUnreachable":
        "Когось у цьому дзвінку можна досягти лише напряму, але ретранслятор обов'язковий, а ваш домашній сервер його не має (TURN), тож ви його не почуєте.",
    "meshConsent.usePublicStun": "Використовувати публічний STUN-сервер.",
    "meshConsent.usePublicStunHint":
        "На вашому домашньому сервері немає сервера, який допомагає з’єднанням проходити через домашні маршрутизатори, тому без нього більшість прямих з’єднань не працює. STUN-сервер Cloudflare дізнається вашу IP-адресу, але нічого про дзвінок.",
    "voiceAudioSettings.meshPublicStun":
        "Використовувати публічний STUN-сервер",
    "voiceAudioSettings.meshPublicStunHint":
        "Лише якщо домашній сервер не пропонує ні ретранслятора, ні STUN-сервера: однорангові дзвінки запитують у STUN-сервера Cloudflare вашу публічну адресу, яка потрібна більшості домашніх маршрутизаторів. Він бачить вашу IP-адресу, але не сам дзвінок.",
    "settingsSearch.meshPublicStun": "Використовувати публічний STUN-сервер",
    "voiceCall.meshFailed":
        "Не вдалося з’єднатися напряму з {name}. Мережа співрозмовника може це блокувати, або домашній сервер співрозмовника не пропонує способу пройти через домашні маршрутизатори.",
    "voiceCall.meshFailedNoServers":
        "Не вдалося з’єднатися напряму з {name}. Ваш домашній сервер не пропонує ні ретранслятора, ні STUN-сервера, тож з’єднання через домашні маршрутизатори зазвичай не працюють. Може допомогти увімкнення опції «Використовувати публічний STUN-сервер» у налаштуваннях розділу «Голос і відео».",
    "settingsSearch.meshRelayOnly":
        "Вимагати ретранслятор для однорангових дзвінків",
};

const catalogue: LocaleCatalogue = { messages, dateLocale: uk };

export default catalogue;
