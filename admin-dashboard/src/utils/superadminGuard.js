import { authAPI } from "../api";
import { getStoredUser } from "../permissions";

export async function requireSuperadminPassword(actionLabel = "continue") {
  const user = getStoredUser();
  if (user?.role !== "superadmin") {
    alert("Only superadmin can perform this action.");
    return false;
  }

  const password = window.prompt(`Enter superadmin password to ${actionLabel}:`);
  if (!password) return false;

  try {
    await authAPI.confirmPassword(password);
    return true;
  } catch (error) {
    alert(error.response?.data?.error || "Invalid superadmin password.");
    return false;
  }
}
