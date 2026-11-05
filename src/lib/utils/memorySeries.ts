// Settings > Debug memory recording: reports taken on an interval by the
// desktop main process (electron/main.cjs), summarized per process and
// allocator so growth shows up as a change instead of one moment's size.

export interface MemoryProcess {
    pid: number;
    name: string;
    /** [allocator, bytes], largest first. */
    allocators: [string, number][];
    workingSetKb: number | null;
}

export type MemorySample = { at: number } & (
    { processes: MemoryProcess[] } | { error: string }
);

export interface Range {
    first: number;
    min: number;
    max: number;
    last: number;
}

export interface ProcessSeries {
    key: string;
    workingSet: Range | null;
    /** Largest peak first. */
    allocators: [string, Range][];
}

function add(range: Range | undefined, v: number): Range {
    if (!range) return { first: v, min: v, max: v, last: v };
    range.min = Math.min(range.min, v);
    range.max = Math.max(range.max, v);
    range.last = v;
    return range;
}

/** Names a process the same way across samples: by its name, plus its pid
 *  only when the sample has others of that name (renderers). A GPU process
 *  restarted under a new pid stays one series. */
export function processKeys(processes: MemoryProcess[]): string[] {
    const counts = new Map<string, number>();
    for (const p of processes) {
        counts.set(p.name, (counts.get(p.name) ?? 0) + 1);
    }
    return processes.map((p) =>
        counts.get(p.name)! > 1 ? `${p.name} ${p.pid}` : p.name,
    );
}

export function summarizeMemorySeries(
    samples: MemorySample[],
): ProcessSeries[] {
    const byKey = new Map<
        string,
        { workingSet?: Range; allocators: Map<string, Range> }
    >();
    for (const s of samples) {
        if (!("processes" in s)) continue;
        const keys = processKeys(s.processes);
        s.processes.forEach((p, i) => {
            let entry = byKey.get(keys[i]);
            if (!entry) byKey.set(keys[i], (entry = { allocators: new Map() }));
            if (p.workingSetKb != null) {
                entry.workingSet = add(entry.workingSet, p.workingSetKb * 1024);
            }
            for (const [name, bytes] of p.allocators) {
                entry.allocators.set(
                    name,
                    add(entry.allocators.get(name), bytes),
                );
            }
        });
    }
    return [...byKey]
        .map(([key, e]) => ({
            key,
            workingSet: e.workingSet ?? null,
            allocators: [...e.allocators].sort((a, b) => b[1].max - a[1].max),
        }))
        .sort((a, b) => (b.workingSet?.max ?? 0) - (a.workingSet?.max ?? 0));
}

const mb = (bytes: number) => (bytes / 1048576).toFixed(1);
const signed = (bytes: number) => (bytes >= 0 ? "+" : "") + mb(bytes);

/** The summary as plain text for a bug report, sizes in MB. */
export function memorySeriesText(
    samples: MemorySample[],
    allocatorsPerProcess = 15,
): string {
    const ok = samples.filter((s) => "processes" in s);
    if (!ok.length) return "";
    const span = ok[ok.length - 1].at - ok[0].at;
    const time = (at: number) => new Date(at).toLocaleTimeString();
    const head = `${ok.length} samples, ${time(ok[0].at)} to ${time(ok[ok.length - 1].at)} (${Math.round(span / 60000)} min)${
        ok.length < samples.length
            ? `, ${samples.length - ok.length} failed`
            : ""
    }`;
    const cols = (r: Range) =>
        [
            mb(r.first),
            mb(r.min),
            mb(r.max),
            mb(r.last),
            signed(r.last - r.first),
        ]
            .map((c) => c.padStart(9))
            .join("");
    const blocks = summarizeMemorySeries(samples).map((p) =>
        [
            `${p.key}${p.workingSet ? `, working set ${mb(p.workingSet.last)} MB` : ""}`,
            `${["first", "min", "max", "last", "change"].map((c) => c.padStart(9)).join("")}`,
            ...(p.workingSet ? [`${cols(p.workingSet)}  (working set)`] : []),
            ...p.allocators
                .slice(0, allocatorsPerProcess)
                .map(([name, r]) => `${cols(r)}  ${name}`),
        ].join("\n"),
    );
    return [head, "Sizes in MB.", ...blocks].join("\n\n");
}

const csvCell = (v: string) =>
    /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;

/** Every sample as a row and every process/allocator as a column, in bytes,
 *  for graphing in a spreadsheet. */
export function memorySeriesCsv(samples: MemorySample[]): string {
    const columns: string[] = [];
    const index = new Map<string, number>();
    const rows: Map<number, number>[] = [];
    const col = (name: string) => {
        let i = index.get(name);
        if (i === undefined) {
            index.set(name, (i = columns.length));
            columns.push(name);
        }
        return i;
    };
    for (const s of samples) {
        const row = new Map<number, number>();
        rows.push(row);
        if (!("processes" in s)) continue;
        const keys = processKeys(s.processes);
        s.processes.forEach((p, i) => {
            if (p.workingSetKb != null) {
                row.set(col(`${keys[i]}/working_set`), p.workingSetKb * 1024);
            }
            for (const [name, bytes] of p.allocators) {
                row.set(col(`${keys[i]}/${name}`), bytes);
            }
        });
    }
    const lines = [["time", ...columns].map(csvCell).join(",")];
    samples.forEach((s, r) => {
        lines.push(
            [
                new Date(s.at).toISOString(),
                ...columns.map((_, i) => String(rows[r].get(i) ?? "")),
            ].join(","),
        );
    });
    return lines.join("\n") + "\n";
}
