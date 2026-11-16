import { expect, open, test } from "nsh/test";
import type { ConnectResult, DevelopedRawPreview, ImportProgress, ImportReport, LibraryPhoto, PhotoDetails, PhotoItem, PhotoMarks, ProfileView, SwitchBackResult, WifiSettings } from "ricoh-mac/native";
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

function albumPhoto(
  photo: Omit<LibraryPhoto, "rating" | "flag" | "marksError"> &
    Partial<Pick<LibraryPhoto, "rating" | "flag" | "marksError">>,
): LibraryPhoto {
  return {
    rating: 0,
    flag: "none",
    marksError: null,
    ...photo,
  };
}

const sampleAlbum: LibraryPhoto[] = [
  albumPhoto({ id: "R0000001.JPG", file: "R0000001.JPG", size: 1200, path: "/tmp/ricoh-mac-test-library/R0000001.JPG", previewUrl: "file:///tmp/ricoh-mac-test-library/R0000001.JPG" }),
  albumPhoto({ id: "R0000002.DNG", file: "R0000002.DNG", size: 2400, path: "/tmp/ricoh-mac-test-library/R0000002.DNG", previewUrl: null }),
  albumPhoto({ id: "R0000003.JPG", file: "R0000003.JPG", size: 1300, path: "/tmp/ricoh-mac-test-library/R0000003.JPG", previewUrl: "file:///tmp/ricoh-mac-test-library/R0000003.JPG" }),
];


function albumDetails(photo: LibraryPhoto): PhotoDetails {
  const dng = photo.file.toLowerCase().endsWith(".dng");
  if (dng) {
    return {
      file: photo.file,
      format: "dng",
      size: photo.size ?? null,
      width: null,
      height: null,
      aspectRatio: null,
      colorSpace: null,
      takenAt: null,
      aperture: null,
      shutter: null,
      iso: null,
      exposureCompensation: null,
      exposureMode: null,
      meteringMode: null,
      cameraMake: null,
      cameraModel: null,
      lens: null,
      focalLength: null,
      focalLength35mm: null,
      cropMode: null,
      whiteBalance: null,
      colorTemperature: null,
      imageControl: null,
      focusMode: null,
      fullPressSnap: null,
      ndFilter: null,
      gps: null,
      previewUrl: photo.previewUrl ?? null,
      previewSource: photo.previewUrl ? "preview" : null,
      histogram: null,
    };
  }
  return {
    file: photo.file,
    format: "jpeg",
    size: photo.size ?? null,
    width: 6000,
    height: 4000,
    aspectRatio: "3:2",
    colorSpace: "srgb",
    takenAt: "2026-11-15 20:30:00",
    aperture: "F2.8",
    shutter: "1/500",
    iso: "400",
    exposureCompensation: "+0.3",
    exposureMode: "aperture",
    meteringMode: "pattern",
    cameraMake: "RICOH",
    cameraModel: "RICOH GR IIIx",
    lens: "18.3 mm F2.8",
    focalLength: "18.3 mm",
    focalLength35mm: "40 mm",
    cropMode: "off",
    whiteBalance: "auto",
    colorTemperature: null,
    imageControl: "positive_film",
    focusMode: "snap",
    fullPressSnap: "on",
    ndFilter: "off",
    gps: "31.2° N, 121.47° E",
    previewUrl: photo.previewUrl ?? null,
    previewSource: photo.previewUrl ? "original" : null,
    histogram: {
      red: new Array(256).fill(0).map((_, index) => (index > 200 ? 10 : 1)),
      green: new Array(256).fill(1),
      blue: new Array(256).fill(1),
      source: "original",
    },
  };
}

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
  photoDetails?: (path: string) => Promise<PhotoDetails> | PhotoDetails;
  loadPreview?: (path: string) => Promise<string | null> | string | null;
  developRawPreview?: (path: string) => Promise<DevelopedRawPreview> | DevelopedRawPreview;
  setPhotoMarks?: (path: string, rating: number, flag: string) => Promise<PhotoMarks> | PhotoMarks;
}) {
  const folder = options?.folder === undefined ? null : options.folder;
  const photos = options?.photos ?? samplePhotos;
  const probe = options?.probe ?? connected;
  const settings = options?.wifiSettings ?? defaultWifiSettings;
  const readSettings = () => (typeof settings === "function" ? settings() : settings);
  const listedSource = options?.libraryPhotos ?? [];
  let storedPhotos: LibraryPhoto[] | null =
    typeof listedSource === "function" ? null : listedSource.map((photo) => albumPhoto(photo));
  const readLibraryPhotos = () => {
    if (typeof listedSource === "function") {
      return listedSource().map((photo) => albumPhoto(photo));
    }
    return storedPhotos ?? [];
  };
  const defaultSetPhotoMarks = async (path: string, rating: number, flag: string): Promise<PhotoMarks> => {
    const listed = readLibraryPhotos();
    const index = listed.findIndex((item) => item.path === path);
    if (index < 0) {
      throw new Error("找不到这张照片。");
    }
    const next = albumPhoto({ ...listed[index], rating, flag, marksError: null });
    if (storedPhotos) {
      storedPhotos = storedPhotos.map((item, itemIndex) => (itemIndex === index ? next : item));
    }
    return { rating, flag };
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
      "Library.listPhotos": async () => ({ photos: readLibraryPhotos(), warning: null }),
      "Library.setPhotoMarks": options?.setPhotoMarks ?? defaultSetPhotoMarks,
      "Library.loadPreview": async (path: string) => {
        if (options?.loadPreview) {
          return options.loadPreview(path);
        }
        return null;
      },
      "Library.photoDetails": async (path: string) => {
        if (options?.photoDetails) {
          return options.photoDetails(path);
        }
        const listed = readLibraryPhotos();
        const photo = listed.find((item) => item.path === path) ?? listed.find((item) => item.id === path.split("/").pop());
        if (!photo) {
          throw new Error("找不到这张照片。");
        }
        return albumDetails(photo);
      },
      "Library.developRawPreview": async (path: string) => {
        if (options?.developRawPreview) {
          return options.developRawPreview(path);
        }
        throw new Error("无法从这张 DNG 显影 RAW。");
      },
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
  await app.waitFor("id:confirm-delete-profile");
  expect(deleted).toBe(false);
  expect(app.texts()).toContain("将同时删除钥匙串中已保存的密码。");
  expect(app.shows("id:profile-empty")).toBe(false);
  await app.press("id:confirm-delete-profile");
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
  expect(app.shows("id:photo-detail")).toBe(false);
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
  await app.waitFor("id:photo-detail");
  await app.waitFor("id:viewer-photo-R0000001.JPG");
  expect(app.shows("id:album-grid")).toBe(false);
  return app;
}

test("the album grid lists first, then fills a DNG cell from its embedded preview", async () => {
  const order: string[] = [];
  const calls: string[] = [];
  const app = await launchInPhotos({
    folder: "/tmp/ricoh-mac-test-library",
    libraryPhotos: () => {
      order.push("list");
      return sampleAlbum;
    },
    loadPreview: (path: string) => {
      order.push("preview");
      calls.push(path);
      return "file:///tmp/ricoh-mac-test-library/R0000002.preview.jpg";
    },
  });
  await app.waitFor("id:album-grid");
  await app.waitFor("id:album-preview-R0000001.JPG");
  await app.waitFor("id:album-preview-R0000002.DNG");
  expect(app.shows("id:album-missing-R0000002.DNG")).toBe(false);
  expect(order[0]).toBe("list");
  expect(order).toContain("preview");
  expect(order.indexOf("list")).toBeLessThan(order.indexOf("preview"));
  expect(calls.every((path) => path.endsWith("R0000002.DNG"))).toBe(true);
  expect(calls.filter((path) => path.endsWith("R0000002.DNG")).length).toBe(1);
  app.dispose();
});

test("a DNG without a usable preview stays as a placeholder", async () => {
  const calls: string[] = [];
  const app = await launchInPhotos({
    folder: "/tmp/ricoh-mac-test-library",
    libraryPhotos: sampleAlbum,
    loadPreview: async (path: string) => {
      calls.push(path);
      return null;
    },
  });
  await app.waitFor("id:album-missing-R0000002.DNG");
  await app.waitUntil(() => calls.some((path) => path.endsWith("R0000002.DNG")));
  expect(app.shows("id:album-preview-R0000002.DNG")).toBe(false);
  expect(app.texts()).toContain("无法预览");
  expect(app.shows("id:album-preview-R0000001.JPG")).toBe(true);
  expect(calls.filter((path) => path.endsWith("R0000001.JPG")).length).toBe(0);
  app.dispose();
});

test("a cached DNG preview from the listing is shown without extracting again", async () => {
  const calls: string[] = [];
  const photos = sampleAlbum.map((photo) =>
    photo.id === "R0000002.DNG"
      ? { ...photo, previewUrl: "file:///tmp/ricoh-mac-test-library/R0000002.preview.jpg" }
      : photo,
  );
  const app = await launchInPhotos({
    folder: "/tmp/ricoh-mac-test-library",
    libraryPhotos: photos,
    loadPreview: async (path: string) => {
      calls.push(path);
      return "file:///tmp/should-not-load.jpg";
    },
  });
  await app.waitFor("id:album-preview-R0000002.DNG");
  expect(app.shows("id:album-missing-R0000002.DNG")).toBe(false);
  expect(calls).toEqual([]);
  app.dispose();
});

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
  await app.press("id:photo-back");
  await app.waitUntil(() => !app.shows("id:photo-detail"));
  await app.waitFor("id:album-grid");
  expect(app.shows("id:album-photo-0")).toBe(true);
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

test("Space and Enter open the detail page from the grid and do not close it", async () => {
  const app = await launchInPhotos({
    folder: "/tmp/ricoh-mac-test-library",
    libraryPhotos: sampleAlbum,
  });
  await app.waitFor("id:album-photo-0");
  expect(app.shows("id:photo-detail")).toBe(false);
  await app.keyboard.press("space");
  await app.waitFor("id:photo-detail");
  expect(showsViewerPhoto(app, "R0000001.JPG")).toBe(true);
  expect(app.shows("id:album-grid")).toBe(false);
  await app.keyboard.press("space");
  expect(app.shows("id:photo-detail")).toBe(true);
  expect(showsViewerPhoto(app, "R0000001.JPG")).toBe(true);
  await app.keyboard.press("escape");
  await app.waitUntil(() => !app.shows("id:photo-detail"));
  await app.waitFor("id:album-grid");
  await app.keyboard.press("enter");
  await app.waitFor("id:photo-detail");
  expect(showsViewerPhoto(app, "R0000001.JPG")).toBe(true);
  await app.keyboard.press("enter");
  expect(app.shows("id:photo-detail")).toBe(true);
  expect(app.shows("id:album-grid")).toBe(false);
  app.dispose();
});

test("Escape and Back return to the album grid and restore the photo", async () => {
  const app = await openFirstAlbumPhoto();
  await app.keyboard.press("right");
  await app.waitFor("id:viewer-photo-R0000002.DNG");
  await app.keyboard.press("escape");
  await app.waitUntil(() => !app.shows("id:photo-detail"));
  await app.waitFor("id:album-grid");
  expect(app.shows("id:album-photo-1")).toBe(true);
  await app.keyboard.press("enter");
  await app.waitFor("id:photo-detail");
  expect(showsViewerPhoto(app, "R0000002.DNG")).toBe(true);
  await app.press("id:photo-back");
  await app.waitFor("id:album-grid");
  expect(app.shows("id:photo-detail")).toBe(false);
  expect(app.shows("id:album-photo-1")).toBe(true);
  app.dispose();
});

test("F toggles fit and actual size in the viewer", async () => {
  const app = await openFirstAlbumPhoto();
  expect(app.shows("id:viewer-fit-mode")).toBe(true);
  expect(app.shows("id:viewer-actual-mode")).toBe(false);
  expect(app.texts()).toContain("适应窗口");
  await app.keyboard.press("f");
  await app.waitFor("id:viewer-actual-mode");
  expect(app.shows("id:viewer-fit-mode")).toBe(false);
  expect(app.texts()).toContain("原片 1:1");
  await app.keyboard.press("f");
  await app.waitFor("id:viewer-fit-mode");
  expect(app.shows("id:viewer-actual-mode")).toBe(false);
  app.dispose();
});

test("I shows and hides photographer information in the side panel", async () => {
  const app = await openFirstAlbumPhoto();
  await app.waitFor("id:viewer-info");
  const texts = app.texts();
  expect(texts).toContain("拍摄参数");
  expect(texts).toContain("F2.8");
  expect(texts).toContain("1/500");
  expect(texts).toContain("400");
  expect(texts).toContain("光圈优先");
  expect(texts).toContain("40 mm");
  expect(texts).toContain("未裁切");
  expect(texts).toContain("正片");
  expect(texts).toContain("Snap");
  expect(texts).toContain("2026年11月15日 20:30");
  expect(texts.some((line) => line.includes("/tmp/ricoh-mac-test-library/R0000001.JPG"))).toBe(false);
  expect(app.shows("id:photo-histogram")).toBe(true);
  await app.keyboard.press("i");
  await app.waitUntil(() => !app.shows("id:viewer-info"));
  await app.keyboard.press("i");
  await app.waitFor("id:viewer-info");
  app.dispose();
});

function developedRaw(previewUrl: string): DevelopedRawPreview {
  return {
    previewUrl,
    previewSource: "raw",
    renderedWidth: 4096,
    renderedHeight: 2731,
    histogram: {
      red: new Array(256).fill(0).map((_, index) => (index > 180 ? 8 : 2)),
      green: new Array(256).fill(2),
      blue: new Array(256).fill(2),
      source: "raw",
    },
  };
}

function dngDetailsWithEmbedded(path: string): PhotoDetails {
  const photo = albumPhoto({
    id: "R0000002.DNG",
    file: "R0000002.DNG",
    size: 2400,
    path,
    previewUrl: "file:///tmp/embedded-preview.jpg",
  });
  return {
    ...albumDetails(photo),
    previewUrl: "file:///tmp/embedded-preview.jpg",
    previewSource: "preview",
    width: 6000,
    height: 4000,
    aspectRatio: "3:2",
    histogram: {
      red: new Array(256).fill(1),
      green: new Array(256).fill(1),
      blue: new Array(256).fill(1),
      source: "preview",
    },
  };
}

test("the detail page develops a DNG from RAW and labels the rendered preview and histogram", async () => {
  const app = await openFirstAlbumPhoto({
    photoDetails: (path) => (path.endsWith(".DNG") ? dngDetailsWithEmbedded(path) : albumDetails(sampleAlbum.find((item) => item.path === path) ?? sampleAlbum[0])),
    developRawPreview: async () => developedRaw("file:///tmp/raw-preview.jpg"),
  });
  await app.keyboard.press("right");
  await app.waitFor("id:viewer-photo-R0000002.DNG");
  await app.waitUntil(() => app.texts().includes("当前显示的是 RAW 显影"));
  expect(app.shows("id:viewer-image")).toBe(true);
  expect(app.texts()).toContain("直方图（根据 RAW 显影）");
  expect(app.texts()).toContain("嵌入预览");
  expect(app.texts()).toContain("照片尺寸");
  expect(app.texts()).toContain("6000 × 4000");
  expect(app.texts()).toContain("显示尺寸（RAW 显影）");
  expect(app.texts()).toContain("4096 × 2731");
  await app.keyboard.press("f");
  await app.waitFor("id:viewer-actual-mode");
  expect(app.texts()).toContain("显示尺寸");
  expect(app.texts().includes("原片 1:1")).toBe(false);
  app.dispose();
});

test("a failed RAW develop keeps the embedded preview and names the fallback", async () => {
  const app = await openFirstAlbumPhoto({
    photoDetails: (path) => (path.endsWith(".DNG") ? dngDetailsWithEmbedded(path) : albumDetails(sampleAlbum.find((item) => item.path === path) ?? sampleAlbum[0])),
  });
  await app.keyboard.press("right");
  await app.waitFor("id:viewer-photo-R0000002.DNG");
  await app.waitUntil(() => app.texts().includes("RAW 显影失败，已改用嵌入预览"));
  expect(app.shows("id:viewer-image")).toBe(true);
  expect(app.texts()).toContain("直方图（根据预览）");
  expect(app.texts()).toContain("RAW 显影");
  app.dispose();
});

test("the detail page can switch back to the embedded preview after a RAW develop", async () => {
  const app = await openFirstAlbumPhoto({
    photoDetails: (path) => (path.endsWith(".DNG") ? dngDetailsWithEmbedded(path) : albumDetails(sampleAlbum.find((item) => item.path === path) ?? sampleAlbum[0])),
    developRawPreview: async () => developedRaw("file:///tmp/raw-preview.jpg"),
  });
  await app.keyboard.press("right");
  await app.waitUntil(() => app.texts().includes("当前显示的是 RAW 显影"));
  await app.press("id:viewer-raw-toggle");
  await app.waitUntil(() => app.texts().includes("当前显示的是嵌入预览"));
  expect(app.texts()).toContain("直方图（根据预览）");
  expect(app.texts()).toContain("RAW 显影");
  await app.press("id:viewer-raw-toggle");
  await app.waitUntil(() => app.texts().includes("当前显示的是 RAW 显影"));
  expect(app.texts()).toContain("直方图（根据 RAW 显影）");
  app.dispose();
});

test("question mark and the help control toggle the shortcut list", async () => {
  const app = await openFirstAlbumPhoto();
  expect(app.shows("id:viewer-toolbar")).toBe(true);
  expect(app.shows("id:viewer-nav")).toBe(true);
  expect(app.shows("id:viewer-tools")).toBe(true);
  expect(app.shows("id:viewer-hint")).toBe(false);
  expect(app.shows("id:viewer-shortcuts")).toBe(false);
  await app.keyboard.press("shift+/");
  await app.waitFor("id:viewer-shortcuts");
  expect(app.texts()).toContain("快捷键");
  expect(app.texts().some((line) => line.includes("Esc") && line.includes("返回相册"))).toBe(true);
  await app.press("id:viewer-help");
  await app.waitUntil(() => !app.shows("id:viewer-shortcuts"));
  app.dispose();
});

test("switching to devices from the detail page leaves the photo page", async () => {
  const app = await openFirstAlbumPhoto();
  await app.waitFor("id:photo-detail");
  await app.press("id:area-devices");
  await app.waitUntil(() => !app.shows("id:photo-detail"));
  expect(app.shows("id:album-grid")).toBe(false);
  await app.waitFor("id:connect-camera");
  app.dispose();
});

test("choosing Photos from the detail page returns to the album and restores the photo", async () => {
  const app = await openFirstAlbumPhoto();
  await app.keyboard.press("right");
  await app.waitFor("id:viewer-photo-R0000002.DNG");
  await app.press("id:area-photos");
  await app.waitUntil(() => !app.shows("id:photo-detail"));
  await app.waitFor("id:album-grid");
  expect(app.shows("id:album-photo-1")).toBe(true);
  await app.keyboard.press("enter");
  await app.waitFor("id:photo-detail");
  expect(showsViewerPhoto(app, "R0000002.DNG")).toBe(true);
  app.dispose();
});

test("returning from a later photo keeps that cell available in a long album", async () => {
  const libraryPhotos = Array.from({ length: 40 }, (_, index) => {
    const file = `R${String(index + 1).padStart(7, "0")}.JPG`;
    return albumPhoto({
      id: file,
      file,
      size: 1200,
      path: `/tmp/ricoh-mac-test-library/${file}`,
      previewUrl: `file:///tmp/ricoh-mac-test-library/${file}`,
    });
  });
  const app = await launchInPhotos({
    folder: "/tmp/ricoh-mac-test-library",
    libraryPhotos,
  });
  await app.waitFor("id:album-photo-0");
  await app.press("id:album-photo-0");
  await app.waitFor("id:photo-detail");
  await app.keyboard.press("end");
  await app.waitFor("id:viewer-photo-R0000040.JPG");
  expect(app.texts()).toContain("40 / 40");
  await app.keyboard.press("escape");
  await app.waitFor("id:album-grid");
  expect(app.shows("id:photo-detail")).toBe(false);
  await app.waitFor("id:album-photo-39");
  await app.keyboard.press("enter");
  await app.waitFor("id:photo-detail");
  expect(showsViewerPhoto(app, "R0000040.JPG")).toBe(true);
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

test("album and detail show the same marks, and shortcuts persist after a reload", async () => {
  const app = await openFirstAlbumPhoto();
  await app.keyboard.press("3");
  await app.waitFor("id:cull-summary");
  expect(app.texts()).toContain("3 星");
  await app.keyboard.press("p");
  await app.waitUntil(() => app.texts().includes("3 星 · 已选"));
  expect(app.texts()).toContain("3 星 · 已选");
  await app.keyboard.press("escape");
  await app.waitFor("id:album-grid");
  await app.waitFor("id:cull-R0000001.JPG-summary");
  expect(app.texts()).toContain("3 星 · 已选");
  await app.press("id:back-home");
  await app.waitFor("id:home-screen");
  await app.press("id:open-photos");
  await app.waitFor("id:cull-R0000001.JPG-summary");
  expect(app.texts()).toContain("3 星 · 已选");
  await app.press("id:album-photo-0");
  await app.waitFor("id:cull-summary");
  expect(app.texts()).toContain("3 星 · 已选");
  app.dispose();
});

test("star shortcuts clear, flags stay exclusive, and a failed save is not shown as success", async () => {
  let failNext = false;
  const app = await openFirstAlbumPhoto({
    setPhotoMarks: async (_path: string, rating: number, flag: string) => {
      if (failNext) {
        failNext = false;
        throw new Error("磁盘已满。");
      }
      return { rating, flag };
    },
  });
  await app.keyboard.press("5");
  await app.waitUntil(() => app.texts().includes("5 星"));
  await app.keyboard.press("x");
  await app.waitUntil(() => app.texts().includes("5 星 · 排除"));
  await app.keyboard.press("p");
  await app.waitUntil(() => app.texts().includes("5 星 · 已选"));
  expect(app.texts().includes("5 星 · 排除")).toBe(false);
  await app.keyboard.press("5");
  await app.waitUntil(() => !app.texts().includes("5 星 · 已选"));
  await app.keyboard.press("u");
  await app.waitUntil(() => app.texts().includes("未评级 · 无标记"));
  await app.keyboard.press("2");
  await app.waitUntil(() => app.texts().includes("2 星"));
  await app.waitUntil(() => app.texts().includes("已保存"));
  failNext = true;
  await app.keyboard.press("4");
  await app.waitUntil(() => app.texts().some((line) => line.includes("无法保存标记") && line.includes("磁盘已满")));
  expect(app.texts()).toContain("2 星");
  expect(app.texts().includes("4 星")).toBe(false);
  expect(app.texts().includes("已保存")).toBe(false);
  app.dispose();
});

test("culling shortcuts do not fire while the camera URL field is focused", async () => {
  const app = await openFirstAlbumPhoto();
  await app.keyboard.press("1");
  await app.waitUntil(() => app.texts().includes("1 星"));
  await app.press("id:settings-button");
  await app.waitFor("id:camera-url");
  await app.type("id:camera-url", "x");
  await app.keyboard.press("5");
  await app.keyboard.press("p");
  await app.keyboard.press("x");
  await app.keyboard.press("escape");
  await app.waitUntil(() => !app.shows("id:camera-url"));
  expect(app.texts()).toContain("1 星");
  expect(app.texts().includes("5 星")).toBe(false);
  expect(app.texts().includes("1 星 · 已选")).toBe(false);
  expect(app.texts().includes("1 星 · 排除")).toBe(false);
  app.dispose();
});

test("the album filter hides unmarked photos and updates when a flag changes", async () => {
  const app = await launchInPhotos({
    folder: "/tmp/ricoh-mac-test-library",
    libraryPhotos: sampleAlbum,
  });
  await app.waitFor("id:album-photo-0");
  await app.press("id:cull-R0000001.JPG-flag-picked");
  await app.waitUntil(() => app.texts().includes("已选"));
  await app.press("id:album-filter-picked");
  await app.waitFor("id:album-photo-0");
  expect(app.shows("id:cull-R0000001.JPG-summary")).toBe(true);
  expect(app.shows("id:cull-R0000002.DNG-summary")).toBe(false);
  expect(app.texts()).toContain("共 1 / 3 张");
  await app.press("id:cull-R0000001.JPG-flag-picked");
  await app.waitFor("id:album-filter-empty");
  expect(app.texts()).toContain("没有符合筛选的照片。");
  app.dispose();
});

test("deleting a saved camera profile asks for confirmation first", async () => {
  let deleted = false;
  const app = await launchInDevices({
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
  await app.waitFor("id:delete-profile");
  await app.press("id:delete-profile");
  await app.waitFor("id:cancel-delete-profile");
  expect(deleted).toBe(false);
  await app.press("id:cancel-delete-profile");
  await app.waitUntil(() => app.shows("id:delete-profile"));
  expect(deleted).toBe(false);
  expect(app.shows("id:confirm-delete-profile")).toBe(false);
  app.dispose();
});

test("star and flag saves show in-progress and success feedback", async () => {
  const app = await openFirstAlbumPhoto({
    setPhotoMarks: async (_path: string, rating: number, flag: string) => {
      await new Promise((resolve) => setTimeout(resolve, 400));
      return { rating, flag };
    },
  });
  await app.keyboard.press("3");
  await app.waitUntil(() => app.texts().includes("正在保存…"));
  expect(app.texts().includes("已保存")).toBe(false);
  await app.waitUntil(() => app.texts().includes("已保存"));
  expect(app.texts()).toContain("3 星");
  expect(app.texts().includes("正在保存…")).toBe(false);
  app.dispose();
});

test("the current photo stays visible when it misses the filter, is labeled, and leaves the keep after a matching neighbor", async () => {
  const app = await launchInPhotos({
    folder: "/tmp/ricoh-mac-test-library",
    libraryPhotos: sampleAlbum,
  });
  await app.waitFor("id:album-photo-0");
  await app.press("id:cull-R0000001.JPG-flag-picked");
  await app.waitUntil(() => app.texts().includes("已选"));
  await app.press("id:album-photo-1");
  await app.waitFor("id:viewer-photo-R0000002.DNG");
  await app.press("id:photo-back");
  await app.waitFor("id:album-grid");
  await app.press("id:album-filter-picked");
  await app.waitUntil(() => app.texts().includes("不符合当前筛选"));
  expect(app.shows("id:cull-R0000001.JPG-summary")).toBe(true);
  expect(app.shows("id:cull-R0000002.DNG-summary")).toBe(true);
  expect(app.shows("id:album-kept-R0000002.DNG")).toBe(true);
  expect(app.texts()).toContain("共 1 / 3 张");
  await app.press("id:album-photo-1");
  await app.waitFor("id:viewer-photo-R0000002.DNG");
  expect(app.texts()).toContain("不符合当前筛选 · 1 张符合");
  expect(app.texts().includes("2 / 3")).toBe(false);
  await app.press("id:viewer-prev");
  await app.waitFor("id:viewer-photo-R0000001.JPG");
  expect(app.texts()).toContain("1 / 1");
  expect(app.texts().includes("不符合当前筛选")).toBe(false);
  await app.press("id:photo-back");
  await app.waitFor("id:album-grid");
  expect(app.shows("id:cull-R0000001.JPG-summary")).toBe(true);
  expect(app.shows("id:cull-R0000002.DNG-summary")).toBe(false);
  expect(app.shows("id:album-kept-R0000002.DNG")).toBe(false);
  expect(app.texts()).toContain("共 1 / 3 张");
  app.dispose();
});

test("the album list groups filters and shows format badges and always-visible marks", async () => {
  const app = await launchInPhotos({
    folder: "/tmp/ricoh-mac-test-library",
    libraryPhotos: sampleAlbum,
  });
  await app.waitFor("id:album-photo-0");
  expect(app.shows("id:album-filter-all")).toBe(true);
  expect(app.shows("id:album-filter-picked")).toBe(true);
  expect(app.shows("id:album-filter-rating")).toBe(true);
  expect(app.shows("id:album-filter-rating-3")).toBe(false);
  expect(app.shows("id:album-format-R0000001.JPG")).toBe(true);
  expect(app.shows("id:album-format-R0000002.DNG")).toBe(true);
  expect(app.texts()).toContain("JPEG");
  expect(app.texts()).toContain("DNG");
  expect(app.shows("id:cull-R0000001.JPG-rating-3")).toBe(true);
  expect(app.shows("id:cull-R0000001.JPG-flag-picked")).toBe(true);
  await app.press("id:album-filter-rating");
  await app.waitFor("id:album-filter-rating-menu");
  await app.press("id:album-filter-rating-3");
  await app.waitUntil(() => app.texts().includes("共 0 / 3 张"));
  await app.waitFor("id:album-filter-empty");
  await app.press("id:album-filter-all");
  await app.waitFor("id:album-photo-0");
  expect(app.texts()).toContain("共 3 张");
  app.dispose();
});

test("the detail tool strip keeps navigation, marks, and source switching without a hint line", async () => {
  const app = await openFirstAlbumPhoto({
    photoDetails: (path) =>
      path.endsWith(".DNG") ? dngDetailsWithEmbedded(path) : albumDetails(sampleAlbum.find((item) => item.path === path) ?? sampleAlbum[0]),
    developRawPreview: async () => developedRaw("file:///tmp/raw-preview.jpg"),
  });
  await app.waitFor("id:viewer-toolbar");
  expect(app.shows("id:viewer-hint")).toBe(false);
  expect(app.shows("id:viewer-prev")).toBe(true);
  expect(app.shows("id:viewer-next")).toBe(true);
  expect(app.shows("id:cull-rating-3")).toBe(true);
  expect(app.shows("id:cull-flag-picked")).toBe(true);
  expect(app.shows("id:viewer-fit")).toBe(true);
  expect(app.shows("id:viewer-info-button")).toBe(true);
  expect(app.shows("id:viewer-help")).toBe(true);
  await app.keyboard.press("right");
  await app.waitFor("id:viewer-photo-R0000002.DNG");
  await app.waitUntil(() => app.texts().includes("当前显示的是 RAW 显影"));
  await app.press("id:viewer-raw-toggle");
  await app.waitUntil(() => app.texts().includes("当前显示的是嵌入预览"));
  await app.press("id:viewer-info-button");
  await app.waitUntil(() => !app.shows("id:viewer-info"));
  await app.keyboard.press("i");
  await app.waitFor("id:viewer-info");
  await app.keyboard.press("escape");
  await app.waitFor("id:album-grid");
  expect(app.shows("id:album-photo-1")).toBe(true);
  app.dispose();
});
