// backend/src/routes/students.js
const express = require("express");
const Student = require("../models/Student");
const auth = require("../middleware/auth");
const { authorize } = require("../middleware/auth");
const {
  assertStudentAccess,
  filterStudentsForUser,
  handleAccessError,
} = require("../utils/accessScope");

const router = express.Router();
const STUDENT_READ_ROLES = ["admin", "teacher", "accountant", "staff", "student", "parent"];
const STUDENT_ALL_ACCESS_ROLES = ["admin", "teacher", "accountant", "staff"];

router.use(auth);

// GET /api/students - list all students
router.get("/", authorize(...STUDENT_READ_ROLES), async (req, res) => {
  try {
    const students = await Student.find().sort({
      className: 1,
      admissionNo: 1,
    });
    res.json(filterStudentsForUser(students, req.user));
  } catch (err) {
    console.error("Error fetching students", err);
    res.status(500).json({ error: "Failed to fetch students" });
  }
});

// GET /api/students/classes/distinct - list distinct className values
router.get("/classes/distinct", authorize(...STUDENT_READ_ROLES), async (req, res) => {
  try {
    const students = filterStudentsForUser(await Student.find(), req.user);
    const classes = [...new Set(students.map((student) => student.className).filter(Boolean))];
    classes.sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" }));
    res.json(classes);
  } catch (err) {
    console.error("Error fetching distinct classes", err);
    res.status(500).json({ error: "Failed to fetch classes" });
  }
});

// GET /api/students/:id - get single student
router.get("/:id", authorize(...STUDENT_READ_ROLES), async (req, res) => {
  try {
    const student = await assertStudentAccess(Student, req.params.id, req.user, STUDENT_ALL_ACCESS_ROLES);
    res.json(student);
  } catch (err) {
    if (err.status) return handleAccessError(res, err);
    console.error("Error fetching student", err);
    res.status(500).json({ error: "Failed to fetch student" });
  }
});

// POST /api/students - create
router.post("/", authorize("superadmin"), async (req, res) => {
  try {
    console.log("POST /api/students body:", req.body);

    const data = { ...req.body };

    // clean up optional classId (ObjectId field) if empty string
    if (data.classId === "") {
      delete data.classId;
    }

    if (!data.admissionNo || !data.name || !data.className) {
      return res
        .status(400)
        .json({ error: "admissionNo, name and className are required" });
    }

    const existing = await Student.findOne({
      admissionNo: data.admissionNo,
    });
    if (existing) {
      return res
        .status(400)
        .json({ error: "Admission number already exists" });
    }

    const student = new Student(data);
    await student.save();
    return res.status(201).json(student);
  } catch (err) {
    console.error("Error creating student", err);
    return res
      .status(500)
      .json({ error: err.message || "Failed to create student" });
  }
});

// PUT /api/students/:id - update
router.put("/:id", authorize("superadmin"), async (req, res) => {
  try {
    console.log("PUT /api/students/:id body:", req.body);

    const data = { ...req.body };

    if (data.classId === "") {
      delete data.classId;
    }

    if (data.admissionNo) {
      const other = await Student.findOne({
        _id: { $ne: req.params.id },
        admissionNo: data.admissionNo,
      });
      if (other) {
        return res
          .status(400)
          .json({ error: "Admission number already exists" });
      }
    }

    const student = await Student.findByIdAndUpdate(req.params.id, data, {
      new: true,
      runValidators: true,
    });

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    return res.json(student);
  } catch (err) {
    console.error("Error updating student", err);
    return res
      .status(500)
      .json({ error: err.message || "Failed to update student" });
  }
});

// DELETE /api/students/:id - delete
router.delete("/:id", authorize("superadmin"), async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) return res.status(404).json({ error: "Student not found" });
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting student", err);
    res.status(500).json({ error: "Failed to delete student" });
  }
});

module.exports = router;
