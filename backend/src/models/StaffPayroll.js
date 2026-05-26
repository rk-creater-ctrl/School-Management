const mongoose = require("mongoose");

const salaryPaymentSchema = new mongoose.Schema(
  {
    monthKey: { type: String, required: true },
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 0, max: 11 },
    daysInMonth: { type: Number, default: 0 },
    sundayCount: { type: Number, default: 0 },
    workingDays: { type: Number, default: 0 },
    monthlySalary: { type: Number, default: 0 },
    dailyRate: { type: Number, default: 0 },
    salaryWithoutSunday: { type: Number, default: 0 },
    sundaySalary: { type: Number, default: 0 },
    includeSundaySalary: { type: Boolean, default: true },
    deductions: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    payableAmount: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["Pending", "Partial", "Paid"],
      default: "Pending",
    },
    paidDate: Date,
    note: { type: String, trim: true },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const staffPayrollSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    employeeCode: { type: String, trim: true },
    payrollCategory: {
      type: String,
      enum: ["Skilled", "Half-skilled", "Unskilled"],
      default: "Skilled",
    },
    department: { type: String, trim: true },
    designation: { type: String, trim: true },
    monthlySalary: { type: Number, default: 0 },
    includeSundaySalary: { type: Boolean, default: true },
    bankName: { type: String, trim: true },
    accountNo: { type: String, trim: true },
    ifscCode: { type: String, trim: true },
    payments: [salaryPaymentSchema],
  },
  { timestamps: true }
);

staffPayrollSchema.index({ userId: 1 }, { unique: true });
staffPayrollSchema.index({ "payments.monthKey": 1 });

module.exports = mongoose.model("StaffPayroll", staffPayrollSchema);
