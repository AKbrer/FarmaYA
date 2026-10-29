package com.farmaya.model;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * Pronóstico de demanda mensual por medicamento generado por el modelo de ML o análisis estadístico.
 * Colección: 'predicciones_demanda' en MongoDB.
 */
@Document("predicciones_demanda")
public class DemandForecast {
    @Id
    public String id;
    
    public String medicineName;
    
    /** Categoría pronosticada: ALTA, MEDIA, BAJA */
    public String category;
    
    /** Confianza o probabilidad de la predicción (%) */
    public Double confidence;
    
    /** Estimación de solicitudes/pedidos en el mes */
    public Integer estimatedOrders;
    
    /** Estimación de unidades totales solicitadas */
    public Integer predictedUnits;
    
    /** Stock mínimo de existencias recomendado para la farmacia */
    public Integer recommendedStock;
    
    /** Tendencia histórica: Creciente, Estable, Decreciente */
    public String historicalTrend;
    
    /** Recomendación de compras/inventario */
    public String actionRecommendation;
    
    /** Periodo pronosticado (ej. "Noviembre 2026") */
    public String forecastPeriod;

    /** Puntos de evolución mensual para gráfico de líneas (histórico + proyección) */
    public List<Integer> historyPoints = new ArrayList<>();
    public List<String> monthLabels = new ArrayList<>();
    
    public Instant generatedAt;

    public DemandForecast() {}

    public DemandForecast(String medicineName, String category, Double confidence, Integer estimatedOrders,
                          Integer predictedUnits, Integer recommendedStock, String historicalTrend,
                          String actionRecommendation, String forecastPeriod, Instant generatedAt) {
        this.medicineName = medicineName;
        this.category = category;
        this.confidence = confidence;
        this.estimatedOrders = estimatedOrders;
        this.predictedUnits = predictedUnits;
        this.recommendedStock = recommendedStock;
        this.historicalTrend = historicalTrend;
        this.actionRecommendation = actionRecommendation;
        this.forecastPeriod = forecastPeriod;
        this.generatedAt = generatedAt != null ? generatedAt : Instant.now();
    }
}
