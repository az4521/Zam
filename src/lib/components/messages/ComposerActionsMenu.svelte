<script lang="ts">
    interface Props {
        onClose: () => void;
        onUpload: () => void;
        onCreatePoll: () => void;
        onRecordVoice?: () => void;
        onShareLocation?: () => void;
    }
    let {
        onClose,
        onUpload,
        onCreatePoll,
        onRecordVoice,
        onShareLocation,
    }: Props = $props();

    const items = $derived([
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
        ...(onRecordVoice
            ? [
                  {
                      key: "voice",
                      label: "Record voice message",
                      run: () => onRecordVoice?.(),
                      icon: "M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z",
                  },
              ]
            : []),
        ...(onShareLocation
            ? [
                  {
                      key: "location",
                      label: "Share location",
                      run: () => onShareLocation?.(),
                      icon: "M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z",
                  },
              ]
            : []),
    ]);
    function choose(run: () => void) {
        // Close this menu FIRST — it shares the single modal slot, so if `run`
        // opens another modal (e.g. the create-poll dialog), closing afterwards
        // would tear that freshly-opened modal right back down.
        onClose();
        run();
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
