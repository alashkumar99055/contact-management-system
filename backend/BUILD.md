# Backend Build & Run Instructions

## Prerequisites
- Java 17+ (check with `java -version`)
- PostgreSQL running locally (default: localhost:5432)

## Local Development - Build Scripts (Recommended)

### Windows PowerShell
```powershell
cd backend

# Build and compile
.\build.ps1 build

# Run the backend
.\build.ps1 run

# Or build and run together
.\build.ps1 rebuild

# Clean compiled files
.\build.ps1 clean
```

### Windows Command Prompt
```cmd
cd backend

# Build and compile
build.cmd build

# Run the backend
build.cmd run

# Or build and run together
build.cmd rebuild

# Clean compiled files
build.cmd clean
```

### All Platforms - Using start.ps1 (PowerShell)
```powershell
# From project root
powershell -ExecutionPolicy Bypass -File start.ps1
```

The build scripts automatically:
- Download the PostgreSQL JDBC driver (42.6.0) if needed
- Compile all Java source files
- Start the backend server on `http://0.0.0.0:8080`

## Database Configuration

By default, the backend connects to:
- Host: `localhost`
- Port: `5432`
- Database: `contactflow`
- User: `postgres`
- Password: `postgres`

### Using Custom Database Settings
Set environment variables before running:

**PowerShell:**
```powershell
$env:POSTGRES_URL = "jdbc:postgresql://localhost:5432/contactflow"
$env:POSTGRES_USER = "postgres"
$env:POSTGRES_PASSWORD = "postgres"
.\build.ps1 run
```

**Command Prompt:**
```cmd
set POSTGRES_URL=jdbc:postgresql://localhost:5432/contactflow
set POSTGRES_USER=postgres
set POSTGRES_PASSWORD=postgres
build.cmd run
```

Or use PostgreSQL environment variables:
```powershell
$env:PGHOST = "localhost"
$env:PGPORT = "5432"
$env:PGDATABASE = "contactflow"
$env:PGUSER = "postgres"
$env:PGPASSWORD = "postgres"
.\build.ps1 run
```

## Maven Build (Alternative - for Production/Render)

If Maven 3.9+ is installed:

```bash
cd backend
mvn clean package
java -jar target/app.jar
```

This creates a fat JAR with all dependencies included at `target/app.jar`.

## PostgreSQL Setup

Make sure PostgreSQL is running and the database exists:

```sql
-- Create database if needed
CREATE DATABASE contactflow;
```

The schema tables (authentication, contacts) will be created automatically on first run.

## Render Deployment

The project is configured for Render deployment:
- **Build**: Uses Maven in Docker container
- **Runtime**: Java 17 JDK running the fat JAR
- **Database**: PostgreSQL connection string via `DATABASE_URL` environment variable

The Docker build process:
1. Downloads Maven and all dependencies
2. Compiles all Java sources
3. Creates a fat JAR with PostgreSQL driver included
4. Runs the JAR with PostgreSQL connection from Render

## Troubleshooting

### Error: "No suitable driver found for jdbc:postgresql"
**Cause**: PostgreSQL driver not on classpath
**Solution**: Use the build scripts which automatically download the driver
```powershell
.\build.ps1 build   # Downloads driver
.\build.ps1 run     # Uses driver on classpath
```

### Error: "Connection to localhost:5432 refused"
**Cause**: PostgreSQL not running
**Solution**: 
1. Start PostgreSQL server
2. Verify database exists: `psql -U postgres -d contactflow`
3. Create if needed: `psql -U postgres -c "CREATE DATABASE contactflow;"`

### Error: "Connection refused" on Render
The environment variable `DATABASE_URL` will be injected automatically by Render. If testing locally, set it to your local database URL.

## Verification

After starting the backend, verify it's working:

```powershell
# Test backend health
$response = Invoke-WebRequest -Uri "http://localhost:8080"
$response.StatusCode  # Should be 200 or 404 (both indicate server is running)

# Test API - register a new user
$body = @{username="testuser"; password="testpass"} | ConvertTo-Json
$response = Invoke-RestMethod -Uri "http://localhost:8080/api/register" -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body
$response  # Should return the session token
```

## Project Structure

```
backend/
├── src/               # Java source files
│   ├── Main.java
│   ├── Server.java
│   ├── Database.java
│   ├── User.java
│   ├── Contact.java
│   └── Category.java
├── target/
│   ├── classes/       # Compiled .class files
│   └── app.jar        # (If Maven build)
├── lib/               # Dependencies (downloaded automatically)
│   └── postgresql-42.6.0.jar
├── pom.xml            # Maven configuration
├── Dockerfile         # Docker build for production
├── build.ps1          # PowerShell build script
├── build.cmd          # Command Prompt build script
└── BUILD.md           # This file
```
