import { List, windowSize } from "nsh";
import type { Signal } from "nsh";
import type { FileStatus, PressModifiers } from "../state/connection";
import { cellWidth, columnCount } from "../state/selection";
import { grid, space } from "../theme";
import type { ListedPhoto, ThumbLoader, ThumbRequest } from "../lib/thumb-loader";
import { PhotoCell } from "./photo-cell";

export type { FileStatus, PressModifiers };

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
      {(item, index) => (
        <PhotoCell
          item={item}
          index={index}
          size={() => cellLayout().size}
          height={() => cellLayout().height}
          thumbs={props.thumbs}
          selected={props.selected}
          fileStatus={props.fileStatus}
          onPhotoPress={props.onPhotoPress}
          onFocusPhoto={props.onFocusPhoto}
        />
      )}
    </List>
  );
}
