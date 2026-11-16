import { copy } from "../copy";
import { color } from "../theme";

export type FileStatus = "pending" | "imported" | "skipped" | "conflict" | "error";

export type PressModifiers = {
  modifiers?: { shift?: boolean; platform?: boolean; control?: boolean; alt?: boolean };
};


export type ConnectionState =
  | { kind: "idle" }
  | { kind: "connecting" }
  | { kind: "need_profile"; suggestedSsid?: string; alreadyOnCamera: boolean; message: string }
  | { kind: "connected"; model?: string; serial?: string; firmware?: string; previousSsid?: string; switched?: boolean }
  | { kind: "error"; message: string };

export type Banner = { text: string; tone: "danger" | "info" };

export type ImportPhase =
  | { kind: "idle" }
  | { kind: "running"; file: string; current: number; total: number }
  | {
      kind: "done";
      imported: number;
      skipped: number;
      conflicts: number;
      errors: number;
      issues: { file: string; status: "conflict" | "error"; message: string }[];
    };

export type ButtonKind = "primary" | "secondary" | "ghost";

export function asFileStatus(value: string): FileStatus | null {
  if (value === "pending" || value === "imported" || value === "skipped" || value === "conflict" || value === "error") {
    return value;
  }
  return null;
}

export function isConflictOrError(
  status: string,
): status is "conflict" | "error" {
  return status === "conflict" || status === "error";
}

export function displayPath(path: string): string {
  const parts = path.split("/").filter((part) => part.length > 0);
  if (parts.length <= 3) {
    return path;
  }
  return `…/${parts.slice(-3).join("/")}`;
}

export function connectionLabel(state: ConnectionState): string {
  switch (state.kind) {
    case "idle":
      return copy.idleStatus;
    case "connecting":
      return copy.connectingStatus;
    case "need_profile":
      return copy.needProfileStatus;
    case "connected": {
      const detail = [state.model, state.firmware].filter(Boolean).join(" · ");
      return detail ? `${copy.connectedStatus} · ${detail}` : copy.connectedStatus;
    }
    case "error":
      return state.message ? `${copy.errorStatus}：${state.message}` : copy.errorStatus;
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

export function connectionColor(state: ConnectionState): string {
  switch (state.kind) {
    case "idle":
    case "connecting":
      return color.secondary;
    case "need_profile":
      return color.warning;
    case "connected":
      return color.success;
    case "error":
      return color.danger;
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}
