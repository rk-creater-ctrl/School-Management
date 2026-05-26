import { authAPI } from "../api";
import { getStoredUser } from "../permissions";

export async function requireSuperadminPassword(actionLabel = "continue") {
  const user = getStoredUser();
  if (!["superadmin", "admin"].includes(user?.role)) {
    alert("Only admin or superadmin can perform this action.");
    return false;
  }

  const password = window.prompt(`Enter ${user.role} password to ${actionLabel}:`);
  if (!password) return false;

  try {
    await authAPI.confirmPassword(password);
    return true;
  } catch (error) {
    alert(error.response?.data?.error || "Invalid admin password.");
    return false;
  }
}
