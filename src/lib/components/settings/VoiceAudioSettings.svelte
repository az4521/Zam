<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import ToggleSwitch from "$lib/components/ui/ToggleSwitch.svelte";
    import {
        settingsState,
        setAudioInputDeviceId,
        setAudioOutputDeviceId,
        setVideoInputDeviceId,
        setCallOutputVolume,
        setNoiseSuppression,
        setEchoCancellation,
        setAutoGainControl,
        setCallSoundsEnabled,
        setCallSoundsVolume,
        setRingEnabled,
        setRingVolume,
        setMirrorCamera,
        setShareSystemAudio,
        setScreenShareResolution,
        setScreenShareFps,
    } from "$lib/stores/settings.svelte";
    import {
        toDeviceOptions,
        resolveDeviceId,
        outputPickerMode,
        buildDeviceConstraint,
        isOverconstrainedError,
        type DeviceOption,
    } from "$lib/utils/audioDevices";
    import {
        SCREEN_RESOLUTIONS,
        SCREEN_FPS_OPTIONS,
    } from "$lib/utils/voiceCall";
    import {
        listMediaDevices,
        onDevicesChanged,
        canSetAudioSink,
        canSelectAudioOutput,
        promptSelectAudioOutput,
    } from "$lib/audio/devices";
    import { startMicMeter, type MicMeterHandle } from "$lib/audio/micMeter";
    import { startOutputMeter } from "$lib/audio/outputMeter";
    import { playSpeakerTestTone } from "$lib/audio/speakerTest";
    import {
        playCallSound,
        configureCallSounds,
        configureRing,
        playRingBlip,
        playRingPreview,
    } from "$lib/audio/soundEffects";
    import {
        requestNotificationPermission,
        callAlertHint,
    } from "$lib/utils/notifyPermission";
    import {
        setVoiceInputDevice,
        setVoiceOutputDevice,
        setVoiceOutputVolume,
        setVoiceCaptureConstraints,
        getRemoteAudioStreams,
    } from "$lib/matrix/client";
    import {
        voiceCallState,
        setCallVideoInputDevice,
    } from "$lib/stores/voiceCall.svelte";
    import {
        newCaptureLifecycle,
        beginCapture,
        cancelCapture,
        disposeCaptures,
        isCaptureCurrent,
        adoptCapture,
        stopTracks,
        stopHandle,
    } from "$lib/utils/captureLifecycle";

    let inputs = $state<DeviceOption[]>([]);
    let outputs = $state<DeviceOption[]>([]);
    let cameras = $state<DeviceOption[]>([]);
    let micLevel = $state(0);
    let outLevel = $state(0);
    let loopbackOn = $state(false);
    let micError = $state<string | null>(null);
    let cameraOn = $state(false);
    let cameraError = $state<string | null>(null);
    // Why incoming-call OS alerts stay silent (blocked/unsupported), or null.
    let ringNotifyHint = $state<string | null>(null);
    let videoEl: HTMLVideoElement | null = null;
    let cameraStream: MediaStream | null = null;
    let meter: MicMeterHandle | null = null;
    let stopOutputMeter: (() => void) | null = null;
    let unsubDevices: (() => void) | null = null;
    // Separate channels: restarting the mic meter must not cancel an in-flight
    // camera grant, or vice versa.
    const micCapture = newCaptureLifecycle();
    const cameraCapture = newCaptureLifecycle();
    // Guards the post-await *state* writes that aren't captures.
    let destroyed = false;

    const outputMode = $derived(
        outputPickerMode({
            canSetSink: canSetAudioSink(),
            hasOutputs: outputs.length > 0,
            canSelectAudioOutput: canSelectAudioOutput(),
        }),
    );
    const inputFallback = $derived(
        resolveDeviceId(settingsState.audioInputDeviceId, inputs).usedFallback,
    );

    async function refreshDevices(): Promise<void> {
        const all = await listMediaDevices();
        if (destroyed) return;
        inputs = toDeviceOptions(all, "audioinput");
        outputs = toDeviceOptions(all, "audiooutput");
        cameras = toDeviceOptions(all, "videoinput");
    }

    async function startMeter(): Promise<void> {
        // Claim the channel first: two overlapping starts used to leave the
        // earlier meter's stream running with only the later handle stored.
        const ticket = beginCapture(micCapture);
        stopHandle(meter);
        meter = null;
        loopbackOn = false;
        micError = null;
        micLevel = 0;
        let started: MicMeterHandle | null = null;
        try {
            started = await startMicMeter({
                deviceId: resolveDeviceId(
                    settingsState.audioInputDeviceId,
                    inputs,
                ).id,
                noiseSuppression: settingsState.noiseSuppression,
                echoCancellation: settingsState.echoCancellation,
                autoGainControl: settingsState.autoGainControl,
                onLevel: (v) => (micLevel = v),
            });
        } catch {
            if (isCaptureCurrent(micCapture, ticket))
                micError = "Microphone unavailable - check browser permissions";
            return;
        }
        // A grant that arrives after the tab closed (or after a newer start)
        // owns a live mic + AudioContext that nothing else can reach.
        const adopted = adoptCapture(micCapture, ticket, started, stopHandle);
        // Return WITHOUT writing on the stale path: two grants can resolve out
        // of order, and the newer one already stored the only handle that can
        // release its mic. Nulling it here would orphan a live microphone.
        if (!adopted) return;
        meter = adopted;
        // The first grant unlocks device labels — refresh the lists.
        void refreshDevices();
    }

    function pickInput(id: string): void {
        const dev = id === "" ? null : id;
        setAudioInputDeviceId(dev);
        void setVoiceInputDevice(dev);
        void startMeter();
    }

    function pickOutput(id: string): void {
        const dev = id === "" ? null : id;
        setAudioOutputDeviceId(dev);
        setVoiceOutputDevice(dev);
        configureCallSounds({ sinkId: dev });
        if (loopbackOn) void meter?.setLoopback(true, dev);
    }

    async function chooseOutputViaBrowser(): Promise<void> {
        const picked = await promptSelectAudioOutput();
        if (!picked) return;
        await refreshDevices();
        // Deliberately NOT gated on `destroyed`: the user really did pick an
        // output, and everything below is global (or null-safe once the meter
        // is gone), so abandoning it would just lose their choice.
        pickOutput(picked.deviceId);
    }

    function applyConstraints(): void {
        void setVoiceCaptureConstraints({
            noiseSuppression: settingsState.noiseSuppression,
            echoCancellation: settingsState.echoCancellation,
            autoGainControl: settingsState.autoGainControl,
        });
        void startMeter();
    }

    async function toggleLoopback(): Promise<void> {
        loopbackOn = !loopbackOn;
        await meter?.setLoopback(loopbackOn, settingsState.audioOutputDeviceId);
    }

    async function toggleCamera(): Promise<void> {
        if (cameraOn) {
            stopCamera();
            return;
        }
        const ticket = beginCapture(cameraCapture);
        cameraError = null;
        let granted: MediaStream;
        try {
            // `exact` (not `ideal`) so the browser honors the chosen camera;
            // `ideal` was ignored, so selecting a camera never switched the
            // preview off the default device.
            const wanted = buildDeviceConstraint(
                settingsState.videoInputDeviceId,
            );
            try {
                granted = await navigator.mediaDevices.getUserMedia({
                    video: wanted ? { deviceId: wanted } : {},
                });
            } catch (e) {
                // Chosen camera vanished → retry once on the default so the
                // preview falls back instead of dying; other errors (permission
                // denied) rethrow to the handler below.
                if (!wanted || !isOverconstrainedError(e)) throw e;
                granted = await navigator.mediaDevices.getUserMedia({
                    video: {},
                });
            }
        } catch {
            if (isCaptureCurrent(cameraCapture, ticket))
                cameraError = "Camera unavailable - check browser permissions";
            return;
        }
        // Leaving the tab (or clicking Preview twice) used to leave the camera
        // on with no element bound and no handle to stop it.
        const adopted = adoptCapture(
            cameraCapture,
            ticket,
            granted,
            stopTracks,
        );
        // Return WITHOUT writing on the stale path: a newer grant that resolved
        // first holds the live stream, and nulling `cameraStream` here would
        // leave it playing with `stopCamera()` unable to reach its tracks.
        if (!adopted) return;
        cameraStream = adopted;
        cameraOn = true;
        if (videoEl) videoEl.srcObject = cameraStream;
        void refreshDevices(); // camera grant unlocks camera labels
    }

    function stopCamera(): void {
        // Cancel an in-flight grant too, or a prompt answered after Stop
        // silently reopens the camera.
        cancelCapture(cameraCapture);
        cameraOn = false;
        stopTracks(cameraStream);
        cameraStream = null;
        if (videoEl) videoEl.srcObject = null;
    }

    function pickCamera(id: string): void {
        const dev = id === "" ? null : id;
        setVideoInputDeviceId(dev);
        setCallVideoInputDevice(dev);
        if (cameraOn) {
            stopCamera();
            void toggleCamera();
        }
    }

    function currentNotifyPermission(): NotificationPermission | "unsupported" {
        return typeof Notification === "undefined"
            ? "unsupported"
            : Notification.permission;
    }

    onMount(() => {
        void refreshDevices().then(() => {
            if (!destroyed) void startMeter();
        });
        unsubDevices = onDevicesChanged(() => void refreshDevices());
        // A user who blocked notifications long ago and still has ringing on
        // gets no OS call alerts; surface why without making them re-toggle.
        if (settingsState.ringEnabled)
            ringNotifyHint = callAlertHint(currentNotifyPermission());
    });

    // Incoming-audio meter while in a call; re-taps as tracks come and go.
    $effect(() => {
        void voiceCallState.voiceTick;
        const inCall = voiceCallState.connState === "connected";
        stopOutputMeter?.();
        stopOutputMeter = null;
        outLevel = 0;
        if (inCall)
            stopOutputMeter = startOutputMeter(
                getRemoteAudioStreams(),
                (v) => (outLevel = v),
            );
    });

    onDestroy(() => {
        destroyed = true;
        disposeCaptures(micCapture);
        disposeCaptures(cameraCapture);
        stopHandle(meter);
        meter = null;
        stopOutputMeter?.();
        stopCamera();
        unsubDevices?.();
    });

    const selectClass =
        "w-full bg-discord-backgroundTertiary text-discord-textPrimary text-sm rounded px-3 py-2 outline-none border border-transparent focus:border-discord-accent/50";
</script>

<div class="space-y-6">
    <section>
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
        >
            Input device
        </p>
        <select
            class={selectClass}
            value={settingsState.audioInputDeviceId ?? ""}
            onchange={(e) => pickInput(e.currentTarget.value)}
        >
            <option value="">Default</option>
            {#each inputs as d (d.id)}
                <option value={d.id}>{d.label}</option>
            {/each}
        </select>
        {#if inputFallback}
            <p class="text-xs text-discord-warning mt-1">
                Saved microphone not found - using the default until it returns.
            </p>
        {/if}
        {#if micError}
            <p class="text-xs text-discord-danger mt-2">{micError}</p>
        {:else}
            <div
                class="mt-3 h-2 rounded bg-discord-backgroundTertiary overflow-hidden"
                title="Microphone level"
            >
                <div
                    class="h-full bg-discord-accent transition-[width] duration-75"
                    style="width: {Math.round(micLevel * 100)}%"
                ></div>
            </div>
            <button
                onclick={() => void toggleLoopback()}
                class="mt-2 px-3 py-1 rounded text-xs font-medium {loopbackOn
                    ? 'bg-discord-accent text-white'
                    : 'bg-discord-backgroundTertiary text-discord-textMuted hover:bg-discord-messageHover'}"
            >
                {loopbackOn ? "Stop test" : "Test mic"}
            </button>
        {/if}
    </section>

    <section>
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
        >
            Output device
        </p>
        {#if outputMode === "picker"}
            <select
                class={selectClass}
                value={settingsState.audioOutputDeviceId ?? ""}
                onchange={(e) => pickOutput(e.currentTarget.value)}
            >
                <option value="">Default</option>
                {#each outputs as d (d.id)}
                    <option value={d.id}>{d.label}</option>
                {/each}
            </select>
        {:else if outputMode === "browser-prompt"}
            <button
                onclick={() => void chooseOutputViaBrowser()}
                class="px-3 py-1.5 rounded bg-discord-backgroundTertiary text-sm text-discord-textPrimary hover:bg-discord-messageHover"
            >
                Choose output device…
            </button>
        {:else}
            <p class="text-xs text-discord-textMuted">
                Audio output is routed by the operating system on this platform.
            </p>
        {/if}
        {#if outputMode !== "hidden"}
            <button
                onclick={() =>
                    void playSpeakerTestTone(settingsState.audioOutputDeviceId)}
                class="mt-2 px-3 py-1 rounded text-xs font-medium bg-discord-backgroundTertiary text-discord-textMuted hover:bg-discord-messageHover"
            >
                Test speaker
            </button>
        {/if}
        <div class="mt-3 flex items-center gap-3">
            <p class="text-sm text-discord-textPrimary flex-shrink-0">
                Call volume
            </p>
            <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                class="w-full accent-discord-accent"
                value={settingsState.callOutputVolume}
                oninput={(e) => {
                    const v = Number(e.currentTarget.value);
                    setCallOutputVolume(v);
                    setVoiceOutputVolume(v);
                }}
            />
        </div>
        {#if voiceCallState.connState === "connected"}
            <div
                class="mt-3 h-2 rounded bg-discord-backgroundTertiary overflow-hidden"
                title="Incoming call audio"
            >
                <div
                    class="h-full bg-discord-accent transition-[width] duration-75"
                    style="width: {Math.round(outLevel * 100)}%"
                ></div>
            </div>
            <p class="text-xs text-discord-textMuted mt-1">
                Incoming call audio - if this moves but you hear nothing, check
                the selected output device and system volume.
            </p>
        {/if}
    </section>

    <section>
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
        >
            Voice processing
        </p>
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <p class="flex-1 text-sm text-discord-textPrimary">
                Noise suppression
            </p>
            <ToggleSwitch
                checked={settingsState.noiseSuppression}
                onChange={(v) => {
                    setNoiseSuppression(v);
                    applyConstraints();
                }}
                label="Noise suppression"
            />
        </div>
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <p class="flex-1 text-sm text-discord-textPrimary">
                Echo cancellation
            </p>
            <ToggleSwitch
                checked={settingsState.echoCancellation}
                onChange={(v) => {
                    setEchoCancellation(v);
                    applyConstraints();
                }}
                label="Echo cancellation"
            />
        </div>
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <p class="flex-1 text-sm text-discord-textPrimary">
                Auto gain control
            </p>
            <ToggleSwitch
                checked={settingsState.autoGainControl}
                onChange={(v) => {
                    setAutoGainControl(v);
                    applyConstraints();
                }}
                label="Auto gain control"
            />
        </div>
    </section>

    <section>
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
        >
            Camera
        </p>
        <select
            class={selectClass}
            value={settingsState.videoInputDeviceId ?? ""}
            onchange={(e) => pickCamera(e.currentTarget.value)}
        >
            <option value="">Default</option>
            {#each cameras as d (d.id)}
                <option value={d.id}>{d.label}</option>
            {/each}
        </select>
        <div class="flex items-center justify-between py-2">
            <div>
                <div class="text-sm font-medium text-discord-textPrimary">
                    Mirror my camera
                </div>
                <div class="text-xs text-discord-textMuted">
                    Flip your own preview. Others always see you un-mirrored.
                </div>
            </div>
            <ToggleSwitch
                checked={settingsState.mirrorCamera}
                onChange={(v) => setMirrorCamera(v)}
                label="Mirror my camera"
            />
        </div>
        <button
            onclick={() => void toggleCamera()}
            class="mt-2 px-3 py-1 rounded text-xs font-medium {cameraOn
                ? 'bg-discord-accent text-white'
                : 'bg-discord-backgroundTertiary text-discord-textMuted hover:bg-discord-messageHover'}"
        >
            {cameraOn ? "Stop preview" : "Preview"}
        </button>
        {#if cameraError}
            <p class="text-xs text-discord-danger mt-2">{cameraError}</p>
        {/if}
        <!-- svelte-ignore a11y_media_has_caption -->
        <video
            bind:this={videoEl}
            autoplay
            playsinline
            muted
            class="mt-3 w-full max-w-sm rounded bg-black {cameraOn
                ? ''
                : 'hidden'}"
        ></video>
    </section>

    <section>
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
        >
            Screen share
        </p>
        <div class="flex items-center justify-between py-2">
            <div>
                <div class="text-sm font-medium text-discord-textPrimary">
                    Share system audio
                </div>
                <div class="text-xs text-discord-textMuted">
                    Include audio when you share your screen (where supported).
                </div>
            </div>
            <ToggleSwitch
                checked={settingsState.shareSystemAudio}
                onChange={(v) => setShareSystemAudio(v)}
                label="Share system audio"
            />
        </div>
        <div class="mt-3">
            <div class="text-sm font-medium text-discord-textPrimary mb-1">
                Quality
            </div>
            <div class="text-xs text-discord-textMuted mb-2">
                Applies the next time you start sharing.
            </div>
            <div class="flex gap-2">
                <select
                    class={selectClass}
                    value={settingsState.screenShareResolution}
                    onchange={(e) =>
                        setScreenShareResolution(e.currentTarget.value)}
                >
                    {#each SCREEN_RESOLUTIONS as r (r.key)}
                        <option value={r.key}>{r.label}</option>
                    {/each}
                </select>
                <select
                    class={selectClass}
                    value={settingsState.screenShareFps}
                    onchange={(e) => setScreenShareFps(e.currentTarget.value)}
                >
                    {#each SCREEN_FPS_OPTIONS as f (f)}
                        <option value={String(f)}>{f} FPS</option>
                    {/each}
                </select>
            </div>
        </div>
    </section>

    <section>
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
        >
            Call sounds
        </p>
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <p class="flex-1 text-sm text-discord-textPrimary">
                Play call sounds
            </p>
            <ToggleSwitch
                checked={settingsState.callSoundsEnabled}
                onChange={(v) => {
                    setCallSoundsEnabled(v);
                    configureCallSounds({ enabled: v });
                    if (v) playCallSound("selfJoin");
                }}
                label="Play call sounds"
            />
        </div>
        <div class="mt-3 flex items-center gap-3">
            <p class="text-sm text-discord-textPrimary flex-shrink-0">
                Sound volume
            </p>
            <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                class="w-full accent-discord-accent"
                value={settingsState.callSoundsVolume}
                oninput={(e) => {
                    const v = Number(e.currentTarget.value);
                    setCallSoundsVolume(v);
                    configureCallSounds({ volume: v });
                }}
                onchange={() => playCallSound("selfJoin")}
            />
        </div>
    </section>

    <section>
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
        >
            Ringing
        </p>
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1">
                <p class="text-sm text-discord-textPrimary">
                    Ring for incoming DM calls
                </p>
                <p class="text-xs text-discord-textMuted mt-0.5">
                    Direct messages ring. Rooms never do - you join those from
                    the room itself.
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.ringEnabled}
                onChange={(v) => {
                    setRingEnabled(v);
                    configureRing({ enabled: v });
                    if (v) {
                        playRingBlip();
                        // Ringing wants an OS notification when the window is
                        // hidden; this click is the gesture that lets us ask.
                        // Surface a hint if it's blocked/unsupported so the
                        // user knows why call alerts stay silent.
                        void requestNotificationPermission().then((p) => {
                            ringNotifyHint = callAlertHint(p);
                        });
                    } else {
                        ringNotifyHint = null;
                    }
                }}
                label="Ring for incoming DM calls"
            />
        </div>
        {#if ringNotifyHint}
            <p class="text-xs text-discord-danger mt-2">{ringNotifyHint}</p>
        {/if}
        <div class="mt-3 flex items-center gap-3">
            <p class="text-sm text-discord-textPrimary flex-shrink-0">
                Ringtone volume
            </p>
            <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                class="w-full accent-discord-accent"
                value={settingsState.ringVolume}
                oninput={(e) => {
                    const v = Number(e.currentTarget.value);
                    setRingVolume(v);
                    configureRing({ volume: v });
                }}
                onchange={() => playRingPreview()}
            />
        </div>
    </section>
</div>
