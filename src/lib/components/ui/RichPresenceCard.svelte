<script lang="ts">
    import { t } from "$lib/i18n";
    import { onMount } from "svelte";
    import ModalDialog from "$lib/components/ui/ModalDialog.svelte";
    import { fetchOpenIdToken, mxcToHttp } from "$lib/matrix/client";
    import {
        fillOpenidPlaceholder,
        type RpcButton,
        type RpcEntry,
    } from "$lib/utils/richPresence";

    // What a user is doing, from the entries in their `m.rpc` profile field
    // (MSC4544). Buttons never open on their own: each click asks first, with
    // the full address shown.

    interface Props {
        entries: RpcEntry[];
    }

    let { entries }: Props = $props();

    // Elapsed and remaining times tick once a second, but only while an entry
    // has a time to count.
    let now = $state(Date.now());
    const needsClock = $derived(
        entries.some((e) =>
            e.kind === "activity"
                ? e.since !== undefined || e.until !== undefined
                : e.progress !== undefined,
        ),
    );
    onMount(() => {
        const timer = setInterval(() => {
            if (needsClock) now = Date.now();
        }, 1000);
        return () => clearInterval(timer);
    });

    function clock(ms: number): string {
        const total = Math.max(0, Math.floor(ms / 1000));
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;
        const pad = (n: number) => String(n).padStart(2, "0");
        return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
    }

    function bounds(
        e: RpcEntry,
    ): { since?: number; until?: number } | undefined {
        if (e.kind === "music") return e.progress;
        return { since: e.since, until: e.until };
    }

    function fraction(since: number, until: number): number {
        return Math.min(1, Math.max(0, (now - since) / (until - since)));
    }

    let pending = $state<{
        appName: string;
        url: string;
        openid: boolean;
    } | null>(null);
    let failed = $state(false);

    async function onButton(entry: RpcEntry, button: RpcButton): Promise<void> {
        failed = false;
        let url = button.url;
        if (button.requestOpenid) {
            try {
                url = fillOpenidPlaceholder(url, await fetchOpenIdToken());
            } catch {
                failed = true;
                return;
            }
        }
        pending = {
            appName: entry.kind === "activity" ? entry.name : entry.track,
            url,
            openid: button.requestOpenid,
        };
    }

    function confirmOpen(): void {
        if (pending) window.open(pending.url, "_blank", "noopener,noreferrer");
        pending = null;
    }
</script>

{#each entries as entry (entry.id)}
    {@const span = bounds(entry)}
    {@const art =
        entry.kind === "activity" ? entry.largeIconUrl : entry.coverUrl}
    <div class="mt-2 flex gap-2 rounded bg-discord-backgroundTertiary p-2">
        {#if art}
            <div class="relative h-12 w-12 flex-shrink-0">
                <img
                    class="h-12 w-12 rounded object-cover"
                    src={mxcToHttp(art, 96, 96, "crop")}
                    alt=""
                    title={entry.kind === "activity"
                        ? entry.largeIconTooltip
                        : undefined}
                />
                {#if entry.kind === "activity" && entry.smallIconUrl}
                    <img
                        class="absolute -bottom-1 -end-1 h-5 w-5 rounded-full border-2 border-discord-backgroundTertiary object-cover"
                        src={mxcToHttp(entry.smallIconUrl, 40, 40, "crop")}
                        alt=""
                        title={entry.smallIconTooltip}
                    />
                {/if}
            </div>
        {/if}
        <div class="min-w-0 flex-1 text-xs text-discord-textSecondary">
            {#if entry.kind === "activity"}
                <p class="truncate font-semibold text-discord-textPrimary">
                    {t("richPresenceCard.playing", { name: entry.name })}
                </p>
                {#if entry.details}<p class="truncate">{entry.details}</p>{/if}
                {#if entry.state}<p class="truncate">{entry.state}</p>{/if}
            {:else}
                <p class="truncate font-semibold text-discord-textPrimary">
                    {entry.track}
                </p>
                {#if entry.artist}<p class="truncate">{entry.artist}</p>{/if}
                {#if entry.album}<p class="truncate">{entry.album}</p>{/if}
                {#if entry.playerName}
                    <p class="truncate text-discord-textMuted">
                        {t("richPresenceCard.listening", {
                            name: entry.playerName,
                        })}
                    </p>
                {/if}
            {/if}

            {#if span?.since !== undefined && span?.until !== undefined}
                <div
                    class="mt-1 h-1 overflow-hidden rounded bg-discord-backgroundSecondary"
                    role="progressbar"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    aria-valuenow={Math.round(
                        fraction(span.since, span.until) * 100,
                    )}
                >
                    <div
                        class="h-full bg-discord-accent"
                        style:width="{fraction(span.since, span.until) * 100}%"
                    ></div>
                </div>
            {:else if span?.since !== undefined}
                <p class="text-discord-textMuted">
                    {t("richPresenceCard.elapsed", {
                        time: clock(now - span.since),
                    })}
                </p>
            {:else if span?.until !== undefined}
                <p class="text-discord-textMuted">
                    {t("richPresenceCard.remaining", {
                        time: clock(span.until - now),
                    })}
                </p>
            {/if}

            {#if entry.buttons.length > 0}
                <div class="mt-1 flex flex-wrap gap-1">
                    {#each entry.buttons as button (button.label + button.url)}
                        <button
                            type="button"
                            class="rounded bg-discord-backgroundSecondary px-2 py-0.5 text-discord-textPrimary hover:bg-discord-backgroundSecondaryAlt"
                            onclick={() => onButton(entry, button)}
                        >
                            {button.label}
                        </button>
                    {/each}
                </div>
            {/if}
        </div>
    </div>
{/each}

{#if failed}
    <p class="mt-1 text-xs text-discord-danger">
        {t("richPresenceCard.openFailed")}
    </p>
{/if}

{#if pending}
    <ModalDialog
        onClose={() => (pending = null)}
        labelledBy="rpc-open-title"
        panelClass="relative w-full max-w-sm rounded-lg bg-discord-backgroundSecondary p-4 shadow-xl"
    >
        <h2
            id="rpc-open-title"
            class="mb-2 text-base font-semibold text-discord-textPrimary"
        >
            {t("richPresenceCard.openLinkTitle")}
        </h2>
        <p class="text-sm text-discord-textSecondary">
            {t("richPresenceCard.openLinkBody", { name: pending.appName })}
        </p>
        <p
            class="my-2 max-h-32 overflow-y-auto break-all rounded bg-discord-backgroundTertiary p-2 text-xs text-discord-textPrimary"
        >
            {pending.url}
        </p>
        {#if pending.openid}
            <p class="mb-2 text-xs text-discord-danger">
                {t("richPresenceCard.openidWarning")}
            </p>
        {/if}
        <div class="flex justify-end gap-2">
            <button
                type="button"
                class="px-3 py-1 text-sm text-discord-textMuted hover:text-discord-textPrimary"
                onclick={() => (pending = null)}
            >
                {t("common.cancel")}
            </button>
            <button
                type="button"
                class="rounded bg-discord-accent px-3 py-1 text-sm text-white"
                onclick={confirmOpen}
            >
                {t("richPresenceCard.open")}
            </button>
        </div>
    </ModalDialog>
{/if}
