<script lang="ts">
    import { t, type MessageKey } from "$lib/i18n";
    import { untrack } from "svelte";
    import { describeCapability } from "$lib/utils/widgets";
    import { closeModal } from "$lib/stores/interface.svelte";
    import type { WidgetPrompt } from "$lib/stores/widgetPrompts.svelte";
    import ModalDialog from "$lib/components/ui/ModalDialog.svelte";
    import Portal from "$lib/components/ui/Portal.svelte";

    // The consent prompt for one widget request. WidgetFrame mounts it while
    // `widgetPrompts.current` is set and the "widget-capabilities" slot is ours,
    // keyed by prompt id. Closing it by any route settles the prompt as a denial
    // (the prompt's close handler), so Escape and back deny.
    interface Props {
        prompt: WidgetPrompt;
    }

    let { prompt }: Props = $props();

    // Seeded once: each prompt is its own keyed instance, and the dialog is
    // modal, so the requested list cannot change under the user.
    let picked = $state<string[]>(untrack(() => [...prompt.capabilities]));
    let remember = $state(true);

    const isOpenId = untrack(() => prompt.mode === "openid");

    function approve() {
        const approved = isOpenId ? ["openid"] : [...picked];
        prompt.settle({ approved, remember });
        closeModal();
    }

    // The Deny button is an explicit refusal, recorded with the remember flag.
    function deny() {
        prompt.settle({ approved: [], remember });
        closeModal();
    }

    // Escape, backdrop and back dismiss: the prompt settles as dismissed and
    // nothing is recorded.
    function dismiss() {
        closeModal();
    }

    function capLabel(cap: string): string {
        const desc = describeCapability(cap);
        return t(desc.key as MessageKey, desc.params);
    }
</script>

<Portal>
    <ModalDialog
        onClose={dismiss}
        labelledBy="widget-capabilities-title"
        panelClass="relative flex max-h-[min(640px,90dvh)] w-full max-w-md flex-col overflow-hidden rounded-lg bg-zam-backgroundSecondary shadow-xl"
    >
        <form
            class="flex min-h-0 flex-col gap-4 overflow-y-auto p-6"
            onsubmit={(e) => {
                e.preventDefault();
                approve();
            }}
        >
            <h2
                id="widget-capabilities-title"
                class="text-lg font-bold text-zam-textPrimary"
            >
                {isOpenId
                    ? t("widgets.openId.title", { widget: prompt.widgetName })
                    : t("widgets.capabilities.title", {
                          widget: prompt.widgetName,
                      })}
            </h2>
            <p class="text-sm text-zam-textSecondary">
                {isOpenId
                    ? t("widgets.openId.description", { host: prompt.host })
                    : t("widgets.capabilities.description", {
                          host: prompt.host,
                      })}
            </p>

            {#if !isOpenId}
                <fieldset class="flex flex-col gap-2">
                    <legend class="sr-only">
                        {t("widgets.capabilities.title", {
                            widget: prompt.widgetName,
                        })}
                    </legend>
                    {#each prompt.capabilities as cap (cap)}
                        <label
                            class="flex items-start gap-2 text-sm text-zam-textPrimary"
                        >
                            <input
                                type="checkbox"
                                value={cap}
                                bind:group={picked}
                                class="mt-0.5 accent-zam-accent"
                            />
                            <span>{capLabel(cap)}</span>
                        </label>
                    {/each}
                </fieldset>
            {/if}

            <label
                class="flex items-center gap-2 text-sm text-zam-textSecondary"
            >
                <input
                    type="checkbox"
                    bind:checked={remember}
                    class="accent-zam-accent"
                />
                {t("widgets.capabilities.remember")}
            </label>

            <div class="flex items-center gap-2">
                <div class="flex-1"></div>
                <button
                    type="button"
                    onclick={deny}
                    class="rounded px-4 py-2 text-sm font-medium text-zam-textPrimary hover:underline"
                >
                    {t("widgets.capabilities.deny")}
                </button>
                <button
                    type="submit"
                    class="rounded bg-zam-accent px-4 py-2 text-sm font-medium text-white hover:bg-zam-accentHover"
                >
                    {t("widgets.capabilities.approve")}
                </button>
            </div>
        </form>
    </ModalDialog>
</Portal>
