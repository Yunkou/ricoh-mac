import { List, windowSize } from "nsh";
import type { Signal } from "nsh";
import { cellWidth, columnCount } from "../state/selection";
import type { AlbumPhoto } from "../state/app-model";
import { grid, space } from "../theme";
import { AlbumCell } from "./album-cell";

function cellLayout() {
  const width = windowSize().width;
  const columns = columnCount(width);
  const size = cellWidth(width, columns);
  return { columns, size, height: size + grid.caption };
}

export function AlbumGrid(props: {
  photos: Signal<AlbumPhoto[]>;
  onPhotoPress: (index: number, id: string) => void;
  onFocusPhoto: (id: string) => void;
}) {
  return (
    <List
      testID="album-grid"
      each={props.photos()}
      keyExtractor={(item) => item.id}
      numColumns={cellLayout().columns}
      estimatedItemSize={cellLayout().height}
      contentStyle={{ padding: space.lg, gap: grid.gap }}
      style={{ flex: 1 }}
    >
      {(item, index) => (
        <AlbumCell
          item={item}
          index={index}
          size={() => cellLayout().size}
          height={() => cellLayout().height}
          onPress={props.onPhotoPress}
          onFocus={props.onFocusPhoto}
        />
      )}
    </List>
  );
}
