# Release and Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox syntax for tracking.

**Goal:** Publish the first validated GitHub release and enforce GitHub Flow.

**Architecture:** Reuse CI for tag releases, build a deterministic ZIP and checksums, then upload assets to a draft before publishing. Separate mandatory main guardrails from the sole-maintainer review exception.

**Tech Stack:** GitHub Actions/REST, Python standard library, Node 22, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-30-release-governance.md`

## Global Constraints

- MIT; paired EN/VI documentation; no runtime feature changes.
- GitHub Flow, squash merges, no direct-main/force-push/deletion bypass.
- Release 1.3.0 with matching manifest/package/lock/model versions.
- No collaborator additions, credentials in source, or destructive tag replacement.

## Review Focus

- Reject malformed or mismatching release versions before publishing.
- Rebuild identical source despite filesystem timestamps.
- Verify checksums and MIT inclusion on downloaded release assets.
- A sole owner must merge through PR and pass CI even when bypassing review.
- Never replace a published immutable release on rerun.

### Task 1: Packaging and release validation

**Files:** `tools/package.py`, `tools/release.py`, `tests/test_release.py`.
**Interfaces:** `version(root, tag=None) -> str`; `python3 tools/package.py` writes ZIP and SHA256SUMS.txt; release CLI writes bilingual notes.

- [x] Write tests for deterministic archives, checksum/license/locale contents, mismatched versions and unsafe tags; run and observe failure.
- [x] Implement guards and deterministic package/checksum generation; run Python tests and npm test.

### Task 2: Workflow and documentation

**Files:** `.github/workflows/{ci,release}.yml`, `.github/CODEOWNERS`, `.github/pull_request_template.md`, paired governance/releasing guides, READMEs, changelogs, installation/contribution docs.
**Interfaces:** CI uploads ZIP/checksum; tag workflow consumes artifact after CI and verifies main ancestry.

- [x] Add reusable CI, version/ancestry gate and draft/upload/publish workflow with scoped permissions.
- [x] Add CODEOWNERS, PR template and bilingual contributor/release/install instructions.
- [x] Run docs checks, full CI locally where supported, and independent whole-branch review.
- [ ] Commit and push feature branch; open PR; verify required CI.

### Task 3: Remote governance and first release

**Files:** GitHub repository settings/rulesets, `v1.3.0` tag and release assets.
**Interfaces:** actual API readbacks and release download hashes.

- [ ] Apply squash-only settings and branch/tag rules; read back active rules, ensuring CI has no bypass.
- [ ] Merge the green PR, tag verified main and push the annotated tag.
- [ ] Wait for release CI, verify published assets/checksums and immutable status; report links and actual protections.
