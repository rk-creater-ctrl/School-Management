const mongoose = require("mongoose");
const { Schema } = mongoose;

const paymentEntrySchema = new Schema(
  {
    amount: { type: Number, default: 0 },
    paidDate: { type: Date },
    paymentMode: { type: String, default: "Cash" },
    receiptNo: { type: String },
    note: { type: String },
    collectedBy: { type: String },
  },
  { _id: true }
);

// Month entry for tuition
const monthSchema = new Schema(
  {
    name: { type: String, required: true }, // "April", "May", etc.
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["Pending", "Partial", "Paid"],
      default: "Pending",
    },
    paidDate: { type: Date },
    amountPaid: { type: Number, default: 0 },
    concessionAmount: { type: Number, default: 0 },
    paymentMode: { type: String, default: "Cash" },
    receiptNo: { type: String },
    paymentNote: { type: String },
    collectedBy: { type: String },
    payments: {
      type: [paymentEntrySchema],
      default: [],
    },
    lateFeeAmount: { type: Number, default: 10 },
    lateFeeStartDay: { type: Number, default: 10 },
    lateFeeDueAmount: { type: Number, default: 0 },
    lateFeePaidAmount: { type: Number, default: 0 },
  },
  { _id: false }
);

// One fee item (Tuition, Exam Fee, Activity, etc.)
const itemSchema = new Schema(
  {
    label: { type: String, required: true }, // "Tuition", "Exam Fee", etc.
    type: {
      type: String,
      enum: ["TUITION", "EXAM", "ACTIVITY", "OTHER"],
      default: "OTHER",
    },
    mode: {
      type: String,
      enum: ["MONTHLY", "ONE_TIME"],
      required: true,
    },

    // For mode: MONTHLY (tuition)
    monthlyAmount: { type: Number },
    lateFeeAmount: { type: Number, default: 10 },
    lateFeeStartDay: { type: Number, default: 10 },
    months: {
      type: [monthSchema],
      default: [],
    },

    // For mode: ONE_TIME (exam, activity, etc.)
    amount: { type: Number },
    applicableMonth: { type: String },
    status: {
      type: String,
      enum: ["Pending", "Partial", "Paid"],
      default: "Pending",
    },
    paidDate: { type: Date },
    amountPaid: { type: Number, default: 0 },
    concessionAmount: { type: Number, default: 0 },
    paymentMode: { type: String, default: "Cash" },
    receiptNo: { type: String },
    paymentNote: { type: String },
    collectedBy: { type: String },
    payments: {
      type: [paymentEntrySchema],
      default: [],
    },
    lateFeeDueAmount: { type: Number, default: 0 },
    lateFeePaidAmount: { type: Number, default: 0 },
  },
  { _id: true }
);

// Main Fee plan per student per year
const feeSchema = new Schema(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    studentName: { type: String },
    admissionNo: { type: String },
    className: { type: String },

    academicYear: { type: String, required: true }, // e.g. "2024-2025"

    items: {
      type: [itemSchema],
      default: [],
    },

    totalFee: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    dueAmount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Fee", feeSchema);
