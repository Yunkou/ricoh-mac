import { copy } from "../copy";

export function fitModeLabel(actual: boolean, source: string | null | undefined): string {
  if (!actual) {
    return copy.fitToWindow;
  }
  return source === "original" ? copy.originalPixels : copy.displayPixels;
}

export function displaySizeCaption(source: string | null | undefined): string {
  if (source === "raw") {
    return copy.displayPixelsRaw;
  }
  if (source === "preview") {
    return copy.displayPixelsPreview;
  }
  return copy.displayPixels;
}

export function pixelDimensionsLabel(
  width: number | null | undefined,
  height: number | null | undefined,
): string | null {
  if (!width || !height) {
    return null;
  }
  return `${Math.round(width)} × ${Math.round(height)}`;
}

export function displayPixelDimensions(
  photoWidth: number | null | undefined,
  photoHeight: number | null | undefined,
  displayWidth: number | null | undefined,
  displayHeight: number | null | undefined,
): string | null {
  const display = pixelDimensionsLabel(displayWidth, displayHeight);
  if (!display) {
    return null;
  }
  const photo = pixelDimensionsLabel(photoWidth, photoHeight);
  if (photo && photo === display) {
    return null;
  }
  return display;
}

export function rasterSize(
  width: number | null | undefined,
  height: number | null | undefined,
): { width: number; height: number } | null {
  if (typeof width !== "number" || typeof height !== "number" || width <= 0 || height <= 0) {
    return null;
  }
  return { width, height };
}
