import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the crypto boundary so the store can be driven without a real SDK.
vi.mock("$lib/matrix/crypto", () => ({
    startUserVerification: vi.fn(),
    startDeviceVerification: vi.fn(),
    onIncomingVerificationRequest: vi.fn(() => () => {}),
    getPendingVerificationControllers: vi.fn(() => []),
}));

import {
    getPendingVerificationControllers,
    onIncomingVerificationRequest,
} from "$lib/matrix/crypto";
import {
    verificationState,
    acceptIncoming,
    declineIncoming,
    closeActive,
    initVerification,
} from "./verification.svelte";

function fakeController(id: string, phase = "Ready") {
    const subs = new Set<() => void>();
    const controller = {
        id,
        _phase: phase,
        view() {
            return {
                id,
                phase: controller._phase,
                initiatedByMe: false,
                otherUserId: "@other:example.com",
                otherDeviceId: null,
                isSelfVerification: false,
                sasEmoji: null,
                methodOptions: {
                    canScan: false,
                    canShow: false,
                    shouldAutoStartSas: false,
                },
                startPending: false,
                qrBytes: null,
                awaitingReciprocateConfirm: false,
                qrError: null,
            } as any;
        },
        subscribe(cb: () => void) {
            subs.add(cb);
            return () => subs.delete(cb);
        },
        emitChange() {
            for (const cb of subs) cb();
        },
        subscriberCount: () => subs.size,
        accept: vi.fn(async () => {
            // Simulate accept changing phase to Ready
            controller._phase = "Ready";
        }),
        confirm: vi.fn(async () => {}),
        mismatch: vi.fn(),
        cancel: vi.fn(() => {
            controller._phase = "Cancelled";
        }),
        startSas: vi.fn(async () => {}),
        showQrCode: vi.fn(async () => {}),
        submitScannedQr: vi.fn(async () => {}),
        confirmReciprocate: vi.fn(),
        denyReciprocate: vi.fn(),
        dispose: vi.fn(() => {
            subs.clear();
        }),
    };
    return controller;
}

describe("verification store lifecycle", () => {
    beforeEach(() => {
        // Reset the store state between tests
        verificationState.verificationTick = 0;
        verificationState.active = null;
        verificationState.incoming = [];
        verificationState.accepting = null;
        verificationState.acceptErrors = {};
        verificationState.busyRefusalId = null;
        vi.clearAllMocks();
    });

    it("a declined controller stops bumping the tick", () => {
        const controller = fakeController("test-1");

        // Simulate incoming verification by directly adding to the queue
        // (initVerification needs getPendingVerificationControllers mock)
        vi.mocked(getPendingVerificationControllers).mockReturnValue([
            controller,
        ]);
        initVerification();

        expect(verificationState.incoming).toHaveLength(1);
        expect(controller.subscriberCount()).toBe(1);

        const tickBefore = verificationState.verificationTick;

        // Decline it
        declineIncoming(controller);

        expect(verificationState.incoming).toHaveLength(0);
        expect(controller.dispose).toHaveBeenCalled();
        expect(controller.subscriberCount()).toBe(0);

        // Now emitting a change should NOT bump the tick
        const tickAfterDecline = verificationState.verificationTick;
        controller.emitChange();
        expect(verificationState.verificationTick).toBe(tickAfterDecline);
    });

    it("closing the active modal disposes and stops the tick", async () => {
        const controller = fakeController("test-2", "Ready");

        // Promote directly to active by seeding and accepting
        vi.mocked(getPendingVerificationControllers).mockReturnValue([
            controller,
        ]);
        initVerification();

        // Accept to promote to active
        await acceptIncoming(controller);
        expect(verificationState.active?.id).toBe(controller.id);
        expect(verificationState.incoming).toHaveLength(0);

        const tickBefore = verificationState.verificationTick;

        // Close the modal
        closeActive();

        expect(verificationState.active).toBeNull();
        expect(controller.dispose).toHaveBeenCalled();
        expect(controller.subscriberCount()).toBe(0);

        // Now emitting a change should NOT bump the tick
        const tickAfterClose = verificationState.verificationTick;
        controller.emitChange();
        expect(verificationState.verificationTick).toBe(tickAfterClose);
    });

    it("promotion does NOT dispose the controller mid-flow", async () => {
        const controller = fakeController("test-3");

        vi.mocked(getPendingVerificationControllers).mockReturnValue([
            controller,
        ]);
        initVerification();

        expect(controller.subscriberCount()).toBe(1);

        // Accept to promote (removeIncoming then setActive)
        await acceptIncoming(controller);

        // Should NOT have disposed
        expect(controller.dispose).not.toHaveBeenCalled();

        // Should have exactly ONE subscription (re-tracked, not doubled)
        expect(controller.subscriberCount()).toBe(1);

        // Should still be active
        expect(verificationState.active?.id).toBe(controller.id);
    });

    it("replacing active controller disposes the previous one", async () => {
        const first = fakeController("test-4a", "Ready");
        const second = fakeController("test-4b", "Ready");

        vi.mocked(getPendingVerificationControllers).mockReturnValue([first]);
        initVerification();

        await acceptIncoming(first);
        expect(verificationState.active?.id).toBe(first.id);
        expect(first.subscriberCount()).toBe(1);

        // Now accept a second one (simulating queue with both)
        verificationState.incoming = [second];
        await acceptIncoming(second);

        // First should be disposed
        expect(first.dispose).toHaveBeenCalled();
        expect(first.subscriberCount()).toBe(0);

        // Second should be active and tracked
        expect(verificationState.active?.id).toBe(second.id);
        expect(second.subscriberCount()).toBe(1);
        expect(second.dispose).not.toHaveBeenCalled();
    });
});
