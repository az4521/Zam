<script lang="ts">
    import ToggleSwitch from "$lib/components/ui/ToggleSwitch.svelte";
    import {
        settingsState,
        setScreenShareResolution,
        setScreenShareFps,
        setShareSystemAudio,
    } from "$lib/stores/settings.svelte";
    import {
        SCREEN_RESOLUTIONS,
        SCREEN_FPS_OPTIONS,
    } from "$lib/utils/voiceCall";

    interface Props {
        onQualityChange?: (resKey: string, fps: number) => void;
    }
    let { onQualityChange }: Props = $props();

    function pickRes(key: string): void {
        setScreenShareResolution(key);
        onQualityChange?.(key, Number(settingsState.screenShareFps));
    }
    function pickFps(fps: number): void {
        setScreenShareFps(String(fps));
        onQualityChange?.(settingsState.screenShareResolution, fps);
    }

    const chipBase =
        "px-2.5 py-1 rounded text-xs font-medium border transition-colors";
    const chipOn = "bg-discord-accent text-white border-discord-accent";
    const chipOff =
        "bg-discord-backgroundTertiary text-discord-textMuted border-transparent hover:bg-discord-messageHover";
</script>

<div class="space-y-3">
    <div>
        <div
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1.5"
        >
            Resolution
        </div>
        <div class="flex flex-wrap gap-1.5">
            {#each SCREEN_RESOLUTIONS as r (r.key)}
                <button
                    type="button"
                    class="{chipBase} {settingsState.screenShareResolution ===
                    r.key
                        ? chipOn
                        : chipOff}"
                    aria-pressed={settingsState.screenShareResolution === r.key}
                    onclick={() => pickRes(r.key)}
                >
                    {r.label}
                </button>
            {/each}
        </div>
    </div>
    <div>
        <div
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1.5"
        >
            Frame rate
        </div>
        <div class="flex flex-wrap gap-1.5">
            {#each SCREEN_FPS_OPTIONS as f (f)}
                <button
                    type="button"
                    class="{chipBase} {settingsState.screenShareFps ===
                    String(f)
                        ? chipOn
                        : chipOff}"
                    aria-pressed={settingsState.screenShareFps === String(f)}
                    onclick={() => pickFps(f)}
                >
                    {f} FPS
                </button>
            {/each}
        </div>
    </div>
    <div class="flex items-center justify-between gap-3">
        <div class="text-sm text-discord-textPrimary">Share system audio</div>
        <ToggleSwitch
            checked={settingsState.shareSystemAudio}
            onChange={(v) => setShareSystemAudio(v)}
            label="Share system audio"
        />
    </div>
</div>
