const mongoose = require("mongoose");

const assignmentSchema = new mongoose.Schema(
  {
    className: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
  },
  { _id: true }
);

const scheduleEntrySchema = new mongoose.Schema(
  {
    day: { type: String, default: "Daily", trim: true },
    period: { type: String, required: true, trim: true },
    className: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    startTime: { type: String, trim: true },
    endTime: { type: String, trim: true },
    note: { type: String, trim: true },
  },
  { _id: true }
);

const teacherProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    employeeCode: { type: String, trim: true },
    designation: { type: String, trim: true },
    department: { type: String, trim: true },
    qualification: { type: String, trim: true },
    experienceYears: { type: Number, min: 0 },
    alternatePhone: { type: String, trim: true },
    address: { type: String, trim: true },
    about: { type: String, trim: true },
    subjects: [{ type: String, trim: true }],
    assignments: [assignmentSchema],
    schedule: [scheduleEntrySchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("TeacherProfile", teacherProfileSchema);
