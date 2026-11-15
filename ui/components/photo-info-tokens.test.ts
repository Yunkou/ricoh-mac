import { expect, test } from "nsh/test";
import { color } from "../theme";
import { histogramChannelFills } from "./photo-info";

test("histogram channels use theme tokens, including blue", () => {
  expect(histogramChannelFills.red).toBe(color.histogramRed);
  expect(histogramChannelFills.green).toBe(color.histogramGreen);
  expect(histogramChannelFills.blue).toBe(color.histogramBlue);
  expect(color.histogramBlue).toBe("#6A8CBA");
});
