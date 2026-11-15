import { Image, Text, View } from "nsh";
import type { Signal } from "nsh";
import { copy } from "../copy";
import { transitionMs, transitionStyle } from "../lib/motion";
import type { FileStatus, PressModifiers } from "../state/connection";
import { color, focusRing, motion, radius, space, type } from "../theme";
import type { ListedPhoto } from "../lib/thumb-loader";
import { Icon, type IconName } from "./icon";

const fileStatusLabel: Record<FileStatus, string> = {
  pending: copy.statusPending,
  imported: copy.statusImported,
  skipped: copy.statusSkipped,
  conflict: copy.statusConflict,
  error: copy.statusError,
};

const fileStatusColor: Record<FileStatus, string> = {
  pending: color.secondary,
  imported: color.success,
  skipped: color.secondary,
  conflict: color.warning,
  error: color.danger,
};

const fileStatusIcon: Record<FileStatus, IconName> = {
  pending: "loader",
  imported: "circle-check",
  skipped: "circle-minus",
  conflict: "circle-alert",
  error: "circle-x",
};

export function PhotoCell(props: {
  item: () => ListedPhoto;
  index: () => number;
  size: () => number;
  height: () => number;
  thumbs: Signal<Record<string, string>>;
  selected: Signal<Record<string, boolean>>;
  fileStatus: Signal<Record<string, FileStatus>>;
  onPhotoPress: (index: number, id: string, event?: PressModifiers) => void;
  onFocusPhoto: (id: string) => void;
}) {
  const path = () => props.thumbs()[props.item().id] || "";
  const isOn = () => !!props.selected()[props.item().id];
  const status = () => props.fileStatus()[props.item().id];
  return (
    <View
      role="button"
      testID={`photo-${props.index()}`}
      accessibilityLabel={props.item().file}
      accessibilityState={{ selected: isOn() }}
      focusable={true}
      onPress={(event) => props.onPhotoPress(props.index(), props.item().id, event)}
      onFocus={() => props.onFocusPhoto(props.item().id)}
      style={{
        width: props.size(),
        height: props.height(),
        gap: space.xs,
      }}
      focusVisibleStyle={focusRing}
    >
      <View
        style={{
          width: props.size(),
          height: props.size(),
          borderRadius: radius.thumb,
          backgroundColor: color.thumb,
          overflow: "hidden",
          borderWidth: 2,
          borderColor: isOn() ? color.accent : "transparent",
          ...transitionStyle("border-color", motion.short),
        }}
        selectedStyle={{
          borderColor: color.accent,
        }}
        hoverStyle={{
          borderColor: isOn() ? color.accent : color.border,
        }}
      >
        {path() ? (
          <Image
            src={path()}
            fadeDuration={transitionMs(motion.duration)}
            style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
          />
        ) : (
          <View style={{ flex: 1, backgroundColor: color.thumb, pointerEvents: "none" }} />
        )}
        <View
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            width: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: color.accent,
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            opacity: isOn() ? 1 : 0,
            transform: [{ scale: isOn() ? 1 : 0.85 }],
            ...transitionStyle("opacity, transform", motion.short),
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
        {status() ? (
          <View
            style={{
              position: "absolute",
              left: 6,
              bottom: 6,
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 4,
              backgroundColor: color.overlay,
              pointerEvents: "none",
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Icon name={fileStatusIcon[status() ?? "pending"]} size={12} />
            <Text style={{ color: fileStatusColor[status() ?? "pending"], fontSize: 10, fontWeight: "600" }}>
              {fileStatusLabel[status() ?? "pending"]}
            </Text>
          </View>
        ) : null}
      </View>
      <Text
        style={{
          color: color.secondary,
          fontSize: type.meta,
          lineHeight: type.lineMeta,
          numberOfLines: 1,
          textOverflow: "ellipsis",
        }}
      >
        {props.item().file}
      </Text>
    </View>
  );
}
