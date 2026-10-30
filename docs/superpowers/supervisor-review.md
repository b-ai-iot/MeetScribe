# Codex supervisor review — Task 1 (must fix before completion)
Independent reviewer verified four functional defects. Fix with regressions, keep executing all tasks.
1. overlay.css fixed px for title/hint/tools/metrics/compact means font setting changes primary button only. Scale text relative to selected size and verify computed styles at 12/18.
2. content.applyVisualSettings only applies position object: reset to null must immediately restore default coordinates (24px,100px) then clamp.
3. settings.mjs saveSettings and content position/collapse saves read-modify-write whole object; simultaneous unrelated updates overwrite each other. Serialize mutations centrally in service worker (all contexts) or use independent per-setting storage keys; no cross-context lost update. Reproduce opacity70 concurrent collapsedtrue and assert both persist.
4. settings.css .dest-details display:flex overrides hidden. Add explicit [hidden]{display:none!important} and browser test Downloads hides custom controls.
Also remove implementation jargon 'File System Access API' from settings product copy; describe folder selection plainly.
