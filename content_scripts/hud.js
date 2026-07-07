//
// A heads-up-display (HUD) for showing Vimium page operations.
// Note: you cannot interact with the HUD until document.body is available.
//
const HUD = {
  tween: null,
  hudUI: null,
  findMode: null,
  abandon() {
    if (this.hudUI) {
      this.hudUI.hide(false);
    }
  },

  // Set by @pasteFromClipboard to handle the value returned by pasteResponse
  pasteListener: null,

  // This HUD is styled to precisely mimick the chrome HUD on Mac. Use the
  // "has_popup_and_link_hud.html" test harness to tweak these styles to match Chrome's. One
  // limitation of our HUD display is that it doesn't sit on top of horizontal scrollbars like
  // Chrome's HUD does.

  handleUIComponentMessage({ data }) {
    const handlers = {
      hideFindMode: this.hideFindMode,
      search: this.search,
      unfocusIfFocused: this.unfocusIfFocused,
      pasteResponse: this.pasteResponse,
      showClipboardUnavailableMessage: this.showClipboardUnavailableMessage,
    };
    const handler = handlers[data.name];
    if (handler) {
      return handler.bind(this)(data);
    }
  },

  async init(focusable) {
    await Settings.onLoaded();
    if (focusable == null) {
      focusable = true;
    }
    if (this.hudUI == null) {
      const queryString = globalThis.vimiumDomTestsAreRunning ? "?dom_tests=true" : "";
      this.hudUI = new UIComponent();
      this.hudUI.load(
        `pages/hud_page.html${queryString}`,
        "vimium-hud-frame",
        this.handleUIComponentMessage.bind(this),
      );
    }
    // this[data.name]? data
    if (this.tween == null) {
      this.tween = new Tween(
        "iframe.vimium-hud-frame.vimium-ui-component-visible",
        this.hudUI.shadowDOM,
      );
    }
    const classList = this.hudUI.iframeElement.classList;
    classList.remove("vimium-non-clickable");
    classList.add("vimium-clickable");
    // On Firefox, the iframe must have been visible at least once for clipboard
    // paste to work. Make it briefly visible then re-hide it. Skip if the HUD
    // is already showing (e.g. find mode is active) to avoid hiding it.
    if (focusable && !this.hudUI.showing) {
      this.hudUI.setIframeVisible(true);
      getComputedStyle(this.hudUI.iframeElement).display;
      this.hudUI.setIframeVisible(false);
    }
  },

  // duration - if omitted, the message will show until dismissed.
  async show(text, duration) {
    await DomUtils.documentComplete();
    clearTimeout(this._showForDurationTimerId);
    // @hudUI.activate will take charge of making it visible
    await this.init(false);
    this.hudUI.show({ name: "show", text });
    this.tween.fade(1.0, 150);

    if (duration != null) {
      this._showForDurationTimerId = setTimeout(() => this.hide(), duration);
    }
  },

  async showFindMode(findMode = null) {
    this.findMode = findMode;
    await DomUtils.documentComplete();
    await this.init();
    this.hudUI.show({ name: "showFindMode" }, { focus: true });
    this.tween.fade(1.0, 150);
  },

  search(data) {
    // NOTE(mrmr1993): On Firefox, window.find moves the window focus away from the HUD. We use
    // postFindFocus to put it back, so the user can continue typing.
    this.findMode.findInPlace(data.query, {
      "postFindFocus": this.hudUI.iframeElement.contentWindow,
    });

    // Show the number of matches in the HUD UI.
    const matchCount = FindMode.query.parsedQuery.length > 0 ? FindMode.query.matchCount : 0;
    const showMatchText = FindMode.query.rawQuery.length > 0;
    this.hudUI.postMessage({ name: "updateMatchesCount", matchCount, showMatchText });
  },

  // Hide the HUD.
  // If :immediate is falsy, then the HUD is faded out smoothly (otherwise it is hidden
  // immediately).
  // If :updateIndicator is truthy, then we also refresh the mode indicator. The only time we don't
  // update the mode indicator, is when hide() is called for the mode indicator itself.
  hide(immediate, updateIndicator) {
    if (immediate == null) {
      immediate = false;
    }
    if (updateIndicator == null) {
      updateIndicator = true;
    }
    if ((this.hudUI != null) && (this.tween != null)) {
      clearTimeout(this._showForDurationTimerId);
      this.tween.stop();
      if (immediate) {
        if (updateIndicator) {
          Mode.setIndicator();
        } else {
          this.hudUI.hide();
        }
      } else {
        this.tween.fade(0, 150, () => this.hide(true, updateIndicator));
      }
    }
  },

  // These parameters describe the reason find mode is exiting, and come from the HUD UI component.
  hideFindMode({ exitEventIsEnter, exitEventIsEscape }) {
    let postExit;
    this.findMode.checkReturnToViewPort();

    // An element won't receive a focus event if the search landed on it while we were in the HUD
    // iframe. To end up with the correct modes active, we create a focus/blur event manually after
    // refocusing this window.
    globalThis.focus();

    const focusNode = DomUtils.getSelectionFocusElement();
    if (document.activeElement != null) {
      document.activeElement.blur();
    }

    if (focusNode && focusNode.focus) {
      focusNode.focus();
    }

    if (exitEventIsEnter) {
      FindMode.handleEnter();
      if (FindMode.query.hasResults) {
        postExit = () => newPostFindMode();
      }
    } else if (exitEventIsEscape) {
      // We don't want FindMode to handle the click events that FindMode.handleEscape can generate,
      // so we wait until the mode is closed before running it.
      postExit = FindMode.handleEscape;
    }

    this.findMode.exit();
    if (postExit) {
      postExit();
    }
    // Hide the HUD now that find mode is done.
    this.hide(true, true);
  },

  // These commands manage copying and pasting from the clipboard in the HUD frame.
  // NOTE(mrmr1993): We need this to copy and paste on Firefox:
  // * an element can't be focused in the background page, so copying/pasting doesn't work
  // * we don't want to disrupt the focus in the page, in case the page is listening for focus/blur
  // * events.
  // * the HUD shouldn't be active for this frame while any of the copy/paste commands are running.
  // Copy text to the system clipboard.
  //
  // Uses document.execCommand("copy") — a synchronous approach that works across all
  // browsers (including Safari) as long as the document has focus and transient user
  // activation is present. We prefer this over navigator.clipboard.writeText() because
  // the async clipboard API often fails in Safari content scripts and iframes due to
  // stricter user-activation propagation rules.
  copyToClipboard(text) {
    // Method 1: execCommand("copy") — synchronous, needs user activation + focus.
    const textarea = document.createElement("textarea");
    textarea.value = text;
    // Use opacity:0 + pointer-events:none instead of off-screen positioning.
    // Safari may not allow selection on elements positioned far off-screen.
    textarea.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none;";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    if (ok) return;

    // Method 2: navigator.clipboard.writeText() — async, needs user activation.
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {}).catch(() => {
        // Method 3: fall back to HUD iframe. Pass focusable=false to avoid
        // re-showing a hidden HUD via setIframeVisible(true) in init().
        this.init(false).then(() => {
          this.hudUI.postMessage({ name: "copyToClipboard", data: text });
        });
      });
      return;
    }

    // Method 3: HUD iframe (Chrome/Firefox isolated world fallback).
    this.init(false).then(() => {
      this.hudUI.postMessage({ name: "copyToClipboard", data: text });
    });
  },

  async pasteFromClipboard(pasteListener) {
    this.pasteListener = pasteListener;
    // Try navigator.clipboard.readText() directly in the content script.
    // This works in Safari where content scripts run in the page's main world.
    // Note: Safari shows a one-time permission prompt for clipboard read.
    if (navigator.clipboard?.readText) {
      try {
        const text = await navigator.clipboard.readText();
        this.pasteListener(text);
        return;
      } catch (e) {
        // Clipboard read failed; fall back to HUD iframe.
      }
    }
    await DomUtils.documentComplete();
    await this.init();
    this.tween.fade(0, 0);
    this.hudUI.postMessage({ name: "pasteFromClipboard" });
  },

  pasteResponse({ data }) {
    // Hide the HUD frame again.
    this.hudUI.setIframeVisible(false);
    this.unfocusIfFocused();
    this.pasteListener(data);
  },

  unfocusIfFocused() {
    // On Firefox, if an <iframe> disappears when it's focused, then it will keep "focused", which
    // means keyboard events will always be dispatched to the HUD iframe
    if (this.hudUI && this.hudUI.showing) {
      this.hudUI.iframeElement.blur();
      globalThis.focus();
    }
  },

  // Navigator.clipboard is only available in secure contexts. Show a warning when clipboard actions
  // fail on non-HTTPS sites. See #4572.
  async showClipboardUnavailableMessage() {
    await DomUtils.documentComplete();
    await this.init();
    // Since the message is long and surprising, show it for longer to allow more time to reading.
    this.show("Clipboard actions available only on HTTPS sites", 4000);
  },
};

class Tween {
  constructor(cssSelector, insertionPoint) {
    this.opacity = 0;
    this.intervalId = -1;
    this.styleElement = null;
    this.cssSelector = cssSelector;
    if (insertionPoint == null) insertionPoint = document.documentElement;
    this.styleElement = DomUtils.createElement("style");

    if (!this.styleElement.style) {
      // We're in an XML document, so we shouldn't inject any elements. See the comment in
      // UIComponent.
      Tween.prototype.fade = Tween.prototype.stop = Tween.prototype.updateStyle = function () {};
      return;
    }

    this.styleElement.type = "text/css";
    this.styleElement.innerHTML = "";
    insertionPoint.appendChild(this.styleElement);
  }

  fade(toAlpha, duration, onComplete) {
    clearInterval(this.intervalId);
    const startTime = (new Date()).getTime();
    const fromAlpha = this.opacity;
    const alphaStep = toAlpha - fromAlpha;

    const performStep = () => {
      const elapsed = (new Date()).getTime() - startTime;
      if (elapsed >= duration) {
        clearInterval(this.intervalId);
        this.updateStyle(toAlpha);
        if (onComplete) {
          onComplete();
        }
      } else {
        const value = ((elapsed / duration) * alphaStep) + fromAlpha;
        this.updateStyle(value);
      }
    };

    this.updateStyle(this.opacity);
    this.intervalId = setInterval(performStep, 50);
  }

  stop() {
    clearInterval(this.intervalId);
  }

  updateStyle(opacity) {
    this.opacity = opacity;
    this.styleElement.innerHTML = `\
${this.cssSelector} {
  opacity: ${this.opacity};
}\
`;
  }
}

globalThis.HUD = HUD;
