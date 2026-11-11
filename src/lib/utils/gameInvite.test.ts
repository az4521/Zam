import { describe, it, expect } from "vitest";
import {
    GAME_INVITE_KEY,
    buildGameInvite,
    gameInviteBody,
    gameInviteOf,
    gameInvitePayload,
    parseGameInvite,
    steamJoinLink,
    type GameInvite,
} from "./gameInvite";

const steamGame: GameInvite = {
    name: "Team Fortress 2",
    details: "Payload",
    state: "Map: pl_upward",
    partySize: [3, 24],
    steam: { appId: "440", connect: "+connect 10.0.0.1:27015" },
};

const FRIEND = "76561198000000001";
const LOBBY = "109775240000000000";

/** A valid Steam invite's structured value, to break one field at a time. */
const steamWire = () => ({
    app: { name: "Team Fortress 2", source: "steam" },
    steam: { app_id: "440", connect: "+connect 10.0.0.1:27015" },
});

describe("game invite key", () => {
    it("is the custom content key Zam reads", () => {
        expect(GAME_INVITE_KEY).toBe("moe.crafty.matrix.game_invite");
    });
});

describe("steamJoinLink", () => {
    it("opens the friend's lobby when the invite has one, as Steam's button does", () => {
        expect(
            steamJoinLink({ appId: "440", steamId: FRIEND, lobbyId: LOBBY }),
        ).toBe(`steam://joinlobby/440/${LOBBY}/${FRIEND}`);
        // A connect string does not change a lobby join.
        expect(
            steamJoinLink({
                appId: "440",
                steamId: FRIEND,
                lobbyId: LOBBY,
                connect: "+connect x",
            }),
        ).toBe(`steam://joinlobby/440/${LOBBY}/${FRIEND}`);
    });

    it("joins the friend's game with the encoded connect string otherwise", () => {
        expect(
            steamJoinLink({
                appId: "440",
                steamId: FRIEND,
                connect: "+connect 10.0.0.1:27015",
            }),
        ).toBe(`steam://rungame/440/${FRIEND}/%2Bconnect%2010.0.0.1%3A27015`);
    });

    it("falls back to the run link without a Steam id", () => {
        expect(
            steamJoinLink({
                appId: "440",
                connect: "+connect 10.0.0.1:27015",
            }),
        ).toBe("steam://run/440//%2Bconnect%2010.0.0.1%3A27015/");
    });
});

describe("gameInviteBody", () => {
    it("links the game with a steam:// run URL, encoding the connect string", () => {
        expect(gameInviteBody(steamGame, "Ann")).toBe(
            "Ann invited you to join Team Fortress 2: steam://run/440//%2Bconnect%2010.0.0.1%3A27015/",
        );
    });

    it("links the friend's game with the join link when the Steam id is known", () => {
        const game: GameInvite = {
            ...steamGame,
            steam: { ...steamGame.steam, steamId: FRIEND },
        };
        expect(gameInviteBody(game, "Ann")).toBe(
            `Ann invited you to join Team Fortress 2: steam://rungame/440/${FRIEND}/%2Bconnect%2010.0.0.1%3A27015`,
        );
    });

    it("links the lobby when the invite has one", () => {
        const game: GameInvite = {
            ...steamGame,
            steam: { appId: "440", steamId: FRIEND, lobbyId: LOBBY },
        };
        expect(gameInviteBody(game, "Ann")).toBe(
            `Ann invited you to join Team Fortress 2: steam://joinlobby/440/${LOBBY}/${FRIEND}`,
        );
    });

    it("caps the sender name it writes", () => {
        const body = gameInviteBody(steamGame, "n".repeat(300));
        expect(body.startsWith("n".repeat(100) + " invited")).toBe(true);
    });
});

describe("buildGameInvite", () => {
    it("is a text message: a body for everyone plus the structured invite", () => {
        expect(buildGameInvite(steamGame, "Ann", "come on")).toEqual({
            msgtype: "m.text",
            body: gameInviteBody(steamGame, "Ann"),
            [GAME_INVITE_KEY]: {
                app: { name: "Team Fortress 2", source: "steam" },
                steam: { app_id: "440", connect: "+connect 10.0.0.1:27015" },
                details: "Payload",
                state: "Map: pl_upward",
                party_size: [3, 24],
                note: "come on",
            },
        });
    });

    it("leaves out empty optional fields", () => {
        const payload = gameInvitePayload({
            name: "Team Fortress 2",
            steam: { appId: "440", connect: "+connect x" },
        });
        expect(payload).toEqual({
            app: { name: "Team Fortress 2", source: "steam" },
            steam: { app_id: "440", connect: "+connect x" },
        });
    });

    it("builds content that reads back to the same game", () => {
        const parsed = gameInviteOf(buildGameInvite(steamGame, "Ann", "hi"));
        expect(parsed).toEqual({ ...steamGame, note: "hi" });
    });

    it("sends the Steam id and lobby as steam_id and lobby_id", () => {
        const game: GameInvite = {
            name: "Team Fortress 2",
            steam: { appId: "440", steamId: FRIEND, lobbyId: LOBBY },
        };
        expect(gameInvitePayload(game)).toEqual({
            app: { name: "Team Fortress 2", source: "steam" },
            steam: { app_id: "440", steam_id: FRIEND, lobby_id: LOBBY },
        });
        expect(gameInviteOf(buildGameInvite(game, "Ann"))).toEqual(game);
    });
});

describe("gameInviteOf", () => {
    it("reads the invite under the key of a message's content", () => {
        expect(gameInviteOf(buildGameInvite(steamGame, "Ann"))).toEqual(
            steamGame,
        );
    });

    it("is null for a plain message or a malformed invite", () => {
        expect(gameInviteOf({ msgtype: "m.text", body: "hi" })).toBeNull();
        expect(
            gameInviteOf({ msgtype: "m.text", [GAME_INVITE_KEY]: "nope" }),
        ).toBeNull();
        expect(gameInviteOf(null)).toBeNull();
        expect(gameInviteOf("text")).toBeNull();
    });
});

describe("parseGameInvite", () => {
    it("accepts a valid Steam invite with its details", () => {
        expect(
            parseGameInvite({
                ...steamWire(),
                details: "Payload",
                party_size: [0, 24],
                note: "come on",
            }),
        ).toEqual({
            name: "Team Fortress 2",
            steam: { appId: "440", connect: "+connect 10.0.0.1:27015" },
            details: "Payload",
            partySize: [0, 24],
            note: "come on",
        });
    });

    it("accepts a bare Steam invite", () => {
        expect(parseGameInvite(steamWire())).toEqual({
            name: "Team Fortress 2",
            steam: { appId: "440", connect: "+connect 10.0.0.1:27015" },
        });
    });

    it("rejects non-object values", () => {
        expect(parseGameInvite(null)).toBeNull();
        expect(parseGameInvite("invite")).toBeNull();
        expect(parseGameInvite([steamWire()])).toBeNull();
        expect(parseGameInvite(undefined)).toBeNull();
    });

    it("rejects an app block that is missing, empty or not an object", () => {
        const { app: _, ...noApp } = steamWire();
        expect(parseGameInvite(noApp)).toBeNull();
        expect(parseGameInvite({ ...steamWire(), app: "Game" })).toBeNull();
        expect(
            parseGameInvite({
                ...steamWire(),
                app: { name: "", source: "steam" },
            }),
        ).toBeNull();
        expect(
            parseGameInvite({
                ...steamWire(),
                app: { name: "x".repeat(101), source: "steam" },
            }),
        ).toBeNull();
        expect(
            parseGameInvite({
                ...steamWire(),
                app: { name: 3, source: "steam" },
            }),
        ).toBeNull();
    });

    it("accepts only the Steam source", () => {
        for (const source of ["discord", "epic", undefined]) {
            expect(
                parseGameInvite({
                    ...steamWire(),
                    app: { name: "Game", source },
                }),
            ).toBeNull();
        }
    });

    it("rejects any Discord block, even alongside a Steam one", () => {
        expect(
            parseGameInvite({
                ...steamWire(),
                discord: { application_id: "1", secret: "s" },
            }),
        ).toBeNull();
        expect(
            parseGameInvite({
                app: { name: "Game", source: "steam" },
                discord: { application_id: "1", secret: "s" },
            }),
        ).toBeNull();
    });

    it("needs a Steam block", () => {
        const { steam: _, ...noSteam } = steamWire();
        expect(parseGameInvite(noSteam)).toBeNull();
        expect(parseGameInvite({ ...steamWire(), steam: "440" })).toBeNull();
        expect(parseGameInvite({ ...steamWire(), steam: null })).toBeNull();
    });

    describe("steam block", () => {
        it("accepts only a numeric app id of up to 20 digits", () => {
            const with_ = (app_id: unknown) => ({
                ...steamWire(),
                steam: { app_id, connect: "+connect x" },
            });
            expect(parseGameInvite(with_("440"))).not.toBeNull();
            expect(parseGameInvite(with_("1".repeat(20)))).not.toBeNull();
            expect(parseGameInvite(with_("1".repeat(21)))).toBeNull();
            expect(parseGameInvite(with_("440 ; rm"))).toBeNull();
            expect(parseGameInvite(with_("-1"))).toBeNull();
            expect(parseGameInvite(with_("1e3"))).toBeNull();
            expect(parseGameInvite(with_(440))).toBeNull();
            expect(parseGameInvite(with_(""))).toBeNull();
        });

        it("bounds the connect string to 1..512 characters", () => {
            const with_ = (connect: unknown) => ({
                ...steamWire(),
                steam: { app_id: "440", connect },
            });
            expect(parseGameInvite(with_(""))).toBeNull();
            expect(parseGameInvite(with_("c".repeat(513)))).toBeNull();
            expect(parseGameInvite(with_("c".repeat(512)))).not.toBeNull();
            expect(parseGameInvite(with_(undefined))).toBeNull();
        });

        it("rejects control characters in the connect string", () => {
            const bad = [
                "+connect\n10.0.0.1",
                "+connect\t10.0.0.1",
                "+connect\u0000x",
                "+connect\x1b[31m",
                "+connect\x7fx",
            ];
            for (const connect of bad) {
                expect(
                    parseGameInvite({
                        ...steamWire(),
                        steam: { app_id: "440", connect },
                    }),
                ).toBeNull();
                // The same holds when a Steam id is there too.
                expect(
                    parseGameInvite({
                        ...steamWire(),
                        steam: { app_id: "440", steam_id: FRIEND, connect },
                    }),
                ).toBeNull();
            }
        });

        it("accepts an old invite without a Steam id, with its connect string", () => {
            expect(parseGameInvite(steamWire())).toEqual({
                name: "Team Fortress 2",
                steam: { appId: "440", connect: "+connect 10.0.0.1:27015" },
            });
            expect(parseGameInvite(steamWire())?.steam.steamId).toBeUndefined();
        });

        it("reads the Steam id and lobby, digits only", () => {
            expect(
                parseGameInvite({
                    ...steamWire(),
                    steam: {
                        app_id: "440",
                        steam_id: FRIEND,
                        lobby_id: LOBBY,
                        connect: "+connect x",
                    },
                })?.steam,
            ).toEqual({
                appId: "440",
                steamId: FRIEND,
                lobbyId: LOBBY,
                connect: "+connect x",
            });
            for (const bad of ["7656 1", "../x", "1".repeat(21), "", 5]) {
                expect(
                    parseGameInvite({
                        ...steamWire(),
                        steam: { app_id: "440", steam_id: bad, connect: "c" },
                    }),
                ).toBeNull();
                expect(
                    parseGameInvite({
                        ...steamWire(),
                        steam: { app_id: "440", lobby_id: bad, connect: "c" },
                    }),
                ).toBeNull();
            }
        });

        it("needs a connect string unless it has both a Steam id and a lobby", () => {
            const steam = { app_id: "440", steam_id: FRIEND };
            expect(parseGameInvite({ ...steamWire(), steam })).toBeNull();
            expect(
                parseGameInvite({
                    ...steamWire(),
                    steam: { ...steam, lobby_id: LOBBY },
                }),
            ).toEqual({
                name: "Team Fortress 2",
                steam: { appId: "440", steamId: FRIEND, lobbyId: LOBBY },
            });
        });
    });

    describe("optional fields", () => {
        it("bounds details to 200 and state to 200 characters", () => {
            expect(
                parseGameInvite({ ...steamWire(), details: "d".repeat(201) }),
            ).toBeNull();
            expect(
                parseGameInvite({ ...steamWire(), state: "s".repeat(201) }),
            ).toBeNull();
            expect(
                parseGameInvite({ ...steamWire(), details: "d".repeat(200) }),
            ).not.toBeNull();
        });

        it("rejects non-string details and state", () => {
            expect(parseGameInvite({ ...steamWire(), details: 5 })).toBeNull();
            expect(
                parseGameInvite({ ...steamWire(), state: ["x"] }),
            ).toBeNull();
        });

        it("bounds the note to 500 characters", () => {
            expect(
                parseGameInvite({ ...steamWire(), note: "n".repeat(501) }),
            ).toBeNull();
            expect(parseGameInvite({ ...steamWire(), note: 1 })).toBeNull();
            expect(
                parseGameInvite({ ...steamWire(), note: "n".repeat(500) }),
            ).not.toBeNull();
        });

        it("drops an empty note rather than keeping it", () => {
            const parsed = parseGameInvite({ ...steamWire(), note: "" });
            expect(parsed).not.toBeNull();
            expect(parsed).not.toHaveProperty("note");
        });

        it("accepts party_size only as two non-negative safe integers", () => {
            const with_ = (party_size: unknown) => ({
                ...steamWire(),
                party_size,
            });
            expect(parseGameInvite(with_([2, 4]))?.partySize).toEqual([2, 4]);
            expect(parseGameInvite(with_([2]))).toBeNull();
            expect(parseGameInvite(with_([2, 4, 6]))).toBeNull();
            expect(parseGameInvite(with_("2/4"))).toBeNull();
            expect(parseGameInvite(with_([-1, 4]))).toBeNull();
            expect(parseGameInvite(with_([1.5, 4]))).toBeNull();
            expect(parseGameInvite(with_(["2", "4"]))).toBeNull();
            expect(parseGameInvite(with_([2, Number.NaN]))).toBeNull();
            expect(parseGameInvite(with_([2, 1_000_001]))).toBeNull();
        });
    });
});

describe("game icon", () => {
    const hash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    it("round-trips a valid icon hash", () => {
        const game = {
            ...steamGame,
            steam: { ...steamGame.steam, icon: hash },
        };
        expect(parseGameInvite(gameInvitePayload(game))?.steam.icon).toBe(hash);
    });

    it("rejects an icon that is not a hash, since it becomes part of an address", () => {
        for (const icon of ["../x", "A".repeat(40), "a".repeat(39), 5, ""]) {
            const wire = steamWire();
            Object.assign(wire.steam, { icon });
            expect(parseGameInvite(wire)).toBeNull();
        }
    });
});
