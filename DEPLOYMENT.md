# PENJAGA Production Deployment Guide

Phase 5 readiness evidence and pending operator checks are in [DEPLOYMENT_READINESS.md](docs/psm-evaluation/DEPLOYMENT_READINESS.md). Local tests and Git pushes do not constitute production deployment.

Apply `backend/database/migrations/003_lokasi_3d.sql` after the schema (`node backend/scripts/migrate-3d.js`). Fresh Compose volumes now run it automatically; existing volumes require explicit migration. It preserves existing mappings and does not reset data.

Production requires a unique non-placeholder `JWT_SECRET` and explicit `FRONTEND_URL`. Use `TRUST_PROXY=1` only behind one trusted reverse proxy with direct API access blocked; otherwise use 0. Configured database TLS now verifies certificates; provide a trusted CA through `PGSSL_CA` when required by the database provider. Publish built `dist` only, and keep uploads behind the authenticated API. The separate Phase 5 demo credentials/data must never be used as production accounts.

This guide provides end-to-end instructions for deploying the **PENJAGA Security Operations Management System** to production.

---

## 🎯 Deployment Options Overview

| Method | Best For | Complexity | Database | Persistent Uploads |
| :--- | :--- | :--- | :--- | :--- |
| **Option 1: Modern Cloud PaaS** | Fast, free-tier friendly, minimal DevOps | Low | Supabase / Neon | Cloud Storage / Volume |
| **Option 2: Docker Compose** | Dedicated VPS (DigitalOcean, AWS, Linode) | Low-Medium | Bundled Container | Docker Volume |
| **Option 3: Bare-Metal VPS (PM2 + Nginx)** | Full control, enterprise Linux server | Medium | Local / Managed Postgres | Local filesystem |

---

## ☁️ Option 1: Modern Cloud Deployment (Vercel + Render + Supabase)

### 1. Database (Supabase / Neon)
1. Create a new PostgreSQL project on [Supabase](https://supabase.com) or [Neon](https://neon.tech).
2. Copy the **Direct Connection String** or **Transaction Pooler URL** (`postgres://...`).
3. In Supabase SQL Editor, run:
   - `backend/database/schema.sql`
   - `backend/database/seed.sql`

### 2. Backend (Render / Railway)
1. Create a new **Web Service** pointing to your repository's `/backend` directory.
2. **Build Command**: `npm ci --omit=dev`
3. **Start Command**: `node server.js`
4. Set Environment Variables:
   ```env
   NODE_ENV=production
   PORT=3000
   JWT_SECRET=your_super_strong_random_secret_at_least_32_characters
   DATABASE_URL=your_supabase_postgresql_connection_string
   FRONTEND_URL=https://your-frontend.vercel.app
   ```
5. Note your deployed backend URL: `https://your-api.onrender.com`.

### 3. Frontend (Vercel / Netlify)
1. Import repository on [Vercel](https://vercel.com).
2. **Framework Preset**: Vite
3. **Build Command**: `npm run build`
4. **Output Directory**: `dist`
5. Set Environment Variables:
   ```env
   VITE_API_URL=https://your-api.onrender.com/api
   VITE_API_ORIGIN=https://your-api.onrender.com
   ```
6. Deploy! React Router deep links are automatically handled via `vercel.json` and `public/_redirects`.

---

## 🐳 Option 2: Docker Compose (One-Command Deployment)

Deploy PostgreSQL, Backend API, and Frontend Nginx in synchronized containers.

### 1. Requirements
- Docker & Docker Compose installed on your host/VPS.

### 2. Launch Stack
```bash
# 1. Clone repository
git clone <your-repo-url>
cd AI-Security-Sytem-Scheduling-Reporting

# 2. Configure required secrets and the public frontend origin.
# Generate unique values; do not reuse these commands' placeholder text as secrets.
export POSTGRES_PASSWORD="<unique-database-password>"
export JWT_SECRET="<unique-random-secret-at-least-32-characters>"
export FRONTEND_URL="http://<your-server-ip>"

# 3. Build & start all services in detached mode
docker compose up -d --build
```

The database and API are available only on the internal Compose network. Only the frontend's
HTTP port is published by default. Put a TLS-terminating reverse proxy in front of it for
public deployments, and set `FRONTEND_URL` to the exact browser origin (include `https://`
when TLS is enabled). For local access, use `http://localhost`.

The schedule CSV import expects these exact header names:

```csv
id_pengguna,id_pos,tarikh_tugas,syif,masa_mula,masa_tamat,catatan
```

Dates use `YYYY-MM-DD`; times use `HH:MM` or `HH:MM:SS`; supported shifts are `Pagi`,
`Petang`, `Malam`, and `Office Hour`.

### 3. Verification
- Frontend & App: `http://<your-server-ip>`
- Backend Health Check: `http://<your-server-ip>/api/health`
- Backend DB Readiness: `http://<your-server-ip>/api/ready`

---

## 🖥️ Option 3: VPS Deployment (PM2 + Nginx + Certbot)

### 1. Server Setup (Ubuntu 22.04 / 24.04 LTS)
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nodejs npm nginx postgresql postgresql-contrib git
sudo npm install -g pm2
```

### 2. Database Initialization
```bash
sudo -u postgres psql
CREATE DATABASE penjaga_db;
CREATE USER penjaga_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE penjaga_db TO penjaga_user;
\q

# Apply schema & seed data
psql -U penjaga_user -d penjaga_db -h localhost -f backend/database/schema.sql
psql -U penjaga_user -d penjaga_db -h localhost -f backend/database/seed.sql
```

### 3. Backend with PM2
```bash
cd backend
cp .env.production.example .env
# Edit .env with your real JWT_SECRET and DATABASE_URL
nano .env

npm install --omit=dev
pm2 start server.js --name "penjaga-api"
pm2 save
pm2 startup
```

### 4. Build Frontend
```bash
cd ..
npm install
VITE_API_URL=/api npm run build
sudo cp -r dist/* /var/www/penjaga/
```

### 5. Nginx Configuration
Edit `/etc/nginx/sites-available/penjaga`:
```nginx
server {
    listen 80;
    server_name penjaga.yourdomain.com;

    root /var/www/penjaga;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:3000/uploads/;
        proxy_set_header Host $host;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```
Enable site and add SSL:
```bash
sudo ln -s /etc/nginx/sites-available/penjaga /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d penjaga.yourdomain.com
```

---

## 🔒 Security & Operations Checklist

- [ ] `JWT_SECRET` is at least 32 random characters and not a development default.
- [ ] Database credentials and connection strings are securely stored in environment variables.
- [ ] HTTPS (TLS/SSL) is enabled on public endpoints.
- [ ] Automated database backup is scheduled (`pg_dump`).
- [ ] `npm run check` passes before pushing code.
