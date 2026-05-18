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

// Recalculate totals based on items and months
function recomputeTotals(fee) {
  let total = 0;
  let paid = 0;

  for (const item of fee.items) {
    if (item.mode === "MONTHLY") {
      const months = item.months || [];
      for (const m of months) {
        total += m.amount || 0;
        if (m.status === "Paid") {
          paid += m.amount || 0;
        }
      }
    } else if (item.mode === "ONE_TIME") {
      total += item.amount || 0;
      if (item.status === "Paid") {
        paid += item.amount || 0;
      }
    }
  }

  fee.totalFee = total;
  fee.paidAmount = paid;
  fee.dueAmount = total - paid;
}

// Get all fee plans (admin list)
router.get("/", async (req, res) => {
  try {
    const fees = await Fee.find().sort({ createdAt: -1 });
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
    res.json(fees);
  } catch (err) {
    console.error("Error fetching student fees", err);
    res.status(500).json({ error: "Failed to fetch student fees" });
  }
});

// Create tuition plan (month-wise) for a student+year
router.post("/create-tuition", async (req, res) => {
  try {
    const { studentId, academicYear, monthlyAmount } = req.body;

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

    const months = DEFAULT_MONTHS.map((name) => ({
      name,
      amount: amountNum,
      status: "Pending",
      paidDate: null,
    }));

    const tuitionItem = {
      label: "Tuition Fee",
      type: "TUITION",
      mode: "MONTHLY",
      monthlyAmount: amountNum,
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

    const item = {
      label,
      type,
      mode: "ONE_TIME",
      amount: amountNum,
      status: "Pending",
      paidDate: null,
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
    const { itemId, monthName, paidDate } = req.body;

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

    if (month.status === "Paid") {
      month.status = "Pending";
      month.paidDate = null;
    } else {
      month.status = "Paid";
      month.paidDate = paidDate ? new Date(paidDate) : new Date();
    }

    recomputeTotals(fee);
    await fee.save();
    res.json(fee);
  } catch (err) {
    console.error("Error toggling month", err);
    res.status(500).json({ error: "Failed to toggle month status" });
  }
});

// Toggle one-time item paid/pending (with optional paidDate)
router.patch("/:feeId/toggle-item", async (req, res) => {
  try {
    const { feeId } = req.params;
    const { itemId, paidDate } = req.body;

    const fee = await Fee.findById(feeId);
    if (!fee) return res.status(404).json({ error: "Fee plan not found" });

    const item = fee.items.id(itemId);
    if (!item || item.mode !== "ONE_TIME") {
      return res
        .status(404)
        .json({ error: "One-time fee item not found for toggling" });
    }

    if (item.status === "Paid") {
      item.status = "Pending";
      item.paidDate = null;
    } else {
      item.status = "Paid";
      item.paidDate = paidDate ? new Date(paidDate) : new Date();
    }

    recomputeTotals(fee);
    await fee.save();
    res.json(fee);
  } catch (err) {
    console.error("Error toggling item", err);
    res.status(500).json({ error: "Failed to toggle item status" });
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