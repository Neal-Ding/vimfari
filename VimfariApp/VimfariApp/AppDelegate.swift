import Cocoa
import SafariServices

class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        // Register the Safari Web Extension
        SFSafariExtensionManager.getStateOfSafariExtension(
            withIdentifier: "com.vimfari.SafariExtension"
        ) { (state, error) in
            if let error = error {
                print("Vimfari: Failed to get extension state: \(error.localizedDescription)")
            }
        }
    }
}
