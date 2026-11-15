import { Image } from "nsh";

import arrowLeftRight from "../assets/icons/arrow-left-right.svg";
import camera from "../assets/icons/camera.svg";
import circleAlert from "../assets/icons/circle-alert.svg";
import circleCheck from "../assets/icons/circle-check.svg";
import circleMinus from "../assets/icons/circle-minus.svg";
import circleX from "../assets/icons/circle-x.svg";
import download from "../assets/icons/download.svg";
import downloadOnAccent from "../assets/icons/download-on-accent.svg";
import eraser from "../assets/icons/eraser.svg";
import folder from "../assets/icons/folder.svg";
import folderDown from "../assets/icons/folder-down.svg";
import folderPlus from "../assets/icons/folder-plus.svg";
import folderPlusOnAccent from "../assets/icons/folder-plus-on-accent.svg";
import images from "../assets/icons/images.svg";
import listChecks from "../assets/icons/list-checks.svg";
import loader from "../assets/icons/loader.svg";
import rotateCw from "../assets/icons/rotate-cw.svg";
import save from "../assets/icons/save.svg";
import settings from "../assets/icons/settings.svg";
import trash from "../assets/icons/trash.svg";
import wifi from "../assets/icons/wifi.svg";
import wifiAlert from "../assets/icons/wifi-alert.svg";
import wifiCheck from "../assets/icons/wifi-check.svg";
import wifiCog from "../assets/icons/wifi-cog.svg";
import wifiOff from "../assets/icons/wifi-off.svg";
import wifiOnAccent from "../assets/icons/wifi-on-accent.svg";
import wifiX from "../assets/icons/wifi-x.svg";

const icons = {
  "arrow-left-right": arrowLeftRight,
  "camera": camera,
  "circle-alert": circleAlert,
  "circle-check": circleCheck,
  "circle-minus": circleMinus,
  "circle-x": circleX,
  "download": download,
  "download-on-accent": downloadOnAccent,
  "eraser": eraser,
  "folder": folder,
  "folder-down": folderDown,
  "folder-plus": folderPlus,
  "folder-plus-on-accent": folderPlusOnAccent,
  "images": images,
  "list-checks": listChecks,
  "loader": loader,
  "rotate-cw": rotateCw,
  "save": save,
  "settings": settings,
  "trash": trash,
  "wifi": wifi,
  "wifi-alert": wifiAlert,
  "wifi-check": wifiCheck,
  "wifi-cog": wifiCog,
  "wifi-off": wifiOff,
  "wifi-on-accent": wifiOnAccent,
  "wifi-x": wifiX,
} as const;

export type IconName = keyof typeof icons;

export const onAccentIcon: { [K in IconName]?: IconName } = {
  wifi: "wifi-on-accent",
  download: "download-on-accent",
  "folder-plus": "folder-plus-on-accent",
};

export function Icon(props: {
  name: IconName;
  size?: number;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const size = props.size ?? 18;
  const decorative = props.accessibilityLabel === undefined;
  return (
    <Image
      src={icons[props.name]}
      testID={props.testID}
      accessibilityLabel={props.accessibilityLabel}
      accessibilityElementsHidden={decorative}
      role={decorative ? undefined : "image"}
      style={{
        width: size,
        height: size,
        pointerEvents: "none",
      }}
    />
  );
}
