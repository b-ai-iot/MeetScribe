# Kết quả giám sát cuối — 2026-10-30

Các phát hiện bên dưới đã được sửa và kiểm tra lại trên bản `cfce221`. Không còn lỗi quan trọng chưa xử lý trong phạm vi rà soát. Codex chạy lại 61 unit test, 22 kiểm tra trình duyệt, smoke test extension và đóng gói; các ca tái hiện caption, ZIP 1 MiB, đọc dữ liệu theo phiên, giới hạn dung lượng và cứu ZIP khi mất quyền đã được kiểm tra độc lập.

Giới hạn còn lại: chưa kiểm tra hộp chọn thư mục ngoài của hệ điều hành hoặc một cuộc họp Meet/Zoom thật. Xem `docs/verification.md`.

## Lịch sử phát hiện và yêu cầu sửa

# Latest remaining checks from Codex supervisor
As of current repair code: root manually re-ran caption repro, 1MiB ZIP, scoped store details and stop-and-ZIP rescue; those now pass. Before final commit, fix these remaining exact items:
- Last Python patch introduced mojibake in store.mjs around line102 (`KÃ­ch...`) and line150 (`KhÃ´ng...`). Restore valid Vietnamese UTF-8; use “Không thể xóa phiên đang ghi hoặc đang lưu.” (no audio recording). Run rg for Ã/Æ/á»/áº/Ä in extension to confirm none.
- store.allSessionFiles currently falls back to unfiltered files.getAll() when scoped range returns empty (and includes an IDBKeyRange-absent test path). Remove production whole-database fallback; empty requested session means [] and must not scan history. Fix test fixtures/adapter instead of product fallback.
- ZIP still calls allSessionFiles without a budget, materializing arbitrarily large session before archive maxBytes guard. Add session-scoped cursor/size-limited reader for export (check text/base64 size before accumulating), pass archive cap from worker, and regression. Preserve allSessionFiles normal scoped semantics.
- package-lock.json root and packages[''] versions still 1.1.0 while package/model/manifest now1.2.0; update consistently.
- Re-run `<temporary-review-path> $PWD` with Node20/NODE_PATH: expect only 3 scoped reads for3 detail requests (not6), and stop-and-ZIP ok:true for explicit downloads with missing custom handle.

---

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

## Task 3 critical integration issue
- background export-zip uses `btoa(String.fromCharCode(...zipBytes))`; actual Chrome worker has no Buffer and spreading >~100KB array throws RangeError. Any ZIP with slide images likely fails. Use bounded chunks or a Blob/object URL from extension/offscreen document; add real unpacked worker test exporting >=1MiB binary archive and extract downloaded zip with Python.
- Do not report archive success when downloads.download only returns an id; await complete/interrupted with timeout and show error/retry. Do not silently fallback to Downloads if requested custom directory handle is missing/denied.
- Current browser-test ZIP has malformed flat names (`part-000001.jsonl`) and duplicated nested finished files due regex prefix stripping. Assert exact expected relative file paths in tests including short legacy session.folder.

## Task 3 blocking failure REPRODUCED in actual extension worker
Independent reviewer called production export-zip from library on a completed 1MiB test session in isolated unpacked extension. It returned `{ok:false,error:'import() is disallowed on ServiceWorkerGlobalScope by the HTML specification...'}`. Chrome module workers prohibit dynamic import. Replace background.js dynamic imports of archive.mjs AND destination.mjs with static imports. Worker Buffer is undefined, so btoa spread issue above remains next blocker. Add a real unpacked extension export-zip test with >=1MiB nontrivially-compressible binary, verify full downloaded ZIP in Python. Existing unit/archive browser calls bypassing worker did NOT test the shipped button path. This must pass before final completion.

Task3 re-review also confirms: Library export buttons never send saveAs/destination, so provide explicit ZIP save choice (system Save As is sufficient for arbitrary ZIP location), progress/failure/retry and true download completion. Session-specific settings repair loads A correctly but customDirSection is hidden if next-session global destination is Downloads; show requested old-session repair section independently of next-session destination.

Codex preserved an executable reproduction: `NODE_PATH=<temporary-review-path> <local-development-path> <temporary-review-path> <temporary-review-path>`. It uses isolated unpacked extension, real store, 1MiB deterministic binary, Vietnamese captions, download completion and Python ZIP validation; currently fails dynamic import. Run after your fixes and ensure PASS. Read this scratch test if useful and add durable product-path coverage to tests/extension-smoke.cjs.

## Task 4 early review: avoid false automatic capture
- captions.js currently treats lone generic aria-live polite/assertive as found, and div[jscontroller][aria-live=polite] as HIGH confidence. These can be meeting status/toast/chat, so never auto-select them without caption-specific semantic evidence; low-confidence candidates must prompt manual selection. Test a sole live status 'You joined meeting' and live region inside an unrecognized chat container: neither may be captured.
- Equal high score disjoint exact-label containers currently return found (first.score>=95 exception); they must be ambiguous until user selects. Nested candidates shouldn't hide a third disjoint equal candidate; group widgets then compare.
- reacquireCaptionContainer currently accepts ambiguous result! Do not bind a guessed ambiguous region during recovery. Test both initial Start and recovery through real collector/browser, not only custom MockElement implementation; handwritten selector parser tests are not proof of browser selectors/visibility.
- Prefer highest-scored OUTER caption widget when child/parent match same caption box so speaker/context aren't lost, and preserve explicit manual selection while visible.

## Task 4 independent browser-confirmed defects — must fix
Reviewer actual Chrome reproduction at `<temporary-caption-review-script>` (run Node20 with repo NODE_PATH):
1. P1 captions.js:203-204 promotes low-confidence ancestor aria-live=polite to outer widget while retaining child's high score. Fixture meeting aria-live containing private Chat + Captions + status auto-selects meeting and persists 'PRIVATE CHAT\nSPEECH\nMIC STATUS'. Never expand beyond caption-specific widget; an unrelated parent is NOT a valid caption region.
2. content.js:58 bind resets last on every replacement; same-text outerHTML rerender + inspect + end persists SAME SPEECH twice sequence1/2. Preserve last across automatic reacquisition, reset only on new session or manual source switch when appropriate.
3. P1 content.js:8,40 has weaker visible predicate than captions detector. opacity:0 old caption remains accepted, new visible caption is ignored; detector picks new but collector inspect claims old available; Stop persists HIDDEN OLD SPEECH and loses NEW FINAL SPEECH. Use the same effective visibility predicate for all automatic validity checks/snapshot/reacquisition/render, including hidden ancestors and opacity. Ensure final snapshot discovers current valid source and recovers before Stop.

## Task 5 library error propagation
Current library.js command() catches worker rejection and returns {ok:false,error}; action button handlers (ZIP/retry/rename/delete/stop) await it without checking ok. Therefore errors are silently swallowed and button wrapper catch never displays them. Preserve throwing command() contract for mutations and catch it at loadAndRender/lazy details boundaries (handle absence of runtime in HTTP test fixture separately without swallowing real failures). Add UI regression: mock worker export-zip response {ok:false,error:'disk failure'} -> click ZIP -> visible error text and enabled retry button, not silent no-op. Same for delete/rename. Add saving/progress/success UI for ZIP, and actual user choice Save As button/option currently still missing.

## Task2 persistence integrity must-fix discovered during final store review
store.mjs currently has mockHandlesMap and catches DataCloneError to store `{isMock:true}` then resolve success using in-memory handle. This is test-only behavior in production and falsely claims persistence: after worker restart, saved destination has no usable handle. Remove mockHandlesMap/isMock fallback entirely; serialization errors must reject atomically and retain prior active directory/settings. Use real OPFS FileSystemDirectoryHandle for browser persistence tests or test-only adapter outside product code. Add regression that DataCloneError rejects and does not replace previous active destination.

## Whole-branch performance/data isolation review (must fix)
store.allSessionFiles(id) currently calls files.getAll() for the ENTIRE historical database then filters by sid. Library session-details invokes it twice per card, eager for every session; ZIP loads every session data before maxBytes checks. Scope IndexedDB reads to the requested session using existing file primary-key prefix IDBKeyRange.bound(id+'/',id+'/\uffff') or a sid index (test old records too). Avoid duplicated all-files reads per details and avoid retrieving every session full images just to list the library. Add real IndexedDB regression proving unrelated session records are not materialized. Apply size guard while reading export files (cursor/metadata), before accumulating unlimited history.

Whole-branch review reproduced both using `<temporary-review-path>` (Node20 + NODE_PATH repo/node_modules): 3 sessions x1MiB, production session-details generated SIX unfiltered files.getAll calls each cloning all 3,146,469 bytes. Also active custom session with unavailable pinned folder + `export-zip {stopFirst:true,destination:'downloads'}` returns missing-folder error AFTER finalization because stop() awaits normal exportSession(). Stop-and-ZIP rescue should finalize/drain durably, retain ordinary exportError/pending, then still build ZIP from journal to explicitly chosen Downloads. Add actual worker regression, keep normal Stop failure reporting honest.
