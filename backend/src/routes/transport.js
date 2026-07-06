const express = require("express");
const TransportVehicle = require("../models/TransportVehicle");
const TransportFee = require("../models/TransportFee");
const Student = require("../models/Student");
const auth = require("../middleware/auth");
const { authorize } = require("../middleware/auth");

const router = express.Router();

const VIEW_ROLES = ["transport.view"];
const MANAGE_ROLES = ["transport.manage"];
const PAYMENT_ROLES = ["fees.manage"];

const DEFAULT_MONTHS = [
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
  "January",
  "February",
  "March",
];
const MONTH_INDEX = DEFAULT_MONTHS.reduce((map, month, index) => {
  map[month] = index;
  return map;
}, {});
const CALENDAR_MONTH_INDEX = {
  April: 3,
  May: 4,
  June: 5,
  July: 6,
  August: 7,
  September: 8,
  October: 9,
  November: 10,
  December: 11,
  January: 0,
  February: 1,
  March: 2,
};
const DAY_MS = 24 * 60 * 60 * 1000;

function cleanString(value) {
  return String(value || "").trim();
}

function normalizeMoney(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount) : 0;
}

function normalizePositiveNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

function normalizeBoolean(value) {
  return value === true || value === "true" || value === "on" || value === 1 || value === "1";
}

function currentAcademicYear(date = new Date()) {
  const year = date.getFullYear();
  return date.getMonth() >= 3 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

function getAcademicYearParts(academicYear) {
  const parts = String(academicYear || "").match(/\d{4}/g) || [];
  const startYear = Number(parts[0]) || new Date().getFullYear();
  const endYear = Number(parts[1]) || startYear + 1;
  return { startYear, endYear };
}

function normalizeDate(date) {
  const next = date ? new Date(date) : new Date();
  next.setHours(0, 0, 0, 0);
  return next;
}

function normalizeOptionalDate(date) {
  if (!date) return null;
  const next = normalizeDate(date);
  return Number.isNaN(next.getTime()) ? null : next;
}

function getLateFeeDate(monthName, academicYear, startDay = 10) {
  const { startYear, endYear } = getAcademicYearParts(academicYear);
  const monthIndex = MONTH_INDEX[monthName] ?? 0;
  const calendarMonthIndex = CALENDAR_MONTH_INDEX[monthName] ?? 0;
  const calendarYear = monthIndex <= 8 ? startYear : endYear;
  return normalizeDate(new Date(calendarYear, calendarMonthIndex, Number(startDay) || 10));
}

function getLateFeeEndDate(monthName, academicYear) {
  const { startYear, endYear } = getAcademicYearParts(academicYear);
  const monthIndex = MONTH_INDEX[monthName] ?? 0;
  const calendarMonthIndex = CALENDAR_MONTH_INDEX[monthName] ?? 0;
  const calendarYear = monthIndex <= 8 ? startYear : endYear;
  const lastDate = new Date(calendarYear, calendarMonthIndex + 1, 0).getDate();
  return normalizeDate(new Date(calendarYear, calendarMonthIndex, Math.min(30, lastDate)));
}

function getMonthLateFee(month, fee, asOf = new Date()) {
  const perDay = normalizeMoney(month.lateFeePerDay ?? fee.lateFeePerDay ?? 10);
  if (!perDay) return 0;

  const startDay = Number(month.lateFeeStartDay || fee.lateFeeStartDay || 10);
  const compareDate = normalizeDate(month.status === "Paid" && month.paidDate ? month.paidDate : asOf);
  const lateDate = getLateFeeDate(month.name, fee.academicYear, startDay);
  if (compareDate < lateDate) return 0;

  const lateEndDate = getLateFeeEndDate(month.name, fee.academicYear);
  const cappedCompareDate = compareDate > lateEndDate ? lateEndDate : compareDate;
  return (Math.floor((cappedCompareDate - lateDate) / DAY_MS) + 1) * perDay;
}

function recomputeTotals(fee, asOf = new Date()) {
  let total = 0;
  let paid = 0;
  let due = 0;

  for (const month of fee.months || []) {
    const baseAmount = normalizeMoney(month.amount);
    if (!month.lateFeePerDay) month.lateFeePerDay = fee.lateFeePerDay || 10;
    if (!month.lateFeeStartDay) month.lateFeeStartDay = fee.lateFeeStartDay || 10;

    if (month.status === "Paid") {
      if (month.lateFeePaidAmount === undefined || month.lateFeePaidAmount === null) {
        month.lateFeePaidAmount = getMonthLateFee(month, fee, month.paidDate || asOf);
      }
      const paidLateFee = normalizeMoney(month.lateFeePaidAmount);
      month.lateFeeDueAmount = paidLateFee;
      total += baseAmount + paidLateFee;
      paid += baseAmount + paidLateFee;
    } else {
      const dueNow = isTransportMonthDueNow(month.name, fee, asOf);
      const lateFee = dueNow ? getMonthLateFee(month, fee, asOf) : 0;
      month.lateFeeDueAmount = lateFee;
      month.lateFeePaidAmount = 0;
      total += baseAmount + lateFee;
      if (dueNow) due += baseAmount + lateFee;
    }
  }

  fee.totalFee = total;
  fee.paidAmount = paid;
  fee.dueAmount = Math.max(0, due);
}

function shouldChargeMonth(monthName, academicYear, startDate) {
  const normalizedStart = normalizeOptionalDate(startDate);
  if (!normalizedStart) return true;

  const rangeStart = getMonthDateRange(monthName, academicYear).to;
  return rangeStart >= normalizedStart;
}

function getMonthDateRange(monthName, academicYear) {
  const monthIndex = MONTH_INDEX[monthName] ?? 0;
  const { startYear, endYear } = getAcademicYearParts(academicYear);
  const calendarYear = monthIndex <= 8 ? startYear : endYear;
  const calendarMonth = CALENDAR_MONTH_INDEX[monthName] ?? 0;

  return {
    from: normalizeDate(new Date(calendarYear, calendarMonth, 1)),
    to: normalizeDate(new Date(calendarYear, calendarMonth + 1, 0)),
  };
}

function isTransportMonthDueNow(monthName, fee, asOf = new Date()) {
  const today = normalizeDate(asOf);
  const startDate = normalizeOptionalDate(fee.startDate);
  if (startDate && startDate > today) return false;

  const range = getMonthDateRange(monthName, fee.academicYear);
  return range.from <= today && (!startDate || range.to >= startDate);
}

function buildMonths(monthlyAmount, academicYear, startDate, existingMonths = []) {
  const existingByName = new Map(existingMonths.map((month) => [month.name, month]));

  return DEFAULT_MONTHS.filter((name) => shouldChargeMonth(name, academicYear, startDate)).map((name) => {
    const existing = existingByName.get(name);
    if (existing?.status === "Paid") {
      existing.amount = normalizeMoney(existing.amount || monthlyAmount);
      return existing;
    }

    return {
      name,
      amount: monthlyAmount,
      status: "Pending",
      paidDate: null,
      lateFeePerDay: 10,
      lateFeeStartDay: 10,
      lateFeeDueAmount: 0,
      lateFeePaidAmount: 0,
    };
  });
}

function buildVehiclePayload(body) {
  return {
    vehicleNo: cleanString(body.vehicleNo).toUpperCase(),
    vehicleType: cleanString(body.vehicleType) || "Bus",
    capacity: normalizePositiveNumber(body.capacity),
    driverName: cleanString(body.driverName),
    driverAddress: cleanString(body.driverAddress),
    driverContactNo: cleanString(body.driverContactNo),
    driverLicenseNo: cleanString(body.driverLicenseNo),
    driverEmergencyNo: cleanString(body.driverEmergencyNo),
    helperName: cleanString(body.helperName),
    helperContactNo: cleanString(body.helperContactNo),
    femaleAttendantName: cleanString(body.femaleAttendantName),
    femaleAttendantContactNo: cleanString(body.femaleAttendantContactNo),
    hasFireExtinguisher: normalizeBoolean(body.hasFireExtinguisher),
    hasFirstAidKit: normalizeBoolean(body.hasFirstAidKit),
    status: ["Active", "Maintenance", "Inactive"].includes(body.status) ? body.status : "Active",
    notes: cleanString(body.notes),
  };
}

function escapeRegex(value) {
  return cleanString(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function buildVehicleDetail(vehicleId, academicYear) {
  const vehicle = await TransportVehicle.findById(vehicleId)
    .populate("students.student", "name admissionNo className fatherName mobileNo rollNo")
    .lean();

  if (!vehicle) return null;

  const fees = await TransportFee.find({
    vehicle: vehicleId,
    academicYear,
  }).sort({ className: 1, studentName: 1 });

  await Promise.all(
    fees.map(async (fee) => {
      recomputeTotals(fee);
      await fee.save();
    })
  );

  return {
    vehicle,
    fees: fees.map((fee) => fee.toObject()),
  };
}

async function buildVehicleList(academicYear) {
  const vehicles = await TransportVehicle.find().sort({ vehicleNo: 1 }).lean();
  const vehicleIds = vehicles.map((vehicle) => vehicle._id);
  const fees = await TransportFee.find({ vehicle: { $in: vehicleIds }, academicYear });
  const feeSummaryByVehicle = new Map();

  fees.forEach((fee) => {
    recomputeTotals(fee);
    const key = String(fee.vehicle);
    const summary = feeSummaryByVehicle.get(key) || { totalFee: 0, paidAmount: 0, dueAmount: 0 };
    summary.totalFee += fee.totalFee || 0;
    summary.paidAmount += fee.paidAmount || 0;
    summary.dueAmount += fee.dueAmount || 0;
    feeSummaryByVehicle.set(key, summary);
  });

  return vehicles.map((vehicle) => ({
    ...vehicle,
    assignedCount: (vehicle.students || []).filter((entry) => entry.status !== "Inactive").length,
    feeSummary: feeSummaryByVehicle.get(String(vehicle._id)) || { totalFee: 0, paidAmount: 0, dueAmount: 0 },
  }));
}

router.get("/vehicles", auth, authorize(...VIEW_ROLES), async (req, res) => {
  try {
    const academicYear = cleanString(req.query.academicYear) || currentAcademicYear();
    res.json(await buildVehicleList(academicYear));
  } catch (err) {
    console.error("Error loading transport vehicles", err);
    res.status(500).json({ error: "Failed to load transport vehicles" });
  }
});

router.post("/vehicles", auth, authorize(...MANAGE_ROLES), async (req, res) => {
  try {
    const payload = buildVehiclePayload(req.body);
    if (!payload.vehicleNo) {
      return res.status(400).json({ error: "Vehicle number is required" });
    }

    const vehicle = await TransportVehicle.create(payload);
    res.status(201).json(vehicle);
  } catch (err) {
    console.error("Error creating transport vehicle", err);
    res.status(err.code === 11000 ? 400 : 500).json({
      error: err.code === 11000 ? "Vehicle number already exists" : "Failed to create vehicle",
    });
  }
});

router.get("/vehicles/:id", auth, authorize(...VIEW_ROLES), async (req, res) => {
  try {
    const academicYear = cleanString(req.query.academicYear) || currentAcademicYear();
    const detail = await buildVehicleDetail(req.params.id, academicYear);
    if (!detail) return res.status(404).json({ error: "Vehicle not found" });
    res.json(detail);
  } catch (err) {
    console.error("Error loading transport vehicle detail", err);
    res.status(500).json({ error: "Failed to load vehicle detail" });
  }
});

router.put("/vehicles/:id", auth, authorize(...MANAGE_ROLES), async (req, res) => {
  try {
    const payload = buildVehiclePayload(req.body);
    if (!payload.vehicleNo) {
      return res.status(400).json({ error: "Vehicle number is required" });
    }

    const vehicle = await TransportVehicle.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });
    if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });

    await TransportFee.updateMany(
      { vehicle: vehicle._id },
      {
        $set: {
          vehicleNo: vehicle.vehicleNo,
          routeName: "",
        },
      }
    );

    res.json(vehicle);
  } catch (err) {
    console.error("Error updating transport vehicle", err);
    res.status(err.code === 11000 ? 400 : 500).json({
      error: err.code === 11000 ? "Vehicle number already exists" : "Failed to update vehicle",
    });
  }
});

router.delete("/vehicles/:id", auth, authorize(...MANAGE_ROLES), async (req, res) => {
  try {
    const vehicle = await TransportVehicle.findByIdAndDelete(req.params.id);
    if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });

    await TransportFee.deleteMany({ vehicle: vehicle._id });
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting transport vehicle", err);
    res.status(500).json({ error: "Failed to delete vehicle" });
  }
});

router.get("/classes", auth, authorize(...VIEW_ROLES), async (req, res) => {
  try {
    const classes = await Student.distinct("className", { status: { $nin: ["inactive", "Inactive"] } });
    res.json(classes.filter(Boolean).sort());
  } catch (err) {
    console.error("Error loading transport classes", err);
    res.status(500).json({ error: "Failed to load classes" });
  }
});

router.get("/students", auth, authorize(...VIEW_ROLES), async (req, res) => {
  try {
    const className = cleanString(req.query.className);
    if (!className) return res.json([]);

    const search = escapeRegex(req.query.search);
    const query = {
      className: new RegExp(`^${escapeRegex(className)}$`, "i"),
      status: { $nin: ["inactive", "Inactive"] },
    };
    if (search) {
      query.$or = [
        { name: new RegExp(search, "i") },
        { admissionNo: new RegExp(search, "i") },
        { fatherName: new RegExp(search, "i") },
        { mobileNo: new RegExp(search, "i") },
        { rollNo: new RegExp(search, "i") },
      ];
    }

    const students = await Student.find(query)
      .select("name admissionNo className fatherName mobileNo rollNo")
      .sort({ rollNo: 1, name: 1 })
      .limit(120)
      .lean();
    res.json(students);
  } catch (err) {
    console.error("Error loading transport students", err);
    res.status(500).json({ error: "Failed to load students" });
  }
});

router.post("/vehicles/:id/students", auth, authorize(...MANAGE_ROLES), async (req, res) => {
  try {
    const academicYear = cleanString(req.body.academicYear) || currentAcademicYear();
    const monthlyFee = normalizeMoney(req.body.monthlyFee);
    const startDate = normalizeOptionalDate(req.body.startDate) || normalizeDate(new Date());
    if (!monthlyFee) {
      return res.status(400).json({ error: "Monthly transport fee is required" });
    }

    const [vehicle, student] = await Promise.all([
      TransportVehicle.findById(req.params.id),
      Student.findById(req.body.studentId),
    ]);
    if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });
    if (!student) return res.status(404).json({ error: "Student not found" });

    await TransportVehicle.updateMany(
      { _id: { $ne: vehicle._id } },
      { $pull: { students: { student: student._id } } }
    );

    const existingAssignment = vehicle.students.find((entry) => String(entry.student) === String(student._id));
    const pickupPoint = cleanString(req.body.pickupPoint);
    if (existingAssignment) {
      existingAssignment.monthlyFee = monthlyFee;
      existingAssignment.pickupPoint = pickupPoint;
      existingAssignment.status = "Active";
      existingAssignment.joinedAt = startDate;
    } else {
      vehicle.students.push({
        student: student._id,
        monthlyFee,
        pickupPoint,
        status: "Active",
        joinedAt: startDate,
      });
    }
    await vehicle.save();

    let fee = await TransportFee.findOne({
      student: student._id,
      vehicle: vehicle._id,
      academicYear,
    });

    const feePayload = {
      studentName: student.name,
      admissionNo: student.admissionNo,
      className: student.className,
      vehicleNo: vehicle.vehicleNo,
      routeName: "",
      pickupPoint,
      startDate,
      status: "Active",
      monthlyAmount: monthlyFee,
      lateFeePerDay: 10,
      lateFeeStartDay: 10,
    };

    if (!fee) {
      fee = new TransportFee({
        student: student._id,
        vehicle: vehicle._id,
        academicYear,
        ...feePayload,
        months: buildMonths(monthlyFee, academicYear, startDate),
      });
    } else {
      Object.assign(fee, feePayload);
      fee.months = buildMonths(monthlyFee, academicYear, startDate, fee.months || []);
    }

    recomputeTotals(fee);
    await fee.save();

    const detail = await buildVehicleDetail(vehicle._id, academicYear);
    res.status(201).json(detail);
  } catch (err) {
    console.error("Error assigning transport student", err);
    res.status(500).json({ error: err.message || "Failed to assign student" });
  }
});

router.delete("/vehicles/:id/students/:studentId", auth, authorize(...MANAGE_ROLES), async (req, res) => {
  try {
    const academicYear = cleanString(req.query.academicYear) || currentAcademicYear();
    const vehicle = await TransportVehicle.findByIdAndUpdate(
      req.params.id,
      { $pull: { students: { student: req.params.studentId } } },
      { new: true }
    );
    if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });

    await TransportFee.deleteOne({
      vehicle: vehicle._id,
      student: req.params.studentId,
      academicYear,
    });

    const detail = await buildVehicleDetail(vehicle._id, academicYear);
    res.json(detail);
  } catch (err) {
    console.error("Error removing transport student", err);
    res.status(500).json({ error: "Failed to remove student" });
  }
});

router.get("/fees", auth, authorize(...VIEW_ROLES), async (req, res) => {
  try {
    const academicYear = cleanString(req.query.academicYear);
    const query = academicYear ? { academicYear } : {};
    const fees = await TransportFee.find(query).sort({ academicYear: -1, className: 1, studentName: 1 });

    await Promise.all(
      fees.map(async (fee) => {
        recomputeTotals(fee);
        await fee.save();
      })
    );

    res.json(fees.map((fee) => fee.toObject()));
  } catch (err) {
    console.error("Error loading transport fee collections", err);
    res.status(500).json({ error: "Failed to load transport fee collections" });
  }
});

router.patch("/fees/:feeId/months/:monthName", auth, authorize(...PAYMENT_ROLES), async (req, res) => {
  try {
    const fee = await TransportFee.findById(req.params.feeId);
    if (!fee) return res.status(404).json({ error: "Transport fee plan not found" });

    const month = fee.months.find((item) => item.name === req.params.monthName);
    if (!month) return res.status(404).json({ error: "Month not found" });

    if (month.status === "Paid") {
      month.status = "Pending";
      month.paidDate = null;
      month.lateFeePaidAmount = 0;
    } else {
      month.status = "Paid";
      month.paidDate = req.body.paidDate ? new Date(req.body.paidDate) : new Date();
      month.lateFeePaidAmount = getMonthLateFee(month, fee, month.paidDate);
    }

    recomputeTotals(fee);
    await fee.save();
    res.json(fee);
  } catch (err) {
    console.error("Error updating transport fee month", err);
    res.status(500).json({ error: "Failed to update transport fee" });
  }
});

module.exports = router;
