// Steam rich presence: the game the logged-in user is playing and the rich
// presence Steam shows for it, read from Steam's own UI. Steam's client is an
// embedded Chromium with a remote debugging port (127.0.0.1:8080 when Steam
// runs with -cef-enable-debugging), and its pages are read over the Chrome
// DevTools Protocol. Nothing is written to Steam. Steam closed, or its port not
// open, is not an error: it just means there is nothing to report.
//
// onSteam(state) is called when the observed state changes, with
//   { appId, name, status, richPresence, startedAt }
// or null when the user is not in a game, or Steam or its port went away.
// startedAt is when this game was first seen in the current play session: it
// resets when the game stops being reported, so a relaunch starts over.

const http = require("http");

const HTTP_TIMEOUT_MS = 2000;
const CALL_TIMEOUT_MS = 3000;
const MAX_HTTP_BYTES = 1024 * 1024;
const MAX_MESSAGE_BYTES = 1024 * 1024;
const LIMITS = { name: 128, status: 256, key: 256, value: 256, keys: 32 };
const SHARED_TITLE = "SharedJSContext";

// Run in a page of Steam's UI. The friendStore field names come from Steam's
// own UI bundle (m_unGamePlayedAppID, m_mapRichPresence, the GetCurrent*
// getters). They are not checked against a live Steam, so every read is
// defensive. The result is null for a page with no friend store (not the right
// target), { inGame: false } when the user is not playing, and otherwise plain
// data. Only the page is expected to answer; a stray JS error just means "no".
// steamId and lobbyId (the lobby only when Steam calls it valid) are what
// Steam's own Join Game button builds its link from (steamUrl.cjs).
const EXPRESSION = [
    "(() => {",
    "const fs = window.friendStore;",
    // window.friendStore wraps the UI store, which holds the user's own friend.
    "const self = fs && ((fs.m_FriendsUIFriendStore && fs.m_FriendsUIFriendStore.self) || fs.self);",
    "if (!self) return null;",
    "const p = self.persona || self.m_persona || self;",
    "const appId = Number(p.m_unGamePlayedAppID || 0) || 0;",
    "if (!appId) return { inGame: false };",
    "const map = p.m_mapRichPresence;",
    "const rp = {};",
    'if (map && typeof map.forEach === "function") map.forEach((v, k) => { rp[k] = String(v); });',
    'let status = ""; try { status = String(p.GetCurrentGameStatus ? p.GetCurrentGameStatus() : ""); } catch (e) {}',
    'let name = ""; try { name = String(p.GetCurrentGameName ? p.GetCurrentGameName() : ""); } catch (e) {}',
    // The game's own icon: its hash is on the app overview in Steam's app store.
    'let icon = ""; try { const o = window.appStore.GetAppOverviewByAppID(appId); icon = String((o && o.icon_hash) || ""); } catch (e) {}',
    'return { inGame: true, appId: String(appId), name: name || String(p.m_strGameExtraInfo || ""), status, icon, steamId: String(self.steamid64 || ""), lobbyId: (p.is_in_valid_lobby && p.m_game_lobby_id && String(p.m_game_lobby_id) !== "0") ? String(p.m_game_lobby_id) : "", richPresence: rp };',
    "})()",
].join("\n");

function errorText(e) {
    return String((e && e.message) || e);
}

/** Trims and cuts a value to `max` characters. */
function clip(value, max) {
    return String(value ?? "")
        .trim()
        .slice(0, max);
}

/** The value as a string of digits (an id), or "" when it is not one. */
function digits(value) {
    const s = String(value ?? "");
    return /^\d{1,20}$/.test(s) ? s : "";
}

/**
 * The report of one target's answer: { state } (state null when not in a game),
 * or null when the answer is not one this source understands, so the target
 * is not the right one.
 */
function readReport(v) {
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    if (typeof v.inGame !== "boolean") return null;
    if (!v.inGame) return { state: null };
    const appId = String(v.appId ?? "").trim();
    if (!/^[1-9]\d{0,19}$/.test(appId)) return null;
    const rp = v.richPresence;
    const entries =
        rp && typeof rp === "object"
            ? Object.keys(rp)
                  .slice(0, LIMITS.keys)
                  .map((k) => [clip(k, LIMITS.key), clip(rp[k], LIMITS.value)])
            : [];
    return {
        state: {
            appId,
            name: clip(v.name, LIMITS.name) || `Steam game ${appId}`,
            status: clip(v.status, LIMITS.status),
            // Part of a URL later, so only a plain hash passes.
            icon: /^[0-9a-f]{40}$/.test(String(v.icon ?? "")) ? v.icon : "",
            steamId: digits(v.steamId),
            lobbyId: digits(v.lobbyId),
            // fromEntries defines keys as data, so a key like "__proto__" is safe.
            richPresence: Object.fromEntries(entries),
        },
    };
}

/** Equal for equal observed states, whatever order Steam listed the keys in. */
function stateKey(state) {
    const rp = state.richPresence;
    return JSON.stringify([
        state.appId,
        state.name,
        state.status,
        state.icon,
        state.steamId,
        state.lobbyId,
        Object.keys(rp)
            .sort()
            .map((k) => [k, rp[k]]),
    ]);
}

/**
 * GET of a loopback URL with node's http module. Node does not read proxy
 * settings for http.get, so the call never goes through a proxy. Errors from
 * the socket (refused, reset, timed out) are marked `portClosed`, which is how
 * the caller tells "Steam is not running" from a broken answer.
 */
function httpGetText(url, timeoutMs) {
    return new Promise((resolve, reject) => {
        const req = http.get(url, { agent: false }, (res) => {
            if (res.statusCode !== 200) {
                res.resume();
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }
            const chunks = [];
            let size = 0;
            res.on("data", (chunk) => {
                size += chunk.length;
                if (size > MAX_HTTP_BYTES) {
                    req.destroy(new Error("response too large"));
                    return;
                }
                chunks.push(chunk);
            });
            res.on("end", () =>
                resolve(Buffer.concat(chunks).toString("utf8")),
            );
            res.on("error", reject);
        });
        req.setTimeout(timeoutMs, () => req.destroy(new Error("timed out")));
        req.on("error", (e) => {
            e.portClosed = true;
            reject(e);
        });
    });
}

/** Pages to try, the one titled SharedJSContext first. */
function orderTargets(targets) {
    const pages = targets.filter((t) => t.title === SHARED_TITLE);
    const rest = targets.filter((t) => t.title !== SHARED_TITLE);
    return [...pages, ...rest];
}

/**
 * `onSteam` gets each change of the observed state. `WebSocketImpl` and
 * `httpGet(url, timeoutMs)` can be replaced in tests; an injected httpGet must
 * mark socket-level failures with `portClosed` too.
 */
function createSteamPresence({
    onSteam,
    log = () => {},
    port = 8080,
    host = "127.0.0.1",
    pollMs = 5000,
    retryMs = 3000,
    WebSocketImpl = require("ws"),
    httpGet = httpGetText,
}) {
    let running = false;
    let polling = false;
    let timer = null;
    // The socket to the target that answered, kept between polls.
    let ws = null;
    // CDP message id -> { sock, resolve, reject, timer }.
    const calls = new Map();
    let nextId = 1;
    // The state last reported to onSteam, with its startedAt.
    let last = null;
    let lastKey = null;
    const status = { portOpen: false, error: null };

    function setError(message) {
        if (message === status.error) return;
        status.error = message;
        if (message) log("steam presence:", message);
    }

    /** Reports `next` (a state without startedAt, or null) if it changed. */
    function update(next) {
        const key = next ? stateKey(next) : null;
        if (key === lastKey) return;
        const same = next && last && last.appId === next.appId;
        last = next
            ? { ...next, startedAt: same ? last.startedAt : Date.now() }
            : null;
        lastKey = key;
        if (last) log("steam game:", last.name);
        try {
            onSteam(last);
        } catch (e) {
            log("steam presence listener failed:", errorText(e));
        }
    }

    /** Closes a socket and fails the calls waiting on it. */
    function dropSocket(sock = ws) {
        if (!sock) return;
        if (sock === ws) ws = null;
        for (const [id, c] of calls) {
            if (c.sock !== sock) continue;
            calls.delete(id);
            clearTimeout(c.timer);
            c.reject(new Error("socket closed"));
        }
        try {
            sock.terminate();
        } catch {
            // Already closed.
        }
    }

    function onMessage(sock, data) {
        let msg;
        try {
            msg = JSON.parse(String(data));
        } catch {
            return;
        }
        const call = msg && calls.get(msg.id);
        if (!call || call.sock !== sock) return;
        calls.delete(msg.id);
        clearTimeout(call.timer);
        call.resolve(msg);
    }

    function send(sock, method, params) {
        return new Promise((resolve, reject) => {
            const id = nextId++;
            const timer = setTimeout(() => {
                calls.delete(id);
                reject(new Error(`${method} timed out`));
            }, CALL_TIMEOUT_MS);
            calls.set(id, { sock, resolve, reject, timer });
            try {
                sock.send(JSON.stringify({ id, method, params }));
            } catch (e) {
                calls.delete(id);
                clearTimeout(timer);
                reject(e);
            }
        });
    }

    /** Opens a socket with no Origin header, as Steam expects from a debugger. */
    function connect(url) {
        return new Promise((resolve, reject) => {
            let opened = false;
            let sock;
            try {
                sock = new WebSocketImpl(url, {
                    handshakeTimeout: CALL_TIMEOUT_MS,
                    maxPayload: MAX_MESSAGE_BYTES,
                });
            } catch (e) {
                reject(e);
                return;
            }
            sock.on("error", (e) => {
                if (opened) log("steam presence socket:", errorText(e));
                else reject(e);
            });
            sock.on("close", () => {
                if (!opened) reject(new Error("socket closed"));
                dropSocket(sock);
            });
            sock.on("open", () => {
                opened = true;
                sock.on("message", (data) => onMessage(sock, data));
                resolve(sock);
            });
        });
    }

    /** The target list from /json/list: page targets with a debugger URL. */
    async function listTargets() {
        const body = await httpGet(
            `http://${host}:${port}/json/list`,
            HTTP_TIMEOUT_MS,
        );
        let list;
        try {
            list = JSON.parse(body);
        } catch {
            throw new Error("bad target list from Steam");
        }
        if (!Array.isArray(list)) throw new Error("bad target list from Steam");
        return list.filter(
            (t) =>
                t &&
                t.type === "page" &&
                typeof t.webSocketDebuggerUrl === "string",
        );
    }

    /** Runs EXPRESSION on a socket; a page script error reads as no answer. */
    async function probe(sock) {
        const msg = await send(sock, "Runtime.evaluate", {
            expression: EXPRESSION,
            returnByValue: true,
        });
        if (msg.error) throw new Error(msg.error.message || "CDP error");
        const result = msg.result || {};
        if (result.exceptionDetails) return null;
        return readReport(result.result ? result.result.value : undefined);
    }

    /**
     * The first target that answers: the kept socket, then each page in turn.
     * Returns { answered, state, error }.
     */
    async function findState(targets) {
        let lastError = null;
        if (ws) {
            try {
                const report = await probe(ws);
                if (report) return { answered: true, state: report.state };
            } catch (e) {
                lastError = e;
            }
            // It no longer answers as the right target: look again.
            dropSocket(ws);
        }
        for (const t of orderTargets(targets)) {
            if (!running) return { answered: false, error: null };
            let sock;
            try {
                sock = await connect(t.webSocketDebuggerUrl);
            } catch (e) {
                lastError = e;
                continue;
            }
            if (!running) {
                dropSocket(sock);
                return { answered: false, error: null };
            }
            try {
                const report = await probe(sock);
                if (report) {
                    ws = sock;
                    return { answered: true, state: report.state };
                }
            } catch (e) {
                lastError = e;
            }
            dropSocket(sock);
        }
        return { answered: false, error: lastError };
    }

    function schedule() {
        if (!running || timer) return;
        timer = setTimeout(poll, status.portOpen ? pollMs : retryMs);
    }

    async function poll() {
        timer = null;
        if (!running || polling) return;
        polling = true;
        try {
            let targets;
            try {
                targets = await listTargets();
            } catch (e) {
                if (!running) return;
                if (e && e.portClosed) {
                    // Steam is not running (or its port is shut): not an error.
                    status.portOpen = false;
                    setError(null);
                    dropSocket();
                    update(null);
                } else {
                    status.portOpen = true;
                    setError(errorText(e));
                }
                return;
            }
            if (!running) return;
            status.portOpen = true;
            const found = await findState(targets);
            if (!running) return;
            if (found.answered) {
                setError(null);
                update(found.state);
            } else {
                setError(found.error ? errorText(found.error) : null);
                update(null);
            }
        } catch (e) {
            if (running) setError(errorText(e));
        } finally {
            polling = false;
            schedule();
        }
    }

    return {
        start() {
            if (running) return;
            running = true;
            void poll();
        },
        stop() {
            running = false;
            if (timer) clearTimeout(timer);
            timer = null;
            dropSocket();
            status.portOpen = false;
            setError(null);
            update(null);
        },
        status: () => ({
            running,
            portOpen: status.portOpen,
            connected: ws !== null,
            error: status.error,
        }),
    };
}

module.exports = {
    createSteamPresence,
    EXPRESSION,
};
