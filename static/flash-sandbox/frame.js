// Runs Ruffle inside FlashEmbed.svelte's sandboxed iframe (see index.html).
//
// The app posts one "init" message carrying the SWF bytes and a MessagePort.
// Over the port, the app can send "suspend", and this page asks for Ruffle's
// wasm: an opaque origin cannot read /ruffle/*.wasm itself (the response has
// no CORS headers), and the CSP allows no fetches anyway.
(function () {
    "use strict";

    var WASM_PATH = /^\/ruffle\/([0-9a-f]{20}\.wasm)$/;
    var port = null;
    var player = null;
    var nextId = 0;
    var pending = new Map();

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
            // Ruffle's own limits, kept behind the sandbox: no network
            // (URLLoader/Socket), no host script access (ExternalInterface),
            // no navigation via getURL.
            player.ruffle().load({
                data: new Uint8Array(swf),
                allowNetworking: "none",
                allowScriptAccess: false,
                openUrlMode: "deny",
            });
            port.postMessage({ type: "ready" });
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
