import { t } from "$lib/i18n";
import {
    createClient,
    ClientEvent,
    RoomEvent,
    RoomMemberEvent,
    PendingEventOrdering,
    EventStatus,
    EventTimeline,
    MatrixEvent,
    NotificationCountType,
    PushRuleKind,
    PushRuleActionName,
    RuleId,
    IndexedDBStore,
    HttpApiEvent,
    UserEvent,
    SetPresence,
    Direction,
    EventType,
    RoomStateEvent,
    ThreadEvent,
    MatrixEventEvent,
    Method,
    BeaconEvent,
    SlidingSyncEvent,
    M_BEACON,
    M_BEACON_INFO,
    ContentHelpers,
    TimelineWindow,
    EventTimelineSet,
    SSOAction,
    OAuth2,
} from "matrix-js-sdk";
import type {
    AuthDict,
    ValidatedAuthMetadata,
    ISearchResults,
    MatrixClient,
    MatrixError,
    Room,
    RoomMember,
    User,
    ReceiptType,
    Beacon,
} from "matrix-js-sdk";
import { VerificationMethod } from "matrix-js-sdk/lib/types";
import {
    SlidingSync,
    SlidingSyncState,
    MSC3575_STATE_KEY_ME,
    MSC3575_STATE_KEY_LAZY,
    type MSC3575List,
    type MSC3575RoomData,
} from "matrix-js-sdk/lib/sliding-sync";
import {
    isSlidingSyncUnsupportedError,
    isSlidingTimelineGap,
    nextWindowEnd,
    shouldKickSync,
    watchdogOverdueMs,
} from "$lib/utils/slidingSyncHelpers";
import { describeSyncError, logSync } from "$lib/matrix/syncLog";
import { keepSlidingSyncAlive } from "$lib/matrix/slidingSyncKeepAlive";
import { adaptSlidingSyncTimeout } from "$lib/matrix/slidingSyncTimeout";
import {
    isSlidingSyncEnabled,
    setSlidingSyncEnabled,
} from "$lib/matrix/slidingSyncPref";
import { discoverOAuthMetadata, type PendingOAuth } from "$lib/matrix/oauth";
import type { OAuthSessionInfo, StoredAccount } from "$lib/utils/accounts";
import {
    buildAccountManagementUrl,
    type AccountManagementAction,
} from "$lib/utils/oauthAccount";
import type * as LivekitClient from "livekit-client";
type LivekitModule = typeof import("livekit-client");
type LivekitRoom = LivekitClient.Room;
type RemoteTrack = LivekitClient.RemoteTrack;
type RemoteTrackPublication = LivekitClient.RemoteTrackPublication;
type RemoteParticipant = LivekitClient.RemoteParticipant;
type LocalParticipant = LivekitClient.LocalParticipant;
type TrackPublication = LivekitClient.TrackPublication;
import {
    callEndedMembershipMessage,
    pickLivekitTransport,
    pickOwnLivekitTransport,
    remoteLivekitTargets,
    livekitTargetKey,
    type LivekitTarget,
    sfuJwtUrl,
    screenShareCaptureResolution,
} from "$lib/utils/voiceCall";
import {
    screenShareEncodingFor,
    applyScreenShareEncoding,
} from "$lib/utils/screenShareEncoding";
import {
    buildVideoTiles,
    type VideoPublicationInput,
    type VideoTileDescriptor,
    type VideoSource,
} from "$lib/utils/videoTiles";
import {
    voiceDeviceNotices,
    type VoiceInputKind,
} from "$lib/utils/voiceDeviceWatch";
import {
    effectiveVolume,
    withVolume,
    withLocalMute,
    withVideoHidden,
    DEFAULT_PARTICIPANT_AUDIO,
    type ParticipantAudio,
} from "$lib/utils/participantAudio";
import {
    keywordActions,
    keywordRulesFromContent,
    type KeywordBehavior,
    type KeywordRuleView,
} from "$lib/utils/keywordRules";
import type { PresenceState } from "$lib/utils/presence";
import {
    settingsState,
    setAudioInputDeviceId,
    setVideoInputDeviceId,
} from "$lib/stores/settings.svelte";
import {
    installMediaHealer,
    markSwMediaReady,
    swMediaAuth,
} from "$lib/stores/mediaAuth.svelte";
import {
    OWNERSHIP_LOST_MESSAGE,
    captureOwnership,
    guardOwnership,
    ownsRuntime,
    type ClientOwnership,
} from "$lib/utils/clientGeneration";
import {
    captureClient,
    clientGeneration,
    getClient,
    installClient,
    matrixClient,
    matrixStore,
    ownedClient,
    readOwner,
    releaseClient,
    retireClientGeneration,
    setMatrixStore,
} from "./runtime";
import {
    sanitizeCustomization,
    type ClientCustomization,
} from "$lib/utils/customization";
import { parseMarkdown } from "$lib/utils/markdown";
import { preloadEmojiPacks } from "$lib/utils/emojiPreload";
import {
    applyPackMeta,
    hasEmoteRoom,
    parseEmoteRooms,
    uniqueShortcode,
    withEmoteRoom,
    type EmoteRoomRef,
    type EmoteRoomsContent,
    type PackMetaUpdate,
} from "$lib/utils/emotePacks";
import { isMxcPreviewMedia } from "$lib/utils/linkPreviewPolicy";
import { serializeServerAcl, type ServerAcl } from "$lib/utils/serverAcl";
import { requestPersistentStorage } from "$lib/utils/persistentStorage";
import { parseLoginFlows, type LoginOptions } from "$lib/utils/loginFlows";
import { resolveDisplayName } from "$lib/utils/displayName";
import { nestedSpaceIds, topLevelSpaceOf } from "$lib/utils/spaceTree";
import {
    buildSnapshot,
    deleteSnapshot,
    loadSnapshot,
    materializeSnapshot,
    saveSnapshot,
    snapshotKey,
    type MaterializedCache,
} from "./roomListCache";
import { showErrorToast } from "$lib/stores/toasts.svelte";
import {
    markSyncStoreFallback,
    resetSyncStoreFallback,
} from "$lib/stores/sessionHealth.svelte";
import { classifyWellKnown } from "$lib/utils/wellKnown";
import { hasUnstableFeature } from "$lib/utils/serverCapabilities";
import {
    supportsPasswordUia,
    type DeviceInfo,
} from "$lib/utils/deviceSessions";
import { receiptTypeForSetting } from "$lib/utils/readReceipts";
import { computeEditMentions, type Mentions } from "$lib/utils/editMentions";
import { buildReplyContent } from "$lib/utils/replyContent";
import {
    classifyPendingEcho,
    dedupeById,
    isLocalEchoId,
} from "$lib/utils/pendingEchoes";
import { firstReusableDmRoom } from "$lib/utils/dmReuse";
import { pickDmRoomVersion } from "$lib/utils/dmRoomVersion";
import { planReconcileReload } from "$lib/utils/reconcileReload";
import { pickFavouriteGifs } from "$lib/utils/favouriteGifs";
import {
    countReactions,
    type ReactionAnnotation,
} from "$lib/utils/reactionCounts";
import {
    buildThreadReplyContent,
    isThreadReplyContent,
    withThreadRelation,
    threadRootForQuickReply,
} from "$lib/utils/threadContent";
import {
    belongsToMainTimeline,
    summarizeThread,
    threadReplyRootId,
} from "$lib/utils/threadModel";
import {
    isCallEventType,
    isCallMemberEventType,
    isMembershipLeave,
    summariseCallEvents,
    memberDeviceId,
    type CallEventInput,
    type CallSummary,
} from "$lib/utils/callSummary";
import type { ThreadSummary } from "$lib/utils/threadModel";
import type { ThreadInfo } from "$lib/utils/threadList";
import {
    tagUpdatesForToggle,
    tagOrderRollback,
    TAG_FAVOURITE,
    TAG_LOWPRIORITY,
    type RoomTagMap,
} from "$lib/utils/roomOrdering";
import {
    compareOrder,
    compareOrderLex,
    keyBetween,
    numberBetween,
    rebalancedKeys,
    rebalancedNumbers,
    OrderRebalanceError,
    resolveTagOrderInput,
    type TagOrderInput,
    isValidChildOrder,
} from "$lib/utils/orderKey";
import { lazyModule } from "$lib/utils/lazyModule";
import {
    sortSpaceChildIds,
    type SpaceChildDescriptor,
    isSuggestedChild,
} from "$lib/utils/spaceChildren";
import {
    classifyRooms,
    type RoomClassification,
} from "$lib/utils/roomClassification";
import { mapUserSearchResults } from "$lib/utils/userSearch";
import { mapPublicRooms, type DirectoryRoom } from "$lib/utils/roomDirectory";
import {
    buildKnockOpts,
    matrixErrorMessage,
    knockReasonFromContent,
} from "$lib/utils/knock";
import { viaFallbackCandidates } from "$lib/utils/joinFallback";
import { matrixToUrl } from "../utils/matrixLinks";
import { extractSubspaceChildren } from "$lib/utils/spaceHierarchy";
import { collectSpaceDescendantRoomIds } from "$lib/utils/spaceDescendants";
import { mapWithConcurrency } from "$lib/utils/async";
import { createBoundedIdMap } from "$lib/utils/notifyDecrypted";
import {
    needsStateSeed,
    shouldPrimePaginationToken,
} from "$lib/utils/roomStateHealth";
import {
    isPollStartEventType,
    isPollResponseEventType,
    isPollEndEventType,
    parsePollStart,
    extractResponseAnswers,
    aggregatePollVotes,
    canEndPoll,
    pickPollEndTs,
    POLL_RESPONSE_TYPES,
    POLL_END_TYPES,
    type PollStartData,
    buildPollResponse,
    buildPollStart,
    buildPollEnd,
    affectsPollView,
} from "$lib/utils/pollContent";
import { buildForwardContent } from "$lib/utils/forwardContent";
import { shouldRingPeers } from "$lib/utils/callNotify";
import { buildCallNotifyPushRules } from "$lib/utils/callPushRule";
import { buildLocationContent } from "$lib/utils/location";
import { shouldWriteStopBeacon } from "$lib/utils/liveLocation";
import { isSyncRecovery } from "$lib/utils/liveShareStop";
import {
    getRoomNotificationSettingForClient,
    isHighlightAction,
    refreshCachedPushRules,
    setDefaultPushRuleLevelForClient,
    setRoomNotificationSettingForClient,
    type RoomNotificationSetting,
} from "$lib/matrix/pushRules";
import {
    classifyPushRuleWriteError,
    pushRuleFailureMessage,
} from "$lib/utils/pushRuleWrite";
import { createSerialQueue } from "$lib/utils/serialQueue";
import { pushRulesState } from "$lib/stores/pushRules.svelte";
import {
    fetchServerNotificationsForClient,
    type ServerNotificationResult,
} from "$lib/matrix/notifications";
import {
    initCrypto,
    getCryptoCallbacks,
    ensureRoomCryptoConfigured,
} from "$lib/matrix/crypto";
import { mxcToHttp, resetMediaUploadSizeLimit, sendFile } from "./media";
import { getCryptoDbName } from "$lib/utils/cryptoStore";
import { waitForRoomArrival } from "$lib/utils/roomArrival";
import { createInFlightByKey } from "$lib/utils/inFlightByKey";
import { dmDedupeKey, createDmEncryptIntent } from "$lib/utils/dmDedupe";
import {
    forgetPendingWipe,
    rememberPendingWipe,
} from "$lib/utils/pendingCryptoWipe";
import { runLogoutSequence } from "$lib/utils/logoutSequence";
import {
    ROOM_ENCRYPTION_EVENT_TYPE,
    ENCRYPTION_ALGORITHM,
    encryptionInitialState,
} from "$lib/utils/roomEncryption";
import { createHealedRoomRegistry } from "$lib/utils/roomStateTrust";
import {
    CALL_MEMBER_EVENT_TYPES,
    coercePl,
    effectivePowerLevel,
    normalizePowerLevels,
    roomVersionHasImmutableCreators,
    validatePowerLevelsContent,
} from "$lib/utils/powerLevels";
import { buildRestrictedJoinRuleContent } from "$lib/utils/joinRules";
import type { CanonicalAliasContent } from "$lib/utils/roomAliases";
import { addToMDirect } from "$lib/utils/mDirect";
import { planShareSend } from "$lib/utils/shareSend";
import { findFailedRedactionEcho } from "$lib/utils/redactionEcho";
import {
    createPendingFollowUps,
    isRoomGone,
    runFollowUp,
    runFollowUpBounded,
    strandedDmRoom,
    NO_FOLLOW_UP,
    type RoomCreationResult,
    type RoomFollowUp,
    type RoomFollowUpTask,
} from "$lib/utils/roomCreationOutcome";
import {
    ACTIVE_SESSION_KEY,
    buildHeartbeat,
    parseActiveSession,
    type ActiveSessionHeartbeat,
} from "$lib/utils/activeSession";
import {
    isVideoRoomType,
    videoRoomCreationContent,
} from "$lib/utils/videoRoom";

export type { ActiveSessionHeartbeat };
export type {
    RoomCreationResult,
    RoomFollowUp,
    RoomFollowUpTask,
} from "$lib/utils/roomCreationOutcome";
export type { RoomNotificationSetting } from "$lib/matrix/pushRules";
export type {
    ServerNotification,
    ServerNotificationResult,
} from "$lib/matrix/notifications";

// The SDK (>=v35) strongly-types account-data methods against the
// `AccountDataEvents` interface. Declare the custom, app-specific account-data
// event types we read/write so `getAccountData`/`setAccountData` accept them.
declare module "matrix-js-sdk" {
    interface AccountDataEvents {
        "moe.crafty.matrix.favourite_gifs": { gifs: FavouriteGif[] };
        "m.favourite_gifs": { gifs: FavouriteGif[] };
        "moe.crafty.matrix.customization": ClientCustomization;
        "im.client.space_layout": SpaceLayout;
        "im.client.space_order": { order?: string[] };
        "im.ponies.user_emotes": RoomEmoteContent;
        "im.ponies.emote_rooms": EmoteRoomsContent;
        "moe.crafty.matrix.active_session": ActiveSessionHeartbeat;
        "moe.crafty.matrix.plugins": PluginSyncAccountData;
    }
}

export { getClient };

// SDK enums components compare against, so they never import matrix-js-sdk values
export { EventStatus, EventType };

// Media upload, send, and fetch wrappers (re-exported from media.ts for callers)
export {
    getMediaUploadSizeLimit,
    uploadAttachment,
    sendFile,
    sendVoiceMessage,
    mxcToHttp,
    fetchAttachmentBlob,
    fetchDecryptedAttachmentBlob,
    getContentType,
    fetchRoomMediaPage,
    uploadContent,
} from "./media";
export type { MediaCaption, RoomMediaPage } from "./media";

function getIndexedDBFactory(): IDBFactory | null {
    try {
        return globalThis.indexedDB ?? null;
    } catch {
        return null;
    }
}

function getLocalStorage(): Storage | undefined {
    try {
        return globalThis.localStorage;
    } catch {
        return undefined;
    }
}

function getSyncDbName(userId: string, deviceId: string): string {
    // Sliding sync feeds the store differently from /sync v2, so the two never
    // share a cache: flipping the toggle must not replay one's data as the other's.
    const suffix = isSlidingSyncEnabled(userId) ? "sliding-sync" : "sync";
    return `matrix-client:${encodeURIComponent(userId)}:${encodeURIComponent(deviceId)}:${suffix}`;
}

/** A refreshed OAuth token pair, handed to whoever persists the session. */
export interface RefreshedTokens {
    userId: string;
    accessToken: string;
    refreshToken?: string;
    /** Epoch ms the new access token stops working, when the provider said. */
    expiresAt?: number;
}

let tokenRefreshListener: ((tokens: RefreshedTokens) => void) | null = null;

/**
 * Register the one place refreshed tokens are persisted. The refresh token
 * rotates, so every refresh MUST reach storage or the next restart is signed
 * out. Set once at boot, before any client exists.
 */
export function setTokenRefreshListener(
    listener: ((tokens: RefreshedTokens) => void) | null,
): void {
    tokenRefreshListener = listener;
}

// The freshest token pair per account, kept apart from the registry so a
// refresh that lands before a new login has been saved (sync is still
// starting) is not lost: the caller reads it back when it does save.
const latestTokens = new Map<
    string,
    { accessToken: string; refreshToken?: string; expiresAt?: number }
>();

/** The most recent tokens known for `userId` this page session, if refreshed or issued. */
export function getLatestTokens(
    userId: string,
): { accessToken: string; refreshToken?: string; expiresAt?: number } | null {
    return latestTokens.get(userId) ?? null;
}

function handleTokenRefresh(
    userId: string,
    tokens: { accessToken: string; refreshToken?: string; expiry?: Date },
): void {
    const refreshToken =
        tokens.refreshToken ?? latestTokens.get(userId)?.refreshToken;
    const next = {
        accessToken: tokens.accessToken,
        refreshToken,
        expiresAt: tokens.expiry?.getTime(),
    };
    latestTokens.set(userId, next);
    try {
        tokenRefreshListener?.({ userId, ...next });
    } catch (err) {
        console.warn("[oauth] persisting refreshed tokens failed", err);
    }
}

async function createAuthenticatedClient(opts: {
    baseUrl: string;
    accessToken: string;
    userId: string;
    deviceId: string;
    refreshToken?: string;
    oauth?: OAuthSessionInfo;
    accessTokenExpiresAt?: number;
}): Promise<MatrixClient> {
    matrixClient?.stopClient();
    // The slot below only changes several awaits later, and stopClient() does
    // NOT abort the predecessor's in-flight requests — so retire its ownership
    // NOW. Otherwise a 401 arriving from the account we just stopped still
    // passes its listeners' guard and runs root session-expiry teardown
    // against the account that is signing in.
    retireClientGeneration();
    // Do NOT destroy the previous store here: with multiple signed-in
    // accounts the outgoing client usually belongs to an account that stays
    // signed in, and deleting its per-account sync cache (or racing that
    // async deletion against the add-account reload) corrupts or cold-boots
    // its next session. The deliberate privacy wipe on sign-out lives in
    // logout() via clearStores().
    setMatrixStore(null);
    // Same reasoning as the media limit below: the outgoing client's memoized
    // space-child lists must not be carried into the incoming account's session.
    spaceChildCache.clear();
    resetRoomListCache();
    // Drop the previous server's cached media-config upload limit — this funnel
    // runs on every login, session restore, and account switch, so a switch to
    // a different homeserver must not keep the old server's `m.upload.size`.
    resetMediaUploadSizeLimit();
    // NOT dead code. Room-creation follow-ups are remembered per session, and
    // one sign-out path does NOT reload the page: session expiry
    // (`handleSessionExpired` in routes/+page.svelte) swaps to the login view
    // IN PLACE, so the next sign-in runs in this same JS realm. Account A's
    // stranded DM record would then still be here — and `findDm` keys on the
    // partner id alone — so account B opening a DM with the same partner would
    // be handed A's room id, have it written into B's `m.direct`, and be
    // dropped into a room B cannot open, for the rest of the page session.
    pendingFollowUps.reset();

    const indexedDB = getIndexedDBFactory();
    const store = indexedDB
        ? new IndexedDBStore({
              indexedDB,
              localStorage: getLocalStorage(),
              dbName: getSyncDbName(opts.userId, opts.deviceId),
          })
        : null;

    // Offer SAS (emoji) AND QR verification. Set at createClient time so the
    // crypto layer advertises them from the first key upload (Layer 1).
    // Reciprocate is what the *scanning* side sends after a successful scan, so
    // it must be advertised by any client that can show a code.
    // cryptoCallbacks back secret storage (4S) so cross-signing/backup secrets
    // resolve without re-prompting during setup and when secrets arrive (Layer 2).
    const { oauth, accessTokenExpiresAt, ...clientOpts } = opts;
    if (oauth) {
        latestTokens.set(opts.userId, {
            accessToken: opts.accessToken,
            refreshToken: opts.refreshToken,
            expiresAt: accessTokenExpiresAt,
        });
    } else {
        latestTokens.delete(opts.userId);
        delete clientOpts.refreshToken;
    }
    const commonOpts = {
        ...clientOpts,
        // The SDK refreshes on M_UNKNOWN_TOKEN (and shortly before a known
        // expiry) and revokes at the provider on logout, given the client id.
        ...(oauth
            ? {
                  oauthClientId: oauth.clientId,
                  onTokenRefresh: (tokens: {
                      accessToken: string;
                      refreshToken?: string;
                      expiry?: Date;
                  }) => handleTokenRefresh(opts.userId, tokens),
              }
            : {}),
        timelineSupport: true,
        verificationMethods: [
            VerificationMethod.Sas,
            VerificationMethod.ShowQrCode,
            VerificationMethod.ScanQrCode,
            VerificationMethod.Reciprocate,
        ],
        cryptoCallbacks: getCryptoCallbacks(),
    };

    let client = createClient({
        ...commonOpts,
        store: store ?? undefined,
    });

    if (store) {
        resetSyncStoreFallback();
        try {
            await store.startup();
            setMatrixStore(store);
        } catch (err) {
            console.warn(
                "[matrix] IndexedDB store startup failed; falling back to memory store",
                err,
            );
            markSyncStoreFallback();
            client = createClient(commonOpts);
        }
    }

    installClient(client);

    // Initialise E2EE before the caller starts sync, so crypto is ready when
    // to-device / m.room.encrypted events arrive. Never throws — a crypto-init
    // failure degrades gracefully (unencrypted rooms keep working; encrypted
    // rooms render UTD placeholders).
    await initCrypto(client, opts.userId, opts.deviceId);

    // Ask the browser not to evict our IndexedDB (crypto + sync stores).
    // Fire-and-forget: never block boot, never throw. Idempotent — a no-op
    // once the origin is already persisted, so re-running on every login /
    // session restore / account switch is cheap and safe.
    void requestPersistentStorage();

    return client;
}

/**
 * `quiet` skips the "auto-discovery failed" toast: the login form looks the
 * server up while the user is still typing, where a failed guess is expected.
 */
async function resolveHomeserver(
    input: string,
    { quiet = false }: { quiet?: boolean } = {},
): Promise<string> {
    const normalized = input.trim().replace(/\/$/, "");
    const withProtocol = normalized.startsWith("http")
        ? normalized
        : `https://${normalized}`;

    // Fetch the well-known descriptor. A request that never lands leaves
    // status === null; invalid JSON on a 2xx leaves data === undefined —
    // classifyWellKnown treats both as FAIL_PROMPT.
    let status: number | null = null;
    let data: unknown = undefined;
    try {
        const res = await fetch(`${withProtocol}/.well-known/matrix/client`);
        status = res.status;
        if (res.ok) {
            try {
                data = await res.json();
            } catch {
                data = undefined;
            }
        }
    } catch {
        status = null;
    }

    const outcome = classifyWellKnown(status, data);
    if (outcome.action === "ignore") {
        // 404 → no delegation; use the typed address silently.
        return withProtocol;
    }
    if (outcome.action === "prompt") {
        // Auto-discovery failed but the typed address may still work — use it,
        // and inform the user (spec FAIL_PROMPT).
        if (!quiet)
            showErrorToast(t("client.serverAutoDiscoveryFailedUsingThe"));
        return withProtocol;
    }

    // A base_url was discovered — validate it against /versions before we
    // trust the redirect target, so we never log in against an unvalidated
    // homeserver. Plain fetch with a 3s timeout.
    const base = outcome.baseUrl;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    let versionsOk = false;
    try {
        const versionsRes = await fetch(`${base}/_matrix/client/versions`, {
            signal: controller.signal,
        });
        versionsOk = versionsRes.ok;
    } catch {
        versionsOk = false;
    } finally {
        clearTimeout(timer);
    }
    if (!versionsOk) {
        throw new Error(t("client.discoveredHomeserverFailedValidation"));
    }
    return base;
}

type LoginResult = {
    userId: string;
    accessToken: string;
    deviceId: string;
    homeserverUrl: string;
    /** Native OAuth sessions only. */
    refreshToken?: string;
    oauth?: OAuthSessionInfo;
    accessTokenExpiresAt?: number;
};

type OAuthTokens = {
    refreshToken?: string;
    oauth: OAuthSessionInfo;
    accessTokenExpiresAt?: number;
};

/**
 * Shared tail of every sign-in path: record the sliding-sync choice, build the
 * authenticated client from the /login (or /register) response and hand the
 * session back to the caller.
 */
async function finishLogin(
    tempClient: MatrixClient,
    response: { user_id: string; access_token?: string; device_id?: string },
    slidingSync: boolean,
    oauthTokens?: OAuthTokens,
): Promise<LoginResult> {
    const resolvedURL = tempClient.getHomeserverUrl();
    tempClient.stopClient();

    // Must be recorded before the client is built: the store name depends on it.
    setSlidingSyncEnabled(response.user_id, slidingSync);
    await createAuthenticatedClient({
        baseUrl: resolvedURL,
        accessToken: response.access_token!,
        userId: response.user_id,
        deviceId: response.device_id!,
        ...oauthTokens,
    });

    return {
        userId: response.user_id,
        accessToken: response.access_token!,
        deviceId: response.device_id!,
        homeserverUrl: resolvedURL,
        ...oauthTokens,
    };
}

export async function login(
    homeserverUrl: string,
    username: string,
    password: string,
    slidingSync = false,
): Promise<LoginResult> {
    const resolvedBase = await resolveHomeserver(homeserverUrl);
    const tempClient = createClient({ baseUrl: resolvedBase });

    const response = await tempClient.login("m.login.password", {
        identifier: { type: "m.id.user", user: username },
        password: password,
        initial_device_display_name: "Zam",
    });

    return finishLogin(tempClient, response, slidingSync);
}

/**
 * Resolve a typed homeserver address (well-known included) and read how it
 * lets users sign in: native OAuth metadata when it publishes it, and the
 * legacy /login flows. `baseUrl` is the resolved address, which every flow
 * must reuse so a token is redeemed where it was issued. `options` is null
 * when only the OAuth metadata could be read; it throws when neither could.
 */
export async function getLoginOptions(homeserverUrl: string): Promise<{
    baseUrl: string;
    options: LoginOptions | null;
    oauth: ValidatedAuthMetadata | null;
}> {
    const baseUrl = await resolveHomeserver(homeserverUrl, { quiet: true });
    const tempClient = createClient({ baseUrl });
    try {
        const [flows, oauth] = await Promise.all([
            tempClient.loginFlows().catch(() => null),
            discoverOAuthMetadata(baseUrl),
        ]);
        if (!flows && !oauth)
            throw new Error(t("client.discoveredHomeserverFailedValidation"));
        return {
            baseUrl,
            options: flows ? parseLoginFlows(flows.flows) : null,
            oauth,
        };
    } finally {
        tempClient.stopClient();
    }
}

/**
 * Finish a native OAuth sign-in: exchange the authorization code (PKCE) for
 * tokens, learn who they belong to, and start the session with refresh and
 * revoke wired up. The provider is re-discovered and must still be the one
 * the attempt started with.
 */
export async function loginWithOAuthCode(
    pending: PendingOAuth,
    code: string,
): Promise<LoginResult> {
    const metadata = await discoverOAuthMetadata(pending.baseUrl);
    if (!metadata || metadata.issuer !== pending.issuer) {
        throw new Error(t("client.oauthProviderChanged"));
    }
    const oauth2 = new OAuth2(metadata, {
        clientId: pending.clientId,
        deviceId: pending.deviceId,
        codeVerifier: pending.codeVerifier,
    });
    const requestStart = Date.now();
    const tokens = await oauth2.completeAuthorizationCodeGrant(
        code,
        pending.redirectUri,
    );
    const tempClient = createClient({
        baseUrl: pending.baseUrl,
        accessToken: tokens.access_token,
    });
    const who = await tempClient.whoami();
    return finishLogin(
        tempClient,
        {
            user_id: who.user_id,
            access_token: tokens.access_token,
            // The device id was requested in the scope; trust the server's
            // answer if it differs.
            device_id: who.device_id ?? pending.deviceId,
        },
        pending.slidingSync,
        {
            refreshToken: tokens.refresh_token,
            oauth: { clientId: pending.clientId, issuer: metadata.issuer },
            accessTokenExpiresAt: tokens.expires_in
                ? requestStart + tokens.expires_in * 1000
                : undefined,
        },
    );
}

/**
 * The provider's account management page for the signed-in OAuth session
 * (password, sessions, deactivation), optionally deep-linked to an action.
 * Null when the session is not OAuth, or the provider publishes none.
 */
export async function getAccountManagementUrl(
    action?: AccountManagementAction,
    deviceId?: string,
): Promise<string | null> {
    const client = matrixClient;
    if (!client) return null;
    try {
        const meta = await client.getAuthMetadata();
        return buildAccountManagementUrl(meta.account_management_uri, {
            action,
            deviceId,
            supportedActions: meta.account_management_actions_supported,
        });
    } catch {
        return null;
    }
}

/**
 * Best-effort server-side sign-out of a stored account that has no live client
 * (the switcher's "sign out" on a dormant account). OAuth sessions are revoked
 * at the provider (refresh token first: it still works when the access token
 * has lapsed); the rest use POST /logout. Never throws: the account leaves this
 * device either way.
 */
export async function signOutStoredAccount(
    account: StoredAccount,
): Promise<void> {
    try {
        if (account.oauth) {
            const metadata = await discoverOAuthMetadata(account.homeserverUrl);
            if (!metadata) return;
            const oauth2 = new OAuth2(metadata, {
                clientId: account.oauth.clientId,
                deviceId: account.deviceId,
            });
            await Promise.allSettled([
                account.refreshToken
                    ? oauth2.revokeToken(account.refreshToken, "refresh_token")
                    : undefined,
                oauth2.revokeToken(account.accessToken, "access_token"),
            ]);
            return;
        }
        await fetch(
            `${account.homeserverUrl.replace(/\/$/, "")}/_matrix/client/v3/logout`,
            {
                method: "POST",
                headers: { Authorization: `Bearer ${account.accessToken}` },
            },
        );
    } catch {
        // ignore: server unreachable; the token stays valid server-side
    }
}

/** The homeserver's SSO redirect endpoint, optionally for one provider. */
export function getSsoRedirectUrl(
    baseUrl: string,
    redirectUrl: string,
    opts: { loginType: "sso" | "cas"; idpId?: string; register?: boolean },
): string {
    const tempClient = createClient({ baseUrl });
    const url = tempClient.getSsoLoginUrl(
        redirectUrl,
        opts.loginType,
        opts.idpId,
        opts.register ? SSOAction.REGISTER : SSOAction.LOGIN,
    );
    tempClient.stopClient();
    return url;
}

/**
 * Redeem the one-time loginToken an SSO redirect handed back. `baseUrl` is
 * the already-resolved homeserver the SSO flow started on.
 */
export async function loginWithSsoToken(
    baseUrl: string,
    loginToken: string,
    slidingSync = false,
): Promise<LoginResult> {
    const tempClient = createClient({ baseUrl });
    const response = await tempClient.login("m.login.token", {
        token: loginToken,
        initial_device_display_name: "Zam",
    });
    return finishLogin(tempClient, response, slidingSync);
}

export async function register(
    homeserverUrl: string,
    username: string,
    password: string,
    registrationToken?: string,
    slidingSync = false,
): Promise<LoginResult> {
    const resolvedBase = await resolveHomeserver(homeserverUrl);
    const tempClient = createClient({ baseUrl: resolvedBase });

    const body: Record<string, unknown> = {
        username,
        password,
        initial_device_display_name: "Zam",
        inhibit_login: false,
    };

    if (registrationToken) {
        body.auth = {
            type: "m.login.registration_token",
            token: registrationToken,
        };
    }

    const response = await tempClient.registerRequest(body);
    return finishLogin(tempClient, response, slidingSync);
}

export async function reconnect(
    homeserverUrl: string,
    userId: string,
    accessToken: string,
    deviceId: string,
    oauth?: {
        oauth: OAuthSessionInfo;
        refreshToken?: string;
        accessTokenExpiresAt?: number;
    },
): Promise<void> {
    await createAuthenticatedClient({
        baseUrl: homeserverUrl,
        accessToken,
        userId,
        deviceId,
        ...oauth,
    });
}

// False until the first PREPARED (i.e. the initial sync has finished). Used to
// suppress notification sounds/popups for the backlog of events replayed on
// page load — the user should only be alerted for events that arrive live.
let initialSyncComplete = false;

/** True once the initial sync has finished and incoming events are genuinely new. */
export function isInitialSyncComplete(): boolean {
    return initialSyncComplete;
}

// Sliding sync tuning. The room list is a window that starts small (fast first
// paint) and grows in the background until every joined room is loaded, so a
// large account never waits on one giant initial response.
const SLIDING_ALL_LIST = "all_rooms";
const SLIDING_INITIAL_WINDOW = 30;
const SLIDING_GROW_STEP = 100;
const SLIDING_LIST_TIMELINE = 1;
const SLIDING_ROOM_TIMELINE = 30;
const SLIDING_TIMEOUT_MS = 30000;

// What the room list / space tree / notification logic need for EVERY room.
// Kept deliberately small: full state is only fetched for the open room.
const SLIDING_LIST_STATE: string[][] = [
    ["m.room.create", ""],
    ["m.room.name", ""],
    ["m.room.avatar", ""],
    ["m.room.canonical_alias", ""],
    ["m.room.topic", ""],
    ["m.room.encryption", ""],
    ["m.room.tombstone", ""],
    ["m.room.join_rules", ""],
    ["m.space.parent", "*"],
    // Space/room emoji packs are offered in every room's picker, not just the
    // room that owns them, so they must be loaded for the whole list.
    ["im.ponies.room_emotes", "*"],
    ["m.room.member", MSC3575_STATE_KEY_ME],
    // Calls: who is in each room's call (room-list rosters, DM ringing) and
    // the member events of whoever just sent something (the caller's join or
    // ring). MatrixRTC ignores a call membership whose sender isn't a known
    // room member, so a DM call couldn't ring until the room was opened.
    ["org.matrix.msc3401.call.member", "*"],
    ["m.room.member", MSC3575_STATE_KEY_LAZY],
];

// The room being viewed gets everything (power levels, pins, members as the
// timeline references them) plus a deeper timeline.
const SLIDING_ROOM_STATE: string[][] = [
    ["*", "*"],
    ["m.room.member", MSC3575_STATE_KEY_ME],
    ["m.room.member", MSC3575_STATE_KEY_LAZY],
];

let activeSlidingSync: SlidingSync | null = null;

// When the sync loop last got a response (any state). Drives the stuck-sync
// watchdog in startSync; see shouldKickSync.
let lastSyncResponseAt = Date.now();
// Watchdog restarts since the last response; each one doubles the next wait.
let watchdogStrikes = 0;
// What the in-flight sliding-sync request is allowed (adaptSlidingSyncTimeout).
let slidingRequestTimeoutMs: () => number = () => 0;

// When sync last delivered a real (non-cached) response, the latest sync state,
// and when the page last came back from hidden. kickIf back-dates
// lastSyncResponseAt to pace the watchdog, so it can't answer "has sync caught
// up since the app resumed"; these can (see isSyncStale).
let lastRealSyncResponseAt = 0;
let lastSyncState: string | null = null;
let resumedAt = 0;

const isHealthySyncState = (state: string | null): boolean =>
    state === "SYNCING" || state === "PREPARED" || state === "CATCHUP";

/**
 * Whether the live timelines may be behind the server: the page is hidden, it
 * came back from the background and no sync response has landed since, or
 * sync isn't running. A notification tap on Android typically lands in
 * exactly this window, before the resumed sync has delivered the message.
 */
export function isSyncStale(): boolean {
    if (document.visibilityState === "hidden") return true;
    if (resumedAt >= lastRealSyncResponseAt) return true;
    return !isHealthySyncState(lastSyncState);
}

// How long after a fresh sync response to keep waiting for its room events:
// the SDK processes room data asynchronously (sliding sync's onRoomData awaits
// before appending), so the response's state change can beat its events.
const SYNC_SETTLE_MS = 2000;

/**
 * Wait for `eventId` to reach `room`'s live timeline, letting sync catch up
 * first. Resolves "live" once it is there; "absent" if a sync response landed
 * after this call and the event still isn't live (so it is genuinely older
 * than the live window); "timeout" if sync never answered.
 *
 * Lets a notification jump land in the live view rather than a context
 * window when sync is only briefly behind.
 */
export function waitForLiveEvent(
    room: Room,
    eventId: string,
    timeoutMs: number,
): Promise<"live" | "absent" | "timeout"> {
    if (isInLiveTimeline(room, eventId)) return Promise.resolve("live");
    const client = matrixClient;
    if (!client) return Promise.resolve("timeout");
    return new Promise((resolve) => {
        let settle: ReturnType<typeof setTimeout> | undefined;
        const finish = (result: "live" | "absent" | "timeout") => {
            clearTimeout(timer);
            clearTimeout(settle);
            room.off(RoomEvent.Timeline as never, onTimeline as never);
            client.off(ClientEvent.Sync, onSync as never);
            resolve(result);
        };
        const onTimeline = () => {
            if (isInLiveTimeline(room, eventId)) finish("live");
        };
        const onSync = (
            state: string,
            _prev: string | null,
            data?: { fromCache?: boolean },
        ) => {
            if (!isHealthySyncState(state) || data?.fromCache) return;
            settle ??= setTimeout(
                () =>
                    finish(isInLiveTimeline(room, eventId) ? "live" : "absent"),
                SYNC_SETTLE_MS,
            );
        };
        const timer = setTimeout(() => finish("timeout"), timeoutMs);
        room.on(RoomEvent.Timeline as never, onTimeline as never);
        client.on(ClientEvent.Sync, onSync as never);
    });
}

/**
 * Abort the in-flight sync request and start a fresh one right away, for a
 * long-poll that may be stuck on a dead connection (see shouldKickSync).
 * Sliding sync has resend() for exactly this. Classic /sync has no public
 * hook, so abort its request through SyncApi's controller (swapping in a new
 * one so the loop's next requests aren't born aborted): the loop treats that
 * as a dropped connection and starts its keep-alive, which retryImmediately
 * then runs at once instead of after its 2-7s backoff.
 */
function kickSync(client: MatrixClient): void {
    logSync(
        `restarting sync request (${activeSlidingSync ? "sliding" : "classic"})`,
    );
    if (activeSlidingSync && isUsingSlidingSync()) {
        activeSlidingSync.resend();
        return;
    }
    const api = (
        client as unknown as {
            syncApi?: {
                abortController?: AbortController;
                currentSyncRequest?: Promise<unknown>;
            };
        }
    ).syncApi;
    if (!api?.currentSyncRequest || !api.abortController) {
        // Not mid-request (already backing off): just skip the backoff.
        client.retryImmediately();
        return;
    }
    api.abortController.abort();
    api.abortController = new AbortController();
    // onSyncError runs on a later microtask and starts the keep-alive;
    // retry after it so there is a keep-alive to hurry along.
    setTimeout(() => client.retryImmediately(), 0);
}
let slidingActiveRoomId: string | null = null;

// Live timelines whose missing backward token has already been probed. Keyed
// by the timeline object, not the room id: a gappy/limited sync replaces the
// room's live timeline, often again without a prev_batch under sliding sync,
// and a once-per-room guard left that fresh timeline un-paginatable for the
// rest of the session (scroll to the top, nothing loads). A WeakSet also lets
// discarded timelines be collected.
let slidingPrimedTimelines = new WeakSet<EventTimeline>();

// Set when the account asked for sliding sync but the server can't do it.
let slidingSyncFallbackReason: string | null = null;

/** Why sliding sync was turned off for this session, or null if it wasn't. */
export function getSlidingSyncFallbackReason(): string | null {
    return slidingSyncFallbackReason;
}

/** True while the current client is syncing over sliding sync. */
export function isUsingSlidingSync(): boolean {
    return activeSlidingSync !== null;
}

/** How much of the room list sliding sync has loaded, or null on classic /sync. */
export function getSlidingSyncProgress(): {
    requested: number;
    total: number;
} | null {
    if (!activeSlidingSync) return null;
    const end =
        activeSlidingSync.getListParams(SLIDING_ALL_LIST)?.ranges[0]?.[1];
    const total =
        activeSlidingSync.getListData(SLIDING_ALL_LIST)?.joinedCount ?? 0;
    return { requested: Math.min((end ?? -1) + 1, total), total };
}

/**
 * Subscribe the sliding-sync connection to the room being viewed so it gets
 * full state and a deeper timeline than the room-list window provides. No-op
 * on classic /sync (which already delivers everything).
 */
export function setSlidingSyncActiveRoom(roomId: string | null): void {
    slidingActiveRoomId = roomId;
    activeSlidingSync?.modifyRoomSubscriptions(new Set(roomId ? [roomId] : []));
}

/**
 * A SlidingSync (MSC4186 simplified sliding sync, served natively by the
 * homeserver) when this account opted in on the login page, else undefined so
 * the SDK falls back to classic /sync.
 */
async function buildSlidingSync(
    client: MatrixClient,
    onFallback?: (reason: string) => void,
): Promise<SlidingSync | undefined> {
    activeSlidingSync = null;
    slidingSyncFallbackReason = null;
    slidingPrimedTimelines = new WeakSet();
    const userId = client.getUserId();
    if (!userId || !isSlidingSyncEnabled(userId)) return undefined;

    // Ask the server before committing: on one that lacks the endpoint sync
    // would otherwise just sit in an error state with no way back.
    try {
        await client.slidingSync(
            { lists: {}, timeout: 0, clientTimeout: 10000 },
            client.getHomeserverUrl(),
        );
    } catch (err) {
        if (isSlidingSyncUnsupportedError(err)) {
            const reason = t("client.thisHomeserverDoesnTSupportSliding");
            console.warn(
                "[matrix] sliding sync unsupported, falling back",
                err,
            );
            // Turned off so the next boot doesn't probe and warn again; the
            // user can re-enable it from Debug settings if the server changes.
            setSlidingSyncEnabled(userId, false);
            slidingSyncFallbackReason = reason;
            onFallback?.(reason);
            return undefined;
        }
        // Anything else (network blip, 5xx, rate limit) is not evidence the
        // server can't do it; let the real sync loop retry as it normally does.
    }

    const lists = new Map<string, MSC3575List>([
        [
            SLIDING_ALL_LIST,
            {
                ranges: [[0, SLIDING_INITIAL_WINDOW - 1]],
                sort: ["by_recency"],
                timeline_limit: SLIDING_LIST_TIMELINE,
                required_state: SLIDING_LIST_STATE,
            },
        ],
        [
            // Spaces are few and their m.space.child events define the whole
            // sidebar tree, so they are always fully loaded up front.
            "spaces",
            {
                ranges: [[0, SLIDING_INITIAL_WINDOW - 1]],
                sort: ["by_name"],
                filters: { room_types: ["m.space"] },
                timeline_limit: 0,
                required_state: [...SLIDING_LIST_STATE, ["m.space.child", "*"]],
            },
        ],
        [
            // DMs ring on an incoming call, which needs the caller's member
            // event (see SLIDING_LIST_STATE). A DM has two members, so load
            // them all; the server merges this with the room's other lists.
            "dms",
            {
                ranges: [[0, SLIDING_INITIAL_WINDOW - 1]],
                sort: ["by_recency"],
                filters: { is_dm: true },
                timeline_limit: SLIDING_LIST_TIMELINE,
                required_state: [...SLIDING_LIST_STATE, ["m.room.member", "*"]],
            },
        ],
        [
            // Pending invites must never wait behind the recency window.
            "invites",
            {
                ranges: [[0, SLIDING_INITIAL_WINDOW - 1]],
                sort: ["by_recency"],
                filters: { is_invite: true },
                timeline_limit: 0,
                required_state: SLIDING_LIST_STATE,
            },
        ],
    ]);

    slidingRequestTimeoutMs = adaptSlidingSyncTimeout(client, {
        onTimeout: (nextMs) =>
            logSync(
                `request timed out, next allows ${Math.round(nextMs / 1000)}s`,
            ),
    });

    const sliding = new SlidingSync(
        client.getHomeserverUrl(),
        lists,
        {
            timeline_limit: SLIDING_ROOM_TIMELINE,
            required_state: SLIDING_ROOM_STATE,
        },
        client,
        SLIDING_TIMEOUT_MS,
    );

    // A listener that throws inside the loop kills sync for good; restart it
    // instead (see keepSlidingSyncAlive).
    keepSlidingSyncAlive(sliding, (err, retryInMs) => {
        console.error("[sync] sliding sync loop crashed", err);
        logSync(
            `loop crashed, restarting in ${retryInMs}ms: ${describeSyncError(err)}`,
        );
    });

    // Reset a room's live timeline when an update skips events, like classic
    // /sync does (see isSlidingTimelineGap for what the SDK gets wrong). This
    // listener is registered before startClient() builds the SDK's own
    // RoomData listener, and emitPromised calls listeners in order, so the
    // reset lands before the SDK appends the update. The fresh timeline gets
    // the update's prev_batch, so the missing messages page in behind it, and
    // RoomEvent.TimelineReset makes an open MessageArea reload and refill.
    // It runs inside the sync loop, so it must never throw.
    sliding.on(
        SlidingSyncEvent.RoomData,
        (roomId: string, roomData: MSC3575RoomData) => {
            try {
                const room = client.getRoom(roomId);
                if (!room) return;
                const gap = isSlidingTimelineGap(
                    {
                        limited: roomData.limited,
                        timelineEventIds: (roomData.timeline ?? [])
                            .map((e) => e.event_id)
                            .filter((id): id is string => !!id),
                    },
                    {
                        liveIsEmpty:
                            room.getLiveTimeline().getEvents().length === 0,
                        isKnown: (id) => !!room.findEventById(id),
                    },
                );
                if (!gap) return;
                logSync(`timeline reset (gap) in ${roomId}`);
                room.resetLiveTimeline(roomData.prev_batch ?? null, null);
            } catch (err) {
                console.error("[sync] gap check failed", roomId, err);
                logSync(
                    `gap check failed in ${roomId}: ${describeSyncError(err)}`,
                );
            }
        },
    );

    // Grow every list one page per completed response until it covers all the
    // rooms the server reports for it (so no list has a hard cap).
    // Also runs inside the sync loop, so it must never throw.
    sliding.on(
        SlidingSyncEvent.Lifecycle,
        (state: SlidingSyncState, _resp: unknown, err?: unknown) => {
            if (err) {
                logSync(`request failed: ${describeSyncError(err)}`);
                return;
            }
            if (state !== SlidingSyncState.Complete) return;
            try {
                let growing = false;
                for (const key of lists.keys()) {
                    const total = sliding.getListData(key)?.joinedCount ?? 0;
                    const end = sliding.getListParams(key)?.ranges[0]?.[1];
                    const next = nextWindowEnd(end, total, SLIDING_GROW_STEP);
                    if (next !== null) {
                        growing = true;
                        sliding.setListRanges(key, [[0, next]]);
                    }
                }
                // Every window already covered its list: the room list is whole.
                if (!growing && activeSlidingSync === sliding)
                    markRoomListComplete(client);
            } catch (e) {
                console.error("[sync] list growth failed", e);
                logSync(`list growth failed: ${describeSyncError(e)}`);
            }
        },
    );

    if (slidingActiveRoomId) {
        sliding.modifyRoomSubscriptions(new Set([slidingActiveRoomId]));
    }
    activeSlidingSync = sliding;
    return sliding;
}

/**
 * Start the sync loop for the current client and return a disposer that
 * detaches this session's listeners.
 *
 * Every handler is wrapped so it no-ops once a successor client owns the
 * module slot: `.off()` alone is not enough, because a callback already
 * dispatched by the emitter can still run after the detach, and the SDK's own
 * `stopClient()` never clears emitter listeners (audit LIFE-02).
 */
export async function startSync(
    onStateChange: (state: string) => void,
    onSessionExpired?: () => void,
    onSlidingSyncFallback?: (reason: string) => void,
): Promise<() => void> {
    const owner = captureClient();
    const client = owner.client;

    initialSyncComplete = false;
    lastSyncState = null;

    const onSync = guardOwnership(
        owner,
        readOwner,
        (
            state: string,
            _prev?: string | null,
            data?: { fromCache?: boolean },
        ) => {
            lastSyncState = state;
            if (isHealthySyncState(state)) {
                lastSyncResponseAt = Date.now();
                watchdogStrikes = 0;
                if (!data?.fromCache) lastRealSyncResponseAt = Date.now();
            }
            // Classic /sync delivers the whole room list in one (cached or live)
            // pass; sliding sync reports completion from its list windows.
            if (state === "PREPARED" && !isUsingSlidingSync())
                markRoomListComplete(client);
            if (state === "SYNCING") void saveRoomListSnapshot(client);
            if (state === "PREPARED") {
                initialSyncComplete = true;
                seedStatelessRooms();
                // Heal any joined room the initial sync dropped, in place where
                // possible — a cache-wipe reload is the last resort, never for a
                // room a prior reload already failed to fix (the boot double-flash).
                void reconcileJoinedRoomsLive();
            }
            onStateChange(state);
        },
    );
    // Membership changes are how new joins surface — heal stubs right away
    // (covers joins from other devices too, not just this client's wrappers).
    const onMyMembership = guardOwnership(
        owner,
        readOwner,
        (room: Room, membership: string, prevMembership?: string) => {
            // invite → join: the room holds only the sparse set invite_state
            // delivered (no m.space.child, no power levels) and the server
            // won't re-send the rest, but it LOOKS stated — force the seed.
            // Covers accepts from another device as well as our own.
            if (membership === "join" && prevMembership === "invite") {
                void seedRoomStateIfMissing(room.roomId, true);
                return;
            }
            if (roomLacksState(room)) void seedRoomStateIfMissing(room.roomId);
        },
    );
    // Sync creates the room ALREADY joined (bare membership, no state), so
    // no membership transition fires and the join wrapper ran before the
    // room existed — ClientEvent.Room is the moment the stub appears.
    const onRoom = guardOwnership(owner, readOwner, (room: Room) => {
        if (roomLacksState(room)) void seedRoomStateIfMissing(room.roomId);
    });
    // Fired when any request comes back with M_UNKNOWN_TOKEN (token revoked,
    // password changed, device deleted, server data wiped). Without this the
    // client sits in a permanent sync-error state with no path back to login.
    const onLoggedOut = onSessionExpired
        ? guardOwnership(owner, readOwner, () => onSessionExpired())
        : null;

    client.on(ClientEvent.Sync, onSync as never);
    client.on("Room.myMembership" as never, onMyMembership as never);
    client.on(ClientEvent.Room as never, onRoom as never);
    const onMemberState = guardOwnership(owner, readOwner, (e: MatrixEvent) =>
        recalcCallOnMemberLoaded(e),
    );
    client.on(RoomStateEvent.Events, onMemberState);
    if (onLoggedOut) client.on(HttpApiEvent.SessionLoggedOut, onLoggedOut);

    let disposed = false;
    /** Idempotent: safe to call from a teardown path and again on re-sync. */
    const dispose = (): void => {
        if (disposed) return;
        disposed = true;
        client.off(ClientEvent.Sync, onSync as never);
        client.off("Room.myMembership" as never, onMyMembership as never);
        client.off(ClientEvent.Room as never, onRoom as never);
        client.off(RoomStateEvent.Events, onMemberState);
        if (onLoggedOut) client.off(HttpApiEvent.SessionLoggedOut, onLoggedOut);
        document.removeEventListener("visibilitychange", onHidden);
        document.removeEventListener("visibilitychange", onVisibleKick);
        window.removeEventListener("online", onOnlineKick);
        clearInterval(syncWatchdog);
    };

    // Unstick a sync long-poll left hanging by a network blip or an OS
    // suspend, so new messages show up now rather than after the SDK's ~110s
    // request timeout. See shouldKickSync for when this fires.
    let hiddenSince: number | null = null;
    const kickIf = (
        trigger: "online" | "visible" | "watchdog",
        hiddenForMs = 0,
    ) => {
        if (!ownedClient(owner) || !initialSyncComplete) return;
        const since = Date.now() - lastSyncResponseAt;
        const overdueAfter = watchdogOverdueMs(
            watchdogStrikes,
            isUsingSlidingSync() ? slidingRequestTimeoutMs() : 0,
        );
        if (!shouldKickSync(trigger, since, hiddenForMs, overdueAfter)) return;
        if (trigger === "watchdog") watchdogStrikes++;
        logSync(
            `kick: ${trigger}, ${Math.round(since / 1000)}s since last response` +
                (hiddenForMs
                    ? `, hidden ${Math.round(hiddenForMs / 1000)}s`
                    : ""),
        );
        // Count the restart as activity so the watchdog doesn't fire again
        // before the new request has had a chance to answer.
        lastSyncResponseAt = Date.now();
        kickSync(client);
    };
    const onVisibleKick = () => {
        if (document.visibilityState === "hidden") {
            hiddenSince = Date.now();
            return;
        }
        const hiddenFor = hiddenSince === null ? 0 : Date.now() - hiddenSince;
        hiddenSince = null;
        resumedAt = Date.now();
        kickIf("visible", hiddenFor);
    };
    const onOnlineKick = () => kickIf("online");
    document.addEventListener("visibilitychange", onVisibleKick);
    window.addEventListener("online", onOnlineKick);
    const syncWatchdog = setInterval(() => {
        // A hidden tab's timers are throttled and its sockets may be frozen;
        // the visible handler covers it on return.
        if (document.visibilityState === "visible") kickIf("watchdog");
    }, 10_000);

    // Paint the last known room list while sync catches up.
    await hydrateRoomListCache(client);
    // A hidden page may never come back (mobile kills it): save on the way out.
    const onHidden = () => {
        if (document.visibilityState === "hidden")
            void saveRoomListSnapshot(client, true);
    };
    document.addEventListener("visibilitychange", onHidden);

    try {
        const slidingSync = await buildSlidingSync(
            client,
            onSlidingSyncFallback,
        );
        await client.startClient({
            slidingSync: slidingSync,
            initialSyncLimit: 8,
            lazyLoadMembers: true,
            pendingEventOrdering: PendingEventOrdering.Detached,
            // threadSupport is an IStartClientOpts option — supportsThreads()
            // reads the opts passed HERE, not createClient's (which silently
            // ignores the key). With it off, the SDK never builds Thread objects
            // and every m.thread reply stays in the main timeline, where the
            // thread filter in getTimelineMessages hides it from view entirely.
            threadSupport: true,
        });
    } catch (err) {
        // A rejected start must not leave four listeners bound to a client the
        // caller is about to throw away.
        dispose();
        throw err;
    }

    // The slot changed while we were starting up (expiry, or a second
    // sign-in): this client never became the app's client, so detach now.
    if (!ownedClient(owner)) dispose();

    return dispose;
}

/** Retry a failed (NOT_SENT) local echo. */
export async function resendMessage(event: MatrixEvent): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const room = matrixClient.getRoom(event.getRoomId() ?? "");
    if (!room) return;
    await matrixClient.resendEvent(event, room);
}

/** Discard a failed (NOT_SENT) local echo, removing it from the queue. */
export function deleteFailedMessage(event: MatrixEvent): void {
    if (!matrixClient) return;
    matrixClient.cancelPendingEvent(event);
}

// Namespaced under the app's own reverse-DNS id so it no longer squats the
// reserved `m.*` spec namespace. The old key is still READ (migration fallback)
// but never written again — see loadFavouriteGifs / persistFavouriteGifs.
const FAV_GIFS_KEY = "moe.crafty.matrix.favourite_gifs";
const LEGACY_FAV_GIFS_KEY = "m.favourite_gifs";

export interface FavouriteGif {
    url: string;
    previewUrl: string;
    addedAt: number;
    tags?: string[];
}

/**
 * Manual plugin-sync payload (moe.crafty.matrix.plugins). Structurally matches
 * plugins/pluginSync.ts::PluginSyncPayload; kept a local type so client.ts
 * imports nothing from plugins/ (the boundary runs plugins -> client, never
 * the reverse). The plugin boot glue validates the wire shape via parseSyncPayload.
 */
export interface PluginSyncAccountData {
    version: number;
    repos: string[];
    plugins: Record<string, unknown>;
    autoUpdate: boolean;
}

function gifsFromEvent(
    event: MatrixEvent | null | undefined,
): FavouriteGif[] | null {
    if (!event) return null;
    return (event.getContent()?.gifs as FavouriteGif[] | undefined) ?? [];
}

export function loadFavouriteGifs(): FavouriteGif[] {
    if (!matrixClient) return [];
    // Prefer the new key; fall back to the legacy key only when the new one was
    // never written (pickFavouriteGifs treats a present-but-empty new key as
    // authoritative, so a cleared list is never resurrected from the legacy blob).
    return pickFavouriteGifs(
        gifsFromEvent(matrixClient.getAccountData(FAV_GIFS_KEY)),
        gifsFromEvent(matrixClient.getAccountData(LEGACY_FAV_GIFS_KEY)),
    );
}

/**
 * The favourites list as the homeserver currently has it, fetched over the
 * wire. Throws if the request fails, so callers can tell "the server says
 * there are none" (empty array) from "we couldn't ask" (throw).
 *
 * Deliberately NOT client.getAccountDataFromServer(): despite the name, that
 * short-circuits to the local sync store once the initial sync has completed,
 * which returns exactly the possibly-stale data we are trying to look past.
 */
export async function fetchFavouriteGifsFromServer(): Promise<FavouriteGif[]> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const userId = matrixClient.getUserId();
    if (!userId) throw new Error(t("client.notLoggedIn"));
    // Returns null when the key has never been set for this account (404), so
    // the new key falling back to the legacy key is distinguishable from a key
    // that is set to an empty list.
    const fetchKey = async (key: string): Promise<FavouriteGif[] | null> => {
        const path = `/user/${encodeURIComponent(userId)}/account_data/${key}`;
        try {
            const content = await matrixClient!.http.authedRequest<{
                gifs?: FavouriteGif[];
            }>(Method.Get, path);
            return content?.gifs ?? [];
        } catch (err) {
            if ((err as MatrixError)?.errcode === "M_NOT_FOUND") return null;
            throw err;
        }
    };
    // Prefer the new key; fall back to the legacy key only when the new one is
    // absent (the first write after migration copies the legacy list forward).
    const current = await fetchKey(FAV_GIFS_KEY);
    if (current !== null) return current;
    return pickFavouriteGifs(current, await fetchKey(LEGACY_FAV_GIFS_KEY));
}

export async function persistFavouriteGifs(
    gifs: FavouriteGif[],
): Promise<void> {
    if (!matrixClient) return;
    await matrixClient.setAccountData(FAV_GIFS_KEY, { gifs });
}

// Namespaced under the app's own reverse-DNS id (the Android applicationId /
// Electron appId) so it cannot collide with another client's account data —
// same convention as FAV_GIFS_KEY above.
const CUSTOMIZATION_KEY = "moe.crafty.matrix.customization";

/** Raw customization account data, or null when absent / not logged in. */
export function loadCustomization(): ClientCustomization | null {
    if (!matrixClient) return null;
    const event = matrixClient.getAccountData(CUSTOMIZATION_KEY);
    if (!event) return null;
    return sanitizeCustomization(event.getContent());
}

export async function persistCustomization(
    value: ClientCustomization,
): Promise<void> {
    if (!matrixClient) return;
    await matrixClient.setAccountData(CUSTOMIZATION_KEY, value);
}

export function onAccountData(callback: (type: string) => void): () => void {
    if (!matrixClient) return () => {};
    const handler = (event: MatrixEvent) => callback(event.getType());
    matrixClient.on(ClientEvent.AccountData, handler as never);
    return () => matrixClient?.off(ClientEvent.AccountData, handler as never);
}

/** The account's current active-session heartbeat, or null when absent or
 *  malformed. Reads the synced copy — never a /account_data GET, which the
 *  SDK caches poorly. */
export function getActiveSessionHeartbeat(): ActiveSessionHeartbeat | null {
    if (!matrixClient) return null;
    const event = matrixClient.getAccountData(ACTIVE_SESSION_KEY);
    if (!event) return null;
    return parseActiveSession(event.getContent());
}

/** Claim "this device is in active use" for the next `graceMs`. Also the
 *  transport for the setting itself: `graceMs` rides in the blob so the
 *  service worker and the Android service read threshold + heartbeat in one
 *  request.
 *
 *  Resolves `true` only when the account data was actually written. The two
 *  guards below are ordinary states (no client yet, no device id), not errors,
 *  so they cannot throw — and Settings must not report a save that never
 *  happened, least of all for "Off", which the service worker and the Android
 *  service can learn no other way. */
export async function publishActiveSession(graceMs: number): Promise<boolean> {
    if (!matrixClient) return false;
    const deviceId = matrixClient.getDeviceId();
    if (!deviceId) return false;
    await matrixClient.setAccountData(
        ACTIVE_SESSION_KEY,
        buildHeartbeat({ deviceId, now: Date.now(), graceMs }),
    );
    return true;
}

export function onSyncPrepared(callback: () => void): () => void {
    if (!matrixClient) return () => {};
    const handler = (state: string) => {
        if (state === "PREPARED") callback();
    };
    matrixClient.on(ClientEvent.Sync, handler as never);
    return () => matrixClient?.off(ClientEvent.Sync, handler as never);
}

/** Fires when the sync loop recovers from an error/reconnecting state — i.e.
 *  we are talking to the homeserver again. Used to re-drive writes that failed
 *  while offline. Returns an unsubscribe. */
export function onSyncReconnected(callback: () => void): () => void {
    if (!matrixClient) return () => {};
    const handler = (state: string, prevState: string | null) => {
        if (isSyncRecovery(state, prevState)) callback();
    };
    matrixClient.on(ClientEvent.Sync, handler as never);
    return () => matrixClient?.off(ClientEvent.Sync, handler as never);
}

export async function logout(): Promise<void> {
    const client = matrixClient;
    const owner = client ? captureOwnership(client, clientGeneration) : null;
    // Only release the module slot if we still own it — a successor account's
    // client may have been created (via reconnect) while the awaits were in
    // flight. Bumping the generation on release invalidates every ownership
    // token this client handed out (LIFE-02). Kept as a closure because the
    // logout sequence releases on `onLocalWipeSettled`, BEFORE the invalidation
    // is awaited: a hung POST /logout must not leave the slot pointing at a
    // stopped client (CRYPTO-04).
    const releaseSlot = () => {
        if (owner && ownsRuntime(owner, matrixClient, clientGeneration)) {
            releaseClient();
            // Memoized space-child ids belong to the account being released;
            // the next account must not read them back (R3 clears this on the
            // other two teardown paths for the same reason).
            spaceChildCache.clear();
        }
    };
    if (client) {
        const userId = client.getUserId();
        const deviceId = client.getDeviceId();
        // Remember the wipe BEFORE attempting it. `clearStores()` hangs forever
        // when another tab holds the crypto IndexedDB open (its `onblocked`
        // handler only logs), and AppShell's 4s window then reloads the page
        // with the key material still on disk — writing the marker afterwards
        // would never run in exactly the case it exists for.
        // The cached room list is account data too: wipe it with the rest.
        if (userId && deviceId)
            void deleteSnapshot(snapshotKey(userId, deviceId));
        resetRoomListCache();
        if (userId && deviceId) {
            rememberPendingWipe({
                userId,
                deviceId,
                cryptoDbPrefix: getCryptoDbName(userId, deviceId),
            });
        }
        // Wipe the persisted sync store AND the per-account rust-crypto store
        // so the next user on this device can't recover the previous account's
        // cached rooms/messages or its key material from IndexedDB. The crypto
        // store is keyed by cryptoDatabasePrefix (see initCrypto); pass the
        // same prefix so clearStores() finds and deletes it.
        //
        // The wipe is NOT sequenced behind `logout(true)`: AppShell reloads
        // after 4s, and a hung POST /logout used to eat the whole window and
        // leave the crypto store on disk. `logout(true)` stops the client and
        // aborts in-flight requests synchronously, so dispatching it first
        // (without awaiting) is enough to make clearStores() legal.
        //
        // But we do still await that dispatched request after the wipe, so the
        // rest of AppShell's 4s window (`Promise.race([logout(), 4000ms])` —
        // the bound on this whole function) goes on invalidating the token
        // server-side instead of being cut short by the reload. Resolving as
        // soon as the wipe finished would leave a live access token behind.
        const outcome = await runLogoutSequence({
            invalidateSession: () => client.logout(true),
            // Without both ids there is no per-account prefix to pass, and
            // clearStores() falls back to the SDK's own default prefix — so the
            // sync store still goes, but the per-account crypto store is only
            // wiped when we know both ids (always true for a logged-in client).
            wipeLocalStores: () =>
                client.clearStores(
                    userId && deviceId
                        ? {
                              cryptoDatabasePrefix: getCryptoDbName(
                                  userId,
                                  deviceId,
                              ),
                          }
                        : undefined,
                ),
            // Runs before the invalidation is awaited, so a hung POST /logout
            // can't leave the module slot pointing at a stopped client.
            onLocalWipeSettled: releaseSlot,
        });
        // Only a wipe that actually completed retires the marker; a failed or
        // blocked one must stay for the next boot to finish.
        if (outcome.localWipeOk && userId && deviceId) {
            forgetPendingWipe({ userId, deviceId });
        }
        // The sequence reports what actually happened to the two things that
        // matter about signing out; discarding it would make a failed wipe or a
        // still-live token indistinguishable from a clean logout. Console only —
        // AppShell reloads the page right after this, so there is no surface
        // left to render on, and the log survives the reload.
        if (!outcome.localWipeOk) {
            console.warn(
                "[matrix] logout: clearing local stores failed - this account's cached sync store and its rust-crypto store (message keys) may still be on this device",
            );
        }
        if (outcome.invalidationStarted && !outcome.invalidationOk) {
            console.warn(
                "[matrix] logout: the server did not confirm the sign-out - this session's access token may still be live; it can be revoked from Settings on another session",
            );
        }
    } else {
        releaseSlot();
    }
}

export function stopClient(): void {
    matrixClient?.stopClient();
    // Releasing the slot invalidates every outstanding ownership token: a
    // stopped client's late callback must not run root teardown against its
    // successor (LIFE-02).
    releaseClient()
        ?.destroy()
        .catch(() => {});
    // Room ids are globally unique so a surviving entry could not be *wrong*,
    // but it must not outlive the session it was built for.
    spaceChildCache.clear();
    resetRoomListCache();
}

const pendingLeaves = new Set<string>();

/**
 * Rooms we have asked the server to join but that `/sync` has not confirmed
 * yet. Consumed by `isRoomLandable` ONLY — deliberately NOT by `getRooms()` or
 * `getRoomsInSpace()`, which must keep answering with genuinely joined rooms or
 * the sidebar would list a room the SDK cannot render yet.
 */
const pendingJoins = new Set<string>();

/**
 * Clear a pending join once the SDK reflects it locally, with a backstop so a
 * join the server never streams back can't wedge the id in the set forever.
 * Mirrors the pendingLeaves bookkeeping at the end of `leaveRoom`.
 */
function clearPendingJoinWhenSynced(roomId: string): void {
    const check = setInterval(() => {
        if (matrixClient?.getRoom(roomId)?.getMyMembership() === "join") {
            pendingJoins.delete(roomId);
            clearInterval(check);
        }
    }, 500);
    setTimeout(() => {
        pendingJoins.delete(roomId);
        clearInterval(check);
    }, 30000);
}

/**
 * Claim a room as landable until `/sync` catches up.
 *
 * Every way of *arriving* in a room has the same window: `createRoom`,
 * `createSpace`, `createDirectMessage` and `joinRoomByAlias` all resolve before
 * the room is in the client store, and each ends in `setActiveRoom(newId)`. So
 * `setActiveRoom` — the single funnel every deliberate navigation goes through
 * — calls this, and no future wrapper has to remember to. Deliberately NOT
 * called from the fallback chain's own `landOnRoom`: that lands on a room the
 * chain already judged landable, so marking it would be circular and would
 * blunt the stale-id fall-through this whole feature exists for.
 *
 * Over-marking is bounded: a room the user genuinely cannot be in clears itself
 * within 30 s and merely delays the chain's correction that long.
 */
export function markRoomPendingArrival(roomId: string): void {
    pendingJoins.add(roomId);
    clearPendingJoinWhenSynced(roomId);
}

export function getRooms(): Room[] {
    return listRooms().filter(
        (r) => r.getMyMembership() === "join" && !pendingLeaves.has(r.roomId),
    );
}

/**
 * A room by id, falling back to the cached room list while sync catches up.
 * Display and lookup only — anything that must act on a live room (open its
 * timeline, send) uses `getLiveRoom`.
 */
export function getRoom(roomId: string): Room | null {
    return lookupRoom(roomId);
}

/** The SDK's own room, never a cached stand-in. */
export function getLiveRoom(roomId: string): Room | null {
    return matrixClient?.getRoom(roomId) ?? null;
}

// ── Cached room list (see roomListCache.ts) ────────────────────────────────
//
// On boot the last saved room list is materialised into detached Room objects
// and consulted as a fallback by the room-list helpers below, so the sidebar
// renders at once instead of waiting for sync. Live rooms always win. Once the
// real list is complete (classic: first PREPARED; sliding: every list window
// covers its room count) the cache is dropped, which also prunes rooms left
// while we were away, and a fresh snapshot is saved.

let roomListCache: MaterializedCache | null = null;
let roomListComplete = false;
let lastSnapshotSaveAt = 0;
const SNAPSHOT_SAVE_INTERVAL_MS = 2 * 60_000;

function resetRoomListCache(): void {
    roomListCache = null;
    roomListComplete = false;
    lastSnapshotSaveAt = 0;
    hierarchyCache.clear();
}

function lookupRoom(roomId: string): Room | null {
    return (
        matrixClient?.getRoom(roomId) ??
        roomListCache?.rooms.get(roomId) ??
        null
    );
}

function lookupAccountData(type: string): MatrixEvent | undefined {
    return (
        matrixClient?.getAccountData(type as never) ??
        roomListCache?.accountData.get(type)
    );
}

/** Every SDK room plus cached rooms the SDK doesn't have yet. */
function listRooms(): Room[] {
    const live = matrixClient?.getRooms() ?? [];
    if (!roomListCache || !matrixClient) return live;
    const client = matrixClient;
    const extra = [...roomListCache.rooms.values()].filter(
        (r) => !client.getRoom(r.roomId),
    );
    return extra.length ? [...live, ...extra] : live;
}

/** True while the sidebar may be showing cached rooms. */
export function isRoomListFromCache(): boolean {
    return roomListCache !== null;
}

async function hydrateRoomListCache(client: MatrixClient): Promise<void> {
    resetRoomListCache();
    const userId = client.getUserId();
    const deviceId = client.getDeviceId();
    if (!userId || !deviceId) return;
    const snapshot = await loadSnapshot(snapshotKey(userId, deviceId));
    if (!snapshot || matrixClient !== client || roomListComplete) return;
    roomListCache = materializeSnapshot(client, snapshot);
    for (const [spaceId, list] of Object.entries(snapshot.hierarchies ?? {}))
        if (!hierarchyCache.has(spaceId)) hierarchyCache.set(spaceId, list);
}

function markRoomListComplete(client: MatrixClient): void {
    if (matrixClient !== client || roomListComplete) return;
    roomListComplete = true;
    if (roomListCache) {
        roomListCache = null;
        for (const cb of roomUpdateSubscribers) cb();
    }
    void saveRoomListSnapshot(client, true);
}

async function saveRoomListSnapshot(
    client: MatrixClient,
    force = false,
): Promise<void> {
    if (matrixClient !== client || !roomListComplete) return;
    const now = Date.now();
    if (!force && now - lastSnapshotSaveAt < SNAPSHOT_SAVE_INTERVAL_MS) return;
    lastSnapshotSaveAt = now;
    const userId = client.getUserId();
    const deviceId = client.getDeviceId();
    if (!userId || !deviceId) return;
    await saveSnapshot(snapshotKey(userId, deviceId), {
        ...buildSnapshot(client),
        hierarchies: Object.fromEntries(hierarchyCache),
    });
}

/**
 * Whether a room is somewhere we may leave the user sitting — i.e. NOT provably
 * gone. This is how the landing-surface chain tells a stale remembered room id
 * from a live one, and it deliberately answers a weaker question than
 * "does membership read join".
 *
 * **A just-joined room is not gone.** `MatrixClient.joinRoom` resolves as soon
 * as `/join` returns: it ends in `syncApi.createRoom(roomId)` →
 * `_createAndReEmitRoom`, which only constructs a `Room` and NEVER calls
 * `client.store.storeRoom` (every `storeRoom` call site lives in sync
 * processing). Since `client.getRoom()` reads straight out of that store,
 * `getRoom()` still answers `null` until the `/sync` carrying the join lands —
 * so the "no Room object" test below would call a room the user just clicked
 * Join on gone, and the chain would move them off it and persist the
 * replacement. Accepting an invite and re-joining a left room have the same
 * window with a non-null Room whose membership still reads `"invite"` /
 * `"leave"`. `pendingJoins` covers all three.
 *
 * **Unknown membership is not gone either.** `Room.getMyMembership()` is
 * `selfMembership ?? "leave"`, and `selfMembership` is only ever written by the
 * sync loop. That hole applies to a federated room continuwuity omits from
 * /sync, until `seedRoomStateIfMissing` heals it. So a room with no
 * `m.room.member` event for us at all is treated as landable, while a room the
 * SDK has a real opinion about is held to `"join"`.
 */
export function isRoomLandable(roomId: string): boolean {
    // An optimistic leave must not land us straight back on the room. This
    // outranks pendingJoins: leaving a room we only just joined is still a
    // leave, and the leave is the newer intent.
    if (pendingLeaves.has(roomId)) return false;
    // An optimistic join is landable before /sync confirms it — see above; both
    // the `!room` test and the membership test would otherwise answer false.
    if (pendingJoins.has(roomId)) return true;
    const room = matrixClient?.getRoom(roomId);
    // After the first sync the SDK knows every joined room, so no Room object
    // means left, forgotten, or never joined — the case that makes a stale
    // cached id fall through the chain.
    if (!room) return false;
    // No `m.room.member` event for us at all: the SDK has formed no opinion
    // yet, which `getMyMembership()` would flatten to "leave". Unknown ≠ gone.
    const userId = matrixClient?.getUserId();
    if (userId && room.getMember(userId) === null) return true;
    return room.getMyMembership() === "join";
}

/**
 * Whether a room's purpose is a call rather than a timeline. Reads the immutable
 * `m.room.create` type through the SDK and delegates the string matching to the
 * pure util, which also accepts the types other clients write.
 */
export function isVideoRoom(room: Room): boolean {
    return isVideoRoomType(room.getType());
}

/**
 * Whether a room's `m.room.create` has actually arrived, so `getType()` can be
 * trusted. Federated rooms that continuwuity omits from /sync exist locally as
 * bare stubs whose type reads as `undefined` until `seedRoomStateIfMissing`
 * heals them — indistinguishable from a genuinely typeless ordinary room.
 * Callers that must not commit to a decision early check this first.
 */
export function roomTypeIsKnown(room: Room): boolean {
    return !!room
        .getLiveTimeline()
        .getState(EventTimeline.FORWARDS)
        ?.getStateEvents("m.room.create", "");
}

export function getSpaces(): Room[] {
    return getRooms().filter((r) => r.isSpaceRoom());
}

// `m.space.child` ordering is recomputed constantly — SpaceSidebar's unread
// badge walks every space (and every sub-space) on every unread tick, and each
// walk sorts the child list twice. A state event is replaced, never edited, so
// the list of current event ids is a complete signature: an added, removed,
// re-ordered or re-via'd child always arrives as a NEW event with a new id.
// The ONE in-place mutation the SDK performs is redaction, which keeps the id
// and empties the content — signatureOf() marks that case explicitly.
const spaceChildCache = new Map<string, { signature: string; ids: string[] }>();

function spaceChildEvents(spaceId: string) {
    const space = lookupRoom(spaceId);
    if (!space) return null;
    const events = space
        .getLiveTimeline()
        .getState(EventTimeline.FORWARDS)
        ?.getStateEvents("m.space.child");
    return Array.isArray(events) ? events : events ? [events] : [];
}

/**
 * Signature over the array the caller already holds — `getStateEvents(type)`
 * builds a fresh array on every call, so the id-by-id walk must not re-fetch it.
 */
function signatureOf(events: MatrixEvent[]): string {
    const parts: string[] = [];
    for (const e of events) {
        const id = e.getId();
        // An event with no id would make two different states share a
        // signature — refuse to sign rather than cache a wrong answer.
        if (!id) return "";
        // A redaction mutates the event IN PLACE and keeps its id (the SDK's
        // MSC4293 ban handler does exactly this to state events), so the id
        // alone would not move while `via` disappeared. isRedacted() is a
        // property read — no getContent() — so the signature stays cheap.
        parts.push(e.isRedacted() ? `${id}!` : id);
    }
    return parts.join("|");
}

/**
 * Cheap identity of a space's child state. Empty string means "no space" or
 * "not cacheable"; callers use it to decide whether derived data went stale.
 */
export function getSpaceChildSignature(spaceId: string): string {
    const arr = spaceChildEvents(spaceId);
    if (!arr) return "";
    return signatureOf(arr);
}

export function getSpaceChildIds(spaceId: string): string[] {
    const arr = spaceChildEvents(spaceId);
    if (!arr) return [];

    const signature = signatureOf(arr);
    if (signature) {
        const cached = spaceChildCache.get(spaceId);
        if (cached && cached.signature === signature) return cached.ids;
    }

    const descriptors: SpaceChildDescriptor[] = arr.map((e) => {
        const content = e.getContent();
        return {
            stateKey: e.getStateKey() ?? "",
            via: content?.via,
            order: content?.order,
            ts: e.getTs(),
        };
    });
    const ids = sortSpaceChildIds(descriptors);
    // Callers treat this as read-only (verified at every call site).
    if (signature) spaceChildCache.set(spaceId, { signature, ids });
    return ids;
}

/**
 * Find a space (top-level, joined) that contains the given room as a child.
 * Returns null if the room isn't in any space (i.e. it's a home/DM/orphan room).
 * Used to select the right space when jumping to a room from elsewhere.
 */
export function findSpaceForRoom(roomId: string): string | null {
    // A room inside a sub-space opens under its top-level space, where the
    // sub-space renders as a category; the sub-space itself is not on the rail.
    const parents = getDirectParentSpaceIds(roomId);
    if (!parents.length) return null;
    const nested = getNestedSpaceIds();
    for (const p of parents) {
        const top = topLevelSpaceOf(p, getDirectParentSpaceIds, nested);
        if (top) return top;
    }
    return parents[0];
}

/** Joined spaces that live under another joined space (see utils/spaceTree). */
export function getNestedSpaceIds(): Set<string> {
    const joined = getSpaces()
        .filter((s) => s.getMyMembership() === "join")
        .map((s) => s.roomId);
    return nestedSpaceIds(joined, getSpaceChildIds);
}

/** Joined spaces whose m.space.child list includes this room (DIRECT parents only). */
export function getDirectParentSpaceIds(roomId: string): string[] {
    const result: string[] = [];
    for (const space of getSpaces()) {
        if (space.getMyMembership() !== "join") continue;
        if (getSpaceChildIds(space.roomId).includes(roomId)) {
            result.push(space.roomId);
        }
    }
    return result;
}

export function getRoomsInSpace(spaceId: string): Room[] {
    const childIds = getSpaceChildIds(spaceId);
    return childIds
        .map((id) => lookupRoom(id))
        .filter(
            (r): r is Room =>
                !!r &&
                !r.isSpaceRoom() &&
                r.getMyMembership() === "join" &&
                !pendingLeaves.has(r.roomId),
        );
}

export function getDirectRoomIds(): Set<string> {
    const directEvent = lookupAccountData(EventType.Direct);
    if (!directEvent) return new Set();
    const content = directEvent.getContent() as Record<string, string[]>;
    return new Set(Object.values(content).flat());
}

export function getOrphanRooms(): Room[] {
    const allSpaceChildIds = new Set<string>();
    getSpaces().forEach((space) => {
        getSpaceChildIds(space.roomId).forEach((id) =>
            allSpaceChildIds.add(id),
        );
    });

    const directIds = getDirectRoomIds();

    return getRooms().filter(
        (r) =>
            !r.isSpaceRoom() &&
            !allSpaceChildIds.has(r.roomId) &&
            !directIds.has(r.roomId),
    );
}

export function getDirectRooms(): Room[] {
    const directIds = getDirectRoomIds();
    return getRooms().filter(
        (r) => directIds.has(r.roomId) && !r.isSpaceRoom(),
    );
}

/**
 * All six room buckets from ONE pass. `refreshRooms()` used to call
 * getSpaces/getOrphanRooms/getDirectRooms/getInvitedRooms/getKnockedRooms/
 * getRoomsInSpace separately, which meant four full scans of every room plus
 * two independent derivations of every space's child list, on every sync.
 * getSpaces/getOrphanRooms/getDirectRooms stay exported for their other
 * callers (settings panes, SpaceSidebar, incomingCalls); getInvitedRooms and
 * getKnockedRooms now have none in `src/` and are kept as SDK-boundary API.
 */
export function getRoomClassification(
    activeSpaceId: string | null,
): RoomClassification<Room> {
    // Deliberately the UNFILTERED SDK list: getInvitedRooms/getKnockedRooms
    // read it raw, and only the joined buckets go through the pendingLeaves
    // filter that the exported getRooms() applies.
    const all = listRooms();
    const rooms = all.map((r) => ({
        room: r,
        roomId: r.roomId,
        isSpace: r.isSpaceRoom(),
        membership: r.getMyMembership(),
        pendingLeave: pendingLeaves.has(r.roomId),
    }));

    // getOrphanRooms derives its child set from getSpaces(), which runs through
    // the join + pendingLeaves filter — mirror that here or a leaving space
    // would keep adopting its children.
    const spaceChildIds = new Map<string, readonly string[]>();
    for (const d of rooms) {
        if (!d.isSpace || d.membership !== "join" || d.pendingLeave) continue;
        spaceChildIds.set(d.roomId, getSpaceChildIds(d.roomId));
    }

    return classifyRooms({
        rooms,
        directIds: getDirectRoomIds(),
        spaceChildIds,
        // getRoomsInSpace() gates the children, NOT the space, so the active
        // space's list must not go through the join filter above: a space we
        // are leaving, or were removed from elsewhere, keeps listing its rooms
        // until the view moves away. Costs one extra child-list read (memoized)
        // when the active space is not joined.
        activeSpaceChildIds: activeSpaceId
            ? getSpaceChildIds(activeSpaceId)
            : [],
    });
}

// ── Room tags (favourites / low priority) ──────────────────────────────────

// Rooms with a favourite/low-priority toggle currently in flight. The local
// tag state only refreshes over sync, so a second toggle fired before the first
// round-trip lands reads stale tags and can interleave delete/set into a
// both-or-neither state — drop the re-entrant click instead.
const roomTagToggleInFlight = new Set<string>();

/** Read a room's tags from local synced state (no HTTP round-trip). */
export function getRoomTags(roomId: string): RoomTagMap {
    return (lookupRoom(roomId)?.tags ?? {}) as RoomTagMap;
}

export async function setRoomTag(
    roomId: string,
    tag: string,
    order?: number | string,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    // The SDK types `order` as number, but foreign non-numeric orders must
    // round-trip verbatim — cast at the boundary like the rest of this module.
    await (matrixClient as any).setRoomTag(
        roomId,
        tag,
        order === undefined ? {} : { order },
    );
}

/**
 * Write a raw, user-supplied `m.tag` order value:
 *  - blank → clear the order (keep the tag);
 *  - a finite number → clamped into the spec's `[0, 1]` range;
 *  - anything non-numeric → throw (the `m.tag` order is spec'd as a number, so
 *    a non-numeric raw value is a user error the caller surfaces).
 * Returns the resolved action so the caller can surface a `clamped` adjustment
 * (e.g. "5" → 1) instead of silently changing the user's value.
 */
export async function setRoomTagOrderRaw(
    roomId: string,
    tag: string,
    raw: string,
): Promise<TagOrderInput> {
    const resolution = resolveTagOrderInput(raw);
    if (resolution.kind === "clear") {
        await setRoomTag(roomId, tag);
    } else {
        await setRoomTag(roomId, tag, resolution.value);
    }
    return resolution;
}

export async function deleteRoomTag(
    roomId: string,
    tag: string,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    await matrixClient.deleteRoomTag(roomId, tag);
}

/** Toggle m.favourite / m.lowpriority on a room. The two are mutually
 *  exclusive; the UI refreshes when the tag change comes back over sync. */
export async function toggleRoomTag(
    roomId: string,
    toggle: "favourite" | "lowPriority",
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    if (roomTagToggleInFlight.has(roomId)) return;
    roomTagToggleInFlight.add(roomId);
    try {
        const { add, remove } = tagUpdatesForToggle(
            getRoomTags(roomId),
            toggle,
        );
        for (const tag of remove) await matrixClient.deleteRoomTag(roomId, tag);
        if (add) await matrixClient.setRoomTag(roomId, add, {});
    } finally {
        roomTagToggleInFlight.delete(roomId);
    }
}

/**
 * Move a favourite / low-priority room to sit between two neighbours (identified
 * by their room ids; `null` = open head/tail). Only the tag's `order` is
 * touched — membership of the tag is never added or removed.
 *
 * Fast path: a numeric midpoint (⚑2) when both bracketing neighbours have a
 * numeric (or open-ended) order. Falls back to renumbering the whole tagged
 * section with evenly-spread orders when the neighbours can't bracket a value
 * (non-numeric/missing order, or numeric precision exhausted).
 */
export async function reorderRoomTag(
    section: "favourite" | "lowPriority",
    roomId: string,
    beforeId: string | null,
    afterId: string | null,
): Promise<void> {
    const tag = section === "favourite" ? TAG_FAVOURITE : TAG_LOWPRIORITY;

    // Numeric-parse a raw order value the same way compareOrder does.
    const asNum = (v: unknown): number | null => {
        if (typeof v === "number") return Number.isFinite(v) ? v : null;
        if (typeof v === "string" && v.trim() !== "") {
            const n = Number(v);
            return Number.isFinite(n) ? n : null;
        }
        return null;
    };

    const beforeRaw = beforeId ? getRoomTags(beforeId)?.[tag]?.order : null;
    const afterRaw = afterId ? getRoomTags(afterId)?.[tag]?.order : null;
    const bn = asNum(beforeRaw);
    const an = asNum(afterRaw);

    // Fast path only when each present neighbour has a numeric order; a present
    // neighbour with a non-numeric/missing order forces a rebalance.
    const beforeOk = beforeId === null || bn !== null;
    const afterOk = afterId === null || an !== null;
    if (beforeOk && afterOk) {
        try {
            const o = numberBetween(beforeId ? bn : null, afterId ? an : null);
            await setRoomTag(roomId, tag, o);
            return;
        } catch (e) {
            if (!(e instanceof OrderRebalanceError)) throw e;
        }
    }

    // Rebalance: renumber the whole tagged section in display order.
    const tagged = getRooms().filter((r) => tag in getRoomTags(r.roomId));
    tagged.sort((a, b) =>
        compareOrder(
            getRoomTags(a.roomId)[tag]?.order,
            getRoomTags(b.roomId)[tag]?.order,
        ),
    );
    const list = tagged.map((r) => r.roomId).filter((id) => id !== roomId);
    let insertAt: number;
    if (beforeId === null) insertAt = 0;
    else if (afterId === null) insertAt = list.length;
    else {
        const idx = list.indexOf(beforeId);
        insertAt = idx === -1 ? list.length : idx + 1;
    }
    list.splice(insertAt, 0, roomId);

    const orders = rebalancedNumbers(list.length);
    // Snapshot the orders we are about to overwrite so a mid-loop failure can
    // be rolled back instead of leaving the section half-renumbered.
    const originalOrders = list.map(
        (id) => getRoomTags(id)[tag]?.order as number | string | undefined,
    );
    let appliedCount = 0;
    try {
        for (let i = 0; i < list.length; i++) {
            await setRoomTag(list[i], tag, orders[i]);
            appliedCount = i + 1;
        }
    } catch (e) {
        for (const op of tagOrderRollback(list, originalOrders, appliedCount)) {
            // Best-effort: a failed rollback write is logged, not thrown — the
            // original error is what the caller must see.
            try {
                await setRoomTag(op.roomId, tag, op.order);
            } catch (rollbackErr) {
                console.error("Failed to roll back tag order", rollbackErr);
            }
        }
        throw e;
    }
}

// Whether a timeline event should render as a message in the main timeline.
// Shared by the live timeline (getTimelineMessages) and the jump-to-message
// context window (getContextWindowEvents) so both show exactly the same events.
// Debug mode (showAllEvents) surfaces every event — state, edits, redacted,
// reactions — instead of just renderable messages.
function isRenderableTimelineEvent(e: MatrixEvent): boolean {
    if (settingsState.showAllEvents) return true;
    if (e.isRedacted()) return false;
    if (
        e.getType() !== "m.room.message" &&
        e.getType() !== "m.sticker" &&
        // Keep still-encrypted (undecryptable) events visible as UTD
        // placeholders instead of silently dropping them. A *decrypted*
        // event already reports its cleartext type and passes above.
        e.getType() !== "m.room.encrypted" &&
        !isPollStartEventType(e.getType()) &&
        !isCallEventType(e.getType())
    )
        return false;
    const rel = e.getContent()?.["m.relates_to"];
    if (rel?.rel_type === "m.replace") return false;
    // Divert thread replies out of the main timeline (Element behaviour).
    // With threadSupport on the SDK already does this; the clause is the ⚑4
    // backstop against out-of-order Conduit delivery. Read the ORIGINAL
    // content so an edited reply is still recognised as a thread reply.
    if (
        !belongsToMainTimeline({
            relatesTo: e.getOriginalContent()?.["m.relates_to"],
            eventId: e.getId() ?? "",
        })
    )
        return false;
    return true;
}

function toCallEventInputBasic(e: MatrixEvent): CallEventInput {
    return {
        eventId: e.getId() ?? "",
        type: e.getType(),
        sender: e.getSender() ?? "",
        stateKey: e.getStateKey(),
        ts: e.getTs(),
        content: (e.getContent() ?? {}) as Record<string, unknown>,
    };
}

// A call worth a card: it rang or someone joined. A leave-only session (join
// scrolled off the loaded window) is not surfaced.
function isCallSummaryRenderable(s: CallSummary): boolean {
    return s.notified || s.participants.length > 0;
}

// Collapse each call's many events (joins/leaves/rings) down to the single
// anchor event that carries its summary card. Non-call events pass through
// untouched and in order. Shared by the live timeline and the jump-to context
// window so both show the same rows.
function collapseCallEvents(events: MatrixEvent[]): MatrixEvent[] {
    if (settingsState.showAllEvents) return events;
    const callInputs = events
        .filter((e) => isCallEventType(e.getType()))
        .map(toCallEventInputBasic);
    if (callInputs.length === 0) return events;
    const anchors = new Set(
        summariseCallEvents(callInputs)
            .filter(isCallSummaryRenderable)
            .map((s) => s.anchorEventId),
    );
    return events.filter(
        (e) => !isCallEventType(e.getType()) || anchors.has(e.getId() ?? ""),
    );
}

// Drop pending echoes the server already has (see utils/pendingEchoes): a SENT
// echo whose real copy reached the timeline without a matching transaction_id,
// or one restored from localStorage as NOT_SENT after the app was killed
// mid-send. Left alone they render as "failed" and collide with the real event
// on its id. removePendingEvent (not cancelPendingEvent, whose CANCELLED path
// also removes the REAL event from the timeline by the shared id) also rewrites
// the persisted pending list, so the stale echo does not come back on reload.
function pruneDeliveredEchoes(room: Room): void {
    const pending = room.getPendingEvents();
    if (pending.length === 0) return;
    for (const echo of pending) {
        const id = echo.getId();
        const verdict = classifyPendingEcho({
            id,
            status: echo.status,
            inTimeline:
                !isLocalEchoId(id) &&
                !!room.getUnfilteredTimelineSet().findEventById(id!),
        });
        if (verdict === "drop") room.removePendingEvent(id!);
    }
}

/**
 * The live timeline plus the older timelines the SDK has linked behind it,
 * oldest first. A gappy (limited) sync — routine in busy rooms like
 * #matrix:matrix.org — replaces the live timeline with a fresh short one and
 * parks everything before it in a separate timeline. Back-paginating the new
 * live timeline into an event that timeline already holds makes the SDK link
 * the two and carry on filling the OLDER one, so reading the live timeline
 * alone loses the whole pre-gap history and every page loaded after the join.
 */
function liveTimelineChain(room: Room): EventTimeline[] {
    const chain: EventTimeline[] = [];
    const seen = new Set<EventTimeline>();
    let tl: EventTimeline | null = room.getLiveTimeline();
    while (tl && !seen.has(tl)) {
        seen.add(tl);
        chain.unshift(tl);
        tl = tl.getNeighbouringTimeline(EventTimeline.BACKWARDS);
    }
    return chain;
}

function liveChainEvents(room: Room): MatrixEvent[] {
    return liveTimelineChain(room).flatMap((tl) => tl.getEvents());
}

export function getTimelineMessages(room: Room): MatrixEvent[] {
    pruneDeliveredEchoes(room);
    const timeline = collapseCallEvents(
        liveChainEvents(room).filter(isRenderableTimelineEvent),
    );
    const timelineIds = new Set(timeline.map((e) => e.getId()));
    // Include pending (local echo) events. Keep NOT_SENT echoes so the user
    // can see a failed send and retry/delete it (see resendMessage /
    // deleteFailedMessage); only drop ones already cancelled, and never one
    // whose id the timeline already renders (a duplicate key would throw in
    // MessageArea's keyed {#each} and blank the whole room).
    const pending = room
        .getPendingEvents()
        .filter(
            (e) =>
                isRenderableTimelineEvent(e) &&
                e.status !== EventStatus.CANCELLED &&
                !timelineIds.has(e.getId()),
        );
    return dedupeById([...timeline, ...pending], (e) => e.getId());
}

/** Whether `eventId` is in the room's live timeline (or is one of our pending
 *  echoes) — i.e. the normal live view can show it without a context window. */
export function isInLiveTimeline(room: Room, eventId: string): boolean {
    return (
        liveChainEvents(room).some((e) => e.getId() === eventId) ||
        room.getPendingEvents().some((e) => e.getId() === eventId)
    );
}

export function getLatestTimelineEvent(room: Room): MatrixEvent | undefined {
    const timeline = room.getLiveTimeline().getEvents();
    return timeline[timeline.length - 1];
}

// ── Threads (SDK-native) ──
// Thread replies (m.thread relations) are routed by matrix-js-sdk into per-thread
// Thread timelines (threadSupport is on) and no longer appear inline in the main
// timeline. These wrappers read room.getThread(rootId) and keep their original
// {count,latestEventId,latestTs} / () => void shapes so ThreadPanel and
// MessageItem are unaffected.

function eventThreadRoot(event: MatrixEvent): string | null {
    const rel = event.getOriginalContent()?.["m.relates_to"];
    return rel?.rel_type === "m.thread" ? (rel.event_id ?? null) : null;
}

/** Root event id of a thread reply, or null when the event is not an m.thread reply. */
export function getEventThreadRootId(event: MatrixEvent): string | null {
    return eventThreadRoot(event);
}

export function getThreadMessages(
    room: Room,
    rootEventId: string,
): MatrixEvent[] {
    const belongs = (e: MatrixEvent) =>
        isThreadReplyContent({
            type: e.getType(),
            isRedacted: e.isRedacted(),
            relatesTo: e.getOriginalContent()?.["m.relates_to"],
            rootEventId,
        });
    // SDK-native: the per-thread timeline. Thread.events includes the root as
    // its first element; `belongs` (isThreadReplyContent) filters it out along
    // with redacted/non-message events, so the shape matches the old walk
    // (replies only; the root is rendered separately in ThreadPanel's header).
    const thread = room.getThread(rootEventId);
    const threadEvents = (thread?.events ?? []).filter(belongs);
    const seen = new Set(threadEvents.map((e) => e.getId()));
    // Local echoes may live on room.getPendingEvents() rather than Thread.events
    // depending on pending-event ordering; union them in, de-duped by id.
    const pending = room
        .getPendingEvents()
        .filter(
            (e) =>
                belongs(e) &&
                e.status !== EventStatus.CANCELLED &&
                !seen.has(e.getId()),
        );
    return [...threadEvents, ...pending];
}

export function getThreadSummary(
    room: Room,
    rootEventId: string,
): ThreadSummary {
    const thread = room.getThread(rootEventId);
    if (!thread) {
        // No SDK Thread yet (a genuine zero-reply root, or replies not yet
        // aggregated): getThreadMessages returns pending local echoes only
        // (thread replies no longer live in the main timeline), so count is 0
        // until the SDK builds the Thread and ThreadEvent/Timeline refires.
        const messages = getThreadMessages(room, rootEventId);
        const latest = messages[messages.length - 1] ?? null;
        return summarizeThread({
            length: messages.length,
            latestEventId: latest?.getId() ?? null,
            latestTs: latest?.getTs() ?? 0,
        });
    }
    const latest = thread.replyToEvent ?? null;
    return summarizeThread({
        length: thread.length,
        latestEventId: latest?.getId() ?? null,
        latestTs: latest?.getTs() ?? 0,
    });
}

export async function sendThreadReply(
    roomId: string,
    rootEventId: string,
    text: string,
    mentions?: { user_ids?: string[]; room?: boolean },
    formattedText?: string, // NEW: complete formatted_body (md + mentions + emoji), pre-built by caller
    // Plugin outgoing content transforms: run over the fully-built reply
    // content (thread relation included), right before the send.
    transformContent?: (
        content: Record<string, unknown>,
    ) => Record<string, unknown>,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const room = matrixClient.getRoom(roomId);
    const latestEventId =
        (room && getThreadSummary(room, rootEventId).latestEventId) ||
        rootEventId;
    let resolvedFormatted = formattedText;
    if (resolvedFormatted === undefined) {
        const { formattedBody, hasFormatting } = parseMarkdown(text);
        resolvedFormatted = hasFormatting ? formattedBody : undefined;
    }
    const content = buildThreadReplyContent({
        rootEventId,
        latestEventId,
        text,
        formattedText: resolvedFormatted,
        mentions,
    });
    const outgoing = transformContent
        ? transformContent(content as unknown as Record<string, unknown>)
        : content;
    // 2-arg form only (⚑2 — the threadId overload mangles $-prefixed strings).
    await matrixClient.sendMessage(roomId, outgoing as never);
}

/**
 * Resolve the m.thread relation params for decorating a NON-text send (file,
 * sticker, emote) so it lands in the thread rooted at `rootEventId`. Mirrors
 * sendThreadReply's latest-event resolution (is_falling_back reply pointer).
 */
export function threadRelationParams(
    roomId: string,
    rootEventId: string,
): { rootEventId: string; latestEventId?: string } {
    const room = matrixClient?.getRoom(roomId) ?? undefined;
    const latestEventId =
        (room && getThreadSummary(room, rootEventId).latestEventId) ||
        rootEventId;
    return { rootEventId, latestEventId };
}

/** Paginate older replies in a thread's own timeline. Returns whether more
 * events were fetched. No-op (false) if the SDK Thread isn't built yet. */
export async function paginateThreadBack(
    room: Room,
    rootEventId: string,
): Promise<boolean> {
    if (!matrixClient) return false;
    const thread = room.getThread(rootEventId);
    if (!thread) return false;
    return matrixClient.paginateEventTimeline(thread.liveTimeline, {
        backwards: true,
        limit: 30,
    });
}

// Fires when a thread reply, an edit, or a redaction lands on a timeline, so an
// open ThreadPanel can re-read. Broad + room-agnostic by design (the panel
// re-derives from its own root). Subscribes at the CLIENT level on
// RoomEvent.Timeline: a reply added to a Thread's timeline re-emits
// RoomEvent.Timeline up through the Thread -> Room -> client, whereas
// ThreadEvent.* is NOT bridged to the client re-emitter (so binding it here
// would silently never fire).
export function onThreadEvent(callback: () => void): () => void {
    if (!matrixClient) return () => {};
    const handler = (event: MatrixEvent) => {
        const isThread = eventThreadRoot(event) !== null;
        const relType = event.getContent()?.["m.relates_to"]?.rel_type;
        const isEdit = relType === "m.replace";
        const isRedaction = event.getType() === "m.room.redaction";
        if (isThread || isEdit || isRedaction) callback();
    };
    matrixClient.on(RoomEvent.Timeline, handler as never);
    return () => matrixClient?.off(RoomEvent.Timeline, handler as never);
}

/** Plain body text of an event's content, or "" when absent/non-string. */
function eventBodyText(e: MatrixEvent | null | undefined): string {
    const body = e?.getContent()?.body;
    return typeof body === "string" ? body : "";
}

/**
 * Map the room's SDK `Thread` objects to a plain view model so components never
 * touch `Thread` directly. Previews are the raw bodies; `buildThreadListItems`
 * shapes + sorts them.
 */
export function getRoomThreads(room: Room): ThreadInfo[] {
    return room.getThreads().map((thread): ThreadInfo => {
        const root = thread.rootEvent;
        const latest = thread.replyToEvent;
        return {
            rootId: thread.id,
            rootSenderId: root?.getSender() ?? null,
            rootPreview: eventBodyText(root),
            replyCount: thread.length,
            latestTs: latest?.getTs() ?? root?.getTs() ?? 0,
            latestPreview: eventBodyText(latest),
            participated: thread.hasCurrentUserParticipated,
            unreadTotal:
                room.getThreadUnreadNotificationCount(
                    thread.id,
                    NotificationCountType.Total,
                ) ?? 0,
            unreadHighlight:
                room.getThreadUnreadNotificationCount(
                    thread.id,
                    NotificationCountType.Highlight,
                ) ?? 0,
        };
    });
}

export async function ensureThreadsLoaded(room: Room): Promise<void> {
    // Populate room.getThreads(). fetchRoomThreads() is what actually fetches +
    // builds the Thread objects; createThreadsTimelineSets() only creates the
    // (initially empty) All/My sets the fetch writes into. Both are idempotent
    // (fetchRoomThreads no-ops once threadsReady). fetchRoomThreads internally
    // feature-detects Thread.hasServerSideListSupport (⚑5): with the MSC3856
    // list endpoint it pages the server list; without it (continuwuity/tuwunel)
    // it falls back to a client-side m.thread-relation scan. On failure this
    // REJECTS so the caller can surface it (toast + retry, F6) instead of
    // silently showing an empty thread list; the UI still degrades to
    // sync-known threads because getRoomThreads reads room.getThreads(), which
    // sync populates independently of this fetch.
    if (!matrixClient?.supportsThreads()) return;
    await room.createThreadsTimelineSets();
    await room.fetchRoomThreads();
}

/**
 * Subscribe to thread lifecycle changes for a room so the threads list can
 * re-read. ThreadEvent.* is emitted on the Room instance (but NOT bridged to
 * the MatrixClient re-emitter — see onThreadEvent), so we bind on the room,
 * scoped to it. Returns a () => void unsubscribe.
 */
export function onThreadsUpdated(room: Room, callback: () => void): () => void {
    const handler = () => callback();
    room.on(ThreadEvent.New, handler);
    room.on(ThreadEvent.Update, handler);
    room.on(ThreadEvent.Delete, handler);
    return () => {
        room.off(ThreadEvent.New, handler);
        room.off(ThreadEvent.Update, handler);
        room.off(ThreadEvent.Delete, handler);
    };
}

/** Per-thread unread notification count (default: total, use Highlight for mentions). */
export function getThreadUnread(
    room: Room,
    threadId: string,
    type?: NotificationCountType,
): number {
    return room.getThreadUnreadNotificationCount(threadId, type) ?? 0;
}

/** Whether the room has ANY unread thread notification (SDK aggregate). */
export function roomHasThreadUnread(room: Room): boolean {
    return room.hasThreadUnreadNotification();
}

/**
 * Whether the current user participates in a thread — used to gate thread-reply
 * notifications. `Thread.hasCurrentUserParticipated` is only populated from the
 * server bundled relationship (absent on servers without server-side thread
 * support, e.g. continuwuity/tuwunel), so also treat authoring the root or any
 * loaded reply as participation.
 */
export function isThreadParticipant(room: Room, rootEventId: string): boolean {
    const me = matrixClient?.getUserId();
    if (!me) return false;
    const thread = room.getThread(rootEventId);
    if (!thread) return false;
    if (thread.hasCurrentUserParticipated) return true;
    if (thread.rootEvent?.getSender() === me) return true;
    return (thread.events ?? []).some((e) => e.getSender() === me);
}

/**
 * Send a THREADED read receipt for a thread, clearing only that thread's unread
 * (⚑6). The SDK reads the thread id from the event and scopes the receipt to it
 * (unthreaded defaults false; threadSupport is on). Deliberately does NOT call
 * setRoomReadMarkers — main-timeline unread stays independent of thread unread.
 */
export async function markThreadRead(
    room: Room,
    threadId: string,
): Promise<void> {
    if (!matrixClient) return;
    const thread = room.getThread(threadId);
    if (!thread) return;
    const latest = thread.replyToEvent ?? thread.rootEvent;
    if (!latest) return;
    // Idempotence guard: sendReadReceipt SYNCHRONOUSLY synthesizes a local
    // receipt and fires every receipt listener (bumpUnreadTick + notification
    // clearing) before the HTTP call. Re-sending for an already-read latest
    // event turns any reactive caller into an infinite receipt loop
    // (effect_update_depth_exceeded, froze the whole ThreadPanel) and spams
    // the server. The synthesized receipt counts here, so this trips right
    // after the first send.
    const ownUserId = matrixClient.getUserId();
    if (ownUserId && thread.getEventReadUpTo(ownUserId) === latest.getId())
        return;
    const receiptType = receiptTypeForSetting(
        settingsState.privateReadReceipts,
    ) as ReceiptType;
    await matrixClient.sendReadReceipt(latest, receiptType);
}

/** Share a static location as an m.location event (MSC3488). */
export async function sendLocation(
    roomId: string,
    loc: { lat: number; lon: number; description?: string },
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    await matrixClient.sendMessage(roomId, buildLocationContent(loc) as never);
}

// ── Live location (beacons, MSC3672) ─────────────────────────────────────────

/** Start a live-location beacon (m.beacon_info state event, live:true). One per user per room. */
export async function startLiveBeacon(
    roomId: string,
    timeoutMs: number,
    description?: string,
): Promise<{ beaconInfoEventId: string }> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const res = await matrixClient.unstable_createLiveBeacon(
        roomId,
        ContentHelpers.makeBeaconInfoContent(timeoutMs, true, description),
    );
    return { beaconInfoEventId: res.event_id };
}

/** Stop our own live share by rewriting the beacon_info with live:false,
 *  preserving the original timeout/description. No-op ONLY when we neither have
 *  an own live beacon in room state NOR a `knownBeaconInfoId` from an active
 *  share (see below). `unstable_setLiveBeacon` targets the state_key = our
 *  user id, so it stops our beacon whether or not the `Beacon` model exists in
 *  currentState yet. */
export async function stopLiveBeacon(
    roomId: string,
    knownBeaconInfoId?: string | null,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const room = matrixClient.getRoom(roomId);
    const me = matrixClient.getUserId();
    if (!room || !me) return;
    const own = Array.from(room.currentState?.beacons?.values() ?? []).find(
        (b) => b.beaconInfoOwner === me && b.isLive,
    );
    // Distinguish "genuinely never shared here" (no-op is correct — don't
    // fabricate a spurious live:false) from "we DID start a share whose
    // beacon_info hasn't synced into currentState yet" (the race right after
    // startLiveBeacon resolves — we MUST still write live:false or the server
    // keeps broadcasting our last position until the beacon times out). A
    // known beacon_info id from the store proves the latter.
    if (!shouldWriteStopBeacon(!!own, knownBeaconInfoId)) return;
    const timeout = own?.beaconInfo?.timeout ?? 3600000;
    const description = own?.beaconInfo?.description;
    await matrixClient.unstable_setLiveBeacon(
        roomId,
        ContentHelpers.makeBeaconInfoContent(timeout, false, description),
    );
}

/** Post one m.beacon position update (m.reference to the beacon_info event). */
export async function sendLiveBeaconLocation(
    roomId: string,
    beaconInfoEventId: string,
    lat: number,
    lon: number,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const geoUri = `geo:${lat},${lon}`;
    await matrixClient.sendEvent(
        roomId,
        M_BEACON.name as never,
        ContentHelpers.makeBeaconContent(
            geoUri,
            Date.now(),
            beaconInfoEventId,
        ) as never,
    );
}

/** All Beacon models currently tracked in the room's state. */
export function getRoomBeacons(room: Room): Beacon[] {
    return Array.from(room.currentState?.beacons?.values() ?? []);
}

/** PL gate: may the current user send a beacon_info state event here? */
export function canShareLiveBeacon(room: Room): boolean {
    const me = matrixClient?.getUserId();
    if (!me) return false;
    return (
        room.currentState?.maySendStateEvent(M_BEACON_INFO.name, me) ?? false
    );
}

/** Subscribe to beacon lifecycle changes across all rooms. Calls monitorLiveness()
 *  on newly-seen beacons so expiry drives LivenessChange. Returns an unsubscribe. */
export function onBeaconUpdate(callback: () => void): () => void {
    if (!matrixClient) return () => {};
    const onNew = (_event: MatrixEvent, beacon: Beacon) => {
        beacon.monitorLiveness();
        callback();
    };
    const onAny = () => callback();
    matrixClient.on(BeaconEvent.New as never, onNew as never);
    matrixClient.on(BeaconEvent.Update as never, onAny as never);
    matrixClient.on(BeaconEvent.LivenessChange as never, onAny as never);
    matrixClient.on(BeaconEvent.LocationUpdate as never, onAny as never);
    matrixClient.on(BeaconEvent.Destroy as never, onAny as never);
    // BeaconEvent.New only fires for beacons seen AFTER subscribing. Sweep the
    // beacons already in room state (from initial sync) so their expiry drives
    // LivenessChange too — otherwise a pre-subscription share never expires.
    for (const room of matrixClient.getRooms()) {
        for (const beacon of room.currentState?.beacons?.values() ?? []) {
            beacon.monitorLiveness();
        }
    }
    return () => {
        matrixClient?.off(BeaconEvent.New as never, onNew as never);
        matrixClient?.off(BeaconEvent.Update as never, onAny as never);
        matrixClient?.off(BeaconEvent.LivenessChange as never, onAny as never);
        matrixClient?.off(BeaconEvent.LocationUpdate as never, onAny as never);
        matrixClient?.off(BeaconEvent.Destroy as never, onAny as never);
    };
}

/** Our own currently-live beacons across all joined rooms (for share auto-resume after reload). */
export function getOwnLiveBeacons(): {
    roomId: string;
    beaconInfoEventId: string;
    expiresAt: number;
}[] {
    if (!matrixClient) return [];
    const me = matrixClient.getUserId();
    if (!me) return [];
    const out: {
        roomId: string;
        beaconInfoEventId: string;
        expiresAt: number;
    }[] = [];
    for (const room of matrixClient.getRooms()) {
        for (const b of room.currentState?.beacons?.values() ?? []) {
            if (b.beaconInfoOwner === me && b.isLive) {
                const info = b.beaconInfo;
                const timeout = info?.timeout ?? 0;
                const startTs = info?.timestamp ?? Date.now();
                out.push({
                    roomId: room.roomId,
                    beaconInfoEventId: b.beaconInfoId,
                    expiresAt: startTs + timeout,
                });
            }
        }
    }
    return out;
}

export async function sendTextMessage(
    roomId: string,
    text: string,
): Promise<string> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    // Build the content directly (2-arg sendMessage) so an m.mentions key rides
    // along unconditionally — its presence disables the legacy body-scan push
    // rules on the receiver. A plain text send never carries intentional
    // mentions (those route through sendFormattedMessage), so it is always {}.
    const res = await matrixClient.sendMessage(roomId, {
        msgtype: "m.text",
        body: text,
        "m.mentions": {},
    } as never);
    return res.event_id;
}

/**
 * Resolve the thread root event id for a quick-reply routing decision. Returns
 * the root id if the event is in a thread, otherwise null. Best-effort: event
 * lookup errors are swallowed and treated as no thread.
 */
export async function resolveQuickReplyThreadRoot(
    roomId: string,
    eventId: string,
): Promise<string | null> {
    try {
        const room = matrixClient?.getRoom(roomId);
        let ev = room ? findEventById(room, eventId) : null;
        if (!ev) {
            ev = await fetchSingleEvent(roomId, eventId);
        }
        if (!ev) return null;
        const wireContent = ev.getWireContent();
        const relatesTo =
            wireContent?.["m.relates_to"] ?? ev.getContent()["m.relates_to"];
        return threadRootForQuickReply(relatesTo);
    } catch {
        return null;
    }
}

/**
 * Send a notification quick-reply (plain text only, from a background action).
 * If eventId is provided, routes the reply to the correct thread (if the event
 * is in one) or the main timeline. Event lookup errors are treated as main
 * timeline. Returns the thread root id if a thread reply was sent.
 */
export async function sendNotificationQuickReply(
    roomId: string,
    text: string,
    eventId?: string | null,
): Promise<{ threadRootId: string | null }> {
    let threadRootId: string | null = null;
    if (eventId) {
        threadRootId = await resolveQuickReplyThreadRoot(roomId, eventId);
    }

    // Same content the composer paths build, but sent through
    // sendOutboxMessage: on failure it cancels the NOT_SENT local echo this
    // send created. A leftover echo would show a phantom failed message next
    // to the restored draft and block every later send in the room ("Event
    // blocked by other events not yet sent").
    let content: Record<string, unknown>;
    if (threadRootId) {
        const room = matrixClient?.getRoom(roomId);
        const latestEventId =
            (room && getThreadSummary(room, threadRootId).latestEventId) ||
            threadRootId;
        const { formattedBody, hasFormatting } = parseMarkdown(text);
        content = buildThreadReplyContent({
            rootEventId: threadRootId,
            latestEventId,
            text,
            formattedText: hasFormatting ? formattedBody : undefined,
        }) as unknown as Record<string, unknown>;
    } else {
        content = { msgtype: "m.text", body: text, "m.mentions": {} };
    }
    await sendOutboxMessage(roomId, content);

    return { threadRootId };
}

/**
 * Send a share (files + optional caption, or text-only) directly without
 * touching the composer's draft/queue/reply state. Bypasses the composer to
 * avoid leaking the user's unsent draft into a share send. Share captions are
 * always plain text (no markdown/mentions) — a share never pings.
 */
export async function sendShare(
    roomId: string,
    share: { caption: string; files: File[] },
    onStepSent?: (i: number) => void,
): Promise<void> {
    const steps = planShareSend(share);

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        if (step.kind === "file") {
            await sendFile(
                roomId,
                step.file,
                step.caption ? { body: step.caption } : undefined,
            );
        } else {
            await sendTextMessage(roomId, step.text);
        }
        onStepSent?.(i);
    }
}

export async function sendFormattedMessage(
    roomId: string,
    body: string,
    formattedBody: string,
    mentions?: { user_ids?: string[]; room?: boolean },
): Promise<string> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const res = await matrixClient.sendMessage(roomId, {
        msgtype: "m.text",
        body,
        format: "org.matrix.custom.html",
        formatted_body: formattedBody,
        "m.mentions": mentions ?? {},
    } as never);
    return res.event_id;
}

/**
 * Send a fully-built message content object for the offline outbox
 * (stores/outbox). 2-arg sendMessage form ONLY (the 3-arg overload treats a
 * $-prefixed string as a thread id — CLAUDE.md landmine). On failure the SDK
 * has synthesized a NOT_SENT local echo; snapshot pending echoes before the
 * send so we cancel ONLY the echo our own send created — never a concurrent
 * file/thread/direct send's failed echo (which would make that other message
 * silently vanish).
 */
export async function sendOutboxMessage(
    roomId: string,
    content: Record<string, unknown>,
): Promise<string> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const room = matrixClient.getRoom(roomId);
    // Snapshot the echoes that already exist so that, on failure, we cancel
    // ONLY the NOT_SENT echo our own send just created — never a concurrent
    // file/thread/direct send's failed echo (which would make that other
    // message silently vanish).
    const before = new Set(
        (room?.getPendingEvents() ?? []).map((e) => e.getId()),
    );
    try {
        const res = await matrixClient.sendMessage(roomId, content as never);
        return res.event_id;
    } catch (err) {
        const pending = matrixClient.getRoom(roomId)?.getPendingEvents() ?? [];
        for (let i = pending.length - 1; i >= 0; i--) {
            const ev = pending[i];
            if (ev.status === EventStatus.NOT_SENT && !before.has(ev.getId())) {
                matrixClient.cancelPendingEvent(ev);
                break;
            }
        }
        throw err;
    }
}

/**
 * Send an `m.emote` ("/me") message. Mirrors sendFormattedMessage but with the
 * emote msgtype; formatted_body + m.mentions ride along when present so markdown
 * and mentions still work inside an emote.
 */
export async function sendEmote(
    roomId: string,
    body: string,
    formattedBody?: string,
    mentions?: { user_ids?: string[]; room?: boolean },
    thread?: { rootEventId: string },
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const content: Record<string, unknown> = {
        msgtype: "m.emote",
        body,
        ...(formattedBody
            ? {
                  format: "org.matrix.custom.html",
                  formatted_body: formattedBody,
              }
            : {}),
        "m.mentions": mentions ?? {},
    };
    const finalContent = thread
        ? withThreadRelation(
              content,
              threadRelationParams(roomId, thread.rootEventId),
          )
        : content;
    await matrixClient.sendMessage(roomId, finalContent as never);
}

/** Forward a message or sticker as a fresh event in another joined room. */
export async function forwardMessage(
    roomId: string,
    event: MatrixEvent,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const eventType = event.getType();
    if (eventType !== "m.room.message" && eventType !== "m.sticker") {
        throw new Error(t("client.thisEventTypeCannotBeForwarded"));
    }
    await matrixClient.sendEvent(
        roomId,
        eventType as never,
        buildForwardContent(event.getContent()) as never,
    );
}

/**
 * Base URL of the homeserver this session is on, or null when signed out.
 * Exposed so the UI can tell homeserver-proxied media (safe to load: the
 * server already knows about the message) apart from third-party media.
 */
export function getHomeserverBaseUrl(): string | null {
    return matrixClient?.getHomeserverUrl() ?? null;
}
/** Register the service worker and send it the current auth credentials. */
// The most recent SET_AUTH payload, so the one-time `controllerchange` listener
// re-hands the CURRENT account's token to a newly-activated worker (first
// install / SW update) — a just-activated worker starts tokenless. Updated by
// initServiceWorker and updateServiceWorkerAuth on every account change.
let latestSwAuthMessage: Record<string, unknown> | null = null;
let swMediaListenersAttached = false;

function attachSwMediaListeners(): void {
    if (swMediaListenersAttached || !("serviceWorker" in navigator)) return;
    swMediaListenersAttached = true;
    // A new controller took over (first install / SW update) — hand it the token
    // so its media auth works; a just-activated worker starts tokenless.
    navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (latestSwAuthMessage)
            navigator.serviceWorker.controller?.postMessage(
                latestSwAuthMessage,
            );
        probeSwMediaAuth();
    });
    navigator.serviceWorker.addEventListener("message", (e) => {
        const data = e.data as {
            type?: string;
            hasToken?: boolean;
            activated?: boolean;
        } | null;
        if (data?.type === "MEDIA_AUTH_READY") {
            if (!swMediaAuth.ready)
                logSync("service worker: media auth ready (broadcast)");
            markSwMediaReady();
        } else if (data?.type === "MEDIA_AUTH_STATUS") {
            clearTimeout(swStatusTimer);
            logSync(
                `service worker: controls page, token ${data.hasToken ? "present" : "MISSING"}, activated ${!!data.activated}`,
            );
            if (data.hasToken) markSwMediaReady();
        }
    });
}

let swStatusTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Ask the controlling worker whether it can add the token to media requests,
 * and record the answer in the debug log. Until it says yes, media is fetched
 * directly (see swMediaAuth), so this also decides when <img>s may go through
 * the worker again.
 */
function probeSwMediaAuth(): void {
    const controller = navigator.serviceWorker.controller;
    if (!controller) {
        logSync("service worker: page NOT controlled, media fetched directly");
        return;
    }
    clearTimeout(swStatusTimer);
    swStatusTimer = setTimeout(
        () => logSync("service worker: no reply to media status"),
        5000,
    );
    controller.postMessage({ type: "GET_MEDIA_AUTH_STATUS" });
}

export async function initServiceWorker(): Promise<void> {
    // Heal broken authenticated media WITHOUT the SW (a hard reload leaves the
    // page uncontrolled, so the SW can't help) by re-fetching with the token as
    // a blob. Idempotent; install it regardless of SW support.
    installMediaHealer();
    if (!("serviceWorker" in navigator) || !matrixClient) return;
    const token = matrixClient.getAccessToken();
    const hsUrl = matrixClient.getHomeserverUrl();
    // The worker needs to know WHICH device it is before it can read the
    // active-session heartbeat and decide whether to stay quiet. Captured here,
    // alongside the token, rather than after the awaits below: a logout racing
    // registration would null out `matrixClient` and the throw would be
    // swallowed by the catch, leaving the worker with no auth at all. Reading
    // both up front also guarantees the identity matches the token we send.
    const uid = matrixClient.getUserId() ?? undefined;
    const devId = matrixClient.getDeviceId() ?? undefined;
    if (!token || !hsUrl) return;
    const authMsg = {
        type: "SET_AUTH",
        accessToken: token,
        homeserverUrl: hsUrl,
        userId: uid,
        deviceId: devId,
    };
    const notifMsg = {
        type: "SET_NOTIF_PRIVACY",
        hideBody: settingsState.hideNotificationBody,
    };
    // The per-account private-read-receipts mirror is NOT posted here: this
    // runs before AppShell's reloadAccountSettings(), so the value would be the
    // unscoped default and could land after AppShell's correct one (fail open).
    // AppShell posts it (updateServiceWorkerReceiptPrivacy) once settings load.
    latestSwAuthMessage = authMsg;
    attachSwMediaListeners();
    try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
            scope: "/",
        });
        // Hand the token to whatever worker exists RIGHT NOW instead of awaiting
        // navigator.serviceWorker.ready first: `ready` blocks until install
        // finishes (which includes the shell precache), and authenticated <img>s
        // render meanwhile — the "broken images until a manual reload" report.
        // The SW's message handler is live from first evaluation, so an
        // installing worker records the token and uses it the moment it activates.
        const early = reg.installing || reg.waiting || reg.active;
        early?.postMessage(authMsg);
        early?.postMessage(notifMsg);
        // A worker restored from an earlier launch already controls us and
        // already has the token: ask now rather than after `ready`.
        probeSwMediaAuth();
        // Deliver again once fully active in case a later worker became the
        // controller, and — if it already controls us — flag media as ready even
        // if the broadcast was missed.
        const ready = await navigator.serviceWorker.ready;
        ready.active?.postMessage(authMsg);
        ready.active?.postMessage(notifMsg);
    } catch (e) {
        console.error("[SW] registration failed", e);
    }
}

/**
 * Send updated auth credentials to an already-registered service worker.
 * `accessToken` overrides the client's own: a refresh callback fires before
 * the SDK swaps its stored token in.
 */
export function updateServiceWorkerAuth(accessToken?: string): void {
    if (!matrixClient) return;
    const token = accessToken ?? matrixClient.getAccessToken();
    const hsUrl = matrixClient.getHomeserverUrl();
    if (!token || !hsUrl) return;
    const authMsg = {
        type: "SET_AUTH",
        accessToken: token,
        homeserverUrl: hsUrl,
        userId: matrixClient?.getUserId() ?? undefined,
        deviceId: matrixClient?.getDeviceId() ?? undefined,
    };
    // Keep the controllerchange re-post on the new account's token.
    latestSwAuthMessage = authMsg;
    navigator.serviceWorker.ready
        .then((reg) => reg.active?.postMessage(authMsg))
        .catch(() => {});
}

/** Tell the service worker to forget the stored access token (on logout). */
export function clearServiceWorkerAuth(): void {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready
        .then((reg) => reg.active?.postMessage({ type: "CLEAR_AUTH" }))
        .catch(() => {});
}

/**
 * Ask the service worker to take its notifications down without touching its
 * stored credentials — the account-switch case, where the next account's boot
 * re-sends SET_AUTH and a CLEAR_AUTH in between would just race it.
 *
 * Synchronous and void-returning on purpose: this is registered as a
 * notification surface, and the registry can only isolate a SYNCHRONOUS throw.
 * A returned promise would sail past its try/catch, so the rejection is
 * swallowed here instead.
 */
export function clearServiceWorkerNotifications(): void {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready
        .then((reg) => reg.active?.postMessage({ type: "CLEAR_NOTIFICATIONS" }))
        .catch(() => {});
}

/**
 * Mirror the device-global "hide message text in notifications" setting into
 * the service worker. The SW has no localStorage, so it keeps its own copy in
 * IndexedDB; a push wake-up reads that copy.
 */
export function updateServiceWorkerNotificationPrivacy(hide: boolean): void {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready
        .then((reg) =>
            reg.active?.postMessage({
                type: "SET_NOTIF_PRIVACY",
                hideBody: hide,
            }),
        )
        .catch(() => {});
}

/**
 * Mirror the account's "Ring for incoming DM calls" setting into the service
 * worker, so a pushed DM call rings (or shows quietly) to match the app.
 */
export function updateServiceWorkerRingEnabled(enabled: boolean): void {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready
        .then((reg) =>
            reg.active?.postMessage({ type: "SET_RING_ENABLED", enabled }),
        )
        .catch(() => {});
}

/**
 * Mirror the per-user "private read receipts" setting into the service worker.
 * The SW has no localStorage, so it keeps its own copy in IndexedDB; a quick
 * mark-read action from a notification reads that copy to decide which receipt
 * type to send.
 */
export function updateServiceWorkerReceiptPrivacy(
    userId: string,
    isPrivate: boolean,
): void {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready
        .then((reg) =>
            reg.active?.postMessage({
                type: "SET_RECEIPT_PRIVACY",
                userId,
                private: isPrivate,
            }),
        )
        .catch(() => {});
}

export interface UrlPreview {
    title?: string;
    description?: string;
    imageUrl?: string;
    /** Intrinsic image dimensions (og:image:width/height), to reserve layout space. */
    imageWidth?: number;
    imageHeight?: number;
    videoUrl?: string;
    /** Poster frame for a video preview, shown before the video is loaded. */
    videoThumbnailUrl?: string;
    /** Intrinsic video dimensions (og:video:width/height), for poster aspect ratio. */
    videoWidth?: number;
    videoHeight?: number;
    siteName?: string;
    canonicalUrl?: string;
    /** MIME type or og:type returned by the homeserver preview (e.g. "video/mp4") */
    contentType?: string;
}

/** Returns the raw homeserver URL preview response object, useful for debugging. */
export async function getRawUrlPreview(
    url: string,
): Promise<Record<string, unknown> | null> {
    if (!matrixClient) return null;
    try {
        // matrix-js-sdk >=41.1 routes this through the authenticated media
        // endpoint (`/_matrix/client/v1/media/preview_url`) when the server
        // advertises Matrix 1.11, falling back to the legacy path otherwise.
        return (await matrixClient.getUrlPreview(url, Date.now())) as Record<
            string,
            unknown
        >;
    } catch (e) {
        return { error: String(e) };
    }
}

export async function getUrlPreview(url: string): Promise<UrlPreview | null> {
    if (!matrixClient) return null;
    try {
        const data = await matrixClient.getUrlPreview(url, Date.now());
        const ogImage = data["og:image"] as string | undefined;
        // Only surface homeserver-rehosted (mxc://) preview media. A raw non-mxc
        // og:image/og:video is attacker-chosen and would point an <img>/<video> at
        // an off-homeserver host zero-click (SEC-M1 sub-case b), so drop it — the
        // homeserver preview text/card still renders.
        const imageUrl = isMxcPreviewMedia(ogImage)
            ? (mxcToHttp(ogImage) ?? undefined)
            : undefined;
        const rawVideo = (data["og:video:secure_url"] ??
            data["og:video:url"] ??
            data["og:video"]) as string | undefined;
        const videoUrl = isMxcPreviewMedia(rawVideo)
            ? (mxcToHttp(rawVideo) ?? undefined)
            : undefined;
        // Poster for the video: an explicit og:image, or nothing. We do NOT
        // fall back to thumbnailing the video's own mxc — continuwuity answers
        // /media/thumbnail for a video with the ORIGINAL file (200 video/mp4),
        // so the <img>/poster would download the whole video and the element's
        // onerror fires far too late to prevent it. With no poster the preview
        // renders the <video> itself at preload="metadata", which is cheap.
        const videoThumbnailUrl = videoUrl ? imageUrl : undefined;
        const parseDim = (v: unknown): number | undefined => {
            const n = Number(v);
            return Number.isFinite(n) && n > 0 ? n : undefined;
        };
        return {
            title: data["og:title"] as string | undefined,
            description: data["og:description"] as string | undefined,
            imageUrl,
            imageWidth: parseDim(data["og:image:width"]),
            imageHeight: parseDim(data["og:image:height"]),
            videoUrl,
            videoThumbnailUrl,
            videoWidth: parseDim(data["og:video:width"]),
            videoHeight: parseDim(data["og:video:height"]),
            siteName: data["og:site_name"] as string | undefined,
            // Some previews return an empty og:url — fall back to the source URL.
            canonicalUrl: (data["og:url"] as string | undefined) || url,
            contentType: data["og:type"] as string | undefined,
        };
    } catch {
        return null;
    }
}

export function getOwnUserId(): string | null {
    return matrixClient?.getUserId() ?? null;
}

/**
 * Does this event personally concern the user — a mention, a reply to them,
 * @room, or a keyword — and so warrant the timeline highlight?
 *
 * Named for the `highlight` push tweak it reads, NOT for sound: the previous
 * name (`isLoudEvent`) invited exactly the conflation that highlighted every
 * message in a DM, where the default rule sets sound but no highlight.
 */
export function isHighlightEvent(event: MatrixEvent): boolean {
    if (!matrixClient) return false;
    if (event.getSender() === matrixClient.getUserId()) return false;
    try {
        const actions = matrixClient.getPushActionsForEvent(event);
        return !!(actions?.notify && isHighlightAction(actions));
    } catch {
        return false;
    }
}

export async function fetchServerNotifications(
    limit = 50,
    from?: string,
): Promise<ServerNotificationResult> {
    if (!matrixClient)
        return { status: "error", error: new Error(t("client.notConnected")) };
    return fetchServerNotificationsForClient(matrixClient, limit, from);
}

export function getOwnAvatarUrl(): string | null {
    const userId = matrixClient?.getUserId();
    if (!userId) return null;
    const mxc = matrixClient?.getUser(userId)?.avatarUrl;
    return mxcToHttp(mxc);
}

// ── Own profile ────────────────────────────────────────────────────────────

export function getOwnDisplayName(): string | null {
    const userId = matrixClient?.getUserId();
    if (!userId) return null;
    return matrixClient?.getUser(userId)?.displayName ?? null;
}

export function getOwnAvatarMxc(): string | null {
    const userId = matrixClient?.getUserId();
    if (!userId) return null;
    return matrixClient?.getUser(userId)?.avatarUrl ?? null;
}

/**
 * Fetch the logged-in user's profile fresh from the server. `userId` is the
 * account that was asked, captured BEFORE the await: an account switch during
 * the request must not let the caller file this profile under the successor
 * (audit CORE-02).
 */
export async function fetchOwnProfile(): Promise<{
    userId: string | null;
    displayName: string | null;
    avatarMxc: string | null;
}> {
    const userId = matrixClient?.getUserId() ?? null;
    if (!matrixClient || !userId) {
        return { userId: null, displayName: null, avatarMxc: null };
    }
    const profile = await matrixClient.getProfileInfo(userId);
    return {
        userId,
        displayName: profile.displayname ?? null,
        avatarMxc: profile.avatar_url ?? null,
    };
}

export async function setOwnDisplayName(name: string): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    await matrixClient.setDisplayName(name);
}

/** Set (mxc URI) or clear (empty string) the logged-in user's avatar. */
export async function setOwnAvatarMxc(mxc: string): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    await matrixClient.setAvatarUrl(mxc);
}

/**
 * The logged-in user's extended (MSC4133) profile, or null when the server
 * does not support extended profiles.
 */
export async function fetchOwnExtendedProfile(): Promise<Record<
    string,
    unknown
> | null> {
    const userId = matrixClient?.getUserId();
    return userId ? fetchExtendedProfile(userId) : null;
}

/** Any user's extended profile, or null when the server has no support. */
export async function fetchExtendedProfile(
    userId: string,
): Promise<Record<string, unknown> | null> {
    if (!matrixClient) return null;
    if (!(await matrixClient.doesServerSupportExtendedProfiles())) return null;
    return matrixClient.getExtendedProfile(userId);
}

/** Set (value) or delete (null) one extended profile field. */
export async function setOwnProfileField(
    key: string,
    value: unknown | null,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    if (value === null) await matrixClient.deleteExtendedProfileProperty(key);
    else await matrixClient.setExtendedProfileProperty(key, value);
}

// ── Server capabilities ────────────────────────────────────────────────────

export async function getServerVersions(): Promise<{
    versions: string[];
    unstableFeatures: Record<string, boolean>;
}> {
    if (!matrixClient) return { versions: [], unstableFeatures: {} };
    const r = await matrixClient.getVersions();
    return {
        versions: r.versions ?? [],
        unstableFeatures: r.unstable_features ?? {},
    };
}

export async function getServerCapabilities(): Promise<
    Record<string, Record<string, unknown>>
> {
    if (!matrixClient) return {};
    try {
        return (await matrixClient.getCapabilities()) as Record<
            string,
            Record<string, unknown>
        >;
    } catch {
        return {};
    }
}

/**
 * Upgrade a room to `version`. Creates a replacement room, tombstones this one,
 * and auto-joins the caller to the successor. Returns the new room id.
 * Thin wrapper over matrix-js-sdk `upgradeRoom` (2-arg form; additionalCreators
 * intentionally omitted in v1).
 */
export async function upgradeRoomToVersion(
    roomId: string,
    version: string,
): Promise<string> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const { replacement_room } = await matrixClient.upgradeRoom(
        roomId,
        version,
    );
    return replacement_room;
}

/**
 * The homeserver's advertised room-version capability. `default` is the
 * recommended version ("" when unadvertised); `available` is the list of version
 * ids the server offers. Reuses getServerCapabilities (cached, try/catch → {}).
 */
export async function getRoomVersionCapability(): Promise<{
    default: string;
    available: string[];
}> {
    const caps = await getServerCapabilities();
    const cap = caps["m.room_versions"] as
        { default?: string; available?: Record<string, unknown> } | undefined;
    return {
        default: typeof cap?.default === "string" ? cap.default : "",
        available: cap?.available ? Object.keys(cap.available) : [],
    };
}

/**
 * Probe the homeserver's readiness for MatrixRTC group calling (the stack the
 * client actually uses). The legacy `/voip/turnServer` endpoint is NOT probed:
 * MatrixRTC never consults it, and its 404 is ambiguous (a conforming server
 * returns 200 with empty `uris` when TURN is simply unconfigured).
 *
 * - `rtcFoci`: the homeserver advertises at least one SFU focus via the
 *   `org.matrix.msc4143.rtc_foci` key in `.well-known/matrix/client` (reuses
 *   the same well-known fetch the voice-join path uses).
 * - `delayedEvents`: `/versions` `unstable_features` advertises
 *   `org.matrix.msc4140` — delayed events, which let a crashed call's
 *   membership self-expire in ~8s instead of lingering up to ~4h.
 */
export async function probeCallingSupport(): Promise<{
    rtcFoci: boolean;
    delayedEvents: boolean;
}> {
    if (!matrixClient) return { rtcFoci: false, delayedEvents: false };
    const [rtcFoci, delayedEvents] = await Promise.all([
        configuredRtcFoci()
            .then((foci) => foci.length > 0)
            .catch(() => false),
        getServerVersions()
            .then(({ unstableFeatures }) =>
                hasUnstableFeature(unstableFeatures, "org.matrix.msc4140"),
            )
            .catch(() => false),
    ]);
    return { rtcFoci, delayedEvents };
}

// ── Device / session management ─────────────────────────────────────────────

export function getOwnDeviceId(): string | null {
    return matrixClient?.getDeviceId() ?? null;
}

/** Fetch all sessions (devices) the server has recorded for this account. */
export async function getOwnDevices(): Promise<DeviceInfo[]> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const { devices } = await matrixClient.getDevices();
    return devices.map((d) => ({
        deviceId: d.device_id,
        displayName: d.display_name,
        lastSeenIp: d.last_seen_ip,
        lastSeenTs: d.last_seen_ts,
        // Not in the SDK's IMyDevice type since v42, but servers still send it.
        lastSeenUserAgent: (d as { last_seen_user_agent?: string })
            .last_seen_user_agent,
    }));
}

export async function renameDevice(
    deviceId: string,
    name: string,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    await matrixClient.setDeviceDetails(deviceId, { display_name: name });
}

export type DeleteDeviceResult = "deleted" | "password-required";

/**
 * Sign out another session. Servers guard this behind User-Interactive Auth:
 * the first call (without a password) normally comes back
 * "password-required" — call again with the account password to complete it.
 * Throws "Incorrect password" when the server rejects the retry.
 */
export async function deleteOwnDevice(
    deviceId: string,
    password?: string,
): Promise<DeleteDeviceResult> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const userId = matrixClient.getUserId();
    try {
        await matrixClient.deleteDevice(deviceId);
        return "deleted";
    } catch (e) {
        const uia = e as MatrixError;
        const data = (uia.data ?? {}) as {
            session?: string;
            flows?: { stages: string[] }[];
        };
        if (uia.httpStatus !== 401 || !data.flows) throw e;
        if (!supportsPasswordUia(data.flows)) {
            throw new Error(t("client.thisServerDoesNotAllowSigning"));
        }
        if (password === undefined) return "password-required";
        try {
            await matrixClient.deleteDevice(deviceId, {
                type: "m.login.password",
                identifier: { type: "m.id.user", user: userId },
                password,
                session: data.session,
            });
            return "deleted";
        } catch (retryError) {
            if ((retryError as MatrixError).httpStatus === 401) {
                throw new Error(t("client.incorrectPassword"));
            }
            throw retryError;
        }
    }
}

// ── Account security ─────────────────────────────────────────────────────────

/** Prefer the server's own human-readable error string when it sent one. */
function serverErrorMessage(e: unknown): Error {
    const text = ((e as MatrixError).data as { error?: string } | undefined)
        ?.error;
    return text ? new Error(text) : (e as Error);
}

/**
 * Drive a password-guarded User-Interactive Auth dance: probe the endpoint
 * without auth, expect the 401 challenge, then retry completing the single
 * m.login.password stage. Throws "Incorrect password" when the server
 * rejects the retry; other server errors are surfaced verbatim.
 */
async function completeWithPasswordUia(
    attempt: (auth?: AuthDict) => Promise<unknown>,
    password: string,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const userId = matrixClient.getUserId();
    try {
        await attempt(undefined);
        return;
    } catch (e) {
        const uia = e as MatrixError;
        const data = (uia.data ?? {}) as {
            session?: string;
            flows?: { stages: string[] }[];
        };
        if (uia.httpStatus !== 401 || !data.flows) throw serverErrorMessage(e);
        if (!supportsPasswordUia(data.flows)) {
            throw new Error(t("client.thisServerDoesNotAllowConfirming"));
        }
        try {
            await attempt({
                type: "m.login.password",
                identifier: { type: "m.id.user", user: userId },
                password,
                session: data.session,
            });
        } catch (retryError) {
            if ((retryError as MatrixError).httpStatus === 401) {
                throw new Error(t("client.incorrectPassword"));
            }
            throw serverErrorMessage(retryError);
        }
    }
}

/**
 * Change the account password, confirming with the current one via UIA.
 * When `logoutOtherDevices` is set the server signs out every other session
 * (this one survives). Server-side password-policy rejections come back
 * verbatim.
 */
export async function changeAccountPassword(
    currentPassword: string,
    newPassword: string,
    logoutOtherDevices: boolean,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const client = matrixClient;
    await completeWithPasswordUia(
        // setPassword's auth parameter is required by its type, but an
        // undefined auth is dropped by JSON serialization, which is exactly
        // the "no auth yet" probe the UIA dance starts with.
        (auth) =>
            client.setPassword(
                auth as AuthDict,
                newPassword,
                logoutOtherDevices,
            ),
        currentPassword,
    );
}

/**
 * Permanently deactivate the account, optionally asking the server to also
 * erase message contents. Irreversible. Servers may forbid deactivation
 * entirely — that error is surfaced verbatim.
 */
export async function deactivateOwnAccount(
    password: string,
    erase: boolean,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const client = matrixClient;
    await completeWithPasswordUia(
        (auth) => client.deactivateAccount(auth, erase),
        password,
    );
}

export interface ThreePid {
    medium: string; // "email" | "msisdn"
    address: string;
}

/** The email addresses / phone numbers the server has linked to the account. */
export async function getOwnThreePids(): Promise<ThreePid[]> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const { threepids } = await matrixClient.getThreePids();
    return threepids.map((t) => ({ medium: t.medium, address: t.address }));
}

export function getRoomDisplayName(room: Room): string {
    return room.name || room.roomId;
}

export function getMemberName(room: Room, userId: string): string {
    const member = room.getMember(userId);
    return resolveDisplayName(
        {
            userId,
            displayName: member?.rawDisplayName || member?.name,
        },
        { preferId: settingsState.showMatrixIds },
    );
}

/** Like getMemberName but for a RoomMember already in hand (member lists,
 *  profile card). Honors the Show Matrix IDs setting. */
export function memberDisplayName(member: RoomMember): string {
    return resolveDisplayName(
        {
            userId: member.userId,
            displayName: member.rawDisplayName || member.name,
        },
        { preferId: settingsState.showMatrixIds },
    );
}

export function getMemberAvatar(room: Room, userId: string): string | null {
    const mxc = room.getMember(userId)?.getMxcAvatarUrl();
    return mxcToHttp(mxc);
}

export function getRoomMembers(room: Room): RoomMember[] {
    return room.getMembers().filter((m) => m.membership === "join");
}

export async function loadRoomMembersIfNeeded(room: Room): Promise<void> {
    await room.loadMembersIfNeeded();
}

export function getRoomTopic(room: Room): string | null {
    const topicEvent = room
        .getLiveTimeline()
        .getState(EventTimeline.FORWARDS)
        ?.getStateEvents("m.room.topic", "");
    return topicEvent?.getContent()?.topic || null;
}

/** The room's own m.room.avatar, with no fallback. For places that show or
 *  edit the room's actual avatar (room settings, pack editor). */
export function getRoomStateAvatar(room: Room): string | null {
    const avatarEvent = room
        .getLiveTimeline()
        .getState(EventTimeline.FORWARDS)
        ?.getStateEvents("m.room.avatar", "");
    const mxc = avatarEvent?.getContent()?.url;
    return mxcToHttp(mxc);
}

/** The avatar to display for a room: its own avatar, or for a 1:1 room
 *  (DM) without one, the other person's avatar, like Element and Discord. */
export function getRoomAvatar(room: Room): string | null {
    const own = getRoomStateAvatar(room);
    if (own || room.isSpaceRoom()) return own;
    // The SDK only returns a member when there's exactly one other person
    // (bots/functional members excluded), so group rooms keep the fallback.
    const other = room.getAvatarFallbackMember();
    return mxcToHttp(other?.getMxcAvatarUrl());
}

export function getUnreadCount(room: Room): number {
    return room.getUnreadNotificationCount() ?? 0;
}

export function getHighlightCount(room: Room): number {
    return (
        room.getUnreadNotificationCount(NotificationCountType.Highlight) ?? 0
    );
}

const NOTIFICATION_EVENT_TYPES = [
    "m.room.message",
    "m.room.encrypted",
    "m.sticker",
    "org.matrix.msc3381.poll.start",
    "m.poll.start",
];

function isNotificationEvent(event: MatrixEvent): boolean {
    if (!NOTIFICATION_EVENT_TYPES.includes(event.getType())) return false;
    if (event.isRedacted()) return false;
    if (event.getRelation()?.rel_type === "m.replace") return false;
    return true;
}

/** Returns whether the room has any unread messages and whether any are highlights (mentions). */
export function getRoomUnreadInfo(room: Room): {
    unread: boolean;
    highlight: number;
} {
    const highlight = getHighlightCount(room);
    const userId = matrixClient?.getUserId();
    if (!userId) return { unread: false, highlight };

    if (getUnreadCount(room) >= 1) return { unread: true, highlight };

    const liveEvents = room.getLiveTimeline().getEvents();

    // If the last event was sent by us, we're up to date
    if (liveEvents[liveEvents.length - 1]?.getSender() === userId) {
        return { unread: false, highlight };
    }

    const readUpToId = room.getEventReadUpTo(userId);

    // getEventReadUpTo returns null if the receipt points at an event not in
    // the loaded timeline window (SDK rejects it via receiptPointsAtConsistentEvent).
    // In that case, check if a raw receipt exists at all — if yes, the marker
    // is older than our loaded window, meaning all visible events are already
    // read.
    if (!readUpToId) {
        const hasReceipt =
            !!room.getReadReceiptForUserId(userId) ||
            !!room.getReadReceiptForUserId(
                userId,
                false,
                "m.read.private" as any,
            );
        if (hasReceipt) return { unread: false, highlight };
    }

    for (let i = liveEvents.length - 1; i >= 0; i--) {
        const event = liveEvents[i];
        if (!event) return { unread: false, highlight };
        if (event.getId() === readUpToId) return { unread: false, highlight };
        if (isNotificationEvent(event)) return { unread: true, highlight };
    }
    return { unread: false, highlight };
}

export function onTimelineEvent(
    callback: (event: MatrixEvent, room: Room, isLiveAppend: boolean) => void,
): () => void {
    if (!matrixClient) return () => {};
    const handler = (
        event: MatrixEvent,
        room: Room | undefined,
        toStartOfTimeline?: boolean,
        removed?: boolean,
        data?: { liveEvent?: boolean },
    ) => {
        // Ignore scroll-up backfill (toStartOfTimeline) and event removals —
        // neither is a new message. Without this, scroll-up backfill would be
        // treated as new messages and drive false unread bumps/notifications.
        if (toStartOfTimeline || removed) return;
        // `data.liveEvent === false` covers two very different cases:
        //   1. events appended live to the tail (liveEvent === true)
        //   2. events INSERTED into the middle of the live timeline via
        //      insertEventIntoTimeline (thread replies moved to the main
        //      timeline, out-of-order related events) — the SDK hardcodes
        //      liveEvent:false for these even though they are genuinely new.
        // Conduit-family servers (tuwunel/conduwuit) deliver related/threaded
        // events out of order often, so dropping every liveEvent:false event
        // left those mid-timeline messages missing from the view until a full
        // re-read. Forward both; `isLiveAppend` tells consumers which it is so
        // the display can re-read (correct ordering) rather than append.
        const isLiveAppend = data?.liveEvent === true;
        const isReplacement =
            event.getContent()?.["m.relates_to"]?.rel_type === "m.replace";
        const isMainTimeline = belongsToMainTimeline({
            relatesTo: event.getOriginalContent()?.["m.relates_to"],
            eventId: event.getId() ?? "",
        });
        if (
            room &&
            (settingsState.showAllEvents ||
                (!isReplacement &&
                    isMainTimeline &&
                    (event.getType() === "m.room.message" ||
                        event.getType() === "m.sticker" ||
                        isPollStartEventType(event.getType())) &&
                    !event.isRedacted()))
        ) {
            callback(event, room, isLiveAppend);
        }
    };
    matrixClient.on(RoomEvent.Timeline, handler as never);
    return () => matrixClient?.off(RoomEvent.Timeline, handler as never);
}

/**
 * Live thread-REPLY events — the complement of `onTimelineEvent`, which filters
 * m.thread replies out of the main timeline (that subscription also drives the
 * main-timeline display, so it must not forward them). Fires for message /
 * sticker / poll-start replies so the app-shell notification path can surface
 * them; edits (m.replace), redactions and main-timeline events are skipped.
 * `isLiveAppend` mirrors onTimelineEvent's semantics.
 */
export function onThreadReplyEvent(
    callback: (event: MatrixEvent, room: Room, isLiveAppend: boolean) => void,
): () => void {
    if (!matrixClient) return () => {};
    const handler = (
        event: MatrixEvent,
        room: Room | undefined,
        toStartOfTimeline?: boolean,
        removed?: boolean,
        data?: { liveEvent?: boolean },
    ) => {
        if (toStartOfTimeline || removed || !room) return;
        const isLiveAppend = data?.liveEvent === true;
        // Only diverted thread replies (exactly the events onTimelineEvent excludes).
        const isMainTimeline = belongsToMainTimeline({
            relatesTo: event.getOriginalContent()?.["m.relates_to"],
            eventId: event.getId() ?? "",
        });
        if (isMainTimeline) return;
        const isReplacement =
            event.getContent()?.["m.relates_to"]?.rel_type === "m.replace";
        const type = event.getType();
        const isMessage =
            type === "m.room.message" ||
            type === "m.sticker" ||
            isPollStartEventType(type);
        if (!isReplacement && isMessage && !event.isRedacted()) {
            callback(event, room, isLiveAppend);
        }
    };
    matrixClient.on(RoomEvent.Timeline, handler as never);
    return () => matrixClient?.off(RoomEvent.Timeline, handler as never);
}

export function onLocalEchoUpdated(callback: (room: Room) => void): () => void {
    if (!matrixClient) return () => {};
    const handler = (_event: MatrixEvent, room: Room | undefined) => {
        if (room) callback(room);
    };
    matrixClient.on(RoomEvent.LocalEchoUpdated, handler as never);
    return () =>
        matrixClient?.off(RoomEvent.LocalEchoUpdated, handler as never);
}

export function onEditEvent(
    callback: (event: MatrixEvent, room: Room) => void,
): () => void {
    if (!matrixClient) return () => {};
    const handler = (event: MatrixEvent, room: Room | undefined) => {
        if (
            room &&
            event.getType() === "m.room.message" &&
            event.getContent()?.["m.relates_to"]?.rel_type === "m.replace"
        ) {
            callback(event, room);
        }
    };
    matrixClient.on(RoomEvent.Timeline, handler as never);
    return () => matrixClient?.off(RoomEvent.Timeline, handler as never);
}

// ── Default push rule helpers ──────────────────────────────────────────────

export interface DefaultPushRule {
    ruleId: string;
    kind: PushRuleKind;
    label: string;
    description: string;
    /** Conditions for override/underride rules, or pattern for content rules. Used when creating server-side. */
    conditions?: object[];
    pattern?: string | "USERNAME_LOCALPART";
    /** Spec-default actions for this rule at "loud" level, used to derive the
     *  loud/silent/off action sets (see actionsForLevel). Mention rules include
     *  a highlight tweak; message rules do not. */
    defaultActions: any[];
    /** Legacy/alternate rule ids to fall back to when the primary ruleId is not
     *  present in the account's rules (e.g. .m.rule.roomnotif for @room). The
     *  reader/setter picks whichever id actually exists. */
    fallbackRuleIds?: string[];
}

export type PushRuleLevel = "loud" | "silent" | "off";

// Spec-default action templates. Mention rules highlight; message rules don't.
// The highlight tweak is a bare `{ set_tweak: "highlight" }` (never value:false)
// so silencing sound never strips the highlight (see actionsForLevel).
const MENTION_DEFAULT_ACTIONS: any[] = [
    PushRuleActionName.Notify,
    { set_tweak: "sound", value: "default" },
    { set_tweak: "highlight" },
];
const MESSAGE_DEFAULT_ACTIONS: any[] = [
    PushRuleActionName.Notify,
    { set_tweak: "sound", value: "default" },
];

export const DEFAULT_PUSH_RULES: DefaultPushRule[] = [
    {
        ruleId: RuleId.DM,
        kind: PushRuleKind.Underride,
        label: t("client.directMessages"),
        description: t("client.messagesInDirectMessageRooms"),
        conditions: [
            { kind: "room_member_count", is: "2" },
            { kind: "event_match", key: "type", pattern: "m.room.message" },
        ],
        defaultActions: MESSAGE_DEFAULT_ACTIONS,
    },
    {
        ruleId: RuleId.Message,
        kind: PushRuleKind.Underride,
        label: t("client.rooms"),
        description: t("client.messagesInAllOtherRooms"),
        conditions: [
            { kind: "event_match", key: "type", pattern: "m.room.message" },
        ],
        defaultActions: MESSAGE_DEFAULT_ACTIONS,
    },
    {
        ruleId: RuleId.IsUserMention,
        kind: PushRuleKind.Override,
        label: t("client.fullMatrixIdMentions"),
        description: t("client.messagesUsingYourFullUserHomeserver"),
        conditions: [{ kind: "is_user_mention" }],
        defaultActions: MENTION_DEFAULT_ACTIONS,
    },
    {
        ruleId: RuleId.ContainsDisplayName,
        kind: PushRuleKind.Override,
        label: t("client.displayNameMentions"),
        description: t("client.messagesContainingYourDisplayName"),
        conditions: [{ kind: "contains_display_name" }],
        defaultActions: MENTION_DEFAULT_ACTIONS,
    },
    {
        ruleId: RuleId.ContainsUserName,
        kind: PushRuleKind.ContentSpecific,
        label: t("client.usernameMentions"),
        description: t("client.messagesContainingYourUsernameWithoutServer"),
        pattern: "USERNAME_LOCALPART",
        defaultActions: MENTION_DEFAULT_ACTIONS,
    },
    {
        // Modern intentional-mentions rule; older servers only ship the legacy
        // .m.rule.roomnotif, so it is kept as an ordered fallback id.
        ruleId: RuleId.IsRoomMention,
        fallbackRuleIds: [RuleId.AtRoomNotification],
        kind: PushRuleKind.Override,
        label: t("client.roomMentions"),
        description: t("client.messagesUsingRoomToNotifyEveryone"),
        conditions: [
            { kind: "event_match", key: "content.body", pattern: "@room" },
        ],
        defaultActions: MENTION_DEFAULT_ACTIONS,
    },
    {
        ruleId: RuleId.InviteToSelf,
        kind: PushRuleKind.Override,
        label: t("client.invitations"),
        description: t("client.whenYouAreInvitedToA"),
        conditions: [
            { kind: "event_match", key: "type", pattern: "m.room.member" },
            {
                kind: "event_match",
                key: "content.membership",
                pattern: "invite",
            },
            { kind: "event_match", key: "state_key", pattern: "SELF_USER_ID" },
        ],
        defaultActions: MESSAGE_DEFAULT_ACTIONS,
    },
];

/**
 * How long a push-rule write may hold the queue before later writes are let
 * past it. Measured from the moment that write STARTS, so it bounds one
 * write's own run rather than its wait in the line — N consecutively hung
 * writes drain in N x this, never all at once. matrix-js-sdk attaches no abort
 * signal (`localTimeoutMs` is set nowhere in `src`), so a request that never
 * settles otherwise blocks every later push-rule write until the client is
 * stopped. 30s matches the watchdog `leaveRoom` uses to stop waiting on the
 * same class of hang.
 */
const PUSH_RULE_QUEUE_TIMEOUT_MS = 30_000;

/**
 * Every push-rule write below finishes by pulling the canonical rules back into
 * the SDK's single shared `client.pushRules` cache, and the default-rule writes
 * VERIFY themselves against that cache. Two writes in flight at once therefore
 * corrupt each other: the first `GET /pushrules` can be issued before the second
 * write lands yet resolve after it, so the first write is judged against the
 * second one's state (a spurious "did not change" error for a change that
 * worked) and its stale snapshot becomes the cache the settings UI reads back.
 * That is a fake success through a different door, so all of them share ONE
 * queue and no two ever interleave for longer than PUSH_RULE_QUEUE_TIMEOUT_MS.
 * Each caller still gets its own outcome — `createSerialQueue` never lets one
 * write's failure reach another's caller.
 *
 * The queue is bounded: a write still outstanding PUSH_RULE_QUEUE_TIMEOUT_MS
 * after it starts stops holding the others up. Its own caller keeps awaiting
 * the real request and still gets the real answer — the timeout buys liveness
 * for later writes, it never invents an outcome for this one.
 */
const pushRuleWriteQueue = createSerialQueue({
    timeoutMs: PUSH_RULE_QUEUE_TIMEOUT_MS,
    // Diagnostic only. The queue advances before it calls this and swallows a
    // throw from it, so a bad log line cannot hold later writes up.
    onTimeout: () =>
        console.warn(
            "[push rules] a write has been in flight for",
            PUSH_RULE_QUEUE_TIMEOUT_MS,
            "ms - letting later writes past it",
        ),
});

function getGlobalPushRules(): Record<string, any[]> | undefined {
    return (matrixClient as any)?.pushRules?.global as
        Record<string, any[]> | undefined;
}

function findRule(ruleId: string): any | undefined {
    const global = getGlobalPushRules();
    if (!global) return undefined;
    for (const kindRules of Object.values(global)) {
        const rule = kindRules.find((r: any) => r.rule_id === ruleId);
        if (rule) return rule;
    }
    return undefined;
}

/** Candidate rule ids for a default rule: primary first, then any fallbacks
 *  (e.g. @room = [.m.rule.is_room_mention, .m.rule.roomnotif]). */
function candidateRuleIds(ruleId: string): string[] {
    const def = DEFAULT_PUSH_RULES.find((r) => r.ruleId === ruleId);
    return [ruleId, ...(def?.fallbackRuleIds ?? [])];
}

/** The first candidate rule (primary or fallback) that exists in the account. */
function findRuleWithFallback(ruleId: string): any | undefined {
    for (const id of candidateRuleIds(ruleId)) {
        const rule = findRule(id);
        if (rule) return rule;
    }
    return undefined;
}

/** Returns whether a rule's actions include a sound tweak. */
function ruleHasSound(rule: any): boolean {
    return (
        (rule.actions as any[])?.some(
            (a: any) => typeof a === "object" && a.set_tweak === "sound",
        ) ?? false
    );
}

export function getDefaultPushRuleLevel(ruleId: string): PushRuleLevel {
    void pushRulesState.revision;
    // Read whichever id actually exists (primary, then legacy fallback).
    const rule = findRuleWithFallback(ruleId);
    if (!rule || rule.enabled === false) return "off";
    const notifies =
        (rule.actions as any[])?.some(
            (a: any) => a === PushRuleActionName.Notify || a === "notify",
        ) ?? false;
    if (!notifies) return "off";
    return ruleHasSound(rule) ? "loud" : "silent";
}

/**
 * Snapshot of the catch-all push rules that govern background notifications,
 * for diagnostics. "Rooms" (.m.rule.message) notifying = a push for every
 * message in every non-DM room.
 */
export interface PushRuleSummary {
    ruleId: string;
    label: string;
    enabled: boolean;
    level: PushRuleLevel;
}

export function getPushRuleSummary(): PushRuleSummary[] {
    return DEFAULT_PUSH_RULES.map((def) => {
        const rule = findRuleWithFallback(def.ruleId);
        return {
            ruleId: def.ruleId,
            label: def.label,
            enabled: !!rule && rule.enabled !== false,
            level: getDefaultPushRuleLevel(def.ruleId),
        };
    });
}

export async function setDefaultPushRuleLevel(
    ruleId: string,
    kind: PushRuleKind,
    level: PushRuleLevel,
): Promise<void> {
    if (!matrixClient) return;
    const client = matrixClient;

    // Queued: the id resolution below reads the same cache a concurrent write
    // would be refreshing, so it must run inside the queue too, not at call time.
    return pushRuleWriteQueue.run(async () => {
        const ruleDef = DEFAULT_PUSH_RULES.find((r) => r.ruleId === ruleId);
        const defaultActions =
            ruleDef?.defaultActions ?? MESSAGE_DEFAULT_ACTIONS;

        // Dual-id rules (e.g. @room: primary .m.rule.is_room_mention, legacy
        // .m.rule.roomnotif fallback): write to whichever id actually exists in
        // this account's rules.
        const existingId = candidateRuleIds(ruleId).find((id) => findRule(id));
        const targetId = existingId ?? ruleId;
        // Server-default rules (dotted IDs) cannot be created — only
        // enabled/actions updated. Custom rules that don't exist yet must be
        // created with addPushRule.
        const isServerDefault = targetId.startsWith(".");

        const createRule = async (actions: any[]) => {
            const userId = client.getUserId() ?? "";
            const localpart = userId.startsWith("@")
                ? userId.slice(1).split(":")[0]
                : userId;
            const conditions = ruleDef?.conditions?.map((c: any) =>
                c.pattern === "SELF_USER_ID" ? { ...c, pattern: userId } : c,
            );
            const pattern =
                ruleDef?.pattern === "USERNAME_LOCALPART"
                    ? localpart
                    : ruleDef?.pattern;
            await client.addPushRule("global", kind, targetId, {
                actions,
                conditions,
                pattern,
            });
        };

        try {
            await setDefaultPushRuleLevelForClient(client, {
                ruleId,
                targetId,
                kind,
                level,
                defaultActions,
                label: ruleDef?.label ?? ruleId,
                createRule: isServerDefault ? null : createRule,
                readLevel: () => getDefaultPushRuleLevel(ruleId),
                applyOptimistic: (actions) => {
                    const rule = findRule(targetId);
                    if (!rule) return;
                    rule.enabled = level !== "off";
                    if (level !== "off") rule.actions = actions;
                },
            });
        } finally {
            pushRulesState.revision++;
        }
    });
}

/** Register (idempotent, best-effort) the client push rules that ring on an
 *  MSC4075 ring (see buildCallNotifyPushRules), so a device whose app is closed pushes an incoming
 *  CALL notification. Never throws into startup: on continuwuity this is
 *  redundant (it pushes m.call.notify by default), and on servers that don't,
 *  a failure just means no closed-device ring — not a broken session. */
export async function ensureCallNotifyPushRule(): Promise<void> {
    if (!matrixClient) return;
    const client = matrixClient;
    for (const r of buildCallNotifyPushRules()) {
        try {
            await client.addPushRule(
                "global",
                r.kind as never,
                r.ruleId,
                r.body as never,
            );
            await client.setPushRuleEnabled(
                "global",
                r.kind as never,
                r.ruleId,
                true,
            );
        } catch {
            // Already present or a transient failure — the rule is best-effort.
        }
    }
}

// ── Per-room notification settings ────────────────────────────────────────

export function getRoomNotificationSetting(
    roomId: string,
): RoomNotificationSetting {
    void pushRulesState.revision;
    if (!matrixClient) return "default";
    return getRoomNotificationSettingForClient(matrixClient, roomId);
}

export async function setRoomNotificationSetting(
    roomId: string,
    setting: RoomNotificationSetting,
): Promise<void> {
    if (!matrixClient) return;
    const client = matrixClient;
    return pushRuleWriteQueue.run(async () => {
        try {
            await setRoomNotificationSettingForClient(client, roomId, setting);
        } catch (error) {
            // The settings panel toasts this message verbatim, and a raw
            // MatrixError stringifies to "[403] Forbidden (https://…/_matrix/
            // client/v3/pushrules/…)" — a URL and a status code are not an
            // explanation. Translate it the same way the default-rule writes do,
            // keeping the original in the console for diagnostics.
            console.warn(
                "[push rules] room notification write failed",
                roomId,
                error,
            );
            const room = client.getRoom(roomId);
            throw new Error(
                pushRuleFailureMessage(
                    room ? getRoomDisplayName(room) : t("client.thisRoom"),
                    classifyPushRuleWriteError(error),
                ),
            );
        } finally {
            pushRulesState.revision++;
        }
    });
}

// ── Keyword highlight rules (content-kind push rules) ─────────────────────

export type { KeywordBehavior, KeywordRuleView } from "$lib/utils/keywordRules";

/** Re-pull the canonical push-rule set into the SDK cache; never throws. */
async function refreshPushRulesCache(): Promise<void> {
    if (!matrixClient) return;
    await refreshCachedPushRules(matrixClient);
}

/** Reactive read: user keyword rules from the cached global.content set. */
export function getKeywordRules(): KeywordRuleView[] {
    void pushRulesState.revision;
    if (!matrixClient) return [];
    return keywordRulesFromContent(
        getGlobalPushRules()?.content as any[] | undefined,
    );
}

export async function addKeywordRule(
    pattern: string,
    behavior: KeywordBehavior,
): Promise<void> {
    if (!matrixClient) return;
    const client = matrixClient;
    // Dotted ids are reserved for server-default rules; a content rule whose
    // rule_id/pattern starts with "." would collide with them. Reject up front
    // so the error surfaces through the caller's catch (see NotificationSettings).
    if (pattern.startsWith(".")) {
        throw new Error(t("client.keywordCannotStartWith"));
    }
    return pushRuleWriteQueue.run(async () => {
        try {
            await client.addPushRule(
                "global",
                PushRuleKind.ContentSpecific,
                pattern, // rule_id == pattern (SDK URL-encodes it)
                { actions: keywordActions(behavior), pattern },
            );
        } finally {
            await refreshPushRulesCache();
            pushRulesState.revision++;
        }
    });
}

export async function setKeywordRuleBehavior(
    ruleId: string,
    behavior: KeywordBehavior,
): Promise<void> {
    if (!matrixClient) return;
    const client = matrixClient;
    return pushRuleWriteQueue.run(async () => {
        try {
            await client.setPushRuleActions(
                "global",
                PushRuleKind.ContentSpecific,
                ruleId,
                keywordActions(behavior),
            );
        } finally {
            await refreshPushRulesCache();
            pushRulesState.revision++;
        }
    });
}

export async function setKeywordRuleEnabled(
    ruleId: string,
    enabled: boolean,
): Promise<void> {
    if (!matrixClient) return;
    const client = matrixClient;
    return pushRuleWriteQueue.run(async () => {
        try {
            await client.setPushRuleEnabled(
                "global",
                PushRuleKind.ContentSpecific,
                ruleId,
                enabled,
            );
        } finally {
            await refreshPushRulesCache();
            pushRulesState.revision++;
        }
    });
}

export async function deleteKeywordRule(ruleId: string): Promise<void> {
    if (!matrixClient) return;
    const client = matrixClient;
    return pushRuleWriteQueue.run(async () => {
        try {
            await client.deletePushRule(
                "global",
                PushRuleKind.ContentSpecific,
                ruleId,
            );
        } finally {
            await refreshPushRulesCache();
            pushRulesState.revision++;
        }
    });
}

export function onAnyReceiptEvent(callback: () => void): () => void {
    if (!matrixClient) return () => {};
    matrixClient.on(RoomEvent.Receipt as never, callback as never);
    return () =>
        matrixClient?.off(RoomEvent.Receipt as never, callback as never);
}

export async function sendEdit(
    roomId: string,
    eventId: string,
    newText: string,
    formattedBody?: string,
    originalMentions?: Mentions,
    // Media fields (see mediaEditBase) when editing a media caption; the
    // replacement must restate the whole media content, not just the text.
    mediaBase?: Record<string, unknown>,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    // v1.7 mentions module: split m.mentions across the replacement halves —
    // top-level carries only the mentions NEWLY introduced by this revision;
    // m.new_content carries the resolved final set. Conservative: original
    // mentions are never dropped (see computeEditMentions).
    // ⚑ deferred: pill anchors in the ORIGINAL formatted_body are lost on edit
    // because the edit UI is a plain-text box — so a mention that existed only
    // as a formatted_body pill (no bare mxid retyped) survives as an
    // m.mentions user_id but loses its inline highlight in the new body.
    const { topLevel, resolved } = computeEditMentions(
        originalMentions,
        newText,
    );
    const newContent: Record<string, unknown> = {
        ...(mediaBase ?? { msgtype: "m.text" }),
        body: newText,
        "m.mentions": resolved,
    };
    if (formattedBody) {
        newContent.format = "org.matrix.custom.html";
        newContent.formatted_body = formattedBody;
    }
    await matrixClient.sendEvent(
        roomId,
        "m.room.message" as never,
        {
            ...(mediaBase ?? { msgtype: "m.text" }),
            body: `* ${newText}`,
            ...(formattedBody
                ? {
                      format: "org.matrix.custom.html",
                      formatted_body: `* ${formattedBody}`,
                  }
                : {}),
            "m.mentions": topLevel,
            "m.new_content": newContent,
            "m.relates_to": { rel_type: "m.replace", event_id: eventId },
        } as never,
    );
}

// --- State-less stub healing ------------------------------------------------
// Continuwuity never delivers rooms joined over federation in incremental
// /sync: the SDK is left holding a state-less stub ("Empty room", no
// m.room.create, isSpaceRoom() false) that pollutes room lists and can't be
// recognized as a space. The server demonstrably HAS the full state (a plain
// /rooms/{id}/state returns it), so fetch it and seed the SDK's store.

const seedingRooms = new Set<string>();
const roomUpdateSubscribers = new Set<() => void>();
const roomHealedSubscribers = new Set<(roomId: string) => void>();
// Rooms whose state we healed out-of-band this session (see roomStateTrust.ts).
// Read by the UI to flag server-fetched trust indicators as unverified (SEC-M5).
const healedRoomRegistry = createHealedRoomRegistry();

/**
 * Fires after a state-less stub room has been seeded and backfilled — the
 * live timeline changed without any SDK sync event, so timeline views must
 * re-read it (room lists go through onRoomUpdate, which also fires).
 */
export function onRoomHealed(callback: (roomId: string) => void): () => void {
    roomHealedSubscribers.add(callback);
    return () => roomHealedSubscribers.delete(callback);
}

/**
 * Whether this room's current state was healed out-of-band (fetched from
 * `/rooms/{id}/state`) rather than delivered through /sync this session. The UI
 * uses it to flag server-controlled trust indicators as unverified (SEC-M5).
 */
export function isRoomStateHealed(roomId: string): boolean {
    return healedRoomRegistry.isHealed(roomId);
}

function roomLacksState(room: Room): boolean {
    const create = room
        .getLiveTimeline()
        .getState(EventTimeline.FORWARDS)
        ?.getStateEvents("m.room.create", "");
    return needsStateSeed({
        membership: room.getMyMembership(),
        hasCreateEvent: !!create,
        createEventId: create?.getId(),
    });
}

/**
 * Backfill a room whose live timeline has no backward pagination token —
 * scrollback() treats a missing token as "already at the start of history"
 * and silently no-ops, and sync never supplies the token for the rooms it
 * omits. A token-less /messages probe yields a starting point to prime it.
 */
async function primeBackwardToken(
    owner: ClientOwnership<MatrixClient>,
    room: Room,
): Promise<void> {
    const probe = await owner.client.createMessagesRequest(
        room.roomId,
        null,
        1,
        Direction.Backward,
    );
    if (!ownedClient(owner)) return;
    const token = probe.start ?? null;
    room.getLiveTimeline().setPaginationToken(token, Direction.Backward);
    // scrollback() reads the legacy oldState alias, not the timeline.
    room.oldState.paginationToken = token;
}

async function backfillStubTimeline(
    owner: ClientOwnership<MatrixClient>,
    room: Room,
): Promise<void> {
    if (!room.getLiveTimeline().getPaginationToken(Direction.Backward)) {
        await primeBackwardToken(owner, room);
    }
    const client = ownedClient(owner);
    if (!client) return;
    await client.scrollback(room, 30);
}

/**
 * Fetch and inject the room's current state if the SDK only holds a
 * state-less stub. No-op (false) when the room already has state, isn't
 * known, or the fetch fails. Resolves true when state was seeded — with one
 * exception: if a successor client takes over the slot mid-operation this
 * abandons the heal and resolves false even though state (and its crypto
 * config) may already have been injected, because that work belongs to a
 * session nobody is using any more.
 */
export async function seedRoomStateIfMissing(
    roomId: string,
    force = false,
): Promise<boolean> {
    if (!matrixClient) return false;
    const owner = captureOwnership(matrixClient, clientGeneration);
    const room = owner.client.getRoom(roomId);
    if (!room || seedingRooms.has(roomId)) return false;
    // `force` is for callers that KNOW the state is partial rather than
    // absent — accepting an invite, where the room carries only the handful
    // of events invite_state shipped and the server never re-sends the rest.
    // roomLacksState() can't see that: those events are real (ids and all),
    // m.room.create among them.
    if (!force && !roomLacksState(room)) return false;
    seedingRooms.add(roomId);
    try {
        const events = await owner.client.roomState(roomId);
        // A successor account owns the slot: this is the previous account's
        // room state, and every step below it (crypto config, subscriber
        // fanout) would apply to the wrong session.
        if (!ownedClient(owner)) return false;
        const state = room.getLiveTimeline().getState(EventTimeline.FORWARDS);
        if (!state) return false;
        state.setStateEvents(events.map((e) => new MatrixEvent(e)));
        room.recalculate();
        // State injected here never passed through the sync loop, which is the
        // ONLY place the SDK configures a room's encryption. Without this, a
        // healed encrypted room reads as encrypted everywhere in the UI while
        // every send fails with "Cannot encrypt event in unconfigured room"
        // (incoming messages still decrypt, so it looks one-way). Bit a
        // cross-server DM 2026-07-25.
        await ensureRoomCryptoConfigured(room);
        if (!ownedClient(owner)) return false;
        // The timeline suffers the same omission as the state — backfill so
        // the room doesn't open as an empty chat despite having history.
        await backfillStubTimeline(owner, room).catch((err) =>
            console.warn("Backfill after state seeding failed:", err),
        );
        if (!ownedClient(owner)) return false;
        for (const cb of roomUpdateSubscribers) cb();
        for (const cb of roomHealedSubscribers) cb(roomId);
        healedRoomRegistry.markHealed(roomId);
        return true;
    } catch (err) {
        console.error("Failed to seed room state:", err);
        return false;
    } finally {
        seedingRooms.delete(roomId);
    }
}

/** Heal every state-less joined room the SDK knows about (boot pass). */
function seedStatelessRooms(): void {
    if (!matrixClient) return;
    const owner = captureOwnership(matrixClient, clientGeneration);
    for (const room of owner.client.getRooms()) {
        if (roomLacksState(room)) {
            void seedRoomStateIfMissing(room.roomId);
        } else if (
            room.getMyMembership() === "join" &&
            !room.isSpaceRoom() &&
            room.getLiveTimeline().getEvents().length === 0
        ) {
            // State present but an empty timeline (seeded before backfill
            // existed, or the sync omission's timeline variant) — backfill
            // so the room doesn't open as an empty chat.
            void backfillStubTimeline(owner, room)
                .then(() => {
                    if (!ownedClient(owner)) return;
                    for (const cb of roomUpdateSubscribers) cb();
                    for (const cb of roomHealedSubscribers) cb(room.roomId);
                })
                .catch((err) =>
                    console.warn("Boot-pass timeline backfill failed:", err),
                );
        }
    }
}

/**
 * Wipe the local sync cache (IndexedDB) and reload the app. Auth is
 * untouched — the next boot performs a fresh initial sync. Escape hatch for
 * stale-cache states the server never re-delivers (continuwuity omits
 * rooms it considers "unchanged" from incremental sync, so a room cached
 * wrongly stays wrong forever).
 */
export async function clearCacheAndReload(): Promise<void> {
    try {
        const userId = matrixClient?.getUserId();
        const deviceId = matrixClient?.getDeviceId();
        if (userId && deviceId)
            await deleteSnapshot(snapshotKey(userId, deviceId));
        matrixClient?.stopClient();
        await matrixStore?.deleteAllData();
    } catch (err) {
        console.warn("Sync cache wipe failed, reloading anyway:", err);
    }
    window.location.reload();
}

// A joined-rooms mismatch — the server reports a room joined that our local sync
// cache is missing — heals in place where possible (re-assert the join, seed
// state); a cache-wipe reload is only the last resort. continuwuity both poisons
// the cache (a fresh sync WOULD re-deliver the room, so a reload helps) and
// reports outright phantoms (it never delivers the room, so nothing materializes
// it). We reload at most ONCE per unhealable room, remembered in localStorage, so
// a known phantom never re-triggers the boot "Restoring session…" double-flash on
// later cold starts.
const RECONCILE_RELOADED_KEY = "syncReconcileReloadedRooms";
const RECONCILE_RELOADED_MAX = 50;

function loadReconcileReloadedRooms(): string[] {
    try {
        const parsed = JSON.parse(
            localStorage.getItem(RECONCILE_RELOADED_KEY) ?? "[]",
        );
        return Array.isArray(parsed)
            ? parsed.filter((x): x is string => typeof x === "string")
            : [];
    } catch {
        return [];
    }
}

function saveReconcileReloadedRooms(ids: string[]): void {
    try {
        // Bounded: only the most recent unhealable rooms need remembering.
        localStorage.setItem(
            RECONCILE_RELOADED_KEY,
            JSON.stringify(ids.slice(-RECONCILE_RELOADED_MAX)),
        );
    } catch {
        // Private-mode localStorage can throw; the one reload still happens.
    }
}

/** Re-materialize + state-seed one joined room the local cache is missing. */
async function healMissingJoinedRoom(roomId: string): Promise<boolean> {
    if (!matrixClient) return false;
    if (matrixClient.getRoom(roomId)?.getMyMembership() === "join") return true;
    try {
        // Idempotent for an already-joined room; makes the SDK create/correct
        // the Room object the poisoned cache dropped. Raw SDK call (not the
        // joinRoom wrapper) so it never re-triggers reconciliation.
        await matrixClient.joinRoom(roomId);
    } catch {
        // Already joined or transient — fall through and try seeding anyway.
    }
    const room = matrixClient.getRoom(roomId);
    if (!room) return false;
    if (roomLacksState(room)) await seedRoomStateIfMissing(roomId);
    return room.getMyMembership() === "join";
}

let liveReconcileRunning = false;

/**
 * Compare the server's joined list against ours and heal any room sync dropped,
 * preferring an in-place heal (no reload). Runs at boot (first PREPARED) and,
 * debounced, mid-session. A cache-wipe reload is the last resort, tried at most
 * once per unhealable room so a continuwuity phantom can't reload on every boot.
 */
export async function reconcileJoinedRoomsLive(): Promise<void> {
    if (!matrixClient || liveReconcileRunning) return;
    // Sliding sync loads rooms in a growing window, so rooms outside it are
    // "missing" by design, not because sync dropped them.
    if (isUsingSlidingSync()) return;
    liveReconcileRunning = true;
    try {
        const server = await matrixClient.getJoinedRooms();
        const missing = server.joined_rooms.filter(
            (id) => matrixClient?.getRoom(id)?.getMyMembership() !== "join",
        );
        if (missing.length === 0) return;
        console.info("Sync heal - rooms missing locally:", missing);
        const stillMissing: string[] = [];
        for (const id of missing) {
            if (!(await healMissingJoinedRoom(id))) stillMissing.push(id);
        }
        for (const cb of roomUpdateSubscribers) cb();
        for (const id of missing) {
            if (matrixClient.getRoom(id)?.getMyMembership() === "join")
                for (const cb of roomHealedSubscribers) cb(id);
        }
        if (stillMissing.length === 0) return;
        // Rooms we couldn't materialize in place: reload once for any we have
        // never reloaded for (a poisoned cache may deliver them on a fresh
        // sync); never reload for one a prior reload already failed to fix.
        const plan = planReconcileReload({
            stillMissing,
            reloadedRooms: loadReconcileReloadedRooms(),
        });
        if (!plan.reload) {
            console.warn(
                "Joined-rooms mismatch a reload can't fix:",
                stillMissing,
            );
            return;
        }
        saveReconcileReloadedRooms(plan.nextReloadedRooms);
        await clearCacheAndReload();
    } catch {
        // best-effort — never surface as a user-facing error
    } finally {
        liveReconcileRunning = false;
    }
}

let liveReconcileTimer: ReturnType<typeof setTimeout> | null = null;
/** Debounced trigger for the in-session joined-rooms heal. */
export function scheduleJoinedRoomsReconcile(delayMs = 1500): void {
    if (liveReconcileTimer) return;
    liveReconcileTimer = setTimeout(() => {
        liveReconcileTimer = null;
        void reconcileJoinedRoomsLive();
    }, delayMs);
}

export function onRoomUpdate(callback: () => void): () => void {
    if (!matrixClient) return () => {};
    roomUpdateSubscribers.add(callback);
    const syncHandler = (state: string) => {
        if (state === "PREPARED" || state === "SYNCING") callback();
    };
    matrixClient.on(ClientEvent.Sync, syncHandler as never);
    matrixClient.on("Room.myMembership" as never, callback as never);
    matrixClient.on(RoomEvent.Tags as never, callback as never);
    return () => {
        roomUpdateSubscribers.delete(callback);
        matrixClient?.off(ClientEvent.Sync, syncHandler as never);
        matrixClient?.off("Room.myMembership" as never, callback as never);
        matrixClient?.off(RoomEvent.Tags as never, callback as never);
    };
}

/**
 * Backfill batch size. Deliberately small: every paged-in event is parsed,
 * built into a MatrixEvent, and mounted as a Svelte message component
 * synchronously inside the `/messages` response handler — a JS-bound frame
 * whose cost scales with the batch (measured: ~28 rows ≈ a ~50ms frame at
 * depth). A smaller batch splits that into two cheaper frames, so scroll-up
 * stutters less; the trade is more frequent, lighter loads.
 */
const BACKFILL_BATCH = 15;

/**
 * Page one batch into the oldest timeline of the live chain. Resolves whether
 * more history remains.
 *
 * Deliberately NOT client.scrollback(): that legacy API (a) always pages into
 * the live timeline, so after a gap join its token keeps advancing while the
 * events land in the older timeline the UI never read, and (b) treats ANY
 * empty /messages chunk as the start of history. Synapse returns empty chunks
 * with a valid `end` when a whole page is invisible to us (busy public rooms
 * hit this constantly), which ended the timeline mid-history.
 * paginateEventTimeline only stops when the server omits `end`.
 */
async function paginateLiveChain(
    client: MatrixClient,
    room: Room,
    limit: number,
): Promise<boolean> {
    const oldest = liveTimelineChain(room)[0];
    // No token means start of history. Never paginate without one: a token-
    // less /messages returns the NEWEST events, which would be prepended.
    if (oldest.getPaginationToken(Direction.Backward)) {
        await client.paginateEventTimeline(oldest, { backwards: true, limit });
    }
    // The page may have joined a further-back timeline; its token decides.
    return !!liveTimelineChain(room)[0].getPaginationToken(Direction.Backward);
}

/**
 * Page one batch of older history into the live timeline. Returns whether
 * more history remains.
 *
 * "No new events added" is NOT the end-of-history signal: after a gappy
 * sync resets the timeline, pagination restarts near "now" and the first
 * batches are all duplicates of already-known events — but the token still
 * advances past them. Treating an all-duplicate batch as the end froze
 * pagination permanently in busy rooms. The reliable signal is the SDK
 * nulling the backward token, which it only does on an empty server page.
 */
export async function loadPreviousMessages(room: Room): Promise<boolean> {
    if (!matrixClient) return false;
    const owner = captureOwnership(matrixClient, clientGeneration);
    const timeline = room.getLiveTimeline();
    // Once older timelines are linked behind the live one, the live
    // timeline's own token is irrelevant: the chain's oldest end is where
    // history continues, and no priming applies.
    const linked = liveTimelineChain(room).length > 1;
    const hasBackwardToken =
        linked || !!timeline.getPaginationToken(Direction.Backward);
    // Sliding sync can hand over a room with a short (or all-hidden) timeline
    // and no prev_batch even though older history exists, which scrollback()
    // would read as "start of history" and the room would open as empty. Probe
    // once per live timeline; the once-only guard is what keeps a genuinely complete
    // room from being re-primed (and re-paged) forever.
    const slidingProbe =
        isUsingSlidingSync() &&
        !hasBackwardToken &&
        !slidingPrimedTimelines.has(timeline);
    if (slidingProbe) slidingPrimedTimelines.add(timeline);
    if (
        slidingProbe ||
        shouldPrimePaginationToken({
            hasBackwardToken,
            timelineEventCount: timeline.getEvents().length,
        })
    ) {
        // A timeline that was never primed makes scrollback() a silent no-op,
        // and the return below would then report "no more history" — which
        // latches pagination off for the session and leaves the room
        // permanently empty. Happens to a healed room whose boot-time backfill
        // threw. Ask the server before concluding anything.
        await primeBackwardToken(owner, room).catch((err) =>
            console.warn("Priming backward pagination token failed:", err),
        );
    }
    // Skip rather than return false when a successor client took the slot: a
    // false return latches canLoadMore off for the session (setMessages
    // preserves it and MessageArea never remounts), killing scroll-up in the
    // room for good. The token below is the honest answer either way.
    const client = ownedClient(owner);
    if (!client) {
        return !!liveTimelineChain(room)[0].getPaginationToken(
            Direction.Backward,
        );
    }
    return paginateLiveChain(client, room, BACKFILL_BATCH);
}

// Reply previews reference events that are often outside the loaded
// timeline window. Fetch them individually, promise-cached so concurrent
// renders of the same reply share one request; failures aren't cached so
// a later re-render can retry.
const singleEventCache = new Map<string, Promise<MatrixEvent | null>>();

export function fetchSingleEvent(
    roomId: string,
    eventId: string,
): Promise<MatrixEvent | null> {
    if (!matrixClient) return Promise.resolve(null);
    const key = `${roomId}|${eventId}`;
    let promise = singleEventCache.get(key);
    if (!promise) {
        promise = matrixClient
            .fetchRoomEvent(roomId, eventId)
            .then(async (raw) => {
                const ev = matrixClient!.getEventMapper()(raw);
                // The mapper kicks off decryption but returns synchronously, so a
                // reply target from an encrypted room would otherwise resolve
                // still-encrypted and render as "Original message unavailable".
                // A one-off fetched event is not attached to a room's re-emitter,
                // so the client's Decrypted listener never fires for it (no
                // timelineTick bump) — await it here instead. No-op when the room
                // is unencrypted.
                await matrixClient!.decryptEventIfNeeded(ev);
                return ev;
            })
            .catch(() => {
                singleEventCache.delete(key);
                return null;
            });
        singleEventCache.set(key, promise);
    }
    return promise;
}

/** Pages backwards until `eventId` appears in the live timeline or `maxBatches` is exhausted.
 *  Returns true if the event was found. */
export async function loadMessagesUntilEvent(
    room: Room,
    eventId: string,
    maxBatches = 40,
): Promise<boolean> {
    if (!matrixClient) return false;
    for (let i = 0; i < maxBatches; i++) {
        if (liveChainEvents(room).some((e) => e.getId() === eventId))
            return true;
        // All-duplicate batches happen after gappy-sync timeline resets and
        // must not abort the walk — only a null token means no more history.
        if (!(await paginateLiveChain(matrixClient, room, 50))) break;
    }
    return liveChainEvents(room).some((e) => e.getId() === eventId);
}

/** Builds a paginating timeline window centred on `eventId`, WITHOUT disturbing
 *  the live timeline. Unlike a one-shot context snapshot, the returned window can
 *  be paginated in both directions as the user scrolls (see paginateContextWindow)
 *  and reports when it has caught up to the live edge (see contextWindowCanPaginate)
 *  — that is what lets a jump-to-message view scroll freely and rejoin the present.
 *  Returns null if the event's timeline can't be loaded. */
export async function createContextWindow(
    room: Room,
    eventId: string,
    windowSize = 50,
): Promise<TimelineWindow | null> {
    if (!matrixClient) return null;
    // A private timeline set, NOT the room's unfiltered one. Sync appends via
    // addLiveEvent, which silently drops any event another timeline in the
    // same set already holds, so a window built in the room's set while sync
    // was behind (every notification tap on a resumed app) swallowed the
    // newest messages: they showed in the context view, then vanished when it
    // handed back to the live timeline, which never received them. Nothing
    // sync does can see or reset this set.
    const timelineSet = new EventTimelineSet(
        room,
        { timelineSupport: true },
        matrixClient,
    );
    const window = new TimelineWindow(matrixClient, timelineSet);
    try {
        await window.load(eventId, windowSize);
    } catch {
        return null;
    }
    // load() resolves even when the event's timeline could not be fetched; an
    // empty window means we have nothing to show, so treat it as unavailable.
    if (window.getEvents().length === 0) return null;
    contextWindowRooms.set(window, room);
    contextTimelineSets.set(room.roomId, timelineSet);
    return window;
}

const contextWindowRooms = new WeakMap<TimelineWindow, Room>();
// Each room's most recent context window set, so findEventById still resolves
// events that only a jump view holds (reply/edit targets in that view).
const contextTimelineSets = new Map<string, EventTimelineSet>();

/** The renderable message events currently held by a context window, filtered
 *  identically to the live timeline so the jump view matches normal rendering. */
export function getContextWindowEvents(window: TimelineWindow): MatrixEvent[] {
    return dedupeById(
        collapseCallEvents(
            window.getEvents().filter(isRenderableTimelineEvent),
        ),
        (e) => e.getId(),
    );
}

/** Extends a context window by `limit` events in one direction (forwards =
 *  towards newer/live). Returns true if more events were loaded. */
export function paginateContextWindow(
    window: TimelineWindow,
    forwards: boolean,
    limit = 30,
): Promise<boolean> {
    const dir = forwards ? EventTimeline.FORWARDS : EventTimeline.BACKWARDS;
    return window.paginate(dir, limit);
}

/** Whether a context window can still extend in the given direction. A false
 *  result for forwards means the window has caught up with the live timeline
 *  — the caller can then hand back to it. */
export function contextWindowCanPaginate(
    window: TimelineWindow,
    forwards: boolean,
): boolean {
    if (forwards) {
        // The window lives in its own timeline set, so it never links up with
        // the live timeline the way a window in the room's set did. It has
        // caught up once its newest event is one the live view holds.
        const room = contextWindowRooms.get(window);
        const events = window.getEvents();
        const newestId = events[events.length - 1]?.getId();
        if (room && newestId && isInLiveTimeline(room, newestId)) return false;
        return window.canPaginate(EventTimeline.FORWARDS);
    }
    return window.canPaginate(EventTimeline.BACKWARDS);
}

/** Server-side message search scoped to a single room (order: most recent
 *  first). The returned object carries the SDK's pagination state — pass it
 *  to searchRoomMessagesMore to append the next page in place. */
export async function searchRoomMessages(
    roomId: string,
    term: string,
    filter?: { rooms?: string[]; senders?: string[]; contains_url?: boolean },
): Promise<ISearchResults | null> {
    if (!matrixClient) return null;
    return matrixClient.searchRoomEvents({
        term,
        // Keep the room scope even if a caller passes a filter without `rooms`;
        // buildServerSearchFilter already includes it, so the spread is a no-op
        // in that case and adds the operator-derived `senders`/`contains_url`.
        filter: { rooms: [roomId], ...filter },
    });
}

/** Backfill the next page of an earlier searchRoomMessages result. Mutates
 *  and returns the same results object (SDK contract). */
export async function searchRoomMessagesMore(
    results: ISearchResults,
): Promise<ISearchResults | null> {
    if (!matrixClient) return null;
    return matrixClient.backPaginateRoomEventsSearch(results);
}

export async function sendReadReceipt(event: MatrixEvent): Promise<void> {
    if (!matrixClient) return;
    const roomId = event.getRoomId();
    const eventId = event.getId();
    if (!roomId || !eventId) return;

    // Idempotence guard, same law as markThreadRead: the SDK SYNCHRONOUSLY
    // synthesizes a local receipt and fires every app-level receipt listener
    // (bumpUnreadTick, notification clearing) before the HTTP call ever
    // leaves. Those listeners fan out over every rendered row, so a redundant
    // send is not free — and scrollToBottom calls this unconditionally from
    // several per-event paths, so "redundant" is the common case. The
    // synthesized receipt counts here (ignoreSynthesized = false), so this
    // trips immediately after the first send rather than after the round trip.
    const room = matrixClient.getRoom(roomId);
    const myUserId = matrixClient.getUserId();
    if (room && myUserId && room.getEventReadUpTo(myUserId, false) === eventId)
        return;

    const receiptType = receiptTypeForSetting(
        settingsState.privateReadReceipts,
    ) as ReceiptType;
    await matrixClient.sendReadReceipt(event, receiptType);
    await matrixClient.setRoomReadMarkers(roomId, eventId);
}

/** Send a read receipt to the room's newest live event, clearing its unread state. */
export async function markRoomAsRead(roomId: string): Promise<void> {
    if (!matrixClient) return;
    const room = matrixClient.getRoom(roomId);
    if (!room) return;
    const events = room.getLiveTimeline().getEvents();
    const last = events[events.length - 1];
    if (last) await sendReadReceipt(last);
}

/**
 * Mark every joined room inside a space as read, walking sub-spaces
 * recursively. `markRoomAsRead(spaceId)` alone only receipts the space's own
 * (state-only) timeline and leaves every child room unread — the visible bug
 * behind "mark as read on a space does nothing". The room set here mirrors
 * SpaceSidebar's unread aggregation, so the space's badge clears. Each
 * `markRoomAsRead` is idempotent (skips rooms already at their latest event),
 * and the fan-out is bounded so a large space doesn't burst dozens of
 * receipt round-trips at once.
 */
export async function markSpaceAsRead(spaceId: string): Promise<void> {
    if (!matrixClient) return;
    const roomIds = collectSpaceDescendantRoomIds(
        spaceId,
        (id) => getRoomsInSpace(id).map((r) => r.roomId),
        (id) =>
            getSpaceChildIds(id).filter(
                (cid) => matrixClient?.getRoom(cid)?.isSpaceRoom() ?? false,
            ),
    );
    await mapWithConcurrency(roomIds, 6, (id) => markRoomAsRead(id));
}

/** A shareable matrix.to link: canonical alias if set, else room id + our homeserver as via. */
export function getRoomShareLink(roomId: string): string {
    const room = matrixClient?.getRoom(roomId);
    const alias = room?.getCanonicalAlias();
    if (alias) return matrixToUrl(alias);
    const domain = matrixClient?.getDomain();
    return matrixToUrl(roomId, domain ? [domain] : []);
}

/** A shareable matrix.to permalink to a specific event in a room. */
export function getMessageShareLink(roomId: string, eventId: string): string {
    const room = matrixClient?.getRoom(roomId);
    const alias = room?.getCanonicalAlias();
    const domain = matrixClient?.getDomain();
    const via = domain ? [domain] : [];
    return matrixToUrl(alias ?? roomId, via, eventId);
}

/** Returns the event ID the current user has read up to in this room, or null. */
export function getReadUpToEventId(room: Room): string | null {
    const userId = matrixClient?.getUserId();
    if (!userId) return null;
    return room.getEventReadUpTo(userId, true) ?? null;
}

export interface ReadReceiptInfo {
    userId: string;
    avatarUrl: string | null;
    name: string;
    /** Receipt timestamp (ms); 0 when the server omitted it. Orders the reader list. */
    ts: number;
}

/** Returns the list of other users whose latest read receipt is on this event. */
export function getReceiptsForEvent(
    room: Room,
    event: MatrixEvent,
): ReadReceiptInfo[] {
    const myId = matrixClient?.getUserId();
    const receipts = room.getReceiptsForEvent(event);
    return receipts
        .filter((r) => r.userId !== myId && r.type === "m.read")
        .map((r) => ({
            userId: r.userId,
            avatarUrl: getMemberAvatar(room, r.userId),
            name: getMemberName(room, r.userId),
            ts: r.data?.ts ?? 0,
        }));
}

export async function sendTyping(
    roomId: string,
    isTyping: boolean,
    timeout: number = 25_000,
): Promise<void> {
    if (!matrixClient) return;
    // Opted out: send no typing notification at all.
    if (!settingsState.sendTypingIndicators) return;
    try {
        await matrixClient.sendTyping(roomId, isTyping, timeout);
    } catch {
        // ignore typing errors
    }
}

export function onTypingEvent(
    room: Room,
    callback: (userIds: string[]) => void,
): () => void {
    if (!matrixClient) return () => {};
    const myId = matrixClient.getUserId();
    const handler = (_event: unknown, member: RoomMember) => {
        if (member.roomId !== room.roomId) return;
        const typing = room
            .getMembers()
            .filter((m) => m.typing && m.userId !== myId)
            .map((m) => m.userId);
        callback(typing);
    };
    matrixClient.on(RoomMemberEvent.Typing as never, handler as never);
    return () =>
        matrixClient?.off(RoomMemberEvent.Typing as never, handler as never);
}

export interface SpaceChildInfo {
    roomId: string;
    name: string;
    topic?: string;
    avatarUrl?: string;
    numMembers: number;
    isJoined: boolean;
    via: string[];
    isSpace?: boolean;
    joinRule?: string;
    isKnocked?: boolean;
}

// Spaces whose direct /hierarchy call failed this session — re-opening such a
// space walks straight in through the parent instead of re-403ing first.
const hierarchyDirectFailed = new Set<string>();

/**
 * The active space's child rooms, from /hierarchy (paginated), falling back to
 * the parent space's deeper hierarchy when the server refuses the direct call.
 *
 * Returns `null` when the hierarchy could NOT be obtained — a failed request,
 * or no client yet — and `[]` only when the space genuinely has no children.
 * Callers must not overwrite a good hierarchy on `null`: `[]` would blank the
 * sidebar AND be recorded as a successful refresh, arming the several-minute
 * TTL against it. On `null` keep what is on screen; the caller retries on a
 * later sync, subject to the failure backoff in utils/hierarchyRefresh.ts.
 */
export async function fetchSpaceHierarchy(
    spaceId: string,
    parentSpaceId?: string,
    // How many levels below parentSpaceId the drilled space sits — the
    // fallback must fetch one level deeper than that to see its children.
    drillDepth = 1,
): Promise<SpaceChildInfo[] | null> {
    // No client yet is "could not fetch", not "this space is empty": returning
    // [] here would be recorded as a successful refresh and blank the sidebar
    // for the length of the TTL. The store's initial value is already [].
    if (!matrixClient) return null;

    // Follow `next_batch` across pages so spaces with more than 200 rooms
    // populate fully (the SDK caps a single /hierarchy response at the given
    // limit). Cap at 10 pages (~2000 rooms) as a runaway guard and dedupe by
    // room_id — a page boundary can re-list a room already seen.
    const getHierarchy = async (
        id: string,
        depth: number,
    ): Promise<{ rooms: Array<Record<string, unknown>> }> => {
        // Bind `this`: extracting the method into a bare variable would call it
        // detached from matrixClient, so the SDK's `this.http` is undefined and
        // /hierarchy throws at runtime (invisible to type-check/tests).
        const call = (matrixClient as unknown as Record<string, Function>)[
            "getRoomHierarchy"
        ].bind(matrixClient);
        const merged: Array<Record<string, unknown>> = [];
        const seen = new Set<string>();
        let nextBatch: string | undefined = undefined;
        for (let page = 0; page < 10; page++) {
            const result = (await call(
                id,
                200,
                depth,
                undefined,
                nextBatch,
            )) as {
                rooms: Array<Record<string, unknown>>;
                next_batch?: string;
            };
            for (const r of result.rooms ?? []) {
                const rid = r["room_id"] as string | undefined;
                if (rid) {
                    if (seen.has(rid)) continue;
                    seen.add(rid);
                }
                merged.push(r);
            }
            nextBatch = result.next_batch;
            if (!nextBatch) break;
        }
        return { rooms: merged };
    };

    let rooms: Array<Record<string, unknown>>;
    const viaMap = new Map<string, string[]>();
    try {
        if (parentSpaceId && hierarchyDirectFailed.has(spaceId)) {
            throw new Error("skipping direct hierarchy fetch");
        }
        // depth 1 = direct children only; limit 200 rooms
        const result = await getHierarchy(spaceId, 1);
        hierarchyDirectFailed.delete(spaceId);
        rooms = result.rooms.filter((r) => r["room_id"] !== spaceId);

        // Build a via-servers map from the space entry's children_state
        const slice = extractSubspaceChildren(result.rooms, spaceId);
        if (slice) for (const [k, v] of slice.viaMap) viaMap.set(k, v);

        // Also fall back to the local room state for via servers
        const spaceRoom = matrixClient.getRoom(spaceId);
        if (spaceRoom) {
            const childEvents =
                spaceRoom
                    .getLiveTimeline()
                    .getState(EventTimeline.FORWARDS)
                    ?.getStateEvents("m.space.child") ?? [];
            for (const ev of childEvents) {
                const childRoomId = ev.getStateKey();
                const via = (ev.getContent()["via"] as string[]) ?? [];
                if (childRoomId && via.length && !viaMap.has(childRoomId)) {
                    viaMap.set(childRoomId, via);
                }
            }
        }
    } catch (err) {
        // Continuwuity answers /hierarchy with 403 "This room does not
        // exist" for spaces this server hasn't joined — including
        // sub-spaces it lists as children of a joined parent. Walk in
        // through the parent instead: its hierarchy one level deeper
        // carries the sub-space's children (best effort — a page holds
        // 200 rooms).
        if (!parentSpaceId) {
            console.error("Failed to fetch space hierarchy:", err);
            return null;
        }
        hierarchyDirectFailed.add(spaceId);
        try {
            const parent = await getHierarchy(parentSpaceId, drillDepth + 1);
            const slice = extractSubspaceChildren(parent.rooms, spaceId);
            if (!slice) {
                console.error("Failed to fetch space hierarchy:", err);
                return null;
            }
            rooms = parent.rooms.filter((r) =>
                slice.childIds.has(r["room_id"] as string),
            );
            for (const [k, v] of slice.viaMap) viaMap.set(k, v);
        } catch (parentErr) {
            console.error(
                "Failed to fetch space hierarchy (direct and via parent):",
                err,
                parentErr,
            );
            return null;
        }
    }

    // Knocked rooms are tracked by the SDK too — keep them out of the
    // "joined" set so they stay visible in Browse Channels (with a
    // pending-request state) instead of silently disappearing.
    const trackedRooms = matrixClient.getRooms();
    const joinedIds = new Set(
        trackedRooms
            .filter((r) => r.getMyMembership() !== "knock")
            .map((r) => r.roomId),
    );
    const knockedIds = new Set(
        trackedRooms
            .filter((r) => r.getMyMembership() === "knock")
            .map((r) => r.roomId),
    );

    const result = rooms.map((r): SpaceChildInfo => {
        const mxcAvatar = r["avatar_url"] as string | undefined;
        const roomId = r["room_id"] as string;
        return {
            roomId,
            name: (r["name"] as string) || roomId,
            topic: r["topic"] as string | undefined,
            avatarUrl: mxcAvatar
                ? (mxcToHttp(mxcAvatar) ?? undefined)
                : undefined,
            numMembers: (r["num_joined_members"] as number) ?? 0,
            isJoined: joinedIds.has(roomId),
            via: viaMap.get(roomId) ?? [],
            isSpace: r["room_type"] === "m.space",
            joinRule: r["join_rule"] as string | undefined,
            isKnocked: knockedIds.has(roomId),
        };
    });
    hierarchyCache.set(spaceId, result);
    return result;
}

// Last fetched /hierarchy per space. Shown the moment a space or sub-space is
// opened again (and on boot, via the room-list snapshot) while a fresh fetch
// runs, so unjoined rooms and sub-space contents don't blink out on a switch.
const hierarchyCache = new Map<string, SpaceChildInfo[]>();

export function getCachedHierarchy(
    spaceId: string,
): SpaceChildInfo[] | undefined {
    return hierarchyCache.get(spaceId);
}

/** Apply a local change (join, knock) to every cached hierarchy listing it. */
export function patchCachedHierarchyEntry(
    roomId: string,
    patch: Partial<SpaceChildInfo>,
): void {
    for (const [spaceId, list] of hierarchyCache) {
        if (!list.some((r) => r.roomId === roomId)) continue;
        hierarchyCache.set(
            spaceId,
            list.map((r) => (r.roomId === roomId ? { ...r, ...patch } : r)),
        );
    }
}

const SPACE_ORDER_KEY = "im.client.space_order";
const SPACE_LAYOUT_KEY = "im.client.space_layout";

export interface SpaceFolder {
    name: string;
    spaceIds: string[];
    color?: string;
}

export interface SpaceLayout {
    order: string[]; // space IDs and folder IDs mixed
    folders: Record<string, SpaceFolder>;
}

export function getSpaceLayout(): SpaceLayout {
    if (!matrixClient) return { order: [], folders: {} };
    const layout = lookupAccountData(SPACE_LAYOUT_KEY)?.getContent() as
        SpaceLayout | undefined;
    if (layout?.order?.length) return layout;
    // Migrate from old space_order key
    const oldOrder =
        (lookupAccountData(SPACE_ORDER_KEY)?.getContent()?.order as string[]) ??
        [];
    return { order: oldOrder, folders: {} };
}

export async function setSpaceLayout(layout: SpaceLayout): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    await matrixClient.setAccountData(SPACE_LAYOUT_KEY, layout);
}

export function getSpaceOrder(): string[] {
    return getSpaceLayout().order;
}

export async function setSpaceOrder(order: string[]): Promise<void> {
    const layout = getSpaceLayout();
    await setSpaceLayout({ ...layout, order });
}

export async function leaveRoom(roomId: string): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    // Leaving the room mid-call must also hang up — otherwise the SFU
    // connection and mic stay live in a room we're no longer a member of.
    if (getActiveVoiceRoomId() === roomId) await leaveVoiceCall();
    pendingLeaves.add(roomId);
    try {
        await matrixClient.leave(roomId);
    } catch (e) {
        pendingLeaves.delete(roomId);
        throw e;
    }
    // Remove from pendingLeaves once the SDK reflects the leave locally
    const check = setInterval(() => {
        const room = matrixClient?.getRoom(roomId);
        if (!room || room.getMyMembership() !== "join") {
            pendingLeaves.delete(roomId);
            clearInterval(check);
        }
    }, 500);
    setTimeout(() => {
        pendingLeaves.delete(roomId);
        clearInterval(check);
    }, 30000);
}

export interface RoomTombstone {
    body: string;
    replacementRoomId: string;
    // The server-name of the tombstone's sender — a good `via` candidate for
    // joining the (often federated) replacement room, which may not be
    // resolvable from its room id alone.
    senderServer?: string;
}

export function getTombstone(room: Room): RoomTombstone | null {
    const event = room
        .getLiveTimeline()
        .getState(EventTimeline.FORWARDS)
        ?.getStateEvents("m.room.tombstone", "");
    if (!event) return null;
    const content = event.getContent();
    if (!content?.replacement_room) return null;
    return {
        body: content.body ?? "This room has been replaced.",
        replacementRoomId: content.replacement_room,
        senderServer: event.getSender()?.split(":").slice(1).join(":"),
    };
}

export async function joinRoom(roomId: string, via?: string[]): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    // Claim the room as landable up front: `/sync` won't confirm the join for
    // a few hundred ms, and any refresh in that window would otherwise decide
    // the room is gone and move the user off it.
    markRoomPendingArrival(roomId);
    try {
        await matrixClient.joinRoom(
            roomId,
            via?.length ? { viaServers: via } : undefined,
        );
    } catch (err) {
        // Some servers (continuwuity) give up on the first via candidate that
        // answers "not found" instead of trying the rest — retry the remaining
        // candidates one at a time before giving up ourselves.
        let joined = false;
        for (const server of viaFallbackCandidates(err, via)) {
            try {
                await matrixClient.joinRoom(roomId, { viaServers: [server] });
                joined = true;
                break;
            } catch {
                // candidate failed — try the next one
            }
        }
        if (!joined) {
            // A failed join must not leave the id stuck as landable.
            pendingJoins.delete(roomId);
            throw err;
        }
    }
    await seedRoomStateIfMissing(roomId);
    scheduleJoinedRoomsReconcile();
}

export async function joinRoomByAlias(alias: string): Promise<string> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const result = await matrixClient.joinRoom(alias);
    await seedRoomStateIfMissing(result.roomId);
    const room = matrixClient.getRoom(result.roomId);
    if (room) await matrixClient.scrollback(room, 30).catch(() => {});
    return result.roomId;
}

/**
 * Resolve a room alias to its room id plus candidate via servers, without
 * joining. Rejects (M_NOT_FOUND) when the alias does not exist.
 */
export async function getRoomIdForAlias(
    alias: string,
): Promise<{ roomId: string; servers: string[] }> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const result = await matrixClient.getRoomIdForAlias(alias);
    return { roomId: result.room_id, servers: result.servers ?? [] };
}

export interface PublicRoomsPage {
    rooms: DirectoryRoom[];
    nextBatch: string | null;
    totalEstimate: number | null;
}

/** One page of the public room directory (local homeserver by default). */
export async function getPublicRooms(
    opts: {
        server?: string;
        search?: string;
        since?: string;
        limit?: number;
    } = {},
): Promise<PublicRoomsPage> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const res = await matrixClient.publicRooms({
        server: opts.server,
        limit: opts.limit ?? 30,
        since: opts.since,
        // Only include filter when searching: any extra key (even undefined)
        // makes the SDK switch from GET to the POST /publicRooms form.
        ...(opts.search
            ? { filter: { generic_search_term: opts.search } }
            : {}),
    });
    return {
        rooms: mapPublicRooms(res.chunk ?? []),
        nextBatch: res.next_batch ?? null,
        totalEstimate: res.total_room_count_estimate ?? null,
    };
}

// Rooms created by this client let every member join MatrixRTC calls: the
// spec default (state_default 50) would otherwise reserve calls for
// moderators. Element sets the same overrides at creation.
const CALL_POWER_LEVEL_EVENTS: Record<string, number> = Object.fromEntries(
    CALL_MEMBER_EVENT_TYPES.map((t) => [t, 0]),
);

/**
 * How long to wait for a just-created room to reach the SDK store via /sync.
 * Generous: the cost of overshooting is a spinner, the cost of giving up early
 * is a room the caller cannot configure crypto for.
 */
const NEW_ROOM_SYNC_TIMEOUT_MS = 15_000;

/**
 * Wait (bounded) for a room we just created to arrive over /sync.
 *
 * `createRoom` is a bare POST — the SDK stores no Room and emits no
 * ClientEvent.Room — so `getRoom()` is null when it resolves. That matters in
 * two ways. Sending into an unknown room skips encryption entirely
 * (`encryptEventIfNeeded` opens with `if (!room) return`), so a message meant
 * for a brand-new encrypted DM goes out in PLAINTEXT, with no error and no
 * local echo. And the Room object is what `scrollback` and
 * `ensureRoomCryptoConfigured` both need.
 *
 * Resolves null rather than rejecting on every reachable failure — timeout, a
 * broken emitter, no client — and never leaves the listener or the timer
 * behind, so the caller behaves exactly as it does today. The one path that
 * could still escape is a throw from the teardown itself, which sits in the
 * `finally` outside the `catch`; `off` only rejects a listener that is not a
 * function, and this one is a const arrow, so `settleCreatedRoom` contains it
 * rather than this function paying for a second try/catch to cover it.
 */
async function awaitCreatedRoom(roomId: string): Promise<Room | null> {
    const client = matrixClient;
    if (!client) return null;
    const handle = waitForRoomArrival<Room>(roomId, client.getRoom(roomId));
    // Already in the store: nothing was attached, so there is nothing to detach.
    if (handle.settled()) return handle.result;

    const onRoom = (room: Room) => handle.onRoomArrived(room.roomId, room);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        // Subscribe INSIDE the try: if `on` lands and `setTimeout` then throws,
        // the finally is the only thing that takes the listener back off.
        client.on(ClientEvent.Room, onRoom);
        timer = setTimeout(() => handle.onTimeout(), NEW_ROOM_SYNC_TIMEOUT_MS);
        return await handle.result;
    } catch (err) {
        // The room exists on the server either way — a wait that broke must not
        // turn a successful create into a rejected one.
        console.warn(`[matrix] waiting for created room ${roomId} failed`, err);
        return null;
    } finally {
        if (timer !== undefined) clearTimeout(timer);
        client.off(ClientEvent.Room, onRoom);
    }
}

/**
 * Settle a room this client just created: wait for it to land, configure crypto
 * for it, and backfill. Best-effort throughout — a room that never arrives is
 * still a room the caller can open, and the failure surfaces at send time
 * exactly as it does today.
 *
 * NEVER rejects, and that is load-bearing rather than tidy: both creators await
 * this AFTER the server has already committed the room, so a rejection here
 * would report a create that succeeded as a failure and strand the user with a
 * room they were told they do not have. Every step below is guarded.
 *
 * Configuring crypto here is belt-and-braces, and cheap: the sync loop runs its
 * own `onCryptoEvent` (matrix-js-sdk `sync.js:1194-1200`) strictly BEFORE it
 * emits `ClientEvent.Room` (`:1243`), so on the happy path the encryptor already
 * exists by the time the wait resolves and `ensureRoomCryptoConfigured` costs
 * one map lookup.
 *
 * It is NOT a cure for the federated-stub case CLAUDE.md documents: that helper
 * returns early on a room with no `m.room.encryption` state event, which is
 * exactly what a stub is, so it only does anything once `seedRoomStateIfMissing`
 * has injected the state.
 */
async function settleCreatedRoom(roomId: string): Promise<void> {
    // Captured before the wait: an account switch mid-wait swaps the module
    // global, and backfilling this room belongs to the client that created it.
    const client = matrixClient;
    // `.catch` and not a bare await: awaitCreatedRoom resolves null on every
    // reachable failure, but its listener teardown sits outside its own catch.
    const room = await awaitCreatedRoom(roomId).catch(() => null);
    if (!room) {
        console.warn(
            `[matrix] created room ${roomId} did not arrive over sync in time`,
        );
        return;
    }
    // Guarded despite crypto.ts's own try/catch: that one wraps the hook call
    // only, while the `room.getLiveTimeline().getState(...)` read that feeds it
    // sits outside, so a room without live timeline state throws straight
    // through.
    try {
        await ensureRoomCryptoConfigured(room);
    } catch (err) {
        console.warn(`[matrix] could not configure crypto for ${roomId}`, err);
    }
    // Backfill is a bonus, not a contract. `scrollback` does synchronous work
    // before it hands back a promise, so `.catch()` alone would not hold a
    // throw — and a create that already succeeded must never reject here.
    try {
        await client?.scrollback(room, 30);
    } catch {
        /* no history is survivable; the room still opens */
    }
}

// Follow-ups that failed after their room was already created, kept in memory
// for the session. Two readers, and only two: `createDirectMessage` looks up a
// stranded DM so an immediate retry reuses that room instead of creating a
// second one plus a second invite (the TX-01 duplicate), and `runFollowUp`
// clears the entry once a retry lands.
//
// It does NOT dedupe room creation generally: nothing reads a `space-link`
// entry back out, so re-running "Create room" after a failed space link still
// makes a second room. A named room has no dedupe key — two rooms with the same
// name are a legitimate thing to want — so there is nothing to match on.
//
// Exactly ONE registry per module: a per-call one would never see the earlier
// failure it exists for.
const pendingFollowUps = createPendingFollowUps();

/**
 * Write `m.direct` for a DM room.
 *
 * `addToMDirect` is what makes this IDEMPOTENT, and idempotence is the whole
 * reason a retry is safe to offer: this function is re-run by
 * `retryRoomFollowUp`, and an "unconfirmed" write may already have landed on
 * the server, so the same (userId, roomId) pair is written twice by design.
 * Do NOT inline it back to `[...(cur[userId] ?? []), roomId]` — that appends
 * unconditionally, so every retry grows the list, and a room listed twice in
 * `m.direct` is a DM shown twice in the sidebar with no way for the user to
 * clear it. (No unit test guards this; `client.ts` has no test harness.)
 */
async function writeDmDirectory(userId: string, roomId: string): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const cur = matrixClient.getAccountData(EventType.Direct)?.getContent() as
        Record<string, string[]> | undefined;
    await matrixClient.setAccountData(
        EventType.Direct,
        addToMDirect(cur, userId, roomId),
    );
}

/** Perform one follow-up write. Both variants are idempotent. */
async function performFollowUp(task: RoomFollowUpTask): Promise<void> {
    if (task.kind === "space-link") {
        await addRoomToSpace(task.spaceId, task.roomId);
        return;
    }
    await writeDmDirectory(task.userId, task.roomId);
}

/**
 * Retry ONE follow-up that failed after its room was created — the recovery
 * path for a partially-successful creation. Never creates a room.
 *
 * Bounded, and ONLY here. `setAccountData` awaits the `/sync` remote echo after
 * its PUT with no timeout of its own (matrix-js-sdk 41), so when sync is wedged
 * — precisely the condition that failed the write in the first place — an
 * unbounded retry never resolves: the toast that carried the button has already
 * expired, so the user is left with no recovery affordance AND no signal.
 * The first attempt inside createRoom/createDirectMessage is deliberately left
 * unbounded: it runs while the user is still watching the creation form, and
 * bounding it would change creation latency behaviour for everyone.
 */
export async function retryRoomFollowUp(
    task: RoomFollowUpTask,
): Promise<RoomFollowUp> {
    return runFollowUpBounded(task, performFollowUp, pendingFollowUps);
}

export async function createRoom(
    name: string,
    topic: string,
    spaceId?: string,
    encrypt = false,
    videoRoom = false,
): Promise<RoomCreationResult> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    // When encrypting, turn it on at creation via initial_state (cleaner and
    // race-free vs. a follow-up state event). Encryption is irreversible.
    const initialState = encryptionInitialState(encrypt);
    // A video room is marked by its immutable m.room.create type. The
    // call-friendly power levels below are already applied to every room this
    // client creates, so a video room needs nothing extra there.
    const creationContent = videoRoomCreationContent(videoRoom);
    const result = await matrixClient.createRoom({
        name: name || undefined,
        topic: topic || undefined,
        visibility: "private" as any,
        preset: "private_chat" as any,
        power_level_content_override: {
            events: { ...CALL_POWER_LEVEL_EVENTS },
        },
        ...(creationContent ? { creation_content: creationContent } : {}),
        ...(initialState ? { initial_state: initialState as any } : {}),
    });
    const roomId = result.room_id;
    // The room now EXISTS. A failed space link must not be reported as a
    // failed creation — that is what makes the user retry into a duplicate.
    const followUp = spaceId
        ? await runFollowUp(
              { kind: "space-link", roomId, spaceId },
              performFollowUp,
              pendingFollowUps,
          )
        : NO_FOLLOW_UP;
    // Supersedes a bare getRoom()+scrollback: createRoom is a bare POST, so the
    // store does not hold this room yet and scrollback would find nothing to
    // backfill. This waits for it to arrive, configures crypto, then backfills.
    await settleCreatedRoom(roomId);
    // Scheduled AFTER the wait, and that ordering is what makes it safe — do
    // not hoist it. The reconcile diffs the server's joined list against the
    // store and escalates a room it cannot materialize to clearCacheAndReload:
    // stop the client, delete IndexedDB, reload. It cannot materialize this one
    // — joinRoom returns a Room built by SyncApi.createRoom that is never
    // stored, so getRoom() stays null. Master scheduled it without waiting at
    // all, so the reconcile could run while the room was absent; waiting first
    // makes that the exception, not the default. Rare, not impossible: on a
    // NEW_ROOM_SYNC_TIMEOUT_MS timeout getRoom() is still null here.
    scheduleJoinedRoomsReconcile();
    return { roomId, followUp };
}

export async function createSpace(
    name: string,
    topic: string,
): Promise<string> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const result = await matrixClient.createRoom({
        name: name || undefined,
        topic: topic || undefined,
        visibility: "private" as any,
        preset: "private_chat" as any,
        creation_content: { type: "m.space" },
        power_level_content_override: {
            events: { "m.space.child": 0 },
        },
    });
    scheduleJoinedRoomsReconcile();
    return result.room_id;
}

export function canAddRoomToSpace(spaceId: string): boolean {
    const space = matrixClient?.getRoom(spaceId);
    if (!space) return false;
    const myLevel = getMyPowerLevel(space);
    const pl = getRoomPowerLevels(space);
    // Tolerate a pre-v10 numeric-string level in the events map; fall back to
    // the already-defaulted state_default when the key is absent.
    const required = coercePl(pl.events["m.space.child"], pl.state_default);
    return myLevel >= required;
}

export async function addRoomToSpace(
    spaceId: string,
    roomId: string,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const userId = matrixClient.getUserId() ?? "";
    const serverName = userId.includes(":") ? userId.split(":")[1] : "";
    await (matrixClient as any).sendStateEvent(
        spaceId,
        "m.space.child",
        { via: serverName ? [serverName] : [] },
        roomId,
    );
}

export interface UserSearchResult {
    userId: string;
    displayName: string | null;
    /** http thumbnail URL, ready for <img src> */
    avatarUrl: string | null;
}

/** The logged-in account's server name (the part after `:` in your own user id). */
export function getOwnServerName(): string {
    return matrixClient?.getDomain() ?? "";
}

/** Search the homeserver's user directory (user IDs, display names, domains). */
export async function searchUserDirectory(
    term: string,
    limit = 10,
): Promise<{ users: UserSearchResult[]; limited: boolean }> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const res = await matrixClient.searchUserDirectory({ term, limit });
    const users = mapUserSearchResults(res.results, {
        ownUserId: matrixClient.getUserId(),
        term,
    }).map((u) => ({
        userId: u.userId,
        displayName: u.displayName,
        avatarUrl: mxcToHttp(u.avatarMxc, 64),
    }));
    return { users, limited: res.limited };
}

/** In-flight DM creates, keyed by active account + contact. See below. */
const dmCreatesByUser = createInFlightByKey<RoomCreationResult>();
/** Per-contact "wants encryption?" so a racing caller can't pin a DM plaintext. */
const dmEncryptIntent = createDmEncryptIntent();

/**
 * Open (or reuse) the DM with `userId`.
 *
 * Concurrent calls for the same contact are collapsed onto the first one. They
 * have to be: the reuse check below reads `m.direct` account data that a
 * simultaneous create has not written yet, so two overlapping calls both miss
 * it and create two DM rooms for one contact — and with encryption now on by
 * default but overridable, possibly one encrypted and one not. The UI cannot
 * prevent this on its own; a component guard dies with the component, and the
 * call menu unmounts the moment its backdrop is clicked.
 *
 * Two consequences, both deliberate:
 * - The key is released when the call SETTLES, failure included. A rejected
 *   promise left in the map would fail every later attempt for that contact
 *   for the rest of the session.
 * - A joiner's `encrypt` argument is IGNORED — it gets the first caller's room,
 *   with the first caller's encryption choice. That is the honest trade for not
 *   creating a second room; the alternative is exactly the bug above. In
 *   practice the surfaces all read the same setting, so they agree.
 */
export function createDirectMessage(
    userId: string,
    encrypt = false,
): Promise<RoomCreationResult> {
    const ownUserId = matrixClient?.getUserId() ?? "";
    const key = dmDedupeKey(ownUserId, userId);
    // A null key means the owner id isn't known yet: deduping on a degenerate
    // key would let a pre-whoami call and a post-whoami call mint two rooms.
    if (!key) throw new Error(t("client.notLoggedIn"));
    dmEncryptIntent.raise(key, encrypt);
    return dmCreatesByUser.run(key, () =>
        // Read the intent at create time (below, in openDirectMessage) so a
        // `true` raised by a later concurrent caller before the room is built
        // still wins; clear it once this create settles.
        openDirectMessage(userId, () =>
            dmEncryptIntent.resolve(key, encrypt),
        ).finally(() => dmEncryptIntent.clear(key)),
    );
}

async function openDirectMessage(
    userId: string,
    getEncrypt: () => boolean,
): Promise<RoomCreationResult> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    // Reuse existing DM room if one exists. An existing DM keeps its own
    // encryption state — we never change it here (encryption is irreversible).
    const existing = matrixClient
        .getAccountData(EventType.Direct)
        ?.getContent() as Record<string, string[]> | undefined;
    // Reuse the first room we are actually JOINED to — never blindly [0]. A
    // stale first entry (a DM the user left/forgot, or a federated room whose
    // state never synced so the client doesn't hold it) has no "join"
    // membership; checking only [0] made a dead first entry skip a live DM at
    // [1+] and mint a duplicate room on every open. See utils/dmReuse.
    const reusable = firstReusableDmRoom(existing?.[userId], (id) =>
        matrixClient?.getRoom(id)?.getMyMembership(),
    );
    if (reusable) return { roomId: reusable, followUp: NO_FOLLOW_UP };
    // A DM whose m.direct write failed earlier this session is NOT in m.direct,
    // so the check above cannot see it. Retry that write against the existing
    // room rather than creating a second room (and a second invite).
    //
    // isRoomGone answers "definitively gone", not "usable" — see its own doc
    // for why an unseen room must NOT count as gone.
    //
    // The deliberate trade, stated plainly: if the room really was created but
    // /sync never delivers it (a correlated server degradation — the same
    // outage that failed the m.direct write can also stall sync), membership
    // stays undefined forever, isRoomGone stays false, and every later
    // createDirectMessage for this partner hands back a room the user cannot
    // open. They are soft-locked out of DMing that person until they reload,
    // which drops the registry. That is the right side to err on: the failure
    // mode is one unusable room in one page session, recovered by a reload,
    // versus silently minting duplicate rooms and duplicate invites — which is
    // permanent, visible to the other user, and cannot be undone by a reload.
    const stranded = strandedDmRoom(pendingFollowUps, userId, (id) =>
        isRoomGone(matrixClient?.getRoom(id)?.getMyMembership()),
    );
    if (stranded) {
        const followUp = await runFollowUp(
            stranded,
            performFollowUp,
            pendingFollowUps,
        );
        // Same warm-up the fresh-creation path does: this room is about to be
        // opened, and without it the timeline starts empty until /sync fills
        // it. Best-effort — a failed backfill must not fail the reuse.
        const room = matrixClient.getRoom(stranded.roomId);
        if (room) await matrixClient.scrollback(room, 30).catch(() => {});
        return { roomId: stranded.roomId, followUp };
    }
    const initialState = encryptionInitialState(getEncrypt());
    // A cross-server DM created at the homeserver's newest default room version
    // can have its invite rejected by the invitee's server (v12's m.room.create
    // fails federated invite validation on some servers → the invite never
    // lands and the DM presents as an "Empty room"). Cap cross-server DMs at a
    // federation-safe version; same-server DMs keep the server default.
    const rv = await getRoomVersionCapability().catch(() => ({
        default: "",
        available: [] as string[],
    }));
    const roomVersion = pickDmRoomVersion({
        inviteeUserId: userId,
        ownUserId: matrixClient.getUserId() ?? "",
        available: rv.available,
        default: rv.default,
    });
    const result = await matrixClient.createRoom({
        invite: [userId],
        is_direct: true,
        preset: "trusted_private_chat" as any,
        visibility: "private" as any,
        power_level_content_override: {
            events: { ...CALL_POWER_LEVEL_EVENTS },
        },
        ...(roomVersion ? { room_version: roomVersion } : {}),
        ...(initialState ? { initial_state: initialState as any } : {}),
    });
    const roomId = result.room_id;
    // The room and the invite are already on the server. A failed m.direct
    // write only means the room is not FILED as a DM yet — say exactly that.
    // Goes through runFollowUp/writeDmDirectory rather than an inline
    // setAccountData: the inline form appends unconditionally, so a retry lists
    // the room twice in m.direct and the DM appears twice in the sidebar.
    const followUp = await runFollowUp(
        { kind: "dm-account-data", roomId, userId },
        performFollowUp,
        pendingFollowUps,
    );
    // Do not resolve until the room is real and crypto knows about it: the
    // caller opens this room immediately, and the SDK sends PLAINTEXT into a
    // room it does not yet hold. Supersedes a bare getRoom()+scrollback for the
    // same reason as the fresh-creation path above.
    await settleCreatedRoom(roomId);
    return { roomId, followUp };
}

/**
 * Turn on encryption for an existing room by sending the `m.room.encryption`
 * state event with the standard Megolm algorithm. IRREVERSIBLE — the Matrix
 * spec has no way to switch encryption back off. Callers must gate on power
 * level (see `getEnableEncryptionState`) and confirm intent first. Throws on
 * failure (e.g. insufficient power level); the caller surfaces the error.
 */
export async function enableRoomEncryption(roomId: string): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    await (matrixClient as any).sendStateEvent(
        roomId,
        ROOM_ENCRYPTION_EVENT_TYPE,
        { algorithm: ENCRYPTION_ALGORITHM },
        "",
    );
}

/** Invite a user to an existing room or space. Throws on failure (caller surfaces). */
export async function inviteUser(
    roomId: string,
    userId: string,
    reason?: string,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    await matrixClient.invite(roomId, userId, reason);
}

/**
 * Invite someone to a room by email (3PID). Requires the homeserver to have a
 * configured identity server (see {@link getIdentityServer}); rejects with the
 * server's error otherwise. Throws on failure (caller surfaces).
 */
export async function inviteEmailToRoom(
    roomId: string,
    address: string,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    await matrixClient.inviteByThreePid(roomId, "email", address);
}

/** The client's configured identity-server base URL, or undefined if none is set. */
export function getIdentityServer(): string | undefined {
    return matrixClient?.getIdentityServerUrl();
}

/** User ids currently in the room with any of the given memberships (default join+invite). */
export function getRoomMemberIds(
    roomId: string,
    memberships: string[] = ["join", "invite"],
): string[] {
    const room = matrixClient?.getRoom(roomId);
    if (!room) return [];
    return room
        .getMembers()
        .filter((m) => memberships.includes(m.membership ?? ""))
        .map((m) => m.userId);
}

/**
 * Whether the current user may invite to this room. Normal path: power level ≥
 * the room's `invite` PL. Room-v12 (MSC4289) creators are handled by
 * getUserPowerLevel's shared effective-level rule.
 */
export function canInviteToRoom(roomId: string): boolean {
    const room = matrixClient?.getRoom(roomId);
    const me = matrixClient?.getUserId();
    if (!room || !me) return false;
    // getRoomPowerLevels now applies the spec `invite` default of 0 (v1.4) and
    // coerces pre-v10 numeric-string levels; getUserPowerLevel already lifts a
    // v12 creator (its bespoke creator branch is the shared, version-gated rule).
    return getUserPowerLevel(room, me) >= getRoomPowerLevels(room).invite;
}

export function getInvitedRooms(): Room[] {
    if (!matrixClient) return [];
    return matrixClient
        .getRooms()
        .filter((r) => r.getMyMembership() === "invite");
}

export async function acceptInvite(roomId: string): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    // Read whether this invite is a direct (1:1) chat and who sent it BEFORE
    // joining — once we join, the invite membership we inspect is superseded.
    const inviteRoom = matrixClient.getRoom(roomId);
    const me = inviteRoom?.getMember(matrixClient.getUserId()!);
    const isDirect = me?.events.member?.getContent().is_direct === true;
    const inviter = inviteRoom ? getInviteSender(inviteRoom) : null;
    // Membership keeps reading "invite" until the join comes back over /sync;
    // claim the room as landable meanwhile so no refresh moves the user off it.
    markRoomPendingArrival(roomId);
    try {
        await matrixClient.joinRoom(roomId);
    } catch (e) {
        pendingJoins.delete(roomId);
        throw e;
    }
    // Record peer-initiated DMs in m.direct so they surface in the DM section,
    // mirroring what createDirectMessage does for self-initiated DMs. Best-effort:
    // a failed account-data write must not strand the user after a joined room.
    if (isDirect && inviter) {
        const cur =
            (matrixClient.getAccountData(EventType.Direct)?.getContent() as
                Record<string, string[]> | undefined) ?? {};
        await matrixClient
            .setAccountData(
                EventType.Direct,
                addToMDirect(cur, inviter, roomId),
            )
            .catch(() => {});
    }
    // Accepting an invite leaves the room holding only what invite_state
    // shipped — create, name, join_rules, a couple of member events — and the
    // server never re-delivers the rest for a room it already streamed to us.
    // Force the seed: the usual "has no m.room.create" test can't detect this,
    // since those events are perfectly real. Without it a bridged SPACE joined
    // by invite has zero m.space.child edges, so it lists no channels and every
    // room joined inside it is filed as an orphan into Home (2026-07-26).
    await seedRoomStateIfMissing(roomId, true);
    const room = matrixClient.getRoom(roomId);
    if (room) await matrixClient.scrollback(room, 30).catch(() => {});
    scheduleJoinedRoomsReconcile();
}

export async function rejectInvite(roomId: string): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    await matrixClient.leave(roomId);
}

/**
 * Knock on a room (request to join). Resolves to the room id; the membership
 * becomes "knock" via sync. Knocking an already-knocked room is a server-side
 * no-op.
 */
export async function knockRoom(
    roomIdOrAlias: string,
    reason?: string,
    via?: string[],
): Promise<string> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const result = await matrixClient.knockRoom(
        roomIdOrAlias,
        buildKnockOpts(reason, via),
    );
    return result.room_id;
}

export function getKnockedRooms(): Room[] {
    if (!matrixClient) return [];
    return matrixClient
        .getRooms()
        .filter((r) => r.getMyMembership() === "knock");
}

/** Retract a pending knock by leaving the room. */
export async function cancelKnock(roomId: string): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    await matrixClient.leave(roomId);
}

export function getInviteSender(room: Room): string | null {
    const me = matrixClient?.getUserId();
    if (!me) return null;
    const member = room.getMember(me);
    return member?.events.member?.getSender() ?? null;
}

export interface ReactionGroup {
    key: string;
    count: number;
    isMine: boolean; // true even while local echo is pending
    myEventId: string | null; // only set once server-confirmed (used for removal)
    reactorIds: string[]; // deduped non-null senders for this key
}

export function getReactions(room: Room, eventId: string): ReactionGroup[] {
    if (!matrixClient) return [];
    try {
        const relations = room.relations.getChildEventsForEvent(
            eventId,
            "m.annotation",
            "m.reaction",
        );
        if (!relations) return [];

        const ownUserId = matrixClient.getUserId();
        // Dedupe + own-reaction counting lives in a pure, unit-tested helper.
        const annotations: ReactionAnnotation[] = relations
            .getRelations()
            .map((e) => ({
                sender: e.getSender() ?? null,
                key: e.getContent()?.["m.relates_to"]?.key ?? "",
                id: e.getId() ?? null,
                status: e.status,
                isRedacted: e.isRedacted(),
            }));
        return countReactions(annotations, ownUserId);
    } catch {
        return [];
    }
}

export async function sendReaction(
    roomId: string,
    eventId: string,
    key: string,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    // Deduplicate: don't send if user already has this reaction (including local echoes)
    const room = matrixClient.getRoom(roomId);
    if (room) {
        const existing = getReactions(room, eventId);
        if (existing.some((g) => g.key === key && g.isMine)) return;
    }
    await matrixClient.sendEvent(
        roomId,
        "m.reaction" as never,
        {
            "m.relates_to": {
                rel_type: "m.annotation",
                event_id: eventId,
                key,
            },
        } as never,
    );
}

export async function removeReaction(
    roomId: string,
    reactionEventId: string,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    await matrixClient.redactEvent(roomId, reactionEventId);
}

export async function deleteMessage(
    roomId: string,
    eventId: string,
    reason?: string,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    // 4-arg form: txnId undefined (SDK generates one), opts carries the
    // optional redaction reason. Omitting opts entirely when there is no
    // reason keeps the request byte-identical to the old 2-arg call.
    try {
        await matrixClient.redactEvent(
            roomId,
            eventId,
            undefined,
            reason ? { reason } : undefined,
        );
    } catch (err) {
        // audit UX-03: Failed delete must not look successful. On error, the
        // SDK's local redaction echo stays in getPendingEvents() with status
        // NOT_SENT (room.ts reverts only on CANCELLED), so the UI still hides
        // the message. Cancel the echo so it reappears.
        const room = matrixClient.getRoom(roomId);
        if (room) {
            const echo = findFailedRedactionEcho(
                room.getPendingEvents(),
                eventId,
                EventStatus.NOT_SENT,
            );
            if (echo) {
                // Keep the redaction error as the one callers see.
                try {
                    matrixClient.cancelPendingEvent(echo);
                } catch (cancelErr) {
                    console.warn(
                        "[deleteMessage] cancel of failed redaction echo failed",
                        cancelErr,
                    );
                }
            }
        }
        throw err;
    }
}

/**
 * Report an event to the homeserver admins as inappropriate.
 * `score` ranges -100 (most offensive) to 0 (inoffensive).
 */
export async function reportEvent(
    roomId: string,
    eventId: string,
    score: number,
    reason: string,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    await matrixClient.reportEvent(roomId, eventId, score, reason);
}

export interface CustomEmoji {
    shortcode: string;
    mxcUrl: string; // mxc:// url (used in formatted_body so other clients can proxy it)
    url: string; // http url (used for display in our own picker)
    // MSC2545 image-pack metadata, carried through so a sticker send can echo
    // the pack's declared info (w/h/mimetype/size) and body. Absent for packs
    // that don't declare them (and unused for emoticon rendering).
    info?: Record<string, unknown>;
    body?: string;
}

export interface CustomEmojiPack {
    id: string; // 'user' or a room ID
    name: string;
    avatarUrl?: string; // http avatar URL for space packs
    roomId?: string;
    stateKey?: string;
    sourceName?: string;
    inherited?: boolean;
    emojis: CustomEmoji[];
}

interface RoomEmoteImageContent {
    url?: string;
    usage?: string[];
    [key: string]: unknown;
}

interface RoomEmoteContent {
    images?: Record<string, RoomEmoteImageContent>;
    pack?: {
        display_name?: string;
        avatar_url?: string;
        attribution?: string;
        usage?: string[];
        [key: string]: unknown;
    };
    [key: string]: unknown;
}

// Sticker types mirror emoji types
export type CustomSticker = CustomEmoji;

export type ImageUsage = "emoticon" | "sticker";

export interface CustomPackImage extends CustomEmoji {
    usage: ImageUsage[];
    canEmoji: boolean;
    canSticker: boolean;
}

export interface CustomImagePack {
    id: string;
    name: string;
    avatarUrl?: string;
    roomId?: string;
    stateKey?: string;
    sourceName?: string;
    inherited?: boolean;
    /** MSC2545 pack.attribution (credit for the artwork). */
    attribution?: string;
    /** Pack-level usage default, when the pack declares one. */
    usage?: ImageUsage[];
    /** Enabled globally via im.ponies.emote_rooms (usable in every room). */
    global?: boolean;
    images: CustomPackImage[];
}

export interface CustomStickerPack {
    id: string;
    name: string;
    avatarUrl?: string;
    roomId?: string;
    stateKey?: string;
    sourceName?: string;
    inherited?: boolean;
    stickers: CustomSticker[];
}

// Effective usage: image-level overrides pack-level; absent at both levels means both kinds.
function matchesUsage(
    imageUsage: string[] | undefined,
    packUsage: string[] | undefined,
    kind: ImageUsage,
): boolean {
    const effective =
        imageUsage && imageUsage.length > 0 ? imageUsage : packUsage;
    if (!effective || effective.length === 0) return true;
    return effective.includes(kind);
}

function effectiveUsage(
    imageUsage: string[] | undefined,
    packUsage: string[] | undefined,
): ImageUsage[] {
    const raw =
        imageUsage && imageUsage.length > 0 ? imageUsage : (packUsage ?? []);
    const usage = raw.filter(
        (u): u is ImageUsage => u === "emoticon" || u === "sticker",
    );
    return usage.length > 0 ? usage : ["emoticon", "sticker"];
}

/** Optional MSC2545 image `info` / `body` written alongside a new image. */
export interface PackImageMeta {
    info?: Record<string, unknown>;
    body?: string;
}

// MSC2545 per-image metadata (info/body), forwarded onto CustomEmoji so a
// sticker send can echo it. Only present when the pack declares them, so packs
// without info degrade to today's behaviour.
function packImageMeta(data: {
    info?: unknown;
    body?: unknown;
    [key: string]: unknown;
}): {
    info?: Record<string, unknown>;
    body?: string;
} {
    const meta: { info?: Record<string, unknown>; body?: string } = {};
    if (data.info && typeof data.info === "object") {
        meta.info = data.info as Record<string, unknown>;
    }
    if (typeof data.body === "string") meta.body = data.body;
    return meta;
}

function roomEmoteContentToPackImages(
    content: RoomEmoteContent,
): CustomPackImage[] {
    const images = content.images ?? {};
    const packUsage = content.pack?.usage;
    return Object.entries(images)
        .filter(([, data]) => data?.url?.startsWith("mxc://"))
        .flatMap(([shortcode, data]) => {
            const http = mxcToHttp(data.url!);
            if (!http) return [];
            const usage = effectiveUsage(data.usage, packUsage);
            return [
                {
                    shortcode,
                    mxcUrl: data.url!,
                    url: http,
                    usage,
                    canEmoji: usage.includes("emoticon"),
                    canSticker: usage.includes("sticker"),
                    ...packImageMeta(data),
                },
            ];
        });
}

function packAvatarUrl(
    content: RoomEmoteContent,
    room: Room,
): string | undefined {
    const avatar = content.pack?.avatar_url;
    if (typeof avatar === "string" && avatar.startsWith("mxc://")) {
        const http = mxcToHttp(avatar, 64);
        if (http) return http;
    }
    return getRoomStateAvatar(room) ?? undefined;
}

function packUsageList(content: RoomEmoteContent): ImageUsage[] | undefined {
    const usage = (content.pack?.usage ?? []).filter(
        (u): u is ImageUsage => u === "emoticon" || u === "sticker",
    );
    return usage.length > 0 ? usage : undefined;
}

function roomPackFromEvent(room: Room, event: MatrixEvent): CustomImagePack {
    const content = event.getContent() as RoomEmoteContent;
    const stateKey = event.getStateKey() ?? "";
    return {
        id: `${room.roomId}:${stateKey}`,
        roomId: room.roomId,
        stateKey,
        name:
            content.pack?.display_name ||
            stateKey ||
            t("client.emotes", {
                value: room.name || t("client.room"),
            }),
        sourceName: room.name || room.roomId,
        avatarUrl: packAvatarUrl(content, room),
        attribution: content.pack?.attribution || undefined,
        usage: packUsageList(content),
        images: roomEmoteContentToPackImages(content),
    };
}

function imagePackToEmojiPack(
    pack: CustomImagePack,
    kind: ImageUsage,
): CustomEmojiPack {
    return {
        id: pack.id,
        name: pack.name,
        avatarUrl: pack.avatarUrl,
        roomId: pack.roomId,
        stateKey: pack.stateKey,
        sourceName: pack.sourceName,
        inherited: pack.inherited,
        emojis: pack.images
            .filter((i) => (kind === "emoticon" ? i.canEmoji : i.canSticker))
            .map((i) => ({
                shortcode: i.shortcode,
                mxcUrl: i.mxcUrl,
                url: i.url,
                ...(i.info ? { info: i.info } : {}),
                ...(i.body !== undefined ? { body: i.body } : {}),
            })),
    };
}

function roomEmoteContentToImages(
    content: RoomEmoteContent,
    kind: ImageUsage,
): CustomEmoji[] {
    const images = content.images ?? {};
    const packUsage = content.pack?.usage;
    return Object.entries(images)
        .filter(
            ([, data]) =>
                data?.url?.startsWith("mxc://") &&
                matchesUsage(data.usage, packUsage, kind),
        )
        .flatMap(([shortcode, data]) => {
            const http = mxcToHttp(data.url!);
            return http
                ? [
                      {
                          shortcode,
                          mxcUrl: data.url!,
                          url: http,
                          ...packImageMeta(data),
                      },
                  ]
                : [];
        });
}

function getRoomEmotePacksBase(room: Room): CustomImagePack[] {
    const events =
        room
            .getLiveTimeline()
            .getState(EventTimeline.FORWARDS)
            ?.getStateEvents("im.ponies.room_emotes") ?? [];
    const arr = Array.isArray(events) ? events : [events];
    const globals = emoteRoomsContent();
    return arr
        .map((event) => {
            const pack = roomPackFromEvent(room, event);
            return hasEmoteRoom(globals, room.roomId, pack.stateKey ?? "")
                ? { ...pack, global: true }
                : pack;
        })
        .filter((pack) => pack.images.length > 0);
}

function getRoomImagePacks(room: Room, kind: ImageUsage): CustomEmojiPack[] {
    const events =
        room
            .getLiveTimeline()
            .getState(EventTimeline.FORWARDS)
            ?.getStateEvents("im.ponies.room_emotes") ?? [];
    const arr = Array.isArray(events) ? events : [events];
    return arr
        .map((event) => {
            const content = event.getContent() as RoomEmoteContent;
            const stateKey = event.getStateKey() ?? "";
            const emojis = roomEmoteContentToImages(content, kind);
            return {
                id: `${room.roomId}:${stateKey}`,
                roomId: room.roomId,
                stateKey,
                name:
                    content.pack?.display_name ||
                    stateKey ||
                    `${room.name || t("client.room")} ${kind === "sticker" ? t("common.stickers") : t("client.emojis")}`,
                sourceName: room.name || room.roomId,
                avatarUrl: packAvatarUrl(content, room),
                emojis,
            };
        })
        .filter((pack) => pack.emojis.length > 0);
}

export function getRoomEmotePacks(room: Room): CustomImagePack[] {
    try {
        return getRoomEmotePacksBase(room);
    } catch {
        return [];
    }
}

export function getRoomEmojiPacks(room: Room): CustomEmojiPack[] {
    try {
        return getRoomImagePacks(room, "emoticon");
    } catch {
        return [];
    }
}

export function getRoomEmojiPack(room: Room): CustomEmoji[] {
    return getRoomEmojiPacks(room).flatMap((pack) => pack.emojis);
}

export function getRoomStickerPacks(room: Room): CustomStickerPack[] {
    try {
        return getRoomImagePacks(room, "sticker").map((pack) => ({
            id: pack.id,
            name: pack.name,
            avatarUrl: pack.avatarUrl,
            roomId: pack.roomId,
            stateKey: pack.stateKey,
            sourceName: pack.sourceName,
            inherited: pack.inherited,
            stickers: pack.emojis,
        }));
    } catch {
        return [];
    }
}

export function getParentSpaceIds(roomId: string): string[] {
    if (!matrixClient) return [];
    const result: string[] = [];
    const visited = new Set<string>();

    function add(parentId: string) {
        if (visited.has(parentId)) return;
        visited.add(parentId);
        result.push(parentId);
        visit(parentId);
    }

    function visit(childId: string) {
        const child = matrixClient?.getRoom(childId);
        const parentEvents =
            child
                ?.getLiveTimeline()
                .getState(EventTimeline.FORWARDS)
                ?.getStateEvents("m.space.parent") ?? [];
        const parentArr = Array.isArray(parentEvents)
            ? parentEvents
            : [parentEvents];
        for (const event of parentArr) {
            const parentId = event.getStateKey();
            if (parentId) add(parentId);
        }

        for (const space of getSpaces()) {
            if (!getSpaceChildIds(space.roomId).includes(childId)) continue;
            add(space.roomId);
        }
    }

    visit(roomId);
    return result;
}

export function getAvailableRoomEmojiPacks(room: Room): CustomEmojiPack[] {
    if (!matrixClient) return [];
    const current = getRoomEmojiPacks(room);
    const inherited = getParentSpaceIds(room.roomId).flatMap((spaceId) => {
        const parent = matrixClient!.getRoom(spaceId);
        if (!parent) return [];
        return getRoomEmojiPacks(parent).map((pack) => ({
            ...pack,
            inherited: true,
        }));
    });
    return [...current, ...inherited];
}

export function getAvailableRoomStickerPacks(room: Room): CustomStickerPack[] {
    if (!matrixClient) return [];
    const current = getRoomStickerPacks(room);
    const inherited = getParentSpaceIds(room.roomId).flatMap((spaceId) => {
        const parent = matrixClient!.getRoom(spaceId);
        if (!parent) return [];
        return getRoomStickerPacks(parent).map((pack) => ({
            ...pack,
            inherited: true,
        }));
    });
    return [...current, ...inherited];
}

export function getAvailableRoomEmotePacks(room: Room): CustomImagePack[] {
    if (!matrixClient) return [];
    const current = getRoomEmotePacks(room);
    const inherited = getParentSpaceIds(room.roomId).flatMap((spaceId) => {
        const parent = matrixClient!.getRoom(spaceId);
        if (!parent) return [];
        return getRoomEmotePacks(parent).map((pack) => ({
            ...pack,
            inherited: true,
        }));
    });
    return [...current, ...inherited];
}

function normalizeEmojiShortcode(shortcode: string): string {
    return shortcode.trim().replace(/^:+|:+$/g, "");
}

function isValidEmojiShortcode(shortcode: string): boolean {
    return /^[A-Za-z0-9_.+-]+$/.test(shortcode);
}

export function validateEmojiShortcode(shortcode: string): string | null {
    const normalized = normalizeEmojiShortcode(shortcode);
    if (!normalized) return t("client.enterAShortcode");
    if (!isValidEmojiShortcode(normalized)) {
        return t("client.useOnlyLettersNumbersDotsUnderscores");
    }
    return null;
}

async function fetchRoomEmoteContent(
    roomId: string,
    stateKey: string,
): Promise<RoomEmoteContent> {
    try {
        return ((await matrixClient?.getStateEvent(
            roomId,
            "im.ponies.room_emotes",
            stateKey,
        )) ?? {}) as RoomEmoteContent;
    } catch {
        return {};
    }
}

function withUsage(usage: string[] | undefined, kind: ImageUsage): string[] {
    return [...new Set([...(usage ?? []), kind])];
}

function normalizeUsage(usage: ImageUsage[]): ImageUsage[] {
    return [...new Set(usage)].filter(
        (u): u is ImageUsage => u === "emoticon" || u === "sticker",
    );
}

async function setRoomPackImageUsage(
    roomId: string,
    stateKey: string,
    shortcode: string,
    usage: ImageUsage[],
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const normalized = normalizeEmojiShortcode(shortcode);
    const nextUsage = normalizeUsage(usage);
    if (nextUsage.length === 0)
        throw new Error(t("client.chooseAtLeastOneUsage"));
    const current = await fetchRoomEmoteContent(roomId, stateKey);
    const images = { ...(current.images ?? {}) };
    const existing = images[normalized];
    if (!existing?.url) throw new Error(t("client.imageNotFound"));
    images[normalized] = {
        ...existing,
        usage: nextUsage,
    };
    await (matrixClient as any).sendStateEvent(
        roomId,
        "im.ponies.room_emotes",
        { ...current, images },
        stateKey,
    );
}

export async function setRoomEmoteUsage(
    roomId: string,
    stateKey: string,
    shortcode: string,
    usage: ImageUsage[],
): Promise<void> {
    await setRoomPackImageUsage(roomId, stateKey, shortcode, usage);
}

async function addRoomPackImage(
    roomId: string,
    stateKey: string,
    shortcode: string,
    mxcUrl: string,
    packName: string,
    kind: ImageUsage,
): Promise<string> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const normalized = normalizeEmojiShortcode(shortcode);
    const error = validateEmojiShortcode(normalized);
    if (error) throw new Error(error);

    const current = await fetchRoomEmoteContent(roomId, stateKey);
    const images = { ...(current.images ?? {}) };
    const existing = images[normalized] ?? {};
    images[normalized] = {
        ...existing,
        url: mxcUrl,
        usage: withUsage(existing.usage, kind),
    };

    await (matrixClient as any).sendStateEvent(
        roomId,
        "im.ponies.room_emotes",
        {
            ...current,
            pack: {
                ...(current.pack ?? {}),
                display_name: current.pack?.display_name ?? packName,
            },
            images,
        },
        stateKey,
    );
    return normalized;
}

export async function addRoomEmote(
    roomId: string,
    stateKey: string,
    shortcode: string,
    mxcUrl: string,
    packName: string,
    usage: ImageUsage[],
    meta?: PackImageMeta,
): Promise<string> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const normalized = normalizeEmojiShortcode(shortcode);
    const error = validateEmojiShortcode(normalized);
    const nextUsage = normalizeUsage(usage);
    if (error) throw new Error(error);
    if (nextUsage.length === 0)
        throw new Error(t("client.chooseAtLeastOneUsage"));

    const current = await fetchRoomEmoteContent(roomId, stateKey);
    const images = { ...(current.images ?? {}) };
    const existing = images[normalized] ?? {};
    images[normalized] = {
        ...existing,
        url: mxcUrl,
        usage: nextUsage,
        ...(meta?.info ? { info: meta.info } : {}),
        ...(meta?.body ? { body: meta.body } : {}),
    };
    await (matrixClient as any).sendStateEvent(
        roomId,
        "im.ponies.room_emotes",
        {
            ...current,
            pack: {
                ...(current.pack ?? {}),
                display_name: current.pack?.display_name ?? packName,
            },
            images,
        },
        stateKey,
    );
    return normalized;
}

export async function addRoomEmoji(
    roomId: string,
    stateKey: string,
    shortcode: string,
    mxcUrl: string,
    packName: string,
): Promise<string> {
    return addRoomPackImage(
        roomId,
        stateKey,
        shortcode,
        mxcUrl,
        packName,
        "emoticon",
    );
}

export async function addRoomSticker(
    roomId: string,
    stateKey: string,
    shortcode: string,
    mxcUrl: string,
    packName: string,
): Promise<string> {
    return addRoomPackImage(
        roomId,
        stateKey,
        shortcode,
        mxcUrl,
        packName,
        "sticker",
    );
}

async function removeRoomPackImage(
    roomId: string,
    stateKey: string,
    shortcode: string,
    kind: ImageUsage,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const normalized = normalizeEmojiShortcode(shortcode);
    const current = await fetchRoomEmoteContent(roomId, stateKey);
    const images = { ...(current.images ?? {}) };
    const existing = images[normalized];

    if (existing) {
        const usage = existing.usage?.length ? existing.usage : undefined;
        const packUsage = current.pack?.usage?.length
            ? current.pack.usage
            : undefined;
        const otherKind = kind === "emoticon" ? "sticker" : "emoticon";
        if (usage?.includes(otherKind)) {
            images[normalized] = {
                ...existing,
                usage: usage.filter((u) => u !== kind),
            };
        } else if (!usage && (!packUsage || packUsage.includes(otherKind))) {
            images[normalized] = {
                ...existing,
                usage: [otherKind],
            };
        } else {
            delete images[normalized];
        }
    }

    await (matrixClient as any).sendStateEvent(
        roomId,
        "im.ponies.room_emotes",
        { ...current, images },
        stateKey,
    );
}

export async function removeRoomEmoji(
    roomId: string,
    stateKey: string,
    shortcode: string,
): Promise<void> {
    await removeRoomPackImage(roomId, stateKey, shortcode, "emoticon");
}

export async function removeRoomSticker(
    roomId: string,
    stateKey: string,
    shortcode: string,
): Promise<void> {
    await removeRoomPackImage(roomId, stateKey, shortcode, "sticker");
}

export async function removeRoomEmoteImage(
    roomId: string,
    stateKey: string,
    shortcode: string,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const normalized = normalizeEmojiShortcode(shortcode);
    const current = await fetchRoomEmoteContent(roomId, stateKey);
    const images = { ...(current.images ?? {}) };
    delete images[normalized];
    await (matrixClient as any).sendStateEvent(
        roomId,
        "im.ponies.room_emotes",
        { ...current, images },
        stateKey,
    );
}

function getUserPackImages(kind: ImageUsage): CustomEmoji[] {
    if (!matrixClient) return [];
    try {
        const accountData = matrixClient.getAccountData(
            "im.ponies.user_emotes",
        );
        if (!accountData) return [];
        const content = accountData.getContent();
        const images = content?.images as
            | Record<
                  string,
                  {
                      url?: string;
                      usage?: string[];
                      info?: unknown;
                      body?: unknown;
                  }
              >
            | undefined;
        if (!images) return [];
        const packUsage = (content?.pack as { usage?: string[] } | undefined)
            ?.usage;
        return Object.entries(images)
            .filter(
                ([, data]) =>
                    data?.url?.startsWith("mxc://") &&
                    matchesUsage(data.usage, packUsage, kind),
            )
            .flatMap(([shortcode, data]) => {
                const http = mxcToHttp(data.url!);
                return http
                    ? [
                          {
                              shortcode,
                              mxcUrl: data.url!,
                              url: http,
                              ...packImageMeta(data),
                          },
                      ]
                    : [];
            });
    } catch {
        return [];
    }
}

function getUserEmoteContent(): RoomEmoteContent {
    if (!matrixClient) return {};
    return (
        (matrixClient.getAccountData("im.ponies.user_emotes")?.getContent() as
            RoomEmoteContent | undefined) ?? {}
    );
}

export function getUserEmotePack(): CustomPackImage[] {
    return roomEmoteContentToPackImages(getUserEmoteContent());
}

async function fetchUserEmoteContent(): Promise<RoomEmoteContent> {
    return getUserEmoteContent();
}

async function addUserPackImage(
    shortcode: string,
    mxcUrl: string,
    packName: string,
    kind: ImageUsage,
): Promise<string> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const normalized = normalizeEmojiShortcode(shortcode);
    const error = validateEmojiShortcode(normalized);
    if (error) throw new Error(error);

    const current = await fetchUserEmoteContent();
    const images = { ...(current.images ?? {}) };
    const existing = images[normalized] ?? {};
    images[normalized] = {
        ...existing,
        url: mxcUrl,
        usage: withUsage(existing.usage, kind),
    };

    await matrixClient.setAccountData("im.ponies.user_emotes", {
        ...current,
        pack: {
            ...(current.pack ?? {}),
            display_name: current.pack?.display_name ?? packName,
        },
        images,
    });
    return normalized;
}

export async function addUserEmote(
    shortcode: string,
    mxcUrl: string,
    usage: ImageUsage[],
    meta?: PackImageMeta,
): Promise<string> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const normalized = normalizeEmojiShortcode(shortcode);
    const error = validateEmojiShortcode(normalized);
    const nextUsage = normalizeUsage(usage);
    if (error) throw new Error(error);
    if (nextUsage.length === 0)
        throw new Error(t("client.chooseAtLeastOneUsage"));

    const current = await fetchUserEmoteContent();
    const images = { ...(current.images ?? {}) };
    const existing = images[normalized] ?? {};
    images[normalized] = {
        ...existing,
        url: mxcUrl,
        usage: nextUsage,
        ...(meta?.info ? { info: meta.info } : {}),
        ...(meta?.body ? { body: meta.body } : {}),
    };
    await matrixClient.setAccountData("im.ponies.user_emotes", {
        ...current,
        pack: {
            ...(current.pack ?? {}),
            display_name: current.pack?.display_name ?? "My Emotes",
        },
        images,
    });
    return normalized;
}

export async function setUserEmoteUsage(
    shortcode: string,
    usage: ImageUsage[],
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const normalized = normalizeEmojiShortcode(shortcode);
    const nextUsage = normalizeUsage(usage);
    if (nextUsage.length === 0)
        throw new Error(t("client.chooseAtLeastOneUsage"));
    const current = await fetchUserEmoteContent();
    const images = { ...(current.images ?? {}) };
    const existing = images[normalized];
    if (!existing?.url) throw new Error(t("client.imageNotFound"));
    images[normalized] = {
        ...existing,
        usage: nextUsage,
    };
    await matrixClient.setAccountData("im.ponies.user_emotes", {
        ...current,
        images,
    });
}

async function removeUserPackImage(
    shortcode: string,
    kind: ImageUsage,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const normalized = normalizeEmojiShortcode(shortcode);
    const current = await fetchUserEmoteContent();
    const images = { ...(current.images ?? {}) };
    const existing = images[normalized];

    if (existing) {
        const usage = existing.usage?.length ? existing.usage : undefined;
        const packUsage = current.pack?.usage?.length
            ? current.pack.usage
            : undefined;
        const otherKind = kind === "emoticon" ? "sticker" : "emoticon";
        if (usage?.includes(otherKind)) {
            images[normalized] = {
                ...existing,
                usage: usage.filter((u) => u !== kind),
            };
        } else if (!usage && (!packUsage || packUsage.includes(otherKind))) {
            images[normalized] = {
                ...existing,
                usage: [otherKind],
            };
        } else {
            delete images[normalized];
        }
    }

    await matrixClient.setAccountData("im.ponies.user_emotes", {
        ...current,
        images,
    });
}

export function getUserEmojiPack(): CustomEmoji[] {
    return getUserPackImages("emoticon");
}

export function getUserStickerPack(): CustomSticker[] {
    return getUserPackImages("sticker");
}

export async function addUserEmoji(
    shortcode: string,
    mxcUrl: string,
): Promise<string> {
    return addUserPackImage(shortcode, mxcUrl, "My Emojis", "emoticon");
}

export async function removeUserEmoji(shortcode: string): Promise<void> {
    await removeUserPackImage(shortcode, "emoticon");
}

export async function addUserSticker(
    shortcode: string,
    mxcUrl: string,
): Promise<string> {
    return addUserPackImage(shortcode, mxcUrl, "My Stickers", "sticker");
}

export async function removeUserSticker(shortcode: string): Promise<void> {
    await removeUserPackImage(shortcode, "sticker");
}

export async function removeUserEmoteImage(shortcode: string): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const normalized = normalizeEmojiShortcode(shortcode);
    const current = await fetchUserEmoteContent();
    const images = { ...(current.images ?? {}) };
    delete images[normalized];
    await matrixClient.setAccountData("im.ponies.user_emotes", {
        ...current,
        images,
    });
}

// ── MSC2545 sharing: global packs, metadata, import ──────────────────────────

const EMOTE_ROOMS_KEY = "im.ponies.emote_rooms";

function emoteRoomsContent(): EmoteRoomsContent | undefined {
    return matrixClient?.getAccountData(EMOTE_ROOMS_KEY)?.getContent();
}

/** Every pack the user enabled globally, whether or not it still resolves. */
export function getEmoteRoomSubscriptions(): EmoteRoomRef[] {
    return parseEmoteRooms(emoteRoomsContent());
}

export function isPackGlobal(roomId: string, stateKey: string): boolean {
    return hasEmoteRoom(emoteRoomsContent(), roomId, stateKey);
}

/** Enable or disable a room's pack for use in every room (emote_rooms). */
export async function setPackGlobal(
    roomId: string,
    stateKey: string,
    enabled: boolean,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    await matrixClient.setAccountData(
        EMOTE_ROOMS_KEY,
        withEmoteRoom(emoteRoomsContent(), roomId, stateKey, enabled),
    );
}

/** Packs the user enabled globally that we can still read (joined rooms). */
export function getGlobalEmotePacks(): CustomImagePack[] {
    if (!matrixClient) return [];
    try {
        return getEmoteRoomSubscriptions().flatMap((ref) => {
            const room = matrixClient!.getRoom(ref.roomId);
            if (!room || room.getMyMembership() !== "join") return [];
            const event = room
                .getLiveTimeline()
                .getState(EventTimeline.FORWARDS)
                ?.getStateEvents("im.ponies.room_emotes", ref.stateKey);
            if (!event) return [];
            const pack = roomPackFromEvent(room, event);
            return pack.images.length > 0 ? [{ ...pack, global: true }] : [];
        });
    } catch {
        return [];
    }
}

/** Every pack in every joined room and space, flagged when enabled globally.
 *  Backs the "share a pack across all my rooms" list in settings. */
export function getJoinedRoomPacks(): CustomImagePack[] {
    if (!matrixClient) return [];
    try {
        return matrixClient
            .getRooms()
            .filter((room) => room.getMyMembership() === "join")
            .flatMap((room) => getRoomEmotePacks(room));
    } catch {
        return [];
    }
}

/** Enabled-globally entries that no longer resolve (left the room, pack gone),
 *  so settings can offer to drop them. */
export function getStaleEmoteSubscriptions(): EmoteRoomRef[] {
    if (!matrixClient) return [];
    const live = new Set(getGlobalEmotePacks().map((pack) => pack.id));
    return getEmoteRoomSubscriptions().filter(
        (ref) => !live.has(`${ref.roomId}:${ref.stateKey}`),
    );
}

export async function updateRoomPackMeta(
    roomId: string,
    stateKey: string,
    update: PackMetaUpdate,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const current = await fetchRoomEmoteContent(roomId, stateKey);
    await (matrixClient as any).sendStateEvent(
        roomId,
        "im.ponies.room_emotes",
        applyPackMeta(current, update),
        stateKey,
    );
}

/** Delete a room pack (MSC2545: empty content removes it) and stop sharing it. */
export async function deleteRoomPack(
    roomId: string,
    stateKey: string,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    await (matrixClient as any).sendStateEvent(
        roomId,
        "im.ponies.room_emotes",
        {},
        stateKey,
    );
    if (isPackGlobal(roomId, stateKey)) {
        await setPackGlobal(roomId, stateKey, false);
    }
}

export interface UserPackInfo {
    name: string;
    avatarUrl?: string;
    attribution?: string;
}

export function getUserPackInfo(): UserPackInfo {
    const content = getUserEmoteContent();
    const avatar = content.pack?.avatar_url;
    return {
        name: content.pack?.display_name ?? "",
        avatarUrl:
            typeof avatar === "string"
                ? (mxcToHttp(avatar, 64) ?? undefined)
                : undefined,
        attribution: content.pack?.attribution || undefined,
    };
}

export async function updateUserPackMeta(
    update: PackMetaUpdate,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const current = await fetchUserEmoteContent();
    await matrixClient.setAccountData(
        "im.ponies.user_emotes",
        applyPackMeta(current, update),
    );
}

export interface ImportableImage {
    shortcode: string;
    mxcUrl: string;
    info?: Record<string, unknown>;
    body?: string;
    usage?: ImageUsage[];
}

/** Copy images from someone else's pack into the user's own pack in a single
 *  account-data write. The media is referenced by its existing mxc URI, not
 *  re-uploaded. Shortcode collisions get a numeric suffix; an image already
 *  present (same mxc) is skipped. Returns the shortcodes that were added. */
export async function importImagesToUserPack(
    images: ImportableImage[],
): Promise<string[]> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const current = await fetchUserEmoteContent();
    const next = { ...(current.images ?? {}) };
    const taken = new Set(Object.keys(next));
    const haveUrls = new Set(Object.values(next).map((image) => image?.url));
    const added: string[] = [];
    for (const image of images) {
        if (!image.mxcUrl.startsWith("mxc://") || haveUrls.has(image.mxcUrl))
            continue;
        const wanted = normalizeEmojiShortcode(image.shortcode);
        if (validateEmojiShortcode(wanted)) continue;
        const shortcode = uniqueShortcode(taken, wanted);
        taken.add(shortcode);
        haveUrls.add(image.mxcUrl);
        const usage = normalizeUsage(image.usage ?? []);
        next[shortcode] = {
            url: image.mxcUrl,
            usage: usage.length > 0 ? usage : ["emoticon", "sticker"],
            ...(image.info ? { info: image.info } : {}),
            ...(image.body ? { body: image.body } : {}),
        };
        added.push(shortcode);
    }
    if (added.length === 0) return added;
    await matrixClient.setAccountData("im.ponies.user_emotes", {
        ...current,
        pack: {
            ...(current.pack ?? {}),
            display_name: current.pack?.display_name ?? "My Emotes",
        },
        images: next,
    });
    return added;
}

function uniquePacks<T extends { id: string }>(packs: T[]): T[] {
    const seen = new Set<string>();
    return packs.filter((pack) => {
        if (seen.has(pack.id)) return false;
        seen.add(pack.id);
        return true;
    });
}

// Returns custom emoji packs (emoticons only): user pack first, then active space.
export function getCustomEmojiPacks(
    activeSpaceId: string | null,
    _spaces: Room[],
    room?: Room | null,
): CustomEmojiPack[] {
    if (!matrixClient) return [];
    const packs: CustomEmojiPack[] = [];

    const userEmojis = getUserPackImages("emoticon");
    if (userEmojis.length > 0)
        packs.push({ id: "user", name: "My Emojis", emojis: userEmojis });

    if (room) {
        packs.push(...getAvailableRoomEmojiPacks(room));
    }

    if (activeSpaceId) {
        const spaceRoom = matrixClient.getRoom(activeSpaceId);
        if (spaceRoom) {
            packs.push(...getAvailableRoomEmojiPacks(spaceRoom));
        }
    }

    packs.push(
        ...getGlobalEmotePacks()
            .map((pack) => imagePackToEmojiPack(pack, "emoticon"))
            .filter((pack) => pack.emojis.length > 0),
    );

    return uniquePacks(packs);
}

// Warm this room's custom emoji images in the background on room open. Custom
// emoji are authed media with no browser cache and (for a remote pack) a
// per-image federated fetch of ~1s the first time — so a fresh emoji-heavy room
// otherwise trickles in when the picker opens or a message renders. Resolving
// the packs is ~0.1ms; the cost is entirely the image fetch, which this warms
// ahead of use. Best-effort, session-deduped, capped, low-concurrency — never
// blocks, never throws; skipped while offline (the warm would just 401/fail).
export function preloadRoomEmoji(
    room: Room | null | undefined,
    activeSpaceId: string | null,
    spaces: Room[],
): void {
    if (!room) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    try {
        const packs = getCustomEmojiPacks(activeSpaceId, spaces, room);
        if (packs.length > 0) preloadEmojiPacks(packs);
    } catch {
        /* best-effort warming — a failure here must never disturb room open */
    }
}

// Returns custom sticker packs: user pack first, then active space.
export function getCustomStickerPacks(
    activeSpaceId: string | null,
    room?: Room | null,
): CustomStickerPack[] {
    if (!matrixClient) return [];
    const packs: CustomStickerPack[] = [];

    const userStickers = getUserPackImages("sticker");
    if (userStickers.length > 0)
        packs.push({ id: "user", name: "My Stickers", stickers: userStickers });

    if (room) {
        packs.push(...getAvailableRoomStickerPacks(room));
    }

    if (activeSpaceId) {
        const spaceRoom = matrixClient.getRoom(activeSpaceId);
        if (spaceRoom) {
            packs.push(...getAvailableRoomStickerPacks(spaceRoom));
        }
    }

    for (const pack of getGlobalEmotePacks()) {
        const { emojis, ...rest } = imagePackToEmojiPack(pack, "sticker");
        if (emojis.length > 0) packs.push({ ...rest, stickers: emojis });
    }

    return uniquePacks(packs);
}

// Flat list of all custom emojis (emoticons only) — used at send time to resolve shortcodes.
export function getCustomEmojis(
    room?: Room,
    activeSpaceId?: string | null,
): CustomEmoji[] {
    if (!matrixClient) return [];
    const seen = new Set<string>();
    const result: CustomEmoji[] = [];
    const add = (emojis: CustomEmoji[]) => {
        for (const e of emojis) {
            if (!seen.has(e.shortcode)) {
                seen.add(e.shortcode);
                result.push(e);
            }
        }
    };

    add(getUserPackImages("emoticon"));
    if (room) {
        add(getAvailableRoomEmojiPacks(room).flatMap((pack) => pack.emojis));
    }
    if (activeSpaceId) {
        const spaceRoom = matrixClient.getRoom(activeSpaceId);
        if (spaceRoom) {
            add(
                getAvailableRoomEmojiPacks(spaceRoom).flatMap(
                    (pack) => pack.emojis,
                ),
            );
        }
    }

    add(
        getGlobalEmotePacks().flatMap(
            (pack) => imagePackToEmojiPack(pack, "emoticon").emojis,
        ),
    );

    return result;
}

// ── Admin / moderation helpers ────────────────────────────────────────────────

/**
 * Whether `userId` is the room creator or an additional creator (MSC4289). Reads
 * `m.room.create` — the source of truth even when the SDK doesn't surface a
 * v12 creator's implicit power in the power-levels map.
 */
export function isRoomCreator(room: Room, userId: string): boolean {
    const state = room.getLiveTimeline().getState(EventTimeline.FORWARDS);
    const create = state?.getStateEvents("m.room.create", "");
    if (!create) return false;
    if (create.getSender() === userId) return true;
    const additional =
        (create.getContent()?.additional_creators as string[]) ?? [];
    return additional.includes(userId);
}

/**
 * A user's *effective* power level in the room. Normally the SDK's raw level,
 * but a room-v12 (MSC4289) creator — whose implicit power the SDK reports as 0 —
 * is lifted to at least `CREATOR_POWER_LEVEL`. See `effectivePowerLevel`.
 */
export function getUserPowerLevel(room: Room, userId: string): number {
    const raw = room.getMember(userId)?.powerLevel ?? 0;
    return effectivePowerLevel({
        rawPowerLevel: raw,
        isCreator: isRoomCreator(room, userId),
        immutableCreators: roomVersionHasImmutableCreators(room.getVersion()),
    });
}

export function getMyPowerLevel(room: Room): number {
    const me = matrixClient?.getUserId();
    if (!me) return 0;
    return getUserPowerLevel(room, me);
}

export interface PowerLevels {
    ban: number;
    kick: number;
    redact: number;
    invite: number;
    events_default: number;
    state_default: number;
    users_default: number;
    events: Record<string, number>;
    users: Record<string, number>;
}

export function getRoomPowerLevels(room: Room): PowerLevels {
    const state = room.getLiveTimeline().getState(EventTimeline.FORWARDS);
    // Distinguish "no m.room.power_levels event at all" (content undefined) from
    // "event present but a field omitted" ({}): the two carry different spec
    // defaults. normalizePowerLevels applies the correct set and coerces pre-v10
    // numeric-string levels.
    const content = state
        ?.getStateEvents("m.room.power_levels", "")
        ?.getContent() as Record<string, unknown> | undefined;
    const creatorId =
        state?.getStateEvents("m.room.create", "")?.getSender() ?? null;
    return normalizePowerLevels(content ?? null, creatorId);
}

export function getPinnedEventIds(room: Room): string[] {
    const state = room.getLiveTimeline().getState(EventTimeline.FORWARDS);
    const content = state
        ?.getStateEvents("m.room.pinned_events", "")
        ?.getContent();
    return (content?.pinned as string[]) ?? [];
}

async function fetchPinnedEventIds(roomId: string): Promise<string[]> {
    try {
        const state = await matrixClient?.getStateEvent(
            roomId,
            "m.room.pinned_events",
            "",
        );
        return (state?.pinned as string[]) ?? [];
    } catch (e: any) {
        // A MISSING pinned_events state event (404 / M_NOT_FOUND) is a
        // genuinely empty pin list, not a fetch failure — return [] so the
        // first pin can still be written. Any OTHER error (network / 5xx /
        // rate-limit) MUST propagate: swallowing it to [] here would let a
        // read-modify-write pin/unpin overwrite the real list with a
        // truncated one. Callers surface the failure with a toast.
        if (e?.errcode === "M_NOT_FOUND" || e?.httpStatus === 404) return [];
        throw e;
    }
}

export async function pinMessage(room: Room, eventId: string): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const current = await fetchPinnedEventIds(room.roomId);
    const pinned = [...new Set([...current, eventId])];
    await (matrixClient as any).sendStateEvent(
        room.roomId,
        "m.room.pinned_events",
        { pinned },
        "",
    );
}

export async function unpinMessage(room: Room, eventId: string): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const current = await fetchPinnedEventIds(room.roomId);
    const pinned = current.filter((id) => id !== eventId);
    await (matrixClient as any).sendStateEvent(
        room.roomId,
        "m.room.pinned_events",
        { pinned },
        "",
    );
}

export async function setRoomPowerLevels(
    room: Room,
    updated: Partial<PowerLevels>,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const state = room.getLiveTimeline().getState(EventTimeline.FORWARDS);
    const current =
        state?.getStateEvents("m.room.power_levels", "")?.getContent() ?? {};
    const content = { ...current, ...updated };
    // Shape-check before writing so a malformed level surfaces as a clear error
    // instead of a cryptic server 400 (audit SEC-L12).
    const shapeError = validatePowerLevelsContent(content);
    if (shapeError)
        throw new Error(t("client.invalidPowerLevels", { shapeError }));
    await (matrixClient as any).sendStateEvent(
        room.roomId,
        "m.room.power_levels",
        content,
    );
}

/** Live `m.room.server_acl` content, or null when the room has no ACL. */
export function getServerAclContent(
    room: Room,
): Record<string, unknown> | null {
    const state = room.getLiveTimeline().getState(EventTimeline.FORWARDS);
    return (
        (state?.getStateEvents("m.room.server_acl", "")?.getContent() as Record<
            string,
            unknown
        >) ?? null
    );
}

/** Write the room's `m.room.server_acl` (federation allow/deny lists). */
export async function setServerAcl(room: Room, acl: ServerAcl): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    await (matrixClient as any).sendStateEvent(
        room.roomId,
        "m.room.server_acl",
        serializeServerAcl(acl),
        "",
    );
}

export async function setUserPowerLevel(
    room: Room,
    userId: string,
    level: number,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    // A room-v12 (MSC4289) creator's power is immutable and NOT stored in the
    // users map — writing it there is a guaranteed server 403. Surface a clear
    // error instead of the raw federation rejection.
    if (
        isRoomCreator(room, userId) &&
        roomVersionHasImmutableCreators(room.getVersion())
    ) {
        throw new Error(t("client.roomCreatorsPowerLevelCannotBe"));
    }
    const pl = getRoomPowerLevels(room);
    await setRoomPowerLevels(room, { users: { ...pl.users, [userId]: level } });
}

export async function kickUser(
    roomId: string,
    userId: string,
    reason?: string,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    await matrixClient.kick(roomId, userId, reason);
}

export async function banUser(
    roomId: string,
    userId: string,
    reason?: string,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    await matrixClient.ban(roomId, userId, reason);
}

export async function unbanUser(roomId: string, userId: string): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    await matrixClient.unban(roomId, userId);
}

export function getBannedMembers(room: Room): RoomMember[] {
    return room.getMembers().filter((m) => m.membership === "ban");
}

/** Members currently knocking on the room (membership === "knock"). */
export function getKnockingMembers(room: Room): RoomMember[] {
    return room.getMembers().filter((m) => m.membership === "knock");
}

/**
 * The trimmed, non-empty knock reason a member supplied when knocking, or
 * undefined. Reads the member's m.room.member event content; the value is
 * untrusted user text (render escaped, never via {@html}).
 */
export function getMemberKnockReason(member: RoomMember): string | undefined {
    return knockReasonFromContent(member.events.member?.getContent());
}

/** The user ids on the account's m.ignored_user_list (empty when logged out). */
export function getIgnoredUsers(): string[] {
    return matrixClient?.getIgnoredUsers() ?? [];
}

/** Replaces the account's entire ignore list (m.ignored_user_list). */
export async function setIgnoredUsers(userIds: string[]): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    await matrixClient.setIgnoredUsers(userIds);
}

export function isUserIgnored(userId: string): boolean {
    return matrixClient?.isUserIgnored(userId) ?? false;
}

export async function setRoomName(roomId: string, name: string): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    await matrixClient.setRoomName(roomId, name);
}

export async function setRoomTopic(
    roomId: string,
    topic: string,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    await matrixClient.setRoomTopic(roomId, topic);
}

export async function setRoomAvatar(
    roomId: string,
    mxcUrl: string,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    await (matrixClient as any).sendStateEvent(roomId, "m.room.avatar", {
        url: mxcUrl,
    });
}

export function getJoinRule(room: Room): string {
    const state = room.getLiveTimeline().getState(EventTimeline.FORWARDS);
    return (
        state?.getStateEvents("m.room.join_rules", "")?.getContent()
            ?.join_rule ?? "invite"
    );
}

export async function setJoinRule(roomId: string, rule: string): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    await (matrixClient as any).sendStateEvent(roomId, "m.room.join_rules", {
        join_rule: rule,
    });
}

/** Set a restricted join rule allowing members of the given parent spaces to join. */
export async function setRestrictedJoinRule(
    roomId: string,
    parentSpaceIds: string[],
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const content = buildRestrictedJoinRuleContent(parentSpaceIds);
    if (content.allow.length === 0) {
        throw new Error(t("client.restrictedJoinRequiresAtLeastOne"));
    }
    await (matrixClient as any).sendStateEvent(
        roomId,
        "m.room.join_rules",
        content,
    );
}

export function getHistoryVisibility(room: Room): string {
    const state = room.getLiveTimeline().getState(EventTimeline.FORWARDS);
    return (
        state?.getStateEvents("m.room.history_visibility", "")?.getContent()
            ?.history_visibility ?? "shared"
    );
}

export async function setHistoryVisibility(
    roomId: string,
    visibility: string,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    await (matrixClient as any).sendStateEvent(
        roomId,
        "m.room.history_visibility",
        { history_visibility: visibility },
    );
}

/** The room's visibility in the server's public room directory. */
export async function getRoomDirectoryVisibility(
    roomId: string,
): Promise<"public" | "private"> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const res = await matrixClient.getRoomDirectoryVisibility(roomId);
    return (res as { visibility?: string })?.visibility === "public"
        ? "public"
        : "private";
}

/** Publish/unpublish the room to the server's public room directory. */
export async function setRoomDirectoryVisibility(
    roomId: string,
    visibility: "public" | "private",
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    await (matrixClient as any).setRoomDirectoryVisibility(roomId, visibility);
}

/** Whether guests (server-created anonymous accounts) may join. */
export function getGuestAccess(room: Room): string {
    const state = room.getLiveTimeline().getState(EventTimeline.FORWARDS);
    return (
        state?.getStateEvents("m.room.guest_access", "")?.getContent()
            ?.guest_access ?? "forbidden"
    );
}

/** `access` is "can_join" or "forbidden". */
export async function setGuestAccess(
    roomId: string,
    access: string,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    await (matrixClient as any).sendStateEvent(roomId, "m.room.guest_access", {
        guest_access: access,
    });
}

/** Local aliases this homeserver holds for the room. */
export async function getLocalRoomAliases(roomId: string): Promise<string[]> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const res = await matrixClient.getLocalAliases(roomId);
    return res?.aliases ?? [];
}

/** Map a new `#alias:server` to the room in this server's directory. */
export async function createRoomAlias(
    alias: string,
    roomId: string,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    await matrixClient.createAlias(alias, roomId);
}

/** Remove a local `#alias:server` from this server's directory. */
export async function deleteRoomAlias(alias: string): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    await matrixClient.deleteAlias(alias);
}

/**
 * The room's published addresses. Defensively typed: a federated room can
 * carry anything in this event, and a non-string alias would poison the UI.
 */
export function getCanonicalAliasContent(room: Room): CanonicalAliasContent {
    const state = room.getLiveTimeline().getState(EventTimeline.FORWARDS);
    const content =
        state?.getStateEvents("m.room.canonical_alias", "")?.getContent() ?? {};
    const alts = Array.isArray(content.alt_aliases)
        ? content.alt_aliases.filter(
              (a: unknown): a is string => typeof a === "string" && !!a,
          )
        : [];
    return {
        ...(typeof content.alias === "string" && content.alias
            ? { alias: content.alias }
            : {}),
        ...(alts.length > 0 ? { alt_aliases: alts } : {}),
    };
}

/** Publish the room's main address and alternates. `{}` clears both. */
export async function setCanonicalAliasContent(
    roomId: string,
    content: CanonicalAliasContent,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    await (matrixClient as any).sendStateEvent(
        roomId,
        "m.room.canonical_alias",
        content,
    );
}

export interface SpaceChildEntry {
    roomId: string;
    name: string;
    order: string;
    via: string[];
    avatarUrl: string | null;
    isJoined: boolean;
    // origin_server_ts of the m.space.child event — the spec's primary
    // tie-break when two children share (or both lack) an `order`.
    originTs: number;
    // MSC1772 m.space.child.suggested — a client hint to promote this child.
    suggested: boolean;
}

export function getSpaceChildren(room: Room): SpaceChildEntry[] {
    if (!matrixClient) return [];
    const state = room.getLiveTimeline().getState(EventTimeline.FORWARDS);
    const childEvents = state?.getStateEvents("m.space.child") ?? [];
    const joined = new Set(matrixClient.getRooms().map((r) => r.roomId));
    return (childEvents as MatrixEvent[])
        .filter((ev) => (ev.getContent()?.via as string[])?.length)
        .map((ev) => {
            const childId = ev.getStateKey()!;
            const child = matrixClient!.getRoom(childId);
            return {
                roomId: childId,
                name: child ? getRoomDisplayName(child) : childId,
                order: (ev.getContent()?.order as string) ?? "",
                via: (ev.getContent()?.via as string[]) ?? [],
                avatarUrl: child ? getRoomAvatar(child) : null,
                isJoined: joined.has(childId),
                originTs: ev.getTs(),
                suggested: isSuggestedChild(ev.getContent()),
            };
        })
        .sort((a, b) => {
            const byOrder = compareOrderLex(a.order, b.order);
            if (byOrder !== 0) return byOrder;
            // Equal/both-missing order: spec sorts by origin_server_ts
            // ascending first, then name for stability.
            const byTs = a.originTs - b.originTs;
            if (byTs !== 0) return byTs;
            return a.name.localeCompare(b.name);
        });
}

export async function setSpaceChildOrder(
    spaceId: string,
    childRoomId: string,
    order: string,
    via: string[],
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    // An m.space.child `order` must be ≤50 printable-ASCII chars (\x20–\x7E).
    // Generated fractional-index keys always satisfy this; a raw, user-typed
    // value may not — reject it rather than write a spec-invalid order the
    // homeserver would sort inconsistently. (An empty string is valid: it
    // clears the order below.)
    if (!isValidChildOrder(order)) {
        throw new Error(t("client.orderMustBeAtMost50"));
    }
    const existing =
        matrixClient
            .getRoom(spaceId)
            ?.getLiveTimeline()
            .getState(EventTimeline.FORWARDS)
            ?.getStateEvents("m.space.child", childRoomId)
            ?.getContent() ?? {};
    await (matrixClient as any).sendStateEvent(
        spaceId,
        "m.space.child",
        {
            ...existing,
            via,
            order: order || undefined,
        },
        childRoomId,
    );
}

/**
 * Move a space child to sit between two neighbours (identified by room id;
 * `null` = open head/tail), writing a lexicographic `m.space.child` `order`.
 * Each child's existing `via` is preserved.
 *
 * Fast path: a single key strictly between the neighbours' orders. Falls back
 * to reassigning evenly-spread keys across the whole section when no key fits
 * (adjacent/colliding neighbours, or the key would exceed the length cap).
 */
export async function reorderSpaceChild(
    spaceId: string,
    childId: string,
    beforeId: string | null,
    afterId: string | null,
): Promise<void> {
    const space = matrixClient?.getRoom(spaceId);
    if (!space) return;
    const children = getSpaceChildren(space);

    const orderOf = (id: string) =>
        children.find((c) => c.roomId === id)?.order ?? "";
    const viaOf = (id: string) =>
        children.find((c) => c.roomId === id)?.via ?? [];

    const beforeOrder = beforeId ? orderOf(beforeId) : "";
    const afterOrder = afterId ? orderOf(afterId) : "";

    // Fast path only when each present neighbour has a non-empty order string.
    // A present-but-orderless neighbour is NOT an open end: a present order
    // sorts before a missing one, so passing `null` there would let
    // keyBetween(null, null) return "U" and jump the child to the top instead
    // of the dropped slot. Force the rebalance path in that case.
    const beforeOk = beforeId === null || beforeOrder !== "";
    const afterOk = afterId === null || afterOrder !== "";
    if (beforeOk && afterOk) {
        try {
            const key = keyBetween(
                beforeId ? beforeOrder : null,
                afterId ? afterOrder : null,
            );
            await setSpaceChildOrder(spaceId, childId, key, viaOf(childId));
            return;
        } catch (e) {
            if (!(e instanceof OrderRebalanceError)) throw e;
        }
    }

    // Rebalance: reassign evenly-spread keys across the whole section.
    const list = children.map((c) => c.roomId).filter((id) => id !== childId);
    let insertAt: number;
    if (beforeId === null) insertAt = 0;
    else if (afterId === null) insertAt = list.length;
    else {
        const idx = list.indexOf(beforeId);
        insertAt = idx === -1 ? list.length : idx + 1;
    }
    list.splice(insertAt, 0, childId);

    const keys = rebalancedKeys(list.length);
    for (let i = 0; i < list.length; i++) {
        await setSpaceChildOrder(spaceId, list[i], keys[i], viaOf(list[i]));
    }
}

/**
 * Set (or clear) the MSC1772 `suggested` hint on a space child, preserving the
 * child's other `m.space.child` content (via/order). Clearing writes the key
 * away rather than `false`, keeping the state event minimal.
 */
export async function setSpaceChildSuggested(
    spaceId: string,
    childRoomId: string,
    suggested: boolean,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const existing =
        matrixClient
            .getRoom(spaceId)
            ?.getLiveTimeline()
            .getState(EventTimeline.FORWARDS)
            ?.getStateEvents("m.space.child", childRoomId)
            ?.getContent() ?? {};
    const via = (existing as { via?: unknown }).via;
    if (!(via as { length?: number } | undefined)?.length) {
        throw new Error(t("client.cannotSetSuggestedOnASpace"));
    }
    const next: Record<string, unknown> = { ...existing };
    if (suggested) next.suggested = true;
    else delete next.suggested;
    await (matrixClient as any).sendStateEvent(
        spaceId,
        "m.space.child",
        next,
        childRoomId,
    );
}

export async function removeSpaceChild(
    spaceId: string,
    childRoomId: string,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    await (matrixClient as any).sendStateEvent(
        spaceId,
        "m.space.child",
        {},
        childRoomId,
    );
}

// ── End admin helpers ─────────────────────────────────────────────────────────

export async function sendSticker(
    roomId: string,
    sticker: CustomSticker,
    thread?: { rootEventId: string },
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notConnected"));
    const content: Record<string, unknown> = {
        body: sticker.body || sticker.shortcode,
        url: sticker.mxcUrl,
        info: sticker.info ?? {},
        // Always present (spec recommendation) so the receiver skips legacy
        // body-scan push rules; a sticker never carries intentional mentions.
        "m.mentions": {},
    };
    const finalContent = thread
        ? withThreadRelation(
              content,
              threadRelationParams(roomId, thread.rootEventId),
          )
        : content;
    await matrixClient.sendEvent(roomId, "m.sticker" as any, finalContent);
}

export function onReactionEvent(
    callback: (event: MatrixEvent, room: Room) => void,
): () => void {
    if (!matrixClient) return () => {};
    const handler = (event: MatrixEvent, room: Room | undefined) => {
        if (room && event.getType() === "m.reaction") {
            callback(event, room);
        }
    };
    matrixClient.on(RoomEvent.Timeline, handler as never);
    return () => matrixClient?.off(RoomEvent.Timeline, handler as never);
}

/**
 * Fires after the SDK finishes a decryption attempt on an event (the client
 * re-emits `MatrixEventEvent.Decrypted`, success or failure).
 *
 * Needed because an incoming encrypted message reaches the live timeline as
 * `m.room.encrypted` — a type `onTimelineEvent` filters out — so it is never
 * live-appended. It only gains its cleartext type once decryption finishes, at
 * which point consumers should re-read the timeline (`getTimelineMessages`
 * includes the now-decrypted message and still excludes decrypted reactions).
 * Without this, new encrypted messages appear only after a manual reload.
 */
export function onEventDecrypted(
    callback: (event: MatrixEvent, room: Room) => void,
): () => void {
    if (!matrixClient) return () => {};
    const handler = (event: MatrixEvent) => {
        const roomId = event.getRoomId();
        const room = roomId ? matrixClient?.getRoom(roomId) : undefined;
        if (room) callback(event, room);
    };
    matrixClient.on(MatrixEventEvent.Decrypted as never, handler as never);
    return () =>
        matrixClient?.off(
            MatrixEventEvent.Decrypted as never,
            handler as never,
        );
}

export interface DecryptedTimelineMeta {
    /** The ciphertext arrived as a fresh tail append, not a mid-timeline insert. */
    isLiveAppend: boolean;
    /** The ciphertext arrived before sync PREPARED (page-load backlog replay). */
    arrivedDuringInitialSync: boolean;
    /**
     * Root event id when the decrypted event is an `m.thread` reply, else null.
     *
     * Derived HERE rather than by the consumer because the relation may live in
     * EITHER half of an encrypted event, depending on the sender: the wire
     * content for clients that put it there (which is why `getRelation()` reads
     * wire content at all), or the decrypted clear content for matrix-js-sdk
     * senders, whose `makeEncrypted` replaces the wire content wholesale. So
     * both halves are consulted, and `getEventThreadRootId()` — clear content
     * only — is not sufficient here.
     */
    threadRootId: string | null;
}

/**
 * Live timeline events that only become notifiable once they decrypt.
 *
 * `onTimelineEvent` gates on the cleartext event type, but an incoming
 * encrypted message reaches the timeline as `m.room.encrypted` (the SDK starts
 * decryption without awaiting it, `lib/event-mapper.js`, then synchronously
 * emits `RoomEvent.Timeline`). So encrypted messages never reached the
 * notification path at all — no ping, no inbox entry, no OS popup.
 *
 * `MatrixEventEvent.Decrypted` carries no timeline context, so we remember the
 * two facts that cannot be recovered at decryption time — whether the
 * ciphertext was a fresh tail append, and whether it arrived before the initial
 * sync finished (decryption of the page-load backlog routinely resolves *after*
 * PREPARED, and reading the flag late would turn the whole replayed backlog
 * into sound + popups). The map is bounded so a long session cannot leak.
 *
 * Decryption FAILURES are skipped and left pending: the SDK re-emits Decrypted
 * when the key finally arrives, and notifying on the failure would strand a
 * "🔒 Encrypted message" row in the inbox (markNotification dedupes by event id
 * and never upserts).
 */
export function onDecryptedTimelineEvent(
    callback: (
        event: MatrixEvent,
        room: Room,
        meta: DecryptedTimelineMeta,
    ) => void,
): () => void {
    if (!matrixClient) return () => {};
    // Only the facts knowable at CIPHERTEXT time: the thread root id is derived
    // at decryption time (below), so the ciphertext handler is never forced to
    // invent one.
    const pending =
        createBoundedIdMap<Omit<DecryptedTimelineMeta, "threadRootId">>();

    const onTimeline = (
        event: MatrixEvent,
        room: Room | undefined,
        toStartOfTimeline?: boolean,
        removed?: boolean,
        data?: { liveEvent?: boolean },
    ) => {
        // Scroll-up backfill and removals are never new messages.
        if (toStartOfTimeline || removed || !room) return;
        if (!event.isEncrypted()) return;
        const eventId = event.getId();
        if (!eventId) return;
        pending.set(eventId, {
            isLiveAppend: data?.liveEvent === true,
            arrivedDuringInitialSync: !isInitialSyncComplete(),
        });
    };

    const onDecrypted = (event: MatrixEvent) => {
        const eventId = event.getId();
        if (!eventId) return;
        const meta = pending.get(eventId);
        if (!meta) return;
        // Keep it pending: the SDK retries and re-emits once the key arrives.
        if (event.isDecryptionFailure()) return;
        const roomId = event.getRoomId();
        const room = roomId ? matrixClient?.getRoom(roomId) : undefined;
        if (!room) return;
        pending.delete(eventId);

        // Same content filter as onTimelineEvent (minus its showAllEvents
        // bypass — with that debug setting on, the ciphertext already went
        // through the normal path and the caller's already-notified check
        // suppresses this one).
        // An encrypted event's relation can sit in either half, depending on
        // the sender. Some clients leave `m.relates_to` in the wire content —
        // that is what getRelation() reads, and why the SDK's isRelation()
        // checks it. matrix-js-sdk senders do the opposite: makeEncrypted()
        // swaps the whole wire content for the ciphertext, so the relation only
        // reappears in the clear content once decrypted. Consult BOTH, or an
        // encrypted edit or thread reply gets misfiled as a plain message.
        const relatesTo =
            event.getRelation() ?? event.getOriginalContent()?.["m.relates_to"];
        const isReplacement = relatesTo?.rel_type === "m.replace";
        if (isReplacement) return;
        // NOT a filter any more (NOTIF-02). A thread reply used to be dropped
        // here on the assumption that onThreadReplyEvent would carry it, but
        // that subscription gates on the cleartext event type and an encrypted
        // reply reads m.room.encrypted until this very moment — so the reply
        // notified nowhere. Forward it with its root id and let the consumer
        // apply the thread policy, which needs cleartext (mentions) anyway.
        // threadReplyRootId is the classifier (the inverse of
        // belongsToMainTimeline, pinned by its own tests) so a malformed
        // self-referential m.thread relation stays a main-timeline event.
        const threadRootId = threadReplyRootId({ relatesTo, eventId });
        const type = event.getType();
        if (
            type !== "m.room.message" &&
            type !== "m.sticker" &&
            !isPollStartEventType(type)
        )
            return;
        if (event.isRedacted()) return;

        callback(event, room, { ...meta, threadRootId });
    };

    matrixClient.on(RoomEvent.Timeline, onTimeline as never);
    matrixClient.on(MatrixEventEvent.Decrypted as never, onDecrypted as never);
    return () => {
        matrixClient?.off(RoomEvent.Timeline, onTimeline as never);
        matrixClient?.off(
            MatrixEventEvent.Decrypted as never,
            onDecrypted as never,
        );
    };
}

// ── Polls (MSC3381) ────────────────────────────────────────────────────────

export interface PollView {
    poll: PollStartData;
    counts: Record<string, number>;
    totalVotes: number;
    winners: string[];
    /** Answer ids the current user voted for. */
    myAnswers: string[];
    ended: boolean;
    /** Whether tallies may be shown: disclosed poll, or the poll has closed. */
    showResults: boolean;
    /** The current user may close this open poll. */
    canEnd: boolean;
}

/** All response/end events the SDK has aggregated for this poll locally. */
function pollRelationEvents(room: Room, pollStartId: string): MatrixEvent[] {
    const out: MatrixEvent[] = [];
    for (const type of [...POLL_RESPONSE_TYPES, ...POLL_END_TYPES]) {
        const rel = room.relations.getChildEventsForEvent(
            pollStartId,
            "m.reference",
            type,
        );
        if (rel) out.push(...rel.getRelations());
    }
    return out;
}

/**
 * Compute the rendered state of a poll from its start event plus every
 * known response/end relation: what the SDK aggregated from the loaded
 * timeline, merged with `extraEvents` fetched from the /relations endpoint
 * (see fetchPollRelations) so votes older than the timeline window count.
 */
export function getPollView(
    room: Room,
    startEvent: MatrixEvent,
    extraEvents: MatrixEvent[] = [],
): PollView | null {
    const poll = parsePollStart(startEvent.getContent());
    if (!poll) return null;
    const startId = startEvent.getId();
    if (!startId) return null;

    const seen = new Set<string>();
    const related: MatrixEvent[] = [];
    for (const e of [...pollRelationEvents(room, startId), ...extraEvents]) {
        const id = e.getId();
        if (!id || seen.has(id) || e.isRedacted()) continue;
        seen.add(id);
        related.push(e);
    }

    const creator = startEvent.getSender() ?? "";
    const powerLevels = getRoomPowerLevels(room);
    const endTs = pickPollEndTs(
        related
            .filter((e) => isPollEndEventType(e.getType()))
            .map((e) => ({ sender: e.getSender() ?? "", ts: e.getTs() })),
        (sender) =>
            canEndPoll(
                sender,
                creator,
                getUserPowerLevel(room, sender),
                powerLevels.redact,
            ),
    );

    const responses = related
        .filter((e) => isPollResponseEventType(e.getType()))
        .map((e) => ({
            sender: e.getSender() ?? "",
            ts: e.getTs(),
            eventId: e.getId() ?? "",
            answers: extractResponseAnswers(e.getContent()),
        }));

    const tally = aggregatePollVotes(poll, responses, endTs);
    const me = matrixClient?.getUserId();
    return {
        poll,
        counts: tally.counts,
        totalVotes: tally.totalVotes,
        winners: tally.winners,
        myAnswers: (me && tally.votesBySender[me]) || [],
        ended: endTs !== null,
        showResults: poll.kind === "disclosed" || endTs !== null,
        canEnd:
            endTs === null &&
            !!me &&
            canEndPoll(
                me,
                creator,
                getUserPowerLevel(room, me),
                powerLevels.redact,
            ),
    };
}

/** Cast or replace the current user's vote. An empty selection retracts it. */
export async function sendPollResponse(
    roomId: string,
    pollStartEvent: MatrixEvent,
    answerIds: string[],
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const pollStartId = pollStartEvent.getId();
    if (!pollStartId) throw new Error(t("client.pollHasNoEventId"));
    const poll = parsePollStart(pollStartEvent.getContent());
    if (!poll) throw new Error(t("client.unsupportedPoll"));
    const allowed = new Set(poll.answers.map((answer) => answer.id));
    const selected = [...new Set(answerIds)]
        .filter((id) => allowed.has(id))
        .slice(0, poll.maxSelections);
    const { eventType, content } = buildPollResponse(
        pollStartEvent.getType(),
        pollStartId,
        selected,
    );
    await matrixClient.sendEvent(roomId, eventType as never, content as never);
}

export async function sendPollStart(
    roomId: string,
    data: PollStartData,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const { eventType, content } = buildPollStart(data);
    await matrixClient.sendEvent(roomId, eventType as never, content as never);
}

export async function sendPollEnd(
    roomId: string,
    pollStartEvent: MatrixEvent,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const pollStartId = pollStartEvent.getId();
    if (!pollStartId) throw new Error(t("client.pollHasNoEventId"));
    // Defence in depth — the server also enforces via the redact PL.
    const room = matrixClient.getRoom(roomId);
    const me = matrixClient.getUserId() ?? "";
    if (room) {
        const creator = pollStartEvent.getSender() ?? "";
        if (
            !canEndPoll(
                me,
                creator,
                getUserPowerLevel(room, me),
                getRoomPowerLevels(room).redact,
            )
        )
            throw new Error(t("client.youCanTCloseThisPoll"));
    }
    const { eventType, content } = buildPollEnd(pollStartId);
    await matrixClient.sendEvent(roomId, eventType as never, content as never);
}

/**
 * Fetch a poll's full response/end history from the server. The SDK only
 * aggregates relations for events in the locally loaded timeline window,
 * so votes older than that window would otherwise be missed. Pages until
 * exhausted, bounded at 10 pages for pathological polls (the cap is logged).
 */
export async function fetchPollRelations(
    roomId: string,
    pollStartId: string,
): Promise<MatrixEvent[]> {
    if (!matrixClient) return [];
    const events: MatrixEvent[] = [];
    let from: string | undefined;
    for (let page = 0; page < 10; page++) {
        const res = await matrixClient.relations(
            roomId,
            pollStartId,
            "m.reference",
            null,
            { from },
        );
        events.push(...res.events);
        if (!res.nextBatch) return events;
        from = res.nextBatch;
    }
    console.warn(
        `Poll ${pollStartId} has more than 10 pages of votes; tallies may be incomplete`,
    );
    return events;
}

/** Fires when a poll response, end, or start-edit lands on a timeline, so visible polls can re-tally/re-render. */
export function onPollEvent(
    callback: (event: MatrixEvent, room: Room) => void,
): () => void {
    if (!matrixClient) return () => {};
    const handler = (event: MatrixEvent, room: Room | undefined) => {
        if (
            room &&
            affectsPollView(event.getType(), event.getRelation()?.rel_type)
        ) {
            callback(event, room);
        }
    };
    matrixClient.on(RoomEvent.Timeline, handler as never);
    return () => matrixClient?.off(RoomEvent.Timeline, handler as never);
}

export function onRedactionEvent(
    room: Room,
    callback: (event: MatrixEvent, room: Room) => void,
): () => void {
    const handler = (event: MatrixEvent, r: Room) => callback(event, r);
    room.on(RoomEvent.Redaction as never, handler as never);
    return () => room.off(RoomEvent.Redaction as never, handler as never);
}

export function onReceiptEvent(room: Room, callback: () => void): () => void {
    room.on(RoomEvent.Receipt as never, callback as never);
    return () => room.off(RoomEvent.Receipt as never, callback as never);
}

/**
 * Fires when the room's live timeline is reset. This happens on a "limited"
 * (gappy) sync — e.g. after reconnecting or resuming the PWA from a
 * notification — where the server reports a gap between our last known event
 * and the new ones. The SDK discards the old in-memory timeline and starts a
 * fresh one, so the displayed message list must be reloaded from scratch to
 * avoid stitching stale events onto the post-gap events.
 */
export function onTimelineReset(room: Room, callback: () => void): () => void {
    room.on(RoomEvent.TimelineReset as never, callback as never);
    return () => room.off(RoomEvent.TimelineReset as never, callback as never);
}

export function findEventById(room: Room, eventId: string): MatrixEvent | null {
    return (
        room.getUnfilteredTimelineSet().findEventById(eventId) ??
        contextTimelineSets.get(room.roomId)?.findEventById(eventId) ??
        null
    );
}

export async function fetchEventById(
    roomId: string,
    eventId: string,
): Promise<MatrixEvent | null> {
    if (!matrixClient) return null;
    try {
        const raw = await matrixClient.fetchRoomEvent(roomId, eventId);
        return new MatrixEvent(raw);
    } catch {
        return null;
    }
}

export async function sendReply(
    roomId: string,
    text: string,
    replyToEvent: MatrixEvent,
    formattedText?: string,
    mentions?: { user_ids?: string[]; room?: boolean },
): Promise<string> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));

    const content = buildReplyContent({
        replyEventId: replyToEvent.getId()!,
        text,
        formattedText,
        mentions,
    });

    const res = await matrixClient.sendMessage(roomId, content as never);
    return res.event_id;
}

// ── Presence ──────────────────────────────────────────────────────────────────

export interface PresenceInfo {
    presence: string;
    currentlyActive: boolean;
    lastActiveAgo?: number;
    statusMsg?: string;
}

/**
 * Locally-synced presence for a user, or null when the server has never sent
 * us presence for them (unknown ≠ offline — some servers disable presence;
 * callers decide how to render the gap).
 */
export function getUserPresence(userId: string): PresenceInfo | null {
    const user = matrixClient?.getUser(userId);
    if (!user?.events.presence) return null;
    return {
        presence: user.presence,
        currentlyActive: user.currentlyActive,
        lastActiveAgo: user.lastActiveAgo,
        // Read from the latest presence event, not user.presenceStatusMsg:
        // the SDK only overwrites that field with a non-empty message, so a
        // cleared status would otherwise stick until the app reloads.
        statusMsg: user.events.presence.getContent().status_msg || undefined,
    };
}

/** GET /presence/{userId}/status — direct server query, bypassing the sync
 *  cache. Null when the server refuses (presence disabled / not shared). */
export async function getPresence(
    userId: string,
): Promise<PresenceInfo | null> {
    if (!matrixClient) return null;
    try {
        const status = await matrixClient.getPresence(userId);
        return {
            presence: status.presence,
            currentlyActive: status.currently_active ?? false,
            lastActiveAgo: status.last_active_ago,
            statusMsg: status.status_msg,
        };
    } catch {
        return null;
    }
}

const SYNC_PRESENCE: Record<PresenceState, SetPresence> = {
    online: SetPresence.Online,
    unavailable: SetPresence.Unavailable,
    offline: SetPresence.Offline,
};

/**
 * Advertise our own presence. Sets both the immediate state (PUT /presence)
 * and the set_presence param of subsequent /sync long-polls — without the
 * latter the very next sync would flip us straight back to online.
 */
export async function setOwnPresence(
    presence: PresenceState,
    statusMsg?: string,
): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    await matrixClient.setSyncPresence(SYNC_PRESENCE[presence]);
    // `undefined` omits status_msg; "" sends it explicitly, which is how a
    // cleared message is told apart from one we have no opinion about.
    await matrixClient.setPresence({
        presence,
        ...(statusMsg !== undefined ? { status_msg: statusMsg } : {}),
    });
}

/** Subscribe to presence changes of any known user. Returns unsubscribe. */
export function onPresenceEvent(
    callback: (userId: string) => void,
): () => void {
    if (!matrixClient) return () => {};
    const handler = (_event: MatrixEvent | undefined, user: User) =>
        callback(user.userId);
    matrixClient.on(UserEvent.Presence, handler);
    matrixClient.on(UserEvent.CurrentlyActive, handler);
    // Fires on every presence event, so a status message that changes on its
    // own (no state or activity change alongside it) still re-renders.
    matrixClient.on(UserEvent.LastPresenceTs, handler);
    return () => {
        matrixClient?.off(UserEvent.Presence, handler);
        matrixClient?.off(UserEvent.CurrentlyActive, handler);
        matrixClient?.off(UserEvent.LastPresenceTs, handler);
    };
}

/** User id of the other party in a DM room (m.direct mapping, falling back
 *  to the SDK's member-based guess). */
export function getDMPartnerId(room: Room): string {
    const direct = matrixClient
        ?.getAccountData(EventType.Direct)
        ?.getContent() as Record<string, string[]> | undefined;
    if (direct) {
        for (const [userId, roomIds] of Object.entries(direct)) {
            if (Array.isArray(roomIds) && roomIds.includes(room.roomId)) {
                return userId;
            }
        }
    }
    return room.guessDMUserId();
}

export interface MutualRoomInfo {
    roomId: string;
    name: string;
}

/** Non-space rooms both the current user and `userId` are joined to, DM rooms
 *  with that user excluded (a shared DM is not a "mutual room"). */
export function getMutualRoomsWith(userId: string): MutualRoomInfo[] {
    if (!matrixClient) return [];
    const direct = matrixClient
        .getAccountData(EventType.Direct)
        ?.getContent() as Record<string, string[]> | undefined;
    const dmRoomIds = new Set(direct?.[userId] ?? []);
    return matrixClient
        .getRooms()
        .filter(
            (room) =>
                !room.isSpaceRoom() &&
                !dmRoomIds.has(room.roomId) &&
                room.getMyMembership() === "join" &&
                room.getMember(userId)?.membership === "join",
        )
        .map((room) => ({
            roomId: room.roomId,
            name: getRoomDisplayName(room),
        }));
}

// --- MatrixRTC voice calls -----------------------------------------------
// All matrix-js-sdk `matrixrtc` access lives behind this seam: the module is
// semi-internal upstream and its API churns between SDK majors. Event names
// are string literals because the enums live in modules the SDK does not
// re-export ("session_started"/"session_ended" on the manager,
// "memberships_changed"/"membership_manager_error" on a session).

export interface VoiceMembership {
    userId: string;
    deviceId: string;
    joinedTs: number;
}

/** Non-expired MatrixRTC memberships for a room (empty when no call). */
/** Whether any device of ours is in a call in any room (per synced state). */
export function selfHasActiveCall(): boolean {
    const me = matrixClient?.getUserId();
    if (!matrixClient || !me) return false;
    return matrixClient
        .getRooms()
        .some((room) =>
            getRoomCallMemberships(room).some((m) => m.userId === me),
        );
}

/**
 * The SDK's MatrixRTC session for `room`, bound to the LIVE Room. The manager
 * creates a session on first request and caches it by room id for good, so
 * handing it a cached room-list placeholder (a detached Room the sidebar shows
 * before sync, see roomListCache) left that room's calls reading a dead,
 * empty timeline for the rest of the run: nobody ever showed as in the call
 * and every call card read "Call ended". Null until the SDK has the room.
 */
function rtcSessionFor(
    room: Room,
): ReturnType<MatrixClient["matrixRTC"]["getRoomSession"]> | null {
    const live = matrixClient?.getRoom(room.roomId);
    return live ? matrixClient!.matrixRTC.getRoomSession(live) : null;
}

/**
 * MatrixRTC drops a call membership whose sender isn't (yet) a known room
 * member, and only recomputes on call-membership changes. With lazy-loaded
 * members the caller's m.room.member often lands AFTER their call join, so
 * the call stayed invisible (no ring) until something else changed. Recompute
 * when a member event arrives for someone holding a live call membership.
 */
function recalcCallOnMemberLoaded(event: MatrixEvent): void {
    if (event.getType() !== EventType.RoomMember || !matrixClient) return;
    const room = matrixClient.getRoom(event.getRoomId());
    const userId = event.getStateKey();
    if (!room || !userId) return;
    const callState = room
        .getLiveTimeline()
        .getState(EventTimeline.FORWARDS)
        ?.getStateEvents(EventType.GroupCallMemberPrefix);
    const inCall = callState?.some(
        (e) =>
            e.getSender() === userId &&
            !isMembershipLeave(e.getContent() as Record<string, unknown>),
    );
    if (!inCall) return;
    void rtcSessionFor(room)
        ?.ensureRecalculateSessionMembers()
        .catch(() => {});
}

export function getRoomCallMemberships(room: Room): VoiceMembership[] {
    const session = rtcSessionFor(room);
    if (!session) return [];
    return session.memberships
        .filter((m) => !m.isExpired())
        .map((m) => ({
            userId: m.userId,
            deviceId: m.deviceId,
            joinedTs: m.createdTs(),
        }));
}

/** Fold call summaries from a set of ALREADY renderable-filtered events, keyed
 *  by the anchor event that renders each call's card. Liveness comes from the
 *  room's current MatrixRTC memberships, so a finished call reads as "answered"
 *  and only the in-progress call reads as "ongoing". Folding over the SAME
 *  filtered set that collapseCallEvents uses guarantees every surfaced anchor
 *  resolves here. */
function callSummaryMap(
    room: Room,
    renderableEvents: MatrixEvent[],
): Map<string, CallSummary> {
    const liveKeys = new Set(
        getRoomCallMemberships(room).map((m) => `${m.userId}|${m.deviceId}`),
    );
    const inputs = renderableEvents
        .filter((e) => isCallEventType(e.getType()))
        .map((e) => {
            const base = toCallEventInputBasic(e);
            if (isCallMemberEventType(base.type)) {
                const device = memberDeviceId(base.content);
                base.live = liveKeys.has(`${base.sender}|${device}`);
            }
            return base;
        });
    const map = new Map<string, CallSummary>();
    for (const s of summariseCallEvents(inputs))
        if (isCallSummaryRenderable(s)) map.set(s.anchorEventId, s);
    return map;
}

/** Call summaries for the live timeline, keyed by anchor event id. */
export function getCallSummaries(room: Room): Map<string, CallSummary> {
    return callSummaryMap(
        room,
        liveChainEvents(room).filter(isRenderableTimelineEvent),
    );
}

/** Call summaries for a jump-to-message context window, keyed by anchor event
 *  id — folded over the window's own events so context rows resolve correctly. */
export function getContextCallSummaries(
    room: Room,
    window: TimelineWindow,
): Map<string, CallSummary> {
    return callSummaryMap(
        room,
        window.getEvents().filter(isRenderableTimelineEvent),
    );
}

const voiceSessionSubscribers = new Set<() => void>();
const subscribedVoiceSessions = new WeakSet<object>();

// The manager-level session listeners are bound once for the first subscriber
// and unbound when the last leaves, instead of once per subscriber.
let voiceSessionsBound = false;
let onVoiceSessionStarted: ((roomId: string, session: object) => void) | null =
    null;
let onVoiceSessionEnded: (() => void) | null = null;

function notifyVoiceSessions(): void {
    for (const cb of voiceSessionSubscribers) cb();
}

function watchVoiceSession(session: {
    on: (ev: never, fn: never) => unknown;
}): void {
    if (subscribedVoiceSessions.has(session)) return;
    subscribedVoiceSessions.add(session);
    session.on("memberships_changed" as never, notifyVoiceSessions as never);
}

/**
 * Fires whenever any room's MatrixRTC memberships change (someone joins or
 * leaves a call anywhere). Cheap consumers bump a tick and re-derive.
 */
export function onVoiceSessionsChanged(cb: () => void): () => void {
    if (!matrixClient) return () => {};
    const manager = matrixClient.matrixRTC;
    voiceSessionSubscribers.add(cb);
    if (!voiceSessionsBound) {
        voiceSessionsBound = true;
        onVoiceSessionStarted = (_roomId: string, session: object) => {
            watchVoiceSession(session as never);
            notifyVoiceSessions();
        };
        onVoiceSessionEnded = () => notifyVoiceSessions();
        manager.on("session_started" as never, onVoiceSessionStarted as never);
        manager.on("session_ended" as never, onVoiceSessionEnded as never);
    }
    // Re-scan on EVERY subscribe (not just the first): the app-shell subscribers
    // bind at different sync phases (initVoiceCall pre-sync, initIncomingCalls
    // post-sync), and a call already in progress when a subscriber arrives may
    // have emitted `session_started` before that subscriber's phase. Idempotent
    // via the subscribedVoiceSessions WeakSet, so per-subscribe is cheap.
    for (const room of matrixClient.getRooms()) {
        watchVoiceSession(manager.getRoomSession(room) as never);
    }
    return () => {
        voiceSessionSubscribers.delete(cb);
        if (voiceSessionSubscribers.size === 0 && voiceSessionsBound) {
            if (onVoiceSessionStarted)
                manager.off(
                    "session_started" as never,
                    onVoiceSessionStarted as never,
                );
            if (onVoiceSessionEnded)
                manager.off(
                    "session_ended" as never,
                    onVoiceSessionEnded as never,
                );
            onVoiceSessionStarted = null;
            onVoiceSessionEnded = null;
            voiceSessionsBound = false;
        }
    };
}

/** livekit-client is ~half a megabyte of WebRTC that a text-only session
 *  never touches. It is fetched when a call starts; every value use in
 *  this file is inside the call region, and the loaded namespace is
 *  carried on ActiveVoiceCall so those uses cannot outrun the fetch. */
const livekit = lazyModule<LivekitModule>(() => import("livekit-client"));

interface ActiveVoiceCall {
    roomId: string;
    session: ReturnType<MatrixClient["matrixRTC"]["getRoomSession"]>;
    /** Where we publish: our own homeserver's SFU (multi-SFU), or the
     *  shared one when our homeserver advertises none. */
    lkRoom: LivekitRoom;
    publishKey: string;
    /** Multi-SFU: listen-only connections to the SFUs other members publish
     *  on, keyed by livekitTargetKey. lk-jwt-service only lets a homeserver's
     *  own users publish on its SFU, so everyone publishes at home and
     *  listens everywhere else. */
    remotes: Map<string, LivekitRoom>;
    /** Keys with a connect in flight, so a burst of membership changes
     *  doesn't open the same SFU twice. */
    remotesConnecting: Set<string>;
    /** SFUs we already told the user we couldn't reach (once per call). */
    remoteFailuresNotified: Set<string>;
    /** Active speakers per connection; the UI gets their union. */
    speakersByRoom: Map<LivekitRoom, string[]>;
    onMembershipsChanged: () => void;
    /** The loaded livekit-client namespace. Held here rather than read from
     *  a module global so the synchronous helpers below cannot reach for a
     *  Track enum before the chunk exists — an ActiveVoiceCall can only be
     *  constructed after the await. */
    lk: LivekitModule;
    audioEls: Set<HTMLAudioElement>;
    /** identity ("@user:server:DEVICE") → that publication's elements, so a
     *  per-user volume can be applied without disturbing anyone else. */
    elsByIdentity: Map<string, Set<HTMLAudioElement>>;
    onMmError: (err: unknown) => void;
    onMyMembership: (room: Room, membership: string) => void;
}

let activeVoice: ActiveVoiceCall | null = null;

/** Every LiveKit connection of a call: the publishing one first. */
function callLkRooms(call: ActiveVoiceCall): LivekitRoom[] {
    return [call.lkRoom, ...call.remotes.values()];
}
// Monotonic token for joinVoiceCall: a newer join bumps it, and any older
// in-flight invocation bails out at its next staleness check instead of
// reconnecting a room it no longer owns.
let voiceJoinSeq = 0;
// Serialize screen-share quality changes so concurrent setScreenShareQuality
// calls don't interleave their getParameters/setParameters on the sender
// (WebRTC requires each setParameters to be preceded by a fresh getParameters
// with nothing else calling setParameters in between).
let screenShareQualityChain: Promise<void> = Promise.resolve();
let voicePlaybackMuted = false;
// The mic state the user last asked for; consulted after connect so a mute
// toggled during the connect window isn't clobbered.
let desiredMicMuted = false;
// Whether the user currently wants the camera on. Intent, not LiveKit state:
// turning the camera off only MUTES the publication, so "is a camera track
// published" cannot answer this — see ensureVoiceDeviceWatch.
let desiredCameraOn = false;

// Output routing/volume for every tracked <audio> element. Captured from
// settings at join (account switches reload the page and re-read).
let voiceOutputDeviceId: string | null = null;
let voiceOutputVolume = 1;

// Per-user local audio (slider + local mute), keyed by userId — one entry per
// human, applied to every device they are joined from. Primed from persisted
// settings at init and kept here so a track that subscribes later (a late
// joiner, or a reconnect re-subscribing everything) gets the right level.
let participantAudio = new Map<string, ParticipantAudio>();

/** "@user:server:DEVICE" → "@user:server". Device ids never contain ":". */
function userIdFromIdentity(identity: string): string {
    return identity.slice(0, identity.lastIndexOf(":"));
}

function applyElementVolume(el: HTMLAudioElement, identity: string): void {
    el.volume = effectiveVolume(
        voiceOutputVolume,
        participantAudio.get(userIdFromIdentity(identity)),
    );
}

function applyVolumeForUser(userId: string): void {
    if (!activeVoice) return;
    for (const [identity, els] of activeVoice.elsByIdentity) {
        if (userIdFromIdentity(identity) !== userId) continue;
        for (const el of els) applyElementVolume(el, identity);
    }
}

/** Seed persisted per-user levels before any call starts. */
export function primeParticipantAudio(
    map: Map<string, ParticipantAudio>,
): void {
    participantAudio = new Map(map);
}

export function setParticipantVolume(userId: string, volume: number): void {
    const current = participantAudio.get(userId) ?? DEFAULT_PARTICIPANT_AUDIO;
    participantAudio.set(userId, withVolume(current, volume));
    applyVolumeForUser(userId);
}

export function setParticipantLocalMute(userId: string, muted: boolean): void {
    const current = participantAudio.get(userId) ?? DEFAULT_PARTICIPANT_AUDIO;
    participantAudio.set(userId, withLocalMute(current, muted));
    applyVolumeForUser(userId);
}

export function setParticipantVideoHidden(
    userId: string,
    hidden: boolean,
): void {
    const current = participantAudio.get(userId) ?? DEFAULT_PARTICIPANT_AUDIO;
    participantAudio.set(userId, withVideoHidden(current, hidden));
    applyVideoHiddenForUser(userId, hidden);
}

function applyVideoHiddenForUser(userId: string, hidden: boolean): void {
    if (!activeVoice) return;
    const lk = activeVoice.lk;
    for (const lkRoom of callLkRooms(activeVoice))
        for (const p of lkRoom.remoteParticipants.values()) {
            if (userIdFromIdentity(p.identity) !== userId) continue;
            for (const pub of p.videoTrackPublications.values()) {
                if (pub.source === lk.Track.Source.Camera)
                    pub.setEnabled(!hidden);
            }
        }
}

function applyVoiceSink(el: HTMLAudioElement): void {
    const sinkEl = el as HTMLAudioElement & {
        setSinkId?: (id: string) => Promise<void>;
    };
    // "" selects the default sink; missing setSinkId (Android) → OS routes.
    void sinkEl.setSinkId?.(voiceOutputDeviceId ?? "").catch(() => {});
}

// Mid-call input unplug: on a track ending (livekit-client 2.20.1
// `handleTrackEnded`) LiveKit restarts the mic against `deviceId: "default"`,
// but restarts the camera against its existing NON-exact constraints — so the
// camera either lands on some other camera or fails and mutes. Hence the mic
// notice can promise a fallback and the camera notice cannot.
// One notice per kind per call.
// The devicechange listener is installed once and lives for the page: it bails
// when no call is active, so there is nothing to tear down.
let voiceDeviceWatchStarted = false;
let audioInputGoneNotified: ActiveVoiceCall | null = null;
let videoInputGoneNotified: ActiveVoiceCall | null = null;

const VOICE_DEVICE_NOTICE: Record<VoiceInputKind, string> = {
    audioinput: t("client.microphoneDisconnectedSwitchedToTheDefault"),
    videoinput: t("client.cameraDisconnected"),
};

/** The camera's REAL capture device, read off the live publication rather than
 *  `settingsState.videoInputDeviceId`: `setCameraEnabled` passes that id as a
 *  non-exact constraint, so the browser may have substituted another camera
 *  and warning about the saved one would be a phantom.
 *
 *  Deliberately NOT `isCameraEnabled`: that is `!isMuted`, and the unplug we
 *  are trying to report is exactly what makes LiveKit mute the track. The
 *  publication and its stopped MediaStreamTrack outlive that mute, which is
 *  what keeps the id readable — but it also means a non-null answer does NOT
 *  mean the camera is on, so callers gate on `desiredCameraOn` first.
 *
 *  Null when nothing was ever published, or if an engine ever stops reporting
 *  `deviceId` for a stopped track — both fail quiet (no notice). */
function activeCameraDeviceId(call: ActiveVoiceCall): string | null {
    const track = call.lkRoom.localParticipant.getTrackPublication(
        call.lk.Track.Source.Camera,
    )?.videoTrack?.mediaStreamTrack;
    return track?.getSettings().deviceId ?? null;
}

function ensureVoiceDeviceWatch(): void {
    if (voiceDeviceWatchStarted || !navigator.mediaDevices?.addEventListener)
        return;
    const onChange = async () => {
        const call = activeVoice;
        if (!call) return;
        // Snapshot before the await: LiveKit reacts to the same unplug, and
        // with a second camera present its restart succeeds onto that one —
        // reading afterwards would find a present device and stay silent.
        const cameraId = desiredCameraOn ? activeCameraDeviceId(call) : null;
        // null (not []) on failure: an empty list means "nothing is plugged
        // in", a rejection means "we do not know" — see voiceDeviceNotices.
        const devices = await navigator.mediaDevices
            .enumerateDevices()
            .catch(() => null);
        if (activeVoice !== call) return;
        const notices = voiceDeviceNotices({
            devices,
            audioInputId: settingsState.audioInputDeviceId,
            videoInputId: cameraId,
            audioNotified: audioInputGoneNotified === call,
            videoNotified: videoInputGoneNotified === call,
        });
        for (const kind of notices) {
            if (kind === "audioinput") audioInputGoneNotified = call;
            else videoInputGoneNotified = call;
            notifyVoiceNotice(VOICE_DEVICE_NOTICE[kind]);
        }
    };
    navigator.mediaDevices.addEventListener("devicechange", onChange);
    voiceDeviceWatchStarted = true;
}

type VoiceConnStateCb = (
    state: "connecting" | "connected" | "reconnecting" | null,
    roomId: string | null,
) => void;
const voiceConnStateSubscribers = new Set<VoiceConnStateCb>();
const activeSpeakerSubscribers = new Set<(memberIds: string[]) => void>();
const participantMuteSubscribers = new Set<
    (mutedIdentities: string[]) => void
>();

function notifyVoiceConnState(
    state: "connecting" | "connected" | "reconnecting" | null,
): void {
    const roomId = activeVoice?.roomId ?? null;
    for (const cb of voiceConnStateSubscribers) cb(state, roomId);
}

export function onVoiceConnStateChanged(cb: VoiceConnStateCb): () => void {
    voiceConnStateSubscribers.add(cb);
    return () => voiceConnStateSubscribers.delete(cb);
}

export function onActiveSpeakersChanged(
    cb: (memberIds: string[]) => void,
): () => void {
    activeSpeakerSubscribers.add(cb);
    return () => activeSpeakerSubscribers.delete(cb);
}

/**
 * Fires with every currently mic-muted remote identity whenever any of them
 * changes. Only meaningful for the call we are connected to — LiveKit reports
 * track mute state only for a room we have joined. Remote deafen is not
 * knowable and is never reported here.
 */
export function onParticipantMuteChanged(
    cb: (mutedIdentities: string[]) => void,
): () => void {
    participantMuteSubscribers.add(cb);
    return () => participantMuteSubscribers.delete(cb);
}

const videoTracksSubscribers = new Set<
    (tiles: VideoTileDescriptor[]) => void
>();

/** Fires with the current renderable video tiles (remote + local camera and
 *  screenshare) whenever any video track is added or removed. Emits [] on
 *  teardown. Only meaningful for the call we are connected to. */
export function onVideoTracksChanged(
    cb: (tiles: VideoTileDescriptor[]) => void,
): () => void {
    videoTracksSubscribers.add(cb);
    return () => videoTracksSubscribers.delete(cb);
}

/** Walk every connection's participants and collect subscribed video tracks
 *  as normalized inputs for buildVideoTiles(). Local tracks live on the
 *  publishing connection only. */
function currentVideoInputs(call: ActiveVoiceCall): VideoPublicationInput[] {
    const lk = call.lk;
    const out: VideoPublicationInput[] = [];
    const addFrom = (
        p: RemoteParticipant | LocalParticipant,
        isLocal: boolean,
    ): void => {
        for (const pub of p.videoTrackPublications.values()) {
            const track = (pub as TrackPublication).track;
            if (!track) continue; // remote: not subscribed yet
            // A dead frame stays published in two ways: turning a camera off
            // MUTES its track (LiveKit unpublishes only screenshares), and a
            // stopped remote share can arrive as an SFU stream *pause* rather
            // than an unpublish. Either way skip it so the tile drops back to
            // the avatar / disappears instead of freezing on a black frame.
            if (
                (pub as TrackPublication).isMuted ||
                track.streamState === lk.Track.StreamState.Paused
            )
                continue;
            let source: VideoSource | null = null;
            if (pub.source === lk.Track.Source.Camera) source = "camera";
            else if (pub.source === lk.Track.Source.ScreenShare)
                source = "screenshare";
            if (!source) continue;
            out.push({
                userId: userIdFromIdentity(p.identity),
                identity: p.identity,
                source,
                isLocal,
                track,
            });
        }
    };
    for (const lkRoom of callLkRooms(call))
        for (const p of lkRoom.remoteParticipants.values()) addFrom(p, false);
    addFrom(call.lkRoom.localParticipant, true);
    return out;
}

const voiceErrorSubscribers = new Set<(message: string) => void>();

/** Fires when an established/joining call fails fatally (e.g. the server
 *  rejects our membership state event) and has been torn down. */
export function onVoiceCallError(cb: (message: string) => void): () => void {
    voiceErrorSubscribers.add(cb);
    return () => voiceErrorSubscribers.delete(cb);
}

const voiceNoticeSubscribers = new Set<(message: string) => void>();

/** Non-fatal call notices (device errors, silent mic): toast, no teardown.
 *  Kept separate from onVoiceCallError so error-sound logic never misfires. */
export function onVoiceNotice(cb: (message: string) => void): () => void {
    voiceNoticeSubscribers.add(cb);
    return () => voiceNoticeSubscribers.delete(cb);
}

function notifyVoiceNotice(message: string): void {
    for (const cb of voiceNoticeSubscribers) cb(message);
}

let voicePlaybackBlocked = false;
const voicePlaybackBlockedSubscribers = new Set<(blocked: boolean) => void>();

/** Autoplay policy blocked remote audio; show "Enable audio" and call
 *  resumeVoicePlayback() from a user gesture. */
export function onVoicePlaybackBlockedChanged(
    cb: (blocked: boolean) => void,
): () => void {
    voicePlaybackBlockedSubscribers.add(cb);
    return () => voicePlaybackBlockedSubscribers.delete(cb);
}

function setVoicePlaybackBlocked(blocked: boolean): void {
    if (voicePlaybackBlocked === blocked) return;
    voicePlaybackBlocked = blocked;
    for (const cb of voicePlaybackBlockedSubscribers) cb(blocked);
}

export async function resumeVoicePlayback(): Promise<void> {
    if (!activeVoice) return;
    await Promise.all(
        callLkRooms(activeVoice).map((r) => r.startAudio().catch(() => {})),
    );
}

export function getActiveVoiceRoomId(): string | null {
    return activeVoice?.roomId ?? null;
}

/** The homeserver's advertised MatrixRTC foci (MSC4143 .well-known). */
async function configuredRtcFoci(): Promise<unknown[]> {
    if (!matrixClient) return [];
    let wk = matrixClient.getClientWellKnown() as
        Record<string, unknown> | undefined;
    if (!wk) {
        // startClient() doesn't pass clientWellKnownPollPeriod, so the SDK
        // never fetches .well-known on its own and getClientWellKnown()
        // stays undefined — fetch it once on demand (the SDK caches it). A
        // failed fetch just means no advertised foci, not a failed call.
        wk = (await matrixClient.waitForClientWellKnown().catch(() => {
            return undefined;
        })) as Record<string, unknown> | undefined;
    }
    const foci = wk?.["org.matrix.msc4143.rtc_foci"];
    return Array.isArray(foci) ? foci : [];
}

/** Ask an SFU's lk-jwt-service for a LiveKit token (legacy /sfu/get). On our
 *  own SFU it may publish; on another homeserver's it is listen-only. */
async function fetchSfuJwt(
    target: LivekitTarget,
): Promise<{ url: string; jwt: string }> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const openIdToken = await matrixClient.getOpenIdToken();
    const res = await fetch(sfuJwtUrl(target.serviceUrl), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            room: target.alias,
            openid_token: openIdToken,
            device_id: matrixClient.getDeviceId(),
        }),
    });
    if (!res.ok) {
        throw new Error(
            t("client.voiceServerRejectedTheJoin", { status: res.status }),
        );
    }
    return (await res.json()) as { url: string; jwt: string };
}

/** Remote identities with a muted mic, across every connection. */
function notifyCallMutes(call: ActiveVoiceCall): void {
    if (activeVoice !== call) return;
    const muted = new Set<string>();
    for (const lkRoom of callLkRooms(call))
        for (const p of lkRoom.remoteParticipants.values())
            for (const pub of p.audioTrackPublications.values())
                if (pub.isMuted) {
                    muted.add(p.identity);
                    break;
                }
    for (const cb of participantMuteSubscribers) cb([...muted]);
}

function notifyCallVideo(call: ActiveVoiceCall): void {
    if (activeVoice !== call) return;
    const tiles = buildVideoTiles(currentVideoInputs(call));
    for (const cb of videoTracksSubscribers) cb(tiles);
}

function notifyCallSpeakers(call: ActiveVoiceCall): void {
    if (activeVoice !== call) return;
    const ids = new Set<string>();
    for (const list of call.speakersByRoom.values())
        for (const id of list) ids.add(id);
    for (const cb of activeSpeakerSubscribers) cb([...ids]);
}

/** Remote media for one connection of `call` (publishing or listen-only):
 *  attach audio, honour per-user video hiding, and feed the merged speaker,
 *  mute and video-tile views. */
function wireCallMedia(call: ActiveVoiceCall, lkRoom: LivekitRoom): void {
    const lk = call.lk;
    lkRoom.on(
        lk.RoomEvent.TrackSubscribed,
        (
            track: RemoteTrack,
            pub: RemoteTrackPublication,
            participant: RemoteParticipant,
        ) => {
            if (track.kind === lk.Track.Kind.Video) {
                const uid = userIdFromIdentity(participant.identity);
                if (
                    participantAudio.get(uid)?.videoHidden &&
                    pub.source === lk.Track.Source.Camera
                ) {
                    pub.setEnabled(false);
                }
                return;
            }
            if (track.kind !== lk.Track.Kind.Audio) return;
            if (activeVoice !== call) {
                // Call already superseded/left — don't attach at all.
                track.detach().forEach((el) => el.remove());
                return;
            }
            const el = track.attach() as HTMLAudioElement;
            el.muted = voicePlaybackMuted;
            applyVoiceSink(el);
            applyElementVolume(el, participant.identity);
            call.audioEls.add(el);
            let els = call.elsByIdentity.get(participant.identity);
            if (!els) {
                els = new Set();
                call.elsByIdentity.set(participant.identity, els);
            }
            els.add(el);
            document.body.appendChild(el);
        },
    );
    lkRoom.on(lk.RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        for (const el of track.detach()) {
            const audioEl = el as HTMLAudioElement;
            call.audioEls.delete(audioEl);
            for (const [identity, els] of call.elsByIdentity) {
                els.delete(audioEl);
                if (els.size === 0) call.elsByIdentity.delete(identity);
            }
            el.remove();
        }
    });
    lkRoom.on(lk.RoomEvent.ActiveSpeakersChanged, (speakers) => {
        call.speakersByRoom.set(
            lkRoom,
            speakers.map((p) => p.identity),
        );
        notifyCallSpeakers(call);
    });
    const mutes = () => notifyCallMutes(call);
    lkRoom.on(lk.RoomEvent.TrackMuted, mutes);
    lkRoom.on(lk.RoomEvent.TrackUnmuted, mutes);
    // A participant arriving already muted fires neither event.
    lkRoom.on(lk.RoomEvent.TrackSubscribed, mutes);
    lkRoom.on(lk.RoomEvent.ParticipantDisconnected, mutes);
    const video = () => notifyCallVideo(call);
    lkRoom.on(lk.RoomEvent.TrackSubscribed, video);
    lkRoom.on(lk.RoomEvent.TrackUnsubscribed, video);
    // Camera off = track.mute(), not unpublish — recompute on mute/unmute
    // too, so the tile drops to the avatar (and returns) as it toggles.
    lkRoom.on(lk.RoomEvent.TrackMuted, video);
    lkRoom.on(lk.RoomEvent.TrackUnmuted, video);
    // A remote stopping a share can surface as a bare TrackUnpublished
    // (no TrackUnsubscribed, if the track was already detached) or as an
    // SFU stream-state pause — recompute on both so their tile clears.
    lkRoom.on(lk.RoomEvent.TrackUnpublished, video);
    lkRoom.on(lk.RoomEvent.TrackStreamStateChanged, video);
    lkRoom.on(lk.RoomEvent.ParticipantDisconnected, video);
    lkRoom.on(lk.RoomEvent.AudioPlaybackStatusChanged, () => {
        if (activeVoice !== call) return;
        setVoicePlaybackBlocked(
            callLkRooms(call).some((r) => !r.canPlaybackAudio),
        );
    });
}

// Retry an SFU we lost or couldn't reach, while the call still needs it.
const REMOTE_SFU_RETRY_MS = 10_000;

/** Bring `call`'s listen-only connections in line with where the other
 *  members publish: connect to new SFUs, drop ones nobody uses any more. */
async function syncRemoteSfus(call: ActiveVoiceCall): Promise<void> {
    if (activeVoice !== call || !matrixClient) return;
    const me = matrixClient.getUserId();
    const myDevice = matrixClient.getDeviceId();
    const oldest = call.session.getOldestMembership();
    const transports = oldest
        ? call.session.memberships
              .filter((m) => !(m.userId === me && m.deviceId === myDevice))
              .map((m) => m.getTransport(oldest))
        : [];
    const wanted = remoteLivekitTargets(
        transports,
        call.publishKey,
        call.roomId,
    );
    for (const [key, lkRoom] of call.remotes) {
        if (wanted.has(key)) continue;
        call.remotes.delete(key);
        call.speakersByRoom.delete(lkRoom);
        void lkRoom.disconnect().catch(() => {});
    }
    for (const [key, target] of wanted)
        if (!call.remotes.has(key) && !call.remotesConnecting.has(key))
            void connectRemoteSfu(call, key, target);
    notifyCallMutes(call);
    notifyCallVideo(call);
    notifyCallSpeakers(call);
}

async function connectRemoteSfu(
    call: ActiveVoiceCall,
    key: string,
    target: LivekitTarget,
): Promise<void> {
    call.remotesConnecting.add(key);
    const lkRoom = new call.lk.Room();
    try {
        const { url, jwt } = await fetchSfuJwt(target);
        if (activeVoice !== call) return;
        wireCallMedia(call, lkRoom);
        lkRoom.on(call.lk.RoomEvent.Disconnected, () => {
            // Dropped by the SFU or the network (our own disconnects remove
            // the entry first): forget it and try again shortly.
            if (call.remotes.get(key) !== lkRoom) return;
            call.remotes.delete(key);
            call.speakersByRoom.delete(lkRoom);
            notifyCallMutes(call);
            notifyCallVideo(call);
            notifyCallSpeakers(call);
            setTimeout(() => void syncRemoteSfus(call), REMOTE_SFU_RETRY_MS);
        });
        await lkRoom.connect(url, jwt);
        if (activeVoice !== call) {
            await lkRoom.disconnect().catch(() => {});
            return;
        }
        call.remotes.set(key, lkRoom);
        call.remoteFailuresNotified.delete(key);
        // Settles anything that changed while connecting (incl. the SFU no
        // longer being wanted) and refreshes the merged views.
        void syncRemoteSfus(call);
    } catch (err) {
        await lkRoom.disconnect().catch(() => {});
        if (activeVoice !== call) return;
        console.warn("[voice] couldn't connect to", target.serviceUrl, err);
        if (!call.remoteFailuresNotified.has(key)) {
            call.remoteFailuresNotified.add(key);
            let server = target.serviceUrl;
            try {
                server = new URL(target.serviceUrl).host;
            } catch {
                /* not a URL: show it as-is */
            }
            notifyVoiceNotice(t("client.couldNotReachCallServer", { server }));
        }
        setTimeout(() => void syncRemoteSfus(call), REMOTE_SFU_RETRY_MS);
    } finally {
        call.remotesConnecting.delete(key);
    }
}

/**
 * Join the MatrixRTC voice call in a room.
 *
 * Resolves without joining when superseded mid-flight by a newer
 * `joinVoiceCall` or an explicit `leaveVoiceCall`; rejects on
 * mic-permission, JWT, or SFU failure. Observe the actual state via
 * `onVoiceConnStateChanged` / `getActiveVoiceRoomId`, not the returned
 * promise.
 */
export async function joinVoiceCall(roomId: string): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const room = matrixClient.getRoom(roomId);
    if (!room) throw new Error(t("client.unknownRoom"));
    const seq = ++voiceJoinSeq;
    // Start the chunk fetch now so it overlaps leaveVoiceCallInternal(), the
    // mic permission prompt and configuredRtcFoci(); it is awaited just
    // before the Room is constructed. The no-op catch only stops an
    // unhandled rejection if we bail out before that await — awaiting this
    // same promise below still throws.
    const livekitLoad = livekit.load();
    livekitLoad.catch(() => {});
    await leaveVoiceCallInternal();
    if (seq !== voiceJoinSeq) return; // superseded while leaving

    // Fail fast on mic permission before announcing membership.
    const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
    probe.getTracks().forEach((t) => t.stop());
    if (seq !== voiceJoinSeq) return;

    const session = matrixClient.matrixRTC.getRoomSession(room);
    const oldest = session.getOldestMembership();
    const memberTransports = oldest
        ? session.memberships
              .map((m) => m.getTransport(oldest))
              .filter((t): t is NonNullable<typeof t> => !!t)
        : [];
    const foci = await configuredRtcFoci();
    if (seq !== voiceJoinSeq) return;
    // Multi-SFU: publish on our own homeserver's SFU (the only one whose
    // lk-jwt-service lets us publish) and listen on everyone else's. A
    // homeserver without one falls back to the shared SFU of the oldest member.
    const ownTarget = pickOwnLivekitTransport(foci, roomId);
    const target =
        ownTarget ?? pickLivekitTransport(memberTransports, foci, roomId);
    if (!target) throw new Error("No LiveKit focus available for this call");

    const userId = matrixClient.getUserId()!;
    const deviceId = matrixClient.getDeviceId()!;
    // Snapshot the call's non-self peers BEFORE our own membership publishes,
    // so we can tell "starting a call" (ring the peer) from "answering one"
    // (stay silent). See the ring-send after joinRTCSession below.
    const callPeersBeforeJoin = getRoomCallMemberships(room)
        .map((m) => m.userId)
        .filter((id) => id !== userId);
    const lk = await livekitLoad;
    if (seq !== voiceJoinSeq) return; // superseded while loading livekit
    const lkRoom = new lk.Room({
        audioCaptureDefaults: {
            deviceId: settingsState.audioInputDeviceId ?? undefined,
            noiseSuppression: settingsState.noiseSuppression,
            echoCancellation: settingsState.echoCancellation,
            autoGainControl: settingsState.autoGainControl,
        },
    });
    voiceOutputDeviceId = settingsState.audioOutputDeviceId;
    voiceOutputVolume = settingsState.callOutputVolume;
    // The SDK's MembershipManager gives up for good on some failures (e.g.
    // a 403 on the call.member state PUT in rooms where we lack power) and
    // only reports it via this session event — without it we'd stay
    // connected to LiveKit, audible but invisible to everyone else.
    const onMmError = (err: unknown) => {
        if (activeVoice !== call) return;
        console.error("Voice call membership failed:", err);
        const detail = matrixErrorMessage(
            err,
            t("client.theServerRejectedItYouMay"),
        );
        for (const cb of voiceErrorSubscribers)
            cb(t("client.callMembershipFailed", { detail }));
        void leaveVoiceCall();
    };
    const onMyMembership = (room: Room, membership: string) => {
        // Someone removed me (kick/ban) or I left elsewhere while in this
        // call: the SFU connection + mic would otherwise stay live in a room
        // I'm no longer in. Tear down and say why.
        if (activeVoice !== call || room.roomId !== call.roomId) return;
        const me = matrixClient!.getUserId();
        if (!me) return;
        // Prefer the member object's cached event, but fall back to the live
        // state event — either can be missing after I leave from another device.
        const sender =
            room.getMember(me)?.events?.member?.getSender() ??
            room.currentState.getStateEvents("m.room.member", me)?.getSender();
        const msg = callEndedMembershipMessage(membership, sender, me);
        if (!msg) return;
        for (const cb of voiceErrorSubscribers) cb(msg);
        void leaveVoiceCall();
    };
    const call: ActiveVoiceCall = {
        roomId,
        session,
        lkRoom,
        publishKey: livekitTargetKey(target),
        remotes: new Map(),
        remotesConnecting: new Set(),
        remoteFailuresNotified: new Set(),
        speakersByRoom: new Map(),
        onMembershipsChanged: () => void syncRemoteSfus(call),
        lk,
        audioEls: new Set(),
        elsByIdentity: new Map(),
        onMmError,
        onMyMembership,
    };
    activeVoice = call;
    ensureVoiceDeviceWatch();
    desiredMicMuted = false;
    desiredCameraOn = false;
    notifyVoiceConnState("connecting");
    session.on("membership_manager_error" as never, onMmError as never);
    matrixClient.on("Room.myMembership" as never, onMyMembership as never);

    let connected = false;
    try {
        // MSC4075 ring: if WE are the first into a DM call, the SDK sends an
        // rtc.notification ring once our membership lands, so the peer's
        // devices ring even with the app closed. It skips the ring itself if
        // someone else is already in the call by then; answering (a peer
        // already present at snapshot time) never asks for one.
        const ring = shouldRingPeers(
            getDirectRoomIds().has(roomId),
            callPeersBeforeJoin,
        );
        const transport = {
            type: "livekit",
            livekit_service_url: target.serviceUrl,
            livekit_alias: target.alias,
        };
        // multi_sfu advertises the SFU we publish on (the SDK lists it first
        // in foci_preferred); oldest_membership joins the shared SFU instead.
        session.joinRTCSession(
            { userId, deviceId, memberId: `${userId}:${deviceId}` },
            ownTarget ? [] : [transport],
            ownTarget ? transport : undefined,
            {
                membershipEventExpiryMs: 4 * 60 * 60 * 1000,
                ...(ring
                    ? { notificationType: "ring" as const, callIntent: "audio" }
                    : {}),
            },
        );

        const { url, jwt } = await fetchSfuJwt(target);
        if (seq !== voiceJoinSeq) return;

        wireCallMedia(call, lkRoom);
        // Our own camera/screenshare tiles: only the publishing connection
        // has local tracks.
        lkRoom.on(lk.RoomEvent.LocalTrackPublished, () =>
            notifyCallVideo(call),
        );
        lkRoom.on(lk.RoomEvent.LocalTrackUnpublished, () =>
            notifyCallVideo(call),
        );
        lkRoom.on(lk.RoomEvent.Reconnecting, () => {
            if (activeVoice !== call) return;
            notifyVoiceConnState("reconnecting");
        });
        lkRoom.on(lk.RoomEvent.Reconnected, () => {
            if (activeVoice !== call) return;
            notifyVoiceConnState("connected");
        });
        lkRoom.on(lk.RoomEvent.Disconnected, () => {
            // SFU kicked us or the connection died for good — tear down
            // fully and tell the user. User-initiated leaves null
            // activeVoice first, so this only fires on genuine drops.
            // LiveKit emits Disconnected while still Connecting when the
            // connect fails; the join's own catch reports that failure
            // exactly once, so only act here when we were connected.
            if (connected && activeVoice?.lkRoom === lkRoom) {
                for (const cb of voiceErrorSubscribers)
                    cb(t("client.voiceCallDisconnected"));
                void leaveVoiceCall();
            }
        });
        let silenceNotified = false;
        lkRoom.on(lk.RoomEvent.LocalAudioSilenceDetected, () => {
            if (activeVoice !== call || silenceNotified) return;
            silenceNotified = true;
            notifyVoiceNotice(t("client.yourMicrophoneAppearsSilentCheckYour"));
        });
        lkRoom.on(lk.RoomEvent.MediaDevicesError, (e: Error) => {
            if (activeVoice !== call) return;
            // LiveKit emits this BEFORE it rethrows the getUserMedia/
            // getDisplayMedia rejection, so it also fires on every ordinary
            // dismissal of a picker or permission prompt. Without this guard,
            // cancelling the screen-share picker toasts a bogus "Audio device
            // error", and a denied camera permission double-toasts alongside
            // setCameraEnabled's own (accurate) message.
            if (isUserCancel(e)) return;
            notifyVoiceNotice(
                t("client.audioDeviceError", { message: e.message }),
            );
        });

        await lkRoom.connect(url, jwt);
        connected = true;
        if (seq !== voiceJoinSeq) {
            await lkRoom.disconnect().catch(() => {});
            return;
        }
        await lkRoom.localParticipant.setMicrophoneEnabled(!desiredMicMuted);
        if (seq !== voiceJoinSeq) {
            await lkRoom.disconnect().catch(() => {});
            return;
        }
        notifyVoiceConnState("connected");
        setVoicePlaybackBlocked(!lkRoom.canPlaybackAudio);
        // Now listen on every other member's SFU, and keep that set in step
        // with the call's membership.
        session.on(
            "memberships_changed" as never,
            call.onMembershipsChanged as never,
        );
        void syncRemoteSfus(call);
    } catch (err) {
        if (activeVoice === call) {
            await leaveVoiceCall();
            throw err;
        } else {
            // Superseded mid-join: tear down our own resources only. The
            // superseder's leave already left the RTC session; don't touch
            // the per-room session object a rejoin may be re-joining. Return
            // without throwing — the superseder owns the outcome, and the
            // function's doc contract says it resolves without joining when
            // superseded.
            for (const el of call.audioEls) el.remove();
            call.audioEls.clear();
            await Promise.allSettled(
                callLkRooms(call).map((r) => r.disconnect()),
            );
            return;
        }
    }
}

export async function leaveVoiceCall(): Promise<void> {
    // An explicit leave invalidates any in-flight join, which bails at its
    // next staleness check instead of resurrecting the call.
    voiceJoinSeq++;
    await leaveVoiceCallInternal();
}

let voiceLeaveInFlight: Promise<void> | null = null;

async function leaveVoiceCallInternal(): Promise<void> {
    while (voiceLeaveInFlight) await voiceLeaveInFlight;
    const call = activeVoice;
    if (!call) return;
    const run = (async () => {
        activeVoice = null;
        // These only ever hold the call they belong to; dropping them here
        // keeps a finished call's LiveKit Room and audio elements collectable.
        audioInputGoneNotified = null;
        videoInputGoneNotified = null;
        // Playback mute (deafen) is per-call state — a stale flag would attach
        // every remote track of the NEXT call muted while the UI shows undeafened.
        voicePlaybackMuted = false;
        // Notify subscribers before the network teardown below so the UI clears
        // instantly; the join seq guard protects a racing join.
        for (const cb of activeSpeakerSubscribers) cb([]);
        for (const cb of participantMuteSubscribers) cb([]);
        for (const cb of videoTracksSubscribers) cb([]);
        notifyVoiceConnState(null);
        setVoicePlaybackBlocked(false);
        call.session.off(
            "membership_manager_error" as never,
            call.onMmError as never,
        );
        matrixClient?.off(
            "Room.myMembership" as never,
            call.onMyMembership as never,
        );
        call.session.off(
            "memberships_changed" as never,
            call.onMembershipsChanged as never,
        );
        for (const el of call.audioEls) el.remove();
        call.audioEls.clear();
        // In parallel, not SFU-first: the membership leave is what other
        // users' rosters see, and it must fit the account-switch and logout
        // windows even when the LiveKit teardown is slow (audit IMP-1).
        // Both settle quietly: a rejected disconnect means already gone.
        await Promise.allSettled([
            ...callLkRooms(call).map((r) => r.disconnect()),
            call.session.leaveRoomSession(10_000),
        ]);
    })();
    voiceLeaveInFlight = run;
    try {
        await run;
    } finally {
        voiceLeaveInFlight = null;
    }
}

/** Returns false when the device refused (e.g. unmuting a dead mic) so the
 *  caller can roll the UI back to the truth. */
export async function setMicMuted(muted: boolean): Promise<boolean> {
    desiredMicMuted = muted;
    const call = activeVoice;
    if (!call) return true;
    try {
        await call.lkRoom.localParticipant.setMicrophoneEnabled(!muted);
        return true;
    } catch {
        // A failed unmute leaves the mic muted in reality.
        if (activeVoice === call && !muted) desiredMicMuted = true;
        return false;
    }
}

export function setVoicePlaybackMuted(muted: boolean): void {
    voicePlaybackMuted = muted;
    if (!activeVoice) return;
    for (const el of activeVoice.audioEls) el.muted = muted;
}

/** Route call audio to an output device (null = system default). Applies to
 *  the live call and to future attaches; no-op where setSinkId is missing. */
export function setVoiceOutputDevice(deviceId: string | null): void {
    voiceOutputDeviceId = deviceId;
    if (!activeVoice) return;
    for (const el of activeVoice.audioEls) applyVoiceSink(el);
}

export function setVoiceOutputVolume(volume: number): void {
    voiceOutputVolume = Math.min(1, Math.max(0, volume));
    if (!activeVoice) return;
    for (const [identity, els] of activeVoice.elsByIdentity) {
        for (const el of els) applyElementVolume(el, identity);
    }
}

/** Switch a live call input device. LiveKit's restart stops the current
 *  track BEFORE acquiring the new device, so a failed switch (device held by
 *  another app, vanished id) leaves the published track ended and silent.
 *  On failure, restore the previous device (else the system default), point
 *  the saved selection back at the device actually in use (callers persist
 *  the pick before switching), and tell the user. Resolves either way; never
 *  throws. A muted mic is not covered: LiveKit defers its restart to unmute. */
async function switchInputWithRecovery(
    call: ActiveVoiceCall,
    kind: "audioinput" | "videoinput",
    deviceId: string,
    exact: boolean,
    what: string,
): Promise<void> {
    const source =
        kind === "audioinput"
            ? call.lk.Track.Source.Microphone
            : call.lk.Track.Source.Camera;
    const track =
        call.lkRoom.localParticipant.getTrackPublication(source)?.track;
    const previousId = track?.mediaStreamTrack.getSettings().deviceId;
    const persist =
        kind === "audioinput" ? setAudioInputDeviceId : setVideoInputDeviceId;
    const trySwitch = async (id: string, ex: boolean): Promise<boolean> => {
        try {
            return (
                (await call.lkRoom.switchActiveDevice(kind, id, ex)) !== false
            );
        } catch {
            return false;
        }
    };
    if (await trySwitch(deviceId, exact)) return;
    if (activeVoice !== call) return;
    // exact: Chromium treats a bare (ideal) deviceId as a hint and hands back
    // the default device, which LiveKit then reports as a failed switch.
    if (
        previousId &&
        previousId !== "default" &&
        (await trySwitch(previousId, true))
    ) {
        persist(previousId);
        if (activeVoice === call)
            notifyVoiceNotice(t("client.couldnTSwitchToThatKept", { what }));
        return;
    }
    const onDefault = await trySwitch("default", false);
    if (onDefault) persist(null);
    if (activeVoice !== call) return;
    notifyVoiceNotice(
        onDefault
            ? t("client.couldnTSwitchToThatUsing", { what })
            : t("client.couldnTSwitchToThatPick", { what }),
    );
}

/** Switch the live call's microphone. A null deviceId selects the system
 *  default device live (previously this was a no-op that only took effect on
 *  the next join). */
export async function setVoiceInputDevice(
    deviceId: string | null,
): Promise<void> {
    const call = activeVoice;
    if (!call) return;
    // A real device uses exact:true (switchActiveDevice's default). System
    // default: LiveKit resolves the "default" sentinel to the OS default
    // input; exact:false so browsers without a literal "default" device id
    // (Firefox) fall back to their default instead of throwing.
    await switchInputWithRecovery(
        call,
        "audioinput",
        deviceId ?? "default",
        !!deviceId,
        t("client.deviceNounMicrophone"),
    );
}

/** getDisplayMedia rejects with NotAllowedError/AbortError when the user
 *  dismisses the OS picker — that is a choice, not a failure, so it must not
 *  toast. */
function isUserCancel(err: unknown): boolean {
    return (
        err instanceof DOMException &&
        (err.name === "NotAllowedError" || err.name === "AbortError")
    );
}

/** Start/stop publishing a screen share (with system audio per settings).
 *  Returns whether a share is now being published. The store drives its UI
 *  state from LocalTrackPublished/Unpublished, so this return is advisory. */
export async function setScreenShareEnabled(on: boolean): Promise<boolean> {
    const call = activeVoice;
    if (!call) return false;
    try {
        await call.lkRoom.localParticipant.setScreenShareEnabled(
            on,
            {
                audio: settingsState.shareSystemAudio,
                resolution: screenShareCaptureResolution(
                    settingsState.screenShareResolution,
                    Number(settingsState.screenShareFps),
                ),
                // A screen share is mostly text/UI: bias the encoder toward
                // keeping resolution sharp rather than dropping it to hold
                // framerate under load (which blurs text while scrolling).
                // The opposite of camera video — do NOT flip this back to
                // "motion"/"maintain-framerate" for the screen-share path.
                contentHint: "detail",
            },
            {
                screenShareEncoding: screenShareEncodingFor(
                    settingsState.screenShareResolution,
                    Number(settingsState.screenShareFps),
                ),
                degradationPreference: "maintain-resolution",
            },
        );
        return on;
    } catch (err) {
        if (isUserCancel(err)) return false;
        console.error("Screen share failed:", err);
        // Left the call while the picker was open: LiveKit already dropped
        // the late track, and a failure toast for an ended call is noise.
        if (activeVoice !== call) return false;
        notifyVoiceNotice(t("client.couldNotStartScreenShare"));
        return false;
    }
}

/** Re-target the currently published screen share to a new quality without
 *  re-acquiring the capture: applyConstraints moves the running capture's
 *  resolution/fps, then the publish encoding (bitrate/framerate cap) follows.
 *  No-op when nothing is being shared. */
async function applyScreenShareQualityNow(
    resKey: string,
    fps: number,
): Promise<void> {
    const call = activeVoice;
    if (!call) return;
    const track = call.lkRoom.localParticipant.getTrackPublication(
        call.lk.Track.Source.ScreenShare,
    )?.videoTrack;
    const sender = track?.sender;
    if (!track || !sender) return;
    try {
        // Apply the new capture constraints first, so the underlying capture
        // adjusts before we change the encoding bitrate/framerate caps. Use
        // ideal so a smaller capture doesn't throw OverconstrainedError.
        const { width, height, frameRate } = screenShareCaptureResolution(
            resKey,
            fps,
        );
        await track.mediaStreamTrack.applyConstraints({
            width: { ideal: width },
            height: { ideal: height },
            frameRate: { ideal: frameRate },
        });

        const params = sender.getParameters();
        if (
            applyScreenShareEncoding(
                params,
                screenShareEncodingFor(resKey, fps),
            )
        ) {
            // Match setScreenShareEnabled: screen content prefers a sharp
            // resolution over a steady framerate under load.
            params.degradationPreference = "maintain-resolution";
            await sender.setParameters(params);
        }
    } catch (err) {
        console.error("Screen share quality change failed:", err);
        if (activeVoice === call) {
            notifyVoiceNotice(t("client.couldnTChangeScreenShareQuality"));
        }
    }
}

export function setScreenShareQuality(
    resKey: string,
    fps: number,
): Promise<void> {
    screenShareQualityChain = screenShareQualityChain.then(() =>
        applyScreenShareQualityNow(resKey, fps),
    );
    return screenShareQualityChain;
}

/** Start/stop publishing the camera, using the configured input device. */
export async function setCameraEnabled(on: boolean): Promise<boolean> {
    const call = activeVoice;
    if (!call) return false;
    try {
        await call.lkRoom.localParticipant.setCameraEnabled(on, {
            deviceId: settingsState.videoInputDeviceId ?? undefined,
        });
        if (activeVoice === call) desiredCameraOn = on;
        return on;
    } catch (err) {
        console.error("Camera enable failed:", err);
        // Same as screen share: no toast once the call has ended.
        if (activeVoice !== call) return false;
        notifyVoiceNotice(t("client.couldNotStartTheCameraCheck"));
        return false;
    }
}

/** Switch the live call's camera. Null (system default) takes effect on the
 *  next enable. No-op when not sharing camera. */
export async function setVideoInputDevice(
    deviceId: string | null,
): Promise<void> {
    const call = activeVoice;
    if (!call || !deviceId) return;
    await switchInputWithRecovery(
        call,
        "videoinput",
        deviceId,
        true,
        t("client.deviceNounCamera"),
    );
}

/** Live NS/EC/AGC change on the published mic track (no-op when not in a
 *  call — the next join reads the settings via audioCaptureDefaults). */
export async function setVoiceCaptureConstraints(c: {
    noiseSuppression: boolean;
    echoCancellation: boolean;
    autoGainControl: boolean;
}): Promise<void> {
    const call = activeVoice;
    if (!call) return;
    const track = call.lkRoom.localParticipant.getTrackPublication(
        call.lk.Track.Source.Microphone,
    )?.audioTrack;
    if (!track) return;
    // Pass the current device along so restartTrack doesn't switch to the
    // OS default. Prefer the live track's device id, else the saved selection.
    // It must be `exact`: Chromium treats a bare (ideal) deviceId as a hint
    // and re-acquired the default mic in live testing. If the exact device
    // is gone, fall back to an ideal hint rather than leaving the mic dead
    // (the restart has already stopped the old track by then).
    const deviceId =
        track.mediaStreamTrack.getSettings().deviceId ??
        settingsState.audioInputDeviceId ??
        undefined;
    try {
        await track.restartTrack({
            ...c,
            deviceId: deviceId ? { exact: deviceId } : undefined,
        });
    } catch (err) {
        console.error("Voice capture constraints change failed:", err);
        await track.restartTrack({ ...c, deviceId }).catch(() => {});
        if (activeVoice === call) {
            notifyVoiceNotice(t("client.couldnTApplyAudioProcessingChange"));
        }
    }
}

/** Live srcObject streams of the call's remote <audio> elements (feeds the
 *  settings tab's incoming-audio meter; re-read on voiceTick changes). */
export function getRemoteAudioStreams(): MediaStream[] {
    if (!activeVoice) return [];
    const streams: MediaStream[] = [];
    for (const el of activeVoice.audioEls)
        if (el.srcObject instanceof MediaStream) streams.push(el.srcObject);
    return streams;
}
