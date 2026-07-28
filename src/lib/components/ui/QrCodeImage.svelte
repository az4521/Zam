<script lang="ts">
    import QRCode from "qrcode";
    import { qrModulePath, qrViewBoxSize } from "$lib/utils/qrCode";

    let {
        bytes,
        label = "QR code for device verification",
    }: { bytes: Uint8ClampedArray; label?: string } = $props();

    // `QRCode.create` is synchronous, so this stays a plain $derived. Error
    // correction "L" keeps the symbol small: the Matrix payload is ~100 bytes
    // and a denser symbol is harder to scan on a phone at arm's length.
    const symbol = $derived.by(() => {
        // An empty payload does NOT throw: the encoder happily emits a valid
        // 21x21 symbol with real finder patterns, so the catch below never fires
        // and the user would stare at a code that can never verify. Refuse it
        // here, symmetrically with `toQrPayloadBytes` on the scanning side.
        if (bytes.length === 0) return null;
        try {
            const qr = QRCode.create([{ mode: "byte", data: bytes }], {
                errorCorrectionLevel: "L",
            });
            const box = qrViewBoxSize(qr.modules.size);
            const path = qrModulePath(qr.modules.size, qr.modules.data);
            return path && box ? { path, box } : null;
        } catch (e) {
            // Log the raw encoder error the way crypto.ts's
            // `verificationFailureText` does: the copy below is deliberately
            // vague, so without this a bug report has nothing to go on.
            console.warn("[matrix] could not encode the verification QR", e);
            return null;
        }
    });
</script>

{#if symbol}
    <!-- Fixed light background with dark modules in BOTH themes: an inverted
         QR (light modules on a dark field) is rejected by many scanners. -->
    <svg
        viewBox="0 0 {symbol.box} {symbol.box}"
        role="img"
        aria-label={label}
        class="h-48 w-48 rounded bg-white p-2"
        shape-rendering="crispEdges"
    >
        <path d={symbol.path} fill="#000000" />
    </svg>
{:else}
    <p class="text-xs text-discord-danger" role="alert">
        Could not render the verification code.
    </p>
{/if}
