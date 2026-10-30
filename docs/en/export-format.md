# Export format and AI handoff

[Tiếng Việt](../vi/export-format.md) · [Documentation](../README.md)

This page describes the files produced by version 1.3.0. Examples are illustrative subsets of the fields written by the [journal](../../extension/store.mjs), [capture pipeline](../../extension/offscreen.js) and [archiver](../../extension/archive.mjs).

## Session directory

Downloads and custom-folder exports use the same relative structure. The date/time in the folder name uses the local timezone; metadata timestamps use ISO 8601.

```text
<selected base>/MeetScribe/YYYY-MM-DD/<title>--<HHMMSS>--<short-id>/
  session.json
  captions/part-000001.jsonl
  images/screen-001-1793352300000.png
  images/screen-001-1793352300000.png.json
  events/<epoch-ms>-<short-id>.json
  events/finished.json
  session-final.json
  finished.json
```

Titles retain Unicode, including Vietnamese, while reserved filename characters are sanitized. Session IDs reduce name collisions. Renaming a session in the library changes its display title, not its existing disk path.

## Session metadata

`session.json` is the initial snapshot, including session ID, title, meeting URL, platform, creation time, version and destination. `session-final.json` is the finalization snapshot, with status, end time, counts and interruption reason. Fields related to export progress in these snapshots are not a live confirmation of later disk writes.

## Caption JSONL

Each line of `captions/part-*.jsonl` is one observed DOM snapshot:

```json
{"sequence":1,"timestamp":"2026-10-30T09:15:42.500Z","text":"Lan: Chúng ta sẽ kiểm tra bản thử nghiệm.","speaker":null}
```

The current collector always writes `speaker: null`; names visible in the selected region can remain inside `text`. There are no separate `id` or `raw` fields in this caption record. `sequence` orders updates within the session. `timestamp` is observation time, not the original audio time. A new part is normally journaled after 10 seconds or 100 buffered updates; size guards can split batches sooner.

Read parts in numeric order. Consecutive snapshots can overlap, repeat or revise earlier text. Do not treat every snapshot as a new utterance or concatenate it into a verbatim transcript without review.

## Images and sidecars

Images are saved PNG crops of the selected share region. Filenames contain a sequence and numeric epoch timestamp. The JSON sidecar stores capture evidence; an illustrative subset is:

```json
{
  "capturedAt":"2026-10-30T09:25:00.000Z",
  "rect":{"x":0.25,"y":0.15,"w":0.65,"h":0.6,"key":"DIV:960:540","confirmedBy":"user-selection"},
  "captionAt":"2026-10-30T09:24:58.000Z",
  "captionContext":"Lan: Đây là nội dung minh họa.",
  "importantBy":"user-mark",
  "image":"images/screen-001-1793352300000.png",
  "bytes":42318
}
```

`rect` coordinates are fractions of the captured tab viewport (`x`, `y`, `w`, `h`), not pixel coordinates. Zoom iframe geometry is translated before cropping. `importantBy` can be `null`, `user-mark` or `persistent-local-change`; comparison `metrics` may also be present. Nearby caption context is observational, not guaranteed audio/image alignment. Reused slides and sampling gaps can be recorded as events instead of new images.

## Events and finalization

Operational events are JSON objects with `timestamp`, `type` and event-specific fields directly on the object. For example, a user bookmark has `captionAt` and `captionContext`:

```json
{"timestamp":"2026-10-30T09:25:00.000Z","type":"user-mark","captionAt":"2026-10-30T09:24:58.000Z","captionContext":"Lan: Đây là nội dung minh họa."}
```

`finished.json` is journaled atomically with final metadata, before ordinary export attempts:

```json
{"id":"demo-session","endedAt":"2026-10-30T09:30:00.000Z","reason":"user-stop","status":"completed","captionUpdates":18,"images":2,"reportStatus":"awaiting-user-request"}
```

This marker means the local session was finalized. It does **not** prove every disk export succeeded. Ordinary export tries to write this marker last; inspect the library's pending/error state and actual files. `interrupted` sessions may contain gaps. Backups remain available until explicitly deleted or browser storage is removed.

## Portable ZIP

A stopped-session ZIP includes all journal files, both exported and pending, with paths relative to the session folder. It adds:

| File | Meaning |
| --- | --- |
| `transcript.md` | Timestamped `text` snapshots for reading; no automatic speaker separation or deduplication |
| `README-for-AI.md` | Instructions and a prompt asking an external model to ground conclusions, avoid invented owners/dates and identify gaps |
| `manifest.json` | Format/session metadata and a list of entry paths and byte counts; it does not list itself |

The archive manifest does **not** contain SHA-256 hashes. Standard ZIP entries contain CRC-32 checksums, which are not cryptographic authentication. A 500 MiB guard limits input/derived payload bytes before packaging; this is not a guarantee of peak memory use or an exact compressed ZIP size. Image budgets are 30/hour, 120/session and 100 MiB/session. Automatic sampling runs every 15 seconds, normally with 30 seconds between saved images; manual marks can bypass that cooldown but still respect duplicate and budget checks.

Choose the session destination, Downloads or Save As in the library. A pending ordinary export need not be successful before a ZIP can be recovered to Downloads. Errors retain the local journal for retry. See [troubleshooting](troubleshooting.md).

## Hand off to AI

The extension does not call an AI service. Export the ZIP, read `README-for-AI.md`, and deliberately provide the files to your chosen tool. Check that tool's upload support and privacy terms. Review output against raw captions, timestamps, slide sidecars and interruption status. Do not assume the generated minutes are complete or correct. Sharing exported data is your decision and remains separate from publishing this project's source code.
