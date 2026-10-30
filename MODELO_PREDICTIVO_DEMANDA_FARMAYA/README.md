# FarmaYA - Módulo de Machine Learning para Predicción de Demanda Mensual

Este módulo implementa un modelo de aprendizaje automático (Machine Learning) supervisado para pronosticar y clasificar la demanda mensual de medicamentos en tres categorías estratégicas:

- **ALTA**: Medicamentos de alta rotación con un número elevado de solicitudes mensuales. Permite prevenir quiebres de stock mediante aprovisionamiento prioritario y márgenes de seguridad elevados (+35%).
- **MEDIA**: Medicamentos con demanda moderada y predecible. Permite mantener ciclos de reposición regulares (+20%).
- **BAJA**: Medicamentos con pocas solicitudes o de consumo esporádico. Evita el sobreinventario, inmovilización de capital y vencimiento mediante compras bajo demanda (+10%).

---

## 1. Arquitectura del Modelo de Aprendizaje Automático

### 1.1 Fuente de Datos (MongoDB)
El modelo se alimenta directamente de la colección **`pedidos`** de FarmaYA en MongoDB:
- Fecha de pedido (`createdAt`)
- Medicamentos solicitados y confirmados (`items` y `confirmedItems`)
- Cantidades solicitadas (`quantity`)
- Medicamentos que requieren fórmula médica (`prescription`)

### 1.2 Ingeniería de Características (Feature Engineering)
A partir de la serie temporal mensual por medicamento se construyen las variables predictoras ($X$):
1. **Rezagos de Solicitudes (`orders_lag_1`, `orders_lag_2`, `orders_lag_3`)**: Frecuencia de pedidos en los meses $T-1$, $T-2$ y $T-3$.
2. **Rezagos de Unidades (`units_lag_1`, `units_lag_2`, `units_lag_3`)**: Volumen total dispensado en periodos previos.
3. **Media Móvil Trimestral (`rolling_avg_orders`)**: Suavizado de la demanda base.
4. **Pendiente de Tendencia (`trend_orders`)**: Tasa de aceleración o desaceleración intermensual ($\Delta = T-1 - T-2$).
5. **Unidades Promedio por Pedido (`avg_units_per_order`)**: Tamaño del ticket por medicamento.
6. **Tasa de Prescripción Médica (`prescription_ratio`)**: Porcentaje de solicitudes que requirieron receta médica.
7. **Estacionalidad (`month_of_year`)**: Mes calendario proyectado (1-12) para capturar picos estacionales (ej. gripales o analgésicos en temporadas frías).

### 1.3 Clasificador Supervisado
- **Algoritmo**: `RandomForestClassifier` (100 estimadores, balanceo de clases, profundidad controlada).
- **Métricas de Evaluación**: Matriz de Confusión, Precisión, Exhaustividad (Recall), F1-Score y Accuracy con validación cruzada.
- **Persistencia**: El modelo se serializa en `demand_classifier.joblib` y las métricas en `model_metrics.json`.
- **Colección de Destino**: Los pronósticos del próximo mes se publican en la colección **`predicciones_demanda`** de MongoDB.

---

## 2. Cómo Ejecutar el Módulo de Machine Learning (Python)

### 2.1 Requisitos Previos
Instalar las dependencias necesarias:
```bash
cd ml
pip install -r requirements.txt
```

### 2.2 Poblar Pedidos Históricos en MongoDB (Opcional si la BD es nueva)
Si el clúster de MongoDB aún no tiene acumulados 6 meses de pedidos de prueba, se puede ejecutar el generador de historial:
```bash
python seed_historical_orders.py
```

### 2.3 Entrenar el Modelo y Generar el Pronóstico
Ejecutar el pipeline de extracción, entrenamiento, validación y predicción:
```bash
python demand_model.py
```

El script mostrará en consola:
- Conexión a MongoDB y total de registros procesados.
- Umbrales empíricos calculados para ALTA, MEDIA y BAJA.
- Reporte de clasificación del modelo (Accuracy, Precision, Recall, F1).
- Tabla resumen de pronóstico para el próximo mes con stock sugerido.
- Confirmación de almacenamiento en la colección `predicciones_demanda`.

---

## 3. Integración en la Plataforma FarmaYA (Backend & Web UI)

Para facilitar la experiencia de las farmacias, el sistema cuenta con doble modalidad:

1. **API REST FarmaYA**:
   - `GET /api/demand-forecast`: Consulta los pronósticos de demanda del próximo mes.
   - `POST /api/demand-forecast/recalculate`: Recalcula el modelo analítico directamente sobre MongoDB en tiempo real.

2. **Panel Web de la Farmacia (`pharmacy.js`)**:
   - Nueva pestaña: **«Predicción de Demanda (IA)»**.
   - Tarjetas KPI con conteo de medicamentos en demanda ALTA, MEDIA y BAJA.
   - Filtros dinámicos por nivel de demanda.
   - Tabla con: Medicamento, Nivel de Demanda (Badges), Solicitudes Estimadas, Unidades Proyectadas, **Stock de Seguridad Sugerido** y Recomendación de Compras.
   - Botón interactivo para actualizar el análisis con los pedidos más recientes.
