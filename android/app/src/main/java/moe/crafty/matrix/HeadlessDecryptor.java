package moe.crafty.matrix;

import android.annotation.SuppressLint;
import android.content.Context;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.InputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Decrypts a pushed event when the app UI is NOT running.
 *
 * The E2EE keys live in the WebView's IndexedDB crypto store, which only
 * WebView JavaScript can open. So this starts a hidden WebView on the app's
 * own origin (https://localhost, the same origin Capacitor serves the app
 * from, hence the same IndexedDB), loads the small decryptor page built by
 * scripts/build-push-decrypt.mjs, and waits for its answer.
 *
 * The page only touches the store while holding its Web Lock exclusively;
 * the app holds the same lock while it runs, so if the UI starts meanwhile
 * the two never open the store together.
 */
final class HeadlessDecryptor {

    private static final String ORIGIN = "https://localhost";
    private static final String PAGE = ORIGIN + "/push-decrypt/index.html";
    // Capacitor copies the built web app here (webDir → assets/public).
    private static final String ASSET_ROOT = "public";

    private HeadlessDecryptor() {}

    /**
     * Blocking (up to timeoutMs): must run off the main thread. Null when the
     * event cannot be decrypted here or the page does not answer in time.
     */
    static PushDecryptPlugin.Result decrypt(Context ctx, String hs, String token,
            String userId, String deviceId, String roomId, JSONObject event,
            long timeoutMs) {
        if (Looper.myLooper() == Looper.getMainLooper()) return null;
        if (deviceId == null || deviceId.isEmpty()) return null;
        final String params;
        try {
            JSONObject p = new JSONObject();
            p.put("homeserverUrl", hs);
            p.put("accessToken", token);
            p.put("userId", userId);
            p.put("deviceId", deviceId);
            p.put("roomId", roomId);
            p.put("event", event);
            params = p.toString();
        } catch (Throwable t) {
            return null;
        }

        final Context app = ctx.getApplicationContext();
        final CountDownLatch done = new CountDownLatch(1);
        final AtomicReference<String> answer = new AtomicReference<>(null);
        final AtomicReference<WebView> view = new AtomicReference<>(null);
        Handler main = new Handler(Looper.getMainLooper());

        main.post(() -> {
            try {
                view.set(createWebView(app, params, answer, done));
                view.get().loadUrl(PAGE);
            } catch (Throwable t) {
                done.countDown();
            }
        });

        try {
            done.await(timeoutMs, TimeUnit.MILLISECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        // Tear down either way: destroying the WebView also ends its JS, which
        // releases the store lock if the page was still working.
        main.post(() -> {
            WebView w = view.getAndSet(null);
            if (w != null) {
                try {
                    w.stopLoading();
                    w.destroy();
                } catch (Throwable ignored) {}
            }
        });

        String json = answer.get();
        if (json == null || json.isEmpty()) return null;
        try {
            JSONObject r = new JSONObject(json);
            String type = r.optString("type", "");
            JSONObject content = r.optJSONObject("content");
            if (type.isEmpty() || "m.room.encrypted".equals(type) || content == null) {
                return null;
            }
            return new PushDecryptPlugin.Result(type, content);
        } catch (Throwable t) {
            return null;
        }
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    private static WebView createWebView(Context app, String params,
            AtomicReference<String> answer, CountDownLatch done) {
        WebView w = new WebView(app);
        WebSettings s = w.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        w.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public String params() {
                return params;
            }

            @JavascriptInterface
            public void done(String result) {
                answer.set(result);
                done.countDown();
            }
        }, "PushDecryptHost");
        w.setWebViewClient(new WebViewClient() {
            // The page holds the access token: never let it leave our assets.
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                return true;
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest req) {
                Uri url = req.getUrl();
                if (!"https".equals(url.getScheme()) || !"localhost".equals(url.getHost())) {
                    return null; // homeserver requests go to the network
                }
                String path = url.getPath();
                if (path == null || !path.startsWith("/push-decrypt/") || path.contains("..")) {
                    return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found",
                        null, null);
                }
                try {
                    InputStream in = app.getAssets().open(ASSET_ROOT + path);
                    return new WebResourceResponse(mimeFor(path), null, in);
                } catch (Throwable t) {
                    return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found",
                        null, null);
                }
            }
        });
        return w;
    }

    private static String mimeFor(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js")) return "text/javascript";
        // instantiateStreaming refuses anything else.
        if (path.endsWith(".wasm")) return "application/wasm";
        return "application/octet-stream";
    }
}
