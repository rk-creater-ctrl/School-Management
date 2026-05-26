const mongoose = require("mongoose");
const { Schema } = mongoose;

const transportMonthSchema = new Schema(
  {
    name: { type: String, required: true },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["Pending", "Paid"],
      default: "Pending",
    },
    paidDate: { type: Date },
    lateFeePerDay: { type: Number, default: 10 },
    lateFeeStartDay: { type: Number, default: 10 },
    lateFeeDueAmount: { type: Number, default: 0 },
    lateFeePaidAmount: { type: Number, default: 0 },
  },
  { _id: false }
);

const transportFeeSchema = new Schema(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    vehicle: {
      type: Schema.Types.ObjectId,
      ref: "TransportVehicle",
      required: true,
    },
    studentName: { type: String, default: "" },
    admissionNo: { type: String, default: "" },
    className: { type: String, default: "" },
    vehicleNo: { type: String, default: "" },
    routeName: { type: String, default: "" },
    pickupPoint: { type: String, default: "" },
    academicYear: { type: String, required: true },
    startDate: { type: Date },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    monthlyAmount: { type: Number, default: 0 },
    lateFeePerDay: { type: Number, default: 10 },
    lateFeeStartDay: { type: Number, default: 10 },
    months: {
      type: [transportMonthSchema],
      default: [],
    },
    totalFee: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    dueAmount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

transportFeeSchema.index(
  { student: 1, vehicle: 1, academicYear: 1 },
  { unique: true }
);
transportFeeSchema.index({ vehicle: 1, academicYear: 1 });

module.exports = mongoose.model("TransportFee", transportFeeSchema);
