<script lang="ts">
    import type { Room } from "matrix-js-sdk";
    import { t } from "$lib/i18n";
    import { X } from "lucide-svelte";
    import Portal from "$lib/components/ui/Portal.svelte";
    import BottomSheet from "$lib/components/ui/BottomSheet.svelte";
    import ModalDialog from "$lib/components/ui/ModalDialog.svelte";
    import type { ChannelIconKind } from "$lib/utils/bridgedChannels";
    import RoomInfoBody from "$lib/components/layout/RoomInfoBody.svelte";

    interface Props {
        room: Room;
        roomName: string;
        topic: string | null;
        iconKind: ChannelIconKind;
        isMobile: boolean;
        onClose: () => void;
    }
    let { room, roomName, topic, iconKind, isMobile, onClose }: Props =
        $props();
</script>

<Portal>
    {#if isMobile}
        <BottomSheet {onClose}>
            <div class="px-4 pb-4 pt-1 max-h-[70vh] overflow-y-auto">
                <RoomInfoBody {room} {roomName} {topic} {iconKind} />
            </div>
        </BottomSheet>
    {:else}
        <ModalDialog
            {onClose}
            labelledBy="room-info-title"
            panelClass="relative w-[min(440px,calc(100vw-2rem))] max-h-[80vh] overflow-y-auto bg-zam-backgroundSecondary rounded-lg shadow-xl p-5"
        >
            <button
                type="button"
                onclick={onClose}
                aria-label={t("common.close")}
                class="absolute top-3 end-3 p-1.5 rounded text-zam-textMuted hover:text-zam-textPrimary hover:bg-zam-messageHover transition-colors"
            >
                <X size={18} />
            </button>
            <RoomInfoBody {room} {roomName} {topic} {iconKind} />
        </ModalDialog>
    {/if}
</Portal>
