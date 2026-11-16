import { Image, Text, View } from "nsh";
import type { Signal, ViewRef } from "nsh";
import { copy } from "../copy";
import type { AlbumPhoto, MarksStatus } from "../state/app-model";
import type { PressModifiers } from "../state/connection";
import type { SelectionMap } from "../state/selection";
import { normalizeFlag, type CullFlag } from "../state/cull";
import { albumThumbHeight, fileFormatFromName } from "../state/photo-layout";
import { color, focusRing, font, radius, space, type } from "../theme";
import { CullControls, FlagButton } from "./cull-controls";
import { Icon } from "./icon";

export function AlbumCell(props: {
  item: () => AlbumPhoto;
  index: () => number;
  size: () => number;
  height: () => number;
  thumbs: Signal<Record<string, string>>;
  selected: Signal<SelectionMap>;
  restoreId?: Signal<string | null>;
  onPress: (index: number, id: string, event?: PressModifiers) => void;
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
      accessibilityState={{ selected: isSelected(props) }}
      onPress={(event) => props.onPress(props.index(), props.item().id, event)}
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
          height: albumThumbHeight(props.size()),
          borderRadius: radius.thumb,
          backgroundColor: color.thumb,
          overflow: "hidden",
          position: "relative",
          borderWidth: 2,
          borderColor: isSelected(props) ? color.accent : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
        hoverStyle={{
          borderColor: isSelected(props) ? color.accent : color.border,
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
        {fileFormatFromName(props.item().file) ? (
          <View
            style={{
              position: "absolute",
              left: space.xs,
              top: space.xs,
              paddingHorizontal: 5,
              paddingVertical: 2,
              borderRadius: radius.control,
              backgroundColor: color.overlay,
            }}
          >
            <Text
              testID={`album-format-${props.item().id}`}
              style={{
                fontFamily: font.family,
                color: color.text,
                fontSize: type.badge,
                lineHeight: type.lineBadge,
              }}
            >
              {fileFormatFromName(props.item().file)}
            </Text>
          </View>
        ) : null}
        <View
          style={{
            position: "absolute",
            right: space.xs,
            top: space.xs,
            flexDirection: "row",
            gap: space.xs,
          }}
        >
          <FlagButton
            testID={`cull-${props.item().id}-flag-picked`}
            label={copy.flagPicked}
            active={normalizeFlag(props.item().flag) === "picked"}
            tone="picked"
            compact={true}
            onPress={() => props.onFlag(props.item().id, "picked")}
          />
          <FlagButton
            testID={`cull-${props.item().id}-flag-rejected`}
            label={copy.flagRejected}
            active={normalizeFlag(props.item().flag) === "rejected"}
            tone="rejected"
            compact={true}
            onPress={() => props.onFlag(props.item().id, "rejected")}
          />
        </View>
        {isSelected(props) ? (
          <View
            testID={`album-selected-${props.item().id}`}
            style={{
              position: "absolute",
              left: space.xs,
              bottom: space.xs,
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: color.accent,
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <View
              style={{
                width: 8,
                height: 4,
                borderLeftWidth: 2,
                borderBottomWidth: 2,
                borderColor: color.onAccent,
                transform: [{ rotate: "-45deg" }],
              }}
            />
          </View>
        ) : null}
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
        variant="card"
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

function isSelected(props: { selected: Signal<SelectionMap>; item: () => AlbumPhoto }): boolean {
  return !!props.selected()[props.item().id];
}
