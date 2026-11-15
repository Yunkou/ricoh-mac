import { expect, test } from "nsh/test";
import { createThumbLoader, mergeThumb, splitListedPhotos } from "./thumb-loader";

test("splitListedPhotos keeps photo identity free of thumbnail paths", () => {
  const items = [
    { id: "100RICOH/A.JPG", folder: "100RICOH", file: "A.JPG", size: 1, thumbnailPath: "file:///tmp/A.thumb" },
    { id: "100RICOH/B.JPG", folder: "100RICOH", file: "B.JPG", size: 2, thumbnailPath: null },
  ];
  const first = splitListedPhotos(items);
  const second = splitListedPhotos(
    items.map((item) =>
      item.id === "100RICOH/B.JPG" ? { ...item, thumbnailPath: "file:///tmp/B.thumb" } : item,
    ),
  );
  expect(first.photos).toEqual(second.photos);
  expect(first.thumbs).toEqual({ "100RICOH/A.JPG": "file:///tmp/A.thumb" });
  expect(second.thumbs).toEqual({
    "100RICOH/A.JPG": "file:///tmp/A.thumb",
    "100RICOH/B.JPG": "file:///tmp/B.thumb",
  });
});

test("mergeThumb leaves the map unchanged when the path is already stored", () => {
  const first = { "100RICOH/A.JPG": "file:///tmp/A.thumb" };
  const same = mergeThumb(first, "100RICOH/A.JPG", "file:///tmp/A.thumb");
  expect(same).toBe(first);
  const next = mergeThumb(first, "100RICOH/B.JPG", "file:///tmp/B.thumb");
  expect(next).not.toBe(first);
  expect(next["100RICOH/A.JPG"]).toBe("file:///tmp/A.thumb");
  expect(next["100RICOH/B.JPG"]).toBe("file:///tmp/B.thumb");
});

test("thumb loader loads each id once and keeps concurrency bounded", async () => {
  let current = 0;
  let max = 0;
  const calls: string[] = [];
  const loader = createThumbLoader({
    concurrency: 2,
    load: async (item) => {
      calls.push(item.id);
      current += 1;
      if (current > max) {
        max = current;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
      current -= 1;
      return `file:///tmp/${item.file}.thumb`;
    },
    onLoaded: () => {},
  });
  const items = [1, 2, 3, 4, 5].map((n) => ({
    id: `100RICOH/R${n}.JPG`,
    folder: "100RICOH",
    file: `R${n}.JPG`,
  }));
  loader.request(items);
  loader.request(items);
  loader.request(items.slice(0, 2));
  await new Promise((resolve) => setTimeout(resolve, 200));
  expect(calls).toEqual(items.map((item) => item.id));
  expect(loader.loadCount()).toBe(5);
  expect(max).toBe(2);
  expect(loader.inflightCount()).toBe(0);
});

test("a failed thumbnail is not retried until the loader is reset", async () => {
  let calls = 0;
  const loader = createThumbLoader({
    concurrency: 1,
    load: async () => {
      calls += 1;
      return null;
    },
    onLoaded: () => {
      throw new Error("should not load a path");
    },
  });
  const item = { id: "100RICOH/A.JPG", folder: "100RICOH", file: "A.JPG" };
  loader.request([item]);
  await new Promise((resolve) => setTimeout(resolve, 30));
  loader.request([item]);
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect(calls).toBe(1);
  loader.reset();
  loader.request([item]);
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect(calls).toBe(2);
});
