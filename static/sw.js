const DB_NAME = "matrix-sw";
const DB_STORE = "auth";
const APP_ORIGIN = self.location.origin;

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
function notificationData(roomId) {
	if (!userId) return {};
	return roomId ? { roomId: roomId, userId: userId } : { userId: userId };
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
				data: notificationData(n.roomId),
			});
		})(),
	);
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	const data = event.notification.data || {};
	const roomId = data.roomId;
	// The account this notification was posted under, so the page can refuse
	// to open the room in a session that is not the one that posted it.
	const postedBy = data.userId;
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
							});
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

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
	event.waitUntil(self.clients.claim()),
);
