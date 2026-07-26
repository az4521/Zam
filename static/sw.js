const DB_NAME = "matrix-sw";
const DB_STORE = "auth";
const APP_ORIGIN = self.location.origin;

function openDb() {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1);
		req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
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

const authReady = (async () => {
	const storedToken = await dbGet("accessToken");
	const storedHs = await dbGet("homeserverUrl");
	const storedUser = await dbGet("userId");
	const storedDevice = await dbGet("deviceId");
	if (isValidHomeserverUrl(storedHs)) {
		accessToken = storedToken;
		homeserverUrl = storedHs;
		userId = asIdString(storedUser);
		deviceId = asIdString(storedDevice);
	}
})();

self.addEventListener("message", async (event) => {
	// Only accept messages from the app's own origin
	if (event.origin !== APP_ORIGIN) return;
	if (event.data?.type === "SET_AUTH") {
		const { accessToken: token, homeserverUrl: hs } = event.data;
		if (!isValidHomeserverUrl(hs)) return;
		const user = asIdString(event.data.userId);
		const device = asIdString(event.data.deviceId);
		accessToken = token;
		homeserverUrl = hs;
		userId = user;
		deviceId = device;
		// A new identity invalidates any cached heartbeat decision.
		activeSessionCache = { fetchedAt: 0, value: null };
		await dbSet("accessToken", token);
		await dbSet("homeserverUrl", hs);
		await dbSet("userId", user);
		await dbSet("deviceId", device);
	} else if (event.data?.type === "CLEAR_AUTH") {
		// Logout / session expiry — forget the token so we stop injecting it,
		// and the identity so a stale device id can't silence this worker.
		accessToken = null;
		homeserverUrl = null;
		userId = null;
		deviceId = null;
		activeSessionCache = { fetchedAt: 0, value: null };
		await dbSet("accessToken", null);
		await dbSet("homeserverUrl", null);
		await dbSet("userId", null);
		await dbSet("deviceId", null);
	}
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
			const sender = event.sender || "";
			const msg = (event.content && event.content.body) || "";
			let senderName = sender;
			const member = await mxGet(
				`/_matrix/client/v3/rooms/${rid}/state/m.room.member/${encodeURIComponent(sender)}`,
			);
			if (member && member.displayname) senderName = member.displayname;
			if (msg) body = senderName ? `${senderName}: ${msg}` : msg;
			else if (senderName) body = `${senderName} sent a message`;
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
// honouring it would mute this device indefinitely.
const MAX_GRACE_MS = 900000;
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

	// counts.unread === 0 → a "clear" push; don't show anything.
	if (data.counts && data.counts.unread === 0) return;

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

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
	event.waitUntil(self.clients.claim()),
);
