package moe.crafty.matrix;

import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.util.AttributeSet;
import android.util.Base64;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputConnection;
import android.view.inputmethod.InputMethodManager;
import android.webkit.JavascriptInterface;

import androidx.core.view.inputmethod.EditorInfoCompat;
import androidx.core.view.inputmethod.InputConnectionCompat;
import androidx.core.view.inputmethod.InputContentInfoCompat;

import com.getcapacitor.CapacitorWebView;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * The Capacitor WebView, plus keyboard image insertion (Gboard stickers, Emoji
 * Kitchen, GIFs). The WebView does not advertise commitContent support, so
 * Gboard says "doesn't support image insertion here". This advertises image
 * types and forwards what the keyboard commits to the web layer as
 * window.__matrixKeyboardContent(json), which hands it to the focused composer
 * as an attachment (the same path as pasting an image).
 *
 * Only the message composer takes images: it reports its focus through
 * window.MatrixKeyboard.setComposerFocused, and other fields neither advertise
 * nor accept them (Gboard then shows its own "not supported here").
 *
 * Swapped in for CapacitorWebView by overriding capacitor_bridge_layout_main.
 */
public class ComposerWebView extends CapacitorWebView {

    // Same bound as a shared file: the payload is base64'd through
    // evaluateJavascript.
    private static final long MAX_CONTENT_BYTES = 25L * 1024L * 1024L;

    private static final String[] MIME_TYPES = {
        "image/png",
        "image/gif",
        "image/jpeg",
        "image/webp",
        "image/*",
    };

    // Set from the JS bridge thread, read on the UI and IME threads.
    private volatile boolean composerFocused = false;
    // What the current input connection told the keyboard. UI thread only.
    private boolean advertised = false;

    public ComposerWebView(Context context, AttributeSet attrs) {
        super(context, attrs);
        addJavascriptInterface(new KeyboardBridge(), "MatrixKeyboard");
    }

    private class KeyboardBridge {

        @JavascriptInterface
        public void setComposerFocused(boolean focused) {
            composerFocused = focused;
            // The JS focus event normally lands before the keyboard connects,
            // so this is a no-op. If it lands after, restart the input so the
            // keyboard picks up the right capabilities.
            post(() -> {
                if (advertised == composerFocused || !hasFocus()) return;
                InputMethodManager imm = (InputMethodManager) getContext()
                    .getSystemService(Context.INPUT_METHOD_SERVICE);
                if (imm != null) imm.restartInput(ComposerWebView.this);
            });
        }
    }

    @Override
    public InputConnection onCreateInputConnection(EditorInfo outAttrs) {
        InputConnection ic = super.onCreateInputConnection(outAttrs);
        advertised = ic != null && composerFocused;
        if (!advertised) return ic;
        EditorInfoCompat.setContentMimeTypes(outAttrs, MIME_TYPES);
        return InputConnectionCompat.createWrapper(ic, outAttrs, this::onCommitContent);
    }

    /** Runs on the IME thread. Reads the content while the grant is held. */
    private boolean onCommitContent(InputContentInfoCompat info, int flags, android.os.Bundle opts) {
        if (!composerFocused) return false;
        boolean needsGrant =
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.N_MR1 &&
            (flags & InputConnectionCompat.INPUT_CONTENT_GRANT_READ_URI_PERMISSION) != 0;
        if (needsGrant) {
            try {
                info.requestPermission();
            } catch (Exception e) {
                return false;
            }
        }
        String mimeType = info.getDescription().getMimeTypeCount() > 0
            ? info.getDescription().getMimeType(0)
            : null;
        String b64;
        try {
            b64 = readBase64(info.getContentUri());
        } finally {
            if (needsGrant) info.releasePermission();
        }
        if (b64 == null) return false;
        if (mimeType == null || mimeType.contains("*")) {
            String resolved = getContext().getContentResolver().getType(info.getContentUri());
            mimeType = resolved != null ? resolved : "image/png";
        }

        final JSONObject payload = new JSONObject();
        try {
            payload.put("name", "sticker." + extensionFor(mimeType));
            payload.put("mimeType", mimeType);
            payload.put("dataBase64", b64);
        } catch (JSONException e) {
            return false;
        }
        final String json = payload.toString();
        post(() ->
            evaluateJavascript(
                "window.__matrixKeyboardContent && window.__matrixKeyboardContent(" +
                JSONObject.quote(json) +
                ")",
                null
            )
        );
        return true;
    }

    private String readBase64(Uri uri) {
        try (InputStream in = getContext().getContentResolver().openInputStream(uri)) {
            if (in == null) return null;
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            long total = 0;
            while ((n = in.read(buf)) != -1) {
                total += n;
                if (total > MAX_CONTENT_BYTES) return null;
                out.write(buf, 0, n);
            }
            return Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
        } catch (Exception e) {
            return null;
        }
    }

    private static String extensionFor(String mimeType) {
        switch (mimeType) {
            case "image/gif":
                return "gif";
            case "image/jpeg":
                return "jpg";
            case "image/webp":
                return "webp";
            default:
                return "png";
        }
    }
}
