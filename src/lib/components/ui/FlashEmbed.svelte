<script lang="ts">
    interface Props {
        src: string; // HTTP URL to the SWF
    }

    let { src }: Props = $props();

    let container: HTMLDivElement | undefined = $state();
    let player: any = $state(null);
    let suspended = $state(false);

    $effect(() => {
        if (!container) return;
        const currentSrc = src;
        let localPlayer: any = null;

        async function init() {
            // Load Ruffle if not already loaded
            if (!(window as any).RufflePlayer) {
                await new Promise<void>((resolve, reject) => {
                    const script = document.createElement("script");
                    script.src = "/ruffle/ruffle.js";
                    script.onload = () => resolve();
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }

            if (!container) return;
            const ruffle = (window as any).RufflePlayer.newest();
            localPlayer = ruffle.createPlayer();
            if (!localPlayer) return;
            localPlayer.style.width = "100%";
            localPlayer.style.height = "100%";
            container.appendChild(localPlayer);
            // Neuter attacker ActionScript: no network (URLLoader/Socket), no
            // host-page script access (ExternalInterface), no navigation via getURL
            // (SEC-M2). The click-to-activate gate already prevents zero-click Flash;
            // this bounds what a played SWF can reach.
            localPlayer.ruffle().load({
                url: currentSrc,
                allowNetworking: "none",
                allowScriptAccess: false,
                openUrlMode: "deny",
            });
            player = localPlayer;
        }

        init().catch(console.error);

        return () => {
            localPlayer?.remove();
            player = null;
            suspended = false;
        };
    });

    let wrapperEl: HTMLDivElement | undefined = $state();

    $effect(() => {
        if (!wrapperEl || !player) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (!entry.isIntersecting) {
                    player.ruffle().suspend();
                }
            },
            { threshold: 0 },
        );
        observer.observe(wrapperEl);
        return () => observer.disconnect();
    });
</script>

<div bind:this={wrapperEl} class="relative w-full max-w-sm mt-1 group/flash">
    <div
        bind:this={container}
        class="w-full aspect-video rounded-lg overflow-hidden bg-black"
    ></div>
    {#if player}
        <button
            onclick={() => player.ruffle().suspend()}
            title="Suspend"
            class="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover/flash:opacity-100 transition-opacity hover:bg-black/70"
        >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
        </button>
    {/if}
</div>
