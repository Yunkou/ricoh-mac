# Design

This document records the visual system of the Milestone 1 macOS interface. The interface is a fixed-dark Operate surface: the user completes library selection, camera connection, and import. Photographs occupy most of the window.

## Colors

The palette is a dim room for reading photographs. Neutrals are warm-near-black, not a generic cool dashboard. Warm amber is the only accent and is reserved for the primary action, selection, and focus.

### Primary
- **Amber** (`#D8A45A`): Primary button fill, selected thumbnail border, selection mark, progress fill, and keyboard focus outline. Button label on this fill is `#161513`. Hover fill is `#E0B06A`.

### Neutral
- **Background** (transparent): The window canvas. The system dark vibrancy material shows through.
- **Surface** (`#1A1917B8`): Translucent fills for secondary layers, such as a progress strip.
- **Raised** (`#22211ECC`): Translucent fills for feature cards, the settings panel, and the circular settings button.
- **Input** (`#11111099`): Translucent fill for text fields, so entered text stays legible on the vibrancy.
- **Segment** (`#FFFFFF14`): A light wash on the active segment of the area switch.
- **Text** (`#F2F0EC`): Primary copy.
- **Secondary** (`#A39E96`): Supporting copy, idle and connecting status, skipped badges.
- **Tertiary** (`#948F86`): Library path and captions that sit on surface or background.
- **Border** (`#FFFFFF1F`): Hairline rules and secondary button outlines on glass.
- **Thumb well** (`#0E0E0DCC`): Empty thumbnail placeholder.
- **Overlay** (`#00000099`): Badge backing and the settings shadow color.

### Semantic
- **Success** (`#7EA77A`): Connected status and “imported” badges.
- **Warning** (`#E09040`): Conflicts, a pending camera-profile prompt, and a tunnel-route hint. The word “冲突” is shown as well as the color when a conflict occurs.
- **Danger** (`#D67A76`): Failed connection, failed import, and notices. This color is not used for an idle “not yet connected” state.

### Named Rules
**The One Accent Rule.** Amber appears on the primary action, the current selection, and focus. It is not used as a fill for every button, a background wash, or decorative chrome.

**The Honest State Rule.** Idle uses secondary text. Connecting uses secondary text. A pending camera-profile prompt uses warning. Only an attempted connection that failed uses danger. Skip, conflict, and error are labeled in words and are not the same color.

## Typography

**Display Font:** ChillDINGothic (寒蝉德黑体) v1.300, Regular and SemiBold, bundled in the app
**Body Font:** the same family
**Label/Mono Font:** none. File names use the same family. Counts use tabular figures from this family.

**Character:** One family, tight steps, no letter-spaced uppercase section titles, no display face. Glyphs the face does not contain (for example most emoji) fall back to the system font. The font is registered for this process only; it is not installed on macOS.

### Hierarchy
- **Display** (600, 32 / 40): Home feature-card titles.
- **Title** (600, 20 / 26): Empty-canvas headings.
- **Emphasis** (600, 15 / 20): Settings heading.
- **Body** (400 or 600, 13 / 18): Status, buttons, and primary sentences.
- **Meta** (400, 11 / 16): Counts, captions, help, and file names under thumbnails.
- **Badge** (600, 10 / 14): Import status on a thumbnail.

### Named Rules
**The One Family Rule.** Do not introduce a second typeface for a technical or photographic mood.

## Layout

The window has no visible product name and no persistent sidebar. The main window uses a hidden title bar with full-size content, configured in `nsh.json` as `window.titleBar.style: "hidden"`, so the system traffic-light buttons remain and sit in the content. The window is transparent and uses the system dark vibrancy material (`window.transparent` and `window.backdrop: "sidebar"`). There is no separate header strip or header fill. A compact, transparent chrome row at the top is a window-drag region, inset so that its controls stay clear of the traffic lights. The circular settings control floats at the trailing corner of that row. The home screen presents two feature entries, 照片 and 设备, with 照片 on the left and 设备 on the right. Card titles are large, and the icon sits to the right of the title on the same row. The whole card is the press target, with hover and focus states. Inside an area, the same row holds a back control and a segmented switch between the two areas. An optional progress strip sits under that row in 设备. The remaining space is the corresponding grid, empty canvas, or large-image viewer.

The grid is a virtualized `List` with `numColumns` derived from `windowSize().width`. Horizontal padding is 16 points on each side. The gap is 8 points. The minimum cell is 136 points. Columns range from 1 to 8. Each cell is a square thumbnail plus a 22-point caption row.

Spacing uses 4, 8, 12, 16, and 24 points. Corner radii are 4 for thumbnails, 6 for inputs, 8 for buttons, and 10 for the settings panel. The settings control is a 36-point circle in the trailing corner of the transparent top row. It opens an anchored overlay for the save location, the camera network profile (network name, password entry, delete, and automatic switch-back), and the camera address. That control is not primary navigation.

## Elevation & Depth

Depth comes from translucent layers over the window’s dark vibrancy, not from a large shadow system or opaque fills. Feature cards, the settings panel, and similar surfaces use a system material (`macos.backdrop`, popover, within the window) with a lightly tinted fill, so the vibrancy remains visible through them. The settings panel also keeps a single soft shadow (`0 8 24` at `#00000099`). Thumbnails use a 2-point amber border when selected, not a drop shadow.

## Components

- **Primary button:** Amber fill, dark label, visible focus outline, disabled opacity 0.45.
- **Secondary button:** Transparent fill, border, light label.
- **Ghost button:** No border, secondary label, used for select all, clear, and refresh.
- **Circular settings button:** A Kubai `settings` icon in a circular control, not an emoji or a letter.
- **Connection status:** Text in the toolbar of 设备, color plus wording. Saved camera profiles are listed in that area. A first-time profile form sits on the empty canvas. After a network switch, a switch-back action can appear in the toolbar.
- **Progress:** A 4-point bar and a file-name line while importing; a summary line afterward, with conflict and error details listed separately, and an action to open 照片.
- **Thumbnail:** In 设备, cover fit, selection mark in the trailing top corner, and a status badge in the leading bottom corner when an import has a result. In 照片, cover fit without a selection mark; a file that cannot be previewed uses a placeholder and caption.
- **Large-image viewer:** A full-window overlay with the photograph, the file name, previous and next controls, and a close control. A file that cannot be displayed shows an explanation rather than an empty frame. The viewer can show a file-information panel and can toggle between fitting the photograph to the window and displaying it at actual size (1:1). A compact hint lists the principal keyboard shortcuts, and a control opens the full list.

## Interaction

- In 设备, click or tap a thumbnail to toggle selection. Shift-click selects the inclusive range from the last anchor, using `PressEvent.modifiers.shift`.
- In 照片, click or tap a thumbnail to open the large-image viewer. Left and Right, as well as H and L or J and K, move to the previous or next photograph. Home and End move to the first or last photograph. Space or Enter opens the viewer from the grid and closes it when the viewer is open. Escape closes the viewer. F toggles between fitting the photograph to the window and actual size (1:1) when a preview is available. I shows or hides file information. Shift-/ (“?”) shows or hides the shortcut list.
- In 设备, Command-A selects all, Escape clears the selection or closes settings, Command-Return imports the selection, and Command-R refreshes the camera list. In 照片, Command-R refreshes the album list. Bindings use `keymap.bind` with `when: "notEditing"` so they do not intercept typing in the camera URL field. Space toggles the focused camera thumbnail when the viewer is not open.
- Focusable controls show `focusVisibleStyle` as a 2-point amber outline with a 2-point offset.
- A successful probe loads the photograph list automatically. Import actions are disabled while an import, probe, list, or folder pick is running, and “import selected” stays disabled when the selection is empty.

## Motion

State changes use short transitions (120 ms for press feedback, 150–220 ms for state and overlays). Motion is not decorative: it explains press, connection, selection, import progress, and appearance of results. Transforms and opacity are preferred; the import fill uses `scaleX`, not a layout width change. The app does not bounce or shake. When `reduceMotion()` is set, spatial movement is removed and transitions take 0 ms, including those in the large-image viewer; `createMotion` already lands at the end state. Iconography uses vendored Kubai Icons 0.9.0 SVGs (MIT) under `ui/assets/icons/`. The files use the official color variant, whose tones are all derived from one accent. Those accents are mapped to the theme (warm amber, neutrals, and semantic success, warning, and danger), not the library’s default blue. Icons on primary amber buttons keep a monochrome on-accent treatment, because a multi-tone or amber glyph would not contrast with the button fill.

## Source tokens

TypeScript tokens live in `ui/theme.ts` and are consumed by the interface under `ui/`. Interface copy lives in `ui/copy.ts`. Icons are imported through `ui/components/icon.tsx`. The UI font is imported through `ui/assets/fonts/index.ts` and set as the app font in `ui/font-theme.json` (`font-sans`, named from `nsh.json`). The official OFL text sits beside the font files as `LICENSE`.
