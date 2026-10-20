// An in-memory copy of everything the app logs to the console, so a user on a
// release build (no dev console, no logcat: Capacitor turns both off) can
// export it from Settings > Debug Info and send it for debugging.
//
// Installed first thing in hooks.client.ts so crypto init is covered.
// matrix-js-sdk's logger looks console methods up on every call, so wrapping
// console catches its output too. Every line is redacted as it is captured:
// what sits in the buffer is already safe to export.
//
// Deliberately free of app imports: it loads before anything else.

export type LogLevel = "debug" | "log" | "info" | "warn" | "error";

const LEVELS: LogLevel[] = ["debug", "log", "info", "warn", "error"];

/** Longest a single line may be once formatted; the rest is cut. */
const MAX_LINE_CHARS = 8_000;
/** Longest a single non-string argument may be once formatted. */
const MAX_ARG_CHARS = 4_000;

/**
 * A bounded list of lines: keeps the newest, dropping the oldest once there
 * are more than `maxLines` or their total length passes `maxChars`.
 */
export class LogRing {
    private lines: string[] = [];
    private head = 0;
    private chars = 0;
    private dropped = 0;

    constructor(
        readonly maxLines: number,
        readonly maxChars: number,
    ) {}

    push(line: string): void {
        if (line.length > this.maxChars) line = line.slice(0, this.maxChars);
        this.lines.push(line);
        this.chars += line.length;
        while (
            this.lines.length - this.head > this.maxLines ||
            this.chars > this.maxChars
        ) {
            this.chars -= this.lines[this.head].length;
            this.head++;
            this.dropped++;
        }
        // Compact now and then rather than shifting on every push.
        if (this.head > 1024 && this.head * 2 > this.lines.length) {
            this.lines = this.lines.slice(this.head);
            this.head = 0;
        }
    }

    /** Oldest first. A copy. */
    snapshot(): string[] {
        return this.lines.slice(this.head);
    }

    /** How many lines have been evicted since the start. */
    get droppedCount(): number {
        return this.dropped;
    }

    get size(): number {
        return this.lines.length - this.head;
    }

    clear(): void {
        this.lines = [];
        this.head = 0;
        this.chars = 0;
        this.dropped = 0;
    }
}

const R = "<redacted>";

// Field names whose values are secrets, wherever they show up: JSON
// (`"password":"x"`), query strings (`access_token=x`) or prose
// (`password: x`).
const SECRET_FIELDS = [
    "access_token",
    "accessToken",
    "refresh_token",
    "refreshToken",
    "id_token",
    "login_token",
    "loginToken",
    "password",
    "new_password",
    "passphrase",
    "recovery_key",
    "recoveryKey",
    "private_key",
    "privateKey",
    "session_key",
    "sessionKey",
    "pickle_key",
    "pickleKey",
    "client_secret",
    "code_verifier",
    "secret",
    "token",
].join("|");

const PATTERNS: [RegExp, string][] = [
    // Authorization: Bearer xyz / "Authorization":"Bearer xyz"
    [/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, `$1${R}`],
    // "field": "value" in JSON (escaped quotes inside the value included).
    [
        new RegExp(
            `("(?:${SECRET_FIELDS})"\\s*:\\s*)"(?:[^"\\\\]|\\\\.)*"`,
            "gi",
        ),
        `$1"${R}"`,
    ],
    // field=value in URLs and form bodies.
    [new RegExp(`([?&;](?:${SECRET_FIELDS})=)[^&#\\s"']+`, "gi"), `$1${R}`],
    // field: value / field=value in prose.
    [
        new RegExp(
            `(\\b(?:${SECRET_FIELDS})\\b\\s*[:=]\\s*)(?!<redacted>)[^\\s,;"'}&]+`,
            "gi",
        ),
        `$1${R}`,
    ],
    // Matrix access / refresh tokens (Synapse and MAS formats), anywhere.
    [/\b(?:syt|syr|mat|mar|mct|mcr)_[A-Za-z0-9_-]{8,}/g, R],
    // Recovery keys: 12 groups of 4 base58 characters, starting "Es".
    [/\bEs[1-9A-HJ-NP-Za-km-z]{2}(?:\s?[1-9A-HJ-NP-Za-km-z]{4}){11}\b/g, R],
];

/** Strip tokens, passwords and keys from a log line. */
export function redact(line: string): string {
    for (const [re, sub] of PATTERNS) line = line.replace(re, sub);
    return line;
}

function formatArg(arg: unknown): string {
    if (typeof arg === "string") return arg;
    if (arg instanceof Error) {
        const head = `${arg.name}: ${arg.message}`;
        const stack = arg.stack?.includes(arg.message)
            ? arg.stack
            : `${head}\n${arg.stack ?? ""}`;
        const cause =
            arg.cause !== undefined ? `\n  cause: ${formatArg(arg.cause)}` : "";
        return (stack ?? head) + cause;
    }
    if (arg === undefined) return "undefined";
    if (typeof arg === "function") return `[function ${arg.name || "?"}]`;
    if (typeof arg !== "object" || arg === null) return String(arg);
    try {
        const seen = new WeakSet<object>();
        const json = JSON.stringify(arg, (_k, v: unknown) => {
            if (typeof v === "bigint") return v.toString();
            if (v instanceof Error) return formatArg(v);
            if (typeof v === "object" && v !== null) {
                if (seen.has(v)) return "[circular]";
                seen.add(v);
            }
            return v;
        });
        const text = json ?? String(arg);
        return text.length > MAX_ARG_CHARS
            ? `${text.slice(0, MAX_ARG_CHARS)}…`
            : text;
    } catch {
        return Object.prototype.toString.call(arg);
    }
}

/** One captured line: ISO time, level, then the redacted arguments. */
export function formatLine(
    level: LogLevel,
    args: unknown[],
    now = new Date(),
): string {
    let text = args.map(formatArg).join(" ");
    if (text.length > MAX_LINE_CHARS)
        text = `${text.slice(0, MAX_LINE_CHARS)}…`;
    return `${now.toISOString()} ${level.toUpperCase().padEnd(5)} ${redact(text)}`;
}

// ~5000 lines or ~2 MB of text, whichever comes first.
const ring = new LogRing(5000, 2 * 1024 * 1024);
let installed = false;

/** Record a line directly (not through the console). */
export function captureLog(level: LogLevel, ...args: unknown[]): void {
    try {
        ring.push(formatLine(level, args));
    } catch {
        /* never let logging break the caller */
    }
}

/**
 * Wrap console.debug/log/info/warn/error so each call is also recorded, and
 * record uncaught errors and unhandled rejections. Idempotent.
 */
export function installLogCapture(): void {
    if (installed || typeof console === "undefined") return;
    installed = true;
    for (const level of LEVELS) {
        const original = console[level];
        if (typeof original !== "function") continue;
        console[level] = function (...args: unknown[]) {
            captureLog(level, ...args);
            return original.apply(this, args);
        };
    }
    if (typeof window !== "undefined") {
        window.addEventListener("error", (e) => {
            captureLog(
                "error",
                "[uncaught]",
                e.error ?? e.message,
                e.filename ? `at ${e.filename}:${e.lineno}:${e.colno}` : "",
            );
        });
        window.addEventListener("unhandledrejection", (e) => {
            captureLog("error", "[unhandled rejection]", e.reason);
        });
    }
}

/** The captured lines, oldest first. */
export function getCapturedLogs(): string[] {
    return ring.snapshot();
}

/** How many old lines the buffer has had to drop. */
export function getDroppedLogCount(): number {
    return ring.droppedCount;
}
