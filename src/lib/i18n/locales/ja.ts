// Japanese (ja). Same keys and placeholders as ../en.ts; typed as a full
// `Record` so a new English string that is not yet translated here fails
// type-checking instead of silently showing English.

import { ja } from "date-fns/locale/ja";
import type { MessageKey } from "../en";
import type { LocaleCatalogue } from "../index";

const messages: Record<MessageKey, string> = {
    "common.turnOffCamera": "カメラをオフにする",
    "common.turnOnCamera": "カメラをオンにする",
    "common.stopSharing": "共有を停止",
    "common.shareYourScreen": "画面を共有",
    "common.joining": "参加中…",
    "common.join": "参加",
    "common.closeDialog": "ダイアログを閉じる",
    "common.settings": "設定",
    "common.searchResults": "検索結果",
    "common.default": "デフォルト",
    "common.mute": "ミュート",
    "common.saving": "保存中…",
    "common.unblock": "ブロック解除",
    "common.block": "ブロック",
    "common.closeMenu": "メニューを閉じる",
    "common.openRoomList": "ルーム一覧を開く",
    "common.uploading": "アップロード中…",
    "common.uploadImage": "画像をアップロード",
    "common.emoji": "絵文字",
    "common.decline": "拒否",
    "common.invitePeople": "メンバーを招待",
    "common.close": "閉じる",
    "common.cancel": "キャンセル",
    "common.loading": "読み込み中…",
    "common.loadMore": "さらに読み込む",
    "common.notifications": "通知",
    "common.save": "保存",
    "common.topic": "トピック",
    "common.videoRoom": "ビデオルーム",
    "common.reasonOptional": "理由（任意）",
    "common.actions": "操作",
    "common.copy": "コピー",
    "common.remove": "削除",
    "common.add": "追加",
    "common.starting": "開始中…",
    "common.verify": "検証",
    "common.removeFromFavourites": "お気に入りから削除",
    "common.addToFavourites": "お気に入りに追加",
    "common.stickers": "ステッカー",
    "common.retry": "再試行",
    "common.delete": "削除",
    "common.checking": "確認中…",
    "common.gifs": "GIF",
    "common.dragOrUseArrowKeysTo": "ドラッグするか矢印キーでサイズを変更",
    "common.resizePicker": "ピッカーのサイズを変更",
    "common.noResults": "結果なし",
    "common.memberCount": "{count, plural, other {#人のメンバー}}",
    "common.replyCount": "{count, plural, other {#件の返信}}",
    "aboutSettings.automaticUpdates": "自動更新",
    "aboutSettings.version": "バージョン",
    "aboutSettings.currentVersionV": "現在のバージョン v{APP_VERSION}",
    "aboutSettings.checkForUpdates": "アップデートを確認",
    "aboutSettings.updateAvailable": "アップデートがあります",
    "aboutSettings.reloading": "再読み込み中…",
    "aboutSettings.update": "アップデート",
    "aboutSettings.reloadToUpdate": "再読み込みして更新",
    "aboutSettings.youReOnTheLatestVersion": "最新バージョンを使用しています。",
    "aboutSettings.credits": "クレジット",
    "aboutSettings.creditsMidiInstruments": "MIDI音源",
    "aboutSettings.creditsSoundFont":
        "{author} 作。{original} の Phoenix を基にしています。CC BY でライセンスされ、General MIDI に再マッピングして Zam 用に圧縮しています。",
    "aboutSettings.creditsSoundFontGaps":
        "MT-32 にない音色: {microgmAuthor} 作の {microgm}（WTFPL）と、{generalUserAuthor} 作の {generalUser}。",
    "aboutSettings.troubleshooting": "トラブルシューティング",
    "aboutSettings.clearCacheAndResync": "キャッシュを消去して再同期",
    "aboutSettings.reDownloadsYourRoomsFromThe":
        "サーバーからルームを再ダウンロードします。欠落しているルームや停止したルームを修復します。サインイン状態は維持されます。",
    "aboutSettings.resyncing": "再同期中…",
    "aboutSettings.clearCache": "キャッシュを消去",
    "aboutSettings.updateCheckFailed": "アップデートの確認に失敗しました",
    "aboutSettings.downloadFailed": "ダウンロードに失敗しました",
    "aboutSettings.installFailed": "インストールに失敗しました",
    "aboutSettings.failedToCheckForUpdates":
        "アップデートの確認に失敗しました。",
    "aboutSettings.sourceCodeOnGitHub": "GitHub のソースコード",
    "accountSettings.profile": "プロフィール",
    "accountSettings.yourAvatar": "あなたのアバター",
    "accountSettings.changeAvatar": "アバターを変更",
    "accountSettings.yourDisplayName": "表示名",
    "accountSettings.saved": "保存しました",
    "accountSettings.account": "アカウント",
    "accountSettings.userId": "ユーザーID",
    "accountSettings.homeserver": "ホームサーバー",
    "accountSettings.connection": "接続",
    "accountSettings.presence": "プレゼンス",
    "accountSettings.password": "パスワード",
    "accountSettings.currentPassword": "現在のパスワード",
    "accountSettings.newPassword": "新しいパスワード",
    "accountSettings.confirmNewPassword": "新しいパスワード（確認）",
    "accountSettings.signOutAllOtherSessions":
        "他のすべてのセッションからサインアウト",
    "accountSettings.changing": "変更中…",
    "accountSettings.changePassword": "パスワードを変更",
    "accountSettings.passwordChanged": "パスワードを変更しました。",
    "accountSettings.thisServerDoesNotAllowChanging":
        "このサーバーでは、このアプリからパスワードを変更できません。",
    "accountSettings.managedByProvider":
        "パスワード、セッション、アカウントはサインインプロバイダのアカウントページで管理されています。",
    "accountSettings.manageAccount": "アカウントを管理",
    "accountSettings.emailPhoneNumbers": "メールアドレスと電話番号",
    "accountSettings.noEmailAddressesOrPhoneNumbers":
        "このアカウントにはメールアドレスも電話番号も登録されていません。",
    "accountSettings.email": "メールアドレス",
    "accountSettings.phone": "電話番号",
    "accountSettings.thisServerDoesNotAllowManaging":
        "このサーバーでは、このアプリから管理できません。",
    "accountSettings.logOut": "ログアウト",
    "accountSettings.dangerZone": "危険な操作",
    "accountSettings.deactivateAccount": "アカウントを無効化…",
    "accountSettings.deactivationIsPermanentAndCannotBe":
        "無効化は永続的で、元に戻せません。",
    "accountSettings.eraseMessagesWherePossible":
        "可能な範囲でメッセージを消去",
    "accountSettings.deactivating": "無効化中…",
    "accountSettings.deactivateAccount2": "アカウントを無効化",
    "accountSettings.avatarUploadFailed":
        "アバターのアップロードに失敗しました",
    "accountSettings.failedToRemoveAvatar": "アバターの削除に失敗しました",
    "accountSettings.failedToSaveName": "名前の保存に失敗しました",
    "accountSettings.couldNotSetPresence": "プレゼンスを設定できませんでした",
    "accountSettings.failedToChangePassword": "パスワードの変更に失敗しました",
    "accountSettings.failedToDeactivateAccount":
        "アカウントの無効化に失敗しました",
    "accountSwitcher.signOut": "{userId} からサインアウト",
    "accountSwitcher.confirm": "確認",
    "accountSwitcher.signOut2": "サインアウト",
    "accountSwitcher.addAccount": "アカウントを追加",
    "accountSwitcher.accountMenu": "アカウントメニュー",
    "accountSwitcher.closeAccountMenu": "アカウントメニューを閉じる",
    "accountSwitcher.back": "戻る",
    "accountSwitcher.setYourStatus": "ステータスを設定",
    "accountSwitcher.setAStatus": "ステータスを設定",
    "accountSwitcher.editProfile": "プロフィールを編集",
    "accountSwitcher.switchAccounts": "アカウントを切り替え",
    "accountSwitcher.couldNotSetPresence": "プレゼンスを設定できませんでした",
    "activeCallBanner.openCall": "通話を開く",
    "activeCallBanner.open": "開く",
    "activeCallBanner.ringing": "呼び出し中…",
    "activeCallBanner.voiceCallInCall": "音声通話 · 通話時間 {length}",
    "activeCallBanner.leave": "退出",
    "appearanceSettings.rightAlignMyMessagesBubbleLayout":
        "自分のメッセージを右寄せ（吹き出し表示）",
    "appearanceSettings.displayYourOwnMessagesOnThe":
        "自分のメッセージを色付きの吹き出しで右側に表示します",
    "appearanceSettings.showNameColours": "名前の色を表示",
    "appearanceSettings.drawPeopleSNamesInThe":
        "プロフィールで設定した色で名前を表示します。オフにすると全員が通常の文字色になります。",
    "appearanceSettings.keepRoomListOpen": "ルーム一覧を開いたままにする",
    "appearanceSettings.donTAutoCloseTheRoom":
        "スペースやホームを切り替えてもルーム一覧を自動で閉じません。ルームやダイレクトメッセージを開くと常に閉じます。",
    "appearanceSettings.timestamps": "タイムスタンプ",
    "appearanceSettings.timeFormat": "時刻の形式",
    "appearanceSettings.dateFormat": "日付の形式",
    "appearanceSettings.customDatePattern": "カスタム日付パターン",
    "appearanceSettings.yyyyMmDd": "yyyy-MM-dd",
    "appearanceSettings.preview": "プレビュー:",
    "appearanceSettings.dateFnsTokensEGYyyy":
        "· date-fns のトークン（例: yyyy-MM-dd）",
    "appearanceSettings.invalidFormatUseLowercaseDateFns":
        "形式が正しくありません。yyyy-MM-dd のような小文字の date-fns トークンを使ってください。",
    "appearanceSettings.alwaysShowAbsoluteDates": "常に絶対日付を表示",
    "appearanceSettings.replaceTodayAndYesterdayWithThe":
        "「今日」「昨日」をすべて完全な日付に置き換えます。",
    "appearanceSettings.reduceMotion": "モーションを減らす",
    "appearanceSettings.minimizeAnimationsAndTransitionsYourDevice":
        "アニメーションとトランジションを最小限にします。デバイスのシステム設定「モーションを減らす」も常に尊重されます。",
    "appearanceSettings.custom": "カスタム",
    "appearanceSettings.12Hour": "12時間制",
    "appearanceSettings.24Hour": "24時間制",
    "appearanceSettings.language": "言語",
    "appearanceSettings.layout": "レイアウト",
    "appearanceSettings.displayLanguage": "表示言語",
    "appearanceSettings.displayLanguageHint":
        "Zam のメニューとボタンの表示言語です。変更するとアプリが再読み込みされます。",
    "appPage.redirecting": "リダイレクト中…",
    "appSettings.backToSettings": "設定に戻る",
    "appSettings.closeSettings": "設定を閉じる",
    "appSettings.searchSettings": "設定を検索…",
    "appSettings.searchSettings2": "設定を検索",
    "appSettings.noSettingsMatch": "一致する設定がありません",
    "appSettings.noSettingsMatch2":
        "「{searchQuery}」に一致する設定がありません。",
    "appSettings.resultCount": "{count, plural, other {#件の結果}}",
    "appShell.zam": "({notificationCount}) Zam",
    "appShell.redirecting": "リダイレクト中…",
    "appShell.noRoomsYet": "ルームがまだありません",
    "appShell.resizeRoomList": "ルーム一覧のサイズを変更",
    "appShell.createARoomOrStartA":
        "ルームを作成するか、ダイレクトメッセージを開始してください。",
    "appShell.nothingInHome": "ホームに何もありません",
    "appShell.allOfYourRoomsLiveIn":
        "すべてのルームはスペース内にあります。スペースを開くと表示されます。スペース外のルームとダイレクトメッセージはここに表示されます。",
    "appShell.openRoomList": "ルーム一覧を開く",
    "appShell.someone": "だれか",
    "appShell.isCalling": "{name} から着信中",
    "appShell.incomingCall": "着信",
    "appShell.offlineMessageStorageIsUnavailableThis":
        "このセッションではオフラインメッセージの保存が利用できないため、履歴は次回に残りません。",
    "appShell.couldnTSendYourReplyIt":
        "返信を送信できませんでした。下書きとして保存されています。",
    "appShell.yourNotificationReplyWasSavedAs":
        "通知からの返信を下書きとして保存しました",
    "blockedUsersSettings.messagesFromBlockedUsersAreHidden":
        "ブロックしたユーザーのメッセージは、すべてのルームで非表示になります。リストはアカウントに保存され、すべてのセッションに適用されます。",
    "blockedUsersSettings.youHavenTBlockedAnyone":
        "ブロックしているユーザーはいません。",
    "blockedUsersSettings.failed": "失敗しました",
    "callParticipantMenu.profile": "プロフィール",
    "callParticipantMenu.input": "入力",
    "callParticipantMenu.output": "出力",
    "callParticipantMenu.opening": "開いています…",
    "callParticipantMenu.message": "メッセージ",
    "callParticipantMenu.mention": "メンション",
    "callParticipantMenu.userVolume": "ユーザーの音量",
    "callParticipantMenu.shareVolume": "共有音量",
    "callParticipantMenu.hideVideo": "ビデオを非表示",
    "callParticipantMenu.kicking": "キック中…",
    "callParticipantMenu.confirmKick": "{name} をキックしますか？",
    "callParticipantMenu.kickFromRoom": "{name} をルームからキック",
    "callParticipantMenu.banning": "BAN中…",
    "callParticipantMenu.confirmBan": "{name} をBANしますか？",
    "callParticipantMenu.ban": "{name} をBAN",
    "callParticipantMenu.couldNotOpenADirectMessage":
        "ダイレクトメッセージを開けませんでした",
    "callParticipantMenu.couldNotKick": "{name} をキックできませんでした",
    "callParticipantMenu.couldNotBan": "{name} をBANできませんでした",
    "callEncryption.encrypted":
        "エンドツーエンド暗号化: この通話の参加者だけが映像と音声を見聞きできます。",
    "callEncryption.encryptedShort": "暗号化済み",
    "callEncryption.partial":
        "エンドツーエンド暗号化（{names} を除く）: そのアプリは音声と映像を暗号化せずに送信します。あなたは相手を見聞きできますが、相手のアプリが暗号化通話に対応するまで、相手はあなたを見聞きできません。",
    "callEncryption.partialShort": "一部暗号化",
    "callEncryption.notEncrypted":
        "エンドツーエンド暗号化されていません: 通話サーバーがこの通話を見聞きできます。暗号化されたルームでの通話は暗号化されます。",
    "callView.ringing": "呼び出し中…",
    "callView.showChat": "チャットを表示",
    "callView.noOneIsInThisCall": "この通話には誰もいません",
    "callView.backToGrid": "グリッドに戻る",
    "callView.screenShareQuality": "画面共有の品質",
    "callView.optionsFor": "{name} のオプション",
    "callView.muted": "ミュート中",
    "callView.deafened": "スピーカーミュート中",
    "callView.mutedForYou": "あなたに対してミュート中",
    "callView.joinedFromMultipleDevices": "複数のデバイスから参加中",
    "callView.devices": "{value}台のデバイス",
    "callView.enableAudio": "音声を有効にする",
    "callView.onHold": "別の通話が有効なため保留中",
    "callView.resume": "再開",
    "callView.speakerOn": "スピーカーを使用",
    "callView.speakerOff": "スピーカーの使用を停止",
    "callView.unmute": "ミュート解除",
    "callView.undeafen": "スピーカーミュート解除",
    "callView.deafen": "スピーカーミュート",
    "callView.disconnect": "切断",
    "callView.joinCall": "通話に参加",
    "callView.you": "あなた",
    "callView.sScreen": "{name} の画面",
    "callView.exitSpotlightFor": "{label} のスポットライトを解除",
    "callView.spotlight": "{label} をスポットライト",
    "createPollDialog.createPoll": "投票を作成",
    "createPollDialog.question": "質問",
    "createPollDialog.askSomething": "質問を入力…",
    "createPollDialog.options": "選択肢",
    "createPollDialog.option": "選択肢 {value}",
    "createPollDialog.removeOption": "選択肢を削除",
    "createPollDialog.addOption": "+ 選択肢を追加",
    "createPollDialog.results": "結果",
    "createPollDialog.showAsPeopleVote": "投票に合わせて表示",
    "createPollDialog.hideUntilClosed": "終了まで非表示",
    "createPollDialog.allowSelectingMultipleOptions": "複数選択を許可",
    "createPollDialog.creating": "作成中…",
    "createPollDialog.failedToCreatePoll": "投票の作成に失敗しました",
    "cryptoUnavailableBanner.offOutOfStorage":
        "ストレージが不足したため、このデバイスでは暗号化がオフになっています。暗号化されたメッセージを読み書きできません。空き容量を確保してから再試行してください。",
    "cryptoUnavailableBanner.offLocked":
        "通知がキーを使用していたため、このデバイスでは暗号化がオフになっています。暗号化されたメッセージを読み書きできません。",
    "cryptoUnavailableBanner.offOther":
        "このデバイスでは暗号化がオフになっています。暗号化されたメッセージを読み書きできず、暗号化キーも公開されていません。",
    "cryptoUnavailableBanner.tryAgain": "再試行",
    "cryptoUnavailableBanner.freeUpSpaceFirst":
        "先に空き容量を確保してください",
    "cryptoUnavailableBanner.syncPaused":
        "暗号化を開始できなかったため、他のユーザーから届く暗号化キーを保持する目的で、このセッションの同期を停止しました。再読み込みして再試行してください。",
    "cryptoUnavailableBanner.dismissEncryptionWarning": "暗号化の警告を閉じる",
    "customPackSettings.add": "{singular} を追加",
    "customPackSettings.shortcode": "ショートコード",
    "customPackSettings.sticker": "ステッカー",
    "customPackSettings.remove": "{toLowerCase} を削除",
    "customPackSettings.image": "画像",
    "customPackSettings.chooseAtLeastOneUsage":
        "用途を1つ以上選択してください。",
    "customPackSettings.uploadFailed": "アップロードに失敗しました",
    "customPackSettings.failedToRemove": "{singular} の削除に失敗しました",
    "customPackSettings.failedToUpdateUsage": "用途の更新に失敗しました",
    "customPackSettings.noCustomImages": "カスタム画像はありません",
    "customPackSettings.noCustomEmojis": "カスタム絵文字はありません",
    "customPackSettings.noCustomStickers": "カスタムステッカーはありません",
    "debugEventItem.stateKey": "state_key",
    "debugEventItem.empty": "（空）",
    "debugEventItem.redacted": "削除済み",
    "debugEventItem.id": "id: {eventId}",
    "debugPanel.debugPanel": "デバッグパネル",
    "debugPanel.sync": "同期:",
    "debugPanel.refresh": "↻ 更新",
    "debugPanel.copied": "✓ コピーしました",
    "debugPanel.copy": "⧉ コピー",
    "debugPanel.unreadState": "未読状態",
    "debugPanel.unread": "未読:",
    "debugPanel.highlight": "ハイライト:",
    "debugPanel.userid": "userId:",
    "debugPanel.readuptoid": "readUpToId:",
    "debugPanel.readidxInTimeline": "タイムライン内の readIdx:",
    "debugPanel.noReceipt": "既読情報なし",
    "debugPanel.n1NotInWindow": "-1（ウィンドウ外！）",
    "debugPanel.events": "/ 全{totalEvents}件のイベント",
    "debugPanel.lastEventSender": "最後のイベント送信者:",
    "debugPanel.me": "（自分:",
    "debugPanel.notificationEventsAfterReadMarker":
        "既読マーカー以降の通知イベント:",
    "debugPanel.from": "[{formatTs}] {value} からの {getType} - {msgPreview}",
    "debugPanel.pushRules": "プッシュルール",
    "debugPanel.default": "（デフォルト）",
    "debugPanel.actions": "アクション: {stringify}",
    "debugPanel.conditions": "条件: {stringify}",
    "debugPanel.noPushRulesFound": "プッシュルールが見つかりません",
    "debugPanel.readReceiptsEventsWithReceipts":
        "既読情報（既読のある{length}件のイベント）",
    "debugPanel.noReceipts": "既読情報なし",
    "debugPanel.urlPreviewInspector": "URLプレビューインスペクタ",
    "debugPanel.https": "https://...",
    "debugPanel.storeMessagesWhatTheUiRenders":
        "ストアのメッセージ（{length}件） - UIが描画する内容",
    "debugPanel.redacted": "削除済み",
    "debugPanel.rel": "rel={relType}",
    "debugPanel.empty": "空",
    "debugPanel.pendingEvents": "保留中のイベント（{length}件）",
    "debugPanel.rawTimelineEvents": "生のタイムライン（{length}件のイベント）",
    "gpuDebug.title": "GPU",
    "gpuDebug.hardwareAcceleration": "ハードウェアアクセラレーション",
    "gpuDebug.hardwareAccelerationHint":
        "動画が黒く表示されたり、ウィンドウの描画が崩れたりする場合はオフにしてください。再起動後に適用されます。",
    "gpuDebug.nvidiaVideo": "NVIDIA ビデオデコード",
    "gpuDebug.nvidiaVideoHint":
        "Chromium の Vulkan レンダラー経由で NVIDIA GPU 上の動画をデコードします。「自動」は NVIDIA GPU が画面を駆動している場合に有効になります。Wayland では Vulkan が使われないため「自動」ではオフのままです。そこで Vulkan を選ぶと、代わりに OpenGL 経由でハードウェアデコードを試みます（実験的）。",
    "gpuDebug.nvidiaVideoActive": "現在使用中です。",
    "gpuDebug.nvidiaVideoInactive": "現在は使用していません。",
    "gpuDebug.nvidiaVideoFailed":
        "GPUプロセスがクラッシュしたため、Zam は GL 経路に戻りました。再試行するには Vulkan を選んでください。",
    "gpuDebug.nvidiaVideoAuto": "自動",
    "gpuDebug.nvidiaVideoVulkan": "Vulkan",
    "gpuDebug.nvidiaVideoOff": "オフ",
    "gpuDebug.restartToApply":
        "この変更を適用するには Zam を再起動してください。",
    "gpuDebug.restart": "再起動",
    "gpuDebug.videoDecoding": "ビデオデコード",
    "gpuDebug.decodeHardware": "ハードウェア",
    "gpuDebug.decodeSoftware": "ソフトウェア",
    "gpuDebug.decodeUnsupported": "非対応",
    "gpuDebug.videoEncode": "ハードウェアビデオエンコード",
    "gpuDebug.videoEncodeHint":
        "ドライバが対応するコーデックについて、カメラと画面共有を GPU（VA-API）でエンコードします。他の人に自分の映像が黒い、止まる、乱れて見える場合はオフにしてください。再起動後に適用されます。",
    "gpuDebug.videoEncoding": "ビデオエンコード",
    "gpuDebug.videoEncodingHint":
        "通話では「音声とビデオ」で選んだコーデックを送信します（既定は H.264）。通話統計パネルで、通話が使用しているエンコーダを確認できます。",
    "gpuDebug.encodeTest": "H.264 エンコードテストを実行",
    "gpuDebug.encodeTestHint":
        "通話と同じ方法で、サイズごとに60フレームをエンコードします。ハードウェアは1フレームあたりソフトウェアより大幅に速いはずです。",
    "gpuDebug.encodeTestRejected": "エンコーダに拒否されました",
    "gpuDebug.encodeTestResult": "{chunks}チャンク、1フレームあたり{ms}ms",
    "gpuDebug.skiaGraphite": "Skia Graphite レンダラー（実験的）",
    "gpuDebug.skiaGraphiteHint":
        "Ganesh の代わりに Chromium の新しい Graphite レンダラーでインターフェースを描画します。描画を試すにはオンに、ウィンドウがちらつく、崩れる場合はオフにしてください。ハードウェアアクセラレーションが必要です。再起動後に適用されます。",
    "gpuDebug.skiaGraphiteFailed":
        "起動に失敗したか GPU プロセスがクラッシュしたため、自動的にオフになりました。再試行するにはもう一度オンにしてください。",
    "gpuDebug.nvidiaEncode": "NVIDIA ビデオエンコード（実験的）",
    "gpuDebug.nvidiaEncodeHint":
        "H.264 の通話と画面共有を、Zam 独自の VA-API ドライバ経由で NVENC によりエンコードします。ビデオデコードは上記の設定のままです。再起動後に適用されます。",
    "gpuDebug.featureStatus": "機能の状態",
    "gpuDebug.details": "詳細",
    "settingsNav.keybinds": "キー割り当て",
    "settingsSearch.keyboardShortcuts": "キーボードショートカット",
    "keybinds.intro":
        "ショートカットをクリックしてから新しいキーを押すと変更できます。ショートカットは Zam がアクティブなときだけ動作します。プッシュトゥトークとプッシュトゥミュートには、マウスのサイドボタンや単独の修飾キーも使えます。",
    "keybinds.resetAll": "すべてリセット",
    "keybinds.removedFrom": "次のキーは取り除かれました: {actions}",
    "keybinds.changeFor": "{action} のショートカットを変更",
    "keybinds.pressKey": "キーを押してください…（Esc でキャンセル）",
    "keybinds.pressKeyOrButton":
        "キーまたはマウスボタンを押してください…（Esc でキャンセル）",
    "keybinds.notSet": "未設定",
    "keybinds.clear": "ショートカットを削除",
    "keybinds.clearFor": "{action} のショートカットを削除",
    "keybinds.reset": "既定に戻す",
    "keybinds.resetFor": "{action} を既定に戻す",
    "keybinds.pushToTalkHint":
        "キーを設定するとプッシュトゥトークがオンになります。通話中は押している間だけマイクが送信します。",
    "keybinds.pushToMuteHint": "押している間はマイクがミュートされます。",
    "keybinds.globalVoice": "Zam がアクティブでなくても有効",
    "keybinds.globalVoiceHint":
        "プッシュトゥトーク、プッシュトゥミュート、ミュート切り替え、スピーカーミュート切り替えは、他のアプリを使用中でも動作します。Zam はこれらに割り当てたキーだけを監視し、他のアプリがそのキーを受け取れなくなることはありません。",
    "keybinds.globalWayland":
        "ここでは利用できません。この Wayland デスクトップはアプリにグローバルショートカット（GlobalShortcuts ポータル）を提供していないため、音声ショートカットは Zam がアクティブなときだけ動作します。",
    "keybinds.globalPermission":
        "先に macOS の許可が必要です。システム設定 > プライバシーとセキュリティ > アクセシビリティ で Zam をオンにしてから、Zam に戻ってください。",
    "keybinds.globalOpenSettings": "システム設定を開く",
    "keybinds.globalError":
        "他のアプリ使用中のキー監視を開始できませんでした（{error}）。音声ショートカットは Zam がアクティブなときだけ動作します。",
    "keybinds.globalPortalHint":
        "プッシュトゥトーク、プッシュトゥミュート、ミュート切り替え、スピーカーミュート切り替えは、他のアプリを使用中でも動作します。Wayland ではデスクトップがこれらのショートカットを Zam のために実行します。確認を求められたり、別のキーを選ぶよう求められたりすることがあり、他のアプリはそのキーを受け取れなくなります。",
    "keybinds.globalPortalAssigned": "デスクトップが割り当てたキー:",
    "keybinds.globalPortalMouse":
        "マウスボタンはデスクトップのショートカットにできません。デスクトップの設定でキーを割り当ててください。",
    "keybinds.globalPortalConfigure": "システム設定で変更",
    "keybinds.globalPortalError":
        "デスクトップがショートカットを設定しませんでした（{error}）。オフにしてからもう一度オンにすると再試行します。",
    "keybinds.helpTitle": "キーボードショートカット",
    "keybinds.customize": "カスタマイズ",
    "keybinds.category.navigation": "ナビゲーション",
    "keybinds.category.chat": "チャット",
    "keybinds.category.voice": "音声と通話",
    "keybinds.category.app": "アプリ",
    "keybinds.action.quickSwitcher": "クイック切り替え",
    "keybinds.action.prevChannel": "前のチャンネル",
    "keybinds.action.nextChannel": "次のチャンネル",
    "keybinds.action.prevUnreadChannel": "前の未読チャンネル",
    "keybinds.action.nextUnreadChannel": "次の未読チャンネル",
    "keybinds.action.prevMentionChannel": "メンションのある前のチャンネル",
    "keybinds.action.nextMentionChannel": "メンションのある次のチャンネル",
    "keybinds.action.prevServer": "前のスペース",
    "keybinds.action.nextServer": "次のスペース",
    "keybinds.action.navigateBack": "戻る",
    "keybinds.action.navigateForward": "進む",
    "keybinds.action.previousTextChannel": "前のチャンネルに戻る",
    "keybinds.action.returnToCall": "通話に戻る",
    "keybinds.action.markChannelRead": "チャンネルを既読にする",
    "keybinds.action.markServerRead": "スペースを既読にする",
    "keybinds.action.jumpToOldestUnread": "最も古い未読メッセージに移動",
    "keybinds.action.emojiPicker": "絵文字ピッカー",
    "keybinds.action.gifPicker": "GIFピッカー",
    "keybinds.action.stickerPicker": "ステッカーピッカー",
    "keybinds.action.uploadFile": "ファイルをアップロード",
    "keybinds.action.search": "検索",
    "keybinds.action.togglePins": "ピン留めしたメッセージ",
    "keybinds.action.toggleInbox": "通知の受信トレイ",
    "keybinds.action.toggleMembers": "メンバーリスト",
    "keybinds.action.toggleMute": "ミュートを切り替え",
    "keybinds.action.toggleDeafen": "スピーカーミュートを切り替え",
    "keybinds.action.pushToTalk": "プッシュトゥトーク",
    "keybinds.action.pushToMute": "プッシュトゥミュート",
    "keybinds.action.answerCall": "着信に応答",
    "keybinds.action.declineCall": "着信を拒否",
    "keybinds.action.startCall": "このルームで通話を開始または参加",
    "keybinds.action.toggleCamera": "カメラを切り替え",
    "keybinds.action.toggleScreenShare": "画面共有を切り替え",
    "keybinds.action.leaveCall": "通話から退出",
    "keybinds.action.openSettings": "設定を開く",
    "keybinds.action.createDm": "新しいダイレクトメッセージ",
    "draftDm.intro": "これは {name} とのダイレクトメッセージの始まりです。",
    "draftDm.lazyNote":
        "最初のメッセージを送信するまで何も作成されません。その時点で {name} が招待されます。",
    "draftDm.placeholder": "{name} にメッセージ",
    "draftDm.send": "送信",
    "draftDm.starting": "会話を開始しています…",
    "draftDm.encrypted": "エンドツーエンド暗号化されます",
    "draftDm.discard": "下書きを破棄",
    "draftDm.couldNotStart": "会話を開始できませんでした",
    "keybinds.action.createOrJoinSpace": "スペースを作成または参加",
    "keybinds.action.shortcutsHelp": "キーボードショートカットを表示",
    "keybinds.action.toggleDebug": "デバッグパネルを切り替え",
    "quickSwitcher.title": "どこへ移動しますか？",
    "quickSwitcher.placeholder": "ルーム、ダイレクトメッセージ、スペースを検索",
    "quickSwitcher.recentAndUnread": "最近と未読",
    "quickSwitcher.noResults": "一致なし",
    "quickSwitcher.mentioned": "メンションあり",
    "quickSwitcher.space": "スペース",
    "quickSwitcher.home": "ホーム",
    "quickSwitcher.hint": "↑↓ で移動、Enter で開く、Esc で閉じる",
    "debugSettings.developer": "開発者",
    "debugSettings.showAllEvents": "すべてのイベントを表示",
    "debugSettings.displayEveryMatrixTimelineEventIn":
        "チャットログにすべての Matrix タイムラインイベントを表示します。",
    "debugSettings.ignoreCodecSupport": "報告されたコーデック対応を無視",
    "debugSettings.ignoreCodecSupportHint":
        "他のユーザーがデコードできないと言っていても、選択したコーデックを送信します。また、このデバイスが列挙するすべてのコーデック（壊れているとしてブロックされたものを含む）を受け入れます。テスト用（例: Linux での HEVC）です。",
    "debugSettings.h264ProfileFix": "GPU H.264 プロファイル修正",
    "debugSettings.h264ProfileFixHint":
        "サーバーが Constrained Baseline（Chromium ではソフトウェアでエンコードされる）を返しても、通話は GPU の H.264 エンコーダを使います。オフにすると、この修正なしで通話が使うエンコーダを確認できます。Windows デスクトップでは再起動後に Chromium フラグが変わります。",
    "debugSettings.voiceProcessing": "音声処理",
    "debugSettings.pauseGate": "ポーズゲート",
    "debugSettings.pauseGateHint":
        "ノイズ除去後に無音部分をさらに 20 dB 下げます。既定はオフです。小さい語頭が切れることがあります。",
    "debugSettings.noiseAttenuationLimit": "ノイズ除去の上限: {value} dB",
    "debugSettings.noiseAttenuationLimitHint":
        "ノイズフィルタ（DeepFilterNet3 または DPDFNet）が信号の各部分から取り除ける最大量です（既定 {value}）。100 は無制限です。",
    "debugSettings.syncStatus": "同期状態",
    "debugSettings.clientLogs": "クライアントログ",
    "debugSettings.clientLogsHint":
        "アプリ起動以降に記録されたすべての内容です（トークン、パスワード、キーは削除済み）。バグを報告する際に送ってください。",
    "debugSettings.copyLogs": "ログをコピー",
    "debugSettings.saveLogs": "ログを保存",
    "debugSettings.clientLogsCopyFailed": "ログをコピーできませんでした",
    "debugSettings.clientLogsSaveFailed": "ログを保存できませんでした",
    "debugSettings.webViewDebugging": "WebView デバッグ",
    "debugSettings.webViewDebuggingHint":
        "USB で接続したコンピュータから chrome://inspect でアプリを検査できるようにします。オフにするまで再起動しても有効なままです。",
    "debugSettings.syncLog": "同期ログ",
    "debugSettings.syncLogEmpty":
        "まだ記録はありません。再起動、失敗したリクエスト、タイムラインのリセットがここに表示されます。",
    "debugSettings.refresh": "更新",
    "debugSettings.copied": "コピーしました",
    "debugSettings.useSlidingSync": "スライディング同期を使用",
    "debugSettings.experimentalLoadsRoomsInAGrowing":
        "実験的。ルームを拡大していくウィンドウで読み込みます。適用するにはアプリを再読み込みします。",
    "debugSettings.pushStatus": "プッシュ状態",
    "debugSettings.lastError": "最後のエラー: {lastError}",
    "debugSettings.runDiagnostics": "診断を実行",
    "debugSettings.homeserverPushers": "ホームサーバーのプッシャー",
    "debugSettings.theHomeserverHasNoPushersRegistered":
        "このアカウントに登録されたプッシャーは、ホームサーバーにありません。",
    "debugSettings.aPusherMatchesTheConfiguredGateway":
        "設定されたゲートウェイ URL に一致するプッシャーがあります。",
    "debugSettings.noPusherMatchesTheConfiguredGateway":
        "設定されたゲートウェイ URL に一致するプッシャーはありません。",
    "debugSettings.appId": "app_id: {app_id}",
    "debugSettings.none": "（なし）",
    "debugSettings.url": "url: {value}",
    "debugSettings.pushkey": "pushkey: {pushkeyPreview}",
    "debugSettings.webPushPwa": "Web Push（PWA）",
    "debugSettings.missing": "（なし）",
    "debugSettings.vapidKey": "VAPID キー: {value}",
    "debugSettings.permission": "permission: {permission}",
    "debugSettings.subscription": "subscription: {value}",
    "debugSettings.notFound": "見つかりません",
    "debugSettings.homeserverPusher": "ホームサーバーのプッシャー: {value}",
    "debugSettings.error": "エラー: {error}",
    "debugSettings.gatewaySygnalFirebase": "ゲートウェイ（Sygnal / Firebase）",
    "debugSettings.gatewayReachable": "ゲートウェイに到達可能",
    "debugSettings.gatewayNotReachable": "ゲートウェイに到達できません",
    "debugSettings.nativeSessionPushEnrichment":
        "ネイティブセッション（プッシュ拡張）",
    "debugSettings.homeserver": "ホームサーバー: {value}",
    "debugSettings.user": "ユーザー: {value}",
    "debugSettings.device": "デバイス: {value}",
    "debugSettings.accessToken": "アクセストークン: {value}",
    "debugSettings.hideMessageText": "メッセージ本文を隠す: {value}",
    "debugSettings.notificationRulesServer": "通知ルール（サーバー）",
    "debugSettings.syncMode": "同期モード",
    "debugSettings.slidingSyncMsc4186": "スライディング同期（MSC4186）",
    "debugSettings.classicSyncV2": "クラシック /sync（v2）",
    "debugSettings.syncState": "同期状態",
    "debugSettings.fallback": "フォールバック",
    "debugSettings.slidingSyncEndpoint": "スライディング同期エンドポイント",
    "debugSettings.joinedRoomsLoaded": "読み込み済みの参加ルーム",
    "debugSettings.roomListWindow": "ルーム一覧のウィンドウ",
    "debugSettings.of": "全{total}件中{requested}件",
    "debugSettings.platform": "プラットフォーム",
    "debugSettings.nativeCapacitor": "ネイティブ（Capacitor）",
    "debugSettings.pushEnabledInBuild": "ビルドでプッシュ有効",
    "debugSettings.yes": "はい",
    "debugSettings.no": "いいえ",
    "debugSettings.hideUpdatePrompts": "アップデートの案内を隠す",
    "debugSettings.hideUpdatePromptsHint":
        "アップデートのバナーとトーストを停止します。アップデートの確認は継続され、自動更新がオンの場合は自動的にインストールされます。",
    "debugSettings.gatewayUrl": "ゲートウェイ URL",
    "debugSettings.appId2": "アプリ ID",
    "debugSettings.notificationPermission": "通知の権限",
    "debugSettings.fcmToken": "FCM トークン",
    "debugSettings.pushProvider": "プッシュプロバイダ",
    "debugSettings.unifiedPushDistributor": "UnifiedPush ディストリビュータ",
    "debugSettings.unifiedPushEndpoint": "UnifiedPush エンドポイント",
    "debugSettings.unifiedPushGateway": "UnifiedPush ゲートウェイ",
    "debugSettings.pusherRegisteredThisSession":
        "このセッションでプッシャーを登録",
    "debugSettings.failedToFetchPushersFromHomeserver":
        "ホームサーバーからプッシャーを取得できませんでした。",
    "debugSettings.set": "設定済み",
    "debugSettings.active": "有効",
    "debugSettings.allNotificationsMasterRule":
        "すべての通知（マスタールール）",
    "emojiPicker.searchEmoji": "絵文字を検索…",
    "emojiPicker.searchEmoji2": "絵文字を検索",
    "emojiPicker.myEmojis": "マイ絵文字",
    "emojiPicker.custom": "カスタム",
    "emojiPicker.standard": "標準",
    "emojiPicker.myEmojis2": "マイ絵文字",
    "errorToasts.dismiss": "閉じる",
    "extendedProfileDebug.extendedProfile": "拡張プロフィール",
    "extendedProfileDebug.fetchFromServer": "サーバーから取得",
    "extendedProfileDebug.thisServerDoesNotSupportExtended":
        "このサーバーは拡張プロフィールに対応していません。",
    "extendedProfileDebug.noneOrTheServerRefused":
        "なし、またはサーバーが拒否しました",
    "extendedProfileDebug.presenceGetPresenceStraightFromThe":
        "プレゼンス（GET /presence、サーバーから直接）: {value}",
    "extendedProfileDebug.notAdvertisedNoRestrictions": "告知なし（制限なし）",
    "extendedProfileDebug.serverRulesForFieldsMProfile":
        "フィールドのサーバールール（m.profile_fields）: {value}",
    "extendedProfileDebug.failedToFetchTheProfile":
        "プロフィールを取得できませんでした",
    "extendedProfileDebug.couldNotCopyToClipboard":
        "クリップボードにコピーできませんでした",
    "flashEmbed.suspend": "一時停止",
    "forwardMessageDialog.forwardMessage": "メッセージを転送",
    "forwardMessageDialog.searchRooms": "ルームを検索",
    "forwardMessageDialog.noJoinedRoomsFound": "参加中のルームが見つかりません",
    "forwardMessageDialog.forwarding": "転送中…",
    "forwardMessageDialog.forward": "転送",
    "forwardMessageDialog.failedToForwardMessage":
        "メッセージの転送に失敗しました",
    "generalSettings.desktop": "デスクトップ",
    "proxySettings.network": "ネットワーク",
    "proxySettings.proxy": "プロキシ",
    "proxySettings.modeSystem": "システム設定を使用",
    "proxySettings.modeDirect": "プロキシなし",
    "proxySettings.modeManual": "手動",
    "proxySettings.modePac": "自動構成（PAC）",
    "proxySettings.launchFlagsInUse": "使用中の起動フラグ:",
    "proxySettings.server": "プロキシサーバー",
    "proxySettings.serverHint":
        "socks5://、socks4://、http:// または https:// にホストとポートを続けて指定します。Tor は通常 socks5://127.0.0.1:9050 です。",
    "proxySettings.bypass": "プロキシを使用しない対象",
    "proxySettings.pacUrl": "PAC ファイルの URL",
    "proxySettings.calls": "通話",
    "proxySettings.callsDefault": "既定（UDP は直接、TCP はプロキシ経由）",
    "proxySettings.callsDirect": "通話サーバーに直接接続",
    "proxySettings.callsProxy": "プロキシ経由のみ",
    "proxySettings.callsDefaultHint":
        "プロキシ経由の UDP はないため、通話音声は通常は直接送られ、通話が TCP にフォールバックする必要があるときだけプロキシ経由になります。",
    "proxySettings.callsDirectHint":
        "通話全体がプロキシを経由しません。参加、通話サーバーへの接続、UDP または TCP 経由の音声と映像が対象です。それ以外は引き続きプロキシを使用します。通話サーバーにあなたの IP アドレスが見えます。",
    "proxySettings.callsProxyHint":
        "直接接続は行わず、通話サーバーに IP アドレスも見えません。通話はプロキシ経由で、通話サーバーの TURN リレーに TCP または TLS で送られます。サーバーが TURN リレーを提供しない場合、通話は接続できません。遅延が増える見込みです。",
    "proxySettings.callsDirectUnavailable":
        "通話はシステムのプロキシ設定を迂回できません。これを機能させるには、ここでプロキシ（手動または PAC）を設定してください。",
    "proxySettings.callsDirectAddresses": "直接送信:",
    "proxySettings.save": "保存",
    "proxySettings.saved": "保存しました",
    "proxySettings.applyFailed": "適用できませんでした: {error}",
    "generalSettings.minimiseToTrayOnClose": "閉じるときにトレイへ最小化",
    "generalSettings.keepZamRunningInTheSystem":
        "ウィンドウを閉じても終了せず、システムトレイで Zam を実行し続けます。トレイアイコンから再度開くか、終了できます。",
    "generalSettings.noGeneralSettingsAreAvailableOn":
        "このプラットフォームで利用できる一般設定はありません。",
    "gifPicker.searchFavourites": "お気に入りを検索…",
    "gifPicker.searchKlipy": "KLIPY を検索…",
    "gifPicker.searchFavourites2": "お気に入りを検索",
    "gifPicker.searchGifs": "GIF を検索",
    "gifPicker.gifResults": "GIF の検索結果",
    "gifPicker.noFavouriteGifsYetStarA":
        "お気に入りの GIF はまだありません。GIF にスターを付けるとここに保存されます。",
    "gifPicker.favourites": "お気に入り",
    "gifPicker.gifTagged": "{join} のタグが付いた GIF",
    "gifPicker.favouriteGif": "お気に入りの GIF {value}",
    "gifPicker.editTags": "タグを編集",
    "gifPicker.catFunny": "猫, 面白い",
    "gifPicker.commaSeparatedEnterToSave": "カンマ区切り · Enter で保存",
    "gifPicker.trending": "人気",
    "gifPicker.gifResult": "GIF の結果 {value}",
    "gifPicker.favourite": "お気に入り",
    "gifPicker.poweredByKlipy": "KLIPY 提供",
    "imagePackEditor.addImage": "画像を追加",
    "imagePackEditor.newPack": "新しいパック",
    "imagePackEditor.packName": "パック名",
    "imagePackEditor.shortcode": "ショートコード",
    "imagePackEditor.useAsEmoji": "絵文字として使用",
    "imagePackEditor.useAsSticker": "ステッカーとして使用",
    "imagePackEditor.inheritedFrom": "{sourceName} から継承",
    "imagePackEditor.sticker": "ステッカー",
    "imagePackEditor.removeImage": "画像を削除",
    "imagePackEditor.noCustomImages": "カスタム画像はありません",
    "imagePackEditor.emotes": "{value} 個のエモート",
    "imagePackEditor.room": "ルーム",
    "imagePackEditor.chooseAtLeastOneUsage": "用途を1つ以上選択してください。",
    "imagePackEditor.enterAPackName": "パック名を入力してください。",
    "imagePackEditor.uploadFailed": "アップロードに失敗しました",
    "imagePackEditor.failedToUpdateUsage": "用途の更新に失敗しました",
    "imagePackEditor.failedToRemoveImage": "画像の削除に失敗しました",
    "imagePackEditor.failedToUpdatePack": "パックの更新に失敗しました",
    "imagePackEditor.addToMine": "自分のパックに追加",
    "imagePackEditor.addAllToMyPack":
        "このパックのすべての画像を自分のパックにコピー",
    "imagePackEditor.addImageToMyPack": "この画像を自分のパックにコピー",
    "imagePackEditor.addedToYourPack":
        "{count, plural, other {#枚の画像をパックに追加しました。}}",
    "imagePackEditor.alreadyInYourPack": "すでにパックにあります。",
    "imagePackEditor.editDetails": "詳細を編集",
    "imagePackEditor.deletePack": "パックを削除",
    "imagePackEditor.confirmDeletePack":
        "パック「{name}」とそのすべての画像を削除しますか？",
    "imagePackEditor.useInAllRooms": "すべてのルームで使用",
    "imagePackEditor.useInAllRoomsHint":
        "絵文字とステッカーが、チャットするすべての場所に表示されます。",
    "imagePackEditor.attribution": "クレジット: {value}",
    "imagePackEditor.attributionPlaceholder": "クレジット / 出典（任意）",
    "imagePackEditor.uploadPackAvatar": "パックのアイコンをアップロード",
    "imagePackEditor.removePackAvatar": "アイコンを削除",
    "imagePackEditor.avatarReady":
        "アイコンをアップロードしました。保存して適用してください。",
    "sharedPackSettings.yourPackDetails": "パックの詳細",
    "sharedPackSettings.enabledEverywhere": "すべてのルームで有効なパック",
    "sharedPackSettings.enabledEverywhereHint":
        "参加中のルームのパックを、そのパックを所有するルームだけでなく、すべてのルームで使用できます。",
    "sharedPackSettings.availableInYourRooms": "ルーム内のパック",
    "sharedPackSettings.searchPacks": "パックを検索",
    "sharedPackSettings.noPacksFound": "パックが見つかりません",
    "sharedPackSettings.noneEnabled":
        "すべてのルームで有効なパックはありません",
    "sharedPackSettings.enable": "すべての場所で使用",
    "sharedPackSettings.disable": "すべての場所での使用を停止",
    "sharedPackSettings.remove": "削除",
    "sharedPackSettings.unavailable":
        "利用できません: {room} に参加していないか、パックが削除されました",
    "sharedPackSettings.packSummary":
        "{room}、{count, plural, other {#枚の画像}}",
    "sharedPackSettings.failedToSave": "保存に失敗しました",
    "inboxPanel.inbox": "受信トレイ",
    "inboxPanel.noPendingInvites": "保留中の招待はありません",
    "inboxPanel.roomInvitesWillAppearHere":
        "ルームへの招待がここに表示されます。",
    "inboxPanel.pendingInvites": "保留中の招待: {length}",
    "inboxPanel.invitedBy": "{sender} からの招待",
    "inboxPanel.ignore": "無視",
    "inboxPanel.accept": "承認",
    "inboxPanel.pendingJoinRequests": "保留中の参加リクエスト: {length}",
    "inboxPanel.youAskedToJoinWaitingFor":
        "参加をリクエストしました。承認を待っています。",
    "inboxPanel.cancelRequest": "リクエストをキャンセル",
    "inboxPanel.failedToAcceptInvite": "招待の承認に失敗しました",
    "inboxPanel.failedToRejectInvite": "招待の拒否に失敗しました",
    "inboxPanel.failedToCancelJoinRequest":
        "参加リクエストのキャンセルに失敗しました",
    "incomingCallCard.incomingCall": "着信",
    "incomingCallCard.declineCallFrom": "{name} からの通話を拒否",
    "incomingCallCard.accept": "応答",
    "incomingCallCard.acceptCallFrom": "{name} からの通話に応答",
    "incomingCallCard.unknown": "不明",
    "invitePanel.invitePeopleTo": "メンバーを招待",
    "invitePanel.invited": "招待済み",
    "invitePanel.failed": "失敗しました",
    "invitePanel.inviteByEmail": "メールで招待",
    "invitePanel.nameExampleCom": "name@example.com",
    "invitePanel.inviting": "招待中…",
    "invitePanel.invite": "招待",
    "invitePanel.invite2": "{length}人を招待",
    "invitePanel.enterAValidEmailAddress":
        "有効なメールアドレスを入力してください。",
    "invitePanel.couldNotSendTheEmailInvite":
        "メール招待を送信できませんでした",
    "invitePanel.couldNotSendTheInvite": "招待を送信できませんでした",
    "invitePanel.thisRoom": "このルーム",
    "invitePanel.thisSpace": "このスペース",
    "joinConsentDialog.joinThisRoom": "このルームに参加しますか？",
    "joinConsentDialog.youClickedALinkTo": "次のリンクをクリックしました:",
    "joinConsentDialog.joiningSharesYourMatrixIdWith":
        "。参加すると Matrix ID がルーム内の全員に共有され、ルーム一覧に追加されます。",
    "joinConsentDialog.thisOpensRoom": "開くルーム:",
    "joinConsentDialog.warningThisLinkPointsAtA":
        "警告: このリンクは、解決先のルームとは異なるサーバーを指しています。送信者を信頼できる場合のみ続行してください。",
    "joinConsentDialog.joinRoom": "ルームに参加",
    "lightbox.closeViewer": "{mediaNoun}ビューアを閉じる",
    "lightbox.viewer": "{MediaNoun}ビューア{value}",
    "lightbox.download": "ダウンロード",
    "lightbox.previous": "前へ",
    "lightbox.previous2": "前の{mediaNoun}",
    "lightbox.next": "次へ",
    "lightbox.next2": "次の{mediaNoun}",
    "lightbox.couldNotLoadThisVideoUse":
        "この動画を読み込めませんでした。代わりに「ダウンロード」で保存してください。",
    "lightbox.video": "動画",
    "lightbox.image": "画像",
    "lightbox.videoNoun": "動画",
    "lightbox.imageNoun": "画像",
    "linkPreview.youtubeVideo": "YouTube 動画",
    "linkPreview.xTwitter": "X / Twitter",
    "linkPreview.loadingItContactsTheSiteHosting":
        "読み込むと配信元のサイトに接続するため、あなたの IP アドレスが伝わります",
    "linkPreview.loadPreviewMedia": "プレビューを読み込む",
    "linkPreview.playVideo": "動画を再生",
    "liveLocationBanner.openMap": "地図を開く",
    "liveLocationBanner.sharingLiveLocation": "現在地を共有中",
    "liveLocationBanner.lastUpdatedAt":
        " · 最終更新 {timeOnly}（{updatedAgoLabel}）",
    "liveLocationBanner.map": "地図",
    "liveLocationBanner.isSharingLiveLocation":
        "{getMemberName} が現在地を共有中",
    "liveLocationBanner.peopleSharingLiveLocation":
        "{length}人が位置情報を共有中",
    "liveLocationBanner.viewMap": "地図を表示",
    "liveLocationMapView.back": "戻る",
    "liveLocationMapView.liveLocation": "位置情報の共有",
    "liveLocationMapView.recenter": "中心に戻す",
    "liveLocationMapView.waitingForALocationFix": "位置情報を取得しています…",
    "liveLocationMapView.sharingLiveLocation": "位置情報を共有中",
    "liveLocationMapView.lastUpdatedAt":
        "{timeOnly}に更新（{updatedAgoLabel}）",
    "liveLocationMapView.osm": "OSM",
    "liveLocationMapView.noActiveLiveSharesInThis":
        "このルームで共有中の位置情報はありません。",
    "liveLocationMapView.you": "あなた",
    "locationBody.openstreetmap": "OpenStreetMap",
    "locationBody.googleMaps": "Google Maps",
    "loginView.signIn": "サインイン",
    "loginView.register": "登録",
    "loginView.zam": "Zam - {value}",
    "loginView.addAnAccount": "アカウントを追加",
    "loginView.welcomeBack": "おかえりなさい！",
    "loginView.signInWithAnotherMatrixAccount":
        "別のMatrixアカウントでサインイン",
    "loginView.signInToYourMatrixAccount": "Matrixアカウントにサインイン",
    "loginView.createAnAccount": "アカウントを作成",
    "loginView.registerOnAMatrixHomeserver": "Matrixホームサーバーで登録",
    "loginView.homeserver": "ホームサーバー",
    "loginView.username": "ユーザー名",
    "loginView.password": "パスワード",
    "loginView.registrationToken": "登録トークン",
    "loginView.ifRequired": "（必要な場合）",
    "loginView.leaveBlankIfNotRequired": "不要な場合は空欄のままにしてください",
    "loginView.useSlidingSync": "スライディングシンクを使用",
    "loginView.fasterStartupOnServersThatSupport":
        "対応サーバーでは起動が速くなります。",
    "loginView.pleaseWait": "しばらくお待ちください…",
    "loginView.logIn": "ログイン",
    "loginView.createAccount": "アカウント作成",
    "loginView.donTHaveAnAccount": "アカウントをお持ちでないですか？",
    "loginView.alreadyHaveAnAccount": "すでにアカウントをお持ちですか？",
    "loginView.signIn2": "サインイン",
    "loginView.backTo": "← {activeUserId}に戻る",
    "loginView.orContinueAs": "または次で続行",
    "loginView.yourCredentialsAreSentDirectlyTo":
        "認証情報はホームサーバーに直接送信され、このアプリが端末外に保存することはありません。",
    "loginView.loggingIn": "ログインしています…",
    "loginView.loginFailedCheckYourCredentials":
        "ログインに失敗しました。認証情報を確認してください。",
    "loginView.creatingAccount": "アカウントを作成しています…",
    "loginView.registrationFailed": "登録に失敗しました。",
    "loginView.or": "または",
    "loginView.continueWithSso": "SSOで続行",
    "loginView.continueWith": "{name}で続行",
    "loginView.redirectingToSso": "サインイン先へリダイレクトしています…",
    "loginView.finishSsoInBrowser":
        "ブラウザでサインインを完了してから、ここに戻ってください。",
    "loginView.ssoCouldNotBeVerified":
        "シングルサインオンを検証できませんでした。もう一度お試しください。",
    "loginView.ssoFailed": "シングルサインオンに失敗しました。",
    "loginView.continue": "続行",
    "loginView.signInOnProviderPage":
        "ホームサーバーのページでサインインし、そのあとここに戻ります。",
    "loginView.oauthCancelled": "サインインはキャンセルされました。",
    "loginView.oauthDenied": "サインイン先がリクエストを拒否しました: {reason}",
    "loginView.oauthCouldNotBeVerified":
        "サインインを検証できませんでした。もう一度お試しください。",
    "loginView.oauthFailed":
        "サインインに失敗しました。もう一度お試しください。",
    "loginView.oauthRegistrationRefused":
        "このサーバーはZamのサインイン用登録を許可しませんでした。",
    "loginView.oauthRegistrationRefusedFallback":
        "このサーバーはZamのサインイン用登録を許可しませんでした。下のいずれかの方法をお使いください。",
    "loginView.checkingServer": "サーバーを確認しています…",
    "loginView.homeserverHint":
        "アカウントのあるサーバーです。@you:server のコロンより後ろの部分です。",
    "loginView.homeserverHintRegister":
        "アカウントはこのサーバー上に作られます。迷ったら matrix.org が無料で誰でも使えます。",
    "loginView.oauthLoginExplainer":
        "{server}のアカウントページでサインインします。Zamがそのページを開き、サインイン済みのままここに戻ります。",
    "loginView.oauthRegisterExplainer":
        "{server}のアカウントページで新しいアカウントを作成します。Zamがそのページを開くので、そこでユーザー名とパスワードを決めてください。サインイン済みのままここに戻ります。",
    "loginView.continueTo": "{host}に進む",
    "loginView.createAccountOn": "{server}でアカウントを作成",
    "loginView.advancedOptions": "詳細オプション",
    "encryptionSetup.setupTitle": "メッセージを保護",
    "encryptionSetup.setupBody":
        "プライベートなチャットはエンドツーエンド暗号化されています。リカバリーを設定しておくと、この端末を失っても、あとでサインインしたどの端末でも読めます。数秒で終わります。",
    "encryptionSetup.passwordBody":
        "本人確認のため、アカウントのパスワードを入力してください。",
    "encryptionSetup.setUp": "リカバリーを設定",
    "encryptionSetup.later": "あとで",
    "encryptionSetup.saveKeyTitle": "リカバリーキーを保存",
    "encryptionSetup.saveKeyBody":
        "このキーは新しい端末で暗号化メッセージを解錠するためのものです。表示されるのは一度だけです。パスワードマネージャーに保存するか、ダウンロードしてください。失うと、端末を紛失したときにメッセージを失う可能性があります。",
    "encryptionSetup.downloadKey": "ダウンロード",
    "encryptionSetup.keyFileHeader": "{userId}のZamリカバリーキー",
    "encryptionSetup.doneTitle": "設定が完了しました",
    "encryptionSetup.doneBody":
        "この端末で暗号化が設定されました。メッセージと、他の端末の履歴がここで利用できます。",
    "encryptionSetup.confirmTitle": "本人確認",
    "encryptionSetup.confirmBody":
        "このアカウントはすでに暗号化を使用しています。新しい端末を承認すると、暗号化メッセージと履歴を読めるようになります。",
    "encryptionSetup.useAnotherDevice": "別の端末を使用",
    "encryptionSetup.useRecoveryKey": "リカバリーキーを使用",
    "encryptionSetup.anotherDeviceHint":
        "別の端末とは、すでにサインイン済みの端末（スマートフォンのZamやElementアプリなど）です。承認リクエストが表示されます。",
    "encryptionSetup.recoveryKeyHint":
        "リカバリーキーは「EsT」で始まります。暗号化を最初に設定したときに保存したものです。",
    "encryptionSetup.cantConfirm": "リカバリーキーも他の端末も失いましたか？",
    "encryptionSetup.enterKeyTitle": "リカバリーキーを入力",
    "encryptionSetup.enterKeyBody":
        "暗号化の設定時に保存したリカバリーキーを貼り付けてください。スペースは無視されます。",
    "encryptionSetup.enterPassphraseBody":
        "暗号化の設定時に決めたリカバリーパスフレーズを入力してください。",
    "encryptionSetup.back": "戻る",
    "encryptionSetup.connectBackupTitle": "メッセージ履歴を復元",
    "encryptionSetup.connectBackupBody":
        "この端末は検証済みですが、暗号化メッセージのバックアップにまだ接続していません。リカバリーキーを入力して履歴を復元してください。",
    "encryptionSetup.checking": "暗号化を確認しています…",
    "encryptionSetup.tryAgain": "再試行",
    "encryptionSetup.openSecuritySettings": "セキュリティ設定を開く",
    "registration.cancelled": "アカウント作成はキャンセルされました。",
    "registration.noSupportedFlow":
        "このサーバーはZamが完了できない登録手順を要求しています。サーバーのWebサイトでアカウントを作成してみてください。",
    "registration.stageKeptFailing":
        "サーバーが登録手順を繰り返し拒否しました。もう一度お試しください。",
    "registration.userInUse":
        "そのユーザー名は使われています。別の名前をお試しください。",
    "registration.invalidUsername":
        "そのユーザー名は使用できません。小文字、数字、. _ = - / を使ってください。",
    "registration.exclusiveUsername":
        "そのユーザー名はこのサーバーで予約されています。別の名前をお試しください。",
    "registration.weakPassword":
        "パスワードが弱すぎます。より長いものにしてください。",
    "registration.weakPasswordReason": "パスワードが弱すぎます: {reason}",
    "registration.emailInUse":
        "そのメールアドレスは別のアカウントで使用されています。",
    "registration.emailNotAllowed":
        "このサーバーはそのメールアドレスを受け付けません。",
    "registration.rateLimited":
        "試行回数が多すぎます。1分待ってから再度お試しください。",
    "registration.stepNotAccepted":
        "サーバーがその手順を受け付けませんでした。もう一度お試しください。",
    "registration.closed": "このサーバーは新規アカウントを受け付けていません。",
    "registration.invalidToken":
        "その登録トークンは無効です。確認して再度お試しください。",
    "registration.refused": "サーバーがアカウント作成を拒否しました。",
    "registration.refusedReason":
        "サーバーがアカウント作成を拒否しました: {reason}",
    "registration.serverUnreachable":
        "サーバーに接続できませんでした。アドレスと接続を確認してください。",
    "registration.usernameLowercase": "ユーザー名は小文字で入力してください。",
    "registration.usernameCharacters":
        "小文字、数字、. _ = - / のみ使用できます。",
    "registration.usernameHint":
        "ユーザー名を決めてください。この名前で見つけてもらえます。",
    "registration.usernameAvailable": "{userId} は使用できます",
    "registration.yourAddressWillBe": "あなたのアドレスは {userId} になります",
    "registration.confirmPassword": "パスワードの確認",
    "registration.passwordsDontMatch": "パスワードが一致しません。",
    "registration.closedOnServer":
        "{server}は現在、新規アカウントを受け付けていません。別のサーバーを選んで作成してください。",
    "registration.useOtherServer": "代わりに{server}でアカウントを作成",
    "registration.tokenTitle": "登録トークン",
    "registration.tokenBody":
        "{server}は招待制です。サーバー管理者から渡された登録トークンを入力してください。",
    "registration.termsTitle": "サーバーの規約に同意",
    "registration.termsBody":
        "{server}では、アカウント作成前に以下への同意が必要です:",
    "registration.termsAccept": "これらの規約を読み、同意します",
    "registration.emailTitle": "メールアドレスを確認",
    "registration.emailBody":
        "{server}ではアカウント作成にメールアドレスが必要です。確認用のリンクをお送りします。",
    "registration.emailPlaceholder": "you@example.com",
    "registration.sendEmail": "メールを送信",
    "registration.emailSent":
        "{email}にリンクを送信しました。リンクを開いてから、ここに戻って「続行」を押してください。",
    "registration.emailNotConfirmed":
        "メールアドレスがまだ確認されていません。メール内のリンクを開いてから「続行」を押してください。",
    "registration.emailConfirmed": "続行",
    "registration.captchaTitle": "ロボットでないことを確認",
    "registration.captchaBody":
        "{server}ではcaptchaの解答が必要です。サーバーのページで開きます。終わったらここに戻ってください。",
    "registration.fallbackTitle": "あと1ステップ",
    "registration.fallbackBody":
        "{server}のページで最後の手順を完了する必要があります。終わったらここに戻ってください。",
    "registration.openStepPage": "ページを開く",
    "registration.stepDone": "完了しました",
    "memberList.members": "メンバー: {length}",
    "memberList.admins": "管理者: {length}",
    "memberList.admin": "管理者",
    "memberList.moderators": "モデレーター: {length}",
    "messageActionsSheet.thisMessage": "このメッセージを{label}しますか？",
    "messageActionsSheet.messageActions": "メッセージ操作",
    "messageArea.dropToAttach": "ドロップして添付",
    "messageArea.cachedRoomTitle": "オフラインです",
    "messageArea.cachedRoomHint":
        "この端末に保存されたメッセージを表示しています。接続が戻ると送信できます。",
    "messageArea.unreadNotifications": "未読の通知",
    "messageArea.encryptionEnabled": "暗号化が有効",
    "messageArea.joiningVoiceCall": "音声通話に参加しています…",
    "messageArea.startVoiceCall": "音声通話を開始",
    "messageArea.showCall": "通話画面を開く",
    "messageArea.searchMessages": "メッセージを検索",
    "messageArea.threads": "スレッド",
    "messageArea.toggleThreadsList": "スレッド一覧の表示切替",
    "messageArea.unreadThreadMentions": "スレッドでの未読メンション",
    "messageArea.unreadThreads": "未読スレッド",
    "messageArea.pinnedMessages": "ピン留めしたメッセージ",
    "messageArea.notificationsInbox": "通知の受信箱",
    "messageArea.mediaAndFiles": "メディアとファイル",
    "messageArea.toggleMemberList": "メンバー一覧の表示切替",
    "messageArea.more": "その他",
    "messageArea.moreRoomOptions": "その他のルームオプション",
    "messageArea.messageTimeline": "メッセージタイムライン",
    "messageArea.welcomeTo": "ようこそ #",
    "messageArea.thisIsTheBeginningOfThe": "ここが #",
    "messageArea.room": "ルームの始まりです。",
    "messageArea.newMessages": "新着メッセージ",
    "messageArea.messageFromABlockedUser":
        "ブロックしたユーザーからのメッセージ",
    "messageArea.showBlockedMessage": "ブロックしたメッセージを表示",
    "messageArea.thisRoomHasBeenUpgraded":
        "このルームはアップグレードされました",
    "messageArea.goToNewRoom": "新しいルームへ移動",
    "messageArea.joinNewRoom": "新しいルームに参加",
    "messageArea.jumpToPresent": "最新へ移動",
    "messageArea.searchingForMessage": "メッセージを検索しています…",
    "messageArea.viewingMessageContext": "メッセージの前後を表示中",
    "messageArea.returnToLive": "最新に戻る",
    "messageArea.closePanel": "パネルを閉じる",
    "messageArea.someone": "誰か",
    "messageArea.pinnedMessagesCount": "ピン留めしたメッセージ（{count}）",
    "messageInput.replyingTo": "{replyTargetName}に返信",
    "messageInput.cancelReplyEsc": "返信をキャンセル（Esc）",
    "messageInput.editAttachment": "添付ファイルを編集",
    "messageInput.editAttachment2": "添付ファイル{name}を編集",
    "messageInput.custom": "カスタム",
    "messageInput.yourEmotes": "あなたのエモート",
    "messageInput.yourNextMessageWillStartA": "次のメッセージは",
    "messageInput.thread": "スレッド",
    "messageInput.cancelThreadCreation": "スレッド作成をキャンセル",
    "messageInput.favouriteGifs": "お気に入りのGIF",
    "messageInput.sendMessage": "メッセージを送信",
    "messageInput.isTyping": "{value}が入力中…",
    "messageInput.andAreTyping": "{value}と{value2}が入力中…",
    "messageInput.andAreTyping2": "{value}、{value2}、{value3}が入力中…",
    "messageInput.severalPeopleAreTyping": "複数の人が入力中…",
    "messageInput.noPermissionToSend":
        "ここでメッセージを送信する権限がありません",
    "messageInput.selectARoomToStartChatting": "ルームを選んでチャットを開始",
    "messageInput.replyInThread": "スレッドで返信...",
    "messageInput.replyTo": "{replyTargetName}に返信...",
    "messageInput.message": "メッセージ #{roomName}",
    "messageInput.isNotAValidUser": "「{token}」は有効なユーザーではありません",
    "messageInput.noRoomSelected": "ルームが選択されていません",
    "messageInput.isNotInThisRoom": "{userId}はこのルームにいません",
    "messageInput.youDonTHavePermissionTo":
        "このルームの権限レベルを変更する権限がありません",
    "messageInput.unhandledCommand": "未対応のコマンド: /{name}",
    "messageInput.commandFailed": "コマンドに失敗しました",
    "messageInput.failedToSend": "送信に失敗しました",
    "messageInput.unknownCommand": "不明なコマンド: /{unknown}",
    "messageInput.sedNoMessage": "ここで編集できるメッセージがありません",
    "messageInput.sedNoMatch":
        "「{pattern}」は直前のメッセージに含まれていません",
    "messageInput.sedEmpty": "直前のメッセージが空になってしまいます",
    "messageInput.sedFailed": "直前のメッセージを編集できませんでした",
    "messageInput.sendingAttachments":
        "{count, plural, other {#件の添付ファイルを送信中…}}",
    "messageItem.viewProfile": "プロフィールを表示",
    "messageItem.jumpToTheRepliedToMessage": "返信元のメッセージへ移動:",
    "messageItem.originalMessageNotLoaded":
        "元のメッセージが読み込まれていません",
    "messageItem.originalMessageDeleted": "元のメッセージは削除されました",
    "messageItem.originalMessageUnavailable": "元のメッセージは利用できません",
    "messageItem.replyPreviewSticker": "ステッカー",
    "messageItem.replyPreviewPoll": "投票",
    "messageItem.replyPreviewImage": "画像",
    "messageItem.replyPreviewVideo": "動画",
    "messageItem.replyPreviewAudio": "音声",
    "messageItem.replyPreviewFile": "ファイル",
    "messageItem.edited": "（編集済み）",
    "messageItem.decryptingImage": "画像を復号しています...",
    "messageItem.couldnTDecryptImage": "画像を復号できませんでした",
    "messageItem.imageUnavailable": "[画像は利用できません]",
    "messageItem.decryptingVideo": "動画を復号しています...",
    "messageItem.couldnTDecryptVideo": "動画を復号できませんでした",
    "messageItem.video": "動画",
    "messageItem.canTBePlayedHere": "ここでは再生できません",
    "messageItem.playbackFailedClickToRetry":
        "再生に失敗しました · クリックで再試行",
    "messageItem.clickToPlay": "{videoDuration} · クリックで再生",
    "messageItem.clickToPlay2": "クリックで再生",
    "messageItem.audio": "音声",
    "messageItem.kb": "{toFixed} KB",
    "messageItem.mb": "{toFixed} MB",
    "mediaProgress.ofTotal": "{loaded} / {total}",
    "messageItem.fileAttachment": "添付ファイル",
    "messageItem.download": "ダウンロード",
    "messageItem.toSave": "で保存 ·",
    "messageItem.toCancel": "でキャンセル",
    "messageItem.openThread": "スレッドを開く",
    "messageItem.failedToSend": "送信に失敗しました。",
    "messageItem.retrying": "再試行しています…",
    "messageItem.showWhoReadThisMessage": "このメッセージを読んだ人を表示",
    "messageItem.readThis": "{count, plural, other {#人が読んでいます}}",
    "messageItem.readBy": "既読",
    "messageItem.messageActions": "メッセージ操作",
    "messageItem.editMessage": "メッセージを編集",
    "messageItem.delete": "削除しますか？",
    "messageItem.yesDeleteMessage": "はい、メッセージを削除",
    "messageItem.yes": "はい",
    "messageItem.noKeepMessage": "いいえ、メッセージを残す",
    "messageItem.no": "いいえ",
    "messageItem.deleteMessage": "メッセージを削除",
    "messageItem.unpinMessage": "ピン留めを解除",
    "messageItem.pinMessage": "ピン留め",
    "messageItem.addReaction": "リアクションを追加",
    "messageItem.reply": "返信",
    "messageItem.replyInThread": "スレッドで返信",
    "messageItem.forwardMessage": "メッセージを転送",
    "messageItem.moreActions": "その他の操作",
    "messageItem.linkCopied": "リンクをコピーしました！",
    "messageItem.copyMessageLink": "メッセージのリンクをコピー",
    "messageItem.linkCopied2": "リンクをコピーしました",
    "messageItem.couldnTDeleteTheMessage": "メッセージを削除できませんでした",
    "messageItem.couldnTCopyTheMessageLink":
        "メッセージのリンクをコピーできませんでした",
    "messageItem.failedToUnpinMessage": "ピン留めの解除に失敗しました",
    "messageItem.failedToPinMessage": "ピン留めに失敗しました",
    "messageItem.couldNotOpenTheMatrixLink": "Matrixのリンクを開けませんでした",
    "messageRedactAction.removeMessage": "メッセージを削除",
    "messageRedactAction.removeThisMessage": "このメッセージを削除しますか？",
    "messageRedactAction.removing": "削除しています…",
    "messageRedactAction.failedToRemoveMessage":
        "メッセージの削除に失敗しました",
    "messageReportAction.reportMessage": "メッセージを報告",
    "messageReportAction.reportSent": "報告を送信しました",
    "messageReportAction.whyAreYouReportingThisMessage":
        "このメッセージを報告する理由は何ですか？",
    "messageReportAction.markAsExtremelyOffensive": "極めて攻撃的としてマーク",
    "messageReportAction.reporting": "報告しています…",
    "messageReportAction.report": "報告",
    "messageSearchPanel.searchMessages": "メッセージを検索",
    "messageSearchPanel.searchTryFromOrHasImage":
        "検索 - from: や has:image も試せます",
    "messageSearchPanel.searchForMessagesInThisRoom":
        "このルームのメッセージを検索します。",
    "messageSearchPanel.noMatchesInTheResultsLoaded":
        "これまでに読み込んだ結果には一致がありません。",
    "messageSearchPanel.noResultsFor": "「{searched}」の結果はありません。",
    "messageSearchPanel.searchFailed": "検索に失敗しました",
    "messageSearchPanel.resultCount": "{count, plural, other {#件の結果}}",
    "messagesMediaSettings.messages": "メッセージ",
    "messagesMediaSettings.showMatrixIds": "Matrix IDを表示",
    "messagesMediaSettings.showFullMatrixIdsLikeUser":
        "アプリ全体で、表示名の代わりに @user:server のような完全なMatrix IDを表示します。",
    "messagesMediaSettings.readReceiptAvatars": "既読のアバター",
    "messagesMediaSettings.showWhoHasReadEachMessage":
        "各メッセージを読んだ人を、その下に小さなアバターで表示します。これはこの端末での表示だけを変えます。他の人に既読位置を見せたくない場合は、プライバシーと安全の「非公開の既読」を使ってください。",
    "messagesMediaSettings.holdToOpenMessageMenu":
        "長押しでメッセージメニューを開く",
    "messagesMediaSettings.onTouchDevicesOpenAMessage":
        "タッチ端末では、タップの代わりに長押しでメッセージの操作を開きます。オフにするとタップでメニューが開きます。",
    "messagesMediaSettings.linkPreviews": "リンクプレビュー",
    "messagesMediaSettings.whenOffNoLinkPreviewIs":
        "オフのときはリンクプレビューを読み込まず、ホームサーバーが代わりにリンク先を取得することもありません。プレビューのメディアをどこから読み込むかはプライバシーと安全で設定できます。",
    "messagesMediaSettings.pauseVideosOffScreen": "画面外の動画を一時停止",
    "messagesMediaSettings.pauseAPlayingVideoWhenIt":
        "再生中の動画が画面外にスクロールしたら一時停止してバッテリーを節約します。戻ったときにご自身で再開してください。",
    "messagesMediaSettings.sendVideosThatStreamFaster":
        "より速くストリーミングできる動画を送信",
    "messagesMediaSettings.rearrangeMp4VideosYouSend":
        "送信するMP4動画を並べ替えて、ダウンロード中に再生を始められるようにします。再エンコードは行わず、画質も変わりません。オフにするとファイルはそのまま送信されます。",
    "messagesMediaSettings.sendPhotosThatAppearSooner":
        "より早く表示される写真を送信",
    "messagesMediaSettings.rewriteJpegPhotosYouSend":
        "送信するJPEG写真を書き換えて、全体がすぐ表示され、ダウンロードに伴って精細になるようにします。再エンコードは行わず、画質も変わりません。オフにするとファイルはそのまま送信されます。",
    "messagesMediaSettings.removeLocationAndMetadata":
        "アップロードから位置情報などのメタデータを削除",
    "messagesMediaSettings.stripMetadataDescription":
        "送信する写真や動画からEXIF、GPS位置情報、カメラ情報などの隠れたメタデータを取り除きます。画質は変わらず、向きの情報は残るので写真は正しい向きで表示されます。",
    "messagesMediaSettings.stripMetadataWarning":
        "警告: これをオフにすると、送信するファイルから撮影場所などの個人情報が漏れる可能性があります。",
    "messagesMediaSettings.randomizeFileNames": "ファイル名をランダム化",
    "messagesMediaSettings.randomizeFileNamesDescription":
        "実際の名前ではなく、英数字のランダムな名前でアップロードします。拡張子は .tar.gz のようなものも含めて保持されます。",
    "messagesMediaSettings.sendGifsAsAnimatedWebp":
        "GIFをアニメーションWebPで送信",
    "messagesMediaSettings.reencodeGifsYouSend":
        "送信するGIFを可逆圧縮のアニメーションWebPに再エンコードします。通常はより小さく、ダウンロード中に再生できます。画質は変わりません。小さくならないGIFはそのまま送信されます。",
    "messagesMediaSettings.defaultTab": "既定のタブ",
    "messagesMediaSettings.whichTabTheGifPickerOpens":
        "GIFピッカーが開くタブです。",
    "messagesMediaSettings.defaultGifTab": "既定のGIFタブ",
    "messagesMediaSettings.favourites": "お気に入り",
    "midiSoundBank.midi": "MIDI",
    "midiSoundBank.soundBank": "サウンドバンク",
    "midiSoundBank.theInstrumentSoundsUsedTo":
        "MIDIの添付ファイルを再生するときに使う楽器音です。",
    "midiSoundBank.system": "システム",
    "midiSoundBank.included": "同梱",
    "midiSoundBank.custom": "カスタム",
    "midiSoundBank.noSystemSoundBankFound":
        "この端末にシステムのサウンドバンクが見つからないため、同梱のものを使用します。",
    "midiSoundBank.chooseFile": "ファイルを選択",
    "midiSoundBank.chooseAnotherFile": "別のファイルを選択",
    "midiSoundBank.saving": "保存しています…",
    "midiSoundBank.sf2Sf3OrDlsUpTo":
        "カスタム: SF2、SF3、DLSファイル（最大256 MB）をこの端末に保存します。",
    "midiSoundBank.useAnSf2Sf3OrDls": "SF2、SF3、DLSファイルを使用します。",
    "midiSoundBank.thatFileIsEmpty": "そのファイルは空です。",
    "midiSoundBank.fileIsTooLarge":
        "そのファイルは大きすぎます（最大256 MB）。",
    "midiSoundBank.notASoundBank":
        "そのファイルはサウンドバンクではありません。",
    "midiSoundBank.couldNotSave":
        "サウンドバンクをこの端末に保存できませんでした（ストレージが満杯かもしれません）。",
    "modalDialog.fixture.fixtureDialog": "フィクスチャダイアログ",
    "notificationSettings.thisDevice": "この端末",
    "notificationSettings.systemPermission": "システムの権限",
    "notificationSettings.pushNotifications": "プッシュ通知",
    "notificationSettings.permissionIsBlockedInSystemSettings":
        "システム設定で権限がブロックされています",
    "notificationSettings.notificationsAreNotSupportedHere":
        "ここでは通知はサポートされていません",
    "notificationSettings.allowThisAppToSendNotifications":
        "このアプリに通知の送信を許可",
    "notificationSettings.requesting": "要求しています…",
    "notificationSettings.blocked": "ブロック済み",
    "notificationSettings.unavailable": "利用不可",
    "notificationSettings.enable": "有効化",
    "notificationSettings.pushService": "プッシュサービス",
    "notificationSettings.pushServiceLabel": "配信経路",
    "notificationSettings.pushServiceDescription":
        "アプリを閉じている間、通知がこの端末に届く方法です。UnifiedPushはGoogleのサービスを使わず、ntfyなどの配信アプリ経由で動作します。",
    "notificationSettings.pushServiceAutomatic": "自動",
    "notificationSettings.pushServiceFcm": "Google（Firebase）",
    "notificationSettings.pushServiceFcmUnavailable":
        "Google（Firebase）、ここでは利用不可",
    "notificationSettings.pushServiceUnifiedPush": "UnifiedPush: {label}",
    "notificationSettings.pushServiceNoDistributor":
        "UnifiedPushの配信アプリがインストールされていません。Googleのサービスなしで通知を受けるには、ntfyなどをインストールしてください。",
    "notificationSettings.pushServiceActiveFcm":
        "現在Google（Firebase）を使用しています。",
    "notificationSettings.pushServiceActiveUnifiedPush":
        "現在UnifiedPush（{label}）を使用しています。",
    "notificationSettings.pushServiceActiveNone":
        "有効なプッシュサービスがないため、通知はアプリを開いている間だけ届きます。",
    "notificationSettings.pushServiceSwitchFailed":
        "プッシュサービスを切り替えられませんでした",
    "notificationSettings.sound": "サウンド",
    "notificationSettings.notificationSound": "通知音",
    "notificationSettings.playASoundForLoudNotifications":
        "大きな通知で音を鳴らす",
    "notificationSettings.desktopAlerts": "デスクトップのアラート",
    "notificationSettings.popUpAndTaskbarFlash":
        "ポップアップとタスクバーの点滅",
    "notificationSettings.whichNotificationsShowASystemPop":
        "ウィンドウが背面にあるとき、どの通知でシステムのポップアップを出しタスクバーのアイコンを点滅させるか。",
    "notificationSettings.popUps": "ポップアップ",
    "notificationSettings.popUpNotifications": "ポップアップ通知",
    "notificationSettings.whichNotificationsShowASystemPopUp":
        "アプリが背面にあるとき、どの通知でシステムのポップアップを出すか。",
    "notificationSettings.multipleDevices": "複数のデバイス",
    "notificationSettings.quietOnMyOtherDevices": "他のデバイスでは静かに",
    "notificationSettings.whileYouReActivelyUsingOne":
        "ある端末を操作している間、他の端末はこの時間が経過するまで通知音とポップアップを控えます。アカウント内のすべての端末に適用されます。通知は受信箱に表示され、未読数も変わりません。",
    "notificationSettings.custom": "カスタム…",
    "notificationSettings.customQuietDurationInMinutes":
        "カスタムの静穏時間（分）",
    "notificationSettings.minutesMax": "分（最大 {MAX_CUSTOM_GRACE_MINUTES}）",
    "notificationSettings.couldnTSaveToYourAccount":
        "アカウントに保存できませんでした。他の端末は古い設定のままかもしれません。接続を確認して再度お試しください。",
    "notificationSettings.retrySavingTheOtherDeviceQuiet":
        "他端末の静穏設定の保存を再試行",
    "notificationSettings.retrying": "再試行しています…",
    "notificationSettings.rules": "ルール",
    "notificationSettings.notificationRules": "通知ルール",
    "notificationSettings.loudNotifyWithSoundSilentNotify":
        "大 = 音ありで通知 · 静か = 音なしで通知 · オフ = 通知しない",
    "notificationSettings.keywordHighlights": "キーワードのハイライト",
    "notificationSettings.getNotifiedWhenAMessageContains":
        "メッセージに特定の単語やフレーズが含まれるときに通知します。照合は大文字小文字を区別しません。",
    "notificationSettings.and": "と",
    "notificationSettings.areWildcards": "はワイルドカードです。",
    "notificationSettings.addAKeyword": "キーワードを追加…",
    "notificationSettings.newKeyword": "新しいキーワード",
    "notificationSettings.noKeywordRulesYet":
        "キーワードルールはまだありません。",
    "notificationSettings.behaviorFor": "{pattern}の動作",
    "notificationSettings.enable2": "{pattern}を有効化",
    "notificationSettings.loudOnly": "大のみ",
    "notificationSettings.onlyNotificationsThatMakeASound": "音が鳴る通知のみ",
    "notificationSettings.silentAndLoud": "静かと大",
    "notificationSettings.everyNotificationLoudOrSilent":
        "すべての通知（大または静か）",
    "notificationSettings.none": "なし",
    "notificationSettings.neverAlertOnThisDevice": "この端末では通知しない",
    "notificationSettings.couldNotSaveNotificationSetting":
        "通知設定を保存できませんでした",
    "notificationSettings.highlightSound": "ハイライト + 音",
    "notificationSettings.notifyWithAHighlightAndSound": "ハイライトと音で通知",
    "notificationSettings.highlight": "ハイライト",
    "notificationSettings.notifyWithAHighlight": "ハイライトで通知",
    "notificationSettings.notify": "通知",
    "notificationSettings.notifyWithoutAHighlight": "ハイライトなしで通知",
    "notificationSettings.failedToAddKeyword":
        "キーワードを追加できませんでした",
    "notificationSettings.failedToUpdateKeyword":
        "キーワードを更新できませんでした",
    "notificationSettings.failedToDeleteKeyword":
        "キーワードを削除できませんでした",
    "notificationSettings.accountNotificationsOff":
        "このアカウントの通知はオフです",
    "notificationSettings.accountNotificationsOffDetail":
        "このアカウントの通知はサーバー側ですべてオフになっています（おそらく別のアプリから）。そのため下の設定に関わらず、どの端末でも通知されません。",
    "notificationSettings.turnOn": "オンにする",
    "notificationSettings.couldNotTurnOnNotifications":
        "通知をオンにできませんでした",
    "notificationsPanel.clearAll": "すべて消去",
    "notificationsPanel.couldNotRefreshServerNotificationsTap":
        "サーバーの通知を更新できませんでした。タップで再試行。",
    "notificationsPanel.noNotifications": "通知はありません。",
    "notificationsPanel.jumpToMessage": "メッセージへ移動:",
    "notificationsPanel.in": "#{roomName}にて",
    "notificationsPanel.message": "（メッセージ）",
    "outboxStrip.queued": "送信待ち",
    "outboxStrip.sending": "送信中…",
    "outboxStrip.failed": "失敗",
    "ownStatusEditor.pickAStatusEmoji": "ステータス絵文字を選択",
    "ownStatusEditor.whatSHappening": "いまどうしてる？",
    "ownStatusEditor.statusText": "ステータステキスト",
    "ownStatusEditor.clearStatus": "ステータスをクリア",
    "ownStatusEditor.couldNotSaveStatus": "ステータスを保存できませんでした",
    "pinnedMessagesPanel.pinnedMessages": "ピン留めしたメッセージ",
    "pinnedMessagesPanel.noPinnedMessages":
        "ピン留めしたメッセージはありません。",
    "pinnedMessagesPanel.jump": "移動",
    "pinnedMessagesPanel.unpin": "ピン留めを解除",
    "pluginPopoverHost.plugin": "プラグイン",
    "pluginSettingsForm.backToPlugins": "プラグイン一覧に戻る",
    "pluginSettingsForm.settings": "{pluginName}の設定",
    "pluginSettingsForm.thisPluginHasNoSettings":
        "このプラグインに設定はありません。",
    "pluginSettingsForm.moveUp": "上へ移動",
    "pluginSettingsForm.moveDown": "下へ移動",
    "pluginSettingsForm.removeRow": "行を削除",
    "pluginsSettings.back": "← 戻る",
    "pluginsSettings.syncYourEnabledPluginsSettingsTo":
        "有効なプラグインとその設定をMatrixアカウントに同期します（オフなら端末ごと）。取り込み時は、実行前に変更内容が表示されます。",
    "pluginsSettings.pushToAccount": "アカウントへ書き出し",
    "pluginsSettings.pullFromAccount": "アカウントから取り込み",
    "pluginsSettings.thisPullWill": "この取り込みで行うこと:",
    "pluginsSettings.addRepos": "リポジトリを追加: {join}",
    "pluginsSettings.installFromRepos": "リポジトリからインストール: {join}",
    "pluginsSettings.couldNotInstall":
        "適用しましたが、次のプラグインはインストールできませんでした: {join}",
    "pluginsSettings.enable": "有効化: {join}",
    "pluginsSettings.disable": "無効化: {join}",
    "pluginsSettings.updateSettingsFor": "設定を更新: {join}",
    "pluginsSettings.setAutoUpdate": "自動更新を設定: {value}",
    "pluginsSettings.setPerPluginAutoUpdate":
        "プラグインごとの自動更新を設定: {join}",
    "pluginsSettings.notInstalledOnThisDeviceInstall":
        "この端末には未インストールです（参照からインストールしてから再度取り込んでください）: {join}",
    "pluginsSettings.nothingToChangeAlreadyInSync":
        "変更はありません。すでに同期されています。",
    "pluginsSettings.apply": "適用",
    "pluginsSettings.installed": "インストール済み",
    "pluginsSettings.noPluginsInstalled":
        "プラグインがインストールされていません。",
    "pluginsSettings.needsUpdate": "更新あり",
    "pluginsSettings.updateToV": "v{value}に更新",
    "pluginsSettings.updating": "更新しています...",
    "pluginsSettings.update": "更新",
    "pluginsSettings.pluginSettings": "プラグインの設定",
    "pluginsSettings.enable2": "{name}を有効化",
    "pluginsSettings.working": "処理しています...",
    "pluginsSettings.autoUpdateThisPlugin": "このプラグインを自動更新",
    "pluginsSettings.autoDefault": "自動: 既定",
    "pluginsSettings.autoOn": "自動: オン",
    "pluginsSettings.autoOff": "自動: オフ",
    "pluginsSettings.confirmRemove": "{name}の削除を確認",
    "pluginsSettings.removePlugin": "プラグインを削除",
    "pluginsSettings.remove": "{name}を削除",
    "pluginsSettings.browse": "参照",
    "pluginsSettings.loading": "読み込んでいます...",
    "pluginsSettings.noPluginsInThisRepoYet":
        "このリポジトリにはまだプラグインがありません。",
    "pluginsSettings.install": "インストール",
    "pluginsSettings.repos": "リポジトリ",
    "pluginsSettings.official": "公式",
    "pluginsSettings.removeRepo": "リポジトリを削除",
    "pluginsSettings.addARepo": "リポジトリを追加",
    "pluginsSettings.thirdPartyReposRunFullTrust":
        "第三者のリポジトリは、アカウントとメッセージへの完全なアクセス権を持つ全信頼のコードを実行します。信頼できるリポジトリだけを追加してください。",
    "pluginsSettings.ownerRepoOrGithubUrl": "owner/repo または GitHub URL",
    "pluginsSettings.addRepo": "リポジトリを追加",
    "pluginsSettings.syncPlugins": "プラグインを同期",
    "pluginsSettings.disableAllPlugins": "すべてのプラグインを無効化",
    "pluginsSettings.autoUpdatePlugins": "プラグインを自動更新",
    "pluginsSettings.automaticallyPullNewerVersionsOfRepo":
        "リポジトリのプラグインの新しいバージョンを自動で取り込みます。",
    "pluginsSettings.pushedYourPluginSetToYour":
        "プラグイン構成をアカウントに書き出しました。",
    "pluginsSettings.pushFailed": "書き出しに失敗しました。",
    "pluginsSettings.pullFailed": "取り込みに失敗しました。",
    "pluginsSettings.appliedTheSyncedPluginSet":
        "同期されたプラグイン構成を適用しました。",
    "pluginsSettings.updateFailed": "更新に失敗しました。",
    "pluginsSettings.couldnTRemovePlugin":
        "プラグインを削除できませんでした: {message}",
    "pluginsSettings.couldnTRemovePlugin2":
        "プラグインを削除できませんでした。",
    "pluginsSettings.cannotAddThisRepo": "このリポジトリは追加できません。",
    "pluginsSettings.noIndexJson": "index.json がありません（{status}）",
    "pluginsSettings.installFailed": "インストールに失敗しました。",
    "pollBody.finalResults": "最終結果",
    "pollBody.livePoll": "実施中の投票",
    "pollBody.resultsAreRevealedWhenThePoll":
        "結果は投票の終了時に公開されます",
    "pollBody.chooseUpTo": "· 最大{maxSelections}件まで選択",
    "pollBody.selected": "✓ 選択済み",
    "pollBody.submitting": "送信しています…",
    "pollBody.submitVote": "投票を送信",
    "pollBody.votesAreHidden": "投票は非公開です",
    "pollBody.savingVote": "· 投票を保存しています…",
    "pollBody.closeThisPoll": "この投票を締め切りますか？",
    "pollBody.closing": "締め切っています…",
    "pollBody.closePoll": "投票を締め切る",
    "pollBody.pollUnsupportedFormat": "[投票 - 未対応の形式]",
    "pollBody.failedToSubmitVote": "投票の送信に失敗しました",
    "pollBody.failedToClosePoll": "投票の締め切りに失敗しました",
    "pollBody.voteCount": "{count, plural, other {#票}}",
    "portal.fixture.hello": "こんにちは",
    "privacySafetySettings.privacy": "プライバシー",
    "privacySafetySettings.privateReadReceipts": "非公開の既読",
    "privacySafetySettings.sendTypingIndicators": "入力中の表示を送信",
    "privacySafetySettings.indexEncryptedRooms":
        "この端末で暗号化ルームをインデックス化",
    "privacySafetySettings.indexEncryptedRoomsHint":
        "暗号化ルームのメッセージの圧縮コピーをこの端末に保持し、それらのルームで検索とメディア一覧を使えるようにします。履歴はバックグラウンドでゆっくり取得されます。オフにするとコピーは削除されます。",
    "privacySafetySettings.letOthersInARoomSee":
        "ルームの他の人に、入力中であることを表示します。オフにすると誰にも知られずに入力できます。",
    "privacySafetySettings.hideYourReadReceiptsFromOther":
        "他のユーザーに既読を表示しません。未読数は引き続き機能し、他の人にはどこまで読んだかが見えなくなります。",
    "privacySafetySettings.hideMessageTextInNotifications":
        "通知でメッセージ本文を隠す",
    "privacySafetySettings.notificationsOnThisDeviceSayWho":
        "この端末の通知では、誰から来たかは表示しますが、本文は表示しません。送信者名とルーム名は引き続き表示されます。この端末のみに適用されます。",
    "privacySafetySettings.linkPreviewMedia": "リンクプレビューのメディア",
    "privacySafetySettings.previewImagesAndVideosUsuallyCome":
        "プレビューの画像や動画は通常、それをホストするサイトから直接読み込まれるため、そのサイトにあなたのIPアドレスとメッセージを読んだ時刻が伝わります。「ホームサーバーのみ」では自分のサーバーが配信するコピーだけを読み込み、「オフ」では一切読み込みません。どちらも、常にそれらのサイトから直接読み込まれる埋め込みYouTubeプレーヤーとX/Twitterカードも隠します。いずれの場合も、影響を受ける各プレビューにはメディアを読み込むボタンが残ります。リンクプレビューのオン/オフはメッセージとメディアにあります。",
    "privacySafetySettings.blockedUsers": "ブロックしたユーザー",
    "privacySafetySettings.all": "すべて",
    "privacySafetySettings.loadPreviewMediaFromWhereverIt":
        "プレビューのメディアをホスト元から読み込む",
    "privacySafetySettings.homeserverOnly": "ホームサーバーのみ",
    "privacySafetySettings.onlyLoadPreviewMediaYourOwn":
        "自分のホームサーバーが配信するプレビューメディアのみ読み込む",
    "privacySafetySettings.off": "オフ",
    "privacySafetySettings.neverLoadPreviewMediaAutomatically":
        "プレビューのメディアを自動で読み込まない",
    "profileFieldsEditor.moreAboutYou": "あなたについて",
    "profileFieldsEditor.banner": "バナー",
    "profileFieldsEditor.yourBanner": "あなたのバナー",
    "profileFieldsEditor.changeBanner": "バナーを変更",
    "profileFieldsEditor.showWhenIAmInA": "通話中に表示",
    "profileFieldsEditor.addsInACallToYour":
        "音声通話に接続している間、プロフィールに「通話中」を追加し、退出すると削除します。",
    "profileFieldsEditor.pronouns": "代名詞",
    "profileFieldsEditor.sheHerTheyThem": "she/her, they/them",
    "profileFieldsEditor.separateWithCommasMostPreferredFirst":
        "カンマで区切ってください。最も希望するものを先に。",
    "profileFieldsEditor.status": "ステータス",
    "profileFieldsEditor.statusEmoji": "ステータス絵文字",
    "profileFieldsEditor.pickAStatusEmoji": "ステータス絵文字を選択",
    "profileFieldsEditor.onHolidayUntilThe23rd": "23日まで休暇中",
    "profileFieldsEditor.statusText": "ステータステキスト",
    "profileFieldsEditor.bio": "自己紹介",
    "profileFieldsEditor.tellPeopleAboutYourself": "自己紹介を書いてください",
    "profileFieldsEditor.timezone": "タイムゾーン",
    "profileFieldsEditor.timezoneRegion": "タイムゾーンの地域",
    "profileFieldsEditor.notSet": "未設定",
    "profileFieldsEditor.timezoneCity": "タイムゾーンの都市",
    "profileFieldsEditor.chooseACity": "都市を選択",
    "profileFieldsEditor.europeLondon": "Europe/London",
    "profileFieldsEditor.useMine": "自分のものを使う",
    "profileFieldsEditor.usernameColour": "ユーザー名の色",
    "profileFieldsEditor.usernameColourOnDarkThemes":
        "ダークテーマでのユーザー名の色",
    "profileFieldsEditor.darkThemes": "ダークテーマ",
    "profileFieldsEditor.usernameColourOnLightThemes":
        "ライトテーマでのユーザー名の色",
    "profileFieldsEditor.lightThemes": "ライトテーマ",
    "profileFieldsEditor.resetToDefault": "既定に戻す",
    "profileFieldsEditor.chooseAColour": "色を選択",
    "profileFieldsEditor.oneColourForDarkThemesAnd":
        "ダークテーマ用とライトテーマ用に1色ずつ設定すると、どちらでも名前が読みやすく保たれます。",
    "profileFieldsEditor.links": "リンク",
    "profileFieldsEditor.label": "ラベル",
    "profileFieldsEditor.linkLabel": "リンクのラベル",
    "profileFieldsEditor.httpsExampleOrg": "https://example.org",
    "profileFieldsEditor.linkAddress": "リンクのアドレス",
    "profileFieldsEditor.removeLink": "リンクを削除",
    "profileFieldsEditor.addLink": "リンクを追加",
    "profileFieldsEditor.saved": "保存しました",
    "profileFieldsEditor.useATimezoneNameLikeEurope":
        "Europe/London のようなタイムゾーン名を使ってください。",
    "profileFieldsEditor.chooseACity2": "都市を選択してください。",
    "profileFieldsEditor.bannerUploadFailed":
        "バナーのアップロードに失敗しました",
    "profileFieldsEditor.failedToSaveProfileFields":
        "プロフィール項目の保存に失敗しました",
    "profileFooter.dismiss": "閉じる",
    "profileFooter.switchAccounts": "アカウントを切り替え",
    "profileFooter.unknown": "不明",
    "pushDiagnostics.pushGateway": "プッシュゲートウェイ",
    "pushDiagnostics.notificationRelay": "通知リレー",
    "pushDiagnostics.pushNotificationsAreRelayedThroughThis":
        "プッシュ通知はこのゲートウェイ経由で中継されます。どのルームと送信者が通知するかは見えますが、メッセージ本文は見えません。",
    "pushDiagnostics.warningYourHomeserverIsRoutingThis":
        "警告: ホームサーバーがこの端末のプッシュ通知を別のゲートウェイ（{join}）に振り分けています。通知のメタデータを見るのは上のゲートウェイではなく、そちらです。",
    "pushDiagnostics.verifiedYourHomeserverRoutesNotificationsTo":
        "確認済み: ホームサーバーが通知をこのゲートウェイに振り分けています。",
    "pushDiagnostics.noPushNotificationsAreRegisteredOn":
        "このアカウントにはまだプッシュ通知が登録されていません。",
    "qrCodeImage.couldNotRenderTheVerificationCode":
        "検証コードを描画できませんでした。",
    "qrCodeImage.qrCodeForDeviceVerification": "デバイス検証用のQRコード",
    "quickActions.newDm": "新しいDM",
    "quickActions.createRoomInSpace": "スペース内にルームを作成",
    "quickActions.createNewRoom": "新しいルームを作成",
    "quickActions.createNewSpace": "新しいスペースを作成",
    "quickActions.joinRoomByAddress": "アドレスでルームに参加",
    "quickActions.createARoom": "ルームを作成",
    "quickActions.createASpace": "スペースを作成",
    "quickActions.newDirectMessage": "新しいダイレクトメッセージ",
    "quickActions.joinARoom": "ルームに参加",
    "quickActions.spaceName": "スペース名",
    "quickActions.roomName": "ルーム名",
    "quickActions.mySpace": "マイスペース",
    "quickActions.optional": "（任意）",
    "quickActions.whatSThisSpaceAbout": "このスペースは何について？",
    "quickActions.whatSThisRoomAbout": "このルームは何について？",
    "quickActions.opensStraightIntoACallMessages":
        "開くとすぐに通話が始まります。メッセージも使えます。",
    "quickActions.enableEncryption": "暗号化を有効化",
    "quickActions.canTBeTurnedOffLater": "あとからオフにはできません。",
    "quickActions.findSomeoneToMessage": "メッセージする相手を探す…",
    "quickActions.encryptThisDm": "このDMを暗号化",
    "quickActions.openTheDm": "DMを開く",
    "quickActions.roomAddressOrId": "ルームのアドレスまたはID",
    "quickActions.roomServerCom": "#room:server.com",
    "quickActions.requestSentYouLlBeAble":
        "リクエストを送信しました。誰かが承認すると参加できます。",
    "quickActions.youCanTJoinThisRoom":
        "このルームには直接参加できませんが、参加をリクエストできます。",
    "quickActions.requestToJoin": "参加をリクエスト",
    "quickActions.create": "作成",
    "quickActions.somethingWentWrong": "問題が発生しました",
    "quickActions.enterARoomAddressRoomServer":
        "ルームのアドレス（#room:server.com）またはルームID（!id:server.com）を入力してください",
    "quickActions.couldNotSendTheJoinRequest":
        "参加リクエストを送信できませんでした",
    "reactorPopover.more": "他{overflow}件",
    "reactorPopover.reactedWith": "{label}でリアクション",
    "reactorPopover.userList": "ユーザー一覧",
    "renameAttachmentDialog.editAttachment": "添付ファイルを編集",
    "renameAttachmentDialog.filename": "ファイル名",
    "renameThreadDialog.nameThread": "スレッドに名前を付ける",
    "renameThreadDialog.renameThread": "スレッド名を変更",
    "renameThreadDialog.threadName": "スレッド名",
    "renameThreadDialog.everyoneInTheRoomSeesIt":
        "ルームの全員がZamでこの名前を見ます。他のMatrixアプリでは表示されません。",
    "renameThreadDialog.removeName": "名前を削除",
    "renameThreadDialog.couldNotSaveTheName": "名前を保存できませんでした",
    "roomDirectory.exploreRooms": "ルームを探す",
    "roomDirectory.onYourHomeserver": "あなたのホームサーバー上",
    "roomDirectory.publicRooms": "公開ルーム {value}",
    "roomDirectory.rooms": "· 約{totalEstimate}ルーム",
    "roomDirectory.searchRooms": "ルームを検索…",
    "roomDirectory.serverOptional": "サーバー（任意）",
    "roomDirectory.search": "検索",
    "roomDirectory.noRoomsFound": "ルームが見つかりません。",
    "roomDirectory.space": "スペース",
    "roomDirectory.open": "開く",
    "roomDirectory.knockOnly": "ノックのみ",
    "roomDirectory.requestToJoin": "参加をリクエスト",
    "roomDirectory.requested": "リクエスト済み",
    "roomDirectory.somethingWentWrong": "問題が発生しました",
    "roomHeaderOverflowMenu.moreRoomOptions": "その他のルームオプション",
    "roomHeaderOverflowMenu.unread": "未読",
    "roomHeaderOverflowMenu.badgeThreads":
        "{count, plural, other {{badge}件の未読メンション}}",
    "roomHeaderOverflowMenu.badgePinned":
        "{count, plural, other {{badge}件のピン留めメッセージ}}",
    "roomHeaderOverflowMenu.badgeNotifications":
        "{count, plural, other {{badge}件の未読通知}}",
    "roomHeaderOverflowMenu.badgeMedia": "{count, plural, other {{badge}件}}",
    "roomHeaderOverflowMenu.badgeMembers":
        "{count, plural, other {{badge}人のメンバー}}",
    "roomList.doneReordering": "並べ替えを完了",
    "roomList.reorderRooms": "ルームを並べ替え",
    "roomList.spaceSettings": "スペース設定",
    "roomList.pendingInvites": "保留中の招待",
    "roomList.inVoice": "{name} - 通話中",
    "roomList.orderValue": "並び順の値",
    "roomList.roomSettings": "ルーム設定",
    "roomList.favourites": "お気に入り",
    "roomList.channels": "チャンネル",
    "roomList.rooms": "ルーム",
    "roomList.lowPriority": "低優先",
    "roomList.browseRooms": "ルームを参照",
    "roomList.members": "{numMembers}人のメンバー",
    "roomList.requested": "リクエスト済み",
    "roomList.cancelRequest": "リクエストをキャンセル",
    "roomList.youCanTJoinThisRoom":
        "このルームには直接参加できません。代わりに参加をリクエストしますか？",
    "roomList.notNow": "あとで",
    "roomList.requestToJoin": "参加をリクエスト",
    "roomList.directMessages": "ダイレクトメッセージ",
    "roomList.noRoomsYet": "ルームはまだありません",
    "roomList.emptyCategory": "ルームなし",
    "roomList.copyRoomLink": "ルームのリンクをコピー",
    "roomList.markAsRead": "既読にする",
    "roomList.addToSpace": "スペースに追加",
    "roomList.clickAgainToLeave": "もう一度クリックすると退出",
    "roomList.leaveRoom": "ルームを退出",
    "roomList.couldNotSendTheJoinRequest":
        "参加リクエストを送信できませんでした",
    "roomList.orderMustBeBetween0And":
        "並び順は0から1の間で指定してください。代わりに {value} を使用しました。",
    "roomList.failedToSetOrder": "並び順を設定できませんでした",
    "roomMediaPanel.media": "メディア",
    "roomMediaPanel.closeMediaPanel": "メディアパネルを閉じる",
    "roomMediaPanel.media2": "メディア（{length}{value}）",
    "roomMediaPanel.files": "ファイル（{length}{value}）",
    "roomMediaPanel.tryAgain": "再試行",
    "roomMediaPanel.play": "{name} - 再生",
    "roomMediaPanel.video": "ビデオ",
    "roomMediaPanel.audio": "音声",
    "roomMediaPanel.file": "ファイル",
    "roomMediaPanel.decryptingMedia": "メディアを復号中",
    "roomMediaPanel.decryptingMedia2": "メディアを復号中...",
    "roomMediaPanel.mediaCouldNotBeLoaded": "メディアを読み込めませんでした",
    "roomMediaPanel.couldNotLoadThisMedia":
        "このメディアを読み込めませんでした。",
    "roomMediaPanel.noMediaFoundInTheLast":
        "直近数百件のメッセージにメディアはありません。",
    "roomMediaPanel.noFilesFoundInTheLast":
        "直近数百件のメッセージにファイルはありません。",
    "roomMediaPanel.noImagesOrVideosInThis":
        "このルームにはまだ画像もビデオもありません。",
    "roomMediaPanel.noFilesInThisRoomYet":
        "このルームにはまだファイルがありません。",
    "roomMediaPanel.couldNotLoadMedia": "メディアを読み込めませんでした。",
    "roomMediaPanel.couldNotLoadMoreMedia":
        "これ以上メディアを読み込めませんでした。",
    "roomMediaPanel.failedToDownloadAttachment":
        "添付ファイルのダウンロードに失敗しました",
    "roomSettings.closeSettings": "設定を閉じる",
    "roomSettings.backToSettings": "設定に戻る",
    "roomSettings.settings": "{name} - 設定",
    "roomSettings.roomAvatar": "ルームのアバター",
    "roomSettings.roomName": "ルーム名",
    "roomSettings.saved": "保存しました",
    "roomSettings.saveChanges": "変更を保存",
    "roomSettings.advanced": "詳細設定",
    "roomSettings.spaceId": "スペースID",
    "roomSettings.roomId": "ルームID",
    "roomSettings.copied": "コピーしました",
    "roomSettings.roomVersionV": "ルームバージョン: v{getVersion}",
    "roomSettings.upgradeRoom": "ルームをアップグレード…",
    "roomSettings.thisCreatesANewRoomOn":
        "v{recommendedVersion} で新しいルームを作成し、このルームを置き換え済みにします。メンバーは新しいルームへ案内されます。",
    "roomSettings.upgrading": "アップグレード中…",
    "roomSettings.upgradeRoom2": "ルームをアップグレード",
    "roomSettings.whoCanJoin": "参加できるのは誰ですか？",
    "roomSettings.spaceMembersAnyoneInCanJoin":
        "スペースメンバー - {parentSpaceNames} のメンバーなら誰でも参加できます",
    "roomSettings.spaceMembersAnyoneInTheParent":
        "スペースメンバー - 親スペースのメンバーなら誰でも参加できます",
    "roomSettings.messageHistory": "メッセージ履歴",
    "roomSettings.guestAccess": "ゲストアクセス",
    "roomSettings.allowGuestsToJoinWithoutAn":
        "アカウントなしでゲストの参加を許可する",
    "roomSettings.guestsAreAnonymousAccountsTheHomeserver":
        "ゲストはホームサーバーが必要に応じて作成する匿名アカウントです。多くのサーバーはゲスト登録を完全に無効にしており、その場合はこの設定は効果がありません。",
    "roomSettings.discoverability": "検出可能性",
    "roomSettings.addresses": "アドレス",
    "roomSettings.loadingAddresses": "アドレスを読み込み中…",
    "roomSettings.noAddressesYet": "アドレスはまだありません。",
    "roomSettings.main": "メイン",
    "roomSettings.remove": "{alias} を削除",
    "roomSettings.mainAddress": "メインアドレス",
    "roomSettings.noMainAddress": "メインアドレスなし",
    "roomSettings.set": "設定",
    "roomSettings.myRoom": "my-room",
    "roomSettings.serverAccessControl": "サーバーアクセス制御",
    "roomSettings.controlWhichHomeserversMayParticipateIn":
        "このルームに参加できるホームサーバーを制御します。ワイルドカード:",
    "roomSettings.matchesAnyCharacters": "は任意の文字列に一致、",
    "roomSettings.matchesOneDeniedServersAreRemoved":
        "は1文字に一致。拒否されたサーバーはこのルームのフェデレーションから除外されます。",
    "roomSettings.noServerAclIsSetAll":
        "サーバーACLは設定されていません。すべてのサーバーが参加できます。",
    "roomSettings.allowedServersOnePerLine": "許可するサーバー（1行に1つ）",
    "roomSettings.deniedServersOnePerLine": "拒否するサーバー（1行に1つ）",
    "roomSettings.allowServersIdentifiedByARaw":
        "生のIPアドレスで識別されるサーバーを許可する",
    "roomSettings.saveServerAcl": "サーバーACLを保存",
    "roomSettings.youDoNotHavePermissionTo":
        "このルームのサーバーACLを編集する権限がありません。",
    "roomSettings.appliesToTheSpaceAndAll":
        "スペースとそのすべてのルームに適用されます。",
    "roomSettings.notificationLevel": "通知レベル",
    "roomSettings.encryption": "暗号化",
    "roomSettings.encrypted": "暗号化済み",
    "roomSettings.notEncrypted": "暗号化されていません",
    "roomSettings.messagesInThisRoomAreEnd":
        "このルームのメッセージはエンドツーエンド暗号化されています。オフにはできません。",
    "roomSettings.roomKey": "ルームキー",
    "roomSettings.resetRoomKey": "ルームキーをリセット",
    "roomSettings.resetRoomKeyHint":
        "ここでメッセージを読めない人がいる場合、次のメッセージを新しいキーで送信し、ルーム内のすべてのセッションと共有し直します。",
    "roomSettings.couldNotResetRoomKey": "ルームキーをリセットできませんでした",
    "roomSettings.enableEncryption": "暗号化を有効にする",
    "roomSettings.typeToConfirm":
        "確認のため {ENABLE_ENCRYPTION_CONFIRM_PHRASE} を入力",
    "roomSettings.enabling": "有効化中…",
    "roomSettings.powerLevelRequiredForEachAction":
        "各操作に必要な権限レベル（0-100）。",
    "roomSettings.joinCallsVoiceVideo": "通話に参加（音声/ビデオ）",
    "roomSettings.invite": "招待",
    "roomSettings.searchMembers": "メンバーを検索…",
    "roomSettings.banned": "BAN済み ({length})",
    "roomSettings.pendingJoinRequests": "保留中の参加リクエスト ({length})",
    "roomSettings.deny": "拒否",
    "roomSettings.approve": "承認",
    "roomSettings.unban": "BAN解除",
    "roomSettings.noBannedMembers": "BANされたメンバーはいません",
    "roomSettings.you": " (あなた)",
    "roomSettings.setRole": "ロールを設定…",
    "roomSettings.admin100": "管理者 (100)",
    "roomSettings.moderator50": "モデレーター (50)",
    "roomSettings.member0": "メンバー (0)",
    "roomSettings.muted1": "ミュート (-1)",
    "roomSettings.kick": "キック",
    "roomSettings.ban": "BAN",
    "roomSettings.hideThisUserSMessagesEverywhere":
        "このユーザーのメッセージをすべての場所で非表示にする（アカウントに保存）",
    "roomSettings.setThe": "各子ルームの",
    "roomSettings.fieldOnEachChildRoomTo":
        "フィールドを設定して並び順を制御します（辞書順）。空欄にすると作成時刻順になります。",
    "roomSettings.suggested": "推奨",
    "roomSettings.removeSuggestedHint": "推奨のヒントを削除",
    "roomSettings.markAsSuggested": "推奨としてマーク",
    "roomSettings.unsuggest": "推奨を解除",
    "roomSettings.suggest": "推奨する",
    "roomSettings.order": "order",
    "roomSettings.removeFromSpace": "スペースから削除",
    "roomSettings.noChildRooms": "子ルームはありません",
    "roomSettings.useYourGlobalNotificationSettings":
        "グローバルの通知設定を使用します。",
    "roomSettings.allMessages": "すべてのメッセージ",
    "roomSettings.notifyForEveryMessage": "すべてのメッセージで通知します。",
    "roomSettings.mentionsOnly": "メンションのみ",
    "roomSettings.notifyOnlyForMentionsAndKeywords":
        "@メンションとキーワードのみ通知します。",
    "roomSettings.neverNotify": "通知しません。",
    "roomSettings.failedToUpdateNotifications": "通知を更新できませんでした。",
    "roomSettings.failedToEnableEncryption": "暗号化を有効にできませんでした",
    "roomSettings.failedToSave": "保存できませんでした",
    "roomSettings.uploadFailed": "アップロードに失敗しました",
    "roomSettings.failedToUpgradeRoom":
        "ルームをアップグレードできませんでした",
    "roomSettings.failedToSaveServerAcl": "サーバーACLを保存できませんでした",
    "roomSettings.couldNotChangeVisibility": "公開範囲を変更できませんでした",
    "roomSettings.couldNotLoadThisRoomS":
        "このルームのアドレスを読み込めませんでした",
    "roomSettings.couldNotAddThatAddress": "そのアドレスを追加できませんでした",
    "roomSettings.thisAddressIsPublishedAsOne":
        "このアドレスはルームのアドレスの1つとして公開されており、公開停止の権限がないため削除できません。ルーム管理者に問い合わせてください。",
    "roomSettings.couldNotRemoveThatAddress":
        "そのアドレスを削除できませんでした",
    "roomSettings.couldNotSetTheMainAddress":
        "メインアドレスを設定できませんでした",
    "roomSettings.failed": "失敗しました",
    "roomSettings.muted": "ミュート中",
    "roomSettings.admin": "管理者",
    "roomSettings.moderator": "モデレーター",
    "roomSettings.member": "メンバー",
    "roomSettings.failedToUpdateSuggestion": "推奨を更新できませんでした",
    "roomSettings.listThisRoomInTheServerDirectory":
        "このルームをサーバーディレクトリに掲載する",
    "roomSettings.listThisSpaceInTheServerDirectory":
        "このスペースをサーバーディレクトリに掲載する",
    "roomSettings.listsTheRoomByIdBeingFound":
        "IDでルームを掲載します。名前で見つけてもらうには公開アドレスも必要です。以下で追加してください。",
    "roomSettings.listsTheSpaceByIdBeingFound":
        "IDでスペースを掲載します。名前で見つけてもらうには公開アドレスも必要です。以下で追加してください。",
    "roomSettings.aPublishedAddressLetsPeopleFindRoom":
        "公開アドレスを設定すると、IDではなく名前でこのルームを見つけて参加できます。",
    "roomSettings.aPublishedAddressLetsPeopleFindSpace":
        "公開アドレスを設定すると、IDではなく名前でこのスペースを見つけて参加できます。",
    "roomSettings.chooseHowThisRoomNotifiesYou":
        "このルームの通知方法を選択してください。",
    "roomSettings.chooseHowThisSpaceNotifiesYou":
        "このスペースの通知方法を選択してください。",
    "screenSharePicker.chooseWhatToShare": "共有するものを選択",
    "screenSharePicker.noPreview": "プレビューなし",
    "screenSharePicker.screens": "画面",
    "screenSharePicker.windows": "ウィンドウ",
    "screenSharePicker.quality": "品質: {quality}",
    "screenSharePicker.audio": "音声",
    "screenSharePicker.audioAuto": "ウィンドウのアプリ、または画面全体の音声",
    "screenSharePicker.audioSystemExceptZam": "Zam以外のすべての音声",
    "screenSharePicker.audioSystem": "すべてのシステム音声",
    "screenSharePicker.audioApps": "アプリケーション",
    "screenSharePicker.audioNone": "音声なし",
    "screenShareQualityChips.resolution": "解像度",
    "screenShareQualityChips.frameRate": "フレームレート",
    "screenShareQualityChips.fps": "{f} FPS",
    "screenShareQualityChips.videoCodec": "ビデオコーデック",
    "screenShareQualityChips.hw": "HW",
    "screenShareQualityChips.codecHardware": "グラフィックカードでエンコード",
    "screenShareQualityChips.codecSoftware": "プロセッサでエンコード",
    "screenShareQualityChips.codecHint":
        "カメラと画面共有に適用されます。通話の全員が再生できるコーデックのみ表示されます。",
    "screenShareQualityChips.codecBackupHint":
        "通話の誰かが {codec} を再生できないため、その人にはH.264のコピーが送られ、アップロードが増えます。",
    "screenShareQualityChips.codecEncryptedFallbackHint":
        "この暗号化通話の誰かが {picked} を再生できないため、その人が退出するまで {current} を送信します。",
    "screenShareQualityChips.bitrate": "最大ビットレート",
    "screenShareQualityChips.bitrateUpTo": "最大",
    "screenShareQualityChips.bitrateCapHint":
        "これは上限であり目標値ではありません。共有は映像に必要な分と回線が運べる分だけを使い、最大でこの値までです。",
    "screenShareQualityChips.bitrateOverridden":
        "入力したアップロード速度 {upload} を使用しているため、最大 {max} まで上がります。",
    "screenShareQualityChips.uploadOverride": "アップロード速度 (Mbps)",
    "screenShareQualityChips.uploadOverrideAuto": "自動",
    "screenShareQualityChips.uploadOverrideHint":
        "自動測定は実際の速度よりかなり低く出ることがあります。上限を上げたい場合はご自身の数値を入力してください。空欄にすると測定します。",
    "screenShareQualityChips.kbps": "{n} kbps",
    "screenShareQualityChips.mbps": "{n} Mbps",
    "screenShareQualityChips.bitrateMeasured":
        "アップロードの実測値は {upload} なので、最大 {max} まで上がります。",
    "screenShareQualityChips.bitrateUnmeasured":
        "アップロードはまだ測定されていません。ビデオ送信中に測定されるため、当面は最大 {max} までです。",
    "screenShareQualityChips.shareSystemAudio": "システム音声を共有",
    "screenShareQualityChips.appliesToNextShare": "次回の共有に適用",
    "screenShareQualityChips.shareSystemAudioAppliesToNext":
        "システム音声を共有（次回の共有に適用）",
    "screenShareQualityPopover.screenShareQuality": "画面共有の品質",
    "securitySettings.showingTheLastReadingThatLoaded":
        "最後に読み込めた測定値を表示しています。古い可能性があります。",
    "securitySettings.securityEncryption": "セキュリティと暗号化",
    "securitySettings.setUpRecoverySoYourCross":
        "リカバリーを設定すると、クロス署名のIDと暗号化されたメッセージ履歴が、すべてのデバイスでサインアウトしても保持されます。",
    "securitySettings.verification": "検証",
    "securitySettings.loadingEncryptionStatus": "暗号化の状態を読み込み中…",
    "securitySettings.encryptionStatusUnknownOnThisSession":
        "このセッションの暗号化状態は不明です。",
    "securitySettings.recoveryKeyId": "リカバリーキーID:",
    "securitySettings.setUpRecovery": "リカバリーを設定",
    "securitySettings.approveOnAccountPageHint":
        "サーバーがアカウントページでの承認を求める場合があります。",
    "securitySettings.approveOnAccountPage": "アカウントページで承認",
    "securitySettings.approveOnAccountPageBody":
        "サーバーがこの変更の許可を求めています。アカウントページを開いて暗号IDのリセットを承認し、戻って続行してください。",
    "securitySettings.approveOnAccountPageRetry":
        "サーバーはまだ承認を確認できていません。アカウントページで承認してから続行してください。",
    "securitySettings.openAccountPage": "アカウントページを開く",
    "securitySettings.iVeApprovedIt": "承認しました",
    "securitySettings.weLlCreateA": "作成するのは",
    "securitySettings.recoveryKey": "リカバリーキー",
    "securitySettings.aOneTimeCodeThatUnlocks":
        "です。これは暗号化された履歴を解錠し、新しいセッションを検証するワンタイムコードです。パスワードマネージャーなど安全な場所に保管してください。表示は一度きりで、こちらでは復元できません。",
    "securitySettings.confirmYourAccountPasswordToCreate":
        "暗号キーを作成するにはアカウントのパスワードを確認してください。",
    "securitySettings.accountPassword": "アカウントのパスワード",
    "securitySettings.alsoLetMeUnlockWithA":
        "自分で選んだパスフレーズでも解錠できるようにする（任意 - リカバリーキーは引き続き有効で、表示もされます）。",
    "securitySettings.recoveryPassphrase": "リカバリーパスフレーズ",
    "securitySettings.atLeastCharactersWeCanT":
        "{MIN_PASSPHRASE_LENGTH}文字以上。こちらではリセットできません。",
    "securitySettings.settingUp": "設定中…",
    "securitySettings.continue": "続行",
    "securitySettings.saveYourRecoveryKey": "リカバリーキーを保存",
    "securitySettings.thisIsShown": "この表示は",
    "securitySettings.onlyOnce": "一度きりです。",
    "securitySettings.storeItNowWithoutItYou":
        "今すぐ保存してください - これがないと、セッションへのアクセスを失ったときに暗号化された履歴を復元できません。",
    "securitySettings.copied": "コピーしました ✓",
    "securitySettings.copyKey": "キーをコピー",
    "securitySettings.youCanAlsoUnlockWithThe":
        "選択したパスフレーズでも解錠できます。パスフレーズを忘れたときの唯一の手段なので、キーは必ず保管してください。",
    "securitySettings.iVeSavedMyRecoveryKey":
        "リカバリーキーは安全な場所に保管しました。",
    "securitySettings.done": "完了",
    "securitySettings.keysNotOnServer":
        "クロス署名キーがサーバーに届いていません",
    "securitySettings.keysNotOnServerHint":
        "このセッションがリカバリー設定時に生成しましたが、アップロードが完了しなかったため、どのセッションも互いを検証できません。今すぐアップロードして修正してください。",
    "securitySettings.uploadKeys": "キーをアップロード",
    "securitySettings.couldNotUploadKeys": "キーをアップロードできませんでした",
    "securitySettings.recoveryIsSetUp": "リカバリーは設定済みです",
    "securitySettings.yourCrossSigningKeysAndA":
        "クロス署名キーとキーバックアップはサーバーに安全に保存され、リカバリーキーで保護されています。",
    "securitySettings.recoveryIsNotSetUp": "リカバリーは設定されていません",
    "securitySettings.thisAccountHasNoRecoveryKey":
        "このアカウントにはリカバリーキーもキーバックアップもありません。以下の手順を完了してください。",
    "securitySettings.lostYourRecoveryKeyResetRecovery":
        "リカバリーキーを紛失した場合はリカバリーをリセット",
    "securitySettings.resettingCreatesA": "リセットすると",
    "securitySettings.new": "新しい",
    "securitySettings.recoveryKeyAndReplacesYourCurrent":
        "リカバリーキーが作成され、現在のバックアップが置き換わります。古いリカバリーキーは使えなくなり、他のセッションの再検証が必要になる場合があります。現在のキーを紛失した場合にのみ行ってください。",
    "securitySettings.yourOldRecoveryKeyAndBackup":
        "古いリカバリーキーとバックアップはリセットされましたが、新しいリカバリーは作成されていません。今すぐ設定を完了してください。完了するまで、新しいセッションでメッセージを復元できません。",
    "securitySettings.working": "処理中…",
    "securitySettings.finishSettingUpRecovery": "リカバリーの設定を完了",
    "securitySettings.confirmYourAccountPasswordToReset":
        "リカバリーをリセットするにはアカウントのパスワードを確認してください。",
    "securitySettings.resetting": "リセット中…",
    "securitySettings.resetCreateNewKey": "リセットして新しいキーを作成",
    "securitySettings.messageHistoryBackup": "メッセージ履歴のバックアップ",
    "securitySettings.verifyThisSessionRestoreHistory":
        "このセッションを検証して履歴を復元",
    "securitySettings.recoveryKey2": "リカバリーキー",
    "securitySettings.passphrase": "パスフレーズ",
    "securitySettings.enterYour":
        "このセッションを検証し、暗号化されたメッセージ履歴を復元するには、",
    "securitySettings.recoveryPassphrase2": "リカバリーパスフレーズ",
    "securitySettings.toVerifyThisSessionAndRestore": "を入力してください。",
    "securitySettings.thisSessionIsNowVerified":
        "このセッションは検証済みになりました",
    "securitySettings.encryptedHistoryRestored":
        "暗号化された履歴を復元しました",
    "securitySettings.couldNotSetUpRecovery":
        "リカバリーを設定できませんでした",
    "securitySettings.couldNotResetRecovery":
        "リカバリーをリセットできませんでした",
    "securitySettings.couldNotFinishSettingUpRecovery":
        "リカバリーの設定を完了できませんでした",
    "securitySettings.couldNotVerifyThisSession":
        "このセッションを検証できませんでした",
    "serverSettings.scanningServer": "サーバーをスキャン中…",
    "serverSettings.what": "以下は",
    "serverSettings.advertisesItemsMarkedUnknownArenT":
        "が通知する機能です。「不明」と表示される項目はサーバーが通知しておらず、使用時にのみ検出されます。",
    "serverSettings.accountMessaging": "アカウントとメッセージング",
    "serverSettings.voiceVideoCallingMatrixrtc": "音声/ビデオ通話 (MatrixRTC)",
    "serverSettings.server": "サーバー",
    "serverSettings.latestSpecVersion": "最新の仕様バージョン",
    "serverSettings.defaultRoomVersion": "既定のルームバージョン",
    "serverSettings.advertisedFeatures": "通知されている機能 ({length})",
    "serverSettings.supported": "対応",
    "serverSettings.notSupported": "非対応",
    "serverSettings.unknown": "不明",
    "serverSettings.changePassword": "パスワードを変更",
    "serverSettings.changeDisplayName": "表示名を変更",
    "serverSettings.changeAvatar": "アバターを変更",
    "serverSettings.manageEmailsPhoneNumbers": "メール/電話番号を管理",
    "serverSettings.threads": "スレッド",
    "serverSettings.privateReadReceipts": "非公開の既読通知",
    "serverSettings.sfuDiscoveryRtcFoci": "SFUディスカバリ (rtc_foci)",
    "serverSettings.delayedEventsCallCleanup": "遅延イベント（通話の後片付け）",
    "serverSettings.failedToReadServerCapabilities":
        "サーバー機能を読み取れませんでした",
    "sessionSettings.sessionName": "セッション名",
    "sessionSettings.current": "現在",
    "sessionSettings.rename": "名前を変更",
    "sessionSettings.signOut": "サインアウトしますか？",
    "sessionSettings.signOut2": "サインアウト",
    "sessionSettings.manageAtProvider": "管理",
    "sessionSettings.confirmYourAccountPasswordToSign":
        "このセッションをサインアウトするにはアカウントのパスワードを確認してください。",
    "sessionSettings.accountPassword": "アカウントのパスワード",
    "sessionSettings.signingOut": "サインアウト中…",
    "sessionSettings.encryption": "暗号化",
    "sessionSettings.active": "有効",
    "sessionSettings.unavailable": "利用不可",
    "sessionSettings.thisDeviceSKey": "このデバイスのキー",
    "sessionSettings.loadingDeviceKey": "デバイスキーを読み込み中…",
    "sessionSettings.endToEndEncryptionCouldNot":
        "このセッションでエンドツーエンド暗号化を開始できませんでした。暗号化されたルームではプレースホルダーが表示されます。",
    "sessionSettings.encryptNewDirectMessages":
        "新しいダイレクトメッセージを暗号化",
    "sessionSettings.newDmsYouStartAreEncrypted":
        "新しく開始するDMは既定で暗号化されます。既存のDMは変更されません。暗号化に対応していないクライアントを使う相手とやり取りする場合はオフにしてください。",
    "identityChange.own":
        "クロス署名キーが変更されました。暗号化されたメッセージを信頼する前に、このセッションを再検証するか、リセットして各デバイスに再署名してください。",
    "identityChange.other":
        "{user} のクロス署名IDが変更されました。新しいIDを承認するまで、その相手への暗号化メッセージは保留されます。",
    "identityChange.accept": "新しいIDを承認",
    "identityChange.withdraw": "検証を取り消す",
    "identityChange.dismiss": "ID警告を閉じる",
    "sessionSettings.excludeInsecureDevices":
        "クロス署名されていないデバイスを除外",
    "sessionSettings.excludeInsecureDevicesHelp":
        "メッセージキーを共有する相手と、表示するメッセージを、所有者がクロス署名したデバイスに限定します (MSC4153)。クロス署名されていないデバイスからのメッセージは復号できないものとして表示されます。",
    "sessionSettings.onlySendToVerifiedDevices": "検証済みのデバイスにのみ送信",
    "sessionSettings.refuseToEncryptMessagesForSessions":
        "検証していないセッション向けのメッセージは暗号化しない。そうしたセッションにはメッセージが一切届きません - 自分の未検証セッションも含みます。既定ではオフです。",
    "sessionSettings.devicesCurrentlySignedInToThis":
        "このアカウントに現在サインインしているデバイス。",
    "sessionSettings.refreshing": "更新中…",
    "sessionSettings.refresh": "更新",
    "sessionSettings.loadingSessions": "セッションを読み込み中…",
    "sessionSettings.otherSessions": "他のセッション {value}",
    "sessionSettings.noOtherSessionsYouReOnly":
        "他のセッションはありません - サインインしているのはここだけです。",
    "sessionSettings.failedToLoadSessions": "セッションを読み込めませんでした",
    "sessionSettings.failedToRenameSession":
        "セッション名を変更できませんでした",
    "sessionSettings.failedToSignOutSession":
        "セッションをサインアウトできませんでした",
    "sessionSettings.couldNotStartVerification": "検証を開始できませんでした",
    "shareLocationDialog.shareLocation": "位置情報を共有",
    "shareLocationDialog.sendOnce": "1回だけ送信",
    "shareLocationDialog.shareLive": "ライブ共有",
    "shareLocationDialog.locating": "位置を取得中…",
    "shareLocationDialog.useMyCurrentLocation": "現在地を使用",
    "shareLocationDialog.descriptionOptional": "説明（任意）",
    "shareLocationDialog.eGHomeTheCafOn": "例: 自宅、5丁目通り沿いのカフェ…",
    "shareLocationDialog.duration": "期間",
    "shareLocationDialog.yourLiveLocationIsSharedWith":
        "ライブ位置情報は、停止するかタイマーが終了するまでこのルームと共有されます。",
    "shareLocationDialog.sharing": "共有中…",
    "shareLocationDialog.share": "共有",
    "shareLocationDialog.failedToStartLiveLocation":
        "ライブ位置情報を開始できませんでした",
    "shareLocationDialog.failedToShareLocation":
        "位置情報を共有できませんでした",
    "shareTargetSheet.fileSWerenTAddedShares":
        "{droppedFiles}件のファイルは追加されませんでした。共有は{SHARE_MAX_FILES}件まで、1件あたり{value} MB、合計{value2} MBまでです。",
    "shareTargetSheet.addAMessage": "メッセージを追加…",
    "shareTargetSheet.searchRooms": "ルームを検索",
    "shareTargetSheet.noJoinedRoomsFound": "参加中のルームが見つかりません",
    "shareTargetSheet.send": "送信",
    "shareTargetSheet.shareToARoom": "ルームに共有",
    "spaceLandingPanel.loadingRooms": "ルームを読み込み中…",
    "spaceLandingPanel.browseRooms": "ルームを探す",
    "spaceLandingPanel.youHavenTJoinedARoom":
        "{spaceName} のルームにまだ参加していません。1つ選んで始めてください。",
    "spaceLandingPanel.nothingJoinedHereYet":
        "ここにはまだ参加しているものがありません",
    "spaceLandingPanel.onlyOtherSpacesLiveInsideOpen":
        "{spaceName} には他のスペースしかないため、ルーム一覧から開いてルームを探してください。",
    "spaceLandingPanel.thereAreNoRoomsInYet":
        "{spaceName} にはまだルームがありません。",
    "spaceLandingPanel.thisSpace": "このスペース",
    "spaceLandingPanel.couldnTJoinTryItFrom":
        "{value} に参加できませんでした。ルーム一覧の「ルームを探す」から試してください。",
    "spaceLandingPanel.thatRoom": "そのルーム",
    "spaceSidebar.home": "ホーム",
    "spaceSidebar.addASpace": "スペースを追加",
    "spaceSidebar.exploreRooms": "ルームを探す",
    "spaceSidebar.folderColor": "フォルダの色",
    "spaceSidebar.createRoomInSpace": "スペースにルームを作成",
    "spaceSidebar.roomName": "ルーム名",
    "spaceSidebar.myRoom": "my-room",
    "spaceSidebar.optional": "（任意）",
    "spaceSidebar.whatSThisRoomAbout": "このルームは何のためのものですか？",
    "spaceSidebar.opensStraightIntoACallMessages":
        "開くとすぐに通話に入ります。メッセージも利用できます。",
    "spaceSidebar.create": "作成",
    "spaceSidebar.addExistingRoomToSpace": "既存のルームをスペースに追加",
    "spaceSidebar.noRoomsAvailableToAdd": "追加できるルームがありません。",
    "spaceSidebar.spaceSettings": "スペース設定",
    "spaceSidebar.copySpaceLink": "スペースリンクをコピー",
    "spaceSidebar.markAsRead": "既読にする",
    "spaceSidebar.createRoom": "ルームを作成",
    "spaceSidebar.addExistingRoom": "既存のルームを追加",
    "spaceSidebar.removeFromFolder": "フォルダから削除",
    "spaceSidebar.newFolder": "新しいフォルダ",
    "spaceSidebar.clickAgainToLeave": "もう一度クリックで退出",
    "spaceSidebar.leaveSpace": "スペースを退出",
    "spaceSidebar.setColor": "色を設定",
    "spaceSidebar.dissolveFolder": "フォルダを解散",
    "spaceSidebar.somethingWentWrong": "問題が発生しました",
    "splash.restoringSession": "セッションを復元中…",
    "stickerPicker.searchStickers": "ステッカーを検索…",
    "stickerPicker.searchStickers2": "ステッカーを検索",
    "stickerPicker.noStickerPacksAvailable":
        "利用できるステッカーパックがありません",
    "stickerPicker.myStickers": "マイステッカー",
    "stickerPicker.myStickers2": "マイステッカー",
    "swfEmbed.adobeFlash": "Adobe Flash",
    "themeColorEditor.themeColors": "テーマの色",
    "themeColorEditor.presetName": "プリセット名",
    "themeColorEditor.savePreset": "プリセットを保存",
    "themeColorEditor.import": "インポート",
    "themeColorEditor.pasteThemeCode": "テーマコードを貼り付け",
    "themeColorEditor.copyCurrentPresetToClipboard":
        "現在のプリセットをクリップボードにコピー",
    "themeColorEditor.copied": "コピーしました",
    "themeColorEditor.presets": "プリセット",
    "themeColorEditor.delete": "削除しますか？",
    "themeColorEditor.confirmDelete": "{name} の削除を確認",
    "themeColorEditor.rename": "名前を変更",
    "themeColorEditor.delete2": "{name} を削除",
    "themeColorEditor.builtInPresetsAreReadOnly":
        "組み込みプリセットは読み取り専用です。カスタマイズするには複製してください:",
    "themeColorEditor.duplicateToCustomize": "複製してカスタマイズ",
    "themeColorEditor.colors": "色",
    "themeColorEditor.backgrounds": "背景",
    "themeColorEditor.resetToDefault": "既定に戻す",
    "themeColorEditor.text": "テキスト",
    "themeColorEditor.accentsSemantics": "アクセントと意味付け",
    "themeColorEditor.presence": "プレゼンス",
    "themeColorEditor.details": "詳細",
    "themeColorEditor.contrastWarnings": "コントラストの警告",
    "themeColorEditor.messageDisplay": "メッセージ表示",
    "themeColorEditor.savedOnThisDeviceOnlyNot":
        "このデバイスにのみ保存されます。アカウント間では同期されません。",
    "themeColorEditor.appTextSize": "アプリの文字サイズ: {round}%",
    "themeColorEditor.scalesAllTextAndSpacingAcross":
        "アプリ全体の文字と余白を拡大縮小します。",
    "themeColorEditor.font": "フォント",
    "themeColorEditor.custom": "カスタム - {customFontName}",
    "themeColorEditor.replaceCustomFont": "カスタムフォントを差し替え…",
    "themeColorEditor.uploadCustomFont": "カスタムフォントをアップロード…",
    "themeColorEditor.woff2TtfOrOtfUpTo":
        ".woff2、.ttf、.otf で最大10 MB。このデバイスにのみ保存されます。",
    "themeColorEditor.theQuickBrownFoxJumpsOver":
        "いろはにほへと ちりぬるを わかよたれそ つねならむ",
    "themeColorEditor.cannotSavePreset": "プリセットを保存できません",
    "themeColorEditor.notAValidThemeCode": "有効なテーマコードではありません",
    "themeColorEditor.imported": "インポートしました",
    "themeColorEditor.cannotImportPreset": "プリセットをインポートできません",
    "themeColorEditor.copy": "{activePresetName} (コピー)",
    "threadPanel.thread": "スレッド",
    "threadPanel.collapseThread": "スレッドを折りたたむ",
    "threadPanel.expandThread": "スレッドを展開",
    "threadPanel.closeThread": "スレッドを閉じる",
    "threadPanel.noRepliesYetStartTheThread":
        "まだ返信はありません。下からスレッドを始めてください。",
    "threadPanel.loadOlderReplies": "古い返信を読み込む",
    "threadsListPanel.threads": "スレッド",
    "threadsListPanel.closeThreadsPanel": "スレッドパネルを閉じる",
    "threadsListPanel.noThreadsInThisRoomYet":
        "このルームにはまだスレッドがありません。",
    "threadsListPanel.youParticipated": "参加済み",
    "threadsListPanel.unreadMentions": "未読のメンション",
    "threadsListPanel.unreadReplies": "未読の返信",
    "threadsListPanel.couldnTLoadThreadsForThis":
        "このルームのスレッドを読み込めませんでした。",
    "threadsListPanel.unknownSender": "不明",
    "threadsListPanel.allThreads": "すべてのスレッド",
    "threadsListPanel.myThreads": "自分のスレッド",
    "threadsListPanel.filterThreads": "スレッドを絞り込む",
    "threadsListPanel.noThreadsYouParticipatedIn":
        "ここで開始または返信したスレッドはありません。",
    "storageBanner.outOfStorage":
        "デバイスの空き容量がありません。空きを確保するまで、Zamはメッセージや暗号化キーを保存できません。",
    "storageBanner.lowStorage":
        "デバイスの空き容量がほとんどありません（残り {free}）。早めに空きを確保してください。そうしないとZamはメッセージや暗号化キーを保存できません。",
    "storageBanner.checkAgain": "再確認",
    "storageBanner.dismissLowStorageWarning": "容量警告を閉じる",
    "updateBanner.dismissUpdateNotification": "更新通知を閉じる",
    "updateBanner.installFailed": "インストールに失敗しました",
    "userPicker.remove": "{userId} を削除",
    "userPicker.searching": "検索中…",
    "userPicker.noMatchingUsers": "一致するユーザーはいません",
    "userPicker.available":
        "{optionCount, plural, other {#件の結果が利用可能}}",
    "userPicker.invite": "{candidateShown} を招待",
    "userPicker.alreadyAdded": "追加済み",
    "userPicker.alreadyInThisRoom": "すでにこのルームに参加しています",
    "userPicker.sendAnInviteToThisExact": "このユーザーIDに招待を送信",
    "userPicker.noMatchesTypeAFullUser": "一致なし。完全なユーザーID（例:",
    "userPicker.userServer": "@user:server",
    "userPicker.toInviteSomeoneTheDirectoryDoesn":
        "）を入力すると、ディレクトリに一覧されていない人を招待できます。",
    "userPicker.searchForPeople": "人を検索…",
    "userPicker.userSearchFailedYouCanStill":
        "ユーザー検索に失敗しました - 完全なユーザーIDを直接入力できます。",
    "userProfileCard.copyUserId": "ユーザーIDをコピー",
    "userProfileCard.copied": "コピーしました",
    "userProfileCard.localTime": "{localTime} の現地時間 ({timezone})",
    "userProfileCard.notAMemberOfThisRoom":
        "このルームのメンバーではありません",
    "userProfileCard.powerLevel": "権限レベル: {level}",
    "userProfileCard.mutualRooms": "共通のルーム: {total}",
    "userProfileCard.more": "他 {moreCount} 件",
    "userProfileCard.sessions": "セッション",
    "userProfileCard.sessionsCount": "セッション: {total}",
    "userProfileCard.refreshSessions":
        "サーバーに現在のセッションを問い合わせる",
    "userProfileCard.noKnownSessions":
        "このセッションは相手のセッションを1つも把握していないため、相手はあなたの暗号化メッセージを読めません。",
    "userProfileCard.couldNotLoadSessions":
        "相手のセッションを読み込めませんでした",
    "userProfileCard.keysChanged": "キーが変更されました",
    "userProfileCard.keysChangedHint":
        "「キーが変更されました」と表示されるセッションは、このセッションが引き継げなかった新しいキーを持っています。サインアウトしてサインインし直す必要があるかもしれません。",
    "userProfileCard.opening": "開いています…",
    "userProfileCard.message": "メッセージ",
    "userProfileCard.verifyUser": "ユーザーを検証",
    "userProfileCard.kicking": "キック中…",
    "userProfileCard.confirmKick": "キックしますか？",
    "userProfileCard.kick": "キック",
    "userProfileCard.banning": "BAN中…",
    "userProfileCard.confirmBan": "BANしますか？",
    "userProfileCard.ban": "BAN",
    "userProfileCard.couldNotStartVerification": "検証を開始できませんでした",
    "userProfileCard.couldNotCopyToClipboard":
        "クリップボードにコピーできませんでした",
    "userProfileCard.couldNotOpenDm": "DMを開けませんでした",
    "userProfileCard.couldNotKick": "キックできませんでした",
    "userProfileCard.couldNotBan": "BANできませんでした",
    "verificationModal.thisSessionIsNowTrusted":
        "このセッションは信頼済みになりました。",
    "verificationModal.theirIdentityIsNowVerified":
        "相手のIDは検証済みになりました。",
    "verificationModal.noTrustWasEstablishedYouCan":
        "信頼は確立されませんでした。いつでもやり直せます。",
    "verificationModal.didYourOtherSessionJustScan":
        "他のセッションがこのコードを今読み取りましたか？",
    "verificationModal.didJustScanThisCode":
        "{otherUserId} がこのコードを今読み取りましたか？",
    "verificationModal.onlyConfirmIfYouScannedIt":
        "自分で今スキャンした場合のみ確認してください。",
    "verificationModal.onlyConfirmIfYouWatchedThem":
        "相手が今スキャンするのを見た場合のみ確認してください。",
    "verificationModal.no": "いいえ",
    "verificationModal.yesIScannedIt": "はい、スキャンしました",
    "verificationModal.deviceWithThisUser": "このユーザーのデバイス",
    "verificationModal.confirmTheSameEmojiAppearIn":
        "他のあなたの {value} に同じ絵文字が同じ順序で表示されることを確認してください。",
    "verificationModal.theyDonTMatch": "一致しません",
    "verificationModal.confirming": "確認中…",
    "verificationModal.theyMatch": "一致します",
    "verificationModal.verificationCodeForYourOtherSession":
        "他のセッションの検証コード",
    "verificationModal.verificationCodeFor": "{otherUserId} の検証コード",
    "verificationModal.scanThisWithYourOtherSession":
        "他のセッションでこれをスキャンしてください。",
    "verificationModal.askThemToScanThisCode":
        "相手にこのコードをスキャンしてもらってください。",
    "verificationModal.noCodeToShowRightNow": "表示できるコードがありません。",
    "verificationModal.couldNotLoadTheScanner":
        "スキャナーを読み込めませんでした。",
    "verificationModal.scanAgain": "もう一度スキャン",
    "verificationModal.compareAShortListOfEmoji":
        "短い絵文字のリストを比較して検証するか、QRコードを使用してください。",
    "verificationModal.compareEmoji": "絵文字を比較",
    "verificationModal.showACodeForTheOther": "相手がスキャンするコードを表示",
    "verificationModal.scanTheirCodeWithTheCamera":
        "カメラで相手のコードをスキャン",
    "verificationModal.chooseADifferentMethod": "別の方法を選ぶ",
    "verificationModal.waitingForTheOtherSideTo": "相手の確認を待っています…",
    "verificationModal.verifyYourOtherSession": "他のセッションを検証",
    "verificationModal.verify": "{value} を検証",
    "verificationModal.couldNotConfirmTheMatch": "一致を確認できませんでした",
    "verificationModal.couldNotReportTheMismatch":
        "不一致を報告できませんでした",
    "verificationModal.session": "セッション",
    "videoTile.fullscreen": "全画面",
    "voiceAudioSettings.inputDevice": "入力デバイス",
    "voiceAudioSettings.savedMicrophoneNotFoundUsingThe":
        "保存されたマイクが見つかりません - 再び利用できるまで既定のマイクを使用します。",
    "voiceAudioSettings.microphoneLevel": "マイクのレベル",
    "voiceAudioSettings.stopTest": "テストを停止",
    "voiceAudioSettings.testMic": "マイクをテスト",
    "voiceAudioSettings.outputDevice": "出力デバイス",
    "voiceAudioSettings.chooseOutputDevice": "出力デバイスを選択…",
    "voiceAudioSettings.audioOutputIsRoutedByThe":
        "このプラットフォームでは音声出力はOSが制御します。",
    "voiceAudioSettings.testSpeaker": "スピーカーをテスト",
    "voiceAudioSettings.callVolume": "通話の音量",
    "voiceAudioSettings.incomingCallAudio": "着信音",
    "voiceAudioSettings.incomingCallAudioIfThisMoves":
        "着信音 - これが動いても何も聞こえない場合は、選択中の出力デバイスとシステム音量を確認してください。",
    "voiceAudioSettings.voiceProcessing": "音声処理",
    "voiceAudioSettings.noiseSuppression": "ノイズ抑制",
    "voiceAudioSettings.nsFastEnhancer": "FastEnhancer",
    "voiceAudioSettings.nsFastEnhancerHint":
        "デバイス上で動作しアプリに同梱されているため、ダウンロードは不要です。軽量で安定しており、声の大きさを一定に保ちます。既定の設定です。",
    "voiceAudioSettings.nsFastEnhancerUnsupported":
        "このブラウザではFastEnhancerを実行できないため、代わりにRNNoiseを使用します。",
    "voiceAudioSettings.nsRnnoise": "RNNoise",
    "voiceAudioSettings.nsRnnoiseHint":
        "デバイス上で動作しアプリに同梱されているため、ダウンロードは不要です。軽量で安定しており、声の大きさを一定に保ちます。",
    "voiceAudioSettings.nsRnnoiseUnsupported":
        "このブラウザではRNNoiseを実行できないため、代わりにブラウザ内蔵のノイズ抑制を使用します。",
    "voiceAudioSettings.nsDeepFilter": "DeepFilterNet3",
    "voiceAudioSettings.nsPluginHint":
        "プラグインによるノイズ除去で、デバイス上で動作します。実行できない場合はFastEnhancerが使われます。",
    "voiceAudioSettings.nsPluginUnavailable":
        "このノイズフィルターのプラグインが有効になっていないため、代わりにFastEnhancerを使用します。",
    "voiceAudioSettings.nsPluginCantRun":
        "このノイズフィルターはこのデバイスで実行できないため、代わりにFastEnhancerを使用します。",
    "voiceAudioSettings.nsPluginUnsupported":
        "このブラウザではノイズフィルタープラグインを実行できないため、代わりにブラウザ内蔵のノイズ抑制を使用します。",
    "voiceAudioSettings.nsPluginMissing": "プラグインフィルター（無効）",
    "voiceAudioSettings.nsBrowser": "ブラウザ",
    "voiceAudioSettings.nsOff": "オフ",
    "voiceAudioSettings.nsDeepFilterHint":
        "デバイス上で動作するAIノイズ除去です。初回使用時に約11 MBをダウンロードします。",
    "voiceAudioSettings.nsDeepFilterUnsupported":
        "このブラウザではDeepFilterNet3を実行できないため、代わりにブラウザ内蔵のノイズ抑制を使用します。",
    "voiceAudioSettings.nsBrowserHint":
        "ブラウザ内蔵のノイズ抑制です。一定の背景ノイズしか除去できません。",
    "voiceAudioSettings.nsOffHint":
        "マイクの音はノイズ除去なしで送信されます。",
    "voiceAudioSettings.echoCancellation": "エコーキャンセル",
    "voiceAudioSettings.autoGainControl": "自動ゲイン制御",
    "voiceAudioSettings.agcNormalize": "ノーマライズ",
    "voiceAudioSettings.agcNormalizeHint":
        "着信音声に適用されるのと同じ音量の均一化を、ノイズ除去後のマイクに適用します。システムのマイク音量には影響しません。",
    "voiceAudioSettings.agcZam": "AGC2",
    "voiceAudioSettings.agcBrowser": "ブラウザ",
    "voiceAudioSettings.agcOff": "オフ",
    "voiceAudioSettings.agcZamHint":
        "WebRTCのAGC2をノイズ除去後に適用します。システムのマイク音量に触れずに声の大きさを均一にします。",
    "voiceAudioSettings.agcBrowserHint":
        "ブラウザ内蔵のAGCです。システムのマイク音量が変更される場合があります。",
    "voiceAudioSettings.agcOffHint":
        "マイクの音はシステムが設定したレベルのまま送信されます。",
    "voiceAudioSettings.normalizeVoices": "声の音量を均一にする",
    "voiceAudioSettings.normalizeVoicesHint":
        "声の小さい人を自動で大きく、大きい人を小さくするので、全員の音量を手動で調整する必要がありません。",
    "voiceAudioSettings.pushToTalk": "押して話す",
    "voiceAudioSettings.pushToTalkHint":
        "通話中、押して話すキーを押している間だけマイクが送信します。",
    "voiceAudioSettings.pushToTalkNoKey":
        "押して話すにはキーの設定が必要です。",
    "voiceAudioSettings.pushToTalkSetKey": "押して話すキーを設定",
    "voiceAudioSettings.camera": "カメラ",
    "voiceAudioSettings.mirrorMyCamera": "カメラをミラー表示",
    "voiceAudioSettings.flipYourOwnPreviewOthersAlways":
        "自分のプレビューだけを反転します。他の人には反転せずに表示されます。",
    "voiceAudioSettings.cannotWatch": "再生できないビデオ",
    "voiceAudioSettings.cannotWatchHint":
        "このデバイスで何も表示されない（または真っ黒になる）コーデックを選んでください。通話の他の人はあなたにH.264を送るようになります。Zamはストリームが届いてもデコードできない場合にもこれを自動設定します。",
    "voiceAudioSettings.videoCodec": "ビデオコーデック",
    "voiceAudioSettings.videoCodecHint":
        "カメラと画面共有をどの形式で送信するかです。自動では、GPUがエンコードでき、通話の全員が再生できる最適なコーデックを選びます。再生できない人にはH.264のコピーが送られ、通話中にも切り替えられます。次にオンにしたときから適用されます。",
    "voiceAudioSettings.videoCodecAuto": "自動",
    "voiceAudioSettings.stopPreview": "プレビューを停止",
    "voiceAudioSettings.preview": "プレビュー",
    "voiceAudioSettings.callSounds": "通話サウンド",
    "voiceAudioSettings.playCallSounds": "通話サウンドを再生",
    "voiceAudioSettings.soundVolume": "音量",
    "voiceAudioSettings.ringing": "着信音",
    "voiceAudioSettings.ringForIncomingDmCalls": "着信DM通話で鳴らす",
    "voiceAudioSettings.directMessagesRingRoomsNeverDo":
        "ダイレクトメッセージは鳴ります。ルームは鳴りません - ルームはルーム自体から参加します。",
    "voiceAudioSettings.ringtoneVolume": "着信音の音量",
    "voiceAudioSettings.fullScreenCalls": "ロック画面に通話を表示",
    "voiceAudioSettings.fullScreenCallsHint":
        "着信DM通話で画面を点灯し、電話のように全画面で鳴らせるようにします。Androidでは別途許可が必要です。",
    "voiceAudioSettings.fullScreenCallsAllow": "許可",
    "voiceAudioSettings.microphoneUnavailableCheckBrowserPermissions":
        "マイクを利用できません - ブラウザの権限を確認してください",
    "voiceAudioSettings.cameraUnavailableCheckBrowserPermissions":
        "カメラを利用できません - ブラウザの権限を確認してください",
    "voiceCallPanel.enableAudio": "音声を有効にする",
    "voiceCallPanel.openCallView": "通話ビューを開く",
    "voiceCallPanel.connectionStats": "接続統計",
    "voiceCallPanel.openCall": "通話を開く",
    "voiceCallPanel.openCallWithVideo":
        "通話を開く ({n, plural, other {#件のビデオ}})",
    "voiceCallPanel.sharingYourScreen": "画面を共有中",
    "voiceCallPanel.shareQuality": "画面共有の品質",
    "voiceCallPanel.stop": "停止",
    "callStats.title": "通話の接続",
    "callStats.copyJson": "JSONとしてコピー",
    "callStats.copied": "通話統計をコピーしました",
    "callStats.copyFailed": "コピーできませんでした",
    "callStats.loading": "計測中...",
    "callStats.notInCall": "通話に参加していません",
    "callStats.tcpWarning":
        "メディアがTCP経由で流れています。パケットが失われると、再送されるまで後続がすべて止まり、音声の遅れや同期ずれとして現れます。通常はファイアウォールかネットワークがUDPを遮断していることが原因です。",
    "callStats.serverSwitchedTcp":
        "通話サーバーがこのデバイスをTCPに切り替えました。このデバイスにはUDPを提供しなくなっています。UDP接続が失敗または切断してもシグナリングが動作し続けた場合にそうなり、この通話の間は記憶されるため、このデバイスから再接続するとしばらくTCPのままです。ネットワークがUDPを問題なく通せる場合もあり、ファイアウォールによる遮断とは異なります。",
    "callStats.serverCandidates": "サーバー候補",
    "callStats.serverCandidatesNoUdp": "TCPのみ（サーバーによる切り替え）",
    "callStats.publishing": "配信中",
    "callStats.listening": "受信中",
    "callStats.signalRtt": "シグナリングのping",
    "callStats.yourQuality": "あなたの接続",
    "callStats.sending": "送信",
    "callStats.receiving": "受信",
    "callStats.participant": "参加者",
    "callStats.theirQuality": "相手の接続",
    "callStats.loss": "損失",
    "callStats.jitter": "ジッター",
    "callStats.buffer": "バッファ",
    "callStats.legend":
        "「相手の接続」はサーバーが判定したその人の回線の評価なので、評価が低い場合はあなたではなく相手のネットワークが原因です。損失とジッターは、直近1秒間にあなたに届いた相手の音声に関する値です。",
    "callStats.noTransport": "未接続",
    "callStats.video": "ビデオ",
    "callStats.videoChecking": "確認中…",
    "callStats.videoSending": "送信中",
    "callStats.videoNotSending": "まだ送信されていません",
    "callStats.videoCaptureEnded": "キャプチャ停止: 再開してください",
    "callStats.videoCaptureStalled":
        "新しいフレームがありません: 共有中のウィンドウが最小化または隠れているか、カメラが使用中の可能性があります",
    "callStats.videoPlaying": "再生中",
    "callStats.videoNotSubscribed": "まだ受信していません",
    "callStats.videoHiddenByYou": "あなたが非表示にしています",
    "callStats.videoTurnedOff": "相手がオフにしています",
    "callStats.videoPausedByServer":
        "通話サーバーが一時停止中: 現在の接続では受信できません",
    "callStats.videoNoPackets":
        "何も届いていません: 相手の送信側か、あなたの接続を確認してください",
    "callStats.videoCantDecrypt":
        "届いていますが復号できません: どちらかが古いZamを使っているか、キーがまだ届いていない可能性があります",
    "callStats.videoCantDecode":
        "届いていますがこのデバイスではデコードできません: 画面共有の品質メニューで別のビデオコーデックを試してください",
    "callStats.videoNotShown":
        "受信済みですが画面に表示されていません: 通話ビューを開いて視聴してください",
    "callStats.videoNotPainting":
        "デコード済みですが描画されていません: 通話ビューを閉じて開き直してください",
    "callStats.capture": "キャプチャ",
    "callStats.framesArrivedDecoded": "到着 / デコード済みフレーム",
    "callStats.framesEncoded": "エンコード済みフレーム",
    "callStats.onScreen": "画面表示",
    "callStats.onScreenNo": "なし",
    "callStats.onScreenNoPicture": "まだ映像なし",
    "callStats.decryptErrors": "復号エラー",
    "callStats.trackState": "トラック",
    "callStats.trackNoFrames": "現在フレームなし",
    "callStats.proxyRoute": "プロキシ",
    "callStats.routeSignalling": "通話サーバーへの接続",
    "callStats.routeSending": "送信メディア",
    "callStats.routeReceiving": "受信メディア",
    "callStats.routeDirect": "直接",
    "callStats.routeProxy": "{proxy} 経由",
    "callStats.path": "経路",
    "callStats.iceRtt": "ICEのping",
    "callStats.mediaRtt": "メディアのping",
    "callStats.upload": "アップロード",
    "callStats.download": "ダウンロード",
    "callStats.availableUpload": "利用可能なアップロード",
    "callStats.outgoingLoss": "送信の損失",
    "callStats.remoteAddress": "サーバーアドレス",
    "callStats.candidates": "候補",
    "callStats.pathUdp": "UDP（直接）",
    "callStats.pathTcp": "TCP",
    "callStats.pathRelayUdp": "TURNリレー（UDP）",
    "callStats.pathRelayTcp": "TURNリレー（TCP）",
    "callStats.pathRelayTls": "TURNリレー（TLS）",
    "callStats.pathUnknown": "不明",
    "callStats.qualityExcellent": "最良",
    "callStats.qualityGood": "良好",
    "callStats.qualityPoor": "不良",
    "callStats.qualityLost": "切断",
    "callStats.qualityUnknown": "不明",
    "callStats.streams": "メディアストリーム",
    "callStats.you": "あなた",
    "callStats.sourceMicrophone": "マイク",
    "callStats.sourceCamera": "カメラ",
    "callStats.sourceScreenShare": "画面共有",
    "callStats.sourceScreenShareAudio": "画面共有の音声",
    "callStats.sourceUnknown": "その他のトラック",
    "callStats.sent": "送信済み",
    "callStats.received": "受信済み",
    "callStats.layer": "レイヤー {rid}",
    "callStats.codec": "コーデック",
    "callStats.codecOptions": "コーデックオプション",
    "callStats.bitrate": "ビットレート",
    "callStats.bitrateTarget": "最大 {target} 中 {rate}",
    "callStats.packetDuration": "1パケットあたりの音声",
    "callStats.resolution": "解像度",
    "callStats.encoder": "エンコーダー",
    "callStats.decoder": "デコーダー",
    "callStats.hardware": "ハードウェア",
    "callStats.software": "ソフトウェア",
    "callStats.limitedBy": "制限要因",
    "callStats.limitCpu": "CPU",
    "callStats.limitBandwidth": "帯域幅",
    "callStats.limitNone": "なし",
    "callStats.limitOther": "その他",
    "callStats.frameTime": "1フレームあたりの時間",
    "callStats.resent": "再送",
    "callStats.droppedFrames": "ドロップしたフレーム",
    "callStats.nackPli": "NACK / PLI",
    "callStats.softwareEncodeHint":
        "ビデオはソフトウェアでエンコードされているため、CPUを消費し、負荷が高いとフレームが落ちることがあります。設定 > デバッグでハードウェアビデオエンコードが利用できるか確認できます（機能ステータスの video_encode）。",
    "callStats.cpuLimitHint":
        "CPUが追いつかないため、ビデオエンコーダーが品質を下げています。",
    "voiceCallPanel.unmute": "ミュート解除",
    "voiceCallPanel.undeafen": "スピーカーミュートを解除",
    "voiceCallPanel.deafen": "スピーカーをミュート",
    "voiceCallPanel.disconnect": "切断",
    "voiceMessagePlayer.seek": "シーク",
    "voiceMessagePlayer.voiceMessage": "ボイスメッセージ",
    "voiceRecorder.cancelRecording": "録音をキャンセル",
    "voiceRecorder.stop": "停止",
    "voiceRecorder.discard": "破棄",
    "voiceRecorder.discardRecording": "録音を破棄",
    "voiceRecorder.voiceMessage": "ボイスメッセージ",
    "voiceRecorder.sending": "送信中…",
    "voiceRecorder.send": "送信",
    "voiceRecorder.microphoneAccessWasDenied":
        "マイクへのアクセスが拒否されました。",
    "voiceRecorder.recordingFailed": "録音に失敗しました。",
    "voiceRecorder.nothingWasRecorded": "何も録音されていません。",
    "voiceRecorder.failedToSendVoiceMessage":
        "ボイスメッセージを送信できませんでした",
    "whatsNew.whatSNew": "新機能",
    "whatsNew.loadingReleaseNotes": "リリースノートを読み込み中…",
    "whatsNew.releaseNotesUnavailable": "リリースノートを取得できません。",
    "whatsNew.viewOnGithub": "GitHub で見る",
    "whatsNewModal.whatSNew": "新機能",
    "whatsNewModal.whatSNewSince": "v{from} 以降の新機能",
    "whatsNewModal.whatSNewInV": "v{APP_VERSION} の新機能",
    "whatsNewModal.releaseNotesUnavailable": "リリースノートを取得できません。",
    "whatsNewModal.viewOnGithub": "GitHub で見る",
    "whatsNewModal.gotIt": "了解",
    "verificationRequestCard.verifyYourOtherSession": "別のセッションを検証",
    "verificationRequestCard.verificationRequest": "検証リクエスト",
    "verificationRequestCard.anotherOfYourSessions": "あなたの別のセッション",
    "callEventCard.missedCall": "不在着信",
    "callEventCard.ongoingCall": "通話中",
    "callEventCard.callEnded": "通話終了",
    "composerActionsMenu.uploadAFile": "ファイルをアップロード",
    "composerActionsMenu.createPoll": "投票を作成",
    "composerActionsMenu.recordVoiceMessage": "ボイスメッセージを録音",
    "composerActionsMenu.shareLocation": "位置情報を共有",
    "composerActionsMenu.createThread": "スレッドを作成",
    "reactions.couldNotAddReaction": "リアクションを追加できませんでした",
    "qrScanner.startingTheCamera": "カメラを起動中…",
    "qrScanner.cameraAccessWasDenied": "カメラへのアクセスが拒否されました。",
    "qrScanner.noCameraWasFoundOnThis":
        "このデバイスにカメラが見つかりません。",
    "qrScanner.theCameraIsAlreadyInUse": "カメラは別のアプリで使用中です。",
    "qrScanner.couldNotOpenTheCameraA":
        "カメラを開けませんでした。安全な(https)接続が必要です。",
    "qrScanner.codeFoundCheckingIt": "コードを検出 - 確認中…",
    "qrScanner.couldNotStartVerificationWithThat":
        "そのコードでは検証を開始できませんでした。",
    "qrScanner.thatIsnTAVerificationCode": "検証コードではありません。",
    "qrScanner.thisDeviceHasNoCameraAvailable":
        "このデバイスには利用できるカメラがありません。",
    "qrScanner.couldNotStartTheCameraPreview":
        "カメラプレビューを開始できませんでした。",
    "qrScanner.pointTheCameraAtTheirCode":
        "相手のコードにカメラを向けてください。",
    "desktopContextMenu.failedToSaveImage": "画像を保存できませんでした",
    "client.serverAutoDiscoveryFailedUsingThe":
        "サーバーの自動検出に失敗 - 入力したアドレスを使用します",
    "client.discoveredHomeserverFailedValidation":
        "検出されたホームサーバーが検証に失敗しました",
    "client.thisHomeserverDoesnTSupportSliding":
        "このホームサーバーはsliding syncに対応していないため、代わりに従来のsyncを使用します。",
    "client.notLoggedIn": "ログインしていません",
    "client.oauthProviderChanged":
        "サーバーのサインイン方式が変更されました。もう一度お試しください。",
    "client.thisEventTypeCannotBeForwarded":
        "この種類のイベントは転送できません",
    "client.notConnected": "接続していません",
    "client.thisServerDoesNotAllowSigning":
        "このサーバーはパスワードによるセッションのサインアウトを許可していません。代わりにアカウントページを使用してください。",
    "client.incorrectPassword": "パスワードが違います",
    "client.thisServerDoesNotAllowConfirming":
        "このサーバーはパスワードによる確認を許可していません。代わりにアカウントページを使用してください。",
    "client.directMessages": "ダイレクトメッセージ",
    "client.messagesInDirectMessageRooms":
        "ダイレクトメッセージルーム内のメッセージ",
    "client.rooms": "ルーム",
    "client.messagesInAllOtherRooms": "その他すべてのルーム内のメッセージ",
    "client.fullMatrixIdMentions": "完全なMatrix IDでのメンション",
    "client.messagesUsingYourFullUserHomeserver":
        "完全な @user:homeserver IDを含むメッセージ",
    "client.displayNameMentions": "表示名でのメンション",
    "client.messagesContainingYourDisplayName":
        "あなたの表示名を含むメッセージ",
    "client.usernameMentions": "ユーザー名でのメンション",
    "client.messagesContainingYourUsernameWithoutServer":
        "あなたのユーザー名(サーバー部分なし)を含むメッセージ",
    "client.roomMentions": "@room メンション",
    "client.messagesUsingRoomToNotifyEveryone":
        "@room で全員に通知するメッセージ",
    "client.invitations": "招待",
    "client.whenYouAreInvitedToA": "ルームに招待されたとき",
    "client.thisRoom": "このルーム",
    "client.keywordCannotStartWith": "キーワードは「.」で始められません",
    "client.emotes": "{value} 絵文字",
    "client.room": "ルーム",
    "client.emojis": "絵文字",
    "client.enterAShortcode": "ショートコードを入力してください。",
    "client.useOnlyLettersNumbersDotsUnderscores":
        "使用できるのは英数字、ドット、アンダースコア、プラス、ハイフンのみです。",
    "client.chooseAtLeastOneUsage": "用途を1つ以上選択してください。",
    "client.imageNotFound": "画像が見つかりません。",
    "client.noPermissionToEditPack": "このパックを編集する権限がありません。",
    "client.invalidPowerLevels": "無効な権限レベル: {shapeError}",
    "client.roomCreatorsPowerLevelCannotBe":
        "v12ルームではルーム作成者の権限レベルを設定できません",
    "client.restrictedJoinRequiresAtLeastOne":
        "制限付き参加には少なくとも1つの親スペースが必要です",
    "client.orderMustBeAtMost50":
        "並び順は印刷可能なASCII文字50文字以内(スペース〜~)にしてください",
    "client.cannotSetSuggestedOnASpace":
        "via のないスペース子要素には「おすすめ」を設定できません",
    "client.pollHasNoEventId": "投票にイベントIDがありません",
    "client.unsupportedPoll": "サポートされていない投票です",
    "client.youCanTCloseThisPoll": "この投票は締め切れません",
    "client.microphoneDisconnectedSwitchedToTheDefault":
        "マイクが切断されました - デフォルトのデバイスに切り替えました",
    "client.cameraDisconnected": "カメラが切断されました",
    "client.unknownRoom": "不明なルーム",
    "client.theServerRejectedItYouMay":
        "サーバーが拒否しました - このルームで通話に参加する権限がない可能性があります",
    "client.callMembershipFailed": "通話への参加に失敗しました: {detail}",
    "client.voiceServerRejectedTheJoin":
        "音声サーバーが参加を拒否しました({status})",
    "client.voiceCallDisconnected": "音声通話が切断されました",
    "client.couldNotReachCallServer":
        "{server} に接続できませんでした。この通話の一部の音声が聞こえない可能性があります。",
    "client.yourMicrophoneAppearsSilentCheckYour":
        "マイクが無音のようです - 入力デバイスを確認してください",
    "client.audioDeviceError": "音声デバイスのエラー: {message}",
    "client.couldnTSwitchToThatKept":
        "{what} に切り替えられませんでした - 以前のものを維持します",
    "client.couldnTSwitchToThatUsing":
        "{what} に切り替えられませんでした - デフォルトのデバイスを使用します",
    "client.couldnTSwitchToThatPick":
        "{what} に切り替えられませんでした - 別のデバイスを選択してください",
    "client.encryptedCallsUnsupported":
        "この通話はエンドツーエンド暗号化されていますが、このブラウザは通話メディアを暗号化できません。最新のChrome、Firefox、Safari、またはデスクトップアプリをお試しください。",
    "client.codecCouldNotBeDecoded":
        "このデバイスは {codec} 映像をデコードできません。代わりにH.264を要求します。",
    "client.couldNotSwitchVideoCodec":
        "映像コーデックを切り替えられませんでした",
    "client.couldNotStartScreenShare": "画面共有を開始できませんでした",
    "client.couldNotShareScreenAudio": "画面共有を音声なしで開始しました",
    "client.couldnTChangeScreenShareQuality":
        "画面共有の品質を変更できませんでした",
    "client.couldNotStartTheCameraCheck":
        "カメラを起動できませんでした - 権限を確認してください",
    "client.couldnTApplyAudioProcessingChange":
        "音声処理の変更を適用できませんでした({error})",
    "client.deviceNounMicrophone": "マイク",
    "client.deviceNounCamera": "カメラ",
    "crypto.couldNotStartTheEmojiCheck": "絵文字の照合を開始できませんでした",
    "crypto.couldNotCancelTheVerification": "検証をキャンセルできませんでした",
    "crypto.noCodeAvailableTheOtherSide":
        "利用できるコードがありません - 相手がコードを読み取れません。",
    "crypto.couldNotGenerateAQrCode": "QRコードを生成できませんでした",
    "crypto.thatCodeDoesnTMatchThis": "そのコードはこの検証と一致しません",
    "crypto.couldNotConfirmTheQrMatch": "QRコードの一致を確認できませんでした",
    "crypto.couldNotCancelTheQrMatch":
        "QRコードの照合をキャンセルできませんでした",
    "crypto.encryptionIsNotReadyOnThis":
        "このセッションでは暗号化の準備ができていません",
    "crypto.roomIsNotEncrypted": "このルームは暗号化されていません。",
    "crypto.roomKeyDiscarded":
        "次にここへ送るメッセージは新しいルームキーを使い、再びルーム内のすべてのセッションと共有されます。",
    "crypto.encryptionDataLost":
        "このセッションの暗号化データが失われた(ブラウザデータの消去または再インストール)ため、もう持っていない鍵への暗号化を防ぐためにサインアウトしました。もう一度サインインしてください。",
    "crypto.accountApprovalCancelled":
        "アカウントページでの承認がキャンセルされました。",
    "crypto.accountPasswordRequired":
        "このサーバーではこれを確認するためにアカウントのパスワードが必要です。",
    "crypto.thisServerCanTConfirmEncryption":
        "このサーバーはパスワードによる暗号化設定の確認に対応していません。代わりにアカウントページを使用してください。",
    "crypto.incorrectPassword": "パスワードが違います",
    "crypto.failedToGenerateARecoveryKey": "リカバリーキーの生成に失敗しました",
    "crypto.yourOldRecoveryWasResetBut":
        "古いリカバリーはリセットされましたが、新しいリカバリーの設定に失敗しました。",
    "crypto.thatKeyDoesnTMatchThis":
        "そのキーはサーバー上のこのアカウントのバックアップと一致しません。",
    "crypto.thatDoesnTLookLikeA":
        "有効なリカバリーキーではないようです。入力ミスを確認してもう一度お試しください。",
    "crypto.thisAccountHasNoRecoverySet":
        "このアカウントにはまだリカバリーが設定されていません。まず鍵を持っているセッションでリカバリーを設定してください。",
    "crypto.thatRecoveryKeyDoesnTMatch":
        "そのリカバリーキーはこのアカウントと一致しません。入力ミスを確認してもう一度お試しください。",
    "crypto.thisAccountSRecoveryWasnT":
        "このアカウントのリカバリーはパスフレーズで設定されていません。代わりにリカバリーキーを使用してください。",
    "crypto.couldnTUseYourPassphraseOn":
        "このデバイスではパスフレーズを使用できませんでした。代わりにリカバリーキーをお試しください。",
    "crypto.thatPassphraseDoesnTMatchThis":
        "そのパスフレーズはこのアカウントと一致しません。入力ミスを確認してもう一度お試しください。",
    "media.notLoggedIn": "ログインしていません",
    "media.failedToFetchAttachment":
        "添付ファイルを取得できませんでした: {status}",
    "media.encryptedAttachmentHasAnInvalidUrl":
        "暗号化された添付ファイルのURLが無効です",
    "media.failedToFetchEncryptedAttachment":
        "暗号化された添付ファイルを取得できませんでした: {status}",
    "pluginHost.mediaWasUploadedByADifferent":
        "メディアは別のアカウントによってアップロードされました",
    "pluginHost.notLoggedIn": "ログインしていません",
    "pluginHost.notConnected": "接続していません",
    "runtime.notLoggedIn": "ログインしていません",
    "doubleTapReply.doubleTapSwipeActions": "ダブルタップとスワイプの操作",
    "doubleTapReply.doubleTapAMessageToReply":
        "メッセージをダブルタップして返信・リアクション・編集、または左にスワイプして返信/編集します。",
    "doubleTapReply.doubleTapYourMessages": "自分のメッセージをダブルタップ",
    "doubleTapReply.nothing": "なし",
    "doubleTapReply.reaction": "リアクション",
    "doubleTapReply.reply": "返信",
    "doubleTapReply.edit": "編集",
    "doubleTapReply.doubleTapOtherMessages": "他の人のメッセージをダブルタップ",
    "doubleTapReply.reactionEmoji": "リアクションの絵文字",
    "doubleTapReply.sentWhenADoubleTapAction":
        "ダブルタップの動作が「リアクション」に設定されているときに送信されます。",
    "doubleTapReply.swipeToReplyEdit": "スワイプで返信/編集",
    "doubleTapReply.swipeAMessageLeftToReply":
        "メッセージを左にスワイプして返信、自分のメッセージはさらにスワイプして編集します。",
    "doubleTapReply.failedToReact": "リアクションできませんでした",
    "slashFun.sendAnActionMessage": "アクションメッセージを送信",
    "slashFun.appendToYourMessage": "メッセージに ¯\\_(ツ)_/¯ を追加",
    "slashFun.appendToYourMessage2": "メッセージに (╯°□°)╯︵ ┻━┻ を追加",
    "slashFun.appendToYourMessage3": "メッセージに ┬─┬ ノ( ゜-゜ノ) を追加",
    "slashFun.appendToYourMessage4": "メッセージに ( ͡° ͜ʖ ͡°) を追加",
    "slashFun.sendYourMessageAsASpoiler": "メッセージをスポイラーとして送信",
    "slashFun.sendYourMessageWithoutMarkdownFormatting":
        "メッセージをMarkdown書式なしで送信",
    "slashFun.funSlashCommands": "おもしろスラッシュコマンド",
    "slashFun.noveltySlashCommandsMeShrugTableflip":
        "ネタ用スラッシュコマンド: /me, /shrug, /tableflip, /unflip, /lenny, /spoiler, /plain。",
    "textReplacer.textReplacer": "テキスト置換",
    "textReplacer.applyYourOwnStringOrRegex":
        "送信メッセージのテキストに独自の文字列または正規表現の置換を適用します。",
    "textReplacer.replacementRules": "置換ルール",
    "textReplacer.appliedToYourOutgoingMessageText":
        "送信メッセージのテキストに順番に適用されます。受信者には通常のテキストが表示されます。",
    "textReplacer.find": "検索",
    "textReplacer.textOrPattern": "テキストまたはパターン",
    "textReplacer.replaceWith": "置換後",
    "textReplacer.regex": "正規表現",
    "textReplacer.ignoreCase": "大文字と小文字を区別しない",
    "previewRewriter.name": "リンクプレビューの書き換え",
    "previewRewriter.description":
        "別のアドレス(ホームサーバーから到達できないサイトのミラーなど)からリンクプレビューを取得します。",
    "previewRewriter.rules": "書き換えルール",
    "previewRewriter.rulesDescription":
        "プレビューの取得先アドレスに順番に適用されます。リンク自体は変更されません。",
    "pluginBoot.noPluginSyncDataOnYour":
        "アカウントにまだプラグインの同期データがありません。",
    "pluginBoot.theSyncDataOnYourAccount":
        "アカウントの同期データが壊れています。",
    "pluginBoot.autoUpdateFailed": "自動更新に失敗しました: {value}",
    "pluginPin.pluginIdMismatchIndexListsManifest":
        "プラグインIDの不一致: インデックスは「{entryId}」、マニフェストは「{manifestId}」を宣言しています",
    "pluginPin.cannotInstallPluginWithIdIt":
        "ID「{manifestId}」のプラグインはインストールできません: 組み込みプラグインです",
    "pluginPin.pluginIsAlreadyInstalledFromA":
        "プラグイン「{manifestId}」は別のリポジトリからすでにインストールされています",
    "repo.repoReferenceMustBeAString":
        "リポジトリ参照は文字列である必要があります",
    "repo.repoReferenceCannotBeEmpty": "リポジトリ参照は空にできません",
    "repo.branchCannotBeEmpty": "ブランチは空にできません",
    "repo.branchCannotContain": "ブランチに「..」を含めることはできません",
    "repo.invalidRepoReferenceExtraPathSegments":
        "無効なリポジトリ参照: 余分なパスセグメントがあります(/tree/<branch> ではありません)",
    "repo.invalidRepoReferenceMustBeOwner":
        "無効なリポジトリ参照: owner/repo の形式である必要があります",
    "repo.ownerCannotBeEmpty": "オーナーは空にできません",
    "repo.invalidOwnerMustMatchAZa":
        "無効なオーナー: [A-Za-z0-9][A-Za-z0-9._-]* に一致する必要があります",
    "repo.repoCannotBeEmpty": "リポジトリは空にできません",
    "repo.invalidRepoMustMatchAZa":
        "無効なリポジトリ: [A-Za-z0-9][A-Za-z0-9._-]* に一致する必要があります",
    "repoList.enterARepoOwnerRepoOr":
        "リポジトリを入力してください(owner/repo または GitHub URL)。",
    "repoList.thatIsTheOfficialRepoAlready":
        "それは公式リポジトリです(すでに含まれています)。",
    "repoList.thatRepoIsAlreadyAdded":
        "そのリポジトリはすでに追加されています。",
    "gifSearch.couldnTReachKlipyTryAgain":
        "KLIPY に接続できませんでした - もう一度お試しください。",
    "liveLocation.youCanTShareLiveLocation":
        "このルームではライブ位置情報を共有できません。",
    "liveLocation.couldnTStartLiveLocation":
        "ライブ位置情報を開始できませんでした",
    "liveLocation.expired": "期限切れ",
    "liveLocation.lessThanAMinuteLeft": "残り1分未満",
    "liveLocation.minLeft": "残り {totalMin} 分",
    "liveLocation.hLeft": "残り {h} 時間",
    "liveLocation.hMinLeft": "残り {h} 時間 {m} 分",
    "liveLocation.justNow": "たった今",
    "liveLocation.sAgo": "{floor} 秒前",
    "liveLocation.minAgo": "{floor} 分前",
    "liveLocation.hAgo": "{floor} 時間前",
    "liveLocation.n15Minutes": "15分",
    "liveLocation.n1Hour": "1時間",
    "liveLocation.n8Hours": "8時間",
    "outbox.failedToSend": "送信できませんでした",
    "settings.couldNotReadThatFile": "そのファイルを読み込めませんでした。",
    "settings.thatFileIsnTAValid":
        "そのファイルは有効なフォントではありません。",
    "settings.fontCouldnTBeSavedOn":
        "フォントをこのデバイスに保存できませんでした。",
    "settings.cannotSaveAPresetWithBuilt":
        "組み込み名ではプリセットを保存できません: {name}",
    "shareInbox.youReOfflineTheShareWas":
        "オフラインです: 共有内容を入力欄に追加しました",
    "shareInbox.couldnTSendTheShare": "共有を送信できませんでした",
    "verification.finishingAnotherVerificationFirstTryAgain":
        "別の検証を完了しています。もう一度お試しください。",
    "verification.waitingForTheOtherSideTo": "相手が承認するのを待っています…",
    "verification.acceptedSettingUpTheCheck": "承認されました - 照合を設定中…",
    "verification.verifying": "検証中…",
    "verification.sessionVerified": "セッションを検証しました",
    "verification.userVerified": "ユーザーを検証しました",
    "verification.verificationCancelled": "検証はキャンセルされました",
    "verification.verified": "検証済み",
    "verification.unverified": "未検証",
    "verification.signedByYou": "あなたが署名済み",
    "verification.notSignedByOwner": "オーナーによる署名なし",
    "verification.verifyWithAnotherDevice": "別のデバイスで検証",
    "verification.useAnotherDevice": "別のデバイスを使用",
    "verification.couldNotSendVerificationRequest":
        "検証リクエストを送信できませんでした",
    "verification.sessionNotKnownYet":
        "このセッションはまだ相手のセッションを認識していません。数秒待ってからもう一度お試しになるか、新しいセッションから検証を開始してください。",
    "verification.accountHasNoIdentity":
        "アカウントのクロス署名鍵がサーバーにないため、他のセッションからこのセッションを検証できません。リカバリーを設定したセッションで 設定 > セキュリティと暗号化 を開き、鍵のアップロードを求められたら実行してください。リカバリーを設定していない場合は、いずれかのセッションで設定してください。",
    "verification.sessionHasNoKeys":
        "そのセッションは暗号化鍵を公開していないため、検証も暗号化メッセージの受信もできません。サインアウトしてサインインし直してください。",
    "verification.sessionKeysRejected":
        "そのセッションの暗号化鍵はこのセッションで拒否されました。サインアウトしてサインインし直してください。",
    "verification.identityChanged": "識別情報が変更されました",
    "verification.couldnTAcceptThisRequestTry":
        "このリクエストを承認できませんでした。もう一度お試しください。",
    "voiceCall.couldnTLoadTheCallComponent":
        "通話コンポーネントを読み込めませんでした。接続を確認してから、ページを再読み込みしてお試しください。",
    "voiceCall.couldNotJoinTheVoiceCall": "音声通話に参加できませんでした",
    "voiceCall.couldNotMuteYourMicrophone": "マイクをミュートできませんでした",
    "voiceCall.couldNotUnmuteYourMicrophoneCheck":
        "マイクのミュートを解除できませんでした - 入力デバイスを確認してください",
    "voiceCall.connecting": "接続中…",
    "voiceCall.startedSharing": "{name} さんが画面を共有しています",
    "voiceCall.watch": "視聴",
    "voiceCall.voiceConnected": "音声接続済み",
    "voiceCall.reconnecting": "再接続中…",
    "voiceCall.gpuGivenUp":
        "グラフィックが繰り返しクラッシュしたため、Zam を再起動するまでGPUを無効にし、映像はソフトウェアでエンコードします。",
    "voiceCall.gpuRecovered":
        "グラフィックが再起動したため、GPUでの映像エンコードを維持するために通話を再接続しました。",
    "voiceCall.gpuRecoveryFailed":
        "復旧直後にグラフィックが再びクラッシュしたため、映像はソフトウェアでエンコードしています。GPUを再び使うには再読み込みしてください。",
    "voiceCall.restartZam": "Zam を再起動",
    "voiceCall.reload": "再読み込み",
    "voiceCall.youWereBannedFromThisRoom":
        "このルームからBANされました - 通話を終了しました",
    "voiceCall.youLeftThisRoomCallEnded":
        "このルームを退出しました - 通話を終了しました",
    "voiceCall.youWereRemovedFromThisRoom":
        "このルームから削除されました - 通話を終了しました",
    "update.noReleasesFoundYet": "リリースがまだ見つかりません。",
    "update.githubApiError": "GitHub APIエラー({status})。",
    "update.couldNotReadTheLatestVersion":
        "最新バージョンを取得できませんでした。",
    "accountSecurity.enterYourCurrentPassword":
        "現在のパスワードを入力してください。",
    "accountSecurity.enterANewPassword": "新しいパスワードを入力してください。",
    "accountSecurity.newPasswordMustBeAtLeast":
        "新しいパスワードは8文字以上にしてください。",
    "accountSecurity.newPasswordMustBeDifferentFrom":
        "新しいパスワードは現在のパスワードと異なる必要があります。",
    "accountSecurity.passwordsDoNotMatch": "パスワードが一致しません。",
    "activeSession.offAlwaysNotify": "オフ - 常に通知",
    "activeSession.n15Seconds": "15秒",
    "activeSession.n30Seconds": "30秒",
    "activeSession.n1Minute": "1分",
    "activeSession.n2Minutes": "2分",
    "activeSession.n5Minutes": "5分",
    "activeSession.n10Minutes": "10分",
    "activeSession.n30Minutes": "30分",
    "activeSession.enterANumberOfMinutes": "分数を入力してください。",
    "activeSession.chooseAtLeast1MinuteUse":
        "1分以上を選んでください - それより短い場合は上のリストを使用してください。",
    "activeSession.chooseMinutes2HoursOrLess":
        "{MAX_CUSTOM_GRACE_MINUTES} 分(2時間)以下を選んでください。",
    "audioDevices.microphone": "マイク",
    "audioDevices.speaker": "スピーカー",
    "audioDevices.camera": "カメラ",
    "audioPlayback.failedToLoadRetry": "読み込みに失敗しました · 再試行",
    "audioPlayback.clickToPlay": "クリックして再生",
    "clientGeneration.sessionChangedBeforeTheOperationFinished":
        "操作が完了する前にセッションが変更されました",
    "customFont.useAWoff2TtfOrOtf":
        ".woff2、.ttf、.otf のフォントファイルを使用してください。",
    "customFont.thatFontFileIsEmpty": "そのフォントファイルは空です。",
    "customFont.fontFileIsTooLargeMax":
        "フォントファイルが大きすぎます(最大10 MB)。",
    "customFont.customFont": "カスタムフォント",
    "deviceSessions.unknown": "不明",
    "deviceSessions.justNow": "たった今",
    "deviceSessions.desktopApp": "デスクトップアプリ",
    "deviceSessions.on": "{os} 上の {client}",
    "deviceSessions.minutesAgo": "{count, plural, other {#分前}}",
    "deviceSessions.hoursAgo": "{count, plural, other {#時間前}}",
    "deviceSessions.daysAgo": "{count, plural, other {#日前}}",
    "displaySources.screen": "画面",
    "displaySources.untitledWindow": "無題のウインドウ",
    "encryptionState.unableToDecryptYouMayNot":
        "復号できません - このメッセージの鍵を持っていない可能性があります。",
    "encryptionState.theSenderChoseNotToShare":
        "送信者がこのメッセージの鍵を共有しないことを選択しました。",
    "encryptionState.theSenderDidNotShareThe":
        "このデバイスが未検証のため、送信者は鍵を共有しませんでした。このようなメッセージを読むにはこのデバイスを検証してください。",
    "encryptionState.senderDeviceNotCrossSigned":
        "送信者のデバイスはオーナーによるクロス署名がないため、このメッセージは非表示です。相手にそのセッションの検証を依頼してください。",
    "encryptionState.senderDeviceUnknown":
        "このメッセージは送信者の既知のデバイスと関連付けられないため、非表示です。",
    "encryptionState.senderIdentityChanged":
        "検証した後に送信者の識別情報が変更されたため、このメッセージは非表示です。読むにはもう一度検証してください。",
    "encryptionState.historicalNoBackup":
        "このメッセージはこのデバイスがサインインする前に送信されたもので、復元元のキーバックアップがありません。",
    "encryptionState.historicalBackupUnconfigured":
        "このメッセージはこのデバイスがサインインする前に送信されました。リカバリーキーを入力してキーバックアップから復元してください。",
    "encryptionState.historicalWorkingBackup":
        "このメッセージはこのデバイスがサインインする前に送信され、キーバックアップ内で見つかりませんでした。",
    "encryptionState.historicalNotJoined":
        "このメッセージはあなたがルームにいない間に送信されました。",
    "encryptionState.encryptedMessage": "🔒 暗号化されたメッセージ",
    "eventShield.thisMessageSEncryptionCouldNot":
        "このメッセージの暗号化は完全には検証できませんでした。",
    "eventShield.encryptedByAnUnverifiedUser":
        "未検証のユーザーによる暗号化です。",
    "eventShield.encryptedByADeviceNotVerified":
        "オーナーが検証していないデバイスによる暗号化です。",
    "eventShield.encryptedByAnUnknownOrDeleted":
        "不明または削除済みのデバイスによる暗号化です。",
    "eventShield.theAuthenticityOfThisEncryptedMessage":
        "この暗号化メッセージの真正性はこのデバイスでは保証できません。",
    "eventShield.theSenderWasPreviouslyVerifiedBut":
        "送信者は以前に検証されましたが、識別情報が変更されました。",
    "eventShield.theSenderDoesnTMatchThe":
        "送信者が、このメッセージを送ったデバイスのオーナーと一致しません。",
    "extendedProfile.aStatusNeedsBothAnEmoji":
        "ステータスには絵文字とテキストの両方が必要です。",
    "extendedProfile.inACall": "通話中",
    "extendedProfile.inACallForMin": "{minutes} 分通話中",
    "extendedProfile.inACallForH": "{hours} 時間通話中",
    "extendedProfile.other": "その他",
    "extendedProfile.atMostLinks": "リンクは最大 {MAX_CONNECTIONS} 件です。",
    "extendedProfile.linksMustBeHttpHttpsMailto":
        "リンクは http、https、mailto または matrix アドレスである必要があります。",
    "extendedProfile.inACallForHMin": "{hours} 時間 {minutes} 分通話中",
    "geoErrors.locationNeedsASecureHttpsConnection":
        "位置情報には安全な(HTTPS)接続が必要です - アプリをhttpsで開いてください。",
    "geoErrors.locationPermissionWasDeniedCheckSite":
        "位置情報の権限が拒否されました - サイトの権限を確認してください。",
    "geoErrors.yourPositionIsUnavailableLocationOff":
        "現在地を取得できません(位置情報がオフ、またはGPSが測位していません)。",
    "geoErrors.timedOutGettingYourLocation":
        "現在地の取得がタイムアウトしました。",
    "geoErrors.couldnTGetYourLocation": "現在地を取得できませんでした。",
    "geoErrors.locationIsnTAvailableInThis":
        "このブラウザでは位置情報を利用できません。",
    "joinRules.onlyAvailableForRoomsInsideA":
        "スペース内のルームでのみ利用できます",
    "joinRules.thisRoomSVersionDoesnT":
        "このルームのバージョンはスペース制限付き参加に対応していません",
    "keyBackup.preparing": "準備中…",
    "keyBackup.fetchingYourEncryptedHistory": "暗号化された履歴を取得中…",
    "keyBackup.restoringYourEncryptedHistory": "暗号化された履歴を復元中…",
    "keyBackup.restoringOfKeys": "{total} 件中 {successes} 件の鍵を復元中…",
    "keyBackup.noEncryptedHistoryToRestore": "復元する暗号化履歴がありません",
    "keyBackup.restored": "{count, plural, other {#件の鍵を復元しました}}",
    "keyBackup.ofKeysRestored": "{total} 件中 {imported} 件の鍵を復元しました",
    "keyBackup.notSetUp": "未設定",
    "keyBackup.notTrusted": "信頼されていません",
    "keyBackup.notConnected": "接続していません",
    "keyBackup.on": "オン",
    "keyBackup.encryptedMessageHistoryIsnTBeing":
        "暗号化されたメッセージ履歴がバックアップされていません。保護するにはリカバリーを設定してください。",
    "keyBackup.aBackupExistsOnTheServer":
        "サーバーにバックアップがありますが、このセッションではまだ信頼されていません。",
    "keyBackup.aBackupExistsButThisSession":
        "バックアップはありますが、このセッションは接続されていません。リカバリーキーを入力して履歴を復元してください。",
    "keyBackup.messageHistoryIsBeingBackedUp":
        "メッセージ履歴をバックアップ中です(v{version})。",
    "keyBackup.messageHistoryIsBeingBackedUp2":
        "メッセージ履歴をバックアップ中です。",
    "keyBackup.noKeysBackedUpYet": "まだバックアップされた鍵はありません",
    "keyBackup.backedUp": "{count, plural, other {#件の鍵をバックアップ済み}}",
    "keyBackup.stillToUpload":
        "{count, plural, other {#件の鍵がアップロード待ち}}",
    "keyBackup.everythingOnThisSessionIsBacked":
        "このセッションのすべてがバックアップ済みです",
    "keyBackup.notSet": "未設定",
    "keyExportSettings.exportOrImportRoomKeys":
        "ルーム鍵のエクスポートとインポート",
    "keyExportSettings.aKeyFileLetsAnotherApp":
        "鍵ファイルがあると、別のMatrixアプリや新しいセッションが暗号化されたメッセージ履歴を読めます。ファイルとパスフレーズは安全な場所に保管してください: 両方を持つ人はあなたのメッセージを読めます。",
    "keyExportSettings.export": "エクスポート",
    "keyExportSettings.import": "インポート",
    "keyExportSettings.passphrase": "パスフレーズ",
    "keyExportSettings.confirmPassphrase": "パスフレーズを再入力",
    "keyExportSettings.passphrasesDontMatch": "パスフレーズが一致しません",
    "keyExportSettings.exportKeys": "鍵をエクスポート",
    "keyExportSettings.exporting": "エクスポート中…",
    "keyExportSettings.exported":
        "{count, plural, other {#件の鍵をエクスポートしました}}",
    "keyExportSettings.couldNotExportYourKeys":
        "鍵をエクスポートできませんでした",
    "keyExportSettings.keyFile": "鍵ファイル",
    "keyExportSettings.importKeys": "鍵をインポート",
    "keyExportSettings.wrongPassphrase":
        "パスフレーズが違うか、ファイルが変更されています",
    "keyExportSettings.notAKeyFile": "鍵ファイルではないか、破損しています",
    "keyExportSettings.newerFormat":
        "この鍵ファイルは新しいバージョンのアプリで作成されたため、ここでは読み込めません",
    "keyExportSettings.couldNotImportTheKeys": "鍵をインポートできませんでした",
    "keywordRules.keywordCannotBeEmpty": "キーワードは空にできません",
    "keywordRules.keywordCannotStartWith": "キーワードは「.」で始められません",
    "keywordRules.youAlreadyHaveARuleFor":
        "このキーワードのルールはすでにあります",
    "liveAnnouncer.messageFrom": "{sender} からのメッセージ",
    "liveAnnouncer.newMessagesFrom":
        "{count, plural, other {{sender} からの新着メッセージ#件}}",
    "liveAnnouncer.newMessages": "{count, plural, other {新着メッセージ#件}}",
    "liveShareStop.couldnTStopSharingYourLive":
        "ライブ位置情報の共有を停止できませんでした - まだこのルームに表示されています。もう一度停止するには「停止を再試行」を使用してください。",
    "liveShareStop.stopping": "停止中…",
    "liveShareStop.stillSharingCouldnTStop": "共有中 - 停止できませんでした",
    "liveShareStop.youReAlreadySharingYourLive":
        "このルームですでにライブ位置情報を共有しています。",
    "liveShareStop.yourLastLiveLocationShareHere":
        "このルームでの前回のライブ位置情報の共有がまだ停止していません - 新しい共有を始める前に、ルームのバナーから停止してください。",
    "liveShareStop.stop": "停止",
    "liveShareStop.retryStop": "停止を再試行",
    "location.location": "位置情報",
    "mediaGallery.of": "{value} / {length}{value2}",
    "messageActionsMenu.edit": "編集",
    "messageActionsMenu.unpin": "ピン留めを解除",
    "messageActionsMenu.pin": "ピン留め",
    "messageActionsMenu.copyLink": "リンクをコピー",
    "messageActionsMenu.report": "通報",
    "messageDisplay.systemDefault": "システム設定に従う",
    "micErrorMessage.noMicrophoneFoundConnectOneOr":
        "マイクが見つかりません - 通話に参加するにはマイクを接続するか、別の入力デバイスを選択してください",
    "micErrorMessage.couldNotOpenYourMicrophoneAnother":
        "マイクを開けませんでした - 別のアプリが使用している可能性があります",
    "mutePowerLevel.enterAPowerLevel": "権限レベルを入力してください",
    "mutePowerLevel.mustBeAWholeNumber": "整数である必要があります",
    "mutePowerLevel.useToMute": "ミュートには {MUTE_POWER_LEVEL} を使用",
    "mutePowerLevel.youCanTSetALevel":
        "自分のレベル({ceiling})より高いレベルは設定できません",
    "notifActions.reply": "返信",
    "notifActions.reply2": "返信…",
    "notifActions.markAsRead": "既読にする",
    "notificationPrivacy.sentAMessage": "メッセージを送信しました",
    "notificationPrivacy.newMessage": "新着メッセージ",
    "notifyPermission.notificationsAreBlockedSoIncomingCalls":
        "通知がブロックされているため、このウインドウが非表示のとき着信通話を通知できません。システム設定で通知を許可してください。",
    "notifyPermission.thisBrowserCanTShowCall":
        "このブラウザはウインドウが非表示のときに通話の通知を表示できません。",
    "pollContent.addAQuestion": "質問を追加してください。",
    "pollContent.addAtLeastTwoOptions": "選択肢を2つ以上追加してください。",
    "pollContent.atMostOptions": "選択肢は最大 {MAX_ANSWERS} 件です。",
    "pollContent.invalidNumberOfSelections": "選択数の指定が無効です。",
    "pollContent.thePollHasEnded": "投票は終了しました。",
    "powerLevels.enterAPowerLevel": "権限レベルを入力してください",
    "powerLevels.mustBeAWholeNumber": "整数である必要があります",
    "powerLevels.mustBe0OrHigher": "0以上である必要があります",
    "powerLevels.youCanTSetALevel":
        "自分のレベル({ceiling})より高いレベルは設定できません",
    "presence.online": "オンライン",
    "presence.away": "離席中",
    "presence.offline": "オフライン",
    "presence.seenAsOnlineWhileTheApp":
        "アプリが同期している間はオンラインとして表示されます",
    "presence.shownAsIdleToOtherUsers":
        "他のユーザーにはアイドルとして表示されます",
    "presence.invisible": "オフライン表示",
    "presence.appearOfflineToOtherUsers": "他のユーザーにオフラインとして表示",
    "pushRuleWrite.yourHomeserverHasNoNotificationRule":
        "ホームサーバーに「{label}」の通知ルールがないため、変更できませんでした。",
    "pushRuleWrite.yourHomeserverRejectedTheChangeTo":
        "ホームサーバーが「{label}」通知の変更を拒否しました。",
    "pushRuleWrite.notificationsDidNotChangeOnYour":
        "ホームサーバーで「{label}」通知は変更されませんでした。",
    "pushRuleWrite.couldNotSaveNotificationsCheckYour":
        "「{label}」通知を保存できませんでした。接続を確認してもう一度お試しください。",
    "pusherVerification.noGatewayUrl": "(ゲートウェイURLなし)",
    "recoveryPassphrase.enterAPassphrase": "パスフレーズを入力してください。",
    "recoveryPassphrase.useAtLeastCharacters":
        "{MIN_PASSPHRASE_LENGTH} 文字以上にしてください。",
    "reportMessage.failedToSendReport": "通報を送信できませんでした",
    "roomAliases.enterAnAddress": "アドレスを入力してください。",
    "roomAliases.addressesCannotContainSpaces":
        "アドレスにスペースは使えません。",
    "roomAliases.addressesCannotContain": "アドレスに「:」は使えません。",
    "roomAliases.addressesCannotContain2": "アドレスに「#」は使えません。",
    "roomAliases.addressesCannotContainControlCharacters":
        "アドレスに制御文字は使えません。",
    "roomAliases.addressIsTooLongMaxCharacters":
        "アドレスが長すぎます(最大 {MAX_ALIAS_LENGTH} 文字)。",
    "roomAliases.thatAddressAlreadyExists": "そのアドレスはすでに存在します。",
    "roomCreationOutcome.theServerRejectedTheChange":
        "サーバーが変更を拒否しました",
    "roomCreationOutcome.theRoomWasCreatedButAdding":
        "ルームは作成されましたが、スペースへの追加に失敗しました: {detailSentence}",
    "roomCreationOutcome.theDirectMessageWasCreatedBut":
        "ダイレクトメッセージは作成されましたが、DMリストへの保存に失敗しました: {detailSentence} 再試行するまで通常のルームとして表示される場合があります。",
    "roomCreationOutcome.theRoomWasCreatedButAdding2":
        "ルームは作成されましたが、スペースへの追加はまだ確認されていません - まだ保存中の可能性があります。スペースにルームが表示されない場合は再試行してください。",
    "roomCreationOutcome.theDirectMessageWasCreatedBut2":
        "ダイレクトメッセージは作成されましたが、DMリストへの保存はまだ確認されていません - まだ保存中の可能性があります。DMリストに表示されない場合は再試行してください。",
    "roomEncryption.thisRoomIsAlreadyEncrypted":
        "このルームはすでに暗号化されています。",
    "roomEncryption.youNeedPowerLevelToEnable":
        "暗号化を有効にするには権限レベル {required} が必要です。",
    "roomEncryption.youAlreadyHaveADirectMessage":
        "このユーザーとのダイレクトメッセージがすでにあり、暗号化されていません。暗号化は自動では追加できません - そのルームを開き、ルームのセキュリティ設定から有効にしてください。",
    "roomEncryption.enableEncryptionWarning":
        "一度有効にすると暗号化は解除できません。新しいメッセージを読むには全員が暗号化に対応したクライアントを必要とします。",
    "roomHeaderMenu.threads": "スレッド",
    "roomHeaderMenu.pinnedMessages": "ピン留めしたメッセージ",
    "roomHeaderMenu.notificationsInbox": "通知受信箱",
    "roomHeaderMenu.mediaAndFiles": "メディアとファイル",
    "roomHeaderMenu.memberList": "メンバーリスト",
    "roomMedia.image": "画像",
    "roomMedia.video": "動画",
    "roomMedia.file": "ファイル",
    "roomMedia.audio": "音声",
    "roomMedia.kb": "{toFixed} KB",
    "roomMedia.mb": "{toFixed} MB",
    "roomSettingsNav.general": "一般",
    "roomSettingsNav.access": "アクセス",
    "roomSettingsNav.security": "セキュリティ",
    "roomSettingsNav.permissions": "権限",
    "roomSettingsNav.members": "メンバー",
    "roomSettingsNav.emotes": "絵文字",
    "roomSettingsNav.rooms": "ルーム",
    "roomStateTrust.unverifiedRoomState": "未検証のルーム状態",
    "roomStateTrust.unverifiedRoomStateTooltip":
        "このルームの詳細(ロール、メンバーシップ、権限)の一部はサーバーから直接取得され、syncで確認されていないため、不正確な可能性があります。表示内容に関係なく、操作はサーバーによって適用されます。",
    "roomUpgrade.theServerSRecommendedRoomVersion":
        "サーバー推奨のルームバージョンは利用できません。",
    "roomUpgrade.thisRoomIsOnTheLatest":
        "このルームは最新バージョン(v{recommendedVersion})です。",
    "roomUpgrade.youDonTHavePermissionTo":
        "このルームをアップグレードする権限がありません。",
    "saveFile.savedToDownloads": "ダウンロードに保存しました",
    "securityStatusView.couldnTReadThisAccountS":
        "このアカウントの暗号化状態を読み取れませんでした。読み込まれるまでここに表示される内容は信頼できません - リカバリーの設定やリセットはまだ行わないでください。",
    "securityStatusView.encryptionIsnTReadyOnThis":
        "このセッションではまだ暗号化の準備ができていません。続く場合は再読み込みしてください。",
    "serverAcl.allowListIsEmptyWhichDenies":
        "許可リストが空のため、すべてのサーバーのフェデレーションが拒否されます。",
    "serverAcl.denyListContainsWhichBansAll":
        "拒否リストに * が含まれているため、すべてのサーバーがBANされます。",
    "serverAcl.thisConfigurationBansYourOwnServer":
        "この設定は自分のサーバー({ownServerName})をBANするため、フェデレーションが壊れます。",
    "serverCapabilities.crossSigningE2ee": "クロス署名(E2EE)",
    "serverCapabilities.privateReadReceipts": "プライベート既読通知",
    "serverCapabilities.threadedRelations": "スレッド関連",
    "serverCapabilities.spaceSummaries": "スペース概要",
    "serverCapabilities.busyPresence": "取り込み中プレゼンス",
    "serverCapabilities.dehydratedDevices": "デハイドレーテッドデバイス",
    "serverCapabilities.filterPublicRoomsByType": "公開ルームを種類で絞り込み",
    "serverCapabilities.authenticatedMedia": "認証付きメディア",
    "serverCapabilities.intentionalMentions": "意図的なメンション",
    "serverCapabilities.slidingSyncSimplified": "sliding sync(簡易)",
    "serverCapabilities.sharedRoomsWithAUser": "ユーザーとの共通ルーム",
    "settingsNav.account": "アカウント",
    "settingsNav.securitySessions": "セキュリティとセッション",
    "settingsNav.privacySafety": "プライバシーと安全",
    "settingsNav.app": "アプリ",
    "settingsNav.appearance": "外観",
    "settingsNav.messagesMedia": "メッセージとメディア",
    "settingsNav.voiceVideo": "音声と映像",
    "settingsNav.emotes": "絵文字",
    "settingsNav.advanced": "詳細設定",
    "settingsNav.general": "一般",
    "settingsNav.plugins": "プラグイン",
    "settingsNav.server": "サーバー",
    "settingsNav.about": "このアプリについて",
    "settingsNav.debug": "デバッグ",
    "settingsSearch.displayName": "表示名",
    "settingsSearch.avatar": "アバター",
    "settingsSearch.presence": "プレゼンス",
    "settingsSearch.changePassword": "パスワードを変更",
    "settingsSearch.logOut": "ログアウト",
    "settingsSearch.deactivateAccount": "アカウントを無効化",
    "settingsSearch.sessions": "セッション",
    "settingsSearch.encryptNewDirectMessages":
        "新しいダイレクトメッセージを暗号化",
    "settingsSearch.onlySendToVerifiedDevices": "検証済みのデバイスにのみ送信",
    "settingsSearch.setUpRecovery": "リカバリーを設定",
    "settingsSearch.restoreMessageHistory": "メッセージ履歴を復元",
    "settingsSearch.verifyThisSession": "このセッションを検証",
    "settingsSearch.rightAlignMyMessages": "自分のメッセージを右寄せ",
    "settingsSearch.showWhenIAmInA": "通話中であることを表示",
    "settingsSearch.showNameColours": "名前の色を表示",
    "settingsSearch.textSize": "文字サイズ",
    "settingsSearch.font": "フォント",
    "settingsSearch.themePresets": "テーマのプリセット",
    "settingsSearch.importExportTheme": "テーマのインポート/エクスポート",
    "settingsSearch.timeFormat": "時刻の形式",
    "settingsSearch.dateFormat": "日付の形式",
    "settingsSearch.showMatrixIds": "Matrix IDを表示",
    "settingsSearch.readReceiptAvatars": "既読のアバター",
    "settingsSearch.linkPreviews": "リンクプレビュー",
    "settingsSearch.linkPreviewMedia": "リンクプレビューのメディア",
    "settingsSearch.pauseVideosOffScreen": "画面外の動画を一時停止",
    "settingsSearch.sendVideosThatStreamFaster":
        "ストリーミングが速い形式で動画を送信",
    "settingsSearch.sendPhotosThatAppearSooner": "表示が速い形式で写真を送信",
    "settingsSearch.removeLocationAndMetadata":
        "アップロードから位置情報などのメタデータを削除",
    "settingsSearch.sendGifsAsAnimatedWebp": "GIFをアニメーションWebPで送信",
    "settingsSearch.midiSoundBank": "MIDIサウンドバンク",
    "settingsSearch.holdToOpenMessageMenu": "長押しでメッセージメニューを開く",
    "settingsSearch.gifDefaultTab": "GIFの既定タブ",
    "settingsSearch.minimiseToTrayOnClose": "閉じるときにトレイへ最小化",
    "settingsSearch.proxy": "プロキシ",
    "settingsSearch.reduceMotion": "モーションを減らす",
    "settingsSearch.keepRoomListOpen": "ルームリストを開いたままにする",
    "settingsSearch.customEmotes": "カスタム絵文字",
    "settingsSearch.pushNotificationsPermission": "プッシュ通知の権限",
    "settingsSearch.notificationSound": "通知音",
    "settingsSearch.desktopAlertsPopUpAndTaskbar":
        "デスクトップ通知(ポップアップとタスクバーの点滅)",
    "settingsSearch.popUpNotifications": "ポップアップ通知",
    "settingsSearch.quietOnMyOtherDevices": "他のデバイスでは静かに",
    "settingsSearch.privateReadReceipts": "プライベート既読通知",
    "settingsSearch.hideMessageTextInNotifications":
        "通知でメッセージ本文を隠す",
    "settingsSearch.notificationRules": "通知ルール",
    "settingsSearch.keywordHighlights": "キーワードのハイライト",
    "settingsSearch.inputDevice": "入力デバイス",
    "settingsSearch.outputDevice": "出力デバイス",
    "settingsSearch.camera": "カメラ",
    "settingsSearch.noiseSuppression": "ノイズ抑制",
    "settingsSearch.echoCancellation": "エコーキャンセル",
    "settingsSearch.autoGainControl": "自動ゲイン調整",
    "settingsSearch.normalizeVoices": "音量を均一化",
    "settingsSearch.mirrorMyCamera": "カメラをミラー表示",
    "settingsSearch.videoCodec": "映像コーデック",
    "settingsSearch.callVolume": "通話音量",
    "settingsSearch.playCallSounds": "通話音を再生",
    "settingsSearch.ringForIncomingDmCalls": "DMの着信通話で呼び出し音を鳴らす",
    "settingsSearch.blockedUsers": "ブロックしたユーザー",
    "settingsSearch.serverCapabilities": "サーバーの機能",
    "settingsSearch.plugins": "プラグイン",
    "settingsSearch.pluginRepositories": "プラグインリポジトリ",
    "settingsSearch.syncPlugins": "プラグインを同期",
    "settingsSearch.checkForUpdates": "アップデートを確認",
    "settingsSearch.clearCache": "キャッシュを消去",
    "settingsSearch.showAllEvents": "すべてのイベントを表示",
    "settingsSearch.pushDiagnostics": "プッシュの診断",
    "settingsSearch.pushService": "プッシュサービス(UnifiedPush / Firebase)",
    "settingsSearch.language": "言語",
    "slashCommands.createAPoll": "投票を作成",
    "slashCommands.shareYourLocation": "位置情報を共有",
    "slashCommands.joinARoomByAddress": "アドレスでルームに参加",
    "slashCommands.leaveTheCurrentRoom": "現在のルームを退出",
    "slashCommands.inviteAUserToThisRoom": "このルームにユーザーを招待",
    "slashCommands.setTheRoomTopic": "ルームのトピックを設定",
    "slashCommands.removeAUserFromThisRoom": "このルームからユーザーを削除",
    "slashCommands.userServerReason": "<@user:server> [理由]",
    "slashCommands.banAUserFromThisRoom": "このルームからユーザーをBAN",
    "slashCommands.setYourDisplayName": "表示名を設定",
    "slashCommands.displayName": "<表示名>",
    "slashCommands.setAUserSPowerLevel": "ユーザーの権限レベルを設定",
    "slashCommands.userServerLevel": "<@user:server> [レベル]",
    "slashCommands.resetAUserSPowerLevel": "ユーザーの権限レベルを既定値に戻す",
    "slashCommands.discardSession":
        "メッセージが読めない場合、次のメッセージで新しいルームキーを使用",
    "slashCommands.usage": "使い方: /{name} {argHint}",
    "slashCommands.usage2": "使い方: /{name}",
    "syncStatus.connected": "接続済み",
    "syncStatus.reconnecting": "再接続中…",
    "syncStatus.connectionError": "接続エラー",
    "syncStatus.offline": "オフライン",
    "syncStatus.connecting": "接続中…",
    "themePalette.accent": "アクセント",
    "themePalette.background": "背景",
    "themePalette.secondaryBackground": "背景(副)",
    "themePalette.tertiaryBackground": "背景(第三)",
    "themePalette.primaryText": "本文テキスト",
    "themePalette.secondaryText": "補助テキスト",
    "themePalette.mutedText": "弱いテキスト",
    "themePalette.danger": "危険",
    "themePalette.positive": "肯定",
    "themePalette.mentionHighlight": "メンションのハイライト",
    "themePalette.link": "リンク",
    "themePalette.warning": "警告",
    "themePalette.onlineStatus": "オンラインのステータス",
    "themePalette.idleStatus": "アイドルのステータス",
    "themePalette.doNotDisturbStatus": "取り込み中のステータス",
    "themePalette.offlineStatus": "オフラインのステータス",
    "themePalette.divider": "区切り線",
    "themePalette.spoilerBackground": "スポイラーの背景",
    "themePalette.ownMessageBubble": "自分のメッセージの吹き出し",
    "themePalette.primaryTextOnBackground": "背景上の本文テキスト",
    "themePalette.secondaryTextOnBackground": "背景上の補助テキスト",
    "themePalette.mutedTextOnTertiaryBackground": "背景(第三)上の弱いテキスト",
    "themePalette.whiteTextOnAccentButtons": "アクセントボタン上の白文字",
    "themePalette.whiteTextOnDangerButtons": "危険ボタン上の白文字",
    "themePalette.whiteTextOnOwnBubble": "自分の吹き出し上の白文字",
    "themePreset.copy": "{newName}(コピー)",
    "threadList.noPreview": "(プレビューなし)",
    "threePidInvite.youDonTHavePermissionTo":
        "このルームに人を招待する権限がありません。",
    "threePidInvite.yourHomeserverHasNoIdentityServer":
        "ホームサーバーにIDサーバーがないため、メールでの招待は利用できません。",
    "timeFormat.yesterdayAt": "昨日 {time}",
    "timeFormat.today": "今日",
    "timeFormat.yesterday": "昨日",
    "timeFormat.separatorDatePattern": "EEEE, MMMM d, yyyy",
    "timeFormat.monthDayPattern": "MMM d",
    "timeFormat.compactDateTime": "{date}, {time}",
    "updateStatus.checkingForUpdates": "アップデートを確認中…",
    "updateStatus.youReOnTheLatestVersion": "最新バージョンです{versionSuffix}",
    "updateStatus.checkForUpdates": "アップデートを確認",
    "updateStatus.updateAvailable": "アップデートがあります{versionSuffix}",
    "updateStatus.downloadInstall": "ダウンロードしてインストール",
    "updateStatus.downloadingV": "v{version} をダウンロード中",
    "updateStatus.downloadingUpdate": "アップデートをダウンロード中",
    "updateStatus.updateReadyInstall":
        "アップデートの準備ができました{versionSuffix} - インストール",
    "updateStatus.install": "インストール",
    "updateStatus.updateReadyRestartToApply":
        "アップデートの準備ができました{versionSuffix} - 再起動して適用",
    "updateStatus.restartToApply": "再起動して適用",
    "updateStatus.updateReadyReloadToApply":
        "アップデートの準備ができました{versionSuffix} - 再読み込みして適用",
    "updateStatus.reloadToApply": "再読み込みして適用",
    "updateStatus.aNewVersionIsAvailable":
        "新しいバージョンがあります{versionSuffix}",
    "updateStatus.openReleasePage": "リリースページを開く",
    "updateStatus.updateCheckFailed": "アップデートの確認に失敗しました",
    "updateStatus.checkForUpdatesToInstallThe":
        "最新バージョンをインストールするにはアップデートを確認してください。",
    "uploadLimits.mb": "{round} MB",
    "uploadLimits.kb": "{round} KB",
    "uploadLimits.exceedsTheServerSUploadLimit":
        "「{fileName}」はサーバーのアップロード上限 {formatByteLimit} を超えています",
    "verificationMessage.verificationRequestSent":
        "検証リクエストを送信しました",
    "verificationMessage.waitingForThemToAccept": "相手の承認を待っています…",
    "verificationMessage.noLongerPending": "保留中ではなくなりました",
    "verificationMessage.wantsToVerify":
        "{senderName} さんが検証を希望しています",
    "verificationMessage.compareEmojiToConfirmThisIs":
        "絵文字を照合して本人であることを確認してください",
    "verificationMessage.sentAVerificationRequest":
        "{senderName} さんが検証リクエストを送信しました",
    "verificationStatus.checkingEncryption": "暗号化を確認中…",
    "verificationStatus.encryptionUnavailable": "暗号化を利用できません",
    "verificationStatus.statusUnavailable": "ステータスを取得できません",
    "verificationStatus.verified": "検証済み",
    "verificationStatus.thisSessionIsVerifiedAndEncryption":
        "このセッションは検証済みで、暗号化も完全に設定されています。",
    "verificationStatus.notSetUp": "未設定",
    "verificationStatus.setUpEncryptionToSecureYour":
        "デバイス間でメッセージを保護するには暗号化を設定してください。",
    "verificationStatus.setUp": "設定",
    "verificationStatus.encryptionSetupIncomplete":
        "暗号化の設定が完了していません",
    "verificationStatus.thisSessionIsVerifiedButEncryption":
        "このセッションは検証済みですが、暗号化の設定が完了していません。",
    "verificationStatus.finishSetup": "設定を完了",
    "verificationStatus.unverified": "未検証",
    "verificationStatus.thisSessionIsnTVerifiedYet":
        "このセッションはまだ検証されていません。",
    "rootLayout.linkCopied": "リンクをコピーしました",
    "rootPage.failedToReconnectPleaseLogIn":
        "再接続に失敗しました。もう一度ログインしてください。",
    "rootPage.signedInButSyncingCouldNot":
        "サインインしましたが、同期を開始できませんでした。もう一度お試しください。",
    "rootPage.yourSessionHasExpiredPleaseSign":
        "セッションの有効期限が切れました。もう一度サインインしてください。",
    "ownStatus.profileField": "プロフィール項目 {key}",
    "ownStatus.theServerStillHas": "サーバーにはまだ残っています: {leftovers}",
    "ownStatus.statusClearedButPresenceRemains":
        "ステータスは消去されましたが、サーバーにはまだプレゼンスメッセージ「{presenceLeft}」が表示されています。おそらくこのアカウントの別のセッション(別のアプリやクライアント)が設定しています - そこで消去するか、そのセッションをサインアウトしてください。",
};

const catalogue: LocaleCatalogue = { messages, dateLocale: ja };

export default catalogue;
