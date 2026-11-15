import { signal } from "nsh";
import type { Signal } from "nsh";
import { ImportStrip } from "./import-strip";
import { NoticeBanner } from "./notice-banner";
import { SettingsPanel } from "./settings-panel";
import { DevicesToolbar, HomeToolbar, PhotosToolbar } from "./toolbar";
import { DevicesWorkspace, PhotosWorkspace } from "./workspace";
import { HomeScreen } from "./home-screen";
import { PhotoViewerHost } from "./photo-viewer";
import type { AppModel } from "../state/app-model";

export function Shell(props: { model: AppModel }) {
  const model = props.model;
  return (
    <>
      <HomeToolbarGate model={model} />
      <DevicesToolbarGate model={model} />
      <PhotosToolbarGate model={model} />
      <DevicesImportGate model={model} />
      <NoticeBanner notice={model.notice} banner={model.banner} />
      <HomeGate model={model} />
      <DevicesGate model={model} />
      <PhotosGate model={model} />
      <PhotoViewerHost model={model} />
      <SettingsPanel model={model} />
    </>
  );
}

export function HomeToolbarGate(props: { model: AppModel }) {
  const visible = signal(true);
  return (
    <>
      {syncVisible(isHome(props.model), visible)}
      {visible() ? <HomeToolbar model={props.model} /> : null}
    </>
  );
}

export function DevicesToolbarGate(props: { model: AppModel }) {
  const visible = signal(false);
  return (
    <>
      {syncVisible(isDevices(props.model), visible)}
      {visible() ? <DevicesToolbar model={props.model} /> : null}
    </>
  );
}

export function PhotosToolbarGate(props: { model: AppModel }) {
  const visible = signal(false);
  return (
    <>
      {syncVisible(isPhotos(props.model), visible)}
      {visible() ? <PhotosToolbar model={props.model} /> : null}
    </>
  );
}

export function DevicesImportGate(props: { model: AppModel }) {
  const visible = signal(false);
  return (
    <>
      {syncVisible(isDevices(props.model), visible)}
      {visible() ? (
        <ImportStrip
          importPhase={props.model.importPhase}
          onViewImported={() => void props.model.openPhotos()}
        />
      ) : null}
    </>
  );
}

export function HomeGate(props: { model: AppModel }) {
  const visible = signal(true);
  return (
    <>
      {syncVisible(isHome(props.model), visible)}
      {visible() ? <HomeScreen model={props.model} /> : null}
    </>
  );
}

export function DevicesGate(props: { model: AppModel }) {
  const visible = signal(false);
  return (
    <>
      {syncVisible(isDevices(props.model), visible)}
      {visible() ? <DevicesWorkspace model={props.model} /> : null}
    </>
  );
}

export function PhotosGate(props: { model: AppModel }) {
  const visible = signal(false);
  return (
    <>
      {syncVisible(isPhotos(props.model), visible)}
      {visible() ? <PhotosWorkspace model={props.model} /> : null}
    </>
  );
}

function isHome(model: AppModel): boolean {
  return !model.showDevices() && !model.showPhotos();
}

function isDevices(model: AppModel): boolean {
  return model.showDevices() && !model.showPhotos();
}

function isPhotos(model: AppModel): boolean {
  return model.showPhotos();
}

function syncVisible(show: boolean, visible: Signal<boolean>): null {
  if (visible() !== show) {
    visible.set(show);
  }
  return null;
}
