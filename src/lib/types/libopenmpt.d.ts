/**
 * The Emscripten build of libopenmpt that chiptune3 ships (the wasm is
 * inlined). Only the parts of the C API trackerRender.worker.ts calls.
 * https://lib.openmpt.org/doc/group__libopenmpt__c.html
 */
declare module "chiptune3/libopenmpt.worklet.js" {
    interface Libopenmpt {
        HEAPU8: Uint8Array;
        _malloc(size: number): number;
        _free(ptr: number): void;
        /** Returns a module pointer, or 0 when the file can't be loaded. */
        _openmpt_module_create_from_memory(
            filedata: number,
            filesize: number,
            logfunc: number,
            user: number,
            ctls: number,
        ): number;
        _openmpt_module_destroy(mod: number): void;
        _openmpt_module_set_repeat_count(mod: number, count: number): number;
        /** Frames written to `interleaved` (int16 L/R pairs); 0 at the end. */
        _openmpt_module_read_interleaved_stereo(
            mod: number,
            sampleRate: number,
            count: number,
            interleaved: number,
        ): number;
    }
    const createLibopenmpt: () => Promise<Libopenmpt>;
    export default createLibopenmpt;
}
