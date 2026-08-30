param([string]$Command = "help")

$BackendDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$LibDir = Join-Path $BackendDir "lib"
$SrcDir = Join-Path $BackendDir "src"
$OutDir = Join-Path $BackendDir "target\classes"
$PgJarFile = "postgresql-42.6.0.jar"
$PgJarPath = Join-Path $LibDir $PgJarFile
$PgJarUrl = "https://repo1.maven.org/maven2/org/postgresql/postgresql/42.6.0/postgresql-42.6.0.jar"

function Download-Driver {
    if (Test-Path $PgJarPath) {
        Write-Host "PostgreSQL driver already downloaded" -ForegroundColor Green
        return $true
    }
    
    Write-Host "Downloading PostgreSQL JDBC driver (42.6.0)..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Path $LibDir -Force | Out-Null
    
    try {
        Invoke-WebRequest -Uri $PgJarUrl -OutFile $PgJarPath -UseBasicParsing -ErrorAction Stop
        Write-Host "Downloaded: $PgJarPath" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "Failed to download PostgreSQL driver" -ForegroundColor Red
        Write-Host "Error: $_" -ForegroundColor Red
        return $false
    }
}

function Build-Project {
    Write-Host "Building backend..." -ForegroundColor Cyan
    
    if (-not (Download-Driver)) {
        return $false
    }
    
    New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
    
    $classpath = "$PgJarPath;$OutDir"
    
    $files = "User.java", "Contact.java", "Category.java", "Database.java", "Server.java", "Main.java"
    
    foreach ($file in $files) {
        $srcPath = Join-Path $SrcDir $file
        if (Test-Path $srcPath) {
            Write-Host "  Compiling $file" -ForegroundColor Gray
            javac -cp $classpath -d $OutDir $srcPath 2>&1
            if ($LASTEXITCODE -ne 0) {
                Write-Host "Compilation failed!" -ForegroundColor Red
                return $false
            }
        }
    }
    
    Write-Host "Build successful!" -ForegroundColor Green
    return $true
}

function Run-Project {
    $classpath = "$PgJarPath;$OutDir"
    
    if (-not (Test-Path $OutDir)) {
        Write-Host "Classes not found. Run build first." -ForegroundColor Red
        return
    }

    Write-Host "Starting ContactFlow Backend..." -ForegroundColor Green
    Write-Host "Listening on http://0.0.0.0:8080" -ForegroundColor Cyan
    Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
    Write-Host ""
    
    Push-Location $SrcDir
    java -cp $classpath Main
    Pop-Location
}

function Clean-Project {
    Write-Host "Cleaning..." -ForegroundColor Cyan
    Remove-Item -Path $OutDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "Clean complete!" -ForegroundColor Green
}

if ($Command -eq "build") {
    Build-Project
} elseif ($Command -eq "run") {
    Run-Project
} elseif ($Command -eq "rebuild") {
    if (Build-Project) { Run-Project }
} elseif ($Command -eq "clean") {
    Clean-Project
} else {
    Write-Host "Backend Build and Run Script"
    Write-Host ""
    Write-Host "Usage: build.ps1 [command]"
    Write-Host ""
    Write-Host "Commands:"
    Write-Host "  build    Compile Java files"
    Write-Host "  run      Run the compiled backend"
    Write-Host "  rebuild  Clean, compile, and run"
    Write-Host "  clean    Remove compiled files"
    Write-Host "  help     Show this message"
}
