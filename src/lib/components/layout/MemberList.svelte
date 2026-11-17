<script lang="ts">
    import { t } from "$lib/i18n";
    import { untrack } from "svelte";
    import type { Room, RoomMember } from "matrix-js-sdk";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import {
        getRoomMembers,
        getUserPowerLevel,
        hasImmutableCreatorPower,
        loadRoomMembersIfNeeded,
        mxcToHttp,
        memberDisplayName,
        onRoomMembersChanged,
    } from "$lib/matrix/client";
    import { interfaceState } from "$lib/stores/interface.svelte";
    import { openProfileCard } from "$lib/stores/profileCard.svelte";
    import { presenceFor } from "$lib/stores/presence.svelte";
    import { cachedNameColourFor } from "$lib/stores/profileFields.svelte";
    import {
        presenceDot,
        presenceDotClass,
        presenceLabel,
    } from "$lib/utils/presence";
    import { pluginRegistry } from "$lib/stores/plugins.svelte";
    import { collectMemberDecorations } from "$lib/plugins/pluginMembers";
    import PowerLevelTagBadge from "$lib/components/ui/PowerLevelTagBadge.svelte";
    import {
        acquirePowerLevelTags,
        effectiveRoomTags,
    } from "$lib/stores/powerLevelTags.svelte";
    import {
        sortedTagLevels,
        tagForPowerLevel,
        type PowerLevelTag,
    } from "$lib/utils/powerLevelTags";

    interface Props {
        room: Room;
    }

    let { room }: Props = $props();
    let memberTick = $state(0);

    // Row geometry for the windowed list (px).
    const HEADER_H = 24;
    const MEMBER_H = 40;
    const GROUP_GAP = 8;
    const PAD_Y = 8;
    // Rows rendered beyond the visible viewport on each side.
    const OVERSCAN = 400;

    // MessageArea keeps this component mounted across room switches and only
    // swaps `room`, so the load, the subscription and the scroll position all
    // follow it rather than running once on mount.
    $effect(() => {
        const r = room;
        let live = true;
        loadRoomMembersIfNeeded(r)
            .then(() => {
                if (live) memberTick++;
            })
            .catch(() => {});
        untrack(() => {
            if (scroller) scroller.scrollTop = 0;
            scrollTop = 0;
        });
        // Member and power-level changes arrive through onRoomMembersChanged
        // (it bumps memberTick), not through the sync-wide rooms tick.
        const off = onRoomMembersChanged(r, () => memberTick++);
        // Power level tag edits are ordinary state events, so they arrive
        // through the tags subscription instead.
        const releaseTags = acquirePowerLevelTags(r.roomId);
        return () => {
            live = false;
            off();
            releaseTags();
        };
    });

    const members = $derived.by(() => {
        void memberTick;
        // Live SDK Room objects mutate in place, so this is re-read whenever
        // memberTick bumps (kicks/bans/joins from other sessions included).
        return getRoomMembers(room);
    });

    // One pass and a shared collator: a big room's three filters (each looking
    // up every member's power level) plus three localeCompare sorts were tens
    // of ms per run.
    const collator = new Intl.Collator();
    // Members are bucketed by the tag that applies to their power level, one
    // bucket per defined tag level (highest first). Creators sit above all
    // tags. Members below every tag land in the untitled bucket.
    const groups = $derived.by(() => {
        const info = effectiveRoomTags(room.roomId);
        const levels = sortedTagLevels(info.tags);
        const creators: RoomMember[] = [];
        const byLevel = new Map<number, RoomMember[]>();
        for (const level of levels) byLevel.set(level, []);
        const untitled: RoomMember[] = [];
        for (const m of members) {
            // Immutable creators sit above admins even though their written
            // level is lifted to 100 for gate purposes.
            if (hasImmutableCreatorPower(room, m.userId)) {
                creators.push(m);
                continue;
            }
            const resolved = tagForPowerLevel(
                info.tags,
                getUserPowerLevel(room, m.userId),
            );
            if (resolved) byLevel.get(resolved.level)?.push(m);
            else untitled.push(m);
        }
        const byName = (a: RoomMember, b: RoomMember) =>
            collator.compare(a.name, b.name);
        creators.sort(byName);
        untitled.sort(byName);
        const tagged = levels.map((level) => {
            const list = byLevel.get(level) ?? [];
            list.sort(byName);
            return { level, tag: info.tags[level], members: list };
        });
        return {
            creators,
            tagged,
            untitled,
            lowestLevel: levels.length > 0 ? levels[levels.length - 1] : null,
        };
    });

    function getAvatarSrc(member: RoomMember): string | null {
        const mxc = member.getMxcAvatarUrl();
        return mxcToHttp(mxc);
    }

    // Presence dot class + tooltip for one member. Called from the row
    // template, so only rendered (visible) rows ask presenceFor, which keeps
    // each dot recoloring when that user's m.presence arrives. An unknown
    // presence (e.g. the server has it disabled) renders as offline.
    function presenceOf(userId: string): { dotClass: string; label: string } {
        const p = presenceFor(userId);
        const state = p?.state ?? "offline";
        return {
            dotClass: presenceDotClass(presenceDot(state)),
            label: p?.statusMsg
                ? `${presenceLabel(state)} - ${p.statusMsg}`
                : presenceLabel(state),
        };
    }

    // Plugin badges / second lines (zam.members.decorate), computed lazily for
    // visible rows only. The cache is dropped whenever the registry tick, the
    // member tick or the room changes, so scrolling back does not recompute.
    type Decoration = ReturnType<typeof collectMemberDecorations>;
    const decoCache = new Map<string, Decoration>();
    let decoCacheKey = "";
    function decorationsOf(userId: string): Decoration {
        const key = `${pluginRegistry.tick}|${memberTick}|${room.roomId}`;
        if (key !== decoCacheKey) {
            decoCache.clear();
            decoCacheKey = key;
        }
        const cached = decoCache.get(userId);
        if (cached !== undefined) return cached;
        const decorators = pluginRegistry.memberDecorators.map((e) => e.value);
        if (decorators.length === 0) return null;
        const result = collectMemberDecorations(decorators, {
            roomId: room.roomId,
            userId,
        });
        decoCache.set(userId, result);
        return result;
    }

    type Row =
        | {
              kind: "header";
              key: string;
              label: string;
              top: number;
              height: number;
          }
        | {
              kind: "member";
              key: string;
              member: RoomMember;
              roleLabel: string | null;
              roleTag: PowerLevelTag | null;
              muted: boolean;
              top: number;
              height: number;
          };

    // Flat, sorted row list: header then members for each non-empty group.
    const rows = $derived.by((): Row[] => {
        const { creators, tagged, untitled, lowestLevel } = groups;
        const sections: {
            key: string;
            label: string;
            members: RoomMember[];
            roleLabel: string | null;
            roleTag: PowerLevelTag | null;
            muted: boolean;
        }[] = [];
        if (creators.length > 0)
            sections.push({
                key: "creators",
                label: t("memberList.creators", { length: creators.length }),
                members: creators,
                roleLabel: t("roomSettings.creatorLabel"),
                roleTag: null,
                muted: false,
            });
        for (const { level, tag, members: list } of tagged) {
            if (list.length === 0) continue;
            // The lowest tag is the baseline: its rows stay unlabelled and
            // muted, as regular members were before tags.
            const isLowest = level === lowestLevel;
            sections.push({
                key: `tag:${level}`,
                label: t("memberList.roleSection", {
                    name: tag.name,
                    length: list.length,
                }),
                members: list,
                roleLabel: null,
                roleTag: isLowest ? null : tag,
                muted: isLowest && level <= 0,
            });
        }
        if (untitled.length > 0)
            sections.push({
                key: "untitled",
                label: t("memberList.members", { length: untitled.length }),
                members: untitled,
                roleLabel: null,
                roleTag: null,
                muted: true,
            });

        const out: Row[] = [];
        let top = PAD_Y;
        sections.forEach((s, i) => {
            if (i > 0) top += GROUP_GAP;
            out.push({
                kind: "header",
                key: `h:${s.key}`,
                label: s.label,
                top,
                height: HEADER_H,
            });
            top += HEADER_H;
            for (const m of s.members) {
                out.push({
                    kind: "member",
                    key: `m:${m.userId}`,
                    member: m,
                    roleLabel: s.roleLabel,
                    roleTag: s.roleTag,
                    muted: s.muted,
                    top,
                    height: MEMBER_H,
                });
                top += MEMBER_H;
            }
        });
        return out;
    });

    const totalHeight = $derived.by(() => {
        const last = rows[rows.length - 1];
        const end = last ? last.top + last.height : PAD_Y;
        return end + PAD_Y;
    });

    // Scroll window. scroller is the overflow container; scrollTop and its
    // clientHeight are kept in state so the visible slice follows scrolling.
    let scroller = $state<HTMLDivElement | undefined>(undefined);
    let scrollTop = $state(0);
    let viewportHeight = $state(0);

    $effect(() => {
        const el = scroller;
        if (!el) return;
        scrollTop = el.scrollTop;
        viewportHeight = el.clientHeight;
        const ro = new ResizeObserver(() => {
            viewportHeight = el.clientHeight;
        });
        ro.observe(el);
        return () => ro.disconnect();
    });

    // Index of the first row whose top is above `y` (last row with top <= y),
    // found by binary search since rows are sorted by top.
    function rowIndexAtOrBefore(y: number): number {
        let lo = 0;
        let hi = rows.length;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (rows[mid].top <= y) lo = mid + 1;
            else hi = mid;
        }
        return Math.max(0, lo - 1);
    }

    const visibleRows = $derived.by(() => {
        const from = scrollTop - OVERSCAN;
        const to = scrollTop + viewportHeight + OVERSCAN;
        const out: Row[] = [];
        if (rows.length === 0) return out;
        for (let i = rowIndexAtOrBefore(from); i < rows.length; i++) {
            const row = rows[i];
            if (row.top >= to) break;
            out.push(row);
        }
        return out;
    });
</script>

{#snippet memberRow(
    member: RoomMember,
    roleLabel: string | null,
    roleTag: PowerLevelTag | null,
    muted: boolean,
)}
    {@const presence = presenceOf(member.userId)}
    {@const deco = decorationsOf(member.userId)}
    {@const nameColour = cachedNameColourFor(member.userId)}
    {@const secondLine = [roleLabel, deco?.subtitle]
        .filter(Boolean)
        .join(" · ")}
    <button
        onclick={(e) => openProfileCard(member.userId, e.currentTarget)}
        data-user-id={member.userId}
        title={deco?.tooltip ?? undefined}
        style="height: {MEMBER_H}px"
        class="w-[calc(100%-1rem)] text-start flex items-center gap-2 px-2 mx-2 rounded overflow-hidden hover:bg-zam-messageHover transition-colors cursor-pointer group"
    >
        <div class="relative flex-shrink-0">
            <Avatar
                src={getAvatarSrc(member)}
                name={member.name}
                id={member.userId}
                size={32}
            />
            <div
                title={presence.label}
                class="absolute bottom-0 end-0 w-2.5 h-2.5 {presence.dotClass} rounded-full border-2 border-zam-backgroundSecondary"
            ></div>
        </div>
        <div class="min-w-0 flex-1">
            <p class="flex items-center gap-1 min-w-0 text-sm leading-5">
                <span
                    style:color={nameColour}
                    class="font-medium truncate group-hover:text-zam-textPrimary transition-colors {muted
                        ? 'text-zam-textMuted'
                        : 'text-zam-textPrimary'} {muted && nameColour
                        ? 'opacity-60 group-hover:opacity-100'
                        : ''}"
                >
                    {memberDisplayName(member)}
                </span>
                {#each deco?.badges ?? [] as badge, i (i)}
                    <span
                        class="flex-shrink-0 px-1 rounded bg-zam-backgroundTertiary text-[10px] font-semibold uppercase text-zam-textMuted"
                        >{badge}</span
                    >
                {/each}
            </p>
            {#if roleTag}
                <p
                    class="text-xs leading-4 text-zam-textMuted truncate flex items-center gap-1 min-w-0"
                >
                    <PowerLevelTagBadge tag={roleTag} />
                    {#if deco?.subtitle}
                        <span class="text-zam-textMuted">· {deco.subtitle}</span
                        >
                    {/if}
                </p>
            {:else if secondLine}
                <p class="text-xs leading-4 text-zam-textMuted truncate">
                    {secondLine}
                </p>
            {/if}
        </div>
    </button>
{/snippet}

<div
    data-zam-region="member-list"
    class="{interfaceState.isMobile
        ? ''
        : 'w-72'} h-full bg-zam-backgroundSecondary flex flex-col flex-shrink-0 overflow-hidden border-l border-zam-divider"
>
    <div
        class="h-12 px-4 flex items-center border-b border-zam-divider flex-shrink-0"
    >
        <h3
            class="text-xs font-semibold text-zam-textMuted uppercase tracking-wide"
        >
            {t("memberList.members", { length: members.length })}
        </h3>
    </div>

    <div
        bind:this={scroller}
        onscroll={(e) => (scrollTop = e.currentTarget.scrollTop)}
        class="flex-1 overflow-y-auto"
    >
        <div class="relative" style="height: {totalHeight}px">
            {#each visibleRows as row (row.key)}
                <div
                    class="absolute left-0 right-0"
                    style="top: {row.top}px; height: {row.height}px"
                >
                    {#if row.kind === "header"}
                        <div
                            class="h-full px-4 flex items-center text-xs font-semibold text-zam-textMuted uppercase tracking-wide"
                        >
                            <span class="truncate">{row.label}</span>
                        </div>
                    {:else}
                        {@render memberRow(
                            row.member,
                            row.roleLabel,
                            row.roleTag,
                            row.muted,
                        )}
                    {/if}
                </div>
            {/each}
        </div>
    </div>
</div>
