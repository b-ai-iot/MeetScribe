# Changelog

[Tiếng Việt](CHANGELOG.vi.md) · [README](README.md)

## 1.5.0 — 2026-11-06

- Rebuild the library as a searchable meeting index and selected-session inspector with caption/media space, contextual recovery and one export command bar.
- Recompose settings as compact preference groups beside a live preview stage with explicit save-state feedback.
- Replace detached floating controls with a connected indigo/violet capsule and compact anchored action menu; improve region-selection and invalidated-context cleanup.
- Adapt selected Lucian UX/UI Prompt workspace, navigation, disclosure, menu and save-feedback patterns with upstream MIT notices included in distribution.
- Add selection-race, per-session operation, mobile navigation and settings/controller regression checks; refresh paired docs and actual UI screenshots.

## 1.4.0 — 2026-11-05

- Redesign the meeting controls around an AssistiveTouch-inspired floating button and attached popover, with drag/keyboard movement, persistent preferences and visible recording/error state.
- Introduce an original caption-bubble icon and a pearl/emerald workspace shared by the meeting library and settings.
- Improve responsive navigation, session/action hierarchy and appearance preview while retaining capture, local backups, exports, folder repair and live VI/EN support.
- Add floating-control and workspace regression checks; refresh bilingual usage guides and screenshots.

## 1.3.1 — 2026-11-02

- Prevent toolbar callbacks from retaining a missing or partial translation engine (`t` / `applyTranslations` errors).
- Load the language engine before its catalogs and verify readiness in the selected meeting frame before installing content callbacks.
- Detect retained v1.3.0 instances before mounting and request an explicit meeting-tab reload after stopping/saving; do not replace a collector or discard pending captions. Require an acknowledged mount instead of reporting false success.
- Add dependency-failure, legacy preservation and repeated-mount regression coverage, including real unpacked-extension VI/EN capture tests.

## 1.3.0 — 2026-10-30

- First packaged GitHub release, with deterministic extension ZIP, SHA-256 checksums and bilingual release workflow.
- Adopt GitHub Flow, CODEOWNERS, PR template and documented branch/tag rules with a sole-maintainer review exception.
- Add the user-selected MIT license and include it in the extension distribution ZIP.
- Add paired English/Vietnamese guides, contribution/security/conduct policies and issue forms.
- Add actual extension screenshots with synthetic meeting data and a regeneration command.
- Add local documentation validation and a GitHub Actions verification workflow.
- Make browser tests create their output directory in a fresh checkout. The documentation changes do not alter runtime behavior.

- Add persisted VI/EN interface language in Settings, with live updates across open pages and an active toolbar.
- Translate static/dynamic UI, accessible labels, error/recovery messages and generated export helper text; keep captured data unchanged.
- Add native Chrome locale metadata, migration/reset behavior and regression coverage for live capture, reload, native error details and async preference races.

## 1.2.0 — 2026-10-30

- Add opacity/font settings, remembered toolbar position/compact mode and reset.
- Add custom output directories pinned to each session, permission repair and retained journal backups on export failure.
- Add portable ZIP export with caption/image/event files, timestamped snapshots, AI instructions, entry manifest and Save As.
- Improve caption detection/reacquisition, ambiguity handling and manual override.
- Add library search, display renaming, previews, backup sizes and confirmed deletion for stopped sessions.
- Verify unit/browser suites and unpacked Meet/Zoom fixtures, including a 1 MiB ZIP extracted by Python. See [verification](docs/verification.md) for the dated counts and limits.

## 1.1.0 — 2026-10-30

- Add Zoom web/PWA support, meeting-frame routing and iframe crop-coordinate translation.
- Add official-domain validation and Zoom caption/frame fixtures.

## 1.0.0 — 2026-10-29

- Introduce the independent Google Meet caption collector, floating toolbar, journal-first local storage and ordinary Downloads export.
- Add selected shared-region image sampling, local deduplication and session finalization.

`v1.3.0` is the first packaged GitHub release. Earlier version entries describe source history. There is no Chrome Web Store distribution.
