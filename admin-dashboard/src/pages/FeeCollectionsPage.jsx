import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Download, ReceiptText } from "lucide-react";
import { Link } from "react-router-dom";
import { feesAPI, transportAPI } from "../api";
import {
  createCollectionSummary,
  extractFeeLedgerRows,
  extractTransportLedgerRows,
  formatCurrency,
  getPaidFeeRows,
  getPaidTransportRows,
} from "../utils/feeReports";

const tabs = [
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
];

const collectionTypes = [
  { id: "total", label: "Total Collection" },
  { id: "tuition", label: "Tuition Fees" },
  { id: "transport", label: "Transport Collection" },
];

function FeeCollectionsPage() {
  const [fees, setFees] = useState([]);
  const [transportFees, setTransportFees] = useState([]);
  const [activeTab, setActiveTab] = useState("weekly");
  const [collectionType, setCollectionType] = useState("total");
  const [status, setStatus] = useState("Loading collections...");

  useEffect(() => {
    Promise.all([feesAPI.getAll(), transportAPI.getFees()])
      .then(([feeRes, transportRes]) => {
        setFees(feeRes.data || []);
        setTransportFees(transportRes.data || []);
        setStatus("");
      })
      .catch(() => setStatus("Collection data unavailable."));
  }, []);

  const ledgerRows = useMemo(() => extractFeeLedgerRows(fees), [fees]);
  const transportLedgerRows = useMemo(() => extractTransportLedgerRows(transportFees), [transportFees]);
  const paidRows = useMemo(() => getPaidFeeRows(fees), [fees]);
  const paidTransportRows = useMemo(() => getPaidTransportRows(transportFees), [transportFees]);
  const combinedPaidRows = useMemo(
    () => [...paidRows, ...paidTransportRows].sort((a, b) => new Date(b.paidDate) - new Date(a.paidDate)),
    [paidRows, paidTransportRows]
  );
  const combinedLedgerRows = useMemo(
    () => [...ledgerRows, ...transportLedgerRows],
    [ledgerRows, transportLedgerRows]
  );
  const filteredLedgerRows = useMemo(
    () => filterRowsByCollectionType(combinedLedgerRows, collectionType),
    [combinedLedgerRows, collectionType]
  );
  const filteredPaidRows = useMemo(
    () => filterRowsByCollectionType(combinedPaidRows, collectionType),
    [combinedPaidRows, collectionType]
  );
  const summary = useMemo(() => createCollectionSummary(filteredLedgerRows), [filteredLedgerRows]);
  const activeRows = summary[activeTab] || [];
  const totalCollection = combinedPaidRows.reduce((sum, row) => sum + row.amount, 0);
  const tuitionCollection = paidRows.filter((row) => row.source === "Tuition").reduce((sum, row) => sum + row.amount, 0);
  const transportCollection = paidTransportRows.reduce((sum, row) => sum + row.amount, 0);

  function exportCollections() {
    const rows = [
      ["Receipt No", "Source", "Student", "Class", "Academic Year", "Fee", "Period", "Base Amount", "Concession", "Late Fee", "Amount", "Payment Mode", "Paid Date"],
      ...filteredPaidRows.map((row) => [
        row.receiptNo,
        row.source || "",
        row.studentName || "",
        row.className || "",
        row.academicYear || "",
        row.label || "",
        row.period || "",
        row.baseAmount || row.amount,
        row.concessionAmount || 0,
        row.lateFeeAmount || 0,
        row.amount,
        row.paymentMode || "",
        row.paidDate ? new Date(row.paidDate).toLocaleDateString("en-IN") : "",
      ]),
    ];
    downloadCsv("fee-collections.csv", rows);
  }

  return (
    <div className="collections-page">
      <section className="module-hero">
        <div>
          <span className="eyebrow">Fees</span>
          <h2>Collection Reports</h2>
          <p>Track total, tuition, and transport collections by week, month, and year.</p>
        </div>
        <div className="module-actions">
          <button className="secondary-button" onClick={exportCollections}><Download size={18} /> Export CSV</button>
        </div>
      </section>

      {status && <div className="inline-alert">{status}</div>}

      <section className="stats-grid compact collection-summary-grid">
        <article className="metric-card">
          <div className="metric-icon"><ReceiptText size={20} /></div>
          <span>Total Collection</span>
          <strong>{formatCurrency(totalCollection)}</strong>
          <small>{combinedPaidRows.length} paid entries</small>
        </article>
        <article className="metric-card">
          <div className="metric-icon"><ReceiptText size={20} /></div>
          <span>Tuition Fees</span>
          <strong>{formatCurrency(tuitionCollection)}</strong>
          <small>{paidRows.filter((row) => row.source === "Tuition").length} tuition payments</small>
        </article>
        <article className="metric-card">
          <div className="metric-icon"><ReceiptText size={20} /></div>
          <span>Transport Collection</span>
          <strong>{formatCurrency(transportCollection)}</strong>
          <small>{paidTransportRows.length} transport payments</small>
        </article>
        <article className="metric-card">
          <div className="metric-icon"><CalendarDays size={20} /></div>
          <span>This Month</span>
          <strong>{formatCurrency(currentMonthCollection(combinedPaidRows))}</strong>
          <small>Current calendar month</small>
        </article>
      </section>

      <section className="chart-card wide">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Collection</span>
            <h3>{collectionTypes.find((item) => item.id === collectionType)?.label} - {tabs.find((tab) => tab.id === activeTab)?.label}</h3>
          </div>
          <div className="report-tabs collection-type-tabs">
            {collectionTypes.map((item) => (
              <button className={collectionType === item.id ? "active" : ""} key={item.id} onClick={() => setCollectionType(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
          <div className="report-tabs">
            {tabs.map((tab) => (
              <button className={activeTab === tab.id ? "active" : ""} key={tab.id} onClick={() => setActiveTab(tab.id)}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="collection-grid">
          {activeRows.map((row) => (
            <article className="collection-card" key={row.label}>
              <span>{row.label}</span>
              <strong>{formatCurrency(row.amount)}</strong>
              <small>{row.count} payments</small>
            </article>
          ))}
          {activeRows.length === 0 && <div className="empty-state">No collection entries.</div>}
        </div>
      </section>

      <section className="chart-card wide">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Ledger</span>
            <h3>{collectionTypes.find((item) => item.id === collectionType)?.label} Paid Entries</h3>
          </div>
        </div>
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Source</th>
                <th>Student</th>
                <th>Class</th>
                <th>Fee</th>
                <th>Period</th>
                <th>Base</th>
                <th>Concession</th>
                <th>Late Fee</th>
                <th>Amount</th>
                <th>Mode</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredPaidRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.receiptNo}</td>
                  <td>{row.source}</td>
                  <td>
                    {row.source === "Transport" ? (
                      <Link to={`/modules/transport/vehicles/${row.vehicleId}/students/${row.studentId}?year=${encodeURIComponent(row.academicYear)}`}>
                        {row.studentName || "-"}
                      </Link>
                    ) : (
                      <Link to={`/fees/${row.studentId}/${row.academicYear}`}>{row.studentName || "-"}</Link>
                    )}
                  </td>
                  <td>{row.className || "-"}</td>
                  <td>{row.label}</td>
                  <td>{row.period}</td>
                  <td>{formatCurrency(row.baseAmount || row.amount)}</td>
                  <td>{row.concessionAmount ? formatCurrency(row.concessionAmount) : "-"}</td>
                  <td>{row.lateFeeAmount ? formatCurrency(row.lateFeeAmount) : "-"}</td>
                  <td>{formatCurrency(row.amount)}</td>
                  <td>{row.paymentMode || "-"}</td>
                  <td>{new Date(row.paidDate).toLocaleDateString("en-IN")}</td>
                </tr>
              ))}
              {filteredPaidRows.length === 0 && (
                <tr>
                  <td colSpan="12">No paid fee entries.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function filterRowsByCollectionType(rows, collectionType) {
  if (collectionType === "tuition") return rows.filter((row) => row.source === "Tuition");
  if (collectionType === "transport") return rows.filter((row) => row.source === "Transport");
  return rows;
}

function currentMonthCollection(rows) {
  const now = new Date();
  return rows.reduce((sum, row) => {
    const date = new Date(row.paidDate);
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
      ? sum + row.amount
      : sum;
  }, 0);
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default FeeCollectionsPage;
