import { createElement, useState } from "react";
import { Mail, Phone, Save, School, ShieldCheck, UserRound } from "lucide-react";

const fallbackUser = {
  name: "",
  email: "",
  phone: "",
  role: "admin",
  campus: "School ERP",
  academicYear: "2026-27",
};

function readUser() {
  try {
    return {
      ...fallbackUser,
      ...JSON.parse(localStorage.getItem("erp_user") || sessionStorage.getItem("erp_user") || "{}"),
    };
  } catch {
    return fallbackUser;
  }
}

function ProfilePage() {
  const [profile, setProfile] = useState(readUser);
  const [saved, setSaved] = useState(false);

  function updateProfile(field, value) {
    setProfile((current) => ({ ...current, [field]: value }));
    setSaved(false);
  }

  function saveProfile(event) {
    event.preventDefault();
    const storage = localStorage.getItem("erp_user") ? localStorage : sessionStorage;
    storage.setItem("erp_user", JSON.stringify(profile));
    setSaved(true);
  }

  return (
    <div className="profile-page">
      <section className="module-hero">
        <div>
          <span className="eyebrow">Profile</span>
          <h2>{profile.name || "User Profile"}</h2>
        </div>
      </section>

      <section className="profile-grid">
        <aside className="profile-summary">
          <div className="profile-avatar"><UserRound size={34} /></div>
          <strong>{profile.name || "Name not set"}</strong>
          <span>{profile.role}</span>
          <small>{profile.campus}</small>
        </aside>

        <form className="chart-card profile-form" onSubmit={saveProfile}>
          <div className="form-grid">
            <Field icon={UserRound} label="Name" value={profile.name} onChange={(value) => updateProfile("name", value)} />
            <Field icon={Mail} label="Email" type="email" value={profile.email} onChange={(value) => updateProfile("email", value)} />
            <Field icon={Phone} label="Mobile" value={profile.phone || ""} onChange={(value) => updateProfile("phone", value.replace(/\D/g, "").slice(0, 10))} />
            <Field icon={ShieldCheck} label="Role" value={profile.role} onChange={(value) => updateProfile("role", value)} />
            <Field icon={School} label="School / Campus" value={profile.campus} onChange={(value) => updateProfile("campus", value)} />
            <Field icon={School} label="Academic year" value={profile.academicYear} onChange={(value) => updateProfile("academicYear", value)} />
          </div>
          {saved && <p className="inline-success">Profile saved.</p>}
          <button className="primary-button" type="submit"><Save size={18} /> Save Profile</button>
        </form>
      </section>
    </div>
  );
}

function Field({ icon, label, value, onChange, type = "text" }) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="input-with-icon">
        {createElement(icon, { size: 17 })}
        <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
      </div>
    </label>
  );
}

export default ProfilePage;
