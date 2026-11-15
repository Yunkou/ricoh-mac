import type { AppModel } from "../state/app-model";
import { ConnectPanel, FirstRun } from "./empty-state";
import { PhotoGrid } from "./photo-grid";

export function Workspace(props: { model: AppModel }) {
  const model = props.model;
  return (
    <>
      {!model.libraryFolder() ? (
        <FirstRun model={model} />
      ) : model.photos().length === 0 ? (
        <ConnectPanel model={model} />
      ) : (
        <PhotoGrid
          photos={model.photos}
          thumbs={model.thumbs}
          selected={model.selected}
          fileStatus={model.fileStatus}
          loader={model.thumbLoader}
          onPhotoPress={model.onPhotoPress}
          onFocusPhoto={(id) => model.focusedId.set(id)}
        />
      )}
    </>
  );
}
