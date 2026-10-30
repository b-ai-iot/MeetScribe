# Installation & Setup

[Tiếng Việt](../vi/installation.md) · **English** · [Documentation Index](../README.md)

This guide walks you through installing MeetScribe from source, verifying manifest permissions, and preparing your environment for meeting capture.

---

## Prerequisites

- **Browser:** Google Chrome on desktop (version 116 or higher).
- **Operating System:** macOS, Windows, or Linux.
- **Meeting Platforms:** Official web versions of [Google Meet](https://meet.google.com) and [Zoom Web Client](https://app.zoom.us/wc).
- **Unsupported:** The native Zoom desktop client (`zoom.us.app` / `Zoom.exe`) is **not** supported because Chrome extensions cannot interact with external desktop applications.

---

## Method 1: Load Unpacked Extension (Recommended)

For a packaged stable build, download the extension ZIP and `SHA256SUMS.txt` from [GitHub Releases](https://github.com/b-ai-iot/MeetScribe/releases/latest), [verify SHA-256](releasing.md#verify-a-download) and extract it. Load the extracted `MeetScribe/` folder using the Chrome steps below. There is no Chrome Web Store listing.

To use source code instead:

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/b-ai-iot/MeetScribe.git
   cd MeetScribe
   ```
   *(Alternatively, download and extract the source ZIP from GitHub's `main` branch).*

2. **Open the Chrome Extensions Page:**
   Open Google Chrome and navigate to:
   ```text
   chrome://extensions/
   ```

3. **Enable Developer Mode:**
   Turn on the **Developer mode** toggle in the top-right corner of the Extensions page.

4. **Load Unpacked:**
   - Click the **Load unpacked** button in the top-left toolbar.
   - In the file picker, select the `extension/` directory located inside the cloned `MeetScribe` folder (ensure this directory contains `manifest.json`).

5. **Pin to Chrome Toolbar:**
   - Click the jigsaw puzzle icon (Extensions) on Chrome's toolbar.
   - Locate **MeetScribe** (the subtitle follows Chrome’s language) and click the pin icon to keep it visible.

---

## Method 2: Build a Local Distribution Package

If you want to create a clean zip archive for distribution or offline installation:

1. Ensure Python 3.9+ is installed.
2. Run the packaging script from the repository root:
   ```bash
   npm run package
   ```
   *(Or run directly: `python3 tools/package.py`)*
3. The script generates:
   ```text
   dist/MeetScribe-1.3.0.zip
   ```
4. Extract `MeetScribe-1.3.0.zip` to your desired location. It contains a self-contained `MeetScribe/` folder with `manifest.json`.
5. Follow steps 2–5 above, pointing **Load unpacked** to the extracted `MeetScribe/` folder.

---

## Permissions Breakdown

When you load MeetScribe, Chrome registers the permissions declared in [`extension/manifest.json`](../../extension/manifest.json). The table describes their current use:

| Permission | Technical Purpose |
| :--- | :--- |
| `activeTab` | Injects the floating toolbar into the currently active meeting tab only when you click the extension icon. |
| `scripting` | Executes the content scripts and style sheets that render the overlay interface. |
| `tabCapture` | Receives a temporary whole-tab video stream in memory, then crops the confirmed share rectangle; no audio is requested. |
| `offscreen` | Hosts an offscreen document to crop and deduplicate slide frames without interfering with meeting playback. |
| `downloads` | Writes session journals, JSONL caption parts, PNG slides, and ZIP bundles to Chrome's Downloads directory. |
| `alarms` | Retries pending exports every minute. The ten-second caption batching timer runs separately in the content script. |
| `unlimitedStorage` | Requests expanded local storage; it does not prevent user deletion, disk failure or every form of data loss. |
| `storage` | Stores UI preferences in chrome.storage.local. Directory handles and their active identifiers are stored in IndexedDB. |

> **Host Permissions Note:** The production extension includes **zero broad host permissions** (no `<all_urls>`, `*://*/*`, or wildcards). The test suite includes a temporary test-only copy with specific Meet/Zoom host grants, with those URLs routed to synthetic fixtures during Playwright smoke tests.

---

## Verifying Your Installation

1. Open a new tab and join or start a meeting on [Google Meet](https://meet.google.com) or [Zoom Web](https://app.zoom.us/wc).
2. Turn on live captions in the meeting:
   - **Google Meet:** Click the **CC** icon on the bottom meeting bar.
   - **Zoom Web:** Click the **Captions** / **Show Captions** button.
3. Click the **MeetScribe** extension icon in your Chrome toolbar.
4. You should see the translucent floating toolbar appear in the top-left area of your meeting tab with the badge `LOCAL · PRIVATE` and the primary button labeled `Bắt đầu ghi` ("Start recording").

For complete usage instructions and button explanations, proceed to the [Usage Guide](usage.md). For troubleshooting installation issues, see [Troubleshooting](troubleshooting.md).
