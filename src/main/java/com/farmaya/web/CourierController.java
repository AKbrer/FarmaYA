package com.farmaya.web;

import com.farmaya.model.Dtos.DeliverRequest;
import com.farmaya.model.Order;
import com.farmaya.model.Role;
import com.farmaya.model.User;
import com.farmaya.service.OrderService;
import com.farmaya.service.PartnerDashboardService;
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
@RequestMapping("/api/courier")
@Roles(Role.REPARTIDOR)
public class CourierController {
    private final OrderService orders;
    private final PartnerDashboardService dashboard;

    public CourierController(OrderService orders, PartnerDashboardService dashboard) {
        this.orders = orders;
        this.dashboard = dashboard;
    }

    @GetMapping("/dashboard/report")
    public Map<String, Object> dashboardReport(@RequestAttribute("user") User user,
            @RequestParam String from, @RequestParam String to) {
        return dashboard.courierReport(user, from, to);
    }

    @GetMapping("/dashboard")
    public Map<String, Object> dashboard(@RequestAttribute("user") User user) { return dashboard.courier(user); }

    @GetMapping("/offers")
    public Map<String, Object> offers(@RequestAttribute("user") User user) {
        String reason = orders.courierBlockReason(user);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("available", reason == null);
        m.put("reason", reason);
        m.put("orders", reason == null ? orders.offersForCourier(user) : List.of());
        return m;
    }

    @GetMapping("/orders")
    public List<Order> mine(@RequestAttribute("user") User user) {
        return orders.mineForCourier(user);
    }

    @PostMapping("/orders/{id}/accept")
    public Order accept(@PathVariable String id, @RequestAttribute("user") User user) {
        return orders.acceptByCourier(id, user);
    }

    @PostMapping("/orders/{id}/release")
    public Order release(@PathVariable String id, @RequestAttribute("user") User user) {
        return orders.releaseByCourier(id, user);
    }

    @PostMapping("/orders/{id}/pickup")
    public Order pickup(@PathVariable String id, @RequestAttribute("user") User user) {
        return orders.pickup(id, user);
    }

    @PostMapping("/orders/{id}/on-the-way")
    public Order onTheWay(@PathVariable String id, @RequestAttribute("user") User user) {
        return orders.onTheWay(id, user);
    }

    @PostMapping("/orders/{id}/deliver")
    public Order deliver(@PathVariable String id, @RequestAttribute("user") User user, @RequestBody DeliverRequest r) {
        return orders.deliver(id, user, r.code());
    }
}
