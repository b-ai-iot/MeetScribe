# Security policy

[Tiếng Việt](SECURITY.vi.md) · [Privacy and permissions](docs/en/privacy.md)

## Supported code

Maintenance focuses on the latest `main` (currently version 1.2.0), on a best-effort basis. There is no published response-time commitment. Update before reporting a problem and include the commit/version, Chrome version and operating system.

## Reporting privately

If **Security → Report a vulnerability** is available in [this repository](https://github.com/b-ai-iot/MeetScribe/security/advisories), use GitHub private vulnerability reporting. Availability is not assumed by this policy.

If that route is unavailable, open a public issue that only asks maintainers for a private contact channel. Do not include an exploit, sensitive reproduction details, meeting URLs, captions, slides or personal data in that public request. No dedicated security email is published; use the routes above.

For ordinary non-sensitive bugs, use the bilingual [issue form](https://github.com/b-ai-iot/MeetScribe/issues/new/choose) with synthetic data.

## Boundaries

The extension does not upload captured content or use AI API credentials. It uses active-tab access instead of broad production host permissions and requests no audio in its optional tab video stream. This reduces some exposure; it does not eliminate device, browser, meeting-page or export-sharing risks.

Shadow DOM provides style isolation, not a security boundary against the meeting page. Captions originate in page DOM and are not authenticated evidence. Backups are local browser data, not application-level encrypted storage. User-selected folders may be cloud-synced. See the privacy guide for whole-tab in-memory capture, retained comparison frames and deletion behavior.

Use disposable profiles and synthetic content when investigating. Do not post secrets or real meeting data in public issues, logs, screenshots or pull requests.
