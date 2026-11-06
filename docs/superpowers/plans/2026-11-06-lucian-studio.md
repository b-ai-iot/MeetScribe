# Lucian Archive Studio Implementation Plan

> Execute the user-delegated design autonomously with independent file-owned agents and root integration; use TDD for behavior, rendered visual QA, and a final fresh whole-branch reviewer.

**Goal:** Replace v1.4.0's repetitive layout with a source-grounded archive studio, settings workbench and connected meeting controller; release v1.5.0.
**Architecture:** Native DOM/CSS, existing worker/archive protocol unchanged. Shared indigo/violet tokens; selected-session inspector with race-safe state; explicit settings save; existing classic content bootstrap.
**Spec:** `docs/superpowers/specs/2026-11-06-lucian-studio-design.md`

## Global constraints

- No runtime dependencies/network assets/new permissions; MIT attribution for adapted Lucian components.
- Preserve every capture/export/storage/recovery operation, raw data and VI/EN; explicit old preferences.
- Palette/timings from spec; 44px controls, text>=4.5:1, functional outlines>=3:1; reduced motion.
- No fake metrics/AI transcript/cloud/autosave. No worker protocol changes.
- Workers own disjoint files, never stage/commit/push or spawn helpers. Root owns shared shell, brand, central UI catalog, existing integration tests, docs/CI/version and release.

## Review focus

- Selection A/B races cannot show/export/delete wrong session; operation state and destination persist across navigation/language.
- Mobile detail Back restores row focus; empty filters clear stale content.
- Settings saves remain explicit; preview and pending fields survive language changes; deep-link repair prominent.
- Controller edge geometry and picker reachability; invalidated-context recovery and pending-buffer cleanup.
- Visual composition must change layout, not merely colors; all existing actions remain reachable.

### Task 1: Root foundation

- [x] Baseline npm ci/unit suite; store research and exact source attribution.
- [x] Shared workspace.css tokens/nav/shell, central new UI labels, violet canonical brand/PNG export.

### Task 2: Archive library agent

Own library.html/css/js and NEW tests/archive-studio.cjs. Root owns i18n-ui.js; request keys through root.
- [x] Red→green selected master/detail, filter/mobile navigation, stale selected-detail reply guard, per-session ZIP destination/busy state, existing actions and raw data.
- [x] Build 340px searchable index and document/media inspector with progressive technical details and clear action/recovery hierarchy.
- [x] Inspect desktop/mobile VI/EN screenshots; report tests and constraints.

### Task 3: Settings agent

Own settings.html/css/js and NEW tests/settings-studio.cjs. Root owns shared CSS/catalog; don't edit library or content.
- [x] Compact preference workbench plus large sticky live preview; explicit save bar, pending/saving/saved/error, radio disclosure, top repair.
- [x] Test font/opacity preview, dirty fields, VI/EN, save/reset/repair, mobile/keyboard/reduced motion; inspect rendered views.

### Task 4: Controller agent

Own content.js/overlay.css/i18n-toolbar.js and tests/floating-toolbar.cjs. No extra injected globals/assets.
- [x] Connected capsule, compact anchored action menu, Details for secondary metadata; source-based motion/colors, canonical inline brand.
- [x] Red→green live state, drag/cancel/focus/corners, region-picker non-obstruction and explicit-lost cleanup; retain lifecycle/persistence tests.

### Task 5: Root integration/release

- [x] Adapt existing fixtures to actual selection/disclosures, preserve all behavior assertions; wire new tests to CI.
- [x] Update v1.5.0 metadata, notice/paired docs and actual screenshots. Validate all suites and artifact.
- [x] Fresh strongest review and cross-review found no blocking/major issues; re-verify.
- [ ] Push protected PR, wait CI, merge/tag/release, download/check ZIP and report.
