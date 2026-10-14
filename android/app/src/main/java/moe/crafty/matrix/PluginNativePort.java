package moe.crafty.matrix;

/**
 * One connection between the page and a plugin's native host (see
 * PluginNativeHost): the page's end is a MessagePort, which on Android
 * carries only strings and binary (ArrayBuffer) messages.
 */
public interface PluginNativePort {
    interface Listener {
        void onMessage(String text);

        void onMessage(byte[] data);
    }

    /** Receives the page's messages, on the plugin's thread. */
    void setListener(Listener listener);

    void post(String text);

    void post(byte[] data);

    void close();
}
