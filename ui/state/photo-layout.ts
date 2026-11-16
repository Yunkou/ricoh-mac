import { copy } from "../copy";
import type { AlbumFilter } from "./cull";
import { compactStarHit, space, type, viewport } from "../theme";

export type AlbumChrome = "full" | "compact";
export type DetailChrome = "wide" | "medium" | "narrow";
export type InfoPlacement = "side" | "overlay";
export type InfoMode = "auto" | "on" | "off";

/** 3:2 contact-sheet frame (GR default). Height is derived from cell width. */
export const albumThumbRatio = 3 / 2;

/** Filename row plus the always-visible star row, including gaps. */
export const albumCaption =
  type.lineMeta + compactStarHit + space.xs * 2;

export function albumChrome(width: number): AlbumChrome {
  return width < viewport.compact ? "compact" : "full";
}

export function detailChrome(width: number): DetailChrome {
  if (width < viewport.compact) {
    return "narrow";
  }
  if (width < viewport.comfortable) {
    return "medium";
  }
  return "wide";
}

export function detailToolStack(width: number): "row" | "stack" {
  return width < viewport.comfortable ? "stack" : "row";
}

export function infoPlacement(width: number): InfoPlacement {
  return width >= viewport.comfortable ? "side" : "overlay";
}

export function infoVisible(mode: InfoMode, width: number): boolean {
  if (mode === "on") {
    return true;
  }
  if (mode === "off") {
    return false;
  }
  return width >= viewport.comfortable;
}

export function albumThumbHeight(width: number): number {
  return Math.max(1, Math.round(width / albumThumbRatio));
}

export function albumCellHeight(width: number): number {
  return albumThumbHeight(width) + albumCaption;
}

export function fileFormatFromName(file: string | undefined): string | null {
  if (!file) {
    return null;
  }
  const ext = file.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") {
    return "JPEG";
  }
  if (ext === "dng") {
    return "DNG";
  }
  return ext ? ext.toUpperCase() : null;
}

export function sameFilter(left: AlbumFilter, right: AlbumFilter): boolean {
  if (left.kind === "all" && right.kind === "all") {
    return true;
  }
  if (left.kind === "flag" && right.kind === "flag") {
    return left.flag === right.flag;
  }
  if (left.kind === "rating" && right.kind === "rating") {
    return left.rating === right.rating;
  }
  return false;
}

export function filterLabel(filter: AlbumFilter): string {
  if (filter.kind === "all") {
    return copy.filterAll;
  }
  if (filter.kind === "flag") {
    if (filter.flag === "picked") {
      return copy.filterPicked;
    }
    if (filter.flag === "rejected") {
      return copy.filterRejected;
    }
    return copy.filterNone;
  }
  return copy.filterRating(filter.rating);
}

export function ratingFilterLabel(filter: AlbumFilter): string {
  if (filter.kind === "rating") {
    return copy.filterRating(filter.rating);
  }
  return copy.filterStars;
}
