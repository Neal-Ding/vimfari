import SafariServices

/// Handles native Safari Web Extension commands dispatched from content scripts.
///
/// These commands are invoked via `safari.extension.dispatchMessage("commandName")`
/// from the JS content scripts when running in Safari. The same operations fall
/// back to `chrome.runtime.sendMessage` in Chrome/Firefox.
///
/// Using SFSafari* native APIs for tab operations provides:
/// - More reliable tab switching/creation/closing
/// - Better performance (no service worker round-trip)
/// - Access to Safari-specific capabilities not exposed via WebExtension APIs
class SafariWebExtensionHandler: SFSafariExtensionHandler {

    // MARK: - Message Handling

    override func messageReceived(withName messageName: String,
                                  from page: SFSafariPage,
                                  userInfo: [String: Any]?) {
        NSLog("Vimfari native: received '\(messageName)'")

        switch messageName {
        // Tab navigation
        case "nextTab":
            changeTab(by: 1, from: page)
        case "previousTab":
            changeTab(by: -1, from: page)
        case "firstTab":
            jumpToTab(position: .first, from: page)
        case "lastTab":
            jumpToTab(position: .last, from: page)
        case "visitPreviousTab":
            visitPreviousTab(from: page)

        // Tab lifecycle
        case "createTab":
            createTab(userInfo: userInfo, from: page)
        case "duplicateTab":
            duplicateTab(from: page)
        case "removeTab":
            removeCurrentTab(from: page)
        case "restoreTab":
            restoreTabFromStack(from: page)

        // Batch tab operations
        case "closeTabsOnLeft":
            closeTabsRelative(direction: .left, from: page)
        case "closeTabsOnRight":
            closeTabsRelative(direction: .right, from: page)
        case "closeOtherTabs":
            closeTabsRelative(direction: .other, from: page)

        // Window operations
        case "moveTabToNewWindow":
            moveTabToNewWindow(from: page)

        // URL operations
        case "openUrlInNewTab":
            let url = userInfo?["url"] as? String ?? ""
            let active = userInfo?["active"] as? Bool ?? true
            openURLInNewTab(url: url, active: active, from: page)
        case "openUrlInCurrentTab":
            let url = userInfo?["url"] as? String ?? ""
            navigateCurrentTab(to: url, from: page)

        default:
            NSLog("Vimfari native: unknown command '\(messageName)'")
        }
    }

    override func messageReceivedFromContainingApp(withName messageName: String,
                                                    userInfo: [String: Any]? = nil) {
        // Handle messages from the native macOS app (e.g., settings changes).
        NSLog("Vimfari: message from containing app: \(messageName)")
    }

    // MARK: - Toolbar

    override func toolbarItemClicked(in window: SFSafariWindow) {
        // The default_popup (action.html) handles the popup UI automatically.
        // This method is called only when no popup is configured.
    }

    override func validateToolbarItem(in window: SFSafariWindow,
                                       validationHandler: @escaping (Bool, String) -> Void) {
        validationHandler(true, "")
    }

    // MARK: - Tab Navigation

    private func changeTab(by offset: Int, from page: SFSafariPage) {
        page.getContainingTab { currentTab in
            self.window(for: page) { window in
                window?.getAllTabs { tabs in
                    guard let currentIndex = tabs.firstIndex(of: currentTab) else { return }
                    let newIndex = self.mod(currentIndex + offset, tabs.count)
                    tabs[newIndex].activate()
                }
            }
        }
    }

    private enum TabPosition { case first, last }

    private func jumpToTab(position: TabPosition, from page: SFSafariPage) {
        window(for: page) { window in
            window?.getAllTabs { tabs in
                guard !tabs.isEmpty else { return }
                switch position {
                case .first: tabs[0].activate()
                case .last:  tabs[tabs.count - 1].activate()
                }
            }
        }
    }

    // MARK: - Tab Lifecycle

    private func createTab(userInfo: [String: Any]?, from page: SFSafariPage) {
        let urlString = userInfo?["url"] as? String
        let targetUrl: URL?

        if let urlStr = urlString, !urlStr.isEmpty, urlStr != "about:newtab" {
            targetUrl = URL(string: urlStr)
        } else {
            // Create a blank tab — Safari's default new tab page.
            targetUrl = nil
        }

        window(for: page) { window in
            if let url = targetUrl {
                window?.openTab(with: url, makeActiveIfPossible: true) { _ in }
            } else {
                // Open Safari's default new tab page.
                window?.openTab(with: URL(string: "about:blank")!,
                                makeActiveIfPossible: true) { _ in }
            }
        }
    }

    private func duplicateTab(from page: SFSafariPage) {
        page.getContainingTab { tab in
            tab.getActivePage { activePage in
                activePage?.getPropertiesWithCompletionHandler { props in
                    guard let url = props?.url else { return }
                    self.window(for: page) { window in
                        window?.openTab(with: url, makeActiveIfPossible: true) { _ in }
                    }
                }
            }
        }
    }

    private func removeCurrentTab(from page: SFSafariPage) {
        // Save the tab info for later restoration (X key).
        saveTabForRestore(from: page) {
            page.getContainingTab { tab in
                tab.close()
            }
        }
    }

    // MARK: - Tab Restoration

    // In-memory stack of recently closed tab URLs (supplements the JS-side stack).
    private struct ClosedTabEntry {
        let url: String
        let title: String?
    }
    private var closedTabStack: [ClosedTabEntry] = []
    private let maxClosedTabs = 25

    private func saveTabForRestore(from page: SFSafariPage, completion: @escaping () -> Void) {
        page.getContainingTab { tab in
            tab.getActivePage { activePage in
                activePage?.getPropertiesWithCompletionHandler { props in
                    if let url = props?.url?.absoluteString {
                        let entry = ClosedTabEntry(url: url, title: props?.title)
                        self.closedTabStack.append(entry)
                        if self.closedTabStack.count > self.maxClosedTabs {
                            self.closedTabStack.removeFirst()
                        }
                    }
                    completion()
                }
            }
        }
    }

    private func restoreTabFromStack(from page: SFSafariPage) {
        guard let entry = closedTabStack.popLast() else {
            // Stack is empty — nothing to restore.
            return
        }
        if let url = URL(string: entry.url) {
            window(for: page) { window in
                window?.openTab(with: url, makeActiveIfPossible: true) { _ in }
            }
        }
    }

    // MARK: - Batch Operations

    private enum CloseDirection { case left, right, other }

    private func closeTabsRelative(direction: CloseDirection, from page: SFSafariPage) {
        page.getContainingTab { currentTab in
            self.window(for: page) { window in
                window?.getAllTabs { tabs in
                    guard let currentIndex = tabs.firstIndex(of: currentTab) else { return }
                    for (i, tab) in tabs.enumerated() {
                        switch direction {
                        case .left:   if i < currentIndex { tab.close() }
                        case .right:  if i > currentIndex { tab.close() }
                        case .other:  if i != currentIndex { tab.close() }
                        }
                    }
                    // Re-activate the current tab (it may have shifted).
                    tabs[currentIndex].activate()
                }
            }
        }
    }

    // MARK: - Window Operations

    private func moveTabToNewWindow(from page: SFSafariPage) {
        // Safari does not support moving tabs between windows programmatically.
        // Create a new window with the current page's URL instead.
        page.getContainingTab { tab in
            tab.getActivePage { activePage in
                activePage?.getPropertiesWithCompletionHandler { props in
                    guard let url = props?.url else { return }
                    SFSafariApplication.openWindow(with: url) { _ in
                        // Close the original tab.
                        tab.close()
                    }
                }
            }
        }
    }

    // MARK: - URL Operations

    private func openURLInNewTab(url urlString: String, active: Bool,
                                  from page: SFSafariPage) {
        guard !urlString.isEmpty, let url = URL(string: urlString) else { return }
        window(for: page) { window in
            window?.openTab(with: url, makeActiveIfPossible: active) { _ in }
        }
    }

    private func navigateCurrentTab(to urlString: String, from page: SFSafariPage) {
        guard !urlString.isEmpty, let url = URL(string: urlString) else { return }
        page.getContainingTab { tab in
            tab.getActivePage { activePage in
                // Use JavaScript to navigate — no direct SFSafariPage navigation API.
                activePage?.dispatchMessageToScript(
                    withName: "navigateTo",
                    userInfo: ["url": url.absoluteString]
                )
            }
        }
    }

    // MARK: - Helpers

    /// Get the containing window for a page, falling back to the active window.
    private func window(for page: SFSafariPage,
                        completion: @escaping (SFSafariWindow?) -> Void) {
        page.getContainingTab { tab in
            tab.getContainingWindow { window in
                if let w = window {
                    completion(w)
                } else {
                    // Tab may be pinned or detached; fall back to active window.
                    SFSafariApplication.getActiveWindow { w in
                        completion(w)
                    }
                }
            }
        }
    }
}

// MARK: - Math Helper

/// True modulus (not remainder). Always returns a non-negative result.
private func mod(_ a: Int, _ n: Int) -> Int {
    precondition(n > 0, "modulus must be positive")
    let r = a % n
    return r >= 0 ? r : r + n
}
