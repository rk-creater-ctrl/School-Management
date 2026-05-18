import { createElement, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarCheck, CircleDollarSign, FileBadge, GraduationCap, UserRound } from "lucide-react";
import { attendanceAPI, feesAPI, studentsAPI } from "../api";
import { canUseRole, getStoredUser } from "../permissions";
import { formatCurrency } from "../utils/feeReports";

function StudentProfilePage() {
  const { id } = useParams();
  const user = getStoredUser();
  const [student, setStudent] = useState(null);
  const [fees, setFees] = useState([]);
  const [attendance, setAttendance] = useState(null);
  const [status, setStatus] = useState("Loading student...");

  useEffect(() => {
    async function loadStudentProfile() {
      try {
        const now = new Date();
        const startYear = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
        const [studentRes, feeRes, attendanceRes] = await Promise.all([
          studentsAPI.getById(id),
          feesAPI.getByStudent(id).catch(() => ({ data: [] })),
          attendanceAPI.getStudentYear(id, startYear).catch(() => ({ data: null })),
        ]);
        setStudent(studentRes.data);
        setFees(feeRes.data || []);
        setAttendance(attendanceRes.data);
        setStatus("");
      } catch {
        setStatus("Unable to load student profile.");
      }
    }

    loadStudentProfile();
  }, [id]);

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

  if (status) return <div className="inline-alert">{status}</div>;
  if (!student) return <div className="empty-state">Student not found.</div>;

  return (
    <div className="student-profile-page">
      <section className="student-profile-header">
        <div className="student-photo"><UserRound size={40} /></div>
        <div>
          <span className="eyebrow">Student</span>
          <h2>{student.name}</h2>
          <p>{student.className} | Admission {student.admissionNo}</p>
        </div>
        <div className="student-profile-actions">
          {canUseRole(["superadmin"], user) && <Link className="secondary-button" to={`/students/${student._id}/edit`}>Edit</Link>}
          <Link className="secondary-button" to={`/attendance/${student._id}`}>Attendance</Link>
          {canUseRole(["superadmin", "accountant", "parent"], user) && <Link className="primary-button" to={`/fees/${student._id}/2024-2025`}>Fees</Link>}
        </div>
      </section>

      <section className="stats-grid compact">
        <Metric icon={GraduationCap} label="Class" value={student.className || "-"} />
        <Metric icon={CalendarCheck} label="Attendance" value={`${Number(attendance?.percentage || 0).toFixed(1)}%`} />
        <Metric icon={CircleDollarSign} label="Fee Due" value={formatCurrency(feeTotals.due)} />
        <Metric icon={FileBadge} label="Student Code" value={student.studentCode || "-"} />
      </section>

      <section className="student-profile-grid">
        <ProfileCard title="Basic Details" rows={[
          ["Name", student.name],
          ["Admission No", student.admissionNo],
          ["Student Code", student.studentCode],
          ["Gender", student.gender],
          ["DOB", student.dob ? new Date(student.dob).toLocaleDateString("en-IN") : ""],
          ["Category", student.category],
        ]} />
        <ProfileCard title="Parents & Contact" rows={[
          ["Father", student.fatherName],
          ["Mother", student.motherName],
          ["Mobile", student.mobileNo || student.mobile],
          ["Email", student.email],
          ["Address", student.address],
        ]} />
        <ProfileCard title="Government IDs" rows={[
          ["Aadhar", student.aadharNo],
          ["Child ID", student.childId],
          ["Family ID", student.familyId],
          ["UDISE PEN", student.udisePenNo],
          ["APAAR", student.apaarId],
        ]} />
        <ProfileCard title="Bank Details" rows={[
          ["Bank", student.bankName],
          ["Account No", student.accountNo],
          ["IFSC", student.ifscCode],
        ]} />
      </section>

      {canUseRole(["superadmin", "accountant", "parent"], user) && (
        <section className="chart-card wide">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Fees</span>
              <h3>Summary</h3>
            </div>
          </div>
          <div className="student-fee-summary">
            <strong>Total {formatCurrency(feeTotals.total)}</strong>
            <strong>Paid {formatCurrency(feeTotals.paid)}</strong>
            <strong>Due {formatCurrency(feeTotals.due)}</strong>
          </div>
        </section>
      )}
    </div>
  );
}

function Metric({ icon, label, value }) {
  return (
    <article className="metric-card">
      <div className="metric-icon">{createElement(icon, { size: 20 })}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function ProfileCard({ title, rows }) {
  return (
    <article className="student-detail-card">
      <h3>{title}</h3>
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

export default StudentProfilePage;
