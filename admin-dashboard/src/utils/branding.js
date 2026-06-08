const defaultTitle = "Scholara ERP | School Management Software";
const defaultIcon = "/favicon.svg";

export function applySchoolBranding(settings = {}) {
  const schoolName = String(settings.schoolName || settings.shortName || "").trim();
  const logoUrl = String(settings.logoUrl || "").trim();

  document.title = schoolName ? `${schoolName} | School Management` : defaultTitle;
  setFavicon(logoUrl || defaultIcon);
}

export function getSchoolNameForClass(settings = {}, className = "") {
  const defaultName = cleanSchoolName(settings.schoolName || settings.shortName) || "School";

  if (isPrePrimaryClass(className)) {
    return cleanSchoolName(settings.prePrimarySchoolName) || defaultName;
  }

  if (isClassOneOrHigher(className)) {
    return cleanSchoolName(settings.primarySchoolName) || defaultName;
  }

  return defaultName;
}

function setFavicon(iconUrl) {
  let link = document.querySelector("link[rel='icon']");

  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }

  link.href = iconUrl;
  link.type = getIconType(iconUrl);
}

function getIconType(iconUrl) {
  const cleanUrl = iconUrl.split("?")[0].toLowerCase();
  if (cleanUrl.endsWith(".png")) return "image/png";
  if (cleanUrl.endsWith(".jpg") || cleanUrl.endsWith(".jpeg")) return "image/jpeg";
  if (cleanUrl.endsWith(".webp")) return "image/webp";
  if (cleanUrl.endsWith(".gif")) return "image/gif";
  if (cleanUrl.endsWith(".ico")) return "image/x-icon";
  return "image/svg+xml";
}

function cleanSchoolName(value) {
  return String(value || "").trim();
}

function normalizeClassName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isPrePrimaryClass(className) {
  const normalized = normalizeClassName(className);
  if (!normalized) return false;

  return [
    "playgroup",
    "pg",
    "prenursery",
    "nursery",
    "nursary",
    "lkg",
    "ukg",
    "juniorkg",
    "jrkg",
    "seniorkg",
    "srkg",
    "kg",
    "kg1",
    "kg2",
  ].some((item) => normalized.includes(item));
}

function isClassOneOrHigher(className) {
  const normalized = normalizeClassName(className);
  if (!normalized) return false;

  if (/^(class)?(1[0-2]|[1-9])(st|nd|rd|th)?[a-z]?$/.test(normalized)) {
    return true;
  }

  return [
    "first",
    "second",
    "third",
    "fourth",
    "fifth",
    "sixth",
    "seventh",
    "eighth",
    "ninth",
    "tenth",
    "eleventh",
    "twelfth",
    "i",
    "ii",
    "iii",
    "iv",
    "v",
    "vi",
    "vii",
    "viii",
    "ix",
    "x",
    "xi",
    "xii",
  ].includes(normalized.replace(/^class/, ""));
}
