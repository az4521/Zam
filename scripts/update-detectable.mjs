#!/usr/bin/env node
/**
 * Refresh electron/discordGames.json, the list of games Discord can detect by
 * their executable (used by Settings > General > Rich presence to name games
 * and find their icons). It comes from Discord's public endpoint, the same
 * list arRPC (MIT, https://github.com/OpenAsar/arrpc) ships, cut down to the
 * fields we use: launchers are dropped, and so are entries with no executable.
 *
 *   node scripts/update-detectable.mjs
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const URL = "https://discord.com/api/v9/applications/detectable";
const OUT = join(process.cwd(), "electron", "discordGames.json");

const res = await fetch(URL);
if (!res.ok) throw new Error(`${URL}: ${res.status}`);
const all = await res.json();

const games = all
    .map((a) => ({
        id: a.id,
        name: a.name,
        icon: a.icon_hash || null,
        exe: (a.executables || [])
            .filter((x) => !x.is_launcher)
            .map((x) => ({
                os: x.os,
                name: x.name,
                ...(x.arguments ? { args: x.arguments } : {}),
            })),
    }))
    .filter((a) => a.exe.length > 0);

writeFileSync(OUT, JSON.stringify(games));
console.log(`${games.length} games written to ${OUT}`);
