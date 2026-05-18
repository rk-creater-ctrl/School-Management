import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { feesAPI, studentsAPI } from "../api";
import { extractFeeLedgerRows, formatCurrency } from "../utils/feeReports";
import { requireSuperadminPassword } from "../utils/superadminGuard";
import { getStoredUser } from "../permissions";

const paymentModes = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

const quarterGroups = [
  ["April", "May", "June"],
  ["July", "August", "September"],
  ["October", "November", "December"],
  ["January", "February", "March"],
];

function FeeDetailPage() {
  const { studentId, year } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const isSuperadmin = getStoredUser()?.role === "superadmin";

  const [student, setStudent] = useState(null);
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // For creating tuition plan
  const [monthlyAmount, setMonthlyAmount] = useState("");

  // For adding other fees
  const [otherLabel, setOtherLabel] = useState("");
  const [otherType, setOtherType] = useState("EXAM");
  const [otherAmount, setOtherAmount] = useState("");

  // Local state for date picker popups
  const [activeMonthPick, setActiveMonthPick] = useState(null); // { itemId, monthName }
  const [activeItemPick, setActiveItemPick] = useState(null); // itemId
  const [activeGroupPick, setActiveGroupPick] = useState(null);
  const [selectedDate, setSelectedDate] = useState(""); // YYYY-MM-DD
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [paymentMode, setPaymentMode] = useState(() => {
    const mode = searchParams.get("mode");
    return ["monthly", "quarterly", "yearly"].includes(mode) ? mode : "monthly";
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [studentRes, planRes] = await Promise.all([
        studentsAPI.getAll(),
        feesAPI
          .getForStudentYear(studentId, year)
          .catch((err) =>
            err.response?.status === 404 ? null : Promise.reject(err)
          ),
      ]);

      const s =
        (studentRes.data || []).find((x) => x._id === studentId) || null;
      setStudent(s);
      setPlan(planRes?.data || null);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to load fee detail");
    } finally {
      setLoading(false);
    }
  }, [studentId, year]);

  useEffect(() => {
    // Existing page pattern: load remote fee data when the route changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  const tuitionItem =
    plan?.items?.find((i) => i.type === "TUITION" && i.mode === "MONTHLY") ||
    null;
  const otherItems = plan?.items?.filter((i) => i.mode === "ONE_TIME") || [];
  const ledgerRows = useMemo(() => extractFeeLedgerRows(plan), [plan]);

  async function handleCreateTuition(e) {
    e.preventDefault();
    const allowed = await requireSuperadminPassword("create tuition plan");
    if (!allowed) return;
    if (!monthlyAmount) {
      alert("Monthly amount is required");
      return;
    }
    try {
      await feesAPI.createTuition({
        studentId,
        academicYear: year,
        monthlyAmount: Number(monthlyAmount),
      });
      setMonthlyAmount("");
      await loadData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Failed to create tuition plan");
    }
  }

  async function handleAddOtherFee(e) {
    e.preventDefault();
    const allowed = await requireSuperadminPassword("add fee item");
    if (!allowed) return;
    if (!otherLabel || !otherAmount) {
      alert("Label and amount are required");
      return;
    }
    try {
      await feesAPI.addItem({
        studentId,
        academicYear: year,
        label: otherLabel,
        type: otherType,
        amount: Number(otherAmount),
      });
      setOtherLabel("");
      setOtherType("EXAM");
      setOtherAmount("");
      await loadData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Failed to add fee item");
    }
  }

  async function toggleMonthPaid(itemId, monthName, currentStatus, paidDate) {
    try {
      await feesAPI.toggleMonth(plan._id, itemId, monthName, paidDate || null);
      await loadData();
    } catch (err) {
      console.error(err);
      alert("Failed to update month status");
    }
  }

  async function toggleItemPaid(itemId, currentStatus, paidDate) {
    try {
      await feesAPI.toggleItem(plan._id, itemId, paidDate || null);
      await loadData();
    } catch (err) {
      console.error(err);
      alert("Failed to update fee item");
    }
  }

  async function handleToggleMonth(itemId, monthName, currentStatus) {
    if (currentStatus === "Paid") {
      const allowed = await requireSuperadminPassword("mark fee pending");
      if (!allowed) return;
      // Directly mark Pending
      await toggleMonthPaid(itemId, monthName, currentStatus, null);
      return;
    }

    // Check previous months first
    if (tuitionItem) {
      const months = tuitionItem.months;
      const index = months.findIndex((m) => m.name === monthName);

      if (index > 0) {
        const unpaidPrev = months
          .slice(0, index)
          .filter((m) => m.status !== "Paid");

        if (unpaidPrev.length > 0) {
          alert(
            `Previous months are not fully paid:\n` +
              unpaidPrev.map((m) => `- ${m.name}`).join("\n")
          );
          return;
        }
      }
    }

    // Open date picker UI under this button
    setActiveItemPick(null);
    setActiveMonthPick({ itemId, monthName });
    setSelectedDate("");
  }

  async function handleToggleItem(itemId, currentStatus) {
    if (currentStatus === "Paid") {
      const allowed = await requireSuperadminPassword("mark fee item pending");
      if (!allowed) return;
      // Directly mark Pending
      await toggleItemPaid(itemId, currentStatus, null);
      return;
    }

    // Open date picker for one-time item
    setActiveMonthPick(null);
    setActiveItemPick(itemId);
    setSelectedDate("");
  }

  async function confirmMonthDate() {
    if (!activeMonthPick) return;
    const allowed = await requireSuperadminPassword("record fee payment");
    if (!allowed) return;
    const { itemId, monthName } = activeMonthPick;
    await toggleMonthPaid(itemId, monthName, "Pending", selectedDate || null);
    setActiveMonthPick(null);
    setSelectedDate("");
  }

  async function confirmItemDate() {
    if (!activeItemPick) return;
    const allowed = await requireSuperadminPassword("record fee payment");
    if (!allowed) return;
    await toggleItemPaid(activeItemPick, "Pending", selectedDate || null);
    setActiveItemPick(null);
    setSelectedDate("");
  }

  function changePaymentMode(nextMode) {
    setPaymentMode(nextMode);
    setSearchParams({ mode: nextMode });
    setActiveGroupPick(null);
    setActiveMonthPick(null);
    setSelectedDate("");
  }

  async function applyGroupPayment(group, paidDate) {
    if (!tuitionItem || !plan) return;
    const shouldMarkPaid = group.status !== "Paid";
    const monthsToToggle = group.months.filter((month) =>
      shouldMarkPaid ? month.status !== "Paid" : month.status === "Paid"
    );

    for (const month of monthsToToggle) {
      await feesAPI.toggleMonth(plan._id, tuitionItem._id, month.name, paidDate || null);
    }

    await loadData();
  }

  async function handleGroupPayment(group) {
    setActiveMonthPick(null);
    setActiveItemPick(null);

    if (group.status === "Paid") {
      const allowed = await requireSuperadminPassword("mark fee group pending");
      if (!allowed) return;
      await applyGroupPayment(group, null);
      return;
    }

    setActiveGroupPick(group);
    setSelectedDate("");
  }

  async function confirmGroupDate() {
    if (!activeGroupPick) return;
    const allowed = await requireSuperadminPassword("record fee payment");
    if (!allowed) return;
    await applyGroupPayment(activeGroupPick, selectedDate || null);
    setActiveGroupPick(null);
    setSelectedDate("");
  }

  async function handleDeletePlan() {
    if (!plan) return;
    const allowed = await requireSuperadminPassword("delete this fee plan");
    if (!allowed) return;
    try {
      await feesAPI.removePlan(plan._id);
      window.location.href = "/fees";
    } catch (err) {
      console.error(err);
      alert("Failed to delete fee plan");
    }
  }

  if (loading) {
    return (
      <div>
        <Link to="/fees" style={{ fontSize: "13px" }}>
          ← Back to fees
        </Link>
        <div style={{ padding: "24px", textAlign: "center" }}>Loading...</div>
      </div>
    );
  }

  return (
    <>
      <div style={{ marginBottom: "16px" }}>
        <Link to="/fees" style={{ fontSize: "13px", color: "#2563eb" }}>
          ← Back to fees
        </Link>
      </div>

      {error && (
        <div
          style={{
            padding: "12px 16px",
            marginBottom: "16px",
            borderRadius: "8px",
            background: "#fef2f2",
            color: "#b91c1c",
            border: "1px solid #fecaca",
            fontSize: "14px",
          }}
        >
          {error}
        </div>
      )}

      <header style={{ marginBottom: "16px" }}>
        <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700 }}>
          Fee Structure
        </h1>
        {student && (
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "14px" }}>
            {student.name} • {student.className} • {student.admissionNo} •{" "}
            {year}
          </p>
        )}
      </header>

      {plan && (
        <section
          style={{
            marginBottom: "20px",
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            alignItems: "flex-end",
          }}
        >
          <SummaryCard label="Total Fee" value={`₹${plan.totalFee}`} />
          <SummaryCard label="Paid" value={`₹${plan.paidAmount}`} />
          <SummaryCard
            label="Due"
            value={`₹${plan.dueAmount}`}
            highlight={plan.dueAmount > 0}
          />
          {isSuperadmin && <div>
            <button
              onClick={handleDeletePlan}
              style={{
                background: "#ef4444",
                border: "none",
                color: "white",
                padding: "8px 16px",
                borderRadius: "999px",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              Delete Plan
            </button>
          </div>}
        </section>
      )}

      {/* Tuition section */}
      <section style={{ marginBottom: "24px" }}>
        <h2
          style={{
            margin: "0 0 12px",
            fontSize: "18px",
            fontWeight: 600,
          }}
        >
          Tuition
        </h2>

        {!tuitionItem ? (
          isSuperadmin ? (
          <form
            onSubmit={handleCreateTuition}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px",
              alignItems: "flex-end",
            }}
          >
            <Input
              label="Monthly Amount (Rs.)"
              type="number"
              value={monthlyAmount}
              onChange={(e) => setMonthlyAmount(e.target.value)}
            />
            <button
              type="submit"
              style={{
                background: "#2563eb",
                border: "none",
                color: "white",
                padding: "10px 18px",
                borderRadius: "999px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Create tuition plan
            </button>
          </form>
          ) : (
            <div className="empty-state">Tuition plan not created.</div>
          )
        ) : (
          <>
            <PaymentModeSelector mode={paymentMode} onChange={changePaymentMode} />
            <PaymentSchedule
              activeGroupPick={activeGroupPick}
              mode={paymentMode}
              onCancel={() => {
                setActiveGroupPick(null);
                setSelectedDate("");
              }}
              onConfirm={confirmGroupDate}
              onPay={handleGroupPayment}
              canPay={isSuperadmin}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              tuitionItem={tuitionItem}
            />
            {paymentMode === "monthly" && (
          <div
            style={{
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              overflow: "auto",
              background: "white",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "13px",
              }}
            >
              <thead style={{ background: "#f9fafb" }}>
                <tr>
                  <Th>Month</Th>
                  <Th>Amount</Th>
                  <Th>Status</Th>
                  <Th>Paid Date</Th>
                  <Th>Action</Th>
                </tr>
              </thead>
              <tbody>
                {tuitionItem.months.map((m) => {
                  const isActive =
                    activeMonthPick &&
                    activeMonthPick.itemId === tuitionItem._id &&
                    activeMonthPick.monthName === m.name;

                  return (
                    <tr key={m.name}>
                      <Td>{m.name}</Td>
                      <Td>₹{m.amount}</Td>
                      <Td
                        style={{
                          color:
                            m.status === "Paid" ? "#16a34a" : "#b91c1c",
                          fontWeight: 600,
                        }}
                      >
                        {m.status}
                      </Td>
                      <Td>
                        {m.paidDate
                          ? new Date(m.paidDate).toLocaleDateString("en-IN")
                          : "-"}
                      </Td>
                      <Td>
                        <div style={{ position: "relative" }}>
                          {isSuperadmin ? <button
                            style={{
                              background:
                                m.status === "Paid" ? "#e5e7eb" : "#16a34a",
                              border: "none",
                              padding: "4px 10px",
                              borderRadius: "999px",
                              cursor: "pointer",
                              color:
                                m.status === "Paid" ? "#111827" : "white",
                              fontSize: "12px",
                            }}
                            onClick={() =>
                              handleToggleMonth(
                                tuitionItem._id,
                                m.name,
                                m.status
                              )
                            }
                          >
                            {m.status === "Paid"
                              ? "Mark Pending"
                              : "Mark Paid"}
                          </button> : "-"}

                          {/* Date picker popup */}
                          {isActive && (
                            <div
                              style={{
                                position: "absolute",
                                top: "110%",
                                left: 0,
                                zIndex: 10,
                                background: "white",
                                border: "1px solid #e5e7eb",
                                borderRadius: "8px",
                                padding: "8px",
                                boxShadow:
                                  "0 10px 15px -3px rgba(0,0,0,0.1)",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "11px",
                                  marginBottom: "4px",
                                  color: "#4b5563",
                                }}
                              >
                                Select payment date
                              </div>
                              <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) =>
                                  setSelectedDate(e.target.value)
                                }
                                style={{
                                  padding: "4px 6px",
                                  borderRadius: "6px",
                                  border: "1px solid #d1d5db",
                                  fontSize: "12px",
                                }}
                              />
                              <div
                                style={{
                                  marginTop: "6px",
                                  display: "flex",
                                  gap: "6px",
                                  justifyContent: "flex-end",
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMonthPick(null);
                                    setSelectedDate("");
                                  }}
                                  style={{
                                    background: "#e5e7eb",
                                    border: "none",
                                    padding: "3px 8px",
                                    borderRadius: "999px",
                                    fontSize: "11px",
                                    cursor: "pointer",
                                  }}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={confirmMonthDate}
                                  style={{
                                    background: "#2563eb",
                                    border: "none",
                                    color: "white",
                                    padding: "3px 8px",
                                    borderRadius: "999px",
                                    fontSize: "11px",
                                    cursor: "pointer",
                                  }}
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
            )}
          </>
        )}
      </section>

      {/* Other fees section */}
      <section>
        <h2
          style={{
            margin: "0 0 12px",
            fontSize: "18px",
            fontWeight: 600,
          }}
        >
          Other Fees (Exam / Activity / Others)
        </h2>

        {isSuperadmin && <form
          onSubmit={handleAddOtherFee}
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <Input
            label="Fee Name"
            value={otherLabel}
            onChange={(e) => setOtherLabel(e.target.value)}
          />
          <Select
            label="Type"
            value={otherType}
            onChange={(e) => setOtherType(e.target.value)}
            options={[
              { value: "EXAM", label: "Exam Fee" },
              { value: "ACTIVITY", label: "Activity Fee" },
              { value: "OTHER", label: "Other" },
            ]}
          />
          <Input
            label="Amount (₹)"
            type="number"
            value={otherAmount}
            onChange={(e) => setOtherAmount(e.target.value)}
          />
          <div style={{ alignSelf: "flex-end" }}>
            <button
              type="submit"
              style={{
                background: "#2563eb",
                border: "none",
                color: "white",
                padding: "10px 18px",
                borderRadius: "999px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              + Add Fee
            </button>
          </div>
        </form>}

        {otherItems.length === 0 ? (
          <div
            style={{
              padding: "16px",
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              background: "#f9fafb",
              fontSize: "13px",
              color: "#6b7280",
            }}
          >
            No extra fees added yet.
          </div>
        ) : (
          <div
            style={{
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              overflow: "auto",
              background: "white",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "13px",
              }}
            >
              <thead style={{ background: "#f9fafb" }}>
                <tr>
                  <Th>Fee Name</Th>
                  <Th>Type</Th>
                  <Th>Amount</Th>
                  <Th>Status</Th>
                  <Th>Paid Date</Th>
                  <Th>Action</Th>
                </tr>
              </thead>
              <tbody>
                {otherItems.map((i) => {
                  const isActive = activeItemPick === i._id;
                  return (
                    <tr key={i._id}>
                      <Td>{i.label}</Td>
                      <Td>{i.type}</Td>
                      <Td>₹{i.amount}</Td>
                      <Td
                        style={{
                          color:
                            i.status === "Paid" ? "#16a34a" : "#b91c1c",
                          fontWeight: 600,
                        }}
                      >
                        {i.status}
                      </Td>
                      <Td>
                        {i.paidDate
                          ? new Date(i.paidDate).toLocaleDateString("en-IN")
                          : "-"}
                      </Td>
                      <Td>
                        <div style={{ position: "relative" }}>
                          {isSuperadmin ? <button
                            style={{
                              background:
                                i.status === "Paid" ? "#e5e7eb" : "#16a34a",
                              border: "none",
                              padding: "4px 10px",
                              borderRadius: "999px",
                              cursor: "pointer",
                              color:
                                i.status === "Paid" ? "#111827" : "white",
                              fontSize: "12px",
                            }}
                            onClick={() =>
                              handleToggleItem(i._id, i.status)
                            }
                          >
                            {i.status === "Paid"
                              ? "Mark Pending"
                              : "Mark Paid"}
                          </button> : "-"}

                          {isActive && (
                            <div
                              style={{
                                position: "absolute",
                                top: "110%",
                                left: 0,
                                zIndex: 10,
                                background: "white",
                                border: "1px solid #e5e7eb",
                                borderRadius: "8px",
                                padding: "8px",
                                boxShadow:
                                  "0 10px 15px -3px rgba(0,0,0,0.1)",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "11px",
                                  marginBottom: "4px",
                                  color: "#4b5563",
                                }}
                              >
                                Select payment date
                              </div>
                              <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) =>
                                  setSelectedDate(e.target.value)
                                }
                                style={{
                                  padding: "4px 6px",
                                  borderRadius: "6px",
                                  border: "1px solid #d1d5db",
                                  fontSize: "12px",
                                }}
                              />
                              <div
                                style={{
                                  marginTop: "6px",
                                  display: "flex",
                                  gap: "6px",
                                  justifyContent: "flex-end",
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveItemPick(null);
                                    setSelectedDate("");
                                  }}
                                  style={{
                                    background: "#e5e7eb",
                                    border: "none",
                                    padding: "3px 8px",
                                    borderRadius: "999px",
                                    fontSize: "11px",
                                    cursor: "pointer",
                                  }}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={confirmItemDate}
                                  style={{
                                    background: "#2563eb",
                                    border: "none",
                                    color: "white",
                                    padding: "3px 8px",
                                    borderRadius: "999px",
                                    fontSize: "11px",
                                    cursor: "pointer",
                                  }}
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {plan && (
        <FeeLedger
          ledgerRows={ledgerRows}
          onReceipt={(row) => setSelectedReceipt(row)}
        />
      )}

      {selectedReceipt && (
        <ReceiptModal
          onClose={() => setSelectedReceipt(null)}
          receipt={selectedReceipt}
          student={student}
        />
      )}
    </>
  );
}

function FeeLedger({ ledgerRows, onReceipt }) {
  const paidRows = ledgerRows.filter((row) => row.status === "Paid");
  const totalPaid = paidRows.reduce((sum, row) => sum + row.amount, 0);

  return (
    <section className="fee-ledger-section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Fees</span>
          <h3>Receipts & Ledger</h3>
        </div>
        <strong>{formatCurrency(totalPaid)}</strong>
      </div>
      <div className="responsive-table">
        <table>
          <thead>
            <tr>
              <th>Receipt</th>
              <th>Fee</th>
              <th>Period</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Paid Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {ledgerRows.map((row) => (
              <tr key={row.id}>
                <td>{row.status === "Paid" ? row.receiptNo : "-"}</td>
                <td>{row.label}</td>
                <td>{row.period}</td>
                <td>{formatCurrency(row.amount)}</td>
                <td>{row.status}</td>
                <td>{row.paidDate ? new Date(row.paidDate).toLocaleDateString("en-IN") : "-"}</td>
                <td>
                  {row.status === "Paid" ? (
                    <button className="ghost-button table-action" type="button" onClick={() => onReceipt(row)}>
                      Receipt
                    </button>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}
            {ledgerRows.length === 0 && (
              <tr>
                <td colSpan="7">No ledger entries.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ReceiptModal({ onClose, receipt, student }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="receipt-modal">
        <div className="section-heading no-print">
          <div>
            <span className="eyebrow">Receipt</span>
            <h3>{receipt.receiptNo}</h3>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>x</button>
        </div>

        <article className="receipt-print-area">
          <header className="receipt-header">
            <h2>Fee Receipt</h2>
            <span>{receipt.receiptNo}</span>
          </header>
          <div className="receipt-grid">
            <span>Student</span><strong>{student?.name || receipt.studentName || "-"}</strong>
            <span>Admission No</span><strong>{student?.admissionNo || receipt.admissionNo || "-"}</strong>
            <span>Class</span><strong>{student?.className || receipt.className || "-"}</strong>
            <span>Academic Year</span><strong>{receipt.academicYear || "-"}</strong>
            <span>Fee</span><strong>{receipt.label}</strong>
            <span>Period</span><strong>{receipt.period}</strong>
            <span>Amount</span><strong>{formatCurrency(receipt.amount)}</strong>
            <span>Paid Date</span><strong>{new Date(receipt.paidDate).toLocaleDateString("en-IN")}</strong>
          </div>
          <footer className="receipt-footer">
            <span>Authorized Signature</span>
            <span>School Seal</span>
          </footer>
        </article>

        <div className="receipt-actions no-print">
          <button className="secondary-button" type="button" onClick={onClose}>Close</button>
          <button className="primary-button" type="button" onClick={() => window.print()}>Print Receipt</button>
        </div>
      </div>
    </div>
  );
}

function PaymentModeSelector({ mode, onChange }) {
  return (
    <div className="fee-payment-modes">
      {paymentModes.map((item) => (
        <button
          className={mode === item.value ? "fee-mode-card active" : "fee-mode-card"}
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
        >
          <strong>{item.label}</strong>
          <span>{item.value === "monthly" ? "1 month" : item.value === "quarterly" ? "3 months" : "Full year"}</span>
        </button>
      ))}
    </div>
  );
}

function PaymentSchedule({ activeGroupPick, canPay, mode, onCancel, onConfirm, onPay, selectedDate, setSelectedDate, tuitionItem }) {
  const groups = getPaymentGroups(tuitionItem, mode);

  return (
    <div className="fee-schedule">
      {groups.map((group) => {
        const isActive = activeGroupPick?.key === group.key;
        return (
          <article className="fee-schedule-card" key={group.key}>
            <div>
              <strong>{group.label}</strong>
              <span>{group.months.map((month) => month.name).join(", ")}</span>
            </div>
            <div className="fee-schedule-amount">
              <strong>Rs. {group.amount}</strong>
              <span className={`fee-status ${group.status.toLowerCase()}`}>{group.status}</span>
            </div>
            {canPay ? (
              <button className={group.status === "Paid" ? "secondary-button" : "primary-button"} type="button" onClick={() => onPay(group)}>
                {group.status === "Paid" ? "Mark Pending" : "Pay"}
              </button>
            ) : (
              <span className={`fee-status ${group.status.toLowerCase()}`}>{group.status}</span>
            )}

            {isActive && (
              <div className="fee-date-popover">
                <label>
                  <span>Payment date</span>
                  <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
                </label>
                <div>
                  <button className="secondary-button" type="button" onClick={onCancel}>Cancel</button>
                  <button className="primary-button" type="button" onClick={onConfirm}>Save</button>
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function getPaymentGroups(tuitionItem, mode) {
  const months = tuitionItem?.months || [];
  if (mode === "yearly") {
    return [toPaymentGroup("yearly", "Yearly Payment", months)];
  }

  if (mode === "quarterly") {
    return quarterGroups.map((names, index) =>
      toPaymentGroup(
        `quarter-${index + 1}`,
        `Quarter ${index + 1}`,
        names.map((name) => months.find((month) => month.name === name)).filter(Boolean)
      )
    );
  }

  return months.map((month) => toPaymentGroup(month.name, month.name, [month]));
}

function toPaymentGroup(key, label, months) {
  const paidCount = months.filter((month) => month.status === "Paid").length;
  const status = months.length && paidCount === months.length ? "Paid" : paidCount > 0 ? "Partial" : "Pending";
  return {
    key,
    label,
    months,
    amount: months.reduce((sum, month) => sum + Number(month.amount || 0), 0),
    status,
  };
}

function SummaryCard({ label, value, highlight }) {
  return (
    <div
      style={{
        flex: "1 1 200px",
        padding: "16px",
        borderRadius: "12px",
        border: "1px solid #e5e7eb",
        background: "#f9fafb",
      }}
    >
      <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px" }}>
        {label}
      </div>
      <div
        style={{
          fontSize: "20px",
          fontWeight: 700,
          color: highlight ? "#b91c1c" : "#111827",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Th({ children }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "10px 12px",
        borderBottom: "1px solid #e5e7eb",
        fontWeight: 600,
        color: "#4b5563",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, ...rest }) {
  return (
    <td
      style={{
        padding: "8px 12px",
        borderBottom: "1px solid #e5e7eb",
        color: "#374151",
        verticalAlign: "top",
      }}
      {...rest}
    >
      {children}
    </td>
  );
}

function Input({ label, fullWidth, ...props }) {
  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        flex: fullWidth ? "1 1 100%" : "1 1 220px",
      }}
    >
      <span
        style={{
          fontSize: "13px",
          marginBottom: "4px",
          color: "#4b5563",
        }}
      >
        {label}
      </span>
      <input
        {...props}
        style={{
          padding: "8px 10px",
          borderRadius: "8px",
          border: "1px solid #d1d5db",
          fontSize: "14px",
        }}
      />
    </label>
  );
}

function Select({ label, options, fullWidth, ...props }) {
  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        flex: fullWidth ? "1 1 100%" : "1 1 220px",
      }}
    >
      <span
        style={{
          fontSize: "13px",
          marginBottom: "4px",
          color: "#4b5563",
        }}
      >
        {label}
      </span>
      <select
        {...props}
        style={{
          padding: "8px 10px",
          borderRadius: "8px",
          border: "1px solid #d1d5db",
          fontSize: "14px",
          backgroundColor: "white",
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default FeeDetailPage;
