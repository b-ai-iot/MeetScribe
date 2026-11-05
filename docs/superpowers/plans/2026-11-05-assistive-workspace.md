# Assistive Workspace Implementation Plan

> **For agentic workers:** Use dispatching-parallel-agents for the disjoint UI subsystems; task-scoped review and final whole-branch review follow subagent-driven-development. The user approved execution, protected PR integration and release through the existing workflow.

**Goal:** Deliver the approved floating-button and pearl/emerald workspace redesign as v1.4.0.

**Architecture:** Keep vanilla HTML/CSS/JS and the current capture/storage protocol. The toolbar remains a shadow-root content script; its host anchors a floating button plus positioned popover. Library/settings share a responsive workspace stylesheet. Local SVG sources produce extension PNGs without runtime dependencies.

**Tech Stack:** Native DOM/CSS, existing Playwright and Node tests, Python packaging, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-05-assistive-workspace-design.md`

## Global Constraints

- MIT; zero runtime dependencies; no font/CDN/network requests, new meeting permissions, or automatic meeting reloads.
- Preserve every existing capture/export/storage/recovery feature, raw user data, VI/EN live updates and legacy explicit preferences.
- Palette: pearl #F6F7F0, white cards, evergreen #163C36, primary #176D59, mint #9DF4D3. Normal text contrast >=4.5:1; functional non-text >=3:1.
- 44px minimum operable targets; system UI font; reduced-motion support; test 375/390, 768 and 1440px plus short viewports.
- Floating button remains visible, supports keyboard/pointer repositioning, and reveals recording/error state without depending on color.
- Do not change worker/caption capture protocol or add global bootstrap dependencies to content.js.
- No worker agent may stage, commit, push, or spawn helpers. Ownership below avoids file collisions; root integrates and commits verified changes.

## Review Focus

- Dragging must not toggle the menu; Escape must restore launcher focus while recording continues.
- Button and popover must fit every viewport edge and high font size; hidden panel must have no focusable content.
- Fresh users start compact; explicit old collapsed/position preferences persist; reset returns to new defaults.
- VI/EN updates must preserve pending export/unsaved settings and must never translate raw captions/titles/paths.
- Existing recovery, directory repair and long-label action controls remain visible/reachable.

### Task 1: Identity and shared assets (root)

**Files:** `extension/icons/brand.svg`, existing 16/32/48/128 PNGs, `tools/icons.cjs`, packaging guard and asset tests when behavior is changed.
**Interfaces:** brand glyph viewBox `0 0 32 32`, a rounded bubble containing three vertical strokes; page brand `<img src="icons/brand.svg" alt="" aria-hidden="true">`; toolbar embeds the same glyph paths inline to avoid web-accessible resource permissions.

- [ ] Create canonical SVG and generate PNGs with the existing browser tooling; verify all sizes visually and alpha background.
- [ ] Run baseline tests, ensure SVG/PNGs are packaged, and supply glyph paths to both UI tasks.
- [ ] Independently review identity and package integration; commit verified files.

### Task 2: Floating control (toolbar implementer)

**Own files:** `extension/content.js`, `extension/overlay.css`, `extension/settings.mjs`, `extension/i18n-toolbar.js`, new `tests/floating-toolbar.cjs`, new geometry helper tests only if a helper is needed.
**Interfaces:** Keep IDs expanded/compact/start/stop/metrics/etc so existing actions and language bindings work. `#compact` becomes the always-visible 56–60px launcher, `#expanded` becomes attached popover, and `collapsed` remains the persisted visibility preference. Default compact=true only when no explicit stored value exists. Keep current stored coordinate and opacity/font formats. Reposition via pointer capture, arrow keys and a pointer-accessible reset/reposition control. No new injected runtime assets unless root agrees first.

- [ ] Write behavioral browser checks reproducing absent floating launcher/default collapse, drag-click conflict, Escape/focus, corners/resize and active capture through toggles; observe failures against baseline.
- [ ] Implement anchor/popover DOM and styles, status/error label, focus/Escape, drag and clamp behavior. Retain all capture/export/recovery handlers; document how current session state is preserved.
- [ ] Add VI/EN labels and preserve preferences. Test font/opacity, stored position/collapse/reset, touch cancellation and repeated mount.
- [ ] Run new tests and relevant unit/toolbar language suites; write a report with exact commands, outputs and limitations. Root adjusts cross-cutting fixtures for compact initial state.
- [ ] Task-scoped spec/quality review, resolve important findings, commit via root.

### Task 3: Library and settings workspace (pages implementer)

**Own files:** `extension/workspace.css`, `extension/library.html`, `extension/library.css`, `extension/library.js`, `extension/settings.html`, `extension/settings.css`, `extension/settings.js`, `extension/i18n-ui.js`, optional `extension/ui-icons.mjs`, new `tests/workspace-ui.cjs`.
**Interfaces:** Preserve existing field IDs, session/action class selectors, VI/EN current headings and worker commands. Shared pearl/emerald tokens live in workspace.css; both pages link it before page CSS. Brand asset from Task 1. Keep previewPanel background/font binding and appearance element ID stable. Root supplies final button-appearance preview integration when Task 2 lands.

- [ ] Write targeted behavior/layout checks for responsive shared navigation, complete controls, pending data across language changes and visible focus; observe failures where new behavior is absent.
- [ ] Replace marketing hero with compact workspace header/sidebar and responsive nav. Design white meeting cards and visually primary ZIP controls while retaining all secondary actions.
- [ ] Redesign grouped settings and desktop side preview; keep language/permissions/session repair flows and save/reset statuses. Add accessible SVG icons rather than font glyphs.
- [ ] Run new workspace tests, browser and language-UI suites; visually inspect 375/768/1440 screenshots in VI/EN. Report commands/results and limitations.
- [ ] Task-scoped spec/quality review, resolve important findings, commit via root.

### Task 4: Integration, docs and release (root)

**Files:** `tests/{browser,extension-smoke,language-toolbar,language-extension}.cjs`, `tools/screenshots.cjs`, `.github/workflows/ci.yml`, `package*.json`, manifest/model version, README/changelogs, paired usage/settings guides and docs images.
**Interfaces:** `npm run test:ui` executes floating-toolbar.cjs and workspace-ui.cjs; CI runs it with the installed Chromium. Final version 1.4.0 is consistent across package/lock/manifest/model. Existing test assertions are adapted only where approved initial compact state or new visual styling changes expectations.

- [ ] Integrate defaults/settings live preview, canonical icon identity, new test commands and CI; adjust old fixtures to explicitly expand before invoking panel actions.
- [ ] Run complete unit/browser/extension/language/UI/release/docs suites. Reproduce any failure before fixes; never weaken assertions to hide regressions.
- [ ] Review actual screenshots for all three surfaces, compare with approved mockup, and verify contrast and min sizes. Regenerate bilingual screenshot artifacts and update EN/VI usage, settings and release docs/changelogs.
- [ ] Dispatch final strongest whole-branch reviewer, fix important findings, then fresh final verification. Push feature branch and open PR.
- [ ] After required GitHub CI passes, squash merge to main, create annotated v1.4.0 tag, let release workflow publish and verify downloaded ZIP/checksum/version/license/locale assets. Fast-forward local main and report release plus update instructions.
