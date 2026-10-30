# VI/EN Language Settings Implementation Plan

> Agentic workers: use Superpowers TDD and verification-before-completion; Codex coordinates the shared worktree. No worker commits/stages files.

Goal: Persist app language and fully localize user-owned UI while preserving captured data and active sessions.
Spec: docs/superpowers/specs/2026-10-30-language-settings-design.md
Stack: existing vanilla JavaScript MV3, no new dependencies.

## Shared interface
The classic/module API contracts are defined in extension/i18n.js and extension/i18n.mjs. Core API and settings schema are owned by root. Catalog prefixes isolate independent writers. No production dynamic imports in worker. Read-before-use dependencies: all catalogs must exist before module wrapper import works; root bootstraps empty catalog files immediately.

## Tasks
- [x] Root: tests first, pure i18n core/module wrapper, persisted language migration/reset, injection and baseline fixture updates.
- [x] UI worker: Settings language selector and static/dynamic Settings/Library translation, ui catalog, live update tests.
- [x] Toolbar worker: explicit toolbar/picker/status/notification localization, toolbar catalog, preserve active capture on language changes and tests.
- [x] System worker: worker/download/destination/store/archive/offscreen error and export helper localization, system catalog, tests; preserve structured/raw data.
- [x] Root: real extension VI/EN switching tests and regression suites, catalog parity, accessibility and screenshot verification; release1.3 docs/metadata/locales.
- [x] Independent review of changed surfaces and integration; fix verified findings with regressions.
Publication procedure: commit and integrate the verified feature, push using the existing repository workflow and report remote CI status.

## Review focus
Missing settings should not reset other preferences. Worker/offscreen catalogs must load statically. Old persisted errors must not leak VI wrappers in EN. Live locale updates must not stop/restart capture, recreate selected caption source, discard buffer or replace user content. Entire static/dynamic UI, title/aria/placeholder and both empty/error states must be covered. Exact message keys and per-language placeholder sets must match. Browser-owned error detail may stay original. Unsafe meeting strings stay textContent-only.
