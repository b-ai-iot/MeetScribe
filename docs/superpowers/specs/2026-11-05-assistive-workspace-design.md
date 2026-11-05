# MeetScribe — Emerald & Pearl UI proposal

Status: approved by the user on 2026-11-05.
Date: 2026-11-05

## Intent

The user wants a more attractive, polished interface: a compact floating control on Google Meet similar to iPhone AssistiveTouch, a designed icon, and more distinctive management/settings screens. The current 344px persistent dark panel obscures meeting content; management pages share similar dark surfaces and weak action hierarchy.

## Approaches

1. **Floating button plus attached popover (recommended):** a draggable button with compact meeting controls revealed on demand. This matches the user's AssistiveTouch reference. Requires careful positioning, drag/click discrimination, keyboard handling and visible recording/error states.
2. **Narrow floating status bar:** more information is always visible, but covers more of the meeting and resembles a toolbar rather than the requested floating control.
3. **Retain the persistent panel and restyle it:** smallest implementation change, but keeps the space problem.

Selected approach: 1, with the proposed pearl/emerald palette, approved by the user.

## Visual direction

Use warm pearl backgrounds (#F6F7F0), white content surfaces, deep evergreen text (#163C36), emerald primary actions (#176D59) and restrained mint accents (#9DF4D3). Distinct warning/error colors retain text/icon meaning. Normal text requires 4.5:1 contrast; functional icon/control boundaries require 3:1. The mockup illustrates hierarchy; production values must be measured and adjusted where needed.

Use the system UI font stack already available locally, with stronger type hierarchy, consistent 4/8px spacing, 14–16px page text, 44px minimum control targets and 160–220ms transitions. Motion respects reduced-motion preferences. Glass/translucency is reserved for the meeting controls; content cards use solid surfaces. No runtime font/CDN/network dependencies.

## Identity

Create an original speech-bubble mark containing three vertical caption strokes. Use it in the floating button, extension action, page navigation and documentation. Export crisp 16/32/48/128 PNG icons plus an SVG source. Keep functional icons consistent in stroke, size and accessible labels. Decorative icons are hidden from assistive technology. Avoid emoji or font glyphs as production icons.

## Floating control

- Approximately 56–60px rounded floating button, visually quiet over the meeting; default near the right edge above the meeting controls. Save the position.
- Click/Enter/Space toggles an attached nonmodal control panel. Escape collapses it and restores focus to the button. Closing the panel never stops recording.
- The button remains visible while the panel is open. Recording has a visible state label/timer as well as a colored indicator; error uses an icon/label as well as color. Accessible name includes state. No infinite pulsing.
- Drag using pointer capture with a movement threshold; ending a drag must not trigger a click. Support arrow-key movement and a pointer-accessible reposition/reset alternative. Clamp both button and panel to the viewport on resize; choose the panel's opening side according to available room.
- Panel shows title, recording status/time, Start or Stop and save, caption-region selection, shared-region selection, mark, library/settings, counts/export state and recovery actions. Preserve all existing operations and errors; errors must remain discoverable when compact.
- Fresh preferences default to compact; preserve explicitly stored collapsed/position preferences. Existing opacity and font settings continue to work. Opacity controls the surface, never the text. Preserve useful contrast on both bright slides and dark meeting backgrounds.
- Active caption capture, final drain, frame routing and journaling retain their existing behavior. No automatic meeting-tab reloads.

## Library

Create a responsive workspace shell with brand/sidebar navigation and a compact top summary. Use a clear library heading rather than a large marketing hero. Search stays visible; list meeting cards with title/date, captured counts, export status, preview and a clear primary ZIP action. Retain Save As, output destination, retry, rename, folder opening and confirmed deletion. Secondary actions may be grouped, but keyboard users must reach them. Data and native error strings remain literal. Empty/loading/error states receive the same visual treatment. Never invent summary metrics or meeting content.

## Settings

Use the same workspace shell. Group language, floating-control appearance, destination and session permission repair into clearly labelled cards. Put a visual appearance preview beside controls on desktop, stacked on narrow screens. Keep existing VI/EN live language, opacity/font preferences, directory permissions and session-pinned destination semantics. A visible save/reset action row should not obscure controls or keyboard focus. Show pending/success/error feedback clearly. The preview must accurately reflect the floating control's implemented appearance.

## Constraints and scope

Keep the existing vanilla HTML/CSS/JS extension architecture, MIT licensing, zero runtime dependencies and local-only operation. Support English and Vietnamese across all new labels, tooltips and states. No transcription/AI services or new meeting permissions. Preserve every current capture/export/storage feature. This redesign does not add unrelated meeting functionality.

## Delivery and verification

Implement in an isolated feature branch, then independent review and protected PR. Run unit, browser, real unpacked synthetic Meet/Zoom and VI/EN suites; add behavior coverage for dragging versus clicking, compact/open transitions, keyboard focus/Escape, viewport edges, stored preferences, recording/error visibility and capture across menu toggles. Verify 375/390, 768, 1440px and short meeting viewports, including long VI/EN labels. Check contrast, screenshot the actual implementation, refresh bilingual docs/screenshots, and use the existing validated release pipeline for the final version.

## References

- Apple AssistiveTouch: https://support.apple.com/en-ie/111794
- Apple materials: https://developer.apple.com/design/human-interface-guidelines/materials
- UI/UX Pro Max local guidance: use the verified productivity palette and accessibility/dragging guidance; discard its marketing-page patterns and fashion typography because those do not fit this workspace.

## Preview

See [concept PNG](2026-11-05-ui-concept.png) and [SVG](2026-11-05-ui-concept.svg) in this directory. These are static design mockups using synthetic meeting data, not screenshots of a completed implementation. Small glyph placeholders in the mockup will be replaced with the production SVG icon set. The collapsed button's final state label/timer and all existing recovery controls must be included even where the compact mockup omits them.
