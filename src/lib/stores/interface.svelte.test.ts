import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    interfaceState,
    openModal,
    closeModal,
    clearModalIfOwner,
    openSidebar,
    closeSidebar,
    clearSidebarIfOwner,
    openComposerPicker,
} from "./interface.svelte";

// Module-level slots persist across tests — release them before each.
beforeEach(() => {
    closeModal();
    closeSidebar();
});

describe("modal slot ownership", () => {
    it("hands back a distinct token per claim", () => {
        const a = openModal("room-menu", () => {});
        const b = openModal("room-menu", () => {});
        expect(a).not.toBe(b);
    });

    it("runs the outgoing close exactly once when a different id supersedes", () => {
        const closeA = vi.fn();
        openModal("room-menu", closeA);
        openModal("space-menu", () => {});
        expect(closeA).toHaveBeenCalledTimes(1);
        expect(interfaceState.modal).toBe("space-menu");
    });

    // Regression guard: openModal used to short-circuit on an unchanged id, so
    // a second instance took the slot while the first's close never ran,
    // stranding the first instance's UI.
    it("runs the outgoing close exactly once when the SAME id supersedes", () => {
        const closeA = vi.fn();
        openModal("call-participant-menu", closeA);
        openModal("call-participant-menu", () => {});
        expect(closeA).toHaveBeenCalledTimes(1);
    });

    it("does not run the incoming close", () => {
        const closeB = vi.fn();
        openModal("room-menu", () => {});
        openModal("room-menu", closeB);
        expect(closeB).not.toHaveBeenCalled();
    });

    it("ignores a stale token so instance A cannot clear instance B's slot", () => {
        const tokenA = openModal("call-participant-menu", () => {});
        const closeB = vi.fn();
        openModal("call-participant-menu", closeB);

        expect(clearModalIfOwner(tokenA)).toBe(false);
        expect(interfaceState.modal).toBe("call-participant-menu");
        expect(interfaceState.modalClose).toBe(closeB);
    });

    it("releases the slot for the current owner without running its close", () => {
        const closeA = vi.fn();
        const tokenA = openModal("lightbox", closeA);
        expect(clearModalIfOwner(tokenA)).toBe(true);
        expect(interfaceState.modal).toBeNull();
        expect(interfaceState.modalClose).toBeNull();
        expect(closeA).not.toHaveBeenCalled();
    });

    it("treats a token that never owned the slot as a no-op", () => {
        openModal("room-menu", () => {});
        expect(clearModalIfOwner(0)).toBe(false);
        expect(clearModalIfOwner(-1)).toBe(false);
        expect(interfaceState.modal).toBe("room-menu");
    });

    it("makes a re-clear after closeModal a no-op", () => {
        const token = openModal("room-menu", () => {});
        closeModal();
        expect(clearModalIfOwner(token)).toBe(false);
        expect(interfaceState.modal).toBeNull();
    });

    // The Lightbox teardown race: A's close unmounts A, whose destroy path then
    // calls clearModalIfOwner(tokenA). Detach-first means B is not installed
    // yet, so that release is rejected against an unowned slot; B's claim then
    // installs intact. (The stale-token-vs-already-installed-B variant is
    // covered by "ignores a stale token" above.)
    it("survives an outgoing close that clears by its own token", () => {
        let tokenA = 0;
        tokenA = openModal("lightbox", () => clearModalIfOwner(tokenA));
        const closeB = vi.fn();
        openModal("lightbox", closeB);

        expect(interfaceState.modal).toBe("lightbox");
        expect(interfaceState.modalClose).toBe(closeB);
        expect(interfaceState.lightboxOpen).toBe(true);
    });

    // ---- Ordering invariant --------------------------------------------
    // The three below pin detach-first: the outgoing close MUST run while the
    // slot is empty. They fail against an install-first ordering, which is the
    // point — the whole re-entrancy argument rests on this and nothing else
    // in the suite discriminates between the two orderings.

    it("runs the outgoing close against an empty slot", () => {
        let observedModal: unknown = "unset";
        let observedClose: unknown = "unset";
        openModal("room-menu", () => {
            observedModal = interfaceState.modal;
            observedClose = interfaceState.modalClose;
        });
        const closeB = vi.fn();
        openModal("space-menu", closeB);

        expect(observedModal).toBeNull();
        expect(observedClose).toBeNull();
        expect(interfaceState.modal).toBe("space-menu");
        expect(interfaceState.modalClose).toBe(closeB);
    });

    it("cannot be stranded by a re-entrant closeModal from the outgoing close", () => {
        openModal("lightbox", () => closeModal());
        const closeB = vi.fn();
        const tokenB = openModal("room-menu", closeB);

        expect(interfaceState.modal).toBe("room-menu");
        expect(interfaceState.modalClose).toBe(closeB);
        // The returned token must really own the slot, not a phantom.
        expect(clearModalIfOwner(tokenB)).toBe(true);
    });

    it("leaves no phantom claim when the outgoing close throws", () => {
        openModal("room-menu", () => {
            throw new Error("teardown blew up");
        });
        expect(() => openModal("space-menu", () => {})).toThrow(
            "teardown blew up",
        );
        expect(interfaceState.modal).toBeNull();
        expect(interfaceState.modalClose).toBeNull();
    });
});

describe("lightboxOpen mirrors the modal slot", () => {
    it("is true while a lightbox holds the slot", () => {
        openModal("lightbox", () => {});
        expect(interfaceState.lightboxOpen).toBe(true);
    });

    it("goes false when another modal supersedes the lightbox", () => {
        openModal("lightbox", () => {});
        openModal("profile-card", () => {});
        expect(interfaceState.lightboxOpen).toBe(false);
    });

    it("stays true across a lightbox-to-lightbox handover", () => {
        openModal("lightbox", () => {});
        openModal("lightbox", () => {});
        expect(interfaceState.lightboxOpen).toBe(true);
    });

    it("goes false when the owning token releases the slot", () => {
        const token = openModal("lightbox", () => {});
        clearModalIfOwner(token);
        expect(interfaceState.lightboxOpen).toBe(false);
    });

    it("stays true when a stale token tries to release the slot", () => {
        const tokenA = openModal("lightbox", () => {});
        openModal("lightbox", () => {});
        expect(clearModalIfOwner(tokenA)).toBe(false);
        expect(interfaceState.lightboxOpen).toBe(true);
        expect(interfaceState.modal).toBe("lightbox");
    });

    it("goes false on closeModal", () => {
        openModal("lightbox", () => {});
        closeModal();
        expect(interfaceState.lightboxOpen).toBe(false);
    });
});

describe("sidebar slot ownership", () => {
    it("runs the outgoing close when the SAME id supersedes", () => {
        const closeA = vi.fn();
        openSidebar("members", closeA);
        openSidebar("members", () => {});
        expect(closeA).toHaveBeenCalledTimes(1);
    });

    it("ignores a stale token", () => {
        const tokenA = openSidebar("members", () => {});
        openSidebar("members", () => {});
        expect(clearSidebarIfOwner(tokenA)).toBe(false);
        expect(interfaceState.sidebar).toBe("members");
    });

    it("releases the slot for the current owner", () => {
        const token = openSidebar("pinned", () => {});
        expect(clearSidebarIfOwner(token)).toBe(true);
        expect(interfaceState.sidebar).toBeNull();
    });

    // Same ordering invariant as the modal slot — see above.
    it("runs the outgoing close against an empty slot", () => {
        let observedSidebar: unknown = "unset";
        let observedClose: unknown = "unset";
        openSidebar("members", () => {
            observedSidebar = interfaceState.sidebar;
            observedClose = interfaceState.sidebarClose;
        });
        const closeB = vi.fn();
        openSidebar("threads", closeB);

        expect(observedSidebar).toBeNull();
        expect(observedClose).toBeNull();
        expect(interfaceState.sidebar).toBe("threads");
        expect(interfaceState.sidebarClose).toBe(closeB);
    });
});

describe("openComposerPicker", () => {
    it("switches kinds without the handover wiping the new kind", () => {
        openComposerPicker("emoji");
        openComposerPicker("sticker");
        expect(interfaceState.modal).toBe("composer-picker");
        expect(interfaceState.composerPicker).toBe("sticker");
    });

    it("toggles off when the same kind is requested again", () => {
        openComposerPicker("emoji");
        openComposerPicker("emoji");
        expect(interfaceState.modal).toBeNull();
        expect(interfaceState.composerPicker).toBeNull();
    });
});
