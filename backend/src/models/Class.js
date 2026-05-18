const mongoose = require("mongoose");

const classSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true }, // e.g. "6A"
    section: { type: String },
    medium: { type: String }, // e.g. "English", "Hindi"
    classTeacher: { type: String },
    strength: { type: Number },
    note: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Class", classSchema);