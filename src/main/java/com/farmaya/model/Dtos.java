package com.farmaya.model;

import java.util.List;

public final class Dtos {
    private Dtos() {}

    public record RegisterRequest(String name, String email, String password, String phone, String role,
                                  String zone, String pharmacyName, String address, String licenseNumber,
                                  String openFrom, String openTo, String vehicle, Double latitude, Double longitude) {}

    public record LoginRequest(String email, String password) {}

    public record AuthResponse(String token, User user) {}

    public record ItemRequest(String name, Integer quantity, Boolean prescription, String note) {}

    public record CreateOrderRequest(List<ItemRequest> items, String address, String zone, String phone, String notes, String city, Double latitude, Double longitude) {}

    public record ConfirmItem(String name, Integer quantity, Double unitPrice, Boolean available) {}

    public record ConfirmRequest(List<ConfirmItem> items, Integer prepMinutes, String note) {}

    public record DeliverRequest(String code) {}

    public record NoteRequest(String note) {}

    public record FlagRequest(boolean value) {}

    public record ResolveRequest(String action, String note) {}

    public record ProfileRequest(String name, String email, String phone, String zone, String pharmacyName,
                                 String address, String openFrom, String openTo, String vehicle, Double latitude, Double longitude) {}

    public record PasswordRequest(String current, String next) {}
    public record EditPermissionRequest(String reason) {}
    public record CreateAdminRequest(String name, String email, String phone, String password) {}
    public record GoogleLoginRequest(
        @com.fasterxml.jackson.annotation.JsonProperty("idToken") String idToken,
        @com.fasterxml.jackson.annotation.JsonProperty("email") String email,
        @com.fasterxml.jackson.annotation.JsonProperty("name") String name,
        @com.fasterxml.jackson.annotation.JsonProperty("googleId") String googleId,
        @com.fasterxml.jackson.annotation.JsonProperty("avatarUrl") String avatarUrl
    ) {}
}
