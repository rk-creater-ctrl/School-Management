// src/pages/FeesPage.jsx
/* eslint-disable react-hooks/immutability */
import { useEffect, useState } from "react";
import { studentsAPI, feesAPI } from "../api";
import { Link } from "react-router-dom";

function FeesPage() {
  const [students, setStudents] = useState([]);
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      const [studentsRes, feesRes] = await Promise.all([
        studentsAPI.getAll(),
        feesAPI.getAll(),
      ]);
      setStudents(studentsRes.data || []);
      setFees(feesRes.data || []);
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

  // For now we assume one active year, e.g. 2024-2025
  const activeYear = "2024-2025";

  // Filter students by search (name, admission no, class)
  const normalizedSearch = search.trim().toLowerCase();
  const filteredStudents =
    normalizedSearch === ""
      ? students
      : students.filter((s) => {
          const name = s.name?.toLowerCase() || "";
          const adm = String(s.admissionNo || "").toLowerCase();
          const cls = s.className?.toLowerCase() || "";
          return (
            name.includes(normalizedSearch) ||
            adm.includes(normalizedSearch) ||
            cls.includes(normalizedSearch)
          );
        });

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

      {/* Search box */}
      <section
        style={{
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 260px", maxWidth: 360 }}>
          <div style={{ position: "relative" }}>
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
            <span
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 11,
                color: "#6b7280",
              }}
            >
              /
            </span>
          </div>
        </div>
        <Link className="secondary-button" to="/fees/collections" style={{ textDecoration: "none" }}>
          Collections
        </Link>
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
                  <Th>Student name</Th>
                  <Th>Class</Th>
                  <Th>Academic year</Th>
                  <Th>Total fee</Th>
                  <Th>Paid</Th>
                  <Th>Due</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr>
                    <Td
                      colSpan={8}
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
                    const key = `${s._id}-${activeYear}`;
                    const plan = plansByStudentYear[key];

                    const total = plan ? plan.totalFee : 0;
                    const paid = plan ? plan.paidAmount : 0;
                    const due = plan ? plan.dueAmount : total - paid;

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
                        <Td>{activeYear}</Td>
                        <Td>Rs. {total}</Td>
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
                            <Link to={`/fees/${s._id}/${activeYear}?mode=monthly`}>Monthly</Link>
                            <Link to={`/fees/${s._id}/${activeYear}?mode=quarterly`}>Quarterly</Link>
                            <Link to={`/fees/${s._id}/${activeYear}?mode=yearly`}>Yearly</Link>
                          </div>
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

export default FeesPage;
