import { Image, Scroll, Text, View, keymap, pixelRatio, reduceMotion, signal, windowSize } from "nsh";
import type { Signal } from "nsh";
import { copy } from "../copy";
import { transitionMs } from "../lib/motion";
import { infoPanelMinWidth, type AlbumPhoto, type AppModel, type PhotoDetails } from "../state/app-model";
import { color, font, motion, space, type } from "../theme";
import { Button } from "./button";
import { CullControls } from "./cull-controls";
import { FadeEnter } from "./fade-enter";
import { Icon } from "./icon";
import { PhotoInfoPanel } from "./photo-info";

export function PhotoDetail(props: { model: AppModel }) {
  const model = props.model;
  const actualSize = signal(false);
  const infoMode = signal<"auto" | "on" | "off">("auto");
  const showShortcuts = signal(false);
  const naturalSize = signal<{ width: number; height: number } | null>(null);
  let lastId: string | null = null;

  keymap.bind(
    {
      f: () => {
        if (previewUrl(model.visibleAlbumPhotos(), model.viewingId(), model.photoDetails())) {
          actualSize.set(!actualSize());
        }
      },
      i: () => {
        const visible = infoVisible(infoMode(), windowSize().width);
        infoMode.set(visible ? "off" : "on");
      },
      "shift+/": () => showShortcuts.set(!showShortcuts()),
    },
    { when: "notEditing" },
  );

  return (
    <FadeEnter style={{ flex: 1, minHeight: 0 }}>
      <View
        testID="photo-detail"
        style={{
          flex: 1,
          minHeight: 0,
          flexDirection: "row",
          paddingHorizontal: space.lg,
          paddingBottom: space.lg,
          gap: space.lg,
        }}
      >
        {resetViewOnPhotoChange(model.viewingId(), lastId, (id) => {
          lastId = id;
        }, actualSize, naturalSize)}
        <View
          testID={`viewer-photo-${model.viewingId() ?? ""}`}
          style={{ flex: 1, minWidth: 0, minHeight: 0, gap: space.md }}
        >
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
            {previewUrl(model.visibleAlbumPhotos(), model.viewingId(), model.photoDetails()) ? (
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
                    src={previewUrl(model.visibleAlbumPhotos(), model.viewingId(), model.photoDetails()) ?? ""}
                    accessibilityLabel={photoFile(model.visibleAlbumPhotos(), model.viewingId())}
                    onLoad={(event) => naturalSize.set(event.size)}
                    style={previewStyle(true, naturalSize())}
                  />
                </Scroll>
              ) : (
                <View testID="viewer-fit-mode" style={{ width: "100%", height: "100%" }}>
                  <Image
                    testID="viewer-image"
                    src={previewUrl(model.visibleAlbumPhotos(), model.viewingId(), model.photoDetails()) ?? ""}
                    accessibilityLabel={photoFile(model.visibleAlbumPhotos(), model.viewingId())}
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
            {model.photoDetails()?.previewSource === "preview" &&
            previewUrl(model.visibleAlbumPhotos(), model.viewingId(), model.photoDetails()) ? (
              <Text
                testID="viewer-preview-source"
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  fontFamily: font.family,
                  color: color.secondary,
                  fontSize: type.meta,
                  lineHeight: type.lineMeta,
                }}
              >
                {copy.embeddedPreview}
              </Text>
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
                  borderRadius: 10,
                  padding: space.md,
                  gap: space.xs,
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
                <Text style={metaTextStyle()}>{`Space  Enter    ${copy.shortcutOpen}`}</Text>
                <Text style={metaTextStyle()}>{`Esc    ${copy.shortcutClose}`}</Text>
                <Text style={metaTextStyle()}>{`F    ${copy.shortcutFit}`}</Text>
                <Text style={metaTextStyle()}>{`I    ${copy.shortcutInfo}`}</Text>
                <Text style={metaTextStyle()}>{`?    ${copy.shortcutHelp}`}</Text>
                <Text style={metaTextStyle()}>{`0–5    ${copy.shortcutRate}`}</Text>
                <Text style={metaTextStyle()}>{`P    ${copy.shortcutPick}`}</Text>
                <Text style={metaTextStyle()}>{`X    ${copy.shortcutReject}`}</Text>
                <Text style={metaTextStyle()}>{`U    ${copy.shortcutUnflag}`}</Text>
              </View>
            ) : null}
          </View>
          {currentPhoto(model.albumPhotos(), model.viewingId()) ? (
            <CullControls
              photo={() =>
                currentPhoto(model.albumPhotos(), model.viewingId()) ??
                currentPhoto(model.visibleAlbumPhotos(), model.viewingId()) ??
                model.albumPhotos()[0]
              }
              variant="detail"
              onRate={(rating) => model.ratePhoto(rating, model.viewingId())}
              onFlag={(flag) => model.flagPhoto(flag, model.viewingId())}
            />
          ) : null}
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
              disabled={!hasPrev(model.visibleAlbumPhotos(), model.viewingId())}
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
              {photoIndexLabel(model.visibleAlbumPhotos(), model.viewingId())}
            </Text>
            <Button
              label={copy.nextPhoto}
              kind="secondary"
              testID="viewer-next"
              disabled={!hasNext(model.visibleAlbumPhotos(), model.viewingId())}
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
                disabled={!previewUrl(model.visibleAlbumPhotos(), model.viewingId(), model.photoDetails())}
                onPress={() => {
                  if (previewUrl(model.visibleAlbumPhotos(), model.viewingId(), model.photoDetails())) {
                    actualSize.set(!actualSize());
                  }
                }}
              />
              <Button
                label={copy.fileInfo}
                kind="ghost"
                testID="viewer-info-button"
                onPress={() => {
                  const visible = infoVisible(infoMode(), windowSize().width);
                  infoMode.set(visible ? "off" : "on");
                }}
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
        {infoVisible(infoMode(), windowSize().width) ? (
          <PhotoInfoPanel model={model} naturalSize={naturalSize} />
        ) : null}
      </View>
    </FadeEnter>
  );
}

function infoVisible(mode: "auto" | "on" | "off", width: number): boolean {
  if (mode === "on") {
    return true;
  }
  if (mode === "off") {
    return false;
  }
  return width >= infoPanelMinWidth;
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

function previewUrl(
  photos: AlbumPhoto[],
  id: string | null,
  details: PhotoDetails | null,
): string | undefined {
  return details?.previewUrl ?? currentPhoto(photos, id)?.previewUrl ?? undefined;
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
