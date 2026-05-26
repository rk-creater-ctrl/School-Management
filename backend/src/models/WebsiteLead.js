const mongoose = require("mongoose");

const websiteLeadSchema = new mongoose.Schema(
  {
    source: { type: String, default: "savvy-mother-toddler", trim: true },
    formType: {
      type: String,
      enum: ["contact", "enquiry", "admission"],
      default: "contact",
      index: true,
    },
    referenceNo: { type: String, required: true, unique: true },
    childName: { type: String, trim: true },
    parentName: { type: String, trim: true },
    className: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true },
    subject: { type: String, trim: true },
    message: { type: String, trim: true },
    status: {
      type: String,
      enum: ["new", "contacted", "converted", "closed"],
      default: "new",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    payload: mongoose.Schema.Types.Mixed,
    submittedAt: { type: Date, default: Date.now },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

websiteLeadSchema.index({ createdAt: -1 });
websiteLeadSchema.index({ formType: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("WebsiteLead", websiteLeadSchema);
