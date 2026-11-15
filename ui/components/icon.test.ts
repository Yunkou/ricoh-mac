import { expect, test } from "nsh/test";
import { onAccentIcon, type IconName } from "./icon";

test("primary actions have on-accent icon variants", () => {
  const expected: IconName[] = ["wifi", "download", "folder-plus"];
  for (const name of expected) {
    const mapped = onAccentIcon[name];
    expect(mapped).toBe(`${name}-on-accent`);
  }
});
