const mongoose = require("mongoose");

const classNoticeSchema = new mongoose.Schema(
  {
    className: { type: String, required: true }, // e.g. "10th"
    title: { type: String, required: true },
    message: { type: String, required: true },
    startDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
  },
  { timestamps: true }
);

classNoticeSchema.index({ className: 1, startDate: 1, expiryDate: 1 });

module.exports = mongoose.model("ClassNotice", classNoticeSchema);