import { Text, View } from "nsh";
import { copy } from "../copy";
import type { AppModel } from "../state/app-model";
import { color, space, type } from "../theme";
import { Button } from "./button";
import { ProfileForm } from "./profile-form";

export function FirstRun(props: { model: AppModel }) {
  const model = props.model;
  return (
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
      <Text style={{ color: color.text, fontSize: type.title, lineHeight: type.lineTitle, fontWeight: "600" }}>
        {copy.chooseLibraryTitle}
      </Text>
      <Text
        style={{
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
        onPress={() => void model.chooseFolder()}
      />
    </View>
  );
}

export function ConnectPanel(props: { model: AppModel }) {
  const model = props.model;
  return (
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
      <Text style={{ color: color.text, fontSize: type.title, lineHeight: type.lineTitle, fontWeight: "600" }}>
        {emptyTitle(model)}
      </Text>
      {model.wifiSettings().viaUtun ? (
        <Text
          testID="utun-hint"
          style={{
            color: color.warning,
            fontSize: type.meta,
            lineHeight: type.lineMeta,
            textAlign: "center",
            maxWidth: 460,
          }}
        >
          {copy.utunHint(model.wifiSettings().viaUtun ?? "")}
        </Text>
      ) : null}
      {showConnectionHelp(model) ? (
        <Text
          testID="connection-help"
          style={{
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
          kind="primary"
          testID="connect-camera"
          disabled={model.isBusy()}
          onPress={() => void model.connectCamera()}
        />
      ) : null}
    </View>
  );
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
