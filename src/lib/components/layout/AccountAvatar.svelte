<script lang="ts">
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import { auth } from "$lib/stores/auth.svelte";
    import { accountMediaBlobUrl } from "$lib/stores/mediaAuth.svelte";
    import type { StoredAccount } from "$lib/utils/accounts";

    interface Props {
        account: StoredAccount;
        size?: number;
    }
    let { account, size = 32 }: Props = $props();

    // The active account's media goes through the shared healer. Any other
    // account's cached avatar lives on ITS homeserver and needs ITS token, so
    // it is fetched as that account instead of going out token-less (or with
    // the active account's token, which is refused for a foreign origin).
    const isActive = $derived(account.userId === auth.userId);
    let fetched = $state<string | null>(null);

    $effect(() => {
        const url = account.avatarUrl;
        fetched = null;
        if (isActive || !url) return;
        let cancelled = false;
        let made: string | null = null;
        void accountMediaBlobUrl(url, account).then((u) => {
            if (cancelled) {
                if (u) URL.revokeObjectURL(u);
                return;
            }
            made = u;
            fetched = u;
        });
        return () => {
            cancelled = true;
            if (made) URL.revokeObjectURL(made);
        };
    });
</script>

<Avatar
    src={isActive ? (account.avatarUrl ?? null) : fetched}
    name={account.displayName ?? account.userId}
    id={account.userId}
    {size}
/>
