# MeetScribe Usability and Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver configurable UI and arbitrary local saving, portable ZIPs, reliable native-caption discovery, and a usable session library.
**Architecture:** Keep vanilla MV3, durable IndexedDB journal and platform-specific DOM collector. Add settings/destination adapters and independent archive packaging; preserve existing data and download behavior.
**Tech Stack:** JavaScript modules, Chrome MV3, IndexedDB, Node tests, Playwright, Python package tool.
**Spec:** docs/superpowers/specs/2026-10-30-usability-export-design.md

## Global Constraints
Follow the spec's Vietnamese/local-only UI, no host permission expansion, journal-first persistence, opacity/font bounds, next-session destinations and stopped-session deletion/export rules. Work only in this worktree; do not push, merge main, modify credentials or personal browser profiles.

## Review Focus
- Canceled/revoked directory grant must preserve destination/pending data and allow explicit reauthorization.
- Existing sessions/old IndexedDB records must remain readable and exportable.
- ZIP must contain exported as well as pending files and exact PNG bytes with safe Unicode names.
- Hidden yet connected caption nodes, replaced nodes, and competing chat/log regions must not capture unrelated text.
- Stop/export/delete races and failed writes must not falsely report success or lose backup.

### Task 1: Persistent settings and usable toolbar
**Files:** create extension/settings.mjs, extension/settings.html, extension/settings.js, extension/settings.css; modify extension/content.js, overlay.css, background.js, manifest.json, library.html; add tests/settings.test.mjs and browser checks.
**Interfaces:** settings module supplies defaults, validated opacity/fontSize/toolbarPosition/collapsed/destination and get/save/reset operations used by toolbar and later destination tasks; choose exact signatures and document in ledger before coding.
- [x] Write behavioral tests for bounds, reset, persistence and canceled state changes, run and confirm missing behavior.
- [x] Implement persistent settings, accessible UI, toolbar settings link and immediate background-only alpha updates, position/compact restore and reset.
- [x] Run npm test and targeted browser validation; commit task and update progress ledger with actual results.

### Task 2: Arbitrary output directory

**Supervisor gate:** Read `docs/superpowers/supervisor-review.md` and fix the verified Task 1 issues with regressions before implementing this task. Codex is reviewing incrementally; read this file at each subsequent task too.
**Files:** create extension/destination.mjs; modify store.mjs, settings.js, downloads.mjs, background.js, model.mjs and tests/browser.cjs; add destination tests.
**Interfaces:** consume Task 1 settings; expose export-to-destination abstraction for journal file with per-session destination identity; preserve legacy downloads export.
- [x] Add failing tests for cancel, grant/revoke, custom-directory write, retry and persisted handle/session destination pinning.
- [x] Implement IndexedDB handle persistence/schema upgrade; picker from explicit settings click, grant feedback and writer adapter. Prevent next-session changes affecting old sessions.
- [x] Verify actual custom file writes and handle reload in isolated Chrome; run suite, commit and ledger exact limits.

### Task 3: ZIP for AI
**Files:** create extension/archive.mjs and tests/archive.test.mjs; modify store.mjs, background.js, library.js/library.html/library.css; add browser/extension coverage.
**Interfaces:** expose list-all-session-files read independent of pending state; archive module builds standard ZIP bytes + manifest/transcript/readme from stable stopped session.
- [x] Write failing tests for all journal entries, binary PNG, Vietnamese UTF-8, snapshots, safe paths, bounded size and active session rejection.
- [x] Implement standard ZIP using a small bundled library or well-tested format writer; progress/loading/error/retry, save destination choice and stop-and-export.
- [x] Extract generated artifact with Python zipfile and compare contents; run suite, commit, ledger.

### Task 4: Automatic native-caption discovery/recovery
**Files:** create focused caption detector script/module compatible with content-script injection; modify content.js/install.mjs; extend browser tests and Meet/Zoom fixtures.
**Interfaces:** detector returns region/confidence/ambiguous status; collector preserves explicit manual selection and safely rebinds automatic sources.
- [ ] Add failing DOM tests: known Meet/Zoom selectors, hidden parent/connected node, replacement/reopen, ambiguous logs/chat and excluded toolbar.
- [ ] Implement candidate ranking, clear detection feedback, optional highlight/sample, automatic reacquisition and manual fallback without full-page capture.
- [ ] Verify caption batch ordering/stop drain still pass; commit and ledger.

### Task 5: Session library and full verification
**Files:** modify library.js/library.html/library.css, store.mjs, background.js, README.md, docs/verification.md, package/manifest versions; add behavioral tests/browser scenarios.
**Interfaces:** existing session reads plus safe display-name override, preview, byte accounting and confirmed deletion of stopped sessions.
- [ ] Test search/date/rename/preview/deletion, recording-session guard, literal rendering of unsafe titles/text, and no file relocation.
- [ ] Implement restrained responsive library UI and truthful separate backup/export states; maintain keyboard focus and confirmation.
- [ ] Run npm test, npm run test:browser, npm run test:extension, npm run package; produce screenshots at desktop/375px in artifacts; record real commands and failures/limitations.
- [ ] Commit; mark checklist and ledger only when verified. Report SHAs, files, test counts, screenshot paths, directory-write evidence and unresolved issues for supervising Codex review.
