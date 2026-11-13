// Continuous-scroll smoothness probe for the timeline. Paste into the
// browser console (or a devtools snippet) with a room open, then call
//   await scrollProbe.run({ step: -12, frames: 300 })
// (negative step = scroll up into history). It moves the timeline by
// `step` px every animation frame, like a finger dragging at a steady
// speed, and checks each frame how far a message on screen actually moved.
// Any frame where content moved by something other than `step` is a
// visible jerk; the report says what changed in that frame.
(() => {
    const timeline = () =>
        document.querySelector('[data-zam-region="timeline"]');

    async function run({ step = -12, frames = 300 } = {}) {
        const el = timeline();
        if (!el) throw new Error("no timeline");
        const proto = Object.getOwnPropertyDescriptor(
            Element.prototype,
            "scrollTop",
        );
        let driving = false;
        let frameNo = 0;
        const appWrites = [];
        Object.defineProperty(el, "scrollTop", {
            configurable: true,
            get() {
                return proto.get.call(this);
            },
            set(v) {
                if (!driving)
                    appWrites.push({
                        frame: frameNo,
                        by: Math.round(v - proto.get.call(this)),
                        from: (new Error().stack.split("\n")[2] || "")
                            .trim()
                            .split(" ")[1],
                    });
                proto.set.call(this, v);
            },
        });
        // What changed size, mounted or unmounted, per frame.
        const changes = new Map();
        const note = (msg) => {
            const list = changes.get(frameNo) ?? [];
            if (list.length < 6) list.push(msg);
            changes.set(frameNo, list);
        };
        const sizes = new WeakMap();
        const ro = new ResizeObserver((entries) => {
            for (const e of entries) {
                const h = Math.round(e.borderBoxSize?.[0]?.blockSize ?? 0);
                const prev = sizes.get(e.target);
                sizes.set(e.target, h);
                if (prev !== undefined && prev !== h)
                    note(
                        `resize row ${e.target.dataset.rowIndex} ${prev}->${h} ${describe(e.target)}`,
                    );
            }
        });
        const watchRows = () => {
            for (const r of el.querySelectorAll("[data-row-index]"))
                if (!sizes.has(r)) {
                    sizes.set(r, Math.round(r.getBoundingClientRect().height));
                    ro.observe(r);
                }
        };
        const mo = new MutationObserver((recs) => {
            for (const rec of recs) {
                for (const n of rec.addedNodes)
                    if (n.dataset?.rowIndex !== undefined)
                        note(`mount row ${n.dataset.rowIndex}`);
                for (const n of rec.removedNodes)
                    if (n.dataset?.rowIndex !== undefined)
                        note(`unmount row ${n.dataset.rowIndex}`);
            }
            watchRows();
        });
        mo.observe(el, { childList: true });
        watchRows();

        // Track a row near the middle; re-pick when it leaves the screen.
        const pick = () => {
            const v = el.getBoundingClientRect();
            const mid = (v.top + v.bottom) / 2;
            let best = null;
            for (const r of el.querySelectorAll("[data-row-index]")) {
                const b = r.getBoundingClientRect();
                if (b.bottom > v.top + 40 && b.top < v.bottom - 40) {
                    if (
                        !best ||
                        Math.abs(b.top - mid) < Math.abs(best.top - mid)
                    )
                        best = { row: r, top: b.top };
                }
            }
            return best?.row ?? null;
        };
        const jerks = [];
        let row = null;
        let lastTop = 0;
        let applied = 0;
        const t0 = performance.now();
        for (frameNo = 0; frameNo < frames; frameNo++) {
            await new Promise((r) => requestAnimationFrame(r));
            if (row && row.isConnected) {
                const top = row.getBoundingClientRect().top;
                const moved = top - lastTop; // content moves opposite to scroll
                const expected = -applied;
                if (Math.abs(moved - expected) > 1.5)
                    jerks.push({
                        frame: frameNo,
                        expected: Math.round(expected),
                        moved: Math.round(moved),
                        row: row.dataset.rowIndex,
                        nativeAnchor:
                            el.querySelector(
                                '[data-row-index][style*="overflow-anchor"]',
                            )?.dataset.rowIndex ?? null,
                        spacer: Math.round(
                            el
                                .querySelector("[data-row-index]")
                                ?.previousElementSibling?.getBoundingClientRect()
                                .height ?? -1,
                        ),
                        spinner: !!el.querySelector('[role="status"]'),
                        scrollTop: Math.round(proto.get.call(el)),
                        changes: [
                            ...(changes.get(frameNo - 1) ?? []),
                            ...(changes.get(frameNo) ?? []),
                        ],
                        writes: appWrites.filter((w) => w.frame >= frameNo - 1),
                    });
            }
            if (!row || !row.isConnected) row = pick();
            else {
                const b = row.getBoundingClientRect();
                const v = el.getBoundingClientRect();
                if (b.bottom < v.top + 40 || b.top > v.bottom - 40)
                    row = pick();
            }
            lastTop = row ? row.getBoundingClientRect().top : 0;
            const before = proto.get.call(el);
            driving = true;
            proto.set.call(el, before + step);
            driving = false;
            applied = proto.get.call(el) - before;
            if (applied === 0 && step < 0 && before === 0) break; // at the top
        }
        ro.disconnect();
        mo.disconnect();
        delete el.scrollTop;
        const ms = performance.now() - t0;
        return {
            frames: frameNo,
            msPerFrame: +(ms / Math.max(1, frameNo)).toFixed(1),
            jerkFrames: jerks.length,
            worst: jerks
                .slice()
                .sort(
                    (a, b) =>
                        Math.abs(b.moved - b.expected) -
                        Math.abs(a.moved - a.expected),
                )
                .slice(0, 8),
            appWrites: appWrites.length,
        };
    }

    function describe(row) {
        const ev = row.querySelector("[data-event-id]");
        return (ev?.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 30);
    }

    window.scrollProbe = { run };
})();
