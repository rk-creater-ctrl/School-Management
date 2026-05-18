const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const auth = require('../middleware/auth');  // Your existing JWT

// GET all students (admin only)
router.get('/', auth(['admin']), async (req, res) => {
  try {
    const students = await Student.find().populate('userId', 'email phone');
    res.json(students);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create student profile (admin/teacher)
router.post('/', auth(['admin', 'teacher']), async (req, res) => {
  try {
    const student = new Student(req.body);
    await student.save();
    res.status(201).json(student);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// PUT update student (admin)
router.put('/:id', auth(['admin']), async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(student);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;