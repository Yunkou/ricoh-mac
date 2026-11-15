import { Text, View } from "nsh";
import { copy } from "../copy";
import type { AppModel } from "../state/app-model";
import type { AlbumFilter } from "../state/cull";
import { color, focusRing, font, radius, space, type } from "../theme";

const flagFilters: Array<{ id: string; label: string; filter: AlbumFilter }> = [
  { id: "all", label: copy.filterAll, filter: { kind: "all" } },
  { id: "picked", label: copy.filterPicked, filter: { kind: "flag", flag: "picked" } },
  { id: "rejected", label: copy.filterRejected, filter: { kind: "flag", flag: "rejected" } },
  { id: "none", label: copy.filterNone, filter: { kind: "flag", flag: "none" } },
];

export function AlbumFilterBar(props: { model: AppModel }) {
  const model = props.model;
  if (model.albumPhotos().length === 0) {
    return null;
  }
  return (
    <View
      testID="album-filter"
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        gap: space.xs,
        paddingHorizontal: space.lg,
        paddingTop: space.sm,
      }}
    >
      {flagFilters.map((entry) => (
        <FilterButton
          testID={`album-filter-${entry.id}`}
          label={entry.label}
          active={sameFilter(model.albumFilter(), entry.filter)}
          onPress={() => model.setAlbumFilter(entry.filter)}
        />
      ))}
      <View style={{ width: 1, height: 16, backgroundColor: color.border, marginHorizontal: space.xs }} />
      {[0, 1, 2, 3, 4, 5].map((rating) => (
        <FilterButton
          testID={`album-filter-rating-${rating}`}
          label={copy.filterRating(rating)}
          active={sameFilter(model.albumFilter(), { kind: "rating", rating })}
          onPress={() => model.setAlbumFilter({ kind: "rating", rating })}
        />
      ))}
    </View>
  );
}

function FilterButton(props: { testID: string; label: string; active: boolean; onPress: () => void }) {
  return (
    <View
      role="button"
      testID={props.testID}
      accessibilityLabel={props.label}
      focusable={true}
      onPress={props.onPress}
      style={{
        paddingHorizontal: space.sm,
        paddingVertical: 4,
        borderRadius: radius.control,
        backgroundColor: props.active ? color.segment : "transparent",
        borderWidth: 1,
        borderColor: props.active ? color.accent : color.border,
      }}
      hoverStyle={{ backgroundColor: color.segment }}
      focusVisibleStyle={focusRing}
    >
      <Text
        style={{
          fontFamily: font.family,
          color: props.active ? color.text : color.secondary,
          fontSize: type.meta,
          lineHeight: type.lineMeta,
        }}
      >
        {props.label}
      </Text>
    </View>
  );
}

function sameFilter(left: AlbumFilter, right: AlbumFilter): boolean {
  if (left.kind === "all" && right.kind === "all") {
    return true;
  }
  if (left.kind === "flag" && right.kind === "flag") {
    return left.flag === right.flag;
  }
  if (left.kind === "rating" && right.kind === "rating") {
    return left.rating === right.rating;
  }
  return false;
}

