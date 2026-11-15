import { signal } from "nsh";
import type { ViewRef } from "nsh";
import { Camera, Library, Wifi } from "ricoh-mac/native";
import type {
  ConnectResult,
  ImportProgress as ImportProgressEvent,
  LibraryPhoto,
  PhotoDetails,
  WifiSettings,
} from "ricoh-mac/native";
import { copy } from "../copy";
import { createThumbLoader, mergeThumb, splitListedPhotos } from "../lib/thumb-loader";
import type { ListedPhoto, ThumbRequest } from "../lib/thumb-loader";
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
import {
  adjacentPhotoId,
  filterAlbumPhotos,
  matchingAlbumPhotos,
  nextFlag,
  nextRating,
  normalizeFlag,
  normalizeRating,
  type AlbumFilter,
  type CullFlag,
} from "./cull";
import { rasterSize } from "./preview-display";

export type MarksStatus = {
  state: "idle" | "saving" | "saved" | "failed";
  id: string | null;
};

const defaultWifiSettings: WifiSettings = {
  profile: null,
  profiles: [],
  autoSwitchBack: true,
  previousSsid: null,
  canSwitchBack: false,
  viaUtun: null,
};

export type MainArea = "home" | "devices" | "photos" | "photo";
export type AlbumPhoto = LibraryPhoto;
export type { PhotoDetails };

export const infoPanelMinWidth = 900;

export function isCurrentDetailsRequest(
  token: number,
  detailsToken: number,
  viewingId: string | null,
  id: string,
): boolean {
  return token === detailsToken && viewingId === id;
}

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
  const showDevices = signal(false);
  const showPhotos = signal(false);
  const settingsAnchor = signal<ViewRef | null>(null);
  const wifiSettings = signal<WifiSettings>(defaultWifiSettings);
  const ssidDraft = signal("");
  const passwordDraft = signal("");
  const banner = signal<Banner | null>(null);
  const focusedId = signal<string | null>(null);
  const rangeAnchor = signal<number | null>(null);
  const listing = signal(false);
  const mainArea = signal<MainArea>("home");
  const albumPhotos = signal<AlbumPhoto[]>([]);
  const albumListing = signal(false);
  const viewingId = signal<string | null>(null);
  const restorePhotoId = signal<string | null>(null);
  const photoDetails = signal<PhotoDetails | null>(null);
  const rawStatus = signal<"idle" | "loading" | "ready" | "failed">("idle");
  const preferRaw = signal(true);
  const previewRasterSize = signal<{ width: number; height: number } | null>(null);
  const marksStatus = signal<MarksStatus>({ state: "idle", id: null });
  let detailsToken = 0;
  const thumbLoader = createThumbLoader({
    concurrency: 4,
    load: (item) => Camera.loadThumbnail(item.folder, item.file),
    onLoaded: (id, path) => {
      thumbs.set(mergeThumb(thumbs(), id, path));
    },
  });
  const albumFilter = signal<AlbumFilter>({ kind: "all" });
  const visibleAlbumPhotos = signal<AlbumPhoto[]>([]);
  const albumThumbs = signal<Record<string, string>>({});
  const albumThumbLoader = createThumbLoader({
    concurrency: 4,
    load: (item) => (item.path ? Library.loadPreview(item.path) : Promise.resolve(null)),
    onLoaded: (id, path) => {
      albumThumbs.set(mergeThumb(albumThumbs(), id, path));
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
        await loadAlbum();
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

  function keepPhotoId(): string | null {
    return viewingId() ?? restorePhotoId() ?? focusedId();
  }

  function refreshVisiblePhotos(keepId?: string | null) {
    const next = filterAlbumPhotos(albumPhotos(), albumFilter(), keepId);
    const current = visibleAlbumPhotos();
    if (
      current.length === next.length &&
      current.every(
        (photo, index) =>
          photo.id === next[index]?.id &&
          photo.rating === next[index]?.rating &&
          photo.flag === next[index]?.flag,
      )
    ) {
      return;
    }
    visibleAlbumPhotos.set(next);
  }

  function applyAlbumList(items: AlbumPhoto[]) {
    albumThumbLoader.reset();
    albumPhotos.set(items);
    refreshVisiblePhotos(keepPhotoId());
    const cached: Record<string, string> = {};
    const pending: ThumbRequest[] = [];
    for (const photo of items) {
      if (photo.previewUrl) {
        cached[photo.id] = photo.previewUrl;
      } else {
        pending.push({
          id: photo.id,
          folder: "",
          file: photo.file,
          path: photo.path,
        });
      }
    }
    albumThumbs.set(cached);
    albumThumbLoader.remember(Object.keys(cached));
    albumThumbLoader.request(pending.slice(0, 24));
  }

  function clearAlbum() {
    albumThumbLoader.reset();
    albumThumbs.set({});
    albumPhotos.set([]);
    visibleAlbumPhotos.set([]);
  }

  async function loadAlbum() {
    if (!libraryFolder()) {
      clearAlbum();
      closePhoto();
      return;
    }
    albumListing.set(true);
    notice.set("");
    try {
      const listing = await Library.listPhotos();
      const items = Array.isArray(listing) ? listing : listing.photos;
      applyAlbumList(items);
      const current = viewingId();
      if (current && !items.some((photo) => photo.id === current)) {
        closePhoto();
      }
      notice.set(Array.isArray(listing) ? "" : (listing.warning ?? ""));
    } catch (err) {
      clearAlbum();
      closePhoto();
      notice.set(`${copy.albumListFailed} ${String(err)}`);
    } finally {
      albumListing.set(false);
    }
  }

  function goHome() {
    mainArea.set("home");
    showDevices.set(false);
    showPhotos.set(false);
    viewingId.set(null);
    settingsOpen.set(false);
  }

  function openDevices() {
    mainArea.set("devices");
    showDevices.set(true);
    showPhotos.set(false);
    viewingId.set(null);
    settingsOpen.set(false);
  }

  async function openPhotos() {
    mainArea.set("photos");
    showDevices.set(false);
    showPhotos.set(true);
    viewingId.set(null);
    settingsOpen.set(false);
    await loadAlbum();
  }

  function showPhoto(id: string) {
    focusedId.set(id);
    viewingId.set(id);
    photoDetails.set(null);
    rawStatus.set("idle");
    preferRaw.set(true);
    previewRasterSize.set(null);
    refreshVisiblePhotos(id);
    void loadPhotoDetails(id);
  }

  function openAlbumPhoto(id: string) {
    mainArea.set("photo");
    showDevices.set(false);
    showPhotos.set(true);
    settingsOpen.set(false);
    showPhoto(id);
  }

  function closePhoto() {
    const current = viewingId();
    if (current) {
      focusedId.set(current);
      restorePhotoId.set(current);
    }
    viewingId.set(null);
    photoDetails.set(null);
    rawStatus.set("idle");
    previewRasterSize.set(null);
    refreshVisiblePhotos(current);
    if (mainArea() === "photo") {
      mainArea.set("photos");
      showDevices.set(false);
      showPhotos.set(true);
    }
  }

  function clearRestorePhoto() {
    restorePhotoId.set(null);
  }

  async function loadPhotoDetails(id: string) {
    const token = ++detailsToken;
    const photo = albumPhotos().find((item) => item.id === id);
    if (!photo) {
      if (token === detailsToken) {
        photoDetails.set(null);
        rawStatus.set("idle");
      }
      return;
    }
    try {
      const details = await Library.photoDetails(photo.path);
      if (!isCurrentDetailsRequest(token, detailsToken, viewingId(), id)) {
        return;
      }
      photoDetails.set(details);
      if (preferRaw() && details.format === "dng") {
        rawStatus.set("loading");
        try {
          const raw = await Library.developRawPreview(photo.path);
          if (!isCurrentDetailsRequest(token, detailsToken, viewingId(), id)) {
            return;
          }
          photoDetails.set({
            ...details,
            previewUrl: raw.previewUrl,
            previewSource: "raw",
            histogram: raw.histogram,
          });
          previewRasterSize.set(rasterSize(raw.renderedWidth, raw.renderedHeight));
          rawStatus.set("ready");
        } catch {
          if (isCurrentDetailsRequest(token, detailsToken, viewingId(), id)) {
            rawStatus.set("failed");
          }
        }
      } else {
        rawStatus.set("idle");
      }
    } catch {
      if (isCurrentDetailsRequest(token, detailsToken, viewingId(), id)) {
        photoDetails.set(null);
        rawStatus.set("idle");
      }
    }
  }

  async function setPreferRaw(value: boolean) {
    preferRaw.set(value);
    const id = viewingId();
    if (!id) {
      return;
    }
    const photo = albumPhotos().find((item) => item.id === id);
    const current = photoDetails();
    if (!photo || !current || current.format !== "dng") {
      return;
    }
    const token = detailsToken;
    if (!value) {
      try {
        const details = await Library.photoDetails(photo.path);
        if (isCurrentDetailsRequest(token, detailsToken, viewingId(), id)) {
          photoDetails.set(details);
          previewRasterSize.set(null);
          rawStatus.set(rawStatus() === "ready" || rawStatus() === "failed" ? rawStatus() : "idle");
        }
      } catch {
        /* Keep the current details if the embedded preview cannot be reloaded. */
      }
      return;
    }
    if (current.previewSource === "raw") {
      return;
    }
    rawStatus.set("loading");
    try {
      const raw = await Library.developRawPreview(photo.path);
      if (!isCurrentDetailsRequest(token, detailsToken, viewingId(), id)) {
        return;
      }
      const baseline = photoDetails();
      if (!baseline) {
        return;
      }
      photoDetails.set({
        ...baseline,
        previewUrl: raw.previewUrl,
        previewSource: "raw",
        histogram: raw.histogram,
      });
      previewRasterSize.set(rasterSize(raw.renderedWidth, raw.renderedHeight));
      rawStatus.set("ready");
    } catch {
      if (isCurrentDetailsRequest(token, detailsToken, viewingId(), id)) {
        rawStatus.set("failed");
      }
    }
  }

  function showAdjacentPhoto(delta: number) {
    const current = viewingId();
    if (!current) {
      return;
    }
    const nextId = adjacentPhotoId(albumPhotos(), albumFilter(), current, delta);
    if (!nextId) {
      return;
    }
    showPhoto(nextId);
  }

  function showEdgePhoto(edge: "first" | "last") {
    if (!viewingId()) {
      return;
    }
    const items = matchingAlbumPhotos(albumPhotos(), albumFilter());
    if (items.length === 0) {
      return;
    }
    showPhoto(edge === "first" ? items[0].id : items[items.length - 1].id);
  }

  function openFocusedPhoto() {
    if (mainArea() !== "photos" || viewingId()) {
      return;
    }
    const items = visibleAlbumPhotos();
    if (items.length === 0) {
      return;
    }
    const focus = focusedId();
    const target = focus && items.some((photo) => photo.id === focus) ? focus : items[0].id;
    openAlbumPhoto(target);
  }

  function cullTargetId() {
    if (mainArea() !== "photos" && mainArea() !== "photo") {
      return null;
    }
    if (viewingId()) {
      return viewingId();
    }
    const focus = focusedId();
    if (focus && albumPhotos().some((photo) => photo.id === focus)) {
      return focus;
    }
    return null;
  }

  function currentMarks(id: string) {
    const photo = albumPhotos().find((item) => item.id === id);
    return {
      rating: normalizeRating(photo?.rating),
      flag: normalizeFlag(photo?.flag ?? "none"),
    };
  }

  function applyLocalMarks(id: string, rating: number, flag: CullFlag) {
    albumPhotos.set(
      albumPhotos().map((photo) =>
        photo.id === id
          ? { ...photo, rating, flag, marksError: null }
          : photo,
      ),
    );
    refreshVisiblePhotos(keepPhotoId());
  }

  async function writeMarks(id: string, rating: number, flag: CullFlag) {
    const photo = albumPhotos().find((item) => item.id === id);
    if (!photo) {
      return;
    }
    marksStatus.set({ state: "saving", id });
    try {
      const saved = await Library.setPhotoMarks(photo.path, rating, flag);
      applyLocalMarks(id, normalizeRating(saved.rating), normalizeFlag(saved.flag));
      marksStatus.set({ state: "saved", id });
      if (notice().startsWith(copy.cullFailed)) {
        notice.set("");
      }
    } catch (err) {
      marksStatus.set({ state: "failed", id });
      notice.set(`${copy.cullFailed} ${String(err)}`);
    }
  }

  function setAlbumFilter(filter: AlbumFilter) {
    albumFilter.set(filter);
    refreshVisiblePhotos(keepPhotoId());
  }

  function ratePhoto(rating: number, id?: string | null) {
    const target = id ?? cullTargetId();
    if (!target) {
      return;
    }
    const marks = currentMarks(target);
    void writeMarks(target, nextRating(marks.rating, rating), marks.flag);
  }

  function flagPhoto(flag: CullFlag, id?: string | null) {
    const target = id ?? cullTargetId();
    if (!target) {
      return;
    }
    const marks = currentMarks(target);
    void writeMarks(target, marks.rating, nextFlag(marks.flag, flag));
  }

  function clearPhotoFlag(id?: string | null) {
    flagPhoto("none", id);
  }

  async function connectProfile(id: string) {
    if (isBusy()) {
      return;
    }
    busy.set("connect");
    connection.set({ kind: "connecting" });
    notice.set("");
    banner.set(null);
    try {
      const result = (await Wifi.connectProfile(id));
      await applyConnectResult(result);
    } catch (err) {
      connection.set({ kind: "error", message: String(err) });
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
    showDevices,
    showPhotos,
    settingsAnchor,
    wifiSettings,
    ssidDraft,
    passwordDraft,
    banner,
    focusedId,
    rangeAnchor,
    listing,
    mainArea,
    albumPhotos,
    visibleAlbumPhotos,
    albumFilter,
    albumThumbs,
    albumListing,
    viewingId,
    restorePhotoId,
    photoDetails,
    rawStatus,
    preferRaw,
    setPreferRaw,
    previewRasterSize,
    marksStatus,
    thumbLoader,
    albumThumbLoader,
    isBusy,
    loadSettings,
    chooseFolder,
    saveCameraUrl,
    resetCameraUrl,
    refreshList,
    connectCamera,
    connectProfile,
    saveAndConnect,
    goHome,
    openDevices,
    openPhotos,
    loadAlbum,
    openAlbumPhoto,
    closePhoto,
    clearRestorePhoto,
    showAdjacentPhoto,
    showEdgePhoto,
    openFocusedPhoto,
    keepPhotoId,
    setAlbumFilter,
    ratePhoto,
    flagPhoto,
    clearPhotoFlag,
    cullTargetId,
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
