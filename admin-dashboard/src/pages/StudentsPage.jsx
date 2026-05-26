// src/pages/StudentsPage.jsx
/* eslint-disable react-hooks/immutability */
import { useEffect, useState } from "react";
import { studentsAPI } from "../api";
import { Link, useNavigate } from "react-router-dom";
import { getStoredUser } from "../permissions";
import { requireSuperadminPassword } from "../utils/superadminGuard";
import { getCurrentAcademicYear } from "../utils/academicYear";

function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const navigate = useNavigate();
  const currentUser = getStoredUser();
  const isSuperadmin = currentUser?.role === "superadmin";
  const activeYear = getCurrentAcademicYear();

  useEffect(() => {
    loadStudents();
  }, []);

  async function loadStudents() {
    try {
      setLoading(true);
      setError("");
      const res = await studentsAPI.getAll();
      setStudents(res.data || []);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error ||
          "Failed to load students. Is backend running?"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(studentId) {
    const ok = await requireSuperadminPassword("delete this student");
    if (!ok) return;

    try {
      await studentsAPI.remove(studentId);
      setStudents((prev) => prev.filter((s) => s._id !== studentId));
    } catch (err) {
      console.error(err);
      alert(
        err.response?.data?.error ||
          "Failed to delete student. Please try again."
      );
    }
  }

  const normalizedSearch = search.trim().toLowerCase();
  const filteredStudents =
    normalizedSearch === ""
      ? students
      : students.filter((s) => {
          const name = s.name?.toLowerCase() || "";
          const adm = String(s.admissionNo || "").toLowerCase();
          const cls = s.className?.toLowerCase() || "";
          const father = s.fatherName?.toLowerCase() || "";
          const mobile =
            s.mobileNo?.toLowerCase() || s.mobile?.toLowerCase() || "";
          return (
            name.includes(normalizedSearch) ||
            adm.includes(normalizedSearch) ||
            cls.includes(normalizedSearch) ||
            father.includes(normalizedSearch) ||
            mobile.includes(normalizedSearch)
          );
        });

  return (
    <>
      {/* header */}
      <header
        style={{
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 auto" }}>
          <h1
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: -0.03,
              color: "#f9fafb",
            }}
          >
            Students
          </h1>
          <p
            style={{
              margin: "4px 0 0",
              color: "#9ca3af",
              fontSize: 13,
            }}
          >
            Manage student records and quickly search by name, admission number
            or contact details.
          </p>
        </div>

        {isSuperadmin && (
          <button
            type="button"
            onClick={() => navigate("/students/new")}
            style={{
              background:
                "linear-gradient(135deg, #3b82f6, #6366f1)",
              border: "none",
              color: "white",
              padding: "8px 16px",
              borderRadius: 999,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: "nowrap",
              boxShadow: "0 10px 25px rgba(37,99,235,0.45)",
            }}
          >
            + Add student
          </button>
        )}
      </header>

      {error && (
        <div
          style={{
            padding: "10px 12px",
            marginBottom: 16,
            borderRadius: 12,
            background: "rgba(248,113,113,0.12)",
            color: "#fecaca",
            border: "1px solid rgba(248,113,113,0.45)",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {/* search */}
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
          <div
            style={{
              position: "relative",
            }}
          >
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, admission, class, father, mobile"
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
            Loading students…
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
                  <Th>Name</Th>
                  <Th>Class</Th>
                  <Th>Father name</Th>
                  <Th>Mobile</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr>
                    <Td
                      colSpan={6}
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
                  filteredStudents.map((s, index) => (
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
                      <Td><Link to={`/students/${s._id}`} style={{ color: "#e5e7eb" }}>{s.name}</Link></Td>
                      <Td>{s.className}</Td>
                      <Td>{s.fatherName}</Td>
                      <Td>{s.mobileNo || s.mobile}</Td>
                      <Td>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          {isSuperadmin && (
                            <button
                              type="button"
                              onClick={async () => {
                                const ok = await requireSuperadminPassword("edit this student");
                                if (ok) navigate(`/students/${s._id}/edit`);
                              }}
                              style={{
                                border: "none",
                                background: "rgba(148,163,184,0.18)",
                                color: "#e5e7eb",
                                padding: "4px 10px",
                                borderRadius: 999,
                                fontSize: 11,
                                cursor: "pointer",
                              }}
                            >
                              Edit
                            </button>
                          )}

                          {isSuperadmin && (
                            <button
                              type="button"
                              onClick={() => handleDelete(s._id)}
                              style={{
                                border: "none",
                                background: "rgba(248,113,113,0.16)",
                                color: "#fecaca",
                                padding: "4px 10px",
                                borderRadius: 999,
                                fontSize: 11,
                                cursor: "pointer",
                              }}
                            >
                              Delete
                            </button>
                          )}

                          {isSuperadmin && (
                            <Link
                              to={`/fees/${s._id}/${activeYear}`}
                              style={{
                                textDecoration: "none",
                                background:
                                  "linear-gradient(135deg,#3b82f6,#6366f1)",
                                color: "white",
                                padding: "4px 10px",
                                borderRadius: 999,
                                fontSize: 11,
                              }}
                            >
                              Fees
                            </Link>
                          )}
                          <Link
                            to={`/attendance/${s._id}`}
                            style={{
                              textDecoration: "none",
                              background:
                                "linear-gradient(135deg,#22c55e,#14b8a6)",
                              color: "white",
                              padding: "4px 10px",
                              borderRadius: 999,
                              fontSize: 11,
                            }}
                          >
                            Attendance
                          </Link>
                        </div>
                      </Td>
                    </tr>
                  ))
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

export default StudentsPage;
