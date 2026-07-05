#!/usr/bin/env node
/**
 * Builds a Safari-compatible background service worker by concatenating all
 * dependencies into a single non-module JavaScript file.
 *
 * Safari Web Extensions do NOT support "type": "module" for service workers.
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;

// Files in dependency-respecting order
const ORDER = [
  // Layer 0: Library (no imports, assign to globalThis)
  "lib/safari_polyfill.js",
  "lib/types.js",
  "lib/utils.js",
  "lib/settings.js",
  "lib/url_utils.js",

  // Layer 1: Core background utilities
  "background_scripts/tab_recency.js",
  "background_scripts/bg_utils.js",
  "background_scripts/all_commands.js",

  // Layer 2: Commands (depends on all_commands.js)
  "background_scripts/commands.js",

  // Layer 3: Exclusions
  "background_scripts/exclusions.js",

  // Layer 4: Completion engine
  "background_scripts/completion/ranking.js",
  "background_scripts/completion/search_engines.js",
  "background_scripts/completion/search_wrapper.js",
  "background_scripts/user_search_engines.js",
  "background_scripts/completion/completers.js",

  // Layer 5: Tab operations
  "background_scripts/tab_operations.js",

  // Layer 6: Marks
  "background_scripts/marks.js",

  // Layer 7: Main (depends on everything above)
  "background_scripts/main.js",
];

// After stripping imports, main.js references these namespaces directly.
// We need to re-establish the namespace bindings before main.js runs.
const NAMESPACE_GLUE = `
/* ====== Namespace bindings for Safari bundle ====== */
// These re-establish what "import * as X" provided in the original code.
// All functions are now on globalThis from their respective files.
(function() {
  // bg_utils.js exports: isFirefox, isSafari, getFirefoxVersion, tabRecency
  globalThis.bgUtils = {
    isFirefox: globalThis.isFirefox,
    isSafari: globalThis.isSafari,
    getFirefoxVersion: globalThis.getFirefoxVersion,
    tabRecency: globalThis.tabRecency,
  };

  // exclusions.js exports: isEnabledForUrl
  globalThis.exclusions = {
    isEnabledForUrl: globalThis.isEnabledForUrl,
  };

  // marks.js exports: create, goto, getLocationKey
  globalThis.marks = {
    create: globalThis.create,
    goto: globalThis.goto,
    getLocationKey: globalThis.getLocationKey,
  };

  // tab_operations.js exports: openUrlInCurrentTab, openUrlInNewTab, openUrlInNewWindow
  globalThis.TabOperations = {
    openUrlInCurrentTab: globalThis.openUrlInCurrentTab,
    openUrlInNewTab: globalThis.openUrlInNewTab,
    openUrlInNewWindow: globalThis.openUrlInNewWindow,
  };

  // Completion search exports: complete, cancel
  globalThis.completionSearch = {
    complete: globalThis.complete,
    cancel: globalThis.cancel,
  };

  // user_search_engines.js exports: keywordToEngine, set, parseConfig
  globalThis.userSearchEngines = {
    keywordToEngine: globalThis.keywordToEngine,
    set: globalThis.set,
    parseConfig: globalThis.parseConfig,
  };

  // search_engines.js exports: list, plus individual engine classes
  globalThis.searchEngines = {
    list: globalThis.list,
  };

  // ranking.js exports: matches, wordRelevancy, recencyScore, RegexpCache
  globalThis.ranking = {
    matches: globalThis.matches,
    wordRelevancy: globalThis.wordRelevancy,
    recencyScore: globalThis.recencyScore,
    RegexpCache: globalThis.RegexpCache,
  };

  // commands.js exports: parseLines (used by user_search_engines.js)
  globalThis.commands = {
    parseLines: globalThis.parseLines,
  };
})();
`;

function processFile(filepath) {
  let content = fs.readFileSync(path.join(ROOT, filepath), "utf8");
  const original = content;

  // ---- Strip all import statements ----
  // import "../path/to/file.js";
  content = content.replace(/^import\s+["'][^"']+["']\s*;?\s*$/gm, "");
  // import * as X from "../path";
  content = content.replace(/^import\s+\*\s+as\s+\w+\s+from\s+["'][^"']+["']\s*;?\s*$/gm, "");
  // import { A, B } from "../path";
  content = content.replace(/^import\s+\{[^}]+\}\s+from\s+["'][^"']+["']\s*;?\s*$/gm, "");
  // import X from "../path";
  content = content.replace(/^import\s+\w+\s+from\s+["'][^"']+["']\s*;?\s*$/gm, "");

  // ---- Strip all export statements ----
  // export class X
  content = content.replace(/^export\s+class\s+/gm, "class ");
  // export async function X  /  export function X
  content = content.replace(/^export\s+async\s+function\s+/gm, "async function ");
  content = content.replace(/^export\s+function\s+/gm, "function ");
  // export const/let/var X
  content = content.replace(/^export\s+const\s+/gm, "const ");
  content = content.replace(/^export\s+let\s+/gm, "let ");
  content = content.replace(/^export\s+var\s+/gm, "var ");
  // export { X, Y, ... };
  content = content.replace(/^export\s+\{[^}]*\}\s*;?\s*$/gm, "");
  // export default X
  content = content.replace(/^export\s+default\s+/gm, "");

  // ---- Add globalThis assignments for key symbols ----
  // We do this for symbols that other files reference without a namespace prefix.
  // The main.js file references bgUtils, TabOperations, marks, exclusions, etc.
  // Since we stripped imports, these need to be available as globals.

  // ---- Add globalThis assignments for specific files ----
  // This ensures key symbols are available globally after stripping exports.
  const exportsMap = {
    "background_scripts/tab_recency.js": ["TabRecency"],
    "background_scripts/bg_utils.js": ["isFirefox", "isSafari", "getFirefoxVersion", "tabRecency"],
    "background_scripts/all_commands.js": ["allCommands"],
    "background_scripts/commands.js": ["RegistryEntry", "Commands", "defaultKeyMappings", "KeyMappingsParser", "parseLines"],
    "background_scripts/exclusions.js": ["isEnabledForUrl"],
    "background_scripts/completion/ranking.js": ["matches", "wordRelevancy", "recencyScore", "RegexpCache"],
    "background_scripts/completion/search_engines.js": ["BaseEngine", "Google", "GoogleMaps", "Youtube", "Wikipedia", "Bing", "Amazon", "DuckDuckGo", "Webster", "Qwant", "Brave", "Kagi", "list"],
    "background_scripts/completion/search_wrapper.js": ["complete", "cancel"],
    "background_scripts/user_search_engines.js": ["UserSearchEngine", "keywordToEngine", "parseConfig", "set"],
    "background_scripts/completion/completers.js": ["Suggestion", "BookmarkCompleter", "CommandCompleter", "HistoryCompleter", "DomainCompleter", "TabCompleter", "SearchEngineCompleter", "MultiCompleter", "HistoryCache"],
    "background_scripts/tab_operations.js": ["openUrlInCurrentTab", "openUrlInNewTab", "openUrlInNewWindow"],
    "background_scripts/marks.js": ["getLocationKey", "create", "goto"],
  };

  if (exportsMap[filepath]) {
    content += "\n// Safari bundle: export symbols to globalThis\n";
    for (const name of exportsMap[filepath]) {
      content += `globalThis.${name} = ${name};\n`;
    }
  }

  return { content: content.trim(), changed: content !== original };
}

function bundle() {
  const parts = [
    `/* Vimfari background service worker — SAFARI BUNDLE */
/* Auto-generated by build-safari-bg.js — do not edit directly */
"use strict";
`,
  ];

  for (const filepath of ORDER) {
    const fullPath = path.join(ROOT, filepath);
    if (!fs.existsSync(fullPath)) {
      console.error(`SKIP (missing): ${filepath}`);
      continue;
    }

    // Insert namespace glue right before main.js
    if (filepath === "background_scripts/main.js") {
      parts.push(NAMESPACE_GLUE);
    }

    const { content } = processFile(filepath);
    parts.push(`\n/* ====== ${filepath} ====== */\n`);
    parts.push(content);
    parts.push("\n");
  }

  // Join and apply post-processing fixes
  let output = parts.join("");

  // Safari service worker lifecycle: claim clients immediately on activation
  // This ensures the service worker responds to messages right after restart.
  output = output.replace(
    '"use strict";',
    '"use strict";\n\n// Safari service worker lifecycle: claim all clients on activation\n// Safari terminates service workers after ~30s of inactivity, so we must\n// re-initialize quickly when restarted.\nself.addEventListener("activate", (event) => {\n  event.waitUntil(self.clients.claim());\n  console.debug("Vimfari: service worker activated");\n});\n'
  );

  // Fix variable name collisions from concatenation:
  // 1. RegexpCache is declared in both exclusions.js (internal alias) and ranking.js (exported)
  output = output.replace(
    "const RegexpCache = ExclusionRegexpCache;",
    "const _RegexpCacheExcl = ExclusionRegexpCache;"
  );

  // Guard setAccessLevel call — Safari may have it but it may throw
  output = output.replace(
    "chrome.storage.session.setAccessLevel({ accessLevel: \"TRUSTED_AND_UNTRUSTED_CONTEXTS\" });",
    "try { chrome.storage.session.setAccessLevel({ accessLevel: \"TRUSTED_AND_UNTRUSTED_CONTEXTS\" }); } catch(e) { console.debug('Vimfari: setAccessLevel not supported'); }"
  );

  // Guard top-level chrome.storage.session.set({ vimiumSecret })
  output = output.replace(
    "chrome.storage.session.set({ vimiumSecret: secretToken });",
    "try { chrome.storage.session.set({ vimiumSecret: secretToken }); } catch(e) { console.debug('Vimfari: failed to set vimiumSecret', e); }"
  );

  // Guard chrome.webNavigation.onHistoryStateUpdated
  output = output.replace(
    "chrome.webNavigation.onHistoryStateUpdated.addListener(onURLChange);",
    "try { chrome.webNavigation.onHistoryStateUpdated.addListener(onURLChange); } catch(e) { console.debug('Vimfari: webNavigation.onHistoryStateUpdated not supported'); }"
  );

  // Guard chrome.webNavigation.onReferenceFragmentUpdated
  output = output.replace(
    "chrome.webNavigation.onReferenceFragmentUpdated.addListener(onURLChange);",
    "try { chrome.webNavigation.onReferenceFragmentUpdated.addListener(onURLChange); } catch(e) { console.debug('Vimfari: webNavigation.onReferenceFragmentUpdated not supported'); }"
  );

  // Guard chrome.webNavigation.onCommitted — needs to wrap the whole addListener call
  output = output.replace(
    "chrome.webNavigation.onCommitted.addListener(async ({ tabId, frameId }) => {",
    "try { chrome.webNavigation.onCommitted.addListener(async ({ tabId, frameId }) => {"
  );
  // The catch for onCommitted needs to close after swallowError
  output = output.replace(
    "  }).catch(swallowError);\n});",
    "  }).catch(swallowError);\n}); } catch(e) { console.debug('Vimfari: webNavigation.onCommitted not supported'); }"
  );

  output = output.replace(
    "      });\n    });\n  })();",
    "      });\n    });\n  })(); } catch(e) { console.debug('Vimfari: CSS cache fetch failed', e); }"
  );

  // Guard chrome.tabs.onRemoved — wrap the entire addListener call
  // The closing pattern ends with "});" on its own line before "// Convenience function"
  output = output.replace(
    "chrome.tabs.onRemoved.addListener(function (tabId) {",
    "try { chrome.tabs.onRemoved.addListener(function (tabId) {"
  );
  output = output.replace(
    "\n});\n\n// Convenience function for development use.",
    "\n}); } catch(e) { console.debug('Vimfari: tabs.onRemoved not supported'); }\n\n// Convenience function for development use."
  );

  const outputPath = path.join(ROOT, "background_scripts", "background.bundle.js");
  fs.writeFileSync(outputPath, output, "utf8");

  const sizeKB = (fs.statSync(outputPath).size / 1024).toFixed(1);
  console.log(`✅ Safari background bundle: ${outputPath} (${sizeKB} KB)`);
}

bundle();
