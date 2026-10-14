package moe.crafty.matrix;

import android.content.Context;

import java.io.File;

/**
 * A plugin's native host on Android (zam.native; see PluginNativePlugin).
 * Its class, named by the manifest's native "entry", is loaded from the
 * plugin's .dex into Zam's own process once the user has agreed, and needs a
 * public no-argument constructor. Every method is called on that plugin's
 * own thread (urgent-audio priority), as are its ports' listeners; don't
 * block it for long.
 *
 * This interface and PluginNativePort are the whole API between Zam and a
 * plugin's Android code: keep them stable.
 */
public interface PluginNativeHost {
    /** Once, after loading. {@code dir} holds the plugin's native files; the
     *  host's lib/ directory is on its class loader's library path, so
     *  System.loadLibrary finds the .so files there. */
    void onCreate(Context context, File dir);

    /** A new connection from the page (one per zam.native.connect()). */
    void onConnect(PluginNativePort port);

    /** The plugin is being removed or updated: release everything. */
    void onDestroy();
}
