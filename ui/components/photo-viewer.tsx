import { Image, Scroll, Text, View, keymap, pixelRatio, reduceMotion, signal } from "nsh";
import type { Signal } from "nsh";
import { copy } from "../copy";
import { transitionMs } from "../lib/motion";
import type { AlbumPhoto, AppModel } from "../state/app-model";
import { color, font, motion, panelBackdrop, radius, space, type } from "../theme";
import { Button } from "./button";
import { Icon } from "./icon";

export function PhotoViewerHost(props: { model: AppModel }) {
  const model = props.model;
  const visible = signal(false);
  return (
    <>
      {syncVisible(model.viewingId() !== null, visible)}
      {visible() ? <PhotoViewer model={model} /> : null}
    </>
  );
}

export function PhotoViewer(props: { model: AppModel }) {
  const model = props.model;
  const actualSize = signal(false);
  const showInfo = signal(false);
  const showShortcuts = signal(false);
  const naturalSize = signal<{ width: number; height: number } | null>(null);
  let lastId: string | null = null;

  keymap.bind(
    {
      f: () => {
        if (previewUrl(model.albumPhotos(), model.viewingId())) {
          actualSize.set(!actualSize());
        }
      },
      i: () => showInfo.set(!showInfo()),
      "shift+/": () => showShortcuts.set(!showShortcuts()),
    },
    { when: "notEditing" },
  );

  return (
    <View
      testID="photo-viewer"
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: color.overlay,
        justifyContent: "center",
        alignItems: "center",
        padding: space.xl,
        gap: space.md,
      }}
    >
      {resetViewOnPhotoChange(model.viewingId(), lastId, (id) => {
        lastId = id;
      }, actualSize, naturalSize)}
      <View
        testID={`viewer-photo-${model.viewingId() ?? ""}`}
        style={{ width: "100%", maxWidth: 1100, gap: space.md, flex: 1 }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            width: "100%",
            gap: space.md,
          }}
        >
          <Text
            testID="viewer-name"
            style={{
              fontFamily: font.family,
              color: color.text,
              fontSize: type.emphasis,
              lineHeight: type.lineEmphasis,
              fontWeight: font.emphasis,
              flex: 1,
              numberOfLines: 1,
              textOverflow: "ellipsis-middle",
            }}
          >
            {photoFile(model.albumPhotos(), model.viewingId())}
          </Text>
          <Button
            label={copy.closeViewer}
            kind="ghost"
            testID="viewer-close"
            icon="circle-x"
            onPress={() => model.closeViewer()}
          />
        </View>
        <View
          style={{
            flex: 1,
            width: "100%",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 0,
            position: "relative",
          }}
        >
          {previewUrl(model.albumPhotos(), model.viewingId()) ? (
            actualSize() ? (
              <Scroll
                testID="viewer-actual-mode"
                centerContent={true}
                style={{ width: "100%", height: "100%" }}
                contentStyle={{
                  minWidth: "100%",
                  minHeight: "100%",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Image
                  testID="viewer-image"
                  src={previewUrl(model.albumPhotos(), model.viewingId()) ?? ""}
                  accessibilityLabel={photoFile(model.albumPhotos(), model.viewingId())}
                  onLoad={(event) => naturalSize.set(event.size)}
                  style={previewStyle(true, naturalSize())}
                />
              </Scroll>
            ) : (
              <View testID="viewer-fit-mode" style={{ width: "100%", height: "100%" }}>
                <Image
                  testID="viewer-image"
                  src={previewUrl(model.albumPhotos(), model.viewingId()) ?? ""}
                  accessibilityLabel={photoFile(model.albumPhotos(), model.viewingId())}
                  onLoad={(event) => naturalSize.set(event.size)}
                  style={previewStyle(false, naturalSize())}
                />
              </View>
            )
          ) : (
            <View
              testID="viewer-placeholder"
              style={{
                alignItems: "center",
                justifyContent: "center",
                gap: space.md,
                padding: space.xl,
              }}
            >
              <Icon name="images" size={36} />
              <Text
                style={{
                  fontFamily: font.family,
                  color: color.text,
                  fontSize: type.title,
                  lineHeight: type.lineTitle,
                  fontWeight: font.emphasis,
                  textAlign: "center",
                }}
              >
                {copy.cannotPreview}
              </Text>
              <Text
                style={{
                  fontFamily: font.family,
                  color: color.secondary,
                  fontSize: type.body,
                  lineHeight: type.lineBody,
                  textAlign: "center",
                  maxWidth: 420,
                }}
              >
                {copy.cannotPreviewHint}
              </Text>
            </View>
          )}
          {showInfo() && currentPhoto(model.albumPhotos(), model.viewingId()) ? (
            <View
              testID="viewer-info"
              style={{
                position: "absolute",
                left: 0,
                bottom: 0,
                maxWidth: 360,
                backgroundColor: color.raised,
                borderColor: color.border,
                borderWidth: 1,
                borderRadius: radius.panel,
                padding: space.md,
                gap: space.xs,
                opacity: 1,
                transitionProperty: "opacity",
                transitionDuration: transitionMs(reduceMotion() ? 0 : motion.short),
                transitionTimingFunction: motion.easing,
              }}
            >
              <Text
                style={{
                  fontFamily: font.family,
                  color: color.text,
                  fontSize: type.body,
                  lineHeight: type.lineBody,
                  fontWeight: font.emphasis,
                }}
              >
                {copy.fileInfoTitle}
              </Text>
              <Text style={metaTextStyle()}>
                {`${copy.fileName}：${photoFile(model.albumPhotos(), model.viewingId())}`}
              </Text>
              <Text style={metaTextStyle()}>
                {`${copy.fileSize}：${fileSizeLabel(currentPhoto(model.albumPhotos(), model.viewingId()))}`}
              </Text>
              <Text style={metaTextStyle()}>
                {`${copy.filePixels}：${pixelLabel(naturalSize())}`}
              </Text>
              <Text style={metaTextStyle()}>
                {`${copy.filePath}：${currentPhoto(model.albumPhotos(), model.viewingId())?.path ?? copy.unknownValue}`}
              </Text>
            </View>
          ) : null}
          {showShortcuts() ? (
            <View
              testID="viewer-shortcuts"
              style={{
                position: "absolute",
                right: 0,
                bottom: 0,
                maxWidth: 420,
                backgroundColor: color.raised,
                borderColor: color.border,
                borderWidth: 1,
                borderRadius: radius.panel,
                padding: space.md,
                gap: space.xs,
                opacity: 1,
                transitionProperty: "opacity",
                transitionDuration: transitionMs(reduceMotion() ? 0 : motion.short),
                transitionTimingFunction: motion.easing,
              }}
            >
              <Text
                style={{
                  fontFamily: font.family,
                  color: color.text,
                  fontSize: type.body,
                  lineHeight: type.lineBody,
                  fontWeight: font.emphasis,
                }}
              >
                {copy.shortcuts}
              </Text>
              <Text style={metaTextStyle()}>{`← →  H L  J K    ${copy.shortcutNav}`}</Text>
              <Text style={metaTextStyle()}>{`Home  End    ${copy.shortcutEnds}`}</Text>
              <Text style={metaTextStyle()}>{`Space  Enter    ${copy.shortcutToggle}`}</Text>
              <Text style={metaTextStyle()}>{`Esc    ${copy.shortcutClose}`}</Text>
              <Text style={metaTextStyle()}>{`F    ${copy.shortcutFit}`}</Text>
              <Text style={metaTextStyle()}>{`I    ${copy.shortcutInfo}`}</Text>
              <Text style={metaTextStyle()}>{`?    ${copy.shortcutHelp}`}</Text>
            </View>
          ) : null}
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: space.md,
          }}
        >
          <Button
            label={copy.previousPhoto}
            kind="secondary"
            testID="viewer-prev"
            disabled={!hasPrev(model.albumPhotos(), model.viewingId())}
            onPress={() => model.showAdjacentPhoto(-1)}
          />
          <Text
            testID="viewer-index"
            style={{
              fontFamily: font.family,
              color: color.secondary,
              fontSize: type.meta,
              lineHeight: type.lineMeta,
              fontVariant: font.tabularNums,
            }}
          >
            {photoIndexLabel(model.albumPhotos(), model.viewingId())}
          </Text>
          <Button
            label={copy.nextPhoto}
            kind="secondary"
            testID="viewer-next"
            disabled={!hasNext(model.albumPhotos(), model.viewingId())}
            onPress={() => model.showAdjacentPhoto(1)}
          />
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            gap: space.md,
          }}
        >
          <Text
            testID="viewer-hint"
            style={{
              fontFamily: font.family,
              color: color.tertiary,
              fontSize: type.meta,
              lineHeight: type.lineMeta,
              flex: 1,
              numberOfLines: 1,
            }}
          >
            {copy.shortcutHint}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <Button
              label={actualSize() ? copy.actualSize : copy.fitToWindow}
              kind="ghost"
              testID="viewer-fit"
              disabled={!previewUrl(model.albumPhotos(), model.viewingId())}
              onPress={() => {
                if (previewUrl(model.albumPhotos(), model.viewingId())) {
                  actualSize.set(!actualSize());
                }
              }}
            />
            <Button
              label={copy.fileInfo}
              kind="ghost"
              testID="viewer-info-button"
              onPress={() => showInfo.set(!showInfo())}
            />
            <Button
              label={copy.shortcuts}
              kind="ghost"
              testID="viewer-help"
              onPress={() => showShortcuts.set(!showShortcuts())}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

function resetViewOnPhotoChange(
  id: string | null,
  lastId: string | null,
  setLastId: (id: string | null) => void,
  actualSize: Signal<boolean>,
  naturalSize: Signal<{ width: number; height: number } | null>,
): null {
  if (lastId === id) {
    return null;
  }
  setLastId(id);
  if (actualSize()) {
    actualSize.set(false);
  }
  if (naturalSize() !== null) {
    naturalSize.set(null);
  }
  return null;
}

function metaTextStyle() {
  return {
    fontFamily: font.family,
    color: color.secondary,
    fontSize: type.meta,
    lineHeight: type.lineMeta,
  };
}

function previewStyle(actual: boolean, size: { width: number; height: number } | null) {
  const fade = {
    transitionProperty: "opacity",
    transitionDuration: transitionMs(reduceMotion() ? 0 : motion.short),
    transitionTimingFunction: motion.easing,
  };
  if (!actual) {
    return {
      width: "100%" as const,
      height: "100%" as const,
      objectFit: "contain" as const,
      ...fade,
    };
  }
  const ratio = pixelRatio() || 1;
  return {
    width: size ? size.width / ratio : ("100%" as const),
    height: size ? size.height / ratio : ("100%" as const),
    objectFit: "none" as const,
    ...fade,
  };
}

function currentPhoto(photos: AlbumPhoto[], id: string | null): AlbumPhoto | undefined {
  if (!id) {
    return undefined;
  }
  return photos.find((photo) => photo.id === id);
}

function photoFile(photos: AlbumPhoto[], id: string | null): string {
  return currentPhoto(photos, id)?.file ?? "";
}

function previewUrl(photos: AlbumPhoto[], id: string | null): string | undefined {
  return currentPhoto(photos, id)?.previewUrl ?? undefined;
}

function photoIndex(photos: AlbumPhoto[], id: string | null): number {
  if (!id) {
    return -1;
  }
  return photos.findIndex((photo) => photo.id === id);
}

function photoIndexLabel(photos: AlbumPhoto[], id: string | null): string {
  const index = photoIndex(photos, id);
  if (index < 0) {
    return "";
  }
  return `${index + 1} / ${photos.length}`;
}

function hasPrev(photos: AlbumPhoto[], id: string | null): boolean {
  return photoIndex(photos, id) > 0;
}

function hasNext(photos: AlbumPhoto[], id: string | null): boolean {
  const index = photoIndex(photos, id);
  return index >= 0 && index < photos.length - 1;
}

function fileSizeLabel(photo: AlbumPhoto | undefined): string {
  if (photo?.size == null) {
    return copy.unknownValue;
  }
  return formatFileSize(photo.size);
}

function pixelLabel(size: { width: number; height: number } | null): string {
  if (!size) {
    return copy.unknownValue;
  }
  return `${Math.round(size.width)} × ${Math.round(size.height)}`;
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

function syncVisible(show: boolean, visible: Signal<boolean>): null {
  if (visible() !== show) {
    visible.set(show);
  }
  return null;
}
