const mongoose = require("mongoose");
const { Schema } = mongoose;

const assignedStudentSchema = new Schema(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    monthlyFee: { type: Number, default: 0 },
    pickupPoint: { type: String, default: "" },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const transportVehicleSchema = new Schema(
  {
    vehicleNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    vehicleType: { type: String, default: "Bus", trim: true },
    routeName: { type: String, default: "", trim: true },
    pickupArea: { type: String, default: "", trim: true },
    capacity: { type: Number, default: 0 },
    driverName: { type: String, default: "", trim: true },
    driverAddress: { type: String, default: "", trim: true },
    driverContactNo: { type: String, default: "", trim: true },
    driverLicenseNo: { type: String, default: "", trim: true },
    driverEmergencyNo: { type: String, default: "", trim: true },
    helperName: { type: String, default: "", trim: true },
    helperContactNo: { type: String, default: "", trim: true },
    femaleAttendantName: { type: String, default: "", trim: true },
    femaleAttendantContactNo: { type: String, default: "", trim: true },
    hasFireExtinguisher: { type: Boolean, default: false },
    hasFirstAidKit: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["Active", "Maintenance", "Inactive"],
      default: "Active",
    },
    notes: { type: String, default: "", trim: true },
    students: {
      type: [assignedStudentSchema],
      default: [],
    },
  },
  { timestamps: true }
);

transportVehicleSchema.index({ routeName: 1, vehicleNo: 1 });

module.exports = mongoose.model("TransportVehicle", transportVehicleSchema);
