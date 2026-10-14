/**
 * Zam plugin: DPDFNet noise suppression for your own microphone. Registers
 * a mic filter (zam.audio); see backend.ts for how it runs.
 */
import type { PluginModule } from "../../../src/lib/plugins/types";
import { createDpdfnet } from "./backend";

let dispose: (() => void) | null = null;

const plugin: PluginModule = {
    onload(zam) {
        const d = createDpdfnet(zam);
        dispose = d.dispose;
        zam.audio.registerMicFilter({
            id: "dpdfnet",
            label: "DPDFNet",
            description:
                "AI noise removal that runs on your device, clearer than DeepFilterNet3 but heavier: devices too slow for it use DeepFilterNet3 instead. Downloads about 25 MB the first time (in the desktop and Android apps, another 25 to 45 MB for its native runtime).",
            available: d.available,
            prepare: d.prepare,
            prefetch: d.prefetch,
            create: d.create,
        });
    },
    onunload() {
        dispose?.();
        dispose = null;
    },
};

export default plugin;
