// src/pages/ClassesPage.jsx
/* eslint-disable react-hooks/immutability */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { studentsAPI } from "../api";

function ClassesPage() {
  // classes is an array of strings like ["1A", "2B", "6A"]
  const [classes, setClasses] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    loadClasses();
  }, []);

  async function loadClasses() {
    try {
      setLoading(true);
      setError("");
      const res = await studentsAPI.getClasses(); // GET /students/classes/distinct
      console.log("Distinct classes from students:", res.data);
      setClasses(res.data || []);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error || "Failed to load classes. Try again."
      );
    } finally {
      setLoading(false);
    }
  }

  const normalizedSearch = search.trim().toLowerCase();
  const filtered = normalizedSearch
    ? classes.filter((name) =>
        (name || "").toLowerCase().includes(normalizedSearch)
      )
    : classes;

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
            Classes
          </h1>
          <p
            style={{
              margin: "4px 0 0",
              color: "#9ca3af",
              fontSize: 13,
            }}
          >
            Classes are fetched from students (like attendance). Click a class to
            manage homework and notices.
          </p>
        </div>
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

      {/* Search */}
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
              placeholder="Search by class name…"
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
            Loading classes…
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
                  <Th>Class</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <Td
                      colSpan={2}
                      style={{
                        textAlign: "center",
                        padding: 24,
                        color: "#9ca3af",
                      }}
                    >
                      No classes found.
                    </Td>
                  </tr>
                ) : (
                  filtered.map((name, index) => (
                    <tr
                      key={name}
                      style={{
                        background:
                          index % 2 === 0
                            ? "rgba(15,23,42,0.95)"
                            : "rgba(15,23,42,0.9)",
                      }}
                    >
                      <Td>{name}</Td>
                      <Td>
                        <button
                          type="button"
                          onClick={() =>
                            navigate(`/classes/${encodeURIComponent(name)}`)
                          }
                          style={{
                            border: "none",
                            background:
                              "linear-gradient(135deg,#3b82f6,#6366f1)",
                            color: "white",
                            padding: "4px 12px",
                            borderRadius: 999,
                            fontSize: 11,
                            cursor: "pointer",
                            boxShadow:
                              "0 10px 25px rgba(37,99,235,0.5)",
                          }}
                        >
                          Open
                        </button>
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

export default ClassesPage;