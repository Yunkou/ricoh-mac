import { Image, Text, View } from "nsh";
import type { Signal, ViewRef } from "nsh";
import { copy } from "../copy";
import type { AlbumPhoto, MarksStatus } from "../state/app-model";
import type { CullFlag } from "../state/cull";
import { color, focusRing, font, radius, space, type } from "../theme";
import { CullControls } from "./cull-controls";
import { Icon } from "./icon";

export function AlbumCell(props: {
  item: () => AlbumPhoto;
  index: () => number;
  size: () => number;
  height: () => number;
  thumbs: Signal<Record<string, string>>;
  restoreId?: Signal<string | null>;
  onPress: (index: number, id: string) => void;
  onFocus: (id: string) => void;
  onRate: (id: string, rating: number) => void;
  onFlag: (id: string, flag: CullFlag) => void;
  onRestored?: () => void;
  outsideFilter: () => boolean;
  marksStatus: () => MarksStatus;
}) {
  return (
    <View
      role="button"
      testID={`album-photo-${props.index()}`}
      accessibilityLabel={props.item().file}
      focusable={true}
      ref={(node) => restoreFocus(node, props.item().id, props.restoreId?.(), props.onRestored)}
      onPress={() => props.onPress(props.index(), props.item().id)}
      onFocus={() => props.onFocus(props.item().id)}
      style={{
        width: props.size(),
        height: props.height(),
        gap: space.xs,
      }}
      focusVisibleStyle={focusRing}
    >
      <View
        testID={
          props.thumbs()[props.item().id] || props.item().previewUrl
            ? `album-preview-${props.item().id}`
            : `album-missing-${props.item().id}`
        }
        style={{
          width: props.size(),
          height: props.size(),
          borderRadius: radius.thumb,
          backgroundColor: color.thumb,
          overflow: "hidden",
          position: "relative",
          borderWidth: 2,
          borderColor: "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
        hoverStyle={{
          borderColor: color.border,
        }}
      >
        {props.thumbs()[props.item().id] || props.item().previewUrl ? (
          <Image
            src={props.thumbs()[props.item().id] || props.item().previewUrl || ""}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <View
            style={{ alignItems: "center", gap: space.xs, padding: space.sm }}
          >
            <Icon name="images" size={22} />
            <Text
              style={{
                fontFamily: font.family,
                color: color.tertiary,
                fontSize: type.badge,
                lineHeight: type.lineBadge,
                textAlign: "center",
              }}
            >
              {copy.cannotPreview}
            </Text>
          </View>
        )}
        {props.outsideFilter() ? (
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              paddingHorizontal: space.xs,
              paddingVertical: 2,
              backgroundColor: color.overlay,
            }}
          >
            <Text
              testID={`album-kept-${props.item().id}`}
              style={{
                fontFamily: font.family,
                color: color.text,
                fontSize: type.badge,
                lineHeight: type.lineBadge,
                textAlign: "center",
                numberOfLines: 1,
              }}
            >
              {copy.filterKept}
            </Text>
          </View>
        ) : null}
      </View>
      <Text
        style={{
          fontFamily: font.family,
          color: color.secondary,
          fontSize: type.meta,
          lineHeight: type.lineMeta,
          numberOfLines: 1,
          textOverflow: "ellipsis-middle",
        }}
      >
        {props.item().file}
      </Text>
      <CullControls
        photo={props.item}
        variant="compact"
        onRate={(rating) => props.onRate(props.item().id, rating)}
        onFlag={(flag) => props.onFlag(props.item().id, flag)}
        status={props.marksStatus}
      />
    </View>
  );
}

function restoreFocus(
  node: ViewRef | null,
  id: string,
  restoreId: string | null | undefined,
  onRestored?: () => void,
): void {
  if (!node || !restoreId || restoreId !== id) {
    return;
  }
  node.focus();
  onRestored?.();
}

