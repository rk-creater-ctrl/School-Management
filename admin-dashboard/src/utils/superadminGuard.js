import { authAPI } from "../api";
import { getStoredUser } from "../permissions";

export async function requireSuperadminPassword(actionLabel = "continue") {
  return requireRolePassword(actionLabel, ["superadmin", "admin"]);
}

export async function requireRolePassword(actionLabel = "continue", allowedRoles = ["superadmin", "admin"]) {
  const user = getStoredUser();
  if (!allowedRoles.includes(user?.role)) {
    alert(`Only ${allowedRoles.join(" or ")} can perform this action.`);
    return false;
  }

  const password = window.prompt(`Enter ${user.role} password to ${actionLabel}:`);
  if (!password) return false;

  try {
    await authAPI.confirmPassword(password);
    return true;
  } catch (error) {
    alert(error.response?.data?.error || "Invalid password.");
    return false;
  }
}
