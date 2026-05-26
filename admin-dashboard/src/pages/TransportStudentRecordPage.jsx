import { createElement, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Bus, CalendarDays, CheckCircle2, CircleDollarSign, ReceiptText } from "lucide-react";
import { transportAPI } from "../api";
import AcademicYearSelect from "../components/AcademicYearSelect";
import { extractTransportLedgerRows, formatCurrency, getPaidTransportRows } from "../utils/feeReports";
import { getCurrentAcademicYear } from "../utils/transport";

function TransportStudentRecordPage() {
  const { vehicleId, studentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [academicYear, setAcademicYear] = useState(searchParams.get("year") || getCurrentAcademicYear());
  const [detail, setDetail] = useState(null);
  const [status, setStatus] = useState("Loading transport record...");

  const loadRecord = useCallback(async () => {
    try {
      setStatus("Loading transport record...");
      const res = await transportAPI.getVehicle(vehicleId, { academicYear });
      setDetail(res.data);
      setStatus("");
    } catch (error) {
      setStatus(error.response?.data?.error || "Unable to load transport record.");
    }
  }, [academicYear, vehicleId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRecord();
  }, [loadRecord]);

  function changeAcademicYear(value) {
    setAcademicYear(value);
    setSearchParams({ year: value });
  }

  const assignment = useMemo(
    () => (detail?.vehicle?.students || []).find((entry) => String(entry.student?._id || entry.student) === String(studentId)),
    [detail, studentId]
  );
  const fee = useMemo(
    () => (detail?.fees || []).find((item) => String(item.student) === String(studentId)) || null,
    [detail, studentId]
  );
  const ledgerRows = useMemo(() => extractTransportLedgerRows(fee), [fee]);
  const paidRows = useMemo(() => getPaidTransportRows(fee), [fee]);
  const startDate = fee?.startDate || assignment?.joinedAt;
  const usage = getTransportUsage(startDate, fee?.months || [], fee?.academicYear || academicYear);
  const totalPaid = paidRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const student = assignment?.student;

  return (
    <div className="transport-page transport-student-record-page">
      <section className="module-hero transport-hero">
        <div>
          <span className="eyebrow">Transport Student Record</span>
          <h2>{student?.name || fee?.studentName || "Student"}</h2>
          <p>{detail?.vehicle?.vehicleNo || fee?.vehicleNo || "Vehicle"} transport usage, payment history, and pending dues.</p>
        </div>
        <AcademicYearSelect className="transport-year-field" value={academicYear} onChange={changeAcademicYear} />
      </section>

      <button className="secondary-button transport-back-button" type="button" onClick={() => navigate(`/modules/transport/vehicles/${vehicleId}`)}>
        <ArrowLeft size={17} /> Back to Vehicle
      </button>

      {status && <div className="inline-alert">{status}</div>}

      {!status && !assignment && (
        <div className="empty-state">This student is not assigned to this vehicle for {academicYear}.</div>
      )}

      {assignment && (
        <>
          <section className="stats-grid compact">
            <MetricCard icon={CalendarDays} label="Started On" value={formatDate(startDate)} detail={`${usage.days} transport days`} />
            <MetricCard icon={Bus} label="Months Taken" value={usage.months} detail="Chargeable transport months" />
            <MetricCard icon={CheckCircle2} label="Total Paid" value={formatCurrency(totalPaid)} detail={`${paidRows.length} paid months`} />
            <MetricCard icon={CircleDollarSign} label="Due" value={formatCurrency(fee?.dueAmount || 0)} detail={fee?.status || assignment.status || "Active"} />
          </section>

          <section className="transport-record-grid">
            <article className="chart-card transport-record-card">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Student</span>
                  <h3>Transport Assignment</h3>
                </div>
              </div>
              <div className="transport-info-grid">
                <Info label="Student name" value={student?.name || fee?.studentName || "-"} />
                <Info label="Admission no." value={student?.admissionNo || fee?.admissionNo || "-"} />
                <Info label="Class" value={student?.className || fee?.className || "-"} />
                <Info label="Vehicle no." value={detail?.vehicle?.vehicleNo || fee?.vehicleNo || "-"} />
                <Info label="Pickup / Area" value={assignment.pickupPoint || fee?.pickupPoint || "-"} />
                <Info label="Monthly fee" value={formatCurrency(assignment.monthlyFee || fee?.monthlyAmount || 0)} />
                <Info label="Start date" value={formatDate(startDate)} />
                <Info label="Status" value={fee?.status || assignment.status || "Active"} />
              </div>
            </article>

            <article className="chart-card transport-record-card">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Payments</span>
                  <h3>Payment Summary</h3>
                </div>
              </div>
              <div className="transport-info-grid">
                <Info label="Total fee" value={formatCurrency(fee?.totalFee || 0)} />
                <Info label="Total paid" value={formatCurrency(totalPaid)} />
                <Info label="Pending due" value={formatCurrency(fee?.dueAmount || 0)} />
                <Info label="Last paid on" value={paidRows[0]?.paidDate ? formatDate(paidRows[0].paidDate) : "-"} />
              </div>
            </article>
          </section>

          <section className="chart-card transport-record-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Payment History</span>
                <h3>Paid Records</h3>
              </div>
              <ReceiptText size={18} />
            </div>
            <div className="responsive-table">
              <table>
                <thead>
                  <tr>
                    <th>Receipt</th>
                    <th>Month</th>
                    <th>Base</th>
                    <th>Late Fee</th>
                    <th>Paid Amount</th>
                    <th>Paid Date</th>
                  </tr>
                </thead>
                <tbody>
                  {paidRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.receiptNo}</td>
                      <td>{row.period}</td>
                      <td>{formatCurrency(row.baseAmount)}</td>
                      <td>{row.lateFeeAmount ? formatCurrency(row.lateFeeAmount) : "-"}</td>
                      <td>{formatCurrency(row.amount)}</td>
                      <td>{formatDate(row.paidDate)}</td>
                    </tr>
                  ))}
                  {paidRows.length === 0 && (
                    <tr>
                      <td colSpan="6">No paid transport months yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="chart-card transport-record-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Fee Structure</span>
                <h3>All Chargeable Months</h3>
              </div>
              <Link className="secondary-button" to={`/modules/transport/vehicles/${vehicleId}`}>
                Open Vehicle Fees
              </Link>
            </div>
            <div className="responsive-table">
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Base</th>
                    <th>Late Fee</th>
                    <th>Payable</th>
                    <th>Status</th>
                    <th>Paid Date</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.period}</td>
                      <td>{formatCurrency(row.baseAmount)}</td>
                      <td>{row.lateFeeAmount ? formatCurrency(row.lateFeeAmount) : "-"}</td>
                      <td>{formatCurrency(row.amount)}</td>
                      <td><span className={`transport-status status-${String(row.status).toLowerCase()}`}>{row.status}</span></td>
                      <td>{row.paidDate ? formatDate(row.paidDate) : "-"}</td>
                    </tr>
                  ))}
                  {ledgerRows.length === 0 && (
                    <tr>
                      <td colSpan="6">No transport fee months created.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function MetricCard({ detail, icon, label, value }) {
  return (
    <article className="metric-card">
      <div className="metric-icon">{createElement(icon, { size: 20 })}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function Info({ label, value }) {
  return (
    <div className="transport-info-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const TRANSPORT_MONTHS = [
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
];
const TRANSPORT_MONTH_INDEX = TRANSPORT_MONTHS.reduce((map, month, index) => ({ ...map, [month]: index }), {});
const CALENDAR_MONTH_INDEX = {
  April: 3,
  May: 4,
  June: 5,
  July: 6,
  August: 7,
  September: 8,
  October: 9,
  November: 10,
  December: 11,
  January: 0,
  February: 1,
  March: 2,
};

function getTransportUsage(startDate, months, academicYear) {
  const start = normalizeDate(startDate);
  const now = normalizeDate(new Date());
  const days = start && !Number.isNaN(start.getTime())
    ? Math.max(0, Math.ceil((now - start) / (24 * 60 * 60 * 1000)) + 1)
    : 0;
  const monthsTaken = start && start <= now
    ? (months || []).filter((month) => getMonthDateRange(month.name, academicYear).from <= now).length
    : 0;

  return {
    days,
    months: monthsTaken,
  };
}

function formatDate(date) {
  if (!date) return "-";
  const next = new Date(date);
  if (Number.isNaN(next.getTime())) return "-";
  return next.toLocaleDateString("en-IN");
}

function normalizeDate(date) {
  if (!date) return null;
  const next = new Date(date);
  if (Number.isNaN(next.getTime())) return null;
  next.setHours(0, 0, 0, 0);
  return next;
}

function getMonthDateRange(monthName, academicYear) {
  const monthIndex = TRANSPORT_MONTH_INDEX[monthName] ?? 0;
  const { startYear, endYear } = getAcademicYearParts(academicYear);
  const calendarYear = monthIndex <= 8 ? startYear : endYear;
  const calendarMonth = CALENDAR_MONTH_INDEX[monthName] ?? 0;

  return {
    from: new Date(calendarYear, calendarMonth, 1),
    to: new Date(calendarYear, calendarMonth + 1, 0),
  };
}

function getAcademicYearParts(academicYear) {
  const parts = String(academicYear || "").match(/\d{4}/g) || [];
  const startYear = Number(parts[0]) || new Date().getFullYear();
  const endYear = Number(parts[1]) || startYear + 1;
  return { startYear, endYear };
}

export default TransportStudentRecordPage;
