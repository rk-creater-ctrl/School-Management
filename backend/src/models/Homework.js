const mongoose = require("mongoose");

const homeworkSchema = new mongoose.Schema(
  {
    className: { type: String, required: true }, // e.g. "10th"
    date: { type: Date, required: true },
    subject: { type: String, required: true },
    homeworkText: { type: String, required: true },
  },
  { timestamps: true }
);

homeworkSchema.index({ className: 1, date: 1 });

module.exports = mongoose.model("Homework", homeworkSchema);