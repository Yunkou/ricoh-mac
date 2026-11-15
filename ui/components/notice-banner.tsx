import { Text } from "nsh";
import type { Signal } from "nsh";
import type { Banner } from "../state/connection";
import { color, space, type } from "../theme";

export function NoticeBanner(props: {
  notice: Signal<string>;
  banner: Signal<Banner | null>;
}) {
  return (
    <>
      {props.notice() ? (
        <Text
          testID="notice"
          style={{
            color: color.danger,
            fontSize: type.meta,
            paddingHorizontal: space.lg,
            paddingVertical: space.sm,
          }}
        >
          {props.notice()}
        </Text>
      ) : props.banner() ? (
        <Text
          testID="banner"
          style={{
            color: props.banner()?.tone === "danger" ? color.danger : color.text,
            fontSize: type.meta,
            paddingHorizontal: space.lg,
            paddingVertical: space.sm,
          }}
        >
          {props.banner()?.text}
        </Text>
      ) : null}
    </>
  );
}
