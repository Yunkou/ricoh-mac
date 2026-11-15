import { expect, test } from "nsh/test";
import { copy } from "../copy";
import {
  displayPixelDimensions,
  displaySizeCaption,
  fitModeLabel,
  pixelDimensionsLabel,
} from "./preview-display";

test("fit-mode copy names original pixels only for an original photograph", () => {
  expect(fitModeLabel(false, "original")).toBe(copy.fitToWindow);
  expect(fitModeLabel(false, "raw")).toBe(copy.fitToWindow);
  expect(fitModeLabel(true, "original")).toBe("原片 1:1");
  expect(fitModeLabel(true, "raw")).toBe("显示尺寸");
  expect(fitModeLabel(true, "preview")).toBe("显示尺寸");
  expect(fitModeLabel(true, null)).toBe("显示尺寸");
});

test("the information panel keeps photograph size apart from a downsampled display raster", () => {
  expect(pixelDimensionsLabel(6000, 4000)).toBe("6000 × 4000");
  expect(displayPixelDimensions(6000, 4000, 6000, 4000)).toBeNull();
  expect(displayPixelDimensions(6000, 4000, 4096, 2731)).toBe("4096 × 2731");
  expect(displaySizeCaption("raw")).toBe("显示尺寸（RAW 显影）");
  expect(displaySizeCaption("preview")).toBe("显示尺寸（嵌入预览）");
  expect(displaySizeCaption("original")).toBe("显示尺寸");
});
