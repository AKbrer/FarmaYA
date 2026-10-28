package com.farmaya.web;


import com.farmaya.model.Role;
import com.farmaya.model.User;
import com.farmaya.service.OrderService;
import com.farmaya.repo.UserRepository;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Farmacias verificadas de la plataforma, para que el cliente vea la red (sin datos de contacto). */
@RestController
@RequestMapping("/api/pharmacies")
@Roles(Role.CLIENTE)
public class PharmacyDirectoryController {
    private final UserRepository users;
    private final OrderService orders;

    public PharmacyDirectoryController(UserRepository users, OrderService orders) {
        this.users = users;
        this.orders = orders;
    }

    @GetMapping
    public List<Map<String, Object>> list(@RequestAttribute("user") User user) {
        List<User> found = new ArrayList<>(users.findByRole(Role.FARMACIA).stream()
                .filter(p -> p.verified && p.enabled).toList());
        // Primero las de la zona del cliente, luego por nombre
        found.sort(Comparator.comparing((User p) -> !(p.zone != null && p.zone.equals(user.zone)))
                .thenComparing(p -> p.pharmacyName == null ? "" : p.pharmacyName.toLowerCase()));

        List<Map<String, Object>> out = new ArrayList<>();
        for (User p : found) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", p.id);
            m.put("name", p.pharmacyName);
            m.put("address", p.address);
            m.put("zone", p.zone);
            m.put("openFrom", p.openFrom);
            m.put("openTo", p.openTo);
            m.put("open", p.active && orders.isOpenNow(p));
            m.put("sameZone", p.zone != null && p.zone.equals(user.zone));
            out.add(m);
        }
        return out;
    }
}
