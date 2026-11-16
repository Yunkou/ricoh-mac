# Album list and photo detail layout

This note records the layout for the 照片 album grid and the photo detail page. The visual world stays the one in `DESIGN.md`: a fixed dark field, warm amber, translucent frosted glass, the bundled ChillDINGothic family, and multi-tone Kubai icons. The work changes structure inside that identity; it does not replace it.

## Job and mode

The user browses and culls photographs in a local album: see the pictures, open one, star or flag it, and move on. This is an Operate surface that still has to let the photograph be the first thing the eye reads. Device connection, import, and camera-thumbnail selection are outside this design.

Success means the photograph occupies clearly more space than the chrome in both the list and the detail page; folder, count, filters, and card information have a hierarchy instead of competing as equal chips and button rows; stars, picked, and rejected stay reachable with the pointer and with the existing keyboard shortcuts; and narrow windows follow an explicit structural strategy rather than wrapping without limit.

## Directions considered

1. **Immersive canvas.** The detail page is almost entirely the photograph, with chrome as auto-hiding overlays; the list becomes a denser contact sheet with marks reduced to badges. This maximizes image area. It also hides core culling actions behind hover, which is a poor fit for a tool that should keep those actions visible.
2. **Culling workbench (selected).** The list uses one quiet tool row for filters. Cards lead with a 3:2 photograph; file name, format, stars, and flags are layered and always actionable. The detail page uses a large canvas plus a collapsible information area, and gathers navigation, culling, and view controls into one structured tool strip. Photographs stay first without giving up culling speed. The cost is that the detail strip still needs two planned rows in a narrow window.
3. **Inspector first.** A persistently wide metadata column shrinks the photograph. That contradicts a photograph-led workspace, and is recorded only as a rejected contrast.

Direction 2 is the one implemented. It treats browsing and culling as one path, and does not introduce a persistent app sidebar, a product title, or new routing.

## Spatial thesis

- The primary path is: see the photograph, open or mark it, move to the next.
- In the list, thumbnails lead. The library path and count, the filters, and the grid are separate layers. Ten equal-weight chips and a full row of buttons on every cell are not the structure.
- In detail, the current display image leads. Photographer information is supporting and collapsible. Navigation and marks support the task; they are not a third canvas competing with the photograph.
- Rhythm is tight inside a control group (4–8 points) and more generous between groups, and between the photograph and the tool strip.
- Adaptation is structural and driven by window width, not by device model.

## List

The top row remains a transparent drag region with Back, the 照片 / 设备 switch, the library path, the count, and refresh. There is no persistent sidebar and no product title.

Filters:

- At 720 points and above, 全部 / 已选 / 排除 / 无标记 form one segmented group. Ratings live in a 星级 menu; once a rating is selected, the button shows that condition.
- Below 720 points, every option collapses into one 筛选 · current condition menu.
- Filter semantics are unchanged: a flag and a rating remain mutually exclusive.

Cards:

- Thumbnails use a 3:2 frame with cover fit, closer to the GR default aspect than a square crop.
- A format badge (JPEG, DNG, and so on) sits in the leading top corner. Picked and rejected stay in the trailing top corner, always visible, with a hit area of at least 24 CSS pixels.
- The file name sits on one line under the thumbnail, with a middle ellipsis.
- Five star controls sit under the file name, always visible, with a hit area of at least 24 CSS pixels and at least 4 points between neighbors.
- Keyboard shortcuts 0–5, P, X, and U are unchanged. Core actions are not hover-only.
- A DNG cell still uses its embedded preview when one exists. A file that cannot be previewed keeps its placeholder. A photograph kept visible when it misses the filter remains labeled 不符合当前筛选.

The 设备 grid keeps square thumbnails and a 22-point file-name row, and does not inherit album culling chrome.

## Detail page

The detail view remains a full page at the same level as the album grid, not a popup. Back, the file name, and the area switch stay in the existing transparent top row and do not encroach on the traffic-light drag region. Space / Enter to open, Escape to return and restore position and focus, I to toggle information, F to toggle fit versus display pixels, and Shift-/ to open the shortcut list are unchanged.

The canvas uses all remaining space between that row and the tool strip. The preview-source notice and the RAW / embedded-preview switch stay on the canvas.

Photographer information:

- At 900 points and above, the panel is a right-hand column and is open by default.
- In a narrower window it is closed by default. When opened, it is an overlay, so it does not carve a column out of the canvas.
- The distinction between photograph size and display size, and the rule that 原片 1:1 is only for an original JPEG while a RAW develop or embedded preview uses 显示尺寸, must not regress.

The tool strip has three groups: previous / index / next; stars and flags; and Fit, Info, and Shortcuts. At 900 points and above the groups share one row. Between 720 and 900 points, and in still narrower windows, they become two planned rows (navigation and culling above, view controls below) instead of wrapping without limit. There is no persistent shortcut hint; the full list still opens from the control or Shift-/.

## Window width

| Width | List | Detail |
| --- | --- | --- |
| 900 points and above | Flag segment plus rating menu; multi-column 3:2 grid | Information column open by default; one-row tool strip |
| 720–899 points | The same chrome, with fewer columns | Information closed by default, overlay when open; two-row tool strip |
| Below 720 points | A single filter menu; one or two columns | The same overlay rule; two-row tool strip |

## Out of scope

This layout does not change device connection, import, or camera-selection behavior, add culling features or complex routing, or replace the theme, type, or icon system. Impeccable skill files and snapshots are not part of the product documentation.

## What still needs a real window

Headless tests can cover the filter menu, format badges, always-visible stars and flags, returning from detail, shortcuts, showing and hiding information, switching preview source, and the structural rules at 720 and 900 points. The following still need to be looked at in a real `nsh dev` window on the machine, and cannot be declared visually accepted from source alone:

- Whether the 3:2 crop, filename ellipsis, and badges read clearly
- Whether picked and rejected controls stay readable on light or busy thumbnails, and whether their hit areas feel like 24 pixels
- Whether the filter menu, the information overlay, and the two-row tool strip feel crowded or obstructive at 720, 900, and narrower widths
- Whether frosted glass, the title-bar drag region, and the traffic lights stay clear
- Whether returning from detail still feels correctly scrolled and focused
