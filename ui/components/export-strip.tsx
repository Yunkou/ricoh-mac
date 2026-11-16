import { Text, View } from "nsh";
import type { Signal } from "nsh";
import { copy } from "../copy";
import type { ExportPhase } from "../state/app-model";
import { color, font, space, type } from "../theme";
import { Icon } from "./icon";
import { progressBar } from "./import-progress";

export function ExportStrip(props: {
  phase: Signal<ExportPhase>;
  onOpenFolder: () => void;
}) {
  return (
    <>
      {props.phase().kind === "picking" ? (
        <View
          testID="export-strip"
          style={{
            paddingHorizontal: space.lg,
            paddingVertical: space.sm,
            borderBottomWidth: 1,
            borderColor: color.border,
            backgroundColor: color.surface,
          }}
        >
          <Text
            testID="export-progress-text"
            style={{
              fontFamily: font.family,
              color: color.secondary,
              fontSize: type.meta,
            }}
          >
            {copy.exportPicking}
          </Text>
        </View>
      ) : props.phase().kind === "running" ? (
        <RunningStrip phase={props.phase() as Extract<ExportPhase, { kind: "running" }>} />
      ) : props.phase().kind === "done" ? (
        <DoneStrip
          phase={props.phase() as Extract<ExportPhase, { kind: "done" }>}
          onOpenFolder={props.onOpenFolder}
        />
      ) : null}
    </>
  );
}

function RunningStrip(props: { phase: Extract<ExportPhase, { kind: "running" }> }) {
  const phase = props.phase;
  return (
    <View
      testID="export-strip"
      style={{
        paddingHorizontal: space.lg,
        paddingVertical: space.sm,
        gap: space.sm,
        borderBottomWidth: 1,
        borderColor: color.border,
        backgroundColor: color.surface,
      }}
    >
      {progressBar(runningRatio(phase))}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icon name="folder-down" size={16} />
        <Text
          testID="export-progress-text"
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
          {copy.exporting(phase.file, phase.current, phase.total)}
        </Text>
      </View>
    </View>
  );
}

function runningRatio(phase: Extract<ExportPhase, { kind: "running" }>): number {
  return phase.total > 0 ? Math.max(0, Math.min(1, phase.current / phase.total)) : 0;
}

function DoneStrip(props: {
  phase: Extract<ExportPhase, { kind: "done" }>;
  onOpenFolder: () => void;
}) {
  const issues = props.phase.items.filter((item) => item.status !== "exported");
  return (
    <View
      testID="export-strip"
      style={{
        paddingHorizontal: space.lg,
        paddingVertical: space.sm,
        gap: space.sm,
        borderBottomWidth: 1,
        borderColor: color.border,
        backgroundColor: color.surface,
      }}
    >
      <Text
        testID="export-summary"
        style={{
          fontFamily: font.family,
          color: color.text,
          fontSize: type.body,
        }}
      >
        {copy.exportSummary(props.phase.exported, props.phase.failed)}
      </Text>
      <Text
        testID="export-open-folder"
        onPress={props.onOpenFolder}
        style={{
          fontFamily: font.family,
          color: color.secondary,
          fontSize: type.body,
        }}
      >
        {copy.exportOpenFolder}
      </Text>
      {issues.map((issue) => (
        <Text
          testID={`export-issue-${issue.file}`}
          style={{
            fontFamily: font.family,
            color: color.danger,
            fontSize: type.meta,
          }}
        >
          {`${issue.file}：${issue.message}`}
        </Text>
      ))}
    </View>
  );
}
