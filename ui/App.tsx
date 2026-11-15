import { View, keymap, setColorScheme } from "nsh";
import { ImportStrip } from "./components/import-strip";
import { NoticeBanner } from "./components/notice-banner";
import { SettingsPanel } from "./components/settings-panel";
import { Toolbar } from "./components/toolbar";
import { Workspace } from "./components/workspace";
import { selectedIds } from "./state/selection";
import { createAppModel } from "./state/app-model";
import { color } from "./theme";

export function App() {
  setColorScheme("dark");
  const model = createAppModel();
  void model.loadSettings();

  keymap.bind(
    {
      "mod+a": () => model.onSelectAll(),
      escape: () => {
        if (model.settingsOpen()) {
          model.settingsOpen.set(false);
          return;
        }
        model.onClearSelection();
      },
      "mod+enter": () => {
        const ids = selectedIds(model.selected());
        if (ids.length === 0 || model.isBusy() || !model.libraryFolder()) {
          return;
        }
        void model.importPhotos(ids, false);
      },
      "mod+r": () => {
        void model.refreshList();
      },
      space: () => {
        const id = model.focusedId();
        if (!id) {
          return;
        }
        const index = model.photos().findIndex((photo) => photo.id === id);
        if (index < 0) {
          return;
        }
        model.onPhotoPress(index, id);
      },
    },
    { when: "notEditing" },
  );

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
      <Toolbar model={model} />
      <ImportStrip importPhase={model.importPhase} />
      <NoticeBanner notice={model.notice} banner={model.banner} />
      <Workspace model={model} />
      <SettingsPanel model={model} />
    </View>
  );
}
