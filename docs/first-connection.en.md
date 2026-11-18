# First connection to the camera

This guide is for your first time connecting Ricoh Mac to the camera. Connecting goes through several system permissions and a network switch, and when any step fails the interface mostly just says "cannot connect". Below is what each step should show, then a table mapping symptoms to causes and next steps.

Chinese version: [first-connection.zh-CN.md](first-connection.zh-CN.md).

## Before you start

- The camera is on and **its wireless network is turned on in the camera**. On a GR IIIx, see the wireless LAN section of the camera manual.
- The camera has charge and its card is in a normal state.
- No proxy or VPN on this Mac excludes the camera network. If one is active, handle it with the table below first.

## Step 1: Open Devices and click Connect Camera

Go to Devices and click Connect Camera. The app probes the camera first.

- **If the Mac is already on the camera network**, go to step 2.
- **If it is not**, the app asks you to save the camera network.

## Step 2: Save the camera network

The app asks for the **network name** and **password** shown on the camera screen.

- If the app detects a network name that looks like the camera's, it may ask only for the password.
- The first time you save, macOS may ask whether to let the app use the Keychain. Allowing it stores the password in the system Keychain.

The password is not written into the app's data files.

## Step 3: System permissions

The system may ask for two permissions during a connection. Both affect whether it works:

**Location**: macOS only lets an app with Location access read the current Wi-Fi network name.

- Allowed: the app fills in the current network name for you.
- Refused: still usable, but you must type the network name shown on the camera. The app does not use or record your geographic position.

**Local Network** (since macOS 15): reaching the camera is local network access.

- Allowed: the app can reach the camera at `http://192.168.0.1`.
- Refused: the connection is dropped silently by the system — no prompt, and the entry may not even appear in Settings, so the interface only shows a failure. You can allow it in System Settings → Privacy & Security → Local Network.

## Step 4: Switching networks

Once a profile is saved, Connect Camera switches to the camera network automatically.

- The interface shows "joining network…" during the switch.
- On success it probes the camera, shows connected, and lists the photographs on the camera.
- After an import it switches back to your previous network by default. You can turn that off in Settings.

## Step 5: Import

Select photographs in the list, then Import Selected or Import All. Photographs import into your library folder under their original file names.

When the import finishes, View Photos opens the local album. Failed items in the current session can be retried on their own.

## Symptom table

| What you see | Likely cause | What to do |
| --- | --- | --- |
| "Cannot connect" right after refusing a system prompt | Local Network permission refused (macOS 15+); the connection is dropped silently | System Settings → Privacy & Security → Local Network, allow the app, then click Connect Camera again |
| "No permission to read the current network name" | Location permission refused | Allow it in System Settings → Privacy & Security → Location Services, or type the network name shown on the camera |
| "Could not join the camera network; the password may be wrong" | The password on the camera screen differs from the saved one (it can change each time wireless starts) | Update the password in Settings and retry |
| "Timed out waiting for the camera network" | The camera's wireless is off, or the camera is far away or the signal is weak; also possible if Local Network permission is refused | Turn on wireless in the camera and move closer; if it still fails, check Local Network permission |
| "Joined the camera network, but the camera did not respond" | On the camera network, but the camera address is unreachable: camera asleep, a proxy in the way, or Local Network permission refused | Wake the camera and confirm wireless is still on; check Local Network permission; if a proxy is active, exclude the camera network |
| "The network seems to be taken over by a proxy; the camera may not connect" | The route to `192.168.0.1` goes through a tunnel interface | Exclude the camera network from the proxy and retry |
| "No wireless network found on this Mac" | No usable Wi-Fi interface (for example, wired only) | Use a Mac with Wi-Fi |
| "This camera was saved, but its password is missing" | The Keychain item was lost or removed | Enter the password again and save it |
| Connects, but an import fails midway | Weak signal or an interrupted transfer | Move closer and retry; failed items can be retried on their own in the current session |
| Still on the camera network after import | Switch-back is off, or it failed | Turn on "switch back after import" in Settings, or use the switch-back control |

## Still cannot connect

If you have tried the table and it still fails, include this when filing an issue: app version, macOS version, Mac chip, camera model and firmware, how the Mac joined the camera network, and whether a proxy or VPN is active (the fields in the [bug report template](../.github/ISSUE_TEMPLATE/bug_report.yml)).
