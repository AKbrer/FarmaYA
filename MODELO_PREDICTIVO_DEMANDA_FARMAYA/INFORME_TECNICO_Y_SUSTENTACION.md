# FarmaYA — Documento Técnico y Guía de Sustentación del Modelo Predictivo de Demanda

**Materia / Proyecto:** Proyecto de Grado / Ingeniería de Software / Machine Learning  
**Sistema:** FarmaYA (Módulo de Inteligencia Artificial para Farmacias)  
**Algoritmo:** Ensamble de Árboles de Decisión (`RandomForestClassifier`)  
**Tipo de Aprendizaje:** Aprendizaje Automático Supervisado (Clasificación Multiclase)  

---

## 1. Planteamiento del Problema y Justificación

En la administración de farmacias comunitarias e institucionales existen dos riesgos operativos graves y opuestos:

1. **Quiebre de Stock (Desabastecimiento):** Si se agotan medicamentos de alta rotación (ej. analgésicos, antipiréticos, antihipertensivos), los pacientes interrumpen sus tratamientos y la farmacia pierde ingresos y reputación.
2. **Sobreinventario y Pérdidas por Caducidad:** Adquirir en exceso medicamentos de baja rotación o alto costo genera capital de trabajo inmovilizado y vencimiento de productos en bodega, lo cual representa pérdidas financieras directas.

### Solución Implementada
Un modelo predictivo de Machine Learning que analiza el comportamiento histórico de consumo mensual de cada medicamento y clasifica con antelación el nivel de demanda esperada para el siguiente mes en tres categorías estratégicas:
- **ALTA DEMANDA:** Medicamentos de consumo masivo y rotación constante.
- **MEDIA DEMANDA:** Medicamentos de consumo moderado y predecible.
- **BAJA DEMANDA:** Medicamentos especializados, de alto valor o baja frecuencia.

Con base en esta clasificación, el sistema calcula automáticamente un **Stock de Seguridad Dinámico** y genera una recomendación de compras para el administrador farmacéutico.

---

## 2. Metodología e Ingeniería de Características (Feature Engineering)

El modelo no se limita a predecir con base en la última venta; procesa una serie temporal con variables predictoras calculadas:

| Variable | Nombre Técnico | Descripción e Interpretación |
| :--- | :--- | :--- |
| **Rezagos de Pedidos** | `orders_lag_1`, `orders_lag_2`, `orders_lag_3` | Frecuencia de solicitudes en los meses $T-1$, $T-2$ y $T-3$. Modela la persistencia temporal. |
| **Rezagos de Unidades** | `units_lag_1`, `units_lag_2`, `units_lag_3` | Volumen físico despachado en periodos previos. |
| **Media Móvil Trimestral** | `rolling_avg_orders` | Suavizado de la demanda base: $\frac{\text{Lag}_1 + \text{Lag}_2 + \text{Lag}_3}{3}$. Filtra el ruido estocástico mensual. |
| **Pendiente de Tendencia** | `trend_orders` | Aceleración o desaceleración intermensual ($\Delta = \text{Lag}_1 - \text{Lag}_2$). Detecta si el producto va en alza o a la baja. |
| **Ticket Promedio** | `avg_units_per_order` | Relación unidades/pedido. Ayuda a distinguir tratamientos crónicos de compras esporádicas. |
| **Ratio de Prescripción** | `prescription_ratio` | Porcentaje de despachos que requirieron fórmula médica ($0.0$ a $1.0$). |
| **Estacionalidad** | `month_of_year` | Mes del año proyectado ($1$ a $12$). Modela picos estacionales (ej. gripales en meses fríos o lluvias). |

---

## 3. Justificación del Algoritmo Seleccionado

Se seleccionó **Random Forest Classifier** (`scikit-learn`) debido a sus ventajas clave sobre otros algoritmos:

1. **Relaciones No Lineales:** La demanda farmacéutica rara vez es estrictamente lineal; los árboles de decisión capturan particiones complejas y umbrales naturales de stock.
2. **Robustez ante Outliers:** Los picos inusuales de pedidos de un mes no descalibran el modelo gracias al ensamble por *bagging* (100 estimadores independientes).
3. **Control del Sobreajuste (Overfitting):** Al entrenar con subconjuntos aleatorios de datos y de variables (`max_depth=6`, `min_samples_split=3`), generaliza eficientemente.
4. **Explicabilidad (Feature Importance):** Permite extraer exactamente qué porcentaje de la decisión corresponde a cada variable, un requisito ético y regulatorio indispensable en el sector salud.
5. **Manejo del Desbalance:** Incorpora ponderación de clases (`class_weight="balanced"`), protegiendo la detección de medicamentos de baja demanda.

---

## 4. Métricas de Evaluación del Modelo

El modelo se evalúa mediante validación estratificada ($75\%$ entrenamiento / $25\%$ prueba) y validación cruzada:

- **Accuracy Global (Exactitud):** $> 90\%$ de predicciones correctas en el conjunto de prueba no visto.
- **Precision (Precisión):** Minimiza los falsos positivos (evita clasificar un medicamento de baja rotación como ALTA para no sobreabastecer).
- **Recall (Exhaustividad):** Minimiza los falsos negativos (vital en la categoría ALTA para que ningún medicamento esencial quede sin stock de seguridad).
- **F1-Score:** Balance armónico entre precisión y exhaustividad.
- **Matriz de Confusión:** Permite visualizar en qué categorías se presentan las dudas marginales (típicamente entre ALTA y MEDIA en productos frontera).

---

## 5. Reglas de Negocio: Stock de Seguridad y Estrategia de Compras

La predicción no queda como un dato aislado, sino que se convierte en una acción operativa directa:

$$ \text{Stock Sugerido} = \text{Unidades Proyectadas} \times (1 + \text{Margen de Seguridad}) $$

| Categoría Predicha | Margen de Seguridad | Estrategia Operativa para la Farmacia |
| :---: | :---: | :--- |
| **ALTA** | **$+35\%$** | **Aprovisionamiento masivo prioritario.** Stock de seguridad amplio para amortiguar picos imprevistos y evitar quiebres de stock. |
| **MEDIA** | **$+20\%$** | **Reposición mensual regular.** Programación estándar con proveedores para mantener niveles óptimos. |
| **BAJA** | **$+10\%$** | **Compra bajo demanda en lotes reducidos.** Margen mínimo para evitar inmovilización de capital y vencimiento del producto. |

---

## 6. Guion Rápido de Sustentación para la Profesora (3 a 5 minutos)

### Paso 1: Introducción (30 segundos)
> *"Buenas tardes, profesora. En el proyecto FarmaYA desarrollamos un módulo de Machine Learning enfocado en optimizar el abastecimiento farmacéutico. El problema central que resolvemos es doble: evitar el desabastecimiento de medicamentos esenciales y prevenir pérdidas financieras por vencimiento de productos de baja rotación."*

### Paso 2: Modelo y Variables (1 minuto)
> *"Para lograrlo, implementamos un modelo supervisado de clasificación multiclase con Random Forest. El modelo analiza el histórico de pedidos mediante ingeniería de características: calcula rezagos de 3 meses (lags), medias móviles trimestrales, tasas de tendencia, tamaño promedio de solicitud y factores de estacionalidad."*

### Paso 3: Demostración en Vivo (1.5 minutos)
> - Abre el archivo `simulador_interactivo.py` o el notebook `modelo_predictivo_farmaya.ipynb`.
> - Muestra la opción 1 (catálogo completo) y la opción 3 (métricas y matriz de confusión).
> *"Como se puede observar, el modelo evalúa cada medicamento y predice su demanda (Alta, Media o Baja) con un nivel de confianza superior al 90%. Lo más importante es que esta predicción se traduce de inmediato en un stock de seguridad dinámico: +35% para alta rotación, +20% para rotación media y +10% para baja rotación."*

### Paso 4: Conclusión (30 segundos)
> *"De esta manera, el modelo no solo hace predicción analítica, sino que se integra al panel de administración de la farmacia para brindar soporte a la toma de decisiones en tiempo real."*

---

## 7. Preguntas Típicas de la Profesora y Cómo Responderlas

**P1: ¿Por qué usaron Random Forest y no una regresión lineal o logística?**
> *Respuesta:* *"Porque la serie temporal de demanda tiene saltos estacionales y relaciones no lineales complejas que una regresión lineal no puede capturar adecuadamente. Además, Random Forest es un ensamble que reduce la varianza y el sobreajuste mediante bagging, y permite manejar clases desbalanceadas mediante ponderación de pesos."*

**P2: ¿Cómo previnieron el sobreajuste (overfitting)?**
> *Respuesta:* *"Limitamos la profundidad máxima de los árboles (`max_depth=6`), exigimos un mínimo de muestras por división (`min_samples_split=3`), dividimos el conjunto con partición estratificada al 25% y realizamos validación cruzada (Cross-Validation de 3 pliegues)."*

**P3: ¿Qué variable resultó ser la más importante para el modelo?**
> *Respuesta:* *"Al inspeccionar la importancia de características (`feature_importances_`), la media móvil trimestral (`rolling_avg_orders`) y el rezago del mes inmediato anterior (`orders_lag_1`) son los predictores con mayor peso, seguidos por la tendencia y el ticket promedio de unidades."*

**P4: ¿Qué pasa si una farmacia es nueva y no tiene datos históricos acumulados?**
> *Respuesta:* *"El sistema cuenta con un generador de series sintéticas iniciales y umbrales basados en percentiles que le permiten arrancar en frío (Cold Start), y a medida que se registran pedidos reales en MongoDB, el modelo se reentrena dinámicamente con los datos propios de la farmacia."*
