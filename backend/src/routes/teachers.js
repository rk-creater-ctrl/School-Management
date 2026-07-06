const express = require("express");
const TeacherProfile = require("../models/TeacherProfile");
const TeacherClassRecord = require("../models/TeacherClassRecord");
const TeacherAnnouncement = require("../models/TeacherAnnouncement");
const Homework = require("../models/Homework");
const Student = require("../models/Student");
const auth = require("../middleware/auth");
const { authorize } = require("../middleware/auth");

const router = express.Router();

function normalizeDate(value) {
  const dt = value ? new Date(value) : new Date();
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function cleanString(value) {
  return String(value || "").trim();
}

function cleanStringArray(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map(cleanString).filter(Boolean))];
}

function cleanAssignments(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((item) => ({
      className: cleanString(item.className),
      subject: cleanString(item.subject),
    }))
    .filter((item) => item.className && item.subject);
}

function cleanSchedule(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((item) => ({
      day: cleanString(item.day) || "Daily",
      period: cleanString(item.period),
      className: cleanString(item.className),
      subject: cleanString(item.subject),
      startTime: cleanString(item.startTime),
      endTime: cleanString(item.endTime),
      note: cleanString(item.note),
    }))
    .filter((item) => item.period && item.className && item.subject);
}

function cleanObjectIds(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map(String))]
    .map(cleanString)
    .filter((id) => /^[a-z0-9-]{8,}$/i.test(id));
}

function cleanCopyNaRecords(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  return values
    .map((item) => ({
      studentName: cleanString(item.studentName || item.name),
      className: cleanString(item.className),
      rollNo: cleanString(item.rollNo),
      note: cleanString(item.note),
    }))
    .filter((item) => item.studentName || item.className || item.rollNo)
    .filter((item) => {
      const key = `${item.studentName.toLowerCase()}::${item.className.toLowerCase()}::${item.rollNo.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function hasOwn(source, key) {
  return Object.prototype.hasOwnProperty.call(source, key);
}

function cleanEnum(value, allowed, fallback) {
  const normalized = cleanString(value);
  return allowed.includes(normalized) ? normalized : fallback;
}

function applyOptionalString(updates, body, key) {
  if (hasOwn(body, key)) updates[key] = cleanString(body[key]);
}

function applyOptionalObjectIds(updates, body, key) {
  if (hasOwn(body, key)) updates[key] = cleanObjectIds(body[key]);
}

function applyOptionalCopyNaRecords(updates, body) {
  if (hasOwn(body, "copyNaStudentRecords")) {
    updates.copyNaStudentRecords = cleanCopyNaRecords(body.copyNaStudentRecords);
  }
}

function teacherCanUseClassSubject(profile, className, subject) {
  const assignments = [
    ...(profile.assignments || []),
    ...(profile.schedule || []),
  ];
  if (!assignments.length) return true;
  return assignments.some(
    (item) =>
      cleanString(item.className).toLowerCase() ===
        cleanString(className).toLowerCase() &&
      cleanString(item.subject).toLowerCase() ===
        cleanString(subject).toLowerCase()
  );
}

async function getOrCreateProfile(user) {
  let profile = await TeacherProfile.findOne({ userId: user._id }).lean();
  if (profile) return profile;

  const created = await TeacherProfile.create({
    userId: user._id,
    alternatePhone: user.phone || "",
  });
  return created.toObject();
}

function profileResponse(profile, user) {
  return {
    ...profile,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    },
  };
}

router.get("/me", auth, authorize("teachers.view"), async (req, res) => {
  try {
    const profile = await getOrCreateProfile(req.user);
    res.json(profileResponse(profile, req.user));
  } catch (err) {
    console.error("Error loading teacher profile", err);
    res.status(500).json({ error: "Failed to load teacher profile" });
  }
});

router.put("/me", auth, authorize("teachers.edit", "teachers.manage"), async (req, res) => {
  try {
    const payload = {
      employeeCode: cleanString(req.body.employeeCode),
      designation: cleanString(req.body.designation),
      department: cleanString(req.body.department),
      qualification: cleanString(req.body.qualification),
      experienceYears:
        req.body.experienceYears === "" || req.body.experienceYears === null
          ? undefined
          : Number(req.body.experienceYears),
      alternatePhone: cleanString(req.body.alternatePhone),
      address: cleanString(req.body.address),
      about: cleanString(req.body.about),
      subjects: cleanStringArray(req.body.subjects),
      assignments: cleanAssignments(req.body.assignments),
      schedule: cleanSchedule(req.body.schedule),
    };

    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined || Number.isNaN(payload[key])) {
        delete payload[key];
      }
    });

    const profile = await TeacherProfile.findOneAndUpdate(
      { userId: req.user._id },
      { $set: payload },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();

    res.json(profileResponse(profile, req.user));
  } catch (err) {
    console.error("Error saving teacher profile", err);
    res
      .status(500)
      .json({ error: err.message || "Failed to save teacher profile" });
  }
});

router.get("/students", auth, authorize("teachers.view"), async (req, res) => {
  try {
    const className = cleanString(req.query.className);
    if (!className) {
      return res.status(400).json({ error: "className is required" });
    }

    const students = await Student.find({ className })
      .sort({ rollNo: 1, admissionNo: 1, name: 1 })
      .select("admissionNo name className rollNo fatherName")
      .lean();

    res.json(students);
  } catch (err) {
    console.error("Error loading class students", err);
    res.status(500).json({ error: "Failed to load class students" });
  }
});

router.get("/work-records", auth, authorize("teachers.view"), async (req, res) => {
  try {
    const filter = { teacherId: req.user._id };
    if (req.query.className) filter.className = cleanString(req.query.className);
    if (req.query.subject) filter.subject = cleanString(req.query.subject);
    if (req.query.date) filter.date = normalizeDate(req.query.date);
    if (req.query.dateFrom || req.query.dateTo) {
      filter.date = {};
      if (req.query.dateFrom) filter.date.$gte = normalizeDate(req.query.dateFrom);
      if (req.query.dateTo) filter.date.$lte = normalizeDate(req.query.dateTo);
    }

    const records = await TeacherClassRecord.find(filter)
      .sort({ date: -1, className: 1, subject: 1 })
      .lean();
    res.json(records);
  } catch (err) {
    console.error("Error loading teacher work records", err);
    res.status(500).json({ error: "Failed to load teacher work records" });
  }
});

router.put("/work-records", auth, authorize("teachers.edit", "teachers.manage"), async (req, res) => {
  try {
    const className = cleanString(req.body.className);
    const subject = cleanString(req.body.subject);
    const date = normalizeDate(req.body.date);

    if (!className || !subject) {
      return res
        .status(400)
        .json({ error: "className and subject are required" });
    }

    const profile = await getOrCreateProfile(req.user);
    const recordScope = cleanString(req.body.recordScope);
    const isCopyRecord = recordScope === "copy";
    if (!isCopyRecord && !teacherCanUseClassSubject(profile, className, subject)) {
      return res.status(403).json({
        error: "This class and subject are not assigned to your teacher profile",
      });
    }

    const updates = {
      teacherId: req.user._id,
      className,
      subject,
      date,
    };

    applyOptionalString(updates, req.body, "period");
    applyOptionalString(updates, req.body, "lessonPlan");
    applyOptionalString(updates, req.body, "homeworkText");
    applyOptionalString(updates, req.body, "chapter");
    applyOptionalString(updates, req.body, "taughtToday");
    applyOptionalString(updates, req.body, "syllabusStatus");
    applyOptionalString(updates, req.body, "notes");
    applyOptionalObjectIds(updates, req.body, "copySubmittedStudentIds");
    applyOptionalObjectIds(updates, req.body, "examCopyTakenStudentIds");
    applyOptionalCopyNaRecords(updates, req.body);

    if (hasOwn(req.body, "periodStatus")) {
      updates.periodStatus = cleanEnum(
        req.body.periodStatus,
        ["pending", "completed", "skipped"],
        "pending"
      );
    }

    if (hasOwn(req.body, "reviewStatus")) {
      const reviewStatus = cleanEnum(
        req.body.reviewStatus,
        ["draft", "submitted"],
        "draft"
      );
      updates.reviewStatus = reviewStatus;
      if (reviewStatus === "submitted") updates.reviewSubmittedAt = new Date();
    }

    const record = await TeacherClassRecord.findOneAndUpdate(
      { teacherId: req.user._id, className, subject, date },
      { $set: updates },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();

    if (updates.homeworkText) {
      await Homework.findOneAndUpdate(
        { teacherId: req.user._id, className, subject, date },
        {
          $set: {
            className,
            subject,
            date,
            homeworkText: updates.homeworkText,
            teacherId: req.user._id,
            teacherName: req.user.name,
          },
        },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
      );
    }

    res.json(record);
  } catch (err) {
    console.error("Error saving teacher work record", err);
    res
      .status(500)
      .json({ error: err.message || "Failed to save teacher work record" });
  }
});

router.patch("/work-records/:id/review", auth, authorize("teachers.approve", "teachers.manage"), async (req, res) => {
  try {
    const reviewStatus = cleanEnum(
      req.body.reviewStatus,
      ["reviewed", "approved", "needs_correction"],
      ""
    );
    if (!reviewStatus) {
      return res.status(400).json({ error: "Valid reviewStatus is required" });
    }

    const record = await TeacherClassRecord.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          reviewStatus,
          reviewComment: cleanString(req.body.reviewComment),
          reviewedAt: new Date(),
          reviewedBy: req.user._id,
        },
      },
      { new: true, runValidators: true }
    ).lean();

    if (!record) {
      return res.status(404).json({ error: "Teacher record not found" });
    }

    res.json(record);
  } catch (err) {
    console.error("Error reviewing teacher work record", err);
    res.status(500).json({ error: err.message || "Failed to review record" });
  }
});

router.get("/announcements", auth, authorize("teachers.view"), async (req, res) => {
  try {
    const now = new Date();
    const announcements = await TeacherAnnouncement.find({
      $and: [
        {
          $or: [
            { scope: "all" },
            { scope: "teachers" },
            { teacherIds: req.user._id },
          ],
        },
        {
          $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: null },
            { expiresAt: { $gte: now } },
          ],
        },
      ],
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json(
      announcements.map((item) => ({
        ...item,
        read: (item.readBy || []).some((id) => String(id) === String(req.user._id)),
      }))
    );
  } catch (err) {
    console.error("Error loading teacher announcements", err);
    res.status(500).json({ error: "Failed to load teacher announcements" });
  }
});

router.post("/announcements", auth, authorize("teachers.manage"), async (req, res) => {
  try {
    if (!req.body.title || !req.body.message) {
      return res.status(400).json({ error: "title and message are required" });
    }

    const announcement = await TeacherAnnouncement.create({
      title: cleanString(req.body.title),
      message: cleanString(req.body.message),
      priority: cleanEnum(req.body.priority, ["normal", "important", "urgent"], "normal"),
      scope: cleanEnum(req.body.scope, ["all", "teachers"], "all"),
      teacherIds: cleanObjectIds(req.body.teacherIds),
      expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined,
      createdBy: req.user._id,
    });

    res.status(201).json(announcement);
  } catch (err) {
    console.error("Error creating teacher announcement", err);
    res.status(500).json({ error: err.message || "Failed to create announcement" });
  }
});

router.patch("/announcements/:id/read", auth, authorize("teachers.view"), async (req, res) => {
  try {
    const announcement = await TeacherAnnouncement.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { readBy: req.user._id } },
      { new: true }
    ).lean();

    if (!announcement) {
      return res.status(404).json({ error: "Announcement not found" });
    }

    res.json({ ...announcement, read: true });
  } catch (err) {
    console.error("Error marking announcement read", err);
    res.status(500).json({ error: "Failed to mark announcement read" });
  }
});

module.exports = router;
