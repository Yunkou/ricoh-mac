# Photo detail page

This document records the navigation model for replacing the large-image overlay with a standalone detail page, and the implementation that followed it.

## State before the change

The local album is a thumbnail grid in `ui/components/album-grid.tsx`, backed by an NSH `List`. Clicking a cell calls `openAlbumPhoto`, which sets `viewingId` to that file name.

The large view is `PhotoViewerHost`, a full-window, absolutely positioned overlay with `color.overlay` behind it. The Photos area that holds the grid stays mounted and is only covered. Closing the view sets `viewingId` to `null`, the overlay goes away, and the grid is visible again. Because the grid never left the tree, its scroll position is usually still there. That is a side effect of the overlay, not an explicit restore after a page goes away.

The current large view already has previous and next, fit-to-window and 1:1, a file-info panel, and keyboard shortcuts. The info panel shows the file name, size, pixel dimensions, and the absolute path, as a floating card in the lower left.

The app does not use an NSH navigation stack. Home, Devices, and Photos are switched through `mainArea` and gate components.

## Navigation model

Treat the open photograph as a page at the same level as the grid, not as a modal overlay.

Extend `MainArea` to `"home" | "devices" | "photos" | "photo"`. When a photograph opens:

1. `openAlbumPhoto` still records the current photograph, and also sets `mainArea` to `"photo"`.
2. In the detail state, `PhotosGate` does not render the grid. It renders the detail page instead.
3. Remove `PhotoViewerHost` as a full-window overlay. Move the existing preview, zoom, and info panel into the detail page component.

On the detail page, the top-bar Back control returns to the album grid, not to Home. Back from the grid still returns to Home. Switching to Devices from the detail page closes the detail and opens Devices. `Esc` does the same as Back: it returns to the grid.

Previous and next change only the photograph on the detail page. They do not leave the page, and they do not rebuild the whole page. `Home` and `End` still jump to the first and last photographs. `F` still switches between fit-to-window and 1:1. `I` still shows or hides the info panel. `?` still shows or hides the shortcut list.

`Space` and `Enter` open the detail page from the album grid. Once the detail page is open, those keys no longer close it, because this is a page, not a popup. The only ways to leave are Back and `Esc`.

This version opens the detail page only from the Photos album. The Devices grid stays a selection and import surface, and does not open the detail page.

## Scroll position on the grid

The album uses a virtualized `List`, and the column count changes with the window width, so do not save a pixel offset. When returning to the grid, scroll to the photograph by its identifier and keep that cell focused. Confirm that NSH `List` offers scroll-to-index, or an equivalent, at implementation time. If it does not, only then consider keeping the grid mounted and hidden. If the window width changes while the detail page is open, align to the same photograph under the new column count.

## Transitions

Area changes continue to use the existing `FadeEnter`. Entering the detail page from the grid, and returning to the grid, use a short fade and honor `reduceMotion()`. Previous and next on the detail page should swap only the photograph, not fade the whole page. If a transition is added there, it also honors reduced motion.

The detail page does not introduce a separate dark header background. The file name and Back control sit in the existing draggable top region, clear of the traffic-light buttons, in line with the current title-bar-free window.

## Impact on tests

The current interface tests assume that the overlay and the grid exist at the same time, and that `Space` or `Enter` closes the large view. Those tests need to change with the page model, and should also assert the following:

- Clicking a photograph in the album opens the detail page, and the album grid is not shown.
- Back and `Esc` return to the grid, with that photograph visible and focused.
- Previous, next, the arrow keys, `H` `L` `J` `K`, `Home`, and `End` still change only the photograph on the detail page.
- `Space` and `Enter` open the detail page from the grid, and do not close the detail page.
- `F`, `I`, and `?` keep their current behavior.
- Switching to Devices from the detail page enters the Devices area, and does not leave an overlay behind.

Rust unit tests do not need a wider scope for this navigation change. After implementation, confirm on the machine that the top controls do not collide with the window buttons, and that scroll position is correct after returning from the detail page. The current headless tests cannot prove those visuals.

## Decisions already made

Confirmed on 15 November 2026 (Asia/Shanghai): `Space` and `Enter` open the detail page from the album grid, and no longer close the page once it is open. The only ways to leave are Back and `Esc`. This version opens the detail page only from the Photos album.

## Implementation

The detail page is a `mainArea` of `"photo"`. `PhotoViewerHost` has been removed. Opening a photograph from the album grid, with a click, Space, or Enter, enters the page. Back or Esc returns to the album grid and restores that photograph by identifier, using `List` `initialScrollIndex` and `scrollToIndex`, then focuses the cell. Previous, next, and the related shortcuts stay on the page. Choosing 照片 on the area switch from the detail page returns to the album grid in the same way. Switching to 设备 closes the page and opens 设备. The Devices grid does not open the detail page.

Headless tests cover opening and closing the page, previous and next, the keyboard shortcuts, returning to the restored cell, and choosing 照片 or 设备 from the area switch. Whether the top controls collide with the window buttons, and how scroll restoration looks in a real window, must be confirmed in the running interface.
