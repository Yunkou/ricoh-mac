import type { Signal } from "nsh";
import type { ImportPhase } from "../state/connection";
import { CompletionSummary } from "./completion-summary";
import { ImportProgress } from "./import-progress";

export function ImportStrip(props: {
  importPhase: Signal<ImportPhase>;
  onViewImported: () => void;
  onRetryFailed: () => void;
}) {
  return (
    <>
      {props.importPhase().kind === "running" ? (
        <ImportProgress importPhase={props.importPhase} />
      ) : props.importPhase().kind === "done" ? (
        <CompletionSummary
          importPhase={props.importPhase}
          onViewImported={props.onViewImported}
          onRetryFailed={props.onRetryFailed}
        />
      ) : null}
    </>
  );
}
