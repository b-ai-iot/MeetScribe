# Codex supervisor review — Task 1 (must fix before completion)
Independent reviewer verified four functional defects. Fix with regressions, keep executing all tasks.
1. overlay.css fixed px for title/hint/tools/metrics/compact means font setting changes primary button only. Scale text relative to selected size and verify computed styles at 12/18.
2. content.applyVisualSettings only applies position object: reset to null must immediately restore default coordinates (24px,100px) then clamp.
3. settings.mjs saveSettings and content position/collapse saves read-modify-write whole object; simultaneous unrelated updates overwrite each other. Serialize mutations centrally in service worker (all contexts) or use independent per-setting storage keys; no cross-context lost update. Reproduce opacity70 concurrent collapsedtrue and assert both persist.
4. settings.css .dest-details display:flex overrides hidden. Add explicit [hidden]{display:none!important} and browser test Downloads hides custom controls.
Also remove implementation jargon 'File System Access API' from settings product copy; describe folder selection plainly.

## Task 2 incremental review — must fix
- Current exportSession reads store.getDirectoryHandle() default on EVERY export; session pins only customDirectory mode/name. Choosing a new folder reroutes the running/old session. Persist immutable destinationId and retain a handle record per folder; session captures destinationId at Start; exports/retries use that id. Test session A -> choose folder B -> next session B, while A retry still writes A. Never replace old handle when choosing a new one.
- requestCustomDirectory currently overwrites then deletes fixed `.meetscribe-verify`; this could delete a user's existing file. Use a cryptographically unique temporary name and remove only the file this operation created.
- Need explicit reauthorize-existing-folder action from settings click, not just selecting another folder. Handle retrieval must not consume transient activation before requestPermission; preload handle before button click if needed.
- Existing new unit tests use mocks only and do not yet assert canceled picker or pending-state preservation. Add integration coverage with real browser directory handles; label OPFS-based coverage as such, never as real OS-picker verification.

## Task 2 independent re-review — remaining important issues
- settings.js only preloads active folder B for reauthorization. Older session A pinned to A has no UI way to reauthorize A after choosing B. Add per-session repair/reauthorize action opening an extension page with destinationId, preloading that precise handle before the user click. Do not change global active destination when reauthorizing old A.
- Start permits customDirectory with no stored handle/id; session pins null, and store.getDirectoryHandle(null) resolves active default during later retry, allowing reroute to B. Prevent starting custom session until a directory is chosen, or preserve explicit unconfigured/error destination without fallback to future active. Add real production-path integration tests, not only manually authored objects.
- exportFileToDirectory calls markExported with lastDownloadId string 'fs-handle'; show-folder unconditionally calls chrome.downloads.show expecting numeric id. Show appropriate custom-directory feedback/action instead of broken Open folder. Toolbar/library status must describe custom destination, not claim Downloads.

## Task 3 early archive review
- buildSessionArchive must strip exact `session.folder + '/'` prefix, not a regex removing any first three path segments. Validate *relative entry path segments* after stripping, rejecting '.'/'..' components/backslashes/absolute paths, not any rawPath containing '..' (valid meeting title 'Sprint... review' must export). Test legacy/custom folder paths, unicode/dots in meeting title and no duplicate/colliding entries.
- Standard ZIP16 entry count/UTF-8 name length and ZIP32 size/offset bounds must throw explanatory errors before wrapping header integers. Add limits tests at function boundary.
- Enforce maxBytes incrementally BEFORE further data decoding/accumulation; estimate serialized/base64 byte totals before loading whole archive when possible. Current check after accumulating all decoded files does not bound memory.
- README-for-AI should tell AI not to invent decisions/owners/dates, explicitly flag interrupted/missing coverage, and refer to raw snapshots+image timestamps.
