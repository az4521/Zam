import UIKit
import Capacitor

/// The bridge view controller (Main.storyboard points here). Registers the
/// app's own Capacitor plugins, the iOS counterparts of the ones
/// android/.../MainActivity.java registers. Android-only plugins (ApkUpdater,
/// WebBundle, UnifiedPush, PushDecrypt, ScreenShare) and PluginNative (native
/// code inside Zam plugins) have no iOS counterpart; the web layer gates them
/// off by platform.
class ZamViewController: CAPBridgeViewController {
    private var themeColorObservation: NSKeyValueObservation?
    override func capacitorDidLoad() {
        followThemeColor()

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

    /// The web view is inset by the safe area (capacitor.config.ts
    /// ios.contentInset "always"), so the strips behind the status bar and the
    /// home indicator show the native background. Paint them with the page's
    /// <meta name="theme-color"> (set by theme.ts for every theme) and pick a
    /// status bar style that stays readable on it.
    private func followThemeColor() {
        guard let webView = webView else { return }
        themeColorObservation = webView.observe(\.themeColor, options: [.initial, .new]) { [weak self] webView, _ in
            guard let color = webView.themeColor else { return }
            self?.applyBackground(color)
        }
    }

    private func applyBackground(_ color: UIColor) {
        view.backgroundColor = color
        webView?.backgroundColor = color
        webView?.scrollView.backgroundColor = color
        var red: CGFloat = 0, green: CGFloat = 0, blue: CGFloat = 0, alpha: CGFloat = 0
        color.getRed(&red, green: &green, blue: &blue, alpha: &alpha)
        let luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
        let style: UIStatusBarStyle = luminance > 0.5 ? .darkContent : .lightContent
        if style != statusBarStyle {
            setStatusBarStyle(style)
        }
    }
}
