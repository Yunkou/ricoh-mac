import { View, keymap, setColorScheme } from "nsh";
import { Shell } from "./components/shell";
import { selectedIds } from "./state/selection";
import { createAppModel, type AppModel } from "./state/app-model";
import { color } from "./theme";

export function App() {
  setColorScheme("dark");
  const model = createAppModel();
  void model.loadSettings();
  bindKeys(model);

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
      <Shell model={model} />
    </View>
  );
}

function bindKeys(model: AppModel) {
  keymap.bind(
    {
      left: () => {
        if (model.viewingId()) {
          model.showAdjacentPhoto(-1);
        }
      },
      right: () => {
        if (model.viewingId()) {
          model.showAdjacentPhoto(1);
        }
      },
      h: () => {
        if (model.viewingId()) {
          model.showAdjacentPhoto(-1);
        }
      },
      l: () => {
        if (model.viewingId()) {
          model.showAdjacentPhoto(1);
        }
      },
      k: () => {
        if (model.viewingId()) {
          model.showAdjacentPhoto(-1);
        }
      },
      j: () => {
        if (model.viewingId()) {
          model.showAdjacentPhoto(1);
        }
      },
    },
    { when: "notEditing", repeat: true },
  );
  keymap.bind(
    {
      "mod+a": () => {
        if (model.mainArea() !== "devices" || model.viewingId()) {
          return;
        }
        model.onSelectAll();
      },
      escape: () => {
        if (model.settingsOpen()) {
          model.settingsOpen.set(false);
          return;
        }
        if (model.mainArea() === "photo" || model.viewingId()) {
          model.closePhoto();
          return;
        }
        if (model.mainArea() === "devices") {
          model.onClearSelection();
        }
      },
      "mod+enter": () => {
        if (model.mainArea() !== "devices" || model.viewingId()) {
          return;
        }
        const ids = selectedIds(model.selected());
        if (ids.length === 0 || model.isBusy() || !model.libraryFolder()) {
          return;
        }
        void model.importPhotos(ids, false);
      },
      "mod+r": () => {
        if (model.mainArea() === "photos") {
          void model.loadAlbum();
          return;
        }
        if (model.mainArea() === "devices") {
          void model.refreshList();
        }
      },
      home: () => {
        if (model.viewingId()) {
          model.showEdgePhoto("first");
        }
      },
      end: () => {
        if (model.viewingId()) {
          model.showEdgePhoto("last");
        }
      },
      space: () => {
        if (model.mainArea() === "photo") {
          return;
        }
        if (model.mainArea() === "photos") {
          model.openFocusedPhoto();
          return;
        }
        if (model.mainArea() !== "devices") {
          return;
        }
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
      enter: () => {
        if (model.mainArea() === "photo") {
          return;
        }
        if (model.mainArea() === "photos") {
          model.openFocusedPhoto();
        }
      },
      "0": () => model.ratePhoto(0),
      "1": () => model.ratePhoto(1),
      "2": () => model.ratePhoto(2),
      "3": () => model.ratePhoto(3),
      "4": () => model.ratePhoto(4),
      "5": () => model.ratePhoto(5),
      p: () => model.flagPhoto("picked"),
      x: () => model.flagPhoto("rejected"),
      u: () => model.clearPhotoFlag(),
    },
    { when: "notEditing" },
  );
}
