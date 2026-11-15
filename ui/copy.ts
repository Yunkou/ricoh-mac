export const copy = {
  chooseLibraryTitle: "选择保存位置",
  chooseLibraryBody: "导入的照片会按原文件名放在这里。",
  chooseLibraryAction: "选择文件夹",
  changeLibrary: "更改位置",
  idleStatus: "未连接",
  connectingStatus: "正在连接…",
  connectedStatus: "已连接",
  errorStatus: "无法连接",
  connectCamera: "连接相机",
  refreshList: "刷新",
  connectionHelp:
    "请先在相机上打开无线网络。若已保存过，点「连接相机」会自动加入。也可在系统设置中手动加入相机屏幕上的网络。若还需要上网，可用网线或 iPhone 网络共享。",
  needProfileStatus: "需要保存网络",
  saveCameraWifi: "保存并连接",
  saveProfile: "保存",
  ssidLabel: "网络名称",
  passwordLabel: "密码",
  ssidPlaceholder: "相机屏幕上的网络名称",
  passwordPlaceholder: "相机屏幕上的密码",
  passwordOnlyHint: "已检测到当前网络。请输入相机屏幕上的密码。",
  profileSection: "相机网络",
  noProfile: "还没有保存过相机网络，连接时会引导你完成。",
  profileSsid: (ssid: string) => `网络：${ssid}`,
  profileIdentity: (parts: string[]) => (parts.length > 0 ? parts.join(" · ") : "型号未知"),
  editProfileHelp: "密码保存在系统钥匙串中。",
  deleteProfile: "删除",
  autoSwitchBack: "导入完成后自动切回原来的网络",
  switchBack: "切回原来的网络",
  switchBackHint: (ssid: string) => `导入完成后可切回 ${ssid}`,
  capturingWifi: "正在加入网络…",
  locationHelp: "系统可能会询问定位权限，允许后可自动填入当前网络名称。也可手动输入。",
  loadingPhotos: "正在载入…",
  noPhotos: "相机里没有照片。",
  listFailed: "无法载入照片。",
  photoCount: (total: number, selected: number) =>
    selected > 0 ? `共 ${total} 张 · 已选 ${selected} 张` : `共 ${total} 张`,
  selectAll: "全选",
  clearSelection: "清除选择",
  importSelected: (count: number) => (count > 0 ? `导入已选（${count}）` : "导入已选"),
  importAll: "全部导入",
  needLibrary: "请先选择保存位置。",
  needSelection: "请先选择要导入的照片，或使用「全部导入」。",
  importing: (file: string, current: number, total: number) =>
    `正在导入 ${file}（${current}/${total}）`,
  importSummary: (imported: number, skipped: number, conflicts: number, errors: number) =>
    `已导入 ${imported} · 已跳过 ${skipped} · 冲突 ${conflicts} · 失败 ${errors}`,
  statusImported: "已导入",
  statusSkipped: "已跳过",
  statusConflict: "冲突",
  statusError: "失败",
  statusPending: "等待中",
  settings: "设置",
  settingsLibrary: "保存位置",
  settingsCameraUrl: "相机地址",
  settingsCameraUrlHelp: "一般无需更改。",
  saveUrl: "保存",
  resetUrl: "恢复默认",
  urlSaved: (_url: string) => "地址已保存。",
  urlReset: (_url: string) => "已恢复默认地址。",
  needSsid: "请填写网络名称",
  needPassword: "请填写密码",
  profileSaved: "已保存。",
  profileDeleted: "已删除。下次连接时需要重新保存。",
  autoSwitchOn: "开",
  autoSwitchOff: "关",
  proxyHint: "网络似乎被代理占用，相机可能连不上。请把相机网络排除出代理后再试。",
  homeDevicesTitle: "设备",
  homeDevicesBody: "连接相机，导入照片",
  homePhotosTitle: "照片",
  homePhotosBody: "查看已导入的照片",
  backHome: "返回",
  areaDevices: "设备",
  areaPhotos: "照片",
  viewImported: "查看照片",
  albumEmpty: "这里还没有照片。",
  albumCount: (visible: number, total: number) =>
    visible === total ? `共 ${total} 张` : `共 ${visible} / ${total} 张`,
  albumListFailed: "无法载入照片。",
  albumFilterEmpty: "没有符合筛选的照片。",
  ratingLabel: (rating: number) => (rating > 0 ? `${rating} 星` : "未评级"),
  flagPicked: "已选",
  flagRejected: "排除",
  flagNone: "无标记",
  flagLabel: (flag: "none" | "picked" | "rejected") =>
    flag === "picked" ? "已选" : flag === "rejected" ? "排除" : "无标记",
  clearRating: "清除星级",
  clearFlag: "清除标记",
  rateStar: (rating: number) => `${rating} 星`,
  cullFailed: "无法保存标记。",
  filterAll: "全部",
  filterPicked: "已选",
  filterRejected: "排除",
  filterNone: "无标记",
  filterRating: (rating: number) => (rating > 0 ? `${rating} 星` : "未评级"),
  cannotPreview: "无法预览",
  cannotPreviewHint: "这种格式暂时无法直接显示。",
  embeddedPreview: "当前显示的是嵌入预览",
  backToAlbum: "返回",
  previousPhoto: "上一张",
  nextPhoto: "下一张",
  fitToWindow: "适应窗口",
  actualSize: "1:1",
  fileInfo: "信息",
  exposureTitle: "拍摄参数",
  lensTitle: "镜头与构图",
  lookTitle: "色彩与对焦",
  fileTitle: "文件",
  aperture: "光圈",
  shutter: "快门",
  iso: "ISO",
  exposureCompensation: "曝光补偿",
  exposureMode: "曝光模式",
  meteringMode: "测光",
  camera: "相机",
  lens: "镜头",
  focalLength: "焦距",
  focalLength35mm: "换算焦距",
  cropMode: "裁切",
  whiteBalance: "白平衡",
  colorTemperature: "色温",
  imageControl: "图像设定",
  focusMode: "对焦",
  fullPressSnap: "全按快门 Snap",
  ndFilter: "ND 滤镜",
  takenAt: "拍摄时间",
  fileFormat: "格式",
  fileName: "文件名",
  fileSize: "大小",
  filePixels: "尺寸",
  aspectRatio: "画幅",
  colorSpace: "色彩空间",
  gps: "位置",
  histogram: "直方图",
  histogramPreview: "直方图（根据预览）",
  unknownValue: "未知",
  shortcuts: "快捷键",
  shortcutHint: "← → 切换  0–5 打星  P 已选  X 排除  U 清除标记  Esc 返回  ? 快捷键",
  shortcutNav: "上一张或下一张",
  shortcutEnds: "第一张或最后一张",
  shortcutOpen: "打开照片",
  shortcutClose: "返回相册",
  shortcutFit: "适应窗口或 1:1",
  shortcutInfo: "显示或隐藏拍摄信息",
  shortcutHelp: "显示或隐藏快捷键",
  shortcutRate: "打星，再按同一数字或 0 可清除星级",
  shortcutPick: "已选或取消已选",
  shortcutReject: "排除或取消排除",
  shortcutUnflag: "清除已选或排除，不影响星级",
  refreshAlbum: "刷新",
  connectProfile: "连接",
  noSavedProfiles: "还没有保存过相机，连接时会引导你完成。",
  savedProfiles: "已保存的相机",
  activeProfile: "当前",
} as const;

const exposureModeLabels: Record<string, string> = {
  auto: "自动",
  program: "程序自动",
  aperture: "光圈优先",
  shutter: "快门优先",
  shutter_aperture: "快门与光圈优先",
  manual: "手动",
  movie: "动态影像",
  creative: "创意",
  action: "运动",
  portrait: "人像",
  landscape: "风景",
  bulb: "B 门",
};

const meteringModeLabels: Record<string, string> = {
  average: "平均",
  center: "中央重点",
  spot: "点测光",
  multi_spot: "多点",
  pattern: "多分区",
  partial: "局部",
};

const cropModeLabels: Record<string, string> = {
  off: "未裁切",
  crop_50: "50 mm",
  crop_71: "71 mm",
  crop_35: "35 mm",
  crop_47: "47 mm",
  on: "已裁切",
};

const whiteBalanceLabels: Record<string, string> = {
  auto: "自动",
  multi_auto: "多重自动",
  daylight: "日光",
  cloudy: "阴天",
  incandescent_1: "白炽灯 1",
  incandescent_2: "白炽灯 2",
  daylight_fluorescent: "日光荧光灯",
  neutral_fluorescent: "中性白荧光灯",
  cool_fluorescent: "冷白荧光灯",
  warm_fluorescent: "暖白荧光灯",
  manual: "手动",
  kelvin: "色温",
  shade: "阴影",
};

const imageControlLabels: Record<string, string> = {
  standard: "标准",
  vivid: "鲜艳",
  monotone: "单色",
  setting_1: "设定 1",
  setting_2: "设定 2",
  high_contrast_bw: "高反差黑白",
  cross_process: "交叉冲印",
  positive_film: "正片",
  bleach_bypass: "漂白",
  retro: "怀旧",
  miniature: "微缩",
  high_key: "高调",
};

const focusModeLabels: Record<string, string> = {
  manual: "手动",
  multi_af: "多点对焦",
  spot_af: "点对焦",
  snap: "Snap",
  infinity: "无限远",
  face: "人脸",
  tracking: "跟踪",
  pinpoint: "精确对焦",
};

const colorSpaceLabels: Record<string, string> = {
  srgb: "sRGB",
  adobe_rgb: "Adobe RGB",
};

const formatLabels: Record<string, string> = {
  jpeg: "JPEG",
  dng: "DNG",
  other: "其他",
};

export function labelFor(map: Record<string, string>, key: string | null | undefined): string | null {
  if (!key) {
    return null;
  }
  return map[key] ?? null;
}

export function exposureModeLabel(key: string | null | undefined): string | null {
  return labelFor(exposureModeLabels, key);
}

export function meteringModeLabel(key: string | null | undefined): string | null {
  return labelFor(meteringModeLabels, key);
}

export function cropModeLabel(key: string | null | undefined): string | null {
  return labelFor(cropModeLabels, key);
}

export function whiteBalanceLabel(key: string | null | undefined): string | null {
  return labelFor(whiteBalanceLabels, key);
}

export function imageControlLabel(key: string | null | undefined): string | null {
  return labelFor(imageControlLabels, key);
}

export function focusModeLabel(key: string | null | undefined): string | null {
  return labelFor(focusModeLabels, key);
}

export function onOffLabel(key: string | null | undefined): string | null {
  if (key === "on") {
    return "开";
  }
  if (key === "off") {
    return "关";
  }
  return null;
}

export function colorSpaceLabel(key: string | null | undefined): string | null {
  return labelFor(colorSpaceLabels, key);
}

export function formatLabel(key: string | null | undefined): string | null {
  return labelFor(formatLabels, key);
}

export function takenAtLabel(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(value);
  if (!match) {
    return value;
  }
  const [, year, month, day, hour, minute] = match;
  return `${year}年${Number(month)}月${Number(day)}日 ${hour}:${minute}`;
}
