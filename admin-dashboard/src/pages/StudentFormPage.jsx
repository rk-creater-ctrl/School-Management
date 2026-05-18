// src/pages/StudentFormPage.jsx
/* eslint-disable react-hooks/immutability */
import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { studentsAPI } from "../api";
import { requireSuperadminPassword } from "../utils/superadminGuard";

function StudentFormPage() {
  const { id } = useParams(); // undefined for "new"
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    admissionNo: "",
    name: "",
    studentCode: "",
    email: "",

    className: "",
    classId: "",

    fatherName: "",
    motherName: "",

    dob: "",
    gender: "",
    category: "",

    mobileNo: "",
    aadharNo: "",
    childId: "",
    familyId: "",
    udisePenNo: "",
    apaarId: "",

    bankName: "",
    accountNo: "",
    ifscCode: "",

    address: "",
  });

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isEdit) {
      loadStudent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadStudent() {
    try {
      setLoading(true);
      setError("");
      const res = await studentsAPI.getById(id);
      const s = res.data;
      setForm({
        admissionNo: s.admissionNo || "",
        name: s.name || "",
        studentCode: s.studentCode || "",
        email: s.email || "",

        className: s.className || "",
        classId: s.classId || "",

        fatherName: s.fatherName || "",
        motherName: s.motherName || "",

        dob: s.dob ? s.dob.slice(0, 10) : "",
        gender: s.gender || "",
        category: s.category || "",

        mobileNo: s.mobileNo || "",
        aadharNo: s.aadharNo || "",
        childId: s.childId || "",
        familyId: s.familyId || "",
        udisePenNo: s.udisePenNo || "",
        apaarId: s.apaarId || "",

        bankName: s.bankName || "",
        accountNo: s.accountNo || "",
        ifscCode: s.ifscCode || "",

        address: s.address || "",
      });
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error || "Failed to load student. Try again."
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

      if (!form.admissionNo || !form.name || !form.className) {
        alert("Admission No, Name, and Class are required");
        setSaving(false);
        return;
      }

      const payload = {
        ...form,
        dob: form.dob ? new Date(form.dob) : undefined,
        classId: form.classId ? form.classId : undefined,
        email: form.email || undefined,
      };

      if (isEdit) {
        const ok = await requireSuperadminPassword("save student changes");
        if (!ok) {
          setSaving(false);
          return;
        }
        await studentsAPI.update(id, payload);
      } else {
        await studentsAPI.create(payload);
      }

      navigate("/students");
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error || "Failed to save student. Try again."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div>
        <Link to="/students" style={{ fontSize: 13, color: "#60a5fa" }}>
          ← Back to students
        </Link>
        <div
          style={{
            padding: 24,
            textAlign: "center",
            color: "#9ca3af",
            fontSize: 13,
          }}
        >
          Loading…
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Link to="/students" style={{ fontSize: 13, color: "#60a5fa" }}>
          ← Back to students
        </Link>
      </div>

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
          {isEdit ? "Edit student" : "Add student"}
        </h1>
        <p
          style={{
            margin: "4px 0 0",
            color: "#9ca3af",
            fontSize: 13,
          }}
        >
          {isEdit
            ? "Update student information and identifiers."
            : "Fill the form to register a new student."}
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

      {/* glass card wrapper */}
      <div
        style={{
          borderRadius: 18,
          border: "1px solid rgba(148,163,184,0.45)",
          background:
            "linear-gradient(145deg, rgba(15,23,42,0.98), rgba(15,23,42,0.9))",
          boxShadow: "0 22px 55px rgba(15,23,42,0.9)",
          padding: 18,
          maxWidth: 1040,
        }}
      >
        <form
          onSubmit={handleSubmit}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
          {/* Basic identifiers */}
          <Field label="Admission No *" name="admissionNo">
            <input
              type="text"
              name="admissionNo"
              value={form.admissionNo}
              onChange={handleChange}
              style={inputStyle}
            />
          </Field>

          <Field label="Student name *" name="name">
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              style={inputStyle}
            />
          </Field>

          <Field label="Student code" name="studentCode">
            <input
              type="text"
              name="studentCode"
              value={form.studentCode}
              onChange={handleChange}
              style={inputStyle}
            />
          </Field>

          <Field label="Email" name="email">
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              style={inputStyle}
            />
          </Field>

          {/* Class */}
          <Field label="Class *" name="className">
            <input
              type="text"
              name="className"
              value={form.className}
              onChange={handleChange}
              style={inputStyle}
              placeholder="e.g. 6A"
            />
          </Field>

          <Field label="Class ID (optional)" name="classId">
            <input
              type="text"
              name="classId"
              value={form.classId}
              onChange={handleChange}
              style={inputStyle}
            />
          </Field>

          {/* Family */}
          <Field label="Father name" name="fatherName">
            <input
              type="text"
              name="fatherName"
              value={form.fatherName}
              onChange={handleChange}
              style={inputStyle}
            />
          </Field>

          <Field label="Mother name" name="motherName">
            <input
              type="text"
              name="motherName"
              value={form.motherName}
              onChange={handleChange}
              style={inputStyle}
            />
          </Field>

          {/* Personal */}
          <Field label="Date of birth" name="dob">
            <input
              type="date"
              name="dob"
              value={form.dob}
              onChange={handleChange}
              style={inputStyle}
            />
          </Field>

          <Field label="Gender" name="gender">
            <select
              name="gender"
              value={form.gender}
              onChange={handleChange}
              style={inputStyle}
            >
              <option value="">Select</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </Field>

          <Field label="Category" name="category">
            <input
              type="text"
              name="category"
              value={form.category}
              onChange={handleChange}
              style={inputStyle}
              placeholder="e.g. General, OBC, SC, ST"
            />
          </Field>

          {/* Contact / IDs */}
          <Field label="Mobile no" name="mobileNo">
            <input
              type="tel"
              name="mobileNo"
              value={form.mobileNo}
              onChange={handleChange}
              style={inputStyle}
            />
          </Field>

          <Field label="Aadhar no" name="aadharNo">
            <input
              type="text"
              name="aadharNo"
              value={form.aadharNo}
              onChange={handleChange}
              style={inputStyle}
            />
          </Field>

          <Field label="Child ID" name="childId">
            <input
              type="text"
              name="childId"
              value={form.childId}
              onChange={handleChange}
              style={inputStyle}
            />
          </Field>

          <Field label="Family ID" name="familyId">
            <input
              type="text"
              name="familyId"
              value={form.familyId}
              onChange={handleChange}
              style={inputStyle}
            />
          </Field>

          <Field label="UDISE PEN no" name="udisePenNo">
            <input
              type="text"
              name="udisePenNo"
              value={form.udisePenNo}
              onChange={handleChange}
              style={inputStyle}
            />
          </Field>

          <Field label="APAAR ID" name="apaarId">
            <input
              type="text"
              name="apaarId"
              value={form.apaarId}
              onChange={handleChange}
              style={inputStyle}
            />
          </Field>

          {/* Bank */}
          <Field label="Bank name" name="bankName">
            <input
              type="text"
              name="bankName"
              value={form.bankName}
              onChange={handleChange}
              style={inputStyle}
            />
          </Field>

          <Field label="Account no" name="accountNo">
            <input
              type="text"
              name="accountNo"
              value={form.accountNo}
              onChange={handleChange}
              style={inputStyle}
            />
          </Field>

          <Field label="IFSC code" name="ifscCode">
            <input
              type="text"
              name="ifscCode"
              value={form.ifscCode}
              onChange={handleChange}
              style={inputStyle}
            />
          </Field>

          {/* Address */}
          <Field label="Address" name="address" fullWidth>
            <textarea
              name="address"
              value={form.address}
              onChange={handleChange}
              style={{
                ...inputStyle,
                minHeight: 80,
                resize: "vertical",
              }}
            />
          </Field>

          {/* Actions */}
          <div
            style={{
              gridColumn: "1 / -1",
              marginTop: 8,
              display: "flex",
              gap: 12,
              justifyContent: "flex-start",
            }}
          >
            <button
              type="submit"
              disabled={saving}
              style={{
                background: saving
                  ? "rgba(96,165,250,0.8)"
                  : "linear-gradient(135deg,#3b82f6,#6366f1)",
                border: "none",
                color: "white",
                padding: "8px 18px",
                borderRadius: 999,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                boxShadow: saving
                  ? "0 0 0"
                  : "0 14px 35px rgba(37,99,235,0.55)",
              }}
            >
              {saving
                ? "Saving..."
                : isEdit
                ? "Save changes"
                : "Create student"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

function Field({ label, name, fullWidth, children }) {
  return (
    <label
      htmlFor={name}
      style={{
        display: "flex",
        flexDirection: "column",
        fontSize: 12.5,
        gridColumn: fullWidth ? "1 / -1" : undefined,
      }}
    >
      <span
        style={{
          marginBottom: 4,
          color: "#9ca3af",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(148,163,184,0.6)",
  fontSize: 13,
  width: "100%",
  background: "rgba(15,23,42,0.85)",
  color: "#e5e7eb",
  outline: "none",
};

export default StudentFormPage;
