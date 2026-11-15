import { List, windowSize } from "nsh";
import type { ListRef, Signal } from "nsh";
import { cellWidth, columnCount } from "../state/selection";
import type { AlbumPhoto } from "../state/app-model";
import type { CullFlag } from "../state/cull";
import type { ThumbLoader, ThumbRequest } from "../lib/thumb-loader";
import { grid, space } from "../theme";
import { AlbumCell } from "./album-cell";

function cellLayout() {
  const width = windowSize().width;
  const columns = columnCount(width);
  const size = cellWidth(width, columns);
  return { columns, size, height: size + grid.caption };
}

function restoreIndex(photos: AlbumPhoto[], id: string | null): number | undefined {
  if (!id) {
    return undefined;
  }
  const index = photos.findIndex((photo) => photo.id === id);
  return index >= 0 ? index : undefined;
}

export function AlbumGrid(props: {
  photos: () => AlbumPhoto[];
  thumbs: Signal<Record<string, string>>;
  restoreId: Signal<string | null>;
  loader: ThumbLoader;
  onPhotoPress: (index: number, id: string) => void;
  onFocusPhoto: (id: string) => void;
  onRate: (id: string, rating: number) => void;
  onFlag: (id: string, flag: CullFlag) => void;
  onRestored: () => void;
}) {
  return (
    <List
      testID="album-grid"
      each={props.photos()}
      keyExtractor={(item) => item.id}
      numColumns={cellLayout().columns}
      estimatedItemSize={cellLayout().height}
      initialScrollIndex={restoreIndex(props.photos(), props.restoreId())}
      ref={(node) => restoreScroll(node, props.photos(), props.restoreId())}
      contentStyle={{ padding: space.lg, gap: grid.gap }}
      style={{ flex: 1 }}
      onViewableItemsChange={(info) => {
        const items: ThumbRequest[] = info.viewableItems
          .filter((entry) => !entry.item.previewUrl)
          .map((entry) => ({
            id: entry.item.id,
            folder: "",
            file: entry.item.file,
            path: entry.item.path,
          }));
        props.loader.request(items);
      }}
    >
      {(item, index) => (
        <AlbumCell
          item={item}
          index={index}
          size={() => cellLayout().size}
          height={() => cellLayout().height}
          thumbs={props.thumbs}
          restoreId={props.restoreId}
          onPress={props.onPhotoPress}
          onFocus={props.onFocusPhoto}
          onRate={props.onRate}
          onFlag={props.onFlag}
          onRestored={props.onRestored}
        />
      )}
    </List>
  );
}

function restoreScroll(list: ListRef | null, photos: AlbumPhoto[], id: string | null): void {
  if (!list) {
    return;
  }
  const index = restoreIndex(photos, id);
  if (index == null) {
    return;
  }
  list.scrollToIndex({ index, animated: false, viewPosition: 0.25 });
}
