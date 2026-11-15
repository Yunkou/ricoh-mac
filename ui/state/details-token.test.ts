import { expect, test } from "nsh/test";
import { isCurrentDetailsRequest } from "./app-model";

test("a later photo request invalidates an in-flight RAW develop", () => {
  expect(isCurrentDetailsRequest(1, 1, "R0000002.DNG", "R0000002.DNG")).toBe(true);
  expect(isCurrentDetailsRequest(1, 2, "R0000003.JPG", "R0000002.DNG")).toBe(false);
  expect(isCurrentDetailsRequest(1, 1, "R0000003.JPG", "R0000002.DNG")).toBe(false);
  expect(isCurrentDetailsRequest(2, 2, null, "R0000002.DNG")).toBe(false);
});
