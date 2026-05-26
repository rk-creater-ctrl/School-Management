const mongoose = require("mongoose");

const teacherClassRecordSchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    className: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    period: { type: String, trim: true },
    periodStatus: {
      type: String,
      enum: ["pending", "completed", "skipped"],
      default: "pending",
    },
    lessonPlan: { type: String, trim: true },
    reviewStatus: {
      type: String,
      enum: ["draft", "submitted", "reviewed", "approved", "needs_correction"],
      default: "draft",
    },
    reviewComment: { type: String, trim: true },
    reviewSubmittedAt: { type: Date },
    reviewedAt: { type: Date },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    homeworkText: { type: String, trim: true },
    chapter: { type: String, trim: true },
    taughtToday: { type: String, trim: true },
    syllabusStatus: { type: String, trim: true },
    copySubmittedStudentIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
    ],
    examCopyTakenStudentIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
    ],
    copyNaStudentRecords: [
      {
        studentName: { type: String, trim: true },
        className: { type: String, trim: true },
        rollNo: { type: String, trim: true },
        note: { type: String, trim: true },
      },
    ],
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

teacherClassRecordSchema.index(
  { teacherId: 1, className: 1, subject: 1, date: 1 },
  { unique: true }
);

module.exports = mongoose.model("TeacherClassRecord", teacherClassRecordSchema);
