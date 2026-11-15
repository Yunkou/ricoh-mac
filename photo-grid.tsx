import { Image, List, Text, View, windowSize } from "nsh";
import type { Signal } from "nsh";
import { copy } from "./copy";
import { cellWidth, columnCount } from "./selection";
import { color, focusRing, grid, radius, space, type } from "./theme";
import type { ListedPhoto, ThumbLoader, ThumbRequest } from "./thumb-loader";

export type FileStatus = "pending" | "imported" | "skipped" | "conflict" | "error";

export type PressModifiers = { modifiers?: { shift?: boolean } };

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

function cellLayout() {
  const width = windowSize().width;
  const columns = columnCount(width);
  const size = cellWidth(width, columns);
  return { columns, size, height: size + grid.caption };
}

export function PhotoGrid(props: {
  photos: Signal<ListedPhoto[]>;
  thumbs: Signal<Record<string, string>>;
  selected: Signal<Record<string, boolean>>;
  fileStatus: Signal<Record<string, FileStatus>>;
  loader: ThumbLoader;
  onPhotoPress: (index: number, id: string, event?: PressModifiers) => void;
  onFocusPhoto: (id: string) => void;
}) {
  return (
    <List
      testID="photo-grid"
      each={props.photos()}
      keyExtractor={(item) => item.id}
      numColumns={cellLayout().columns}
      estimatedItemSize={cellLayout().height}
      contentStyle={{ padding: space.lg, gap: grid.gap }}
      style={{ flex: 1 }}
      onViewableItemsChange={(info) => {
        const items: ThumbRequest[] = info.viewableItems.map((entry) => ({
          id: entry.item.id,
          folder: entry.item.folder,
          file: entry.item.file,
        }));
        props.loader.request(items);
      }}
    >
      {(item, index) => {
        const layout = () => cellLayout();
        const path = () => props.thumbs()[item().id] || "";
        const isOn = () => !!props.selected()[item().id];
        const status = () => props.fileStatus()[item().id];
        return (
          <View
            role="button"
            testID={`photo-${index()}`}
            accessibilityLabel={item().file}
            accessibilityState={{ selected: isOn() }}
            focusable={true}
            onPress={(event) => props.onPhotoPress(index(), item().id, event)}
            onFocus={() => props.onFocusPhoto(item().id)}
            style={{
              width: layout().size,
              height: layout().height,
              gap: space.xs,
            }}
            focusVisibleStyle={focusRing}
          >
            <View
              style={{
                width: layout().size,
                height: layout().size,
                borderRadius: radius.thumb,
                backgroundColor: color.thumb,
                overflow: "hidden",
                borderWidth: 2,
                borderColor: isOn() ? color.accent : "transparent",
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
                  style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
                />
              ) : (
                <View style={{ flex: 1, backgroundColor: color.thumb, pointerEvents: "none" }} />
              )}
              {isOn() ? (
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
                  }}
                >
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
              {item().file}
            </Text>
          </View>
        );
      }}
    </List>
  );
}
