# ContactFlow — Compile & Start Backend
# Simple build and run script that doesn't require Maven
# Just needs: Java 17+ and PostgreSQL running on localhost:5432

param()

$BackendDir = Join-Path $PSScriptRoot "backend"
$SrcDir = Join-Path $BackendDir "src"
$OutDir = Join-Path $BackendDir "target\classes"
$LibDir = Join-Path $BackendDir "lib"
$PgJarFile = "postgresql-42.6.0.jar"
$PgJarPath = Join-Path $LibDir $PgJarFile
$PgJarUrl = "https://repo1.maven.org/maven2/org/postgresql/postgresql/42.6.0/postgresql-42.6.0.jar"

Write-Host "ContactFlow Backend - Build & Start" -ForegroundColor Cyan
Write-Host ""

# 1. Check Java
Write-Host "Checking Java..." -ForegroundColor Yellow
try {
    $jv = java -version 2>&1 | Select-String "version"
    Write-Host "OK: $jv" -ForegroundColor Green
} catch {
    Write-Host "FAILED: Java 17+ not found" -ForegroundColor Red
    exit 1
}

# 2. Download PostgreSQL Driver
if (-not (Test-Path $PgJarPath)) {
    Write-Host "`nDownloading PostgreSQL JDBC driver (42.6.0)..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $LibDir -Force | Out-Null
    
    try {
        Invoke-WebRequest -Uri $PgJarUrl -OutFile $PgJarPath -UseBasicParsing -ErrorAction Stop
        Write-Host "Downloaded OK" -ForegroundColor Green
    } catch {
        Write-Host "FAILED: Could not download driver" -ForegroundColor Red
        Write-Host "Error: $_" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "`nPostgreSQL driver: OK (already downloaded)" -ForegroundColor Green
}

# 3. Compile Java Files
Write-Host "`nCompiling Java files..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null

$classpath = "$PgJarPath;$OutDir"
$files = "User.java", "Contact.java", "Category.java", "Database.java", "Server.java", "Main.java"

$errors = 0
foreach ($file in $files) {
    $srcPath = Join-Path $SrcDir $file
    if (Test-Path $srcPath) {
        javac -cp $classpath -d $OutDir $srcPath 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ERROR: $file" -ForegroundColor Red
            $errors++
        } else {
            Write-Host "  OK: $file" -ForegroundColor Green
        }
    }
}

if ($errors -gt 0) {
    Write-Host "`nCompilation failed!" -ForegroundColor Red
    exit 1
}

# 4. Start Backend
Write-Host "`nStarting ContactFlow Backend..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Server: http://0.0.0.0:8080" -ForegroundColor Cyan
Write-Host "Database: jdbc:postgresql://localhost:5432/contactflow" -ForegroundColor Cyan
Write-Host "Frontend: open frontend/index.html" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop`n" -ForegroundColor Yellow

Push-Location $SrcDir
java -cp $classpath Main
Pop-Location

