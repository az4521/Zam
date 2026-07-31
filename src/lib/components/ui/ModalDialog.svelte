<script lang="ts">
    import type { Snippet } from "svelte";
    import { focusTrap } from "$lib/actions/focusTrap";

    interface Props {
        /** Dismiss the dialog. Wired to the backdrop and (by default) Escape. */
        onClose: () => void;
        /**
         * id of the element that names the dialog — normally its `<h2>`.
         * Prefer this over `label` whenever there is a visible title.
         */
        labelledBy?: string;
        /** Accessible name for a dialog with no visible title element. */
        label?: string;
        /**
         * Set false for a dialog with internal navigation state that AppShell's
         * global `dismissTopmost()` must pop first — the AppSettings /
         * RoomSettings precedent. The trap then lets Escape bubble.
         */
        handlesEscape?: boolean;
        /** Extra classes for the full-viewport layer (positioning of children). */
        layerClass?: string;
        /** Backdrop skin. Pass "" for an invisible click-catcher. */
        backdropClass?: string;
        /**
         * The panel's own classes — sizing, skin AND its position utility.
         * Deliberately not defaulted to a position utility beyond `relative`:
         * `relative` and `absolute` are the same Tailwind group, so a baked-in
         * one would fight a caller's override on CSS source order rather than
         * attribute order.
         */
        panelClass?: string;
        /** Accessible name of the backdrop close control. */
        closeLabel?: string;
        /** Key handler on the panel, for dialogs that submit on Enter. */
        onKeydown?: (event: KeyboardEvent) => void;
        children: Snippet;
    }

    let {
        onClose,
        labelledBy = undefined,
        label = undefined,
        handlesEscape = true,
        layerClass = "z-50 flex items-center justify-center",
        backdropClass = "bg-black/60",
        panelClass = "relative",
        closeLabel = "Close dialog",
        onKeydown = undefined,
        children,
    }: Props = $props();
</script>

<!--
  The one shared dialog shell, extracted from the idiom nine dialogs already
  hand-roll correctly (InviteModal, CreatePollDialog, …): a `fixed inset-0`
  layer, a real <button> backdrop that is a SIBLING of the panel (a button may
  not contain interactive content, and nesting would force a stopPropagation
  on the panel), and a panel carrying role/aria-modal/name plus the focus trap
  that also owns Escape and restores focus to the opener on destroy.
-->
<div class="fixed inset-0 {layerClass}">
    <button
        type="button"
        aria-label={closeLabel}
        class="absolute inset-0 {backdropClass}"
        onclick={onClose}
    ></button>
    <!--
      `tabindex="-1"`: the panel carries an interactive role AND a key handler,
      so Svelte's a11y_interactive_supports_focus rule requires it be able to
      take focus. It is also what the APG asks of a dialog container and what
      `focusTrap` already sets at runtime when a panel has nothing focusable
      inside. Negative, so it stays out of the tab order and out of the trap's
      focusable list (its selector excludes `[tabindex="-1"]`).
    -->
    <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={label}
        tabindex="-1"
        class="z-10 {panelClass}"
        onkeydown={onKeydown}
        use:focusTrap={handlesEscape ? { onEscape: onClose } : {}}
    >
        {@render children()}
    </div>
</div>
