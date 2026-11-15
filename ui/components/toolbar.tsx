import { Text, View, reduceMotion } from "nsh";
import { titleBar } from "nsh/desktop";
import { copy } from "../copy";
import { selectedCount, selectedIds } from "../state/selection";
import type { AppModel } from "../state/app-model";
import { displayPath } from "../state/connection";
import { transitionMs } from "../lib/motion";
import { color, focusRing, font, motion, panelBackdrop, space, titleBarHeight, type } from "../theme";
import { AreaSwitch } from "./area-switch";
import { Button } from "./button";
import { Icon } from "./icon";
import { StatusPill } from "./status-pill";

export function HomeToolbar(props: { model: AppModel }) {
  return (
    <ToolbarFrame>
      <View style={{ flex: 1 }} />
      <SettingsButton model={props.model} />
    </ToolbarFrame>
  );
}

export function DevicesToolbar(props: { model: AppModel }) {
  const model = props.model;
  return (
    <ToolbarFrame>
      <Navigation model={props.model} area="devices" />
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <StatusPill connection={model.connection} />
        <LibraryPath model={model} />
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
      <SettingsButton model={model} />
    </ToolbarFrame>
  );
}

export function PhotosToolbar(props: { model: AppModel }) {
  const model = props.model;
  return (
    <ToolbarFrame>
      <Navigation model={props.model} area="photos" />
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <LibraryPath model={model} />
      </View>
      {model.albumPhotos().length > 0 ? (
        <Text
          style={{
            fontFamily: font.family,
            color: color.secondary,
            fontSize: type.meta,
            lineHeight: type.lineMeta,
            fontVariant: font.tabularNums,
          }}
          testID="album-count"
        >
          {copy.albumCount(model.albumPhotos().length)}
        </Text>
      ) : null}
      {model.libraryFolder() ? (
        <Button
          label={copy.refreshAlbum}
          icon="rotate-cw"
          kind="ghost"
          testID="refresh-album"
          disabled={model.isBusy() || model.albumListing()}
          onPress={() => void model.loadAlbum()}
        />
      ) : null}
      <SettingsButton model={model} />
    </ToolbarFrame>
  );
}

export function PhotoToolbar(props: { model: AppModel }) {
  const model = props.model;
  return (
    <ToolbarFrame>
      <Button
        label={copy.backToAlbum}
        kind="ghost"
        testID="photo-back"
        onPress={() => model.closePhoto()}
      />
      <AreaSwitch
        area="photos"
        onSelect={(next) => {
          if (next === "devices") {
            model.openDevices();
            return;
          }
          model.closePhoto();
        }}
      />
      <Text
        testID="viewer-name"
        style={{
          fontFamily: font.family,
          color: color.text,
          fontSize: type.emphasis,
          lineHeight: type.lineEmphasis,
          fontWeight: font.emphasis,
          flex: 1,
          numberOfLines: 1,
          textOverflow: "ellipsis-middle",
          minWidth: 0,
        }}
      >
        {currentFileName(model)}
      </Text>
      <SettingsButton model={model} />
    </ToolbarFrame>
  );
}

function currentFileName(model: AppModel): string {
  const id = model.viewingId();
  if (!id) {
    return "";
  }
  return model.albumPhotos().find((photo) => photo.id === id)?.file ?? id;
}

function chromeInsets() {
  const bar = titleBar();
  return {
    height: bar.height > 0 ? bar.height : titleBarHeight,
    left: bar.left > 0 ? bar.left : space.lg,
    right: bar.right > 0 ? bar.right + space.lg : space.lg,
  };
}

function ToolbarFrame(props: { children?: import("nsh").JSX.Element }) {
  const inset = chromeInsets();
  return (
    <View
      testID="window-chrome"
      desktop={{ windowDrag: true }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        minHeight: inset.height,
        paddingLeft: inset.left,
        paddingRight: inset.right,
        paddingVertical: space.sm,
        backgroundColor: "transparent",
      }}
    >
      {props.children}
    </View>
  );
}

function Navigation(props: { model: AppModel; area: "devices" | "photos" }) {
  return (
    <>
      <Button
        label={copy.backHome}
        kind="ghost"
        testID="back-home"
        onPress={() => props.model.goHome()}
      />
      <AreaSwitch
        area={props.area}
        onSelect={(next) => {
          if (next === "devices") {
            props.model.openDevices();
            return;
          }
          void props.model.openPhotos();
        }}
      />
    </>
  );
}

function LibraryPath(props: { model: AppModel }) {
  const path = props.model.libraryFolder();
  if (!path) {
    return null;
  }
  return (
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
      {displayPath(path)}
    </Text>
  );
}

function SettingsButton(props: { model: AppModel }) {
  const model = props.model;
  return (
    <View
      role="button"
      testID="settings-button"
      accessibilityLabel={copy.settings}
      focusable={true}
      ref={(node) => model.settingsAnchor.set(node)}
      onPress={() => model.settingsOpen.set(!model.settingsOpen())}
      macos={{ backdrop: panelBackdrop }}
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
  );
}
