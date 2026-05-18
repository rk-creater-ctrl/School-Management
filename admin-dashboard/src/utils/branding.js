const defaultTitle = "Scholara ERP | School Management Software";
const defaultIcon = "/favicon.svg";

export function applySchoolBranding(settings = {}) {
  const schoolName = String(settings.schoolName || settings.shortName || "").trim();
  const logoUrl = String(settings.logoUrl || "").trim();

  document.title = schoolName ? `${schoolName} | School Management` : defaultTitle;
  setFavicon(logoUrl || defaultIcon);
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
