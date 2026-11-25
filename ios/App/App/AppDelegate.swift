import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    private var defaultsObserver: NSObjectProtocol?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // BGTaskScheduler handlers must be registered before launch finishes.
        HistoryPrefetchWorker.registerBackgroundTask()

        mirrorSharedPreferences()
        defaultsObserver = NotificationCenter.default.addObserver(
            forName: UserDefaults.didChangeNotification,
            object: UserDefaults.standard,
            queue: nil
        ) { [weak self] _ in self?.mirrorSharedPreferences() }
        return true
    }

    /// The web layer writes the session record, account registry and
    /// notification settings through @capacitor/preferences
    /// (UserDefaults.standard, "CapacitorStorage." prefix), which the
    /// notification service extension cannot read. Copy those keys into the
    /// App Group defaults (Android's extensions read the same SharedPreferences
    /// file, so there it is one store).
    private func mirrorSharedPreferences() {
        let source = UserDefaults.standard
        let target = AppGroup.defaults
        for key in AppGroup.mirroredKeys {
            let value = source.string(forKey: "CapacitorStorage." + key)
            if target.string(forKey: key) != value {
                if let value = value {
                    target.set(value, forKey: key)
                } else {
                    target.removeObject(forKey: key)
                }
            }
        }
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    // @capacitor/push-notifications needs the APNs token forwarded.
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }
}
