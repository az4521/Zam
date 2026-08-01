package moe.crafty.matrix;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register custom plugins BEFORE the Capacitor bridge is created in
        // super.onCreate — plugins added afterwards are not picked up.
        registerPlugin(ApkUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
        handleRoomIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleRoomIntent(intent);
    }

    /**
     * When the app is opened by tapping a notification posted by
     * MatrixMessagingService, navigate the web layer to the room. The web app
     * exposes window.__matrixOpenRoom(roomId, userId) (see AppShell.svelte).
     *
     * The second argument is the account the notification was posted under, so
     * the web layer can refuse to open the room in a different session (audit
     * PRIV-02). It is optional on both sides: this build omits it when the
     * service could not name the account, and a web layer newer than the APK
     * that calls it with one argument still routes.
     */
    private void handleRoomIntent(Intent intent) {
        if (intent == null) return;
        final String roomId = intent.getStringExtra("room_id");
        if (roomId == null || roomId.isEmpty()) return;
        final String userId = intent.getStringExtra("user_id");
        if (getBridge() == null || getBridge().getWebView() == null) return;
        // Defer so the web app has a chance to define the hook / finish loading.
        getBridge()
            .getWebView()
            .postDelayed(
                () -> {
                    String safeRoom = roomId.replace("\\", "\\\\").replace("'", "\\'");
                    String js;
                    if (userId == null || userId.isEmpty()) {
                        js =
                            "window.__matrixOpenRoom && window.__matrixOpenRoom('" +
                            safeRoom +
                            "')";
                    } else {
                        // Same escaping as the room id — the asymmetry would be
                        // the defect, not the (currently impossible) quote.
                        String safeUser = userId.replace("\\", "\\\\").replace("'", "\\'");
                        js =
                            "window.__matrixOpenRoom && window.__matrixOpenRoom('" +
                            safeRoom +
                            "', '" +
                            safeUser +
                            "')";
                    }
                    getBridge().getWebView().evaluateJavascript(js, null);
                },
                500
            );
    }
}
