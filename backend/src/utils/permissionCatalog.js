const allRoles = ["superadmin", "admin", "teacher", "student", "parent", "accountant", "librarian", "staff"];

const defaultActions = ["view", "create", "edit", "delete", "export", "approve", "manage"];

const permissionModules = [
  { key: "students", label: "Students", actions: defaultActions },
  { key: "teachers", label: "Teachers", actions: ["view", "edit", "approve", "manage"] },
  { key: "attendance", label: "Attendance", actions: ["view", "edit", "approve", "manage"] },
  { key: "fees", label: "Fees", actions: defaultActions },
  { key: "exams", label: "Exams", actions: defaultActions },
  { key: "classes", label: "Classes", actions: defaultActions },
  { key: "reports", label: "Reports", actions: ["view", "export", "approve", "manage"] },
  { key: "settings", label: "Settings", actions: ["view", "edit", "approve", "manage"] },
  { key: "users", label: "Users", actions: defaultActions },
  { key: "staff", label: "Staff", actions: defaultActions },
  { key: "staff_attendance", label: "Staff Attendance", actions: ["view", "edit", "approve", "manage"] },
  { key: "documents", label: "Documents", actions: defaultActions },
  { key: "notices", label: "Notices", actions: defaultActions },
  { key: "notifications", label: "Notifications", actions: ["view", "manage"] },
  { key: "website_leads", label: "Website Leads", actions: defaultActions },
  { key: "transport", label: "Transport", actions: defaultActions },
  { key: "library", label: "Library", actions: defaultActions },
  { key: "inventory", label: "Inventory", actions: defaultActions },
  { key: "admissions", label: "Admissions", actions: defaultActions },
  { key: "lms", label: "LMS", actions: defaultActions },
];

const allPermissionIds = permissionModules.flatMap((module) =>
  module.actions.map((action) => `${module.key}.${action}`)
);

const permissionSet = new Set(allPermissionIds);

const rolePermissionPresets = {
  superadmin: allPermissionIds,
  admin: [
    "students.view",
    "students.create",
    "students.edit",
    "classes.view",
    "classes.create",
    "classes.edit",
    "attendance.view",
    "attendance.edit",
    "attendance.manage",
    "staff.view",
    "staff.edit",
    "staff_attendance.view",
    "staff_attendance.manage",
    "documents.view",
    "notices.view",
    "notices.create",
    "notices.edit",
    "notifications.view",
    "users.view",
    "users.approve",
    "website_leads.view",
    "website_leads.edit",
    "transport.view",
    "transport.manage",
    "reports.view",
    "reports.export",
  ],
  teacher: [
    "students.view",
    "teachers.view",
    "teachers.edit",
    "teachers.manage",
    "attendance.view",
    "attendance.edit",
    "attendance.manage",
    "classes.view",
    "classes.create",
    "classes.edit",
    "exams.view",
    "exams.create",
    "exams.edit",
    "exams.manage",
    "notices.view",
    "notices.create",
    "notifications.view",
    "lms.view",
    "lms.create",
    "lms.edit",
    "lms.manage",
    "staff.view",
  ],
  student: [
    "students.view",
    "attendance.view",
    "fees.view",
    "exams.view",
    "notifications.view",
    "library.view",
    "lms.view",
    "teachers.view",
  ],
  parent: [
    "students.view",
    "attendance.view",
    "fees.view",
    "exams.view",
    "notifications.view",
    "teachers.view",
  ],
  accountant: [
    "students.view",
    "fees.view",
    "fees.create",
    "fees.edit",
    "fees.manage",
    "fees.export",
    "staff.view",
    "staff.manage",
    "transport.view",
    "transport.manage",
    "reports.view",
    "reports.export",
    "notifications.view",
    "users.view",
  ],
  librarian: [
    "library.view",
    "library.create",
    "library.edit",
    "library.manage",
    "notifications.view",
    "staff.view",
  ],
  staff: [
    "admissions.view",
    "admissions.create",
    "admissions.edit",
    "admissions.manage",
    "documents.view",
    "documents.create",
    "documents.edit",
    "documents.manage",
    "notices.view",
    "notifications.view",
    "website_leads.view",
    "website_leads.edit",
    "website_leads.manage",
    "transport.view",
    "transport.manage",
    "inventory.view",
    "inventory.create",
    "inventory.edit",
    "inventory.manage",
  ],
};

function normalizeAccess(value) {
  return String(value || "").toLowerCase().trim();
}

function isGranularPermission(value) {
  return normalizeAccess(value).includes(".");
}

function normalizePermissionMode(value) {
  return normalizeAccess(value) === "custom" ? "custom" : "role";
}

function normalizePermissions(permissions) {
  if (!Array.isArray(permissions)) return [];
  return [...new Set(permissions.map(normalizeAccess).filter((item) => item && item !== "superadmin"))];
}

function extractLegacyRoles(permissions) {
  return normalizePermissions(permissions).filter((item) => !isGranularPermission(item) && allRoles.includes(item));
}

function extractGranularPermissions(permissions) {
  return normalizePermissions(permissions).filter((item) => isGranularPermission(item) && permissionSet.has(item));
}

function getRolePresetPermissions(role) {
  return rolePermissionPresets[normalizeAccess(role)] || [];
}

module.exports = {
  allRoles,
  allPermissionIds,
  extractGranularPermissions,
  extractLegacyRoles,
  getRolePresetPermissions,
  isGranularPermission,
  normalizeAccess,
  normalizePermissionMode,
  normalizePermissions,
  permissionModules,
  rolePermissionPresets,
};
