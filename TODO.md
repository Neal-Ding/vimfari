# Vimfari — Known Issues & Future TODOs

This file tracks known limitations, Safari-specific gaps, and planned improvements.

---

## Safari-Specific Limitations (from Apple Documentation)

### Storage
- [ ] **`chrome.storage.sync` uses iCloud** — Settings sync requires the user to be signed into iCloud. Without iCloud, settings are local-only. Consider documenting this or adding a fallback warning.

### Service Worker Lifecycle
- [ ] **Aggressive termination (~30s idle)** — Safari kills the service worker after about 30 seconds of inactivity. The current bundle re-initializes on each wake-up (`activate` event + `clients.claim()`), but state held in module-scope variables is lost across cycles. Monitor for edge cases where in-memory state (e.g. `tabRecency`, `completionCache`) becomes stale after a long idle period.
- [ ] **No persistent background page** — Safari fully enforces the service worker lifecycle. Long-running operations should use `event.waitUntil()` or `chrome.alarms`.

### Tab Operations
- [ ] **`chrome.tabs.create` ignores `position` argument** — Safari places new tabs according to its own logic. The `position` options in key mappings (`start`, `before`, `after`, `end`) have no effect. Consider removing or documenting this.
- [x] **`chrome.tabs.move` not supported** — All tab movement operations (`<<`, `>>`, `W`) are disabled on Safari with a HUD message. Per Apple docs: `tabs.move` is not available in Safari Web Extensions.
- [ ] **`chrome.tabs.duplicate` behavior may differ** — Verify tab duplication works as expected in Safari.
- [ ] **Pinned tab behavior** — Safari may handle pinned tabs differently from Chrome/Firefox. The `removeTab` command currently skips pinned tabs only on Firefox; verify whether Safari needs the same treatment.
- [x] **`data:text/html` URL in `chrome.tabs.create` not supported** — Uses `null` URL (same as Firefox path).

### Web Navigation
- [ ] **`chrome.webNavigation` events may be reduced** — Safari's implementation may fire fewer events or have different timing. The `onHistoryStateUpdated`, `onReferenceFragmentUpdated`, and `onCommitted` listeners are guarded with try/catch, but may silently not fire, affecting URL-change detection and link-hint CSS injection.

### Notifications
- [ ] **`chrome.notifications` uses macOS Notification Center** — Notifications may not appear if the user has disabled them for Safari. The upgrade notification is guarded but may silently fail.

### Sessions
- [x] **`chrome.sessions.restore` not supported** — Fixed: custom closed-tab stack in `main.js`.
  - Only tabs closed via Vimfari `x` key can be restored.
  - Tabs closed via mouse/Safari UI cannot be tracked (no browser API).

### Incognito / Private Browsing
- [x] **`chrome.extension.inIncognitoContext` not available** — Polyfilled via `chrome.runtime.inIncognitoContext` in `safari_polyfill.js`.
- [x] **`chrome.windows.create({incognito: true})` not supported** — Guarded in `main.js`; falls back to regular new window in Safari.

### Favicons
- [x] **`_favicon/*` not available in Safari** — Vomnibar tab suggestions skip favicon rendering (no favicon API).

### Permissions
- [ ] **`sessions` permission** — Verify support in Safari 16.4+. May need to be made optional.
- [ ] **`bookmarks` permission** — Verify bookmark access works in Safari. Safari's ITP (Intelligent Tracking Prevention) may affect certain bookmark APIs.

---

## App Store Distribution Checklist

- [ ] **Add toolbar icons to Xcode Asset Catalog** — Currently referenced as PNG files in manifest.json. Apple requires Asset Catalog entries for App Store submission.
- [ ] **Add app icons to Asset Catalog** — Need 16/32/128/256/512 pt sizes for macOS.
- [ ] **Apple Developer Program membership** — Required ($99/year).
- [ ] **Code signing** — Configure in Xcode with Apple Developer certificate.
- [ ] **Notarization** — Required for macOS distribution outside the App Store.
- [ ] **App Store Connect submission** — Set up app record, screenshots, description.
- [ ] **`SFSafariExtensionBundleVersion`** — Consider adding to Info.plist for version tracking.

---

## Cross-Browser Compatibility (Future)

- [ ] **`browser.*` namespace** — Safari supports both `chrome.*` and `browser.*`. Consider adopting `browser.*` as the primary namespace with `webextension-polyfill` for maximum cross-browser compatibility.
- [ ] **Per-browser manifest variants** — Consider maintaining separate manifests for Chrome (`manifest.chrome.json`), Firefox (`manifest.firefox.json`), and Safari (`manifest.safari.json`) with a build step to select the appropriate one.
- [ ] **`browser_specific_settings` for Firefox** — Add `gecko.id` back when targeting Firefox.

---

## Known Bugs / UX Issues

- [ ] **Link hints on file:// URLs** — Not supported in Safari. The file URL content script was removed from the manifest.
- [ ] **Find mode across frames** — Safari's frame handling may differ; test find-in-page across iframes.
- [ ] **Vomnibar favicons** — `_favicon/*` web accessible resource is not available in Safari. Tab suggestions in the Vomnibar will not show favicons.
- [ ] **Incognito/private windows** — Safari's private browsing mode may restrict certain APIs. The `openUrlInIncognito` command may not work.
- [ ] **Zoom levels** — Safari uses different default zoom levels. The `zoomIn`/`zoomOut` commands may not map cleanly to Safari's zoom behavior.

---

## Code Quality / Maintenance

- [ ] **`build-safari-bg.js` robustness** — The bundler uses regex-based import/export stripping which is fragile. Consider using a proper bundler (esbuild/rollup) for production builds.
- [ ] **Variable name collisions** — The bundle has workarounds for `isSafari` and `RegexpCache` name collisions. A proper build tool would prevent these.
- [ ] **Remove test files from production** — The `tests/` and `test_harnesses/` directories are included in the repo but not needed at runtime. Consider a `.safari-extension-ignore` or build-step exclusion.
- [ ] **Remove development-only files** — `make.js`, `deno.json`, `deno.lock`, `reload.js` are not needed for the Safari extension.
- [ ] **Update CHANGELOG.md** — Track Vimfari-specific changes separately from upstream Vimium.

---

## Documentation

- [ ] **User-facing setup guide** — Create a user-friendly README (in addition to the developer-focused README_BUILD.md).
- [ ] **Key binding reference** — Add a visual key binding chart or link to the help dialog.
- [ ] **Troubleshooting guide** — Document common issues (iCloud not signed in, permissions not granted, etc.).

---

*Last updated: 2026-07-05*
*Based on audit against: https://developer.apple.com/documentation/safariservices/safari-web-extensions*
