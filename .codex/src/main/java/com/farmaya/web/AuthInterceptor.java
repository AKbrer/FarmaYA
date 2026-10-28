package com.farmaya.web;

import com.farmaya.model.Session;
import com.farmaya.model.User;
import com.farmaya.repo.SessionRepository;
import com.farmaya.repo.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Instant;
import java.util.Arrays;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

/** Valida el token, carga el usuario y aplica las restricciones de @Roles. */
@Component
public class AuthInterceptor implements HandlerInterceptor {
    private final SessionRepository sessions;
    private final UserRepository users;

    public AuthInterceptor(SessionRepository sessions, UserRepository users) {
        this.sessions = sessions;
        this.users = users;
    }

    @Override
    public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler) {
        if (!(handler instanceof HandlerMethod hm)) return true;
        if (hm.hasMethodAnnotation(Public.class)) return true;

        String header = req.getHeader("Authorization");
        String token = header != null && header.startsWith("Bearer ") ? header.substring(7).trim() : null;
        if (token == null || token.isEmpty()) throw ApiException.unauthorized("Inicia sesión para continuar.");

        String hash = Session.hash(token);
        Session session = sessions.findById(hash)
                .orElseThrow(() -> ApiException.unauthorized("Tu sesión expiró. Inicia sesión de nuevo."));
        if (session.expiresAt.isBefore(Instant.now())) {
            sessions.deleteById(hash);
            throw ApiException.unauthorized("Tu sesión expiró. Inicia sesión de nuevo.");
        }
        User user = users.findById(session.userId)
                .orElseThrow(() -> ApiException.unauthorized("Tu sesión expiró. Inicia sesión de nuevo."));
        if (!user.enabled) throw ApiException.forbidden("Tu cuenta está deshabilitada. Contacta al administrador.");

        Roles roles = hm.getMethodAnnotation(Roles.class);
        if (roles == null) roles = hm.getBeanType().getAnnotation(Roles.class);
        if (roles != null && !Arrays.asList(roles.value()).contains(user.role)) {
            throw ApiException.forbidden("No tienes permiso para realizar esta acción.");
        }

        req.setAttribute("user", user);
        req.setAttribute("token", token);
        return true;
    }
}
