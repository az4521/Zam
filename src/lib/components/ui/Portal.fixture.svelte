<script lang="ts">
    import Portal from "$lib/components/ui/Portal.svelte";
</script>

<!-- The marker div stands in for a transformed ancestor (the mobile drawer):
     jsdom has no layout, so the containing-block half of the bug is not
     observable here — the DOM LOCATION is, and that is what the fix changes. -->
<div data-testid="origin">
    <Portal>
        <div data-testid="portaled">hello</div>
    </Portal>
</div>
