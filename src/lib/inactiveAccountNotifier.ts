// Notifications for the accounts signed in here that are NOT the active one,
// while the app is open (desktop, and browsers without web push: there the
// service worker covers them). Only the active account runs a client, so each
// other account polls the server's own notification list instead.
//
// Deliberately not /sync: a sync for another account's device would consume
// its to-device messages (room keys among them), which its own session then
// never receives, and messages it should read stop decrypting. GET
// /notifications touches nothing; the decryptor below fetches pending room
// keys without acknowledging them, as the push decryptors do.

import { decryptHeadless } from "$lib/pushDecryptHeadless";
import {
    isLoudNotification,
    pickNewNotifications,
    type ServerNotification,
} from "$lib/utils/accountNotifications";
import {
    createBoundedIdSet,
    type BoundedIdSet,
} from "$lib/utils/notifyDecrypted";
import type { StoredAccount } from "$lib/utils/accounts";

export interface AccountNotice {
    /** The account it belongs to: tapping it switches to this account. */
    userId: string;
    roomId: string;
    eventId: string;
    /** Room name, or the sender's for a nameless room. */
    title: string;
    sender: string;
    /** Message text; empty when it could not be read (still encrypted). */
    body: string;
    loud: boolean;
}

export interface InactiveAccountNotifierOptions {
    accounts: () => readonly StoredAccount[];
    activeUserId: () => string | null;
    post: (notice: AccountNotice) => void;
    /** Between two polls of one account. */
    intervalMs?: number;
}

const POLL_INTERVAL_MS = 30_000;
const TICK_MS = 5_000;
const MAX_BACKOFF_MS = 5 * 60_000;
const REQUEST_TIMEOUT_MS = 15_000;
const ROOM_NAME_TTL_MS = 10 * 60_000;

interface AccountState {
    /** The token this state belongs to: a new one starts over. */
    token: string;
    cursor: number | null;
    shown: BoundedIdSet;
    nextAt: number;
    failures: number;
    /** The server refused the token; wait for a new one. */
    rejected: boolean;
    busy: boolean;
}

export function startInactiveAccountNotifier(
    opts: InactiveAccountNotifierOptions,
): () => void {
    const interval = opts.intervalMs ?? POLL_INTERVAL_MS;
    const states = new Map<string, AccountState>();
    const roomNames = new Map<string, { name: string | null; at: number }>();
    let stopped = false;

    const tick = () => {
        if (stopped) return;
        const active = opts.activeUserId();
        const now = Date.now();
        const present = new Set<string>();
        for (const account of opts.accounts()) {
            present.add(account.userId);
            if (account.userId === active) continue;
            let state = states.get(account.userId);
            if (!state || state.token !== account.accessToken) {
                state = {
                    token: account.accessToken,
                    cursor: null,
                    shown: createBoundedIdSet(),
                    nextAt: now,
                    failures: 0,
                    rejected: false,
                    busy: false,
                };
                states.set(account.userId, state);
            }
            if (state.rejected || state.busy || state.nextAt > now) continue;
            state.busy = true;
            void poll(account, state).finally(() => (state.busy = false));
        }
        // Signed out here: forget it.
        for (const userId of states.keys())
            if (!present.has(userId)) states.delete(userId);
    };

    async function poll(account: StoredAccount, state: AccountState) {
        try {
            const res = await get(
                account,
                "/_matrix/client/v3/notifications?limit=20",
            );
            if (res.status === 401) {
                state.rejected = true;
                return;
            }
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = (await res.json()) as {
                notifications?: ServerNotification[];
            };
            const list = Array.isArray(json.notifications)
                ? json.notifications
                : [];
            const { fresh, cursor } = pickNewNotifications(
                list,
                state.cursor,
                (id) => state.shown.has(id),
            );
            state.cursor = cursor;
            for (const n of fresh) {
                const id = n.event?.event_id as string;
                state.shown.add(id);
                if (stopped || opts.activeUserId() === account.userId) return;
                const notice = await describe(account, n);
                if (stopped || opts.activeUserId() === account.userId) return;
                opts.post(notice);
            }
            state.failures = 0;
            state.nextAt = Date.now() + interval;
        } catch {
            state.failures++;
            state.nextAt =
                Date.now() +
                Math.min(interval * 2 ** state.failures, MAX_BACKOFF_MS);
        }
    }

    async function describe(
        account: StoredAccount,
        n: ServerNotification,
    ): Promise<AccountNotice> {
        const roomId = n.room_id as string;
        const event = (n.event ?? {}) as Record<string, unknown>;
        const sender = typeof event.sender === "string" ? event.sender : "";
        let type = typeof event.type === "string" ? event.type : "";
        let content = (event.content ?? {}) as Record<string, unknown>;
        if (type === "m.room.encrypted" && account.deviceId) {
            const clear = await decryptHeadless({
                homeserverUrl: account.homeserverUrl,
                accessToken: account.accessToken,
                userId: account.userId,
                deviceId: account.deviceId,
                roomId,
                event: { ...event, room_id: roomId },
                wasmUrl: new URL("/push-decrypt/crypto.wasm", location.href)
                    .href,
            }).catch(() => null);
            if (clear) {
                type = clear.type;
                content = clear.content;
            }
        }
        const [senderName, roomName] = await Promise.all([
            displayName(account, roomId, sender),
            roomNameOf(account, roomId),
        ]);
        const body =
            type !== "m.room.encrypted" && typeof content.body === "string"
                ? content.body
                : "";
        return {
            userId: account.userId,
            roomId,
            eventId: event.event_id as string,
            title: roomName ?? senderName ?? "New message",
            sender: senderName ?? sender,
            body,
            loud: isLoudNotification(n.actions),
        };
    }

    async function displayName(
        account: StoredAccount,
        roomId: string,
        sender: string,
    ): Promise<string | null> {
        if (!sender) return null;
        const member = await getJson(
            account,
            `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.member/${encodeURIComponent(sender)}`,
        );
        const name = member?.displayname;
        return typeof name === "string" && name ? name : sender;
    }

    async function roomNameOf(
        account: StoredAccount,
        roomId: string,
    ): Promise<string | null> {
        const key = `${account.userId}\n${roomId}`;
        const cached = roomNames.get(key);
        if (cached && Date.now() - cached.at < ROOM_NAME_TTL_MS)
            return cached.name;
        const state = await getJson(
            account,
            `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.name/`,
        );
        const name =
            typeof state?.name === "string" && state.name ? state.name : null;
        roomNames.set(key, { name, at: Date.now() });
        return name;
    }

    tick();
    const timer = setInterval(tick, TICK_MS);
    return () => {
        stopped = true;
        clearInterval(timer);
    };
}

function get(account: StoredAccount, path: string): Promise<Response> {
    const base = account.homeserverUrl.replace(/\/+$/, "");
    return fetch(base + path, {
        headers: { Authorization: `Bearer ${account.accessToken}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
}

async function getJson(
    account: StoredAccount,
    path: string,
): Promise<Record<string, unknown> | null> {
    try {
        const res = await get(account, path);
        return res.ok ? ((await res.json()) as Record<string, unknown>) : null;
    } catch {
        return null;
    }
}
