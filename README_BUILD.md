# Vimfari — Vimium for Safari

Vimfari is a Safari Web Extension that provides Vim-style keyboard shortcuts for navigation and control. It is a port of [Vimium](https://github.com/philc/vimium) for Safari.

## Features

- **Vim-style keyboard navigation**: `j`/`k` for scrolling, `gg`/`G` for top/bottom, `h`/`l` for left/right
- **Link hints**: Press `f` to show hint markers on all clickable elements; type the hint to activate
- **Vomnibar**: Press `o` to open a fuzzy-search bar for URLs, bookmarks, history, and tabs
- **Tab management**: `t` new tab, `x` close tab, `J`/`K` previous/next tab, `^` visit previous tab
- **Find mode**: `/` to search within page, `n`/`N` for next/previous match
- **Visual mode**: `v` for character selection, `V` for line selection
- **Marks**: `m` to set mark, `` ` `` to jump to mark
- **Custom key mappings**: Configure any key binding from the Options page
- **Excluded URLs**: Disable Vimfari on specific websites

## Requirements

- macOS 14.0 (Sonoma) or later
- Safari 17.0 or later
- Xcode 15.0 or later (for building)

## Building from Source

### Method 1: Using XcodeGen (Recommended)

1. Install XcodeGen:
   ```bash
   brew install xcodegen
   ```

2. Generate the Xcode project:
   ```bash
   cd VimfariApp
   xcodegen generate
   ```

3. Open the generated `VimfariApp.xcodeproj` in Xcode:
   ```bash
   open VimfariApp.xcodeproj
   ```

4. In Xcode:
   - Select the "VimfariApp" scheme
   - Go to Signing & Capabilities → select your team
   - Build and run (⌘R)

### Method 2: Manual Xcode Setup

1. Open Xcode and create a new project:
   - Choose **macOS → Safari Web Extension**
   - Name it "VimfariApp"
   - Choose SwiftUI for the app interface

2. Replace the default extension files:
   - Delete the auto-generated `Resources/` folder in the Safari Extension target
   - Copy these directories from the vimfari root into the Safari Extension's Resources:
     ```
     manifest.json
     lib/
     content_scripts/
     background_scripts/
     pages/
     icons/
     resources/
     ```

3. Update the Safari Extension's `Info.plist` (use the one from `VimfariApp/SafariExtension/Info.plist`).

4. Update the Swift source files (use those from `VimfariApp/VimfariApp/`).

5. Build and run (⌘R).

### Method 3: Using safari-web-extension-converter

```bash
# Install the converter
xcrun safari-web-extension-converter \
  --macos-only \
  --bundle-identifier com.vimfari.VimfariApp \
  --swift \
  --no-open \
  /path/to/vimfari

# Then open the generated Xcode project
open VimfariApp.xcodeproj
```

## Enabling the Extension in Safari

1. After building, the app will launch and prompt you to enable the extension
2. Alternatively, open Safari → Preferences (⌘,) → Extensions
3. Check the box next to "Vimfari"
4. Click "Always Allow on Every Website…" for full functionality
5. If developing, enable: Develop → Allow Unsigned Extensions

## Key Bindings

| Key | Action |
|-----|--------|
| `j` | Scroll down |
| `k` | Scroll up |
| `h` | Scroll left |
| `l` | Scroll right |
| `gg` | Scroll to top |
| `G` | Scroll to bottom |
| `d` | Scroll half page down |
| `u` | Scroll half page up |
| `f` | Open link in current tab |
| `F` | Open link in new tab |
| `o` | Open Vomnibar (URL/search) |
| `O` | Open Vomnibar in new tab |
| `b` | Open bookmarks |
| `T` | Search open tabs |
| `t` | New tab |
| `x` | Close tab |
| `X` | Restore closed tab |
| `J` | Previous tab |
| `K` | Next tab |
| `^` | Visit previous tab |
| `H` | Go back in history |
| `L` | Go forward in history |
| `r` | Reload page |
| `/` | Enter find mode |
| `n` | Next find match |
| `N` | Previous find match |
| `i` | Enter insert mode |
| `v` | Enter visual mode |
| `V` | Enter visual line mode |
| `yy` | Copy current URL |
| `p` | Open clipboard URL in current tab |
| `P` | Open clipboard URL in new tab |
| `?` | Show help dialog |
| `gi` | Focus first input |
| `gf` | Next frame |
| `gF` | Main frame |
| `gu` | Go up URL hierarchy |
| `m` | Create mark |
| `` ` `` | Go to mark |
| `zi` | Zoom in |
| `zo` | Zoom out |
| `z0` | Reset zoom |

## Configuration

Right-click the Vimfari toolbar icon → **Options** to configure:
- Custom key mappings
- Excluded URLs and pass-through keys
- Custom search engines
- Link hint characters
- Scroll step size
- Smooth scrolling
- And more…

## Differences from Vimium

Being a Safari port, some features are unavailable:
- **`chrome.search` API**: Not available in Safari; Vimfari falls back to Google search URLs
- **Favicon support**: The `_favicon/*` web accessible resource is not available
- **Incognito**: Limited incognito window support in Safari
- **Notifications**: System notifications may have limited support

## License

MIT License. Originally ported from [Vimium](https://github.com/philc/vimium).

## Contributing

Contributions are welcome! Please see the original Vimium project for the CONTRIBUTING guidelines.
