//
// Vimfari Native Bridge — Safari-specific JS ↔ Swift communication layer.
//
// On Safari, tab operations are handled by the native SFSafari* Swift APIs
// for better performance and reliability. On Chrome/Firefox, we fall back
// to chrome.runtime.sendMessage and the background service worker.
//
// This file must be loaded before mode_normal.js (which uses NativeBridge).

const NativeBridge = (() => {
  // Safari detection: the `safari` global is only available in Safari content scripts.
  const isSafari = typeof safari !== "undefined" &&
    safari.extension &&
    typeof safari.extension.dispatchMessage === "function";

  if (!isSafari) {
    // Non-Safari: NativeBridge is a transparent pass-through.
    // Background commands go to chrome.runtime.sendMessage as usual.
    return {
      available: false,
      send(command, data) { return false; },
    };
  }

  // ---- Safari: set up native messaging ----
  // Queue for async responses from the native handler.
  const pendingCallbacks = new Map();
  let callbackId = 0;

  // Listen for messages dispatched from the native Swift handler.
  safari.self.addEventListener("message", (event) => {
    if (event.name === "nativeBridgeResponse") {
      const { id, error, result } = event.message;
      const cb = pendingCallbacks.get(id);
      if (cb) {
        pendingCallbacks.delete(id);
        cb(error, result);
      }
    } else if (event.name === "navigateTo") {
      // Navigate current tab to a URL (from native openUrlInCurrentTab command).
      const url = event.message?.url;
      if (url) {
        window.location.href = url;
      }
    } else if (event.name === "nativeBridgeEvent") {
      // Async events pushed from native side (e.g. tab was restored).
      const { type, data } = event.message;
      if (NativeBridge._eventHandler) {
        NativeBridge._eventHandler(type, data);
      }
    }
  });

  return {
    available: true,

    // Send a command to the native Swift handler.
    // Returns true if the command was dispatched (synchronously).
    // For async responses, provide an optional callback.
    send(command, data, callback) {
      if (callback) {
        const id = ++callbackId;
        pendingCallbacks.set(id, callback);
        safari.extension.dispatchMessage(command, { id, ...data });
        // Timeout: clean up stale callbacks after 10 seconds.
        setTimeout(() => {
          if (pendingCallbacks.has(id)) {
            pendingCallbacks.delete(id);
            callback(new Error("Native command timed out"), null);
          }
        }, 10000);
      } else {
        safari.extension.dispatchMessage(command, data || {});
      }
      return true;
    },

    // Register a handler for async events pushed from native side.
    onEvent(handler) {
      NativeBridge._eventHandler = handler;
    },

    _eventHandler: null,
  };
})();

globalThis.NativeBridge = NativeBridge;
