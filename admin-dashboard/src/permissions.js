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
  return user ? { ...user, role: String(user.role || "").toLowerCase() } : null;
}

export function hasSession() {
  return hasActiveSession();
}

export function canUseRole(roles, user) {
  if (!roles?.length) return true;
  if (user?.role === "superadmin") return true;
  return roles.includes(user?.role);
}
