const express = require("express");
const User = require("../models/User");
const TeacherProfile = require("../models/TeacherProfile");
const StaffPayroll = require("../models/StaffPayroll");
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
