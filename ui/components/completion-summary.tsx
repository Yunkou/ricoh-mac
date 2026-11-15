import { Text, View } from "nsh";
import type { Signal } from "nsh";
import { copy } from "../copy";
import type { ImportPhase } from "../state/connection";
import { color, font, space, type } from "../theme";
import { FadeEnter } from "./fade-enter";
import { Icon, type IconName } from "./icon";
import { progressBar } from "./import-progress";

export function CompletionSummary(props: { importPhase: Signal<ImportPhase> }) {
  return (
    <FadeEnter>
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Icon name={summaryIcon(props.importPhase())} size={16} />
            <Text
              testID="import-summary"
              style={{ fontFamily: font.family, color: color.text, fontSize: type.body, flex: 1, fontVariant: font.tabularNums }}
            >
              {summaryLabel(props.importPhase())}
            </Text>
          </View>
          {issueLines(props.importPhase()).map((issue) => (
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
              <Icon name={issue.status === "conflict" ? "circle-alert" : "circle-x"} size={14} />
              <Text
                style={{
                  fontFamily: font.family,
                  color: issue.status === "conflict" ? color.warning : color.danger,
                  fontSize: type.meta,
                  flex: 1,
                  numberOfLines: 1,
                  textOverflow: "ellipsis-middle",
                }}
              >
                {`${issue.file}：${issue.message || (issue.status === "conflict" ? copy.statusConflict : copy.statusError)}`}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </FadeEnter>
  );
}

function summaryIcon(phase: ImportPhase): IconName {
  if (phase.kind === "done" && (phase.errors > 0 || phase.conflicts > 0)) {
    return "circle-alert";
  }
  return "circle-check";
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
