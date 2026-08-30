# 🚀 Render Deployment Guide - ContactFlow

## ✅ Deployment Status

Your application is **production-ready** for Render deployment!

### What's Been Prepared
✅ PostgreSQL JDBC driver properly configured  
✅ Maven build system ready for Docker  
✅ Database connection handles Render's `DATABASE_URL`  
✅ Frontend configuration for dynamic API URL  
✅ All code committed to git  
✅ render.yaml and Dockerfile configured  

---

## 📋 Pre-Deployment Checklist

Before deploying to Render, verify:

- [ ] You have a Render account (https://render.com)
- [ ] Your git repo is pushed to GitHub
- [ ] You have access to the GitHub repository
- [ ] Render is connected to your GitHub account

---

## 🚀 Deployment Steps

### Step 1: Connect Repository to Render

1. Go to https://dashboard.render.com
2. Click **"New"** → **"Blueprint"**
3. Select your GitHub repository containing this project
4. Click **"Connect"**

### Step 2: Render Reads render.yaml

Render automatically reads your `render.yaml` and will:
- Create a PostgreSQL database named `contactflow-db`
- Create a backend service from `./backend/Dockerfile`
- Create a frontend service from `./frontend` directory
- Auto-inject `DATABASE_URL` to backend
- Auto-inject `BACKEND_URL` to frontend

### Step 3: Deploy

1. Review the services Render proposes:
   - **contactflow-backend** (Docker web service)
   - **contactflow-frontend** (Static site)
   - **contactflow-db** (PostgreSQL database)

2. Click **"Deploy"** button

3. Wait for deployment (typically 3-5 minutes):
   - Backend Docker build and deployment
   - Frontend build with dynamic URL injection
   - Database creation and initialization

### Step 4: Verify Deployment

Once deployment completes:

#### Check Backend Health
```
GET https://<backend-url>/
```
Should return: `200 OK` (or 404 for root endpoint)

#### Check Database Connection
```
POST https://<backend-url>/api/register
Content-Type: application/json

{
  "username": "testuser",
  "password": "testpass123"
}
```
Expected response: Session token or registration success

#### Check Frontend
Open `https://<frontend-url>` in browser
- Should load ContactFlow login page
- Try registering a new account
- Verify backend API communication works

---

## 🔐 Environment Configuration

Render will automatically handle:

| Variable | Source | Value |
|----------|--------|-------|
| `DATABASE_URL` | Auto-generated | PostgreSQL connection string |
| `CORS_ORIGINS` | render.yaml | Frontend domain (auto-injected) |
| `PORT` | Render | `8080` (Java backend) |

Your code automatically detects and uses `DATABASE_URL` via:
```java
// Server.java
String url = System.getenv("DATABASE_URL");
```

---

## 📊 Database Details

### Auto-Created on First Run
The backend automatically creates the schema:
- **authentication** table (users)
- **contacts** table (contact entries)
- Indexes for performance

### Your Existing Data
✅ If you already have data in your local database:
1. Export your contacts (API or direct SQL)
2. Use the backend's import endpoint: `POST /api/contacts/import`
3. Or use `psql` if you need direct database access

### PostgreSQL Access (if needed)
Render provides read-only database connection details in your dashboard.

---

## 🎯 What Gets Deployed

### Backend (`contactflow-backend`)
- Docker image built from `backend/Dockerfile`
- Uses Maven to compile Java and create fat JAR
- Runs on `Port 8080`
- Auto-connects to PostgreSQL via `DATABASE_URL`
- Serves API endpoints: `/api/*`

### Frontend (`contactflow-frontend`)
- Static site from `frontend/` directory
- Runs build command: `sed -i "s|__BACKEND_URL__|https://${BACKEND_HOST}|g" frontend/config.js`
- This replaces `__BACKEND_URL__` with actual backend URL
- Serves: `index.html`, `login.html`, `script.js`, `style.css`

### Database (`contactflow-db`)
- PostgreSQL 14+ (Render's default)
- Named: `contactflow`
- Auto-initialized on backend start
- Persisted across deployments

---

## 🔍 Post-Deployment Verification

### 1. Check Backend Logs
In Render Dashboard → Backend Service → Logs:
```
Connecting to database: jdbc:postgresql://...
ContactFlow server started on http://0.0.0.0:8080
```

### 2. Test API Endpoints
```powershell
$backendUrl = "https://your-backend.onrender.com"

# Test register
$response = Invoke-RestMethod -Uri "$backendUrl/api/register" -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body (@{username="test"; password="test123"} | ConvertTo-Json)
  
Write-Host $response  # Should return session token
```

### 3. Test Frontend
Open `https://your-frontend.onrender.com` in browser:
- [ ] Page loads without errors
- [ ] Login form appears
- [ ] Can register new account
- [ ] Can add contacts
- [ ] API calls work

### 4. Monitor Resources
Render Dashboard shows:
- CPU/Memory usage
- Build/deployment logs
- Database statistics
- Error tracking

---

## ⚠️ Troubleshooting

### Backend Won't Start
**Check logs for:**
```
PostgreSQL JDBC driver not found
→ pom.xml dependency issue (should be fixed)

Connection to postgres... refused  
→ Database initializing (normal, wait 30 seconds)

java.sql.SQLException: ERROR: syntax error
→ Schema migration issue (check schema.sql)
```

### Frontend Shows 404 for API
**Verify:**
1. Backend service is running (check dashboard)
2. Frontend config.js has correct BACKEND_URL
3. Backend CORS is accepting requests

### Database Connection Fails
**Check:**
1. DATABASE_URL is set in environment
2. Database service is running
3. Password/permissions are correct

---

## 🔄 Updating Your Application

After deployment, to make updates:

1. Make changes locally
2. Test with `.\build.ps1 rebuild`
3. Commit to git: `git add -A && git commit -m "message"`
4. Push to GitHub: `git push origin main`
5. Render automatically redeploys on push!

### Force Redeploy (if needed)
Render Dashboard → Service → Manual Deploy → Deploy

---

## 📈 Production Best Practices

✅ **Already Implemented:**
- PostgreSQL connection pooling (via JDBC driver)
- Secure password hashing (SHA-256 with salt)
- Session token management
- CORS configuration
- Database indexes for performance
- Error handling and logging

### Recommendations:
- Monitor logs regularly
- Set up uptime monitoring (Render's Health Checks)
- Backup database periodically
- Review logs for errors/warnings

---

## 📞 Quick Support

If deployment has issues:

1. **Check Render Dashboard Logs** (most common solution)
   - Backend service logs
   - Build logs
   - Database logs

2. **Verify Git Push**
   ```bash
   git log --oneline -5  # See recent commits
   git push origin main  # Ensure pushed
   ```

3. **Manual Database Check**
   Get connection details from Render Dashboard:
   ```bash
   psql <connection_string>
   \dt  # List tables (should show authentication, contacts)
   ```

4. **Render Support**
   - https://render.com/support
   - Check status page: https://status.render.com

---

## ✨ You're Ready to Deploy!

Your application is fully configured for Render. The deployment process is automated:

1. **Push** your code (already done ✅)
2. **Connect** your GitHub repo to Render
3. **Deploy** via Blueprint
4. **Verify** the live application

**Next Step:**
Go to https://dashboard.render.com and connect your GitHub repository to deploy!

---

## 📝 Configuration Summary

| Component | Config File | Key Settings |
|-----------|------------|--------------|
| **Deployment** | `render.yaml` | Services, databases, environment variables |
| **Backend Build** | `backend/Dockerfile` | Maven build, Java 17, app.jar |
| **Backend Logic** | `backend/src/Server.java` | DATABASE_URL handling, API endpoints |
| **Frontend** | `frontend/config.js` | __BACKEND_URL__ placeholder replacement |
| **Database** | `backend/src/Database.java` | Schema auto-creation, connection pooling |

All files are production-ready and committed to git. ✅
