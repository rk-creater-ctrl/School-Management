const bcrypt = require("bcryptjs");
const { createModel, hashUserPasswordIfNeeded } = require("../lib/supabaseModel");
const { normalizePermissionMode, normalizePermissions } = require("../utils/permissionCatalog");

module.exports = createModel("users", {
  beforeSave: async (data) => {
    if (data.role) data.role = String(data.role).toLowerCase().trim();
    if (!data.role) data.role = "teacher";
    if (!data.status) data.status = "active";
    if (data.isEmailVerified === undefined) data.isEmailVerified = false;
    if (data.studentAdmissionNo) data.studentAdmissionNo = String(data.studentAdmissionNo).trim();
    if (data.linkedStudentAdmissionNo) data.linkedStudentAdmissionNo = String(data.linkedStudentAdmissionNo).trim();
    if (data.studentId) data.studentId = String(data.studentId).trim();
    if (data.linkedStudentId) data.linkedStudentId = String(data.linkedStudentId).trim();
    if (data.profilePhotoUrl) data.profilePhotoUrl = String(data.profilePhotoUrl).trim();
    if (data.campus) data.campus = String(data.campus).trim();
    if (data.academicYear) data.academicYear = String(data.academicYear).trim();
    data.permissionMode = normalizePermissionMode(data.permissionMode);
    data.permissions = normalizePermissions(data.permissions);
    await hashUserPasswordIfNeeded(data);
  },
  methods: {
    async comparePassword(password) {
      return bcrypt.compare(password, this.password || "");
    },
  },
});
