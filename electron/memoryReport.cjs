// Settings > Debug memory report: where Chromium's memory goes, by process
// and allocator. It records a moment of the memory-infra trace category (what
// chrome://tracing's memory view reads), which breaks the GPU process down
// into textures, shared images, transfer buffers and so on, and the renderer
// into tile memory, image caches, V8 and the DOM. Task Manager only shows a
// total, which says nothing about what to fix.

const fs = require("fs");
const path = require("path");

// Allocators below this are noise in a report read by eye.
const MIN_BYTES = 512 * 1024;

/**
 * Turn a memory-infra trace's events into, per process, its allocators down
 * to two levels (`gpu`, `gpu/shared_images`), largest first. A parent's size
 * includes its children's. Uses the last dump, which every process answered.
 */
function summarizeMemoryTrace(events) {
    const names = {};
    for (const e of events) {
        if (e.ph === "M" && e.name === "process_name") {
            names[e.pid] = e.args?.name;
        }
    }
    // One dump arrives as an event per process, sharing an id.
    const dumps = new Map();
    for (const e of events) {
        if (e.ph !== "v" || !e.args?.dumps?.allocators) continue;
        if (!dumps.has(e.id)) dumps.set(e.id, new Map());
        const perPid = dumps.get(e.id);
        perPid.set(e.pid, {
            ...perPid.get(e.pid),
            ...e.args.dumps.allocators,
        });
    }
    const last = [...dumps.values()].pop();
    if (!last) return [];
    const processes = [];
    for (const [pid, allocators] of last) {
        const rows = [];
        for (const [name, dump] of Object.entries(allocators)) {
            const size = dump?.attrs?.size;
            if (!size || name.startsWith("global/") || name === "global") {
                continue;
            }
            if (name.split("/").length > 2) continue;
            const bytes = parseInt(size.value, 16);
            if (bytes >= MIN_BYTES) rows.push([name, bytes]);
        }
        rows.sort((a, b) => b[1] - a[1]);
        processes.push({
            pid: Number(pid),
            name: names[pid] ?? `pid ${pid}`,
            allocators: rows,
        });
    }
    return processes;
}

/** Record ~1.5 s of memory-infra dumps and summarize the last one. */
async function recordMemoryReport(contentTracing, tmpDir) {
    await contentTracing.startRecording({
        included_categories: ["disabled-by-default-memory-infra"],
        excluded_categories: ["*"],
        memory_dump_config: {
            triggers: [{ mode: "detailed", periodic_interval_ms: 500 }],
        },
    });
    await new Promise((r) => setTimeout(r, 1500));
    const file = await contentTracing.stopRecording(
        path.join(tmpDir, `zam-memory-${process.pid}-${Date.now()}.json`),
    );
    try {
        const trace = JSON.parse(await fs.promises.readFile(file, "utf8"));
        return summarizeMemoryTrace(trace.traceEvents ?? trace);
    } finally {
        fs.promises.rm(file, { force: true }).catch(() => {});
    }
}

module.exports = { summarizeMemoryTrace, recordMemoryReport };
