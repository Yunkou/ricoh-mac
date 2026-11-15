import family from "./ChillDINGothic_Regular.otf";
import "./ChillDINGothic_SemiBold.otf";
import licenseUrl from "./LICENSE?url";

/** Typographic family name stored in the Regular face, for `fontFamily`. */
export const chillDINGothicFamily = family;

/** Bundled family first, then the system font for glyphs this face does not have. */
export const chillDINGothicStack = `${family}, system-ui`;

/**
 * Bundled OFL text (`LICENSE?url`). The import ships the file with the app;
 * the URL is exported so the binding is used and is not removed by import elision.
 */
export const chillDINGothicLicenseUrl = licenseUrl;
