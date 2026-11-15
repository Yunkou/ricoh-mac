import { Overlay, Text, View } from "nsh";
import { Input } from "nsh/base";
import { copy } from "../copy";
import type { AppModel } from "../state/app-model";
import { color, focusRing, inputStyle, radius, space, type } from "../theme";
import { Button } from "./button";

export function SettingsPanel(props: { model: AppModel }) {
  const model = props.model;
  return (
    <>
      {model.settingsOpen() ? settingsOverlay(model) : null}
    </>
  );
}

function settingsOverlay(model: AppModel) {
  const profile = model.wifiSettings().profile;
  return (
    <Overlay
      testID="settings-panel"
      anchor={model.settingsAnchor()}
      placement="bottom"
      align="end"
      offset={8}
      margin={12}
      onPressOutside={() => model.settingsOpen.set(false)}
      onCancel={() => model.settingsOpen.set(false)}
      style={{
        width: 360,
        backgroundColor: color.raised,
        borderColor: color.border,
        borderWidth: 1,
        borderRadius: radius.panel,
        padding: space.lg,
        gap: space.md,
        boxShadow: [{ x: 0, y: 8, blur: 24, color: color.overlay }],
      }}
    >
      <Text style={{ color: color.text, fontSize: type.emphasis, fontWeight: "600" }}>{copy.settings}</Text>
      <View style={{ gap: space.sm }}>
        <Text style={{ color: color.secondary, fontSize: type.meta }}>{copy.settingsLibrary}</Text>
        <Text style={{ color: color.text, fontSize: type.body }} testID="settings-library-path">
          {model.libraryFolder() ? model.libraryFolder() : copy.chooseLibraryTitle}
        </Text>
        <Button
          label={model.libraryFolder() ? copy.changeLibrary : copy.chooseLibraryAction}
          kind="secondary"
          testID="choose-folder"
          disabled={model.isBusy()}
          onPress={() => void model.chooseFolder()}
        />
      </View>
      <View style={{ gap: space.sm }}>
        <Text style={{ color: color.secondary, fontSize: type.meta }}>{copy.profileSection}</Text>
        {profile ? (
          <>
            <Text testID="profile-identity" style={{ color: color.text, fontSize: type.body }}>
              {copy.profileIdentity(
                [profile.model, profile.serial, profile.firmware].filter((part): part is string => Boolean(part)),
              )}
            </Text>
            <Text testID="profile-ssid" style={{ color: color.secondary, fontSize: type.meta }}>
              {copy.profileSsid(profile.ssid)}
            </Text>
          </>
        ) : (
          <Text testID="profile-empty" style={{ color: color.secondary, fontSize: type.meta }}>
            {copy.noProfile}
          </Text>
        )}
        <Text style={{ color: color.tertiary, fontSize: type.meta }}>{copy.editProfileHelp}</Text>
        <Input
          value={model.ssidDraft()}
          onChange={(event) => model.ssidDraft.set(event.value)}
          placeholder={copy.ssidPlaceholder}
          testID="settings-ssid"
          autoCapitalize="none"
          autoCorrect={false}
          style={inputStyle}
          focusVisibleStyle={focusRing}
        />
        <Input
          value={model.passwordDraft()}
          onChange={(event) => model.passwordDraft.set(event.value)}
          placeholder={copy.passwordPlaceholder}
          testID="settings-password"
          masked={true}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          style={inputStyle}
          focusVisibleStyle={focusRing}
        />
        <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
          <Button
            label={copy.saveProfile}
            kind="secondary"
            testID="save-profile"
            disabled={model.isBusy()}
            onPress={() => void model.saveProfileEdits()}
          />
          {profile ? (
            <Button
              label={copy.deleteProfile}
              kind="ghost"
              testID="delete-profile"
              disabled={model.isBusy()}
              onPress={() => void model.removeProfile()}
            />
          ) : null}
        </View>
        <Button
          label={`${copy.autoSwitchBack}：${model.wifiSettings().autoSwitchBack ? copy.autoSwitchOn : copy.autoSwitchOff}`}
          kind="ghost"
          testID="auto-switch-back"
          disabled={model.isBusy()}
          onPress={() => void model.toggleAutoSwitchBack()}
        />
      </View>
      <View style={{ gap: space.sm }}>
        <Text style={{ color: color.secondary, fontSize: type.meta }}>{copy.settingsCameraUrl}</Text>
        <Text style={{ color: color.tertiary, fontSize: type.meta }}>{copy.settingsCameraUrlHelp}</Text>
        <Input
          value={model.cameraUrl()}
          onChange={(event) => model.cameraUrl.set(event.value)}
          testID="camera-url"
          style={inputStyle}
          focusVisibleStyle={focusRing}
        />
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Button
            label={copy.saveUrl}
            kind="secondary"
            testID="save-url"
            disabled={model.isBusy()}
            onPress={() => void model.saveCameraUrl()}
          />
          <Button
            label={copy.resetUrl}
            kind="ghost"
            testID="reset-url"
            disabled={model.isBusy()}
            onPress={() => void model.resetCameraUrl()}
          />
        </View>
      </View>
    </Overlay>
  );
}
