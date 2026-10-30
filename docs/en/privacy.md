# Privacy and permissions

[Tiếng Việt](../vi/privacy.md) · [Documentation](../README.md) · [Security policy](../../SECURITY.md)

MeetScribe stores captured data locally and does not include telemetry, analytics, an AI API client or an upload backend. This describes the extension's behavior, not the network activity of Chrome, your meeting provider, a synced folder or a tool you later use to process exports.

## What is collected

- Text snapshots of the native caption container you selected or the extension detected, with observation timestamps. Visible speaker names may be part of the raw text; the structured `speaker` field is currently `null`.
- Meeting title, meeting URL, platform, session times, status and operational events.
- If you explicitly enable shared-content capture: selected-region PNGs, crop coordinates, comparison evidence and nearby caption context.
- Appearance preferences and the directory handles you grant for custom saving.

Meeting captions, slide content, names and URLs may be sensitive. The source page controls the DOM; automatic detection is a heuristic and manual selection can include unrelated text if a region is too broad. Preview the source and exported files.

## Audio, video and network boundaries

MeetScribe does not request microphone/speaker audio or store an audio recording. It relies on captions produced by Meet/Zoom; those services have their own processing and network behavior.

Optional screenshot capture receives the **whole active-tab video stream in memory**, with `audio:false`, then crops the user-confirmed share rectangle in the offscreen document. It saves selected PNG crops, not a video file. Small comparison frames are retained in RAM for deduplication until final stop. This is not a claim that pixels outside the selected region never pass through memory.

The extension loads its own packaged assets and does not send captured content to an external service. Selecting a network/cloud-synced directory, sharing a ZIP or using an external AI tool can move data outside your device independently of MeetScribe. Review those systems' settings and policies.

## Chrome permissions

The production [manifest](../../extension/manifest.json) requests no broad host permissions.

| Permission | How MeetScribe uses it |
| --- | --- |
| `activeTab` | Temporary access after the user invokes the extension on a supported meeting tab |
| `scripting` | Inject collector/detector code and inspect the supported meeting frame |
| `tabCapture` | Obtain a temporary tab video stream for optional selected-region screenshots |
| `offscreen` | Host stream playback, crop canvas and comparison work outside the visible page |
| `downloads` | Start and inspect completion of journal/ZIP downloads; open an exported file's folder |
| `alarms` | Retry pending exports on a one-minute background alarm; caption batching has a separate ten-second content timer |
| `unlimitedStorage` | Request expanded extension storage; this does not prevent user deletion, disk failures or every form of data loss |
| `storage` | Persist UI preferences in `chrome.storage.local`; directory handles and their identifiers are in IndexedDB |

Automated smoke tests add specific Meet/Zoom host grants to a disposable extension copy and route those URLs to synthetic fixtures. These grants are not added to the production manifest.

## Storage, retention and deletion

The local backup uses the `meetscribe-local-v1` IndexedDB database in the Chrome profile. Exported JSONL/JSON/PNG/ZIP files go to Downloads, a selected custom folder, or the location chosen by Save As. Chrome settings and enterprise policies may affect these operations.

The journal is written before ordinary export. Failed export retains already-journaled files for retry; in-memory updates not yet acknowledged remain vulnerable to tab/process loss. Local storage is not encryption or a guarantee against device/profile loss. Do not uninstall the extension or clear its profile before verifying exports.

Deleting a stopped session in the library removes its local journal backup. It does not delete the copies already exported to disk or copies sent elsewhere. MeetScribe has no automatic remote deletion service. Granting a custom directory can require reauthorization later; the extension checks current permission and provides a repair action.

## Before sharing

Tell participants what you are collecting and follow applicable meeting rules and organizational policies. Inspect/redact exports before posting a bug report or sending data to another service. Use the [security policy](../../SECURITY.md) for sensitive reports; use synthetic data for public screenshots. The MIT license covers this project's software and documentation, not a requirement to publish your meeting files.
