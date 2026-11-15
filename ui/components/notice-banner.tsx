import { Text } from "nsh";
import type { Signal } from "nsh";
import type { Banner } from "../state/connection";
import { color, font, motion, space, type } from "../theme";
import { FadeEnter } from "./fade-enter";

export function NoticeBanner(props: {
  notice: Signal<string>;
  banner: Signal<Banner | null>;
}) {
  return (
    <>
      {props.notice() ? (
        <FadeEnter distance={0} duration={motion.short}>
          <Text
            testID="notice"
            style={{
              fontFamily: font.family,
              color: color.danger,
              fontSize: type.meta,
              paddingHorizontal: space.lg,
              paddingVertical: space.sm,
            }}
          >
            {props.notice()}
          </Text>
        </FadeEnter>
      ) : props.banner() ? (
        <FadeEnter distance={0} duration={motion.short}>
          <Text
            testID="banner"
            style={{
              fontFamily: font.family,
              color: props.banner()?.tone === "danger" ? color.danger : color.text,
              fontSize: type.meta,
              paddingHorizontal: space.lg,
              paddingVertical: space.sm,
            }}
          >
            {props.banner()?.text}
          </Text>
        </FadeEnter>
      ) : null}
    </>
  );
}
