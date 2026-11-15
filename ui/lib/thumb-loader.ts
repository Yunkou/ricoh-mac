export type ThumbRequest = {
  id: string;
  folder: string;
  file: string;
  path?: string;
};

export type ListedPhoto = {
  id: string;
  folder: string;
  file: string;
  size?: number | null;
};

export type PhotoWithOptionalThumb = ListedPhoto & {
  thumbnailPath?: string | null;
};

export function splitListedPhotos(items: readonly PhotoWithOptionalThumb[]): {
  photos: ListedPhoto[];
  thumbs: Record<string, string>;
} {
  const thumbs: Record<string, string> = {};
  const photos = items.map((item) => {
    if (item.thumbnailPath) {
      thumbs[item.id] = item.thumbnailPath;
    }
    return {
      id: item.id,
      folder: item.folder,
      file: item.file,
      size: item.size,
    };
  });
  return { photos, thumbs };
}

export function mergeThumb(
  thumbs: Record<string, string>,
  id: string,
  path: string,
): Record<string, string> {
  if (thumbs[id] === path) {
    return thumbs;
  }
  return { ...thumbs, [id]: path };
}

export type ThumbLoader = {
  request(items: readonly ThumbRequest[]): void;
  remember(ids: readonly string[]): void;
  cancelQueued(): void;
  reset(): void;
  loadCount(): number;
  inflightCount(): number;
  /** Resolves when no thumbnail is in flight and the queue is empty. Used by tests to wait without a timeout. */
  whenIdle(): Promise<void>;
};

export function createThumbLoader(options: {
  load: (item: ThumbRequest) => Promise<string | null>;
  onLoaded: (id: string, path: string) => void;
  concurrency?: number;
}): ThumbLoader {
  const concurrency = options.concurrency ?? 4;
  const queued: ThumbRequest[] = [];
  const queuedIds = new Set<string>();
  const inflight = new Set<string>();
  const done = new Set<string>();
  let loads = 0;
  let generation = 0;
  const idleWaiters: Array<() => void> = [];

  function isIdle(): boolean {
    return inflight.size === 0 && queued.length === 0;
  }

  function notifyIdle() {
    if (!isIdle()) {
      return;
    }
    const waiters = idleWaiters.splice(0);
    for (const wake of waiters) {
      wake();
    }
  }

  function pump() {
    while (inflight.size < concurrency && queued.length > 0) {
      const item = queued.shift();
      if (!item) {
        break;
      }
      queuedIds.delete(item.id);
      if (done.has(item.id) || inflight.has(item.id)) {
        continue;
      }
      inflight.add(item.id);
      loads += 1;
      const started = generation;
      void options
        .load(item)
        .then((path) => {
          if (started !== generation) {
            return;
          }
          done.add(item.id);
          if (path) {
            options.onLoaded(item.id, path);
          }
        })
        .catch(() => {
          if (started === generation) {
            done.add(item.id);
          }
        })
        .finally(() => {
          inflight.delete(item.id);
          if (started === generation) {
            pump();
          }
          notifyIdle();
        });
    }
  }

  return {
    request(items) {
      for (const item of items) {
        if (done.has(item.id) || inflight.has(item.id) || queuedIds.has(item.id)) {
          continue;
        }
        queuedIds.add(item.id);
        queued.push(item);
      }
      pump();
      notifyIdle();
    },
    remember(ids) {
      for (const id of ids) {
        done.add(id);
      }
    },
    cancelQueued() {
      queued.length = 0;
      queuedIds.clear();
      notifyIdle();
    },
    reset() {
      generation += 1;
      queued.length = 0;
      queuedIds.clear();
      inflight.clear();
      done.clear();
      loads = 0;
      notifyIdle();
    },
    loadCount() {
      return loads;
    },
    inflightCount() {
      return inflight.size;
    },
    whenIdle() {
      if (isIdle()) {
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        idleWaiters.push(resolve);
      });
    },
  };
}
