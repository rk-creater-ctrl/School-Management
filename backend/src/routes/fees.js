const express = require("express");
const Fee = require("../models/Fee");
const Student = require("../models/Student");

const router = express.Router();

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
const DEFAULT_LATE_FEE_PER_DAY = 10;
const LATE_FEE_START_DAY = 10;
const LATE_FEE_END_DAY = 30;

function getAcademicYearParts(academicYear) {
  const parts = String(academicYear || "").match(/\d{4}/g) || [];
  const startYear = Number(parts[0]) || new Date().getFullYear();
  const endYear = Number(parts[1]) || startYear + 1;
  return { startYear, endYear };
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
  return normalizeDate(new Date(calendarYear, calendarMonthIndex, Math.min(LATE_FEE_END_DAY, lastDate)));
}

function normalizeMoney(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function normalizeText(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function normalizeDate(date) {
  const next = date ? new Date(date) : new Date();
  next.setHours(0, 0, 0, 0);
  return next;
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

function isMonthDueNow(monthName, academicYear, asOf = new Date()) {
  const today = normalizeDate(asOf);
  return getMonthDateRange(monthName, academicYear).from <= today;
}

function getMonthLateFee(month, item, academicYear, asOf = new Date()) {
  const perDay = normalizeMoney(month.lateFeeAmount ?? item.lateFeeAmount) || DEFAULT_LATE_FEE_PER_DAY;
  const startDay = Number(month.lateFeeStartDay || item.lateFeeStartDay || LATE_FEE_START_DAY);
  const compareDate = normalizeDate(month.status === "Paid" && month.paidDate ? month.paidDate : asOf);
  const lateDate = getLateFeeDate(month.name, academicYear, startDay);
  if (compareDate < lateDate) return 0;

  const lateEndDate = getLateFeeEndDate(month.name, academicYear);
  const cappedCompareDate = compareDate > lateEndDate ? lateEndDate : compareDate;
  return (Math.floor((cappedCompareDate - lateDate) / DAY_MS) + 1) * perDay;
}

function normalizeMonthName(value) {
  const text = normalizeText(value);
  if (!text) return "";
  return DEFAULT_MONTHS.find((month) => month.toLowerCase() === text.toLowerCase()) || "";
}

function isOneTimeItemDueNow(item, academicYear, asOf = new Date()) {
  const applicableMonth = normalizeMonthName(item.applicableMonth);
  if (!applicableMonth) return true;
  return isMonthDueNow(applicableMonth, academicYear, asOf);
}

function getOneTimeLateFee(item, academicYear, asOf = new Date()) {
  const applicableMonth = normalizeMonthName(item.applicableMonth);
  if (!applicableMonth) return 0;

  return getMonthLateFee(
    {
      name: applicableMonth,
      status: item.status,
      paidDate: item.paidDate,
      lateFeeAmount: item.lateFeeAmount,
      lateFeeStartDay: item.lateFeeStartDay,
    },
    item,
    academicYear,
    asOf
  );
}

function getDiscountedAmount(amount, concessionAmount) {
  return Math.max(0, normalizeMoney(amount) - normalizeMoney(concessionAmount));
}

function getPaymentsTotal(entry) {
  return (entry.payments || []).reduce((sum, payment) => sum + normalizeMoney(payment.amount), 0);
}

function getStoredPaidAmount(entry, payableAmount) {
  const paymentsTotal = getPaymentsTotal(entry);
  if (paymentsTotal > 0) return paymentsTotal;

  const storedPaid = normalizeMoney(entry.amountPaid);
  if (storedPaid > 0) return storedPaid;

  return entry.status === "Paid" ? payableAmount : 0;
}

function syncPaymentState(entry, payableAmount) {
  const paidAmount = getStoredPaidAmount(entry, payableAmount);
  entry.amountPaid = paidAmount;

  const sortedPayments = [...(entry.payments || [])]
    .filter((payment) => payment.paidDate)
    .sort((a, b) => new Date(b.paidDate) - new Date(a.paidDate));
  const latestPayment = sortedPayments[0];
  if (latestPayment) {
    entry.paidDate = latestPayment.paidDate;
    entry.paymentMode = latestPayment.paymentMode || entry.paymentMode || "Cash";
    entry.receiptNo = latestPayment.receiptNo || entry.receiptNo;
    entry.paymentNote = latestPayment.note || entry.paymentNote;
    entry.collectedBy = latestPayment.collectedBy || entry.collectedBy;
  }

  if (payableAmount <= 0 || paidAmount <= 0) {
    entry.status = "Pending";
  } else if (paidAmount >= payableAmount) {
    entry.status = "Paid";
  } else {
    entry.status = "Partial";
  }

  if (entry.status === "Pending") {
    entry.paidDate = null;
    entry.receiptNo = "";
  }

  return paidAmount;
}

function createReceiptNo(fee, period) {
  const year = String(fee.academicYear || "YEAR").replace(/\D/g, "").slice(0, 8);
  const admission = String(fee.admissionNo || fee.student || "STD").replace(/\W/g, "").slice(-6).toUpperCase();
  const code = String(period || "FEE").replace(/\W/g, "").slice(0, 8).toUpperCase();
  const stamp = Date.now().toString(36).toUpperCase().slice(-5);
  return `R-${year}-${admission}-${code}-${stamp}`;
}

function clearPayments(entry) {
  entry.payments = [];
  entry.amountPaid = 0;
  entry.status = "Pending";
  entry.paidDate = null;
  entry.paymentMode = "Cash";
  entry.receiptNo = "";
  entry.paymentNote = "";
  entry.collectedBy = "";
}

function addPayment(entry, fee, period, body = {}) {
  const amount = normalizeMoney(body.amount);
  if (!amount) {
    const error = new Error("Payment amount is required");
    error.status = 400;
    throw error;
  }

  const paidDate = body.paidDate ? new Date(body.paidDate) : new Date();
  const payment = {
    amount,
    paidDate,
    paymentMode: normalizeText(body.paymentMode, "Cash"),
    receiptNo: normalizeText(body.receiptNo, createReceiptNo(fee, period)),
    note: normalizeText(body.note),
    collectedBy: normalizeText(body.collectedBy),
  };

  entry.payments = [...(entry.payments || []), payment];
  entry.paymentMode = payment.paymentMode;
  entry.paidDate = payment.paidDate;
  entry.receiptNo = payment.receiptNo;
  entry.paymentNote = payment.note;
  entry.collectedBy = payment.collectedBy;
}

// Recalculate totals based on items and months
function recomputeTotals(fee, asOf = new Date()) {
  let total = 0;
  let paid = 0;
  let due = 0;

  for (const item of fee.items) {
    if (item.mode === "MONTHLY") {
      if (!normalizeMoney(item.lateFeeAmount)) {
        item.lateFeeAmount = DEFAULT_LATE_FEE_PER_DAY;
      }
      if (!item.lateFeeStartDay) item.lateFeeStartDay = LATE_FEE_START_DAY;

      const months = item.months || [];
      for (const m of months) {
        const baseAmount = normalizeMoney(m.amount);
        if (!normalizeMoney(m.lateFeeAmount)) {
          m.lateFeeAmount = normalizeMoney(item.lateFeeAmount) || DEFAULT_LATE_FEE_PER_DAY;
        }
        if (!m.lateFeeStartDay) m.lateFeeStartDay = item.lateFeeStartDay || LATE_FEE_START_DAY;

        const dueNow = isMonthDueNow(m.name, fee.academicYear, asOf);
        const isFullyPaidLegacy = m.status === "Paid";
        const compareDate = isFullyPaidLegacy && m.paidDate ? m.paidDate : asOf;
        const lateFee = dueNow || isFullyPaidLegacy ? getMonthLateFee(m, item, fee.academicYear, compareDate) : 0;
        const discountedAmount = getDiscountedAmount(baseAmount, m.concessionAmount);
        const payableAmount = discountedAmount + lateFee;
        const paidAmount = syncPaymentState(m, payableAmount);

        m.lateFeeDueAmount = lateFee;
        m.lateFeePaidAmount = m.status === "Paid" ? lateFee : 0;
        total += payableAmount;
        paid += paidAmount;
        if (dueNow) due += Math.max(0, payableAmount - paidAmount);
      }
    } else if (item.mode === "ONE_TIME") {
      if (!normalizeMoney(item.lateFeeAmount)) {
        item.lateFeeAmount = DEFAULT_LATE_FEE_PER_DAY;
      }
      if (!item.lateFeeStartDay) item.lateFeeStartDay = LATE_FEE_START_DAY;

      const dueNow = isOneTimeItemDueNow(item, fee.academicYear, asOf);
      const compareDate = item.status === "Paid" && item.paidDate ? item.paidDate : asOf;
      const lateFee = dueNow || item.status === "Paid"
        ? getOneTimeLateFee(item, fee.academicYear, compareDate)
        : 0;
      const payableAmount = getDiscountedAmount(item.amount, item.concessionAmount) + lateFee;
      const paidAmount = syncPaymentState(item, payableAmount);
      item.lateFeeDueAmount = lateFee;
      item.lateFeePaidAmount = item.status === "Paid" ? lateFee : 0;
      total += payableAmount;
      paid += paidAmount;
      if (dueNow) due += Math.max(0, payableAmount - paidAmount);
    }
  }

  fee.totalFee = total;
  fee.paidAmount = paid;
  fee.dueAmount = Math.max(0, due);
}

// Get all fee plans (admin list)
router.get("/", async (req, res) => {
  try {
    const fees = await Fee.find().sort({ createdAt: -1 });
    fees.forEach((fee) => recomputeTotals(fee));
    res.json(fees);
  } catch (err) {
    console.error("Error fetching fees", err);
    res.status(500).json({ error: "Failed to fetch fees" });
  }
});

// Get detail for one student + year
router.get("/student/:studentId/year/:year", async (req, res) => {
  try {
    const { studentId, year } = req.params;
    const fee = await Fee.findOne({
      student: studentId,
      academicYear: year,
    });

    if (!fee) return res.status(404).json({ error: "Fee plan not found" });

    recomputeTotals(fee);
    res.json(fee);
  } catch (err) {
    console.error("Error fetching fee detail", err);
    res.status(500).json({ error: "Failed to fetch fee detail" });
  }
});

// Get all plans for one student (student app)
router.get("/student/:studentId", async (req, res) => {
  try {
    const fees = await Fee.find({ student: req.params.studentId }).sort({
      academicYear: -1,
    });
    fees.forEach((fee) => recomputeTotals(fee));
    res.json(fees);
  } catch (err) {
    console.error("Error fetching student fees", err);
    res.status(500).json({ error: "Failed to fetch student fees" });
  }
});

// Create tuition plan (month-wise) for a student+year
router.post("/create-tuition", async (req, res) => {
  try {
    const { studentId, academicYear, monthlyAmount, lateFeeAmount = DEFAULT_LATE_FEE_PER_DAY } = req.body;

    if (!studentId || !academicYear || !monthlyAmount) {
      return res.status(400).json({
        error: "studentId, academicYear and monthlyAmount are required",
      });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    let fee = await Fee.findOne({
      student: studentId,
      academicYear,
    });

    const amountNum = Number(monthlyAmount);
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: "monthlyAmount must be > 0" });
    }
    const lateFeeNum = normalizeMoney(lateFeeAmount);

    const months = DEFAULT_MONTHS.map((name) => ({
      name,
      amount: amountNum,
      status: "Pending",
      paidDate: null,
      amountPaid: 0,
      concessionAmount: 0,
      paymentMode: "Cash",
      receiptNo: "",
      paymentNote: "",
      payments: [],
      lateFeeAmount: lateFeeNum,
      lateFeeStartDay: LATE_FEE_START_DAY,
      lateFeeDueAmount: 0,
      lateFeePaidAmount: 0,
    }));

    const tuitionItem = {
      label: "Tuition Fee",
      type: "TUITION",
      mode: "MONTHLY",
      monthlyAmount: amountNum,
      lateFeeAmount: lateFeeNum,
      lateFeeStartDay: LATE_FEE_START_DAY,
      months,
    };

    if (!fee) {
      fee = new Fee({
        student: student._id,
        studentName: student.name,
        admissionNo: student.admissionNo,
        className: student.className,
        academicYear,
        items: [tuitionItem],
      });
    } else {
      const hasTuition = fee.items.some(
        (i) => i.type === "TUITION" && i.mode === "MONTHLY"
      );
      if (hasTuition) {
        return res
          .status(400)
          .json({ error: "Tuition plan already exists for this year" });
      }
      fee.items.push(tuitionItem);
    }

    recomputeTotals(fee);
    await fee.save();
    res.status(201).json(fee);
  } catch (err) {
    console.error("Error creating tuition plan", err);
    res.status(500).json({ error: "Failed to create tuition plan" });
  }
});

// Update tuition late fee settings
router.patch("/:feeId/tuition-late-fee", async (req, res) => {
  try {
    const { feeId } = req.params;
    const { itemId, lateFeeAmount = DEFAULT_LATE_FEE_PER_DAY } = req.body;

    const fee = await Fee.findById(feeId);
    if (!fee) return res.status(404).json({ error: "Fee plan not found" });

    const item = fee.items.id(itemId);
    if (!item || item.mode !== "MONTHLY") {
      return res.status(404).json({ error: "Tuition item not found" });
    }

    const lateFeeNum = normalizeMoney(lateFeeAmount);
    item.lateFeeAmount = lateFeeNum;
    item.lateFeeStartDay = LATE_FEE_START_DAY;
    item.months.forEach((month) => {
      if (month.status === "Paid") {
        if (month.lateFeeAmount === undefined || month.lateFeeAmount === null) {
          month.lateFeeAmount = lateFeeNum;
        }
        return;
      }

      month.lateFeeAmount = lateFeeNum;
      month.lateFeeStartDay = LATE_FEE_START_DAY;
      month.lateFeePaidAmount = 0;
    });

    recomputeTotals(fee);
    await fee.save();
    res.json(fee);
  } catch (err) {
    console.error("Error updating late fee", err);
    res.status(500).json({ error: err.message || "Failed to update late fee" });
  }
});

// Add other fee (exam/activity/other)
router.post("/add-item", async (req, res) => {
  try {
    const {
      studentId,
      academicYear,
      label,
      type = "OTHER",
      mode = "ONE_TIME",
      amount,
      applicableMonth,
    } = req.body;

    if (!studentId || !academicYear || !label || !amount) {
      return res.status(400).json({
        error: "studentId, academicYear, label and amount are required",
      });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    let fee = await Fee.findOne({
      student: studentId,
      academicYear,
    });

    const amountNum = Number(amount);
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: "amount must be > 0" });
    }
    const normalizedType = ["TUITION", "EXAM", "ACTIVITY", "OTHER"].includes(String(type).toUpperCase())
      ? String(type).toUpperCase()
      : "OTHER";
    const normalizedApplicableMonth = normalizeMonthName(applicableMonth);
    if (normalizedType === "EXAM" && !normalizedApplicableMonth) {
      return res.status(400).json({ error: "Exam month is required for exam fees" });
    }
    if (applicableMonth && !normalizedApplicableMonth) {
      return res.status(400).json({ error: "Invalid applicable month" });
    }

    const item = {
      label,
      type: normalizedType,
      mode: "ONE_TIME",
      amount: amountNum,
      applicableMonth: normalizedApplicableMonth,
      status: "Pending",
      paidDate: null,
      amountPaid: 0,
      concessionAmount: 0,
      paymentMode: "Cash",
      receiptNo: "",
      paymentNote: "",
      payments: [],
      lateFeeAmount: DEFAULT_LATE_FEE_PER_DAY,
      lateFeeStartDay: LATE_FEE_START_DAY,
      lateFeeDueAmount: 0,
      lateFeePaidAmount: 0,
    };

    if (!fee) {
      fee = new Fee({
        student: student._id,
        studentName: student.name,
        admissionNo: student.admissionNo,
        className: student.className,
        academicYear,
        items: [item],
      });
    } else {
      fee.items.push(item);
    }

    recomputeTotals(fee);
    await fee.save();
    res.status(201).json(fee);
  } catch (err) {
    console.error("Error adding fee item", err);
    res.status(500).json({ error: "Failed to add fee item" });
  }
});

// Toggle tuition month paid/pending (with optional paidDate)
router.patch("/:feeId/toggle-month", async (req, res) => {
  try {
    const { feeId } = req.params;
    const { itemId, monthName, paidDate, paymentMode = "Cash" } = req.body;

    const fee = await Fee.findById(feeId);
    if (!fee) return res.status(404).json({ error: "Fee plan not found" });

    const item = fee.items.id(itemId);
    if (!item || item.mode !== "MONTHLY") {
      return res.status(404).json({ error: "Tuition item not found" });
    }

    const month = item.months.find((m) => m.name === monthName);
    if (!month) {
      return res.status(404).json({ error: "Month not found" });
    }

    if (month.status === "Paid" || month.status === "Partial") {
      clearPayments(month);
    } else {
      const paidOn = paidDate ? new Date(paidDate) : new Date();
      const lateFee = getMonthLateFee(month, item, fee.academicYear, paidOn);
      const payableAmount = getDiscountedAmount(month.amount, month.concessionAmount) + lateFee;
      month.payments = [];
      month.lateFeePaidAmount = lateFee;
      addPayment(month, fee, month.name, {
        amount: payableAmount,
        paidDate: paidOn,
        paymentMode,
        note: "Full month payment",
      });
    }

    recomputeTotals(fee);
    await fee.save();
    res.json(fee);
  } catch (err) {
    console.error("Error toggling month", err);
    res.status(500).json({ error: "Failed to toggle month status" });
  }
});

// Record tuition month payment with support for partial payment, concession and mode.
router.patch("/:feeId/month-payment", async (req, res) => {
  try {
    const { feeId } = req.params;
    const { itemId, monthName, concessionAmount } = req.body;

    const fee = await Fee.findById(feeId);
    if (!fee) return res.status(404).json({ error: "Fee plan not found" });

    const item = fee.items.id(itemId);
    if (!item || item.mode !== "MONTHLY") {
      return res.status(404).json({ error: "Tuition item not found" });
    }

    const month = item.months.find((m) => m.name === monthName);
    if (!month) return res.status(404).json({ error: "Month not found" });

    if (concessionAmount !== undefined) {
      month.concessionAmount = normalizeMoney(concessionAmount);
    }

    addPayment(month, fee, month.name, req.body);
    recomputeTotals(fee);
    await fee.save();
    res.json(fee);
  } catch (err) {
    console.error("Error recording month payment", err);
    res.status(err.status || 500).json({ error: err.message || "Failed to record month payment" });
  }
});

// Toggle one-time item paid/pending (with optional paidDate)
router.patch("/:feeId/toggle-item", async (req, res) => {
  try {
    const { feeId } = req.params;
    const { itemId, paidDate, paymentMode = "Cash" } = req.body;

    const fee = await Fee.findById(feeId);
    if (!fee) return res.status(404).json({ error: "Fee plan not found" });

    const item = fee.items.id(itemId);
    if (!item || item.mode !== "ONE_TIME") {
      return res
        .status(404)
        .json({ error: "One-time fee item not found for toggling" });
    }

    if (item.status === "Paid" || item.status === "Partial") {
      clearPayments(item);
    } else {
      const paidOn = paidDate ? new Date(paidDate) : new Date();
      const lateFee = getOneTimeLateFee(item, fee.academicYear, paidOn);
      const payableAmount = getDiscountedAmount(item.amount, item.concessionAmount) + lateFee;
      item.payments = [];
      item.lateFeePaidAmount = lateFee;
      item.lateFeeDueAmount = lateFee;
      addPayment(item, fee, item.label, {
        amount: payableAmount,
        paidDate: paidOn,
        paymentMode,
        note: "Full fee payment",
      });
    }

    recomputeTotals(fee);
    await fee.save();
    res.json(fee);
  } catch (err) {
    console.error("Error toggling item", err);
    res.status(500).json({ error: "Failed to toggle item status" });
  }
});

// Record one-time fee payment with support for partial payment, concession and mode.
router.patch("/:feeId/item-payment", async (req, res) => {
  try {
    const { feeId } = req.params;
    const { itemId, concessionAmount } = req.body;

    const fee = await Fee.findById(feeId);
    if (!fee) return res.status(404).json({ error: "Fee plan not found" });

    const item = fee.items.id(itemId);
    if (!item || item.mode !== "ONE_TIME") {
      return res.status(404).json({ error: "One-time fee item not found" });
    }

    if (concessionAmount !== undefined) {
      item.concessionAmount = normalizeMoney(concessionAmount);
    }

    addPayment(item, fee, item.label, req.body);
    recomputeTotals(fee);
    await fee.save();
    res.json(fee);
  } catch (err) {
    console.error("Error recording fee item payment", err);
    res.status(err.status || 500).json({ error: err.message || "Failed to record fee item payment" });
  }
});

// Delete entire plan (reset)
router.delete("/:feeId", async (req, res) => {
  try {
    await Fee.findByIdAndDelete(req.params.feeId);
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting fee plan", err);
    res.status(500).json({ error: "Failed to delete fee plan" });
  }
});

module.exports = router;
