<script lang="ts">
    import { t } from "$lib/i18n";
    import { Gamepad2 } from "lucide-svelte";
    import type { MessageKey } from "$lib/i18n/en";
    import { steamIconUrl, type ParsedGameInvite } from "$lib/utils/gameInvite";

    interface Props {
        invite: ParsedGameInvite;
    }

    let { invite }: Props = $props();

    type JoinError = "unsupported" | "invalid";
    const JOIN_ERROR: Record<JoinError, MessageKey> = {
        unsupported: "gameInvite.joinUnsupported",
        invalid: "gameInvite.joinInvalid",
    };

    // The game's icon when the invite has one and it loads; else the gamepad.
    let iconFailed = $state(false);
    const iconUrl = $derived(
        invite.steam.icon && !iconFailed
            ? steamIconUrl(invite.steam.appId, invite.steam.icon)
            : null,
    );

    let confirming = $state(false);
    let joining = $state(false);
    let joined = $state(false);
    let joinError = $state<MessageKey | null>(null);

    // Joining needs the desktop app's launcher; the browser has none.
    const canJoin = $derived(
        typeof window !== "undefined" &&
            typeof window.desktop?.richPresence?.joinGame === "function",
    );

    // Said in plain text: the arguments are shown exactly as they will run. A
    // lobby join (steam://joinlobby, see steamJoinLink) has no arguments.
    const viaLobby = $derived(!!(invite.steam.steamId && invite.steam.lobbyId));
    const confirmText = $derived(
        viaLobby
            ? t("gameInvite.confirmLobby", { game: invite.name })
            : t("gameInvite.confirmSteam", {
                  game: invite.name,
                  connect: invite.steam.connect ?? "",
              }),
    );

    async function join() {
        const bridge = window.desktop?.richPresence;
        if (!bridge?.joinGame || joining) return;
        joining = true;
        joinError = null;
        try {
            const res = await bridge.joinGame({
                kind: "steam",
                appId: invite.steam.appId,
                connect: invite.steam.connect,
                steamId: invite.steam.steamId,
                lobbyId: invite.steam.lobbyId,
            });
            if (res.ok) {
                joined = true;
                confirming = false;
            } else {
                joinError = JOIN_ERROR[res.error] ?? "gameInvite.joinFailed";
            }
        } catch {
            joinError = "gameInvite.joinFailed";
        } finally {
            joining = false;
        }
    }
</script>

<div
    class="mt-1 max-w-md rounded-lg border border-discord-divider bg-discord-backgroundSecondary px-3 py-2.5"
>
    <div class="flex items-center gap-2.5">
        {#if iconUrl}
            <img
                src={iconUrl}
                alt=""
                class="h-8 w-8 flex-shrink-0 rounded"
                loading="lazy"
                referrerpolicy="no-referrer"
                onerror={() => (iconFailed = true)}
            />
        {:else}
            <Gamepad2 size={20} class="flex-shrink-0 text-discord-textMuted" />
        {/if}
        <div class="min-w-0">
            <p class="text-xs text-discord-textMuted">
                {t("gameInvite.cardTitle")} · {t("gameInvite.sourceSteam")}
            </p>
            <p
                class="truncate text-sm font-semibold text-discord-textPrimary"
                title={invite.name}
            >
                {invite.name}
            </p>
        </div>
    </div>

    {#if invite.details || invite.state || invite.partySize}
        <div class="mt-2 flex flex-col gap-0.5">
            {#if invite.details}
                <p class="text-xs text-discord-textPrimary break-words">
                    {invite.details}
                </p>
            {/if}
            {#if invite.state}
                <p class="text-xs text-discord-textMuted break-words">
                    {invite.state}
                </p>
            {/if}
            {#if invite.partySize}
                <p class="text-xs text-discord-textMuted">
                    {t("gameInvite.partySize", {
                        current: invite.partySize[0],
                        max: invite.partySize[1],
                    })}
                </p>
            {/if}
        </div>
    {/if}

    {#if invite.note}
        <p
            class="mt-2 text-sm text-discord-textPrimary whitespace-pre-wrap break-words"
        >
            {invite.note}
        </p>
    {/if}

    {#if joined}
        <p class="mt-2 text-xs text-discord-textMuted">
            {t("gameInvite.joinSent")}
        </p>
    {:else if !canJoin}
        <p class="mt-2 text-xs text-discord-textMuted">
            {t("gameInvite.openInDesktop")}
        </p>
    {:else if confirming}
        <p class="mt-2 text-xs text-discord-textPrimary break-all">
            {confirmText}
        </p>
        <div class="mt-2 flex items-center gap-2">
            <button
                class="px-3 py-1.5 rounded bg-discord-accent hover:bg-discord-accentHover disabled:opacity-50 text-white text-xs font-semibold transition-colors"
                disabled={joining}
                onclick={join}
            >
                {joining ? t("common.joining") : t("gameInvite.joinGame")}
            </button>
            <button
                class="px-3 py-1.5 rounded text-xs text-discord-textMuted hover:text-discord-textPrimary transition-colors"
                disabled={joining}
                onclick={() => (confirming = false)}
            >
                {t("common.cancel")}
            </button>
        </div>
    {:else}
        <button
            class="mt-2 px-3 py-1.5 rounded bg-discord-accent hover:bg-discord-accentHover text-white text-xs font-semibold transition-colors"
            onclick={() => {
                joinError = null;
                confirming = true;
            }}
        >
            {t("common.join")}
        </button>
    {/if}

    {#if joinError}
        <p class="mt-2 text-xs text-discord-danger" role="alert">
            {t(joinError)}
        </p>
    {/if}
</div>
