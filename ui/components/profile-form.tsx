import { Text, View } from "nsh";
import { Input } from "nsh/base";
import { copy } from "../copy";
import type { AppModel } from "../state/app-model";
import { color, focusRing, font, inputStyle, space, type } from "../theme";
import { Button } from "./button";

export function ProfileForm(props: { model: AppModel }) {
  const model = props.model;
  return (
    <View testID="wifi-profile-form" style={{ gap: space.sm, width: 320, maxWidth: "100%" }}>
      {profileMessage(model) ? (
        <Text testID="profile-prompt" style={{ fontFamily: font.family, color: color.text, fontSize: type.body, lineHeight: type.lineBody }}>
          {profileMessage(model)}
        </Text>
      ) : null}
      {alreadyOnCamera(model) ? (
        <Text testID="password-only-hint" style={{ fontFamily: font.family, color: color.secondary, fontSize: type.meta }}>
          {copy.passwordOnlyHint}
        </Text>
      ) : (
        <Text style={{ fontFamily: font.family, color: color.tertiary, fontSize: type.meta }}>{copy.locationHelp}</Text>
      )}
      <Text style={{ fontFamily: font.family, color: color.secondary, fontSize: type.meta }}>{copy.ssidLabel}</Text>
      <Input
        value={model.ssidDraft()}
        onChange={(event) => model.ssidDraft.set(event.value)}
        placeholder={copy.ssidPlaceholder}
        testID="wifi-ssid"
        autoCapitalize="none"
        autoCorrect={false}
        style={inputStyle}
        focusVisibleStyle={focusRing}
      />
      <Text style={{ fontFamily: font.family, color: color.secondary, fontSize: type.meta }}>{copy.passwordLabel}</Text>
      <Input
        value={model.passwordDraft()}
        onChange={(event) => model.passwordDraft.set(event.value)}
        placeholder={copy.passwordPlaceholder}
        testID="wifi-password"
        masked={true}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        style={inputStyle}
        focusVisibleStyle={focusRing}
      />
      <Button
        label={copy.saveCameraWifi}
        icon="wifi"
        kind="primary"
        testID="save-and-connect"
        disabled={model.isBusy()}
        onPress={() => void model.saveAndConnect()}
      />
    </View>
  );
}

function alreadyOnCamera(model: AppModel): boolean {
  const state = model.connection();
  return state.kind === "need_profile" && state.alreadyOnCamera;
}

function profileMessage(model: AppModel): string {
  const state = model.connection();
  return state.kind === "need_profile" ? state.message : "";
}
