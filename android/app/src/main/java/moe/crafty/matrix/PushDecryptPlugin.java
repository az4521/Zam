package moe.crafty.matrix;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * Lets MatrixMessagingService ask the web layer to decrypt an encrypted event
 * for its notification (see src/lib/pushDecrypt.ts). The E2EE keys live in the
 * WebView's crypto store, so only a running web layer can do it; when the app
 * UI is not running there is nobody to ask and request() returns null at once.
 *
 * Registered in MainActivity.onCreate.
 */
@CapacitorPlugin(name = "PushDecrypt")
public class PushDecryptPlugin extends Plugin {

    private static final String EVENT = "decryptRequest";

    private static volatile PushDecryptPlugin instance;
    private static final Map<String, Pending> pending = new ConcurrentHashMap<>();

    /** The decrypted event: its cleartext type and content. */
    static final class Result {
        final String type;
        final JSONObject content;

        Result(String type, JSONObject content) {
            this.type = type;
            this.content = content;
        }
    }

    private static final class Pending {
        final CountDownLatch latch = new CountDownLatch(1);
        volatile Result result;
    }

    @Override
    public void load() {
        instance = this;
    }

    @Override
    protected void handleOnDestroy() {
        if (instance == this) instance = null;
    }

    /**
     * Ask the web layer to decrypt one event. Blocking (up to timeoutMs), so
     * it must run off the main thread. Null when the web layer is not running,
     * has not subscribed yet, cannot decrypt the event, or does not answer in
     * time.
     */
    static Result request(String roomId, String eventId, long timeoutMs) {
        PushDecryptPlugin p = instance;
        if (p == null || !p.hasListeners(EVENT)) return null;
        String requestId = UUID.randomUUID().toString();
        Pending req = new Pending();
        pending.put(requestId, req);
        try {
            JSObject data = new JSObject();
            data.put("requestId", requestId);
            data.put("roomId", roomId);
            data.put("eventId", eventId);
            p.notifyListeners(EVENT, data);
            if (!req.latch.await(timeoutMs, TimeUnit.MILLISECONDS)) return null;
            return req.result;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return null;
        } catch (Throwable t) {
            return null;
        } finally {
            pending.remove(requestId);
        }
    }

    /** The web layer's answer: { requestId, type?, content? }. */
    @PluginMethod
    public void respond(PluginCall call) {
        String requestId = call.getString("requestId");
        Pending req = requestId != null ? pending.get(requestId) : null;
        if (req != null) {
            String type = call.getString("type");
            JSObject content = call.getObject("content");
            if (type != null && !type.isEmpty()
                    && !"m.room.encrypted".equals(type) && content != null) {
                req.result = new Result(type, content);
            }
            req.latch.countDown();
        }
        call.resolve();
    }
}
