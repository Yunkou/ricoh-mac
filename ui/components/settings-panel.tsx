import { Overlay, Text, View, createMotion, signal } from "nsh";
import type { Motion, Signal } from "nsh";
import { Input } from "nsh/base";
import { copy } from "../copy";
import { enterFade, exitFade } from "../lib/motion";
import type { AppModel } from "../state/app-model";
import { color, focusRing, inputStyle, motion, radius, space, type } from "../theme";
import { Button } from "./button";
import { Icon, type IconName } from "./icon";

export function SettingsPanel(props: { model: AppModel }) {
  const model = props.model;
  const visible = signal(false);
  const closing = signal(false);
  const panelMotion = createMotion();
  return (
    <>
      {syncSettingsMotion(model.settingsOpen(), visible, closing, panelMotion)}
      {visible() ? settingsOverlay(model, panelMotion) : null}
    </>
  );
}

function syncSettingsMotion(
  open: boolean,
  visible: Signal<boolean>,
  closing: Signal<boolean>,
  panelMotion: Motion,
): null {
  if (open) {
    if (!visible()) {
      visible.set(true);
      closing.set(false);
      void panelMotion.play(enterFade(8, motion.overlay));
    } else if (closing()) {
      closing.set(false);
      void panelMotion.play(enterFade(8, motion.overlay));
    }
    return null;
  }
  if (visible() && !closing()) {
    closing.set(true);
    void panelMotion.play(exitFade(8, motion.exit)).then(({ finished }) => {
      if (!finished || !closing()) {
        return;
      }
      visible.set(false);
      closing.set(false);
      panelMotion.reset();
    });
  }
  return null;
}

function settingsOverlay(model: AppModel, panelMotion: Motion) {
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
        ...panelMotion.style,
      }}
    >
      <SectionLabel icon="settings" text={copy.settings} emphasis />
      <View style={{ gap: space.sm }}>
        <SectionLabel icon="folder" text={copy.settingsLibrary} />
        <Text style={{ color: color.text, fontSize: type.body }} testID="settings-library-path">
          {model.libraryFolder() ? model.libraryFolder() : copy.chooseLibraryTitle}
        </Text>
        <Button
          label={model.libraryFolder() ? copy.changeLibrary : copy.chooseLibraryAction}
          icon="folder-plus"
          kind="secondary"
          testID="choose-folder"
          disabled={model.isBusy()}
          onPress={() => void model.chooseFolder()}
        />
      </View>
      <View style={{ gap: space.sm }}>
        <SectionLabel icon="wifi-cog" text={copy.profileSection} />
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
            icon="save"
            kind="secondary"
            testID="save-profile"
            disabled={model.isBusy()}
            onPress={() => void model.saveProfileEdits()}
          />
          {profile ? (
            <Button
              label={copy.deleteProfile}
              icon="trash"
              kind="ghost"
              testID="delete-profile"
              disabled={model.isBusy()}
              onPress={() => void model.removeProfile()}
            />
          ) : null}
        </View>
        <Button
          label={`${copy.autoSwitchBack}：${model.wifiSettings().autoSwitchBack ? copy.autoSwitchOn : copy.autoSwitchOff}`}
          icon="arrow-left-right"
          kind="ghost"
          testID="auto-switch-back"
          disabled={model.isBusy()}
          onPress={() => void model.toggleAutoSwitchBack()}
        />
      </View>
      <View style={{ gap: space.sm }}>
        <SectionLabel icon="camera" text={copy.settingsCameraUrl} />
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
            icon="save"
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

function SectionLabel(props: { icon: IconName; text: string; emphasis?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Icon name={props.icon} size={16} />
      <Text
        style={{
          color: props.emphasis ? color.text : color.secondary,
          fontSize: props.emphasis ? type.emphasis : type.meta,
          fontWeight: "600",
        }}
      >
        {props.text}
      </Text>
    </View>
  );
}
