@echo off
chcp 65001 > nul
title FarmaYA - Modelo Predictivo de Machine Learning
color 0A

echo =====================================================================
echo    FARMAYA - SISTEMA DE MACHINE LEARNING: PREDICCION DE DEMANDA
echo =====================================================================
echo.
echo Verificando entorno de Python...

python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    py --version >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] No se detecto Python instalado en el sistema.
        echo Por favor instale Python 3.10 o superior desde python.org
        echo o abra el archivo 'modelo_predictivo_farmaya.ipynb' en Google Colab.
        echo.
        pause
        exit /b 1
    ) else (
        set PYTHON_CMD=py
    )
) else (
    set PYTHON_CMD=python
)

echo [OK] Python detectado.
echo.
echo Seleccione el modo de ejecucion:
echo [1] Ejecutar Simulador Interactivo (Recomendado para la sustentacion)
echo [2] Ejecutar Pipeline Completo (demand_model.py)
echo [3] Instalar librerias necesarias (pip install -r requirements.txt)
echo [4] Salir
echo.
set /p opt="Ingrese su opcion (1-4): "

if "%opt%"=="1" (
    cls
    %PYTHON_CMD% simulador_interactivo.py
) else if "%opt%"=="2" (
    cls
    %PYTHON_CMD% demand_model.py
) else if "%opt%"=="3" (
    cls
    echo Instalando dependencias de Machine Learning...
    %PYTHON_CMD% -m pip install -r requirements.txt
    echo.
    echo Dependencias listas.
) else (
    echo Saliendo...
)

echo.
pause
