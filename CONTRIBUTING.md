# Contributing to MeetScribe

[Tiếng Việt](CONTRIBUTING.vi.md) · **English**

Thank you for your interest in contributing to MeetScribe! We welcome contributions, issue reports, and documentation improvements in both **English and Vietnamese**.

---

## Guiding Principles

1. **100% Local-First & Zero Telemetry:**
   MeetScribe must never make unsolicited external network calls, call external AI APIs during meetings, or include third-party tracking or analytics SDKs. Keep capture/journaling local and document the boundaries of user-selected folders and later sharing; see the [privacy guide](docs/en/privacy.md).
2. **Zero Runtime Dependencies:**
   The production extension (`extension/`) runs on standard ECMAScript modules and native Web APIs (Shadow DOM, MutationObserver, IndexedDB, File System Access API). Do not add npm runtime dependencies or introduce build/bundling steps for the extension itself.
3. **Honest Limitations & Accurate Documentation:**
   Always document exact system capabilities and constraints. Never invent capabilities, roadmap deadlines, or claims stronger than automated test fixtures or real-world verification support.
4. **Bilingual Parity:**
   When adding or updating features, user-facing UI labels, or documentation, maintain parity across both English and Vietnamese documentation files.

---

## Development & Testing Workflow

### Prerequisites
- Node.js 20+ (CI runs on Node.js 22)
- Python 3.9+
- Desktop Google Chrome
- Playwright Chromium

### Setup
```bash
git clone https://github.com/b-ai-iot/MeetScribe.git
cd MeetScribe
npm ci
npx playwright install chromium
```

### Verification Commands
Before submitting a pull request, ensure all verification suites pass:

```bash
# 1. Run unit test suite
npm test

# 2. Run real-browser DOM integration tests
npm run test:browser

# 3. Run unpacked extension smoke tests in Playwright
npm run test:extension

# 4. Check documentation links and bilingual parity
npm run docs:check

# 5. Verify packaging script
npm run package
```

*(Note for Linux/Windows: set `MEETSCRIBE_TEST_CHROME` to your Chrome binary or Playwright Chromium executable before running `npm run test:browser`).*

---

## Submitting Pull Requests

1. Fork the repository and create your feature branch:
   ```bash
   git checkout -b feature/my-improvement
   ```
2. Commit clear, focused changes with informative commit messages.
3. Ensure automated tests pass and add unit/integration tests for any new functionality.
4. If modifying user-facing text, document the exact Vietnamese label and its English equivalent.
5. Open a Pull Request on GitHub. You are welcome to write your PR description in English or Vietnamese.

---

## Code of Conduct

All contributors and participants must adhere to our [Code of Conduct](CODE_OF_CONDUCT.md). Please treat all community members with respect, patience, and empathy.

## Branches and review

Fork this repository, branch from current `main` using `feat/`, `fix/`, `docs/` or `chore/`, then open a PR into `main`. Required CI must pass and review conversations must be resolved before squash merge. See [access and review policy](docs/en/governance.md) and [release procedure](docs/en/releasing.md).
