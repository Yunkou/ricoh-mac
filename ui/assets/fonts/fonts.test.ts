import { expect, test } from "nsh/test";
import { chillDINGothicFamily, chillDINGothicLicenseUrl, chillDINGothicStack } from "./index";

test("the bundled Regular face registers as ChillDINGothic", () => {
  expect(chillDINGothicFamily).toBe("ChillDINGothic");
  expect(chillDINGothicStack).toBe("ChillDINGothic, system-ui");
  expect(chillDINGothicLicenseUrl.length).toBeGreaterThan(0);
});
