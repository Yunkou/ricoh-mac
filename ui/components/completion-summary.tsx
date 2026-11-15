import { Text, View } from "nsh";
import type { Signal } from "nsh";
import { copy } from "../copy";
import type { ImportPhase } from "../state/connection";
import { color, space, type } from "../theme";
import { progressBar } from "./import-progress";

export function CompletionSummary(props: { importPhase: Signal<ImportPhase> }) {
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
      {progressBar(1)}
      <View style={{ gap: space.xs }}>
        <Text testID="import-summary" style={{ color: color.text, fontSize: type.body }}>
          {summaryLabel(props.importPhase())}
        </Text>
        {issueLines(props.importPhase()).map((issue) => (
          <Text
            style={{
              color: issue.status === "conflict" ? color.warning : color.danger,
              fontSize: type.meta,
            }}
          >
            {`${issue.file}：${issue.message || (issue.status === "conflict" ? copy.statusConflict : copy.statusError)}`}
          </Text>
        ))}
      </View>
    </View>
  );
}

function summaryLabel(phase: ImportPhase): string {
  if (phase.kind !== "done") {
    return "";
  }
  return copy.importSummary(phase.imported, phase.skipped, phase.conflicts, phase.errors);
}

function issueLines(phase: ImportPhase): Extract<ImportPhase, { kind: "done" }>["issues"] {
  if (phase.kind !== "done") {
    return [];
  }
  return phase.issues;
}
