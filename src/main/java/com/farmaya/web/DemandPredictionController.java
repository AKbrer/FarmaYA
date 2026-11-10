package com.farmaya.web;

import com.farmaya.model.DemandForecast;
import com.farmaya.model.Role;
import com.farmaya.model.User;
import com.farmaya.service.DemandPredictionService;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Endpoint para que las farmacias y administradores consulten la clasificación
 * predictiva de demanda mensual (ALTA, MEDIA, BAJA) y el gráfico de líneas de evolución.
 */
@RestController
@RequestMapping("/api/demand-forecast")
@Roles({Role.FARMACIA, Role.ADMIN})
public class DemandPredictionController {

    private final DemandPredictionService demandService;

    public DemandPredictionController(DemandPredictionService demandService) {
        this.demandService = demandService;
    }

    @GetMapping
    public Map<String, Object> getForecast(@RequestAttribute("user") User user) {
        boolean isPharmacy = user != null && user.role == Role.FARMACIA;
        List<DemandForecast> forecasts = isPharmacy
                ? demandService.getForecastsForPharmacy(user)
                : demandService.getForecasts();
        return buildResponse(forecasts, user, isPharmacy, null);
    }

    @PostMapping("/recalculate")
    public Map<String, Object> recalculate(@RequestAttribute("user") User user) {
        boolean isPharmacy = user != null && user.role == Role.FARMACIA;
        List<DemandForecast> updated = isPharmacy
                ? demandService.getForecastsForPharmacy(user)
                : demandService.recalculateForecasts();
        String msg = isPharmacy
                ? "Pronóstico actualizado con las ventas reales de tu farmacia."
                : "Pronóstico y series temporales actualizados exitosamente a partir de los pedidos de MongoDB.";
        return buildResponse(updated, user, isPharmacy, msg);
    }

    private Map<String, Object> buildResponse(List<DemandForecast> forecasts, User user, boolean isPharmacy, String message) {
        long countAlta = forecasts.stream().filter(f -> "ALTA".equalsIgnoreCase(f.category)).count();
        long countMedia = forecasts.stream().filter(f -> "MEDIA".equalsIgnoreCase(f.category)).count();
        long countBaja = forecasts.stream().filter(f -> "BAJA".equalsIgnoreCase(f.category)).count();

        Map<String, Object> response = new HashMap<>();
        response.put("forecasts", forecasts);
        response.put("summary", Map.of(
            "totalMedicines", forecasts.size(),
            "alta", countAlta,
            "media", countMedia,
            "baja", countBaja
        ));
        response.put("period", !forecasts.isEmpty() ? forecasts.get(0).forecastPeriod : "Próximo Mes");
        response.put("generatedAt", !forecasts.isEmpty() ? forecasts.get(0).generatedAt : null);
        response.put("chartSeries", demandService.buildAggregatedChartSeries(forecasts));
        response.put("scopedToPharmacy", isPharmacy);
        if (isPharmacy && user != null) {
            response.put("pharmacyName", user.pharmacyName != null ? user.pharmacyName : user.name);
        }
        if (message != null) {
            response.put("message", message);
        }
        return response;
    }
}
