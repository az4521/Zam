package moe.crafty.matrix;

import android.app.Application;

/**
 * Runs first in every process start (the app, a push, a quick reply, a call
 * action), before any activity, service or receiver: the place for setup
 * that must precede the first network request.
 */
public class ZamApplication extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        // Settings > General > Network, before any WebView or native request.
        ZamProxy.init(this);
    }
}
