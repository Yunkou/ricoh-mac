# Privacy

This statement is for people who use Ricoh Mac. It describes only what the app actually does today. The product-level record lives in [PRODUCT.md](../PRODUCT.md); where the two differ, the code and this page are what matter.

Chinese version: [privacy.zh-CN.md](privacy.zh-CN.md).

## In one line

Photographs are not uploaded, and the app has no telemetry. It reads and writes files on your Mac, reaches your camera on the local network, and keeps the camera Wi-Fi password in the macOS Keychain.

## Are my photographs uploaded?

No. There is no upload, sync, or cloud backup, and no code path that sends a photograph over the network.

During import, photographs travel directly from the camera to your Mac over your local network, with no server in between. After that, browsing, rating, and export all happen on the local file system.

## Is there any analytics or telemetry?

No. The code contains no analytics, crash-reporting, or tracking SDK. The app does not send usage data to the developer or to any third party.

The only outbound network requests go to the camera address, `http://192.168.0.1` by default, which you can change in Settings.

## Does it change my originals?

No. The app only reads the files on the camera and the originals in the library folder.

Star ratings and the picked or rejected flags are written to an XMP sidecar beside the photograph, named `{original file name}.xmp`, for example `R0001234.DNG.xmp`. These sidecars are new files; the JPEG or DNG itself is never rewritten.

On export, the app copies picked photographs and any existing sidecar into the folder you choose. It does not overwrite same-named files and does not remove the sources.

## Why does it ask for Location?

macOS only lets an app with Location access read the name of the current Wi-Fi network. On a first connection, the app uses that to fill in the camera's network name for you.

- Location is used only to read the network name. The app does not use or record your geographic position.
- Refusing is supported: you can type the network name shown on the camera screen.

## Why does it ask for Local Network access?

Since macOS 15, reaching the local network requires the user's permission. Connecting to the camera, `http://192.168.0.1` by default, is local network access.

- It is used only to reach the camera. It does not go through the internet.
- If you refuse, the app cannot connect to the camera. You can allow it later in System Settings → Privacy & Security → Local Network.

## Where is the camera Wi-Fi password kept?

In the macOS Keychain, as this app's keychain item. The app's data directory records only metadata such as the camera model, serial number, and network name; it does not store the password.

- Deleting that camera in Settings also deletes its keychain password.
- The system may ask for permission the first time the app writes to the keychain.

## What files does the app write on my Mac?

- **Library folder:** the imported photographs, plus a `{original file name}.xmp` sidecar after you rate or flag one.
- **App data directory:**
  - `config.json`: settings such as the library folder and camera address.
  - `camera-profiles.json`: saved camera profiles (without passwords).
  - `wifi-session.json`: the current network-switch session, used to switch back after import.
  - `cull-index.sqlite`: a rebuildable marks index; the sidecars are the source of truth.
  - `raw-preview-cache`, `preview-cache`: preview caches you can delete at any time.

Deleting the app data directory clears these records.

## Scope

This statement describes the app in the current repository. If a later version adds something that changes the behavior above, such as update checks or an external service, this page will change with it.
