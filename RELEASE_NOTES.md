# Vimfari v1.1.0 Release Notes

This release focuses on Safari compatibility — fixing clipboard, keyboard shortcuts, find mode, and UI behavior that broke due to Safari's security model and API differences from Chrome.

## What's Fixed

### Keyboard Shortcuts
- **`f`**: Links now open directly in the current tab instead of being blocked as popups
- **`yy`**: Copying the current URL now works reliably
- **`yf`**: Copying link URLs now works reliably
- **`p` / `P`**: Pasting URLs now works (Safari may ask for clipboard permission once)

### Scrolling
- **`j` / `k` / `d` / `u`**: Scrolling now works correctly on pages that use `scroll-behavior: smooth` CSS (e.g. huangguaba.com), instead of moving only 1–2 pixels

### Vomnibar (`o` / `O` / `T` / `:`)
- Pressing Enter now correctly opens URLs and search results
- Pressing Escape now correctly dismisses the Vomnibar
- Auto-focus works from the second activation onward (Safari limitation on first open)

### Find Mode (`/`)
- Chinese and Japanese input now works correctly
- Pressing Enter after IME confirmation no longer prematurely exits find mode
- Pressing Escape now correctly dismisses the find bar
- Search results and match counts now display correctly

### Tab Operations
- **`X`** (restore tab): Restored tabs now return to their original position in the tab bar

### UI
- The HUD (heads-up display) no longer blocks page clicks when not in use
- Link hint markers are no longer visually broken by aggressive page CSS

## Known Limitations

- **`b` / `B`** (bookmarks) are unavailable — `chrome.bookmarks` API is not supported in Safari
- **First-open auto-focus**: The Vomnibar and find mode input may require a single click to focus on first use (Safari security restriction on cross-origin iframes)
- **`p` / `P`**: Safari shows a one-time permission dialog for clipboard read

---

[Full Changelog](CHANGELOG.md) · [Repository](https://github.com/Neal-Ding/vimfari)
