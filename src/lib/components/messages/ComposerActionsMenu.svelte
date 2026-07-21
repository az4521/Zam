<script lang="ts">
    interface Props {
        onClose: () => void;
        onUpload: () => void;
        onCreatePoll: () => void;
    }
    let { onClose, onUpload, onCreatePoll }: Props = $props();

    const items = [
        {
            key: "upload",
            label: "Upload a file",
            run: () => onUpload(),
            icon: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z",
        },
        {
            key: "poll",
            label: "Create poll",
            run: () => onCreatePoll(),
            icon: "M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zm5.6 8H19v6h-2.8v-6z",
        },
    ];
    function choose(run: () => void) {
        run();
        onClose();
    }
</script>

<div
    class="w-52 bg-discord-backgroundSecondary border border-discord-divider rounded-lg overflow-hidden shadow-lg py-1"
    role="menu"
>
    {#each items as item (item.key)}
        <button
            role="menuitem"
            onclick={() => choose(item.run)}
            class="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
        >
            <svg
                class="w-5 h-5 text-discord-textMuted flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 24 24"><path d={item.icon} /></svg
            >
            {item.label}
        </button>
    {/each}
</div>
