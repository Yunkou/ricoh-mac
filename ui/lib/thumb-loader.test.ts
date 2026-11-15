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
  const pending = new Map<string, (path: string | null) => void>();
  const startWaiters = new Map<string, Array<() => void>>();
  let current = 0;
  let max = 0;
  const calls: string[] = [];
  const loader = createThumbLoader({
    concurrency: 2,
    load: (item) => {
      calls.push(item.id);
      current += 1;
      if (current > max) {
        max = current;
      }
      return new Promise((resolve) => {
        pending.set(item.id, (path) => {
          current -= 1;
          resolve(path);
        });
        const waiters = startWaiters.get(item.id);
        if (waiters) {
          startWaiters.delete(item.id);
          for (const wake of waiters) {
            wake();
          }
        }
      });
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

  expect(calls).toEqual(["100RICOH/R1.JPG", "100RICOH/R2.JPG"]);
  expect(loader.inflightCount()).toBe(2);
  expect(max).toBe(2);

  pending.get("100RICOH/R1.JPG")!("file:///tmp/R1.JPG.thumb");
  await whenStarted(pending, startWaiters, "100RICOH/R3.JPG");
  expect(calls).toEqual(["100RICOH/R1.JPG", "100RICOH/R2.JPG", "100RICOH/R3.JPG"]);
  expect(loader.inflightCount()).toBe(2);
  expect(max).toBe(2);

  pending.get("100RICOH/R2.JPG")!("file:///tmp/R2.JPG.thumb");
  pending.get("100RICOH/R3.JPG")!("file:///tmp/R3.JPG.thumb");
  await whenStarted(pending, startWaiters, "100RICOH/R4.JPG");
  await whenStarted(pending, startWaiters, "100RICOH/R5.JPG");
  expect(loader.inflightCount()).toBe(2);

  pending.get("100RICOH/R4.JPG")!("file:///tmp/R4.JPG.thumb");
  pending.get("100RICOH/R5.JPG")!("file:///tmp/R5.JPG.thumb");
  await loader.whenIdle();

  expect(calls).toEqual(items.map((item) => item.id));
  expect(loader.loadCount()).toBe(5);
  expect(max).toBe(2);
  expect(loader.inflightCount()).toBe(0);
});

test("a failed thumbnail is not retried until the loader is reset", async () => {
  const pending: Array<(path: string | null) => void> = [];
  let calls = 0;
  const loader = createThumbLoader({
    concurrency: 1,
    load: () => {
      calls += 1;
      return new Promise((resolve) => {
        pending.push(resolve);
      });
    },
    onLoaded: () => {
      throw new Error("should not load a path");
    },
  });
  const item = { id: "100RICOH/A.JPG", folder: "100RICOH", file: "A.JPG" };
  loader.request([item]);
  expect(calls).toBe(1);
  expect(pending.length).toBe(1);
  pending[0](null);
  await loader.whenIdle();
  loader.request([item]);
  expect(calls).toBe(1);
  loader.reset();
  loader.request([item]);
  expect(calls).toBe(2);
  pending[1](null);
  await loader.whenIdle();
  expect(calls).toBe(2);
});

function whenStarted(
  pending: Map<string, unknown>,
  startWaiters: Map<string, Array<() => void>>,
  id: string,
): Promise<void> {
  if (pending.has(id)) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const waiters = startWaiters.get(id) ?? [];
    waiters.push(resolve);
    startWaiters.set(id, waiters);
  });
}
