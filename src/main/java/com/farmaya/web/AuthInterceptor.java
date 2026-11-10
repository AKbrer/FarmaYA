package com.farmaya.web;

import com.farmaya.model.Role;
import com.farmaya.model.Session;
import com.farmaya.model.User;
import com.farmaya.repo.SessionRepository;
import com.farmaya.repo.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Instant;
import java.util.Arrays;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

/** Valida el token, carga el usuario con cache ultrarrapido y aplica las restricciones de @Roles. */
@Component
public class AuthInterceptor implements HandlerInterceptor {
    private final SessionRepository sessions;
    private final UserRepository users;

    private static final long CACHE_TTL_MS = 20_000;
    private static final Map<String, CachedAuth> AUTH_CACHE = new ConcurrentHashMap<>();

    private record CachedAuth(User user, Session session, long cachedAt) {}

    public static void clearAuthCache() {
        AUTH_CACHE.clear();
    }

    public static void evictToken(String token) {
        if (token != null) {
            AUTH_CACHE.remove(Session.hash(token));
        }
    }

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
        if (token == null || token.isEmpty()) throw ApiException.unauthorized("Inicia sesion para continuar.");

        String hash = Session.hash(token);
        long nowMs = System.currentTimeMillis();

        User user = null;
        Session session = null;

        CachedAuth ca = AUTH_CACHE.get(hash);
        if (ca != null && (nowMs - ca.cachedAt < CACHE_TTL_MS) && ca.session.expiresAt.isAfter(Instant.now())) {
            user = ca.user;
            session = ca.session;
        } else {
            session = sessions.findById(hash)
                    .orElseThrow(() -> ApiException.unauthorized("Tu sesion expiro. Inicia sesion de nuevo."));
            if (session.expiresAt.isBefore(Instant.now())) {
                sessions.deleteById(hash);
                AUTH_CACHE.remove(hash);
                throw ApiException.unauthorized("Tu sesion expiro. Inicia sesion de nuevo.");
            }
            user = users.findById(session.userId)
                    .orElseThrow(() -> ApiException.unauthorized("Tu sesion expiro. Inicia sesion de nuevo."));
            AUTH_CACHE.put(hash, new CachedAuth(user, session, nowMs));
        }

        if (!user.enabled) {
            AUTH_CACHE.remove(hash);
            throw ApiException.forbidden("Tu cuenta esta deshabilitada. Contacta al administrador.");
        }

        Roles roles = hm.getMethodAnnotation(Roles.class);
        if (roles == null) roles = hm.getBeanType().getAnnotation(Roles.class);
        if (roles != null && !Arrays.asList(roles.value()).contains(user.role)) {
            throw ApiException.forbidden("No tienes permiso para realizar esta accion.");
        }

        req.setAttribute("user", user);
        req.setAttribute("token", token);
        return true;
    }
}
