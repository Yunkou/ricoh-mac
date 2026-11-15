import { Text, View } from "nsh";
import type { ButtonKind } from "../state/connection";
import { color, focusRing, radius, space, type } from "../theme";

export type { ButtonKind };

export function Button(props: {
  label: string;
  kind: ButtonKind;
  onPress: () => void;
  testID?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const isPrimary = props.kind === "primary";
  const isGhost = props.kind === "ghost";
  return (
    <View
      role="button"
      testID={props.testID}
      accessibilityLabel={props.accessibilityLabel ?? props.label}
      focusable={!props.disabled}
      disabled={props.disabled}
      onPress={props.onPress}
      style={{
        paddingHorizontal: isGhost ? space.sm : space.md,
        paddingVertical: space.sm,
        borderRadius: radius.button,
        backgroundColor: isPrimary ? color.accent : "transparent",
        borderWidth: isGhost ? 0 : 1,
        borderColor: isPrimary ? color.accent : color.border,
        opacity: 1,
      }}
      hoverStyle={{
        backgroundColor: isPrimary ? color.accentHover : color.raised,
      }}
      activeStyle={{
        opacity: 0.88,
      }}
      focusVisibleStyle={focusRing}
      disabledStyle={{
        opacity: 0.45,
        backgroundColor: isPrimary ? color.accent : "transparent",
      }}
    >
      <Text
        style={{
          color: isPrimary ? color.onAccent : isGhost ? color.secondary : color.text,
          fontSize: type.body,
          fontWeight: "600",
        }}
      >
        {props.label}
      </Text>
    </View>
  );
}

export function SettingsMark() {
  return (
    <View
      style={{
        width: 16,
        height: 16,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: color.secondary,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: color.secondary,
        }}
      />
    </View>
  );
}
