import { Text, View } from "nsh";
import { copy } from "../copy";
import type { AppModel } from "../state/app-model";
import { color, font, space, type } from "../theme";
import { Button } from "./button";
import { FadeEnter } from "./fade-enter";
import { Icon } from "./icon";
import { ProfileForm } from "./profile-form";

export function FirstRun(props: { model: AppModel }) {
  const model = props.model;
  return (
    <FadeEnter style={{ flex: 1 }}>
      <View
        testID="first-run"
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: space.xl,
        gap: space.lg,
      }}
    >
      <Icon name="folder-plus" size={36} />
      <Text style={{ fontFamily: font.family, color: color.text, fontSize: type.title, lineHeight: type.lineTitle, fontWeight: font.emphasis }}>
        {copy.chooseLibraryTitle}
      </Text>
      <Text
        style={{
          fontFamily: font.family,
          color: color.secondary,
          fontSize: type.body,
          lineHeight: type.lineBody,
          textAlign: "center",
          maxWidth: 420,
        }}
      >
        {copy.chooseLibraryBody}
      </Text>
      <Button
        label={copy.chooseLibraryAction}
        kind="primary"
        testID="choose-folder-first"
        disabled={model.isBusy()}
        icon="folder-plus"
        onPress={() => void model.chooseFolder()}
      />
      </View>
    </FadeEnter>
  );
}

export function ConnectPanel(props: { model: AppModel }) {
  const model = props.model;
  return (
    <FadeEnter style={{ flex: 1 }}>
      <View
        testID="empty-canvas"
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: space.xl,
        gap: space.lg,
      }}
    >
      <Icon name={emptyIcon(model)} size={36} />
      <Text style={{ fontFamily: font.family, color: color.text, fontSize: type.title, lineHeight: type.lineTitle, fontWeight: font.emphasis }}>
        {emptyTitle(model)}
      </Text>
      {model.wifiSettings().viaUtun ? (
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, maxWidth: 460 }}>
          <Icon name="wifi-alert" size={18} />
          <Text
            testID="utun-hint"
            style={{
              fontFamily: font.family,
              color: color.warning,
              fontSize: type.meta,
              lineHeight: type.lineMeta,
              textAlign: "center",
              flex: 1,
            }}
          >
            {copy.utunHint(model.wifiSettings().viaUtun ?? "")}
          </Text>
        </View>
      ) : null}
      {showConnectionHelp(model) ? (
        <Text
          testID="connection-help"
          style={{
            fontFamily: font.family,
            color: color.secondary,
            fontSize: type.body,
            lineHeight: type.lineBody,
            textAlign: "center",
            maxWidth: 460,
          }}
        >
          {copy.connectionHelp}
        </Text>
      ) : null}
      {model.connection().kind === "need_profile" && !model.listing() ? (
        <ProfileForm model={model} />
      ) : null}
      {showConnectButton(model) ? (
        <Button
          label={copy.connectCamera}
          icon="wifi"
          kind="primary"
          testID="connect-camera"
          disabled={model.isBusy()}
          onPress={() => void model.connectCamera()}
        />
      ) : null}
      </View>
    </FadeEnter>
  );
}

function emptyIcon(model: AppModel): "loader" | "wifi" | "wifi-cog" | "images" | "wifi-x" {
  const state = model.connection();
  if (model.listing() || state.kind === "connecting") {
    return "loader";
  }
  if (state.kind === "need_profile") {
    return "wifi-cog";
  }
  if (state.kind === "connected") {
    return "images";
  }
  if (state.kind === "error") {
    return "wifi-x";
  }
  return "wifi";
}

function emptyTitle(model: AppModel): string {
  const state = model.connection();
  if (model.listing()) {
    return copy.loadingPhotos;
  }
  if (state.kind === "connecting") {
    return copy.connectingStatus;
  }
  if (state.kind === "need_profile") {
    return copy.needProfileStatus;
  }
  if (state.kind === "connected") {
    return copy.noPhotos;
  }
  return copy.connectCamera;
}

function showConnectionHelp(model: AppModel): boolean {
  const kind = model.connection().kind;
  return (kind === "idle" || kind === "error" || kind === "need_profile") && !model.listing();
}

function showConnectButton(model: AppModel): boolean {
  const kind = model.connection().kind;
  return kind !== "connected" && kind !== "connecting" && kind !== "need_profile" && !model.listing();
}
