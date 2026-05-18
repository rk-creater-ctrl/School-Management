import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Download, ReceiptText } from "lucide-react";
import { Link } from "react-router-dom";
import { feesAPI } from "../api";
import { createCollectionSummary, extractFeeLedgerRows, formatCurrency, getPaidFeeRows } from "../utils/feeReports";

const tabs = [
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
];

function FeeCollectionsPage() {
  const [fees, setFees] = useState([]);
  const [activeTab, setActiveTab] = useState("weekly");
  const [status, setStatus] = useState("Loading collections...");

  useEffect(() => {
    feesAPI
      .getAll()
      .then((res) => {
        setFees(res.data || []);
        setStatus("");
      })
      .catch(() => setStatus("Collection data unavailable."));
  }, []);

  const ledgerRows = useMemo(() => extractFeeLedgerRows(fees), [fees]);
  const paidRows = useMemo(() => getPaidFeeRows(fees), [fees]);
  const summary = useMemo(() => createCollectionSummary(ledgerRows), [ledgerRows]);
  const activeRows = summary[activeTab] || [];
  const totalCollection = paidRows.reduce((sum, row) => sum + row.amount, 0);

  function exportCollections() {
    const rows = [
      ["Receipt No", "Student", "Class", "Academic Year", "Fee", "Period", "Amount", "Paid Date"],
      ...paidRows.map((row) => [
        row.receiptNo,
        row.studentName || "",
        row.className || "",
        row.academicYear || "",
        row.label || "",
        row.period || "",
        row.amount,
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
        </div>
        <div className="module-actions">
          <button className="secondary-button" onClick={exportCollections}><Download size={18} /> Export CSV</button>
        </div>
      </section>

      {status && <div className="inline-alert">{status}</div>}

      <section className="stats-grid compact">
        <article className="metric-card">
          <div className="metric-icon"><ReceiptText size={20} /></div>
          <span>Total Collection</span>
          <strong>{formatCurrency(totalCollection)}</strong>
          <small>{paidRows.length} paid entries</small>
        </article>
        <article className="metric-card">
          <div className="metric-icon"><CalendarDays size={20} /></div>
          <span>This Month</span>
          <strong>{formatCurrency(currentMonthCollection(paidRows))}</strong>
          <small>Current calendar month</small>
        </article>
      </section>

      <section className="chart-card wide">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Collection</span>
            <h3>{tabs.find((tab) => tab.id === activeTab)?.label}</h3>
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
            <h3>Paid Entries</h3>
          </div>
        </div>
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Student</th>
                <th>Class</th>
                <th>Fee</th>
                <th>Period</th>
                <th>Amount</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {paidRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.receiptNo}</td>
                  <td>
                    <Link to={`/fees/${row.studentId}/${row.academicYear}`}>{row.studentName || "-"}</Link>
                  </td>
                  <td>{row.className || "-"}</td>
                  <td>{row.label}</td>
                  <td>{row.period}</td>
                  <td>{formatCurrency(row.amount)}</td>
                  <td>{new Date(row.paidDate).toLocaleDateString("en-IN")}</td>
                </tr>
              ))}
              {paidRows.length === 0 && (
                <tr>
                  <td colSpan="7">No paid fee entries.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
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
