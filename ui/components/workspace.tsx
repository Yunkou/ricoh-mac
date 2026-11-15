import { Text, View } from "nsh";
import { copy } from "../copy";
import type { AppModel } from "../state/app-model";
import { color, font, space, type } from "../theme";
import { AlbumGrid } from "./album-grid";
import { Button } from "./button";
import { ConnectPanel, FirstRun } from "./empty-state";
import { FadeEnter } from "./fade-enter";
import { Icon } from "./icon";
import { PhotoGrid } from "./photo-grid";

export function DevicesWorkspace(props: { model: AppModel }) {
  const model = props.model;
  if (model.photos().length > 0) {
    return (
      <PhotoGrid
        photos={model.photos}
        thumbs={model.thumbs}
        selected={model.selected}
        fileStatus={model.fileStatus}
        loader={model.thumbLoader}
        onPhotoPress={model.onPhotoPress}
        onFocusPhoto={(id) => model.focusedId.set(id)}
      />
    );
  }
  return <ConnectPanel model={model} />;
}

export function PhotosWorkspace(props: { model: AppModel }) {
  const model = props.model;
  return (
    <>
      {!model.libraryFolder() ? (
        <FirstRun model={model} />
      ) : model.albumPhotos().length === 0 ? (
        <AlbumEmpty model={model} />
      ) : (
        <AlbumGrid
          photos={model.albumPhotos}
          restoreId={model.restorePhotoId}
          onPhotoPress={(_index, id) => model.openAlbumPhoto(id)}
          onFocusPhoto={(id) => model.focusedId.set(id)}
          onRestored={() => model.clearRestorePhoto()}
        />
      )}
    </>
  );
}

function AlbumEmpty(props: { model: AppModel }) {
  const model = props.model;
  const loading = model.albumListing();
  return (
    <FadeEnter style={{ flex: 1 }}>
      <View
        testID="album-empty"
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: space.xl,
          gap: space.lg,
        }}
      >
        <Icon name={loading ? "loader" : "images"} size={36} />
        <Text
          style={{
            fontFamily: font.family,
            color: color.text,
            fontSize: type.title,
            lineHeight: type.lineTitle,
            fontWeight: font.emphasis,
          }}
        >
          {loading ? copy.loadingPhotos : copy.albumEmpty}
        </Text>
        {!loading ? (
          <Button
            label={copy.changeLibrary}
            kind="secondary"
            testID="album-change-folder"
            disabled={model.isBusy()}
            icon="folder"
            onPress={() => void model.chooseFolder()}
          />
        ) : null}
      </View>
    </FadeEnter>
  );
}
