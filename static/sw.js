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
//   Cost — the runtime asset cache is version-scoped (`zam-shell-<version>`),
//     so a warmed one holds roughly 6 MB PER BUILD (the 5.5 MB crypto WASM is
//     served from `/_app/immutable/assets/` and is cached on demand like any
//     other asset), and every deploy discards it: a frequent deployer gets a
//     cold offline shell again after each one.
//
// The two constants below are replaced, quotes included, by
// scripts/sw-precache.mjs — a post-build node step (`npm run build` runs it
// after `vite build`), NOT a Vite plugin: a plugin's first `closeBundle`
// firing predates adapter-static writing `build/`. vite.config.ts is not
// involved. In dev this file is served verbatim, so they stay as literal
// placeholders and EVERY offline path (including the activate-time sweep)
// turns itself off.
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
	// Before the navigate check, deliberately. `mode === "navigate"` is also
	// true for <iframe>/<frame>/<embed>/<object>, and this worker's media-auth
	// branch admits exactly those destinations — so against a same-origin
	// homeserver a sub-resource navigation to a `/_matrix/` URL would be
	// claimed as a document, lose its Authorization header (401) and, once the
	// network failed, be answered with the cached index.html. Nothing under
	// `/_matrix/` is ever ours, whatever shape the request arrives in.
	if (parsed.pathname.includes("/_matrix/")) return "bypass";
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

// Is there a Cache API at all? Firefox private browsing has historically
// thrown SecurityError on the `caches` PROPERTY ACCESS (not just on open()),
// and Chrome throws when the user blocks all site data — so even `typeof
// caches` can throw here. Unguarded at module scope that would kill the whole
// worker, push included, which is the one thing offline support may never
// break. Any failure just means "no offline this session".
function swCacheApiAvailable() {
	try {
		return typeof caches !== "undefined" && caches !== null;
	} catch (e) {
		return false;
	}
}

const SW_PRECACHE_URLS = swParsePrecacheManifest(SW_PRECACHE_MANIFEST_JSON);
// Both halves must be injected. A version left as the placeholder would make
// swShellCacheName() return a garbage name that the activate sweep would then
// treat as "current", deleting every real shell cache on every start.
const SW_OFFLINE_ENABLED =
	swCacheApiAvailable() &&
	SW_PRECACHE_URLS !== null &&
	!SW_SHELL_VERSION.startsWith("__SW_");
const SW_SHELL_CACHE = swShellCacheName(SW_SHELL_VERSION);

// #region mirrored:swOfflineRuntime
// The four functions that actually touch the Cache API. Each takes its ambient
// dependencies through an optional `deps` bag — `caches`, `fetch`, the cache
// name, the precache list — so the call sites below pass nothing (the
// fallbacks bind the real globals) while swOfflineShell.mirrors.test.ts can
// EXECUTE this region in isolation against a fake Cache API. Regex-spotting
// these four is worthless: swapping `status === 200` for `response.ok` or
// dropping a `.catch()` changes real behaviour and no source assertion notices.
//
// The fallbacks are read per call and, where the Cache API is concerned,
// INSIDE the try — never in a parameter default. A parameter default that
// throws rejects an async function's promise just like a body throw, and a
// rejected promise handed to event.respondWith() is a NetworkError the browser
// does NOT retry on the network.

// Install must not hang: ~17 `cache: "reload"` fetches sit inside waitUntil,
// and a single stalled connection would hold install open until the browser's
// own event timeout rejects it. A failed install on a FIRST registration means
// no active worker at all — no web push. Same Promise.race idiom as
// shouldStayQuiet() below.
//
// 8 s is a TRADE-OFF, not a safety margin. initServiceWorker() (client.ts)
// awaits navigator.serviceWorker.ready before posting SET_AUTH, and this race
// sits inside install's waitUntil — so on a first-ever registration over a
// slow link every authenticated <img> renders 401-broken for as long as this
// number. Longer finishes the precache on worse connections (a timed-out item
// is simply not precached; it still caches on demand during the session).
// Shorter unblocks the media token sooner. 8 s covers ~140 KB of shell on a
// bad mobile link while keeping the worst-case broken-avatar window to about
// the length of a sync.
const SW_PRECACHE_TIMEOUT_MS = 8000;

/** Does this response carry an HTML body? */
function swIsHtmlResponse(response) {
	const contentType =
		(response && response.headers && response.headers.get("Content-Type")) ||
		"";
	return contentType.trim().toLowerCase().startsWith("text/html");
}

// Any base works: only the pathname is read, and an absolute URL ignores it.
// Deliberately NOT APP_ORIGIN — this region is executed standalone by
// swOfflineShell.mirrors.test.ts and may not touch worker globals.
const SW_URL_PARSE_BASE = "https://sw.invalid";

/**
 * Which precache entries may legitimately answer with HTML: the shell document,
 * under both of its Cache API keys. Everything else in the manifest is a build
 * asset, a manifest or an icon, for which an HTML body means the adapter-static
 * SPA fallback answered instead of the real file.
 */
function swUrlMayBeHtml(url) {
	let pathname;
	try {
		pathname = new URL(String(url), SW_URL_PARSE_BASE).pathname;
	} catch (e) {
		return false;
	}
	return pathname === "/" || pathname === SW_NAVIGATION_FALLBACK_URL;
}

/**
 * THE acceptance gate for anything that enters the shell cache — used by both
 * the install-time precache and the runtime cache-first path, so the two can
 * never drift.
 *
 * Store only a complete, first-party, non-HTML 200. `ok` is the tempting wrong
 * test: it is true for 204 and 206 as well, and a partial or empty body must
 * never stand in for the whole asset. An opaque cross-origin response must not
 * either, and a redirected response is by definition not the URL we asked for.
 *
 * The HTML rule is the one that matters most here. This app is adapter-static
 * with `fallback: index.html`, so the HOST answers an unknown path with
 * index.html and a 200 text/html. During a non-atomic deploy, or behind a CDN
 * edge holding the new sw.js but not the new chunk, a current-hash
 * `/_app/immutable/x.js` briefly misses and gets that fallback — and installs
 * cluster in exactly that window. Storing it would serve HTML for that chunk
 * for the life of this cache version, the module script would fail its MIME
 * check, and no reload could clear it (cache-first never re-asks). `/` and
 * `/index.html` are the only entries for which HTML is the correct body.
 */
function swMayStoreAssetResponse(response, url) {
	if (!response) return false;
	if (response.status !== 200) return false;
	if (response.type !== "basic") return false;
	if (response.redirected) return false;
	if (swIsHtmlResponse(response)) return swUrlMayBeHtml(url);
	return true;
}

/**
 * Fill the shell cache on install.
 *
 * Deliberately per-item, and an explicit fetch + gate + `cache.put()` rather
 * than `cache.add()`: `add` stores whatever the server returned on ANY 2xx,
 * which is precisely how the SPA-fallback HTML above gets baked in under a
 * `.js` key. The bulk add-all API is worse still — all-or-nothing, so one 404
 * or one flaky asset would reject install and the worker would never activate.
 * This worker's primary duty is web push, which predates offline support by
 * far; offline is additive and is never allowed to break it. Hence the per-item
 * `.catch()`: a rejected or refused entry must not abandon its siblings.
 *
 * `cache: "reload"` on each request bypasses the HTTP cache so we cannot bake
 * a stale copy of the shell we just deployed.
 */
async function swPrecacheShell(deps = {}) {
	try {
		const cacheStorage = deps.caches || caches;
		const doFetch = deps.fetch || fetch;
		const urls = deps.urls || SW_PRECACHE_URLS;
		const cache = await cacheStorage.open(deps.cacheName || SW_SHELL_CACHE);
		await Promise.race([
			Promise.all(
				// An async IIFE, so a SYNCHRONOUS throw (a bad Request, a fetch
				// that throws rather than rejects) becomes a rejection this
				// item's own .catch() absorbs. Thrown out of the map callback it
				// would escape to the outer try and abandon every sibling.
				urls.map((url) =>
					(async () => {
						const request = new Request(url, { cache: "reload" });
						const response = await doFetch(request);
						if (!swMayStoreAssetResponse(response, url)) return;
						await cache.put(request, response);
					})().catch(() => {}),
				),
			),
			new Promise((resolve) => setTimeout(resolve, SW_PRECACHE_TIMEOUT_MS)),
		]);
	} catch (e) {
		// No Cache API, quota exhausted, private mode — offline is simply
		// unavailable this session. Never fatal.
	}
}

/** Drop shell caches from previous builds. Prefix-scoped: never touches a cache we did not create. */
async function swSweepStaleCaches(deps = {}) {
	try {
		const cacheStorage = deps.caches || caches;
		const currentName = deps.cacheName || SW_SHELL_CACHE;
		const names = await cacheStorage.keys();
		await Promise.all(
			names
				.filter((name) => swIsStaleShellCache(name, currentName))
				.map((name) => cacheStorage.delete(name).catch(() => {})),
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
 * same-origin document navigation classifies `navigate`, so leaving out
 * `cache.put()` is what keeps a document response out of the Cache API.
 */
async function swNavigateNetworkFirst(request, deps = {}) {
	const doFetch = deps.fetch || fetch;
	try {
		return await doFetch(request);
	} catch (err) {
		let cache = null;
		try {
			cache = await (deps.caches || caches).open(
				deps.cacheName || SW_SHELL_CACHE,
			);
		} catch (e) {
			cache = null;
		}
		if (!cache) throw err;
		// `ignoreVary` on both lookups: the shell was precached by a WORKER
		// fetch, which sends `Accept: */*`, while a real navigation sends
		// `Accept: text/html,…`. A host that answers with `Vary: Accept` would
		// make both matches miss and offline support would silently do nothing
		// — the user just gets the browser's error page.
		const cached =
			(await cache
				.match(request, { ignoreSearch: true, ignoreVary: true })
				.catch(() => null)) ||
			(await cache
				.match(SW_NAVIGATION_FALLBACK_URL, { ignoreVary: true })
				.catch(() => null));
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
async function swAssetCacheFirst(request, deps = {}) {
	const doFetch = deps.fetch || fetch;
	// The `caches` read lives inside the try, and the try catches a THROW as
	// well as a rejection: Firefox private browsing has thrown SecurityError on
	// the property access itself and Chrome throws when all site data is
	// blocked. `await caches.open(…).catch(() => null)` only handles the
	// rejection; a synchronous throw would reject this function's promise,
	// event.respondWith() would turn that into a NetworkError, and the browser
	// does NOT then fall back to the network — every build asset would fail and
	// the user would get a white screen on a perfectly good connection.
	let cache = null;
	try {
		cache = await (deps.caches || caches).open(
			deps.cacheName || SW_SHELL_CACHE,
		);
	} catch (e) {
		cache = null;
	}
	if (!cache) return doFetch(request);
	// `ignoreVary`, for the same reason the navigate path gives: the shell was
	// precached by a WORKER fetch (`Accept: */*`) while a <link rel=stylesheet>
	// asks with `Accept: text/css,*/*;q=0.1`. A host that answers `Vary: Accept`
	// would make the precached root CSS permanently unmatchable and the offline
	// shell would boot unstyled.
	const hit = await cache
		.match(request, { ignoreVary: true })
		.catch(() => null);
	// A HIT whose body is HTML was poisoned by an older build (see
	// swMayStoreAssetResponse) — an `/_app/immutable/` asset is never HTML.
	// Treat it as a miss so the entry self-heals on the next online load
	// instead of white-screening the app forever.
	if (hit && !swIsHtmlResponse(hit)) return hit;
	const response = await doFetch(request);
	if (swMayStoreAssetResponse(response, request && request.url)) {
		cache.put(request, response.clone()).catch(() => {});
	}
	return response;
}
// #endregion mirrored:swOfflineRuntime

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

// ── Session record ──────────────────────────────────────────────────────────
// Hand-written mirror of src/lib/utils/nativeSessionRecord.ts — this file is
// copied verbatim into the build and cannot import TypeScript, so the rules
// live here twice. Change one, change both.
//
// Homeserver, token and identity are ONE stored value because they are only
// ever useful as one credential tuple. Four independently-written keys can
// TEAR: an account switch, a logout racing a login, or a worker killed
// mid-write leaves account A's bearer token paired with account B's homeserver,
// and this worker then sends the one to the other (external audit SEC-01). One
// key cannot tear — a reader gets the whole tuple or nothing.
//
// Every rejection below therefore means "this device has no credentials", never
// a partially-populated tuple, and null identities fail OPEN downstream (i.e.
// notify, don't inject) rather than building a garbage request out of junk.
//
// Unlike in the TypeScript copy, none of the container guards here are
// belt-and-braces: dbGet() returns whatever structured clone stored, so a real
// object, an array, a number or null can arrive where a string is expected.
const SESSION_KEY = "matrix_session_record";
const SESSION_VERSION = 1;
// The WORKER's own pre-record IndexedDB keys — deliberately not the Capacitor
// Preferences names in LEGACY_NATIVE_SESSION_KEYS, which are a different store
// on a different platform. Swept so a stale token does not sit at rest forever,
// but NEVER read back as a fallback: reading them is the bug. The access token
// is first, so a sweep that dies partway through has already removed the
// credential — and the presence probe in authReady can key off slot 0.
const LEGACY_SESSION_KEYS = [
	"accessToken",
	"homeserverUrl",
	"userId",
	"deviceId",
];

function nonBlank(value) {
	return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function validHomeserverUrl(value) {
	const raw = nonBlank(value);
	if (!raw) return null;
	// Trim BEFORE certifying, and keep the TRIMMED value: new URL() silently
	// tolerates surrounding whitespace, so "  https://hs  " would otherwise be
	// stamped valid with its padding intact and then concatenated into request
	// paths (mxGet does exactly that).
	const url = raw.trim();
	try {
		const parsed = new URL(url);
		if (parsed.protocol !== "https:" && parsed.protocol !== "http:")
			return null;
	} catch {
		// Not absolute ("/_matrix", "matrix.example.org") → we would have no
		// idea which server the token belongs to. Refuse the whole record.
		return null;
	}
	// A DELIBERATE extra restriction layered on top of the mirror, not drift
	// from it: the TS copy allows http: because a LAN homeserver works on
	// native, but this worker has only ever injected auth against https and
	// must keep doing so. Applied here so the writer and the reader agree —
	// restricting only one of them would store records that never parse.
	if (!isValidHomeserverUrl(url)) return null;
	return url;
}

/** A Matrix user id, cheaply: the identity half of the tuple. */
function validUserId(value) {
	const id = nonBlank(value);
	if (!id || !id.startsWith("@") || id.length < 2) return null;
	return id;
}

/**
 * Strict parse of the stored record — anything unexpected yields null, i.e.
 * "this device has no credentials", which every caller must treat as "contact
 * no homeserver", never as "use what's there".
 */
function parseSessionRecord(raw) {
	if (typeof raw !== "string" || raw.trim().length === 0) return null;
	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}
	// Arrays and JSON primitives are not records; typeof null === "object".
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
		return null;
	// A record of another shape (older or newer) may mean something else by the
	// same field names — refuse rather than guess.
	if (parsed.v !== SESSION_VERSION) return null;
	const homeserverUrl = validHomeserverUrl(parsed.homeserverUrl);
	const accessToken = nonBlank(parsed.accessToken);
	const userId = validUserId(parsed.userId);
	if (!homeserverUrl || !accessToken || !userId) return null;
	// deviceId is optional by design (no device id → this worker simply never
	// suppresses), but a WRONG type means the record is corrupt, not partial.
	const rawDevice = parsed.deviceId;
	if (
		rawDevice !== undefined &&
		rawDevice !== null &&
		typeof rawDevice !== "string"
	)
		return null;
	return {
		v: SESSION_VERSION,
		homeserverUrl,
		accessToken,
		userId,
		deviceId: nonBlank(rawDevice),
	};
}

/**
 * Build the record to store. Returns null — meaning "store nothing" — unless
 * the whole credential tuple is present and well-formed: a three-field best
 * effort is precisely the tear this record exists to make impossible.
 */
function buildSessionRecord(hs, token, user, device) {
	const homeserverUrl = validHomeserverUrl(hs);
	const accessToken = nonBlank(token);
	const userId = validUserId(user);
	if (!homeserverUrl || !accessToken || !userId) return null;
	return JSON.stringify({
		v: SESSION_VERSION,
		homeserverUrl,
		accessToken,
		userId,
		// Always present, explicitly null when unknown: an omitted key would be
		// indistinguishable from a truncated record.
		deviceId: nonBlank(device),
	});
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
	// ONE read for the whole credential tuple. It used to be four, which was
	// four chances to read a torn set (see the record mirror above).
	const storedRecord = await dbGet(SESSION_KEY);
	// Fail open to today's behaviour: anything other than an explicit stored
	// `true` (missing value, null, legacy junk) means "show bodies". Hydrated
	// BEFORE the `authFromMessage` bail-out below — it is not part of the
	// credential tuple, and returning early used to skip it entirely, leaving
	// bodies visible when a SET_AUTH won the startup race. SET_NOTIF_PRIVACY
	// still wins over this read: that handler awaits `authReady` first.
	hideNotificationBody = (await dbGet("hideNotificationBody")) === true;
	// Installs that predate the record still have the four per-key values at
	// rest. They are NEVER read back — reading them is the bug — but they are
	// swept so a stale token does not sit there forever. Slot 0 is the access
	// token, so its absence means the sweep already happened (or never had
	// anything to do): one extra read that costs nothing on every later start.
	// `.catch()` because this is housekeeping, and housekeeping must not be
	// able to fail the hydration that the push path depends on.
	const legacyToken = await dbGet(LEGACY_SESSION_KEYS[0]).catch(() => null);
	if (legacyToken != null) {
		// Queued but deliberately NOT awaited: `authReady` gates the push
		// display path, so it must never wait on a write — nor inherit its
		// failure. Nothing reads these keys, so nothing waits on the result.
		for (const key of LEGACY_SESSION_KEYS) {
			queueWrite(() => dbSet(key, null)).catch(() => {});
		}
	}
	// A SET_AUTH / CLEAR_AUTH message can land while these reads are in flight;
	// it is by definition fresher than what IndexedDB held, so it wins.
	// Overwriting it would leave the worker on a stale deviceId, which then
	// fails to match the blob's — and the worker would suppress a push meant
	// for the device that is actually running it (or resurrect an identity a
	// logout just cleared).
	if (authFromMessage) return;
	// All four fields or none of them: a record that does not validate means
	// "no credentials", never "use the parts that survived".
	const session = parseSessionRecord(storedRecord);
	if (session) {
		accessToken = session.accessToken;
		homeserverUrl = session.homeserverUrl;
		userId = session.userId;
		deviceId = session.deviceId;
	}
})();

/**
 * Take down every notification this service worker posted.
 *
 * Unscoped on purpose: the tag-scoped close further down handles "this room
 * is now read", but on the way out of a session there is no room to scope to
 * — leaving a signed-out user's message text on screen is audit finding
 * PRIV-02. `getNotifications()` only ever returns this registration's own
 * notifications, so the page's `new Notification(...)` popups are NOT covered
 * here; AppShell closes those itself.
 */
function closeAllNotifications() {
	try {
		return self.registration
			.getNotifications()
			.then((list) => {
				for (const n of list) {
					try {
						n.close();
					} catch (e) {
						/* already gone */
					}
				}
			})
			.catch(() => {});
	} catch (e) {
		return Promise.resolve();
	}
}

/**
 * What a notification carries for its click handler.
 *
 * With no identity we cannot say whose message this is, so we deliberately
 * post a notification that is NOT routable — it still shows (web push is
 * userVisibleOnly, something must appear) but clicking it only focuses the
 * app. That is what lets the page fail OPEN on an unstamped notification
 * without reopening PRIV-02: nothing this build posts is both routable and
 * unattributable.
 */
function notificationData(roomId, isCall, eventId) {
	if (!userId) return {};
	const d = roomId
		? { roomId: roomId, userId: userId }
		: { userId: userId };
	// The event the push named, so a tap jumps to the exact message instead of
	// merely opening the room. Only meaningful alongside a room id.
	if (roomId && eventId) d.eventId = eventId;
	// A call notification carries this so notificationclick's Accept knows to
	// join, not just open the room.
	if (isCall) d.isCall = true;
	return d;
}

// Set once the activate handler has run — i.e. this worker now controls its
// clients and its fetch handler will intercept their <img> media requests.
let swActivated = false;

// Tell controlled pages that authenticated media will now succeed: the worker is
// both activated (controlling the page, so it sees the <img> request) AND holds a
// token (so it can inject the Authorization header). Pages listen for this to
// retry any avatar/image that 401'd during the startup race, so a fresh load or
// SW update self-heals instead of stranding broken images until a manual reload.
// Called from BOTH the activate handler and the SET_AUTH handler because either
// can be the last of the pair to happen.
function broadcastMediaAuthReady() {
	if (!swActivated || !accessToken) return;
	self.clients
		.matchAll({ includeUncontrolled: false, type: "window" })
		.then((clients) => {
			for (const c of clients) {
				try {
					c.postMessage({ type: "MEDIA_AUTH_READY" });
				} catch (e) {
					/* client gone */
				}
			}
		})
		.catch(() => {});
}

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
				// Validate and normalise ONCE, then drive both memory and the
				// write from that single result. Memory is what the fetch
				// handler reads immediately and the record is what the next
				// cold start reads; deriving both from one parse is what makes
				// it impossible for them to describe different accounts.
				//
				// NEW COUPLING, introduced with the record: the identity is now
				// load-bearing for EVERYTHING. SET_AUTH used to set accessToken
				// and homeserverUrl even with no userId, so authenticated-media
				// injection in the fetch handler worked without an identity;
				// now a missing or malformed userId makes buildSessionRecord
				// return null, which zeroes the whole tuple and kills media auth
				// and push enrichment as well as active-session suppression.
				// Unreachable today — createAuthenticatedClient() in
				// src/lib/matrix/client.ts requires `userId: string`, so
				// getUserId() is never null by the time initServiceWorker posts
				// SET_AUTH. A future SSO/OIDC path that lands a token before the
				// user id is known would trip it, and silently.
				const record = buildSessionRecord(
					event.data.homeserverUrl,
					event.data.accessToken,
					event.data.userId,
					event.data.deviceId,
				);
				// Guaranteed non-null whenever `record` is: build and parse run
				// the same checks over the same values.
				const session = parseSessionRecord(record);
				// Set even when the message carries no usable session. The page
				// has told us what the current session IS; if that does not
				// validate, the answer is "no credentials", not "keep using the
				// previous account's" — and the startup read must not put an
				// older identity back either.
				authFromMessage = true;
				accessToken = session ? session.accessToken : null;
				homeserverUrl = session ? session.homeserverUrl : null;
				userId = session ? session.userId : null;
				deviceId = session ? session.deviceId : null;
				// A new identity invalidates any cached heartbeat decision.
				activeSessionCache = { fetchedAt: 0, value: null };
				await queueWrite(async () => {
					if (!record) {
						// Nothing complete to store — and a PREVIOUS account's
						// record must not be left where the next cold start
						// would read it in place of the one we just refused.
						await dbSet(SESSION_KEY, null);
						return;
					}
					try {
						// ONE write: IndexedDB gives us no transaction across
						// keys, so the only way homeserver / token / identity
						// cannot come apart is being a single value.
						await dbSet(SESSION_KEY, record);
					} catch (err) {
						// A failed write must not leave the last account's
						// tuple readable on the next cold start.
						try {
							await dbSet(SESSION_KEY, null);
						} catch {
							/* nothing more we can do */
						}
						throw err;
					}
				});
				// Token is now in memory — if we already control the page, its
				// media requests will succeed; tell it to retry any that 401'd.
				broadcastMediaAuthReady();
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
					// The record holds the token, so it goes FIRST and alone:
					// if anything below throws, the credential is already gone.
					await dbSet(SESSION_KEY, null);
					// Then the pre-record keys, each independently guarded so
					// one failure cannot strand the copies after it — an
					// upgraded install would otherwise keep a second copy of
					// the token at rest right through logout.
					for (const key of LEGACY_SESSION_KEYS) {
						try {
							await dbSet(key, null);
						} catch {
							/* best effort — the token is already gone */
						}
					}
				});
				// Credentials are gone; now take the notifications that were
				// posted under them off the screen.
				await closeAllNotifications();
			} else if (event.data?.type === "CLEAR_NOTIFICATIONS") {
				// An account switch keeps a valid session (the next account's
				// boot re-sends SET_AUTH), so it must not clear auth — but the
				// previous account's notifications still have to go.
				await closeAllNotifications();
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
	// Web Share Target (manifest share_target.action). The browser POSTs the
	// shared payload here; stash it in IndexedDB and redirect to a normal GET
	// the app boot consumes (/?share_target=1). UNTRUSTED input — we only
	// STASH, never act on it.
	{
		let shareUrl;
		try {
			shareUrl = new URL(event.request.url);
		} catch {
			shareUrl = null;
		}
		if (
			event.request.method === "POST" &&
			shareUrl &&
			shareUrl.pathname === "/share-target"
		) {
			event.respondWith(
				(async () => {
					try {
						const form = await event.request.formData();
						const files = form
							.getAll("files")
							.filter(
								(f) =>
									f &&
									typeof f === "object" &&
									"size" in f,
							);
						await dbSet("share_target_payload", {
							title: form.get("title") || "",
							text: form.get("text") || "",
							url: form.get("url") || "",
							files,
							ts: Date.now(),
						});
					} catch (e) {
						/* malformed multipart — still redirect to a clean page */
					}
					return Response.redirect("/?share_target=1", 303);
				})(),
			);
			return;
		}
	}

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
	// origin + base-path checks below further constrain the destination.
	if (
		!parsedUrl.pathname.includes("/_matrix/client/v1/media/") ||
		!isElementRequest ||
		alreadyHasAuth
	)
		return;

	event.respondWith(
		authReady
			.then(() => {
				// Check ORIGIN (scheme + host + port, not just hostname — a
				// media URL on the homeserver's host at an attacker-chosen
				// port or over plain http must not receive the token) and the
				// path prefix, so two homeservers on the same domain at
				// different paths can't cross-contaminate either.
				// Mirrors src/lib/utils/mediaAuthOrigin.ts — change both; its
				// test reads this file and pins the pair together.
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
					parsedUrl.origin !== hsUrl.origin ||
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

async function mxPost(path, body) {
	await authReady;
	if (!accessToken || !homeserverUrl) return false;
	const base = homeserverUrl.endsWith("/")
		? homeserverUrl.slice(0, -1)
		: homeserverUrl;
	try {
		const res = await fetch(base + path, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
		});
		return res.ok;
	} catch {
		return false;
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
	let isCall = false;

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
			const name = senderName.trim();

			// MSC4075 call-notify → render an incoming CALL, not a message.
			// Keep this rule identical to pushNotificationKind() in
			// src/lib/utils/pushNotificationKind.ts (a test guards the
			// contract). event_id_only pushes carry no sound tweak, so the
			// event TYPE is what decides the ring here. The unstable type is
			// what is actually stored/pushed; the stable one is accepted too.
			const evtType = typeof event.type === "string" ? event.type : "";
			const notifyType = event.content && event.content.notify_type;
			isCall =
				(evtType === "org.matrix.msc4075.call.notify" ||
					evtType === "m.call.notify") &&
				(notifyType === undefined || notifyType === "ring");

			if (isCall) {
				title = "Incoming call";
				body = name ? name : "Someone is calling";
			} else {
				// Same comparisons as notificationBody() in
				// src/lib/utils/notificationPrivacy.ts: trim both sides so a
				// whitespace-only body counts as absent, and drop the text
				// entirely when the privacy setting is on.
				const text = hideNotificationBody ? "" : msg.trim();
				if (text) body = name ? `${name}: ${text}` : text;
				else if (name) body = `${name} sent a message`;
			}
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

	return { title, body, icon, roomId, eventId, isCall };
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
		// Bounded regardless: openDb() rejects on `onblocked`, so the one known
		// way authReady could hang is already closed, but ANY other cause of a
		// never-settling authReady would hang waitUntil here and show NOTHING —
		// fail closed, the one outcome this whole check must never produce. The
		// race is the guarantee, not a workaround for a specific bug. On timeout
		// the identity reads below are null and we notify.
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

// Auto-dismiss delay for an unanswered incoming-call ring notification (ms).
// Mirrors CALL_RING_TIMEOUT_MS in src/lib/utils/callRingTimeout.ts and
// MatrixMessagingService.java — keep the three in sync. A closed-device call
// push has no "call ended" signal, so without this the ring lingers forever.
const RING_AUTO_DISMISS_MS = 45000;

// After a call notification is shown, take it down after the ring timeout so an
// unanswered call reads as "missed" instead of lingering. Keeps the push event
// alive (via the push handler's waitUntil) for the wait; if the SW is killed
// first the notification just lingers as it did before — no regression. Never
// throws: a failed auto-dismiss must degrade to "lingers as today".
function scheduleRingAutoDismiss(roomId) {
	if (!roomId) return Promise.resolve();
	return new Promise((resolve) => {
		setTimeout(() => {
			Promise.resolve()
				.then(() => self.registration.getNotifications({ tag: roomId }))
				.then((list) => {
					for (const notification of list) {
						// Only take down the ring itself — a same-room MESSAGE
						// notification can share this tag (both use tag=roomId) and
						// must not be closed by the ring timer.
						if (notification.data && notification.data.isCall) {
							notification.close();
						}
					}
				})
				.catch(() => {})
				.then(resolve);
		}, RING_AUTO_DISMISS_MS);
	});
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
			await self.registration.showNotification(n.title, {
				body: n.body,
				icon: n.icon,
				badge: "/favicon_foreground.png",
				tag: n.roomId || undefined,
				renotify: true,
				data: notificationData(n.roomId, n.isCall, n.eventId),
				// A call persists until answered/dismissed and offers
				// Accept/Decline; a message is a normal transient popup with
				// Reply/Mark-as-read actions (when routable).
				...(n.isCall
					? {
							requireInteraction: true,
							actions: [
								{ action: "accept", title: "Accept" },
								{ action: "decline", title: "Decline" },
							],
						}
					: n.roomId
						? {
								actions: [
									{
										action: "reply",
										type: "text",
										title: "Reply",
										placeholder: "Reply…",
									},
									{ action: "markread", title: "Mark as read" },
								],
							}
						: {}),
			});
			// An unanswered ring must not linger forever (a closed-device call
			// push carries no "call ended" signal); a message notification is
			// transient already, so only a call gets the auto-dismiss timer.
			if (n.isCall) {
				await scheduleRingAutoDismiss(n.roomId);
			}
			return;
		})(),
	);
});

// Quick-action handlers for notification actions (Reply / Mark as read).
// Hand-mirrors the messageNotificationActions() contract from
// src/lib/utils/notifActions.ts — the SW cannot import TypeScript.
// Produces postMessage shapes consumed by Task 3 (page-side handlers).
async function handleQuickReply(roomId, replyText, eventId, userId) {
	try {
		const clients = await self.clients.matchAll({
			type: "window",
			includeUncontrolled: true,
		});
		const open = clients.find((c) => "focus" in c);
		const text = (replyText || "").trim();
		// If we have inline text AND an open page, post the reply for the page
		// to send through the crypto-correct path (never send cleartext from SW).
		if (text && open) {
			open.focus();
			open.postMessage({
				type: "NOTIF_REPLY",
				roomId: roomId,
				text: text,
				eventId: eventId,
				userId: userId,
			});
			return;
		}
		// No inline text OR no open page → open the room to compose. Never a
		// direct cleartext send.
		if (open) {
			open.focus();
			open.postMessage({
				type: "OPEN_ROOM",
				roomId: roomId,
				userId: userId,
				eventId: eventId,
			});
		} else {
			self.clients.openWindow(
				roomId ? `/#room=${encodeURIComponent(roomId)}` : "/",
			);
		}
	} catch {
		// Swallow — waitUntil must never reject.
	}
}

async function handleQuickMarkRead(roomId, eventId, userId) {
	try {
		const clients = await self.clients.matchAll({
			type: "window",
			includeUncontrolled: true,
		});
		const open = clients.find((c) => "focus" in c);
		// If a page is open, let it handle the read receipt (crypto context).
		// Do NOT focus/open — a mark-read is a silent dismiss.
		if (open) {
			open.postMessage({
				type: "NOTIF_MARK_READ",
				roomId: roomId,
				eventId: eventId,
				userId: userId,
			});
			return;
		}
		// No open page → send a plaintext read receipt directly (hand-mirrors
		// buildReadReceiptPath from src/lib/utils/notifActions.ts).
		if (roomId && eventId) {
			await mxPost(
				`/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/receipt/m.read/${encodeURIComponent(eventId)}`,
				{},
			);
		}
	} catch {
		// Swallow — waitUntil must never reject.
	}
}

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	const data = event.notification.data || {};
	const roomId = data.roomId;
	// The account this notification was posted under, so the page can refuse
	// to open the room in a session that is not the one that posted it.
	const postedBy = data.userId;
	// Decline on a call notification just takes it down — open nothing.
	if (event.action === "decline") return;
	// Quick-reply: routes to page postMessage when open+text, else opens room.
	if (event.action === "reply") {
		event.waitUntil(
			handleQuickReply(roomId, event.reply, data.eventId, postedBy),
		);
		return;
	}
	// Quick-mark-read: silent dismiss (postMessage to page if open, else HTTP).
	if (event.action === "markread") {
		event.waitUntil(
			handleQuickMarkRead(roomId, data.eventId, postedBy),
		);
		return;
	}
	// Accept on a call → open the room AND join; every other tap just opens
	// the room. The page reads this flag off the OPEN_ROOM message.
	const joinCall = !!data.isCall && event.action === "accept";
	event.waitUntil(
		self.clients
			.matchAll({ type: "window", includeUncontrolled: true })
			.then((clients) => {
				for (const client of clients) {
					if ("focus" in client) {
						client.focus();
						if (roomId)
							client.postMessage({
								type: "OPEN_ROOM",
								roomId: roomId,
								userId: postedBy,
								joinCall: joinCall,
								eventId: data.eventId,
							});
						return;
					}
				}
				return self.clients.openWindow(
					roomId
						? `/#room=${encodeURIComponent(roomId)}${data.eventId ? `&event=${encodeURIComponent(data.eventId)}` : ""}`
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
self.addEventListener("activate", (event) => {
	// We now control our clients, so our fetch handler will see their media
	// requests. If the token already arrived (SET_AUTH before activate), tell
	// the page it can retry; otherwise the SET_AUTH handler will, once it lands.
	swActivated = true;
	event.waitUntil(
		Promise.all([
			self.clients.claim(),
			SW_OFFLINE_ENABLED ? swSweepStaleCaches() : Promise.resolve(),
		]).then(() => broadcastMediaAuthReady()),
	);
});
