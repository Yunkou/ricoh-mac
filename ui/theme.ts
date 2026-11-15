export const color = {
  bg: "#111110",
  surface: "#1A1917",
  raised: "#22211E",
  text: "#F2F0EC",
  secondary: "#A39E96",
  tertiary: "#948F86",
  border: "#2E2C28",
  accent: "#D8A45A",
  accentHover: "#E0B06A",
  onAccent: "#161513",
  success: "#7EA77A",
  warning: "#E09040",
  danger: "#D67A76",
  thumb: "#0E0E0D",
  overlay: "#00000099",
} as const;

export const type = {
  meta: 11,
  body: 13,
  emphasis: 15,
  title: 20,
  lineMeta: 16,
  lineBody: 18,
  lineEmphasis: 20,
  lineTitle: 26,
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

export const grid = {
  padding: 32,
  gap: 8,
  minCell: 136,
  minColumns: 1,
  maxColumns: 8,
  caption: 22,
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
  backgroundColor: color.bg,
  fontSize: type.body,
} as const;
