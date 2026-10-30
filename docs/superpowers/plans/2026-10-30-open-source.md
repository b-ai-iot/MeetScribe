# Open-source documentation implementation plan

Goal: Publish MeetScribe with user-approved MIT licensing, complete English/Vietnamese docs and reproducible UI screenshots. No runtime behavior or UI language change.

- [x] Add canonical MIT license and package/repository metadata; include license in extension archive.
- [x] Write English/Vietnamese README and paired installation, usage, exports, privacy, development, troubleshooting and architecture guides.
- [x] Add bilingual contributing, security, conduct, changelog and issue templates.
- [x] Generate screenshots from actual extension pages with synthetic demo data in isolated Chrome.
- [x] Add documentation link/translation/image validation and CI for docs, unit/browser/extension checks and packaging.
- [x] Review claims/links, test package licensing and portability, verify images visually and run automated checks.
Publication procedure: commit the verified files, integrate into main, push, and confirm the remote SHA in the delivery report.

Ownership: AGY Gemini3.8FlashHigh drafts docs/community files; Codex implements metadata/tooling/screenshots, reviews and verifies publication. MIT was explicitly selected by the user. Current UI is Vietnamese; documentation is bilingual. Real meeting and OS-picker validations remain manual.
