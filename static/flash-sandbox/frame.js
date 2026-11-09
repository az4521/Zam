// Runs Ruffle inside FlashEmbed.svelte's sandboxed iframe (see index.html).
//
// The app posts one "init" message carrying the SWF bytes and a MessagePort.
// Over the port, the app can send "suspend" and "volume", and this page asks
// for Ruffle's wasm: an opaque origin cannot read /ruffle/*.wasm itself (the
// response has no CORS headers), and the CSP allows no fetches anyway.
//
// Ruffle fires no event when its volume changes, so the page polls it and
// reports changes (from Ruffle's own menu) to the app, which remembers them.
(function () {
    "use strict";

    var WASM_PATH = /^\/ruffle\/([0-9a-f]{20}\.wasm)$/;
    var VOLUME_POLL_MS = 1000;
    var port = null;
    var player = null;
    var nextId = 0;
    var pending = new Map();
    // The volume we last set or read, so a poll only reports real changes.
    var volume = null;
    // The level the app asked for; applied again once the movie has loaded.
    var wantedVolume = null;

    function setVolume(value) {
        if (!player) return;
        // Ruffle's own volume menu reads this internal record, not the
        // instance, so keep it in step or the slider opens at 100%.
        var settings = player.volumeSettings;
        if (settings && typeof settings.volume === "number") {
            settings.volume = Math.round(value * 100);
            settings.isMuted = false;
        }
        player.volume = value;
        volume = player.volume;
    }

    function pollVolume() {
        if (!player || !port) return;
        var v = player.volume;
        if (typeof v !== "number" || v === volume) return;
        volume = v;
        port.postMessage({ type: "volume", value: v });
    }

    // Ruffle's wasm loader goes through fetch; serve its two files from the
    // app and refuse everything else.
    self.fetch = function (input) {
        // Ruffle passes a URL object; a Request has .url.
        var url = new URL(
            input instanceof Request ? input.url : String(input),
            location.href,
        );
        var m = WASM_PATH.exec(url.pathname);
        if (!m || !port)
            return Promise.reject(new TypeError("no network in the sandbox"));
        var id = nextId++;
        return new Promise(function (resolve, reject) {
            pending.set(id, { resolve: resolve, reject: reject });
            port.postMessage({ type: "wasm", id: id, name: m[1] });
        }).then(function (bytes) {
            return new Response(bytes, {
                headers: { "Content-Type": "application/wasm" },
            });
        });
    };

    function onPortMessage(e) {
        var msg = e.data || {};
        if (msg.type === "wasm" && pending.has(msg.id)) {
            var p = pending.get(msg.id);
            pending.delete(msg.id);
            if (msg.bytes) p.resolve(msg.bytes);
            else p.reject(new TypeError("wasm unavailable"));
        } else if (msg.type === "suspend" && player) {
            player.ruffle().suspend();
        } else if (
            msg.type === "volume" &&
            typeof msg.value === "number" &&
            msg.value >= 0 &&
            msg.value <= 1
        ) {
            wantedVolume = msg.value;
            setVolume(msg.value);
        }
    }

    function start(swf) {
        // Never scan this page for <object>/<embed> to take over.
        window.RufflePlayer = { config: { polyfills: false } };
        var script = document.createElement("script");
        script.src = "/ruffle/ruffle.js";
        script.onload = function () {
            player = window.RufflePlayer.newest().createPlayer();
            player.style.width = "100%";
            player.style.height = "100%";
            document.body.appendChild(player);
            volume = player.volume;
            // Ruffle's own limits, kept behind the sandbox: no network
            // (URLLoader/Socket), no host script access (ExternalInterface),
            // no navigation via getURL.
            // Promise.resolve: load() may or may not return a promise.
            Promise.resolve(
                player.ruffle().load({
                    data: new Uint8Array(swf),
                    allowNetworking: "none",
                    allowScriptAccess: false,
                    openUrlMode: "deny",
                }),
            ).then(function () {
                // Ruffle may reset its volume while the movie loads.
                if (wantedVolume !== null) setVolume(wantedVolume);
                else volume = player.volume;
            });
            port.postMessage({ type: "ready" });
            setInterval(pollVolume, VOLUME_POLL_MS);
        };
        document.head.appendChild(script);
    }

    window.addEventListener("message", function onInit(e) {
        var msg = e.data || {};
        if (e.source !== window.parent || msg.type !== "init" || !e.ports[0])
            return;
        window.removeEventListener("message", onInit);
        port = e.ports[0];
        port.onmessage = onPortMessage;
        start(msg.swf);
    });
})();
