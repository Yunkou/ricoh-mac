import { Text, View, reduceMotion } from "nsh";
import { transitionMs } from "../lib/motion";
import type { ButtonKind } from "../state/connection";
import { color, focusRing, motion, radius, space, type } from "../theme";
import { Icon, onAccentIcon, type IconName } from "./icon";

export type { ButtonKind };

export function Button(props: {
  label: string;
  kind: ButtonKind;
  onPress: () => void;
  testID?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
  icon?: IconName;
}) {
  const isPrimary = props.kind === "primary";
  const isGhost = props.kind === "ghost";
  const iconName = props.icon
    ? (isPrimary ? (onAccentIcon[props.icon] ?? props.icon) : props.icon)
    : undefined;
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
        transform: [{ scale: 1 }],
        transitionProperty: "opacity, transform",
        transitionDuration: transitionMs(motion.press),
        transitionTimingFunction: motion.easing,
      }}
      hoverStyle={{
        backgroundColor: isPrimary ? color.accentHover : color.raised,
      }}
      activeStyle={{
        opacity: 0.88,
        transform: reduceMotion() ? [{ scale: 1 }] : [{ scale: 0.96 }],
      }}
      focusVisibleStyle={focusRing}
      disabledStyle={{
        opacity: 0.45,
        backgroundColor: isPrimary ? color.accent : "transparent",
        transform: [{ scale: 1 }],
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {iconName ? <Icon name={iconName} size={16} /> : null}
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
    </View>
  );
}
