import { createElement, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Banknote, CalendarDays, CheckCircle2, Save, UserRound, WalletCards } from "lucide-react";
import { staffPayrollAPI } from "../api";
import { getStoredUser } from "../permissions";
import { formatCurrency } from "../utils/feeReports";

const manageableRoles = ["superadmin", "accountant"];
const payrollCategories = ["Skilled", "Half-skilled", "Unskilled"];

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function StaffPayrollPage() {
  const currentUser = getStoredUser();
  const canManage = manageableRoles.includes(currentUser?.role);
  const { staffId } = useParams();
  const navigate = useNavigate();
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selfEmployee, setSelfEmployee] = useState(null);
  const [status, setStatus] = useState("Loading payroll...");
  const [settingsDrafts, setSettingsDrafts] = useState({});
  const [paymentDrafts, setPaymentDrafts] = useState({});

  const loadPayroll = useCallback(async () => {
    try {
      setStatus("Loading payroll...");
      if (canManage && staffId) {
        const res = await staffPayrollAPI.getEmployee(staffId, { monthKey });
        setSelectedEmployee(res.data.employee || null);
        setEmployees([]);
        setSelfEmployee(null);
      } else if (canManage) {
        const res = await staffPayrollAPI.getEmployees({ monthKey });
        setEmployees(res.data.employees || []);
        setSelectedEmployee(null);
        setSelfEmployee(null);
      } else {
        const res = await staffPayrollAPI.getMine({ monthKey });
        setSelfEmployee(res.data.employee || null);
        setEmployees([]);
        setSelectedEmployee(null);
      }
      setStatus("");
    } catch (error) {
      setStatus(error.response?.data?.error || "Unable to load payroll.");
    }
  }, [canManage, monthKey, staffId]);

  useEffect(() => {
    // Payroll data is remote state; reload when month or role changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPayroll();
  }, [loadPayroll]);

  const summary = useMemo(() => {
    const rows = canManage ? (staffId && selectedEmployee ? [selectedEmployee] : employees) : selfEmployee ? [selfEmployee] : [];
    return rows.reduce(
      (totals, employee) => {
        const payment = employee.currentPayment || {};
        totals.payable += Number(payment.payableAmount || 0);
        totals.paid += Number(payment.paidAmount || 0);
        totals.sunday += Number(payment.sundaySalary || 0);
        if (payment.status === "Paid") totals.paidCount += 1;
        if (payment.status !== "Paid") totals.pendingCount += 1;
        return totals;
      },
      { payable: 0, paid: 0, sunday: 0, paidCount: 0, pendingCount: 0 }
    );
  }, [canManage, employees, selectedEmployee, selfEmployee, staffId]);

  function getSettingsDraft(employee) {
    const defaults = {
      employeeCode: employee.employeeCode || "",
      department: employee.department || "",
      designation: employee.designation || "",
      payrollCategory: employee.payrollCategory || "Skilled",
      monthlySalary: employee.monthlySalary || "",
      includeSundaySalary: employee.includeSundaySalary !== false,
      bankName: employee.bankName || "",
      accountNo: employee.accountNo || "",
      ifscCode: employee.ifscCode || "",
    };
    return { ...defaults, ...(settingsDrafts[employee.userId] || {}) };
  }

  function updateSettings(userId, field, value) {
    setSettingsDrafts((current) => ({
      ...current,
      [userId]: {
        ...(current[userId] || {}),
        [field]: value,
      },
    }));
  }

  function getPaymentDraft(employee) {
    const payment = employee.currentPayment || {};
    const defaults = {
      deductions: payment.deductions || "",
      bonus: payment.bonus || "",
      paidAmount: payment.payableAmount || "",
      paidDate: payment.paidDate ? String(payment.paidDate).slice(0, 10) : new Date().toISOString().slice(0, 10),
      note: payment.note || "",
    };
    return { ...defaults, ...(paymentDrafts[employee.userId] || {}) };
  }

  function updatePayment(userId, field, value) {
    setPaymentDrafts((current) => ({
      ...current,
      [userId]: {
        ...(current[userId] || {}),
        [field]: value,
      },
    }));
  }

  async function saveSettings(employee) {
    const draft = getSettingsDraft(employee);
    try {
      await staffPayrollAPI.saveSettings(employee.userId, {
        ...draft,
        monthlySalary: Number(draft.monthlySalary || 0),
        monthKey,
      });
      setSettingsDrafts((current) => {
        const next = { ...current };
        delete next[employee.userId];
        return next;
      });
      setPaymentDrafts((current) => {
        const next = { ...current };
        delete next[employee.userId];
        return next;
      });
      setStatus("Salary settings saved.");
      await loadPayroll();
    } catch (error) {
      setStatus(error.response?.data?.error || "Unable to save salary settings.");
    }
  }

  async function markPayment(employee, nextStatus) {
    const draft = getPaymentDraft(employee);
    try {
      await staffPayrollAPI.markPayment(employee.userId, {
        monthKey,
        status: nextStatus,
        deductions: Number(draft.deductions || 0),
        bonus: Number(draft.bonus || 0),
        paidAmount: Number(draft.paidAmount || 0),
        paidDate: draft.paidDate,
        note: draft.note,
      });
      setPaymentDrafts((current) => {
        const next = { ...current };
        delete next[employee.userId];
        return next;
      });
      setStatus(nextStatus === "Paid" ? "Salary marked paid." : "Salary marked pending.");
      await loadPayroll();
    } catch (error) {
      setStatus(error.response?.data?.error || "Unable to update salary payment.");
    }
  }

  const groupedEmployees = useMemo(() => {
    const groups = payrollCategories.reduce((acc, category) => ({ ...acc, [category]: [] }), {});
    employees.forEach((employee) => {
      const category = payrollCategories.includes(employee.payrollCategory) ? employee.payrollCategory : "Skilled";
      groups[category] = [...(groups[category] || []), employee];
    });
    return groups;
  }, [employees]);

  const detailEmployee = canManage ? selectedEmployee : selfEmployee;

  return (
    <div className="staff-payroll-page">
      <section className="module-hero payroll-hero">
        <div>
          <span className="eyebrow">{canManage ? "Staff & Payroll" : "My Salary"}</span>
          <h2>{canManage ? (staffId ? selectedEmployee?.name || "Salary Detail" : "Salary Payment Register") : selfEmployee?.name || "Salary Details"}</h2>
          <p>Salary is shown with working-day salary, Sunday salary, and final payable amount.</p>
        </div>
        <label className="payroll-month-picker">
          <span>Salary Month</span>
          <input type="month" value={monthKey} onChange={(event) => setMonthKey(event.target.value)} />
        </label>
      </section>

      {status && <div className="inline-alert">{status}</div>}

      <section className="stats-grid compact">
        <PayrollMetric icon={WalletCards} label="Payable" value={formatCurrency(summary.payable)} />
        <PayrollMetric icon={Banknote} label="Paid" value={formatCurrency(summary.paid)} />
        <PayrollMetric icon={CalendarDays} label="Sunday Salary" value={formatCurrency(summary.sunday)} />
        <PayrollMetric icon={CheckCircle2} label="Pending" value={String(summary.pendingCount)} />
      </section>

      {canManage && !staffId ? (
        <PayrollCategoryIndex groupedEmployees={groupedEmployees} monthKey={monthKey} />
      ) : canManage ? (
        detailEmployee ? (
          <section className="staff-payroll-detail">
            <button className="secondary-button payroll-back-button" type="button" onClick={() => navigate("/modules/staff")}>
              <ArrowLeft size={16} /> Back to staff
            </button>
            <PayrollEmployeeCard
              employee={detailEmployee}
              getPaymentDraft={getPaymentDraft}
              getSettingsDraft={getSettingsDraft}
              markPayment={markPayment}
              saveSettings={saveSettings}
              updatePayment={updatePayment}
              updateSettings={updateSettings}
            />
            <SalaryHistory employee={detailEmployee} />
          </section>
        ) : (
          <div className="empty-state">Staff member not found.</div>
        )
      ) : (
        <TeacherSalaryView employee={selfEmployee} />
      )}
    </div>
  );
}

function PayrollCategoryIndex({ groupedEmployees, monthKey }) {
  return (
    <section className="payroll-category-grid">
      {payrollCategories.map((category) => {
        const employees = groupedEmployees[category] || [];
        return (
          <article className="payroll-category-card" key={category}>
            <div className="payroll-category-heading">
              <div>
                <span className="eyebrow">Category</span>
                <h3>{category}</h3>
              </div>
              <strong>{employees.length}</strong>
            </div>
            <div className="payroll-compact-list">
              {employees.map((employee) => (
                <Link className="payroll-compact-row" key={employee.userId} to={`/modules/staff/${employee.userId}`}>
                  <span className="payroll-compact-icon"><UserRound size={17} /></span>
                  <span className="payroll-compact-main">
                    <strong>{employee.name}</strong>
                    <small>{employee.designation} - {employee.department}</small>
                  </span>
                  <span className={`payroll-status status-${String(employee.currentPayment?.status || "Pending").toLowerCase()}`}>
                    {employee.currentPayment?.status || "Pending"}
                  </span>
                  <span className="payroll-compact-amount">{formatCurrency(employee.currentPayment?.payableAmount || 0)}</span>
                </Link>
              ))}
              {employees.length === 0 && <div className="compact-empty">No {category.toLowerCase()} staff for {monthKey}.</div>}
            </div>
          </article>
        );
      })}
    </section>
  );
}

function PayrollEmployeeCard({ employee, getPaymentDraft, getSettingsDraft, markPayment, saveSettings, updatePayment, updateSettings }) {
  const payment = employee.currentPayment || {};
  const settings = getSettingsDraft(employee);
  const draft = getPaymentDraft(employee);

  return (
    <article className="staff-payroll-card">
      <div className="staff-payroll-identity">
        <div>
          <span className="eyebrow">{employee.employeeCode}</span>
          <h3>{employee.name}</h3>
          <p>{employee.designation} - {employee.department}</p>
        </div>
        <span className={`payroll-status status-${String(payment.status || "Pending").toLowerCase()}`}>{payment.status || "Pending"}</span>
      </div>

      <div className="payroll-breakdown">
        <Breakdown label="Without Sunday" value={payment.salaryWithoutSunday} />
        <Breakdown label="Sunday Salary" value={payment.sundaySalary} />
        <Breakdown label="Deductions" value={payment.deductions} />
        <Breakdown label="Bonus" value={payment.bonus} />
        <Breakdown label="Payable" value={payment.payableAmount} strong />
        <Breakdown label="Paid" value={payment.paidAmount} strong />
      </div>

      <div className="payroll-editor-grid">
        <div className="payroll-editor-panel">
          <h4>Salary setup</h4>
          <div className="payroll-field-grid">
            <PayrollField label="Employee code" value={settings.employeeCode} onChange={(value) => updateSettings(employee.userId, "employeeCode", value)} />
            <PayrollField label="Department" value={settings.department} onChange={(value) => updateSettings(employee.userId, "department", value)} />
            <PayrollField label="Designation" value={settings.designation} onChange={(value) => updateSettings(employee.userId, "designation", value)} />
            <PayrollSelect
              label="Payroll category"
              options={payrollCategories}
              value={settings.payrollCategory}
              onChange={(value) => updateSettings(employee.userId, "payrollCategory", value)}
            />
            <PayrollField label="Monthly salary" type="number" value={settings.monthlySalary} onChange={(value) => updateSettings(employee.userId, "monthlySalary", value)} />
            <PayrollField label="Bank" value={settings.bankName} onChange={(value) => updateSettings(employee.userId, "bankName", value)} />
            <PayrollField label="Account no." value={settings.accountNo} onChange={(value) => updateSettings(employee.userId, "accountNo", value)} />
            <PayrollField label="IFSC" value={settings.ifscCode} onChange={(value) => updateSettings(employee.userId, "ifscCode", value.toUpperCase())} />
            <label className="payroll-check">
              <input
                checked={settings.includeSundaySalary}
                type="checkbox"
                onChange={(event) => updateSettings(employee.userId, "includeSundaySalary", event.target.checked)}
              />
              <span>Include Sunday salary</span>
            </label>
          </div>
          <button className="secondary-button" type="button" onClick={() => saveSettings(employee)}>
            <Save size={16} /> Save setup
          </button>
        </div>

        <div className="payroll-editor-panel">
          <h4>Payment marking</h4>
          <div className="payroll-field-grid">
            <PayrollField label="Deduction" type="number" value={draft.deductions} onChange={(value) => updatePayment(employee.userId, "deductions", value)} />
            <PayrollField label="Bonus" type="number" value={draft.bonus} onChange={(value) => updatePayment(employee.userId, "bonus", value)} />
            <PayrollField label="Paid amount" type="number" value={draft.paidAmount} onChange={(value) => updatePayment(employee.userId, "paidAmount", value)} />
            <PayrollField label="Paid date" type="date" value={draft.paidDate} onChange={(value) => updatePayment(employee.userId, "paidDate", value)} />
            <PayrollField label="Note" value={draft.note} onChange={(value) => updatePayment(employee.userId, "note", value)} />
          </div>
          <div className="payroll-actions">
            <button className="primary-button" type="button" onClick={() => markPayment(employee, "Paid")}>Mark Paid</button>
            <button className="secondary-button" type="button" onClick={() => markPayment(employee, "Partial")}>Mark Partial</button>
            <button className="secondary-button" type="button" onClick={() => markPayment(employee, "Pending")}>Mark Pending</button>
          </div>
        </div>
      </div>
    </article>
  );
}

function TeacherSalaryView({ employee }) {
  if (!employee) return <div className="empty-state">Salary details unavailable.</div>;
  const payment = employee.currentPayment || {};

  return (
    <section className="staff-payroll-card self-view">
      <div className="staff-payroll-identity">
        <div>
          <span className="eyebrow">{employee.employeeCode}</span>
          <h3>{employee.name}</h3>
          <p>{employee.designation} - {employee.department}</p>
        </div>
        <span className={`payroll-status status-${String(payment.status || "Pending").toLowerCase()}`}>{payment.status || "Pending"}</span>
      </div>

      <div className="payroll-breakdown">
        <Breakdown label="Salary without Sunday" value={payment.salaryWithoutSunday} />
        <Breakdown label="Sunday salary" value={payment.sundaySalary} />
        <Breakdown label="Final payable" value={payment.payableAmount} strong />
        <Breakdown label="Paid amount" value={payment.paidAmount} strong />
      </div>

      <SalaryHistory employee={employee} />
    </section>
  );
}

function SalaryHistory({ employee }) {
  const history = employee?.payments || [];
  return (
    <article className="payroll-history-card">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Monthly</span>
          <h3>Salary History</h3>
        </div>
      </div>
      <div className="responsive-table">
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Without Sunday</th>
              <th>Sunday</th>
              <th>Payable</th>
              <th>Paid</th>
              <th>Status</th>
              <th>Paid Date</th>
            </tr>
          </thead>
          <tbody>
            {history.map((item) => (
              <tr key={item.monthKey}>
                <td>{item.monthName} {item.year}</td>
                <td>{formatCurrency(item.salaryWithoutSunday)}</td>
                <td>{formatCurrency(item.sundaySalary)}</td>
                <td>{formatCurrency(item.payableAmount)}</td>
                <td>{formatCurrency(item.paidAmount)}</td>
                <td>{item.status}</td>
                <td>{item.paidDate ? new Date(item.paidDate).toLocaleDateString("en-IN") : "-"}</td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan="7">No salary payments marked yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function PayrollMetric({ icon, label, value }) {
  return (
    <article className="metric-card">
      <div className="metric-icon">{createElement(icon, { size: 20 })}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>Selected month</small>
    </article>
  );
}

function Breakdown({ label, strong, value }) {
  return (
    <div className={strong ? "payroll-breakdown-item strong" : "payroll-breakdown-item"}>
      <span>{label}</span>
      <strong>{formatCurrency(value || 0)}</strong>
    </div>
  );
}

function PayrollField({ label, onChange, type = "text", value }) {
  return (
    <label className="payroll-field">
      <span>{label}</span>
      <input type={type} value={value || ""} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function PayrollSelect({ label, onChange, options, value }) {
  return (
    <label className="payroll-field">
      <span>{label}</span>
      <select value={value || options[0]} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

export default StaffPayrollPage;
