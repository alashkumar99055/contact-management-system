@echo off
REM Backend build and run script for Windows (Command Prompt)

if "%1"=="" goto help
if "%1"=="build" goto build
if "%1"=="run" goto run
if "%1"=="rebuild" goto rebuild
if "%1"=="clean" goto clean
if "%1"=="help" goto help
echo Unknown command: %1
goto help

:build
echo Building backend with Maven...
call mvn clean package -DskipTests
if %ERRORLEVEL% EQU 0 (
    echo.
    echo Build successful! JAR created at: target\app.jar
    exit /b 0
) else (
    echo Build failed!
    exit /b 1
)

:run
if not exist "target\app.jar" (
    echo JAR not found at target\app.jar
    echo Run: build.cmd build
    exit /b 1
)
echo Starting ContactFlow Backend on http://0.0.0.0:8080
echo Press Ctrl+C to stop
echo.
java -jar target\app.jar
exit /b %ERRORLEVEL%

:rebuild
call mvn clean package -DskipTests
if %ERRORLEVEL% EQU 0 (
    echo.
    echo Build successful! Starting backend...
    java -jar target\app.jar
) else (
    echo Build failed!
    exit /b 1
)
exit /b %ERRORLEVEL%

:clean
echo Cleaning build artifacts...
call mvn clean
echo Clean complete!
exit /b %ERRORLEVEL%

:help
echo Backend Build and Run Script
echo.
echo USAGE:
echo   build.cmd [command]
echo.
echo COMMANDS:
echo   build       Build the project with Maven
echo   run         Run the built JAR
echo   rebuild     Clean, build, and run
echo   clean       Remove build artifacts
echo   help        Show this help message
echo.
echo EXAMPLES:
echo   build.cmd build
echo   build.cmd run
echo   build.cmd rebuild
echo.
echo DATABASE CONFIGURATION:
echo   Set these environment variables for custom connections:
echo   - POSTGRES_URL (default: jdbc:postgresql://localhost:5432/contactflow)
echo   - POSTGRES_USER (default: postgres)
echo   - POSTGRES_PASSWORD (default: postgres)
echo.
echo EXAMPLE WITH CUSTOM DATABASE:
echo   set POSTGRES_URL=jdbc:postgresql://prod-db:5432/contactflow
echo   set POSTGRES_USER=dbuser
echo   set POSTGRES_PASSWORD=dbpass
echo   build.cmd run
exit /b 0
