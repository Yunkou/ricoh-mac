import {
  Overlay,
  Text,
  View,
  keymap,
  mount,
  setColorScheme,
  signal,
} from "nsh";
import type { ViewRef } from "nsh";
import { Input } from "nsh/base";
import { Camera, Library, Wifi } from "ricoh-mac/native";
import type {
  ConnectResult,
  ImportProgress as ImportProgressEvent,
  WifiSettings,
} from "ricoh-mac/native";
import { Button, SettingsMark } from "./button";
import {
  asFileStatus,
  connectionColor,
  connectionLabel,
  displayPath,
  isConflictOrError,
  type Banner,
  type ConnectionState,
  type ImportPhase,
} from "./connection";
import { copy } from "./copy";
import { PhotoGrid } from "./photo-grid";
import type { FileStatus, PressModifiers } from "./photo-grid";
import {
  applyRange,
  idsByFileName,
  selectAll,
  selectedCount,
  selectedIds,
  toggleId,
} from "./selection";
import { color, focusRing, inputStyle, radius, space, type } from "./theme";
import { createThumbLoader, mergeThumb, splitListedPhotos } from "./thumb-loader";
import type { ListedPhoto } from "./thumb-loader";

const defaultWifiSettings: WifiSettings = {
  profile: null,
  autoSwitchBack: true,
  previousSsid: null,
  canSwitchBack: false,
  viaUtun: null,
};

function App() {
  setColorScheme("dark");

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

  void loadSettings();

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

  keymap.bind(
    {
      "mod+a": () => onSelectAll(),
      escape: () => {
        if (settingsOpen()) {
          settingsOpen.set(false);
          return;
        }
        onClearSelection();
      },
      "mod+enter": () => {
        const ids = selectedIds(selected());
        if (ids.length === 0 || isBusy() || !libraryFolder()) {
          return;
        }
        void importPhotos(ids, false);
      },
      "mod+r": () => {
        void refreshList();
      },
      space: () => {
        const id = focusedId();
        if (!id) {
          return;
        }
        const index = photoIds().indexOf(id);
        if (index < 0) {
          return;
        }
        onPhotoPress(index, id);
      },
    },
    { when: "notEditing" },
  );

  function renderToolbar() {
    const folder = libraryFolder();
    const count = selectedCount(selected());
    const total = photos().length;
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space.md,
          paddingHorizontal: space.lg,
          paddingVertical: space.md,
          backgroundColor: color.surface,
          borderBottomWidth: 1,
          borderColor: color.border,
        }}
      >
        <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
          <Text
            testID="connection-status"
            style={{ color: connectionColor(connection()), fontSize: type.body, fontWeight: "600", numberOfLines: 1, textOverflow: "ellipsis" }}
          >
            {connectionLabel(connection())}
          </Text>
          {folder ? (
            <Text
              testID="library-path"
              style={{ color: color.tertiary, fontSize: type.meta, lineHeight: type.lineMeta, numberOfLines: 1, textOverflow: "ellipsis" }}
            >
              {displayPath(folder)}
            </Text>
          ) : null}
        </View>
        {total > 0 ? (
          <Text style={{ color: color.secondary, fontSize: type.meta }} testID="photo-count">
            {copy.photoCount(total, count)}
          </Text>
        ) : null}
        {total > 0 ? (
          <>
            <Button
              label={copy.selectAll}
              kind="ghost"
              testID="select-all"
              disabled={isBusy()}
              onPress={onSelectAll}
            />
            <Button
              label={copy.clearSelection}
              kind="ghost"
              testID="clear-selection"
              disabled={isBusy() || count === 0}
              onPress={onClearSelection}
            />
            <Button
              label={copy.importSelected(count)}
              kind="primary"
              testID="import-selected"
              disabled={isBusy() || count === 0}
              onPress={() => void importPhotos(selectedIds(selected()), false)}
            />
            <Button
              label={copy.importAll}
              kind="secondary"
              testID="import-all"
              disabled={isBusy() || total === 0}
              onPress={() => void importPhotos([], true)}
            />
          </>
        ) : null}
        {folder && connection().kind === "connected" ? (
          <Button
            label={copy.refreshList}
            kind="ghost"
            testID="refresh-list"
            disabled={isBusy()}
            onPress={() => void refreshList()}
          />
        ) : null}
        {wifiSettings().canSwitchBack && wifiSettings().previousSsid ? (
          <Button
            label={copy.switchBack}
            kind="secondary"
            testID="switch-back"
            disabled={isBusy()}
            onPress={() => void restorePreviousNetwork()}
          />
        ) : null}
        <View
          role="button"
          testID="settings-button"
          accessibilityLabel={copy.settings}
          focusable={true}
          ref={(node) => settingsAnchor.set(node)}
          onPress={() => settingsOpen.set(!settingsOpen())}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: color.border,
            backgroundColor: color.raised,
            alignItems: "center",
            justifyContent: "center",
          }}
          hoverStyle={{ backgroundColor: color.surface }}
          activeStyle={{ opacity: 0.88 }}
          focusVisibleStyle={focusRing}
        >
          <SettingsMark />
        </View>
      </View>
    );
  }

  function renderSettings() {
    if (!settingsOpen()) {
      return null;
    }
    return (
      <Overlay
        testID="settings-panel"
        anchor={settingsAnchor()}
        placement="bottom"
        align="end"
        offset={8}
        margin={12}
        onPressOutside={() => settingsOpen.set(false)}
        onCancel={() => settingsOpen.set(false)}
        style={{
          width: 360,
          backgroundColor: color.raised,
          borderColor: color.border,
          borderWidth: 1,
          borderRadius: radius.panel,
          padding: space.lg,
          gap: space.md,
          boxShadow: [{ x: 0, y: 8, blur: 24, color: color.overlay }],
        }}
      >
        <Text style={{ color: color.text, fontSize: type.emphasis, fontWeight: "600" }}>{copy.settings}</Text>
        <View style={{ gap: space.sm }}>
          <Text style={{ color: color.secondary, fontSize: type.meta }}>{copy.settingsLibrary}</Text>
          <Text style={{ color: color.text, fontSize: type.body }} testID="settings-library-path">
            {libraryFolder() ? libraryFolder() : copy.chooseLibraryTitle}
          </Text>
          <Button
            label={libraryFolder() ? copy.changeLibrary : copy.chooseLibraryAction}
            kind="secondary"
            testID="choose-folder"
            disabled={isBusy()}
            onPress={() => void chooseFolder()}
          />
        </View>
        <View style={{ gap: space.sm }}>
          <Text style={{ color: color.secondary, fontSize: type.meta }}>{copy.profileSection}</Text>
          {wifiSettings().profile ? (
            <>
              <Text testID="profile-identity" style={{ color: color.text, fontSize: type.body }}>
                {copy.profileIdentity(
                  [wifiSettings().profile?.model, wifiSettings().profile?.serial, wifiSettings().profile?.firmware].filter(
                    (part): part is string => Boolean(part),
                  ),
                )}
              </Text>
              <Text testID="profile-ssid" style={{ color: color.secondary, fontSize: type.meta }}>
                {copy.profileSsid(wifiSettings().profile?.ssid ?? "")}
              </Text>
            </>
          ) : (
            <Text testID="profile-empty" style={{ color: color.secondary, fontSize: type.meta }}>
              {copy.noProfile}
            </Text>
          )}
          <Text style={{ color: color.tertiary, fontSize: type.meta }}>{copy.editProfileHelp}</Text>
          <Input
            value={ssidDraft()}
            onChange={(event) => ssidDraft.set(event.value)}
            placeholder={copy.ssidPlaceholder}
            testID="settings-ssid"
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              height: 32,
              paddingHorizontal: space.sm,
              borderRadius: radius.control,
              borderWidth: 1,
              borderColor: color.border,
              color: color.text,
              backgroundColor: color.bg,
              fontSize: type.body,
            }}
            focusVisibleStyle={focusRing}
          />
          <Input
            value={passwordDraft()}
            onChange={(event) => passwordDraft.set(event.value)}
            placeholder={copy.passwordPlaceholder}
            testID="settings-password"
            masked={true}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            style={{
              height: 32,
              paddingHorizontal: space.sm,
              borderRadius: radius.control,
              borderWidth: 1,
              borderColor: color.border,
              color: color.text,
              backgroundColor: color.bg,
              fontSize: type.body,
            }}
            focusVisibleStyle={focusRing}
          />
          <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
            <Button label={copy.saveProfile} kind="secondary" testID="save-profile" disabled={isBusy()} onPress={() => void saveProfileEdits()} />
            {wifiSettings().profile ? (
              <Button label={copy.deleteProfile} kind="ghost" testID="delete-profile" disabled={isBusy()} onPress={() => void removeProfile()} />
            ) : null}
          </View>
          <Button
            label={`${copy.autoSwitchBack}：${wifiSettings().autoSwitchBack ? copy.autoSwitchOn : copy.autoSwitchOff}`}
            kind="ghost"
            testID="auto-switch-back"
            disabled={isBusy()}
            onPress={() => void toggleAutoSwitchBack()}
          />
        </View>
        <View style={{ gap: space.sm }}>
          <Text style={{ color: color.secondary, fontSize: type.meta }}>{copy.settingsCameraUrl}</Text>
          <Text style={{ color: color.tertiary, fontSize: type.meta }}>{copy.settingsCameraUrlHelp}</Text>
          <Input
            value={cameraUrl()}
            onChange={(event) => cameraUrl.set(event.value)}
            testID="camera-url"
            style={{
              height: 32,
              paddingHorizontal: space.sm,
              borderRadius: radius.control,
              borderWidth: 1,
              borderColor: color.border,
              color: color.text,
              backgroundColor: color.bg,
              fontSize: type.body,
            }}
            focusVisibleStyle={focusRing}
          />
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Button label={copy.saveUrl} kind="secondary" testID="save-url" disabled={isBusy()} onPress={() => void saveCameraUrl()} />
            <Button label={copy.resetUrl} kind="ghost" testID="reset-url" disabled={isBusy()} onPress={() => void resetCameraUrl()} />
          </View>
        </View>
      </Overlay>
    );
  }

  function renderProgress() {
    const phase = importPhase();
    if (phase.kind === "idle") {
      return null;
    }
    const ratio =
      phase.kind === "running" && phase.total > 0
        ? Math.max(0, Math.min(1, phase.current / phase.total))
        : phase.kind === "done"
          ? 1
          : 0;
    return (
      <View
        style={{
          paddingHorizontal: space.lg,
          paddingVertical: space.sm,
          gap: space.sm,
          borderBottomWidth: 1,
          borderColor: color.border,
          backgroundColor: color.surface,
        }}
      >
        <View
          testID="progress-bar"
          style={{
            height: 4,
            borderRadius: 2,
            backgroundColor: color.border,
            overflow: "hidden",
          }}
        >
          <View
            testID="progress-fill"
            style={{
              height: 4,
              width: `${Math.round(ratio * 100)}%`,
              backgroundColor: color.accent,
            }}
          />
        </View>
        {phase.kind === "running" ? (
          <Text testID="progress-text" style={{ color: color.secondary, fontSize: type.meta }}>
            {copy.importing(phase.file, phase.current, phase.total)}
          </Text>
        ) : (
          <View style={{ gap: space.xs }}>
            <Text testID="import-summary" style={{ color: color.text, fontSize: type.body }}>
              {copy.importSummary(phase.imported, phase.skipped, phase.conflicts, phase.errors)}
            </Text>
            {phase.issues.map((issue) => (
              <Text
                style={{
                  color: issue.status === "conflict" ? color.warning : color.danger,
                  fontSize: type.meta,
                }}
              >
                {`${issue.file}：${issue.message || (issue.status === "conflict" ? copy.statusConflict : copy.statusError)}`}
              </Text>
            ))}
          </View>
        )}
      </View>
    );
  }

  function renderFirstRun() {
    return (
      <View
        testID="first-run"
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: space.xl,
          gap: space.lg,
        }}
      >
        <Text style={{ color: color.text, fontSize: type.title, lineHeight: type.lineTitle, fontWeight: "600" }}>
          {copy.chooseLibraryTitle}
        </Text>
        <Text
          style={{
            color: color.secondary,
            fontSize: type.body,
            lineHeight: type.lineBody,
            textAlign: "center",
            maxWidth: 420,
          }}
        >
          {copy.chooseLibraryBody}
        </Text>
        <Button
          label={copy.chooseLibraryAction}
          kind="primary"
          testID="choose-folder-first"
          disabled={isBusy()}
          onPress={() => void chooseFolder()}
        />
      </View>
    );
  }


  function renderWifiForm() {
    const state = connection();
    const already = state.kind === "need_profile" && state.alreadyOnCamera;
    return (
      <View testID="wifi-profile-form" style={{ gap: space.sm, width: 320, maxWidth: "100%" }}>
        {state.kind === "need_profile" && state.message ? (
          <Text testID="profile-prompt" style={{ color: color.text, fontSize: type.body, lineHeight: type.lineBody }}>
            {state.message}
          </Text>
        ) : null}
        {already ? (
          <Text testID="password-only-hint" style={{ color: color.secondary, fontSize: type.meta }}>
            {copy.passwordOnlyHint}
          </Text>
        ) : (
          <Text style={{ color: color.tertiary, fontSize: type.meta }}>{copy.locationHelp}</Text>
        )}
        <Text style={{ color: color.secondary, fontSize: type.meta }}>{copy.ssidLabel}</Text>
        <Input
          value={ssidDraft()}
          onChange={(event) => ssidDraft.set(event.value)}
          placeholder={copy.ssidPlaceholder}
          testID="wifi-ssid"
          autoCapitalize="none"
          autoCorrect={false}
          style={inputStyle}
          focusVisibleStyle={focusRing}
        />
        <Text style={{ color: color.secondary, fontSize: type.meta }}>{copy.passwordLabel}</Text>
        <Input
          value={passwordDraft()}
          onChange={(event) => passwordDraft.set(event.value)}
          placeholder={copy.passwordPlaceholder}
          testID="wifi-password"
          masked={true}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          style={inputStyle}
          focusVisibleStyle={focusRing}
        />
        <Button
          label={copy.saveCameraWifi}
          kind="primary"
          testID="save-and-connect"
          disabled={isBusy()}
          onPress={() => void saveAndConnect()}
        />
      </View>
    );
  }

  function renderEmptyCanvas() {
    const state = connection();
    const showHelp = state.kind === "idle" || state.kind === "error" || state.kind === "need_profile";
    const title = listing()
      ? copy.loadingPhotos
      : state.kind === "connecting"
        ? copy.connectingStatus
        : state.kind === "need_profile"
          ? copy.needProfileStatus
          : state.kind === "connected"
            ? copy.noPhotos
            : copy.connectCamera;
    const viaUtun = wifiSettings().viaUtun;
    return (
      <View
        testID="empty-canvas"
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: space.xl,
          gap: space.lg,
        }}
      >
        <Text style={{ color: color.text, fontSize: type.title, lineHeight: type.lineTitle, fontWeight: "600" }}>
          {title}
        </Text>
        {viaUtun ? (
          <Text
            testID="utun-hint"
            style={{
              color: color.warning,
              fontSize: type.meta,
              lineHeight: type.lineMeta,
              textAlign: "center",
              maxWidth: 460,
            }}
          >
            {copy.utunHint(viaUtun)}
          </Text>
        ) : null}
        {showHelp && !listing() ? (
          <Text
            testID="connection-help"
            style={{
              color: color.secondary,
              fontSize: type.body,
              lineHeight: type.lineBody,
              textAlign: "center",
              maxWidth: 460,
            }}
          >
            {copy.connectionHelp}
          </Text>
        ) : null}
        {state.kind === "need_profile" && !listing() ? renderWifiForm() : null}
        {state.kind !== "connected" && state.kind !== "connecting" && state.kind !== "need_profile" && !listing() ? (
          <Button
            label={copy.connectCamera}
            kind="primary"
            testID="connect-camera"
            disabled={isBusy()}
            onPress={() => void connectCamera()}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: color.bg,
        paddingTop: "env(safe-area-inset-top)",
        paddingRight: "env(safe-area-inset-right)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
      }}
    >
      {renderToolbar()}
      {renderProgress()}
      {notice() ? (
        <Text
          testID="notice"
          style={{
            color: color.danger,
            fontSize: type.meta,
            paddingHorizontal: space.lg,
            paddingVertical: space.sm,
          }}
        >
          {notice()}
        </Text>
      ) : null}
      {banner() && !notice() ? (
        <Text
          testID="banner"
          style={{
            color: banner()?.tone === "danger" ? color.danger : color.text,
            fontSize: type.meta,
            paddingHorizontal: space.lg,
            paddingVertical: space.sm,
          }}
        >
          {banner()?.text}
        </Text>
      ) : null}
      {!libraryFolder()
        ? renderFirstRun()
        : photos().length === 0
          ? renderEmptyCanvas()
          : (
            <PhotoGrid
              photos={photos}
              thumbs={thumbs}
              selected={selected}
              fileStatus={fileStatus}
              loader={thumbLoader}
              onPhotoPress={onPhotoPress}
              onFocusPhoto={(id) => focusedId.set(id)}
            />
          )}
      {renderSettings()}
    </View>
  );
}

mount(App);