import { expect, test } from "nsh/test";
import { copy } from "../copy";
import { compactStarHit, space, type, viewport } from "../theme";
import {
  albumCaption,
  albumCellHeight,
  albumChrome,
  albumThumbHeight,
  detailChrome,
  detailToolStack,
  fileFormatFromName,
  filterLabel,
  infoPlacement,
  infoVisible,
  ratingFilterLabel,
  sameFilter,
} from "./photo-layout";

test("album chrome collapses the filter row below 720, and stays full at 720 and 900", () => {
  expect(viewport.compact).toBe(720);
  expect(viewport.comfortable).toBe(900);
  expect(albumChrome(719)).toBe("compact");
  expect(albumChrome(720)).toBe("full");
  expect(albumChrome(900)).toBe("full");
});

test("detail chrome uses a side info panel only at 900 and a stacked tool strip below that", () => {
  expect(detailChrome(719)).toBe("narrow");
  expect(detailChrome(720)).toBe("medium");
  expect(detailChrome(899)).toBe("medium");
  expect(detailChrome(900)).toBe("wide");
  expect(detailToolStack(899)).toBe("stack");
  expect(detailToolStack(900)).toBe("row");
  expect(infoPlacement(899)).toBe("overlay");
  expect(infoPlacement(900)).toBe("side");
  expect(infoVisible("auto", 899)).toBe(false);
  expect(infoVisible("auto", 900)).toBe(true);
  expect(infoVisible("on", 400)).toBe(true);
  expect(infoVisible("off", 1400)).toBe(false);
});

test("album cells use a 3:2 thumbnail and a caption that fits the filename plus a 24-pixel star row", () => {
  expect(albumThumbHeight(180)).toBe(120);
  expect(albumCaption).toBe(type.lineMeta + compactStarHit + space.xs * 2);
  expect(albumCaption).toBeGreaterThanOrEqual(type.lineMeta + compactStarHit);
  expect(albumCellHeight(180)).toBe(120 + albumCaption);
  expect(albumCellHeight(180)).toBeLessThan(180 + 72);
});

test("format badges and filter labels keep existing product wording", () => {
  expect(fileFormatFromName("R0000001.JPG")).toBe("JPEG");
  expect(fileFormatFromName("R0000002.DNG")).toBe("DNG");
  expect(fileFormatFromName("scan.tiff")).toBe("TIFF");
  expect(fileFormatFromName(undefined)).toBeNull();
  expect(filterLabel({ kind: "all" })).toBe(copy.filterAll);
  expect(filterLabel({ kind: "flag", flag: "picked" })).toBe(copy.filterPicked);
  expect(filterLabel({ kind: "rating", rating: 3 })).toBe("3 星");
  expect(ratingFilterLabel({ kind: "all" })).toBe(copy.filterStars);
  expect(ratingFilterLabel({ kind: "rating", rating: 0 })).toBe("未评级");
  expect(sameFilter({ kind: "flag", flag: "picked" }, { kind: "flag", flag: "picked" })).toBe(true);
  expect(sameFilter({ kind: "all" }, { kind: "flag", flag: "none" })).toBe(false);
});
