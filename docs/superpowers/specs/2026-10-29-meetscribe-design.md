# MeetScribe — approved implementation direction

User authorized implementation on 2026-10-29 after choosing the compact floating toolbar on Meet. Independent new project; never modify, replace or migrate Local Collector 0.1.2.

## Product
Chrome MV3 extension, Vietnamese UI, Google Meet first. A draggable dark glass toolbar contains Start/Stop, caption region, shared-content region, important mark and library. Collapse to a small status pill. Status distinguishes waiting, locally backed up, exported, missing captions, missing share permission, interruptions and errors. Accessible 44px buttons, visible keyboard focus, movement buttons/keyboard alternative and reduced motion. UI UX Pro Max search verified glassmorphism; marketing-page pattern from first search rejected. System fonts keep it offline.

## Data and lifecycle
Default download path: MeetScribe/YYYY-MM-DD/sanitized meeting name--HHmmss--random suffix/. Paths use local date and safe components. Browser configured download root applies; no arbitrary filesystem writes. IndexedDB commits are the caption acknowledgement boundary. Immutable JSONL caption parts and events + PNG images export using chrome.downloads, saveAs false; no append API assumed. Export state changes only after Chrome reports complete. Interrupted downloads remain retryable from Library. Stop drains pending captions, finishes images, writes session/end metadata and waits for exports; a failed export stays visibly retryable. Keep local backup until explicitly cleared (not implemented in first release). No automatic model, network, audio or video-file recording.

Content MutationObserver coalesces caption updates, preserves revisions/speakers as raw text with timestamps and sequence numbers. Batches capped100; retry idempotent after durable commit. Limits on pending text prevent unbounded memory. Lost extension context must not throw uncaught errors: stop observing, expose interruption and offer local pending-text rescue. Reload/navigation creates a visible interruption, never claims continuity.

Offscreen document holds optional tab video only for selected shared region. Validate current connected visible element and viewport crop. Sample15s, cooldown30s, dHash + RGB/tile change; 120 images/session,30/hour,100MiB; preserve small stable edits and reuse duplicate slide references. Region selection is explicit; no camera inferred as share. Cropping avoids unrelated tab content. Stop cancels sampler and waits for in-flight image work. Auto end: two visible exact end messages and no leave control; silence insufficient. Tab close recorded as interruption.

## Architecture
extension/background.js: authority, sender checks, serialized session commands, export retries, alarms.
extension/store.mjs: atomic IndexedDB session + outbox journal and idempotent captions.
extension/model.mjs: safe paths, validation, supported URLs.
extension/content.js + overlay.css: DOM collector, picker, isolated Shadow DOM toolbar and lifecycle.
extension/offscreen.js: stream, ROI, local image comparison, Blob encoding.
extension/library.html/js/css: recovery/export status. No popup required.

## Alternatives
Floating toolbar selected by user; side panel rejected for space cost. Directory picker rejected for requested default Downloads UX. Downloading each DOM mutation rejected: journal locally first and batch exports. No external frameworks or runtime dependencies required.

## Validation
Node unit tests for paths/validation; real browser IndexedDB tests for durable ack/idempotence/retry; DOM fixtures for overlay, invalid context, scrolling/replaced regions, queues, stop, end recognition; isolated Chrome extension smoke where allowed; visual captures at desktop and narrow widths. Actual live Meet permissions need user trial; never claim live capture from mocks.
