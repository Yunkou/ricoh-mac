import { chillDINGothicStack } from "./assets/fonts";

export const color = {
  bg: "transparent",
  surface: "#1A1917B8",
  raised: "#22211ECC",
  input: "#11111099",
  text: "#F2F0EC",
  secondary: "#A39E96",
  tertiary: "#948F86",
  border: "#FFFFFF1F",
  accent: "#D8A45A",
  accentHover: "#E0B06A",
  onAccent: "#161513",
  success: "#7EA77A",
  warning: "#E09040",
  danger: "#D67A76",
  histogramRed: "#D67A76",
  histogramGreen: "#7EA77A",
  histogramBlue: "#6A8CBA",
  thumb: "#0E0E0DCC",
  overlay: "#00000099",
  segment: "#FFFFFF14",
} as const;

/** A translucent layer over the window vibrancy (`macos={{ backdrop }}`). */
export const panelBackdrop = {
  material: "popover" as const,
  blending: "withinWindow" as const,
  state: "followsWindowActiveState" as const,
};

/** Height of the hidden title bar in `nsh.json`, in points. */
export const titleBarHeight = 52;

export const type = {
  badge: 10,
  meta: 11,
  body: 13,
  emphasis: 15,
  title: 20,
  display: 32,
  lineBadge: 14,
  lineMeta: 16,
  lineBody: 18,
  lineEmphasis: 20,
  lineTitle: 26,
  lineDisplay: 40,
} as const;

export const font = {
  family: chillDINGothicStack,
  regular: "400",
  emphasis: "600",
  tabularNums: "tabular-nums",
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const radius = {
  thumb: 4,
  control: 6,
  button: 8,
  panel: 10,
} as const;

export const compactStarHit = 24;
export const compactStarGap = space.xs;
export const compactControlsGap = 2;
export const compactFlagPadY = 1;

export const grid = {
  padding: 32,
  gap: 8,
  minCell: 136,
  minColumns: 1,
  maxColumns: 8,
  caption: 72,
} as const;

export const motion = {
  press: 120,
  short: 150,
  duration: 180,
  enter: 200,
  overlay: 220,
  exit: 150,
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
  easingCubic: [0.16, 1, 0.3, 1] as const,
} as const;

export const focusRing = {
  outlineWidth: 2,
  outlineColor: color.accent,
  outlineStyle: "solid" as const,
  outlineOffset: 2,
};

export const inputStyle = {
  height: 32,
  paddingHorizontal: space.sm,
  borderRadius: radius.control,
  borderWidth: 1,
  borderColor: color.border,
  color: color.text,
  backgroundColor: color.input,
  fontFamily: font.family,
  fontSize: type.body,
  fontWeight: font.regular,
} as const;
