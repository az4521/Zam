/**
 * State of the one-shot full search-index build, kept here (not in the debug
 * panel) so a run keeps going and stays visible when the settings modal closes.
 * stopEventIndex aborts a run in progress (sign-out, account switch, setting off).
 */
import {
    buildFullIndex,
    type FullIndexProgress,
    type FullIndexResult,
} from "$lib/matrix/eventIndex";

export type IndexBuildState =
    | { status: "idle" }
    | { status: "running"; progress: FullIndexProgress }
    | { status: "finished"; result: FullIndexResult };

const EMPTY_PROGRESS: FullIndexProgress = {
    roomsDone: 0,
    roomsTotal: 0,
    pages: 0,
    messagesIndexed: 0,
};

export const indexBuild = $state<{ value: IndexBuildState }>({
    value: { status: "idle" },
});

let controller: AbortController | null = null;

/** Start a full build. A no-op while one is already running. */
export function startFullIndexBuild(): void {
    if (indexBuild.value.status === "running") return;
    const ctl = new AbortController();
    controller = ctl;
    indexBuild.value = {
        status: "running",
        progress: { ...EMPTY_PROGRESS },
    };
    buildFullIndex({
        signal: ctl.signal,
        onProgress: (progress) => {
            if (controller === ctl)
                indexBuild.value = { status: "running", progress };
        },
    })
        .then((result) => {
            if (controller !== ctl) return;
            controller = null;
            indexBuild.value = { status: "finished", result };
        })
        .catch((e) => {
            console.warn("[indexBuild] failed", e);
            if (controller !== ctl) return;
            controller = null;
            indexBuild.value = {
                status: "finished",
                result: {
                    reason: "unavailable",
                    progress: { ...EMPTY_PROGRESS },
                    failedRooms: 0,
                },
            };
        });
}

/** Ask the running build to stop. It finishes with reason "aborted". */
export function cancelFullIndexBuild(): void {
    controller?.abort();
}
