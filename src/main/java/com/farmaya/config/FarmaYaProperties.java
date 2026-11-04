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
        boolean seedDemo,
        String googleClientId,
        String wompiPublicKey,
        String wompiPrivateKey,
        String wompiIntegritySecret,
        String wompiCurrency) {

    public int searchTimeoutSeconds() {
        return searchTimeoutSeconds > 0 ? searchTimeoutSeconds : 180;
    }

    public int pharmacyConfirmTimeoutSeconds() {
        return pharmacyConfirmTimeoutSeconds > 0 ? pharmacyConfirmTimeoutSeconds : 300;
    }

    public int priceAcceptTimeoutSeconds() {
        return priceAcceptTimeoutSeconds > 0 ? priceAcceptTimeoutSeconds : 600;
    }

    public int maxSearchRounds() {
        return maxSearchRounds > 0 ? maxSearchRounds : 3;
    }
}
