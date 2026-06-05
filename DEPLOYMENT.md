# Deployment Guide

This repo contains both apps:

- `backend`: Express API for Render
- `admin-dashboard`: Vite React dashboard for Vercel

Do not commit `.env`, `.env.local`, `node_modules`, `dist`, or Supabase secret/service-role keys.

## 1. Backend On Render

Create a Render Web Service from this GitHub repo.

Use these settings:

```text
Root Directory: backend
Build Command: npm install
Start Command: npm start
```

Add these Render environment variables:

```env
SUPABASE_URL=https://wuuaqnxomsdgkivmdyxs.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-secret-service-role-key
SUPABASE_RECORDS_TABLE=school_records
JWT_SECRET=make-this-a-long-random-secret
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://your-dashboard-domain.vercel.app
CORS_ORIGINS=https://your-dashboard-domain.vercel.app,https://savvymotherschool.github.io
```

After deployment, check:

```text
https://your-render-service.onrender.com/health
```

## 2. Admin Dashboard On Vercel

Create a Vercel project from the same GitHub repo.

Use these settings:

```text
Root Directory: admin-dashboard
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
```

Add this Vercel environment variable:

```env
VITE_API_BASE_URL=https://your-render-service.onrender.com/api
```

The dashboard includes `admin-dashboard/vercel.json`, so direct routes like `/login` work after refresh.

## 3. Connect The Public Website

After Vercel gives the dashboard URL, set the public website login URL before `school-management-login.js` loads:

```html
<script>
  window.SCHOOL_MANAGEMENT_LOGIN_URL = "https://your-dashboard-domain.vercel.app/login";
</script>
<script src="school-management-login.js"></script>
```

Then push the public website repo to GitHub Pages.
