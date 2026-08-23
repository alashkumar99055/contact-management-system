# ContactFlow — compile & start backend
# Requires: PostgreSQL running on localhost:5432 with database "contactflow"
#
# Quick PostgreSQL setup (run once):
#   psql -U postgres -c "CREATE DATABASE contactflow;"
#
# Set custom DB credentials before running this script if needed:
#   $env:PGPASSWORD = "your-password"
#   $env:PGUSER     = "your-username"
#   $env:PGDATABASE = "contactflow"
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File start.ps1

$pgJar  = "$env:USERPROFILE\.m2\repository\org\postgresql\postgresql\42.6.0\postgresql-42.6.0.jar"
$srcDir = "$PSScriptRoot\backend\src"
$outDir = "$PSScriptRoot\backend\target\classes"

# ── 1. Check Java ─────────────────────────────────────────────────
try { $jv = java -version 2>&1 | Select-String "version"; Write-Host "Java: $jv" -ForegroundColor Cyan }
catch { Write-Host "ERROR: Java not found. Install JDK 17+." -ForegroundColor Red; Read-Host "Press Enter"; exit 1 }

# ── 2. Check PostgreSQL JAR ───────────────────────────────────────
if (-not (Test-Path $pgJar)) {
    Write-Host "Downloading PostgreSQL driver..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path (Split-Path $pgJar) -Force | Out-Null
    Invoke-WebRequest -Uri "https://repo1.maven.org/maven2/org/postgresql/postgresql/42.6.0/postgresql-42.6.0.jar" -OutFile $pgJar -UseBasicParsing
}
Write-Host "PostgreSQL driver: OK" -ForegroundColor Cyan

# ── 3. Compile ────────────────────────────────────────────────────
Write-Host "`n[1/2] Compiling backend..." -ForegroundColor Cyan
New-Item -ItemType Directory -Path $outDir -Force | Out-Null
Remove-Item "$outDir\*.class" -ErrorAction SilentlyContinue

$errors = javac -cp $pgJar -d $outDir `
    "$srcDir\User.java" `
    "$srcDir\Contact.java" `
    "$srcDir\Database.java" `
    "$srcDir\Server.java" `
    "$srcDir\Main.java" 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "Compile errors:" -ForegroundColor Red
    $errors | ForEach-Object { Write-Host $_ }
    Read-Host "Press Enter to exit"; exit 1
}
Write-Host "  Compiled OK" -ForegroundColor Green

# ── 4. Start ──────────────────────────────────────────────────────
Write-Host "`n[2/2] Starting ContactFlow backend on http://localhost:8080 ..." -ForegroundColor Cyan
Write-Host "  Open: frontend\index.html in your browser" -ForegroundColor Yellow
Write-Host "  Stop: Ctrl+C`n"

Set-Location "$PSScriptRoot\backend"
java -cp "target\classes;$pgJar" Main
