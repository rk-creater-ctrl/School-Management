/* eslint-disable react-hooks/exhaustive-deps */
// src/pages/AttendancePage.jsx
import { useEffect, useState } from "react";
import { studentsAPI, attendanceAPI } from "../api";
import { Link } from "react-router-dom";

function AttendancePage() {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");

  // academic year starting from April
  const [academicYear, setAcademicYear] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    return m >= 4 ? y : y - 1;
  });

  const [percentages, setPercentages] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingPercent, setLoadingPercent] = useState(false);
  const [error, setError] = useState("");
  const [deviceCode, setDeviceCode] = useState("");
  const [deviceMessage, setDeviceMessage] = useState("");
  const [markDate, setMarkDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    loadBaseData();
  }, []);

  useEffect(() => {
    if (students.length) {
      loadPercentages();
    }

  }, [students, academicYear]);

  async function loadBaseData() {
    try {
      setLoading(true);
      setError("");
      const [studentsRes, classesRes] = await Promise.all([
        studentsAPI.getAll(),
        studentsAPI.getClasses(),
      ]);
      setStudents(studentsRes.data || []);
      const list = classesRes.data || [];
      setClasses(list);
      if (list.length && !selectedClass) {
        setSelectedClass(list[0]);
      }
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error ||
          "Failed to load attendance records."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadPercentages() {
    try {
      setLoadingPercent(true);
      const map = {};
      const promises = students.map((s) =>
        attendanceAPI
          .getStudentYear(s._id, academicYear)
          .then((res) => {
            map[s._id] = res.data?.percentage ?? 0;
          })
          .catch(() => {
            map[s._id] = 0;
          })
      );
      await Promise.all(promises);
      setPercentages(map);
    } finally {
      setLoadingPercent(false);
    }
  }

  const filteredStudents = selectedClass
    ? students.filter((s) => s.className === selectedClass)
    : students;

  async function markFromFaceDevice(event) {
    event.preventDefault();
    const code = deviceCode.trim();
    if (!/^\d{10}$/.test(code)) {
      setDeviceMessage("Enter a valid 10 digit student code.");
      return;
    }

    const matched = students.find((student) => String(student.studentCode || student.admissionNo || "") === code);
    if (!matched) {
      setDeviceMessage("No matching student found for this code.");
      return;
    }

    try {
      await attendanceAPI.mark({
        date: markDate,
        entries: [{ studentId: matched._id, status: "Present", note: "Face detection device" }],
      });
      setDeviceMessage(`${matched.name} marked Present for ${markDate}.`);
      setDeviceCode("");
      loadPercentages();
    } catch {
      setDeviceMessage(`${matched.name} matched. Attendance can sync when the server is available.`);
    }
  }

  return (
    <>
      {/* Header */}
      <header style={{ marginBottom: 16 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: -0.03,
            color: "#f9fafb",
          }}
        >
          Attendance
        </h1>
        <p
          style={{
            margin: "4px 0 0",
            color: "#9ca3af",
            fontSize: 13,
          }}
        >
          Connect face detection attendance by sending a 10 digit student code.
        </p>
      </header>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: "10px 12px",
            marginBottom: 16,
            borderRadius: 12,
            background: "rgba(248,113,113,0.14)",
            color: "#fecaca",
            border: "1px solid rgba(248,113,113,0.5)",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <section className="module-board" style={{ marginBottom: 16 }}>
        <div className="section-heading">
          <div>
            <span className="eyebrow">Face detection sync</span>
            <h3>Student code attendance</h3>
          </div>
        </div>
        <form className="form-grid" onSubmit={markFromFaceDevice}>
          <label className="field">
            <span>10 digit student code</span>
            <input value={deviceCode} onChange={(event) => setDeviceCode(event.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="1023456789" inputMode="numeric" />
          </label>
          <label className="field">
            <span>Date</span>
            <input type="date" value={markDate} onChange={(event) => setMarkDate(event.target.value)} />
          </label>
          <button className="primary-button" type="submit">Mark Present</button>
        </form>
        {deviceMessage && <p className="inline-success" style={{ marginTop: 12 }}>{deviceMessage}</p>}
      </section>

      {/* Filters */}
      <section
        style={{
          marginBottom: 16,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
        }}
      >
        {/* Class filter */}
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 12.5,
          }}
        >
          <span
            style={{
              marginBottom: 4,
              color: "#9ca3af",
            }}
          >
            Class
          </span>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid rgba(148,163,184,0.6)",
              fontSize: 13,
              background: "rgba(15,23,42,0.9)",
              color: "#e5e7eb",
              minWidth: 140,
              outline: "none",
            }}
          >
            <option value="">All</option>
            {classes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        {/* Academic year selection */}
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 12.5,
          }}
        >
          <span
            style={{
              marginBottom: 4,
              color: "#9ca3af",
            }}
          >
            Academic year (Apr-Mar)
          </span>
          <select
            value={academicYear}
            onChange={(e) => setAcademicYear(Number(e.target.value))}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid rgba(148,163,184,0.6)",
              fontSize: 13,
              background: "rgba(15,23,42,0.9)",
              color: "#e5e7eb",
              outline: "none",
            }}
          >
            {[-1, 0, 1].map((offset) => {
              const y = new Date().getFullYear() + offset;
              const startY = y;
              const label = `${startY}-${startY + 1}`;
              return (
                <option key={startY} value={startY}>
                  {label}
                </option>
              );
            })}
          </select>
        </label>

        {loadingPercent && (
          <span
            style={{
              fontSize: 12,
              color: "#9ca3af",
              marginTop: 22,
            }}
          >
            Updating percentages...
          </span>
        )}
      </section>

      {/* Table */}
      <section>
        {loading ? (
          <div
            style={{
              padding: 24,
              textAlign: "center",
              color: "#9ca3af",
              fontSize: 13,
            }}
          >
            Loading attendance...
          </div>
        ) : (
          <div
            style={{
              borderRadius: 16,
              border: "1px solid rgba(148,163,184,0.45)",
              overflow: "hidden",
              background:
                "linear-gradient(145deg, rgba(15,23,42,0.98), rgba(15,23,42,0.92))",
              boxShadow: "0 18px 45px rgba(15,23,42,0.9)",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 12.5,
              }}
            >
              <thead
                style={{
                  background:
                    "linear-gradient(90deg, rgba(30,64,175,0.24), rgba(15,23,42,0.9))",
                }}
              >
                <tr>
                  <Th>Admission No</Th>
                  <Th>Student</Th>
                  <Th>Class</Th>
                  <Th>Annual attendance %</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr>
                    <Td
                      colSpan={5}
                      style={{
                        textAlign: "center",
                        padding: 24,
                        color: "#9ca3af",
                      }}
                    >
                      No students found.
                    </Td>
                  </tr>
                ) : (
                  filteredStudents.map((s, index) => {
                    const percent = percentages[s._id] ?? 0;
                    const percentColor =
                      percent >= 75
                        ? "#4ade80"
                        : percent >= 50
                        ? "#fbbf24"
                        : "#f97373";

                    return (
                      <tr
                        key={s._id}
                        style={{
                          background:
                            index % 2 === 0
                              ? "rgba(15,23,42,0.95)"
                              : "rgba(15,23,42,0.9)",
                        }}
                      >
                        <Td>{s.admissionNo}</Td>
                        <Td>{s.name}</Td>
                        <Td>{s.className}</Td>
                        <Td
                          style={{
                            fontWeight: 600,
                            color: percentColor,
                          }}
                        >
                          {percent.toFixed(1)}%
                        </Td>
                        <Td>
                          <Link
                            to={`/attendance/${s._id}`}
                            style={{
                              textDecoration: "none",
                              background:
                                "linear-gradient(135deg, #3b82f6, #6366f1)",
                              color: "white",
                              padding: "4px 10px",
                              borderRadius: 999,
                              fontSize: 11,
                              boxShadow:
                                "0 10px 25px rgba(37,99,235,0.5)",
                            }}
                          >
                            Mark / View
                          </Link>
                        </Td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function Th({ children }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "10px 12px",
        borderBottom: "1px solid rgba(148,163,184,0.5)",
        fontWeight: 600,
        color: "#e5e7eb",
        whiteSpace: "nowrap",
        fontSize: 12,
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
        borderBottom: "1px solid rgba(31,41,55,0.9)",
        color: "#d1d5db",
        verticalAlign: "top",
      }}
      {...rest}
    >
      {children}
    </td>
  );
}

export default AttendancePage;
