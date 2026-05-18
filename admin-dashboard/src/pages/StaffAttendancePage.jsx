import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, Download, Search, UserCheck } from "lucide-react";
import { erpAPI } from "../api";

const statusOptions = ["Present", "Absent", "HalfDay", "Leave"];

function StaffAttendancePage() {
  const [records, setRecords] = useState([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("Loading staff attendance...");
  const [form, setForm] = useState({
    staffCode: "",
    staffName: "",
    department: "",
    status: "Present",
    date: new Date().toISOString().slice(0, 10),
    note: "",
  });

  useEffect(() => {
    let active = true;

    erpAPI
      .list("staffAttendance")
      .then((res) => {
        if (!active) return;
        setRecords((res.data || []).map(toStaffAttendanceRecord));
        setMessage("");
      })
      .catch(() => {
        if (active) setMessage("Staff attendance can sync when backend is available.");
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredRecords = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return records;
    return records.filter((record) =>
      [record.staffCode, record.staffName, record.department, record.status, record.date]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [query, records]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function markAttendance(event) {
    event.preventDefault();
    if (!form.staffCode || !form.staffName || !form.date) {
      setMessage("Staff code, name, and date are required.");
      return;
    }

    const optimisticRecord = {
      ...form,
      localId: `local-${Date.now()}`,
    };
    setRecords((current) => [optimisticRecord, ...current]);
    setMessage(`${form.staffName} marked ${form.status}.`);

    try {
      const res = await erpAPI.create("staffAttendance", {
        referenceNo: `STAFF-ATT-${Date.now().toString().slice(-6)}`,
        title: form.staffName,
        groupName: form.department || "Staff",
        status: form.status,
        payload: {
          staffCode: form.staffCode,
          staffName: form.staffName,
          department: form.department,
          date: form.date,
          note: form.note,
        },
      });
      setRecords((current) => current.map((record) => (record.localId === optimisticRecord.localId ? toStaffAttendanceRecord(res.data) : record)));
    } catch {
      setMessage("Saved locally. Backend sync failed.");
    }
  }

  function exportCsv() {
    const rows = [
      ["Date", "Staff Code", "Name", "Department", "Status", "Note"],
      ...filteredRecords.map((record) => [record.date, record.staffCode, record.staffName, record.department, record.status, record.note]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell || "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "staff-attendance.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const counts = statusOptions.map((status) => ({
    status,
    count: records.filter((record) => record.status === status).length,
  }));

  return (
    <div className="staff-attendance-page">
      <section className="module-hero">
        <div>
          <span className="eyebrow">Staff Attendance</span>
          <h2>Staff attendance register.</h2>
        </div>
        <div className="module-actions">
          <button className="secondary-button" onClick={exportCsv}><Download size={18} /> Export CSV</button>
        </div>
      </section>

      {message && <div className="inline-alert">{message}</div>}

      <section className="stats-grid compact">
        {counts.map((item) => (
          <article className="metric-card" key={item.status}>
            <div className="metric-icon"><CalendarCheck size={20} /></div>
            <span>{item.status}</span>
            <strong>{item.count}</strong>
          </article>
        ))}
      </section>

      <section className="workspace-grid">
        <form className="chart-card" onSubmit={markAttendance}>
          <div className="section-heading">
            <div>
              <span className="eyebrow">Mark</span>
              <h3>Attendance</h3>
            </div>
            <UserCheck size={20} />
          </div>
          <div className="form-grid">
            <Field label="Staff code" value={form.staffCode} onChange={(value) => updateForm("staffCode", value.toUpperCase())} />
            <Field label="Staff name" value={form.staffName} onChange={(value) => updateForm("staffName", value)} />
            <Field label="Department" value={form.department} onChange={(value) => updateForm("department", value)} />
            <label className="field">
              <span>Status</span>
              <select value={form.status} onChange={(event) => updateForm("status", event.target.value)}>
                {statusOptions.map((status) => <option key={status}>{status}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Date</span>
              <input type="date" value={form.date} onChange={(event) => updateForm("date", event.target.value)} />
            </label>
            <Field label="Note" value={form.note} onChange={(value) => updateForm("note", value)} />
          </div>
          <button className="primary-button" type="submit">Mark Attendance</button>
        </form>

        <article className="chart-card wide">
          <div className="table-toolbar">
            <div className="search-box">
              <Search size={17} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search staff attendance" />
            </div>
          </div>
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Staff Code</th>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <tr key={record.localId}>
                    <td>{record.date}</td>
                    <td>{record.staffCode}</td>
                    <td>{record.staffName}</td>
                    <td>{record.department || "-"}</td>
                    <td>{record.status}</td>
                    <td>{record.note || "-"}</td>
                  </tr>
                ))}
                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan="6">No staff attendance records.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </div>
  );
}

function Field({ label, value, onChange }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function toStaffAttendanceRecord(record) {
  return {
    localId: record._id || record.localId || `${record.staffCode}-${record.date}`,
    id: record._id,
    staffCode: record.payload?.staffCode || record.staffCode || record.referenceNo || "",
    staffName: record.payload?.staffName || record.title || record.staffName || "",
    department: record.payload?.department || record.groupName || record.department || "",
    status: record.status || "Present",
    date: record.payload?.date || record.date || new Date(record.createdAt || Date.now()).toISOString().slice(0, 10),
    note: record.payload?.note || record.note || "",
  };
}

export default StaffAttendancePage;
