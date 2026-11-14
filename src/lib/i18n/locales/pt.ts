// Portuguese (Brazil) (pt). Same keys and placeholders as ../en.ts; a string missing
// here falls back to English (`npm run i18n:missing` lists them).

import { ptBR } from "date-fns/locale/pt-BR";
import type { MessageKey } from "../en";
import type { LocaleCatalogue } from "../index";

const messages: Partial<Record<MessageKey, string>> = {
    // Shared
    "common.turnOffCamera": "Desativar câmera",
    "common.turnOnCamera": "Ativar câmera",
    "common.stopSharing": "Parar de compartilhar",
    "common.shareYourScreen": "Compartilhar sua tela",
    "common.joining": "Entrando…",
    "common.join": "Entrar",
    "common.closeDialog": "Fechar caixa de diálogo",
    "common.settings": "Configurações",
    "common.searchResults": "Resultados da pesquisa",
    "common.default": "Padrão",
    "common.mute": "Silenciar",
    "common.saving": "Salvando…",
    "common.unblock": "Desbloquear",
    "common.block": "Bloquear",
    "common.closeMenu": "Fechar menu",
    "common.openRoomList": "Abrir lista de salas",
    "common.uploading": "Enviando…",
    "common.uploadImage": "Enviar imagem",
    "common.emoji": "Emoji",
    "common.decline": "Recusar",
    "common.invitePeople": "Convidar pessoas",
    "common.close": "Fechar",
    "common.cancel": "Cancelar",
    "common.loading": "Carregando…",
    "common.loadMore": "Carregar mais",
    "common.notifications": "Notificações",
    "common.save": "Salvar",
    "common.topic": "Tópico",
    "common.videoRoom": "Sala de vídeo",
    "common.reasonOptional": "Motivo (opcional)",
    "common.actions": "Ações",
    "common.copy": "Copiar",
    "common.remove": "Remover",
    "common.add": "Adicionar",
    "common.starting": "Iniciando…",
    "common.verify": "Verificar",
    "common.removeFromFavourites": "Remover dos favoritos",
    "common.addToFavourites": "Adicionar aos favoritos",
    "common.stickers": "Figurinhas",
    "common.retry": "Tentar novamente",
    "common.delete": "Excluir",
    "common.checking": "Verificando…",
    "common.gifs": "GIFs",
    "common.dragOrUseArrowKeysTo": "Arraste ou use as setas para redimensionar",
    "common.resizePicker": "Redimensionar seletor",
    "common.noResults": "Nenhum resultado",
    "common.memberCount": "{count, plural, one {# membro} other {# membros}}",
    "common.replyCount":
        "{count, plural, one {# resposta} other {# respostas}}",

    // src/lib/components/settings/AboutSettings.svelte
    "aboutSettings.automaticUpdates": "Atualizações automáticas",
    "aboutSettings.version": "Versão",
    "aboutSettings.currentVersionV": "Versão atual v{APP_VERSION}",
    "aboutSettings.checkForUpdates": "Verificar atualizações",
    "aboutSettings.updateAvailable": "Atualização disponível",
    "aboutSettings.reloading": "Recarregando…",
    "aboutSettings.update": "Atualizar",
    "aboutSettings.reloadToUpdate": "Recarregar para atualizar",
    "aboutSettings.youReOnTheLatestVersion":
        "Você está na versão mais recente.",
    "aboutSettings.credits": "Créditos",
    "aboutSettings.creditsMidiInstruments": "Instrumentos MIDI",
    "aboutSettings.creditsSoundFont":
        "por {author}, baseado em Phoenix, de {original}. Licenciado sob CC BY; remapeado para General MIDI e comprimido para o Zam.",
    "aboutSettings.creditsSoundFontGaps":
        "Instrumentos que o MT-32 não tem: {microgm}, de {microgmAuthor} (WTFPL), e {generalUser}, de {generalUserAuthor}.",
    "aboutSettings.troubleshooting": "Solução de problemas",
    "aboutSettings.clearCacheAndResync": "Limpar cache e ressincronizar",
    "aboutSettings.reDownloadsYourRoomsFromThe":
        "Baixa suas salas do servidor novamente. Corrige salas ausentes ou travadas. Você continua conectado.",
    "aboutSettings.resyncing": "Ressincronizando…",
    "aboutSettings.clearCache": "Limpar cache",
    "aboutSettings.updateCheckFailed": "Falha ao verificar atualizações",
    "aboutSettings.downloadFailed": "Falha no download",
    "aboutSettings.installFailed": "Falha na instalação",
    "aboutSettings.failedToCheckForUpdates": "Falha ao verificar atualizações.",
    "aboutSettings.sourceCodeOnGitHub": "Código-fonte no GitHub",
    "links.website": "Site",
    "links.github": "GitHub",
    "links.downloadApps": "Baixar os aplicativos",

    // src/lib/components/settings/AccountSettings.svelte
    "accountSettings.profile": "Perfil",
    "accountSettings.yourAvatar": "Seu avatar",
    "accountSettings.changeAvatar": "Alterar avatar",
    "accountSettings.yourDisplayName": "Seu nome de exibição",
    "accountSettings.saved": "Salvo",
    "accountSettings.account": "Conta",
    "accountSettings.userId": "ID de usuário",
    "accountSettings.homeserver": "Servidor doméstico",
    "accountSettings.connection": "Conexão",
    "accountSettings.presence": "Presença",
    "accountSettings.password": "Senha",
    "accountSettings.currentPassword": "Senha atual",
    "accountSettings.newPassword": "Nova senha",
    "accountSettings.confirmNewPassword": "Confirmar nova senha",
    "accountSettings.signOutAllOtherSessions":
        "Sair de todas as outras sessões",
    "accountSettings.changing": "Alterando…",
    "accountSettings.changePassword": "Alterar senha",
    "accountSettings.passwordChanged": "Senha alterada.",
    "accountSettings.thisServerDoesNotAllowChanging":
        "Este servidor não permite alterar sua senha por este aplicativo.",
    "accountSettings.managedByProvider":
        "Sua senha, suas sessões e sua conta são gerenciadas na página de conta do seu provedor de login.",
    "accountSettings.manageAccount": "Gerenciar conta",
    "accountSettings.emailPhoneNumbers": "E-mail e números de telefone",
    "accountSettings.noEmailAddressesOrPhoneNumbers":
        "Nenhum endereço de e-mail ou número de telefone está vinculado a esta conta.",
    "accountSettings.email": "E-mail",
    "accountSettings.phone": "Telefone",
    "accountSettings.thisServerDoesNotAllowManaging":
        "Este servidor não permite gerenciá-los por este aplicativo.",
    "accountSettings.logOut": "Sair",
    "accountSettings.lastDeviceTitle": "Este é seu único dispositivo conectado",
    "accountSettings.lastDeviceBackedUp":
        "Seu histórico criptografado tem backup, mas você precisará da sua chave de recuperação para lê-lo depois de entrar novamente.",
    "accountSettings.lastDeviceNoBackup":
        "Ao sair, você perderá permanentemente as chaves de criptografia armazenadas neste dispositivo. Sem um backup de chaves ou outro dispositivo verificado, seu histórico de mensagens criptografadas não poderá ser recuperado.",
    "accountSettings.logOutAnyway": "Sair mesmo assim",
    "accountSettings.dangerZone": "Zona de perigo",
    "accountSettings.deactivateAccount": "Desativar conta…",
    "accountSettings.deactivationIsPermanentAndCannotBe":
        "A desativação é permanente e não pode ser desfeita.",
    "accountSettings.eraseMessagesWherePossible":
        "Apagar mensagens sempre que possível",
    "accountSettings.deactivating": "Desativando…",
    "accountSettings.deactivateAccount2": "Desativar conta",
    "accountSettings.avatarUploadFailed": "Falha ao enviar o avatar",
    "accountSettings.failedToRemoveAvatar": "Falha ao remover o avatar",
    "accountSettings.failedToSaveName": "Falha ao salvar o nome",
    "accountSettings.couldNotSetPresence":
        "Não foi possível definir a presença",
    "accountSettings.failedToChangePassword": "Falha ao alterar a senha",
    "accountSettings.failedToDeactivateAccount": "Falha ao desativar a conta",

    // src/lib/components/layout/AccountSwitcher.svelte
    "accountSwitcher.signOut": "Sair de {userId}",
    "accountSwitcher.confirm": "Confirmar",
    "accountSwitcher.signOut2": "Sair",
    "accountSwitcher.addAccount": "Adicionar conta",
    "accountSwitcher.accountMenu": "Menu da conta",
    "accountSwitcher.closeAccountMenu": "Fechar menu da conta",
    "accountSwitcher.back": "Voltar",
    "accountSwitcher.setYourStatus": "Definir seu status",
    "accountSwitcher.setAStatus": "Definir um status",
    "accountSwitcher.editProfile": "Editar perfil",
    "accountSwitcher.switchAccounts": "Trocar de conta",
    "accountSwitcher.couldNotSetPresence":
        "Não foi possível definir a presença",

    // src/lib/components/layout/ActiveCallBanner.svelte
    "activeCallBanner.openCall": "Abrir chamada",
    "activeCallBanner.open": "Abrir",
    "activeCallBanner.ringing": "Chamando…",
    "activeCallBanner.voiceCallInCall": "Chamada de voz · {length} na chamada",
    "activeCallBanner.leave": "Sair",

    // src/lib/components/settings/AppearanceSettings.svelte
    "appearanceSettings.rightAlignMyMessagesBubbleLayout":
        "Alinhar minhas mensagens à direita (layout de balões)",
    "appearanceSettings.displayYourOwnMessagesOnThe":
        "Exibe suas próprias mensagens à direita, em um balão colorido",
    "appearanceSettings.showNameColours": "Mostrar cores dos nomes",
    "appearanceSettings.drawPeopleSNamesInThe":
        "Exibe o nome das pessoas na cor que elas escolheram no perfil. Desative para usar a cor de texto normal para todos.",
    "appearanceSettings.keepRoomListOpen": "Manter a lista de salas aberta",
    "appearanceSettings.donTAutoCloseTheRoom":
        "Não fecha a lista de salas automaticamente ao alternar entre espaços ou o Início. Abrir uma sala ou mensagem direta sempre a fecha.",
    "appearanceSettings.timestamps": "Data e hora",
    "appearanceSettings.timeFormat": "Formato de hora",
    "appearanceSettings.dateFormat": "Formato de data",
    "appearanceSettings.customDatePattern": "Padrão de data personalizado",
    "appearanceSettings.yyyyMmDd": "yyyy-MM-dd",
    "appearanceSettings.preview": "Pré-visualização:",
    "appearanceSettings.dateFnsTokensEGYyyy":
        "· tokens do date-fns, p. ex. yyyy-MM-dd",
    "appearanceSettings.invalidFormatUseLowercaseDateFns":
        "Formato inválido - use tokens do date-fns em minúsculas, como yyyy-MM-dd.",
    "appearanceSettings.alwaysShowAbsoluteDates":
        "Sempre mostrar datas absolutas",
    "appearanceSettings.replaceTodayAndYesterdayWithThe":
        "Substitui “Hoje” e “Ontem” pela data completa em todos os lugares.",
    "appearanceSettings.reduceMotion": "Reduzir movimento",
    "appearanceSettings.minimizeAnimationsAndTransitionsYourDevice":
        "Minimiza animações e transições. A configuração de “reduzir movimento” do sistema do seu dispositivo também é sempre respeitada.",
    "appearanceSettings.customCss": "CSS personalizado",
    "appearanceSettings.customCssEnable": "Usar CSS personalizado",
    "appearanceSettings.customCssHint":
        "Seus próprios estilos, aplicados em tempo real sobre o tema. As cores do tema são variáveis definidas na página, então substitua-as com !important.",
    "appearanceSettings.customCssRecovery":
        "Se uma regra tornar o Zam inutilizável, abra-o com ?nocustomcss adicionado ao endereço (ou desative a opção) para voltar.",
    "appearanceSettings.custom": "Personalizado",
    "appearanceSettings.12Hour": "12 horas",
    "appearanceSettings.24Hour": "24 horas",
    "appearanceSettings.language": "Idioma",
    "appearanceSettings.layout": "Layout",
    "appearanceSettings.displayLanguage": "Idioma de exibição",
    "appearanceSettings.displayLanguageHint":
        "O idioma em que os menus e botões do Zam são exibidos. Alterá-lo recarrega o aplicativo.",

    // src/routes/app/+page.svelte
    "appPage.redirecting": "Redirecionando…",

    // src/lib/components/layout/AppSettings.svelte
    "appSettings.backToSettings": "Voltar às configurações",
    "appSettings.closeSettings": "Fechar configurações",
    "appSettings.searchSettings": "Pesquisar configurações…",
    "appSettings.searchSettings2": "Pesquisar configurações",
    "appSettings.noSettingsMatch": "Nenhuma configuração encontrada",
    "appSettings.noSettingsMatch2":
        "Nenhuma configuração corresponde a “{searchQuery}”.",
    "appSettings.resultCount":
        "{count, plural, one {# resultado} other {# resultados}}",

    // src/lib/components/layout/AppShell.svelte
    "appShell.zam": "({notificationCount}) Zam",
    "appShell.redirecting": "Redirecionando…",
    "appShell.noRoomsYet": "Nenhuma sala ainda",
    "appShell.resizeRoomList": "Redimensionar lista de salas",
    "appShell.createARoomOrStartA":
        "Crie uma sala ou inicie uma mensagem direta para começar.",
    "appShell.nothingInHome": "Nada no Início",
    "appShell.allOfYourRoomsLiveIn":
        "Todas as suas salas ficam em espaços - abra um para vê-las. Salas e mensagens diretas fora de um espaço aparecem aqui.",
    "appShell.openRoomList": "Abrir lista de salas",
    "appShell.someone": "Alguém",
    "appShell.isCalling": "{name} está ligando",
    "appShell.incomingCall": "Chamada recebida",
    "appShell.offlineMessageStorageIsUnavailableThis":
        "O armazenamento offline de mensagens não está disponível nesta sessão, então o histórico não será salvo para a próxima vez.",
    "appShell.couldnTSendYourReplyIt":
        "Não foi possível enviar sua resposta. Ela foi salva como rascunho.",
    "appShell.yourNotificationReplyWasSavedAs":
        "Sua resposta da notificação foi salva como rascunho",

    // src/lib/components/settings/BlockedUsersSettings.svelte
    "blockedUsersSettings.messagesFromBlockedUsersAreHidden":
        "As mensagens de usuários bloqueados ficam ocultas em todas as salas. A lista é armazenada na sua conta e vale para todas as suas sessões.",
    "blockedUsersSettings.youHavenTBlockedAnyone": "Você não bloqueou ninguém.",
    "blockedUsersSettings.failed": "Falhou",

    // src/lib/components/layout/CallParticipantMenu.svelte
    "callParticipantMenu.profile": "Perfil",
    "callParticipantMenu.input": "Entrada",
    "callParticipantMenu.output": "Saída",
    "callParticipantMenu.opening": "Abrindo…",
    "callParticipantMenu.message": "Mensagem",
    "callParticipantMenu.mention": "Mencionar",
    "callParticipantMenu.userVolume": "Volume do usuário",
    "callParticipantMenu.soundboardVolume": "Volume da mesa de sons",
    "callParticipantMenu.shareVolume": "Volume do compartilhamento",
    "callParticipantMenu.hideVideo": "Ocultar vídeo",
    "callParticipantMenu.kicking": "Expulsando…",
    "callParticipantMenu.confirmKick": "Confirmar expulsão de {name}?",
    "callParticipantMenu.kickFromRoom": "Expulsar {name} da sala",
    "callParticipantMenu.banning": "Banindo…",
    "callParticipantMenu.confirmBan": "Confirmar banimento de {name}?",
    "callParticipantMenu.ban": "Banir {name}",
    "callParticipantMenu.couldNotOpenADirectMessage":
        "Não foi possível abrir uma mensagem direta",
    "callParticipantMenu.couldNotKick": "Não foi possível expulsar {name}",
    "callParticipantMenu.couldNotBan": "Não foi possível banir {name}",

    // src/lib/components/layout/CallView.svelte
    "callEncryption.encrypted":
        "Criptografada de ponta a ponta: somente as pessoas nesta chamada podem vê-la e ouvi-la.",
    "callEncryption.encryptedShort": "Criptografada",
    "callEncryption.partial":
        "Criptografada de ponta a ponta, exceto {names}: o aplicativo dessa pessoa envia áudio e vídeo sem criptografia. Você pode ouvi-la e vê-la, mas ela não pode ouvir nem ver você até que o aplicativo dela ofereça suporte a chamadas criptografadas.",
    "callEncryption.partialShort": "Parcialmente criptografada",
    "callEncryption.notEncrypted":
        "Não criptografada de ponta a ponta: o servidor de chamadas pode ver e ouvir esta chamada. Chamadas em salas criptografadas são criptografadas.",
    "callView.ringing": "Chamando…",
    "callView.showChat": "Mostrar chat",
    "callView.noOneIsInThisCall": "Ninguém está nesta chamada",
    "callView.backToGrid": "Voltar à grade",
    "callView.screenShareQuality": "Qualidade do compartilhamento de tela",
    "callView.optionsFor": "Opções para {name}",
    "callView.muted": "Silenciado",
    "callView.deafened": "Ensurdecido",
    "callView.mutedForYou": "Silenciado para você",
    "callView.joinedFromMultipleDevices": "Entrou por vários dispositivos",
    "callView.devices": "{value} dispositivos",
    "callView.enableAudio": "Ativar áudio",
    "callView.onHold": "Em espera enquanto outra chamada está ativa",
    "callView.resume": "Retomar",
    "callView.speakerOn": "Usar alto-falante",
    "callView.speakerOff": "Parar de usar alto-falante",
    "callView.unmute": "Reativar microfone",
    "callView.undeafen": "Desensurdecer",
    "callView.deafen": "Ensurdecer",
    "callView.disconnect": "Desconectar",
    "callView.joinCall": "Entrar na chamada",
    "callView.you": "Você",
    "callView.sScreen": "Tela de {name}",
    "callView.exitSpotlightFor": "Sair do destaque de {label}",
    "callView.spotlight": "Destacar {label}",

    // src/lib/components/messages/CreatePollDialog.svelte
    "createPollDialog.createPoll": "Criar enquete",
    "createPollDialog.question": "Pergunta",
    "createPollDialog.askSomething": "Pergunte algo…",
    "createPollDialog.options": "Opções",
    "createPollDialog.option": "Opção {value}",
    "createPollDialog.removeOption": "Remover opção",
    "createPollDialog.addOption": "+ Adicionar opção",
    "createPollDialog.results": "Resultados",
    "createPollDialog.showAsPeopleVote": "Mostrar conforme as pessoas votam",
    "createPollDialog.hideUntilClosed": "Ocultar até encerrar",
    "createPollDialog.allowSelectingMultipleOptions":
        "Permitir selecionar várias opções",
    "createPollDialog.creating": "Criando…",
    "createPollDialog.failedToCreatePoll": "Falha ao criar a enquete",

    // src/lib/components/layout/CryptoUnavailableBanner.svelte
    "cryptoUnavailableBanner.offOutOfStorage":
        "A criptografia está desativada neste dispositivo porque o armazenamento acabou: mensagens criptografadas não podem ser lidas nem enviadas. Libere espaço e tente novamente.",
    "cryptoUnavailableBanner.offLocked":
        "A criptografia está desativada neste dispositivo porque uma notificação ainda estava usando as chaves dele: mensagens criptografadas não podem ser lidas nem enviadas.",
    "cryptoUnavailableBanner.offOther":
        "A criptografia está desativada neste dispositivo: mensagens criptografadas não podem ser lidas nem enviadas, e as chaves de criptografia dele não foram publicadas.",
    "cryptoUnavailableBanner.tryAgain": "Tentar novamente",
    "cryptoUnavailableBanner.freeUpSpaceFirst": "Libere espaço primeiro",
    "cryptoUnavailableBanner.syncPaused":
        "A criptografia não pôde iniciar, então esta sessão parou de sincronizar para preservar as chaves de criptografia que outras pessoas enviam a você. Recarregue para tentar novamente.",
    "cryptoUnavailableBanner.dismissEncryptionWarning":
        "Dispensar aviso de criptografia",

    // src/lib/components/layout/SoundboardPopover.svelte, settings/SoundPackEditor.svelte
    "soundboard.title": "Mesa de sons",
    "soundboard.yourVolume": "Volume dos seus sons",
    "soundboard.empty":
        "Nenhum som ainda. Adicione alguns em Configurações, Emotes, ou nas configurações de uma sala.",
    "soundboard.sendFailed": "Não foi possível enviar esse som para a chamada.",
    "soundboard.add": "Adicionar um som",
    "soundboard.limits":
        "Arquivos de áudio de até {seconds} segundos e {kb} KB.",
    "soundboard.pack": "Pacote",
    "soundboard.newPack": "Novo pacote",
    "soundboard.packName": "Nome do pacote",
    "soundboard.enterAPackName": "Digite um nome para o pacote.",
    "soundboard.name": "Nome do som",
    "soundboard.upload": "Enviar som",
    "soundboard.uploadFailed": "Não foi possível enviar o som.",
    "soundboard.removeFailed": "Não foi possível remover isso.",
    "soundboard.previewFailed": "Não foi possível reproduzir esse som.",
    "soundboard.preview": "Ouvir prévia",
    "soundboard.remove": "Remover som",
    "soundboard.noSounds": "Nenhum som neste pacote",
    "soundboard.deletePack": "Excluir pacote",
    "soundboard.confirmDeletePack":
        "Excluir o pacote “{name}” e todos os seus sons?",
    "soundboard.inheritedFrom": "De {sourceName}",
    "soundboard.addToMine": "Adicionar aos meus",
    "soundboard.useEverywhere": "Usar em todas as chamadas",
    "soundboard.usedEverywhere": "Em todas as chamadas",
    "soundboard.useEverywhereHint":
        "Oferece este pacote nas suas chamadas em todas as salas, não só nesta.",
    "soundboard.globalFailed":
        "Não foi possível alterar onde este pacote é oferecido.",
    "soundboard.addedToYours":
        "{count, plural, one {# som adicionado ao seu pacote.} other {# sons adicionados ao seu pacote.}}",
    "soundboard.alreadyYours": "Já está no seu pacote.",
    // src/lib/matrix/soundboard.ts
    "soundboard.badName":
        "Use de 1 a 100 letras, números, hifens ou sublinhados (A-Z, 0-9). Espaços viram sublinhados.",
    "soundboard.noPermission": "Você não pode editar sons nesta sala.",
    "soundboard.notAudio": "Isso não é um arquivo de áudio.",
    "soundboard.tooBig": "Esse arquivo é grande demais.",
    "soundboard.tooLong": "Os sons podem ter no máximo {seconds} segundos.",
    "soundboard.unreadable": "Não foi possível ler esse arquivo de áudio.",

    // src/lib/components/settings/CustomPackSettings.svelte
    "customPackSettings.add": "Adicionar {singular}",
    "customPackSettings.shortcode": "código curto",
    "customPackSettings.sticker": "Figurinha",
    "customPackSettings.remove": "Remover {toLowerCase}",
    "customPackSettings.image": "Imagem",
    "customPackSettings.chooseAtLeastOneUsage": "Escolha pelo menos um uso.",
    "customPackSettings.uploadFailed": "Falha no envio",
    "customPackSettings.failedToRemove": "Falha ao remover {singular}",
    "customPackSettings.failedToUpdateUsage": "Falha ao atualizar o uso",
    "customPackSettings.noCustomImages": "Nenhuma imagem personalizada",
    "customPackSettings.noCustomEmojis": "Nenhum emoji personalizado",
    "customPackSettings.noCustomStickers": "Nenhuma figurinha personalizada",

    // src/lib/components/debug/DebugEventItem.svelte
    "debugEventItem.stateKey": "state_key",
    "debugEventItem.empty": "(vazio)",
    "debugEventItem.redacted": "REMOVIDO",
    "debugEventItem.id": "id: {eventId}",

    // src/lib/components/debug/DebugPanel.svelte
    "debugPanel.debugPanel": "PAINEL DE DEPURAÇÃO",
    "debugPanel.sync": "Sincronização:",
    "debugPanel.refresh": "↻ atualizar",
    "debugPanel.copied": "copiado",
    "debugPanel.copy": "⧉ copiar",
    "debugPanel.unreadState": "ESTADO DE NÃO LIDAS",
    "debugPanel.unread": "não lidas:",
    "debugPanel.highlight": "destaque:",
    "debugPanel.userid": "userId:",
    "debugPanel.readuptoid": "readUpToId:",
    "debugPanel.readidxInTimeline": "readIdx na linha do tempo:",
    "debugPanel.noReceipt": "sem confirmação",
    "debugPanel.n1NotInWindow": "-1 (fora da janela!)",
    "debugPanel.events": "/ {totalEvents} eventos",
    "debugPanel.lastEventSender": "remetente do último evento:",
    "debugPanel.me": "(eu:",
    "debugPanel.notificationEventsAfterReadMarker":
        "eventos de notificação após o marcador de leitura:",
    "debugPanel.from": "[{formatTs}] {getType} de {value} - {msgPreview}",
    "debugPanel.pushRules": "REGRAS DE PUSH",
    "debugPanel.default": "(padrão)",
    "debugPanel.actions": "ações: {stringify}",
    "debugPanel.conditions": "condições: {stringify}",
    "debugPanel.noPushRulesFound": "nenhuma regra de push encontrada",
    "debugPanel.readReceiptsEventsWithReceipts":
        "CONFIRMAÇÕES DE LEITURA ({length} eventos com confirmações)",
    "debugPanel.noReceipts": "sem confirmações",
    "debugPanel.urlPreviewInspector": "INSPETOR DE PRÉVIA DE URL",
    "debugPanel.https": "https://...",
    "debugPanel.storeMessagesWhatTheUiRenders":
        "MENSAGENS DO STORE ({length}) - o que a interface exibe",
    "debugPanel.redacted": "REMOVIDO",
    "debugPanel.rel": "rel={relType}",
    "debugPanel.empty": "vazio",
    "debugPanel.pendingEvents": "EVENTOS PENDENTES ({length})",
    "debugPanel.rawTimelineEvents": "LINHA DO TEMPO BRUTA ({length} eventos)",

    // src/lib/components/settings/GpuDebug.svelte
    "gpuDebug.title": "GPU",
    "gpuDebug.hardwareAcceleration": "Aceleração de hardware",
    "gpuDebug.hardwareAccelerationHint":
        "Desative se os vídeos aparecerem pretos ou a janela for desenhada de forma errada. Aplica-se após reiniciar.",
    "gpuDebug.gameAuto": "Pausar a GPU enquanto um jogo roda",
    "gpuDebug.gameAutoHint":
        "Se a GPU continuar falhando enquanto um jogo roda (o jogo ocupa a memória dela), o Zam reinicia sem aceleração de hardware e reinicia de novo com ela quando o jogo fechar. Requer a detecção de jogos em Configurações > Geral. Espera o fim de uma chamada.",
    "gpuDebug.gameAutoActive": "Rodando sem GPU até o jogo fechar.",
    "gpuDebug.nvidiaVideo": "Decodificação de vídeo NVIDIA",
    "gpuDebug.nvidiaVideoHint":
        "Decodifica vídeo em GPUs NVIDIA pelo renderizador Vulkan do Chromium. Automático ativa quando uma GPU NVIDIA controla suas telas. No Wayland, o Vulkan não é usado e Automático o deixa desativado; escolher Vulkan ali tenta a decodificação por hardware via OpenGL (experimental).",
    "gpuDebug.nvidiaVideoActive": "Em uso agora.",
    "gpuDebug.nvidiaVideoInactive": "Não está em uso agora.",
    "gpuDebug.nvidiaVideoFailed":
        "O Zam voltou ao caminho GL depois que o processo da GPU travou. Escolha Vulkan para tentar novamente.",
    "gpuDebug.nvidiaVideoAuto": "Automático",
    "gpuDebug.nvidiaVideoVulkan": "Vulkan",
    "gpuDebug.nvidiaVideoOff": "Desativado",
    "gpuDebug.restartToApply": "Reinicie o Zam para aplicar esta alteração.",
    "gpuDebug.restart": "Reiniciar",
    "gpuDebug.videoDecoding": "Decodificação de vídeo",
    "gpuDebug.decodeHardware": "Hardware",
    "gpuDebug.decodeSoftware": "Software",
    "gpuDebug.decodeUnsupported": "Sem suporte",
    "gpuDebug.videoEncode": "Codificação de vídeo por hardware",
    "gpuDebug.videoEncodeHint":
        "Codifica sua câmera e o compartilhamento de tela na GPU (VA-API) para os codecs que seu driver suporta. Desative se outras pessoas virem uma transmissão preta, congelada ou corrompida vinda de você. Aplica-se após reiniciar.",
    "gpuDebug.videoEncoding": "Codificação de vídeo",
    "gpuDebug.videoEncodingHint":
        "As chamadas enviam o codec escolhido em Voz e vídeo (H.264 por padrão). O painel de estatísticas da chamada mostra qual codificador uma chamada está usando.",
    "gpuDebug.memoryReport": "Relatório de memória",
    "gpuDebug.memoryReportHint":
        "Detalha a memória usada pelos processos do Zam, incluindo a memória de vídeo no processo da GPU, por quem a mantém. Meça com a tela exibindo o problema e depois copie o relatório para um relatório de bug.",
    "gpuDebug.repaint": "Redesenhar",
    "gpuDebug.repaintHint":
        "Reinicia o processo da GPU para que a janela seja desenhada novamente do zero. Use se partes da janela aparecerem como caixas pretas ou brancas ou no lugar errado, o que pode acontecer ao ficar sem memória de vídeo. As chamadas continuam. Também está no menu da bandeja.",
    "gpuDebug.memoryMeasure": "Medir",
    "gpuDebug.memoryMeasuring": "Medindo…",
    "gpuDebug.memoryRecord": "Registrar memória ao longo do tempo",
    "gpuDebug.memoryRecordHint":
        "Gera o relatório de memória em intervalos e continua com as Configurações fechadas, para você usar o Zam normalmente e voltar depois. Mostra o primeiro, o menor, o maior e o último tamanho de cada item, e salva todas as amostras em um CSV para gerar gráficos.",
    "gpuDebug.memoryRecordInterval": "Intervalo",
    "gpuDebug.memoryRecordEvery": "A cada {seconds} s",
    "gpuDebug.memoryRecordStart": "Gravar",
    "gpuDebug.memoryRecordStop": "Parar",
    "gpuDebug.memoryRecordStatus": "{count} amostras em {elapsed}",
    "gpuDebug.memoryRecordCsv": "Salvar CSV",
    "gpuDebug.encodeTest": "Executar teste de codificação H.264",
    "gpuDebug.encodeTestHint":
        "Codifica 60 quadros por tamanho do jeito que uma chamada faz. O hardware deve ser bem mais rápido por quadro do que o software.",
    "gpuDebug.encodeTestRejected": "Rejeitado pelo codificador",
    "gpuDebug.encodeTestResult": "{chunks} blocos, {ms} ms por quadro",
    "gpuDebug.skiaGraphite": "Renderizador Skia Graphite (experimental)",
    "gpuDebug.skiaGraphiteHint":
        "Desenha a interface com o renderizador Graphite, mais novo, do Chromium, em vez do Ganesh. Ative para testar a renderização, ou desative se a janela piscar ou for desenhada de forma errada. Requer aceleração de hardware. Aplica-se após reiniciar.",
    "gpuDebug.skiaGraphiteFailed":
        "Desativado automaticamente porque falhou ao iniciar ou travou o processo da GPU. Ative novamente para tentar de novo.",
    "gpuDebug.nvidiaEncode": "Codificação de vídeo NVIDIA (experimental)",
    "gpuDebug.nvidiaEncodeHint":
        "Codifica chamadas e compartilhamentos de tela em H.264 com NVENC, pelo driver VA-API próprio do Zam. A decodificação de vídeo continua como definido acima. Aplica-se após reiniciar.",
    "gpuDebug.featureStatus": "Status dos recursos",
    "gpuDebug.details": "Detalhes",
    "settingsNav.keybinds": "Atalhos",
    "settingsSearch.keyboardShortcuts": "Atalhos de teclado",
    "keybinds.intro":
        "Clique em um atalho para alterá-lo e depois pressione as novas teclas. Os atalhos funcionam enquanto o Zam está em foco. Pressionar para falar e pressionar para silenciar também podem usar um botão lateral do mouse ou uma única tecla modificadora.",
    "keybinds.resetAll": "Redefinir tudo",
    "keybinds.removedFrom": "Essas teclas foram removidas de: {actions}",
    "keybinds.changeFor": "Alterar atalho de {action}",
    "keybinds.pressKey": "Pressione as teclas… (Esc cancela)",
    "keybinds.pressKeyOrButton":
        "Pressione uma tecla ou botão do mouse… (Esc cancela)",
    "keybinds.notSet": "Não definido",
    "keybinds.clear": "Remover atalho",
    "keybinds.clearFor": "Remover atalho de {action}",
    "keybinds.reset": "Redefinir para o padrão",
    "keybinds.resetFor": "Redefinir {action} para o padrão",
    "keybinds.pushToTalkHint":
        "Definir uma tecla ativa o pressionar para falar: nas chamadas, seu microfone só envia áudio enquanto ela estiver pressionada.",
    "keybinds.pushToMuteHint":
        "Seu microfone fica silenciado enquanto isto estiver pressionado.",
    "keybinds.globalVoice": "Funcionar quando o Zam não está em foco",
    "keybinds.globalVoiceHint":
        "Pressionar para falar, pressionar para silenciar, alternar silêncio e alternar ensurdecimento também funcionam enquanto você está em outro aplicativo. O Zam só escuta as teclas associadas a eles e não impede que outros aplicativos as recebam.",
    "keybinds.globalWayland":
        "Indisponível aqui: este desktop Wayland não oferece atalhos globais aos aplicativos (o portal GlobalShortcuts), então os atalhos de voz só funcionam enquanto o Zam está em foco.",
    "keybinds.globalPermission":
        "O macOS precisa permitir isso primeiro: ative o Zam em Ajustes do Sistema > Privacidade e Segurança > Acessibilidade e depois volte ao Zam.",
    "keybinds.globalOpenSettings": "Abrir Ajustes do Sistema",
    "keybinds.globalError":
        "O Zam não conseguiu começar a escutar teclas em outros aplicativos ({error}). Os atalhos de voz funcionam enquanto o Zam está em foco.",
    "keybinds.globalPortalHint":
        "Pressionar para falar, pressionar para silenciar, alternar silêncio e alternar ensurdecimento também funcionam enquanto você está em outro aplicativo. No Wayland, seu desktop executa esses atalhos para o Zam: ele pode pedir que você os confirme ou escolha outras teclas, e outros aplicativos deixam de receber essas teclas.",
    "keybinds.globalPortalAssigned": "Teclas atribuídas pelo seu desktop:",
    "keybinds.globalPortalMouse":
        "Botões do mouse não podem ser atalhos do desktop: escolha uma tecla para eles nas configurações do seu desktop.",
    "keybinds.globalPortalConfigure": "Alterar nas configurações do sistema",
    "keybinds.globalPortalError":
        "Seu desktop não configurou os atalhos ({error}). Desative e ative novamente para tentar de novo.",
    "keybinds.helpTitle": "Atalhos de teclado",
    "keybinds.customize": "Personalizar",
    "keybinds.category.navigation": "Navegação",
    "keybinds.category.chat": "Chat",
    "keybinds.category.voice": "Voz e chamadas",
    "keybinds.category.app": "Aplicativo",
    "keybinds.action.quickSwitcher": "Alternador rápido",
    "keybinds.action.prevChannel": "Canal anterior",
    "keybinds.action.nextChannel": "Próximo canal",
    "keybinds.action.prevUnreadChannel": "Canal não lido anterior",
    "keybinds.action.nextUnreadChannel": "Próximo canal não lido",
    "keybinds.action.prevMentionChannel": "Canal anterior com menções",
    "keybinds.action.nextMentionChannel": "Próximo canal com menções",
    "keybinds.action.prevServer": "Espaço anterior",
    "keybinds.action.nextServer": "Próximo espaço",
    "keybinds.action.navigateBack": "Voltar",
    "keybinds.action.navigateForward": "Avançar",
    "keybinds.action.previousTextChannel": "Voltar ao canal anterior",
    "keybinds.action.returnToCall": "Voltar à chamada",
    "keybinds.action.markChannelRead": "Marcar canal como lido",
    "keybinds.action.markServerRead": "Marcar espaço como lido",
    "keybinds.action.jumpToOldestUnread":
        "Ir para a mensagem não lida mais antiga",
    "keybinds.action.emojiPicker": "Seletor de emojis",
    "keybinds.action.gifPicker": "Seletor de GIFs",
    "keybinds.action.stickerPicker": "Seletor de figurinhas",
    "keybinds.action.uploadFile": "Enviar um arquivo",
    "keybinds.action.search": "Pesquisar",
    "keybinds.action.togglePins": "Mensagens fixadas",
    "keybinds.action.toggleInbox": "Caixa de notificações",
    "keybinds.action.toggleMembers": "Lista de membros",
    "keybinds.action.toggleMute": "Alternar silêncio",
    "keybinds.action.toggleDeafen": "Alternar ensurdecimento",
    "keybinds.action.pushToTalk": "Pressionar para falar",
    "keybinds.action.pushToMute": "Pressionar para silenciar",
    "keybinds.action.answerCall": "Atender chamada recebida",
    "keybinds.action.declineCall": "Recusar chamada recebida",
    "keybinds.action.startCall": "Iniciar ou entrar em uma chamada nesta sala",
    "keybinds.action.toggleCamera": "Alternar câmera",
    "keybinds.action.toggleScreenShare": "Alternar compartilhamento de tela",
    "keybinds.action.leaveCall": "Sair da chamada",
    "keybinds.action.openSettings": "Abrir configurações",
    "keybinds.action.createDm": "Nova mensagem direta",
    "draftDm.intro": "Este é o início das suas mensagens diretas com {name}.",
    "draftDm.lazyNote":
        "Nada é criado até você enviar a primeira mensagem. {name} é convidado(a) nesse momento.",
    "draftDm.placeholder": "Mensagem para {name}",
    "draftDm.send": "Enviar",
    "draftDm.starting": "Iniciando conversa...",
    "draftDm.encrypted": "Será criptografada de ponta a ponta",
    "draftDm.discard": "Descartar rascunho",
    "draftDm.couldNotStart": "Não foi possível iniciar a conversa",
    "keybinds.action.createOrJoinSpace": "Criar ou entrar em um espaço",
    "keybinds.action.shortcutsHelp": "Mostrar atalhos de teclado",
    "keybinds.action.toggleDebug": "Alternar painel de depuração",
    "quickSwitcher.title": "Para onde você quer ir?",
    "quickSwitcher.placeholder": "Pesquisar salas, mensagens diretas e espaços",
    "quickSwitcher.recentAndUnread": "Recentes e não lidas",
    "quickSwitcher.noResults": "Nenhuma correspondência",
    "quickSwitcher.mentioned": "Mencionado",
    "quickSwitcher.space": "Espaço",
    "quickSwitcher.home": "Início",
    "quickSwitcher.hint": "↑↓ para mover, Enter para abrir, Esc para fechar",

    // src/lib/components/settings/DebugSettings.svelte
    "debugSettings.developer": "Desenvolvedor",
    "debugSettings.showAllEvents": "Mostrar todos os eventos",
    "debugSettings.orderHints": "Dicas de ordem das mensagens",
    "debugSettings.orderHintsHint":
        "O Zam adiciona às suas mensagens uma dica dizendo o que estava no final do seu histórico de chat e coloca as mensagens de outros usuários do Zam abaixo daquela que elas indicam. Desativado, as mensagens aparecem na ordem do servidor, como no Element.",
    "debugSettings.stickyCallMembership": "Participação em chamadas sticky",
    "debugSettings.stickyCallMembershipHint":
        "Entrar nas chamadas com um evento sticky m.rtc.member (MSC4354) em vez de um evento de estado m.call.member. Clientes que só leem eventos de estado, incluindo o Zam anterior à 1.51, não verão você na chamada. Vale a partir da sua próxima chamada.",
    "debugSettings.indexSync": "Sincronização do índice de mensagens",
    "debugSettings.indexSyncHint":
        "As entradas do índice de pesquisa são trocadas com as suas outras sessões verificadas. Ambas as sessões precisam usar esta versão. Sessões: elegíveis / verificadas / todas. Blocos: enviados / recebidos.",
    "debugSettings.indexSyncOff":
        "A sincronização do índice não está ativa: é preciso ativar a indexação de salas criptografadas.",
    "debugSettings.indexSyncNow": "Sincronizar agora",
    "debugSettings.indexSyncNever": "nunca",
    "debugSettings.indexSyncSessions": "Sessões",
    "debugSettings.indexSyncAsked": "Consultado",
    "debugSettings.indexSyncRoomsMissing": "Salas com lacunas",
    "debugSettings.indexSyncRequestsReceived": "Pedidos recebidos",
    "debugSettings.indexSyncChunks": "Blocos",
    "debugSettings.indexSyncMerged": "Entradas mescladas",
    "debugSettings.displayEveryMatrixTimelineEventIn":
        "Exibir todos os eventos da linha do tempo do Matrix no histórico do chat.",
    "debugSettings.ignoreCodecSupport": "Ignorar suporte a codecs informado",
    "debugSettings.ignoreCodecSupportHint":
        "Envia o codec escolhido mesmo que outras pessoas digam que não conseguem decodificá-lo e aceita todos os codecs que este dispositivo lista (inclusive os bloqueados por estarem com defeito). Para testes, p. ex. HEVC no Linux.",
    "debugSettings.h264ProfileFix": "Correção de perfil H.264 da GPU",
    "debugSettings.h264ProfileFixHint":
        "As chamadas usam o codificador H.264 da GPU mesmo quando o servidor responde com Constrained Baseline, que o Chromium codifica por software. Desative para ver o codificador que uma chamada recebe sem isso. No desktop Windows, a flag do Chromium muda após reiniciar.",
    "debugSettings.voiceProcessing": "Processamento de voz",
    "debugSettings.pauseGate": "Gate de pausas",
    "debugSettings.pauseGateHint":
        "Remove mais 20 dB das pausas depois da remoção de ruído. Desativado por padrão; pode cortar o início de palavras baixas.",
    "debugSettings.noiseAttenuationLimit":
        "Limite de remoção de ruído: {value} dB",
    "debugSettings.noiseAttenuationLimitHint":
        "O máximo que o filtro de ruído (DeepFilterNet3 ou DPDFNet) pode remover de qualquer parte do sinal (padrão {value}). 100 é ilimitado.",
    "debugSettings.soundboardInterval": "Intervalo da mesa de sons: {value} ms",
    "debugSettings.soundboardIntervalHint":
        "Menor intervalo entre os sons da mesa de sons de uma mesma pessoa. Sons de outras pessoas que chegarem mais rápido são ignorados (padrão 1500).",
    "debugSettings.syncStatus": "Status da sincronização",
    "debugSettings.clientLogs": "Logs do cliente",
    "debugSettings.clientLogsHint":
        "Tudo o que o aplicativo registrou desde que iniciou, sem tokens, senhas e chaves. Envie isto ao relatar um bug.",
    "debugSettings.copyLogs": "Copiar logs",
    "debugSettings.saveLogs": "Salvar logs",
    "debugSettings.clientLogsCopyFailed": "Não foi possível copiar os logs",
    "debugSettings.clientLogsSaveFailed": "Não foi possível salvar os logs",
    "debugSettings.webViewDebugging": "Depuração do WebView",
    "debugSettings.webViewDebuggingHint":
        "Permite que um computador conectado por USB inspecione o aplicativo em chrome://inspect. Continua ativado após reinicializações até você desativar.",
    "debugSettings.syncLog": "Log de sincronização",
    "debugSettings.syncLogEmpty":
        "Nada registrado ainda. Reinícios, requisições com falha e redefinições da linha do tempo aparecem aqui.",
    "debugSettings.refresh": "Atualizar",
    "debugSettings.copied": "Copiado",
    "debugSettings.useSlidingSync": "Usar sliding sync",
    "debugSettings.experimentalLoadsRoomsInAGrowing":
        "Experimental. Carrega salas em uma janela crescente. Recarrega o aplicativo para aplicar.",
    "debugSettings.pushStatus": "Status do push",
    "debugSettings.lastError": "Último erro: {lastError}",
    "debugSettings.runDiagnostics": "Executar diagnóstico",
    "debugSettings.homeserverPushers": "Pushers do servidor doméstico",
    "debugSettings.theHomeserverHasNoPushersRegistered":
        "O servidor doméstico não tem pushers registrados para esta conta.",
    "debugSettings.aPusherMatchesTheConfiguredGateway":
        "Um pusher corresponde à URL do gateway configurada.",
    "debugSettings.noPusherMatchesTheConfiguredGateway":
        "Nenhum pusher corresponde à URL do gateway configurada.",
    "debugSettings.appId": "app_id: {app_id}",
    "debugSettings.none": "(nenhum)",
    "debugSettings.url": "url: {value}",
    "debugSettings.pushkey": "pushkey: {pushkeyPreview}",
    "debugSettings.webPushPwa": "Web Push (PWA)",
    "debugSettings.missing": "(ausente)",
    "debugSettings.vapidKey": "Chave VAPID: {value}",
    "debugSettings.permission": "permissão: {permission}",
    "debugSettings.subscription": "assinatura: {value}",
    "debugSettings.notFound": "não encontrado",
    "debugSettings.homeserverPusher": "pusher do servidor doméstico: {value}",
    "debugSettings.error": "erro: {error}",
    "debugSettings.gatewaySygnalFirebase": "Gateway (Sygnal / Firebase)",
    "debugSettings.gatewayReachable": "Gateway acessível",
    "debugSettings.gatewayNotReachable": "Gateway inacessível",
    "debugSettings.nativeSessionPushEnrichment":
        "Sessão nativa (enriquecimento de push)",
    "debugSettings.homeserver": "servidor doméstico: {value}",
    "debugSettings.user": "usuário: {value}",
    "debugSettings.device": "dispositivo: {value}",
    "debugSettings.accessToken": "token de acesso: {value}",
    "debugSettings.hideMessageText": "ocultar texto da mensagem: {value}",
    "debugSettings.notificationRulesServer": "Regras de notificação (servidor)",
    "debugSettings.syncMode": "Modo de sincronização",
    "debugSettings.slidingSyncMsc4186": "Sliding sync (MSC4186)",
    "debugSettings.classicSyncV2": "/sync clássico (v2)",
    "debugSettings.syncState": "Estado da sincronização",
    "debugSettings.fallback": "Alternativa",
    "debugSettings.slidingSyncEndpoint": "Endpoint do sliding sync",
    "debugSettings.joinedRoomsLoaded": "Salas ingressadas carregadas",
    "debugSettings.roomListWindow": "Janela da lista de salas",
    "debugSettings.of": "{requested} de {total}",
    "debugSettings.platform": "Plataforma",
    "debugSettings.nativeCapacitor": "Nativo (Capacitor)",
    "debugSettings.pushEnabledInBuild": "Push ativado no build",
    "debugSettings.yes": "Sim",
    "debugSettings.no": "Não",
    "debugSettings.hideUpdatePrompts": "Ocultar avisos de atualização",
    "debugSettings.hideUpdatePromptsHint":
        "Desativa o banner e o aviso de atualização. As atualizações ainda são verificadas e ainda são instaladas por conta própria quando as atualizações automáticas estão ativadas.",
    "debugSettings.gatewayUrl": "URL do gateway",
    "debugSettings.appId2": "ID do app",
    "debugSettings.notificationPermission": "Permissão de notificação",
    "debugSettings.fcmToken": "Token FCM",
    "debugSettings.pushProvider": "Provedor de push",
    "debugSettings.unifiedPushDistributor": "Distribuidor UnifiedPush",
    "debugSettings.unifiedPushEndpoint": "Endpoint UnifiedPush",
    "debugSettings.unifiedPushGateway": "Gateway UnifiedPush",
    "debugSettings.pusherRegisteredThisSession":
        "Pusher registrado nesta sessão",
    "debugSettings.failedToFetchPushersFromHomeserver":
        "Falha ao obter os pushers do servidor doméstico.",
    "debugSettings.set": "definido",
    "debugSettings.active": "ativo",
    "debugSettings.allNotificationsMasterRule":
        "Todas as notificações (regra mestre)",

    // src/lib/components/ui/EmojiPicker.svelte
    "emojiPicker.searchEmoji": "Pesquisar emoji…",
    "emojiPicker.searchEmoji2": "Pesquisar emoji",
    "emojiPicker.myEmojis": "Meus emojis",
    "emojiPicker.custom": "Personalizados",
    "emojiPicker.standard": "Padrão",
    "emojiPicker.myEmojis2": "Meus emojis",

    // src/lib/components/ui/ErrorToasts.svelte
    "errorToasts.dismiss": "Dispensar",

    // src/lib/components/settings/ExtendedProfileDebug.svelte
    "extendedProfileDebug.extendedProfile": "Perfil estendido",
    "extendedProfileDebug.fetchFromServer": "Buscar do servidor",
    "extendedProfileDebug.thisServerDoesNotSupportExtended":
        "Este servidor não oferece suporte a perfis estendidos.",
    "extendedProfileDebug.noneOrTheServerRefused":
        "nenhum, ou o servidor recusou",
    "extendedProfileDebug.presenceGetPresenceStraightFromThe":
        "Presença (GET /presence, direto do servidor): {value}",
    "extendedProfileDebug.notAdvertisedNoRestrictions":
        "não divulgado (sem restrições)",
    "extendedProfileDebug.serverRulesForFieldsMProfile":
        "Regras do servidor para campos (m.profile_fields): {value}",
    "extendedProfileDebug.failedToFetchTheProfile": "Falha ao buscar o perfil",
    "extendedProfileDebug.couldNotCopyToClipboard":
        "Não foi possível copiar para a área de transferência",

    // src/lib/components/ui/FlashEmbed.svelte
    "flashEmbed.suspend": "Suspender",
    "flashEmbed.resize": "Redimensionar player",
    "flashEmbed.resizeHint":
        "Arraste ou use as setas para redimensionar. Clique duas vezes para redefinir.",

    // src/lib/components/messages/ForwardMessageDialog.svelte
    "forwardMessageDialog.forwardMessage": "Encaminhar mensagem",
    "forwardMessageDialog.searchRooms": "Pesquisar salas",
    "forwardMessageDialog.noJoinedRoomsFound":
        "Nenhuma sala em que você está foi encontrada",
    "forwardMessageDialog.forwarding": "Encaminhando…",
    "forwardMessageDialog.forward": "Encaminhar",
    "forwardMessageDialog.failedToForwardMessage":
        "Falha ao encaminhar a mensagem",

    // src/lib/components/settings/GeneralSettings.svelte
    "generalSettings.desktop": "Desktop",
    "proxySettings.network": "Rede",
    "proxySettings.proxy": "Proxy",
    "proxySettings.modeSystem": "Usar configurações do sistema",
    "proxySettings.modeDirect": "Sem proxy",
    "proxySettings.modeManual": "Manual",
    "proxySettings.modePac": "Configuração automática (PAC)",
    "proxySettings.launchFlagsInUse": "Flags de inicialização em uso:",
    "proxySettings.server": "Servidor proxy",
    "proxySettings.serverHint":
        "socks5://, socks4://, http:// ou https:// com host e porta. O Tor geralmente é socks5://127.0.0.1:9050.",
    "proxySettings.bypass": "Não usar o proxy para",
    "proxySettings.pacUrl": "URL do arquivo PAC",
    "proxySettings.calls": "Chamadas",
    "proxySettings.callsDefault": "Padrão (UDP direto, TCP pelo proxy)",
    "proxySettings.callsDirect":
        "Conectar diretamente aos servidores de chamada",
    "proxySettings.callsProxy": "Somente pelo proxy",
    "proxySettings.callsDefaultHint":
        "Não existe UDP por proxy, então o áudio da chamada normalmente vai direto e só passa pelo proxy quando a chamada precisa recorrer ao TCP.",
    "proxySettings.callsDirectHint":
        "A chamada inteira ignora o proxy: entrada, conexão com o servidor de chamada e áudio e vídeo por UDP ou TCP. Todo o resto continua usando o proxy. Os servidores de chamada veem seu endereço IP.",
    "proxySettings.callsProxyHint":
        "Sem conexões diretas, e os servidores de chamada nunca veem seu endereço IP: as chamadas passam pelo proxy até o relay TURN do servidor de chamada por TCP ou TLS. Se o servidor não oferecer relay TURN, as chamadas não conectam. Espere mais atraso.",
    "proxySettings.callsDirectUnavailable":
        "As chamadas não podem ignorar as configurações de proxy do sistema. Defina o proxy aqui (Manual ou PAC) para isso funcionar.",
    "proxySettings.callsDirectAddresses": "Enviado diretamente:",
    "proxySettings.save": "Salvar",
    "proxySettings.saved": "Salvo",
    "proxySettings.applyFailed": "Não foi possível aplicar: {error}",
    "generalSettings.minimiseToTrayOnClose":
        "Minimizar para a bandeja ao fechar",
    "generalSettings.keepZamRunningInTheSystem":
        "Mantém o Zam em execução na bandeja do sistema ao fechar a janela, em vez de sair. Use o ícone da bandeja para reabrir ou sair.",
    "generalSettings.runAtStartup": "Executar na inicialização",
    "generalSettings.startZamWhenYouLogIn":
        "Inicia o Zam quando você entra no computador.",
    "generalSettings.runAtStartupFailed": "Seu sistema não permitiu isso.",
    "generalSettings.noGeneralSettingsAreAvailableOn":
        "Não há configurações gerais disponíveis nesta plataforma.",

    // src/lib/components/settings/RichPresenceSettings.svelte
    "richPresence.heading": "Presença detalhada",
    "richPresence.share": "Compartilhar o que você está fazendo",
    "richPresence.shareHint":
        "Permite que aplicativos neste computador mostrem no seu perfil o que você está jogando ou ouvindo. Todos os aplicativos são permitidos por padrão; desative abaixo os que você não quiser.",
    "richPresence.arrpc": "Aplicativos que usam o Discord Rich Presence",
    "richPresence.arrpcHint":
        "Também aceita aplicativos que informam ao Discord. Se o Discord estiver em execução, os aplicativos geralmente informam a ele primeiro, então isso funciona melhor com o Discord fechado.",
    "richPresence.scan": "Detectar jogos",
    "richPresence.scanHint":
        "Procura jogos em execução neste computador, para que também apareçam os que não informam nada. Isso lê a lista de programas em execução a cada poucos segundos.",
    "richPresence.scanNeedsPermission":
        "O sandbox do Flatpak não consegue ver outros programas. Para o Zam poder procurar jogos, execute este comando e depois reinicie o Zam:",
    "richPresence.scanGrantCommand":
        "flatpak override --user --talk-name=org.freedesktop.Flatpak moe.crafty.matrix",
    "richPresence.scanFailed": "Não foi possível procurar jogos: {error}",
    "richPresence.media": "Informar reprodução de mídia",
    "richPresence.mediaHint":
        "Mostra a música ou o vídeo que um player de mídia neste computador está reproduzindo, a partir das informações de “em reprodução” do sistema. Cada player é permitido por padrão depois que isto é ativado; desative abaixo os que você não quiser.",
    "richPresence.mediaFailed":
        "Não foi possível ler a reprodução de mídia: {error}",
    "richPresence.socket": "Também escutando em {path}.",
    "richPresence.arrpcNeedsShare": "Ative o compartilhamento primeiro.",
    "richPresence.listening": "Escutando aplicativos na porta {port}.",
    "richPresence.listenFailed": "Não foi possível começar a escutar: {error}",
    "richPresence.arrpcFailed": "Não foi possível iniciar o arRPC: {error}",
    "richPresence.hostNeedsPermission":
        "O sandbox do Flatpak não consegue controlar outros programas. Para o Zam poder fazer isso, execute este comando e depois reinicie o Zam:",
    "richPresence.fake": "Fingir que o Discord está em execução",
    "richPresence.fakeHint":
        "Alguns aplicativos se recusam a enviar o Rich Presence a menos que um processo chamado Discord esteja em execução. Isto inicia um processo ocioso, somente enquanto o próprio Discord não estiver em execução.",
    "richPresence.fakeFailed": "Não foi possível iniciá-lo: {error}",
    "richPresence.discordFirst":
        "O Discord iniciou antes do Zam, então os aplicativos informam ao Discord e o Zam não os vê.",
    "richPresence.restartDiscord": "Reiniciar o Discord",
    "richPresence.restartDiscordTitle": "Reiniciar o Discord?",
    "richPresence.restartDiscordBody":
        "O Discord vai fechar e abrir novamente, o que encerra qualquer chamada ou transmissão em que você estiver. O Zam assume o primeiro lugar para que os aplicativos informem a ele, e o Zam repassa ao Discord o que eles informam.",
    "richPresence.restartDiscordFailed":
        "Não foi possível reiniciar o Discord: {error}",
    "richPresence.autoRestart": "Reiniciar o Discord automaticamente",
    "richPresence.autoRestartHint":
        "Quando o Zam inicia e o Discord já está em execução antes dele, fecha e reabre o Discord para que os aplicativos informem ao Zam. Isso encerra qualquer chamada ou transmissão em que você estiver. Acontece uma vez a cada vez que o Zam inicia.",
    "richPresence.publishFailed": "Não foi possível atualizar seu perfil.",
    "richPresence.gameList": "Lista de jogos: {count} jogos, atualizada {when}",
    "richPresence.gameListDownloading": "Baixando a lista de jogos do Discord…",
    "richPresence.gameListFailed":
        "Não foi possível baixar a lista de jogos: {error}",
    "richPresence.addedGames": "Jogos registrados",
    "richPresence.addedGamesHint":
        "Jogos, aplicativos e players de mídia encontrados em execução, e programas que você mesmo adiciona. Cada um é permitido no seu perfil por padrão; desative os que você não quiser. Os jogos só são encontrados enquanto “Detectar jogos” estiver ativado, e os players de mídia só enquanto “Informar reprodução de mídia” estiver ativado.",
    "richPresence.addGame": "Adicionar um jogo",
    "richPresence.pickProgram": "Escolha um programa em execução",
    "richPresence.searchPrograms": "Pesquisar programas em execução",
    "richPresence.noPrograms": "Nenhum programa em execução encontrado.",
    "richPresence.gameName": "Nome exibido no seu perfil",
    "richPresence.refreshPrograms": "Atualizar",
    "richPresence.lastPlayed": "Jogado pela última vez {when}",
    "richPresence.neverPlayed": "Ainda não jogado",
    "richPresence.apps": "Aplicativos",
    "richPresence.noApps":
        "Nenhum aplicativo informou algo ainda. Os que informarem aparecerão aqui, permitidos a menos que você os desative.",
    "richPresence.allowApp": "Permitir {name}",
    "richPresence.forgetApp": "Esquecer {name}",
    "richPresence.forget": "Esquecer",
    "richPresence.viaDiscord": "Jogo ou Discord Rich Presence",
    "richPresence.viaMatrix": "Aplicativo Matrix",
    "richPresence.viaScan": "Varredura de processos",
    "richPresence.viaRpc": "Discord Rich Presence",
    "richPresence.viaMedia": "Player de mídia",
    "richPresence.viaPlugin": "Plugin",
    "richPresence.blocked": "Bloqueado",
    "richPresence.allowed": "Permitido",

    // src/lib/components/ui/RichPresenceCard.svelte
    "richPresenceCard.playing": "Jogando {name}",
    "richPresence.sharingTitle": "Exibido no seu perfil",
    "richPresenceCard.listening": "Ouvindo {name}",
    "richPresenceCard.elapsed": "{time} decorridos",
    "richPresenceCard.remaining": "{time} restantes",
    "richPresenceCard.openLinkTitle": "Abrir este link?",
    "richPresenceCard.openLinkBody":
        "{name} está pedindo para abrir este endereço no seu navegador:",
    "richPresenceCard.openidWarning":
        "Este link também leva um token OpenID da sua conta Matrix. O site pode usá-lo para descobrir seu ID Matrix e seu servidor doméstico, e verá seu endereço IP.",
    "richPresenceCard.open": "Abrir",
    "richPresenceCard.openFailed": "Não foi possível obter um token OpenID.",

    // src/lib/components/ui/GifPicker.svelte
    "gifPicker.searchFavourites": "Pesquisar favoritos…",
    "gifPicker.searchKlipy": "Pesquisar no KLIPY…",
    "gifPicker.searchFavourites2": "Pesquisar favoritos",
    "gifPicker.searchGifs": "Pesquisar GIFs",
    "gifPicker.gifResults": "Resultados de GIFs",
    "gifPicker.noFavouriteGifsYetStarA":
        "Nenhum GIF favorito ainda. Marque um GIF com estrela para salvá-lo aqui.",
    "gifPicker.favourites": "Favoritos",
    "gifPicker.gifTagged": "GIF com as tags {join}",
    "gifPicker.favouriteGif": "GIF favorito {value}",
    "gifPicker.editTags": "Editar tags",
    "gifPicker.catFunny": "gato, engraçado",
    "gifPicker.commaSeparatedEnterToSave":
        "Separadas por vírgula · Enter para salvar",
    "gifPicker.trending": "Em alta",
    "gifPicker.gifResult": "Resultado de GIF {value}",
    "gifPicker.favourite": "Favorito",
    "gifPicker.poweredByKlipy": "Com tecnologia KLIPY",

    // src/lib/components/layout/ImagePackEditor.svelte
    "imagePackEditor.addImage": "Adicionar imagem",
    "imagePackEditor.newPack": "Novo pacote",
    "imagePackEditor.packName": "Nome do pacote",
    "imagePackEditor.shortcode": "código curto",
    "imagePackEditor.useAsEmoji": "Usar como emoji",
    "imagePackEditor.useAsSticker": "Usar como figurinha",
    "imagePackEditor.inheritedFrom": "Herdado de {sourceName}",
    "imagePackEditor.sticker": "Figurinha",
    "imagePackEditor.removeImage": "Remover imagem",
    "imagePackEditor.noCustomImages": "Nenhuma imagem personalizada",
    "imagePackEditor.emotes": "Emotes de {value}",
    "imagePackEditor.room": "Sala",
    "imagePackEditor.chooseAtLeastOneUsage": "Escolha pelo menos um uso.",
    "imagePackEditor.enterAPackName": "Digite um nome para o pacote.",
    "imagePackEditor.uploadFailed": "Falha no envio",
    "imagePackEditor.failedToUpdateUsage": "Falha ao atualizar o uso",
    "imagePackEditor.failedToRemoveImage": "Falha ao remover a imagem",
    "imagePackEditor.failedToUpdatePack": "Falha ao atualizar o pacote",
    "imagePackEditor.addToMine": "Adicionar aos meus",
    "imagePackEditor.addAllToMyPack":
        "Copiar todas as imagens deste pacote para o seu próprio pacote",
    "imagePackEditor.addImageToMyPack":
        "Copiar esta imagem para o seu próprio pacote",
    "imagePackEditor.addedToYourPack":
        "{count, plural, one {# imagem adicionada ao seu pacote.} other {# imagens adicionadas ao seu pacote.}}",
    "imagePackEditor.alreadyInYourPack": "Já está no seu pacote.",
    "imagePackEditor.editDetails": "Editar detalhes",
    "imagePackEditor.deletePack": "Excluir pacote",
    "imagePackEditor.confirmDeletePack":
        "Excluir o pacote “{name}” e todas as suas imagens?",
    "imagePackEditor.useInAllRooms": "Usar em todas as minhas salas",
    "imagePackEditor.useInAllRoomsHint":
        "Os emojis e figurinhas dele aparecem em todo lugar em que você conversa.",
    "imagePackEditor.attribution": "Crédito: {value}",
    "imagePackEditor.attributionPlaceholder": "Crédito / atribuição (opcional)",
    "imagePackEditor.uploadPackAvatar": "Enviar ícone do pacote",
    "imagePackEditor.removePackAvatar": "Remover ícone",
    "imagePackEditor.avatarReady": "Ícone enviado, salve para aplicar.",
    "sharedPackSettings.yourPackDetails": "Detalhes do seu pacote",
    "sharedPackSettings.enabledEverywhere":
        "Pacotes ativados em todas as salas",
    "sharedPackSettings.enabledEverywhereHint":
        "Pacotes das salas em que você está podem ser usados em qualquer sala, não só na sala a que pertencem.",
    "sharedPackSettings.availableInYourRooms": "Pacotes nas suas salas",
    "sharedPackSettings.searchPacks": "Pesquisar pacotes",
    "sharedPackSettings.noPacksFound": "Nenhum pacote encontrado",
    "sharedPackSettings.noneEnabled": "Nenhum pacote ativado em todas as salas",
    "sharedPackSettings.enable": "Usar em todo lugar",
    "sharedPackSettings.disable": "Parar de usar em todo lugar",
    "sharedPackSettings.remove": "Remover",
    "sharedPackSettings.unavailable":
        "Indisponível: você não está mais em {room} ou o pacote foi removido",
    "sharedPackSettings.packSummary":
        "{room}, {count, plural, one {# imagem} other {# imagens}}",
    "sharedPackSettings.failedToSave": "Falha ao salvar",

    // src/lib/components/layout/InboxPanel.svelte
    "inboxPanel.inbox": "Caixa de entrada",
    "inboxPanel.noPendingInvites": "Nenhum convite pendente",
    "inboxPanel.roomInvitesWillAppearHere":
        "Os convites para salas aparecerão aqui.",
    "inboxPanel.pendingInvites": "Convites pendentes: {length}",
    "inboxPanel.invitedBy": "Convidado por {sender}",
    "inboxPanel.ignore": "Ignorar",
    "inboxPanel.accept": "Aceitar",
    "inboxPanel.pendingJoinRequests": "Pedidos de entrada pendentes: {length}",
    "inboxPanel.youAskedToJoinWaitingFor":
        "Você pediu para entrar - aguardando alguém deixar você entrar.",
    "inboxPanel.cancelRequest": "Cancelar pedido",
    "inboxPanel.failedToAcceptInvite": "Falha ao aceitar o convite",
    "inboxPanel.failedToRejectInvite": "Falha ao recusar o convite",
    "inboxPanel.failedToCancelJoinRequest":
        "Falha ao cancelar o pedido de entrada",

    // src/lib/components/layout/IncomingCallCard.svelte
    "incomingCallCard.incomingCall": "Chamada recebida",
    "incomingCallCard.declineCallFrom": "Recusar chamada de {name}",
    "incomingCallCard.accept": "Atender",
    "incomingCallCard.acceptCallFrom": "Atender chamada de {name}",
    "incomingCallCard.unknown": "Desconhecido",

    // src/lib/components/layout/InvitePanel.svelte
    "invitePanel.invitePeopleTo": "Convidar pessoas para",
    "invitePanel.invited": "Convidado",
    "invitePanel.failed": "Falhou",
    "invitePanel.inviteByEmail": "Convidar por e-mail",
    "invitePanel.nameExampleCom": "nome@exemplo.com",
    "invitePanel.inviting": "Convidando…",
    "invitePanel.invite": "Convidar",
    "invitePanel.invite2": "Convidar {length}",
    "invitePanel.enterAValidEmailAddress":
        "Digite um endereço de e-mail válido.",
    "invitePanel.couldNotSendTheEmailInvite":
        "Não foi possível enviar o convite por e-mail",
    "invitePanel.couldNotSendTheInvite": "Não foi possível enviar o convite",
    "invitePanel.thisRoom": "esta sala",
    "invitePanel.thisSpace": "este espaço",

    // src/lib/components/layout/JoinConsentDialog.svelte
    "joinConsentDialog.joinThisRoom": "Entrar nesta sala?",
    "joinConsentDialog.youClickedALinkTo": "Você clicou em um link para",
    "joinConsentDialog.joiningSharesYourMatrixIdWith":
        ". Entrar compartilha seu ID Matrix com todos na sala e a adiciona à sua lista de salas.",
    "joinConsentDialog.thisOpensRoom": "Isto abre a sala",
    "joinConsentDialog.warningThisLinkPointsAtA":
        "Aviso: este link aponta para um servidor diferente do da sala para a qual ele resolve. Continue somente se você confiar em quem o enviou.",
    "joinConsentDialog.joinRoom": "Entrar na sala",

    // src/lib/components/ui/Lightbox.svelte
    "lightbox.closeViewer": "Fechar visualizador de {mediaNoun}",
    "lightbox.viewer": "Visualizador de {MediaNoun}{value}",
    "lightbox.download": "Baixar",
    "lightbox.previous": "Anterior",
    "lightbox.previous2": "{mediaNoun} anterior",
    "lightbox.next": "Próximo",
    "lightbox.next2": "{mediaNoun} seguinte",
    "lightbox.couldNotLoadThisVideoUse":
        "Não foi possível carregar este vídeo. Use Baixar para salvá-lo.",
    "lightbox.video": "Vídeo",
    "lightbox.image": "Imagem",
    "lightbox.videoNoun": "vídeo",
    "lightbox.imageNoun": "imagem",
    "lightbox.zoomIn": "Aumentar zoom",
    "lightbox.zoomOut": "Diminuir zoom",
    "lightbox.zoomReset": "Redefinir zoom",

    // src/lib/components/messages/LinkPreview.svelte
    "linkPreview.youtubeVideo": "Vídeo do YouTube",
    "linkPreview.xTwitter": "X / Twitter",
    "linkPreview.loadingItContactsTheSiteHosting":
        "Carregar isso contata o site que o hospeda, o que revela seu endereço IP",
    "linkPreview.loadPreviewMedia": "Carregar mídia da prévia",
    "linkPreview.playVideo": "Reproduzir vídeo",

    // src/lib/components/layout/LiveLocationBanner.svelte
    "liveLocationBanner.openMap": "Abrir mapa",
    "liveLocationBanner.sharingLiveLocation":
        "Compartilhando localização em tempo real",
    "liveLocationBanner.lastUpdatedAt":
        " · última atualização às {timeOnly} ({updatedAgoLabel})",
    "liveLocationBanner.map": "Mapa",
    "liveLocationBanner.isSharingLiveLocation":
        "{getMemberName} está compartilhando localização em tempo real",
    "liveLocationBanner.peopleSharingLiveLocation":
        "{length} pessoas compartilhando localização em tempo real",
    "liveLocationBanner.viewMap": "Ver mapa",

    // src/lib/components/layout/LiveLocationMapView.svelte
    "liveLocationMapView.back": "Voltar",
    "liveLocationMapView.liveLocation": "Localização em tempo real",
    "liveLocationMapView.recenter": "Recentralizar",
    "liveLocationMapView.waitingForALocationFix": "Aguardando a localização…",
    "liveLocationMapView.sharingLiveLocation":
        "Compartilhando localização em tempo real",
    "liveLocationMapView.lastUpdatedAt":
        "última atualização às {timeOnly} ({updatedAgoLabel})",
    "liveLocationMapView.osm": "OSM",
    "liveLocationMapView.noActiveLiveSharesInThis":
        "Nenhum compartilhamento em tempo real ativo nesta sala.",
    "liveLocationMapView.you": "Você",

    // src/lib/components/messages/LocationBody.svelte
    "locationBody.openstreetmap": "OpenStreetMap",
    "locationBody.googleMaps": "Google Maps",

    // src/lib/components/layout/LoginView.svelte
    "loginView.signIn": "Entrar",
    "loginView.register": "Registrar",
    "loginView.zam": "Zam - {value}",
    "loginView.addAnAccount": "Adicionar uma conta",
    "loginView.welcomeBack": "Bem-vindo de volta!",
    "loginView.signInWithAnotherMatrixAccount": "Entrar com outra conta Matrix",
    "loginView.signInToYourMatrixAccount": "Entre na sua conta Matrix",
    "loginView.createAnAccount": "Criar uma conta",
    "loginView.registerOnAMatrixHomeserver":
        "Registrar-se em um servidor doméstico Matrix",
    "loginView.homeserver": "Servidor doméstico",
    "loginView.username": "Nome de usuário",
    "loginView.password": "Senha",
    "loginView.registrationToken": "Token de registro",
    "loginView.ifRequired": "(se necessário)",
    "loginView.leaveBlankIfNotRequired":
        "Deixe em branco se não for necessário",
    "loginView.useSlidingSync": "Usar sliding sync",
    "loginView.fasterStartupOnServersThatSupport":
        "Inicialização mais rápida em servidores que oferecem suporte.",
    "loginView.pleaseWait": "Aguarde…",
    "loginView.logIn": "Entrar",
    "loginView.createAccount": "Criar conta",
    "loginView.donTHaveAnAccount": "Não tem uma conta?",
    "loginView.alreadyHaveAnAccount": "Já tem uma conta?",
    "loginView.signIn2": "Entrar",
    "loginView.backTo": "← Voltar para {activeUserId}",
    "loginView.orContinueAs": "Ou continue como",
    "loginView.yourCredentialsAreSentDirectlyTo":
        "Suas credenciais são enviadas diretamente ao seu servidor doméstico e nunca são armazenadas por este aplicativo além do seu dispositivo.",
    "loginView.loggingIn": "Entrando…",
    "loginView.loginFailedCheckYourCredentials":
        "Falha ao entrar. Verifique suas credenciais.",
    "loginView.creatingAccount": "Criando conta…",
    "loginView.registrationFailed": "Falha no registro.",
    "loginView.or": "ou",
    "loginView.continueWithSso": "Continuar com SSO",
    "loginView.continueWith": "Continuar com {name}",
    "loginView.redirectingToSso":
        "Redirecionando para o seu provedor de login…",
    "loginView.finishSsoInBrowser":
        "Conclua o login no navegador e depois volte aqui.",
    "loginView.ssoCouldNotBeVerified":
        "Não foi possível verificar o login único. Tente novamente.",
    "loginView.ssoFailed": "Falha no login único.",
    "loginView.continue": "Continuar",
    "loginView.signInOnProviderPage":
        "Você vai entrar na página do seu próprio servidor doméstico e depois voltar aqui.",
    "loginView.oauthCancelled": "O login foi cancelado.",
    "loginView.oauthDenied":
        "O provedor de login recusou a solicitação: {reason}",
    "loginView.oauthCouldNotBeVerified":
        "Não foi possível verificar o login. Tente novamente.",
    "loginView.oauthFailed": "Falha no login. Tente novamente.",
    "loginView.oauthRegistrationRefused":
        "Este servidor não permitiu que o Zam se registrasse para o login.",
    "loginView.oauthRegistrationRefusedFallback":
        "Este servidor não permitiu que o Zam se registrasse para o login. Use uma das outras opções abaixo.",
    "loginView.checkingServer": "Verificando servidor…",
    "loginView.homeserverHint":
        "O servidor em que sua conta está: a parte depois dos dois-pontos em @voce:servidor.",
    "loginView.homeserverHintRegister":
        "Sua conta ficará neste servidor. Não tem certeza? O matrix.org é gratuito e aberto a todos.",
    "loginView.oauthLoginExplainer":
        "{server} faz seu login na própria página de conta. O Zam a abre, e você volta direto para cá já conectado.",
    "loginView.oauthRegisterExplainer":
        "{server} cria novas contas na própria página de conta. O Zam a abre; escolha ali um nome de usuário e uma senha, e você volta direto para cá já conectado.",
    "loginView.continueTo": "Continuar para {host}",
    "loginView.createAccountOn": "Criar conta em {server}",
    "loginView.advancedOptions": "Opções avançadas",

    // src/lib/components/layout/EncryptionSetupDialog.svelte
    "encryptionSetup.setupTitle": "Proteja suas mensagens",
    "encryptionSetup.setupBody":
        "Suas conversas privadas são criptografadas de ponta a ponta. Configure a recuperação para poder lê-las em qualquer dispositivo em que você entrar depois, mesmo que perca este. Leva alguns segundos.",
    "encryptionSetup.passwordBody":
        "Digite a senha da sua conta para confirmar que é você.",
    "encryptionSetup.setUp": "Configurar recuperação",
    "encryptionSetup.later": "Agora não",
    "encryptionSetup.saveKeyTitle": "Salve sua chave de recuperação",
    "encryptionSetup.saveKeyBody":
        "Esta chave desbloqueia suas mensagens criptografadas em um novo dispositivo. Ela é mostrada apenas uma vez: salve-a em um gerenciador de senhas ou baixe-a. Sem ela, perder um dispositivo pode significar perder mensagens.",
    "encryptionSetup.downloadKey": "Baixar",
    "encryptionSetup.keyFileHeader":
        "Chave de recuperação do Zam para {userId}",
    "encryptionSetup.doneTitle": "Tudo pronto",
    "encryptionSetup.doneBody":
        "A criptografia está configurada neste dispositivo. Suas mensagens e seu histórico de outros dispositivos estão disponíveis aqui.",
    "encryptionSetup.confirmTitle": "Confirme que é você",
    "encryptionSetup.confirmBody":
        "Esta conta já usa criptografia. Confirme este novo dispositivo para que ele possa ler suas mensagens e seu histórico criptografados.",
    "encryptionSetup.useAnotherDevice": "Usar outro dispositivo",
    "encryptionSetup.useRecoveryKey": "Usar chave de recuperação",
    "encryptionSetup.anotherDeviceHint":
        "Outro dispositivo é aquele em que você já está conectado, como o aplicativo Zam ou Element no seu celular. Ele mostrará uma solicitação para aprovar.",
    "encryptionSetup.recoveryKeyHint":
        "Sua chave de recuperação começa com “EsT”. Você a salvou quando configurou a criptografia pela primeira vez.",
    "encryptionSetup.cantConfirm":
        "Perdeu sua chave de recuperação e os outros dispositivos?",
    "encryptionSetup.enterKeyTitle": "Digite sua chave de recuperação",
    "encryptionSetup.enterKeyBody":
        "Cole a chave de recuperação que você salvou ao configurar a criptografia. Os espaços não importam.",
    "encryptionSetup.enterPassphraseBody":
        "Digite a frase secreta de recuperação que você escolheu ao configurar a criptografia.",
    "encryptionSetup.back": "Voltar",
    "encryptionSetup.connectBackupTitle": "Restaure seu histórico de mensagens",
    "encryptionSetup.connectBackupBody":
        "Este dispositivo está verificado, mas ainda não está conectado ao backup das suas mensagens criptografadas. Digite sua chave de recuperação para restaurar seu histórico.",
    "encryptionSetup.checking": "Verificando sua criptografia…",
    "encryptionSetup.tryAgain": "Tentar novamente",
    "encryptionSetup.openSecuritySettings": "Abrir configurações de segurança",

    // src/lib/matrix/registration.ts
    "registration.cancelled": "A criação da conta foi cancelada.",
    "registration.noSupportedFlow":
        "Este servidor pede uma etapa de cadastro que o Zam não consegue concluir. Tente criar a conta no site do próprio servidor.",
    "registration.stageKeptFailing":
        "O servidor continuou rejeitando uma etapa do cadastro. Tente novamente.",
    "registration.userInUse":
        "Esse nome de usuário já está em uso. Tente outro.",
    "registration.invalidUsername":
        "Esse nome de usuário não é permitido. Use letras minúsculas, números e . _ = - /",
    "registration.exclusiveUsername":
        "Esse nome de usuário é reservado neste servidor. Tente outro.",
    "registration.weakPassword":
        "Essa senha é fraca demais. Tente uma mais longa.",
    "registration.weakPasswordReason": "Essa senha é fraca demais: {reason}",
    "registration.emailInUse":
        "Esse endereço de e-mail já é usado por outra conta.",
    "registration.emailNotAllowed":
        "Este servidor não aceita esse endereço de e-mail.",
    "registration.rateLimited":
        "Muitas tentativas. Aguarde um minuto e tente novamente.",
    "registration.stepNotAccepted":
        "O servidor não aceitou essa etapa. Tente novamente.",
    "registration.closed": "Este servidor não está aceitando novas contas.",
    "registration.invalidToken":
        "Esse token de registro não é válido. Verifique-o e tente novamente.",
    "registration.refused": "O servidor se recusou a criar a conta.",
    "registration.refusedReason":
        "O servidor se recusou a criar a conta: {reason}",
    "registration.serverUnreachable":
        "Não foi possível alcançar o servidor. Verifique o endereço e sua conexão.",
    "registration.usernameLowercase":
        "Os nomes de usuário devem estar em letras minúsculas.",
    "registration.usernameCharacters":
        "Use apenas letras minúsculas, números e . _ = - /",
    "registration.usernameHint":
        "Escolha um nome de usuário. As pessoas vão encontrar você por ele.",
    "registration.usernameAvailable": "{userId} está disponível",
    "registration.yourAddressWillBe": "Seu endereço será {userId}",
    "registration.confirmPassword": "Confirmar senha",
    "registration.passwordsDontMatch": "As senhas não coincidem.",
    "registration.closedOnServer":
        "{server} não está aceitando novas contas no momento. Escolha outro servidor para criar uma.",
    "registration.useOtherServer": "Criar uma conta em {server} em vez disso",
    "registration.tokenTitle": "Token de registro",
    "registration.tokenBody":
        "{server} é somente por convite. Digite o token de registro que o administrador do servidor passou a você.",
    "registration.termsTitle": "Aceite os termos do servidor",
    "registration.termsBody":
        "{server} pede que você aceite estes termos antes de criar sua conta:",
    "registration.termsAccept": "Li e aceito estes termos",
    "registration.emailTitle": "Confirme seu e-mail",
    "registration.emailBody":
        "{server} precisa de um endereço de e-mail para criar sua conta. Enviaremos um link para confirmá-lo.",
    "registration.emailPlaceholder": "voce@exemplo.com",
    "registration.sendEmail": "Enviar e-mail",
    "registration.emailSent":
        "Enviamos um link para {email}. Abra-o, volte aqui e pressione Continuar.",
    "registration.emailNotConfirmed":
        "O e-mail ainda não foi confirmado. Abra o link nele e pressione Continuar.",
    "registration.emailConfirmed": "Continuar",
    "registration.captchaTitle": "Prove que você não é um robô",
    "registration.captchaBody":
        "{server} quer que você resolva um captcha. Ele abre na página do servidor; volte aqui quando terminar.",
    "registration.fallbackTitle": "Mais uma etapa",
    "registration.fallbackBody":
        "{server} precisa que você conclua uma etapa na própria página dele. Volte aqui quando terminar.",
    "registration.openStepPage": "Abrir página",
    "registration.stepDone": "Terminei",

    // src/lib/components/layout/MemberList.svelte
    "memberList.members": "Membros: {length}",
    "memberList.creators": "Criadores: {length}",
    "memberList.admins": "Administradores: {length}",
    "memberList.admin": "Administrador",
    "memberList.moderators": "Moderadores: {length}",

    // src/lib/components/messages/MessageActionsSheet.svelte
    "messageActionsSheet.thisMessage": "{label} esta mensagem?",
    "messageActionsSheet.messageActions": "Ações da mensagem",

    // src/lib/components/layout/MessageArea.svelte
    "messageArea.dropToAttach": "Solte para anexar",
    "messageArea.cachedRoomHint":
        "Mostrando as mensagens salvas neste dispositivo. Você poderá enviar quando a sala terminar de carregar.",
    "messageArea.unreadNotifications": "Notificações não lidas",
    "messageArea.encryptionEnabled": "Criptografia ativada",
    "messageArea.joiningVoiceCall": "Entrando na chamada de voz…",
    "messageArea.startVoiceCall": "Iniciar chamada de voz",
    "messageArea.showCall": "Abrir visualização da chamada",
    "messageArea.searchMessages": "Pesquisar mensagens",
    "messageArea.threads": "Tópicos",
    "messageArea.toggleThreadsList": "Mostrar/ocultar lista de tópicos",
    "messageArea.unreadThreadMentions": "Menções não lidas em tópicos",
    "messageArea.unreadThreads": "Tópicos não lidos",
    "messageArea.pinnedMessages": "Mensagens fixadas",
    "messageArea.notificationsInbox": "Caixa de notificações",
    "messageArea.mediaAndFiles": "Mídia e arquivos",
    "messageArea.toggleMemberList": "Mostrar/ocultar lista de membros",
    "messageArea.more": "Mais",
    "messageArea.moreRoomOptions": "Mais opções da sala",
    "messageArea.messageTimeline": "Linha do tempo de mensagens",
    "messageArea.welcomeTo": "Bem-vindo a #",
    "messageArea.thisIsTheBeginningOfThe": "Este é o início da sala #",
    "messageArea.loadingHistory": "Carregando mensagens mais antigas",
    "messageArea.room": ".",
    "messageArea.newMessages": "Novas mensagens",
    "messageArea.unreadSince":
        "{count, plural, one {# nova mensagem desde {since}} other {# novas mensagens desde {since}}}",
    "messageArea.markAsRead": "Marcar como lida",
    "messageArea.unreadSinceMany": "{count}+ novas mensagens desde {since}",
    "messageArea.unreadMany": "{count}+ novas mensagens",
    "messageArea.messageFromABlockedUser": "Mensagem de um usuário bloqueado",
    "messageArea.showBlockedMessage": "Mostrar mensagem bloqueada",
    "messageArea.thisRoomHasBeenUpgraded": "Esta sala foi atualizada",
    "messageArea.goToNewRoom": "Ir para a nova sala",
    "messageArea.joinNewRoom": "Entrar na nova sala",
    "messageArea.jumpToPresent": "Ir para o presente",
    "messageArea.searchingForMessage": "Procurando a mensagem…",
    "messageArea.viewingMessageContext": "Vendo o contexto da mensagem",
    "messageArea.returnToLive": "Voltar ao vivo",
    "messageArea.closePanel": "Fechar painel",
    "messageArea.someone": "Alguém",
    "messageArea.pinnedMessagesCount": "Mensagens fixadas ({count})",

    // src/lib/components/messages/MessageInput.svelte
    "messageInput.replyingTo": "Respondendo a {replyTargetName}",
    "messageInput.cancelReplyEsc": "Cancelar resposta (Esc)",
    "messageInput.editAttachment": "Editar anexo",
    "messageInput.editAttachment2": "Editar anexo {name}",
    "messageInput.custom": "personalizado",
    "messageInput.yourEmotes": "Seus emotes",
    "messageInput.yourNextMessageWillStartA":
        "Sua próxima mensagem iniciará um",
    "messageInput.thread": "tópico",
    "messageInput.cancelThreadCreation": "Cancelar criação do tópico",
    "messageInput.favouriteGifs": "GIFs favoritos",
    "messageInput.sendMessage": "Enviar mensagem",
    "messageInput.isTyping": "{value} está digitando…",
    "messageInput.andAreTyping": "{value} e {value2} estão digitando…",
    "messageInput.andAreTyping2":
        "{value}, {value2} e {value3} estão digitando…",
    "messageInput.severalPeopleAreTyping": "Várias pessoas estão digitando…",
    "messageInput.noPermissionToSend":
        "Você não tem permissão para enviar mensagens aqui",
    "messageInput.selectARoomToStartChatting":
        "Selecione uma sala para começar a conversar",
    "messageInput.replyInThread": "Responder no tópico...",
    "messageInput.replyTo": "Responder a {replyTargetName}...",
    "messageInput.message": "Mensagem em #{roomName}",
    "messageInput.isNotAValidUser": "“{token}” não é um usuário válido",
    "messageInput.noRoomSelected": "Nenhuma sala selecionada",
    "messageInput.isNotInThisRoom": "{userId} não está nesta sala",
    "messageInput.youDonTHavePermissionTo":
        "Você não tem permissão para alterar os níveis de poder nesta sala",
    "messageInput.unhandledCommand": "Comando não tratado: /{name}",
    "messageInput.commandFailed": "Falha no comando",
    "messageInput.failedToSend": "Falha ao enviar",
    "messageInput.unknownCommandEnterAgain":
        "Comando desconhecido: /{unknown}. Pressione Enter novamente para enviá-lo como mensagem.",
    "messageInput.unknownCommandTapAgain":
        "Comando desconhecido: /{unknown}. Toque em enviar novamente para enviá-lo como mensagem.",
    "messageInput.sedNoMessage":
        "Você não tem nenhuma mensagem aqui para editar",
    "messageInput.sedNoMatch": "“{pattern}” não está na sua última mensagem",
    "messageInput.sedEmpty": "Isso deixaria sua última mensagem vazia",
    "messageInput.sedFailed": "Não foi possível editar sua última mensagem",
    "messageInput.sendingAttachments":
        "{count, plural, one {Enviando # anexo…} other {Enviando # anexos…}}",

    // src/lib/components/messages/MessageItem.svelte
    "messageItem.viewProfile": "Ver perfil",
    "messageItem.jumpToTheRepliedToMessage": "Ir para a mensagem respondida:",
    "messageItem.originalMessageNotLoaded": "Mensagem original não carregada",
    "messageItem.originalMessageDeleted": "Mensagem original excluída",
    "messageItem.originalMessageUnavailable": "Mensagem original indisponível",
    "messageItem.replyPreviewSticker": "Figurinha",
    "messageItem.requestKeys": "Solicitar chaves",
    "messageItem.keysRequested": "Chaves solicitadas",
    "messageItem.requestKeysHelp":
        "Tente novamente, verifique o backup das suas chaves e peça às sessões do remetente a chave desta mensagem",
    "messageItem.replyPreviewPoll": "Enquete",
    "messageItem.replyPreviewImage": "Imagem",
    "messageItem.replyPreviewVideo": "Vídeo",
    "messageItem.replyPreviewAudio": "Áudio",
    "messageItem.replyPreviewFile": "Arquivo",
    "messageItem.edited": "(editada)",
    "messageItem.decryptingImage": "Descriptografando imagem...",
    "messageItem.couldnTDecryptImage":
        "Não foi possível descriptografar a imagem",
    "messageItem.imageUnavailable": "[Imagem indisponível]",
    "messageItem.decryptingVideo": "Descriptografando vídeo...",
    "messageItem.couldnTDecryptVideo":
        "Não foi possível descriptografar o vídeo",
    "messageItem.video": "Vídeo",
    "messageItem.canTBePlayedHere": "Não pode ser reproduzido aqui",
    "messageItem.playbackFailedClickToRetry":
        "Falha na reprodução · Clique para tentar novamente",
    "messageItem.clickToPlay": "{videoDuration} · Clique para reproduzir",
    "messageItem.clickToPlay2": "Clique para reproduzir",
    "messageItem.audio": "Áudio",
    "messageItem.kb": "{toFixed} KB",
    "messageItem.mb": "{toFixed} MB",
    "mediaProgress.ofTotal": "{loaded} de {total}",
    "messageItem.fileAttachment": "Anexo de arquivo",
    "messageItem.download": "Baixar",
    "messageItem.toSave": "para salvar ·",
    "messageItem.toCancel": "para cancelar",
    "messageItem.openThread": "Abrir tópico",
    "messageItem.failedToSend": "Falha ao enviar.",
    "messageItem.retrying": "Tentando novamente…",
    "messageItem.showWhoReadThisMessage": "Mostrar quem leu esta mensagem",
    "messageItem.readThis":
        "{count, plural, one {# pessoa leu isto} other {# pessoas leram isto}}",
    "messageItem.readBy": "Lida por",
    "messageItem.messageActions": "Ações da mensagem",
    "messageItem.editMessage": "Editar mensagem",
    "messageItem.delete": "Excluir?",
    "messageItem.yesDeleteMessage": "Sim, excluir mensagem",
    "messageItem.yes": "Sim",
    "messageItem.noKeepMessage": "Não, manter mensagem",
    "messageItem.no": "Não",
    "messageItem.deleteMessage": "Excluir mensagem",
    "messageItem.unpinMessage": "Desafixar mensagem",
    "messageItem.pinMessage": "Fixar mensagem",
    "messageItem.addReaction": "Adicionar reação",
    "messageItem.reply": "Responder",
    "messageItem.replyInThread": "Responder no tópico",
    "messageItem.forwardMessage": "Encaminhar mensagem",
    "messageItem.moreActions": "Mais ações",
    "messageItem.linkCopied": "Link copiado!",
    "messageItem.copyMessageLink": "Copiar link da mensagem",
    "messageItem.linkCopied2": "Link copiado",
    "messageItem.couldnTDeleteTheMessage":
        "Não foi possível excluir a mensagem",
    "messageItem.couldnTCopyTheMessageLink":
        "Não foi possível copiar o link da mensagem",
    "messageItem.failedToUnpinMessage": "Falha ao desafixar a mensagem",
    "messageItem.failedToPinMessage": "Falha ao fixar a mensagem",
    "messageItem.couldNotOpenTheMatrixLink":
        "Não foi possível abrir o link do Matrix",
    "messageItem.viewSource": "Ver código-fonte",

    // src/lib/components/messages/ViewSourceDialog.svelte
    "viewSource.title": "Código-fonte da mensagem",
    "viewSource.decrypted": "Evento descriptografado",
    "viewSource.encrypted": "Evento original (criptografado)",
    "viewSource.copied": "Copiado",

    // src/lib/components/messages/MessageRedactAction.svelte
    "messageRedactAction.removeMessage": "Remover mensagem",
    "messageRedactAction.removeThisMessage": "Remover esta mensagem?",
    "messageRedactAction.removing": "Removendo…",
    "messageRedactAction.failedToRemoveMessage": "Falha ao remover a mensagem",

    // src/lib/components/messages/MessageReportAction.svelte
    "messageReportAction.reportMessage": "Denunciar mensagem",
    "messageReportAction.reportSent": "Denúncia enviada",
    "messageReportAction.whyAreYouReportingThisMessage":
        "Por que você está denunciando esta mensagem?",
    "messageReportAction.markAsExtremelyOffensive":
        "Marcar como extremamente ofensiva",
    "messageReportAction.reporting": "Denunciando…",
    "messageReportAction.report": "Denunciar",

    // src/lib/components/layout/MessageSearchPanel.svelte
    "messageSearchPanel.searchMessages": "Pesquisar mensagens",
    "messageSearchPanel.searchTryFromOrHasImage":
        "Pesquisar - tente from: ou has:image",
    "messageSearchPanel.searchForMessagesInThisRoom":
        "Pesquise mensagens nesta sala.",
    "messageSearchPanel.noMatchesInTheResultsLoaded":
        "Nenhuma correspondência nos resultados carregados até agora.",
    "messageSearchPanel.noResultsFor": "Nenhum resultado para “{searched}”.",
    "messageSearchPanel.searchFailed": "Falha na pesquisa",
    "messageSearchPanel.resultCount":
        "{count, plural, one {# resultado} other {# resultados}}",

    // src/lib/components/settings/MessagesMediaSettings.svelte
    "messagesMediaSettings.messages": "Mensagens",
    "messagesMediaSettings.showMatrixIds": "Mostrar IDs Matrix",
    "messagesMediaSettings.showFullMatrixIdsLikeUser":
        "Mostra IDs Matrix completos, como @usuario:servidor, em vez de nomes de exibição em todo o aplicativo.",
    "messagesMediaSettings.readReceiptAvatars":
        "Avatares de confirmação de leitura",
    "messagesMediaSettings.showWhoHasReadEachMessage":
        "Mostra quem leu cada mensagem como pequenos avatares abaixo dela. Isso só muda o que você vê neste dispositivo - para impedir que os outros vejam até onde você leu, use Confirmações de leitura privadas em Privacidade e segurança.",
    "messagesMediaSettings.holdToOpenMessageMenu":
        "Pressionar e segurar para abrir o menu da mensagem",
    "messagesMediaSettings.onTouchDevicesOpenAMessage":
        "Em dispositivos de toque, abre as ações de uma mensagem ao pressioná-la e segurá-la, em vez de tocar. Desativado, um toque abre o menu.",
    "messagesMediaSettings.checkSpelling": "Verificar ortografia",
    "messagesMediaSettings.underlineMisspelledWordsAnd":
        "Sublinha palavras com erro de ortografia e oferece correções enquanto você digita. Desative para parar a verificação ortográfica e a correção automática do teclado nos editores de mensagem neste dispositivo.",
    "messagesMediaSettings.linkPreviews": "Prévias de links",
    "messagesMediaSettings.whenOffNoLinkPreviewIs":
        "Desativado, nenhuma prévia de link é carregada e seu servidor doméstico nunca busca a página do link em seu nome. Controle de onde a mídia da prévia é carregada em Privacidade e segurança.",
    "messagesMediaSettings.pauseVideosOffScreen": "Pausar vídeos fora da tela",
    "messagesMediaSettings.pauseAPlayingVideoWhenIt":
        "Pausa um vídeo em reprodução quando ele sai da área visível, para economizar bateria. Você o reinicia por conta própria ao rolar de volta.",
    "messagesMediaSettings.sendVideosThatStreamFaster":
        "Enviar vídeos que carregam mais rápido",
    "messagesMediaSettings.rearrangeMp4VideosYouSend":
        "Reorganiza os vídeos MP4 que você envia para que possam começar a ser reproduzidos enquanto são baixados. Nada é recodificado e a imagem não muda. Desative para enviar os arquivos exatamente como estão.",
    "messagesMediaSettings.sendPhotosThatAppearSooner":
        "Enviar fotos que aparecem mais cedo",
    "messagesMediaSettings.rewriteJpegPhotosYouSend":
        "Reescreve as fotos JPEG que você envia para que as pessoas vejam a imagem inteira de imediato e ela fique mais nítida durante o download. Nada é recodificado e a imagem não muda. Desative para enviar os arquivos exatamente como estão.",
    "messagesMediaSettings.removeLocationAndMetadata":
        "Remover localização e outros metadados dos envios",
    "messagesMediaSettings.stripMetadataDescription":
        "Remove EXIF, localização GPS, detalhes da câmera e outros metadados ocultos das fotos e vídeos que você envia. A imagem não muda, e a rotação é mantida para que as fotos continuem na posição correta.",
    "messagesMediaSettings.stripMetadataWarning":
        "Aviso: com isto desativado, os arquivos que você envia podem vazar suas informações pessoais, inclusive o local onde foram feitos.",
    "messagesMediaSettings.randomizeFileNames": "Aleatorizar nomes de arquivo",
    "messagesMediaSettings.randomizeFileNamesDescription":
        "Envia os arquivos com um nome aleatório formado por letras e números em vez do nome real. A extensão do arquivo é mantida, inclusive as como .tar.gz.",
    "messagesMediaSettings.sendGifsAsAnimatedWebp":
        "Enviar GIFs como WebP animado",
    "messagesMediaSettings.reencodeGifsYouSend":
        "Recodifica os GIFs que você envia como WebP animado sem perdas, que costuma ser menor e pode ser reproduzido durante o download. A imagem não muda. Um GIF que não ficaria menor é enviado como está.",
    "messagesMediaSettings.defaultTab": "Aba padrão",
    "messagesMediaSettings.whichTabTheGifPickerOpens":
        "Em qual aba o seletor de GIFs abre.",
    "messagesMediaSettings.defaultGifTab": "Aba padrão de GIFs",
    "messagesMediaSettings.favourites": "Favoritos",
    "midiSoundBank.midi": "MIDI",
    "midiSoundBank.soundBank": "Banco de sons",
    "midiSoundBank.theInstrumentSoundsUsedTo":
        "Os sons de instrumentos usados para reproduzir anexos MIDI.",
    "midiSoundBank.system": "Sistema",
    "midiSoundBank.included": "Incluído",
    "midiSoundBank.custom": "Personalizado",
    "midiSoundBank.noSystemSoundBankFound":
        "Nenhum banco de sons do sistema foi encontrado neste dispositivo, então o incluído é usado.",
    "midiSoundBank.chooseFile": "Escolher arquivo",
    "midiSoundBank.chooseAnotherFile": "Escolher outro arquivo",
    "midiSoundBank.saving": "Salvando…",
    "midiSoundBank.sf2Sf3OrDlsUpTo":
        "Personalizado: um arquivo SF2, SF3 ou DLS de até 256 MB, mantido neste dispositivo.",
    "midiSoundBank.useAnSf2Sf3OrDls": "Use um arquivo SF2, SF3 ou DLS.",
    "midiSoundBank.thatFileIsEmpty": "Esse arquivo está vazio.",
    "midiSoundBank.fileIsTooLarge":
        "Esse arquivo é grande demais (máx. 256 MB).",
    "midiSoundBank.notASoundBank": "Esse arquivo não é um banco de sons.",
    "midiSoundBank.couldNotSave":
        "Não foi possível salvar o banco de sons neste dispositivo (o armazenamento pode estar cheio).",

    // src/lib/components/ui/ModalDialog.fixture.svelte
    "modalDialog.fixture.fixtureDialog": "Caixa de diálogo de teste",

    // src/lib/components/settings/NotificationSettings.svelte
    "notificationSettings.thisDevice": "Este dispositivo",
    "notificationSettings.systemPermission": "Permissão do sistema",
    "notificationSettings.pushNotifications": "Notificações push",
    "notificationSettings.permissionIsBlockedInSystemSettings":
        "A permissão está bloqueada nas configurações do sistema",
    "notificationSettings.notificationsAreNotSupportedHere":
        "Não há suporte a notificações aqui",
    "notificationSettings.allowThisAppToSendNotifications":
        "Permitir que este aplicativo envie notificações",
    "notificationSettings.requesting": "Solicitando…",
    "notificationSettings.blocked": "Bloqueado",
    "notificationSettings.unavailable": "Indisponível",
    "notificationSettings.enable": "Ativar",
    "notificationSettings.pushService": "Serviço de push",
    "notificationSettings.pushServiceLabel": "Entregue por",
    "notificationSettings.pushServiceDescription":
        "Como as notificações chegam a este dispositivo enquanto o aplicativo está fechado. O UnifiedPush funciona sem os serviços do Google, por meio de um aplicativo distribuidor como o ntfy.",
    "notificationSettings.pushServiceAutomatic": "Automático",
    "notificationSettings.pushServiceFcm": "Google (Firebase)",
    "notificationSettings.pushServiceFcmUnavailable":
        "Google (Firebase), indisponível aqui",
    "notificationSettings.pushServiceUnifiedPush": "UnifiedPush: {label}",
    "notificationSettings.pushServiceNoDistributor":
        "Nenhum distribuidor UnifiedPush está instalado. Instale um (por exemplo, o ntfy) para receber notificações sem os serviços do Google.",
    "notificationSettings.pushServiceActiveFcm":
        "Usando atualmente o Google (Firebase).",
    "notificationSettings.pushServiceActiveUnifiedPush":
        "Usando atualmente o UnifiedPush ({label}).",
    "notificationSettings.pushServiceActiveNone":
        "Nenhum serviço de push está ativo, então as notificações só chegam enquanto o aplicativo está aberto.",
    "notificationSettings.pushServiceSwitchFailed":
        "Não foi possível trocar o serviço de push",
    "notificationSettings.sound": "Som",
    "notificationSettings.notificationSound": "Som de notificação",
    "notificationSettings.playASoundForLoudNotifications":
        "Tocar um som para notificações com som",
    "notificationSettings.desktopAlerts": "Alertas do desktop",
    "notificationSettings.popUpAndTaskbarFlash":
        "Pop-up e piscar da barra de tarefas",
    "notificationSettings.whichNotificationsShowASystemPop":
        "Quais notificações mostram um pop-up do sistema e fazem o ícone da barra de tarefas piscar enquanto a janela está em segundo plano.",
    "notificationSettings.popUps": "Pop-ups",
    "notificationSettings.popUpNotifications": "Notificações em pop-up",
    "notificationSettings.whichNotificationsShowASystemPopUp":
        "Quais notificações mostram um pop-up do sistema enquanto o aplicativo está em segundo plano.",
    "notificationSettings.multipleDevices": "Vários dispositivos",
    "notificationSettings.quietOnMyOtherDevices":
        "Silêncio nos meus outros dispositivos",
    "notificationSettings.whileYouReActivelyUsingOne":
        "Enquanto você está usando ativamente um dispositivo, os outros pulam o som e o pop-up de notificação até que esse dispositivo fique inativo por esse tempo. Vale para todos os dispositivos da sua conta; as notificações ainda aparecem na sua caixa de entrada e as contagens de não lidas não mudam.",
    "notificationSettings.custom": "Personalizado…",
    "notificationSettings.customQuietDurationInMinutes":
        "Duração de silêncio personalizada, em minutos",
    "notificationSettings.minutesMax":
        "minutos (máx. {MAX_CUSTOM_GRACE_MINUTES})",
    "notificationSettings.couldnTSaveToYourAccount":
        "Não foi possível salvar na sua conta - seus outros dispositivos podem manter a configuração antiga. Verifique sua conexão e tente novamente.",
    "notificationSettings.retrySavingTheOtherDeviceQuiet":
        "Tentar salvar novamente a configuração de silêncio dos outros dispositivos",
    "notificationSettings.retrying": "Tentando novamente…",
    "notificationSettings.rules": "Regras",
    "notificationSettings.notificationRules": "Regras de notificação",
    "notificationSettings.loudNotifyWithSoundSilentNotify":
        "Com som = notifica com som · Silenciosa = notifica sem som · Desativada = nenhuma notificação",
    "notificationSettings.keywordHighlights": "Destaques de palavras-chave",
    "notificationSettings.getNotifiedWhenAMessageContains":
        "Seja notificado quando uma mensagem contiver uma palavra ou frase. A correspondência não diferencia maiúsculas de minúsculas;",
    "notificationSettings.and": "e",
    "notificationSettings.areWildcards": "são curingas.",
    "notificationSettings.addAKeyword": "Adicionar uma palavra-chave…",
    "notificationSettings.newKeyword": "Nova palavra-chave",
    "notificationSettings.noKeywordRulesYet":
        "Nenhuma regra de palavra-chave ainda.",
    "notificationSettings.behaviorFor": "Comportamento para {pattern}",
    "notificationSettings.enable2": "Ativar {pattern}",
    "notificationSettings.loudOnly": "Somente com som",
    "notificationSettings.onlyNotificationsThatMakeASound":
        "Somente notificações que fazem som",
    "notificationSettings.silentAndLoud": "Silenciosas e com som",
    "notificationSettings.everyNotificationLoudOrSilent":
        "Todas as notificações, com som ou silenciosas",
    "notificationSettings.none": "Nenhuma",
    "notificationSettings.neverAlertOnThisDevice":
        "Nunca alertar neste dispositivo",
    "notificationSettings.couldNotSaveNotificationSetting":
        "Não foi possível salvar a configuração de notificação",
    "notificationSettings.highlightSound": "Destaque + som",
    "notificationSettings.notifyWithAHighlightAndSound":
        "Notifica com destaque e som",
    "notificationSettings.highlight": "Destaque",
    "notificationSettings.notifyWithAHighlight": "Notifica com destaque",
    "notificationSettings.notify": "Notificar",
    "notificationSettings.notifyWithoutAHighlight": "Notifica sem destaque",
    "notificationSettings.failedToAddKeyword":
        "Falha ao adicionar a palavra-chave",
    "notificationSettings.failedToUpdateKeyword":
        "Falha ao atualizar a palavra-chave",
    "notificationSettings.failedToDeleteKeyword":
        "Falha ao excluir a palavra-chave",
    "notificationSettings.accountNotificationsOff":
        "As notificações estão desativadas para esta conta",
    "notificationSettings.accountNotificationsOffDetail":
        "Todas as notificações desta conta estão desativadas no servidor, provavelmente a partir de outro aplicativo, então nada notifica em nenhum dispositivo, independentemente das configurações abaixo.",
    "notificationSettings.accountNotifications": "Notificações desta conta",
    "notificationSettings.accountNotificationsDetail":
        "Ativa ou desativa as notificações desta conta em todos os seus dispositivos.",
    "notificationSettings.thisDeviceNotifications":
        "Notificações neste dispositivo",
    "notificationSettings.thisDeviceNotificationsDetail":
        "Desativa pop-ups, sons e push apenas neste dispositivo. Seus outros dispositivos continuam notificando.",
    "notificationSettings.couldNotUpdateNotifications":
        "Não foi possível atualizar as configurações de notificação",
    "notificationSettings.turnOn": "Ativar",
    "notificationSettings.couldNotTurnOnNotifications":
        "Não foi possível ativar as notificações",

    // src/lib/components/layout/NotificationsPanel.svelte
    "notificationsPanel.clearAll": "Limpar tudo",
    "notificationsPanel.couldNotRefreshServerNotificationsTap":
        "Não foi possível atualizar as notificações do servidor. Toque para tentar novamente.",
    "notificationsPanel.noNotifications": "Nenhuma notificação.",
    "notificationsPanel.jumpToMessage": "Ir para a mensagem:",
    "notificationsPanel.in": "em #{roomName}",
    "notificationsPanel.message": "(mensagem)",

    // src/lib/components/messages/OutboxStrip.svelte
    "outboxStrip.queued": "Na fila",
    "outboxStrip.sending": "Enviando…",
    "outboxStrip.failed": "Falhou",

    // src/lib/components/layout/OwnStatusEditor.svelte
    "ownStatusEditor.pickAStatusEmoji": "Escolha um emoji de status",
    "ownStatusEditor.whatSHappening": "O que está acontecendo?",
    "ownStatusEditor.statusText": "Texto do status",
    "ownStatusEditor.clearStatus": "Limpar status",
    "ownStatusEditor.couldNotSaveStatus": "Não foi possível salvar o status",

    // src/lib/components/layout/PinnedMessagesPanel.svelte
    "pinnedMessagesPanel.pinnedMessages": "Mensagens fixadas",
    "pinnedMessagesPanel.noPinnedMessages": "Nenhuma mensagem fixada.",
    "pinnedMessagesPanel.jump": "Ir",
    "pinnedMessagesPanel.unpin": "Desafixar",

    // src/lib/components/plugins/PluginPopoverHost.svelte
    "pluginPopoverHost.plugin": "Plugin",

    // src/lib/components/settings/PluginSettingsForm.svelte
    "pluginSettingsForm.backToPlugins": "Voltar aos plugins",
    "pluginSettingsForm.settings": "Configurações de {pluginName}",
    "pluginSettingsForm.thisPluginHasNoSettings":
        "Este plugin não tem configurações.",
    "pluginSettingsForm.moveUp": "Mover para cima",
    "pluginSettingsForm.moveDown": "Mover para baixo",
    "pluginSettingsForm.removeRow": "Remover linha",

    // src/lib/components/settings/PluginsSettings.svelte
    "pluginsSettings.back": "← Voltar",
    "pluginsSettings.syncYourEnabledPluginsSettingsTo":
        "Sincronize seus plugins ativados + configurações com a sua conta Matrix (por dispositivo, caso contrário). Ao puxar, você vê o que vai mudar antes de qualquer coisa ser executada.",
    "pluginsSettings.pushToAccount": "Enviar para a conta",
    "pluginsSettings.pullFromAccount": "Puxar da conta",
    "pluginsSettings.thisPullWill": "Esta importação vai:",
    "pluginsSettings.addRepos": "Adicionar repositórios: {join}",
    "pluginsSettings.installFromRepos":
        "Instalar a partir dos repositórios deles: {join}",
    "pluginsSettings.couldNotInstall":
        "Aplicado, mas estes plugins não puderam ser instalados: {join}",
    "pluginsSettings.enable": "Ativar: {join}",
    "pluginsSettings.disable": "Desativar: {join}",
    "pluginsSettings.updateSettingsFor": "Atualizar configurações de: {join}",
    "pluginsSettings.setAutoUpdate": "Definir atualização automática: {value}",
    "pluginsSettings.setPerPluginAutoUpdate":
        "Definir atualização automática por plugin: {join}",
    "pluginsSettings.notInstalledOnThisDeviceInstall":
        "Não instalados neste dispositivo (instale em Explorar e puxe novamente): {join}",
    "pluginsSettings.nothingToChangeAlreadyInSync":
        "Nada a alterar; já está sincronizado.",
    "pluginsSettings.apply": "Aplicar",
    "pluginsSettings.installed": "Instalados",
    "pluginsSettings.noPluginsInstalled": "Nenhum plugin instalado.",
    "pluginsSettings.needsUpdate": "Precisa de atualização",
    "pluginsSettings.updateToV": "Atualizar para v{value}",
    "pluginsSettings.updating": "Atualizando...",
    "pluginsSettings.update": "Atualizar",
    "pluginsSettings.pluginSettings": "Configurações do plugin",
    "pluginsSettings.enable2": "Ativar {name}",
    "pluginsSettings.working": "Processando...",
    "pluginsSettings.autoUpdateThisPlugin":
        "Atualizar este plugin automaticamente",
    "pluginsSettings.autoDefault": "Auto: padrão",
    "pluginsSettings.autoOn": "Auto: ativado",
    "pluginsSettings.autoOff": "Auto: desativado",
    "pluginsSettings.confirmRemove": "Confirmar remoção de {name}",
    "pluginsSettings.removePlugin": "Remover plugin",
    "pluginsSettings.remove": "Remover {name}",
    "pluginsSettings.browse": "Explorar",
    "pluginsSettings.loading": "Carregando...",
    "pluginsSettings.noPluginsInThisRepoYet":
        "Nenhum plugin neste repositório ainda.",
    "pluginsSettings.install": "Instalar",
    "pluginsSettings.repos": "Repositórios",
    "pluginsSettings.official": "Oficial",
    "pluginsSettings.localFolder": "Pasta local",
    "pluginsSettings.loadFromFolder": "Carregar um plugin de uma pasta",
    "pluginsSettings.loadFromFolderHint":
        "Para desenvolver um plugin: escolha a pasta com o manifest.json e o bundle, ou uma pasta de repositório que contenha várias dessas pastas de plugin. O Zam guarda uma cópia e a executa como qualquer plugin; use Recarregar depois de recompilar. Ele executa código com confiança total, então só carregue pastas que você escreveu ou em que confia.",
    "pluginsSettings.chooseFolder": "Escolher pasta",
    "pluginsSettings.reload": "Recarregar",
    "pluginsSettings.reloading": "Recarregando…",
    "pluginsSettings.reloadFromFolder": "Recarregar da pasta",
    "pluginsSettings.removeRepo": "Remover repositório",
    "pluginsSettings.addARepo": "Adicionar um repositório",
    "pluginsSettings.thirdPartyReposRunFullTrust":
        "Repositórios de terceiros executam código com confiança total e acesso total à sua conta e às suas mensagens. Adicione apenas repositórios em que você confia.",
    "pluginsSettings.ownerRepoOrGithubUrl": "dono/repositório ou URL do GitHub",
    "pluginsSettings.addRepo": "Adicionar repositório",
    "pluginsSettings.syncPlugins": "Sincronizar plugins",
    "pluginsSettings.disableAllPlugins": "Desativar todos os plugins",
    "pluginsSettings.autoUpdatePlugins": "Atualizar plugins automaticamente",
    "pluginsSettings.automaticallyPullNewerVersionsOfRepo":
        "Baixa automaticamente versões mais novas dos plugins dos repositórios.",
    "pluginsSettings.pushedYourPluginSetToYour":
        "Seu conjunto de plugins foi enviado para a sua conta.",
    "pluginsSettings.pushFailed": "Falha ao enviar.",
    "pluginsSettings.pullFailed": "Falha ao puxar.",
    "pluginsSettings.appliedTheSyncedPluginSet":
        "Conjunto de plugins sincronizado aplicado.",
    "pluginsSettings.updateFailed": "Falha na atualização.",
    "pluginsSettings.couldnTRemovePlugin":
        "Não foi possível remover o plugin: {message}",
    "pluginsSettings.couldnTRemovePlugin2":
        "Não foi possível remover o plugin.",
    "pluginsSettings.cannotAddThisRepo":
        "Não é possível adicionar este repositório.",
    "pluginsSettings.noIndexJson": "Sem index.json ({status})",
    "pluginsSettings.installFailed": "Falha na instalação.",

    // src/lib/components/messages/PollBody.svelte
    "pollBody.finalResults": "Resultados finais",
    "pollBody.livePoll": "Enquete ao vivo",
    "pollBody.resultsAreRevealedWhenThePoll":
        "Os resultados são revelados quando a enquete termina",
    "pollBody.chooseUpTo": "· escolha até {maxSelections}",
    "pollBody.selected": "selecionado",
    "pollBody.submitting": "Enviando…",
    "pollBody.submitVote": "Enviar voto",
    "pollBody.votesAreHidden": "Os votos estão ocultos",
    "pollBody.savingVote": "· salvando voto…",
    "pollBody.closeThisPoll": "Encerrar esta enquete?",
    "pollBody.closing": "Encerrando…",
    "pollBody.closePoll": "Encerrar enquete",
    "pollBody.pollUnsupportedFormat": "[Enquete - formato sem suporte]",
    "pollBody.failedToSubmitVote": "Falha ao enviar o voto",
    "pollBody.failedToClosePoll": "Falha ao encerrar a enquete",
    "pollBody.voteCount": "{count, plural, one {# voto} other {# votos}}",

    // src/lib/components/ui/Portal.fixture.svelte
    "portal.fixture.hello": "olá",

    // src/lib/components/settings/PrivacySafetySettings.svelte
    "privacySafetySettings.privacy": "Privacidade",
    "privacySafetySettings.privateReadReceipts":
        "Confirmações de leitura privadas",
    "privacySafetySettings.sendTypingIndicators":
        "Enviar indicadores de digitação",
    "privacySafetySettings.indexEncryptedRooms":
        "Indexar salas criptografadas neste dispositivo",
    "privacySafetySettings.indexEncryptedRoomsHint":
        "Mantém neste dispositivo uma cópia comprimida das mensagens das suas salas criptografadas para que a pesquisa e a lista de mídia funcionem nelas. O histórico é buscado lentamente em segundo plano. Desativar isto exclui a cópia.",
    "privacySafetySettings.letOthersInARoomSee":
        "Permite que as outras pessoas em uma sala vejam quando você está digitando. Desative para digitar sem que ninguém seja avisado.",
    "privacySafetySettings.hideYourReadReceiptsFromOther":
        "Oculta suas confirmações de leitura de outros usuários. Suas contagens de não lidas continuam funcionando; os outros só não conseguem ver até onde você leu.",
    "privacySafetySettings.streamerMode": "Modo streamer",
    "privacySafetySettings.streamerModeHint":
        "Desfoca o ID da sua conta, endereços de e-mail e chave de recuperação, e oculta o texto das mensagens nas notificações, para que nada privado apareça numa transmissão. Aplica-se apenas a este dispositivo.",
    "privacySafetySettings.hideMessageTextInNotifications":
        "Ocultar o texto das mensagens nas notificações",
    "privacySafetySettings.notificationsOnThisDeviceSayWho":
        "As notificações neste dispositivo dizem quem enviou mensagem a você, mas não o que a pessoa disse. Os nomes do remetente e da sala continuam sendo exibidos. Vale somente para este dispositivo.",
    "privacySafetySettings.linkPreviewMedia": "Mídia da prévia de links",
    "privacySafetySettings.previewImagesAndVideosUsuallyCome":
        "As imagens e os vídeos das prévias de links comuns passam pelo seu servidor doméstico. “Tudo” também carrega players do YouTube, cartões do X/Twitter e GIFs que seu servidor não consegue gerar prévia, diretamente desses sites, que então descobrem seu endereço IP e quando você leu a mensagem. “Somente servidor doméstico” segura esses itens; “Desativado” também segura o que seu servidor fornece. De qualquer forma, cada prévia afetada mantém um botão para carregar a mídia. O interruptor de ativar/desativar prévias de links fica em Mensagens e mídia.",
    "privacySafetySettings.blockedUsers": "Usuários bloqueados",
    "privacySafetySettings.all": "Tudo",
    "privacySafetySettings.loadPreviewMediaFromWhereverIt":
        "Também carregar incorporações do YouTube, X/Twitter e GIFs diretamente desses sites",
    "privacySafetySettings.homeserverOnly": "Somente servidor doméstico",
    "privacySafetySettings.onlyLoadPreviewMediaYourOwn":
        "Carregar somente a mídia de prévia fornecida pelo seu próprio servidor doméstico",
    "privacySafetySettings.off": "Desativado",
    "privacySafetySettings.neverLoadPreviewMediaAutomatically":
        "Nunca carregar a mídia de prévia automaticamente",

    // src/lib/components/settings/ProfileFieldsEditor.svelte
    "profileFieldsEditor.moreAboutYou": "Mais sobre você",
    "profileFieldsEditor.banner": "Banner",
    "profileFieldsEditor.yourBanner": "Seu banner",
    "profileFieldsEditor.changeBanner": "Alterar banner",
    "profileFieldsEditor.showWhenIAmInA": "Mostrar quando estou em uma chamada",
    "profileFieldsEditor.addsInACallToYour":
        "Adiciona “Em uma chamada” ao seu perfil enquanto você está conectado a uma chamada de voz e o remove quando você sai.",
    "profileFieldsEditor.pronouns": "Pronomes",
    "profileFieldsEditor.sheHerTheyThem": "ela/dela, elu/delu",
    "profileFieldsEditor.separateWithCommasMostPreferredFirst":
        "Separe com vírgulas, o preferido primeiro.",
    "profileFieldsEditor.status": "Status",
    "profileFieldsEditor.statusEmoji": "Emoji de status",
    "profileFieldsEditor.pickAStatusEmoji": "Escolha um emoji de status",
    "profileFieldsEditor.onHolidayUntilThe23rd": "De férias até o dia 23",
    "profileFieldsEditor.statusText": "Texto do status",
    "profileFieldsEditor.bio": "Bio",
    "profileFieldsEditor.tellPeopleAboutYourself":
        "Conte às pessoas sobre você",
    "profileFieldsEditor.timezone": "Fuso horário",
    "profileFieldsEditor.timezoneRegion": "Região do fuso horário",
    "profileFieldsEditor.notSet": "Não definido",
    "profileFieldsEditor.timezoneCity": "Cidade do fuso horário",
    "profileFieldsEditor.chooseACity": "Escolha uma cidade",
    "profileFieldsEditor.europeLondon": "Europe/London",
    "profileFieldsEditor.useMine": "Usar o meu",
    "profileFieldsEditor.usernameColour": "Cor do nome de usuário",
    "profileFieldsEditor.usernameColourOnDarkThemes":
        "Cor do nome de usuário em temas escuros",
    "profileFieldsEditor.darkThemes": "temas escuros",
    "profileFieldsEditor.usernameColourOnLightThemes":
        "Cor do nome de usuário em temas claros",
    "profileFieldsEditor.lightThemes": "temas claros",
    "profileFieldsEditor.resetToDefault": "Redefinir para o padrão",
    "profileFieldsEditor.chooseAColour": "Escolha uma cor",
    "profileFieldsEditor.oneColourForDarkThemesAnd":
        "Uma cor para temas escuros e outra para claros, para que seu nome continue legível nos dois.",
    "profileFieldsEditor.links": "Links",
    "profileFieldsEditor.label": "Rótulo",
    "profileFieldsEditor.linkLabel": "Rótulo do link",
    "profileFieldsEditor.httpsExampleOrg": "https://example.org",
    "profileFieldsEditor.linkAddress": "Endereço do link",
    "profileFieldsEditor.removeLink": "Remover link",
    "profileFieldsEditor.addLink": "Adicionar link",
    "profileFieldsEditor.saved": "Salvo",
    "profileFieldsEditor.useATimezoneNameLikeEurope":
        "Use um nome de fuso horário como Europe/London.",
    "profileFieldsEditor.chooseACity2": "Escolha uma cidade.",
    "profileFieldsEditor.bannerUploadFailed": "Falha ao enviar o banner",
    "profileFieldsEditor.failedToSaveProfileFields":
        "Falha ao salvar os campos do perfil",

    // src/lib/components/layout/ProfileFooter.svelte
    "profileFooter.dismiss": "Dispensar",
    "profileFooter.switchAccounts": "Trocar de conta",
    "profileFooter.unknown": "Desconhecido",

    // src/lib/components/settings/PushDiagnostics.svelte
    "pushDiagnostics.pushGateway": "Gateway de push",
    "pushDiagnostics.notificationRelay": "Relay de notificações",
    "pushDiagnostics.pushNotificationsAreRelayedThroughThis":
        "As notificações push são retransmitidas por este gateway. Ele pode ver quais salas e remetentes notificam você, mas nunca o texto das suas mensagens.",
    "pushDiagnostics.warningYourHomeserverIsRoutingThis":
        "Aviso: seu servidor doméstico está encaminhando as notificações push deste dispositivo para um gateway diferente ({join}). Esse gateway, e não o acima, vê os metadados das suas notificações.",
    "pushDiagnostics.verifiedYourHomeserverRoutesNotificationsTo":
        "Verificado: seu servidor doméstico encaminha as notificações para este gateway.",
    "pushDiagnostics.noPushNotificationsAreRegisteredOn":
        "Nenhuma notificação push está registrada nesta conta ainda.",

    // src/lib/components/ui/QrCodeImage.svelte
    "qrCodeImage.couldNotRenderTheVerificationCode":
        "Não foi possível exibir o código de verificação.",
    "qrCodeImage.qrCodeForDeviceVerification":
        "Código QR para verificação do dispositivo",

    // src/lib/components/layout/QuickActions.svelte
    "quickActions.newDm": "Nova mensagem direta",
    "quickActions.createRoomInSpace": "Criar sala no espaço",
    "quickActions.createNewRoom": "Criar nova sala",
    "quickActions.createNewSpace": "Criar novo espaço",
    "quickActions.joinRoomByAddress": "Entrar em uma sala pelo endereço",
    "quickActions.createARoom": "Criar uma sala",
    "quickActions.createASpace": "Criar um espaço",
    "quickActions.newDirectMessage": "Nova mensagem direta",
    "quickActions.joinARoom": "Entrar em uma sala",
    "quickActions.spaceName": "Nome do espaço",
    "quickActions.roomName": "Nome da sala",
    "quickActions.mySpace": "Meu espaço",
    "quickActions.optional": "(opcional)",
    "quickActions.additionalCreators": "Criadores adicionais (sala v12)",
    "quickActions.additionalCreatorsHint":
        "Outros usuários que se tornam criadores da nova sala junto com você. Na sala v12, o poder de criador não pode ser retirado.",
    "quickActions.starterRooms":
        "Adicionar uma sala de texto e uma sala de voz",
    "quickActions.starterRoomsHint":
        "Qualquer pessoa que você convidar para o espaço pode entrar nelas.",
    "quickActions.starterTextName": "geral",
    "quickActions.starterVoiceName": "Voz",
    "quickActions.whatSThisSpaceAbout": "Sobre o que é este espaço?",
    "quickActions.whatSThisRoomAbout": "Sobre o que é esta sala?",
    "quickActions.opensStraightIntoACallMessages":
        "Abre direto em uma chamada. As mensagens continuam funcionando.",
    "quickActions.enableEncryption": "Ativar criptografia",
    "quickActions.canTBeTurnedOffLater": "Não pode ser desativada depois.",
    "quickActions.findSomeoneToMessage":
        "Encontre alguém para enviar mensagem…",
    "quickActions.encryptThisDm": "Criptografar esta mensagem direta",
    "quickActions.openTheDm": "Abrir a mensagem direta",
    "quickActions.roomAddressOrId": "Endereço ou ID da sala",
    "quickActions.roomServerCom": "#sala:servidor.com",
    "quickActions.requestSentYouLlBeAble":
        "Pedido enviado - você poderá entrar quando alguém deixar você entrar.",
    "quickActions.youCanTJoinThisRoom":
        "Você não pode entrar nesta sala diretamente, mas pode pedir para entrar.",
    "quickActions.requestToJoin": "Pedir para entrar",
    "quickActions.create": "Criar",
    "quickActions.somethingWentWrong": "Algo deu errado",
    "quickActions.enterARoomAddressRoomServer":
        "Digite um endereço de sala (#sala:servidor.com) ou ID de sala (!id:servidor.com)",
    "quickActions.couldNotSendTheJoinRequest":
        "Não foi possível enviar o pedido de entrada",

    // src/lib/components/messages/ReactorPopover.svelte
    "reactorPopover.more": "+{overflow} mais",
    "reactorPopover.reactedWith": "Reagiu com {label}",
    "reactorPopover.userList": "Lista de usuários",

    // src/lib/components/messages/RenameAttachmentDialog.svelte
    "renameAttachmentDialog.editAttachment": "Editar anexo",
    "renameAttachmentDialog.filename": "Nome do arquivo",
    "renameThreadDialog.nameThread": "Nomear tópico",
    "renameThreadDialog.renameThread": "Renomear tópico",
    "renameThreadDialog.threadName": "Nome do tópico",
    "renameThreadDialog.everyoneInTheRoomSeesIt":
        "Todos na sala veem este nome no Zam. Outros aplicativos Matrix não o mostram.",
    "renameThreadDialog.removeName": "Remover nome",
    "renameThreadDialog.couldNotSaveTheName": "Não foi possível salvar o nome",

    // src/lib/components/layout/RoomDirectory.svelte
    "roomDirectory.exploreRooms": "Explorar salas",
    "roomDirectory.onYourHomeserver": "no seu servidor doméstico",
    "roomDirectory.publicRooms": "Salas públicas {value}",
    "roomDirectory.rooms": "· ~{totalEstimate} salas",
    "roomDirectory.searchRooms": "Pesquisar salas…",
    "roomDirectory.serverOptional": "Servidor (opcional)",
    "roomDirectory.search": "Pesquisar",
    "roomDirectory.noRoomsFound": "Nenhuma sala encontrada.",
    "roomDirectory.space": "Espaço",
    "roomDirectory.open": "Abrir",
    "roomDirectory.knockOnly": "Somente por pedido",
    "roomDirectory.requestToJoin": "Pedir para entrar",
    "roomDirectory.requested": "Pedido enviado",
    "roomDirectory.somethingWentWrong": "Algo deu errado",

    // src/lib/components/layout/RoomTopicSheet.svelte
    "roomTopicSheet.description": "Descrição",
    "roomTopicSheet.open": "Mostrar a descrição completa da sala",

    // src/lib/components/layout/RoomHeaderOverflowMenu.svelte
    "roomHeaderOverflowMenu.moreRoomOptions": "Mais opções da sala",
    "roomHeaderOverflowMenu.unread": "não lidas",
    "roomHeaderOverflowMenu.badgeThreads":
        "{count, plural, one {{badge} menção não lida} other {{badge} menções não lidas}}",
    "roomHeaderOverflowMenu.badgePinned":
        "{count, plural, one {{badge} mensagem fixada} other {{badge} mensagens fixadas}}",
    "roomHeaderOverflowMenu.badgeNotifications":
        "{count, plural, one {{badge} notificação não lida} other {{badge} notificações não lidas}}",
    "roomHeaderOverflowMenu.badgeMedia":
        "{count, plural, one {{badge} item} other {{badge} itens}}",
    "roomHeaderOverflowMenu.badgeMembers":
        "{count, plural, one {{badge} membro} other {{badge} membros}}",

    // src/lib/components/layout/RoomList.svelte
    "roomList.doneReordering": "Concluir reordenação",
    "roomList.reorderRooms": "Reordenar salas",
    "roomList.spaceSettings": "Configurações do espaço",
    "roomList.sortDmsBy": "Ordenar DMs por",
    "roomList.dmSortRecent": "Mensagem mais recente",
    "roomList.dmSortUnread": "Não lidas primeiro",
    "roomList.dmSortOnline": "Online primeiro",
    "roomList.dmSortName": "Nome (A–Z)",
    "roomList.pendingInvites": "Convites pendentes",
    "roomList.inVoice": "{name} - em voz",
    "roomList.orderValue": "Valor de ordem",
    "roomList.roomSettings": "Configurações da sala",
    "roomList.favourites": "Favoritos",
    "roomList.channels": "Salas",
    "roomList.rooms": "Salas",
    "roomList.lowPriority": "Baixa prioridade",
    "roomList.browseRooms": "Explorar salas",
    "roomList.members": "{numMembers} membros",
    "roomList.requested": "Pedido enviado",
    "roomList.cancelRequest": "Cancelar pedido",
    "roomList.youCanTJoinThisRoom":
        "Você não pode entrar nesta sala diretamente - pedir para entrar?",
    "roomList.notNow": "Agora não",
    "roomList.requestToJoin": "Pedir para entrar",
    "roomList.directMessages": "Mensagens diretas",
    "roomList.previewYou": "Você: {text}",
    "roomList.noRoomsYet": "Nenhuma sala ainda",
    "roomList.emptyCategory": "Nenhuma sala",
    "roomList.copyRoomLink": "Copiar link da sala",
    "roomList.markAsRead": "Marcar como lida",
    "roomList.markAsUnread": "Marcar como não lida",
    "roomList.addToSpace": "Adicionar ao espaço",
    "roomList.clickAgainToLeave": "Clique novamente para sair",
    "roomList.clickAgainToLeaveLastMember":
        "Você é o único membro, então ninguém poderá entrar depois que você sair. Clique novamente para sair",
    "roomList.leaveRoom": "Sair da sala",
    "roomList.couldNotSendTheJoinRequest":
        "Não foi possível enviar o pedido de entrada",
    "roomList.orderMustBeBetween0And":
        "A ordem deve estar entre 0 e 1 - usado {value} no lugar.",
    "roomList.failedToSetOrder": "Falha ao definir a ordem",

    // src/lib/components/layout/RoomMediaPanel.svelte
    "roomMediaPanel.media": "Mídia",
    "roomMediaPanel.closeMediaPanel": "Fechar painel de mídia",
    "roomMediaPanel.media2": "Mídia ({length}{value})",
    "roomMediaPanel.files": "Arquivos ({length}{value})",
    "roomMediaPanel.tryAgain": "Tentar novamente",
    "roomMediaPanel.play": "{name} - reproduzir",
    "roomMediaPanel.video": "Vídeo",
    "roomMediaPanel.audio": "Áudio",
    "roomMediaPanel.file": "Arquivo",
    "roomMediaPanel.decryptingMedia": "Descriptografando mídia",
    "roomMediaPanel.decryptingMedia2": "Descriptografando mídia...",
    "roomMediaPanel.mediaCouldNotBeLoaded": "Não foi possível carregar a mídia",
    "roomMediaPanel.couldNotLoadThisMedia":
        "Não foi possível carregar esta mídia.",
    "roomMediaPanel.noMediaFoundInTheLast":
        "Nenhuma mídia encontrada nas últimas centenas de mensagens.",
    "roomMediaPanel.noFilesFoundInTheLast":
        "Nenhum arquivo encontrado nas últimas centenas de mensagens.",
    "roomMediaPanel.noImagesOrVideosInThis":
        "Ainda não há imagens ou vídeos nesta sala.",
    "roomMediaPanel.noFilesInThisRoomYet": "Ainda não há arquivos nesta sala.",
    "roomMediaPanel.couldNotLoadMedia": "Não foi possível carregar a mídia.",
    "roomMediaPanel.couldNotLoadMoreMedia":
        "Não foi possível carregar mais mídia.",
    "roomMediaPanel.failedToDownloadAttachment": "Falha ao baixar o anexo",

    // src/lib/components/layout/RoomSettings.svelte
    "roomSettings.closeSettings": "Fechar configurações",
    "roomSettings.backToSettings": "Voltar às configurações",
    "roomSettings.settings": "{name} - Configurações",
    "roomSettings.roomAvatar": "Avatar da sala",
    "roomSettings.roomName": "Nome da sala",
    "roomSettings.saved": "Salvo!",
    "roomSettings.saveChanges": "Salvar alterações",
    "roomSettings.advanced": "Avançado",
    "roomSettings.spaceId": "ID do espaço",
    "roomSettings.roomId": "ID da sala",
    "roomSettings.copied": "Copiado!",
    "roomSettings.roomVersionV": "Versão da sala: v{getVersion}",
    "roomSettings.upgradeRoom": "Atualizar sala…",
    "roomSettings.thisCreatesANewRoomOn":
        "Isto cria uma nova sala na v{recommendedVersion} e marca esta como substituída. Os membros serão direcionados para a nova sala.",
    "roomSettings.upgrading": "Atualizando…",
    "roomSettings.upgradeRoom2": "Atualizar sala",
    "roomSettings.additionalCreators": "Criadores adicionais (sala v12)",
    "roomSettings.additionalCreatorsHint":
        "Outros usuários que se tornam criadores da sala atualizada junto com você. Na sala v12, o poder de criador não pode ser retirado.",
    "roomSettings.whoCanJoin": "Quem pode entrar?",
    "roomSettings.spaceMembersAnyoneInCanJoin":
        "Membros do espaço - qualquer pessoa em {parentSpaceNames} pode entrar",
    "roomSettings.spaceMembersAnyoneInTheParent":
        "Membros do espaço - qualquer pessoa no espaço pai pode entrar",
    "roomSettings.messageHistory": "Histórico de mensagens",
    "roomSettings.guestAccess": "Acesso de convidados",
    "roomSettings.allowGuestsToJoinWithoutAn":
        "Permitir que convidados entrem sem uma conta",
    "roomSettings.guestsAreAnonymousAccountsTheHomeserver":
        "Convidados são contas anônimas que o servidor doméstico cria sob demanda. Muitos servidores desativam totalmente o registro de convidados e, nesse caso, isto não tem efeito.",
    "roomSettings.discoverability": "Visibilidade",
    "roomSettings.addresses": "Endereços",
    "roomSettings.loadingAddresses": "Carregando endereços…",
    "roomSettings.noAddressesYet": "Nenhum endereço ainda.",
    "roomSettings.main": "Principal",
    "roomSettings.remove": "Remover {alias}",
    "roomSettings.mainAddress": "Endereço principal",
    "roomSettings.noMainAddress": "Sem endereço principal",
    "roomSettings.set": "Definir",
    "roomSettings.myRoom": "minha-sala",
    "roomSettings.serverAccessControl": "Controle de acesso por servidor",
    "roomSettings.controlWhichHomeserversMayParticipateIn":
        "Controle quais servidores domésticos podem participar desta sala. Curingas:",
    "roomSettings.matchesAnyCharacters": "corresponde a quaisquer caracteres,",
    "roomSettings.matchesOneDeniedServersAreRemoved":
        "corresponde a um. Servidores negados são removidos da federação para esta sala.",
    "roomSettings.noServerAclIsSetAll":
        "Nenhuma ACL de servidor definida. Todos os servidores podem participar.",
    "roomSettings.allowedServersOnePerLine":
        "Servidores permitidos (um por linha)",
    "roomSettings.deniedServersOnePerLine": "Servidores negados (um por linha)",
    "roomSettings.allowServersIdentifiedByARaw":
        "Permitir servidores identificados por um endereço IP bruto",
    "roomSettings.saveServerAcl": "Salvar ACL do servidor",
    "roomSettings.youDoNotHavePermissionTo":
        "Você não tem permissão para editar a ACL de servidor desta sala.",
    "roomSettings.appliesToTheSpaceAndAll":
        "Vale para o espaço e todas as suas salas.",
    "roomSettings.notificationLevel": "Nível de notificação",
    "roomSettings.encryption": "Criptografia",
    "roomSettings.encrypted": "Criptografada",
    "roomSettings.notEncrypted": "Não criptografada",
    "roomSettings.messagesInThisRoomAreEnd":
        "As mensagens desta sala são criptografadas de ponta a ponta. Isso não pode ser desativado.",
    "roomSettings.roomKey": "Chave da sala",
    "roomSettings.resetRoomKey": "Redefinir chave da sala",
    "roomSettings.resetRoomKeyHint":
        "Se as pessoas não conseguem ler suas mensagens aqui, isto faz sua próxima mensagem usar uma nova chave e compartilhá-la novamente com todas as sessões da sala.",
    "roomSettings.couldNotResetRoomKey":
        "Não foi possível redefinir a chave da sala",
    "roomSettings.enableEncryption": "Ativar criptografia",
    "roomSettings.typeToConfirm":
        "Digite {ENABLE_ENCRYPTION_CONFIRM_PHRASE} para confirmar",
    "roomSettings.enabling": "Ativando…",
    "roomSettings.powerLevelRequiredForEachAction":
        "Nível de poder necessário para cada ação (0–100).",
    "roomSettings.nameAnyThread": "Nomear qualquer tópico",
    "roomSettings.joinCallsVoiceVideo": "Entrar em chamadas (voz/vídeo)",
    "roomSettings.invite": "Convidar",
    "roomSettings.searchMembers": "Pesquisar membros…",
    "roomSettings.banned": "Banidos ({length})",
    "roomSettings.pendingJoinRequests":
        "Pedidos de entrada pendentes ({length})",
    "roomSettings.deny": "Negar",
    "roomSettings.approve": "Aprovar",
    "roomSettings.unban": "Desbanir",
    "roomSettings.noBannedMembers": "Nenhum membro banido",
    "roomSettings.you": " (você)",
    "roomSettings.setRole": "Definir cargo…",
    "roomSettings.admin100": "Administrador (100)",
    "roomSettings.moderator50": "Moderador (50)",
    "roomSettings.member0": "Membro (0)",
    "roomSettings.muted1": "Silenciado (-1)",
    "roomSettings.kick": "Expulsar",
    "roomSettings.ban": "Banir",
    "roomSettings.hideThisUserSMessagesEverywhere":
        "Ocultar as mensagens deste usuário em todo lugar (armazenado na sua conta)",
    "roomSettings.setThe": "Defina o campo",
    "roomSettings.fieldOnEachChildRoomTo":
        "em cada sala filha para controlar a ordem de classificação (lexicográfica). Deixe em branco para ordenar pela hora de criação.",
    "roomSettings.suggested": "Sugerida",
    "roomSettings.removeSuggestedHint": "Remover indicação de sugerida",
    "roomSettings.markAsSuggested": "Marcar como sugerida",
    "roomSettings.unsuggest": "Deixar de sugerir",
    "roomSettings.suggest": "Sugerir",
    "roomSettings.order": "order",
    "roomSettings.removeFromSpace": "Remover do espaço",
    "roomSettings.noChildRooms": "Nenhuma sala filha",
    "roomSettings.useYourGlobalNotificationSettings":
        "Usar suas configurações globais de notificação.",
    "roomSettings.allMessages": "Todas as mensagens",
    "roomSettings.notifyForEveryMessage": "Notificar a cada mensagem.",
    "roomSettings.mentionsOnly": "Somente menções",
    "roomSettings.notifyOnlyForMentionsAndKeywords":
        "Notificar somente por @menções e palavras-chave.",
    "roomSettings.neverNotify": "Nunca notificar.",
    "roomSettings.failedToUpdateNotifications":
        "Falha ao atualizar as notificações.",
    "roomSettings.failedToEnableEncryption": "Falha ao ativar a criptografia",
    "roomSettings.failedToSave": "Falha ao salvar",
    "roomSettings.uploadFailed": "Falha no envio",
    "roomSettings.failedToUpgradeRoom": "Falha ao atualizar a sala",
    "roomSettings.failedToSaveServerAcl": "Falha ao salvar a ACL do servidor",
    "roomSettings.couldNotChangeVisibility":
        "Não foi possível alterar a visibilidade",
    "roomSettings.couldNotLoadThisRoomS":
        "Não foi possível carregar os endereços desta sala",
    "roomSettings.couldNotAddThatAddress":
        "Não foi possível adicionar esse endereço",
    "roomSettings.thisAddressIsPublishedAsOne":
        "Este endereço está publicado como um dos endereços da sala e você não tem permissão para despublicá-lo, então ele não pode ser removido. Peça a um administrador da sala.",
    "roomSettings.couldNotRemoveThatAddress":
        "Não foi possível remover esse endereço",
    "roomSettings.couldNotSetTheMainAddress":
        "Não foi possível definir o endereço principal",
    "roomSettings.failed": "Falhou",
    "roomSettings.muted": "Silenciado",
    "roomSettings.admin": "Administrador",
    "roomSettings.moderator": "Moderador",
    "roomSettings.member": "Membro",
    "roomSettings.creatorLabel": "Criador",
    "roomSettings.failedToUpdateSuggestion": "Falha ao atualizar a sugestão",
    "roomSettings.listThisRoomInTheServerDirectory":
        "Listar esta sala no diretório do servidor",
    "roomSettings.listThisSpaceInTheServerDirectory":
        "Listar este espaço no diretório do servidor",
    "roomSettings.listsTheRoomByIdBeingFound":
        "Lista a sala por ID. Ser encontrada pelo nome também exige um endereço publicado - adicione um abaixo.",
    "roomSettings.listsTheSpaceByIdBeingFound":
        "Lista o espaço por ID. Ser encontrado pelo nome também exige um endereço publicado - adicione um abaixo.",
    "roomSettings.aPublishedAddressLetsPeopleFindRoom":
        "Um endereço publicado permite que as pessoas encontrem e entrem nesta sala pelo nome, em vez de pelo ID.",
    "roomSettings.aPublishedAddressLetsPeopleFindSpace":
        "Um endereço publicado permite que as pessoas encontrem e entrem neste espaço pelo nome, em vez de pelo ID.",
    "roomSettings.chooseHowThisRoomNotifiesYou":
        "Escolha como esta sala notifica você.",
    "roomSettings.chooseHowThisSpaceNotifiesYou":
        "Escolha como este espaço notifica você.",

    // src/lib/components/layout/ScreenSharePicker.svelte
    "screenSharePicker.chooseWhatToShare": "Escolha o que compartilhar",
    "screenSharePicker.noPreview": "Sem prévia",
    "screenSharePicker.screens": "Telas",
    "screenSharePicker.windows": "Janelas",
    "screenSharePicker.quality": "Qualidade: {quality}",
    "screenSharePicker.audio": "Áudio",
    "screenSharePicker.audioAuto":
        "O aplicativo da janela, ou todo o áudio de uma tela",
    "screenSharePicker.audioSystemExceptZam": "Todo o áudio, exceto o do Zam",
    "screenSharePicker.audioSystem": "Todo o áudio do sistema",
    "screenSharePicker.audioApps": "Aplicativos",
    "screenSharePicker.audioNone": "Sem áudio",

    // src/lib/components/layout/ScreenShareQualityChips.svelte
    "screenShareQualityChips.resolution": "Resolução",
    "screenShareQualityChips.frameRate": "Taxa de quadros",
    "screenShareQualityChips.fps": "{f} FPS",
    "screenShareQualityChips.videoCodec": "Codec de vídeo",
    "screenShareQualityChips.hw": "HW",
    "screenShareQualityChips.codecHardware": "Codificado na sua placa de vídeo",
    "screenShareQualityChips.codecSoftware": "Codificado no seu processador",
    "screenShareQualityChips.codecHint":
        "Para sua câmera e compartilhamento de tela. Somente os codecs que todos na chamada conseguem reproduzir são listados.",
    "screenShareQualityChips.codecBackupHint":
        "Alguém na chamada não consegue reproduzir {codec}, então essa pessoa recebe uma cópia em H.264, que usa mais upload.",
    "screenShareQualityChips.codecEncryptedFallbackHint":
        "Alguém nesta chamada criptografada não consegue reproduzir {picked}, então você está enviando {current} até essa pessoa sair.",
    "screenShareQualityChips.bitrate": "Taxa de bits máxima",
    "screenShareQualityChips.bitrateUpTo": "Até",
    "screenShareQualityChips.bitrateCapHint":
        "Um limite, não uma meta: o compartilhamento usa apenas o que a imagem precisa e sua conexão suporta, até este valor.",
    "screenShareQualityChips.bitrateOverridden":
        "Usando a velocidade de envio que você informou, {upload}, então isto chega a {max}.",
    "screenShareQualityChips.uploadOverride": "Velocidade de envio (Mbps)",
    "screenShareQualityChips.uploadOverrideAuto": "Automática",
    "screenShareQualityChips.uploadOverrideHint":
        "A medição automática pode ficar bem abaixo da sua velocidade real. Informe seu próprio valor para aumentar o limite; deixe em branco para medir.",
    "screenShareQualityChips.kbps": "{n} kbps",
    "screenShareQualityChips.mbps": "{n} Mbps",
    "screenShareQualityChips.bitrateMeasured":
        "Seu envio mede {upload}, então isto chega a {max}.",
    "screenShareQualityChips.bitrateUnmeasured":
        "Seu envio ainda não foi medido. Ele é medido enquanto você envia vídeo, então por enquanto isto chega a {max}.",
    "screenShareQualityChips.shareSystemAudio": "Compartilhar áudio do sistema",
    "screenShareQualityChips.appliesToNextShare":
        "Vale para o próximo compartilhamento",
    "screenShareQualityChips.shareSystemAudioAppliesToNext":
        "Compartilhar áudio do sistema (vale para o próximo compartilhamento)",

    // src/lib/components/layout/ScreenShareQualityPopover.svelte

    "screenShareQualityPopover.screenShareQuality":
        "Qualidade do compartilhamento de tela",

    // src/lib/components/settings/SecuritySettings.svelte
    "securitySettings.showingTheLastReadingThatLoaded":
        "Mostrando a última leitura carregada - ela pode estar desatualizada.",
    "securitySettings.securityEncryption": "Segurança e criptografia",
    "securitySettings.setUpRecoverySoYourCross":
        "Configure a recuperação para que sua identidade de assinatura cruzada e seu histórico de mensagens criptografadas sobrevivam a sair da conta em todos os dispositivos.",
    "securitySettings.verification": "Verificação",
    "securitySettings.loadingEncryptionStatus":
        "Carregando status da criptografia…",
    "securitySettings.encryptionStatusUnknownOnThisSession":
        "Status da criptografia desconhecido nesta sessão.",
    "securitySettings.recoveryKeyId": "ID da chave de recuperação:",
    "securitySettings.setUpRecovery": "Configurar recuperação",
    "securitySettings.approveOnAccountPageHint":
        "Seu servidor pode pedir que você aprove isto na página da conta dele.",
    "securitySettings.approveOnAccountPage": "Aprove na página da sua conta",
    "securitySettings.approveOnAccountPageBody":
        "Seu servidor precisa que você permita esta alteração. Abra a página da sua conta, aprove a redefinição da sua identidade criptográfica e depois volte e continue.",
    "securitySettings.approveOnAccountPageRetry":
        "O servidor ainda não viu a aprovação. Aprove-a na página da sua conta e depois continue.",
    "securitySettings.openAccountPage": "Abrir página da conta",
    "securitySettings.iVeApprovedIt": "Já aprovei",
    "securitySettings.weLlCreateA": "Vamos criar uma",
    "securitySettings.recoveryKey": "chave de recuperação",
    "securitySettings.aOneTimeCodeThatUnlocks":
        "- um código de uso único que desbloqueia seu histórico criptografado e verifica novas sessões. Guarde-o em um lugar seguro, como um gerenciador de senhas; ele é mostrado apenas uma vez e não podemos recuperá-lo para você.",
    "securitySettings.confirmYourAccountPasswordToCreate":
        "Confirme a senha da sua conta para criar suas chaves de criptografia.",
    "securitySettings.accountPassword": "Senha da conta",
    "securitySettings.alsoLetMeUnlockWithA":
        "Permitir também desbloquear com uma frase secreta que eu escolher (opcional - sua chave de recuperação continua funcionando e continua sendo mostrada).",
    "securitySettings.recoveryPassphrase": "Frase secreta de recuperação",
    "securitySettings.atLeastCharactersWeCanT":
        "Pelo menos {MIN_PASSPHRASE_LENGTH} caracteres. Não podemos redefini-la para você.",
    "securitySettings.settingUp": "Configurando…",
    "securitySettings.continue": "Continuar",
    "securitySettings.saveYourRecoveryKey": "Salve sua chave de recuperação",
    "securitySettings.thisIsShown": "Isto é mostrado",
    "securitySettings.onlyOnce": "apenas uma vez",
    "securitySettings.storeItNowWithoutItYou":
        ". Guarde-a agora - sem ela, você não consegue recuperar seu histórico criptografado se perder o acesso às suas sessões.",
    "securitySettings.copied": "Copiada",
    "securitySettings.copyKey": "Copiar chave",
    "securitySettings.youCanAlsoUnlockWithThe":
        "Você também pode desbloquear com a frase secreta que escolheu. Guarde a chave mesmo assim - é a única forma de entrar se você esquecer a frase secreta.",
    "securitySettings.iVeSavedMyRecoveryKey":
        "Salvei minha chave de recuperação em um lugar seguro.",
    "securitySettings.done": "Concluir",
    "securitySettings.keysNotOnServer":
        "Suas chaves de assinatura cruzada nunca chegaram ao servidor",
    "securitySettings.keysNotOnServerHint":
        "Esta sessão as criou ao configurar a recuperação, mas o envio não terminou, então nenhuma das suas sessões consegue verificar as outras. Envie-as agora para corrigir isso.",
    "securitySettings.uploadKeys": "Enviar chaves",
    "securitySettings.couldNotUploadKeys":
        "Não foi possível enviar suas chaves",
    "securitySettings.recoveryIsSetUp": "A recuperação está configurada",
    "securitySettings.yourCrossSigningKeysAndA":
        "Suas chaves de assinatura cruzada e um backup de chaves estão armazenados com segurança no servidor, protegidos pela sua chave de recuperação.",
    "securitySettings.recoveryIsNotSetUp": "A recuperação não está configurada",
    "securitySettings.thisAccountHasNoRecoveryKey":
        "Esta conta não tem chave de recuperação nem backup de chaves até você concluir a etapa abaixo.",
    "securitySettings.lostYourRecoveryKeyResetRecovery":
        "Perdeu sua chave de recuperação? Redefinir recuperação",
    "securitySettings.resettingCreatesA": "Redefinir cria uma",
    "securitySettings.new": "nova",
    "securitySettings.recoveryKeyAndReplacesYourCurrent":
        "chave de recuperação e substitui seu backup atual. Sua chave de recuperação antiga para de funcionar e outras sessões podem precisar ser verificadas novamente. Só faça isso se você perdeu sua chave atual.",
    "securitySettings.yourOldRecoveryKeyAndBackup":
        "Sua chave de recuperação e seu backup antigos foram redefinidos, mas a nova recuperação não foi criada. Conclua a configuração agora - suas mensagens não podem ser recuperadas em uma nova sessão até você fazer isso.",
    "securitySettings.working": "Processando…",
    "securitySettings.finishSettingUpRecovery":
        "Concluir configuração da recuperação",
    "securitySettings.confirmYourAccountPasswordToReset":
        "Confirme a senha da sua conta para redefinir a recuperação.",
    "securitySettings.resetting": "Redefinindo…",
    "securitySettings.resetCreateNewKey": "Redefinir e criar nova chave",
    "securitySettings.messageHistoryBackup": "Backup do histórico de mensagens",
    "securitySettings.verifyThisSessionRestoreHistory":
        "Verificar esta sessão e restaurar o histórico",
    "securitySettings.recoveryKey2": "Chave de recuperação",
    "securitySettings.passphrase": "Frase secreta",
    "securitySettings.enterYour": "Digite sua",
    "securitySettings.recoveryPassphrase2": "frase secreta de recuperação",
    "securitySettings.toVerifyThisSessionAndRestore":
        "para verificar esta sessão e restaurar seu histórico de mensagens criptografadas.",
    "securitySettings.thisSessionIsNowVerified":
        "Esta sessão agora está verificada",
    "securitySettings.encryptedHistoryRestored":
        "Histórico criptografado restaurado",
    "securitySettings.couldNotSetUpRecovery":
        "Não foi possível configurar a recuperação",
    "securitySettings.couldNotResetRecovery":
        "Não foi possível redefinir a recuperação",
    "securitySettings.couldNotFinishSettingUpRecovery":
        "Não foi possível concluir a configuração da recuperação",
    "securitySettings.couldNotVerifyThisSession":
        "Não foi possível verificar esta sessão",

    // src/lib/components/settings/ServerSettings.svelte
    "serverSettings.scanningServer": "Examinando servidor…",
    "serverSettings.what": "Recursos que",
    "serverSettings.advertisesItemsMarkedUnknownArenT":
        "anuncia. Os itens marcados como “Desconhecido” não são anunciados pelo servidor e só são detectados quando usados.",
    "serverSettings.accountMessaging": "Conta e mensagens",
    "serverSettings.voiceVideoCallingMatrixrtc":
        "Chamadas de voz / vídeo (MatrixRTC)",
    "serverSettings.server": "Servidor",
    "serverSettings.latestSpecVersion": "Versão mais recente da especificação",
    "serverSettings.defaultRoomVersion": "Versão padrão da sala",
    "serverSettings.advertisedFeatures": "Recursos anunciados ({length})",
    "serverSettings.supported": "Com suporte",
    "serverSettings.notSupported": "Sem suporte",
    "serverSettings.unknown": "Desconhecido",
    "serverSettings.changePassword": "Alterar senha",
    "serverSettings.changeDisplayName": "Alterar nome de exibição",
    "serverSettings.changeAvatar": "Alterar avatar",
    "serverSettings.manageEmailsPhoneNumbers":
        "Gerenciar e-mails / números de telefone",
    "serverSettings.threads": "Tópicos",
    "serverSettings.privateReadReceipts": "Confirmações de leitura privadas",
    "serverSettings.sfuDiscoveryRtcFoci": "Descoberta de SFU (rtc_foci)",
    "serverSettings.delayedEventsCallCleanup":
        "Eventos atrasados (limpeza de chamadas)",
    "serverSettings.failedToReadServerCapabilities":
        "Falha ao ler os recursos do servidor",

    // src/lib/components/settings/SessionSettings.svelte
    "sessionSettings.sessionName": "Nome da sessão",
    "sessionSettings.current": "Atual",
    "sessionSettings.rename": "Renomear",
    "sessionSettings.signOut": "Sair?",
    "sessionSettings.signOut2": "Sair",
    "sessionSettings.manageAtProvider": "Gerenciar",
    "sessionSettings.confirmYourAccountPasswordToSign":
        "Confirme a senha da sua conta para encerrar esta sessão.",
    "sessionSettings.accountPassword": "Senha da conta",
    "sessionSettings.signingOut": "Saindo…",
    "sessionSettings.encryption": "Criptografia",
    "sessionSettings.active": "Ativa",
    "sessionSettings.unavailable": "Indisponível",
    "sessionSettings.thisDeviceSKey": "Chave deste dispositivo",
    "sessionSettings.loadingDeviceKey": "Carregando chave do dispositivo…",
    "sessionSettings.endToEndEncryptionCouldNot":
        "A criptografia de ponta a ponta não pôde iniciar nesta sessão. As salas criptografadas mostrarão marcadores.",
    "sessionSettings.encryptNewDirectMessages":
        "Criptografar novas mensagens diretas",
    "sessionSettings.newDmsYouStartAreEncrypted":
        "As novas mensagens diretas que você inicia são criptografadas por padrão. As já existentes não são alteradas. Desative se você troca mensagens com pessoas cujos clientes não suportam criptografia.",
    "identityChange.own":
        "Suas chaves de assinatura cruzada mudaram. Verifique esta sessão novamente, ou redefina e assine seus dispositivos de novo, antes de confiar em mensagens criptografadas.",
    "identityChange.other":
        "A identidade de assinatura cruzada de {user} mudou. As mensagens criptografadas para essa pessoa ficam retidas até você aceitar a nova identidade.",
    "identityChange.accept": "Aceitar nova identidade",
    "identityChange.withdraw": "Retirar verificação",
    "identityChange.dismiss": "Dispensar aviso de identidade",
    "sessionSettings.excludeInsecureDevices":
        "Excluir dispositivos sem assinatura cruzada",
    "sessionSettings.excludeInsecureDevicesHelp":
        "Compartilha chaves de mensagens somente com dispositivos que o dono assinou de forma cruzada, e mostra mensagens somente deles (MSC4153). As mensagens de dispositivos sem assinatura cruzada aparecerão como impossíveis de descriptografar.",
    "sessionSettings.onlySendToVerifiedDevices":
        "Enviar somente para dispositivos verificados",
    "sessionSettings.refuseToEncryptMessagesForSessions":
        "Recusa-se a criptografar mensagens para sessões que você não verificou. Elas não receberão suas mensagens de forma alguma - inclusive suas próprias sessões não verificadas. Desativado por padrão.",
    "sessionSettings.devicesCurrentlySignedInToThis":
        "Dispositivos atualmente conectados a esta conta.",
    "sessionSettings.refreshing": "Atualizando…",
    "sessionSettings.refresh": "Atualizar",
    "sessionSettings.loadingSessions": "Carregando sessões…",
    "sessionSettings.otherSessions": "Outras sessões {value}",
    "sessionSettings.noOtherSessionsYouReOnly":
        "Nenhuma outra sessão - você só está conectado aqui.",
    "sessionSettings.failedToLoadSessions": "Falha ao carregar as sessões",
    "sessionSettings.failedToRenameSession": "Falha ao renomear a sessão",
    "sessionSettings.failedToSignOutSession": "Falha ao encerrar a sessão",
    "sessionSettings.couldNotStartVerification":
        "Não foi possível iniciar a verificação",

    // src/lib/components/messages/ShareLocationDialog.svelte
    "shareLocationDialog.shareLocation": "Compartilhar localização",
    "shareLocationDialog.sendOnce": "Enviar uma vez",
    "shareLocationDialog.shareLive": "Compartilhar em tempo real",
    "shareLocationDialog.locating": "Localizando…",
    "shareLocationDialog.useMyCurrentLocation": "Usar minha localização atual",
    "shareLocationDialog.descriptionOptional": "Descrição (opcional)",
    "shareLocationDialog.eGHomeTheCafOn": "p. ex. Casa, o café da rua 5…",
    "shareLocationDialog.duration": "Duração",
    "shareLocationDialog.yourLiveLocationIsSharedWith":
        "Sua localização em tempo real é compartilhada com esta sala até você parar ou o cronômetro terminar.",
    "shareLocationDialog.sharing": "Compartilhando…",
    "shareLocationDialog.share": "Compartilhar",
    "shareLocationDialog.failedToStartLiveLocation":
        "Falha ao iniciar a localização em tempo real",
    "shareLocationDialog.failedToShareLocation":
        "Falha ao compartilhar a localização",

    // src/lib/components/messages/ShareTargetSheet.svelte
    "shareTargetSheet.fileSWerenTAddedShares":
        "{droppedFiles} arquivo(s) não foram adicionados. Os compartilhamentos são limitados a {SHARE_MAX_FILES} arquivos, {value} MB cada e {value2} MB no total.",
    "shareTargetSheet.addAMessage": "Adicione uma mensagem…",
    "shareTargetSheet.searchRooms": "Pesquisar salas",
    "shareTargetSheet.noJoinedRoomsFound":
        "Nenhuma sala em que você está foi encontrada",
    "shareTargetSheet.send": "Enviar",
    "shareTargetSheet.shareToARoom": "Compartilhar em uma sala",

    // src/lib/components/layout/SpaceLandingPanel.svelte
    "spaceLandingPanel.yourRooms": "Suas salas",
    "spaceLandingPanel.loadingRooms": "Carregando salas…",
    "spaceLandingPanel.browseRooms": "Explorar salas",
    "spaceLandingPanel.youHavenTJoinedARoom":
        "Você ainda não entrou em nenhuma sala de {spaceName}. Escolha uma para começar.",
    "spaceLandingPanel.nothingJoinedHereYet":
        "Você ainda não entrou em nada aqui",
    "spaceLandingPanel.onlyOtherSpacesLiveInsideOpen":
        "Dentro de {spaceName} há apenas outros espaços; abra um na lista de salas para explorar as salas dele.",
    "spaceLandingPanel.thereAreNoRoomsInYet":
        "Ainda não há salas em {spaceName}.",
    "spaceLandingPanel.thisSpace": "este espaço",
    "spaceLandingPanel.couldnTJoinTryItFrom":
        "Não foi possível entrar em {value}. Tente por Explorar salas, na lista de salas.",
    "spaceLandingPanel.thatRoom": "essa sala",

    // src/lib/components/layout/SpaceSidebar.svelte
    "spaceSidebar.home": "Início",
    "spaceSidebar.addASpace": "Adicionar um espaço",
    "spaceSidebar.exploreRooms": "Explorar salas",
    "spaceSidebar.folderColor": "Cor da pasta",
    "spaceSidebar.createRoomInSpace": "Criar sala no espaço",
    "spaceSidebar.roomName": "Nome da sala",
    "spaceSidebar.myRoom": "minha-sala",
    "spaceSidebar.optional": "(opcional)",
    "spaceSidebar.whatSThisRoomAbout": "Sobre o que é esta sala?",
    "spaceSidebar.opensStraightIntoACallMessages":
        "Abre direto em uma chamada. As mensagens continuam funcionando.",
    "spaceSidebar.create": "Criar",
    "spaceSidebar.addExistingRoomToSpace": "Adicionar sala existente ao espaço",
    "spaceSidebar.noRoomsAvailableToAdd":
        "Nenhuma sala disponível para adicionar.",
    "spaceSidebar.spaceSettings": "Configurações do espaço",
    "spaceSidebar.copySpaceLink": "Copiar link do espaço",
    "spaceSidebar.markAsRead": "Marcar como lido",
    "spaceSidebar.createRoom": "Criar sala",
    "spaceSidebar.addExistingRoom": "Adicionar sala existente",
    "spaceSidebar.removeFromFolder": "Remover da pasta",
    "spaceSidebar.newFolder": "Nova pasta",
    "spaceSidebar.clickAgainToLeave": "Clique novamente para sair",
    "spaceSidebar.clickAgainToLeaveLastMember":
        "Você é o único membro, então ninguém poderá entrar neste espaço depois que você sair. Clique novamente para sair",
    "spaceSidebar.leaveSpace": "Sair do espaço",
    "spaceSidebar.setColor": "Definir cor",
    "spaceSidebar.dissolveFolder": "Desfazer pasta",
    "spaceSidebar.somethingWentWrong": "Algo deu errado",

    // src/lib/components/layout/Splash.svelte
    "splash.restoringSession": "Restaurando sessão…",

    // src/lib/components/ui/StickerPicker.svelte
    "stickerPicker.searchStickers": "Pesquisar figurinhas…",
    "stickerPicker.searchStickers2": "Pesquisar figurinhas",
    "stickerPicker.noStickerPacksAvailable":
        "Nenhum pacote de figurinhas disponível",
    "stickerPicker.myStickers": "Minhas figurinhas",
    "stickerPicker.myStickers2": "Minhas figurinhas",

    // src/lib/components/ui/SwfEmbed.svelte
    "swfEmbed.adobeFlash": "Adobe Flash",

    // src/lib/components/settings/ThemeColorEditor.svelte
    "themeColorEditor.themeColors": "Cores do tema",
    "themeColorEditor.presetName": "Nome da predefinição",
    "themeColorEditor.savePreset": "Salvar predefinição",
    "themeColorEditor.import": "Importar",
    "themeColorEditor.pasteThemeCode": "Cole o código do tema",
    "themeColorEditor.copyCurrentPresetToClipboard":
        "Copiar a predefinição atual para a área de transferência",
    "themeColorEditor.copied": "Copiado!",
    "themeColorEditor.presets": "Predefinições",
    "themeColorEditor.delete": "Excluir?",
    "themeColorEditor.confirmDelete": "Confirmar exclusão de {name}",
    "themeColorEditor.rename": "Renomear",
    "themeColorEditor.delete2": "Excluir {name}",
    "themeColorEditor.builtInPresetsAreReadOnly":
        "As predefinições integradas são somente leitura. Duplique para personalizar:",
    "themeColorEditor.duplicateToCustomize": "Duplicar para personalizar",
    "themeColorEditor.colors": "Cores",
    "themeColorEditor.backgrounds": "Fundos",
    "themeColorEditor.resetToDefault": "Redefinir para o padrão",
    "themeColorEditor.text": "Texto",
    "themeColorEditor.accentsSemantics": "Destaques e semântica",
    "themeColorEditor.presence": "Presença",
    "themeColorEditor.details": "Detalhes",
    "themeColorEditor.contrastWarnings": "Avisos de contraste",
    "themeColorEditor.messageDisplay": "Exibição de mensagens",
    "themeColorEditor.savedOnThisDeviceOnlyNot":
        "Salvo somente neste dispositivo. Não é sincronizado com a sua conta.",
    "themeColorEditor.appTextSize": "Tamanho do texto do aplicativo: {round}%",
    "themeColorEditor.scalesAllTextAndSpacingAcross":
        "Dimensiona todo o texto e o espaçamento do aplicativo.",
    "themeColorEditor.font": "Fonte",
    "themeColorEditor.custom": "Personalizada - {customFontName}",
    "themeColorEditor.replaceCustomFont": "Substituir fonte personalizada…",
    "themeColorEditor.uploadCustomFont": "Enviar fonte personalizada…",
    "themeColorEditor.woff2TtfOrOtfUpTo":
        ".woff2, .ttf ou .otf de até 10 MB. Armazenada somente neste dispositivo.",
    "themeColorEditor.theQuickBrownFoxJumpsOver":
        "Um pequeno jabuti xereta viu dez cegonhas felizes.",
    "themeColorEditor.cannotSavePreset": "Não é possível salvar a predefinição",
    "themeColorEditor.notAValidThemeCode": "Código de tema inválido",
    "themeColorEditor.imported": "Importado",
    "themeColorEditor.cannotImportPreset":
        "Não é possível importar a predefinição",
    "themeColorEditor.copy": "{activePresetName} (cópia)",

    // src/lib/components/layout/ThreadPanel.svelte
    "threadPanel.thread": "Tópico",
    "threadPanel.collapseThread": "Recolher tópico",
    "threadPanel.expandThread": "Expandir tópico",
    "threadPanel.closeThread": "Fechar tópico",
    "threadPanel.noRepliesYetStartTheThread":
        "Nenhuma resposta ainda. Inicie o tópico abaixo.",
    "threadPanel.loadOlderReplies": "Carregar respostas mais antigas",

    // src/lib/components/layout/ThreadsListPanel.svelte
    "threadsListPanel.threads": "Tópicos",
    "threadsListPanel.closeThreadsPanel": "Fechar painel de tópicos",
    "threadsListPanel.noThreadsInThisRoomYet":
        "Ainda não há tópicos nesta sala.",
    "threadsListPanel.youParticipated": "Você participou",
    "threadsListPanel.unreadMentions": "Menções não lidas",
    "threadsListPanel.unreadReplies": "Respostas não lidas",
    "threadsListPanel.couldnTLoadThreadsForThis":
        "Não foi possível carregar os tópicos desta sala.",
    "threadsListPanel.unknownSender": "Desconhecido",
    "threadsListPanel.allThreads": "Todos os tópicos",
    "threadsListPanel.myThreads": "Meus tópicos",
    "threadsListPanel.filterThreads": "Filtrar tópicos",
    "threadsListPanel.noThreadsYouParticipatedIn":
        "Você não iniciou nem respondeu a nenhum tópico aqui.",

    // src/lib/components/layout/StorageBanner.svelte
    "storageBanner.outOfStorage":
        "O armazenamento do seu dispositivo acabou. O Zam não consegue salvar mensagens nem chaves de criptografia até você liberar espaço.",
    "storageBanner.lowStorage":
        "O armazenamento do seu dispositivo está quase acabando ({free} restantes). Libere espaço logo, ou o Zam não conseguirá salvar mensagens nem chaves de criptografia.",
    "storageBanner.checkAgain": "Verificar novamente",
    "storageBanner.dismissLowStorageWarning":
        "Dispensar aviso de armazenamento",

    // src/lib/components/layout/UpdateBanner.svelte
    "updateBanner.dismissUpdateNotification":
        "Dispensar notificação de atualização",
    "updateBanner.installFailed": "Falha na instalação",

    // src/lib/components/ui/UserPicker.svelte
    "userPicker.remove": "Remover {userId}",
    "userPicker.searching": "Pesquisando…",
    "userPicker.noMatchingUsers": "Nenhum usuário correspondente",
    "userPicker.available":
        "{optionCount, plural, one {# resultado disponível} other {# resultados disponíveis}}",
    "userPicker.invite": "Convidar {candidateShown}",
    "userPicker.alreadyAdded": "Já adicionado",
    "userPicker.alreadyInThisRoom": "Já está nesta sala",
    "userPicker.sendAnInviteToThisExact":
        "Enviar um convite para este ID de usuário exato",
    "userPicker.noMatchesTypeAFullUser":
        "Nenhuma correspondência. Digite um ID de usuário completo como",
    "userPicker.userServer": "@usuario:servidor",
    "userPicker.toInviteSomeoneTheDirectoryDoesn":
        "para convidar alguém que o diretório não lista.",
    "userPicker.searchForPeople": "Pesquisar pessoas…",
    "userPicker.userSearchFailedYouCanStill":
        "A pesquisa de usuários falhou - você ainda pode digitar um ID de usuário completo.",

    // src/lib/components/ui/UserProfileCard.svelte
    "userProfileCard.copyUserId": "Copiar ID de usuário",
    "userProfileCard.copied": "Copiado",
    "userProfileCard.localTime": "{localTime} no horário local ({timezone})",
    "userProfileCard.notAMemberOfThisRoom": "Não é membro desta sala",
    "userProfileCard.powerLevel": "Nível de poder: {level}",
    "userProfileCard.powerLevelCreator": "Nível de poder: Criador",
    "userProfileCard.mutualRooms": "Salas em comum: {total}",
    "userProfileCard.more": "+{moreCount} mais",
    "userProfileCard.sessions": "Sessões",
    "userProfileCard.sessionsCount": "Sessões: {total}",
    "userProfileCard.refreshSessions":
        "Pedir ao servidor as sessões atuais dessa pessoa",
    "userProfileCard.noKnownSessions":
        "Esta sessão não conhece nenhuma das sessões dessa pessoa, então ela não consegue ler suas mensagens criptografadas.",
    "userProfileCard.couldNotLoadSessions":
        "Não foi possível carregar as sessões dessa pessoa",
    "userProfileCard.keysChanged": "Chaves alteradas",
    "userProfileCard.keysChangedHint":
        "Uma sessão marcada como Chaves alteradas tem novas chaves que esta sessão não conseguiu adotar. Ela pode precisar sair e entrar novamente.",
    "userProfileCard.opening": "Abrindo…",
    "userProfileCard.message": "Mensagem",
    "userProfileCard.verifyUser": "Verificar usuário",
    "userProfileCard.editProfile": "Editar perfil",
    "userProfileCard.kicking": "Expulsando…",
    "userProfileCard.confirmKick": "Confirmar expulsão?",
    "userProfileCard.kick": "Expulsar",
    "userProfileCard.banning": "Banindo…",
    "userProfileCard.confirmBan": "Confirmar banimento?",
    "userProfileCard.ban": "Banir",
    "userProfileCard.couldNotStartVerification":
        "Não foi possível iniciar a verificação",
    "userProfileCard.couldNotCopyToClipboard":
        "Não foi possível copiar para a área de transferência",
    "userProfileCard.couldNotOpenDm":
        "Não foi possível abrir a mensagem direta",
    "userProfileCard.couldNotKick": "Não foi possível expulsar",
    "userProfileCard.couldNotBan": "Não foi possível banir",

    // src/lib/components/layout/VerificationModal.svelte
    "verificationModal.thisSessionIsNowTrusted":
        "Esta sessão agora é confiável.",
    "verificationModal.theirIdentityIsNowVerified":
        "A identidade dessa pessoa agora está verificada.",
    "verificationModal.noTrustWasEstablishedYouCan":
        "Nenhuma confiança foi estabelecida. Você pode começar de novo a qualquer momento.",
    "verificationModal.didYourOtherSessionJustScan":
        "Sua outra sessão acabou de escanear este código?",
    "verificationModal.didJustScanThisCode":
        "{otherUserId} acabou de escanear este código?",
    "verificationModal.onlyConfirmIfYouScannedIt":
        "Só confirme se você mesmo o escaneou, agora há pouco.",
    "verificationModal.onlyConfirmIfYouWatchedThem":
        "Só confirme se você viu a pessoa escaneá-lo, agora há pouco.",
    "verificationModal.no": "Não",
    "verificationModal.yesIScannedIt": "Sim, eu escaneei",
    "verificationModal.deviceWithThisUser": "dispositivo com este usuário",
    "verificationModal.confirmTheSameEmojiAppearIn":
        "Confirme que os mesmos emojis aparecem, na mesma ordem, no seu outro {value}.",
    "verificationModal.theyDonTMatch": "Não correspondem",
    "verificationModal.confirming": "Confirmando…",
    "verificationModal.theyMatch": "Correspondem",
    "verificationModal.verificationCodeForYourOtherSession":
        "Código de verificação para a sua outra sessão",
    "verificationModal.verificationCodeFor":
        "Código de verificação para {otherUserId}",
    "verificationModal.scanThisWithYourOtherSession":
        "Escaneie isto com a sua outra sessão.",
    "verificationModal.askThemToScanThisCode":
        "Peça para a pessoa escanear este código.",
    "verificationModal.noCodeToShowRightNow":
        "Nenhum código para mostrar no momento.",
    "verificationModal.couldNotLoadTheScanner":
        "Não foi possível carregar o leitor.",
    "verificationModal.scanAgain": "Escanear novamente",
    "verificationModal.compareAShortListOfEmoji":
        "Compare uma pequena lista de emojis para verificar, ou use um código QR.",
    "verificationModal.compareEmoji": "Comparar emojis",
    "verificationModal.showACodeForTheOther":
        "Mostrar um código para o outro lado escanear",
    "verificationModal.scanTheirCodeWithTheCamera":
        "Escanear o código deles com a câmera",
    "verificationModal.chooseADifferentMethod": "Escolher outro método",
    "verificationModal.waitingForTheOtherSideTo":
        "Aguardando o outro lado confirmar…",
    "verificationModal.verifyYourOtherSession": "Verificar sua outra sessão",
    "verificationModal.verify": "Verificar {value}",
    "verificationModal.couldNotConfirmTheMatch":
        "Não foi possível confirmar a correspondência",
    "verificationModal.couldNotReportTheMismatch":
        "Não foi possível informar a divergência",
    "verificationModal.session": "sessão",

    // src/lib/components/layout/VideoTile.svelte
    "videoTile.fullscreen": "Tela cheia",
    "videoTile.pictureInPicture": "Picture-in-picture (janela flutuante)",
    "videoTile.exitPictureInPicture": "Sair do picture in picture",

    // src/lib/components/settings/VoiceAudioSettings.svelte
    "voiceAudioSettings.inputDevice": "Dispositivo de entrada",
    "voiceAudioSettings.savedMicrophoneNotFoundUsingThe":
        "O microfone salvo não foi encontrado - usando o padrão até ele voltar.",
    "voiceAudioSettings.microphoneLevel": "Nível do microfone",
    "voiceAudioSettings.stopTest": "Parar teste",
    "voiceAudioSettings.testMic": "Testar microfone",
    "voiceAudioSettings.outputDevice": "Dispositivo de saída",
    "voiceAudioSettings.chooseOutputDevice": "Escolher dispositivo de saída…",
    "voiceAudioSettings.audioOutputIsRoutedByThe":
        "A saída de áudio é roteada pelo sistema operacional nesta plataforma.",
    "voiceAudioSettings.testSpeaker": "Testar alto-falante",
    "voiceAudioSettings.callVolume": "Volume da chamada",
    "voiceAudioSettings.incomingCallAudio": "Áudio recebido da chamada",
    "voiceAudioSettings.incomingCallAudioIfThisMoves":
        "Áudio recebido da chamada - se isto se mexe mas você não ouve nada, verifique o dispositivo de saída selecionado e o volume do sistema.",
    "voiceAudioSettings.voiceProcessing": "Processamento de voz",
    "voiceAudioSettings.noiseSuppression": "Supressão de ruído",
    "voiceAudioSettings.nsFastEnhancer": "FastEnhancer",
    "voiceAudioSettings.nsFastEnhancerHint":
        "Executa no seu dispositivo e já vem com o aplicativo, então não há nada para baixar. Pequeno e estável: mantém sua voz em um nível uniforme. É o padrão.",
    "voiceAudioSettings.nsFastEnhancerUnsupported":
        "Este navegador não consegue executar o FastEnhancer, então o RNNoise é usado no lugar.",
    "voiceAudioSettings.nsFastEnhancerTiny": "FastEnhancer Tiny",
    "voiceAudioSettings.nsFastEnhancerTinyHint":
        "Um FastEnhancer menor que usa cerca de um terço da CPU. Limpa um pouco menos; ainda mais estável que o RNNoise.",
    "voiceAudioSettings.noiseSuppressionGpu": "Aceleração por GPU",
    "voiceAudioSettings.noiseSuppressionGpuHint":
        "Executa a supressão de ruído na sua placa de vídeo para aliviar a CPU. Adiciona cerca de 11 ms de atraso. Volta para a CPU se a sua GPU não der conta.",
    "voiceAudioSettings.nsRnnoise": "RNNoise",
    "voiceAudioSettings.nsRnnoiseHint":
        "Executa no seu dispositivo e já vem com o aplicativo, então não há nada para baixar. Pequeno e estável: mantém sua voz em um nível uniforme.",
    "voiceAudioSettings.nsRnnoiseUnsupported":
        "Este navegador não consegue executar o RNNoise, então a supressão de ruído do próprio navegador é usada no lugar.",
    "voiceAudioSettings.nsDeepFilter": "DeepFilterNet3",
    "voiceAudioSettings.nsPluginHint":
        "Remoção de ruído por um plugin, executada no seu dispositivo. O FastEnhancer é usado no lugar onde ele não puder ser executado.",
    "voiceAudioSettings.nsPluginUnavailable":
        "O plugin deste filtro de ruído não está ativado, então o FastEnhancer é usado no lugar.",
    "voiceAudioSettings.nsPluginCantRun":
        "Este filtro de ruído não pode ser executado neste dispositivo, então o FastEnhancer é usado no lugar.",
    "voiceAudioSettings.nsPluginUnsupported":
        "Este navegador não consegue executar plugins de filtro de ruído, então a supressão de ruído do próprio navegador é usada no lugar.",
    "voiceAudioSettings.nsPluginMissing": "Filtro de plugin (não ativado)",
    "voiceAudioSettings.nsBrowser": "Navegador",
    "voiceAudioSettings.nsOff": "Desativado",
    "voiceAudioSettings.nsDeepFilterHint":
        "Remoção de ruído por IA executada no seu dispositivo. Baixa cerca de 11 MB na primeira vez que você a usa.",
    "voiceAudioSettings.nsDeepFilterUnsupported":
        "Este navegador não consegue executar o DeepFilterNet3, então a supressão de ruído do próprio navegador é usada no lugar.",
    "voiceAudioSettings.nsBrowserHint":
        "A supressão de ruído integrada do seu navegador. Ela só remove zumbidos constantes de fundo.",
    "voiceAudioSettings.nsOffHint":
        "Seu microfone é enviado sem remoção de ruído.",
    "voiceAudioSettings.echoCancellation": "Cancelamento de eco",
    "voiceAudioSettings.autoGainControl": "Controle automático de ganho",
    "voiceAudioSettings.agcNormalize": "Normalizar",
    "voiceAudioSettings.agcNormalizeHint":
        "A mesma uniformização de volume que as vozes recebidas ganham, aplicada ao seu microfone depois da remoção de ruído. Não mexe no volume do microfone do sistema.",
    "voiceAudioSettings.agcZam": "AGC2",
    "voiceAudioSettings.agcBrowser": "Navegador",
    "voiceAudioSettings.agcOff": "Desativado",
    "voiceAudioSettings.agcZamHint":
        "O AGC2 do WebRTC, executado depois da remoção de ruído. Uniformiza sua voz sem mexer no volume do microfone do sistema.",
    "voiceAudioSettings.agcBrowserHint":
        "O AGC integrado do seu navegador. Ele pode alterar o volume do microfone do sistema.",
    "voiceAudioSettings.agcOffHint":
        "Seu microfone é enviado no nível que o sistema fornece.",
    "voiceAudioSettings.normalizeVoices": "Uniformizar o volume das vozes",
    "voiceAudioSettings.normalizeVoicesHint":
        "Aumenta automaticamente o volume de quem fala baixo e diminui o de quem fala alto, para você não precisar ajustar o volume de cada pessoa manualmente.",
    "voiceAudioSettings.pushToTalk": "Pressionar para falar",
    "voiceAudioSettings.pushToTalkHint":
        "Nas chamadas, seu microfone só envia áudio enquanto a tecla de pressionar para falar estiver pressionada.",
    "voiceAudioSettings.pushToTalkNoKey":
        "Pressionar para falar precisa de uma tecla para funcionar.",
    "voiceAudioSettings.pushToTalkSetKey":
        "Definir uma tecla de pressionar para falar",
    "voiceAudioSettings.camera": "Câmera",
    "voiceAudioSettings.cameraDisabled": "Desativada",
    "voiceAudioSettings.mirrorMyCamera": "Espelhar minha câmera",
    "voiceAudioSettings.flipYourOwnPreviewOthersAlways":
        "Inverte a sua própria prévia. Os outros sempre veem você sem espelhamento.",
    "voiceAudioSettings.cannotWatch": "Vídeo que não consigo assistir",
    "voiceAudioSettings.cannotWatchHint":
        "Escolha os codecs que não mostram nada (ou mostram uma imagem preta) neste dispositivo. Os outros na chamada passam então a enviar H.264 para você. O Zam também preenche isto quando uma transmissão chega e nunca é decodificada.",
    "voiceAudioSettings.videoCodec": "Codec de vídeo",
    "voiceAudioSettings.videoCodecHint":
        "Como sua câmera e seu compartilhamento de tela são enviados. Automático escolhe o melhor codec que sua GPU codifica e que todos na chamada conseguem reproduzir. Quem não consegue reproduzi-lo recebe uma cópia em H.264, e você também pode trocá-lo durante a chamada. Vale na próxima vez que você os ativar.",
    "voiceAudioSettings.videoCodecAuto": "Automático",
    "voiceAudioSettings.adaptiveStream": "Qualidade de vídeo adaptativa",
    "voiceAudioSettings.adaptiveStreamHint":
        "Recebe cada vídeo no tamanho em que ele é exibido e pausa vídeos que não estão na tela ou enquanto o Zam está minimizado. Economiza banda e decodificação. Vale na próxima vez que você entrar em uma chamada.",
    "voiceAudioSettings.stopPreview": "Parar prévia",
    "voiceAudioSettings.preview": "Prévia",
    "voiceAudioSettings.callSounds": "Sons de chamada",
    "voiceAudioSettings.playCallSounds": "Tocar sons de chamada",
    "voiceAudioSettings.soundVolume": "Volume dos sons",
    "voiceAudioSettings.ringing": "Toque",
    "voiceAudioSettings.ringForIncomingDmCalls":
        "Tocar para chamadas recebidas em mensagens diretas",
    "voiceAudioSettings.directMessagesRingRoomsNeverDo":
        "Mensagens diretas tocam. Salas nunca tocam - você entra nelas pela própria sala.",
    "voiceAudioSettings.ringtoneVolume": "Volume do toque",
    "voiceAudioSettings.fullScreenCalls":
        "Mostrar chamadas na tela de bloqueio",
    "voiceAudioSettings.fullScreenCallsHint":
        "Permite que uma chamada recebida em mensagem direta acorde a tela e toque em tela cheia, como uma ligação telefônica. O Android pede isso separadamente.",
    "voiceAudioSettings.fullScreenCallsAllow": "Permitir",
    "voiceAudioSettings.microphoneUnavailableCheckBrowserPermissions":
        "Microfone indisponível - verifique as permissões do navegador",
    "voiceAudioSettings.cameraUnavailableCheckBrowserPermissions":
        "Câmera indisponível - verifique as permissões do navegador",

    // src/lib/components/layout/VoiceCallPanel.svelte
    "voiceCallPanel.enableAudio": "Ativar áudio",
    "voiceCallPanel.openCallView": "Abrir visualização da chamada",
    "voiceCallPanel.connectionStats": "Estatísticas da conexão",
    "voiceCallPanel.openCall": "Abrir chamada",
    "voiceCallPanel.openCallWithVideo":
        "Abrir chamada ({n, plural, one {# vídeo} other {# vídeos}})",
    "voiceCallPanel.sharingYourScreen": "Compartilhando sua tela",
    "voiceCallPanel.shareQuality": "Qualidade do compartilhamento de tela",
    "voiceCallPanel.stop": "Parar",
    "callStats.title": "Conexão da chamada",
    "callStats.copyJson": "Copiar como JSON",
    "callStats.copied": "Estatísticas da chamada copiadas",
    "callStats.copyFailed": "Não foi possível copiar",
    "callStats.loading": "Medindo...",
    "callStats.notInCall": "Não está em uma chamada",
    "callStats.tcpWarning":
        "A mídia está passando por TCP. Um pacote perdido segura tudo o que vem depois dele até ser reenviado, o que aparece como áudio atrasando ou saindo de sincronia. Um firewall ou uma rede que bloqueia UDP costuma causar isso.",
    "callStats.serverSwitchedTcp":
        "O servidor de chamadas mudou você para TCP: ele não oferece mais UDP a este dispositivo. Ele faz isso quando uma conexão UDP falha ou cai enquanto a sinalização continua funcionando, e se lembra disso durante esta chamada, então entrar de novo por este dispositivo continua em TCP por um tempo. Sua rede pode muito bem suportar UDP; isto não é o mesmo que um firewall bloqueando.",
    "callStats.serverCandidates": "Candidatos do servidor",
    "callStats.serverCandidatesNoUdp": "Somente TCP (alterado pelo servidor)",
    "callStats.publishing": "publicando",
    "callStats.listening": "escutando",
    "callStats.signalRtt": "Ping de sinalização",
    "callStats.yourQuality": "Sua conexão",
    "callStats.sending": "Enviando",
    "callStats.receiving": "Recebendo",
    "callStats.participant": "Participante",
    "callStats.theirQuality": "Conexão do participante",
    "callStats.loss": "Perda",
    "callStats.jitter": "Jitter",
    "callStats.buffer": "Buffer",
    "callStats.legend":
        "A conexão do participante é a nota que o servidor dá ao link dessa pessoa, então uma nota ruim ali aponta para a rede dela, não para a sua. Perda e jitter se referem ao áudio dela ao chegar até você, no último segundo.",
    "callStats.noTransport": "Não conectado",
    "callStats.video": "Vídeo",
    "callStats.videoChecking": "Verificando…",
    "callStats.videoSending": "Enviando",
    "callStats.videoNotSending": "Ainda não está sendo enviado",
    "callStats.videoCaptureEnded": "Captura interrompida: inicie-a novamente",
    "callStats.videoCaptureStalled":
        "Sem novos quadros: a janela compartilhada pode estar minimizada ou coberta, ou a câmera está ocupada",
    "callStats.videoPlaying": "Reproduzindo",
    "callStats.videoNotSubscribed": "Ainda não recebido",
    "callStats.videoHiddenByYou": "Oculto por você",
    "callStats.videoTurnedOff": "Desativado pelo participante",
    "callStats.videoPausedByServer":
        "Pausado pelo servidor de chamadas: sua conexão não suporta isso agora",
    "callStats.videoNoPackets":
        "Nada está chegando: verifique o lado de quem envia, ou a sua conexão",
    "callStats.videoCantDecrypt":
        "Chegando, mas não pode ser descriptografado: um de vocês pode estar em um Zam mais antigo, ou a chave não chegou",
    "callStats.videoCantDecode":
        "Chegando, mas este dispositivo não consegue decodificar: tente outro codec de vídeo no menu de qualidade do compartilhamento de tela",
    "callStats.videoNotShown":
        "Recebido, mas não está na tela: abra a visualização da chamada para assistir",
    "callStats.videoNotPainting":
        "Decodificado, mas não está sendo desenhado: tente fechar e reabrir a visualização da chamada",
    "callStats.capture": "Captura",
    "callStats.framesArrivedDecoded": "Quadros recebidos / decodificados",
    "callStats.framesEncoded": "Quadros codificados",
    "callStats.onScreen": "Na tela",
    "callStats.onScreenNo": "Não",
    "callStats.onScreenNoPicture": "Ainda sem imagem",
    "callStats.decryptErrors": "Erros de descriptografia",
    "callStats.trackState": "Faixa",
    "callStats.trackNoFrames": "Sem quadros no momento",
    "callStats.proxyRoute": "Proxy",
    "callStats.routeSignalling": "Conexão com o servidor de chamadas",
    "callStats.routeSending": "Mídia que você envia",
    "callStats.routeReceiving": "Mídia que você recebe",
    "callStats.routeDirect": "Direta",
    "callStats.routeProxy": "Por {proxy}",
    "callStats.path": "Caminho",
    "callStats.iceRtt": "Ping ICE",
    "callStats.mediaRtt": "Ping de mídia",
    "callStats.upload": "Envio",
    "callStats.download": "Download",
    "callStats.availableUpload": "Envio disponível",
    "callStats.outgoingLoss": "Perda no envio",
    "callStats.remoteAddress": "Endereço do servidor",
    "callStats.candidates": "Candidatos",
    "callStats.pathUdp": "UDP (direto)",
    "callStats.pathTcp": "TCP",
    "callStats.pathRelayUdp": "Relay TURN (UDP)",
    "callStats.pathRelayTcp": "Relay TURN (TCP)",
    "callStats.pathRelayTls": "Relay TURN (TLS)",
    "callStats.pathUnknown": "Desconhecido",
    "callStats.qualityExcellent": "Excelente",
    "callStats.qualityGood": "Boa",
    "callStats.qualityPoor": "Ruim",
    "callStats.qualityLost": "Perdida",
    "callStats.qualityUnknown": "Desconhecida",
    "callStats.streams": "Fluxos de mídia",
    "callStats.you": "Você",
    "callStats.sourceMicrophone": "Microfone",
    "callStats.sourceCamera": "Câmera",
    "callStats.sourceScreenShare": "Compartilhamento de tela",
    "callStats.sourceScreenShareAudio": "Áudio do compartilhamento de tela",
    "callStats.sourceUnknown": "Outra faixa",
    "callStats.sent": "enviado",
    "callStats.received": "recebido",
    "callStats.layer": "camada {rid}",
    "callStats.codec": "Codec",
    "callStats.codecOptions": "Opções do codec",
    "callStats.bitrate": "Taxa de bits",
    "callStats.bitrateTarget": "{rate} de no máx. {target}",
    "callStats.packetDuration": "Áudio por pacote",
    "callStats.resolution": "Resolução",
    "callStats.encoder": "Codificador",
    "callStats.decoder": "Decodificador",
    "callStats.hardware": "hardware",
    "callStats.software": "software",
    "callStats.limitedBy": "Limitado por",
    "callStats.limitCpu": "CPU",
    "callStats.limitBandwidth": "largura de banda",
    "callStats.limitNone": "nada",
    "callStats.limitOther": "outro",
    "callStats.frameTime": "Tempo por quadro",
    "callStats.resent": "Reenviados",
    "callStats.droppedFrames": "Quadros descartados",
    "callStats.nackPli": "NACK / PLI",
    "callStats.softwareEncodeHint":
        "Seu vídeo é codificado por software, o que consome CPU e pode descartar quadros sob carga. Configurações > Depuração mostra se a codificação de vídeo por hardware está disponível (video_encode em Status dos recursos).",
    "callStats.cpuLimitHint":
        "O codificador de vídeo está reduzindo a qualidade porque a CPU não dá conta.",
    "voiceCallPanel.unmute": "Reativar microfone",
    "voiceCallPanel.undeafen": "Desensurdecer",
    "voiceCallPanel.deafen": "Ensurdecer",
    "voiceCallPanel.disconnect": "Desconectar",

    // src/lib/components/messages/VoiceMessagePlayer.svelte
    "voiceMessagePlayer.seek": "Posição",
    "voiceMessagePlayer.voiceMessage": "Mensagem de voz",
    "midiPlayer.play": "Reproduzir",
    "midiPlayer.pause": "Pausar",
    "midiPlayer.seek": "Posição",
    "midiPlayer.volume": "Volume",

    // src/lib/components/messages/VoiceRecorder.svelte
    "voiceRecorder.cancelRecording": "Cancelar gravação",
    "voiceRecorder.stop": "Parar",
    "voiceRecorder.discard": "Descartar",
    "voiceRecorder.discardRecording": "Descartar gravação",
    "voiceRecorder.voiceMessage": "Mensagem de voz",
    "voiceRecorder.sending": "Enviando…",
    "voiceRecorder.send": "Enviar",
    "voiceRecorder.microphoneAccessWasDenied":
        "O acesso ao microfone foi negado.",
    "voiceRecorder.recordingFailed": "Falha na gravação.",
    "voiceRecorder.nothingWasRecorded": "Nada foi gravado.",
    "voiceRecorder.failedToSendVoiceMessage":
        "Falha ao enviar a mensagem de voz",

    // src/lib/components/settings/WhatsNew.svelte
    "whatsNew.whatSNew": "Novidades",
    "whatsNew.loadingReleaseNotes": "Carregando notas da versão…",
    "whatsNew.releaseNotesUnavailable": "Notas da versão indisponíveis.",
    "whatsNew.viewOnGithub": "Ver no GitHub",

    // src/lib/components/layout/WhatsNewModal.svelte
    "whatsNewModal.whatSNew": "Novidades",
    "whatsNewModal.whatSNewSince": "Novidades desde a v{from}",
    "whatsNewModal.whatSNewInV": "Novidades na v{APP_VERSION}",
    "whatsNewModal.releaseNotesUnavailable": "Notas da versão indisponíveis.",
    "whatsNewModal.viewOnGithub": "Ver no GitHub",
    "whatsNewModal.gotIt": "Entendi",

    // src/lib/components/layout/VerificationRequestCard.svelte
    "verificationRequestCard.verifyYourOtherSession":
        "Verifique sua outra sessão",
    "verificationRequestCard.verificationRequest": "Solicitação de verificação",
    "verificationRequestCard.anotherOfYourSessions": "Outra das suas sessões",

    // src/lib/components/messages/CallEventCard.svelte
    "callEventCard.missedCall": "Chamada perdida",
    "callEventCard.ongoingCall": "Chamada em andamento",
    "callEventCard.callEnded": "Chamada encerrada",

    // src/lib/components/messages/ComposerActionsMenu.svelte
    "composerActionsMenu.uploadAFile": "Enviar um arquivo",
    "composerActionsMenu.camera": "Câmera",
    "composerActionsMenu.photosAndVideos": "Fotos e vídeos",
    "composerActionsMenu.files": "Arquivos",
    "composerActionsMenu.sendFileDirectly": "Enviar um arquivo diretamente",
    "composerActionsMenu.createPoll": "Criar enquete",
    "composerActionsMenu.recordVoiceMessage": "Gravar mensagem de voz",
    "composerActionsMenu.shareLocation": "Compartilhar localização",
    "composerActionsMenu.createThread": "Criar tópico",
    "composerActionsMenu.inviteToGame": "Convidar para o jogo",
    "gameInvite.title": "Convidar para o jogo",
    "gameInvite.game": "Jogo",
    "gameInvite.note": "Nota (opcional)",
    "gameInvite.notePlaceholder": "Escreva algo…",
    "gameInvite.send": "Enviar convite",
    "gameInvite.noGames":
        "Nenhum jogo do Steam em execução pode ser convidado agora.",
    "gameInvite.failedToSend": "Não foi possível enviar o convite.",
    "gameInvite.cardTitle": "Convite para jogar",
    "gameInvite.sourceSteam": "Steam",
    "gameInvite.partySize": "{current} de {max} no grupo",
    "gameInvite.confirmSteam": "Iniciar {game} com os argumentos: {connect}",
    "gameInvite.confirmLobby": "Entrar no lobby de {game}",
    "gameInvite.joinGame": "Entrar no jogo",
    "gameInvite.joinSent": "Pedido de entrada enviado ao jogo.",
    "gameInvite.openInDesktop":
        "Abra no aplicativo de desktop do Zam para entrar.",
    "gameInvite.joinUnsupported":
        "Não é possível entrar neste jogo neste computador.",
    "gameInvite.joinInvalid": "Este convite não é válido.",
    "gameInvite.joinFailed": "Não foi possível entrar no jogo.",

    // src/lib/components/messages/Reactions.svelte
    "reactions.couldNotAddReaction": "Não foi possível adicionar a reação",

    // src/lib/components/ui/QrScanner.svelte
    "qrScanner.startingTheCamera": "Iniciando a câmera…",
    "qrScanner.cameraAccessWasDenied": "O acesso à câmera foi negado.",
    "qrScanner.noCameraWasFoundOnThis":
        "Nenhuma câmera foi encontrada neste dispositivo.",
    "qrScanner.theCameraIsAlreadyInUse":
        "A câmera já está sendo usada por outro aplicativo.",
    "qrScanner.couldNotOpenTheCameraA":
        "Não foi possível abrir a câmera. É necessária uma conexão segura (https).",
    "qrScanner.codeFoundCheckingIt": "Código encontrado - verificando…",
    "qrScanner.couldNotStartVerificationWithThat":
        "Não foi possível iniciar a verificação com esse código.",
    "qrScanner.thatIsnTAVerificationCode":
        "Isso não é um código de verificação.",
    "qrScanner.thisDeviceHasNoCameraAvailable":
        "Este dispositivo não tem câmera disponível.",
    "qrScanner.couldNotStartTheCameraPreview":
        "Não foi possível iniciar a prévia da câmera.",
    "qrScanner.pointTheCameraAtTheirCode":
        "Aponte a câmera para o código deles.",

    // src/lib/desktopContextMenu.ts
    "desktopContextMenu.failedToSaveImage": "Falha ao salvar a imagem",

    // src/lib/matrix/client.ts
    "client.serverAutoDiscoveryFailedUsingThe":
        "A descoberta automática do servidor falhou - usando o endereço como digitado",
    "client.discoveredHomeserverFailedValidation":
        "O servidor doméstico descoberto falhou na validação",
    "client.thisHomeserverDoesnTSupportSliding":
        "Este servidor doméstico não oferece suporte a sliding sync, então o sync clássico está sendo usado no lugar.",
    "client.notLoggedIn": "Não conectado",
    "client.creatorsNeedRoomV12":
        "Criadores adicionais exigem a versão 12 de sala ou mais nova, e este servidor não a oferece.",
    "client.oauthProviderChanged":
        "O provedor de login do servidor mudou. Tente novamente.",
    "client.thisEventTypeCannotBeForwarded":
        "Este tipo de evento não pode ser encaminhado",
    "client.notConnected": "Sem conexão",
    "client.thisServerDoesNotAllowSigning":
        "Este servidor não permite encerrar sessões com uma senha - use a página da conta dele.",
    "client.incorrectPassword": "Senha incorreta",
    "client.thisServerDoesNotAllowConfirming":
        "Este servidor não permite confirmar esta ação com uma senha - use a página da conta dele.",
    "client.directMessages": "Mensagens diretas",
    "client.messagesInDirectMessageRooms":
        "Mensagens em salas de mensagem direta",
    "client.rooms": "Salas",
    "client.messagesInAllOtherRooms": "Mensagens em todas as outras salas",
    "client.fullMatrixIdMentions": "Menções com o ID Matrix completo",
    "client.messagesUsingYourFullUserHomeserver":
        "Mensagens que usam seu ID completo @usuario:servidor",
    "client.displayNameMentions": "Menções ao nome de exibição",
    "client.messagesContainingYourDisplayName":
        "Mensagens que contêm seu nome de exibição",
    "client.usernameMentions": "Menções ao nome de usuário",
    "client.messagesContainingYourUsernameWithoutServer":
        "Mensagens que contêm seu nome de usuário (sem o servidor)",
    "client.roomMentions": "Menções a @room",
    "client.messagesUsingRoomToNotifyEveryone":
        "Mensagens que usam @room para notificar todos",
    "client.invitations": "Convites",
    "client.whenYouAreInvitedToA": "Quando você é convidado para uma sala",
    "client.thisRoom": "esta sala",
    "client.keywordCannotStartWith": "A palavra-chave não pode começar com '.'",
    "client.emotes": "Emotes de {value}",
    "client.room": "Sala",
    "client.emojis": "Emojis",
    "client.enterAShortcode": "Digite um código curto.",
    "client.useOnlyLettersNumbersDotsUnderscores":
        "Use apenas letras, números, pontos, sublinhados, sinais de mais e hifens.",
    "client.chooseAtLeastOneUsage": "Escolha pelo menos um uso.",
    "client.imageNotFound": "Imagem não encontrada.",
    "client.noPermissionToEditPack":
        "Você não tem permissão para editar este pacote.",
    "client.invalidPowerLevels": "Níveis de poder inválidos: {shapeError}",
    "client.roomCreatorsPowerLevelCannotBe":
        "O nível de poder dos criadores da sala não pode ser definido em salas v12",
    "client.restrictedJoinRequiresAtLeastOne":
        "A entrada restrita exige pelo menos um espaço pai",
    "client.orderMustBeAtMost50":
        "A ordem deve ter no máximo 50 caracteres ASCII imprimíveis (espaço até ~)",
    "client.cannotSetSuggestedOnASpace":
        "Não é possível definir como sugerida em uma sala filha de espaço sem via",
    "client.pollHasNoEventId": "A enquete não tem ID de evento",
    "client.unsupportedPoll": "Enquete sem suporte",
    "client.youCanTCloseThisPoll": "Você não pode encerrar esta enquete",
    "client.microphoneDisconnectedSwitchedToTheDefault":
        "Microfone desconectado - trocado para o dispositivo padrão",
    "client.cameraDisconnected": "Câmera desconectada",
    "client.cameraIsDisabledInSettings":
        "Sua câmera está desativada nas configurações de Voz e vídeo",
    "client.unknownRoom": "Sala desconhecida",
    "client.theServerRejectedItYouMay":
        "o servidor rejeitou - você pode não ter permissão para entrar em chamadas nesta sala",
    "client.callMembershipFailed": "Falha na participação na chamada: {detail}",
    "client.voiceServerRejectedTheJoin":
        "O servidor de voz rejeitou a entrada ({status})",
    "client.voiceCallDisconnected": "Chamada de voz desconectada",
    "client.couldNotReachCallServer":
        "Não foi possível conectar a {server}, então talvez você não ouça algumas pessoas nesta chamada.",
    "client.yourMicrophoneAppearsSilentCheckYour":
        "Seu microfone parece estar mudo - verifique seu dispositivo de entrada",
    "client.audioDeviceError": "Erro no dispositivo de áudio: {message}",
    "client.couldnTSwitchToThatKept":
        "Não foi possível trocar de {what} - o anterior foi mantido",
    "client.couldnTSwitchToThatUsing":
        "Não foi possível trocar de {what} - usando o dispositivo padrão",
    "client.couldnTSwitchToThatPick":
        "Não foi possível trocar de {what} - escolha outro dispositivo",
    "client.encryptedCallsUnsupported":
        "Esta chamada é criptografada de ponta a ponta, e este navegador não consegue criptografar a mídia da chamada. Tente um Chrome, Firefox ou Safari recente, ou o aplicativo para desktop.",
    "client.codecCouldNotBeDecoded":
        "Este dispositivo não consegue decodificar vídeo {codec}. Pedindo H.264 no lugar.",
    "client.couldNotSwitchVideoCodec":
        "Não foi possível trocar o codec de vídeo",
    "client.couldNotStartScreenShare":
        "Não foi possível iniciar o compartilhamento de tela",
    "client.couldNotShareScreenAudio":
        "O compartilhamento de tela começou sem o áudio",
    "client.couldnTChangeScreenShareQuality":
        "Não foi possível alterar a qualidade do compartilhamento de tela",
    "client.couldNotStartTheCameraCheck":
        "Não foi possível iniciar a câmera - verifique as permissões",
    "client.couldnTApplyAudioProcessingChange":
        "Não foi possível aplicar a alteração do processamento de áudio ({error})",
    "client.deviceNounMicrophone": "microfone",
    "client.deviceNounCamera": "câmera",

    // src/lib/matrix/crypto.ts
    "crypto.couldNotStartTheEmojiCheck":
        "Não foi possível iniciar a verificação por emojis",
    "crypto.couldNotCancelTheVerification":
        "Não foi possível cancelar a verificação",
    "crypto.noCodeAvailableTheOtherSide":
        "Nenhum código disponível - o outro lado não pode escanear um.",
    "crypto.couldNotGenerateAQrCode": "Não foi possível gerar um código QR",
    "crypto.thatCodeDoesnTMatchThis":
        "Esse código não corresponde a esta verificação",
    "crypto.couldNotConfirmTheQrMatch":
        "Não foi possível confirmar a correspondência do QR",
    "crypto.couldNotCancelTheQrMatch":
        "Não foi possível cancelar a correspondência do QR",
    "crypto.encryptionIsNotReadyOnThis":
        "A criptografia não está pronta nesta sessão",
    "crypto.roomIsNotEncrypted": "Esta sala não é criptografada.",
    "crypto.roomKeyDiscarded":
        "Sua próxima mensagem aqui usará uma nova chave de sala, compartilhada novamente com todas as sessões da sala.",
    "crypto.encryptionKeysUnchecked":
        "Não foi possível verificar com o servidor as chaves de criptografia desta sessão. Verifique sua conexão e recarregue.",
    "crypto.encryptionDataLost":
        "Os dados de criptografia desta sessão foram perdidos (dados do navegador apagados ou reinstalação), então ela foi desconectada para evitar que outras pessoas criptografem para chaves que ela não tem mais. Entre novamente.",
    "crypto.accountApprovalCancelled":
        "A aprovação na página da sua conta foi cancelada.",
    "crypto.accountPasswordRequired":
        "Este servidor precisa da senha da sua conta para confirmar isto.",
    "crypto.thisServerCanTConfirmEncryption":
        "Este servidor não consegue confirmar a configuração da criptografia com uma senha - use a página da conta dele.",
    "crypto.incorrectPassword": "Senha incorreta",
    "crypto.failedToGenerateARecoveryKey":
        "Falha ao gerar uma chave de recuperação",
    "crypto.yourOldRecoveryWasResetBut":
        "Sua recuperação antiga foi redefinida, mas a configuração da nova falhou.",
    "crypto.thatKeyDoesnTMatchThis":
        "Essa chave não corresponde ao backup desta conta no servidor.",
    "crypto.thatDoesnTLookLikeA":
        "Isso não parece uma chave de recuperação válida. Verifique se há erros de digitação e tente novamente.",
    "crypto.thisAccountHasNoRecoverySet":
        "Esta conta ainda não tem recuperação configurada. Configure a recuperação primeiro em uma sessão que tenha suas chaves.",
    "crypto.thatRecoveryKeyDoesnTMatch":
        "Essa chave de recuperação não corresponde a esta conta. Verifique se há erros de digitação e tente novamente.",
    "crypto.thisAccountSRecoveryWasnT":
        "A recuperação desta conta não foi configurada com uma frase secreta. Use sua chave de recuperação.",
    "crypto.couldnTUseYourPassphraseOn":
        "Não foi possível usar sua frase secreta neste dispositivo. Tente sua chave de recuperação.",
    "crypto.thatPassphraseDoesnTMatchThis":
        "Essa frase secreta não corresponde a esta conta. Verifique se há erros de digitação e tente novamente.",

    // src/lib/matrix/media.ts
    "media.notLoggedIn": "Não conectado",
    "media.failedToFetchAttachment": "Falha ao buscar o anexo: {status}",
    "media.encryptedAttachmentHasAnInvalidUrl":
        "O anexo criptografado tem uma URL inválida",
    "media.failedToFetchEncryptedAttachment":
        "Falha ao buscar o anexo criptografado: {status}",

    // src/lib/matrix/pluginHost.ts
    "pluginHost.mediaWasUploadedByADifferent":
        "A mídia foi enviada por outra conta",
    "pluginHost.notLoggedIn": "Não conectado",
    "pluginHost.notConnected": "Sem conexão",

    // src/lib/matrix/runtime.ts
    "runtime.notLoggedIn": "Não conectado",

    // src/lib/plugins/builtins/double-tap-reply/index.ts
    "doubleTapReply.doubleTapSwipeActions": "Ações de toque duplo e deslize",
    "doubleTapReply.doubleTapAMessageToReply":
        "Toque duas vezes em uma mensagem para responder, reagir ou editar, ou deslize-a para a esquerda para responder / editar.",
    "doubleTapReply.doubleTapYourMessages":
        "Tocar duas vezes nas suas mensagens",
    "doubleTapReply.nothing": "Nada",
    "doubleTapReply.reaction": "Reação",
    "doubleTapReply.reply": "Responder",
    "doubleTapReply.edit": "Editar",
    "doubleTapReply.doubleTapOtherMessages":
        "Tocar duas vezes nas outras mensagens",
    "doubleTapReply.reactionEmoji": "Emoji de reação",
    "doubleTapReply.sentWhenADoubleTapAction":
        "Enviado quando uma ação de toque duplo está definida como Reação.",
    "doubleTapReply.swipeToReplyEdit": "Deslizar para responder / editar",
    "doubleTapReply.swipeAMessageLeftToReply":
        "Deslize uma mensagem para a esquerda para responder; deslize a sua mais um pouco para editar.",
    "doubleTapReply.failedToReact": "Falha ao reagir",

    // src/lib/plugins/builtins/slash-fun/index.ts
    "slashFun.sendAnActionMessage": "Enviar uma mensagem de ação",
    "slashFun.appendToYourMessage": "Acrescentar ¯\\_(ツ)_/¯ à sua mensagem",
    "slashFun.appendToYourMessage2": "Acrescentar (╯°□°)╯︵ ┻━┻ à sua mensagem",
    "slashFun.appendToYourMessage3":
        "Acrescentar ┬─┬ ノ( ゜-゜ノ) à sua mensagem",
    "slashFun.appendToYourMessage4": "Acrescentar ( ͡° ͜ʖ ͡°) à sua mensagem",
    "slashFun.sendYourMessageAsASpoiler": "Enviar sua mensagem como spoiler",
    "slashFun.sendYourMessageWithoutMarkdownFormatting":
        "Enviar sua mensagem sem formatação markdown",
    "slashFun.funSlashCommands": "Comandos de barra divertidos",
    "slashFun.noveltySlashCommandsMeShrugTableflip":
        "Comandos de barra de novidade: /me, /shrug, /tableflip, /unflip, /lenny, /spoiler, /plain.",

    // src/lib/plugins/builtins/text-replacer/index.ts
    "textReplacer.textReplacer": "Substituidor de texto",
    "textReplacer.applyYourOwnStringOrRegex":
        "Aplique suas próprias substituições de texto ou regex ao texto das mensagens enviadas.",
    "textReplacer.replacementRules": "Regras de substituição",
    "textReplacer.appliedToYourOutgoingMessageText":
        "Aplicadas em ordem ao texto das suas mensagens enviadas. Quem recebe vê o texto normal.",
    "textReplacer.find": "Localizar",
    "textReplacer.textOrPattern": "texto ou padrão",
    "textReplacer.replaceWith": "Substituir por",
    "textReplacer.regex": "Regex",
    "textReplacer.ignoreCase": "Ignorar maiúsculas/minúsculas",
    "previewRewriter.name": "Reescritor de prévia de links",
    "previewRewriter.description":
        "Busca prévias de links em outro endereço, p. ex. um espelho de um site que seu servidor doméstico não consegue acessar.",
    "previewRewriter.rules": "Regras de reescrita",
    "previewRewriter.rulesDescription":
        "Aplicadas em ordem ao endereço de onde uma prévia é buscada. O link em si não é alterado.",

    // src/lib/plugins/pluginBoot.ts
    "pluginBoot.noPluginSyncDataOnYour":
        "Ainda não há dados de sincronização de plugins na sua conta.",
    "pluginBoot.theSyncDataOnYourAccount":
        "Os dados de sincronização na sua conta estão malformados.",
    "pluginBoot.autoUpdateFailed": "Falha na atualização automática: {value}",

    // src/lib/plugins/pluginPin.ts
    "pluginPin.pluginIdMismatchIndexListsManifest":
        "ID do plugin divergente: o índice lista “{entryId}”, o manifesto declara “{manifestId}”",
    "pluginPin.cannotInstallPluginWithIdIt":
        "Não é possível instalar o plugin com ID “{manifestId}”: ele é um plugin integrado",
    "pluginPin.pluginIsAlreadyInstalledFromA":
        "O plugin “{manifestId}” já está instalado a partir de outro repositório",

    // src/lib/plugins/repo.ts
    "repo.repoReferenceMustBeAString":
        "A referência do repositório deve ser uma string",
    "repo.repoReferenceCannotBeEmpty":
        "A referência do repositório não pode ficar vazia",
    "repo.branchCannotBeEmpty": "A branch não pode ficar vazia",
    "repo.branchCannotContain": "A branch não pode conter '..'",
    "repo.invalidRepoReferenceExtraPathSegments":
        "Referência de repositório inválida: segmentos de caminho extras (não /tree/<branch>)",
    "repo.invalidRepoReferenceMustBeOwner":
        "Referência de repositório inválida: deve ser dono/repositório",
    "repo.ownerCannotBeEmpty": "O dono não pode ficar vazio",
    "repo.invalidOwnerMustMatchAZa":
        "Dono inválido: deve corresponder a [A-Za-z0-9][A-Za-z0-9._-]*",
    "repo.repoCannotBeEmpty": "O repositório não pode ficar vazio",
    "repo.invalidRepoMustMatchAZa":
        "Repositório inválido: deve corresponder a [A-Za-z0-9][A-Za-z0-9._-]*",

    // src/lib/plugins/repoList.ts
    "repoList.enterARepoOwnerRepoOr":
        "Digite um repositório (dono/repositório ou uma URL do GitHub).",
    "repoList.thatIsTheOfficialRepoAlready":
        "Esse é o repositório oficial (já incluído).",
    "repoList.thatRepoIsAlreadyAdded": "Esse repositório já foi adicionado.",

    // src/lib/stores/gifSearch.svelte.ts
    "gifSearch.couldNotLoadGifsTryAgain":
        "Não foi possível carregar os GIFs. Tente novamente.",
    "gifSearch.couldnTReachKlipyTryAgain":
        "Não foi possível acessar o KLIPY - tente novamente.",

    // src/lib/stores/liveLocation.svelte.ts
    "liveLocation.youCanTShareLiveLocation":
        "Você não pode compartilhar localização em tempo real nesta sala.",
    "liveLocation.couldnTStartLiveLocation":
        "Não foi possível iniciar a localização em tempo real",
    "liveLocation.expired": "Expirado",
    "liveLocation.lessThanAMinuteLeft": "menos de um minuto restante",
    "liveLocation.minLeft": "{totalMin} min restantes",
    "liveLocation.hLeft": "{h} h restantes",
    "liveLocation.hMinLeft": "{h} h {m} min restantes",
    "liveLocation.justNow": "agora mesmo",
    "liveLocation.sAgo": "há {floor} s",
    "liveLocation.minAgo": "há {floor} min",
    "liveLocation.hAgo": "há {floor} h",
    "liveLocation.n15Minutes": "15 minutos",
    "liveLocation.n1Hour": "1 hora",
    "liveLocation.n8Hours": "8 horas",

    // src/lib/stores/outbox.svelte.ts
    "outbox.failedToSend": "Falha ao enviar",

    // src/lib/stores/settings.svelte.ts
    "settings.couldNotReadThatFile": "Não foi possível ler esse arquivo.",
    "settings.thatFileIsnTAValid": "Esse arquivo não é uma fonte válida.",
    "settings.fontCouldnTBeSavedOn":
        "Não foi possível salvar a fonte neste dispositivo.",
    "settings.cannotSaveAPresetWithBuilt":
        "Não é possível salvar uma predefinição com o nome de uma integrada: {name}",

    // src/lib/stores/shareInbox.svelte.ts
    "shareInbox.youReOfflineTheShareWas":
        "Você está offline: o compartilhamento foi adicionado ao campo de mensagem",
    "shareInbox.couldnTSendTheShare":
        "Não foi possível enviar o compartilhamento",

    // src/lib/stores/verification.svelte.ts
    "verification.finishingAnotherVerificationFirstTryAgain":
        "Concluindo outra verificação primeiro. Tente novamente.",
    "verification.waitingForTheOtherSideTo": "Aguardando o outro lado aceitar…",
    "verification.acceptedSettingUpTheCheck":
        "Aceito - preparando a verificação…",
    "verification.verifying": "Verificando…",
    "verification.sessionVerified": "Sessão verificada",
    "verification.userVerified": "Usuário verificado",
    "verification.verificationCancelled": "Verificação cancelada",
    "verification.verified": "Verificado",
    "verification.unverified": "Não verificado",
    "verification.signedByYou": "Assinado por você",
    "verification.notSignedByOwner": "Não assinado pelo dono",
    "verification.verifyWithAnotherDevice": "Verificar com outro dispositivo",
    "verification.useAnotherDevice": "Usar outro dispositivo",
    "verification.couldNotSendVerificationRequest":
        "Não foi possível enviar a solicitação de verificação",
    "verification.sessionNotKnownYet":
        "Esta sessão ainda não conhece aquela. Aguarde alguns segundos e tente novamente, ou inicie a verificação pela nova sessão.",
    "verification.accountHasNoIdentity":
        "As chaves de assinatura cruzada da sua conta não estão no servidor, então suas outras sessões não conseguem verificar esta. Abra Configurações > Segurança e criptografia na sessão onde você configurou a recuperação: se ela oferecer enviar suas chaves, faça isso. Se você nunca configurou a recuperação, configure-a em qualquer sessão.",
    "verification.sessionHasNoKeys":
        "Aquela sessão não publicou suas chaves de criptografia, então não pode ser verificada nem receber mensagens criptografadas. Faça-a sair e entrar novamente.",
    "verification.sessionKeysRejected":
        "As chaves de criptografia daquela sessão foram rejeitadas por esta sessão. Faça-a sair e entrar novamente.",
    "verification.identityChanged": "Identidade alterada",
    "verification.couldnTAcceptThisRequestTry":
        "Não foi possível aceitar esta solicitação. Tente novamente.",

    // src/lib/stores/voiceCall.svelte.ts
    "voiceCall.couldnTLoadTheCallComponent":
        "Não foi possível carregar o componente de chamada. Verifique sua conexão e recarregue a página para tentar novamente.",
    "voiceCall.couldNotJoinTheVoiceCall":
        "Não foi possível entrar na chamada de voz",
    "voiceCall.joinedWithoutAMicrophone":
        "Seu microfone não está disponível - você ainda pode ouvir e compartilhar sua tela",
    "voiceCall.couldNotMuteYourMicrophone":
        "Não foi possível silenciar seu microfone",
    "voiceCall.couldNotUnmuteYourMicrophoneCheck":
        "Não foi possível reativar seu microfone - verifique seu dispositivo de entrada",
    "voiceCall.connecting": "Conectando…",
    "voiceCall.startedSharing": "{name} está compartilhando a tela",
    "voiceCall.watch": "Assistir",
    "voiceCall.voiceConnected": "Voz conectada",
    "voiceCall.reconnecting": "Reconectando…",
    "voiceCall.gpuGivenUp":
        "Os gráficos continuaram travando, então a GPU fica desativada até o Zam reiniciar e o vídeo é codificado por software.",
    "voiceCall.gpuRecovered":
        "Os gráficos reiniciaram, então a chamada se reconectou para manter a codificação de vídeo na GPU.",
    "voiceCall.restartZam": "Reiniciar o Zam",
    "voiceCall.youWereBannedFromThisRoom":
        "Você foi banido desta sala - chamada encerrada",
    "voiceCall.youLeftThisRoomCallEnded":
        "Você saiu desta sala - chamada encerrada",
    "voiceCall.youWereRemovedFromThisRoom":
        "Você foi removido desta sala - chamada encerrada",

    // src/lib/update.ts
    "update.noReleasesFoundYet": "Nenhuma versão encontrada ainda.",
    "update.githubApiError": "Erro da API do GitHub ({status}).",
    "update.staleBuild":
        "Esta versão web ({current}) é mais antiga que a última versão ({latest}). O servidor pode ainda estar se atualizando; tente novamente em alguns minutos.",
    "update.couldNotReadTheLatestVersion":
        "Não foi possível ler a versão mais recente.",

    // src/lib/utils/accountSecurity.ts
    "accountSecurity.enterYourCurrentPassword": "Digite sua senha atual.",
    "accountSecurity.enterANewPassword": "Digite uma nova senha.",
    "accountSecurity.newPasswordMustBeAtLeast":
        "A nova senha deve ter pelo menos 8 caracteres.",
    "accountSecurity.newPasswordMustBeDifferentFrom":
        "A nova senha deve ser diferente da sua senha atual.",
    "accountSecurity.passwordsDoNotMatch": "As senhas não coincidem.",

    // src/lib/utils/activeSession.ts
    "activeSession.offAlwaysNotify": "Desativado - sempre notificar",
    "activeSession.n15Seconds": "15 segundos",
    "activeSession.n30Seconds": "30 segundos",
    "activeSession.n1Minute": "1 minuto",
    "activeSession.n2Minutes": "2 minutos",
    "activeSession.n5Minutes": "5 minutos",
    "activeSession.n10Minutes": "10 minutos",
    "activeSession.n30Minutes": "30 minutos",
    "activeSession.enterANumberOfMinutes": "Digite um número de minutos.",
    "activeSession.chooseAtLeast1MinuteUse":
        "Escolha pelo menos 1 minuto - use a lista acima para tempos menores.",
    "activeSession.chooseMinutes2HoursOrLess":
        "Escolha {MAX_CUSTOM_GRACE_MINUTES} minutos (2 horas) ou menos.",

    // src/lib/utils/audioDevices.ts
    "audioDevices.microphone": "Microfone",
    "audioDevices.speaker": "Alto-falante",
    "audioDevices.camera": "Câmera",

    // src/lib/utils/audioPlayback.ts
    "audioPlayback.failedToLoadRetry": "Falha ao carregar · Tentar novamente",
    "audioPlayback.clickToPlay": "Clique para reproduzir",

    // src/lib/utils/clientGeneration.ts
    "clientGeneration.sessionChangedBeforeTheOperationFinished":
        "A sessão mudou antes de a operação terminar",

    // src/lib/utils/customFont.ts
    "customFont.useAWoff2TtfOrOtf":
        "Use um arquivo de fonte .woff2, .ttf ou .otf.",
    "customFont.thatFontFileIsEmpty": "Esse arquivo de fonte está vazio.",
    "customFont.fontFileIsTooLargeMax":
        "O arquivo de fonte é grande demais (máx. 10 MB).",
    "customFont.customFont": "Fonte personalizada",

    // src/lib/utils/deviceSessions.ts
    "deviceSessions.unknown": "Desconhecido",
    "deviceSessions.justNow": "Agora mesmo",
    "deviceSessions.desktopApp": "Aplicativo para desktop",
    "deviceSessions.on": "{client} em {os}",
    "deviceSessions.minutesAgo":
        "{count, plural, one {há # minuto} other {há # minutos}}",
    "deviceSessions.hoursAgo":
        "{count, plural, one {há # hora} other {há # horas}}",
    "deviceSessions.daysAgo":
        "{count, plural, one {há # dia} other {há # dias}}",

    // src/lib/utils/displaySources.ts
    "displaySources.screen": "Tela",
    "displaySources.untitledWindow": "Janela sem título",

    // src/lib/utils/encryptionState.ts
    "encryptionState.unableToDecryptYouMayNot":
        "Não foi possível descriptografar - você pode não ter as chaves desta mensagem.",
    "encryptionState.theSenderChoseNotToShare":
        "O remetente optou por não compartilhar as chaves desta mensagem.",
    "encryptionState.theSenderDidNotShareThe":
        "O remetente não compartilhou as chaves porque este dispositivo não está verificado. Verifique este dispositivo para ler mensagens como esta.",
    "encryptionState.senderDeviceNotCrossSigned":
        "O dispositivo do remetente não tem assinatura cruzada do dono, então esta mensagem está oculta. Peça que a pessoa verifique aquela sessão.",
    "encryptionState.senderDeviceUnknown":
        "Esta mensagem não pode ser ligada a nenhum dispositivo conhecido do remetente, então está oculta.",
    "encryptionState.senderIdentityChanged":
        "A identidade do remetente mudou desde que você o verificou, então esta mensagem está oculta. Verifique-o novamente para lê-la.",
    "encryptionState.historicalNoBackup":
        "Esta mensagem foi enviada antes de este dispositivo entrar na conta, e não há backup de chaves para restaurá-la.",
    "encryptionState.historicalBackupUnconfigured":
        "Esta mensagem foi enviada antes de este dispositivo entrar na conta. Digite sua chave de recuperação para restaurá-la do backup de chaves.",
    "encryptionState.historicalWorkingBackup":
        "Esta mensagem foi enviada antes de este dispositivo entrar na conta e não foi encontrada no seu backup de chaves.",
    "encryptionState.historicalNotJoined":
        "Esta mensagem foi enviada enquanto você não estava na sala.",
    "encryptionState.encryptedMessage": "🔒 Mensagem criptografada",

    // src/lib/utils/eventShield.ts
    "eventShield.thisMessageSEncryptionCouldNot":
        "A criptografia desta mensagem não pôde ser totalmente verificada.",
    "eventShield.encryptedByAnUnverifiedUser":
        "Criptografada por um usuário não verificado.",
    "eventShield.encryptedByADeviceNotVerified":
        "Criptografada por um dispositivo não verificado pelo dono.",
    "eventShield.encryptedByAnUnknownOrDeleted":
        "Criptografada por um dispositivo desconhecido ou excluído.",
    "eventShield.theAuthenticityOfThisEncryptedMessage":
        "A autenticidade desta mensagem criptografada não pode ser garantida neste dispositivo.",
    "eventShield.theSenderWasPreviouslyVerifiedBut":
        "O remetente foi verificado anteriormente, mas mudou de identidade.",
    "eventShield.theSenderDoesnTMatchThe":
        "O remetente não corresponde ao dono do dispositivo que enviou esta mensagem.",

    // src/lib/utils/extendedProfile.ts
    "extendedProfile.aStatusNeedsBothAnEmoji":
        "Um status precisa de um emoji e de um texto.",
    "extendedProfile.inACall": "Em uma chamada",
    "extendedProfile.inACallForMin": "Em uma chamada há {minutes} min",
    "extendedProfile.inACallForH": "Em uma chamada há {hours} h",
    "extendedProfile.other": "Outro",
    "extendedProfile.atMostLinks": "No máximo {MAX_CONNECTIONS} links.",
    "extendedProfile.linksMustBeHttpHttpsMailto":
        "Os links devem ser endereços http, https, mailto ou matrix.",
    "extendedProfile.inACallForHMin":
        "Em uma chamada há {hours} h {minutes} min",

    // src/lib/utils/geoErrors.ts
    "geoErrors.locationNeedsASecureHttpsConnection":
        "A localização precisa de uma conexão segura (HTTPS) - abra o aplicativo por https.",
    "geoErrors.locationPermissionWasDeniedCheckSite":
        "A permissão de localização foi negada - verifique as permissões do site.",
    "geoErrors.yourPositionIsUnavailableLocationOff":
        "Sua posição está indisponível (localização desativada ou sem sinal de GPS).",
    "geoErrors.timedOutGettingYourLocation":
        "Tempo esgotado ao obter sua localização.",
    "geoErrors.couldnTGetYourLocation":
        "Não foi possível obter sua localização.",
    "geoErrors.locationIsnTAvailableInThis":
        "A localização não está disponível neste navegador.",

    // src/lib/utils/joinRules.ts
    "joinRules.onlyAvailableForRoomsInsideA":
        "Disponível somente para salas dentro de um espaço",
    "joinRules.thisRoomSVersionDoesnT":
        "A versão desta sala não oferece suporte a entrada restrita a um espaço",

    // src/lib/utils/keyBackup.ts
    "keyBackup.preparing": "Preparando…",
    "keyBackup.fetchingYourEncryptedHistory":
        "Buscando seu histórico criptografado…",
    "keyBackup.restoringYourEncryptedHistory":
        "Restaurando seu histórico criptografado…",
    "keyBackup.restoringOfKeys": "Restaurando {successes} de {total} chaves…",
    "keyBackup.noEncryptedHistoryToRestore":
        "Nenhum histórico criptografado para restaurar",
    "keyBackup.restored":
        "{count, plural, one {# chave restaurada} other {# chaves restauradas}}",
    "keyBackup.ofKeysRestored": "{imported} de {total} chaves restauradas",
    "keyBackup.notSetUp": "Não configurado",
    "keyBackup.notTrusted": "Não confiável",
    "keyBackup.notConnected": "Não conectado",
    "keyBackup.on": "Ativado",
    "keyBackup.encryptedMessageHistoryIsnTBeing":
        "O histórico de mensagens criptografadas não está sendo copiado em backup. Configure a recuperação para protegê-lo.",
    "keyBackup.aBackupExistsOnTheServer":
        "Existe um backup no servidor, mas esta sessão ainda não confia nele.",
    "keyBackup.aBackupExistsButThisSession":
        "Existe um backup, mas esta sessão não está conectada a ele. Digite sua chave de recuperação para restaurar seu histórico.",
    "keyBackup.messageHistoryIsBeingBackedUp":
        "O histórico de mensagens está sendo copiado em backup (v{version}).",
    "keyBackup.messageHistoryIsBeingBackedUp2":
        "O histórico de mensagens está sendo copiado em backup.",
    "keyBackup.noKeysBackedUpYet": "Nenhuma chave com backup ainda",
    "keyBackup.backedUp":
        "{count, plural, one {# chave com backup} other {# chaves com backup}}",
    "keyBackup.stillToUpload":
        "{count, plural, one {# chave ainda a enviar} other {# chaves ainda a enviar}}",
    "keyBackup.everythingOnThisSessionIsBacked": "Tudo nesta sessão tem backup",
    "keyBackup.notSet": "Não definido",
    "keyExportSettings.exportOrImportRoomKeys":
        "Exportar ou importar chaves de sala",
    "keyExportSettings.aKeyFileLetsAnotherApp":
        "Um arquivo de chaves permite que outro aplicativo Matrix, ou uma nova sessão, leia seu histórico de mensagens criptografadas. Guarde o arquivo e sua frase secreta em um lugar seguro: quem tiver os dois pode ler suas mensagens.",
    "keyExportSettings.export": "Exportar",
    "keyExportSettings.import": "Importar",
    "keyExportSettings.passphrase": "Frase secreta",
    "keyExportSettings.confirmPassphrase": "Confirmar frase secreta",
    "keyExportSettings.passphrasesDontMatch":
        "As frases secretas não coincidem",
    "keyExportSettings.exportKeys": "Exportar chaves",
    "keyExportSettings.exporting": "Exportando…",
    "keyExportSettings.exported":
        "{count, plural, one {# chave exportada} other {# chaves exportadas}}",
    "keyExportSettings.couldNotExportYourKeys":
        "Não foi possível exportar suas chaves",
    "keyExportSettings.keyFile": "Arquivo de chaves",
    "keyExportSettings.importKeys": "Importar chaves",
    "keyExportSettings.wrongPassphrase":
        "Frase secreta incorreta, ou o arquivo foi alterado",
    "keyExportSettings.notAKeyFile":
        "Isso não é um arquivo de chaves, ou ele está danificado",
    "keyExportSettings.newerFormat":
        "Este arquivo de chaves foi criado por um aplicativo mais novo e não pode ser lido aqui",
    "keyExportSettings.couldNotImportTheKeys":
        "Não foi possível importar as chaves",

    // src/lib/utils/keywordRules.ts
    "keywordRules.keywordCannotBeEmpty": "A palavra-chave não pode ficar vazia",
    "keywordRules.keywordCannotStartWith":
        "A palavra-chave não pode começar com '.'",
    "keywordRules.youAlreadyHaveARuleFor":
        "Você já tem uma regra para esta palavra-chave",

    // src/lib/utils/liveAnnouncer.ts
    "liveAnnouncer.messageFrom": "Mensagem de {sender}",
    "liveAnnouncer.newMessagesFrom":
        "{count, plural, one {# nova mensagem de {sender}} other {# novas mensagens de {sender}}}",
    "liveAnnouncer.newMessages":
        "{count, plural, one {# nova mensagem} other {# novas mensagens}}",

    // src/lib/utils/liveShareStop.ts
    "liveShareStop.couldnTStopSharingYourLive":
        "Não foi possível parar de compartilhar sua localização em tempo real - ela ainda está visível para esta sala. Use Tentar parar de novo.",
    "liveShareStop.stopping": "Parando…",
    "liveShareStop.stillSharingCouldnTStop":
        "Ainda compartilhando - não foi possível parar",
    "liveShareStop.youReAlreadySharingYourLive":
        "Você já está compartilhando sua localização em tempo real nesta sala.",
    "liveShareStop.yourLastLiveLocationShareHere":
        "Seu último compartilhamento de localização em tempo real aqui ainda não parou - pare-o pelo banner da sala antes de iniciar um novo.",
    "liveShareStop.stop": "Parar",
    "liveShareStop.retryStop": "Tentar parar de novo",

    // src/lib/utils/location.ts
    "location.location": "Localização",

    // src/lib/utils/mediaGallery.ts
    "mediaGallery.of": "{value} de {length}{value2}",

    // src/lib/utils/messageActionsMenu.ts
    "messageActionsMenu.edit": "Editar",
    "messageActionsMenu.unpin": "Desafixar",
    "messageActionsMenu.pin": "Fixar",
    "messageActionsMenu.copyLink": "Copiar link",
    "messageActionsMenu.markUnread": "Marcar como não lida",
    "messageActionsMenu.couldNotMarkUnread":
        "Não foi possível marcar como não lida",
    "messageActionsMenu.report": "Denunciar",

    // src/lib/utils/messageDisplay.ts
    "messageDisplay.systemDefault": "Padrão do sistema",

    // src/lib/utils/micErrorMessage.ts
    "micErrorMessage.microphoneAccessIsBlockedAllowIt":
        "O acesso ao microfone está bloqueado - permita-o no navegador ou nas configurações do sistema para falar",
    "micErrorMessage.noMicrophoneFoundConnectOneOr":
        "Nenhum microfone encontrado - conecte um ou escolha outro dispositivo de entrada para falar",
    "micErrorMessage.couldNotOpenYourMicrophoneAnother":
        "Não foi possível abrir seu microfone - outro aplicativo pode estar usando-o",

    // src/lib/utils/mutePowerLevel.ts
    "mutePowerLevel.enterAPowerLevel": "Digite um nível de poder",
    "mutePowerLevel.mustBeAWholeNumber": "Deve ser um número inteiro",
    "mutePowerLevel.useToMute": "Use {MUTE_POWER_LEVEL} para silenciar",
    "mutePowerLevel.youCanTSetALevel":
        "Você não pode definir um nível acima do seu ({ceiling})",

    // src/lib/utils/notifActions.ts
    "notifActions.reply": "Responder",
    "notifActions.reply2": "Responder…",
    "notifActions.markAsRead": "Marcar como lida",

    // src/lib/utils/notificationPrivacy.ts
    "notificationPrivacy.sentAMessage": "enviou uma mensagem",
    "notificationPrivacy.newMessage": "Nova mensagem",

    // src/lib/utils/notifyPermission.ts
    "notifyPermission.notificationsAreBlockedSoIncomingCalls":
        "As notificações estão bloqueadas, então as chamadas recebidas não vão alertar você quando esta janela estiver oculta. Desbloqueie as notificações nas configurações do sistema.",
    "notifyPermission.thisBrowserCanTShowCall":
        "Este navegador não consegue mostrar alertas de chamada quando a janela está oculta.",

    // src/lib/utils/pollContent.ts
    "pollContent.addAQuestion": "Adicione uma pergunta.",
    "pollContent.addAtLeastTwoOptions": "Adicione pelo menos duas opções.",
    "pollContent.atMostOptions": "No máximo {MAX_ANSWERS} opções.",
    "pollContent.invalidNumberOfSelections": "Número de seleções inválido.",
    "pollContent.thePollHasEnded": "A enquete terminou.",

    // src/lib/utils/powerLevels.ts
    "powerLevels.enterAPowerLevel": "Digite um nível de poder",
    "powerLevels.mustBeAWholeNumber": "Deve ser um número inteiro",
    "powerLevels.mustBe0OrHigher": "Deve ser 0 ou maior",
    "powerLevels.youCanTSetALevel":
        "Você não pode definir um nível acima do seu ({ceiling})",

    // src/lib/utils/presence.ts
    "presence.online": "Online",
    "presence.away": "Ausente",
    "presence.offline": "Offline",
    "presence.seenAsOnlineWhileTheApp":
        "Aparece como online enquanto o aplicativo está sincronizando",
    "presence.shownAsIdleToOtherUsers":
        "Aparece como inativo para os outros usuários",
    "presence.doNotDisturb": "Não incomodar",
    "presence.doNotDisturbDescription":
        "Silencia notificações e chamadas em todos os seus dispositivos",
    "presence.invisible": "Invisível",
    "presence.appearOfflineToOtherUsers":
        "Aparece como offline para os outros usuários",

    // src/lib/utils/pushRuleWrite.ts
    "pushRuleWrite.yourHomeserverHasNoNotificationRule":
        "Seu servidor doméstico não tem a regra de notificação “{label}”, então ela não pôde ser alterada.",
    "pushRuleWrite.yourHomeserverRejectedTheChangeTo":
        "Seu servidor doméstico rejeitou a alteração das notificações de “{label}”.",
    "pushRuleWrite.notificationsDidNotChangeOnYour":
        "As notificações de “{label}” não mudaram no seu servidor doméstico.",
    "pushRuleWrite.couldNotSaveNotificationsCheckYour":
        "Não foi possível salvar as notificações de “{label}”. Verifique sua conexão e tente novamente.",

    // src/lib/utils/pusherVerification.ts
    "pusherVerification.noGatewayUrl": "(sem URL de gateway)",

    // src/lib/utils/recoveryPassphrase.ts
    "recoveryPassphrase.enterAPassphrase": "Digite uma frase secreta.",
    "recoveryPassphrase.useAtLeastCharacters":
        "Use pelo menos {MIN_PASSPHRASE_LENGTH} caracteres.",

    // src/lib/utils/reportMessage.ts
    "reportMessage.failedToSendReport": "Falha ao enviar a denúncia",

    // src/lib/utils/roomAliases.ts
    "roomAliases.enterAnAddress": "Digite um endereço.",
    "roomAliases.addressesCannotContainSpaces":
        "Os endereços não podem conter espaços.",
    "roomAliases.addressesCannotContain": "Os endereços não podem conter ':'.",
    "roomAliases.addressesCannotContain2": "Os endereços não podem conter '#'.",
    "roomAliases.addressesCannotContainControlCharacters":
        "Os endereços não podem conter caracteres de controle.",
    "roomAliases.addressIsTooLongMaxCharacters":
        "O endereço é longo demais (máx. {MAX_ALIAS_LENGTH} caracteres).",
    "roomAliases.thatAddressAlreadyExists": "Esse endereço já existe.",

    // src/lib/utils/roomCreationOutcome.ts
    "roomCreationOutcome.theServerRejectedTheChange":
        "o servidor rejeitou a alteração",
    "roomCreationOutcome.theRoomWasCreatedButAdding":
        "A sala foi criada, mas adicioná-la ao espaço falhou: {detailSentence}",
    "roomCreationOutcome.theDirectMessageWasCreatedBut":
        "A mensagem direta foi criada, mas salvá-la na sua lista de mensagens diretas falhou: {detailSentence} Ela pode aparecer como uma sala normal até que isso seja tentado de novo.",
    "roomCreationOutcome.theRoomWasCreatedButAdding2":
        "A sala foi criada, mas adicioná-la ao espaço ainda não foi confirmado - pode ainda estar sendo salvo. Tente novamente se a sala não aparecer no espaço.",
    "roomCreationOutcome.theDirectMessageWasCreatedBut2":
        "A mensagem direta foi criada, mas salvá-la na sua lista de mensagens diretas ainda não foi confirmado - pode ainda estar sendo salvo. Tente novamente se ela não aparecer na sua lista de mensagens diretas.",

    // src/lib/utils/roomEncryption.ts
    "roomEncryption.thisRoomIsAlreadyEncrypted":
        "Esta sala já é criptografada.",
    "roomEncryption.youNeedPowerLevelToEnable":
        "Você precisa do nível de poder {required} para ativar a criptografia.",
    "roomEncryption.youAlreadyHaveADirectMessage":
        "Você já tem uma mensagem direta com este usuário, e ela não é criptografada. A criptografia não pode ser adicionada automaticamente - abra-a e ative-a nas configurações de Segurança da sala.",
    "roomEncryption.enableEncryptionWarning":
        "A criptografia não pode ser desativada depois de ativada. Todos precisarão de um cliente que ofereça suporte a criptografia para ler as novas mensagens.",

    // src/lib/utils/roomHeaderMenu.ts
    "roomHeaderMenu.threads": "Tópicos",
    "roomHeaderMenu.pinnedMessages": "Mensagens fixadas",
    "roomHeaderMenu.notificationsInbox": "Caixa de notificações",
    "roomHeaderMenu.mediaAndFiles": "Mídia e arquivos",
    "roomHeaderMenu.memberList": "Lista de membros",

    // src/lib/utils/roomMedia.ts
    "roomMedia.image": "Imagem",
    "roomMedia.video": "Vídeo",
    "roomMedia.file": "Arquivo",
    "roomMedia.audio": "Áudio",
    "roomMedia.kb": "{toFixed} KB",
    "roomMedia.mb": "{toFixed} MB",

    // src/lib/utils/roomSettingsNav.ts
    "roomSettingsNav.general": "Geral",
    "roomSettingsNav.access": "Acesso",
    "roomSettingsNav.security": "Segurança",
    "roomSettingsNav.permissions": "Permissões",
    "roomSettingsNav.members": "Membros",
    "roomSettingsNav.emotes": "Emotes",
    "roomSettingsNav.rooms": "Salas",

    // src/lib/utils/roomStateTrust.ts
    "roomStateTrust.unverifiedRoomState": "Estado da sala não verificado",
    "roomStateTrust.unverifiedRoomStateTooltip":
        "Alguns detalhes desta sala (cargos, participação e permissões) foram obtidos diretamente do servidor e não foram confirmados pela sincronização, então podem estar imprecisos. As ações continuam sendo aplicadas pelo servidor, independentemente do que é mostrado aqui.",

    // src/lib/utils/roomUpgrade.ts
    "roomUpgrade.theServerSRecommendedRoomVersion":
        "A versão de sala recomendada pelo servidor não está disponível.",
    "roomUpgrade.thisRoomIsOnTheLatest":
        "Esta sala está na versão mais recente (v{recommendedVersion}).",
    "roomUpgrade.youDonTHavePermissionTo":
        "Você não tem permissão para atualizar esta sala.",

    // src/lib/utils/saveFile.ts
    "saveFile.savedToDownloads": "Salvo em Downloads",

    // src/lib/utils/securityStatusView.ts
    "securityStatusView.couldnTReadThisAccountS":
        "Não foi possível ler o status de criptografia desta conta. Nada aqui é confiável até carregar - não configure nem redefina a recuperação ainda.",
    "securityStatusView.encryptionIsnTReadyOnThis":
        "A criptografia ainda não está pronta nesta sessão. Recarregue se isso persistir.",

    // src/lib/utils/serverAcl.ts
    "serverAcl.allowListIsEmptyWhichDenies":
        "A lista de permitidos está vazia, o que impede todos os servidores de federar.",
    "serverAcl.denyListContainsWhichBansAll":
        "A lista de negados contém *, que bane todos os servidores.",
    "serverAcl.thisConfigurationBansYourOwnServer":
        "Esta configuração bane o seu próprio servidor ({ownServerName}), o que vai quebrar a federação.",

    // src/lib/utils/serverCapabilities.ts
    "serverCapabilities.crossSigningE2ee": "Assinatura cruzada (E2EE)",
    "serverCapabilities.privateReadReceipts":
        "Confirmações de leitura privadas",
    "serverCapabilities.threadedRelations": "Relações de tópicos",
    "serverCapabilities.spaceSummaries": "Resumos de espaços",
    "serverCapabilities.busyPresence": "Presença ocupado",
    "serverCapabilities.dehydratedDevices": "Dispositivos desidratados",
    "serverCapabilities.filterPublicRoomsByType":
        "Filtrar salas públicas por tipo",
    "serverCapabilities.authenticatedMedia": "Mídia autenticada",
    "serverCapabilities.intentionalMentions": "Menções intencionais",
    "serverCapabilities.slidingSyncSimplified": "Sliding sync (simplificado)",
    "serverCapabilities.sharedRoomsWithAUser":
        "Salas compartilhadas com um usuário",

    // src/lib/utils/settingsNav.ts
    "settingsNav.account": "Conta",
    "settingsNav.securitySessions": "Segurança e sessões",
    "settingsNav.privacySafety": "Privacidade e segurança",
    "settingsNav.app": "Aplicativo",
    "settingsNav.appearance": "Aparência",
    "settingsNav.messagesMedia": "Mensagens e mídia",
    "settingsNav.voiceVideo": "Voz e vídeo",
    "settingsNav.emotes": "Emotes",
    "settingsNav.advanced": "Avançado",
    "settingsNav.general": "Geral",
    "settingsNav.plugins": "Plugins",
    "settingsNav.server": "Servidor",
    "settingsNav.about": "Sobre",
    "settingsNav.debug": "Depuração",

    // src/lib/utils/settingsSearch.ts
    "settingsSearch.displayName": "Nome de exibição",
    "settingsSearch.avatar": "Avatar",
    "settingsSearch.presence": "Presença",
    "settingsSearch.changePassword": "Alterar senha",
    "settingsSearch.logOut": "Sair",
    "settingsSearch.deactivateAccount": "Desativar conta",
    "settingsSearch.sessions": "Sessões",
    "settingsSearch.encryptNewDirectMessages":
        "Criptografar novas mensagens diretas",
    "settingsSearch.onlySendToVerifiedDevices":
        "Enviar somente para dispositivos verificados",
    "settingsSearch.setUpRecovery": "Configurar recuperação",
    "settingsSearch.restoreMessageHistory": "Restaurar histórico de mensagens",
    "settingsSearch.verifyThisSession": "Verificar esta sessão",
    "settingsSearch.rightAlignMyMessages": "Alinhar minhas mensagens à direita",
    "settingsSearch.showWhenIAmInA": "Mostrar quando estou em uma chamada",
    "settingsSearch.showNameColours": "Mostrar cores dos nomes",
    "settingsSearch.textSize": "Tamanho do texto",
    "settingsSearch.font": "Fonte",
    "settingsSearch.themePresets": "Predefinições de tema",
    "settingsSearch.importExportTheme": "Importar / exportar tema",
    "settingsSearch.timeFormat": "Formato de hora",
    "settingsSearch.dateFormat": "Formato de data",
    "settingsSearch.showMatrixIds": "Mostrar IDs Matrix",
    "settingsSearch.readReceiptAvatars": "Avatares de confirmação de leitura",
    "settingsSearch.linkPreviews": "Prévias de links",
    "settingsSearch.linkPreviewMedia": "Mídia da prévia de links",
    "settingsSearch.pauseVideosOffScreen": "Pausar vídeos fora da tela",
    "settingsSearch.sendVideosThatStreamFaster":
        "Enviar vídeos que carregam mais rápido",
    "settingsSearch.sendPhotosThatAppearSooner":
        "Enviar fotos que aparecem mais cedo",
    "settingsSearch.removeLocationAndMetadata":
        "Remover localização e outros metadados dos envios",
    "settingsSearch.sendGifsAsAnimatedWebp": "Enviar GIFs como WebP animado",
    "settingsSearch.midiSoundBank": "Banco de sons MIDI",
    "settingsSearch.holdToOpenMessageMenu":
        "Pressionar e segurar para abrir o menu da mensagem",
    "settingsSearch.checkSpelling": "Verificar ortografia",
    "settingsSearch.gifDefaultTab": "Aba padrão de GIFs",
    "settingsSearch.minimiseToTrayOnClose":
        "Minimizar para a bandeja ao fechar",
    "settingsSearch.richPresence": "Presença detalhada",
    "settingsSearch.runAtStartup": "Executar na inicialização",
    "settingsSearch.proxy": "Proxy",
    "settingsSearch.reduceMotion": "Reduzir movimento",
    "settingsSearch.keepRoomListOpen": "Manter a lista de salas aberta",
    "settingsSearch.customEmotes": "Emotes personalizados",
    "settingsSearch.pushNotificationsPermission":
        "Permissão de notificações push",
    "settingsSearch.notificationSound": "Som de notificação",
    "settingsSearch.desktopAlertsPopUpAndTaskbar":
        "Alertas do desktop (pop-up e piscar da barra de tarefas)",
    "settingsSearch.popUpNotifications": "Notificações em pop-up",
    "settingsSearch.quietOnMyOtherDevices":
        "Silêncio nos meus outros dispositivos",
    "settingsSearch.privateReadReceipts": "Confirmações de leitura privadas",
    "settingsSearch.hideMessageTextInNotifications":
        "Ocultar o texto das mensagens nas notificações",
    "settingsSearch.notificationRules": "Regras de notificação",
    "settingsSearch.keywordHighlights": "Destaques de palavras-chave",
    "settingsSearch.inputDevice": "Dispositivo de entrada",
    "settingsSearch.outputDevice": "Dispositivo de saída",
    "settingsSearch.camera": "Câmera",
    "settingsSearch.noiseSuppression": "Supressão de ruído",
    "settingsSearch.echoCancellation": "Cancelamento de eco",
    "settingsSearch.autoGainControl": "Controle automático de ganho",
    "settingsSearch.normalizeVoices": "Uniformizar o volume das vozes",
    "settingsSearch.mirrorMyCamera": "Espelhar minha câmera",
    "settingsSearch.videoCodec": "Codec de vídeo",
    "settingsSearch.noiseSuppressionGpu": "Aceleração por GPU",
    "settingsSearch.adaptiveStream": "Qualidade de vídeo adaptativa",
    "settingsSearch.callVolume": "Volume da chamada",
    "settingsSearch.playCallSounds": "Tocar sons de chamada",
    "settingsSearch.ringForIncomingDmCalls":
        "Tocar para chamadas recebidas em mensagens diretas",
    "settingsSearch.blockedUsers": "Usuários bloqueados",
    "settingsSearch.serverCapabilities": "Recursos do servidor",
    "settingsSearch.plugins": "Plugins",
    "settingsSearch.pluginRepositories": "Repositórios de plugins",
    "settingsSearch.syncPlugins": "Sincronizar plugins",
    "settingsSearch.checkForUpdates": "Verificar atualizações",
    "settingsSearch.clearCache": "Limpar cache",
    "settingsSearch.showAllEvents": "Mostrar todos os eventos",
    "settingsSearch.orderHints": "Dicas de ordem das mensagens",
    "settingsSearch.stickyCallMembership": "Participação em chamadas sticky",
    "settingsSearch.pushDiagnostics": "Diagnóstico de push",
    "settingsSearch.pushService": "Serviço de push (UnifiedPush / Firebase)",
    "settingsSearch.language": "Idioma",

    // src/lib/utils/slashCommands.ts
    "slashCommands.createAPoll": "Criar uma enquete",
    "slashCommands.shareYourLocation": "Compartilhar sua localização",
    "slashCommands.joinARoomByAddress": "Entrar em uma sala pelo endereço",
    "slashCommands.leaveTheCurrentRoom": "Sair da sala atual",
    "slashCommands.inviteAUserToThisRoom": "Convidar um usuário para esta sala",
    "slashCommands.setTheRoomTopic": "Definir o tópico da sala",
    "slashCommands.removeAUserFromThisRoom": "Remover um usuário desta sala",
    "slashCommands.userServerReason": "<@user:server> [motivo]",
    "slashCommands.banAUserFromThisRoom": "Banir um usuário desta sala",
    "slashCommands.setYourDisplayName": "Definir seu nome de exibição",
    "slashCommands.displayName": "<nome de exibição>",
    "slashCommands.setAUserSPowerLevel":
        "Definir o nível de poder de um usuário",
    "slashCommands.userServerLevel": "<@user:server> [nível]",
    "slashCommands.resetAUserSPowerLevel":
        "Redefinir o nível de poder de um usuário para o padrão",
    "slashCommands.discardSession":
        "Usar uma nova chave de sala na sua próxima mensagem, se as pessoas não conseguem ler a sua",
    "slashCommands.usage": "Uso: /{name} {argHint}",
    "slashCommands.usage2": "Uso: /{name}",

    // src/lib/utils/syncStatus.ts
    "syncStatus.connected": "Conectado",
    "syncStatus.reconnecting": "Reconectando…",
    "syncStatus.connectionError": "Erro de conexão",
    "syncStatus.offline": "Offline",
    "syncStatus.connecting": "Conectando…",

    // src/lib/utils/themePalette.ts
    "themePalette.accent": "Cor de destaque",
    "themePalette.background": "Fundo",
    "themePalette.secondaryBackground": "Fundo secundário",
    "themePalette.tertiaryBackground": "Fundo terciário",
    "themePalette.primaryText": "Texto principal",
    "themePalette.secondaryText": "Texto secundário",
    "themePalette.mutedText": "Texto esmaecido",
    "themePalette.danger": "Perigo",
    "themePalette.positive": "Positivo",
    "themePalette.mentionHighlight": "Destaque de menção",
    "themePalette.link": "Link",
    "themePalette.warning": "Aviso",
    "themePalette.onlineStatus": "Status online",
    "themePalette.idleStatus": "Status inativo",
    "themePalette.doNotDisturbStatus": "Status não incomodar",
    "themePalette.offlineStatus": "Status offline",
    "themePalette.divider": "Divisor",
    "themePalette.spoilerBackground": "Fundo de spoiler",
    "themePalette.ownMessageBubble": "Balão da própria mensagem",
    "themePalette.primaryTextOnBackground": "Texto principal sobre o fundo",
    "themePalette.secondaryTextOnBackground": "Texto secundário sobre o fundo",
    "themePalette.mutedTextOnTertiaryBackground":
        "Texto esmaecido sobre o fundo terciário",
    "themePalette.whiteTextOnAccentButtons":
        "Texto branco em botões de destaque",
    "themePalette.whiteTextOnDangerButtons": "Texto branco em botões de perigo",
    "themePalette.whiteTextOnOwnBubble": "Texto branco no balão próprio",

    // src/lib/utils/themePreset.ts
    "themePreset.copy": "{newName} (cópia)",

    // src/lib/utils/threadList.ts
    "threadList.noPreview": "(sem prévia)",

    // src/lib/utils/threePidInvite.ts
    "threePidInvite.youDonTHavePermissionTo":
        "Você não tem permissão para convidar pessoas para esta sala.",
    "threePidInvite.yourHomeserverHasNoIdentityServer":
        "Seu servidor doméstico não tem servidor de identidade, então os convites por e-mail não estão disponíveis.",

    // src/lib/utils/timeFormat.ts
    "timeFormat.yesterdayAt": "Ontem às {time}",
    "timeFormat.today": "Hoje",
    "timeFormat.yesterday": "Ontem",
    "timeFormat.separatorDatePattern": "EEEE, d 'de' MMMM 'de' yyyy",
    "timeFormat.monthDayPattern": "d 'de' MMM",
    "timeFormat.compactDateTime": "{date}, {time}",

    // src/lib/utils/updateStatus.ts
    "updateStatus.checkingForUpdates": "Verificando atualizações…",
    "updateStatus.youReOnTheLatestVersion":
        "Você está na versão mais recente{versionSuffix}",
    "updateStatus.checkForUpdates": "Verificar atualizações",
    "updateStatus.updateAvailable": "Atualização disponível{versionSuffix}",
    "updateStatus.lastInstallFailed":
        "A atualização{versionSuffix} não foi instalada da última vez",
    "updateStatus.downloadInstall": "Baixar e instalar",
    "updateStatus.downloadingV": "Baixando v{version}",
    "updateStatus.downloadingUpdate": "Baixando atualização",
    "updateStatus.updateReadyInstall":
        "Atualização pronta{versionSuffix} - Instalar",
    "updateStatus.install": "Instalar",
    "updateStatus.updateReadyRestartToApply":
        "Atualização pronta{versionSuffix} - reinicie para aplicar",
    "updateStatus.restartToApply": "Reiniciar para aplicar",
    "updateStatus.updateReadyReloadToApply":
        "Atualização pronta{versionSuffix} - recarregue para aplicar",
    "updateStatus.reloadToApply": "Recarregar para aplicar",
    "updateStatus.aNewVersionIsAvailable":
        "Uma nova versão está disponível{versionSuffix}",
    "updateStatus.openReleasePage": "Abrir página da versão",
    "updateStatus.flatpakManualUpdate":
        "Atualização disponível{versionSuffix}. Instale-a pela sua central de programas ou com flatpak update",
    "updateStatus.packageManagerUpdate":
        "Atualização disponível{versionSuffix}. Atualize com {manager}",
    "updateStatus.updateCheckFailed": "Falha ao verificar atualizações",
    "updateStatus.checkForUpdatesToInstallThe":
        "Verifique as atualizações para instalar a versão mais recente.",

    // src/lib/utils/uploadLimits.ts
    "uploadLimits.mb": "{round} MB",
    "uploadLimits.kb": "{round} KB",
    "uploadLimits.exceedsTheServerSUploadLimit":
        "“{fileName}” excede o limite de envio de {formatByteLimit} do servidor",

    // src/lib/utils/verificationMessage.ts
    "verificationMessage.verificationRequestSent":
        "Solicitação de verificação enviada",
    "verificationMessage.waitingForThemToAccept":
        "Aguardando a pessoa aceitar…",
    "verificationMessage.noLongerPending": "Não está mais pendente",
    "verificationMessage.wantsToVerify": "{senderName} quer verificar",
    "verificationMessage.compareEmojiToConfirmThisIs":
        "Compare os emojis para confirmar que é realmente a pessoa",
    "verificationMessage.sentAVerificationRequest":
        "{senderName} enviou uma solicitação de verificação",

    // src/lib/utils/verificationStatus.ts
    "verificationStatus.checkingEncryption": "Verificando criptografia…",
    "verificationStatus.encryptionUnavailable": "Criptografia indisponível",
    "verificationStatus.statusUnavailable": "Status indisponível",
    "verificationStatus.verified": "Verificado",
    "verificationStatus.thisSessionIsVerifiedAndEncryption":
        "Esta sessão está verificada e a criptografia está totalmente configurada.",
    "verificationStatus.notSetUp": "Não configurado",
    "verificationStatus.setUpEncryptionToSecureYour":
        "Configure a criptografia para proteger suas mensagens em todos os dispositivos.",
    "verificationStatus.setUp": "Configurar",
    "verificationStatus.encryptionSetupIncomplete":
        "Configuração da criptografia incompleta",
    "verificationStatus.thisSessionIsVerifiedButEncryption":
        "Esta sessão está verificada, mas a configuração da criptografia está incompleta.",
    "verificationStatus.finishSetup": "Concluir configuração",
    "verificationStatus.unverified": "Não verificado",
    "verificationStatus.thisSessionIsnTVerifiedYet":
        "Esta sessão ainda não está verificada.",

    // src/routes/+layout.svelte
    "rootLayout.linkCopied": "Link copiado",

    // src/routes/+page.svelte
    "rootPage.failedToReconnectPleaseLogIn":
        "Falha ao reconectar. Entre novamente.",
    "rootPage.sessionOpenInAnotherTab":
        "Esta sessão está aberta em outra aba. Esta aba continuará quando aquela for fechada.",
    "rootPage.signedInButSyncingCouldNot":
        "Você entrou, mas a sincronização não pôde iniciar. Tente novamente.",
    "rootPage.yourSessionHasExpiredPleaseSign":
        "Sua sessão expirou. Entre novamente.",

    // ownStatus
    "ownStatus.profileField": "campo de perfil {key}",
    "ownStatus.theServerStillHas": "O servidor ainda tem: {leftovers}",
    "messageInput.directFile": "Direto",
    "messageInput.directFileHint":
        "Enviado diretamente quando você pressiona enviar, sem upload.",
    "messageInput.sendDirectly": "Enviar diretamente",
    "messageItem.replyPreviewFileOffer": "Oferta de arquivo",
    "fileOffer.unavailable":
        "Esta oferta de arquivo não pode ser lida por esta versão do Zam.",
    "fileOffer.details": "{size}, enviado diretamente",
    "fileOffer.waiting": "Aguardando alguém aceitar. Mantenha o Zam aberto.",
    "fileOffer.fromElsewhere": "Oferecido a partir de outra das suas sessões.",
    "fileOffer.gone": "Não está mais disponível nesta sessão.",
    "fileOffer.expired": "Esta oferta expirou.",
    "fileOffer.accept": "Aceitar",
    "fileOffer.retry": "Tentar novamente",
    "fileOffer.cancel": "Cancelar",
    "fileOffer.withdraw": "Retirar",
    "fileOffer.connecting": "Conectando ao remetente...",
    "fileOffer.progress": "{done} de {total}, {rate}/s",
    "fileOffer.verifying": "Verificando o arquivo...",
    "fileOffer.savedDone": "Arquivo salvo e verificado.",
    "fileOffer.sentDone": "Entregue a {peer}.",
    "fileOffer.sendingTo": "Para {peer}",
    "fileOffer.cancelled": "Transferência cancelada.",
    "fileOffer.failedOffline":
        "O remetente não está disponível. Ele precisa estar com o Zam aberto.",
    "fileOffer.failedRefused":
        "A sessão do remetente recusou esta transferência.",
    "fileOffer.failedNoRelay":
        "Um servidor de retransmissão é exigido para conexões ponto a ponto, mas não há nenhum (TURN), então o arquivo não pode ser enviado sem mostrar um endereço IP.",
    "fileOffer.failedConnection": "A conexão foi perdida.",
    "fileOffer.failedStalled": "A transferência parou de progredir.",
    "fileOffer.failedCorrupt":
        "O arquivo foi alterado no caminho, então foi descartado.",
    "fileOffer.failedWrite":
        "Não foi possível gravar o arquivo. O disco está cheio?",
    "fileOffer.failedStorageFull":
        "Não há armazenamento suficiente para este arquivo.",
    "fileOffer.failedHash":
        "O arquivo finalizado não correspondia, então foi descartado.",
    "fileOffer.failedUnsupported":
        "Este dispositivo ainda não consegue salvar transferências diretas.",
    "ownStatus.statusClearedButPresenceRemains":
        "Status limpo, mas o servidor ainda mostra a mensagem de presença “{presenceLeft}”. Provavelmente ela foi definida por outra sessão desta conta (outro aplicativo ou cliente) - limpe-a lá, ou encerre essa sessão.",
    "qrLogin.failed": "Falha ao entrar com código QR. Tente novamente.",
    "qrLogin.cancelled": "A entrada com código QR foi cancelada.",
    "qrLogin.cancelledOther": "O outro dispositivo cancelou a entrada.",
    "qrLogin.insecure":
        "Não foi possível confiar na conexão com o outro dispositivo, então a entrada foi interrompida.",
    "qrLogin.wrongServer":
        "O outro dispositivo está conectado em {server}, que não é o servidor que você escolheu aqui.",
    "qrLogin.codeMismatch":
        "O número não coincidiu, então a entrada foi interrompida. Só continue se o número mostrado no outro dispositivo for o que você digitou.",
    "qrLogin.untrustedApproval":
        "O novo dispositivo pediu que você aprovasse em um endereço que não pertence ao provedor de login da sua conta, então foi recusado.",
    "qrLogin.enterNumber":
        "Digite o número mostrado no seu outro dispositivo. Isso confirma que somente vocês dois estão conectados.",
    "qrLogin.numberLabel": "Número",
    "qrLogin.confirm": "Continuar",
    "qrLogin.waitingApproval":
        "Aprove a entrada no seu outro dispositivo para concluir.",
    "qrLogin.notVerified":
        "Você entrou, mas esta sessão não conseguiu receber suas chaves de criptografia. Verifique-a em Configurações para ler mensagens criptografadas mais antigas.",
    "qrLogin.linkConnecting": "Conectando ao novo dispositivo...",
    "qrLogin.linkShowNumber": "Digite este número no novo dispositivo",
    "qrLogin.linkDoneVerified":
        "O novo dispositivo está conectado e verificado.",
    "qrLogin.denied": "A entrada foi recusada no outro dispositivo.",
    "qrLogin.expired": "O código QR expirou. Tente novamente.",
    "qrLogin.notALoginCode":
        "Esse não é um código de entrada de um novo dispositivo desta conta. Abra Entrar com código QR no dispositivo em que você quer entrar.",
    "qrLogin.notSupportedHere":
        "O provedor de login desta conta não oferece suporte à entrada por código QR.",
    "qrLogin.signInButton": "Entrar com código QR",
    "qrLogin.signInTitle": "Entrar com código QR",
    "qrLogin.signInSteps":
        "Em um dispositivo que já está conectado ao Zam, abra Configurações, depois Conta, depois Escanear código QR para fazer login em um novo dispositivo, e escaneie este código.",
    "qrLogin.codeAlt": "Código QR para escanear de um dispositivo conectado",
    "qrLogin.preparing": "Preparando o código...",
    "qrLogin.matchCode":
        "A página de aprovação mostrará este código. Só aprove se ele for igual.",
    "qrLogin.signingIn": "Entrando...",
    "qrLogin.cancel": "Cancelar",
    "qrLogin.linkButton":
        "Escanear código QR para fazer login em um novo dispositivo",
    "qrLogin.linkTitle": "Vincular um novo dispositivo",
    "qrLogin.linkIntro":
        "No novo dispositivo, escolha Entrar com código QR e escaneie o código que ele mostra. Você aprova a entrada na página de login da sua conta, e os dois dispositivos são então verificados um contra o outro.",
    "qrLogin.linkWarning":
        "Só continue para um dispositivo que esteja nas suas mãos agora.",
    "qrLogin.linkApprove":
        "Aprove a entrada em {host}. Confira se o código ali é igual ao do novo dispositivo e só aprove se o dispositivo for seu.",
    "qrLogin.linkApproveButton": "Aprovar em {host}",
    "qrLogin.linkWaiting": "Aguardando o novo dispositivo entrar...",
    "qrLogin.linkDone":
        "O novo dispositivo está conectado. Termine de verificá-lo na janela que acabou de abrir nos dois dispositivos.",
    "qrLogin.linkDoneUnverified":
        "O novo dispositivo está conectado. Não foi possível iniciar a verificação automaticamente; verifique-o em Configurações, depois Sessões.",
    "qrLogin.notADeviceCode":
        "Esse não é um código válido. Digite o código mostrado no novo dispositivo.",
    "qrLogin.loginSectionTitle": "Login",
    "qrLogin.loginSectionIntro":
        "Conecte outro dispositivo a partir deste, sem digitar seu nome de usuário e senha.",
    "qrLogin.codeButton": "Digitar um código do novo dispositivo",
    "qrLogin.codeTitle": "Entrar com um código",
    "qrLogin.codeIntro":
        "No novo dispositivo, escolha Entrar com código QR. Ele mostra um código curto abaixo do código QR; digite esse código aqui.",
    "qrLogin.codeLabel": "Código mostrado no novo dispositivo",
    "qrLogin.codeContinue": "Continuar",
    "qrLogin.orEnterCode":
        "Sem câmera? Em um dispositivo conectado, abra Configurações, depois Conta, depois Login, escolha Digitar um código do novo dispositivo e digite o código abaixo.",
    "qrLogin.notAShownCode":
        "Esse não é um código de um dispositivo conectado. No dispositivo conectado, abra Configurações, depois Conta, depois Login, e escolha Mostrar um código QR para o novo dispositivo escanear.",
    "qrLogin.showButton":
        "Mostrar um código QR para o novo dispositivo escanear",
    "qrLogin.showTitle": "Mostrar um código para o novo dispositivo",
    "qrLogin.showIntro":
        "No novo dispositivo, escolha Entrar com código QR, depois Escanear um código de um dispositivo conectado, e escaneie este código.",
    "qrLogin.showCodeAlt": "Código QR para escanear do novo dispositivo",
    "qrLogin.showEnterNumber": "Digite o número que o novo dispositivo mostra",
    "qrLogin.showRetry": "Mostrar um novo código",
    "qrLogin.scanInstead": "Escanear um código de um dispositivo conectado",
    "qrLogin.scanTitle": "Escanear um código de um dispositivo conectado",
    "qrLogin.scanIntro":
        "Em um dispositivo conectado, abra Configurações, depois Conta, depois Login, escolha Mostrar um código QR para o novo dispositivo escanear, e escaneie-o aqui.",
    "qrLogin.scanShowNumber":
        "Digite este número no dispositivo conectado e aprove a entrada lá.",
    "qrLogin.showInstead": "Mostrar meu próprio código",
    "qrLogin.chooseIntro":
        "Mais de uma nova sessão entrou ao mesmo tempo. Escolha a que você está configurando.",
    "qrLogin.linkClose": "Fechar",
    // src/lib/components/messages/MessageEmbed.svelte
    "messageEmbed.deleted": "Mensagem excluída",
    "messageEmbed.inRoom": "em {room}",
    "messageEmbed.jumpToMessage": "Ir para a mensagem vinculada:",
    "messageActionsMenu.copyText": "Copiar texto da mensagem",
    "messageActionsMenu.textCopied": "Texto da mensagem copiado",
    "messageActionsMenu.couldnTCopyText":
        "Não foi possível copiar o texto da mensagem",
    "messageActionsMenu.selectHint":
        "Pressione e segure o texto para selecionar parte dele",
    "roomSettings.readReceipts": "Confirmações de leitura",
    "roomSettings.readReceiptsRoomHelp":
        "Escolha se outros membros podem ver quais mensagens você leu nesta sala.",
    "roomSettings.readReceiptsSpaceHelp":
        "Escolha se outros membros podem ver quais mensagens você leu neste espaço e nas suas salas. A escolha própria de uma sala tem prioridade.",
    "roomSettings.readReceiptsDefaultShare":
        "Segue suas configurações de privacidade, atualmente compartilhadas com outros",
    "roomSettings.readReceiptsDefaultHide":
        "Segue suas configurações de privacidade, atualmente ocultas de outros",
    "roomSettings.readReceiptsShare":
        "Compartilhar minhas confirmações de leitura",
    "roomSettings.readReceiptsShareDesc":
        "Outros podem ver quais mensagens você leu.",
    "roomSettings.readReceiptsHide": "Ocultar minhas confirmações de leitura",
    "roomSettings.readReceiptsHideDesc":
        "Seu status de não lidas continua sincronizando, mas outros não conseguem ver o que você leu.",
    "privacySafetySettings.receiptsOverrideHint":
        "Salas e espaços podem substituir isso nas suas configurações de notificações.",
    "richPresence.steam": "Presença detalhada do Steam",
    "richPresence.steamHint":
        "Mostra o jogo do Steam que você está jogando junto com o status de presença detalhada, como o mapa ou o modo. Isto ativa a porta de depuração local do Steam, que só escuta neste computador. O Steam precisa ser reiniciado uma vez para que tenha efeito.",
    "richPresence.steamConnected": "Conectado ao Steam.",
    "richPresence.steamNeedsRestart":
        "A porta de depuração do Steam ainda não está aberta. Reinicie o Steam para abri-la.",
    "richPresence.steamNotRunning":
        "O Steam não está em execução. Inicie-o e o Zam se conectará automaticamente.",
    "richPresence.restartSteam": "Reiniciar o Steam",
    "richPresence.restartSteamTitle": "Reiniciar o Steam?",
    "richPresence.restartSteamBody":
        "O Steam vai fechar e abrir novamente. Jogos iniciados pelo Steam podem ser fechados junto com ele.",
    "richPresence.restartSteamFailed":
        "Não foi possível reiniciar o Steam: {error}",
    "richPresence.steamEnableFailed":
        "Não foi possível ativar a porta de depuração do Steam: {error}",
    "richPresence.steamDisableFailed":
        "Não foi possível desativar a porta de depuração do Steam: {error}",
    "richPresence.steamUacCancelled":
        "O Windows pediu permissão de administrador e ela não foi concedida, então nada foi alterado.",
    "richPresence.steamFailed": "A presença detalhada do Steam falhou: {error}",
    "richPresence.viaSteam": "Steam",
    "meshConsent.titleJoining":
        "Esta chamada conecta você diretamente com outras pessoas",
    "meshConsent.titleNewcomer":
        "Alguém nesta chamada só pode ser alcançado diretamente",
    "meshConsent.noCallServer":
        "Seu servidor doméstico não tem servidor de chamadas, então seu áudio, vídeo e compartilhamento de tela vão diretamente do seu dispositivo para cada pessoa na chamada.",
    "meshConsent.someoneWithoutCallServer":
        "Alguém nesta chamada está em um servidor doméstico sem servidor de chamadas. Para ouvir e ver essa pessoa, seu dispositivo se conecta diretamente ao dela.",
    "meshConsent.ipVisible":
        "Seu servidor doméstico não tem servidor de retransmissão (TURN), então todos com quem você se conectar diretamente podem ver seu endereço IP, que pode revelar aproximadamente onde você está.",
    "meshConsent.relayed":
        "A conexão passa pelo servidor de retransmissão do seu servidor doméstico: os outros veem o endereço dele, não seu endereço IP. Se a retransmissão não alcançar alguém, você se conecta diretamente a essa pessoa, que vê seu endereço IP. Para evitar isso, ative “Exigir servidor de retransmissão para chamadas ponto a ponto” nas configurações de Voz e vídeo.",
    "meshConsent.relayRequired":
        "“Exigir servidor de retransmissão para chamadas ponto a ponto” está ativado, mas seu servidor doméstico não tem servidor de retransmissão (TURN), então não é possível conectar. Desative isso nas configurações de Voz e vídeo para conectar diretamente.",
    "meshConsent.titleFileTransfer":
        "Esta transferência de arquivo conecta você diretamente à outra pessoa",
    "meshConsent.fileTransferDirect":
        "Seu homeserver ou o dela não tem servidor de chamadas, então o arquivo vai direto de um dispositivo para o outro.",
    "meshConsent.join": "Entrar",
    "meshConsent.connectDirectly": "Conectar diretamente",
    "meshConsent.joinWithoutThem": "Entrar sem eles",
    "meshConsent.notNow": "Agora não",
    "voiceCall.meshNeedsTurn":
        "“Exigir servidor de retransmissão para chamadas ponto a ponto” está ativado, mas seu servidor doméstico não tem servidor de retransmissão (TURN). Desative isso nas configurações de Voz e vídeo para entrar.",
    "voiceAudioSettings.meshRelayOnly":
        "Exigir servidor de retransmissão para chamadas ponto a ponto",
    "voiceAudioSettings.meshRelayOnlyHint":
        "Chamadas ponto a ponto e transferências de arquivos passam pelo servidor de retransmissão (TURN) do seu servidor doméstico quando ele tem um, então ninguém vê seu endereço IP. Sem ele, ou quando a retransmissão não alcança alguém, conectam-se diretamente, o que o mostra. Com isso ativado, nunca se conectam diretamente: sem uma retransmissão funcionando, não se conectam.",
    "voiceCall.meshPeerUnreachable":
        "Alguém nesta chamada só pode ser alcançado diretamente, mas um servidor de retransmissão é exigido e seu servidor doméstico não tem um (TURN), então você não vai ouvi-lo.",
    "meshConsent.usePublicStun": "Usar um servidor STUN público.",
    "meshConsent.usePublicStunHint":
        "Seu servidor doméstico não tem um servidor que ajude as conexões a atravessar roteadores domésticos, então a maioria das conexões diretas falha sem um. O servidor STUN da Cloudflare saberia seu endereço IP, mas nada sobre a chamada.",
    "voiceAudioSettings.meshPublicStun": "Usar um servidor STUN público",
    "voiceAudioSettings.meshPublicStunHint":
        "Somente quando seu servidor doméstico não oferece servidor de retransmissão nem STUN: as chamadas ponto a ponto pedem ao servidor STUN da Cloudflare seu endereço público, de que a maioria dos roteadores domésticos precisa. Ele vê seu endereço IP, nunca a chamada.",
    "settingsSearch.meshPublicStun": "Usar um servidor STUN público",
    "voiceCall.meshFailed":
        "Não foi possível conectar diretamente a {name}. A rede da pessoa pode estar bloqueando, ou o servidor doméstico da pessoa não oferece nenhuma forma de atravessar roteadores domésticos.",
    "voiceCall.meshFailedNoServers":
        "Não foi possível conectar diretamente a {name}. Seu servidor doméstico não oferece servidor de retransmissão nem STUN, então conexões por roteadores domésticos geralmente falham. Ativar “Usar um servidor STUN público” nas configurações de Voz e vídeo pode ajudar.",
    "settingsSearch.meshRelayOnly":
        "Exigir servidor de retransmissão para chamadas ponto a ponto",
};

const catalogue: LocaleCatalogue = { messages, dateLocale: ptBR };

export default catalogue;
