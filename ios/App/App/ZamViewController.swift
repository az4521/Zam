import UIKit
import Capacitor

/// The bridge view controller (Main.storyboard points here). Registers the
/// app's own Capacitor plugins, the iOS counterparts of the ones
/// android/.../MainActivity.java registers. Android-only plugins (ApkUpdater,
/// WebBundle, UnifiedPush, PushDecrypt, ScreenShare) and PluginNative (native
/// code inside Zam plugins) have no iOS counterpart; the web layer gates them
/// off by platform.
class ZamViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(LinkPagePlugin())
        bridge?.registerPluginInstance(MediaSaverPlugin())
        bridge?.registerPluginInstance(DebugToolsPlugin())
        bridge?.registerPluginInstance(SharedFilePlugin())
        bridge?.registerPluginInstance(FileTransferPlugin())
        bridge?.registerPluginInstance(HistoryPrefetchPlugin())
        bridge?.registerPluginInstance(PluginSocketsPlugin())
        bridge?.registerPluginInstance(ProxyPlugin())
        bridge?.registerPluginInstance(CallServicePlugin())

        DebugToolsPlugin.applySaved(to: webView)
        ProxyPlugin.applySaved(to: webView)
        NotificationActions.install()
        ShareInbox.shared.attach(to: self)

        DispatchQueue.global(qos: .utility).async {
            SharedFilePlugin.sweepStale()
        }
    }
}
