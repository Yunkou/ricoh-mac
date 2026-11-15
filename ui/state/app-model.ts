import { signal } from "nsh";
import type { ViewRef } from "nsh";
import { Camera, Library, Wifi } from "ricoh-mac/native";
import type {
  ConnectResult,
  ImportProgress as ImportProgressEvent,
  WifiSettings,
} from "ricoh-mac/native";
import { copy } from "../copy";
import { createThumbLoader, mergeThumb, splitListedPhotos } from "../lib/thumb-loader";
import type { ListedPhoto } from "../lib/thumb-loader";
import {
  applyRange,
  idsByFileName,
  selectAll,
  selectedIds,
  toggleId,
} from "./selection";
import {
  asFileStatus,
  isConflictOrError,
  type Banner,
  type ConnectionState,
  type FileStatus,
  type ImportPhase,
  type PressModifiers,
} from "./connection";

const defaultWifiSettings: WifiSettings = {
  profile: null,
  autoSwitchBack: true,
  previousSsid: null,
  canSwitchBack: false,
  viaUtun: null,
};


export function createAppModel() {
  const libraryFolder = signal<string | null>(null);
  const cameraUrl = signal("http://192.168.0.1");
  const connection = signal<ConnectionState>({ kind: "idle" });
  const busy = signal<string | null>(null);
  const photos = signal<ListedPhoto[]>([]);
  const thumbs = signal<Record<string, string>>({});
  const selected = signal<Record<string, boolean>>({});
  const fileStatus = signal<Record<string, FileStatus>>({});
  const importPhase = signal<ImportPhase>({ kind: "idle" });
  const notice = signal("");
  const settingsOpen = signal(false);
  const settingsAnchor = signal<ViewRef | null>(null);
  const wifiSettings = signal<WifiSettings>(defaultWifiSettings);
  const ssidDraft = signal("");
  const passwordDraft = signal("");
  const banner = signal<Banner | null>(null);
  const focusedId = signal<string | null>(null);
  const rangeAnchor = signal<number | null>(null);
  const listing = signal(false);
  const thumbLoader = createThumbLoader({
    concurrency: 4,
    load: (item) => Camera.loadThumbnail(item.folder, item.file),
    onLoaded: (id, path) => {
      thumbs.set(mergeThumb(thumbs(), id, path));
    },
  });

  function applyPhotoList(items: Parameters<typeof splitListedPhotos>[0]) {
    thumbLoader.reset();
    const listed = splitListedPhotos(items);
    photos.set(listed.photos);
    thumbs.set(listed.thumbs);
    thumbLoader.remember(Object.keys(listed.thumbs));
    selected.set({});
    rangeAnchor.set(null);
    fileStatus.set({});
    importPhase.set({ kind: "idle" });
    thumbLoader.request(listed.photos.slice(0, 24));
  }

  async function loadSettings() {
    try {
      libraryFolder.set(await Library.folder());
      cameraUrl.set(await Library.cameraBaseUrl());
      await refreshWifiSettings();
    } catch (err) {
      notice.set(String(err));
    }
  }

  async function refreshWifiSettings() {
    const settings = (await Wifi.settings());
    wifiSettings.set(settings);
    if (settings.profile?.ssid && !ssidDraft()) {
      ssidDraft.set(settings.profile.ssid);
    }
  }

  function isBusy() {
    return busy() !== null;
  }

  async function chooseFolder() {
    if (isBusy()) {
      return;
    }
    busy.set("folder");
    notice.set("");
    try {
      const path = await Library.pickFolder();
      if (path) {
        libraryFolder.set(path);
      }
    } catch (err) {
      notice.set(String(err));
    } finally {
      busy.set(null);
    }
  }

  async function saveCameraUrl() {
    if (isBusy()) {
      return;
    }
    notice.set("");
    try {
      const saved = await Library.setCameraBaseUrl(cameraUrl());
      cameraUrl.set(saved);
      notice.set(copy.urlSaved(saved));
    } catch (err) {
      notice.set(String(err));
    }
  }

  async function resetCameraUrl() {
    if (isBusy()) {
      return;
    }
    notice.set("");
    try {
      const saved = await Library.resetCameraBaseUrl();
      cameraUrl.set(saved);
      notice.set(copy.urlReset(saved));
    } catch (err) {
      notice.set(String(err));
    }
  }

  async function refreshList() {
    if (!libraryFolder() || isBusy()) {
      return;
    }
    busy.set("list");
    listing.set(true);
    notice.set("");
    try {
      const items = await Camera.listPhotos();
      applyPhotoList(items);
    } catch (err) {
      photos.set([]);
      notice.set(`${copy.listFailed} ${String(err)}`);
    } finally {
      listing.set(false);
      busy.set(null);
    }
  }

  function applyUtun(viaUtun?: string | null) {
    const current = wifiSettings();
    if (current.viaUtun === (viaUtun ?? null)) {
      return;
    }
    wifiSettings.set({ ...current, viaUtun: viaUtun ?? null });
  }

  async function loadPhotos() {
    listing.set(true);
    try {
      const items = await Camera.listPhotos();
      applyPhotoList(items);
    } catch (err) {
      photos.set([]);
      notice.set(`${copy.listFailed} ${String(err)}`);
    } finally {
      listing.set(false);
    }
  }

  async function applyConnectResult(result: ConnectResult) {
    await refreshWifiSettings();
    applyUtun(result.viaUtun);
    if (result.kind === "need_profile") {
      connection.set({
        kind: "need_profile",
        suggestedSsid: result.suggestedSsid ?? undefined,
        alreadyOnCamera: Boolean(result.alreadyOnCamera),
        message: result.message || "",
      });
      if (result.suggestedSsid) {
        ssidDraft.set(result.suggestedSsid);
      }
      return;
    }
    if (result.kind === "connected" && result.connected) {
      connection.set({
        kind: "connected",
        model: result.model ?? undefined,
        serial: result.serial ?? undefined,
        firmware: result.firmware ?? undefined,
        previousSsid: result.previousSsid ?? undefined,
        switched: Boolean(result.switched),
      });
      await loadPhotos();
      return;
    }
    connection.set({ kind: "error", message: result.message || "" });
  }

  async function connectCamera() {
    if (isBusy()) {
      return;
    }
    busy.set("connect");
    connection.set({ kind: "connecting" });
    notice.set("");
    banner.set(null);
    try {
      const result = (await Wifi.connect());
      await applyConnectResult(result);
    } catch (err) {
      connection.set({ kind: "error", message: String(err) });
    } finally {
      busy.set(null);
    }
  }

  async function saveAndConnect() {
    if (isBusy()) {
      return;
    }
    const ssid = ssidDraft().trim();
    const password = passwordDraft();
    if (!ssid || !password) {
      notice.set(!ssid ? copy.needSsid : copy.needPassword);
      return;
    }
    const current = connection();
    const alreadyOnCamera = current.kind === "need_profile" ? current.alreadyOnCamera : false;
    busy.set("connect");
    connection.set({ kind: "connecting" });
    notice.set("");
    banner.set(null);
    try {
      const result = (await Wifi.saveAndConnect(ssid, password, alreadyOnCamera));
      if (result.kind === "connected") {
        passwordDraft.set("");
      }
      await applyConnectResult(result);
    } catch (err) {
      connection.set({ kind: "error", message: String(err) });
    } finally {
      busy.set(null);
    }
  }

  async function saveProfileEdits() {
    if (isBusy()) {
      return;
    }
    const ssid = ssidDraft().trim();
    const password = passwordDraft();
    if (!ssid || !password) {
      notice.set(!ssid ? copy.needSsid : copy.needPassword);
      return;
    }
    notice.set("");
    try {
      await Wifi.saveProfile(ssid, password);
      passwordDraft.set("");
      await refreshWifiSettings();
      banner.set({ text: copy.profileSaved, tone: "info" });
    } catch (err) {
      notice.set(String(err));
    }
  }

  async function removeProfile() {
    if (isBusy()) {
      return;
    }
    try {
      const settings = (await Wifi.deleteProfile());
      wifiSettings.set(settings);
      ssidDraft.set("");
      passwordDraft.set("");
      banner.set({ text: copy.profileDeleted, tone: "info" });
    } catch (err) {
      notice.set(String(err));
    }
  }

  async function toggleAutoSwitchBack() {
    const next = !wifiSettings().autoSwitchBack;
    const saved = await Wifi.setAutoSwitchBack(next);
    wifiSettings.set({ ...wifiSettings(), autoSwitchBack: saved });
  }

  async function restorePreviousNetwork() {
    if (isBusy()) {
      return;
    }
    busy.set("wifi");
    notice.set("");
    try {
      const result = (await Wifi.switchBack());
      await refreshWifiSettings();
      if (result.kind === "failed") {
        notice.set(result.message);
      } else if (result.kind === "restored") {
        banner.set({ text: result.message, tone: "info" });
      }
    } catch (err) {
      notice.set(String(err));
    } finally {
      busy.set(null);
    }
  }

  function photoIds() {
    return photos().map((photo) => photo.id);
  }

  function onPhotoPress(index: number, id: string, event?: PressModifiers) {
    focusedId.set(id);
    if (event?.modifiers?.shift && rangeAnchor() !== null) {
      selected.set(applyRange(photoIds(), rangeAnchor() ?? index, index));
      return;
    }
    selected.set(toggleId(selected(), id));
    rangeAnchor.set(index);
  }

  function onSelectAll() {
    if (photos().length === 0) {
      return;
    }
    selected.set(selectAll(photoIds()));
  }

  function onClearSelection() {
    selected.set({});
  }

  function markProgress(event: ImportProgressEvent) {
    importPhase.set({
      kind: "running",
      file: event.file,
      current: event.current,
      total: event.total,
    });
    const status = asFileStatus(event.status);
    if (!status) {
      return;
    }
    const matches = idsByFileName(photos(), event.file);
    if (matches.length === 0) {
      return;
    }
    const current = fileStatus();
    const target = matches.find((id) => current[id] === "pending") ?? matches[0];
    fileStatus.set({ ...current, [target]: status });
  }

  async function importPhotos(ids: string[], all: boolean) {
    if (isBusy()) {
      return;
    }
    if (!libraryFolder()) {
      notice.set(copy.needLibrary);
      return;
    }
    if (!all && ids.length === 0) {
      notice.set(copy.needSelection);
      return;
    }
    const batchIds = all ? photoIds() : ids;
    const pending: Record<string, FileStatus> = {};
    for (const id of batchIds) {
      pending[id] = "pending";
    }
    fileStatus.set(pending);
    busy.set("import");
    notice.set("");
    importPhase.set({
      kind: "running",
      file: batchIds.length > 0 ? photos().find((photo) => photo.id === batchIds[0])?.file ?? "" : "",
      current: 0,
      total: batchIds.length,
    });
    let importedOk = false;
    try {
      const onProgress = (event: ImportProgressEvent) => {
        markProgress(event);
      };
      const report = (all ? await Camera.importAll(onProgress) : await Camera.importSelected(ids, onProgress));
      const issues = report.items
        .filter((item): item is typeof item & { status: "conflict" | "error" } =>
          isConflictOrError(item.status),
        )
        .map((item) => ({
          file: item.file,
          status: item.status,
          message: item.message,
        }));
      const nextStatus = { ...fileStatus() };
      for (const item of report.items) {
        const status = asFileStatus(item.status);
        if (!status) {
          continue;
        }
        const matches = idsByFileName(photos(), item.file);
        const target = matches.find((id) => nextStatus[id] === "pending") ?? matches[0];
        if (target) {
          nextStatus[target] = status;
        }
      }
      fileStatus.set(nextStatus);
      importPhase.set({
        kind: "done",
        imported: report.imported,
        skipped: report.skipped,
        conflicts: report.conflicts,
        errors: report.errors,
        issues,
      });
      notice.set("");
      importedOk = true;
    } catch (err) {
      importPhase.set({ kind: "idle" });
      notice.set(String(err));
    } finally {
      busy.set(null);
    }
    if (!importedOk) {
      return;
    }
    try {
      const restored = (await Wifi.switchBackAfterImport());
      await refreshWifiSettings();
      if (restored.kind === "restored") {
        banner.set({ text: restored.message, tone: "info" });
      } else if (restored.kind === "failed") {
        notice.set(restored.message);
      }
    } catch (err) {
      notice.set(String(err));
    }
  }

  return {
    libraryFolder,
    cameraUrl,
    connection,
    busy,
    photos,
    thumbs,
    selected,
    fileStatus,
    importPhase,
    notice,
    settingsOpen,
    settingsAnchor,
    wifiSettings,
    ssidDraft,
    passwordDraft,
    banner,
    focusedId,
    rangeAnchor,
    listing,
    thumbLoader,
    isBusy,
    loadSettings,
    chooseFolder,
    saveCameraUrl,
    resetCameraUrl,
    refreshList,
    connectCamera,
    saveAndConnect,
    saveProfileEdits,
    removeProfile,
    toggleAutoSwitchBack,
    restorePreviousNetwork,
    onPhotoPress,
    onSelectAll,
    onClearSelection,
    importPhotos,
  };
}

export type AppModel = ReturnType<typeof createAppModel>;
