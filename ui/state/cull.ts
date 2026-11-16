import type { LibraryPhoto } from "ricoh-mac/native";
import { copy } from "../copy";

export type CullFlag = "none" | "picked" | "rejected";

export type AlbumFilter =
  | { kind: "all" }
  | { kind: "flag"; flag: CullFlag }
  | { kind: "rating"; rating: number };

export function isCullFlag(value: string): value is CullFlag {
  return value === "none" || value === "picked" || value === "rejected";
}

export function normalizeRating(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  const rounded = Math.round(value);
  if (rounded < 0 || rounded > 5) {
    return 0;
  }
  return rounded;
}

export function normalizeFlag(value: string | null | undefined): CullFlag {
  return value && isCullFlag(value) ? value : "none";
}

export function nextRating(current: number, requested: number): number {
  if (requested === 0) {
    return 0;
  }
  return current === requested ? 0 : requested;
}

export function nextFlag(current: CullFlag, requested: CullFlag): CullFlag {
  if (requested === "none") {
    return "none";
  }
  return current === requested ? "none" : requested;
}

export function matchesFilter(photo: LibraryPhoto, filter: AlbumFilter): boolean {
  switch (filter.kind) {
    case "all":
      return true;
    case "flag":
      return normalizeFlag(photo.flag) === filter.flag;
    case "rating":
      return normalizeRating(photo.rating) === filter.rating;
    default: {
      const exhaustive: never = filter;
      return exhaustive;
    }
  }
}

export function filterAlbumPhotos(
  photos: LibraryPhoto[],
  filter: AlbumFilter,
  keepId?: string | null,
): LibraryPhoto[] {
  return photos.filter((photo) => photo.id === keepId || matchesFilter(photo, filter));
}



export type BatchMarksAction =
  | { kind: "rating"; rating: number }
  | { kind: "flag"; flag: CullFlag };

export function batchTargetMarks(
  rating: number,
  flag: CullFlag,
  action: BatchMarksAction,
): { rating: number; flag: CullFlag } {
  if (action.kind === "rating") {
    return { rating: normalizeRating(action.rating), flag: normalizeFlag(flag) };
  }
  return { rating: normalizeRating(rating), flag: normalizeFlag(action.flag) };
}

export function sameMarks(
  left: { rating: number; flag: CullFlag },
  right: { rating: number; flag: CullFlag },
): boolean {
  return left.rating === right.rating && left.flag === right.flag;
}

export function pickedAlbumCount(photos: LibraryPhoto[]): number {
  return photos.filter((photo) => normalizeFlag(photo.flag) === "picked").length;
}

export function matchingAlbumPhotos<T extends LibraryPhoto>(photos: T[], filter: AlbumFilter): T[] {
  return photos.filter((photo) => matchesFilter(photo, filter));
}

export function isKeptOutsideFilter(
  photo: LibraryPhoto,
  filter: AlbumFilter,
  keepId?: string | null,
): boolean {
  return Boolean(keepId) && photo.id === keepId && !matchesFilter(photo, filter);
}

export function adjacentPhotoId(
  photos: LibraryPhoto[],
  filter: AlbumFilter,
  currentId: string | null,
  delta: number,
): string | null {
  if (!currentId || delta === 0) {
    return null;
  }
  const currentIndex = photos.findIndex((photo) => photo.id === currentId);
  if (currentIndex < 0) {
    return null;
  }
  const step = delta > 0 ? 1 : -1;
  for (let index = currentIndex + step; index >= 0 && index < photos.length; index += step) {
    if (matchesFilter(photos[index], filter)) {
      return photos[index].id;
    }
  }
  return null;
}

export function matchingIndexLabel(
  photos: LibraryPhoto[],
  filter: AlbumFilter,
  currentId: string | null,
): string {
  if (!currentId) {
    return "";
  }
  const current = photos.find((photo) => photo.id === currentId);
  if (!current) {
    return "";
  }
  const matching = matchingAlbumPhotos(photos, filter);
  if (!matchesFilter(current, filter)) {
    return copy.filterKeptIndex(matching.length);
  }
  const index = matching.findIndex((photo) => photo.id === currentId);
  if (index < 0) {
    return "";
  }
  return `${index + 1} / ${matching.length}`;
}

export function marksSummary(rating: number, flag: CullFlag): string {
  const stars = copy.ratingLabel(rating);
  const mark = copy.flagLabel(flag);
  if (rating === 0 && flag === "none") {
    return `${stars} · ${mark}`;
  }
  if (flag === "none") {
    return stars;
  }
  if (rating === 0) {
    return mark;
  }
  return `${stars} · ${mark}`;
}

