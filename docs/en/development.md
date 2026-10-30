# Development & Testing Guide

[Tiếng Việt](../vi/development.md) · **English** · [Documentation Index](../README.md)

This guide covers setting up your local development environment, executing unit and browser test suites, generating documentation assets, and packaging the extension.

---

## Environment Requirements

- **Node.js:** Version 20.x or higher (GitHub Actions CI runs on Node.js 22).
- **Python:** Version 3.9 or higher (used for packaging and documentation verification).
- **Google Chrome:** Desktop Chrome installed locally.
  - **macOS:** Defaults automatically to `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.
  - **Linux / Windows:** Set the `MEETSCRIBE_TEST_CHROME` environment variable to your Chrome binary path, or point it to the Playwright Chromium executable.
- **Playwright:** Chromium browser binaries for running headless integration tests.

---

## Initial Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/b-ai-iot/MeetScribe.git
   cd MeetScribe
   ```

2. **Install development dependencies:**
   ```bash
   npm ci
   ```

3. **Install Playwright Chromium:**
   ```bash
   npx playwright install chromium
   ```
   *(On Linux distributions, install OS dependencies as well: `npx playwright install --with-deps chromium`).*

---

## Running Test Suites

MeetScribe maintains a multi-tiered test suite covering unit logic, real-browser DOM integration, unpacked extension worker lifecycle, and binary ZIP verification.

### 1. Unit Tests (`npm test`)
Executes fast Node.js built-in test runner across all `tests/*.test.mjs` files:
```bash
npm test
```
- **Scope (61 tests as of 2026-10-30 snapshot):** Caption candidate heuristics, exclusion filters (chat, roster, toolbar), widget grouping, visibility predicates (opacity and ancestry), scoped IndexedDB range queries, and ZIP structure, CRC and size guards (archive bytes are assembled in memory).

### 2. Browser Integration Tests (`npm run test:browser`)
Spawns an isolated real Google Chrome instance running automated DOM verification in `tests/browser.cjs`:
```bash
npm run test:browser
```
- **Scope (22 tests as of 2026-10-30 snapshot):** Real Origin Private File System (OPFS) handles, atomic `DataCloneError` transaction rejection, session library UI error propagation, Save As routing, and custom directory reauthorization.
- **Custom Chrome Path (Linux / Windows / CI):**
  ```bash
  export MEETSCRIBE_TEST_CHROME="$(node -e 'const { chromium } = require("playwright"); console.log(chromium.executablePath())')"
  npm run test:browser
  ```

### 3. Extension Smoke Tests (`npm run test:extension`)
Launches Playwright with the real unpacked extension loaded from a disposable fixture copy using `--load-extension`:
```bash
npm run test:extension
```
- **Scope:** Loads Google Meet and Zoom PWA iframe fixtures, tests toolbar injection, validates 1 MiB binary payload handling, and unpacks the generated ZIP via Python's standard `zipfile` module to verify CRC checksums and Vietnamese UTF-8 encoding.

### 4. Documentation & Link Validation (`npm run docs:check`)
Validates that all relative links, markdown references, and image paths exist without broken links:
```bash
npm run docs:check
```

### 5. Reproducible Screenshot Generation (`npm run docs:screenshots`)
Generates standardized UI screenshots with synthetic demonstration data:
```bash
npm run docs:screenshots
```

---

## Packaging the Extension (`npm run package`)

To generate the distribution archive:
```bash
npm run package
```
This script (`tools/package.py`) validates the manifest and creates:
```text
dist/MeetScribe-1.2.0.zip
```
Inside the archive is a self-contained `MeetScribe/` directory with `manifest.json`, background worker, content scripts, and icons.

---

## Engineering Standards & Architecture Philosophy

1. **Zero Runtime Dependencies:**
   - The production extension has **zero** runtime dependencies (`node_modules` is strictly for dev/test).
   - Everything is implemented in native ECMAScript Modules (`.mjs`), modern Web APIs (Shadow DOM, MutationObserver, IndexedDB, File System Access API), and lightweight SVG icons.

2. **No Bundling / Transpilation Step:**
   - Code inside `extension/` runs directly in Chrome without Webpack, Vite, or Babel. When editing files in `extension/`, simply reload the extension in `chrome://extensions`.

3. **Honest Testing Disclaimers:**
   - Automated tests rely on synthetic HTML fixtures and OPFS handles.
   - The native operating system directory picker dialog (`window.showDirectoryPicker()`) and live real-world meeting DOM mutations require manual verification.

## Windows PowerShell and manual checks

The `export` examples above use a POSIX shell. In PowerShell:

```powershell
$env:MEETSCRIBE_TEST_CHROME = node -p "require('playwright').chromium.executablePath()"
npm run test:browser
```

Before claiming real-world support for a change, manually check a Meet/Zoom web meeting with native captions enabled; toggling/replacing the caption container; correct manual share crop; canceling the OS directory picker without losing the prior setting; selecting a custom folder; reauthorizing after a full Chrome restart; and ZIP recovery after an ordinary export error. Use synthetic meeting content and a disposable profile. Record exactly what was tested, not just the test-suite totals.

The software distribution ZIP includes the canonical [MIT license](../../LICENSE). `private: true` in package.json prevents accidental npm publishing; it does not make the GitHub source private.
