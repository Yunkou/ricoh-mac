import { idsByFileName } from "./selection";
import type { FailedImport, ImportIssue } from "./connection";

export type ImportResultItem = {
  file: string;
  status: string;
  message: string;
};

export type AssignedImport = {
  id: string;
  file: string;
  status: string;
  message: string;
};

export type ImportCounts = {
  imported: number;
  skipped: number;
  conflicts: number;
  errors: number;
};

export type ImportSession = ImportCounts & {
  issues: ImportIssue[];
  failedImports: FailedImport[];
  retry: boolean;
};

export function knownPhotosForImport(
  photos: readonly { id: string; file: string }[],
  failed: readonly FailedImport[],
): { id: string; file: string }[] {
  const seen = new Set(photos.map((photo) => photo.id));
  const known = photos.map((photo) => ({ id: photo.id, file: photo.file }));
  for (const item of failed) {
    if (!seen.has(item.id)) {
      known.push({ id: item.id, file: item.file });
      seen.add(item.id);
    }
  }
  return known;
}

export function assignImportResults(
  items: readonly ImportResultItem[],
  photos: readonly { id: string; file: string }[],
  batchIds: readonly string[],
): AssignedImport[] {
  const pending = new Set(batchIds);
  const assigned: AssignedImport[] = [];
  for (const item of items) {
    const matches = idsByFileName(photos, item.file).filter((id) => pending.has(id));
    const fallback = idsByFileName(photos, item.file).find((id) => batchIds.includes(id));
    const id = matches[0] ?? fallback;
    if (!id) {
      continue;
    }
    pending.delete(id);
    assigned.push({
      id,
      file: item.file,
      status: item.status,
      message: item.message,
    });
  }
  return assigned;
}

export function failedImportsFromAssigned(assigned: readonly AssignedImport[]): FailedImport[] {
  return assigned
    .filter((item) => item.status === "error")
    .map((item) => ({ id: item.id, file: item.file, message: item.message }));
}

export function issuesFromAssigned(assigned: readonly AssignedImport[]): ImportIssue[] {
  return assigned
    .filter(
      (item): item is AssignedImport & { status: "conflict" | "error" } =>
        item.status === "conflict" || item.status === "error",
    )
    .map((item) => ({
      file: item.file,
      status: item.status,
      message: item.message,
    }));
}

export function retryImportIds(failed: readonly FailedImport[]): string[] {
  return failed.map((item) => item.id);
}

export function sessionAfterImport(counts: ImportCounts, assigned: readonly AssignedImport[]): ImportSession {
  return {
    ...counts,
    issues: issuesFromAssigned(assigned),
    failedImports: failedImportsFromAssigned(assigned),
    retry: false,
  };
}

export function sessionAfterRetry(
  previous: ImportSession,
  counts: ImportCounts,
  assigned: readonly AssignedImport[],
): ImportSession {
  const previousConflicts = previous.issues.filter((issue) => issue.status === "conflict");
  return {
    ...counts,
    issues: [...previousConflicts, ...issuesFromAssigned(assigned)],
    failedImports: failedImportsFromAssigned(assigned),
    retry: true,
  };
}
