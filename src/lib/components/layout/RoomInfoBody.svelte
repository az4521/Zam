<script lang="ts">
    import type { Room } from "matrix-js-sdk";
    import { t } from "$lib/i18n";
    import ChannelTypeIcon from "$lib/components/ui/ChannelTypeIcon.svelte";
    import type { ChannelIconKind } from "$lib/utils/bridgedChannels";
    import { linkifyPlainText } from "$lib/utils/matrixLinks";
    import { renderPlainTextWithTwemoji } from "$lib/utils/twemojiText";
    import { roomsState } from "$lib/stores/rooms.svelte";
    import {
        getRoomPolicyServer,
        getServerAclContent,
    } from "$lib/matrix/client";
    import { summarizeServerAcl } from "$lib/utils/roomPolicy";

    interface Props {
        room: Room;
        roomName: string;
        topic: string | null;
        iconKind: ChannelIconKind;
    }
    let { room, roomName, topic, iconKind }: Props = $props();

    // Topics are plain text (m.room.topic). Escape first, since linkifyPlainText
    // requires escaped input, then turn URLs / matrix identifiers into anchors.
    // Newlines are kept by whitespace-pre-wrap on the container.
    const topicHtml = $derived(
        topic
            ? linkifyPlainText(
                  topic
                      .replace(/&/g, "&amp;")
                      .replace(/</g, "&lt;")
                      .replace(/>/g, "&gt;")
                      .replace(/"/g, "&quot;")
                      .replace(/'/g, "&#39;"),
              ).replace(
                  /<a href=/g,
                  '<a target="_blank" rel="noopener noreferrer" href=',
              )
            : "",
    );

    // Re-read on roomsTick: the policy and ACL events can arrive after open.
    const policy = $derived(
        (void roomsState.roomsTick, getRoomPolicyServer(room.roomId)),
    );
    const acl = $derived.by(() => {
        void roomsState.roomsTick;
        return summarizeServerAcl(getServerAclContent(room));
    });
    const hasPolicies = $derived(policy !== null || acl !== null);
</script>

<div class="flex flex-col gap-3">
    <div class="flex items-start gap-2 min-w-0">
        <ChannelTypeIcon
            kind={iconKind}
            size={20}
            class="text-zam-textMuted flex-shrink-0 mt-1"
        />
        <h2
            id="room-info-title"
            class="font-semibold text-zam-textPrimary break-words min-w-0 text-lg"
        >
            {@html renderPlainTextWithTwemoji(roomName)}
        </h2>
    </div>

    {#if topic}
        <div
            class="text-sm text-zam-textPrimary whitespace-pre-wrap break-words [&_a]:text-zam-accent [&_a]:underline"
        >
            {@html topicHtml}
        </div>
    {/if}

    {#if hasPolicies}
        <div class="border-t border-zam-divider pt-3 flex flex-col gap-1.5">
            <p
                class="text-xs font-semibold uppercase text-zam-textMuted tracking-wide"
            >
                {t("roomInfo.policiesTitle")}
            </p>
            {#if policy}
                <p class="text-sm text-zam-textPrimary break-words">
                    {t("roomInfo.policyServer", { server: policy.via })}
                </p>
            {/if}
            {#if acl}
                {#if acl.deny.length > 0}
                    <p class="text-sm text-zam-textPrimary break-words">
                        {t("roomInfo.aclBlocked", {
                            servers: acl.deny.join(", "),
                        })}
                    </p>
                {/if}
                {#if acl.allow.length === 0}
                    <p class="text-sm text-zam-textPrimary break-words">
                        {t("roomInfo.aclNoneAllowed")}
                    </p>
                {:else if !(acl.allow.length === 1 && acl.allow[0] === "*")}
                    <p class="text-sm text-zam-textPrimary break-words">
                        {t("roomInfo.aclOnly", {
                            servers: acl.allow.join(", "),
                        })}
                    </p>
                {/if}
                {#if !acl.allowIpLiterals}
                    <p class="text-sm text-zam-textPrimary break-words">
                        {t("roomInfo.aclIpBlocked")}
                    </p>
                {/if}
            {/if}
        </div>
    {/if}
</div>
