import { reduceMotion } from "nsh";
import type { MotionSpec } from "nsh";
import { motion } from "../theme";

/** Duration in milliseconds, or 0 when the user asked for less motion. */
export function transitionMs(duration: number): number {
  return reduceMotion() ? 0 : duration;
}

export function transitionStyle(property: string, duration: number = motion.duration) {
  return {
    transitionProperty: property,
    transitionDuration: transitionMs(duration),
    transitionTimingFunction: motion.easing,
  };
}

export function enterFade(distanceY: number = 8, duration: number = motion.enter): MotionSpec {
  return {
    keyframes: {
      opacity: [0, 1],
      translateY: [distanceY, 0],
    },
    duration,
    easing: [...motion.easingCubic],
  };
}

export function exitFade(distanceY: number = 8, duration: number = motion.exit): MotionSpec {
  return {
    keyframes: {
      opacity: [1, 0],
      translateY: [0, distanceY],
    },
    duration,
    easing: [...motion.easingCubic],
  };
}
