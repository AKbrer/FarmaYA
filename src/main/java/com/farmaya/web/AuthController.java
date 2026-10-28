package com.farmaya.web;

import com.farmaya.model.Dtos.AuthResponse;
import com.farmaya.model.Dtos.EditPermissionRequest;
import com.farmaya.model.Dtos.FlagRequest;
import com.farmaya.model.Dtos.GoogleLoginRequest;
import com.farmaya.model.Dtos.LoginRequest;
import com.farmaya.model.Dtos.PasswordRequest;
import com.farmaya.model.Dtos.ProfileRequest;
import com.farmaya.model.Dtos.RegisterRequest;
import com.farmaya.model.Role;
import com.farmaya.model.User;
import com.farmaya.service.AuthService;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService auth;
    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    @Public
    @PostMapping("/register")
    public AuthResponse register(@RequestBody RegisterRequest r) {
        return auth.register(r);
    }

    @Public
    @PostMapping("/login")
    public AuthResponse login(@RequestBody LoginRequest r) {
        return auth.login(r.email(), r.password());
    }

    @Public
    @PostMapping("/google")
    public AuthResponse googleLogin(@RequestBody GoogleLoginRequest r) {
        return auth.loginWithGoogle(r);
    }

    @GetMapping("/me")
    public User me(@RequestAttribute("user") User user) {
        return user;
    }

    @PutMapping("/profile")
    public User profile(@RequestAttribute("user") User user, @RequestBody ProfileRequest r) {
        return auth.updateProfile(user, r);
    }

    @Roles(Role.FARMACIA)
    @PostMapping("/request-edit-permission")
    public User requestEditPermission(@RequestAttribute("user") User user, @RequestBody(required = false) EditPermissionRequest r) {
        return auth.requestEditPermission(user, r != null ? r.reason() : "");
    }

    @PostMapping("/password")
    public Map<String, Boolean> password(@RequestAttribute("user") User user,
                                         @RequestAttribute("token") String token,
                                         @RequestBody PasswordRequest r) {
        auth.changePassword(user, token, r.current(), r.next());
        return Map.of("ok", true);
    }

    @PostMapping("/logout")
    public Map<String, Boolean> logout(@RequestAttribute("token") String token) {
        auth.logout(token);
        return Map.of("ok", true);
    }

    /** Farmacia: recibir pedidos sí/no. Repartidor: disponible sí/no. */
    @Roles({Role.FARMACIA, Role.REPARTIDOR})
    @PostMapping("/active")
    public User active(@RequestAttribute("user") User user, @RequestBody FlagRequest flag) {
        return auth.updateActive(user, flag.value());
    }
}
