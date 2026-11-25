import Foundation
import Capacitor
import WebKit

// Port of android/app/src/main/java/moe/crafty/matrix/DebugToolsPlugin.java.
// Contract: src/lib/debugTools.ts. The "WebView debugging" switch maps to
// WKWebView.isInspectable (iOS 16.4+), so a release build can be inspected from
// Safari's Develop menu.
@objc(DebugToolsPlugin)
public class DebugToolsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "DebugToolsPlugin"
    public let jsName = "DebugTools"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getWebViewDebugging", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setWebViewDebugging", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getPushLog", returnType: CAPPluginReturnPromise),
    ]

    public static let webViewDebuggingKey = "zam_webview_debugging"

    static var isWebViewDebuggingEnabled: Bool {
        return UserDefaults.standard.bool(forKey: webViewDebuggingKey)
    }

    /// Debug builds are always inspectable; a release build follows the switch.
    static func inspectable(for enabled: Bool) -> Bool {
        #if DEBUG
        return true
        #else
        return enabled
        #endif
    }

    @available(iOS 16.4, *)
    private static func applyInspectable(_ webView: WKWebView, enabled: Bool) {
        webView.isInspectable = inspectable(for: enabled)
    }

    /// Call after the web view loads (and whenever it is created). Safe off the main thread.
    public static func applySaved(to webView: WKWebView?) {
        guard #available(iOS 16.4, *) else { return }
        guard let webView = webView else { return }
        let enabled = isWebViewDebuggingEnabled
        if Thread.isMainThread {
            applyInspectable(webView, enabled: enabled)
        } else {
            DispatchQueue.main.async {
                applyInspectable(webView, enabled: enabled)
            }
        }
    }

    @objc func getWebViewDebugging(_ call: CAPPluginCall) {
        guard #available(iOS 16.4, *) else {
            call.resolve(["enabled": false])
            return
        }
        call.resolve(["enabled": DebugToolsPlugin.isWebViewDebuggingEnabled])
    }

    /// The push service's decision log (PushLog), for the log export.
    @objc func getPushLog(_ call: CAPPluginCall) {
        call.resolve(["text": PushLog.read()])
    }

    @objc func setWebViewDebugging(_ call: CAPPluginCall) {
        guard #available(iOS 16.4, *) else {
            call.reject("WebView debugging needs iOS 16.4 or later", "UNSUPPORTED")
            return
        }
        let enabled = call.getBool("enabled", false)
        UserDefaults.standard.set(enabled, forKey: DebugToolsPlugin.webViewDebuggingKey)
        DispatchQueue.main.async { [weak self] in
            if let webView = self?.bridge?.webView {
                DebugToolsPlugin.applyInspectable(webView, enabled: enabled)
            }
            call.resolve(["enabled": enabled])
        }
    }
}
