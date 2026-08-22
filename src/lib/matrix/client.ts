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
    ThreadEvent,
    MatrixEventEvent,
    Method,
    BeaconEvent,
    M_BEACON,
    M_BEACON_INFO,
    ContentHelpers,
    Filter,
    TimelineWindow,
} from "matrix-js-sdk";
import type {
    AuthDict,
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
    sfuJwtUrl,
    screenShareCaptureResolution,
} from "$lib/utils/voiceCall";
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
import { settingsState } from "$lib/stores/settings.svelte";
import { installMediaHealer } from "$lib/stores/mediaAuth.svelte";
import {
    OWNERSHIP_LOST_MESSAGE,
    captureOwnership,
    guardOwnership,
    nextGeneration,
    ownsRuntime,
    type ClientOwnership,
} from "$lib/utils/clientGeneration";
import {
    sanitizeCustomization,
    type ClientCustomization,
} from "$lib/utils/customization";
import { parseMarkdown } from "$lib/utils/markdown";
import { preloadEmojiPacks } from "$lib/utils/emojiPreload";
import { parseMxc, isSameOrigin } from "$lib/utils/mxcUri";
import {
    decryptAttachment,
    type EncryptedFileInfo,
} from "$lib/utils/decryptAttachment";
import { requestPersistentStorage } from "$lib/utils/persistentStorage";
import { resolveDisplayName } from "$lib/utils/displayName";
import { showErrorToast } from "$lib/stores/toasts.svelte";
import { classifyWellKnown } from "$lib/utils/wellKnown";
import { hasUnstableFeature } from "$lib/utils/serverCapabilities";
import { exceedsUploadLimit, FileTooLargeError } from "$lib/utils/uploadLimits";
import {
    supportsPasswordUia,
    type DeviceInfo,
} from "$lib/utils/deviceSessions";
import { receiptTypeForSetting } from "$lib/utils/readReceipts";
import { computeEditMentions, type Mentions } from "$lib/utils/editMentions";
import { buildReplyContent } from "$lib/utils/replyContent";
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
} from "$lib/utils/threadContent";
import {
    belongsToMainTimeline,
    summarizeThread,
    threadReplyRootId,
} from "$lib/utils/threadModel";
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
} from "$lib/utils/pollContent";
import {
    mediaItemFromEvent,
    mediaFilterDefinition,
    type RoomMediaItem,
} from "$lib/utils/roomMedia";
import { buildForwardContent } from "$lib/utils/forwardContent";
import {
    buildCallNotifyContent,
    shouldRingPeers,
    CALL_NOTIFY_EVENT_TYPE,
} from "$lib/utils/callNotify";
import { buildCallNotifyPushRule } from "$lib/utils/callPushRule";
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
    isRoomEncrypted,
} from "$lib/matrix/crypto";
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
import {
    coercePl,
    effectivePowerLevel,
    normalizePowerLevels,
    roomVersionHasImmutableCreators,
} from "$lib/utils/powerLevels";
import { buildRestrictedJoinRuleContent } from "$lib/utils/joinRules";
import type { CanonicalAliasContent } from "$lib/utils/roomAliases";
import { addToMDirect } from "$lib/utils/mDirect";
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
        "moe.crafty.matrix.active_session": ActiveSessionHeartbeat;
    }
}

let matrixClient: MatrixClient | null = null;
let matrixStore: IndexedDBStore | null = null;
// Monotonic id of the CURRENT occupant of the `matrixClient` slot, bumped on
// every install and every release. An operation or listener that captured the
// pair {client, generation} at entry can re-check it after an await and refuse
// to act for an account that no longer owns the runtime.
let clientGeneration = 0;

export function getClient(): MatrixClient | null {
    return matrixClient;
}

/** The live occupant of the slot — the read side of every ownership guard. */
function readOwner(): { client: MatrixClient | null; generation: number } {
    return { client: matrixClient, generation: clientGeneration };
}

/** Snapshot the owner for an operation that spans awaits. */
function captureClient(): ClientOwnership<MatrixClient> {
    if (!matrixClient) throw new Error("Not logged in");
    return captureOwnership(matrixClient, clientGeneration);
}

/** The captured client, or null once a successor has taken the slot. */
function ownedClient(
    owner: ClientOwnership<MatrixClient>,
): MatrixClient | null {
    return ownsRuntime(owner, matrixClient, clientGeneration)
        ? owner.client
        : null;
}

/** As `ownedClient`, for operations whose caller must learn they aborted. */
function ownedClientOrThrow(
    owner: ClientOwnership<MatrixClient>,
): MatrixClient {
    const client = ownedClient(owner);
    if (!client) throw new Error(OWNERSHIP_LOST_MESSAGE);
    return client;
}

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
    return `matrix-client:${encodeURIComponent(userId)}:${encodeURIComponent(deviceId)}:sync`;
}

async function createAuthenticatedClient(opts: {
    baseUrl: string;
    accessToken: string;
    userId: string;
    deviceId: string;
}): Promise<MatrixClient> {
    matrixClient?.stopClient();
    // The slot below only changes several awaits later, and stopClient() does
    // NOT abort the predecessor's in-flight requests — so retire its ownership
    // NOW. Otherwise a 401 arriving from the account we just stopped still
    // passes its listeners' guard and runs root session-expiry teardown
    // against the account that is signing in.
    clientGeneration = nextGeneration(clientGeneration);
    // Do NOT destroy the previous store here: with multiple signed-in
    // accounts the outgoing client usually belongs to an account that stays
    // signed in, and deleting its per-account sync cache (or racing that
    // async deletion against the add-account reload) corrupts or cold-boots
    // its next session. The deliberate privacy wipe on sign-out lives in
    // logout() via clearStores().
    matrixStore = null;
    // Same reasoning as the media limit below: the outgoing client's memoized
    // space-child lists must not be carried into the incoming account's session.
    spaceChildCache.clear();
    // Drop the previous server's cached media-config upload limit — this funnel
    // runs on every login, session restore, and account switch, so a switch to
    // a different homeserver must not keep the old server's `m.upload.size`.
    mediaUploadSizePromise = null;
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
    const commonOpts = {
        ...opts,
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
        try {
            await store.startup();
            matrixStore = store;
        } catch (err) {
            console.warn(
                "[matrix] IndexedDB store startup failed; falling back to memory store",
                err,
            );
            client = createClient(commonOpts);
        }
    }

    matrixClient = client;
    clientGeneration = nextGeneration(clientGeneration);

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

async function resolveHomeserver(input: string): Promise<string> {
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
        showErrorToast(
            "Server auto-discovery failed - using the address as typed",
        );
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
        throw new Error("Discovered homeserver failed validation");
    }
    return base;
}

export async function login(
    homeserverUrl: string,
    username: string,
    password: string,
): Promise<{
    userId: string;
    accessToken: string;
    deviceId: string;
    homeserverUrl: string;
}> {
    const resolvedBase = await resolveHomeserver(homeserverUrl);
    const tempClient = createClient({ baseUrl: resolvedBase });

    const response = await tempClient.login("m.login.password", {
        identifier: { type: "m.id.user", user: username },
        password: password,
        initial_device_display_name: "Zam",
    });

    const resolvedURL = tempClient.getHomeserverUrl();

    tempClient.stopClient();

    await createAuthenticatedClient({
        baseUrl: resolvedURL,
        accessToken: response.access_token!,
        userId: response.user_id,
        deviceId: response.device_id!,
    });

    return {
        userId: response.user_id,
        accessToken: response.access_token!,
        deviceId: response.device_id!,
        homeserverUrl: resolvedURL,
    };
}

export async function register(
    homeserverUrl: string,
    username: string,
    password: string,
    registrationToken?: string,
): Promise<{
    userId: string;
    accessToken: string;
    deviceId: string;
    homeserverUrl: string;
}> {
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
    const resolvedURL = tempClient.getHomeserverUrl();
    tempClient.stopClient();

    await createAuthenticatedClient({
        baseUrl: resolvedURL,
        accessToken: response.access_token!,
        userId: response.user_id,
        deviceId: response.device_id!,
    });

    return {
        userId: response.user_id,
        accessToken: response.access_token!,
        deviceId: response.device_id!,
        homeserverUrl: resolvedURL,
    };
}

export async function reconnect(
    homeserverUrl: string,
    userId: string,
    accessToken: string,
    deviceId: string,
): Promise<void> {
    await createAuthenticatedClient({
        baseUrl: homeserverUrl,
        accessToken,
        userId,
        deviceId,
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
): Promise<() => void> {
    const owner = captureClient();
    const client = owner.client;

    initialSyncComplete = false;

    const onSync = guardOwnership(owner, readOwner, (state: string) => {
        if (state === "PREPARED") {
            initialSyncComplete = true;
            seedStatelessRooms();
            // Heal any joined room the initial sync dropped, in place where
            // possible — a cache-wipe reload is the last resort, never for a
            // room a prior reload already failed to fix (the boot double-flash).
            void reconcileJoinedRoomsLive();
        }
        onStateChange(state);
    });
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
    if (onLoggedOut) client.on(HttpApiEvent.SessionLoggedOut, onLoggedOut);

    let disposed = false;
    /** Idempotent: safe to call from a teardown path and again on re-sync. */
    const dispose = (): void => {
        if (disposed) return;
        disposed = true;
        client.off(ClientEvent.Sync, onSync as never);
        client.off("Room.myMembership" as never, onMyMembership as never);
        client.off(ClientEvent.Room as never, onRoom as never);
        if (onLoggedOut) client.off(HttpApiEvent.SessionLoggedOut, onLoggedOut);
    };

    try {
        await client.startClient({
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
    if (!matrixClient) throw new Error("Not logged in");
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
    if (!matrixClient) throw new Error("Not logged in");
    const userId = matrixClient.getUserId();
    if (!userId) throw new Error("Not logged in");
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
            matrixClient = null;
            matrixStore = null;
            clientGeneration = nextGeneration(clientGeneration);
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
    matrixClient = null;
    // Invalidate every outstanding ownership token: a stopped client's late
    // callback must not run root teardown against its successor (LIFE-02).
    clientGeneration = nextGeneration(clientGeneration);
    matrixStore?.destroy().catch(() => {});
    matrixStore = null;
    // Room ids are globally unique so a surviving entry could not be *wrong*,
    // but it must not outlive the session it was built for.
    spaceChildCache.clear();
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
    return (matrixClient?.getRooms() ?? []).filter(
        (r) => r.getMyMembership() === "join" && !pendingLeaves.has(r.roomId),
    );
}

export function getRoom(roomId: string): Room | null {
    return matrixClient?.getRoom(roomId) ?? null;
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
    const space = matrixClient?.getRoom(spaceId);
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
    for (const space of getSpaces()) {
        if (space.getMyMembership() !== "join") continue;
        if (getSpaceChildIds(space.roomId).includes(roomId)) {
            return space.roomId;
        }
    }
    return null;
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
        .map((id) => matrixClient?.getRoom(id))
        .filter(
            (r): r is Room =>
                !!r &&
                !r.isSpaceRoom() &&
                r.getMyMembership() === "join" &&
                !pendingLeaves.has(r.roomId),
        );
}

export function getDirectRoomIds(): Set<string> {
    const directEvent = matrixClient?.getAccountData(EventType.Direct);
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
    const all = matrixClient?.getRooms() ?? [];
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
    return (matrixClient?.getRoom(roomId)?.tags ?? {}) as RoomTagMap;
}

export async function setRoomTag(
    roomId: string,
    tag: string,
    order?: number | string,
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
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
    if (!matrixClient) throw new Error("Not logged in");
    await matrixClient.deleteRoomTag(roomId, tag);
}

/** Toggle m.favourite / m.lowpriority on a room. The two are mutually
 *  exclusive; the UI refreshes when the tag change comes back over sync. */
export async function toggleRoomTag(
    roomId: string,
    toggle: "favourite" | "lowPriority",
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
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
        !isPollStartEventType(e.getType())
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

export function getTimelineMessages(room: Room): MatrixEvent[] {
    const timeline = room
        .getLiveTimeline()
        .getEvents()
        .filter(isRenderableTimelineEvent);
    // Include pending (local echo) events. Keep NOT_SENT echoes so the user
    // can see a failed send and retry/delete it (see resendMessage /
    // deleteFailedMessage); only drop ones already cancelled.
    const pending = room
        .getPendingEvents()
        .filter(
            (e) =>
                isRenderableTimelineEvent(e) &&
                e.status !== EventStatus.CANCELLED,
        );
    return [...timeline, ...pending];
}

export function getLatestTimelineEvent(room: Room): MatrixEvent {
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
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
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
    // 2-arg form only (⚑2 — the threadId overload mangles $-prefixed strings).
    await matrixClient.sendMessage(roomId, content as never);
}

/**
 * Resolve the m.thread relation params for decorating a NON-text send (file,
 * sticker, emote) so it lands in the thread rooted at `rootEventId`. Mirrors
 * sendThreadReply's latest-event resolution (is_falling_back reply pointer).
 */
function threadRelationParams(
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
    // it falls back to a client-side m.thread-relation scan. try/catch degrades
    // to sync-known threads if the server rejects the fallback filter.
    if (!matrixClient?.supportsThreads()) return;
    try {
        await room.createThreadsTimelineSets();
        await room.fetchRoomThreads();
    } catch (err) {
        console.error("Failed to load room threads:", err);
    }
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

async function captureVideoThumbnail(file: File): Promise<{
    blob: Blob;
    w: number;
    h: number;
    thumbW: number;
    thumbH: number;
} | null> {
    return new Promise((resolve) => {
        const objectUrl = URL.createObjectURL(file);
        const video = document.createElement("video");
        video.preload = "metadata";
        video.muted = true;
        video.playsInline = true;
        const cleanup = () => URL.revokeObjectURL(objectUrl);
        video.onerror = () => {
            cleanup();
            resolve(null);
        };
        video.onloadedmetadata = () => {
            // Seek to 10% into the video (or 1s, whichever is smaller) to get past black frames
            video.currentTime = Math.min(1, video.duration * 0.1);
        };
        video.onseeked = () => {
            const w = video.videoWidth;
            const h = video.videoHeight;
            const MAX = 800;
            const scale = Math.min(1, MAX / Math.max(w, h));
            const thumbW = Math.round(w * scale);
            const thumbH = Math.round(h * scale);
            const canvas = document.createElement("canvas");
            canvas.width = thumbW;
            canvas.height = thumbH;
            canvas.getContext("2d")!.drawImage(video, 0, 0, thumbW, thumbH);
            canvas.toBlob(
                (blob) => {
                    cleanup();
                    if (blob) resolve({ blob, w, h, thumbW, thumbH });
                    else resolve(null);
                },
                "image/jpeg",
                0.85,
            );
        };
        video.src = objectUrl;
    });
}

export interface MediaCaption {
    /** Plain-text caption (becomes the event body, per MSC2530). */
    body: string;
    /** Optional HTML caption (org.matrix.custom.html formatted_body). */
    formattedBody?: string;
    mentions?: { user_ids?: string[]; room?: boolean };
}

// Cached `m.upload.size` from the server's media config, fetched once per
// session. `undefined` = not yet fetched; a stored promise dedupes concurrent
// callers; a null resolution means the server didn't advertise a limit (or the
// request failed) — in which case we skip the precheck rather than block uploads.
let mediaUploadSizePromise: Promise<number | null> | null = null;

async function getMediaUploadSizeLimit(): Promise<number | null> {
    if (!matrixClient) return null;
    if (!mediaUploadSizePromise) {
        const client = matrixClient;
        mediaUploadSizePromise = (async () => {
            try {
                const config = await client.getMediaConfig(true);
                const size = config["m.upload.size"];
                return typeof size === "number" ? size : null;
            } catch {
                mediaUploadSizePromise = null; // allow a retry next upload
                return null;
            }
        })();
    }
    return mediaUploadSizePromise;
}

export async function sendFile(
    roomId: string,
    file: File,
    caption?: MediaCaption,
    thread?: { rootEventId: string },
): Promise<void> {
    const owner = captureClient();
    // Precheck the size against the server's advertised upload limit so an
    // over-limit file fails fast instead of a 413 mid-upload. This REJECTS
    // rather than resolving: resolving read to the composer as "sent" and made
    // the queued file disappear unsent (audit MEDIA-02). The caller owns the
    // toast — FileTooLargeError's message is already user-facing copy.
    const maxUploadSize = await getMediaUploadSizeLimit();
    // A successor account may own the slot now: its server's limit is not this
    // file's limit, and the rejection below would surface in its UI.
    ownedClientOrThrow(owner);
    if (exceedsUploadLimit(file.size, maxUploadSize)) {
        throw new FileTooLargeError(
            file.name,
            file.size,
            maxUploadSize as number,
        );
    }
    const { content_uri } = await ownedClientOrThrow(owner).uploadContent(
        file,
        { name: file.name },
    );
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    const isAudio = file.type.startsWith("audio/");
    const msgtype = isImage
        ? "m.image"
        : isVideo
          ? "m.video"
          : isAudio
            ? "m.audio"
            : "m.file";

    const info: Record<string, unknown> = {
        mimetype: file.type,
        size: file.size,
    };

    if (isVideo) {
        const thumb = await captureVideoThumbnail(file);
        if (thumb) {
            const thumbFile = new File([thumb.blob], "thumbnail.jpg", {
                type: "image/jpeg",
            });
            const { content_uri: thumb_uri } = await ownedClientOrThrow(
                owner,
            ).uploadContent(thumbFile, { name: "thumbnail.jpg" });
            info.w = thumb.w;
            info.h = thumb.h;
            info.thumbnail_url = thumb_uri;
            info.thumbnail_info = {
                mimetype: "image/jpeg",
                w: thumb.thumbW,
                h: thumb.thumbH,
                size: thumb.blob.size,
            };
        }
    }

    // MSC2530 media captions: when a caption is supplied, `filename` carries the
    // original file name and `body` (plus optional formatted_body) carries the
    // caption text — rendered as a message alongside the media. Without a
    // caption, `body` is just the file name and no `filename` is sent.
    const content: Record<string, unknown> = {
        msgtype,
        body: caption ? caption.body : file.name,
        url: content_uri,
        info,
        // Always present (spec recommendation): an m.mentions key — even empty —
        // disables the legacy body-scan push rules on the receiving server.
        "m.mentions": caption?.mentions ?? {},
    };
    if (caption) {
        content.filename = file.name;
        if (caption.formattedBody) {
            content.format = "org.matrix.custom.html";
            content.formatted_body = caption.formattedBody;
        }
    }

    const finalContent = thread
        ? withThreadRelation(
              content,
              threadRelationParams(roomId, thread.rootEventId),
          )
        : content;
    await ownedClientOrThrow(owner).sendMessage(roomId, finalContent as never);
}

/**
 * Send a recorded voice message as `m.audio` with the MSC3245 voice marker and
 * MSC1767 audio (duration + waveform) so Element renders it as a voice note.
 * Mirrors sendFile's upload-then-send shape.
 */
export async function sendVoiceMessage(
    roomId: string,
    blob: Blob,
    durationMs: number,
    waveform: number[],
): Promise<void> {
    const owner = captureClient();
    const ext = blob.type.includes("ogg")
        ? "ogg"
        : blob.type.includes("mp4")
          ? "mp4"
          : "webm";
    const file = new File([blob], `voice-message.${ext}`, {
        type: blob.type || "audio/webm",
    });
    const { content_uri } = await ownedClientOrThrow(owner).uploadContent(
        file,
        { name: file.name },
    );
    const duration = Math.round(durationMs);
    await ownedClientOrThrow(owner).sendMessage(roomId, {
        msgtype: "m.audio",
        body: "Voice message",
        url: content_uri,
        info: { mimetype: file.type, size: blob.size, duration },
        "org.matrix.msc3245.voice": {},
        "org.matrix.msc1767.audio": { duration, waveform },
        "org.matrix.msc1767.text": "Voice message",
    } as never);
}

/** Share a static location as an m.location event (MSC3488). */
export async function sendLocation(
    roomId: string,
    loc: { lat: number; lon: number; description?: string },
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    await matrixClient.sendMessage(roomId, buildLocationContent(loc) as never);
}

// ── Live location (beacons, MSC3672) ─────────────────────────────────────────

/** Start a live-location beacon (m.beacon_info state event, live:true). One per user per room. */
export async function startLiveBeacon(
    roomId: string,
    timeoutMs: number,
    description?: string,
): Promise<{ beaconInfoEventId: string }> {
    if (!matrixClient) throw new Error("Not logged in");
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
    if (!matrixClient) throw new Error("Not logged in");
    const room = matrixClient.getRoom(roomId);
    const me = matrixClient.getUserId();
    if (!room || !me) return;
    const own = Array.from(room.currentState.beacons.values()).find(
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
    if (!matrixClient) throw new Error("Not logged in");
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
    return Array.from(room.currentState.beacons.values());
}

/** PL gate: may the current user send a beacon_info state event here? */
export function canShareLiveBeacon(room: Room): boolean {
    const me = matrixClient?.getUserId();
    if (!me) return false;
    return room.currentState.maySendStateEvent(M_BEACON_INFO.name, me);
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
        for (const beacon of room.currentState.beacons.values()) {
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
        for (const b of room.currentState.beacons.values()) {
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
    if (!matrixClient) throw new Error("Not logged in");
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

export async function sendFormattedMessage(
    roomId: string,
    body: string,
    formattedBody: string,
    mentions?: { user_ids?: string[]; room?: boolean },
): Promise<string> {
    if (!matrixClient) throw new Error("Not logged in");
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
    if (!matrixClient) throw new Error("Not logged in");
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
    if (!matrixClient) throw new Error("Not logged in");
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
    if (!matrixClient) throw new Error("Not logged in");
    const eventType = event.getType();
    if (eventType !== "m.room.message" && eventType !== "m.sticker") {
        throw new Error("This event type cannot be forwarded");
    }
    await matrixClient.sendEvent(
        roomId,
        eventType as never,
        buildForwardContent(event.getContent()) as never,
    );
}

export function mxcToHttp(
    mxcUrl: string | null | undefined,
    width = 0,
    height: number | undefined = undefined,
    method = "crop",
): string | null {
    if (!matrixClient) return null;
    // Validate against the spec grammar, then URL-encode each segment so a
    // crafted server/media id can't smuggle path traversal or a query/fragment
    // into the media URL. parseMxc rejects non-mxc input (returns null).
    const parsed = parseMxc(mxcUrl ?? "");
    if (!parsed) return null;
    const serverName = encodeURIComponent(parsed.serverName);
    const mediaId = encodeURIComponent(parsed.mediaId);
    const baseUrl = matrixClient.getHomeserverUrl();
    if (width > 0) {
        height = height ?? width;
        return `${baseUrl}/_matrix/client/v1/media/thumbnail/${serverName}/${mediaId}?width=${width}&height=${height}&method=${method}`;
    }
    return `${baseUrl}/_matrix/client/v1/media/download/${serverName}/${mediaId}`;
}

/**
 * Base URL of the homeserver this session is on, or null when signed out.
 * Exposed so the UI can tell homeserver-proxied media (safe to load: the
 * server already knows about the message) apart from third-party media.
 */
export function getHomeserverBaseUrl(): string | null {
    return matrixClient?.getHomeserverUrl() ?? null;
}

/** Fetch an attachment from the homeserver with auth and return an object URL for use in <video/audio src> and file downloads. */
export async function fetchAttachmentBlob(httpUrl: string): Promise<string> {
    if (!matrixClient) throw new Error("Not logged in");
    const baseUrl = matrixClient.getHomeserverUrl();
    // The access token must NEVER leave the homeserver. Refuse to attach it (or
    // even fetch) any URL that isn't on our homeserver — mirrors getContentType's
    // guard. Compare parsed ORIGIN, not a string prefix: a prefix test would
    // pass `https://host@evil.com/…` (userinfo) or `https://host.evil.com/…`
    // (host-suffix) and leak the token to a foreign host. Callers that need
    // foreign media must fetch it themselves, unauthed.
    if (!isSameOrigin(httpUrl, baseUrl)) {
        throw new Error("Refusing to fetch a non-homeserver URL with auth");
    }
    const token = matrixClient.getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const resp = await fetch(httpUrl, { headers });
    if (!resp.ok) throw new Error(`Failed to fetch attachment: ${resp.status}`);
    const blob = await resp.blob();
    return URL.createObjectURL(blob);
}

/**
 * Fetch an ENCRYPTED attachment (`content.file`) from the homeserver with auth,
 * decrypt it (AES-CTR, integrity-checked in decryptAttachment) and return an
 * object URL. Mirrors fetchAttachmentBlob's same-origin token guard. The
 * plaintext mimetype comes from the event's `content.info.mimetype` — the
 * EncryptedFile itself carries none. The caller owns the object URL and must
 * revoke it. Throws (never returns a URL) if the integrity hash fails.
 */
export async function fetchDecryptedAttachmentBlob(
    file: EncryptedFileInfo & { url: string },
    mimetype?: string,
): Promise<string> {
    if (!matrixClient) throw new Error("Not logged in");
    const httpUrl = mxcToHttp(file.url);
    if (!httpUrl) throw new Error("Encrypted attachment has an invalid URL");
    const baseUrl = matrixClient.getHomeserverUrl();
    if (!isSameOrigin(httpUrl, baseUrl)) {
        throw new Error("Refusing to fetch a non-homeserver URL with auth");
    }
    const token = matrixClient.getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const resp = await fetch(httpUrl, { headers });
    if (!resp.ok) {
        throw new Error(`Failed to fetch encrypted attachment: ${resp.status}`);
    }
    const ciphertext = await resp.arrayBuffer();
    const plaintext = await decryptAttachment(ciphertext, file);
    const blob = new Blob([plaintext], {
        type: mimetype || "application/octet-stream",
    });
    return URL.createObjectURL(blob);
}

/** HEAD-request a URL (with auth for homeserver URLs) and return its Content-Type. */
export async function getContentType(url: string): Promise<string | null> {
    if (!matrixClient) return null;
    const accessToken = matrixClient.getAccessToken();
    const baseUrl = matrixClient.getHomeserverUrl();
    const headers: Record<string, string> = {};
    // Attach auth only for same-ORIGIN homeserver URLs. A string prefix check
    // is bypassable (userinfo / host-suffix) and would leak the token; see
    // isSameOrigin. Foreign URLs are HEAD-requested without credentials.
    if (accessToken && isSameOrigin(url, baseUrl)) {
        headers.Authorization = `Bearer ${accessToken}`;
    }
    try {
        const res = await fetch(url, { method: "HEAD", headers });
        return res.ok ? res.headers.get("content-type") : null;
    } catch {
        return null;
    }
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
    });
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

/** Send updated auth credentials to an already-registered service worker. */
export function updateServiceWorkerAuth(): void {
    if (!matrixClient) return;
    const token = matrixClient.getAccessToken();
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
        const imageUrl = ogImage?.startsWith("mxc://")
            ? (mxcToHttp(ogImage) ?? undefined)
            : ogImage;
        const rawVideo = (data["og:video:secure_url"] ??
            data["og:video:url"] ??
            data["og:video"]) as string | undefined;
        const videoUrl = rawVideo?.startsWith("mxc://")
            ? (mxcToHttp(rawVideo) ?? undefined)
            : rawVideo;
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
        return { status: "error", error: new Error("Not connected") };
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

/** Fetch the logged-in user's profile fresh from the server. */
export async function fetchOwnProfile(): Promise<{
    displayName: string | null;
    avatarMxc: string | null;
}> {
    const userId = matrixClient?.getUserId();
    if (!matrixClient || !userId) {
        return { displayName: null, avatarMxc: null };
    }
    const profile = await matrixClient.getProfileInfo(userId);
    return {
        displayName: profile.displayname ?? null,
        avatarMxc: profile.avatar_url ?? null,
    };
}

export async function setOwnDisplayName(name: string): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    await matrixClient.setDisplayName(name);
}

/** Set (mxc URI) or clear (empty string) the logged-in user's avatar. */
export async function setOwnAvatarMxc(mxc: string): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    await matrixClient.setAvatarUrl(mxc);
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
    if (!matrixClient) throw new Error("Not logged in");
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
        | { default?: string; available?: Record<string, unknown> }
        | undefined;
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
    if (!matrixClient) throw new Error("Not logged in");
    const { devices } = await matrixClient.getDevices();
    return devices.map((d) => ({
        deviceId: d.device_id,
        displayName: d.display_name,
        lastSeenIp: d.last_seen_ip,
        lastSeenTs: d.last_seen_ts,
        lastSeenUserAgent: d.last_seen_user_agent,
    }));
}

export async function renameDevice(
    deviceId: string,
    name: string,
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
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
    if (!matrixClient) throw new Error("Not logged in");
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
            throw new Error(
                "This server does not allow signing out sessions with a password - use its account page instead.",
            );
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
                throw new Error("Incorrect password");
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
    if (!matrixClient) throw new Error("Not logged in");
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
            throw new Error(
                "This server does not allow confirming this action with a password - use its account page instead.",
            );
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
                throw new Error("Incorrect password");
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
    if (!matrixClient) throw new Error("Not logged in");
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
    if (!matrixClient) throw new Error("Not logged in");
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
    if (!matrixClient) throw new Error("Not logged in");
    const { threepids } = await matrixClient.getThreePids();
    return threepids.map((t) => ({ medium: t.medium, address: t.address }));
}

export function getRoomDisplayName(room: Room): string {
    return room.name || room.roomId;
}

export function getMemberName(room: Room, userId: string): string {
    return resolveDisplayName(
        { userId, displayName: room.getMember(userId)?.name },
        { preferId: settingsState.showMatrixIds },
    );
}

/** Like getMemberName but for a RoomMember already in hand (member lists,
 *  profile card). Honors the Show Matrix IDs setting. */
export function memberDisplayName(member: RoomMember): string {
    return resolveDisplayName(
        { userId: member.userId, displayName: member.name },
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

export function getRoomAvatar(room: Room): string | null {
    const avatarEvent = room
        .getLiveTimeline()
        .getState(EventTimeline.FORWARDS)
        ?.getStateEvents("m.room.avatar", "");
    const mxc = avatarEvent?.getContent()?.url;
    return mxcToHttp(mxc);
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
        label: "Direct messages",
        description: "Messages in direct message rooms",
        conditions: [
            { kind: "room_member_count", is: "2" },
            { kind: "event_match", key: "type", pattern: "m.room.message" },
        ],
        defaultActions: MESSAGE_DEFAULT_ACTIONS,
    },
    {
        ruleId: RuleId.Message,
        kind: PushRuleKind.Underride,
        label: "Rooms",
        description: "Messages in all other rooms",
        conditions: [
            { kind: "event_match", key: "type", pattern: "m.room.message" },
        ],
        defaultActions: MESSAGE_DEFAULT_ACTIONS,
    },
    {
        ruleId: RuleId.IsUserMention,
        kind: PushRuleKind.Override,
        label: "Full Matrix ID mentions",
        description: "Messages using your full @user:homeserver ID",
        conditions: [{ kind: "is_user_mention" }],
        defaultActions: MENTION_DEFAULT_ACTIONS,
    },
    {
        ruleId: RuleId.ContainsDisplayName,
        kind: PushRuleKind.Override,
        label: "Display name mentions",
        description: "Messages containing your display name",
        conditions: [{ kind: "contains_display_name" }],
        defaultActions: MENTION_DEFAULT_ACTIONS,
    },
    {
        ruleId: RuleId.ContainsUserName,
        kind: PushRuleKind.ContentSpecific,
        label: "Username mentions",
        description: "Messages containing your username (without server)",
        pattern: "USERNAME_LOCALPART",
        defaultActions: MENTION_DEFAULT_ACTIONS,
    },
    {
        // Modern intentional-mentions rule; older servers only ship the legacy
        // .m.rule.roomnotif, so it is kept as an ordered fallback id.
        ruleId: RuleId.IsRoomMention,
        fallbackRuleIds: [RuleId.AtRoomNotification],
        kind: PushRuleKind.Override,
        label: "@room mentions",
        description: "Messages using @room to notify everyone",
        conditions: [
            { kind: "event_match", key: "content.body", pattern: "@room" },
        ],
        defaultActions: MENTION_DEFAULT_ACTIONS,
    },
    {
        ruleId: RuleId.InviteToSelf,
        kind: PushRuleKind.Override,
        label: "Invitations",
        description: "When you are invited to a room",
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
        | Record<string, any[]>
        | undefined;
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

/** Register (idempotent, best-effort) a client push rule that rings on an
 *  MSC4075 m.call.notify, so a device whose app is closed pushes an incoming
 *  CALL notification. Never throws into startup: on continuwuity this is
 *  redundant (it pushes m.call.notify by default), and on servers that don't,
 *  a failure just means no closed-device ring — not a broken session. */
export async function ensureCallNotifyPushRule(): Promise<void> {
    if (!matrixClient) return;
    const r = buildCallNotifyPushRule();
    try {
        await matrixClient.addPushRule(
            "global",
            r.kind as never,
            r.ruleId,
            r.body as never,
        );
        await matrixClient.setPushRuleEnabled(
            "global",
            r.kind as never,
            r.ruleId,
            true,
        );
    } catch {
        // Already present or a transient failure — the rule is best-effort.
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
                    room ? getRoomDisplayName(room) : "this room",
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
        throw new Error("Keyword cannot start with '.'");
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
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
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
        msgtype: "m.text",
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
            msgtype: "m.text",
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

/**
 * Fires after a state-less stub room has been seeded and backfilled — the
 * live timeline changed without any SDK sync event, so timeline views must
 * re-read it (room lists go through onRoomUpdate, which also fires).
 */
export function onRoomHealed(callback: (roomId: string) => void): () => void {
    roomHealedSubscribers.add(callback);
    return () => roomHealedSubscribers.delete(callback);
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
    if (
        shouldPrimePaginationToken({
            hasBackwardToken: !!timeline.getPaginationToken(Direction.Backward),
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
    if (client) await client.scrollback(room, BACKFILL_BATCH);
    return room.oldState.paginationToken !== null;
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
            .then((raw) => matrixClient!.getEventMapper()(raw))
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
        if (
            room
                .getLiveTimeline()
                .getEvents()
                .some((e) => e.getId() === eventId)
        )
            return true;
        await matrixClient.scrollback(room, 50);
        // All-duplicate batches happen after gappy-sync timeline resets and
        // must not abort the walk — only a null token means no more history.
        if (room.oldState.paginationToken === null) break;
    }
    return room
        .getLiveTimeline()
        .getEvents()
        .some((e) => e.getId() === eventId);
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
    const timelineSet = room.getUnfilteredTimelineSet();
    const window = new TimelineWindow(matrixClient, timelineSet);
    try {
        await window.load(eventId, windowSize);
    } catch {
        return null;
    }
    // load() resolves even when the event's timeline could not be fetched; an
    // empty window means we have nothing to show, so treat it as unavailable.
    if (window.getEvents().length === 0) return null;
    return window;
}

/** The renderable message events currently held by a context window, filtered
 *  identically to the live timeline so the jump view matches normal rendering. */
export function getContextWindowEvents(window: TimelineWindow): MatrixEvent[] {
    return window.getEvents().filter(isRenderableTimelineEvent);
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
 *  result for forwards means the window has reached the live timeline's newest
 *  event — the caller can then hand back to the live timeline. */
export function contextWindowCanPaginate(
    window: TimelineWindow,
    forwards: boolean,
): boolean {
    const dir = forwards ? EventTimeline.FORWARDS : EventTimeline.BACKWARDS;
    return window.canPaginate(dir);
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

/** One page of a room's media, newest first. `nextToken` is null at the end. */
export interface RoomMediaPage {
    items: RoomMediaItem[];
    nextToken: string | null;
    /** Whether the source room is encrypted. Surfaced so the UI can say why a
     *  visibly media-full room lists nothing (E2EE attachments are
     *  `content.file`, which the mapper cannot turn into a listable item) and
     *  can stop paging instead of decrypting hundreds of events for nothing. */
    encrypted: boolean;
}

/**
 * Fetch one backwards page of a room's image/video/file/audio attachments.
 *
 * Paginated on purpose — a room's whole history is never loaded. In an
 * encrypted room the page arrives as m.room.encrypted and has to be decrypted
 * here before the pure mapper can see a msgtype, which is also why the server
 * filter differs (see mediaFilterDefinition).
 */
export async function fetchRoomMediaPage(
    roomId: string,
    fromToken: string | null,
    limit = 40,
): Promise<RoomMediaPage> {
    if (!matrixClient) throw new Error("Not logged in");
    const encrypted = isRoomEncrypted(matrixClient.getRoom(roomId));

    const filter = new Filter(matrixClient.getUserId());
    filter.setDefinition(mediaFilterDefinition(encrypted, limit));

    const res = await matrixClient.createMessagesRequest(
        roomId,
        fromToken,
        limit,
        Direction.Backward,
        filter,
    );

    const events = (res.chunk ?? []).map((raw) => new MatrixEvent(raw));

    // Decrypt the whole page at once rather than 40 serial awaits. A missing
    // key does NOT reject: the SDK's decryption loop swallows the error and
    // marks the event as a decryption failure, so it resolves and the event
    // surfaces as m.bad.encrypted, which the mapper rejects anyway. The catch
    // is belt-and-braces for an unexpected throw.
    await Promise.all(
        events
            .filter((e) => e.getType() === "m.room.encrypted")
            .map((e) => matrixClient!.decryptEventIfNeeded(e).catch(() => {})),
    );

    const items: RoomMediaItem[] = [];
    for (const event of events) {
        const item = mediaItemFromEvent({
            eventId: event.getId(),
            sender: event.getSender(),
            ts: event.getTs(),
            type: event.getType(),
            content: event.getContent() as Record<string, unknown>,
        });
        if (item) items.push(item);
    }

    // End of history is the token, not the chunk: conduit-derived servers
    // (continuwuity/tuwunel) filter a fixed PDU window after the fact, so an
    // empty chunk mid-history is normal. A token that does not advance means
    // the server has nothing further to give.
    const end = res.end ?? null;
    const nextToken = end !== null && end !== fromToken ? end : null;
    return { items, nextToken, encrypted };
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
        }));
}

export async function sendTyping(
    roomId: string,
    isTyping: boolean,
    timeout: number = 25_000,
): Promise<void> {
    if (!matrixClient) return;
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

    return rooms.map((r) => {
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
    const layout = matrixClient
        .getAccountData(SPACE_LAYOUT_KEY)
        ?.getContent() as SpaceLayout | undefined;
    if (layout?.order?.length) return layout;
    // Migrate from old space_order key
    const oldOrder =
        (matrixClient.getAccountData(SPACE_ORDER_KEY)?.getContent()
            ?.order as string[]) ?? [];
    return { order: oldOrder, folders: {} };
}

export async function setSpaceLayout(layout: SpaceLayout): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
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
    if (!matrixClient) throw new Error("Not logged in");
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
    if (!matrixClient) throw new Error("Not logged in");
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
    if (!matrixClient) throw new Error("Not logged in");
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
    if (!matrixClient) throw new Error("Not logged in");
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
    if (!matrixClient) throw new Error("Not logged in");
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
const CALL_POWER_LEVEL_EVENTS = {
    "org.matrix.msc3401.call.member": 0,
    "m.call.member": 0,
    "m.rtc.member": 0,
};

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
    if (!matrixClient) throw new Error("Not logged in");
    const cur = matrixClient.getAccountData(EventType.Direct)?.getContent() as
        | Record<string, string[]>
        | undefined;
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
    if (!matrixClient) throw new Error("Not logged in");
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
    if (!matrixClient) throw new Error("Not logged in");
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
    if (!matrixClient) throw new Error("Not logged in");
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
    if (!matrixClient) throw new Error("Not logged in");
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
    if (!key) throw new Error("Not logged in");
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
    if (!matrixClient) throw new Error("Not logged in");
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
    if (!matrixClient) throw new Error("Not logged in");
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
    if (!matrixClient) throw new Error("Not logged in");
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
    if (!matrixClient) throw new Error("Not logged in");
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
    if (!matrixClient) throw new Error("Not logged in");
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
                | Record<string, string[]>
                | undefined) ?? {};
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
    if (!matrixClient) throw new Error("Not logged in");
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
    if (!matrixClient) throw new Error("Not logged in");
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
    if (!matrixClient) throw new Error("Not logged in");
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
    if (!matrixClient) throw new Error("Not logged in");
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
    if (!matrixClient) throw new Error("Not logged in");
    await matrixClient.redactEvent(roomId, reactionEventId);
}

export async function deleteMessage(
    roomId: string,
    eventId: string,
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    await matrixClient.redactEvent(roomId, eventId);
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
    if (!matrixClient) throw new Error("Not logged in");
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
                },
            ];
        });
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
    return arr
        .map((event) => {
            const content = event.getContent() as RoomEmoteContent;
            const stateKey = event.getStateKey() ?? "";
            const images = roomEmoteContentToPackImages(content);
            return {
                id: `${room.roomId}:${stateKey}`,
                roomId: room.roomId,
                stateKey,
                name:
                    content.pack?.display_name ||
                    stateKey ||
                    `${room.name || "Room"} Emotes`,
                sourceName: room.name || room.roomId,
                avatarUrl: getRoomAvatar(room) ?? undefined,
                images,
            };
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
                    `${room.name || "Room"} ${kind === "sticker" ? "Stickers" : "Emojis"}`,
                sourceName: room.name || room.roomId,
                avatarUrl: getRoomAvatar(room) ?? undefined,
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
    if (!normalized) return "Enter a shortcode.";
    if (!isValidEmojiShortcode(normalized)) {
        return "Use only letters, numbers, dots, underscores, pluses, and hyphens.";
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
    if (!matrixClient) throw new Error("Not logged in");
    const normalized = normalizeEmojiShortcode(shortcode);
    const nextUsage = normalizeUsage(usage);
    if (nextUsage.length === 0) throw new Error("Choose at least one usage.");
    const current = await fetchRoomEmoteContent(roomId, stateKey);
    const images = { ...(current.images ?? {}) };
    const existing = images[normalized];
    if (!existing?.url) throw new Error("Image not found.");
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
    if (!matrixClient) throw new Error("Not logged in");
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
): Promise<string> {
    if (!matrixClient) throw new Error("Not logged in");
    const normalized = normalizeEmojiShortcode(shortcode);
    const error = validateEmojiShortcode(normalized);
    const nextUsage = normalizeUsage(usage);
    if (error) throw new Error(error);
    if (nextUsage.length === 0) throw new Error("Choose at least one usage.");

    const current = await fetchRoomEmoteContent(roomId, stateKey);
    const images = { ...(current.images ?? {}) };
    const existing = images[normalized] ?? {};
    images[normalized] = {
        ...existing,
        url: mxcUrl,
        usage: nextUsage,
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
    if (!matrixClient) throw new Error("Not logged in");
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
    if (!matrixClient) throw new Error("Not logged in");
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
            | RoomEmoteContent
            | undefined) ?? {}
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
    if (!matrixClient) throw new Error("Not logged in");
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
): Promise<string> {
    if (!matrixClient) throw new Error("Not logged in");
    const normalized = normalizeEmojiShortcode(shortcode);
    const error = validateEmojiShortcode(normalized);
    const nextUsage = normalizeUsage(usage);
    if (error) throw new Error(error);
    if (nextUsage.length === 0) throw new Error("Choose at least one usage.");

    const current = await fetchUserEmoteContent();
    const images = { ...(current.images ?? {}) };
    const existing = images[normalized] ?? {};
    images[normalized] = {
        ...existing,
        url: mxcUrl,
        usage: nextUsage,
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
    if (!matrixClient) throw new Error("Not logged in");
    const normalized = normalizeEmojiShortcode(shortcode);
    const nextUsage = normalizeUsage(usage);
    if (nextUsage.length === 0) throw new Error("Choose at least one usage.");
    const current = await fetchUserEmoteContent();
    const images = { ...(current.images ?? {}) };
    const existing = images[normalized];
    if (!existing?.url) throw new Error("Image not found.");
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
    if (!matrixClient) throw new Error("Not logged in");
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
    if (!matrixClient) throw new Error("Not logged in");
    const normalized = normalizeEmojiShortcode(shortcode);
    const current = await fetchUserEmoteContent();
    const images = { ...(current.images ?? {}) };
    delete images[normalized];
    await matrixClient.setAccountData("im.ponies.user_emotes", {
        ...current,
        images,
    });
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
    if (!matrixClient) throw new Error("Not logged in");
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
    if (!matrixClient) throw new Error("Not logged in");
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
    if (!matrixClient) throw new Error("Not logged in");
    const state = room.getLiveTimeline().getState(EventTimeline.FORWARDS);
    const current =
        state?.getStateEvents("m.room.power_levels", "")?.getContent() ?? {};
    await (matrixClient as any).sendStateEvent(
        room.roomId,
        "m.room.power_levels",
        { ...current, ...updated },
    );
}

export async function setUserPowerLevel(
    room: Room,
    userId: string,
    level: number,
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    // A room-v12 (MSC4289) creator's power is immutable and NOT stored in the
    // users map — writing it there is a guaranteed server 403. Surface a clear
    // error instead of the raw federation rejection.
    if (
        isRoomCreator(room, userId) &&
        roomVersionHasImmutableCreators(room.getVersion())
    ) {
        throw new Error(
            "Room creators' power level cannot be set in v12 rooms",
        );
    }
    const pl = getRoomPowerLevels(room);
    await setRoomPowerLevels(room, { users: { ...pl.users, [userId]: level } });
}

export async function kickUser(
    roomId: string,
    userId: string,
    reason?: string,
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    await matrixClient.kick(roomId, userId, reason);
}

export async function banUser(
    roomId: string,
    userId: string,
    reason?: string,
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    await matrixClient.ban(roomId, userId, reason);
}

export async function unbanUser(roomId: string, userId: string): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
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
    if (!matrixClient) throw new Error("Not logged in");
    await matrixClient.setIgnoredUsers(userIds);
}

export function isUserIgnored(userId: string): boolean {
    return matrixClient?.isUserIgnored(userId) ?? false;
}

export async function setRoomName(roomId: string, name: string): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    await matrixClient.setRoomName(roomId, name);
}

export async function setRoomTopic(
    roomId: string,
    topic: string,
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    await matrixClient.setRoomTopic(roomId, topic);
}

export async function uploadContent(file: File): Promise<string> {
    if (!matrixClient) throw new Error("Not logged in");
    const { content_uri } = await matrixClient.uploadContent(file, {
        name: file.name,
    });
    return content_uri;
}

export async function setRoomAvatar(
    roomId: string,
    mxcUrl: string,
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
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
    if (!matrixClient) throw new Error("Not logged in");
    await (matrixClient as any).sendStateEvent(roomId, "m.room.join_rules", {
        join_rule: rule,
    });
}

/** Set a restricted join rule allowing members of the given parent spaces to join. */
export async function setRestrictedJoinRule(
    roomId: string,
    parentSpaceIds: string[],
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    const content = buildRestrictedJoinRuleContent(parentSpaceIds);
    if (content.allow.length === 0) {
        throw new Error("Restricted join requires at least one parent space");
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
    if (!matrixClient) throw new Error("Not logged in");
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
    if (!matrixClient) throw new Error("Not logged in");
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
    if (!matrixClient) throw new Error("Not logged in");
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
    if (!matrixClient) throw new Error("Not logged in");
    await (matrixClient as any).sendStateEvent(roomId, "m.room.guest_access", {
        guest_access: access,
    });
}

/** Local aliases this homeserver holds for the room. */
export async function getLocalRoomAliases(roomId: string): Promise<string[]> {
    if (!matrixClient) throw new Error("Not logged in");
    const res = await matrixClient.getLocalAliases(roomId);
    return res?.aliases ?? [];
}

/** Map a new `#alias:server` to the room in this server's directory. */
export async function createRoomAlias(
    alias: string,
    roomId: string,
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    await matrixClient.createAlias(alias, roomId);
}

/** Remove a local `#alias:server` from this server's directory. */
export async function deleteRoomAlias(alias: string): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
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
    if (!matrixClient) throw new Error("Not logged in");
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
    if (!matrixClient) throw new Error("Not logged in");
    // An m.space.child `order` must be ≤50 printable-ASCII chars (\x20–\x7E).
    // Generated fractional-index keys always satisfy this; a raw, user-typed
    // value may not — reject it rather than write a spec-invalid order the
    // homeserver would sort inconsistently. (An empty string is valid: it
    // clears the order below.)
    if (!isValidChildOrder(order)) {
        throw new Error(
            "Order must be at most 50 printable-ASCII characters (space to ~)",
        );
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

export async function removeSpaceChild(
    spaceId: string,
    childRoomId: string,
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
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
    if (!matrixClient) throw new Error("Not connected");
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
        (sender) => canEndPoll(sender, creator, powerLevels),
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
        canEnd: endTs === null && !!me && canEndPoll(me, creator, powerLevels),
    };
}

/** Cast or replace the current user's vote. An empty selection retracts it. */
export async function sendPollResponse(
    roomId: string,
    pollStartEvent: MatrixEvent,
    answerIds: string[],
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    const pollStartId = pollStartEvent.getId();
    if (!pollStartId) throw new Error("Poll has no event id");
    const poll = parsePollStart(pollStartEvent.getContent());
    if (!poll) throw new Error("Unsupported poll");
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
    if (!matrixClient) throw new Error("Not logged in");
    const { eventType, content } = buildPollStart(data);
    await matrixClient.sendEvent(roomId, eventType as never, content as never);
}

export async function sendPollEnd(
    roomId: string,
    pollStartEvent: MatrixEvent,
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    const pollStartId = pollStartEvent.getId();
    if (!pollStartId) throw new Error("Poll has no event id");
    // Defence in depth — the server also enforces via the redact PL.
    const room = matrixClient.getRoom(roomId);
    const me = matrixClient.getUserId() ?? "";
    if (room) {
        const creator = pollStartEvent.getSender() ?? "";
        if (!canEndPoll(me, creator, getRoomPowerLevels(room)))
            throw new Error("You can't close this poll");
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

/** Fires when a poll response or end event lands on a timeline, so visible
 *  polls can re-tally. */
export function onPollEvent(
    callback: (event: MatrixEvent, room: Room) => void,
): () => void {
    if (!matrixClient) return () => {};
    const handler = (event: MatrixEvent, room: Room | undefined) => {
        const type = event.getType();
        if (
            room &&
            (isPollResponseEventType(type) || isPollEndEventType(type))
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
    const timelineSet = room.getUnfilteredTimelineSet();
    return timelineSet.findEventById(eventId) ?? null;
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
    if (!matrixClient) throw new Error("Not logged in");

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
        statusMsg: user.presenceStatusMsg,
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
export async function setOwnPresence(presence: PresenceState): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    await matrixClient.setSyncPresence(SYNC_PRESENCE[presence]);
    await matrixClient.setPresence({ presence });
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
    return () => {
        matrixClient?.off(UserEvent.Presence, handler);
        matrixClient?.off(UserEvent.CurrentlyActive, handler);
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
export function getRoomCallMemberships(room: Room): VoiceMembership[] {
    if (!matrixClient) return [];
    const session = matrixClient.matrixRTC.getRoomSession(room);
    return session.memberships
        .filter((m) => !m.isExpired())
        .map((m) => ({
            userId: m.userId,
            deviceId: m.deviceId,
            joinedTs: m.createdTs(),
        }));
}

/** Send an MSC4075 m.call.notify so a callee whose app is closed gets pushed.
 *  Fire-and-forget from the call-start path; never block joining on it. The
 *  `as never` casts match the poll senders — the SDK's sendEvent overloads are
 *  narrow and the repo already casts custom event types this way. Do NOT use
 *  sendMessage, whose threadId overload mangles anything starting with `$`. */
export async function sendCallNotify(
    roomId: string,
    calleeUserIds: string[],
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    if (calleeUserIds.length === 0) return;
    const content = buildCallNotifyContent({ calleeUserIds });
    await matrixClient.sendEvent(
        roomId,
        CALL_NOTIFY_EVENT_TYPE as never,
        content as never,
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
    lkRoom: LivekitRoom;
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
// Monotonic token for joinVoiceCall: a newer join bumps it, and any older
// in-flight invocation bails out at its next staleness check instead of
// reconnecting a room it no longer owns.
let voiceJoinSeq = 0;
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
let voiceDeviceWatchStop: (() => void) | null = null;
let audioInputGoneNotified: ActiveVoiceCall | null = null;
let videoInputGoneNotified: ActiveVoiceCall | null = null;

const VOICE_DEVICE_NOTICE: Record<VoiceInputKind, string> = {
    audioinput: "Microphone disconnected - switched to the default device",
    videoinput: "Camera disconnected",
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
    if (voiceDeviceWatchStop || !navigator.mediaDevices?.addEventListener)
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
    voiceDeviceWatchStop = () =>
        navigator.mediaDevices.removeEventListener("devicechange", onChange);
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

/** Walk a LiveKit room's participants and collect subscribed video tracks as
 *  normalized inputs for buildVideoTiles(). */
function currentVideoInputs(
    lk: LivekitModule,
    lkRoom: LivekitRoom,
): VideoPublicationInput[] {
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
    for (const p of lkRoom.remoteParticipants.values()) addFrom(p, false);
    addFrom(lkRoom.localParticipant, true);
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
    await activeVoice.lkRoom.startAudio().catch(() => {});
}

export function getActiveVoiceRoomId(): string | null {
    return activeVoice?.roomId ?? null;
}

/** The homeserver's advertised MatrixRTC foci (MSC4143 .well-known). */
async function configuredRtcFoci(): Promise<unknown[]> {
    if (!matrixClient) return [];
    let wk = matrixClient.getClientWellKnown() as
        | Record<string, unknown>
        | undefined;
    if (!wk) {
        // startClient() doesn't pass clientWellKnownPollPeriod, so the SDK
        // never fetches .well-known on its own and getClientWellKnown()
        // stays undefined — trigger a one-off fetch on demand. The method
        // is protected in typings but callable at runtime, and it caches.
        await (
            matrixClient as unknown as {
                fetchClientWellKnown(): Promise<unknown>;
            }
        ).fetchClientWellKnown();
        wk = matrixClient.getClientWellKnown() as
            | Record<string, unknown>
            | undefined;
    }
    const foci = wk?.["org.matrix.msc4143.rtc_foci"];
    return Array.isArray(foci) ? foci : [];
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
    if (!matrixClient) throw new Error("Not logged in");
    const room = matrixClient.getRoom(roomId);
    if (!room) throw new Error("Unknown room");
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
    const target = pickLivekitTransport(memberTransports, foci, roomId);
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
            "the server rejected it - you may lack permission to join calls in this room",
        );
        for (const cb of voiceErrorSubscribers)
            cb(`Call membership failed: ${detail}`);
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

    try {
        session.joinRTCSession(
            { userId, deviceId, memberId: `${userId}:${deviceId}` },
            [
                {
                    type: "livekit",
                    livekit_service_url: target.serviceUrl,
                    livekit_alias: target.alias,
                },
            ],
            undefined,
            { membershipEventExpiryMs: 4 * 60 * 60 * 1000 },
        );

        // MSC4075 ring: if WE are the first into a DM call, push the peer so a
        // device whose app is closed rings. Fire-and-forget — never block or
        // fail the join on it. The peer answering (a peer already present at
        // snapshot time) sends nothing.
        const isDm = getDirectRoomIds().has(roomId);
        if (shouldRingPeers(isDm, callPeersBeforeJoin)) {
            const dmPeerIds = getRoomMembers(room)
                .map((m) => m.userId)
                .filter((id) => id !== userId);
            void sendCallNotify(roomId, dmPeerIds).catch(() => {});
        }

        const openIdToken = await matrixClient.getOpenIdToken();
        if (seq !== voiceJoinSeq) return;
        const jwtRes = await fetch(sfuJwtUrl(target.serviceUrl), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                room: target.alias,
                openid_token: openIdToken,
                device_id: deviceId,
            }),
        });
        if (seq !== voiceJoinSeq) return;
        if (!jwtRes.ok) {
            throw new Error(
                `Voice server rejected the join (${jwtRes.status})`,
            );
        }
        const { url, jwt } = (await jwtRes.json()) as {
            url: string;
            jwt: string;
        };
        if (seq !== voiceJoinSeq) return;

        lkRoom.on(
            lk.RoomEvent.TrackSubscribed,
            (
                track: RemoteTrack,
                _pub: RemoteTrackPublication,
                participant: RemoteParticipant,
            ) => {
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
            if (activeVoice !== call) return;
            const ids = speakers.map((p) => p.identity);
            for (const cb of activeSpeakerSubscribers) cb(ids);
        });
        const notifyMutes = () => {
            if (activeVoice !== call) return;
            const muted: string[] = [];
            for (const p of lkRoom.remoteParticipants.values()) {
                for (const pub of p.audioTrackPublications.values()) {
                    if (pub.isMuted) {
                        muted.push(p.identity);
                        break;
                    }
                }
            }
            for (const cb of participantMuteSubscribers) cb(muted);
        };
        lkRoom.on(lk.RoomEvent.TrackMuted, notifyMutes);
        lkRoom.on(lk.RoomEvent.TrackUnmuted, notifyMutes);
        // A participant arriving already muted fires neither event. Separate
        // from the TrackSubscribed handler above so each stays focused.
        lkRoom.on(lk.RoomEvent.TrackSubscribed, notifyMutes);
        lkRoom.on(lk.RoomEvent.ParticipantDisconnected, notifyMutes);
        const notifyVideo = () => {
            if (activeVoice !== call) return;
            const tiles = buildVideoTiles(currentVideoInputs(lk, lkRoom));
            for (const cb of videoTracksSubscribers) cb(tiles);
        };
        lkRoom.on(lk.RoomEvent.TrackSubscribed, notifyVideo);
        lkRoom.on(lk.RoomEvent.TrackUnsubscribed, notifyVideo);
        lkRoom.on(lk.RoomEvent.LocalTrackPublished, notifyVideo);
        lkRoom.on(lk.RoomEvent.LocalTrackUnpublished, notifyVideo);
        // Camera off = track.mute(), not unpublish — recompute on mute/unmute
        // too, so the tile drops to the avatar (and returns) as it toggles.
        lkRoom.on(lk.RoomEvent.TrackMuted, notifyVideo);
        lkRoom.on(lk.RoomEvent.TrackUnmuted, notifyVideo);
        // A remote stopping a share can surface as a bare TrackUnpublished
        // (no TrackUnsubscribed, if the track was already detached) or as an
        // SFU stream-state pause — recompute on both so their tile clears.
        lkRoom.on(lk.RoomEvent.TrackUnpublished, notifyVideo);
        lkRoom.on(lk.RoomEvent.TrackStreamStateChanged, notifyVideo);
        lkRoom.on(lk.RoomEvent.ParticipantDisconnected, notifyVideo);
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
            if (activeVoice?.lkRoom === lkRoom) {
                for (const cb of voiceErrorSubscribers)
                    cb("Voice call disconnected");
                void leaveVoiceCall();
            }
        });
        lkRoom.on(lk.RoomEvent.AudioPlaybackStatusChanged, () => {
            if (activeVoice !== call) return;
            setVoicePlaybackBlocked(!lkRoom.canPlaybackAudio);
        });
        let silenceNotified = false;
        lkRoom.on(lk.RoomEvent.LocalAudioSilenceDetected, () => {
            if (activeVoice !== call || silenceNotified) return;
            silenceNotified = true;
            notifyVoiceNotice(
                "Your microphone appears silent - check your input device",
            );
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
            notifyVoiceNotice(`Audio device error: ${e.message}`);
        });

        await lkRoom.connect(url, jwt);
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
    } catch (err) {
        if (activeVoice === call) {
            await leaveVoiceCall();
        } else {
            // Superseded mid-join: tear down our own resources only. The
            // superseder's leave already left the RTC session; don't touch
            // the per-room session object a rejoin may be re-joining.
            for (const el of call.audioEls) el.remove();
            call.audioEls.clear();
            await call.lkRoom.disconnect().catch(() => {});
        }
        throw err;
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
        for (const el of call.audioEls) el.remove();
        call.audioEls.clear();
        try {
            await call.lkRoom.disconnect();
        } catch {
            // already disconnected
        }
        await call.session.leaveRoomSession(10_000).catch(() => {});
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

/** Switch the live call's microphone. Null (system default) takes effect on
 *  the next join — mid-call the current device is kept. */
export async function setVoiceInputDevice(
    deviceId: string | null,
): Promise<void> {
    if (!activeVoice || !deviceId) return;
    await activeVoice.lkRoom
        .switchActiveDevice("audioinput", deviceId)
        .catch(() => {});
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
        await call.lkRoom.localParticipant.setScreenShareEnabled(on, {
            audio: settingsState.shareSystemAudio,
            resolution: screenShareCaptureResolution(
                settingsState.screenShareResolution,
                Number(settingsState.screenShareFps),
            ),
        });
        return on;
    } catch (err) {
        if (isUserCancel(err)) return false;
        console.error("Screen share failed:", err);
        notifyVoiceNotice("Could not start screen share");
        return false;
    }
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
        notifyVoiceNotice("Could not start the camera - check permissions");
        return false;
    }
}

/** Switch the live call's camera. Null (system default) takes effect on the
 *  next enable. No-op when not sharing camera. */
export async function setVideoInputDevice(
    deviceId: string | null,
): Promise<void> {
    if (!activeVoice || !deviceId) return;
    await activeVoice.lkRoom
        .switchActiveDevice("videoinput", deviceId)
        .catch(() => {});
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
    await track.restartTrack({ ...c }).catch(() => {});
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
