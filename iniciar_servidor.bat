@echo off
title FarmaYA - Servidor Backend Local
echo ========================================================
echo   Iniciando FarmaYA Spring Boot en http://localhost:8080
echo ========================================================
"C:\Program Files\Java\jdk-21\bin\java.exe" "@target\cp_farmaya_cli.argfile" com.farmaya.FarmaYaApplication
pause
