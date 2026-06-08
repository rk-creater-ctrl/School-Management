const express = require("express");
const User = require("../models/User");
const TeacherProfile = require("../models/TeacherProfile");
const TeacherClassRecord = require("../models/TeacherClassRecord");
const StaffPayroll = require("../models/StaffPayroll");
const Student = require("../models/Student");
const auth = require("../middleware/auth");
const { authorize } = require("../middleware/auth");

const router = express.Router();

const STAFF_ROLES = ["admin", "teacher", "accountant", "librarian", "staff"];
const PAYROLL_CATEGORIES = ["Skilled", "Half-skilled", "Unskilled"];

function cleanString(value) {
  return String(value || "").trim();
}

function cleanUsername(value) {
  return cleanString(value).toLowerCase().replace(/\s/g, "");
}

function cleanRole(value) {
  return STAFF_ROLES.includes(value) ? value : "staff";
}

function cleanStatus(value) {
  return ["active", "inactive", "suspended"].includes(value) ? value : "active";
}

function cleanPayrollCategory(value) {
  return PAYROLL_CATEGORIES.includes(value) ? value : "Skilled";
}

function cleanStringArray(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map(cleanString).filter(Boolean))];
}

function cleanAssignments(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((item) => ({
      className: cleanString(item.className),
      subject: cleanString(item.subject),
    }))
    .filter((item) => item.className && item.subject);
}

function cleanSchedule(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((item) => ({
      day: cleanString(item.day) || "Daily",
      period: cleanString(item.period),
      className: cleanString(item.className),
      subject: cleanString(item.subject),
      startTime: cleanString(item.startTime),
      endTime: cleanString(item.endTime),
      note: cleanString(item.note),
    }))
    .filter((item) => item.period && item.className && item.subject);
}

function normalizeMoney(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount) : 0;
}

async function verifySuperadminPassword(req) {
  const password = req.body.superadminPassword;
  if (!password) {
    const error = new Error("Superadmin password is required");
    error.statusCode = 400;
    throw error;
  }

  const superadmin = await User.findById(req.user._id).select("+password");
  if (!superadmin || superadmin.role !== "superadmin" || !(await superadmin.comparePassword(password))) {
    const error = new Error("Invalid superadmin password");
    error.statusCode = 403;
    throw error;
  }
}

async function ensureUniqueLogin({ email, username, excludeId }) {
  const checks = [];
  if (email) checks.push({ email: String(email).toLowerCase().trim() });
  if (username) checks.push({ username: cleanUsername(username) });
  if (!checks.length) return;

  const existing = await User.findOne({
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    $or: checks,
  });
  if (existing) {
    const error = new Error("Username or email already exists");
    error.statusCode = 400;
    throw error;
  }
}

function buildPayrollPayload(body) {
  return {
    employeeCode: cleanString(body.employeeCode),
    payrollCategory: cleanPayrollCategory(body.payrollCategory),
    department: cleanString(body.department),
    designation: cleanString(body.designation),
    monthlySalary: normalizeMoney(body.monthlySalary),
    includeSundaySalary: body.includeSundaySalary !== false,
    bankName: cleanString(body.bankName),
    accountNo: cleanString(body.accountNo),
    ifscCode: cleanString(body.ifscCode).toUpperCase(),
  };
}

function buildProfilePayload(body) {
  const payload = {
    employeeCode: cleanString(body.employeeCode),
    designation: cleanString(body.designation),
    department: cleanString(body.department),
    qualification: cleanString(body.qualification),
    alternatePhone: cleanString(body.alternatePhone),
    address: cleanString(body.address),
    about: cleanString(body.about),
    subjects: cleanStringArray(body.subjects),
  };

  if (body.experienceYears === "" || body.experienceYears === null || body.experienceYears === undefined) {
    payload.experienceYears = undefined;
  } else {
    payload.experienceYears = Number(body.experienceYears);
  }

  if (Array.isArray(body.assignments)) payload.assignments = cleanAssignments(body.assignments);
  if (Array.isArray(body.schedule)) payload.schedule = cleanSchedule(body.schedule);

  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined || Number.isNaN(payload[key])) delete payload[key];
  });

  return payload;
}

function staffProfileResponse(user, profile, payroll) {
  return {
    id: user._id,
    _id: user._id,
    name: user.name,
    username: user.username || "",
    email: user.email,
    phone: user.phone || "",
    role: user.role,
    status: user.status,
    profilePhotoUrl: user.profilePhotoUrl || "",
    campus: user.campus || "",
    academicYear: user.academicYear || "",
    employeeCode: payroll?.employeeCode || profile?.employeeCode || "",
    payrollCategory: payroll?.payrollCategory || "Skilled",
    department: payroll?.department || profile?.department || (user.role === "teacher" ? "Teaching Staff" : ""),
    designation: payroll?.designation || profile?.designation || "",
    monthlySalary: payroll?.monthlySalary || 0,
    includeSundaySalary: payroll?.includeSundaySalary !== false,
    bankName: payroll?.bankName || "",
    accountNo: payroll?.accountNo || "",
    ifscCode: payroll?.ifscCode || "",
    qualification: profile?.qualification || "",
    experienceYears: profile?.experienceYears ?? "",
    alternatePhone: profile?.alternatePhone || "",
    address: profile?.address || "",
    about: profile?.about || "",
    subjects: profile?.subjects || [],
    assignments: profile?.assignments || [],
    schedule: profile?.schedule || [],
  };
}

async function buildStaffRows(users) {
  const payrolls = await StaffPayroll.find({ userId: { $in: users.map((user) => user._id) } }).lean();
  const profiles = await TeacherProfile.find({ userId: { $in: users.map((user) => user._id) } }).lean();
  const payrollByUserId = new Map(payrolls.map((payroll) => [String(payroll.userId), payroll]));
  const profileByUserId = new Map(profiles.map((profile) => [String(profile.userId), profile]));

  return users.map((user) => {
    const payroll = payrollByUserId.get(String(user._id));
    const profile = profileByUserId.get(String(user._id));
    return {
      id: user._id,
      _id: user._id,
      name: user.name,
      username: user.username || "",
      email: user.email,
      phone: profile?.alternatePhone || user.phone || "",
      role: user.role,
      status: user.status,
      profilePhotoUrl: user.profilePhotoUrl || "",
      employeeCode: payroll?.employeeCode || profile?.employeeCode || "",
      payrollCategory: payroll?.payrollCategory || "Skilled",
      department: payroll?.department || profile?.department || (user.role === "teacher" ? "Teaching Staff" : ""),
      designation: payroll?.designation || profile?.designation || "",
      monthlySalary: payroll?.monthlySalary || 0,
      includeSundaySalary: payroll?.includeSundaySalary !== false,
      bankName: payroll?.bankName || "",
      accountNo: payroll?.accountNo || "",
      ifscCode: payroll?.ifscCode || "",
      createdAt: user.createdAt,
    };
  });
}

router.get("/", auth, authorize("superadmin", "admin", "accountant"), async (req, res) => {
  try {
    const users = await User.find({ role: { $in: STAFF_ROLES } })
      .select("-password -otpHash")
      .sort({ role: 1, name: 1 })
      .lean();
    res.json(await buildStaffRows(users));
  } catch (err) {
    console.error("Error loading staff directory", err);
    res.status(500).json({ error: "Failed to load staff directory" });
  }
});

router.get("/:id/profile", auth, authorize("superadmin", "admin"), async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, role: { $in: STAFF_ROLES } })
      .select("-password -otpHash")
      .lean();
    if (!user) return res.status(404).json({ error: "Staff account not found" });

    const [profile, payroll] = await Promise.all([
      TeacherProfile.findOne({ userId: user._id }).lean(),
      StaffPayroll.findOne({ userId: user._id }).lean(),
    ]);

    res.json(staffProfileResponse(user, profile, payroll));
  } catch (err) {
    console.error("Error loading staff profile", err);
    res.status(500).json({ error: "Failed to load staff profile" });
  }
});

router.put("/:id/profile", auth, authorize("superadmin", "admin"), async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, role: { $in: STAFF_ROLES } });
    if (!user) return res.status(404).json({ error: "Staff account not found" });

    const email = cleanString(req.body.email).toLowerCase();
    if (email && email !== user.email) {
      await ensureUniqueLogin({ email, excludeId: user._id });
      user.email = email;
    }

    if (req.body.name !== undefined) user.name = cleanString(req.body.name) || user.name;
    if (req.body.phone !== undefined) user.phone = cleanString(req.body.phone).replace(/\D/g, "").slice(0, 10);
    if (req.body.profilePhotoUrl !== undefined) user.profilePhotoUrl = cleanString(req.body.profilePhotoUrl);
    await user.save();

    const profilePayload = buildProfilePayload(req.body);
    const profile = await TeacherProfile.findOneAndUpdate(
      { userId: user._id },
      { $set: profilePayload, $setOnInsert: { userId: user._id } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();

    const payroll = await StaffPayroll.findOneAndUpdate(
      { userId: user._id },
      {
        $set: {
          employeeCode: cleanString(req.body.employeeCode),
          department: cleanString(req.body.department),
          designation: cleanString(req.body.designation),
        },
        $setOnInsert: { userId: user._id },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();

    res.json(staffProfileResponse(user.toObject(), profile, payroll));
  } catch (err) {
    console.error("Error saving staff profile", err);
    res.status(err.statusCode || 500).json({ error: err.message || "Failed to save staff profile" });
  }
});

router.get("/:id/progress", auth, authorize("superadmin", "admin"), async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, role: { $in: STAFF_ROLES } })
      .select("-password -otpHash")
      .lean();
    if (!user) return res.status(404).json({ error: "Staff account not found" });

    const [profile, records] = await Promise.all([
      TeacherProfile.findOne({ userId: user._id }).lean(),
      TeacherClassRecord.find({ teacherId: user._id }).sort({ date: -1, className: 1, subject: 1 }).lean(),
    ]);

    const studentIds = [
      ...new Set(
        records
          .flatMap((record) => [
            ...(record.copySubmittedStudentIds || []),
            ...(record.examCopyTakenStudentIds || []),
          ])
          .map((id) => String(id || "").trim())
          .filter(Boolean)
      ),
    ];
    const students = studentIds.length
      ? await Student.find({ _id: { $in: studentIds } }).select("name admissionNo className rollNo").lean()
      : [];
    const studentById = new Map(students.map((student) => [String(student._id), student]));
    const namesForIds = (ids = []) =>
      ids
        .map((id) => studentById.get(String(id)))
        .filter(Boolean)
        .map((student) => ({
          id: student._id,
          name: student.name,
          admissionNo: student.admissionNo,
          className: student.className,
          rollNo: student.rollNo,
        }));

    const reviewedStatuses = new Set(["reviewed", "approved", "needs_correction"]);
    const summary = {
      totalRecords: records.length,
      submittedRecords: records.filter((record) => record.reviewStatus === "submitted").length,
      reviewedRecords: records.filter((record) => reviewedStatuses.has(record.reviewStatus)).length,
      approvedRecords: records.filter((record) => record.reviewStatus === "approved").length,
      needsCorrection: records.filter((record) => record.reviewStatus === "needs_correction").length,
      completedPeriods: records.filter((record) => record.periodStatus === "completed").length,
      classes: [...new Set(records.map((record) => record.className).filter(Boolean))],
      subjects: [...new Set(records.map((record) => record.subject).filter(Boolean))],
    };

    res.json({
      staff: {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profilePhotoUrl: user.profilePhotoUrl || "",
      },
      profile: profile || null,
      summary,
      records: records.slice(0, 80).map((record) => ({
        ...record,
        copySubmittedStudents: namesForIds(record.copySubmittedStudentIds),
        examCopyTakenStudents: namesForIds(record.examCopyTakenStudentIds),
      })),
    });
  } catch (err) {
    console.error("Error loading staff progress", err);
    res.status(500).json({ error: err.message || "Failed to load staff progress" });
  }
});

router.post("/", auth, authorize("superadmin"), async (req, res) => {
  try {
    await verifySuperadminPassword(req);

    const name = cleanString(req.body.name);
    const email = cleanString(req.body.email).toLowerCase();
    const username = cleanUsername(req.body.username);
    const password = req.body.password;
    if (!name || !email || !username || !password) {
      return res.status(400).json({ error: "Name, username, email, and login password are required" });
    }

    await ensureUniqueLogin({ email, username });

    const user = await User.create({
      name,
      username,
      email,
      password,
      phone: cleanString(req.body.phone),
      role: cleanRole(req.body.role),
      status: cleanStatus(req.body.status),
    });

    await StaffPayroll.findOneAndUpdate(
      { userId: user._id },
      { $set: buildPayrollPayload(req.body), $setOnInsert: { userId: user._id } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );

    const rows = await buildStaffRows([user.toObject()]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Error creating staff", err);
    res.status(err.statusCode || 500).json({ error: err.message || "Failed to create staff" });
  }
});

router.put("/:id", auth, authorize("superadmin"), async (req, res) => {
  try {
    await verifySuperadminPassword(req);

    const user = await User.findById(req.params.id).select("+password");
    if (!user || !STAFF_ROLES.includes(user.role)) {
      return res.status(404).json({ error: "Staff account not found" });
    }

    const email = cleanString(req.body.email).toLowerCase();
    const username = cleanUsername(req.body.username);
    await ensureUniqueLogin({ email, username, excludeId: user._id });

    user.name = cleanString(req.body.name) || user.name;
    user.username = username || user.username;
    user.email = email || user.email;
    user.phone = cleanString(req.body.phone);
    user.role = cleanRole(req.body.role);
    user.status = cleanStatus(req.body.status);
    if (req.body.password) user.password = req.body.password;
    await user.save();

    await StaffPayroll.findOneAndUpdate(
      { userId: user._id },
      { $set: buildPayrollPayload(req.body), $setOnInsert: { userId: user._id } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );

    const rows = await buildStaffRows([user.toObject()]);
    res.json(rows[0]);
  } catch (err) {
    console.error("Error updating staff", err);
    res.status(err.statusCode || 500).json({ error: err.message || "Failed to update staff" });
  }
});

router.delete("/:id", auth, authorize("superadmin"), async (req, res) => {
  try {
    await verifySuperadminPassword(req);

    if (String(req.params.id) === String(req.user._id)) {
      return res.status(400).json({ error: "You cannot delete your own account" });
    }

    const user = await User.findOneAndDelete({ _id: req.params.id, role: { $in: STAFF_ROLES } });
    if (!user) return res.status(404).json({ error: "Staff account not found" });

    await Promise.all([
      StaffPayroll.deleteOne({ userId: user._id }),
      TeacherProfile.deleteOne({ userId: user._id }),
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting staff", err);
    res.status(err.statusCode || 500).json({ error: err.message || "Failed to delete staff" });
  }
});

module.exports = router;
