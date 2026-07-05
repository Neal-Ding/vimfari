import SafariServices

/// Handles communication between the native macOS app and the Safari Web Extension.
/// This is required by Safari even if not actively used for messaging.
class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    func beginRequest(with context: NSExtensionContext) {
        let item = context.inputItems[0] as! NSExtensionItem
        let message = item.userInfo?[SFExtensionMessageKey]

        // Log incoming messages for debugging
        if let msg = message {
            NSLog("Vimfari received message from browser: \(msg)")
        }

        let response = NSExtensionItem()
        response.userInfo = [SFExtensionMessageKey: ["status": "ok"]]
        context.completeRequest(returningItems: [response])
    }
}
