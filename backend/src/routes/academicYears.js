const express = require("express");
const AcademicYear = require("../models/AcademicYear");
const Student = require("../models/Student");
const auth = require("../middleware/auth");

const router = express.Router();

router.use(auth);

function requireSuperadmin(req, res) {
  if (req.user?.role === "superadmin") return true;
  res.status(403).json({ error: "Only superadmin can manage academic years" });
  return false;
}

function getCurrentAcademicYearStart(date = new Date()) {
  return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
}

function getAcademicYearStart(value) {
  const firstYear = String(value || "").match(/\d{4}/)?.[0];
  const parsed = Number(firstYear);
  return Number.isFinite(parsed) ? parsed : getCurrentAcademicYearStart();
}

function buildYearPayload(body = {}) {
  const startYear = getAcademicYearStart(body.label || body.startYear || body.academicYear);
  return {
    label: `${startYear}-${startYear + 1}`,
    startYear,
    startDate: new Date(startYear, 3, 1),
    endDate: new Date(startYear + 1, 2, 31),
    status: ["Active", "Upcoming", "Closed"].includes(body.status) ? body.status : "Upcoming",
    notes: String(body.notes || "").trim(),
  };
}

async function ensureDefaultYears() {
  const count = await AcademicYear.countDocuments();
  if (count) return;

  const currentStart = getCurrentAcademicYearStart();
  await AcademicYear.insertMany(
    [-1, 0, 1].map((offset) => ({
      ...buildYearPayload({ startYear: currentStart + offset }),
      status: offset === 0 ? "Active" : offset < 0 ? "Closed" : "Upcoming",
    })),
    { ordered: false }
  ).catch(() => {});
}

router.get("/", async (req, res) => {
  try {
    await ensureDefaultYears();
    const years = await AcademicYear.find().sort({ startYear: -1 }).lean();
    res.json(years);
  } catch (err) {
    console.error("Error loading academic years", err);
    res.status(500).json({ error: "Failed to load academic years" });
  }
});

router.post("/", async (req, res) => {
  try {
    if (!requireSuperadmin(req, res)) return;
    const payload = buildYearPayload(req.body);
    if (payload.status === "Active") {
      await AcademicYear.updateMany({}, { $set: { status: "Closed" } });
    }
    const year = await AcademicYear.findOneAndUpdate(
      { startYear: payload.startYear },
      payload,
      { upsert: true, new: true, runValidators: true }
    );
    res.status(201).json(year);
  } catch (err) {
    console.error("Error saving academic year", err);
    res.status(500).json({ error: err.message || "Failed to save academic year" });
  }
});

router.patch("/:id/activate", async (req, res) => {
  try {
    if (!requireSuperadmin(req, res)) return;
    const year = await AcademicYear.findById(req.params.id);
    if (!year) return res.status(404).json({ error: "Academic year not found" });

    await AcademicYear.updateMany({ _id: { $ne: year._id } }, { $set: { status: "Closed" } });
    year.status = "Active";
    await year.save();
    res.json(year);
  } catch (err) {
    console.error("Error activating academic year", err);
    res.status(500).json({ error: "Failed to activate academic year" });
  }
});

router.patch("/:id/close", async (req, res) => {
  try {
    if (!requireSuperadmin(req, res)) return;
    const year = await AcademicYear.findByIdAndUpdate(
      req.params.id,
      { status: "Closed" },
      { new: true }
    );
    if (!year) return res.status(404).json({ error: "Academic year not found" });
    res.json(year);
  } catch (err) {
    console.error("Error closing academic year", err);
    res.status(500).json({ error: "Failed to close academic year" });
  }
});

router.post("/promote", async (req, res) => {
  try {
    if (!requireSuperadmin(req, res)) return;
    const fromClass = String(req.body.fromClass || "").trim();
    const toClass = String(req.body.toClass || "").trim();
    const academicYear = String(req.body.academicYear || "").trim();
    const studentIds = Array.isArray(req.body.studentIds) ? req.body.studentIds.filter(Boolean) : [];

    if (!fromClass || !toClass || !academicYear) {
      return res.status(400).json({ error: "fromClass, toClass and academicYear are required" });
    }

    const query = studentIds.length
      ? { _id: { $in: studentIds }, className: fromClass }
      : { className: fromClass, status: { $ne: "inactive" } };

    const students = await Student.find(query);
    await Promise.all(
      students.map(async (student) => {
        student.academicHistory = [
          ...(student.academicHistory || []),
          {
            academicYear,
            className: student.className,
            section: student.section,
            result: "Promoted",
          },
        ];
        student.className = toClass;
        student.status = "active";
        await student.save();
      })
    );

    res.json({ promoted: students.length, fromClass, toClass, academicYear });
  } catch (err) {
    console.error("Error promoting students", err);
    res.status(500).json({ error: err.message || "Failed to promote students" });
  }
});

module.exports = router;
