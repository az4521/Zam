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

let accessToken = null;
let homeserverUrl = null;

const authReady = (async () => {
	const storedToken = await dbGet("accessToken");
	const storedHs = await dbGet("homeserverUrl");
	if (isValidHomeserverUrl(storedHs)) {
		accessToken = storedToken;
		homeserverUrl = storedHs;
	}
})();

self.addEventListener("message", async (event) => {
	// Only accept messages from the app's own origin
	if (event.origin !== APP_ORIGIN) return;
	if (event.data?.type === "SET_AUTH") {
		const { accessToken: token, homeserverUrl: hs } = event.data;
		if (!isValidHomeserverUrl(hs)) return;
		accessToken = token;
		homeserverUrl = hs;
		await dbSet("accessToken", token);
		await dbSet("homeserverUrl", hs);
	} else if (event.data?.type === "CLEAR_AUTH") {
		// Logout / session expiry — forget the token so we stop injecting it.
		accessToken = null;
		homeserverUrl = null;
		await dbSet("accessToken", null);
		await dbSet("homeserverUrl", null);
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
		buildNotification(data)
			.catch(() => ({
				title: "New message",
				body: "You have a new message",
				icon: "/favicon.png",
				roomId: data.room_id,
			}))
			.then((n) =>
				self.registration.showNotification(n.title, {
					body: n.body,
					icon: n.icon,
					badge: "/favicon_foreground.png",
					tag: n.roomId || undefined,
					renotify: true,
					data: { roomId: n.roomId },
				}),
			),
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
