import { describe, it, expect, vi, afterEach } from "vitest";
import { collectMemberDecorations, visibleUserActions } from "./pluginMembers";
import type {
    MemberDecorator,
    UserActionContext,
    UserActionItem,
} from "./types";

const ctx = { roomId: "!r:x", userId: "@u:x" };
const actionCtx = { ...ctx } as UserActionContext;

afterEach(() => {
    vi.restoreAllMocks();
});

describe("collectMemberDecorations", () => {
    it("returns null with no decorators", () => {
        expect(collectMemberDecorations([], ctx)).toBeNull();
    });

    it("returns null when every decorator returns null", () => {
        const decorators: MemberDecorator[] = [() => null, () => null];
        expect(collectMemberDecorations(decorators, ctx)).toBeNull();
    });

    it("collects badges in registration order", () => {
        const decorators: MemberDecorator[] = [
            () => ({ badge: "A" }),
            () => null,
            () => ({ badge: "B" }),
        ];
        expect(collectMemberDecorations(decorators, ctx)).toEqual({
            badges: ["A", "B"],
            subtitle: null,
            tooltip: null,
        });
    });

    it("uses the first non-empty subtitle", () => {
        const decorators: MemberDecorator[] = [
            () => ({ subtitle: "" }),
            () => ({ subtitle: "first" }),
            () => ({ subtitle: "second" }),
        ];
        expect(collectMemberDecorations(decorators, ctx)?.subtitle).toBe(
            "first",
        );
    });

    it("joins tooltips with newlines", () => {
        const decorators: MemberDecorator[] = [
            () => ({ tooltip: "one" }),
            () => ({ tooltip: "two" }),
            () => ({ tooltip: "" }),
        ];
        expect(collectMemberDecorations(decorators, ctx)?.tooltip).toBe(
            "one\ntwo",
        );
    });

    it("ignores empty badges", () => {
        const decorators: MemberDecorator[] = [() => ({ badge: "" })];
        expect(collectMemberDecorations(decorators, ctx)).toBeNull();
    });

    it("truncates a badge to 24 characters", () => {
        const long = "b".repeat(40);
        const view = collectMemberDecorations([() => ({ badge: long })], ctx);
        expect(view?.badges).toEqual(["b".repeat(24)]);
    });

    it("truncates a subtitle to 128 characters", () => {
        const long = "s".repeat(300);
        const view = collectMemberDecorations(
            [() => ({ subtitle: long })],
            ctx,
        );
        expect(view?.subtitle).toBe("s".repeat(128));
    });

    it("passes the room and user to each decorator", () => {
        const spy = vi.fn(() => null);
        collectMemberDecorations([spy], ctx);
        expect(spy).toHaveBeenCalledWith(ctx);
    });

    it("skips a throwing decorator and keeps the others", () => {
        const err = vi.spyOn(console, "error").mockImplementation(() => {});
        const decorators: MemberDecorator[] = [
            () => {
                throw new Error("boom");
            },
            () => ({ badge: "ok", tooltip: "still here" }),
        ];
        expect(collectMemberDecorations(decorators, ctx)).toEqual({
            badges: ["ok"],
            subtitle: null,
            tooltip: "still here",
        });
        expect(err).toHaveBeenCalledOnce();
    });
});

const action = (id: string, when?: UserActionItem["when"]): UserActionItem => ({
    id,
    label: id,
    when,
    onSelect() {},
});

describe("visibleUserActions", () => {
    it("shows an action with no when()", () => {
        const a = action("a");
        expect(visibleUserActions([a], actionCtx)).toEqual([a]);
    });

    it("hides an action whose when() returns false", () => {
        const shown = action("shown", () => true);
        const hidden = action("hidden", () => false);
        expect(
            visibleUserActions([shown, hidden], actionCtx).map((a) => a.id),
        ).toEqual(["shown"]);
    });

    it("hides an action whose when() throws, and logs it", () => {
        const err = vi.spyOn(console, "error").mockImplementation(() => {});
        const broken = action("broken", () => {
            throw new Error("nope");
        });
        expect(visibleUserActions([broken], actionCtx)).toEqual([]);
        expect(err).toHaveBeenCalledOnce();
    });

    it("passes the context to when()", () => {
        const when = vi.fn(() => true);
        visibleUserActions([action("a", when)], actionCtx);
        expect(when).toHaveBeenCalledWith(actionCtx);
    });
});
