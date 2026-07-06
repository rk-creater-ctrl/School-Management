import { getSessionUser, hasActiveSession } from "./utils/session";
import {
  allPermissionIds,
  allRoles,
  extractGranularPermissions,
  extractLegacyRoles,
  getRolePresetPermissions,
  isGranularPermission,
  moduleRoles,
  normalizeAccess,
  normalizePermissionMode,
  normalizePermissions,
} from "./permissionCatalog";

export { allRoles, moduleRoles, normalizePermissions } from "./permissionCatalog";

export function getStoredUser() {
  const user = getSessionUser(null);
  return user
    ? {
        ...user,
        role: normalizeAccess(user.role),
        permissions: normalizePermissions(user.permissions),
        permissionMode: normalizePermissionMode(user.permissionMode),
      }
    : null;
}

export function hasSession() {
  return hasActiveSession();
}

export function canUseRole(roles, user) {
  if (!roles?.length) return true;
  return roles.some((role) =>
    isGranularPermission(role) ? hasPermission(user, role) : hasAnyRole(user, [role])
  );
}

export function hasAnyRole(user, roles = []) {
  if (!user || !roles?.length) return false;
  const allowedRoles = roles.map(normalizeAccess);
  const effectiveRoles = getEffectiveRoles(user);
  if (effectiveRoles.includes("superadmin")) return true;
  return allowedRoles.some((role) => effectiveRoles.includes(role));
}

export function hasPermission(user, permission) {
  const normalized = normalizeAccess(permission);
  if (!normalized) return false;
  if (normalizeAccess(user?.role) === "superadmin") return true;
  return getEffectivePermissions(user).includes(normalized);
}

export function getEffectiveRoles(user) {
  if (!user) return [];
  return [user.role, ...extractLegacyRoles(user.permissions)].map(normalizeAccess).filter(Boolean);
}

export function getEffectivePermissions(user) {
  if (!user) return [];
  if (normalizeAccess(user.role) === "superadmin") return allPermissionIds;

  const rolePermissions = new Set();
  getEffectiveRoles(user).forEach((role) => {
    getRolePresetPermissions(role).forEach((permission) => rolePermissions.add(permission));
  });

  const customPermissions = extractGranularPermissions(user.permissions);
  return [
    ...(normalizePermissionMode(user.permissionMode) === "custom" ? [] : [...rolePermissions]),
    ...customPermissions,
  ].filter((permission, index, list) => list.indexOf(permission) === index);
}
