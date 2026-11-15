import { expect, test } from "nsh/test";
import {
  filterAlbumPhotos,
  marksSummary,
  nextFlag,
  nextRating,
  normalizeFlag,
  normalizeRating,
} from "./cull";
import type { LibraryPhoto } from "ricoh-mac/native";

function photo(partial: Partial<LibraryPhoto> & Pick<LibraryPhoto, "id">): LibraryPhoto {
  return {
    file: partial.file ?? partial.id,
    size: 1,
    path: `/tmp/${partial.id}`,
    previewUrl: null,
    rating: 0,
    flag: "none",
    marksError: null,
    ...partial,
  };
}

test("the next star clears the same rating and leaves a different rating set", () => {
  expect(nextRating(0, 3)).toBe(3);
  expect(nextRating(3, 3)).toBe(0);
  expect(nextRating(3, 5)).toBe(5);
  expect(nextRating(3, 0)).toBe(0);
});

test("picked and rejected replace each other, and the same flag clears", () => {
  expect(nextFlag("none", "picked")).toBe("picked");
  expect(nextFlag("picked", "picked")).toBe("none");
  expect(nextFlag("picked", "rejected")).toBe("rejected");
  expect(nextFlag("rejected", "picked")).toBe("picked");
  expect(nextFlag("rejected", "none")).toBe("none");
});

test("the album filter keeps the current photo and hides the rest", () => {
  const photos = [
    photo({ id: "a.jpg", rating: 3, flag: "picked" }),
    photo({ id: "b.jpg", rating: 0, flag: "rejected" }),
    photo({ id: "c.jpg", rating: 5, flag: "none" }),
  ];
  expect(filterAlbumPhotos(photos, { kind: "all" }).map((item) => item.id)).toEqual([
    "a.jpg",
    "b.jpg",
    "c.jpg",
  ]);
  expect(filterAlbumPhotos(photos, { kind: "flag", flag: "picked" }).map((item) => item.id)).toEqual([
    "a.jpg",
  ]);
  expect(filterAlbumPhotos(photos, { kind: "flag", flag: "none" }).map((item) => item.id)).toEqual([
    "c.jpg",
  ]);
  expect(filterAlbumPhotos(photos, { kind: "rating", rating: 0 }).map((item) => item.id)).toEqual([
    "b.jpg",
  ]);
  expect(
    filterAlbumPhotos(photos, { kind: "flag", flag: "picked" }, "b.jpg").map((item) => item.id),
  ).toEqual(["a.jpg", "b.jpg"]);
});

test("marks summaries stay readable and ratings stay in range", () => {
  expect(normalizeRating(4.2)).toBe(4);
  expect(normalizeRating(9)).toBe(0);
  expect(normalizeFlag("picked")).toBe("picked");
  expect(normalizeFlag("maybe")).toBe("none");
  expect(marksSummary(0, "none")).toBe("未评级 · 无标记");
  expect(marksSummary(3, "none")).toBe("3 星");
  expect(marksSummary(0, "picked")).toBe("已选");
  expect(marksSummary(5, "rejected")).toBe("5 星 · 排除");
});
