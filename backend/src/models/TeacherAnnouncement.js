const mongoose = require("mongoose");

const teacherAnnouncementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    priority: {
      type: String,
      enum: ["normal", "important", "urgent"],
      default: "normal",
    },
    scope: {
      type: String,
      enum: ["all", "teachers"],
      default: "all",
    },
    teacherIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    expiresAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

teacherAnnouncementSchema.index({ scope: 1, createdAt: -1 });
teacherAnnouncementSchema.index({ teacherIds: 1, createdAt: -1 });

module.exports = mongoose.model("TeacherAnnouncement", teacherAnnouncementSchema);
