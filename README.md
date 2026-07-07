# Vimfari — Keyboard-Based Browser Control for Safari

Vimfari is a Safari Web Extension that provides Vim-style keyboard shortcuts for navigating and
controlling the web. Based on [Vimium](https://github.com/philc/vimium), with extensive Safari
compatibility fixes and optimizations.

## Installation

**Safari (Developer Mode):**
1. Clone this repository
2. Safari → 开发 → Web 扩展 → 允许无符号扩展
3. 在 Safari → 设置 → 扩展 中启用 Vimfari

## Quick Reference

| Key | Action | Key | Action |
|-----|--------|-----|--------|
| `j` / `k` | Scroll down / up | `d` / `u` | Half page down / up |
| `h` / `l` | Scroll left / right | `gg` / `G` | Top / bottom of page |
| `f` | Open link in current tab | `F` | Open link in new tab |
| `yf` | Copy link URL | `yy` | Copy current URL |
| `o` | Open URL, bookmark, history | `O` | ...in new tab |
| `T` | Search open tabs | `:` | Execute command |
| `/` | Find in page | `n` / `N` | Next / previous match |
| `H` / `L` | Back / forward in history | `r` / `R` | Reload / hard reload |
| `t` | New tab | `x` / `X` | Close / restore tab |
| `J` / `K` | Previous / next tab | `^` | Visit previously-visited tab |
| `gt` / `gT` | Next / previous tab | `g0` / `g$` | First / last tab |
| `p` / `P` | Paste and open / new tab | `v` / `V` | Visual / visual line mode |
| `i` | Insert mode | `?` | Help dialog |
| `m` / `` ` `` | Create mark / go to mark | `gi` | Focus text input |
| `]]` / `[[` | Follow next / previous link | `gu` / `gU` | Up URL level / root |
| `zi` / `zo` / `z0` | Zoom in / out / reset | `<<` / `>>` | Move tab left / right |

Type `?` at any time to see all available commands.

## Custom Key Mappings

Add custom mappings on the Options page (reachable from the help dialog). Syntax:

```
map <key> <command> [options]   # Map a key to a command
unmap <key>                     # Remove a key mapping
unmapAll                        # Remove all mappings
```

Examples:
```
map <c-d> scrollPageDown
map r reload hard
unmap J
```

Special keys: `<c-*>` (ctrl), `<a-*>` (alt), `<m-*>` (meta/cmd), `<s-*>` (shift), `<left>`, `<right>`, `<up>`, `<down>`, `<f1>`–`<f12>`, `<space>`, `<tab>`, `<enter>`, `<delete>`, `<backspace>`, `<home>`, `<end>`.

## Safari-Specific Features

- **Native tab operations**: `NativeBridge` enables Swift-level tab control for commands like `x`/`X`/`t`/`J`/`K`
- **IME-friendly find mode**: Chinese/Japanese input works correctly in find mode (`/`)
- **Cross-origin iframe handling**: All Vomnibar and HUD popups work reliably in Safari's security model
- **Clipboard**: Three-tier fallback (`execCommand` → `navigator.clipboard` → HUD iframe) ensures copy/paste works

## Known Safari Limitations

| Issue | Details |
|-------|---------|
| **Bookmarks** (`b`/`B`) | `chrome.bookmarks` API is unsupported in Safari Web Extensions |
| **First-open auto-focus** | Safari blocks `focus()` in cross-origin extension iframes until first user interaction — click once to activate |
| **Paste permission** (`p`/`P`) | One-time system permission dialog for clipboard read access |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Issues and pull requests are welcome.

## License

MIT. Based on [Vimium](https://github.com/philc/vimium) by Phil Crosby and Ilya Sukhar.
Vimfari modifications by Neal Ding. See [MIT-LICENSE.txt](MIT-LICENSE.txt).
