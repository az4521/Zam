// Discord's list of detectable games (electron/discordGames.json, refreshed by
// scripts/update-detectable.mjs): names and icons by application id, and the
// executables that identify each game on this platform.

const fs = require("fs");
const path = require("path");

let cached = null;

/** Names/icons by id, and executables by (lowercased) file name. */
async function loadGames(platform = process.platform) {
    if (cached && cached.platform === platform) return cached;
    const byId = new Map();
    const byExe = new Map(); // name -> [{ id, exact, args }]
    try {
        const raw = await fs.promises.readFile(
            path.join(__dirname, "discordGames.json"),
            "utf8",
        );
        for (const game of JSON.parse(raw)) {
            byId.set(game.id, { name: game.name, icon: game.icon });
            for (const exe of game.exe) {
                if (exe.os !== platform) continue;
                // A leading ">" means "the file name must be exactly this".
                const exact = exe.name.startsWith(">");
                const key = (
                    exact ? exe.name.slice(1) : exe.name
                ).toLowerCase();
                let list = byExe.get(key);
                if (!list) byExe.set(key, (list = []));
                list.push({ id: game.id, exact, args: exe.args });
            }
        }
    } catch {
        // No list: scanning finds nothing and apps simply go unnamed.
    }
    cached = { platform, byId, byExe };
    return cached;
}

module.exports = { loadGames };
