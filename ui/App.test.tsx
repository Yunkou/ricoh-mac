import { expect, open, test } from "nsh/test";
import type { ConnectResult, ImportProgress, ImportReport, PhotoItem, SwitchBackResult, WifiSettings } from "ricoh-mac/native";
import { applyRange, columnCount, selectAll, selectedCount, selectedIds, toggleId } from "./state/selection";

const samplePhotos = [
  { id: "100RICOH/R0000001.JPG", folder: "100RICOH", file: "R0000001.JPG", size: 1200, thumbnailPath: null },
  { id: "100RICOH/R0000002.DNG", folder: "100RICOH", file: "R0000002.DNG", size: 2400, thumbnailPath: null },
  { id: "100RICOH/R0000003.JPG", folder: "100RICOH", file: "R0000003.JPG", size: 1300, thumbnailPath: null },
];

const connected = {
  connected: true,
  model: "GR IIIx",
  firmware: "1.00",
  message: "ok",
  baseUrl: "http://192.168.0.1",
};

const defaultWifiSettings: WifiSettings = {
  profile: null,
  autoSwitchBack: true,
  previousSsid: null,
  canSwitchBack: false,
  viaUtun: null,
};

type ProbeLike = {
  connected?: unknown;
  message?: unknown;
  model?: unknown;
  serial?: unknown;
  firmware?: unknown;
  baseUrl?: unknown;
};

function asOptionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function connectResultFromProbe(probe: ProbeLike): ConnectResult {
  if (probe.connected) {
    return {
      kind: "connected",
      message: typeof probe.message === "string" ? probe.message : "ok",
      connected: true,
      model: asOptionalString(probe.model),
      serial: asOptionalString(probe.serial),
      firmware: asOptionalString(probe.firmware),
      switched: false,
      alreadyOnCamera: true,
      previousSsid: null,
      viaUtun: null,
      baseUrl: typeof probe.baseUrl === "string" ? probe.baseUrl : "http://192.168.0.1",
    };
  }
  return {
    kind: "failed",
    message: typeof probe.message === "string" ? probe.message : "failed",
    connected: false,
    failKind: "unreachable",
    viaUtun: null,
    alreadyOnCamera: false,
    switched: false,
    baseUrl: typeof probe.baseUrl === "string" ? probe.baseUrl : "http://192.168.0.1",
  };
}


function needProfileResult(overrides: Partial<ConnectResult> = {}): ConnectResult {
  return {
    kind: "need_profile",
    message: "尚未保存相机 Wi-Fi。",
    suggestedSsid: null,
    alreadyOnCamera: false,
    viaUtun: null,
    switched: false,
    connected: false,
    baseUrl: "http://192.168.0.1",
    ...overrides,
  };
}

function modules(options?: {
  folder?: string | null;
  photos?: PhotoItem[];
  probe?: ProbeLike | (() => Promise<ProbeLike>);
  importSelected?: (ids: string[], onProgress: unknown) => Promise<ImportReport> | ImportReport;
  importAll?: (onProgress: unknown) => Promise<ImportReport> | ImportReport;
  loadThumbnail?: (folder: string, file: string) => Promise<string | null> | string | null;
  wifiConnect?: () => Promise<ConnectResult> | ConnectResult;
  wifiSaveAndConnect?: (ssid: string, password: string, alreadyOnCamera: boolean) => Promise<ConnectResult> | ConnectResult;
  wifiSettings?: WifiSettings | (() => WifiSettings);
  wifiSwitchBackAfterImport?: () => Promise<SwitchBackResult> | SwitchBackResult;
  wifiSwitchBack?: () => Promise<SwitchBackResult> | SwitchBackResult;
  wifiDeleteProfile?: () => Promise<WifiSettings> | WifiSettings;
  wifiSaveProfile?: (ssid: string, password: string) => Promise<{ id: string; ssid: string }> | { id: string; ssid: string };
  wifiSetAutoSwitchBack?: (value: boolean) => Promise<boolean> | boolean;
}) {
  const folder = options?.folder === undefined ? null : options.folder;
  const photos = options?.photos ?? samplePhotos;
  const probe = options?.probe ?? connected;
  const settings = options?.wifiSettings ?? defaultWifiSettings;
  const readSettings = () => (typeof settings === "function" ? settings() : settings);
  const wifiConnect =
    options?.wifiConnect ??
    (async () => {
      const result = typeof probe === "function" ? await probe() : probe;
      return connectResultFromProbe(result);
    });
  return {
    "ricoh-mac/native": {
      "Library.folder": async () => folder,
      "Library.cameraBaseUrl": async () => "http://192.168.0.1",
      "Library.pickFolder": async () => "/tmp/ricoh-mac-test-library",
      "Library.setCameraBaseUrl": async (url: string) => url,
      "Library.resetCameraBaseUrl": async () => "http://192.168.0.1",
      "Camera.probe": typeof probe === "function" ? probe : async () => probe,
      "Camera.listPhotos": async () => photos,
      "Camera.loadThumbnail": options?.loadThumbnail ?? (async () => null),
      "Camera.importSelected": options?.importSelected ?? (async () => emptyReport()),
      "Camera.importAll": options?.importAll ?? (async () => emptyReport()),
      "Wifi.connect": wifiConnect,
      "Wifi.saveAndConnect": options?.wifiSaveAndConnect ?? (async () => connectResultFromProbe(connected)),
      "Wifi.saveProfile": options?.wifiSaveProfile ?? (async (ssid: string) => ({ id: "ssid:" + ssid, ssid })),
      "Wifi.settings": async () => readSettings(),
      "Wifi.setAutoSwitchBack": options?.wifiSetAutoSwitchBack ?? (async (value: boolean) => value),
      "Wifi.deleteProfile": options?.wifiDeleteProfile ?? (async () => defaultWifiSettings),
      "Wifi.switchBack": options?.wifiSwitchBack ?? (async () => ({ kind: "not_needed", message: "", ssid: null })),
      "Wifi.switchBackAfterImport":
        options?.wifiSwitchBackAfterImport ?? (async () => ({ kind: "not_needed", message: "", ssid: null })),
    },
  };
}

function emptyReport() {
  return { imported: 0, skipped: 0, conflicts: 0, errors: 0, items: [] };
}

function selectedLine(app: { texts: () => string[] }): string | undefined {
  return app.texts().find((line) => line.includes("已选") && line.includes("张") && line.includes("共"));
}

function isProgressPoster(value: unknown): value is { post: (event: ImportProgress) => void } {
  return (
    typeof value === "object" &&
    value !== null &&
    "post" in value &&
    typeof (value as { post?: unknown }).post === "function"
  );
}

function postProgress(onProgress: unknown, event: ImportProgress) {
  if (typeof onProgress === "function") {
    onProgress(event);
    return;
  }
  if (isProgressPoster(onProgress)) {
    onProgress.post(event);
  }
}


function launch(moduleOverrides?: Parameters<typeof modules>[0]) {
  return open("../App.tsx", {
    colorScheme: "dark",
    platform: "macos",
    width: 1000,
    height: 700,
    modules: modules(moduleOverrides),
  });
}

test("selection helpers toggle, range, and count", () => {
  const ids = samplePhotos.map((photo) => photo.id);
  let selected = toggleId({}, ids[0]);
  expect(selectedCount(selected)).toBe(1);
  selected = toggleId(selected, ids[0]);
  expect(selectedCount(selected)).toBe(0);
  const ranged = applyRange(ids, 0, 2);
  expect(selectedIds(ranged)).toEqual(ids);
  expect(selectedCount(selectAll(ids))).toBe(3);
  expect(columnCount(1000)).toBeGreaterThanOrEqual(4);
  expect(columnCount(390)).toBe(2);
});

test("first run asks for a library and does not show a connection error", async () => {
  const app = await launch({ folder: null });
  await app.waitFor("id:first-run");
  const texts = app.texts();
  expect(texts).toContain("选择资料库文件夹");
  expect(texts.some((line) => line.includes("原文件名"))).toBe(true);
  expect(texts).toContain("尚未连接");
  expect(texts.some((line) => line.includes("无法连接"))).toBe(false);
  expect(texts).not.toContain("Choose a library folder");
  expect(texts).not.toContain("Not connected");
  expect(app.shows("id:connect-camera")).toBe(false);
  expect(app.shows("id:import-selected")).toBe(false);
  app.dispose();
});

test("choosing a library shows connection guidance without a red error", async () => {
  const app = await launch({ folder: null });
  await app.waitFor("id:choose-folder-first");
  await app.press("id:choose-folder-first");
  await app.waitFor("id:connect-camera");
  const texts = app.texts();
  expect(texts).toContain("连接相机");
  expect(texts.some((line) => line.includes("无线局域网"))).toBe(true);
  expect(texts.some((line) => line.includes("以太网") || line.includes("USB"))).toBe(true);
  expect(texts).toContain("尚未连接");
  expect(texts.some((line) => line.includes("无法连接"))).toBe(false);
  expect(app.shows("id:import-selected")).toBe(false);
  app.dispose();
});

test("a successful connection loads the thumbnail grid", async () => {
  const app = await launch({ folder: "/tmp/ricoh-mac-test-library" });
  await app.waitFor("id:connect-camera");
  await app.press("id:connect-camera");
  await app.waitFor("id:photo-0");
  const texts = app.texts();
  expect(texts.some((line) => line.includes("已连接") && line.includes("GR IIIx"))).toBe(true);
  expect(texts).toContain("共 3 张");
  expect(texts).toContain("R0000001.JPG");
  expect(texts).toContain("R0000003.JPG");
  expect(app.enabled("id:import-selected")).toBe(false);
  expect(app.enabled("id:import-all")).toBe(true);
  app.dispose();
});

test("selection updates the count and enables import selected", async () => {
  const app = await launch({ folder: "/tmp/ricoh-mac-test-library" });
  await app.waitFor("id:connect-camera");
  await app.press("id:connect-camera");
  await app.waitFor("id:photo-0");
  await app.press("id:photo-0");
  expect(selectedLine(app)).toBe("共 3 张 · 已选 1 张");
  expect(app.enabled("id:import-selected")).toBe(true);
  await app.press("id:select-all");
  expect(selectedLine(app)).toBe("共 3 张 · 已选 3 张");
  await app.press("id:clear-selection");
  expect(selectedLine(app)).toBe(undefined);
  expect(app.texts()).toContain("共 3 张");
  expect(app.enabled("id:import-selected")).toBe(false);
  app.dispose();
});

test("shift-click selects a range of photos", async () => {
  const app = await launch({ folder: "/tmp/ricoh-mac-test-library" });
  await app.waitFor("id:connect-camera");
  await app.press("id:connect-camera");
  await app.waitFor("id:photo-0");
  await app.press("id:photo-0");
  await app.keyboard.down("shift");
  await app.press("id:photo-2");
  await app.keyboard.up("shift");
  expect(selectedLine(app)).toBe("共 3 张 · 已选 3 张");
  app.dispose();
});

test("import selected is disabled while an import is running and shows progress then a summary", async () => {
  const report = {
    imported: 1,
    skipped: 1,
    conflicts: 0,
    errors: 0,
    items: [
      { file: "R0000001.JPG", status: "imported", message: "" },
      { file: "R0000002.DNG", status: "skipped", message: "already present" },
    ],
  };
  const app = await launch({
    folder: "/tmp/ricoh-mac-test-library",
    importSelected: async (_ids: string[], onProgress: unknown) => {
      postProgress(onProgress, {
        file: "R0000001.JPG",
        status: "imported",
        current: 1,
        total: 2,
        message: "",
      });
      await new Promise((resolve) => setTimeout(resolve, 800));
      return report;
    },
  });
  await app.waitFor("id:connect-camera");
  await app.press("id:connect-camera");
  await app.waitFor("id:photo-0");
  await app.press("id:photo-0");
  await app.press("id:photo-1");
  const importing = app.press("id:import-selected");
  await app.waitUntil(
    () =>
      app.texts().some((line) => line.includes("正在导入") && line.includes("R0000001.JPG")) &&
      !app.enabled("id:import-selected") &&
      !app.enabled("id:import-all"),
    { timeout: 2000 },
  );
  expect(app.shows("id:connect-camera")).toBe(false);
  await importing;
  await app.waitFor("id:import-summary");
  expect(app.texts().some((line) => line.includes("已导入 1") && line.includes("已跳过 1"))).toBe(true);
  expect(app.enabled("id:import-all")).toBe(true);
  app.dispose();
});

test("import summary distinguishes conflicts and errors", async () => {
  const app = await launch({
    folder: "/tmp/ricoh-mac-test-library",
    importAll: async (_onProgress: unknown) => ({
      imported: 1,
      skipped: 0,
      conflicts: 1,
      errors: 1,
      items: [
        { file: "R0000001.JPG", status: "imported", message: "" },
        { file: "R0000002.DNG", status: "conflict", message: "同名文件大小不同，未覆盖" },
        { file: "R0000003.JPG", status: "error", message: "传输中断" },
      ],
    }),
  });
  await app.waitFor("id:connect-camera");
  await app.press("id:connect-camera");
  await app.waitFor("id:photo-0");
  await app.press("id:import-all");
  await app.waitFor("id:import-summary");
  const texts = app.texts();
  expect(texts.some((line) => line.includes("冲突 1") && line.includes("失败 1"))).toBe(true);
  expect(texts.some((line) => line.includes("R0000002.DNG") && line.includes("未覆盖"))).toBe(true);
  expect(texts.some((line) => line.includes("R0000003.JPG") && line.includes("传输中断"))).toBe(true);
  app.dispose();
});

test("keyboard shortcuts select all, clear, and do not fire while editing the camera URL", async () => {
  const app = await launch({ folder: "/tmp/ricoh-mac-test-library" });
  await app.waitFor("id:connect-camera");
  await app.press("id:connect-camera");
  await app.waitFor("id:photo-0");
  await app.keyboard.press("mod+a");
  expect(selectedLine(app)).toBe("共 3 张 · 已选 3 张");
  await app.keyboard.press("escape");
  expect(selectedLine(app)).toBe(undefined);
  await app.press("id:photo-0");
  expect(app.enabled("id:import-selected")).toBe(true);
  await app.press("id:settings-button");
  await app.waitFor("id:camera-url");
  await app.type("id:camera-url", "x");
  await app.keyboard.press("mod+a");
  expect(selectedLine(app)).toBe("共 3 张 · 已选 1 张");
  app.dispose();
});

test("settings holds the library and camera URL controls", async () => {
  const app = await launch({ folder: "/tmp/ricoh-mac-test-library" });
  await app.waitFor("id:connect-camera");
  expect(app.shows("id:camera-url")).toBe(false);
  await app.press("id:settings-button");
  await app.waitFor("id:settings-panel");
  expect(app.shows("id:camera-url")).toBe(true);
  expect(app.shows("id:choose-folder")).toBe(true);
  expect(app.value("id:camera-url")).toBe("http://192.168.0.1");
  expect(app.texts()).toContain("相机地址（高级）");
  await app.keyboard.press("escape");
  await app.waitUntil(() => !app.shows("id:settings-panel"));
  app.dispose();
});

test("a failed probe is an error, and idle text is not used as that error", async () => {
  const app = await launch({
    folder: "/tmp/ricoh-mac-test-library",
    probe: {
      connected: false,
      model: undefined,
      firmware: undefined,
      message: "timed out",
      baseUrl: "http://192.168.0.1",
    },
  });
  await app.waitFor("id:connect-camera");
  await app.press("id:connect-camera");
  await app.waitUntil(() => app.texts().some((line) => line.includes("无法连接")));
  const texts = app.texts();
  expect(texts.some((line) => line.includes("无法连接") && line.includes("timed out"))).toBe(true);
  expect(texts).not.toContain("尚未连接");
  app.dispose();
});

function manyPhotos(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const n = String(index + 1).padStart(7, "0");
    return {
      id: `100RICOH/R${n}.JPG`,
      folder: "100RICOH",
      file: `R${n}.JPG`,
      size: 1000 + index,
      thumbnailPath: null,
    };
  });
}

test("thumbnails are loaded once per item and selection survives later thumbnail updates", async () => {
  const photos = manyPhotos(20);
  const loadIds: string[] = [];
  const app = await launch({
    folder: "/tmp/ricoh-mac-test-library",
    photos,
    loadThumbnail: async (folder, file) => {
      loadIds.push(`${folder}/${file}`);
      await new Promise((resolve) => setTimeout(resolve, 15));
      return `file:///tmp/${file}.thumb`;
    },
  });
  await app.waitFor("id:connect-camera");
  await app.press("id:connect-camera");
  await app.waitFor("id:photo-0");
  await app.press("id:photo-0");
  expect(selectedLine(app)).toBe("共 20 张 · 已选 1 张");
  await app.waitUntil(() => loadIds.length >= 20, { timeout: 8000 });
  expect(selectedLine(app)).toBe("共 20 张 · 已选 1 张");
  const counted = loadIds.length;
  await app.wait(400);
  expect(loadIds.length).toBe(counted);
  expect(counted).toBe(20);
  await app.press("id:photo-1");
  expect(selectedLine(app)).toBe("共 20 张 · 已选 2 张");
  expect(app.shows("id:photo-grid")).toBe(true);
  app.dispose();
});

test("first connection asks for a camera Wi-Fi profile and then loads photos", async () => {
  const saved: { ssid?: string; password?: string; alreadyOnCamera?: boolean } = {};
  const app = await launch({
    folder: "/tmp/ricoh-mac-test-library",
    wifiConnect: async () =>
      needProfileResult({
        message: "已连接到相机。请保存相机屏幕上显示的 Wi-Fi 名称和密码，以后就可以自动切换网络。",
        suggestedSsid: "GR_ABCD",
        alreadyOnCamera: true,
      }),
    wifiSaveAndConnect: async (ssid: string, password: string, alreadyOnCamera: boolean) => {
      saved.ssid = ssid;
      saved.password = password;
      saved.alreadyOnCamera = alreadyOnCamera;
      return connectResultFromProbe(connected);
    },
  });
  await app.waitFor("id:connect-camera");
  await app.press("id:connect-camera");
  await app.waitFor("id:wifi-profile-form");
  expect(app.shows("id:connect-camera")).toBe(false);
  expect(app.value("id:wifi-ssid")).toBe("GR_ABCD");
  expect(app.texts().some((line) => line.includes("请输入相机屏幕上显示的密码"))).toBe(true);
  await app.type("id:wifi-password", "secret");
  await app.press("id:save-and-connect");
  await app.waitFor("id:photo-0");
  expect(saved).toEqual({ ssid: "GR_ABCD", password: "secret", alreadyOnCamera: true });
  expect(app.shows("id:photo-grid")).toBe(true);
  app.dispose();
});

test("a utun route to the camera is shown as a hint", async () => {
  const app = await launch({
    folder: "/tmp/ricoh-mac-test-library",
    wifiSettings: { ...defaultWifiSettings, viaUtun: "utun4" },
    wifiConnect: async () => needProfileResult({ viaUtun: "utun4" }),
  });
  await app.waitFor("id:connect-camera");
  await app.press("id:connect-camera");
  await app.waitFor("id:utun-hint");
  expect(app.texts().some((line) => line.includes("utun4") && line.includes("Clash Verge"))).toBe(true);
  app.dispose();
});

test("settings shows a saved profile and can delete it", async () => {
  let deleted = false;
  const app = await launch({
    folder: "/tmp/ricoh-mac-test-library",
    wifiSettings: () =>
      deleted
        ? defaultWifiSettings
        : {
            profile: { id: "serial:S1", model: "RICOH GR IIIx", serial: "S1", firmware: "1.65", ssid: "GR_ABCD" },
            autoSwitchBack: true,
            previousSsid: null,
            canSwitchBack: false,
            viaUtun: null,
          },
    wifiDeleteProfile: async () => {
      deleted = true;
      return defaultWifiSettings;
    },
  });
  await app.waitFor("id:settings-button");
  await app.press("id:settings-button");
  await app.waitFor("id:settings-panel");
  expect(app.texts()).toContain("网络：GR_ABCD");
  expect(app.texts().some((line) => line.includes("RICOH GR IIIx") && line.includes("S1"))).toBe(true);
  expect(app.shows("id:delete-profile")).toBe(true);
  await app.press("id:delete-profile");
  await app.waitUntil(() => app.shows("id:profile-empty"));
  expect(deleted).toBe(true);
  app.dispose();
});

test("import automatically switches back to the previous network when enabled", async () => {
  let switchedBack = false;
  const app = await launch({
    folder: "/tmp/ricoh-mac-test-library",
    wifiSettings: {
      profile: { id: "ssid:GR_ABCD", ssid: "GR_ABCD" },
      autoSwitchBack: true,
      previousSsid: "HomeNet",
      canSwitchBack: true,
      viaUtun: null,
    },
    wifiSwitchBackAfterImport: async () => {
      switchedBack = true;
      return { kind: "restored", ssid: "HomeNet", message: "已切换回 HomeNet" };
    },
    importAll: async (onProgress: unknown) => {
      postProgress(onProgress, {
        file: "R0000001.JPG",
        status: "imported",
        current: 1,
        total: 3,
        message: "ok",
      });
      return {
        imported: 3,
        skipped: 0,
        conflicts: 0,
        errors: 0,
        items: samplePhotos.map((photo) => ({ file: photo.file, status: "imported", message: "ok" })),
      };
    },
  });
  await app.waitFor("id:connect-camera");
  await app.press("id:connect-camera");
  await app.waitFor("id:import-all");
  expect(app.shows("id:switch-back")).toBe(true);
  await app.press("id:import-all");
  await app.waitUntil(() => switchedBack);
  await app.waitFor("id:banner");
  expect(app.texts()).toContain("已切换回 HomeNet");
  app.dispose();
});
