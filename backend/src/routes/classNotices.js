const express = require("express");
const ClassNotice = require("../models/ClassNotice");
const Student = require("../models/Student");
const auth = require("../middleware/auth");
const { authorize } = require("../middleware/auth");
const { filterStudentsForUser, getRole } = require("../utils/accessScope");

const router = express.Router();

const GLOBAL_CLASS_NAME = "__GLOBAL__";
const NOTICE_VIEW_ROLES = ["admin", "teacher", "staff", "student", "parent"];

function isFamilyRole(user) {
  return ["parent", "student"].includes(getRole(user));
}

async function getVisibleClassNames(user) {
  if (!isFamilyRole(user)) return null;
  const students = filterStudentsForUser(await Student.find(), user);
  return new Set(students.map((student) => student.className).filter(Boolean));
}

// GET /api/class-notices?className=10th&date=YYYY-MM-DD
router.get("/", auth, authorize(...NOTICE_VIEW_ROLES), async (req, res) => {
  try {
    const { className, date } = req.query;
    const visibleClassNames = await getVisibleClassNames(req.user);

    let filter = {};
    if (visibleClassNames) {
      const allowedClasses = [GLOBAL_CLASS_NAME, ...visibleClassNames];
      filter = className && visibleClassNames.has(className)
        ? { className: { $in: [className, GLOBAL_CLASS_NAME] } }
        : { className: { $in: allowedClasses } };
    } else if (className) {
      filter = { className: { $in: [className, GLOBAL_CLASS_NAME] } };
    }

    if (date) {
      const day = new Date(date);
      day.setHours(0, 0, 0, 0);

      filter.startDate = { $lte: day };
      filter.expiryDate = { $gte: day };
    }

    const notices = await ClassNotice.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.json(notices);
  } catch (err) {
    console.error("Error fetching class notices", err);
    res.status(500).json({ error: "Failed to fetch class notices" });
  }
});

// POST /api/class-notices
router.post("/", auth, authorize("superadmin", "admin", "teacher"), async (req, res) => {
  try {
    const data = { ...req.body };

    if (
      !data.className ||
      !data.title ||
      !data.message ||
      !data.startDate ||
      !data.expiryDate
    ) {
      return res.status(400).json({
        error: "className, title, message, startDate, expiryDate are required",
      });
    }

    if (req.user.role === "teacher" && data.className === GLOBAL_CLASS_NAME) {
      return res.status(403).json({ error: "Teachers can publish class notices only" });
    }

    data.startDate = new Date(data.startDate);
    data.expiryDate = new Date(data.expiryDate);

    const notice = new ClassNotice(data);
    await notice.save();
    res.status(201).json(notice);
  } catch (err) {
    console.error("Error creating class notice", err);
    res
      .status(500)
      .json({ error: err.message || "Failed to create notice" });
  }
});

// PUT /api/class-notices/:id
router.put("/:id", auth, authorize("superadmin", "admin"), async (req, res) => {
  try {
    const data = { ...req.body };

    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.expiryDate) data.expiryDate = new Date(data.expiryDate);

    const notice = await ClassNotice.findByIdAndUpdate(req.params.id, data,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!notice) {
      return res.status(404).json({ error: "Notice not found" });
    }

    res.json(notice);
  } catch (err) {
    console.error("Error updating class notice", err);
    res
      .status(500)
      .json({ error: err.message || "Failed to update notice" });
  }
});

// DELETE /api/class-notices/:id
router.delete("/:id", auth, authorize("superadmin", "admin"), async (req, res) => {
  try {
    const notice = await ClassNotice.findByIdAndDelete(req.params.id);
    if (!notice) {
      return res.status(404).json({ error: "Notice not found" });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting class notice", err);
    res.status(500).json({ error: "Failed to delete notice" });
  }
});

module.exports = router;
