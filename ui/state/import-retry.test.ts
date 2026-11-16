import { expect, test } from "nsh/test";
import {
  assignImportResults,
  failedImportsFromAssigned,
  knownPhotosForImport,
  retryImportIds,
  sessionAfterImport,
  sessionAfterRetry,
} from "./import-retry";

const photos = [
  { id: "100RICOH/R0000001.JPG", file: "R0000001.JPG" },
  { id: "100RICOH/R0000002.DNG", file: "R0000002.DNG" },
  { id: "100RICOH/R0000003.JPG", file: "R0000003.JPG" },
];

const mixedItems = [
  { file: "R0000001.JPG", status: "imported", message: "" },
  { file: "R0000002.DNG", status: "conflict", message: "同名文件大小不同，未覆盖" },
  { file: "R0000003.JPG", status: "error", message: "传输中断" },
];

test("a mixed import keeps only transfer errors in the failed list", () => {
  const assigned = assignImportResults(
    mixedItems,
    photos,
    photos.map((photo) => photo.id),
  );
  const session = sessionAfterImport(
    { imported: 1, skipped: 0, conflicts: 1, errors: 1 },
    assigned,
  );
  expect(retryImportIds(session.failedImports)).toEqual(["100RICOH/R0000003.JPG"]);
  expect(session.failedImports[0]?.message).toBe("传输中断");
  expect(session.issues.map((issue) => issue.status)).toEqual(["conflict", "error"]);
  expect(session.retry).toBe(false);
});

test("a retry sends only the failed ids and drops files that then succeed", () => {
  const first = sessionAfterImport(
    { imported: 1, skipped: 0, conflicts: 1, errors: 1 },
    assignImportResults(
      mixedItems,
      photos,
      photos.map((photo) => photo.id),
    ),
  );
  const retryIds = retryImportIds(first.failedImports);
  expect(retryIds).toEqual(["100RICOH/R0000003.JPG"]);
  expect(retryIds.includes("100RICOH/R0000001.JPG")).toBe(false);
  expect(retryIds.includes("100RICOH/R0000002.DNG")).toBe(false);

  const retried = sessionAfterRetry(
    first,
    { imported: 1, skipped: 0, conflicts: 0, errors: 0 },
    assignImportResults(
      [{ file: "R0000003.JPG", status: "imported", message: "" }],
      photos,
      retryIds,
    ),
  );
  expect(retried.failedImports).toEqual([]);
  expect(retried.retry).toBe(true);
  expect(retried.imported).toBe(1);
  expect(retried.errors).toBe(0);
  expect(retried.issues.map((issue) => issue.file)).toEqual(["R0000002.DNG"]);
});

test("a partial retry keeps the remaining failures and their reasons", () => {
  const first = sessionAfterImport(
    { imported: 0, skipped: 0, conflicts: 0, errors: 2 },
    assignImportResults(
      [
        { file: "R0000001.JPG", status: "error", message: "传输中断" },
        { file: "R0000003.JPG", status: "error", message: "无法读取相机文件" },
      ],
      photos,
      ["100RICOH/R0000001.JPG", "100RICOH/R0000003.JPG"],
    ),
  );
  const retried = sessionAfterRetry(
    first,
    { imported: 1, skipped: 0, conflicts: 0, errors: 1 },
    assignImportResults(
      [
        { file: "R0000001.JPG", status: "imported", message: "" },
        { file: "R0000003.JPG", status: "error", message: "仍然失败" },
      ],
      photos,
      retryImportIds(first.failedImports),
    ),
  );
  expect(retryImportIds(retried.failedImports)).toEqual(["100RICOH/R0000003.JPG"]);
  expect(retried.failedImports[0]?.message).toBe("仍然失败");
  expect(retried.imported).toBe(1);
  expect(retried.errors).toBe(1);
  expect(retried.issues).toEqual([{ file: "R0000003.JPG", status: "error", message: "仍然失败" }]);
});

test("a new import session does not keep leftover failed items", () => {
  const previous = sessionAfterImport(
    { imported: 2, skipped: 0, conflicts: 0, errors: 1 },
    assignImportResults(
      mixedItems,
      photos,
      photos.map((photo) => photo.id),
    ),
  );
  expect(retryImportIds(previous.failedImports)).toEqual(["100RICOH/R0000003.JPG"]);

  const next = sessionAfterImport(
    { imported: 1, skipped: 0, conflicts: 0, errors: 0 },
    assignImportResults(
      [{ file: "R0000001.JPG", status: "imported", message: "" }],
      photos,
      ["100RICOH/R0000001.JPG"],
    ),
  );
  expect(next.failedImports).toEqual([]);
  expect(next.issues).toEqual([]);
  expect(next.retry).toBe(false);
  expect(retryImportIds(next.failedImports).includes("100RICOH/R0000003.JPG")).toBe(false);
});

test("assignImportResults maps duplicate file names onto pending ids in order", () => {
  const listed = [
    { id: "100RICOH/R0000001.JPG", file: "R0000001.JPG" },
    { id: "101RICOH/R0000001.JPG", file: "R0000001.JPG" },
  ];
  const assigned = assignImportResults(
    [
      { file: "R0000001.JPG", status: "imported", message: "" },
      { file: "R0000001.JPG", status: "error", message: "传输中断" },
    ],
    listed,
    ["100RICOH/R0000001.JPG", "101RICOH/R0000001.JPG"],
  );
  expect(assigned.map((item) => item.id)).toEqual([
    "100RICOH/R0000001.JPG",
    "101RICOH/R0000001.JPG",
  ]);
  expect(failedImportsFromAssigned(assigned).map((item) => item.id)).toEqual([
    "101RICOH/R0000001.JPG",
  ]);
});

test("knownPhotosForImport keeps failed identities that have left the current list", () => {
  const known = knownPhotosForImport(
    [photos[0]],
    [{ id: "100RICOH/R0000003.JPG", file: "R0000003.JPG", message: "传输中断" }],
  );
  const assigned = assignImportResults(
    [{ file: "R0000003.JPG", status: "imported", message: "" }],
    known,
    ["100RICOH/R0000003.JPG"],
  );
  expect(assigned).toEqual([
    { id: "100RICOH/R0000003.JPG", file: "R0000003.JPG", status: "imported", message: "" },
  ]);
});
