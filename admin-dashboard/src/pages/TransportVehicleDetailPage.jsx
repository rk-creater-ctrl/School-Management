import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { transportAPI } from "../api";
import AcademicYearSelect from "../components/AcademicYearSelect";
import { canUseRole, getStoredUser } from "../permissions";
import {
  StudentPickerModal,
  TransportReceiptModal,
  VehicleDetail,
  VehicleModal,
} from "./TransportPage";
import { emptyVehicleForm, getCurrentAcademicYear, loadStudentsFallback, todayDateInput } from "../utils/transport";

function TransportVehicleDetailPage() {
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const currentUser = getStoredUser();
  const canManage = canUseRole(["superadmin", "admin", "staff"], currentUser);
  const canCollect = canUseRole(["superadmin", "accountant"], currentUser);

  const [academicYear, setAcademicYear] = useState(getCurrentAcademicYear());
  const [vehicleDetail, setVehicleDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [status, setStatus] = useState("");

  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [vehicleForm, setVehicleForm] = useState(emptyVehicleForm);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [classStudents, setClassStudents] = useState([]);
  const [studentQuery, setStudentQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [assignmentForm, setAssignmentForm] = useState({ monthlyFee: "", pickupPoint: "", startDate: todayDateInput() });
  const [studentsLoading, setStudentsLoading] = useState(false);

  const [selectedFeeId, setSelectedFeeId] = useState("");
  const [activePayment, setActivePayment] = useState(null);
  const [paymentDate, setPaymentDate] = useState("");
  const [receipt, setReceipt] = useState(null);

  const loadVehicleDetail = useCallback(async () => {
    if (!vehicleId) return;

    try {
      setDetailLoading(true);
      const res = await transportAPI.getVehicle(vehicleId, { academicYear });
      setVehicleDetail(res.data);
      setSelectedFeeId((current) => {
        const fees = res.data?.fees || [];
        return fees.some((fee) => fee._id === current) ? current : "";
      });
      setStatus("");
    } catch (error) {
      setStatus(error.response?.data?.error || "Unable to load vehicle details.");
    } finally {
      setDetailLoading(false);
    }
  }, [academicYear, vehicleId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadVehicleDetail();
  }, [loadVehicleDetail]);

  useEffect(() => {
    if (!pickerOpen) return;
    let active = true;

    transportAPI
      .getClasses()
      .then((res) => {
        if (active) setClasses(res.data || []);
      })
      .catch((error) => {
        if (active) setStatus(error.response?.data?.error || "Unable to load classes.");
      });

    return () => {
      active = false;
    };
  }, [pickerOpen]);

  useEffect(() => {
    if (!pickerOpen || !selectedClass) return;

    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        setStudentsLoading(true);
        const res = await transportAPI.getStudents({
          className: selectedClass,
          search: studentQuery,
        });
        let students = res.data || [];
        if (!students.length) {
          students = await loadStudentsFallback(selectedClass, studentQuery);
        }
        if (active) setClassStudents(students);
      } catch (error) {
        try {
          const students = await loadStudentsFallback(selectedClass, studentQuery);
          if (active) setClassStudents(students);
          if (active && !students.length) setStatus(error.response?.data?.error || "No students found for this class.");
        } catch {
          if (active) setStatus(error.response?.data?.error || "Unable to load students.");
        }
      } finally {
        if (active) setStudentsLoading(false);
      }
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [pickerOpen, selectedClass, studentQuery]);

  const vehicle = vehicleDetail?.vehicle;
  const assignedStudents = useMemo(
    () => (vehicleDetail?.vehicle?.students || []).filter((entry) => entry.student),
    [vehicleDetail]
  );
  const assignedStudentIds = useMemo(
    () => new Set(assignedStudents.map((entry) => String(entry.student?._id || entry.student))),
    [assignedStudents]
  );
  const fees = useMemo(() => vehicleDetail?.fees || [], [vehicleDetail]);
  const feeByStudentId = useMemo(
    () => new Map(fees.map((fee) => [String(fee.student), fee])),
    [fees]
  );
  const selectedFee = fees.find((fee) => fee._id === selectedFeeId) || null;

  function updateVehicleForm(field, value) {
    setVehicleForm((current) => ({ ...current, [field]: value }));
  }

  function openEditVehicle(nextVehicle) {
    if (!canManage) return;
    setEditingVehicle(nextVehicle);
    setVehicleForm({
      ...emptyVehicleForm,
      ...nextVehicle,
      capacity: nextVehicle.capacity || "",
    });
    setVehicleModalOpen(true);
  }

  async function saveVehicle(event) {
    event.preventDefault();
    if (!vehicleForm.vehicleNo.trim()) {
      setStatus("Vehicle number is required.");
      return;
    }

    const payload = {
      vehicleNo: vehicleForm.vehicleNo,
      vehicleType: vehicleForm.vehicleType,
      capacity: Number(vehicleForm.capacity || 0),
      driverName: vehicleForm.driverName,
      driverAddress: vehicleForm.driverAddress,
      driverContactNo: vehicleForm.driverContactNo,
      driverLicenseNo: vehicleForm.driverLicenseNo,
      driverEmergencyNo: vehicleForm.driverEmergencyNo,
      helperName: vehicleForm.helperName,
      helperContactNo: vehicleForm.helperContactNo,
      femaleAttendantName: vehicleForm.femaleAttendantName,
      femaleAttendantContactNo: vehicleForm.femaleAttendantContactNo,
      hasFireExtinguisher: Boolean(vehicleForm.hasFireExtinguisher),
      hasFirstAidKit: Boolean(vehicleForm.hasFirstAidKit),
      status: vehicleForm.status,
      notes: vehicleForm.notes,
    };

    try {
      await transportAPI.updateVehicle(vehicleId, payload);
      setVehicleModalOpen(false);
      setEditingVehicle(null);
      setStatus("Vehicle updated.");
      await loadVehicleDetail();
    } catch (error) {
      setStatus(error.response?.data?.error || "Unable to save vehicle.");
    }
  }

  function openStudentPicker() {
    if (!canManage) return;
    setPickerOpen(true);
    setSelectedClass("");
    setStudentQuery("");
    setSelectedStudent(null);
    setClassStudents([]);
    setAssignmentForm({ monthlyFee: "", pickupPoint: "", startDate: todayDateInput() });
  }

  async function assignStudent(event) {
    event.preventDefault();
    if (!vehicleId || !selectedStudent) {
      setStatus("Select a student first.");
      return;
    }
    if (!Number(assignmentForm.monthlyFee || 0)) {
      setStatus("Monthly transport fee is required.");
      return;
    }

    try {
      const res = await transportAPI.assignStudent(vehicleId, {
        studentId: selectedStudent._id,
        academicYear,
        monthlyFee: Number(assignmentForm.monthlyFee),
        pickupPoint: assignmentForm.pickupPoint,
        startDate: assignmentForm.startDate,
      });
      setVehicleDetail(res.data);
      setSelectedFeeId((res.data?.fees || []).find((fee) => String(fee.student) === String(selectedStudent._id))?._id || "");
      setPickerOpen(false);
      setSelectedStudent(null);
      setStatus("Student added to vehicle.");
    } catch (error) {
      setStatus(error.response?.data?.error || "Unable to assign student.");
    }
  }

  async function removeAssignedStudent(entry) {
    if (!canManage) return;
    const student = entry.student;
    const ok = window.confirm(`Remove ${student?.name || "this student"} from this vehicle?`);
    if (!ok) return;

    try {
      const res = await transportAPI.removeStudent(vehicleId, student._id, { academicYear });
      setVehicleDetail(res.data);
      setStatus("Student removed from vehicle.");
    } catch (error) {
      setStatus(error.response?.data?.error || "Unable to remove student.");
    }
  }

  function handleMonthAction(month) {
    if (!canCollect || !selectedFee) return;

    if (month.status === "Paid") {
      const ok = window.confirm(`Mark ${month.name} pending for ${selectedFee.studentName}?`);
      if (ok) updateMonthStatus(selectedFee._id, month.name, null);
      return;
    }

    setActivePayment({ feeId: selectedFee._id, monthName: month.name });
    setPaymentDate("");
  }

  async function updateMonthStatus(feeId, monthName, paidDate) {
    try {
      await transportAPI.toggleMonth(feeId, monthName, paidDate || null);
      setActivePayment(null);
      setPaymentDate("");
      await loadVehicleDetail();
    } catch (error) {
      setStatus(error.response?.data?.error || "Unable to update transport fee.");
    }
  }

  function openReceipt(month) {
    if (!selectedFee) return;
    setReceipt({ fee: selectedFee, month });
  }

  return (
    <div className="transport-page transport-detail-page">
      <section className="module-hero transport-hero transport-detail-hero">
        <div>
          <span className="eyebrow">Transport Vehicle</span>
          <h2>{vehicle?.vehicleNo || "Vehicle Details"}</h2>
          <p>Vehicle profile, assigned students, and transport fees are managed here.</p>
        </div>
        <AcademicYearSelect className="transport-year-field" value={academicYear} onChange={setAcademicYear} />
      </section>

      {status && <div className="inline-alert">{status}</div>}
      {detailLoading && !vehicle && <div className="empty-state">Loading vehicle details.</div>}

      {vehicle && (
        <VehicleDetail
          activePayment={activePayment}
          assignedStudents={assignedStudents}
          canCollect={canCollect}
          canManage={canManage}
          detailLoading={detailLoading}
          feeByStudentId={feeByStudentId}
          fees={fees}
          onBack={() => navigate("/modules/transport")}
          onEditVehicle={openEditVehicle}
          onMonthAction={handleMonthAction}
          onOpenPicker={openStudentPicker}
          onOpenStudentRecord={(entry) => {
            const nextStudentId = entry.student?._id || entry.student;
            navigate(`/modules/transport/vehicles/${vehicleId}/students/${nextStudentId}?year=${encodeURIComponent(academicYear)}`);
          }}
          onReceipt={openReceipt}
          onRemoveStudent={removeAssignedStudent}
          onSelectFee={setSelectedFeeId}
          onUpdateMonth={updateMonthStatus}
          paymentDate={paymentDate}
          selectedFee={selectedFee}
          selectedFeeId={selectedFeeId}
          setActivePayment={setActivePayment}
          setPaymentDate={setPaymentDate}
          vehicle={vehicle}
        />
      )}

      {vehicleModalOpen && (
        <VehicleModal
          editingVehicle={editingVehicle}
          form={vehicleForm}
          onChange={updateVehicleForm}
          onClose={() => setVehicleModalOpen(false)}
          onSubmit={saveVehicle}
        />
      )}

      {pickerOpen && (
        <StudentPickerModal
          assignedStudentIds={assignedStudentIds}
          assignmentForm={assignmentForm}
          classes={classes}
          classStudents={classStudents}
          onAssign={assignStudent}
          onChangeAssignment={setAssignmentForm}
          onClose={() => setPickerOpen(false)}
          onSelectClass={(className) => {
            setSelectedClass(className);
            setSelectedStudent(null);
            setStudentQuery("");
          }}
          onSelectStudent={setSelectedStudent}
          selectedClass={selectedClass}
          selectedStudent={selectedStudent}
          setStudentQuery={setStudentQuery}
          studentQuery={studentQuery}
          studentsLoading={studentsLoading}
          vehicle={vehicle}
        />
      )}

      {receipt && <TransportReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}

export default TransportVehicleDetailPage;
