import { View, createMotion } from "nsh";
import type { JSX, ViewStyle } from "nsh";
import { enterFade } from "../lib/motion";
import { motion } from "../theme";

/** Plays a short fade-and-rise once when this component is mounted. `createMotion` enter already respects `reduceMotion()`. */
export function FadeEnter(props: {
  children?: JSX.Element;
  distance?: number;
  duration?: number;
  style?: ViewStyle;
}) {
  const enter = createMotion({
    enter: enterFade(props.distance ?? 8, props.duration ?? motion.enter),
  });
  return <View style={[enter.style, props.style]}>{props.children}</View>;
}
