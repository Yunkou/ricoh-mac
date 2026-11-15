# Design

This document records the visual system of the Milestone 1 macOS interface. The interface is a fixed-dark Operate surface: the user completes library selection, camera connection, and import. Photographs occupy most of the window.

## Colors

The palette is a dim room for reading photographs. Neutrals are warm-near-black, not a generic cool dashboard. Warm amber is the only accent and is reserved for the primary action, selection, and focus.

### Primary
- **Amber** (`#D8A45A`): Primary button fill, selected thumbnail border, selection mark, progress fill, and keyboard focus outline. Button label on this fill is `#161513`. Hover fill is `#E0B06A`.

### Neutral
- **Background** (`#111110`): Window canvas behind the grid.
- **Surface** (`#1A1917`): Toolbar and progress strip.
- **Raised** (`#22211E`): Settings panel and the circular settings button.
- **Text** (`#F2F0EC`): Primary copy.
- **Secondary** (`#A39E96`): Supporting copy, idle and connecting status, skipped badges.
- **Tertiary** (`#948F86`): Library path and captions that sit on surface or background.
- **Border** (`#2E2C28`): Hairline rules and secondary button outlines.
- **Thumb well** (`#0E0E0D`): Empty thumbnail placeholder.
- **Overlay** (`#00000099`): Badge backing and the settings shadow color.

### Semantic
- **Success** (`#7EA77A`): Connected status and “imported” badges.
- **Warning** (`#E09040`): Conflicts, a pending camera-profile prompt, and a tunnel-route hint. The word “冲突” is shown as well as the color when a conflict occurs.
- **Danger** (`#D67A76`): Failed connection, failed import, and notices. This color is not used for an idle “not yet connected” state.

### Named Rules
**The One Accent Rule.** Amber appears on the primary action, the current selection, and focus. It is not used as a fill for every button, a background wash, or decorative chrome.

**The Honest State Rule.** Idle uses secondary text. Connecting uses secondary text. A pending camera-profile prompt uses warning. Only an attempted connection that failed uses danger. Skip, conflict, and error are labeled in words and are not the same color.

## Typography

**Display Font:** the platform system sans (San Francisco on macOS)
**Body Font:** the same family
**Label/Mono Font:** none. File names use the same family.

**Character:** One family, tight steps, no letter-spaced uppercase section titles, no display face.

### Hierarchy
- **Title** (600, 20 / 26): First-run and empty-canvas headings.
- **Emphasis** (600, 15 / 20): Settings heading.
- **Body** (400 or 600, 13 / 18): Status, buttons, and primary sentences.
- **Meta** (400, 11 / 16): Counts, captions, help, and file names under thumbnails.

### Named Rules
**The One Family Rule.** Do not introduce a second typeface for a technical or photographic mood.

## Layout

The window has no product-name header and no persistent sidebar. A compact toolbar sits at the top. An optional progress strip sits under it. The remaining space is the photograph grid or an empty canvas.

The grid is a virtualized `List` with `numColumns` derived from `windowSize().width`. Horizontal padding is 16 points on each side. The gap is 8 points. The minimum cell is 136 points. Columns range from 1 to 8. Each cell is a square thumbnail plus a 22-point caption row.

Spacing uses 4, 8, 12, 16, and 24 points. Corner radii are 4 for thumbnails, 6 for inputs, 8 for buttons, and 10 for the settings panel. The settings control is a 36-point circle in the toolbar’s trailing corner. It opens an anchored overlay for the library folder, the camera network profile (SSID, password entry, delete, and automatic switch-back), and the advanced camera URL. That control is not primary navigation.

## Elevation & Depth

Depth comes from tonal layers, not a large shadow system. The toolbar is one step above the canvas. The settings panel is one step above the toolbar, with a single soft shadow (`0 8 24` at `#00000099`). Thumbnails use a 2-point amber border when selected, not a drop shadow.

## Components

- **Primary button:** Amber fill, dark label, visible focus outline, disabled opacity 0.45.
- **Secondary button:** Transparent fill, border, light label.
- **Ghost button:** No border, secondary label, used for select all, clear, and refresh.
- **Circular settings button:** Icon drawn from simple shapes, not an emoji or a letter.
- **Connection status:** Text in the toolbar, color plus wording. A first-time profile form sits on the empty canvas. After a network switch, a switch-back action can appear in the toolbar.
- **Progress:** A 4-point bar and a file-name line while importing; a summary line afterward, with conflict and error details listed separately.
- **Thumbnail:** Cover fit, selection mark in the trailing top corner, status badge in the leading bottom corner when an import has a result.

## Interaction

- Click or tap a thumbnail to toggle selection.
- Shift-click selects the inclusive range from the last anchor, using `PressEvent.modifiers.shift`.
- Command-A selects all, Escape clears the selection or closes settings, Command-Return imports the selection, Command-R refreshes the list. Bindings use `keymap.bind` with `when: "notEditing"` so they do not intercept typing in the camera URL field. Space toggles the focused thumbnail.
- Focusable controls show `focusVisibleStyle` as a 2-point amber outline with a 2-point offset.
- A successful probe loads the photograph list automatically. Import actions are disabled while an import, probe, list, or folder pick is running, and “import selected” stays disabled when the selection is empty.

## Motion

State changes may use a short 150–250 ms transition. Motion is not decorative. The app follows the system reduce-motion preference when NSH applies it to transitions.

## Source tokens

TypeScript tokens live in `ui/theme.ts` and are consumed by the interface under `ui/`. Interface copy lives in `ui/copy.ts`.
