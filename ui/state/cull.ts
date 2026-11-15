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

