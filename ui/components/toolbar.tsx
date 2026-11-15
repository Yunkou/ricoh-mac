import { Text, View, reduceMotion } from "nsh";
import { copy } from "../copy";
import { selectedCount, selectedIds } from "../state/selection";
import type { AppModel } from "../state/app-model";
import { displayPath } from "../state/connection";
import { transitionMs } from "../lib/motion";
import { color, focusRing, font, motion, space, type } from "../theme";
import { Button } from "./button";
import { Icon } from "./icon";
import { StatusPill } from "./status-pill";

export function Toolbar(props: { model: AppModel }) {
  const model = props.model;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
        backgroundColor: color.surface,
        borderBottomWidth: 1,
        borderColor: color.border,
      }}
    >
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <StatusPill connection={model.connection} />
        {model.libraryFolder() ? (
          <Text
            testID="library-path"
            style={{
              fontFamily: font.family,
              color: color.tertiary,
              fontSize: type.meta,
              lineHeight: type.lineMeta,
              numberOfLines: 1,
              textOverflow: "ellipsis-middle",
            }}
          >
            {displayPath(model.libraryFolder() ?? "")}
          </Text>
        ) : null}
      </View>
      {model.photos().length > 0 ? (
        <Text
          style={{
            fontFamily: font.family,
            color: color.secondary,
            fontSize: type.meta,
            lineHeight: type.lineMeta,
            fontVariant: font.tabularNums,
          }}
          testID="photo-count"
        >
          {copy.photoCount(model.photos().length, selectedCount(model.selected()))}
        </Text>
      ) : null}
      {model.photos().length > 0 ? (
        <>
          <Button
            label={copy.selectAll}
            icon="list-checks"
            kind="ghost"
            testID="select-all"
            disabled={model.isBusy()}
            onPress={model.onSelectAll}
          />
          <Button
            label={copy.clearSelection}
            icon="eraser"
            kind="ghost"
            testID="clear-selection"
            disabled={model.isBusy() || selectedCount(model.selected()) === 0}
            onPress={model.onClearSelection}
          />
          <Button
            label={copy.importSelected(selectedCount(model.selected()))}
            icon="download"
            kind="primary"
            testID="import-selected"
            disabled={model.isBusy() || selectedCount(model.selected()) === 0}
            onPress={() => void model.importPhotos(selectedIds(model.selected()), false)}
          />
          <Button
            label={copy.importAll}
            icon="folder-down"
            kind="secondary"
            testID="import-all"
            disabled={model.isBusy() || model.photos().length === 0}
            onPress={() => void model.importPhotos([], true)}
          />
        </>
      ) : null}
      {model.libraryFolder() && model.connection().kind === "connected" ? (
        <Button
          label={copy.refreshList}
          icon="rotate-cw"
          kind="ghost"
          testID="refresh-list"
          disabled={model.isBusy()}
          onPress={() => void model.refreshList()}
        />
      ) : null}
      {model.wifiSettings().canSwitchBack && model.wifiSettings().previousSsid ? (
        <Button
          label={copy.switchBack}
          icon="arrow-left-right"
          kind="secondary"
          testID="switch-back"
          disabled={model.isBusy()}
          onPress={() => void model.restorePreviousNetwork()}
        />
      ) : null}
      <View
        role="button"
        testID="settings-button"
        accessibilityLabel={copy.settings}
        focusable={true}
        ref={(node) => model.settingsAnchor.set(node)}
        onPress={() => model.settingsOpen.set(!model.settingsOpen())}
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: color.border,
          backgroundColor: color.raised,
          alignItems: "center",
          justifyContent: "center",
          opacity: 1,
          transform: [{ scale: 1 }],
          transitionProperty: "opacity, transform",
          transitionDuration: transitionMs(motion.press),
          transitionTimingFunction: motion.easing,
        }}
        hoverStyle={{ backgroundColor: color.surface }}
        activeStyle={{
          opacity: 0.88,
          transform: reduceMotion() ? [{ scale: 1 }] : [{ scale: 0.96 }],
        }}
        focusVisibleStyle={focusRing}
      >
        <Icon name="settings" size={18} />
      </View>
    </View>
  );
}
