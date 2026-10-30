# Troubleshooting & FAQ

[Tiếng Việt](../vi/troubleshooting.md) · **English** · [Documentation Index](../README.md)

This guide provides diagnostic solutions for common caption detection, screen capture, storage permissions, and toolbar interface issues.

---

## 1. Caption & Meeting Detection

### Issue: The toolbar displays "Bật phụ đề cuộc họp, kiểm tra vùng caption rồi bắt đầu" and does not record
- **Cause:** Live closed captions are not turned on, or the meeting platform changed its caption DOM container.
- **Solution:**
  1. Ensure native captions are turned on:
     - **Google Meet:** Click the **CC** button on the bottom bar.
     - **Zoom Web:** Click **Captions** / **Show Captions**.
  2. If the platform is showing captions but MeetScribe does not auto-detect them, click **`Vùng caption`** on the toolbar. Hover your mouse over the caption text container, scroll your mouse wheel to expand the selection rectangle to the outer container if necessary, and left-click to lock it in. (Press `Esc` to cancel selection mode).

### Issue: `speaker` is null or a name is missing from text
The current collector always writes `speaker: null`; it does not parse a structured speaker identity. Names visible inside the chosen caption region may remain in `text`. A slightly wider manual region can retain those visible labels, but it will not populate `speaker`; avoid including chat or unrelated controls.

### Issue: Cannot capture meetings running in the Zoom desktop application
- **Cause:** Chrome extensions cannot interact with external desktop software (`zoom.us.app` / `Zoom.exe`).
- **Solution:** Join the meeting through the official **Zoom Web Client** inside Google Chrome (`https://app.zoom.us/wc`).

---

## 2. Screen Share & Presentation Slides

### Issue: Status displays "Chưa lấy được ảnh share" or "Mất vùng share"
- **Cause:** The presenter stopped sharing, the shared window was minimized, or Chrome's tab capture permission prompt was denied.
- **Solution:**
  1. Grant Chrome's tab capture permission when prompted.
  2. When presentation resumes, click **`Vùng share`** on the toolbar and click directly on the presentation rectangle.
  3. **Note:** Your captions continue recording uninterrupted even when slide capture is temporarily lost.

### Issue: Fast slide transitions were missed
- **Explanation:** To protect CPU and disk usage, MeetScribe samples frames every **15 seconds** and imposes a minimum **30-second interval** between automatic saves manual marks can bypass this cooldown but still obey duplicate and budget checks.
- **Solution:** Click **`Đánh dấu`** ("Mark / Bookmark") on the toolbar whenever a presenter transitions to a key slide you want the extension to attempt to capture. A duplicate slide or a reached image budget can still prevent a new image.

---

## 3. Storage, Directories & Export Issues

### Issue: Status reports "Lỗi xuất file · bản dự phòng còn nguyên" (Export error · backup intact)
- **Explanation:** An error occurred while writing files to disk (e.g., cancelled download, full disk, or revoked directory permission). **Already-journaled data remains in the local backup for retry; this does not protect against profile deletion, disk loss or unjournaled updates.**
- **Solution:**
  1. Open the Session Library by clicking the folder icon on the toolbar or navigating to `library.html`.
  2. Locate the affected meeting session.
  3. Click **`Thử xuất lại`** ("Retry export") to resume disk writing, or click **`Tải ZIP cho AI`** / **`Lưu ZIP (Save As...)`** to download the complete session as a portable archive.

### Issue: Custom directory write permission expired after restarting Chrome
- **Explanation:** Chrome may require permission again after a restart or permission change. MeetScribe checks the current grant; persisted handles alone do not guarantee continued write access.
- **Solution:**
  1. In the Session Library (`library.html`), click **`Cấp lại quyền thư mục`** on the session card.
  2. Or open Settings (`settings.html`) with the session parameter and click **`Cấp lại quyền ghi cho thư mục này`**.
  3. Chrome will display a prompt asking you to re-confirm write permissions.

### Issue: Extension context invalidated ("Cứu caption đang chờ")
- **Cause:** The extension was reloaded or updated in `chrome://extensions` while a meeting tab was actively running.
- **Solution:**
  1. Click the emergency rescue button **`Cứu caption đang chờ`** on the toolbar. Chrome will trigger a direct browser download of all pending in-memory captions.
  2. Confirm the rescue file has downloaded.
  3. Reload the meeting tab and start a fresh session.

---

## 4. Floating Toolbar & Appearance

### Issue: Toolbar is off-screen, hidden, or completely transparent
- **Solution:**
  1. Open Chrome Extensions (`chrome://extensions`) and click **Details** under MeetScribe.
  2. Click **Extension options** to open `settings.html`.
  3. Click the **`Đặt lại mặc định`** ("Reset to default") button.
  4. This restores the toolbar to the top-left corner, resets opacity to **96%**, and font size to **14px**.

### Issue: Cannot drag toolbar using mouse
- **Solution:** Use keyboard controls. Press `Tab` repeatedly until the move handle icon (`Di chuyển thanh điều khiển`) is focused, then use the keyboard arrow keys (`Up`, `Down`, `Left`, `Right`) to reposition the toolbar anywhere on your screen.
