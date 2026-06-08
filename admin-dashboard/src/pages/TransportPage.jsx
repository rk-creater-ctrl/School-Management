import { createElement, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bus,
  CheckCircle2,
  CircleDollarSign,
  Edit3,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { erpAPI, transportAPI } from "../api";
import AcademicYearSelect from "../components/AcademicYearSelect";
import { getStoredUser } from "../permissions";
import { formatCurrency } from "../utils/feeReports";
import { emptyVehicleForm, getCurrentAcademicYear } from "../utils/transport";
import { printReceiptOnly } from "../utils/receiptPrint";
import { getSchoolNameForClass } from "../utils/branding";

const statusOptions = ["Active", "Maintenance", "Inactive"];

function TransportPage() {
  const currentUser = getStoredUser();
  const role = currentUser?.role;
  const canManage = ["superadmin", "admin", "staff"].includes(role);
  const navigate = useNavigate();

  const [academicYear, setAcademicYear] = useState(getCurrentAcademicYear());
  const [vehicles, setVehicles] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [vehicleForm, setVehicleForm] = useState(emptyVehicleForm);

  const loadVehicles = useCallback(async () => {
    try {
      setLoading(true);
      const res = await transportAPI.getVehicles({ academicYear });
      setVehicles(res.data || []);
      setStatus("");
    } catch (error) {
      setStatus(error.response?.data?.error || "Unable to load transport vehicles.");
    } finally {
      setLoading(false);
    }
  }, [academicYear]);

  useEffect(() => {
    // Load remote transport data whenever the selected academic year changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadVehicles();
  }, [loadVehicles]);

  const filteredVehicles = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return vehicles;
    return vehicles.filter((vehicle) =>
      [
        vehicle.vehicleNo,
        vehicle.vehicleType,
        vehicle.driverName,
        vehicle.driverContactNo,
        vehicle.helperName,
        vehicle.helperContactNo,
        vehicle.femaleAttendantName,
        vehicle.femaleAttendantContactNo,
        vehicle.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [query, vehicles]);

  const transportSummary = useMemo(
    () =>
      vehicles.reduce(
        (summary, vehicle) => ({
          assignedCount: summary.assignedCount + Number(vehicle.assignedCount || 0),
          paidAmount: summary.paidAmount + Number(vehicle.feeSummary?.paidAmount || 0),
          dueAmount: summary.dueAmount + Number(vehicle.feeSummary?.dueAmount || 0),
        }),
        { assignedCount: 0, paidAmount: 0, dueAmount: 0 }
      ),
    [vehicles]
  );

  function openCreateVehicle() {
    if (!canManage) return;
    setEditingVehicle(null);
    setVehicleForm(emptyVehicleForm);
    setVehicleModalOpen(true);
  }

  function openEditVehicle(vehicle) {
    if (!canManage) return;
    setEditingVehicle(vehicle);
    setVehicleForm({
      ...emptyVehicleForm,
      ...vehicle,
      capacity: vehicle.capacity || "",
    });
    setVehicleModalOpen(true);
  }

  function updateVehicleForm(field, value) {
    setVehicleForm((current) => ({ ...current, [field]: value }));
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
      if (editingVehicle) {
        await transportAPI.updateVehicle(editingVehicle._id, payload);
        setStatus("Vehicle updated.");
      } else {
        const res = await transportAPI.createVehicle(payload);
        if (res.data?._id) navigate(`/modules/transport/vehicles/${res.data._id}`);
        setStatus("Vehicle created.");
      }
      setVehicleModalOpen(false);
      setEditingVehicle(null);
      await loadVehicles();
    } catch (error) {
      setStatus(error.response?.data?.error || "Unable to save vehicle.");
    }
  }

  async function deleteVehicle(vehicle) {
    if (!canManage) return;
    const ok = window.confirm(`Delete vehicle ${vehicle.vehicleNo}? Assigned transport fee plans will also be removed.`);
    if (!ok) return;

    try {
      await transportAPI.removeVehicle(vehicle._id);
      setStatus("Vehicle deleted.");
      await loadVehicles();
    } catch (error) {
      setStatus(error.response?.data?.error || "Unable to delete vehicle.");
    }
  }

  return (
    <div className="transport-page">
      <section className="module-hero transport-hero">
        <div>
          <span className="eyebrow">Transport</span>
          <h2>Vehicles, Students & Transport Fees</h2>
          <p>Late fee is calculated automatically from the 10th to the 30th of every month at Rs. 10 per day.</p>
        </div>
        <div className="transport-hero-actions">
          <AcademicYearSelect className="transport-year-field" value={academicYear} onChange={setAcademicYear} />
          {canManage && (
            <button className="primary-button" type="button" onClick={openCreateVehicle}>
              <Plus size={18} /> Add Vehicle
            </button>
          )}
        </div>
      </section>

      {status && <div className="inline-alert">{status}</div>}

      <section className="stats-grid compact">
        <Metric icon={Bus} label="Vehicles" value={vehicles.length} detail="Transport fleet" />
        <Metric icon={Users} label="Students" value={transportSummary.assignedCount} detail="Assigned to vehicles" />
        <Metric icon={CheckCircle2} label="Collected" value={formatCurrency(transportSummary.paidAmount)} detail={academicYear} />
        <Metric icon={CircleDollarSign} label="Due" value={formatCurrency(transportSummary.dueAmount)} detail="Including late fee" />
      </section>

      <section className="table-toolbar transport-toolbar">
        <div className="search-box">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search vehicle, driver, contact" />
        </div>
      </section>

      <section className="transport-vehicle-grid">
        {filteredVehicles.map((vehicle) => (
          <article className="transport-vehicle-card" key={vehicle._id}>
            <button className="transport-card-main" type="button" onClick={() => navigate(`/modules/transport/vehicles/${vehicle._id}`)}>
              <div className="transport-card-icon"><Bus size={20} /></div>
              <div>
                <span>{vehicle.vehicleType || "Vehicle"}</span>
                <h3>{vehicle.vehicleNo}</h3>
                <p>{vehicle.capacity ? `${vehicle.capacity} seats` : "Capacity not set"}</p>
              </div>
            </button>
            <div className="transport-card-meta">
              <span>{vehicle.assignedCount || 0} students</span>
              <span>{formatCurrency(vehicle.feeSummary?.dueAmount || 0)} due</span>
              <span className={`transport-status status-${String(vehicle.status || "active").toLowerCase()}`}>{vehicle.status}</span>
            </div>
            <div className="transport-card-footer">
              <div>
                <strong>{vehicle.driverName || "Driver not set"}</strong>
                <span>{vehicle.driverContactNo || "No contact"}</span>
              </div>
              {canManage && (
                <div className="table-action-group">
                  <button className="icon-button table-icon-action" type="button" onClick={() => openEditVehicle(vehicle)} aria-label="Edit vehicle">
                    <Edit3 size={15} />
                  </button>
                  <button className="icon-button table-icon-action danger" type="button" onClick={() => deleteVehicle(vehicle)} aria-label="Delete vehicle">
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </div>
          </article>
        ))}

        {!loading && filteredVehicles.length === 0 && <div className="empty-state transport-empty">No vehicles found.</div>}
        {loading && <div className="empty-state transport-empty">Loading transport vehicles.</div>}
      </section>

      {vehicleModalOpen && (
        <VehicleModal
          editingVehicle={editingVehicle}
          form={vehicleForm}
          onClose={() => setVehicleModalOpen(false)}
          onChange={updateVehicleForm}
          onSubmit={saveVehicle}
        />
      )}

    </div>
  );
}

export function VehicleDetail({
  activePayment,
  assignedStudents,
  canCollect,
  canManage,
  detailLoading,
  feeByStudentId,
  fees,
  onBack,
  onEditVehicle,
  onMonthAction,
  onOpenPicker,
  onOpenStudentRecord,
  onReceipt,
  onRemoveStudent,
  onSelectFee,
  onUpdateMonth,
  paymentDate,
  selectedFee,
  selectedFeeId,
  setActivePayment,
  setPaymentDate,
  vehicle,
}) {
  const [activeCrewRole, setActiveCrewRole] = useState("driver");

  if (!vehicle) return <div className="empty-state">Vehicle not found.</div>;

  const crewProfiles = [
    {
      key: "driver",
      title: "Driver",
      name: vehicle.driverName,
      contact: vehicle.driverContactNo,
      fields: [
        ["Name", vehicle.driverName],
        ["Contact no.", vehicle.driverContactNo],
        ["License no.", vehicle.driverLicenseNo],
        ["Emergency no.", vehicle.driverEmergencyNo],
        ["Address", vehicle.driverAddress],
      ],
    },
    {
      key: "codriver",
      title: "Co-driver",
      name: vehicle.helperName,
      contact: vehicle.helperContactNo,
      fields: [
        ["Name", vehicle.helperName],
        ["Contact no.", vehicle.helperContactNo],
      ],
    },
    {
      key: "attendant",
      title: "Female attendant",
      name: vehicle.femaleAttendantName,
      contact: vehicle.femaleAttendantContactNo,
      fields: [
        ["Name", vehicle.femaleAttendantName],
        ["Contact no.", vehicle.femaleAttendantContactNo],
      ],
    },
  ];
  const activeCrew = crewProfiles.find((profile) => profile.key === activeCrewRole) || crewProfiles[0];

  return (
    <section className="transport-detail">
      <button className="secondary-button transport-back-button" type="button" onClick={onBack}>
        <ArrowLeft size={17} /> Back to Vehicles
      </button>

      <article className="chart-card wide transport-vehicle-profile">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{vehicle.vehicleType || "Vehicle"}</span>
            <h3>{vehicle.vehicleNo}</h3>
          </div>
          {canManage && (
            <button className="secondary-button" type="button" onClick={() => onEditVehicle(vehicle)}>
              <Edit3 size={16} /> Edit Vehicle
            </button>
          )}
        </div>

        <div className="transport-detail-sections">
          <section className="transport-detail-section vehicle">
            <h4>Vehicle Details</h4>
            <div className="transport-info-grid">
              <Info label="Vehicle type" value={vehicle.vehicleType || "-"} />
              <Info label="Capacity" value={vehicle.capacity || "-"} />
              <Info label="Status" value={vehicle.status || "-"} />
            </div>
          </section>

          <section className="transport-detail-section driver">
            <h4>People Details</h4>
            <div className="transport-crew-grid">
              {crewProfiles.map((profile) => (
                <button
                  className={activeCrewRole === profile.key ? "transport-crew-card active" : "transport-crew-card"}
                  key={profile.key}
                  type="button"
                  onClick={() => setActiveCrewRole(profile.key)}
                >
                  <span>{profile.title}</span>
                  <strong>{profile.name || "-"}</strong>
                  <small>{profile.contact || "No contact"}</small>
                </button>
              ))}
            </div>
            <h4>{activeCrew.title} Detail</h4>
            <div className="transport-info-grid">
              {activeCrew.fields.map(([label, value]) => (
                <Info key={label} label={label} value={value || "-"} wide={label === "Address"} />
              ))}
            </div>
          </section>

          <section className="transport-detail-section helper">
            <h4>Safety Details</h4>
            <div className="transport-info-grid">
              <Info label="Fire extinguisher" value={vehicle.hasFireExtinguisher ? "Available" : "Not available"} />
              <Info label="First aid kit" value={vehicle.hasFirstAidKit ? "Available" : "Not available"} />
            </div>
          </section>

          <section className="transport-detail-section notes">
            <h4>Notes</h4>
            <div className="transport-info-grid">
              <Info label="Vehicle notes" value={vehicle.notes || "-"} wide />
            </div>
          </section>
        </div>
      </article>

      <section className="chart-card transport-assigned-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Vehicle Students</span>
            <h3>Assigned Students</h3>
          </div>
          <div className="transport-section-actions">
            {detailLoading && <span className="transport-muted">Refreshing...</span>}
            {canManage && (
              <button className="primary-button" type="button" onClick={onOpenPicker}>
                <UserPlus size={18} /> Add Student
              </button>
            )}
          </div>
        </div>
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Class</th>
                <th>Pickup / Area</th>
                <th>Monthly Fee</th>
                <th>Due</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignedStudents.map((entry) => {
                const student = entry.student;
                const fee = feeByStudentId.get(String(student?._id));
                return (
                  <tr
                    className={onOpenStudentRecord ? "transport-click-row" : ""}
                    key={entry._id || student?._id}
                    onClick={() => onOpenStudentRecord?.(entry)}
                    onKeyDown={(event) => {
                      if (onOpenStudentRecord && (event.key === "Enter" || event.key === " ")) onOpenStudentRecord(entry);
                    }}
                    tabIndex={onOpenStudentRecord ? 0 : undefined}
                  >
                    <td>
                      <strong>{student?.name || "-"}</strong>
                      <span className="transport-table-sub">{student?.admissionNo || "-"}</span>
                    </td>
                    <td>{student?.className || "-"}</td>
                    <td>{entry.pickupPoint || "-"}</td>
                    <td>{formatCurrency(entry.monthlyFee || fee?.monthlyAmount || 0)}</td>
                    <td>{formatCurrency(fee?.dueAmount || 0)}</td>
                    <td>
                      <div className="table-action-group">
                        {fee && (
                          <button className="ghost-button table-action" type="button" onClick={(event) => {
                            event.stopPropagation();
                            onSelectFee(fee._id);
                          }}>
                            Fees
                          </button>
                        )}
                        {canManage && (
                          <button className="icon-button table-icon-action danger" type="button" onClick={(event) => {
                            event.stopPropagation();
                            onRemoveStudent(entry);
                          }} aria-label="Remove student">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {assignedStudents.length === 0 && (
                <tr>
                  <td colSpan="6">No students assigned to this vehicle.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <TransportFeePanel
        activePayment={activePayment}
        assignedStudents={assignedStudents}
        canCollect={canCollect}
        fee={selectedFee}
        fees={fees}
        onMonthAction={onMonthAction}
        onReceipt={onReceipt}
        onSelectFee={onSelectFee}
        onUpdateMonth={onUpdateMonth}
        paymentDate={paymentDate}
        selectedFeeId={selectedFeeId}
        setActivePayment={setActivePayment}
        setPaymentDate={setPaymentDate}
      />
    </section>
  );
}

function TransportFeePanel({
  activePayment,
  assignedStudents,
  canCollect,
  fee,
  fees,
  onMonthAction,
  onReceipt,
  onSelectFee,
  onUpdateMonth,
  paymentDate,
  selectedFeeId,
  setActivePayment,
  setPaymentDate,
}) {
  const assignmentByStudentId = new Map(
    (assignedStudents || []).map((entry) => [String(entry.student?._id || entry.student), entry])
  );

  return (
    <section className="chart-card transport-fee-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Transport Fees</span>
          <h3>{fee ? fee.studentName : "Students"}</h3>
        </div>
        {fee && (
          <div className="transport-fee-summary">
            <span>Paid {formatCurrency(fee.paidAmount || 0)}</span>
            <strong>Due {formatCurrency(fee.dueAmount || 0)}</strong>
          </div>
        )}
      </div>

      <div className="responsive-table transport-fee-list">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Class</th>
              <th>Start Date</th>
              <th>Status</th>
              <th>Due</th>
            </tr>
          </thead>
          <tbody>
            {fees.map((item) => {
              const assignment = assignmentByStudentId.get(String(item.student));
              const status = item.status || assignment?.status || "Active";
              return (
                <tr
                  className={selectedFeeId === item._id ? "transport-click-row active" : "transport-click-row"}
                  key={item._id}
                  onClick={() => onSelectFee(item._id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") onSelectFee(item._id);
                  }}
                  tabIndex={0}
                >
                  <td>
                    <strong>{item.studentName || "-"}</strong>
                    <span className="transport-table-sub">{item.admissionNo || "-"}</span>
                  </td>
                  <td>{item.className || "-"}</td>
                  <td>{formatTransportDate(item.startDate || assignment?.joinedAt)}</td>
                  <td><span className={`transport-status status-${String(status).toLowerCase()}`}>{status}</span></td>
                  <td>{formatCurrency(item.dueAmount || 0)}</td>
                </tr>
              );
            })}
            {fees.length === 0 && (
              <tr>
                <td colSpan="5">No transport fee records yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!fee && <div className="empty-state">Click a student above to open fee details.</div>}

      {fee && (
        <>
          <div className="transport-fee-detail-heading">
            <button className="secondary-button" type="button" onClick={() => onSelectFee("")}>
              <ArrowLeft size={16} /> Back to Fee List
            </button>
            <div>
              <span className="eyebrow">{fee.className || "Class"}</span>
              <h3>{fee.studentName}</h3>
            </div>
          </div>

      <div className="transport-late-note">
        <ReceiptText size={16} />
        <span>Late fee starts from the 10th and is capped on the 30th at Rs. {fee.lateFeePerDay || 10} per day.</span>
      </div>

      <div className="responsive-table">
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Base Fee</th>
              <th>Late Fee</th>
              <th>Payable</th>
              <th>Status</th>
              <th>Paid Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {(fee.months || []).map((month) => {
              const isActive = activePayment?.feeId === fee._id && activePayment?.monthName === month.name;
              const lateFee = getMonthLateFee(month);
              const payable = Number(month.amount || 0) + lateFee;

              return (
                <tr key={month.name}>
                  <td>{month.name}</td>
                  <td>{formatCurrency(month.amount || 0)}</td>
                  <td>{lateFee ? formatCurrency(lateFee) : "-"}</td>
                  <td>{formatCurrency(payable)}</td>
                  <td><span className={`transport-status status-${month.status.toLowerCase()}`}>{month.status}</span></td>
                  <td>{month.paidDate ? new Date(month.paidDate).toLocaleDateString("en-IN") : "-"}</td>
                  <td>
                    <div className="transport-fee-action">
                      {canCollect ? (
                        <button className={month.status === "Paid" ? "secondary-button table-action" : "primary-button table-action"} type="button" onClick={() => onMonthAction(month)}>
                          {month.status === "Paid" ? "Mark Pending" : "Pay"}
                        </button>
                      ) : (
                        <span className="transport-muted">View only</span>
                      )}
                      {month.status === "Paid" && (
                        <button className="ghost-button table-action" type="button" onClick={() => onReceipt(month)}>
                          Receipt
                        </button>
                      )}
                      {isActive && (
                        <div className="transport-pay-popover">
                          <label>
                            <span>Payment date</span>
                            <input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
                          </label>
                          <div>
                            <button className="secondary-button table-action" type="button" onClick={() => setActivePayment(null)}>
                              Cancel
                            </button>
                            <button className="primary-button table-action" type="button" onClick={() => onUpdateMonth(fee._id, month.name, paymentDate || null)}>
                              Save
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
        </>
      )}
    </section>
  );
}

export function VehicleModal({ editingVehicle, form, onChange, onClose, onSubmit }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <form className="modal-card transport-vehicle-modal" onSubmit={onSubmit}>
        <div className="section-heading">
          <div>
            <span className="eyebrow">Vehicle</span>
            <h3>{editingVehicle ? "Edit Vehicle" : "Add Vehicle"}</h3>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="form-grid">
          <Field label="Vehicle no." value={form.vehicleNo} onChange={(value) => onChange("vehicleNo", value.toUpperCase())} required />
          <Field label="Vehicle type" value={form.vehicleType} onChange={(value) => onChange("vehicleType", value)} />
          <Field label="Capacity" type="number" value={form.capacity} onChange={(value) => onChange("capacity", value)} />
          <Select label="Status" value={form.status} options={statusOptions} onChange={(value) => onChange("status", value)} />
          <Field label="Driver name" value={form.driverName} onChange={(value) => onChange("driverName", value)} />
          <Field label="Driver contact no." value={form.driverContactNo} onChange={(value) => onChange("driverContactNo", value.replace(/\D/g, "").slice(0, 10))} />
          <Field label="Driver license no." value={form.driverLicenseNo} onChange={(value) => onChange("driverLicenseNo", value.toUpperCase())} />
          <Field label="Emergency no." value={form.driverEmergencyNo} onChange={(value) => onChange("driverEmergencyNo", value.replace(/\D/g, "").slice(0, 10))} />
          <Field label="Co-driver name" value={form.helperName} onChange={(value) => onChange("helperName", value)} />
          <Field label="Co-driver contact no." value={form.helperContactNo} onChange={(value) => onChange("helperContactNo", value.replace(/\D/g, "").slice(0, 10))} />
          <Field label="Female attendant name" value={form.femaleAttendantName} onChange={(value) => onChange("femaleAttendantName", value)} />
          <Field label="Female attendant contact no." value={form.femaleAttendantContactNo} onChange={(value) => onChange("femaleAttendantContactNo", value.replace(/\D/g, "").slice(0, 10))} />
          <CheckboxField label="Fire extinguisher" checked={form.hasFireExtinguisher} onChange={(value) => onChange("hasFireExtinguisher", value)} />
          <CheckboxField label="First aid kit" checked={form.hasFirstAidKit} onChange={(value) => onChange("hasFirstAidKit", value)} />
          <label className="field full-span">
            <span>Driver address</span>
            <textarea rows={3} value={form.driverAddress || ""} onChange={(event) => onChange("driverAddress", event.target.value)} />
          </label>
          <label className="field full-span">
            <span>Notes</span>
            <textarea rows={3} value={form.notes || ""} onChange={(event) => onChange("notes", event.target.value)} />
          </label>
        </div>

        <button className="primary-button" type="submit">{editingVehicle ? "Update Vehicle" : "Create Vehicle"}</button>
      </form>
    </div>
  );
}

export function StudentPickerModal({
  assignedStudentIds,
  assignmentForm,
  classes,
  classStudents,
  onAssign,
  onChangeAssignment,
  onClose,
  onSelectClass,
  onSelectStudent,
  selectedClass,
  selectedStudent,
  setStudentQuery,
  studentQuery,
  studentsLoading,
  vehicle,
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <form className="modal-card transport-picker-modal" onSubmit={onAssign}>
        <div className="section-heading">
          <div>
            <span className="eyebrow">{vehicle?.vehicleNo || "Vehicle"}</span>
            <h3>Add Student</h3>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="transport-picker-layout">
          <aside className="transport-class-panel">
            <span className="transport-panel-label">Classes</span>
            <div className="transport-class-list">
              {classes.map((className) => (
                <button
                  className={selectedClass === className ? "transport-class-button active" : "transport-class-button"}
                  key={className}
                  type="button"
                  onClick={() => onSelectClass(className)}
                >
                  {className}
                </button>
              ))}
              {classes.length === 0 && <div className="empty-state">No classes found.</div>}
            </div>
          </aside>

          <section className="transport-student-panel">
            {selectedClass ? (
              <>
                <div className="table-toolbar transport-student-toolbar">
                  <div>
                    <span className="eyebrow">Selected Class</span>
                    <h4>{selectedClass}</h4>
                  </div>
                  <div className="search-box">
                    <Search size={16} />
                    <input value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} placeholder="Search student in class" />
                  </div>
                </div>

                <div className="transport-student-list">
                  {classStudents.map((student) => {
                    const isSelected = selectedStudent?._id === student._id;
                    const alreadyAdded = assignedStudentIds.has(String(student._id));
                    return (
                      <button
                        className={isSelected ? "transport-student-row active" : "transport-student-row"}
                        disabled={alreadyAdded}
                        key={student._id}
                        type="button"
                        onClick={() => onSelectStudent(student)}
                      >
                        <div>
                          <strong>{student.name}</strong>
                          <span>{student.admissionNo || "-"} | Roll {student.rollNo || "-"}</span>
                        </div>
                        <small>{alreadyAdded ? "Already added" : student.fatherName || student.mobileNo || "Select"}</small>
                      </button>
                    );
                  })}
                  {!studentsLoading && classStudents.length === 0 && <div className="empty-state">No students found in this class.</div>}
                  {studentsLoading && <div className="empty-state">Loading students.</div>}
                </div>
              </>
            ) : (
              <div className="empty-state">Select a class to load students.</div>
            )}
          </section>
        </div>

        <div className="transport-assignment-panel">
          <div>
            <span className="eyebrow">Selected Student</span>
            <strong>{selectedStudent ? `${selectedStudent.name} | ${selectedStudent.className}` : "No student selected"}</strong>
          </div>
          <Field label="Monthly fee" type="number" value={assignmentForm.monthlyFee} onChange={(value) => onChangeAssignment((current) => ({ ...current, monthlyFee: value }))} required />
          <Field label="Pickup / area" value={assignmentForm.pickupPoint} onChange={(value) => onChangeAssignment((current) => ({ ...current, pickupPoint: value }))} />
          <Field label="Start date" type="date" value={assignmentForm.startDate} onChange={(value) => onChangeAssignment((current) => ({ ...current, startDate: value }))} required />
          <button className="primary-button" type="submit" disabled={!selectedStudent}>
            Add to Vehicle
          </button>
        </div>
      </form>
    </div>
  );
}

export function TransportReceiptModal({ onClose, receipt }) {
  const { fee, month } = receipt;
  const schoolName = useReceiptSchoolName(fee.className);
  const lateFee = getMonthLateFee(month);
  const paidAmount = Number(month.amount || 0) + lateFee;
  const paidDate = month.paidDate ? new Date(month.paidDate) : new Date();
  const range = getMonthDateRange(month.name, fee.academicYear);
  const receiptNo = createTransportReceiptNo(fee, month);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="receipt-modal">
        <div className="section-heading no-print">
          <div>
            <span className="eyebrow">Receipt</span>
            <h3>{receiptNo}</h3>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>x</button>
        </div>

        <article className="receipt-print-area">
          <header className="receipt-header">
            <div>
              <span>{schoolName}</span>
              <h2>Transport Fee Receipt</h2>
            </div>
            <div className="receipt-number">
              <span>Receipt No</span>
              <strong>{receiptNo}</strong>
            </div>
          </header>

          <section className="receipt-info-grid">
            <div>
              <span>Student</span>
              <strong>{fee.studentName}</strong>
            </div>
            <div>
              <span>Admission No</span>
              <strong>{fee.admissionNo || "-"}</strong>
            </div>
            <div>
              <span>Class</span>
              <strong>{fee.className || "-"}</strong>
            </div>
            <div>
              <span>Vehicle</span>
              <strong>{fee.vehicleNo || "-"}</strong>
            </div>
            <div>
              <span>Paid For</span>
              <strong>{formatReceiptDate(range.from)} to {formatReceiptDate(range.to)}</strong>
            </div>
            <div>
              <span>Paid Date</span>
              <strong>{paidDate.toLocaleDateString("en-IN")}</strong>
            </div>
          </section>

          <table className="receipt-lines">
            <thead>
              <tr>
                <th>Particulars</th>
                <th>Period</th>
                <th>Paid Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Transport Fee</td>
                <td>{month.name}</td>
                <td>{formatCurrency(paidAmount)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="2">Total Paid Amount</td>
                <td>{formatCurrency(paidAmount)}</td>
              </tr>
            </tfoot>
          </table>

          <footer className="receipt-footer">
            <span>Amount received only for the period shown above.</span>
            <strong>Authorized Signature</strong>
          </footer>
        </article>

        <div className="receipt-actions no-print">
          <button className="secondary-button" type="button" onClick={onClose}>Close</button>
          <button className="primary-button" type="button" onClick={printReceiptOnly}>Print Receipt</button>
        </div>
      </div>
    </div>
  );
}

function useReceiptSchoolName(className = "") {
  const [schoolName, setSchoolName] = useState("School");

  useEffect(() => {
    let active = true;
    erpAPI
      .list("schoolSettings")
      .then((res) => {
        const settings = res.data?.[0]?.payload || {};
        const nextName = getSchoolNameForClass(settings, className);
        if (active && nextName) setSchoolName(nextName);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [className]);

  return schoolName;
}

function Metric({ detail, icon, label, value }) {
  return (
    <article className="metric-card">
      <div className="metric-icon">{createElement(icon, { size: 20 })}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small><CheckCircle2 size={14} /> {detail}</small>
    </article>
  );
}

function Info({ label, value, wide }) {
  return (
    <div className={wide ? "transport-info-item wide" : "transport-info-item"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Field({ label, onChange, required, type = "text", value }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value || ""} onChange={(event) => onChange(event.target.value)} required={required} />
    </label>
  );
}

function CheckboxField({ checked, label, onChange }) {
  return (
    <label className="field checkbox-field">
      <input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function Select({ label, onChange, options, value }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

function getMonthLateFee(month) {
  return month.status === "Paid"
    ? Number(month.lateFeePaidAmount || month.lateFeeDueAmount || 0)
    : Number(month.lateFeeDueAmount || 0);
}

function getMonthDateRange(monthName, academicYear) {
  const monthIndex = [
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
    "January",
    "February",
    "March",
  ].indexOf(monthName);
  const { startYear, endYear } = getAcademicYearParts(academicYear);
  const calendarMonth = monthIndex >= 0 && monthIndex <= 8 ? monthIndex + 3 : monthIndex - 9;
  const calendarYear = monthIndex >= 0 && monthIndex <= 8 ? startYear : endYear;

  return {
    from: new Date(calendarYear, calendarMonth, 1),
    to: new Date(calendarYear, calendarMonth + 1, 0),
  };
}

function getAcademicYearParts(academicYear) {
  const parts = String(academicYear || "").match(/\d{4}/g) || [];
  const startYear = Number(parts[0]) || new Date().getFullYear();
  return { startYear, endYear: Number(parts[1]) || startYear + 1 };
}

function formatReceiptDate(date) {
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTransportDate(date) {
  if (!date) return "-";
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "-";
  return value.toLocaleDateString("en-IN");
}

function createTransportReceiptNo(fee, month) {
  const year = String(fee.academicYear || "YEAR").replace(/\D/g, "").slice(0, 8);
  const admission = String(fee.admissionNo || fee.student || "STD").replace(/\W/g, "").slice(-6);
  const code = String(month.name || "MONTH").replace(/\W/g, "").slice(0, 6).toUpperCase();
  return `TR-${year}-${admission}-${code}`;
}

export default TransportPage;
