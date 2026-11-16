# Microsoft Teams web

[Tiếng Việt](../vi/teams.md) · [Usage guide](usage.md)

MeetScribe 1.6.0 adds Teams web support in desktop Chrome. It reads the captions displayed by Teams; enable them before recording. It does not start Teams recording, capture audio, call Microsoft Graph or bypass tenant policies.

## Start a meeting capture

1. Open Teams at `https://teams.microsoft.com`, `https://teams.cloud.microsoft` or `https://teams.live.com` in Chrome, then join the meeting using the browser.
2. In the meeting controls, open **More → Language and speech → Show live captions**, or **Turn on live captions**. Labels vary by Teams version and language. Select the spoken language in Teams.
3. Click the pinned MeetScribe extension icon, expand the floating capsule, then choose **Start recording**.
4. MeetScribe looks for the complete Teams caption renderer. If no caption widget is found, use **Caption region** and select the visible caption area. Include the speaker name when available; avoid chat and participant panels.
5. If presentation images are needed, choose **Share region** and select the slide area. Use **Mark** for important moments. Images are sampled and deduplicated, so fast slides can be missed.
6. Choose **Stop and save**, check the session in **Library**, then download a ZIP. The session metadata records `platform: "teams"`; caption text and observed timestamps retain the existing format.

## Scope and limitations

- Supported entry hosts are exactly the three listed above. Lookalike domains, sign-in pages and custom embedded host domains are rejected. Government-specific hosts are outside this release's scope.
- Use the meeting and captions in the same browser tab. Teams desktop, mobile, separate caption pop-out windows and deeply nested or unmeasurable share frames are not supported. An unmappable frame reports a warning rather than capturing the wrong area; captions can continue.
- Your organization or meeting organizer may restrict captions or copying. Follow their policy; if captions are unavailable or not rendered, MeetScribe cannot collect them. It has no policy-bypass mechanism.
- DOM hooks are internal Teams UI details and may change. Automatic recognition uses `data-tid="closed-caption-renderer-wrapper"` and `data-tid="closed-caption-renderer"`. The manual picker is the fallback.
- Automated checks use synthetic Teams-shaped DOM at official URLs in a disposable browser profile. They verify real extension messaging, storage, Downloads, ZIP, VI/EN, widget replacement and frame geometry. The disposable extension copy grants fixture hosts and installs through the test harness; the shipped action/activeTab grant and live screen stream still need manual validation. These checks do not prove compatibility with every live tenant/version. Validate a short permitted meeting before relying on the capture.

## References

[Microsoft live-caption instructions](https://support.microsoft.com/en-us/teams/meetings/use-live-captions-in-microsoft-teams-meetings) · [Teams for Web prerequisites](https://learn.microsoft.com/en-us/microsoftteams/teams-client-web).

DOM evidence consulted on 2026-11-16: the upstream [Teams caption-capture source](https://github.com/royyandzakiy/msteams-live-caption-capture/blob/main/capture.js) uses the renderer-wrapper and caption-text data hooks. MeetScribe retains its own snapshot/observer/export implementation; no third-party capture algorithm was copied.
