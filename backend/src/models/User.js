const bcrypt = require("bcryptjs");
const { createModel, hashUserPasswordIfNeeded } = require("../lib/supabaseModel");

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
    data.permissions = Array.isArray(data.permissions)
      ? [...new Set(data.permissions.map((item) => String(item || "").toLowerCase().trim()).filter((item) => item && item !== "superadmin"))]
      : [];
    await hashUserPasswordIfNeeded(data);
  },
  methods: {
    async comparePassword(password) {
      return bcrypt.compare(password, this.password || "");
    },
  },
});
