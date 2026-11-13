<script lang="ts">
    import { presenceFor } from "$lib/stores/presence.svelte";

    interface Props {
        ids: string[];
        onRender: (id: string) => void;
        // Read through one $derived over every id, as RoomList's DM presence
        // map does, instead of from the template per row.
        viaDerived?: boolean;
    }

    let { ids, onRender, viaDerived = false }: Props = $props();

    const states = $derived.by(() => {
        if (!viaDerived) return null;
        const map = new Map<string, string>();
        for (const id of ids) {
            onRender(id);
            map.set(id, presenceFor(id)?.state ?? "offline");
        }
        return map;
    });
</script>

{#each ids as id (id)}
    <span data-id={id}
        >{states
            ? states.get(id)
            : (onRender(id), presenceFor(id)?.state ?? "offline")}</span
    >
{/each}
