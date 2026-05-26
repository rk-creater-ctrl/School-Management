const mongoose = require("mongoose");

const homeworkSchema = new mongoose.Schema(
  {
    className: { type: String, required: true }, // e.g. "10th"
    date: { type: Date, required: true },
    subject: { type: String, required: true },
    homeworkText: { type: String, required: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    teacherName: { type: String },
  },
  { timestamps: true }
);

homeworkSchema.index({ className: 1, date: 1 });
homeworkSchema.index({ teacherId: 1, className: 1, subject: 1, date: 1 });

module.exports = mongoose.model("Homework", homeworkSchema);
