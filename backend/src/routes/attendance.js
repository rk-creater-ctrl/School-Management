// backend/src/routes/attendance.js
const express = require("express");
const Attendance = require("../models/Attendance");
const Student = require("../models/Student");
const auth = require("../middleware/auth");
const { authorize } = require("../middleware/auth");
const { assertStudentAccess, handleAccessError } = require("../utils/accessScope");
const router = express.Router();
const ATTENDANCE_VIEW_ROLES = ["attendance.view"];
const ATTENDANCE_MANAGE_ROLES = ["attendance.edit", "attendance.manage"];

router.use(auth);

function normalizeDate(d) {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

// Get full month register for one student
router.get("/student/:studentId/month", authorize(...ATTENDANCE_VIEW_ROLES), async (req, res) => {
  try {
    const { studentId } = req.params;
    const { month, year } = req.query; // 1-12, YYYY

    const student = await assertStudentAccess(Student, studentId, req.user, ["admin", "teacher"]);

    const now = new Date();
    const m = month ? Number(month) : now.getMonth() + 1;
    const y = year ? Number(year) : now.getFullYear();

    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const records = await Attendance.find({
      student: studentId,
      date: { $gte: start, $lte: end },
    })
      .sort({ date: 1 })
      .lean();

    const daysInMonth = end.getDate();
    const map = {};
    for (const r of records) {
      const d = new Date(r.date).getDate();
      map[d] = r;
    }

    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const rec = map[d];
      days.push({
        day: d,
        date: new Date(y, m - 1, d),
        status: rec?.status || "Absent",
        note: rec?.note || "",
      });
    }

    let presentEquivalent = 0;
    let totalCount = 0;

    for (const day of days) {
      if (day.status === "Holiday") continue;
      totalCount += 1;
      if (day.status === "Present") presentEquivalent += 1;
      else if (day.status === "HalfDay") presentEquivalent += 0.5;
    }

    const percentage =
      totalCount === 0 ? 0 : (presentEquivalent / totalCount) * 100;

    res.json({
      student: {
        _id: student._id,
        name: student.name,
        admissionNo: student.admissionNo,
        className: student.className,
      },
      month: m,
      year: y,
      days,
      percentage,
    });
  } catch (err) {
    if (err.status) return handleAccessError(res, err);
    console.error("Error fetching student month attendance", err);
    res.status(500).json({ error: "Failed to fetch attendance month" });
  }
});

// Get full academic year (April–March) attendance for one student
router.get("/student/:studentId/year", authorize(...ATTENDANCE_VIEW_ROLES), async (req, res) => {
  try {
    const { studentId } = req.params;
    const { year } = req.query; // academic year starting year, e.g. 2025 for 2025-04-01 to 2026-03-31

    const student = await assertStudentAccess(Student, studentId, req.user, ["admin", "teacher"]);

    const now = new Date();
    let startYear;
    if (year) {
      startYear = Number(year);
    } else {
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1; // 1-12
      startYear = currentMonth >= 4 ? currentYear : currentYear - 1;
    }

    const start = new Date(startYear, 3, 1); // April 1, startYear
    const end = new Date(startYear + 1, 2, 31); // March 31, next year
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const records = await Attendance.find({
      student: studentId,
      date: { $gte: start, $lte: end },
    })
      .sort({ date: 1 })
      .lean();

    // Attendance % over year: Present=1, HalfDay=0.5, Holiday ignored
    let presentEquivalent = 0;
    let totalCount = 0;

    for (const r of records) {
      if (r.status === "Holiday") continue;
      totalCount += 1;
      if (r.status === "Present") presentEquivalent += 1;
      else if (r.status === "HalfDay") presentEquivalent += 0.5;
    }

    const percentage =
      totalCount === 0 ? 0 : (presentEquivalent / totalCount) * 100;

    res.json({
      student: {
        _id: student._id,
        name: student.name,
        admissionNo: student.admissionNo,
        className: student.className,
      },
      from: start,
      to: end,
      startYear,
      endYear: startYear + 1,
      percentage,
    });
  } catch (err) {
    if (err.status) return handleAccessError(res, err);
    console.error("Error fetching yearly attendance", err);
    res.status(500).json({ error: "Failed to fetch yearly attendance" });
  }
});

// Mark attendance for a given date
router.post("/mark", authorize(...ATTENDANCE_MANAGE_ROLES), async (req, res) => {
  try {
    const { date, entries } = req.body;
    // entries: [{ studentId, status, note? }, ...]

    if (!date || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: "date and entries are required" });
    }

    const day = normalizeDate(date);

    const bulkOps = entries
      .filter((e) => e.studentId && e.status)
      .map((e) => ({
        updateOne: {
          filter: {
            student: e.studentId,
            date: day,
          },
          update: {
            $set: {
              student: e.studentId,
              date: day,
              status: e.status,
              note: e.note || "",
            },
          },
          upsert: true,
        },
      }));

    if (bulkOps.length === 0) {
      return res.status(400).json({ error: "No valid entries" });
    }

    await Attendance.bulkWrite(bulkOps);

    res.json({ success: true });
  } catch (err) {
    console.error("Error marking attendance", err);
    res.status(500).json({ error: "Failed to mark attendance" });
  }
});

module.exports = router;
