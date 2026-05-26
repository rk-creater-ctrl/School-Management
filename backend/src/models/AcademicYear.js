const mongoose = require("mongoose");

const academicYearSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, unique: true },
    startYear: { type: Number, required: true, unique: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["Active", "Upcoming", "Closed"],
      default: "Upcoming",
    },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AcademicYear", academicYearSchema);
