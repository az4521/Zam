<script lang="ts">
    import { t } from "$lib/i18n";
    import { Lock, LockOpen, ShieldAlert } from "lucide-svelte";
    import { voiceCallState } from "$lib/stores/voiceCall.svelte";
    import { getRoom } from "$lib/matrix/client";

    // Whether the call we're in is end-to-end encrypted, and who in it isn't
    // (an app without encryption: we play their media, they can't play ours).
    // The full explanation is in the tooltip and the accessible name.
    interface Props {
        roomId: string;
        /** Show a short word next to the icon. */
        showLabel?: boolean;
        /** Sit inside a line of text (the voice panel's status). */
        inline?: boolean;
    }
    let { roomId, showLabel = false, inline = false }: Props = $props();

    const encryption = $derived(voiceCallState.encryption);

    function names(userIds: string[]): string {
        const room = getRoom(roomId);
        return userIds.map((id) => room?.getMember(id)?.name ?? id).join(", ");
    }

    const view = $derived.by(() => {
        if (!encryption) return null;
        if (!encryption.encrypted) {
            return {
                icon: LockOpen,
                tone: "text-discord-textMuted",
                short: "",
                text: t("callEncryption.notEncrypted"),
            };
        }
        if (encryption.unencrypted.length > 0) {
            return {
                icon: ShieldAlert,
                tone: "text-discord-warning",
                short: t("callEncryption.partialShort"),
                text: t("callEncryption.partial", {
                    names: names(encryption.unencrypted),
                }),
            };
        }
        return {
            icon: Lock,
            tone: "text-discord-textPositive",
            short: t("callEncryption.encryptedShort"),
            text: t("callEncryption.encrypted"),
        };
    });
</script>

{#if view}
    {@const Icon = view.icon}
    <span
        class="{inline
            ? 'inline-flex align-text-bottom ms-1'
            : 'flex flex-shrink-0'} items-center gap-1 text-xs {view.tone}"
        title={view.text}
        role="img"
        aria-label={view.text}
    >
        <Icon size={inline ? 12 : 16} aria-hidden="true" />
        {#if showLabel && view.short}
            <span aria-hidden="true">{view.short}</span>
        {/if}
    </span>
{/if}
