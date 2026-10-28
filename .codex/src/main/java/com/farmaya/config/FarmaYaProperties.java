package com.farmaya.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "farmaya")
public record FarmaYaProperties(
        int searchTimeoutSeconds,
        int pharmacyConfirmTimeoutSeconds,
        int priceAcceptTimeoutSeconds,
        int maxSearchRounds,
        int sessionHours,
        int maxActiveDeliveries,
        List<String> zones,
        String timezone,
        String adminEmail,
        String adminPassword,
        boolean seedDemo) {
}
