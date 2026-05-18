// src/pages/ClassFormPage.jsx
/* eslint-disable react-hooks/immutability */
import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { classesAPI } from "../api";

function ClassFormPage() {
  // if id exists, we are editing; otherwise creating
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    name: "",
    section: "",
    medium: "",
    classTeacher: "",
    strength: "",
    note: "",
  });

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    if (isEdit) {
      loadClass();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadClass() {
    try {
      setLoading(true);
      setError("");
      const res = await classesAPI.getById(id);
      const cls = res.data;
      setForm({
        name: cls.name || "",
        section: cls.section || "",
        medium: cls.medium || "",
        classTeacher: cls.classTeacher || "",
        strength: cls.strength ?? "",
        note: cls.note || "",
      });
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error || "Failed to fetch class details. Try again."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setSaving(true);
      setError("");

      if (!form.name.trim()) {
        alert("Class name is required");
        setSaving(false);
        return;
      }

      const payload = {
        name: form.name.trim(),
        section: form.section.trim(),
        medium: form.medium.trim(),
        classTeacher: form.classTeacher.trim(),
        strength: form.strength ? Number(form.strength) : undefined,
        note: form.note.trim(),
      };

      if (isEdit) {
        await classesAPI.update(id, payload);
      } else {
        await classesAPI.create(payload);
      }

      navigate("/classes");
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error ||
          (isEdit ? "Failed to update class." : "Failed to create class.")
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div style={{ marginBottom: "16px" }}>
        <Link to="/classes" style={{ fontSize: "13px", color: "#2563eb" }}>
          ← Back to classes
        </Link>
      </div>

      <header style={{ marginBottom: "16px" }}>
        <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700 }}>
          {isEdit ? "Edit class" : "Add class"}
        </h1>
        <p
          style={{
            margin: "4px 0 0",
            color: "#6b7280",
            fontSize: "14px",
          }}
        >
          {isEdit
            ? "Update class details."
            : "Create a new class record (optional if you only use classes from students)."}
        </p>
      </header>

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

      {loading ? (
        <div style={{ padding: "24px", textAlign: "center" }}>Loading...</div>
      ) : (
        <form
          onSubmit={handleSubmit}
          style={{
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            background: "white",
            padding: "16px",
            maxWidth: "480px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            {/* Class name */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  marginBottom: "4px",
                  color: "#4b5563",
                }}
              >
                Class name *
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g. 6A"
                style={inputStyle}
              />
            </div>

            {/* Section */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  marginBottom: "4px",
                  color: "#4b5563",
                }}
              >
                Section
              </label>
              <input
                type="text"
                name="section"
                value={form.section}
                onChange={handleChange}
                placeholder="e.g. A"
                style={inputStyle}
              />
            </div>

            {/* Medium */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  marginBottom: "4px",
                  color: "#4b5563",
                }}
              >
                Medium
              </label>
              <input
                type="text"
                name="medium"
                value={form.medium}
                onChange={handleChange}
                placeholder="e.g. English, Hindi"
                style={inputStyle}
              />
            </div>

            {/* Class teacher */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  marginBottom: "4px",
                  color: "#4b5563",
                }}
              >
                Class teacher
              </label>
              <input
                type="text"
                name="classTeacher"
                value={form.classTeacher}
                onChange={handleChange}
                placeholder="Teacher name"
                style={inputStyle}
              />
            </div>

            {/* Strength */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  marginBottom: "4px",
                  color: "#4b5563",
                }}
              >
                Strength
              </label>
              <input
                type="number"
                name="strength"
                value={form.strength}
                onChange={handleChange}
                placeholder="Number of students"
                style={inputStyle}
              />
            </div>

            {/* Note */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  marginBottom: "4px",
                  color: "#4b5563",
                }}
              >
                Note
              </label>
              <textarea
                name="note"
                value={form.note}
                onChange={handleChange}
                placeholder="Optional notes about this class"
                style={{
                  ...inputStyle,
                  minHeight: "80px",
                  resize: "vertical",
                }}
              />
            </div>

            {/* Submit */}
            <div>
              <button
                type="submit"
                disabled={saving}
                style={{
                  background: saving ? "#93c5fd" : "#2563eb",
                  border: "none",
                  color: "white",
                  padding: "8px 16px",
                  borderRadius: "999px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: 600,
                }}
              >
                {saving
                  ? "Saving..."
                  : isEdit
                  ? "Save changes"
                  : "Create class"}
              </button>
            </div>
          </div>
        </form>
      )}
    </>
  );
}

const inputStyle = {
  padding: "8px 10px",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
  fontSize: "14px",
  width: "100%",
};

export default ClassFormPage;