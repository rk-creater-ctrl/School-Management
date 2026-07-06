import { createElement, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Banknote,
  Bus,
  CalendarCheck,
  CircleDollarSign,
  FileBadge,
  GraduationCap,
  IdCard,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { attendanceAPI, feesAPI, studentsAPI, transportAPI } from "../api";
import AcademicYearSelect from "../components/AcademicYearSelect";
import { canUseRole, getStoredUser } from "../permissions";
import { getAcademicYearStart, getCurrentAcademicYear } from "../utils/academicYear";
import { formatCurrency } from "../utils/feeReports";

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "fees", label: "Fees" },
  { id: "transport", label: "Transport" },
  { id: "records", label: "Records" },
];

function StudentProfilePage() {
  const { id } = useParams();
  const user = getStoredUser();
  const [student, setStudent] = useState(null);
  const [fees, setFees] = useState([]);
  const [transportFees, setTransportFees] = useState([]);
  const [attendance, setAttendance] = useState(null);
  const [academicYear, setAcademicYear] = useState(getCurrentAcademicYear());
  const [activeTab, setActiveTab] = useState("overview");
  const [status, setStatus] = useState("Loading student...");

  const loadStudentProfile = useCallback(async () => {
    try {
      setStatus("Loading student...");
      const startYear = getAcademicYearStart(academicYear);
      const [studentRes, feeRes, attendanceRes, transportRes] = await Promise.all([
        studentsAPI.getById(id),
        feesAPI.getByStudent(id).catch(() => ({ data: [] })),
        attendanceAPI.getStudentYear(id, startYear).catch(() => ({ data: null })),
        transportAPI.getFees({ academicYear }).catch(() => ({ data: [] })),
      ]);

      setStudent(studentRes.data);
      setFees(feeRes.data || []);
      setAttendance(attendanceRes.data);
      setTransportFees((transportRes.data || []).filter((fee) => String(fee.student) === String(id)));
      setStatus("");
    } catch {
      setStatus("Unable to load student profile.");
    }
  }, [academicYear, id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStudentProfile();
  }, [loadStudentProfile]);

  const activeFee = useMemo(
    () => fees.find((fee) => fee.academicYear === academicYear) || null,
    [academicYear, fees]
  );
  const activeTransportFee = transportFees.find((fee) => fee.academicYear === academicYear) || null;
  const feeTotals = useMemo(
    () =>
      fees.reduce(
        (totals, fee) => ({
          total: totals.total + Number(fee.totalFee || 0),
          paid: totals.paid + Number(fee.paidAmount || 0),
          due: totals.due + Number(fee.dueAmount || 0),
        }),
        { total: 0, paid: 0, due: 0 }
      ),
    [fees]
  );
  const currentDue = Number(activeFee?.dueAmount || 0) + Number(activeTransportFee?.dueAmount || 0);

  if (status) return <div className="inline-alert">{status}</div>;
  if (!student) return <div className="empty-state">Student not found.</div>;

  return (
    <div className="student-profile-page">
      <section className="student-profile-header">
        <div className="student-photo"><UserRound size={42} /></div>
        <div className="student-profile-title">
          <span className="eyebrow">Student Profile</span>
          <h2>{student.name}</h2>
          <p>{student.className || "-"} | Admission {student.admissionNo || "-"} | {student.status || "active"}</p>
        </div>
        <div className="student-profile-actions">
          <AcademicYearSelect className="transport-year-field" value={academicYear} onChange={setAcademicYear} />
          {canUseRole(["students.edit", "students.manage"], user) && <Link className="secondary-button" to={`/students/${student._id}/edit`}>Edit Student</Link>}
          <Link className="secondary-button" to={`/attendance/${student._id}`}>Attendance</Link>
          {canUseRole(["fees.view"], user) && <Link className="primary-button" to={`/fees/${student._id}/${academicYear}`}>Open Fees</Link>}
        </div>
      </section>

      <section className="stats-grid compact">
        <Metric icon={GraduationCap} label="Class" value={student.className || "-"} detail={student.rollNo ? `Roll ${student.rollNo}` : "Current class"} />
        <Metric icon={CalendarCheck} label="Attendance" value={`${Number(attendance?.percentage || 0).toFixed(1)}%`} detail={academicYear} />
        <Metric icon={CircleDollarSign} label="Current Due" value={formatCurrency(currentDue)} detail="Tuition + transport" />
        <Metric icon={IdCard} label="Student Code" value={student.studentCode || "-"} detail={student.mobileNo || "Contact not set"} />
      </section>

      <nav className="student-profile-tabs">
        {tabs.map((tab) => (
          <button className={activeTab === tab.id ? "active" : ""} key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "overview" && (
        <>
          <section className="student-profile-grid">
            <ProfileCard title="Basic Details" icon={UserRound} rows={[
              ["Name", student.name],
              ["Admission No", student.admissionNo],
              ["Student Code", student.studentCode],
              ["Gender", student.gender],
              ["DOB", formatDate(student.dob)],
              ["Category", student.category],
              ["Status", student.status],
            ]} />
            <ProfileCard title="Parents & Contact" icon={Phone} rows={[
              ["Father", student.fatherName],
              ["Mother", student.motherName],
              ["Guardian", student.guardian?.name],
              ["Guardian relation", student.guardian?.relation],
              ["Mobile", student.mobileNo || student.mobile],
              ["Email", student.email],
              ["Address", student.address],
            ]} />
            <ProfileCard title="Government IDs" icon={IdCard} rows={[
              ["Aadhar", student.aadharNo],
              ["Child ID", student.childId],
              ["Family ID", student.familyId],
              ["UDISE PEN", student.udisePenNo],
              ["APAAR", student.apaarId],
            ]} />
            <ProfileCard title="Medical & Emergency" icon={ShieldCheck} rows={[
              ["Blood group", student.medical?.bloodGroup],
              ["Allergies", student.medical?.allergies],
              ["Chronic condition", student.medical?.chronicConditions],
              ["Emergency contact", student.medical?.emergencyContact],
              ["Doctor", student.medical?.doctorName],
            ]} />
          </section>

          <section className="student-action-strip">
            <Link to={`/fees/${student._id}/${academicYear}`}>Collect or view fee</Link>
            <Link to={`/attendance/${student._id}`}>Open attendance register</Link>
            <Link to="/documents">Generate document</Link>
          </section>
        </>
      )}

      {activeTab === "fees" && (
        <section className="chart-card wide student-profile-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Fees</span>
              <h3>Tuition & Other Fee Plans</h3>
            </div>
            <strong>{formatCurrency(feeTotals.due)} total due</strong>
          </div>
          <div className="student-fee-summary">
            <strong>Total {formatCurrency(feeTotals.total)}</strong>
            <strong>Paid {formatCurrency(feeTotals.paid)}</strong>
            <strong>Due {formatCurrency(feeTotals.due)}</strong>
          </div>
          <DataTable
            empty="No fee plan created for this student."
            headers={["Academic Year", "Total", "Paid", "Due", "Action"]}
            rows={fees.map((fee) => [
              fee.academicYear,
              formatCurrency(fee.totalFee || 0),
              formatCurrency(fee.paidAmount || 0),
              formatCurrency(fee.dueAmount || 0),
              <Link className="table-action" to={`/fees/${student._id}/${fee.academicYear}`}>Open</Link>,
            ])}
          />
        </section>
      )}

      {activeTab === "transport" && (
        <section className="chart-card wide student-profile-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Transport</span>
              <h3>Bus Assignment & Fees</h3>
            </div>
            <Bus size={20} />
          </div>
          <DataTable
            empty={`No transport record for ${academicYear}.`}
            headers={["Vehicle", "Pickup", "Start Date", "Monthly", "Paid", "Due", "Status"]}
            rows={transportFees.map((fee) => [
              fee.vehicleNo || "-",
              fee.pickupPoint || "-",
              formatDate(fee.startDate),
              formatCurrency(fee.monthlyAmount || 0),
              formatCurrency(fee.paidAmount || 0),
              formatCurrency(fee.dueAmount || 0),
              fee.status || "-",
            ])}
          />
        </section>
      )}

      {activeTab === "records" && (
        <section className="student-profile-grid">
          <ProfileCard title="Academic Record" icon={GraduationCap} rows={[
            ["Current class", student.className],
            ["Section", student.section],
            ["Roll no.", student.rollNo],
            ["House", student.house],
            ["Attendance year", academicYear],
            ["Attendance", `${Number(attendance?.percentage || 0).toFixed(1)}%`],
          ]} />
          <ProfileCard title="Bank Details" icon={Banknote} rows={[
            ["Bank", student.bankName],
            ["Account No", student.accountNo],
            ["IFSC", student.ifscCode],
          ]} />
          <article className="student-detail-card wide">
            <div className="student-card-heading">
              <FileBadge size={20} />
              <h3>Documents</h3>
            </div>
            {(student.documents || []).length ? (
              <div className="student-document-list">
                {(student.documents || []).map((document) => (
                  <span key={document.url || document.name}>
                    {document.name || "Document"} {document.verified ? "(Verified)" : "(Pending)"}
                  </span>
                ))}
              </div>
            ) : (
              <p className="transport-muted">No documents uploaded.</p>
            )}
          </article>
          <article className="student-detail-card wide">
            <div className="student-card-heading">
              <GraduationCap size={20} />
              <h3>Academic History</h3>
            </div>
            <DataTable
              empty="No previous academic history saved."
              headers={["Academic Year", "Class", "Section", "Result", "Percentage"]}
              rows={(student.academicHistory || []).map((row) => [
                row.academicYear || "-",
                row.className || "-",
                row.section || "-",
                row.result || "-",
                row.percentage ? `${row.percentage}%` : "-",
              ])}
            />
          </article>
        </section>
      )}
    </div>
  );
}

function Metric({ detail, icon, label, value }) {
  return (
    <article className="metric-card">
      <div className="metric-icon">{createElement(icon, { size: 20 })}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function ProfileCard({ icon, rows, title }) {
  const Icon = icon;
  return (
    <article className="student-detail-card">
      <div className="student-card-heading">
        <Icon size={20} />
        <h3>{title}</h3>
      </div>
      <div>
        {rows.map(([label, value]) => (
          <p key={label}>
            <span>{label}</span>
            <strong>{value || "-"}</strong>
          </p>
        ))}
      </div>
    </article>
  );
}

function DataTable({ empty, headers, rows }) {
  return (
    <div className="responsive-table">
      <table>
        <thead>
          <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={headers.length}>{empty}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function formatDate(date) {
  if (!date) return "-";
  const next = new Date(date);
  if (Number.isNaN(next.getTime())) return "-";
  return next.toLocaleDateString("en-IN");
}

export default StudentProfilePage;
