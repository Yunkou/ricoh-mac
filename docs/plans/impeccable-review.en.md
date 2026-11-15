# Impeccable full-app design review

Subject: ricoh-mac, HEAD `b8de02857326e74f8cf30f3ff7662fa2ab77fc60` (`b8de028`). Date: 16 November 2026, 00:15 Asia/Shanghai (UTC+8). This was a review, not a redesign. This record does not change implementation code.

⚠️ DEGRADED: single-context (no sub-agent tool was exposed in this executor session to isolate Assessment A from B). No browser, CDP, or visual overlay: this session has no desktop driver, and Shell was not allowed to launch or drive a GUI. The official detector ran a regex-only scan of `ui/` and stated that this is not a clean bill of health.

Questions skipped: this run was completed by an executor subagent with no AskUserQuestion channel, so the user could not be asked to choose a priority, tone, or fix scope. Those decisions belong to the person reading this record.

## Follow-up (16 November 2026)

The user later asked for the confirmed, source- or documentation-checkable findings in this record to be fixed. The “Fix status” notes under each finding describe that follow-up. Headless behavior tests were added for the fixable items, and the bilingual product and design documents were aligned. A real window was still not launched or driven, and no screenshots were taken. Contrast, frosted glass, and real layout must not be described as having passed.

## Scope and method

The review covers the home screen, device connection and import, the local album (DNG load / failure / filtering), the detail page (photographer information, RAW source switching, histogram, navigation, culling), settings, empty / loading / error states, keyboard / focus / accessibility, narrow-window layout, and whether the fixed dark theme, warm-amber accent, bundled ChillDINGothic, multi-tone Kubai icons, frosted glass, and photographic wording still match the committed constraints. Extra checks: whether RAW “1:1 / actual size” reads as original pixels, high-density album stars, navigation after a filter would have hidden the current photograph, and error plus persistence feedback.

The official Impeccable `critique` and `audit` methods were followed by reading source, existing headless `nsh test` behavior, and the official detector’s source scan of `ui/`. The native window was not launched or driven, no screenshots were taken, and nothing here is claimed as a visual inspection. NSH’s public help has no offscreen snapshot or render command. `nsh test` is a headless behavior runner, not native-window acceptance. `nsh test --target macos`, `nsh run`, and `nsh dev` would open a real window and were not used.

## Official skill acquisition

The project `.gitignore` already excludes `.cursor/` and `.grok/`, and says to reinstall locally with `npx impeccable install` and not to commit those files. Those directories were absent at the start of this review.

- Official package: npm `impeccable` **4.9.1**, homepage https://impeccable.style, repository https://github.com/pbakaus/impeccable, license Apache-2.0.
- Public help checked: `npx impeccable --help`, `install --help`, `impeccable help`, plus https://impeccable.style/tutorials/getting-started, https://impeccable.style/docs, https://impeccable.style/docs/audit, and https://impeccable.style/docs/critique.
- Official non-interactive install into the already-ignored project directories (no system fonts, no `--scope=global`):
  - `npx impeccable install -y --providers=cursor --scope=project`
  - `npx impeccable install -y --providers=grok --scope=project`
- Result: skills **v4.9.1**; engine **v0.1.24** (darwin-arm64) under `.cursor/skills/impeccable/` and `.grok/skills/impeccable/`. Hooks were written into those ignored directories. None of those files were added to the repository.
- Actually read (Grok Build copy; the Cursor tree has the same filenames): `.grok/skills/impeccable/SKILL.md`, `reference/routing.md`, `reference/audit.md`, `reference/critique.md` (including Assessment A/B, report structure, heuristic scoring, cognitive load, and personas), and `reference/operate.md`.
- Per SKILL step 1, `.grok/skills/impeccable/scripts/impeccable context --target .` was run and loaded the already-tracked `PRODUCT.md` and `DESIGN.md`. Official warning: `PRODUCT.md`’s `## Platform` value `macos` is not one of `web` / `ios` / `android` / `adaptive`, so the project was **treated as web**. `PRODUCT.md` also states that this is a native macOS NSH app and that iOS/Android native audit guidance is not a literal checklist. This review treated the UI as TSX that can be regex-scanned, but not as a CDP-attachable Chromium desktop app and not as iOS or Android.
- Per SKILL, `reference/craft-floor.md` was not loaded: this was review-only, with no UI edits, and that file is required immediately before UI edits, not for planning-only work. `init`, `document`, `polish`, and `live` were not run. The official snapshot was not written to `.impeccable/critique/`, so runtime artifacts would not be committed. This record is the in-repo archive of the review.
- Detector: `.grok/skills/impeccable/scripts/impeccable detect ui/`. It scanned 42 `.ts` / `.tsx` files with regex matching only and reported **0 primary findings** (exit 0). It also stated that rules which need a parsed page (tiny-text, low-contrast, and other element rules) did not run, and that “findings are an undercount, not a clean bill of health.” No `--cdp` or URL scan of a running app was performed.

## Verified and unverified boundaries

Confirmed in source and in existing headless tests (`make test` at `b8de028` was 129 passed; the long suite was not rerun for this documentation-only change): distinct connection and import states, album DNG embedded previews and failure placeholders, detail-page RAW develop / failure fallback / source and histogram labels, the data structure that keeps the current photograph under a filter, failed mark saves not shown as success, and keyboard navigation plus culling shortcuts.

Not done, and therefore not passed: a real macOS window inspection, measured contrast and vibrancy, focus-ring visibility on glass, actual overflow at narrow widths, pointer or touch miss-taps on 18 px stars, whether Apple’s develop and the “1:1” view look like original 100%, and visual checks of color and orientation. Headless `nsh test` appears unable to accept further clicks while `developRawPreview` is still in flight, so “stale RAW results must not replace a later photograph” is covered by the details-token unit test, not by a live window interaction.

## Overall judgment

This is an Operate surface with a clear product stance: photographs lead, the appearance is fixed dark, there is no product-name header and no persistent sidebar, warm amber is reserved for the primary action, selection, and focus, and the copy mostly speaks a photographer’s language. Source and headless tests support that the main tasks can be completed. The official regex scan found no countable anti-patterns. That is **not** a full-app pass, and it is not a visual acceptance. Contrast, frosted glass, narrow layout, and whether “1:1” misleads still have to be seen in a real window before they can be closed.

`PRODUCT.md` and `DESIGN.md` still describe sensor-level RAW preview as a later milestone, and they describe detail “1:1” as original-pixel viewing. That no longer matches HEAD, which already develops RAW and downsamples the display raster. Those two files were not edited in this review.

## Scores (provisional, without a rendered check)

Heuristics are scored 0–4 per the official guide. All ten can apply on an Operate surface. Most scored 3 because the behavior is largely clear, while confirmed wording or target-size issues remain and visual items were not checked. “Looks reasonable in source” is not a 4.

| # | Heuristic | Score | Key point |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 3 | Connection, import, and RAW loading or fallback are labeled; a successful mark save has almost no separate confirmation. |
| 2 | Match between system and real world | 2 | Photographic terms are mostly accurate, but “1:1” describes a downsampled or embedded raster as original scale. |
| 3 | User control and freedom | 3 | Back, Esc, the All filter, and RAW / embedded switching exist; marks have no separate undo, and deleting a camera profile has no confirmation. |
| 4 | Consistency and standards | 3 | Tokens and components are fairly consistent; product context files lag HEAD. |
| 5 | Error prevention | 3 | Originals are read-only and import conflicts do not overwrite; profile deletion is one click. |
| 6 | Recognition rather than recall | 3 | Shortcut hints and source labels exist; a kept-but-unmatched filtered photo is not distinguished. |
| 7 | Flexibility and efficiency | 3 | Culling and navigation shortcuts are in place; real-window pacing was not checked. |
| 8 | Aesthetic and minimalist design | unscored | Source matches the committed constraints, but aesthetics cannot be judged from source alone. |
| 9 | Error recovery | 3 | RAW fallback, failed-mark notices, and import continuation exist; some errors still surface raw exception text. |
| 10 | Help and documentation | 3 | The detail page has a short hint and a full shortcut list; “1:1” is under-explained. |
| **Total** | | **26/36** | Heuristic 8 was left unscored, so the maximum is nine items. Against official bands this is roughly Acceptable to Good. |

The official five audit dimensions also do not amount to a rendered pass: accessibility about 2 (contrast unmeasured, compact stars at 18 px); performance and theming about 3 (no frame-rate measurement); responsive design about 2 (narrow windows unseen, compact targets undersized); implementation integrity about 2 (regex found nothing but said it undercounts, and the “1:1” plus stale context remain). No /20 total is given, so this cannot be mistaken for a complete audit score.

## Findings

### P1 · “1:1” presents the display raster as original scale

- **Location:** `ui/copy.ts` (`actualSize`: “1:1”, `shortcutFit`: “适应窗口或 1:1”); `ui/components/photo-detail.tsx`, where `previewStyle(true, naturalSize())` uses the `Image` `onLoad` size divided by `pixelRatio()`; `ui/components/photo-info.tsx`, where “尺寸” prefers Exif / DNG photograph pixels (`details.width/height`). `DESIGN.md` records this mode as “actual size (1:1)”.
- **Impact:** On a RAW develop or a DNG embedded preview, the user can believe they are inspecting the photograph at 100% pixel scale. RAW develop is capped at a long edge of 4096, and an embedded preview is usually smaller. The information panel may still show 6000×4000, which disagrees with the “1:1” view. That conflicts with the rule that a display raster must not be presented as original pixels or as an upgraded embedded preview.
- **Minimal fix:** Rename the control and shortcut to “display pixels” or “display size”, and say when the image is not photograph pixels. Do not use the same “1:1” label for a true original JPEG path and a downsampled raster. The panel can show both photograph size and current display size.
- **Verification:** Confirmed in source. In a real window, open the same GR IIIx DNG and compare the panel size, fit-to-window, and the so-called “1:1” pixel size, and see whether the wording still misleads.
- **Boundary:** Not seen in a real window. On-screen CSS pixels were not measured against 4096 or 6000.
- **Fix status:** Copy and the information panel have been corrected. An original JPEG in display-pixel mode is labeled 原片 1:1; a RAW develop or an embedded preview is labeled 显示尺寸. When the two sizes differ, the panel lists 照片尺寸 and 显示尺寸（RAW 显影 / 嵌入预览） separately. The shortcut now reads “适应窗口或显示像素”. Headless tests cover the control labels and the 6000×4000 versus 4096×2731 distinction. A real window is still required: open the same GR IIIx DNG and check whether “显示尺寸” can still be read as original 100%.

### P1 · Compact album stars are smaller than 24 CSS px and have no gap

- **Location:** `ui/components/cull-controls.tsx`, `variant="compact"`: star controls are 18×18 with `gap: 0` and 12 px type. Detail-page stars are 28 px.
- **Impact:** This is below the WCAG 2.5.8 minimum of 24 CSS px unless an exception applies. Adjacent hit areas overlap, so a neighboring rating is easy to hit by mistake in the grid. This is a pointer-first Mac app, not a touch-first one, but culling accuracy is still at risk.
- **Minimal fix:** Make compact stars at least 24×24 and keep neighboring 24 px circles from intersecting, or keep the glyph and enlarge the invisible hit target. Do not shrink the 28 px detail controls.
- **Verification:** Sizes are confirmed in source. In a real window, use a pointer (and touch if relevant) on adjacent stars, and check whether focus rings overlap or become hard to see.
- **Boundary:** No pointer or touch trial was done. How far WCAG 2.5.8 should bind pointer-only desktop controls can be decided during visual acceptance.
- **Fix status:** Compact star hit targets are now 24×24 with a 4 CSS px gap. Detail-page stars remain 28 px. The album caption row grew from 54 to 72 so wrapped flag controls still fit; the minimum cell width was not increased. Headless tests lock the hit size and the caption budget. Miss-clicks and focus rings still need a pointer check in a real window.

### P2 · A filter keeps the current photograph, but does not mark it as outside the filter

- **Location:** `filterAlbumPhotos(..., keepId)` in `ui/state/cull.ts`; `setAlbumFilter` / `refreshVisiblePhotos` in `ui/state/app-model.ts`; covered by `ui/state/cull.test.ts`. The album heading may still show a “n / total” count.
- **Impact:** This prevents the detail page or focus from going blank after a filter, and is not a blocking defect. The unmatched photograph remains in the visible list and in previous / next order with no label, so it can look as if it matches, or as if the count is wrong.
- **Minimal fix:** Label the kept, unmatched cell or detail page, or offer a “show only matches” action that drops the keep. After the user moves to another photograph, apply the filter strictly so the keep does not linger.
- **Verification:** Unit tests confirm the keep. Headless UI tests cover hiding other photographs and the empty state after a flag is cleared. A real window should be used to change the filter mid-detail and then press previous / next, and to see whether the kept item is recognizable.
- **Boundary:** The look of a kept item was not seen, and no headless test covers changing the filter on the detail page and then moving to another photograph.
- **Fix status:** A kept, unmatched photograph is now labeled 不符合当前筛选 in the grid and on the detail page. The album count includes only matching photographs. Previous and next move only among matches, and the index no longer treats the kept item as part of the filtered order. After the user leaves that photograph, the keep is dropped. Headless tests cover the label, the count, navigation, and the strict filter after leaving. The detail page still has no filter bar, so “change the filter mid-detail” still needs a real window, and would need a visual check if a filter control is later added there.

### P2 · Deleting a saved camera profile has no confirmation

- **Location:** `ui/components/settings-panel.tsx`, `delete-profile`, which calls `model.removeProfile()` directly.
- **Impact:** One click removes the saved network profile and the Keychain password. The user can save again, but must re-enter the password. This misses the error-prevention heuristic for destructive actions.
- **Minimal fix:** Add a confirmation that the stored password will be removed, or move deletion away from Save and require an explicit action.
- **Verification:** Confirmed in source that there is no confirmation. Check wording and mis-click risk in the real settings panel. Do not experiment with the user’s real Keychain.
- **Boundary:** The real settings window was not clicked.
- **Fix status:** Deletion now requires confirmation. The first press of 删除 does not remove the profile. The confirmation states that the password stored in the Keychain will also be removed. Cancel returns to the delete control. Headless tests cover confirm-to-delete and cancel-without-deleting. Wording, mis-click risk, and focus order still need a look in the real settings panel. Do not experiment with the user’s real Keychain.

### P2 · A failed mark save is reported; a successful save is mostly just the control updating

- **Location:** `writeMarks` in `ui/state/app-model.ts`: `applyLocalMarks` runs only after success; failure sets `notice` to “无法保存标记。” plus the error string. A later success clears a previous failure notice. `ui/App.test.tsx` covers “a failed save is not shown as success.”
- **Impact:** Failure is visible, which is correct. Success has no separate confirmation and no in-progress state. If a write is slow or the user presses repeatedly, they may retry or be unsure whether the sidecar was written.
- **Minimal fix:** Add a short in-control pending or saved state. Keep the existing notice for failures. Do not add a persistent success bar for every star press.
- **Verification:** Headless tests cover the failure path. In a real window, check that the notice is obvious in the album and on the detail page, and what the control does during a slow save.
- **Boundary:** Real sidecar write latency and notice contrast on vibrancy were not measured.
- **Fix status:** Star and flag saves now show 正在保存… while the write is in flight and 已保存 after success. Failures still use only the existing notice. There is no persistent success bar on every star press. Headless tests cover in-progress, success, and failure. A real window is still needed to judge whether the notice is obvious, and how the control feels during a slow save.

### P2 · `PRODUCT.md` and `DESIGN.md` lag the shipped RAW detail preview

- **Location:** Root `PRODUCT.md` still places sensor-level RAW in a later milestone; `DESIGN.md` describes detail “1:1” as original-pixel viewing and does not mention the long-edge-4096 display raster.
- **Impact:** This does not block culling, but later design work or Impeccable commands can follow stale facts, and it reinforces the “1:1” misunderstanding.
- **Minimal fix:** In a separate documentation change, align these files with the requirements and tech stack: two preview sources, the downsample policy, and that “1:1” currently means display-image pixels.
- **Verification:** Compare the two files with HEAD and `docs/tech-stack.*.md`. They were left unchanged in this review, as authorized.
- **Boundary:** Documentation consistency only.
- **Fix status:** Fixed. `PRODUCT.md` and `PRODUCT.zh-CN.md` now record the RAW detail preview as a confirmed Milestone 4 capability, not a later plan, and they describe the display raster, the long-edge cap of 4096, and the distinction between 原片 1:1 and 显示尺寸. `DESIGN.md` and `DESIGN.zh-CN.md` were aligned. At the time of this follow-up, `docs/requirements.*`, `docs/tech-stack.*`, and `docs/plans/next-features.*` already matched the current implementation and were left unchanged.

### P2 · The detail toolbar and the filter bar may get tight in a narrow window

- **Location:** The detail footer in `ui/components/photo-detail.tsx` (previous / next, a one-line shortcut hint, fit, info, shortcuts). The info panel hides itself below 900 px width. The album filter in `ui/components/album-filter.tsx` is ten wrapping chips. The home screen stacks to one column below 720 px.
- **Impact:** The source intends to collapse, but it is unproven that the hint is not clipped, that chips do not eat the grid, or that an auto-hidden info panel does not look like a missing panel, in a typical narrow Mac window.
- **Minimal fix:** Look in a real narrow window first. If clipping or crowding is real, fold secondary actions into the existing shortcut list, and leave a visible cue when the info panel is auto-hidden.
- **Verification:** Requires a real window. Headless tests do not include a width matrix.
- **Boundary:** This is a risk from layout structure, not a confirmed overflow defect.
- **Fix status:** A conservative safeguard was added without changing product meaning: the detail footer and tool row can wrap, and the shortcut hint can use two lines and shrink. The filter chips already wrapped; that behavior is unchanged. Headless tests have no window-width matrix, so clipping or crowding at 720 px, 900 px, or narrower is still unproven and still needs a real window.

### P3 · Histogram blue is not a theme token

- **Location:** `ui/components/photo-info.tsx` draws the histogram with `#D67A76`, `#7EA77A`, and `#6A8CBA`. The first two match danger and success; blue is not in `ui/theme.ts`.
- **Impact:** Small visual drift. Blue contrast on the dark background was not checked in a real window.
- **Minimal fix:** Move channel colors into the theme and check them on the dark background.
- **Verification:** Confirmed in source. Contrast needs a visual or rendered measurement.
- **Boundary:** Not a functional defect.
- **Fix status:** Histogram red, green, and blue now live in `ui/theme.ts`, and the canvas uses those tokens. A headless test locks blue to `color.histogramBlue`. Contrast still needs a real window or a rendered measurement.

## Items that still need a real window

The source issues below were fixed in this follow-up, but their appearance still needs a real window. Nothing here is marked as visually accepted.

1. Whether the fixed dark theme, reserved warm amber, frosted glass / vibrancy, bundled ChillDINGothic, and multi-tone Kubai icons hold up on the system dark material, including WCAG AA contrast on those surfaces.
2. Whether keyboard focus rings are visible on the transparent top row, the grid, the stars, and the settings overlay.
3. Whether the corrected 显示尺寸 and 原片 1:1 labels can still be read as original 100% in a real window, and whether photograph size and display size in the panel are clearly distinct.
4. Whether compact album stars, now 24 px with a gap, still cause miss-clicks or overlapping focus rings.
5. Home cards, filter chips, the detail footer (now allowed to wrap and shrink), and the auto-hidden info panel at about 720 px, 900 px, and narrower. Clipping or crowding is still unproven without a window.
6. The look of empty, loading, error, and success states on home, devices, album, detail, and settings, including the failed-mark notice, and whether 正在保存… and 已保存 are clear and appropriately quiet.
7. Whether the new 不符合当前筛选 label on a filter-kept photograph is recognizable in the grid and on the detail page.
8. Confirmation copy and mis-click risk when deleting a profile, and settings field focus order.
9. Readability of Chinese photographer copy, histogram labels (including contrast of the tokenized channel colors on the dark background), and source badges over the photograph.

Until those items are closed in a real window, the app should not be described as having passed design or accessibility review.
