import { expect, test } from "nsh/test";
import { enterFade, exitFade, transitionStyle } from "./motion";
import { motion } from "../theme";

test("enterFade and exitFade only animate opacity and translateY", () => {
  const enter = enterFade(8, motion.enter);
  const exit = exitFade(8, motion.exit);
  expect(enter.keyframes).toEqual({ opacity: [0, 1], translateY: [8, 0] });
  expect(exit.keyframes).toEqual({ opacity: [1, 0], translateY: [0, 8] });
  expect(enter.duration).toBe(motion.enter);
  expect(exit.duration).toBe(motion.exit);
  expect(enter.easing).toEqual([0.16, 1, 0.3, 1]);
  expect(exit.easing).toEqual([0.16, 1, 0.3, 1]);
  expect("scale" in (enter.keyframes ?? {})).toBe(false);
  expect("width" in (enter.keyframes ?? {})).toBe(false);
});

test("transitionStyle uses the theme easing and names a single CSS property", () => {
  const style = transitionStyle("transform", motion.duration);
  expect(style.transitionProperty).toBe("transform");
  expect(style.transitionTimingFunction).toBe(motion.easing);
  expect(typeof style.transitionDuration).toBe("number");
});
