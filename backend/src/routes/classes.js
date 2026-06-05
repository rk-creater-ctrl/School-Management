const express = require("express");
const Class = require("../models/Class");
const auth = require("../middleware/auth");
const { authorize } = require("../middleware/auth");

const router = express.Router();
const CLASS_VIEW_ROLES = ["admin", "teacher"];
const CLASS_MANAGE_ROLES = ["teacher"];

router.use(auth);

// GET /api/classes - list all classes
router.get("/", authorize(...CLASS_VIEW_ROLES), async (req, res) => {
  try {
    const classes = await Class.find().sort({ name: 1 });
    res.json(classes);
  } catch (err) {
    console.error("Error fetching classes", err);
    res.status(500).json({ error: "Failed to fetch classes" });
  }
});

// GET /api/classes/:id - single class
router.get("/:id", authorize(...CLASS_VIEW_ROLES), async (req, res) => {
  try {
    const cls = await Class.findById(req.params.id);
    if (!cls) return res.status(404).json({ error: "Class not found" });
    res.json(cls);
  } catch (err) {
    console.error("Error fetching class", err);
    res.status(500).json({ error: "Failed to fetch class" });
  }
});

// POST /api/classes - create class
router.post("/", authorize(...CLASS_MANAGE_ROLES), async (req, res) => {
  try {
    const data = req.body;
    if (!data.name) {
      return res.status(400).json({ error: "Class name is required" });
    }

    const existing = await Class.findOne({ name: data.name });
    if (existing) {
      return res.status(400).json({ error: "Class name already exists" });
    }

    const cls = new Class(data);
    await cls.save();
    res.status(201).json(cls);
  } catch (err) {
    console.error("Error creating class", err);
    res
      .status(500)
      .json({ error: err.message || "Failed to create class" });
  }
});

// PUT /api/classes/:id - update class
router.put("/:id", authorize(...CLASS_MANAGE_ROLES), async (req, res) => {
  try {
    const data = req.body;

    if (data.name) {
      const other = await Class.findOne({
        _id: { $ne: req.params.id },
        name: data.name,
      });
      if (other) {
        return res.status(400).json({ error: "Class name already exists" });
      }
    }

    const cls = await Class.findByIdAndUpdate(req.params.id, data, {
      new: true,
      runValidators: true,
    });

    if (!cls) return res.status(404).json({ error: "Class not found" });

    res.json(cls);
  } catch (err) {
    console.error("Error updating class", err);
    res
      .status(500)
      .json({ error: err.message || "Failed to update class" });
  }
});

// DELETE /api/classes/:id - delete class
router.delete("/:id", authorize("superadmin"), async (req, res) => {
  try {
    const cls = await Class.findByIdAndDelete(req.params.id);
    if (!cls) return res.status(404).json({ error: "Class not found" });
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting class", err);
    res.status(500).json({ error: "Failed to delete class" });
  }
});

module.exports = router;
