# MeetScribe Implementation Plan
> For agentic workers: use superpowers:executing-plans, implement inline as explicitly authorized by user.

**Goal:** Independent polished Meet caption + selected share-image collector.
**Architecture:** Shadow DOM toolbar -> validated worker -> atomic IndexedDB -> confirmed Downloads exports. Optional offscreen video for ROI images.
**Tech Stack:** JavaScript ES modules, Chrome MV3 >=116, IndexedDB, node:test, Playwright fixtures.
**Spec:** ../specs/2026-10-29-meetscribe-design.md

## Global Constraints
- Never change old extension or skill. New name MeetScribe; new database.
- Default Downloads/MeetScribe/local date/meeting name + time + random suffix.
- No AI/network/audio/video-file recording. User confirms share ROI.
- Durable ack before removing queue; export complete only on download completion.

## Review Focus
- Worker restart between disk acknowledgement and export -> retained idempotent journal.
- Duplicate Start/Stop, invalid context and source disappearance -> explicit state and retained data.
- Unsafe/Unicode meeting names -> one safe folder under download root.
- Interrupted download -> retry; never successful completion marker in UI.
- Missing share stream and hidden/replaced region -> captions continue, no false image claim.

### Task 1: Model and durable journal
Files: extension/model.mjs, store.mjs; tests/model.test.mjs, journal browser fixture.
- [x] Write and run failing path/validation and durable batch/idempotency tests.
- [x] Implement session path and atomic journal with serialized sequence checkpoints.
- [x] Verify unit and real IndexedDB tests.

### Task 2: Worker, exports and visual capture
Files: manifest.json, background.js, downloads.mjs, offscreen.html/js, visual.mjs.
- [x] Test export interruption retains outbox, retry and completion confirmation.
- [x] Implement validated source/session commands, alarm retry, optional offscreen capture, image budgets.
- [x] Verify lifecycle and comparison tests.

### Task 3: Floating controls and library
Files: content.js, overlay.css, library.html/js/css, icons.
- [x] Write failing browser scenarios for context invalidation, duplicate start, stop drain, missing caption/share and keyboard/collapse.
- [x] Build UI and picker, durable batch acknowledgement/retry, readable status, recovery and library.
- [x] Run browser scenarios and visual QA at 1440/768/375 widths.

### Task 4: Review and delivery
Files: README.md, tools/package.py, docs/verification.md.
- [x] Review real extension integration, sender validation, interrupted-source behavior and downloads.
- [x] Fix important findings with regression coverage; run whole suite.
- [x] Package new extension, mirror user deliverables to current chat outputs; keep source in Desktop project.
