#!/usr/bin/env node
/**
 * Safari background script bundler for Vimfari.
 *
 * Safari Web Extensions cannot handle complex ES module import chains in service workers.
 * This script concatenates all background script dependencies into a single file,
 * stripping import/export statements and using globalThis for cross-file references.
 *
 * Usage: node bundle-background.js
 * Output: background_scripts/background.bundle.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;

// Files in dependency order. Each entry also lists what it provides via globalThis.
const FILES = [
  // Library layer (all use globalThis.* pattern, no exports)
  { path: "lib/safari_polyfill.js", provides: ["_isSafari"] },
  { path: "lib/types.js", provides: [] },
  { path: "lib/utils.js", provides: ["Utils", "SimpleCache", "EventDispatcher"] },
  { path: "lib/settings.js", provides: ["Settings"] },
  { path: "lib/url_utils.js", provides: ["UrlUtils"] },

  // Background scripts with exports (we'll strip exports and add globalThis)
  { path: "background_scripts/tab_recency.js", provides: ["TabRecency"] },
  { path: "background_scripts/bg_utils.js", provides: ["isFirefox", "isSafari", "getFirefoxVersion", "tabRecency"] },
  { path: "background_scripts/all_commands.js", provides: ["allCommands"] },
  { path: "background_scripts/commands.js", provides: ["RegistryEntry", "Commands", "defaultKeyMappings", "KeyMappingsParser", "parseLines"] },
  { path: "background_scripts/exclusions.js", provides: ["isEnabledForUrl"] },
  { path: "background_scripts/completion/ranking.js", provides: ["matches", "wordRelevancy", "recencyScore", "RegexpCache"] },
  { path: "background_scripts/completion/search_engines.js", provides: ["Google", "GoogleMaps", "Youtube", "Wikipedia", "Bing", "Amazon", "DuckDuckGo", "Webster", "Qwant", "Brave", "Kagi", "list"] },
  { path: "background_scripts/completion/search_wrapper.js", provides: ["complete", "cancel"] },
  { path: "background_scripts/user_search_engines.js", provides: ["keywordToEngine", "set", "get"] },
  { path: "background_scripts/completion/completers.js", provides: ["Suggestion", "BookmarkCompleter", "CommandCompleter", "HistoryCompleter", "DomainCompleter", "TabCompleter", "SearchEngineCompleter", "MultiCompleter", "HistoryCache"] },
  { path: "background_scripts/tab_operations.js", provides: ["openUrlInCurrentTab", "openUrlInNewTab", "openUrlInNewWindow"] },
  { path: "background_scripts/marks.js", provides: ["getLocationKey", "create", "goto"] },
  { path: "background_scripts/reload.js", provides: [] },
];

// The main.js has complex logic that uses imports from above files.
// We include it as the last file after stripping its import statements.
const MAIN_FILE = "background_scripts/main.js";

function stripExports(content) {
  // Replace `export class X` with `class X`
  content = content.replace(/^export\s+class\s+/gm, "class ");
  // Replace `export function X` with `function X`
  content = content.replace(/^export\s+function\s+/gm, "function ");
  // Replace `export async function X` with `async function X`
  content = content.replace(/^export\s+async\s+function\s+/gm, "async function ");
  // Replace `export const X` with `const X`
  content = content.replace(/^export\s+const\s+/gm, "const ");
  // Replace `export let X` with `let X`
  content = content.replace(/^export\s+let\s+/gm, "let ");
  // Replace `export { X, Y }` with comment
  content = content.replace(/^export\s*\{[^}]*\}\s*;?\s*$/gm, "// export stripped");
  // Replace `export var` with `var`
  content = content.replace(/^export\s+var\s+/gm, "var ");

  return content;
}

function stripImports(content) {
  // Remove all import statements
  content = content.replace(/^import\s+.*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, "// import stripped (loaded via bundle)");
  content = content.replace(/^import\s+['"][^'"]+['"]\s*;?\s*$/gm, "// import stripped (loaded via bundle)");
  return content;
}

function addGlobalThisAssignments(content, provides) {
  for (const name of provides) {
    // Only add if the file defines this name and it's not already exported to globalThis
    if (!content.includes(`globalThis.${name}`)) {
      // Add at the end: globalThis.X = X;
      content += `\nglobalThis.${name} = ${name};\n`;
    }
  }
  return content;
}

function bundle() {
  let output = `/**
 * Vimfari Safari background script — BUNDLED
 * Generated automatically. Do not edit directly.
 *
 * This file bundles all background script dependencies into a single file
 * for Safari Web Extension compatibility.
 */
"use strict";

// ---- Safari polyfill (must load first) ----
`;

  // Process and concatenate each file
  for (const file of FILES) {
    const filePath = path.join(ROOT, file.path);
    if (!fs.existsSync(filePath)) {
      console.error(`MISSING: ${file.path}`);
      continue;
    }

    let content = fs.readFileSync(filePath, "utf8");

    // Strip imports and exports
    content = stripImports(content);
    content = stripExports(content);

    // Add globalThis assignments for exported symbols
    content = addGlobalThisAssignments(content, file.provides);

    output += `\n// ======== ${file.path} ========\n`;
    output += content;
    output += "\n";
  }

  // Process main.js last (it has many imports that reference globalThis)
  const mainPath = path.join(ROOT, MAIN_FILE);
  if (fs.existsSync(mainPath)) {
    let mainContent = fs.readFileSync(mainPath, "utf8");

    // Strip import statements
    mainContent = stripImports(mainContent);

    // Fix the import at lines 16-23 (destructured import from completers.js)
    mainContent = mainContent.replace(
      /\/\/ import stripped[\s\S]*?BookmarkCompleter[\s\S]*?TabCompleter[\s\S]*?from\s+['"][^'"]+['"]\s*;?\s*$/gm,
      "// Using globalThis for completers (loaded via bundle)"
    );

    // Fix `import * as TabOperations from "./tab_operations.js";`
    mainContent = mainContent.replace(
      /\/\/ import stripped[\s\S]*?TabOperations[\s\S]*?tab_operations['"]\s*;?\s*$/gm,
      "const TabOperations = globalThis; // tab_operations functions are on globalThis"
    );

    // Fix references like `bgUtils.isFirefox()` → use globalThis
    // bgUtils functions are already on globalThis
    mainContent = mainContent.replace(/bgUtils\./g, "");

    output += `\n// ======== ${MAIN_FILE} ========\n`;
    output += mainContent;
    output += "\n";
  }

  // Write the bundle
  const outputPath = path.join(ROOT, "background_scripts", "background.bundle.js");
  fs.writeFileSync(outputPath, output, "utf8");
  console.log(`Bundle written to: ${outputPath}`);
  console.log(`Size: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB`);
}

bundle();
