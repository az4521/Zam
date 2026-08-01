const DB_NAME = "matrix-sw";
const DB_STORE = "auth";
const APP_ORIGIN = self.location.origin;

// ── Offline app shell (audit PWA-01) ────────────────────────────────────────
// The offline contract, in full:
//   Guaranteed offline — the shell (`/`, `/index.html`, the entry/start
//     chunks, the root CSS, the manifest and icons) plus every
//     `/_app/immutable/` asset the browser successfully fetched during a
//     previous ONLINE session.
//   Never offline — anything under `/_matrix/`, remote media, /twemoji/,
//     /ruffle/, /sounds/, and any lazy chunk never once fetched online.
//   Never stale — navigations always try the network first; the cache answers
//     only when the network throws.
//   Updates — every deploy injects a different manifest + version below, so
//     this file's BYTES differ, so the browser installs the new worker,
//     precaches the new shell and deletes older `zam-shell-*` caches on
//     activate. `reloadToLatest()` in src/lib/update.ts keeps working: its
//     `fetch(location.href, {cache:"reload"})` is not a navigation request and
//     is classified `bypass`.
//
// The two constants below are replaced, quotes included, by the
// `zam-sw-precache` Vite plugin in vite.config.ts. In dev this file is served
// verbatim, so they stay as literal placeholders and EVERY offline path
// (including the activate-time sweep) turns itself off.
const SW_PRECACHE_MANIFEST_JSON = "__SW_PRECACHE_MANIFEST__";
const SW_SHELL_VERSION = "__SW_SHELL_VERSION__";

// #region mirrored:swCacheRouting
// Hand-written mirror of src/lib/utils/swCacheRouting.ts — this file is not
// bundled and cannot import it. Change one, change both;
// swOfflineShell.mirrors.test.ts executes this region against that module's
// own case table.
const SW_SHELL_CACHE_PREFIX = "zam-shell-";
const SW_BUILD_ASSET_PREFIX = "/_app/immutable/";
const SW_NAVIGATION_FALLBACK_URL = "/index.html";

function swClassifyRequest(input) {
	if (input.method !== "GET") return "bypass";
	if (input.hasAuthHeader) return "bypass";
	let parsed;
	try {
		parsed = new URL(input.url);
	} catch {
		return "bypass";
	}
	if (parsed.origin !== input.appOrigin) return "bypass";
	if (input.mode === "navigate" || input.destination === "document")
		return "navigate";
	// `startsWith`, never `includes`: the prefix must open the path, or a
	// homeserver route that merely CONTAINS it would be stored cache-first.
	if (parsed.pathname.startsWith(SW_BUILD_ASSET_PREFIX)) {
		// `new URL` normalises `..` segments but does NOT decode `%2f`, so
		// `/_app/immutable/..%2f..%2f_matrix/client/v3/sync` keeps a pathname
		// that still starts with the prefix while a server that decodes `%2F`
		// before resolving would answer it with `/_matrix/` content — which we
		// would then have classified cache-first and stored. A real Vite build
		// asset filename never contains a percent sign, so requiring none
		// closes the whole encoded-traversal class for free.
		if (parsed.pathname.indexOf("%") !== -1) return "bypass";
		return "asset";
	}
	return "bypass";
}

function swParsePrecacheManifest(raw) {
	if (typeof raw !== "string") return null;
	if (raw.startsWith("__SW_")) return null;
	let value;
	try {
		value = JSON.parse(raw);
	} catch {
		return null;
	}
	if (!Array.isArray(value)) return null;
	const urls = value.filter(
		(u) => typeof u === "string" && u.startsWith("/") && !u.startsWith("//"),
	);
	return urls.length > 0 ? urls : null;
}

function swShellCacheName(version) {
	return SW_SHELL_CACHE_PREFIX + version;
}

function swIsStaleShellCache(name, currentName) {
	return (
		typeof name === "string" &&
		name.startsWith(SW_SHELL_CACHE_PREFIX) &&
		name !== currentName
	);
}
// #endregion mirrored:swCacheRouting

const SW_PRECACHE_URLS = swParsePrecacheManifest(SW_PRECACHE_MANIFEST_JSON);
// Both halves must be injected. A version left as the placeholder would make
// swShellCacheName() return a garbage name that the activate sweep would then
// treat as "current", deleting every real shell cache on every start.
const SW_OFFLINE_ENABLED =
	SW_PRECACHE_URLS !== null && !SW_SHELL_VERSION.startsWith("__SW_");
const SW_SHELL_CACHE = swShellCacheName(SW_SHELL_VERSION);

/**
 * Fill the shell cache on install.
 *
 * Deliberately per-item `cache.add()` rather than the bulk API: that one is
 * all-or-nothing, so one 404 or one flaky asset would reject install and the
 * worker would never activate — and this worker's primary duty is web push,
 * which predates offline support by far. Offline is additive and is never
 * allowed to break it.
 *
 * `cache: "reload"` on each request bypasses the HTTP cache so we cannot bake
 * a stale copy of the shell we just deployed.
 */
async function swPrecacheShell() {
	try {
		const cache = await caches.open(SW_SHELL_CACHE);
		await Promise.all(
			SW_PRECACHE_URLS.map((url) =>
				cache.add(new Request(url, { cache: "reload" })).catch(() => {}),
			),
		);
	} catch (e) {
		// No Cache API, quota exhausted, private mode — offline is simply
		// unavailable this session. Never fatal.
	}
}

/** Drop shell caches from previous builds. Prefix-scoped: never touches a cache we did not create. */
async function swSweepStaleCaches() {
	try {
		const names = await caches.keys();
		await Promise.all(
			names
				.filter((name) => swIsStaleShellCache(name, SW_SHELL_CACHE))
				.map((name) => caches.delete(name).catch(() => {})),
		);
	} catch (e) {
		/* nothing to sweep */
	}
}

/**
 * Network-FIRST for documents. The cache is only ever the offline fallback,
 * which is what keeps this from fighting the app's own update path: an online
 * user always gets the freshly deployed index.html.
 *
 * This path READS the cache and never writes to it — deliberately. A
 * same-origin document navigation to a `/_matrix/…` URL classifies `navigate`,
 * so this is the last route by which a `/_matrix/` response could land in the
 * Cache API. No `cache.put()` here means it never can.
 */
async function swNavigateNetworkFirst(request) {
	try {
		return await fetch(request);
	} catch (err) {
		const cache = await caches.open(SW_SHELL_CACHE).catch(() => null);
		if (!cache) throw err;
		const cached =
			(await cache
				.match(request, { ignoreSearch: true })
				.catch(() => null)) ||
			(await cache.match(SW_NAVIGATION_FALLBACK_URL).catch(() => null));
		if (cached) return cached;
		throw err;
	}
}

/**
 * Cache-FIRST for /_app/immutable/. Those filenames are content-hashed, so a
 * hit can never be stale. A miss is fetched and stored — that is what makes a
 * cold offline start work after one online session without precaching the
 * 48.7 MB build.
 */
async function swAssetCacheFirst(request) {
	const cache = await caches.open(SW_SHELL_CACHE).catch(() => null);
	if (!cache) return fetch(request);
	const hit = await cache.match(request).catch(() => null);
	if (hit) return hit;
	const response = await fetch(request);
	// 200-only: a 206 partial or an opaque cross-origin response must never be
	// stored as if it were the whole asset.
	if (response && response.status === 200 && response.type === "basic") {
		cache.put(request, response.clone()).catch(() => {});
	}
	return response;
}

/**
 * The offline layer's entry point. Returns null — never a Response, never a
 * rejected promise — for everything it does not own, so the twimg and
 * media-auth branches below keep their behaviour and `respondWith` is never
 * called twice for one event.
 */
function swOfflineShellResponse(request) {
	if (!SW_OFFLINE_ENABLED) return null;
	const kind = swClassifyRequest({
		method: request.method,
		mode: request.mode,
		destination: request.destination,
		url: request.url,
		appOrigin: APP_ORIGIN,
		hasAuthHeader: request.headers.has("Authorization"),
	});
	if (kind === "navigate") return swNavigateNetworkFirst(request);
	if (kind === "asset") return swAssetCacheFirst(request);
	return null;
}

function openDb() {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1);
		req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
		// A blocked upgrade (an older tab still holding the DB open) fires
		// neither onsuccess nor onerror, so without this the promise never
		// settles — and `authReady` hangs with it. The display path awaits
		// authReady, so a hang there shows NOTHING at all: fail closed, the one
		// outcome this module must never produce. Rejecting makes every caller
		// take its existing catch/fallback path and notify.
		req.onblocked = () => reject(new Error("blocked"));
	});
}

async function dbGet(key) {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(DB_STORE, "readonly");
		const req = tx.objectStore(DB_STORE).get(key);
		req.onsuccess = () => resolve(req.result ?? null);
		req.onerror = () => reject(req.error);
	});
}

async function dbSet(key, value) {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(DB_STORE, "readwrite");
		const req = tx.objectStore(DB_STORE).put(value, key);
		req.onsuccess = () => resolve();
		req.onerror = () => reject(req.error);
	});
}

// Every dbSet opens its own connection/transaction, so two concurrently
// running handlers would race and could persist out of order (memory says
// `true`, IndexedDB ends up `false`). Chain all writes onto one promise so
// they land in the order the messages arrived. `.then(run, run)` keeps the
// chain alive after a failed write.
let writeQueue = Promise.resolve();
function queueWrite(run) {
	writeQueue = writeQueue.then(run, run);
	return writeQueue;
}

function isValidHomeserverUrl(url) {
	try {
		const parsed = new URL(url);
		return parsed.protocol === "https:";
	} catch {
		return false;
	}
}

/**
 * Only accept a non-empty string as an identity; anything else becomes null so
 * every downstream check fails open (i.e. notifies) instead of building a
 * garbage request path out of it.
 */
function asIdString(value) {
	return typeof value === "string" && value.length > 0 ? value : null;
}

let accessToken = null;
let homeserverUrl = null;
// Which account/device this worker belongs to. Needed only by the
// active-session suppression check below — null means "we don't know", which
// always resolves to "show the notification".
let userId = null;
let deviceId = null;
// Cached active-session heartbeat, read by shouldStayQuiet() below and reset
// here whenever the identity changes. Declared with the rest of the module
// state so the `message` listener never references it before its `let`.
let activeSessionCache = { fetchedAt: 0, value: null };
// Set once the page has told us who we are (SET_AUTH) or that we are logged
// out (CLEAR_AUTH). The IndexedDB restore below checks it so it can never
// overwrite a fresher identity that arrived while its reads were in flight.
// Declared here, with the rest of the module state, so neither the restore nor
// the `message` listener can touch it before its `let`.
let authFromMessage = false;
// Device-global "hide message text in notifications" privacy setting, mirrored
// from the page (SET_NOTIF_PRIVACY). Mirrors src/lib/utils/notificationPrivacy.ts
// by hand — this file is not bundled and cannot import it. Change one, change both.
let hideNotificationBody = false;

const authReady = (async () => {
	const storedToken = await dbGet("accessToken");
	const storedHs = await dbGet("homeserverUrl");
	const storedUser = await dbGet("userId");
	const storedDevice = await dbGet("deviceId");
	// A SET_AUTH / CLEAR_AUTH message can land while these reads are in flight;
	// it is by definition fresher than what IndexedDB held, so it wins.
	// Overwriting it would leave the worker on a stale deviceId, which then
	// fails to match the blob's — and the worker would suppress a push meant
	// for the device that is actually running it (or resurrect an identity a
	// logout just cleared).
	if (authFromMessage) return;
	if (isValidHomeserverUrl(storedHs)) {
		accessToken = storedToken;
		homeserverUrl = storedHs;
		userId = asIdString(storedUser);
		deviceId = asIdString(storedDevice);
	}
	// Fail open to today's behaviour: anything other than an explicit stored
	// `true` (missing value, null, legacy junk) means "show bodies".
	hideNotificationBody = (await dbGet("hideNotificationBody")) === true;
})();

self.addEventListener("message", (event) => {
	// Only accept messages from the app's own origin
	if (event.origin !== APP_ORIGIN) return;
	// Hold the event open for the whole async body: without waitUntil the
	// worker is terminable as soon as the sync part returns, so a toggle
	// followed by closing the tab could update memory but lose the
	// IndexedDB write — and the SW is cold for essentially every push.
	event.waitUntil(
		(async () => {
			if (event.data?.type === "SET_AUTH") {
				const { accessToken: token, homeserverUrl: hs } = event.data;
				if (!isValidHomeserverUrl(hs)) return;
				const user = asIdString(event.data.userId);
				const device = asIdString(event.data.deviceId);
				authFromMessage = true;
				accessToken = token;
				homeserverUrl = hs;
				userId = user;
				deviceId = device;
				// A new identity invalidates any cached heartbeat decision.
				activeSessionCache = { fetchedAt: 0, value: null };
				await queueWrite(async () => {
					await dbSet("accessToken", token);
					await dbSet("homeserverUrl", hs);
					await dbSet("userId", user);
					await dbSet("deviceId", device);
				});
			} else if (event.data?.type === "CLEAR_AUTH") {
				// Logout / session expiry — forget the token so we stop injecting it,
				// and the identity so a stale device id can't silence this worker.
				authFromMessage = true;
				accessToken = null;
				homeserverUrl = null;
				userId = null;
				deviceId = null;
				activeSessionCache = { fetchedAt: 0, value: null };
				await queueWrite(async () => {
					await dbSet("accessToken", null);
					await dbSet("homeserverUrl", null);
					await dbSet("userId", null);
					await dbSet("deviceId", null);
				});
			} else if (event.data?.type === "SET_NOTIF_PRIVACY") {
				// Wait out startup hydration first: its stored read lands after this
				// handler starts and would otherwise clobber the newer value with the
				// pre-toggle one (leaving bodies visible until the SW restarts).
				await authReady.catch(() => {});
				hideNotificationBody = event.data.hideBody === true;
				const hide = hideNotificationBody;
				await queueWrite(() => dbSet("hideNotificationBody", hide));
			}
		})().catch(() => {}),
	);
});

self.addEventListener("fetch", (event) => {
	// Offline app shell first (audit PWA-01). Returns null for everything it
	// does not own — navigations and /_app/immutable/ GETs only — so the twimg
	// and media-auth branches below are unchanged and respondWith is never
	// called twice for one event.
	const shell = swOfflineShellResponse(event.request);
	if (shell) {
		event.respondWith(shell);
		return;
	}

	const url = event.request.url;

	let parsedUrl;
	try {
		parsedUrl = new URL(url);
	} catch {
		return;
	}

	// No-referrer proxy for Twitter/twimg video CDN — no fallback to avoid leaking Referer
	if (parsedUrl.hostname === "video.twimg.com") {
		event.respondWith(
			fetch(
				new Request(url, {
					method: event.request.method,
					headers: event.request.headers,
					mode: "cors",
					credentials: "omit",
					referrerPolicy: "no-referrer",
				}),
			),
		);
		return;
	}

	// Only inject auth on HTML-element-initiated requests (img, video, audio, etc.)
	// JS fetch calls (destination === '') already include auth headers themselves
	const isElementRequest =
		event.request.destination !== "" &&
		event.request.destination !== "document" &&
		event.request.destination !== "script" &&
		event.request.destination !== "style";
	const alreadyHasAuth = event.request.headers.has("Authorization");
	// Only inject the token on the authenticated MEDIA endpoints — never on any
	// other /_matrix/ path. This matches the URLs mxcToHttp builds (download +
	// thumbnail under /_matrix/client/v1/media/) and the push-notification
	// thumbnail below, so the access token can't leak onto other homeserver APIs.
	// `includes` (not `startsWith`) so homeservers mounted under a base path
	// (e.g. https://host/matrix/_matrix/client/v1/media/…) still match; the
	// hostname + base-path checks below further constrain the destination.
	if (
		!parsedUrl.pathname.includes("/_matrix/client/v1/media/") ||
		!isElementRequest ||
		alreadyHasAuth
	)
		return;

	event.respondWith(
		authReady
			.then(() => {
				// Check hostname and path prefix so two homeservers on the same domain at different paths can't cross-contaminate
				let hsUrl;
				try {
					hsUrl = new URL(homeserverUrl);
				} catch {
					return fetch(event.request);
				}
				const hsBase = hsUrl.pathname.endsWith("/")
					? hsUrl.pathname
					: hsUrl.pathname + "/";
				const reqBase = parsedUrl.pathname.endsWith("/")
					? parsedUrl.pathname
					: parsedUrl.pathname + "/";
				if (
					!accessToken ||
					parsedUrl.hostname !== hsUrl.hostname ||
					!reqBase.startsWith(hsBase)
				)
					return fetch(event.request);

				const headers = new Headers(event.request.headers);
				headers.set("Authorization", `Bearer ${accessToken}`);
				return fetch(url, {
					method: event.request.method,
					headers,
					cache: "default",
				});
			})
			.catch(() => fetch(event.request)),
	);
});

// ── Web Push (PWA notifications) ────────────────────────────────────────────
// Sygnal sends "event_id_only" web push: just event_id / room_id. We fetch the
// event/room/sender from the homeserver (using the stored auth) to show a
// useful notification, then fall back to a generic one.

async function mxGet(path) {
	await authReady;
	if (!accessToken || !homeserverUrl) return null;
	const base = homeserverUrl.endsWith("/")
		? homeserverUrl.slice(0, -1)
		: homeserverUrl;
	try {
		const res = await fetch(base + path, {
			headers: { Authorization: `Bearer ${accessToken}` },
		});
		if (!res.ok) return null;
		return await res.json();
	} catch {
		return null;
	}
}

async function buildNotification(data) {
	// Never compose a body before the privacy flag has been hydrated from
	// IndexedDB — reading it early would default to "show bodies".
	await authReady;
	const roomId = data.room_id;
	const eventId = data.event_id;
	let title = "New message";
	let body = "You have a new message";
	let icon = "/favicon.png";

	if (roomId && eventId) {
		const rid = encodeURIComponent(roomId);

		const nameRes = await mxGet(
			`/_matrix/client/v3/rooms/${rid}/state/m.room.name/`,
		);
		if (nameRes && nameRes.name) title = nameRes.name;

		const event = await mxGet(
			`/_matrix/client/v3/rooms/${rid}/event/${encodeURIComponent(eventId)}`,
		);
		if (event) {
			// Homeserver-supplied and untrusted: coerce to strings so a
			// malformed event can't blow up on .trim() below.
			const sender = typeof event.sender === "string" ? event.sender : "";
			const rawMsg = event.content && event.content.body;
			const msg = typeof rawMsg === "string" ? rawMsg : "";
			let senderName = sender;
			const member = await mxGet(
				`/_matrix/client/v3/rooms/${rid}/state/m.room.member/${encodeURIComponent(sender)}`,
			);
			if (
				member &&
				typeof member.displayname === "string" &&
				member.displayname
			)
				senderName = member.displayname;
			// Same comparisons as notificationBody() in
			// src/lib/utils/notificationPrivacy.ts: trim both sides so a
			// whitespace-only body counts as absent, and drop the text
			// entirely when the privacy setting is on.
			const name = senderName.trim();
			const text = hideNotificationBody ? "" : msg.trim();
			if (text) body = name ? `${name}: ${text}` : text;
			else if (name) body = `${name} sent a message`;
		}

		const avatarRes = await mxGet(
			`/_matrix/client/v3/rooms/${rid}/state/m.room.avatar/`,
		);
		const mxc = avatarRes && avatarRes.url;
		if (mxc && mxc.startsWith("mxc://") && homeserverUrl) {
			const rest = mxc.slice("mxc://".length);
			const slash = rest.indexOf("/");
			if (slash > 0) {
				const server = rest.slice(0, slash);
				const mediaId = rest.slice(slash + 1);
				const base = homeserverUrl.endsWith("/")
					? homeserverUrl.slice(0, -1)
					: homeserverUrl;
				// authenticated thumbnail — the SW fetch handler injects auth too,
				// but build the URL explicitly so the OS-side fetch carries it.
				icon =
					`${base}/_matrix/client/v1/media/thumbnail/${encodeURIComponent(server)}/` +
					`${encodeURIComponent(mediaId)}?width=128&height=128&method=crop`;
			}
		}
	}

	return { title, body, icon, roomId };
}

// ── Active-session suppression ────────────────────────────────────────────
// Hand-written mirror of shouldSuppressForActiveDevice() (plus the strict
// parse in parseActiveSession()) from src/lib/utils/activeSession.ts — the SW
// cannot import TypeScript, so keep the two in step. Fails open in every
// ambiguous case: a suppression bug must never eat a notification.
const ACTIVE_SESSION_KEY = "moe.crafty.matrix.active_session";
const MAX_FUTURE_SKEW_MS = 300000;
// Mirrors MAX_GRACE_MS in activeSession.ts: a blob past this is a bug, and
// honouring it would mute this device indefinitely. Must stay above the
// longest duration Settings can produce (2h custom ceiling) — this clamp is
// silent, so a lower value here would quietly shorten the user's setting.
const MAX_GRACE_MS = 7200000;
const ACTIVE_SESSION_CACHE_MS = 10000;
// `activeSessionCache` is declared with the module auth state near the top of
// this file, next to the `userId`/`deviceId` it is keyed to.

async function shouldStayQuiet() {
	try {
		// A push can wake a stopped worker while the IndexedDB restore is still
		// in flight; without this the identity would read as null on every cold
		// start and suppression would never apply. A rejected authReady is
		// caught below → notify.
		//
		// Bounded: openDb() has no `onblocked` handler, so a blocked upgrade can
		// leave authReady permanently pending. Waiting forever here would hang
		// waitUntil and show NOTHING — fail closed, the one outcome this whole
		// check must never produce. On timeout the identity reads below are
		// null and we notify.
		await Promise.race([
			authReady,
			new Promise((resolve) => setTimeout(resolve, 3000)),
		]);
		if (!userId || !deviceId) return false; // don't know who we are → notify
		const now = Date.now();
		let blob = activeSessionCache.value;
		// Short cache: several pushes can land in one burst; one GET covers
		// them. A negative age means the clock jumped back — refetch rather
		// than trust an entry stamped in the future.
		const age = now - activeSessionCache.fetchedAt;
		if (age > ACTIVE_SESSION_CACHE_MS || age < 0) {
			blob = await mxGet(
				`/_matrix/client/v3/user/${encodeURIComponent(userId)}/account_data/${ACTIVE_SESSION_KEY}`,
			);
			activeSessionCache = { fetchedAt: now, value: blob };
		}
		if (!blob || typeof blob !== "object") return false;
		const otherDevice = blob.deviceId;
		const ts = blob.ts;
		const graceMs = blob.graceMs;
		if (typeof otherDevice !== "string" || !otherDevice) return false;
		if (typeof ts !== "number" || !Number.isFinite(ts)) return false;
		if (
			typeof graceMs !== "number" ||
			!Number.isFinite(graceMs) ||
			graceMs <= 0
		)
			return false;
		if (otherDevice === deviceId) return false; // it's us
		if (ts > now + MAX_FUTURE_SKEW_MS) return false; // broken clock
		return now - ts < Math.min(graceMs, MAX_GRACE_MS);
	} catch {
		return false; // anything unexpected (IndexedDB, network) → notify
	}
}

self.addEventListener("push", (event) => {
	let data = {};
	try {
		if (event.data) {
			// Sygnal webpush sends JSON; tolerate plain-text too.
			try {
				const json = event.data.json();
				data = json.notification || json || {};
			} catch {
				const txt = event.data.text();
				try {
					const json = JSON.parse(txt);
					data = json.notification || json || {};
				} catch {
					data = { _raw: txt };
				}
			}
		}
	} catch {
		data = {};
	}

	// counts.unread === 0 → a "clear" push: the server is telling us this room
	// was read (on this device or another). Take the room's notification down
	// instead of merely declining to post a new one — leaving it up is exactly
	// the "I already read that" complaint this handles.
	//
	// The price: Chrome checks userVisibleOnly AFTER waitUntil settles and is
	// satisfied by any visible notification, so the stale popup used to pay
	// that bill for us. Closing it can leave zero visible notifications, which
	// drains the push budget and may eventually earn the browser's own generic
	// "This site has been updated in the background" notice. There is no way to
	// both dismiss the notification and satisfy userVisibleOnly, so this is the
	// cost of the feature, not a bug: a popup for a message the user already
	// read is the worse outcome. This path returned without showing anything
	// before the change too — the precedent is already here.
	if (data.counts && data.counts.unread === 0) {
		// Scoped to the room the push names. A clear push without a room_id
		// tells us nothing about WHICH notification is stale, and closing all
		// of them would hide genuinely unread rooms.
		const clearedRoomId = data.room_id;
		if (clearedRoomId) {
			// The .catch() below handles a rejected lookup; this try handles a
			// synchronous throw (getNotifications absent), which would escape
			// past the return and abort the whole push event.
			try {
				event.waitUntil(
					self.registration
						.getNotifications({ tag: clearedRoomId })
						.then((list) => {
							for (const n of list) n.close();
						})
						.catch(() => {}),
				);
			} catch {
				// Nothing we can close; fall through to the return.
			}
		}
		return;
	}

	// userVisibleOnly subscriptions REQUIRE a notification per push or the
	// browser penalises/blocks the subscription — so always show something,
	// even if enrichment fails.
	event.waitUntil(
		(async () => {
			// Another device is demonstrably in use → stay quiet. Checked first
			// so none of the enrichment fetches below run when we won't show
			// anything. Never throws; returns false on any doubt.
			if (await shouldStayQuiet()) return;

			const n = await buildNotification(data).catch(() => ({
				title: "New message",
				body: "You have a new message",
				icon: "/favicon.png",
				roomId: data.room_id,
			}));
			return self.registration.showNotification(n.title, {
				body: n.body,
				icon: n.icon,
				badge: "/favicon_foreground.png",
				tag: n.roomId || undefined,
				renotify: true,
				data: { roomId: n.roomId },
			});
		})(),
	);
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	const roomId = event.notification.data && event.notification.data.roomId;
	event.waitUntil(
		self.clients
			.matchAll({ type: "window", includeUncontrolled: true })
			.then((clients) => {
				for (const client of clients) {
					if ("focus" in client) {
						client.focus();
						if (roomId)
							client.postMessage({ type: "OPEN_ROOM", roomId });
						return;
					}
				}
				return self.clients.openWindow(
					roomId
						? `/#room=${encodeURIComponent(roomId)}`
						: "/",
				);
			}),
	);
});

self.addEventListener("install", (event) => {
	self.skipWaiting();
	if (!SW_OFFLINE_ENABLED) return;
	event.waitUntil(swPrecacheShell());
});
self.addEventListener("activate", (event) =>
	event.waitUntil(
		Promise.all([
			self.clients.claim(),
			SW_OFFLINE_ENABLED ? swSweepStaleCaches() : Promise.resolve(),
		]),
	),
);
