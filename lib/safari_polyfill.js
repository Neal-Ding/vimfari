//
// Safari Web Extension polyfills.
// This file must be loaded before any other Vimfari scripts.
// It normalizes the browser extension API surface so that Safari behaves like Chrome/Firefox.
//

// Detect whether we're running in Safari.
// Safari's user agent contains "Safari" but NOT "Chrome" (unlike all Chromium browsers).
// Firefox's user agent contains "Firefox".
const _safariDetected = (() => {
  if (typeof navigator === "undefined" || !navigator.userAgent) return false;
  const ua = navigator.userAgent;
  return ua.includes("Safari") && !ua.includes("Chrome") && !ua.includes("Firefox");
})();

if (_safariDetected) {
  // ---- chrome.storage.session polyfill ----
  // Safari may not support chrome.storage.session (it was added in Safari 17).
  // Fall back to chrome.storage.local, which is always available.
  if (!chrome.storage?.session || !chrome.storage.session.setAccessLevel) {
    if (chrome.storage?.session) {
      // session exists but lacks setAccessLevel — use it directly
    } else if (chrome.storage?.local) {
      // Fall back to chrome.storage.local with a "session/" key prefix
      const sessionFallback = {
        _prefix: "vimfari_session/",

        async get(keys) {
          if (typeof keys === "string") {
            const result = await chrome.storage.local.get(this._prefix + keys);
            const value = result[this._prefix + keys];
            return { [keys]: value };
          } else if (Array.isArray(keys)) {
            const prefixedKeys = keys.map((k) => this._prefix + k);
            const result = await chrome.storage.local.get(prefixedKeys);
            const output = {};
            for (const k of keys) {
              output[k] = result[this._prefix + k];
            }
            return output;
          } else {
            // Get everything (keys is null/undefined/object)
            const result = await chrome.storage.local.get(null);
            const output = {};
            for (const [k, v] of Object.entries(result)) {
              if (k.startsWith(this._prefix)) {
                output[k.slice(this._prefix.length)] = v;
              }
            }
            return output;
          }
        },

        async set(items) {
          const prefixed = {};
          for (const [k, v] of Object.entries(items)) {
            prefixed[this._prefix + k] = v;
          }
          return chrome.storage.local.set(prefixed);
        },

        async remove(keys) {
          if (typeof keys === "string") {
            return chrome.storage.local.remove(this._prefix + keys);
          }
          const prefixedKeys = keys.map((k) => this._prefix + k);
          return chrome.storage.local.remove(prefixedKeys);
        },

        setAccessLevel() {
          // No-op: storage.local is always accessible
        },
      };
      chrome.storage.session = sessionFallback;
    }
  }

  // ---- chrome.search polyfill ----
  // Safari does not support the chrome.search API.
  // We provide a fallback that opens the search in the default search engine via a Google redirect.
  if (!chrome.search) {
    chrome.search = {
      query({ disposition, text }) {
        const searchUrl = "https://www.google.com/search?q=" + encodeURIComponent(text);
        if (disposition === "NEW_TAB") {
          chrome.tabs.create({ url: searchUrl, active: true });
        } else {
          chrome.tabs.update({ url: searchUrl });
        }
      },
    };
  }

  // ---- chrome.sessions defaults ----
  // Safari may support chrome.sessions but with different limits or missing methods.
  if (chrome.sessions) {
    if (!chrome.sessions.MAX_SESSION_RESULTS) {
      chrome.sessions.MAX_SESSION_RESULTS = 25;
    }
    // Guard restore: Safari may not support session restoration
    if (!chrome.sessions.restore) {
      chrome.sessions.restore = function (sessionId, callback) {
        console.debug("Vimfari: chrome.sessions.restore not supported in Safari");
        if (callback) callback(null);
      };
    }
  }

  // ---- chrome.extension polyfill ----
  // Safari MV3 does not support the deprecated chrome.extension API.
  // find_mode_history.js uses chrome.extension.inIncognitoContext.
  if (!chrome.extension) {
    chrome.extension = {};
  }
  if (chrome.extension.inIncognitoContext === undefined) {
    // Safari private browsing does not expose incognito state; default to false.
    // Use chrome.runtime.inIncognitoContext if available (MV3 standard).
    Object.defineProperty(chrome.extension, "inIncognitoContext", {
      get() {
        return chrome.runtime?.inIncognitoContext ?? false;
      },
    });
  }

  // ---- chrome.notifications safety ----
  // Safari on macOS has limited notification support from extensions.
  // Wrap chrome.notifications.create to silently fail if it throws.
  if (chrome.notifications) {
    const originalCreate = chrome.notifications.create.bind(chrome.notifications);
    chrome.notifications.create = function (notificationId, options, callback) {
      try {
        return originalCreate(notificationId, options, callback);
      } catch (e) {
        console.debug("Vimfari: notification not supported in this context:", e.message);
        if (callback) callback(notificationId);
      }
    };
  }
}

// Export for use by other modules.
globalThis.__safariDetected = _safariDetected;
