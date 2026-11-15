import { expect, open, test } from "nsh/test";
import type { ConnectResult, ImportProgress, ImportReport, LibraryPhoto, PhotoItem, ProfileView, SwitchBackResult, WifiSettings } from "ricoh-mac/native";
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
  profiles: [],
  autoSwitchBack: true,
  previousSsid: null,
  canSwitchBack: false,
  viaUtun: null,
};

const sampleAlbum: LibraryPhoto[] = [
  { id: "R0000001.JPG", file: "R0000001.JPG", size: 1200, path: "/tmp/ricoh-mac-test-library/R0000001.JPG", previewUrl: "file:///tmp/ricoh-mac-test-library/R0000001.JPG" },
  { id: "R0000002.DNG", file: "R0000002.DNG", size: 2400, path: "/tmp/ricoh-mac-test-library/R0000002.DNG", previewUrl: null },
  { id: "R0000003.JPG", file: "R0000003.JPG", size: 1300, path: "/tmp/ricoh-mac-test-library/R0000003.JPG", previewUrl: "file:///tmp/ricoh-mac-test-library/R0000003.JPG" },
];

const savedProfile: ProfileView = {
  id: "s1",
  model: "RICOH GR IIIx",
  serial: "S1",
  firmware: "1.65",
  ssid: "GR_ABCD",
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
    message: "还没有保存过相机网络。",
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
  wifiConnectProfile?: (id: string) => Promise<ConnectResult> | ConnectResult;
  libraryPhotos?: LibraryPhoto[] | (() => LibraryPhoto[]);
}) {
  const folder = options?.folder === undefined ? null : options.folder;
  const photos = options?.photos ?? samplePhotos;
  const probe = options?.probe ?? connected;
  const settings = options?.wifiSettings ?? defaultWifiSettings;
  const readSettings = () => (typeof settings === "function" ? settings() : settings);
  const readLibraryPhotos = () => {
    const listed = options?.libraryPhotos ?? [];
    return typeof listed === "function" ? listed() : listed;
  };
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
      "Library.listPhotos": async () => readLibraryPhotos(),
      "Camera.probe": typeof probe === "function" ? probe : async () => probe,
      "Camera.listPhotos": async () => photos,
      "Camera.loadThumbnail": options?.loadThumbnail ?? (async () => null),
      "Camera.importSelected": options?.importSelected ?? (async () => emptyReport()),
      "Camera.importAll": options?.importAll ?? (async () => emptyReport()),
      "Wifi.connect": wifiConnect,
      "Wifi.connectProfile": options?.wifiConnectProfile ?? wifiConnect,
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

async function launchInDevices(moduleOverrides?: Parameters<typeof modules>[0]) {
  const app = await launch(moduleOverrides);
  await app.waitFor("id:home-screen");
  await app.waitFor("id:open-devices");
  await app.press("id:open-devices");
  return app;
}

async function launchInPhotos(moduleOverrides?: Parameters<typeof modules>[0]) {
  const app = await launch(moduleOverrides);
  await app.waitFor("id:home-screen");
  await app.press("id:open-photos");
  return app;
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

test("launch shows two feature entries and does not show a connection error", async () => {
  const app = await launch({ folder: null });
  await app.waitFor("id:home-screen");
  const texts = app.texts();
  expect(texts).toContain("设备");
  expect(texts).toContain("照片");
  expect(texts.indexOf("照片")).toBeLessThan(texts.indexOf("设备"));
  expect(texts.some((line) => line.includes("无法连接"))).toBe(false);
  expect(app.shows("id:connect-camera")).toBe(false);
  expect(app.shows("id:import-selected")).toBe(false);
  expect(app.shows("id:settings-button")).toBe(true);
  expect(app.shows("id:open-devices")).toBe(true);
  expect(app.shows("id:open-photos")).toBe(true);
  app.dispose();
});

test("opening my devices shows connection guidance without a red error", async () => {
  const app = await launchInDevices({ folder: "/tmp/ricoh-mac-test-library" });
  await app.waitFor("id:connect-camera");
  const texts = app.texts();
  expect(texts).toContain("连接相机");
  expect(texts.some((line) => line.includes("无线网络"))).toBe(true);
  expect(texts.some((line) => line.includes("网线") || line.includes("网络共享"))).toBe(true);
  expect(texts).toContain("未连接");
  expect(texts.some((line) => line.includes("无法连接"))).toBe(false);
  expect(app.shows("id:import-selected")).toBe(false);
  expect(app.shows("id:area-devices")).toBe(true);
  expect(app.shows("id:back-home")).toBe(true);
  app.dispose();
});

test("a successful connection loads the thumbnail grid", async () => {
  const app = await launchInDevices({ folder: "/tmp/ricoh-mac-test-library" });
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
  const app = await launchInDevices({ folder: "/tmp/ricoh-mac-test-library" });
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
  const app = await launchInDevices({ folder: "/tmp/ricoh-mac-test-library" });
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
  let finishImport!: (value: typeof report) => void;
  const importHeld = new Promise<typeof report>((resolve) => {
    finishImport = resolve;
  });
  const app = await launchInDevices({
    folder: "/tmp/ricoh-mac-test-library",
    importSelected: async (_ids: string[], onProgress: unknown) => {
      postProgress(onProgress, {
        file: "R0000001.JPG",
        status: "imported",
        current: 1,
        total: 2,
        message: "",
      });
      return importHeld;
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
  finishImport(report);
  await importing;
  await app.waitFor("id:import-summary");
  expect(app.texts().some((line) => line.includes("已导入 1") && line.includes("已跳过 1"))).toBe(true);
  expect(app.enabled("id:import-all")).toBe(true);
  app.dispose();
});

test("import summary distinguishes conflicts and errors", async () => {
  const app = await launchInDevices({
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
  const app = await launchInDevices({ folder: "/tmp/ricoh-mac-test-library" });
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
  await app.waitFor("id:home-screen");
  expect(app.shows("id:camera-url")).toBe(false);
  await app.press("id:settings-button");
  await app.waitFor("id:settings-panel");
  expect(app.shows("id:camera-url")).toBe(true);
  expect(app.shows("id:choose-folder")).toBe(true);
  expect(app.value("id:camera-url")).toBe("http://192.168.0.1");
  expect(app.texts()).toContain("相机地址");
  await app.keyboard.press("escape");
  await app.waitUntil(() => !app.shows("id:settings-panel"));
  app.dispose();
});

test("a failed probe is an error, and idle text is not used as that error", async () => {
  const app = await launchInDevices({
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
  expect(texts).not.toContain("未连接");
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
  const app = await launchInDevices({
    folder: "/tmp/ricoh-mac-test-library",
    photos,
    loadThumbnail: async (folder, file) => {
      loadIds.push(`${folder}/${file}`);
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
  expect(loadIds.length).toBe(20);
  await app.press("id:photo-1");
  expect(selectedLine(app)).toBe("共 20 张 · 已选 2 张");
  expect(app.shows("id:photo-grid")).toBe(true);
  app.dispose();
});

test("first connection asks for a camera Wi-Fi profile and then loads photos", async () => {
  const saved: { ssid?: string; password?: string; alreadyOnCamera?: boolean } = {};
  const app = await launchInDevices({
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
  expect(app.texts().some((line) => line.includes("请输入相机屏幕上的密码"))).toBe(true);
  await app.type("id:wifi-password", "secret");
  await app.press("id:save-and-connect");
  await app.waitFor("id:photo-0");
  expect(saved).toEqual({ ssid: "GR_ABCD", password: "secret", alreadyOnCamera: true });
  expect(app.shows("id:photo-grid")).toBe(true);
  app.dispose();
});

test("a utun route to the camera is shown as a hint", async () => {
  const app = await launchInDevices({
    folder: "/tmp/ricoh-mac-test-library",
    wifiSettings: { ...defaultWifiSettings, viaUtun: "utun4" },
    wifiConnect: async () => needProfileResult({ viaUtun: "utun4" }),
  });
  await app.waitFor("id:connect-camera");
  await app.press("id:connect-camera");
  await app.waitFor("id:utun-hint");
  expect(app.texts().some((line) => line.includes("代理") && line.includes("排除"))).toBe(true);
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
            profile: savedProfile,
            profiles: [savedProfile],
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
  const app = await launchInDevices({
    folder: "/tmp/ricoh-mac-test-library",
    wifiSettings: {
      profile: { id: "ssid:GR_ABCD", model: null, serial: null, firmware: null, ssid: "GR_ABCD" },
      profiles: [],
      autoSwitchBack: true,
      previousSsid: "HomeNet",
      canSwitchBack: true,
      viaUtun: null,
    },
    wifiSwitchBackAfterImport: async () => {
      switchedBack = true;
      return { kind: "restored", ssid: "HomeNet", message: "已切回 HomeNet" };
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
  expect(app.texts()).toContain("已切回 HomeNet");
  app.dispose();
});

test("opening my photos without a library asks for a folder", async () => {
  const app = await launchInPhotos({ folder: null });
  await app.waitFor("id:first-run");
  expect(app.texts()).toContain("选择保存位置");
  expect(app.texts().some((line) => line.includes("原文件名"))).toBe(true);
  expect(app.shows("id:connect-camera")).toBe(false);
  expect(app.shows("id:import-selected")).toBe(false);
  app.dispose();
});

test("my photos lists imported files without a camera connection", async () => {
  const app = await launchInPhotos({
    folder: "/tmp/ricoh-mac-test-library",
    libraryPhotos: sampleAlbum,
    wifiConnect: async () => {
      throw new Error("camera should not be contacted");
    },
  });
  await app.waitFor("id:album-photo-0");
  const texts = app.texts();
  expect(texts).toContain("共 3 张");
  expect(texts).toContain("R0000001.JPG");
  expect(texts).toContain("R0000002.DNG");
  expect(texts).toContain("R0000003.JPG");
  expect(app.shows("id:import-selected")).toBe(false);
  expect(app.shows("id:connect-camera")).toBe(false);
  expect(app.shows("id:photo-viewer")).toBe(false);
  app.dispose();
});

function showsViewerPhoto(app: { shows: (selector: string) => boolean }, id: string): boolean {
  return app.shows(`id:viewer-photo-${id}`);
}

async function openFirstAlbumPhoto(moduleOverrides?: Parameters<typeof modules>[0]) {
  const app = await launchInPhotos({
    folder: "/tmp/ricoh-mac-test-library",
    libraryPhotos: sampleAlbum,
    ...moduleOverrides,
  });
  await app.waitFor("id:album-photo-0");
  await app.press("id:album-photo-0");
  await app.waitFor("id:photo-viewer");
  await app.waitFor("id:viewer-photo-R0000001.JPG");
  return app;
}

test("opening an imported photo shows a large view and clicking next and previous changes the displayed photo", async () => {
  const app = await openFirstAlbumPhoto();
  expect(showsViewerPhoto(app, "R0000001.JPG")).toBe(true);
  expect(app.shows("id:viewer-image")).toBe(true);
  expect(app.texts()).toContain("1 / 3");
  expect(app.enabled("id:viewer-prev")).toBe(false);
  expect(app.enabled("id:viewer-next")).toBe(true);
  await app.press("id:viewer-next");
  await app.waitFor("id:viewer-photo-R0000002.DNG");
  expect(showsViewerPhoto(app, "R0000001.JPG")).toBe(false);
  expect(app.shows("id:viewer-placeholder")).toBe(true);
  expect(app.texts()).toContain("无法预览");
  expect(app.texts()).toContain("2 / 3");
  expect(app.enabled("id:viewer-prev")).toBe(true);
  await app.press("id:viewer-prev");
  await app.waitFor("id:viewer-photo-R0000001.JPG");
  expect(showsViewerPhoto(app, "R0000002.DNG")).toBe(false);
  expect(app.shows("id:viewer-image")).toBe(true);
  expect(app.texts()).toContain("1 / 3");
  await app.press("id:viewer-close");
  await app.waitUntil(() => !app.shows("id:photo-viewer"));
  app.dispose();
});

test("viewer arrow keys move between photos", async () => {
  const app = await openFirstAlbumPhoto();
  await app.keyboard.press("right");
  await app.waitFor("id:viewer-photo-R0000002.DNG");
  expect(showsViewerPhoto(app, "R0000001.JPG")).toBe(false);
  expect(app.texts()).toContain("2 / 3");
  await app.keyboard.press("left");
  await app.waitFor("id:viewer-photo-R0000001.JPG");
  expect(showsViewerPhoto(app, "R0000002.DNG")).toBe(false);
  expect(app.texts()).toContain("1 / 3");
  app.dispose();
});

test("viewer H L J K keys move between photos", async () => {
  const app = await openFirstAlbumPhoto();
  await app.keyboard.press("l");
  await app.waitFor("id:viewer-photo-R0000002.DNG");
  await app.keyboard.press("h");
  await app.waitFor("id:viewer-photo-R0000001.JPG");
  await app.keyboard.press("j");
  await app.waitFor("id:viewer-photo-R0000002.DNG");
  await app.keyboard.press("k");
  await app.waitFor("id:viewer-photo-R0000001.JPG");
  expect(showsViewerPhoto(app, "R0000002.DNG")).toBe(false);
  app.dispose();
});

test("viewer Home and End keys jump to the first and last photos", async () => {
  const app = await openFirstAlbumPhoto();
  await app.keyboard.press("end");
  await app.waitFor("id:viewer-photo-R0000003.JPG");
  expect(showsViewerPhoto(app, "R0000001.JPG")).toBe(false);
  expect(app.texts()).toContain("3 / 3");
  expect(app.enabled("id:viewer-next")).toBe(false);
  await app.keyboard.press("home");
  await app.waitFor("id:viewer-photo-R0000001.JPG");
  expect(showsViewerPhoto(app, "R0000003.JPG")).toBe(false);
  expect(app.texts()).toContain("1 / 3");
  app.dispose();
});

test("Space and Enter open the viewer from the grid and close it", async () => {
  const app = await launchInPhotos({
    folder: "/tmp/ricoh-mac-test-library",
    libraryPhotos: sampleAlbum,
  });
  await app.waitFor("id:album-photo-0");
  expect(app.shows("id:photo-viewer")).toBe(false);
  await app.keyboard.press("space");
  await app.waitFor("id:photo-viewer");
  expect(showsViewerPhoto(app, "R0000001.JPG")).toBe(true);
  await app.keyboard.press("space");
  await app.waitUntil(() => !app.shows("id:photo-viewer"));
  await app.keyboard.press("enter");
  await app.waitFor("id:photo-viewer");
  expect(showsViewerPhoto(app, "R0000001.JPG")).toBe(true);
  await app.keyboard.press("enter");
  await app.waitUntil(() => !app.shows("id:photo-viewer"));
  app.dispose();
});

test("Escape closes the large-image viewer", async () => {
  const app = await openFirstAlbumPhoto();
  await app.keyboard.press("escape");
  await app.waitUntil(() => !app.shows("id:photo-viewer"));
  app.dispose();
});

test("F toggles fit and actual size in the viewer", async () => {
  const app = await openFirstAlbumPhoto();
  expect(app.shows("id:viewer-fit-mode")).toBe(true);
  expect(app.shows("id:viewer-actual-mode")).toBe(false);
  await app.keyboard.press("f");
  await app.waitFor("id:viewer-actual-mode");
  expect(app.shows("id:viewer-fit-mode")).toBe(false);
  await app.keyboard.press("f");
  await app.waitFor("id:viewer-fit-mode");
  expect(app.shows("id:viewer-actual-mode")).toBe(false);
  app.dispose();
});

test("I shows and hides file information in the viewer", async () => {
  const app = await openFirstAlbumPhoto();
  expect(app.shows("id:viewer-info")).toBe(false);
  await app.keyboard.press("i");
  await app.waitFor("id:viewer-info");
  expect(app.texts()).toContain("文件信息");
  expect(app.texts().some((line) => line.includes("位置") && line.includes("/tmp/ricoh-mac-test-library/R0000001.JPG"))).toBe(true);
  expect(app.texts().some((line) => line.includes("大小") && line.includes("1.2 KB"))).toBe(true);
  await app.keyboard.press("i");
  await app.waitUntil(() => !app.shows("id:viewer-info"));
  app.dispose();
});

test("question mark and the help control toggle the shortcut list", async () => {
  const app = await openFirstAlbumPhoto();
  expect(app.shows("id:viewer-hint")).toBe(true);
  expect(app.texts()).toContain("← → 切换  Esc 关闭  ? 快捷键");
  expect(app.shows("id:viewer-shortcuts")).toBe(false);
  await app.keyboard.press("shift+/");
  await app.waitFor("id:viewer-shortcuts");
  expect(app.texts()).toContain("快捷键");
  expect(app.texts().some((line) => line.includes("Esc") && line.includes("关闭"))).toBe(true);
  await app.press("id:viewer-help");
  await app.waitUntil(() => !app.shows("id:viewer-shortcuts"));
  app.dispose();
});

test("after import, viewing imported photos opens the local album", async () => {
  const app = await launchInDevices({
    folder: "/tmp/ricoh-mac-test-library",
    importSelected: async () => ({
      imported: 1,
      skipped: 0,
      conflicts: 0,
      errors: 0,
      items: [{ file: "R0000001.JPG", status: "imported", message: "" }],
    }),
    libraryPhotos: sampleAlbum,
  });
  await app.waitFor("id:connect-camera");
  await app.press("id:connect-camera");
  await app.waitFor("id:photo-0");
  await app.press("id:photo-0");
  await app.press("id:import-selected");
  await app.waitFor("id:view-imported");
  expect(app.texts().some((line) => line.includes("已导入 1"))).toBe(true);
  await app.press("id:view-imported");
  await app.waitFor("id:album-grid");
  expect(app.texts()).toContain("R0000001.JPG");
  expect(app.shows("id:import-selected")).toBe(false);
  expect(app.shows("id:area-photos")).toBe(true);
  app.dispose();
});

test("the area switch and back control move between home, devices, and photos", async () => {
  const app = await launch({
    folder: "/tmp/ricoh-mac-test-library",
    libraryPhotos: sampleAlbum,
  });
  await app.waitFor("id:home-screen");
  await app.press("id:open-devices");
  await app.waitFor("id:connect-camera");
  await app.press("id:area-photos");
  await app.waitFor("id:album-photo-0");
  expect(app.texts()).toContain("R0000001.JPG");
  await app.press("id:area-devices");
  await app.waitFor("id:connect-camera");
  await app.press("id:back-home");
  await app.waitFor("id:home-screen");
  expect(app.shows("id:connect-camera")).toBe(false);
  app.dispose();
});

test("my devices lists saved camera profiles", async () => {
  const connectedIds: string[] = [];
  const app = await launchInDevices({
    folder: "/tmp/ricoh-mac-test-library",
    wifiSettings: {
      profile: savedProfile,
      profiles: [savedProfile],
      autoSwitchBack: true,
      previousSsid: null,
      canSwitchBack: false,
      viaUtun: null,
    },
    wifiConnectProfile: async (id: string) => {
      connectedIds.push(id);
      return connectResultFromProbe(connected);
    },
  });
  await app.waitFor("id:profile-list");
  expect(app.texts()).toContain("已保存的相机");
  expect(app.texts().some((line) => line.includes("GR_ABCD"))).toBe(true);
  expect(app.shows("id:connect-camera")).toBe(false);
  await app.press("id:connect-profile-s1");
  await app.waitFor("id:photo-0");
  expect(connectedIds).toEqual(["s1"]);
  app.dispose();
});
