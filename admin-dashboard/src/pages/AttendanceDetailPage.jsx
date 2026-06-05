/* eslint-disable no-unused-vars */
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, Link } from "react-router-dom";
import { attendanceAPI } from "../api";
import { getStoredUser } from "../permissions";

function useQuery() {
  const { search } = useLocation();
  return new URLSearchParams(search);
}

function AttendanceDetailPage() {
  const { studentId } = useParams();
  const query = useQuery();
  const navigate = useNavigate();

  const initialMonth =
    Number(query.get("month")) || new Date().getMonth() + 1;
  const initialYear = Number(query.get("year")) || new Date().getFullYear();

  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);

  const [student, setStudent] = useState(null);
  const [days, setDays] = useState([]);
  const [percentage, setPercentage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const currentRole = getStoredUser()?.role;
  const canManageAttendance = ["superadmin", "admin", "teacher"].includes(currentRole);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, month, year]);

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      const res = await attendanceAPI.getStudentMonth(
        studentId,
        month,
        year
      );
      setStudent(res.data.student);
      setDays(res.data.days || []);
      setPercentage(res.data.percentage || 0);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error || "Failed to load attendance register"
      );
    } finally {
      setLoading(false);
    }
  }

  function updateDayStatus(dayNumber, status) {
    if (!canManageAttendance) return;
    setDays((prev) =>
      prev.map((d) =>
        d.day === dayNumber
          ? {
              ...d,
              status,
            }
          : d
      )
    );
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError("");

      // Convert days list to entries for /attendance/mark
      const entries = days.map((d) => ({
        studentId,
        status: d.status,
        note: d.note || "",
        // we will send date separately, so ignore here
      }));

      // We need to call /attendance/mark for each date or adapt backend.
      // For simplicity, call per-day in a loop (could be optimized).
      const baseDate = new Date(year, month - 1, 1);
      const promises = days.map((d) =>
        attendanceAPI.mark({
          date: new Date(year, month - 1, d.day),
          entries: [
            {
              studentId,
              status: d.status,
              note: d.note || "",
            },
          ],
        })
      );

      await Promise.all(promises);
      await loadData();
      alert("Attendance updated");
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error || "Failed to save attendance. Try again."
      );
    } finally {
      setSaving(false);
    }
  }

  function handleMonthChange(delta) {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    } else if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    setMonth(newMonth);
    setYear(newYear);
    navigate(
      `/attendance/${studentId}?month=${newMonth}&year=${newYear}`,
      { replace: true }
    );
  }

  if (loading) {
    return (
      <div>
        <Link to="/attendance" style={{ fontSize: "13px", color: "#2563eb" }}>
          ← Back to attendance
        </Link>
        <div style={{ padding: "24px", textAlign: "center" }}>Loading...</div>
      </div>
    );
  }

  return (
    <>
      <div style={{ marginBottom: "16px" }}>
        <Link to="/attendance" style={{ fontSize: "13px", color: "#2563eb" }}>
          ← Back to attendance
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
          Attendance Register
        </h1>
        {student && (
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "14px" }}>
            {student.name} • {student.className} • {student.admissionNo}
          </p>
        )}
      </header>

      {/* Month navigation + summary */}
      <section
        style={{
          marginBottom: "16px",
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            onClick={() => handleMonthChange(-1)}
            style={{
              background: "#e5e7eb",
              border: "none",
              borderRadius: "999px",
              padding: "6px 10px",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            ← Prev
          </button>
          <div
            style={{
              fontSize: "16px",
              fontWeight: 600,
            }}
          >
            {new Date(year, month - 1, 1).toLocaleString("en-IN", {
              month: "long",
              year: "numeric",
            })}
          </div>
          <button
            type="button"
            onClick={() => handleMonthChange(1)}
            style={{
              background: "#e5e7eb",
              border: "none",
              borderRadius: "999px",
              padding: "6px 10px",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            Next →
          </button>
        </div>

        <div style={{ marginLeft: "auto" }}>
          <div
            style={{
              fontSize: "13px",
              color: "#6b7280",
              marginBottom: "2px",
            }}
          >
            Attendance %
          </div>
          <div
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color:
                percentage >= 75
                  ? "#16a34a"
                  : percentage >= 50
                  ? "#f97316"
                  : "#b91c1c",
            }}
          >
            {percentage.toFixed(1)}%
          </div>
        </div>

        {canManageAttendance && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              background: saving ? "#93c5fd" : "#2563eb",
              border: "none",
              color: "white",
              padding: "8px 18px",
              borderRadius: "999px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        )}
      </section>

      {/* Register table */}
      <section>
        <div
          style={{
            borderRadius: "12px",
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
                <Th>Date</Th>
                <Th>Day</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.day}>
                  <Td>
                    {new Date(year, month - 1, d.day).toLocaleDateString(
                      "en-IN"
                    )}
                  </Td>
                  <Td>
                    {new Date(year, month - 1, d.day).toLocaleString("en-IN", {
                      weekday: "short",
                    })}
                  </Td>
                  <Td>
                    <StatusSelector
                      name={`status-${d.day}`}
                      readOnly={!canManageAttendance}
                      value={d.status}
                      onChange={(val) => updateDayStatus(d.day, val)}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function StatusSelector({ value, onChange, name, readOnly }) {
  if (readOnly) return <span>{value}</span>;

  const options = [
    { value: "Present", label: "P" },
    { value: "Absent", label: "A" },
    { value: "HalfDay", label: "H" },
    { value: "Holiday", label: "HD" },
  ];

  return (
    <div style={{ display: "flex", gap: "6px" }}>
      {options.map((opt) => (
        <label
          key={opt.value}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "12px",
          }}
        >
          <input
            type="radio"
            name={name}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
          />
          <span>{opt.label}</span>
        </label>
      ))}
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

export default AttendanceDetailPage;
