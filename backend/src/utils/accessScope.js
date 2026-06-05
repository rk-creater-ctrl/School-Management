function clean(value) {
  return String(value || "").trim();
}

function normalize(value) {
  return clean(value).toLowerCase();
}

function digits(value) {
  return clean(value).replace(/\D/g, "");
}

function getId(value) {
  if (!value) return "";
  if (typeof value === "object") return clean(value._id || value.id);
  return clean(value);
}

function getRole(user) {
  return normalize(user?.role);
}

function isSuperadmin(user) {
  return getRole(user) === "superadmin";
}

function hasAnyRole(user, roles = []) {
  if (isSuperadmin(user)) return true;
  return roles.map(normalize).includes(getRole(user));
}

function forbidden(message = "You do not have permission for this action") {
  const error = new Error(message);
  error.status = 403;
  return error;
}

function requireAnyRole(user, roles = []) {
  if (!hasAnyRole(user, roles)) throw forbidden();
}

function userLinkedAdmissionValues(user) {
  return [
    user?.studentAdmissionNo,
    user?.linkedStudentAdmissionNo,
    user?.linkedAdmissionNo,
    user?.admissionNo,
  ]
    .map(normalize)
    .filter(Boolean);
}

function studentAdmissionValues(student) {
  return [student?.admissionNo, student?.studentCode]
    .map(normalize)
    .filter(Boolean);
}

function studentEmailValues(student) {
  return [
    student?.email,
    student?.guardianEmail,
    student?.guardian?.email,
    student?.fatherEmail,
    student?.motherEmail,
  ]
    .map(normalize)
    .filter(Boolean);
}

function studentPhoneValues(student) {
  return [
    student?.mobileNo,
    student?.mobile,
    student?.phone,
    student?.guardianPhone,
    student?.guardian?.phone,
    student?.fatherPhone,
    student?.motherPhone,
  ]
    .map(digits)
    .filter(Boolean);
}

function studentBelongsToUser(student, user) {
  const role = getRole(user);
  if (!["student", "parent"].includes(role)) return false;

  const studentId = getId(student);
  const linkedIds = [
    user?.studentId,
    user?.linkedStudentId,
    user?.profileStudentId,
    user?.student,
  ]
    .map(getId)
    .filter(Boolean);

  if (studentId && linkedIds.includes(studentId)) return true;

  const studentAdmissions = studentAdmissionValues(student);
  const linkedAdmissions = userLinkedAdmissionValues(user);
  if (linkedAdmissions.some((value) => studentAdmissions.includes(value))) return true;

  const userEmails = [user?.email, user?.username].map(normalize).filter(Boolean);
  const userPhones = [user?.phone].map(digits).filter(Boolean);

  if (role === "student") {
    if (userEmails.some((value) => [...studentAdmissions, normalize(student?.email)].includes(value))) return true;
    if (studentAdmissions.includes(normalize(user?.username))) return true;
  }

  if (role === "parent") {
    const emails = studentEmailValues(student);
    const phones = studentPhoneValues(student);
    if (userEmails.some((value) => emails.includes(value))) return true;
    if (userPhones.some((value) => phones.includes(value))) return true;
  }

  return false;
}

function canViewAllStudents(user) {
  return hasAnyRole(user, ["admin", "teacher", "accountant", "staff"]);
}

function canManageStudents(user) {
  return isSuperadmin(user);
}

function canViewAllFees(user) {
  return hasAnyRole(user, ["accountant"]);
}

function canManageFees(user) {
  return hasAnyRole(user, ["accountant"]);
}

function canManageAttendance(user) {
  return hasAnyRole(user, ["admin", "teacher"]);
}

function filterStudentsForUser(students, user) {
  if (canViewAllStudents(user)) return students;
  return students.filter((student) => studentBelongsToUser(student, user));
}

async function assertStudentAccess(Student, studentId, user, allAccessRoles = []) {
  const student = await Student.findById(studentId);
  if (!student) {
    const error = new Error("Student not found");
    error.status = 404;
    throw error;
  }

  if (hasAnyRole(user, allAccessRoles) || studentBelongsToUser(student, user)) {
    return student;
  }

  throw forbidden("You do not have permission to open this student record");
}

function handleAccessError(res, err) {
  res.status(err.status || 500).json({ error: err.message || "Access denied" });
}

module.exports = {
  canManageAttendance,
  canManageFees,
  canManageStudents,
  canViewAllFees,
  canViewAllStudents,
  filterStudentsForUser,
  getRole,
  handleAccessError,
  hasAnyRole,
  requireAnyRole,
  assertStudentAccess,
  studentBelongsToUser,
};
