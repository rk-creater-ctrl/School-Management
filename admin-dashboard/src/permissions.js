import { getSessionUser, hasActiveSession } from "./utils/session";

export const allRoles = ["superadmin", "admin", "teacher", "student", "parent", "accountant", "librarian", "staff"];

export const moduleRoles = {
  admissions: ["superadmin", "staff"],
  staff: ["superadmin", "accountant", "teacher"],
  exams: ["superadmin", "teacher", "student", "parent"],
  lms: ["superadmin", "teacher", "student"],
  transport: ["superadmin", "admin", "accountant", "staff"],
  library: ["superadmin", "librarian", "student"],
  inventory: ["superadmin", "staff"],
  staffAttendance: ["superadmin", "admin"],
};

export function getStoredUser() {
  const user = getSessionUser(null);
  return user
    ? {
        ...user,
        role: normalizeAccess(user.role),
        permissions: normalizePermissions(user.permissions),
      }
    : null;
}

export function hasSession() {
  return hasActiveSession();
}

export function canUseRole(roles, user) {
  if (!roles?.length) return true;
  const allowedRoles = roles.map(normalizeAccess);
  const effectiveRoles = getEffectiveRoles(user);
  if (effectiveRoles.includes("superadmin")) return true;
  return allowedRoles.some((role) => effectiveRoles.includes(role));
}

export function normalizePermissions(permissions) {
  return Array.isArray(permissions)
    ? [...new Set(permissions.map(normalizeAccess).filter((item) => item && item !== "superadmin"))]
    : [];
}

function getEffectiveRoles(user) {
  if (!user) return [];
  return [user.role, ...normalizePermissions(user.permissions)].map(normalizeAccess).filter(Boolean);
}

function normalizeAccess(value) {
  return String(value || "").toLowerCase().trim();
}
