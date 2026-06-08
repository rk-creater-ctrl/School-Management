// src/pages/FeesPage.jsx
/* eslint-disable react-hooks/immutability */
import { useEffect, useMemo, useState } from "react";
import { studentsAPI, feesAPI } from "../api";
import { Link } from "react-router-dom";
import AcademicYearSelect from "../components/AcademicYearSelect";
import { getCurrentAcademicYear } from "../utils/academicYear";
import { canUseRole, getStoredUser } from "../permissions";

function FeesPage() {
  const [students, setStudents] = useState([]);
  const [fees, setFees] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState("all");
  const [activeYear, setActiveYear] = useState(getCurrentAcademicYear());
  const currentUser = getStoredUser();
  const canOpenCollections = canUseRole(["superadmin", "accountant"], currentUser);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      const [studentsRes, feesRes, classesRes] = await Promise.all([
        studentsAPI.getAll(),
        feesAPI.getAll(),
        studentsAPI.getClasses().catch(() => ({ data: [] })),
      ]);
      setStudents(studentsRes.data || []);
      setFees(feesRes.data || []);
      setClasses(classesRes.data || []);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error ||
          "Failed to load fee records."
      );
    } finally {
      setLoading(false);
    }
  }

  // Map studentId+year -> plan
  const plansByStudentYear = fees.reduce((acc, fee) => {
    const sid = fee.student;
    const key = `${sid}-${fee.academicYear}`;
    acc[key] = fee;
    return acc;
  }, {});

  const classOptions = useMemo(() => {
    const names = new Set([
      ...classes,
      ...students.map((student) => student.className).filter(Boolean),
    ]);

    return Array.from(names).sort((a, b) =>
      String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" })
    );
  }, [classes, students]);

  // Filter students by search and class
  const normalizedSearch = search.trim().toLowerCase();
  const filteredStudents = students.filter((s) => {
    const matchesClass = selectedClass === "all" || s.className === selectedClass;
    if (!matchesClass) return false;
    if (normalizedSearch === "") return true;

    const name = s.name?.toLowerCase() || "";
    const adm = String(s.admissionNo || "").toLowerCase();
    const cls = s.className?.toLowerCase() || "";
    return (
      name.includes(normalizedSearch) ||
      adm.includes(normalizedSearch) ||
      cls.includes(normalizedSearch)
    );
  });

  const studentsByClass = useMemo(() => {
    const groups = filteredStudents.reduce((acc, student) => {
      const className = student.className || "Unassigned";
      acc[className] = [...(acc[className] || []), student];
      return acc;
    }, {});

    return Object.entries(groups).sort(([a], [b]) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );
  }, [filteredStudents]);

  return (
    <>
      {/* header */}
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
          Fees
        </h1>
        <p
          style={{
            margin: "4px 0 0",
            color: "#9ca3af",
            fontSize: 13,
          }}
        >
          Manage student fee plans, dues, and payment frequency.
        </p>
      </header>

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

      <section className="fees-toolbar">
        <div className="fees-toolbar-controls">
          <AcademicYearSelect className="fees-filter-control" value={activeYear} onChange={setActiveYear} />

          <label className="fees-filter-control">
            <span>Class</span>
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
              <option value="all">All classes</option>
              {classOptions.map((className) => (
                <option key={className} value={className}>{className}</option>
              ))}
            </select>
          </label>

          <div className="fees-search-box">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, admission no, class..."
              style={{
                width: "100%",
                padding: "8px 32px 8px 12px",
                borderRadius: 999,
                border: "1px solid rgba(148,163,184,0.6)",
                fontSize: 13,
                outline: "none",
                background: "rgba(15,23,42,0.85)",
                color: "#e5e7eb",
              }}
            />
          </div>
        </div>
        {canOpenCollections && (
          <Link className="secondary-button" to="/fees/collections" style={{ textDecoration: "none" }}>
            Collections
          </Link>
        )}
      </section>

      {/* table */}
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
            Loading fees...
          </div>
        ) : (
          <div className="fees-class-stack">
            {studentsByClass.length === 0 ? (
              <div className="empty-state">No students found.</div>
            ) : (
              studentsByClass.map(([className, classStudents]) => (
                <article className="fees-class-card" key={className}>
                  <div className="fees-class-heading">
                    <div>
                      <span className="eyebrow">Class</span>
                      <h3>{className}</h3>
                    </div>
                    <strong>{classStudents.length} students</strong>
                  </div>
                  <div className="fees-student-table-wrap">
                    <table className="fees-student-table">
                      <thead>
                        <tr>
                          <Th>Admission No</Th>
                          <Th>Student name</Th>
                          <Th>Academic year</Th>
                          <Th>Total fee</Th>
                          <Th>Late fees</Th>
                          <Th>Paid</Th>
                          <Th>Due</Th>
                          <Th>Actions</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {classStudents.map((student, index) => (
                          <StudentFeeRow
                            activeYear={activeYear}
                            index={index}
                            key={student._id}
                            plan={plansByStudentYear[`${student._id}-${activeYear}`]}
                            student={student}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              ))
            )}
          </div>
        )}
      </section>
    </>
  );
}

function StudentFeeRow({ activeYear, index, plan, student }) {
  const total = plan ? plan.totalFee : 0;
  const late = plan ? getPlanLateFee(plan) : 0;
  const paid = plan ? plan.paidAmount : 0;
  const due = plan ? plan.dueAmount : total - paid;

  return (
    <tr
      style={{
        background:
          index % 2 === 0
            ? "rgba(15,23,42,0.95)"
            : "rgba(15,23,42,0.9)",
      }}
    >
      <Td>{student.admissionNo}</Td>
      <Td>
        <strong>{student.name}</strong>
        <small>{student.className || "Unassigned"}</small>
      </Td>
      <Td>{activeYear}</Td>
      <Td>Rs. {total}</Td>
      <Td style={{ color: late > 0 ? "#fbbf24" : "#d1d5db", fontWeight: late > 0 ? 600 : 400 }}>Rs. {late}</Td>
      <Td>Rs. {paid}</Td>
      <Td
        style={{
          color: due > 0 ? "#f97373" : "#4ade80",
          fontWeight: 600,
        }}
      >
        Rs. {due}
      </Td>
      <Td>
        <div className="fee-action-options">
          <Link to={`/fees/${student._id}/${activeYear}?mode=monthly`}>Monthly</Link>
          <Link to={`/fees/${student._id}/${activeYear}?mode=quarterly`}>Quarterly</Link>
          <Link to={`/fees/${student._id}/${activeYear}?mode=yearly`}>Yearly</Link>
        </div>
      </Td>
    </tr>
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

function Td({ children, style, ...rest }) {
  return (
    <td
      style={{
        padding: "8px 12px",
        borderBottom: "1px solid rgba(31,41,55,0.9)",
        color: "#d1d5db",
        verticalAlign: "top",
        ...style,
      }}
      {...rest}
    >
      {children}
    </td>
  );
}

function getPlanLateFee(plan) {
  return (plan?.items || []).reduce((sum, item) => {
    if (item.mode === "ONE_TIME") {
      return sum + (item.status === "Paid"
        ? Number(item.lateFeePaidAmount || item.lateFeeDueAmount || 0)
        : Number(item.lateFeeDueAmount || 0));
    }

    if (item.mode !== "MONTHLY") return sum;

    return sum + (item.months || []).reduce((monthSum, month) => {
      const lateFee = month.status === "Paid"
        ? Number(month.lateFeePaidAmount || month.lateFeeDueAmount || 0)
        : Number(month.lateFeeDueAmount || 0);
      return monthSum + lateFee;
    }, 0);
  }, 0);
}

export default FeesPage;
