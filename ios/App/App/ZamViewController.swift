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
    private var keyboardObserver: NSObjectProtocol?
    private var pageOffsetObservation: NSKeyValueObservation?
    /// Height of the keyboard over the bottom of the window, 0 when hidden.
    private var keyboardOverlap: CGFloat = 0

    override func capacitorDidLoad() {
        followThemeColor()
        followKeyboard()
        pinPageScroll()

        bridge?.registerPluginInstance(LinkPagePlugin())
        bridge?.registerPluginInstance(MediaSaverPlugin())
        bridge?.registerPluginInstance(DebugToolsPlugin())
        bridge?.registerPluginInstance(SharedFilePlugin())
        bridge?.registerPluginInstance(FileTransferPlugin())
        bridge?.registerPluginInstance(HistoryPrefetchPlugin())
        bridge?.registerPluginInstance(PluginSocketsPlugin())
        bridge?.registerPluginInstance(ProxyPlugin())
        bridge?.registerPluginInstance(CallServicePlugin())
        bridge?.registerPluginInstance(PushKeysPlugin())

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
        // Shows below the web view while it is shrunk for the keyboard.
        view.window?.backgroundColor = color
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

    /// The layout expects the viewport to shrink above the on-screen keyboard
    /// (Android resizes the window; MessageInput reads visualViewport). WKWebView
    /// instead scrolls the whole page up, which pushes the room header under the
    /// status bar. Shrink the web view to end at the keyboard's top edge, as
    /// @capacitor/keyboard's "native" resize mode does.
    private func followKeyboard() {
        keyboardObserver = NotificationCenter.default.addObserver(
            forName: UIResponder.keyboardWillChangeFrameNotification,
            object: nil,
            queue: .main
        ) { [weak self] note in
            self?.keyboardFrameWillChange(note)
        }
    }

    private func keyboardFrameWillChange(_ note: Notification) {
        guard let window = view.window,
              let end = (note.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue)?.cgRectValue else {
            return
        }
        let keyboard = window.convert(end, from: window.screen.coordinateSpace)
        // Only a keyboard docked at the bottom edge covers the page; a floating
        // or undocked iPad keyboard leaves it alone.
        let docked = keyboard.maxY >= window.bounds.maxY - 1 && keyboard.height > 0
        let overlap = docked ? max(0, window.bounds.maxY - keyboard.minY) : 0
        guard overlap != keyboardOverlap else { return }
        keyboardOverlap = overlap

        let duration = (note.userInfo?[UIResponder.keyboardAnimationDurationUserInfoKey] as? Double) ?? 0.25
        let curveRaw = (note.userInfo?[UIResponder.keyboardAnimationCurveUserInfoKey] as? Int) ?? UIView.AnimationCurve.easeInOut.rawValue
        let options = UIView.AnimationOptions(rawValue: UInt(curveRaw) << 16)
        UIView.animate(withDuration: duration, delay: 0, options: options) {
            self.layoutForKeyboard()
        }
    }

    private func layoutForKeyboard() {
        guard let webView = webView, let container = webView.superview else { return }
        var frame = container.bounds
        frame.size.height = max(0, frame.height - keyboardOverlap)
        webView.frame = frame
    }

    /// The document never scrolls (body is h-screen overflow-hidden; panes
    /// scroll inside their own containers), but WebKit still scrolls the web
    /// view's own scroll view to reveal a focused field, sliding the page under
    /// the status bar. Keep it at its origin unless the user has pinch-zoomed.
    private func pinPageScroll() {
        guard let scrollView = webView?.scrollView else { return }
        scrollView.bounces = false
        pageOffsetObservation = scrollView.observe(\.contentOffset, options: [.new]) { scrollView, _ in
            guard scrollView.zoomScale <= scrollView.minimumZoomScale + 0.001 else { return }
            let origin = CGPoint(x: -scrollView.adjustedContentInset.left,
                                 y: -scrollView.adjustedContentInset.top)
            if scrollView.contentOffset != origin {
                scrollView.contentOffset = origin
            }
        }
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        if keyboardOverlap > 0 { layoutForKeyboard() }
    }
}
