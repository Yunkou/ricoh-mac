import { Text, View, reduceMotion } from "nsh";
import { copy } from "../copy";
import { transitionMs } from "../lib/motion";
import type { MainArea } from "../state/app-model";
import { color, focusRing, font, motion, panelBackdrop, radius, space, type } from "../theme";
import { Icon, type IconName } from "./icon";

export function AreaSwitch(props: {
  area: MainArea;
  onSelect: (route: "devices" | "photos") => void;
}) {
  return (
    <View
      macos={{ backdrop: panelBackdrop }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        padding: 2,
        gap: 2,
        borderRadius: radius.button,
        borderWidth: 1,
        borderColor: color.border,
        backgroundColor: color.raised,
      }}
    >
      <Segment
        testID="area-devices"
        label={copy.areaDevices}
        icon="camera"
        active={props.area === "devices"}
        onPress={() => props.onSelect("devices")}
      />
      <Segment
        testID="area-photos"
        label={copy.areaPhotos}
        icon="images"
        active={props.area === "photos"}
        onPress={() => props.onSelect("photos")}
      />
    </View>
  );
}

function Segment(props: {
  testID: string;
  label: string;
  icon: IconName;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <View
      role="button"
      testID={props.testID}
      accessibilityLabel={props.label}
      accessibilityState={{ selected: props.active }}
      focusable={true}
      onPress={props.onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: space.md,
        paddingVertical: space.xs + 2,
        borderRadius: radius.control,
        backgroundColor: props.active ? color.segment : "transparent",
        opacity: 1,
        transform: [{ scale: 1 }],
        transitionProperty: "opacity, transform, background-color",
        transitionDuration: transitionMs(motion.short),
        transitionTimingFunction: motion.easing,
      }}
      hoverStyle={{
        backgroundColor: props.active ? color.segment : color.surface,
      }}
      activeStyle={{
        opacity: 0.9,
        transform: reduceMotion() ? [{ scale: 1 }] : [{ scale: 0.98 }],
      }}
      focusVisibleStyle={focusRing}
    >
      <Icon name={props.icon} size={14} />
      <Text
        style={{
          fontFamily: font.family,
          color: props.active ? color.text : color.secondary,
          fontSize: type.meta,
          lineHeight: type.lineMeta,
          fontWeight: font.emphasis,
        }}
      >
        {props.label}
      </Text>
    </View>
  );
}
