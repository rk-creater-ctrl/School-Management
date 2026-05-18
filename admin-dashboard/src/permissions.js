export const allRoles = ["superadmin", "admin", "teacher", "student", "parent", "accountant", "librarian", "staff"];

export const moduleRoles = {
  admissions: ["superadmin", "staff"],
  staff: ["superadmin", "accountant"],
  exams: ["superadmin", "teacher", "student", "parent"],
  lms: ["superadmin", "teacher", "student"],
  transport: ["superadmin", "parent", "staff"],
  library: ["superadmin", "librarian", "student"],
  inventory: ["superadmin", "staff"],
  staffAttendance: ["superadmin", "admin"],
};

export function getStoredUser() {
  try {
    const user = JSON.parse(localStorage.getItem("erp_user") || sessionStorage.getItem("erp_user") || "null");
    return user ? { ...user, role: String(user.role || "").toLowerCase() } : null;
  } catch {
    return null;
  }
}

export function hasSession() {
  return Boolean(localStorage.getItem("erp_token") || sessionStorage.getItem("erp_token"));
}

export function canUseRole(roles, user) {
  if (!roles?.length) return true;
  return roles.includes(user?.role);
}
