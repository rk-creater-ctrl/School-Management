const express = require("express");
const User = require("../models/User");
const TeacherProfile = require("../models/TeacherProfile");
const StaffPayroll = require("../models/StaffPayroll");
const auth = require("../middleware/auth");
const { authorize } = require("../middleware/auth");

const router = express.Router();

const EMPLOYEE_ROLES = ["admin", "teacher", "accountant", "librarian", "staff"];
const PAYROLL_CATEGORIES = ["Skilled", "Half-skilled", "Unskilled"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function cleanString(value) {
  return String(value || "").trim();
}

function cleanPayrollCategory(value, fallback = "Skilled") {
  const category = cleanString(value);
  return PAYROLL_CATEGORIES.includes(category) ? category : fallback;
}

function normalizeMoney(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount) : 0;
}

function normalizeSignedMoney(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.round(amount) : 0;
}

function getMonthInput(source = {}) {
  if (source.monthKey) {
    const [yearText, monthText] = String(source.monthKey).split("-");
    const year = Number(yearText);
    const month = Number(monthText) - 1;
    if (Number.isInteger(year) && Number.isInteger(month) && month >= 0 && month <= 11) {
      return { year, month, monthKey: `${year}-${String(month + 1).padStart(2, "0")}` };
    }
  }

  const now = new Date();
  const year = Number(source.year) || now.getFullYear();
  const rawMonth = source.month === undefined ? now.getMonth() : Number(source.month);
  const month = rawMonth >= 1 && rawMonth <= 12 ? rawMonth - 1 : rawMonth;
  const safeMonth = Number.isInteger(month) && month >= 0 && month <= 11 ? month : now.getMonth();
  return { year, month: safeMonth, monthKey: `${year}-${String(safeMonth + 1).padStart(2, "0")}` };
}

function countSundays(year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let sundayCount = 0;
  for (let day = 1; day <= daysInMonth; day += 1) {
    if (new Date(year, month, day).getDay() === 0) sundayCount += 1;
  }
  return sundayCount;
}

function calculateSalary({ year, month, monthlySalary, includeSundaySalary, deductions = 0, bonus = 0 }) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const sundayCount = countSundays(year, month);
  const workingDays = daysInMonth - sundayCount;
  const salary = normalizeMoney(monthlySalary);
  const dailyRate = daysInMonth ? Math.round(salary / daysInMonth) : 0;
  const salaryWithoutSunday = daysInMonth ? Math.round((salary / daysInMonth) * workingDays) : 0;
  const sundaySalary = Math.max(0, salary - salaryWithoutSunday);
  const grossSalary = includeSundaySalary ? salaryWithoutSunday + sundaySalary : salaryWithoutSunday;
  const payableAmount = Math.max(0, grossSalary + normalizeSignedMoney(bonus) - normalizeMoney(deductions));

  return {
    daysInMonth,
    sundayCount,
    workingDays,
    monthlySalary: salary,
    dailyRate,
    salaryWithoutSunday,
    sundaySalary,
    includeSundaySalary: Boolean(includeSundaySalary),
    deductions: normalizeMoney(deductions),
    bonus: normalizeSignedMoney(bonus),
    payableAmount,
  };
}

function buildPayment(payroll, monthInput) {
  const existing = (payroll?.payments || []).find((payment) => payment.monthKey === monthInput.monthKey);
  const shouldKeepStored = existing && existing.status !== "Pending";
  if (shouldKeepStored) return existing.toObject ? existing.toObject() : existing;

  const calculation = calculateSalary({
    ...monthInput,
    monthlySalary: payroll?.monthlySalary,
    includeSundaySalary: payroll?.includeSundaySalary !== false,
    deductions: existing?.deductions || 0,
    bonus: existing?.bonus || 0,
  });

  return {
    monthKey: monthInput.monthKey,
    year: monthInput.year,
    month: monthInput.month,
    monthName: MONTH_NAMES[monthInput.month],
    ...calculation,
    status: existing?.status || "Pending",
    paidAmount: existing?.paidAmount || 0,
    paidDate: existing?.paidDate || null,
    note: existing?.note || "",
    _id: existing?._id,
  };
}

function paymentResponse(payment) {
  return {
    ...payment,
    monthName: MONTH_NAMES[payment.month],
  };
}

function roleLabel(role) {
  return cleanString(role).charAt(0).toUpperCase() + cleanString(role).slice(1);
}

async function buildEmployees(users, monthInput) {
  const profiles = await TeacherProfile.find({ userId: { $in: users.map((user) => user._id) } }).lean();
  const payrolls = await StaffPayroll.find({ userId: { $in: users.map((user) => user._id) } });
  const profileByUserId = new Map(profiles.map((profile) => [String(profile.userId), profile]));
  const payrollByUserId = new Map(payrolls.map((payroll) => [String(payroll.userId), payroll]));

  return users.map((user) => {
    const profile = profileByUserId.get(String(user._id));
    const payroll = payrollByUserId.get(String(user._id));
    const payment = buildPayment(payroll, monthInput);

    return {
      userId: user._id,
      name: user.name,
      email: user.email,
      phone: profile?.alternatePhone || user.phone || "",
      role: user.role,
      status: user.status,
      profilePhotoUrl: user.profilePhotoUrl || "",
      employeeCode: payroll?.employeeCode || profile?.employeeCode || `${roleLabel(user.role).slice(0, 4).toUpperCase()}-${String(user._id).slice(-6).toUpperCase()}`,
      payrollCategory: payroll?.payrollCategory || (user.role === "teacher" ? "Skilled" : "Skilled"),
      department: payroll?.department || profile?.department || (user.role === "teacher" ? "Teaching Staff" : roleLabel(user.role)),
      designation: payroll?.designation || profile?.designation || roleLabel(user.role),
      monthlySalary: payroll?.monthlySalary || 0,
      includeSundaySalary: payroll?.includeSundaySalary !== false,
      bankName: payroll?.bankName || "",
      accountNo: payroll?.accountNo || "",
      ifscCode: payroll?.ifscCode || "",
      currentPayment: paymentResponse(payment),
      payments: (payroll?.payments || []).map((item) => paymentResponse(item.toObject ? item.toObject() : item)).sort((a, b) => b.monthKey.localeCompare(a.monthKey)),
    };
  });
}

router.get("/employees", auth, authorize("superadmin", "accountant"), async (req, res) => {
  try {
    const monthInput = getMonthInput(req.query);
    const users = await User.find({ role: { $in: EMPLOYEE_ROLES }, status: { $ne: "suspended" } })
      .select("name email phone role status profilePhotoUrl")
      .sort({ role: 1, name: 1 })
      .lean();

    res.json({
      month: monthInput,
      employees: await buildEmployees(users, monthInput),
    });
  } catch (err) {
    console.error("Error loading staff payroll", err);
    res.status(500).json({ error: "Failed to load staff payroll" });
  }
});

router.get("/employees/:userId", auth, authorize("superadmin", "accountant"), async (req, res) => {
  try {
    const monthInput = getMonthInput(req.query);
    const user = await User.findOne({ _id: req.params.userId, role: { $in: EMPLOYEE_ROLES }, status: { $ne: "suspended" } })
      .select("name email phone role status profilePhotoUrl")
      .lean();

    if (!user) return res.status(404).json({ error: "Staff account not found" });

    const employees = await buildEmployees([user], monthInput);
    res.json({ month: monthInput, employee: employees[0] });
  } catch (err) {
    console.error("Error loading staff payroll detail", err);
    res.status(500).json({ error: "Failed to load staff payroll detail" });
  }
});

router.get("/me", auth, authorize("teacher", "staff", "accountant", "librarian", "admin"), async (req, res) => {
  try {
    const monthInput = getMonthInput(req.query);
    const employees = await buildEmployees([req.user], monthInput);
    res.json({ month: monthInput, employee: employees[0] });
  } catch (err) {
    console.error("Error loading own payroll", err);
    res.status(500).json({ error: "Failed to load salary details" });
  }
});

router.put("/employees/:userId/settings", auth, authorize("superadmin", "accountant"), async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.userId, role: { $in: EMPLOYEE_ROLES } }).lean();
    if (!user) return res.status(404).json({ error: "Staff account not found" });

    const payroll = await StaffPayroll.findOneAndUpdate(
      { userId: user._id },
      {
        $set: {
          employeeCode: cleanString(req.body.employeeCode),
          payrollCategory: cleanPayrollCategory(req.body.payrollCategory),
          department: cleanString(req.body.department),
          designation: cleanString(req.body.designation),
          monthlySalary: normalizeMoney(req.body.monthlySalary),
          includeSundaySalary: req.body.includeSundaySalary !== false,
          bankName: cleanString(req.body.bankName),
          accountNo: cleanString(req.body.accountNo),
          ifscCode: cleanString(req.body.ifscCode),
        },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    const monthInput = getMonthInput(req.body);
    const employees = await buildEmployees([user], monthInput);
    res.json({ payroll, employee: employees[0] });
  } catch (err) {
    console.error("Error saving payroll settings", err);
    res.status(500).json({ error: err.message || "Failed to save payroll settings" });
  }
});

router.patch("/employees/:userId/payments", auth, authorize("superadmin", "accountant"), async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.userId, role: { $in: EMPLOYEE_ROLES } }).lean();
    if (!user) return res.status(404).json({ error: "Staff account not found" });

    const payroll = await StaffPayroll.findOneAndUpdate(
      { userId: user._id },
      { $setOnInsert: { userId: user._id } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    const monthInput = getMonthInput(req.body);
    const status = ["Pending", "Partial", "Paid"].includes(req.body.status) ? req.body.status : "Paid";
    const calculation = calculateSalary({
      ...monthInput,
      monthlySalary: payroll.monthlySalary,
      includeSundaySalary: payroll.includeSundaySalary !== false,
      deductions: req.body.deductions,
      bonus: req.body.bonus,
    });
    const paidAmount = status === "Pending"
      ? 0
      : normalizeMoney(req.body.paidAmount || calculation.payableAmount);

    const paymentPayload = {
      ...monthInput,
      ...calculation,
      status,
      paidAmount,
      paidDate: status === "Pending" ? null : (req.body.paidDate ? new Date(req.body.paidDate) : new Date()),
      note: cleanString(req.body.note),
      markedBy: req.user._id,
    };

    const existing = payroll.payments.find((payment) => payment.monthKey === monthInput.monthKey);
    if (existing) {
      Object.assign(existing, paymentPayload);
    } else {
      payroll.payments.push(paymentPayload);
    }

    await payroll.save();

    const employees = await buildEmployees([user], monthInput);
    res.json({ employee: employees[0] });
  } catch (err) {
    console.error("Error marking salary payment", err);
    res.status(500).json({ error: err.message || "Failed to mark salary payment" });
  }
});

module.exports = router;
