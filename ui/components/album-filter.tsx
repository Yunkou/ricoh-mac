import { Text, View, signal, windowSize } from "nsh";
import { copy } from "../copy";
import type { AppModel } from "../state/app-model";
import type { AlbumFilter } from "../state/cull";
import {
  albumChrome,
  filterLabel,
  ratingFilterLabel,
  sameFilter,
} from "../state/photo-layout";
import { color, focusRing, font, radius, space, type } from "../theme";

const flagFilters: Array<{ id: string; label: string; filter: AlbumFilter }> = [
  { id: "all", label: copy.filterAll, filter: { kind: "all" } },
  { id: "picked", label: copy.filterPicked, filter: { kind: "flag", flag: "picked" } },
  { id: "rejected", label: copy.filterRejected, filter: { kind: "flag", flag: "rejected" } },
  { id: "none", label: copy.filterNone, filter: { kind: "flag", flag: "none" } },
];

export function AlbumFilterBar(props: { model: AppModel }) {
  const model = props.model;
  const ratingOpen = signal(false);
  const menuOpen = signal(false);
  if (model.albumPhotos().length === 0) {
    return null;
  }
  const compact = albumChrome(windowSize().width) === "compact";
  const current = model.albumFilter();
  return (
    <View
      testID="album-filter"
      style={{
        flexDirection: "row",
        flexWrap: "nowrap",
        alignItems: "center",
        gap: space.sm,
        paddingHorizontal: space.lg,
        paddingTop: space.sm,
        paddingBottom: space.xs,
        overflow: "visible",
      }}
    >
      {compact ? (
        <View style={{ position: "relative", overflow: "visible" }}>
          <FilterButton
            testID="album-filter-menu"
            label={copy.filterMenuValue(filterLabel(current))}
            active={current.kind !== "all"}
            onPress={() => menuOpen.set(!menuOpen())}
          />
          {menuOpen() ? (
            <FilterMenu
              testID="album-filter-menu-panel"
              current={current}
              onSelect={(filter) => {
                model.setAlbumFilter(filter);
                menuOpen.set(false);
                ratingOpen.set(false);
              }}
              includeFlags={true}
            />
          ) : null}
        </View>
      ) : (
        <>
          <View style={{ flexDirection: "row", flexWrap: "nowrap", alignItems: "center", gap: space.xs }}>
            {flagFilters.map((entry) => (
              <FilterButton
                testID={`album-filter-${entry.id}`}
                label={entry.label}
                active={sameFilter(current, entry.filter)}
                onPress={() => {
                  model.setAlbumFilter(entry.filter);
                  ratingOpen.set(false);
                }}
              />
            ))}
          </View>
          <View style={{ width: 1, height: 16, backgroundColor: color.border }} />
          <View style={{ position: "relative", overflow: "visible" }}>
            <FilterButton
              testID="album-filter-rating"
              label={ratingFilterLabel(current)}
              active={current.kind === "rating"}
              onPress={() => ratingOpen.set(!ratingOpen())}
            />
            {ratingOpen() ? (
              <FilterMenu
                testID="album-filter-rating-menu"
                current={current}
                onSelect={(filter) => {
                  model.setAlbumFilter(filter);
                  ratingOpen.set(false);
                }}
                includeFlags={false}
              />
            ) : null}
          </View>
        </>
      )}
    </View>
  );
}

function FilterMenu(props: {
  testID: string;
  current: AlbumFilter;
  onSelect: (filter: AlbumFilter) => void;
  includeFlags: boolean;
}) {
  return (
    <View
      testID={props.testID}
      style={{
        position: "absolute",
        top: "100%",
        left: 0,
        marginTop: space.xs,
        zIndex: 20,
        minWidth: 160,
        padding: space.xs,
        gap: space.xs,
        backgroundColor: color.raised,
        borderColor: color.border,
        borderWidth: 1,
        borderRadius: radius.panel,
      }}
    >
      {props.includeFlags
        ? flagFilters.map((entry) => (
            <FilterButton
              testID={`album-filter-${entry.id}`}
              label={entry.label}
              active={sameFilter(props.current, entry.filter)}
              onPress={() => props.onSelect(entry.filter)}
            />
          ))
        : null}
      {[0, 1, 2, 3, 4, 5].map((rating) => (
        <FilterButton
          testID={`album-filter-rating-${rating}`}
          label={copy.filterRating(rating)}
          active={sameFilter(props.current, { kind: "rating", rating })}
          onPress={() => props.onSelect({ kind: "rating", rating })}
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
