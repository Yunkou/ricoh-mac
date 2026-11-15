import { Text, View, reduceMotion, windowSize } from "nsh";
import { copy } from "../copy";
import { transitionMs } from "../lib/motion";
import type { AppModel } from "../state/app-model";
import { color, focusRing, font, motion, panelBackdrop, radius, space, type } from "../theme";
import { Icon, type IconName } from "./icon";

export function HomeScreen(props: { model: AppModel }) {
  const columns = windowSize().width >= 720;
  return (
    <View
      testID="home-screen"
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: space.xl,
      }}
    >
      <View
        style={{
          flexDirection: columns ? "row" : "column",
          gap: space.lg,
          width: "100%",
          maxWidth: 760,
        }}
      >
        <FeatureCard
          testID="open-photos"
          icon="images"
          title={copy.homePhotosTitle}
          body={copy.homePhotosBody}
          onPress={() => void props.model.openPhotos()}
        />
        <FeatureCard
          testID="open-devices"
          icon="camera"
          title={copy.homeDevicesTitle}
          body={copy.homeDevicesBody}
          onPress={() => props.model.openDevices()}
        />
      </View>
    </View>
  );
}

export function FeatureCard(props: {
  testID: string;
  icon: IconName;
  title: string;
  body: string;
  onPress: () => void;
}) {
  return (
    <View
      role="button"
      testID={props.testID}
      accessibilityLabel={props.title}
      focusable={true}
      onPress={props.onPress}
      macos={{ backdrop: panelBackdrop }}
      style={{
        flex: 1,
        minWidth: 240,
        gap: space.md,
        padding: space.xl,
        borderRadius: radius.panel,
        borderWidth: 1,
        borderColor: color.border,
        backgroundColor: color.raised,
        cursor: "pointer",
        opacity: 1,
        transform: [{ scale: 1 }],
        transitionProperty: "opacity, transform, border-color, background-color",
        transitionDuration: transitionMs(motion.short),
        transitionTimingFunction: motion.easing,
      }}
      hoverStyle={{
        borderColor: color.accent,
        backgroundColor: color.surface,
      }}
      activeStyle={{
        opacity: 0.92,
        transform: reduceMotion() ? [{ scale: 1 }] : [{ scale: 0.99 }],
      }}
      focusVisibleStyle={focusRing}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space.sm,
        }}
      >
        <Text
          style={{
            fontFamily: font.family,
            color: color.text,
            fontSize: type.display,
            lineHeight: type.lineDisplay,
            fontWeight: font.emphasis,
          }}
        >
          {props.title}
        </Text>
        <Icon name={props.icon} size={28} />
      </View>
      <Text
        style={{
          fontFamily: font.family,
          color: color.secondary,
          fontSize: type.body,
          lineHeight: type.lineBody,
        }}
      >
        {props.body}
      </Text>
    </View>
  );
}
