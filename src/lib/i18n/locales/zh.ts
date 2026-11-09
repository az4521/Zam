// Chinese (Simplified) (zh). Same keys and placeholders as ../en.ts; a string missing
// here falls back to English (`npm run i18n:missing` lists them).

import { zhCN } from "date-fns/locale/zh-CN";
import type { MessageKey } from "../en";
import type { LocaleCatalogue } from "../index";

const messages: Partial<Record<MessageKey, string>> = {
    // Shared
    "common.turnOffCamera": "关闭摄像头",
    "common.turnOnCamera": "开启摄像头",
    "common.stopSharing": "停止共享",
    "common.shareYourScreen": "共享你的屏幕",
    "common.joining": "正在加入…",
    "common.join": "加入",
    "common.closeDialog": "关闭对话框",
    "common.settings": "设置",
    "common.searchResults": "搜索结果",
    "common.default": "默认",
    "common.mute": "静音",
    "common.saving": "正在保存…",
    "common.unblock": "取消屏蔽",
    "common.block": "屏蔽",
    "common.closeMenu": "关闭菜单",
    "common.openRoomList": "打开房间列表",
    "common.uploading": "正在上传…",
    "common.uploadImage": "上传图片",
    "common.emoji": "表情符号",
    "common.decline": "拒绝",
    "common.invitePeople": "邀请成员",
    "common.close": "关闭",
    "common.cancel": "取消",
    "common.loading": "正在加载…",
    "common.loadMore": "加载更多",
    "common.notifications": "通知",
    "common.save": "保存",
    "common.topic": "主题",
    "common.videoRoom": "视频房间",
    "common.reasonOptional": "原因（可选）",
    "common.actions": "操作",
    "common.copy": "复制",
    "common.remove": "移除",
    "common.add": "添加",
    "common.starting": "正在开始…",
    "common.verify": "验证",
    "common.removeFromFavourites": "从收藏中移除",
    "common.addToFavourites": "添加到收藏",
    "common.stickers": "贴纸",
    "common.retry": "重试",
    "common.delete": "删除",
    "common.checking": "正在检查…",
    "common.gifs": "GIF",
    "common.dragOrUseArrowKeysTo": "拖动或使用方向键调整大小",
    "common.resizePicker": "调整选择器大小",
    "common.noResults": "没有结果",
    "common.memberCount": "{count, plural, other {# 位成员}}",
    "common.replyCount": "{count, plural, other {# 条回复}}",

    // src/lib/components/settings/AboutSettings.svelte
    "aboutSettings.automaticUpdates": "自动更新",
    "aboutSettings.version": "版本",
    "aboutSettings.currentVersionV": "当前版本 v{APP_VERSION}",
    "aboutSettings.checkForUpdates": "检查更新",
    "aboutSettings.updateAvailable": "有可用更新",
    "aboutSettings.reloading": "正在重新加载…",
    "aboutSettings.update": "更新",
    "aboutSettings.reloadToUpdate": "重新加载以更新",
    "aboutSettings.youReOnTheLatestVersion": "你已在使用最新版本。",
    "aboutSettings.credits": "致谢",
    "aboutSettings.creditsMidiInstruments": "MIDI 乐器",
    "aboutSettings.creditsSoundFont":
        "作者 {author}，基于 {original} 的 Phoenix。采用 CC BY 许可；已重新映射为 General MIDI 并为 Zam 压缩。",
    "aboutSettings.creditsSoundFontGaps":
        "MT-32 所缺的乐器：{microgm}，作者 {microgmAuthor}（WTFPL）；以及 {generalUser}，作者 {generalUserAuthor}。",
    "aboutSettings.troubleshooting": "故障排除",
    "aboutSettings.clearCacheAndResync": "清除缓存并重新同步",
    "aboutSettings.reDownloadsYourRoomsFromThe":
        "从服务器重新下载你的房间。可修复缺失或卡住的房间。你会保持登录状态。",
    "aboutSettings.resyncing": "正在重新同步…",
    "aboutSettings.clearCache": "清除缓存",
    "aboutSettings.updateCheckFailed": "检查更新失败",
    "aboutSettings.downloadFailed": "下载失败",
    "aboutSettings.installFailed": "安装失败",
    "aboutSettings.failedToCheckForUpdates": "检查更新失败。",
    "aboutSettings.sourceCodeOnGitHub": "GitHub 上的源代码",
    "links.website": "网站",
    "links.github": "GitHub",
    "links.downloadApps": "下载应用",

    // src/lib/components/settings/AccountSettings.svelte
    "accountSettings.profile": "个人资料",
    "accountSettings.yourAvatar": "你的头像",
    "accountSettings.changeAvatar": "更换头像",
    "accountSettings.yourDisplayName": "你的显示名称",
    "accountSettings.saved": "已保存",
    "accountSettings.account": "账户",
    "accountSettings.userId": "用户 ID",
    "accountSettings.homeserver": "主服务器",
    "accountSettings.connection": "连接",
    "accountSettings.presence": "在线状态",
    "accountSettings.password": "密码",
    "accountSettings.currentPassword": "当前密码",
    "accountSettings.newPassword": "新密码",
    "accountSettings.confirmNewPassword": "确认新密码",
    "accountSettings.signOutAllOtherSessions": "登出所有其他会话",
    "accountSettings.changing": "正在更改…",
    "accountSettings.changePassword": "更改密码",
    "accountSettings.passwordChanged": "密码已更改。",
    "accountSettings.thisServerDoesNotAllowChanging":
        "此服务器不允许在本应用中更改密码。",
    "accountSettings.managedByProvider":
        "你的密码、会话和账户由你的登录提供方在其账户页面中管理。",
    "accountSettings.manageAccount": "管理账户",
    "accountSettings.emailPhoneNumbers": "邮箱和手机号",
    "accountSettings.noEmailAddressesOrPhoneNumbers":
        "此账户没有关联任何邮箱地址或手机号。",
    "accountSettings.email": "邮箱",
    "accountSettings.phone": "手机",
    "accountSettings.thisServerDoesNotAllowManaging":
        "此服务器不允许在本应用中管理它们。",
    "accountSettings.logOut": "登出",
    "accountSettings.lastDeviceTitle": "这是你唯一已登录的设备",
    "accountSettings.lastDeviceBackedUp":
        "你的加密历史记录已备份，但重新登录后需要恢复密钥才能读取。",
    "accountSettings.lastDeviceNoBackup":
        "登出将永久丢失存储在此设备上的加密密钥。如果没有密钥备份或其他已验证的设备，你的加密消息历史将无法恢复。",
    "accountSettings.logOutAnyway": "仍然登出",
    "accountSettings.dangerZone": "危险区域",
    "accountSettings.deactivateAccount": "停用账户…",
    "accountSettings.deactivationIsPermanentAndCannotBe":
        "停用是永久性的，无法撤销。",
    "accountSettings.eraseMessagesWherePossible": "尽可能清除消息",
    "accountSettings.deactivating": "正在停用…",
    "accountSettings.deactivateAccount2": "停用账户",
    "accountSettings.avatarUploadFailed": "头像上传失败",
    "accountSettings.failedToRemoveAvatar": "移除头像失败",
    "accountSettings.failedToSaveName": "保存名称失败",
    "accountSettings.couldNotSetPresence": "无法设置在线状态",
    "accountSettings.failedToChangePassword": "更改密码失败",
    "accountSettings.failedToDeactivateAccount": "停用账户失败",

    // src/lib/components/layout/AccountSwitcher.svelte
    "accountSwitcher.signOut": "登出 {userId}",
    "accountSwitcher.confirm": "确认",
    "accountSwitcher.signOut2": "登出",
    "accountSwitcher.addAccount": "添加账户",
    "accountSwitcher.accountMenu": "账户菜单",
    "accountSwitcher.closeAccountMenu": "关闭账户菜单",
    "accountSwitcher.back": "返回",
    "accountSwitcher.setYourStatus": "设置你的状态",
    "accountSwitcher.setAStatus": "设置状态",
    "accountSwitcher.editProfile": "编辑个人资料",
    "accountSwitcher.switchAccounts": "切换账户",
    "accountSwitcher.couldNotSetPresence": "无法设置在线状态",

    // src/lib/components/layout/ActiveCallBanner.svelte
    "activeCallBanner.openCall": "打开通话",
    "activeCallBanner.open": "打开",
    "activeCallBanner.ringing": "正在响铃…",
    "activeCallBanner.voiceCallInCall": "语音通话 · 通话中 {length} 人",
    "activeCallBanner.leave": "离开",

    // src/lib/components/settings/AppearanceSettings.svelte
    "appearanceSettings.rightAlignMyMessagesBubbleLayout":
        "我的消息靠右对齐（气泡布局）",
    "appearanceSettings.displayYourOwnMessagesOnThe":
        "将你自己的消息以彩色气泡显示在右侧",
    "appearanceSettings.showNameColours": "显示名称颜色",
    "appearanceSettings.drawPeopleSNamesInThe":
        "用每个人在个人资料中选择的颜色显示其名称。关闭后，所有人都使用普通文字颜色。",
    "appearanceSettings.keepRoomListOpen": "保持房间列表打开",
    "appearanceSettings.donTAutoCloseTheRoom":
        "在空间或主页之间切换时不自动关闭房间列表。打开房间或私信时始终会关闭它。",
    "appearanceSettings.timestamps": "时间戳",
    "appearanceSettings.timeFormat": "时间格式",
    "appearanceSettings.dateFormat": "日期格式",
    "appearanceSettings.customDatePattern": "自定义日期格式",
    "appearanceSettings.yyyyMmDd": "yyyy-MM-dd",
    "appearanceSettings.preview": "预览：",
    "appearanceSettings.dateFnsTokensEGYyyy":
        "· date-fns 标记，例如 yyyy-MM-dd",
    "appearanceSettings.invalidFormatUseLowercaseDateFns":
        "格式无效，请使用小写的 date-fns 标记，例如 yyyy-MM-dd。",
    "appearanceSettings.alwaysShowAbsoluteDates": "始终显示绝对日期",
    "appearanceSettings.replaceTodayAndYesterdayWithThe":
        "在所有位置用完整日期替换“今天”和“昨天”。",
    "appearanceSettings.reduceMotion": "减少动态效果",
    "appearanceSettings.minimizeAnimationsAndTransitionsYourDevice":
        "尽量减少动画和过渡效果。同时始终遵循你设备系统的“减少动态效果”设置。",
    "appearanceSettings.customCss": "自定义 CSS",
    "appearanceSettings.customCssEnable": "使用自定义 CSS",
    "appearanceSettings.customCssHint":
        "你自己的样式，会实时叠加在主题之上。主题颜色是设置在页面上的变量，因此请用 !important 来覆盖它们。",
    "appearanceSettings.customCssRecovery":
        "如果某条规则导致 Zam 无法使用，请在地址后加上 ?nocustomcss 打开它（或关闭此开关）以重新进入。",
    "appearanceSettings.custom": "自定义",
    "appearanceSettings.12Hour": "12 小时制",
    "appearanceSettings.24Hour": "24 小时制",
    "appearanceSettings.language": "语言",
    "appearanceSettings.layout": "布局",
    "appearanceSettings.displayLanguage": "显示语言",
    "appearanceSettings.displayLanguageHint":
        "Zam 菜单和按钮所使用的语言。更改后将重新加载应用。",

    // src/routes/app/+page.svelte
    "appPage.redirecting": "正在跳转…",

    // src/lib/components/layout/AppSettings.svelte
    "appSettings.backToSettings": "返回设置",
    "appSettings.closeSettings": "关闭设置",
    "appSettings.searchSettings": "搜索设置…",
    "appSettings.searchSettings2": "搜索设置",
    "appSettings.noSettingsMatch": "没有匹配的设置",
    "appSettings.noSettingsMatch2": "没有与“{searchQuery}”匹配的设置。",
    "appSettings.resultCount": "{count, plural, other {# 个结果}}",

    // src/lib/components/layout/AppShell.svelte
    "appShell.zam": "({notificationCount}) Zam",
    "appShell.redirecting": "正在跳转…",
    "appShell.noRoomsYet": "还没有房间",
    "appShell.resizeRoomList": "调整房间列表大小",
    "appShell.createARoomOrStartA": "创建房间或开始私信，即可上手。",
    "appShell.nothingInHome": "主页中空空如也",
    "appShell.allOfYourRoomsLiveIn":
        "你的所有房间都在空间中，打开一个空间即可查看。不在任何空间内的房间和私信会显示在这里。",
    "appShell.openRoomList": "打开房间列表",
    "appShell.someone": "某人",
    "appShell.isCalling": "{name} 正在呼叫",
    "appShell.incomingCall": "来电",
    "appShell.offlineMessageStorageIsUnavailableThis":
        "本次会话无法使用离线消息存储，因此历史记录不会保存到下次使用。",
    "appShell.couldnTSendYourReplyIt": "无法发送你的回复。已将其保存为草稿。",
    "appShell.yourNotificationReplyWasSavedAs": "你的通知回复已保存为草稿",

    // src/lib/components/settings/BlockedUsersSettings.svelte
    "blockedUsersSettings.messagesFromBlockedUsersAreHidden":
        "被屏蔽用户的消息在所有房间中都会被隐藏。此列表存储在你的账户中，适用于你的所有会话。",
    "blockedUsersSettings.youHavenTBlockedAnyone": "你还没有屏蔽任何人。",
    "blockedUsersSettings.failed": "失败",

    // src/lib/components/layout/CallParticipantMenu.svelte
    "callParticipantMenu.profile": "个人资料",
    "callParticipantMenu.input": "输入",
    "callParticipantMenu.output": "输出",
    "callParticipantMenu.opening": "正在打开…",
    "callParticipantMenu.message": "发消息",
    "callParticipantMenu.mention": "提及",
    "callParticipantMenu.userVolume": "用户音量",
    "callParticipantMenu.soundboardVolume": "音效板音量",
    "callParticipantMenu.shareVolume": "共享音量",
    "callParticipantMenu.hideVideo": "隐藏视频",
    "callParticipantMenu.kicking": "正在移出…",
    "callParticipantMenu.confirmKick": "确认移出 {name}？",
    "callParticipantMenu.kickFromRoom": "将 {name} 移出房间",
    "callParticipantMenu.banning": "正在封禁…",
    "callParticipantMenu.confirmBan": "确认封禁 {name}？",
    "callParticipantMenu.ban": "封禁 {name}",
    "callParticipantMenu.couldNotOpenADirectMessage": "无法打开私信",
    "callParticipantMenu.couldNotKick": "无法移出 {name}",
    "callParticipantMenu.couldNotBan": "无法封禁 {name}",

    // src/lib/components/layout/CallView.svelte
    "callEncryption.encrypted":
        "端到端加密：只有此通话中的人才能看到和听到通话内容。",
    "callEncryption.encryptedShort": "已加密",
    "callEncryption.partial":
        "已端到端加密，但 {names} 除外：其应用发送的音频和视频未加密。你可以听到和看到对方，但在对方的应用支持加密通话之前，对方无法听到或看到你。",
    "callEncryption.partialShort": "部分加密",
    "callEncryption.notEncrypted":
        "未端到端加密：通话服务器可以看到和听到此通话。加密房间中的通话是加密的。",
    "callView.ringing": "正在响铃…",
    "callView.showChat": "显示聊天",
    "callView.noOneIsInThisCall": "此通话中没有人",
    "callView.backToGrid": "返回网格",
    "callView.screenShareQuality": "屏幕共享画质",
    "callView.optionsFor": "{name} 的选项",
    "callView.muted": "已静音",
    "callView.deafened": "已拒听",
    "callView.mutedForYou": "已对你静音",
    "callView.joinedFromMultipleDevices": "从多台设备加入",
    "callView.devices": "{value} 台设备",
    "callView.enableAudio": "启用音频",
    "callView.onHold": "另一通通话进行时已保留",
    "callView.resume": "恢复",
    "callView.speakerOn": "使用扬声器",
    "callView.speakerOff": "停止使用扬声器",
    "callView.unmute": "取消静音",
    "callView.undeafen": "取消拒听",
    "callView.deafen": "拒听",
    "callView.disconnect": "断开连接",
    "callView.joinCall": "加入通话",
    "callView.you": "你",
    "callView.sScreen": "{name} 的屏幕",
    "callView.exitSpotlightFor": "退出对 {label} 的聚焦",
    "callView.spotlight": "聚焦 {label}",

    // src/lib/components/messages/CreatePollDialog.svelte
    "createPollDialog.createPoll": "创建投票",
    "createPollDialog.question": "问题",
    "createPollDialog.askSomething": "问点什么…",
    "createPollDialog.options": "选项",
    "createPollDialog.option": "选项 {value}",
    "createPollDialog.removeOption": "移除选项",
    "createPollDialog.addOption": "+ 添加选项",
    "createPollDialog.results": "结果",
    "createPollDialog.showAsPeopleVote": "随投票实时显示",
    "createPollDialog.hideUntilClosed": "结束前隐藏",
    "createPollDialog.allowSelectingMultipleOptions": "允许选择多个选项",
    "createPollDialog.creating": "正在创建…",
    "createPollDialog.failedToCreatePoll": "创建投票失败",

    // src/lib/components/layout/CryptoUnavailableBanner.svelte
    "cryptoUnavailableBanner.offOutOfStorage":
        "此设备上的加密已关闭，因为存储空间已用尽：无法读取或发送加密消息。请释放一些空间，然后重试。",
    "cryptoUnavailableBanner.offLocked":
        "此设备上的加密已关闭，因为某条通知仍在占用其密钥：无法读取或发送加密消息。",
    "cryptoUnavailableBanner.offOther":
        "此设备上的加密已关闭：无法读取或发送加密消息，且其加密密钥未被发布。",
    "cryptoUnavailableBanner.tryAgain": "重试",
    "cryptoUnavailableBanner.freeUpSpaceFirst": "请先释放空间",
    "cryptoUnavailableBanner.syncPaused":
        "加密无法启动，因此此会话已停止同步，以保留他人发给你的加密密钥。请重新加载后重试。",
    "cryptoUnavailableBanner.dismissEncryptionWarning": "忽略加密警告",

    // src/lib/components/layout/SoundboardPopover.svelte, settings/SoundPackEditor.svelte
    "soundboard.title": "音效板",
    "soundboard.yourVolume": "你的音效音量",
    "soundboard.empty": "还没有音效。可在“设置”的“表情”中或房间设置里添加。",
    "soundboard.sendFailed": "无法将该音效发送到通话中。",
    "soundboard.add": "添加音效",
    "soundboard.limits": "音频文件最长 {seconds} 秒，最大 {kb} KB。",
    "soundboard.pack": "音效包",
    "soundboard.newPack": "新建音效包",
    "soundboard.packName": "音效包名称",
    "soundboard.enterAPackName": "请输入音效包名称。",
    "soundboard.name": "音效名称",
    "soundboard.upload": "上传音效",
    "soundboard.uploadFailed": "无法上传该音效。",
    "soundboard.removeFailed": "无法移除。",
    "soundboard.previewFailed": "无法播放该音效。",
    "soundboard.preview": "试听",
    "soundboard.remove": "移除音效",
    "soundboard.noSounds": "此音效包中没有音效",
    "soundboard.deletePack": "删除音效包",
    "soundboard.confirmDeletePack": "删除音效包“{name}”及其所有音效？",
    "soundboard.inheritedFrom": "来自 {sourceName}",
    "soundboard.addToMine": "添加到我的音效包",
    "soundboard.useEverywhere": "在所有通话中使用",
    "soundboard.usedEverywhere": "所有通话中可用",
    "soundboard.useEverywhereHint":
        "在你所有房间的通话中提供此音效包，而不仅限于此房间。",
    "soundboard.globalFailed": "无法更改此音效包的提供范围。",
    "soundboard.addedToYours":
        "{count, plural, other {已将 # 个音效添加到你的音效包。}}",
    "soundboard.alreadyYours": "已在你的音效包中。",
    // src/lib/matrix/soundboard.ts
    "soundboard.badName":
        "请使用 1 到 100 个字母、数字、短横线或下划线（A-Z、0-9）。空格会变成下划线。",
    "soundboard.noPermission": "你无权编辑此房间中的音效。",
    "soundboard.notAudio": "这不是音频文件。",
    "soundboard.tooBig": "该文件太大。",
    "soundboard.tooLong": "音效时长最多 {seconds} 秒。",
    "soundboard.unreadable": "无法读取该音频文件。",

    // src/lib/components/settings/CustomPackSettings.svelte
    "customPackSettings.add": "添加{singular}",
    "customPackSettings.shortcode": "短代码",
    "customPackSettings.sticker": "贴纸",
    "customPackSettings.remove": "移除{toLowerCase}",
    "customPackSettings.image": "图片",
    "customPackSettings.chooseAtLeastOneUsage": "请至少选择一种用途。",
    "customPackSettings.uploadFailed": "上传失败",
    "customPackSettings.failedToRemove": "移除{singular}失败",
    "customPackSettings.failedToUpdateUsage": "更新用途失败",
    "customPackSettings.noCustomImages": "没有自定义图片",
    "customPackSettings.noCustomEmojis": "没有自定义表情",
    "customPackSettings.noCustomStickers": "没有自定义贴纸",

    // src/lib/components/debug/DebugEventItem.svelte
    "debugEventItem.stateKey": "state_key",
    "debugEventItem.empty": "（空）",
    "debugEventItem.redacted": "已编辑删除",
    "debugEventItem.id": "id: {eventId}",

    // src/lib/components/debug/DebugPanel.svelte
    "debugPanel.debugPanel": "调试面板",
    "debugPanel.sync": "同步：",
    "debugPanel.refresh": "↻ 刷新",
    "debugPanel.copied": "已复制",
    "debugPanel.copy": "⧉ 复制",
    "debugPanel.unreadState": "未读状态",
    "debugPanel.unread": "未读：",
    "debugPanel.highlight": "高亮：",
    "debugPanel.userid": "userId:",
    "debugPanel.readuptoid": "readUpToId:",
    "debugPanel.readidxInTimeline": "时间线中的 readIdx：",
    "debugPanel.noReceipt": "没有回执",
    "debugPanel.n1NotInWindow": "-1（不在窗口内！）",
    "debugPanel.events": "/ {totalEvents} 个事件",
    "debugPanel.lastEventSender": "最后一个事件的发送者：",
    "debugPanel.me": "（我：",
    "debugPanel.notificationEventsAfterReadMarker": "已读标记之后的通知事件：",
    "debugPanel.from": "[{formatTs}] {getType} 来自 {value} - {msgPreview}",
    "debugPanel.pushRules": "推送规则",
    "debugPanel.default": "（默认）",
    "debugPanel.actions": "actions: {stringify}",
    "debugPanel.conditions": "conditions: {stringify}",
    "debugPanel.noPushRulesFound": "未找到推送规则",
    "debugPanel.readReceiptsEventsWithReceipts":
        "已读回执（{length} 个带回执的事件）",
    "debugPanel.noReceipts": "没有回执",
    "debugPanel.urlPreviewInspector": "URL 预览检查器",
    "debugPanel.https": "https://...",
    "debugPanel.storeMessagesWhatTheUiRenders":
        "存储的消息（{length}）- 界面渲染的内容",
    "debugPanel.redacted": "已编辑删除",
    "debugPanel.rel": "rel={relType}",
    "debugPanel.empty": "空",
    "debugPanel.pendingEvents": "待处理事件（{length}）",
    "debugPanel.rawTimelineEvents": "原始时间线（{length} 个事件）",

    // src/lib/components/settings/GpuDebug.svelte
    "gpuDebug.title": "GPU",
    "gpuDebug.hardwareAcceleration": "硬件加速",
    "gpuDebug.hardwareAccelerationHint":
        "如果视频显示为黑屏或窗口绘制异常，请关闭此项。重启后生效。",
    "gpuDebug.nvidiaVideo": "NVIDIA 视频解码",
    "gpuDebug.nvidiaVideoHint":
        "通过 Chromium 的 Vulkan 渲染器在 NVIDIA GPU 上解码视频。选择“自动”时，若由 NVIDIA GPU 驱动你的屏幕则会开启。在 Wayland 上不使用 Vulkan，“自动”会保持关闭；在那里选择 Vulkan 则会尝试通过 OpenGL 进行硬件解码（实验性）。",
    "gpuDebug.nvidiaVideoActive": "当前正在使用。",
    "gpuDebug.nvidiaVideoInactive": "当前未使用。",
    "gpuDebug.nvidiaVideoFailed":
        "GPU 进程崩溃后，Zam 已退回到 GL 路径。选择 Vulkan 可再次尝试。",
    "gpuDebug.nvidiaVideoAuto": "自动",
    "gpuDebug.nvidiaVideoVulkan": "Vulkan",
    "gpuDebug.nvidiaVideoOff": "关闭",
    "gpuDebug.restartToApply": "重启 Zam 以应用此更改。",
    "gpuDebug.restart": "重启",
    "gpuDebug.videoDecoding": "视频解码",
    "gpuDebug.decodeHardware": "硬件",
    "gpuDebug.decodeSoftware": "软件",
    "gpuDebug.decodeUnsupported": "不支持",
    "gpuDebug.videoEncode": "硬件视频编码",
    "gpuDebug.videoEncodeHint":
        "在 GPU 上（VA-API）为你的驱动所支持的编解码器编码摄像头和屏幕共享。如果其他人看到你的画面是黑屏、卡住或损坏的，请关闭此项。重启后生效。",
    "gpuDebug.videoEncoding": "视频编码",
    "gpuDebug.videoEncodingHint":
        "通话会发送“语音和视频”中选择的编解码器（默认为 H.264）。通话统计面板会显示通话正在使用哪种编码器。",
    "gpuDebug.memoryReport": "内存报告",
    "gpuDebug.memoryReportHint":
        "按占用者细分 Zam 各进程使用的内存，包括 GPU 进程中的显存。请在屏幕出现问题时测量，然后将报告复制到错误报告中。",
    "gpuDebug.repaint": "重绘",
    "gpuDebug.repaintHint":
        "重启 GPU 进程，使窗口从头重新绘制。如果窗口的部分区域显示为黑色或白色方块，或位置不对（显存耗尽后可能出现），请使用此项。通话不会中断。托盘菜单中也有此项。",
    "gpuDebug.memoryMeasure": "测量",
    "gpuDebug.memoryMeasuring": "正在测量…",
    "gpuDebug.memoryRecord": "持续记录内存",
    "gpuDebug.memoryRecordHint":
        "按一定间隔生成内存报告，并在设置关闭后继续进行，因此你可以正常使用 Zam，稍后再回来查看。会显示各项的首次、最低、最高和最新大小，并将每个样本保存为 CSV 以便绘图。",
    "gpuDebug.memoryRecordInterval": "间隔",
    "gpuDebug.memoryRecordEvery": "每 {seconds} 秒",
    "gpuDebug.memoryRecordStart": "记录",
    "gpuDebug.memoryRecordStop": "停止",
    "gpuDebug.memoryRecordStatus": "{elapsed}内共 {count} 个样本",
    "gpuDebug.memoryRecordCsv": "保存 CSV",
    "gpuDebug.encodeTest": "运行 H.264 编码测试",
    "gpuDebug.encodeTestHint":
        "按通话的方式对每种尺寸编码 60 帧。硬件的每帧耗时应远低于软件。",
    "gpuDebug.encodeTestRejected": "被编码器拒绝",
    "gpuDebug.encodeTestResult": "{chunks} 个数据块，每帧 {ms} 毫秒",
    "gpuDebug.skiaGraphite": "Skia Graphite 渲染器（实验性）",
    "gpuDebug.skiaGraphiteHint":
        "使用 Chromium 较新的 Graphite 渲染器而非 Ganesh 绘制界面。开启可测试渲染；如果窗口闪烁或绘制异常，请关闭。需要硬件加速。重启后生效。",
    "gpuDebug.skiaGraphiteFailed":
        "因启动失败或导致 GPU 进程崩溃，已自动关闭。再次开启可重试。",
    "gpuDebug.nvidiaEncode": "NVIDIA 视频编码（实验性）",
    "gpuDebug.nvidiaEncodeHint":
        "通过 Zam 自带的 VA-API 驱动，使用 NVENC 对 H.264 通话和屏幕共享进行编码。视频解码保持上方的设置。重启后生效。",
    "gpuDebug.featureStatus": "功能状态",
    "gpuDebug.details": "详情",
    "settingsNav.keybinds": "快捷键",
    "settingsSearch.keyboardShortcuts": "键盘快捷键",
    "keybinds.intro":
        "点击一个快捷键进行更改，然后按下新的按键。快捷键在 Zam 处于焦点时生效。按键说话和按键静音也可以使用鼠标侧键或单个修饰键。",
    "keybinds.resetAll": "全部重置",
    "keybinds.removedFrom": "这些按键已被取消：{actions}",
    "keybinds.changeFor": "更改“{action}”的快捷键",
    "keybinds.pressKey": "请按键…（按 Esc 取消）",
    "keybinds.pressKeyOrButton": "请按键或鼠标按钮…（按 Esc 取消）",
    "keybinds.notSet": "未设置",
    "keybinds.clear": "移除快捷键",
    "keybinds.clearFor": "移除“{action}”的快捷键",
    "keybinds.reset": "重置为默认",
    "keybinds.resetFor": "将“{action}”重置为默认",
    "keybinds.pushToTalkHint":
        "设置按键后会开启按键说话：通话中仅在按住时麦克风才会发送声音。",
    "keybinds.pushToMuteHint": "按住时你的麦克风会被静音。",
    "keybinds.globalVoice": "Zam 不在焦点时也生效",
    "keybinds.globalVoiceHint":
        "按键说话、按键静音、切换静音和切换拒听在你使用其他应用时也能生效。Zam 只监听绑定给它们的按键，不会阻止其他应用接收这些按键。",
    "keybinds.globalWayland":
        "此处不可用：这个 Wayland 桌面不向应用提供全局快捷键（GlobalShortcuts portal），因此语音快捷键仅在 Zam 处于焦点时生效。",
    "keybinds.globalPermission":
        "需要先在 macOS 中允许：在“系统设置 > 隐私与安全性 > 辅助功能”中打开 Zam，然后返回 Zam。",
    "keybinds.globalOpenSettings": "打开系统设置",
    "keybinds.globalError":
        "Zam 无法开始监听其他应用中的按键（{error}）。语音快捷键在 Zam 处于焦点时生效。",
    "keybinds.globalPortalHint":
        "按键说话、按键静音、切换静音和切换拒听在你使用其他应用时也能生效。在 Wayland 上，由你的桌面为 Zam 运行这些快捷键：它可能会要求你确认或选择其他按键，其他应用将不再收到这些按键。",
    "keybinds.globalPortalAssigned": "你的桌面分配的按键：",
    "keybinds.globalPortalMouse":
        "鼠标按钮不能用作桌面快捷键：请在你桌面的设置中为它们选择一个按键。",
    "keybinds.globalPortalConfigure": "在系统设置中更改",
    "keybinds.globalPortalError":
        "你的桌面未能设置快捷键（{error}）。请关闭后再重新开启以重试。",
    "keybinds.helpTitle": "键盘快捷键",
    "keybinds.customize": "自定义",
    "keybinds.category.navigation": "导航",
    "keybinds.category.chat": "聊天",
    "keybinds.category.voice": "语音和通话",
    "keybinds.category.app": "应用",
    "keybinds.action.quickSwitcher": "快速切换",
    "keybinds.action.prevChannel": "上一个频道",
    "keybinds.action.nextChannel": "下一个频道",
    "keybinds.action.prevUnreadChannel": "上一个未读频道",
    "keybinds.action.nextUnreadChannel": "下一个未读频道",
    "keybinds.action.prevMentionChannel": "上一个有提及的频道",
    "keybinds.action.nextMentionChannel": "下一个有提及的频道",
    "keybinds.action.prevServer": "上一个空间",
    "keybinds.action.nextServer": "下一个空间",
    "keybinds.action.navigateBack": "后退",
    "keybinds.action.navigateForward": "前进",
    "keybinds.action.previousTextChannel": "返回上一个频道",
    "keybinds.action.returnToCall": "返回通话",
    "keybinds.action.markChannelRead": "将频道标为已读",
    "keybinds.action.markServerRead": "将空间标为已读",
    "keybinds.action.jumpToOldestUnread": "跳到最早的未读消息",
    "keybinds.action.emojiPicker": "表情选择器",
    "keybinds.action.gifPicker": "GIF 选择器",
    "keybinds.action.stickerPicker": "贴纸选择器",
    "keybinds.action.uploadFile": "上传文件",
    "keybinds.action.search": "搜索",
    "keybinds.action.togglePins": "置顶消息",
    "keybinds.action.toggleInbox": "通知收件箱",
    "keybinds.action.toggleMembers": "成员列表",
    "keybinds.action.toggleMute": "切换静音",
    "keybinds.action.toggleDeafen": "切换拒听",
    "keybinds.action.pushToTalk": "按键说话",
    "keybinds.action.pushToMute": "按键静音",
    "keybinds.action.answerCall": "接听来电",
    "keybinds.action.declineCall": "拒接来电",
    "keybinds.action.startCall": "在此房间发起或加入通话",
    "keybinds.action.toggleCamera": "切换摄像头",
    "keybinds.action.toggleScreenShare": "切换屏幕共享",
    "keybinds.action.leaveCall": "离开通话",
    "keybinds.action.openSettings": "打开设置",
    "keybinds.action.createDm": "新建私信",
    "draftDm.intro": "这是你与 {name} 私信的开始。",
    "draftDm.lazyNote":
        "在你发送第一条消息之前不会创建任何内容。届时才会邀请 {name}。",
    "draftDm.placeholder": "给 {name} 发消息",
    "draftDm.send": "发送",
    "draftDm.starting": "正在开始对话...",
    "draftDm.encrypted": "将启用端到端加密",
    "draftDm.discard": "丢弃草稿",
    "draftDm.couldNotStart": "无法开始对话",
    "keybinds.action.createOrJoinSpace": "创建或加入空间",
    "keybinds.action.shortcutsHelp": "显示键盘快捷键",
    "keybinds.action.toggleDebug": "切换调试面板",
    "quickSwitcher.title": "你想去哪里？",
    "quickSwitcher.placeholder": "搜索房间、私信和空间",
    "quickSwitcher.recentAndUnread": "最近和未读",
    "quickSwitcher.noResults": "没有匹配项",
    "quickSwitcher.mentioned": "被提及",
    "quickSwitcher.space": "空间",
    "quickSwitcher.home": "主页",
    "quickSwitcher.hint": "↑↓ 移动，Enter 打开，Esc 关闭",

    // src/lib/components/settings/DebugSettings.svelte
    "debugSettings.developer": "开发者",
    "debugSettings.showAllEvents": "显示所有事件",
    "debugSettings.orderHints": "消息顺序提示",
    "debugSettings.orderHintsHint":
        "Zam 会在你的消息中加入一条提示，说明你聊天记录底部是什么内容，并将其他 Zam 用户的消息放在其所指向的那条消息下方。关闭后，消息按服务器的顺序显示，与 Element 一样。",
    "debugSettings.displayEveryMatrixTimelineEventIn":
        "在聊天记录中显示每一个 Matrix 时间线事件。",
    "debugSettings.ignoreCodecSupport": "忽略报告的编解码器支持情况",
    "debugSettings.ignoreCodecSupportHint":
        "即使其他人表示无法解码，也发送所选的编解码器，并接受此设备列出的所有编解码器（包括被标记为有问题而屏蔽的）。用于测试，例如 Linux 上的 HEVC。",
    "debugSettings.h264ProfileFix": "GPU H.264 配置文件修复",
    "debugSettings.h264ProfileFixHint":
        "即使服务器回应 Constrained Baseline（Chromium 会用软件编码），通话也使用 GPU 的 H.264 编码器。关闭后可查看不使用此修复时通话获得的编码器。在 Windows 桌面版上，Chromium 标志在重启后才会更改。",
    "debugSettings.voiceProcessing": "语音处理",
    "debugSettings.pauseGate": "静音间隔门限",
    "debugSettings.pauseGateHint":
        "在降噪之后，将停顿处再降低 20 dB。默认关闭；可能会截掉较轻的词首。",
    "debugSettings.noiseAttenuationLimit": "降噪上限：{value} dB",
    "debugSettings.noiseAttenuationLimitHint":
        "噪声过滤器（DeepFilterNet3 或 DPDFNet）对信号任何部分最多可削减的量（默认 {value}）。100 表示不设限。",
    "debugSettings.soundboardInterval": "音效板间隔：{value} 毫秒",
    "debugSettings.soundboardIntervalHint":
        "同一个人的音效之间的最短间隔。其他人更快到达的音效会被忽略（默认 1500）。",
    "debugSettings.syncStatus": "同步状态",
    "debugSettings.clientLogs": "客户端日志",
    "debugSettings.clientLogsHint":
        "应用自启动以来记录的全部内容，已移除令牌、密码和密钥。报告错误时请附上这些日志。",
    "debugSettings.copyLogs": "复制日志",
    "debugSettings.saveLogs": "保存日志",
    "debugSettings.clientLogsCopyFailed": "无法复制日志",
    "debugSettings.clientLogsSaveFailed": "无法保存日志",
    "debugSettings.webViewDebugging": "WebView 调试",
    "debugSettings.webViewDebuggingHint":
        "允许通过 USB 连接的电脑在 chrome://inspect 检查此应用。重启后仍保持开启，直到你将其关闭。",
    "debugSettings.syncLog": "同步日志",
    "debugSettings.syncLogEmpty":
        "尚无记录。重启、失败的请求和时间线重置会显示在这里。",
    "debugSettings.refresh": "刷新",
    "debugSettings.copied": "已复制",
    "debugSettings.useSlidingSync": "使用滑动同步",
    "debugSettings.experimentalLoadsRoomsInAGrowing":
        "实验性。在不断扩大的窗口中加载房间。会重新加载应用以生效。",
    "debugSettings.pushStatus": "推送状态",
    "debugSettings.lastError": "最近的错误：{lastError}",
    "debugSettings.runDiagnostics": "运行诊断",
    "debugSettings.homeserverPushers": "主服务器推送器",
    "debugSettings.theHomeserverHasNoPushersRegistered":
        "主服务器上没有为此账户注册推送器。",
    "debugSettings.aPusherMatchesTheConfiguredGateway":
        "有一个推送器与已配置的网关 URL 匹配。",
    "debugSettings.noPusherMatchesTheConfiguredGateway":
        "没有推送器与已配置的网关 URL 匹配。",
    "debugSettings.appId": "app_id: {app_id}",
    "debugSettings.none": "（无）",
    "debugSettings.url": "url: {value}",
    "debugSettings.pushkey": "pushkey: {pushkeyPreview}",
    "debugSettings.webPushPwa": "Web Push（PWA）",
    "debugSettings.missing": "（缺失）",
    "debugSettings.vapidKey": "VAPID 密钥：{value}",
    "debugSettings.permission": "权限：{permission}",
    "debugSettings.subscription": "订阅：{value}",
    "debugSettings.notFound": "未找到",
    "debugSettings.homeserverPusher": "主服务器推送器：{value}",
    "debugSettings.error": "错误：{error}",
    "debugSettings.gatewaySygnalFirebase": "网关（Sygnal / Firebase）",
    "debugSettings.gatewayReachable": "网关可访问",
    "debugSettings.gatewayNotReachable": "网关无法访问",
    "debugSettings.nativeSessionPushEnrichment": "原生会话（推送增强）",
    "debugSettings.homeserver": "主服务器：{value}",
    "debugSettings.user": "用户：{value}",
    "debugSettings.device": "设备：{value}",
    "debugSettings.accessToken": "访问令牌：{value}",
    "debugSettings.hideMessageText": "隐藏消息文本：{value}",
    "debugSettings.notificationRulesServer": "通知规则（服务器）",
    "debugSettings.syncMode": "同步模式",
    "debugSettings.slidingSyncMsc4186": "滑动同步（MSC4186）",
    "debugSettings.classicSyncV2": "经典 /sync（v2）",
    "debugSettings.syncState": "同步状态",
    "debugSettings.fallback": "回退",
    "debugSettings.slidingSyncEndpoint": "滑动同步端点",
    "debugSettings.joinedRoomsLoaded": "已加载的已加入房间",
    "debugSettings.roomListWindow": "房间列表窗口",
    "debugSettings.of": "{requested} / {total}",
    "debugSettings.platform": "平台",
    "debugSettings.nativeCapacitor": "原生（Capacitor）",
    "debugSettings.pushEnabledInBuild": "构建中已启用推送",
    "debugSettings.yes": "是",
    "debugSettings.no": "否",
    "debugSettings.hideUpdatePrompts": "隐藏更新提示",
    "debugSettings.hideUpdatePromptsHint":
        "停止显示更新横幅和提示。仍会检查更新，并且在开启自动更新时仍会自行安装。",
    "debugSettings.gatewayUrl": "网关 URL",
    "debugSettings.appId2": "应用 ID",
    "debugSettings.notificationPermission": "通知权限",
    "debugSettings.fcmToken": "FCM 令牌",
    "debugSettings.pushProvider": "推送提供方",
    "debugSettings.unifiedPushDistributor": "UnifiedPush 分发器",
    "debugSettings.unifiedPushEndpoint": "UnifiedPush 端点",
    "debugSettings.unifiedPushGateway": "UnifiedPush 网关",
    "debugSettings.pusherRegisteredThisSession": "本次会话已注册推送器",
    "debugSettings.failedToFetchPushersFromHomeserver":
        "从主服务器获取推送器失败。",
    "debugSettings.set": "已设置",
    "debugSettings.active": "生效中",
    "debugSettings.allNotificationsMasterRule": "所有通知（总开关规则）",

    // src/lib/components/ui/EmojiPicker.svelte
    "emojiPicker.searchEmoji": "搜索表情符号…",
    "emojiPicker.searchEmoji2": "搜索表情符号",
    "emojiPicker.myEmojis": "我的表情",
    "emojiPicker.custom": "自定义",
    "emojiPicker.standard": "标准",
    "emojiPicker.myEmojis2": "我的表情",

    // src/lib/components/ui/ErrorToasts.svelte
    "errorToasts.dismiss": "忽略",

    // src/lib/components/settings/ExtendedProfileDebug.svelte
    "extendedProfileDebug.extendedProfile": "扩展个人资料",
    "extendedProfileDebug.fetchFromServer": "从服务器获取",
    "extendedProfileDebug.thisServerDoesNotSupportExtended":
        "此服务器不支持扩展个人资料。",
    "extendedProfileDebug.noneOrTheServerRefused": "无，或服务器拒绝了请求",
    "extendedProfileDebug.presenceGetPresenceStraightFromThe":
        "在线状态（GET /presence，直接来自服务器）：{value}",
    "extendedProfileDebug.notAdvertisedNoRestrictions": "未声明（无限制）",
    "extendedProfileDebug.serverRulesForFieldsMProfile":
        "服务器对字段的规则（m.profile_fields）：{value}",
    "extendedProfileDebug.failedToFetchTheProfile": "获取个人资料失败",
    "extendedProfileDebug.couldNotCopyToClipboard": "无法复制到剪贴板",

    // src/lib/components/ui/FlashEmbed.svelte
    "flashEmbed.suspend": "暂停",
    "flashEmbed.resize": "调整播放器大小",
    "flashEmbed.resizeHint": "拖动或使用方向键调整大小。双击可重置。",

    // src/lib/components/messages/ForwardMessageDialog.svelte
    "forwardMessageDialog.forwardMessage": "转发消息",
    "forwardMessageDialog.searchRooms": "搜索房间",
    "forwardMessageDialog.noJoinedRoomsFound": "未找到已加入的房间",
    "forwardMessageDialog.forwarding": "正在转发…",
    "forwardMessageDialog.forward": "转发",
    "forwardMessageDialog.failedToForwardMessage": "转发消息失败",

    // src/lib/components/settings/GeneralSettings.svelte
    "generalSettings.desktop": "桌面",
    "proxySettings.network": "网络",
    "proxySettings.proxy": "代理",
    "proxySettings.modeSystem": "使用系统设置",
    "proxySettings.modeDirect": "不使用代理",
    "proxySettings.modeManual": "手动",
    "proxySettings.modePac": "自动配置（PAC）",
    "proxySettings.launchFlagsInUse": "正在使用的启动参数：",
    "proxySettings.server": "代理服务器",
    "proxySettings.serverHint":
        "socks5://、socks4://、http:// 或 https://，后接主机和端口。Tor 通常是 socks5://127.0.0.1:9050。",
    "proxySettings.bypass": "以下地址不使用代理",
    "proxySettings.pacUrl": "PAC 文件 URL",
    "proxySettings.calls": "通话",
    "proxySettings.callsDefault": "默认（UDP 直连，TCP 经代理）",
    "proxySettings.callsDirect": "直接连接通话服务器",
    "proxySettings.callsProxy": "仅通过代理",
    "proxySettings.callsDefaultHint":
        "代理无法转发 UDP，因此通话音频通常直连，只有在通话必须回退到 TCP 时才会经过代理。",
    "proxySettings.callsDirectHint":
        "整个通话都绕过代理：加入、与通话服务器的连接，以及通过 UDP 或 TCP 传输的音频和视频。其他一切仍使用代理。通话服务器会看到你的 IP 地址。",
    "proxySettings.callsProxyHint":
        "不进行直接连接，通话服务器也永远看不到你的 IP 地址：通话经代理，通过 TCP 或 TLS 连到通话服务器的 TURN 中继。如果服务器没有提供 TURN 中继，通话将无法连接。延迟会更高。",
    "proxySettings.callsDirectUnavailable":
        "通话无法绕过系统代理设置。请在此处设置代理（手动或 PAC）才能生效。",
    "proxySettings.callsDirectAddresses": "直连发送：",
    "proxySettings.save": "保存",
    "proxySettings.saved": "已保存",
    "proxySettings.applyFailed": "无法应用：{error}",
    "generalSettings.minimiseToTrayOnClose": "关闭时最小化到托盘",
    "generalSettings.keepZamRunningInTheSystem":
        "关闭窗口时让 Zam 继续在系统托盘中运行，而不是退出。可通过托盘图标重新打开或退出。",
    "generalSettings.runAtStartup": "开机启动",
    "generalSettings.startZamWhenYouLogIn": "登录电脑时启动 Zam。",
    "generalSettings.runAtStartupFailed": "你的系统不允许此操作。",
    "generalSettings.noGeneralSettingsAreAvailableOn":
        "此平台上没有可用的常规设置。",

    // src/lib/components/settings/RichPresenceSettings.svelte
    "richPresence.heading": "Rich Presence",
    "richPresence.share": "分享你正在做的事",
    "richPresence.shareHint":
        "让此电脑上的应用在你的个人资料中显示你正在玩或正在听的内容。默认允许所有应用；请在下方关闭你不想要的应用。",
    "richPresence.arrpc": "使用 Discord Rich Presence 的应用",
    "richPresence.arrpcHint":
        "同时接受向 Discord 报告的应用。如果 Discord 正在运行，应用通常会先向它报告，因此关闭 Discord 时效果最好。",
    "richPresence.scan": "检测游戏",
    "richPresence.scanHint":
        "查找此电脑上正在运行的游戏，这样不报告任何信息的游戏也会显示出来。这会每隔几秒读取一次正在运行的程序列表。",
    "richPresence.scanNeedsPermission":
        "Flatpak 沙盒无法看到其他程序。要让 Zam 查找游戏，请运行此命令，然后重启 Zam：",
    "richPresence.scanGrantCommand":
        "flatpak override --user --talk-name=org.freedesktop.Flatpak moe.crafty.matrix",
    "richPresence.scanFailed": "无法查找游戏：{error}",
    "richPresence.media": "报告媒体播放",
    "richPresence.mediaHint":
        "根据系统的“正在播放”信息，显示此电脑上媒体播放器正在播放的歌曲或视频。开启后默认允许每个播放器；请在下方关闭你不想要的播放器。",
    "richPresence.mediaFailed": "无法读取媒体播放信息：{error}",
    "richPresence.socket": "同时监听 {path}。",
    "richPresence.arrpcNeedsShare": "请先开启分享。",
    "richPresence.listening": "正在端口 {port} 上监听应用。",
    "richPresence.listenFailed": "无法开始监听：{error}",
    "richPresence.arrpcFailed": "无法启动 arRPC：{error}",
    "richPresence.hostNeedsPermission":
        "Flatpak 沙盒无法控制其他程序。要让 Zam 执行此操作，请运行此命令，然后重启 Zam：",
    "richPresence.fake": "假装 Discord 正在运行",
    "richPresence.fakeHint":
        "有些应用只有在名为 Discord 的进程正在运行时才会发送 Rich Presence。此选项会启动一个空闲进程，且仅在 Discord 本身未运行时才会启动。",
    "richPresence.fakeFailed": "无法启动：{error}",
    "richPresence.discordFirst":
        "Discord 先于 Zam 启动，因此应用会向 Discord 报告，Zam 看不到它们。",
    "richPresence.restartDiscord": "重启 Discord",
    "richPresence.restartDiscordTitle": "重启 Discord？",
    "richPresence.restartDiscordBody":
        "Discord 将关闭并重新打开，这会结束你正在进行的任何通话或直播。Zam 会抢先占位，使应用向它报告，再由 Zam 将它们的报告转交给 Discord。",
    "richPresence.restartDiscordFailed": "无法重启 Discord：{error}",
    "richPresence.autoRestart": "自动重启 Discord",
    "richPresence.autoRestartHint":
        "Zam 启动时，如果 Discord 已先于它运行，则关闭并重新打开 Discord，使应用向 Zam 报告。这会结束你正在进行的任何通话或直播。每次 Zam 启动时只会执行一次。",
    "richPresence.publishFailed": "无法更新你的个人资料。",
    "richPresence.gameList": "游戏列表：{count} 款游戏，更新于 {when}",
    "richPresence.gameListDownloading": "正在从 Discord 下载游戏列表…",
    "richPresence.gameListFailed": "无法下载游戏列表：{error}",
    "richPresence.addedGames": "已登记的游戏",
    "richPresence.addedGamesHint":
        "发现正在运行的游戏、应用和媒体播放器，以及你自己添加的程序。默认允许每一项出现在你的个人资料中；请关闭你不想要的项。仅在“检测游戏”开启时才会发现游戏，仅在“报告媒体播放”开启时才会发现媒体播放器。",
    "richPresence.addGame": "添加游戏",
    "richPresence.pickProgram": "选择一个正在运行的程序",
    "richPresence.searchPrograms": "搜索正在运行的程序",
    "richPresence.noPrograms": "未找到正在运行的程序。",
    "richPresence.gameName": "在你的个人资料中显示的名称",
    "richPresence.refreshPrograms": "刷新",
    "richPresence.lastPlayed": "上次游玩：{when}",
    "richPresence.neverPlayed": "尚未游玩",
    "richPresence.apps": "应用",
    "richPresence.noApps":
        "还没有应用报告任何内容。报告后的应用会显示在这里，除非你将其关闭，否则默认允许。",
    "richPresence.allowApp": "允许 {name}",
    "richPresence.forgetApp": "忘记 {name}",
    "richPresence.forget": "忘记",
    "richPresence.viaDiscord": "游戏或 Discord Rich Presence",
    "richPresence.viaMatrix": "Matrix 应用",
    "richPresence.viaScan": "进程扫描",
    "richPresence.viaRpc": "Discord Rich Presence",
    "richPresence.viaMedia": "媒体播放器",
    "richPresence.viaPlugin": "插件",
    "richPresence.blocked": "已屏蔽",
    "richPresence.allowed": "已允许",

    // src/lib/components/ui/RichPresenceCard.svelte
    "richPresenceCard.playing": "正在玩 {name}",
    "richPresence.sharingTitle": "显示在你的个人资料中",
    "richPresenceCard.listening": "正在听 {name}",
    "richPresenceCard.elapsed": "已过 {time}",
    "richPresenceCard.remaining": "剩余 {time}",
    "richPresenceCard.openLinkTitle": "打开此链接？",
    "richPresenceCard.openLinkBody": "{name} 请求在你的浏览器中打开此地址：",
    "richPresenceCard.openidWarning":
        "此链接还携带了你的 Matrix 账户的 OpenID 令牌。该网站可以借此获知你的 Matrix ID 和主服务器，并且会看到你的 IP 地址。",
    "richPresenceCard.open": "打开",
    "richPresenceCard.openFailed": "无法获取 OpenID 令牌。",

    // src/lib/components/ui/GifPicker.svelte
    "gifPicker.searchFavourites": "搜索收藏…",
    "gifPicker.searchKlipy": "搜索 KLIPY…",
    "gifPicker.searchFavourites2": "搜索收藏",
    "gifPicker.searchGifs": "搜索 GIF",
    "gifPicker.gifResults": "GIF 结果",
    "gifPicker.noFavouriteGifsYetStarA":
        "还没有收藏的 GIF。给 GIF 加星即可保存在这里。",
    "gifPicker.favourites": "收藏",
    "gifPicker.gifTagged": "标签为 {join} 的 GIF",
    "gifPicker.favouriteGif": "收藏的 GIF {value}",
    "gifPicker.editTags": "编辑标签",
    "gifPicker.catFunny": "猫, 搞笑",
    "gifPicker.commaSeparatedEnterToSave": "用逗号分隔 · 按 Enter 保存",
    "gifPicker.trending": "热门",
    "gifPicker.gifResult": "GIF 结果 {value}",
    "gifPicker.favourite": "收藏",
    "gifPicker.poweredByKlipy": "由 KLIPY 提供支持",

    // src/lib/components/layout/ImagePackEditor.svelte
    "imagePackEditor.addImage": "添加图片",
    "imagePackEditor.newPack": "新建图片包",
    "imagePackEditor.packName": "图片包名称",
    "imagePackEditor.shortcode": "短代码",
    "imagePackEditor.useAsEmoji": "用作表情",
    "imagePackEditor.useAsSticker": "用作贴纸",
    "imagePackEditor.inheritedFrom": "继承自 {sourceName}",
    "imagePackEditor.sticker": "贴纸",
    "imagePackEditor.removeImage": "移除图片",
    "imagePackEditor.noCustomImages": "没有自定义图片",
    "imagePackEditor.emotes": "{value} 表情",
    "imagePackEditor.room": "房间",
    "imagePackEditor.chooseAtLeastOneUsage": "请至少选择一种用途。",
    "imagePackEditor.enterAPackName": "请输入图片包名称。",
    "imagePackEditor.uploadFailed": "上传失败",
    "imagePackEditor.failedToUpdateUsage": "更新用途失败",
    "imagePackEditor.failedToRemoveImage": "移除图片失败",
    "imagePackEditor.failedToUpdatePack": "更新图片包失败",
    "imagePackEditor.addToMine": "添加到我的图片包",
    "imagePackEditor.addAllToMyPack": "将此包中的所有图片复制到你自己的图片包",
    "imagePackEditor.addImageToMyPack": "将此图片复制到你自己的图片包",
    "imagePackEditor.addedToYourPack":
        "{count, plural, other {已将 # 张图片添加到你的图片包。}}",
    "imagePackEditor.alreadyInYourPack": "已在你的图片包中。",
    "imagePackEditor.editDetails": "编辑详情",
    "imagePackEditor.deletePack": "删除图片包",
    "imagePackEditor.confirmDeletePack": "删除图片包“{name}”及其所有图片？",
    "imagePackEditor.useInAllRooms": "在我所有的房间中使用",
    "imagePackEditor.useInAllRoomsHint":
        "其中的表情和贴纸会在你聊天的所有地方显示。",
    "imagePackEditor.attribution": "署名：{value}",
    "imagePackEditor.attributionPlaceholder": "署名 / 出处（可选）",
    "imagePackEditor.uploadPackAvatar": "上传图片包图标",
    "imagePackEditor.removePackAvatar": "移除图标",
    "imagePackEditor.avatarReady": "图标已上传，保存后生效。",
    "sharedPackSettings.yourPackDetails": "你的图片包详情",
    "sharedPackSettings.enabledEverywhere": "在所有房间启用的图片包",
    "sharedPackSettings.enabledEverywhereHint":
        "你所在房间中的图片包可以在每个房间使用，而不仅限于拥有它们的房间。",
    "sharedPackSettings.availableInYourRooms": "你房间中的图片包",
    "sharedPackSettings.searchPacks": "搜索图片包",
    "sharedPackSettings.noPacksFound": "未找到图片包",
    "sharedPackSettings.noneEnabled": "没有在所有房间启用的图片包",
    "sharedPackSettings.enable": "在所有地方使用",
    "sharedPackSettings.disable": "停止在所有地方使用",
    "sharedPackSettings.remove": "移除",
    "sharedPackSettings.unavailable":
        "不可用：你已不在 {room} 中，或该图片包已被移除",
    "sharedPackSettings.packSummary":
        "{room}，{count, plural, other {# 张图片}}",
    "sharedPackSettings.failedToSave": "保存失败",

    // src/lib/components/layout/InboxPanel.svelte
    "inboxPanel.inbox": "收件箱",
    "inboxPanel.noPendingInvites": "没有待处理的邀请",
    "inboxPanel.roomInvitesWillAppearHere": "房间邀请会显示在这里。",
    "inboxPanel.pendingInvites": "待处理的邀请：{length}",
    "inboxPanel.invitedBy": "邀请人：{sender}",
    "inboxPanel.ignore": "忽略",
    "inboxPanel.accept": "接受",
    "inboxPanel.pendingJoinRequests": "待处理的加入请求：{length}",
    "inboxPanel.youAskedToJoinWaitingFor":
        "你已申请加入，正在等待有人放你进入。",
    "inboxPanel.cancelRequest": "取消申请",
    "inboxPanel.failedToAcceptInvite": "接受邀请失败",
    "inboxPanel.failedToRejectInvite": "拒绝邀请失败",
    "inboxPanel.failedToCancelJoinRequest": "取消加入申请失败",

    // src/lib/components/layout/IncomingCallCard.svelte
    "incomingCallCard.incomingCall": "来电",
    "incomingCallCard.declineCallFrom": "拒接 {name} 的来电",
    "incomingCallCard.accept": "接听",
    "incomingCallCard.acceptCallFrom": "接听 {name} 的来电",
    "incomingCallCard.unknown": "未知",

    // src/lib/components/layout/InvitePanel.svelte
    "invitePanel.invitePeopleTo": "邀请成员加入",
    "invitePanel.invited": "已邀请",
    "invitePanel.failed": "失败",
    "invitePanel.inviteByEmail": "通过邮箱邀请",
    "invitePanel.nameExampleCom": "name@example.com",
    "invitePanel.inviting": "正在邀请…",
    "invitePanel.invite": "邀请",
    "invitePanel.invite2": "邀请 {length} 人",
    "invitePanel.enterAValidEmailAddress": "请输入有效的邮箱地址。",
    "invitePanel.couldNotSendTheEmailInvite": "无法发送邮件邀请",
    "invitePanel.couldNotSendTheInvite": "无法发送邀请",
    "invitePanel.thisRoom": "此房间",
    "invitePanel.thisSpace": "此空间",

    // src/lib/components/layout/JoinConsentDialog.svelte
    "joinConsentDialog.joinThisRoom": "加入此房间？",
    "joinConsentDialog.youClickedALinkTo": "你点击了一个链接，指向",
    "joinConsentDialog.joiningSharesYourMatrixIdWith":
        "。加入后，你的 Matrix ID 将对房间内所有人可见，并且该房间会加入你的房间列表。",
    "joinConsentDialog.thisOpensRoom": "这将打开房间",
    "joinConsentDialog.warningThisLinkPointsAtA":
        "警告：此链接指向的服务器与其解析到的房间所在的服务器不同。仅在你信任发送者时才继续。",
    "joinConsentDialog.joinRoom": "加入房间",

    // src/lib/components/ui/Lightbox.svelte
    "lightbox.closeViewer": "关闭{mediaNoun}查看器",
    "lightbox.viewer": "{MediaNoun}查看器{value}",
    "lightbox.download": "下载",
    "lightbox.previous": "上一个",
    "lightbox.previous2": "上一个{mediaNoun}",
    "lightbox.next": "下一个",
    "lightbox.next2": "下一个{mediaNoun}",
    "lightbox.couldNotLoadThisVideoUse":
        "无法加载此视频。请使用“下载”来保存它。",
    "lightbox.video": "视频",
    "lightbox.image": "图片",
    "lightbox.videoNoun": "视频",
    "lightbox.imageNoun": "图片",
    "lightbox.zoomIn": "放大",
    "lightbox.zoomOut": "缩小",
    "lightbox.zoomReset": "重置缩放",

    // src/lib/components/messages/LinkPreview.svelte
    "linkPreview.youtubeVideo": "YouTube 视频",
    "linkPreview.xTwitter": "X / Twitter",
    "linkPreview.loadingItContactsTheSiteHosting":
        "加载时会连接托管它的网站，这会暴露你的 IP 地址",
    "linkPreview.loadPreviewMedia": "加载预览媒体",
    "linkPreview.playVideo": "播放视频",

    // src/lib/components/layout/LiveLocationBanner.svelte
    "liveLocationBanner.openMap": "打开地图",
    "liveLocationBanner.sharingLiveLocation": "正在共享实时位置",
    "liveLocationBanner.lastUpdatedAt":
        " · 最后更新于 {timeOnly}（{updatedAgoLabel}）",
    "liveLocationBanner.map": "地图",
    "liveLocationBanner.isSharingLiveLocation":
        "{getMemberName} 正在共享实时位置",
    "liveLocationBanner.peopleSharingLiveLocation":
        "{length} 人正在共享实时位置",
    "liveLocationBanner.viewMap": "查看地图",

    // src/lib/components/layout/LiveLocationMapView.svelte
    "liveLocationMapView.back": "返回",
    "liveLocationMapView.liveLocation": "实时位置",
    "liveLocationMapView.recenter": "重新居中",
    "liveLocationMapView.waitingForALocationFix": "正在等待定位…",
    "liveLocationMapView.sharingLiveLocation": "正在共享实时位置",
    "liveLocationMapView.lastUpdatedAt":
        "最后更新于 {timeOnly}（{updatedAgoLabel}）",
    "liveLocationMapView.osm": "OSM",
    "liveLocationMapView.noActiveLiveSharesInThis":
        "此房间中没有正在进行的实时共享。",
    "liveLocationMapView.you": "你",

    // src/lib/components/messages/LocationBody.svelte
    "locationBody.openstreetmap": "OpenStreetMap",
    "locationBody.googleMaps": "Google 地图",

    // src/lib/components/layout/LoginView.svelte
    "loginView.signIn": "登录",
    "loginView.register": "注册",
    "loginView.zam": "Zam - {value}",
    "loginView.addAnAccount": "添加账户",
    "loginView.welcomeBack": "欢迎回来！",
    "loginView.signInWithAnotherMatrixAccount": "使用另一个 Matrix 账户登录",
    "loginView.signInToYourMatrixAccount": "登录你的 Matrix 账户",
    "loginView.createAnAccount": "创建账户",
    "loginView.registerOnAMatrixHomeserver": "在 Matrix 主服务器上注册",
    "loginView.homeserver": "主服务器",
    "loginView.username": "用户名",
    "loginView.password": "密码",
    "loginView.registrationToken": "注册令牌",
    "loginView.ifRequired": "（如需要）",
    "loginView.leaveBlankIfNotRequired": "如不需要请留空",
    "loginView.useSlidingSync": "使用滑动同步",
    "loginView.fasterStartupOnServersThatSupport": "在支持的服务器上启动更快。",
    "loginView.pleaseWait": "请稍候…",
    "loginView.logIn": "登录",
    "loginView.createAccount": "创建账户",
    "loginView.donTHaveAnAccount": "还没有账户？",
    "loginView.alreadyHaveAnAccount": "已有账户？",
    "loginView.signIn2": "登录",
    "loginView.backTo": "← 返回 {activeUserId}",
    "loginView.orContinueAs": "或以以下身份继续",
    "loginView.yourCredentialsAreSentDirectlyTo":
        "你的凭据会直接发送到你的主服务器，除你的设备外，本应用不会存储它们。",
    "loginView.loggingIn": "正在登录…",
    "loginView.loginFailedCheckYourCredentials": "登录失败。请检查你的凭据。",
    "loginView.creatingAccount": "正在创建账户…",
    "loginView.registrationFailed": "注册失败。",
    "loginView.or": "或",
    "loginView.continueWithSso": "使用 SSO 继续",
    "loginView.continueWith": "使用 {name} 继续",
    "loginView.redirectingToSso": "正在跳转到你的登录提供方…",
    "loginView.finishSsoInBrowser": "请在浏览器中完成登录，然后回到这里。",
    "loginView.ssoCouldNotBeVerified": "无法验证单点登录。请重试。",
    "loginView.ssoFailed": "单点登录失败。",
    "loginView.continue": "继续",
    "loginView.signInOnProviderPage":
        "你将在主服务器自己的页面上登录，然后回到这里。",
    "loginView.oauthCancelled": "登录已取消。",
    "loginView.oauthDenied": "登录提供方拒绝了请求：{reason}",
    "loginView.oauthCouldNotBeVerified": "无法验证登录。请重试。",
    "loginView.oauthFailed": "登录失败。请重试。",
    "loginView.oauthRegistrationRefused": "此服务器不允许 Zam 注册登录。",
    "loginView.oauthRegistrationRefusedFallback":
        "此服务器不允许 Zam 注册登录。请使用下方的其他选项。",
    "loginView.checkingServer": "正在检查服务器…",
    "loginView.homeserverHint":
        "你的账户所在的服务器：@you:server 中冒号后面的部分。",
    "loginView.homeserverHintRegister":
        "你的账户将位于此服务器上。不确定？matrix.org 免费且向所有人开放。",
    "loginView.oauthLoginExplainer":
        "{server} 在其自己的账户页面上让你登录。Zam 会打开该页面，登录后你会直接回到这里。",
    "loginView.oauthRegisterExplainer":
        "{server} 在其自己的账户页面上创建新账户。Zam 会打开该页面；请在那里选择用户名和密码，之后你会直接登录并回到这里。",
    "loginView.continueTo": "继续前往 {host}",
    "loginView.createAccountOn": "在 {server} 上创建账户",
    "loginView.advancedOptions": "高级选项",

    // src/lib/components/layout/EncryptionSetupDialog.svelte
    "encryptionSetup.setupTitle": "保护你的消息",
    "encryptionSetup.setupBody":
        "你的私密聊天已进行端到端加密。设置恢复功能后，你之后在任何登录的设备上都能阅读它们，即使丢失了这台设备也不例外。只需几秒钟。",
    "encryptionSetup.passwordBody": "输入你的账户密码以确认是你本人。",
    "encryptionSetup.setUp": "设置恢复",
    "encryptionSetup.later": "以后再说",
    "encryptionSetup.saveKeyTitle": "保存你的恢复密钥",
    "encryptionSetup.saveKeyBody":
        "此密钥可在新设备上解锁你的加密消息。它只会显示一次：请将其保存到密码管理器或下载下来。没有它，丢失设备可能意味着丢失消息。",
    "encryptionSetup.downloadKey": "下载",
    "encryptionSetup.keyFileHeader": "{userId} 的 Zam 恢复密钥",
    "encryptionSetup.doneTitle": "一切就绪",
    "encryptionSetup.doneBody":
        "此设备上已设置好加密。你的消息以及来自其他设备的历史记录都可以在这里使用。",
    "encryptionSetup.confirmTitle": "确认是你本人",
    "encryptionSetup.confirmBody":
        "此账户已在使用加密。请确认这台新设备，使其能够读取你的加密消息和历史记录。",
    "encryptionSetup.useAnotherDevice": "使用另一台设备",
    "encryptionSetup.useRecoveryKey": "使用恢复密钥",
    "encryptionSetup.anotherDeviceHint":
        "另一台设备指你已经登录的设备，例如手机上的 Zam 或 Element 应用。它会显示一个待批准的请求。",
    "encryptionSetup.recoveryKeyHint":
        "你的恢复密钥以“EsT”开头。你在首次设置加密时已保存过它。",
    "encryptionSetup.cantConfirm": "恢复密钥和其他设备都丢了？",
    "encryptionSetup.enterKeyTitle": "输入你的恢复密钥",
    "encryptionSetup.enterKeyBody":
        "粘贴你在设置加密时保存的恢复密钥。空格无关紧要。",
    "encryptionSetup.enterPassphraseBody":
        "输入你在设置加密时选择的恢复密码短语。",
    "encryptionSetup.back": "返回",
    "encryptionSetup.connectBackupTitle": "恢复你的消息历史",
    "encryptionSetup.connectBackupBody":
        "此设备已验证，但尚未连接到你的加密消息备份。输入你的恢复密钥以恢复历史记录。",
    "encryptionSetup.checking": "正在检查你的加密…",
    "encryptionSetup.tryAgain": "重试",
    "encryptionSetup.openSecuritySettings": "打开安全设置",

    // src/lib/matrix/registration.ts
    "registration.cancelled": "账户创建已取消。",
    "registration.noSupportedFlow":
        "此服务器要求一个 Zam 无法完成的注册步骤。请尝试在该服务器自己的网站上创建账户。",
    "registration.stageKeptFailing": "服务器一再拒绝某个注册步骤。请重试。",
    "registration.userInUse": "该用户名已被占用。请换一个。",
    "registration.invalidUsername":
        "该用户名不被允许。请使用小写字母、数字以及 . _ = - /",
    "registration.exclusiveUsername":
        "该用户名在此服务器上已被保留。请换一个。",
    "registration.weakPassword": "该密码太弱。请使用更长的密码。",
    "registration.weakPasswordReason": "该密码太弱：{reason}",
    "registration.emailInUse": "该邮箱地址已被另一个账户使用。",
    "registration.emailNotAllowed": "此服务器不接受该邮箱地址。",
    "registration.rateLimited": "尝试次数过多。请等待一分钟后重试。",
    "registration.stepNotAccepted": "服务器未接受该步骤。请重试。",
    "registration.closed": "此服务器不接受新账户。",
    "registration.invalidToken": "该注册令牌无效。请检查后重试。",
    "registration.refused": "服务器拒绝创建账户。",
    "registration.refusedReason": "服务器拒绝创建账户：{reason}",
    "registration.serverUnreachable":
        "无法连接到服务器。请检查地址和你的网络连接。",
    "registration.usernameLowercase": "用户名必须为小写。",
    "registration.usernameCharacters": "只能使用小写字母、数字以及 . _ = - /",
    "registration.usernameHint": "选择一个用户名。别人将通过它找到你。",
    "registration.usernameAvailable": "{userId} 可用",
    "registration.yourAddressWillBe": "你的地址将是 {userId}",
    "registration.confirmPassword": "确认密码",
    "registration.passwordsDontMatch": "两次输入的密码不一致。",
    "registration.closedOnServer":
        "{server} 目前不接受新账户。请选择另一台服务器来创建账户。",
    "registration.useOtherServer": "改为在 {server} 上创建账户",
    "registration.tokenTitle": "注册令牌",
    "registration.tokenBody":
        "{server} 仅限受邀者注册。请输入服务器管理员给你的注册令牌。",
    "registration.termsTitle": "接受服务器条款",
    "registration.termsBody": "{server} 要求你在创建账户前接受以下条款：",
    "registration.termsAccept": "我已阅读并接受这些条款",
    "registration.emailTitle": "确认你的邮箱",
    "registration.emailBody":
        "{server} 需要一个邮箱地址来创建你的账户。我们会向你发送一个确认链接。",
    "registration.emailPlaceholder": "you@example.com",
    "registration.sendEmail": "发送邮件",
    "registration.emailSent":
        "我们已向 {email} 发送了一个链接。请打开它，然后回来点击“继续”。",
    "registration.emailNotConfirmed":
        "邮箱尚未确认。请打开其中的链接，然后点击“继续”。",
    "registration.emailConfirmed": "继续",
    "registration.captchaTitle": "证明你不是机器人",
    "registration.captchaBody":
        "{server} 要求你完成验证码。它会在服务器的页面上打开；完成后请回到这里。",
    "registration.fallbackTitle": "还有一步",
    "registration.fallbackBody":
        "{server} 需要你在其自己的页面上完成一个步骤。完成后请回到这里。",
    "registration.openStepPage": "打开页面",
    "registration.stepDone": "我已完成",

    // src/lib/components/layout/MemberList.svelte
    "memberList.members": "成员：{length}",
    "memberList.creators": "创建者：{length}",
    "memberList.admins": "管理员：{length}",
    "memberList.admin": "管理员",
    "memberList.moderators": "协管员：{length}",

    // src/lib/components/messages/MessageActionsSheet.svelte
    "messageActionsSheet.thisMessage": "{label}此消息？",
    "messageActionsSheet.messageActions": "消息操作",

    // src/lib/components/layout/MessageArea.svelte
    "messageArea.dropToAttach": "拖放以添加附件",
    "messageArea.cachedRoomHint":
        "正在显示保存在此设备上的消息。房间加载完成后即可发送。",
    "messageArea.unreadNotifications": "未读通知",
    "messageArea.encryptionEnabled": "已启用加密",
    "messageArea.joiningVoiceCall": "正在加入语音通话…",
    "messageArea.startVoiceCall": "发起语音通话",
    "messageArea.showCall": "打开通话视图",
    "messageArea.searchMessages": "搜索消息",
    "messageArea.threads": "消息列",
    "messageArea.toggleThreadsList": "切换消息列列表",
    "messageArea.unreadThreadMentions": "未读的消息列提及",
    "messageArea.unreadThreads": "未读消息列",
    "messageArea.pinnedMessages": "置顶消息",
    "messageArea.notificationsInbox": "通知收件箱",
    "messageArea.mediaAndFiles": "媒体和文件",
    "messageArea.toggleMemberList": "切换成员列表",
    "messageArea.more": "更多",
    "messageArea.moreRoomOptions": "更多房间选项",
    "messageArea.messageTimeline": "消息时间线",
    "messageArea.welcomeTo": "欢迎来到 #",
    "messageArea.thisIsTheBeginningOfThe": "这是 # 的开头",
    "messageArea.loadingHistory": "正在加载更早的消息",
    "messageArea.room": "房间。",
    "messageArea.newMessages": "新消息",
    "messageArea.messageFromABlockedUser": "来自被屏蔽用户的消息",
    "messageArea.showBlockedMessage": "显示被屏蔽的消息",
    "messageArea.thisRoomHasBeenUpgraded": "此房间已升级",
    "messageArea.goToNewRoom": "前往新房间",
    "messageArea.joinNewRoom": "加入新房间",
    "messageArea.jumpToPresent": "跳到最新",
    "messageArea.searchingForMessage": "正在查找消息…",
    "messageArea.viewingMessageContext": "正在查看消息上下文",
    "messageArea.returnToLive": "返回实时",
    "messageArea.closePanel": "关闭面板",
    "messageArea.someone": "某人",
    "messageArea.pinnedMessagesCount": "置顶消息（{count}）",

    // src/lib/components/messages/MessageInput.svelte
    "messageInput.replyingTo": "回复 {replyTargetName}",
    "messageInput.cancelReplyEsc": "取消回复（Esc）",
    "messageInput.editAttachment": "编辑附件",
    "messageInput.editAttachment2": "编辑附件 {name}",
    "messageInput.custom": "自定义",
    "messageInput.yourEmotes": "你的表情",
    "messageInput.yourNextMessageWillStartA": "你的下一条消息将开启一个",
    "messageInput.thread": "消息列",
    "messageInput.cancelThreadCreation": "取消创建消息列",
    "messageInput.favouriteGifs": "收藏的 GIF",
    "messageInput.sendMessage": "发送消息",
    "messageInput.isTyping": "{value} 正在输入…",
    "messageInput.andAreTyping": "{value}和 {value2} 正在输入…",
    "messageInput.andAreTyping2": "{value}、{value2}和 {value3} 正在输入…",
    "messageInput.severalPeopleAreTyping": "有几个人正在输入…",
    "messageInput.noPermissionToSend": "你无权在此发送消息",
    "messageInput.selectARoomToStartChatting": "选择一个房间开始聊天",
    "messageInput.replyInThread": "在消息列中回复...",
    "messageInput.replyTo": "回复 {replyTargetName}...",
    "messageInput.message": "给 #{roomName} 发消息",
    "messageInput.isNotAValidUser": "“{token}”不是有效的用户",
    "messageInput.noRoomSelected": "未选择房间",
    "messageInput.isNotInThisRoom": "{userId} 不在此房间中",
    "messageInput.youDonTHavePermissionTo": "你无权更改此房间的权限等级",
    "messageInput.unhandledCommand": "未处理的命令：/{name}",
    "messageInput.commandFailed": "命令执行失败",
    "messageInput.failedToSend": "发送失败",
    "messageInput.unknownCommandEnterAgain":
        "未知命令：/{unknown}。再按一次 Enter 可将其作为消息发送。",
    "messageInput.unknownCommandTapAgain":
        "未知命令：/{unknown}。再点一次发送可将其作为消息发送。",
    "messageInput.sedNoMessage": "这里没有可编辑的你的消息",
    "messageInput.sedNoMatch": "“{pattern}”不在你的上一条消息中",
    "messageInput.sedEmpty": "这样会让你的上一条消息变为空",
    "messageInput.sedFailed": "无法编辑你的上一条消息",
    "messageInput.sendingAttachments":
        "{count, plural, other {正在发送 # 个附件…}}",

    // src/lib/components/messages/MessageItem.svelte
    "messageItem.viewProfile": "查看个人资料",
    "messageItem.jumpToTheRepliedToMessage": "跳转到被回复的消息：",
    "messageItem.originalMessageNotLoaded": "原消息未加载",
    "messageItem.originalMessageDeleted": "原消息已删除",
    "messageItem.originalMessageUnavailable": "原消息不可用",
    "messageItem.replyPreviewSticker": "贴纸",
    "messageItem.requestKeys": "请求密钥",
    "messageItem.keysRequested": "已请求密钥",
    "messageItem.requestKeysHelp":
        "重试、检查你的密钥备份，并向发送者的会话索取这条消息的密钥",
    "messageItem.replyPreviewPoll": "投票",
    "messageItem.replyPreviewImage": "图片",
    "messageItem.replyPreviewVideo": "视频",
    "messageItem.replyPreviewAudio": "音频",
    "messageItem.replyPreviewFile": "文件",
    "messageItem.edited": "（已编辑）",
    "messageItem.decryptingImage": "正在解密图片...",
    "messageItem.couldnTDecryptImage": "无法解密图片",
    "messageItem.imageUnavailable": "[图片不可用]",
    "messageItem.decryptingVideo": "正在解密视频...",
    "messageItem.couldnTDecryptVideo": "无法解密视频",
    "messageItem.video": "视频",
    "messageItem.canTBePlayedHere": "无法在此播放",
    "messageItem.playbackFailedClickToRetry": "播放失败 · 点击重试",
    "messageItem.clickToPlay": "{videoDuration} · 点击播放",
    "messageItem.clickToPlay2": "点击播放",
    "messageItem.audio": "音频",
    "messageItem.kb": "{toFixed} KB",
    "messageItem.mb": "{toFixed} MB",
    "mediaProgress.ofTotal": "{loaded} / {total}",
    "messageItem.fileAttachment": "文件附件",
    "messageItem.download": "下载",
    "messageItem.toSave": "保存 ·",
    "messageItem.toCancel": "取消",
    "messageItem.openThread": "打开消息列",
    "messageItem.failedToSend": "发送失败。",
    "messageItem.retrying": "正在重试…",
    "messageItem.showWhoReadThisMessage": "显示谁读过这条消息",
    "messageItem.readThis": "{count, plural, other {# 人已读}}",
    "messageItem.readBy": "已读：",
    "messageItem.messageActions": "消息操作",
    "messageItem.editMessage": "编辑消息",
    "messageItem.delete": "删除？",
    "messageItem.yesDeleteMessage": "是，删除消息",
    "messageItem.yes": "是",
    "messageItem.noKeepMessage": "否，保留消息",
    "messageItem.no": "否",
    "messageItem.deleteMessage": "删除消息",
    "messageItem.unpinMessage": "取消置顶消息",
    "messageItem.pinMessage": "置顶消息",
    "messageItem.addReaction": "添加回应",
    "messageItem.reply": "回复",
    "messageItem.replyInThread": "在消息列中回复",
    "messageItem.forwardMessage": "转发消息",
    "messageItem.moreActions": "更多操作",
    "messageItem.linkCopied": "链接已复制！",
    "messageItem.copyMessageLink": "复制消息链接",
    "messageItem.linkCopied2": "链接已复制",
    "messageItem.couldnTDeleteTheMessage": "无法删除消息",
    "messageItem.couldnTCopyTheMessageLink": "无法复制消息链接",
    "messageItem.failedToUnpinMessage": "取消置顶消息失败",
    "messageItem.failedToPinMessage": "置顶消息失败",
    "messageItem.couldNotOpenTheMatrixLink": "无法打开 Matrix 链接",

    // src/lib/components/messages/MessageRedactAction.svelte
    "messageRedactAction.removeMessage": "移除消息",
    "messageRedactAction.removeThisMessage": "移除这条消息？",
    "messageRedactAction.removing": "正在移除…",
    "messageRedactAction.failedToRemoveMessage": "移除消息失败",

    // src/lib/components/messages/MessageReportAction.svelte
    "messageReportAction.reportMessage": "举报消息",
    "messageReportAction.reportSent": "举报已发送",
    "messageReportAction.whyAreYouReportingThisMessage":
        "你为什么要举报这条消息？",
    "messageReportAction.markAsExtremelyOffensive": "标记为极度冒犯",
    "messageReportAction.reporting": "正在举报…",
    "messageReportAction.report": "举报",

    // src/lib/components/layout/MessageSearchPanel.svelte
    "messageSearchPanel.searchMessages": "搜索消息",
    "messageSearchPanel.searchTryFromOrHasImage":
        "搜索 - 试试 from: 或 has:image",
    "messageSearchPanel.searchForMessagesInThisRoom": "在此房间中搜索消息。",
    "messageSearchPanel.noMatchesInTheResultsLoaded":
        "到目前为止加载的结果中没有匹配项。",
    "messageSearchPanel.noResultsFor": "没有“{searched}”的结果。",
    "messageSearchPanel.searchFailed": "搜索失败",
    "messageSearchPanel.resultCount": "{count, plural, other {# 个结果}}",

    // src/lib/components/settings/MessagesMediaSettings.svelte
    "messagesMediaSettings.messages": "消息",
    "messagesMediaSettings.showMatrixIds": "显示 Matrix ID",
    "messagesMediaSettings.showFullMatrixIdsLikeUser":
        "在整个应用中显示完整的 Matrix ID（如 @user:server）而不是显示名称。",
    "messagesMediaSettings.readReceiptAvatars": "已读回执头像",
    "messagesMediaSettings.showWhoHasReadEachMessage":
        "在每条消息下方以小头像显示谁已读。这只会改变你在此设备上看到的内容；若要阻止他人看到你读到哪里，请使用“隐私与安全”中的“私密已读回执”。",
    "messagesMediaSettings.holdToOpenMessageMenu": "长按打开消息菜单",
    "messagesMediaSettings.onTouchDevicesOpenAMessage":
        "在触屏设备上，通过长按而不是点按来打开消息的操作。关闭后，点按即可打开菜单。",
    "messagesMediaSettings.checkSpelling": "拼写检查",
    "messagesMediaSettings.underlineMisspelledWordsAnd":
        "输入时为拼写错误的单词加下划线并提供更正。关闭后，将停止此设备上消息编辑器中的拼写检查和键盘自动更正。",
    "messagesMediaSettings.linkPreviews": "链接预览",
    "messagesMediaSettings.whenOffNoLinkPreviewIs":
        "关闭后，不会加载任何链接预览，你的主服务器也不会代你获取链接的页面。可在“隐私与安全”中控制预览媒体的加载来源。",
    "messagesMediaSettings.pauseVideosOffScreen": "视频移出屏幕时暂停",
    "messagesMediaSettings.pauseAPlayingVideoWhenIt":
        "正在播放的视频滚出视野时将其暂停，以节省电量。滚回来后需要你自己重新播放。",
    "messagesMediaSettings.sendVideosThatStreamFaster":
        "发送可更快开始播放的视频",
    "messagesMediaSettings.rearrangeMp4VideosYouSend":
        "重新排列你发送的 MP4 视频，使其可以边下载边播放。不会重新编码，画面不变。关闭后将原样发送文件。",
    "messagesMediaSettings.sendPhotosThatAppearSooner": "发送可更快显示的照片",
    "messagesMediaSettings.rewriteJpegPhotosYouSend":
        "重写你发送的 JPEG 照片，使对方立即看到完整画面，并在下载过程中逐渐变清晰。不会重新编码，画面不变。关闭后将原样发送文件。",
    "messagesMediaSettings.removeLocationAndMetadata":
        "移除上传内容中的位置和其他元数据",
    "messagesMediaSettings.stripMetadataDescription":
        "从你发送的照片和视频中去除 EXIF、GPS 位置、相机信息和其他隐藏的元数据。画面不变，并保留旋转信息，使照片仍然正向显示。",
    "messagesMediaSettings.stripMetadataWarning":
        "警告：关闭后，你发送的文件可能泄露你的个人信息，包括拍摄地点。",
    "messagesMediaSettings.randomizeFileNames": "随机化文件名",
    "messagesMediaSettings.randomizeFileNamesDescription":
        "以由字母和数字组成的随机名称上传文件，而不是使用真实文件名。文件扩展名会保留，包括 .tar.gz 这类扩展名。",
    "messagesMediaSettings.sendGifsAsAnimatedWebp": "将 GIF 作为动画 WebP 发送",
    "messagesMediaSettings.reencodeGifsYouSend":
        "将你发送的 GIF 重新编码为无损动画 WebP，通常体积更小，并且可以边下载边播放。画面不变。如果某个 GIF 转换后不会变小，则按原样发送。",
    "messagesMediaSettings.defaultTab": "默认标签页",
    "messagesMediaSettings.whichTabTheGifPickerOpens":
        "GIF 选择器打开时显示的标签页。",
    "messagesMediaSettings.defaultGifTab": "默认 GIF 标签页",
    "messagesMediaSettings.favourites": "收藏",
    "midiSoundBank.midi": "MIDI",
    "midiSoundBank.soundBank": "音色库",
    "midiSoundBank.theInstrumentSoundsUsedTo": "用于播放 MIDI 附件的乐器音色。",
    "midiSoundBank.system": "系统",
    "midiSoundBank.included": "内置",
    "midiSoundBank.custom": "自定义",
    "midiSoundBank.noSystemSoundBankFound":
        "此设备上未找到系统音色库，因此使用内置音色库。",
    "midiSoundBank.chooseFile": "选择文件",
    "midiSoundBank.chooseAnotherFile": "选择其他文件",
    "midiSoundBank.saving": "正在保存…",
    "midiSoundBank.sf2Sf3OrDlsUpTo":
        "自定义：不超过 256 MB 的 SF2、SF3 或 DLS 文件，保存在此设备上。",
    "midiSoundBank.useAnSf2Sf3OrDls": "请使用 SF2、SF3 或 DLS 文件。",
    "midiSoundBank.thatFileIsEmpty": "该文件为空。",
    "midiSoundBank.fileIsTooLarge": "该文件太大（最大 256 MB）。",
    "midiSoundBank.notASoundBank": "该文件不是音色库。",
    "midiSoundBank.couldNotSave":
        "无法在此设备上保存音色库（存储空间可能已满）。",

    // src/lib/components/ui/ModalDialog.fixture.svelte
    "modalDialog.fixture.fixtureDialog": "Fixture dialog",

    // src/lib/components/settings/NotificationSettings.svelte
    "notificationSettings.thisDevice": "此设备",
    "notificationSettings.systemPermission": "系统权限",
    "notificationSettings.pushNotifications": "推送通知",
    "notificationSettings.permissionIsBlockedInSystemSettings":
        "权限在系统设置中被禁止",
    "notificationSettings.notificationsAreNotSupportedHere": "此处不支持通知",
    "notificationSettings.allowThisAppToSendNotifications":
        "允许此应用发送通知",
    "notificationSettings.requesting": "正在请求…",
    "notificationSettings.blocked": "已禁止",
    "notificationSettings.unavailable": "不可用",
    "notificationSettings.enable": "启用",
    "notificationSettings.pushService": "推送服务",
    "notificationSettings.pushServiceLabel": "送达方式",
    "notificationSettings.pushServiceDescription":
        "应用关闭时，通知如何送达此设备。UnifiedPush 无需 Google 服务，通过 ntfy 之类的分发器应用工作。",
    "notificationSettings.pushServiceAutomatic": "自动",
    "notificationSettings.pushServiceFcm": "Google (Firebase)",
    "notificationSettings.pushServiceFcmUnavailable":
        "Google (Firebase)，在此不可用",
    "notificationSettings.pushServiceUnifiedPush": "UnifiedPush：{label}",
    "notificationSettings.pushServiceNoDistributor":
        "未安装 UnifiedPush 分发器。安装一个（例如 ntfy）即可在没有 Google 服务的情况下接收通知。",
    "notificationSettings.pushServiceActiveFcm": "当前使用 Google (Firebase)。",
    "notificationSettings.pushServiceActiveUnifiedPush":
        "当前使用 UnifiedPush（{label}）。",
    "notificationSettings.pushServiceActiveNone":
        "没有启用的推送服务，因此通知只会在应用打开时到达。",
    "notificationSettings.pushServiceSwitchFailed": "无法切换推送服务",
    "notificationSettings.sound": "声音",
    "notificationSettings.notificationSound": "通知声音",
    "notificationSettings.playASoundForLoudNotifications": "为响铃通知播放声音",
    "notificationSettings.desktopAlerts": "桌面提醒",
    "notificationSettings.popUpAndTaskbarFlash": "弹窗和任务栏闪烁",
    "notificationSettings.whichNotificationsShowASystemPop":
        "窗口在后台时，哪些通知会显示系统弹窗并使任务栏图标闪烁。",
    "notificationSettings.popUps": "弹窗",
    "notificationSettings.popUpNotifications": "弹窗通知",
    "notificationSettings.whichNotificationsShowASystemPopUp":
        "应用在后台时，哪些通知会显示系统弹窗。",
    "notificationSettings.multipleDevices": "多台设备",
    "notificationSettings.quietOnMyOtherDevices": "我的其他设备保持安静",
    "notificationSettings.whileYouReActivelyUsingOne":
        "当你正在使用某一台设备时，其他设备会跳过通知声音和弹窗，直到该设备空闲达到此时长。适用于你账户上的每台设备；通知仍会出现在你的收件箱中，未读计数不变。",
    "notificationSettings.custom": "自定义…",
    "notificationSettings.customQuietDurationInMinutes":
        "自定义静默时长（分钟）",
    "notificationSettings.minutesMax":
        "分钟（最多 {MAX_CUSTOM_GRACE_MINUTES}）",
    "notificationSettings.couldnTSaveToYourAccount":
        "无法保存到你的账户，你的其他设备可能仍保留旧设置。请检查网络连接后重试。",
    "notificationSettings.retrySavingTheOtherDeviceQuiet":
        "重试保存其他设备的静默设置",
    "notificationSettings.retrying": "正在重试…",
    "notificationSettings.rules": "规则",
    "notificationSettings.notificationRules": "通知规则",
    "notificationSettings.loudNotifyWithSoundSilentNotify":
        "响铃 = 带声音通知 · 静默 = 不带声音通知 · 关闭 = 不通知",
    "notificationSettings.keywordHighlights": "关键词高亮",
    "notificationSettings.getNotifiedWhenAMessageContains":
        "当消息包含某个词或短语时收到通知。匹配不区分大小写；",
    "notificationSettings.and": "和",
    "notificationSettings.areWildcards": "是通配符。",
    "notificationSettings.addAKeyword": "添加关键词…",
    "notificationSettings.newKeyword": "新关键词",
    "notificationSettings.noKeywordRulesYet": "还没有关键词规则。",
    "notificationSettings.behaviorFor": "{pattern} 的行为",
    "notificationSettings.enable2": "启用 {pattern}",
    "notificationSettings.loudOnly": "仅响铃",
    "notificationSettings.onlyNotificationsThatMakeASound":
        "仅会发出声音的通知",
    "notificationSettings.silentAndLoud": "静默和响铃",
    "notificationSettings.everyNotificationLoudOrSilent":
        "每条通知，无论响铃还是静默",
    "notificationSettings.none": "无",
    "notificationSettings.neverAlertOnThisDevice": "在此设备上从不提醒",
    "notificationSettings.couldNotSaveNotificationSetting": "无法保存通知设置",
    "notificationSettings.highlightSound": "高亮 + 声音",
    "notificationSettings.notifyWithAHighlightAndSound": "通知时带高亮和声音",
    "notificationSettings.highlight": "高亮",
    "notificationSettings.notifyWithAHighlight": "通知时带高亮",
    "notificationSettings.notify": "通知",
    "notificationSettings.notifyWithoutAHighlight": "通知时不带高亮",
    "notificationSettings.failedToAddKeyword": "添加关键词失败",
    "notificationSettings.failedToUpdateKeyword": "更新关键词失败",
    "notificationSettings.failedToDeleteKeyword": "删除关键词失败",
    "notificationSettings.accountNotificationsOff": "此账户的通知已关闭",
    "notificationSettings.accountNotificationsOffDetail":
        "此账户的所有通知已在服务器上被关闭（可能是通过另一个应用），因此无论下方如何设置，任何设备都不会收到通知。",
    "notificationSettings.turnOn": "开启",
    "notificationSettings.couldNotTurnOnNotifications": "无法开启通知",

    // src/lib/components/layout/NotificationsPanel.svelte
    "notificationsPanel.clearAll": "全部清除",
    "notificationsPanel.couldNotRefreshServerNotificationsTap":
        "无法刷新服务器通知。点按重试。",
    "notificationsPanel.noNotifications": "没有通知。",
    "notificationsPanel.jumpToMessage": "跳转到消息：",
    "notificationsPanel.in": "在 #{roomName}",
    "notificationsPanel.message": "（消息）",

    // src/lib/components/messages/OutboxStrip.svelte
    "outboxStrip.queued": "排队中",
    "outboxStrip.sending": "正在发送…",
    "outboxStrip.failed": "失败",

    // src/lib/components/layout/OwnStatusEditor.svelte
    "ownStatusEditor.pickAStatusEmoji": "选择状态表情",
    "ownStatusEditor.whatSHappening": "你在做什么？",
    "ownStatusEditor.statusText": "状态文字",
    "ownStatusEditor.clearStatus": "清除状态",
    "ownStatusEditor.couldNotSaveStatus": "无法保存状态",

    // src/lib/components/layout/PinnedMessagesPanel.svelte
    "pinnedMessagesPanel.pinnedMessages": "置顶消息",
    "pinnedMessagesPanel.noPinnedMessages": "没有置顶消息。",
    "pinnedMessagesPanel.jump": "跳转",
    "pinnedMessagesPanel.unpin": "取消置顶",

    // src/lib/components/plugins/PluginPopoverHost.svelte
    "pluginPopoverHost.plugin": "插件",

    // src/lib/components/settings/PluginSettingsForm.svelte
    "pluginSettingsForm.backToPlugins": "返回插件",
    "pluginSettingsForm.settings": "{pluginName} 设置",
    "pluginSettingsForm.thisPluginHasNoSettings": "此插件没有设置。",
    "pluginSettingsForm.moveUp": "上移",
    "pluginSettingsForm.moveDown": "下移",
    "pluginSettingsForm.removeRow": "移除此行",

    // src/lib/components/settings/PluginsSettings.svelte
    "pluginsSettings.back": "← 返回",
    "pluginsSettings.syncYourEnabledPluginsSettingsTo":
        "将你已启用的插件及其设置同步到你的 Matrix 账户（否则仅限本设备）。拉取时，会先显示将发生的更改，然后才会执行任何操作。",
    "pluginsSettings.pushToAccount": "推送到账户",
    "pluginsSettings.pullFromAccount": "从账户拉取",
    "pluginsSettings.thisPullWill": "此次拉取将：",
    "pluginsSettings.addRepos": "添加仓库：{join}",
    "pluginsSettings.installFromRepos": "从它们的仓库安装：{join}",
    "pluginsSettings.couldNotInstall": "已应用，但无法安装这些插件：{join}",
    "pluginsSettings.enable": "启用：{join}",
    "pluginsSettings.disable": "停用：{join}",
    "pluginsSettings.updateSettingsFor": "更新以下插件的设置：{join}",
    "pluginsSettings.setAutoUpdate": "设置自动更新：{value}",
    "pluginsSettings.setPerPluginAutoUpdate": "设置各插件的自动更新：{join}",
    "pluginsSettings.notInstalledOnThisDeviceInstall":
        "未安装在此设备上（请从“浏览”安装，然后再次拉取）：{join}",
    "pluginsSettings.nothingToChangeAlreadyInSync": "无需更改；已同步。",
    "pluginsSettings.apply": "应用",
    "pluginsSettings.installed": "已安装",
    "pluginsSettings.noPluginsInstalled": "没有已安装的插件。",
    "pluginsSettings.needsUpdate": "需要更新",
    "pluginsSettings.updateToV": "更新到 v{value}",
    "pluginsSettings.updating": "正在更新...",
    "pluginsSettings.update": "更新",
    "pluginsSettings.pluginSettings": "插件设置",
    "pluginsSettings.enable2": "启用 {name}",
    "pluginsSettings.working": "处理中...",
    "pluginsSettings.autoUpdateThisPlugin": "自动更新此插件",
    "pluginsSettings.autoDefault": "自动：默认",
    "pluginsSettings.autoOn": "自动：开",
    "pluginsSettings.autoOff": "自动：关",
    "pluginsSettings.confirmRemove": "确认移除 {name}",
    "pluginsSettings.removePlugin": "移除插件",
    "pluginsSettings.remove": "移除 {name}",
    "pluginsSettings.browse": "浏览",
    "pluginsSettings.loading": "正在加载...",
    "pluginsSettings.noPluginsInThisRepoYet": "此仓库中还没有插件。",
    "pluginsSettings.install": "安装",
    "pluginsSettings.repos": "仓库",
    "pluginsSettings.official": "官方",
    "pluginsSettings.localFolder": "本地文件夹",
    "pluginsSettings.loadFromFolder": "从文件夹加载插件",
    "pluginsSettings.loadFromFolderHint":
        "用于开发插件：选择包含其 manifest.json 和打包文件的文件夹，或包含多个此类插件文件夹的仓库文件夹。Zam 会保留一份副本并像运行其他插件一样运行它；重新构建后请使用“重新加载”。它运行的是完全受信任的代码，因此只加载你自己编写或信任的文件夹。",
    "pluginsSettings.chooseFolder": "选择文件夹",
    "pluginsSettings.reload": "重新加载",
    "pluginsSettings.reloading": "正在重新加载…",
    "pluginsSettings.reloadFromFolder": "从文件夹重新加载",
    "pluginsSettings.removeRepo": "移除仓库",
    "pluginsSettings.addARepo": "添加仓库",
    "pluginsSettings.thirdPartyReposRunFullTrust":
        "第三方仓库运行完全受信任的代码，可以完全访问你的账户和消息。只添加你信任的仓库。",
    "pluginsSettings.ownerRepoOrGithubUrl": "owner/repo 或 GitHub URL",
    "pluginsSettings.addRepo": "添加仓库",
    "pluginsSettings.syncPlugins": "同步插件",
    "pluginsSettings.disableAllPlugins": "停用所有插件",
    "pluginsSettings.autoUpdatePlugins": "自动更新插件",
    "pluginsSettings.automaticallyPullNewerVersionsOfRepo":
        "自动拉取仓库插件的较新版本。",
    "pluginsSettings.pushedYourPluginSetToYour": "已将你的插件集推送到账户。",
    "pluginsSettings.pushFailed": "推送失败。",
    "pluginsSettings.pullFailed": "拉取失败。",
    "pluginsSettings.appliedTheSyncedPluginSet": "已应用同步的插件集。",
    "pluginsSettings.updateFailed": "更新失败。",
    "pluginsSettings.couldnTRemovePlugin": "无法移除插件：{message}",
    "pluginsSettings.couldnTRemovePlugin2": "无法移除插件。",
    "pluginsSettings.cannotAddThisRepo": "无法添加此仓库。",
    "pluginsSettings.noIndexJson": "没有 index.json（{status}）",
    "pluginsSettings.installFailed": "安装失败。",

    // src/lib/components/messages/PollBody.svelte
    "pollBody.finalResults": "最终结果",
    "pollBody.livePoll": "实时投票",
    "pollBody.resultsAreRevealedWhenThePoll": "投票结束后才会公布结果",
    "pollBody.chooseUpTo": "· 最多选择 {maxSelections} 项",
    "pollBody.selected": "已选择",
    "pollBody.submitting": "正在提交…",
    "pollBody.submitVote": "提交投票",
    "pollBody.votesAreHidden": "投票已隐藏",
    "pollBody.savingVote": "· 正在保存投票…",
    "pollBody.closeThisPoll": "结束此投票？",
    "pollBody.closing": "正在结束…",
    "pollBody.closePoll": "结束投票",
    "pollBody.pollUnsupportedFormat": "[投票 - 不支持的格式]",
    "pollBody.failedToSubmitVote": "提交投票失败",
    "pollBody.failedToClosePoll": "结束投票失败",
    "pollBody.voteCount": "{count, plural, other {# 票}}",

    // src/lib/components/ui/Portal.fixture.svelte
    "portal.fixture.hello": "hello",

    // src/lib/components/settings/PrivacySafetySettings.svelte
    "privacySafetySettings.privacy": "隐私",
    "privacySafetySettings.privateReadReceipts": "私密已读回执",
    "privacySafetySettings.sendTypingIndicators": "发送输入状态",
    "privacySafetySettings.indexEncryptedRooms": "在此设备上为加密房间建立索引",
    "privacySafetySettings.indexEncryptedRoomsHint":
        "在此设备上保留你加密房间消息的压缩副本，使其中的搜索和媒体列表可用。历史记录会在后台缓慢获取。关闭此项会删除该副本。",
    "privacySafetySettings.letOthersInARoomSee":
        "让房间中的其他人看到你正在输入。关闭后，输入时不会通知任何人。",
    "privacySafetySettings.hideYourReadReceiptsFromOther":
        "对其他用户隐藏你的已读回执。你的未读计数仍然有效；别人只是看不到你读到了哪里。",
    "privacySafetySettings.hideMessageTextInNotifications":
        "在通知中隐藏消息文本",
    "privacySafetySettings.notificationsOnThisDeviceSayWho":
        "此设备上的通知会显示谁给你发了消息，但不显示内容。发送者和房间名称仍会显示。仅适用于此设备。",
    "privacySafetySettings.linkPreviewMedia": "链接预览媒体",
    "privacySafetySettings.previewImagesAndVideosUsuallyCome":
        "普通链接预览中的图片和视频经由你的主服务器获取。“全部”还会直接从这些网站加载 YouTube 播放器、X/Twitter 卡片以及你的服务器无法预览的 GIF，因此它们会获知你的 IP 地址和你阅读消息的时间。“仅主服务器”会阻止这些加载；“关闭”还会阻止加载你的服务器提供的内容。无论哪种方式，每个受影响的预览都保留一个加载其媒体的按钮。链接预览的开关位于“消息和媒体”。",
    "privacySafetySettings.blockedUsers": "被屏蔽的用户",
    "privacySafetySettings.all": "全部",
    "privacySafetySettings.loadPreviewMediaFromWhereverIt":
        "同时直接从 YouTube、X/Twitter 和 GIF 网站加载嵌入内容",
    "privacySafetySettings.homeserverOnly": "仅主服务器",
    "privacySafetySettings.onlyLoadPreviewMediaYourOwn":
        "仅加载你自己的主服务器提供的预览媒体",
    "privacySafetySettings.off": "关闭",
    "privacySafetySettings.neverLoadPreviewMediaAutomatically":
        "从不自动加载预览媒体",

    // src/lib/components/settings/ProfileFieldsEditor.svelte
    "profileFieldsEditor.moreAboutYou": "更多关于你的信息",
    "profileFieldsEditor.banner": "横幅",
    "profileFieldsEditor.yourBanner": "你的横幅",
    "profileFieldsEditor.changeBanner": "更换横幅",
    "profileFieldsEditor.showWhenIAmInA": "通话时显示",
    "profileFieldsEditor.addsInACallToYour":
        "在你连接到语音通话期间，在个人资料中加上“通话中”，离开后移除。",
    "profileFieldsEditor.pronouns": "代词",
    "profileFieldsEditor.sheHerTheyThem": "she/her, they/them",
    "profileFieldsEditor.separateWithCommasMostPreferredFirst":
        "用逗号分隔，最常用的放在前面。",
    "profileFieldsEditor.status": "状态",
    "profileFieldsEditor.statusEmoji": "状态表情",
    "profileFieldsEditor.pickAStatusEmoji": "选择状态表情",
    "profileFieldsEditor.onHolidayUntilThe23rd": "休假至 23 日",
    "profileFieldsEditor.statusText": "状态文字",
    "profileFieldsEditor.bio": "简介",
    "profileFieldsEditor.tellPeopleAboutYourself": "向大家介绍一下自己",
    "profileFieldsEditor.timezone": "时区",
    "profileFieldsEditor.timezoneRegion": "时区地区",
    "profileFieldsEditor.notSet": "未设置",
    "profileFieldsEditor.timezoneCity": "时区城市",
    "profileFieldsEditor.chooseACity": "选择城市",
    "profileFieldsEditor.europeLondon": "Europe/London",
    "profileFieldsEditor.useMine": "使用我的",
    "profileFieldsEditor.usernameColour": "用户名颜色",
    "profileFieldsEditor.usernameColourOnDarkThemes": "深色主题下的用户名颜色",
    "profileFieldsEditor.darkThemes": "深色主题",
    "profileFieldsEditor.usernameColourOnLightThemes": "浅色主题下的用户名颜色",
    "profileFieldsEditor.lightThemes": "浅色主题",
    "profileFieldsEditor.resetToDefault": "重置为默认",
    "profileFieldsEditor.chooseAColour": "选择颜色",
    "profileFieldsEditor.oneColourForDarkThemesAnd":
        "深色主题和浅色主题各一种颜色，这样你的名字在两种主题下都清晰可读。",
    "profileFieldsEditor.links": "链接",
    "profileFieldsEditor.label": "标签",
    "profileFieldsEditor.linkLabel": "链接标签",
    "profileFieldsEditor.httpsExampleOrg": "https://example.org",
    "profileFieldsEditor.linkAddress": "链接地址",
    "profileFieldsEditor.removeLink": "移除链接",
    "profileFieldsEditor.addLink": "添加链接",
    "profileFieldsEditor.saved": "已保存",
    "profileFieldsEditor.useATimezoneNameLikeEurope":
        "请使用 Europe/London 这样的时区名称。",
    "profileFieldsEditor.chooseACity2": "请选择城市。",
    "profileFieldsEditor.bannerUploadFailed": "横幅上传失败",
    "profileFieldsEditor.failedToSaveProfileFields": "保存个人资料字段失败",

    // src/lib/components/layout/ProfileFooter.svelte
    "profileFooter.dismiss": "忽略",
    "profileFooter.switchAccounts": "切换账户",
    "profileFooter.unknown": "未知",

    // src/lib/components/settings/PushDiagnostics.svelte
    "pushDiagnostics.pushGateway": "推送网关",
    "pushDiagnostics.notificationRelay": "通知中继",
    "pushDiagnostics.pushNotificationsAreRelayedThroughThis":
        "推送通知通过此网关中继。它可以看到哪些房间和发送者给你发了通知，但永远看不到你的消息文本。",
    "pushDiagnostics.warningYourHomeserverIsRoutingThis":
        "警告：你的主服务器正将此设备的推送通知路由到另一个网关（{join}）。看到你通知元数据的是该网关，而不是上面的这个。",
    "pushDiagnostics.verifiedYourHomeserverRoutesNotificationsTo":
        "已验证：你的主服务器将通知路由到此网关。",
    "pushDiagnostics.noPushNotificationsAreRegisteredOn":
        "此账户尚未注册任何推送通知。",

    // src/lib/components/ui/QrCodeImage.svelte
    "qrCodeImage.couldNotRenderTheVerificationCode": "无法渲染验证码。",
    "qrCodeImage.qrCodeForDeviceVerification": "用于设备验证的二维码",

    // src/lib/components/layout/QuickActions.svelte
    "quickActions.newDm": "新建私信",
    "quickActions.createRoomInSpace": "在空间中创建房间",
    "quickActions.createNewRoom": "创建新房间",
    "quickActions.createNewSpace": "创建新空间",
    "quickActions.joinRoomByAddress": "通过地址加入房间",
    "quickActions.createARoom": "创建房间",
    "quickActions.createASpace": "创建空间",
    "quickActions.newDirectMessage": "新建私信",
    "quickActions.joinARoom": "加入房间",
    "quickActions.spaceName": "空间名称",
    "quickActions.roomName": "房间名称",
    "quickActions.mySpace": "我的空间",
    "quickActions.optional": "（可选）",
    "quickActions.additionalCreators": "额外创建者（房间 v12）",
    "quickActions.additionalCreatorsHint":
        "与你一同成为新房间创建者的其他用户。在房间 v12 中，创建者权限无法被收回。",
    "quickActions.starterRooms": "添加一个文字房间和一个语音房间",
    "quickActions.starterRoomsHint": "你邀请到空间的任何人都可以加入它们。",
    "quickActions.starterTextName": "general",
    "quickActions.starterVoiceName": "语音",
    "quickActions.whatSThisSpaceAbout": "这个空间是关于什么的？",
    "quickActions.whatSThisRoomAbout": "这个房间是关于什么的？",
    "quickActions.opensStraightIntoACallMessages":
        "直接进入通话。仍可发送消息。",
    "quickActions.enableEncryption": "启用加密",
    "quickActions.canTBeTurnedOffLater": "之后无法关闭。",
    "quickActions.findSomeoneToMessage": "查找要发消息的人…",
    "quickActions.encryptThisDm": "加密此私信",
    "quickActions.openTheDm": "打开私信",
    "quickActions.roomAddressOrId": "房间地址或 ID",
    "quickActions.roomServerCom": "#room:server.com",
    "quickActions.requestSentYouLlBeAble":
        "申请已发送，有人放你进入后你就可以加入。",
    "quickActions.youCanTJoinThisRoom":
        "你无法直接加入此房间，但可以申请加入。",
    "quickActions.requestToJoin": "申请加入",
    "quickActions.create": "创建",
    "quickActions.somethingWentWrong": "出错了",
    "quickActions.enterARoomAddressRoomServer":
        "请输入房间地址（#room:server.com）或房间 ID（!id:server.com）",
    "quickActions.couldNotSendTheJoinRequest": "无法发送加入申请",

    // src/lib/components/messages/ReactorPopover.svelte
    "reactorPopover.more": "另有 {overflow} 人",
    "reactorPopover.reactedWith": "回应了 {label}",
    "reactorPopover.userList": "用户列表",

    // src/lib/components/messages/RenameAttachmentDialog.svelte
    "renameAttachmentDialog.editAttachment": "编辑附件",
    "renameAttachmentDialog.filename": "文件名",
    "renameThreadDialog.nameThread": "命名消息列",
    "renameThreadDialog.renameThread": "重命名消息列",
    "renameThreadDialog.threadName": "消息列名称",
    "renameThreadDialog.everyoneInTheRoomSeesIt":
        "房间中的所有人在 Zam 中都会看到这个名称。其他 Matrix 应用不会显示它。",
    "renameThreadDialog.removeName": "移除名称",
    "renameThreadDialog.couldNotSaveTheName": "无法保存名称",

    // src/lib/components/layout/RoomDirectory.svelte
    "roomDirectory.exploreRooms": "探索房间",
    "roomDirectory.onYourHomeserver": "在你的主服务器上",
    "roomDirectory.publicRooms": "公开房间 {value}",
    "roomDirectory.rooms": "· 约 {totalEstimate} 个房间",
    "roomDirectory.searchRooms": "搜索房间…",
    "roomDirectory.serverOptional": "服务器（可选）",
    "roomDirectory.search": "搜索",
    "roomDirectory.noRoomsFound": "未找到房间。",
    "roomDirectory.space": "空间",
    "roomDirectory.open": "打开",
    "roomDirectory.knockOnly": "仅限申请",
    "roomDirectory.requestToJoin": "申请加入",
    "roomDirectory.requested": "已申请",
    "roomDirectory.somethingWentWrong": "出错了",

    // src/lib/components/layout/RoomTopicSheet.svelte
    "roomTopicSheet.description": "描述",
    "roomTopicSheet.open": "显示完整的房间描述",

    // src/lib/components/layout/RoomHeaderOverflowMenu.svelte
    "roomHeaderOverflowMenu.moreRoomOptions": "更多房间选项",
    "roomHeaderOverflowMenu.unread": "未读",
    "roomHeaderOverflowMenu.badgeThreads":
        "{count, plural, other {{badge} 条未读提及}}",
    "roomHeaderOverflowMenu.badgePinned":
        "{count, plural, other {{badge} 条置顶消息}}",
    "roomHeaderOverflowMenu.badgeNotifications":
        "{count, plural, other {{badge} 条未读通知}}",
    "roomHeaderOverflowMenu.badgeMedia": "{count, plural, other {{badge} 项}}",
    "roomHeaderOverflowMenu.badgeMembers":
        "{count, plural, other {{badge} 位成员}}",

    // src/lib/components/layout/RoomList.svelte
    "roomList.doneReordering": "完成排序",
    "roomList.reorderRooms": "调整房间顺序",
    "roomList.spaceSettings": "空间设置",
    "roomList.pendingInvites": "待处理的邀请",
    "roomList.inVoice": "{name} - 语音中",
    "roomList.orderValue": "排序值",
    "roomList.roomSettings": "房间设置",
    "roomList.favourites": "收藏",
    "roomList.channels": "房间",
    "roomList.rooms": "房间",
    "roomList.lowPriority": "低优先级",
    "roomList.browseRooms": "浏览房间",
    "roomList.members": "{numMembers} 位成员",
    "roomList.requested": "已申请",
    "roomList.cancelRequest": "取消申请",
    "roomList.youCanTJoinThisRoom": "你无法直接加入此房间，改为申请加入吗？",
    "roomList.notNow": "暂不",
    "roomList.requestToJoin": "申请加入",
    "roomList.directMessages": "私信",
    "roomList.previewYou": "你：{text}",
    "roomList.noRoomsYet": "还没有房间",
    "roomList.emptyCategory": "没有房间",
    "roomList.copyRoomLink": "复制房间链接",
    "roomList.markAsRead": "标为已读",
    "roomList.addToSpace": "添加到空间",
    "roomList.clickAgainToLeave": "再次点击以离开",
    "roomList.clickAgainToLeaveLastMember":
        "你是唯一的成员，你离开后将没有人能加入。再次点击以离开",
    "roomList.leaveRoom": "离开房间",
    "roomList.couldNotSendTheJoinRequest": "无法发送加入申请",
    "roomList.orderMustBeBetween0And":
        "排序值必须在 0 到 1 之间，已改用 {value}。",
    "roomList.failedToSetOrder": "设置排序失败",

    // src/lib/components/layout/RoomMediaPanel.svelte
    "roomMediaPanel.media": "媒体",
    "roomMediaPanel.closeMediaPanel": "关闭媒体面板",
    "roomMediaPanel.media2": "媒体（{length}{value}）",
    "roomMediaPanel.files": "文件（{length}{value}）",
    "roomMediaPanel.tryAgain": "重试",
    "roomMediaPanel.play": "{name} - 播放",
    "roomMediaPanel.video": "视频",
    "roomMediaPanel.audio": "音频",
    "roomMediaPanel.file": "文件",
    "roomMediaPanel.decryptingMedia": "正在解密媒体",
    "roomMediaPanel.decryptingMedia2": "正在解密媒体...",
    "roomMediaPanel.mediaCouldNotBeLoaded": "无法加载媒体",
    "roomMediaPanel.couldNotLoadThisMedia": "无法加载此媒体。",
    "roomMediaPanel.noMediaFoundInTheLast": "最近几百条消息中没有找到媒体。",
    "roomMediaPanel.noFilesFoundInTheLast": "最近几百条消息中没有找到文件。",
    "roomMediaPanel.noImagesOrVideosInThis": "此房间中还没有图片或视频。",
    "roomMediaPanel.noFilesInThisRoomYet": "此房间中还没有文件。",
    "roomMediaPanel.couldNotLoadMedia": "无法加载媒体。",
    "roomMediaPanel.couldNotLoadMoreMedia": "无法加载更多媒体。",
    "roomMediaPanel.failedToDownloadAttachment": "下载附件失败",

    // src/lib/components/layout/RoomSettings.svelte
    "roomSettings.closeSettings": "关闭设置",
    "roomSettings.backToSettings": "返回设置",
    "roomSettings.settings": "{name} - 设置",
    "roomSettings.roomAvatar": "房间头像",
    "roomSettings.roomName": "房间名称",
    "roomSettings.saved": "已保存！",
    "roomSettings.saveChanges": "保存更改",
    "roomSettings.advanced": "高级",
    "roomSettings.spaceId": "空间 ID",
    "roomSettings.roomId": "房间 ID",
    "roomSettings.copied": "已复制！",
    "roomSettings.roomVersionV": "房间版本：v{getVersion}",
    "roomSettings.upgradeRoom": "升级房间…",
    "roomSettings.thisCreatesANewRoomOn":
        "这会创建一个 v{recommendedVersion} 版本的新房间，并将当前房间标记为已被取代。成员会被引导到新房间。",
    "roomSettings.upgrading": "正在升级…",
    "roomSettings.upgradeRoom2": "升级房间",
    "roomSettings.additionalCreators": "额外创建者（房间 v12）",
    "roomSettings.additionalCreatorsHint":
        "与你一同成为升级后房间创建者的其他用户。在房间 v12 中，创建者权限无法被收回。",
    "roomSettings.whoCanJoin": "谁可以加入？",
    "roomSettings.spaceMembersAnyoneInCanJoin":
        "空间成员：{parentSpaceNames} 中的任何人都可以加入",
    "roomSettings.spaceMembersAnyoneInTheParent":
        "空间成员：上级空间中的任何人都可以加入",
    "roomSettings.messageHistory": "消息历史",
    "roomSettings.guestAccess": "访客访问",
    "roomSettings.allowGuestsToJoinWithoutAn": "允许访客无需账户加入",
    "roomSettings.guestsAreAnonymousAccountsTheHomeserver":
        "访客是主服务器按需创建的匿名账户。许多服务器完全禁用了访客注册，在这种情况下此选项不起作用。",
    "roomSettings.discoverability": "可发现性",
    "roomSettings.addresses": "地址",
    "roomSettings.loadingAddresses": "正在加载地址…",
    "roomSettings.noAddressesYet": "还没有地址。",
    "roomSettings.main": "主要",
    "roomSettings.remove": "移除 {alias}",
    "roomSettings.mainAddress": "主要地址",
    "roomSettings.noMainAddress": "没有主要地址",
    "roomSettings.set": "设置",
    "roomSettings.myRoom": "my-room",
    "roomSettings.serverAccessControl": "服务器访问控制",
    "roomSettings.controlWhichHomeserversMayParticipateIn":
        "控制哪些主服务器可以参与此房间。通配符：",
    "roomSettings.matchesAnyCharacters": "匹配任意多个字符，",
    "roomSettings.matchesOneDeniedServersAreRemoved":
        "匹配一个字符。被拒绝的服务器会在此房间中被移出联邦。",
    "roomSettings.noServerAclIsSetAll":
        "未设置服务器 ACL。所有服务器都可以参与。",
    "roomSettings.allowedServersOnePerLine": "允许的服务器（每行一个）",
    "roomSettings.deniedServersOnePerLine": "拒绝的服务器（每行一个）",
    "roomSettings.allowServersIdentifiedByARaw":
        "允许以原始 IP 地址标识的服务器",
    "roomSettings.saveServerAcl": "保存服务器 ACL",
    "roomSettings.youDoNotHavePermissionTo": "你无权编辑此房间的服务器 ACL。",
    "roomSettings.appliesToTheSpaceAndAll": "适用于该空间及其所有房间。",
    "roomSettings.notificationLevel": "通知级别",
    "roomSettings.encryption": "加密",
    "roomSettings.encrypted": "已加密",
    "roomSettings.notEncrypted": "未加密",
    "roomSettings.messagesInThisRoomAreEnd":
        "此房间中的消息已进行端到端加密。此项无法关闭。",
    "roomSettings.roomKey": "房间密钥",
    "roomSettings.resetRoomKey": "重置房间密钥",
    "roomSettings.resetRoomKeyHint":
        "如果其他人无法读取你在这里的消息，此操作会让你的下一条消息使用新密钥，并再次与房间内的每个会话共享。",
    "roomSettings.couldNotResetRoomKey": "无法重置房间密钥",
    "roomSettings.enableEncryption": "启用加密",
    "roomSettings.typeToConfirm":
        "输入 {ENABLE_ENCRYPTION_CONFIRM_PHRASE} 以确认",
    "roomSettings.enabling": "正在启用…",
    "roomSettings.powerLevelRequiredForEachAction":
        "每项操作所需的权限等级（0 到 100）。",
    "roomSettings.nameAnyThread": "命名任意消息列",
    "roomSettings.joinCallsVoiceVideo": "加入通话（语音/视频）",
    "roomSettings.invite": "邀请",
    "roomSettings.searchMembers": "搜索成员…",
    "roomSettings.banned": "已封禁（{length}）",
    "roomSettings.pendingJoinRequests": "待处理的加入申请（{length}）",
    "roomSettings.deny": "拒绝",
    "roomSettings.approve": "批准",
    "roomSettings.unban": "解除封禁",
    "roomSettings.noBannedMembers": "没有被封禁的成员",
    "roomSettings.you": "（你）",
    "roomSettings.setRole": "设置角色…",
    "roomSettings.admin100": "管理员 (100)",
    "roomSettings.moderator50": "协管员 (50)",
    "roomSettings.member0": "成员 (0)",
    "roomSettings.muted1": "禁言 (-1)",
    "roomSettings.kick": "移出",
    "roomSettings.ban": "封禁",
    "roomSettings.hideThisUserSMessagesEverywhere":
        "在所有地方隐藏此用户的消息（存储在你的账户中）",
    "roomSettings.setThe": "为每个子房间设置",
    "roomSettings.fieldOnEachChildRoomTo":
        "字段以控制排序顺序（按字典序）。留空则按创建时间排序。",
    "roomSettings.suggested": "推荐",
    "roomSettings.removeSuggestedHint": "移除推荐标记",
    "roomSettings.markAsSuggested": "标记为推荐",
    "roomSettings.unsuggest": "取消推荐",
    "roomSettings.suggest": "推荐",
    "roomSettings.order": "排序",
    "roomSettings.removeFromSpace": "从空间中移除",
    "roomSettings.noChildRooms": "没有子房间",
    "roomSettings.useYourGlobalNotificationSettings": "使用你的全局通知设置。",
    "roomSettings.allMessages": "所有消息",
    "roomSettings.notifyForEveryMessage": "每条消息都通知。",
    "roomSettings.mentionsOnly": "仅提及",
    "roomSettings.notifyOnlyForMentionsAndKeywords":
        "仅在 @提及 和关键词时通知。",
    "roomSettings.neverNotify": "从不通知。",
    "roomSettings.failedToUpdateNotifications": "更新通知失败。",
    "roomSettings.failedToEnableEncryption": "启用加密失败",
    "roomSettings.failedToSave": "保存失败",
    "roomSettings.uploadFailed": "上传失败",
    "roomSettings.failedToUpgradeRoom": "升级房间失败",
    "roomSettings.failedToSaveServerAcl": "保存服务器 ACL 失败",
    "roomSettings.couldNotChangeVisibility": "无法更改可见性",
    "roomSettings.couldNotLoadThisRoomS": "无法加载此房间的地址",
    "roomSettings.couldNotAddThatAddress": "无法添加该地址",
    "roomSettings.thisAddressIsPublishedAsOne":
        "此地址已发布为房间的地址之一，而你无权取消发布，因此无法移除。请联系房间管理员。",
    "roomSettings.couldNotRemoveThatAddress": "无法移除该地址",
    "roomSettings.couldNotSetTheMainAddress": "无法设置主要地址",
    "roomSettings.failed": "失败",
    "roomSettings.muted": "已禁言",
    "roomSettings.admin": "管理员",
    "roomSettings.moderator": "协管员",
    "roomSettings.member": "成员",
    "roomSettings.creatorLabel": "创建者",
    "roomSettings.failedToUpdateSuggestion": "更新推荐失败",
    "roomSettings.listThisRoomInTheServerDirectory": "在服务器目录中列出此房间",
    "roomSettings.listThisSpaceInTheServerDirectory":
        "在服务器目录中列出此空间",
    "roomSettings.listsTheRoomByIdBeingFound":
        "按 ID 列出此房间。若要能按名称被找到，还需要一个已发布的地址，请在下方添加。",
    "roomSettings.listsTheSpaceByIdBeingFound":
        "按 ID 列出此空间。若要能按名称被找到，还需要一个已发布的地址，请在下方添加。",
    "roomSettings.aPublishedAddressLetsPeopleFindRoom":
        "已发布的地址让人们可以按名称而不是 ID 找到并加入此房间。",
    "roomSettings.aPublishedAddressLetsPeopleFindSpace":
        "已发布的地址让人们可以按名称而不是 ID 找到并加入此空间。",
    "roomSettings.chooseHowThisRoomNotifiesYou": "选择此房间如何通知你。",
    "roomSettings.chooseHowThisSpaceNotifiesYou": "选择此空间如何通知你。",

    // src/lib/components/layout/ScreenSharePicker.svelte
    "screenSharePicker.chooseWhatToShare": "选择要共享的内容",
    "screenSharePicker.noPreview": "无预览",
    "screenSharePicker.screens": "屏幕",
    "screenSharePicker.windows": "窗口",
    "screenSharePicker.quality": "画质：{quality}",
    "screenSharePicker.audio": "音频",
    "screenSharePicker.audioAuto": "该窗口所属的应用；若共享屏幕，则为全部音频",
    "screenSharePicker.audioSystemExceptZam": "除 Zam 外的全部音频",
    "screenSharePicker.audioSystem": "全部系统音频",
    "screenSharePicker.audioApps": "应用程序",
    "screenSharePicker.audioNone": "无音频",

    // src/lib/components/layout/ScreenShareQualityChips.svelte
    "screenShareQualityChips.resolution": "分辨率",
    "screenShareQualityChips.frameRate": "帧率",
    "screenShareQualityChips.fps": "{f} FPS",
    "screenShareQualityChips.videoCodec": "视频编解码器",
    "screenShareQualityChips.hw": "HW",
    "screenShareQualityChips.codecHardware": "在你的显卡上编码",
    "screenShareQualityChips.codecSoftware": "在你的处理器上编码",
    "screenShareQualityChips.codecHint":
        "用于你的摄像头和屏幕共享。只列出通话中所有人都能播放的编解码器。",
    "screenShareQualityChips.codecBackupHint":
        "通话中有人无法播放 {codec}，因此他们会收到一份 H.264 副本，这会占用更多上传带宽。",
    "screenShareQualityChips.codecEncryptedFallbackHint":
        "此加密通话中有人无法播放 {picked}，因此在他们离开之前，你发送的是 {current}。",
    "screenShareQualityChips.bitrate": "最大码率",
    "screenShareQualityChips.bitrateUpTo": "最高",
    "screenShareQualityChips.bitrateCapHint":
        "这是上限而非目标：共享只会使用画面所需且你的连接能承载的带宽，最高不超过此值。",
    "screenShareQualityChips.bitrateOverridden":
        "正在使用你输入的上传速度 {upload}，因此上限为 {max}。",
    "screenShareQualityChips.uploadOverride": "上传速度（Mbps）",
    "screenShareQualityChips.uploadOverrideAuto": "自动",
    "screenShareQualityChips.uploadOverrideHint":
        "自动测量的结果可能远低于你的实际速度。输入你自己的数值可提高上限；留空则自动测量。",
    "screenShareQualityChips.kbps": "{n} kbps",
    "screenShareQualityChips.mbps": "{n} Mbps",
    "screenShareQualityChips.bitrateMeasured":
        "测得你的上传速度为 {upload}，因此上限为 {max}。",
    "screenShareQualityChips.bitrateUnmeasured":
        "尚未测量你的上传速度。它会在你发送视频时测量，因此目前上限为 {max}。",
    "screenShareQualityChips.shareSystemAudio": "共享系统音频",
    "screenShareQualityChips.appliesToNextShare": "下次共享时生效",
    "screenShareQualityChips.shareSystemAudioAppliesToNext":
        "共享系统音频（下次共享时生效）",

    // src/lib/components/layout/ScreenShareQualityPopover.svelte
    "screenShareQualityPopover.screenShareQuality": "屏幕共享画质",

    // src/lib/components/settings/SecuritySettings.svelte
    "securitySettings.showingTheLastReadingThatLoaded":
        "显示的是最近一次成功加载的读数，可能已过时。",
    "securitySettings.securityEncryption": "安全和加密",
    "securitySettings.setUpRecoverySoYourCross":
        "设置恢复功能，这样你的交叉签名身份和加密消息历史在每台设备上登出后都不会丢失。",
    "securitySettings.verification": "验证",
    "securitySettings.loadingEncryptionStatus": "正在加载加密状态…",
    "securitySettings.encryptionStatusUnknownOnThisSession":
        "此会话的加密状态未知。",
    "securitySettings.recoveryKeyId": "恢复密钥 ID：",
    "securitySettings.setUpRecovery": "设置恢复",
    "securitySettings.approveOnAccountPageHint":
        "你的服务器可能会要求你在其账户页面上批准此操作。",
    "securitySettings.approveOnAccountPage": "在你的账户页面上批准",
    "securitySettings.approveOnAccountPageBody":
        "你的服务器需要你允许此更改。请打开你的账户页面，批准重置你的加密身份，然后回来继续。",
    "securitySettings.approveOnAccountPageRetry":
        "服务器尚未看到批准。请在你的账户页面上批准，然后继续。",
    "securitySettings.openAccountPage": "打开账户页面",
    "securitySettings.iVeApprovedIt": "我已批准",
    "securitySettings.weLlCreateA": "我们将创建一个",
    "securitySettings.recoveryKey": "恢复密钥",
    "securitySettings.aOneTimeCodeThatUnlocks":
        "，即一个一次性代码，可解锁你的加密历史并验证新会话。请把它存放在密码管理器之类的安全位置；它只显示一次，我们无法为你找回。",
    "securitySettings.confirmYourAccountPasswordToCreate":
        "确认你的账户密码以创建加密密钥。",
    "securitySettings.accountPassword": "账户密码",
    "securitySettings.alsoLetMeUnlockWithA":
        "同时允许我用自己选择的密码短语解锁（可选，你的恢复密钥仍然有效，也仍会显示）。",
    "securitySettings.recoveryPassphrase": "恢复密码短语",
    "securitySettings.atLeastCharactersWeCanT":
        "至少 {MIN_PASSPHRASE_LENGTH} 个字符。我们无法为你重置它。",
    "securitySettings.settingUp": "正在设置…",
    "securitySettings.continue": "继续",
    "securitySettings.saveYourRecoveryKey": "保存你的恢复密钥",
    "securitySettings.thisIsShown": "此密钥",
    "securitySettings.onlyOnce": "只显示一次",
    "securitySettings.storeItNowWithoutItYou":
        "。请立即保存，没有它，一旦你无法访问自己的会话，就无法恢复加密历史。",
    "securitySettings.copied": "已复制",
    "securitySettings.copyKey": "复制密钥",
    "securitySettings.youCanAlsoUnlockWithThe":
        "你也可以用你选择的密码短语解锁。无论如何都请保留密钥，如果你忘了密码短语，它是唯一的入口。",
    "securitySettings.iVeSavedMyRecoveryKey":
        "我已把恢复密钥保存在安全的地方。",
    "securitySettings.done": "完成",
    "securitySettings.keysNotOnServer": "你的交叉签名密钥从未到达服务器",
    "securitySettings.keysNotOnServerHint":
        "此会话在设置恢复时生成了它们，但上传没有完成，因此你的各个会话无法互相验证。现在上传即可修复。",
    "securitySettings.uploadKeys": "上传密钥",
    "securitySettings.couldNotUploadKeys": "无法上传你的密钥",
    "securitySettings.recoveryIsSetUp": "恢复已设置",
    "securitySettings.yourCrossSigningKeysAndA":
        "你的交叉签名密钥和密钥备份已安全存储在服务器上，由你的恢复密钥保护。",
    "securitySettings.recoveryIsNotSetUp": "恢复未设置",
    "securitySettings.thisAccountHasNoRecoveryKey":
        "在你完成下面的步骤之前，此账户没有恢复密钥，也没有密钥备份。",
    "securitySettings.lostYourRecoveryKeyResetRecovery":
        "丢失了恢复密钥？重置恢复",
    "securitySettings.resettingCreatesA": "重置会创建一个",
    "securitySettings.new": "新的",
    "securitySettings.recoveryKeyAndReplacesYourCurrent":
        "恢复密钥并替换你当前的备份。你的旧恢复密钥将失效，其他会话可能需要重新验证。仅当你丢失了当前密钥时才这样做。",
    "securitySettings.yourOldRecoveryKeyAndBackup":
        "你的旧恢复密钥和备份已被重置，但新的恢复没有创建成功。请立即完成设置，否则你的消息无法在新会话中恢复。",
    "securitySettings.working": "处理中…",
    "securitySettings.finishSettingUpRecovery": "完成恢复设置",
    "securitySettings.confirmYourAccountPasswordToReset":
        "确认你的账户密码以重置恢复。",
    "securitySettings.resetting": "正在重置…",
    "securitySettings.resetCreateNewKey": "重置并创建新密钥",
    "securitySettings.messageHistoryBackup": "消息历史备份",
    "securitySettings.verifyThisSessionRestoreHistory":
        "验证此会话并恢复历史记录",
    "securitySettings.recoveryKey2": "恢复密钥",
    "securitySettings.passphrase": "密码短语",
    "securitySettings.enterYour": "输入你的",
    "securitySettings.recoveryPassphrase2": "恢复密码短语",
    "securitySettings.toVerifyThisSessionAndRestore":
        "以验证此会话并恢复你的加密消息历史。",
    "securitySettings.thisSessionIsNowVerified": "此会话现已验证",
    "securitySettings.encryptedHistoryRestored": "加密历史已恢复",
    "securitySettings.couldNotSetUpRecovery": "无法设置恢复",
    "securitySettings.couldNotResetRecovery": "无法重置恢复",
    "securitySettings.couldNotFinishSettingUpRecovery": "无法完成恢复设置",
    "securitySettings.couldNotVerifyThisSession": "无法验证此会话",

    // src/lib/components/settings/ServerSettings.svelte
    "serverSettings.scanningServer": "正在扫描服务器…",
    "serverSettings.what": "服务器声明了哪些功能：",
    "serverSettings.advertisesItemsMarkedUnknownArenT":
        "标记为“未知”的项目没有被服务器声明，只有在使用时才能检测到。",
    "serverSettings.accountMessaging": "账户和消息",
    "serverSettings.voiceVideoCallingMatrixrtc": "语音 / 视频通话（MatrixRTC）",
    "serverSettings.server": "服务器",
    "serverSettings.latestSpecVersion": "最新规范版本",
    "serverSettings.defaultRoomVersion": "默认房间版本",
    "serverSettings.advertisedFeatures": "已声明的功能（{length}）",
    "serverSettings.supported": "支持",
    "serverSettings.notSupported": "不支持",
    "serverSettings.unknown": "未知",
    "serverSettings.changePassword": "更改密码",
    "serverSettings.changeDisplayName": "更改显示名称",
    "serverSettings.changeAvatar": "更换头像",
    "serverSettings.manageEmailsPhoneNumbers": "管理邮箱 / 手机号",
    "serverSettings.threads": "消息列",
    "serverSettings.privateReadReceipts": "私密已读回执",
    "serverSettings.sfuDiscoveryRtcFoci": "SFU 发现（rtc_foci）",
    "serverSettings.delayedEventsCallCleanup": "延迟事件（通话清理）",
    "serverSettings.failedToReadServerCapabilities": "读取服务器功能失败",

    // src/lib/components/settings/SessionSettings.svelte
    "sessionSettings.sessionName": "会话名称",
    "sessionSettings.current": "当前",
    "sessionSettings.rename": "重命名",
    "sessionSettings.signOut": "登出？",
    "sessionSettings.signOut2": "登出",
    "sessionSettings.manageAtProvider": "管理",
    "sessionSettings.confirmYourAccountPasswordToSign":
        "确认你的账户密码以登出此会话。",
    "sessionSettings.accountPassword": "账户密码",
    "sessionSettings.signingOut": "正在登出…",
    "sessionSettings.encryption": "加密",
    "sessionSettings.active": "已启用",
    "sessionSettings.unavailable": "不可用",
    "sessionSettings.thisDeviceSKey": "此设备的密钥",
    "sessionSettings.loadingDeviceKey": "正在加载设备密钥…",
    "sessionSettings.endToEndEncryptionCouldNot":
        "此会话无法启动端到端加密。加密房间将显示占位内容。",
    "sessionSettings.encryptNewDirectMessages": "加密新的私信",
    "sessionSettings.newDmsYouStartAreEncrypted":
        "你发起的新私信默认加密。现有私信保持不变。如果你给客户端不支持加密的人发消息，请关闭此项。",
    "identityChange.own":
        "你的交叉签名密钥已更改。在信任加密消息之前，请重新验证此会话，或重置并重新签名你的设备。",
    "identityChange.other":
        "{user} 的交叉签名身份已更改。在你接受新身份之前，发给对方的加密消息会被暂缓发送。",
    "identityChange.accept": "接受新身份",
    "identityChange.withdraw": "撤销验证",
    "identityChange.dismiss": "忽略身份警告",
    "sessionSettings.excludeInsecureDevices": "排除未交叉签名的设备",
    "sessionSettings.excludeInsecureDevicesHelp":
        "仅与其所有者已交叉签名的设备共享消息密钥，也仅显示来自这些设备的消息（MSC4153）。来自未交叉签名设备的消息将显示为无法解密。",
    "sessionSettings.onlySendToVerifiedDevices": "仅发送给已验证的设备",
    "sessionSettings.refuseToEncryptMessagesForSessions":
        "拒绝为你未验证的会话加密消息。它们将完全收不到你的消息，包括你自己未验证的会话。默认关闭。",
    "sessionSettings.devicesCurrentlySignedInToThis":
        "当前已登录此账户的设备。",
    "sessionSettings.refreshing": "正在刷新…",
    "sessionSettings.refresh": "刷新",
    "sessionSettings.loadingSessions": "正在加载会话…",
    "sessionSettings.otherSessions": "其他会话 {value}",
    "sessionSettings.noOtherSessionsYouReOnly":
        "没有其他会话，你只在这里登录。",
    "sessionSettings.failedToLoadSessions": "加载会话失败",
    "sessionSettings.failedToRenameSession": "重命名会话失败",
    "sessionSettings.failedToSignOutSession": "登出会话失败",
    "sessionSettings.couldNotStartVerification": "无法开始验证",

    // src/lib/components/messages/ShareLocationDialog.svelte
    "shareLocationDialog.shareLocation": "共享位置",
    "shareLocationDialog.sendOnce": "仅发送一次",
    "shareLocationDialog.shareLive": "实时共享",
    "shareLocationDialog.locating": "正在定位…",
    "shareLocationDialog.useMyCurrentLocation": "使用我的当前位置",
    "shareLocationDialog.descriptionOptional": "描述（可选）",
    "shareLocationDialog.eGHomeTheCafOn": "例如：家、第五大街的咖啡馆…",
    "shareLocationDialog.duration": "时长",
    "shareLocationDialog.yourLiveLocationIsSharedWith":
        "你的实时位置会与此房间共享，直到你停止或计时结束。",
    "shareLocationDialog.sharing": "正在共享…",
    "shareLocationDialog.share": "共享",
    "shareLocationDialog.failedToStartLiveLocation": "启动实时位置失败",
    "shareLocationDialog.failedToShareLocation": "共享位置失败",

    // src/lib/components/messages/ShareTargetSheet.svelte
    "shareTargetSheet.fileSWerenTAddedShares":
        "有 {droppedFiles} 个文件未添加。分享限制为最多 {SHARE_MAX_FILES} 个文件，每个 {value} MB，总计 {value2} MB。",
    "shareTargetSheet.addAMessage": "添加消息…",
    "shareTargetSheet.searchRooms": "搜索房间",
    "shareTargetSheet.noJoinedRoomsFound": "未找到已加入的房间",
    "shareTargetSheet.send": "发送",
    "shareTargetSheet.shareToARoom": "分享到房间",

    // src/lib/components/layout/SpaceLandingPanel.svelte
    "spaceLandingPanel.yourRooms": "你的房间",
    "spaceLandingPanel.loadingRooms": "正在加载房间…",
    "spaceLandingPanel.browseRooms": "浏览房间",
    "spaceLandingPanel.youHavenTJoinedARoom":
        "你还没有加入 {spaceName} 中的任何房间。选一个开始吧。",
    "spaceLandingPanel.nothingJoinedHereYet": "这里还没有加入任何内容",
    "spaceLandingPanel.onlyOtherSpacesLiveInsideOpen":
        "{spaceName} 内只有其他空间，请从房间列表中打开一个来浏览其房间。",
    "spaceLandingPanel.thereAreNoRoomsInYet": "{spaceName} 中还没有房间。",
    "spaceLandingPanel.thisSpace": "此空间",
    "spaceLandingPanel.couldnTJoinTryItFrom":
        "无法加入{value}。请尝试在房间列表的“浏览房间”中加入。",
    "spaceLandingPanel.thatRoom": "该房间",

    // src/lib/components/layout/SpaceSidebar.svelte
    "spaceSidebar.home": "主页",
    "spaceSidebar.addASpace": "添加空间",
    "spaceSidebar.exploreRooms": "探索房间",
    "spaceSidebar.folderColor": "文件夹颜色",
    "spaceSidebar.createRoomInSpace": "在空间中创建房间",
    "spaceSidebar.roomName": "房间名称",
    "spaceSidebar.myRoom": "my-room",
    "spaceSidebar.optional": "（可选）",
    "spaceSidebar.whatSThisRoomAbout": "这个房间是关于什么的？",
    "spaceSidebar.opensStraightIntoACallMessages":
        "直接进入通话。仍可发送消息。",
    "spaceSidebar.create": "创建",
    "spaceSidebar.addExistingRoomToSpace": "将现有房间添加到空间",
    "spaceSidebar.noRoomsAvailableToAdd": "没有可添加的房间。",
    "spaceSidebar.spaceSettings": "空间设置",
    "spaceSidebar.copySpaceLink": "复制空间链接",
    "spaceSidebar.markAsRead": "标为已读",
    "spaceSidebar.createRoom": "创建房间",
    "spaceSidebar.addExistingRoom": "添加现有房间",
    "spaceSidebar.removeFromFolder": "从文件夹中移除",
    "spaceSidebar.newFolder": "新建文件夹",
    "spaceSidebar.clickAgainToLeave": "再次点击以离开",
    "spaceSidebar.clickAgainToLeaveLastMember":
        "你是唯一的成员，你离开后将没有人能加入此空间。再次点击以离开",
    "spaceSidebar.leaveSpace": "离开空间",
    "spaceSidebar.setColor": "设置颜色",
    "spaceSidebar.dissolveFolder": "解散文件夹",
    "spaceSidebar.somethingWentWrong": "出错了",

    // src/lib/components/layout/Splash.svelte
    "splash.restoringSession": "正在恢复会话…",

    // src/lib/components/ui/StickerPicker.svelte
    "stickerPicker.searchStickers": "搜索贴纸…",
    "stickerPicker.searchStickers2": "搜索贴纸",
    "stickerPicker.noStickerPacksAvailable": "没有可用的贴纸包",
    "stickerPicker.myStickers": "我的贴纸",
    "stickerPicker.myStickers2": "我的贴纸",

    // src/lib/components/ui/SwfEmbed.svelte
    "swfEmbed.adobeFlash": "Adobe Flash",

    // src/lib/components/settings/ThemeColorEditor.svelte
    "themeColorEditor.themeColors": "主题颜色",
    "themeColorEditor.presetName": "预设名称",
    "themeColorEditor.savePreset": "保存预设",
    "themeColorEditor.import": "导入",
    "themeColorEditor.pasteThemeCode": "粘贴主题代码",
    "themeColorEditor.copyCurrentPresetToClipboard": "将当前预设复制到剪贴板",
    "themeColorEditor.copied": "已复制！",
    "themeColorEditor.presets": "预设",
    "themeColorEditor.delete": "删除？",
    "themeColorEditor.confirmDelete": "确认删除 {name}",
    "themeColorEditor.rename": "重命名",
    "themeColorEditor.delete2": "删除 {name}",
    "themeColorEditor.builtInPresetsAreReadOnly":
        "内置预设是只读的。请复制后再自定义：",
    "themeColorEditor.duplicateToCustomize": "复制以自定义",
    "themeColorEditor.colors": "颜色",
    "themeColorEditor.backgrounds": "背景",
    "themeColorEditor.resetToDefault": "重置为默认",
    "themeColorEditor.text": "文字",
    "themeColorEditor.accentsSemantics": "强调色与语义色",
    "themeColorEditor.presence": "在线状态",
    "themeColorEditor.details": "细节",
    "themeColorEditor.contrastWarnings": "对比度警告",
    "themeColorEditor.messageDisplay": "消息显示",
    "themeColorEditor.savedOnThisDeviceOnlyNot":
        "仅保存在此设备上，不会在你的账户间同步。",
    "themeColorEditor.appTextSize": "应用文字大小：{round}%",
    "themeColorEditor.scalesAllTextAndSpacingAcross":
        "缩放整个应用的所有文字和间距。",
    "themeColorEditor.font": "字体",
    "themeColorEditor.custom": "自定义 - {customFontName}",
    "themeColorEditor.replaceCustomFont": "替换自定义字体…",
    "themeColorEditor.uploadCustomFont": "上传自定义字体…",
    "themeColorEditor.woff2TtfOrOtfUpTo":
        ".woff2、.ttf 或 .otf，最大 10 MB。仅保存在此设备上。",
    "themeColorEditor.theQuickBrownFoxJumpsOver":
        "The quick brown fox jumps over the lazy dog.",
    "themeColorEditor.cannotSavePreset": "无法保存预设",
    "themeColorEditor.notAValidThemeCode": "不是有效的主题代码",
    "themeColorEditor.imported": "已导入",
    "themeColorEditor.cannotImportPreset": "无法导入预设",
    "themeColorEditor.copy": "{activePresetName}（副本）",

    // src/lib/components/layout/ThreadPanel.svelte
    "threadPanel.thread": "消息列",
    "threadPanel.collapseThread": "折叠消息列",
    "threadPanel.expandThread": "展开消息列",
    "threadPanel.closeThread": "关闭消息列",
    "threadPanel.noRepliesYetStartTheThread":
        "还没有回复。在下方开始这个消息列。",
    "threadPanel.loadOlderReplies": "加载更早的回复",

    // src/lib/components/layout/ThreadsListPanel.svelte
    "threadsListPanel.threads": "消息列",
    "threadsListPanel.closeThreadsPanel": "关闭消息列面板",
    "threadsListPanel.noThreadsInThisRoomYet": "此房间中还没有消息列。",
    "threadsListPanel.youParticipated": "你参与过",
    "threadsListPanel.unreadMentions": "未读提及",
    "threadsListPanel.unreadReplies": "未读回复",
    "threadsListPanel.couldnTLoadThreadsForThis": "无法加载此房间的消息列。",
    "threadsListPanel.unknownSender": "未知",
    "threadsListPanel.allThreads": "所有消息列",
    "threadsListPanel.myThreads": "我的消息列",
    "threadsListPanel.filterThreads": "筛选消息列",
    "threadsListPanel.noThreadsYouParticipatedIn":
        "你在这里还没有发起或回复过任何消息列。",

    // src/lib/components/layout/StorageBanner.svelte
    "storageBanner.outOfStorage":
        "你的设备存储空间已用尽。在你释放空间之前，Zam 无法保存消息或加密密钥。",
    "storageBanner.lowStorage":
        "你的设备存储空间即将用尽（剩余 {free}）。请尽快释放空间，否则 Zam 将无法保存消息或加密密钥。",
    "storageBanner.checkAgain": "重新检查",
    "storageBanner.dismissLowStorageWarning": "忽略存储空间警告",

    // src/lib/components/layout/UpdateBanner.svelte
    "updateBanner.dismissUpdateNotification": "忽略更新通知",
    "updateBanner.installFailed": "安装失败",

    // src/lib/components/ui/UserPicker.svelte
    "userPicker.remove": "移除 {userId}",
    "userPicker.searching": "正在搜索…",
    "userPicker.noMatchingUsers": "没有匹配的用户",
    "userPicker.available": "{optionCount, plural, other {有 # 个可选结果}}",
    "userPicker.invite": "邀请 {candidateShown}",
    "userPicker.alreadyAdded": "已添加",
    "userPicker.alreadyInThisRoom": "已在此房间中",
    "userPicker.sendAnInviteToThisExact": "向这个确切的用户 ID 发送邀请",
    "userPicker.noMatchesTypeAFullUser":
        "没有匹配项。请输入完整的用户 ID，例如",
    "userPicker.userServer": "@user:server",
    "userPicker.toInviteSomeoneTheDirectoryDoesn": "，以邀请目录中未列出的人。",
    "userPicker.searchForPeople": "搜索用户…",
    "userPicker.userSearchFailedYouCanStill":
        "用户搜索失败，你仍然可以输入完整的用户 ID。",

    // src/lib/components/ui/UserProfileCard.svelte
    "userProfileCard.copyUserId": "复制用户 ID",
    "userProfileCard.copied": "已复制",
    "userProfileCard.localTime": "当地时间 {localTime}（{timezone}）",
    "userProfileCard.notAMemberOfThisRoom": "不是此房间的成员",
    "userProfileCard.powerLevel": "权限等级：{level}",
    "userProfileCard.powerLevelCreator": "权限等级：创建者",
    "userProfileCard.mutualRooms": "共同房间：{total}",
    "userProfileCard.more": "另有 {moreCount} 个",
    "userProfileCard.sessions": "会话",
    "userProfileCard.sessionsCount": "会话：{total}",
    "userProfileCard.refreshSessions": "向服务器查询其当前会话",
    "userProfileCard.noKnownSessions":
        "此会话不知道对方的任何会话，因此对方无法读取你的加密消息。",
    "userProfileCard.couldNotLoadSessions": "无法加载其会话",
    "userProfileCard.keysChanged": "密钥已更改",
    "userProfileCard.keysChangedHint":
        "标有“密钥已更改”的会话有此会话未能接受的新密钥。它可能需要登出后重新登录。",
    "userProfileCard.opening": "正在打开…",
    "userProfileCard.message": "发消息",
    "userProfileCard.verifyUser": "验证用户",
    "userProfileCard.editProfile": "编辑个人资料",
    "userProfileCard.kicking": "正在移出…",
    "userProfileCard.confirmKick": "确认移出？",
    "userProfileCard.kick": "移出",
    "userProfileCard.banning": "正在封禁…",
    "userProfileCard.confirmBan": "确认封禁？",
    "userProfileCard.ban": "封禁",
    "userProfileCard.couldNotStartVerification": "无法开始验证",
    "userProfileCard.couldNotCopyToClipboard": "无法复制到剪贴板",
    "userProfileCard.couldNotOpenDm": "无法打开私信",
    "userProfileCard.couldNotKick": "无法移出",
    "userProfileCard.couldNotBan": "无法封禁",

    // src/lib/components/layout/VerificationModal.svelte
    "verificationModal.thisSessionIsNowTrusted": "此会话现已受信任。",
    "verificationModal.theirIdentityIsNowVerified": "对方的身份现已验证。",
    "verificationModal.noTrustWasEstablishedYouCan":
        "未建立信任。你可以随时重新开始。",
    "verificationModal.didYourOtherSessionJustScan":
        "你的另一个会话刚刚扫描了此代码吗？",
    "verificationModal.didJustScanThisCode":
        "{otherUserId} 刚刚扫描了此代码吗？",
    "verificationModal.onlyConfirmIfYouScannedIt":
        "仅当你刚刚亲自扫描了它时才确认。",
    "verificationModal.onlyConfirmIfYouWatchedThem":
        "仅当你亲眼看到对方刚刚扫描了它时才确认。",
    "verificationModal.no": "否",
    "verificationModal.yesIScannedIt": "是，我扫描了它",
    "verificationModal.deviceWithThisUser": "对方的设备",
    "verificationModal.confirmTheSameEmojiAppearIn":
        "请确认相同的表情符号以相同的顺序显示在{value}上。",
    "verificationModal.theyDonTMatch": "不一致",
    "verificationModal.confirming": "正在确认…",
    "verificationModal.theyMatch": "一致",
    "verificationModal.verificationCodeForYourOtherSession":
        "你的另一个会话的验证码",
    "verificationModal.verificationCodeFor": "{otherUserId} 的验证码",
    "verificationModal.scanThisWithYourOtherSession":
        "请用你的另一个会话扫描此码。",
    "verificationModal.askThemToScanThisCode": "请对方扫描此码。",
    "verificationModal.noCodeToShowRightNow": "当前没有可显示的代码。",
    "verificationModal.couldNotLoadTheScanner": "无法加载扫描器。",
    "verificationModal.scanAgain": "重新扫描",
    "verificationModal.compareAShortListOfEmoji":
        "比对一小串表情符号来验证，或使用二维码。",
    "verificationModal.compareEmoji": "比对表情符号",
    "verificationModal.showACodeForTheOther": "显示一个代码供对方扫描",
    "verificationModal.scanTheirCodeWithTheCamera": "用摄像头扫描对方的代码",
    "verificationModal.chooseADifferentMethod": "选择其他方式",
    "verificationModal.waitingForTheOtherSideTo": "正在等待对方确认…",
    "verificationModal.verifyYourOtherSession": "验证你的另一个会话",
    "verificationModal.verify": "验证 {value}",
    "verificationModal.couldNotConfirmTheMatch": "无法确认匹配",
    "verificationModal.couldNotReportTheMismatch": "无法报告不匹配",
    "verificationModal.session": "你的另一个会话",

    // src/lib/components/layout/VideoTile.svelte
    "videoTile.fullscreen": "全屏",
    "videoTile.pictureInPicture": "画中画",
    "videoTile.exitPictureInPicture": "退出画中画",

    // src/lib/components/settings/VoiceAudioSettings.svelte
    "voiceAudioSettings.inputDevice": "输入设备",
    "voiceAudioSettings.savedMicrophoneNotFoundUsingThe":
        "未找到已保存的麦克风，在其恢复之前将使用默认设备。",
    "voiceAudioSettings.microphoneLevel": "麦克风音量",
    "voiceAudioSettings.stopTest": "停止测试",
    "voiceAudioSettings.testMic": "测试麦克风",
    "voiceAudioSettings.outputDevice": "输出设备",
    "voiceAudioSettings.chooseOutputDevice": "选择输出设备…",
    "voiceAudioSettings.audioOutputIsRoutedByThe":
        "在此平台上，音频输出由操作系统路由。",
    "voiceAudioSettings.testSpeaker": "测试扬声器",
    "voiceAudioSettings.callVolume": "通话音量",
    "voiceAudioSettings.incomingCallAudio": "来电音频",
    "voiceAudioSettings.incomingCallAudioIfThisMoves":
        "来电音频：如果这个在动但你听不到任何声音，请检查所选的输出设备和系统音量。",
    "voiceAudioSettings.voiceProcessing": "语音处理",
    "voiceAudioSettings.noiseSuppression": "降噪",
    "voiceAudioSettings.nsFastEnhancer": "FastEnhancer",
    "voiceAudioSettings.nsFastEnhancerHint":
        "在你的设备上运行并随应用附带，因此无需下载。体积小且稳定：能让你的声音保持均匀的音量。这是默认选项。",
    "voiceAudioSettings.nsFastEnhancerUnsupported":
        "此浏览器无法运行 FastEnhancer，因此改用 RNNoise。",
    "voiceAudioSettings.nsFastEnhancerTiny": "FastEnhancer Tiny",
    "voiceAudioSettings.nsFastEnhancerTinyHint":
        "较小的 FastEnhancer，大约只用三分之一的 CPU。降噪效果稍弱，但仍比 RNNoise 更稳定。",
    "voiceAudioSettings.noiseSuppressionGpu": "GPU 加速",
    "voiceAudioSettings.noiseSuppressionGpuHint":
        "在你的显卡上运行降噪以腾出 CPU。会增加约 11 毫秒的延迟。如果你的 GPU 跟不上，会切回 CPU。",
    "voiceAudioSettings.nsRnnoise": "RNNoise",
    "voiceAudioSettings.nsRnnoiseHint":
        "在你的设备上运行并随应用附带，因此无需下载。体积小且稳定：能让你的声音保持均匀的音量。",
    "voiceAudioSettings.nsRnnoiseUnsupported":
        "此浏览器无法运行 RNNoise，因此改用浏览器自带的降噪。",
    "voiceAudioSettings.nsDeepFilter": "DeepFilterNet3",
    "voiceAudioSettings.nsPluginHint":
        "来自插件的降噪，在你的设备上运行。在无法运行的地方会改用 FastEnhancer。",
    "voiceAudioSettings.nsPluginUnavailable":
        "此降噪滤波器的插件未启用，因此改用 FastEnhancer。",
    "voiceAudioSettings.nsPluginCantRun":
        "此降噪滤波器无法在这台设备上运行，因此改用 FastEnhancer。",
    "voiceAudioSettings.nsPluginUnsupported":
        "此浏览器无法运行降噪滤波器插件，因此改用浏览器自带的降噪。",
    "voiceAudioSettings.nsPluginMissing": "插件滤波器（未启用）",
    "voiceAudioSettings.nsBrowser": "浏览器",
    "voiceAudioSettings.nsOff": "关闭",
    "voiceAudioSettings.nsDeepFilterHint":
        "在你的设备上运行的 AI 降噪。首次使用时会下载约 11 MB。",
    "voiceAudioSettings.nsDeepFilterUnsupported":
        "此浏览器无法运行 DeepFilterNet3，因此改用浏览器自带的降噪。",
    "voiceAudioSettings.nsBrowserHint":
        "浏览器内置的降噪。它只能去除稳定的背景嗡嗡声。",
    "voiceAudioSettings.nsOffHint": "发送麦克风声音时不进行降噪。",
    "voiceAudioSettings.echoCancellation": "回声消除",
    "voiceAudioSettings.autoGainControl": "自动增益控制",
    "voiceAudioSettings.agcNormalize": "标准化",
    "voiceAudioSettings.agcNormalizeHint":
        "与来电语音所做的音量均衡相同，在降噪之后应用于你的麦克风。不会改动你的系统麦克风音量。",
    "voiceAudioSettings.agcZam": "AGC2",
    "voiceAudioSettings.agcBrowser": "浏览器",
    "voiceAudioSettings.agcOff": "关闭",
    "voiceAudioSettings.agcZamHint":
        "WebRTC 的 AGC2，在降噪之后运行。均衡你的声音，同时不改动系统麦克风音量。",
    "voiceAudioSettings.agcBrowserHint":
        "浏览器内置的 AGC。它可能会改变你的系统麦克风音量。",
    "voiceAudioSettings.agcOffHint": "按系统提供的电平发送你的麦克风声音。",
    "voiceAudioSettings.normalizeVoices": "均衡人声音量",
    "voiceAudioSettings.normalizeVoicesHint":
        "自动调大声音小的人、调小声音大的人，这样你就不必手动设置每个人的音量。",
    "voiceAudioSettings.pushToTalk": "按键说话",
    "voiceAudioSettings.pushToTalkHint":
        "通话中，仅在按住按键说话键时麦克风才会发送声音。",
    "voiceAudioSettings.pushToTalkNoKey":
        "按键说话需要先设置一个按键才能使用。",
    "voiceAudioSettings.pushToTalkSetKey": "设置按键说话键",
    "voiceAudioSettings.camera": "摄像头",
    "voiceAudioSettings.cameraDisabled": "已停用",
    "voiceAudioSettings.mirrorMyCamera": "镜像我的摄像头",
    "voiceAudioSettings.flipYourOwnPreviewOthersAlways":
        "翻转你自己的预览画面。其他人看到的始终是未镜像的你。",
    "voiceAudioSettings.cannotWatch": "我无法观看的视频",
    "voiceAudioSettings.cannotWatchHint":
        "选择在此设备上不显示任何画面（或显示黑屏）的编解码器。通话中的其他人随后会改为向你发送 H.264。当有视频流到达却始终无法解码时，Zam 也会自动填写此项。",
    "voiceAudioSettings.videoCodec": "视频编解码器",
    "voiceAudioSettings.videoCodecHint":
        "你的摄像头和屏幕共享以何种格式发送。“自动”会选择你的 GPU 能编码且通话中所有人都能播放的最佳编解码器。无法播放的人会收到一份 H.264 副本，你也可以在通话中切换。下次开启时生效。",
    "voiceAudioSettings.videoCodecAuto": "自动",
    "voiceAudioSettings.adaptiveStream": "自适应视频质量",
    "voiceAudioSettings.adaptiveStreamHint":
        "按每个视频的显示尺寸接收，并暂停不在屏幕上或 Zam 最小化期间的视频。可节省带宽和解码开销。下次加入通话时生效。",
    "voiceAudioSettings.stopPreview": "停止预览",
    "voiceAudioSettings.preview": "预览",
    "voiceAudioSettings.callSounds": "通话提示音",
    "voiceAudioSettings.playCallSounds": "播放通话提示音",
    "voiceAudioSettings.soundVolume": "提示音音量",
    "voiceAudioSettings.ringing": "响铃",
    "voiceAudioSettings.ringForIncomingDmCalls": "私信来电时响铃",
    "voiceAudioSettings.directMessagesRingRoomsNeverDo":
        "私信会响铃。房间从不响铃，你需要在房间里自行加入。",
    "voiceAudioSettings.ringtoneVolume": "铃声音量",
    "voiceAudioSettings.fullScreenCalls": "在锁屏上显示通话",
    "voiceAudioSettings.fullScreenCallsHint":
        "让私信来电像电话一样唤醒屏幕并全屏响铃。Android 会单独请求此权限。",
    "voiceAudioSettings.fullScreenCallsAllow": "允许",
    "voiceAudioSettings.microphoneUnavailableCheckBrowserPermissions":
        "麦克风不可用，请检查浏览器权限",
    "voiceAudioSettings.cameraUnavailableCheckBrowserPermissions":
        "摄像头不可用，请检查浏览器权限",

    // src/lib/components/layout/VoiceCallPanel.svelte
    "voiceCallPanel.enableAudio": "启用音频",
    "voiceCallPanel.openCallView": "打开通话视图",
    "voiceCallPanel.connectionStats": "连接统计",
    "voiceCallPanel.openCall": "打开通话",
    "voiceCallPanel.openCallWithVideo":
        "打开通话（{n, plural, other {# 路视频}}）",
    "voiceCallPanel.sharingYourScreen": "正在共享你的屏幕",
    "voiceCallPanel.shareQuality": "屏幕共享画质",
    "voiceCallPanel.stop": "停止",
    "callStats.title": "通话连接",
    "callStats.copyJson": "复制为 JSON",
    "callStats.copied": "已复制通话统计",
    "callStats.copyFailed": "无法复制",
    "callStats.loading": "正在测量...",
    "callStats.notInCall": "未在通话中",
    "callStats.tcpWarning":
        "媒体正通过 TCP 传输。一个丢失的数据包会拖住其后的所有内容，直到它被重新发送，表现为音频滞后或不同步。这通常是防火墙或网络阻止了 UDP 所致。",
    "callStats.serverSwitchedTcp":
        "通话服务器已将你切换到 TCP：它不再向这台设备提供 UDP。这发生在 UDP 连接失败或断开、而信令仍正常工作之后，并会在本次通话中记住这一点，因此从这台设备重新加入时会在一段时间内保持使用 TCP。你的网络很可能完全可以传输 UDP；这与防火墙阻止 UDP 并不相同。",
    "callStats.serverCandidates": "服务器候选",
    "callStats.serverCandidatesNoUdp": "仅 TCP（由服务器切换）",
    "callStats.publishing": "发布",
    "callStats.listening": "监听",
    "callStats.signalRtt": "信令延迟",
    "callStats.yourQuality": "你的连接",
    "callStats.sending": "发送",
    "callStats.receiving": "接收",
    "callStats.participant": "参与者",
    "callStats.theirQuality": "对方的连接",
    "callStats.loss": "丢包",
    "callStats.jitter": "抖动",
    "callStats.buffer": "缓冲",
    "callStats.legend":
        "“对方的连接”是服务器对该用户链路的评级，因此那里评级较差说明问题出在对方的网络，而不是你的。丢包和抖动指的是对方音频在过去一秒内到达你这里时的情况。",
    "callStats.noTransport": "未连接",
    "callStats.video": "视频",
    "callStats.videoChecking": "正在检查…",
    "callStats.videoSending": "发送中",
    "callStats.videoNotSending": "尚未发送",
    "callStats.videoCaptureEnded": "采集已停止：请重新开始",
    "callStats.videoCaptureStalled":
        "没有新的画面帧：共享的窗口可能已最小化或被遮挡，或摄像头被占用",
    "callStats.videoPlaying": "播放中",
    "callStats.videoNotSubscribed": "尚未接收",
    "callStats.videoHiddenByYou": "已被你隐藏",
    "callStats.videoTurnedOff": "已被对方关闭",
    "callStats.videoPausedByServer": "已被通话服务器暂停：你的连接目前无法承载",
    "callStats.videoNoPackets": "没有数据到达：请检查对方的发送端或你的连接",
    "callStats.videoCantDecrypt":
        "数据已到达但无法解密：你们中的一方可能在使用较旧的 Zam，或密钥尚未到达",
    "callStats.videoCantDecode":
        "数据已到达但此设备无法解码：请在屏幕共享画质菜单中尝试其他视频编解码器",
    "callStats.videoNotShown": "已接收但未显示在屏幕上：请打开通话视图观看",
    "callStats.videoNotPainting":
        "已解码但未被绘制：请尝试关闭并重新打开通话视图",
    "callStats.capture": "采集",
    "callStats.framesArrivedDecoded": "帧 到达 / 已解码",
    "callStats.framesEncoded": "已编码帧",
    "callStats.onScreen": "显示在屏幕上",
    "callStats.onScreenNo": "否",
    "callStats.onScreenNoPicture": "尚无画面",
    "callStats.decryptErrors": "解密错误",
    "callStats.trackState": "轨道",
    "callStats.trackNoFrames": "目前没有画面帧",
    "callStats.proxyRoute": "代理",
    "callStats.routeSignalling": "通话服务器连接",
    "callStats.routeSending": "你发送的媒体",
    "callStats.routeReceiving": "你接收的媒体",
    "callStats.routeDirect": "直连",
    "callStats.routeProxy": "经由 {proxy}",
    "callStats.path": "路径",
    "callStats.iceRtt": "ICE 延迟",
    "callStats.mediaRtt": "媒体延迟",
    "callStats.upload": "上传",
    "callStats.download": "下载",
    "callStats.availableUpload": "可用上传带宽",
    "callStats.outgoingLoss": "发送丢包",
    "callStats.remoteAddress": "服务器地址",
    "callStats.candidates": "候选",
    "callStats.pathUdp": "UDP（直连）",
    "callStats.pathTcp": "TCP",
    "callStats.pathRelayUdp": "TURN 中继（UDP）",
    "callStats.pathRelayTcp": "TURN 中继（TCP）",
    "callStats.pathRelayTls": "TURN 中继（TLS）",
    "callStats.pathUnknown": "未知",
    "callStats.qualityExcellent": "优秀",
    "callStats.qualityGood": "良好",
    "callStats.qualityPoor": "较差",
    "callStats.qualityLost": "已丢失",
    "callStats.qualityUnknown": "未知",
    "callStats.streams": "媒体流",
    "callStats.you": "你",
    "callStats.sourceMicrophone": "麦克风",
    "callStats.sourceCamera": "摄像头",
    "callStats.sourceScreenShare": "屏幕共享",
    "callStats.sourceScreenShareAudio": "屏幕共享音频",
    "callStats.sourceUnknown": "其他轨道",
    "callStats.sent": "已发送",
    "callStats.received": "已接收",
    "callStats.layer": "层 {rid}",
    "callStats.codec": "编解码器",
    "callStats.codecOptions": "编解码器选项",
    "callStats.bitrate": "码率",
    "callStats.bitrateTarget": "{rate}，上限 {target}",
    "callStats.packetDuration": "每包音频时长",
    "callStats.resolution": "分辨率",
    "callStats.encoder": "编码器",
    "callStats.decoder": "解码器",
    "callStats.hardware": "硬件",
    "callStats.software": "软件",
    "callStats.limitedBy": "受限于",
    "callStats.limitCpu": "CPU",
    "callStats.limitBandwidth": "带宽",
    "callStats.limitNone": "无",
    "callStats.limitOther": "其他",
    "callStats.frameTime": "每帧耗时",
    "callStats.resent": "重发",
    "callStats.droppedFrames": "丢弃的帧",
    "callStats.nackPli": "NACK / PLI",
    "callStats.softwareEncodeHint":
        "你的视频使用软件编码，这会占用 CPU，并可能在高负载下丢帧。“设置 > 调试”会显示硬件视频编码是否可用（功能状态下的 video_encode）。",
    "callStats.cpuLimitHint": "视频编码器正在降低画质，因为 CPU 跟不上。",
    "voiceCallPanel.unmute": "取消静音",
    "voiceCallPanel.undeafen": "取消拒听",
    "voiceCallPanel.deafen": "拒听",
    "voiceCallPanel.disconnect": "断开连接",

    // src/lib/components/messages/VoiceMessagePlayer.svelte
    "voiceMessagePlayer.seek": "跳转",
    "voiceMessagePlayer.voiceMessage": "语音消息",
    "midiPlayer.play": "播放",
    "midiPlayer.pause": "暂停",
    "midiPlayer.seek": "位置",
    "midiPlayer.volume": "音量",

    // src/lib/components/messages/VoiceRecorder.svelte
    "voiceRecorder.cancelRecording": "取消录制",
    "voiceRecorder.stop": "停止",
    "voiceRecorder.discard": "丢弃",
    "voiceRecorder.discardRecording": "丢弃录音",
    "voiceRecorder.voiceMessage": "语音消息",
    "voiceRecorder.sending": "正在发送…",
    "voiceRecorder.send": "发送",
    "voiceRecorder.microphoneAccessWasDenied": "麦克风访问被拒绝。",
    "voiceRecorder.recordingFailed": "录制失败。",
    "voiceRecorder.nothingWasRecorded": "没有录到任何内容。",
    "voiceRecorder.failedToSendVoiceMessage": "发送语音消息失败",

    // src/lib/components/settings/WhatsNew.svelte
    "whatsNew.whatSNew": "新增内容",
    "whatsNew.loadingReleaseNotes": "正在加载发行说明…",
    "whatsNew.releaseNotesUnavailable": "发行说明不可用。",
    "whatsNew.viewOnGithub": "在 GitHub 上查看",

    // src/lib/components/layout/WhatsNewModal.svelte
    "whatsNewModal.whatSNew": "新增内容",
    "whatsNewModal.whatSNewSince": "自 v{from} 以来的新增内容",
    "whatsNewModal.whatSNewInV": "v{APP_VERSION} 的新增内容",
    "whatsNewModal.releaseNotesUnavailable": "发行说明不可用。",
    "whatsNewModal.viewOnGithub": "在 GitHub 上查看",
    "whatsNewModal.gotIt": "知道了",

    // src/lib/components/layout/VerificationRequestCard.svelte
    "verificationRequestCard.verifyYourOtherSession": "验证你的另一个会话",
    "verificationRequestCard.verificationRequest": "验证请求",
    "verificationRequestCard.anotherOfYourSessions": "你的另一个会话",

    // src/lib/components/messages/CallEventCard.svelte
    "callEventCard.missedCall": "未接来电",
    "callEventCard.ongoingCall": "通话进行中",
    "callEventCard.callEnded": "通话已结束",

    // src/lib/components/messages/ComposerActionsMenu.svelte
    "composerActionsMenu.uploadAFile": "上传文件",
    "composerActionsMenu.camera": "摄像头",
    "composerActionsMenu.photosAndVideos": "照片和视频",
    "composerActionsMenu.files": "文件",
    "composerActionsMenu.sendFileDirectly": "直接发送文件",
    "composerActionsMenu.createPoll": "创建投票",
    "composerActionsMenu.recordVoiceMessage": "录制语音消息",
    "composerActionsMenu.shareLocation": "共享位置",
    "composerActionsMenu.createThread": "创建消息列",

    // src/lib/components/messages/Reactions.svelte
    "reactions.couldNotAddReaction": "无法添加回应",

    // src/lib/components/ui/QrScanner.svelte
    "qrScanner.startingTheCamera": "正在启动摄像头…",
    "qrScanner.cameraAccessWasDenied": "摄像头访问被拒绝。",
    "qrScanner.noCameraWasFoundOnThis": "此设备上未找到摄像头。",
    "qrScanner.theCameraIsAlreadyInUse": "摄像头已被另一个应用占用。",
    "qrScanner.couldNotOpenTheCameraA":
        "无法打开摄像头。需要安全（https）连接。",
    "qrScanner.codeFoundCheckingIt": "已发现代码，正在检查…",
    "qrScanner.couldNotStartVerificationWithThat": "无法使用该代码开始验证。",
    "qrScanner.thatIsnTAVerificationCode": "这不是验证码。",
    "qrScanner.thisDeviceHasNoCameraAvailable": "此设备没有可用的摄像头。",
    "qrScanner.couldNotStartTheCameraPreview": "无法启动摄像头预览。",
    "qrScanner.pointTheCameraAtTheirCode": "请将摄像头对准对方的代码。",

    // src/lib/desktopContextMenu.ts
    "desktopContextMenu.failedToSaveImage": "保存图片失败",

    // src/lib/matrix/client.ts
    "client.serverAutoDiscoveryFailedUsingThe":
        "服务器自动发现失败，将使用输入的原始地址",
    "client.discoveredHomeserverFailedValidation": "发现的主服务器未通过验证",
    "client.thisHomeserverDoesnTSupportSliding":
        "此主服务器不支持滑动同步，因此改用经典同步。",
    "client.notLoggedIn": "未登录",
    "client.creatorsNeedRoomV12":
        "额外的创建者需要房间版本 12 或更高，而此服务器不提供该版本。",
    "client.oauthProviderChanged": "服务器的登录提供方已更改。请重试。",
    "client.thisEventTypeCannotBeForwarded": "此事件类型无法转发",
    "client.notConnected": "未连接",
    "client.thisServerDoesNotAllowSigning":
        "此服务器不允许使用密码登出会话，请改用其账户页面。",
    "client.incorrectPassword": "密码不正确",
    "client.thisServerDoesNotAllowConfirming":
        "此服务器不允许使用密码确认此操作，请改用其账户页面。",
    "client.directMessages": "私信",
    "client.messagesInDirectMessageRooms": "私信房间中的消息",
    "client.rooms": "房间",
    "client.messagesInAllOtherRooms": "所有其他房间中的消息",
    "client.fullMatrixIdMentions": "完整 Matrix ID 提及",
    "client.messagesUsingYourFullUserHomeserver":
        "使用你完整的 @user:homeserver ID 的消息",
    "client.displayNameMentions": "显示名称提及",
    "client.messagesContainingYourDisplayName": "包含你显示名称的消息",
    "client.usernameMentions": "用户名提及",
    "client.messagesContainingYourUsernameWithoutServer":
        "包含你用户名（不含服务器）的消息",
    "client.roomMentions": "@room 提及",
    "client.messagesUsingRoomToNotifyEveryone": "使用 @room 通知所有人的消息",
    "client.invitations": "邀请",
    "client.whenYouAreInvitedToA": "当你被邀请加入房间时",
    "client.thisRoom": "此房间",
    "client.keywordCannotStartWith": "关键词不能以“.”开头",
    "client.emotes": "{value} 表情",
    "client.room": "房间",
    "client.emojis": "表情符号",
    "client.enterAShortcode": "请输入短代码。",
    "client.useOnlyLettersNumbersDotsUnderscores":
        "只能使用字母、数字、点、下划线、加号和连字符。",
    "client.chooseAtLeastOneUsage": "请至少选择一种用途。",
    "client.imageNotFound": "未找到图片。",
    "client.noPermissionToEditPack": "你无权编辑此图片包。",
    "client.invalidPowerLevels": "权限等级无效：{shapeError}",
    "client.roomCreatorsPowerLevelCannotBe":
        "无法在 v12 房间中设置房间创建者的权限等级",
    "client.restrictedJoinRequiresAtLeastOne": "受限加入至少需要一个上级空间",
    "client.orderMustBeAtMost50":
        "排序值最多为 50 个可打印 ASCII 字符（从空格到 ~）",
    "client.cannotSetSuggestedOnASpace": "无法对没有 via 的空间子项设置推荐",
    "client.pollHasNoEventId": "投票没有事件 ID",
    "client.unsupportedPoll": "不支持的投票",
    "client.youCanTCloseThisPoll": "你无法结束此投票",
    "client.microphoneDisconnectedSwitchedToTheDefault":
        "麦克风已断开，已切换到默认设备",
    "client.cameraDisconnected": "摄像头已断开",
    "client.cameraIsDisabledInSettings": "你的摄像头已在“语音和视频”设置中停用",
    "client.unknownRoom": "未知房间",
    "client.theServerRejectedItYouMay":
        "服务器拒绝了请求，你可能无权在此房间加入通话",
    "client.callMembershipFailed": "通话成员身份失败：{detail}",
    "client.voiceServerRejectedTheJoin": "语音服务器拒绝了加入请求（{status}）",
    "client.voiceCallDisconnected": "语音通话已断开",
    "client.couldNotReachCallServer":
        "无法连接到 {server}，因此你可能听不到此通话中的部分人。",
    "client.yourMicrophoneAppearsSilentCheckYour":
        "你的麦克风似乎没有声音，请检查你的输入设备",
    "client.audioDeviceError": "音频设备错误：{message}",
    "client.couldnTSwitchToThatKept": "无法切换到该{what}，已保留你之前的设置",
    "client.couldnTSwitchToThatUsing": "无法切换到该{what}，将使用默认设备",
    "client.couldnTSwitchToThatPick": "无法切换到该{what}，请选择其他设备",
    "client.encryptedCallsUnsupported":
        "此通话已端到端加密，而此浏览器无法加密通话媒体。请尝试较新版本的 Chrome、Firefox 或 Safari，或使用桌面应用。",
    "client.codecCouldNotBeDecoded":
        "此设备无法解码 {codec} 视频。改为请求 H.264。",
    "client.couldNotSwitchVideoCodec": "无法切换视频编解码器",
    "client.couldNotStartScreenShare": "无法开始屏幕共享",
    "client.couldNotShareScreenAudio": "屏幕共享已开始，但没有音频",
    "client.couldnTChangeScreenShareQuality": "无法更改屏幕共享画质",
    "client.couldNotStartTheCameraCheck": "无法启动摄像头，请检查权限",
    "client.couldnTApplyAudioProcessingChange":
        "无法应用音频处理更改（{error}）",
    "client.deviceNounMicrophone": "麦克风",
    "client.deviceNounCamera": "摄像头",

    // src/lib/matrix/crypto.ts
    "crypto.couldNotStartTheEmojiCheck": "无法开始表情符号核对",
    "crypto.couldNotCancelTheVerification": "无法取消验证",
    "crypto.noCodeAvailableTheOtherSide": "没有可用的代码，对方无法扫描。",
    "crypto.couldNotGenerateAQrCode": "无法生成二维码",
    "crypto.thatCodeDoesnTMatchThis": "该代码与此次验证不匹配",
    "crypto.couldNotConfirmTheQrMatch": "无法确认二维码匹配",
    "crypto.couldNotCancelTheQrMatch": "无法取消二维码匹配",
    "crypto.encryptionIsNotReadyOnThis": "此会话的加密尚未就绪",
    "crypto.roomIsNotEncrypted": "此房间未加密。",
    "crypto.roomKeyDiscarded":
        "你在这里的下一条消息将使用新的房间密钥，并再次与房间内的每个会话共享。",
    "crypto.encryptionKeysUnchecked":
        "无法与服务器核对此会话的加密密钥。请检查你的连接并重新加载。",
    "crypto.encryptionDataLost":
        "此会话的加密数据已丢失（清除了浏览器数据或重新安装），因此它已被登出，以防别人向它已不再拥有的密钥加密。请重新登录。",
    "crypto.accountApprovalCancelled": "在你的账户页面上的批准已被取消。",
    "crypto.accountPasswordRequired": "此服务器需要你的账户密码来确认此操作。",
    "crypto.thisServerCanTConfirmEncryption":
        "此服务器无法使用密码确认加密设置，请改用其账户页面。",
    "crypto.incorrectPassword": "密码不正确",
    "crypto.failedToGenerateARecoveryKey": "生成恢复密钥失败",
    "crypto.yourOldRecoveryWasResetBut":
        "你的旧恢复已重置，但设置新的恢复失败。",
    "crypto.thatKeyDoesnTMatchThis": "该密钥与服务器上此账户的备份不匹配。",
    "crypto.thatDoesnTLookLikeA":
        "这看起来不是有效的恢复密钥。请检查是否有拼写错误，然后重试。",
    "crypto.thisAccountHasNoRecoverySet":
        "此账户尚未设置恢复。请先在拥有你密钥的会话上设置恢复。",
    "crypto.thatRecoveryKeyDoesnTMatch":
        "该恢复密钥与此账户不匹配。请检查是否有拼写错误，然后重试。",
    "crypto.thisAccountSRecoveryWasnT":
        "此账户的恢复没有设置密码短语。请改用你的恢复密钥。",
    "crypto.couldnTUseYourPassphraseOn":
        "无法在这台设备上使用你的密码短语。请改用你的恢复密钥。",
    "crypto.thatPassphraseDoesnTMatchThis":
        "该密码短语与此账户不匹配。请检查是否有拼写错误，然后重试。",

    // src/lib/matrix/media.ts
    "media.notLoggedIn": "未登录",
    "media.failedToFetchAttachment": "获取附件失败：{status}",
    "media.encryptedAttachmentHasAnInvalidUrl": "加密附件的 URL 无效",
    "media.failedToFetchEncryptedAttachment": "获取加密附件失败：{status}",

    // src/lib/matrix/pluginHost.ts
    "pluginHost.mediaWasUploadedByADifferent": "该媒体由另一个账户上传",
    "pluginHost.notLoggedIn": "未登录",
    "pluginHost.notConnected": "未连接",

    // src/lib/matrix/runtime.ts
    "runtime.notLoggedIn": "未登录",

    // src/lib/plugins/builtins/double-tap-reply/index.ts
    "doubleTapReply.doubleTapSwipeActions": "双击和滑动操作",
    "doubleTapReply.doubleTapAMessageToReply":
        "双击消息可回复、回应或编辑，向左滑动可回复 / 编辑。",
    "doubleTapReply.doubleTapYourMessages": "双击你自己的消息",
    "doubleTapReply.nothing": "无操作",
    "doubleTapReply.reaction": "回应",
    "doubleTapReply.reply": "回复",
    "doubleTapReply.edit": "编辑",
    "doubleTapReply.doubleTapOtherMessages": "双击他人的消息",
    "doubleTapReply.reactionEmoji": "回应表情",
    "doubleTapReply.sentWhenADoubleTapAction": "当双击操作设为“回应”时发送。",
    "doubleTapReply.swipeToReplyEdit": "滑动以回复 / 编辑",
    "doubleTapReply.swipeAMessageLeftToReply":
        "向左滑动消息可回复；向左滑得更远可编辑你自己的消息。",
    "doubleTapReply.failedToReact": "回应失败",

    // src/lib/plugins/builtins/slash-fun/index.ts
    "slashFun.sendAnActionMessage": "发送动作消息",
    "slashFun.appendToYourMessage": "在你的消息末尾追加 ¯\\_(ツ)_/¯",
    "slashFun.appendToYourMessage2": "在你的消息末尾追加 (╯°□°)╯︵ ┻━┻",
    "slashFun.appendToYourMessage3": "在你的消息末尾追加 ┬─┬ ノ( ゜-゜ノ)",
    "slashFun.appendToYourMessage4": "在你的消息末尾追加 ( ͡° ͜ʖ ͡°)",
    "slashFun.sendYourMessageAsASpoiler": "将你的消息作为剧透发送",
    "slashFun.sendYourMessageWithoutMarkdownFormatting":
        "发送不带 Markdown 格式的消息",
    "slashFun.funSlashCommands": "趣味斜杠命令",
    "slashFun.noveltySlashCommandsMeShrugTableflip":
        "趣味斜杠命令：/me、/shrug、/tableflip、/unflip、/lenny、/spoiler、/plain。",

    // src/lib/plugins/builtins/text-replacer/index.ts
    "textReplacer.textReplacer": "文本替换",
    "textReplacer.applyYourOwnStringOrRegex":
        "对发出的消息文本应用你自己的字符串或正则表达式替换。",
    "textReplacer.replacementRules": "替换规则",
    "textReplacer.appliedToYourOutgoingMessageText":
        "按顺序应用于你发出的消息文本。收件人看到的是标准文本。",
    "textReplacer.find": "查找",
    "textReplacer.textOrPattern": "文本或模式",
    "textReplacer.replaceWith": "替换为",
    "textReplacer.regex": "正则表达式",
    "textReplacer.ignoreCase": "忽略大小写",
    "previewRewriter.name": "链接预览重写器",
    "previewRewriter.description":
        "从另一个地址获取链接预览，例如你的主服务器无法访问的网站的镜像。",
    "previewRewriter.rules": "重写规则",
    "previewRewriter.rulesDescription":
        "按顺序应用于获取预览所用的地址。链接本身不会改变。",

    // src/lib/plugins/pluginBoot.ts
    "pluginBoot.noPluginSyncDataOnYour": "你的账户上还没有插件同步数据。",
    "pluginBoot.theSyncDataOnYourAccount": "你账户上的同步数据格式有误。",
    "pluginBoot.autoUpdateFailed": "自动更新失败：{value}",

    // src/lib/plugins/pluginPin.ts
    "pluginPin.pluginIdMismatchIndexListsManifest":
        "插件 ID 不匹配：索引列出的是“{entryId}”，而清单声明的是“{manifestId}”",
    "pluginPin.cannotInstallPluginWithIdIt":
        "无法安装 ID 为“{manifestId}”的插件：它是内置插件",
    "pluginPin.pluginIsAlreadyInstalledFromA":
        "插件“{manifestId}”已从另一个仓库安装",

    // src/lib/plugins/repo.ts
    "repo.repoReferenceMustBeAString": "仓库引用必须是字符串",
    "repo.repoReferenceCannotBeEmpty": "仓库引用不能为空",
    "repo.branchCannotBeEmpty": "分支不能为空",
    "repo.branchCannotContain": "分支不能包含“..”",
    "repo.invalidRepoReferenceExtraPathSegments":
        "仓库引用无效：有多余的路径段（不是 /tree/<branch>）",
    "repo.invalidRepoReferenceMustBeOwner": "仓库引用无效：必须是 owner/repo",
    "repo.ownerCannotBeEmpty": "所有者不能为空",
    "repo.invalidOwnerMustMatchAZa":
        "所有者无效：必须匹配 [A-Za-z0-9][A-Za-z0-9._-]*",
    "repo.repoCannotBeEmpty": "仓库不能为空",
    "repo.invalidRepoMustMatchAZa":
        "仓库无效：必须匹配 [A-Za-z0-9][A-Za-z0-9._-]*",

    // src/lib/plugins/repoList.ts
    "repoList.enterARepoOwnerRepoOr":
        "请输入仓库（owner/repo 或 GitHub URL）。",
    "repoList.thatIsTheOfficialRepoAlready": "这是官方仓库（已包含在内）。",
    "repoList.thatRepoIsAlreadyAdded": "该仓库已添加。",

    // src/lib/stores/gifSearch.svelte.ts
    "gifSearch.couldnTReachKlipyTryAgain": "无法连接 KLIPY，请重试。",

    // src/lib/stores/liveLocation.svelte.ts
    "liveLocation.youCanTShareLiveLocation": "你无法在此房间共享实时位置。",
    "liveLocation.couldnTStartLiveLocation": "无法开始实时位置",
    "liveLocation.expired": "已过期",
    "liveLocation.lessThanAMinuteLeft": "不到一分钟",
    "liveLocation.minLeft": "还剩 {totalMin} 分钟",
    "liveLocation.hLeft": "还剩 {h} 小时",
    "liveLocation.hMinLeft": "还剩 {h} 小时 {m} 分钟",
    "liveLocation.justNow": "刚刚",
    "liveLocation.sAgo": "{floor} 秒前",
    "liveLocation.minAgo": "{floor} 分钟前",
    "liveLocation.hAgo": "{floor} 小时前",
    "liveLocation.n15Minutes": "15 分钟",
    "liveLocation.n1Hour": "1 小时",
    "liveLocation.n8Hours": "8 小时",

    // src/lib/stores/outbox.svelte.ts
    "outbox.failedToSend": "发送失败",

    // src/lib/stores/settings.svelte.ts
    "settings.couldNotReadThatFile": "无法读取该文件。",
    "settings.thatFileIsnTAValid": "该文件不是有效的字体。",
    "settings.fontCouldnTBeSavedOn": "无法在此设备上保存字体。",
    "settings.cannotSaveAPresetWithBuilt": "无法保存使用内置名称的预设：{name}",

    // src/lib/stores/shareInbox.svelte.ts
    "shareInbox.youReOfflineTheShareWas":
        "你处于离线状态：分享内容已添加到输入框",
    "shareInbox.couldnTSendTheShare": "无法发送分享内容",

    // src/lib/stores/verification.svelte.ts
    "verification.finishingAnotherVerificationFirstTryAgain":
        "正在先完成另一次验证。请重试。",
    "verification.waitingForTheOtherSideTo": "正在等待对方接受…",
    "verification.acceptedSettingUpTheCheck": "已接受，正在准备核对…",
    "verification.verifying": "正在验证…",
    "verification.sessionVerified": "会话已验证",
    "verification.userVerified": "用户已验证",
    "verification.verificationCancelled": "验证已取消",
    "verification.verified": "已验证",
    "verification.unverified": "未验证",
    "verification.signedByYou": "由你签名",
    "verification.notSignedByOwner": "未由所有者签名",
    "verification.verifyWithAnotherDevice": "使用另一台设备验证",
    "verification.useAnotherDevice": "使用另一台设备",
    "verification.couldNotSendVerificationRequest": "无法发送验证请求",
    "verification.sessionNotKnownYet":
        "此会话还不知道那个会话。请等待几秒钟后重试，或从新会话开始验证。",
    "verification.accountHasNoIdentity":
        "你账户的交叉签名密钥不在服务器上，因此你的其他会话无法验证这个会话。请在你设置恢复的会话上打开“设置 > 安全和加密”：如果它提示上传你的密钥，就照做。如果你从未设置恢复，请在任一会话上设置。",
    "verification.sessionHasNoKeys":
        "该会话尚未发布其加密密钥，因此无法被验证，也无法接收加密消息。请将其登出后重新登录。",
    "verification.sessionKeysRejected":
        "该会话的加密密钥被此会话拒绝。请将其登出后重新登录。",
    "verification.identityChanged": "身份已更改",
    "verification.couldnTAcceptThisRequestTry": "无法接受此请求。请重试。",

    // src/lib/stores/voiceCall.svelte.ts
    "voiceCall.couldnTLoadTheCallComponent":
        "无法加载通话组件。请检查你的连接，然后重新加载页面重试。",
    "voiceCall.couldNotJoinTheVoiceCall": "无法加入语音通话",
    "voiceCall.joinedWithoutAMicrophone":
        "你的麦克风不可用，但你仍可以收听并共享屏幕",
    "voiceCall.couldNotMuteYourMicrophone": "无法将你的麦克风静音",
    "voiceCall.couldNotUnmuteYourMicrophoneCheck":
        "无法取消麦克风静音，请检查你的输入设备",
    "voiceCall.connecting": "正在连接…",
    "voiceCall.startedSharing": "{name} 正在共享屏幕",
    "voiceCall.watch": "观看",
    "voiceCall.voiceConnected": "语音已连接",
    "voiceCall.reconnecting": "正在重新连接…",
    "voiceCall.gpuGivenUp":
        "图形进程反复崩溃，因此 GPU 将保持关闭直到 Zam 重启，视频使用软件编码。",
    "voiceCall.gpuRecovered":
        "图形进程已重启，因此通话已重新连接，以便继续使用 GPU 进行视频编码。",
    "voiceCall.restartZam": "重启 Zam",
    "voiceCall.youWereBannedFromThisRoom": "你已被此房间封禁，通话已结束",
    "voiceCall.youLeftThisRoomCallEnded": "你已离开此房间，通话已结束",
    "voiceCall.youWereRemovedFromThisRoom": "你已被移出此房间，通话已结束",

    // src/lib/update.ts
    "update.noReleasesFoundYet": "尚未找到发行版本。",
    "update.githubApiError": "GitHub API 错误（{status}）。",
    "update.staleBuild":
        "此网页版本（{current}）比最新发行版（{latest}）旧。服务器可能还在跟进，请几分钟后重试。",
    "update.couldNotReadTheLatestVersion": "无法读取最新版本。",

    // src/lib/utils/accountSecurity.ts
    "accountSecurity.enterYourCurrentPassword": "请输入你当前的密码。",
    "accountSecurity.enterANewPassword": "请输入新密码。",
    "accountSecurity.newPasswordMustBeAtLeast": "新密码至少需要 8 个字符。",
    "accountSecurity.newPasswordMustBeDifferentFrom":
        "新密码必须与当前密码不同。",
    "accountSecurity.passwordsDoNotMatch": "两次输入的密码不一致。",

    // src/lib/utils/activeSession.ts
    "activeSession.offAlwaysNotify": "关闭，始终通知",
    "activeSession.n15Seconds": "15 秒",
    "activeSession.n30Seconds": "30 秒",
    "activeSession.n1Minute": "1 分钟",
    "activeSession.n2Minutes": "2 分钟",
    "activeSession.n5Minutes": "5 分钟",
    "activeSession.n10Minutes": "10 分钟",
    "activeSession.n30Minutes": "30 分钟",
    "activeSession.enterANumberOfMinutes": "请输入分钟数。",
    "activeSession.chooseAtLeast1MinuteUse":
        "请至少选择 1 分钟，更短的时间请使用上方的列表。",
    "activeSession.chooseMinutes2HoursOrLess":
        "请选择不超过 {MAX_CUSTOM_GRACE_MINUTES} 分钟（2 小时）的时长。",

    // src/lib/utils/audioDevices.ts
    "audioDevices.microphone": "麦克风",
    "audioDevices.speaker": "扬声器",
    "audioDevices.camera": "摄像头",

    // src/lib/utils/audioPlayback.ts
    "audioPlayback.failedToLoadRetry": "加载失败 · 重试",
    "audioPlayback.clickToPlay": "点击播放",

    // src/lib/utils/clientGeneration.ts
    "clientGeneration.sessionChangedBeforeTheOperationFinished":
        "操作完成之前会话已更改",

    // src/lib/utils/customFont.ts
    "customFont.useAWoff2TtfOrOtf": "请使用 .woff2、.ttf 或 .otf 字体文件。",
    "customFont.thatFontFileIsEmpty": "该字体文件为空。",
    "customFont.fontFileIsTooLargeMax": "字体文件太大（最大 10 MB）。",
    "customFont.customFont": "自定义字体",

    // src/lib/utils/deviceSessions.ts
    "deviceSessions.unknown": "未知",
    "deviceSessions.justNow": "刚刚",
    "deviceSessions.desktopApp": "桌面应用",
    "deviceSessions.on": "{os} 上的 {client}",
    "deviceSessions.minutesAgo": "{count, plural, other {# 分钟前}}",
    "deviceSessions.hoursAgo": "{count, plural, other {# 小时前}}",
    "deviceSessions.daysAgo": "{count, plural, other {# 天前}}",

    // src/lib/utils/displaySources.ts
    "displaySources.screen": "屏幕",
    "displaySources.untitledWindow": "无标题窗口",

    // src/lib/utils/encryptionState.ts
    "encryptionState.unableToDecryptYouMayNot":
        "无法解密，你可能没有这条消息的密钥。",
    "encryptionState.theSenderChoseNotToShare":
        "发送者选择不分享这条消息的密钥。",
    "encryptionState.theSenderDidNotShareThe":
        "发送者没有分享密钥，因为这台设备未经验证。请验证此设备以读取此类消息。",
    "encryptionState.senderDeviceNotCrossSigned":
        "发送者的设备没有被其所有者交叉签名，因此这条消息已被隐藏。请让对方验证该会话。",
    "encryptionState.senderDeviceUnknown":
        "这条消息无法关联到发送者的任何已知设备，因此已被隐藏。",
    "encryptionState.senderIdentityChanged":
        "自你验证发送者以来，其身份已发生变化，因此这条消息已被隐藏。请重新验证对方以读取它。",
    "encryptionState.historicalNoBackup":
        "这条消息发送于这台设备登录之前，且没有可用于恢复它的密钥备份。",
    "encryptionState.historicalBackupUnconfigured":
        "这条消息发送于这台设备登录之前。输入你的恢复密钥即可从密钥备份中恢复它。",
    "encryptionState.historicalWorkingBackup":
        "这条消息发送于这台设备登录之前，并且在你的密钥备份中没有找到。",
    "encryptionState.historicalNotJoined": "这条消息发送时你不在房间中。",
    "encryptionState.encryptedMessage": "🔒 加密消息",

    // src/lib/utils/eventShield.ts
    "eventShield.thisMessageSEncryptionCouldNot":
        "无法完全验证这条消息的加密。",
    "eventShield.encryptedByAnUnverifiedUser": "由未验证的用户加密。",
    "eventShield.encryptedByADeviceNotVerified":
        "由未被其所有者验证的设备加密。",
    "eventShield.encryptedByAnUnknownOrDeleted": "由未知或已删除的设备加密。",
    "eventShield.theAuthenticityOfThisEncryptedMessage":
        "无法在这台设备上保证这条加密消息的真实性。",
    "eventShield.theSenderWasPreviouslyVerifiedBut":
        "发送者此前已通过验证，但更改了其身份。",
    "eventShield.theSenderDoesnTMatchThe":
        "发送者与发送这条消息的设备的所有者不一致。",

    // src/lib/utils/extendedProfile.ts
    "extendedProfile.aStatusNeedsBothAnEmoji":
        "状态需要同时包含表情符号和文字。",
    "extendedProfile.inACall": "通话中",
    "extendedProfile.inACallForMin": "已通话 {minutes} 分钟",
    "extendedProfile.inACallForH": "已通话 {hours} 小时",
    "extendedProfile.other": "其他",
    "extendedProfile.atMostLinks": "最多 {MAX_CONNECTIONS} 个链接。",
    "extendedProfile.linksMustBeHttpHttpsMailto":
        "链接必须是 http、https、mailto 或 matrix 地址。",
    "extendedProfile.inACallForHMin": "已通话 {hours} 小时 {minutes} 分钟",

    // src/lib/utils/geoErrors.ts
    "geoErrors.locationNeedsASecureHttpsConnection":
        "定位需要安全（HTTPS）连接，请通过 https 打开应用。",
    "geoErrors.locationPermissionWasDeniedCheckSite":
        "定位权限被拒绝，请检查网站权限。",
    "geoErrors.yourPositionIsUnavailableLocationOff":
        "无法获取你的位置（定位已关闭或没有 GPS 定位）。",
    "geoErrors.timedOutGettingYourLocation": "获取你的位置超时。",
    "geoErrors.couldnTGetYourLocation": "无法获取你的位置。",
    "geoErrors.locationIsnTAvailableInThis": "此浏览器不支持定位。",

    // src/lib/utils/joinRules.ts
    "joinRules.onlyAvailableForRoomsInsideA": "仅适用于空间内的房间",
    "joinRules.thisRoomSVersionDoesnT": "此房间的版本不支持限定空间的加入方式",

    // src/lib/utils/keyBackup.ts
    "keyBackup.preparing": "正在准备…",
    "keyBackup.fetchingYourEncryptedHistory": "正在获取你的加密历史…",
    "keyBackup.restoringYourEncryptedHistory": "正在恢复你的加密历史…",
    "keyBackup.restoringOfKeys": "正在恢复密钥：{successes} / {total}…",
    "keyBackup.noEncryptedHistoryToRestore": "没有可恢复的加密历史",
    "keyBackup.restored": "{count, plural, other {已恢复 # 个密钥}}",
    "keyBackup.ofKeysRestored": "已恢复 {imported} / {total} 个密钥",
    "keyBackup.notSetUp": "未设置",
    "keyBackup.notTrusted": "不受信任",
    "keyBackup.notConnected": "未连接",
    "keyBackup.on": "已开启",
    "keyBackup.encryptedMessageHistoryIsnTBeing":
        "加密消息历史没有被备份。请设置恢复来保护它。",
    "keyBackup.aBackupExistsOnTheServer":
        "服务器上存在备份，但此会话尚未信任它。",
    "keyBackup.aBackupExistsButThisSession":
        "存在备份，但此会话尚未连接到它。输入你的恢复密钥以恢复历史记录。",
    "keyBackup.messageHistoryIsBeingBackedUp":
        "消息历史正在备份（v{version}）。",
    "keyBackup.messageHistoryIsBeingBackedUp2": "消息历史正在备份。",
    "keyBackup.noKeysBackedUpYet": "尚未备份任何密钥",
    "keyBackup.backedUp": "{count, plural, other {已备份 # 个密钥}}",
    "keyBackup.stillToUpload": "{count, plural, other {还有 # 个密钥待上传}}",
    "keyBackup.everythingOnThisSessionIsBacked": "此会话上的所有内容都已备份",
    "keyBackup.notSet": "未设置",
    "keyExportSettings.exportOrImportRoomKeys": "导出或导入房间密钥",
    "keyExportSettings.aKeyFileLetsAnotherApp":
        "密钥文件可以让另一个 Matrix 应用或新会话读取你的加密消息历史。请将文件及其密码短语保存在安全的地方：任何同时拥有两者的人都能读取你的消息。",
    "keyExportSettings.export": "导出",
    "keyExportSettings.import": "导入",
    "keyExportSettings.passphrase": "密码短语",
    "keyExportSettings.confirmPassphrase": "确认密码短语",
    "keyExportSettings.passphrasesDontMatch": "两次输入的密码短语不一致",
    "keyExportSettings.exportKeys": "导出密钥",
    "keyExportSettings.exporting": "正在导出…",
    "keyExportSettings.exported": "{count, plural, other {已导出 # 个密钥}}",
    "keyExportSettings.couldNotExportYourKeys": "无法导出你的密钥",
    "keyExportSettings.keyFile": "密钥文件",
    "keyExportSettings.importKeys": "导入密钥",
    "keyExportSettings.wrongPassphrase": "密码短语错误，或文件已被更改",
    "keyExportSettings.notAKeyFile": "这不是密钥文件，或文件已损坏",
    "keyExportSettings.newerFormat":
        "此密钥文件由较新的应用生成，无法在这里读取",
    "keyExportSettings.couldNotImportTheKeys": "无法导入密钥",

    // src/lib/utils/keywordRules.ts
    "keywordRules.keywordCannotBeEmpty": "关键词不能为空",
    "keywordRules.keywordCannotStartWith": "关键词不能以“.”开头",
    "keywordRules.youAlreadyHaveARuleFor": "你已经有针对此关键词的规则",

    // src/lib/utils/liveAnnouncer.ts
    "liveAnnouncer.messageFrom": "来自 {sender} 的消息",
    "liveAnnouncer.newMessagesFrom":
        "{count, plural, other {来自 {sender} 的 # 条新消息}}",
    "liveAnnouncer.newMessages": "{count, plural, other {# 条新消息}}",

    // src/lib/utils/liveShareStop.ts
    "liveShareStop.couldnTStopSharingYourLive":
        "无法停止共享你的实时位置，此房间仍可看到它。请使用“重试停止”再试一次。",
    "liveShareStop.stopping": "正在停止…",
    "liveShareStop.stillSharingCouldnTStop": "仍在共享，无法停止",
    "liveShareStop.youReAlreadySharingYourLive":
        "你已经在此房间中共享实时位置。",
    "liveShareStop.yourLastLiveLocationShareHere":
        "你在这里上一次的实时位置共享尚未停止，请先在房间横幅中停止它，再开始新的共享。",
    "liveShareStop.stop": "停止",
    "liveShareStop.retryStop": "重试停止",

    // src/lib/utils/location.ts
    "location.location": "位置",

    // src/lib/utils/mediaGallery.ts
    "mediaGallery.of": "{value} / {length}{value2}",

    // src/lib/utils/messageActionsMenu.ts
    "messageActionsMenu.edit": "编辑",
    "messageActionsMenu.unpin": "取消置顶",
    "messageActionsMenu.pin": "置顶",
    "messageActionsMenu.copyLink": "复制链接",
    "messageActionsMenu.report": "举报",

    // src/lib/utils/messageDisplay.ts
    "messageDisplay.systemDefault": "系统默认",

    // src/lib/utils/micErrorMessage.ts
    "micErrorMessage.microphoneAccessIsBlockedAllowIt":
        "麦克风访问被阻止，请在浏览器或系统设置中允许后再说话",
    "micErrorMessage.noMicrophoneFoundConnectOneOr":
        "未找到麦克风，请连接一个，或选择其他输入设备后再说话",
    "micErrorMessage.couldNotOpenYourMicrophoneAnother":
        "无法打开你的麦克风，可能有其他应用正在使用它",

    // src/lib/utils/mutePowerLevel.ts
    "mutePowerLevel.enterAPowerLevel": "请输入权限等级",
    "mutePowerLevel.mustBeAWholeNumber": "必须是整数",
    "mutePowerLevel.useToMute": "使用 {MUTE_POWER_LEVEL} 表示禁言",
    "mutePowerLevel.youCanTSetALevel": "你不能设置高于自己的等级（{ceiling}）",

    // src/lib/utils/notifActions.ts
    "notifActions.reply": "回复",
    "notifActions.reply2": "回复…",
    "notifActions.markAsRead": "标为已读",

    // src/lib/utils/notificationPrivacy.ts
    "notificationPrivacy.sentAMessage": "发来了一条消息",
    "notificationPrivacy.newMessage": "新消息",

    // src/lib/utils/notifyPermission.ts
    "notifyPermission.notificationsAreBlockedSoIncomingCalls":
        "通知已被禁止，因此窗口隐藏时来电不会提醒你。请在系统设置中取消禁止通知。",
    "notifyPermission.thisBrowserCanTShowCall":
        "此浏览器无法在窗口隐藏时显示来电提醒。",

    // src/lib/utils/pollContent.ts
    "pollContent.addAQuestion": "请添加问题。",
    "pollContent.addAtLeastTwoOptions": "请至少添加两个选项。",
    "pollContent.atMostOptions": "最多 {MAX_ANSWERS} 个选项。",
    "pollContent.invalidNumberOfSelections": "可选数量无效。",
    "pollContent.thePollHasEnded": "投票已结束。",

    // src/lib/utils/powerLevels.ts
    "powerLevels.enterAPowerLevel": "请输入权限等级",
    "powerLevels.mustBeAWholeNumber": "必须是整数",
    "powerLevels.mustBe0OrHigher": "必须大于或等于 0",
    "powerLevels.youCanTSetALevel": "你不能设置高于自己的等级（{ceiling}）",

    // src/lib/utils/presence.ts
    "presence.online": "在线",
    "presence.away": "离开",
    "presence.offline": "离线",
    "presence.seenAsOnlineWhileTheApp": "应用同步期间显示为在线",
    "presence.shownAsIdleToOtherUsers": "向其他用户显示为空闲",
    "presence.invisible": "隐身",
    "presence.appearOfflineToOtherUsers": "向其他用户显示为离线",

    // src/lib/utils/pushRuleWrite.ts
    "pushRuleWrite.yourHomeserverHasNoNotificationRule":
        "你的主服务器没有“{label}”通知规则，因此无法更改。",
    "pushRuleWrite.yourHomeserverRejectedTheChangeTo":
        "你的主服务器拒绝了对“{label}”通知的更改。",
    "pushRuleWrite.notificationsDidNotChangeOnYour":
        "“{label}”通知在你的主服务器上没有变化。",
    "pushRuleWrite.couldNotSaveNotificationsCheckYour":
        "无法保存“{label}”通知。请检查你的连接后重试。",

    // src/lib/utils/pusherVerification.ts
    "pusherVerification.noGatewayUrl": "（无网关 URL）",

    // src/lib/utils/recoveryPassphrase.ts
    "recoveryPassphrase.enterAPassphrase": "请输入密码短语。",
    "recoveryPassphrase.useAtLeastCharacters":
        "请至少使用 {MIN_PASSPHRASE_LENGTH} 个字符。",

    // src/lib/utils/reportMessage.ts
    "reportMessage.failedToSendReport": "发送举报失败",

    // src/lib/utils/roomAliases.ts
    "roomAliases.enterAnAddress": "请输入地址。",
    "roomAliases.addressesCannotContainSpaces": "地址不能包含空格。",
    "roomAliases.addressesCannotContain": "地址不能包含“:”。",
    "roomAliases.addressesCannotContain2": "地址不能包含“#”。",
    "roomAliases.addressesCannotContainControlCharacters":
        "地址不能包含控制字符。",
    "roomAliases.addressIsTooLongMaxCharacters":
        "地址太长（最多 {MAX_ALIAS_LENGTH} 个字符）。",
    "roomAliases.thatAddressAlreadyExists": "该地址已存在。",

    // src/lib/utils/roomCreationOutcome.ts
    "roomCreationOutcome.theServerRejectedTheChange": "服务器拒绝了此更改",
    "roomCreationOutcome.theRoomWasCreatedButAdding":
        "房间已创建，但将其添加到空间失败：{detailSentence}",
    "roomCreationOutcome.theDirectMessageWasCreatedBut":
        "私信已创建，但将其保存到你的私信列表失败：{detailSentence} 在重试之前，它可能显示为普通房间。",
    "roomCreationOutcome.theRoomWasCreatedButAdding2":
        "房间已创建，但尚未确认已将其添加到空间，可能仍在保存中。如果房间没有出现在空间里，请重试。",
    "roomCreationOutcome.theDirectMessageWasCreatedBut2":
        "私信已创建，但尚未确认已将其保存到你的私信列表，可能仍在保存中。如果它没有出现在你的私信列表里，请重试。",

    // src/lib/utils/roomEncryption.ts
    "roomEncryption.thisRoomIsAlreadyEncrypted": "此房间已加密。",
    "roomEncryption.youNeedPowerLevelToEnable":
        "你需要权限等级 {required} 才能启用加密。",
    "roomEncryption.youAlreadyHaveADirectMessage":
        "你已经与该用户有一个未加密的私信。无法自动添加加密，请打开它，并在房间的“安全”设置中开启。",
    "roomEncryption.enableEncryptionWarning":
        "加密一旦开启就无法关闭。每个人都需要支持加密的客户端才能读取新消息。",

    // src/lib/utils/roomHeaderMenu.ts
    "roomHeaderMenu.threads": "消息列",
    "roomHeaderMenu.pinnedMessages": "置顶消息",
    "roomHeaderMenu.notificationsInbox": "通知收件箱",
    "roomHeaderMenu.mediaAndFiles": "媒体和文件",
    "roomHeaderMenu.memberList": "成员列表",

    // src/lib/utils/roomMedia.ts
    "roomMedia.image": "图片",
    "roomMedia.video": "视频",
    "roomMedia.file": "文件",
    "roomMedia.audio": "音频",
    "roomMedia.kb": "{toFixed} KB",
    "roomMedia.mb": "{toFixed} MB",

    // src/lib/utils/roomSettingsNav.ts
    "roomSettingsNav.general": "常规",
    "roomSettingsNav.access": "访问",
    "roomSettingsNav.security": "安全",
    "roomSettingsNav.permissions": "权限",
    "roomSettingsNav.members": "成员",
    "roomSettingsNav.emotes": "表情",
    "roomSettingsNav.rooms": "房间",

    // src/lib/utils/roomStateTrust.ts
    "roomStateTrust.unverifiedRoomState": "未验证的房间状态",
    "roomStateTrust.unverifiedRoomStateTooltip":
        "此房间的部分详情（角色、成员身份和权限）是直接从服务器获取的，尚未通过同步确认，因此可能不准确。无论这里显示什么，操作仍由服务器强制执行。",

    // src/lib/utils/roomUpgrade.ts
    "roomUpgrade.theServerSRecommendedRoomVersion":
        "服务器推荐的房间版本不可用。",
    "roomUpgrade.thisRoomIsOnTheLatest":
        "此房间已是最新版本（v{recommendedVersion}）。",
    "roomUpgrade.youDonTHavePermissionTo": "你无权升级此房间。",

    // src/lib/utils/saveFile.ts
    "saveFile.savedToDownloads": "已保存到“下载”",

    // src/lib/utils/securityStatusView.ts
    "securityStatusView.couldnTReadThisAccountS":
        "无法读取此账户的加密状态。在加载完成之前，这里的内容都不可靠，请先不要设置或重置恢复。",
    "securityStatusView.encryptionIsnTReadyOnThis":
        "此会话的加密尚未就绪。如果这种情况持续存在，请重新加载。",

    // src/lib/utils/serverAcl.ts
    "serverAcl.allowListIsEmptyWhichDenies":
        "允许列表为空，这会拒绝所有服务器参与联邦。",
    "serverAcl.denyListContainsWhichBansAll":
        "拒绝列表包含 *，这会封禁所有服务器。",
    "serverAcl.thisConfigurationBansYourOwnServer":
        "此配置会封禁你自己的服务器（{ownServerName}），这将破坏联邦。",

    // src/lib/utils/serverCapabilities.ts
    "serverCapabilities.crossSigningE2ee": "交叉签名（E2EE）",
    "serverCapabilities.privateReadReceipts": "私密已读回执",
    "serverCapabilities.threadedRelations": "消息列关系",
    "serverCapabilities.spaceSummaries": "空间摘要",
    "serverCapabilities.busyPresence": "忙碌状态",
    "serverCapabilities.dehydratedDevices": "休眠设备",
    "serverCapabilities.filterPublicRoomsByType": "按类型筛选公开房间",
    "serverCapabilities.authenticatedMedia": "经认证的媒体",
    "serverCapabilities.intentionalMentions": "有意提及",
    "serverCapabilities.slidingSyncSimplified": "滑动同步（简化版）",
    "serverCapabilities.sharedRoomsWithAUser": "与某用户的共同房间",

    // src/lib/utils/settingsNav.ts
    "settingsNav.account": "账户",
    "settingsNav.securitySessions": "安全与会话",
    "settingsNav.privacySafety": "隐私与安全",
    "settingsNav.app": "应用",
    "settingsNav.appearance": "外观",
    "settingsNav.messagesMedia": "消息和媒体",
    "settingsNav.voiceVideo": "语音和视频",
    "settingsNav.emotes": "表情",
    "settingsNav.advanced": "高级",
    "settingsNav.general": "常规",
    "settingsNav.plugins": "插件",
    "settingsNav.server": "服务器",
    "settingsNav.about": "关于",
    "settingsNav.debug": "调试",

    // src/lib/utils/settingsSearch.ts
    "settingsSearch.displayName": "显示名称",
    "settingsSearch.avatar": "头像",
    "settingsSearch.presence": "在线状态",
    "settingsSearch.changePassword": "更改密码",
    "settingsSearch.logOut": "登出",
    "settingsSearch.deactivateAccount": "停用账户",
    "settingsSearch.sessions": "会话",
    "settingsSearch.encryptNewDirectMessages": "加密新的私信",
    "settingsSearch.onlySendToVerifiedDevices": "仅发送给已验证的设备",
    "settingsSearch.setUpRecovery": "设置恢复",
    "settingsSearch.restoreMessageHistory": "恢复消息历史",
    "settingsSearch.verifyThisSession": "验证此会话",
    "settingsSearch.rightAlignMyMessages": "我的消息靠右对齐",
    "settingsSearch.showWhenIAmInA": "通话时显示",
    "settingsSearch.showNameColours": "显示名称颜色",
    "settingsSearch.textSize": "文字大小",
    "settingsSearch.font": "字体",
    "settingsSearch.themePresets": "主题预设",
    "settingsSearch.importExportTheme": "导入 / 导出主题",
    "settingsSearch.timeFormat": "时间格式",
    "settingsSearch.dateFormat": "日期格式",
    "settingsSearch.showMatrixIds": "显示 Matrix ID",
    "settingsSearch.readReceiptAvatars": "已读回执头像",
    "settingsSearch.linkPreviews": "链接预览",
    "settingsSearch.linkPreviewMedia": "链接预览媒体",
    "settingsSearch.pauseVideosOffScreen": "视频移出屏幕时暂停",
    "settingsSearch.sendVideosThatStreamFaster": "发送可更快开始播放的视频",
    "settingsSearch.sendPhotosThatAppearSooner": "发送可更快显示的照片",
    "settingsSearch.removeLocationAndMetadata":
        "移除上传内容中的位置和其他元数据",
    "settingsSearch.sendGifsAsAnimatedWebp": "将 GIF 作为动画 WebP 发送",
    "settingsSearch.midiSoundBank": "MIDI 音色库",
    "settingsSearch.holdToOpenMessageMenu": "长按打开消息菜单",
    "settingsSearch.checkSpelling": "拼写检查",
    "settingsSearch.gifDefaultTab": "GIF 默认标签页",
    "settingsSearch.minimiseToTrayOnClose": "关闭时最小化到托盘",
    "settingsSearch.richPresence": "Rich Presence",
    "settingsSearch.runAtStartup": "开机启动",
    "settingsSearch.proxy": "代理",
    "settingsSearch.reduceMotion": "减少动态效果",
    "settingsSearch.keepRoomListOpen": "保持房间列表打开",
    "settingsSearch.customEmotes": "自定义表情",
    "settingsSearch.pushNotificationsPermission": "推送通知权限",
    "settingsSearch.notificationSound": "通知声音",
    "settingsSearch.desktopAlertsPopUpAndTaskbar":
        "桌面提醒（弹窗和任务栏闪烁）",
    "settingsSearch.popUpNotifications": "弹窗通知",
    "settingsSearch.quietOnMyOtherDevices": "我的其他设备保持安静",
    "settingsSearch.privateReadReceipts": "私密已读回执",
    "settingsSearch.hideMessageTextInNotifications": "在通知中隐藏消息文本",
    "settingsSearch.notificationRules": "通知规则",
    "settingsSearch.keywordHighlights": "关键词高亮",
    "settingsSearch.inputDevice": "输入设备",
    "settingsSearch.outputDevice": "输出设备",
    "settingsSearch.camera": "摄像头",
    "settingsSearch.noiseSuppression": "降噪",
    "settingsSearch.echoCancellation": "回声消除",
    "settingsSearch.autoGainControl": "自动增益控制",
    "settingsSearch.normalizeVoices": "均衡人声音量",
    "settingsSearch.mirrorMyCamera": "镜像我的摄像头",
    "settingsSearch.videoCodec": "视频编解码器",
    "settingsSearch.noiseSuppressionGpu": "GPU 加速",
    "settingsSearch.adaptiveStream": "自适应视频质量",
    "settingsSearch.callVolume": "通话音量",
    "settingsSearch.playCallSounds": "播放通话提示音",
    "settingsSearch.ringForIncomingDmCalls": "私信来电时响铃",
    "settingsSearch.blockedUsers": "被屏蔽的用户",
    "settingsSearch.serverCapabilities": "服务器功能",
    "settingsSearch.plugins": "插件",
    "settingsSearch.pluginRepositories": "插件仓库",
    "settingsSearch.syncPlugins": "同步插件",
    "settingsSearch.checkForUpdates": "检查更新",
    "settingsSearch.clearCache": "清除缓存",
    "settingsSearch.showAllEvents": "显示所有事件",
    "settingsSearch.orderHints": "消息顺序提示",
    "settingsSearch.pushDiagnostics": "推送诊断",
    "settingsSearch.pushService": "推送服务（UnifiedPush / Firebase）",
    "settingsSearch.language": "语言",

    // src/lib/utils/slashCommands.ts
    "slashCommands.createAPoll": "创建投票",
    "slashCommands.shareYourLocation": "共享你的位置",
    "slashCommands.joinARoomByAddress": "通过地址加入房间",
    "slashCommands.leaveTheCurrentRoom": "离开当前房间",
    "slashCommands.inviteAUserToThisRoom": "邀请用户加入此房间",
    "slashCommands.setTheRoomTopic": "设置房间主题",
    "slashCommands.removeAUserFromThisRoom": "将用户移出此房间",
    "slashCommands.userServerReason": "<@user:server> [原因]",
    "slashCommands.banAUserFromThisRoom": "将用户从此房间封禁",
    "slashCommands.setYourDisplayName": "设置你的显示名称",
    "slashCommands.displayName": "<显示名称>",
    "slashCommands.setAUserSPowerLevel": "设置用户的权限等级",
    "slashCommands.userServerLevel": "<@user:server> [等级]",
    "slashCommands.resetAUserSPowerLevel": "将用户的权限等级重置为默认",
    "slashCommands.discardSession":
        "如果别人无法读取你的消息，则在下一条消息中使用新的房间密钥",
    "slashCommands.usage": "用法：/{name} {argHint}",
    "slashCommands.usage2": "用法：/{name}",

    // src/lib/utils/syncStatus.ts
    "syncStatus.connected": "已连接",
    "syncStatus.reconnecting": "正在重新连接…",
    "syncStatus.connectionError": "连接错误",
    "syncStatus.offline": "离线",
    "syncStatus.connecting": "正在连接…",

    // src/lib/utils/themePalette.ts
    "themePalette.accent": "强调色",
    "themePalette.background": "背景",
    "themePalette.secondaryBackground": "次级背景",
    "themePalette.tertiaryBackground": "三级背景",
    "themePalette.primaryText": "主要文字",
    "themePalette.secondaryText": "次要文字",
    "themePalette.mutedText": "弱化文字",
    "themePalette.danger": "危险",
    "themePalette.positive": "积极",
    "themePalette.mentionHighlight": "提及高亮",
    "themePalette.link": "链接",
    "themePalette.warning": "警告",
    "themePalette.onlineStatus": "在线状态",
    "themePalette.idleStatus": "空闲状态",
    "themePalette.doNotDisturbStatus": "请勿打扰状态",
    "themePalette.offlineStatus": "离线状态",
    "themePalette.divider": "分隔线",
    "themePalette.spoilerBackground": "剧透背景",
    "themePalette.ownMessageBubble": "自己的消息气泡",
    "themePalette.primaryTextOnBackground": "背景上的主要文字",
    "themePalette.secondaryTextOnBackground": "背景上的次要文字",
    "themePalette.mutedTextOnTertiaryBackground": "三级背景上的弱化文字",
    "themePalette.whiteTextOnAccentButtons": "强调色按钮上的白色文字",
    "themePalette.whiteTextOnDangerButtons": "危险按钮上的白色文字",
    "themePalette.whiteTextOnOwnBubble": "自己气泡上的白色文字",

    // src/lib/utils/themePreset.ts
    "themePreset.copy": "{newName}（副本）",

    // src/lib/utils/threadList.ts
    "threadList.noPreview": "（无预览）",

    // src/lib/utils/threePidInvite.ts
    "threePidInvite.youDonTHavePermissionTo": "你无权邀请他人加入此房间。",
    "threePidInvite.yourHomeserverHasNoIdentityServer":
        "你的主服务器没有身份服务器，因此无法使用邮件邀请。",

    // src/lib/utils/timeFormat.ts
    "timeFormat.yesterdayAt": "昨天 {time}",
    "timeFormat.today": "今天",
    "timeFormat.yesterday": "昨天",
    "timeFormat.separatorDatePattern": "yyyy年M月d日 EEEE",
    "timeFormat.monthDayPattern": "M月d日",
    "timeFormat.compactDateTime": "{date} {time}",

    // src/lib/utils/updateStatus.ts
    "updateStatus.checkingForUpdates": "正在检查更新…",
    "updateStatus.youReOnTheLatestVersion": "你已在使用最新版本{versionSuffix}",
    "updateStatus.checkForUpdates": "检查更新",
    "updateStatus.updateAvailable": "有可用更新{versionSuffix}",
    "updateStatus.lastInstallFailed": "上次更新{versionSuffix}未能安装",
    "updateStatus.downloadInstall": "下载并安装",
    "updateStatus.downloadingV": "正在下载 v{version}",
    "updateStatus.downloadingUpdate": "正在下载更新",
    "updateStatus.updateReadyInstall": "更新已就绪{versionSuffix} - 安装",
    "updateStatus.install": "安装",
    "updateStatus.updateReadyRestartToApply":
        "更新已就绪{versionSuffix} - 重启以应用",
    "updateStatus.restartToApply": "重启以应用",
    "updateStatus.updateReadyReloadToApply":
        "更新已就绪{versionSuffix} - 重新加载以应用",
    "updateStatus.reloadToApply": "重新加载以应用",
    "updateStatus.aNewVersionIsAvailable": "有新版本可用{versionSuffix}",
    "updateStatus.openReleasePage": "打开发行页面",
    "updateStatus.flatpakManualUpdate":
        "有可用更新{versionSuffix}。请通过你的软件中心或使用 flatpak update 安装",
    "updateStatus.updateCheckFailed": "检查更新失败",
    "updateStatus.checkForUpdatesToInstallThe": "检查更新以安装最新版本。",

    // src/lib/utils/uploadLimits.ts
    "uploadLimits.mb": "{round} MB",
    "uploadLimits.kb": "{round} KB",
    "uploadLimits.exceedsTheServerSUploadLimit":
        "“{fileName}”超过了服务器 {formatByteLimit} 的上传限制",

    // src/lib/utils/verificationMessage.ts
    "verificationMessage.verificationRequestSent": "验证请求已发送",
    "verificationMessage.waitingForThemToAccept": "正在等待对方接受…",
    "verificationMessage.noLongerPending": "已不再等待处理",
    "verificationMessage.wantsToVerify": "{senderName} 想要进行验证",
    "verificationMessage.compareEmojiToConfirmThisIs":
        "比对表情符号，确认对方确实是本人",
    "verificationMessage.sentAVerificationRequest":
        "{senderName} 发送了验证请求",

    // src/lib/utils/verificationStatus.ts
    "verificationStatus.checkingEncryption": "正在检查加密…",
    "verificationStatus.encryptionUnavailable": "加密不可用",
    "verificationStatus.statusUnavailable": "状态不可用",
    "verificationStatus.verified": "已验证",
    "verificationStatus.thisSessionIsVerifiedAndEncryption":
        "此会话已验证，加密已完全设置好。",
    "verificationStatus.notSetUp": "未设置",
    "verificationStatus.setUpEncryptionToSecureYour":
        "设置加密，以便在各设备间保护你的消息。",
    "verificationStatus.setUp": "设置",
    "verificationStatus.encryptionSetupIncomplete": "加密设置未完成",
    "verificationStatus.thisSessionIsVerifiedButEncryption":
        "此会话已验证，但加密设置尚未完成。",
    "verificationStatus.finishSetup": "完成设置",
    "verificationStatus.unverified": "未验证",
    "verificationStatus.thisSessionIsnTVerifiedYet": "此会话尚未验证。",

    // src/routes/+layout.svelte
    "rootLayout.linkCopied": "链接已复制",

    // src/routes/+page.svelte
    "rootPage.failedToReconnectPleaseLogIn": "重新连接失败。请重新登录。",
    "rootPage.sessionOpenInAnotherTab":
        "此会话在另一个标签页中打开。待那个标签页关闭后，此标签页将继续。",
    "rootPage.signedInButSyncingCouldNot": "已登录，但无法开始同步。请重试。",
    "rootPage.yourSessionHasExpiredPleaseSign": "你的会话已过期。请重新登录。",

    // ownStatus
    "ownStatus.profileField": "个人资料字段 {key}",
    "ownStatus.theServerStillHas": "服务器上仍保留：{leftovers}",
    "messageInput.directFile": "直接",
    "messageInput.directFileHint": "按下发送时直接发出，不会上传。",
    "messageInput.sendDirectly": "直接发送",
    "messageItem.replyPreviewFileOffer": "文件请求",
    "fileOffer.unavailable": "此版本的 Zam 无法读取这个文件请求。",
    "fileOffer.details": "{size}，直接发送",
    "fileOffer.waiting": "正在等待有人接受。请保持 Zam 打开。",
    "fileOffer.fromElsewhere": "由你的另一个会话发出。",
    "fileOffer.gone": "已不能再从此会话获取。",
    "fileOffer.expired": "此文件请求已过期。",
    "fileOffer.accept": "接受",
    "fileOffer.retry": "重试",
    "fileOffer.cancel": "取消",
    "fileOffer.withdraw": "撤回",
    "fileOffer.connecting": "正在连接发送者...",
    "fileOffer.progress": "{done} / {total}，{rate}/秒",
    "fileOffer.verifying": "正在校验文件...",
    "fileOffer.savedDone": "文件已保存并通过校验。",
    "fileOffer.sentDone": "已送达 {peer}。",
    "fileOffer.sendingTo": "发送给 {peer}",
    "fileOffer.cancelled": "传输已取消。",
    "fileOffer.failedOffline": "发送者不可用。他们需要打开 Zam。",
    "fileOffer.failedRefused": "发送者的会话拒绝了此次传输。",
    "fileOffer.failedNoSfu": "发送者的服务器没有可用于传输文件的通话服务。",
    "fileOffer.failedConnection": "连接已断开。",
    "fileOffer.failedStalled": "传输已停滞。",
    "fileOffer.failedCorrupt": "文件在传输途中被改动，因此已被丢弃。",
    "fileOffer.failedWrite": "无法写入文件。磁盘是否已满？",
    "fileOffer.failedStorageFull": "没有足够的存储空间保存此文件。",
    "fileOffer.failedHash": "完成的文件与原文件不一致，因此已被丢弃。",
    "fileOffer.failedUnsupported": "此设备暂不支持保存直接传输的文件。",
    "ownStatus.statusClearedButPresenceRemains":
        "状态已清除，但服务器仍显示在线状态消息“{presenceLeft}”。它可能是由此账户的另一个会话（另一个应用或客户端）设置的，请在那里清除，或将该会话登出。",
    "qrLogin.failed": "二维码登录失败。请重试。",
    "qrLogin.cancelled": "二维码登录已取消。",
    "qrLogin.cancelledOther": "另一台设备取消了登录。",
    "qrLogin.insecure": "与另一台设备的连接不可信，因此登录已停止。",
    "qrLogin.wrongServer":
        "另一台设备登录在 {server} 上，而这不是你在这里选择的服务器。",
    "qrLogin.codeMismatch":
        "数字不匹配，因此登录已停止。仅当另一台设备上显示的数字就是你输入的数字时才继续。",
    "qrLogin.untrustedApproval":
        "新设备要求你在一个不属于你账户登录提供方的地址上批准，因此已被拒绝。",
    "qrLogin.enterNumber":
        "输入你另一台设备上显示的数字。这是为了确认只有你们两台设备相连。",
    "qrLogin.numberLabel": "数字",
    "qrLogin.confirm": "继续",
    "qrLogin.waitingApproval": "请在你的另一台设备上批准登录以完成。",
    "qrLogin.notVerified":
        "你已登录，但此会话未能收到你的加密密钥。请在“设置”中验证它，以读取较早的加密消息。",
    "qrLogin.linkConnecting": "正在连接新设备...",
    "qrLogin.linkShowNumber": "请在新设备上输入这个数字",
    "qrLogin.linkDoneVerified": "新设备已登录并通过验证。",
    "qrLogin.denied": "登录在另一台设备上被拒绝。",
    "qrLogin.expired": "二维码已过期。请重试。",
    "qrLogin.notALoginCode":
        "这不是此账户新设备的登录代码。请在你想登录的设备上打开“使用二维码登录”。",
    "qrLogin.notSupportedHere": "此账户的登录提供方不支持使用二维码登录。",
    "qrLogin.signInButton": "使用二维码登录",
    "qrLogin.signInTitle": "使用二维码登录",
    "qrLogin.signInSteps":
        "在已登录 Zam 的设备上，依次打开“设置”、“账户”，再点“扫描二维码以登录新设备”，然后扫描此二维码。",
    "qrLogin.codeAlt": "供已登录设备扫描的二维码",
    "qrLogin.preparing": "正在准备代码...",
    "qrLogin.matchCode": "批准页面会显示此代码。仅当两者一致时才批准。",
    "qrLogin.signingIn": "正在登录...",
    "qrLogin.cancel": "取消",
    "qrLogin.linkButton": "扫描二维码以登录新设备",
    "qrLogin.linkTitle": "关联新设备",
    "qrLogin.linkIntro":
        "在新设备上选择“使用二维码登录”，然后扫描它显示的二维码。你在账户的登录页面上批准登录，之后两台设备会互相验证。",
    "qrLogin.linkWarning": "仅在该设备此刻就在你手中时才继续。",
    "qrLogin.linkApprove":
        "请在 {host} 上批准登录。确认那里的代码与新设备上的一致，并且仅在设备是你自己的时才批准。",
    "qrLogin.linkApproveButton": "在 {host} 上批准",
    "qrLogin.linkWaiting": "正在等待新设备登录...",
    "qrLogin.linkDone":
        "新设备已登录。请在两台设备上刚刚打开的窗口中完成验证。",
    "qrLogin.linkDoneUnverified":
        "新设备已登录。未能自动开始验证；请在“设置”的“会话”中验证它。",
    "qrLogin.notADeviceCode": "这不是有效的代码。请输入新设备上显示的代码。",
    "qrLogin.loginSectionTitle": "登录",
    "qrLogin.loginSectionIntro":
        "从这台设备登录另一台设备，无需输入你的用户名和密码。",
    "qrLogin.codeButton": "输入新设备上的代码",
    "qrLogin.codeTitle": "使用代码登录",
    "qrLogin.codeIntro":
        "在新设备上选择“使用二维码登录”。二维码下方会显示一个短代码，请在这里输入该代码。",
    "qrLogin.codeLabel": "新设备上显示的代码",
    "qrLogin.codeContinue": "继续",
    "qrLogin.orEnterCode":
        "没有摄像头？在已登录的设备上依次打开“设置”、“账户”、“登录”，选择“输入新设备上的代码”，然后在下方输入代码。",
    "qrLogin.notAShownCode":
        "这不是来自已登录设备的代码。请在已登录的设备上依次打开“设置”、“账户”、“登录”，然后选择“显示二维码供新设备扫描”。",
    "qrLogin.showButton": "显示二维码供新设备扫描",
    "qrLogin.showTitle": "为新设备显示代码",
    "qrLogin.showIntro":
        "在新设备上选择“使用二维码登录”，然后选择“扫描已登录设备上的代码”，并扫描此二维码。",
    "qrLogin.showCodeAlt": "供新设备扫描的二维码",
    "qrLogin.showEnterNumber": "输入新设备显示的数字",
    "qrLogin.showRetry": "显示新代码",
    "qrLogin.scanInstead": "改为扫描已登录设备上的代码",
    "qrLogin.scanTitle": "扫描已登录设备上的代码",
    "qrLogin.scanIntro":
        "在已登录的设备上依次打开“设置”、“账户”、“登录”，选择“显示二维码供新设备扫描”，然后在这里扫描它。",
    "qrLogin.scanShowNumber":
        "请在已登录的设备上输入这个数字，然后在那里批准登录。",
    "qrLogin.showInstead": "改为显示我自己的代码",
    "qrLogin.chooseIntro":
        "有多个新会话在同一时刻登录。请选择你正在设置的那个。",
    "qrLogin.linkClose": "关闭",
    // src/lib/components/messages/MessageEmbed.svelte
    "messageEmbed.deleted": "消息已删除",
    "messageEmbed.inRoom": "在 {room}",
    "messageEmbed.jumpToMessage": "跳转到链接的消息：",
};

const catalogue: LocaleCatalogue = { messages, dateLocale: zhCN };

export default catalogue;
