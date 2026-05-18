// backend/src/models/Student.js
const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    // Basic identifiers
    admissionNo: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    studentCode: { type: String },

    // Class
    className: { type: String, required: true }, // e.g. "Class 10-A"
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: false, // keep optional for now
    },

     email: { type: String },

    // Family
    fatherName: { type: String },
    motherName: { type: String },

    // Personal
    dob: { type: Date },
    gender: {
      type: String,
      enum: ["Male", "Female", "Other", ""],
      default: "",
    },
    category: { type: String },

    // Contact / IDs
    mobileNo: { type: String },
    aadharNo: { type: String },
    childId: { type: String },
    familyId: { type: String },
    udisePenNo: { type: String },
    apaarId: { type: String },

    // Bank
    bankName: { type: String },
    accountNo: { type: String },
    ifscCode: { type: String },

    // Other
    address: { type: String },
    section: { type: String },
    rollNo: { type: String },
    house: { type: String },
    status: {
      type: String,
      enum: ["active", "promoted", "transferred", "inactive"],
      default: "active",
    },
    documents: [
      {
        name: String,
        url: String,
        type: String,
        verified: { type: Boolean, default: false },
      },
    ],
    guardian: {
      name: String,
      relation: String,
      phone: String,
      email: String,
      occupation: String,
    },
    medical: {
      bloodGroup: String,
      allergies: String,
      chronicConditions: String,
      emergencyContact: String,
      doctorName: String,
    },
    academicHistory: [
      {
        academicYear: String,
        className: String,
        section: String,
        result: String,
        percentage: Number,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Student", studentSchema);
