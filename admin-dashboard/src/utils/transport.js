import { studentsAPI } from "../api";
export { getCurrentAcademicYear } from "./academicYear";

export const emptyVehicleForm = {
  vehicleNo: "",
  vehicleType: "Bus",
  capacity: "",
  driverName: "",
  driverAddress: "",
  driverContactNo: "",
  driverLicenseNo: "",
  driverEmergencyNo: "",
  helperName: "",
  helperContactNo: "",
  femaleAttendantName: "",
  femaleAttendantContactNo: "",
  hasFireExtinguisher: false,
  hasFirstAidKit: false,
  status: "Active",
  notes: "",
};

export async function loadStudentsFallback(className, search) {
  const res = await studentsAPI.getAll();
  const classKey = normalizeSearch(className);
  const term = normalizeSearch(search);
  return (res.data || [])
    .filter((student) => normalizeSearch(student.className) === classKey)
    .filter((student) => {
      if (!term) return true;
      return [
        student.name,
        student.admissionNo,
        student.fatherName,
        student.mobileNo,
        student.rollNo,
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);
    })
    .slice(0, 120);
}

export function todayDateInput(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function normalizeSearch(value) {
  return String(value || "").trim().toLowerCase();
}
