import { Text, View } from "nsh";
import type { Signal } from "nsh";
import { copy } from "../copy";
import type { BatchMarksPhase } from "../state/app-model";
import { selectedCount, type SelectionMap } from "../state/selection";
import { color, font, space, type } from "../theme";
import { Button } from "./button";
import { FlagButton, StarButton } from "./cull-controls";
import { progressBar } from "./import-progress";

export function BatchMarksStrip(props: {
  selected: Signal<SelectionMap>;
  phase: Signal<BatchMarksPhase>;
  saving: () => boolean;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onRate: (rating: number) => void;
  onFlag: (flag: "none" | "picked" | "rejected") => void;
}) {
  return (
    <>
      {selectedCount(props.selected()) > 0 || props.phase().kind !== "idle" ? (
        <View
          testID="batch-marks-strip"
          style={{
            paddingHorizontal: space.lg,
            paddingVertical: space.sm,
            gap: space.sm,
            borderBottomWidth: 1,
            borderColor: color.border,
            backgroundColor: color.surface,
          }}
        >
          {selectedCount(props.selected()) > 0 ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" }}>
              <Text
                testID="album-selected-count"
                style={{
                  fontFamily: font.family,
                  color: color.text,
                  fontSize: type.body,
                  fontVariant: font.tabularNums,
                }}
              >
                {copy.albumSelectedCount(selectedCount(props.selected()))}
              </Text>
              <Button
                label={copy.albumClearSelection}
                kind="ghost"
                testID="album-clear-selection"
                disabled={props.saving()}
                onPress={props.onClearSelection}
              />
              <StarRow disabled={props.saving()} onRate={props.onRate} />
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.xs,
                  opacity: props.saving() ? 0.45 : 1,
                  pointerEvents: props.saving() ? "none" : "auto",
                }}
              >
                <FlagButton
                  testID="batch-marks-flag-picked"
                  label={copy.flagPicked}
                  active={false}
                  tone="picked"
                  compact={false}
                  onPress={() => props.onFlag("picked")}
                />
                <FlagButton
                  testID="batch-marks-flag-rejected"
                  label={copy.flagRejected}
                  active={false}
                  tone="rejected"
                  compact={false}
                  onPress={() => props.onFlag("rejected")}
                />
                <FlagButton
                  testID="batch-marks-flag-none"
                  label={copy.clearFlag}
                  active={false}
                  tone="none"
                  compact={false}
                  onPress={() => props.onFlag("none")}
                />
              </View>
            </View>
          ) : null}
          {props.phase().kind === "running" ? (
            <RunningStatus phase={props.phase() as Extract<BatchMarksPhase, { kind: "running" }>} />
          ) : props.phase().kind === "done" ? (
            <DoneStatus phase={props.phase() as Extract<BatchMarksPhase, { kind: "done" }>} />
          ) : null}
        </View>
      ) : null}
    </>
  );
}

function StarRow(props: { disabled: boolean; onRate: (rating: number) => void }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 2,
        opacity: props.disabled ? 0.45 : 1,
        pointerEvents: props.disabled ? "none" : "auto",
      }}
    >
      {[1, 2, 3, 4, 5].map((value) => (
        <StarButton
          testID={`batch-marks-rating-${value}`}
          label={copy.rateStar(value)}
          filled={false}
          compact={false}
          onPress={() => props.onRate(value)}
        />
      ))}
      <StarButton
        testID="batch-marks-rating-0"
        label={copy.clearRating}
        filled={false}
        compact={false}
        glyph="×"
        onPress={() => props.onRate(0)}
      />
    </View>
  );
}

function RunningStatus(props: { phase: Extract<BatchMarksPhase, { kind: "running" }> }) {
  const ratio = props.phase.total > 0 ? Math.max(0, Math.min(1, props.phase.current / props.phase.total)) : 0;
  return (
    <View style={{ gap: space.sm }}>
      {progressBar(ratio)}
      <Text
        testID="batch-marks-progress-text"
        style={{
          fontFamily: font.family,
          color: color.secondary,
          fontSize: type.meta,
          fontVariant: font.tabularNums,
        }}
      >
        {copy.batchMarksSaving(props.phase.file, props.phase.current, props.phase.total)}
      </Text>
    </View>
  );
}

function DoneStatus(props: { phase: Extract<BatchMarksPhase, { kind: "done" }> }) {
  const issues = props.phase.items.filter((item) => item.status === "failed");
  const summary =
    props.phase.updated === 0 && props.phase.failed === 0
      ? copy.batchMarksUnchanged
      : copy.batchMarksSummary(props.phase.updated, props.phase.failed);
  return (
    <View style={{ gap: space.xs }}>
      <Text
        testID="batch-marks-summary"
        style={{
          fontFamily: font.family,
          color: props.phase.failed > 0 ? color.danger : color.text,
          fontSize: type.body,
        }}
      >
        {summary}
      </Text>
      {issues.map((issue) => (
        <Text
          testID={`batch-marks-issue-${issue.file}`}
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
