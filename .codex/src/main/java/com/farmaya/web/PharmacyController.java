package com.farmaya.web;

import com.farmaya.model.Dtos.ConfirmRequest;
import com.farmaya.model.Order;
import com.farmaya.model.Role;
import com.farmaya.model.User;
import com.farmaya.service.OrderService;
import com.farmaya.service.MovementService;
import com.farmaya.service.PartnerDashboardService;
import com.farmaya.model.Movement;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/pharmacy")
@Roles(Role.FARMACIA)
public class PharmacyController {
    private final OrderService orders;
    private final MovementService movements;
    private final PartnerDashboardService dashboard;

    public PharmacyController(OrderService orders, MovementService movements, PartnerDashboardService dashboard) {
        this.orders = orders;
        this.movements = movements;
        this.dashboard = dashboard;
    }

    @GetMapping("/movements")
    public List<Movement> movements(@RequestAttribute("user") User user) { return movements.forActor(user); }

    @GetMapping("/dashboard")
    public Map<String, Object> dashboard(@RequestAttribute("user") User user) { return dashboard.pharmacy(user); }

    @GetMapping("/dashboard/report")
    public Map<String, Object> dashboardReport(@RequestAttribute("user") User user,
            @RequestParam String from, @RequestParam String to) {
        return dashboard.pharmacyReport(user, from, to);
    }

    /** Solicitudes abiertas que esta farmacia puede aceptar, o el motivo por el que no las ve. */
    @GetMapping("/offers")
    public Map<String, Object> offers(@RequestAttribute("user") User user) {
        String reason = orders.pharmacyBlockReason(user);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("receiving", reason == null);
        m.put("reason", reason);
        m.put("orders", reason == null ? orders.offersForPharmacy(user) : List.of());
        return m;
    }

    @GetMapping("/orders")
    public List<Order> mine(@RequestAttribute("user") User user) {
        return orders.mineForPharmacy(user);
    }

    @PostMapping("/orders/{id}/accept")
    public Order accept(@PathVariable String id, @RequestAttribute("user") User user) {
        return orders.acceptByPharmacy(id, user);
    }

    @PostMapping("/orders/{id}/reject")
    public Map<String, Boolean> reject(@PathVariable String id, @RequestAttribute("user") User user) {
        orders.rejectOffer(id, user);
        return Map.of("ok", true);
    }

    @PostMapping("/orders/{id}/release")
    public Order release(@PathVariable String id, @RequestAttribute("user") User user) {
        return orders.releaseByPharmacy(id, user);
    }

    @PostMapping("/orders/{id}/confirm")
    public Order confirm(@PathVariable String id, @RequestAttribute("user") User user, @RequestBody ConfirmRequest r) {
        return orders.confirmPrices(id, user, r);
    }

    @PostMapping("/orders/{id}/start")
    public Order start(@PathVariable String id, @RequestAttribute("user") User user) {
        return orders.startPreparation(id, user);
    }

    @PostMapping("/orders/{id}/ready")
    public Order ready(@PathVariable String id, @RequestAttribute("user") User user) {
        return orders.markReady(id, user);
    }
}
