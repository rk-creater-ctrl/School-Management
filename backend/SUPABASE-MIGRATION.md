# Supabase Migration

This backend now uses Supabase instead of MongoDB for school records.

## 1. Create The Table

Open Supabase Dashboard, then go to SQL Editor and run:

```sql
-- Paste the contents of backend/supabase-schema.sql
```

This creates `public.school_records`, a JSON document table used by the existing Express API.

## 2. Add Backend Environment Values

Create `backend/.env.local` and set:

```env
SUPABASE_URL=https://wuuaqnxomsdgkivmdyxs.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret-key
SUPABASE_RECORDS_TABLE=school_records
JWT_SECRET=change_this_to_a_long_random_secret
```

Use the Supabase **secret/service role key** only in the backend. Do not add it to React, Vercel frontend env, or GitHub Pages.

## 3. Run Backend

```bash
cd "C:\Users\hp\Desktop\School Management\backend"
npm run dev
```

If the table or key is missing, startup will print a Supabase connection error.

## 4. Run Dashboard

```bash
cd "C:\Users\hp\Desktop\School Management\admin-dashboard"
npm run dev
```

The first registered account becomes `superadmin`.

## 5. Deployment

Backend hosting should use these environment variables:

```env
SUPABASE_URL=https://wuuaqnxomsdgkivmdyxs.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret-key
SUPABASE_RECORDS_TABLE=school_records
JWT_SECRET=change_this_to_a_long_random_secret
CORS_ORIGINS=https://your-admin-dashboard-domain.vercel.app
```

Frontend hosting should set:

```env
VITE_API_BASE_URL=https://your-backend-domain.onrender.com/api
```
