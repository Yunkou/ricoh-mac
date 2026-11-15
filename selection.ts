import { grid } from "./theme";

export type SelectionMap = Record<string, boolean>;

export function toggleId(selected: SelectionMap, id: string): SelectionMap {
  const next = { ...selected };
  if (next[id]) {
    delete next[id];
  } else {
    next[id] = true;
  }
  return next;
}

export function rangeIds(ids: readonly string[], from: number, to: number): string[] {
  if (ids.length === 0) {
    return [];
  }
  const start = Math.max(0, Math.min(from, to));
  const end = Math.min(ids.length - 1, Math.max(from, to));
  return ids.slice(start, end + 1);
}

export function applyRange(ids: readonly string[], from: number, to: number): SelectionMap {
  const next: SelectionMap = {};
  for (const id of rangeIds(ids, from, to)) {
    next[id] = true;
  }
  return next;
}

export function selectAll(ids: readonly string[]): SelectionMap {
  const next: SelectionMap = {};
  for (const id of ids) {
    next[id] = true;
  }
  return next;
}

export function selectedIds(selected: SelectionMap): string[] {
  return Object.keys(selected).filter((id) => selected[id]);
}

export function selectedCount(selected: SelectionMap): number {
  return selectedIds(selected).length;
}

export function columnCount(
  width: number,
  options?: {
    padding?: number;
    gap?: number;
    minCell?: number;
    minColumns?: number;
    maxColumns?: number;
  },
): number {
  const padding = options?.padding ?? grid.padding;
  const gap = options?.gap ?? grid.gap;
  const minCell = options?.minCell ?? grid.minCell;
  const minColumns = options?.minColumns ?? grid.minColumns;
  const maxColumns = options?.maxColumns ?? grid.maxColumns;
  const available = Math.max(width - padding, minCell);
  const columns = Math.floor((available + gap) / (minCell + gap));
  return Math.max(minColumns, Math.min(maxColumns, columns));
}

export function cellWidth(
  width: number,
  columns: number,
  options?: { padding?: number; gap?: number },
): number {
  const padding = options?.padding ?? grid.padding;
  const gap = options?.gap ?? grid.gap;
  const safeColumns = Math.max(1, columns);
  const available = Math.max(width - padding, 0);
  return Math.max(1, Math.floor((available - gap * (safeColumns - 1)) / safeColumns));
}

export function gridMetrics(width: number): {
  columns: number;
  cellWidth: number;
  cellHeight: number;
} {
  const columns = columnCount(width);
  const widthPerCell = cellWidth(width, columns);
  return {
    columns,
    cellWidth: widthPerCell,
    cellHeight: widthPerCell + grid.caption,
  };
}

export function idsByFileName(photos: readonly { id: string; file: string }[], fileName: string): string[] {
  return photos.filter((photo) => photo.file === fileName).map((photo) => photo.id);
}
