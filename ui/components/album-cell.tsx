import { Image, Text, View } from "nsh";
import { copy } from "../copy";
import type { AlbumPhoto } from "../state/app-model";
import { color, focusRing, font, radius, space, type } from "../theme";
import { Icon } from "./icon";

export function AlbumCell(props: {
  item: () => AlbumPhoto;
  index: () => number;
  size: () => number;
  height: () => number;
  onPress: (index: number, id: string) => void;
  onFocus: (id: string) => void;
}) {
  const preview = () => props.item().previewUrl;
  return (
    <View
      role="button"
      testID={`album-photo-${props.index()}`}
      accessibilityLabel={props.item().file}
      focusable={true}
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
        style={{
          width: props.size(),
          height: props.size(),
          borderRadius: radius.thumb,
          backgroundColor: color.thumb,
          overflow: "hidden",
          borderWidth: 2,
          borderColor: "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
        hoverStyle={{
          borderColor: color.border,
        }}
      >
        {preview() ? (
          <Image
            src={preview() ?? ""}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <View style={{ alignItems: "center", gap: space.xs, padding: space.sm }}>
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
    </View>
  );
}
