import { Canvas, Scroll, Text, View } from "nsh";
import type { CanvasRenderingContext2D, CanvasSize } from "nsh";
import type { Signal } from "nsh";
import {
  colorSpaceLabel,
  copy,
  cropModeLabel,
  exposureModeLabel,
  focusModeLabel,
  formatLabel,
  imageControlLabel,
  meteringModeLabel,
  onOffLabel,
  takenAtLabel,
  whiteBalanceLabel,
} from "../copy";
import type { AppModel } from "../state/app-model";
import {
  displayPixelDimensions,
  displaySizeCaption,
  pixelDimensionsLabel,
} from "../state/preview-display";
import { color, font, panelBackdrop, radius, space, type } from "../theme";

export const histogramChannelFills = {
  red: color.histogramRed,
  green: color.histogramGreen,
  blue: color.histogramBlue,
} as const;

export function PhotoInfoPanel(props: {
  model: AppModel;
  naturalSize: Signal<{ width: number; height: number } | null>;
}) {
  return (
    <View
      testID="viewer-info"
      macos={{ backdrop: panelBackdrop }}
      style={{
        width: 300,
        minWidth: 260,
        maxWidth: 320,
        minHeight: 0,
        height: "100%",
        backgroundColor: color.raised,
        borderColor: color.border,
        borderWidth: 1,
        borderRadius: radius.panel,
        overflow: "hidden",
      }}
    >
      <Scroll style={{ flex: 1 }} contentStyle={{ padding: space.md, gap: space.lg }}>
        <Group title={copy.exposureTitle} testID="photo-info-exposure">
          <HeroRow label={copy.aperture} value={() => props.model.photoDetails()?.aperture} />
          <HeroRow label={copy.shutter} value={() => props.model.photoDetails()?.shutter} />
          <HeroRow label={copy.iso} value={() => props.model.photoDetails()?.iso} />
          <InfoRow label={copy.exposureCompensation} value={() => props.model.photoDetails()?.exposureCompensation} />
          <InfoRow label={copy.exposureMode} value={() => exposureModeLabel(props.model.photoDetails()?.exposureMode)} />
          <InfoRow label={copy.meteringMode} value={() => meteringModeLabel(props.model.photoDetails()?.meteringMode)} />
        </Group>
        <Group title={copy.lensTitle} testID="photo-info-lens">
          <InfoRow
            label={copy.camera}
            value={() => cameraLabel(props.model.photoDetails()?.cameraMake, props.model.photoDetails()?.cameraModel)}
          />
          <InfoRow label={copy.lens} value={() => props.model.photoDetails()?.lens} />
          <InfoRow label={copy.focalLength} value={() => props.model.photoDetails()?.focalLength} />
          <InfoRow label={copy.focalLength35mm} value={() => props.model.photoDetails()?.focalLength35mm} />
          <InfoRow label={copy.cropMode} value={() => cropModeLabel(props.model.photoDetails()?.cropMode)} />
        </Group>
        <Group title={copy.lookTitle} testID="photo-info-look">
          <InfoRow label={copy.imageControl} value={() => imageControlLabel(props.model.photoDetails()?.imageControl)} />
          <InfoRow label={copy.whiteBalance} value={() => whiteBalanceLabel(props.model.photoDetails()?.whiteBalance)} />
          <InfoRow label={copy.colorTemperature} value={() => props.model.photoDetails()?.colorTemperature} />
          <InfoRow label={copy.focusMode} value={() => focusModeLabel(props.model.photoDetails()?.focusMode)} />
          <InfoRow label={copy.fullPressSnap} value={() => onOffLabel(props.model.photoDetails()?.fullPressSnap)} />
          <InfoRow label={copy.ndFilter} value={() => onOffLabel(props.model.photoDetails()?.ndFilter)} />
        </Group>
        <Group title={copy.fileTitle} testID="photo-info-file">
          <InfoRow label={copy.takenAt} value={() => takenAtLabel(props.model.photoDetails()?.takenAt)} />
          <InfoRow
            label={copy.fileFormat}
            value={() => formatLabel(props.model.photoDetails()?.format) ?? fileFormatFromName(currentAlbumPhoto(props.model)?.file)}
          />
          <InfoRow
            label={copy.fileSize}
            value={() => fileSizeLabel(props.model.photoDetails()?.size ?? currentAlbumPhoto(props.model)?.size)}
          />
          <InfoRow
            label={copy.filePixels}
            value={() =>
              pixelDimensionsLabel(
                props.model.photoDetails()?.width ?? null,
                props.model.photoDetails()?.height ?? null,
              ) ??
              pixelDimensionsLabel(props.naturalSize()?.width ?? null, props.naturalSize()?.height ?? null)
            }
          />
          <InfoRow
            testID="photo-display-size"
            label={displaySizeCaption(props.model.photoDetails()?.previewSource)}
            value={() =>
              displayPixelDimensions(
                props.model.photoDetails()?.width,
                props.model.photoDetails()?.height,
                props.naturalSize()?.width ?? props.model.previewRasterSize()?.width,
                props.naturalSize()?.height ?? props.model.previewRasterSize()?.height,
              )
            }
          />
          <InfoRow label={copy.aspectRatio} value={() => props.model.photoDetails()?.aspectRatio ?? null} />
          <InfoRow label={copy.colorSpace} value={() => colorSpaceLabel(props.model.photoDetails()?.colorSpace)} />
          <InfoRow label={copy.gps} value={() => props.model.photoDetails()?.gps ?? null} />
        </Group>
        {props.model.photoDetails()?.histogram ? (
          <Histogram histogram={() => props.model.photoDetails()?.histogram ?? null} />
        ) : null}
      </Scroll>
    </View>
  );
}

function Group(props: { title: string; testID: string; children?: import("nsh").JSX.Element }) {
  return (
    <View testID={props.testID} style={{ gap: space.sm }}>
      <Text
        style={{
          fontFamily: font.family,
          color: color.tertiary,
          fontSize: type.meta,
          lineHeight: type.lineMeta,
          fontWeight: font.emphasis,
        }}
      >
        {props.title}
      </Text>
      <View style={{ gap: 6 }}>{props.children}</View>
    </View>
  );
}

function HeroRow(props: { label: string; value: () => string | null | undefined }) {
  return (
    <>
      {props.value() ? (
        <View style={{ gap: 2 }}>
          <Text
            style={{
              fontFamily: font.family,
              color: color.tertiary,
              fontSize: type.meta,
              lineHeight: type.lineMeta,
            }}
          >
            {props.label}
          </Text>
          <Text
            style={{
              fontFamily: font.family,
              color: color.text,
              fontSize: type.title,
              lineHeight: type.lineTitle,
              fontWeight: font.emphasis,
              fontVariant: font.tabularNums,
            }}
          >
            {props.value()}
          </Text>
        </View>
      ) : null}
    </>
  );
}

function InfoRow(props: { label: string; value: () => string | null | undefined; testID?: string }) {
  return (
    <>
      {props.value() ? (
        <View testID={props.testID} style={{ flexDirection: "row", alignItems: "flex-start", gap: space.sm }}>
          <Text
            style={{
              fontFamily: font.family,
              color: color.tertiary,
              fontSize: type.meta,
              lineHeight: type.lineMeta,
              width: 88,
              flexShrink: 0,
            }}
          >
            {props.label}
          </Text>
          <Text
            style={{
              fontFamily: font.family,
              color: color.text,
              fontSize: type.body,
              lineHeight: type.lineBody,
              flex: 1,
              minWidth: 0,
            }}
          >
            {props.value()}
          </Text>
        </View>
      ) : null}
    </>
  );
}

function Histogram(props: {
  histogram: () => { red: number[]; green: number[]; blue: number[]; source: string } | null;
}) {
  return (
    <View testID="photo-histogram" style={{ gap: space.sm }}>
      <Text
        style={{
          fontFamily: font.family,
          color: color.tertiary,
          fontSize: type.meta,
          lineHeight: type.lineMeta,
          fontWeight: font.emphasis,
        }}
      >
        {props.histogram()?.source === "raw"
          ? copy.histogramRaw
          : props.histogram()?.source === "preview"
            ? copy.histogramPreview
            : copy.histogram}
      </Text>
      <Canvas
        testID="photo-histogram-canvas"
        style={{ width: "100%", height: 88, borderRadius: radius.thumb }}
        draw={(cx, size) => {
          const histogram = props.histogram();
          if (!histogram) {
            return;
          }
          drawHistogram(cx, size, histogram.red, histogram.green, histogram.blue);
        }}
      />
    </View>
  );
}

function drawHistogram(
  cx: CanvasRenderingContext2D,
  size: CanvasSize,
  red: number[],
  green: number[],
  blue: number[],
): void {
  const width = size.width;
  const height = size.height;
  cx.clearRect(0, 0, width, height);
  cx.fillStyle = color.input;
  cx.globalAlpha = 1;
  cx.beginPath();
  cx.moveTo(0, 0);
  cx.lineTo(width, 0);
  cx.lineTo(width, height);
  cx.lineTo(0, height);
  cx.closePath();
  cx.fill();
  const bins = Math.max(red.length, green.length, blue.length, 1);
  const max = Math.max(1, ...red, ...green, ...blue);
  const channels: Array<{ values: number[]; fill: string }> = [
    { values: red, fill: histogramChannelFills.red },
    { values: green, fill: histogramChannelFills.green },
    { values: blue, fill: histogramChannelFills.blue },
  ];
  for (const channel of channels) {
    cx.fillStyle = channel.fill;
    cx.globalAlpha = 0.55;
    cx.beginPath();
    cx.moveTo(0, height);
    for (let index = 0; index < bins; index += 1) {
      const value = channel.values[index] ?? 0;
      const x = (index / Math.max(bins - 1, 1)) * width;
      const y = height - (value / max) * (height - 2);
      cx.lineTo(x, y);
    }
    cx.lineTo(width, height);
    cx.closePath();
    cx.fill();
  }
  cx.globalAlpha = 1;
}

function currentAlbumPhoto(model: AppModel) {
  const id = model.viewingId();
  if (!id) {
    return undefined;
  }
  return model.albumPhotos().find((photo) => photo.id === id);
}

function cameraLabel(make: string | null | undefined, model: string | null | undefined): string | null {
  const trimmedModel = model?.trim() ?? "";
  const trimmedMake = make?.trim() ?? "";
  if (trimmedModel && trimmedMake && !trimmedModel.toLowerCase().includes(trimmedMake.toLowerCase())) {
    return `${trimmedMake} ${trimmedModel}`;
  }
  return trimmedModel || trimmedMake || null;
}

function fileFormatFromName(file: string | undefined): string | null {
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

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${Math.round(bytes)} 字节`;
  }
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) {
    return `${kilobytes < 10 ? kilobytes.toFixed(1) : String(Math.round(kilobytes))} KB`;
  }
  const megabytes = kilobytes / 1024;
  return `${megabytes < 10 ? megabytes.toFixed(1) : String(Math.round(megabytes))} MB`;
}

function fileSizeLabel(size: number | null | undefined): string | null {
  if (size == null) {
    return null;
  }
  return formatFileSize(size);
}
