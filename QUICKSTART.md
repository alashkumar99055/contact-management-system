# Quick Start Guide - ContactFlow Backend

## One-Time Setup

### 1. Ensure PostgreSQL is running
```bash
# Create database if needed
psql -U postgres -c "CREATE DATABASE contactflow;"
```

### 2. Compile the Backend
```powershell
cd backend
.\build.ps1 build
```

This will:
- Download PostgreSQL JDBC driver automatically (1st time only)
- Compile all Java source files
- Generate compiled .class files in `target/classes/`

## Running the Backend

```powershell
cd backend
.\build.ps1 run
```

You should see:
```
Starting ContactFlow Backend...
Listening on http://0.0.0.0:8080
Database: jdbc:postgresql://localhost:5432/contactflow
Press Ctrl+C to stop
```

## One-Command Build & Run

```powershell
cd backend
.\build.ps1 rebuild
```

## Using from Project Root

```powershell
powershell -ExecutionPolicy Bypass -File start.ps1
```

## Alternative: Command Prompt (Windows)

```cmd
cd backend
build.cmd rebuild
```

## Docker/Render Deployment

The Dockerfile is configured to:
1. Use Maven to build
2. Download all dependencies
3. Create a fat JAR with PostgreSQL driver included
4. Run the JAR on Render

No additional configuration needed!

## Troubleshooting

### "No suitable driver found" error
**OLD PROBLEM - NOW FIXED!**
- The PostgreSQL JDBC driver is now explicitly loaded in Database.java
- The build scripts ensure it's on the classpath
- You should see "Connection refused" instead (PostgreSQL not running)

### "Connection refused"
PostgreSQL isn't running:
```bash
psql -U postgres -d contactflow
```

If database doesn't exist:
```bash
psql -U postgres -c "CREATE DATABASE contactflow;"
```

## Files Reference

**Build Scripts:**
- `backend/build.ps1` - PowerShell build script
- `backend/build.cmd` - Command Prompt build script  
- `backend/BUILD.md` - Detailed build documentation
- `start.ps1` - All-in-one launcher from project root

**Key Changes:**
- `backend/src/Database.java` - Added PostgreSQL driver loading
- `backend/pom.xml` - Enhanced for Maven Shade plugin
- `JDBC_DRIVER_FIX.md` - Complete technical documentation

## API Endpoints

All working (no changes):
- `POST /api/register` - Register new user
- `POST /api/login` - Login
- `POST /api/logout` - Logout
- `GET /api/me` - Get current user
- `GET/POST /api/contacts` - Manage contacts
- `GET /api/dashboard` - Dashboard data
- `GET /api/categories` - Get categories
- `POST /api/contacts/export` - Export contacts
- `POST /api/contacts/import` - Import contacts
