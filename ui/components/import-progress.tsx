import { Text, View } from "nsh";
import type { Signal } from "nsh";
import { copy } from "../copy";
import { transitionStyle } from "../lib/motion";
import type { ImportPhase } from "../state/connection";
import { color, font, motion, space, type } from "../theme";
import { Icon } from "./icon";

export function ImportProgress(props: { importPhase: Signal<ImportPhase> }) {
  return (
    <View
      style={{
        paddingHorizontal: space.lg,
        paddingVertical: space.sm,
        gap: space.sm,
        borderBottomWidth: 1,
        borderColor: color.border,
        backgroundColor: color.surface,
      }}
    >
      {progressBar(runningRatio(props.importPhase()))}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icon name="download" size={16} />
        <Text
          testID="progress-text"
          style={{
            fontFamily: font.family,
            color: color.secondary,
            fontSize: type.meta,
            flex: 1,
            numberOfLines: 1,
            textOverflow: "ellipsis-middle",
            fontVariant: font.tabularNums,
          }}
        >
          {runningLabel(props.importPhase())}
        </Text>
      </View>
    </View>
  );
}

export function progressBar(ratio: number) {
  return (
    <View
      testID="progress-bar"
      style={{
        height: 4,
        borderRadius: 2,
        backgroundColor: color.border,
        overflow: "hidden",
      }}
    >
      <View
        testID="progress-fill"
        style={{
          height: 4,
          width: "100%",
          backgroundColor: color.accent,
          transformOrigin: "0% 50%",
          transform: [{ scaleX: ratio }],
          ...transitionStyle("transform", motion.duration),
        }}
      />
    </View>
  );
}

function runningRatio(phase: ImportPhase): number {
  if (phase.kind !== "running" || phase.total <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, phase.current / phase.total));
}

function runningLabel(phase: ImportPhase): string {
  if (phase.kind !== "running") {
    return "";
  }
  if (phase.retrying) {
    return copy.retrying(phase.file, phase.current, phase.total);
  }
  return copy.importing(phase.file, phase.current, phase.total);
}
