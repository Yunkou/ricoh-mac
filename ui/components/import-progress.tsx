import { Text, View } from "nsh";
import type { Signal } from "nsh";
import { copy } from "../copy";
import type { ImportPhase } from "../state/connection";
import { color, space, type } from "../theme";

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
      <Text testID="progress-text" style={{ color: color.secondary, fontSize: type.meta }}>
        {runningLabel(props.importPhase())}
      </Text>
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
          width: `${Math.round(ratio * 100)}%`,
          backgroundColor: color.accent,
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
  return copy.importing(phase.file, phase.current, phase.total);
}
