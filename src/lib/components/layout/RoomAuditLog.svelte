<script lang="ts">
    import { t, getLocale, type MessageKey } from "$lib/i18n";
    import { untrack } from "svelte";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import {
        fetchRoomAuditPage,
        getKnownUserDisplayName,
        getMemberAvatar,
        getRoom,
        getRoomDisplayName,
    } from "$lib/matrix/client";
    import { roomsState } from "$lib/stores/rooms.svelte";
    import { settingsState } from "$lib/stores/settings.svelte";
    import { showErrorToast } from "$lib/stores/toasts.svelte";
    import {
        AUDIT_FILTERS,
        filterEntries,
        pickAuditName,
        toAuditEntries,
        type AuditEntry,
        type AuditFilter,
    } from "$lib/utils/auditLog";
    import { relativeTimeParts } from "$lib/utils/inlineTimestamp";

    let { roomId, isSpace = false }: { roomId: string; isSpace?: boolean } =
        $props();

    /** Events per /messages request. */
    const PAGE_SIZE = 50;
    /**
     * One click (or the first load) keeps reading pages past ones that show
     * nothing under the current filter, so a filter does not look empty while
     * older matches exist. Bounded so a long quiet history cannot hang the tab.
     */
    const MAX_PAGES_PER_READ = 4;

    let entries = $state<AuditEntry[]>([]);
    let next = $state<string | null>(null);
    let status = $state<"loading" | "ready" | "error">("loading");
    let loadingMore = $state(false);
    let filter = $state<AuditFilter>("all");
    // Bumped on every reset so a response for an old room or attempt is dropped.
    let generation = 0;

    const visible = $derived(filterEntries(entries, filter));
    const rtf = new Intl.RelativeTimeFormat(getLocale(), { numeric: "auto" });

    /**
     * Room member name, then the name the event itself carried, then any name
     * the SDK knows for the user (other rooms), then the mxid.
     */
    function nameOf(userId: string, eventName?: string): string {
        void roomsState.roomsTick;
        if (settingsState.showMatrixIds) return userId;
        const member = getRoom(roomId)?.getMember(userId);
        return pickAuditName(userId, [
            member?.rawDisplayName || member?.name,
            eventName,
            getKnownUserDisplayName(userId),
        ]);
    }

    /** A room named by id (space children and parents): its name, else the id. */
    function roomLabel(roomIdToName: string): string {
        void roomsState.roomsTick;
        const r = getRoom(roomIdToName);
        return r ? getRoomDisplayName(r) : roomIdToName;
    }

    function targetLabel(e: AuditEntry): string {
        if (!e.targetId) return "";
        if (e.targetIsRoom) return roomLabel(e.targetId);
        return nameOf(e.targetId, e.targetName);
    }

    function avatarOf(userId: string): string | null {
        void roomsState.roomsTick;
        const r = getRoom(roomId);
        return r ? getMemberAvatar(r, userId) : null;
    }

    function sentence(e: AuditEntry): string {
        return t(`auditLog.${e.key}` as MessageKey, {
            // The event's own name only helps when the actor is the target.
            actor: nameOf(
                e.actorId,
                e.actorId === e.targetId ? e.targetName : undefined,
            ),
            target: targetLabel(e),
            value: e.value ?? "",
            detail: e.detail ?? "",
        });
    }

    function ago(ts: number): string {
        const { value, unit } = relativeTimeParts((ts - Date.now()) / 1000);
        return rtf.format(value, unit);
    }

    function absolute(ts: number): string {
        return new Date(ts).toLocaleString(getLocale());
    }

    /** Appends pages until one shows something under the filter, or history ends. */
    async function readPages(start: string | null, gen: number): Promise<void> {
        let cursor = start;
        for (let i = 0; i < MAX_PAGES_PER_READ; i++) {
            const res = await fetchRoomAuditPage(roomId, cursor, PAGE_SIZE);
            // The room changed or a reset started while this page was in flight.
            if (gen !== generation) return;
            const fresh = res.events.flatMap((ev) => toAuditEntries(ev));
            entries = [...entries, ...fresh];
            next = res.next;
            cursor = res.next;
            if (!res.next || filterEntries(fresh, filter).length > 0) return;
        }
    }

    function reset() {
        generation += 1;
        const gen = generation;
        entries = [];
        next = null;
        status = "loading";
        loadingMore = false;
        readPages(null, gen)
            .then(() => {
                if (gen === generation) status = "ready";
            })
            .catch(() => {
                if (gen !== generation) return;
                if (entries.length === 0) {
                    status = "error";
                } else {
                    status = "ready";
                }
                showErrorToast(t("auditLog.loadFailed"));
            });
    }

    function loadMore() {
        if (loadingMore || !next) return;
        const gen = generation;
        loadingMore = true;
        readPages(next, gen)
            .catch(() => {
                if (gen === generation)
                    showErrorToast(t("auditLog.loadFailed"));
            })
            .finally(() => {
                if (gen === generation) loadingMore = false;
            });
    }

    // Start over when the room changes; reading roomId here is what tracks it.
    $effect(() => {
        void roomId;
        untrack(() => reset());
    });
</script>

<div class="space-y-4">
    <p class="text-xs text-zam-textMuted">
        {t(isSpace ? "auditLog.introSpace" : "auditLog.intro")}
    </p>

    <div
        role="group"
        aria-label={t("auditLog.filtersLabel")}
        class="flex flex-wrap gap-2"
    >
        {#each AUDIT_FILTERS as f (f)}
            <button
                type="button"
                aria-pressed={filter === f}
                onclick={() => (filter = f)}
                class="px-3 py-1 rounded-full text-xs border border-zam-border transition-colors"
                class:bg-zam-messageHover={filter === f}
                class:text-zam-textPrimary={filter === f}
                class:text-zam-textMuted={filter !== f}
                >{t(`auditLog.filter.${f}` as MessageKey)}</button
            >
        {/each}
    </div>

    {#if status === "loading"}
        <p class="text-sm text-zam-textMuted">{t("auditLog.loading")}</p>
    {:else if status === "error"}
        <div class="space-y-2">
            <p class="text-sm text-zam-textPrimary" role="alert">
                {t("auditLog.loadFailed")}
            </p>
            <button
                type="button"
                onclick={reset}
                class="px-3 py-1 rounded text-sm bg-zam-messageHover text-zam-textPrimary"
                >{t("auditLog.retry")}</button
            >
        </div>
    {:else}
        {#if visible.length > 0}
            <ul class="divide-y divide-zam-border">
                {#each visible as e (`${e.id}|${e.key}|${e.targetId ?? ""}`)}
                    <li class="flex items-start gap-3 py-3">
                        <Avatar
                            src={avatarOf(e.actorId)}
                            name={nameOf(
                                e.actorId,
                                e.actorId === e.targetId
                                    ? e.targetName
                                    : undefined,
                            )}
                            id={e.actorId}
                            size={28}
                        />
                        <div class="min-w-0 flex-1 space-y-0.5">
                            <p class="text-sm text-zam-textPrimary break-words">
                                {sentence(e)}
                            </p>
                            {#if e.reason}
                                <p
                                    class="text-xs text-zam-textMuted break-words"
                                >
                                    {t("auditLog.reason", { reason: e.reason })}
                                </p>
                            {/if}
                            <time
                                datetime={new Date(e.ts).toISOString()}
                                title={absolute(e.ts)}
                                class="text-xs text-zam-textMuted"
                                >{ago(e.ts)}</time
                            >
                        </div>
                    </li>
                {/each}
            </ul>
        {/if}

        {#if next}
            <button
                type="button"
                onclick={loadMore}
                disabled={loadingMore}
                class="px-3 py-1.5 rounded text-sm bg-zam-messageHover text-zam-textPrimary disabled:opacity-60"
                >{loadingMore
                    ? t("auditLog.loadingMore")
                    : t("auditLog.loadMore")}</button
            >
        {:else if visible.length === 0}
            <p class="text-sm text-zam-textMuted">{t("auditLog.empty")}</p>
        {/if}
    {/if}
</div>
