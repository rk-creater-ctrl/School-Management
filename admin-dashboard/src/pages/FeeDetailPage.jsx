import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { erpAPI, feesAPI, studentsAPI } from "../api";
import { extractFeeLedgerRows, formatCurrency } from "../utils/feeReports";
import { requireSuperadminPassword } from "../utils/superadminGuard";
import { getStoredUser } from "../permissions";
import { printReceiptOnly } from "../utils/receiptPrint";

const paymentModes = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

const paymentMethodOptions = ["Cash", "Online", "UPI", "Card", "Bank Transfer", "Cheque", "Other"];

const feeMonths = [
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
  const [lateFeeAmount, setLateFeeAmount] = useState("10");
  const [lateFeeSetting, setLateFeeSetting] = useState("");

  // For adding other fees
  const [otherLabel, setOtherLabel] = useState("");
  const [otherType, setOtherType] = useState("EXAM");
  const [otherAmount, setOtherAmount] = useState("");
  const [otherMonth, setOtherMonth] = useState("");

  // Local state for date picker popups
  const [activeMonthPick, setActiveMonthPick] = useState(null); // { itemId, monthName }
  const [activeItemPick, setActiveItemPick] = useState(null); // itemId
  const [activeGroupPick, setActiveGroupPick] = useState(null);
  const [selectedDate, setSelectedDate] = useState(""); // YYYY-MM-DD
  const [paymentDraft, setPaymentDraft] = useState(createPaymentDraft());
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
      const nextPlan = planRes?.data || null;
      const nextTuitionItem =
        nextPlan?.items?.find((i) => i.type === "TUITION" && i.mode === "MONTHLY") ||
        null;
      setStudent(s);
      setPlan(nextPlan);
      setLateFeeSetting(nextTuitionItem?.lateFeeAmount ? String(nextTuitionItem.lateFeeAmount) : "10");
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

  const tuitionItem = useMemo(
    () => plan?.items?.find((i) => i.type === "TUITION" && i.mode === "MONTHLY") || null,
    [plan]
  );
  const otherItems = useMemo(
    () => plan?.items?.filter((i) => i.mode === "ONE_TIME") || [],
    [plan]
  );
  const ledgerRows = useMemo(() => extractFeeLedgerRows(plan), [plan]);
  const lateFeeTotal = useMemo(() => getLateFeeTotal(tuitionItem, otherItems), [tuitionItem, otherItems]);
  const modeDueSummary = useMemo(
    () => getPaymentModeDueSummary(tuitionItem, otherItems, paymentMode, year),
    [tuitionItem, otherItems, paymentMode, year]
  );

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
        lateFeeAmount: Number(lateFeeAmount || 10),
      });
      setMonthlyAmount("");
      setLateFeeAmount("10");
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
    if (!otherLabel || !otherAmount || (otherType === "EXAM" && !otherMonth)) {
      alert(otherType === "EXAM" ? "Fee name, amount, and exam month are required" : "Label and amount are required");
      return;
    }
    try {
      await feesAPI.addItem({
        studentId,
        academicYear: year,
        label: otherLabel,
        type: otherType,
        amount: Number(otherAmount),
        applicableMonth: otherType === "EXAM" ? otherMonth : "",
      });
      setOtherLabel("");
      setOtherType("EXAM");
      setOtherAmount("");
      setOtherMonth("");
      await loadData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Failed to add fee item");
    }
  }

  async function handleLateFeeSetting(e) {
    e.preventDefault();
    if (!plan || !tuitionItem) return;
    const allowed = await requireSuperadminPassword("update late fee");
    if (!allowed) return;

    try {
      await feesAPI.updateTuitionLateFee(plan._id, tuitionItem._id, Number(lateFeeSetting || 10));
      await loadData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Failed to update late fee");
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
    const month = tuitionItem?.months?.find((item) => item.name === monthName);
    setPaymentDraft(createPaymentDraft(getEntryBalanceAmount(month)));
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
    const item = otherItems.find((entry) => entry._id === itemId);
    setPaymentDraft(createPaymentDraft(getEntryBalanceAmount(item)));
  }

  async function confirmMonthDate() {
    if (!activeMonthPick) return;
    const allowed = await requireSuperadminPassword("record fee payment");
    if (!allowed) return;
    const { itemId, monthName } = activeMonthPick;
    await feesAPI.recordMonthPayment(plan._id, {
      itemId,
      monthName,
      amount: Number(paymentDraft.amount || 0),
      paidDate: paymentDraft.paidDate || null,
      paymentMode: paymentDraft.paymentMode,
      concessionAmount: Number(paymentDraft.concessionAmount || 0),
      note: paymentDraft.note,
    });
    await loadData();
    setActiveMonthPick(null);
    setPaymentDraft(createPaymentDraft());
  }

  async function confirmItemDate() {
    if (!activeItemPick) return;
    const allowed = await requireSuperadminPassword("record fee payment");
    if (!allowed) return;
    await feesAPI.recordItemPayment(plan._id, {
      itemId: activeItemPick,
      amount: Number(paymentDraft.amount || 0),
      paidDate: paymentDraft.paidDate || null,
      paymentMode: paymentDraft.paymentMode,
      concessionAmount: Number(paymentDraft.concessionAmount || 0),
      note: paymentDraft.note,
    });
    await loadData();
    setActiveItemPick(null);
    setPaymentDraft(createPaymentDraft());
  }

  function changePaymentMode(nextMode) {
    setPaymentMode(nextMode);
    setSearchParams({ mode: nextMode });
    setActiveGroupPick(null);
    setActiveMonthPick(null);
    setSelectedDate("");
    setPaymentDraft(createPaymentDraft());
  }

  async function applyGroupPayment(group, paidDate, groupPaymentMode = "Cash") {
    if (!tuitionItem || !plan) return;
    const shouldMarkPaid = group.status !== "Paid";
    const monthsToToggle = group.months.filter((month) =>
      shouldMarkPaid ? month.status !== "Paid" : month.status === "Paid"
    );

    for (const month of monthsToToggle) {
      await feesAPI.toggleMonth(plan._id, tuitionItem._id, month.name, paidDate || null, groupPaymentMode);
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
    setSelectedDate(todayInputDate());
    setPaymentDraft(createPaymentDraft(group.balanceAmount));
  }

  async function confirmGroupDate() {
    if (!activeGroupPick) return;
    const allowed = await requireSuperadminPassword("record fee payment");
    if (!allowed) return;
    await applyGroupPayment(activeGroupPick, selectedDate || null, paymentDraft.paymentMode);
    setActiveGroupPick(null);
    setSelectedDate("");
    setPaymentDraft(createPaymentDraft());
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
            label={modeDueSummary.label}
            value={`₹${plan.dueAmount}`}
            highlight={modeDueSummary.amount > 0}
            detail={modeDueSummary.detail}
            numericValue={modeDueSummary.amount}
          />
          <SummaryCard
            label="Late Fees"
            value={`Rs. ${lateFeeTotal}`}
            highlight={lateFeeTotal > 0}
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
            <Input
              label="Late Fee Per Day (10th-30th)"
              type="number"
              value={lateFeeAmount}
              onChange={(e) => setLateFeeAmount(e.target.value)}
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
            <LateFeeSettings
              isSuperadmin={isSuperadmin}
              lateFeeSetting={lateFeeSetting}
              onChange={setLateFeeSetting}
              onSubmit={handleLateFeeSetting}
              tuitionItem={tuitionItem}
            />
            <PaymentModeSelector mode={paymentMode} onChange={changePaymentMode} />
            {paymentMode !== "monthly" && (
              <PaymentSchedule
                activeGroupPick={activeGroupPick}
                academicYear={year}
                mode={paymentMode}
                onCancel={() => {
                  setActiveGroupPick(null);
                  setSelectedDate("");
                  setPaymentDraft(createPaymentDraft());
                }}
                onConfirm={confirmGroupDate}
                onPay={handleGroupPayment}
                canPay={isSuperadmin}
                paymentMedium={paymentDraft.paymentMode}
                setPaymentMedium={(value) => setPaymentDraft((current) => ({ ...current, paymentMode: value }))}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                tuitionItem={tuitionItem}
              />
            )}
            {paymentMode === "monthly" && (
          <div className="fee-monthly-table-card">
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
                  <Th>Base Amount</Th>
                  <Th>Concession</Th>
                  <Th>Late Fee</Th>
                  <Th>Payable</Th>
                  <Th>Paid</Th>
                  <Th>Due</Th>
                  <Th>Status</Th>
                  <Th>Mode</Th>
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
                      <Td>{formatCurrency(m.amount)}</Td>
                      <Td>{m.concessionAmount ? formatCurrency(m.concessionAmount) : "-"}</Td>
                      <Td>{getMonthLateFeeAmount(m) ? formatCurrency(getMonthLateFeeAmount(m)) : "-"}</Td>
                      <Td>{formatCurrency(getMonthPayableAmount(m))}</Td>
                      <Td>{formatCurrency(getEntryPaidAmount(m, getMonthPayableAmount(m)))}</Td>
                      <Td>{formatCurrency(getEntryDueAmount(m, year))}</Td>
                      <Td
                        style={{
                          color:
                            m.status === "Paid" ? "#16a34a" : m.status === "Partial" ? "#b45309" : "#b91c1c",
                          fontWeight: 600,
                        }}
                      >
                        {m.status}
                      </Td>
                      <Td>{m.paymentMode || "-"}</Td>
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
                            {m.status === "Paid" ? "Reset" : m.status === "Partial" ? "Receive Balance" : "Receive"}
                          </button> : "-"}

                          {isActive && (
                            <PaymentPopover
                              draft={paymentDraft}
                              maxAmount={getEntryBalanceAmount(m)}
                              onCancel={() => {
                                setActiveMonthPick(null);
                                setPaymentDraft(createPaymentDraft());
                              }}
                              onChange={setPaymentDraft}
                              onConfirm={confirmMonthDate}
                            />
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
            onChange={(e) => {
              setOtherType(e.target.value);
              if (e.target.value !== "EXAM") setOtherMonth("");
            }}
            options={[
              { value: "EXAM", label: "Exam Fee" },
              { value: "ACTIVITY", label: "Activity Fee" },
              { value: "OTHER", label: "Other" },
            ]}
          />
          {otherType === "EXAM" && (
            <Select
              label="Exam Month"
              value={otherMonth}
              onChange={(e) => setOtherMonth(e.target.value)}
              options={[
                { value: "", label: "Select exam month" },
                ...feeMonths.map((month) => ({ value: month, label: month })),
              ]}
            />
          )}
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
            className="fee-light-table-card"
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
                  <Th>Month</Th>
                  <Th>Amount</Th>
                  <Th>Concession</Th>
                  <Th>Late Fee</Th>
                  <Th>Payable</Th>
                  <Th>Paid</Th>
                  <Th>Due</Th>
                  <Th>Status</Th>
                  <Th>Mode</Th>
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
                      <Td>{i.applicableMonth || "-"}</Td>
                      <Td>{formatCurrency(i.amount)}</Td>
                      <Td>{i.concessionAmount ? formatCurrency(i.concessionAmount) : "-"}</Td>
                      <Td>{getOneTimeLateFeeAmount(i) ? formatCurrency(getOneTimeLateFeeAmount(i)) : "-"}</Td>
                      <Td>{formatCurrency(getOneTimePayableAmount(i))}</Td>
                      <Td>{formatCurrency(getEntryPaidAmount(i, getOneTimePayableAmount(i)))}</Td>
                      <Td>{formatCurrency(getEntryDueAmount(i, year))}</Td>
                      <Td
                        style={{
                          color:
                            i.status === "Paid" ? "#16a34a" : i.status === "Partial" ? "#b45309" : "#b91c1c",
                          fontWeight: 600,
                        }}
                      >
                        {i.status}
                      </Td>
                      <Td>{i.paymentMode || "-"}</Td>
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
                            {i.status === "Paid" ? "Reset" : i.status === "Partial" ? "Receive Balance" : "Receive"}
                          </button> : "-"}

                          {isActive && (
                            <PaymentPopover
                              draft={paymentDraft}
                              maxAmount={getEntryBalanceAmount(i)}
                              onCancel={() => {
                                setActiveItemPick(null);
                                setPaymentDraft(createPaymentDraft());
                              }}
                              onChange={setPaymentDraft}
                              onConfirm={confirmItemDate}
                            />
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

function PaymentPopover({ draft, maxAmount, onCancel, onChange, onConfirm }) {
  function update(field, value) {
    onChange((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="fee-payment-popover">
      <div>
        <strong>Record Payment</strong>
        <span>Balance: {formatCurrency(maxAmount)}</span>
      </div>
      <label>
        <span>Paid amount</span>
        <input type="number" min="1" value={draft.amount} onChange={(event) => update("amount", event.target.value)} />
      </label>
      <label>
        <span>Concession / Discount</span>
        <input type="number" min="0" value={draft.concessionAmount} onChange={(event) => update("concessionAmount", event.target.value)} />
      </label>
      <label>
        <span>Payment date</span>
        <input type="date" value={draft.paidDate} onChange={(event) => update("paidDate", event.target.value)} />
      </label>
      <label>
        <span>Payment medium</span>
        <select value={draft.paymentMode} onChange={(event) => update("paymentMode", event.target.value)}>
          {paymentMethodOptions.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
        </select>
      </label>
      <label>
        <span>Note</span>
        <input value={draft.note} onChange={(event) => update("note", event.target.value)} placeholder="Optional" />
      </label>
      <div>
        <button className="secondary-button" type="button" onClick={onCancel}>Cancel</button>
        <button className="primary-button" type="button" onClick={onConfirm}>Save Payment</button>
      </div>
    </div>
  );
}

function FeeLedger({ ledgerRows, onReceipt }) {
  const paidRows = ledgerRows.filter((row) => row.status === "Paid");
  const totalPaid = paidRows.reduce((sum, row) => sum + row.amount, 0);

  function openReceipt(row) {
    onReceipt(buildReceiptFromLedger(row, ledgerRows));
  }

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
              <th>Base</th>
              <th>Late Fee</th>
              <th>Concession</th>
              <th>Amount</th>
              <th>Mode</th>
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
                <td>{formatCurrency(row.baseAmount || row.amount)}</td>
                <td>{row.lateFeeAmount ? formatCurrency(row.lateFeeAmount) : "-"}</td>
                <td>{row.concessionAmount ? formatCurrency(row.concessionAmount) : "-"}</td>
                <td>{formatCurrency(row.amount)}</td>
                <td>{row.paymentMode || "-"}</td>
                <td>{row.status}</td>
                <td>{row.paidDate ? new Date(row.paidDate).toLocaleDateString("en-IN") : "-"}</td>
                <td>
                  {row.status === "Paid" ? (
                    <button className="ghost-button table-action" type="button" onClick={() => openReceipt(row)}>
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
                  <td colSpan="11">No ledger entries.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ReceiptModal({ onClose, receipt, student }) {
  const schoolName = useReceiptSchoolName();
  const receiptLines = receipt.lines?.length ? receipt.lines : [receipt];
  const paidAmount = receipt.paidAmount ?? receipt.amount;
  const paidDate = receipt.paidDate ? new Date(receipt.paidDate) : new Date();

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
            <div>
              <span>{schoolName}</span>
              <h2>Fee Receipt</h2>
            </div>
            <div className="receipt-number">
              <span>Receipt No</span>
              <strong>{receipt.receiptNo}</strong>
            </div>
          </header>

          <section className="receipt-info-grid">
            <div>
              <span>Student</span>
              <strong>{student?.name || receipt.studentName || "-"}</strong>
            </div>
            <div>
              <span>Admission No</span>
              <strong>{student?.admissionNo || receipt.admissionNo || "-"}</strong>
            </div>
            <div>
              <span>Class</span>
              <strong>{student?.className || receipt.className || "-"}</strong>
            </div>
            <div>
              <span>Academic Year</span>
              <strong>{receipt.academicYear || "-"}</strong>
            </div>
            <div>
              <span>Paid For</span>
              <strong>{receipt.periodRange || receipt.period || "-"}</strong>
            </div>
            <div>
              <span>Paid Date</span>
              <strong>{paidDate.toLocaleDateString("en-IN")}</strong>
            </div>
            <div>
              <span>Payment Medium</span>
              <strong>{receipt.paymentMode || "Cash"}</strong>
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
              {receiptLines.map((line) => (
                <tr key={line.id}>
                  <td>{line.label}</td>
                  <td>{line.period}</td>
                  <td>{formatCurrency(line.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="2">Total Paid Amount</td>
                <td>{formatCurrency(paidAmount)}</td>
              </tr>
            </tfoot>
          </table>

          <footer className="receipt-footer">
            <span>Amount received for the period shown above.</span>
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

function useReceiptSchoolName() {
  const [schoolName, setSchoolName] = useState("School");

  useEffect(() => {
    let active = true;
    erpAPI
      .list("schoolSettings")
      .then((res) => {
        const settings = res.data?.[0]?.payload || {};
        const nextName = String(settings.schoolName || settings.shortName || "").trim();
        if (active && nextName) setSchoolName(nextName);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  return schoolName;
}

function buildReceiptFromLedger(row, ledgerRows) {
  const receiptDate = toDateKey(row.paidDate);
  const matchingRows = ledgerRows.filter((item) =>
    item.status === "Paid" &&
    item.feeId === row.feeId &&
    item.label === row.label &&
    toDateKey(item.paidDate) === receiptDate
  );
  const lines = sortReceiptLines(matchingRows.length ? matchingRows : [row]);
  const paidAmount = lines.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return {
    ...row,
    lines,
    paidAmount,
    periodRange: getReceiptPeriodRange(lines, row.academicYear),
  };
}

function sortReceiptLines(lines) {
  return [...lines].sort((a, b) => getMonthPosition(a.period) - getMonthPosition(b.period));
}

function getReceiptPeriodRange(lines, academicYear) {
  const tuitionLines = lines.filter((line) => getMonthPosition(line.period) >= 0);
  if (!tuitionLines.length) {
    return lines.map((line) => line.period).filter(Boolean).join(", ") || "-";
  }

  const sorted = sortReceiptLines(tuitionLines);
  const firstRange = getMonthDateRange(sorted[0].period, academicYear);
  const lastRange = getMonthDateRange(sorted[sorted.length - 1].period, academicYear);
  return `${formatReceiptDate(firstRange.from)} to ${formatReceiptDate(lastRange.to)}`;
}

function getMonthDateRange(monthName, academicYear) {
  const monthIndex = getMonthPosition(monthName);
  const calendarMonth = monthIndex >= 0 && monthIndex <= 8 ? monthIndex + 3 : monthIndex - 9;
  const { startYear, endYear } = getAcademicYearParts(academicYear);
  const calendarYear = monthIndex >= 0 && monthIndex <= 8 ? startYear : endYear;

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

function getMonthPosition(monthName) {
  return feeMonths.indexOf(monthName);
}

function toDateKey(date) {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

function formatReceiptDate(date) {
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function LateFeeSettings({ isSuperadmin, lateFeeSetting, onChange, onSubmit, tuitionItem }) {
  return (
    <form className="fee-late-settings" onSubmit={onSubmit}>
      <div>
        <span className="eyebrow">Late Fee</span>
        <strong>Rs. 10 per day from 10th to 30th of every month</strong>
        <small>Current late fee: Rs. {tuitionItem?.lateFeeAmount || 10} per day, capped on the 30th.</small>
      </div>
      {isSuperadmin ? (
        <>
          <label>
            <span>Late fee per day</span>
            <input
              type="number"
              min="10"
              value={lateFeeSetting}
              onChange={(event) => onChange(event.target.value)}
            />
          </label>
          <button className="primary-button" type="submit">Save Late Fee</button>
        </>
      ) : (
        <span className="fee-status pending">Applied 10th-30th</span>
      )}
    </form>
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

function PaymentSchedule({
  academicYear,
  activeGroupPick,
  canPay,
  mode,
  onCancel,
  onConfirm,
  onPay,
  paymentMedium,
  selectedDate,
  setPaymentMedium,
  setSelectedDate,
  tuitionItem,
}) {
  const groups = getPaymentGroups(tuitionItem, mode, academicYear);

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
              <strong>{formatCurrency(group.balanceAmount)}</strong>
              <span className={`fee-status ${group.status.toLowerCase()}`}>
                {group.status}{group.lateFeeAmount ? ` - Late Rs. ${group.lateFeeAmount}` : ""}
              </span>
              <small className={group.dueAmount > 0 ? "fee-schedule-due active" : "fee-schedule-due"}>
                Due now: {formatCurrency(group.dueAmount)}
              </small>
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
                <label>
                  <span>Payment medium</span>
                  <select value={paymentMedium} onChange={(event) => setPaymentMedium(event.target.value)}>
                    {paymentMethodOptions.map((method) => (
                      <option key={method} value={method}>{method}</option>
                    ))}
                  </select>
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

function getPaymentModeDueSummary(tuitionItem, otherItems, mode, academicYear) {
  const tuitionDue = getPaymentGroups(tuitionItem, mode, academicYear)
    .reduce((sum, group) => sum + Number(group.dueAmount || 0), 0);
  const otherDue = (otherItems || [])
    .reduce((sum, item) => sum + getEntryDueAmount(item, academicYear), 0);

  return {
    amount: tuitionDue + otherDue,
    label: `${getPaymentModeLabel(mode)} Due`,
    detail: getPaymentModeDueDetail(mode),
  };
}

function getPaymentModeLabel(mode) {
  if (mode === "quarterly") return "Quarterly";
  if (mode === "yearly") return "Annual";
  return "Monthly";
}

function getPaymentModeDueDetail(mode) {
  if (mode === "quarterly") return "Current and past quarters";
  if (mode === "yearly") return "Full active year balance";
  return "Current and past months";
}

function getPaymentGroups(tuitionItem, mode, academicYear) {
  const months = tuitionItem?.months || [];
  if (mode === "yearly") {
    return [toPaymentGroup("yearly", "Yearly Payment", months, academicYear, mode)];
  }

  if (mode === "quarterly") {
    return quarterGroups.map((names, index) =>
      toPaymentGroup(
        `quarter-${index + 1}`,
        `Quarter ${index + 1}`,
        names.map((name) => months.find((month) => month.name === name)).filter(Boolean),
        academicYear,
        mode
      )
    );
  }

  return months.map((month) => toPaymentGroup(month.name, month.name, [month], academicYear, mode));
}

function toPaymentGroup(key, label, months, academicYear, mode) {
  const lateFeeAmount = months.reduce((sum, month) => sum + getMonthLateFeeAmount(month), 0);
  const payableAmount = months.reduce((sum, month) => sum + getMonthPayableAmount(month), 0);
  const paidAmount = months.reduce(
    (sum, month) => sum + getEntryPaidAmount(month, getMonthPayableAmount(month)),
    0
  );
  const balanceAmount = Math.max(0, payableAmount - paidAmount);
  const dueAmount = isPaymentGroupDueNow(months, academicYear, mode) ? balanceAmount : 0;
  const status = months.length && balanceAmount <= 0 ? "Paid" : paidAmount > 0 ? "Partial" : "Pending";

  return {
    key,
    label,
    months,
    amount: payableAmount,
    balanceAmount,
    dueAmount,
    lateFeeAmount,
    paidAmount,
    status,
  };
}

function isPaymentGroupDueNow(months, academicYear, mode) {
  if (!months.length) return false;

  if (mode === "quarterly" || mode === "yearly") {
    return isFeeMonthDueNow(months[0].name, academicYear);
  }

  return months.some((month) => isFeeMonthDueNow(month.name, academicYear));
}

function getMonthLateFeeAmount(month) {
  return month.status === "Paid"
    ? Number(month.lateFeePaidAmount || month.lateFeeDueAmount || 0)
    : Number(month.lateFeeDueAmount || 0);
}

function getMonthPayableAmount(month) {
  return Math.max(0, Number(month.amount || 0) - Number(month.concessionAmount || 0)) + getMonthLateFeeAmount(month);
}

function getOneTimePayableAmount(item) {
  return Math.max(0, Number(item?.amount || 0) - Number(item?.concessionAmount || 0)) + getOneTimeLateFeeAmount(item);
}

function getEntryPaidAmount(entry, payableAmount) {
  const paymentsTotal = (entry?.payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  if (paymentsTotal > 0) return paymentsTotal;
  const storedPaid = Number(entry?.amountPaid || 0);
  if (storedPaid > 0) return storedPaid;
  return entry?.status === "Paid" ? payableAmount : 0;
}

function getEntryBalanceAmount(entry) {
  if (!entry) return 0;
  const payableAmount = entry.name ? getMonthPayableAmount(entry) : getOneTimePayableAmount(entry);
  return Math.max(0, payableAmount - getEntryPaidAmount(entry, payableAmount));
}

function getEntryDueAmount(entry, academicYear) {
  if (!entry) return 0;
  const balanceAmount = getEntryBalanceAmount(entry);
  return isEntryDueNow(entry, academicYear) ? balanceAmount : 0;
}

function getOneTimeLateFeeAmount(item) {
  return item?.status === "Paid"
    ? Number(item.lateFeePaidAmount || item.lateFeeDueAmount || 0)
    : Number(item?.lateFeeDueAmount || 0);
}

function isEntryDueNow(entry, academicYear, asOf = new Date()) {
  if (entry?.name) return isFeeMonthDueNow(entry.name, academicYear, asOf);
  if (entry?.applicableMonth) return isFeeMonthDueNow(entry.applicableMonth, academicYear, asOf);
  return true;
}

function isFeeMonthDueNow(monthName, academicYear, asOf = new Date()) {
  if (getMonthPosition(monthName) < 0) return true;
  return getMonthDateRange(monthName, academicYear).from <= normalizeDate(asOf);
}

function normalizeDate(date) {
  const next = date ? new Date(date) : new Date();
  next.setHours(0, 0, 0, 0);
  return next;
}

function createPaymentDraft(amount = "") {
  return {
    amount: amount ? String(amount) : "",
    concessionAmount: "0",
    paidDate: todayInputDate(),
    paymentMode: "Cash",
    note: "",
  };
}

function todayInputDate(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function getLateFeeTotal(tuitionItem, otherItems = []) {
  const tuitionLateFee = (tuitionItem?.months || []).reduce(
    (sum, month) => sum + getMonthLateFeeAmount(month),
    0
  );
  const otherLateFee = otherItems.reduce((sum, item) => sum + getOneTimeLateFeeAmount(item), 0);
  return tuitionLateFee + otherLateFee;
}

function SummaryCard({ detail, highlight, label, numericValue, value }) {
  const displayValue = numericValue !== undefined ? formatCurrency(numericValue) : value;

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
        {displayValue}
      </div>
      {detail && (
        <small style={{ color: "#64748b", display: "block", marginTop: "5px" }}>
          {detail}
        </small>
      )}
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
          color: "#111827",
          backgroundColor: "white",
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
          color: "#111827",
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
