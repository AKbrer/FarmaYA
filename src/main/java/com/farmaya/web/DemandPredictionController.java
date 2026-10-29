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
 * predictiva de demanda mensual (ALTA, MEDIA, BAJA) y planifiquen existencias.
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
        List<DemandForecast> forecasts = demandService.getForecasts();
        
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
        
        return response;
    }

    @PostMapping("/recalculate")
    public Map<String, Object> recalculate(@RequestAttribute("user") User user) {
        List<DemandForecast> updated = demandService.recalculateForecasts();
        
        long countAlta = updated.stream().filter(f -> "ALTA".equalsIgnoreCase(f.category)).count();
        long countMedia = updated.stream().filter(f -> "MEDIA".equalsIgnoreCase(f.category)).count();
        long countBaja = updated.stream().filter(f -> "BAJA".equalsIgnoreCase(f.category)).count();

        Map<String, Object> response = new HashMap<>();
        response.put("forecasts", updated);
        response.put("summary", Map.of(
            "totalMedicines", updated.size(),
            "alta", countAlta,
            "media", countMedia,
            "baja", countBaja
        ));
        response.put("message", "Pronóstico de demanda actualizado exitosamente a partir de los pedidos de MongoDB.");
        return response;
    }
}
