// DOM side of the message-link-pill built-in: decorates raw message-link
// anchors in the timeline in place (href untouched, so Zam's own matrix-link
// handling still runs on click) and pairs each pill with its preview card for
// hover highlighting. Unloading restores every anchor's original text.
import type { ZamPluginApi, Disposable } from "../../types";
import {
    distinctMessagePermalinks,
    embedIndexForHref,
    parseMessagePermalink,
    shouldPillAnchor,
} from "./links";
import { pillLabelKey, type PillLabel } from "./label";

const ROW_SELECTOR = '[data-zam-region="timeline"] [data-event-id]';
const LINK_SELECTOR =
    '[data-zam-region="timeline"] a[href*="matrix.to"], [data-zam-region="timeline"] a[href^="matrix:"]';
const EMBED_BUTTON_SELECTOR =
    '[data-zam-region="timeline"] [data-event-id] button';

export interface PillText {
    viewMessage: string;
    ariaIn(room: string): string;
    aria: string;
}

interface Saved {
    text: string;
    title: string | null;
    ariaLabel: string | null;
    labelKey: string;
}

interface Pairing {
    controller: AbortController;
    pills: HTMLElement[];
    embeds: HTMLElement[];
}

const SVG_NS = "http://www.w3.org/2000/svg";
const CHEVRON_PATH = "m9 18 6-6-6-6";
const BUBBLE_PATH =
    "M12 2C6.48 2 2 6.03 2 11c0 2.4 1.05 4.58 2.75 6.2L4 22l4.9-2.33c.98.22 2.02.33 3.1.33 5.52 0 10-4.03 10-9S17.52 2 12 2Z";

/** A small decorative icon: a stroked chevron or a filled speech bubble. */
function icon(doc: Document, path: string, filled: boolean): SVGSVGElement {
    const svg = doc.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("class", "zam-linkpill-icon");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const el = doc.createElementNS(SVG_NS, "path");
    el.setAttribute("d", path);
    if (filled) {
        el.setAttribute("fill", "currentColor");
    } else {
        el.setAttribute("fill", "none");
        el.setAttribute("stroke", "currentColor");
        el.setAttribute("stroke-width", "2.5");
        el.setAttribute("stroke-linecap", "round");
        el.setAttribute("stroke-linejoin", "round");
    }
    svg.appendChild(el);
    return svg;
}

function renderLabel(anchor: HTMLElement, label: PillLabel, text: PillText) {
    const doc = anchor.ownerDocument;
    const span = (cls: string, content: string) => {
        const el = doc.createElement("span");
        el.className = cls;
        el.textContent = content;
        return el;
    };
    const nodes: Node[] = [];
    if (label.kind === "room") {
        nodes.push(span("zam-linkpill-hash", "#"));
        nodes.push(span("zam-linkpill-text", label.name));
    } else if (label.kind === "dm") {
        const initial = span(
            "zam-linkpill-avatar zam-linkpill-initial",
            Array.from(label.name)[0]?.toUpperCase() ?? "?",
        );
        initial.setAttribute("aria-hidden", "true");
        if (label.avatarUrl) {
            const img = doc.createElement("img");
            img.className = "zam-linkpill-avatar";
            img.alt = "";
            img.decoding = "async";
            img.draggable = false;
            img.src = label.avatarUrl;
            img.addEventListener("error", () => img.replaceWith(initial), {
                once: true,
            });
            nodes.push(img);
        } else {
            nodes.push(initial);
        }
        nodes.push(span("zam-linkpill-text", label.name));
    } else {
        nodes.push(icon(doc, BUBBLE_PATH, true));
        nodes.push(span("zam-linkpill-text", text.viewMessage));
    }
    // A named room or DM ends in a chevron and speech bubble, the way Discord
    // marks a link to a message rather than to the channel itself.
    if (label.kind !== "unknown") {
        nodes.push(icon(doc, CHEVRON_PATH, false));
        nodes.push(icon(doc, BUBBLE_PATH, true));
    }
    anchor.replaceChildren(...nodes);
    anchor.setAttribute(
        "aria-label",
        label.kind === "unknown" ? text.aria : text.ariaIn(label.name),
    );
}

export function installMessageLinkPills(
    zam: ZamPluginApi,
    labelFor: (roomOrAlias: string) => PillLabel,
    text: PillText,
): { dispose(): void; refresh(): void } {
    let disposed = false;
    const saved = new Map<HTMLElement, Saved>();
    const pairings = new Map<HTMLElement, Pairing>();
    const pairQueued = new Set<HTMLElement>();

    function applyLabel(anchor: HTMLElement, force: boolean) {
        const entry = saved.get(anchor);
        const target = parseMessagePermalink(anchor.getAttribute("href"));
        if (!entry || !target) return;
        const label = labelFor(target.roomOrAlias);
        const key = pillLabelKey(label);
        if (!force && key === entry.labelKey) return;
        entry.labelKey = key;
        renderLabel(anchor, label, text);
    }

    function pillOne(anchor: HTMLElement) {
        if (disposed || saved.has(anchor)) return;
        const href = anchor.getAttribute("href") ?? "";
        const original = anchor.textContent ?? "";
        if (!shouldPillAnchor(href, original)) return;
        saved.set(anchor, {
            text: original,
            title: anchor.getAttribute("title"),
            ariaLabel: anchor.getAttribute("aria-label"),
            labelKey: "",
        });
        anchor.classList.add("zam-linkpill");
        anchor.setAttribute("title", href.trim());
        applyLabel(anchor, true);
    }

    function unpillOne(anchor: HTMLElement) {
        const original = saved.get(anchor);
        saved.delete(anchor);
        if (!original) return;
        try {
            anchor.textContent = original.text;
            anchor.classList.remove("zam-linkpill", "zam-linkpill-hot");
            anchor.removeAttribute("data-zam-linkpill-embed");
            if (original.title === null) anchor.removeAttribute("title");
            else anchor.setAttribute("title", original.title);
            if (original.ariaLabel === null)
                anchor.removeAttribute("aria-label");
            else anchor.setAttribute("aria-label", original.ariaLabel);
        } catch {
            // The anchor may already be gone; nothing to restore.
        }
    }

    /** Quoted-message cards: buttons with a text line and an sr-only label. */
    function findMessageEmbeds(row: HTMLElement): HTMLElement[] {
        return Array.from(row.querySelectorAll<HTMLElement>("button")).filter(
            (b) => b.querySelector("p") && b.querySelector("span.sr-only"),
        );
    }

    function clearPairing(row: HTMLElement) {
        const pairing = pairings.get(row);
        if (!pairing) return;
        pairings.delete(row);
        pairing.controller.abort();
        for (const pill of pairing.pills)
            pill.classList.remove("zam-linkpill-hot");
        for (const embed of pairing.embeds) {
            embed.classList.remove("zam-linkpill-target-hot");
            embed.removeAttribute("data-zam-linkpill-embed");
        }
    }

    function pairRow(row: HTMLElement) {
        if (disposed) return;
        clearPairing(row);
        if (!row.isConnected) return;
        const anchors = Array.from(
            row.querySelectorAll<HTMLElement>("a[href]"),
        );
        const distinct = distinctMessagePermalinks(
            anchors.map((a) => a.getAttribute("href") ?? ""),
        );
        if (distinct.length === 0) return;
        // A card whose room can't be read never renders; pairing by position
        // is only safe once every card is present.
        const embeds = findMessageEmbeds(row);
        if (embeds.length !== distinct.length) return;

        const controller = new AbortController();
        const { signal } = controller;
        const pills: HTMLElement[] = [];
        for (const anchor of anchors) {
            const index = embedIndexForHref(
                distinct,
                anchor.getAttribute("href") ?? "",
            );
            if (index === -1) continue;
            anchor.setAttribute("data-zam-linkpill-embed", String(index));
            if (anchor.classList.contains("zam-linkpill")) pills.push(anchor);
        }
        embeds.forEach((embed, index) =>
            embed.setAttribute("data-zam-linkpill-embed", String(index)),
        );
        const setHot = (index: string, on: boolean) => {
            for (const pill of pills)
                if (pill.getAttribute("data-zam-linkpill-embed") === index)
                    pill.classList.toggle("zam-linkpill-hot", on);
            for (const embed of embeds)
                if (embed.getAttribute("data-zam-linkpill-embed") === index)
                    embed.classList.toggle("zam-linkpill-target-hot", on);
        };
        for (const el of [...pills, ...embeds]) {
            const index = el.getAttribute("data-zam-linkpill-embed") ?? "";
            const on = () => setHot(index, true);
            const off = () => setHot(index, false);
            el.addEventListener("mouseenter", on, { signal });
            el.addEventListener("mouseleave", off, { signal });
            el.addEventListener("focus", on, { signal });
            el.addEventListener("blur", off, { signal });
        }
        pairings.set(row, { controller, pills, embeds });
    }

    function schedulePair(row: HTMLElement) {
        if (disposed || pairQueued.has(row)) return;
        pairQueued.add(row);
        requestAnimationFrame(() => {
            pairQueued.delete(row);
            try {
                pairRow(row);
            } catch {
                // Pairing is cosmetic; never let it break the timeline.
            }
        });
    }

    function forgetRow(row: HTMLElement) {
        clearPairing(row);
        for (const anchor of row.querySelectorAll<HTMLElement>(
            "a.zam-linkpill",
        ))
            saved.delete(anchor);
    }

    const disposables: Disposable[] = [];
    disposables.push(
        zam.dom.observe(ROW_SELECTOR, {
            added(row) {
                for (const a of row.querySelectorAll<HTMLElement>("a[href]"))
                    pillOne(a);
                schedulePair(row);
                return () => forgetRow(row);
            },
        }),
    );
    disposables.push(
        zam.dom.observe(LINK_SELECTOR, {
            added(anchor) {
                const row = anchor.closest<HTMLElement>("[data-event-id]");
                pillOne(anchor);
                if (row) schedulePair(row);
                return () => {
                    saved.delete(anchor);
                    if (row) schedulePair(row);
                };
            },
        }),
    );
    disposables.push(
        zam.dom.observe(EMBED_BUTTON_SELECTOR, {
            added(el) {
                const row = el.closest<HTMLElement>("[data-event-id]");
                if (row) schedulePair(row);
                return () => {
                    if (row) schedulePair(row);
                };
            },
        }),
    );

    let refreshQueued = false;
    return {
        /** Re-label every pill whose room name, DM state or avatar changed. */
        refresh() {
            if (disposed || refreshQueued) return;
            refreshQueued = true;
            requestAnimationFrame(() => {
                refreshQueued = false;
                if (disposed) return;
                for (const anchor of [...saved.keys()]) {
                    try {
                        applyLabel(anchor, false);
                    } catch {
                        // Leave this pill as it was.
                    }
                }
            });
        },
        dispose() {
            disposed = true;
            for (const d of disposables) d.dispose();
            disposables.length = 0;
            for (const row of [...pairings.keys()]) clearPairing(row);
            pairQueued.clear();
            for (const anchor of [...saved.keys()]) unpillOne(anchor);
        },
    };
}
