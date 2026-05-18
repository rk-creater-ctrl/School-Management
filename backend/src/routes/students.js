// backend/src/routes/students.js
const express = require("express");
const Student = require("../models/Student");

const router = express.Router();

// GET /api/students - list all students
router.get("/", async (req, res) => {
  try {
    const students = await Student.find().sort({
      className: 1,
      admissionNo: 1,
    });
    res.json(students);
  } catch (err) {
    console.error("Error fetching students", err);
    res.status(500).json({ error: "Failed to fetch students" });
  }
});

// GET /api/students/:id - get single student
router.get("/:id", async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ error: "Student not found" });
    res.json(student);
  } catch (err) {
    console.error("Error fetching student", err);
    res.status(500).json({ error: "Failed to fetch student" });
  }
});

// POST /api/students - create
router.post("/", async (req, res) => {
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
router.put("/:id", async (req, res) => {
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
router.delete("/:id", async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) return res.status(404).json({ error: "Student not found" });
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting student", err);
    res.status(500).json({ error: "Failed to delete student" });
  }
});

// GET /api/students/classes/distinct - list distinct className values
router.get("/classes/distinct", async (req, res) => {
  try {
    const classes = await Student.distinct("className");
    classes.sort();
    res.json(classes);
  } catch (err) {
    console.error("Error fetching distinct classes", err);
    res.status(500).json({ error: "Failed to fetch classes" });
  }
});

module.exports = router;