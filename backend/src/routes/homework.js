const express = require("express");
const Homework = require("../models/Homework");
const auth = require("../middleware/auth");
const { authorize } = require("../middleware/auth");

const router = express.Router();

function normalizeDate(d) {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

// GET /api/homework?className=10th&date=YYYY-MM-DD
router.get("/", async (req, res) => {
  try {
    const { className, date } = req.query;
    if (!className) {
      return res.status(400).json({ error: "className is required" });
    }

    const filter = { className };
    if (date) {
      const day = normalizeDate(date);
      const nextDay = new Date(day);
      nextDay.setDate(day.getDate() + 1);
      filter.date = { $gte: day, $lt: nextDay };
    }

    const items = await Homework.find(filter)
      .sort({ date: -1, subject: 1 })
      .lean();

    res.json(items);
  } catch (err) {
    console.error("Error fetching homework", err);
    res.status(500).json({ error: "Failed to fetch homework" });
  }
});

// POST /api/homework
router.post("/", auth, authorize("superadmin"), async (req, res) => {
  try {
    const data = { ...req.body };

    if (!data.className || !data.date || !data.subject || !data.homeworkText) {
      return res.status(400).json({
        error: "className, date, subject, homeworkText are required",
      });
    }

    data.date = normalizeDate(data.date);

    const hw = new Homework(data);
    await hw.save();
    res.status(201).json(hw);
  } catch (err) {
    console.error("Error creating homework", err);
    res.status(500).json({ error: err.message || "Failed to create homework" });
  }
});

// PUT /api/homework/:id
router.put("/:id", auth, authorize("superadmin"), async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.date) {
      data.date = normalizeDate(data.date);
    }

    const existing = await Homework.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Homework not found" });
    }

    const hw = await Homework.findByIdAndUpdate(req.params.id, data, {
      new: true,
      runValidators: true,
    });

    res.json(hw);
  } catch (err) {
    console.error("Error updating homework", err);
    res.status(500).json({ error: err.message || "Failed to update homework" });
  }
});

// DELETE /api/homework/:id
router.delete("/:id", auth, authorize("superadmin"), async (req, res) => {
  try {
    const hw = await Homework.findById(req.params.id);
    if (!hw) {
      return res.status(404).json({ error: "Homework not found" });
    }
    await hw.deleteOne();
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting homework", err);
    res.status(500).json({ error: "Failed to delete homework" });
  }
});

module.exports = router;
