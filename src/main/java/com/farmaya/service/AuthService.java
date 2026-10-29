package com.farmaya.service;

import com.farmaya.config.FarmaYaProperties;
import com.farmaya.model.Dtos.AuthResponse;
import com.farmaya.model.Dtos.GoogleLoginRequest;
import com.farmaya.model.Dtos.ProfileRequest;
import com.farmaya.model.Dtos.RegisterRequest;
import com.farmaya.model.Role;
import com.farmaya.model.Session;
import com.farmaya.model.User;
import com.farmaya.repo.SessionRepository;
import com.farmaya.repo.UserRepository;
import com.farmaya.web.ApiException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import java.util.Base64;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
    private static final SecureRandom RND = new SecureRandom();
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final Pattern TIME = Pattern.compile("^([01]\\d|2[0-3]):[0-5]\\d$");

    private final UserRepository users;
    private final SessionRepository sessions;
    private final FarmaYaProperties props;
    private final MovementService movements;
    private final PasswordEncoder encoder = new BCryptPasswordEncoder();

    public AuthService(UserRepository users, SessionRepository sessions, FarmaYaProperties props, MovementService movements) {
        this.users = users;
        this.sessions = sessions;
        this.props = props;
        this.movements = movements;
    }

    public String hashPassword(String raw) {
        return encoder.encode(raw);
    }

    public AuthResponse register(RegisterRequest r) {
        String name = clean(r.name());
        String email = clean(r.email()).toLowerCase();
        String phone = clean(r.phone());
        String zone = clean(r.zone());
        if (zone.isBlank()) {
            zone = "Cobertura General";
        }

        if (name.length() < 2) throw ApiException.bad("Escribe tu nombre completo.");
        if (!EMAIL.matcher(email).matches()) throw ApiException.bad("Escribe un correo electrónico válido.");
        if (r.password() == null || r.password().length() < 8) throw ApiException.bad("La contraseña debe tener al menos 8 caracteres.");
        if (phone.replaceAll("\\D", "").length() < 7) throw ApiException.bad("Escribe un teléfono de contacto válido.");

        Role role;
        try {
            role = Role.valueOf(clean(r.role()).toUpperCase());
        } catch (IllegalArgumentException e) {
            throw ApiException.bad("Selecciona el tipo de cuenta.");
        }
        if (role == Role.ADMIN) throw ApiException.forbidden("Este tipo de cuenta no está disponible.");

        User u = new User();
        u.name = name;
        u.email = email;
        u.phone = phone;
        u.zone = zone;
        u.role = role;
        u.passwordHash = encoder.encode(r.password());
        u.verified = role == Role.CLIENTE;

        if (role == Role.FARMACIA) {
            u.pharmacyName = clean(r.pharmacyName());
            u.address = clean(r.address());
            u.latitude = r.latitude();
            u.longitude = r.longitude();
            u.licenseNumber = clean(r.licenseNumber());
            u.openFrom = r.openFrom() == null || r.openFrom().isBlank() ? "08:00" : r.openFrom().trim();
            u.openTo = r.openTo() == null || r.openTo().isBlank() ? "22:00" : r.openTo().trim();
            if (u.pharmacyName.length() < 2) throw ApiException.bad("Escribe el nombre de la farmacia.");
            if (u.address.length() < 5) throw ApiException.bad("Escribe o selecciona en el mapa la dirección de la farmacia.");
            if (u.licenseNumber.length() < 3) throw ApiException.bad("Escribe el número de licencia o registro sanitario.");
            if (!TIME.matcher(u.openFrom).matches() || !TIME.matcher(u.openTo).matches())
                throw ApiException.bad("Revisa el horario de atención.");
        } else if (role == Role.REPARTIDOR) {
            u.vehicle = clean(r.vehicle());
            if (u.vehicle.isEmpty()) u.vehicle = "Moto";
            u.plate = clean(r.plate());
        }

        if (r.documents() != null && !r.documents().isEmpty()) {
            for (var doc : r.documents()) {
                if (doc != null && doc.dataUrl() != null && !doc.dataUrl().isBlank()) {
                    u.verificationDocuments.add(new User.VerificationDoc(
                            clean(doc.docType()), clean(doc.title()), clean(doc.filename()), doc.dataUrl()));
                }
            }
        }

        if (users.findByEmailIgnoreCase(email).isPresent()) throw ApiException.conflict("Ya existe una cuenta con ese correo.");
        try {
            users.save(u);
        } catch (DuplicateKeyException e) {
            throw ApiException.conflict("Ya existe una cuenta con ese correo.");
        }
        return new AuthResponse(openSession(u), u);
    }

    public AuthResponse login(String email, String password) {
        User u = users.findByEmailIgnoreCase(clean(email)).orElse(null);
        if (u == null || password == null || !encoder.matches(password, u.passwordHash)) {
            throw ApiException.unauthorized("Correo o contraseña incorrectos.");
        }
        if (!u.enabled) throw ApiException.forbidden("Tu cuenta está deshabilitada. Contacta al administrador.");
        return new AuthResponse(openSession(u), u);
    }

    public AuthResponse loginWithGoogle(GoogleLoginRequest r) {
        String email = clean(r.email()).toLowerCase(Locale.ROOT);
        String name = clean(r.name());
        String googleId = clean(r.googleId());
        String avatarUrl = clean(r.avatarUrl());

        // Si se recibe un JWT idToken (Google Identity Services)
        if (r.idToken() != null && !r.idToken().isBlank()) {
            try {
                String[] parts = r.idToken().split("\\.");
                if (parts.length >= 2) {
                    String payloadJson = new String(Base64.getUrlDecoder().decode(parts[1]), java.nio.charset.StandardCharsets.UTF_8);
                    com.fasterxml.jackson.databind.JsonNode json = new com.fasterxml.jackson.databind.ObjectMapper().readTree(payloadJson);
                    if (json.has("email") && (email.isEmpty() || !email.contains("@"))) {
                        email = json.get("email").asText().toLowerCase(Locale.ROOT);
                    }
                    if (json.has("name") && name.isEmpty()) {
                        name = json.get("name").asText();
                    }
                    if (json.has("sub") && googleId.isEmpty()) {
                        googleId = json.get("sub").asText();
                    }
                    if (json.has("picture") && avatarUrl.isEmpty()) {
                        avatarUrl = json.get("picture").asText();
                    }
                }
            } catch (Exception ignored) {}
        }

        if (email.isBlank() || !EMAIL.matcher(email).matches()) {
            throw ApiException.bad("No se pudo obtener un correo electrónico válido de Google.");
        }
        if (name.isBlank()) {
            name = email.split("@")[0];
        }

        User u = users.findByEmailIgnoreCase(email).orElse(null);
        if (u != null) {
            if (!u.enabled) {
                throw ApiException.forbidden("Tu cuenta está deshabilitada. Contacta al administrador.");
            }
            boolean changed = false;
            if (googleId != null && !googleId.isBlank() && (u.googleId == null || u.googleId.isBlank())) {
                u.googleId = googleId;
                changed = true;
            }
            if (avatarUrl != null && !avatarUrl.isBlank() && (u.avatarUrl == null || u.avatarUrl.isBlank())) {
                u.avatarUrl = avatarUrl;
                changed = true;
            }
            if (changed) {
                users.save(u);
            }
            return new AuthResponse(openSession(u), u);
        }

        // Crear automáticamente la cuenta de cliente con Google
        User newUser = new User();
        newUser.name = name;
        newUser.email = email;
        newUser.phone = "";
        newUser.zone = "Cobertura General";
        newUser.role = Role.CLIENTE;
        newUser.verified = true;
        newUser.enabled = true;
        newUser.active = true;
        newUser.googleId = googleId;
        newUser.avatarUrl = avatarUrl;
        newUser.passwordHash = encoder.encode(UUID.randomUUID().toString());

        User saved = users.save(newUser);
        return new AuthResponse(openSession(saved), saved);
    }

    /** Actualiza los datos editables del perfil. */
    public User updateProfile(User u, ProfileRequest r) {
        String name = clean(r.name());
        String email = clean(r.email()).toLowerCase(Locale.ROOT);
        String phone = clean(r.phone());
        if (email.isBlank() || !email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) throw ApiException.bad("Escribe un correo electrónico válido.");
        if (!email.equalsIgnoreCase(u.email) && users.findByEmailIgnoreCase(email).isPresent()) throw ApiException.conflict("Ya existe una cuenta con ese correo.");
        String zone = clean(r.zone());
        if (zone.isBlank()) {
            zone = u.zone != null && !u.zone.isBlank() ? u.zone : "Cobertura General";
        }
        if (name.length() < 2) throw ApiException.bad("Escribe tu nombre completo.");
        if (phone.replaceAll("\\D", "").length() < 7) throw ApiException.bad("Escribe un teléfono de contacto válido.");

        if (u.role == Role.FARMACIA) {
            if (!u.canEditProfile) {
                throw ApiException.forbidden("Las farmacias requieren autorización del administrador para modificar sus datos o número de contacto.");
            }
            String pharmacyName = clean(r.pharmacyName());
            String address = clean(r.address());
            String from = clean(r.openFrom());
            String to = clean(r.openTo());
            if (pharmacyName.length() < 2) throw ApiException.bad("Escribe el nombre de la farmacia.");
            if (address.length() < 5) throw ApiException.bad("Escribe la dirección de la farmacia.");
            if (!TIME.matcher(from).matches() || !TIME.matcher(to).matches())
                throw ApiException.bad("Revisa el horario de atención.");
            Double latitude = r.latitude();
            Double longitude = r.longitude();
            if ((latitude == null) != (longitude == null)) throw ApiException.bad("Ingresa tanto la latitud como la longitud de la farmacia.");
            if (latitude != null && (latitude < -90 || latitude > 90)) throw ApiException.bad("Latitud de farmacia inválida.");
            if (longitude != null && (longitude < -180 || longitude > 180)) throw ApiException.bad("Longitud de farmacia inválida.");
            u.pharmacyName = pharmacyName;
            u.address = address;
            u.latitude = latitude;
            u.longitude = longitude;
            u.openFrom = from;
            u.openTo = to;
            u.canEditProfile = false;
            u.editPermissionRequested = false;
            movements.record("USUARIO_EDICION_FARMACIA", "La farmacia " + (u.pharmacyName != null ? u.pharmacyName : u.name) + " actualizó sus datos y teléfono de contacto con autorización.", u, null);
        } else if (u.role == Role.REPARTIDOR) {
            String vehicle = clean(r.vehicle());
            if (vehicle.isEmpty()) throw ApiException.bad("Indica tu medio de transporte.");
            u.vehicle = vehicle;
        }
        u.name = name;
        u.email = email;
        u.phone = phone;
        u.zone = zone;
        return users.save(u);
    }

    /** Permite a una farmacia solicitar autorización al administrador para modificar sus datos o teléfono. */
    public User requestEditPermission(User u, String reason) {
        if (u.role != Role.FARMACIA) {
            throw ApiException.bad("Solo las farmacias gestionan este permiso de edición.");
        }
        u.editPermissionRequested = true;
        u.editRequestNote = clean(reason);
        u.editRequestedAt = Instant.now();
        User saved = users.save(u);
        movements.record("FARMACIA_SOLICITUD_EDICION", "La farmacia " + (u.pharmacyName != null ? u.pharmacyName : u.name) + " solicitó permiso para editar sus datos/número.", u, null);
        return saved;
    }

    /** Guarda el estado de disponibilidad en la colección propia del rol y registra el cambio. */
    public User updateActive(User user, boolean active) {
        if (user.active != active) {
            user.active = active;
            User saved = users.save(user);
            String subject = user.role == Role.FARMACIA
                    ? (user.pharmacyName == null || user.pharmacyName.isBlank() ? user.name : user.pharmacyName)
                    : user.name;
            String action = user.role == Role.FARMACIA
                    ? (active ? "comenzó a recibir pedidos." : "dejó de recibir pedidos.")
                    : (active ? "se puso disponible para domicilios." : "dejó de estar disponible para domicilios.");
            movements.record("DISPONIBILIDAD", subject + " " + action, saved, null);
            return saved;
        }
        return user;
    }

    /** Cambia la contraseña y cierra las demás sesiones abiertas de la cuenta. */
    public void changePassword(User u, String currentToken, String current, String next) {
        if (current == null || !encoder.matches(current, u.passwordHash))
            throw ApiException.bad("La contraseña actual no es correcta.");
        if (next == null || next.length() < 8)
            throw ApiException.bad("La nueva contraseña debe tener al menos 8 caracteres.");
        if (next.equals(current))
            throw ApiException.bad("La nueva contraseña debe ser distinta de la actual.");
        u.passwordHash = encoder.encode(next);
        users.save(u);
        String keep = Session.hash(currentToken);
        for (Session s : sessions.findByUserId(u.id)) {
            if (!keep.equals(s.tokenHash)) sessions.deleteById(s.tokenHash);
        }
    }

    public void logout(String token) {
        sessions.deleteById(Session.hash(token));
    }

    private String openSession(User u) {
        byte[] raw = new byte[32];
        RND.nextBytes(raw);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        Session s = new Session();
        s.tokenHash = Session.hash(token);
        s.userId = u.id;
        s.expiresAt = Instant.now().plus(props.sessionHours(), ChronoUnit.HOURS);
        sessions.save(s);
        return token;
    }

    private static String clean(String s) {
        return s == null ? "" : s.trim();
    }
}
