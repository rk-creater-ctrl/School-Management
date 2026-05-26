const MAX_ACADEMIC_YEAR_START = 2049;
const DEFAULT_MIN_ACADEMIC_YEAR_START = 2000;

export function getCurrentAcademicYearStart(date = new Date()) {
  const year = date.getFullYear();
  return date.getMonth() >= 3 ? year : year - 1;
}

export function formatAcademicYear(startYear) {
  const normalizedStart = Number(startYear) || getCurrentAcademicYearStart();
  return `${normalizedStart}-${normalizedStart + 1}`;
}

export function getCurrentAcademicYear(date = new Date()) {
  return formatAcademicYear(getCurrentAcademicYearStart(date));
}

export function getAcademicYearStart(value, fallback = getCurrentAcademicYearStart()) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);

  const firstYear = String(value || "").match(/\d{4}/)?.[0];
  const parsed = Number(firstYear);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeAcademicYear(value) {
  return formatAcademicYear(clampAcademicYearStart(getAcademicYearStart(value)));
}

export function clampAcademicYearStart(startYear, minStart = DEFAULT_MIN_ACADEMIC_YEAR_START) {
  return Math.min(MAX_ACADEMIC_YEAR_START, Math.max(minStart, Number(startYear) || getCurrentAcademicYearStart()));
}

export function getAcademicYearOptions(value, { past = 3, future = 3, minStart = DEFAULT_MIN_ACADEMIC_YEAR_START } = {}) {
  const selectedStart = clampAcademicYearStart(getAcademicYearStart(value), minStart);
  const from = Math.max(minStart, selectedStart - past);
  const to = Math.min(MAX_ACADEMIC_YEAR_START, selectedStart + future);

  return Array.from({ length: to - from + 1 }, (_, index) => {
    const startYear = from + index;
    return {
      startYear,
      label: formatAcademicYear(startYear),
    };
  });
}
