// src/api.js
import axios from "axios";

const api = axios.create({
  baseURL: "/api", // or "http://localhost:5000/api" if you don't use Vite proxy
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("erp_token") || sessionStorage.getItem("erp_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const authAPI = {
  register: (data) => api.post("/auth/register", data),
  login: (data) => api.post("/auth/login", data),
  verifyOtp: (data) => api.post("/auth/verify-otp", data),
  forgotPassword: (data) => api.post("/auth/forgot-password", data),
  me: () => api.get("/auth/me"),
  confirmPassword: (password) => api.post("/auth/confirm-password", { password }),
  listUsers: () => api.get("/auth/users"),
  createUser: (data) => api.post("/auth/users", data),
  updateUser: (id, data) => api.put(`/auth/users/${id}`, data),
  deleteUser: (id, password) => api.delete(`/auth/users/${id}`, { data: { password } }),
};

export const erpAPI = {
  analytics: () => api.get("/erp/analytics"),
  auditLogs: (params) => api.get("/erp/audit-logs", { params }),
  list: (module) => api.get(`/erp/${module}`),
  create: (module, data) => api.post(`/erp/${module}`, data),
  update: (module, id, data) => api.put(`/erp/${module}/${id}`, data),
  remove: (module, id) => api.delete(`/erp/${module}/${id}`),
};

export const uploadsAPI = {
  image: (file) => {
    const data = new FormData();
    data.append("image", file);
    return api.post("/uploads/image", data);
  },
};

export const schoolsAPI = {
  getAll: () => api.get("/schools"),
  create: (data) => api.post("/schools", data),
};

export const classesAPI = {
  getAll: () => api.get("/classes"),
  getById: (id) => api.get(`/classes/${id}`),
  create: (data) => api.post("/classes", data),
  update: (id, data) => api.put(`/classes/${id}`, data),
  remove: (id) => api.delete(`/classes/${id}`),
};

// IMPORTANT: use className here, not classId
export const homeworkAPI = {
  list: (className, date) =>
    api.get("/homework", {
      params: { className, date },
    }),
  create: (data) => api.post("/homework", data),
  update: (id, data) => api.put(`/homework/${id}`, data),
  remove: (id) => api.delete(`/homework/${id}`),
};

export const classNoticesAPI = {
  list: (className, date) =>
    api.get("/class-notices", {
      params: { className, date },
    }),
  getAll: () => api.get("/class-notices"),
  create: (data) => api.post("/class-notices", data),
  update: (id, data) => api.put(`/class-notices/${id}`, data),
  remove: (id) => api.delete(`/class-notices/${id}`),
};

export const studentsAPI = {
  getAll: () => api.get("/students"),
  getById: (id) => api.get(`/students/${id}`),
  create: (data) => api.post("/students", data),
  update: (id, data) => api.put(`/students/${id}`, data),
  remove: (id) => api.delete(`/students/${id}`),
  getClasses: () => api.get("/students/classes/distinct"),
};

export const attendanceAPI = {
  // mark daily attendance for many students
  mark: (data) => api.post("/attendance/mark", data),

  // get one student's full month register
  getStudentMonth: (studentId, month, year) =>
    api.get(`/attendance/student/${studentId}/month`, {
      params: { month, year },
    }),

  // NEW: get one student's annual (April–March) attendance percentage
  getStudentYear: (studentId, startYear) =>
    api.get(`/attendance/student/${studentId}/year`, {
      params: { year: startYear },
    }),
};

export const feesAPI = {
  // list all plans
  getAll: () => api.get("/fees"),

  // detail for one student+year
  getForStudentYear: (studentId, academicYear) =>
    api.get(`/fees/student/${studentId}/year/${academicYear}`),

  // all plans of one student (student app)
  getByStudent: (studentId) => api.get(`/fees/student/${studentId}`),

  // create tuition plan
  createTuition: (data) => api.post("/fees/create-tuition", data),

  // add exam/activity/etc.
  addItem: (data) => api.post("/fees/add-item", data),

  // toggle month (tuition) with optional paidDate
  toggleMonth: (feeId, itemId, monthName, paidDate) =>
    api.patch(`/fees/${feeId}/toggle-month`, {
      itemId,
      monthName,
      paidDate,
    }),

  // toggle one-time item with optional paidDate
  toggleItem: (feeId, itemId, paidDate) =>
    api.patch(`/fees/${feeId}/toggle-item`, {
      itemId,
      paidDate,
    }),

  // delete/reset plan
  removePlan: (feeId) => api.delete(`/fees/${feeId}`),
};

export const noticesAPI = {
  create: (payload) => api.post("/class-notices", payload),
  getAll: () => api.get("/class-notices"),
  getById: (id) => api.get(`/class-notices/${id}`),
  update: (id, payload) => api.put(`/class-notices/${id}`, payload),
  remove: (id) => api.delete(`/class-notices/${id}`),
};

export default api;
