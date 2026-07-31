<script lang="ts">
    // Test-only host for ModalDialog: `mount()` cannot construct a snippet, so
    // the children live here. Not referenced by application code.
    import ModalDialog from "./ModalDialog.svelte";

    let {
        onClose,
        labelledBy = undefined,
        label = undefined,
        handlesEscape = true,
        panelClass = undefined,
        onKeydown = undefined,
        nominate = false,
    }: {
        onClose: () => void;
        labelledBy?: string;
        label?: string;
        handlesEscape?: boolean;
        panelClass?: string;
        onKeydown?: (event: KeyboardEvent) => void;
        nominate?: boolean;
    } = $props();
</script>

<ModalDialog
    {onClose}
    {labelledBy}
    {label}
    {handlesEscape}
    {panelClass}
    {onKeydown}
>
    <h2 id="fixture-title">Fixture dialog</h2>
    <button type="button" id="fixture-close">Close</button>
    {#if nominate}
        <input id="fixture-search" data-autofocus />
    {:else}
        <input id="fixture-search" />
    {/if}
</ModalDialog>
