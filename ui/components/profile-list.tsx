import { Text, View } from "nsh";
import type { ProfileView } from "ricoh-mac/native";
import { copy } from "../copy";
import type { AppModel } from "../state/app-model";
import { color, font, radius, space, type } from "../theme";
import { Button } from "./button";
import { Icon } from "./icon";

export function ProfileList(props: { model: AppModel }) {
  const profiles = props.model.wifiSettings().profiles;
  const activeId = props.model.wifiSettings().profile?.id ?? null;
  if (profiles.length === 0) {
    return null;
  }
  return (
    <View
      testID="profile-list"
      style={{
        width: "100%",
        maxWidth: 460,
        gap: space.sm,
      }}
    >
      <Text
        style={{
          fontFamily: font.family,
          color: color.secondary,
          fontSize: type.meta,
          lineHeight: type.lineMeta,
        }}
      >
        {copy.savedProfiles}
      </Text>
      {profiles.map((profile) => (
        <ProfileRow
          profile={profile}
          active={profile.id === activeId}
          disabled={props.model.isBusy()}
          onConnect={() => void props.model.connectProfile(profile.id)}
        />
      ))}
    </View>
  );
}

function ProfileRow(props: {
  profile: ProfileView;
  active: boolean;
  disabled: boolean;
  onConnect: () => void;
}) {
  const identity = copy.profileIdentity(
    [props.profile.model, props.profile.serial].filter((part): part is string => Boolean(part)),
  );
  return (
    <View
      testID={`profile-${props.profile.id}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        padding: space.md,
        borderRadius: radius.button,
        borderWidth: 1,
        borderColor: props.active ? color.accent : color.border,
        backgroundColor: color.surface,
      }}
    >
      <Icon name={props.active ? "wifi-check" : "wifi"} size={18} />
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <Text
          style={{
            fontFamily: font.family,
            color: color.text,
            fontSize: type.body,
            lineHeight: type.lineBody,
            fontWeight: font.emphasis,
            numberOfLines: 1,
            textOverflow: "ellipsis-middle",
          }}
        >
          {copy.profileSsid(props.profile.ssid)}
        </Text>
        <Text
          style={{
            fontFamily: font.family,
            color: color.tertiary,
            fontSize: type.meta,
            lineHeight: type.lineMeta,
            numberOfLines: 1,
            textOverflow: "ellipsis-middle",
          }}
        >
          {props.active ? `${copy.activeProfile} · ${identity}` : identity}
        </Text>
      </View>
      <Button
        label={copy.connectProfile}
        kind="primary"
        testID={`connect-profile-${props.profile.id}`}
        disabled={props.disabled}
        icon="wifi"
        onPress={props.onConnect}
      />
    </View>
  );
}
