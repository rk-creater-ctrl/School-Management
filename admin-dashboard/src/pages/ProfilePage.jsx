import { createElement, useState } from "react";
import { LockKeyhole, Mail, Phone, Save, School, ShieldCheck, Upload, UserRound } from "lucide-react";
import { authAPI, uploadsAPI } from "../api";
import AcademicYearSelect from "../components/AcademicYearSelect";
import { getCurrentAcademicYear, normalizeAcademicYear } from "../utils/academicYear";
import { getSessionUser, updateActiveUser } from "../utils/session";

const fallbackUser = {
  name: "",
  email: "",
  phone: "",
  role: "admin",
  campus: "School ERP",
  academicYear: getCurrentAcademicYear(),
  profilePhotoUrl: "",
};

const emptyPasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
  note: "",
};

function readUser() {
  return { ...fallbackUser, ...getSessionUser({}) };
}

function ProfilePage() {
  const [profile, setProfile] = useState(readUser);
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [passwordStatus, setPasswordStatus] = useState("");
  const isSuperadmin = profile.role === "superadmin";
  const needsSuperadminPasswordApproval =
    profile.role === "admin" || (Array.isArray(profile.permissions) && profile.permissions.includes("admin"));

  function updateProfile(field, value) {
    setProfile((current) => ({ ...current, [field]: value }));
    setSaved(false);
    setStatus("");
  }

  function updatePasswordForm(field, value) {
    setPasswordForm((current) => ({ ...current, [field]: value }));
    setPasswordStatus("");
  }

  async function uploadProfilePhoto(file) {
    if (!file) return;
    try {
      setPhotoUploading(true);
      const res = await uploadsAPI.profilePhoto(file);
      updateProfile("profilePhotoUrl", res.data.fileUrl);
      setStatus("Photo uploaded. Save profile to keep it.");
    } catch (error) {
      setStatus(error.response?.data?.error || "Unable to upload photo.");
    } finally {
      setPhotoUploading(false);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    try {
      const payload = {
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        campus: profile.campus,
        academicYear: normalizeAcademicYear(profile.academicYear),
        profilePhotoUrl: profile.profilePhotoUrl,
      };
      const res = await authAPI.updateMe(payload);
      const normalizedProfile = { ...fallbackUser, ...(res.data.user || {}) };
      updateActiveUser(normalizedProfile);
      setProfile(normalizedProfile);
      setSaved(true);
      setStatus("");
    } catch (error) {
      setSaved(false);
      setStatus(error.response?.data?.error || "Unable to save profile.");
    }
  }

  async function requestPasswordChange(event) {
    event.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordStatus("New password and confirmation do not match.");
      return;
    }

    try {
      await authAPI.requestPasswordChange({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        note: passwordForm.note,
      });
      setPasswordForm(emptyPasswordForm);
      setPasswordStatus(
        needsSuperadminPasswordApproval
          ? "Password request sent to superadmin for approval."
          : "Password request sent to admin and superadmin for approval."
      );
    } catch (error) {
      setPasswordStatus(error.response?.data?.error || "Unable to send password request.");
    }
  }

  return (
    <div className="profile-page">
      <section className="module-hero">
        <div>
          <span className="eyebrow">Profile</span>
          <h2>{profile.name || "User Profile"}</h2>
        </div>
      </section>

      {status && <div className="inline-alert">{status}</div>}

      <section className="profile-grid">
        <aside className="profile-summary">
          <div className="profile-avatar">
            {profile.profilePhotoUrl ? <img src={profile.profilePhotoUrl} alt="" /> : <UserRound size={34} />}
          </div>
          <strong>{profile.name || "Name not set"}</strong>
          <span>{profile.role}</span>
          <small>{profile.campus}</small>
          <label className="secondary-button profile-photo-button">
            <Upload size={16} /> {photoUploading ? "Uploading" : "Upload Photo"}
            <input
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              type="file"
              onChange={(event) => uploadProfilePhoto(event.target.files?.[0])}
            />
          </label>
        </aside>

        <form className="chart-card profile-form" onSubmit={saveProfile}>
          <div className="form-grid">
            <Field icon={UserRound} label="Name" value={profile.name} onChange={(value) => updateProfile("name", value)} />
            <Field icon={Mail} label="Email" type="email" value={profile.email} onChange={(value) => updateProfile("email", value)} />
            <Field icon={Phone} label="Mobile" value={profile.phone || ""} onChange={(value) => updateProfile("phone", value.replace(/\D/g, "").slice(0, 10))} />
            <Field icon={ShieldCheck} label="Role" value={profile.role} disabled onChange={() => {}} />
            <Field icon={School} label="School / Campus" value={profile.campus} onChange={(value) => updateProfile("campus", value)} />
            <AcademicYearSelect className="field" value={profile.academicYear} onChange={(value) => updateProfile("academicYear", value)} />
          </div>
          {saved && <p className="inline-success">Profile saved.</p>}
          <button className="primary-button" type="submit"><Save size={18} /> Save Profile</button>
        </form>
      </section>

      {!isSuperadmin && (
        <form className="chart-card profile-form" onSubmit={requestPasswordChange}>
          <div className="section-heading">
            <div>
              <span className="eyebrow">Approval Required</span>
              <h3>Password Change Request</h3>
            </div>
            <LockKeyhole size={20} />
          </div>
          <div className="form-grid">
            <Field
              icon={LockKeyhole}
              label="Current password"
              type="password"
              value={passwordForm.currentPassword}
              onChange={(value) => updatePasswordForm("currentPassword", value)}
            />
            <Field
              icon={LockKeyhole}
              label="New password"
              type="password"
              value={passwordForm.newPassword}
              onChange={(value) => updatePasswordForm("newPassword", value)}
            />
            <Field
              icon={LockKeyhole}
              label="Confirm new password"
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(value) => updatePasswordForm("confirmPassword", value)}
            />
            <label className="field">
              <span>Note</span>
              <textarea rows={3} value={passwordForm.note} onChange={(event) => updatePasswordForm("note", event.target.value)} />
            </label>
          </div>
          {passwordStatus && <div className="inline-alert">{passwordStatus}</div>}
          <button className="primary-button" type="submit"><LockKeyhole size={18} /> Send Request</button>
        </form>
      )}
    </div>
  );
}

function Field({ disabled = false, icon, label, value, onChange, type = "text" }) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="input-with-icon">
        {createElement(icon, { size: 17 })}
        <input disabled={disabled} type={type} value={value || ""} onChange={(event) => onChange(event.target.value)} />
      </div>
    </label>
  );
}

export default ProfilePage;
